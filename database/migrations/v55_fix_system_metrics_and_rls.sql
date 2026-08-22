-- =========================================================================
-- v55_fix_system_metrics_and_rls.sql
-- 1. Sửa lỗi hàm admin_get_system_metrics truy vấn cột "revoked" không tồn tại
-- 2. Cập nhật RLS cho các bảng shops, extension_devices để System Admin có quyền đọc đầy đủ.
-- =========================================================================

-- 1. Khắc phục hàm admin_get_system_metrics
CREATE OR REPLACE FUNCTION public.admin_get_system_metrics()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_shops INT;
    v_active_shops INT;
    v_total_users INT;
    v_total_orders INT;
    v_active_devices INT;
    v_result JSONB;
BEGIN
    -- Kiểm tra quyền Admin Tổng
    IF NOT EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() AND r.code = 'SYSTEM_ADMIN'
    ) AND NOT EXISTS (
        SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.email = 'admin@luathuysinh.vn'
    ) THEN
        RAISE EXCEPTION 'Truy cập bị từ chối: Chỉ Master Admin mới có quyền thực hiện.';
    END IF;

    -- Đếm số cửa hàng hoạt động
    SELECT COUNT(*) INTO v_total_shops FROM public.shops WHERE deleted_at IS NULL;
    SELECT COUNT(*) INTO v_active_shops FROM public.shops WHERE status = 'active' AND deleted_at IS NULL;
    
    -- Đếm số người dùng hoạt động
    SELECT COUNT(*) INTO v_total_users FROM public.profiles WHERE status = 'active';
    
    -- Đếm tổng số đơn hàng
    SELECT COUNT(*) INTO v_total_orders FROM public.orders WHERE deleted_at IS NULL;
    
    -- Đếm số thiết bị đang hoạt động (Sử dụng cột status = 'active' thay vì cột revoked)
    SELECT COUNT(*) INTO v_active_devices FROM public.extension_devices WHERE status = 'active';

    v_result := jsonb_build_object(
        'total_shops', v_total_shops,
        'active_shops', v_active_shops,
        'total_users', v_total_users,
        'total_orders', v_total_orders,
        'active_devices', v_active_devices
    );

    RETURN v_result;
END;
$$;

-- 2. Đảm bảo RLS Policy của bảng shops cho phép SYSTEM_ADMIN đọc/ghi toàn bộ
DROP POLICY IF EXISTS "Users can only access owned or member shops" ON public.shops;
CREATE POLICY "Users can only access owned or member shops" ON public.shops
FOR ALL TO authenticated
USING (
    owner_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.shop_members 
        WHERE shop_members.shop_id = shops.id AND shop_members.user_id = auth.uid()
    )
    OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() AND r.code IN ('SYSTEM_ADMIN', 'SUPPORT')
    )
);

-- 3. Đảm bảo RLS Policy của bảng extension_devices cho phép SYSTEM_ADMIN đọc toàn bộ
DROP POLICY IF EXISTS "Users can read own devices" ON public.extension_devices;
CREATE POLICY "Users can read own devices" ON public.extension_devices
FOR SELECT TO authenticated
USING (
    user_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() AND r.code IN ('SYSTEM_ADMIN', 'SUPPORT')
    )
);

GRANT EXECUTE ON FUNCTION public.admin_get_system_metrics() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_system_metrics() TO service_role;
