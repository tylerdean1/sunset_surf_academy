'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';

export type LoadingOverlayProps = {
    appReady: boolean;
    minMs?: number;
    maxMs?: number;
    title?: string;
    subtitle?: string;
    videoSrc?: string;
    fadeMs?: number;
};

function usePrefersReducedMotion() {
    const [reduced, setReduced] = React.useState(false);

    React.useEffect(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return;
        const mql = window.matchMedia('(prefers-reduced-motion: reduce)');

        const apply = () => setReduced(!!mql.matches);
        apply();

        if (typeof mql.addEventListener === 'function') {
            mql.addEventListener('change', apply);
            return () => mql.removeEventListener('change', apply);
        }

        // Safari < 14
        mql.addListener(apply);
        return () => mql.removeListener(apply);
    }, []);

    return reduced;
}

export default function LoadingOverlay({
    appReady,
    minMs = 1000,
    maxMs = 8000,
    title = 'Loading…',
    subtitle = 'Loading…',
    videoSrc = '/loading_video.mp4',
    fadeMs = 280,
}: LoadingOverlayProps) {
    const theme = useTheme();
    const reducedMotion = usePrefersReducedMotion();

    const [minTimePassed, setMinTimePassed] = React.useState(false);
    const [exiting, setExiting] = React.useState(false);
    const [mounted, setMounted] = React.useState(true);

    const start = React.useRef<number>(Date.now());
    const maxTriggeredRef = React.useRef(false);

    React.useEffect(() => {
        const minTimer = window.setTimeout(() => setMinTimePassed(true), minMs);

        const maxTimer = window.setTimeout(() => {
            if (maxTriggeredRef.current) return;
            maxTriggeredRef.current = true;
            if (process.env.NODE_ENV !== 'production') {
                // eslint-disable-next-line no-console
                console.warn(
                    `[LoadingOverlay] Max timeout hit after ${maxMs}ms. Hiding overlay to avoid trapping the user. (elapsed=${Date.now() - start.current
                    }ms)`
                );
            }
            setExiting(true);
        }, maxMs);

        return () => {
            window.clearTimeout(minTimer);
            window.clearTimeout(maxTimer);
        };
    }, [minMs, maxMs]);

    const shouldBeginExit = appReady && minTimePassed;

    React.useEffect(() => {
        if (!mounted) return;
        if (!shouldBeginExit) return;
        setExiting(true);
    }, [shouldBeginExit, mounted]);

    React.useEffect(() => {
        if (!exiting) return;
        const t = window.setTimeout(() => setMounted(false), fadeMs);
        return () => window.clearTimeout(t);
    }, [exiting, fadeMs]);

    if (!mounted) return null;

    return (
        <Box
            role="status"
            aria-live="polite"
            aria-busy={!appReady}
            sx={{
                position: 'fixed',
                inset: 0,
                zIndex: (theme.zIndex?.modal ?? 1300) + 10,
                display: 'grid',
                placeItems: 'center',
                overflow: 'hidden',
                opacity: exiting ? 0 : 1,
                transition: `opacity ${fadeMs}ms ease`,
                backgroundColor: theme.palette.background.default,
            }}
        >
            {!reducedMotion ? (
                <Box
                    component="video"
                    autoPlay
                    muted
                    playsInline
                    preload="metadata"
                    loop
                    src={videoSrc}
                    sx={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                    }}
                />
            ) : (
                <Box
                    sx={{
                        position: 'absolute',
                        inset: 0,
                        background: `linear-gradient(180deg, ${alpha(theme.palette.common.black, 0.65)}, ${alpha(
                            theme.palette.common.black,
                            0.55
                        )})`,
                    }}
                />
            )}

            <Box
                sx={{
                    position: 'absolute',
                    inset: 0,
                    background: `linear-gradient(180deg, ${alpha(theme.palette.common.black, 0.35)}, ${alpha(
                        theme.palette.common.black,
                        0.65
                    )})`,
                }}
            />

            <Box
                sx={{
                    position: 'relative',
                    textAlign: 'center',
                    px: 3,
                }}
            >
                <Typography
                    variant="h3"
                    sx={{
                        fontWeight: 700,
                        color: theme.palette.common.white,
                        textShadow: `0 2px 16px ${alpha(theme.palette.common.black, 0.5)}`,
                    }}
                >
                    {title}
                </Typography>
                {subtitle ? (
                    <Typography
                        variant="body1"
                        sx={{
                            mt: 1,
                            color: alpha(theme.palette.common.white, 0.9),
                            textShadow: `0 2px 12px ${alpha(theme.palette.common.black, 0.4)}`,
                        }}
                    >
                        {subtitle}
                    </Typography>
                ) : null}
            </Box>
        </Box>
    );
}
