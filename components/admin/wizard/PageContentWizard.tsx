'use client';

import * as React from 'react';
import { useLocale } from 'next-intl';
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    TextField,
    Typography,
} from '@mui/material';
import MediaPickerDialog, { type MediaSelection } from '@/components/admin/MediaPickerDialog';
import { RichTextEditor } from '@/components/admin/RichText';
import useContentBundle from '@/hooks/useContentBundle';
import { getSupabaseClient } from '@/lib/supabaseClient';
import type { Database, Json } from '@/lib/database.types';
import { PagePreviewRendererInner, type StagedContentMap, type StagedMediaMap } from '@/components/sections/PagePreviewRenderer';
import { rpc } from '@/lib/rpc';

type CanonicalSectionKind = 'hero' | 'richText' | 'media' | 'card_group';
type PageSectionRow = Database['public']['Functions']['rpc_get_page_sections']['Returns'][number];

type CmsRow = {
    body_en: string | null;
    body_es_draft: string | null;
};

async function adminGetCmsRow(pageKey: string): Promise<CmsRow | null> {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase client unavailable');
    const rows = await rpc<any[]>(supabase, 'admin_get_cms_page_row', { p_page_key: pageKey });
    const row = rows?.[0] ?? null;
    if (!row) return null;
    return { body_en: row.body_en ?? null, body_es_draft: row.body_es_draft ?? null };
}

async function adminSetMediaSlot(slotKey: string, assetId: string | null, sort: number) {
    const supabase = getSupabaseClient();
    await rpc<void>(supabase, 'admin_set_media_slot', { p_slot_key: slotKey, p_asset_id: assetId, p_sort: sort });
}

async function fetchSignedUrl(bucket: string, path: string): Promise<string> {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase client unavailable');
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 900);
    if (error) throw new Error(error.message);
    return String((data as any)?.signedUrl || '');
}

function isAuthErrorMessage(message: string) {
    const m = String(message || '').toLowerCase();
    return (
        m.includes('not authorized') ||
        m.includes('not allowed') ||
        m.includes('permission denied') ||
        m.includes('jwt') ||
        m.includes('invalid claim') ||
        m.includes('unauthorized')
    );
}

function asJsonObject(v: Json): Record<string, Json> | null {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
    return v as Record<string, Json>;
}

function pickString(obj: Record<string, Json> | null, key: string): string {
    const v = obj?.[key];
    return typeof v === 'string' ? v : '';
}

function pickNestedString(obj: Record<string, Json> | null, key: string, nestedKey: string): string {
    const child = asJsonObject((obj?.[key] ?? null) as any);
    return pickString(child, nestedKey);
}

function defaultCmsKey(sectionId: string, suffix: string): string {
    return `section.${sectionId}.${suffix}`;
}

function defaultSlotKey(sectionId: string, suffix: string): string {
    return `section.${sectionId}.${suffix}`;
}

async function rpcGetPageSections(pageKey: string): Promise<PageSectionRow[]> {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase client unavailable');
    const { data, error } = await supabase.rpc('rpc_get_page_sections', { p_page_key: pageKey, p_include_drafts: true });
    if (error) throw new Error(error.message);
    return (data || []) as PageSectionRow[];
}

type LoadedSlotItem = {
    slot_key: string;
    sort: number | null;
    asset_id: string | null;
    asset: { id: string; bucket: string; path: string; title: string } | null;
};

async function loadSlotItemsByPrefix(prefix: string): Promise<LoadedSlotItem[]> {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase client unavailable');
    const rows = await rpc<any[]>(supabase, 'admin_list_media_slots_by_prefix', { p_prefix: prefix });
    return (rows || []).map((r) => {
        const assetId = r?.asset_id ? String(r.asset_id) : null;
        const hasAsset = Boolean(assetId);
        return {
            slot_key: String(r?.slot_key || ''),
            sort: r?.sort ?? null,
            asset_id: assetId,
            asset: hasAsset
                ? {
                    id: assetId as string,
                    bucket: String(r?.asset_bucket || ''),
                    path: String(r?.asset_path || ''),
                    title: String(r?.asset_title || ''),
                }
                : null,
        } as LoadedSlotItem;
    });
}

function slotKeyForIndex(prefix: string, index: number) {
    const p = String(prefix || '').trim();
    if (!p) return '';
    return p.endsWith('.') ? `${p}${index}` : `${p}.${index}`;
}

