import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildSectionSavePayload,
    cloneComposerSection,
    copyComposerDraftValues,
    createComposerSection,
    findComposerMetaError,
    getComposerSectionKeys,
    hasUnsavedComposerChanges,
    mediaPointersToClearWhenRemoving,
    moveSectionToIndex,
    reindexComposerSections,
    type ComposerSection,
} from '../lib/pageComposerModel';

function section(id: string, kind: ComposerSection['kind'] = 'hero', overrides: Partial<ComposerSection> = {}): ComposerSection {
    return {
        id,
        page_key: 'home',
        kind,
        sort: 0,
        status: 'published',
        anchor: null,
        meta: { version: 1, kind },
        content_source: {},
        media_source: {},
        ...overrides,
    };
}

function objectValue(value: unknown): Record<string, any> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
}

test('moveSectionToIndex moves the chosen section and leaves the source array untouched', () => {
    const original = [section('hero'), section('text', 'richText'), section('media', 'media')];

    const moved = moveSectionToIndex(original, 'media', 0);

    assert.deepEqual(moved.map((item) => item.id), ['media', 'hero', 'text']);
    assert.deepEqual(original.map((item) => item.id), ['hero', 'text', 'media']);
    assert.notEqual(moved, original);
});

test('moveSectionToIndex keeps the order for an unknown id and clamps indexes', () => {
    const original = [section('hero'), section('text', 'richText')];

    assert.deepEqual(moveSectionToIndex(original, 'missing', 1), original);
    assert.deepEqual(moveSectionToIndex(original, 'hero', 50).map((item) => item.id), ['text', 'hero']);
});

test('reindexComposerSections keeps preview sort values aligned with the draft order', () => {
    const reordered = [section('media', 'media', { sort: 20 }), section('hero', 'hero', { sort: 0 }), section('text', 'richText', { sort: 10 })];

    const indexed = reindexComposerSections(reordered);

    assert.deepEqual(indexed.map((item) => [item.id, item.sort]), [
        ['media', 0],
        ['hero', 10],
        ['text', 20],
    ]);
    assert.deepEqual(reordered.map((item) => [item.id, item.sort]), [
        ['media', 20],
        ['hero', 0],
        ['text', 10],
    ]);
});

test('findComposerMetaError ignores invalid metadata belonging to a deleted section', () => {
    const sections = [section('remaining')];
    const errors = { deleted: 'Invalid JSON', remaining: '' };

    assert.equal(findComposerMetaError(sections, errors), null);
    assert.deepEqual(findComposerMetaError(sections, { ...errors, remaining: 'Invalid JSON' }), {
        sectionId: 'remaining',
        message: 'Invalid JSON',
    });
});

test('createComposerSection adds safe, unique draft pointers for each supported kind', () => {
    const hero = createComposerSection('home', 'hero', 'hero-id', 20);
    const text = createComposerSection('about_jaz', 'richText', 'text-id', 0);
    const media = createComposerSection('gallery', 'media', 'media-id', 10);
    const cards = createComposerSection('home', 'card_group', 'cards-id', 30);

    assert.equal(hero.status, 'draft');
    assert.deepEqual(hero.content_source, {
        titleKey: 'section.hero-id.title',
        subtitleKey: 'section.hero-id.subtitle',
        bodyKey: 'section.hero-id.body',
        ctaPrimary: { labelKey: 'section.hero-id.cta.primary.label', hrefKey: 'section.hero-id.cta.primary.href' },
        ctaSecondary: { labelKey: 'section.hero-id.cta.secondary.label', hrefKey: 'section.hero-id.cta.secondary.href' },
    });
    assert.deepEqual(hero.media_source, {
        backgroundSlot: 'section.hero-id.bg',
        primarySlot: 'section.hero-id.primary',
        carouselSlot: 'section.hero-id.carousel',
    });
    assert.equal(text.page_key, 'about_jaz');
    assert.equal(objectValue(media.media_source).primarySlot, 'section.media-id.primary');
    assert.equal(objectValue(cards.content_source).sourceKey, 'home.cards.lessons');
    assert.equal(objectValue(cards.meta).variant, 'default');
});

test('getComposerSectionKeys prefers saved pointers and fills supported defaults', () => {
    const item = section('keyed', 'hero', {
        content_source: {
            titleKey: 'brand.headline',
            ctaPrimary: { labelKey: 'brand.start', hrefKey: 'brand.link' },
        },
        media_source: { backgroundSlot: 'brand.cover' },
    });

    assert.deepEqual(getComposerSectionKeys(item), {
        titleKey: 'brand.headline',
        subtitleKey: 'section.keyed.subtitle',
        bodyKey: 'section.keyed.body',
        primaryLabelKey: 'brand.start',
        primaryHrefKey: 'brand.link',
        secondaryLabelKey: 'section.keyed.cta.secondary.label',
        secondaryHrefKey: 'section.keyed.cta.secondary.href',
        backgroundSlot: 'brand.cover',
        primarySlot: 'section.keyed.primary',
        carouselSlot: '',
    });
});

