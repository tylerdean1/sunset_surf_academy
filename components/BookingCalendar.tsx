'use client';

import React, { useEffect, useState } from 'react';
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

  // generate 30-minute slots from 07:00 to 15:30 (last slot ends at 16:00)
  const generateTimeSlots = () => {
    const slots: string[] = [];
    for (let hour = 7; hour <= 15; hour++) {
      const h12 = (hour % 12) === 0 ? 12 : hour % 12;
      const ampm = hour < 12 ? 'AM' : 'PM';
      slots.push(`${h12}:00 ${ampm}`);
      slots.push(`${h12}:30 ${ampm}`);
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();

  useEffect(() => {
    setBookingData((prev) => {
      if (prev.lessonType) return prev;
      const isValidInitial = typeof initialLessonTypeId === 'string' && lessonTypes.some((lt) => lt.key === initialLessonTypeId);
      return { ...prev, lessonType: (isValidInitial ? initialLessonTypeId : (lessonTypes[0]?.key || '')) };
    });
  }, [initialLessonTypeId, lessonTypes]);

  useEffect(() => {
    setBookingData((prev) => {
      const expected = Math.max(0, Number(prev.partySize || 1) - 1);
      if (prev.partyNames.length === expected) return prev;
      const next = [...prev.partyNames];
      while (next.length < expected) next.push('');
      if (next.length > expected) next.length = expected;
      return { ...prev, partyNames: next };
    });
  }, [bookingData.partySize]);

  const dollarsFromCents = (cents: number | null | undefined) => {
    if (cents == null) return 0;
    const n = Number(cents);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.round(n)) / 100;
  };

  const calculateTotal = () => {
    const lt = lessonTypes.find((x) => x.key === bookingData.lessonType);
    const unit = dollarsFromCents(lt?.price_per_person_cents);
    return lt ? unit * bookingData.partySize : 0;
  };

  const handleNext = async () => {
    if (activeStep < steps.length - 1) {
      setActiveStep(activeStep + 1);
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      const res = await fetch('/api/booking-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: bookingData.customerName,
          customer_email: bookingData.customerEmail,
          customer_phone: bookingData.customerPhone,
          party_size: bookingData.partySize,
          party_names: bookingData.partyNames,
          requested_date: bookingData.date,
          requested_time_labels: bookingData.timeSlots,
          requested_lesson_type: bookingData.lessonType,
          locale,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(String((json as any)?.error || 'Failed to submit request'));
      }

      const notifications = (json as any)?.notifications;
      onBookingComplete(bookingData, notifications?.admin === 'sent' && notifications?.customer === 'sent');
    } catch (err: any) {
      setSubmitError(err?.message || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    setActiveStep(activeStep - 1);
  };

  const canProceed = () => {
    switch (activeStep) {
      case 0:
        return Boolean(bookingData.lessonType && bookingData.partySize > 0);
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
                      value={bookingData.lessonType}
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
                      partySize: parseInt(e.target.value) || 1
                    })}
                    inputProps={{ min: 1, max: 8 }}
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
                    .replace('{price}', String(dollarsFromCents(lessonTypes.find((lt: LessonType) => lt.key === bookingData.lessonType)?.price_per_person_cents || 0)))}
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
                      {bookingData.partyNames.map((name, idx) => (
                        <Grid key={idx} item xs={12} md={6}>
                          <TextField
                            fullWidth
                            label={`Guest ${idx + 2} Name`}
                            value={name}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                              const next = [...bookingData.partyNames];
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
                  <strong>{summaryLessonLabel}:</strong> {lessonTypes.find(lt => lt.key === bookingData.lessonType)?.display_name}
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
              disabled={!canProceed()}
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
