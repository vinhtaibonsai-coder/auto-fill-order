-- =============================================================================
-- Migration v86: Fix Multi-Profile Workstation & Device Sync, Deduplication, and RLS
--
-- Goals:
--   1. Allow Shop Owners & Managers to SELECT/UPDATE/DELETE all extension_devices in their shop.
--   2. Deduplicate extension_devices by (shop_id, device_id) so the same physical device/profile
--      is never counted multiple times or split across different user IDs in the same shop.
--   3. Enhance owner_get_shop_staff_and_devices & owner_get_devices_v2 to return accurate
--      user_email, user_full_name, staff_name, and member_role.
--   4. Update register_extension_device to upsert by (shop_id, device_id).
--   5. Provide enhanced owner_cleanup_inactive_devices RPC for 1-Click test profile cleanup.
-- =============================================================================

-- 1. Deduplicate existing extension_devices (keep only the latest row per shop_id + device_id)
WITH ranked_devices AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY shop_id, device_id 
           ORDER BY last_seen DESC NULLS LAST, created_at DESC
         ) AS rank_num
  FROM public.extension_devices
  WHERE shop_id IS NOT NULL AND device_id IS NOT NULL
)
DELETE FROM public.extension_devices
WHERE id IN (
  SELECT id FROM ranked_devices WHERE rank_num > 1
);

-- 2. Đảm bảo Index tối ưu cho (shop_id, device_id)
CREATE INDEX IF NOT EXISTS idx_ext_dev_shop_device_v86
  ON public.extension_devices(shop_id, device_id);

-- 3. Cập nhật RLS Policies trên extension_devices
ALTER TABLE public.extension_devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own devices" ON public.extension_devices;
DROP POLICY IF EXISTS "Users and Shop Owners can read devices" ON public.extension_devices;
CREATE POLICY "Users and Shop Owners can read devices" ON public.extension_devices
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR (shop_id IS NOT NULL AND public.is_shop_owner_or_manager(shop_id))
  OR public.is_system_admin()
);

DROP POLICY IF EXISTS "Users can insert own devices" ON public.extension_devices;
DROP POLICY IF EXISTS "Users and Shop Members can insert devices" ON public.extension_devices;
CREATE POLICY "Users and Shop Members can insert devices" ON public.extension_devices
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR (shop_id IS NOT NULL AND public.is_shop_owner_or_manager(shop_id))
  OR public.is_system_admin()
);

DROP POLICY IF EXISTS "Users can update own devices" ON public.extension_devices;
DROP POLICY IF EXISTS "Users and Shop Owners can update devices" ON public.extension_devices;
CREATE POLICY "Users and Shop Owners can update devices" ON public.extension_devices
FOR UPDATE TO authenticated
USING (
  user_id = auth.uid()
  OR (shop_id IS NOT NULL AND public.is_shop_owner_or_manager(shop_id))
  OR public.is_system_admin()
)
WITH CHECK (
  user_id = auth.uid()
  OR (shop_id IS NOT NULL AND public.is_shop_owner_or_manager(shop_id))
  OR public.is_system_admin()
);

DROP POLICY IF EXISTS "Shop owners can delete devices" ON public.extension_devices;
DROP POLICY IF EXISTS "Users and Shop Owners can delete devices" ON public.extension_devices;
CREATE POLICY "Users and Shop Owners can delete devices" ON public.extension_devices
FOR DELETE TO authenticated
USING (
  user_id = auth.uid()
  OR (shop_id IS NOT NULL AND public.is_shop_owner_or_manager(shop_id))
  OR public.is_system_admin()
);

