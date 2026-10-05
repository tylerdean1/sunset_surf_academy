import type { MetadataRoute } from 'next';
import { siteOrigin } from '@/lib/publicSite';

export default function robots(): MetadataRoute.Robots {
    return {
        rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/admin', '/adminlogin', '/en/admin', '/es/admin', '/en/adminlogin', '/es/adminlogin'] },
        sitemap: `${siteOrigin()}/sitemap.xml`,
    };
}
