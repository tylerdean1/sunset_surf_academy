'use client';

import * as React from 'react';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { Box, Card, CardContent, Container, Grid, Typography } from '@mui/material';
import Hero from '@/components/Hero';
import GalleryCarousel from '@/components/GalleryCarousel';
import CmsRichTextRenderer from '@/components/CmsRichTextRenderer';
import ContentBundleProvider, { useContentBundleContext } from '@/components/content/ContentBundleContext';
import { parseHomeSections, type CardGroupSourceKey, type HomeSectionMetaRow } from '@/lib/sections/parseHomeSections';
import useCmsPageBody from '@/hooks/useCmsPageBody';
import useContentBundle from '@/hooks/useContentBundle';
import { getHomeHeroDefaults } from '@/lib/publicNavigation';

const TARGET_AUDIENCE_FALLBACK_IMAGES: string[] = [];
const FALLBACK_COPY = 'Content unavailable';

export default function HomeSectionsRenderer({ sections }: { sections: HomeSectionMetaRow[] }) {
    const parsed = React.useMemo(() => parseHomeSections(sections), [sections]);

    // Once we're in sections mode, bad rows are skipped and do NOT fall back to legacy.
    if (!parsed.length) return null;

    return (
        <ContentBundleProvider prefix="page.home." mediaPrefix="home.">
            <HomeSectionsInner sections={parsed} />
        </ContentBundleProvider>
    );
}

function HomeSectionsInner({
    sections,
}: {
    sections: Array<ReturnType<typeof parseHomeSections>[number]>;
}) {
    const locale = useLocale();
    const heroDefaults = getHomeHeroDefaults(locale as 'en' | 'es');
    const ctx = useContentBundleContext();
    const strings = ctx?.strings || {};
    const media = ctx?.media || [];

    const tDb = (key: string, fallback?: string) => {
        const v = strings[key];
        return typeof v === 'string' && v.trim().length > 0 ? v : fallback ?? '';
    };

    const mediaByKey = (slotKey: string) => media.find((m) => m?.slot_key === slotKey) || null;
    const mediaList = (slotKeyPrefix: string) =>
        [...media]
            .filter((m) => String(m?.slot_key || '').startsWith(slotKeyPrefix))
            .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));

    const targetAudienceImages = (() => {
        const fromDb = mediaList('home.target_audience.').map((m) => m.url).filter(Boolean);
        return fromDb.length ? fromDb : TARGET_AUDIENCE_FALLBACK_IMAGES;
    })();

    const galleryCardImages = (() => {
        return mediaList('home.cards.gallery.images.').map((m) => m.url).filter(Boolean);
    })();

    const heroBg = mediaByKey('home.hero')?.url || '';
    const teamCardImage = mediaByKey('home.cards.team.image')?.url || '';
    const teamImageAlt = tDb('page.home.cards.team.imageAlt', FALLBACK_COPY);

    const out: React.ReactNode[] = [];
    let i = 0;
    while (i < sections.length) {
        const s = sections[i];

        if (s.kind === 'hero') {
            out.push(
                <Hero
                    key={s.page_key}
                    title={tDb('page.home.hero.title', heroDefaults.title)}
                    subtitle={tDb('page.home.hero.subtitle', heroDefaults.subtitle)}
                    backgroundUrl={heroBg || undefined}
                    primaryAction={tDb('page.home.hero.primaryAction', heroDefaults.primaryAction)}
                    secondaryAction={tDb('page.home.hero.secondaryAction', heroDefaults.secondaryAction)}
                    primaryHref={tDb('page.home.hero.primaryHref', heroDefaults.primaryHref)}
                    secondaryHref={tDb('page.home.hero.secondaryHref', heroDefaults.secondaryHref)}
                    cmsKeyBase="page.home.hero"
                />
            );
            i += 1;
            continue;
        }

        if (s.kind === 'card_group') {
            const group: Array<{ page_key: string; sourceKey: CardGroupSourceKey }> = [];
            while (i < sections.length && sections[i].kind === 'card_group') {
                const s2 = sections[i];
                if (s2.kind === 'card_group') {
                    group.push({ page_key: s2.page_key, sourceKey: s2.sourceKey });
                }
                i += 1;
            }

            if (group.length) {
                out.push(
                    <Container key={group[0].page_key} maxWidth="lg" sx={{ py: 8 }}>
                        <Grid container spacing={4}>
                            {group.map((g) => (
                                <Grid key={g.page_key} item xs={12} md={4}>
                                    <CardGroupCard
                                        locale={locale}
                                        sourceKey={g.sourceKey}
                                        tDb={tDb}
                                        targetAudienceImages={targetAudienceImages}
                                        galleryCardImages={galleryCardImages}
                                        teamCardImage={teamCardImage}
                                        teamImageAlt={teamImageAlt}
                                    />
                                </Grid>
                            ))}
                        </Grid>
                    </Container>
                );
            }

            continue;
        }

        if (s.kind === 'rich_text') {
            out.push(<HomeRichTextBlock key={s.page_key} bodyKey={s.bodyKey} locale={locale} />);
            i += 1;
            continue;
        }

        if (s.kind === 'media') {
            out.push(<HomeMediaBlock key={s.page_key} sectionId={s.id} slotKey={s.slotKey} />);
            i += 1;
            continue;
        }

        i += 1;
    }

    return <>{out}</>;
}

