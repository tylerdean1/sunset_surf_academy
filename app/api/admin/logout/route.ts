import { NextResponse } from 'next/server';
import { clearAdminAuthCookies } from '@/lib/adminAuth';
import { sameOrigin } from '@/lib/adminOrigin';

export function POST(req: Request) {
    if (!sameOrigin(req)) {
        return NextResponse.json({ ok: false, message: 'Bad origin' }, { status: 403 });
    }
    const res = NextResponse.json({ ok: true });
    clearAdminAuthCookies(res);
    return res;
}
