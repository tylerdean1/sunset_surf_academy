import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminApi } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const gate = await requireAdminApi(req);
    if (!gate.ok) return gate.response;

    const url = new URL(req.url);
    const bucket = String(url.searchParams.get('bucket') || '').trim();
    const path = String(url.searchParams.get('path') || '').trim();
    const expiresIn = Math.max(30, Math.min(60 * 60, parseInt(String(url.searchParams.get('expiresIn') || '300'), 10) || 300));

    if (!bucket) return NextResponse.json({ ok: false, message: 'Missing bucket' }, { status: 400 });
    if (!path) return NextResponse.json({ ok: false, message: 'Missing path' }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);

    if (error) {
        return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, url: data?.signedUrl || '' }, { headers: { 'Cache-Control': 'private, no-store' } });
}
