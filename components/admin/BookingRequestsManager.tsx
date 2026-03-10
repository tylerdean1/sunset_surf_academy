'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    Checkbox,
    CircularProgress,
    FormControl,
    FormControlLabel,
    Grid,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import type { Database } from '@/lib/database.types';
import useContentBundle from '@/hooks/useContentBundle';
import AdminMonthCalendar from './AdminMonthCalendar';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { rpc } from '@/lib/rpc';

type BookingRequestRow = Database['public']['Tables']['booking_requests']['Row'];
type BookingRequestStatus = Database['public']['Enums']['booking_request_status'];

type BookingRequestDraft = {
    customer_name: string;
    customer_email: string;
    customer_phone: string;
    party_size: number;
    party_names_text: string; // comma-separated
    requested_lesson_type: string;
    requested_date: string; // yyyy-mm-dd
    requested_time_labels_text: string; // comma-separated
    selected_time_label: string; // single selected label (admin-chosen)
    notes: string;
    manual_pricing: boolean;
    manual_bill_total_usd: string; // e.g. '150.00'
    amount_paid_usd: string; // e.g. '0.00'
};

function formatUsdFromCents(cents: number | null | undefined): string {
    if (cents == null) return '—';
    const dollars = Number(cents) / 100;
    if (!Number.isFinite(dollars)) return '—';
    return dollars.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

function parseUsdToCents(value: string): number {
    const raw = String(value || '').trim();
    if (!raw) return 0;
    const n = Number(raw);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.round(n * 100));
}

