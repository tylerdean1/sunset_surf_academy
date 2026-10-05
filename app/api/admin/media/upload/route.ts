import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminApi } from '@/lib/adminAuth';
import { mediaErrorCode, mediaFailure, mediaSlotKey, mediaText, MediaValidationError, parseMediaAsset, savedMediaAsset } from '@/lib/adminMediaValidation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_BUCKETS = new Set(['Private_Photos', 'Lesson_Photos']);

function formString(form: FormData, key: string, fallback = ''): string {
    const value = form.get(key);
    if (value === null) return fallback;
    if (typeof value !== 'string') throw new MediaValidationError(`Invalid ${key}`);
    return value.trim();
}

function formBoolean(form: FormData, key: string, fallback: boolean): boolean {
    if (!form.has(key)) return fallback;
    const value = formString(form, key).toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(value)) return true;
    if (['0', 'false', 'no', 'off'].includes(value)) return false;
    throw new MediaValidationError(`Invalid ${key}`);
}

function uploadPath(path: string): string {
    mediaText(path, 'path', 1024);
    if (/[\u0000-\u001f\u007f]/.test(path) || path.split('/').some((part) => !part || part === '.' || part === '..')) {
        throw new MediaValidationError('Invalid upload path');
    }
    return path;
}

function splitBaseExt(fileName: string): { base: string; ext: string } {
    const index = fileName.lastIndexOf('.');
    return index <= 0 ? { base: fileName, ext: '' } : { base: fileName.slice(0, index), ext: fileName.slice(index) };
}

function chooseUniqueName(existing: Set<string>, base: string, ext: string): string {
    let name = `${base}${ext}`;
    let number = 1;
    while (existing.has(name)) name = `${base}(${number++})${ext}`;
    return name;
}

export async function POST(req: Request) {
    const gate = await requireAdminApi(req);
    if (!gate.ok) return gate.response;

    let form: FormData;
    try {
        form = await req.formData();
    } catch {
        return NextResponse.json({ ok: false, message: 'Expected multipart/form-data' }, { status: 400 });
    }

    const uploaded: Array<{ bucket: string; path: string; id: string }> = [];
    try {
        const bucket = formString(form, 'bucket');
        if (!ALLOWED_BUCKETS.has(bucket)) throw new MediaValidationError('Invalid bucket. Use Private_Photos or Lesson_Photos.');
        const folder = formString(form, 'folder').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
        if (folder) uploadPath(folder);
        const mode = formString(form, 'mode', 'single');
        if (mode !== 'single' && mode !== 'bulk') throw new MediaValidationError('Invalid mode');

        const entries = form.getAll('files');
        if (!entries.length || entries.length > 100 || entries.some((entry) => typeof entry === 'string' || !entry.size)) {
            throw new MediaValidationError('Upload from 1 to 100 nonempty files');
        }
        if (mode === 'single' && entries.length !== 1) throw new MediaValidationError('Single mode requires one file');
        const files = entries as File[];
        const assetKey = formString(form, 'asset_key');
        const assetKeyPrefix = formString(form, 'asset_key_prefix');
        if (assetKey) mediaSlotKey(assetKey);
        if (assetKeyPrefix) mediaSlotKey(`${assetKeyPrefix}.001`);
        const sortText = formString(form, 'sort', '32767');
        if (!/^-?[0-9]+$/.test(sortText)) throw new MediaValidationError('Invalid sort');

        // Validate all metadata and filenames before the first storage mutation.
        const { asset: metadata } = parseMediaAsset({
            title: mode === 'single' ? formString(form, 'title') : 'Upload',
            bucket,
            path: 'upload',
            public: formBoolean(form, 'public', bucket === 'Lesson_Photos'),
            category: formString(form, 'category', 'uncategorized'),
            asset_type: formString(form, 'asset_type', 'photo'),
            description: formString(form, 'description') || null,
            session_id: formString(form, 'session_id') || null,
            sort: Number(sortText),
        });
        const fileNames = files.map((file) => {
            const name = (file.name || 'file').replace(/^.*[\\/]/, '').trim();
            uploadPath(folder ? `${folder}/${name}` : name);
            return name;
        });

        const supabase = getSupabaseAdmin();
        const { data: existing, error: listError } = await supabase.storage.from(bucket).list(folder, { limit: 1000 });
        if (listError) return mediaFailure(null, 'Failed to list the upload folder');
        const existingNames = new Set((existing ?? []).map((entry) => entry.name));
        const pending = fileNames.map((fileName, index) => {
            const { base, ext } = splitBaseExt(fileName);
            const name = chooseUniqueName(existingNames, base, ext);
            existingNames.add(name);
            const path = uploadPath(folder ? `${folder}/${name}` : name);
            const key = mode === 'single' ? assetKey : assetKeyPrefix ? `${assetKeyPrefix}.${String(index + 1).padStart(3, '0')}` : '';
            return {
                file: files[index],
                path,
                // Bulk uploads derive a readable title within the asset title limit.
                asset: { ...metadata, path, title: mode === 'single' ? metadata.title : fileName.slice(0, 160) },
                slotKeys: key ? [mediaSlotKey(key)] : null,
            };
        });

        for (const item of pending) {
            const { error: uploadError } = await supabase.storage.from(bucket).upload(item.path, item.file, {
                upsert: false,
                contentType: item.file.type || undefined,
            });
            if (uploadError) return withUploaded(mediaFailure(null, 'Failed to upload media file'), uploaded);

            // Asset and slot publication commit together. The database assigns new IDs.
            const { data, error } = await (supabase as SupabaseClient).rpc('admin_save_media_asset', {
                p_asset: item.asset,
                p_slot_keys: item.slotKeys,
            });
            if (error) {
                // A SQLSTATE proves the transaction was rejected. Network/PostgREST
                // failures can have an unknown commit result, so retain the object.
                const code = mediaErrorCode(error);
                if (/^[0-9A-Z]{5}$/.test(code)) {
                    try { await supabase.storage.from(bucket).remove([item.path]); } catch { /* Retain on cleanup failure. */ }
                }
                return withUploaded(mediaFailure(error, 'Failed to save uploaded media; refresh Media before retrying'), uploaded);
            }
            const saved = savedMediaAsset(data);
            if (!saved?.id) return withUploaded(mediaFailure(null, 'Upload result could not be confirmed; refresh Media before retrying'), uploaded);
            uploaded.push({ bucket, path: item.path, id: saved.id });
        }
        return NextResponse.json({ ok: true, uploaded });
    } catch (error: unknown) {
        return withUploaded(mediaFailure(error, 'Upload result could not be confirmed; refresh Media before retrying'), uploaded);
    }
}

async function withUploaded(response: NextResponse, uploaded: Array<{ bucket: string; path: string; id: string }>): Promise<NextResponse> {
    const body = await response.json();
    return NextResponse.json({ ...body, uploaded }, { status: response.status });
}
