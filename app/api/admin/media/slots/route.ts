import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireAdminApi } from '@/lib/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import type { Database } from '@/lib/database.types';
import { mediaFailure, mediaObject, mediaSlotKey, mediaSort, mediaUuid, MediaValidationError, parseGalleryAssetIds } from '@/lib/adminMediaValidation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function normalizePrefix(raw: string | null): string {
    const p = String(raw || '').trim();
    if (!p) return '';
    if (p.length > 128) throw new MediaValidationError('prefix too long');
    if (!/^[a-z0-9._-]+$/i.test(p)) throw new MediaValidationError('invalid prefix');
    return p;
}


type SlotItem = {
    slot_key: string;
    sort: number | null;
    asset_id: string | null;
    asset: {
        id: string;
        title: string;
        bucket: string;
        path: string;
        public: boolean;
        asset_type: Database['public']['Enums']['asset_type'];
        category: Database['public']['Enums']['photo_category'];
    } | null;
};

export async function GET(req: Request) {
    const gate = await requireAdminApi(req);
    if (!gate.ok) return gate.response;

    try {
        const url = new URL(req.url);
        const prefix = normalizePrefix(url.searchParams.get('prefix'));
        if (!prefix) {
            return NextResponse.json({ ok: false, message: 'Missing prefix' }, { status: 400 });
        }

        const supabase = getSupabaseAdmin();

        const { data, error } = await supabase
            .from('media_slots')
            .select('slot_key,sort,asset_id,media_assets(id,title,bucket,path,public,asset_type,category)')
            .like('slot_key', `${prefix}%`)
            .order('sort', { ascending: true })
            .order('slot_key', { ascending: true });

        if (error) return NextResponse.json({ ok: false, message: 'Failed to load media slots' }, { status: 500 });

        const items: SlotItem[] = (data ?? []).map((r: any) => {
            const a = r.media_assets ?? null;
            return {
                slot_key: String(r.slot_key || ''),
                sort: r.sort ?? null,
                asset_id: r.asset_id ?? null,
                asset: a
                    ? {
                        id: String(a.id),
                        title: String(a.title || ''),
                        bucket: String(a.bucket || ''),
                        path: String(a.path || ''),
                        public: Boolean(a.public),
                        asset_type: a.asset_type,
                        category: a.category,
                    }
                    : null,
            };
        });

        return NextResponse.json({ ok: true, prefix, items });
    } catch (error: unknown) {
        return mediaFailure(error, 'Failed to load media slots');
    }
}

export async function POST(req: Request) {
    const gate = await requireAdminApi(req);
    if (!gate.ok) return gate.response;

    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ ok: false, message: 'Invalid JSON' }, { status: 400 });
    }

    try {
        const input = mediaObject(body, 'request');
        if (input.op === 'replace_gallery_images') {
            const assetIds = parseGalleryAssetIds(input);
            const supabase = getSupabaseAdmin();
            const { error } = await (supabase as SupabaseClient).rpc('admin_replace_gallery_images', {
                p_asset_ids: assetIds,
            });
            if (error) return mediaFailure(error, 'Failed to replace gallery images');
            return NextResponse.json({ ok: true, count: assetIds.length });
        }

        if (input.op !== 'set') throw new MediaValidationError('Invalid op');
        const slotKey = mediaSlotKey(input.slot_key);
        const assetId = input.asset_id === null ? null : mediaUuid(input.asset_id, 'asset_id');
        const sort = mediaSort(input.sort, true);
        const supabase = getSupabaseAdmin();
        const { error } = await (supabase as SupabaseClient).rpc('admin_set_media_slot', {
            p_slot_key: slotKey,
            p_asset_id: assetId,
            p_sort: sort,
        });
        if (error) return mediaFailure(error, 'Failed to save media slot');
        return NextResponse.json({ ok: true });
    } catch (error: unknown) {
        return mediaFailure(error, 'Failed to save media slots');
    }
}
