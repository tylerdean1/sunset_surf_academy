'use client';

import React from 'react';
import { Box, Button } from '@mui/material';
import Link from 'next/link';
import { useContentBundleContext } from '@/components/content/ContentBundleContext';
import { AdminSessionBridge, AdminSignOutButton } from '@/components/admin/AdminSessionBridge';

export function AdminMediaUploadShell({ locale, children }: { locale: string; children: React.ReactNode }) {
    const ctx = useContentBundleContext();
    const strings = ctx?.strings ?? {};
    const t = (key: string, fallback: string) => {
        const v = strings[key];
        return typeof v === 'string' && v.trim().length > 0 ? v : fallback;
    };

    return (
        <>
            <AdminSessionBridge />
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    px: { xs: 2, md: 4 },
                    pt: 2,
                    gap: 2,
                    flexWrap: 'wrap',
                }}
            >
                <Button component={Link} href={`/${locale}/admin`} variant="outlined">
                    {t('admin.nav.backToAdmin', 'Back to Admin')}
                </Button>
                <AdminSignOutButton>
                    {t('admin.auth.signOut', 'Sign out')}
                </AdminSignOutButton>
            </Box>
            {children}
        </>
    );
}
