-- =========================================================================
-- v18_device_management.sql
-- DEVICE MANAGEMENT + REVOKE (xem phần 17 của review)
--
-- Yêu cầu:
--   - danh sách device (user, shop, browser, version, last_seen, revoked)
--   - Revoke một thiết bị ngay lập tức (không chờ access token hết hạn)
--   - Chỉ SYSTEM_ADMIN được liệt kê + thu hồi.
--
-- Bổ sung thêm index chuẩn theo mục 25 (đề xuất review):
--   extension_devices (user_id, revoked)
--   extension_devices (user_id, last_seen DESC)
-- =========================================================================

-- =====================================================================
-- 1. INDEX BỔ SUNG (chuẩn theo mục 25)
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_extdev_user_revoked
    ON public.extension_devices (user_id, revoked);
CREATE INDEX IF NOT EXISTS idx_extdev_user_last_seen
    ON public.extension_devices (user_id, last_seen DESC);

-- =====================================================================
-- 1b. CỘT device_id (ID do extension tự sinh, vd dev_xxx) + UNIQUE
--     để extension ghi/upsert thiết bị và kiểm tra trạng thái revoked.
-- =====================================================================
ALTER TABLE public.extension_devices ADD COLUMN IF NOT EXISTS device_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_extdev_user_device
    ON public.extension_devices (user_id, device_id);

-- =====================================================================
-- 2. RLS POLICY: user chỉ đọc thiết bị CỦA CHÍNH MÌNH (để hiện "thiết bị
--    của tôi" trong extension); admin dùng RPC để xem toàn bộ.
--    (extension_devices đã ENABLE RLS từ v4; chỉ chưa có policy.)
-- =====================================================================
DROP POLICY IF EXISTS "Users can read own devices" ON public.extension_devices;
CREATE POLICY "Users can read own devices" ON public.extension_devices
    FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own devices" ON public.extension_devices;
CREATE POLICY "Users can insert own devices" ON public.extension_devices
    FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own devices" ON public.extension_devices;
CREATE POLICY "Users can update own devices" ON public.extension_devices
    FOR UPDATE USING (user_id = auth.uid());

-- =====================================================================
-- 3. admin_list_devices() — liệt kê mọi thiết bị kèm user/shop
-- =====================================================================
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
    shop_name     TEXT,
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
        p.email,
        p.full_name,
        d.device_name,
        d.browser,
        d.version,
        d.revoked,
        (SELECT s.name FROM public.shop_members sm
         JOIN public.shops s ON s.id = sm.shop_id
         WHERE sm.user_id = d.user_id AND sm.removed_at IS NULL
         LIMIT 1),
        d.last_seen,
        d.created_at
    FROM public.extension_devices d
    LEFT JOIN public.profiles p ON p.id = d.user_id
    ORDER BY d.last_seen DESC NULLS LAST;
END;
$$;

-- =====================================================================
-- 4. admin_revoke_device() — thu hồi thiết bị ngay lập tức
-- =====================================================================
CREATE OR REPLACE FUNCTION public.admin_revoke_device(
    p_device_id UUID,
    p_revoked BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id  UUID;
    v_email    TEXT;
BEGIN
    IF NOT public.is_system_admin() THEN
        RAISE EXCEPTION 'Truy cập bị từ chối: Yêu cầu quyền SYSTEM_ADMIN.';
    END IF;

    SELECT d.user_id, p.email INTO v_user_id, v_email
    FROM public.extension_devices d
    LEFT JOIN public.profiles p ON p.id = d.user_id
    WHERE d.id = p_device_id;

    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Thiết bị không tồn tại.');
    END IF;

    UPDATE public.extension_devices
    SET revoked = p_revoked, last_seen = now()
    WHERE id = p_device_id;

    INSERT INTO public.audit_logs
        (actor_id, target_user, shop_id, action, target_resource, target_id, old_value, new_value)
    VALUES
        (auth.uid(), v_user_id, NULL,
         CASE WHEN p_revoked THEN 'REVOKE_DEVICE' ELSE 'RESTORE_DEVICE' END,
         'extension_devices', p_device_id::text,
         CASE WHEN p_revoked THEN 'active' ELSE 'revoked' END,
         CASE WHEN p_revoked THEN 'revoked' ELSE 'active' END);

    RETURN jsonb_build_object(
        'success', true,
        'device_id', p_device_id,
        'revoked', p_revoked,
        'email', v_email
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_devices() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_devices() TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_revoke_device(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_device(UUID, BOOLEAN) TO service_role;

-- =====================================================================
-- GHI CHÚ:
--   - Extension khi check session sẽ đọc policy "Users can read own devices"
--     và tự đăng xuất nếu device của mình bị revoked=true.
--   - Gộp xử lý "disable user + revoke sessions + revoke devices" có thể
--     tạo RPC admin_disable_user_full() ở bước sau nếu cần.
-- =====================================================================