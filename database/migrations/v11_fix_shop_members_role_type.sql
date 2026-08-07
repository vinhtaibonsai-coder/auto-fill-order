-- =========================================================================
-- v11_fix_shop_members_role_type.sql
-- FIX: operator does not exist: integer = uuid
-- shop_members.role_id còn là INT (từ v3_1: id SERIAL) trong khi roles.id
-- là UUID (từ v4). Chuyển role_id sang UUID và trỏ đúng FK tới roles(id).
-- =========================================================================

-- 1. Xoá FK/constraint cũ trên role_id (nếu có)
ALTER TABLE public.shop_members DROP CONSTRAINT IF EXISTS shop_members_role_id_fkey;
ALTER TABLE public.shop_members DROP CONSTRAINT IF EXISTS fk_shop_members_role;
ALTER TABLE IF EXISTS public.shop_members ALTER COLUMN role_id DROP DEFAULT;

-- 2. Chuyển role_id INT -> UUID. Map theo ID SERIAL của v3_1 nếu có dữ liệu cũ:
--    1=SHOP_OWNER (owner), 2=SHOP_MANAGER (admin), 3=SHOP_STAFF (sales),
--    4=SHOP_MANAGER (warehouse), 5=VIEWER (viewer)
DO $$
DECLARE
    v_owner UUID;
    v_manager UUID;
    v_staff UUID;
    v_viewer UUID;
BEGIN
    SELECT id INTO v_owner   FROM public.roles WHERE code = 'SHOP_OWNER'   LIMIT 1;
    SELECT id INTO v_manager FROM public.roles WHERE code = 'SHOP_MANAGER' LIMIT 1;
    SELECT id INTO v_staff   FROM public.roles WHERE code = 'SHOP_STAFF'   LIMIT 1;
    SELECT id INTO v_viewer  FROM public.roles WHERE code = 'VIEWER'       LIMIT 1;

    -- Nếu chưa có dữ liệu, ALTER TYPE trực tiếp (không map) là đủ
    IF NOT EXISTS (SELECT 1 FROM public.shop_members) THEN
        ALTER TABLE public.shop_members
            ALTER COLUMN role_id TYPE UUID USING gen_random_uuid();
    ELSE
        ALTER TABLE public.shop_members
            ALTER COLUMN role_id TYPE UUID USING (
                CASE role_id
                    WHEN 1 THEN v_owner
                    WHEN 2 THEN v_manager
                    WHEN 3 THEN v_staff
                    WHEN 4 THEN v_manager
                    WHEN 5 THEN v_viewer
                    ELSE v_staff
                END
            );
    END IF;

    -- Khôi phục NOT NULL + FK tới roles(id)
    ALTER TABLE public.shop_members ALTER COLUMN role_id SET NOT NULL;
    ALTER TABLE public.shop_members
        ADD CONSTRAINT shop_members_role_id_fkey
        FOREIGN KEY (role_id) REFERENCES public.roles(id);
END $$;
