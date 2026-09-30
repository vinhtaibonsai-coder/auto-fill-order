-- =============================================================================
-- Migration v89: Client Installation Surface & Quota Separation
--
-- Extension workstations are the only billable device class. Web sessions and
-- localhost development sessions remain visible for audit but never consume
-- the Extension workstation quota.
-- =============================================================================

ALTER TABLE public.extension_devices
  ADD COLUMN IF NOT EXISTS client_type TEXT NOT NULL DEFAULT 'LEGACY_UNKNOWN',
  ADD COLUMN IF NOT EXISTS environment TEXT NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN IF NOT EXISTS last_surface TEXT NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN IF NOT EXISTS origin_host TEXT,
  ADD COLUMN IF NOT EXISTS installation_id TEXT,
  ADD COLUMN IF NOT EXISTS is_billable BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.device_sessions
  ADD COLUMN IF NOT EXISTS client_type TEXT NOT NULL DEFAULT 'LEGACY_UNKNOWN',
  ADD COLUMN IF NOT EXISTS environment TEXT NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN IF NOT EXISTS surface TEXT NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN IF NOT EXISTS origin_host TEXT;

UPDATE public.extension_devices
SET installation_id = COALESCE(NULLIF(installation_id, ''), device_id)
WHERE installation_id IS NULL OR installation_id = '';

CREATE INDEX IF NOT EXISTS idx_extension_devices_quota_v89
  ON public.extension_devices(shop_id, client_type, environment, status, approved, revoked, is_billable);
CREATE INDEX IF NOT EXISTS idx_extension_devices_surface_v89
  ON public.extension_devices(shop_id, client_type, environment, last_seen DESC);

-- Parameter defaults cannot be removed or reshaped with CREATE OR REPLACE.
-- Drop the exact v86 signature first, without CASCADE, then create one canonical RPC.
DROP FUNCTION IF EXISTS public.register_extension_device(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, JSONB);

