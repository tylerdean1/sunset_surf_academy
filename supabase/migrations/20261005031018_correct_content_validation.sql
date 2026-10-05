-- Validate PostgreSQL regex lengths separately and accept displayed time labels.
CREATE OR REPLACE FUNCTION public.admin_save_content_bundle(p_strings jsonb, p_media jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    IF v_key IS NULL OR length(v_key) NOT BETWEEN 1 AND 256 OR v_key !~ '^[a-zA-Z0-9._-]+$' OR v_locale IS NULL OR v_locale NOT IN ('en', 'es')
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
$function$;

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
    SELECT regexp_matches(v_label, '^([0-9]{1,2}):([0-9]{2})[[:space:]]*(AM|PM)$', 'i') INTO v_m;
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
