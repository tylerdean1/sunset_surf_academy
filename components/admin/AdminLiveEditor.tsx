'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { AdminEditProvider } from '@/components/admin/edit/AdminEditContext';
import useContentBundle from '@/hooks/useContentBundle';

import { ADMIN_PAGES, type AdminPageKey } from './adminPages';

import PageStructureWizard from '@/components/admin/wizard/PageStructureWizard';
import PageContentWizard from '@/components/admin/wizard/PageContentWizard';

import HomePage from '@/app/[locale]/HomePageClient';
import LessonsPage from '@/app/[locale]/lessons/page';
import MissionStatementPage from '@/app/[locale]/mission_statement/page';
import TeamPage from '@/app/[locale]/team/page';
import FaqPage from '@/app/[locale]/faq/page';
import ContactPage from '@/app/[locale]/contact/page';
import GalleryPage from '@/app/[locale]/gallery/page';
import AboutJazPage from '@/app/[locale]/about_jaz/page';
import BookPage from '@/app/[locale]/book/page';
import GalleryMediaSlotsEditor from '@/components/admin/GalleryMediaSlotsEditor';

function LivePagePreview({ page }: { page: AdminPageKey }) {
    switch (page) {
        case 'home': return <HomePage />;
        case 'lessons': return <LessonsPage />;
        case 'book': return <BookPage />;
        case 'gallery': return <GalleryPage />;
        case 'mission_statement': return <MissionStatementPage />;
        case 'about_jaz': return <AboutJazPage />;
        case 'team': return <TeamPage />;
        case 'faq': return <FaqPage />;
        case 'contact': return <ContactPage />;
        default: return null;
    }
}

export default function AdminLiveEditor() {
    const admin = useContentBundle('admin.');
    const searchParams = useSearchParams();
    const locale = useLocale();
    const pageParam = searchParams.get('page');
    const modeParam = searchParams.get('mode');
    const mode: 'structure' | 'content' = modeParam === 'content' ? 'content' : 'structure';

    if (!pageParam) {
        return (
            <Alert severity="info">
                {admin.t('admin.liveEditor.selectPage', 'Select a page to edit')}
            </Alert>
        );
    }

    const page = String(pageParam || '') as AdminPageKey;
    if (!ADMIN_PAGES.includes(page)) {
        const msg = admin.t('admin.liveEditor.unknownPage', 'Unknown page: {page}').replace('{page}', String(pageParam));
        return <Alert severity="error">{msg}</Alert>;
    }

    const blockNavigationCapture = (e: React.MouseEvent) => {
        const target = e.target as HTMLElement | null;
        if (!target) return;
        if (target.closest('[data-admin-edit-ui="1"]')) return;

        const anchor = target.closest('a[href]') as HTMLAnchorElement | null;
        if (anchor) {
            e.preventDefault();
            e.stopPropagation();
        }
    };

    return (
        <AdminEditProvider enabled>
            <Box sx={{ mt: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                    <Typography variant="body2" color="text.secondary">
                        {admin.t('admin.liveEditor.pageLabel', 'Page')}: <Box component="span" sx={{ fontFamily: 'monospace' }}>{page}</Box>
                    </Typography>
                    <Button size="small" variant={mode === 'structure' ? 'contained' : 'outlined'} href={`/${locale}/admin/live-editor?page=${page}&mode=structure`}>
                        Structure
                    </Button>
                    <Button size="small" variant={mode === 'content' ? 'contained' : 'outlined'} href={`/${locale}/admin/live-editor?page=${page}&mode=content`}>
                        Content
                    </Button>
                </Box>

                <Box sx={{ mt: 2 }}>
                    {mode === 'structure' ? <PageStructureWizard key={`structure:${page}`} pageKey={page} autoOpen /> : null}
                    {mode === 'content' ? <PageContentWizard key={`content:${page}`} pageKey={page} autoOpen /> : null}
                </Box>

                {page === 'gallery' ? <GalleryMediaSlotsEditor /> : null}

                <Box
                    onClickCapture={blockNavigationCapture}
                    sx={{
                        mt: 3,
                        '& a[href]': {
                            pointerEvents: 'none',
                            cursor: 'default',
                        },
                    }}
                >
                    <LivePagePreview key={page} page={page} />
                </Box>
            </Box>
        </AdminEditProvider>
    );
}
