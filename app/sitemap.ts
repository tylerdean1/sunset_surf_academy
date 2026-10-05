import type { MetadataRoute } from 'next';
import { publicLocales, publicPages, publicPagePath, siteOrigin } from '@/lib/publicSite';

export default function sitemap(): MetadataRoute.Sitemap {
    const origin = siteOrigin();
    return publicPages.flatMap((page) => publicLocales.map((locale) => ({
        url: `${origin}${publicPagePath(locale, page)}`,
        alternates: { languages: Object.fromEntries(publicLocales.map((language) => [language, `${origin}${publicPagePath(language, page)}`])) },
    })));
}
