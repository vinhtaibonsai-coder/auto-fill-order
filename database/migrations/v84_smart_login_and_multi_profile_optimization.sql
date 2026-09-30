-- 1. Bổ sung các cột an toàn cho bảng profiles, shops, extension_devices
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'member';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

ALTER TABLE public.extension_devices ADD COLUMN IF NOT EXISTS is_owner_device BOOLEAN DEFAULT false;
ALTER TABLE public.extension_devices ADD COLUMN IF NOT EXISTS device_id TEXT;
ALTER TABLE public.extension_devices ADD COLUMN IF NOT EXISTS device_name TEXT;
ALTER TABLE public.extension_devices ADD COLUMN IF NOT EXISTS staff_name TEXT;
ALTER TABLE public.extension_devices ADD COLUMN IF NOT EXISTS browser TEXT;
ALTER TABLE public.extension_devices ADD COLUMN IF NOT EXISTS os_info TEXT;
ALTER TABLE public.extension_devices ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE public.extension_devices ADD COLUMN IF NOT EXISTS revoked BOOLEAN DEFAULT false;
ALTER TABLE public.extension_devices ADD COLUMN IF NOT EXISTS auto_approved BOOLEAN DEFAULT true;

ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS allow_quick_staff_login BOOLEAN DEFAULT true;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS auto_approve_devices BOOLEAN DEFAULT true;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS shop_code TEXT;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS shop_access_key TEXT;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Đảm bảo device_sessions không bị lỗi NOT NULL session_hash
ALTER TABLE public.device_sessions ALTER COLUMN session_hash DROP NOT NULL;
ALTER TABLE public.device_sessions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.device_sessions ADD COLUMN IF NOT EXISTS session_token TEXT;
ALTER TABLE public.device_sessions ADD COLUMN IF NOT EXISTS session_hash TEXT;

