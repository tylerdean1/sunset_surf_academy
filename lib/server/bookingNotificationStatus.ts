import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function inspectBookingNotifications(bookingId: string) {
  const { data, error } = await getSupabaseAdmin().from('booking_notifications')
    .select('recipient_kind,status,attempts,provider_message_id,last_error').eq('booking_id', bookingId);
  if (error) throw new Error('Could not load notification status');
  const apiKey = process.env.RESEND_API_KEY;
  return Promise.all((data ?? []).map(async row => {
    let providerEvent: string | null = null;
    if (apiKey && row.provider_message_id) {
      try {
        const response = await fetch(`https://api.resend.com/emails/${encodeURIComponent(row.provider_message_id)}`, {
          headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store', signal: AbortSignal.timeout(8000),
        });
        const record = await response.json().catch(() => null);
        if (response.ok && typeof record?.last_event === 'string') providerEvent = record.last_event;
      } catch { /* Saved queue status remains available without provider read access. */ }
    }
    return { ...row, provider_event: providerEvent };
  }));
}
