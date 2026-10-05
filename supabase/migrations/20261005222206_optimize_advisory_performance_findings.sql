-- Resolve the actionable performance findings returned by Supabase's advisors.

-- Parent expenses are routinely joined within the same table by this key.
CREATE INDEX IF NOT EXISTS business_expenses_parent_expense_id_idx
  ON public.business_expenses(parent_expense_id);

-- The primary key fully enforces uniqueness; this separately declared unique
-- constraint duplicated its index and no foreign key depended on it.
ALTER TABLE public.admin_users DROP CONSTRAINT IF EXISTS admin_users_id_key;

-- Keep the canonical session_id index and remove the identical duplicate.
DROP INDEX IF EXISTS public.media_assets_session_idx;

-- Evaluate the request JWT once per statement rather than once per media row.
ALTER POLICY "Allow admin full access on media_assets" ON public.media_assets
  USING (((SELECT auth.jwt()) ->> 'role') = 'admin')
  WITH CHECK (((SELECT auth.jwt()) ->> 'role') = 'admin');
