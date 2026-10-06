"use client";

import { Container, Typography, Box, Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
import { ExpandMore } from '@mui/icons-material';
import { useLocale } from 'next-intl';
import useCmsPageBody from '../../../hooks/useCmsPageBody';
import CmsRichTextRenderer from '../../../components/CmsRichTextRenderer';
import { isEmptyDoc } from '../../../lib/cmsRichText';
import ContentBundleProvider, { useContentBundleContext } from '@/components/content/ContentBundleContext';
import usePageSections from '@/hooks/usePageSections';
import PageSectionsRenderer from '@/components/sections/PageSectionsRenderer';

export default function FAQPage() {
  const sections = usePageSections('faq');
  if (sections.sections.length > 0) {
    return <PageSectionsRenderer pageKey="faq" sections={sections.sections} />;
  }

  return (
    <ContentBundleProvider prefix="page.faq.">
      <FAQInner />
    </ContentBundleProvider>
  );
}

function FAQInner() {
  const locale = useLocale();
  const cms = useCmsPageBody('page.faq.body', locale);
  const hasCms = !cms.loading && !cms.error && !isEmptyDoc(cms.body);

  const ctx = useContentBundleContext();
  const strings = ctx?.strings ?? {};
  const fallbackCopy = 'Content unavailable';
  const tDb = (key: string, fallback: string) => {
    const v = strings[key];
    return typeof v === 'string' && v.trim().length > 0 ? v : fallback;
  };

  const title = tDb('page.faq.title', fallbackCopy);

  return (
    <Container maxWidth="md" sx={{ py: 8 }}>
      <Box textAlign="center" sx={{ mb: 6 }}>
        <Typography variant="h2" gutterBottom color="primary.main">
          {title}
        </Typography>
      </Box>

      {hasCms ? (
        <Box sx={{ mb: 4 }}>
          <CmsRichTextRenderer json={cms.body} />
        </Box>
      ) : null}

      <Box>
        {[0, 1, 2, 3, 4, 5, 6].map((index) => (
          <Accordion key={index} sx={{ mb: 2, borderRadius: 2, '&:before': { display: 'none' } }}>
            <AccordionSummary
              expandIcon={<ExpandMore />}
              sx={{ backgroundColor: '#f8f9fa' }}
            >
        <Typography variant="h6" color="primary.main">
                {tDb(`page.faq.items.${index}.question`, fallbackCopy)}
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body1" sx={{ lineHeight: 1.6 }}>
                {tDb(`page.faq.items.${index}.answer`, fallbackCopy)}
              </Typography>
            </AccordionDetails>
          </Accordion>
        ))}
      </Box>
    </Container>
  );
}
