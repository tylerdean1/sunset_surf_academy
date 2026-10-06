"use client";

import { useMemo } from 'react';
import { Container, Typography, Grid, Box, Card, Alert } from '@mui/material';
import ContentBundleProvider from '@/components/content/ContentBundleContext';
import { useContentBundleContext } from '@/components/content/ContentBundleContext';
import type { ContentBundleMediaItem } from '@/types/contentBundle';
import usePageSections from '@/hooks/usePageSections';
import PageSectionsRenderer from '@/components/sections/PageSectionsRenderer';

export default function GalleryPage() {
  const sections = usePageSections('gallery');
  if (sections.sections.length > 0) {
    return <PageSectionsRenderer pageKey="gallery" sections={sections.sections} />;
  }

  return (
    <ContentBundleProvider prefix="page.gallery." mediaPrefix="gallery.">
      <GalleryInner />
    </ContentBundleProvider>
  );
}

function GalleryInner() {
  const ctx = useContentBundleContext();
  const loading = ctx?.loading ?? true;
  const error = ctx?.error ?? null;
  const strings = ctx?.strings ?? {};
  const media = ctx?.media ?? [];
  const fallbackCopy = 'Content unavailable';

  const tDb = (key: string, fallback: string) => {
    const v = strings[key];
    return typeof v === 'string' && v.trim().length > 0 ? v : fallback;
  };

  const desiredCount = (() => {
    const raw = strings['page.gallery.images.count'];
    const n = raw != null ? Number(raw) : NaN;
    if (!Number.isFinite(n)) return null;
    return Math.max(0, Math.min(100, Math.floor(n)));
  })();

  const rows = useMemo(() => {
    const items = [...media]
      .filter((m) => String(m?.slot_key || '').startsWith('gallery.images.'))
      .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));

    const sliced = desiredCount == null ? items : items.slice(0, desiredCount);
    return sliced.filter((m) => !!m.url);
  }, [media, desiredCount]);

  return (
    <Container maxWidth="lg" sx={{ py: 8 }}>
      <Box textAlign="center" sx={{ mb: 6 }}>
        <Typography variant="h2" gutterBottom color="primary.main">
          {tDb('page.gallery.title', fallbackCopy)}
        </Typography>
        <Typography variant="h5" color="text.secondary">
          {tDb('page.gallery.subtitle', fallbackCopy)}
        </Typography>
      </Box>

      {error ? (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      ) : null}

      {!error && !loading && rows.length === 0 ? (
        <Alert severity="info" sx={{ mb: 3 }}>
          {tDb('page.gallery.empty', fallbackCopy)}
        </Alert>
      ) : null}

      <Grid container spacing={3}>
        {rows.map((item: ContentBundleMediaItem) => (
          <Grid item xs={12} sm={6} md={4} key={item.slot_key}>
            <Card sx={{ borderRadius: 2, overflow: 'hidden' }}>
              <Box sx={{ position: 'relative', height: 250, background: 'hsl(var(--background))' }}>
                {item.asset_type === 'photo' ? (
                  <Box
                    component="img"
                    src={item.url}
                    alt={item.title}
                    loading="lazy"
                    sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                ) : (
                  <Box
                    component="video"
                    src={item.url}
                    controls
                    playsInline
                    sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                )}
              </Box>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Container>
  );
}
