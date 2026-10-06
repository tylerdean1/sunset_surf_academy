"use client";

import { Container, Typography, Box, List, ListItem, ListItemText } from '@mui/material';
import { useLocale } from 'next-intl';
import useCmsPageBody from '../../../hooks/useCmsPageBody';
import CmsRichTextRenderer from '../../../components/CmsRichTextRenderer';
import { isEmptyDoc } from '../../../lib/cmsRichText';
import ContentBundleProvider, { useContentBundleContext } from '@/components/content/ContentBundleContext';
import usePageSections from '@/hooks/usePageSections';
import PageSectionsRenderer from '@/components/sections/PageSectionsRenderer';

export default function AboutJazPage() {
    const sections = usePageSections('about_jaz');
    if (sections.sections.length > 0) {
        return <PageSectionsRenderer pageKey="about_jaz" sections={sections.sections} />;
    }

    return (
        <ContentBundleProvider prefix="page.about_jaz.">
            <AboutInner />
        </ContentBundleProvider>
    );
}

function AboutInner() {
    const locale = useLocale();
    const cms = useCmsPageBody('page.about_jaz.body', locale);
    const hasCms = !cms.loading && !cms.error && !isEmptyDoc(cms.body);

    const ctx = useContentBundleContext();
    const strings = ctx?.strings ?? {};
    const fallbackCopy = 'Content unavailable';
    const tDb = (key: string, fallback: string) => {
        const v = strings[key];
        return typeof v === 'string' && v.trim().length > 0 ? v : fallback;
    };

    const accolades = [
        tDb('page.about_jaz.accolades.0', fallbackCopy),
        tDb('page.about_jaz.accolades.1', fallbackCopy),
        tDb('page.about_jaz.accolades.2', fallbackCopy),
        tDb('page.about_jaz.accolades.3', fallbackCopy),
        tDb('page.about_jaz.accolades.4', fallbackCopy),
    ].filter((s) => !!String(s).trim());

    return (
        <Container maxWidth="md" sx={{ py: 8 }}>
            <Typography variant="h2" gutterBottom color="primary.main">
                {tDb('page.about_jaz.title', fallbackCopy)}
            </Typography>
            <Typography variant="h5" gutterBottom color="text.secondary">
                {tDb('page.about_jaz.subtitle', fallbackCopy)}
            </Typography>

            <Box sx={{ mt: 4 }}>
                {hasCms ? (
                    <CmsRichTextRenderer json={cms.body} />
                ) : (
                    <>
                        <Typography variant="body1" paragraph sx={{ fontSize: '1.05rem', lineHeight: 1.7 }}>
                            {tDb(
                                'page.about_jaz.bio',
                                fallbackCopy
                            )}
                        </Typography>

                        <Typography variant="h5" gutterBottom color="primary.main" sx={{ mt: 4 }}>
                            {tDb('page.about_jaz.achievements', fallbackCopy)}
                        </Typography>

                        {accolades.length ? (
                            <List sx={{ pt: 0 }}>
                                {accolades.map((item, i) => (
                                    <ListItem key={`${i}:${String(item)}`} sx={{ py: 0.5 }}>
                                        <ListItemText primary={item} />
                                    </ListItem>
                                ))}
                            </List>
                        ) : null}
                    </>
                )}
            </Box>
        </Container>
    );
}
