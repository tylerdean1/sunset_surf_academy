import assert from 'node:assert/strict';
import test from 'node:test';
import { sameOrigin, accessTokenMaxAge } from '../lib/adminOrigin';
import { mergeLoadedCmsDraft, cmsStringOrFallback } from '../lib/cmsDraft';
import { relocateReceipt } from '../lib/receiptRelocation';
import { expenseOutflowDollars } from '../lib/financeCashflow';
import { fetchContentBundle, invalidateContentCache } from '../lib/contentCache';
import { syncAdminSession } from '../lib/adminSessionClient';
import { createSeededContentCache } from '../lib/seededContentCache';

test('mutation origin compares the complete parsed origin', () => {
    const make = (origin: string) => new Request('https://surf.example/api/admin/logout', { headers: { origin } });
    assert.equal(sameOrigin(make('https://surf.example')), true);
    assert.equal(sameOrigin(make('https://surf.example.attacker.test')), false);
    assert.equal(sameOrigin(make('https://surf.example:444')), false);
    assert.equal(sameOrigin(make('http://surf.example')), false);
    assert.equal(sameOrigin(make('null')), false);
    assert.equal(sameOrigin(new Request('https://surf.example/api/admin/logout', {
        headers: { referer: 'https://surf.example/en/admin' },
    })), true);
});

test('cookie lifetime follows the validated token expiry', () => {
    const jwt = `header.${Buffer.from(JSON.stringify({ exp: 1700 })).toString('base64url')}.signature`;
    assert.equal(accessTokenMaxAge(jwt, 1000), 700);
    assert.equal(accessTokenMaxAge(jwt, 1800), 0);
});

test('delayed CMS loads preserve edited locales and fill untouched translations', () => {
    assert.deepEqual(mergeLoadedCmsDraft({ en: 'Typed title', es: '' }, { en: true }, {
        body_en: 'Old title', body_es_draft: 'Titulo existente',
    }), { en: 'Typed title', es: 'Titulo existente' });
    assert.deepEqual(mergeLoadedCmsDraft({ en: '', es: '' }, { en: true, es: true }, {
        body_en: 'Old', body_es_draft: 'Viejo',
    }), { en: '', es: '' });
    assert.equal(cmsStringOrFallback('', 'fallback'), '');
    assert.equal(cmsStringOrFallback(null, 'fallback'), 'fallback');
});

test('receipt copy or database failure retains the original file', async () => {
    const events: string[] = [];
    await assert.rejects(relocateReceipt({
        copy: async () => { events.push('copy'); },
        update: async () => { events.push('update'); throw new Error('database failed'); },
        removeNew: async () => { events.push('remove-new'); },
        removeOld: async () => { events.push('remove-old'); },
    }), /database failed/);
    assert.deepEqual(events, ['copy', 'update', 'remove-new']);
    events.length = 0;
    await assert.rejects(relocateReceipt({
        copy: async () => { events.push('copy'); throw new Error('copy failed'); },
        update: async () => { events.push('update'); },
        removeNew: async () => { events.push('remove-new'); },
        removeOld: async () => { events.push('remove-old'); },
    }), /copy failed/);
    assert.deepEqual(events, ['copy']);
});

test('receipt commits its database pointer before removing old storage', async () => {
    const events: string[] = [];
    const result = await relocateReceipt({
        copy: async () => { events.push('copy'); },
        update: async () => { events.push('update'); },
        removeNew: async () => { events.push('remove-new'); },
        removeOld: async () => { events.push('remove-old'); throw new Error('storage unavailable'); },
    });
    assert.deepEqual(events, ['copy', 'update', 'remove-old']);
    assert.match(result.warning || '', /storage unavailable/);
});

test('customer refund offsets received revenue as positive cash outflow', () => {
    const receivedRevenue = 100;
    const customerRefund = expenseOutflowDollars(10000);
    assert.equal(customerRefund, 100);
    assert.equal(receivedRevenue - customerRefund, 0);
});

