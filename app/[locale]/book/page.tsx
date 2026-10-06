'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Container, Typography, Box, Alert } from '@mui/material';
import BookingCalendar, { type BookingData } from '../../../components/BookingCalendar';
import ContentBundleProvider from '@/components/content/ContentBundleContext';
import { useContentBundleContext } from '@/components/content/ContentBundleContext';

export default function BookPage() {
  return (
    <ContentBundleProvider prefix="page.book.">
      <BookInner />
    </ContentBundleProvider>
  );
}

function BookInner() {
  const searchParams = useSearchParams();
  const [bookingComplete, setBookingComplete] = useState(false);
  const [emailDelivered, setEmailDelivered] = useState(false);
  const locale = useLocale();
  const initialLessonTypeId = searchParams.get('lesson') || undefined;
  const ctx = useContentBundleContext();
  const strings = ctx?.strings ?? {};
  const fallbackCopy = 'Content unavailable';
  const tDb = (key: string, fallback: string) => {
    const v = strings[key];
    return typeof v === 'string' && v.trim().length > 0 ? v : fallback;
  };

  const title = tDb('page.book.title', fallbackCopy);
  const requestReceived = tDb('page.book.requestReceived', fallbackCopy);

  const handleBookingComplete = (_booking: BookingData, delivered: boolean) => {
    // Admin follows up manually (no in-app payment processing)
    setEmailDelivered(delivered);
    setBookingComplete(true);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 8 }}>
      <Box textAlign="center" sx={{ mb: 6 }}>
        <Typography variant="h2" gutterBottom color="primary.main">
          {title}
        </Typography>
      </Box>

      {bookingComplete ? (
        <>
          <Alert severity="success" sx={{ mb: 2 }}>{requestReceived}</Alert>
          {!emailDelivered ? (
            <Alert severity="warning" sx={{ mb: 4 }}>
              {locale === 'es'
                ? 'Tu solicitud se guardó. Los correos de confirmación están en espera y volveremos a intentar enviarlos automáticamente. Si no recibes noticias, escríbenos a sunsetsurfacademy@gmail.com.'
                : 'Your request was saved. Confirmation emails are queued, and we will retry sending them automatically. If you do not hear from us, email sunsetsurfacademy@gmail.com.'}
            </Alert>
          ) : null}
        </>
      ) : (
        <BookingCalendar onBookingComplete={handleBookingComplete} initialLessonTypeId={initialLessonTypeId} />
      )}
    </Container>
  );
}