export default function PageContentWizard(props: { pageKey: string; autoOpen?: boolean }) {
    const admin = useContentBundle('admin.');
    const locale = useLocale();
    const pageKey = String(props.pageKey || '').trim();

    const [open, setOpen] = React.useState(false);
    const [tab, setTab] = React.useState<'en' | 'es'>('en');

    const [loading, setLoading] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [authError, setAuthError] = React.useState<string | null>(null);

    const [sections, setSections] = React.useState<PageSectionRow[]>([]);
    const [selectedSectionId, setSelectedSectionId] = React.useState<string>('');

    const [contentDraft, setContentDraft] = React.useState<Record<string, { en: string; es: string }>>({});
    const [dirtyContentKeys, setDirtyContentKeys] = React.useState<Record<string, true>>({});

    // prefix -> list of items (each item has slot_key + asset info)
    const [baseSlotsByPrefix, setBaseSlotsByPrefix] = React.useState<Record<string, LoadedSlotItem[]>>({});
    const [stagedSlotsByPrefix, setStagedSlotsByPrefix] = React.useState<
        Record<string, Array<{ slot_key: string; asset: MediaSelection | null }>>
    >({});
    const [dirtySlotPrefixes, setDirtySlotPrefixes] = React.useState<Record<string, true>>({});

    const [pickerOpen, setPickerOpen] = React.useState(false);
    const [pickerTarget, setPickerTarget] = React.useState<{ prefix: string; index: number } | null>(null);

    const reloginHref = `/${locale}/adminlogin`;

    const closeWizard = () => {
        setOpen(false);
        setTab('en');
        setError(null);
        setAuthError(null);
        setLoading(false);
        setSaving(false);
        setSections([]);
        setSelectedSectionId('');
        setContentDraft({});
        setDirtyContentKeys({});
        setBaseSlotsByPrefix({});
        setStagedSlotsByPrefix({});
        setDirtySlotPrefixes({});
        setPickerOpen(false);
        setPickerTarget(null);
    };

    const translate = admin.t;
    const loadSections = React.useCallback(async () => {
        if (!pageKey) return;
        setLoading(true);
        setError(null);
        setAuthError(null);
        try {
            const rows = await rpcGetPageSections(pageKey);
            const ordered = [...rows].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
            setSections(ordered);
            // default selection
            setSelectedSectionId((prev) => prev || (ordered[0]?.id ? String(ordered[0].id) : ''));
        } catch (e: any) {
            const msg = e?.message || translate('admin.common.loadFailed', 'Failed to load');
            if (isAuthErrorMessage(msg)) setAuthError(msg);
            else setError(msg);
            setSections([]);
            setSelectedSectionId('');
        } finally {
            setLoading(false);
        }
    }, [translate, pageKey]);

    const openWizard = async () => {
        setOpen(true);
        await loadSections();
    };

    React.useEffect(() => {
        if (!props.autoOpen) return;
        if (open) return;
        if (!pageKey) return;
        void openWizard();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props.autoOpen, pageKey]);

    const selectedSection = React.useMemo(() => {
        return sections.find((s) => String(s.id) === String(selectedSectionId)) || null;
    }, [sections, selectedSectionId]);

    const selectedKind = (selectedSection?.kind as CanonicalSectionKind | undefined) || undefined;

    const pointerKeys = React.useMemo(() => {
        if (!selectedSection) return { cms: [] as string[], slots: [] as string[], carouselPrefixes: [] as string[] };
        const sectionId = String(selectedSection.id || '').trim();
        const kind = selectedSection.kind as CanonicalSectionKind;
        const content = asJsonObject(selectedSection.content_source as any);
        const media = asJsonObject(selectedSection.media_source as any);

        const cmsKeys: string[] = [];
        const slots: string[] = [];
        const carouselPrefixes: string[] = [];

        const titleKey = pickString(content, 'titleKey') || (sectionId && kind === 'hero' ? defaultCmsKey(sectionId, 'title') : '');
        const subtitleKey =
            pickString(content, 'subtitleKey') || (sectionId && kind === 'hero' ? defaultCmsKey(sectionId, 'subtitle') : '');
        const bodyKey =
            pickString(content, 'bodyKey') ||
            (sectionId && (kind === 'richText' || kind === 'hero') ? defaultCmsKey(sectionId, 'body') : '');

        const primaryLabelKey =
            pickNestedString(content, 'ctaPrimary', 'labelKey') ||
            (sectionId && kind === 'hero' ? defaultCmsKey(sectionId, 'cta.primary.label') : '');
        const primaryHrefKey =
            pickNestedString(content, 'ctaPrimary', 'hrefKey') ||
            (sectionId && kind === 'hero' ? defaultCmsKey(sectionId, 'cta.primary.href') : '');
        const secondaryLabelKey =
            pickNestedString(content, 'ctaSecondary', 'labelKey') ||
            (sectionId && kind === 'hero' ? defaultCmsKey(sectionId, 'cta.secondary.label') : '');
        const secondaryHrefKey =
            pickNestedString(content, 'ctaSecondary', 'hrefKey') ||
            (sectionId && kind === 'hero' ? defaultCmsKey(sectionId, 'cta.secondary.href') : '');

        if (titleKey) cmsKeys.push(titleKey);
        if (subtitleKey) cmsKeys.push(subtitleKey);
        if (bodyKey) cmsKeys.push(bodyKey);
        if (primaryLabelKey) cmsKeys.push(primaryLabelKey);
        if (primaryHrefKey) cmsKeys.push(primaryHrefKey);
        if (secondaryLabelKey) cmsKeys.push(secondaryLabelKey);
        if (secondaryHrefKey) cmsKeys.push(secondaryHrefKey);

        const backgroundSlot =
            pickString(media, 'backgroundSlot') || (sectionId && kind === 'hero' ? defaultSlotKey(sectionId, 'bg') : '');
        const primarySlot =
            pickString(media, 'primarySlot') ||
            (sectionId && (kind === 'hero' || kind === 'media') ? defaultSlotKey(sectionId, 'primary') : '');
        const carouselSlot =
            pickString(media, 'carouselSlot') || (sectionId && kind === 'media' ? defaultSlotKey(sectionId, 'carousel') : '');

        if (backgroundSlot) slots.push(backgroundSlot);
        if (primarySlot) slots.push(primarySlot);
        if (carouselSlot) carouselPrefixes.push(carouselSlot);

        return {
            cms: Array.from(new Set(cmsKeys)),
            slots: Array.from(new Set(slots)),
            carouselPrefixes: Array.from(new Set(carouselPrefixes)),
        };
    }, [selectedSection]);

    React.useEffect(() => {
        if (!open) return;
        if (!selectedSection) return;

        // Load any missing CMS keys for this section.
        void (async () => {
            const missing = pointerKeys.cms.filter((k) => !(k in contentDraft));
            if (!missing.length) return;
            try {
                const rows = await Promise.all(missing.map((k) => adminGetCmsRow(k)));
                setContentDraft((prev) => {
                    const next = { ...prev };
                    for (let i = 0; i < missing.length; i++) {
                        const key = missing[i];
                        const r = rows[i];
                        next[key] = { en: r?.body_en ?? '', es: r?.body_es_draft ?? '' };
                    }
                    return next;
                });
            } catch (e: any) {
                const msg = e?.message || admin.t('admin.common.loadFailed', 'Failed to load');
                if (isAuthErrorMessage(msg)) setAuthError(msg);
                else setError(msg);
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, selectedSectionId]);

    React.useEffect(() => {
        if (!open) return;
        if (!selectedSection) return;

        // Load media slots by exact key (single slots)
        void (async () => {
            const prefixes = [...pointerKeys.slots, ...pointerKeys.carouselPrefixes].filter(Boolean);
            const missing = prefixes.filter((p) => !(p in baseSlotsByPrefix));
            if (!missing.length) return;

            try {
                const loaded = await Promise.all(missing.map((p) => loadSlotItemsByPrefix(p)));

                setBaseSlotsByPrefix((prev) => {
                    const next = { ...prev };
                    for (let i = 0; i < missing.length; i++) next[missing[i]] = loaded[i];
                    return next;
                });

                // Seed staged slots from base when not already staged.
                setStagedSlotsByPrefix((prev) => {
                    const next = { ...prev };
                    for (let i = 0; i < missing.length; i++) {
                        const prefix = missing[i];
                        if (next[prefix]) continue;
                        const baseItems = loaded[i] || [];
                        // Convert base items to MediaSelection-like objects for preview/picker.
                        next[prefix] = baseItems
                            .filter((it) => it.asset)
                            .map((it) => ({
                                slot_key: it.slot_key,
                                asset: it.asset
                                    ? ({
                                        id: it.asset.id,
                                        assetKey: null,
                                        bucket: it.asset.bucket,
                                        path: it.asset.path,
                                        previewUrl: '',
                                    } as MediaSelection)
                                    : null,
                            }));
                    }
                    return next;
                });

                // Resolve signed URLs for any seeded staged assets.
                for (const prefix of missing) {
                    const baseItems = loaded[missing.indexOf(prefix)] || [];
                    const assets = baseItems.map((it) => it.asset).filter(Boolean) as Array<{ id: string; bucket: string; path: string }>;
                    if (!assets.length) continue;
                    const urls = await Promise.all(
                        assets.map(async (a) => {
                            try {
                                return await fetchSignedUrl(a.bucket, a.path);
                            } catch {
                                return '';
                            }
                        })
                    );
                    setStagedSlotsByPrefix((prev) => {
                        const existing = prev[prefix] || [];
                        const nextItems = existing.map((x, idx) => {
                            const url = urls[idx] || '';
                            if (!x.asset) return x;
                            return { ...x, asset: { ...x.asset, previewUrl: x.asset.previewUrl || url } };
                        });
                        return { ...prev, [prefix]: nextItems };
                    });
                }
            } catch (e: any) {
                const msg = e?.message || admin.t('admin.common.loadFailed', 'Failed to load');
                if (isAuthErrorMessage(msg)) setAuthError(msg);
                else setError(msg);
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, selectedSectionId]);

    const setCmsValue = (key: string, localeKey: 'en' | 'es', value: string) => {
        setContentDraft((prev) => ({
            ...prev,
            [key]: { en: prev[key]?.en ?? '', es: prev[key]?.es ?? '', [localeKey]: value },
        }));
        setDirtyContentKeys((prev) => ({ ...prev, [key]: true }));
    };

    const openPickerFor = (prefix: string, index: number) => {
        setPickerTarget({ prefix, index });
        setPickerOpen(true);
    };

    const onPicked = async (sel: MediaSelection) => {
        const target = pickerTarget;
        setPickerOpen(false);
        setPickerTarget(null);
        if (!target) return;

        const prefix = target.prefix;
        const idx = target.index;
        let previewUrl = sel.previewUrl || '';
        if (!previewUrl && sel.bucket && sel.path) {
            try {
                previewUrl = await fetchSignedUrl(sel.bucket, sel.path);
            } catch {
                previewUrl = '';
            }
        }

        setStagedSlotsByPrefix((prev) => {
            const existing = [...(prev[prefix] || [])];
            const slot_key = idx === 0 && pointerKeys.slots.includes(prefix) ? prefix : slotKeyForIndex(prefix, idx);
            const nextSel: MediaSelection = { ...sel, previewUrl };
            existing[idx] = { slot_key, asset: nextSel };
            // Trim trailing empty entries
            while (existing.length && !existing[existing.length - 1]?.asset) existing.pop();
            return { ...prev, [prefix]: existing };
        });
        setDirtySlotPrefixes((prev) => ({ ...prev, [prefix]: true }));
    };

    const clearSlotIndex = (prefix: string, index: number) => {
        setStagedSlotsByPrefix((prev) => {
            const existing = [...(prev[prefix] || [])];
            if (!existing[index]) return prev;
            existing[index] = { ...existing[index], asset: null };
            while (existing.length && !existing[existing.length - 1]?.asset) existing.pop();
            return { ...prev, [prefix]: existing };
        });
        setDirtySlotPrefixes((prev) => ({ ...prev, [prefix]: true }));
    };

    const addCarouselItem = (prefix: string) => {
        setStagedSlotsByPrefix((prev) => {
            const existing = [...(prev[prefix] || [])];
            const nextIndex = existing.length;
            existing.push({ slot_key: slotKeyForIndex(prefix, nextIndex), asset: null });
            return { ...prev, [prefix]: existing };
        });
        setDirtySlotPrefixes((prev) => ({ ...prev, [prefix]: true }));
    };

    const moveCarouselItem = (prefix: string, index: number, dir: -1 | 1) => {
        setStagedSlotsByPrefix((prev) => {
            const existing = [...(prev[prefix] || [])];
            const swap = index + dir;
            if (swap < 0 || swap >= existing.length) return prev;
            const tmp = existing[index];
            existing[index] = existing[swap];
            existing[swap] = tmp;
            // Recompute slot_key naming deterministically
            const normalized = existing.map((it, i) => ({ ...it, slot_key: slotKeyForIndex(prefix, i) }));
            return { ...prev, [prefix]: normalized };
        });
        setDirtySlotPrefixes((prev) => ({ ...prev, [prefix]: true }));
    };

    const refresh = async () => {
        await loadSections();
        // keep drafts; content/media are cached, but reload base slot items for current pointers
        for (const p of [...pointerKeys.slots, ...pointerKeys.carouselPrefixes]) {
            if (!p) continue;
            try {
                const base = await loadSlotItemsByPrefix(p);
                setBaseSlotsByPrefix((prev) => ({ ...prev, [p]: base }));
            } catch {
                // ignore
            }
        }
    };

    const saveAll = async () => {
        setSaving(true);
        setError(null);
        setAuthError(null);
        try {
            // 1) Save dirty CMS keys
            const dirtyKeys = Object.keys(dirtyContentKeys);
            for (const k of dirtyKeys) {
                const v = contentDraft[k];
                if (!v) continue;
                const supabase = getSupabaseClient();
                await rpc<void>(supabase, 'admin_upsert_page_content', {
                    p_page_key: k,
                    p_body_en: v.en ?? '',
                    p_body_es_draft: v.es ?? '',
                });
            }

            // 2) Save dirty media prefixes
            const dirtyPrefixes = Object.keys(dirtySlotPrefixes);
            for (const prefix of dirtyPrefixes) {
                const desired = (stagedSlotsByPrefix[prefix] || []).filter((x) => x.asset && x.asset.id);
                const desiredKeys = new Set(desired.map((x) => x.slot_key));

                const base = baseSlotsByPrefix[prefix] || [];
                // Clear base items not present anymore.
                for (const it of base) {
                    if (!it.slot_key) continue;
                    if (desiredKeys.has(it.slot_key)) continue;
                    await adminSetMediaSlot(it.slot_key, null, it.sort ?? 0);
                }

                // Upsert desired items
                for (let i = 0; i < desired.length; i++) {
                    const it = desired[i];
                    await adminSetMediaSlot(it.slot_key, it.asset!.id, i);
                }
            }

            // 3) Reload section list + clear dirty flags
            await loadSections();
            setDirtyContentKeys({});
            setDirtySlotPrefixes({});
        } catch (e: any) {
            const msg = e?.message || admin.t('admin.common.saveFailed', 'Save failed');
            if (isAuthErrorMessage(msg)) setAuthError(msg);
            else setError(msg);
        } finally {
            setSaving(false);
        }
    };

    const stagedPreviewContent: StagedContentMap = React.useMemo(() => {
        const out: StagedContentMap = {};
        for (const [k, v] of Object.entries(contentDraft)) {
            out[k] = { en: v.en ?? '', es: v.es ?? '' };
        }
        return out;
    }, [contentDraft]);

    const stagedPreviewMedia: StagedMediaMap = React.useMemo(() => {
        const out: StagedMediaMap = {};
        for (const [prefix, items] of Object.entries(stagedSlotsByPrefix)) {
            out[prefix] = (items || [])
                .filter((x) => x.asset && (x.asset.previewUrl || x.asset.bucket))
                .map((x) => ({
                    url: x.asset?.previewUrl || '',
                    bucket: x.asset?.bucket ?? null,
                    path: x.asset?.path ?? null,
                }));
        }
        return out;
    }, [stagedSlotsByPrefix]);

    const contentObj = selectedSection ? asJsonObject(selectedSection.content_source as any) : null;
    const mediaObj = selectedSection ? asJsonObject(selectedSection.media_source as any) : null;

    const selectedSectionIdTrimmed = selectedSection ? String(selectedSection.id || '').trim() : '';

    const titleKey =
        pickString(contentObj, 'titleKey') ||
        (selectedSectionIdTrimmed && selectedKind === 'hero' ? defaultCmsKey(selectedSectionIdTrimmed, 'title') : '');
    const subtitleKey =
        pickString(contentObj, 'subtitleKey') ||
        (selectedSectionIdTrimmed && selectedKind === 'hero' ? defaultCmsKey(selectedSectionIdTrimmed, 'subtitle') : '');
    const bodyKey =
        pickString(contentObj, 'bodyKey') ||
        (selectedSectionIdTrimmed && (selectedKind === 'richText' || selectedKind === 'hero')
            ? defaultCmsKey(selectedSectionIdTrimmed, 'body')
            : '');
    const primaryLabelKey =
        pickNestedString(contentObj, 'ctaPrimary', 'labelKey') ||
        (selectedSectionIdTrimmed && selectedKind === 'hero' ? defaultCmsKey(selectedSectionIdTrimmed, 'cta.primary.label') : '');
    const primaryHrefKey =
        pickNestedString(contentObj, 'ctaPrimary', 'hrefKey') ||
        (selectedSectionIdTrimmed && selectedKind === 'hero' ? defaultCmsKey(selectedSectionIdTrimmed, 'cta.primary.href') : '');
    const secondaryLabelKey =
        pickNestedString(contentObj, 'ctaSecondary', 'labelKey') ||
        (selectedSectionIdTrimmed && selectedKind === 'hero'
            ? defaultCmsKey(selectedSectionIdTrimmed, 'cta.secondary.label')
            : '');
    const secondaryHrefKey =
        pickNestedString(contentObj, 'ctaSecondary', 'hrefKey') ||
        (selectedSectionIdTrimmed && selectedKind === 'hero' ? defaultCmsKey(selectedSectionIdTrimmed, 'cta.secondary.href') : '');

    const backgroundSlot =
        pickString(mediaObj, 'backgroundSlot') ||
        (selectedSectionIdTrimmed && selectedKind === 'hero' ? defaultSlotKey(selectedSectionIdTrimmed, 'bg') : '');
    const primarySlot =
        pickString(mediaObj, 'primarySlot') ||
        (selectedSectionIdTrimmed && (selectedKind === 'hero' || selectedKind === 'media')
            ? defaultSlotKey(selectedSectionIdTrimmed, 'primary')
            : '');
    const carouselSlot =
        pickString(mediaObj, 'carouselSlot') ||
        (selectedSectionIdTrimmed && selectedKind === 'media' ? defaultSlotKey(selectedSectionIdTrimmed, 'carousel') : '');

    const editorLeft = (
        <Box sx={{ display: 'grid', gap: 2 }}>
            {authError ? (
                <Alert
                    severity="warning"
                    action={
                        <Button color="inherit" size="small" href={reloginHref}>
                            {admin.t('admin.auth.relogin', 'Re-login')}
                        </Button>
                    }
                >
                    {admin.t('admin.auth.notAuthorized', 'Not authorized. Please re-login.')} {authError}
                </Alert>
            ) : null}
            {error ? <Alert severity="error">{error}</Alert> : null}

            <Typography variant="body2" color="text.secondary">
                {admin.t('admin.pageComposer.pageKey', 'Page key')}: <Box component="span" sx={{ fontFamily: 'monospace' }}>{pageKey}</Box>
            </Typography>

            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                <FormControl size="small" sx={{ minWidth: 280 }}>
                    <InputLabel id="content-section">{admin.t('admin.pageComposer.content.section', 'Section')}</InputLabel>
                    <Select
                        labelId="content-section"
                        label={admin.t('admin.pageComposer.content.section', 'Section')}
                        value={selectedSectionId}
                        onChange={(e) => setSelectedSectionId(String(e.target.value || ''))}
                    >
                        {sections.map((s) => (
                            <MenuItem key={s.id} value={s.id}>
                                {String(s.kind)} · {String(s.id).slice(0, 8)}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <Button variant="outlined" onClick={() => void refresh()} disabled={loading || saving}>
                    {admin.t('admin.common.refresh', 'Refresh')}
                </Button>
            </Box>

            <Divider />

            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button size="small" variant={tab === 'en' ? 'contained' : 'outlined'} onClick={() => setTab('en')}>
                    {admin.t('admin.common.english', 'English')}
                </Button>
                <Button size="small" variant={tab === 'es' ? 'contained' : 'outlined'} onClick={() => setTab('es')}>
                    {admin.t('admin.common.spanish', 'Spanish (draft)')}
                </Button>
            </Box>

            {!selectedSection ? (
                <Alert severity="info">{admin.t('admin.pageComposer.content.selectSection', 'Select a section to edit')}</Alert>
            ) : selectedKind === 'hero' ? (
                <Box sx={{ display: 'grid', gap: 2 }}>
                    <TextField
                        label="Title"
                        value={tab === 'en' ? contentDraft[titleKey]?.en ?? '' : contentDraft[titleKey]?.es ?? ''}
                        onChange={(e) => titleKey && setCmsValue(titleKey, tab, e.target.value)}
                        disabled={!titleKey}
                        helperText={titleKey ? `CMS: ${titleKey}` : 'Missing content_source.titleKey'}
                    />
                    <TextField
                        label="Subtitle"
                        value={tab === 'en' ? contentDraft[subtitleKey]?.en ?? '' : contentDraft[subtitleKey]?.es ?? ''}
                        onChange={(e) => subtitleKey && setCmsValue(subtitleKey, tab, e.target.value)}
                        disabled={!subtitleKey}
                        helperText={subtitleKey ? `CMS: ${subtitleKey}` : 'Missing content_source.subtitleKey'}
                    />
                    <TextField
                        label="Primary button label"
                        value={tab === 'en' ? contentDraft[primaryLabelKey]?.en ?? '' : contentDraft[primaryLabelKey]?.es ?? ''}
                        onChange={(e) => primaryLabelKey && setCmsValue(primaryLabelKey, tab, e.target.value)}
                        disabled={!primaryLabelKey}
                        helperText={primaryLabelKey ? `CMS: ${primaryLabelKey}` : 'Missing content_source.ctaPrimary.labelKey'}
                    />
                    <TextField
                        label="Primary button href"
                        value={tab === 'en' ? contentDraft[primaryHrefKey]?.en ?? '' : contentDraft[primaryHrefKey]?.es ?? ''}
                        onChange={(e) => primaryHrefKey && setCmsValue(primaryHrefKey, tab, e.target.value)}
                        disabled={!primaryHrefKey}
                        helperText={primaryHrefKey ? `CMS: ${primaryHrefKey}` : 'Missing content_source.ctaPrimary.hrefKey'}
                    />
                    <TextField
                        label="Secondary button label"
                        value={tab === 'en' ? contentDraft[secondaryLabelKey]?.en ?? '' : contentDraft[secondaryLabelKey]?.es ?? ''}
                        onChange={(e) => secondaryLabelKey && setCmsValue(secondaryLabelKey, tab, e.target.value)}
                        disabled={!secondaryLabelKey}
                        helperText={secondaryLabelKey ? `CMS: ${secondaryLabelKey}` : 'Missing content_source.ctaSecondary.labelKey'}
                    />
                    <TextField
                        label="Secondary button href"
                        value={tab === 'en' ? contentDraft[secondaryHrefKey]?.en ?? '' : contentDraft[secondaryHrefKey]?.es ?? ''}
                        onChange={(e) => secondaryHrefKey && setCmsValue(secondaryHrefKey, tab, e.target.value)}
                        disabled={!secondaryHrefKey}
                        helperText={secondaryHrefKey ? `CMS: ${secondaryHrefKey}` : 'Missing content_source.ctaSecondary.hrefKey'}
                    />

                    <Divider />

                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        Hero background
                    </Typography>
                    {backgroundSlot ? (
                        <Box sx={{ display: 'grid', gap: 1.5 }}>
                            <Typography variant="body2" color="text.secondary">
                                Slot: <Box component="span" sx={{ fontFamily: 'monospace' }}>{backgroundSlot}</Box>
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
                                <Button variant="outlined" onClick={() => openPickerFor(backgroundSlot, 0)}>
                                    {admin.t('admin.mediaPicker.actions.select', 'Select')}
                                </Button>
                                <Button variant="outlined" color="inherit" onClick={() => clearSlotIndex(backgroundSlot, 0)}>
                                    {admin.t('admin.common.clear', 'Clear')}
                                </Button>
                                {stagedSlotsByPrefix[backgroundSlot]?.[0]?.asset ? (
                                    <Typography variant="body2" color="text.secondary">
                                        {stagedSlotsByPrefix[backgroundSlot][0].asset?.bucket}/{stagedSlotsByPrefix[backgroundSlot][0].asset?.path}
                                    </Typography>
                                ) : null}
                            </Box>
                        </Box>
                    ) : (
                        <Alert severity="warning">Missing media_source.backgroundSlot</Alert>
                    )}
                </Box>
            ) : selectedKind === 'richText' ? (
                <Box sx={{ display: 'grid', gap: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                        {bodyKey ? `CMS: ${bodyKey}` : 'Missing content_source.bodyKey'}
                    </Typography>
                    {bodyKey ? (
                        <RichTextEditor
                            label={tab === 'en' ? 'Rich text (EN)' : 'Rich text (ES draft)'}
                            value={tab === 'en' ? contentDraft[bodyKey]?.en ?? '' : contentDraft[bodyKey]?.es ?? ''}
                            onChange={(v) => setCmsValue(bodyKey, tab, v)}
                        />
                    ) : null}
                </Box>
            ) : selectedKind === 'media' ? (
                <Box sx={{ display: 'grid', gap: 2 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        Media
                    </Typography>

                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        Primary slot
                    </Typography>
                    {primarySlot ? (
                        <Box sx={{ display: 'grid', gap: 1.5 }}>
                            <Typography variant="body2" color="text.secondary">
                                Slot: <Box component="span" sx={{ fontFamily: 'monospace' }}>{primarySlot}</Box>
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
                                <Button variant="outlined" onClick={() => openPickerFor(primarySlot, 0)}>
                                    {admin.t('admin.mediaPicker.actions.select', 'Select')}
                                </Button>
                                <Button variant="outlined" color="inherit" onClick={() => clearSlotIndex(primarySlot, 0)}>
                                    {admin.t('admin.common.clear', 'Clear')}
                                </Button>
                                {stagedSlotsByPrefix[primarySlot]?.[0]?.asset ? (
                                    <Typography variant="body2" color="text.secondary">
                                        {stagedSlotsByPrefix[primarySlot][0].asset?.bucket}/{stagedSlotsByPrefix[primarySlot][0].asset?.path}
                                    </Typography>
                                ) : null}
                            </Box>
                        </Box>
                    ) : (
                        <Alert severity="warning">Missing media_source.primarySlot</Alert>
                    )}

                    <Divider />

                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        Carousel slot
                    </Typography>
                    {carouselSlot ? (
                        <Box sx={{ display: 'grid', gap: 1.5 }}>
                            <Typography variant="body2" color="text.secondary">
                                Prefix: <Box component="span" sx={{ fontFamily: 'monospace' }}>{carouselSlot}</Box>
                            </Typography>
                            <Button variant="outlined" onClick={() => addCarouselItem(carouselSlot)}>
                                {admin.t('admin.common.add', 'Add')}
                            </Button>

                            {(stagedSlotsByPrefix[carouselSlot] || []).map((it, idx) => (
                                <Box key={it.slot_key || idx} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1.5 }}>
                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                        slot_key: <Box component="span" sx={{ fontFamily: 'monospace' }}>{it.slot_key}</Box>
                                    </Typography>
                                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                                        <Button size="small" variant="outlined" onClick={() => openPickerFor(carouselSlot, idx)}>
                                            {admin.t('admin.mediaPicker.actions.select', 'Select')}
                                        </Button>
                                        <Button size="small" variant="outlined" color="inherit" onClick={() => clearSlotIndex(carouselSlot, idx)}>
                                            {admin.t('admin.common.clear', 'Clear')}
                                        </Button>
                                        <Button size="small" onClick={() => moveCarouselItem(carouselSlot, idx, -1)} disabled={idx === 0}>
                                            {admin.t('admin.common.up', 'Up')}
                                        </Button>
                                        <Button
                                            size="small"
                                            onClick={() => moveCarouselItem(carouselSlot, idx, 1)}
                                            disabled={idx === (stagedSlotsByPrefix[carouselSlot]?.length || 0) - 1}
                                        >
                                            {admin.t('admin.common.down', 'Down')}
                                        </Button>
                                        {it.asset ? (
                                            <Typography variant="body2" color="text.secondary">
                                                {it.asset.bucket}/{it.asset.path}
                                            </Typography>
                                        ) : (
                                            <Typography variant="body2" color="text.secondary">
                                                (empty)
                                            </Typography>
                                        )}
                                    </Box>
                                </Box>
                            ))}
                        </Box>
                    ) : (
                        <Alert severity="warning">Missing media_source.carouselSlot</Alert>
                    )}
                </Box>
            ) : selectedKind === 'card_group' ? (
                <Alert severity="info">Card group uses existing rendering; no content editor in this wizard yet.</Alert>
            ) : (
                <Alert severity="warning">Unsupported section kind: {String(selectedSection.kind)}</Alert>
            )}
        </Box>
    );

    return (
        <Box data-admin-edit-ui="1">
            <Button variant="outlined" onClick={openWizard}>
                {admin.t('admin.pageComposer.content.open', 'Open Page Composer (Content)')}
            </Button>

            <Dialog open={open} onClose={closeWizard} fullWidth maxWidth="lg">
                <DialogTitle>{admin.t('admin.pageComposer.content.title', 'Page Composer (Content)')}</DialogTitle>
                <DialogContent sx={{ pt: 2 }}>
                    {loading ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                            <CircularProgress size={18} />
                            <Typography variant="body2">{admin.t('admin.common.loading', 'Loading…')}</Typography>
                        </Box>
                    ) : null}

                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
                        <Box>{editorLeft}</Box>

                        <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'auto', maxHeight: '75vh' }}>
                            <PagePreviewRendererInner
                                sections={sections}
                                localeTab={tab}
                                content={stagedPreviewContent}
                                media={stagedPreviewMedia}
                            />
                        </Box>
                    </Box>

                    <MediaPickerDialog
                        open={pickerOpen}
                        onClose={() => {
                            setPickerOpen(false);
                            setPickerTarget(null);
                        }}
                        defaultCategory="web_content"
                        onSelect={(s) => void onPicked(s)}
                    />
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={closeWizard} disabled={saving || loading}>
                        {admin.t('admin.common.cancel', 'Cancel')}
                    </Button>
                    <Button
                        variant="contained"
                        onClick={() => void saveAll()}
                        disabled={
                            saving ||
                            loading ||
                            (!Object.keys(dirtyContentKeys).length && !Object.keys(dirtySlotPrefixes).length)
                        }
                    >
                        {saving ? admin.t('admin.common.saving', 'Saving…') : admin.t('admin.common.save', 'Save')}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
