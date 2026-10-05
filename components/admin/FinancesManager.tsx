'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Box,
    Card,
    CardContent,
    Checkbox,
    CircularProgress,
    FormControl,
    ListItemText,
    MenuItem,
    Select,
    Stack,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import type { Database } from '@/lib/database.types';
import useContentBundle from '@/hooks/useContentBundle';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { rpc } from '@/lib/rpc';
import { expenseOutflowDollars } from '@/lib/financeCashflow';

type LessonStatus = Database['public']['Enums']['lesson_status'];
type LessonTypeRow = Database['public']['Tables']['lesson_types']['Row'];
type BusinessExpenseRow = Database['public']['Tables']['business_expenses']['Row'];
type FinanceCategory = Database['public']['Enums']['finance_category'];

type Mode = 'year' | 'month';
type ChartType = 'line' | 'bar';

type FinancePoint = {
    period: string; // YYYY-MM or YYYY-MM-DD
    revenue: number;
    tips: number;
    expenses: number;
    count: number;
};

type FinanceByStatus = {
    status: string;
    revenue: number;
    tips: number;
    count: number;
};

type FinanceResponse = {
    ok: true;
    mode: Mode;
    year: number;
    month: number;
    start: string;
    end: string;
    totals: {
        revenue: number;
        tips: number;
        expenses: number;
        net: number;
        sessionsCount: number;
        expenseReceiptsCount: number;
    };
    byStatus: FinanceByStatus[];
    points: FinancePoint[];
};

type RunningSeriesKey = 'runningTotal' | 'runningRevenue' | 'runningTips' | 'runningExpenses';

function formatMoney(n: number): string {
    if (!Number.isFinite(n)) return '$0.00';
    return n.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

function formatXAxisLabel(mode: Mode, period: string): string {
    // period is YYYY-MM or YYYY-MM-DD
    if (mode === 'month') {
        const m = String(period || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!m) return String(period || '');
        return `${m[2]}-${m[3]}`;
    }

    const m = String(period || '').match(/^(\d{4})-(\d{2})$/);
    if (!m) return String(period || '');

    const monthNum = Number(m[2]);
    const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return names[monthNum - 1] || m[2];
}

function clamp(n: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, n));
}

function pad2(n: number): string {
    return String(n).padStart(2, '0');
}

