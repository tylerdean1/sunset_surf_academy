import { NextResponse } from 'next/server';
import type { Database } from './database.types';
import { normalizeGalleryImagesSlotKey } from './mediaSlots';

type MediaAssetInsert = Database['public']['Tables']['media_assets']['Insert'];
type MediaAssetRow = Database['public']['Tables']['media_assets']['Row'];

export class MediaValidationError extends Error {
    constructor(message: string) {
        super(message);
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

export function mediaObject(value: unknown, field: string): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new MediaValidationError(`Invalid ${field}`);
    }
    return value as Record<string, unknown>;
}

export function mediaText(value: unknown, field: string, max: number): string {
    if (typeof value !== 'string') throw new MediaValidationError(`Invalid ${field}`);
    const text = value.trim();
    if (!text || text.length > max || /\u0000/.test(text)) {
        throw new MediaValidationError(`Invalid ${field}`);
    }
    return text;
}

export function mediaUuid(value: unknown, field: string): string {
    if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
        throw new MediaValidationError(`Invalid ${field}`);
    }
    return value;
}

export function mediaSort(value: unknown, allowNull = false): number {
    if (value === undefined || (allowNull && value === null)) return 32767;
    if (typeof value !== 'number' || !Number.isInteger(value) || value < -32768 || value > 32767) {
        throw new MediaValidationError('Sort must be an integer from -32768 to 32767');
    }
    return value;
}

export function mediaSlotKey(value: unknown): string {
    const raw = mediaText(value, 'slot key', 128);
    if (!/^[a-z0-9._-]+$/i.test(raw)) throw new MediaValidationError('Invalid slot key');
    const suffix = raw.startsWith('gallery.images.') ? raw.slice('gallery.images.'.length) : '';
    if (/^[0-9]+$/.test(suffix) && !Number.isSafeInteger(Number(suffix))) {
        throw new MediaValidationError('Invalid gallery slot index');
    }
    return normalizeGalleryImagesSlotKey(raw)!;
}

export function parseMediaAsset(value: unknown): {
    asset: MediaAssetInsert;
    assetKey: string | null;
    slotKeys: string[] | null;
} {
    const input = mediaObject(value, 'asset');
    const title = mediaText(input.title, 'title', 160);
    const bucket = mediaText(input.bucket, 'bucket', 100);
    const path = mediaText(input.path, 'path', 1024);
    if (typeof input.public !== 'boolean') throw new MediaValidationError('Public must be a boolean');
    if (!['logo', 'hero', 'lessons', 'web_content', 'uncategorized'].includes(input.category as string)) {
        throw new MediaValidationError('Invalid category');
    }
    if (!['photo', 'video'].includes(input.asset_type as string)) throw new MediaValidationError('Invalid asset type');
    if (input.description != null && (typeof input.description !== 'string' || /\u0000/.test(input.description))) {
        throw new MediaValidationError('Invalid description');
    }

    const asset: MediaAssetInsert = {
        title, bucket, path, public: input.public,
        category: input.category as MediaAssetInsert['category'],
        asset_type: input.asset_type as MediaAssetInsert['asset_type'],
        description: input.description as string | null | undefined ?? null,
        sort: mediaSort(input.sort),
        session_id: input.session_id == null ? null : mediaUuid(input.session_id, 'session_id'),
    };
    if (input.id !== undefined) asset.id = mediaUuid(input.id, 'id');

    let slotKeys: string[] | null = null;
    let assetKey: string | null = null;
    if (Object.prototype.hasOwnProperty.call(input, 'asset_key')) {
        if (input.asset_key === null || (typeof input.asset_key === 'string' && !input.asset_key.trim())) {
            slotKeys = [];
        } else {
            assetKey = mediaSlotKey(input.asset_key);
            slotKeys = [assetKey];
        }
    }
    return { asset, assetKey, slotKeys };
}

export function parseGalleryAssetIds(input: Record<string, unknown>): Array<string | null> {
    const count = input.count;
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 0 || count > 100) {
        throw new MediaValidationError('Count must be an integer from 0 to 100');
    }
    if (input.asset_ids !== undefined && !Array.isArray(input.asset_ids)) {
        throw new MediaValidationError('Invalid asset_ids');
    }
    const ids = input.asset_ids as unknown[] | undefined ?? [];
    if (ids.length > count) throw new MediaValidationError('asset_ids exceeds count');
    return Array.from({ length: count }, (_, index) => {
        const id = ids[index];
        return id === null || index >= ids.length ? null : mediaUuid(id, `asset_ids[${index}]`);
    });
}

export function mediaErrorCode(error: unknown): string {
    if (!error || typeof error !== 'object' || !('code' in error)) return '';
    return typeof error.code === 'string' ? error.code : '';
}

export function savedMediaAsset(value: unknown): MediaAssetRow | null {
    const row = Array.isArray(value) ? value.length === 1 ? value[0] : null : value;
    if (!row || typeof row !== 'object' || !('id' in row) || typeof row.id !== 'string') return null;
    return row as MediaAssetRow;
}

export function mediaFailure(error: unknown, fallback: string): NextResponse {
    if (error instanceof MediaValidationError) {
        return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
    }
    const code = mediaErrorCode(error);
    if (['22023', '22P02', '22003', '23502', '23503', '23514'].includes(code)) {
        return NextResponse.json({ ok: false, message: 'Invalid media data or referenced asset/session' }, { status: 400 });
    }
    if (code === '23505') {
        return NextResponse.json({ ok: false, message: 'This media path or slot is already in use' }, { status: 400 });
    }
    return NextResponse.json({ ok: false, message: fallback }, { status: 500 });
}
