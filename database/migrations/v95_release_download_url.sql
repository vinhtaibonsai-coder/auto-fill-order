-- ============================================================================
-- Migration v95: Release Versions Download URL & Admin Publish OTA Release RPC
-- ============================================================================

-- 1. Add download_url column to release_versions if not exists
ALTER TABLE public.release_versions ADD COLUMN IF NOT EXISTS download_url TEXT;

-- 2. Drop legacy function signature to avoid overload ambiguity
DROP FUNCTION IF EXISTS public.admin_publish_release(TEXT, TEXT, BOOLEAN, INT, TEXT);
DROP FUNCTION IF EXISTS public.admin_publish_release(TEXT, TEXT, BOOLEAN, INT, TEXT, TEXT);

-- 3. Recreate admin_publish_release with download_url support
CREATE OR REPLACE FUNCTION public.admin_publish_release(
  p_version TEXT,
  p_min_supported_version TEXT,
  p_force_update BOOLEAN,
  p_rollout_percentage INT,
  p_release_notes TEXT,
  p_download_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'ACCESS_DENIED';
  END IF;

  IF NULLIF(trim(p_version), '') IS NULL OR p_rollout_percentage NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'INVALID_RELEASE';
  END IF;

  INSERT INTO public.release_versions (
    version,
    min_supported_version,
    is_force_update,
    rollout_percentage,
    release_notes,
    download_url
  )
  VALUES (
    trim(p_version),
    NULLIF(trim(p_min_supported_version), ''),
    COALESCE(p_force_update, false),
    p_rollout_percentage,
    p_release_notes,
    NULLIF(trim(p_download_url), '')
  )
  ON CONFLICT (version) DO UPDATE SET
    min_supported_version = EXCLUDED.min_supported_version,
    is_force_update = EXCLUDED.is_force_update,
    rollout_percentage = EXCLUDED.rollout_percentage,
    release_notes = EXCLUDED.release_notes,
    download_url = COALESCE(EXCLUDED.download_url, public.release_versions.download_url)
  RETURNING id INTO v_id;

  PERFORM public.insert_audit_log(
    'ADMIN_PUBLISH_RELEASE',
    'release',
    v_id::text,
    jsonb_build_object(
      'version', p_version,
      'rollout', p_rollout_percentage,
      'force_update', p_force_update,
      'download_url', p_download_url
    ),
    NULL
  );

  RETURN jsonb_build_object('success', true, 'id', v_id);
END;
$$;

-- 4. Restore permissions
GRANT EXECUTE ON FUNCTION public.admin_publish_release(TEXT, TEXT, BOOLEAN, INT, TEXT, TEXT) TO authenticated;
