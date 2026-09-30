-- =============================================================================
-- Migration: v77_fix_extension_devices_user_id_nullable.sql
-- Mục đích: Cho phép user_id trong extension_devices là NULL (dành cho Nhân viên dùng Shop Access Key)
--           và tối ưu hàm RPC verify_shop_access_key
-- =============================================================================

-- 1. Cho phép user_id là NULL trong bảng extension_devices
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'extension_devices' 
      AND column_name = 'user_id' 
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.extension_devices ALTER COLUMN user_id DROP NOT NULL;
  END IF;
END $$;

-- 2. Bổ sung các cột cần thiết nếu chưa có
ALTER TABLE public.extension_devices ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE;
ALTER TABLE public.extension_devices ADD COLUMN IF NOT EXISTS staff_name TEXT;
ALTER TABLE public.extension_devices ADD COLUMN IF NOT EXISTS device_id TEXT;
ALTER TABLE public.extension_devices ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE public.extension_devices ADD COLUMN IF NOT EXISTS browser TEXT;
ALTER TABLE public.extension_devices ADD COLUMN IF NOT EXISTS os_info TEXT;
ALTER TABLE public.extension_devices ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.extension_devices ADD COLUMN IF NOT EXISTS revoked BOOLEAN DEFAULT false;

-- 3. Đảm bảo Index định danh theo (shop_id, device_id)
CREATE INDEX IF NOT EXISTS idx_extension_devices_shop_device_id ON public.extension_devices(shop_id, device_id);

