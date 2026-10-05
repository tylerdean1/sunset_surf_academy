const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test, after } = require('node:test');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const assetId = '11111111-1111-4111-8111-111111111111';
const validAsset = {
    title: 'Surf lesson', bucket: 'Lesson_Photos', path: 'lesson.jpg', public: false,
    category: 'lessons', asset_type: 'photo',
};
const savedAsset = { ...validAsset, id: assetId, sort: 32767, description: null, session_id: null, created_at: null, updated_at: null };
const priorSecret = process.env.SUPABASE_SERVICE_ROLE_KEY;
process.env.SUPABASE_SERVICE_ROLE_KEY = 'isolated-media-test-secret';
after(() => { if (priorSecret === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = priorSecret; });

// Execute real route/validation code. Only the Next response wrapper, admin gate,
// and external Supabase transport are replaced; no database changes are made.
function loadRoute(name, options = {}) {
    const calls = [];
    const storageCalls = [];
    let adminCalls = 0;
    const supabase = {
        from(table) {
            const query = { then: (resolve) => resolve({ data: table === 'media_assets'
                ? { ...validAsset, id: assetId, sort: 32767 } : [], error: null }) };
            for (const method of ['select', 'upsert', 'insert', 'delete', 'eq', 'like', 'maybeSingle']) query[method] = () => query;
            return query;
        },
        async rpc(fn, args) {
            calls.push({ fn, args });
            if (options.rpcThrow) throw options.rpcThrow;
            return options.rpcResult ?? { data: savedAsset, error: null };
        },
        storage: {
            async getBucket(bucket) { storageCalls.push({ op: 'bucket', bucket }); return { data: { id: bucket, file_size_limit: options.sizeLimit ?? null, allowed_mime_types: null }, error: null }; },
            from(bucket) {
                return {
                    async list(folder) { storageCalls.push({ op: 'list', bucket, folder }); return { data: [], error: null }; },
                    async upload(uploadPath) { storageCalls.push({ op: 'upload', bucket, path: uploadPath }); return { data: {}, error: null }; },
                    async remove(paths) { storageCalls.push({ op: 'remove', bucket, paths }); return { data: [], error: null }; },
                    async createSignedUploadUrl(uploadPath, config) { storageCalls.push({ op: 'signed', bucket, path: uploadPath, config }); return { data: { token: 'signed-upload-token', path: uploadPath }, error: null }; },
                    async info(uploadPath) { storageCalls.push({ op: 'info', bucket, path: uploadPath }); return options.infoResult ?? { data: { id: assetId, version: '1', name: uploadPath, bucketId: bucket, size: 5, contentType: 'image/jpeg', cacheControl: '3600', etag: 'etag', lastModified: '2026-10-04T00:00:00Z' }, error: null }; },
                };
            },
        },
    };
    const cache = new Map();
    function load(file) {
        if (cache.has(file)) return cache.get(file).exports;
        const module = { exports: {} };
        cache.set(file, module);
        const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
            compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES5, esModuleInterop: true },
        }).outputText;
        const localRequire = (id) => {
            if (id === 'next/server') return { NextResponse: { json: (body, init) => Response.json(body, init) } };
            if (id === '@/lib/adminAuth') return { requireAdminApi: async () => options.denied
                ? { ok: false, response: Response.json({ ok: false }, { status: 403 }) }
                : { ok: true, userId: options.userId ?? assetId } };
            if (id === '@/lib/supabaseAdmin') return { getSupabaseAdmin: () => { adminCalls++; return supabase; } };
            if (id.startsWith('@/')) return load(path.join(root, `${id.slice(2)}.ts`));
            if (id.startsWith('.')) return load(path.resolve(path.dirname(file), `${id}.ts`));
            return require(id);
        };
        vm.runInThisContext(`(function(require,module,exports){${output}\n})`, { filename: file })(localRequire, module, module.exports);
        return module.exports;
    }
    const route = load(path.join(root, 'app', 'api', 'admin', 'media', name, 'route.ts'));
    return { ...route, calls, storageCalls, adminCalls: () => adminCalls };
}

