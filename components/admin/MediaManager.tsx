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
    TextField,
    Typography,
} from '@mui/material';
import useContentBundle from '@/hooks/useContentBundle';
import { getAdminMediaSignedUrl as getSignedUrl } from '@/lib/adminMediaClient';
import { invalidateContentCache } from '@/lib/contentCache';

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

const CATEGORIES: PhotoCategory[] = ['logo', 'hero', 'lessons', 'web_content', 'uncategorized'];
const ASSET_TYPES: AssetType[] = ['photo', 'video'];

export default function MediaManager() {
    const admin = useContentBundle('admin.');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [items, setItems] = useState<MediaAsset[]>([]);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<MediaAsset | null>(null);

    const [title, setTitle] = useState('');
    const [assetKey, setAssetKey] = useState('');
    const [description, setDescription] = useState('');
    const [bucket, setBucket] = useState('');
    const [path, setPath] = useState('');
    const [category, setCategory] = useState<PhotoCategory>('web_content');
    const [assetType, setAssetType] = useState<AssetType>('photo');
    const [isPublic, setIsPublic] = useState(true);
    const [sort, setSort] = useState<number>(32767);
    const [sessionId, setSessionId] = useState('');

    const resetForm = () => {
        setEditing(null);
        setTitle('');
        setAssetKey('');
        setDescription('');
        setBucket('');
        setPath('');
        setCategory('web_content');
        setAssetType('photo');
        setIsPublic(true);
        setSort(32767);
        setSessionId('');
    };

    const openAdd = () => {
        resetForm();
        setDialogOpen(true);
    };

    const openEdit = (item: MediaAsset) => {
        setEditing(item);
        setTitle(item.title);
        setAssetKey(item.asset_key ?? '');
        setDescription(item.description ?? '');
        setBucket(item.bucket);
        setPath(item.path);
        setCategory(item.category);
        setAssetType(item.asset_type);
        setIsPublic(item.public);
        setSort(item.sort);
        setSessionId(item.session_id ?? '');
        setDialogOpen(true);
    };

    const load = async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/admin/media/assets', { cache: 'no-store' });
            const body = await response.json().catch(() => null);
            if (!response.ok || !body?.ok || !Array.isArray(body.items)) throw new Error(body?.message || 'Failed to load media');
            setItems(body.items as MediaAsset[]);
        } catch (e: any) {
            setError(e?.message || admin.t('admin.media.errors.loadFailed', 'Load failed'));
            setItems([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const categoryLabel = (c: PhotoCategory) => {
        const key = `admin.media.category.${c}`;
        const fallback = c === 'web_content' ? 'Web content' : c === 'uncategorized' ? 'Uncategorized' : c;
        return admin.t(key, fallback);
    };

    const typeLabel = (t: AssetType) => {
        const key = `admin.media.type.${t}`;
        const fallback = t === 'photo' ? 'Photo' : t === 'video' ? 'Video' : t;
        return admin.t(key, fallback);
    };

    const rows = useMemo(() => items, [items]);

    const save = async () => {
        setLoading(true);
        setError(null);

        try {
            const titleTrim = String(title || '').trim();
            const bucketTrim = String(bucket || '').trim();
            const pathTrim = String(path || '').trim();
            if (!titleTrim) throw new Error('Missing title');
            if (!bucketTrim) throw new Error('Missing bucket');
            if (!pathTrim) throw new Error('Missing path');

            const response = await fetch('/api/admin/media/assets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ op: 'upsert', asset: {
                    id: editing?.id || undefined,
                    title: titleTrim,
                    description: description || null,
                    public: isPublic,
                    bucket: bucketTrim,
                    path: pathTrim,
                    category,
                    asset_type: assetType,
                    sort,
                    session_id: sessionId.trim() || null,
                    asset_key: assetKey.trim() || null,
                } }),
            });
            const body = await response.json().catch(() => null);
            if (!response.ok || !body?.ok || !body?.item?.id) throw new Error(body?.message || 'Failed to save media');
            invalidateContentCache();
            setDialogOpen(false);
            resetForm();
            await load();
        } catch (e: any) {
            setError(e?.message || admin.t('admin.media.errors.saveFailed', 'Save failed'));
        } finally {
            setLoading(false);
        }
    };

    const openPreview = async (b: string, p: string) => {
        try {
            const url = await getSignedUrl(b, p);
            if (url) window.open(url, '_blank', 'noopener,noreferrer');
        } catch (e: any) {
            setError(e?.message || admin.t('admin.media.errors.previewFailed', 'Preview failed'));
        }
    };

    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <Typography variant="h6">{admin.t('admin.media.title', 'Media')}</Typography>
                <Box sx={{ flex: 1 }} />
                <Button variant="outlined" onClick={load} disabled={loading}>
                    {admin.t('admin.common.refresh', 'Refresh')}
                </Button>
                <Button variant="contained" onClick={openAdd} sx={{ backgroundColor: '#20B2AA' }}>
                    {admin.t('admin.media.actions.add', 'Add Media')}
                </Button>
            </Box>

            {error ? (
                <Alert severity="error" sx={{ mt: 2 }}>
                    {error}
                </Alert>
            ) : null}

            <Box sx={{ mt: 2, overflowX: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>{admin.t('admin.media.table.assetKey', 'Asset Key')}</TableCell>
                            <TableCell>{admin.t('admin.media.table.title', 'Title')}</TableCell>
                            <TableCell>{admin.t('admin.media.table.category', 'Category')}</TableCell>
                            <TableCell>{admin.t('admin.media.table.type', 'Type')}</TableCell>
                            <TableCell>{admin.t('admin.media.table.showOnWebsite', 'Show on website')}</TableCell>
                            <TableCell>{admin.t('admin.media.table.bucketPath', 'Bucket / Path')}</TableCell>
                            <TableCell>{admin.t('admin.media.table.sort', 'Sort')}</TableCell>
                            <TableCell>{admin.t('admin.media.table.preview', 'Preview')}</TableCell>
                            <TableCell align="right">{admin.t('admin.media.table.actions', 'Actions')}</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {rows.map((i) => (
                            <TableRow key={i.id}>
                                <TableCell>
                                    <Box sx={{ fontFamily: 'monospace', fontSize: 12 }}>
                                        {i.asset_key || admin.t('admin.common.none', '—')}
                                    </Box>
                                </TableCell>
                                <TableCell>{i.title}</TableCell>
                                <TableCell>{categoryLabel(i.category)}</TableCell>
                                <TableCell>{typeLabel(i.asset_type)}</TableCell>
                                <TableCell>
                                    {i.public ? admin.t('admin.common.yes', 'Yes') : admin.t('admin.common.no', 'No')}
                                </TableCell>
                                <TableCell>
                                    <Box sx={{ fontFamily: 'monospace', fontSize: 12 }}>
                                        {i.bucket}/{i.path}
                                    </Box>
                                </TableCell>
                                <TableCell>{i.sort}</TableCell>
                                <TableCell>
                                    <Button size="small" onClick={() => openPreview(i.bucket, i.path)}>
                                        {admin.t('admin.media.actions.open', 'Open')}
                                    </Button>
                                </TableCell>
                                <TableCell align="right">
                                    <Button size="small" onClick={() => openEdit(i)}>
                                        {admin.t('admin.media.actions.edit', 'Edit')}
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                        {!rows.length ? (
                            <TableRow>
                                <TableCell colSpan={9}>
                                    <Typography color="text.secondary">
                                        {loading
                                            ? admin.t('admin.common.loading', 'Loading…')
                                            : admin.t('admin.media.empty', 'No media yet.')}
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        ) : null}
                    </TableBody>
                </Table>
            </Box>

            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>
                    {editing ? admin.t('admin.media.dialog.editTitle', 'Edit Media') : admin.t('admin.media.dialog.addTitle', 'Add Media')}
                </DialogTitle>
                <DialogContent sx={{ display: 'grid', gap: 2, pt: 2 }}>
                    <TextField
                        label={admin.t('admin.media.fields.assetKey', 'Asset Key (stable pointer)')}
                        value={assetKey}
                        onChange={(e) => setAssetKey(e.target.value)}
                        fullWidth
                        helperText={admin.t('admin.media.fields.assetKeyHelp', 'Example: home.hero or home.photo_stream.001')}
                    />
                    <TextField
                        label={admin.t('admin.media.fields.title', 'Title')}
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        fullWidth
                    />
                    <TextField
                        label={admin.t('admin.media.fields.description', 'Description')}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        fullWidth
                        multiline
                        minRows={3}
                    />

                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                        <TextField
                            label={admin.t('admin.media.fields.bucket', 'Bucket')}
                            value={bucket}
                            onChange={(e) => setBucket(e.target.value)}
                            fullWidth
                        />
                        <TextField
                            label={admin.t('admin.media.fields.path', 'Path')}
                            value={path}
                            onChange={(e) => setPath(e.target.value)}
                            fullWidth
                        />
                    </Box>

                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                        <FormControl fullWidth>
                            <InputLabel id="media-category">{admin.t('admin.media.fields.category', 'Category')}</InputLabel>
                            <Select
                                labelId="media-category"
                                label={admin.t('admin.media.fields.category', 'Category')}
                                value={category}
                                onChange={(e) => setCategory(e.target.value as PhotoCategory)}
                            >
                                {CATEGORIES.map((c) => (
                                    <MenuItem key={c} value={c}>
                                        {categoryLabel(c)}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <FormControl fullWidth>
                            <InputLabel id="media-type">{admin.t('admin.media.fields.type', 'Type')}</InputLabel>
                            <Select
                                labelId="media-type"
                                label={admin.t('admin.media.fields.type', 'Type')}
                                value={assetType}
                                onChange={(e) => setAssetType(e.target.value as AssetType)}
                            >
                                {ASSET_TYPES.map((t) => (
                                    <MenuItem key={t} value={t}>
                                        {typeLabel(t)}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Box>

                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, alignItems: 'center' }}>
                        <TextField
                            label={admin.t('admin.media.fields.sort', 'Sort')}
                            type="number"
                            value={String(sort)}
                            onChange={(e) => setSort(parseInt(e.target.value || '0', 10))}
                            fullWidth
                        />
                        <TextField
                            label={admin.t('admin.media.fields.sessionId', 'Session ID (optional)')}
                            value={sessionId}
                            onChange={(e) => setSessionId(e.target.value)}
                            fullWidth
                        />
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Checkbox checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
                        <Typography>{admin.t('admin.media.fields.showOnWebsite', 'Show on website')}</Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                        {admin.t('admin.media.visibilityHint', 'This controls whether the website displays this media. Files in a public storage bucket remain accessible through their existing URLs when hidden.')}
                    </Typography>

                    {bucket && path ? (
                        <Typography variant="body2" color="text.secondary">
                            {admin.t('admin.media.previewHint', 'Preview uses a signed URL (works for private buckets).')}
                        </Typography>
                    ) : null}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogOpen(false)}>{admin.t('admin.common.cancel', 'Cancel')}</Button>
                    <Button variant="contained" onClick={save} disabled={loading} sx={{ backgroundColor: '#20B2AA' }}>
                        {admin.t('admin.common.save', 'Save')}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