-- 4. Cập nhật RPC register_extension_device (Upsert thông minh theo Shop & Device ID)
CREATE OR REPLACE FUNCTION public.register_extension_device(
    p_device_id TEXT,
    p_device_name TEXT,
    p_browser TEXT,
    p_os_info TEXT,
    p_client_version TEXT,
    p_fingerprint_hash TEXT,
    p_shop_id UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, auth
AS $$
DECLARE 
    v_user UUID := auth.uid();
    v_active INT;
    v_limit INT;
    v_existing public.extension_devices%ROWTYPE;
    v_target_shop UUID := p_shop_id;
    v_clean_device_id TEXT := TRIM(COALESCE(p_device_id, ''));
    v_user_full_name TEXT;
    v_user_email TEXT;
    v_staff_name TEXT;
    v_is_owner BOOLEAN := false;
BEGIN
    IF v_user IS NULL THEN 
        RAISE EXCEPTION 'AUTH_REQUIRED'; 
    END IF;
    IF v_clean_device_id = '' THEN 
        RAISE EXCEPTION 'DEVICE_IDENTITY_REQUIRED'; 
    END IF;

    -- Tìm Shop liên kết với user nếu chưa truyền
    IF v_target_shop IS NULL THEN
        SELECT shop_id INTO v_target_shop 
        FROM public.shop_members 
        WHERE user_id = v_user AND removed_at IS NULL 
        ORDER BY created_at ASC
        LIMIT 1;
    END IF;

    -- Lấy thông tin profile người dùng
    SELECT full_name, email INTO v_user_full_name, v_user_email
    FROM public.profiles
    WHERE id = v_user
    LIMIT 1;

    -- Kiểm tra xem user có phải là Chủ Shop không
    IF v_target_shop IS NOT NULL THEN
        SELECT (owner_id = v_user) INTO v_is_owner
        FROM public.shops
        WHERE id = v_target_shop;
    END IF;

    v_staff_name := COALESCE(
        NULLIF(TRIM(p_metadata->>'staff_name'), ''),
        NULLIF(TRIM(v_user_full_name), ''),
        NULLIF(TRIM(v_user_email), ''),
        'Nhân viên'
    );

    -- Tìm thiết bị đã đăng ký trước đó trong Shop (hoặc theo user_id)
    IF v_target_shop IS NOT NULL THEN
        SELECT * INTO v_existing 
        FROM public.extension_devices 
        WHERE shop_id = v_target_shop AND device_id = v_clean_device_id
        LIMIT 1;
    ELSE
        SELECT * INTO v_existing 
        FROM public.extension_devices 
        WHERE user_id = v_user AND device_id = v_clean_device_id
        LIMIT 1;
    END IF;

    -- Đếm số lượng máy active và quota
    IF v_target_shop IS NOT NULL THEN
        SELECT COUNT(*) INTO v_active 
        FROM public.extension_devices 
        WHERE shop_id = v_target_shop AND COALESCE(revoked, false) = false AND status = 'active';

        SELECT COALESCE(s.max_devices, q.max_devices, 5) INTO v_limit 
        FROM public.shops sh
        LEFT JOIN public.subscriptions s ON s.shop_id = sh.id
        LEFT JOIN public.shop_quotas q ON q.shop_id = sh.id
        WHERE sh.id = v_target_shop
        LIMIT 1;
    ELSE
        SELECT count(*) INTO v_active 
        FROM public.extension_devices 
        WHERE user_id = v_user AND COALESCE(revoked, false) = false AND status = 'active';

        v_limit := 5;
    END IF;

    v_limit := COALESCE(v_limit, 5);

    -- Nếu là thiết bị đã có trong shop -> Cập nhật lại thông tin người dùng đang hoạt động
    IF v_existing.id IS NOT NULL THEN
        UPDATE public.extension_devices
        SET user_id = v_user,
            device_name = COALESCE(NULLIF(TRIM(p_device_name), ''), v_existing.device_name, 'Máy trạm lên đơn'),
            staff_name = COALESCE(v_staff_name, v_existing.staff_name),
            browser = COALESCE(p_browser, v_existing.browser),
            os_info = COALESCE(p_os_info, v_existing.os_info),
            client_version = COALESCE(p_client_version, v_existing.client_version),
            version = COALESCE(p_client_version, v_existing.version),
            fingerprint_hash = COALESCE(p_fingerprint_hash, v_existing.fingerprint_hash),
            shop_id = COALESCE(v_target_shop, v_existing.shop_id),
            metadata = COALESCE(p_metadata, v_existing.metadata),
            status = 'active',
            revoked = false,
            last_seen = now(),
            updated_at = now()
        WHERE id = v_existing.id;

        RETURN jsonb_build_object(
            'success', true, 
            'active_devices', v_active, 
            'max_devices', v_limit,
            'device_id', v_clean_device_id,
            'updated', true
        );
    END IF;

    -- Nếu là thiết bị mới và đã vượt hạn mức (không áp dụng chặn nếu là Chủ Shop)
    IF NOT v_is_owner AND v_active >= v_limit THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', 'DEVICE_LIMIT_EXCEEDED', 
            'message', 'Đã vượt quá số lượng thiết bị cho phép theo gói cước (' || v_active || '/' || v_limit || ').', 
            'active_devices', v_active, 
            'max_devices', v_limit
        );
    END IF;

    -- Thêm mới thiết bị
    INSERT INTO public.extension_devices (
        user_id, device_id, device_name, staff_name, browser, os_info, 
        client_version, version, fingerprint_hash, shop_id, metadata, 
        last_seen, revoked, approved, status, is_owner_device, created_at, updated_at
    )
    VALUES (
        v_user, v_clean_device_id, LEFT(TRIM(COALESCE(p_device_name, 'Máy trạm lên đơn')), 100),
        v_staff_name, p_browser, p_os_info, 
        p_client_version, p_client_version, p_fingerprint_hash, v_target_shop, p_metadata, 
        now(), false, true, 'active', v_is_owner, now(), now()
    );

    RETURN jsonb_build_object(
        'success', true, 
        'active_devices', v_active + 1, 
        'max_devices', v_limit,
        'device_id', v_clean_device_id,
        'created', true
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_extension_device(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,UUID,JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_extension_device(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,UUID,JSONB) TO service_role;

-- 5. Cập nhật RPC owner_get_shop_staff_and_devices trả về dữ liệu Toàn Shop chính xác
CREATE OR REPLACE FUNCTION public.owner_get_shop_staff_and_devices(p_shop_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT (public.is_shop_owner_or_manager(p_shop_id) OR public.is_system_admin()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'Không có quyền truy cập thông tin đội ngũ của shop.');
  END IF;

  WITH device_stats AS (
    SELECT
      d.id,
      d.device_id,
      d.device_name,
      COALESCE(NULLIF(d.staff_name, ''), p.full_name, p.email, 'Nhân viên') AS staff_name,
      d.browser,
      d.os_info,
      COALESCE(d.last_ip, d.ip_address, '127.0.0.1') AS last_ip,
      d.last_seen,
      COALESCE(d.status, CASE WHEN COALESCE(d.revoked, false) THEN 'revoked' ELSE 'active' END) AS status,
      COALESCE(d.revoked, false) AS revoked,
      d.created_at,
      d.user_id,
      p.email AS user_email,
      p.full_name AS user_full_name,
      COALESCE(sm.role, CASE WHEN s.owner_id = d.user_id THEN 'OWNER' ELSE 'STAFF' END) AS member_role,
      (s.owner_id = d.user_id OR COALESCE(d.is_owner_device, false) OR sm.role IN ('OWNER', 'SHOP_OWNER')) AS is_owner_device,
      d.metadata,
      COUNT(so.id) AS orders_count,
      COALESCE(SUM(so.cod_amount), 0) AS total_cod,
      MAX(so.submitted_at) AS last_order_at
    FROM public.extension_devices d
    LEFT JOIN public.shops s ON s.id = p_shop_id
    LEFT JOIN public.profiles p ON p.id = d.user_id
    LEFT JOIN public.shop_members sm ON sm.user_id = d.user_id AND sm.shop_id = p_shop_id AND sm.removed_at IS NULL
    LEFT JOIN public.submitted_orders so
      ON so.shop_id = p_shop_id
      AND so.deleted_at IS NULL
      AND so.source_device_id IS NOT NULL
      AND so.source_device_id = d.device_id
    WHERE d.shop_id = p_shop_id
    GROUP BY d.id, d.device_id, d.device_name, d.staff_name, p.full_name, p.email,
             sm.role, s.owner_id, d.is_owner_device, d.browser, d.os_info,
             d.last_ip, d.ip_address, d.last_seen, d.status, d.revoked, d.created_at, d.user_id, d.metadata
    ORDER BY d.last_seen DESC NULLS LAST, d.created_at DESC
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id,
    'device_id', device_id,
    'device_name', device_name,
    'staff_name', staff_name,
    'browser', browser,
    'os_info', os_info,
    'last_ip', last_ip,
    'last_seen', last_seen,
    'status', status,
    'revoked', revoked,
    'created_at', created_at,
    'user_id', user_id,
    'user_email', user_email,
    'user_full_name', user_full_name,
    'member_role', member_role,
    'is_owner_device', is_owner_device,
    'metadata', metadata,
    'orders_count', orders_count,
    'total_cod', total_cod,
    'last_order_at', last_order_at
  )), '[]'::jsonb) INTO v_result
  FROM device_stats;

  RETURN jsonb_build_object('success', true, 'staff_devices', v_result);
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_get_shop_staff_and_devices(UUID) TO authenticated, service_role;

-- 6. Cập nhật RPC owner_get_devices_v2 & owner_get_devices_v3 đồng bộ
CREATE OR REPLACE FUNCTION public.owner_get_devices_v2(p_shop_id UUID)
RETURNS JSONB 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, auth 
AS $$
DECLARE 
    v_devices JSONB; 
    v_max INT;
BEGIN
    IF NOT (public.is_shop_owner_or_manager(p_shop_id) OR public.is_system_admin()) THEN 
        RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'Không có quyền quản lý thiết bị.');
    END IF;

    SELECT COALESCE(s.max_devices, q.max_devices, 5) INTO v_max 
    FROM public.shops sh
    LEFT JOIN public.subscriptions s ON s.shop_id = sh.id
    LEFT JOIN public.shop_quotas q ON q.shop_id = sh.id
    WHERE sh.id = p_shop_id 
    LIMIT 1;

    SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.last_seen DESC NULLS LAST), '[]'::jsonb) INTO v_devices 
    FROM (
        SELECT 
            d.id,
            d.device_id,
            d.device_name,
            COALESCE(NULLIF(d.staff_name, ''), p.full_name, p.email, 'Nhân viên') AS staff_name,
            COALESCE(d.browser, 'Google Chrome') AS browser,
            COALESCE(d.client_version, d.version, 'v2.4 Pro') AS client_version,
            COALESCE(d.os_info, 'Windows') AS os_info,
            COALESCE(d.ip_address, d.last_ip, '127.0.0.1') AS last_ip,
            COALESCE(d.last_location, 'Việt Nam') AS last_location,
            d.last_seen,
            COALESCE(d.status, CASE WHEN COALESCE(d.revoked, false) THEN 'revoked' ELSE 'active' END) AS status,
            COALESCE(d.revoked, false) AS revoked,
            d.user_id,
            p.email AS user_email,
            COALESCE(p.email, '—') AS email,
            COALESCE(p.full_name, d.staff_name, 'Nhân viên') AS full_name,
            COALESCE(sm.role, CASE WHEN s.owner_id = d.user_id THEN 'OWNER' ELSE 'STAFF' END) AS role,
            (s.owner_id = d.user_id OR COALESCE(d.is_owner_device, false) OR sm.role IN ('OWNER', 'SHOP_OWNER')) AS is_owner_device,
            COALESCE(d.metadata, '{}'::jsonb) AS metadata
        FROM public.extension_devices d 
        LEFT JOIN public.shops s ON s.id = p_shop_id
        LEFT JOIN public.shop_members sm ON sm.user_id = d.user_id AND sm.shop_id = p_shop_id AND sm.removed_at IS NULL
        LEFT JOIN public.profiles p ON p.id = d.user_id
        WHERE d.shop_id = p_shop_id
    ) t;

    RETURN jsonb_build_object('success', true, 'devices', v_devices, 'max_devices', COALESCE(v_max, 5));
