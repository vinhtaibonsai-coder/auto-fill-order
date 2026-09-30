-- =========================================================================
-- Migration v75: Shop Access Keys, Staff Alias, Order Source Tracking & Offline Sync
-- =========================================================================

-- 1. Bổ sung cột shop_access_key vào bảng shops
ALTER TABLE public.shops 
  ADD COLUMN IF NOT EXISTS shop_access_key TEXT UNIQUE;

-- Tự động sinh mã Key cho các shop hiện có nếu đang null
UPDATE public.shops 
SET shop_access_key = 'KEY-SHOP-' || upper(substr(md5(id::text || random()::text), 1, 8))
WHERE shop_access_key IS NULL;

-- Đảm bảo giá trị mặc định cho shop mới
CREATE OR REPLACE FUNCTION public.set_default_shop_access_key()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.shop_access_key IS NULL OR NEW.shop_access_key = '' THEN
    NEW.shop_access_key := 'KEY-SHOP-' || upper(substr(md5(gen_random_uuid()::text), 1, 8));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_default_shop_access_key ON public.shops;
CREATE TRIGGER trg_set_default_shop_access_key
BEFORE INSERT ON public.shops
FOR EACH ROW EXECUTE FUNCTION public.set_default_shop_access_key();


-- 2. Bổ sung cột theo dõi nguồn đơn và nhân viên vào submitted_orders
ALTER TABLE public.submitted_orders
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'AUTO_FILL',
  ADD COLUMN IF NOT EXISTS created_by_name TEXT,
  ADD COLUMN IF NOT EXISTS source_device_id TEXT,
  ADD COLUMN IF NOT EXISTS carrier_account TEXT;

CREATE INDEX IF NOT EXISTS idx_submitted_orders_source ON public.submitted_orders(source);
CREATE INDEX IF NOT EXISTS idx_submitted_orders_created_by_name ON public.submitted_orders(created_by_name);


-- 3. Bổ sung cột staff_name vào extension_devices
ALTER TABLE public.extension_devices
  ADD COLUMN IF NOT EXISTS staff_name TEXT;


-- 4. RPC: verify_shop_access_key
-- Xác thực mã Shop Key, đăng ký thiết bị & nhân viên, trả về hạn ngạch
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
SET search_path = public
AS $$
DECLARE
  v_shop RECORD;
  v_quota RECORD;
  v_clean_key TEXT := UPPER(TRIM(p_access_key));
  v_clean_device_id TEXT := TRIM(COALESCE(p_device_id, 'dev_unknown'));
  v_clean_staff_name TEXT := TRIM(COALESCE(p_staff_name, 'Nhân viên kho'));
  v_clean_device_name TEXT := TRIM(COALESCE(p_device_name, v_clean_staff_name));
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
  IF EXISTS (SELECT 1 FROM public.extension_devices WHERE shop_id = v_shop.id AND device_id = v_clean_device_id) THEN
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
    WHERE shop_id = v_shop.id AND device_id = v_clean_device_id;
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
      v_shop.owner_id,
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

  BEGIN
    PERFORM _ai_refresh_monthly_window(v_shop.id);
  EXCEPTION WHEN OTHERS THEN
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

