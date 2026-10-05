CREATE OR REPLACE FUNCTION public.get_page_content(p_page_key text, p_locale text DEFAULT 'en'::text)
 RETURNS TABLE(page_key text, locale text, body text, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_row public.cms_page_content%rowtype;
  v_body text;
  v_locale text;
begin
  select *
    into v_row
  from public.cms_page_content c
  where c.page_key = p_page_key
  limit 1;

  if not found then
    return;
  end if;

  -- Spanish: only show if approved and published exists; otherwise fallback to English
  if lower(coalesce(p_locale,'en')) = 'es'
     and v_row.approved = true
     and v_row.body_es_published is not null
  then
    v_body := v_row.body_es_published;
    v_locale := 'es';
  else
    v_body := v_row.body_en;
    v_locale := 'en';
  end if;

  return query
  select v_row.page_key, v_locale, v_body, v_row.updated_at;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_page_content_by_prefix(p_prefix text, p_locale text DEFAULT 'en'::text)
 RETURNS TABLE(page_key text, locale text, body text, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if p_prefix is null or length(trim(p_prefix)) = 0 then
    return;
  end if;

  return query
  select
    c.page_key,
    case
      when lower(coalesce(p_locale, 'en')) = 'es'
        and c.approved = true
        and c.body_es_published is not null
      then 'es'
      else 'en'
    end as locale,
    case
      when lower(coalesce(p_locale, 'en')) = 'es'
        and c.approved = true
        and c.body_es_published is not null
      then c.body_es_published
      else c.body_en
    end as body,
    c.updated_at
  from public.cms_page_content c
  where c.page_key like (p_prefix || '%')
  order by c.sort asc, c.page_key asc;
end;
$function$;

-- Internal admin RPCs need a signed-in user and still enforce the UID allowlist.
DO $$
DECLARE f record;
BEGIN
  FOR f IN SELECT format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)) signature
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND (left(p.proname, 6) = 'admin_' OR p.proname IN
      ('rpc_create_page_section', 'rpc_delete_page_section', 'rpc_upsert_page_sections'))
  LOOP
    EXECUTE 'REVOKE ALL ON FUNCTION ' || f.signature || ' FROM PUBLIC, anon';
    EXECUTE 'GRANT EXECUTE ON FUNCTION ' || f.signature || ' TO authenticated, service_role';
  END LOOP;
  FOR f IN SELECT format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)) signature
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname IN ('trg_booking_requests_set_bill_total', 'set_updated_at',
      'compute_booking_request_bill_total_cents', 'rpc_get_page_sections',
      'admin_create_business_expense', 'admin_update_business_expense')
  LOOP
    EXECUTE 'ALTER FUNCTION ' || f.signature || ' SET search_path = public, pg_temp';
  END LOOP;
END;
$$;
-- Active lessons are public data; inactive catalog entries remain hidden.
REVOKE ALL ON public.lesson_types FROM anon, authenticated;
GRANT SELECT ON public.lesson_types TO anon, authenticated;
CREATE POLICY lesson_types_active_read ON public.lesson_types FOR SELECT TO anon, authenticated USING (is_active);

CREATE OR REPLACE FUNCTION public.admin_relocate_receipt(p_id uuid, p_expected_path text, p_new_path text, p_category public.finance_category)
RETURNS public.receipts LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_row public.receipts;
BEGIN
  IF NOT public.is_site_admin() THEN RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501'; END IF;
  IF p_expected_path IS NULL OR p_new_path IS NULL OR length(p_new_path) NOT BETWEEN 1 AND 1024
     OR p_new_path ~ '(^/|(^|/)\.\.(/|$))' THEN RAISE EXCEPTION 'invalid receipt path' USING ERRCODE = '22023'; END IF;
  UPDATE public.receipts SET receipt_storage_path = p_new_path, category = p_category, updated_at = now()
    WHERE id = p_id AND receipt_storage_path = p_expected_path RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'receipt changed; refresh before moving it' USING ERRCODE = '22023'; END IF;
  RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_relocate_receipt(uuid,text,text,public.finance_category) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_relocate_receipt(uuid,text,text,public.finance_category) TO authenticated, service_role;

-- Bring already canceled linked requests into the correct display state.
UPDATE public.booking_requests b SET status = 'canceled'
FROM public.sessions s WHERE b.approved_session_id = s.id AND b.status = 'approved'
  AND s.lesson_status IN ('canceled_with_refund', 'canceled_without_refund');
