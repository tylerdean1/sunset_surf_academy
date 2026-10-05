-- All publication and booking transitions commit as one transaction.
CREATE OR REPLACE FUNCTION public.is_site_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(auth.role(), '') = 'service_role'
    OR EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid());
$$;
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.is_site_admin();
$$;

CREATE OR REPLACE FUNCTION public.admin_set_media_slot(
  p_slot_key text, p_asset_id uuid DEFAULT NULL, p_sort integer DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_key text := btrim(p_slot_key);
BEGIN
  IF NOT public.is_site_admin() THEN RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501'; END IF;
  IF v_key IS NULL OR v_key !~ '^[a-zA-Z0-9._-]{1,128}$' THEN
    RAISE EXCEPTION 'invalid slot key' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('site-media-publication', 0));
  IF p_asset_id IS NULL THEN DELETE FROM public.media_slots WHERE slot_key = v_key; RETURN; END IF;
  INSERT INTO public.media_slots(slot_key, asset_id, sort)
  VALUES(v_key, p_asset_id, greatest(-32768, least(32767, coalesce(p_sort, 32767))))
  ON CONFLICT (slot_key) DO UPDATE SET asset_id = excluded.asset_id, sort = excluded.sort;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_replace_gallery_images(p_asset_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.is_site_admin() THEN RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501'; END IF;
  IF p_asset_ids IS NULL OR cardinality(p_asset_ids) > 100 THEN
    RAISE EXCEPTION 'invalid gallery size' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(p_asset_ids) a(id) WHERE a.id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.media_assets m WHERE m.id = a.id)) THEN
    RAISE EXCEPTION 'gallery asset not found' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('site-media-publication', 0));
  DELETE FROM public.media_slots WHERE left(slot_key, 15) = 'gallery.images.';
  INSERT INTO public.media_slots(slot_key, asset_id, sort)
    SELECT 'gallery.images.' || (ord - 1), id, (ord - 1)::smallint
    FROM unnest(p_asset_ids) WITH ORDINALITY a(id, ord);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_save_content_bundle(p_strings jsonb, p_media jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_item jsonb; v_slot jsonb; v_prefix text; v_key text; v_locale text; v_body text;
BEGIN
  IF NOT public.is_site_admin() THEN RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501'; END IF;
  IF jsonb_typeof(p_strings) IS DISTINCT FROM 'array' OR jsonb_typeof(p_media) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_strings) > 500 OR jsonb_array_length(p_media) > 100
     OR octet_length(p_strings::text) + octet_length(p_media::text) > 2097152 THEN
    RAISE EXCEPTION 'invalid content bundle' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('site-media-publication', 0));
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_strings) LOOP
    v_key := v_item->>'key'; v_locale := v_item->>'locale'; v_body := v_item->>'body';
    IF v_key IS NULL OR v_key !~ '^[a-zA-Z0-9._-]{1,256}$' OR v_locale NOT IN ('en', 'es')
       OR jsonb_typeof(v_item->'body') IS DISTINCT FROM 'string' OR length(v_body) > 100000 THEN
      RAISE EXCEPTION 'invalid content value' USING ERRCODE = '22023';
    END IF;
    IF v_locale = 'en' THEN
      PERFORM public.admin_upsert_page_content(p_page_key := v_key, p_body_en := v_body);
    ELSE
      PERFORM public.admin_upsert_page_content(p_page_key := v_key, p_body_es_draft := v_body);
    END IF;
  END LOOP;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_media) LOOP
    v_prefix := rtrim(v_item->>'prefix', '.');
    IF v_prefix IS NULL OR v_prefix !~ '^[a-zA-Z0-9._-]{1,128}$'
       OR jsonb_typeof(v_item->'slots') IS DISTINCT FROM 'array'
       OR jsonb_array_length(v_item->'slots') > 100 THEN
      RAISE EXCEPTION 'invalid media prefix' USING ERRCODE = '22023';
    END IF;
    DELETE FROM public.media_slots WHERE slot_key = v_prefix OR left(slot_key, length(v_prefix) + 1) = v_prefix || '.';
    FOR v_slot IN SELECT value FROM jsonb_array_elements(v_item->'slots') LOOP
      v_key := v_slot->>'slot_key';
      IF v_key IS NULL OR v_key !~ '^[a-zA-Z0-9._-]{1,128}$'
         OR NOT (v_key = v_prefix OR left(v_key, length(v_prefix) + 1) = v_prefix || '.') THEN
        RAISE EXCEPTION 'slot outside media prefix' USING ERRCODE = '22023';
      END IF;
      INSERT INTO public.media_slots(slot_key, asset_id, sort)
      VALUES(v_key, nullif(v_slot->>'asset_id', '')::uuid, coalesce((v_slot->>'sort')::smallint, 32767))
      ON CONFLICT (slot_key) DO UPDATE SET asset_id = excluded.asset_id, sort = excluded.sort;
    END LOOP;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_save_media_asset(p_asset jsonb, p_slot_keys text[] DEFAULT NULL)
