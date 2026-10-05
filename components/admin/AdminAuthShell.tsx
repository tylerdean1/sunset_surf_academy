'use client';

import React from 'react';
import { Box, Button, Container, Typography } from '@mui/material';
import Link from 'next/link';
import { useContentBundleContext } from '@/components/content/ContentBundleContext';
import { AdminSessionBridge, AdminSignOutButton } from '@/components/admin/AdminSessionBridge';

function useAdminStrings() {
    const ctx = useContentBundleContext();
    const strings = ctx?.strings ?? {};
    const t = (key: string, fallback: string) => {
        const v = strings[key];
        return typeof v === 'string' && v.trim().length > 0 ? v : fallback;
    };
    return { t };
}

export function AdminNotAuthorized({ locale }: { locale: string }) {
    const { t } = useAdminStrings();

    return (
        <Container sx={{ py: 8 }}>
            <AdminSessionBridge recover />
            <Typography variant="h4" gutterBottom>
                {t('admin.auth.notAuthorizedTitle', 'Not authorized')}
            </Typography>
            <Typography sx={{ mb: 2 }}>{t('admin.auth.notAuthorizedBody', 'You must sign in to view the admin area.')}</Typography>
            <Button component={Link} href={`/${locale}/adminlogin`} variant="contained">
                {t('admin.auth.goToLogin', 'Go to Admin Login')}
            </Button>
        </Container>
    );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
    const { t } = useAdminStrings();

    return (
        <>
            <AdminSessionBridge />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', px: { xs: 2, md: 4 }, pt: 2 }}>
                <AdminSignOutButton>
                    {t('admin.auth.signOut', 'Sign out')}
                </AdminSignOutButton>
            </Box>
            {children}
        </>
    );
}
