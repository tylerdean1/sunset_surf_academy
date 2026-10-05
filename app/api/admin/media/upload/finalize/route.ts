import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireAdminApi } from '@/lib/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { mediaFailure, mediaObject, MediaValidationError, savedMediaAsset } from '@/lib/adminMediaValidation';
import { openMediaUpload, readMediaUploadJson } from '@/lib/server/adminMediaUpload';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    const gate = await requireAdminApi(req);
    if (!gate.ok) return gate.response;
    try {
        const input = mediaObject(await readMediaUploadJson(req, 256 * 1024), 'upload request');
        const reservation = openMediaUpload(input.reservation, gate.userId);
        const supabase = getSupabaseAdmin();
        const { data: info, error: infoError } = await supabase.storage.from(reservation.asset.bucket).info(reservation.asset.path);
        if (infoError) {
            const providerError: unknown = infoError;
            const fields = providerError && typeof providerError === 'object' ? providerError as Record<string, unknown> : {};
            const status = Number(fields.status ?? fields.statusCode ?? 0);
            if (status === 400 || status === 404) throw new MediaValidationError('Uploaded file could not be found; upload it before publishing');
            return mediaFailure(null, 'Failed to verify uploaded file; retry publication');
        }
        if (!info) return mediaFailure(null, 'Failed to verify uploaded file; retry publication');
        if (info.size !== reservation.size || info.contentType !== reservation.contentType) {
            throw new MediaValidationError('Uploaded file size/type does not match the prepared upload');
        }
        const { data, error } = await (supabase as SupabaseClient).rpc('admin_save_media_asset', {
            p_asset: reservation.asset,
            p_slot_keys: reservation.slotKeys,
        });
        if (error) return mediaFailure(error, 'Upload publication could not be confirmed; refresh Media before retrying');
        const saved = savedMediaAsset(data);
        if (!saved?.id) return mediaFailure(null, 'Upload publication could not be confirmed; refresh Media before retrying');
        return NextResponse.json({ ok: true, uploaded: [{ bucket: saved.bucket, path: saved.path, id: saved.id }] });
    } catch (error: unknown) {
        return mediaFailure(error, 'Upload publication could not be confirmed; refresh Media before retrying');
    }
}
