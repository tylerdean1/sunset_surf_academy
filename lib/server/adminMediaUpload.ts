import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { mediaObject, mediaSlotKey, mediaText, MediaValidationError, parseMediaAsset } from '@/lib/adminMediaValidation';

export const MEDIA_UPLOAD_BUCKETS = new Set(['Private_Photos', 'Lesson_Photos']);
const UPLOAD_LIFETIME = 2 * 60 * 60 * 1000;

type Reservation = {
    adminId: string;
    expiresAt: number;
    asset: ReturnType<typeof parseMediaAsset>['asset'];
    slotKeys: string[] | null;
    size: number;
    contentType: string;
};

const MIME_BY_EXTENSION: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp',
    avif: 'image/avif', heic: 'image/heic', heif: 'image/heif', svg: 'image/svg+xml', bmp: 'image/bmp',
    tif: 'image/tiff', tiff: 'image/tiff', mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
    m4v: 'video/x-m4v', avi: 'video/x-msvideo', mkv: 'video/x-matroska',
};

function signature(payload: string): string {
    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    if (!secret) throw new Error('Upload service is not configured');
    return createHmac('sha256', secret).update(`admin-media-upload:${payload}`).digest('hex');
}

export async function readMediaUploadJson(req: Request, maxBytes = 128 * 1024): Promise<unknown> {
    const bytes = await req.arrayBuffer();
    if (bytes.byteLength > maxBytes) throw new MediaValidationError('Upload metadata is too large');
    try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
    catch { throw new MediaValidationError('Invalid JSON'); }
}

function checkedPath(path: string): string {
    mediaText(path, 'path', 1024);
    if (/[\u0000-\u001f\u007f]/.test(path) || path.split('/').some(part => !part || part === '.' || part === '..')) {
        throw new MediaValidationError('Invalid upload path');
    }
    return path;
}

export function prepareMediaUpload(value: unknown, adminId: string): Reservation {
    const input = mediaObject(value, 'upload request');
    const supplied = mediaObject(input.asset, 'asset');
    if (supplied.id !== undefined) throw new MediaValidationError('Upload must create a new asset');
    const fileName = mediaText(input.file_name, 'file name', 255).replace(/^.*[\\/]/, '');
    checkedPath(fileName);
    const folderRaw = input.folder === undefined ? '' : input.folder;
    if (typeof folderRaw !== 'string') throw new MediaValidationError('Invalid folder');
    const folder = folderRaw.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    if (folder) checkedPath(folder);
    const dot = fileName.lastIndexOf('.');
    const base = dot > 0 ? fileName.slice(0, dot) : fileName;
    const extension = dot > 0 ? fileName.slice(dot) : '';
    const uniqueName = `${base}(${randomUUID()})${extension}`;
    const path = checkedPath(folder ? `${folder}/${uniqueName}` : uniqueName);
    const { asset, slotKeys } = parseMediaAsset({ ...supplied, path });
    if (!MEDIA_UPLOAD_BUCKETS.has(asset.bucket)) throw new MediaValidationError('Invalid upload bucket');
    const size = input.file_size;
    if (typeof size !== 'number' || !Number.isSafeInteger(size) || size <= 0) throw new MediaValidationError('Invalid file size');
    if (typeof input.file_type !== 'string') throw new MediaValidationError('Invalid file type');
    const contentType = input.file_type.trim().toLowerCase() || MIME_BY_EXTENSION[extension.slice(1).toLowerCase()] || '';
    const kind = asset.asset_type === 'video' ? 'video' : 'image';
    if (!new RegExp(`^${kind}/[a-z0-9.+-]{1,100}$`).test(contentType)) throw new MediaValidationError('Choose a file that matches the selected photo/video type');
    return { adminId, expiresAt: Date.now() + UPLOAD_LIFETIME, asset, slotKeys, size, contentType };
}

export function sealMediaUpload(reservation: Reservation): string {
    const payload = Buffer.from(JSON.stringify(reservation)).toString('base64url');
    return `${payload}.${signature(payload)}`;
}

export function openMediaUpload(value: unknown, adminId: string): Reservation {
    if (typeof value !== 'string' || value.length > 256 * 1024) throw new MediaValidationError('Invalid upload reservation');
    const parts = value.split('.');
    if (parts.length !== 2 || !/^[a-zA-Z0-9_-]+$/.test(parts[0]) || !/^[a-f0-9]{64}$/.test(parts[1])) {
        throw new MediaValidationError('Invalid upload reservation');
    }
    if (!timingSafeEqual(Buffer.from(parts[1]), Buffer.from(signature(parts[0])))) throw new MediaValidationError('Invalid upload reservation');
    let decoded: unknown;
    try { decoded = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')); }
    catch { throw new MediaValidationError('Invalid upload reservation'); }
    const input = mediaObject(decoded, 'upload reservation');
    if (input.adminId !== adminId || typeof input.expiresAt !== 'number' || input.expiresAt < Date.now()) {
        throw new MediaValidationError('Upload reservation expired; prepare the upload again');
    }
    const { asset } = parseMediaAsset(input.asset);
    if (!MEDIA_UPLOAD_BUCKETS.has(asset.bucket)) throw new MediaValidationError('Invalid upload bucket');
    checkedPath(asset.path);
    if (typeof input.size !== 'number' || !Number.isSafeInteger(input.size) || input.size <= 0 || typeof input.contentType !== 'string') {
        throw new MediaValidationError('Invalid upload reservation');
    }
    if (input.slotKeys !== null && (!Array.isArray(input.slotKeys) || input.slotKeys.length > 1)) throw new MediaValidationError('Invalid upload reservation');
    const slotKeys = input.slotKeys === null ? null : (input.slotKeys as unknown[]).map(mediaSlotKey);
    return { adminId, expiresAt: input.expiresAt, asset, slotKeys, size: input.size, contentType: input.contentType };
}
