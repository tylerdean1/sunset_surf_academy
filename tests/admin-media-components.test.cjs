const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

// Exercise the actual screen handlers with controlled form state. The external
// browser transport and UI renderer are replaced; no Supabase requests are made.
function render(name, values) {
    const changes = new Map();
    let index = 0;
    let invalidations = 0;
    const storageCalls = [];
    const react = {
        createElement(type, props, ...children) { return { type, props: props ?? {}, children }; },
        useState(initial) {
            const key = index++;
            return [Object.hasOwn(values, key) ? values[key] : initial, value => changes.set(key, value)];
        },
        useMemo(fn) { return fn(); },
        useEffect() {},
    };
    const module = { exports: {} };
    const file = path.join(__dirname, '..', 'components', 'admin', `${name}.tsx`);
    const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React, esModuleInterop: true },
    }).outputText;
    const localRequire = id => {
        if (id === 'react') return react;
        if (id === '@mui/material') return new Proxy({}, { get: (_, key) => key });
        if (id === '@/hooks/useContentBundle') return { __esModule: true, default: () => ({ t: (_, fallback) => fallback }) };
        if (id === '@/lib/contentCache') return { invalidateContentCache: () => invalidations++ };
        if (id === '@/lib/adminMediaClient') return { getAdminMediaSignedUrl: async () => 'https://example.test/preview' };
        if (id === '@/lib/supabaseClient') return { getSupabaseClient: () => ({ storage: { from: bucket => ({
            async uploadToSignedUrl(uploadPath, token, file) { storageCalls.push({ bucket, path: uploadPath, token, file }); return { data: {}, error: null }; },
        }) } }) };
        if (id === '@/lib/rpc') return { rpc: async () => { throw new Error('Browser RPC used'); } };
        if (id === '@/lib/mediaSlots') return { normalizeGalleryImagesSlotKey: key => key };
        throw new Error(`Unexpected import ${id}`);
    };
    vm.runInThisContext(`(function(require,module,exports){${source}\n})`, { filename: file })(localRequire, module, module.exports);
    const tree = module.exports.default();
    function button(label, node = tree) {
        if (!node || typeof node !== 'object') return null;
        if (node.type === 'Button' && node.children.includes(label)) return node;
        for (const child of node.children.flat(Infinity)) {
            const result = button(label, child);
            if (result) return result;
        }
        return null;
    }
    return { button, changes, storageCalls, invalidations: () => invalidations };
}

async function withFetch(responses, action) {
    const original = global.fetch;
    const calls = [];
    global.fetch = async (url, init = {}) => {
        calls.push({ url, init });
        const response = responses.shift();
        assert.ok(response, 'Unexpected fetch');
        return Response.json(response.body, { status: response.status ?? 200 });
    };
    try { await action(calls); } finally { global.fetch = original; }
}

const managerForm = { 5: 'Lesson', 6: 'home.hero', 8: 'Lesson_Photos', 9: 'surf.jpg' };

test('MediaManager saves metadata and key in one authenticated API request before refreshing cache', async () => {
    const screen = render('MediaManager', managerForm);
    await withFetch([{ body: { ok: true, item: { id: 'saved' } } }, { body: { ok: true, items: [] } }], async calls => {
        await screen.button('Save').props.onClick();
        assert.deepEqual(calls.map(call => [call.url, call.init.method ?? 'GET']), [
            ['/api/admin/media/assets', 'POST'], ['/api/admin/media/assets', 'GET'],
        ]);
        const body = JSON.parse(calls[0].init.body);
        assert.equal(body.op, 'upsert');
        assert.equal(body.asset.asset_key, 'home.hero');
        assert.equal(body.asset.public, true);
        assert.equal(screen.invalidations(), 1);
    });
});

test('failed MediaManager saves keep the form open and cache intact', async () => {
    const screen = render('MediaManager', { ...managerForm, 3: true });
    await withFetch([{ status: 400, body: { ok: false, message: 'Invalid media data' } }], async calls => {
        await screen.button('Save').props.onClick();
        assert.equal(calls.length, 1);
        assert.equal(screen.changes.has(3), false);
        assert.equal(screen.invalidations(), 0);
        assert.equal(screen.changes.get(1), 'Invalid media data');
    });
});

