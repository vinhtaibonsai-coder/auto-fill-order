-- 005_permissions.sql
-- Tạo bảng permissions, role_permissions và seed các quyền hạn ma trận chuẩn

CREATE TABLE IF NOT EXISTS public.permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
    role_id UUID REFERENCES public.roles(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES public.permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (role_id, permission_id)
);

-- Kích hoạt Row Level Security (RLS) để bảo mật
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Tạo Policy cho phép mọi người đọc danh sách quyền hạn (Read-Only)
DROP POLICY IF EXISTS "Allow public read access to permissions" ON public.permissions;
CREATE POLICY "Allow public read access to permissions" ON public.permissions
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read access to role_permissions" ON public.role_permissions;
CREATE POLICY "Allow public read access to role_permissions" ON public.role_permissions
    FOR SELECT USING (true);

-- Seed các quyền cơ bản
INSERT INTO public.permissions (code, description) VALUES
('shop.manage', 'Quản lý Shop hệ thống'),
('shop.switch', 'Chuyển Shop tự do'),
('user.manage', 'Quản lý tài khoản & phân quyền'),
('api.manage', 'Quản lý Groq API key'),
('address.manage', 'Quản lý Bản đồ & Sửa lỗi địa chỉ'),
('logs.read', 'Xem Nhật ký lỗi & Audit logs'),
('device.manage', 'Quản lý máy tính liên kết'),
('notify.read', 'Xem thông báo chuông'),
('draft.manage', 'Tạo, sửa, gửi đơn nháp')
ON CONFLICT (code) DO UPDATE SET description = EXCLUDED.description;

-- Cấp quyền tương ứng với vai trò (Permission Matrix)
DO $$
DECLARE
    v_admin_id UUID;
    v_owner_id UUID;
    v_staff_id UUID;
    v_perm_id UUID;
BEGIN
    SELECT id INTO v_admin_id FROM public.roles WHERE code = 'SYSTEM_ADMIN';
    SELECT id INTO v_owner_id FROM public.roles WHERE code = 'SHOP_OWNER';
    SELECT id INTO v_staff_id FROM public.roles WHERE code = 'SHOP_STAFF';

    -- Xóa các quyền cũ để gán mới chuẩn ma trận
    DELETE FROM public.role_permissions;

    -- 1. SYSTEM_ADMIN được toàn bộ quyền
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_admin_id, id FROM public.permissions;

    -- 2. SHOP_OWNER được quyền: user.manage, api.manage, address.manage, logs.read, device.manage, notify.read, draft.manage
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_owner_id, id FROM public.permissions WHERE code IN (
      'user.manage', 'api.manage', 'address.manage', 'logs.read', 'device.manage', 'notify.read', 'draft.manage'
    );

    -- 3. SHOP_STAFF chỉ được quyền: notify.read, draft.manage
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT v_staff_id, id FROM public.permissions WHERE code IN (
      'notify.read', 'draft.manage'
    );
END $$;
