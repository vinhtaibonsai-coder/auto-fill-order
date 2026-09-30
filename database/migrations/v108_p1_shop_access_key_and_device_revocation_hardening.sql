-- =========================================================================
-- Migration v108: P1 shop access key entropy + revoked device hardening
-- =========================================================================

CREATE OR REPLACE FUNCTION public.generate_shop_access_key()
RETURNS TEXT
LANGUAGE sql
VOLATILE
SET search_path = ''
AS $$
  SELECT 'KEY-SHOP-' ||
         upper(replace(pg_catalog.gen_random_uuid()::text, '-', '') ||
               substr(replace(pg_catalog.gen_random_uuid()::text, '-', ''), 1, 16));
$$;

UPDATE public.shops
SET shop_access_key = public.generate_shop_access_key(),
    updated_at = now()
WHERE shop_access_key IS NULL
   OR btrim(shop_access_key) = ''
   OR shop_access_key ~ '^KEY-SHOP-[A-Fa-f0-9]{8}$';

CREATE OR REPLACE FUNCTION public.set_default_shop_access_key()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.shop_access_key IS NULL OR btrim(NEW.shop_access_key) = '' THEN
    NEW.shop_access_key := public.generate_shop_access_key();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_default_shop_access_key ON public.shops;
CREATE TRIGGER trg_set_default_shop_access_key
BEFORE INSERT ON public.shops
FOR EACH ROW EXECUTE FUNCTION public.set_default_shop_access_key();

CREATE OR REPLACE FUNCTION public.admin_reset_shop_access_key(p_shop_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_new_key TEXT;
  v_user_id UUID := auth.uid();
BEGIN
  IF NOT (public.is_shop_owner_or_manager(p_shop_id) OR public.is_system_admin()) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Ban khong co quyen quan tri cua hang nay.');
  END IF;

  v_new_key := public.generate_shop_access_key();

  UPDATE public.shops
  SET shop_access_key = v_new_key,
      updated_at = now()
  WHERE id = p_shop_id;

  INSERT INTO public.audit_logs (actor_id, shop_id, action, target_resource, target_id, new_value)
  VALUES (v_user_id, p_shop_id, 'RESET_SHOP_ACCESS_KEY', 'shops', p_shop_id::text, jsonb_build_object('shop_access_key_rotated', true)::text);

  RETURN jsonb_build_object(
    'success', true,
    'shop_id', p_shop_id,
    'shop_access_key', v_new_key,
    'message', 'Da doi ma Shop Access Key thanh cong.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.generate_shop_access_key() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_default_shop_access_key() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_reset_shop_access_key(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_reset_shop_access_key(UUID) TO authenticated, service_role;

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
SET search_path = ''
AS $$
DECLARE
  v_shop RECORD;
  v_quota RECORD;
  v_existing RECORD;
  v_clean_key TEXT := upper(btrim(p_access_key));
  v_clean_device_id TEXT := btrim(coalesce(p_device_id, 'dev_unknown'));
  v_clean_staff_name TEXT := btrim(coalesce(p_staff_name, 'Nhan vien kho'));
  v_clean_device_name TEXT := btrim(coalesce(p_device_name, v_clean_staff_name));
BEGIN
  IF v_clean_key IS NULL OR v_clean_key = '' THEN
    RETURN jsonb_build_object('success', false, 'code', 'KEY_REQUIRED', 'message', 'Vui long nhap ma Shop Access Key.');
  END IF;

  SELECT id, name, status, owner_id INTO v_shop
  FROM public.shops
  WHERE upper(shop_access_key) = v_clean_key
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_KEY', 'message', 'Ma Shop Key khong chinh xac hoac da bi doi.');
  END IF;

  IF v_shop.status = 'suspended' OR v_shop.status = 'inactive' THEN
    RETURN jsonb_build_object('success', false, 'code', 'SHOP_INACTIVE', 'message', 'Cua hang dang tam khoa.');
  END IF;

  SELECT * INTO v_existing
  FROM public.extension_devices
  WHERE shop_id = v_shop.id AND device_id = v_clean_device_id
  ORDER BY updated_at DESC NULLS LAST, last_seen DESC NULLS LAST
  LIMIT 1;

  IF v_existing.id IS NOT NULL
     AND (coalesce(v_existing.revoked, false)
          OR coalesce(v_existing.status, '') IN ('revoked', 'blocked', 'suspended')) THEN
    RETURN jsonb_build_object('success', false, 'code', 'DEVICE_REVOKED', 'message', 'Thiet bi da bi thu hoi quyen truy cap.');
  END IF;

  IF v_existing.id IS NOT NULL THEN
    UPDATE public.extension_devices
    SET user_id = coalesce(user_id, v_shop.owner_id),
        device_name = v_clean_device_name,
        staff_name = v_clean_staff_name,
        last_seen = now(),
        browser = p_browser,
        os_info = p_os_info,
        updated_at = now()
    WHERE id = v_existing.id;
  ELSE
    INSERT INTO public.extension_devices (
      shop_id, user_id, device_id, device_name, staff_name, browser, os_info,
      last_seen, revoked, status, created_at, updated_at
    )
    VALUES (
      v_shop.id, v_shop.owner_id, v_clean_device_id, v_clean_device_name,
      v_clean_staff_name, p_browser, p_os_info, now(), false, 'active', now(), now()
    );
  END IF;

  INSERT INTO public.shop_quotas (shop_id, max_devices, max_users, monthly_order_limit, daily_ai_limit, monthly_ai_limit)
  VALUES (v_shop.id, 5, 5, 1000, 500, 10000)
  ON CONFLICT (shop_id) DO NOTHING;

  BEGIN
    PERFORM public._ai_refresh_monthly_window(v_shop.id);
  EXCEPTION WHEN OTHERS THEN
  END;

  SELECT daily_ai_limit,
         CASE WHEN daily_reset_at::date <> CURRENT_DATE THEN 0 ELSE daily_ai_used END AS daily_ai_used,
         monthly_ai_limit,
         monthly_ai_used
  INTO v_quota
  FROM public.shop_quotas
  WHERE shop_id = v_shop.id;

  RETURN jsonb_build_object(
    'success', true,
    'shop_id', v_shop.id,
    'shop_name', v_shop.name,
    'staff_name', v_clean_staff_name,
    'daily_limit', coalesce(v_quota.daily_ai_limit, 500),
    'daily_used', coalesce(v_quota.daily_ai_used, 0),
    'monthly_limit', coalesce(v_quota.monthly_ai_limit, 10000),
    'monthly_used', coalesce(v_quota.monthly_ai_used, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.verify_shop_access_key(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_shop_access_key(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.check_shop_member_or_admin(p_shop_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NULLIF(current_setting('request.jwt.claim.role', true), '') = 'service_role' 
     OR current_user = 'service_role' 
     OR current_user = 'postgres' THEN
    RETURN true;
  END IF;

  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.shop_members sm
    WHERE sm.shop_id = p_shop_id
      AND sm.user_id = auth.uid()
      AND sm.status = 'active'
      AND sm.removed_at IS NULL
  ) OR public.is_system_admin();
END;
$$;

REVOKE ALL ON FUNCTION public.check_shop_member_or_admin(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_shop_member_or_admin(UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.consume_ai_quota(UUID, INT, INT, INT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_ai_quota(UUID, INT, INT, INT, TEXT, TEXT) TO authenticated, service_role;
