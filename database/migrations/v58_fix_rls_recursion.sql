-- =========================================================================
-- v58_fix_rls_recursion.sql
-- 1. Định nghĩa lại hàm helper is_system_admin() không sử dụng JOIN profiles.
--    Việc này loại bỏ hoàn toàn khả năng đệ quy vô hạn (infinite recursion) 
--    khi bảng profiles hoặc các bảng liên quan gọi hàm này trong RLS Policies.
-- 2. Đơn giản hóa cơ chế phân quyền trong admin_get_system_metrics() 
--    bằng cách gọi trực tiếp is_system_admin().
-- =========================================================================

-- 1. Cập nhật helper is_system_admin() tối giản và an toàn
CREATE OR REPLACE FUNCTION public.is_system_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid()
          AND r.code = 'SYSTEM_ADMIN'
    ) OR EXISTS (
        SELECT 1 FROM auth.users u
        WHERE u.id = auth.uid() AND u.email = 'admin@luathuysinh.vn'
    );
$$;

-- 2. Cập nhật admin_get_system_metrics() để sử dụng helper đã được tối ưu hóa
CREATE OR REPLACE FUNCTION public.admin_get_system_metrics()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_total_shops INT;
    v_active_shops INT;
    v_total_users INT;
    v_total_orders INT;
    v_active_devices INT;
    v_result JSONB;
BEGIN
    -- Kiểm tra quyền Admin bằng helper an toàn không đệ quy
    IF NOT public.is_system_admin() THEN
        RAISE EXCEPTION 'Truy cập bị từ chối: Chỉ Master Admin mới có quyền thực hiện.';
    END IF;

    -- Đếm số cửa hàng hoạt động
    SELECT COUNT(*) INTO v_total_shops FROM public.shops WHERE deleted_at IS NULL;
    SELECT COUNT(*) INTO v_active_shops FROM public.shops WHERE status = 'active' AND deleted_at IS NULL;
    
    -- Đếm số người dùng hoạt động
    SELECT COUNT(*) INTO v_total_users FROM public.profiles WHERE status = 'active';
    
    -- Đếm tổng số đơn hàng
    SELECT COUNT(*) INTO v_total_orders FROM public.orders WHERE deleted_at IS NULL;
    
    -- Đếm số thiết bị đang hoạt động
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

GRANT EXECUTE ON FUNCTION public.is_system_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_system_admin() TO service_role;

GRANT EXECUTE ON FUNCTION public.admin_get_system_metrics() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_system_metrics() TO service_role;
