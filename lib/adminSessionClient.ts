'use client';

import { getSupabaseClient } from '@/lib/supabaseClient';

let pending: Promise<void> = Promise.resolve();

// Serialize cookie updates so an older token cannot overwrite a newer refresh or logout.
export function syncAdminSession(accessToken: string | null): Promise<void> {
    const operation = pending.catch(() => {}).then(async () => {
        const res = await fetch(accessToken ? '/api/admin/login' : '/api/admin/logout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(accessToken ? { access_token: accessToken } : {}),
            cache: 'no-store',
        });
        const body = await res.json().catch(() => null);
        if (!res.ok || !body?.ok) throw new Error(body?.message || 'Failed to sync admin session');
    });
    pending = operation;
    return operation;
}

export async function signOutAdmin(): Promise<void> {
    const supabase = getSupabaseClient();
    let browserError: Error | null = null;
    try {
        if (supabase) {
            const { error } = await supabase.auth.signOut({ scope: 'local' });
            if (error) browserError = error;
        }
    } finally {
        await syncAdminSession(null);
    }
    if (browserError) throw browserError;
}
