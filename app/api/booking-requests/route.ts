import { createHash, createHmac } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { BookingValidationError, readBookingJson, validateBookingInput } from '@/lib/bookingValidation';
import { processBookingNotifications } from '@/lib/server/bookingNotifications';

export const runtime = 'nodejs';
export const maxDuration = 30;
export async function POST(req: Request) {
  try {
    const input = validateBookingInput(await readBookingJson(req));
    const supabase = getSupabaseAdmin();
    const ip = (req.headers.get('x-vercel-forwarded-for') || req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    if (!secret) throw new Error('Booking service is not configured');
    const rateKey = createHmac('sha256', secret).update(ip).digest('hex');
    const payloadHash = createHash('sha256').update(JSON.stringify(input)).digest('hex');
    const { data, error } = await supabase.rpc('submit_booking_request' as any, {
      p_payload: input, p_payload_hash: payloadHash, p_rate_key: rateKey,
    } as any);
    if (error) {
      const status = error.code === 'P0429' ? 429 : error.code === 'P0409' ? 409 : ['22023', '22P02', '23503', '23514'].includes(error.code) ? 400 : 503;
      const message = status === 429 ? 'Too many requests. Please try again later.'
        : status === 409 ? 'This request was already submitted with different details. Refresh and try again.'
        : status === 400 ? 'Please check your booking details and try again.' : 'Booking is temporarily unavailable. Please try again.';
      console.error('[booking] Submission rejected', { code: error.code });
      return NextResponse.json({ error: message }, { status, headers: status === 429 ? { 'Retry-After': '3600' } : {} });
    }
    const result = data as unknown as { id: string; duplicate: boolean };
    if (!result?.id) throw new Error('Missing booking result');
    let notifications = { admin: 'queued', customer: 'queued' };
    try { notifications = await processBookingNotifications(result.id); }
    catch { console.error('[booking-email] Worker deferred; scheduled retry will resume', { bookingId: result.id }); }
    return NextResponse.json({ ok: true, booking_request: { id: result.id }, duplicate: result.duplicate, notifications });
  } catch (error) {
    if (error instanceof BookingValidationError) return NextResponse.json({ error: error.message }, { status: error.message === 'Request is too large' ? 413 : 400 });
    console.error('[booking] Request failed', error instanceof Error ? error.name : 'unknown');
    return NextResponse.json({ error: 'Booking is temporarily unavailable. Please try again.' }, { status: 503 });
  }
}
