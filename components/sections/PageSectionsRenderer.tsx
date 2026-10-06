'use client';

import * as React from 'react';
import { useLocale } from 'next-intl';
import { Box, Button, Container, Divider, Grid, Typography } from '@mui/material';
import Hero from '@/components/Hero';
import CmsRichTextRenderer from '@/components/CmsRichTextRenderer';
import useContentBundle from '@/hooks/useContentBundle';
import type { Database, Json } from '@/lib/database.types';
import { getHomeHeroDefaults } from '@/lib/publicNavigation';
import type { PublicLocale } from '@/lib/publicSite';
import { CardGroupCard } from '@/components/sections/HomeSectionsRenderer';

type PageSectionRow = Database['public']['Functions']['rpc_get_page_sections']['Returns'][number];

type CanonicalKind = 'hero' | 'richText' | 'media' | 'card_group';

type CardGroupSourceKey = 'home.cards.lessons' | 'home.cards.gallery' | 'home.cards.team';

type MediaItem = {
    slot_key: string;
    sort: number | null;
    url: string;
    asset_type?: string | null;
    title?: string | null;
    path?: string | null;
};

function asJsonObject(v: Json): Record<string, Json> | null {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
    return v as Record<string, Json>;
}

function pickString(obj: Record<string, Json> | null, key: string): string {
    const v = obj?.[key];
    return typeof v === 'string' ? v : '';
}

function pickNestedString(obj: Record<string, Json> | null, key: string, nestedKey: string): string {
    const child = asJsonObject((obj?.[key] ?? null) as any);
    return pickString(child, nestedKey);
}

function isCardGroupSourceKey(value: unknown): value is CardGroupSourceKey {
    return value === 'home.cards.lessons' || value === 'home.cards.gallery' || value === 'home.cards.team';
}

function isProbablyVideoPath(path: string): boolean {
    const p = path.toLowerCase();
    return p.endsWith('.mp4') || p.endsWith('.webm') || p.endsWith('.ogg') || p.endsWith('.mov');
}

function SectionCarousel({ items }: { items: MediaItem[] }) {
    const [index, setIndex] = React.useState(0);
    if (!items.length) return null;
    const current = items[Math.max(0, Math.min(items.length - 1, index))];
    const path = String(current?.path || '');
    const isVideo = (current?.asset_type || '') === 'video' || (path ? isProbablyVideoPath(path) : false);
    return (
        <Box sx={{ display: 'grid', gap: 1.5 }}>
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'space-between' }}>
                <Button size="small" variant="outlined" onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIndex((value) => (value - 1 + items.length) % items.length);
                }} disabled={items.length <= 1}>◀</Button>
                <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
                    {items.length > 1 ? `${index + 1}/${items.length}` : '1/1'}
                </Typography>
                <Button size="small" variant="outlined" onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIndex((value) => (value + 1) % items.length);
                }} disabled={items.length <= 1}>▶</Button>
            </Box>
            {current?.url ? (isVideo
                ? <Box component="video" controls src={current.url} sx={{ width: '100%', borderRadius: 2, background: 'hsl(var(--background))' }} />
                : <Box component="img" src={current.url} alt={current?.title || ''} sx={{ width: '100%', height: 'auto', borderRadius: 2 }} />)
                : null}
        </Box>
    );
}

function normalizeHref(raw: string): string {
    const v = String(raw || '').trim();
    return v || '#';
}

function mediaListForPointer(media: MediaItem[], pointer: string): MediaItem[] {
    const p = String(pointer || '').trim();
    if (!p) return [];
    return [...media]
        .filter((m) => {
            const k = String(m?.slot_key || '');
            return k === p || k.startsWith(`${p}.`);
        })
        .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
}

function firstMediaUrl(media: MediaItem[], pointer: string): string {
    const list = mediaListForPointer(media, pointer);
    return list[0]?.url || '';
}