function jsonRequest(body) {
    return new Request('https://surf.example/api/admin/media', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
}

function uploadRequest(overrides = {}) {
    const form = new FormData();
    for (const [key, value] of Object.entries({ bucket: 'Lesson_Photos', mode: 'single', title: 'Surf lesson', ...overrides })) form.set(key, value);
    form.append('files', new File(['photo'], 'surf.jpg', { type: 'image/jpeg' }));
    return new Request('https://surf.example/api/admin/media/upload', { method: 'POST', body: form });
}

test('denied admin requests cannot reach media writes', async () => {
    for (const name of ['assets', 'slots', 'upload', 'upload/prepare', 'upload/finalize']) {
        const route = loadRoute(name, { denied: true });
        assert.equal((await route.POST(jsonRequest({}))).status, 403);
        assert.equal(route.adminCalls(), 0);
    }
});

test('asset validation rejects coerced values before acquiring a mutation client', async () => {
    for (const patch of [
        { title: 123 }, { public: 'false' }, { category: 'unknown' }, { asset_type: 'other' },
        { sort: 1.5 }, { sort: 32768 }, { id: 'bad' }, { session_id: 'bad' },
        { description: {} }, { asset_key: {} }, { asset_key: 'home hero' },
    ]) {
        const route = loadRoute('assets');
        const response = await route.POST(jsonRequest({ op: 'upsert', asset: { ...validAsset, ...patch } }));
        assert.equal(response.status, 400, JSON.stringify(patch));
        assert.equal(route.adminCalls(), 0);
    }
});

test('asset plus slot saves use one RPC with retain, clear, and normalized replacement semantics', async () => {
    for (const [patch, slots] of [[{}, null], [{ asset_key: null }, []], [{ asset_key: '' }, []], [{ asset_key: 'gallery.images.001' }, ['gallery.images.1']]]) {
        const route = loadRoute('assets');
        const response = await route.POST(jsonRequest({ op: 'upsert', asset: { ...validAsset, ...patch } }));
        assert.equal(response.status, 200);
        assert.equal((await response.json()).item.id, assetId);
        assert.equal(route.calls.length, 1);
        assert.equal(route.calls[0].fn, 'admin_save_media_asset');
        assert.deepEqual(route.calls[0].args.p_slot_keys, slots);
        assert.equal(route.calls[0].args.p_asset.public, false);
    }
});

test('gallery replacement validates exact sizes and UUIDs before any mutation', async () => {
    for (const body of [
        { count: -1 }, { count: 101 }, { count: 1.5 }, { count: '2' },
        { count: 2, asset_ids: 'bad' }, { count: 1, asset_ids: [assetId, null] },
        { count: 1, asset_ids: ['bad'] }, { count: 1, asset_ids: [{}] },
    ]) {
        const route = loadRoute('slots');
        assert.equal((await route.POST(jsonRequest({ op: 'replace_gallery_images', ...body }))).status, 400, JSON.stringify(body));
        assert.equal(route.adminCalls(), 0);
    }
});

test('single-row composite RPC arrays are normalized for asset saves and uploads', async () => {
    for (const name of ['assets', 'upload']) {
        const route = loadRoute(name, { rpcResult: { data: [savedAsset], error: null } });
        const response = await route.POST(name === 'assets'
            ? jsonRequest({ op: 'upsert', asset: validAsset }) : uploadRequest());
        assert.equal(response.status, 200);
        const result = await response.json();
        assert.equal(name === 'assets' ? result.item.id : result.uploaded[0].id, assetId);
    }
});

test('gallery replacement retains null placeholders in one atomic RPC', async () => {
    const route = loadRoute('slots');
    const response = await route.POST(jsonRequest({ op: 'replace_gallery_images', count: 3, asset_ids: [assetId, null] }));
    assert.equal(response.status, 200);
    assert.deepEqual(route.calls, [{ fn: 'admin_replace_gallery_images', args: { p_asset_ids: [assetId, null, null] } }]);
});

test('slot assignment requires an explicit UUID or null and a valid smallint sort', async () => {
    for (const patch of [ {}, { asset_id: '' }, { asset_id: 'bad' }, { asset_id: assetId, sort: '3' }, { asset_id: assetId, sort: -32769 }, { asset_id: assetId, sort: 1.5 } ]) {
        const route = loadRoute('slots');
        assert.equal((await route.POST(jsonRequest({ op: 'set', slot_key: 'home.hero', ...patch }))).status, 400, JSON.stringify(patch));
        assert.equal(route.adminCalls(), 0);
    }
    const route = loadRoute('slots');
    assert.equal((await route.POST(jsonRequest({ op: 'set', slot_key: 'gallery.images.002', asset_id: null }))).status, 200);
    assert.deepEqual(route.calls, [{ fn: 'admin_set_media_slot', args: { p_slot_key: 'gallery.images.2', p_asset_id: null, p_sort: 32767 } }]);
});

test('database constraint failures become safe 400s and infrastructure failures safe 500s', async () => {
    for (const [code, status] of [['23503', 400], ['22023', 400], ['23505', 400], ['XX000', 500]]) {
        const route = loadRoute('assets', { rpcResult: { data: null, error: { code, message: 'secret database details' } } });
        const response = await route.POST(jsonRequest({ op: 'upsert', asset: validAsset }));
        assert.equal(response.status, status);
        assert.doesNotMatch(JSON.stringify(await response.json()), /secret database details/);
    }
});

test('upload rejects invalid metadata before storage is touched', async () => {
    for (const patch of [{ category: 'bad' }, { public: 'garbage' }, { sort: '1.5' }, { sort: '32768' }, { session_id: 'bad' }, { asset_key: 'home hero' }, { folder: '../other' }]) {
        const route = loadRoute('upload');
        assert.equal((await route.POST(uploadRequest(patch))).status, 400, JSON.stringify(patch));
        assert.deepEqual(route.storageCalls, []);
    }
});

test('upload atomically saves asset and slot then returns the database-assigned id', async () => {
    const route = loadRoute('upload');
    const response = await route.POST(uploadRequest({ asset_key: 'gallery.images.003' }));
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).uploaded, [{ bucket: 'Lesson_Photos', path: 'surf.jpg', id: assetId }]);
    assert.equal(route.calls.length, 1);
    assert.equal(route.calls[0].fn, 'admin_save_media_asset');
    assert.deepEqual(route.calls[0].args.p_slot_keys, ['gallery.images.3']);
    assert.equal(route.calls[0].args.p_asset.id, undefined);
});

