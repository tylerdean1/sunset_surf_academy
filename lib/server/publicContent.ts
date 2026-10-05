import 'server-only';
import { cache } from 'react';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import type { ContentBundleResponse } from '@/types/contentBundle';
import type { HomeSectionMetaRow } from '@/lib/sections/parseHomeSections';

function publicClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return createClient<Database>(url, key, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store', signal: AbortSignal.timeout(8000) }) },
    });
}

// Request-local memoization: no shared server cache of CMS content or draft data.
export const getPublicContentBundle = cache(async (locale: 'en' | 'es', prefix: string, mediaPrefix = prefix): Promise<ContentBundleResponse | undefined> => {
    const client = publicClient();
    if (!client) return undefined;
    try {
        const [content, assets] = await Promise.all([
            client.rpc('get_page_content_by_prefix', { p_locale: locale, p_prefix: prefix }),
            client.rpc('get_public_media_assets_by_prefix', { p_prefix: mediaPrefix }),
        ]);
        if (content.error || assets.error) return undefined;
        const strings: Record<string, string> = {};
        const updatedAtByKey: Record<string, string> = {};
        for (const row of content.data || []) {
            if (typeof row.body !== 'string') continue;
            strings[row.page_key] = row.body;
            updatedAtByKey[row.page_key] = row.updated_at;
        }
        const media = (assets.data || []).filter((asset) => asset.public).map((asset) => ({
            ...asset,
            url: client.storage.from(asset.bucket).getPublicUrl(asset.path).data.publicUrl,
        }));
        return { ok: true, locale, prefix, mediaPrefix, strings, updatedAtByKey, media };
    } catch {
        return undefined;
    }
});

export const getPublishedPageSections = cache(async (pageKey: string) => {
    const client = publicClient();
    if (!client) return undefined;
    try {
        const { data, error } = await client.rpc('rpc_get_page_sections', { p_page_key: pageKey, p_include_drafts: false });
        return error ? undefined : data || [];
    } catch {
        return undefined;
    }
});

export const getPublicHomeSectionsMeta = cache(async (): Promise<HomeSectionMetaRow[] | undefined> => {
    const client = publicClient();
    if (!client) return undefined;
    try {
        const { data, error } = await client.from('cms_page_content').select('page_key,body_en,sort')
            .eq('category', 'sections.page.home').like('page_key', 'section.%.meta')
            .order('sort', { ascending: true }).order('page_key', { ascending: true }).limit(200);
        return error ? undefined : data || [];
    } catch {
        return undefined;
    }
});
