--
-- PostgreSQL database dump
--

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.5

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: Days_of_the_week; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Days_of_the_week" AS ENUM (
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday'
);


--
-- Name: TYPE "Days_of_the_week"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TYPE public."Days_of_the_week" IS 'days of the week';


--
-- Name: asset_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.asset_type AS ENUM (
    'video',
    'photo'
);


--
-- Name: TYPE asset_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TYPE public.asset_type IS 'video or picture';


--
-- Name: booking_request_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.booking_request_status AS ENUM (
    'pending',
    'approved',
    'denied',
    'canceled'
);


--
-- Name: finance_category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.finance_category AS ENUM (
    'fuel',
    'equipment',
    'advertising',
    'lessons',
    'food',
    'software',
    'payroll',
    'other'
);


--
-- Name: lesson_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.lesson_status AS ENUM (
    'booked_unpaid',
    'completed',
    'canceled_with_refund',
    'canceled_without_refund',
    'booked_paid_in_full'
);


--
-- Name: TYPE lesson_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TYPE public.lesson_status IS 'the status of the lesson';


--
-- Name: payment_method; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payment_method AS ENUM (
    'cash',
    'card',
    'ach',
    'check',
    'stripe',
    'other'
);


--
-- Name: photo_category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.photo_category AS ENUM (
    'logo',
    'hero',
    'lessons',
    'web_content',
    'uncategorized'
);


--
-- Name: TYPE photo_category; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TYPE public.photo_category IS 'what category is this photo ';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: booking_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    status public.booking_request_status DEFAULT 'pending'::public.booking_request_status NOT NULL,
    customer_name text NOT NULL,
    customer_email text NOT NULL,
    customer_phone text NOT NULL,
    party_size integer NOT NULL,
    requested_lesson_type text NOT NULL,
    requested_date date NOT NULL,
    requested_time_labels text[] DEFAULT '{}'::text[] NOT NULL,
    notes text,
    decided_at timestamp with time zone,
    decided_by uuid,
    decision_reason text,
    approved_session_id uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    party_names text[],
    bill_total_cents integer,
    amount_paid_cents integer DEFAULT 0 NOT NULL,
    balance_cents integer GENERATED ALWAYS AS (
CASE
    WHEN (bill_total_cents IS NULL) THEN NULL::integer
    ELSE (bill_total_cents - amount_paid_cents)
END) STORED,
    requested_time_slots time without time zone,
    selected_time_slot time without time zone,
    manual_pricing boolean DEFAULT false NOT NULL,
    manual_bill_total_cents bigint,
    submission_id uuid,
    submission_hash text,
    CONSTRAINT booking_requests_amount_paid_nonnegative CHECK ((amount_paid_cents >= 0)),
    CONSTRAINT booking_requests_bill_total_nonnegative CHECK (((bill_total_cents IS NULL) OR (bill_total_cents >= 0))),
    CONSTRAINT booking_requests_manual_bill_total_cents_check CHECK (((manual_bill_total_cents IS NULL) OR (manual_bill_total_cents >= 0))),
    CONSTRAINT booking_requests_manual_total_required CHECK (((manual_pricing = false) OR (manual_bill_total_cents IS NOT NULL))),
    CONSTRAINT booking_requests_paid_lte_bill CHECK (((bill_total_cents IS NULL) OR (amount_paid_cents <= bill_total_cents))),
    CONSTRAINT booking_requests_party_size_check CHECK ((party_size > 0))
);


--
-- Name: COLUMN booking_requests.customer_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_requests.customer_name IS 'primary customer name';


--
-- Name: COLUMN booking_requests.party_names; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_requests.party_names IS 'secondary members of the party (don''t include primary)';