test('a rejected upload transaction removes only its new storage object', async () => {
    const route = loadRoute('upload', { rpcResult: { data: null, error: { code: '23503', message: 'secret' } } });
    const response = await route.POST(uploadRequest({ asset_key: 'home.hero' }));
    assert.equal(response.status, 400);
    assert.deepEqual(route.storageCalls.at(-1), { op: 'remove', bucket: 'Lesson_Photos', paths: ['surf.jpg'] });
    assert.equal(route.calls.length, 1);
});

test('an upload with an unknown commit result retains its storage object', async () => {
    const route = loadRoute('upload', { rpcThrow: new Error('network lost') });
    const response = await route.POST(uploadRequest());
    assert.equal(response.status, 500);
    assert.equal(route.storageCalls.some((call) => call.op === 'remove'), false);
    assert.doesNotMatch(JSON.stringify(await response.json()), /network lost/);
});

const signedInput = { asset: validAsset, folder: 'lessons', file_name: 'lesson.jpg', file_type: 'image/jpeg', file_size: 5 };

test('signed upload preparation validates metadata before issuing a token', async () => {
    for (const patch of [{ file_size: 0 }, { file_size: '5' }, { file_type: 'text/html' }, { folder: '../outside' }, { asset: { ...validAsset, public: 'false' } }]) {
        const route = loadRoute('upload/prepare');
        assert.equal((await route.POST(jsonRequest({ ...signedInput, ...patch }))).status, 400);
        assert.deepEqual(route.storageCalls, []);
    }
});

