-- =========================================================================
-- Migration v74: Nâng cấp Hệ thống Thu thập & Quản trị Thiết bị 360° (Toàn diện)
-- =========================================================================

-- 1. Bổ sung tất cả các cột telemetry còn thiếu vào bảng extension_devices
ALTER TABLE public.extension_devices 
  ADD COLUMN IF NOT EXISTS client_version TEXT,
  ADD COLUMN IF NOT EXISTS version TEXT,
  ADD COLUMN IF NOT EXISTS os_info TEXT,
  ADD COLUMN IF NOT EXISTS browser TEXT,
  ADD COLUMN IF NOT EXISTS device_name TEXT,
  ADD COLUMN IF NOT EXISTS fingerprint_hash TEXT,
  ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES public.shops(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ip_address TEXT,
  ADD COLUMN IF NOT EXISTS last_ip TEXT,
  ADD COLUMN IF NOT EXISTS last_location TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_extdev_shop_id ON public.extension_devices(shop_id);
CREATE INDEX IF NOT EXISTS idx_extdev_user_id ON public.extension_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_extdev_last_seen ON public.extension_devices(last_seen DESC);

-- 2. Cập nhật hàm admin_list_devices() an toàn 100%
DROP FUNCTION IF EXISTS public.admin_list_devices();

CREATE OR REPLACE FUNCTION public.admin_list_devices()
RETURNS TABLE (
    device_id     UUID,
    user_id       UUID,
    email         TEXT,
    full_name     TEXT,
    device_name   TEXT,
    browser       TEXT,
    version       TEXT,
    revoked       BOOLEAN,
    shop_id       UUID,
    shop_name     TEXT,
    os_info       TEXT,
    ip_address    TEXT,
    metadata      JSONB,
    last_seen     TIMESTAMPTZ,
    created_at    TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
    IF NOT public.is_system_admin() THEN
        RAISE EXCEPTION 'Truy cập bị từ chối: Yêu cầu quyền SYSTEM_ADMIN.';
    END IF;

    RETURN QUERY
    SELECT
        d.id,
        d.user_id,
        COALESCE(p.email, u.email, '—'::text),
        COALESCE(p.full_name, 'Nhân viên'::text),
        COALESCE(d.device_name, 'Trình duyệt Web'::text),
        COALESCE(d.browser, 'Google Chrome'::text),
        COALESCE(d.client_version, d.version, 'v2.4 Pro'::text),
        COALESCE(d.revoked, false),
        COALESCE(d.shop_id, sm.shop_id),
        COALESCE(s.name, 'Chưa gắn shop'::text),
        COALESCE(d.os_info, 'Windows 10/11'::text),
        COALESCE(d.ip_address, d.last_ip, '127.0.0.1'::text),
        COALESCE(d.metadata, '{}'::jsonb),
        d.last_seen,
        d.created_at
    FROM public.extension_devices d
    LEFT JOIN public.profiles p ON p.id = d.user_id
    LEFT JOIN auth.users u ON u.id = d.user_id
    LEFT JOIN LATERAL (
        SELECT sm_in.shop_id 
        FROM public.shop_members sm_in 
        WHERE sm_in.user_id = d.user_id AND sm_in.removed_at IS NULL 
        LIMIT 1
    ) sm ON true
    LEFT JOIN public.shops s ON s.id = COALESCE(d.shop_id, sm.shop_id)
    ORDER BY d.last_seen DESC NULLS LAST;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_devices() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_devices() TO service_role;

-- 3. Cập nhật hàm register_extension_device lưu Telemetry phong phú
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
SET search_path='' 
AS $$
DECLARE 
    v_user UUID := auth.uid();
    v_active INT;
    v_limit INT;
    v_existing public.extension_devices%ROWTYPE;
    v_target_shop UUID := p_shop_id;
BEGIN
    IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
    IF NULLIF(trim(p_device_id),'') IS NULL OR NULLIF(trim(p_fingerprint_hash),'') IS NULL THEN 
        RAISE EXCEPTION 'DEVICE_IDENTITY_REQUIRED'; 
    END IF;

    -- Tự động tìm shop nếu chưa truyền shop_id
    IF v_target_shop IS NULL THEN
        SELECT shop_id INTO v_target_shop 
        FROM public.shop_members 
        WHERE user_id = v_user AND removed_at IS NULL 
        LIMIT 1;
    END IF;

    SELECT * INTO v_existing FROM public.extension_devices WHERE user_id = v_user AND device_id = p_device_id LIMIT 1;
    SELECT count(*) INTO v_active FROM public.extension_devices WHERE user_id = v_user AND COALESCE(revoked,false) = false AND approved = true;
    SELECT COALESCE(max(s.max_devices), 5) INTO v_limit FROM public.shop_members sm LEFT JOIN public.subscriptions s ON s.shop_id = sm.shop_id WHERE sm.user_id = v_user AND sm.removed_at IS NULL;

    IF v_existing.id IS NULL AND v_active >= v_limit THEN
        RETURN jsonb_build_object('success', false, 'message', 'DEVICE_LIMIT_EXCEEDED', 'active_devices', v_active, 'max_devices', v_limit);
    END IF;

    INSERT INTO public.extension_devices (
        user_id, device_id, device_name, browser, os_info, 
        client_version, version, fingerprint_hash, shop_id, metadata, 
        last_seen, revoked, approved, status
    )
    VALUES (
        v_user, trim(p_device_id), left(trim(p_device_name), 100), p_browser, p_os_info, 
        p_client_version, p_client_version, p_fingerprint_hash, v_target_shop, p_metadata, 
        now(), false, true, 'active'
    )
    ON CONFLICT (user_id, device_id) DO UPDATE SET 
        device_name = excluded.device_name,
        browser = excluded.browser,
        os_info = excluded.os_info,
        client_version = excluded.client_version,
        version = excluded.version,
        fingerprint_hash = excluded.fingerprint_hash,
        shop_id = COALESCE(excluded.shop_id, public.extension_devices.shop_id),
        metadata = COALESCE(excluded.metadata, public.extension_devices.metadata),
        last_seen = now();

    RETURN jsonb_build_object('success', true, 'active_devices', v_active + CASE WHEN v_existing.id IS NULL THEN 1 ELSE 0 END, 'max_devices', v_limit);
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_extension_device(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,UUID,JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_extension_device(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,UUID,JSONB) TO service_role;

-- 4. Cập nhật owner_get_devices_v2 hỗ trợ kiểm soát thiết bị cho Chủ shop
CREATE OR REPLACE FUNCTION public.owner_get_devices_v2(p_shop_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE 
    v_devices JSONB; 
    v_max INT;
BEGIN
    IF NOT public.is_shop_owner_or_manager(p_shop_id) AND NOT public.is_system_admin() THEN 
        RAISE EXCEPTION 'Không có quyền quản lý thiết bị.'; 
    END IF;

    SELECT COALESCE(s.max_devices, q.max_devices, 5) INTO v_max 
    FROM public.subscriptions s 
    FULL JOIN public.shop_quotas q ON q.shop_id = s.shop_id 
    WHERE COALESCE(s.shop_id, q.shop_id) = p_shop_id 
    LIMIT 1;

    SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.last_seen DESC NULLS LAST), '[]'::jsonb) INTO v_devices FROM (
        SELECT 
            d.id,
            d.device_id,
            d.device_name,
            COALESCE(d.browser, 'Google Chrome') AS browser,
            COALESCE(d.client_version, d.version, 'v2.4 Pro') AS client_version,
            COALESCE(d.os_info, 'Windows') AS os_info,
            COALESCE(d.ip_address, d.last_ip, '127.0.0.1') AS last_ip,
            COALESCE(d.last_location, 'Việt Nam') AS last_location,
            d.last_seen,
            COALESCE(d.revoked, false) AS revoked,
            COALESCE(p.email, u.email, '—') AS email,
            COALESCE(p.full_name, 'Nhân viên') AS full_name,
            COALESCE(d.metadata, '{}'::jsonb) AS metadata
        FROM public.extension_devices d 
        LEFT JOIN public.shop_members sm ON sm.user_id = d.user_id AND sm.shop_id = p_shop_id AND sm.removed_at IS NULL
        LEFT JOIN public.profiles p ON p.id = d.user_id
        LEFT JOIN auth.users u ON u.id = d.user_id
        WHERE d.shop_id = p_shop_id OR sm.shop_id = p_shop_id
    ) t;

    RETURN jsonb_build_object('devices', v_devices, 'max_devices', COALESCE(v_max, 5));
END; 
$$;

GRANT EXECUTE ON FUNCTION public.owner_get_devices_v2(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_get_devices_v2(UUID) TO service_role;
