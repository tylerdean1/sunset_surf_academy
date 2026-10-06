'use client';

import Link from 'next/link';
import { useLocale } from 'next-intl';
import { usePathname } from 'next/navigation';
import { Box, Button, Container, Divider, Typography } from '@mui/material';
import { getPublicNavigation, isPublicSitePath } from '@/lib/publicNavigation';
import type { PublicLocale } from '@/lib/publicSite';

export default function PublicFooter() {
  const locale = useLocale() as PublicLocale;
  const pathname = usePathname();
  if (!isPublicSitePath(pathname, locale)) return null;

  const navigation = getPublicNavigation(locale);
  const footerLinks = navigation.filter(({ key }) => ['lessons', 'gallery', 'about', 'faq', 'contact'].includes(key));
  const copy = locale === 'es'
    ? {
        heading: '¿Listo para una clase de surf?',
        description: 'Elige una lección y envía tu solicitud para comenzar.',
        lessons: 'Reservar una clase',
        contact: 'Contáctanos',
        location: 'Lecciones de surf en Rincón, Puerto Rico',
        navigation: 'Navegación del sitio',
      }
    : {
        heading: 'Ready for a surf lesson?',
        description: 'Choose a lesson and send a request to get started.',
        lessons: 'Book a lesson',
        contact: 'Contact us',
        location: 'Surf lessons in Rincón, Puerto Rico',
        navigation: 'Site navigation',
      };

  return (
    <Box component="footer" sx={{ color: '#fff', bgcolor: '#073F3D' }}>
      <Container maxWidth="xl" sx={{ py: { xs: 5, md: 6 } }}>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: { xs: 'flex-start', md: 'center' }, justifyContent: 'space-between', gap: 3 }}>
          <Box sx={{ maxWidth: 590 }}>
            <Typography component="h2" variant="h4" sx={{ fontSize: { xs: '1.8rem', md: '2.2rem' }, color: '#fff', mb: 1.25 }}>
              {copy.heading}
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.8)', maxWidth: 540 }}>{copy.description}</Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1.25, flexWrap: 'wrap' }}>
            <Button component={Link} href={`/${locale}/book`} variant="contained" sx={{ minHeight: 46, px: 2.25, bgcolor: '#F2B85F', color: '#173334', '&:hover': { bgcolor: '#EAA943' } }}>
              {copy.lessons}
            </Button>
            <Button component={Link} href={`/${locale}/contact`} variant="outlined" sx={{ minHeight: 46, px: 2.25, color: '#fff', borderColor: 'rgba(255,255,255,0.55)', '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,0.08)' } }}>
              {copy.contact}
            </Button>
          </Box>
        </Box>

        <Divider sx={{ my: 4, borderColor: 'rgba(255,255,255,0.18)' }} />

        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: { xs: 'flex-start', md: 'center' }, justifyContent: 'space-between', gap: 2.5 }}>
          <Box>
            <Typography sx={{ fontWeight: 750, letterSpacing: '-0.02em' }}>Sunset Surf Academy</Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.72)', mt: 0.25 }}>{copy.location}</Typography>
          </Box>
          <Box component="nav" aria-label={copy.navigation} sx={{ display: 'flex', gap: { xs: 1.5, sm: 2.5 }, flexWrap: 'wrap' }}>
            {footerLinks.map((item) => (
              <Typography
                component={Link}
                key={item.key}
                href={item.href}
                variant="body2"
                sx={{ color: 'rgba(255,255,255,0.82)', textDecoration: 'none', '&:hover': { color: '#fff', textDecoration: 'underline' }, '&:focus-visible': { outline: '2px solid #F2B85F', outlineOffset: 3 } }}
              >
                {item.label}
              </Typography>
            ))}
          </Box>
        </Box>
        <Typography variant="caption" sx={{ display: 'block', mt: 3.5, color: 'rgba(255,255,255,0.56)' }}>
          © {new Date().getFullYear()} Sunset Surf Academy
        </Typography>
      </Container>
    </Box>
  );
}
