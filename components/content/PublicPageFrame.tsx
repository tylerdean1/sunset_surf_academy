import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import PublicContentSeedProvider from '@/components/content/PublicContentSeedContext';
import { getPublicContentBundle, getPublishedPageSections, getPublicHomeSectionsMeta } from '@/lib/server/publicContent';
import { publicLocales, publicPageMediaPrefix, type PublicLocale, type PublicPage } from '@/lib/publicSite';
import { publicPageMetadata } from '@/lib/server/publicMetadata';
import type { ContentBundleResponse } from '@/types/contentBundle';

type Props = { children: ReactNode; params: Promise<{ locale: string }> };

async function resolveLocale(params: Props['params']) {
    const { locale } = await params;
    if (!publicLocales.includes(locale as PublicLocale)) notFound();
    return locale as PublicLocale;
}

export function createPublicPageMetadata(page: PublicPage) {
    return async function generateMetadata({ params }: Pick<Props, 'params'>) {
        return publicPageMetadata(await resolveLocale(params), page);
    };
}

export function createPublicPageLayout(page: PublicPage) {
    return async function PublicPageLayout({ children, params }: Props) {
        const locale = await resolveLocale(params);
        const pageKey = page || 'home';
        const [pageBundle, sections, homeSectionsMeta] = await Promise.all([
            getPublicContentBundle(locale, `page.${pageKey}.`, publicPageMediaPrefix(page)),
            getPublishedPageSections(pageKey),
            page === '' ? getPublicHomeSectionsMeta() : undefined,
        ]);
        const bundles = [pageBundle].filter((item): item is ContentBundleResponse => !!item);
        if (sections?.length || homeSectionsMeta?.length) {
            const sectionBundle = await getPublicContentBundle(locale, 'section.');
            if (sectionBundle) bundles.push(sectionBundle);
            if (pageKey !== 'home') {
                const homeBundle = await getPublicContentBundle(locale, 'page.home.', 'home.');
                if (homeBundle) bundles.push(homeBundle);
            }
        }
        return (
            <PublicContentSeedProvider bundles={bundles} sectionsByPage={sections ? { [pageKey]: sections } : {}} homeSectionsMeta={homeSectionsMeta}>
                {children}
            </PublicContentSeedProvider>
        );
    };
}
