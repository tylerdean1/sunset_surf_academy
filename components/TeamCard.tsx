'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { Card, CardContent, IconButton, Box, Typography } from '@mui/material';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';
import useContentBundle from '@/hooks/useContentBundle';

const FALLBACK_COPY = 'Content unavailable';

interface Props {
    name: string;
    images: string[];
}

export default function TeamCard({ name, images }: Props) {
    const [index, setIndex] = useState(0);

    const ui = useContentBundle('ui.');
    const noPhotosText = ui.t('ui.team.card.noPhotos', FALLBACK_COPY);
    const browseHintText = ui.t('ui.team.card.browseHint', FALLBACK_COPY);
    const prevAria = ui.t('ui.team.card.prevAria', FALLBACK_COPY);
    const nextAria = ui.t('ui.team.card.nextAria', FALLBACK_COPY);

    const hasImages = images.length > 0;
    const prev = () => {
        if (!hasImages) return;
        setIndex((i) => (i - 1 + images.length) % images.length);
    };
    const next = () => {
        if (!hasImages) return;
        setIndex((i) => (i + 1) % images.length);
    };
    const locale = useLocale();
    const href = `/${locale}/about_jaz`;

    return (
        <Card sx={{ maxWidth: 700, mx: 'auto', px: 2 }}>
            <Link href={href} style={{ textDecoration: 'none' }}>
                <Box
                    sx={{
                        mt: 2,
                        mb: 2,
                        mx: 'auto',
                        px: 3,
                        py: 1.5,
                        borderRadius: 2,
                        textAlign: 'center',
                        background: (theme) => `linear-gradient(105deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
                        boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
                        cursor: 'pointer'
                    }}
                >
                    <Typography sx={{ fontWeight: 800, color: 'white', fontSize: '1.25rem' }}>{name}</Typography>
                </Box>
            </Link>
            <Box sx={{ position: 'relative' }}>
                <Link href={href} style={{ textDecoration: 'none' }}>
                    {hasImages ? (
                        <Box
                            component="img"
                            src={images[index]}
                            alt={`${name} ${index + 1}`}
                            sx={{
                                width: '100%',
                                height: 480,
                                objectFit: 'contain',
                                display: 'block',
                                backgroundColor: 'hsl(var(--background))',
                                cursor: 'pointer'
                            }}
                        />
                    ) : (
                        <Box
                            sx={{
                                width: '100%',
                                height: 480,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: 'hsl(var(--background))',
                            }}
                        >
                            <Typography variant="body2" color="text.secondary">
                                {noPhotosText}
                            </Typography>
                        </Box>
                    )}
                </Link>

                {hasImages ? (
                    <IconButton
                        aria-label={prevAria}
                        onClick={(e) => { e.stopPropagation(); prev(); }}
                        sx={{
                            position: 'absolute',
                            left: 8,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            backgroundColor: 'rgba(0,0,0,0.35)',
                            color: 'white',
                            '&:hover': { backgroundColor: 'rgba(0,0,0,0.5)' }
                        }}
                    >
                        <ChevronLeft />
                    </IconButton>
                ) : null}

                {hasImages ? (
                    <IconButton
                        aria-label={nextAria}
                        onClick={(e) => { e.stopPropagation(); next(); }}
                        sx={{
                            position: 'absolute',
                            right: 8,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            backgroundColor: 'rgba(0,0,0,0.35)',
                            color: 'white',
                            '&:hover': { backgroundColor: 'rgba(0,0,0,0.5)' }
                        }}
                    >
                        <ChevronRight />
                    </IconButton>
                ) : null}
            </Box>

            <CardContent>
                <Typography variant="body1">{browseHintText}</Typography>
            </CardContent>
        </Card>
    );
}
