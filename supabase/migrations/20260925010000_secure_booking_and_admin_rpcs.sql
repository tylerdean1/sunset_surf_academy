-- Public API clients must not be able to read booking or finance records via
-- SECURITY DEFINER functions, or write booking rows around the server API.
CREATE OR REPLACE FUNCTION public.admin_list_booking_requests(p_show_all boolean DEFAULT false)
RETURNS SETOF public.booking_requests
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_site_admin() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT br.*
    FROM public.booking_requests AS br
    WHERE COALESCE(p_show_all, false)
       OR br.status = 'pending'::public.booking_request_status
    ORDER BY br.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_receipts_for_expense(p_expense_id uuid)
RETURNS SETOF public.receipts
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_site_admin() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT r.*
    FROM public.receipts AS r
    WHERE r.expense_id = p_expense_id
    ORDER BY r.receipt_date DESC, r.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_booking_requests(boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_receipts_for_expense(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_booking_requests(boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_list_receipts_for_expense(uuid) TO authenticated, service_role;

-- No browser code uses these definer functions; keep them server-only.
REVOKE ALL ON FUNCTION public.get_public_sessions() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_media_assets_from_storage() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_sessions() TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_media_assets_from_storage() TO service_role;

DROP POLICY IF EXISTS "anon can create booking requests" ON public.booking_requests;
REVOKE INSERT ON TABLE public.booking_requests FROM anon;
