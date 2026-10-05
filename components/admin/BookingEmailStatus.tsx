'use client';

import { useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material';

type Notification = { recipient_kind: 'admin' | 'customer'; status: string; attempts: number; provider_event: string | null };
function statusLabel(row: Notification) {
  if (row.provider_event === 'delivered' || row.provider_event === 'opened' || row.provider_event === 'clicked') return 'Delivered';
  if (row.provider_event === 'bounced') return 'Bounced — contact the guest';
  if (row.provider_event === 'complained') return 'Marked as spam';
  if (row.status === 'sent') return row.provider_event === 'delivery_delayed' ? 'Delivery delayed' : 'Accepted by email provider';
  if (row.status === 'failed') return 'Needs attention — automatic retries stopped';
  return row.status === 'processing' ? 'Sending' : 'Queued for retry';
}

export default function BookingEmailStatus({ bookingId }: { bookingId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<Notification[]>([]);
  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/booking-notifications?booking_id=${encodeURIComponent(bookingId)}`, { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.message || 'Could not load email status');
      setRows(Array.isArray(body.notifications) ? body.notifications : []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load email status');
    } finally { setLoading(false); }
  };
  return <>
    <Button size="small" sx={{ alignSelf: 'flex-start' }} onClick={() => { setOpen(true); void load(); }}>Email status</Button>
    <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
      <DialogTitle>Booking email status</DialogTitle>
      <DialogContent>
        {error ? <Alert severity="error">{error}</Alert> : null}
        {loading ? <Typography>Checking email status…</Typography> : <Stack spacing={2}>
          {rows.length ? rows.map(row => <div key={row.recipient_kind}>
            <Typography fontWeight={700}>{row.recipient_kind === 'admin' ? 'School notification' : 'Guest confirmation'}</Typography>
            <Typography>{statusLabel(row)}</Typography>
            <Typography variant="body2" color="text.secondary">{row.attempts} delivery attempt{row.attempts === 1 ? '' : 's'}</Typography>
          </div>) : <Typography>No delivery record is available for this request.</Typography>}
        </Stack>}
      </DialogContent>
      <DialogActions><Button onClick={() => void load()} disabled={loading}>Refresh</Button><Button onClick={() => setOpen(false)}>Close</Button></DialogActions>
    </Dialog>
  </>;
}
