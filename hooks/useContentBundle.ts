'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import type { ContentBundleError, ContentBundleResponse, ContentBundleMediaItem } from '@/types/contentBundle';

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

const cache = new Map<string, ContentBundleResponse>();
const inflight = new Map<string, Promise<ContentBundleResponse>>();

function normalizeLocale(raw: string): 'en' | 'es' {
    return raw === 'es' ? 'es' : 'en';
}

async function fetchBundle(locale: 'en' | 'es', prefix: string, mediaPrefix: string): Promise<ContentBundleResponse> {
    const key = `${locale}::${prefix}::${mediaPrefix}`;
    const cached = cache.get(key);
    if (cached) return cached;

    const existing = inflight.get(key);
    if (existing) return existing;

    const p = (async () => {
        const params = new URLSearchParams({ locale, prefix });
        if (mediaPrefix !== prefix) params.set('media_prefix', mediaPrefix);
        const res = await fetch(`/api/content-bundle?${params.toString()}`);
        const body = (await res.json().catch(() => null)) as ContentBundleResponse | ContentBundleError | null;
        if (!res.ok || !body || (body as any).ok !== true) {
            const msg = (body as any)?.message || `Failed to load content bundle (${res.status})`;
            throw new Error(msg);
        }
        cache.set(key, body as ContentBundleResponse);
        return body as ContentBundleResponse;
    })();

    inflight.set(key, p);
    try {
        return await p;
    } finally {
        inflight.delete(key);
    }
}

function isDev() {
    return process.env.NODE_ENV !== 'production';
}

const missingLogged = new Set<string>();

export default function useContentBundle(prefix: string, mediaPrefix?: string): Result {
    const locale = normalizeLocale(useLocale());
    const effectiveMediaPrefix = mediaPrefix ?? prefix;

    const [strings, setStrings] = useState<Record<string, string>>({});
    const [media, setMedia] = useState<ContentBundleMediaItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);

        (async () => {
            try {
                const b = await fetchBundle(locale, prefix, effectiveMediaPrefix);
                if (cancelled) return;
                setStrings(b.strings || {});
                setMedia(b.media || []);
                setLoading(false);
            } catch (e: any) {
                if (cancelled) return;
                setStrings({});
                setMedia([]);
                setError(e?.message || 'Failed to load content');
                setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [locale, prefix, effectiveMediaPrefix]);

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
            if (typeof v === 'string' && v.trim().length > 0) return v;

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
