import HomePageClient from './HomePageClient';
import { createPublicPageLayout, createPublicPageMetadata } from '@/components/content/PublicPageFrame';

export const generateMetadata = createPublicPageMetadata('');
const HomeFrame = createPublicPageLayout('');

export default function HomePage({ params }: { params: Promise<{ locale: string }> }) {
    return HomeFrame({ params, children: <HomePageClient /> });
}
