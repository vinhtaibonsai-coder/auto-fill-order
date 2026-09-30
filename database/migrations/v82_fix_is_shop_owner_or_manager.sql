-- =============================================================================
-- Migration v82: Clean Canonical RPCs & Eliminate Overload Ambiguity
-- =============================================================================

-- 1. XOÁ TOÀN BỘ CÁC CHỮ KÝ TRÙNG LẶP GÂY LỖI "is not unique"
DROP FUNCTION IF EXISTS public.is_shop_owner_or_manager(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.is_shop_owner_or_manager(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.is_system_admin(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.is_system_admin() CASCADE;

-- 2. ĐỊNH NGHĨA CHUẨN: is_system_admin
CREATE OR REPLACE FUNCTION public.is_system_admin(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = COALESCE(p_user_id, auth.uid()) 
      AND r.code = 'SYSTEM_ADMIN'
  ) OR EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = COALESCE(p_user_id, auth.uid()) 
      AND u.email = 'admin@luathuysinh.vn'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_system_admin(UUID) TO authenticated, anon, service_role;

-- 3. ĐỊNH NGHĨA DUY NHẤT: is_shop_owner_or_manager
CREATE OR REPLACE FUNCTION public.is_shop_owner_or_manager(p_shop_id UUID, p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT (
    public.is_system_admin(COALESCE(p_user_id, auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.id = p_shop_id AND s.owner_id = COALESCE(p_user_id, auth.uid())
    )
    OR EXISTS (
      SELECT 1
      FROM public.shop_members sm
      WHERE sm.shop_id = p_shop_id
        AND sm.user_id = COALESCE(p_user_id, auth.uid())
        AND UPPER(COALESCE(sm.role, 'STAFF')) IN ('OWNER', 'SHOP_OWNER', 'MANAGER', 'SHOP_MANAGER', 'ADMIN')
        AND COALESCE(sm.status, 'active') = 'active'
        AND sm.removed_at IS NULL
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_shop_owner_or_manager(UUID, UUID) TO authenticated, anon, service_role;

-- 4. RPC TẢI DANH SÁCH THIẾT BỊ
DROP FUNCTION IF EXISTS public.owner_get_devices_v2(UUID);
CREATE OR REPLACE FUNCTION public.owner_get_devices_v2(p_shop_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_devices JSONB;
BEGIN
  IF NOT (public.is_shop_owner_or_manager(p_shop_id) OR public.is_system_admin()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'Không có quyền xem thiết bị của shop.');
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'extension_devices') THEN
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', d.id,
        'device_id', d.device_id,
        'device_name', d.device_name,
        'staff_name', COALESCE(d.staff_name, 'Nhân viên kho'),
        'browser', d.browser,
        'os_info', d.os_info,
        'last_ip', d.last_ip,
        'last_seen', d.last_seen,
        'status', COALESCE(d.status, CASE WHEN COALESCE(d.revoked, false) THEN 'revoked' ELSE 'active' END),
        'revoked', COALESCE(d.revoked, false),
        'created_at', d.created_at
      ) ORDER BY d.last_seen DESC NULLS LAST, d.created_at DESC
    ), '[]'::jsonb) INTO v_devices
    FROM public.extension_devices d
    WHERE d.shop_id = p_shop_id;
  ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shop_staff_devices') THEN
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', d.id,
        'device_id', d.device_id,
        'device_name', d.device_name,
        'staff_name', COALESCE(d.staff_name, 'Nhân viên kho'),
        'browser', d.browser,
        'os_info', d.os_info,
        'last_ip', d.last_ip,
        'last_seen', d.last_seen,
        'status', COALESCE(d.status, CASE WHEN COALESCE(d.revoked, false) THEN 'revoked' ELSE 'active' END),
        'revoked', COALESCE(d.revoked, false),
        'created_at', d.created_at
      ) ORDER BY d.last_seen DESC NULLS LAST, d.created_at DESC
    ), '[]'::jsonb) INTO v_devices
    FROM public.shop_staff_devices d
    WHERE d.shop_id = p_shop_id;
  ELSE
    v_devices := '[]'::jsonb;
  END IF;

  RETURN jsonb_build_object('success', true, 'devices', COALESCE(v_devices, '[]'::jsonb));
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_get_devices_v2(UUID) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.owner_get_devices_v2(UUID) FROM anon;

-- 5. RPC XÓA / THU HỒI MÁY TRẠM
DROP FUNCTION IF EXISTS public.owner_revoke_device(UUID, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.owner_revoke_device(
  p_shop_id UUID,
  p_device_id TEXT,
  p_reason TEXT DEFAULT 'MANUAL_DEVICE_REVOCATION'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_found BOOLEAN := false;
BEGIN
  IF NOT (public.is_shop_owner_or_manager(p_shop_id) OR public.is_system_admin()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'Không có quyền thu hồi thiết bị.');
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'extension_devices') THEN
    UPDATE public.extension_devices
    SET status = 'revoked', revoked = true, revoked_at = now(), revoked_by = auth.uid(),
        revoke_reason = COALESCE(NULLIF(trim(p_reason), ''), 'MANUAL_DEVICE_REVOCATION'),
        updated_at = now()
    WHERE shop_id = p_shop_id AND (device_id = p_device_id OR id::text = p_device_id);
    IF FOUND THEN v_found := true; END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shop_staff_devices') THEN
    UPDATE public.shop_staff_devices
    SET status = 'revoked', revoked = true, updated_at = now()
    WHERE shop_id = p_shop_id AND (device_id = p_device_id OR id::text = p_device_id);
    IF FOUND THEN v_found := true; END IF;
  END IF;

  RETURN jsonb_build_object('success', true, 'status', 'revoked', 'device_id', p_device_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_revoke_device(UUID, TEXT, TEXT) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.owner_revoke_device(UUID, TEXT, TEXT) FROM anon;

-- 6. RPC MỞ KHÓA MÁY TRẠM
DROP FUNCTION IF EXISTS public.owner_restore_device(UUID, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.owner_restore_device(
  p_shop_id UUID,
  p_device_id TEXT,
  p_reason TEXT DEFAULT 'MANUAL_RESTORE'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT (public.is_shop_owner_or_manager(p_shop_id) OR public.is_system_admin()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'Không có quyền khôi phục thiết bị.');
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'extension_devices') THEN
    UPDATE public.extension_devices
    SET status = 'active', revoked = false, revoked_at = NULL, revoked_by = NULL,
        revoke_reason = NULL, last_seen = now(), updated_at = now()
    WHERE shop_id = p_shop_id AND (device_id = p_device_id OR id::text = p_device_id);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shop_staff_devices') THEN
    UPDATE public.shop_staff_devices
    SET status = 'active', revoked = false, updated_at = now()
    WHERE shop_id = p_shop_id AND (device_id = p_device_id OR id::text = p_device_id);
  END IF;

  RETURN jsonb_build_object('success', true, 'status', 'active', 'device_id', p_device_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_restore_device(UUID, TEXT, TEXT) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.owner_restore_device(UUID, TEXT, TEXT) FROM anon;

-- 7. RPC CẬP NHẬT TÊN NHÂN VIÊN / TÊN MÁY TRẠM
DROP FUNCTION IF EXISTS public.owner_update_staff_device(UUID, TEXT, TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.owner_update_staff_device(
  p_shop_id UUID,
  p_device_id TEXT,
  p_staff_name TEXT DEFAULT NULL,
  p_device_name TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_found BOOLEAN := false;
BEGIN
  IF NOT (public.is_shop_owner_or_manager(p_shop_id) OR public.is_system_admin()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'Không có quyền cập nhật thiết bị.');
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'extension_devices') THEN
    UPDATE public.extension_devices
    SET staff_name = COALESCE(NULLIF(TRIM(p_staff_name), ''), staff_name),
        device_name = COALESCE(NULLIF(TRIM(p_device_name), ''), device_name),
        status = COALESCE(NULLIF(TRIM(p_status), ''), status),
        revoked = CASE WHEN p_status = 'active' THEN false WHEN p_status = 'revoked' THEN true ELSE revoked END,
        updated_at = now()
    WHERE shop_id = p_shop_id AND (device_id = p_device_id OR id::text = p_device_id);
    IF FOUND THEN v_found := true; END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shop_staff_devices') THEN
    UPDATE public.shop_staff_devices
    SET staff_name = COALESCE(NULLIF(TRIM(p_staff_name), ''), staff_name),
        device_name = COALESCE(NULLIF(TRIM(p_device_name), ''), device_name),
        status = COALESCE(NULLIF(TRIM(p_status), ''), status),
        revoked = CASE WHEN p_status = 'active' THEN false WHEN p_status = 'revoked' THEN true ELSE revoked END,
        updated_at = now()
    WHERE shop_id = p_shop_id AND (device_id = p_device_id OR id::text = p_device_id);
    IF FOUND THEN v_found := true; END IF;
  END IF;

  RETURN jsonb_build_object('success', true, 'updated', v_found);
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_update_staff_device(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.owner_update_staff_device(UUID, TEXT, TEXT, TEXT, TEXT) FROM anon;

-- 8. RPC THÀNH VIÊN ĐỘI NGŨ
DROP FUNCTION IF EXISTS public.owner_get_members_v3(UUID);
CREATE OR REPLACE FUNCTION public.owner_get_members_v3(p_shop_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT (public.is_shop_owner_or_manager(p_shop_id) OR public.is_system_admin()) THEN
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

NOTIFY pgrst, 'reload schema';
