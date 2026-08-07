-- 001_roles.sql
-- Tạo bảng Vai Trò (roles) và seed các giá trị mặc định

CREATE TABLE IF NOT EXISTS public.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL, -- SYSTEM_ADMIN, SHOP_OWNER, SHOP_STAFF, SUPPORT, VIEWER
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Kích hoạt Row Level Security (RLS) để bảo mật
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

-- Tạo Policy cho phép mọi người đọc danh sách vai trò (Read-Only)
DROP POLICY IF EXISTS "Allow public read access to roles" ON public.roles;
CREATE POLICY "Allow public read access to roles" ON public.roles
    FOR SELECT USING (true);

-- Hạt giống các vai trò cốt lõi
INSERT INTO public.roles (code, name) VALUES
('SYSTEM_ADMIN', 'Quản trị viên Hệ thống'),
('SHOP_OWNER', 'Chủ Cửa hàng'),
('SHOP_STAFF', 'Nhân viên Lên đơn'),
('SUPPORT', 'Hỗ trợ viên Hệ thống'),
('VIEWER', 'Người xem')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;