test('signed upload grants a new non-overwriting object path and honors bucket size limits', async () => {
    const route = loadRoute('upload/prepare');
    const response = await route.POST(jsonRequest(signedInput));
    assert.equal(response.status, 200);
    const prepared = await response.json();
    assert.equal(prepared.bucket, 'Lesson_Photos');
    assert.equal(prepared.token, 'signed-upload-token');
    assert.match(prepared.path, /^lessons\/lesson\([0-9a-f-]{36}\)\.jpg$/);
    assert.deepEqual(route.storageCalls.at(-1).config, { upsert: false });
    assert.equal(route.calls.length, 0);
    const limited = loadRoute('upload/prepare', { sizeLimit: 4 });
    assert.equal((await limited.POST(jsonRequest(signedInput))).status, 400);
    assert.equal(limited.storageCalls.some(call => call.op === 'signed'), false);
});

test('signed upload finalization verifies stored type/size before one atomic publication', async () => {
    const prepare = loadRoute('upload/prepare');
    const reservation = (await (await prepare.POST(jsonRequest(signedInput))).json()).reservation;
    const route = loadRoute('upload/finalize');
    const response = await route.POST(jsonRequest({ reservation }));
    assert.equal(response.status, 200);
    assert.equal(route.calls.length, 1);
    assert.equal(route.calls[0].fn, 'admin_save_media_asset');
    assert.equal(route.storageCalls[0].op, 'info');
    assert.equal(route.calls[0].args.p_asset.id, undefined);
    for (const info of [{ size: 6, contentType: 'image/jpeg' }, { size: 5, contentType: 'video/mp4' }]) {
        const mismatch = loadRoute('upload/finalize', { infoResult: { data: info, error: null } });
        assert.equal((await mismatch.POST(jsonRequest({ reservation }))).status, 400);
        assert.equal(mismatch.calls.length, 0);
    }
});

test('signed reservations cannot be tampered with or finalized by another admin', async () => {
    const prepare = loadRoute('upload/prepare');
    const reservation = (await (await prepare.POST(jsonRequest(signedInput))).json()).reservation;
    for (const [value, options] of [[`${reservation.slice(0, -1)}z`, {}], [reservation, { userId: '22222222-2222-4222-8222-222222222222' }]]) {
        const route = loadRoute('upload/finalize', options);
        assert.equal((await route.POST(jsonRequest({ reservation: value }))).status, 400);
        assert.deepEqual(route.storageCalls, []);
        assert.equal(route.calls.length, 0);
    }
});

test('signed upload verification distinguishes missing files from storage outages', async () => {
    const prepare = loadRoute('upload/prepare');
    const reservation = (await (await prepare.POST(jsonRequest(signedInput))).json()).reservation;
    for (const [status, expected] of [[404, 400], [503, 500]]) {
        const route = loadRoute('upload/finalize', { infoResult: { data: null, error: { status, message: 'private storage details' } } });
        const response = await route.POST(jsonRequest({ reservation }));
        assert.equal(response.status, expected);
        assert.equal(route.calls.length, 0);
        assert.doesNotMatch(JSON.stringify(await response.json()), /private storage details/);
    }
});

test('expired signed upload reservations cannot publish an asset', async () => {
    const prepare = loadRoute('upload/prepare');
    const reservation = (await (await prepare.POST(jsonRequest(signedInput))).json()).reservation;
    const originalNow = Date.now;
    const future = originalNow() + 3 * 60 * 60 * 1000;
    Date.now = () => future;
    try {
        const route = loadRoute('upload/finalize');
        assert.equal((await route.POST(jsonRequest({ reservation }))).status, 400);
        assert.deepEqual(route.storageCalls, []);
        assert.equal(route.calls.length, 0);
    } finally { Date.now = originalNow; }
});
