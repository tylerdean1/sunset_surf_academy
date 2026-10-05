'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import useCmsPageBody from '@/hooks/useCmsPageBody';
import { useAdminEdit } from '@/components/admin/edit/AdminEditContext';
import { useContentBundleContext } from '@/components/content/ContentBundleContext';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { rpc } from '@/lib/rpc';
import { cmsStringOrFallback } from '@/lib/cmsDraft';
import { subscribeContentChanges } from '@/lib/contentCache';

type AdminRow = {
    body_en: string | null;
    body_es_draft: string | null;
};

async function fetchAdminRow(pageKey: string): Promise<AdminRow | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;
    try {
        const rows = await rpc<any[]>(supabase, 'admin_get_cms_page_row', { p_page_key: pageKey });
        const row = rows?.[0] ?? null;
        if (!row) return null;
        return { body_en: row.body_en ?? null, body_es_draft: row.body_es_draft ?? null };
    } catch {
        return null;
    }
}

export function useCmsStringValue(pageKey: string, fallback: string) {
    const locale = useLocale();
    const { enabled } = useAdminEdit();

    const bundle = useContentBundleContext();
    const bundledValue = useMemo(() => {
        const v = bundle?.strings?.[pageKey];
        return typeof v === 'string' ? v : null;
    }, [bundle?.strings, pageKey]);

    // Public: prefer the per-route content bundle (1 fetch per route).
    // Fallback: reads published ES (if approved) or EN via security-definer RPC.
    const publicCms = useCmsPageBody(pageKey, locale, bundledValue === null);
    const publicValue = useMemo(() => {
        if (bundledValue !== null) return bundledValue;
        const v = publicCms.body;
        return cmsStringOrFallback(v, fallback);
    }, [bundledValue, publicCms.body, fallback]);

    const adminKey = `${pageKey}::${locale}`;
    const [adminState, setAdminState] = useState<{ key: string; value: string | null } | null>(null);
    const adminValue = adminState?.key === adminKey ? adminState.value : null;
    const [revision, setRevision] = useState(0);
    const editRevision = useRef(0);
    useEffect(() => subscribeContentChanges(() => setRevision((prev) => prev + 1)), []);

    useEffect(() => {
        let cancelled = false;
        const editAtStart = editRevision.current;
        if (!enabled) {
            return () => { cancelled = true; };
        }

        (async () => {
            const row = await fetchAdminRow(pageKey);
            if (cancelled || editRevision.current !== editAtStart) return;
            const v = locale === 'es' ? row?.body_es_draft : row?.body_en;
            setAdminState({ key: adminKey, value: typeof v === 'string' ? v : null });
        })();

        return () => {
            cancelled = true;
        };
    }, [enabled, pageKey, locale, revision, adminKey]);

    const value = enabled ? (adminValue ?? fallback) : publicValue;

    return {
        value,
        loading: enabled ? adminValue === null && false : publicCms.loading,
        error: enabled ? null : publicCms.error,
        setLocalValue: (value: string) => {
            editRevision.current += 1;
            setAdminState({ key: adminKey, value });
        },
    };
}

export async function saveCmsStringValue(pageKey: string, locale: string, nextValue: string) {
    const supabase = getSupabaseClient();
    const payload: any = { p_page_key: pageKey };
    if (locale === 'es') payload.p_body_es_draft = nextValue;
    else payload.p_body_en = nextValue;
    await rpc<void>(supabase, 'admin_upsert_page_content', payload);
}

export async function publishCmsSpanish(pageKey: string) {
    const supabase = getSupabaseClient();
    await rpc<void>(supabase, 'admin_publish_es', { p_page_key: pageKey });
}
