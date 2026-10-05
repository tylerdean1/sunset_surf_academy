import 'server-only';
import type { Metadata } from 'next';
import { getPublicContentBundle } from '@/lib/server/publicContent';
import { publicPagePath, publicPageMediaPrefix, siteOrigin, type PublicLocale, type PublicPage } from '@/lib/publicSite';

const labels: Record<PublicPage, [string, string]> = {
    '': ['Surf Lessons in Rincón, Puerto Rico', 'Lecciones de surf en Rincón, Puerto Rico'],
    lessons: ['Surf Lessons', 'Lecciones de surf'],
    book: ['Request a Surf Lesson', 'Solicita una lección de surf'],
    gallery: ['Surf Gallery', 'Galería de surf'],
    mission_statement: ['Our Mission', 'Nuestra misión'],
    about_jaz: ['About Jazmine', 'Acerca de Jazmine'],
    team: ['Our Surf Instructors', 'Nuestros instructores de surf'],
    faq: ['Surf Lesson FAQ', 'Preguntas sobre las lecciones de surf'],
    contact: ['Contact Us', 'Contáctanos'],
};

export async function publicPageMetadata(locale: PublicLocale, page: PublicPage): Promise<Metadata> {
    const key = page || 'home';
    const [bundle, ui] = await Promise.all([
        getPublicContentBundle(locale, `page.${key}.`, publicPageMediaPrefix(page)),
        page === '' ? getPublicContentBundle(locale, 'ui.', 'nav.') : undefined,
    ]);
    const fallback = labels[page][locale === 'es' ? 1 : 0];
    const rawTitle = bundle?.strings[`page.${key}.meta.title`] || bundle?.strings[`page.${key}.title`] || ui?.strings['ui.meta.title'];
    const pageTitle = rawTitle?.trim() || fallback;
    const title = pageTitle.includes('Sunset Surf Academy') ? pageTitle : `${pageTitle} | Sunset Surf Academy`;
    const fallbackDescription = locale === 'es'
        ? `${fallback} en Sunset Surf Academy, Rincón, Puerto Rico. Aprende sobre nuestras lecciones de surf e instructores y solicita una reserva.`
        : `${fallback} at Sunset Surf Academy in Rincón, Puerto Rico. Explore our surf lessons and instructors and request a lesson.`;
    const description = bundle?.strings[`page.${key}.meta.description`]?.trim() || ui?.strings['ui.meta.description']?.trim() || fallbackDescription;
    const canonical = publicPagePath(locale, page);
    return {
        metadataBase: new URL(siteOrigin()),
        title,
        description,
        robots: { index: true, follow: true },
        alternates: { canonical, languages: { en: publicPagePath('en', page), es: publicPagePath('es', page) } },
        openGraph: { type: 'website', siteName: 'Sunset Surf Academy', title, description, url: canonical, locale: locale === 'es' ? 'es_PR' : 'en_US', alternateLocale: [locale === 'es' ? 'en_US' : 'es_PR'] },
        twitter: { card: 'summary', title, description },
    };
}
