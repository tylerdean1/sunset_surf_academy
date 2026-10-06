"use client";

import { useLocale } from 'next-intl';
import { Container, Typography, Grid, Box, Alert, CircularProgress } from '@mui/material';
import React, { useEffect, useMemo, useState } from 'react';
import LessonCard from '../../../components/LessonCard';
import useCmsPageBody from '../../../hooks/useCmsPageBody';
import { isEmptyDoc } from '../../../lib/cmsRichText';
import { useAdminEdit } from '@/components/admin/edit/AdminEditContext';
import EditableRichTextBlock from '@/components/admin/edit/EditableRichTextBlock';
import EditableInlineText from '@/components/admin/edit/EditableInlineText';
import ContentBundleProvider, { useContentBundleContext } from '@/components/content/ContentBundleContext';
import type { Database } from '@/lib/database.types';

type LessonTypeRow = Database['public']['Tables']['lesson_types']['Row'];

function formatUsdPerPersonFromCents(cents: number | null | undefined): string {
  if (cents == null) return '—';
  const dollars = Number(cents) / 100;
  if (!Number.isFinite(dollars)) return '—';
  return dollars.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

export default function LessonsPage() {
  return (
    <ContentBundleProvider prefix="page.lessons." mediaPrefix="lessons.">
      <LessonsInner />
    </ContentBundleProvider>
  );
}

function LessonsInner() {
  const locale = useLocale();
  const { enabled: adminEdit } = useAdminEdit();
  const cms = useCmsPageBody('page.lessons.body', locale);
  const hasCms = !cms.loading && !cms.error && !isEmptyDoc(cms.body);
  const ctx = useContentBundleContext();
  const strings = ctx?.strings ?? {};
  const pricesUrl = (ctx?.media || []).find((m) => m?.slot_key === 'lessons.prices')?.url || '';
  const fallbackCopy = 'Content unavailable';
  const tDb = (key: string, fallback: string) => {
    const v = strings[key];
    return typeof v === 'string' && v.trim().length > 0 ? v : fallback;
  };
  const pricesAlt = tDb('page.lessons.pricesAlt', fallbackCopy);

  const [lessonTypes, setLessonTypes] = useState<LessonTypeRow[]>([]);
  const [typesLoading, setTypesLoading] = useState(true);
  const [typesError, setTypesError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setTypesLoading(true);
      setTypesError(null);
      try {
        const res = await fetch('/api/lesson-types', { cache: 'no-store' });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json?.ok === false) {
          throw new Error(json?.message || `Failed to load lesson types (${res.status})`);
        }
        const items = Array.isArray(json?.lessonTypes) ? (json.lessonTypes as LessonTypeRow[]) : [];
        if (!alive) return;
        setLessonTypes(items);
      } catch (e: any) {
        if (!alive) return;
        setTypesError(e?.message || 'Failed to load lesson types');
      } finally {
        if (!alive) return;
        setTypesLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const includesFallback = useMemo(() => [fallbackCopy, fallbackCopy, fallbackCopy, fallbackCopy], [fallbackCopy]);

  return (
    <Container maxWidth="lg" sx={{ py: 8 }}>
      <Box textAlign="center" sx={{ mb: 6 }}>
        <Typography variant="h2" gutterBottom color="primary.main">
          <EditableInlineText cmsKey="page.lessons.title" fallback={fallbackCopy}>
            {(v) => <>{v}</>}
          </EditableInlineText>
        </Typography>
        <Typography variant="h5" color="text.secondary">
          <EditableInlineText
            cmsKey="page.lessons.subtitle"
            fallback={fallbackCopy}
            multiline
            fullWidth
          >
            {(v) => <>{v}</>}
          </EditableInlineText>
        </Typography>

        {hasCms || adminEdit ? (
          <Box sx={{ mt: 3, textAlign: 'left' }}>
            <EditableRichTextBlock cmsKey="lessons" value={cms.body || ''} emptyPlaceholder="Lessons page body" />
          </Box>
        ) : null}
        {/* Main prices image */}
        <Box sx={{ mt: 4 }}>
          {pricesUrl ? (
            <Box component="img" src={pricesUrl} alt={pricesAlt} sx={{ width: '100%', height: 'auto', maxHeight: 600, objectFit: 'contain', borderRadius: 1 }} />
          ) : null}

          {/* Photo bar removed per request */}
        </Box>
      </Box>

      {typesLoading ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2 }}>
          <CircularProgress size={22} />
          <Typography color="text.secondary">{tDb('page.lessons.loadingLessonTypes', 'Loading lessons…')}</Typography>
        </Box>
      ) : typesError ? (
        <Alert severity="warning" sx={{ mt: 2 }}>
          {typesError}
        </Alert>
      ) : (
        <Grid container spacing={4} justifyContent="center">
          {lessonTypes.map((lt) => (
            <Grid key={lt.key} item xs={12} md={4}>
              <LessonCard
                title={lt.display_name || fallbackCopy}
                price={formatUsdPerPersonFromCents(lt.price_per_person_cents)}
                duration={fallbackCopy}
                location={fallbackCopy}
                description={lt.description || ''}
                includes={includesFallback}
                cmsKeyBase={`page.lessons.${lt.key}`}
                cmsFields={{ title: false, price: false, description: false }}
                bookLessonTypeId={lt.key}
              />
            </Grid>
          ))}
        </Grid>
      )}
    </Container>
  );
}
