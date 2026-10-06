import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import Navigation from '../../components/Navigation';
import type { Metadata } from 'next';
import AppLoadingFrame from '@/components/AppLoadingFrame';
import PublicContentSeedProvider from '@/components/content/PublicContentSeedContext';
import { getPublicContentBundle } from '@/lib/server/publicContent';
import { type PublicLocale, siteOrigin } from '@/lib/publicSite';
import type { ContentBundleResponse } from '@/types/contentBundle';
import PublicFooter from '@/components/PublicFooter';

const locales = ['en', 'es'];

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!locales.includes(locale)) notFound();
  return {
    metadataBase: new URL(siteOrigin()),
    title: 'Sunset Surf Academy',
    robots: { index: false, follow: false },
    icons: {
      icon: [{ url: '/SSA_Orange_Logo.png', type: 'image/png' }],
    },
  };
}

export default async function LocaleLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!locales.includes(locale)) notFound();
  setRequestLocale(locale);
  const [messages, nav] = await Promise.all([
    getMessages({ locale }),
    getPublicContentBundle(locale as PublicLocale, 'ui.', 'nav.'),
  ]);
  const bundles = [nav].filter((item): item is ContentBundleResponse => !!item);
  // Other public controls share the UI strings but do not consume navigation media.
  if (nav) bundles.push({ ...nav, mediaPrefix: 'ui.', media: [] });

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <PublicContentSeedProvider bundles={bundles} sectionsByPage={{}}>
        <AppLoadingFrame locale={locale}>
          <Navigation />
          <main className="pt-16">{children}</main>
          <PublicFooter />
        </AppLoadingFrame>
      </PublicContentSeedProvider>
    </NextIntlClientProvider>
  );
}
