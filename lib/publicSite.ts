export const publicPages = ['', 'lessons', 'book', 'gallery', 'mission_statement', 'about_jaz', 'team', 'faq', 'contact'] as const;
export const publicLocales = ['en', 'es'] as const;
export type PublicLocale = typeof publicLocales[number];
export type PublicPage = typeof publicPages[number];

export function siteOrigin() {
    const configured = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.sunsetsurfacademy.com';
    return new URL(configured).origin;
}

export function publicPagePath(locale: string, page: PublicPage) {
    return `/${locale}${page ? `/${page}` : ''}`;
}

export function publicPageMediaPrefix(page: PublicPage) {
    if (page === '') return 'home.';
    if (page === 'mission_statement') return 'mission.';
    if (page === 'book' || page === 'faq' || page === 'about_jaz') return `page.${page}.`;
    return `${page}.`;
}
