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
    Grid,
    MenuItem,
    TextField,
    Typography,
} from '@mui/material';
import useContentBundle from '@/hooks/useContentBundle';
import { getSupabaseClient } from '@/lib/supabaseClient';
import type { Database, Json } from '@/lib/database.types';
import PagePreviewRenderer from '../../sections/PagePreviewRenderer';
import { invalidateContentCache } from '@/lib/contentCache';

type CanonicalSectionKind = 'hero' | 'richText' | 'media' | 'card_group';

type PageSectionRow = Database['public']['Functions']['rpc_get_page_sections']['Returns'][number];

type StagedEditsById = Record<
    string,
    {
        anchor?: string;
        metaText?: string;
        metaJson?: Json;
        metaError?: string | null;
    }
>;

function isAuthErrorMessage(message: string) {
    const m = String(message || '').toLowerCase();
    return (
        m.includes('not authorized') ||
        m.includes('not allowed') ||
        m.includes('permission denied') ||
        m.includes('jwt') ||
        m.includes('invalid claim')
    );
}

function nextSortForIndex(i: number) {
    // 10-step spacing for easier inserts
    return i * 10;
}

function ensureJsonObject(v: Json, label: string, sectionId: string): Record<string, Json> {
    if (!v || typeof v !== 'object' || Array.isArray(v)) {
        throw new Error(`Section ${sectionId} is missing ${label}. Click Refresh and try again.`);
    }
    return v as Record<string, Json>;
}

function mergeJsonObjects(base: Record<string, Json>, patch: Record<string, Json>): Record<string, Json> {
    return { ...base, ...patch };
}

function ensureNestedObject(base: Record<string, Json>, key: string): Record<string, Json> {
    const v = base[key];
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
    return v as Record<string, Json>;
}

function withDefaultPointers(
    args: {
        kind: CanonicalSectionKind;
        sectionId: string;
        content_source: Record<string, Json>;
        media_source: Record<string, Json>;
    }
): { content_source: Record<string, Json>; media_source: Record<string, Json> } {
    const { kind, sectionId } = args;

    // Mirror RPC defaults; only fill missing keys (never overwrite existing pointers).
    const defaultContent: Record<string, Json> = {
        titleKey: `section.${sectionId}.title`,
        subtitleKey: `section.${sectionId}.subtitle`,
        bodyKey: `section.${sectionId}.body`,
        ctaPrimary: {
            labelKey: `section.${sectionId}.cta.primary.label`,
            hrefKey: `section.${sectionId}.cta.primary.href`,
        },
        ctaSecondary: {
            labelKey: `section.${sectionId}.cta.secondary.label`,
            hrefKey: `section.${sectionId}.cta.secondary.href`,
        },
    };

    const defaultMedia: Record<string, Json> = {
        backgroundSlot: `section.${sectionId}.bg`,
        primarySlot: `section.${sectionId}.primary`,
        carouselSlot: `section.${sectionId}.carousel`,
    };

    const content_source = (() => {
        const base = args.content_source;
        const next = { ...base };

        // Only apply generic defaults to kinds that the Content Wizard knows how to use.
        if (kind === 'hero' || kind === 'richText' || kind === 'media') {
            if (!next.titleKey) next.titleKey = defaultContent.titleKey;
            if (!next.subtitleKey) next.subtitleKey = defaultContent.subtitleKey;
            if (!next.bodyKey) next.bodyKey = defaultContent.bodyKey;

            // Existing nested pointers take precedence over defaults.
            next.ctaPrimary = mergeJsonObjects(defaultContent.ctaPrimary as any, ensureNestedObject(next, 'ctaPrimary')) as any;
            next.ctaSecondary = mergeJsonObjects(defaultContent.ctaSecondary as any, ensureNestedObject(next, 'ctaSecondary')) as any;
        }

        return next;
    })();

    const media_source = (() => {
        const base = args.media_source;
        const next = { ...base };

        if (kind === 'hero' || kind === 'media') {
            if (!next.backgroundSlot) next.backgroundSlot = defaultMedia.backgroundSlot;
            if (!next.primarySlot) next.primarySlot = defaultMedia.primarySlot;
            if (!next.carouselSlot) next.carouselSlot = defaultMedia.carouselSlot;
        }

        return next;
    })();

    return { content_source, media_source };
}

