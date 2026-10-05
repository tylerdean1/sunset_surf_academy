'use client';

import React, { useEffect, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Container, FormControl, InputLabel, MenuItem, Select, Tab, Tabs, Typography } from '@mui/material';
import { usePathname, useRouter } from 'next/navigation';
import MediaManager from './MediaManager';
import SessionsManager from './SessionsManager';
import BookingRequestsManager from './BookingRequestsManager';
import FinancesManager from './FinancesManager';
import LessonTypesManager from './LessonTypesManager';
import ExpensesManager from './ExpensesManager';
import useContentBundle from '@/hooks/useContentBundle';
import { ADMIN_PAGES, type AdminPageKey } from './adminPages';

function TabPanel({ value, index, children }: { value: number; index: number; children: React.ReactNode }) {
    if (value !== index) return null;
    return <Box sx={{ pt: 3 }}>{children}</Box>;
}

export default function AdminDashboard() {
    const admin = useContentBundle('admin.');
    const [tab, setTab] = useState(0);
    const loading = false;
    const authError: string | null = null;
    const pathname = usePathname();
    const router = useRouter();
    const [selectedPage, setSelectedPage] = useState<AdminPageKey | ''>('');

    const locale = (() => {
        const p = String(pathname || '/');
        const seg = p.split('/').filter(Boolean)[0];
        return seg === 'en' || seg === 'es' ? seg : 'en';
    })();

    const goToLiveEditor = (pageKey: string) => {
        const key = String(pageKey || '').trim();
        if (!key) return;
        router.push(`/${locale}/admin/live-editor?page=${encodeURIComponent(key)}&mode=structure`);
    };


    return (
        <Container maxWidth="lg" sx={{ py: 6 }}>
            <Typography variant="h4" sx={{ mb: 1 }}>
                {admin.t('admin.dashboard.title', 'Admin Dashboard')}
            </Typography>
            <Typography color="text.secondary">{admin.t('admin.dashboard.subtitle', 'CMS bodies, sessions, and media.')}</Typography>

            {loading ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 3 }}>
                    <CircularProgress size={22} />
                    <Typography>{admin.t('admin.common.loading', 'Loading…')}</Typography>
                </Box>
            ) : authError ? (
                <Alert severity="warning" sx={{ mt: 3 }}>
                    {authError}
                </Alert>
            ) : (
                <>
                    <Box sx={{ borderBottom: 1, borderColor: 'divider', mt: 3 }}>
                        <Tabs
                            value={tab}
                            onChange={(_, v) => setTab(v)}
                            variant="scrollable"
                            scrollButtons="auto"
                            allowScrollButtonsMobile
                        >
                            <Tab sx={{ minWidth: 'max-content' }} label={admin.t('admin.dashboard.tabs.edit', 'Edit')} />
                            <Tab sx={{ minWidth: 'max-content' }} label={admin.t('admin.dashboard.tabs.bookingRequests', 'Requests & Billing')} />
                            <Tab sx={{ minWidth: 'max-content' }} label={admin.t('admin.dashboard.tabs.sessions', 'Sessions')} />
                            <Tab sx={{ minWidth: 'max-content' }} label={admin.t('admin.dashboard.tabs.lessonTypes', 'Lesson Types')} />
                            <Tab sx={{ minWidth: 'max-content' }} label={admin.t('admin.dashboard.tabs.finances', 'Finances')} />
                            <Tab sx={{ minWidth: 'max-content' }} label={admin.t('admin.dashboard.tabs.expenses', 'Expenses')} />
                            <Tab sx={{ minWidth: 'max-content' }} label={admin.t('admin.dashboard.tabs.media', 'Media')} />
                        </Tabs>
                    </Box>

                    <TabPanel value={tab} index={0}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            {admin.t(
                                'admin.dashboard.editHint',
                                'You are viewing the real site UI. Click the edit icons to change content inline.'
                            )}
                        </Typography>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 2 }}>
                            <FormControl size="small" sx={{ minWidth: 280 }}>
                                <InputLabel id="admin-edit-page-label">{admin.t('admin.liveEditor.pageLabel', 'Page')}</InputLabel>
                                <Select
                                    labelId="admin-edit-page-label"
                                    label={admin.t('admin.liveEditor.pageLabel', 'Page')}
                                    value={selectedPage}
                                    onChange={(e) => {
                                        const next = String(e.target.value || '');
                                        setSelectedPage(next as AdminPageKey | '');
                                        if (next) goToLiveEditor(next);
                                    }}
                                >
                                    <MenuItem value="">{admin.t('admin.common.select', 'Select…')}</MenuItem>
                                    {ADMIN_PAGES.map((p) => (
                                        <MenuItem key={p} value={p}>
                                            {p}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            <Button
                                variant="outlined"
                                onClick={() => {
                                    if (selectedPage) goToLiveEditor(selectedPage);
                                }}
                                disabled={!selectedPage}
                            >
                                {admin.t('admin.common.open', 'Open')}
                            </Button>
                        </Box>
                    </TabPanel>

                    <TabPanel value={tab} index={1}>
                        <BookingRequestsManager />
                    </TabPanel>

                    <TabPanel value={tab} index={2}>
                        <SessionsManager />
                    </TabPanel>

                    <TabPanel value={tab} index={3}>
                        <LessonTypesManager />
                    </TabPanel>

                    <TabPanel value={tab} index={4}>
                        <FinancesManager />
                    </TabPanel>

                    <TabPanel value={tab} index={5}>
                        <ExpensesManager />
                    </TabPanel>

                    <TabPanel value={tab} index={6}>
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                            <Button href={`/${locale}/admin/media-upload`} variant="outlined">
                                {admin.t('admin.dashboard.goToUpload', 'Go to Upload Page')}
                            </Button>
                        </Box>
                        <MediaManager />
                    </TabPanel>
                </>
            )}
        </Container>
    );
}
