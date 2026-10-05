'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { ContentBundleResponse } from '@/types/contentBundle';
import type { Database } from '@/lib/database.types';
import type { HomeSectionMetaRow } from '@/lib/sections/parseHomeSections';

type PageSectionRow = Database['public']['Functions']['rpc_get_page_sections']['Returns'][number];

type PublicContentSeeds = {
    bundles: ContentBundleResponse[];
    sectionsByPage: Record<string, PageSectionRow[]>;
    homeSectionsMeta?: HomeSectionMetaRow[];
};

const PublicContentSeedContext = createContext<PublicContentSeeds | null>(null);

export default function PublicContentSeedProvider({ children, ...seeds }: PublicContentSeeds & { children: ReactNode }) {
    const parent = useContext(PublicContentSeedContext);
    const value = useMemo(() => ({
        bundles: [...(parent?.bundles || []), ...seeds.bundles],
        sectionsByPage: { ...parent?.sectionsByPage, ...seeds.sectionsByPage },
        homeSectionsMeta: seeds.homeSectionsMeta ?? parent?.homeSectionsMeta,
    }), [parent, seeds.bundles, seeds.sectionsByPage, seeds.homeSectionsMeta]);
    return <PublicContentSeedContext.Provider value={value}>{children}</PublicContentSeedContext.Provider>;
}

export function usePublicContentSeed(locale: string, prefix: string, mediaPrefix: string) {
    return useContext(PublicContentSeedContext)?.bundles.find(
        (bundle) => bundle.locale === locale && bundle.prefix === prefix && bundle.mediaPrefix === mediaPrefix
    );
}

export function usePublicPageSectionsSeed(pageKey: string) {
    return useContext(PublicContentSeedContext)?.sectionsByPage[pageKey];
}

export function usePublicHomeSectionsMetaSeed() {
    return useContext(PublicContentSeedContext)?.homeSectionsMeta;
}

export function usePublicCmsSeed(pageKey: string, locale: string) {
    const bundles = useContext(PublicContentSeedContext)?.bundles;
    return useMemo(() => {
        const bundle = bundles?.find((item) => item.locale === locale && Object.prototype.hasOwnProperty.call(item.strings, pageKey));
        return bundle ? { body: bundle.strings[pageKey], locale: bundle.locale, updated_at: bundle.updatedAtByKey[pageKey] || '' } : undefined;
    }, [bundles, pageKey, locale]);
}