async function rpcGetPageSections(pageKey: string): Promise<PageSectionRow[]> {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase client unavailable');
    const { data, error } = await supabase.rpc('rpc_get_page_sections', { p_page_key: pageKey, p_include_drafts: true });
    if (error) throw new Error(error.message);
    return (data || []) as PageSectionRow[];
}

async function rpcCreatePageSection(args: {
    pageKey: string;
    kind: CanonicalSectionKind;
    sort: number;
    status: 'draft';
}) {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase client unavailable');
    const { data, error } = await supabase.rpc('rpc_create_page_section', {
        p_page_key: args.pageKey,
        p_kind: args.kind,
        p_sort: args.sort,
        p_status: args.status,
        p_meta: {},
    });
    if (error) throw new Error(error.message);
    const id = String(data || '').trim();
    if (!id) throw new Error('Failed to create section');
    invalidateContentCache();
    return id;
}

async function rpcDeletePageSection(pageKey: string, sectionId: string) {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase client unavailable');
    const { error } = await supabase.rpc('rpc_delete_page_section', { p_page_key: pageKey, p_section_id: sectionId });
    if (error) throw new Error(error.message);
    invalidateContentCache();
}

async function rpcUpsertPageSections(pageKey: string, sections: Array<Record<string, any>>) {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase client unavailable');
    const { error } = await supabase.rpc('rpc_upsert_page_sections', {
        p_page_key: pageKey,
        p_sections: sections,
        p_prune_missing: true,
    });
    if (error) throw new Error(error.message);
    invalidateContentCache();
}