function HomeMediaBlock({ sectionId, slotKey }: { sectionId: string; slotKey: string }) {
    // Pull section-scoped media via the existing public content bundle route.
    const b = useContentBundle(`section.${sectionId}.`);
    if (b.loading) return null;

    const item = b.mediaByKey(slotKey);
    if (!item?.url) return null;

    const isVideo = item.asset_type === 'video';

    return (
        <Container maxWidth="lg" sx={{ py: 8 }}>
            {isVideo ? (
                <Box
                    component="video"
                    controls
                    sx={{ width: '100%', borderRadius: 2, background: 'hsl(var(--background))' }}
                    src={item.url}
                />
            ) : (
                <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                    <Box
                        component="img"
                        sx={{
                            width: 'auto',
                            height: 'auto',
                            maxWidth: '100%',
                            borderRadius: 2,
                            display: 'block',
                        }}
                        src={item.url}
                        alt={item.title || ''}
                    />
                </Box>
            )}
        </Container>
    );
}

function HomeRichTextBlock({ bodyKey, locale }: { bodyKey: string; locale: string }) {
    const { body, loading } = useCmsPageBody(bodyKey, locale, true);
    if (loading) return null;
    if (!body) return null;

    return (
        <Container maxWidth="lg" sx={{ py: 8 }}>
            <CmsRichTextRenderer json={body} />
        </Container>
    );
}

export function CardGroupCard(props: {
    locale: string;
    sourceKey: CardGroupSourceKey;
    tDb: (key: string, fallback?: string) => string;
    targetAudienceImages: string[];
    galleryCardImages: string[];
    teamCardImage: string;
    teamImageAlt: string;
}) {
    const { locale, sourceKey, tDb, targetAudienceImages, galleryCardImages, teamCardImage, teamImageAlt } = props;

    const href =
        sourceKey === 'home.cards.lessons'
            ? `/${locale}/lessons`
            : sourceKey === 'home.cards.gallery'
                ? `/${locale}/gallery`
                : `/${locale}/team`;

    const fallbackTitle = FALLBACK_COPY;
    const fallbackDescription = FALLBACK_COPY;

    const mediaBlock =
        sourceKey === 'home.cards.lessons' ? (
            <GalleryCarousel images={targetAudienceImages} mode="ordered" />
        ) : sourceKey === 'home.cards.gallery' ? (
            <GalleryCarousel images={galleryCardImages} mode="ordered" />
        ) : teamCardImage ? (
            <Box sx={{ width: '100%', height: 280, mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Box
                    component="img"
                    sx={{
                        width: 'auto',
                        height: 'auto',
                        maxWidth: '100%',
                        maxHeight: '100%',
                        borderRadius: 2,
                        display: 'block',
                    }}
                    src={teamCardImage}
                    alt={teamImageAlt}
                />
            </Box>
        ) : (
            <Box sx={{ height: 280, borderRadius: 2, mb: 3, background: 'hsl(var(--background))' }} />
        );

    return (
        <Link href={href} style={{ textDecoration: 'none' }}>
            <Card
                sx={{
                    height: '100%',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                    '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: '0 14px 32px rgba(7, 85, 80, 0.16)',
                    },
                }}
            >
                <CardContent sx={{ p: 4 }}>
                    <Box sx={{ mb: 3 }}>{mediaBlock}</Box>

                    <Typography variant="h5" gutterBottom color="primary.main">
                        {tDb(`page.${sourceKey}.title`, fallbackTitle)}
                    </Typography>

                    <Typography variant="body1">{tDb(`page.${sourceKey}.description`, fallbackDescription)}</Typography>
                </CardContent>
            </Card>
        </Link>
    );
}
