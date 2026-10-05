'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Stepper,
  Step,
  StepLabel,
  Paper
} from '@mui/material';
import Checkbox from '@mui/material/Checkbox';
import ListItemText from '@mui/material/ListItemText';
import { useLocale } from 'next-intl';
import useContentBundle from '@/hooks/useContentBundle';
import { BOOKING_TIME_LABELS, bookingDateBounds } from '@/lib/bookingValidation';

const FALLBACK_COPY = 'Content unavailable';

export type BookingData = {
  date: string; // yyyy-mm-dd
  timeSlots: string[]; // human-readable time blocks (30-min)
  lessonType: string;
  partySize: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  partyNames: string[];
};

interface BookingCalendarProps {
  onBookingComplete: (booking: BookingData, emailDelivered: boolean) => void;
  initialLessonTypeId?: string;
}

const BookingCalendar: React.FC<BookingCalendarProps> = ({ onBookingComplete, initialLessonTypeId }) => {
  const [activeStep, setActiveStep] = useState(0);
  const [bookingData, setBookingData] = useState<BookingData>({
    date: '',
    timeSlots: [],
    lessonType: '',
    partySize: 1,
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    partyNames: []
  });
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const submissionRef = useRef<{ fingerprint: string; id: string } | null>(null);
  const [submitError, setSubmitError] = useState<string>('');
  const locale = useLocale();

  const ui = useContentBundle('ui.');

  const stepChooseLesson = ui.t('ui.booking.steps.chooseLesson', FALLBACK_COPY);
  const stepSelectDateTime = ui.t('ui.booking.steps.selectDateTime', FALLBACK_COPY);
  const stepCustomerInfo = ui.t('ui.booking.steps.customerInfo', FALLBACK_COPY);
  const steps = [
    stepChooseLesson === FALLBACK_COPY ? 'Choose Lesson' : stepChooseLesson,
    stepSelectDateTime === FALLBACK_COPY ? 'Select Date & Time' : stepSelectDateTime,
    stepCustomerInfo === FALLBACK_COPY ? 'Customer Info' : stepCustomerInfo,
  ];

  const lessonTypeLabel = ui.t('ui.booking.lessonTypeLabel', FALLBACK_COPY);
  const partySizeLabel = ui.t('ui.booking.partySizeLabel', FALLBACK_COPY);
  const totalLabel = ui.t('ui.booking.totalLabel', FALLBACK_COPY);
  const totalBreakdownTemplate = ui.t('ui.booking.totalBreakdown', FALLBACK_COPY);

  const step0Title = ui.t('ui.booking.step0.title', FALLBACK_COPY);
  const step1Title = ui.t('ui.booking.step1.title', FALLBACK_COPY);
  const dateLabel = ui.t('ui.booking.dateLabel', FALLBACK_COPY);
  const timeLabel = ui.t('ui.booking.timeLabel', FALLBACK_COPY);
  const timeHelp = ui.t('ui.booking.timeHelp', FALLBACK_COPY);

  const step2Title = ui.t('ui.booking.step2.title', FALLBACK_COPY);
  const fullNameLabel = ui.t('ui.booking.fullNameLabel', FALLBACK_COPY);
  const emailLabel = ui.t('ui.booking.emailLabel', FALLBACK_COPY);
  const phoneLabel = ui.t('ui.booking.phoneLabel', FALLBACK_COPY);

  const summaryTitle = ui.t('ui.booking.summary.title', FALLBACK_COPY);
  const summaryDateLabel = ui.t('ui.booking.summary.dateLabel', FALLBACK_COPY);
  const summaryTimeLabel = ui.t('ui.booking.summary.timeLabel', FALLBACK_COPY);
  const summaryLessonLabel = ui.t('ui.booking.summary.lessonLabel', FALLBACK_COPY);
  const summaryPartySizeLabel = ui.t('ui.booking.summary.partySizeLabel', FALLBACK_COPY);

  const backLabel = ui.t('ui.booking.actions.back', FALLBACK_COPY);
  const nextLabel = ui.t('ui.booking.actions.next', FALLBACK_COPY);
  const submitLabel = ui.t('ui.booking.actions.submit', FALLBACK_COPY);

  type LessonType = {
    key: string;
    display_name: string;
    description?: string | null;
    price_per_person_cents: number;
  };

  const [lessonTypes, setLessonTypes] = useState<LessonType[]>([]);
  const [lessonTypesError, setLessonTypesError] = useState<string>('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLessonTypesError('');
        const res = await fetch('/api/lesson-types', { method: 'GET' });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || (json as any)?.ok === false) {
          throw new Error(String((json as any)?.message || 'Failed to load lesson types'));
        }
        const rows = Array.isArray((json as any)?.lessonTypes) ? ((json as any).lessonTypes as LessonType[]) : [];
        if (!alive) return;
        setLessonTypes(rows);
      } catch (e: any) {
        if (!alive) return;
        setLessonTypesError(e?.message || 'Failed to load lesson types');
        setLessonTypes([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const timeSlots = BOOKING_TIME_LABELS;
  const dateBounds = bookingDateBounds();

  const initialLessonIsValid = typeof initialLessonTypeId === 'string' && lessonTypes.some((lt) => lt.key === initialLessonTypeId);
  const selectedLessonType = bookingData.lessonType || (initialLessonIsValid ? initialLessonTypeId : lessonTypes[0]?.key || '');
  const guestCount = Math.max(0, Math.min(29, Number(bookingData.partySize || 1) - 1));
  const partyNames = Array.from({ length: guestCount }, (_, index) => bookingData.partyNames[index] ?? '');

  const dollarsFromCents = (cents: number | null | undefined) => {
    if (cents == null) return 0;
    const n = Number(cents);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.round(n)) / 100;
  };

  const calculateTotal = () => {
    const lt = lessonTypes.find((x) => x.key === selectedLessonType);
    const unit = dollarsFromCents(lt?.price_per_person_cents);
    return lt ? unit * bookingData.partySize : 0;
  };

  const handleNext = async () => {
    if (submittingRef.current) return;
    if (activeStep < steps.length - 1) {
      setActiveStep(activeStep + 1);
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError('');

    try {
      const payload = {
        customer_name: bookingData.customerName,
        customer_email: bookingData.customerEmail,
        customer_phone: bookingData.customerPhone,
        party_size: bookingData.partySize,
        party_names: partyNames.filter((name) => name.trim()),
        requested_date: bookingData.date,
        requested_time_labels: bookingData.timeSlots,
        requested_lesson_type: selectedLessonType,
        locale,
      };
      const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(payload)));
      const fingerprint = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
      if (submissionRef.current?.fingerprint !== fingerprint) {
        let saved: { fingerprint: string; id: string } | null = null;
        try { saved = JSON.parse(sessionStorage.getItem('surf-booking-submission') || 'null'); } catch { /* Storage is optional. */ }
        submissionRef.current = saved?.fingerprint === fingerprint ? saved : { fingerprint, id: crypto.randomUUID() };
        try { sessionStorage.setItem('surf-booking-submission', JSON.stringify(submissionRef.current)); } catch { /* Retry key stays in memory. */ }
      }
      const res = await fetch('/api/booking-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          submission_id: submissionRef.current.id,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(String((json as any)?.error || 'Failed to submit request'));
      }

      const notifications = (json as any)?.notifications;
      try { sessionStorage.removeItem('surf-booking-submission'); } catch { /* Storage is optional. */ }
      onBookingComplete({ ...bookingData, lessonType: selectedLessonType, partyNames: partyNames.filter((name) => name.trim()) },
        notifications?.admin === 'sent' && notifications?.customer === 'sent');
    } catch (err: any) {
      setSubmitError(err?.message || 'Failed to submit request');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    setActiveStep(activeStep - 1);
  };

  const canProceed = () => {
    switch (activeStep) {
      case 0:
        return Boolean(selectedLessonType && bookingData.partySize > 0);
      case 1:
        return Boolean(bookingData.date && bookingData.timeSlots && bookingData.timeSlots.length > 0);
      case 2:
        return bookingData.customerName && bookingData.customerEmail && bookingData.customerPhone;
      default:
        return false;
    }
  };

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {steps.map((label, idx) => (
          <Step key={idx}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      <Card>
        <CardContent sx={{ p: 4 }}>
          {activeStep === 0 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                {step0Title}
              </Typography>

              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>{lessonTypeLabel}</InputLabel>
                    <Select
                      value={selectedLessonType}
                      label={lessonTypeLabel}
                      onChange={(e: any) => setBookingData({
                        ...bookingData,
                        lessonType: e.target.value
                      })}
                    >
                      {lessonTypes.map((type: LessonType) => (
                        <MenuItem key={type.key} value={type.key}>
                          {type.display_name} - ${dollarsFromCents(type.price_per_person_cents)}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label={partySizeLabel}
                    type="number"
                    value={bookingData.partySize}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBookingData({
                      ...bookingData,
                      partySize: Math.max(1, Math.min(30, Number.parseInt(e.target.value, 10) || 1)),
                      partyNames: partyNames.slice(0, Math.max(1, Math.min(30, Number.parseInt(e.target.value, 10) || 1)) - 1)
                    })}
                    inputProps={{ min: 1, max: 30 }}
                  />
                </Grid>
              </Grid>

              <Paper sx={{ p: 3, mt: 3, backgroundColor: '#f5f5f5' }}>
                <Typography variant="h6">
                  {totalLabel}: ${calculateTotal()}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {String(totalBreakdownTemplate)
                    .replace('{count}', String(bookingData.partySize))
                    .replace('{price}', String(dollarsFromCents(lessonTypes.find((lt: LessonType) => lt.key === selectedLessonType)?.price_per_person_cents || 0)))}
                </Typography>
                {lessonTypesError ? (
                  <Typography variant="body2" color="error" sx={{ mt: 1 }}>
                    {lessonTypesError}
                  </Typography>
                ) : null}
              </Paper>
            </Box>
          )}

          {activeStep === 1 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                {step1Title}
              </Typography>

              <Grid container spacing={3} sx={{ mt: 1 }}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label={dateLabel}
                    type="date"
                    value={bookingData.date}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setBookingData({ ...bookingData, date: e.target.value, timeSlots: [] })
                    }
                    InputLabelProps={{ shrink: true }}
                    inputProps={{ min: dateBounds.min, max: dateBounds.max }}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>{timeLabel}</InputLabel>
                    <Select
                      multiple
                      value={bookingData.timeSlots}
                      label={timeLabel}
                      onChange={(e: any) =>
                        setBookingData({ ...bookingData, timeSlots: typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value })
                      }
                      disabled={!bookingData.date}
                      renderValue={(selected) => (selected as string[]).join(', ')}
                    >
                      {timeSlots.map((slot) => (
                        <MenuItem key={slot} value={slot}>
                          <Checkbox checked={bookingData.timeSlots.indexOf(slot) > -1} />
                          <ListItemText primary={slot} />
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>

              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                {timeHelp}
              </Typography>
            </Box>
          )}

          {activeStep === 2 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                {step2Title}
              </Typography>

              {submitError ? (
                <Box sx={{ mb: 2, color: 'error.main' }}>
                  {submitError}
                </Box>
              ) : null}

              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label={fullNameLabel}
                    value={bookingData.customerName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBookingData({
                      ...bookingData,
                      customerName: e.target.value
                    })}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label={emailLabel}
                    type="email"
                    value={bookingData.customerEmail}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBookingData({
                      ...bookingData,
                      customerEmail: e.target.value
                    })}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label={phoneLabel}
                    value={bookingData.customerPhone}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBookingData({
                      ...bookingData,
                      customerPhone: e.target.value
                    })}
                  />
                </Grid>

                {bookingData.partySize > 1 ? (
                  <Grid item xs={12}>
                    <Typography variant="subtitle1" sx={{ mt: 1, mb: 1 }}>
                      Additional Names
                    </Typography>
                    <Grid container spacing={2}>
                      {partyNames.map((name, idx) => (
                        <Grid key={idx} item xs={12} md={6}>
                          <TextField
                            fullWidth
                            label={`Guest ${idx + 2} Name`}
                            value={name}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                              const next = [...partyNames];
                              next[idx] = e.target.value;
                              setBookingData({ ...bookingData, partyNames: next });
                            }}
                          />
                        </Grid>
                      ))}
                    </Grid>
                  </Grid>
                ) : null}
              </Grid>

              <Paper sx={{ p: 3, mt: 3, backgroundColor: '#e8f5e8' }}>
                <Typography variant="h6" gutterBottom>
                  {summaryTitle}
                </Typography>
                <Typography variant="body1">
                  <strong>{summaryDateLabel}:</strong> {bookingData.date}
                </Typography>
                <Typography variant="body1">
                  <strong>{summaryTimeLabel}:</strong> {bookingData.timeSlots?.length ? bookingData.timeSlots.join(', ') : ''}
                </Typography>
                <Typography variant="body1">
                  <strong>{summaryLessonLabel}:</strong> {lessonTypes.find(lt => lt.key === selectedLessonType)?.display_name}
                </Typography>
                <Typography variant="body1">
                  <strong>{summaryPartySizeLabel}:</strong> {bookingData.partySize}
                </Typography>
                <Typography variant="h6" sx={{ mt: 2 }}>
                  <strong>{totalLabel}: ${calculateTotal()}</strong>
                </Typography>
              </Paper>
            </Box>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
            <Button
              disabled={activeStep === 0}
              onClick={handleBack}
            >
              {backLabel}
            </Button>
            <Button
              variant="contained"
              onClick={handleNext}
              disabled={submitting || !canProceed()}
              sx={{
                backgroundColor: '#20B2AA',
                '&:hover': { backgroundColor: '#1A9A9A' }
              }}
            >
              {activeStep === steps.length - 1 ? (submitting ? 'Submitting…' : submitLabel) : nextLabel}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default BookingCalendar;
