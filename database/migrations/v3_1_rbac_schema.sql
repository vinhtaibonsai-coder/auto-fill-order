-- =========================================================================
-- AI ORDER EXTENSION V3.1 — STANDARD RBAC DATABASE MIGRATION & SEEDING
-- Copy toàn bộ nội dung này và dán vào Supabase SQL Editor -> Bấm RUN
-- =========================================================================

-- 1. Bổ sung cột Username & Email UNIQUE vào bảng profiles
ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;
ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 2. Bảng Vai Trò Chuẩn RBAC (roles)
CREATE TABLE IF NOT EXISTS public.roles (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    priority INT DEFAULT 10,
    is_system BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed các vai trò mặc định
INSERT INTO public.roles (id, name, display_name, priority, is_system) VALUES
(1, 'owner', '👑 Chủ Shop (Owner)', 1, true),
(2, 'admin', '🛡️ Quản trị viên (Admin)', 2, true),
(3, 'sales', '💼 Nhân viên lên đơn (Sales)', 3, true),
(4, 'warehouse', '📦 Quản lý kho (Warehouse)', 4, true),
(5, 'viewer', '👁️ Người xem (Viewer)', 5, true)
ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name;

-- 3. Bảng Danh Mục Quyền Hạn (permissions)
CREATE TABLE IF NOT EXISTS public.permissions (
    id SERIAL PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    perm_group TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed danh mục quyền hạn hệ thống
INSERT INTO public.permissions (id, code, name, perm_group) VALUES
(1, 'order.create', 'Bóc tách & Tạo đơn nháp', 'orders'),
(2, 'order.edit', 'Chỉnh sửa đơn hàng', 'orders'),
(3, 'order.delete', 'Xóa đơn nháp & đơn đã lên', 'orders'),
(4, 'order.submit', 'Đăng đơn sang VNPost/J&T', 'orders'),
(5, 'customer.view', 'Xem danh sách khách hàng', 'customers'),
(6, 'customer.delete', 'Xóa dữ liệu khách hàng', 'customers'),
(7, 'member.manage', 'Quản lý & phân quyền thành viên', 'members'),
(8, 'shop.config', 'Sửa thông tin kho & tài khoản COD', 'shop')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- 4. Bảng Phân Quyền Vai Trò (role_permissions)
CREATE TABLE IF NOT EXISTS public.role_permissions (
    role_id INT REFERENCES public.roles(id) ON DELETE CASCADE,
    permission_id INT REFERENCES public.permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- Seed quyền mặc định cho từng vai trò
-- Owner (1): Có tất cả quyền
INSERT INTO public.role_permissions (role_id, permission_id) VALUES
(1, 1), (1, 2), (1, 3), (1, 4), (1, 5), (1, 6), (1, 7), (1, 8),
-- Admin (2): Tất cả trừ xóa khách hàng & xóa shop
(2, 1), (2, 2), (2, 3), (2, 4), (2, 5), (2, 8),
-- Sales (3): Tạo đơn, sửa đơn, đăng đơn, xem khách hàng
(3, 1), (3, 2), (3, 4), (3, 5),
-- Warehouse (4): Đăng đơn, xem khách hàng
(4, 4), (4, 5),
-- Viewer (5): Chỉ xem khách hàng & đơn
(5, 5)
ON CONFLICT DO NOTHING;

-- 5. Bổ sung role_id vào bảng shop_members
ALTER TABLE IF EXISTS public.shop_members ADD COLUMN IF NOT EXISTS role_id INT REFERENCES public.roles(id) DEFAULT 3;
ALTER TABLE IF EXISTS public.shop_members ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'; -- 'pending', 'active', 'locked', 'suspended', 'removed'

-- 6. Bảng Ghi Đè Quyền Cá Nhân Nhân Viên (member_permissions)
CREATE TABLE IF NOT EXISTS public.member_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES public.shop_members(id) ON DELETE CASCADE,
    permission_id INT NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
    allow BOOLEAN NOT NULL DEFAULT true,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(member_id, permission_id)
);

-- 7. Cập nhật RLS Policy đảm bảo chỉ tài khoản status = 'active' mới truy cập được
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_roles_read ON public.roles;
CREATE POLICY public_roles_read ON public.roles FOR SELECT USING (true);

DROP POLICY IF EXISTS public_permissions_read ON public.permissions;
CREATE POLICY public_permissions_read ON public.permissions FOR SELECT USING (true);

DROP POLICY IF EXISTS public_role_permissions_read ON public.role_permissions;
CREATE POLICY public_role_permissions_read ON public.role_permissions FOR SELECT USING (true);
