import type { PublicLocale } from './publicSite';

export type PublicNavigationKey = 'home' | 'lessons' | 'schedule' | 'gallery' | 'about' | 'faq' | 'contact';

export interface PublicNavigationItem {
    key: PublicNavigationKey;
    href: string;
    label: string;
}

export interface HomeHeroDefaults {
    title: string;
    subtitle: string;
    primaryAction: string;
    secondaryAction: string;
    primaryHref: string;
    secondaryHref: string;
}

const labels: Record<PublicLocale, Record<PublicNavigationKey, string>> = {
    en: {
        home: 'Home',
        lessons: 'Lessons',
        schedule: 'Book now',
        gallery: 'Gallery',
        about: 'About',
        faq: 'FAQ',
        contact: 'Contact',
    },
    es: {
        home: 'Inicio',
        lessons: 'Lecciones',
        schedule: 'Reservar',
        gallery: 'Galería',
        about: 'Nosotros',
        faq: 'Preguntas',
        contact: 'Contacto',
    },
};

export function getPublicNavigation(locale: PublicLocale): PublicNavigationItem[] {
    return [
        { key: 'home', href: `/${locale}`, label: labels[locale].home },
        { key: 'lessons', href: `/${locale}/lessons`, label: labels[locale].lessons },
        { key: 'schedule', href: `/${locale}/book`, label: labels[locale].schedule },
        { key: 'gallery', href: `/${locale}/gallery`, label: labels[locale].gallery },
        { key: 'about', href: `/${locale}/mission_statement`, label: labels[locale].about },
        { key: 'faq', href: `/${locale}/faq`, label: labels[locale].faq },
        { key: 'contact', href: `/${locale}/contact`, label: labels[locale].contact },
    ];
}

export function getHomeHeroDefaults(locale: PublicLocale): HomeHeroDefaults {
    if (locale === 'es') {
        return {
            title: 'Aprende a surfear en Rincón',
            subtitle: 'Instrucción profesional de surf en las hermosas aguas de Rincón, Puerto Rico.',
            primaryAction: 'Reserva tu clase',
            secondaryAction: 'Conócenos',
            primaryHref: '/es/book',
            secondaryHref: '/es/mission_statement',
        };
    }

    return {
        title: 'Learn to Surf in Rincón',
        subtitle: 'Professional surf instruction in the beautiful waters of Rincón, Puerto Rico.',
        primaryAction: 'Book your lesson',
        secondaryAction: 'Learn more',
        primaryHref: '/en/book',
        secondaryHref: '/en/mission_statement',
    };
}

export function isCurrentPublicRoute(pathname: string, href: string, isHome: boolean): boolean {
    if (isHome) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
}

export function isPublicSitePath(pathname: string | null, locale: PublicLocale): boolean {
    if (!pathname) return false;
    const adminPrefix = `/${locale}/admin`;
    const adminLoginPath = `/${locale}/adminlogin`;
    return !(
        pathname === adminPrefix || pathname.startsWith(`${adminPrefix}/`) ||
        pathname === adminLoginPath || pathname.startsWith(`${adminLoginPath}/`)
    );
}
