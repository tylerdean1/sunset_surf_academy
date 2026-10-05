import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { processBookingNotifications } from '@/lib/server/bookingNotifications';
import { inspectBookingNotifications } from '@/lib/server/bookingNotificationStatus';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  const token = req.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  if (!token) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const { data, error } = await getSupabaseAdmin().rpc('verify_booking_worker_secret' as any, { p_token: token } as any);
    if (error || data !== true) return NextResponse.json({ ok: false }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    if (body.inspect === true) {
      if (typeof body.booking_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.booking_id)) {
        return NextResponse.json({ ok: false }, { status: 400 });
      }
      return NextResponse.json({ ok: true, notifications: await inspectBookingNotifications(body.booking_id) });
    }
    await processBookingNotifications();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Notification worker failed' }, { status: 503 });
  }
}