CREATE FUNCTION public.register_extension_device(
  p_device_id TEXT,
  p_device_name TEXT,
  p_browser TEXT,
  p_os_info TEXT,
  p_client_version TEXT,
  p_fingerprint_hash TEXT,
  p_shop_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_client_type TEXT DEFAULT 'EXTENSION',
  p_environment TEXT DEFAULT 'PRODUCTION',
  p_surface TEXT DEFAULT 'EXTENSION_PANEL',
  p_origin_host TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_target_shop UUID := p_shop_id;
  v_device_id TEXT := TRIM(COALESCE(p_device_id, ''));
  v_client_type TEXT := UPPER(TRIM(COALESCE(p_client_type, 'EXTENSION')));
  v_environment TEXT := UPPER(TRIM(COALESCE(p_environment, 'PRODUCTION')));
  v_surface TEXT := UPPER(TRIM(COALESCE(p_surface, 'UNKNOWN')));
  v_is_billable BOOLEAN;
  v_active INT := 0;
  v_limit INT := 5;
  v_existing public.extension_devices%ROWTYPE;
  v_is_owner BOOLEAN := false;
  v_auto_approve BOOLEAN := true;
  v_approved BOOLEAN := true;
  v_status TEXT := 'active';
  v_full_name TEXT;
  v_email TEXT;
  v_staff_name TEXT;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF v_device_id = '' THEN RAISE EXCEPTION 'DEVICE_IDENTITY_REQUIRED'; END IF;
  IF v_client_type NOT IN ('EXTENSION', 'WEB') THEN v_client_type := 'WEB'; END IF;
  IF v_environment NOT IN ('LOCAL', 'PREVIEW', 'PRODUCTION') THEN v_environment := 'PRODUCTION'; END IF;

  v_is_billable := (v_client_type = 'EXTENSION' AND v_environment = 'PRODUCTION');

  IF v_target_shop IS NULL THEN
    SELECT sm.shop_id INTO v_target_shop
    FROM public.shop_members sm
    WHERE sm.user_id = v_user AND sm.removed_at IS NULL
    ORDER BY sm.created_at ASC
    LIMIT 1;
  END IF;
  IF v_target_shop IS NULL THEN RAISE EXCEPTION 'SHOP_REQUIRED'; END IF;

  IF NOT (
    EXISTS (SELECT 1 FROM public.shops s WHERE s.id = v_target_shop AND s.owner_id = v_user)
    OR EXISTS (SELECT 1 FROM public.shop_members sm WHERE sm.shop_id = v_target_shop AND sm.user_id = v_user AND sm.removed_at IS NULL)
    OR public.is_system_admin()
  ) THEN
    RAISE EXCEPTION 'SHOP_ACCESS_DENIED';
  END IF;

  SELECT s.owner_id = v_user, COALESCE(s.auto_approve_devices, true)
  INTO v_is_owner, v_auto_approve
  FROM public.shops s WHERE s.id = v_target_shop;

  SELECT p.full_name, p.email INTO v_full_name, v_email
  FROM public.profiles p WHERE p.id = v_user LIMIT 1;
  v_staff_name := COALESCE(NULLIF(TRIM(p_metadata->>'staff_name'), ''), NULLIF(TRIM(v_full_name), ''), v_email, 'Nhân viên');

  SELECT * INTO v_existing
  FROM public.extension_devices d
  WHERE d.shop_id = v_target_shop
    AND d.device_id = v_device_id
    AND d.client_type = v_client_type
    AND d.environment = v_environment
  ORDER BY d.last_seen DESC NULLS LAST
  LIMIT 1;

  -- Adopt a pre-v89 row on its first post-migration sync instead of creating a duplicate.
  IF v_existing.id IS NULL THEN
    SELECT * INTO v_existing
    FROM public.extension_devices d
    WHERE d.shop_id = v_target_shop
      AND d.device_id = v_device_id
      AND d.client_type = 'LEGACY_UNKNOWN'
    ORDER BY d.last_seen DESC NULLS LAST
    LIMIT 1;
  END IF;

  SELECT COUNT(*) INTO v_active
  FROM public.extension_devices
  WHERE shop_id = v_target_shop
    AND client_type = 'EXTENSION'
    AND environment = 'PRODUCTION'
    AND COALESCE(revoked, false) = false
    AND status = 'active'
    AND approved = true
    AND is_billable = true;

  SELECT COALESCE(su.max_devices, q.max_devices, 5) INTO v_limit
  FROM public.shops sh
  LEFT JOIN public.subscriptions su ON su.shop_id = sh.id
  LEFT JOIN public.shop_quotas q ON q.shop_id = sh.id
  WHERE sh.id = v_target_shop
  LIMIT 1;
  v_limit := COALESCE(v_limit, 5);

  IF v_existing.id IS NOT NULL THEN
    IF COALESCE(v_existing.revoked, false) OR v_existing.status IN ('revoked', 'blocked', 'suspended') THEN
      RETURN jsonb_build_object('success', false, 'error', 'DEVICE_REVOKED', 'message', 'Thiết bị đã bị thu hồi quyền truy cập.');
    END IF;
    IF v_existing.status = 'pending_approval' OR v_existing.approved = false THEN
      RETURN jsonb_build_object('success', false, 'error', 'DEVICE_PENDING_APPROVAL', 'message', 'Thiết bị đang chờ Chủ Shop phê duyệt.');
    END IF;

    UPDATE public.extension_devices
    SET user_id = v_user,
        device_name = COALESCE(NULLIF(TRIM(p_device_name), ''), v_existing.device_name, 'Máy trạm'),
        staff_name = v_staff_name,
        browser = COALESCE(p_browser, v_existing.browser),
        os_info = COALESCE(p_os_info, v_existing.os_info),
        client_version = COALESCE(p_client_version, v_existing.client_version),
        version = COALESCE(p_client_version, v_existing.version),
        fingerprint_hash = COALESCE(p_fingerprint_hash, v_existing.fingerprint_hash),
        metadata = COALESCE(p_metadata, '{}'::jsonb),
        client_type = v_client_type,
        environment = v_environment,
        last_surface = v_surface,
        origin_host = NULLIF(TRIM(COALESCE(p_origin_host, '')), ''),
        installation_id = v_device_id,
        is_billable = v_is_billable,
        is_owner_device = v_is_owner,
        last_seen = now(),
        updated_at = now()
    WHERE id = v_existing.id;

    RETURN jsonb_build_object('success', true, 'updated', true, 'device_id', v_device_id,
      'client_type', v_client_type, 'environment', v_environment,
      'is_billable', v_is_billable, 'active_devices', v_active, 'max_devices', v_limit);
  END IF;

  IF v_is_billable AND v_active >= v_limit THEN
    RETURN jsonb_build_object('success', false, 'error', 'DEVICE_LIMIT_EXCEEDED',
      'message', 'Đã sử dụng hết hạn mức máy Extension (' || v_active || '/' || v_limit || ').',
      'active_devices', v_active, 'max_devices', v_limit);
  END IF;

  IF v_is_billable THEN
    v_approved := v_is_owner OR v_auto_approve;
    v_status := CASE WHEN v_approved THEN 'active' ELSE 'pending_approval' END;
  END IF;

  INSERT INTO public.extension_devices (
    user_id, shop_id, device_id, installation_id, device_name, staff_name,
    browser, os_info, client_version, version, fingerprint_hash, metadata,
    client_type, environment, last_surface, origin_host, is_billable,
    status, revoked, approved, auto_approved, is_owner_device,
    last_seen, created_at, updated_at
  ) VALUES (
    v_user, v_target_shop, v_device_id, v_device_id,
    LEFT(TRIM(COALESCE(p_device_name, 'Máy trạm')), 100), v_staff_name,
    p_browser, p_os_info, p_client_version, p_client_version, p_fingerprint_hash, COALESCE(p_metadata, '{}'::jsonb),
    v_client_type, v_environment, v_surface, NULLIF(TRIM(COALESCE(p_origin_host, '')), ''), v_is_billable,
    v_status, false, v_approved, v_approved, v_is_owner,
    now(), now(), now()
  );

  IF v_status = 'pending_approval' THEN
    RETURN jsonb_build_object('success', false, 'error', 'DEVICE_PENDING_APPROVAL',
      'message', 'Máy Extension mới đang chờ Chủ Shop phê duyệt.', 'device_id', v_device_id);
  END IF;

  RETURN jsonb_build_object('success', true, 'created', true, 'device_id', v_device_id,
    'client_type', v_client_type, 'environment', v_environment,
    'is_billable', v_is_billable, 'active_devices', v_active + CASE WHEN v_is_billable THEN 1 ELSE 0 END,
    'max_devices', v_limit);
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_extension_device(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, JSONB, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.register_extension_device(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, JSONB, TEXT, TEXT, TEXT, TEXT) FROM anon;

-- PIN login keeps its existing signature; context travels inside p_device_info.
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
  v_device public.extension_devices%ROWTYPE;
  v_user_id UUID;
  v_is_owner BOOLEAN := false;
  v_client_type TEXT := UPPER(TRIM(COALESCE(p_device_info->>'client_type', 'EXTENSION')));
  v_environment TEXT := UPPER(TRIM(COALESCE(p_device_info->>'environment', 'PRODUCTION')));
  v_surface TEXT := UPPER(TRIM(COALESCE(p_device_info->>'surface', 'EXTENSION_PANEL')));
  v_origin_host TEXT := NULLIF(TRIM(COALESCE(p_device_info->>'origin_host', '')), '');
  v_is_billable BOOLEAN;
  v_active INT := 0;
  v_limit INT := 5;
  v_approved BOOLEAN := true;
  v_status TEXT := 'active';
  v_token TEXT;
BEGIN
  p_shop_code := UPPER(TRIM(COALESCE(p_shop_code, '')));
  p_login_name := LOWER(TRIM(COALESCE(p_login_name, '')));
  p_device_id := TRIM(COALESCE(p_device_id, ''));
  IF p_shop_code = '' THEN RETURN jsonb_build_object('success', false, 'error', 'MISSING_SHOP_CODE', 'message', 'Vui lòng nhập Mã Shop.'); END IF;
  IF p_login_name = '' THEN RETURN jsonb_build_object('success', false, 'error', 'MISSING_LOGIN_NAME', 'message', 'Vui lòng nhập tên đăng nhập.'); END IF;
  IF p_device_id = '' THEN RETURN jsonb_build_object('success', false, 'error', 'DEVICE_IDENTITY_REQUIRED', 'message', 'Không nhận diện được bản cài đăng nhập.'); END IF;
  IF v_client_type NOT IN ('EXTENSION', 'WEB') THEN v_client_type := 'WEB'; END IF;
  IF v_environment NOT IN ('LOCAL', 'PREVIEW', 'PRODUCTION') THEN v_environment := 'PRODUCTION'; END IF;
  v_is_billable := (v_client_type = 'EXTENSION' AND v_environment = 'PRODUCTION');

  SELECT id, name, shop_code, shop_access_key, owner_id, status, auto_approve_devices, require_staff_pin
  INTO v_shop
  FROM public.shops
  WHERE (UPPER(COALESCE(shop_code, '')) = p_shop_code
    OR UPPER(COALESCE(shop_access_key, '')) = p_shop_code
    OR UPPER(REPLACE(COALESCE(shop_access_key, ''), 'KEY-SHOP-', '')) = p_shop_code
    OR id::text = p_shop_code)
    AND (status IS NULL OR status = 'active') AND deleted_at IS NULL
  LIMIT 1;
  IF v_shop IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'SHOP_NOT_FOUND', 'message', 'Mã Shop không tồn tại hoặc đã bị khóa.'); END IF;

  SELECT * INTO v_cred
  FROM public.employee_pin_credentials
  WHERE shop_id = v_shop.id AND lower(login_name) = p_login_name
  LIMIT 1;
  IF v_cred IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'PIN_ACCOUNT_NOT_CONFIGURED', 'message', 'Tài khoản chưa được Chủ Shop cấp PIN.');
  END IF;
  IF v_cred.locked_until IS NOT NULL AND v_cred.locked_until > now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'ACCOUNT_LOCKED', 'message', 'Tài khoản đang tạm khóa do nhập sai PIN nhiều lần.');
  END IF;
  IF p_pin IS NULL OR p_pin = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'PIN_REQUIRED', 'message', 'Vui lòng nhập PIN 6 số.');
  END IF;
  IF v_cred.pin_hash IS NULL OR extensions.crypt(p_pin, v_cred.pin_hash) <> v_cred.pin_hash THEN
    UPDATE public.employee_pin_credentials
    SET failed_attempts = COALESCE(failed_attempts, 0) + 1,
        locked_until = CASE WHEN COALESCE(failed_attempts, 0) + 1 >= 5 THEN now() + INTERVAL '15 minutes' ELSE NULL END
    WHERE id = v_cred.id;
    RETURN jsonb_build_object('success', false, 'error', 'WRONG_PIN', 'message', 'Mã PIN 6 số không đúng.');
  END IF;
  UPDATE public.employee_pin_credentials SET failed_attempts = 0, locked_until = NULL, last_login_at = now() WHERE id = v_cred.id;

  v_user_id := v_cred.user_id;
  SELECT id, email, full_name, avatar_url, status INTO v_profile FROM public.profiles WHERE id = v_user_id LIMIT 1;
  v_is_owner := (v_user_id = v_shop.owner_id);

  SELECT * INTO v_device
  FROM public.extension_devices d
  WHERE d.shop_id = v_shop.id AND d.device_id = p_device_id
    AND d.client_type = v_client_type AND d.environment = v_environment
  ORDER BY d.last_seen DESC NULLS LAST LIMIT 1;
  IF v_device.id IS NULL THEN
    SELECT * INTO v_device FROM public.extension_devices d
    WHERE d.shop_id = v_shop.id AND d.device_id = p_device_id AND d.client_type = 'LEGACY_UNKNOWN'
    ORDER BY d.last_seen DESC NULLS LAST LIMIT 1;
  END IF;

  IF v_device.id IS NOT NULL AND (COALESCE(v_device.revoked, false) OR v_device.status IN ('revoked', 'blocked', 'suspended')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'DEVICE_REVOKED', 'message', 'Thiết bị đã bị Chủ Shop thu hồi.');
  END IF;
  IF v_device.id IS NOT NULL AND (v_device.status = 'pending_approval' OR v_device.approved = false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'DEVICE_PENDING_APPROVAL', 'message', 'Máy Extension đang chờ Chủ Shop phê duyệt.');
  END IF;

  SELECT COUNT(*) INTO v_active FROM public.extension_devices
  WHERE shop_id = v_shop.id
    AND client_type = 'EXTENSION'
    AND environment = 'PRODUCTION'
    AND approved = true
    AND is_billable = true
    AND COALESCE(revoked, false) = false
    AND status = 'active';
  SELECT COALESCE(su.max_devices, q.max_devices, 5) INTO v_limit
  FROM public.shops sh
  LEFT JOIN public.subscriptions su ON su.shop_id = sh.id
  LEFT JOIN public.shop_quotas q ON q.shop_id = sh.id
  WHERE sh.id = v_shop.id LIMIT 1;
  v_limit := COALESCE(v_limit, 5);

  IF v_device.id IS NULL AND v_is_billable AND v_active >= v_limit THEN
    RETURN jsonb_build_object('success', false, 'error', 'DEVICE_LIMIT_EXCEEDED', 'message', 'Đã sử dụng hết hạn mức máy Extension (' || v_active || '/' || v_limit || ').');
  END IF;

  IF v_device.id IS NULL THEN
    IF v_is_billable THEN
      v_approved := v_is_owner OR COALESCE(v_shop.auto_approve_devices, true);
      v_status := CASE WHEN v_approved THEN 'active' ELSE 'pending_approval' END;
    END IF;
    INSERT INTO public.extension_devices (
      shop_id, user_id, device_id, installation_id, device_name, staff_name, browser, os_info,
      client_type, environment, last_surface, origin_host, is_billable,
      status, revoked, approved, auto_approved, is_owner_device, last_seen, created_at, updated_at
    ) VALUES (
      v_shop.id, v_user_id, p_device_id, p_device_id,
      COALESCE(p_device_info->>'device_name', 'Chrome Workstation'), COALESCE(v_profile.full_name, p_login_name),
      COALESCE(p_device_info->>'browser', 'Chrome'), COALESCE(p_device_info->>'os_info', 'Windows'),
      v_client_type, v_environment, v_surface, v_origin_host, v_is_billable,
      v_status, false, v_approved, v_approved, v_is_owner, now(), now(), now()
    ) RETURNING * INTO v_device;
  ELSE
    UPDATE public.extension_devices
    SET user_id = v_user_id,
        staff_name = COALESCE(v_profile.full_name, p_login_name),
        device_name = COALESCE(p_device_info->>'device_name', device_name),
        browser = COALESCE(p_device_info->>'browser', browser),
        os_info = COALESCE(p_device_info->>'os_info', os_info),
        client_type = v_client_type,
        environment = v_environment,
        last_surface = v_surface,
        origin_host = v_origin_host,
        installation_id = p_device_id,
        is_billable = v_is_billable,
        is_owner_device = v_is_owner,
        last_seen = now(), updated_at = now()
    WHERE id = v_device.id
    RETURNING * INTO v_device;
  END IF;

  IF v_device.status = 'pending_approval' OR v_device.approved = false THEN
    RETURN jsonb_build_object('success', false, 'error', 'DEVICE_PENDING_APPROVAL', 'message', 'Máy Extension mới đang chờ Chủ Shop phê duyệt.');
  END IF;

  v_token := 'token_' || gen_random_uuid()::text;
  INSERT INTO public.device_sessions (
    shop_id, user_id, device_id, session_token, session_hash, expires_at, created_at,
    client_type, environment, surface, origin_host
  ) VALUES (
    v_shop.id, v_user_id, p_device_id, v_token, md5(v_token), now() + INTERVAL '60 days', now(),
    v_client_type, v_environment, v_surface, v_origin_host
  );

  RETURN jsonb_build_object(
    'success', true, 'session_token', v_token,
    'user', jsonb_build_object('id', v_user_id, 'email', v_profile.email, 'full_name', COALESCE(v_profile.full_name, p_login_name),
      'role', CASE WHEN v_is_owner THEN 'OWNER' ELSE 'STAFF' END, 'login_name', p_login_name, 'is_owner', v_is_owner),
    'shop', jsonb_build_object('id', v_shop.id, 'name', v_shop.name, 'shop_code', COALESCE(v_shop.shop_code, v_shop.shop_access_key), 'shop_access_key', v_shop.shop_access_key),
    'device', jsonb_build_object('device_id', p_device_id, 'device_name', v_device.device_name, 'status', v_device.status,
      'client_type', v_client_type, 'environment', v_environment, 'surface', v_surface, 'is_billable', v_is_billable, 'is_owner_device', v_is_owner),
    'permissions', CASE WHEN v_is_owner
      THEN jsonb_build_array('orders.read', 'orders.create', 'orders.update', 'orders.delete', 'ai.parse', 'shop.settings', 'devices.manage')
      ELSE jsonb_build_array('orders.read', 'orders.create', 'orders.update', 'ai.parse') END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.employee_pin_login(TEXT, TEXT, TEXT, TEXT, JSONB) TO anon, authenticated, service_role;

-- Approval enforces the same quota as registration; it cannot create 6/5.
CREATE OR REPLACE FUNCTION public.owner_approve_device(p_shop_id UUID, p_device_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_target public.extension_devices%ROWTYPE;
  v_active INT := 0;
  v_limit INT := 5;
BEGIN
  IF NOT (public.is_shop_owner_or_manager(p_shop_id) OR public.is_system_admin()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'Không có quyền phê duyệt thiết bị.');
  END IF;
  SELECT * INTO v_target FROM public.extension_devices
  WHERE shop_id = p_shop_id AND (device_id = p_device_id OR id::text = p_device_id)
  LIMIT 1;
  IF v_target.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND', 'message', 'Không tìm thấy thiết bị.'); END IF;

  IF v_target.is_billable AND NOT (v_target.status = 'active' AND v_target.approved = true AND COALESCE(v_target.revoked, false) = false) THEN
    SELECT COUNT(*) INTO v_active FROM public.extension_devices
    WHERE shop_id = p_shop_id AND client_type = 'EXTENSION' AND environment = 'PRODUCTION'
      AND approved = true AND is_billable = true AND COALESCE(revoked, false) = false AND status = 'active';
    SELECT COALESCE(su.max_devices, q.max_devices, 5) INTO v_limit
    FROM public.shops sh
    LEFT JOIN public.subscriptions su ON su.shop_id = sh.id
    LEFT JOIN public.shop_quotas q ON q.shop_id = sh.id
    WHERE sh.id = p_shop_id LIMIT 1;
    IF v_active >= COALESCE(v_limit, 5) THEN
      RETURN jsonb_build_object('success', false, 'error', 'DEVICE_LIMIT_EXCEEDED', 'message', 'Đã sử dụng hết hạn mức máy Extension.');
    END IF;
  END IF;

  UPDATE public.extension_devices
  SET status = 'active', revoked = false, approved = true, approved_by = auth.uid(), approved_at = now(), updated_at = now()
  WHERE id = v_target.id;
  RETURN jsonb_build_object('success', true, 'status', 'active', 'message', 'Đã phê duyệt bản cài đăng nhập.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_approve_device(UUID, TEXT) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.owner_approve_device(UUID, TEXT) FROM anon;

CREATE OR REPLACE FUNCTION public.owner_get_shop_staff_and_devices(p_shop_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE v_result JSONB;
BEGIN
  IF NOT (public.is_shop_owner_or_manager(p_shop_id) OR public.is_system_admin()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'Không có quyền truy cập thiết bị của Shop.');
  END IF;
  SELECT COALESCE(jsonb_agg(row_data ORDER BY (row_data->>'last_seen') DESC NULLS LAST), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT jsonb_build_object(
      'id', d.id, 'device_id', d.device_id, 'installation_id', d.installation_id,
      'device_name', d.device_name, 'staff_name', COALESCE(NULLIF(d.staff_name, ''), p.full_name, p.email, 'Nhân viên'),
      'browser', d.browser, 'os_info', d.os_info, 'last_ip', COALESCE(d.last_ip, d.ip_address),
      'last_seen', d.last_seen, 'status', d.status, 'approved', d.approved, 'revoked', COALESCE(d.revoked, false),
      'created_at', d.created_at, 'user_id', d.user_id, 'user_email', p.email, 'user_full_name', p.full_name,
      'member_role', COALESCE(sm.role, CASE WHEN s.owner_id = d.user_id THEN 'OWNER' ELSE 'STAFF' END),
      'is_owner_device', (s.owner_id = d.user_id OR COALESCE(d.is_owner_device, false)),
      'client_type', d.client_type, 'environment', d.environment, 'last_surface', d.last_surface,
      'origin_host', d.origin_host, 'is_billable', d.is_billable, 'metadata', COALESCE(d.metadata, '{}'::jsonb),
      'orders_count', COUNT(so.id), 'total_cod', COALESCE(SUM(so.cod_amount), 0), 'last_order_at', MAX(so.submitted_at)
    ) AS row_data
    FROM public.extension_devices d
    LEFT JOIN public.shops s ON s.id = p_shop_id
    LEFT JOIN public.profiles p ON p.id = d.user_id
    LEFT JOIN public.shop_members sm ON sm.user_id = d.user_id AND sm.shop_id = p_shop_id AND sm.removed_at IS NULL
    LEFT JOIN public.submitted_orders so ON so.shop_id = p_shop_id AND so.deleted_at IS NULL AND so.source_device_id = d.device_id
    WHERE d.shop_id = p_shop_id
    GROUP BY d.id, p.full_name, p.email, sm.role, s.owner_id
  ) rows;
  RETURN jsonb_build_object('success', true, 'staff_devices', v_result);
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_get_shop_staff_and_devices(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.owner_get_devices_v2(p_shop_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE v_devices JSONB; v_max INT := 5;
BEGIN
  IF NOT (public.is_shop_owner_or_manager(p_shop_id) OR public.is_system_admin()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'Không có quyền quản lý thiết bị.');
  END IF;
  SELECT COALESCE(su.max_devices, q.max_devices, 5) INTO v_max
  FROM public.shops sh LEFT JOIN public.subscriptions su ON su.shop_id = sh.id
  LEFT JOIN public.shop_quotas q ON q.shop_id = sh.id WHERE sh.id = p_shop_id LIMIT 1;
  SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.last_seen DESC NULLS LAST), '[]'::jsonb) INTO v_devices
  FROM (
    SELECT d.id, d.device_id, d.installation_id, d.device_name,
      COALESCE(NULLIF(d.staff_name, ''), p.full_name, p.email, 'Nhân viên') AS staff_name,
      d.browser, COALESCE(d.client_version, d.version) AS client_version, d.os_info,
      COALESCE(d.ip_address, d.last_ip) AS last_ip, d.last_location, d.last_seen,
      d.status, d.approved, COALESCE(d.revoked, false) AS revoked, d.user_id,
      p.email AS user_email, p.full_name, COALESCE(sm.role, CASE WHEN s.owner_id = d.user_id THEN 'OWNER' ELSE 'STAFF' END) AS role,
      (s.owner_id = d.user_id OR COALESCE(d.is_owner_device, false)) AS is_owner_device,
      d.client_type, d.environment, d.last_surface, d.origin_host, d.is_billable, COALESCE(d.metadata, '{}'::jsonb) AS metadata
    FROM public.extension_devices d
    LEFT JOIN public.shops s ON s.id = p_shop_id
    LEFT JOIN public.profiles p ON p.id = d.user_id
    LEFT JOIN public.shop_members sm ON sm.user_id = d.user_id AND sm.shop_id = p_shop_id AND sm.removed_at IS NULL
    WHERE d.shop_id = p_shop_id
  ) t;
  RETURN jsonb_build_object('success', true, 'devices', v_devices, 'max_devices', COALESCE(v_max, 5));
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_get_devices_v2(UUID) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
