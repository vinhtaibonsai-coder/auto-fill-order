-- =========================================================================
-- v8_admin_shop_member_rpc.sql
-- RPC cho Admin thêm/xoá thành viên trong shop (bypass RLS với SECURITY DEFINER)
-- Chỉ dùng role TEXT, bỏ qua role_id để tránh xung đột kiểu INT/UUID giữa các migration
-- =========================================================================

-- 1. RPC: Thêm thành viên vào shop (hoặc cập nhật role nếu đã tồn tại)
CREATE OR REPLACE FUNCTION public.admin_add_shop_member(
    p_shop_id UUID,
    p_user_id UUID,
    p_role TEXT DEFAULT 'SHOP_STAFF'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Kiểm tra quyền: chỉ SYSTEM_ADMIN mới được dùng
    IF auth.uid() IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() AND r.code = 'SYSTEM_ADMIN'
    ) AND NOT EXISTS (
        SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.email = 'admin@luathuysinh.vn'
    ) THEN
        RAISE EXCEPTION 'Chỉ Master Admin mới có quyền thêm thành viên vào shop.';
    END IF;

    -- Upsert vào shop_members (dùng $1,$2,$3 để tránh nhầm lẫn tên cột)
    INSERT INTO public.shop_members (shop_id, user_id, role, status)
    VALUES ($1, $2, $3, 'active')
    ON CONFLICT (shop_id, user_id) DO UPDATE SET
        role = $3,
        status = 'active';

    -- Ghi audit log
    INSERT INTO public.audit_logs (user_id, action, target_resource, target_id, payload)
    VALUES (auth.uid(), 'ADD_SHOP_MEMBER', 'shop_members', $2::TEXT,
        jsonb_build_object('shop_id', $1, 'role', $3));

    RETURN jsonb_build_object('success', true, 'shop_id', $1, 'user_id', $2);
END;
$$;

-- 2. RPC: Xoá thành viên khỏi shop
CREATE OR REPLACE FUNCTION public.admin_remove_shop_member(
    p_member_id BIGINT,
    p_shop_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Kiểm tra quyền
    IF auth.uid() IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() AND r.code = 'SYSTEM_ADMIN'
    ) AND NOT EXISTS (
        SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.email = 'admin@luathuysinh.vn'
    ) THEN
        RAISE EXCEPTION 'Chỉ Master Admin mới có quyền xoá thành viên khỏi shop.';
    END IF;

    -- Không cho xoá chủ shop (dùng $1,$2 để tránh nhầm lẫn tên cột)
    IF EXISTS (SELECT 1 FROM public.shop_members WHERE id = $1 AND role = 'SHOP_OWNER') THEN
        RAISE EXCEPTION 'Không thể xoá Chủ shop khỏi danh sách thành viên.';
    END IF;

    DELETE FROM public.shop_members WHERE id = $1;

    INSERT INTO public.audit_logs (user_id, action, target_resource, target_id, payload)
    VALUES (auth.uid(), 'REMOVE_SHOP_MEMBER', 'shop_members', $1::TEXT,
        jsonb_build_object('shop_id', $2));

    RETURN jsonb_build_object('success', true);
END;
$$;
