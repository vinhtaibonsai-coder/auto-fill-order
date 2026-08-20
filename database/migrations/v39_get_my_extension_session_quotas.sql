-- =========================================================================
-- v39_get_my_extension_session_quotas.sql
-- Cập nhật hàm get_my_extension_session để tự động đăng ký/cập nhật thiết bị,
-- kiểm tra giới hạn số lượng thiết bị (max_devices) của shop.
-- =========================================================================

-- Xóa tất cả các overload cũ nếu có để tránh lỗi "function name is not unique"
DROP FUNCTION IF EXISTS public.get_my_extension_session();
DROP FUNCTION IF EXISTS public.get_my_extension_session(UUID);
DROP FUNCTION IF EXISTS public.get_my_extension_session(UUID, TEXT);
DROP FUNCTION IF EXISTS public.get_my_extension_session(UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.get_my_extension_session(
  p_shop_id UUID DEFAULT NULL,
  p_device_id TEXT DEFAULT NULL,
  p_device_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_shop_id UUID;
  v_result  JSONB;
  v_max_devices INT := 5;
  v_is_allowed BOOLEAN := true;
  v_device_limit_exceeded BOOLEAN := false;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'UNAUTHENTICATED');
  END IF;

  -- 1. Xác định shop_id
  IF p_shop_id IS NOT NULL THEN
    v_shop_id := p_shop_id;
  ELSE
    SELECT sm.shop_id INTO v_shop_id
    FROM shop_members sm
    WHERE sm.user_id = v_user_id
      AND sm.status  = 'active'
      AND sm.removed_at IS NULL
    ORDER BY sm.joined_at ASC
    LIMIT 1;
  END IF;

  -- 2. Đăng ký/cập nhật thông tin thiết bị và last_seen nếu có p_device_id
  IF p_device_id IS NOT NULL AND v_shop_id IS NOT NULL THEN
    INSERT INTO public.extension_devices (user_id, device_id, device_name, browser, last_seen, revoked)
    VALUES (v_user_id, p_device_id, COALESCE(p_device_name, 'Chrome Extension'), 'Chrome', now(), false)
    ON CONFLICT (user_id, device_id)
    DO UPDATE SET 
      device_name = COALESCE(p_device_name, public.extension_devices.device_name),
      last_seen = now(),
      browser = 'Chrome';
  END IF;

  -- 3. Xử lý trường hợp không thuộc shop nào (chỉ hệ thống admin được truy cập)
  IF v_shop_id IS NULL THEN
    IF EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = v_user_id AND r.code = 'SYSTEM_ADMIN'
    ) THEN
      RETURN jsonb_build_object(
        'role',                  'SYSTEM_ADMIN',
        'shop_id',               NULL,
        'shop_name',             'System',
        'status',                'active',
        'permissions',           '["*"]'::JSONB,
        'features', jsonb_build_object(
          'ai_parsing_enabled',      true,
          'smart_address_enabled',   true,
          'vnpost_autofill_enabled', true,
          'jt_autofill_enabled',     true
        ),
        'max_devices',           999,
        'max_users',             999,
        'monthly_order_limit',   999999,
        'custom_prompt_rules',   '',
        'device_limit_exceeded', false
      );
    END IF;
    RETURN jsonb_build_object('error', 'NOT_IN_ANY_SHOP');
  END IF;

  -- 4. Đọc giới hạn max_devices của shop
  SELECT COALESCE(sq.max_devices, 5) INTO v_max_devices
  FROM public.shop_quotas sq
  WHERE sq.shop_id = v_shop_id;

  -- 5. Kiểm tra giới hạn thiết bị hoạt động thực tế (dựa trên last_seen DESC)
  IF p_device_id IS NOT NULL THEN
    -- Nếu thiết bị đã bị đánh dấu revoked = true
    IF EXISTS (
      SELECT 1 FROM public.extension_devices 
      WHERE user_id = v_user_id AND device_id = p_device_id AND revoked = true
    ) THEN
      v_device_limit_exceeded := true;
    ELSE
      -- Xếp hạng các thiết bị hoạt động của shop để chỉ cho phép top max_devices thiết bị hoạt động gần nhất
      WITH ranked_devices AS (
        SELECT d.device_id,
               ROW_NUMBER() OVER (ORDER BY d.last_seen DESC) as rank
        FROM public.extension_devices d
        JOIN public.shop_members sm ON sm.user_id = d.user_id
        WHERE sm.shop_id = v_shop_id
          AND sm.status = 'active'
          AND sm.removed_at IS NULL
          AND d.revoked = false
      )
      SELECT EXISTS (
        SELECT 1 FROM ranked_devices 
        WHERE device_id = p_device_id AND rank <= v_max_devices
      ) INTO v_is_allowed;
      
      IF NOT v_is_allowed THEN
        v_device_limit_exceeded := true;
      END IF;
    END IF;
  END IF;

  -- 6. Trả về cấu hình chi tiết
  SELECT jsonb_build_object(
    'shop_id',               sm.shop_id,
    'shop_name',             s.name,
    'role',                  r.code,
    'status',                sm.status,
    'permissions',           COALESCE(sm.permissions, '[]'::JSONB),
    'features', jsonb_build_object(
      'ai_parsing_enabled',      COALESCE(ff.ai_parsing_enabled, true),
      'smart_address_enabled',   COALESCE(ff.smart_address_enabled, true),
      'vnpost_autofill_enabled', COALESCE(ff.vnpost_autofill_enabled, true),
      'jt_autofill_enabled',     COALESCE(ff.jt_autofill_enabled, true)
    ),
    'member_id',             sm.id,
    'joined_at',             sm.joined_at,
    'max_devices',           v_max_devices,
    'max_users',             COALESCE(sq.max_users, 5),
    'monthly_order_limit',   COALESCE(sq.monthly_order_limit, 5000),
    'custom_prompt_rules',   COALESCE(ff.custom_prompt_rules, ''),
    'device_limit_exceeded', v_device_limit_exceeded
  ) INTO v_result
  FROM shop_members sm
  JOIN roles r ON r.id = sm.role_id
  JOIN shops s ON s.id = sm.shop_id
  LEFT JOIN shop_feature_flags ff ON ff.shop_id = sm.shop_id
  LEFT JOIN shop_quotas sq ON sq.shop_id = sm.shop_id
  WHERE sm.user_id    = v_user_id
    AND sm.shop_id    = v_shop_id
    AND sm.status     = 'active'
    AND sm.removed_at IS NULL;

  IF v_result IS NULL THEN
    RETURN jsonb_build_object('error', 'NOT_MEMBER_OF_SHOP');
  END IF;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_extension_session(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_extension_session(UUID, TEXT, TEXT) TO service_role;

COMMENT ON FUNCTION public.get_my_extension_session IS 'Lấy cấu hình chi tiết, phân quyền RBAC và hạn ngạch thiết bị extension dựa theo shop.';
