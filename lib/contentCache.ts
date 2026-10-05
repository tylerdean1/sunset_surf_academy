import type { ContentBundleError, ContentBundleResponse } from '@/types/contentBundle';
import { createSeededContentCache } from './seededContentCache';

const listeners = new Set<() => void>();
let generation = 0;
const cache = createSeededContentCache<ContentBundleResponse>(() => generation);

export function invalidateContentCache() {
    generation += 1;
    for (const listener of Array.from(listeners)) listener();
}

export function subscribeContentChanges(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

export function contentCacheGeneration() { return generation; }

function bundleKey(locale: string, prefix: string, mediaPrefix: string) {
    return `${locale}::${prefix}::${mediaPrefix}`;
}

export function contentBundleSnapshot(locale: string, prefix: string, mediaPrefix: string, seed?: ContentBundleResponse) {
    return cache.peek(bundleKey(locale, prefix, mediaPrefix), seed);
}

export function acceptContentBundleSeed(seed: ContentBundleResponse | undefined) {
    if (!seed) return undefined;
    return cache.seed(bundleKey(seed.locale, seed.prefix, seed.mediaPrefix), seed);
}

export async function fetchContentBundle(locale: 'en' | 'es', prefix: string, mediaPrefix: string): Promise<ContentBundleResponse> {
    return cache.read(bundleKey(locale, prefix, mediaPrefix), async () => {
        const params = new URLSearchParams({ locale, prefix });
        if (mediaPrefix !== prefix) params.set('media_prefix', mediaPrefix);
        const res = await fetch(`/api/content-bundle?${params}`, { cache: 'no-store' });
        const body = (await res.json().catch(() => null)) as ContentBundleResponse | ContentBundleError | null;
        if (!res.ok || !body || !body.ok) {
            throw new Error((body as ContentBundleError)?.message || `Failed to load content bundle (${res.status})`);
        }
        return body;
    });
}
