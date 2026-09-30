-- ============================================================================
-- v80: Device management V2
--
-- Goals:
--   * fix owner_get_members_v3 (submitted_orders uses submitted_by, not user_id)
--   * replace destructive browser-side device DELETE with audited revocation
--   * keep Member, Device, Session and Order attribution separate
--
-- Apply this migration after a read-only schema preflight on the target project.
-- It is intentionally independent from RUN_ALL_MIGRATIONS.sql.
-- ============================================================================

-- 1. Revocation/audit fields. ADD COLUMN IF NOT EXISTS keeps this migration
-- safe on projects that already applied part of v77.
ALTER TABLE public.extension_devices
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revoked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS revoke_reason TEXT,
  ADD COLUMN IF NOT EXISTS retired_at TIMESTAMPTZ;

ALTER TABLE public.shop_members
  ADD COLUMN IF NOT EXISTS removed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS removal_reason TEXT;

-- These attribution columns were introduced by v65/v75. Re-declare them here
-- so the corrective RPC contract remains deployable on partially migrated
-- projects without recreating historical orders.
ALTER TABLE public.submitted_orders
  ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_device_id TEXT;

CREATE INDEX IF NOT EXISTS idx_extension_devices_shop_status
  ON public.extension_devices(shop_id, status, last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_submitted_orders_source_device
  ON public.submitted_orders(shop_id, source_device_id, submitted_by);

-- Device sessions are deliberately not linked by a database FK to device_id:
-- older installations use different device_id types. Store only a hash.
CREATE TABLE IF NOT EXISTS public.device_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  session_hash TEXT NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (shop_id, device_id, session_hash)
);

CREATE INDEX IF NOT EXISTS idx_device_sessions_active
  ON public.device_sessions(shop_id, device_id, revoked_at, expires_at);

ALTER TABLE public.device_sessions ENABLE ROW LEVEL SECURITY;

-- 2. Corrected member list RPC.
-- v65 returned TABLE while v77 attempted JSONB; drop the old signature so the
-- contract is unambiguous and PostgREST cannot select the wrong overload.
DROP FUNCTION IF EXISTS public.owner_get_members_v3(UUID);

CREATE FUNCTION public.owner_get_members_v3(p_shop_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT public.is_shop_owner_or_manager(p_shop_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'Không có quyền truy cập shop này.');
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', sm.id,
      'member_id', sm.id,
      'user_id', sm.user_id,
      'email', COALESCE(p.email, 'Chưa có email'),
      'full_name', COALESCE(NULLIF(p.full_name, ''), p.email, 'Thành viên'),
      'role_code', COALESCE(sm.role, 'STAFF'),
      'role', COALESCE(sm.role, 'STAFF'),
      'status', COALESCE(sm.status, 'active'),
      'joined_at', sm.created_at,
      'created_at', sm.created_at,
      'orders_count', (
        SELECT COUNT(*)
        FROM public.submitted_orders so
        WHERE so.shop_id = p_shop_id
          AND so.submitted_by = sm.user_id
          AND so.deleted_at IS NULL
      )
    )
    ORDER BY CASE UPPER(COALESCE(sm.role, 'STAFF'))
      WHEN 'OWNER' THEN 1
      WHEN 'SHOP_OWNER' THEN 1
      WHEN 'MANAGER' THEN 2
      WHEN 'SHOP_MANAGER' THEN 2
      WHEN 'STAFF' THEN 3
      WHEN 'SHOP_STAFF' THEN 3
      ELSE 4
    END, sm.created_at ASC
  ), '[]'::jsonb)
  INTO v_result
  FROM public.shop_members sm
  LEFT JOIN public.profiles p ON p.id = sm.user_id
  WHERE sm.shop_id = p_shop_id
    AND sm.removed_at IS NULL;

  RETURN jsonb_build_object('success', true, 'members', v_result);
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_get_members_v3(UUID) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.owner_get_members_v3(UUID) FROM anon;

