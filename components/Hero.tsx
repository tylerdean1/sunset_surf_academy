'use client';

import React from 'react';
import { Box, Typography, Button, Container } from '@mui/material';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import EditableInlineText from '@/components/admin/edit/EditableInlineText';

interface HeroProps {
  title: string;
  subtitle: string;
  backgroundUrl?: string;
  primaryAction: string;
  secondaryAction?: string;
  primaryHref: string;
  secondaryHref?: string;
  cmsKeyBase?: string;
}

const Hero: React.FC<HeroProps> = ({
  title,
  subtitle,
  backgroundUrl,
  primaryAction,
  secondaryAction,
  primaryHref,
  secondaryHref,
  cmsKeyBase,
}) => {
  const locale = useLocale();
  const background = backgroundUrl
    ? `linear-gradient(90deg, rgba(4, 35, 39, 0.86) 0%, rgba(4, 42, 44, 0.65) 48%, rgba(4, 39, 42, 0.23) 100%), linear-gradient(0deg, rgba(5, 32, 34, 0.42) 0%, transparent 62%), url("${backgroundUrl}")`
    : 'linear-gradient(115deg, #083f43 0%, #0c696a 58%, #174f53 100%)';

  return (
    <Box
      component="section"
      aria-label={locale === 'es' ? 'Introducción' : 'Introduction'}
      sx={{
        minHeight: { xs: 'calc(100svh - 64px)', lg: 'min(820px, calc(100vh - 64px))' },
        backgroundColor: 'primary.dark',
        backgroundImage: background,
        backgroundSize: 'cover',
        backgroundPosition: 'center 44%',
        display: 'flex',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
        color: '#fff',
        '&::after': {
          content: '""',
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: 'radial-gradient(ellipse at 78% 44%, transparent 0%, rgba(3,27,30,0.12) 78%)',
        },
      }}
    >
      <Container maxWidth="xl" sx={{ position: 'relative', zIndex: 1, py: { xs: 8, sm: 10, lg: 11 } }}>
        <Box sx={{ maxWidth: 780, textAlign: { xs: 'center', md: 'left' } }}>
          <Typography
            component="p"
            variant="overline"
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
              mb: { xs: 2, md: 2.5 },
              px: 1.5,
              py: 0.6,
              border: '1px solid rgba(255,255,255,0.38)',
              borderRadius: 99,
              color: 'rgba(255,255,255,0.94)',
              fontSize: '0.74rem',
              fontWeight: 750,
              letterSpacing: '0.12em',
              lineHeight: 1.2,
              '&::before': { content: '""', width: 6, height: 6, borderRadius: '50%', bgcolor: 'secondary.light' },
            }}
          >
            RINCÓN, PUERTO RICO
          </Typography>

          <Typography
            variant="h1"
            component="h1"
            sx={{
              maxWidth: 780,
              fontWeight: 780,
              fontSize: 'clamp(2.7rem, 6.2vw, 5.25rem)',
              lineHeight: 1.01,
              letterSpacing: '-0.045em',
              textWrap: 'balance',
              textShadow: '0 2px 28px rgba(0,0,0,0.2)',
              mb: { xs: 2, md: 2.5 },
            }}
          >
            {cmsKeyBase ? (
              <EditableInlineText cmsKey={`${cmsKeyBase}.title`} fallback={title}>
                {(value) => <>{value}</>}
              </EditableInlineText>
            ) : title}
          </Typography>

          <Typography
            variant="h5"
            component="p"
            sx={{
              maxWidth: 620,
              mx: { xs: 'auto', md: 0 },
              mb: { xs: 3.5, md: 4 },
              color: 'rgba(255,255,255,0.91)',
              fontSize: { xs: '1.08rem', sm: '1.2rem', md: '1.32rem' },
              fontWeight: 400,
              lineHeight: 1.6,
              textShadow: '0 1px 12px rgba(0,0,0,0.18)',
            }}
          >
            {cmsKeyBase ? (
              <EditableInlineText cmsKey={`${cmsKeyBase}.subtitle`} fallback={subtitle} multiline fullWidth>
                {(value) => <>{value}</>}
              </EditableInlineText>
            ) : subtitle}
          </Typography>

          <Box sx={{ display: 'flex', gap: 1.5, justifyContent: { xs: 'center', md: 'flex-start' }, flexWrap: 'wrap' }}>
            <Button
              component={Link}
              href={primaryHref}
              variant="contained"
              size="large"
              sx={{
                minHeight: 54,
                px: 3.25,
                borderRadius: 99,
                bgcolor: 'secondary.light',
                color: 'text.primary',
                fontSize: '1rem',
                fontWeight: 750,
                boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                '&:hover': { bgcolor: 'secondary.main', transform: 'translateY(-1px)', boxShadow: '0 12px 28px rgba(0,0,0,0.22)' },
                transition: 'transform 160ms ease, background-color 160ms ease, box-shadow 160ms ease',
              }}
            >
              {cmsKeyBase ? (
                <EditableInlineText cmsKey={`${cmsKeyBase}.primaryAction`} fallback={primaryAction} showEditControl={false}>
                  {(value) => <>{value}</>}
                </EditableInlineText>
              ) : primaryAction}
            </Button>

            {secondaryAction && secondaryHref ? (
              <Button
                component={Link}
                href={secondaryHref}
                variant="outlined"
                size="large"
                sx={{
                  minHeight: 54,
                  px: 3,
                  borderRadius: 99,
                  borderColor: 'rgba(255,255,255,0.74)',
                  color: '#fff',
                  fontSize: '1rem',
                  '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,0.1)' },
                }}
              >
                {cmsKeyBase ? (
                  <EditableInlineText cmsKey={`${cmsKeyBase}.secondaryAction`} fallback={secondaryAction} showEditControl={false}>
                    {(value) => <>{value}</>}
                  </EditableInlineText>
                ) : secondaryAction}
              </Button>
            ) : null}
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

export default Hero;
