import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/adminAuth';
import { inspectBookingNotifications } from '@/lib/server/bookingNotificationStatus';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  const gate = await requireAdminApi(req);
  if (!gate.ok) return gate.response;
  const bookingId = new URL(req.url).searchParams.get('booking_id') || '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bookingId)) {
    return NextResponse.json({ ok: false, message: 'Invalid booking ID' }, { status: 400 });
  }
  try {
    const notifications = await inspectBookingNotifications(bookingId);
    return NextResponse.json({ ok: true, notifications });
  } catch {
    return NextResponse.json({ ok: false, message: 'Could not load notification status' }, { status: 503 });
  }
}
