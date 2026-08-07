-- =========================================================================
-- v15_role_dedup.sql
-- Kế hoạch: Gộp Role Model - Loại bỏ Role trùng lặp
--   1. Đồng bộ các dòng shop_members hiện tại từ role_id sang role.
--   2. Tạo trigger đồng bộ BEFORE INSERT/UPDATE role_id tự động điền role.
--   3. Cập nhật RPC admin_add_shop_member ghi role_id và cập nhật qua trigger.
--   4. Đồng bộ legacy profiles.role = 'admin' / 'SYSTEM_ADMIN' sang user_roles.
-- =========================================================================

-- 1. Đồng bộ dữ liệu lịch sử shop_members: role_id -> role
UPDATE public.shop_members sm
SET role = r.code
FROM public.roles r
WHERE sm.role_id = r.id AND (sm.role IS NULL OR sm.role <> r.code);

-- 2. Trigger đồng bộ tự động 1 chiều: role_id -> role
CREATE OR REPLACE FUNCTION public.sync_shop_member_role_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.role_id IS NOT NULL THEN
        SELECT code INTO NEW.role FROM public.roles WHERE id = NEW.role_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_shop_member_role_code ON public.shop_members;
CREATE TRIGGER trg_sync_shop_member_role_code
BEFORE INSERT OR UPDATE OF role_id ON public.shop_members
FOR EACH ROW
EXECUTE FUNCTION public.sync_shop_member_role_code();

-- 3. Cập nhật RPC public.admin_add_shop_member
CREATE OR REPLACE FUNCTION public.admin_add_shop_member(
    p_shop_id UUID,
    p_user_id UUID,
    p_role TEXT DEFAULT 'SHOP_STAFF'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_role_id UUID;
BEGIN
    -- Kiểm tra quyền: chỉ SYSTEM_ADMIN hoặc admin@luathuysinh.vn mới được dùng
    IF auth.uid() IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() AND r.code = 'SYSTEM_ADMIN'
    ) AND NOT EXISTS (
        SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.email = 'admin@luathuysinh.vn'
    ) THEN
        RAISE EXCEPTION 'Chỉ Master Admin mới có quyền thêm thành viên vào shop.';
    END IF;

    -- Lấy role_id dựa trên code và hỗ trợ mapping legacy
    SELECT id INTO v_role_id FROM public.roles 
    WHERE code = CASE 
        WHEN p_role = 'owner' THEN 'SHOP_OWNER'
        WHEN p_role = 'admin' THEN 'SHOP_MANAGER'
        WHEN p_role = 'sales' THEN 'SHOP_STAFF'
        WHEN p_role = 'viewer' THEN 'VIEWER'
        ELSE p_role 
    END LIMIT 1;

    IF v_role_id IS NULL THEN
        RAISE EXCEPTION 'Role không tồn tại: %', p_role;
    END IF;

    -- Upsert vào shop_members (role_id là nguồn duy nhất)
    INSERT INTO public.shop_members (shop_id, user_id, role_id, status)
    VALUES (p_shop_id, p_user_id, v_role_id, 'active')
    ON CONFLICT (shop_id, user_id) DO UPDATE SET
        role_id = EXCLUDED.role_id,
        status = 'active';

    -- Ghi audit log
    INSERT INTO public.audit_logs (user_id, action, target_resource, target_id, payload)
    VALUES (auth.uid(), 'ADD_SHOP_MEMBER', 'shop_members', p_user_id::TEXT,
        jsonb_build_object('shop_id', p_shop_id, 'role', p_role));

    RETURN jsonb_build_object('success', true, 'shop_id', p_shop_id, 'user_id', p_user_id);
END;
$$;

-- 4. Đồng bộ profiles.role -> user_roles
DO $$
DECLARE
    v_admin_role_id UUID;
    v_rec RECORD;
BEGIN
    SELECT id INTO v_admin_role_id FROM public.roles WHERE code = 'SYSTEM_ADMIN' LIMIT 1;
    IF v_admin_role_id IS NOT NULL THEN
        -- Tìm các profiles có vai trò Admin ở cột legacy và đưa vào user_roles
        FOR v_rec IN 
            SELECT id FROM public.profiles 
            WHERE (role = 'admin' OR role = 'SYSTEM_ADMIN')
        LOOP
            INSERT INTO public.user_roles (user_id, role_id)
            VALUES (v_rec.id, v_admin_role_id)
            ON CONFLICT (user_id, role_id) DO NOTHING;
        END LOOP;
    END IF;
END $$;