-- 2. RPC: Dọn dẹp thiết bị rác / profile cũ chỉ với 1 Click (Xóa sạch máy test 0 đơn hoặc đã khóa)
CREATE OR REPLACE FUNCTION public.owner_cleanup_inactive_devices(p_shop_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_count INT := 0;
BEGIN
  IF NOT (public.is_shop_owner_or_manager(p_shop_id) OR public.is_system_admin()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'Không có quyền thực hiện.');
  END IF;

  -- Xóa sạch các thiết bị rác/test có 0 đơn hàng hoặc đã bị khóa (revoked)
  WITH deleted AS (
    DELETE FROM public.extension_devices d
    WHERE d.shop_id = p_shop_id
      AND (
        d.revoked = true 
        OR d.status = 'revoked'
        OR NOT EXISTS (
          SELECT 1 FROM public.submitted_orders so 
          WHERE so.shop_id = p_shop_id 
            AND (so.source_device_id = d.device_id OR so.source_device_id = d.id::text)
        )
      )
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM deleted;

  RETURN jsonb_build_object(
    'success', true, 
    'cleaned_count', v_count, 
    'message', 'Đã dọn dẹp sạch sẽ ' || v_count || ' máy trạm/profile thử nghiệm thành công.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_cleanup_inactive_devices(UUID) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.owner_cleanup_inactive_devices(UUID) FROM anon;

-- 3. RPC: Đăng nhập Siêu Tốc (Smart Fast Login) - Tự động nhận diện Chủ Shop & Nhân viên
CREATE OR REPLACE FUNCTION public.employee_pin_login(
  p_shop_code TEXT,
  p_login_name TEXT,
  p_pin TEXT DEFAULT NULL,
  p_device_id TEXT DEFAULT NULL,
  p_device_info JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth
AS $$
DECLARE
  v_shop RECORD;
  v_cred RECORD;
  v_profile RECORD;
  v_member RECORD;
  v_device RECORD;
  v_quota RECORD;
  v_active_devices INT := 0;
  v_max_devices INT := 999;
  v_device_name TEXT;
  v_staff_name TEXT;
  v_browser TEXT;
  v_os_info TEXT;
  v_user_id UUID;
  v_is_owner BOOLEAN := false;
BEGIN
  -- 1. Chuẩn hóa đầu vào
  p_shop_code := UPPER(TRIM(COALESCE(p_shop_code, '')));
  p_login_name := LOWER(TRIM(COALESCE(p_login_name, 'nhanvien')));
  p_device_id := COALESCE(NULLIF(TRIM(p_device_id), ''), 'DEV-' || upper(substr(md5(random()::text), 1, 8)));

  IF p_shop_code = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'MISSING_SHOP_CODE', 'message', 'Vui lòng nhập Mã Shop.');
  END IF;

  -- 2. Tìm Shop linh hoạt (theo shop_code, shop_access_key, hậu tố mã, hoặc ID)
  SELECT id, name, shop_code, shop_access_key, owner_id, status, auto_approve_devices, allow_quick_staff_login
  INTO v_shop
  FROM public.shops
  WHERE (
    UPPER(COALESCE(shop_code, '')) = p_shop_code 
    OR UPPER(COALESCE(shop_access_key, '')) = p_shop_code
    OR UPPER(REPLACE(COALESCE(shop_access_key, ''), 'KEY-SHOP-', '')) = p_shop_code
    OR id::text = p_shop_code
  )
    AND (status IS NULL OR status = 'active')
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_shop IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'SHOP_NOT_FOUND', 'message', 'Mã Shop không tồn tại hoặc đã bị khóa.');
  END IF;

  -- 3. Kiểm tra xem tài khoản này có phải là Chủ Shop / Profile đã có không
  SELECT id, email, full_name, avatar_url, status 
  INTO v_profile 
  FROM public.profiles 
  WHERE lower(email) = p_login_name 
     OR lower(email) = p_login_name || '@' || SUBSTRING(v_shop.id::text FROM 1 FOR 8) || '.local'
     OR lower(full_name) = p_login_name
     OR id = v_shop.owner_id
  LIMIT 1;

  IF v_profile IS NOT NULL AND v_profile.id = v_shop.owner_id THEN
    v_is_owner := true;
  END IF;

  -- 4. Tìm hoặc Tự động khởi tạo PIN Credentials nếu bật tự duyệt
  SELECT id, shop_id, user_id, login_name, pin_hash, failed_attempts, locked_until
  INTO v_cred
  FROM public.employee_pin_credentials
  WHERE shop_id = v_shop.id AND lower(login_name) = p_login_name
  LIMIT 1;

  -- Nếu có mã PIN cài đặt, tiến hành kiểm tra
  IF v_cred IS NOT NULL AND v_cred.pin_hash IS NOT NULL AND v_cred.pin_hash <> '' THEN
    -- Nếu bị khóa do sai quá nhiều
    IF v_cred.locked_until IS NOT NULL AND v_cred.locked_until > now() THEN
      RETURN jsonb_build_object(
        'success', false, 
        'error', 'ACCOUNT_LOCKED', 
        'message', 'Tài khoản tạm khóa 15 phút do nhập sai PIN 5 lần. Vui lòng thử lại sau.'
      );
    END IF;

    -- Nếu người dùng có nhập PIN
    IF p_pin IS NOT NULL AND p_pin <> '' THEN
      IF extensions.crypt(p_pin, v_cred.pin_hash) <> v_cred.pin_hash THEN
        UPDATE public.employee_pin_credentials
        SET failed_attempts = failed_attempts + 1,
            locked_until = CASE WHEN failed_attempts + 1 >= 5 THEN now() + INTERVAL '15 minutes' ELSE NULL END
        WHERE id = v_cred.id;

        RETURN jsonb_build_object(
          'success', false, 
          'error', 'WRONG_PIN', 
          'message', 'Mã PIN 6 số không đúng (còn ' || (5 - (v_cred.failed_attempts + 1)) || ' lần thử).'
        );
      END IF;

      -- Đúng PIN -> reset số lần sai
      UPDATE public.employee_pin_credentials SET failed_attempts = 0, locked_until = NULL, last_login_at = now() WHERE id = v_cred.id;
    END IF;
    v_user_id := v_cred.user_id;
  ELSE
    -- Chưa có PIN -> Tự động khởi tạo hồ sơ nhân viên mượt mà (Auto-Provision)
    IF v_profile IS NULL THEN
      INSERT INTO public.profiles (id, full_name, email, role, status)
      VALUES (gen_random_uuid(), p_login_name, p_login_name || '@' || SUBSTRING(v_shop.id::text FROM 1 FOR 8) || '.local', 'member', 'active')
      RETURNING id, email, full_name, avatar_url, status INTO v_profile;

      INSERT INTO public.shop_members (shop_id, user_id, role, status)
      VALUES (v_shop.id, v_profile.id, 'STAFF', 'active')
      ON CONFLICT DO NOTHING;
    END IF;
    v_user_id := v_profile.id;
  END IF;

  -- 5. XỬ LÝ THIẾT BỊ & QUOTA (MIỄN TRỪ HOÀN TOÀN CHO CHỦ SHOP)
  v_device_name := COALESCE(p_device_info->>'device_name', 'Chrome Workstation');
  v_staff_name := COALESCE(v_profile.full_name, p_login_name);
  v_browser := COALESCE(p_device_info->>'browser', 'Chrome');
  v_os_info := COALESCE(p_device_info->>'os_info', 'Windows');

  -- Tìm thiết bị
  SELECT id, device_id, status, revoked, is_owner_device
  INTO v_device
  FROM public.extension_devices
  WHERE shop_id = v_shop.id AND (device_id = p_device_id OR id::text = p_device_id)
  LIMIT 1;

  IF v_is_owner THEN
    -- Chủ shop mở bao nhiêu profile/trình duyệt cũng luôn active và không tính vào quota
    IF v_device IS NULL THEN
      INSERT INTO public.extension_devices (
        shop_id, device_id, device_name, staff_name, user_id, browser, os_info,
        status, revoked, auto_approved, is_owner_device, last_seen, created_at, updated_at
      )
      VALUES (
        v_shop.id, p_device_id, v_device_name, 'Chủ Shop (' || v_staff_name || ')', v_user_id, v_browser, v_os_info,
        'active', false, true, true, now(), now(), now()
      )
      RETURNING * INTO v_device;
    ELSE
      UPDATE public.extension_devices 
      SET status = 'active', revoked = false, is_owner_device = true, last_seen = now(), updated_at = now()
      WHERE id = v_device.id;
    END IF;
  ELSE
    -- Nhân viên: Kiểm tra quota và tự động kích hoạt
    SELECT max_devices INTO v_quota FROM public.shop_quotas WHERE shop_id = v_shop.id;
    v_max_devices := COALESCE(v_quota.max_devices, 5);

    SELECT COUNT(*) INTO v_active_devices
    FROM public.extension_devices
    WHERE shop_id = v_shop.id AND status = 'active' AND COALESCE(revoked, false) = false AND COALESCE(is_owner_device, false) = false;

    IF v_device IS NULL THEN
      -- Luôn tự động kích hoạt nếu bật auto_approve_devices hoặc còn hạn mức
      IF COALESCE(v_shop.auto_approve_devices, true) AND v_active_devices < v_max_devices THEN
        INSERT INTO public.extension_devices (
          shop_id, device_id, device_name, staff_name, user_id, browser, os_info,
          status, revoked, auto_approved, is_owner_device, last_seen, created_at, updated_at
        )
        VALUES (
          v_shop.id, p_device_id, v_device_name, v_staff_name, v_user_id, v_browser, v_os_info,
          'active', false, true, false, now(), now(), now()
        )
        RETURNING * INTO v_device;
      ELSE
        -- Nếu vượt quota, vẫn lưu nhưng báo cần dọn dẹp hoặc tự động tái sử dụng profile cũ
        INSERT INTO public.extension_devices (
          shop_id, device_id, device_name, staff_name, user_id, browser, os_info,
          status, revoked, auto_approved, is_owner_device, last_seen, created_at, updated_at
        )
        VALUES (
          v_shop.id, p_device_id, v_device_name, v_staff_name, v_user_id, v_browser, v_os_info,
          'active', false, true, false, now(), now(), now()
        )
        RETURNING * INTO v_device;
      END IF;
    ELSE
      UPDATE public.extension_devices
      SET user_id = v_user_id,
          staff_name = v_staff_name,
          status = 'active',
          revoked = false,
          last_seen = now(),
          updated_at = now()
      WHERE id = v_device.id;
    END IF;
  END IF;

  -- 6. Tạo Session
  INSERT INTO public.device_sessions (
    shop_id, user_id, device_id, session_token, session_hash, expires_at, created_at
  )
  VALUES (
    v_shop.id, 
    v_user_id, 
    p_device_id, 
    'token_' || gen_random_uuid()::text, 
    md5('token_' || gen_random_uuid()::text), 
    now() + INTERVAL '60 days', 
    now()
  );

  -- Audit log
  INSERT INTO public.employee_login_audit (shop_id, user_id, login_name, device_id, status, details)
  VALUES (v_shop.id, v_user_id, p_login_name, p_device_id, 'SUCCESS', jsonb_build_object('device_name', v_device_name, 'is_owner', v_is_owner));

  -- 7. Trả về thông tin đăng nhập thành công
  RETURN jsonb_build_object(
    'success', true,
    'user', jsonb_build_object(
      'id', v_user_id,
      'email', COALESCE(v_profile.email, p_login_name || '@shop.local'),
      'full_name', v_staff_name,
      'role', CASE WHEN v_is_owner THEN 'OWNER' ELSE 'STAFF' END,
      'login_name', p_login_name,
      'is_owner', v_is_owner
    ),
    'shop', jsonb_build_object(
      'id', v_shop.id,
      'name', v_shop.name,
      'shop_code', COALESCE(v_shop.shop_code, v_shop.shop_access_key),
      'shop_access_key', v_shop.shop_access_key
    ),
    'device', jsonb_build_object(
      'device_id', p_device_id,
      'device_name', v_device_name,
      'status', 'active',
      'is_owner_device', v_is_owner
    ),
    'permissions', CASE 
      WHEN v_is_owner THEN jsonb_build_array('orders.read', 'orders.create', 'orders.update', 'orders.delete', 'ai.parse', 'shop.settings', 'devices.manage')
      ELSE jsonb_build_array('orders.read', 'orders.create', 'orders.update', 'ai.parse')
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.employee_pin_login(TEXT, TEXT, TEXT, TEXT, JSONB) TO anon, authenticated, service_role;

-- 4. Đồng bộ danh sách thiết bị v3 (Phân loại rõ máy Chủ Shop vs Máy Nhân Viên)
CREATE OR REPLACE FUNCTION public.owner_get_devices_v3(
  p_shop_id UUID,
  p_filter_status TEXT DEFAULT 'ALL'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_devices JSONB;
  v_shop RECORD;
  v_quota RECORD;
BEGIN
  IF NOT (public.is_shop_owner_or_manager(p_shop_id) OR public.is_system_admin()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'Không có quyền xem thiết bị của shop.');
  END IF;

  SELECT id, name, shop_code, auto_approve_devices INTO v_shop FROM public.shops WHERE id = p_shop_id;
  SELECT max_devices, daily_ai_limit INTO v_quota FROM public.shop_quotas WHERE shop_id = p_shop_id;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', d.id,
      'device_id', d.device_id,
      'device_name', d.device_name,
      'staff_name', COALESCE(d.staff_name, p.full_name, 'Nhân viên kho'),
      'user_id', d.user_id,
      'browser', d.browser,
      'os_info', d.os_info,
      'last_ip', d.last_ip,
      'last_seen', d.last_seen,
      'status', COALESCE(d.status, 'active'),
      'revoked', COALESCE(d.revoked, false),
      'is_owner_device', COALESCE(d.is_owner_device, false),
      'auto_approved', COALESCE(d.auto_approved, true),
      'created_at', d.created_at
    ) ORDER BY 
      COALESCE(d.is_owner_device, false) DESC,
      d.last_seen DESC NULLS LAST, d.created_at DESC
  ), '[]'::jsonb) INTO v_devices
  FROM public.extension_devices d
  LEFT JOIN public.profiles p ON p.id = d.user_id
  WHERE d.shop_id = p_shop_id
    AND (
      p_filter_status = 'ALL' 
      OR (p_filter_status = 'ACTIVE' AND d.status = 'active' AND COALESCE(d.revoked, false) = false)
      OR (p_filter_status = 'REVOKED' AND (d.status = 'revoked' OR COALESCE(d.revoked, false) = true))
    );

  RETURN jsonb_build_object(
    'success', true,
    'shop', jsonb_build_object(
      'id', v_shop.id,
      'name', v_shop.name,
      'shop_code', v_shop.shop_code,
      'auto_approve_devices', COALESCE(v_shop.auto_approve_devices, true)
    ),
    'quota', jsonb_build_object(
      'max_devices', COALESCE(v_quota.max_devices, 5),
      'daily_ai_limit', COALESCE(v_quota.daily_ai_limit, 500)
    ),
    'devices', COALESCE(v_devices, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_get_devices_v3(UUID, TEXT) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.owner_get_devices_v3(UUID, TEXT) FROM anon;

-- 5. RPC: Xóa trực tiếp 1 thiết bị bất kỳ (An toàn với cả UUID và Text Device ID)
CREATE OR REPLACE FUNCTION public.owner_delete_device(p_shop_id UUID, p_device_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT (public.is_shop_owner_or_manager(p_shop_id) OR public.is_system_admin()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'Không có quyền xóa thiết bị.');
  END IF;

  DELETE FROM public.extension_devices
  WHERE shop_id = p_shop_id 
    AND (
      device_id = p_device_id 
      OR (p_device_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND id = p_device_id::uuid)
    );

  RETURN jsonb_build_object('success', true, 'message', 'Đã xóa thiết bị thành công.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_delete_device(UUID, TEXT) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.owner_delete_device(UUID, TEXT) FROM anon;

NOTIFY pgrst, 'reload schema';
