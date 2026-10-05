import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { sendBookingEmail, type BookingEmailData } from '@/lib/server/bookingEmail';

type Notification = { id: string; booking_id: string; recipient_kind: 'admin' | 'customer'; payload: BookingEmailData; lease_token: string };

export async function processBookingNotifications(bookingId?: string): Promise<{ admin: string; customer: string }> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc('claim_booking_notifications' as any, {
    p_booking_id: bookingId ?? null, p_limit: bookingId ? 2 : 8,
  } as any);
  if (error) throw new Error('Could not claim notifications');
  const rows = (data ?? []) as unknown as Notification[];
  // At most two simultaneous provider calls avoids bursts beyond the provider limit.
  for (let start = 0; start < rows.length; start += 2) {
    // Four pairs fit the worker timeout even when each provider request takes ten seconds.
    if (start > 0) await new Promise(resolve => setTimeout(resolve, 1000));
    await Promise.all(rows.slice(start, start + 2).map(async row => {
      const delivery = await sendBookingEmail(row.recipient_kind, row.payload);
      const { error: saveError } = await supabase.rpc('complete_booking_notification' as any, {
        p_id: row.id, p_lease_token: row.lease_token, p_provider_id: delivery.id ?? null,
        p_error: delivery.status === 'sent' ? null : `Provider ${delivery.status}`,
      } as any);
      if (saveError) console.error('[booking-email] Could not complete lease', { notificationId: row.id, code: saveError.code });
      else console.info('[booking-email] Delivery attempt', { bookingId: row.booking_id, recipient: row.recipient_kind, status: delivery.status, providerId: delivery.id });
    }));
  }
  const statuses = { admin: 'queued', customer: 'queued' };
  if (bookingId) {
    const { data: saved, error: readError } = await supabase.from('booking_notifications' as any)
      .select('recipient_kind,status').eq('booking_id', bookingId);
    if (readError) throw new Error('Could not read notification status');
    for (const row of (saved ?? []) as unknown as { recipient_kind: 'admin' | 'customer'; status: string }[]) {
      statuses[row.recipient_kind] = row.status === 'processing' ? 'queued' : row.status;
    }
  }
  return statuses;
}