test('cloneComposerSection remaps saved content and media pointers to fresh ids', () => {
    const original = section('old-id', 'hero', {
        content_source: {
            titleKey: 'custom.title',
            subtitleKey: 'custom.subtitle',
            ctaPrimary: { labelKey: 'custom.cta.label', hrefKey: 'custom.cta.href' },
        },
        media_source: { backgroundSlot: 'custom.background', primarySlot: 'custom.primary' },
    });

    const cloned = cloneComposerSection(original, 'new-id', 10);

    assert.equal(cloned.section.id, 'new-id');
    assert.equal(cloned.section.sort, 10);
    assert.notEqual(objectValue(cloned.section.content_source).titleKey, objectValue(original.content_source).titleKey);
    assert.equal(objectValue(cloned.section.content_source).titleKey, 'section.new-id.title');
    assert.equal(objectValue(cloned.section.media_source).backgroundSlot, 'section.new-id.bg');
    assert.equal(cloned.cmsKeyMap['custom.title'], 'section.new-id.title');
    assert.equal(cloned.cmsKeyMap['custom.cta.href'], 'section.new-id.cta.primary.href');
    assert.equal(cloned.slotKeyMap['custom.background'], 'section.new-id.bg');
});

test('copyComposerDraftValues duplicates localized text and media under fresh pointers', () => {
    const copied = copyComposerDraftValues(
        { 'old.title': 'new.title' },
        { 'old.image': 'new.image' },
        { 'old.title': { en: 'Hello', es: 'Hola' } },
        { 'old.image': [{ id: 'asset-1', url: '/preview.jpg' }] }
    );

    assert.deepEqual(copied.content['new.title'], { en: 'Hello', es: 'Hola' });
    assert.deepEqual(copied.media['new.image'], [{ id: 'asset-1', url: '/preview.jpg' }]);
    assert.deepEqual(copied.content['old.title'], { en: 'Hello', es: 'Hola' });
    assert.deepEqual(copied.media['old.image'], [{ id: 'asset-1', url: '/preview.jpg' }]);
});

test('deleting one section preserves media slots still referenced by another section', () => {
    const first = section('first', 'hero', {
        media_source: { backgroundSlot: 'shared.background', primarySlot: 'first.primary' },
    });
    const second = section('second', 'hero', {
        media_source: { backgroundSlot: 'shared.background', primarySlot: 'second.primary' },
    });

    const pointersToClear = mediaPointersToClearWhenRemoving(first, [second], [first, second]);

    assert.deepEqual(Array.from(pointersToClear.entries()), [
        ['first.primary', { kind: 'single' }],
    ]);
});

test('buildSectionSavePayload sorts and publishes without dropping source pointers', () => {
    const sections = [
        section('first', 'hero', {
            sort: 90,
            anchor: 'top',
            content_source: { titleKey: 'x', ctaPrimary: { labelKey: 'custom.label' } },
            media_source: { backgroundSlot: 'y' },
        }),
        section('second', 'richText', { sort: 0, meta: { version: 1, kind: 'richText', owner: { type: 'page', key: 'home' } } }),
    ];

    const payload = buildSectionSavePayload(sections);

    assert.deepEqual(payload.map((item) => [item.id, item.sort, item.status]), [
        ['first', 0, 'published'],
        ['second', 10, 'published'],
    ]);
    assert.equal(payload[0].anchor, 'top');
    const contentSource = objectValue(payload[0].content_source);
    const mediaSource = objectValue(payload[0].media_source);
    assert.equal(contentSource.titleKey, 'x');
    assert.equal(contentSource.subtitleKey, 'section.first.subtitle');
    assert.deepEqual(contentSource.ctaPrimary, { labelKey: 'custom.label', hrefKey: 'section.first.cta.primary.href' });
    assert.equal(mediaSource.backgroundSlot, 'y');
    assert.equal(mediaSource.primarySlot, 'section.first.primary');
    assert.equal(mediaSource.carouselSlot, 'section.first.carousel');
    assert.deepEqual(payload[1].meta, sections[1].meta);
});

test('hasUnsavedComposerChanges detects edits and treats equal drafts as clean', () => {
    const originalSections = [section('hero')];
    const originalContent = { 'section.hero.title': { en: 'Welcome', es: 'Bienvenidos' } };
    const originalMedia = { 'section.hero.bg': [{ id: 'asset-1' }] };

    assert.equal(hasUnsavedComposerChanges(originalSections, originalSections, originalContent, originalContent, originalMedia, originalMedia), false);
    assert.equal(hasUnsavedComposerChanges(originalSections, [section('hero'), section('text', 'richText')], originalContent, originalContent, originalMedia, originalMedia), true);
    assert.equal(hasUnsavedComposerChanges(originalSections, originalSections, originalContent, { ...originalContent, 'section.hero.title': { en: 'New', es: 'Bienvenidos' } }, originalMedia, originalMedia), true);
});
