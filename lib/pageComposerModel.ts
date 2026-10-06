import type { Json } from './database.types';

export type ComposerSectionKind = 'hero' | 'richText' | 'media' | 'card_group';

export type ComposerSection = {
    id: string;
    page_key: string;
    kind: ComposerSectionKind;
    sort: number;
    status: string;
    anchor: string | null;
    meta: Json;
    content_source: Json;
    media_source: Json;
    [key: string]: unknown;
};

export type ComposerCmsValue = { en: string; es: string };
export type ComposerContentMap = Record<string, ComposerCmsValue>;
export type ComposerMediaValue = { id?: string; url?: string; bucket?: string | null; path?: string | null; title?: string };
export type ComposerMediaMap = Record<string, ComposerMediaValue[]>;

export type ClonedComposerSection = {
    section: ComposerSection;
    cmsKeyMap: Record<string, string>;
    slotKeyMap: Record<string, string>;
};

export type ComposerSectionKeys = {
    titleKey: string;
    subtitleKey: string;
    bodyKey: string;
    primaryLabelKey: string;
    primaryHrefKey: string;
    secondaryLabelKey: string;
    secondaryHrefKey: string;
    backgroundSlot: string;
    primarySlot: string;
    carouselSlot: string;
};

export type ComposerMediaDescriptor = { kind: 'single' | 'carousel' };

export type ComposerMetaError = { sectionId: string; message: string };

type JsonObject = Record<string, Json>;