--
-- Name: admin_apply_booking_request_payment(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_apply_booking_request_payment(p_id uuid, p_delta_cents integer) RETURNS public.booking_requests
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: admin_clear_media_asset_slots(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_clear_media_asset_slots(p_asset_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF p_asset_id IS NULL THEN
    RAISE EXCEPTION 'missing asset_id';
  END IF;

  DELETE FROM public.media_slots WHERE asset_id = p_asset_id;
END;
$$;


--
-- Name: business_expenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.business_expenses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    expense_date date NOT NULL,
    vendor_name text,
    description text,
    category public.finance_category NOT NULL,
    payment_method public.payment_method,
    subtotal_cents integer,
    tax_cents integer,
    tip_cents integer,
    total_cents integer NOT NULL,
    transaction_id text,
    is_refund boolean DEFAULT false NOT NULL,
    parent_expense_id uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT business_expenses_money_nonnegative CHECK (((total_cents >= 0) AND ((subtotal_cents IS NULL) OR (subtotal_cents >= 0)) AND ((tax_cents IS NULL) OR (tax_cents >= 0)) AND ((tip_cents IS NULL) OR (tip_cents >= 0)))),
    CONSTRAINT business_expenses_refund_parent_check CHECK ((((is_refund = false) AND (parent_expense_id IS NULL)) OR ((is_refund = true) AND (parent_expense_id IS NOT NULL))))
);


--
-- Name: admin_create_business_expense(date, public.finance_category, integer, text, text, public.payment_method, integer, integer, integer, text, boolean, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_create_business_expense(p_expense_date date, p_category public.finance_category, p_total_cents integer, p_vendor_name text DEFAULT NULL::text, p_description text DEFAULT NULL::text, p_payment_method public.payment_method DEFAULT NULL::public.payment_method, p_subtotal_cents integer DEFAULT NULL::integer, p_tax_cents integer DEFAULT NULL::integer, p_tip_cents integer DEFAULT NULL::integer, p_transaction_id text DEFAULT NULL::text, p_is_refund boolean DEFAULT false, p_parent_expense_id uuid DEFAULT NULL::uuid, p_notes text DEFAULT NULL::text) RETURNS public.business_expenses
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$

declare
  v_row public.business_expenses;
  v_txn_id text;
  v_is_refund boolean;
  v_session_status public.lesson_status;

begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  v_is_refund := coalesce(p_is_refund, false);
  v_txn_id := coalesce(nullif(btrim(coalesce(p_transaction_id, '')), ''), gen_random_uuid()::text);

  if p_total_cents is null or p_total_cents < 0 then
    raise exception 'total_cents must be >= 0';
  end if;

  if v_is_refund and p_parent_expense_id is null then
    raise exception 'refund expenses require parent_expense_id';
  end if;

  if not v_is_refund and p_parent_expense_id is not null then
    raise exception 'non-refund expenses cannot have parent_expense_id';
  end if;

  if v_is_refund and p_parent_expense_id is not null then
    select s.lesson_status
      into v_session_status
      from public.sessions s
      where s.id = p_parent_expense_id;

    if not found then
      raise exception 'parent_expense_id must reference an existing session';
    end if;

    if v_session_status is distinct from 'canceled_with_refund'::public.lesson_status
       and v_session_status is distinct from 'booked_paid_in_full'::public.lesson_status then
      raise exception 'parent_expense_id session must be canceled_with_refund or booked_paid_in_full';
    end if;
  end if;

  insert into public.business_expenses (
    expense_date,
    category,
    total_cents,
    vendor_name,
    description,
    payment_method,
    subtotal_cents,
    tax_cents,
    tip_cents,
    transaction_id,
    is_refund,
    parent_expense_id,
    notes
  ) values (
    p_expense_date,
    p_category,
    p_total_cents,
    p_vendor_name,
    p_description,
    p_payment_method,
    p_subtotal_cents,
    p_tax_cents,
    p_tip_cents,
    v_txn_id,
    v_is_refund,
    p_parent_expense_id,
    p_notes
  )
  returning * into v_row;

  return v_row;
end;

$$;


--
-- Name: receipts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.receipts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid,
    expense_id uuid,
    receipt_date date NOT NULL,
    vendor_name text,
    description text,
    category public.finance_category NOT NULL,
    payment_method public.payment_method,
    subtotal_cents integer,
    tax_cents integer,
    tip_cents integer,
    total_cents integer NOT NULL,
    transaction_id text,
    is_refund boolean DEFAULT false NOT NULL,
    parent_receipt_id uuid,
    receipt_storage_path text NOT NULL,
    source_type text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT receipts_exactly_one_parent CHECK (((((session_id IS NOT NULL))::integer + ((expense_id IS NOT NULL))::integer) = 1)),
    CONSTRAINT receipts_money_nonnegative CHECK (((total_cents >= 0) AND ((subtotal_cents IS NULL) OR (subtotal_cents >= 0)) AND ((tax_cents IS NULL) OR (tax_cents >= 0)) AND ((tip_cents IS NULL) OR (tip_cents >= 0)))),
    CONSTRAINT receipts_refund_parent_check CHECK ((((is_refund = false) AND (parent_receipt_id IS NULL)) OR ((is_refund = true) AND (parent_receipt_id IS NOT NULL))))
);


--
-- Name: admin_create_expense_receipt(uuid, date, public.finance_category, integer, text, text, text, public.payment_method, integer, integer, integer, text, boolean, uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_create_expense_receipt(p_expense_id uuid, p_receipt_date date, p_category public.finance_category, p_total_cents integer, p_receipt_storage_path text, p_vendor_name text DEFAULT NULL::text, p_description text DEFAULT NULL::text, p_payment_method public.payment_method DEFAULT NULL::public.payment_method, p_subtotal_cents integer DEFAULT NULL::integer, p_tax_cents integer DEFAULT NULL::integer, p_tip_cents integer DEFAULT NULL::integer, p_transaction_id text DEFAULT NULL::text, p_is_refund boolean DEFAULT false, p_parent_receipt_id uuid DEFAULT NULL::uuid, p_source_type text DEFAULT NULL::text, p_notes text DEFAULT NULL::text) RETURNS public.receipts
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  r public.receipts;
  v_is_refund boolean;
  v_storage_path text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  v_is_refund := COALESCE(p_is_refund, false);
  v_storage_path := NULLIF(BTRIM(COALESCE(p_receipt_storage_path, '')), '');

  IF p_total_cents IS NULL OR p_total_cents < 0 THEN
    RAISE EXCEPTION 'total_cents must be >= 0';
  END IF;

  IF v_storage_path IS NULL THEN
    RAISE EXCEPTION 'receipt_storage_path is required';
  END IF;

  IF v_is_refund AND p_parent_receipt_id IS NULL THEN
    RAISE EXCEPTION 'refund receipts require parent_receipt_id';
  END IF;

  IF NOT v_is_refund AND p_parent_receipt_id IS NOT NULL THEN
    RAISE EXCEPTION 'non-refund receipts cannot have parent_receipt_id';
  END IF;

  INSERT INTO public.receipts (
    session_id,
    expense_id,
    receipt_date,
    vendor_name,
    description,
    category,
    payment_method,
    subtotal_cents,
    tax_cents,
    tip_cents,
    total_cents,
    transaction_id,
    is_refund,
    parent_receipt_id,
    receipt_storage_path,
    source_type,
    notes
  ) VALUES (
    NULL,
    p_expense_id,
    p_receipt_date,
    NULLIF(BTRIM(COALESCE(p_vendor_name, '')), ''),
    NULLIF(BTRIM(COALESCE(p_description, '')), ''),
    p_category,
    p_payment_method,
    p_subtotal_cents,
    p_tax_cents,
    p_tip_cents,
    p_total_cents,
    NULLIF(BTRIM(COALESCE(p_transaction_id, '')), ''),
    v_is_refund,
    p_parent_receipt_id,
    v_storage_path,
    NULLIF(BTRIM(COALESCE(p_source_type, '')), ''),
    NULLIF(BTRIM(COALESCE(p_notes, '')), '')
  )
  RETURNING * INTO r;

  RETURN r;
END;
$$;


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    session_time timestamp without time zone,
    group_size smallint,
    client_names text[],
    lesson_status public.lesson_status DEFAULT 'booked_unpaid'::public.lesson_status,
    paid numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    tip numeric(10,2) DEFAULT '0'::numeric,
    deleted_at timestamp with time zone,
    notes text,
    bill_total numeric DEFAULT '100'::numeric NOT NULL,
    lesson_type_key text,
    CONSTRAINT sessions_paid_nonnegative CHECK ((paid >= (0)::numeric)),
    CONSTRAINT sessions_tip_nonnegative CHECK (((tip IS NULL) OR (tip >= (0)::numeric)))
);


--
-- Name: TABLE sessions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.sessions IS 'surf session slot';


--
-- Name: COLUMN sessions.lesson_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sessions.lesson_status IS 'what is the status of this lesson';


--
-- Name: COLUMN sessions.paid; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sessions.paid IS 'how much was the base pay';


--
-- Name: COLUMN sessions.tip; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sessions.tip IS 'what was the tip amount if any';


--
-- Name: COLUMN sessions.notes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sessions.notes IS 'anything weird happen';


--
-- Name: COLUMN sessions.bill_total; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.sessions.bill_total IS 'how much does the total lesson cost';


--
-- Name: admin_create_session(timestamp with time zone, integer, text[], public.lesson_status, numeric, numeric, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_create_session(p_session_time timestamp with time zone DEFAULT NULL::timestamp with time zone, p_group_size integer DEFAULT NULL::integer, p_client_names text[] DEFAULT NULL::text[], p_lesson_status public.lesson_status DEFAULT 'booked_unpaid'::public.lesson_status, p_paid numeric DEFAULT 0, p_tip numeric DEFAULT NULL::numeric, p_lesson_type_key text DEFAULT NULL::text) RETURNS public.sessions
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  r public.sessions;
  v_key text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  v_key := nullif(trim(coalesce(p_lesson_type_key, '')), '');
  IF v_key IS NOT NULL THEN
    PERFORM 1 FROM public.lesson_types lt WHERE lt.key = v_key;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'lesson type not found: %', v_key;
    END IF;
  END IF;

  INSERT INTO public.sessions (session_time, group_size, client_names, lesson_status, paid, tip, lesson_type_key)
  VALUES (p_session_time, p_group_size, p_client_names, p_lesson_status, p_paid, p_tip, v_key)
  RETURNING * INTO r;

  RETURN r;
END;
$$;


--
-- Name: admin_decide_booking_request(uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_decide_booking_request(p_id uuid, p_action text, p_selected_time_label text DEFAULT NULL::text, p_decision_reason text DEFAULT NULL::text) RETURNS public.booking_requests
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$

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

$_$;


--
-- Name: admin_delete_business_expense(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_delete_business_expense(p_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  DELETE FROM public.business_expenses WHERE id = p_id;
END;
$$;


--
-- Name: admin_delete_page_content(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_delete_page_content(p_page_key text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  delete from public.cms_page_content
  where page_key = p_page_key;
end;
$$;


--
-- Name: admin_delete_receipt(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_delete_receipt(p_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  DELETE FROM public.receipts WHERE id = p_id;
END;
$$;


--
-- Name: admin_delete_session(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_delete_session(p_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  update public.sessions
  set deleted_at = now()
  where id = p_id;

  if not found then
    raise exception 'session not found';
  end if;
end;
$$;


--
-- Name: admin_get_cms_page_row(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_get_cms_page_row(p_page_key text) RETURNS TABLE(id uuid, page_key text, category text, sort smallint, body_en text, body_es_draft text, body_es_published text, approved boolean, updated_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
    SELECT
      c.id,
      c.page_key,
      c.category,
      c.sort,
      c.body_en,
      c.body_es_draft,
      c.body_es_published,
      c.approved,
      c.updated_at
    FROM public.cms_page_content c
    WHERE c.page_key = trim(coalesce(p_page_key, ''))
    LIMIT 1;
END;
$$;


--
-- Name: admin_hard_delete_session(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_hard_delete_session(p_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  delete from public.sessions where id = p_id;

  if not found then
    raise exception 'session not found';
  end if;
end;
$$;


--
-- Name: admin_list_booking_requests(boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_list_booking_requests(p_show_all boolean DEFAULT false) RETURNS SETOF public.booking_requests
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
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


--
-- Name: admin_list_business_expenses_range(date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_list_business_expenses_range(p_start date, p_end date) RETURNS SETOF public.business_expenses
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
    SELECT *
    FROM public.business_expenses
    WHERE expense_date >= p_start
      AND expense_date < p_end
    ORDER BY expense_date ASC, created_at ASC;
END;
$$;


--
-- Name: admin_list_cms_page_content(text, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_list_cms_page_content(p_category text, p_page_key_like text DEFAULT NULL::text, p_limit integer DEFAULT 500) RETURNS TABLE(id uuid, page_key text, category text, sort smallint, body_en text, body_es_draft text, body_es_published text, approved boolean, updated_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  v_limit int;
  v_like text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF coalesce(trim(p_category), '') = '' THEN
    RAISE EXCEPTION 'missing category';
  END IF;

  v_limit := coalesce(p_limit, 500);
  IF v_limit < 1 THEN
    RAISE EXCEPTION 'limit must be >= 1';
  END IF;
  IF v_limit > 2000 THEN
    RAISE EXCEPTION 'limit too large';
  END IF;

  v_like := NULLIF(trim(coalesce(p_page_key_like, '')), '');
  IF v_like IS NOT NULL THEN
    IF length(v_like) > 256 THEN
      RAISE EXCEPTION 'page_key_like too long';
    END IF;
    IF v_like !~ '^[a-z0-9._%:-]+$' THEN
      RAISE EXCEPTION 'invalid page_key_like';
    END IF;
  END IF;

  RETURN QUERY
    SELECT
      c.id,
      c.page_key,
      c.category,
      c.sort,
      c.body_en,
      c.body_es_draft,
      c.body_es_published,
      c.approved,
      c.updated_at
    FROM public.cms_page_content c
    WHERE c.category = trim(p_category)
      AND (v_like IS NULL OR c.page_key LIKE v_like)
    ORDER BY c.sort ASC, c.page_key ASC
    LIMIT v_limit;
END;
$_$;


--
-- Name: lesson_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lesson_types (
    key text NOT NULL,
    display_name text NOT NULL,
    description text,
    price_per_person_cents bigint NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 32767 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT lesson_types_price_per_person_cents_check CHECK ((price_per_person_cents >= 0))
);


--
-- Name: admin_list_lesson_types(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_list_lesson_types() RETURNS SETOF public.lesson_types
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
    SELECT *
    FROM public.lesson_types
    ORDER BY sort_order ASC, key ASC;
END;
$$;


--
-- Name: media_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.media_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    public boolean NOT NULL,
    bucket text NOT NULL,
    path text NOT NULL,
    session_id uuid,
    asset_type public.asset_type DEFAULT 'photo'::public.asset_type NOT NULL,
    sort smallint DEFAULT 32767 NOT NULL,
    category public.photo_category DEFAULT 'uncategorized'::public.photo_category NOT NULL,
    CONSTRAINT media_assets_bucket_not_empty CHECK ((length(TRIM(BOTH FROM bucket)) > 0)),
    CONSTRAINT media_assets_path_not_empty CHECK ((length(TRIM(BOTH FROM path)) > 0)),
    CONSTRAINT media_assets_sort_check CHECK (((sort >= '-32768'::integer) AND (sort <= 32767))),
    CONSTRAINT media_assets_title_not_empty CHECK ((length(TRIM(BOTH FROM title)) > 0))
);


--
-- Name: TABLE media_assets; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.media_assets IS 'where photos are stored';


--
-- Name: COLUMN media_assets.public; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.media_assets.public IS 'Boolean is public or not';


--
-- Name: COLUMN media_assets.bucket; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.media_assets.bucket IS 'site_photos vs. galleries';


--
-- Name: COLUMN media_assets.path; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.media_assets.path IS 'where the photos are stored';


--
-- Name: COLUMN media_assets.session_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.media_assets.session_id IS 'what lesson is it from';


--
-- Name: COLUMN media_assets.asset_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.media_assets.asset_type IS 'video or picture';


--
-- Name: COLUMN media_assets.sort; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.media_assets.sort IS 'method to sort best first. -1 is pin to top';


--
-- Name: COLUMN media_assets.category; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.media_assets.category IS 'What category does this fall under (logo, lessons, web content ect.)';


--
-- Name: admin_list_media_assets(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_list_media_assets() RETURNS SETOF public.media_assets
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  return query
  select *
  from public.media_assets
  order by public desc, category asc, sort asc, created_at desc;
end;
$$;


--
-- Name: admin_list_media_assets_with_key(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_list_media_assets_with_key() RETURNS TABLE(id uuid, asset_key text, title text, description text, public boolean, bucket text, path text, category public.photo_category, asset_type public.asset_type, sort smallint, session_id uuid, created_at timestamp with time zone, updated_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
    SELECT
      a.id,
      (
        SELECT min(ms.slot_key)
        FROM public.media_slots ms
        WHERE ms.asset_id = a.id
      ) AS asset_key,
      a.title,
      a.description,
      a.public,
      a.bucket,
      a.path,
      a.category,
      a.asset_type,
      a.sort,
      a.session_id,
      a.created_at,
      a.updated_at
    FROM public.media_assets a
    ORDER BY a.public DESC, a.category ASC, a.sort ASC, a.created_at DESC;
END;
$$;


--
-- Name: admin_list_media_slots_by_prefix(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_list_media_slots_by_prefix(p_prefix text) RETURNS TABLE(slot_key text, sort integer, asset_id uuid, asset_title text, asset_bucket text, asset_path text, asset_public boolean, asset_type public.asset_type, asset_category public.photo_category)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF coalesce(trim(p_prefix), '') = '' THEN
    RAISE EXCEPTION 'missing prefix';
  END IF;

  RETURN QUERY
    SELECT
      ms.slot_key,
      ms.sort::integer,
      ms.asset_id,
      a.title,
      a.bucket,
      a.path,
      a.public,
      a.asset_type,
      a.category
    FROM public.media_slots ms
    LEFT JOIN public.media_assets a ON a.id = ms.asset_id
    WHERE ms.slot_key LIKE (trim(p_prefix) || '%')
    ORDER BY ms.sort ASC NULLS LAST, ms.slot_key ASC;
END;
$$;


--
-- Name: admin_list_receipts_for_expense(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_list_receipts_for_expense(p_expense_id uuid) RETURNS SETOF public.receipts
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
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


--
-- Name: admin_list_sessions(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_list_sessions() RETURNS SETOF public.sessions
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  return query
  select *
  from public.sessions
  where deleted_at is null
  order by session_time desc nulls last, created_at desc;
end;
$$;


--
-- Name: admin_list_sessions(boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_list_sessions(include_deleted boolean DEFAULT false) RETURNS SETOF public.sessions
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  return query
  select *
  from public.sessions
  where
    include_deleted = true
    or deleted_at is null
  order by
    deleted_at asc nulls first,
    session_time desc nulls last,
    created_at desc;
end;
$$;


--
-- Name: admin_map_session_to_lesson_type(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_map_session_to_lesson_type(p_session_ids uuid[]) RETURNS TABLE(session_id uuid, lesson_type text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
    SELECT br.approved_session_id AS session_id,
           br.requested_lesson_type AS lesson_type
    FROM public.booking_requests br
    WHERE br.approved_session_id = ANY(p_session_ids);
END;
$$;


--
-- Name: admin_publish_es(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_publish_es(p_page_key text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  update public.cms_page_content
  set
    body_es_published = body_es_draft,
    approved = true,
    updated_by = auth.uid()
  where page_key = p_page_key;
end;
$$;


--
-- Name: admin_relocate_receipt(uuid, text, text, public.finance_category); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_relocate_receipt(p_id uuid, p_expected_path text, p_new_path text, p_category public.finance_category) RETURNS public.receipts
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
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
$_$;


--
-- Name: admin_replace_gallery_images(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_replace_gallery_images(p_asset_ids uuid[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: admin_replace_gallery_images(integer, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_replace_gallery_images(p_count integer, p_asset_ids uuid[] DEFAULT NULL::uuid[]) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_count int;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  v_count := greatest(0, least(100, coalesce(p_count, 0)));

  DELETE FROM public.media_slots WHERE slot_key LIKE 'gallery.images.%';

  IF v_count > 0 THEN
    INSERT INTO public.media_slots (slot_key, asset_id, sort)
    SELECT
      ('gallery.images.' || (i - 1))::text,
      CASE
        WHEN p_asset_ids IS NULL THEN NULL
        WHEN array_length(p_asset_ids, 1) >= i THEN p_asset_ids[i]
        ELSE NULL
      END AS asset_id,
      (i - 1) AS sort
    FROM generate_series(1, v_count) AS i;
  END IF;

  RETURN v_count;
END;
$$;


--
-- Name: admin_restore_session(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_restore_session(p_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  update public.sessions
  set deleted_at = null
  where id = p_id;

  if not found then
    raise exception 'session not found';
  end if;
end;
$$;


--
-- Name: admin_save_content_bundle(jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_save_content_bundle(p_strings jsonb, p_media jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
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
$_$;


--
-- Name: admin_save_media_asset(jsonb, text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_save_media_asset(p_asset jsonb, p_slot_keys text[] DEFAULT NULL::text[]) RETURNS public.media_assets
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
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
$_$;


--
-- Name: admin_set_media_slot(text, uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_set_media_slot(p_slot_key text, p_asset_id uuid DEFAULT NULL::uuid, p_sort integer DEFAULT NULL::integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
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
$_$;


--
-- Name: admin_update_booking_request(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_update_booking_request(p_id uuid, p_patch jsonb) RETURNS public.booking_requests
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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
$$;


--
-- Name: admin_update_booking_request_billing(uuid, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_update_booking_request_billing(p_id uuid, p_bill_total_cents integer DEFAULT NULL::integer, p_amount_paid_cents integer DEFAULT NULL::integer) RETURNS public.booking_requests
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_row public.booking_requests;
  v_bill_total integer;
  v_amount_paid integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT * INTO v_row
  FROM public.booking_requests
  WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'booking_request not found';
  END IF;

  v_bill_total := COALESCE(p_bill_total_cents, v_row.bill_total_cents);
  v_amount_paid := COALESCE(p_amount_paid_cents, v_row.amount_paid_cents);

  UPDATE public.booking_requests
  SET
    bill_total_cents = v_bill_total,
    amount_paid_cents = v_amount_paid,
    updated_at = NOW()
  WHERE id = p_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;


--
-- Name: admin_update_business_expense(uuid, date, public.finance_category, integer, text, text, public.payment_method, integer, integer, integer, text, boolean, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_update_business_expense(p_id uuid, p_expense_date date, p_category public.finance_category, p_total_cents integer, p_vendor_name text DEFAULT NULL::text, p_description text DEFAULT NULL::text, p_payment_method public.payment_method DEFAULT NULL::public.payment_method, p_subtotal_cents integer DEFAULT NULL::integer, p_tax_cents integer DEFAULT NULL::integer, p_tip_cents integer DEFAULT NULL::integer, p_transaction_id text DEFAULT NULL::text, p_is_refund boolean DEFAULT false, p_parent_expense_id uuid DEFAULT NULL::uuid, p_notes text DEFAULT NULL::text) RETURNS public.business_expenses
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$

declare
  v_row public.business_expenses;
  v_txn_id text;
  v_is_refund boolean;
  v_session_status public.lesson_status;

begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  v_is_refund := coalesce(p_is_refund, false);
  v_txn_id := coalesce(nullif(btrim(coalesce(p_transaction_id, '')), ''), gen_random_uuid()::text);

  if p_total_cents is null or p_total_cents < 0 then
    raise exception 'total_cents must be >= 0';
  end if;

  if v_is_refund and p_parent_expense_id is null then
    raise exception 'refund expenses require parent_expense_id';
  end if;

  if not v_is_refund and p_parent_expense_id is not null then
    raise exception 'non-refund expenses cannot have parent_expense_id';
  end if;

  if v_is_refund and p_parent_expense_id is not null then
    select s.lesson_status
      into v_session_status
      from public.sessions s
      where s.id = p_parent_expense_id;

    if not found then
      raise exception 'parent_expense_id must reference an existing session';
    end if;

    if v_session_status is distinct from 'canceled_with_refund'::public.lesson_status
       and v_session_status is distinct from 'booked_paid_in_full'::public.lesson_status then
      raise exception 'parent_expense_id session must be canceled_with_refund or booked_paid_in_full';
    end if;
  end if;

  update public.business_expenses
  set
    expense_date = p_expense_date,
    category = p_category,
    total_cents = p_total_cents,
    vendor_name = p_vendor_name,
    description = p_description,
    payment_method = p_payment_method,
    subtotal_cents = p_subtotal_cents,
    tax_cents = p_tax_cents,
    tip_cents = p_tip_cents,
    transaction_id = v_txn_id,
    is_refund = v_is_refund,
    parent_expense_id = p_parent_expense_id,
    notes = p_notes,
    updated_at = now()
  where id = p_id
  returning * into v_row;

  if not found then
    raise exception 'expense not found';
  end if;

  return v_row;
end;

$$;


--
-- Name: admin_update_lesson_type(text, text, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_update_lesson_type(p_key text, p_display_name text DEFAULT NULL::text, p_description text DEFAULT NULL::text, p_price_per_person_cents integer DEFAULT NULL::integer) RETURNS public.lesson_types
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_row public.lesson_types;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF coalesce(trim(p_key), '') = '' THEN
    RAISE EXCEPTION 'missing key';
  END IF;

  UPDATE public.lesson_types
  SET
    display_name = COALESCE(p_display_name, display_name),
    description = COALESCE(p_description, description),
    price_per_person_cents = COALESCE(p_price_per_person_cents, price_per_person_cents),
    updated_at = now()
  WHERE key = trim(p_key)
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'lesson type not found';
  END IF;

  RETURN v_row;
END;
$$;


--
-- Name: admin_update_receipt(uuid, date, public.finance_category, integer, text, text, text, public.payment_method, integer, integer, integer, text, boolean, uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_update_receipt(p_id uuid, p_receipt_date date, p_category public.finance_category, p_total_cents integer, p_receipt_storage_path text, p_vendor_name text DEFAULT NULL::text, p_description text DEFAULT NULL::text, p_payment_method public.payment_method DEFAULT NULL::public.payment_method, p_subtotal_cents integer DEFAULT NULL::integer, p_tax_cents integer DEFAULT NULL::integer, p_tip_cents integer DEFAULT NULL::integer, p_transaction_id text DEFAULT NULL::text, p_is_refund boolean DEFAULT false, p_parent_receipt_id uuid DEFAULT NULL::uuid, p_source_type text DEFAULT NULL::text, p_notes text DEFAULT NULL::text) RETURNS public.receipts
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  r public.receipts;
  v_is_refund boolean;
  v_storage_path text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  v_is_refund := COALESCE(p_is_refund, false);
  v_storage_path := NULLIF(BTRIM(COALESCE(p_receipt_storage_path, '')), '');

  IF p_total_cents IS NULL OR p_total_cents < 0 THEN
    RAISE EXCEPTION 'total_cents must be >= 0';
  END IF;

  IF v_storage_path IS NULL THEN
    RAISE EXCEPTION 'receipt_storage_path is required';
  END IF;

  IF v_is_refund AND p_parent_receipt_id IS NULL THEN
    RAISE EXCEPTION 'refund receipts require parent_receipt_id';
  END IF;

  IF NOT v_is_refund AND p_parent_receipt_id IS NOT NULL THEN
    RAISE EXCEPTION 'non-refund receipts cannot have parent_receipt_id';
  END IF;

  UPDATE public.receipts
  SET
    receipt_date = p_receipt_date,
    vendor_name = NULLIF(BTRIM(COALESCE(p_vendor_name, '')), ''),
    description = NULLIF(BTRIM(COALESCE(p_description, '')), ''),
    category = p_category,
    payment_method = p_payment_method,
    subtotal_cents = p_subtotal_cents,
    tax_cents = p_tax_cents,
    tip_cents = p_tip_cents,
    total_cents = p_total_cents,
    transaction_id = NULLIF(BTRIM(COALESCE(p_transaction_id, '')), ''),
    is_refund = v_is_refund,
    parent_receipt_id = p_parent_receipt_id,
    receipt_storage_path = v_storage_path,
    source_type = NULLIF(BTRIM(COALESCE(p_source_type, '')), ''),
    notes = NULLIF(BTRIM(COALESCE(p_notes, '')), ''),
    updated_at = now()
  WHERE id = p_id
  RETURNING * INTO r;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'receipt not found';
  END IF;

  RETURN r;
END;
$$;


--
-- Name: admin_update_session(uuid, timestamp with time zone, integer, text[], public.lesson_status, numeric, numeric, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_update_session(p_id uuid, p_session_time timestamp with time zone DEFAULT NULL::timestamp with time zone, p_group_size integer DEFAULT NULL::integer, p_client_names text[] DEFAULT NULL::text[], p_lesson_status public.lesson_status DEFAULT NULL::public.lesson_status, p_paid numeric DEFAULT NULL::numeric, p_tip numeric DEFAULT NULL::numeric, p_lesson_type_key text DEFAULT NULL::text) RETURNS public.sessions
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  r public.sessions;
  v_key text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  v_key := nullif(trim(coalesce(p_lesson_type_key, '')), '');
  IF v_key IS NOT NULL THEN
    PERFORM 1 FROM public.lesson_types lt WHERE lt.key = v_key;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'lesson type not found: %', v_key;
    END IF;
  END IF;

  UPDATE public.sessions s
  SET
    session_time = COALESCE(p_session_time, s.session_time),
    group_size = COALESCE(p_group_size, s.group_size),
    client_names = COALESCE(p_client_names, s.client_names),
    lesson_status = COALESCE(p_lesson_status, s.lesson_status),
    paid = COALESCE(p_paid, s.paid),
    tip = COALESCE(p_tip, s.tip),
    lesson_type_key = COALESCE(v_key, s.lesson_type_key)
  WHERE s.id = p_id
  RETURNING * INTO r;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found: %', p_id;
  END IF;

  RETURN r;
END;
$$;


--
-- Name: admin_update_session_v2(uuid, text, timestamp with time zone, numeric, numeric, numeric, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_update_session_v2(p_session_id uuid, p_lesson_status text DEFAULT NULL::text, p_session_time timestamp with time zone DEFAULT NULL::timestamp with time zone, p_paid numeric DEFAULT NULL::numeric, p_tip numeric DEFAULT NULL::numeric, p_bill_total numeric DEFAULT NULL::numeric, p_notes text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_status public.lesson_status;
  v_status_text text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  v_status_text := nullif(trim(coalesce(p_lesson_status, '')), '');
  IF v_status_text IS NOT NULL THEN
    BEGIN
      v_status := v_status_text::public.lesson_status;
    EXCEPTION
      WHEN others THEN
        RAISE EXCEPTION 'invalid lesson_status: %', v_status_text;
    END;
  ELSE
    v_status := NULL;
  END IF;

  UPDATE public.sessions s
  SET
    lesson_status = COALESCE(v_status, s.lesson_status),
    session_time  = COALESCE(p_session_time, s.session_time),
    paid          = COALESCE(p_paid, s.paid),
    tip           = COALESCE(p_tip, s.tip),
    bill_total    = COALESCE(p_bill_total, s.bill_total),
    notes         = COALESCE(p_notes, s.notes)
  WHERE s.id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found: %', p_session_id;
  END IF;
END;
$$;


--
-- Name: admin_upsert_media_asset(text, text, text, boolean, public.photo_category, public.asset_type, text, uuid, smallint, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_upsert_media_asset(p_bucket text, p_path text, p_title text, p_public boolean, p_category public.photo_category, p_asset_type public.asset_type, p_description text DEFAULT NULL::text, p_session_id uuid DEFAULT NULL::uuid, p_sort smallint DEFAULT 32767, p_id uuid DEFAULT NULL::uuid) RETURNS public.media_assets
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  result public.media_assets;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  if p_bucket is null or length(trim(p_bucket)) = 0 then
    raise exception 'bucket is required';
  end if;
  if p_path is null or length(trim(p_path)) = 0 then
    raise exception 'path is required';
  end if;
  if p_title is null or length(trim(p_title)) = 0 then
    raise exception 'title is required';
  end if;

  insert into public.media_assets (
    id, bucket, path, title, public, category, asset_type, description, session_id, sort
  )
  values (
    coalesce(p_id, gen_random_uuid()),
    p_bucket, p_path, p_title, p_public, p_category, p_asset_type,
    p_description, p_session_id, p_sort
  )
  on conflict (bucket, path)
  do update set
    title = excluded.title,
    public = excluded.public,
    category = excluded.category,
    asset_type = excluded.asset_type,
    description = excluded.description,
    session_id = excluded.session_id,
    sort = excluded.sort
  returning * into result;

  return result;
end;
$$;


--
-- Name: admin_upsert_media_asset(text, text, text, boolean, public.photo_category, public.asset_type, text, uuid, smallint, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_upsert_media_asset(p_bucket text, p_path text, p_title text, p_public boolean, p_category public.photo_category, p_asset_type public.asset_type, p_description text DEFAULT NULL::text, p_session_id uuid DEFAULT NULL::uuid, p_sort smallint DEFAULT 32767, p_id uuid DEFAULT NULL::uuid, p_asset_key text DEFAULT NULL::text) RETURNS public.media_assets
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  result public.media_assets;
  v_asset_key text;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  if p_bucket is null or length(trim(p_bucket)) = 0 then
    raise exception 'bucket is required';
  end if;

  if p_path is null or length(trim(p_path)) = 0 then
    raise exception 'path is required';
  end if;

  if p_title is null or length(trim(p_title)) = 0 then
    raise exception 'title is required';
  end if;

  v_asset_key := nullif(trim(p_asset_key), '');

  -- Upsert keyed on (bucket, path) as your storage identity.
  insert into public.media_assets (
    id,
    bucket,
    path,
    title,
    public,
    category,
    asset_type,
    description,
    session_id,
    sort,
    asset_key
  )
  values (
    coalesce(p_id, gen_random_uuid()),
    trim(p_bucket),
    trim(p_path),
    trim(p_title),
    p_public,
    p_category,
    p_asset_type,
    p_description,
    p_session_id,
    p_sort,
    v_asset_key
  )
  on conflict (bucket, path)
  do update set
    title = excluded.title,
    public = excluded.public,
    category = excluded.category,
    asset_type = excluded.asset_type,
    description = excluded.description,
    session_id = excluded.session_id,
    sort = excluded.sort,
    asset_key = excluded.asset_key,
    updated_at = now()
  returning * into result;

  return result;
end;
$$;


--
-- Name: admin_upsert_page_content(text, text, text, text, boolean, smallint, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_upsert_page_content(p_page_key text, p_body_en text DEFAULT NULL::text, p_body_es_draft text DEFAULT NULL::text, p_body_es_published text DEFAULT NULL::text, p_approved boolean DEFAULT NULL::boolean, p_sort smallint DEFAULT NULL::smallint, p_category text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  insert into public.cms_page_content (
    page_key,
    body_en,
    body_es_draft,
    body_es_published,
    approved,
    sort,
    category,
    created_by,
    updated_by
  )
  values (
    p_page_key,
    p_body_en,
    p_body_es_draft,
    p_body_es_published,
    coalesce(p_approved, false),
    coalesce(p_sort, 32767),
    p_category,
    auth.uid(),
    auth.uid()
  )
  on conflict (page_key) do update
  set
    body_en = coalesce(p_body_en, public.cms_page_content.body_en),
    body_es_draft = coalesce(p_body_es_draft, public.cms_page_content.body_es_draft),
    body_es_published = coalesce(p_body_es_published, public.cms_page_content.body_es_published),
    approved = coalesce(p_approved, public.cms_page_content.approved),
    sort = coalesce(p_sort, public.cms_page_content.sort),
    category = coalesce(p_category, public.cms_page_content.category),
    updated_by = auth.uid();
end;
$$;


--
-- Name: booking_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_id uuid NOT NULL,
    recipient_kind text NOT NULL,
    payload jsonb NOT NULL,
    status text DEFAULT 'queued'::text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    next_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    lease_token uuid,
    lease_expires_at timestamp with time zone,
    provider_message_id text,
    last_error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT booking_notifications_recipient_kind_check CHECK ((recipient_kind = ANY (ARRAY['admin'::text, 'customer'::text]))),
    CONSTRAINT booking_notifications_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'processing'::text, 'sent'::text, 'failed'::text])))
);


--
-- Name: claim_booking_notifications(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_booking_notifications(p_booking_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 20) RETURNS SETOF public.booking_notifications
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: complete_booking_notification(uuid, uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.complete_booking_notification(p_id uuid, p_lease_token uuid, p_provider_id text DEFAULT NULL::text, p_error text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: compute_booking_request_bill_total_cents(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.compute_booking_request_bill_total_cents(p_lesson_type_key text, p_party_size integer) RETURNS bigint
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  v_price bigint;
  v_size int;
begin
  v_size := greatest(coalesce(p_party_size, 1), 1);

  select lt.price_per_person_cents
    into v_price
  from public.lesson_types lt
  where lt.key = p_lesson_type_key
    and lt.is_active = true;

  if v_price is null then
    -- If lesson type is missing/inactive, fail loudly so you notice data issues.
    raise exception 'Unknown or inactive lesson type key: %', p_lesson_type_key
      using errcode = '22023'; -- invalid_parameter_value
  end if;

  return v_price * v_size;
end;
$$;


--
-- Name: configure_booking_email_worker(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.configure_booking_email_worker(p_url text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
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
$_$;


--
-- Name: get_page_content(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_page_content(p_page_key text, p_locale text DEFAULT 'en'::text) RETURNS TABLE(page_key text, locale text, body text, updated_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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
$$;


--
-- Name: get_page_content_by_prefix(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_page_content_by_prefix(p_prefix text, p_locale text DEFAULT 'en'::text) RETURNS TABLE(page_key text, locale text, body text, updated_at timestamp with time zone)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
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
$$;


--
-- Name: get_public_media_asset_by_key(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_public_media_asset_by_key(p_slot_key text) RETURNS TABLE(slot_key text, sort smallint, id uuid, title text, description text, created_at timestamp with time zone, updated_at timestamp with time zone, public boolean, bucket text, path text, session_id uuid, asset_type public.asset_type, category public.photo_category)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select
    ms.slot_key,
    ms.sort,
    ma.id,
    ma.title,
    ma.description,
    ma.created_at,
    ma.updated_at,
    ma.public,
    ma.bucket,
    ma.path,
    ma.session_id,
    ma.asset_type,
    ma.category
  from public.media_slots ms
  join public.media_assets ma on ma.id = ms.asset_id
  where ms.slot_key = p_slot_key
    and ma.public = true
  limit 1;
$$;


--
-- Name: get_public_media_assets(public.photo_category); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_public_media_assets(p_category public.photo_category DEFAULT NULL::public.photo_category) RETURNS SETOF public.media_assets
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select *
  from public.media_assets
  where public = true
    and (p_category is null or category = p_category)
  order by sort asc, created_at desc;
$$;


--
-- Name: get_public_media_assets_by_prefix(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_public_media_assets_by_prefix(p_prefix text) RETURNS TABLE(slot_key text, sort smallint, id uuid, title text, description text, created_at timestamp with time zone, updated_at timestamp with time zone, public boolean, bucket text, path text, session_id uuid, asset_type public.asset_type, category public.photo_category)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select
    ms.slot_key,
    ms.sort,
    ma.id,
    ma.title,
    ma.description,
    ma.created_at,
    ma.updated_at,
    ma.public,
    ma.bucket,
    ma.path,
    ma.session_id,
    ma.asset_type,
    ma.category
  from public.media_slots ms
  join public.media_assets ma on ma.id = ms.asset_id
  where ms.slot_key like (p_prefix || '%')
    and ma.public = true
  order by ms.sort asc, ms.slot_key asc;
$$;


--
-- Name: get_public_sessions(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_public_sessions() RETURNS SETOF public.sessions
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select *
  from public.sessions
  where deleted_at is null
    and lesson_status = 'booked'::public.lesson_status
  order by session_time desc nulls last, created_at desc;
$$;


--
-- Name: is_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  SELECT public.is_site_admin();
$$;


--
-- Name: is_site_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_site_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  SELECT coalesce(auth.role(), '') = 'service_role'
    OR EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid());
$$;


--
-- Name: is_valid_json(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_valid_json(p_text text) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO 'public'
    AS $$ BEGIN IF p_text IS NULL OR btrim(p_text) = '' THEN RETURN true; END IF; PERFORM p_text::jsonb; RETURN true; EXCEPTION WHEN others THEN RETURN false; END; $$;


--
-- Name: rpc_create_page_section(text, text, integer, text, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rpc_create_page_section(p_page_key text, p_kind text, p_sort integer DEFAULT NULL::integer, p_status text DEFAULT 'draft'::text, p_anchor text DEFAULT NULL::text, p_meta jsonb DEFAULT '{}'::jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_id uuid := gen_random_uuid();
  v_sort integer := coalesce(p_sort, 32767);
  v_status text := coalesce(p_status, 'draft');
begin
  if not public.is_site_admin() then
    raise exception 'not authorized';
  end if;

  insert into public.page_sections (
    id, page_key, kind, sort, status, anchor, meta, content_source, media_source
  )
  values (
    v_id,
    p_page_key,
    p_kind,
    v_sort,
    v_status,
    p_anchor,
    coalesce(p_meta, '{}'::jsonb),

    -- Default content pointers (safe defaults; you can ignore ones you don't need per kind)
    jsonb_build_object(
      'titleKey',    format('section.%s.title', v_id),
      'subtitleKey', format('section.%s.subtitle', v_id),
      'bodyKey',     format('section.%s.body', v_id),

      -- CTA pointers (content wizard can use these for button labels + hrefs)
      'ctaPrimary', jsonb_build_object(
        'labelKey', format('section.%s.cta.primary.label', v_id),
        'hrefKey',  format('section.%s.cta.primary.href', v_id)
      ),
      'ctaSecondary', jsonb_build_object(
        'labelKey', format('section.%s.cta.secondary.label', v_id),
        'hrefKey',  format('section.%s.cta.secondary.href', v_id)
      )
    ),

    -- Default media slot pointers
    jsonb_build_object(
      'backgroundSlot', format('section.%s.bg', v_id),
      'primarySlot',    format('section.%s.primary', v_id),
      'carouselSlot',   format('section.%s.carousel', v_id)
    )
  );

  return v_id;
end;
$$;


--
-- Name: rpc_delete_page_section(text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rpc_delete_page_section(p_page_key text, p_section_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not public.is_site_admin() then
    raise exception 'not authorized';
  end if;

  delete from public.page_sections
  where page_key = p_page_key and id = p_section_id;
end;
$$;


--
-- Name: rpc_get_page_sections(text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rpc_get_page_sections(p_page_key text, p_include_drafts boolean DEFAULT false) RETURNS TABLE(id uuid, page_key text, kind text, sort integer, status text, anchor text, meta jsonb, content_source jsonb, media_source jsonb, created_at timestamp with time zone, updated_at timestamp with time zone)
    LANGUAGE sql STABLE
    SET search_path TO 'public', 'pg_temp'
    AS $$
  select
    s.id, s.page_key, s.kind, s.sort, s.status, s.anchor,
    s.meta, s.content_source, s.media_source,
    s.created_at, s.updated_at
  from public.page_sections s
  where s.page_key = p_page_key
    and (
      -- non-admin callers will only ever see published due to RLS,
      -- but this keeps behavior explicit for admins using include drafts.
      s.status = 'published'
      or (p_include_drafts = true)
    )
  order by s.sort asc, s.created_at asc;
$$;


--
-- Name: rpc_upsert_page_sections(text, jsonb, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rpc_upsert_page_sections(p_page_key text, p_sections jsonb, p_prune_missing boolean DEFAULT true) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not public.is_site_admin() then
    raise exception 'not authorized';
  end if;

  if p_sections is null or jsonb_typeof(p_sections) <> 'array' then
    raise exception 'p_sections must be a JSON array';
  end if;

  -- Upsert incoming rows
  with incoming as (
    select *
    from jsonb_to_recordset(p_sections) as x(
      id uuid,
      kind text,
      sort integer,
      status text,
      anchor text,
      meta jsonb,
      content_source jsonb,
      media_source jsonb
    )
  )
  insert into public.page_sections as s (
    id, page_key, kind, sort, status, anchor, meta, content_source, media_source
  )
  select
    i.id,
    p_page_key,
    i.kind,
    coalesce(i.sort, 32767),
    coalesce(i.status, 'draft'),
    i.anchor,
    coalesce(i.meta, '{}'::jsonb),
    coalesce(i.content_source, '{}'::jsonb),
    coalesce(i.media_source, '{}'::jsonb)
  from incoming i
  on conflict (page_key, id) do update set
    kind = excluded.kind,
    sort = excluded.sort,
    status = excluded.status,
    anchor = excluded.anchor,
    meta = excluded.meta,
    content_source = excluded.content_source,
    media_source = excluded.media_source,
    updated_at = now();

  -- Prune removed sections (structure only)
  if p_prune_missing then
    delete from public.page_sections s
    where s.page_key = p_page_key
      and not exists (
        select 1
        from jsonb_to_recordset(p_sections) as x(id uuid)
        where x.id = s.id
      );
  end if;
end;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: submit_booking_request(jsonb, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.submit_booking_request(p_payload jsonb, p_payload_hash text, p_rate_key text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
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
$_$;


--
-- Name: sync_booking_request_session(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_booking_request_session() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: sync_media_assets_from_storage(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_media_assets_from_storage() RETURNS TABLE(inserted integer, updated integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'storage'
    AS $_$
declare
  v_inserted int := 0;
  v_updated  int := 0;
begin
  with src as (
    select
      o.bucket_id::text as bucket,
      o.name::text      as path,

      -- filename (last path segment) without extension
      regexp_replace(
        (string_to_array(o.name::text, '/'))[
          array_length(string_to_array(o.name::text, '/'), 1)
        ],
        '\.[^.]+$',
        ''
      ) as title,

      coalesce(b.public, false) as is_public,

      case
        when lower(regexp_replace(o.name::text, '^.*\.', '')) in
          ('jpg','jpeg','png','webp','gif','avif','heic','heif')
          then 'photo'::public.asset_type
        when lower(regexp_replace(o.name::text, '^.*\.', '')) in
          ('mp4','mov','webm','m4v')
          then 'video'::public.asset_type
        else
          'photo'::public.asset_type
      end as asset_type
    from storage.objects o
    join storage.buckets b on b.id = o.bucket_id
    where o.name is not null
      and o.name <> ''
      and right(o.name::text, 1) <> '/'  -- skip folder markers
  ),
  upserted as (
    insert into public.media_assets (
      bucket,
      path,
      title,
      description,
      public,
      asset_type,
      sort,
      category
    )
    select
      s.bucket,
      s.path,
      s.title,
      null::text,
      s.is_public,
      s.asset_type,
      32767::smallint,
      'lessons'::public.photo_category  -- default; change if you want
    from src s
    on conflict (bucket, path) do update
      set
        title      = excluded.title,
        public     = excluded.public,
        asset_type = excluded.asset_type,
        updated_at = now()
    returning (xmax = 0) as was_inserted
  )
  select
    count(*) filter (where was_inserted),
    count(*) filter (where not was_inserted)
  into v_inserted, v_updated
  from upserted;

  return query select v_inserted, v_updated;
end;
$_$;


--
-- Name: trg_booking_requests_set_bill_total(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_booking_requests_set_bill_total() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
begin
  -- Manual override wins if enabled and value provided
  if new.manual_pricing is true and new.manual_bill_total_cents is not null then
    new.bill_total_cents := new.manual_bill_total_cents;
    return new;
  end if;

  -- Otherwise compute from DB pricing + party size
  new.bill_total_cents := public.compute_booking_request_bill_total_cents(
    new.requested_lesson_type,
    new.party_size
  );

  return new;
end;
$$;


--
-- Name: verify_booking_worker_secret(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.verify_booking_worker_secret(p_token text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501'; END IF;
  RETURN EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'booking_email_worker_secret'
    AND extensions.digest(decrypted_secret, 'sha256') = extensions.digest(p_token, 'sha256'));
END;
$$;


--
-- Name: admin_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_users (
    id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    name text,
    email text,
    phone_number text
);


--
-- Name: TABLE admin_users; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.admin_users IS 'Who runs this thing anyways';


--
-- Name: booking_request_rate_limits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_request_rate_limits (
    key text NOT NULL,
    window_start timestamp with time zone NOT NULL,
    requests integer NOT NULL,
    CONSTRAINT booking_request_rate_limits_requests_check CHECK ((requests >= 0))
);


--
-- Name: cms_page_content; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cms_page_content (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid DEFAULT auth.uid(),
    updated_by uuid DEFAULT auth.uid(),
    page_key text NOT NULL,
    body_en text,
    body_es_draft text,
    body_es_published text,
    approved boolean DEFAULT false NOT NULL,
    sort smallint DEFAULT 32767 NOT NULL,
    category text
);


--
-- Name: TABLE cms_page_content; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.cms_page_content IS 'Lets the admin dashboard change the website content';


--
-- Name: media_slots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.media_slots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    slot_key text NOT NULL,
    asset_id uuid,
    sort smallint DEFAULT 32767 NOT NULL
);


--
-- Name: page_sections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.page_sections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    page_key text NOT NULL,
    kind text NOT NULL,
    sort integer DEFAULT 32767 NOT NULL,
    status text DEFAULT 'published'::text NOT NULL,
    anchor text,
    meta jsonb DEFAULT '{}'::jsonb NOT NULL,
    content_source jsonb DEFAULT '{}'::jsonb NOT NULL,
    media_source jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT page_sections_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])))
);


--
-- Name: admin_users admin_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_pkey PRIMARY KEY (id);


--
-- Name: booking_notifications booking_notifications_booking_id_recipient_kind_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_notifications
    ADD CONSTRAINT booking_notifications_booking_id_recipient_kind_key UNIQUE (booking_id, recipient_kind);


--
-- Name: booking_notifications booking_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_notifications
    ADD CONSTRAINT booking_notifications_pkey PRIMARY KEY (id);


--
-- Name: booking_request_rate_limits booking_request_rate_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_request_rate_limits
    ADD CONSTRAINT booking_request_rate_limits_pkey PRIMARY KEY (key);


--
-- Name: booking_requests booking_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_requests
    ADD CONSTRAINT booking_requests_pkey PRIMARY KEY (id);


--
-- Name: booking_requests booking_requests_submission_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_requests
    ADD CONSTRAINT booking_requests_submission_id_key UNIQUE (submission_id);


--
-- Name: business_expenses business_expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_expenses
    ADD CONSTRAINT business_expenses_pkey PRIMARY KEY (id);


--
-- Name: cms_page_content cms_page_content_page_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_page_content
    ADD CONSTRAINT cms_page_content_page_key_key UNIQUE (page_key);


--
-- Name: cms_page_content cms_page_content_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_page_content
    ADD CONSTRAINT cms_page_content_pkey PRIMARY KEY (id);


--
-- Name: lesson_types lesson_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lesson_types
    ADD CONSTRAINT lesson_types_pkey PRIMARY KEY (key);


--
-- Name: media_assets media_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_assets
    ADD CONSTRAINT media_assets_pkey PRIMARY KEY (id);


--
-- Name: media_slots media_slots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_slots
    ADD CONSTRAINT media_slots_pkey PRIMARY KEY (id);


--
-- Name: page_sections page_sections_page_key_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.page_sections
    ADD CONSTRAINT page_sections_page_key_id_key UNIQUE (page_key, id);


--
-- Name: page_sections page_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.page_sections
    ADD CONSTRAINT page_sections_pkey PRIMARY KEY (id);


--
-- Name: receipts receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT receipts_pkey PRIMARY KEY (id);


--
-- Name: sessions session_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT session_pkey PRIMARY KEY (id);


--
-- Name: admin_users_email_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX admin_users_email_unique ON public.admin_users USING btree (email) WHERE (email IS NOT NULL);


--
-- Name: booking_notifications_due_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX booking_notifications_due_idx ON public.booking_notifications USING btree (next_attempt_at) WHERE (status = ANY (ARRAY['queued'::text, 'processing'::text]));


--
-- Name: booking_requests_decided_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX booking_requests_decided_by_idx ON public.booking_requests USING btree (decided_by);


--
-- Name: booking_requests_requested_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX booking_requests_requested_date_idx ON public.booking_requests USING btree (requested_date);


--
-- Name: booking_requests_status_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX booking_requests_status_created_idx ON public.booking_requests USING btree (status, created_at DESC);


--
-- Name: business_expenses_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX business_expenses_category_idx ON public.business_expenses USING btree (category);


--
-- Name: business_expenses_expense_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX business_expenses_expense_date_idx ON public.business_expenses USING btree (expense_date DESC);


--
-- Name: business_expenses_parent_expense_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX business_expenses_parent_expense_id_idx ON public.business_expenses USING btree (parent_expense_id);


--
-- Name: business_expenses_transaction_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX business_expenses_transaction_id_idx ON public.business_expenses USING btree (transaction_id) WHERE (transaction_id IS NOT NULL);


--
-- Name: idx_booking_requests_approved_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_requests_approved_session_id ON public.booking_requests USING btree (approved_session_id);


--
-- Name: idx_booking_requests_requested_lesson_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_requests_requested_lesson_type ON public.booking_requests USING btree (requested_lesson_type);


--
-- Name: idx_sessions_lesson_type_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_lesson_type_key ON public.sessions USING btree (lesson_type_key);


--
-- Name: media_assets_bucket_path_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX media_assets_bucket_path_unique ON public.media_assets USING btree (bucket, path);


--
-- Name: media_assets_public_category_sort_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX media_assets_public_category_sort_idx ON public.media_assets USING btree (public, category, sort, created_at);


--
-- Name: media_assets_session_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX media_assets_session_id_idx ON public.media_assets USING btree (session_id);


--
-- Name: media_slots_asset_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX media_slots_asset_id_idx ON public.media_slots USING btree (asset_id);


--
-- Name: media_slots_slot_key_pattern_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX media_slots_slot_key_pattern_idx ON public.media_slots USING btree (slot_key text_pattern_ops);


--
-- Name: media_slots_slot_key_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX media_slots_slot_key_unique ON public.media_slots USING btree (slot_key);


--
-- Name: page_sections_page_key_kind_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX page_sections_page_key_kind_idx ON public.page_sections USING btree (page_key, kind);


--
-- Name: page_sections_page_key_sort_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX page_sections_page_key_sort_idx ON public.page_sections USING btree (page_key, sort);


--
-- Name: page_sections_page_key_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX page_sections_page_key_status_idx ON public.page_sections USING btree (page_key, status);


--
-- Name: receipts_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX receipts_category_idx ON public.receipts USING btree (category);


--
-- Name: receipts_expense_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX receipts_expense_id_idx ON public.receipts USING btree (expense_id);


--
-- Name: receipts_parent_receipt_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX receipts_parent_receipt_id_idx ON public.receipts USING btree (parent_receipt_id);


--
-- Name: receipts_receipt_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX receipts_receipt_date_idx ON public.receipts USING btree (receipt_date DESC);


--
-- Name: receipts_session_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX receipts_session_id_idx ON public.receipts USING btree (session_id);


--
-- Name: receipts_transaction_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX receipts_transaction_id_idx ON public.receipts USING btree (transaction_id) WHERE (transaction_id IS NOT NULL);


--
-- Name: sessions_deleted_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sessions_deleted_at_idx ON public.sessions USING btree (deleted_at);


--
-- Name: sessions_public_list_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sessions_public_list_idx ON public.sessions USING btree (lesson_status, session_time, created_at) WHERE (deleted_at IS NULL);


--
-- Name: booking_requests booking_request_sync_session; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER booking_request_sync_session AFTER UPDATE ON public.booking_requests FOR EACH ROW EXECUTE FUNCTION public.sync_booking_request_session();


--
-- Name: booking_requests booking_requests_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER booking_requests_set_updated_at BEFORE UPDATE ON public.booking_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: booking_requests trg_booking_requests_set_bill_total; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_booking_requests_set_bill_total BEFORE INSERT OR UPDATE OF requested_lesson_type, party_size, manual_pricing, manual_bill_total_cents ON public.booking_requests FOR EACH ROW EXECUTE FUNCTION public.trg_booking_requests_set_bill_total();


--
-- Name: business_expenses trg_business_expenses_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_business_expenses_set_updated_at BEFORE UPDATE ON public.business_expenses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: cms_page_content trg_cms_page_content_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cms_page_content_updated_at BEFORE UPDATE ON public.cms_page_content FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: lesson_types trg_lesson_types_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lesson_types_set_updated_at BEFORE UPDATE ON public.lesson_types FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: media_assets trg_media_assets_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_media_assets_updated_at BEFORE UPDATE ON public.media_assets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: page_sections trg_page_sections_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_page_sections_updated_at BEFORE UPDATE ON public.page_sections FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: receipts trg_receipts_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_receipts_set_updated_at BEFORE UPDATE ON public.receipts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: admin_users admin_users_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: booking_notifications booking_notifications_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_notifications
    ADD CONSTRAINT booking_notifications_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.booking_requests(id) ON DELETE CASCADE;


--
-- Name: booking_requests booking_requests_approved_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_requests
    ADD CONSTRAINT booking_requests_approved_session_id_fkey FOREIGN KEY (approved_session_id) REFERENCES public.sessions(id) ON DELETE SET NULL;


--
-- Name: booking_requests booking_requests_decided_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_requests
    ADD CONSTRAINT booking_requests_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES public.admin_users(id) ON DELETE SET NULL;


--
-- Name: booking_requests booking_requests_requested_lesson_type_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_requests
    ADD CONSTRAINT booking_requests_requested_lesson_type_fk FOREIGN KEY (requested_lesson_type) REFERENCES public.lesson_types(key) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: business_expenses business_expenses_parent_expense_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_expenses
    ADD CONSTRAINT business_expenses_parent_expense_id_fkey FOREIGN KEY (parent_expense_id) REFERENCES public.sessions(id) ON DELETE SET NULL;


--
-- Name: media_assets media_assets_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_assets
    ADD CONSTRAINT media_assets_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON UPDATE CASCADE;


--
-- Name: media_slots media_slots_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_slots
    ADD CONSTRAINT media_slots_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.media_assets(id) ON DELETE SET NULL;


--
-- Name: receipts receipts_expense_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT receipts_expense_id_fkey FOREIGN KEY (expense_id) REFERENCES public.business_expenses(id) ON DELETE CASCADE;


--
-- Name: receipts receipts_parent_receipt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT receipts_parent_receipt_id_fkey FOREIGN KEY (parent_receipt_id) REFERENCES public.receipts(id) ON DELETE SET NULL;


--
-- Name: receipts receipts_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT receipts_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_lesson_type_key_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_lesson_type_key_fk FOREIGN KEY (lesson_type_key) REFERENCES public.lesson_types(key) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: media_assets Allow admin full access on media_assets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow admin full access on media_assets" ON public.media_assets TO authenticated USING (((( SELECT auth.jwt() AS jwt) ->> 'role'::text) = 'admin'::text)) WITH CHECK (((( SELECT auth.jwt() AS jwt) ->> 'role'::text) = 'admin'::text));


--
-- Name: media_assets Allow public read on media_assets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read on media_assets" ON public.media_assets FOR SELECT TO authenticated, anon USING ((public = true));


--
-- Name: media_slots Public can read slots for public assets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can read slots for public assets" ON public.media_slots FOR SELECT TO authenticated, anon USING (((asset_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.media_assets ma
  WHERE ((ma.id = media_slots.asset_id) AND (ma.public = true))))));


--
-- Name: cms_page_content admin_all_cms_page_content; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_all_cms_page_content ON public.cms_page_content TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: business_expenses admin_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_delete ON public.business_expenses FOR DELETE TO authenticated USING (public.is_admin());


--
-- Name: receipts admin_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_delete ON public.receipts FOR DELETE TO authenticated USING (public.is_admin());


--
-- Name: sessions admin_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_delete ON public.sessions FOR DELETE TO authenticated USING (public.is_admin());


--
-- Name: business_expenses admin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_insert ON public.business_expenses FOR INSERT TO authenticated WITH CHECK (public.is_admin());


--
-- Name: receipts admin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_insert ON public.receipts FOR INSERT TO authenticated WITH CHECK (public.is_admin());


--
-- Name: sessions admin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_insert ON public.sessions FOR INSERT TO authenticated WITH CHECK (public.is_admin());


--
-- Name: business_expenses admin_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_select ON public.business_expenses FOR SELECT TO authenticated USING (public.is_admin());


--
-- Name: receipts admin_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_select ON public.receipts FOR SELECT TO authenticated USING (public.is_admin());


--
-- Name: sessions admin_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_select ON public.sessions FOR SELECT TO authenticated USING (public.is_admin());


--
-- Name: business_expenses admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_update ON public.business_expenses FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: receipts admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_update ON public.receipts FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: sessions admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_update ON public.sessions FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: admin_users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

--
-- Name: booking_requests admins can delete booking requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins can delete booking requests" ON public.booking_requests FOR DELETE USING (public.is_site_admin());


--
-- Name: admin_users admins can manage admin_users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins can manage admin_users" ON public.admin_users USING (public.is_site_admin()) WITH CHECK (public.is_site_admin());


--
-- Name: booking_requests admins can read booking requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins can read booking requests" ON public.booking_requests FOR SELECT USING (public.is_site_admin());


--
-- Name: booking_requests admins can update booking requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins can update booking requests" ON public.booking_requests FOR UPDATE USING (public.is_site_admin()) WITH CHECK (public.is_site_admin());


--
-- Name: booking_notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.booking_notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: booking_request_rate_limits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.booking_request_rate_limits ENABLE ROW LEVEL SECURITY;

--
-- Name: booking_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.booking_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: business_expenses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.business_expenses ENABLE ROW LEVEL SECURITY;

--
-- Name: cms_page_content; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cms_page_content ENABLE ROW LEVEL SECURITY;

--
-- Name: lesson_types; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lesson_types ENABLE ROW LEVEL SECURITY;

--
-- Name: lesson_types lesson_types_active_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lesson_types_active_read ON public.lesson_types FOR SELECT TO authenticated, anon USING (is_active);


--
-- Name: media_assets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;

--
-- Name: media_slots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.media_slots ENABLE ROW LEVEL SECURITY;

--
-- Name: page_sections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.page_sections ENABLE ROW LEVEL SECURITY;

--
-- Name: page_sections page_sections_admin_select_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY page_sections_admin_select_all ON public.page_sections FOR SELECT TO authenticated USING (public.is_site_admin());


--
-- Name: page_sections page_sections_select_published; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY page_sections_select_published ON public.page_sections FOR SELECT TO authenticated, anon USING ((status = 'published'::text));


--
-- Name: cms_page_content public_read_home_section_meta; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_read_home_section_meta ON public.cms_page_content FOR SELECT TO authenticated, anon USING (((category = 'sections.page.home'::text) AND (page_key ~~ 'section.%.meta'::text)));


--
-- Name: receipts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

--
-- Name: sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: TABLE booking_requests; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,DELETE,MAINTAIN,UPDATE ON TABLE public.booking_requests TO anon;
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.booking_requests TO authenticated;
GRANT ALL ON TABLE public.booking_requests TO service_role;


--
-- Name: FUNCTION admin_apply_booking_request_payment(p_id uuid, p_delta_cents integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_apply_booking_request_payment(p_id uuid, p_delta_cents integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_apply_booking_request_payment(p_id uuid, p_delta_cents integer) TO authenticated;
GRANT ALL ON FUNCTION public.admin_apply_booking_request_payment(p_id uuid, p_delta_cents integer) TO service_role;


--
-- Name: FUNCTION admin_clear_media_asset_slots(p_asset_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_clear_media_asset_slots(p_asset_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_clear_media_asset_slots(p_asset_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.admin_clear_media_asset_slots(p_asset_id uuid) TO service_role;


--
-- Name: TABLE business_expenses; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.business_expenses TO anon;
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.business_expenses TO authenticated;
GRANT ALL ON TABLE public.business_expenses TO service_role;


--
-- Name: FUNCTION admin_create_business_expense(p_expense_date date, p_category public.finance_category, p_total_cents integer, p_vendor_name text, p_description text, p_payment_method public.payment_method, p_subtotal_cents integer, p_tax_cents integer, p_tip_cents integer, p_transaction_id text, p_is_refund boolean, p_parent_expense_id uuid, p_notes text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_create_business_expense(p_expense_date date, p_category public.finance_category, p_total_cents integer, p_vendor_name text, p_description text, p_payment_method public.payment_method, p_subtotal_cents integer, p_tax_cents integer, p_tip_cents integer, p_transaction_id text, p_is_refund boolean, p_parent_expense_id uuid, p_notes text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_create_business_expense(p_expense_date date, p_category public.finance_category, p_total_cents integer, p_vendor_name text, p_description text, p_payment_method public.payment_method, p_subtotal_cents integer, p_tax_cents integer, p_tip_cents integer, p_transaction_id text, p_is_refund boolean, p_parent_expense_id uuid, p_notes text) TO authenticated;
GRANT ALL ON FUNCTION public.admin_create_business_expense(p_expense_date date, p_category public.finance_category, p_total_cents integer, p_vendor_name text, p_description text, p_payment_method public.payment_method, p_subtotal_cents integer, p_tax_cents integer, p_tip_cents integer, p_transaction_id text, p_is_refund boolean, p_parent_expense_id uuid, p_notes text) TO service_role;


--
-- Name: TABLE receipts; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.receipts TO anon;
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.receipts TO authenticated;
GRANT ALL ON TABLE public.receipts TO service_role;


--
-- Name: FUNCTION admin_create_expense_receipt(p_expense_id uuid, p_receipt_date date, p_category public.finance_category, p_total_cents integer, p_receipt_storage_path text, p_vendor_name text, p_description text, p_payment_method public.payment_method, p_subtotal_cents integer, p_tax_cents integer, p_tip_cents integer, p_transaction_id text, p_is_refund boolean, p_parent_receipt_id uuid, p_source_type text, p_notes text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_create_expense_receipt(p_expense_id uuid, p_receipt_date date, p_category public.finance_category, p_total_cents integer, p_receipt_storage_path text, p_vendor_name text, p_description text, p_payment_method public.payment_method, p_subtotal_cents integer, p_tax_cents integer, p_tip_cents integer, p_transaction_id text, p_is_refund boolean, p_parent_receipt_id uuid, p_source_type text, p_notes text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_create_expense_receipt(p_expense_id uuid, p_receipt_date date, p_category public.finance_category, p_total_cents integer, p_receipt_storage_path text, p_vendor_name text, p_description text, p_payment_method public.payment_method, p_subtotal_cents integer, p_tax_cents integer, p_tip_cents integer, p_transaction_id text, p_is_refund boolean, p_parent_receipt_id uuid, p_source_type text, p_notes text) TO authenticated;
GRANT ALL ON FUNCTION public.admin_create_expense_receipt(p_expense_id uuid, p_receipt_date date, p_category public.finance_category, p_total_cents integer, p_receipt_storage_path text, p_vendor_name text, p_description text, p_payment_method public.payment_method, p_subtotal_cents integer, p_tax_cents integer, p_tip_cents integer, p_transaction_id text, p_is_refund boolean, p_parent_receipt_id uuid, p_source_type text, p_notes text) TO service_role;


--
-- Name: TABLE sessions; Type: ACL; Schema: public; Owner: -
--

GRANT MAINTAIN ON TABLE public.sessions TO anon;
GRANT MAINTAIN ON TABLE public.sessions TO authenticated;
GRANT ALL ON TABLE public.sessions TO service_role;


--
-- Name: FUNCTION admin_create_session(p_session_time timestamp with time zone, p_group_size integer, p_client_names text[], p_lesson_status public.lesson_status, p_paid numeric, p_tip numeric, p_lesson_type_key text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_create_session(p_session_time timestamp with time zone, p_group_size integer, p_client_names text[], p_lesson_status public.lesson_status, p_paid numeric, p_tip numeric, p_lesson_type_key text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_create_session(p_session_time timestamp with time zone, p_group_size integer, p_client_names text[], p_lesson_status public.lesson_status, p_paid numeric, p_tip numeric, p_lesson_type_key text) TO authenticated;
GRANT ALL ON FUNCTION public.admin_create_session(p_session_time timestamp with time zone, p_group_size integer, p_client_names text[], p_lesson_status public.lesson_status, p_paid numeric, p_tip numeric, p_lesson_type_key text) TO service_role;


--
-- Name: FUNCTION admin_decide_booking_request(p_id uuid, p_action text, p_selected_time_label text, p_decision_reason text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_decide_booking_request(p_id uuid, p_action text, p_selected_time_label text, p_decision_reason text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_decide_booking_request(p_id uuid, p_action text, p_selected_time_label text, p_decision_reason text) TO authenticated;
GRANT ALL ON FUNCTION public.admin_decide_booking_request(p_id uuid, p_action text, p_selected_time_label text, p_decision_reason text) TO service_role;


--
-- Name: FUNCTION admin_delete_business_expense(p_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_delete_business_expense(p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_delete_business_expense(p_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.admin_delete_business_expense(p_id uuid) TO service_role;


--
-- Name: FUNCTION admin_delete_page_content(p_page_key text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_delete_page_content(p_page_key text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_delete_page_content(p_page_key text) TO authenticated;
GRANT ALL ON FUNCTION public.admin_delete_page_content(p_page_key text) TO service_role;


--
-- Name: FUNCTION admin_delete_receipt(p_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_delete_receipt(p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_delete_receipt(p_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.admin_delete_receipt(p_id uuid) TO service_role;


--
-- Name: FUNCTION admin_delete_session(p_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_delete_session(p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_delete_session(p_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.admin_delete_session(p_id uuid) TO service_role;


--
-- Name: FUNCTION admin_get_cms_page_row(p_page_key text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_get_cms_page_row(p_page_key text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_get_cms_page_row(p_page_key text) TO authenticated;
GRANT ALL ON FUNCTION public.admin_get_cms_page_row(p_page_key text) TO service_role;


--
-- Name: FUNCTION admin_hard_delete_session(p_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_hard_delete_session(p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_hard_delete_session(p_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.admin_hard_delete_session(p_id uuid) TO service_role;


--
-- Name: FUNCTION admin_list_booking_requests(p_show_all boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_list_booking_requests(p_show_all boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_list_booking_requests(p_show_all boolean) TO authenticated;
GRANT ALL ON FUNCTION public.admin_list_booking_requests(p_show_all boolean) TO service_role;


--
-- Name: FUNCTION admin_list_business_expenses_range(p_start date, p_end date); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_list_business_expenses_range(p_start date, p_end date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_list_business_expenses_range(p_start date, p_end date) TO authenticated;
GRANT ALL ON FUNCTION public.admin_list_business_expenses_range(p_start date, p_end date) TO service_role;


--
-- Name: FUNCTION admin_list_cms_page_content(p_category text, p_page_key_like text, p_limit integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_list_cms_page_content(p_category text, p_page_key_like text, p_limit integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_list_cms_page_content(p_category text, p_page_key_like text, p_limit integer) TO authenticated;
GRANT ALL ON FUNCTION public.admin_list_cms_page_content(p_category text, p_page_key_like text, p_limit integer) TO service_role;


--
-- Name: TABLE lesson_types; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.lesson_types TO service_role;
GRANT SELECT ON TABLE public.lesson_types TO anon;
GRANT SELECT ON TABLE public.lesson_types TO authenticated;


--
-- Name: FUNCTION admin_list_lesson_types(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_list_lesson_types() FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_list_lesson_types() TO authenticated;
GRANT ALL ON FUNCTION public.admin_list_lesson_types() TO service_role;


--
-- Name: TABLE media_assets; Type: ACL; Schema: public; Owner: -
--

GRANT MAINTAIN ON TABLE public.media_assets TO anon;
GRANT MAINTAIN ON TABLE public.media_assets TO authenticated;
GRANT ALL ON TABLE public.media_assets TO service_role;


--
-- Name: FUNCTION admin_list_media_assets(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_list_media_assets() FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_list_media_assets() TO authenticated;
GRANT ALL ON FUNCTION public.admin_list_media_assets() TO service_role;


--
-- Name: FUNCTION admin_list_media_assets_with_key(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_list_media_assets_with_key() FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_list_media_assets_with_key() TO authenticated;
GRANT ALL ON FUNCTION public.admin_list_media_assets_with_key() TO service_role;


--
-- Name: FUNCTION admin_list_media_slots_by_prefix(p_prefix text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_list_media_slots_by_prefix(p_prefix text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_list_media_slots_by_prefix(p_prefix text) TO authenticated;
GRANT ALL ON FUNCTION public.admin_list_media_slots_by_prefix(p_prefix text) TO service_role;


--
-- Name: FUNCTION admin_list_receipts_for_expense(p_expense_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_list_receipts_for_expense(p_expense_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_list_receipts_for_expense(p_expense_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.admin_list_receipts_for_expense(p_expense_id uuid) TO service_role;


--
-- Name: FUNCTION admin_list_sessions(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_list_sessions() FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_list_sessions() TO authenticated;
GRANT ALL ON FUNCTION public.admin_list_sessions() TO service_role;


--
-- Name: FUNCTION admin_list_sessions(include_deleted boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_list_sessions(include_deleted boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_list_sessions(include_deleted boolean) TO authenticated;
GRANT ALL ON FUNCTION public.admin_list_sessions(include_deleted boolean) TO service_role;


--
-- Name: FUNCTION admin_map_session_to_lesson_type(p_session_ids uuid[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_map_session_to_lesson_type(p_session_ids uuid[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_map_session_to_lesson_type(p_session_ids uuid[]) TO authenticated;
GRANT ALL ON FUNCTION public.admin_map_session_to_lesson_type(p_session_ids uuid[]) TO service_role;


--
-- Name: FUNCTION admin_publish_es(p_page_key text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_publish_es(p_page_key text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_publish_es(p_page_key text) TO authenticated;
GRANT ALL ON FUNCTION public.admin_publish_es(p_page_key text) TO service_role;


--
-- Name: FUNCTION admin_relocate_receipt(p_id uuid, p_expected_path text, p_new_path text, p_category public.finance_category); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_relocate_receipt(p_id uuid, p_expected_path text, p_new_path text, p_category public.finance_category) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_relocate_receipt(p_id uuid, p_expected_path text, p_new_path text, p_category public.finance_category) TO authenticated;
GRANT ALL ON FUNCTION public.admin_relocate_receipt(p_id uuid, p_expected_path text, p_new_path text, p_category public.finance_category) TO service_role;


--
-- Name: FUNCTION admin_replace_gallery_images(p_asset_ids uuid[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_replace_gallery_images(p_asset_ids uuid[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_replace_gallery_images(p_asset_ids uuid[]) TO authenticated;
GRANT ALL ON FUNCTION public.admin_replace_gallery_images(p_asset_ids uuid[]) TO service_role;


--
-- Name: FUNCTION admin_replace_gallery_images(p_count integer, p_asset_ids uuid[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_replace_gallery_images(p_count integer, p_asset_ids uuid[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_replace_gallery_images(p_count integer, p_asset_ids uuid[]) TO authenticated;
GRANT ALL ON FUNCTION public.admin_replace_gallery_images(p_count integer, p_asset_ids uuid[]) TO service_role;


--
-- Name: FUNCTION admin_restore_session(p_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_restore_session(p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_restore_session(p_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.admin_restore_session(p_id uuid) TO service_role;


--
-- Name: FUNCTION admin_save_content_bundle(p_strings jsonb, p_media jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_save_content_bundle(p_strings jsonb, p_media jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_save_content_bundle(p_strings jsonb, p_media jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.admin_save_content_bundle(p_strings jsonb, p_media jsonb) TO service_role;


--
-- Name: FUNCTION admin_save_media_asset(p_asset jsonb, p_slot_keys text[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_save_media_asset(p_asset jsonb, p_slot_keys text[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_save_media_asset(p_asset jsonb, p_slot_keys text[]) TO authenticated;
GRANT ALL ON FUNCTION public.admin_save_media_asset(p_asset jsonb, p_slot_keys text[]) TO service_role;


--
-- Name: FUNCTION admin_set_media_slot(p_slot_key text, p_asset_id uuid, p_sort integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_set_media_slot(p_slot_key text, p_asset_id uuid, p_sort integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_set_media_slot(p_slot_key text, p_asset_id uuid, p_sort integer) TO authenticated;
GRANT ALL ON FUNCTION public.admin_set_media_slot(p_slot_key text, p_asset_id uuid, p_sort integer) TO service_role;


--
-- Name: FUNCTION admin_update_booking_request(p_id uuid, p_patch jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_update_booking_request(p_id uuid, p_patch jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_update_booking_request(p_id uuid, p_patch jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.admin_update_booking_request(p_id uuid, p_patch jsonb) TO service_role;


--
-- Name: FUNCTION admin_update_booking_request_billing(p_id uuid, p_bill_total_cents integer, p_amount_paid_cents integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_update_booking_request_billing(p_id uuid, p_bill_total_cents integer, p_amount_paid_cents integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_update_booking_request_billing(p_id uuid, p_bill_total_cents integer, p_amount_paid_cents integer) TO authenticated;
GRANT ALL ON FUNCTION public.admin_update_booking_request_billing(p_id uuid, p_bill_total_cents integer, p_amount_paid_cents integer) TO service_role;


--
-- Name: FUNCTION admin_update_business_expense(p_id uuid, p_expense_date date, p_category public.finance_category, p_total_cents integer, p_vendor_name text, p_description text, p_payment_method public.payment_method, p_subtotal_cents integer, p_tax_cents integer, p_tip_cents integer, p_transaction_id text, p_is_refund boolean, p_parent_expense_id uuid, p_notes text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_update_business_expense(p_id uuid, p_expense_date date, p_category public.finance_category, p_total_cents integer, p_vendor_name text, p_description text, p_payment_method public.payment_method, p_subtotal_cents integer, p_tax_cents integer, p_tip_cents integer, p_transaction_id text, p_is_refund boolean, p_parent_expense_id uuid, p_notes text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_update_business_expense(p_id uuid, p_expense_date date, p_category public.finance_category, p_total_cents integer, p_vendor_name text, p_description text, p_payment_method public.payment_method, p_subtotal_cents integer, p_tax_cents integer, p_tip_cents integer, p_transaction_id text, p_is_refund boolean, p_parent_expense_id uuid, p_notes text) TO authenticated;
GRANT ALL ON FUNCTION public.admin_update_business_expense(p_id uuid, p_expense_date date, p_category public.finance_category, p_total_cents integer, p_vendor_name text, p_description text, p_payment_method public.payment_method, p_subtotal_cents integer, p_tax_cents integer, p_tip_cents integer, p_transaction_id text, p_is_refund boolean, p_parent_expense_id uuid, p_notes text) TO service_role;


--
-- Name: FUNCTION admin_update_lesson_type(p_key text, p_display_name text, p_description text, p_price_per_person_cents integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_update_lesson_type(p_key text, p_display_name text, p_description text, p_price_per_person_cents integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_update_lesson_type(p_key text, p_display_name text, p_description text, p_price_per_person_cents integer) TO authenticated;
GRANT ALL ON FUNCTION public.admin_update_lesson_type(p_key text, p_display_name text, p_description text, p_price_per_person_cents integer) TO service_role;


--
-- Name: FUNCTION admin_update_receipt(p_id uuid, p_receipt_date date, p_category public.finance_category, p_total_cents integer, p_receipt_storage_path text, p_vendor_name text, p_description text, p_payment_method public.payment_method, p_subtotal_cents integer, p_tax_cents integer, p_tip_cents integer, p_transaction_id text, p_is_refund boolean, p_parent_receipt_id uuid, p_source_type text, p_notes text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_update_receipt(p_id uuid, p_receipt_date date, p_category public.finance_category, p_total_cents integer, p_receipt_storage_path text, p_vendor_name text, p_description text, p_payment_method public.payment_method, p_subtotal_cents integer, p_tax_cents integer, p_tip_cents integer, p_transaction_id text, p_is_refund boolean, p_parent_receipt_id uuid, p_source_type text, p_notes text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_update_receipt(p_id uuid, p_receipt_date date, p_category public.finance_category, p_total_cents integer, p_receipt_storage_path text, p_vendor_name text, p_description text, p_payment_method public.payment_method, p_subtotal_cents integer, p_tax_cents integer, p_tip_cents integer, p_transaction_id text, p_is_refund boolean, p_parent_receipt_id uuid, p_source_type text, p_notes text) TO authenticated;
GRANT ALL ON FUNCTION public.admin_update_receipt(p_id uuid, p_receipt_date date, p_category public.finance_category, p_total_cents integer, p_receipt_storage_path text, p_vendor_name text, p_description text, p_payment_method public.payment_method, p_subtotal_cents integer, p_tax_cents integer, p_tip_cents integer, p_transaction_id text, p_is_refund boolean, p_parent_receipt_id uuid, p_source_type text, p_notes text) TO service_role;


--
-- Name: FUNCTION admin_update_session(p_id uuid, p_session_time timestamp with time zone, p_group_size integer, p_client_names text[], p_lesson_status public.lesson_status, p_paid numeric, p_tip numeric, p_lesson_type_key text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_update_session(p_id uuid, p_session_time timestamp with time zone, p_group_size integer, p_client_names text[], p_lesson_status public.lesson_status, p_paid numeric, p_tip numeric, p_lesson_type_key text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_update_session(p_id uuid, p_session_time timestamp with time zone, p_group_size integer, p_client_names text[], p_lesson_status public.lesson_status, p_paid numeric, p_tip numeric, p_lesson_type_key text) TO authenticated;
GRANT ALL ON FUNCTION public.admin_update_session(p_id uuid, p_session_time timestamp with time zone, p_group_size integer, p_client_names text[], p_lesson_status public.lesson_status, p_paid numeric, p_tip numeric, p_lesson_type_key text) TO service_role;


--
-- Name: FUNCTION admin_update_session_v2(p_session_id uuid, p_lesson_status text, p_session_time timestamp with time zone, p_paid numeric, p_tip numeric, p_bill_total numeric, p_notes text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_update_session_v2(p_session_id uuid, p_lesson_status text, p_session_time timestamp with time zone, p_paid numeric, p_tip numeric, p_bill_total numeric, p_notes text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_update_session_v2(p_session_id uuid, p_lesson_status text, p_session_time timestamp with time zone, p_paid numeric, p_tip numeric, p_bill_total numeric, p_notes text) TO authenticated;
GRANT ALL ON FUNCTION public.admin_update_session_v2(p_session_id uuid, p_lesson_status text, p_session_time timestamp with time zone, p_paid numeric, p_tip numeric, p_bill_total numeric, p_notes text) TO service_role;


--
-- Name: FUNCTION admin_upsert_media_asset(p_bucket text, p_path text, p_title text, p_public boolean, p_category public.photo_category, p_asset_type public.asset_type, p_description text, p_session_id uuid, p_sort smallint, p_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_upsert_media_asset(p_bucket text, p_path text, p_title text, p_public boolean, p_category public.photo_category, p_asset_type public.asset_type, p_description text, p_session_id uuid, p_sort smallint, p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_upsert_media_asset(p_bucket text, p_path text, p_title text, p_public boolean, p_category public.photo_category, p_asset_type public.asset_type, p_description text, p_session_id uuid, p_sort smallint, p_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.admin_upsert_media_asset(p_bucket text, p_path text, p_title text, p_public boolean, p_category public.photo_category, p_asset_type public.asset_type, p_description text, p_session_id uuid, p_sort smallint, p_id uuid) TO service_role;


--
-- Name: FUNCTION admin_upsert_media_asset(p_bucket text, p_path text, p_title text, p_public boolean, p_category public.photo_category, p_asset_type public.asset_type, p_description text, p_session_id uuid, p_sort smallint, p_id uuid, p_asset_key text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_upsert_media_asset(p_bucket text, p_path text, p_title text, p_public boolean, p_category public.photo_category, p_asset_type public.asset_type, p_description text, p_session_id uuid, p_sort smallint, p_id uuid, p_asset_key text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_upsert_media_asset(p_bucket text, p_path text, p_title text, p_public boolean, p_category public.photo_category, p_asset_type public.asset_type, p_description text, p_session_id uuid, p_sort smallint, p_id uuid, p_asset_key text) TO authenticated;
GRANT ALL ON FUNCTION public.admin_upsert_media_asset(p_bucket text, p_path text, p_title text, p_public boolean, p_category public.photo_category, p_asset_type public.asset_type, p_description text, p_session_id uuid, p_sort smallint, p_id uuid, p_asset_key text) TO service_role;


--
-- Name: FUNCTION admin_upsert_page_content(p_page_key text, p_body_en text, p_body_es_draft text, p_body_es_published text, p_approved boolean, p_sort smallint, p_category text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_upsert_page_content(p_page_key text, p_body_en text, p_body_es_draft text, p_body_es_published text, p_approved boolean, p_sort smallint, p_category text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_upsert_page_content(p_page_key text, p_body_en text, p_body_es_draft text, p_body_es_published text, p_approved boolean, p_sort smallint, p_category text) TO authenticated;
GRANT ALL ON FUNCTION public.admin_upsert_page_content(p_page_key text, p_body_en text, p_body_es_draft text, p_body_es_published text, p_approved boolean, p_sort smallint, p_category text) TO service_role;


--
-- Name: TABLE booking_notifications; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.booking_notifications TO service_role;


--
-- Name: FUNCTION claim_booking_notifications(p_booking_id uuid, p_limit integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.claim_booking_notifications(p_booking_id uuid, p_limit integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.claim_booking_notifications(p_booking_id uuid, p_limit integer) TO service_role;


--
-- Name: FUNCTION complete_booking_notification(p_id uuid, p_lease_token uuid, p_provider_id text, p_error text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.complete_booking_notification(p_id uuid, p_lease_token uuid, p_provider_id text, p_error text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.complete_booking_notification(p_id uuid, p_lease_token uuid, p_provider_id text, p_error text) TO service_role;


--
-- Name: FUNCTION compute_booking_request_bill_total_cents(p_lesson_type_key text, p_party_size integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.compute_booking_request_bill_total_cents(p_lesson_type_key text, p_party_size integer) TO anon;
GRANT ALL ON FUNCTION public.compute_booking_request_bill_total_cents(p_lesson_type_key text, p_party_size integer) TO authenticated;
GRANT ALL ON FUNCTION public.compute_booking_request_bill_total_cents(p_lesson_type_key text, p_party_size integer) TO service_role;


--
-- Name: FUNCTION configure_booking_email_worker(p_url text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.configure_booking_email_worker(p_url text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.configure_booking_email_worker(p_url text) TO service_role;


--
-- Name: FUNCTION get_page_content(p_page_key text, p_locale text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_page_content(p_page_key text, p_locale text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_page_content(p_page_key text, p_locale text) TO anon;
GRANT ALL ON FUNCTION public.get_page_content(p_page_key text, p_locale text) TO authenticated;
GRANT ALL ON FUNCTION public.get_page_content(p_page_key text, p_locale text) TO service_role;


--
-- Name: FUNCTION get_page_content_by_prefix(p_prefix text, p_locale text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_page_content_by_prefix(p_prefix text, p_locale text) TO anon;
GRANT ALL ON FUNCTION public.get_page_content_by_prefix(p_prefix text, p_locale text) TO authenticated;
GRANT ALL ON FUNCTION public.get_page_content_by_prefix(p_prefix text, p_locale text) TO service_role;


--
-- Name: FUNCTION get_public_media_asset_by_key(p_slot_key text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_public_media_asset_by_key(p_slot_key text) TO anon;
GRANT ALL ON FUNCTION public.get_public_media_asset_by_key(p_slot_key text) TO authenticated;
GRANT ALL ON FUNCTION public.get_public_media_asset_by_key(p_slot_key text) TO service_role;


--
-- Name: FUNCTION get_public_media_assets(p_category public.photo_category); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_public_media_assets(p_category public.photo_category) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_public_media_assets(p_category public.photo_category) TO anon;
GRANT ALL ON FUNCTION public.get_public_media_assets(p_category public.photo_category) TO authenticated;
GRANT ALL ON FUNCTION public.get_public_media_assets(p_category public.photo_category) TO service_role;


--
-- Name: FUNCTION get_public_media_assets_by_prefix(p_prefix text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_public_media_assets_by_prefix(p_prefix text) TO anon;
GRANT ALL ON FUNCTION public.get_public_media_assets_by_prefix(p_prefix text) TO authenticated;
GRANT ALL ON FUNCTION public.get_public_media_assets_by_prefix(p_prefix text) TO service_role;


--
-- Name: FUNCTION get_public_sessions(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_public_sessions() FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_public_sessions() TO service_role;


--
-- Name: FUNCTION is_admin(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_admin() TO anon;
GRANT ALL ON FUNCTION public.is_admin() TO authenticated;
GRANT ALL ON FUNCTION public.is_admin() TO service_role;


--
-- Name: FUNCTION is_site_admin(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_site_admin() TO anon;
GRANT ALL ON FUNCTION public.is_site_admin() TO authenticated;
GRANT ALL ON FUNCTION public.is_site_admin() TO service_role;


--
-- Name: FUNCTION is_valid_json(p_text text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_valid_json(p_text text) TO anon;
GRANT ALL ON FUNCTION public.is_valid_json(p_text text) TO authenticated;
GRANT ALL ON FUNCTION public.is_valid_json(p_text text) TO service_role;


--
-- Name: FUNCTION rpc_create_page_section(p_page_key text, p_kind text, p_sort integer, p_status text, p_anchor text, p_meta jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.rpc_create_page_section(p_page_key text, p_kind text, p_sort integer, p_status text, p_anchor text, p_meta jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.rpc_create_page_section(p_page_key text, p_kind text, p_sort integer, p_status text, p_anchor text, p_meta jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.rpc_create_page_section(p_page_key text, p_kind text, p_sort integer, p_status text, p_anchor text, p_meta jsonb) TO service_role;


--
-- Name: FUNCTION rpc_delete_page_section(p_page_key text, p_section_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.rpc_delete_page_section(p_page_key text, p_section_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.rpc_delete_page_section(p_page_key text, p_section_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.rpc_delete_page_section(p_page_key text, p_section_id uuid) TO service_role;


--
-- Name: FUNCTION rpc_get_page_sections(p_page_key text, p_include_drafts boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.rpc_get_page_sections(p_page_key text, p_include_drafts boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.rpc_get_page_sections(p_page_key text, p_include_drafts boolean) TO anon;
GRANT ALL ON FUNCTION public.rpc_get_page_sections(p_page_key text, p_include_drafts boolean) TO authenticated;
GRANT ALL ON FUNCTION public.rpc_get_page_sections(p_page_key text, p_include_drafts boolean) TO service_role;


--
-- Name: FUNCTION rpc_upsert_page_sections(p_page_key text, p_sections jsonb, p_prune_missing boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.rpc_upsert_page_sections(p_page_key text, p_sections jsonb, p_prune_missing boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.rpc_upsert_page_sections(p_page_key text, p_sections jsonb, p_prune_missing boolean) TO authenticated;
GRANT ALL ON FUNCTION public.rpc_upsert_page_sections(p_page_key text, p_sections jsonb, p_prune_missing boolean) TO service_role;


--
-- Name: FUNCTION set_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_updated_at() TO anon;
GRANT ALL ON FUNCTION public.set_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.set_updated_at() TO service_role;


--
-- Name: FUNCTION submit_booking_request(p_payload jsonb, p_payload_hash text, p_rate_key text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.submit_booking_request(p_payload jsonb, p_payload_hash text, p_rate_key text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.submit_booking_request(p_payload jsonb, p_payload_hash text, p_rate_key text) TO service_role;


--
-- Name: FUNCTION sync_booking_request_session(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.sync_booking_request_session() FROM PUBLIC;
GRANT ALL ON FUNCTION public.sync_booking_request_session() TO service_role;


--
-- Name: FUNCTION sync_media_assets_from_storage(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.sync_media_assets_from_storage() FROM PUBLIC;
GRANT ALL ON FUNCTION public.sync_media_assets_from_storage() TO service_role;


--
-- Name: FUNCTION trg_booking_requests_set_bill_total(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trg_booking_requests_set_bill_total() TO anon;
GRANT ALL ON FUNCTION public.trg_booking_requests_set_bill_total() TO authenticated;
GRANT ALL ON FUNCTION public.trg_booking_requests_set_bill_total() TO service_role;


--
-- Name: FUNCTION verify_booking_worker_secret(p_token text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.verify_booking_worker_secret(p_token text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.verify_booking_worker_secret(p_token text) TO service_role;


--
-- Name: TABLE admin_users; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,MAINTAIN ON TABLE public.admin_users TO anon;
GRANT SELECT,MAINTAIN ON TABLE public.admin_users TO authenticated;
GRANT ALL ON TABLE public.admin_users TO service_role;


--
-- Name: TABLE booking_request_rate_limits; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.booking_request_rate_limits TO service_role;


--
-- Name: TABLE cms_page_content; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.cms_page_content TO service_role;
GRANT SELECT ON TABLE public.cms_page_content TO anon;
GRANT SELECT ON TABLE public.cms_page_content TO authenticated;


--
-- Name: TABLE media_slots; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.media_slots TO anon;
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.media_slots TO authenticated;
GRANT ALL ON TABLE public.media_slots TO service_role;


--
-- Name: TABLE page_sections; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.page_sections TO anon;
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public.page_sections TO authenticated;
GRANT ALL ON TABLE public.page_sections TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--