test('bulk upload authorizes signed storage transfers and finalizes stable slot numbering', async () => {
    const screen = render('MediaUpload', {
        0: 'bulk', 5: 'gallery.images', 12: [new File(['a'], 'one.jpg'), new File(['b'], 'two.jpg')],
    });
    await withFetch([
        { body: { ok: true, bucket: 'Lesson_Photos', path: 'one.jpg', token: 'token-one', reservation: 'sealed-one' } },
        { body: { ok: true, uploaded: [{ id: 'one', bucket: 'Lesson_Photos', path: 'one.jpg' }] } },
        { body: { ok: true, bucket: 'Lesson_Photos', path: 'two.jpg', token: 'token-two', reservation: 'sealed-two' } },
        { body: { ok: true, uploaded: [{ id: 'two', bucket: 'Lesson_Photos', path: 'two.jpg' }] } },
    ], async calls => {
        await screen.button('Upload').props.onClick();
        assert.deepEqual(calls.map(call => call.url), [
            '/api/admin/media/upload/prepare', '/api/admin/media/upload/finalize',
            '/api/admin/media/upload/prepare', '/api/admin/media/upload/finalize',
        ]);
        assert.equal(JSON.parse(calls[0].init.body).asset.asset_key, 'gallery.images.001');
        assert.equal(JSON.parse(calls[2].init.body).asset.asset_key, 'gallery.images.002');
        assert.equal(JSON.parse(calls[0].init.body).asset.public, true);
        assert.deepEqual(JSON.parse(calls[1].init.body), { reservation: 'sealed-one' });
        assert.equal(screen.storageCalls.length, 2);
        assert.equal(screen.storageCalls[0].token, 'token-one');
        assert.equal(screen.changes.get(16).length, 2);
        assert.equal(screen.invalidations(), 2);
    });
});

test('partial upload failure preserves completed file feedback and clears selection to avoid replay', async () => {
    const screen = render('MediaUpload', { 0: 'bulk', 12: [new File(['a'], 'one.jpg'), new File(['b'], 'two.jpg')] });
    await withFetch([
        { body: { ok: true, bucket: 'Lesson_Photos', path: 'one.jpg', token: 'token-one', reservation: 'sealed-one' } },
        { body: { ok: true, uploaded: [{ id: 'one', bucket: 'Lesson_Photos', path: 'one.jpg' }] } },
        { body: { ok: true, bucket: 'Lesson_Photos', path: 'two.jpg', token: 'token-two', reservation: 'sealed-two' } },
        { status: 500, body: { ok: false, uploaded: [], message: 'Refresh Media before retrying' } },
    ], async () => {
        await screen.button('Upload').props.onClick();
        assert.equal(screen.changes.get(16).length, 1);
        assert.equal(screen.changes.get(12), null);
        assert.equal(screen.invalidations(), 1);
        assert.match(screen.changes.get(14), /Refresh Media/);
    });
});

test('large photo bytes go through signed storage while API requests carry only metadata', async () => {
    const photo = new File([new Uint8Array(5 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' });
    const screen = render('MediaUpload', { 3: 'Large photo', 12: [photo] });
    await withFetch([
        { body: { ok: true, bucket: 'Lesson_Photos', path: 'large.jpg', token: 'large-token', content_type: 'image/jpeg', reservation: 'sealed-large' } },
        { body: { ok: true, uploaded: [{ id: 'large', bucket: 'Lesson_Photos', path: 'large.jpg' }] } },
    ], async calls => {
        await screen.button('Upload').props.onClick();
        assert.equal(calls.length, 2);
        assert.equal(JSON.parse(calls[0].init.body).file_size, 5 * 1024 * 1024);
        assert.equal(calls.every(call => typeof call.init.body === 'string' && call.init.body.length < 10000), true);
        assert.equal(screen.storageCalls[0].file.size, 5 * 1024 * 1024);
        assert.equal(screen.invalidations(), 1);
    });
});
