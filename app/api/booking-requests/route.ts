import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { sendBookingEmails } from '@/lib/server/bookingEmail';

function normalizeTime(value: unknown): string | null {
    const raw = String(value ?? '').trim();
    if (!raw) return null;
    // Accept HH:MM or HH:MM:SS
    const m = raw.match(/^([0-9]{2}):([0-9]{2})(?::([0-9]{2}))?$/);
    if (!m) return null;
    const hh = Number(m[1]);
    const mm = Number(m[2]);
    const ss = m[3] == null ? 0 : Number(m[3]);
    if (!Number.isFinite(hh) || !Number.isFinite(mm) || !Number.isFinite(ss)) return null;
    if (hh < 0 || hh > 23) return null;
    if (mm < 0 || mm > 59) return null;
    if (ss < 0 || ss > 59) return null;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(hh)}:${pad(mm)}:${pad(ss)}`;
}

export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => null);
        if (!body || typeof body !== 'object') {
            return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
        }

        const customer_name = String((body as any).customer_name ?? '').trim();
        const customer_email = String((body as any).customer_email ?? '').trim();
        const customer_phone = String((body as any).customer_phone ?? '').trim();
        const requested_date = String((body as any).requested_date ?? '').trim();
        const requested_lesson_type = String((body as any).requested_lesson_type ?? '').trim();

        const party_size_raw = (body as any).party_size;
        const party_size = typeof party_size_raw === 'number' ? party_size_raw : Number(party_size_raw);

        const requested_time_labels_raw = (body as any).requested_time_labels;
        const requested_time_labels = Array.isArray(requested_time_labels_raw)
            ? requested_time_labels_raw.map((v) => String(v)).filter((v) => v.trim().length > 0)
            : [];

        // Optional backward-compat field (DB canonical UX is requested_time_labels + admin selected_time_slot).
        const requested_time_slots = normalizeTime((body as any).requested_time_slots);

        const party_names_raw = (body as any).party_names;
        const party_names = Array.isArray(party_names_raw)
            ? party_names_raw.map((v) => String(v).trim()).filter((v) => v.length > 0)
            : [];

        const notes_raw = (body as any).notes;
        const notes = typeof notes_raw === 'string' ? notes_raw.trim() : '';

        if (!customer_name || !customer_email || !customer_phone) {
            return NextResponse.json({ error: 'Missing customer fields' }, { status: 400 });
        }
        if (customer_name.length > 160 || customer_phone.length > 40 || customer_email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer_email)) {
            return NextResponse.json({ error: 'Invalid customer fields' }, { status: 400 });
        }
        if (!requested_date || !requested_lesson_type) {
            return NextResponse.json({ error: 'Missing requested fields' }, { status: 400 });
        }
        if (!Number.isInteger(party_size) || party_size < 1 || party_size > 30) {
            return NextResponse.json({ error: 'Invalid party_size' }, { status: 400 });
        }
        if (!requested_time_labels.length) {
            return NextResponse.json({ error: 'Select at least one time' }, { status: 400 });
        }

        const supabase = getSupabaseAdmin();

        // Validate lesson type against DB (source of truth for pricing)
        const { data: lt, error: ltErr } = await supabase
            .from('lesson_types')
            .select('key, display_name')
            .eq('key', requested_lesson_type)
            .eq('is_active', true)
            .maybeSingle();
        if (ltErr) {
            return NextResponse.json({ error: ltErr.message }, { status: 500 });
        }
        if (!lt) {
            return NextResponse.json({ error: 'Invalid lesson type' }, { status: 400 });
        }

        const amount_paid_cents = 0;

        const { data, error } = await supabase
            .from('booking_requests')
            .insert({
                customer_name,
                customer_email,
                customer_phone,
                party_size,
                party_names: party_names.length ? party_names : null,
                requested_date,
                requested_time_labels,
                requested_time_slots,
                requested_lesson_type,
                notes: notes || null,
                status: 'pending',
                amount_paid_cents,
                manual_pricing: false,
                manual_bill_total_cents: null,
            })
            .select('*')
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const notifications = await sendBookingEmails({
            id: String(data.id),
            customerName: customer_name,
            customerEmail: customer_email,
            customerPhone: customer_phone,
            lessonName: lt.display_name || requested_lesson_type,
            date: requested_date,
            timeLabels: requested_time_labels,
            partySize: party_size,
            partyNames: party_names,
            notes,
            locale: (body as any).locale === 'es' ? 'es' : 'en',
        });

        console.info('[booking-email] Delivery result', {
            bookingId: data.id,
            admin: notifications.admin.status,
            adminEmailId: notifications.admin.id,
            customer: notifications.customer.status,
            customerEmailId: notifications.customer.id,
        });

        return NextResponse.json({ ok: true, booking_request: data, notifications: {
            admin: notifications.admin.status,
            customer: notifications.customer.status,
        } });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 });
    }
}
