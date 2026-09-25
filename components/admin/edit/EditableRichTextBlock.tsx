'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import EditOutlined from '@mui/icons-material/EditOutlined';
import Close from '@mui/icons-material/Close';
import Check from '@mui/icons-material/Check';
import Upload from '@mui/icons-material/Upload';
import Translate from '@mui/icons-material/Translate';
import { useAdminEdit } from './AdminEditContext';
import { publishCmsSpanish } from '@/hooks/useCmsStringValue';
import { RichTextEditor, RichTextRenderer } from '@/components/admin/RichText';
import { docToPlainText, plainTextToDocJson } from '@/lib/cmsRichText';
import useContentBundle from '@/hooks/useContentBundle';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { rpc } from '@/lib/rpc';

async function saveRich(pageKey: string, locale: string, json: string) {
    const supabase = getSupabaseClient();
    const payload: any = { p_page_key: pageKey };
    if (locale === 'es') payload.p_body_es_draft = json;
    else payload.p_body_en = json;
    await rpc<void>(supabase, 'admin_upsert_page_content', payload);
}

export default function EditableRichTextBlock({
    cmsKey,
    value,
    emptyPlaceholder,
}: {
    cmsKey: string;
    value: string;
    emptyPlaceholder?: string;
}) {
    const { enabled } = useAdminEdit();
    const locale = useLocale();
    const admin = useContentBundle('admin.');

    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState('');
    const [savedValue, setSavedValue] = useState<string | null>(null);
    const [showSpanishDraft, setShowSpanishDraft] = useState(false);
    const [spanishDraft, setSpanishDraft] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [translating, setTranslating] = useState(false);
    const [translateError, setTranslateError] = useState<string | null>(null);

    const canPublish = useMemo(() => enabled && locale === 'es', [enabled, locale]);
    const displayValue = savedValue ?? value;

    useEffect(() => {
        setSavedValue(null);
    }, [cmsKey, value]);

    const startEdit = () => {
        setError(null);
        setTranslateError(null);
        setDraft(displayValue || '');
        setShowSpanishDraft(false);
        setSpanishDraft('');
        setEditing(true);
    };

    const cancelEdit = () => {
        setError(null);
        setTranslateError(null);
        setEditing(false);
    };

    const save = async () => {
        setSaving(true);
        setError(null);
        try {
            await saveRich(cmsKey, locale, draft);

            // If user generated/edited a Spanish draft while in EN, persist it too.
            if (locale !== 'es' && showSpanishDraft && spanishDraft.trim()) {
                await saveRich(cmsKey, 'es', spanishDraft);
            }

            setSavedValue(draft);
            setEditing(false);
        } catch (e: any) {
            setError(e?.message || admin.t('admin.edit.errors.saveFailed', 'Save failed'));
        } finally {
            setSaving(false);
        }
    };

    const translateToSpanish = async () => {
        setTranslating(true);
        setTranslateError(null);
        try {
            const sourceText = docToPlainText(draft);
            if (!sourceText.trim()) {
                setTranslateError(admin.t('admin.edit.translate.nothingToTranslate', 'Nothing to translate yet.'));
                return;
            }

            const res = await fetch('/api/admin/translate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: sourceText, from: 'en', to: 'es' }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok || !body?.ok) {
                throw new Error(body?.message || `Translate failed (${res.status})`);
            }

            const translated = String(body?.text || '').trim();
            setSpanishDraft(plainTextToDocJson(translated));
            setShowSpanishDraft(true);
        } catch (e: any) {
            setTranslateError(e?.message || admin.t('admin.edit.translate.failed', 'Translate failed'));
        } finally {
            setTranslating(false);
        }
    };

    const publish = async () => {
        setSaving(true);
        setError(null);
        try {
            await publishCmsSpanish(cmsKey);
        } catch (e: any) {
            setError(e?.message || admin.t('admin.edit.errors.publishFailed', 'Publish failed'));
        } finally {
            setSaving(false);
        }
    };

    if (!enabled) {
        if (!value) return null;
        return <RichTextRenderer json={value} />;
    }

    if (editing) {
        return (
            <Paper
                data-admin-edit-ui="1"
                elevation={3}
                sx={{
                    display: 'grid',
                    gap: 1.5,
                    p: 2,
                    borderRadius: 2,
                    bgcolor: 'background.paper',
                }}
            >
                {error ? <Alert severity="error">{error}</Alert> : null}
                <RichTextEditor
                    label={emptyPlaceholder || admin.t('admin.edit.richText.contentLabel', 'Content')}
                    value={draft}
                    onChange={setDraft}
                />

                {locale !== 'es' ? (
                    <Box sx={{ display: 'grid', gap: 1 }}>
                        {translateError ? <Alert severity="warning">{translateError}</Alert> : null}
                        <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
                            <Button
                                variant="outlined"
                                onClick={translateToSpanish}
                                disabled={saving || translating}
                                startIcon={<Translate />}
                            >
                                {translating
                                    ? admin.t('admin.edit.translate.translating', 'Translating…')
                                    : admin.t('admin.edit.translate.action', 'Translate to Spanish')}
                            </Button>
                        </Box>

                        {showSpanishDraft ? (
                            <RichTextEditor
                                label={admin.t('admin.edit.translate.spanishDraftLabel', 'Spanish (draft)')}
                                value={spanishDraft}
                                onChange={setSpanishDraft}
                            />
                        ) : null}
                    </Box>
                ) : null}

                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    {canPublish ? (
                        <Button variant="outlined" onClick={publish} disabled={saving} startIcon={<Upload />}>
                            {admin.t('admin.common.publish', 'Publish')}
                        </Button>
                    ) : null}
                    <Button variant="outlined" onClick={cancelEdit} disabled={saving} startIcon={<Close />}>
                        {admin.t('admin.common.cancel', 'Cancel')}
                    </Button>
                    <Button variant="contained" onClick={save} disabled={saving} startIcon={<Check />}>
                        {admin.t('admin.common.save', 'Save')}
                    </Button>
                </Box>
            </Paper>
        );
    }

    return (
        <Box sx={{ position: 'relative' }}>
            {displayValue ? <RichTextRenderer json={displayValue} /> : null}
            <Tooltip title={admin.t('admin.common.edit', 'Edit')}>
                <IconButton
                    size="small"
                    onClick={startEdit}
                    sx={{ position: 'absolute', top: -10, right: -10, backgroundColor: 'background.paper' }}
                >
                    <EditOutlined fontSize="small" />
                </IconButton>
            </Tooltip>
        </Box>
    );
}
