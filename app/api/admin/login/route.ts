import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';
import { setAdminAccessTokenCookie } from '@/lib/adminAuth';
import { sameOrigin } from '@/lib/adminOrigin';

export async function POST(req: Request) {
    if (!sameOrigin(req)) {
        return NextResponse.json({ ok: false, message: 'Bad origin' }, { status: 403 });
    }
    try {
        const body = await req.json();
        const accessToken = String(body?.access_token || '');

        if (!accessToken) {
            return NextResponse.json({ ok: false, message: 'Missing access token' }, { status: 400 });
        }

        let supabaseAdmin;
        try {
            supabaseAdmin = getSupabaseAdmin();
        } catch (e: any) {
            return NextResponse.json(
                { ok: false, message: e?.message || 'Server is missing Supabase service configuration' },
                { status: 500 }
            );
        }

        // Validate access token with Supabase admin client
        const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
        if (error || !data?.user) {
            return NextResponse.json({ ok: false, message: 'Invalid token or user not found' }, { status: 401 });
        }

        const user = data.user;
        // DB-driven admin check (matches public.is_admin(): admin_users.id = auth.uid())
        const { data: adminRow, error: adminErr } = await supabaseAdmin
            .from('admin_users')
            .select('id')
            .eq('id', user.id)
            .maybeSingle();

        if (adminErr) {
            return NextResponse.json({ ok: false, message: 'Failed to validate admin user' }, { status: 500 });
        }

        const isAdmin = !!adminRow?.id;

        if (!isAdmin) {
            return NextResponse.json({ ok: false, message: 'User is not an admin' }, { status: 403 });
        }

        const res = NextResponse.json({ ok: true });
        setAdminAccessTokenCookie(res, accessToken);
        return res;
    } catch (err) {
        return NextResponse.json({ ok: false, message: 'Invalid request' }, { status: 400 });
    }
}
