'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Autocomplete,
    Box,
    Button,
    Checkbox,
    CircularProgress,
    Dialog,
    FormControl,
    FormControlLabel,
    Grid,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import type { Database } from '@/lib/database.types';
import useContentBundle from '@/hooks/useContentBundle';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { rpc } from '@/lib/rpc';

type ExpenseRow = Database['public']['Tables']['business_expenses']['Row'];
type ReceiptRow = Database['public']['Tables']['receipts']['Row'];
type SessionRow = Database['public']['Tables']['sessions']['Row'];

type FinanceCategory = Database['public']['Enums']['finance_category'];
type PaymentMethod = Database['public']['Enums']['payment_method'];

type ExpenseDraft = {
    expense_date: string;
    vendor_name: string;
    description: string;
    category: FinanceCategory;
    payment_method: PaymentMethod | '';
    subtotal_usd: string;
    tax_usd: string;
    fees_usd: string;
    total_usd: string;
    total_manual: boolean;
    transaction_id: string;
    is_refund: boolean;
    parent_expense_id: string;
    notes: string;
};

type ReceiptDraft = {
    receipt_date: string;
    vendor_name: string;
    description: string;
    category: FinanceCategory;
    payment_method: PaymentMethod | '';
    subtotal_usd: string;
    tax_usd: string;
    tip_usd: string;
    total_usd: string;
    transaction_id: string;
    is_refund: boolean;
    parent_receipt_id: string;
    receipt_storage_path: string;
    source_type: string;
    notes: string;
};

type RefundParentSessionOption = {
    id: string;
    label: string;
};

const FINANCE_CATEGORIES: FinanceCategory[] = [
    'fuel',
    'equipment',
    'advertising',
    'lessons',
    'food',
    'software',
    'payroll',
    'other',
];

const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'card', 'ach', 'check', 'stripe', 'other'];

const FINANCES_BUCKET = 'Finances';

const FINANCES_FOLDERS_BY_CATEGORY: Record<FinanceCategory, string> = {
    fuel: 'Fuel',
    equipment: 'Equipment',
    advertising: 'Advertising',
    lessons: 'Lessons',
    food: 'Food',
    software: 'Software',
    payroll: 'Payroll',
    other: 'Other',
};

function formatUsdFromCents(cents: number | null | undefined): string {
    if (cents == null) return '';
    const dollars = Number(cents) / 100;
    if (!Number.isFinite(dollars)) return '';
    return dollars.toFixed(2);
}

function parseUsdToCents(value: string): number | null {
    const raw = String(value ?? '').trim();
    if (!raw) return null;
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    return Math.max(0, Math.round(n * 100));
}

