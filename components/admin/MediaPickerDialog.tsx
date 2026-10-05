'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    Checkbox,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Typography,
} from '@mui/material';
import useContentBundle from '@/hooks/useContentBundle';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { rpc } from '@/lib/rpc';
import { getAdminMediaSignedUrl as fetchSignedUrl } from '@/lib/adminMediaClient';

type AssetType = 'photo' | 'video';
type PhotoCategory = 'logo' | 'hero' | 'lessons' | 'web_content' | 'uncategorized';

type MediaAsset = {
    id: string;
    asset_key: string | null;
    title: string;
    description: string | null;
    public: boolean;
    bucket: string;
    path: string;
    category: PhotoCategory;
    asset_type: AssetType;
    sort: number;
    session_id: string | null;
    created_at: string | null;
    updated_at: string | null;
};

const CATEGORIES: Array<PhotoCategory | 'all'> = ['all', 'logo', 'hero', 'lessons', 'web_content', 'uncategorized'];
const BUCKETS: Array<string | 'all'> = ['all', 'Lesson_Photos', 'Private_Photos'];

async function fetchAssets(): Promise<MediaAsset[]> {
    const supabase = getSupabaseClient();
    const rows = await rpc<MediaAsset[]>(supabase, 'admin_list_media_assets_with_key');
    return (rows || []) as MediaAsset[];
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
    const results: R[] = new Array(items.length);
    let nextIndex = 0;

    async function worker() {
        while (true) {
            const idx = nextIndex++;
            if (idx >= items.length) return;
            results[idx] = await fn(items[idx]);
        }
    }

    const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, () => worker());
    await Promise.all(workers);
    return results;
}

export type MediaSelection = {
    id: string;
    assetKey: string | null;
    bucket: string;
    path: string;
    previewUrl: string;
};

