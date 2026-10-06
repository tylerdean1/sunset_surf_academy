import test from 'node:test';
import assert from 'node:assert/strict';
import { getHomeHeroDefaults, getPublicNavigation, isCurrentPublicRoute, isPublicSitePath } from '../lib/publicNavigation';

test('public navigation gives each locale real, localized destinations', () => {
    const english = getPublicNavigation('en');
    const spanish = getPublicNavigation('es');

    assert.deepEqual(english.map(({ key }) => key), ['home', 'lessons', 'schedule', 'gallery', 'about', 'faq', 'contact']);
    assert.equal(english.find(({ key }) => key === 'schedule')?.href, '/en/book');
    assert.equal(spanish.find(({ key }) => key === 'schedule')?.label, 'Reservar');
    assert.equal(spanish.find(({ key }) => key === 'about')?.href, '/es/mission_statement');
});

test('active route matching does not mark home for every page and includes nested sections', () => {
    assert.equal(isCurrentPublicRoute('/en', '/en', true), true);
    assert.equal(isCurrentPublicRoute('/en/lessons', '/en', true), false);
    assert.equal(isCurrentPublicRoute('/en/lessons/private', '/en/lessons', false), true);
    assert.equal(isCurrentPublicRoute('/en/gallery', '/en/lessons', false), false);
});

test('home hero fallback copy is useful and points to the real booking and about pages', () => {
    const english = getHomeHeroDefaults('en');
    const spanish = getHomeHeroDefaults('es');

    assert.equal(english.title, 'Learn to Surf in Rincón');
    assert.match(english.subtitle, /Rincón, Puerto Rico/);
    assert.equal(english.primaryHref, '/en/book');
    assert.equal(english.secondaryHref, '/en/mission_statement');
    assert.equal(spanish.primaryHref, '/es/book');
    assert.equal(spanish.secondaryHref, '/es/mission_statement');
    assert.ok(!english.title.includes('Content unavailable'));
});

test('public footer is limited to public locale routes', () => {
    assert.equal(isPublicSitePath('/en', 'en'), true);
    assert.equal(isPublicSitePath('/es/book', 'es'), true);
    assert.equal(isPublicSitePath('/en/admin', 'en'), false);
    assert.equal(isPublicSitePath('/en/admin/live-editor', 'en'), false);
    assert.equal(isPublicSitePath('/en/adminlogin', 'en'), false);
});