function objectValue(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function nestedObject(value: unknown, key: string): Record<string, unknown> {
    return objectValue(objectValue(value)[key]);
}

function keyValue(value: unknown, fallback: string): string {
    const key = typeof value === 'string' ? value.trim() : '';
    return key || fallback;
}

function sectionPrefix(sectionId: string): string {
    return `section.${sectionId}.`;
}

export function moveSectionToIndex<T extends { id: string }>(sections: readonly T[], sectionId: string, targetIndex: number): T[] {
    const sourceIndex = sections.findIndex((section) => section.id === sectionId);
    if (sourceIndex < 0 || sections.length < 2) return [...sections];

    const next = [...sections];
    const [moving] = next.splice(sourceIndex, 1);
    const insertionIndex = Math.max(0, Math.min(next.length, Math.floor(targetIndex)));
    next.splice(insertionIndex, 0, moving);
    return next;
}

export function reindexComposerSections(sections: readonly ComposerSection[]): ComposerSection[] {
    return sections.map((section, index) => ({ ...section, sort: index * 10 }));
}

export function findComposerMetaError(
    sections: readonly Pick<ComposerSection, 'id'>[],
    errors: Readonly<Record<string, string>>
): ComposerMetaError | null {
    for (const section of sections) {
        const message = errors[section.id];
        if (message) return { sectionId: section.id, message };
    }
    return null;
}

export function defaultSectionSources(kind: ComposerSectionKind, sectionId: string): { content_source: JsonObject; media_source: JsonObject } {
    const prefix = sectionPrefix(sectionId);
    const content_source: JsonObject = {};
    const media_source: JsonObject = {};

    if (kind !== 'card_group') {
        content_source.titleKey = `${prefix}title`;
        content_source.subtitleKey = `${prefix}subtitle`;
        content_source.bodyKey = `${prefix}body`;
        content_source.ctaPrimary = {
            labelKey: `${prefix}cta.primary.label`,
            hrefKey: `${prefix}cta.primary.href`,
        };
        content_source.ctaSecondary = {
            labelKey: `${prefix}cta.secondary.label`,
            hrefKey: `${prefix}cta.secondary.href`,
        };
    }

    if (kind === 'hero' || kind === 'media') {
        media_source.backgroundSlot = `${prefix}bg`;
        media_source.primarySlot = `${prefix}primary`;
        media_source.carouselSlot = `${prefix}carousel`;
    }

    return { content_source, media_source };
}

export function createComposerSection(
    pageKey: string,
    kind: ComposerSectionKind,
    id: string,
    sort: number
): ComposerSection {
    const sources = defaultSectionSources(kind, id);
    const meta: JsonObject = {
        version: 1,
        kind,
        owner: { type: 'page', key: pageKey },
        sort,
    };
    if (kind === 'card_group') {
        meta.variant = 'default';
        sources.content_source.sourceKey = 'home.cards.lessons';
    }

    return {
        id,
        page_key: pageKey,
        kind,
        sort,
        status: 'draft',
        anchor: null,
        meta,
        content_source: sources.content_source,
        media_source: sources.media_source,
    };
}

export function getComposerSectionKeys(section: ComposerSection): ComposerSectionKeys {
    const content = objectValue(section.content_source);
    const media = objectValue(section.media_source);
    const primary = nestedObject(content, 'ctaPrimary');
    const secondary = nestedObject(content, 'ctaSecondary');
    const prefix = sectionPrefix(section.id);
    const supportsContent = section.kind !== 'card_group';
    const isHero = section.kind === 'hero';
    const supportsMedia = section.kind === 'hero' || section.kind === 'media';

    return {
        titleKey: supportsContent ? keyValue(content.titleKey, `${prefix}title`) : '',
        subtitleKey: supportsContent ? keyValue(content.subtitleKey, `${prefix}subtitle`) : '',
        bodyKey: supportsContent ? keyValue(content.bodyKey, `${prefix}body`) : '',
        primaryLabelKey: isHero ? keyValue(primary.labelKey, `${prefix}cta.primary.label`) : '',
        primaryHrefKey: isHero ? keyValue(primary.hrefKey, `${prefix}cta.primary.href`) : '',
        secondaryLabelKey: isHero ? keyValue(secondary.labelKey, `${prefix}cta.secondary.label`) : '',
        secondaryHrefKey: isHero ? keyValue(secondary.hrefKey, `${prefix}cta.secondary.href`) : '',
        backgroundSlot: supportsMedia ? keyValue(media.backgroundSlot, `${prefix}bg`) : '',
        primarySlot: supportsMedia ? keyValue(media.primarySlot, `${prefix}primary`) : '',
        carouselSlot: supportsMedia && section.kind === 'media' ? keyValue(media.carouselSlot, `${prefix}carousel`) : '',
    };
}

export function composerMediaDescriptors(sections: readonly ComposerSection[]): Map<string, ComposerMediaDescriptor> {
    const descriptors = new Map<string, ComposerMediaDescriptor>();
    for (const section of sections) {
        const keys = getComposerSectionKeys(section);
        if (keys.backgroundSlot) descriptors.set(keys.backgroundSlot, { kind: 'single' });
        if (keys.primarySlot) descriptors.set(keys.primarySlot, { kind: 'single' });
        if (keys.carouselSlot) descriptors.set(keys.carouselSlot, { kind: 'carousel' });
    }
    return descriptors;
}

export function mediaPointersToClearWhenRemoving(
    section: ComposerSection,
    remainingSections: readonly ComposerSection[],
    persistedSections: readonly ComposerSection[]
): Map<string, ComposerMediaDescriptor> {
    const sectionDescriptors = composerMediaDescriptors([section]);
    const remainingDescriptors = composerMediaDescriptors(remainingSections);
    const persistedDescriptors = composerMediaDescriptors(persistedSections);
    const clearable = new Map<string, ComposerMediaDescriptor>();
    sectionDescriptors.forEach((descriptor, prefix) => {
        if (persistedDescriptors.has(prefix) && !remainingDescriptors.has(prefix)) clearable.set(prefix, descriptor);
    });
    return clearable;
}

function makeCmsKeyMap(section: ComposerSection, newId: string): Record<string, string> {
    if (section.kind === 'card_group') return {};
    const content = objectValue(section.content_source);
    const primary = nestedObject(content, 'ctaPrimary');
    const secondary = nestedObject(content, 'ctaSecondary');
    const prefix = sectionPrefix(newId);
    const fields: Array<[string, string]> = [
        [keyValue(content.titleKey, `${sectionPrefix(section.id)}title`), `${prefix}title`],
        [keyValue(content.subtitleKey, `${sectionPrefix(section.id)}subtitle`), `${prefix}subtitle`],
        [keyValue(content.bodyKey, `${sectionPrefix(section.id)}body`), `${prefix}body`],
        [keyValue(primary.labelKey, `${sectionPrefix(section.id)}cta.primary.label`), `${prefix}cta.primary.label`],
        [keyValue(primary.hrefKey, `${sectionPrefix(section.id)}cta.primary.href`), `${prefix}cta.primary.href`],
        [keyValue(secondary.labelKey, `${sectionPrefix(section.id)}cta.secondary.label`), `${prefix}cta.secondary.label`],
        [keyValue(secondary.hrefKey, `${sectionPrefix(section.id)}cta.secondary.href`), `${prefix}cta.secondary.href`],
    ];
    return Object.fromEntries(fields);
}

function makeSlotKeyMap(section: ComposerSection, newId: string): Record<string, string> {
    if (section.kind !== 'hero' && section.kind !== 'media') return {};
    const media = objectValue(section.media_source);
    const prefix = sectionPrefix(newId);
    return {
        [keyValue(media.backgroundSlot, `${sectionPrefix(section.id)}bg`)]: `${prefix}bg`,
        [keyValue(media.primarySlot, `${sectionPrefix(section.id)}primary`)]: `${prefix}primary`,
        [keyValue(media.carouselSlot, `${sectionPrefix(section.id)}carousel`)]: `${prefix}carousel`,
    };
}

function withRemappedPointers(section: ComposerSection, newId: string, sort: number, cmsKeyMap: Record<string, string>, slotKeyMap: Record<string, string>): ComposerSection {
    const content = objectValue(section.content_source);
    const primary = nestedObject(content, 'ctaPrimary');
    const secondary = nestedObject(content, 'ctaSecondary');
    const media = objectValue(section.media_source);
    const sources = defaultSectionSources(section.kind, newId);
    const defaultContent = objectValue(sources.content_source);
    const defaultMedia = objectValue(sources.media_source);

    const remapped = (key: unknown, map: Record<string, string>, fallback: string): string => {
        const original = keyValue(key, fallback);
        return map[original] || original;
    };

    let content_source: Json = sources.content_source;
    let media_source: Json = sources.media_source;
    if (section.kind !== 'card_group') {
        content_source = {
            ...content,
            ...defaultContent,
            titleKey: remapped(content.titleKey, cmsKeyMap, `${sectionPrefix(newId)}title`),
            subtitleKey: remapped(content.subtitleKey, cmsKeyMap, `${sectionPrefix(newId)}subtitle`),
            bodyKey: remapped(content.bodyKey, cmsKeyMap, `${sectionPrefix(newId)}body`),
            ctaPrimary: {
                ...nestedObject(defaultContent, 'ctaPrimary'),
                ...primary,
                labelKey: remapped(primary.labelKey, cmsKeyMap, `${sectionPrefix(newId)}cta.primary.label`),
                hrefKey: remapped(primary.hrefKey, cmsKeyMap, `${sectionPrefix(newId)}cta.primary.href`),
            },
            ctaSecondary: {
                ...nestedObject(defaultContent, 'ctaSecondary'),
                ...secondary,
                labelKey: remapped(secondary.labelKey, cmsKeyMap, `${sectionPrefix(newId)}cta.secondary.label`),
                hrefKey: remapped(secondary.hrefKey, cmsKeyMap, `${sectionPrefix(newId)}cta.secondary.href`),
            },
        } as Json;
    }
    if (section.kind === 'hero' || section.kind === 'media') {
        media_source = {
            ...media,
            ...defaultMedia,
            backgroundSlot: remapped(media.backgroundSlot, slotKeyMap, `${sectionPrefix(newId)}bg`),
            primarySlot: remapped(media.primarySlot, slotKeyMap, `${sectionPrefix(newId)}primary`),
            carouselSlot: remapped(media.carouselSlot, slotKeyMap, `${sectionPrefix(newId)}carousel`),
        } as Json;
    }

    return { ...section, id: newId, sort, status: 'draft', content_source, media_source };
}

export function cloneComposerSection(section: ComposerSection, newId: string, sort: number): ClonedComposerSection {
    const cmsKeyMap = makeCmsKeyMap(section, newId);
    const slotKeyMap = makeSlotKeyMap(section, newId);
    return {
        section: withRemappedPointers(section, newId, sort, cmsKeyMap, slotKeyMap),
        cmsKeyMap,
        slotKeyMap,
    };
}

export function copyComposerDraftValues(
    cmsKeyMap: Record<string, string>,
    slotKeyMap: Record<string, string>,
    content: ComposerContentMap,
    media: ComposerMediaMap
): { content: ComposerContentMap; media: ComposerMediaMap } {
    const nextContent = { ...content };
    const nextMedia = { ...media };

    for (const [sourceKey, duplicateKey] of Object.entries(cmsKeyMap)) {
        if (Object.prototype.hasOwnProperty.call(content, sourceKey)) {
            nextContent[duplicateKey] = { ...content[sourceKey] };
        }
    }
    for (const [sourceKey, duplicateKey] of Object.entries(slotKeyMap)) {
        if (Object.prototype.hasOwnProperty.call(media, sourceKey)) {
            nextMedia[duplicateKey] = media[sourceKey].map((item) => ({ ...item }));
        }
    }

    return { content: nextContent, media: nextMedia };
}

export function buildSectionSavePayload(sections: readonly ComposerSection[]): Array<Record<string, unknown>> {
    return sections.map((section, index) => {
        const defaults = defaultSectionSources(section.kind, section.id);
        const existingContent = objectValue(section.content_source);
        const existingMedia = objectValue(section.media_source);
        const defaultContent = objectValue(defaults.content_source);
        const defaultMedia = objectValue(defaults.media_source);
        const content_source = section.kind === 'card_group'
            ? existingContent as Json
            : {
                ...defaultContent,
                ...existingContent,
                ctaPrimary: { ...objectValue(defaultContent.ctaPrimary), ...objectValue(existingContent.ctaPrimary) },
                ctaSecondary: { ...objectValue(defaultContent.ctaSecondary), ...objectValue(existingContent.ctaSecondary) },
            } as Json;
        const media_source = (section.kind === 'hero' || section.kind === 'media')
            ? { ...defaultMedia, ...existingMedia } as Json
            : existingMedia as Json;

        return {
            id: section.id,
            kind: section.kind,
            sort: index * 10,
            status: 'published',
            anchor: section.anchor,
            meta: section.meta,
            content_source,
            media_source,
        };
    });
}

function stableJson(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
    if (value && typeof value === 'object') {
        const object = value as Record<string, unknown>;
        return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`).join(',')}}`;
    }
    return JSON.stringify(value) ?? 'undefined';
}

export function hasUnsavedComposerChanges(
    originalSections: unknown,
    draftSections: unknown,
    originalContent: unknown,
    draftContent: unknown,
    originalMedia: unknown,
    draftMedia: unknown
): boolean {
    return [
        [originalSections, draftSections],
        [originalContent, draftContent],
        [originalMedia, draftMedia],
    ].some(([original, draft]) => stableJson(original) !== stableJson(draft));
}