RETURNS public.media_assets LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_row public.media_assets; v_id uuid := nullif(p_asset->>'id', '')::uuid; v_key text;
BEGIN
  IF NOT public.is_site_admin() THEN RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501'; END IF;
  IF jsonb_typeof(p_asset) IS DISTINCT FROM 'object' OR length(btrim(coalesce(p_asset->>'title', ''))) NOT BETWEEN 1 AND 160
     OR length(btrim(coalesce(p_asset->>'bucket', ''))) NOT BETWEEN 1 AND 100
     OR length(btrim(coalesce(p_asset->>'path', ''))) NOT BETWEEN 1 AND 1024
     OR cardinality(p_slot_keys) > 100 THEN
    RAISE EXCEPTION 'invalid media asset' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(p_slot_keys) k WHERE k IS NULL OR k !~ '^[a-zA-Z0-9._-]{1,128}$') THEN
    RAISE EXCEPTION 'invalid slot key' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('site-media-publication', 0));
  IF v_id IS NOT NULL THEN
    UPDATE public.media_assets SET title = btrim(p_asset->>'title'), description = p_asset->>'description',
      bucket = btrim(p_asset->>'bucket'), path = btrim(p_asset->>'path'), public = (p_asset->>'public')::boolean,
      asset_type = (p_asset->>'asset_type')::public.asset_type, category = (p_asset->>'category')::public.photo_category,
      sort = coalesce((p_asset->>'sort')::smallint, 32767), session_id = nullif(p_asset->>'session_id', '')::uuid,
      updated_at = now() WHERE id = v_id RETURNING * INTO v_row;
    IF NOT FOUND THEN RAISE EXCEPTION 'media asset not found' USING ERRCODE = '22023'; END IF;
  ELSE
    INSERT INTO public.media_assets(title, description, bucket, path, public, asset_type, category, sort, session_id)
    VALUES(btrim(p_asset->>'title'), p_asset->>'description', btrim(p_asset->>'bucket'), btrim(p_asset->>'path'),
      (p_asset->>'public')::boolean, (p_asset->>'asset_type')::public.asset_type, (p_asset->>'category')::public.photo_category,
      coalesce((p_asset->>'sort')::smallint, 32767), nullif(p_asset->>'session_id', '')::uuid)
    ON CONFLICT (bucket, path) DO UPDATE SET title = excluded.title, description = excluded.description,
      public = excluded.public, asset_type = excluded.asset_type, category = excluded.category,
      sort = excluded.sort, session_id = excluded.session_id, updated_at = now() RETURNING * INTO v_row;
  END IF;
  IF p_slot_keys IS NOT NULL THEN
    DELETE FROM public.media_slots WHERE asset_id = v_row.id;
    FOREACH v_key IN ARRAY p_slot_keys LOOP
      PERFORM public.admin_set_media_slot(v_key, v_row.id, v_row.sort);
    END LOOP;
  END IF;
  RETURN v_row;
END;
$$;

