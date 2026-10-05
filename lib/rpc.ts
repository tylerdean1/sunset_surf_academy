import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { invalidateContentCache } from './contentCache';

export async function rpc<T>(
    client: SupabaseClient<Database> | null,
    fn: string,
    args?: Record<string, any>
): Promise<T> {
    if (!client) throw new Error('Network error');

    const { data, error } = await (client as any).rpc(fn, args ?? {});
    if (error) throw new Error(error.message);
    if (/^admin_(?:(?:upsert|set|clear|delete|replace)_media.*|(?:upsert|set|delete|replace)_page_section.*|upsert_page_content|publish_es|save_content_bundle|replace_gallery_images)$/.test(fn)) {
        invalidateContentCache();
    }
    return data as T;
}