function parseCardGroupSourceKey(content_source: Record<string, Json> | null): CardGroupSourceKey | null {
    const direct = pickString(content_source, 'sourceKey');
    if (isCardGroupSourceKey(direct)) return direct;

    const fields = asJsonObject((content_source?.fields ?? null) as any);
    const legacy = pickString(fields, 'sourceKey');
    if (isCardGroupSourceKey(legacy)) return legacy;

    return null;
}

const TARGET_AUDIENCE_FALLBACK_IMAGES: string[] = [];
const FALLBACK_COPY = 'Content unavailable';

export default function PageSectionsRenderer(props: { pageKey: string; sections: PageSectionRow[] }) {
    const locale = useLocale();
    const homeHeroDefaults = props.pageKey === 'home' ? getHomeHeroDefaults(locale as PublicLocale) : null;

    // For page_sections pointers like section.<uuid>.*
    const sectionBundle = useContentBundle('section.');

    // For home card_group content/media (sourceKey values are home.cards.*)
    const homeBundle = useContentBundle('page.home.', 'home.');

    const sectionStrings = sectionBundle.strings || {};
    const sectionMedia = (sectionBundle.media || []) as unknown as MediaItem[];

    const homeStrings = homeBundle.strings || {};
    const homeMedia = (homeBundle.media || []) as unknown as MediaItem[];

    const tSection = (key: string, fallback: string) => {
        const v = sectionStrings[key];
        return typeof v === 'string' && v.trim().length > 0 ? v : fallback;
    };

    const tHome = (key: string, fallback?: string) => {
        const v = homeStrings[key];
        return typeof v === 'string' && v.trim().length > 0 ? v : fallback ?? '';
    };

    const homeMediaByKey = (slotKey: string) => homeMedia.find((m) => String(m?.slot_key || '') === slotKey) || null;
    const homeMediaList = (slotKeyPrefix: string) =>
        [...homeMedia]
            .filter((m) => String(m?.slot_key || '').startsWith(slotKeyPrefix))
            .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));

    const targetAudienceImages = (() => {
        const fromDb = homeMediaList('home.target_audience.').map((m) => m.url).filter(Boolean);
        return fromDb.length ? fromDb : TARGET_AUDIENCE_FALLBACK_IMAGES;
    })();

    const galleryCardImages = (() => {
        return homeMediaList('home.cards.gallery.images.').map((m) => m.url).filter(Boolean);
    })();

    const teamCardImage = homeMediaByKey('home.cards.team.image')?.url || '';
    const teamImageAlt = tHome('page.home.cards.team.imageAlt', FALLBACK_COPY);

    const ordered = React.useMemo(
        () => [...props.sections].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0)),
        [props.sections]
    );

    if (!ordered.length) return null;

    const out: React.ReactNode[] = [];
    let i = 0;
    while (i < ordered.length) {
        const s = ordered[i];
        const kind = s.kind as CanonicalKind;
        const content_source = asJsonObject(s.content_source as any);
        const media_source = asJsonObject(s.media_source as any);
        const sectionId = String(s.id || '');

        if (kind === 'hero') {
            const titleKey = pickString(content_source, 'titleKey') || `section.${sectionId}.title`;
            const subtitleKey = pickString(content_source, 'subtitleKey') || `section.${sectionId}.subtitle`;

            const primaryLabelKey = pickNestedString(content_source, 'ctaPrimary', 'labelKey') || `section.${sectionId}.cta.primary.label`;
            const primaryHrefKey = pickNestedString(content_source, 'ctaPrimary', 'hrefKey') || `section.${sectionId}.cta.primary.href`;
            const secondaryLabelKey = pickNestedString(content_source, 'ctaSecondary', 'labelKey') || `section.${sectionId}.cta.secondary.label`;
            const secondaryHrefKey = pickNestedString(content_source, 'ctaSecondary', 'hrefKey') || `section.${sectionId}.cta.secondary.href`;

            const bgSlot = pickString(media_source, 'backgroundSlot') || `section.${sectionId}.bg`;

            const primaryHrefFallback = props.pageKey === 'home' ? `/${locale}/book` : '#';
            const secondaryHrefFallback = props.pageKey === 'home' ? `/${locale}/mission_statement` : '#';

            out.push(
                <React.Fragment key={s.id}>
                    <Hero
                        title={tSection(titleKey, homeHeroDefaults?.title ?? FALLBACK_COPY)}
                        subtitle={tSection(subtitleKey, homeHeroDefaults?.subtitle ?? FALLBACK_COPY)}
                        backgroundUrl={firstMediaUrl(sectionMedia, bgSlot) || undefined}
                        primaryAction={tSection(primaryLabelKey, homeHeroDefaults?.primaryAction ?? FALLBACK_COPY)}
                        secondaryAction={tSection(secondaryLabelKey, homeHeroDefaults?.secondaryAction ?? FALLBACK_COPY)}
                        primaryHref={normalizeHref(tSection(primaryHrefKey, homeHeroDefaults?.primaryHref ?? primaryHrefFallback))}
                        secondaryHref={normalizeHref(tSection(secondaryHrefKey, homeHeroDefaults?.secondaryHref ?? secondaryHrefFallback))}
                        cmsKeyBase={`section.${sectionId}`}
                    />
                    <Divider />
                </React.Fragment>
            );
            i += 1;
            continue;
        }

        if (kind === 'card_group') {
            if (props.pageKey !== 'home') {
                i += 1;
                continue;
            }
            const group: Array<{ key: string; sourceKey: CardGroupSourceKey }> = [];
            while (i < ordered.length && (ordered[i].kind as CanonicalKind) === 'card_group') {
                const s2 = ordered[i];
                const cs2 = asJsonObject(s2.content_source as any);
                const sourceKey = parseCardGroupSourceKey(cs2);
                if (sourceKey) {
                    group.push({ key: String(s2.id), sourceKey });
                }
                i += 1;
            }

            if (group.length) {
                out.push(
                    <Container key={group[0].key} maxWidth="lg" sx={{ py: 8 }}>
                        <Grid container spacing={4}>
                            {group.map((g) => (
                                <Grid key={g.key} item xs={12} md={4}>
                                    <CardGroupCard
                                        locale={locale}
                                        sourceKey={g.sourceKey}
                                        tDb={tHome}
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

        if (kind === 'richText') {
            const bodyKey = pickString(content_source, 'bodyKey') || `section.${sectionId}.body`;
            const json = tSection(bodyKey, '');
            if (json) {
                out.push(
                    <Container key={s.id} maxWidth="lg" sx={{ py: 8 }}>
                        <CmsRichTextRenderer json={json} />
                    </Container>
                );
            }
            i += 1;
            continue;
        }

        if (kind === 'media') {
            const primarySlot = pickString(media_source, 'primarySlot') || `section.${sectionId}.primary`;
            const carouselSlot = pickString(media_source, 'carouselSlot') || `section.${sectionId}.carousel`;

            const primaryUrl = firstMediaUrl(sectionMedia, primarySlot);
            const carouselItems = mediaListForPointer(sectionMedia, carouselSlot);

            if (primaryUrl || carouselItems.length) {
                out.push(
                    <Container key={s.id} maxWidth="lg" sx={{ py: 8 }}>
                        {primaryUrl ? (
                            <Box component="img" src={primaryUrl} alt="" sx={{ width: '100%', height: 'auto', borderRadius: 2 }} />
                        ) : null}

                        {carouselItems.length ? (
                            <Box sx={{ mt: primaryUrl ? 3 : 0 }}>
                                <SectionCarousel key={`${sectionId}:${carouselItems.length}`} items={carouselItems} />
                            </Box>
                        ) : null}
                    </Container>
                );
            }

            i += 1;
            continue;
        }

        i += 1;
    }

    return <>{out}</>;
}