-- Updates made through any booking RPC keep the associated session consistent.
CREATE OR REPLACE FUNCTION public.sync_booking_request_session() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_session public.sessions; v_names text[];
BEGIN
  IF NEW.approved_session_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO v_session FROM public.sessions WHERE id = NEW.approved_session_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NEW; END IF;
  IF v_session.lesson_status NOT IN ('booked_unpaid', 'booked_paid_in_full')
    AND (NEW.requested_date, NEW.selected_time_slot, NEW.party_size, NEW.party_names, NEW.customer_name, NEW.requested_lesson_type)
      IS DISTINCT FROM (OLD.requested_date, OLD.selected_time_slot, OLD.party_size, OLD.party_names, OLD.customer_name, OLD.requested_lesson_type) THEN
    RAISE EXCEPTION 'completed or canceled session schedule cannot be changed' USING ERRCODE = '22023';
  END IF;
  SELECT array_agg(x ORDER BY first_ord) INTO v_names FROM (
    SELECT x, min(ord) first_ord FROM unnest(array_prepend(NEW.customer_name, coalesce(NEW.party_names, ARRAY[]::text[])))
    WITH ORDINALITY t(x, ord) WHERE btrim(coalesce(x, '')) <> '' GROUP BY x
  ) names;
  UPDATE public.sessions SET paid = NEW.amount_paid_cents / 100.0,
    bill_total = coalesce(NEW.bill_total_cents / 100.0, bill_total),
    session_time = CASE WHEN lesson_status IN ('booked_unpaid', 'booked_paid_in_full') THEN NEW.requested_date + NEW.selected_time_slot ELSE session_time END,
    group_size = CASE WHEN lesson_status IN ('booked_unpaid', 'booked_paid_in_full') THEN NEW.party_size ELSE group_size END,
    client_names = CASE WHEN lesson_status IN ('booked_unpaid', 'booked_paid_in_full') THEN v_names ELSE client_names END,
    lesson_type_key = CASE WHEN lesson_status IN ('booked_unpaid', 'booked_paid_in_full') THEN NEW.requested_lesson_type ELSE lesson_type_key END,
    lesson_status = CASE WHEN lesson_status IN ('booked_unpaid', 'booked_paid_in_full') THEN
      CASE WHEN NEW.bill_total_cents IS NOT NULL AND NEW.amount_paid_cents >= NEW.bill_total_cents THEN 'booked_paid_in_full'::public.lesson_status
      ELSE 'booked_unpaid'::public.lesson_status END ELSE lesson_status END
  WHERE id = NEW.approved_session_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER booking_request_sync_session AFTER UPDATE ON public.booking_requests
FOR EACH ROW EXECUTE FUNCTION public.sync_booking_request_session();