export default function MediaPickerDialog({
    open,
    onClose,
    onSelect,
    defaultCategory = 'all',
}: {
    open: boolean;
    onClose: () => void;
    onSelect: (selection: MediaSelection) => void;
    defaultCategory?: PhotoCategory | 'all';
}) {
    const admin = useContentBundle('admin.');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [items, setItems] = useState<MediaAsset[]>([]);

    const [category, setCategory] = useState<PhotoCategory | 'all'>(defaultCategory);
    const [bucket, setBucket] = useState<string | 'all'>('all');

    const [selectedKey, setSelectedKey] = useState<string | null>(null);
    const [previewByKey, setPreviewByKey] = useState<Record<string, string>>({});

    useEffect(() => {
        if (!open) return;
        setCategory(defaultCategory);
        setBucket('all');
        setSelectedKey(null);
        setPreviewByKey({});

        let cancelled = false;
        setLoading(true);
        setError(null);

        (async () => {
            try {
                const list = await fetchAssets();
                if (cancelled) return;
                setItems(list);
            } catch (e: any) {
                if (cancelled) return;
                setError(e?.message || admin.t('admin.mediaPicker.errors.loadFailed', 'Failed to load media'));
                setItems([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [open, defaultCategory]);

    const filtered = useMemo(() => {
        return items.filter((i) => {
            if (category !== 'all' && i.category !== category) return false;
            if (bucket !== 'all' && i.bucket !== bucket) return false;
            return true;
        });
    }, [items, category, bucket]);

    const countLabel = useMemo(() => {
        const tmpl = admin.t('admin.mediaPicker.count', '{count} item(s)');
        return tmpl.replace('{count}', String(filtered.length));
    }, [admin, filtered.length]);

    // Prefetch thumbnails for the first 24 visible photos.
    useEffect(() => {
        if (!open) return;
        const need = filtered
            .filter((i) => i.asset_type === 'photo')
            .slice(0, 24)
            .filter((i) => !previewByKey[`${i.bucket}/${i.path}`]);

        if (!need.length) return;

        let cancelled = false;
        (async () => {
            try {
                const keys = need.map((i) => `${i.bucket}/${i.path}`);
                const urls = await mapWithConcurrency(need, 6, (i) => fetchSignedUrl(i.bucket, i.path));
                if (cancelled) return;
                setPreviewByKey((prev) => {
                    const next = { ...prev };
                    keys.forEach((k, idx) => {
                        next[k] = urls[idx] || '';
                    });
                    return next;
                });
            } catch {
                // Ignore thumbnail failures; user can still select by path/title.
            }
        })();

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, filtered]);

    const selected = useMemo(() => {
        if (!selectedKey) return null;
        const [b, ...rest] = selectedKey.split('/');
        const p = rest.join('/');
        const previewUrl = previewByKey[selectedKey] || '';
        const match = filtered.find((i) => i.bucket === b && i.path === p) || null;
        return {
            id: match?.id || '',
            assetKey: match?.asset_key ?? null,
            bucket: b,
            path: p,
            previewUrl,
        } as MediaSelection;
    }, [selectedKey, previewByKey, filtered]);

    const confirm = () => {
        if (!selected) {
            setError(admin.t('admin.mediaPicker.errors.selectFirst', 'Select an item first.'));
            return;
        }
        onSelect(selected);
        onClose();
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>{admin.t('admin.mediaPicker.title', 'Select Media')}</DialogTitle>
            <DialogContent sx={{ display: 'grid', gap: 2, pt: 2 }}>
                {error ? <Alert severity="error">{error}</Alert> : null}

                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <FormControl size="small" sx={{ minWidth: 220 }}>
                        <InputLabel id="media-picker-category">{admin.t('admin.mediaPicker.fields.category', 'Category')}</InputLabel>
                        <Select
                            labelId="media-picker-category"
                            label={admin.t('admin.mediaPicker.fields.category', 'Category')}
                            value={category}
                            onChange={(e) => setCategory(e.target.value as any)}
                        >
                            {CATEGORIES.map((c) => (
                                <MenuItem key={c} value={c}>
                                    {c}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <FormControl size="small" sx={{ minWidth: 220 }}>
                        <InputLabel id="media-picker-bucket">{admin.t('admin.mediaPicker.fields.bucket', 'Bucket')}</InputLabel>
                        <Select
                            labelId="media-picker-bucket"
                            label={admin.t('admin.mediaPicker.fields.bucket', 'Bucket')}
                            value={bucket}
                            onChange={(e) => setBucket(String(e.target.value))}
                        >
                            {BUCKETS.map((b) => (
                                <MenuItem key={b} value={b}>
                                    {b}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <Box sx={{ flex: 1 }} />
                    <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center' }}>
                        {loading ? admin.t('admin.common.loading', 'Loading…') : admin.t('admin.mediaPicker.count', `${filtered.length} item(s)`)}
                        {loading ? admin.t('admin.common.loading', 'Loading…') : countLabel}
                    </Typography>
                </Box>

                <Box sx={{ overflowX: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell padding="checkbox">{admin.t('admin.mediaPicker.table.select', 'Select')}</TableCell>
                                <TableCell>{admin.t('admin.mediaPicker.table.preview', 'Preview')}</TableCell>
                                <TableCell>{admin.t('admin.mediaPicker.table.assetKey', 'Asset Key')}</TableCell>
                                <TableCell>{admin.t('admin.mediaPicker.table.title', 'Title')}</TableCell>
                                <TableCell>{admin.t('admin.mediaPicker.table.category', 'Category')}</TableCell>
                                <TableCell>{admin.t('admin.mediaPicker.table.bucketPath', 'Bucket / Path')}</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filtered.map((i) => {
                                const key = `${i.bucket}/${i.path}`;
                                const checked = selectedKey === key;
                                const previewUrl = previewByKey[key] || '';
                                return (
                                    <TableRow key={i.id} hover>
                                        <TableCell padding="checkbox">
                                            <Checkbox
                                                checked={checked}
                                                onChange={(e) => setSelectedKey(e.target.checked ? key : null)}
                                            />
                                        </TableCell>
                                        <TableCell sx={{ width: 88 }}>
                                            {i.asset_type === 'photo' && previewUrl ? (
                                                <Box
                                                    component="img"
                                                    src={previewUrl}
                                                    alt={i.title}
                                                    sx={{ width: 72, height: 48, objectFit: 'cover', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}
                                                />
                                            ) : (
                                                <Box component="span" sx={{ color: 'text.disabled' }}>
                                                    {admin.t('admin.common.none', '—')}
                                                </Box>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Box sx={{ fontFamily: 'monospace', fontSize: 12 }}>{i.asset_key || '—'}</Box>
                                        </TableCell>
                                        <TableCell>{i.title}</TableCell>
                                        <TableCell>{i.category}</TableCell>
                                        <TableCell>
                                            <Box sx={{ fontFamily: 'monospace', fontSize: 12 }}>
                                                {i.bucket}/{i.path}
                                            </Box>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}

                            {!loading && !filtered.length ? (
                                <TableRow>
                                    <TableCell colSpan={6}>
                                        <Typography color="text.secondary">
                                            {admin.t('admin.mediaPicker.empty', 'No media matches your filters.')}
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            ) : null}
                        </TableBody>
                    </Table>
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>{admin.t('admin.common.cancel', 'Cancel')}</Button>
                <Button variant="contained" onClick={confirm} disabled={!selectedKey}>
                    {admin.t('admin.mediaPicker.actions.select', 'Select')}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
