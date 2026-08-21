-- =========================================================================
-- v49_unique_shop_owner.sql
-- Đảm bảo mỗi cửa hàng (Shop) chỉ có duy nhất một tài khoản Chủ cửa hàng (SHOP_OWNER) hoạt động.
-- Tiến hành dọn dẹp dữ liệu trùng lặp lịch sử và tạo UNIQUE INDEX tầng Database.
-- Sử dụng SQL động (EXECUTE) để tương thích cả cơ sở dữ liệu cũ/mới (có hoặc không có cột role_id).
-- Loại bỏ các cửa hàng mồ côi (orphan shops - owner_id không tồn tại trong auth.users) khỏi bước di trú để tránh lỗi FK.
-- =========================================================================

-- 0. Loại bỏ ràng buộc CHECK cũ của shop_members nếu có để cho phép các mã vai trò mới (SHOP_OWNER, SHOP_MANAGER, ...)
ALTER TABLE public.shop_members DROP CONSTRAINT IF EXISTS shop_members_role_check;

-- 1. Tìm và hạ cấp các tài khoản chủ shop trùng lặp (không khớp với owner_id trong bảng shops)
--    Chuyển đổi vai trò của họ thành SHOP_MANAGER để bảo toàn quyền hạn mà không vi phạm quy tắc duy nhất.
DO $$
DECLARE
    v_manager_role_id UUID;
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'shop_members' 
          AND column_name = 'role_id'
    ) THEN
        SELECT id INTO v_manager_role_id FROM public.roles WHERE code = 'SHOP_MANAGER' LIMIT 1;
        IF v_manager_role_id IS NOT NULL THEN
            EXECUTE '
                UPDATE public.shop_members sm
                SET 
                    role_id = $1,
                    role = ''SHOP_MANAGER''
                FROM public.shops s
                WHERE sm.shop_id = s.id
                  AND sm.role IN (''SHOP_OWNER'', ''OWNER'')
                  AND sm.user_id <> s.owner_id
            ' USING v_manager_role_id;
        END IF;
    ELSE
        EXECUTE '
            UPDATE public.shop_members sm
            SET 
                role = ''SHOP_MANAGER''
            FROM public.shops s
            WHERE sm.shop_id = s.id
              AND sm.role IN (''SHOP_OWNER'', ''OWNER'')
              AND sm.user_id <> s.owner_id
        ';
    END IF;
END $$;


-- 2. Đảm bảo chủ sở hữu thực sự của cửa hàng (owner_id trong shops) 
--    luôn có vai trò SHOP_OWNER hoạt động trong bảng shop_members.
--    Chỉ thực hiện cho các cửa hàng mà chủ sở hữu (owner_id) thực sự tồn tại trong bảng auth.users để tránh lỗi FK.
DO $$
DECLARE
    v_owner_role_id UUID;
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'shop_members' 
          AND column_name = 'role_id'
    ) THEN
        SELECT id INTO v_owner_role_id FROM public.roles WHERE code = 'SHOP_OWNER' LIMIT 1;
        IF v_owner_role_id IS NOT NULL THEN
            EXECUTE '
                INSERT INTO public.shop_members (shop_id, user_id, role_id, role, status)
                SELECT s.id, s.owner_id, $1, ''SHOP_OWNER'', ''active''
                FROM public.shops s
                WHERE EXISTS (SELECT 1 FROM auth.users u WHERE u.id = s.owner_id)
                ON CONFLICT (shop_id, user_id) DO UPDATE SET
                    role_id = $1,
                    role = ''SHOP_OWNER'',
                    status = ''active''
            ' USING v_owner_role_id;
        END IF;
    ELSE
        EXECUTE '
            INSERT INTO public.shop_members (shop_id, user_id, role, status)
            SELECT s.id, s.owner_id, ''SHOP_OWNER'', ''active''
            FROM public.shops s
            WHERE EXISTS (SELECT 1 FROM auth.users u WHERE u.id = s.owner_id)
            ON CONFLICT (shop_id, user_id) DO UPDATE SET
                role = ''SHOP_OWNER'',
                status = ''active''
        ';
    END IF;
END $$;


-- 3. Tạo UNIQUE INDEX để ngăn chặn tuyệt đối việc gán nhiều hơn 1 chủ shop hoạt động trên mỗi shop
DROP INDEX IF EXISTS public.uq_active_shop_owner_per_shop;
CREATE UNIQUE INDEX uq_active_shop_owner_per_shop 
ON public.shop_members (shop_id) 
WHERE (role IN ('SHOP_OWNER', 'OWNER') AND status = 'active');
