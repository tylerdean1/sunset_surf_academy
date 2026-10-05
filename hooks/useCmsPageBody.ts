'use client';

import { useEffect, useState } from 'react';
import { getSupabaseClient } from '../lib/supabaseClient';
import type { Database } from '../lib/database.types';
import { usePublicCmsSeed } from '@/components/content/PublicContentSeedContext';
import { subscribeContentChanges } from '@/lib/contentCache';

type Result = {
    body: string | null;
    locale: string | null;
    updatedAt: string | null;
    loading: boolean;
    error: string | null;
};

type PageBody = { body: string | null; locale: string | null; updatedAt: string | null };
type PageBodyState = { key: string; seed: ReturnType<typeof usePublicCmsSeed>; value: PageBody };

function fromSeed(seed: PageBodyState['seed']): PageBody {
    return { body: seed?.body ?? null, locale: seed?.locale ?? null, updatedAt: seed?.updated_at ?? null };
}

export default function useCmsPageBody(pageKey: string, locale: string, enabled: boolean = true): Result {
    const seed = usePublicCmsSeed(pageKey, locale);
    const key = `${pageKey}::${locale}`;
    const [bodyState, setBodyState] = useState<PageBodyState>(() => ({ key, seed, value: fromSeed(seed) }));
    const current = bodyState.key !== key
        ? fromSeed(seed)
        : bodyState.seed === seed ? bodyState.value : seed ? fromSeed(seed) : bodyState.value;
    const [loading, setLoading] = useState<boolean>(enabled && current.body === null);
    const [errorState, setErrorState] = useState<{ key: string; seed: PageBodyState['seed']; revision: number; message: string } | null>(null);
    const [revision, setRevision] = useState(0);
    const error = errorState?.key === key && errorState.seed === seed && errorState.revision === revision
        ? errorState.message : null;
    useEffect(() => subscribeContentChanges(() => setRevision((prev) => prev + 1)), []);

    useEffect(() => {
        let cancelled = false;

        if (!enabled) {
            return () => {
                cancelled = true;
            };
        }

        (async () => {
            const visible = fromSeed(seed);
            setLoading(visible.body === null);
            const supabase = getSupabaseClient();
            if (!supabase) {
                setErrorState({ key, seed, revision, message: 'Supabase client unavailable' });
                setLoading(false);
                return;
            }

            const { data, error } = await supabase.rpc('get_page_content', {
                p_page_key: pageKey,
                p_locale: locale,
            });

            if (cancelled) return;

            if (error) {
                setErrorState({ key, seed, revision, message: error.message });
                setLoading(false);
                return;
            }

            const rows = (data ?? []) as Database['public']['Functions']['get_page_content']['Returns'];
            const first = rows.length ? rows[0] : null;
            setBodyState({ key, seed, value: {
                body: first?.body ?? null,
                locale: first?.locale ?? null,
                updatedAt: first?.updated_at ?? null,
            } });
            setErrorState(null);
            setLoading(false);
        })();

        return () => {
            cancelled = true;
        };
    }, [enabled, pageKey, locale, revision, seed, key]);

    return enabled ? { ...current, loading, error } : { ...fromSeed(undefined), loading: false, error: null };
}
