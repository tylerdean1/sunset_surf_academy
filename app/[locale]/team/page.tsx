"use client";

import { Container, Typography, Box, Grid, Card, CardContent } from '@mui/material';
import TeamCard from '../../../components/TeamCard';
import { useLocale } from 'next-intl';
import useCmsPageBody from '../../../hooks/useCmsPageBody';
import CmsRichTextRenderer from '../../../components/CmsRichTextRenderer';
import { isEmptyDoc } from '../../../lib/cmsRichText';
import ContentBundleProvider, { useContentBundleContext } from '@/components/content/ContentBundleContext';
import { useCmsStringValue } from '@/hooks/useCmsStringValue';
import usePageSections from '@/hooks/usePageSections';
import PageSectionsRenderer from '@/components/sections/PageSectionsRenderer';

export default function TeamPage() {
    const sections = usePageSections('team');
    if (sections.sections.length > 0) {
        return <PageSectionsRenderer pageKey="team" sections={sections.sections} />;
    }

    return (
        <ContentBundleProvider prefix="page.team." mediaPrefix="team.">
            <TeamInner />
        </ContentBundleProvider>
    );
}

function TeamInner() {
    const locale = useLocale();
    const cms = useCmsPageBody('page.team.body', locale);
    const hasCms = !cms.loading && !cms.error && !isEmptyDoc(cms.body);

    const fallbackCopy = 'Content unavailable';
    const title = useCmsStringValue('page.team.title', fallbackCopy).value;
    const subtitle = useCmsStringValue('page.team.subtitle', fallbackCopy).value;
    const intro = useCmsStringValue('page.team.intro', fallbackCopy).value;
    const jazName = useCmsStringValue('page.team.jaz.name', fallbackCopy).value;
    const moreTitle = useCmsStringValue('page.team.moreDetailsTitle', fallbackCopy).value;
    const moreBody = useCmsStringValue('page.team.moreDetailsBody', fallbackCopy).value;
    const logoAlt = useCmsStringValue('page.team.logoAlt', fallbackCopy).value;

    const ctx = useContentBundleContext();
    const media = ctx?.media || [];
    const jazPhotos = [...media]
        .filter((m) => String(m?.slot_key || '').startsWith('team.jaz.photos.'))
        .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
        .map((m) => m.url)
        .filter(Boolean);
    const images = jazPhotos;
    const teamLogo = media.find((m) => m?.slot_key === 'team.logo')?.url || '';

    return (
        <Container maxWidth="lg" sx={{ py: 8 }}>
            <Typography variant="h2" gutterBottom color="primary.main">
                {title}
            </Typography>
            <Typography variant="h5" gutterBottom color="text.secondary">
                {subtitle}
            </Typography>
            {hasCms ? (
                <Box sx={{ mt: 2 }}>
                    <CmsRichTextRenderer json={cms.body} />
                </Box>
            ) : (
                <Typography variant="body1" sx={{ fontSize: '1.05rem', lineHeight: 1.6 }}>
                    {intro}
                </Typography>
            )}
            <Grid container spacing={4} sx={{ mt: 6 }}>
                <Grid item xs={12} md={6}>
                    <TeamCard name={jazName} images={images} />
                </Grid>

                <Grid item xs={12} md={6}>
                    <Card sx={{ maxWidth: 700, mx: 'auto' }}>
                        <CardContent>
                            <Typography variant="h5" gutterBottom color="primary.main">
                                {moreTitle}
                            </Typography>
                            <Typography variant="body1" color="text.secondary" paragraph>
                                {moreBody}
                            </Typography>
                        </CardContent>
                        {teamLogo ? (
                            <Box
                                component="img"
                                src={teamLogo}
                                alt={logoAlt}
                                sx={{ width: '100%', height: 240, objectFit: 'contain', background: 'hsl(var(--background))' }}
                            />
                        ) : null}
                    </Card>
                </Grid>
            </Grid>
        </Container>
    );
}
