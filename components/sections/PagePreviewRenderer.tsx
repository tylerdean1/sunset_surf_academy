'use client';

import * as React from 'react';
import { Box, Button, Container, Divider, Typography } from '@mui/material';
import Hero from '@/components/Hero';
import CmsRichTextRenderer from '@/components/CmsRichTextRenderer';
import type { Database, Json } from '@/lib/database.types';
import PageSectionsRenderer from '@/components/sections/PageSectionsRenderer';

type PageSectionRow = Database['public']['Functions']['rpc_get_page_sections']['Returns'][number];

type CanonicalKind = 'hero' | 'richText' | 'media' | 'card_group';

export type StagedContentMap = Record<string, { en: string; es: string }>;

// For single slots, provide an array with 0..1 items.
// For carousel slots, provide an array with N items.
export type StagedMediaMap = Record<string, Array<{ url: string; bucket?: string | null; path?: string | null }>>;

function asJsonObject(v: Json): Record<string, Json> | null {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
    return v as Record<string, Json>;
}

function pickString(obj: Record<string, Json> | null, key: string): string {
    const v = obj?.[key];
    return typeof v === 'string' ? v : '';
}

function defaultCmsKey(sectionId: string, suffix: string): string {
    return `section.${sectionId}.${suffix}`;
}

function defaultSlotKey(sectionId: string, suffix: string): string {
    return `section.${sectionId}.${suffix}`;
}

export default function PagePreviewRenderer({ sections }: { sections: PageSectionRow[] }) {
    return <PagePreviewRendererInner sections={sections} />;
}