-- 3. Device list/KPI RPC with strict order attribution. Never infer ownership
-- from staff_name or a display label. Device-level counts use the immutable
-- source_device_id only; submitted_by remains the member-level attribution.
CREATE OR REPLACE FUNCTION public.owner_get_shop_staff_and_devices(p_shop_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT public.is_shop_owner_or_manager(p_shop_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'Access denied.');
  END IF;

  WITH device_stats AS (
    SELECT
      d.id, d.device_id, d.device_name,
      COALESCE(d.staff_name, 'Staff') AS staff_name,
      d.browser, d.os_info, d.last_ip, d.last_seen,
      COALESCE(d.status, CASE WHEN COALESCE(d.revoked, false) THEN 'revoked' ELSE 'active' END) AS status,
      COALESCE(d.revoked, false) AS revoked, d.created_at,
      COUNT(so.id) AS orders_count,
      COALESCE(SUM(so.cod_amount), 0) AS total_cod,
      MAX(so.submitted_at) AS last_order_at
    FROM public.extension_devices d
    LEFT JOIN public.submitted_orders so
      ON so.shop_id = p_shop_id
      AND so.deleted_at IS NULL
      AND so.source_device_id IS NOT NULL
      AND so.source_device_id = d.device_id
    WHERE d.shop_id = p_shop_id
    GROUP BY d.id, d.device_id, d.device_name, d.staff_name, d.browser, d.os_info,
      d.last_ip, d.last_seen, d.status, d.revoked, d.created_at
    ORDER BY d.last_seen DESC NULLS LAST, d.created_at DESC
  )
  SELECT jsonb_agg(jsonb_build_object(
    'id', id, 'device_id', device_id, 'device_name', device_name,
    'staff_name', staff_name, 'browser', browser, 'os_info', os_info,
    'last_ip', last_ip, 'last_seen', last_seen, 'status', status,
    'revoked', revoked, 'created_at', created_at, 'orders_count', orders_count,
    'total_cod', total_cod, 'last_order_at', last_order_at
  )) INTO v_result
  FROM device_stats;

  RETURN jsonb_build_object('success', true, 'staff_devices', COALESCE(v_result, '[]'::jsonb));
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_get_shop_staff_and_devices(UUID) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.owner_get_shop_staff_and_devices(UUID) FROM anon;

-- 4. Idempotent device revoke. This is the only normal UI path for removing
-- access; the row remains for audit and order attribution.
DROP FUNCTION IF EXISTS public.owner_revoke_device(UUID, TEXT, TEXT);
CREATE FUNCTION public.owner_revoke_device(
  p_shop_id UUID,
  p_device_id TEXT,
  p_reason TEXT DEFAULT 'MANUAL_REVOCATION'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_row RECORD;
  v_changed BOOLEAN := false;
  v_session_count INTEGER := 0;
  v_audit_id UUID;
BEGIN
  IF NOT public.is_shop_owner_or_manager(p_shop_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'Không có quyền thu hồi thiết bị.');
  END IF;

  SELECT * INTO v_row
  FROM public.extension_devices
  WHERE shop_id = p_shop_id
    AND (device_id = p_device_id OR id::text = p_device_id)
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_row IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND', 'message', 'Không tìm thấy thiết bị trong shop.');
  END IF;

  IF COALESCE(v_row.revoked, false) = false OR COALESCE(v_row.status, '') <> 'revoked' THEN
    UPDATE public.extension_devices
    SET status = 'revoked',
        revoked = true,
        revoked_at = COALESCE(revoked_at, now()),
        revoked_by = auth.uid(),
        revoke_reason = COALESCE(NULLIF(trim(p_reason), ''), 'MANUAL_REVOCATION'),
        updated_at = now()
    WHERE id = v_row.id;
    v_changed := true;
  END IF;

  UPDATE public.device_sessions
  SET revoked_at = COALESCE(revoked_at, now()), revoked_by = auth.uid()
  WHERE shop_id = p_shop_id AND device_id = COALESCE(v_row.device_id, p_device_id) AND revoked_at IS NULL;
  GET DIAGNOSTICS v_session_count = ROW_COUNT;

  INSERT INTO public.audit_logs (shop_id, user_id, action, entity_type, entity_id, details)
  VALUES (
    p_shop_id, auth.uid(), 'DEVICE_REVOKED', 'device', v_row.id::text,
    jsonb_build_object(
      'device_id', v_row.device_id,
      'device_name', v_row.device_name,
      'staff_name', v_row.staff_name,
      'reason', COALESCE(NULLIF(trim(p_reason), ''), 'MANUAL_REVOCATION'),
      'idempotent_repeat', NOT v_changed
    )
  ) RETURNING id INTO v_audit_id;

  RETURN jsonb_build_object(
    'success', true,
    'changed', v_changed,
    'status', 'revoked',
    'device_id', v_row.device_id,
    'affected_device_id', v_row.device_id,
    'session_count', v_session_count,
    'audit_id', v_audit_id,
    'message', CASE WHEN v_changed THEN 'Đã thu hồi thiết bị.' ELSE 'Thiết bị đã được thu hồi trước đó.' END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_revoke_device(UUID, TEXT, TEXT) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.owner_revoke_device(UUID, TEXT, TEXT) FROM anon;

-- 5. Explicit restore. Restoring never changes historical orders.
DROP FUNCTION IF EXISTS public.owner_restore_device(UUID, TEXT, TEXT);
CREATE FUNCTION public.owner_restore_device(
  p_shop_id UUID,
  p_device_id TEXT,
  p_reason TEXT DEFAULT 'MANUAL_RESTORE'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_row RECORD;
BEGIN
  IF NOT public.is_shop_owner_or_manager(p_shop_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'Không có quyền khôi phục thiết bị.');
  END IF;

  UPDATE public.extension_devices
  SET status = 'active', revoked = false, revoked_at = NULL, revoked_by = NULL,
      revoke_reason = NULL, last_seen = now(), updated_at = now()
  WHERE shop_id = p_shop_id AND (device_id = p_device_id OR id::text = p_device_id)
  RETURNING * INTO v_row;

  IF v_row IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND', 'message', 'Không tìm thấy thiết bị trong shop.');
  END IF;

  INSERT INTO public.audit_logs (shop_id, user_id, action, entity_type, entity_id, details)
  VALUES (p_shop_id, auth.uid(), 'DEVICE_RESTORED', 'device', v_row.id::text,
    jsonb_build_object('device_id', v_row.device_id, 'reason', p_reason));

  RETURN jsonb_build_object('success', true, 'status', 'active', 'device_id', v_row.device_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_restore_device(UUID, TEXT, TEXT) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.owner_restore_device(UUID, TEXT, TEXT) FROM anon;

-- 6. Atomic member removal: revoke all of the member's devices, then soft
-- remove the membership. Owners cannot be removed by this operation.
DROP FUNCTION IF EXISTS public.owner_remove_shop_member(UUID, UUID, TEXT, BOOLEAN);
CREATE FUNCTION public.owner_remove_shop_member(
  p_shop_id UUID,
  p_user_id UUID,
  p_reason TEXT DEFAULT 'MEMBER_REMOVED',
  p_revoke_devices BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_member RECORD;
  v_devices INTEGER := 0;
BEGIN
  IF NOT public.is_shop_owner_or_manager(p_shop_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'Không có quyền gỡ thành viên.');
  END IF;

  SELECT * INTO v_member
  FROM public.shop_members
  WHERE shop_id = p_shop_id AND user_id = p_user_id AND removed_at IS NULL
  FOR UPDATE;

  IF v_member IS NULL THEN
    RETURN jsonb_build_object('success', true, 'changed', false, 'message', 'Thành viên đã được gỡ trước đó.');
  END IF;

  IF UPPER(COALESCE(v_member.role, 'STAFF')) IN ('OWNER', 'SHOP_OWNER') THEN
    RETURN jsonb_build_object('success', false, 'error', 'OWNER_PROTECTED', 'message', 'Không thể gỡ Chủ Shop.');
  END IF;

  IF p_revoke_devices THEN
    UPDATE public.extension_devices
    SET status = 'revoked', revoked = true, revoked_at = COALESCE(revoked_at, now()),
        revoked_by = auth.uid(), revoke_reason = COALESCE(NULLIF(trim(p_reason), ''), 'MEMBER_REMOVED'),
        updated_at = now()
    WHERE shop_id = p_shop_id AND user_id = p_user_id AND COALESCE(revoked, false) = false;
    GET DIAGNOSTICS v_devices = ROW_COUNT;

    UPDATE public.device_sessions ds
    SET revoked_at = COALESCE(ds.revoked_at, now()), revoked_by = auth.uid()
    WHERE ds.shop_id = p_shop_id
      AND ds.revoked_at IS NULL
      AND EXISTS (
        SELECT 1 FROM public.extension_devices ed
        WHERE ed.shop_id = p_shop_id AND ed.user_id = p_user_id AND ed.device_id = ds.device_id
      );
  END IF;

  UPDATE public.shop_members
  SET removed_at = now(), removed_by = auth.uid(),
      removal_reason = COALESCE(NULLIF(trim(p_reason), ''), 'MEMBER_REMOVED'),
      status = 'removed', updated_at = now()
  WHERE id = v_member.id;

  INSERT INTO public.audit_logs (shop_id, user_id, action, entity_type, entity_id, details)
  VALUES (p_shop_id, auth.uid(), 'SHOP_MEMBER_REMOVED', 'shop_member', v_member.id::text,
    jsonb_build_object('target_user_id', p_user_id, 'revoked_devices', v_devices, 'reason', p_reason));

  RETURN jsonb_build_object('success', true, 'changed', true, 'revoked_devices', v_devices);
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_remove_shop_member(UUID, UUID, TEXT, BOOLEAN) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.owner_remove_shop_member(UUID, UUID, TEXT, BOOLEAN) FROM anon;

-- 7. Keep the existing runtime signature (device_id first, shop_id second),
-- but make the result explicit for missing/revoked devices.
DROP FUNCTION IF EXISTS public.check_device_session_validity(TEXT, UUID);
CREATE FUNCTION public.check_device_session_validity(
  p_device_id TEXT,
  p_shop_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_dev RECORD;
BEGIN
  SELECT id, device_id, status, revoked, staff_name
  INTO v_dev
  FROM public.extension_devices
  WHERE shop_id = p_shop_id AND (device_id = p_device_id OR id::text = p_device_id)
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_dev IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'status', 'unknown', 'revoked', false, 'retryable', false,
      'message', 'Thiết bị chưa được đăng ký trong Shop này.');
  END IF;

  IF COALESCE(v_dev.revoked, false) OR lower(COALESCE(v_dev.status, '')) IN ('revoked', 'blocked', 'suspended') THEN
    RETURN jsonb_build_object('valid', false, 'status', 'revoked', 'revoked', true,
      'message', 'Thiết bị này đã bị Chủ Shop thu hồi quyền.');
  END IF;

  RETURN jsonb_build_object('valid', true, 'status', 'active', 'revoked', false);
END;
$$;

-- Shop-key activated extensions use the anon PostgREST role (the shop key is
-- validated inside verify_shop_access_key, not represented as a JWT role).
-- Keep this narrow, read-only validity endpoint callable by anon so a revoked
-- device can still be killed remotely; it returns no profile or order data.
GRANT EXECUTE ON FUNCTION public.check_device_session_validity(TEXT, UUID) TO authenticated, anon, service_role;
