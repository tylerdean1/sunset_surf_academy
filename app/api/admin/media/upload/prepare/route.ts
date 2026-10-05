import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { mediaFailure, MediaValidationError } from '@/lib/adminMediaValidation';
import { prepareMediaUpload, readMediaUploadJson, sealMediaUpload } from '@/lib/server/adminMediaUpload';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    const gate = await requireAdminApi(req);
    if (!gate.ok) return gate.response;
    try {
        const reservation = prepareMediaUpload(await readMediaUploadJson(req), gate.userId);
        const supabase = getSupabaseAdmin();
        const { data: bucket, error: bucketError } = await supabase.storage.getBucket(reservation.asset.bucket);
        if (bucketError || !bucket) return mediaFailure(null, 'Failed to prepare upload');
        if (bucket.file_size_limit != null && reservation.size > Number(bucket.file_size_limit)) {
            throw new MediaValidationError('File exceeds the storage bucket size limit');
        }
        if (bucket.allowed_mime_types?.length && !bucket.allowed_mime_types.some(type =>
            type === reservation.contentType || (type.endsWith('/*') && reservation.contentType.startsWith(type.slice(0, -1))))) {
            throw new MediaValidationError('File type is not allowed in this bucket');
        }
        const sealed = sealMediaUpload(reservation);
        const { data, error } = await supabase.storage.from(reservation.asset.bucket).createSignedUploadUrl(reservation.asset.path, { upsert: false });
        if (error || !data?.token) return mediaFailure(null, 'Failed to prepare upload');
        return NextResponse.json({ ok: true, bucket: reservation.asset.bucket, path: reservation.asset.path, token: data.token,
            content_type: reservation.contentType, reservation: sealed });
    } catch (error: unknown) {
        return mediaFailure(error, 'Failed to prepare upload');
    }
}
