export function sameOrigin(req: Request): boolean {
    const value = req.headers.get('origin') || req.headers.get('referer');
    if (!value) return false;
    try {
        return new URL(value).origin === new URL(req.url).origin;
    } catch {
        return false;
    }
}

// This only determines cookie lifetime; getUser validates the token first.
export function accessTokenMaxAge(accessToken: string, nowSeconds = Math.floor(Date.now() / 1000)): number {
    try {
        const payload = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64url').toString('utf8'));
        return typeof payload.exp === 'number' ? Math.max(0, Math.floor(payload.exp - nowSeconds)) : 0;
    } catch {
        return 0;
    }
}