export function PagePreviewRendererInner(props: {
    pageKey?: string;
    sections: PageSectionRow[];
    localeTab?: 'en' | 'es';
    content?: StagedContentMap;
    media?: StagedMediaMap;
    selectedSectionId?: string;
    onSelectSection?: (sectionId: string) => void;
    showDiagnostics?: boolean;
}) {
    const ordered = React.useMemo(() => [...props.sections].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0)), [props.sections]);
    if (!ordered.length) return null;

    const localeTab = props.localeTab === 'es' ? 'es' : 'en';
    const content = props.content || {};
    const media = props.media || {};

    const t = (key: string, fallback: string) => {
        const entry = content[key];
        if (!entry) return fallback;
        const v = localeTab === 'es' && entry.es.trim() ? entry.es : entry.en;
        return v.trim() ? v : fallback;
    };

    const getHref = (key: string, fallback: string) => {
        const raw = t(key, fallback);
        return raw.trim() || fallback;
    };

    const slotFirstUrl = (slotKey: string) => {
        const items = media[slotKey] || [];
        const first = items[0];
        return first?.url || '';
    };

    const slotList = (slotKey: string) => media[slotKey] || [];

    const selectableProps = (sectionId: string, kind: string) => {
        if (!props.onSelectSection) return {};
        const selected = props.selectedSectionId === sectionId;
        return {
            role: 'group' as const,
            tabIndex: 0,
            'aria-label': `Select ${kind} section`,
            'data-page-composer-section': sectionId,
            onClick: () => props.onSelectSection?.(sectionId),
            onKeyDown: (event: React.KeyboardEvent) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    props.onSelectSection?.(sectionId);
                }
            },
            sx: {
                outline: selected ? '3px solid' : '2px solid transparent',
                outlineColor: selected ? 'primary.main' : 'transparent',
                outlineOffset: selected ? '-3px' : '-2px',
                cursor: 'pointer',
                transition: 'outline-color 120ms ease',
                '&:hover, &:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: '-2px' },
            },
        };
    };

    const Carousel = ({ items, sectionId }: { items: Array<{ url: string; path?: string | null }>; sectionId: string }) => {
        const [idx, setIdx] = React.useState(0);
        React.useEffect(() => {
            setIdx(0);
        }, [sectionId, items.length]);

        if (!items.length) return null;
        const current = items[Math.max(0, Math.min(items.length - 1, idx))];
        const path = String(current?.path || '');
        const isVideo = (() => {
            const p = path.toLowerCase();
            return p.endsWith('.mp4') || p.endsWith('.webm') || p.endsWith('.ogg') || p.endsWith('.mov');
        })();

        return (
            <Box sx={{ display: 'grid', gap: 1.5 }}>
                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'space-between' }}>
                    <Button
                        size="small"
                        variant="outlined"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setIdx((n) => (items.length ? (n - 1 + items.length) % items.length : 0));
                        }}
                        disabled={items.length <= 1}
                    >
                        ◀
                    </Button>
                    <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
                        {items.length > 1 ? `${idx + 1}/${items.length}` : '1/1'}
                    </Typography>
                    <Button
                        size="small"
                        variant="outlined"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setIdx((n) => (items.length ? (n + 1) % items.length : 0));
                        }}
                        disabled={items.length <= 1}
                    >
                        ▶
                    </Button>
                </Box>

                {current?.url ? (
                    isVideo ? (
                        <Box
                            component="video"
                            controls
                            src={current.url}
                            sx={{ width: '100%', borderRadius: 2, background: 'hsl(var(--background))' }}
                            onClick={(e) => e.stopPropagation()}
                        />
                    ) : (
                        <Box
                            component="img"
                            src={current.url}
                            alt=""
                            sx={{ width: '100%', height: 'auto', borderRadius: 2 }}
                            onClick={(e) => e.stopPropagation()}
                        />
                    )
                ) : null}
            </Box>
        );
    };

    return (
        <Box sx={{ py: 2 }}>
            {ordered.map((s, idx) => {
                const kind = s.kind as CanonicalKind;
                const content = asJsonObject(s.content_source as any);
                const media = asJsonObject(s.media_source as any);

                const sectionId = String(s.id || '').trim();

                const titleKey = pickString(content, 'titleKey') || (sectionId && kind === 'hero' ? defaultCmsKey(sectionId, 'title') : '');
                const subtitleKey =
                    pickString(content, 'subtitleKey') || (sectionId && kind === 'hero' ? defaultCmsKey(sectionId, 'subtitle') : '');
                const bodyKey =
                    pickString(content, 'bodyKey') ||
                    (sectionId && (kind === 'richText' || kind === 'hero') ? defaultCmsKey(sectionId, 'body') : '');

                const bgSlot = pickString(media, 'backgroundSlot') || (sectionId && kind === 'hero' ? defaultSlotKey(sectionId, 'bg') : '');
                const primarySlot =
                    pickString(media, 'primarySlot') ||
                    (sectionId && (kind === 'hero' || kind === 'media') ? defaultSlotKey(sectionId, 'primary') : '');
                const carouselSlot =
                    pickString(media, 'carouselSlot') || (sectionId && kind === 'media' ? defaultSlotKey(sectionId, 'carousel') : '');

                const header = props.showDiagnostics === false || props.onSelectSection ? null : (
                    <Box sx={{ px: 2, pt: 1.5, pb: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {idx + 1}. {String(s.kind)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            id={s.id} · status={s.status}
                            {s.anchor ? ` · anchor=${s.anchor}` : ''}
                        </Typography>
                    </Box>
                );

                if (kind === 'hero') {
                    const primaryLabelKey =
                        pickString(asJsonObject(content?.ctaPrimary as any), 'labelKey') ||
                        (sectionId ? defaultCmsKey(sectionId, 'cta.primary.label') : '');
                    const primaryHrefKey =
                        pickString(asJsonObject(content?.ctaPrimary as any), 'hrefKey') ||
                        (sectionId ? defaultCmsKey(sectionId, 'cta.primary.href') : '');
                    const secondaryLabelKey =
                        pickString(asJsonObject(content?.ctaSecondary as any), 'labelKey') ||
                        (sectionId ? defaultCmsKey(sectionId, 'cta.secondary.label') : '');
                    const secondaryHrefKey =
                        pickString(asJsonObject(content?.ctaSecondary as any), 'hrefKey') ||
                        (sectionId ? defaultCmsKey(sectionId, 'cta.secondary.href') : '');

                    return (
                        <Box key={s.id} {...selectableProps(sectionId, 'Hero')}>
                            {header}
                            <Hero
                                title={titleKey ? t(titleKey, 'Add your headline') : 'Add your headline'}
                                subtitle={subtitleKey ? t(subtitleKey, 'Add a short description') : 'Add a short description'}
                                backgroundUrl={bgSlot ? slotFirstUrl(bgSlot) || undefined : undefined}
                                primaryAction={primaryLabelKey ? t(primaryLabelKey, 'Primary') : 'Primary'}
                                secondaryAction={secondaryLabelKey ? t(secondaryLabelKey, 'Secondary') : 'Secondary'}
                                primaryHref={primaryHrefKey ? getHref(primaryHrefKey, '#') : '#'}
                                secondaryHref={secondaryHrefKey ? getHref(secondaryHrefKey, '#') : '#'}
                                cmsKeyBase={props.content ? undefined : `section.${s.id}`}
                            />
                            {props.showDiagnostics === false || props.onSelectSection ? null : <Container maxWidth="lg" sx={{ py: 2 }}>
                                <Typography variant="body2" color="text.secondary">
                                    content_source.titleKey={titleKey || '(missing)'} · content_source.subtitleKey={subtitleKey || '(missing)'}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    media_source.backgroundSlot={bgSlot || '(missing)'}
                                </Typography>
                            </Container>}
                            <Divider />
                        </Box>
                    );
                }

                if (kind === 'richText') {
                    const json = bodyKey ? t(bodyKey, '') : '';
                    return (
                        <Box key={s.id} {...selectableProps(sectionId, 'Text')}>
                            {header}
                            <Container maxWidth="lg" sx={{ py: 4 }}>
                                {props.showDiagnostics === false || props.onSelectSection ? null : <>
                                    <Typography variant="h6" sx={{ mb: 1 }}>Rich text</Typography>
                                    <Typography variant="body2" color="text.secondary">bodyKey={bodyKey || '(missing)'}</Typography>
                                </>}
                                {json ? (
                                    <Box sx={{ mt: 2 }}>
                                        <CmsRichTextRenderer json={json} />
                                    </Box>
                                ) : (
                                    <Box sx={{ mt: 2, p: 2, border: '1px dashed', borderColor: 'divider', borderRadius: 1 }}>
                                        <Typography variant="body2" color="text.secondary">
                                            Add text in the section editor to preview it here.
                                        </Typography>
                                    </Box>
                                )}
                            </Container>
                            <Divider />
                        </Box>
                    );
                }

                if (kind === 'media') {
                    const singleUrl = primarySlot ? slotFirstUrl(primarySlot) : '';
                    const carouselItems = carouselSlot ? slotList(carouselSlot) : [];
                    return (
                        <Box key={s.id} {...selectableProps(sectionId, 'Photo or video')}>
                            {header}
                            <Container maxWidth="lg" sx={{ py: 4 }}>
                                {props.showDiagnostics === false || props.onSelectSection ? null : <>
                                    <Typography variant="h6" sx={{ mb: 1 }}>Media</Typography>
                                    <Typography variant="body2" color="text.secondary">primarySlot={primarySlot || '(missing)'} · carouselSlot={carouselSlot || '(missing)'}</Typography>
                                </>}

                                {singleUrl ? (
                                    <Box sx={{ mt: 2 }}>
                                        <Box component="img" src={singleUrl} alt="" sx={{ width: '100%', height: 'auto', borderRadius: 2 }} />
                                    </Box>
                                ) : null}

                                {carouselItems.length ? (
                                    <Box sx={{ mt: 2 }}>
                                        <Carousel items={carouselItems} sectionId={s.id} />
                                    </Box>
                                ) : null}

                                {!singleUrl && !carouselItems.length ? (
                                    <Box sx={{ mt: 2, p: 2, border: '1px dashed', borderColor: 'divider', borderRadius: 1 }}>
                                        <Typography variant="body2" color="text.secondary">
                                            Choose media in the section editor to preview it here.
                                        </Typography>
                                    </Box>
                                ) : null}
                            </Container>
                            <Divider />
                        </Box>
                    );
                }

                if (kind === 'card_group') {
                    return (
                        <Box key={s.id} {...selectableProps(sectionId, 'Card group')}>
                            {header}
                            <Container maxWidth="lg" sx={{ py: 4 }}>
                                {props.pageKey === 'home'
                                    ? <PageSectionsRenderer pageKey="home" sections={[s]} />
                                    : <Typography variant="body2" color="text.secondary">Card groups are only displayed on the Home page.</Typography>}
                            </Container>
                            <Divider />
                        </Box>
                    );
                }

                return (
                    <Box key={s.id} {...selectableProps(sectionId, String(s.kind))}>
                        {header}
                        <Container maxWidth="lg" sx={{ py: 4 }}>
                            <Typography variant="body2" color="text.secondary">
                                Unsupported kind: {String(s.kind)}
                            </Typography>
                        </Container>
                        <Divider />
                    </Box>
                );
            })}
        </Box>
    );
}