function formatYmdToMdy(ymd: string): string {
    const m = String(ymd || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return String(ymd || '');
    return `${m[2]}-${m[3]}-${m[1]}`;
}

function formatRequestedDateTime(ymd: string, timeLabels: string[] | null): string {
    const date = formatYmdToMdy(ymd);
    const labels = Array.isArray(timeLabels) ? timeLabels.map((x) => String(x || '').trim()).filter(Boolean) : [];
    const normalized = labels.map((raw) => raw.replace(/\b(am|pm)\b/i, (m) => m.toLowerCase()));
    if (!normalized.length) return date;
    return `${date} @ ${normalized.join(' / ')}`;
}

function formatTimeLabel(label: string): string {
    const raw = String(label || '').trim();
    return raw ? raw.replace(/\b(am|pm)\b/i, (m) => m.toLowerCase()) : '';
}

function timeToLabel(hhmmss: string | null | undefined): string {
    const raw = String(hhmmss || '').trim();
    const m = raw.match(/^([0-9]{2}):([0-9]{2})(?::([0-9]{2}))?$/);
    if (!m) return '';
    let hour = Number(m[1]);
    const minute = Number(m[2]);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return '';
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12;
    if (hour === 0) hour = 12;
    const mm = String(minute).padStart(2, '0');
    return `${hour}:${mm} ${ampm}`;
}

function parseTimeLabelToTime(label: string): string | null {
    const raw = String(label || '').trim();
    const m = raw.match(/^([0-9]{1,2}):([0-9]{2})\s*(AM|PM)$/i);
    if (!m) return null;
    let hour = Number(m[1]);
    const minute = Number(m[2]);
    const ampm = String(m[3] || '').toUpperCase();
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
    if (hour < 1 || hour > 12) return null;
    if (minute < 0 || minute > 59) return null;
    if (hour === 12) hour = 0;
    if (ampm === 'PM') hour += 12;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(hour)}:${pad(minute)}:00`;
}

function generateTimeSlots(): string[] {
    const slots: string[] = [];
    for (let hour = 7; hour <= 15; hour++) {
        const h12 = hour % 12 === 0 ? 12 : hour % 12;
        const ampm = hour < 12 ? 'AM' : 'PM';
        slots.push(`${h12}:00 ${ampm}`);
        slots.push(`${h12}:30 ${ampm}`);
    }
    return slots;
}

function asNamesArray(input: string): string[] {
    const items = String(input || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    // keep order while deduping
    const seen = new Set<string>();
    const out: string[] = [];
    for (const s of items) {
        if (seen.has(s)) continue;
        seen.add(s);
        out.push(s);
    }
    return out;
}

function asTimeLabelsArray(input: string): string[] {
    const items = String(input || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    // keep order while deduping
    const seen = new Set<string>();
    const out: string[] = [];
    for (const s of items) {
        if (seen.has(s)) continue;
        seen.add(s);
        out.push(s);
    }
    return out;
}

export default function BookingRequestsManager() {
    const admin = useContentBundle('admin.');
    const [items, setItems] = useState<BookingRequestRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);

    const [showAll, setShowAll] = useState(false);
    const [filterFromDate, setFilterFromDate] = useState('');
    const [filterToDate, setFilterToDate] = useState('');
    const [filterName, setFilterName] = useState('');

    const [editingIds, setEditingIds] = useState<Record<string, boolean>>({});
    const [drafts, setDrafts] = useState<Record<string, BookingRequestDraft>>({});

    const [approveSelections, setApproveSelections] = useState<Record<string, string>>({});

    const timeSlots = useMemo(() => generateTimeSlots(), []);

    const statusLabel = (st: BookingRequestStatus) => {
        const key = `admin.bookingRequests.status.${st}`;
        const fallback =
            st === 'pending'
                ? 'Pending'
                : st === 'approved'
                    ? 'Approved'
                    : st === 'denied'
                        ? 'Denied'
                        : st === 'canceled'
                            ? 'Canceled'
                            : st;
        return admin.t(key, fallback);
    };

    const refresh = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const supabase = getSupabaseClient();
            const data = await rpc<BookingRequestRow[]>(supabase, 'admin_list_booking_requests', { p_show_all: showAll });
            setItems((data || []) as BookingRequestRow[]);
        } catch (e: any) {
            setError(e?.message || admin.t('admin.bookingRequests.errors.loadFailed', 'Failed to load booking requests'));
        } finally {
            setLoading(false);
        }
    }, [showAll]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const filtered = useMemo(() => {
        const nameNeedle = String(filterName || '').trim().toLowerCase();
        const fromNeedle = String(filterFromDate || '').trim();
        const toNeedle = String(filterToDate || '').trim();

        return [...items]
            .filter((r) => {
                if (!showAll && r.status !== 'pending') return false;
                const date = String(r.requested_date || '');
                if (fromNeedle && date < fromNeedle) return false;
                if (toNeedle && date > toNeedle) return false;
                if (nameNeedle) {
                    const blob = `${r.customer_name} ${(r.party_names || []).join(' ')}`.toLowerCase();
                    if (!blob.includes(nameNeedle)) return false;
                }
                return true;
            })
            .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    }, [items, showAll, filterFromDate, filterToDate, filterName]);

    const calendarSelectedDate = useMemo(() => {
        const a = String(filterFromDate || '').trim();
        const b = String(filterToDate || '').trim();
        if (a && b && a === b) return a;
        return undefined;
    }, [filterFromDate, filterToDate]);

    const statusPriority = (st: BookingRequestStatus) => {
        // Within booking-requests: pending highest priority.
        // approved next; denied (and any other terminal states) below.
        if (st === 'pending') return 0;
        if (st === 'approved') return 1;
        if (st === 'denied') return 2;
        if (st === 'canceled') return 3;
        return 3;
    };

    const statusColor = (st: BookingRequestStatus) => {
        if (st === 'pending') return 'warning.main';
        if (st === 'approved') return 'success.main';
        if (st === 'denied') return 'error.main';
        if (st === 'canceled') return 'text.secondary';
        return 'info.main';
    };

    const makeDraft = useCallback((r: BookingRequestRow): BookingRequestDraft => {
        const labels = Array.isArray(r.requested_time_labels)
            ? r.requested_time_labels.map((x) => String(x || '').trim()).filter(Boolean)
            : [];
        const manualUsd = r.manual_bill_total_cents == null ? '' : (Number(r.manual_bill_total_cents) / 100).toFixed(2);
        const paidUsd = (Number(r.amount_paid_cents || 0) / 100).toFixed(2);
        return {
            customer_name: r.customer_name,
            customer_email: r.customer_email,
            customer_phone: r.customer_phone,
            party_size: Number(r.party_size) || 1,
            party_names_text: (r.party_names || []).join(', '),
            requested_lesson_type: r.requested_lesson_type,
            requested_date: r.requested_date,
            requested_time_labels_text: labels.join(', '),
            selected_time_label: timeToLabel(r.selected_time_slot),
            notes: String(r.notes || ''),
            manual_pricing: Boolean(r.manual_pricing),
            manual_bill_total_usd: manualUsd,
            amount_paid_usd: paidUsd,
        };
    }, []);

    const setDraftField = (id: string, patch: Partial<BookingRequestDraft>) => {
        setDrafts((prev) => {
            const existing = prev[id];
            if (!existing) return prev;
            return { ...prev, [id]: { ...existing, ...patch } };
        });
    };

    const startEdit = (r: BookingRequestRow) => {
        setDrafts((prev) => ({ ...prev, [r.id]: makeDraft(r) }));
        setEditingIds((prev) => ({ ...prev, [r.id]: true }));
    };

    const cancelEdit = (id: string) => {
        setDrafts((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
        });
        setEditingIds((prev) => ({ ...prev, [id]: false }));
    };

    const saveEdit = async (id: string) => {
        const d = drafts[id];
        if (!d) return;
        setError(null);
        setBusyId(id);
        try {
            const requested_time_labels = asTimeLabelsArray(d.requested_time_labels_text);
            const selected_time_slot = d.selected_time_label ? parseTimeLabelToTime(d.selected_time_label) : null;

            // If the admin clears the manual total input, revert to default (computed) pricing.
            const hasManualTotal = Boolean(d.manual_bill_total_usd.trim());
            const effectiveManualPricing = Boolean(d.manual_pricing) && hasManualTotal;

            const supabase = getSupabaseClient();
            const updated = await rpc<BookingRequestRow>(supabase, 'admin_update_booking_request', {
                p_id: id,
                p_patch: {
                    customer_name: d.customer_name,
                    customer_email: d.customer_email,
                    customer_phone: d.customer_phone,
                    party_size: Number(d.party_size) || 1,
                    party_names: asNamesArray(d.party_names_text),
                    requested_lesson_type: d.requested_lesson_type,
                    requested_date: d.requested_date,
                    requested_time_labels,
                    selected_time_slot,
                    notes: d.notes || null,
                    manual_pricing: effectiveManualPricing,
                    manual_bill_total_cents: effectiveManualPricing ? parseUsdToCents(d.manual_bill_total_usd) : null,
                    amount_paid_cents: parseUsdToCents(d.amount_paid_usd),
                },
            });

            setItems((prev) => prev.map((x) => (x.id === id ? updated : x)));
            cancelEdit(id);
        } catch (e: any) {
            setError(e?.message || admin.t('admin.bookingRequests.errors.updateFailed', 'Failed to save booking request'));
        } finally {
            setBusyId(null);
        }
    };

    const decide = async (id: string, action: 'approve' | 'deny' | 'cancel') => {
        const selected_time_label = action === 'approve' ? (approveSelections[id] || undefined) : undefined;

        setError(null);
        setBusyId(id);
        try {
            const supabase = getSupabaseClient();
            if (!supabase) throw new Error('Network error');

            const { data, error } = await supabase.rpc('admin_decide_booking_request', {
                p_id: id,
                p_action: action,
                p_selected_time_label: selected_time_label,
            });

            if (error) throw new Error(error.message);

            // Update local list without needing a refetch (avoids cookie/session drift issues).
            if (action === 'cancel' && !items.find((x) => x.id === id)?.approved_session_id) {
                setItems((prev) => prev.filter((x) => x.id !== id));
            } else if (data) {
                setItems((prev) => prev.map((x) => (x.id === id ? (data as any) : x)));
            }

            cancelEdit(id);
            setApproveSelections((prev) => {
                const next = { ...prev };
                delete next[id];
                return next;
            });
        } catch (e: any) {
            setError(e?.message || admin.t('admin.bookingRequests.errors.decideFailed', 'Failed to update booking request'));
        } finally {
            setBusyId(null);
        }
    };

    return (
        <Box>
            <Typography variant="h6" sx={{ mb: 1 }}>
                {admin.t('admin.bookingRequests.title', 'Booking Requests')}
            </Typography>

            <Box sx={{ mb: 3 }}>
                <AdminMonthCalendar
                    title={admin.t('admin.bookingRequests.calendar.title', 'Requests Calendar')}
                    legendItems={[
                        { label: statusLabel('pending' as BookingRequestStatus), color: 'warning.main' },
                        { label: statusLabel('approved' as BookingRequestStatus), color: 'success.main' },
                        { label: statusLabel('denied' as BookingRequestStatus), color: 'error.main' },
                        { label: statusLabel('canceled' as BookingRequestStatus), color: 'text.secondary' },
                    ]}
                    items={items}
                    selectedDateYmd={calendarSelectedDate}
                    onSelectDateYmd={(ymd) => {
                        setFilterFromDate(ymd);
                        setFilterToDate(ymd);
                    }}
                    getItemDateYmd={(r) => String(r.requested_date || '') || null}
                    getItemStatusKey={(r) => String(r.status || 'pending')}
                    getStatusPriority={(k) => statusPriority(k as BookingRequestStatus)}
                    getStatusColor={(k) => statusColor(k as BookingRequestStatus)}
                    getItemTitle={(r) => String(r.customer_name || '—')}
                    getItemSubtitle={(r) => {
                        const selected = timeToLabel(r.selected_time_slot);
                        const raw = selected || (Array.isArray(r.requested_time_labels) && r.requested_time_labels.length ? r.requested_time_labels[0] : '');
                        const time = raw ? formatTimeLabel(String(raw)) : '';
                        const st = statusLabel(r.status as BookingRequestStatus);
                        return time ? `${st} • ${time}` : st;
                    }}
                />
            </Box>

            {error ? (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            ) : null}

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2 }} alignItems={{ md: 'center' }}>
                <FormControlLabel
                    control={<Checkbox checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />}
                    label={admin.t('admin.bookingRequests.filters.showAll', 'Show all requests')}
                />
                <TextField
                    label={admin.t('admin.bookingRequests.filters.fromDate', 'From')}
                    type="date"
                    value={filterFromDate}
                    onChange={(e) => setFilterFromDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    sx={{ width: 170 }}
                />
                <TextField
                    label={admin.t('admin.bookingRequests.filters.toDate', 'To')}
                    type="date"
                    value={filterToDate}
                    onChange={(e) => setFilterToDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    sx={{ width: 170 }}
                />
                <TextField
                    label={admin.t('admin.bookingRequests.filters.name', 'Filter name')}
                    value={filterName}
                    onChange={(e) => setFilterName(e.target.value)}
                    sx={{ width: 220 }}
                />
                <Box sx={{ flex: 1 }} />
                <Button variant="outlined" onClick={refresh} disabled={loading}>
                    {admin.t('admin.common.refresh', 'Refresh')}
                </Button>
            </Stack>

            {loading ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2 }}>
                    <CircularProgress size={22} />
                    <Typography>{admin.t('admin.common.loading', 'Loading…')}</Typography>
                </Box>
            ) : filtered.length === 0 ? (
                <Alert severity="info">{admin.t('admin.bookingRequests.empty', 'No booking requests found.')}</Alert>
            ) : (
                <Stack spacing={3} sx={{ mt: 1 }}>
                    {filtered.map((r) => {
                        const busy = busyId === r.id;
                        const isEditing = Boolean(editingIds[r.id]);
                        const draft = drafts[r.id] || makeDraft(r);
                        const d = isEditing ? draft : null;

                        return (
                            <Box
                                key={r.id}
                                sx={{
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    borderRadius: 2,
                                    p: 2,
                                }}
                            >
                                <Grid container spacing={2} alignItems="flex-start">
                                    <Grid item xs={12} md={4}>
                                        <Stack spacing={0.75}>
                                            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                                                {r.customer_name} — {statusLabel(r.status)}
                                            </Typography>
                                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                                {formatRequestedDateTime(r.requested_date, r.requested_time_labels)}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                {admin.t('admin.bookingRequests.fields.selectedTime', 'Selected time')}: {timeToLabel(r.selected_time_slot) ? formatTimeLabel(timeToLabel(r.selected_time_slot)) : '—'}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                {admin.t('admin.bookingRequests.fields.phone', 'Phone')}: {r.customer_phone || '—'}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                {admin.t('admin.bookingRequests.fields.email', 'Email')}: {r.customer_email || '—'}
                                            </Typography>
                                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                                {admin.t('admin.bookingRequests.billing.total', 'Total')}: {formatUsdFromCents(r.bill_total_cents)}
                                                {'  •  '}
                                                {admin.t('admin.bookingRequests.billing.paid', 'Paid')}: {formatUsdFromCents(r.amount_paid_cents)}
                                                {'  •  '}
                                                {admin.t('admin.bookingRequests.billing.due', 'Due')}: {formatUsdFromCents(r.balance_cents ?? (r.bill_total_cents == null ? null : r.bill_total_cents - (r.amount_paid_cents || 0)))}
                                            </Typography>
                                            {r.notes ? (
                                                <Typography variant="body2" color="text.secondary">
                                                    {r.notes}
                                                </Typography>
                                            ) : null}
                                        </Stack>
                                    </Grid>

                                    <Grid item xs={12} md={8}>
                                        <Stack spacing={2}>
                                            {isEditing ? (
                                                <Grid container spacing={2}>
                                                    <Grid item xs={12} sm={6}>
                                                        <TextField
                                                            label={admin.t('admin.bookingRequests.fields.customer', 'Customer')}
                                                            value={draft.customer_name}
                                                            onChange={(e) => setDraftField(r.id, { customer_name: e.target.value })}
                                                            disabled={busy}
                                                            fullWidth
                                                        />
                                                    </Grid>
                                                    <Grid item xs={6} sm={3}>
                                                        <TextField
                                                            label={admin.t('admin.bookingRequests.fields.partySize', 'Party')}
                                                            type="number"
                                                            value={draft.party_size}
                                                            onChange={(e) => setDraftField(r.id, { party_size: Number(e.target.value) || 1 })}
                                                            inputProps={{ min: 1 }}
                                                            disabled={busy}
                                                            fullWidth
                                                        />
                                                    </Grid>
                                                    <Grid item xs={6} sm={3}>
                                                        <TextField
                                                            label={admin.t('admin.bookingRequests.fields.date', 'Date')}
                                                            type="date"
                                                            value={draft.requested_date}
                                                            onChange={(e) => setDraftField(r.id, { requested_date: e.target.value })}
                                                            InputLabelProps={{ shrink: true }}
                                                            disabled={busy}
                                                            fullWidth
                                                        />
                                                    </Grid>

                                                    <Grid item xs={12} md={7}>
                                                        <TextField
                                                            label={admin.t('admin.bookingRequests.fields.requestedTimes', 'Requested times (comma-separated)')}
                                                            value={draft.requested_time_labels_text}
                                                            onChange={(e) => setDraftField(r.id, { requested_time_labels_text: e.target.value })}
                                                            disabled={busy}
                                                            fullWidth
                                                        />
                                                    </Grid>

                                                    <Grid item xs={12} md={5}>
                                                        <FormControl fullWidth disabled={busy}>
                                                            <InputLabel id={`br-selected-${r.id}`}>{admin.t('admin.bookingRequests.fields.selectedTime', 'Selected time')}</InputLabel>
                                                            <Select
                                                                labelId={`br-selected-${r.id}`}
                                                                label={admin.t('admin.bookingRequests.fields.selectedTime', 'Selected time')}
                                                                value={draft.selected_time_label}
                                                                onChange={(e) => setDraftField(r.id, { selected_time_label: String(e.target.value || '') })}
                                                            >
                                                                <MenuItem value="">—</MenuItem>
                                                                {timeSlots.map((slot) => (
                                                                    <MenuItem key={slot} value={slot}>
                                                                        {slot}
                                                                    </MenuItem>
                                                                ))}
                                                            </Select>
                                                        </FormControl>
                                                    </Grid>

                                                    <Grid item xs={12}>
                                                        <TextField
                                                            label={admin.t('admin.bookingRequests.fields.notes', 'Notes')}
                                                            value={draft.notes}
                                                            onChange={(e) => setDraftField(r.id, { notes: e.target.value })}
                                                            multiline
                                                            minRows={2}
                                                            disabled={busy}
                                                            fullWidth
                                                        />
                                                    </Grid>

                                                    <Grid item xs={12} sm={4}>
                                                        <FormControlLabel
                                                            control={
                                                                <Checkbox
                                                                    checked={Boolean(draft.manual_pricing)}
                                                                    onChange={(e) =>
                                                                        setDraftField(r.id, {
                                                                            manual_pricing: e.target.checked,
                                                                            manual_bill_total_usd: e.target.checked ? draft.manual_bill_total_usd : '',
                                                                        })
                                                                    }
                                                                    disabled={busy}
                                                                />
                                                            }
                                                            label={admin.t('admin.bookingRequests.billing.manualPricing', 'Manual pricing')}
                                                        />
                                                    </Grid>

                                                    <Grid item xs={12} sm={4}>
                                                        <TextField
                                                            label={admin.t('admin.bookingRequests.billing.manualBillTotal', 'Manual bill total (USD)')}
                                                            type="number"
                                                            value={draft.manual_bill_total_usd}
                                                            onChange={(e) => setDraftField(r.id, { manual_bill_total_usd: e.target.value })}
                                                            inputProps={{ step: '0.01', min: 0 }}
                                                            disabled={busy || !draft.manual_pricing}
                                                            fullWidth
                                                        />
                                                    </Grid>

                                                    <Grid item xs={12} sm={4}>
                                                        <TextField
                                                            label={admin.t('admin.bookingRequests.billing.amountPaid', 'Amount paid (USD)')}
                                                            type="number"
                                                            value={draft.amount_paid_usd}
                                                            onChange={(e) => setDraftField(r.id, { amount_paid_usd: e.target.value })}
                                                            inputProps={{ step: '0.01', min: 0 }}
                                                            disabled={busy}
                                                            fullWidth
                                                        />
                                                    </Grid>
                                                </Grid>
                                            ) : null}

                                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ flexWrap: 'wrap', alignItems: { sm: 'center' } }}>
                                                {isEditing ? (
                                                    <>
                                                        <Button variant="contained" onClick={() => saveEdit(r.id)} disabled={busy}>
                                                            {admin.t('admin.common.save', 'Save')}
                                                        </Button>
                                                        <Button variant="outlined" onClick={() => cancelEdit(r.id)} disabled={busy}>
                                                            {admin.t('admin.common.cancel', 'Cancel')}
                                                        </Button>
                                                    </>
                                                ) : (
                                                    <Button variant="outlined" onClick={() => startEdit(r)} disabled={busy}>
                                                        {admin.t('admin.common.edit', 'Edit')}
                                                    </Button>
                                                )}

                                                {r.status === 'pending' ? (
                                                    <FormControl sx={{ minWidth: 190 }} disabled={busy}>
                                                        <InputLabel id={`br-approve-${r.id}`}>{admin.t('admin.bookingRequests.fields.selectedTime', 'Selected time')}</InputLabel>
                                                        <Select
                                                            labelId={`br-approve-${r.id}`}
                                                            label={admin.t('admin.bookingRequests.fields.selectedTime', 'Selected time')}
                                                            value={approveSelections[r.id] || ''}
                                                            onChange={(e) =>
                                                                setApproveSelections((prev) => ({ ...prev, [r.id]: String(e.target.value || '') }))
                                                            }
                                                        >
                                                            <MenuItem value="">—</MenuItem>
                                                            {timeSlots.map((slot) => (
                                                                <MenuItem key={slot} value={slot}>
                                                                    {slot}
                                                                </MenuItem>
                                                            ))}
                                                        </Select>
                                                    </FormControl>
                                                ) : null}

                                                <Button
                                                    variant="outlined"
                                                    onClick={() => decide(r.id, 'approve')}
                                                    disabled={busy || r.status !== 'pending' || !approveSelections[r.id]}
                                                >
                                                    {admin.t('admin.bookingRequests.actions.approve', 'Approve')}
                                                </Button>
                                                <Button
                                                    variant="outlined"
                                                    color="warning"
                                                    onClick={() => decide(r.id, 'deny')}
                                                    disabled={busy || r.status !== 'pending'}
                                                >
                                                    {admin.t('admin.bookingRequests.actions.deny', 'Deny')}
                                                </Button>
                                                <Button
                                                    variant="outlined"
                                                    color="error"
                                                    onClick={() => decide(r.id, 'cancel')}
                                                    disabled={
                                                        busy ||
                                                        (r.status !== 'pending' && !(r.status === 'approved' && Boolean(r.approved_session_id)))
                                                    }
                                                >
                                                    {admin.t('admin.bookingRequests.actions.cancel', 'Cancel')}
                                                </Button>
                                            </Stack>
                                        </Stack>
                                    </Grid>
                                </Grid>
                            </Box>
                        );
                    })}
                </Stack>
            )}
        </Box>
    );
}
