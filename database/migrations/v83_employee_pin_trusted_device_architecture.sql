-- =============================================================================
-- Migration v83: Employee PIN & Trusted Device Architecture (Enterprise Multi-Tenant)
-- =============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 2. SECURITY HARDENING (P0 Fixes)
-- Revoke admin_repair_user_auth from anon completely
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' AND p.proname = 'admin_repair_user_auth'
  ) THEN
    REVOKE EXECUTE ON FUNCTION public.admin_repair_user_auth(TEXT, TEXT) FROM anon;
  END IF;
END $$;

-- 3. ENHANCE SHOPS TABLE (shop_code, created_by, owner_id, auto_approve_devices)
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS shop_code TEXT;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS auto_approve_devices BOOLEAN DEFAULT true;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Đồng bộ owner_id và created_by nếu một trong hai bị thiếu
UPDATE public.shops SET created_by = owner_id WHERE created_by IS NULL AND owner_id IS NOT NULL;
UPDATE public.shops SET owner_id = created_by WHERE owner_id IS NULL AND created_by IS NOT NULL;

-- Generate unique shop_code for existing shops that don't have one
DO $$
DECLARE
  r RECORD;
  v_code TEXT;
  v_count INT;
BEGIN
  FOR r IN SELECT id, name FROM public.shops WHERE shop_code IS NULL OR trim(shop_code) = '' LOOP
    -- Create clean alphanumeric slug from name or fallback to prefix
    v_code := UPPER(SUBSTRING(REGEXP_REPLACE(r.name, '[^a-zA-Z0-9]', '', 'g') FROM 1 FOR 6));
    IF v_code IS NULL OR LENGTH(v_code) < 3 THEN
      v_code := 'SHOP' || SUBSTRING(r.id::text FROM 1 FOR 4);
    END IF;
    
    -- Ensure uniqueness
    SELECT COUNT(*) INTO v_count FROM public.shops WHERE shop_code = v_code AND id <> r.id;
    IF v_count > 0 THEN
      v_code := v_code || SUBSTRING(r.id::text FROM 1 FOR 3);
    END IF;

    UPDATE public.shops SET shop_code = UPPER(v_code) WHERE id = r.id;
  END LOOP;
END $$;

-- 4. TABLE: extension_devices (Đảm bảo đầy đủ cột kể cả khi bảng đã tồn tại từ trước)
CREATE TABLE IF NOT EXISTS public.extension_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  device_id TEXT,
  device_name TEXT DEFAULT 'Chrome Extension',
  staff_name TEXT DEFAULT 'Nhân viên kho',
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  browser TEXT,
  os_info TEXT,
  last_ip TEXT,
  status TEXT DEFAULT 'active', -- 'active', 'pending_approval', 'revoked'
  revoked BOOLEAN DEFAULT false,
  auto_approved BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  revoke_reason TEXT,
  last_seen TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Bảo đảm thêm toàn bộ các cột nếu bảng đã có từ các migration trước
ALTER TABLE public.extension_devices ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE;
ALTER TABLE public.extension_devices ADD COLUMN IF NOT EXISTS device_id TEXT;
ALTER TABLE public.extension_devices ADD COLUMN IF NOT EXISTS device_name TEXT DEFAULT 'Chrome Extension';
ALTER TABLE public.extension_devices ADD COLUMN IF NOT EXISTS staff_name TEXT DEFAULT 'Nhân viên kho';
ALTER TABLE public.extension_devices ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.extension_devices ADD COLUMN IF NOT EXISTS browser TEXT;
ALTER TABLE public.extension_devices ADD COLUMN IF NOT EXISTS os_info TEXT;
ALTER TABLE public.extension_devices ADD COLUMN IF NOT EXISTS last_ip TEXT;
ALTER TABLE public.extension_devices ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE public.extension_devices ADD COLUMN IF NOT EXISTS revoked BOOLEAN DEFAULT false;
ALTER TABLE public.extension_devices ADD COLUMN IF NOT EXISTS auto_approved BOOLEAN DEFAULT false;
ALTER TABLE public.extension_devices ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.extension_devices ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE public.extension_devices ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;
ALTER TABLE public.extension_devices ADD COLUMN IF NOT EXISTS revoked_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.extension_devices ADD COLUMN IF NOT EXISTS revoke_reason TEXT;
ALTER TABLE public.extension_devices ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.extension_devices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_ext_dev_shop_device ON public.extension_devices(shop_id, device_id);

