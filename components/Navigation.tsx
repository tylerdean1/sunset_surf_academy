'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { usePathname } from 'next/navigation';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import IconButton from '@mui/material/IconButton';
import { Menu, Waves } from '@mui/icons-material';
import LanguageToggle from './LanguageToggle';
import useContentBundle from '@/hooks/useContentBundle';
import { getPublicNavigation, isCurrentPublicRoute } from '@/lib/publicNavigation';
import type { PublicLocale } from '@/lib/publicSite';

const Navigation: React.FC = () => {
  const locale = useLocale() as PublicLocale;
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [adminAccess, setAdminAccess] = useState<{ path: string; allowed: boolean } | null>(null);

  const bundle = useContentBundle('ui.', 'nav.');
  const logoUrl = bundle.mediaByKey('nav.logo')?.url || '';
  const navItems = getPublicNavigation(locale).map((item) => ({
    ...item,
    label: bundle.t(`ui.nav.${item.key}`, item.label),
  }));
  const brandName = bundle.t('ui.brandName', 'Sunset Surf Academy');
  const logoAlt = bundle.t('ui.nav.logoAlt', `${brandName} logo`);
  const openDrawerAria = bundle.t('ui.nav.aria.openDrawer', 'Open navigation menu');

  const onAdminPage = pathname === `/${locale}/admin`;
  const isAdmin = onAdminPage && adminAccess?.path === pathname && adminAccess.allowed;
  const publicLinks = navItems.filter((item) => item.key !== 'schedule');
  const bookingLink = navItems.find((item) => item.key === 'schedule')!;

  React.useEffect(() => {
    let cancelled = false;
    if (!onAdminPage) return () => { cancelled = true; };

    (async () => {
      try {
        const res = await fetch('/api/admin/status');
        const body = await res.json().catch(() => ({}));
        if (!cancelled) setAdminAccess({ path: pathname, allowed: !!body?.isAdmin });
      } catch {
        if (!cancelled) setAdminAccess({ path: pathname, allowed: false });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [onAdminPage, pathname]);

  const closeDrawer = () => setMobileOpen(false);
  const renderBrand = (compact = false) => (
    <Box
      component={onAdminPage && isAdmin ? 'div' : Link}
      {...(onAdminPage && isAdmin ? {} : { href: `/${locale}` })}
      aria-label={onAdminPage && isAdmin ? undefined : `${brandName} home`}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: { xs: 1, sm: 1.25 },
        minWidth: 0,
        color: 'inherit',
        textDecoration: 'none',
        borderRadius: 1,
        '&:focus-visible': { outline: '3px solid #F4B860', outlineOffset: 3 },
      }}
    >
      {logoUrl ? (
        <Box
          component="img"
          src={logoUrl}
          alt={logoAlt}
          sx={{ width: compact ? 36 : 42, height: compact ? 36 : 42, objectFit: 'contain', flexShrink: 0 }}
        />
      ) : (
        <Waves aria-hidden="true" sx={{ fontSize: compact ? 26 : 30, flexShrink: 0 }} />
      )}
      <Typography component="span" sx={{ fontWeight: 750, fontSize: { xs: '0.98rem', sm: '1.08rem' }, letterSpacing: '-0.025em', lineHeight: 1.15 }}>
        {brandName}
      </Typography>
    </Box>
  );

  const renderDesktopLink = (item: typeof publicLinks[number]) => {
    const active = isCurrentPublicRoute(pathname, item.href, item.key === 'home');
    if (onAdminPage && isAdmin) {
      return (
        <Button key={item.key} color="inherit" disabled sx={{ minWidth: 0, px: 1, fontSize: '0.92rem' }}>
          {item.label}
        </Button>
      );
    }

    return (
      <Button
        key={item.key}
        component={Link}
        href={item.href}
        color="inherit"
        aria-current={active ? 'page' : undefined}
        sx={{
          position: 'relative',
          minWidth: 0,
          px: 1,
          fontSize: '0.92rem',
          color: 'rgba(255,255,255,0.9)',
          '&::after': {
            content: '""',
            position: 'absolute',
            left: 8,
            right: 8,
            bottom: 4,
            height: 2,
            borderRadius: 2,
            backgroundColor: 'secondary.light',
            transform: active ? 'scaleX(1)' : 'scaleX(0)',
            transition: 'transform 160ms ease',
          },
          '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff' },
        }}
      >
        {item.label}
      </Button>
    );
  };

  const drawer = (
    <Box sx={{ width: 300, maxWidth: '86vw', p: 2 }}>
      <Box sx={{ px: 1, py: 1.5, color: 'primary.dark' }}>{renderBrand(true)}</Box>
      <List component="nav" aria-label={bundle.t('ui.nav.aria.main', 'Main navigation')} sx={{ display: 'grid', gap: 0.5 }}>
        {navItems.map((item) => {
          const active = isCurrentPublicRoute(pathname, item.href, item.key === 'home');
          const isBooking = item.key === 'schedule';
          return (
            <ListItem key={item.key} disablePadding>
              {onAdminPage && isAdmin ? (
                <ListItemButton disabled sx={{ borderRadius: 2 }}>
                  <ListItemText primary={item.label} />
                </ListItemButton>
              ) : (
                <ListItemButton
                  component={Link}
                  href={item.href}
                  onClick={closeDrawer}
                  aria-current={active ? 'page' : undefined}
                  sx={{
                    borderRadius: 2,
                    fontWeight: isBooking ? 700 : 550,
                    color: active ? 'primary.dark' : 'text.primary',
                    bgcolor: isBooking ? 'secondary.light' : active ? 'rgba(13,114,108,0.08)' : 'transparent',
                    '&:hover': { bgcolor: isBooking ? 'secondary.main' : 'action.hover' },
                  }}
                >
                  <ListItemText primary={item.label} />
                </ListItemButton>
              )}
            </ListItem>
          );
        })}
      </List>
      <Box sx={{ px: 1, pt: 2 }}><LanguageToggle tone="light" /></Box>
    </Box>
  );

  return (
    <>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          color: '#fff',
          background: 'linear-gradient(105deg, rgba(8,83,80,0.97), rgba(11,105,99,0.94))',
          backdropFilter: 'blur(14px)',
          borderBottom: '1px solid rgba(255,255,255,0.13)',
        }}
      >
        <Toolbar sx={{ minHeight: 64, px: { xs: 2, sm: 3, lg: 4 }, gap: { xs: 1, md: 2 } }}>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>{renderBrand()}</Box>

          <Box component="nav" aria-label={bundle.t('ui.nav.aria.main', 'Main navigation')} sx={{ display: { xs: 'none', lg: 'flex' }, gap: 0.25, alignItems: 'center' }}>
            {publicLinks.map(renderDesktopLink)}
            {!onAdminPage || !isAdmin ? (
              <Button
                component={Link}
                href={bookingLink.href}
                variant="contained"
                aria-current={isCurrentPublicRoute(pathname, bookingLink.href, false) ? 'page' : undefined}
                sx={{
                  ml: 1,
                  px: 2.1,
                  minHeight: 42,
                  bgcolor: 'secondary.light',
                  color: 'text.primary',
                  boxShadow: 'none',
                  '&:hover': { bgcolor: 'secondary.main', boxShadow: '0 5px 16px rgba(5,35,34,0.18)' },
                }}
              >
                {bookingLink.label}
              </Button>
            ) : null}
          </Box>

          <LanguageToggle tone="inverse" />
          <IconButton
            color="inherit"
            aria-label={openDrawerAria}
            aria-expanded={mobileOpen}
            aria-controls="public-navigation-drawer"
            edge="end"
            onClick={() => setMobileOpen((open) => !open)}
            sx={{ display: { xs: 'inline-flex', lg: 'none' }, ml: 0.25, border: '1px solid rgba(255,255,255,0.28)', borderRadius: 2 }}
          >
            <Menu />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Drawer
        id="public-navigation-drawer"
        anchor="right"
        open={mobileOpen}
        onClose={closeDrawer}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', lg: 'none' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: 320, maxWidth: '90vw', borderTopLeftRadius: 18, borderBottomLeftRadius: 18 },
        }}
      >
        {drawer}
      </Drawer>
    </>
  );
};

export default Navigation;
