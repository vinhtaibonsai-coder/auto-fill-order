-- =========================================================================
-- AI ORDER EXTENSION V4 — ENTERPRISE MULTI-TENANT & PURE RBAC MIGRATION
-- Copy toàn bộ nội dung này và dán vào Supabase SQL Editor -> Bấm RUN
-- =========================================================================

-- Xóa các bảng phân quyền cũ (nếu có từ bản nháp) để tránh xung đột cột
DROP TABLE IF EXISTS public.role_permissions CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TABLE IF EXISTS public.permissions CASCADE;
DROP TABLE IF EXISTS public.roles CASCADE;

-- =========================================================================
-- 0. HỖ TRỢ SOFT DELETE CHO CÁC BẢNG CŨ
-- Đảm bảo cột deleted_at tồn tại trước khi tạo Policy
-- =========================================================================
ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id);

ALTER TABLE IF EXISTS public.history ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS public.history ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id);

ALTER TABLE IF EXISTS public.submitted_orders ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS public.submitted_orders ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id);

ALTER TABLE IF EXISTS public.customers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS public.customers ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id);

-- 1. Bảng Vai Trò (roles) - Thuần Role, không chứa Permission
CREATE TABLE IF NOT EXISTS public.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL, -- SYSTEM_ADMIN, SHOP_OWNER, SHOP_MANAGER, SHOP_STAFF, SUPPORT, VIEWER
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed các vai trò cốt lõi
INSERT INTO public.roles (code, name) VALUES
('SYSTEM_ADMIN', 'Quản trị viên Hệ thống'),
('SHOP_OWNER', 'Chủ Cửa hàng'),
('SHOP_MANAGER', 'Quản lý Cửa hàng'),
('SHOP_STAFF', 'Nhân viên Lên đơn'),
('SUPPORT', 'Hỗ trợ viên Hệ thống'),
('VIEWER', 'Người xem')
ON CONFLICT (code) DO NOTHING;

-- 2. Bảng Danh Mục Quyền (permissions)
CREATE TABLE IF NOT EXISTS public.permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL, -- orders.read, orders.create, etc.
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed các quyền cơ bản
INSERT INTO public.permissions (code, description) VALUES
('orders.read', 'Xem danh sách đơn hàng'),
('orders.create', 'Tạo đơn hàng mới (bóc tách)'),
('orders.update', 'Chỉnh sửa đơn hàng'),
('orders.delete', 'Xóa đơn hàng'),
('customers.read', 'Xem danh sách khách hàng'),
('customers.export', 'Xuất dữ liệu khách hàng'),
('shop.manage', 'Cấu hình thông tin Shop'),
('user.manage', 'Quản lý thành viên Shop'),
('logs.read', 'Xem lịch sử hệ thống (Audit)')
ON CONFLICT (code) DO NOTHING;

-- 3. Bảng Phân Quyền Vai Trò (role_permissions)
CREATE TABLE IF NOT EXISTS public.role_permissions (
    role_id UUID REFERENCES public.roles(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES public.permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (role_id, permission_id)
);

-- Seed quyền cho Role mẫu (Sẽ cần script chi tiết hơn sau)
-- 4. Bảng User Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT,
    avatar_url TEXT,
    status TEXT DEFAULT 'active',
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Bảng Global User Roles (Dành cho Admin/Support toàn cầu)
CREATE TABLE IF NOT EXISTS public.user_roles (
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    role_id UUID REFERENCES public.roles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (user_id, role_id)
);

-- 6. Bảng Shops
CREATE TABLE IF NOT EXISTS public.shops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    owner_id UUID NOT NULL REFERENCES public.profiles(id),
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    deleted_by UUID
);

-- 7. Bảng Shop Members (User gắn với Shop qua Role)
CREATE TABLE IF NOT EXISTS public.shop_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES public.roles(id),
    status TEXT DEFAULT 'active',
    joined_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID,
    UNIQUE(shop_id, user_id)
);

-- 8. Bảng Thiết Bị Cài Đặt (extension_devices)
CREATE TABLE IF NOT EXISTS public.extension_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    device_name TEXT NOT NULL,
    browser TEXT,
    version TEXT,
    revoked BOOLEAN DEFAULT false,
    last_seen TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. Bảng Audit Logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id),
    shop_id UUID REFERENCES public.shops(id),
    action TEXT NOT NULL, -- Ví dụ: 'CREATE_ORDER', 'LOGIN', 'REVOKE_DEVICE'
    target_resource TEXT, -- Tên bảng hoặc entity
    target_id TEXT, -- ID của entity bị tác động
    payload JSONB, -- Dữ liệu thay đổi
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 10. Bảng Đơn Hàng (Đã thêm soft delete)
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    created_by UUID REFERENCES public.profiles(id),
    customer_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT NOT NULL,
    order_code TEXT,
    cod_amount NUMERIC DEFAULT 0,
    platform TEXT DEFAULT 'vnpost',
    status TEXT DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES public.profiles(id)
);

-- 11. Bảng Khách Hàng (Đã thêm shop_id và soft delete)
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    phone TEXT NOT NULL,
    name TEXT NOT NULL,
    address_list JSONB DEFAULT '[]'::jsonb,
    total_orders INT DEFAULT 0,
    total_spent NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES public.profiles(id),
    UNIQUE(shop_id, phone)
);

-- =========================================================================
-- RLS POLICIES (BẢO MẬT DỮ LIỆU)
-- =========================================================================
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extension_devices ENABLE ROW LEVEL SECURITY;

-- 1. Orders: Ai cũng thấy đơn của Shop mình (nếu chưa bị xóa) và Admin thấy mọi thứ
CREATE POLICY "Strict Shop Isolation for Orders (Read)" ON public.orders
FOR SELECT USING (
  deleted_at IS NULL AND (
    EXISTS (
      SELECT 1 FROM public.shop_members 
      WHERE shop_members.user_id = auth.uid() 
        AND shop_members.shop_id = orders.shop_id
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles 
      JOIN public.roles ON user_roles.role_id = roles.id 
      WHERE user_roles.user_id = auth.uid() 
        AND roles.code = 'SYSTEM_ADMIN'
    )
  )
);

CREATE POLICY "Strict Shop Isolation for Orders (Insert)" ON public.orders
FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shop_members 
      WHERE shop_members.user_id = auth.uid() 
        AND shop_members.shop_id = orders.shop_id
    )
);

CREATE POLICY "Strict Shop Isolation for Orders (Update)" ON public.orders
FOR UPDATE USING (
  deleted_at IS NULL AND (
    EXISTS (
      SELECT 1 FROM public.shop_members 
      WHERE shop_members.user_id = auth.uid() 
        AND shop_members.shop_id = orders.shop_id
    )
  )
);

-- 2. Customers: Tương tự Orders
CREATE POLICY "Strict Shop Isolation for Customers (Read)" ON public.customers
FOR SELECT USING (
  deleted_at IS NULL AND (
    EXISTS (
      SELECT 1 FROM public.shop_members 
      WHERE shop_members.user_id = auth.uid() 
        AND shop_members.shop_id = customers.shop_id
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles 
      JOIN public.roles ON user_roles.role_id = roles.id 
      WHERE user_roles.user_id = auth.uid() 
        AND roles.code = 'SYSTEM_ADMIN'
    )
  )
);

CREATE POLICY "Support can read all customers"
    ON public.customers
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid() AND r.code IN ('SYSTEM_ADMIN', 'SUPPORT')
        )
    );