GRANT EXECUTE ON FUNCTION public.verify_shop_access_key(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.verify_shop_access_key(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_shop_access_key(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;


-- 5. RPC: admin_reset_shop_access_key
-- Cho phép chủ shop tạo lại mã Key mới (vô hiệu hóa mã cũ trên các máy cũ)
CREATE OR REPLACE FUNCTION public.admin_reset_shop_access_key(p_shop_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_key TEXT;
  v_user_id UUID := auth.uid();
BEGIN
  -- Kiểm tra quyền
  IF NOT (public.is_shop_owner_or_manager(p_shop_id) OR public.is_system_admin()) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Bạn không có quyền quản trị cửa hàng này.');
  END IF;

  v_new_key := 'KEY-SHOP-' || upper(substr(md5(gen_random_uuid()::text || now()::text), 1, 8));

  UPDATE public.shops
  SET shop_access_key = v_new_key,
      updated_at = now()
  WHERE id = p_shop_id;

  -- Ghi log vào audit_logs
  INSERT INTO public.audit_logs (actor_id, shop_id, action, target_resource, target_id, new_value)
  VALUES (v_user_id, p_shop_id, 'RESET_SHOP_ACCESS_KEY', 'shops', p_shop_id::text, jsonb_build_object('shop_access_key', v_new_key)::text);

  RETURN jsonb_build_object(
    'success', true,
    'shop_id', p_shop_id,
    'shop_access_key', v_new_key,
    'message', 'Đã đổi mã Shop Access Key thành công!'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_reset_shop_access_key(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_shop_access_key(UUID) TO service_role;


-- 6. RPC: sync_offline_submitted_orders
-- Đẩy hàng loạt đơn hàng đã lưu trong Offline Queue lên Supabase
CREATE OR REPLACE FUNCTION public.sync_offline_submitted_orders(
  p_orders JSONB,
  p_shop_id UUID,
  p_access_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_valid_shop BOOLEAN := false;
  v_order JSONB;
  v_synced_count INT := 0;
  v_tracking_code TEXT;
  v_order_code TEXT;
  v_name TEXT;
  v_phone TEXT;
  v_address TEXT;
  v_cod NUMERIC;
  v_platform TEXT;
  v_carrier_acc TEXT;
  v_source TEXT;
  v_created_by TEXT;
  v_device_id TEXT;
BEGIN
  -- 1. Xác thực tính hợp lệ của shop_id qua access_key hoặc auth.uid
  IF p_access_key IS NOT NULL AND p_access_key <> '' THEN
    SELECT true INTO v_valid_shop
    FROM public.shops
    WHERE id = p_shop_id AND UPPER(shop_access_key) = UPPER(TRIM(p_access_key));
  ELSE
    v_valid_shop := public.is_shop_member(p_shop_id) OR public.is_system_admin();
  END IF;

  IF NOT v_valid_shop THEN
    RETURN jsonb_build_object('success', false, 'message', 'Xác thực cửa hàng không hợp lệ để đồng bộ đơn.');
  END IF;

  -- 2. Xử lý từng đơn trong mảng
  IF p_orders IS NOT NULL AND jsonb_array_length(p_orders) > 0 THEN
    FOR v_order IN SELECT * FROM jsonb_array_elements(p_orders)
    LOOP
      v_tracking_code := NULLIF(TRIM(v_order->>'tracking_code'), '');
      v_order_code := NULLIF(TRIM(v_order->>'order_code'), '');
      v_name := COALESCE(TRIM(v_order->>'name'), 'Khách lẻ');
      v_phone := NULLIF(TRIM(v_order->>'phone'), '');
      v_address := NULLIF(TRIM(v_order->>'address'), '');
      v_cod := COALESCE((v_order->>'cod_amount')::numeric, 0);
      v_platform := COALESCE(v_order->>'platform', 'VNPOST');
      v_carrier_acc := v_order->>'carrier_account';
      v_source := COALESCE(v_order->>'source', 'MANUAL_ENTRY');
      v_created_by := COALESCE(v_order->>'created_by_name', 'Nhân viên kho');
      v_device_id := v_order->>'source_device_id';

      -- Tránh trùng lặp nếu đã có mã vận đơn trong shop
      IF v_tracking_code IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM public.submitted_orders WHERE shop_id = p_shop_id AND tracking_code = v_tracking_code AND deleted_at IS NULL) THEN
          CONTINUE;
        END IF;
      END IF;

      INSERT INTO public.submitted_orders (
        shop_id,
        name,
        phone,
        address,
        order_code,
        cod_amount,
        platform,
        tracking_code,
        carrier_account,
        source,
        created_by_name,
        source_device_id,
        device_name,
        status,
        submitted_at,
        submitted_date
      )
      VALUES (
        p_shop_id,
        v_name,
        v_phone,
        v_address,
        v_order_code,
        v_cod,
        v_platform,
        v_tracking_code,
        v_carrier_acc,
        v_source,
        v_created_by,
        v_device_id,
        v_created_by,
        'SUCCESS',
        COALESCE((v_order->>'submitted_at')::timestamptz, now()),
        COALESCE((v_order->>'submitted_date')::date, CURRENT_DATE)
      );

      v_synced_count := v_synced_count + 1;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'synced_count', v_synced_count,
    'message', 'Đã đồng bộ ' || v_synced_count || ' đơn hàng lên máy chủ thành công!'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_offline_submitted_orders(JSONB, UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.sync_offline_submitted_orders(JSONB, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_offline_submitted_orders(JSONB, UUID, TEXT) TO service_role;


-- 7. Cập nhật hàm check_shop_member_or_admin cho phép service_role
CREATE OR REPLACE FUNCTION public.check_shop_member_or_admin(p_shop_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
    -- Cho phép nếu là service_role hoặc auth.uid() null khi gọi từ Edge Function nội bộ
    IF current_setting('request.jwt.claim.role', true) = 'service_role' OR auth.uid() IS NULL THEN
        RETURN true;
    END IF;

    RETURN EXISTS (
        SELECT 1 FROM public.shop_members sm
        WHERE sm.shop_id = p_shop_id
          AND sm.user_id = auth.uid()
          AND sm.status = 'active'
          AND sm.removed_at IS NULL
    ) OR public.is_system_admin();
END;
$$;

