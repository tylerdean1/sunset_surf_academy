'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import useCmsPageBody from '@/hooks/useCmsPageBody';
import { useAdminEdit } from '@/components/admin/edit/AdminEditContext';
import { useContentBundleContext } from '@/components/content/ContentBundleContext';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { rpc } from '@/lib/rpc';

type AdminRow = {
    body_en: string | null;
    body_es_draft: string | null;
};

function isNonEmpty(value: string | null | undefined) {
    return !!value && value.trim().length > 0;
}

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
        return isNonEmpty(v) ? (v as string) : null;
    }, [bundle?.strings, pageKey]);

    // Public: prefer the per-route content bundle (1 fetch per route).
    // Fallback: reads published ES (if approved) or EN via security-definer RPC.
    const publicCms = useCmsPageBody(pageKey, locale, !bundledValue);
    const publicValue = useMemo(() => {
        if (bundledValue) return bundledValue;
        const v = publicCms.body;
        return isNonEmpty(v) ? (v as string) : fallback;
    }, [bundledValue, publicCms.body, fallback]);

    const [adminValue, setAdminValue] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        if (!enabled) {
            setAdminValue(null);
            return;
        }

        (async () => {
            const row = await fetchAdminRow(pageKey);
            if (cancelled) return;
            const v = locale === 'es' ? row?.body_es_draft : row?.body_en;
            setAdminValue(isNonEmpty(v) ? (v as string) : null);
        })();

        return () => {
            cancelled = true;
        };
    }, [enabled, pageKey, locale]);

    const value = enabled ? (adminValue ?? fallback) : publicValue;

    return {
        value,
        loading: enabled ? adminValue === null && false : publicCms.loading,
        error: enabled ? null : publicCms.error,
        setLocalValue: setAdminValue,
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
