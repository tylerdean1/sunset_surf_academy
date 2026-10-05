import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import type { Database } from '@/lib/database.types';
import { requireAdminApi } from '@/lib/adminAuth';
import { mediaFailure, mediaObject, MediaValidationError, parseMediaAsset, savedMediaAsset } from '@/lib/adminMediaValidation';

type MediaAssetRow = Database['public']['Tables']['media_assets']['Row'];

type MediaAssetWithKey = MediaAssetRow & { asset_key: string | null };

export async function GET(req: Request) {
    const gate = await requireAdminApi(req);
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
        .from('media_assets')
        .select('*')
        .order('public', { ascending: false })
        .order('category', { ascending: true })
        .order('sort', { ascending: true })
        .order('created_at', { ascending: false });

    if (error) {
        return NextResponse.json({ ok: false, message: 'Failed to load media assets' }, { status: 500 });
    }

    const assets = (data ?? []) as MediaAssetRow[];
    const ids = assets.map((a) => a.id).filter(Boolean);

    const slotMap = new Map<string, string[]>();
    if (ids.length) {
        const { data: slots, error: slotsErr } = await supabase
            .from('media_slots')
            .select('slot_key,asset_id')
            .in('asset_id', ids);

        if (slotsErr) {
            return NextResponse.json({ ok: false, message: 'Failed to load media slots' }, { status: 500 });
        }

        for (const s of slots ?? []) {
            const assetId = s.asset_id;
            if (!assetId) continue;
            const list = slotMap.get(assetId) ?? [];
            list.push(s.slot_key);
            slotMap.set(assetId, list);
        }
    }

    const items: MediaAssetWithKey[] = assets.map((a) => {
        const keys = slotMap.get(a.id) ?? [];
        keys.sort();
        return { ...a, asset_key: keys.length ? keys[0] : null };
    });

    return NextResponse.json({ ok: true, items });
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
        if (input.op !== 'upsert') throw new MediaValidationError('Invalid op');
        const { asset, assetKey, slotKeys } = parseMediaAsset(input.asset);
        const supabase = getSupabaseAdmin();
        const { data, error } = await (supabase as SupabaseClient).rpc('admin_save_media_asset', {
            p_asset: asset,
            p_slot_keys: slotKeys,
        });
        if (error) return mediaFailure(error, 'Failed to save media asset');
        const saved = savedMediaAsset(data);
        if (!saved?.id) return mediaFailure(null, 'Failed to save media asset');
        return NextResponse.json({ ok: true, item: { ...saved, asset_key: assetKey } as MediaAssetWithKey });
    } catch (error: unknown) {
        return mediaFailure(error, 'Failed to save media asset');
    }
}
