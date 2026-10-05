'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import type { ContentBundleMediaItem } from '@/types/contentBundle';
import { acceptContentBundleSeed, contentBundleSnapshot, fetchContentBundle, subscribeContentChanges } from '@/lib/contentCache';
import { usePublicContentSeed } from '@/components/content/PublicContentSeedContext';

type Result = {
    prefix: string;
    mediaPrefix: string;
    locale: 'en' | 'es';
    strings: Record<string, string>;
    media: ContentBundleMediaItem[];
    loading: boolean;
    error: string | null;
    t: (key: string, fallback?: string) => string;
    mediaByKey: (slotKey: string) => ContentBundleMediaItem | null;
    mediaList: (slotKeyPrefix: string) => ContentBundleMediaItem[];
};

function normalizeLocale(raw: string): 'en' | 'es' {
    return raw === 'es' ? 'es' : 'en';
}

function isDev() {
    return process.env.NODE_ENV !== 'production';
}

const missingLogged = new Set<string>();

export default function useContentBundle(prefix: string, mediaPrefix?: string): Result {
    const locale = normalizeLocale(useLocale());
    const effectiveMediaPrefix = mediaPrefix ?? prefix;
    const seed = usePublicContentSeed(locale, prefix, effectiveMediaPrefix);
    const [revision, setRevision] = useState(0);

    const key = `${locale}::${prefix}::${effectiveMediaPrefix}`;
    const [content, setContent] = useState(() => ({ key, seed, value: contentBundleSnapshot(locale, prefix, effectiveMediaPrefix, seed) }));
    const current = contentBundleSnapshot(locale, prefix, effectiveMediaPrefix, seed)
        ?? (content.key === key ? content.value : undefined);
    const strings = current?.strings ?? {};
    const media = current?.media ?? [];
    const [loadingState, setLoadingState] = useState({ key, seed, loading: !seed });
    const [errorState, setErrorState] = useState<{ key: string; seed: typeof seed; revision: number; message: string } | null>(null);
    const loading = !current && (loadingState.key === key && loadingState.seed === seed ? loadingState.loading : true);
    const error = errorState?.key === key && errorState.seed === seed && errorState.revision === revision
        ? errorState.message : null;

    useEffect(() => subscribeContentChanges(() => setRevision((prev) => prev + 1)), []);

    useEffect(() => {
        let cancelled = false;
        acceptContentBundleSeed(seed);

        (async () => {
            try {
                const b = await fetchContentBundle(locale, prefix, effectiveMediaPrefix);
                if (cancelled) return;
                setContent({ key, seed, value: b });
                setLoadingState({ key, seed, loading: false });
                setErrorState(null);
            } catch (e: any) {
                if (cancelled) return;
                setErrorState({ key, seed, revision, message: e?.message || 'Failed to load content' });
                setLoadingState({ key, seed, loading: false });
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [locale, prefix, effectiveMediaPrefix, key, revision, seed]);

    const mediaBySlotKey = useMemo(() => {
        const map = new Map<string, ContentBundleMediaItem>();
        for (const item of media) {
            if (!item?.slot_key) continue;
            if (!map.has(item.slot_key)) map.set(item.slot_key, item);
        }
        return (slotKey: string) => map.get(slotKey) || null;
    }, [media]);

    const mediaList = useMemo(() => {
        const sorted = [...media].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
        return (slotKeyPrefix: string) => sorted.filter((m) => String(m.slot_key || '').startsWith(slotKeyPrefix));
    }, [media]);

    const t = useMemo(() => {
        return (key: string, fallback?: string) => {
            const v = strings[key];
            if (typeof v === 'string') return v;

            const hasFallback = typeof fallback === 'string' && fallback.trim().length > 0;

            if (isDev() && !hasFallback) {
                const id = `${locale}::${prefix}::${key}`;
                if (!missingLogged.has(id)) {
                    missingLogged.add(id);
                    // eslint-disable-next-line no-console
                    console.warn(`[content] missing key: ${key} (prefix=${prefix}, locale=${locale})`);
                }
            }

            return fallback ?? '';
        };
    }, [strings, locale, prefix]);

    return {
        prefix,
        mediaPrefix: effectiveMediaPrefix,
        locale,
        strings,
        media,
        loading,
        error,
        t,
        mediaByKey: mediaBySlotKey,
        mediaList,
    };
}
