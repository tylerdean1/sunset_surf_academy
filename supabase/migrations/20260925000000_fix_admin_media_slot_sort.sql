-- The media_slots.sort column is smallint, while this RPC promises integer.
-- PL/pgSQL RETURN QUERY requires an exact result type match.
CREATE OR REPLACE FUNCTION public.admin_list_media_slots_by_prefix(p_prefix text)
RETURNS TABLE (
  slot_key text,
  sort integer,
  asset_id uuid,
  asset_title text,
  asset_bucket text,
  asset_path text,
  asset_public boolean,
  asset_type public.asset_type,
  asset_category public.photo_category
)
LANGUAGE plpgsql
SECURITY DEFINER
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