-- 4. Cập nhật hoàn chỉnh RPC verify_shop_access_key
CREATE OR REPLACE FUNCTION public.verify_shop_access_key(
  p_access_key TEXT,
  p_device_id TEXT,
  p_device_name TEXT DEFAULT NULL,
  p_staff_name TEXT DEFAULT NULL,
  p_browser TEXT DEFAULT 'Chrome',
  p_os_info TEXT DEFAULT 'Windows'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_shop RECORD;
  v_quota RECORD;
  v_clean_key TEXT := UPPER(TRIM(p_access_key));
  v_clean_device_id TEXT := TRIM(COALESCE(p_device_id, 'dev_unknown'));
  v_clean_staff_name TEXT := TRIM(COALESCE(p_staff_name, 'Nhân viên kho'));
  v_clean_device_name TEXT := TRIM(COALESCE(p_device_name, v_clean_staff_name));
  v_existing_id UUID;
BEGIN
  IF v_clean_key IS NULL OR v_clean_key = '' THEN
    RETURN jsonb_build_object('success', false, 'code', 'KEY_REQUIRED', 'message', 'Vui lòng nhập mã Shop Access Key.');
  END IF;

  -- 1. Tìm thông tin Shop & Chủ shop
  SELECT id, name, status, owner_id INTO v_shop
  FROM public.shops
  WHERE UPPER(shop_access_key) = v_clean_key
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_KEY', 'message', 'Mã Shop Key không chính xác hoặc đã bị đổi.');
  END IF;

  IF v_shop.status = 'suspended' OR v_shop.status = 'inactive' THEN
    RETURN jsonb_build_object('success', false, 'code', 'SHOP_INACTIVE', 'message', 'Cửa hàng đang tạm khóa.');
  END IF;

  -- 2. Đăng ký hoặc cập nhật máy trạm trong extension_devices
  SELECT id INTO v_existing_id 
  FROM public.extension_devices 
  WHERE shop_id = v_shop.id AND device_id = v_clean_device_id
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    UPDATE public.extension_devices
    SET 
      user_id = COALESCE(user_id, v_shop.owner_id),
      device_name = v_clean_device_name,
      staff_name = v_clean_staff_name,
      last_seen = now(),
      browser = p_browser,
      os_info = p_os_info,
      revoked = false,
      status = 'active'
    WHERE id = v_existing_id;
  ELSE
    INSERT INTO public.extension_devices (
      shop_id,
      user_id,
      device_id,
      device_name,
      staff_name,
      browser,
      os_info,
      last_seen,
      revoked,
      status
    )
    VALUES (
      v_shop.id,
      v_shop.owner_id, -- gán owner_id dự phòng an toàn
      v_clean_device_id,
      v_clean_device_name,
      v_clean_staff_name,
      p_browser,
      p_os_info,
      now(),
      false,
      'active'
    );
  END IF;

  -- 3. Lấy thông tin hạn mức (shop_quotas)
  INSERT INTO public.shop_quotas (shop_id, max_devices, max_users, monthly_order_limit, daily_ai_limit, monthly_ai_limit)
  VALUES (v_shop.id, 5, 5, 1000, 500, 10000)
  ON CONFLICT (shop_id) DO NOTHING;

  -- Reset cửa sổ nếu có hàm _ai_refresh_monthly_window
  BEGIN
    PERFORM _ai_refresh_monthly_window(v_shop.id);
  EXCEPTION WHEN OTHERS THEN
    -- Bỏ qua nếu hàm không tồn tại
  END;

  SELECT 
    daily_ai_limit,
    CASE WHEN daily_reset_at::date <> CURRENT_DATE THEN 0 ELSE daily_ai_used END as daily_ai_used,
    monthly_ai_limit,
    monthly_ai_used
  INTO v_quota
  FROM public.shop_quotas
  WHERE shop_id = v_shop.id;

  RETURN jsonb_build_object(
    'success', true,
    'shop_id', v_shop.id,
    'shop_name', v_shop.name,
    'shop_access_key', v_clean_key,
    'staff_name', v_clean_staff_name,
    'device_id', v_clean_device_id,
    'daily_limit', COALESCE(v_quota.daily_ai_limit, 500),
    'daily_used', COALESCE(v_quota.daily_ai_used, 0),
    'monthly_limit', COALESCE(v_quota.monthly_ai_limit, 10000),
    'monthly_used', COALESCE(v_quota.monthly_ai_used, 0)
  );
END;
$$;

-- 5. Cấp quyền thực thi
GRANT EXECUTE ON FUNCTION public.verify_shop_access_key(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.verify_shop_access_key(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_shop_access_key(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;

-- 6. RPC: owner_get_members_v3 — Lấy danh sách thành viên Email quản trị kèm thông tin Profile
CREATE OR REPLACE FUNCTION public.owner_get_members_v3(p_shop_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT public.check_shop_member_or_admin(p_shop_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'Không có quyền truy cập shop này.');
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', sm.id,
      'member_id', sm.id,
      'user_id', p.id,
      'email', COALESCE(p.email, 'Chưa có email'),
      'full_name', COALESCE(p.full_name, p.email, 'Thành viên'),
      'role_code', COALESCE(sm.role, 'STAFF'),
      'role', COALESCE(sm.role, 'STAFF'),
      'status', COALESCE(sm.status, 'active'),
      'joined_at', sm.created_at,
      'created_at', sm.created_at,
      'orders_count', (
        SELECT COUNT(*) 
        FROM public.submitted_orders so 
        WHERE so.shop_id = p_shop_id AND so.user_id = p.id
      )
    )
    ORDER BY CASE UPPER(COALESCE(sm.role, 'STAFF'))
      WHEN 'OWNER' THEN 1 
      WHEN 'SHOP_OWNER' THEN 1 
      WHEN 'MANAGER' THEN 2 
      WHEN 'SHOP_MANAGER' THEN 2
      WHEN 'STAFF' THEN 3 
      WHEN 'SHOP_STAFF' THEN 3
      ELSE 4 END, sm.created_at ASC
  ), '[]'::jsonb)
  INTO v_result
  FROM public.shop_members sm
  JOIN public.profiles p ON sm.user_id = p.id
  WHERE sm.shop_id = p_shop_id AND sm.removed_at IS NULL;

  RETURN jsonb_build_object('success', true, 'members', v_result);
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_get_members_v3(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_get_members_v3(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.owner_get_members_v3(UUID) TO service_role;

-- 7. RPC: owner_update_staff_device — Cập nhật thông tin nhân viên hoặc khóa/mở khóa máy trạm (Kill-Switch)
CREATE OR REPLACE FUNCTION public.owner_update_staff_device(
  p_shop_id UUID,
  p_device_id TEXT,
  p_staff_name TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_device_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_is_revoked BOOLEAN;
  v_row RECORD;
BEGIN
  IF NOT public.check_shop_member_or_admin(p_shop_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'Không có quyền thực hiện.');
  END IF;

  v_is_revoked := (p_status = 'revoked' OR p_status = 'REVOKED');

  UPDATE public.extension_devices
  SET 
    staff_name = COALESCE(NULLIF(TRIM(p_staff_name), ''), staff_name),
    device_name = COALESCE(NULLIF(TRIM(p_device_name), ''), device_name),
    status = COALESCE(NULLIF(TRIM(p_status), ''), status),
    revoked = CASE WHEN p_status IS NOT NULL THEN v_is_revoked ELSE revoked END,
    last_seen = now()
  WHERE shop_id = p_shop_id AND (device_id = p_device_id OR id::text = p_device_id)
  RETURNING * INTO v_row;

  IF v_row IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND', 'message', 'Không tìm thấy thiết bị nhân viên.');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Đã cập nhật thiết bị thành công.',
    'device', jsonb_build_object(
      'id', v_row.id,
      'device_id', v_row.device_id,
      'device_name', v_row.device_name,
      'staff_name', v_row.staff_name,
      'status', v_row.status,
      'revoked', v_row.revoked
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_update_staff_device(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_update_staff_device(UUID, TEXT, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.owner_update_staff_device(UUID, TEXT, TEXT, TEXT, TEXT) TO service_role;

-- 8. RPC: owner_delete_staff_device — Xóa vĩnh viễn thiết bị khỏi danh sách
CREATE OR REPLACE FUNCTION public.owner_delete_staff_device(
  p_shop_id UUID,
  p_device_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.check_shop_member_or_admin(p_shop_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'Không có quyền thực hiện.');
  END IF;

  DELETE FROM public.extension_devices
  WHERE shop_id = p_shop_id AND (device_id = p_device_id OR id::text = p_device_id);

  RETURN jsonb_build_object('success', true, 'message', 'Đã xóa thiết bị thành công.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_delete_staff_device(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_delete_staff_device(UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.owner_delete_staff_device(UUID, TEXT) TO service_role;