-- 5. TABLE: employee_pin_credentials
CREATE TABLE IF NOT EXISTS public.employee_pin_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  login_name TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  failed_attempts INT DEFAULT 0,
  locked_until TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_shop_login_name UNIQUE (shop_id, login_name)
);

ALTER TABLE public.employee_pin_credentials ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE;
ALTER TABLE public.employee_pin_credentials ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.employee_pin_credentials ADD COLUMN IF NOT EXISTS login_name TEXT;
ALTER TABLE public.employee_pin_credentials ADD COLUMN IF NOT EXISTS pin_hash TEXT;
ALTER TABLE public.employee_pin_credentials ADD COLUMN IF NOT EXISTS failed_attempts INT DEFAULT 0;
ALTER TABLE public.employee_pin_credentials ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
ALTER TABLE public.employee_pin_credentials ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE public.employee_pin_credentials ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_pin_cred_shop_login ON public.employee_pin_credentials(shop_id, lower(login_name));

-- 6. TABLE: device_sessions (Bổ sung user_id và các cột nếu bảng đã có từ v80)
CREATE TABLE IF NOT EXISTS public.device_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  session_token TEXT,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.device_sessions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.device_sessions ADD COLUMN IF NOT EXISTS session_token TEXT;
ALTER TABLE public.device_sessions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE public.device_sessions ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;
ALTER TABLE public.device_sessions ADD COLUMN IF NOT EXISTS revoked_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.device_sessions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_dev_sess_lookup ON public.device_sessions(shop_id, device_id, user_id);

-- 7. TABLE: employee_login_audit
CREATE TABLE IF NOT EXISTS public.employee_login_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  login_name TEXT,
  device_id TEXT,
  status TEXT NOT NULL, -- 'SUCCESS', 'WRONG_PIN', 'LOCKED', 'DEVICE_PENDING', 'DEVICE_REVOKED', 'DEVICE_LIMIT_EXCEEDED'
  ip_address TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.employee_login_audit ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE;
ALTER TABLE public.employee_login_audit ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.employee_login_audit ADD COLUMN IF NOT EXISTS login_name TEXT;
ALTER TABLE public.employee_login_audit ADD COLUMN IF NOT EXISTS device_id TEXT;
ALTER TABLE public.employee_login_audit ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE public.employee_login_audit ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}'::jsonb;

