'use client';

import * as React from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import theme from '@/theme';

export default function AppLoadingFrame({
    locale,
    children,
}: {
    locale?: string;
    children: React.ReactNode;
}) {
    React.useEffect(() => {
        if (locale) document.documentElement.lang = locale;
    }, [locale]);

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            {children}
        </ThemeProvider>
    );
}
