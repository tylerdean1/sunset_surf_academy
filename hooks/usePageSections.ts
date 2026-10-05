'use client';

import { useEffect, useMemo, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabaseClient';
import type { Database } from '@/lib/database.types';
import { usePublicPageSectionsSeed } from '@/components/content/PublicContentSeedContext';
import { contentCacheGeneration, subscribeContentChanges } from '@/lib/contentCache';
import { createSeededContentCache } from '@/lib/seededContentCache';

type PageSectionRow = Database['public']['Functions']['rpc_get_page_sections']['Returns'][number];

type Result = {
    pageKey: string;
    sections: PageSectionRow[];
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
};

const cache = createSeededContentCache<PageSectionRow[]>(() => contentCacheGeneration());

async function fetchSections(pageKey: string): Promise<PageSectionRow[]> {
    const key = String(pageKey || '').trim();
    if (!key) return [];
    return cache.read(key, async () => {
        const supabase = getSupabaseClient();
        if (!supabase) return [];

        const { data, error } = await supabase.rpc('rpc_get_page_sections', {
            p_page_key: key,
            p_include_drafts: false,
        });
        if (error) throw error;
        return (data || []) as PageSectionRow[];
    });
}

export default function usePageSections(pageKey: string): Result {
    const key = String(pageKey || '').trim();
    const seed = usePublicPageSectionsSeed(key);
    const [revision, setRevision] = useState(0);

    const [sectionState, setSectionState] = useState(() => ({ key, seed, sections: seed ?? [] }));
    const sections = sectionState.key === key
        ? (sectionState.seed === seed ? sectionState.sections : seed ?? sectionState.sections)
        : seed ?? [];
    const [loading, setLoading] = useState<boolean>(() => !seed && !cache.peek(key));
    const [errorState, setErrorState] = useState<{ key: string; seed: PageSectionRow[] | undefined; revision: number; message: string } | null>(null);
    const error = errorState?.key === key && errorState.seed === seed && errorState.revision === revision
        ? errorState.message : null;
    useEffect(() => subscribeContentChanges(() => {
        setRevision((prev) => prev + 1);
    }), []);

    const refresh = useMemo(() => {
        return async () => {
            if (!key) {
                return;
            }

            setLoading(true);
            setErrorState(null);
            try {
                // Bypass the saved response for an explicit refresh.
                cache.remove(key);
                const rows = await fetchSections(key);
                setSectionState({ key, seed, sections: rows });
                setErrorState(null);
            } catch (e: any) {
                setErrorState({ key, seed, revision, message: e?.message || 'Failed to load' });
            } finally {
                setLoading(false);
            }
        };
    }, [key, seed, revision]);

    useEffect(() => {
        let cancelled = false;
        if (!key) {
                return () => { cancelled = true; };
        }

        // A new server seed must replace an old client cache after router.refresh().
        const seeded = seed ? cache.seed(key, seed) : undefined;
        if (seeded) {
            return;
        }

        const cached = cache.peek(key);
        if (cached) {
            return;
        }

        // Keep the last rendered sections while mutations revalidate in the background.
        setLoading(sectionState.key !== key || sectionState.sections.length === 0);
        (async () => {
            try {
                const rows = await fetchSections(key);
                if (cancelled) return;
                setSectionState({ key, seed, sections: rows });
                setErrorState(null);
                setLoading(false);
            } catch (e: any) {
                if (cancelled) return;
                setErrorState({ key, seed, revision, message: e?.message || 'Failed to load' });
                setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [key, revision, seed, sectionState]);

    return {
        pageKey: key,
        sections,
        loading: !key || seed || cache.peek(key) ? false : loading,
        error,
        refresh,
    };
}