function todayYmd(): string {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

function monthStartYmd(): string {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${yyyy}-${mm}-01`;
}

function formatDateMdy(ymd: string): string {
    const raw = String(ymd || '').trim();
    const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return raw;
    return `${m[2]}-${m[3]}-${m[1]}`;
}

function formatSessionTimeMdy(sessionTime: string | null): string {
    const raw = String(sessionTime || '').trim();
    if (!raw) return '';
    const d = new Date(raw);
    if (!Number.isFinite(d.getTime())) return raw;
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${mm}-${dd}-${yyyy}`;
}

function computeAutoTotalUsd(subtotalUsd: string, taxUsd: string, feesUsd: string): string {
    const s = String(subtotalUsd || '').trim();
    const t = String(taxUsd || '').trim();
    const f = String(feesUsd || '').trim();
    if (!s && !t && !f) return '';

    const subtotal = parseUsdToCents(s) ?? 0;
    const tax = parseUsdToCents(t) ?? 0;
    const fees = parseUsdToCents(f) ?? 0;
    return formatUsdFromCents(subtotal + tax + fees);
}

function recomputeTotalIfAuto(draft: ExpenseDraft): ExpenseDraft {
    if (draft.total_manual) return draft;
    return {
        ...draft,
        total_usd: computeAutoTotalUsd(draft.subtotal_usd, draft.tax_usd, draft.fees_usd),
    };
}

function sanitizeFilename(name: string): string {
    return String(name || 'file')
        .trim()
        .replace(/[^a-zA-Z0-9._-]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 100);
}

function defaultExpenseDraft(row?: ExpenseRow): ExpenseDraft {
    return recomputeTotalIfAuto({
        expense_date: row?.expense_date ?? todayYmd(),
        vendor_name: row?.vendor_name ?? '',
        description: row?.description ?? '',
        category: (row?.category ?? 'other') as FinanceCategory,
        payment_method: (row?.payment_method ?? '') as PaymentMethod | '',
        subtotal_usd: formatUsdFromCents(row?.subtotal_cents),
        tax_usd: formatUsdFromCents(row?.tax_cents),
        fees_usd: formatUsdFromCents(row?.tip_cents),
        total_usd: formatUsdFromCents(row?.total_cents ?? 0),
        total_manual: false,
        transaction_id: row?.transaction_id ?? '',
        is_refund: Boolean(row?.is_refund ?? false),
        parent_expense_id: row?.parent_expense_id ?? '',
        notes: row?.notes ?? '',
    });
}

function defaultReceiptDraft(expense: ExpenseRow, row?: ReceiptRow): ReceiptDraft {
    return {
        receipt_date: row?.receipt_date ?? expense.expense_date,
        vendor_name: row?.vendor_name ?? expense.vendor_name ?? '',
        description: row?.description ?? expense.description ?? '',
        category: (row?.category ?? expense.category ?? 'other') as FinanceCategory,
        payment_method: (row?.payment_method ?? expense.payment_method ?? '') as PaymentMethod | '',
        subtotal_usd: formatUsdFromCents(row?.subtotal_cents),
        tax_usd: formatUsdFromCents(row?.tax_cents),
        tip_usd: formatUsdFromCents(row?.tip_cents),
        total_usd: formatUsdFromCents(row?.total_cents ?? expense.total_cents),
        transaction_id: row?.transaction_id ?? expense.transaction_id ?? '',
        is_refund: Boolean(row?.is_refund ?? false),
        parent_receipt_id: row?.parent_receipt_id ?? '',
        receipt_storage_path: row?.receipt_storage_path ?? '',
        source_type: row?.source_type ?? 'upload',
        notes: row?.notes ?? '',
    };
}

function splitBucketPath(storagePath: string): { bucket: string | null; path: string | null } {
    const raw = String(storagePath || '').trim();
    if (!raw) return { bucket: null, path: null };
    const idx = raw.indexOf('/');
    if (idx <= 0) return { bucket: null, path: raw };
    return { bucket: raw.slice(0, idx), path: raw.slice(idx + 1) };
}

function categoryToFinancesFolder(category: FinanceCategory): string {
    return FINANCES_FOLDERS_BY_CATEGORY[category] ?? String(category);
}

async function moveStorageObject(
    receiptId: string,
    bucket: string,
    fromPath: string,
    toPath: string,
    category: FinanceCategory
): Promise<string | null> {
    const res = await fetch('/api/admin/finances/receipts/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiptId, bucket, fromPath, toPath, category }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) throw new Error(json?.message || 'Failed to move receipt file');
    return json.warning || null;
}

function validateRefundParent(isRefund: boolean, parentId: string): string | null {
    const parent = String(parentId || '').trim();
    if (isRefund && !parent) return 'Refunds require a parent ID';
    if (!isRefund && parent) return 'Non-refunds cannot have a parent ID';
    return null;
}

export default function ExpensesManager() {
    const admin = useContentBundle('admin.');
    const supabase = useMemo(() => getSupabaseClient(), []);

    const [start, setStart] = useState(monthStartYmd());
    const [end, setEnd] = useState(todayYmd());

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [rows, setRows] = useState<ExpenseRow[]>([]);
    const [draftsById, setDraftsById] = useState<Record<string, ExpenseDraft>>({});

    const [refundParentOptions, setRefundParentOptions] = useState<RefundParentSessionOption[]>([]);
    const [refundParentLoaded, setRefundParentLoaded] = useState(false);
    const [refundParentLoading, setRefundParentLoading] = useState(false);

    const [receiptsByExpenseId, setReceiptsByExpenseId] = useState<Record<string, ReceiptRow[]>>({});
    const [receiptDraftsById, setReceiptDraftsById] = useState<Record<string, ReceiptDraft>>({});
    const [receiptPanelOpenByExpenseId, setReceiptPanelOpenByExpenseId] = useState<Record<string, boolean>>({});
    const [receiptEditorOpenById, setReceiptEditorOpenById] = useState<Record<string, boolean>>({});

    const [newDraft, setNewDraft] = useState<ExpenseDraft>(() => defaultExpenseDraft());

    const [newHasReceipt, setNewHasReceipt] = useState(false);
    const [newReceiptFile, setNewReceiptFile] = useState<File | null>(null);

    const [uploadingForExpenseId, setUploadingForExpenseId] = useState<string | null>(null);
    const [selectedFileByExpenseId, setSelectedFileByExpenseId] = useState<Record<string, File | null>>({});

    const [receiptViewer, setReceiptViewer] = useState<{ open: boolean; url: string; storagePath: string; title: string }>(
        { open: false, url: '', storagePath: '', title: '' }
    );

    const loadRefundParentOptions = useCallback(async () => {
        if (refundParentLoaded || refundParentLoading) return;
        setRefundParentLoading(true);
        try {
            const sessions = await rpc<SessionRow[]>(supabase, 'admin_list_sessions', { include_deleted: false });
            const allowed = (Array.isArray(sessions) ? sessions : []).filter(
                (s) => s.lesson_status === 'canceled_with_refund' || s.lesson_status === 'booked_paid_in_full'
            );

            allowed.sort((a, b) => {
                const at = a.session_time ? new Date(a.session_time).getTime() : 0;
                const bt = b.session_time ? new Date(b.session_time).getTime() : 0;
                return bt - at;
            });

            const options: RefundParentSessionOption[] = allowed.map((s) => {
                const date = formatSessionTimeMdy(s.session_time);
                const names = Array.isArray(s.client_names) ? s.client_names.filter(Boolean).join(', ') : '';
                const status = s.lesson_status === 'canceled_with_refund' ? 'Canceled (with refund)' : 'Booked (paid in full)';
                const parts = [date, names, status].filter((p) => String(p || '').trim());
                return { id: s.id, label: parts.join(' · ') || s.id };
            });

            setRefundParentOptions(options);
            setRefundParentLoaded(true);
        } catch (e: any) {
            setError(e?.message || 'Failed to load sessions');
        } finally {
            setRefundParentLoading(false);
        }
    }, [supabase, refundParentLoaded, refundParentLoading]);

    const loadExpenses = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await rpc<ExpenseRow[]>(supabase, 'admin_list_business_expenses_range', {
                p_start: start,
                p_end: end,
            });
            const normalized = Array.isArray(data) ? data : [];
            setRows(normalized);

            const nextDrafts: Record<string, ExpenseDraft> = {};
            for (const r of normalized) nextDrafts[r.id] = defaultExpenseDraft(r);
            setDraftsById(nextDrafts);

            setReceiptsByExpenseId({});
            setReceiptDraftsById({});
            setReceiptPanelOpenByExpenseId({});
            setReceiptEditorOpenById({});
        } catch (e: any) {
            setError(e?.message || 'Failed to load');
        } finally {
            setLoading(false);
        }
    }, [supabase, start, end]);

    const uploadReceiptFile = useCallback(async (expenseId: string, category: FinanceCategory, file: File): Promise<string> => {
        const form = new FormData();
        form.set('expense_id', expenseId);
        form.set('category', String(category));
        form.set('file', file);

        const res = await fetch('/api/admin/finances/receipts/upload', { method: 'POST', body: form });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) throw new Error(json?.message || 'Upload failed');
        const storagePath = String(json.storagePath || '').trim();
        if (!storagePath) throw new Error('Upload failed');
        return storagePath;
    }, []);

    useEffect(() => {
        void loadExpenses();
    }, [loadExpenses]);

    const createExpense = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const refundError = validateRefundParent(Boolean(newDraft.is_refund), newDraft.parent_expense_id);
            if (refundError) {
                setError(refundError);
                return;
            }

            const subtotal = parseUsdToCents(newDraft.subtotal_usd);
            const tax = parseUsdToCents(newDraft.tax_usd);
            const fees = parseUsdToCents(newDraft.fees_usd);
            const total = parseUsdToCents(newDraft.total_usd);

            const computedTotal = (subtotal ?? 0) + (tax ?? 0) + (fees ?? 0);
            const totalCents = total ?? computedTotal;

            const created = await rpc<ExpenseRow>(supabase, 'admin_create_business_expense', {
                p_expense_date: newDraft.expense_date,
                p_category: newDraft.category,
                p_total_cents: totalCents,
                p_vendor_name: newDraft.vendor_name || null,
                p_description: newDraft.description || null,
                p_payment_method: newDraft.payment_method || null,
                p_subtotal_cents: subtotal,
                p_tax_cents: tax,
                // Stored in tip_cents column, but treated as Fees in the UI.
                p_tip_cents: fees,
                p_transaction_id: newDraft.transaction_id || null,
                p_is_refund: Boolean(newDraft.is_refund),
                p_parent_expense_id: newDraft.parent_expense_id ? newDraft.parent_expense_id : null,
                p_notes: newDraft.notes || null,
            });

            if (newHasReceipt) {
                if (!newReceiptFile) {
                    setError('Choose a receipt file first');
                    return;
                }
                await (async () => {
                    if (!supabase) throw new Error('Network error');
                    const receiptStoragePath = await uploadReceiptFile(created.id, newDraft.category, newReceiptFile);
                    await rpc(supabase, 'admin_create_expense_receipt', {
                        p_expense_id: created.id,
                        p_receipt_date: newDraft.expense_date,
                        p_category: newDraft.category,
                        p_total_cents: totalCents,
                        p_receipt_storage_path: receiptStoragePath,
                        p_vendor_name: newDraft.vendor_name || null,
                        p_description: newDraft.description || null,
                        p_payment_method: newDraft.payment_method || null,
                        p_subtotal_cents: subtotal,
                        p_tax_cents: tax,
                        p_tip_cents: fees,
                        p_transaction_id: newDraft.transaction_id || null,
                        p_is_refund: false,
                        p_parent_receipt_id: null,
                        p_source_type: 'upload',
                        p_notes: null,
                    });
                })();
            }

            setNewDraft(defaultExpenseDraft());
            setNewHasReceipt(false);
            setNewReceiptFile(null);
            await loadExpenses();
        } catch (e: any) {
            setError(e?.message || 'Create failed');
        } finally {
            setLoading(false);
        }
    }, [supabase, newDraft, newHasReceipt, newReceiptFile, loadExpenses, uploadReceiptFile]);

    const saveExpense = useCallback(
        async (id: string) => {
            const d = draftsById[id];
            if (!d) return;

            try {
                const refundError = validateRefundParent(Boolean(d.is_refund), d.parent_expense_id);
                if (refundError) {
                    setError(refundError);
                    return;
                }

                const existing = rows.find((r) => r.id === id);
                const oldCategory = existing?.category;
                const categoryChanged = Boolean(oldCategory && oldCategory !== d.category);
                const relocationWarnings: string[] = [];

                setLoading(true);
                setError(null);

                const subtotal = parseUsdToCents(d.subtotal_usd);
                const tax = parseUsdToCents(d.tax_usd);
                const fees = parseUsdToCents(d.fees_usd);
                const total = parseUsdToCents(d.total_usd);

                const computedTotal = (subtotal ?? 0) + (tax ?? 0) + (fees ?? 0);
                const totalCents = total ?? computedTotal;

                await rpc(supabase, 'admin_update_business_expense', {
                    p_id: id,
                    p_expense_date: d.expense_date,
                    p_category: d.category,
                    p_total_cents: totalCents,
                    p_vendor_name: d.vendor_name || null,
                    p_description: d.description || null,
                    p_payment_method: d.payment_method || null,
                    p_subtotal_cents: subtotal,
                    p_tax_cents: tax,
                    // Stored in tip_cents column, but treated as Fees in the UI.
                    p_tip_cents: fees,
                    p_transaction_id: d.transaction_id || null,
                    p_is_refund: Boolean(d.is_refund),
                    p_parent_expense_id: d.parent_expense_id ? d.parent_expense_id : null,
                    p_notes: d.notes || null,
                });

                if (categoryChanged && oldCategory) {
                    // Move any existing receipt objects to the new Finances/<Category>/ folder.
                    const receipts = await rpc<ReceiptRow[]>(supabase, 'admin_list_receipts_for_expense', {
                        p_expense_id: id,
                    });
                    const list = Array.isArray(receipts) ? receipts : [];

                    const oldFolder = categoryToFinancesFolder(oldCategory);
                    const newFolder = categoryToFinancesFolder(d.category);

                    for (const rec of list) {
                        const { bucket, path } = splitBucketPath(rec.receipt_storage_path);
                        if (!bucket || !path) continue;
                        if (bucket !== FINANCES_BUCKET) continue;

                        const firstSeg = path.split('/')[0] ?? '';
                        const isOldFolder = firstSeg === oldFolder;
                        const alreadyInNewFolder = firstSeg === newFolder;
                        if (alreadyInNewFolder) {
                            // Keep DB category aligned with the expense category.
                            if (rec.category !== d.category) {
                                await rpc(supabase, 'admin_update_receipt', {
                                    p_id: rec.id,
                                    p_receipt_date: rec.receipt_date,
                                    p_category: d.category,
                                    p_total_cents: rec.total_cents,
                                    p_receipt_storage_path: rec.receipt_storage_path,
                                    p_vendor_name: rec.vendor_name,
                                    p_description: rec.description,
                                    p_payment_method: rec.payment_method,
                                    p_subtotal_cents: rec.subtotal_cents,
                                    p_tax_cents: rec.tax_cents,
                                    p_tip_cents: rec.tip_cents,
                                    p_transaction_id: rec.transaction_id,
                                    p_is_refund: rec.is_refund,
                                    p_parent_receipt_id: rec.parent_receipt_id,
                                    p_source_type: rec.source_type,
                                    p_notes: rec.notes,
                                });
                            }
                            continue;
                        }

                        const rest = isOldFolder ? path.slice(oldFolder.length + 1) : path;
                        const toPath = `${newFolder}/${rest}`;

                        const warning = await moveStorageObject(rec.id, FINANCES_BUCKET, path, toPath, d.category);
                        if (warning) relocationWarnings.push(warning);
                    }
                }

                await loadExpenses();
                if (relocationWarnings.length) setError(relocationWarnings.join(' '));
            } catch (e: any) {
                setError(e?.message || 'Save failed');
            } finally {
                setLoading(false);
            }
        },
        [supabase, draftsById, loadExpenses, rows]
    );

    const deleteExpense = useCallback(
        async (id: string) => {
            if (!confirm('Delete this expense? This will also delete related receipts.')) return;
            setLoading(true);
            setError(null);
            try {
                await rpc(supabase, 'admin_delete_business_expense', { p_id: id });
                await loadExpenses();
            } catch (e: any) {
                setError(e?.message || 'Delete failed');
            } finally {
                setLoading(false);
            }
        },
        [supabase, loadExpenses]
    );

    const loadReceipts = useCallback(
        async (expenseId: string) => {
            setLoading(true);
            setError(null);
            try {
                const data = await rpc<ReceiptRow[]>(supabase, 'admin_list_receipts_for_expense', {
                    p_expense_id: expenseId,
                });
                const list = Array.isArray(data) ? data : [];
                setReceiptsByExpenseId((prev) => ({ ...prev, [expenseId]: list }));

                const expense = rows.find((r) => r.id === expenseId);
                if (expense) {
                    setReceiptDraftsById((prev) => {
                        const next = { ...prev };
                        for (const r of list) next[r.id] = defaultReceiptDraft(expense, r);
                        return next;
                    });
                }
            } catch (e: any) {
                setError(e?.message || 'Failed to load receipts');
            } finally {
                setLoading(false);
            }
        },
        [supabase, rows]
    );

    // Background loader (does not toggle global loading state).
    const loadReceiptsSilently = useCallback(
        async (expenseId: string) => {
            try {
                const data = await rpc<ReceiptRow[]>(supabase, 'admin_list_receipts_for_expense', {
                    p_expense_id: expenseId,
                });
                const list = Array.isArray(data) ? data : [];
                setReceiptsByExpenseId((prev) => ({ ...prev, [expenseId]: list }));

                const expense = rows.find((r) => r.id === expenseId);
                if (expense) {
                    setReceiptDraftsById((prev) => {
                        const next = { ...prev };
                        for (const r of list) next[r.id] = defaultReceiptDraft(expense, r);
                        return next;
                    });
                }
            } catch {
                // Silent by design.
            }
        },
        [supabase, rows]
    );

    // Automatically load receipts for displayed expenses.
    useEffect(() => {
        const missing = rows
            .map((r) => r.id)
            .filter((id) => !Object.prototype.hasOwnProperty.call(receiptsByExpenseId, id));
        if (!missing.length) return;

        void (async () => {
            await Promise.all(missing.map((id) => loadReceiptsSilently(id)));
        })();
    }, [rows, receiptsByExpenseId, loadReceiptsSilently]);

    const uploadReceipt = useCallback(
        async (expense: ExpenseRow) => {
            if (!supabase) throw new Error('Network error');
            const expenseId = expense.id;
            const file = selectedFileByExpenseId[expenseId];
            const chosenCategory = draftsById[expenseId]?.category ?? expense.category;

            if (!file) {
                setError('Choose a file first');
                return;
            }

            setUploadingForExpenseId(expenseId);
            setError(null);
            try {
                const receiptStoragePath = await uploadReceiptFile(expenseId, chosenCategory as FinanceCategory, file);

                // Create receipt row (minimal, but includes required fields)
                await rpc(supabase, 'admin_create_expense_receipt', {
                    p_expense_id: expenseId,
                    p_receipt_date: expense.expense_date,
                    p_category: chosenCategory,
                    p_total_cents: expense.total_cents,
                    p_receipt_storage_path: receiptStoragePath,
                    p_vendor_name: expense.vendor_name || null,
                    p_description: expense.description || null,
                    p_payment_method: expense.payment_method || null,
                    p_subtotal_cents: expense.subtotal_cents,
                    p_tax_cents: expense.tax_cents,
                    p_tip_cents: expense.tip_cents,
                    p_transaction_id: expense.transaction_id || null,
                    // Always create receipts as non-refund by default.
                    // (Refund receipts require a parent_receipt_id per DB constraint.)
                    p_is_refund: false,
                    p_parent_receipt_id: null,
                    p_source_type: 'upload',
                    p_notes: null,
                });

                setSelectedFileByExpenseId((prev) => ({ ...prev, [expenseId]: null }));
                await loadReceipts(expenseId);
            } catch (e: any) {
                setError(e?.message || 'Upload failed');
            } finally {
                setUploadingForExpenseId(null);
            }
        },
        [supabase, selectedFileByExpenseId, loadReceipts, draftsById, uploadReceiptFile]
    );

    const saveReceipt = useCallback(
        async (expense: ExpenseRow, receiptId: string) => {
            const d = receiptDraftsById[receiptId];
            if (!d) return;

            const refundError = validateRefundParent(Boolean(d.is_refund), d.parent_receipt_id);
            if (refundError) {
                setError(refundError);
                return;
            }

            if (!String(d.receipt_storage_path || '').trim()) {
                setError('Receipt storage path is required');
                return;
            }

            setLoading(true);
            setError(null);
            try {
                const subtotal = parseUsdToCents(d.subtotal_usd);
                const tax = parseUsdToCents(d.tax_usd);
                const tip = parseUsdToCents(d.tip_usd);
                const total = parseUsdToCents(d.total_usd);
                const computedTotal = (subtotal ?? 0) + (tax ?? 0) + (tip ?? 0);
                const totalCents = total ?? computedTotal;

                await rpc(supabase, 'admin_update_receipt', {
                    p_id: receiptId,
                    p_receipt_date: d.receipt_date,
                    p_category: d.category,
                    p_total_cents: totalCents,
                    p_receipt_storage_path: d.receipt_storage_path,
                    p_vendor_name: d.vendor_name || null,
                    p_description: d.description || null,
                    p_payment_method: d.payment_method || null,
                    p_subtotal_cents: subtotal,
                    p_tax_cents: tax,
                    p_tip_cents: tip,
                    p_transaction_id: d.transaction_id || null,
                    p_is_refund: Boolean(d.is_refund),
                    p_parent_receipt_id: d.parent_receipt_id ? d.parent_receipt_id : null,
                    p_source_type: d.source_type || null,
                    p_notes: d.notes || null,
                });

                await loadReceipts(expense.id);
            } catch (e: any) {
                setError(e?.message || 'Save receipt failed');
            } finally {
                setLoading(false);
            }
        },
        [supabase, receiptDraftsById, loadReceipts]
    );

    const deleteReceipt = useCallback(
        async (expenseId: string, receiptId: string) => {
            if (!confirm('Delete this receipt record? (Storage file is not deleted.)')) return;
            setLoading(true);
            setError(null);
            try {
                await rpc(supabase, 'admin_delete_receipt', { p_id: receiptId });
                await loadReceipts(expenseId);
            } catch (e: any) {
                setError(e?.message || 'Delete receipt failed');
            } finally {
                setLoading(false);
            }
        },
        [supabase, loadReceipts]
    );

    const openReceipt = useCallback(
        async (receipt: ReceiptRow) => {
            const storagePath = String(receipt.receipt_storage_path || '').trim();
            if (!storagePath) {
                setError('Invalid receipt storage path');
                return;
            }
            setError(null);
            const res = await fetch('/api/admin/finances/receipts/signed-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ storagePath, expiresIn: 60 }),
            });
            const json = await res.json().catch(() => null);
            if (!res.ok || !json?.ok) {
                setError(json?.message || 'Failed to open receipt');
                return;
            }
            const url = String(json?.signedUrl || '').trim();
            if (!url) {
                setError('Failed to open receipt');
                return;
            }

            const title = storagePath.split('/').pop() || admin.t('admin.expenses.receipt', 'Receipt');
            setReceiptViewer({ open: true, url, storagePath, title });
        },
        [admin]
    );

    const downloadReceiptStoragePath = useCallback(
        (storagePath: string) => {
            const sp = String(storagePath || '').trim();
            if (!sp) {
                setError('Invalid receipt storage path');
                return;
            }

            const filename = sp.split('/').pop() || 'receipt';
            const href = `/api/admin/finances/receipts/download?storagePath=${encodeURIComponent(sp)}&filename=${encodeURIComponent(filename)}`;

            const a = document.createElement('a');
            a.href = href;
            a.rel = 'noreferrer';
            document.body.appendChild(a);
            a.click();
            a.remove();
        },
        []
    );

    const downloadReceipt = useCallback(
        async (receipt: ReceiptRow) => {
            downloadReceiptStoragePath(String(receipt.receipt_storage_path || ''));
        },
        [downloadReceiptStoragePath]
    );

    return (
        <Box>
            <Dialog
                fullScreen
                open={receiptViewer.open}
                onClose={() => setReceiptViewer({ open: false, url: '', storagePath: '', title: '' })}
                PaperProps={{ sx: { display: 'flex', flexDirection: 'column' } }}
            >
                <Box
                    sx={{
                        p: 1.5,
                        display: 'flex',
                        gap: 1,
                        alignItems: 'center',
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                    }}
                >
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {receiptViewer.title || admin.t('admin.expenses.receipt', 'Receipt')}
                    </Typography>
                    <Box sx={{ flex: 1 }} />
                    <Button variant="outlined" onClick={() => downloadReceiptStoragePath(receiptViewer.storagePath)}>
                        {admin.t('admin.common.download', 'Download')}
                    </Button>
                    <Button variant="contained" onClick={() => setReceiptViewer({ open: false, url: '', storagePath: '', title: '' })}>
                        {admin.t('admin.common.close', 'Close')}
                    </Button>
                </Box>

                <Box sx={{ flex: 1, minHeight: 0 }}>
                    <Box
                        component="iframe"
                        title={receiptViewer.title || 'Receipt'}
                        src={receiptViewer.url}
                        sx={{ border: 0, width: '100%', height: '100%' }}
                    />
                </Box>
            </Dialog>

            <Typography variant="h6" sx={{ mb: 1 }}>
                {admin.t('admin.expenses.title', 'Expenses')}
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
                {admin.t('admin.expenses.subtitle', 'Create and manage business expenses and receipt attachments.')}
            </Typography>

            {error ? (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            ) : null}

            <Box sx={{ mb: 4, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 800 }}>
                    {admin.t('admin.expenses.new', 'New Expense')}
                </Typography>

                <Grid container spacing={2}>
                    <Grid item xs={12} sm={4}>
                        <TextField
                            fullWidth
                            size="small"
                            type="date"
                            label={admin.t('admin.expenses.fields.date', 'Date')}
                            InputLabelProps={{ shrink: true }}
                            value={newDraft.expense_date}
                            onChange={(e) => setNewDraft((p) => ({ ...p, expense_date: String(e.target.value || '') }))}
                        />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                        <TextField
                            fullWidth
                            size="small"
                            label={admin.t('admin.expenses.fields.vendor', 'Vendor')}
                            value={newDraft.vendor_name}
                            onChange={(e) => setNewDraft((p) => ({ ...p, vendor_name: String(e.target.value || '') }))}
                        />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                        <FormControl fullWidth size="small">
                            <InputLabel id="new-expense-category">{admin.t('admin.expenses.fields.category', 'Category')}</InputLabel>
                            <Select
                                labelId="new-expense-category"
                                label={admin.t('admin.expenses.fields.category', 'Category')}
                                value={newDraft.category}
                                onChange={(e) => setNewDraft((p) => ({ ...p, category: e.target.value as FinanceCategory }))}
                            >
                                {FINANCE_CATEGORIES.map((c) => (
                                    <MenuItem key={c} value={c}>
                                        {c}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>

                    <Grid item xs={12} sm={6}>
                        <TextField
                            fullWidth
                            size="small"
                            label={admin.t('admin.expenses.fields.description', 'Description')}
                            value={newDraft.description}
                            onChange={(e) => setNewDraft((p) => ({ ...p, description: String(e.target.value || '') }))}
                        />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <FormControl fullWidth size="small">
                            <InputLabel id="new-expense-method">{admin.t('admin.expenses.fields.paymentMethod', 'Payment method')}</InputLabel>
                            <Select
                                labelId="new-expense-method"
                                label={admin.t('admin.expenses.fields.paymentMethod', 'Payment method')}
                                value={newDraft.payment_method}
                                onChange={(e) => setNewDraft((p) => ({ ...p, payment_method: String(e.target.value || '') as any }))}
                            >
                                <MenuItem value="">{admin.t('admin.common.none', '—')}</MenuItem>
                                {PAYMENT_METHODS.map((m) => (
                                    <MenuItem key={m} value={m}>
                                        {m}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>

                    <Grid item xs={12} sm={3}>
                        <TextField
                            fullWidth
                            size="small"
                            label={admin.t('admin.expenses.fields.subtotal', 'Subtotal (USD)')}
                            value={newDraft.subtotal_usd}
                            onChange={(e) =>
                                setNewDraft((p) =>
                                    recomputeTotalIfAuto({ ...p, subtotal_usd: String(e.target.value || '') })
                                )
                            }
                        />
                    </Grid>
                    <Grid item xs={12} sm={3}>
                        <TextField
                            fullWidth
                            size="small"
                            label={admin.t('admin.expenses.fields.tax', 'Tax (USD)')}
                            value={newDraft.tax_usd}
                            onChange={(e) =>
                                setNewDraft((p) => recomputeTotalIfAuto({ ...p, tax_usd: String(e.target.value || '') }))
                            }
                        />
                    </Grid>
                    <Grid item xs={12} sm={3}>
                        <TextField
                            fullWidth
                            size="small"
                            label={admin.t('admin.expenses.fields.fees', 'Fees (USD)')}
                            value={newDraft.fees_usd}
                            onChange={(e) =>
                                setNewDraft((p) => recomputeTotalIfAuto({ ...p, fees_usd: String(e.target.value || '') }))
                            }
                        />
                    </Grid>
                    <Grid item xs={12} sm={3}>
                        <TextField
                            fullWidth
                            size="small"
                            label={admin.t('admin.expenses.fields.total', 'Total (USD)')}
                            value={newDraft.total_usd}
                            onChange={(e) =>
                                setNewDraft((p) => ({
                                    ...p,
                                    total_usd: String(e.target.value || ''),
                                    total_manual: true,
                                }))
                            }
                        />
                    </Grid>

                    <Grid item xs={12} sm={6}>
                        <TextField
                            fullWidth
                            size="small"
                            label={admin.t('admin.expenses.fields.transaction', 'Transaction ID')}
                            value={newDraft.transaction_id}
                            onChange={(e) => setNewDraft((p) => ({ ...p, transaction_id: String(e.target.value || '') }))}
                        />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <Autocomplete
                            options={refundParentOptions}
                            loading={refundParentLoading}
                            onOpen={() => void loadRefundParentOptions()}
                            value={refundParentOptions.find((o) => o.id === newDraft.parent_expense_id) ?? null}
                            onChange={(_, opt) =>
                                setNewDraft((p) => ({
                                    ...p,
                                    parent_expense_id: opt?.id ? String(opt.id) : '',
                                }))
                            }
                            isOptionEqualToValue={(a, b) => a.id === b.id}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    fullWidth
                                    size="small"
                                    label={admin.t('admin.expenses.fields.parent', 'Parent session (refund)')}
                                    disabled={loading || !newDraft.is_refund}
                                    InputProps={{
                                        ...params.InputProps,
                                        endAdornment: (
                                            <>
                                                {refundParentLoading ? (
                                                    <CircularProgress color="inherit" size={16} />
                                                ) : null}
                                                {params.InputProps.endAdornment}
                                            </>
                                        ),
                                    }}
                                />
                            )}
                        />
                    </Grid>

                    <Grid item xs={12}>
                        <TextField
                            fullWidth
                            size="small"
                            multiline
                            minRows={2}
                            label={admin.t('admin.expenses.fields.notes', 'Notes')}
                            value={newDraft.notes}
                            onChange={(e) => setNewDraft((p) => ({ ...p, notes: String(e.target.value || '') }))}
                        />
                    </Grid>

                    <Grid item xs={12}>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={newDraft.is_refund}
                                    onChange={(e) => {
                                        const next = Boolean(e.target.checked);
                                        setNewDraft((p) => ({
                                            ...p,
                                            is_refund: next,
                                            parent_expense_id: next ? p.parent_expense_id : '',
                                        }));
                                    }}
                                />
                            }
                            label={admin.t('admin.expenses.fields.isRefund', 'Refund')}
                        />
                    </Grid>

                    <Grid item xs={12}>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={newHasReceipt}
                                    onChange={(_, checked) => {
                                        setNewHasReceipt(checked);
                                        if (!checked) setNewReceiptFile(null);
                                    }}
                                />
                            }
                            label={admin.t('admin.expenses.fields.hasReceipt', 'Has receipt')}
                        />
                        {newHasReceipt ? (
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1, alignItems: { sm: 'center' } }}>
                                <Button component="label" variant="outlined" disabled={loading}>
                                    {admin.t('admin.expenses.upload.chooseFile', 'Choose file')}
                                    <input
                                        hidden
                                        type="file"
                                        onChange={(e) => {
                                            const f = e.target.files?.[0] ?? null;
                                            setNewReceiptFile(f);
                                        }}
                                    />
                                </Button>
                                <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
                                    {newReceiptFile?.name || admin.t('admin.common.none', '—')}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {FINANCES_BUCKET}/{categoryToFinancesFolder(newDraft.category)}
                                </Typography>
                            </Stack>
                        ) : null}
                    </Grid>

                    <Grid item xs={12}>
                        <Button variant="contained" onClick={() => void createExpense()} disabled={loading}>
                            {admin.t('admin.common.create', 'Create')}
                        </Button>
                    </Grid>
                </Grid>
            </Box>

            <Typography variant="h6" sx={{ mb: 2, fontWeight: 800 }}>
                {admin.t('admin.expenses.list', 'Expenses')}
            </Typography>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2, flexWrap: 'wrap' }}>
                <TextField
                    size="small"
                    type="date"
                    label={admin.t('admin.common.start', 'Start')}
                    InputLabelProps={{ shrink: true }}
                    value={start}
                    onChange={(e) => setStart(String(e.target.value || ''))}
                />
                <TextField
                    size="small"
                    type="date"
                    label={admin.t('admin.common.end', 'End')}
                    InputLabelProps={{ shrink: true }}
                    value={end}
                    onChange={(e) => setEnd(String(e.target.value || ''))}
                />
                <Button variant="outlined" onClick={() => void loadExpenses()} disabled={loading}>
                    {admin.t('admin.common.refresh', 'Refresh')}
                </Button>

                {loading ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CircularProgress size={18} />
                        <Typography variant="body2">{admin.t('admin.common.loading', 'Loading…')}</Typography>
                    </Box>
                ) : null}
            </Stack>

            {!rows.length ? (
                <Typography color="text.secondary">{admin.t('admin.common.none', '—')}</Typography>
            ) : (
                <Stack spacing={2}>
                    {rows.map((r) => {
                        const d = draftsById[r.id] ?? defaultExpenseDraft(r);
                        const receiptList = receiptsByExpenseId[r.id];
                        const uploading = uploadingForExpenseId === r.id;
                        const folder = categoryToFinancesFolder(d.category);

                        return (
                            <Box key={r.id} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2 }}>
                                    <Box sx={{ flex: 1 }}>
                                        <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
                                            {r.vendor_name || admin.t('admin.expenses.untitled', 'Untitled expense')}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            <Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>
                                                {formatDateMdy(r.expense_date)}
                                            </Box>
                                            {' · '}
                                            <Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>
                                                {r.category}
                                            </Box>
                                            {' · '}
                                            <Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>
                                                ${formatUsdFromCents(r.total_cents)}
                                            </Box>
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                            {r.description || admin.t('admin.common.none', '—')}
                                        </Typography>
                                    </Box>
                                    <Stack direction="row" spacing={1} sx={{ alignSelf: { md: 'flex-start' } }}>
                                        <Button variant="outlined" onClick={() => void saveExpense(r.id)} disabled={loading}>
                                            {admin.t('admin.common.save', 'Save')}
                                        </Button>
                                        <Button color="error" variant="outlined" onClick={() => void deleteExpense(r.id)} disabled={loading}>
                                            {admin.t('admin.common.delete', 'Delete')}
                                        </Button>
                                    </Stack>
                                </Stack>

                                <Grid container spacing={2}>
                                    <Grid item xs={12} sm={4}>
                                        <TextField
                                            fullWidth
                                            size="small"
                                            type="date"
                                            label={admin.t('admin.expenses.fields.date', 'Date')}
                                            InputLabelProps={{ shrink: true }}
                                            value={d.expense_date}
                                            onChange={(e) =>
                                                setDraftsById((p) => ({ ...p, [r.id]: { ...d, expense_date: String(e.target.value || '') } }))
                                            }
                                        />
                                    </Grid>
                                    <Grid item xs={12} sm={4}>
                                        <TextField
                                            fullWidth
                                            size="small"
                                            label={admin.t('admin.expenses.fields.vendor', 'Vendor')}
                                            value={d.vendor_name}
                                            onChange={(e) =>
                                                setDraftsById((p) => ({ ...p, [r.id]: { ...d, vendor_name: String(e.target.value || '') } }))
                                            }
                                        />
                                    </Grid>
                                    <Grid item xs={12} sm={4}>
                                        <FormControl fullWidth size="small">
                                            <InputLabel id={`expense-cat-${r.id}`}>{admin.t('admin.expenses.fields.category', 'Category')}</InputLabel>
                                            <Select
                                                labelId={`expense-cat-${r.id}`}
                                                label={admin.t('admin.expenses.fields.category', 'Category')}
                                                value={d.category}
                                                onChange={(e) =>
                                                    setDraftsById((p) => ({
                                                        ...p,
                                                        [r.id]: { ...d, category: e.target.value as FinanceCategory },
                                                    }))
                                                }
                                            >
                                                {FINANCE_CATEGORIES.map((c) => (
                                                    <MenuItem key={c} value={c}>
                                                        {c}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                    </Grid>

                                    <Grid item xs={12} sm={6}>
                                        <TextField
                                            fullWidth
                                            size="small"
                                            label={admin.t('admin.expenses.fields.description', 'Description')}
                                            value={d.description}
                                            onChange={(e) =>
                                                setDraftsById((p) => ({ ...p, [r.id]: { ...d, description: String(e.target.value || '') } }))
                                            }
                                        />
                                    </Grid>
                                    <Grid item xs={12} sm={6}>
                                        <FormControl fullWidth size="small">
                                            <InputLabel id={`expense-method-${r.id}`}>{admin.t('admin.expenses.fields.paymentMethod', 'Payment method')}</InputLabel>
                                            <Select
                                                labelId={`expense-method-${r.id}`}
                                                label={admin.t('admin.expenses.fields.paymentMethod', 'Payment method')}
                                                value={d.payment_method}
                                                onChange={(e) =>
                                                    setDraftsById((p) => ({
                                                        ...p,
                                                        [r.id]: { ...d, payment_method: String(e.target.value || '') as any },
                                                    }))
                                                }
                                            >
                                                <MenuItem value="">{admin.t('admin.common.none', '—')}</MenuItem>
                                                {PAYMENT_METHODS.map((m) => (
                                                    <MenuItem key={m} value={m}>
                                                        {m}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                    </Grid>

                                    <Grid item xs={12} sm={3}>
                                        <TextField
                                            fullWidth
                                            size="small"
                                            label={admin.t('admin.expenses.fields.subtotal', 'Subtotal (USD)')}
                                            value={d.subtotal_usd}
                                            onChange={(e) =>
                                                setDraftsById((p) => ({
                                                    ...p,
                                                    [r.id]: recomputeTotalIfAuto({
                                                        ...d,
                                                        subtotal_usd: String(e.target.value || ''),
                                                    }),
                                                }))
                                            }
                                        />
                                    </Grid>
                                    <Grid item xs={12} sm={3}>
                                        <TextField
                                            fullWidth
                                            size="small"
                                            label={admin.t('admin.expenses.fields.tax', 'Tax (USD)')}
                                            value={d.tax_usd}
                                            onChange={(e) =>
                                                setDraftsById((p) => ({
                                                    ...p,
                                                    [r.id]: recomputeTotalIfAuto({ ...d, tax_usd: String(e.target.value || '') }),
                                                }))
                                            }
                                        />
                                    </Grid>
                                    <Grid item xs={12} sm={3}>
                                        <TextField
                                            fullWidth
                                            size="small"
                                            label={admin.t('admin.expenses.fields.fees', 'Fees (USD)')}
                                            value={d.fees_usd}
                                            onChange={(e) =>
                                                setDraftsById((p) => ({
                                                    ...p,
                                                    [r.id]: recomputeTotalIfAuto({
                                                        ...d,
                                                        fees_usd: String(e.target.value || ''),
                                                    }),
                                                }))
                                            }
                                        />
                                    </Grid>
                                    <Grid item xs={12} sm={3}>
                                        <TextField
                                            fullWidth
                                            size="small"
                                            label={admin.t('admin.expenses.fields.total', 'Total (USD)')}
                                            value={d.total_usd}
                                            onChange={(e) =>
                                                setDraftsById((p) => ({
                                                    ...p,
                                                    [r.id]: {
                                                        ...d,
                                                        total_usd: String(e.target.value || ''),
                                                        total_manual: true,
                                                    },
                                                }))
                                            }
                                        />
                                    </Grid>

                                    <Grid item xs={12} sm={6}>
                                        <TextField
                                            fullWidth
                                            size="small"
                                            label={admin.t('admin.expenses.fields.transaction', 'Transaction ID')}
                                            value={d.transaction_id}
                                            onChange={(e) =>
                                                setDraftsById((p) => ({
                                                    ...p,
                                                    [r.id]: { ...d, transaction_id: String(e.target.value || '') },
                                                }))
                                            }
                                        />
                                    </Grid>
                                    <Grid item xs={12} sm={6}>
                                        <Autocomplete
                                            options={refundParentOptions}
                                            loading={refundParentLoading}
                                            onOpen={() => void loadRefundParentOptions()}
                                            value={refundParentOptions.find((o) => o.id === d.parent_expense_id) ?? null}
                                            onChange={(_, opt) =>
                                                setDraftsById((p) => ({
                                                    ...p,
                                                    [r.id]: { ...d, parent_expense_id: opt?.id ? String(opt.id) : '' },
                                                }))
                                            }
                                            isOptionEqualToValue={(a, b) => a.id === b.id}
                                            renderInput={(params) => (
                                                <TextField
                                                    {...params}
                                                    fullWidth
                                                    size="small"
                                                    label={admin.t('admin.expenses.fields.parent', 'Parent session (refund)')}
                                                    disabled={loading || !d.is_refund}
                                                    InputProps={{
                                                        ...params.InputProps,
                                                        endAdornment: (
                                                            <>
                                                                {refundParentLoading ? (
                                                                    <CircularProgress color="inherit" size={16} />
                                                                ) : null}
                                                                {params.InputProps.endAdornment}
                                                            </>
                                                        ),
                                                    }}
                                                />
                                            )}
                                        />
                                    </Grid>

                                    <Grid item xs={12}>
                                        <TextField
                                            fullWidth
                                            size="small"
                                            multiline
                                            minRows={2}
                                            label={admin.t('admin.expenses.fields.notes', 'Notes')}
                                            value={d.notes}
                                            onChange={(e) =>
                                                setDraftsById((p) => ({ ...p, [r.id]: { ...d, notes: String(e.target.value || '') } }))
                                            }
                                        />
                                    </Grid>

                                    <Grid item xs={12}>
                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    checked={d.is_refund}
                                                    onChange={(e) => {
                                                        const next = Boolean(e.target.checked);
                                                        setDraftsById((p) => ({
                                                            ...p,
                                                            [r.id]: {
                                                                ...d,
                                                                is_refund: next,
                                                                parent_expense_id: next ? d.parent_expense_id : '',
                                                            },
                                                        }));
                                                    }}
                                                />
                                            }
                                            label={admin.t('admin.expenses.fields.isRefund', 'Refund')}
                                        />
                                    </Grid>

                                    <Grid item xs={12}>
                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    checked={Boolean(receiptPanelOpenByExpenseId[r.id] ?? (receiptList ? receiptList.length : false))}
                                                    onChange={(_, checked) => {
                                                        setReceiptPanelOpenByExpenseId((p) => ({ ...p, [r.id]: checked }));
                                                        // If receipts are not loaded yet, load them so we know current state.
                                                        if (checked && !receiptList) void loadReceipts(r.id);
                                                    }}
                                                />
                                            }
                                            label={admin.t('admin.expenses.fields.hasReceipt', 'Has receipt')}
                                        />

                                        {receiptPanelOpenByExpenseId[r.id] ?? (receiptList ? receiptList.length : false) ? (
                                            <Stack
                                                direction={{ xs: 'column', md: 'row' }}
                                                spacing={1}
                                                sx={{ mt: 1, alignItems: { md: 'center' } }}
                                            >
                                                <Button component="label" variant="outlined" disabled={uploading}>
                                                    {admin.t('admin.expenses.upload.chooseFile', 'Choose file')}
                                                    <input
                                                        hidden
                                                        type="file"
                                                        onChange={(e) => {
                                                            const f = e.target.files?.[0] ?? null;
                                                            setSelectedFileByExpenseId((p) => ({ ...p, [r.id]: f }));
                                                        }}
                                                    />
                                                </Button>

                                                <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
                                                    {selectedFileByExpenseId[r.id]?.name || admin.t('admin.common.none', '—')}
                                                </Typography>

                                                <Typography variant="body2" color="text.secondary">
                                                    {FINANCES_BUCKET}/{folder}
                                                </Typography>

                                                <Button variant="contained" onClick={() => void uploadReceipt(r)} disabled={uploading}>
                                                    {uploading
                                                        ? admin.t('admin.expenses.upload.uploading', 'Uploading…')
                                                        : admin.t('admin.expenses.upload.uploadAttach', 'Upload & attach')}
                                                </Button>
                                            </Stack>
                                        ) : null}
                                    </Grid>
                                </Grid>

                                <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: { md: 'center' } }}>
                                        <Typography variant="subtitle2" sx={{ flex: 1 }}>
                                            {admin.t('admin.expenses.receipts', 'Receipts')}
                                        </Typography>
                                        <Button variant="outlined" onClick={() => void loadReceipts(r.id)} disabled={loading}>
                                            {admin.t('admin.common.refresh', 'Refresh')}
                                        </Button>
                                    </Stack>

                                    {receiptList ? (
                                        <Box sx={{ mt: 2 }}>
                                            {!receiptList.length ? (
                                                <Typography color="text.secondary">{admin.t('admin.common.none', '—')}</Typography>
                                            ) : (
                                                <Stack spacing={1}>
                                                    {receiptList.map((rec) => {
                                                        const expense = r;
                                                        const storagePath = String(rec.receipt_storage_path || '').trim();
                                                        const filename = (storagePath.split('/').pop() || '').trim() || admin.t('admin.expenses.receipt', 'Receipt');
                                                        const total = formatUsdFromCents(rec.total_cents);
                                                        const date = rec.receipt_date;
                                                        const isEditing = Boolean(receiptEditorOpenById[rec.id]);

                                                        return (
                                                            <Box
                                                                key={rec.id}
                                                                sx={{
                                                                    p: 1.5,
                                                                    border: '1px solid',
                                                                    borderColor: 'divider',
                                                                    borderRadius: 2,
                                                                    backgroundColor: 'background.paper',
                                                                }}
                                                            >
                                                                <Stack
                                                                    direction={{ xs: 'column', md: 'row' }}
                                                                    spacing={1}
                                                                    sx={{ alignItems: { md: 'center' } }}
                                                                >
                                                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                                                        <Typography variant="subtitle2" sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                            {filename}
                                                                        </Typography>
                                                                        <Typography variant="body2" color="text.secondary">
                                                                            {date} · ${total || '—'}
                                                                        </Typography>
                                                                    </Box>

                                                                    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                                                                        <Button
                                                                            variant="outlined"
                                                                            onClick={() =>
                                                                                setReceiptEditorOpenById((p) => ({
                                                                                    ...p,
                                                                                    [rec.id]: !Boolean(p[rec.id]),
                                                                                }))
                                                                            }
                                                                        >
                                                                            {isEditing ? admin.t('admin.common.collapse', 'Collapse') : admin.t('admin.common.edit', 'Edit')}
                                                                        </Button>
                                                                        <Button variant="outlined" onClick={() => void openReceipt(rec)}>
                                                                            {admin.t('admin.common.view', 'View')}
                                                                        </Button>
                                                                        <Button variant="outlined" onClick={() => void downloadReceipt(rec)}>
                                                                            {admin.t('admin.common.download', 'Download')}
                                                                        </Button>
                                                                        <Button
                                                                            color="error"
                                                                            variant="outlined"
                                                                            onClick={() => void deleteReceipt(expense.id, rec.id)}
                                                                            disabled={loading}
                                                                        >
                                                                            {admin.t('admin.common.delete', 'Delete')}
                                                                        </Button>
                                                                    </Stack>
                                                                </Stack>

                                                                {isEditing ? (
                                                                    <Box sx={{ mt: 2 }}>
                                                                        <Grid container spacing={2}>
                                                                            {(() => {
                                                                                const rd = receiptDraftsById[rec.id] ?? defaultReceiptDraft(expense, rec);
                                                                                return (
                                                                                    <>
                                                                                        <Grid item xs={12} sm={4}>
                                                                                            <TextField
                                                                                                fullWidth
                                                                                                size="small"
                                                                                                type="date"
                                                                                                label={admin.t('admin.expenses.fields.date', 'Date')}
                                                                                                InputLabelProps={{ shrink: true }}
                                                                                                value={rd.receipt_date}
                                                                                                onChange={(e) =>
                                                                                                    setReceiptDraftsById((p) => ({
                                                                                                        ...p,
                                                                                                        [rec.id]: {
                                                                                                            ...rd,
                                                                                                            receipt_date: String(e.target.value || ''),
                                                                                                        },
                                                                                                    }))
                                                                                                }
                                                                                            />
                                                                                        </Grid>
                                                                                        <Grid item xs={12} sm={4}>
                                                                                            <TextField
                                                                                                fullWidth
                                                                                                size="small"
                                                                                                label={admin.t('admin.expenses.fields.vendor', 'Vendor')}
                                                                                                value={rd.vendor_name}
                                                                                                onChange={(e) =>
                                                                                                    setReceiptDraftsById((p) => ({
                                                                                                        ...p,
                                                                                                        [rec.id]: {
                                                                                                            ...rd,
                                                                                                            vendor_name: String(e.target.value || ''),
                                                                                                        },
                                                                                                    }))
                                                                                                }
                                                                                            />
                                                                                        </Grid>
                                                                                        <Grid item xs={12} sm={4}>
                                                                                            <FormControl fullWidth size="small">
                                                                                                <InputLabel id={`receipt-cat-${rec.id}`}>
                                                                                                    {admin.t('admin.expenses.fields.category', 'Category')}
                                                                                                </InputLabel>
                                                                                                <Select
                                                                                                    labelId={`receipt-cat-${rec.id}`}
                                                                                                    label={admin.t('admin.expenses.fields.category', 'Category')}
                                                                                                    value={rd.category}
                                                                                                    onChange={(e) =>
                                                                                                        setReceiptDraftsById((p) => ({
                                                                                                            ...p,
                                                                                                            [rec.id]: {
                                                                                                                ...rd,
                                                                                                                category: e.target.value as FinanceCategory,
                                                                                                            },
                                                                                                        }))
                                                                                                    }
                                                                                                >
                                                                                                    {FINANCE_CATEGORIES.map((c) => (
                                                                                                        <MenuItem key={c} value={c}>
                                                                                                            {c}
                                                                                                        </MenuItem>
                                                                                                    ))}
                                                                                                </Select>
                                                                                            </FormControl>
                                                                                        </Grid>

                                                                                        <Grid item xs={12} sm={6}>
                                                                                            <TextField
                                                                                                fullWidth
                                                                                                size="small"
                                                                                                label={admin.t('admin.expenses.fields.description', 'Description')}
                                                                                                value={rd.description}
                                                                                                onChange={(e) =>
                                                                                                    setReceiptDraftsById((p) => ({
                                                                                                        ...p,
                                                                                                        [rec.id]: {
                                                                                                            ...rd,
                                                                                                            description: String(e.target.value || ''),
                                                                                                        },
                                                                                                    }))
                                                                                                }
                                                                                            />
                                                                                        </Grid>
                                                                                        <Grid item xs={12} sm={6}>
                                                                                            <FormControl fullWidth size="small">
                                                                                                <InputLabel id={`receipt-method-${rec.id}`}>
                                                                                                    {admin.t(
                                                                                                        'admin.expenses.fields.paymentMethod',
                                                                                                        'Payment method'
                                                                                                    )}
                                                                                                </InputLabel>
                                                                                                <Select
                                                                                                    labelId={`receipt-method-${rec.id}`}
                                                                                                    label={admin.t(
                                                                                                        'admin.expenses.fields.paymentMethod',
                                                                                                        'Payment method'
                                                                                                    )}
                                                                                                    value={rd.payment_method}
                                                                                                    onChange={(e) =>
                                                                                                        setReceiptDraftsById((p) => ({
                                                                                                            ...p,
                                                                                                            [rec.id]: {
                                                                                                                ...rd,
                                                                                                                payment_method: String(e.target.value || '') as any,
                                                                                                            },
                                                                                                        }))
                                                                                                    }
                                                                                                >
                                                                                                    <MenuItem value="">{admin.t('admin.common.none', '—')}</MenuItem>
                                                                                                    {PAYMENT_METHODS.map((m) => (
                                                                                                        <MenuItem key={m} value={m}>
                                                                                                            {m}
                                                                                                        </MenuItem>
                                                                                                    ))}
                                                                                                </Select>
                                                                                            </FormControl>
                                                                                        </Grid>

                                                                                        <Grid item xs={12} sm={3}>
                                                                                            <TextField
                                                                                                fullWidth
                                                                                                size="small"
                                                                                                label={admin.t('admin.expenses.fields.subtotal', 'Subtotal (USD)')}
                                                                                                value={rd.subtotal_usd}
                                                                                                onChange={(e) =>
                                                                                                    setReceiptDraftsById((p) => ({
                                                                                                        ...p,
                                                                                                        [rec.id]: {
                                                                                                            ...rd,
                                                                                                            subtotal_usd: String(e.target.value || ''),
                                                                                                        },
                                                                                                    }))
                                                                                                }
                                                                                            />
                                                                                        </Grid>
                                                                                        <Grid item xs={12} sm={3}>
                                                                                            <TextField
                                                                                                fullWidth
                                                                                                size="small"
                                                                                                label={admin.t('admin.expenses.fields.tax', 'Tax (USD)')}
                                                                                                value={rd.tax_usd}
                                                                                                onChange={(e) =>
                                                                                                    setReceiptDraftsById((p) => ({
                                                                                                        ...p,
                                                                                                        [rec.id]: { ...rd, tax_usd: String(e.target.value || '') },
                                                                                                    }))
                                                                                                }
                                                                                            />
                                                                                        </Grid>
                                                                                        <Grid item xs={12} sm={3}>
                                                                                            <TextField
                                                                                                fullWidth
                                                                                                size="small"
                                                                                                label={admin.t('admin.expenses.fields.tip', 'Tip (USD)')}
                                                                                                value={rd.tip_usd}
                                                                                                onChange={(e) =>
                                                                                                    setReceiptDraftsById((p) => ({
                                                                                                        ...p,
                                                                                                        [rec.id]: { ...rd, tip_usd: String(e.target.value || '') },
                                                                                                    }))
                                                                                                }
                                                                                            />
                                                                                        </Grid>
                                                                                        <Grid item xs={12} sm={3}>
                                                                                            <TextField
                                                                                                fullWidth
                                                                                                size="small"
                                                                                                label={admin.t('admin.expenses.fields.total', 'Total (USD)')}
                                                                                                value={rd.total_usd}
                                                                                                onChange={(e) =>
                                                                                                    setReceiptDraftsById((p) => ({
                                                                                                        ...p,
                                                                                                        [rec.id]: { ...rd, total_usd: String(e.target.value || '') },
                                                                                                    }))
                                                                                                }
                                                                                            />
                                                                                        </Grid>

                                                                                        <Grid item xs={12} sm={6}>
                                                                                            <TextField
                                                                                                fullWidth
                                                                                                size="small"
                                                                                                label={admin.t('admin.expenses.fields.transaction', 'Transaction ID')}
                                                                                                value={rd.transaction_id}
                                                                                                onChange={(e) =>
                                                                                                    setReceiptDraftsById((p) => ({
                                                                                                        ...p,
                                                                                                        [rec.id]: {
                                                                                                            ...rd,
                                                                                                            transaction_id: String(e.target.value || ''),
                                                                                                        },
                                                                                                    }))
                                                                                                }
                                                                                            />
                                                                                        </Grid>
                                                                                        <Grid item xs={12} sm={6}>
                                                                                            <TextField
                                                                                                fullWidth
                                                                                                size="small"
                                                                                                label={admin.t(
                                                                                                    'admin.expenses.fields.parent',
                                                                                                    'Parent receipt ID (refund)'
                                                                                                )}
                                                                                                value={rd.parent_receipt_id}
                                                                                                onChange={(e) =>
                                                                                                    setReceiptDraftsById((p) => ({
                                                                                                        ...p,
                                                                                                        [rec.id]: {
                                                                                                            ...rd,
                                                                                                            parent_receipt_id: String(e.target.value || ''),
                                                                                                        },
                                                                                                    }))
                                                                                                }
                                                                                            />
                                                                                        </Grid>

                                                                                        <Grid item xs={12}>
                                                                                            <TextField
                                                                                                fullWidth
                                                                                                size="small"
                                                                                                label={admin.t(
                                                                                                    'admin.expenses.fields.storagePath',
                                                                                                    'Receipt storage path'
                                                                                                )}
                                                                                                value={rd.receipt_storage_path}
                                                                                                onChange={(e) =>
                                                                                                    setReceiptDraftsById((p) => ({
                                                                                                        ...p,
                                                                                                        [rec.id]: {
                                                                                                            ...rd,
                                                                                                            receipt_storage_path: String(e.target.value || ''),
                                                                                                        },
                                                                                                    }))
                                                                                                }
                                                                                            />
                                                                                        </Grid>

                                                                                        <Grid item xs={12} sm={6}>
                                                                                            <TextField
                                                                                                fullWidth
                                                                                                size="small"
                                                                                                label={admin.t('admin.expenses.fields.sourceType', 'Source type')}
                                                                                                value={rd.source_type}
                                                                                                onChange={(e) =>
                                                                                                    setReceiptDraftsById((p) => ({
                                                                                                        ...p,
                                                                                                        [rec.id]: {
                                                                                                            ...rd,
                                                                                                            source_type: String(e.target.value || ''),
                                                                                                        },
                                                                                                    }))
                                                                                                }
                                                                                            />
                                                                                        </Grid>
                                                                                        <Grid item xs={12} sm={6}>
                                                                                            <FormControlLabel
                                                                                                control={
                                                                                                    <Checkbox
                                                                                                        checked={rd.is_refund}
                                                                                                        onChange={(_, checked) =>
                                                                                                            setReceiptDraftsById((p) => ({
                                                                                                                ...p,
                                                                                                                [rec.id]: {
                                                                                                                    ...rd,
                                                                                                                    is_refund: checked,
                                                                                                                },
                                                                                                            }))
                                                                                                        }
                                                                                                    />
                                                                                                }
                                                                                                label={admin.t('admin.expenses.fields.isRefund', 'Refund')}
                                                                                            />
                                                                                        </Grid>

                                                                                        <Grid item xs={12}>
                                                                                            <TextField
                                                                                                fullWidth
                                                                                                size="small"
                                                                                                multiline
                                                                                                minRows={2}
                                                                                                label={admin.t('admin.expenses.fields.notes', 'Notes')}
                                                                                                value={rd.notes}
                                                                                                onChange={(e) =>
                                                                                                    setReceiptDraftsById((p) => ({
                                                                                                        ...p,
                                                                                                        [rec.id]: { ...rd, notes: String(e.target.value || '') },
                                                                                                    }))
                                                                                                }
                                                                                            />
                                                                                        </Grid>

                                                                                        <Grid item xs={12}>
                                                                                            <Stack direction="row" spacing={1}>
                                                                                                <Button
                                                                                                    variant="contained"
                                                                                                    onClick={() => void saveReceipt(expense, rec.id)}
                                                                                                    disabled={loading}
                                                                                                >
                                                                                                    {admin.t('admin.common.save', 'Save')}
                                                                                                </Button>
                                                                                                <Button
                                                                                                    variant="outlined"
                                                                                                    onClick={() =>
                                                                                                        setReceiptEditorOpenById((p) => ({
                                                                                                            ...p,
                                                                                                            [rec.id]: false,
                                                                                                        }))
                                                                                                    }
                                                                                                >
                                                                                                    {admin.t('admin.common.close', 'Close')}
                                                                                                </Button>
                                                                                            </Stack>
                                                                                        </Grid>
                                                                                    </>
                                                                                );
                                                                            })()}
                                                                        </Grid>
                                                                    </Box>
                                                                ) : null}
                                                            </Box>
                                                        );
                                                    })}
                                                </Stack>
                                            )}
                                        </Box>
                                    ) : (
                                        <Typography color="text.secondary" sx={{ mt: 1 }}>
                                            {admin.t('admin.common.loading', 'Loading…')}
                                        </Typography>
                                    )}
                                </Box>
                            </Box>
                        );
                    })}
                </Stack>
            )}
        </Box>
    );
}
