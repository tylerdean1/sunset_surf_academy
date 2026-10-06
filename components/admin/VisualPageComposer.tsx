'use client';

import * as React from 'react';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Collapse,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControl,
    FormControlLabel,
    IconButton,
    InputLabel,
    Menu,
    MenuItem,
    Paper,
    Radio,
    RadioGroup,
    Select,
    Stack,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import SaveIcon from '@mui/icons-material/Save';
import UndoIcon from '@mui/icons-material/Undo';
import { useLocale } from 'next-intl';
import MediaPickerDialog, { type MediaSelection } from '@/components/admin/MediaPickerDialog';
import { RichTextEditor } from '@/components/admin/RichText';
import { PagePreviewRendererInner, type StagedContentMap, type StagedMediaMap } from '@/components/sections/PagePreviewRenderer';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { rpc } from '@/lib/rpc';
import { invalidateContentCache } from '@/lib/contentCache';
import { getAdminMediaSignedUrl } from '@/lib/adminMediaClient';
import type { Database, Json } from '@/lib/database.types';
import type { AdminPageKey } from '@/components/admin/adminPages';
import {
    buildSectionSavePayload,
    composerMediaDescriptors,
    cloneComposerSection,
    copyComposerDraftValues,
    createComposerSection,
    findComposerMetaError,
    getComposerSectionKeys,
    hasUnsavedComposerChanges,
    mediaPointersToClearWhenRemoving,
    moveSectionToIndex,
    reindexComposerSections,
    type ComposerContentMap,
    type ComposerMediaMap,
    type ComposerMediaDescriptor,
    type ComposerSection,
    type ComposerSectionKind,
} from '@/lib/pageComposerModel';

type PageSectionRow = Database['public']['Functions']['rpc_get_page_sections']['Returns'][number];
type SlotKind = ComposerMediaDescriptor['kind'];
type MediaDescriptor = ComposerMediaDescriptor;
type PickerTarget = { prefix: string; index: number; kind: SlotKind };
type DraftSnapshot = {
    sections: ComposerSection[];
    content: ComposerContentMap;
    media: ComposerMediaMap;
    selectedId: string;
    deletedMedia: Array<[string, MediaDescriptor]>;
};

const SECTION_LABELS: Record<ComposerSectionKind, string> = {
    hero: 'Hero banner',
    richText: 'Text section',
    media: 'Photo or video section',
    card_group: 'Card group',
};

const CARD_GROUP_SOURCES = [
    { value: 'home.cards.lessons', label: 'Lessons cards' },
    { value: 'home.cards.gallery', label: 'Gallery cards' },
    { value: 'home.cards.team', label: 'Team cards' },
] as const;

function asObject(value: unknown): Record<string, any> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
}

function isAuthErrorMessage(message: string) {
    const value = String(message || '').toLowerCase();
    return ['not authorized', 'not allowed', 'permission denied', 'jwt', 'invalid claim', 'unauthorized'].some((part) => value.includes(part));
}

