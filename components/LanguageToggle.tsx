'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Button } from '@mui/material';
import { Language } from '@mui/icons-material';
import useContentBundle from '@/hooks/useContentBundle';

const FALLBACK_COPY = 'Content unavailable';

const LanguageToggle: React.FC<{ tone?: 'light' | 'inverse' }> = ({ tone = 'light' }) => {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const nav = useContentBundle('ui.');

  const enLabel = nav.t('ui.nav.langToggle.en', FALLBACK_COPY);
  const esLabel = nav.t('ui.nav.langToggle.es', FALLBACK_COPY);

  const switchLanguage = () => {
    const newLocale = locale === 'en' ? 'es' : 'en';
    const newPathname = pathname.replace(`/${locale}`, `/${newLocale}`);
    router.push(newPathname);
  };

  return (
    <Button
      onClick={switchLanguage}
      startIcon={<Language />}
      variant="outlined"
      size="small"
      sx={{
        color: tone === 'inverse' ? '#fff' : 'primary.dark',
        borderColor: tone === 'inverse' ? 'rgba(255,255,255,0.72)' : 'rgba(7,85,80,0.32)',
        '&:hover': {
          borderColor: tone === 'inverse' ? '#fff' : 'primary.main',
          backgroundColor: tone === 'inverse' ? 'rgba(255,255,255,0.12)' : 'rgba(13,114,108,0.08)'
        }
      }}
    >
      {locale === 'en' ? esLabel : enLabel}
    </Button>
  );
};

export default LanguageToggle;
