'use client';

import React from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Box,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import { CheckCircle, AccessTime, LocationOn, Group } from '@mui/icons-material';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import EditableInlineText from '@/components/admin/edit/EditableInlineText';
import useContentBundle from '@/hooks/useContentBundle';

const FALLBACK_COPY = 'Content unavailable';

interface LessonCardProps {
  title: string;
  price: string;
  duration: string;
  location: string;
  description: string;
  includes: string[];
  featured?: boolean;
  cmsKeyBase?: string;
  cmsFields?: {
    title?: boolean;
    price?: boolean;
    description?: boolean;
    duration?: boolean;
    location?: boolean;
    includes?: boolean;
  };
  bookLessonTypeId?: string;
}

const LessonCard: React.FC<LessonCardProps> = ({
  title,
  price,
  duration,
  location,
  description,
  includes,
  featured = false,
  cmsKeyBase,
  cmsFields,
  bookLessonTypeId
}) => {
  const locale = useLocale();
  const bookHref = bookLessonTypeId ? `/${locale}/book?lesson=${encodeURIComponent(bookLessonTypeId)}` : `/${locale}/book`;

  const ui = useContentBundle('ui.');
  const perPersonLabel = ui.t('ui.lessons.card.perPersonLabel', FALLBACK_COPY);
  const includesLabel = ui.t('ui.lessons.card.includesLabel', FALLBACK_COPY);
  const bookCta = ui.t('ui.lessons.card.bookCta', FALLBACK_COPY);
  const contactPricingValue = ui.t('ui.lessons.card.contactPricingValue', FALLBACK_COPY);

  const durationLabel = cmsKeyBase && cmsFields?.duration !== false ? (
    <EditableInlineText cmsKey={`${cmsKeyBase}.duration`} fallback={duration}>
      {(v) => <>{v}</>}
    </EditableInlineText>
  ) : (
    duration
  );

  const locationLabel = cmsKeyBase && cmsFields?.location !== false ? (
    <EditableInlineText cmsKey={`${cmsKeyBase}.location`} fallback={location}>
      {(v) => <>{v}</>}
    </EditableInlineText>
  ) : (
    location
  );

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        transform: featured ? 'scale(1.05)' : 'scale(1)',
        boxShadow: featured ? '0 12px 30px rgba(7, 85, 80, 0.16)' : '0 8px 24px rgba(15, 54, 53, 0.07)',
        border: featured ? (theme) => `2px solid ${theme.palette.primary.main}` : 'none',
        transition: 'all 0.3s ease-in-out',
        '&:hover': {
          transform: featured ? 'scale(1.05)' : 'scale(1.02)',
          boxShadow: '0 14px 34px rgba(7, 85, 80, 0.18)'
        }
      }}
    >
      <CardContent sx={{ flexGrow: 1, p: 3 }}>
        <Typography variant="h5" component="h3" gutterBottom fontWeight={600}>
          {cmsKeyBase && cmsFields?.title !== false ? (
            <EditableInlineText cmsKey={`${cmsKeyBase}.title`} fallback={title}>
              {(v) => <>{v}</>}
            </EditableInlineText>
          ) : (
            title
          )}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Typography variant="h4" color="primary.main" fontWeight={700}>
            {cmsKeyBase && cmsFields?.price !== false ? (
              <EditableInlineText cmsKey={`${cmsKeyBase}.price`} fallback={price}>
                {(v) => <>{v}</>}
              </EditableInlineText>
            ) : (
              price
            )}
          </Typography>
          {price !== contactPricingValue && (
            <Typography variant="body2" color="text.secondary">
              {perPersonLabel}
            </Typography>
          )}
        </Box>

        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          <Chip icon={<AccessTime />} label={durationLabel} size="small" />
          <Chip icon={<LocationOn />} label={locationLabel} size="small" />
        </Box>

        <Typography variant="body1" paragraph sx={{ mb: 3 }}>
          {cmsKeyBase && cmsFields?.description !== false ? (
            <EditableInlineText cmsKey={`${cmsKeyBase}.description`} fallback={description} multiline fullWidth>
              {(v) => <>{v}</>}
            </EditableInlineText>
          ) : (
            description
          )}
        </Typography>

        <Typography variant="h6" gutterBottom color="primary.main">
          {includesLabel}
        </Typography>
        <List dense>
          {includes.map((item, index) => (
            <ListItem key={index} sx={{ py: 0.5, px: 0 }}>
              <ListItemIcon sx={{ minWidth: 32 }}>
                <CheckCircle sx={{ color: '#4CAF50', fontSize: 20 }} />
              </ListItemIcon>
              <ListItemText
                primary={
                  cmsKeyBase && cmsFields?.includes !== false ? (
                    <EditableInlineText cmsKey={`${cmsKeyBase}.includes.${index}`} fallback={item}>
                      {(v) => <>{v}</>}
                    </EditableInlineText>
                  ) : (
                    item
                  )
                }
              />
            </ListItem>
          ))}
        </List>
      </CardContent>

      <CardActions sx={{ p: 3, pt: 0 }}>
        <Link href={bookHref} style={{ textDecoration: 'none', width: '100%' }}>
          <Button
            variant="contained"
            fullWidth
            size="large"
            sx={{
              backgroundColor: featured ? 'secondary.main' : 'primary.main',
              color: featured ? 'secondary.contrastText' : 'primary.contrastText',
              '&:hover': {
                backgroundColor: featured ? 'secondary.dark' : 'primary.dark'
              },
              py: 1.5,
              fontWeight: 600
            }}
          >
            {bookCta}
          </Button>
        </Link>
      </CardActions>
    </Card>
  );
};

export default LessonCard;
