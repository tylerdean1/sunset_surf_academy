export type CmsDraft = { en: string; es: string };
export type DirtyCmsLocales = Partial<Record<'en' | 'es', true>>;

export function mergeLoadedCmsDraft(
    draft: CmsDraft | undefined,
    dirty: DirtyCmsLocales | undefined,
    row: { body_en: string | null; body_es_draft: string | null } | null
): CmsDraft {
    return {
        en: dirty?.en ? draft?.en ?? '' : row?.body_en ?? '',
        es: dirty?.es ? draft?.es ?? '' : row?.body_es_draft ?? '',
    };
}

export function cmsStringOrFallback(value: unknown, fallback: string): string {
    return typeof value === 'string' ? value : fallback;
}
