-- Run on an authorized SQL connection. All fixtures are rolled back.
BEGIN;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
DO $$
DECLARE v_count integer; v_result jsonb; v_replay jsonb; v_id uuid; v_session uuid;
  v_lesson text; v_booking public.booking_requests; v_notification public.booking_notifications;
  v_claimed integer; v_payload jsonb; v_hash text := repeat('a', 64);
BEGIN
  SELECT key INTO v_lesson FROM public.lesson_types WHERE is_active LIMIT 1;
  IF v_lesson IS NULL THEN RAISE EXCEPTION 'Test requires an active lesson'; END IF;
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Service-role admin guard failed'; END IF;
  SELECT count(*) INTO v_count FROM public.admin_list_sessions(false);

  SELECT count(*) INTO v_count FROM public.media_slots WHERE left(slot_key, 15) = 'gallery.images.';
  BEGIN
    PERFORM public.admin_replace_gallery_images(ARRAY['00000000-0000-4000-8000-000000000001'::uuid]);
    RAISE EXCEPTION 'Invalid asset was accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  IF v_count <> (SELECT count(*) FROM public.media_slots WHERE left(slot_key, 15) = 'gallery.images.') THEN
    RAISE EXCEPTION 'Gallery failed rollback';
  END IF;
  BEGIN
    PERFORM public.admin_save_content_bundle('[{"key":"audit.rollback.probe","locale":"en","body":"must rollback"}]'::jsonb,
      '[{"prefix":"audit.media","slots":[{"slot_key":"audit.media.0","asset_id":"00000000-0000-4000-8000-000000000001","sort":0}]}]'::jsonb);
    RAISE EXCEPTION 'Invalid content media was accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;
  IF EXISTS(SELECT 1 FROM public.cms_page_content WHERE page_key = 'audit.rollback.probe') THEN
    RAISE EXCEPTION 'Content failed rollback';
  END IF;
  PERFORM public.admin_save_content_bundle('[{"key":"audit.empty.probe","locale":"en","body":""},{"key":"audit.empty.probe","locale":"es","body":""}]'::jsonb, '[]'::jsonb);
  IF (SELECT body_en FROM public.cms_page_content WHERE page_key = 'audit.empty.probe') IS DISTINCT FROM ''
     OR (SELECT approved FROM public.cms_page_content WHERE page_key = 'audit.empty.probe') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Empty text or Spanish draft semantics changed';
  END IF;
  PERFORM public.admin_publish_es('audit.empty.probe');
  IF (SELECT body FROM public.get_page_content('audit.empty.probe', 'es')) IS DISTINCT FROM '' THEN
    RAISE EXCEPTION 'Published empty Spanish was discarded';
  END IF;

  v_payload := jsonb_build_object('submission_id', gen_random_uuid(), 'customer_name', 'ROLLBACK AUDIT TEST',
    'customer_email', 'audit@example.com', 'customer_phone', '9395550100', 'party_size', 2, 'party_names', jsonb_build_array('Guest Two'),
    'requested_date', (now() AT TIME ZONE 'America/Puerto_Rico')::date + 2,
    'requested_time_labels', jsonb_build_array('7:00 AM'), 'requested_lesson_type', v_lesson, 'notes', '', 'locale', 'en');
  v_result := public.submit_booking_request(v_payload, v_hash, repeat('b', 64));
  v_replay := public.submit_booking_request(v_payload, v_hash, repeat('b', 64));
  IF v_result->>'id' IS DISTINCT FROM v_replay->>'id' OR v_replay->>'duplicate' <> 'true' THEN
    RAISE EXCEPTION 'Booking replay created duplicate';
  END IF;
  v_id := (v_result->>'id')::uuid;
  IF (SELECT count(*) FROM public.booking_notifications WHERE booking_id = v_id) <> 2 THEN RAISE EXCEPTION 'Outbox was not atomic'; END IF;
  BEGIN
    PERFORM public.submit_booking_request(v_payload, repeat('c', 64), repeat('b', 64));
    RAISE EXCEPTION 'Changed replay accepted';
  EXCEPTION WHEN SQLSTATE 'P0409' THEN NULL; END;
  SELECT count(*) INTO v_claimed FROM public.claim_booking_notifications(v_id, 2);
  IF v_claimed <> 2 THEN RAISE EXCEPTION 'Notification claim failed'; END IF;
  IF EXISTS(SELECT 1 FROM public.claim_booking_notifications(v_id, 2)) THEN RAISE EXCEPTION 'Lease was claimed twice'; END IF;
  SELECT * INTO v_notification FROM public.booking_notifications WHERE booking_id = v_id AND recipient_kind = 'admin';
  PERFORM public.complete_booking_notification(v_notification.id, v_notification.lease_token, NULL, 'Simulated provider failure');
  IF (SELECT status FROM public.booking_notifications WHERE id = v_notification.id) <> 'queued' THEN RAISE EXCEPTION 'Failure did not queue retry'; END IF;
  SELECT * INTO v_notification FROM public.booking_notifications WHERE booking_id = v_id AND recipient_kind = 'customer';
  PERFORM public.complete_booking_notification(v_notification.id, v_notification.lease_token, 'audit-provider-id', NULL);
  IF (SELECT payload FROM public.booking_notifications WHERE id = v_notification.id) <> '{}'::jsonb THEN RAISE EXCEPTION 'Sent payload retained personal data'; END IF;

  v_booking := public.admin_decide_booking_request(v_id, 'approve', '7:00 AM', 'Rollback audit');
  v_session := v_booking.approved_session_id;
  BEGIN
    PERFORM public.admin_decide_booking_request(v_id, 'approve', '7:00 AM', NULL);
    RAISE EXCEPTION 'Repeated approval accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'Repeated approval accepted' THEN RAISE; END IF;
  END;
  v_booking := public.admin_update_booking_request(v_id, jsonb_build_object('party_size', 3, 'customer_name', 'UPDATED ROLLBACK TEST', 'selected_time_slot', '08:30:00'));
  IF (SELECT group_size FROM public.sessions WHERE id = v_session) <> 3
    OR (SELECT session_time::time FROM public.sessions WHERE id = v_session) <> time '08:30'
    OR (SELECT client_names[1] FROM public.sessions WHERE id = v_session) <> 'UPDATED ROLLBACK TEST' THEN
    RAISE EXCEPTION 'Session did not follow booking edit';
  END IF;
  v_booking := public.admin_apply_booking_request_payment(v_id, 100);
  IF (SELECT paid FROM public.sessions WHERE id = v_session) <> 1 THEN RAISE EXCEPTION 'Payment did not sync'; END IF;
  v_booking := public.admin_decide_booking_request(v_id, 'cancel', NULL, 'Rollback audit');
  IF v_booking.status <> 'canceled' OR (SELECT lesson_status FROM public.sessions WHERE id = v_session) <> 'canceled_without_refund' THEN
    RAISE EXCEPTION 'Cancel transition inconsistent';
  END IF;
  IF public.verify_booking_worker_secret(repeat('0', 64)) THEN RAISE EXCEPTION 'Invalid worker secret accepted'; END IF;
  IF has_function_privilege('anon', 'public.submit_booking_request(jsonb,text,text)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.admin_list_sessions(boolean)', 'EXECUTE')
    OR has_table_privilege('anon', 'public.booking_notifications', 'SELECT') THEN RAISE EXCEPTION 'Private RPC or outbox exposed'; END IF;
  IF EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='admin_users_id_key')
    OR EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='media_assets_session_idx')
    OR NOT EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='business_expenses_parent_expense_id_idx') THEN
    RAISE EXCEPTION 'Index advisory regression';
  END IF;
  IF regexp_replace((SELECT qual FROM pg_policies WHERE schemaname='public' AND tablename='media_assets' AND policyname='Allow public read on media_assets'), '[()]', '', 'g') <> 'public = true'
    OR EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='admin_users' AND policyname='admins can read admin_users') THEN
    RAISE EXCEPTION 'Public media or duplicate admin policy regression';
  END IF;
END;
$$;
ROLLBACK;
SELECT 'All database rollback regression checks passed' AS result;
