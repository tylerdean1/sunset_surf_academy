-- Private media metadata must be visible to signed-in admins only.
ALTER POLICY "Allow public read on media_assets" ON public.media_assets
  USING (public = true);

-- The existing ALL policy already grants admins the same guarded SELECT.
DROP POLICY IF EXISTS "admins can read admin_users" ON public.admin_users;
