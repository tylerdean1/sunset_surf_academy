"use client";

import { Container, Typography, Box, Grid, Card } from '@mui/material';
import { useLocale } from 'next-intl';
import useCmsPageBody from '../../../hooks/useCmsPageBody';
import CmsRichTextRenderer from '../../../components/CmsRichTextRenderer';
import { isEmptyDoc } from '../../../lib/cmsRichText';
import ContentBundleProvider, { useContentBundleContext } from '@/components/content/ContentBundleContext';
import usePageSections from '@/hooks/usePageSections';
import PageSectionsRenderer from '@/components/sections/PageSectionsRenderer';

export default function MissionStatementPage() {
    const sections = usePageSections('mission_statement');
    if (sections.sections.length > 0) {
        return <PageSectionsRenderer pageKey="mission_statement" sections={sections.sections} />;
    }

    return (
        <ContentBundleProvider prefix="page.mission_statement." mediaPrefix="mission.">
            <MissionInner />
        </ContentBundleProvider>
    );
}

function MissionInner() {
    const locale = useLocale();
    const cms = useCmsPageBody('page.mission_statement.body', locale);
    const hasCms = !cms.loading && !cms.error && !isEmptyDoc(cms.body);

    const ctx = useContentBundleContext();
    const strings = ctx?.strings ?? {};
    const logoUrl = (ctx?.media || []).find((m) => m?.slot_key === 'mission.logo')?.url || '';
    const fallbackCopy = 'Content unavailable';

    const tDb = (key: string, fallback: string) => {
        const v = strings[key];
        return typeof v === 'string' && v.trim().length > 0 ? v : fallback;
    };

    return (
        <Container maxWidth="lg" sx={{ py: 8 }}>
            <Typography variant="h2" gutterBottom color="primary.main">
                {tDb('page.mission_statement.title', fallbackCopy)}
            </Typography>
            <Typography variant="h5" gutterBottom color="text.secondary">
                {tDb('page.mission_statement.subtitle', fallbackCopy)}
            </Typography>

            <Grid container spacing={4} sx={{ mt: 4 }}>
                <Grid item xs={12} md={8}>
                    <Box>
                        {hasCms ? (
                            <CmsRichTextRenderer json={cms.body} />
                        ) : (
                            <>
                                <Typography variant="body1" paragraph sx={{ fontSize: '1.05rem', lineHeight: 1.7 }}>
                                    {tDb(
                                        'page.mission_statement.lead',
                                        fallbackCopy
                                    )}
                                </Typography>
                                <Typography variant="body1" paragraph sx={{ fontSize: '1.05rem', lineHeight: 1.7 }}>
                                    {tDb(
                                        'page.mission_statement.body1',
                                        fallbackCopy
                                    )}
                                </Typography>
                                <Typography variant="body1" paragraph sx={{ fontSize: '1.05rem', lineHeight: 1.7 }}>
                                    {tDb(
                                        'page.mission_statement.body2',
                                        fallbackCopy
                                    )}
                                </Typography>
                                <Typography variant="body1" sx={{ fontSize: '1.05rem', lineHeight: 1.7, fontWeight: 600 }}>
                                    {tDb(
                                        'page.mission_statement.conclusion',
                                        fallbackCopy
                                    )}
                                </Typography>
                            </>
                        )}
                    </Box>
                </Grid>

                <Grid item xs={12} md={4}>
                    <Card sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3, height: '100%' }}>
                        {logoUrl ? (
                            <Box
                                component="img"
                                src={logoUrl}
                                alt={tDb('page.mission_statement.logoAlt', fallbackCopy)}
                                sx={{ width: 180, height: 180, objectFit: 'contain' }}
                            />
                        ) : null}
                    </Card>
                </Grid>
            </Grid>
        </Container>
    );
}