-- 8. RPC: owner_set_employee_pin (Owner/Manager đặt hoặc đổi PIN cho nhân viên)
DROP FUNCTION IF EXISTS public.owner_set_employee_pin(UUID, UUID, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.owner_set_employee_pin(
  p_shop_id UUID,
  p_user_id UUID,
  p_login_name TEXT,
  p_pin TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth
AS $$
DECLARE
  v_clean_name TEXT;
  v_hash TEXT;
BEGIN
  IF NOT (public.is_shop_owner_or_manager(p_shop_id) OR public.is_system_admin()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'Không có quyền quản lý PIN nhân viên.');
  END IF;

  v_clean_name := LOWER(TRIM(p_login_name));
  IF v_clean_name IS NULL OR LENGTH(v_clean_name) < 2 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_NAME', 'message', 'Tên đăng nhập tối thiểu 2 ký tự.');
  END IF;

  IF p_pin IS NULL OR p_pin !~ '^[0-9]{6}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_PIN', 'message', 'Mã PIN phải bao gồm đúng 6 chữ số.');
  END IF;

  -- Hash PIN with bcrypt
  v_hash := extensions.crypt(p_pin, extensions.gen_salt('bf', 8));

  -- Nếu p_user_id rỗng, tự động liên kết hoặc tạo profile
  IF p_user_id IS NULL THEN
    SELECT user_id INTO p_user_id FROM public.employee_pin_credentials WHERE shop_id = p_shop_id AND login_name = v_clean_name LIMIT 1;
    IF p_user_id IS NULL THEN
      SELECT id INTO p_user_id FROM public.profiles WHERE lower(email) = v_clean_name || '@' || SUBSTRING(p_shop_id::text FROM 1 FOR 8) || '.local' OR lower(full_name) = v_clean_name LIMIT 1;
    END IF;
    IF p_user_id IS NULL THEN
      INSERT INTO public.profiles (id, full_name, email, role, status)
      VALUES (gen_random_uuid(), p_login_name, v_clean_name || '@' || SUBSTRING(p_shop_id::text FROM 1 FOR 8) || '.local', 'member', 'active')
      RETURNING id INTO p_user_id;

      INSERT INTO public.shop_members (shop_id, user_id, role, status)
      VALUES (p_shop_id, p_user_id, 'STAFF', 'active')
      ON CONFLICT (shop_id, user_id) DO NOTHING;
    END IF;
  END IF;

  INSERT INTO public.employee_pin_credentials (
    shop_id, user_id, login_name, pin_hash, failed_attempts, locked_until, updated_at
  )
  VALUES (
    p_shop_id, p_user_id, v_clean_name, v_hash, 0, NULL, now()
  )
  ON CONFLICT (shop_id, login_name) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    pin_hash = EXCLUDED.pin_hash,
    failed_attempts = 0,
    locked_until = NULL,
    updated_at = now();

  RETURN jsonb_build_object('success', true, 'user_id', p_user_id, 'message', 'Đã cấp/cập nhật mã PIN 6 số cho nhân viên thành công.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_set_employee_pin(UUID, UUID, TEXT, TEXT) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.owner_set_employee_pin(UUID, UUID, TEXT, TEXT) FROM anon;

-- 9. RPC: employee_pin_login (Xác thực đăng nhập Nhân viên bằng PIN 6 số & Kiểm tra thiết bị)
DROP FUNCTION IF EXISTS public.employee_pin_login(TEXT, TEXT, TEXT, TEXT, JSONB);
CREATE OR REPLACE FUNCTION public.employee_pin_login(
  p_shop_code TEXT,
  p_login_name TEXT,
  p_pin TEXT,
  p_device_id TEXT,
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
  v_max_devices INT := 5;
  v_device_name TEXT;
  v_staff_name TEXT;
  v_browser TEXT;
  v_os_info TEXT;
BEGIN
  -- 1. Chuẩn hóa đầu vào
  p_shop_code := UPPER(TRIM(p_shop_code));
  p_login_name := LOWER(TRIM(p_login_name));

  IF p_shop_code IS NULL OR p_shop_code = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'MISSING_SHOP_CODE', 'message', 'Vui lòng nhập Mã Shop.');
  END IF;

  IF p_login_name IS NULL OR p_login_name = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'MISSING_USERNAME', 'message', 'Vui lòng nhập Tên đăng nhập.');
  END IF;

  IF p_pin IS NULL OR p_pin !~ '^[0-9]{6}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_PIN_FORMAT', 'message', 'Mã PIN phải là 6 chữ số.');
  END IF;

  -- 2. Tìm Shop theo shop_code, shop_access_key hoặc ID
  SELECT id, name, shop_code, status, auto_approve_devices
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

  -- 3. Tìm thông tin PIN Credentials
  SELECT id, shop_id, user_id, login_name, pin_hash, failed_attempts, locked_until
  INTO v_cred
  FROM public.employee_pin_credentials
  WHERE shop_id = v_shop.id AND lower(login_name) = p_login_name
  LIMIT 1;

  IF v_cred IS NULL THEN
    -- Ghi nhật ký thất bại
    INSERT INTO public.employee_login_audit (shop_id, login_name, device_id, status, details)
    VALUES (v_shop.id, p_login_name, p_device_id, 'USER_NOT_FOUND', jsonb_build_object('reason', 'Login name not configured for shop'));

    RETURN jsonb_build_object('success', false, 'error', 'INVALID_CREDENTIALS', 'message', 'Tên đăng nhập hoặc mã PIN không chính xác.');
  END IF;

  -- 4. Kiểm tra tạm khóa tài khoản do nhập sai nhiều lần
  IF v_cred.locked_until IS NOT NULL AND v_cred.locked_until > now() THEN
    INSERT INTO public.employee_login_audit (shop_id, user_id, login_name, device_id, status, details)
    VALUES (v_shop.id, v_cred.user_id, p_login_name, p_device_id, 'LOCKED', jsonb_build_object('locked_until', v_cred.locked_until));

    RETURN jsonb_build_object(
      'success', false, 
      'error', 'ACCOUNT_LOCKED', 
      'message', 'Tài khoản tạm khóa 15 phút do nhập sai PIN 5 lần. Vui lòng thử lại sau.'
    );
  END IF;

  -- 5. Xác minh Hash PIN
  IF extensions.crypt(p_pin, v_cred.pin_hash) <> v_cred.pin_hash THEN
    -- Tăng số lần sai
    UPDATE public.employee_pin_credentials
    SET failed_attempts = failed_attempts + 1,
        locked_until = CASE WHEN failed_attempts + 1 >= 5 THEN now() + INTERVAL '15 minutes' ELSE NULL END,
        updated_at = now()
    WHERE id = v_cred.id;

    INSERT INTO public.employee_login_audit (shop_id, user_id, login_name, device_id, status, details)
    VALUES (v_shop.id, v_cred.user_id, p_login_name, p_device_id, 'WRONG_PIN', jsonb_build_object('attempts', v_cred.failed_attempts + 1));

    RETURN jsonb_build_object(
      'success', false, 
      'error', 'WRONG_PIN', 
      'message', CASE 
        WHEN v_cred.failed_attempts + 1 >= 5 THEN 'Nhập sai PIN 5 lần. Tài khoản bị tạm khóa 15 phút.'
        ELSE 'Mã PIN 6 số không đúng (còn ' || (5 - (v_cred.failed_attempts + 1)) || ' lần thử).'
      END
    );
  END IF;

  -- Reset failed attempts khi đăng nhập đúng PIN
  UPDATE public.employee_pin_credentials
  SET failed_attempts = 0, locked_until = NULL, last_login_at = now(), updated_at = now()
  WHERE id = v_cred.id;

  -- 6. Kiểm tra Profile & Quyền thành viên trong Shop
  SELECT id, email, full_name, avatar_url, status INTO v_profile FROM public.profiles WHERE id = v_cred.user_id;
  IF v_profile IS NULL OR v_profile.status = 'disabled' THEN
    RETURN jsonb_build_object('success', false, 'error', 'USER_DISABLED', 'message', 'Hồ sơ nhân viên đã bị vô hiệu hóa.');
  END IF;

  SELECT id, role, status INTO v_member FROM public.shop_members WHERE shop_id = v_shop.id AND user_id = v_cred.user_id AND removed_at IS NULL;
  IF v_member IS NULL OR v_member.status = 'disabled' THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_SHOP_MEMBER', 'message', 'Nhân viên không còn thuộc cửa hàng này.');
  END IF;

  -- 7. KIỂM TRA VÀ XỬ LÝ THIẾT BỊ (DEVICE GATE)
  v_device_name := COALESCE(p_device_info->>'device_name', 'Chrome Extension');
  v_staff_name := COALESCE(v_profile.full_name, p_login_name);
  v_browser := COALESCE(p_device_info->>'browser', 'Chrome');
  v_os_info := COALESCE(p_device_info->>'os_info', 'Windows');

  -- Tìm thiết bị trong bảng extension_devices
  SELECT id, device_id, status, revoked
  INTO v_device
  FROM public.extension_devices
  WHERE shop_id = v_shop.id AND device_id = p_device_id
  LIMIT 1;

  -- Nếu thiết bị đã bị thu hồi
  IF v_device IS NOT NULL AND (COALESCE(v_device.revoked, false) = true OR v_device.status = 'revoked') THEN
    INSERT INTO public.employee_login_audit (shop_id, user_id, login_name, device_id, status, details)
    VALUES (v_shop.id, v_cred.user_id, p_login_name, p_device_id, 'DEVICE_REVOKED', jsonb_build_object('device_id', p_device_id));

    RETURN jsonb_build_object(
      'success', false, 
      'error', 'DEVICE_REVOKED', 
      'message', 'Máy trạm này đã bị Chủ Shop thu hồi quyền truy cập.'
    );
  END IF;

  -- Lấy hạn mức thiết bị của Shop
  SELECT max_devices INTO v_quota FROM public.shop_quotas WHERE shop_id = v_shop.id;
  v_max_devices := COALESCE(v_quota.max_devices, 5);

  -- Đếm số thiết bị đang active hiện tại
  SELECT COUNT(*) INTO v_active_devices
  FROM public.extension_devices
  WHERE shop_id = v_shop.id AND status = 'active' AND COALESCE(revoked, false) = false;

  -- Nếu là máy mới hoàn toàn chưa đăng ký
  IF v_device IS NULL THEN
    IF COALESCE(v_shop.auto_approve_devices, true) AND v_active_devices < v_max_devices THEN
      -- Tự động duyệt máy mới
      INSERT INTO public.extension_devices (
        shop_id, device_id, device_name, staff_name, user_id, browser, os_info,
        status, revoked, auto_approved, approved_at, last_seen, created_at, updated_at
      )
      VALUES (
        v_shop.id, p_device_id, v_device_name, v_staff_name, v_cred.user_id, v_browser, v_os_info,
        'active', false, true, now(), now(), now(), now()
      )
      RETURNING * INTO v_device;
    ELSE
      -- Máy cần Chủ Shop duyệt
      INSERT INTO public.extension_devices (
        shop_id, device_id, device_name, staff_name, user_id, browser, os_info,
        status, revoked, auto_approved, last_seen, created_at, updated_at
      )
      VALUES (
        v_shop.id, p_device_id, v_device_name, v_staff_name, v_cred.user_id, v_browser, v_os_info,
        'pending_approval', false, false, now(), now(), now()
      )
      RETURNING * INTO v_device;

      INSERT INTO public.employee_login_audit (shop_id, user_id, login_name, device_id, status, details)
      VALUES (v_shop.id, v_cred.user_id, p_login_name, p_device_id, 'DEVICE_PENDING', jsonb_build_object('quota', v_max_devices, 'active', v_active_devices));

      RETURN jsonb_build_object(
        'success', false,
        'error', 'DEVICE_PENDING_APPROVAL',
        'device_id', p_device_id,
        'shop_name', v_shop.name,
        'shop_code', v_shop.shop_code,
        'staff_name', v_staff_name,
        'message', 'Thiết bị máy trạm mới đang chờ Chủ Shop phê duyệt trước khi bắt đầu làm việc.'
      );
    END IF;
  ELSE
    -- Nếu máy đã có nhưng đang ở trạng thái pending_approval
    IF v_device.status = 'pending_approval' THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'DEVICE_PENDING_APPROVAL',
        'device_id', p_device_id,
        'shop_name', v_shop.name,
        'shop_code', v_shop.shop_code,
        'staff_name', v_staff_name,
        'message', 'Thiết bị máy trạm đang chờ Chủ Shop phê duyệt.'
      );
    END IF;

    -- Cập nhật thông tin máy và last_seen
    UPDATE public.extension_devices
    SET user_id = v_cred.user_id,
        staff_name = v_staff_name,
        browser = COALESCE(v_browser, browser),
        os_info = COALESCE(v_os_info, os_info),
        last_seen = now(),
        updated_at = now()
    WHERE id = v_device.id;
  END IF;

  -- 8. TẠO PHIÊN ĐĂNG NHẬP THIẾT BỊ (DEVICE SESSION)
  INSERT INTO public.device_sessions (shop_id, user_id, device_id, session_token, expires_at, created_at)
  VALUES (v_shop.id, v_cred.user_id, p_device_id, 'token_' || gen_random_uuid()::text, now() + INTERVAL '30 days', now());

  -- Ghi nhận audit đăng nhập thành công
  INSERT INTO public.employee_login_audit (shop_id, user_id, login_name, device_id, status, details)
  VALUES (v_shop.id, v_cred.user_id, p_login_name, p_device_id, 'SUCCESS', jsonb_build_object('device_name', v_device_name));

  -- 9. TRẢ VỀ THÔNG TIN PHIÊN ĐĂNG NHẬP
  RETURN jsonb_build_object(
    'success', true,
    'user', jsonb_build_object(
      'id', v_profile.id,
      'email', v_profile.email,
      'full_name', COALESCE(v_profile.full_name, p_login_name),
      'avatar_url', v_profile.avatar_url,
      'role', COALESCE(v_member.role, 'STAFF'),
      'login_name', p_login_name
    ),
    'shop', jsonb_build_object(
      'id', v_shop.id,
      'name', v_shop.name,
      'shop_code', v_shop.shop_code
    ),
    'device', jsonb_build_object(
      'device_id', p_device_id,
      'device_name', v_device_name,
      'status', 'active'
    ),
    'permissions', jsonb_build_array('orders.read', 'orders.create', 'orders.update', 'ai.parse')
  );
