'use client';

import * as React from 'react';
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import { useLocale } from 'next-intl';
import { useCmsStringValue } from '@/hooks/useCmsStringValue';
import MediaPickerDialog, { type MediaSelection } from '@/components/admin/MediaPickerDialog';
import useContentBundle from '@/hooks/useContentBundle';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { rpc } from '@/lib/rpc';

type SlotItem = {
    slot_key: string;
    sort: number | null;
    asset_id: string | null;
    asset: {
        id: string;
        title: string;
        bucket: string;
        path: string;
        public: boolean;
        asset_type: 'photo' | 'video';
        category: string;
    } | null;
};

function clampCount(n: number) {
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(100, Math.floor(n)));
}

export default function GalleryMediaSlotsEditor() {
    const locale = useLocale();
    const admin = useContentBundle('admin.');

    const { value: countValue } = useCmsStringValue('page.gallery.images.count', '12');
    const parsedCount = clampCount(Number(countValue));

    const [countDraft, setCountDraft] = React.useState(String(parsedCount));
    const [savingCount, setSavingCount] = React.useState(false);
    const [countError, setCountError] = React.useState<string | null>(null);

    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [items, setItems] = React.useState<SlotItem[]>([]);

    const [draftBySlot, setDraftBySlot] = React.useState<Record<string, MediaSelection | null>>({});
    const [dirty, setDirty] = React.useState(false);

    const [pickerOpenFor, setPickerOpenFor] = React.useState<string | null>(null);
    const [busySlot, setBusySlot] = React.useState<string | null>(null);

    const prefix = 'gallery.images.';

    const load = React.useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const supabase = getSupabaseClient();
            const rows = await rpc<any[]>(supabase, 'admin_list_media_slots_by_prefix', { p_prefix: prefix });
            const next = (rows || []).map((r) => {
                const assetId = r?.asset_id ? String(r.asset_id) : null;
                const hasAsset = Boolean(assetId);
                return {
                    slot_key: String(r?.slot_key || ''),
                    sort: r?.sort ?? null,
                    asset_id: assetId,
                    asset: hasAsset
                        ? {
                            id: assetId as string,
                            title: String(r?.asset_title || ''),
                            bucket: String(r?.asset_bucket || ''),
                            path: String(r?.asset_path || ''),
                            public: Boolean(r?.asset_public),
                            asset_type: (String(r?.asset_type || 'photo') as any) as 'photo' | 'video',
                            category: String(r?.asset_category || ''),
                        }
                        : null,
                } as SlotItem;
            });
            setItems(next);
        } catch (e: any) {
            setError(e?.message || admin.t('admin.gallerySlots.errors.loadFailed', 'Failed to load gallery slots'));
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        void load();
    }, [load]);

    React.useEffect(() => {
        // keep draft in sync when DB value changes
        setCountDraft(String(parsedCount));
    }, [parsedCount]);

    React.useEffect(() => {
        // Rehydrate staged selections from DB after load.
        const next: Record<string, MediaSelection | null> = {};
        for (const it of items) {
            if (!it?.slot_key) continue;
            if (it.asset_id && it.asset) {
                next[it.slot_key] = {
                    id: it.asset_id,
                    assetKey: null,
                    bucket: it.asset.bucket,
                    path: it.asset.path,
                    previewUrl: '',
                };
            } else {
                next[it.slot_key] = null;
            }
        }
        setDraftBySlot(next);
        setDirty(false);
    }, [items]);

    const bySlotKey = React.useMemo(() => {
        const map = new Map<string, SlotItem>();
        for (const it of items) map.set(it.slot_key, it);
        return map;
    }, [items]);

    const count = clampCount(Number(countDraft));

    const slots = React.useMemo(() => {
        return Array.from({ length: count }, (_, i) => `${prefix}${i}`);
    }, [count]);

    const saveAll = async () => {
        setSavingCount(true);
        setCountError(null);
        setError(null);
        try {
            await rpc<void>(getSupabaseClient(), 'admin_save_content_bundle', {
                p_strings: [{ key: 'page.gallery.images.count', locale: locale === 'es' ? 'es' : 'en', body: String(count) }],
                p_media: [{
                    prefix,
                    slots: Array.from({ length: count }, (_, index) => ({
                        slot_key: `${prefix}${index}`,
                        asset_id: draftBySlot[`${prefix}${index}`]?.id ?? null,
                        sort: index,
                    })),
                }],
            });

            await load();
        } catch (e: any) {
            const msg = e?.message || admin.t('admin.gallerySlots.errors.saveFailed', 'Failed to save gallery');
            setCountError(msg);
        } finally {
            setSavingCount(false);
        }
    };

    const stageSlot = async (slotKey: string, selection: MediaSelection | null) => {
        setBusySlot(slotKey);
        setError(null);
        try {
            setDraftBySlot((prev) => ({ ...prev, [slotKey]: selection }));
            setDirty(true);
        } catch (e: any) {
            setError(e?.message || admin.t('admin.gallerySlots.errors.updateSlotFailed', 'Failed to update slot'));
        } finally {
            setBusySlot(null);
        }
    };

    return (
        <Box data-admin-edit-ui="1" sx={{ mt: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <Typography variant="h6">{admin.t('admin.gallerySlots.title', 'Gallery Photos')}</Typography>
                <Box sx={{ flex: 1 }} />
                <Button variant="outlined" onClick={load} disabled={loading}>
                    {admin.t('admin.common.refresh', 'Refresh')}
                </Button>
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {admin.t(
                    'admin.gallerySlots.subtitle',
                    'Controls which media appears on the Gallery page by writing slot keys under gallery.images.*.'
                )}
            </Typography>

            {error ? (
                <Alert severity="error" sx={{ mt: 2 }}>
                    {error}
                </Alert>
            ) : null}

            <Box sx={{ mt: 2, display: 'flex', gap: 1.5, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <TextField
                    label={admin.t('admin.gallerySlots.countLabel', 'How many photos to show')}
                    size="small"
                    value={countDraft}
                    onChange={(e) => setCountDraft(e.target.value.replace(/[^0-9]/g, ''))}
                    sx={{ width: 220 }}
                    inputProps={{ inputMode: 'numeric' }}
                />
                <Button variant="contained" onClick={saveAll} disabled={savingCount}>
                    {savingCount ? admin.t('admin.common.saving', 'Saving…') : admin.t('admin.common.save', 'Save')}
                </Button>
                {countError ? (
                    <Alert severity="error" sx={{ py: 0.25, px: 1.5 }}>
                        {countError}
                    </Alert>
                ) : null}
                {dirty && !savingCount ? (
                    <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center' }}>
                        {admin.t('admin.gallerySlots.unsaved', 'Unsaved changes')}
                    </Typography>
                ) : null}
            </Box>

            {loading ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2 }}>
                    <CircularProgress size={18} />
                    <Typography variant="body2">{admin.t('admin.gallerySlots.loadingSlots', 'Loading slots…')}</Typography>
                </Box>
            ) : null}

            <Stack spacing={1} sx={{ mt: 2 }}>
                {slots.map((slotKey) => {
                    const it = bySlotKey.get(slotKey) || null;
                    const staged = draftBySlot[slotKey] ?? null;
                    const title =
                        staged?.id
                            ? (it?.asset?.title || admin.t('admin.gallerySlots.selected', 'Selected'))
                            : admin.t('admin.gallerySlots.noneSelected', 'None selected');
                    const disabled = busySlot === slotKey;

                    return (
                        <Box
                            key={slotKey}
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1.5,
                                p: 1.25,
                                border: '1px solid',
                                borderColor: 'divider',
                                borderRadius: 1,
                                flexWrap: 'wrap',
                            }}
                        >
                            <Box sx={{ minWidth: 220 }}>
                                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                    {slotKey}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {title}
                                </Typography>
                            </Box>

                            <Box sx={{ flex: 1 }} />

                            <Button variant="outlined" onClick={() => setPickerOpenFor(slotKey)} disabled={disabled}>
                                {admin.t('admin.gallerySlots.actions.choose', 'Choose')}
                            </Button>
                            <Button
                                variant="outlined"
                                color="inherit"
                                onClick={() => void stageSlot(slotKey, null)}
                                disabled={disabled || !staged?.id}
                            >
                                {admin.t('admin.gallerySlots.actions.clear', 'Clear')}
                            </Button>
                            {disabled ? <CircularProgress size={18} /> : null}
                        </Box>
                    );
                })}
            </Stack>

            <Dialog open={false} />

            <MediaPickerDialog
                open={!!pickerOpenFor}
                onClose={() => setPickerOpenFor(null)}
                onSelect={(selection) => {
                    const slotKey = pickerOpenFor;
                    setPickerOpenFor(null);
                    if (!slotKey) return;
                    void stageSlot(slotKey, selection);
                }}
            />
        </Box>
    );
}
