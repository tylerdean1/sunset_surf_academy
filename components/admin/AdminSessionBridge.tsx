'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Alert, Button } from '@mui/material';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { syncAdminSession, signOutAdmin } from '@/lib/adminSessionClient';

export function AdminSessionBridge({ recover = false }: { recover?: boolean }) {
    const router = useRouter();
    const locale = useLocale();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const supabase = getSupabaseClient();
        if (!supabase) return;
        let cancelled = false;
        let lastToken: string | null | undefined;
        const { data } = supabase.auth.onAuthStateChange((event, session) => {
            if (!['INITIAL_SESSION', 'SIGNED_IN', 'TOKEN_REFRESHED', 'SIGNED_OUT'].includes(event)) return;
            const token = session?.access_token ?? null;
            if (token === lastToken) return;
            lastToken = token;
            // Do not await Supabase work in this callback; it runs under the auth lock.
            void syncAdminSession(token).then(() => {
                if (cancelled) return;
                setError(null);
                if (token && recover) router.refresh();
                if (!token && !recover) router.replace(`/${locale}/adminlogin`);
            }).catch((reason: unknown) => {
                lastToken = undefined;
                if (!cancelled) setError(reason instanceof Error ? reason.message : 'Session sync failed');
            });
        });
        return () => {
            cancelled = true;
            data.subscription.unsubscribe();
        };
    }, [recover, router, locale]);

    return error ? <Alert severity="warning" sx={{ mx: 2, mt: 2 }}>{error}</Alert> : null;
}

export function AdminSignOutButton({ children }: { children: React.ReactNode }) {
    const locale = useLocale();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const signOut = async () => {
        setLoading(true);
        setError(null);
        try {
            await signOutAdmin();
            window.location.assign(`/${locale}/adminlogin`);
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Sign-out failed');
        } finally {
            setLoading(false);
        }
    };
    return <>
        {error ? <Alert severity="error">{error}</Alert> : null}
        <Button onClick={signOut} disabled={loading} variant="outlined">{children}</Button>
    </>;
}