function stableString(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map(stableString).join(',')}]`;
    if (value && typeof value === 'object') {
        const object = value as Record<string, unknown>;
        return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableString(object[key])}`).join(',')}}`;
    }
    return JSON.stringify(value) ?? 'undefined';
}

function cmsKeysFor(sections: readonly ComposerSection[]): string[] {
    return Array.from(new Set(sections.flatMap((section) => {
        const keys = getComposerSectionKeys(section);
        if (section.kind === 'hero') return [keys.titleKey, keys.subtitleKey, keys.primaryLabelKey, keys.primaryHrefKey, keys.secondaryLabelKey, keys.secondaryHrefKey];
        if (section.kind === 'richText') return [keys.bodyKey];
        if (section.kind === 'media') return [keys.titleKey, keys.subtitleKey, keys.bodyKey];
        return [];
    }).filter(Boolean)));
}

function localizedValue(content: ComposerContentMap, key: string, locale: 'en' | 'es'): string {
    return key ? content[key]?.[locale] ?? '' : '';
}

function newSectionId(): string {
    if (typeof globalThis.crypto?.randomUUID !== 'function') {
        throw new Error('This browser cannot safely add a section. Update your browser and try again.');
    }
    return globalThis.crypto.randomUUID();
}

function jsonObject(value: Json): Record<string, Json> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as Record<string, Json>;
}

function pageTitle(pageKey: AdminPageKey): string {
    const titles: Record<AdminPageKey, string> = {
        home: 'Home',
        lessons: 'Lessons',
        book: 'Booking',
        gallery: 'Gallery',
        mission_statement: 'Our mission',
        about_jaz: 'About Jaz',
        team: 'Team',
        faq: 'FAQ',
        contact: 'Contact',
    };
    return titles[pageKey];
}

export default function VisualPageComposer({ pageKey }: { pageKey: AdminPageKey }) {
    const locale = useLocale();
    const [baseSections, setBaseSections] = React.useState<ComposerSection[]>([]);
    const [sections, setSections] = React.useState<ComposerSection[]>([]);
    const [baseContent, setBaseContent] = React.useState<ComposerContentMap>({});
    const [content, setContent] = React.useState<ComposerContentMap>({});
    const [baseMedia, setBaseMedia] = React.useState<ComposerMediaMap>({});
    const [media, setMedia] = React.useState<ComposerMediaMap>({});
    const [deletedMedia, setDeletedMedia] = React.useState<Map<string, MediaDescriptor>>(new Map());
    const [selectedId, setSelectedId] = React.useState('');
    const [localeTab, setLocaleTab] = React.useState<'en' | 'es'>((locale === 'es' ? 'es' : 'en'));
    const [viewport, setViewport] = React.useState<'desktop' | 'tablet' | 'mobile'>('desktop');
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [authError, setAuthError] = React.useState<string | null>(null);
    const [partialSave, setPartialSave] = React.useState<string | null>(null);
    const [liveMessage, setLiveMessage] = React.useState('');
    const [addMenuAnchor, setAddMenuAnchor] = React.useState<HTMLElement | null>(null);
    const [undoSnapshot, setUndoSnapshot] = React.useState<DraftSnapshot | null>(null);
    const [pickerOpen, setPickerOpen] = React.useState(false);
    const [pickerTarget, setPickerTarget] = React.useState<PickerTarget | null>(null);
    const [advancedOpen, setAdvancedOpen] = React.useState(false);
    const [metaTextById, setMetaTextById] = React.useState<Record<string, string>>({});
    const [metaErrors, setMetaErrors] = React.useState<Record<string, string>>({});
    const [discardOpen, setDiscardOpen] = React.useState(false);
    const generation = React.useRef(0);

    const dirty = hasUnsavedComposerChanges(baseSections, sections, baseContent, content, baseMedia, media) || deletedMedia.size > 0;
    const selectedSection = sections.find((section) => section.id === selectedId) || null;
    const keys = selectedSection ? getComposerSectionKeys(selectedSection) : null;
    const selectedMetaText = selectedSection
        ? metaTextById[selectedSection.id] ?? JSON.stringify(selectedSection.meta, null, 2)
        : '';
    const currentMetaError = selectedSection ? metaErrors[selectedSection.id] : '';
    const reloginHref = `/${locale}/adminlogin`;
    const sectionAddOptions: ComposerSectionKind[] = pageKey === 'home' ? ['hero', 'richText', 'media', 'card_group'] : ['hero', 'richText', 'media'];

    const loadPage = React.useCallback(async () => {
        const started = ++generation.current;
        setLoading(true);
        setError(null);
        setAuthError(null);
        setPartialSave(null);
        setLiveMessage('');
        try {
            const supabase = getSupabaseClient();
            if (!supabase) throw new Error('Network connection is unavailable. Refresh and try again.');
            const loaded = await rpc<PageSectionRow[]>(supabase, 'rpc_get_page_sections', { p_page_key: pageKey, p_include_drafts: true });
            const unsupported = (loaded || []).find((row) => !Object.prototype.hasOwnProperty.call(SECTION_LABELS, row.kind));
            if (unsupported) throw new Error(`This page has an unsupported section type (“${unsupported.kind}”). Ask your web support person before changing this page.`);
            const nextSections = [...(loaded || [])]
                .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
                .map((row) => ({ ...row })) as ComposerSection[];

            const cmsKeys = cmsKeysFor(nextSections);
            const slotDescriptors = composerMediaDescriptors(nextSections);
            const [cmsRows, mediaRows] = await Promise.all([
                Promise.all(cmsKeys.map(async (key) => {
                    const rows = await rpc<any[]>(supabase, 'admin_get_cms_page_row', { p_page_key: key });
                    const row = rows?.[0];
                    return [key, { en: String(row?.body_en ?? ''), es: String(row?.body_es_draft ?? '') }] as const;
                })),
                Promise.all(Array.from(slotDescriptors.entries()).map(async ([prefix, descriptor]) => {
                    const rows = await rpc<any[]>(supabase, 'admin_list_media_slots_by_prefix', { p_prefix: prefix });
                    const ordered = [...(rows || [])].sort((a, b) => (Number(a?.sort) || 0) - (Number(b?.sort) || 0));
                    const entries = await Promise.all(ordered.filter((row) => row?.asset_id).map(async (row) => {
                        const bucket = String(row?.asset_bucket || '');
                        const path = String(row?.asset_path || '');
                        let url = '';
                        if (bucket && path) {
                            try { url = await getAdminMediaSignedUrl(bucket, path); } catch { url = ''; }
                        }
                        return {
                            id: String(row.asset_id),
                            url,
                            bucket: bucket || null,
                            path: path || null,
                            title: String(row?.asset_title || ''),
                            slot_key: String(row?.slot_key || ''),
                        };
                    }));
                    return [prefix, descriptor.kind === 'single' ? entries.slice(0, 1) : entries] as const;
                })),
            ]);
            if (started !== generation.current) return;

            const nextContent = Object.fromEntries(cmsRows) as ComposerContentMap;
            const nextMedia = Object.fromEntries(mediaRows) as ComposerMediaMap;
            setBaseSections(nextSections);
            setSections(nextSections);
            setBaseContent(nextContent);
            setContent(nextContent);
            setBaseMedia(nextMedia);
            setMedia(nextMedia);
            setDeletedMedia(new Map());
            setSelectedId((current) => nextSections.some((section) => section.id === current) ? current : nextSections[0]?.id || '');
            setUndoSnapshot(null);
            setMetaTextById({});
            setMetaErrors({});
        } catch (cause: any) {
            if (started !== generation.current) return;
            const message = cause?.message || 'The page could not be loaded. Refresh and try again.';
            if (isAuthErrorMessage(message)) setAuthError(message);
            else setError(message);
        } finally {
            if (started === generation.current) setLoading(false);
        }
    }, [pageKey]);

    React.useEffect(() => {
        let active = true;
        void Promise.resolve().then(() => {
            if (active) void loadPage();
        });
        return () => {
            active = false;
            generation.current += 1;
        };
    }, [loadPage]);

    const snapshot = React.useCallback((): DraftSnapshot => ({
        sections,
        content,
        media,
        selectedId,
        deletedMedia: Array.from(deletedMedia.entries()),
    }), [sections, content, media, selectedId, deletedMedia]);

    const saveSnapshot = React.useCallback(() => {
        setUndoSnapshot(snapshot());
    }, [snapshot]);

    const updateSection = (id: string, update: (section: ComposerSection) => ComposerSection) => {
        setSections((current) => current.map((section) => section.id === id ? update(section) : section));
        setPartialSave(null);
    };

    const updateCms = (key: string, localeKey: 'en' | 'es', value: string) => {
        setContent((current) => ({
            ...current,
            [key]: { en: current[key]?.en ?? '', es: current[key]?.es ?? '', [localeKey]: value },
        }));
        setPartialSave(null);
    };

    const updateMedia = (prefix: string, nextItems: ComposerMediaMap[string]) => {
        setMedia((current) => ({ ...current, [prefix]: nextItems }));
        setDeletedMedia((current) => {
            if (!current.has(prefix)) return current;
            const next = new Map(current);
            next.delete(prefix);
            return next;
        });
        setPartialSave(null);
    };

    const applyStructureChange = (message: string, nextSections: ComposerSection[], selected = selectedId, nextContent = content, nextMedia = media) => {
        setSections(reindexComposerSections(nextSections));
        setContent(nextContent);
        setMedia(nextMedia);
        setSelectedId(selected);
        setPartialSave(null);
        setLiveMessage(message);
    };

    const addSection = (kind: ComposerSectionKind) => {
        let id = '';
        try { id = newSectionId(); } catch (cause: any) {
            setError(cause?.message || 'This browser cannot add a section.');
            return;
        }
        saveSnapshot();
        const section = createComposerSection(pageKey, kind, id, sections.length * 10);
        applyStructureChange(`${SECTION_LABELS[kind]} added.`, [...sections, section], id);
        setAddMenuAnchor(null);
    };

    const duplicateSection = (section: ComposerSection) => {
        let id = '';
        try { id = newSectionId(); } catch (cause: any) {
            setError(cause?.message || 'This browser cannot duplicate a section.');
            return;
        }
        const cloned = cloneComposerSection(section, id, sections.length * 10);
        const copied = copyComposerDraftValues(cloned.cmsKeyMap, cloned.slotKeyMap, content, media);
        saveSnapshot();
        const index = sections.findIndex((item) => item.id === section.id);
        const nextSections = [...sections];
        nextSections.splice(index + 1, 0, cloned.section);
        applyStructureChange(`${SECTION_LABELS[section.kind]} duplicated.`, nextSections, id, copied.content, copied.media);
    };

    const deleteSection = (section: ComposerSection) => {
        saveSnapshot();
        const nextSections = sections.filter((item) => item.id !== section.id);
        const sectionDescriptors = composerMediaDescriptors([section]);
        const remainingDescriptors = composerMediaDescriptors(nextSections);
        const clearableMedia = mediaPointersToClearWhenRemoving(section, nextSections, baseSections);
        const nextDeletedMedia = new Map(deletedMedia);
        sectionDescriptors.forEach((descriptor, prefix) => {
            if (clearableMedia.has(prefix)) nextDeletedMedia.set(prefix, descriptor);
            else nextDeletedMedia.delete(prefix);
        });
        setDeletedMedia(nextDeletedMedia);

        const keysStillUsed = new Set(cmsKeysFor(nextSections));
        const nextContent = { ...content };
        for (const key of cmsKeysFor([section])) {
            if (keysStillUsed.has(key)) continue;
            if (Object.prototype.hasOwnProperty.call(baseContent, key)) nextContent[key] = baseContent[key];
            else delete nextContent[key];
        }
        const nextMedia = { ...media };
        sectionDescriptors.forEach((_descriptor, prefix) => {
            if (!remainingDescriptors.has(prefix)) delete nextMedia[prefix];
        });
        applyStructureChange(`${SECTION_LABELS[section.kind]} removed. Save changes to update the page.`, nextSections, nextSections[0]?.id || '', nextContent, nextMedia);
    };

    const reorderSection = (sectionId: string, targetIndex: number) => {
        const nextSections = moveSectionToIndex(sections, sectionId, targetIndex);
        if (nextSections.every((section, index) => section.id === sections[index]?.id)) return;
        saveSnapshot();
        applyStructureChange('Section order changed.', nextSections, sectionId);
    };

    const undoStructureChange = () => {
        if (!undoSnapshot) return;
        setSections(undoSnapshot.sections);
        setContent(undoSnapshot.content);
        setMedia(undoSnapshot.media);
        setSelectedId(undoSnapshot.selectedId);
        setDeletedMedia(new Map(undoSnapshot.deletedMedia));
        setUndoSnapshot(null);
        setLiveMessage('Last section change undone.');
        setPartialSave(null);
    };

    const setMetaText = (section: ComposerSection, raw: string) => {
        setMetaTextById((current) => ({ ...current, [section.id]: raw }));
        try {
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Use a JSON object for section settings.');
            updateSection(section.id, (current) => ({ ...current, meta: parsed as Json }));
            setMetaErrors((current) => ({ ...current, [section.id]: '' }));
        } catch (cause: any) {
            const message = cause?.message === 'Use a JSON object for section settings.' ? cause.message : 'Check the JSON format before saving.';
            setMetaErrors((current) => ({ ...current, [section.id]: message }));
        }
    };

    const openPicker = (prefix: string, index: number, kind: SlotKind) => {
        setPickerTarget({ prefix, index, kind });
        setPickerOpen(true);
    };

    const onMediaSelected = async (selection: MediaSelection) => {
        const started = generation.current;
        const target = pickerTarget;
        setPickerOpen(false);
        setPickerTarget(null);
        if (!target) return;
        let url = selection.previewUrl;
        if (!url && selection.bucket && selection.path) {
            try { url = await getAdminMediaSignedUrl(selection.bucket, selection.path); } catch { url = ''; }
        }
        if (started !== generation.current) return;
        const current = [...(media[target.prefix] || [])];
        const item = { id: selection.id, url, bucket: selection.bucket, path: selection.path };
        if (target.kind === 'single') current[0] = item;
        else if (target.index >= current.length) current.push(item);
        else current[target.index] = item;
        updateMedia(target.prefix, current.filter(Boolean));
    };

    const clearMedia = (prefix: string, index: number, kind: SlotKind) => {
        const current = [...(media[prefix] || [])];
        if (kind === 'single') current.length = 0;
        else current.splice(index, 1);
        updateMedia(prefix, current);
    };

    const moveCarouselItem = (prefix: string, index: number, direction: -1 | 1) => {
        const current = [...(media[prefix] || [])];
        const nextIndex = index + direction;
        if (nextIndex < 0 || nextIndex >= current.length) return;
        [current[index], current[nextIndex]] = [current[nextIndex], current[index]];
        updateMedia(prefix, current);
    };

    const saveAll = async () => {
        const invalidMeta = findComposerMetaError(sections, metaErrors);
        if (invalidMeta) {
            setError('Fix the section settings marked in Advanced settings before saving.');
            setSelectedId(invalidMeta.sectionId);
            setAdvancedOpen(true);
            return;
        }
        const started = generation.current;
        setSaving(true);
        setError(null);
        setAuthError(null);
        setPartialSave(null);
        try {
            const supabase = getSupabaseClient();
            if (!supabase) throw new Error('Network connection is unavailable. Refresh and try again.');
            const hasSectionChanges = hasUnsavedComposerChanges(baseSections, sections, {}, {}, {}, {});
            const contentEntries = Object.keys({ ...baseContent, ...content }).flatMap((key) => {
                const original = baseContent[key] || { en: '', es: '' };
                const draft = content[key] || { en: '', es: '' };
                return (['en', 'es'] as const)
                    .filter((localeKey) => original[localeKey] !== draft[localeKey])
                    .map((localeKey) => ({ key, locale: localeKey, body: draft[localeKey] ?? '' }));
            });
            const descriptors = new Map<string, MediaDescriptor>();
            [composerMediaDescriptors(baseSections), composerMediaDescriptors(sections), deletedMedia].forEach((source) => {
                source.forEach((descriptor, prefix) => descriptors.set(prefix, descriptor));
            });
            const mediaEntries = Array.from(descriptors.entries()).flatMap(([prefix, descriptor]) => {
                const original = baseMedia[prefix] || [];
                const draft = media[prefix] || [];
                const explicitlyDeleted = deletedMedia.has(prefix);
                if (!explicitlyDeleted && stableString(original) === stableString(draft)) return [];
                const slots = explicitlyDeleted ? [] : draft.map((asset, index) => ({
                    slot_key: descriptor.kind === 'carousel' ? `${prefix}.${index}` : prefix,
                    asset_id: asset.id ?? null,
                    sort: index,
                }));
                return [{ prefix, slots }];
            });
            const hasContentChanges = contentEntries.length > 0 || mediaEntries.length > 0;
            if (!hasSectionChanges && !hasContentChanges) {
                setSaving(false);
                return;
            }

            let sectionsSaved = false;
            if (hasSectionChanges) {
                await rpc<void>(supabase, 'rpc_upsert_page_sections', {
                    p_page_key: pageKey,
                    p_sections: buildSectionSavePayload(sections),
                    p_prune_missing: true,
                });
                invalidateContentCache();
                sectionsSaved = true;
            }
            if (started !== generation.current) return;
            if (hasContentChanges) {
                try {
                    await rpc<void>(supabase, 'admin_save_content_bundle', {
                        p_strings: contentEntries,
                        p_media: mediaEntries,
                    });
                } catch (cause: any) {
                    if (sectionsSaved) {
                        const message = cause?.message || 'Text and media could not be saved.';
                        setPartialSave(`The page layout saved, but some text or media did not. Your edits are still here. Choose Save changes to retry. ${message}`);
                        setError(null);
                        return;
                    }
                    throw cause;
                }
            }
            if (started !== generation.current) return;
            await loadPage();
            setSaving(false);
            setLiveMessage('All page changes have been saved.');
        } catch (cause: any) {
            if (started !== generation.current) return;
            const message = cause?.message || 'Changes could not be saved. Your edits are still here; try again.';
            if (isAuthErrorMessage(message)) setAuthError(message);
            else setError(message);
        } finally {
            if (started === generation.current) setSaving(false);
        }
    };

    const requestDiscard = () => setDiscardOpen(true);
    const discardChanges = () => {
        setDiscardOpen(false);
        void loadPage();
    };

    const contentPreview = React.useMemo(() => {
        const result: StagedContentMap = {};
        for (const [key, value] of Object.entries(content)) result[key] = { en: value.en || '', es: value.es || '' };
        return result;
    }, [content]);
    const mediaPreview = React.useMemo(() => {
        const result: StagedMediaMap = {};
        for (const [key, items] of Object.entries(media)) {
            result[key] = items.map((item) => ({ url: item.url || '', bucket: item.bucket || null, path: item.path || null }));
        }
        return result;
    }, [media]);

    const renderCmsField = (label: string, key: string, options: { multiline?: boolean; rows?: number } = {}) => (
        <TextField
            fullWidth
            label={label}
            value={localizedValue(content, key, localeTab)}
            onChange={(event) => updateCms(key, localeTab, event.target.value)}
            multiline={options.multiline}
            minRows={options.rows}
            size="small"
        />
    );

    const renderMediaControl = (label: string, prefix: string, kind: SlotKind) => {
        const items = media[prefix] || [];
        return (
            <Box key={prefix} sx={{ display: 'grid', gap: 1, p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                <Typography variant="subtitle2">{label}</Typography>
                {items.map((item, index) => (
                    <Box key={`${item.id || prefix}-${index}`} sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                        {item.url ? (
                            <Box component="img" src={item.url} alt="" sx={{ width: 64, height: 48, objectFit: 'cover', borderRadius: 1 }} />
                        ) : (
                            <Box sx={{ width: 64, height: 48, bgcolor: 'action.hover', borderRadius: 1 }} />
                        )}
                        <Typography variant="body2" sx={{ flex: 1, overflowWrap: 'anywhere' }}>
                            {item.title || item.path || 'Selected media'}
                        </Typography>
                        {kind === 'carousel' ? (
                            <>
                                <IconButton aria-label={`Move ${label} item up`} size="small" onClick={() => moveCarouselItem(prefix, index, -1)} disabled={index === 0}>
                                    <ArrowUpwardIcon fontSize="small" />
                                </IconButton>
                                <IconButton aria-label={`Move ${label} item down`} size="small" onClick={() => moveCarouselItem(prefix, index, 1)} disabled={index === items.length - 1}>
                                    <ArrowDownwardIcon fontSize="small" />
                                </IconButton>
                            </>
                        ) : null}
                        <IconButton aria-label={`Remove ${label} item`} size="small" color="error" onClick={() => clearMedia(prefix, index, kind)}>
                            <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                    </Box>
                ))}
                <Button
                    size="small"
                    variant="outlined"
                    startIcon={<AddIcon />}
                    onClick={() => openPicker(prefix, kind === 'single' ? 0 : items.length, kind)}
                    sx={{ justifySelf: 'start' }}
                >
                    {kind === 'single' ? (items.length ? 'Change image or video' : 'Choose image or video') : 'Add image or video'}
                </Button>
            </Box>
        );
    };

    const renderInspector = (section: ComposerSection | null) => {
        if (!section) {
            return (
                <Box sx={{ p: 2 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>Edit this section</Typography>
                    <Typography color="text.secondary" variant="body2">Choose a section from the outline or click one in the preview.</Typography>
                </Box>
            );
        }
        const sectionKeys = getComposerSectionKeys(section);
        const source = jsonObject(section.content_source);
        const primarySlot = sectionKeys.primarySlot;
        const backgroundSlot = sectionKeys.backgroundSlot;
        const carouselSlot = sectionKeys.carouselSlot;

        return (
            <Box sx={{ p: 2, display: 'grid', gap: 1.75 }}>
                <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{SECTION_LABELS[section.kind]}</Typography>
                    <Typography variant="body2" color="text.secondary">Changes appear in the preview as you edit.</Typography>
                </Box>
                <Divider />

                {section.kind === 'hero' ? (
                    <>
                        {renderCmsField('Headline', sectionKeys.titleKey)}
                        {renderCmsField('Short description', sectionKeys.subtitleKey, { multiline: true, rows: 3 })}
                        <Typography variant="subtitle2" sx={{ mt: 0.5 }}>Main button</Typography>
                        {renderCmsField('Button text', sectionKeys.primaryLabelKey)}
                        {renderCmsField('Button link', sectionKeys.primaryHrefKey)}
                        <Typography variant="subtitle2" sx={{ mt: 0.5 }}>Second button</Typography>
                        {renderCmsField('Button text', sectionKeys.secondaryLabelKey)}
                        {renderCmsField('Button link', sectionKeys.secondaryHrefKey)}
                        {backgroundSlot ? renderMediaControl('Hero background', backgroundSlot, 'single') : null}
                    </>
                ) : null}

                {section.kind === 'richText' ? (
                    <RichTextEditor
                        label={localeTab === 'en' ? 'Page text (English)' : 'Page text (Spanish draft)'}
                        value={localizedValue(content, sectionKeys.bodyKey, localeTab)}
                        onChange={(value) => updateCms(sectionKeys.bodyKey, localeTab, value)}
                    />
                ) : null}

                {section.kind === 'media' ? (
                    <>
                        {primarySlot ? renderMediaControl('Main image or video', primarySlot, 'single') : null}
                        {carouselSlot ? renderMediaControl('Photo carousel', carouselSlot, 'carousel') : null}
                        <Typography variant="caption" color="text.secondary">Add, remove, or reorder media items here.</Typography>
                    </>
                ) : null}

                {section.kind === 'card_group' ? (
                    <FormControl size="small" fullWidth>
                        <InputLabel id={`card-source-${section.id}`}>Cards to show</InputLabel>
                        <Select
                            labelId={`card-source-${section.id}`}
                            label="Cards to show"
                            value={String(source.sourceKey || asObject(source.fields).sourceKey || 'home.cards.lessons')}
                            onChange={(event) => updateSection(section.id, (current) => ({
                                ...current,
                                content_source: { ...jsonObject(current.content_source), sourceKey: event.target.value } as Json,
                            }))}
                        >
                            {CARD_GROUP_SOURCES.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
                        </Select>
                    </FormControl>
                ) : null}

                <Divider sx={{ my: 0.5 }} />
                <Button
                    variant="text"
                    onClick={() => setAdvancedOpen((open) => !open)}
                    aria-expanded={advancedOpen}
                    sx={{ justifySelf: 'start', px: 0 }}
                >
                    {advancedOpen ? 'Hide advanced settings' : 'Advanced settings'}
                </Button>
                <Collapse in={advancedOpen}>
                    <Stack spacing={1.5}>
                        <TextField
                            size="small"
                            label="Section link (anchor)"
                            helperText="Optional. Lets a button link directly to this part of the page."
                            value={section.anchor || ''}
                            onChange={(event) => updateSection(section.id, (current) => ({ ...current, anchor: event.target.value.trim() || null }))}
                        />
                        {section.kind === 'card_group' ? (
                            <Typography variant="caption" color="text.secondary">The preview uses the page’s current card content. The selected card source is saved with this section.</Typography>
                        ) : null}
                        <TextField
                            label="Section metadata"
                            value={selectedMetaText}
                            onChange={(event) => setMetaText(section, event.target.value)}
                            error={Boolean(currentMetaError)}
                            helperText={currentMetaError || 'For advanced layout settings. Keep this as a JSON object.'}
                            multiline
                            minRows={5}
                            size="small"
                            inputProps={{ spellCheck: false, 'aria-label': 'Section metadata JSON' }}
                            sx={{ '& textarea': { fontFamily: 'monospace', fontSize: 12 } }}
                        />
                    </Stack>
                </Collapse>
            </Box>
        );
    };

    const startDrag = (event: React.DragEvent, sectionId: string) => {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', sectionId);
    };

    const viewportMaxWidth = viewport === 'mobile' ? 390 : viewport === 'tablet' ? 820 : '100%';
    const draftPreviewSections = sections as unknown as PageSectionRow[];

    return (
        <Box data-admin-edit-ui="1" sx={{ mt: 2 }}>
            <Paper elevation={0} sx={{ p: { xs: 1.5, md: 2 }, border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
                <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'stretch', md: 'center' }} spacing={1.5}>
                    <Box sx={{ flex: 1, minWidth: 180 }}>
                        <Typography variant="h5" sx={{ fontWeight: 800 }}>Edit {pageTitle(pageKey)}</Typography>
                        <Typography variant="body2" color="text.secondary">Move sections, change content, and preview the page before saving.</Typography>
                    </Box>
                    <FormControl size="small" sx={{ minWidth: 150 }}>
                        <InputLabel id="composer-language">Language</InputLabel>
                        <Select labelId="composer-language" value={localeTab} label="Language" onChange={(event) => setLocaleTab(event.target.value as 'en' | 'es')}>
                            <MenuItem value="en">English</MenuItem>
                            <MenuItem value="es">Spanish draft</MenuItem>
                        </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ minWidth: 140 }}>
                        <InputLabel id="composer-preview-size">Preview size</InputLabel>
                        <Select labelId="composer-preview-size" value={viewport} label="Preview size" onChange={(event) => setViewport(event.target.value as typeof viewport)}>
                            <MenuItem value="desktop">Desktop</MenuItem>
                            <MenuItem value="tablet">Tablet</MenuItem>
                            <MenuItem value="mobile">Mobile</MenuItem>
                        </Select>
                    </FormControl>
                    <Chip
                        color={dirty ? 'warning' : 'success'}
                        variant={dirty ? 'filled' : 'outlined'}
                        label={dirty ? 'Unsaved changes' : 'All changes saved'}
                        aria-live="polite"
                    />
                    <Tooltip title="Undo the last add, move, duplicate, or remove">
                        <span>
                            <Button startIcon={<UndoIcon />} onClick={undoStructureChange} disabled={!undoSnapshot || saving || loading}>Undo</Button>
                        </span>
                    </Tooltip>
                    <Button onClick={requestDiscard} disabled={!dirty || saving || loading}>Discard</Button>
                    <Button variant="contained" startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />} onClick={() => void saveAll()} disabled={!dirty || saving || loading}>
                        {saving ? 'Saving…' : 'Save changes'}
                    </Button>
                </Stack>
            </Paper>

            {authError ? (
                <Alert severity="warning" sx={{ mt: 2 }} action={<Button color="inherit" size="small" href={reloginHref}>Sign in again</Button>}>
                    Your admin session needs to be refreshed before the page can be saved. {authError}
                </Alert>
            ) : null}
            {error ? <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert> : null}
            {partialSave ? <Alert severity="warning" sx={{ mt: 2 }}>{partialSave}</Alert> : null}
            {pageKey === 'gallery' ? <Alert severity="info" sx={{ mt: 2 }}>Use the Gallery media tools below this workspace to manage the gallery collection.</Alert> : null}
            <Box aria-live="polite" sx={{ position: 'absolute', width: 1, height: 1, p: 0, m: -1, overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: 0 }}>{liveMessage}</Box>

            {loading ? (
                <Paper sx={{ mt: 2, p: 5, display: 'grid', justifyItems: 'center', gap: 1.5 }}>
                    <CircularProgress />
                    <Typography color="text.secondary">Loading this page’s sections and content…</Typography>
                </Paper>
            ) : (error || authError) && !baseSections.length ? (
                <Paper sx={{ mt: 2, p: 3 }}>
                    <Button variant="outlined" onClick={() => void loadPage()}>Try loading again</Button>
                </Paper>
            ) : (
                <Box sx={{ mt: 2, display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '270px minmax(0, 1fr) 340px' }, gap: 2, alignItems: 'start' }}>
                    <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
                        <Box sx={{ p: 1.75, display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 800, flex: 1 }}>Page sections</Typography>
                            <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={(event) => setAddMenuAnchor(event.currentTarget)}>
                                Add
                            </Button>
                            <Menu anchorEl={addMenuAnchor} open={Boolean(addMenuAnchor)} onClose={() => setAddMenuAnchor(null)}>
                                {sectionAddOptions.map((kind) => <MenuItem key={kind} onClick={() => addSection(kind)}>{SECTION_LABELS[kind]}</MenuItem>)}
                            </Menu>
                        </Box>
                        <Divider />
                        {sections.length ? (
                            <Stack component="ol" spacing={0.75} sx={{ listStyle: 'none', m: 0, p: 1 }}>
                                {sections.map((section, index) => {
                                    const selected = section.id === selectedId;
                                    return (
                                        <Card
                                            component="li"
                                            key={section.id}
                                            variant="outlined"
                                            draggable={!saving}
                                            onDragStart={(event) => startDrag(event, section.id)}
                                            onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }}
                                            onDrop={(event) => {
                                                event.preventDefault();
                                                const id = event.dataTransfer.getData('text/plain');
                                                if (id) reorderSection(id, index);
                                            }}
                                            sx={{ borderColor: selected ? 'primary.main' : 'divider', bgcolor: selected ? 'action.selected' : 'background.paper', borderWidth: selected ? 2 : 1 }}
                                        >
                                            <CardContent sx={{ p: '10px !important' }}>
                                                <Stack direction="row" spacing={0.75} alignItems="center">
                                                    <Tooltip title="Drag to reorder">
                                                        <Box sx={{ display: 'flex', color: 'text.secondary', cursor: 'grab' }}><DragIndicatorIcon fontSize="small" /></Box>
                                                    </Tooltip>
                                                    <Button
                                                        onClick={() => setSelectedId(section.id)}
                                                        aria-current={selected ? 'true' : undefined}
                                                        sx={{ flex: 1, justifyContent: 'flex-start', textAlign: 'left', px: 0.5, minWidth: 0 }}
                                                    >
                                                        <Box sx={{ minWidth: 0 }}>
                                                            <Typography component="span" variant="body2" sx={{ fontWeight: 700, display: 'block' }}>{index + 1}. {SECTION_LABELS[section.kind]}</Typography>
                                                            <Typography component="span" variant="caption" color="text.secondary">{section.status === 'draft' ? 'New section' : 'On the page'}</Typography>
                                                        </Box>
                                                    </Button>
                                                    <Tooltip title="Move up">
                                                        <span><IconButton aria-label={`Move ${SECTION_LABELS[section.kind]} up`} size="small" onClick={() => reorderSection(section.id, index - 1)} disabled={index === 0 || saving}><ArrowUpwardIcon fontSize="small" /></IconButton></span>
                                                    </Tooltip>
                                                    <Tooltip title="Move down">
                                                        <span><IconButton aria-label={`Move ${SECTION_LABELS[section.kind]} down`} size="small" onClick={() => reorderSection(section.id, index + 1)} disabled={index === sections.length - 1 || saving}><ArrowDownwardIcon fontSize="small" /></IconButton></span>
                                                    </Tooltip>
                                                </Stack>
                                                <Stack direction="row" justifyContent="flex-end" spacing={0.5} sx={{ mt: 0.25 }}>
                                                    <Tooltip title="Duplicate section"><IconButton aria-label={`Duplicate ${SECTION_LABELS[section.kind]}`} size="small" onClick={() => duplicateSection(section)} disabled={saving}><ContentCopyIcon fontSize="small" /></IconButton></Tooltip>
                                                    <Tooltip title="Remove section"><IconButton aria-label={`Remove ${SECTION_LABELS[section.kind]}`} size="small" color="error" onClick={() => deleteSection(section)} disabled={saving}><DeleteOutlineIcon fontSize="small" /></IconButton></Tooltip>
                                                </Stack>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </Stack>
                        ) : (
                            <Box sx={{ p: 2.5 }}>
                                <Typography variant="body2" color="text.secondary">This page has no sections yet. Choose Add to build it up.</Typography>
                            </Box>
                        )}
                    </Paper>

                    <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden', minWidth: 0 }}>
                        <Box sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Live preview</Typography>
                            <Typography variant="caption" color="text.secondary">Click a section to edit it</Typography>
                        </Box>
                        <Box
                            onClickCapture={(event) => {
                                const target = event.target as HTMLElement | null;
                                if (target?.closest('a[href]')) event.preventDefault();
                            }}
                            sx={{ maxHeight: { xs: 520, md: 820 }, overflow: 'auto', p: { xs: 1, md: 2 }, bgcolor: 'grey.100' }}
                        >
                            <Paper elevation={2} sx={{ maxWidth: viewportMaxWidth, width: '100%', minHeight: 260, mx: 'auto', overflow: 'hidden', bgcolor: 'background.paper' }}>
                                {sections.length ? (
                                    <PagePreviewRendererInner
                                        pageKey={pageKey}
                                        sections={draftPreviewSections}
                                        localeTab={localeTab}
                                        content={contentPreview}
                                        media={mediaPreview}
                                        selectedSectionId={selectedId}
                                        onSelectSection={(sectionId) => setSelectedId(sectionId)}
                                        showDiagnostics={false}
                                    />
                                ) : (
                                    <Box sx={{ p: 5, textAlign: 'center' }}>
                                        <Typography variant="h6">Your page preview will appear here</Typography>
                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Add a Hero, Text, Photo or video, or Card group section to get started.</Typography>
                                    </Box>
                                )}
                            </Paper>
                        </Box>
                    </Paper>

                    <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden', minWidth: 0 }}>
                        {renderInspector(selectedSection)}
                        {selectedSection?.kind !== 'card_group' ? (
                            <Box sx={{ px: 2, pb: 2 }}>
                                <RadioGroup row aria-label="Text language" value={localeTab} onChange={(event) => setLocaleTab(event.target.value as 'en' | 'es')}>
                                    <FormControlLabel value="en" control={<Radio size="small" />} label="English" />
                                    <FormControlLabel value="es" control={<Radio size="small" />} label="Spanish draft" />
                                </RadioGroup>
                            </Box>
                        ) : null}
                    </Paper>
                </Box>
            )}

            <MediaPickerDialog
                open={pickerOpen}
                onClose={() => { setPickerOpen(false); setPickerTarget(null); }}
                defaultCategory="web_content"
                onSelect={(selection) => void onMediaSelected(selection)}
            />

            <Dialog open={discardOpen} onClose={() => setDiscardOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>Discard page changes?</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary">
                        {partialSave
                            ? 'Some changes were already saved. Discard will reload the page from its current saved version and clear the remaining edits.'
                            : 'Your unsaved edits will be cleared and the page will reload from its saved version.'}
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDiscardOpen(false)}>Keep editing</Button>
                    <Button color="error" variant="contained" onClick={discardChanges}>Discard changes</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