END;
$$;

-- Allow anon to call employee_pin_login with rate-limiting and PIN protection
GRANT EXECUTE ON FUNCTION public.employee_pin_login(TEXT, TEXT, TEXT, TEXT, JSONB) TO anon, authenticated, service_role;

-- 10. RPC: owner_approve_device & owner_reject_device (Duyệt máy mới)
DROP FUNCTION IF EXISTS public.owner_approve_device(UUID, TEXT);
CREATE OR REPLACE FUNCTION public.owner_approve_device(
  p_shop_id UUID,
  p_device_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT (public.is_shop_owner_or_manager(p_shop_id) OR public.is_system_admin()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'Không có quyền phê duyệt thiết bị.');
  END IF;

  UPDATE public.extension_devices
  SET status = 'active', revoked = false, approved_by = auth.uid(), approved_at = now(), updated_at = now()
  WHERE shop_id = p_shop_id AND (device_id = p_device_id OR id::text = p_device_id);

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND', 'message', 'Không tìm thấy thiết bị cần duyệt.');
  END IF;

  RETURN jsonb_build_object('success', true, 'status', 'active', 'message', 'Đã phê duyệt thiết bị máy trạm.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_approve_device(UUID, TEXT) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.owner_approve_device(UUID, TEXT) FROM anon;

DROP FUNCTION IF EXISTS public.owner_reject_device(UUID, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.owner_reject_device(
  p_shop_id UUID,
  p_device_id TEXT,
  p_reason TEXT DEFAULT 'REJECTED_BY_OWNER'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT (public.is_shop_owner_or_manager(p_shop_id) OR public.is_system_admin()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'Không có quyền từ chối thiết bị.');
  END IF;

  UPDATE public.extension_devices
  SET status = 'revoked', revoked = true, revoked_by = auth.uid(), revoked_at = now(),
      revoke_reason = COALESCE(p_reason, 'REJECTED_BY_OWNER'), updated_at = now()
  WHERE shop_id = p_shop_id AND (device_id = p_device_id OR id::text = p_device_id);

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND', 'message', 'Không tìm thấy thiết bị.');
  END IF;

  RETURN jsonb_build_object('success', true, 'status', 'revoked', 'message', 'Đã từ chối và chặn thiết bị máy trạm.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_reject_device(UUID, TEXT, TEXT) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.owner_reject_device(UUID, TEXT, TEXT) FROM anon;

-- 11. RPC: owner_get_devices_v3 (Danh sách thiết bị đầy đủ kèm trạng thái pending/active/revoked & PIN status)
DROP FUNCTION IF EXISTS public.owner_get_devices_v3(UUID, TEXT);
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
      'status', COALESCE(d.status, CASE WHEN COALESCE(d.revoked, false) THEN 'revoked' ELSE 'active' END),
      'revoked', COALESCE(d.revoked, false),
      'auto_approved', COALESCE(d.auto_approved, false),
      'approved_at', d.approved_at,
      'created_at', d.created_at,
      'has_pin', EXISTS (SELECT 1 FROM public.employee_pin_credentials epc WHERE epc.shop_id = p_shop_id AND epc.user_id = d.user_id)
    ) ORDER BY 
      CASE COALESCE(d.status, 'active')
        WHEN 'pending_approval' THEN 1
        WHEN 'active' THEN 2
        ELSE 3
      END,
      d.last_seen DESC NULLS LAST, d.created_at DESC
  ), '[]'::jsonb) INTO v_devices
  FROM public.extension_devices d
  LEFT JOIN public.profiles p ON p.id = d.user_id
  WHERE d.shop_id = p_shop_id
    AND (
      p_filter_status = 'ALL' 
      OR (p_filter_status = 'PENDING' AND d.status = 'pending_approval')
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

NOTIFY pgrst, 'reload schema';
