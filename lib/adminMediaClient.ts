export async function getAdminMediaSignedUrl(bucket: string, path: string): Promise<string> {
    const params = new URLSearchParams({ bucket, path, expiresIn: '900' });
    const res = await fetch(`/api/admin/media/signed-url?${params}`, { cache: 'no-store' });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.ok || !body?.url) {
        throw new Error(body?.message || 'Failed to preview media');
    }
    return String(body.url);
}
