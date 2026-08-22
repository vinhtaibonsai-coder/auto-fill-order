-- =========================================================================
-- v56_fix_is_system_admin_fallback.sql
-- 1. Cập nhật hàm helper is_system_admin() để hỗ trợ kiểm tra email dự phòng
--    (Đảm bảo tài khoản admin@luathuysinh.vn luôn luôn có quyền SYSTEM_ADMIN,
--     tránh lỗi phân quyền do không đồng bộ UUID).
-- 2. Gán trực tiếp quyền SYSTEM_ADMIN cho tài khoản admin@luathuysinh.vn hiện tại.
-- =========================================================================

-- 1. Cập nhật helper is_system_admin() với dự phòng theo email
CREATE OR REPLACE FUNCTION public.is_system_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        JOIN public.profiles p ON p.id = ur.user_id
        WHERE ur.user_id = auth.uid()
          AND r.code = 'SYSTEM_ADMIN'
          AND p.status = 'active'
          AND p.disabled_at IS NULL
    ) OR EXISTS (
        SELECT 1 FROM auth.users u
        WHERE u.id = auth.uid() AND u.email = 'admin@luathuysinh.vn'
    );
$$;

-- 2. Đồng bộ gán quyền SYSTEM_ADMIN cho tài khoản admin@luathuysinh.vn hiện tại trong db
DO $$
DECLARE
    v_role_id UUID;
    v_admin_id UUID;
BEGIN
    -- Lấy role_id của SYSTEM_ADMIN
    SELECT id INTO v_role_id FROM public.roles WHERE code = 'SYSTEM_ADMIN' LIMIT 1;
    
    -- Lấy id hiện tại của tài khoản admin@luathuysinh.vn từ auth.users
    SELECT id INTO v_admin_id FROM auth.users WHERE email = 'admin@luathuysinh.vn' LIMIT 1;
    
    IF v_admin_id IS NOT NULL AND v_role_id IS NOT NULL THEN
        -- Chèn liên kết quyền
        INSERT INTO public.user_roles (user_id, role_id)
        VALUES (v_admin_id, v_role_id)
        ON CONFLICT (user_id, role_id) DO NOTHING;
        
        -- Đồng bộ vào profiles
        INSERT INTO public.profiles (id, email, full_name, status)
        VALUES (v_admin_id, 'admin@luathuysinh.vn', 'Master Admin', 'active')
        ON CONFLICT (id) DO UPDATE SET status = 'active';
    END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.is_system_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_system_admin() TO service_role;