END; 
$$;

GRANT EXECUTE ON FUNCTION public.owner_get_devices_v2(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.owner_get_devices_v3(p_shop_id UUID, p_filter_status TEXT DEFAULT 'ALL')
RETURNS JSONB 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, auth 
AS $$
DECLARE
    v_res JSONB;
    v_shop RECORD;
    v_quota RECORD;
BEGIN
    IF NOT (public.is_shop_owner_or_manager(p_shop_id) OR public.is_system_admin()) THEN 
        RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'Không có quyền quản lý thiết bị.');
    END IF;

    SELECT id, name, shop_code, auto_approve_devices INTO v_shop FROM public.shops WHERE id = p_shop_id;
    SELECT max_devices INTO v_quota FROM public.shop_quotas WHERE shop_id = p_shop_id;

    v_res := public.owner_get_devices_v2(p_shop_id);

    RETURN jsonb_build_object(
        'success', true,
        'devices', COALESCE(v_res->'devices', '[]'::jsonb),
        'shop', row_to_json(v_shop),
        'quota', jsonb_build_object('max_devices', COALESCE(v_quota.max_devices, 5))
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_get_devices_v3(UUID, TEXT) TO authenticated, service_role;

-- 7. Cập nhật RPC Dọn dẹp máy trạm / profile rác (1-Click) thông minh
CREATE OR REPLACE FUNCTION public.owner_cleanup_inactive_devices(p_shop_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_cleaned INT := 0;
  v_dup_cleaned INT := 0;
BEGIN
  IF NOT (public.is_shop_owner_or_manager(p_shop_id) OR public.is_system_admin()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'Không có quyền thực hiện dọn dẹp.');
  END IF;

  -- 1. Xóa các dòng trùng lặp device_id trong cùng Shop (giữ lại 1 dòng mới nhất)
  WITH ranked_dups AS (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY shop_id, device_id 
             ORDER BY last_seen DESC NULLS LAST, created_at DESC
           ) AS rank_num
    FROM public.extension_devices
    WHERE shop_id = p_shop_id AND device_id IS NOT NULL
  ),
  deleted_dups AS (
    DELETE FROM public.extension_devices
    WHERE id IN (SELECT id FROM ranked_dups WHERE rank_num > 1)
    RETURNING id
  )
  SELECT COUNT(*) INTO v_dup_cleaned FROM deleted_dups;

  -- 2. Xóa các profile thử nghiệm bị khóa (revoked) hoặc offline > 24h mà không có đơn hàng
  WITH deleted_inactive AS (
    DELETE FROM public.extension_devices d
    WHERE d.shop_id = p_shop_id
      AND (
        d.revoked = true 
        OR d.status = 'revoked'
        OR (
          COALESCE(d.last_seen, d.created_at) < (now() - INTERVAL '24 hours')
          AND NOT EXISTS (
            SELECT 1 FROM public.submitted_orders so 
            WHERE so.shop_id = p_shop_id 
              AND (so.source_device_id = d.device_id OR so.source_device_id = d.id::text)
          )
        )
      )
    RETURNING id
  )
  SELECT COUNT(*) INTO v_cleaned FROM deleted_inactive;

  v_cleaned := v_cleaned + v_dup_cleaned;

  RETURN jsonb_build_object(
    'success', true, 
    'cleaned_count', v_cleaned, 
    'message', CASE 
      WHEN v_cleaned > 0 THEN 'Đã dọn dẹp thành công ' || v_cleaned || ' máy trạm/profile thử nghiệm và hợp nhất trùng lặp.'
      ELSE 'Không có thiết bị rác nào cần dọn dẹp. Hệ thống đã tối ưu.'
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_cleanup_inactive_devices(UUID) TO authenticated, service_role;