CREATE OR REPLACE FUNCTION public.admin_apply_booking_request_payment(p_id uuid, p_delta_cents integer)
RETURNS public.booking_requests LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_row public.booking_requests;
BEGIN
  IF NOT public.is_site_admin() THEN RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501'; END IF;
  IF p_delta_cents IS NULL OR p_delta_cents = 0 THEN RAISE EXCEPTION 'invalid payment' USING ERRCODE = '22023'; END IF;
  UPDATE public.booking_requests SET amount_paid_cents = amount_paid_cents + p_delta_cents
    WHERE id = p_id RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'booking request not found' USING ERRCODE = '22023'; END IF;
  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_replace_gallery_images(uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_save_content_bundle(jsonb,jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_save_media_asset(jsonb,text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sync_booking_request_session() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_replace_gallery_images(uuid[]), public.admin_save_content_bundle(jsonb,jsonb),
  public.admin_save_media_asset(jsonb,text[]) TO authenticated, service_role;
-- These roles operate through guarded RPCs rather than table write grants.
REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE CREATE ON SCHEMA public FROM PUBLIC, anon, authenticated;
CREATE INDEX IF NOT EXISTS media_assets_session_id_idx ON public.media_assets(session_id);
CREATE INDEX IF NOT EXISTS receipts_parent_receipt_id_idx ON public.receipts(parent_receipt_id);
CREATE INDEX IF NOT EXISTS booking_requests_decided_by_idx ON public.booking_requests(decided_by);

-- Retain established pricing/participant semantics; serialize competing decisions and edits.
CREATE OR REPLACE FUNCTION public.admin_decide_booking_request(p_id uuid, p_action text, p_selected_time_label text DEFAULT NULL::text, p_decision_reason text DEFAULT NULL::text)
 RETURNS booking_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$

DECLARE
  v_req public.booking_requests;
  v_updated public.booking_requests;
  v_action text;

  v_label text;
  v_m text[];
  v_hour12 int;
  v_minute int;
  v_ampm text;
  v_hour24 int;
  v_time time;
  v_session_time timestamp without time zone;

  v_bill_total_cents int;
  v_amount_paid_cents int;
  v_bill_total numeric;
  v_paid numeric;
  v_lesson_status public.lesson_status;

  v_session public.sessions;
  v_client_names text[];
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  v_action := lower(coalesce(p_action, ''));
  IF v_action NOT IN ('approve', 'deny', 'cancel') THEN
    RAISE EXCEPTION 'invalid action';
  END IF;

  SELECT * INTO v_req
  FROM public.booking_requests
  WHERE id = p_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'booking_request not found';
  END IF;

  -- deny
  IF v_action = 'deny' THEN
    IF v_req.status <> 'pending' THEN RAISE EXCEPTION 'only pending requests can be denied' USING ERRCODE = '22023'; END IF;
    UPDATE public.booking_requests
    SET
      status = 'denied',
      decided_at = now(),
      decided_by = auth.uid(),
      decision_reason = p_decision_reason,
      updated_at = now()
    WHERE id = p_id
    RETURNING * INTO v_updated;

    RETURN v_updated;
  END IF;

  -- cancel
  IF v_action = 'cancel' THEN
    IF v_req.status NOT IN ('pending', 'approved') THEN RAISE EXCEPTION 'request cannot be canceled' USING ERRCODE = '22023'; END IF;
    IF v_req.approved_session_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.sessions WHERE id = v_req.approved_session_id AND lesson_status NOT IN ('booked_unpaid', 'booked_paid_in_full')) THEN RAISE EXCEPTION 'session cannot be canceled in its current status' USING ERRCODE = '22023'; END IF;

    UPDATE public.sessions
    SET lesson_status = 'canceled_without_refund'
    WHERE id = v_req.approved_session_id
      AND (lesson_status IN ('booked_unpaid', 'booked_paid_in_full') OR lesson_status IS NULL);

    UPDATE public.booking_requests
    SET
      status = 'canceled',
      decided_at = now(),
      decided_by = auth.uid(),
      decision_reason = p_decision_reason,
      updated_at = now()
    WHERE id = p_id
    RETURNING * INTO v_updated;

    RETURN v_updated;
  END IF;

  -- approve
  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'booking_request is not pending';
  END IF;

  v_label := coalesce(p_selected_time_label, '');
  v_label := regexp_replace(v_label, '[[:space:]]+', ' ', 'g');
  v_label := btrim(v_label);

  IF v_label = '' THEN
    RAISE EXCEPTION 'missing selected time';
  END IF;

  IF v_label ~ '^([0-9]{1,2}):([0-9]{2})(:([0-9]{2}))?$' THEN
    v_time := v_label::time;
  ELSE
    SELECT regexp_matches(v_label, '^([0-9]{1,2}):([0-9]{2})\s*(AM|PM)$', 'i') INTO v_m;
    IF v_m IS NULL OR array_length(v_m, 1) < 3 THEN
      RAISE EXCEPTION 'invalid time label: %', v_label;
    END IF;

    v_hour12 := v_m[1]::int;
    v_minute := v_m[2]::int;
    v_ampm := upper(v_m[3]);

    IF v_hour12 < 1 OR v_hour12 > 12 THEN
      RAISE EXCEPTION 'invalid time label: %', v_label;
    END IF;

    IF v_minute NOT IN (0, 30) THEN
      RAISE EXCEPTION 'invalid time label: %', v_label;
    END IF;

    v_hour24 := v_hour12 % 12;
    IF v_ampm = 'PM' THEN
      v_hour24 := v_hour24 + 12;
    END IF;

    v_time := make_time(v_hour24, v_minute, 0);
  END IF;

  IF v_time < time '07:00' OR v_time > time '15:30' OR extract(minute FROM v_time) NOT IN (0, 30) OR extract(second FROM v_time) <> 0 THEN
    RAISE EXCEPTION 'selected time must be within business hours';
  END IF;

  v_session_time := (v_req.requested_date + v_time);

  v_bill_total_cents := coalesce(v_req.bill_total_cents, 0);
  v_amount_paid_cents := coalesce(v_req.amount_paid_cents, 0);

  v_bill_total := v_bill_total_cents / 100.0;
  v_paid := v_amount_paid_cents / 100.0;

  IF v_req.bill_total_cents IS NOT NULL AND v_amount_paid_cents >= v_bill_total_cents THEN
    v_lesson_status := 'booked_paid_in_full';
  ELSE
    v_lesson_status := 'booked_unpaid';
  END IF;

  -- FIX: preserve original order (customer first), while deduping
  v_client_names := array(
    SELECT x
    FROM (
      SELECT x, min(ord) AS first_ord
      FROM unnest(
        array_prepend(v_req.customer_name, coalesce(v_req.party_names, ARRAY[]::text[]))
      ) WITH ORDINALITY t(x, ord)
      WHERE btrim(coalesce(x, '')) <> ''
      GROUP BY x
      ORDER BY min(ord)
    ) q
  );

  INSERT INTO public.sessions (client_names, group_size, session_time, lesson_status, paid, tip, bill_total, lesson_type_key)
  VALUES (v_client_names, v_req.party_size, v_session_time, v_lesson_status, v_paid, 0, v_bill_total, v_req.requested_lesson_type)
  RETURNING * INTO v_session;

  UPDATE public.booking_requests
  SET
    status = 'approved',
    decided_at = now(),
    decided_by = auth.uid(),
    decision_reason = p_decision_reason,
    approved_session_id = v_session.id,
    selected_time_slot = v_time,
    requested_time_slots = v_time,
    updated_at = now()
  WHERE id = p_id
  RETURNING * INTO v_updated;

  RETURN v_updated;
END;

$function$;
CREATE OR REPLACE FUNCTION public.admin_update_booking_request(p_id uuid, p_patch jsonb)
 RETURNS booking_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_req public.booking_requests;
  v_updated public.booking_requests;

  v_selected_time_slot time;
  v_has_selected_time_slot boolean;

  v_bill_total_cents int;
  v_amount_paid_cents int;
  v_paid numeric;
  v_bill_total numeric;
  v_target_status public.lesson_status;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT * INTO v_req
  FROM public.booking_requests
  WHERE id = p_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'booking_request not found';
  END IF;

  IF p_patch IS NULL THEN
    p_patch := '{}'::jsonb;
  END IF;

  -- selected_time_slot: expects "HH:MM:SS" or null
  v_has_selected_time_slot := (p_patch ? 'selected_time_slot');
  IF v_has_selected_time_slot THEN
    IF (p_patch->'selected_time_slot') IS NULL OR jsonb_typeof(p_patch->'selected_time_slot') = 'null' THEN
      v_selected_time_slot := NULL;
    ELSE
      v_selected_time_slot := (p_patch->>'selected_time_slot')::time;
    END IF;
  END IF;

  IF v_req.approved_session_id IS NOT NULL AND v_has_selected_time_slot AND v_selected_time_slot IS NULL THEN RAISE EXCEPTION 'approved requests require a selected time' USING ERRCODE = '22023'; END IF;
  IF p_patch ? 'party_size' AND ((p_patch->>'party_size')::numeric < 1 OR (p_patch->>'party_size')::numeric > 30 OR (p_patch->>'party_size')::numeric <> trunc((p_patch->>'party_size')::numeric)) THEN RAISE EXCEPTION 'invalid party size' USING ERRCODE = '22023'; END IF;
  IF v_has_selected_time_slot AND v_selected_time_slot IS NOT NULL AND (v_selected_time_slot < time '07:00' OR v_selected_time_slot > time '15:30' OR extract(minute FROM v_selected_time_slot) NOT IN (0, 30) OR extract(second FROM v_selected_time_slot) <> 0) THEN RAISE EXCEPTION 'invalid selected time' USING ERRCODE = '22023'; END IF;
  UPDATE public.booking_requests
  SET
    customer_name = CASE WHEN p_patch ? 'customer_name' THEN coalesce(nullif(trim(p_patch->>'customer_name'), ''), v_req.customer_name) ELSE v_req.customer_name END,
    customer_email = CASE WHEN p_patch ? 'customer_email' THEN coalesce(nullif(trim(p_patch->>'customer_email'), ''), v_req.customer_email) ELSE v_req.customer_email END,
    customer_phone = CASE WHEN p_patch ? 'customer_phone' THEN coalesce(nullif(trim(p_patch->>'customer_phone'), ''), v_req.customer_phone) ELSE v_req.customer_phone END,

    party_size = CASE WHEN p_patch ? 'party_size' THEN greatest(1, floor(coalesce((p_patch->>'party_size')::numeric, v_req.party_size::numeric))::int) ELSE v_req.party_size END,

    party_names = CASE
      WHEN p_patch ? 'party_names' THEN
        CASE
          WHEN (p_patch->'party_names') IS NULL OR jsonb_typeof(p_patch->'party_names') = 'null' THEN NULL
          WHEN jsonb_typeof(p_patch->'party_names') = 'array' THEN
            array(
              SELECT nullif(trim(x), '')
              FROM jsonb_array_elements_text(p_patch->'party_names') t(x)
              WHERE nullif(trim(x), '') IS NOT NULL
            )
          ELSE v_req.party_names
        END
      ELSE v_req.party_names
    END,

    requested_lesson_type = CASE WHEN p_patch ? 'requested_lesson_type' THEN coalesce(nullif(trim(p_patch->>'requested_lesson_type'), ''), v_req.requested_lesson_type) ELSE v_req.requested_lesson_type END,

    requested_date = CASE
      WHEN p_patch ? 'requested_date' THEN
        CASE
          WHEN nullif(trim(p_patch->>'requested_date'), '') IS NULL THEN v_req.requested_date
          ELSE (p_patch->>'requested_date')::date
        END
      ELSE v_req.requested_date
    END,

    requested_time_labels = CASE
      WHEN p_patch ? 'requested_time_labels' THEN
        CASE
          WHEN jsonb_typeof(p_patch->'requested_time_labels') = 'array' THEN
            array(
              SELECT nullif(trim(x), '')
              FROM jsonb_array_elements_text(p_patch->'requested_time_labels') t(x)
              WHERE nullif(trim(x), '') IS NOT NULL
            )
          ELSE v_req.requested_time_labels
        END
      ELSE v_req.requested_time_labels
    END,

    selected_time_slot = CASE WHEN v_has_selected_time_slot THEN v_selected_time_slot ELSE v_req.selected_time_slot END,

    notes = CASE
      WHEN p_patch ? 'notes' THEN
        CASE
          WHEN (p_patch->'notes') IS NULL OR jsonb_typeof(p_patch->'notes') = 'null' THEN NULL
          ELSE nullif(trim(p_patch->>'notes'), '')
        END
      ELSE v_req.notes
    END,

    amount_paid_cents = CASE
      WHEN p_patch ? 'amount_paid_cents' THEN
        greatest(0, floor(coalesce((p_patch->>'amount_paid_cents')::numeric, 0))::int)
      ELSE v_req.amount_paid_cents
    END,

    manual_pricing = CASE
      WHEN p_patch ? 'manual_pricing' THEN
        coalesce((p_patch->>'manual_pricing')::boolean, v_req.manual_pricing)
      ELSE v_req.manual_pricing
    END,

    manual_bill_total_cents = CASE
      WHEN p_patch ? 'manual_bill_total_cents' THEN
        CASE
          WHEN (p_patch->'manual_bill_total_cents') IS NULL OR jsonb_typeof(p_patch->'manual_bill_total_cents') = 'null' THEN NULL
          ELSE greatest(0, floor(coalesce((p_patch->>'manual_bill_total_cents')::numeric, 0))::int)
        END
      ELSE v_req.manual_bill_total_cents
    END,

    updated_at = now()
  WHERE id = p_id
  RETURNING * INTO v_updated;

  -- If manual_pricing was turned off in this update, force manual_bill_total_cents NULL.
  IF (p_patch ? 'manual_pricing') AND v_updated.manual_pricing = false THEN
    UPDATE public.booking_requests
    SET manual_bill_total_cents = NULL, updated_at = now()
    WHERE id = p_id
    RETURNING * INTO v_updated;
  END IF;

  -- Keep linked session billing/status in sync when the request is already approved.
  IF v_updated.approved_session_id IS NOT NULL THEN
    v_bill_total_cents := v_updated.bill_total_cents;
    v_amount_paid_cents := coalesce(v_updated.amount_paid_cents, 0);

    v_paid := v_amount_paid_cents / 100.0;
    v_bill_total := CASE WHEN v_bill_total_cents IS NULL THEN NULL ELSE v_bill_total_cents / 100.0 END;

    v_target_status := CASE
      WHEN v_bill_total_cents IS NOT NULL AND v_amount_paid_cents >= v_bill_total_cents THEN 'booked_paid_in_full'::public.lesson_status
      ELSE 'booked_unpaid'::public.lesson_status
    END;

    UPDATE public.sessions s
    SET
      paid = v_paid,
      bill_total = COALESCE(v_bill_total, s.bill_total),
      lesson_status = CASE
        WHEN s.lesson_status IN ('booked_unpaid', 'booked_paid_in_full') OR s.lesson_status IS NULL THEN v_target_status
        ELSE s.lesson_status
      END
    WHERE s.id = v_updated.approved_session_id;
  END IF;

  -- Return the freshest row.
  SELECT * INTO v_updated
  FROM public.booking_requests
  WHERE id = p_id;

  RETURN v_updated;
END;
$function$;
