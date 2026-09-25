'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Box, Button, ButtonGroup, TextField, Typography } from '@mui/material';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { generateHTML } from '@tiptap/html';
import { safeParseJsonDoc, serializeJsonDoc } from '../../lib/cmsRichText';
import useContentBundle from '@/hooks/useContentBundle';

type TipTapDoc = Record<string, any>;

export function RichTextRenderer({ json }: { json: string | null | undefined }) {
    const html = useMemo(() => {
        const doc = safeParseJsonDoc(json);
        try {
            return generateHTML(doc as any, [StarterKit, TextStyle, Color]);
        } catch {
            return '';
        }
    }, [json]);

    return (
        <Box
            className="cms-prose"
            sx={{
                '& h1, & h2, & h3': { margin: '0.75rem 0 0.5rem' },
                '& p': { margin: '0.5rem 0' },
                '& ul, & ol': { paddingLeft: '1.25rem', margin: '0.5rem 0' },
            }}
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
}

export function RichTextEditor({
    label,
    value,
    onChange,
}: {
    label?: string;
    value: string | null | undefined;
    onChange: (nextJson: string) => void;
}) {
    const admin = useContentBundle('admin.');
    const [color, setColor] = useState<string>('#000000');
    const onChangeRef = React.useRef(onChange);

    useEffect(() => {
        onChangeRef.current = onChange;
    }, [onChange]);

    const doc = useMemo(() => safeParseJsonDoc(value), [value]);

    const editor = useEditor({
        extensions: [StarterKit, TextStyle, Color],
        content: doc,
        editorProps: {
            attributes: {
                class: 'cms-editor',
            },
        },
        onUpdate: ({ editor }) => {
            onChangeRef.current(serializeJsonDoc(editor.getJSON() as any));
        },
    });

    // Keep editor in sync when switching pages/fields.
    useEffect(() => {
        if (!editor) return;
        // Typing updates `value` through onChange. Replacing identical content on
        // every keystroke resets the selection and makes the editor jump.
        if (serializeJsonDoc(editor.getJSON() as any) !== serializeJsonDoc(doc)) {
            editor.commands.setContent(doc as any, { emitUpdate: false });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editor, value]);

    useEffect(() => {
        if (!editor) return;
        const current = editor.getAttributes('textStyle')?.color;
        if (typeof current === 'string' && current) setColor(current);
    }, [editor]);

    if (!editor) return null;

    return (
        <Box>
            {label ? (
                <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
                    {label}
                </Typography>
            ) : null}

            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1, flexWrap: 'wrap' }}>
                <ButtonGroup size="small" variant="outlined">
                    <Button
                        onClick={() => editor.chain().focus().toggleBold().run()}
                        disabled={!editor.can().chain().focus().toggleBold().run()}
                    >
                        {admin.t('admin.richText.bold', 'Bold')}
                    </Button>
                    <Button
                        onClick={() => editor.chain().focus().toggleItalic().run()}
                        disabled={!editor.can().chain().focus().toggleItalic().run()}
                    >
                        {admin.t('admin.richText.italic', 'Italic')}
                    </Button>
                    <Button
                        onClick={() => editor.chain().focus().toggleBulletList().run()}
                    >
                        {admin.t('admin.richText.bullets', 'Bullets')}
                    </Button>
                    <Button
                        onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    >
                        {admin.t('admin.richText.numbered', 'Numbered')}
                    </Button>
                </ButtonGroup>

                <TextField
                    type="color"
                    size="small"
                    label={admin.t('admin.richText.textColor', 'Text color')}
                    value={color}
                    onChange={(e) => {
                        const next = e.target.value;
                        setColor(next);
                        editor.chain().focus().setColor(next).run();
                    }}
                    InputLabelProps={{ shrink: true }}
                    sx={{ width: 140 }}
                />

                <Button
                    size="small"
                    variant="text"
                    onClick={() => {
                        setColor('#000000');
                        editor.chain().focus().unsetColor().run();
                    }}
                >
                    {admin.t('admin.richText.resetColor', 'Reset color')}
                </Button>
            </Box>

            <Box
                sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    p: 1.5,
                    minHeight: 180,
                    '& .cms-editor': {
                        outline: 'none',
                        minHeight: 150,
                    },
                    '& .cms-editor p': { margin: '0.5rem 0' },
                    '& .cms-editor ul, & .cms-editor ol': { paddingLeft: '1.25rem' },
                }}
            >
                <EditorContent editor={editor} />
            </Box>
        </Box>
    );
}
