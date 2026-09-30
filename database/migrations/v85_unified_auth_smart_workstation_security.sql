-- =============================================================================
-- Migration v85: Unified Auth, Smart Multi-Profile Workstations & Anti-Fraud Security
-- =============================================================================

-- 1. Bổ sung các cột an toàn cho các bảng cốt lõi
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'member';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS shop_code TEXT;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS shop_access_key TEXT;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS allow_quick_staff_login BOOLEAN DEFAULT true;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS auto_approve_devices BOOLEAN DEFAULT true;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS require_staff_pin BOOLEAN DEFAULT false;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.extension_devices ADD COLUMN IF NOT EXISTS is_owner_device BOOLEAN DEFAULT false;
ALTER TABLE public.extension_devices ADD COLUMN IF NOT EXISTS device_id TEXT;
ALTER TABLE public.extension_devices ADD COLUMN IF NOT EXISTS device_name TEXT;
ALTER TABLE public.extension_devices ADD COLUMN IF NOT EXISTS staff_name TEXT;
ALTER TABLE public.extension_devices ADD COLUMN IF NOT EXISTS browser TEXT;
ALTER TABLE public.extension_devices ADD COLUMN IF NOT EXISTS os_info TEXT;
ALTER TABLE public.extension_devices ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE public.extension_devices ADD COLUMN IF NOT EXISTS revoked BOOLEAN DEFAULT false;
ALTER TABLE public.extension_devices ADD COLUMN IF NOT EXISTS auto_approved BOOLEAN DEFAULT true;

-- Đảm bảo device_sessions không bị lỗi NOT NULL session_hash
ALTER TABLE public.device_sessions ALTER COLUMN session_hash DROP NOT NULL;
ALTER TABLE public.device_sessions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.device_sessions ADD COLUMN IF NOT EXISTS session_token TEXT;
ALTER TABLE public.device_sessions ADD COLUMN IF NOT EXISTS session_hash TEXT;

-- Bổ sung các cột truy vết cho submitted_orders (Anti-Fraud Audit)
ALTER TABLE public.submitted_orders ADD COLUMN IF NOT EXISTS staff_name TEXT;
ALTER TABLE public.submitted_orders ADD COLUMN IF NOT EXISTS source_device_id TEXT;
ALTER TABLE public.submitted_orders ADD COLUMN IF NOT EXISTS device_name TEXT;
ALTER TABLE public.submitted_orders ADD COLUMN IF NOT EXISTS raw_text TEXT;

-- 2. Cấp quyền RLS cho phép DELETE an toàn trên extension_devices
ALTER TABLE public.extension_devices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Shop owners can delete devices" ON public.extension_devices;
CREATE POLICY "Shop owners can delete devices" ON public.extension_devices
  FOR DELETE TO authenticated
  USING (
    public.is_shop_owner_or_manager(shop_id) 
    OR public.is_system_admin()
    OR user_id = auth.uid()
  );

-- 3. RPC: Xóa trực tiếp 1 thiết bị bất kỳ (An toàn với cả UUID và Text Device ID)
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

-- 4. RPC: Dọn dẹp thiết bị rác / profile thử nghiệm 0 đơn (1-Click)
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
    'message', 'Đã dọn dẹp sạch ' || v_count || ' máy trạm/profile thử nghiệm.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_cleanup_inactive_devices(UUID) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.owner_cleanup_inactive_devices(UUID) FROM anon;

-- 5. RPC: Đăng nhập nhân viên bằng PIN / Fast Activation (Smart Workstations)
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
  v_device RECORD;
  v_device_name TEXT;
  v_staff_name TEXT;
  v_browser TEXT;
  v_os_info TEXT;
  v_user_id UUID;
  v_is_owner BOOLEAN := false;
  v_token TEXT;
BEGIN
  p_shop_code := UPPER(TRIM(COALESCE(p_shop_code, '')));
  p_login_name := LOWER(TRIM(COALESCE(p_login_name, 'nhanvien')));
  p_device_id := COALESCE(NULLIF(TRIM(p_device_id), ''), 'DEV-' || upper(substr(md5(random()::text), 1, 8)));

  IF p_shop_code = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'MISSING_SHOP_CODE', 'message', 'Vui lòng nhập Mã Shop.');
  END IF;

  -- 1. Tìm Shop theo mã hoặc Key
  SELECT id, name, shop_code, shop_access_key, owner_id, status, auto_approve_devices, require_staff_pin
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

  -- 2. Tìm Profile
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

  -- 3. Xử lý PIN Credentials & Khóa bảo vệ 15 phút nếu sai 5 lần
  SELECT id, shop_id, user_id, login_name, pin_hash, failed_attempts, locked_until
  INTO v_cred
  FROM public.employee_pin_credentials
  WHERE shop_id = v_shop.id AND lower(login_name) = p_login_name
  LIMIT 1;

  IF v_cred IS NOT NULL AND v_cred.pin_hash IS NOT NULL AND v_cred.pin_hash <> '' THEN
    IF v_cred.locked_until IS NOT NULL AND v_cred.locked_until > now() THEN
      RETURN jsonb_build_object(
        'success', false, 
        'error', 'ACCOUNT_LOCKED', 
        'message', 'Tài khoản tạm khóa 15 phút do nhập sai PIN 5 lần. Vui lòng thử lại sau.'
      );
    END IF;

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

      UPDATE public.employee_pin_credentials SET failed_attempts = 0, locked_until = NULL, last_login_at = now() WHERE id = v_cred.id;
    ELSIF v_shop.require_staff_pin THEN
      RETURN jsonb_build_object('success', false, 'error', 'PIN_REQUIRED', 'message', 'Cửa hàng yêu cầu nhập mã PIN 6 số để vào ca.');
    END IF;
    v_user_id := v_cred.user_id;
  ELSE
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

  -- 4. Cấu hình thiết bị & Định danh
  v_device_name := COALESCE(p_device_info->>'device_name', 'Chrome Workstation');
  v_staff_name := COALESCE(v_profile.full_name, p_login_name);
  v_browser := COALESCE(p_device_info->>'browser', 'Chrome');
  v_os_info := COALESCE(p_device_info->>'os_info', 'Windows');

  SELECT id, device_id, status, revoked, is_owner_device
  INTO v_device
  FROM public.extension_devices
  WHERE shop_id = v_shop.id AND (device_id = p_device_id OR id::text = p_device_id)
  LIMIT 1;

  IF v_is_owner THEN
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
    IF v_device IS NULL THEN
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

  -- 5. Tạo Session Token & Session Hash an toàn
  v_token := 'token_' || gen_random_uuid()::text;
  INSERT INTO public.device_sessions (
    shop_id, user_id, device_id, session_token, session_hash, expires_at, created_at
  )
  VALUES (
    v_shop.id, 
    v_user_id, 
    p_device_id, 
    v_token, 
    md5(v_token), 
    now() + INTERVAL '60 days', 
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'session_token', v_token,
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

NOTIFY pgrst, 'reload schema';
