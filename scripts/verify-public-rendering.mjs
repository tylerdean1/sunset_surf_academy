import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const base = process.env.PUBLIC_TEST_BASE_URL || 'http://127.0.0.1:3101';
const canonicalOrigin = new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://www.sunsetsurfacademy.com').origin;
let server;

async function get(path) {
    const response = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(30000) });
    assert.equal(response.status, 200, `${path} must return 200`);
    return response.text();
}

try {
    if (!process.env.PUBLIC_TEST_BASE_URL) {
        server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', '3101'], { stdio: 'inherit', windowsHide: true });
        const deadline = Date.now() + 30000;
        for (;;) {
            try { await get('/robots.txt'); break; }
            catch (error) {
                if (Date.now() > deadline || server.exitCode !== null) throw error;
                await delay(250);
            }
        }
    }
    const titles = new Map();
    const pages = ['', 'lessons', 'book', 'gallery', 'mission_statement', 'about_jaz', 'team', 'faq', 'contact'];
    for (const path of pages.flatMap((page) => ['en', 'es'].map((locale) => `/${locale}${page ? `/${page}` : ''}`))) {
        const html = await get(path);
        const locale = path.split('/')[1];
        assert.ok(!html.includes('__next_error__'), `${path} returned a Next error shell`);
        assert.match(html, new RegExp(`<html[^>]*lang="${locale}"`), `${path} document language`);
        assert.match(html, /<main\b[^>]*>[\s\S]*?<h[1-6]\b/, `${path} must render page headings on the server`);
        assert.match(html, new RegExp(`<link(?=[^>]*rel="canonical")(?=[^>]*href="${canonicalOrigin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${path}")[^>]*>`), `${path} canonical`);
        for (const language of ['en', 'es']) {
            const alternatePath = path.replace(/^\/(en|es)/, `/${language}`);
            assert.ok(html.includes(`href="${canonicalOrigin}${alternatePath}"`), `${path} missing ${language} alternate`);
        }
        assert.ok(!html.includes('loading_video.mp4'), `${path} blocks first paint with the old loading video`);
        const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
        assert.ok(title && !title.includes('Content unavailable'), `${path} needs useful metadata`);
        assert.ok(!/<meta[^>]*name="robots"[^>]*content="[^"]*noindex/.test(html), `${path} must be indexable`);
        if (path.endsWith('/book') || path.endsWith('/lessons')) {
            const pageKey = path.split('/')[2];
            const response = await fetch(`${base}/api/content-bundle?${new URLSearchParams({ locale, prefix: `page.${pageKey}.` })}`, { signal: AbortSignal.timeout(30000) });
            if (response.ok) {
                const bundle = await response.json();
                const publishedTitle = bundle?.strings?.[`page.${pageKey}.title`];
                if (typeof publishedTitle === 'string' && publishedTitle.length) {
                    const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/)?.[1] || '';
                    const visible = main.replace(/<style\b[^>]*>[\s\S]*?<\/style>/g, '').replace(/<[^>]*>/g, '')
                        .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
                    assert.ok(visible.includes(publishedTitle), `${path} must include its published CMS title in server-rendered content`);
                }
            }
        }
        titles.set(path, title);
        console.log(`PASS ${path}: server content, lang, canonical, alternates, title`);
    }
    assert.notEqual(titles.get('/en'), titles.get('/en/book'), 'Booking metadata must differ from home');
    assert.notEqual(titles.get('/en/lessons'), titles.get('/en/book'), 'Lessons metadata must differ from booking');
    const sitemap = await get('/sitemap.xml');
    assert.equal((sitemap.match(/<url>/g) || []).length, 18, 'Sitemap must include both locales for all nine public pages');
    assert.ok(!sitemap.includes('/admin'), 'Admin pages must be excluded from the sitemap');
    assert.ok(sitemap.includes(`${canonicalOrigin}/es/lessons`), 'Sitemap missing Spanish lessons');
    const robots = await get('/robots.txt');
    assert.ok(robots.includes(`Sitemap: ${canonicalOrigin}/sitemap.xml`));
    assert.ok(robots.includes('Disallow: /api/'));
    assert.ok(robots.includes('Disallow: /en/admin'));
    console.log('PASS sitemap and robots');
} finally {
    server?.kill('SIGTERM');
}
