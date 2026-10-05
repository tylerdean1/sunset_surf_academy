-- Service-only submission and notification outbox. No customer data is exposed through these RPCs.
ALTER TABLE public.booking_requests ADD COLUMN submission_id uuid UNIQUE;
ALTER TABLE public.booking_requests ADD COLUMN submission_hash text;
CREATE TABLE public.booking_request_rate_limits (
  key text PRIMARY KEY, window_start timestamptz NOT NULL, requests integer NOT NULL CHECK (requests >= 0)
);
ALTER TABLE public.booking_request_rate_limits ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.booking_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.booking_requests(id) ON DELETE CASCADE,
  recipient_kind text NOT NULL CHECK (recipient_kind IN ('admin', 'customer')),
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'sent', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_token uuid, lease_expires_at timestamptz,
  provider_message_id text, last_error text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(booking_id, recipient_kind)
);
ALTER TABLE public.booking_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.booking_notifications, public.booking_request_rate_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.booking_notifications TO service_role;
CREATE INDEX booking_notifications_due_idx ON public.booking_notifications(next_attempt_at)
  WHERE status IN ('queued', 'processing');

CREATE OR REPLACE FUNCTION public.submit_booking_request(p_payload jsonb, p_payload_hash text, p_rate_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_existing public.booking_requests; v_row public.booking_requests; v_lesson public.lesson_types;
  v_id uuid; v_date date; v_today date := (now() AT TIME ZONE 'America/Puerto_Rico')::date;
  v_party integer; v_times text[]; v_names text[]; v_key text; v_count integer; v_payload jsonb;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501'; END IF;
  IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR octet_length(p_payload::text) > 16384
    OR p_payload_hash IS NULL OR p_rate_key IS NULL
    OR p_payload_hash !~ '^[a-f0-9]{64}$' OR p_rate_key !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'invalid request' USING ERRCODE = '22023';
  END IF;
  v_id := (p_payload->>'submission_id')::uuid;
  IF v_id IS NULL THEN RAISE EXCEPTION 'missing submission id' USING ERRCODE = '22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_id::text, 0));
  SELECT * INTO v_existing FROM public.booking_requests WHERE submission_id = v_id;
  IF FOUND THEN
    IF v_existing.submission_hash IS DISTINCT FROM p_payload_hash THEN
      RAISE EXCEPTION 'submission already used' USING ERRCODE = 'P0409';
    END IF;
    RETURN jsonb_build_object('id', v_existing.id, 'duplicate', true);
  END IF;
  v_date := (p_payload->>'requested_date')::date;
  v_party := (p_payload->>'party_size')::integer;
  IF v_date IS NULL OR v_date < v_today OR v_date > v_today + 365 OR v_party IS NULL OR v_party NOT BETWEEN 1 AND 30
    OR length(btrim(coalesce(p_payload->>'customer_name', ''))) NOT BETWEEN 1 AND 160
    OR length(btrim(coalesce(p_payload->>'customer_email', ''))) NOT BETWEEN 3 AND 254
    OR (p_payload->>'customer_email') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    OR length(btrim(coalesce(p_payload->>'customer_phone', ''))) NOT BETWEEN 7 AND 40
    OR length(coalesce(p_payload->>'notes', '')) > 2000
    OR jsonb_typeof(p_payload->'requested_time_labels') IS DISTINCT FROM 'array'
    OR jsonb_typeof(p_payload->'party_names') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'invalid booking details' USING ERRCODE = '22023';
  END IF;
  SELECT array_agg(value) INTO v_times FROM jsonb_array_elements_text(p_payload->'requested_time_labels');
  SELECT array_agg(value) INTO v_names FROM jsonb_array_elements_text(p_payload->'party_names');
  IF coalesce(cardinality(v_times), 0) NOT BETWEEN 1 AND 18 OR coalesce(cardinality(v_names), 0) > v_party - 1
    OR EXISTS (SELECT 1 FROM unnest(v_names) n WHERE length(n) > 160)
    OR EXISTS (SELECT 1 FROM unnest(v_times) t WHERE t NOT IN (
      '7:00 AM','7:30 AM','8:00 AM','8:30 AM','9:00 AM','9:30 AM','10:00 AM','10:30 AM',
      '11:00 AM','11:30 AM','12:00 PM','12:30 PM','1:00 PM','1:30 PM','2:00 PM','2:30 PM','3:00 PM','3:30 PM')) THEN
    RAISE EXCEPTION 'invalid times or names' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_lesson FROM public.lesson_types WHERE key = p_payload->>'requested_lesson_type' AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid lesson type' USING ERRCODE = '22023'; END IF;
  -- Lock rate keys in stable order. Replayed submissions do not consume a new allowance.
  FOR v_key IN SELECT k FROM unnest(ARRAY['ip:' || p_rate_key, 'email:' || md5(lower(p_payload->>'customer_email'))]) k ORDER BY k LOOP
    INSERT INTO public.booking_request_rate_limits(key, window_start, requests) VALUES(v_key, now(), 0)
      ON CONFLICT (key) DO NOTHING;
    UPDATE public.booking_request_rate_limits SET
      requests = CASE WHEN window_start < now() - interval '1 hour' THEN 1 ELSE requests + 1 END,
      window_start = CASE WHEN window_start < now() - interval '1 hour' THEN now() ELSE window_start END
    WHERE key = v_key RETURNING requests INTO v_count;
    IF v_count > (CASE WHEN left(v_key, 3) = 'ip:' THEN 10 ELSE 5 END) THEN
      RAISE EXCEPTION 'too many requests' USING ERRCODE = 'P0429';
    END IF;
  END LOOP;
  INSERT INTO public.booking_requests(customer_name, customer_email, customer_phone, party_size, party_names,
    requested_lesson_type, requested_date, requested_time_labels, notes, submission_id, submission_hash)
  VALUES(p_payload->>'customer_name', p_payload->>'customer_email', p_payload->>'customer_phone', v_party, v_names,
    v_lesson.key, v_date, v_times, nullif(p_payload->>'notes', ''), v_id, p_payload_hash) RETURNING * INTO v_row;
  v_payload := jsonb_build_object('id', v_row.id, 'customerName', v_row.customer_name,
    'customerEmail', v_row.customer_email, 'customerPhone', v_row.customer_phone,
    'lessonName', v_lesson.display_name, 'date', v_row.requested_date, 'timeLabels', v_times,
    'partySize', v_party, 'partyNames', coalesce(v_names, ARRAY[]::text[]), 'notes', coalesce(v_row.notes, ''),
    'locale', CASE WHEN p_payload->>'locale' = 'es' THEN 'es' ELSE 'en' END);
  INSERT INTO public.booking_notifications(booking_id, recipient_kind, payload)
    VALUES(v_row.id, 'admin', v_payload), (v_row.id, 'customer', v_payload);
  RETURN jsonb_build_object('id', v_row.id, 'duplicate', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_booking_notifications(p_booking_id uuid DEFAULT NULL, p_limit integer DEFAULT 20)
RETURNS SETOF public.booking_notifications LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501'; END IF;
  -- Resend deduplicates for 24 hours. Stop automatic sends before that window expires.
  UPDATE public.booking_notifications SET status = 'failed', last_error = 'Automatic retry window expired',
    lease_token = NULL, lease_expires_at = NULL, updated_at = now()
  WHERE status IN ('queued', 'processing') AND (created_at < now() - interval '22 hours' OR attempts >= 8)
    AND (lease_expires_at IS NULL OR lease_expires_at < now());
  RETURN QUERY WITH due AS (
    SELECT id FROM public.booking_notifications
    WHERE (p_booking_id IS NULL OR booking_id = p_booking_id)
      AND ((status = 'queued' AND next_attempt_at <= now()) OR (status = 'processing' AND lease_expires_at < now()))
      AND attempts < 8 AND created_at > now() - interval '22 hours'
    ORDER BY next_attempt_at, id FOR UPDATE SKIP LOCKED LIMIT greatest(1, least(20, p_limit))
  ) UPDATE public.booking_notifications n SET status = 'processing', attempts = attempts + 1,
      lease_token = gen_random_uuid(), lease_expires_at = now() + interval '2 minutes', updated_at = now()
    FROM due WHERE n.id = due.id RETURNING n.*;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_booking_notification(p_id uuid, p_lease_token uuid, p_provider_id text DEFAULT NULL, p_error text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501'; END IF;
  UPDATE public.booking_notifications SET
    status = CASE WHEN p_provider_id IS NOT NULL THEN 'sent' WHEN attempts >= 8 THEN 'failed' ELSE 'queued' END,
    provider_message_id = p_provider_id, last_error = CASE WHEN p_provider_id IS NULL THEN left(p_error, 200) ELSE NULL END,
    payload = CASE WHEN p_provider_id IS NOT NULL THEN '{}'::jsonb ELSE payload END,
    next_attempt_at = now() + make_interval(secs := least(3600, 60 * (2 ^ least(attempts, 6))::integer)),
    lease_token = NULL, lease_expires_at = NULL, updated_at = now()
  WHERE id = p_id AND status = 'processing' AND lease_token = p_lease_token;
  IF NOT FOUND THEN RAISE EXCEPTION 'notification lease expired' USING ERRCODE = '22023'; END IF;
END;
$$;

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'booking_email_worker_secret') THEN
    PERFORM vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'booking_email_worker_secret');
  END IF;
END; $$;
CREATE OR REPLACE FUNCTION public.verify_booking_worker_secret(p_token text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501'; END IF;
  RETURN EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'booking_email_worker_secret'
    AND extensions.digest(decrypted_secret, 'sha256') = extensions.digest(p_token, 'sha256'));
END;
$$;
CREATE OR REPLACE FUNCTION public.configure_booking_email_worker(p_url text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_secret_id uuid;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501'; END IF;
  IF p_url !~ '^https://[a-zA-Z0-9.-]+/api/internal/booking-notifications$' THEN
    RAISE EXCEPTION 'invalid worker URL' USING ERRCODE = '22023';
  END IF;
  SELECT id INTO v_secret_id FROM vault.secrets WHERE name = 'booking_email_worker_url';
  IF v_secret_id IS NULL THEN PERFORM vault.create_secret(p_url, 'booking_email_worker_url');
  ELSE PERFORM vault.update_secret(v_secret_id, p_url); END IF;
  PERFORM cron.schedule('booking-email-retry', '*/5 * * * *', $job$
    SELECT net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'booking_email_worker_url'),
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization',
        'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'booking_email_worker_secret')),
      body := '{}'::jsonb, timeout_milliseconds := 30000
    ) WHERE EXISTS (SELECT 1 FROM public.booking_notifications WHERE status IN ('queued', 'processing'));
  $job$);
  PERFORM cron.schedule('booking-rate-limit-cleanup', '17 4 * * *', $job$
    DELETE FROM public.booking_request_rate_limits WHERE window_start < now() - interval '2 days';
  $job$);
END;
$$;
REVOKE ALL ON FUNCTION public.submit_booking_request(jsonb,text,text), public.claim_booking_notifications(uuid,integer),
  public.complete_booking_notification(uuid,uuid,text,text), public.verify_booking_worker_secret(text),
  public.configure_booking_email_worker(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_booking_request(jsonb,text,text), public.claim_booking_notifications(uuid,integer),
  public.complete_booking_notification(uuid,uuid,text,text), public.verify_booking_worker_secret(text),
  public.configure_booking_email_worker(text) TO service_role;