function formatYmd(d: Date): string {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function startOfNextMonth(year: number, month: number): { y: number; m: number } {
    if (month >= 12) return { y: year + 1, m: 1 };
    return { y: year, m: month + 1 };
}

function safeMoney(value: unknown): number {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.round(n * 100) / 100;
}

function parseDateKeyFromSessionTime(sessionTime: string | null): { y: number; m: number; d: number } | null {
    const s = String(sessionTime || '').trim();
    const [datePart] = s.split('T');
    const m = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
    return { y, m: mo, d };
}

function parseDateKeyFromYmd(value: string | null): { y: number; m: number; d: number } | null {
    const s = String(value || '').trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
    return { y, m: mo, d };
}

function listPeriods(mode: Mode, startIso: string, endIso: string): string[] {
    const startDate = startIso.slice(0, 10);
    const endDate = endIso.slice(0, 10);

    if (mode === 'month') {
        const out: string[] = [];
        const start = new Date(`${startDate}T00:00:00`);
        const end = new Date(`${endDate}T00:00:00`);
        if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return out;

        const cur = new Date(start.getTime());
        while (cur < end) {
            out.push(formatYmd(cur));
            cur.setDate(cur.getDate() + 1);
        }
        return out;
    }

    // year mode: month buckets
    const out: string[] = [];
    const start = parseDateKeyFromYmd(startDate);
    const end = parseDateKeyFromYmd(endDate);
    if (!start || !end) return out;

    let y = start.y;
    let m = start.m;

    // end is exclusive; iterate months until we reach end month/year.
    while (y < end.y || (y === end.y && m < end.m)) {
        out.push(`${y}-${pad2(m)}`);
        const next = startOfNextMonth(y, m);
        y = next.y;
        m = next.m;
    }

    return out;
}

const STATUS_OPTIONS: Array<{ value: LessonStatus; label: string }> = [
    { value: 'booked_unpaid', label: 'Booked (unpaid)' },
    { value: 'booked_paid_in_full', label: 'Booked (paid in full)' },
    { value: 'completed', label: 'Completed' },
    { value: 'canceled_with_refund', label: 'Canceled (with refund)' },
    { value: 'canceled_without_refund', label: 'Canceled (without refund)' },
];

const EXPENSE_CATEGORIES: FinanceCategory[] = [
    'fuel',
    'equipment',
    'advertising',
    'lessons',
    'food',
    'software',
    'payroll',
    'other',
];

export default function FinancesManager() {
    const admin = useContentBundle('admin.');
    const theme = useTheme();

    const now = new Date();
    const [mode, setMode] = useState<Mode>('year');
    const [chartType, setChartType] = useState<ChartType>('line');
    const [year, setYear] = useState<number>(now.getFullYear());
    const [month, setMonth] = useState<number>(now.getMonth() + 1);

    const [selectedLessonTypes, setSelectedLessonTypes] = useState<string[]>([]);
    const [selectedStatuses, setSelectedStatuses] = useState<LessonStatus[]>([]);
    const [expenseMode, setExpenseMode] = useState<'total' | FinanceCategory>('total');
    const [runningSeries, setRunningSeries] = useState<RunningSeriesKey[]>([
        'runningTotal',
        'runningRevenue',
        'runningTips',
        'runningExpenses',
    ]);

    const [lessonTypeOptions, setLessonTypeOptions] = useState<Array<{ key: string; label: string }>>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<FinanceResponse | null>(null);

    const yearOptions = useMemo(() => {
        const current = now.getFullYear();
        const out: number[] = [];
        for (let y = current - 4; y <= current + 1; y++) out.push(y);
        return out;
    }, [now]);

    const availableLessonTypes = lessonTypeOptions;

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const supabase = getSupabaseClient();
            if (!supabase) throw new Error('Network error');

            const normalizedYear = clamp(Number(year), 2000, 2100);
            const normalizedMonth = clamp(Number(month), 1, 12);

            let start: string;
            let end: string;
            if (mode === 'month') {
                const next = startOfNextMonth(normalizedYear, normalizedMonth);
                start = `${normalizedYear}-${pad2(normalizedMonth)}-01T00:00:00`;
                end = `${next.y}-${pad2(next.m)}-01T00:00:00`;
            } else {
                start = `${normalizedYear}-01-01T00:00:00`;
                end = `${normalizedYear + 1}-01-01T00:00:00`;
            }

            const startDate = start.slice(0, 10);
            const endDate = end.slice(0, 10);

            const sessions = await rpc<Database['public']['Tables']['sessions']['Row'][]>(supabase, 'admin_list_sessions', {
                include_deleted: false,
            } as any);

            const lessonTypes = await rpc<LessonTypeRow[]>(supabase, 'admin_list_lesson_types');
            const activeLessonTypes = (lessonTypes || []).filter((lt) => lt.is_active);
            const labelByKey = new Map<string, string>();
            for (const lt of activeLessonTypes) {
                const key = String(lt.key || '').trim();
                if (!key) continue;
                labelByKey.set(key, String(lt.display_name || key));
            }

            const keys = activeLessonTypes
                .map((lt) => String(lt.key || '').trim())
                .filter(Boolean)
                .sort((a, b) => a.localeCompare(b));

            const inRange = (sessions || []).filter((s) => {
                if (!s.session_time) return false;
                if (s.deleted_at) return false;
                return String(s.session_time) >= start && String(s.session_time) < end;
            });

            const enriched = inRange.map((s) => {
                const lessonTypeKey = String(s.lesson_type_key || '').trim() || 'unknown';
                return {
                    id: s.id,
                    session_time: s.session_time,
                    paid: safeMoney(s.paid),
                    tip: safeMoney(s.tip),
                    lesson_status: (s.lesson_status || 'unknown') as LessonStatus | 'unknown',
                    lesson_type_key: lessonTypeKey,
                };
            });

            const hasUnknown = enriched.some((s) => s.lesson_type_key === 'unknown');
            const nextLessonTypeOptions: Array<{ key: string; label: string }> = keys.map((k) => ({
                key: k,
                label: labelByKey.get(k) || k,
            }));
            if (hasUnknown) nextLessonTypeOptions.unshift({ key: 'unknown', label: 'Unknown' });
            setLessonTypeOptions(nextLessonTypeOptions);

            const filtered = enriched.filter((s) => {
                if (selectedStatuses.length) {
                    if (s.lesson_status === 'unknown') return false;
                    if (!selectedStatuses.includes(s.lesson_status as LessonStatus)) return false;
                }
                if (selectedLessonTypes.length) {
                    if (!selectedLessonTypes.includes(s.lesson_type_key)) return false;
                }
                return true;
            });

            const totalsIncome = filtered.reduce(
                (acc, s) => {
                    acc.revenue = Math.round((acc.revenue + s.paid) * 100) / 100;
                    acc.tips = Math.round((acc.tips + s.tip) * 100) / 100;
                    acc.count += 1;
                    return acc;
                },
                { revenue: 0, tips: 0, count: 0 }
            );

            const byStatusMap = new Map<string, FinanceByStatus>();
            for (const s of filtered) {
                const key = String(s.lesson_status);
                const prev = byStatusMap.get(key) || { status: key, revenue: 0, tips: 0, count: 0 };
                prev.revenue = Math.round((prev.revenue + s.paid) * 100) / 100;
                prev.tips = Math.round((prev.tips + s.tip) * 100) / 100;
                prev.count += 1;
                byStatusMap.set(key, prev);
            }
            const byStatus = Array.from(byStatusMap.values()).sort((a, b) => a.status.localeCompare(b.status));

            const pointsMap = new Map<string, FinancePoint>();
            for (const s of filtered) {
                const keyParts = parseDateKeyFromSessionTime(s.session_time);
                if (!keyParts) continue;

                const period =
                    mode === 'month'
                        ? `${keyParts.y}-${pad2(keyParts.m)}-${pad2(keyParts.d)}`
                        : `${keyParts.y}-${pad2(keyParts.m)}`;

                const prev = pointsMap.get(period) || { period, revenue: 0, tips: 0, expenses: 0, count: 0 };
                prev.revenue = Math.round((prev.revenue + s.paid) * 100) / 100;
                prev.tips = Math.round((prev.tips + s.tip) * 100) / 100;
                prev.count += 1;
                pointsMap.set(period, prev);
            }

            const expenses = await rpc<BusinessExpenseRow[]>(supabase, 'admin_list_business_expenses_range', {
                p_start: startDate,
                p_end: endDate,
            } as any);

            const expensesFiltered = (expenses || []).filter((e) => {
                if (expenseMode === 'total') return true;
                return e.category === expenseMode;
            });

            let expenseTotal = 0;
            let expenseCount = 0;
            for (const e of expensesFiltered) {
                const outflow = expenseOutflowDollars(e.total_cents);
                expenseTotal = Math.round((expenseTotal + outflow) * 100) / 100;
                expenseCount += 1;

                const keyParts = parseDateKeyFromYmd(e.expense_date);
                if (!keyParts) continue;

                const period =
                    mode === 'month'
                        ? `${keyParts.y}-${pad2(keyParts.m)}-${pad2(keyParts.d)}`
                        : `${keyParts.y}-${pad2(keyParts.m)}`;

                const prev = pointsMap.get(period) || { period, revenue: 0, tips: 0, expenses: 0, count: 0 };
                prev.expenses = Math.round((prev.expenses + outflow) * 100) / 100;
                pointsMap.set(period, prev);
            }

            const points = Array.from(pointsMap.values()).sort((a, b) => a.period.localeCompare(b.period));

            const totals = {
                revenue: totalsIncome.revenue,
                tips: totalsIncome.tips,
                expenses: expenseTotal,
                net: Math.round((totalsIncome.revenue + totalsIncome.tips - expenseTotal) * 100) / 100,
                sessionsCount: totalsIncome.count,
                expenseReceiptsCount: expenseCount,
            };

            setData({
                ok: true,
                mode,
                year: normalizedYear,
                month: normalizedMonth,
                start,
                end,
                totals,
                byStatus,
                points,
            });
        } catch (e: any) {
            setError(String(e?.message || 'Failed to load finances'));
            setData(null);
        } finally {
            setLoading(false);
        }
    }, [expenseMode, mode, month, selectedLessonTypes, selectedStatuses, year]);

    useEffect(() => {
        void fetchData();
    }, [fetchData]);

    const chartData = useMemo(() => {
        const pts = data?.points || [];
        const start = data?.start;
        const end = data?.end;
        if (!start || !end) return [];

        const byPeriod = new Map<string, FinancePoint>();
        for (const p of pts) byPeriod.set(p.period, p);

        const periods = listPeriods(mode, start, end);
        const filled: Array<
            FinancePoint & {
                label: string;
                netDelta: number;
                runningTotal: number;
                runningRevenue: number;
                runningTips: number;
                runningExpenses: number;
            }
        > = [];

        let runningTotal = 0;
        let runningRevenue = 0;
        let runningTips = 0;
        let runningExpenses = 0;

        for (const period of periods) {
            const base = byPeriod.get(period) || { period, revenue: 0, tips: 0, expenses: 0, count: 0 };
            const netDelta = Math.round((base.revenue + base.tips - base.expenses) * 100) / 100;

            runningRevenue = Math.round((runningRevenue + base.revenue) * 100) / 100;
            runningTips = Math.round((runningTips + base.tips) * 100) / 100;
            runningExpenses = Math.round((runningExpenses + base.expenses) * 100) / 100;
            runningTotal = Math.round((runningTotal + netDelta) * 100) / 100;

            filled.push({
                ...base,
                label: formatXAxisLabel(mode, period),
                netDelta,
                runningTotal,
                runningRevenue,
                runningTips,
                runningExpenses,
            });
        }

        return filled;
    }, [data, mode]);

    const revenueColor = theme.palette.primary.main;
    const runningRevenueColor = theme.palette.info.main;
    const tipsColor = theme.palette.success.main;
    const expensesColor = theme.palette.error.main;

    return (
        <Box>
            <Typography variant="h6" sx={{ mb: 1 }}>
                {admin.t('admin.finances.title', 'Finances')}
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
                {admin.t('admin.finances.subtitle', 'Revenue and tips from sessions, plus expenses from receipts.')}
            </Typography>

            <Card variant="outlined" sx={{ mb: 2 }}>
                <CardContent sx={{ pt: 2, '&:last-child': { pb: 2 } }}>
                    <Stack
                        direction={{ xs: 'column', md: 'row' }}
                        spacing={2}
                        useFlexGap
                        sx={{ flexWrap: 'wrap', alignItems: { xs: 'stretch', md: 'flex-end' } }}
                    >
                        <Box sx={{ minWidth: 200 }}>
                            <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 700 }}>
                                {admin.t('admin.finances.mode', 'Range')}
                            </Typography>
                            <ToggleButtonGroup
                                size="small"
                                exclusive
                                value={mode}
                                onChange={(_, v) => {
                                    const next = v as Mode | null;
                                    if (next) setMode(next);
                                }}
                                sx={{ width: { xs: '100%', md: 'auto' } }}
                            >
                                <ToggleButton value="year" sx={{ flex: { xs: 1, md: 'initial' } }}>
                                    {admin.t('admin.finances.mode.year', 'Year')}
                                </ToggleButton>
                                <ToggleButton value="month" sx={{ flex: { xs: 1, md: 'initial' } }}>
                                    {admin.t('admin.finances.mode.month', 'Month')}
                                </ToggleButton>
                            </ToggleButtonGroup>
                        </Box>

                        <Box sx={{ minWidth: 140 }}>
                            <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 700 }}>
                                {admin.t('admin.finances.year', 'Year')}
                            </Typography>
                            <FormControl size="small" fullWidth>
                                <Select
                                    value={String(year)}
                                    onChange={(e) => setYear(Number(e.target.value))}
                                    inputProps={{ 'aria-label': admin.t('admin.finances.year', 'Year') as string }}
                                >
                                    {yearOptions.map((y) => (
                                        <MenuItem key={y} value={String(y)}>
                                            {y}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Box>

                        {mode === 'month' ? (
                            <Box sx={{ minWidth: 160 }}>
                                <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 700 }}>
                                    {admin.t('admin.finances.month', 'Month')}
                                </Typography>
                                <FormControl size="small" fullWidth>
                                    <Select
                                        value={String(month)}
                                        onChange={(e) => setMonth(Number(e.target.value))}
                                        inputProps={{ 'aria-label': admin.t('admin.finances.month', 'Month') as string }}
                                    >
                                        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                                            <MenuItem key={m} value={String(m)}>
                                                {String(m).padStart(2, '0')}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Box>
                        ) : null}

                        <Box sx={{ minWidth: 200 }}>
                            <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 700 }}>
                                {admin.t('admin.finances.chartType', 'Chart')}
                            </Typography>
                            <ToggleButtonGroup
                                size="small"
                                exclusive
                                value={chartType}
                                onChange={(_, v) => {
                                    const next = v as ChartType | null;
                                    if (next) setChartType(next);
                                }}
                                sx={{ width: { xs: '100%', md: 'auto' } }}
                            >
                                <ToggleButton value="line" sx={{ flex: { xs: 1, md: 'initial' } }}>
                                    {admin.t('admin.finances.chartType.line', 'Line')}
                                </ToggleButton>
                                <ToggleButton value="bar" sx={{ flex: { xs: 1, md: 'initial' } }}>
                                    {admin.t('admin.finances.chartType.bar', 'Bar')}
                                </ToggleButton>
                            </ToggleButtonGroup>
                        </Box>
                    </Stack>

                    <Stack
                        direction={{ xs: 'column', md: 'row' }}
                        spacing={2}
                        useFlexGap
                        sx={{ mt: 2, flexWrap: 'wrap', alignItems: { xs: 'stretch', md: 'flex-end' } }}
                    >
                        <Box sx={{ minWidth: 240 }}>
                            <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 700 }}>
                                {admin.t('admin.finances.expensesMode', 'Expenses')}
                            </Typography>
                            <FormControl size="small" fullWidth>
                                <Select
                                    value={expenseMode}
                                    onChange={(e) => setExpenseMode(e.target.value as any)}
                                    inputProps={{ 'aria-label': admin.t('admin.finances.expensesMode', 'Expenses') as string }}
                                >
                                    <MenuItem value="total">{admin.t('admin.finances.expensesMode.total', 'Total expenses')}</MenuItem>
                                    {EXPENSE_CATEGORIES.map((c) => (
                                        <MenuItem key={c} value={c}>
                                            {String(c)}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Box>

                        <Box sx={{ minWidth: 240 }}>
                            <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 700 }}>
                                {admin.t('admin.finances.lessonTypes', 'Lesson types')}
                            </Typography>
                            <FormControl size="small" fullWidth>
                                <Select
                                    multiple
                                    value={selectedLessonTypes}
                                    onChange={(e) => setSelectedLessonTypes(e.target.value as string[])}
                                    inputProps={{ 'aria-label': admin.t('admin.finances.lessonTypes', 'Lesson types') as string }}
                                    renderValue={(selected) => {
                                        if (!selected.length) return admin.t('admin.common.all', 'All');
                                        const labelByKey = new Map(availableLessonTypes.map((o) => [o.key, o.label] as const));
                                        return selected.map((k) => labelByKey.get(String(k)) || String(k)).join(', ');
                                    }}
                                >
                                    {availableLessonTypes.map((lt) => (
                                        <MenuItem key={lt.key} value={lt.key}>
                                            {lt.label}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Box>

                        <Box sx={{ minWidth: 280 }}>
                            <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 700 }}>
                                {admin.t('admin.finances.statuses', 'Statuses')}
                            </Typography>
                            <FormControl size="small" fullWidth>
                                <Select
                                    multiple
                                    value={selectedStatuses}
                                    onChange={(e) => setSelectedStatuses(e.target.value as LessonStatus[])}
                                    inputProps={{ 'aria-label': admin.t('admin.finances.statuses', 'Statuses') as string }}
                                    renderValue={(selected) => {
                                        if (!selected.length) return admin.t('admin.common.all', 'All');
                                        const labelByValue = new Map(STATUS_OPTIONS.map((o) => [o.value, o.label] as const));
                                        return selected.map((s) => labelByValue.get(s) || s).join(', ');
                                    }}
                                >
                                    {STATUS_OPTIONS.map((o) => (
                                        <MenuItem key={o.value} value={o.value}>
                                            {o.label}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Box>

                        {chartType === 'line' ? (
                            <Box sx={{ minWidth: 260 }}>
                                <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 700 }}>
                                    {admin.t('admin.finances.runningLines', 'Running lines')}
                                </Typography>
                                <FormControl size="small" fullWidth>
                                    <Select
                                        multiple
                                        value={runningSeries}
                                        onChange={(e) => setRunningSeries(e.target.value as RunningSeriesKey[])}
                                        inputProps={{ 'aria-label': admin.t('admin.finances.runningLines', 'Running lines') as string }}
                                        renderValue={(selected) => {
                                            const set = new Set(selected as string[]);
                                            const names: string[] = [];
                                            if (set.has('runningTotal')) names.push(admin.t('admin.finances.runningTotal', 'Running total'));
                                            if (set.has('runningRevenue')) names.push(admin.t('admin.finances.runningRevenue', 'Running lesson revenue'));
                                            if (set.has('runningTips')) names.push(admin.t('admin.finances.runningTips', 'Running tips'));
                                            if (set.has('runningExpenses')) names.push(admin.t('admin.finances.runningExpenses', 'Running expenses'));
                                            return names.length ? names.join(', ') : admin.t('admin.common.none', '—');
                                        }}
                                    >
                                        <MenuItem value="runningTotal">
                                            <Checkbox checked={runningSeries.includes('runningTotal')} />
                                            <ListItemText primary={admin.t('admin.finances.runningTotal', 'Running total')} />
                                        </MenuItem>
                                        <MenuItem value="runningRevenue">
                                            <Checkbox checked={runningSeries.includes('runningRevenue')} />
                                            <ListItemText primary={admin.t('admin.finances.runningRevenue', 'Running lesson revenue')} />
                                        </MenuItem>
                                        <MenuItem value="runningTips">
                                            <Checkbox checked={runningSeries.includes('runningTips')} />
                                            <ListItemText primary={admin.t('admin.finances.runningTips', 'Running tips')} />
                                        </MenuItem>
                                        <MenuItem value="runningExpenses">
                                            <Checkbox checked={runningSeries.includes('runningExpenses')} />
                                            <ListItemText primary={admin.t('admin.finances.runningExpenses', 'Running expenses')} />
                                        </MenuItem>
                                    </Select>
                                </FormControl>
                            </Box>
                        ) : null}
                    </Stack>
                </CardContent>
            </Card>

            {loading ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2 }}>
                    <CircularProgress size={20} />
                    <Typography>{admin.t('admin.common.loading', 'Loading…')}</Typography>
                </Box>
            ) : error ? (
                <Alert severity="error" sx={{ mt: 2 }}>
                    {error}
                </Alert>
            ) : data ? (
                <>
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
                        <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, flex: 1, minWidth: 220 }}>
                            <Typography variant="body2" color="text.secondary">
                                {admin.t('admin.finances.totalRevenue', 'Total revenue')}
                            </Typography>
                            <Typography variant="h6">{formatMoney(data.totals.revenue)}</Typography>
                        </Box>
                        <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, flex: 1, minWidth: 220 }}>
                            <Typography variant="body2" color="text.secondary">
                                {admin.t('admin.finances.totalTips', 'Total tips')}
                            </Typography>
                            <Typography variant="h6">{formatMoney(data.totals.tips)}</Typography>
                        </Box>
                        <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, flex: 1, minWidth: 220 }}>
                            <Typography variant="body2" color="text.secondary">
                                {admin.t('admin.finances.totalExpenses', 'Total expenses')}
                            </Typography>
                            <Typography variant="h6">{formatMoney(data.totals.expenses)}</Typography>
                        </Box>
                        <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, flex: 1, minWidth: 220 }}>
                            <Typography variant="body2" color="text.secondary">
                                {admin.t('admin.finances.net', 'Net')}
                            </Typography>
                            <Typography variant="h6">{formatMoney(data.totals.net)}</Typography>
                        </Box>
                        <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, flex: 1, minWidth: 220 }}>
                            <Typography variant="body2" color="text.secondary">
                                {admin.t('admin.finances.totalSessions', 'Sessions')}
                            </Typography>
                            <Typography variant="h6">{data.totals.sessionsCount}</Typography>
                            <Typography variant="caption" color="text.secondary">
                                {admin.t('admin.finances.expenseReceiptsCount', 'Expense receipts')}: {data.totals.expenseReceiptsCount}
                            </Typography>
                        </Box>
                    </Box>

                    <Box sx={{ height: 320, border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1, mb: 2 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            {chartType === 'bar' ? (
                                <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="label" />
                                    <YAxis />
                                    <Tooltip
                                        formatter={(value: any, name: any) => {
                                            const n = Number(value);
                                            if (name === 'revenue' || name === 'tips' || name === 'expenses') return formatMoney(n);
                                            return String(value);
                                        }}
                                    />
                                    <Legend />
                                    <Bar dataKey="revenue" name="Revenue" fill={revenueColor} />
                                    <Bar dataKey="tips" name="Tips" fill={tipsColor} />
                                    <Bar dataKey="expenses" name="Expenses" fill={expensesColor} />
                                </BarChart>
                            ) : (
                                <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="label" />
                                    <YAxis />
                                    <Tooltip
                                        formatter={(value: any, name: any) => {
                                            const n = Number(value);
                                            if (
                                                name === 'runningTotal' ||
                                                name === 'runningRevenue' ||
                                                name === 'runningTips' ||
                                                name === 'runningExpenses' ||
                                                name === 'netDelta'
                                            )
                                                return formatMoney(n);
                                            return String(value);
                                        }}
                                    />
                                    <Legend />
                                    {runningSeries.includes('runningTotal') ? (
                                        <Line
                                            type="monotone"
                                            dataKey="runningTotal"
                                            name={admin.t('admin.finances.runningTotal', 'Running total')}
                                            stroke={revenueColor}
                                            strokeWidth={2}
                                            dot={false}
                                        />
                                    ) : null}
                                    {runningSeries.includes('runningRevenue') ? (
                                        <Line
                                            type="monotone"
                                            dataKey="runningRevenue"
                                            name={admin.t('admin.finances.runningRevenue', 'Running lesson revenue')}
                                            stroke={runningRevenueColor}
                                            strokeWidth={2}
                                            dot={false}
                                        />
                                    ) : null}
                                    {runningSeries.includes('runningTips') ? (
                                        <Line
                                            type="monotone"
                                            dataKey="runningTips"
                                            name={admin.t('admin.finances.runningTips', 'Running tips')}
                                            stroke={tipsColor}
                                            strokeWidth={2}
                                            dot={false}
                                        />
                                    ) : null}
                                    {runningSeries.includes('runningExpenses') ? (
                                        <Line
                                            type="monotone"
                                            dataKey="runningExpenses"
                                            name={admin.t('admin.finances.runningExpenses', 'Running expenses')}
                                            stroke={expensesColor}
                                            strokeWidth={2}
                                            dot={false}
                                        />
                                    ) : null}
                                </LineChart>
                            )}
                        </ResponsiveContainer>
                    </Box>

                    <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                        <Typography variant="subtitle1" sx={{ mb: 1 }}>
                            {admin.t('admin.finances.byStatus', 'Totals by status')}
                        </Typography>

                        {data.byStatus.length ? (
                            <Stack spacing={0.5}>
                                <Box
                                    sx={{
                                        display: 'flex',
                                        gap: 2,
                                        justifyContent: 'space-between',
                                        flexWrap: 'wrap',
                                        borderTop: '1px solid',
                                        borderColor: 'divider',
                                        pt: 1,
                                    }}
                                >
                                    <Typography sx={{ minWidth: 220, fontWeight: 700 }}>
                                        {admin.t('admin.finances.byStatus.headers.status', 'Status')}
                                    </Typography>
                                    <Typography sx={{ minWidth: 180, fontWeight: 700 }}>
                                        {admin.t('admin.finances.byStatus.headers.revenue', 'Revenue')}
                                    </Typography>
                                    <Typography sx={{ minWidth: 160, fontWeight: 700 }}>
                                        {admin.t('admin.finances.byStatus.headers.tips', 'Tips')}
                                    </Typography>
                                    <Typography sx={{ minWidth: 120, fontWeight: 700 }}>
                                        {admin.t('admin.finances.byStatus.headers.count', 'Count')}
                                    </Typography>
                                </Box>
                                {data.byStatus.map((row) => (
                                    <Box
                                        key={row.status}
                                        sx={{
                                            display: 'flex',
                                            gap: 2,
                                            justifyContent: 'space-between',
                                            flexWrap: 'wrap',
                                            borderTop: '1px solid',
                                            borderColor: 'divider',
                                            pt: 1,
                                        }}
                                    >
                                        <Typography sx={{ minWidth: 220 }}>{row.status}</Typography>
                                        <Typography sx={{ minWidth: 180 }}>{formatMoney(row.revenue)}</Typography>
                                        <Typography sx={{ minWidth: 160 }}>{formatMoney(row.tips)}</Typography>
                                        <Typography sx={{ minWidth: 120 }}>{row.count}</Typography>
                                    </Box>
                                ))}
                            </Stack>
                        ) : (
                            <Typography color="text.secondary">{admin.t('admin.finances.noData', 'No data for this range/filters.')}</Typography>
                        )}
                    </Box>
                </>
            ) : null}
        </Box>
    );
}
