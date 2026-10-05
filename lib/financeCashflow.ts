// Refunds here are payments returned to customers, so they are cash outflows.
export function expenseOutflowDollars(totalCents: unknown): number {
    const value = Number(totalCents);
    return Number.isFinite(value) ? Math.max(0, value) / 100 : 0;
}