test('content invalidation rejects stale cache fills from an earlier request', async () => {
    const originalFetch = globalThis.fetch;
    let releaseOld: (response: Response) => void = () => {};
    let calls = 0;
    const bundle = (title: string) => ({
        ok: true, locale: 'en', prefix: 'page.home.', mediaPrefix: 'page.home.',
        strings: { title }, updatedAtByKey: {}, media: [],
    });
    globalThis.fetch = (async () => {
        calls += 1;
        if (calls === 1) return await new Promise<Response>((resolve) => { releaseOld = resolve; });
        return Response.json(bundle('Saved title'));
    }) as typeof fetch;
    try {
        invalidateContentCache();
        const oldRequest = fetchContentBundle('en', 'page.home.', 'page.home.');
        invalidateContentCache();
        const newRequest = await fetchContentBundle('en', 'page.home.', 'page.home.');
        assert.equal(newRequest.strings.title, 'Saved title');
        releaseOld(Response.json(bundle('Old title')));
        const lateResult = await oldRequest;
        assert.equal(lateResult.strings.title, 'Saved title');
        const cached = await fetchContentBundle('en', 'page.home.', 'page.home.');
        assert.equal(cached.strings.title, 'Saved title');
        assert.equal(calls, 2);
    } finally {
        globalThis.fetch = originalFetch;
        invalidateContentCache();
    }
});

test('router refresh seed replaces older cached content for a mounted page', async () => {
    let generation = 0;
    const cache = createSeededContentCache<{ body: string }>(() => generation);
    const oldSeed = { body: 'Old page copy' };
    const refreshedSeed = { body: 'New server-rendered copy' };
    cache.seed('en::page.contact', oldSeed);
    assert.equal(cache.peek('en::page.contact'), oldSeed);
    assert.equal(cache.seed('en::page.contact', refreshedSeed), refreshedSeed);
    assert.equal(cache.peek('en::page.contact', refreshedSeed), refreshedSeed);
    assert.equal(await cache.read('en::page.contact', async () => ({ body: 'Stale API response' })), refreshedSeed);
});

test('an older in-flight section request cannot overwrite a newer server seed', async () => {
    let generation = 0;
    const cache = createSeededContentCache<{ title: string }>(() => generation);
    let releaseOld: (value: { title: string }) => void = () => {};
    const oldRequest = cache.read('about', () => new Promise((resolve) => { releaseOld = resolve; }));
    const refreshedSeed = { title: 'Current server title' };
    cache.seed('about', refreshedSeed);
    releaseOld({ title: 'Late stale API title' });
    assert.equal(await oldRequest, refreshedSeed);
    assert.equal(cache.peek('about'), refreshedSeed);
});

test('cache invalidation revalidates the existing page without restoring its old seed', async () => {
    let generation = 0;
    const cache = createSeededContentCache<{ body: string }>(() => generation);
    const initialSeed = { body: 'Before save' };
    cache.seed('faq', initialSeed);
    generation += 1;
    assert.equal(cache.peek('faq', initialSeed), undefined);
    const saved = await cache.read('faq', async () => ({ body: 'After save' }));
    assert.equal(saved.body, 'After save');
    assert.equal(cache.peek('faq', initialSeed), saved);
});

test('cookie token refresh and logout are serialized in auth event order', async () => {
    const originalFetch = globalThis.fetch;
    const requests: Array<{ url: string; token: string | null }> = [];
    let releaseFirst: (response: Response) => void = () => {};
    let started: () => void = () => {};
    const firstStarted = new Promise<void>((resolve) => { started = resolve; });
    globalThis.fetch = (async (url, options) => {
        const body = JSON.parse(String(options?.body));
        requests.push({ url: String(url), token: body.access_token ?? null });
        if (requests.length === 1) {
            started();
            return await new Promise<Response>((resolve) => { releaseFirst = resolve; });
        }
        return Response.json({ ok: true });
    }) as typeof fetch;
    try {
        const first = syncAdminSession('older-token');
        await firstStarted;
        const refreshed = syncAdminSession('refreshed-token');
        const logout = syncAdminSession(null);
        await Promise.resolve();
        assert.equal(requests.length, 1);
        releaseFirst(Response.json({ ok: true }));
        await Promise.all([first, refreshed, logout]);
        assert.deepEqual(requests.map((request) => request.token), ['older-token', 'refreshed-token', null]);
        assert.equal(requests[2].url, '/api/admin/logout');
    } finally {
        globalThis.fetch = originalFetch;
    }
});