export default function PageStructureWizard(props: { pageKey: string; autoOpen?: boolean }) {
    const admin = useContentBundle('admin.');
    const locale = useLocale();

    const pageKey = String(props.pageKey || '').trim();

    const [open, setOpen] = React.useState(false);
    const [loading, setLoading] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [authError, setAuthError] = React.useState<string | null>(null);

    const [baseSections, setBaseSections] = React.useState<PageSectionRow[]>([]);
    const [orderIds, setOrderIds] = React.useState<string[]>([]);
    const [editsById, setEditsById] = React.useState<StagedEditsById>({});

    const [addKind, setAddKind] = React.useState<CanonicalSectionKind>('richText');

    const closeWizard = () => {
        setOpen(false);
        setError(null);
        setAuthError(null);
        setLoading(false);
        setSaving(false);
        setBaseSections([]);
        setOrderIds([]);
        setEditsById({});
    };

    const mergeFetchedSections = React.useCallback((fetched: PageSectionRow[]) => {
        setBaseSections(fetched);

        setOrderIds((prev) => {
            const next: string[] = [];
            const fetchedById = new Map(fetched.map((s) => [s.id, s] as const));

            // Keep existing staged order for known IDs.
            for (const id of prev) {
                if (fetchedById.has(id)) next.push(id);
            }

            // Append any new IDs (e.g., just created).
            for (const s of fetched) {
                if (!next.includes(s.id)) next.push(s.id);
            }

            if (!next.length) return fetched.map((s) => s.id);
            return next;
        });

        setEditsById((prev) => {
            if (!prev || !Object.keys(prev).length) return prev;
            const fetchedIds = new Set(fetched.map((s) => s.id));
            const next: StagedEditsById = {};
            for (const [id, v] of Object.entries(prev)) {
                if (fetchedIds.has(id)) next[id] = v;
            }
            return next;
        });
    }, []);

    const translate = admin.t;
    const load = React.useCallback(async () => {
        if (!pageKey) {
            setError(translate('admin.common.loadFailed', 'Failed to load'));
            return;
        }
        setLoading(true);
        setError(null);
        setAuthError(null);
        try {
            const rows = await rpcGetPageSections(pageKey);
            mergeFetchedSections(rows);
        } catch (e: any) {
            const msg = e?.message || translate('admin.common.loadFailed', 'Failed to load');
            if (isAuthErrorMessage(msg)) setAuthError(msg);
            else setError(msg);
            setBaseSections([]);
            setOrderIds([]);
        } finally {
            setLoading(false);
        }
    }, [translate, mergeFetchedSections, pageKey]);

    const openWizard = () => {
        setOpen(true);
    };

    const prevPageKeyRef = React.useRef<string>('');
    React.useEffect(() => {
        if (prevPageKeyRef.current && prevPageKeyRef.current !== pageKey) {
            // Switching pages: clear staged state to avoid mixing.
            setError(null);
            setAuthError(null);
            setBaseSections([]);
            setOrderIds([]);
            setEditsById({});
        }
        prevPageKeyRef.current = pageKey;
        // If the dialog is already open, reload for the new page.
        if (open && pageKey) {
            void load();
        }
    }, [pageKey, open, load]);

    React.useEffect(() => {
        if (!props.autoOpen) return;
        if (open) return;
        if (!pageKey) return;
        void openWizard();
        // Intentionally only runs when pageKey/autoOpen changes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props.autoOpen, pageKey]);

    const stagedSections = React.useMemo(() => {
        const baseById = new Map(baseSections.map((s) => [s.id, s] as const));
        const out: PageSectionRow[] = [];
        for (let index = 0; index < orderIds.length; index++) {
            const id = orderIds[index];
            const base = baseById.get(id);
            if (!base) continue;
            const edits = editsById[id] || {};

            const nextMeta = edits.metaJson ?? base.meta;
            const nextAnchor = Object.prototype.hasOwnProperty.call(edits, 'anchor') ? edits.anchor : base.anchor;

            // The generated RPC types currently model `anchor` as a string.
            // Represent "no anchor" as an empty string in staged rows.
            out.push({ ...base, sort: nextSortForIndex(index), meta: nextMeta, anchor: String(nextAnchor ?? '') });
        }
        return out;
    }, [baseSections, editsById, orderIds]);

    const move = (id: string, dir: -1 | 1) => {
        setOrderIds((prev) => {
            const idx = prev.indexOf(id);
            if (idx < 0) return prev;
            const swapIdx = idx + dir;
            if (swapIdx < 0 || swapIdx >= prev.length) return prev;
            const next = [...prev];
            const tmp = next[idx];
            next[idx] = next[swapIdx];
            next[swapIdx] = tmp;
            return next;
        });
    };

    const setAnchor = (id: string, anchor: string) => {
        setEditsById((prev) => ({
            ...prev,
            [id]: {
                ...(prev[id] || {}),
                anchor: anchor.trim() ? anchor : '',
            },
        }));
    };

    const setMetaText = (id: string, metaText: string) => {
        setEditsById((prev) => {
            const base = baseSections.find((s) => s.id === id);
            const raw = metaText;
            const trimmed = raw.trim();
            let metaJson: Json | undefined = undefined;
            let metaError: string | null = null;

            if (!trimmed) {
                metaJson = (base?.meta ?? {}) as Json;
            } else {
                try {
                    metaJson = JSON.parse(trimmed) as Json;
                } catch {
                    metaError = 'Invalid JSON';
                }
            }

            return {
                ...prev,
                [id]: {
                    ...(prev[id] || {}),
                    metaText: raw,
                    ...(metaJson !== undefined ? { metaJson } : {}),
                    metaError,
                },
            };
        });
    };

    const addSection = async () => {
        setError(null);
        setAuthError(null);

        setLoading(true);
        try {
            const sort = nextSortForIndex(orderIds.length);
            await rpcCreatePageSection({ pageKey, kind: addKind, sort, status: 'draft' });

            // The RPC returns only the UUID; re-fetch to obtain auto-populated pointers.
            // Merge preserves any local staged edits + ordering.
            const rows = await rpcGetPageSections(pageKey);
            mergeFetchedSections(rows);
        } catch (e: any) {
            const msg = e?.message || 'Failed to add section';
            if (isAuthErrorMessage(msg)) setAuthError(msg);
            else setError(msg);
        } finally {
            setLoading(false);
        }
    };

    const deleteSection = async (sectionId: string) => {
        setError(null);
        setAuthError(null);

        setLoading(true);
        try {
            await rpcDeletePageSection(pageKey, sectionId);
            setBaseSections((prev) => prev.filter((s) => s.id !== sectionId));
            setOrderIds((prev) => prev.filter((id) => id !== sectionId));
            setEditsById((prev) => {
                const next = { ...prev };
                delete next[sectionId];
                return next;
            });
        } catch (e: any) {
            const msg = e?.message || 'Failed to delete section';
            if (isAuthErrorMessage(msg)) setAuthError(msg);
            else setError(msg);
        } finally {
            setLoading(false);
        }
    };

    const saveAll = async () => {
        setSaving(true);
        setError(null);
        setAuthError(null);

        try {
            for (const [id, v] of Object.entries(editsById)) {
                if (v.metaError) throw new Error(`Fix JSON errors before saving (section ${id}).`);
            }

            const baseById = new Map(baseSections.map((s) => [s.id, s] as const));

            const payload = orderIds
                .map((id, index) => {
                    const base = baseById.get(id);
                    if (!base) return null;
                    if (base.kind !== 'hero' && base.kind !== 'richText' && base.kind !== 'media' && base.kind !== 'card_group') {
                        throw new Error(`Unsupported section kind: ${String(base.kind)}`);
                    }

                    const edits = editsById[id] || {};
                    const sort = nextSortForIndex(index);

                    // Important: NEVER omit these fields; missing keys can wipe pointers in the RPC.
                    const baseContent = ensureJsonObject(base.content_source as any, 'content_source', id);
                    const baseMedia = ensureJsonObject(base.media_source as any, 'media_source', id);
                    const { content_source, media_source } = withDefaultPointers({
                        kind: base.kind as CanonicalSectionKind,
                        sectionId: id,
                        content_source: baseContent,
                        media_source: baseMedia,
                    });
                    const meta = (edits.metaJson ?? base.meta ?? {}) as Json;

                    return {
                        id,
                        kind: base.kind,
                        sort,
                        status: 'published',
                        anchor: Object.prototype.hasOwnProperty.call(edits, 'anchor') ? edits.anchor : base.anchor,
                        meta,
                        content_source,
                        media_source,
                    };
                })
                .filter(Boolean) as Array<Record<string, any>>;

            await rpcUpsertPageSections(pageKey, payload);

            const rows = await rpcGetPageSections(pageKey);
            setEditsById({});
            mergeFetchedSections(rows);
        } catch (e: any) {
            const msg = e?.message || admin.t('admin.common.saveFailed', 'Save failed');
            if (isAuthErrorMessage(msg)) setAuthError(msg);
            else setError(msg);
        } finally {
            setSaving(false);
        }
    };

    const reloginHref = `/${locale}/adminlogin`;

    return (
        <Box data-admin-edit-ui="1">
            <Button variant="outlined" onClick={openWizard}>
                {admin.t('admin.pageComposer.open', 'Open Page Composer (Structure)')}
            </Button>

            <Dialog open={open} onClose={closeWizard} fullWidth maxWidth="lg">
                <DialogTitle>{admin.t('admin.pageComposer.title', 'Page Composer (Structure)')}</DialogTitle>
                <DialogContent sx={{ pt: 2 }}>
                    {authError ? (
                        <Alert
                            severity="warning"
                            action={
                                <Button color="inherit" size="small" href={reloginHref}>
                                    {admin.t('admin.auth.relogin', 'Re-login')}
                                </Button>
                            }
                            sx={{ mb: 2 }}
                        >
                            {admin.t('admin.auth.notAuthorized', 'Not authorized. Please re-login.')} {authError}
                        </Alert>
                    ) : null}
                    {error ? (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {error}
                        </Alert>
                    ) : null}

                    <Grid container spacing={2} sx={{ mt: 0.5 }}>
                        <Grid item xs={12} md={5}>
                            <Box sx={{ display: 'grid', gap: 2 }}>
                                <Typography variant="body2" color="text.secondary">
                                    {admin.t('admin.pageComposer.pageKey', 'Page key')}: <Box component="span" sx={{ fontFamily: 'monospace' }}>{pageKey}</Box>
                                </Typography>

                                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                                    <TextField
                                        size="small"
                                        label={admin.t('admin.pageComposer.add.kind', 'Add section')}
                                        value={addKind}
                                        onChange={(e) => setAddKind(e.target.value as CanonicalSectionKind)}
                                        select
                                        sx={{ minWidth: 220 }}
                                    >
                                        <MenuItem value="hero">Hero</MenuItem>
                                        <MenuItem value="richText">Rich text</MenuItem>
                                        <MenuItem value="media">Media</MenuItem>
                                        <MenuItem value="card_group">Card group</MenuItem>
                                    </TextField>
                                    <Button variant="contained" onClick={() => void addSection()} disabled={loading || saving}>
                                        {admin.t('admin.common.add', 'Add')}
                                    </Button>
                                    <Box sx={{ flex: 1 }} />
                                    <Button variant="outlined" onClick={load} disabled={loading || saving}>
                                        {admin.t('admin.common.refresh', 'Refresh')}
                                    </Button>
                                </Box>

                                {loading ? (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                        <CircularProgress size={18} />
                                        <Typography variant="body2">{admin.t('admin.common.loading', 'Loading…')}</Typography>
                                    </Box>
                                ) : null}

                                {!loading && !stagedSections.length ? (
                                    <Typography variant="body2" color="text.secondary">
                                        {admin.t('admin.pageComposer.empty', 'No sections yet. Add one.')}
                                    </Typography>
                                ) : null}

                                <Box sx={{ display: 'grid', gap: 1.5 }}>
                                    {stagedSections.map((s, idx) => {
                                        const edits = editsById[s.id] || {};
                                        const kindLabel =
                                            s.kind === 'hero'
                                                ? 'Hero'
                                                : s.kind === 'richText'
                                                    ? 'Rich text'
                                                    : s.kind === 'media'
                                                        ? 'Media'
                                                        : 'Card group';

                                        return (
                                            <Box
                                                key={s.id}
                                                sx={{
                                                    border: '1px solid',
                                                    borderColor: 'divider',
                                                    borderRadius: 1,
                                                    p: 1.5,
                                                    display: 'grid',
                                                    gap: 1,
                                                }}
                                            >
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                        {idx + 1}. {kindLabel}
                                                    </Typography>
                                                    <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                                                        {s.id}
                                                    </Typography>
                                                    <Box sx={{ flex: 1 }} />
                                                    <Button size="small" onClick={() => move(s.id, -1)} disabled={idx === 0 || loading || saving}>
                                                        {admin.t('admin.common.up', 'Up')}
                                                    </Button>
                                                    <Button
                                                        size="small"
                                                        onClick={() => move(s.id, 1)}
                                                        disabled={idx === stagedSections.length - 1 || loading || saving}
                                                    >
                                                        {admin.t('admin.common.down', 'Down')}
                                                    </Button>
                                                    <Button
                                                        size="small"
                                                        color="error"
                                                        onClick={() => void deleteSection(s.id)}
                                                        disabled={loading || saving}
                                                    >
                                                        {admin.t('admin.common.delete', 'Delete')}
                                                    </Button>
                                                </Box>

                                                <TextField
                                                    size="small"
                                                    label={admin.t('admin.pageComposer.anchor', 'Anchor (optional)')}
                                                    value={Object.prototype.hasOwnProperty.call(edits, 'anchor') ? String(edits.anchor ?? '') : String(s.anchor ?? '')}
                                                    onChange={(e) => setAnchor(s.id, e.target.value)}
                                                />

                                                <TextField
                                                    size="small"
                                                    label={admin.t('admin.pageComposer.meta', 'Meta (structure JSON)')}
                                                    value={
                                                        typeof edits.metaText === 'string'
                                                            ? edits.metaText
                                                            : JSON.stringify(s.meta ?? {}, null, 2)
                                                    }
                                                    onChange={(e) => setMetaText(s.id, e.target.value)}
                                                    multiline
                                                    minRows={3}
                                                    error={!!edits.metaError}
                                                    helperText={edits.metaError || ' '}
                                                />
                                            </Box>
                                        );
                                    })}
                                </Box>
                            </Box>
                        </Grid>

                        <Grid item xs={12} md={7}>
                            <Box
                                sx={{
                                    position: { md: 'sticky' },
                                    top: { md: 96 },
                                    maxHeight: { md: 'calc(100vh - 160px)' },
                                    overflow: { md: 'auto' },
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    borderRadius: 1,
                                    background: 'hsl(var(--background))',
                                }}
                                onClickCapture={(e) => {
                                    const target = e.target as HTMLElement | null;
                                    if (!target) return;
                                    const anchor = target.closest('a[href]') as HTMLAnchorElement | null;
                                    if (anchor) {
                                        e.preventDefault();
                                        e.stopPropagation();
                                    }
                                }}
                            >
                                <PagePreviewRenderer sections={stagedSections} />
                            </Box>
                        </Grid>
                    </Grid>
                </DialogContent>

                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={closeWizard} disabled={saving || loading}>
                        {admin.t('admin.common.cancel', 'Cancel')}
                    </Button>
                    <Button variant="contained" onClick={() => void saveAll()} disabled={saving || loading || !stagedSections.length}>
                        {saving ? admin.t('admin.common.saving', 'Saving…') : admin.t('admin.common.save', 'Save')}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
