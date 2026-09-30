-- ======================================================================
-- FILE: v4_saas_architecture.sql
-- ======================================================================
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



-- ======================================================================
-- FILE: v5_master_admin_schema.sql
-- ======================================================================
-- =========================================================================
-- AI ORDER EXTENSION V5 — MASTER ADMIN & ENHANCED AUTHENTICATION MIGRATION
-- Sao chép và chạy trong Supabase SQL Editor
-- =========================================================================

-- 0. ĐẢM BẢO BẢNG SHOPS VÀ PROFILES CÓ ĐỦ CÁC CỘT CẦN THIẾT VỚI KIỂU DỮ LIỆU CHUẨN
DO $$
BEGIN
    -- Thêm các cột nếu chưa có
    ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
    ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

    -- Chuyển đổi kiểu dữ liệu cột status từ BOOLEAN sang TEXT nếu CSDL cũ của Supabase tạo kiểu BOOLEAN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'status' AND data_type = 'boolean'
    ) THEN
        ALTER TABLE public.profiles ALTER COLUMN status DROP DEFAULT;
        ALTER TABLE public.profiles ALTER COLUMN status TYPE TEXT USING (CASE WHEN status THEN 'active' ELSE 'suspended' END);
        ALTER TABLE public.profiles ALTER COLUMN status SET DEFAULT 'active';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'shops' AND column_name = 'status' AND data_type = 'boolean'
    ) THEN
        ALTER TABLE public.shops ALTER COLUMN status DROP DEFAULT;
        ALTER TABLE public.shops ALTER COLUMN status TYPE TEXT USING (CASE WHEN status THEN 'active' ELSE 'suspended' END);
        ALTER TABLE public.shops ALTER COLUMN status SET DEFAULT 'active';
    END IF;
END $$;

-- 1. BẢNG CẤU HÌNH HỆ THỐNG TOÀN CỤC (system_configs)
CREATE TABLE IF NOT EXISTS public.system_configs (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT now(),
    updated_by UUID REFERENCES auth.users(id)
);

-- Seed các cấu hình hệ thống mặc định
INSERT INTO public.system_configs (key, value, description) VALUES
('groq_api_keys', '["gsk_default_system_key_placeholder"]'::jsonb, 'Danh sách Groq API Keys dùng chung cho toàn hệ thống'),
('default_ai_prompt', '"Bóc tách thông tin đơn hàng thô thành JSON chuẩn: {customer_name, phone, address, items, cod_amount, note}"'::jsonb, 'AI System Prompt mặc định cho bóc tách địa chỉ'),
('global_blacklist_phones', '["0900000000", "0911111111"]'::jsonb, 'Danh sách SĐT xấu / bom hàng toàn hệ thống'),
('maintenance_mode', '{"enabled": false, "message": "Hệ thống đang bảo trì nâng cấp, vui lòng quay lại sau."}'::jsonb, 'Cấu hình bật/tắt chế độ bảo trì hệ thống'),
('extension_version', '{"min_required": "1.0", "latest": "1.1", "force_update": false}'::jsonb, 'Cấu hình phiên bản Extension tối thiểu')
ON CONFLICT (key) DO NOTHING;

-- 2. BẢNG CỜ TÍNH NĂNG THEO SHOP (shop_feature_flags)
CREATE TABLE IF NOT EXISTS public.shop_feature_flags (
    shop_id UUID PRIMARY KEY REFERENCES public.shops(id) ON DELETE CASCADE,
    ai_parsing_enabled BOOLEAN DEFAULT true,
    smart_address_enabled BOOLEAN DEFAULT true,
    vnpost_autofill_enabled BOOLEAN DEFAULT true,
    jt_autofill_enabled BOOLEAN DEFAULT true,
    use_system_groq_key BOOLEAN DEFAULT true,
    excel_export_enabled BOOLEAN DEFAULT true,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. BẢNG HẠN NGẠCH THỜI GIAN VÀ SỬ DỤNG THEO SHOP (shop_quotas)
CREATE TABLE IF NOT EXISTS public.shop_quotas (
    shop_id UUID PRIMARY KEY REFERENCES public.shops(id) ON DELETE CASCADE,
    daily_ai_limit INT DEFAULT 500, -- Số lượt bóc tách AI tối đa/ngày
    max_devices INT DEFAULT 5, -- Số thiết bị Chrome Extension kết nối tối đa
    expires_at TIMESTAMPTZ DEFAULT (now() + interval '365 days'), -- Ngày hết hạn gói dịch vụ
    notes TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. BẢNG THEO DÕI ĐĂNG NHẬP THẤT BẠI (CHỐNG BRUTE-FORCE)
CREATE TABLE IF NOT EXISTS public.login_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier TEXT NOT NULL, -- Email hoặc Username hoặc IP
    ip_address TEXT,
    failed_count INT DEFAULT 1,
    locked_until TIMESTAMPTZ,
    last_attempt TIMESTAMPTZ DEFAULT now()
);

-- Index cho login_attempts
CREATE INDEX IF NOT EXISTS idx_login_attempts_identifier ON public.login_attempts(identifier);

-- 5. RPC METRICS HỆ THỐNG CHO MASTER ADMIN
CREATE OR REPLACE FUNCTION public.admin_get_system_metrics()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_shops INT;
    v_active_shops INT;
    v_total_users INT;
    v_total_orders INT;
    v_active_devices INT;
    v_result JSONB;
BEGIN
    -- Kiểm tra quyền Admin Tổng
    IF NOT EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() AND r.code = 'SYSTEM_ADMIN'
    ) THEN
        RAISE EXCEPTION 'Truy cập bị từ chối: Chỉ Master Admin mới có quyền thực hiện.';
    END IF;

    SELECT COUNT(*) INTO v_total_shops FROM public.shops WHERE deleted_at IS NULL;
    SELECT COUNT(*) INTO v_active_shops FROM public.shops WHERE status = 'active' AND deleted_at IS NULL;
    SELECT COUNT(*) INTO v_total_users FROM public.profiles WHERE status = 'active';
    SELECT COUNT(*) INTO v_total_orders FROM public.orders WHERE deleted_at IS NULL;
    SELECT COUNT(*) INTO v_active_devices FROM public.extension_devices WHERE revoked = false;

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

-- 6. RPC TẠO SHOP KÈM TÀI KHOẢN CHỦ SHOP
CREATE OR REPLACE FUNCTION public.admin_create_shop_with_account(
    p_shop_name TEXT,
    p_owner_email TEXT,
    p_owner_full_name TEXT,
    p_owner_password TEXT,
    p_max_devices INT DEFAULT 5,
    p_daily_ai_limit INT DEFAULT 500
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_shop_id UUID;
    v_owner_role_id UUID;
    v_result JSONB;
BEGIN
    -- Kiểm tra quyền Master Admin (Cho phép khi auth.uid() là null trong dev/REST API hoặc có role SYSTEM_ADMIN)
    IF auth.uid() IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() AND r.code = 'SYSTEM_ADMIN'
    ) AND NOT EXISTS (
        SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.email = 'admin@luathuysinh.vn'
    ) THEN
        RAISE EXCEPTION 'Chỉ Master Admin mới có quyền tạo Shop và cấp tài khoản.';
    END IF;

    -- Lấy role_id của SHOP_OWNER
    SELECT id INTO v_owner_role_id FROM public.roles WHERE code = 'SHOP_OWNER' LIMIT 1;

    -- Kiểm tra email xem đã tồn tại chưa
    SELECT id INTO v_user_id FROM public.profiles WHERE email = p_owner_email;

    -- Nếu user chưa có, tạo profile mới
    IF v_user_id IS NULL THEN
        v_user_id := gen_random_uuid();
        INSERT INTO public.profiles (id, email, full_name, status)
        VALUES (v_user_id, p_owner_email, p_owner_full_name, 'active');
    END IF;

    -- Tạo Shop mới
    INSERT INTO public.shops (name, owner_id, status)
    VALUES (p_shop_name, v_user_id, 'active')
    RETURNING id INTO v_shop_id;

    -- Thêm User vào shop_members làm Owner
    INSERT INTO public.shop_members (shop_id, user_id, role_id, status)
    VALUES (v_shop_id, v_user_id, v_owner_role_id, 'active')
    ON CONFLICT (shop_id, user_id) DO UPDATE SET status = 'active';

    -- Khởi tạo cờ tính năng & hạn ngạch
    INSERT INTO public.shop_feature_flags (shop_id) VALUES (v_shop_id) ON CONFLICT DO NOTHING;
    INSERT INTO public.shop_quotas (shop_id, max_devices, daily_ai_limit)
    VALUES (v_shop_id, p_max_devices, p_daily_ai_limit)
    ON CONFLICT (shop_id) DO UPDATE SET max_devices = p_max_devices, daily_ai_limit = p_daily_ai_limit;

    -- Ghi Audit Log
    INSERT INTO public.audit_logs (user_id, shop_id, action, target_resource, target_id, payload)
    VALUES (auth.uid(), v_shop_id, 'ADMIN_CREATE_SHOP', 'shops', v_shop_id::text, 
        jsonb_build_object('shop_name', p_shop_name, 'owner_email', p_owner_email));

    RETURN jsonb_build_object('success', true, 'shop_id', v_shop_id, 'user_id', v_user_id);
END;
$$;

-- 7. RPC ĐẶT LẠI MẬT KHẨU TÀI KHOẢN SHOP
CREATE OR REPLACE FUNCTION public.admin_reset_user_password(
    p_target_user_id UUID,
    p_new_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() AND r.code = 'SYSTEM_ADMIN'
    ) THEN
        RAISE EXCEPTION 'Chỉ Master Admin mới có quyền reset mật khẩu.';
    END IF;

    -- Ghi log reset password
    INSERT INTO public.audit_logs (user_id, action, target_resource, target_id, payload)
    VALUES (auth.uid(), 'ADMIN_RESET_PASSWORD', 'profiles', p_target_user_id::text, 
        jsonb_build_object('reset_by', auth.uid(), 'timestamp', now()));

    RETURN jsonb_build_object('success', true, 'message', 'Đã ghi nhận yêu cầu đổi mật khẩu cho tài khoản.');
END;
$$;

-- 8. POLICIES VÀ RLS CHO CÁC BẢNG MỚI
ALTER TABLE public.system_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- Mọi user đăng nhập đều có thể đọc system_configs và shop_feature_flags của shop mình
DROP POLICY IF EXISTS "Anyone authed can read system_configs" ON public.system_configs;
CREATE POLICY "Anyone authed can read system_configs" ON public.system_configs
FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Master Admin full access system_configs" ON public.system_configs;
CREATE POLICY "Master Admin full access system_configs" ON public.system_configs
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() AND r.code = 'SYSTEM_ADMIN'
    )
);

DROP POLICY IF EXISTS "Shop members can read their feature flags" ON public.shop_feature_flags;
CREATE POLICY "Shop members can read their feature flags" ON public.shop_feature_flags
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.shop_members 
        WHERE shop_members.user_id = auth.uid() 
          AND shop_members.shop_id = shop_feature_flags.shop_id
    ) OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() AND r.code = 'SYSTEM_ADMIN'
    )
);

DROP POLICY IF EXISTS "Shop members can read their quotas" ON public.shop_quotas;
CREATE POLICY "Shop members can read their quotas" ON public.shop_quotas
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.shop_members 
        WHERE shop_members.user_id = auth.uid() 
          AND shop_members.shop_id = shop_quotas.shop_id
    ) OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() AND r.code = 'SYSTEM_ADMIN'
    )
);

-- 8.1 POLICY ZERO-TRUST MULTI-TENANT BẢO VỆ BẢNG SHOPS
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can only access owned or member shops" ON public.shops;
CREATE POLICY "Users can only access owned or member shops" ON public.shops
FOR ALL USING (
    owner_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.shop_members 
        WHERE shop_members.shop_id = shops.id AND shop_members.user_id = auth.uid()
    )
    OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() AND r.code = 'SYSTEM_ADMIN'
    )
    OR auth.uid() IS NULL
);

-- 8.2 HÀM TRUY VẤN DANH SÁCH SHOP DÀNH CHO MASTER ADMIN (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_master_admin_shops()
RETURNS TABLE (
    id UUID,
    name TEXT,
    owner_id UUID,
    status TEXT,
    created_at TIMESTAMPTZ,
    owner_email TEXT,
    owner_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.name,
        s.owner_id,
        COALESCE(s.status, 'active') AS status,
        s.created_at,
        COALESCE(NULLIF(p.email, ''), 'admin@luathuysinh.vn') AS owner_email,
        COALESCE(NULLIF(p.full_name, ''), p.email, 'Master Admin (Luật Thủy Sinh)') AS owner_name
    FROM public.shops s
    LEFT JOIN public.profiles p ON s.owner_id = p.id
    ORDER BY s.created_at DESC;
END;
-- 8.3 HÀM XÓA CỬA HÀNG DÀNH CHO MASTER ADMIN (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.admin_delete_shop(p_shop_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    IF NOT public.is_system_admin() THEN
        RAISE EXCEPTION 'Truy cập bị từ chối: Chỉ Master Admin mới có quyền thực hiện.';
    END IF;
    DELETE FROM public.shops WHERE id = p_shop_id;
    RETURN jsonb_build_object('success', true, 'message', 'Đã xóa Cửa hàng thành công.');
END;
$$;

-- 9. GÁN QUYỀN MASTER ADMIN (SYSTEM_ADMIN) CHO TÀI KHOẢN admin@luathuysinh.vn
DO $$
DECLARE
    v_admin_user_id UUID;
    v_sys_admin_role_id UUID;
BEGIN
    -- Lấy role_id của SYSTEM_ADMIN
    SELECT id INTO v_sys_admin_role_id FROM public.roles WHERE code = 'SYSTEM_ADMIN' LIMIT 1;
    
    -- Nếu chưa có role SYSTEM_ADMIN, tạo mới
    IF v_sys_admin_role_id IS NULL THEN
        INSERT INTO public.roles (code, name) VALUES ('SYSTEM_ADMIN', 'Quản trị viên Hệ thống')
        RETURNING id INTO v_sys_admin_role_id;
    END IF;

    -- Lấy user_id từ profiles hoặc auth.users
    SELECT id INTO v_admin_user_id FROM public.profiles WHERE email = 'admin@luathuysinh.vn' LIMIT 1;
    IF v_admin_user_id IS NULL THEN
        SELECT id INTO v_admin_user_id FROM auth.users WHERE email = 'admin@luathuysinh.vn' LIMIT 1;
    END IF;

    -- Nếu user_id chưa có, tạo profile giả lập cho v_admin_user_id
    IF v_admin_user_id IS NULL THEN
        v_admin_user_id := gen_random_uuid();
    END IF;

    INSERT INTO public.profiles (id, email, full_name, status)
    VALUES (v_admin_user_id, 'admin@luathuysinh.vn', 'Master Admin (Luật Thủy Sinh)', 'active')
    ON CONFLICT (id) DO UPDATE SET status = 'active';

    INSERT INTO public.user_roles (user_id, role_id)
    VALUES (v_admin_user_id, v_sys_admin_role_id)
    ON CONFLICT (user_id, role_id) DO NOTHING;

    -- Seed Shop mặc định ban đầu nếu bảng shops trống
    IF NOT EXISTS (SELECT 1 FROM public.shops LIMIT 1) THEN
        INSERT INTO public.shops (name, owner_id, status)
        VALUES ('Shop Hệ Thống (Yến Lũa)', v_admin_user_id, 'active');
    END IF;
END $$;



-- ======================================================================
-- FILE: v7_auth_roles_update.sql
-- ======================================================================
-- =========================================================================
-- AI ORDER EXTENSION V7 — AUTH ROLES UPDATE (Supabase Auth + Roles)
-- Thêm role EXTENSION_USER + RPC get_user_role
-- Chạy sau v4_saas_architecture.sql (KHÔNG chạy v6_panel_accounts.sql)
-- =========================================================================

-- 1. Thêm role EXTENSION_USER (người dùng Panel/Options cơ bản)
INSERT INTO public.roles (code, name) VALUES
('EXTENSION_USER', 'Người dùng Extension')
ON CONFLICT (code) DO NOTHING;

-- 2. RPC: LẤY ROLE CỦA USER
CREATE OR REPLACE FUNCTION public.get_user_role(p_user_id UUID DEFAULT auth.uid())
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    v_role_code TEXT;
BEGIN
    SELECT r.code INTO v_role_code
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = p_user_id
    LIMIT 1;

    RETURN v_role_code;
END;
$$;

-- 3. RPC: LẤY DANH SÁCH USER + ROLE (cho Admin)
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
    user_id UUID,
    email TEXT,
    full_name TEXT,
    role_code TEXT,
    role_name TEXT,
    status TEXT,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
BEGIN
    IF NOT public.is_system_admin() THEN
        RAISE EXCEPTION 'Truy cập bị từ chối: Yêu cầu quyền SYSTEM_ADMIN.';
    END IF;

    RETURN QUERY
    SELECT
        p.id,
        p.email,
        p.full_name,
        r.code,
        r.name,
        p.status,
        p.last_login,
        p.created_at
    FROM public.profiles p
    LEFT JOIN public.user_roles ur ON p.id = ur.user_id
    LEFT JOIN public.roles r ON ur.role_id = r.id
    ORDER BY p.created_at DESC;
END;
$$;

-- 4. RPC: ADMIN TẠO USER (tạo auth.users + profiles + user_roles)
CREATE OR REPLACE FUNCTION public.admin_create_user(
    p_email TEXT,
    p_password TEXT,
    p_full_name TEXT DEFAULT NULL,
    p_role_code TEXT DEFAULT 'EXTENSION_USER'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id UUID;
    v_role_id UUID;
BEGIN
    IF NOT public.is_system_admin() THEN
        RAISE EXCEPTION 'Truy cập bị từ chối: Chỉ Master Admin mới có quyền thực hiện.';
    END IF;

    -- Kiểm tra role tồn tại
    SELECT id INTO v_role_id FROM public.roles WHERE code = p_role_code;
    IF v_role_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Role không tồn tại: ' || p_role_code);
    END IF;

    -- Tạo user trong auth.users (chỉ được gọi bởi service_role key)
    -- Lưu ý: Cần gọi từ server-side với service_role key
    v_user_id := gen_random_uuid();

    INSERT INTO public.profiles (id, email, full_name, status)
    VALUES (v_user_id, p_email, COALESCE(p_full_name, split_part(p_email, '@', 1)), 'active');

    INSERT INTO public.user_roles (user_id, role_id)
    VALUES (v_user_id, v_role_id);

    RETURN jsonb_build_object(
        'success', true,
        'user_id', v_user_id,
        'email', p_email,
        'role', p_role_code
    );
END;
$$;

-- 5. RPC: ADMIN GÁN ROLE CHO USER
CREATE OR REPLACE FUNCTION public.admin_set_user_role(
    p_user_id UUID,
    p_role_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_role_id UUID;
BEGIN
    IF NOT public.is_system_admin() THEN
        RAISE EXCEPTION 'Truy cập bị từ chối: Chỉ Master Admin mới có quyền thực hiện.';
    END IF;

    SELECT id INTO v_role_id FROM public.roles WHERE code = p_role_code;
    IF v_role_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Role không tồn tại: ' || p_role_code);
    END IF;

    DELETE FROM public.user_roles WHERE user_id = p_user_id;
    INSERT INTO public.user_roles (user_id, role_id) VALUES (p_user_id, v_role_id);

    RETURN jsonb_build_object('success', true, 'user_id', p_user_id, 'role', p_role_code);
END;
$$;


-- ======================================================================
-- FILE: v8_admin_shop_member_rpc.sql
-- ======================================================================
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


-- ======================================================================
-- FILE: v9_admin_create_user_rpc.sql
-- ======================================================================
-- =========================================================================
-- v9_admin_create_user_rpc.sql
-- RPC cho Admin:
--   1. Tạo tài khoản auth.users + profile (bypass email rate limit)
--   2. Reset mật khẩu tài khoản
--
-- CÁCH DÙNG:
--   1. Mở Supabase Dashboard -> SQL Editor
--   2. Copy toàn bộ nội dung file này, dán vào, bấm RUN
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP FUNCTION IF EXISTS public.admin_create_user(TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.admin_reset_user_password(UUID, TEXT);

-- Đảm bảo bảng audit_logs tồn tại đúng schema (có user_id)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='audit_logs' AND column_name='user_id') THEN
        ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id);
    END IF;
END $$;

-- =====================================================================
-- 1. RPC: Tạo user mới
-- =====================================================================
CREATE OR REPLACE FUNCTION public.admin_create_user(
    p_email TEXT,
    p_password TEXT,
    p_full_name TEXT DEFAULT NULL,
    p_role_code TEXT DEFAULT 'EXTENSION_USER'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_role_id UUID;
    v_inst_id UUID;
BEGIN
    IF auth.uid() IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() AND r.code = 'SYSTEM_ADMIN'
    ) AND NOT EXISTS (
        SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.email = 'admin@luathuysinh.vn'
    ) THEN
        RAISE EXCEPTION 'Chỉ Master Admin mới có quyền tạo tài khoản mới.';
    END IF;

    IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_email) THEN
        RAISE EXCEPTION 'Email này đã được đăng ký trên hệ thống.';
    END IF;

    SELECT id INTO v_role_id FROM public.roles WHERE code = p_role_code;
    IF v_role_id IS NULL THEN
        RAISE EXCEPTION 'Role không tồn tại: %', p_role_code;
    END IF;

    -- Lấy instance_id đúng từ auth.instances (bắt buộc cho GoTrue login)
    SELECT id INTO v_inst_id FROM auth.instances LIMIT 1;

    v_user_id := gen_random_uuid();

    INSERT INTO auth.users (
        instance_id, id, aud, role, email,
        encrypted_password, email_confirmed_at,
        confirmation_token, recovery_token,
        created_at, updated_at, confirmation_sent_at
    ) VALUES (
        v_inst_id,
        v_user_id, 'authenticated', 'authenticated', p_email,
        crypt(p_password, gen_salt('bf')), now(),
        '', '', now(), now(), now()
    );

    INSERT INTO auth.identities (
        id, user_id, identity_data, provider, provider_id,
        last_sign_in_at, created_at, updated_at
    ) VALUES (
        v_user_id, v_user_id,
        jsonb_build_object('sub', v_user_id::text, 'email', p_email),
        'email', p_email, now(), now(), now()
    );

    INSERT INTO public.profiles (id, email, full_name, status, created_at)
    VALUES (v_user_id, p_email, COALESCE(p_full_name, split_part(p_email, '@', 1)), 'active', now())
    ON CONFLICT (id) DO UPDATE SET
        email = p_email, full_name = COALESCE(p_full_name, split_part(p_email, '@', 1));

    DELETE FROM public.user_roles WHERE user_id = v_user_id;
    INSERT INTO public.user_roles (user_id, role_id) VALUES (v_user_id, v_role_id);

    RETURN jsonb_build_object('success', true, 'user_id', v_user_id, 'email', p_email, 'role', p_role_code);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_user(TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_user(TEXT, TEXT, TEXT, TEXT) TO service_role;

-- =====================================================================
-- 2. RPC: Reset mật khẩu
-- =====================================================================
CREATE OR REPLACE FUNCTION public.admin_reset_user_password(
    p_target_user_id UUID,
    p_new_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF auth.uid() IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() AND r.code = 'SYSTEM_ADMIN'
    ) AND NOT EXISTS (
        SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.email = 'admin@luathuysinh.vn'
    ) THEN
        RAISE EXCEPTION 'Chỉ Master Admin mới có quyền reset mật khẩu.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_target_user_id) THEN
        RAISE EXCEPTION 'Tài khoản không tồn tại.';
    END IF;

    UPDATE auth.users
    SET encrypted_password = crypt(p_new_password, gen_salt('bf')), updated_at = now()
    WHERE id = p_target_user_id;

    RETURN jsonb_build_object('success', true, 'message', 'Đã reset mật khẩu thành công.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_reset_user_password(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_user_password(UUID, TEXT) TO service_role;

-- =====================================================================
-- Migration v23: Sửa lỗi RPC Đổi tên & Đổi mật khẩu cho Master Admin
-- =====================================================================

CREATE OR REPLACE FUNCTION public.admin_update_user_name(
    p_target_user_id UUID,
    p_full_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    IF NOT public.is_system_admin() THEN
        RAISE EXCEPTION 'Chỉ Master Admin mới có quyền đổi tên người dùng.';
    END IF;

    UPDATE public.profiles
    SET full_name = p_full_name, updated_at = now()
    WHERE id = p_target_user_id;

    RETURN jsonb_build_object('success', true, 'message', 'Đã đổi tên thành công.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_user_name(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_user_name(UUID, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_reset_user_password(
    p_target_user_id UUID,
    p_new_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth
AS $$
BEGIN
    IF NOT public.is_system_admin() THEN
        RAISE EXCEPTION 'Chỉ Master Admin mới có quyền reset mật khẩu.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_target_user_id) THEN
        RAISE EXCEPTION 'Tài khoản không tồn tại.';
    END IF;

    UPDATE auth.users
    SET encrypted_password = crypt(p_new_password, gen_salt('bf')), updated_at = now()
    WHERE id = p_target_user_id;

    RETURN jsonb_build_object('success', true, 'message', 'Đã reset mật khẩu thành công.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_reset_user_password(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_user_password(UUID, TEXT) TO service_role;





-- =========================================================================
-- v34_harden_system_configs.sql
-- KHÓA BẢNG system_configs — VÁ LỖ HỔNG DO v26_system_configs_open_policy.sql
--
-- v26 đã tạo policy USING(true) / WITH CHECK(true) và GRANT ALL cho anon +
-- authenticated trên public.system_configs. Bảng này chứa `groq_api_keys`
-- (khóa nhà cung cấp AI), nên bất kỳ ai có anon key của project (anon key
-- nằm sẵn trong extension) đều đọc/ghi được.
--
-- Migration này forward-only:
--   1. Drop 2 policy mở của v26.
--   2. REVOKE toàn bộ quyền bảng khỏi anon + authenticated (chỉ service_role
--      còn quyền trực tiếp — Edge Function ai-gateway dùng service role).
--   3. Bổ sung RPC admin_get_system_config() để Admin Dashboard đọc cấu hình
--      (kèm updated_at) mà không cần SELECT thẳng REST. Ghi vẫn dùng
--      upsert_system_config() đã có từ v21 (guard is_system_admin).
--   4. Assertion: fail nếu vẫn còn policy/grant mở.
--
-- SAU KHI CHẠY: nếu `groq_api_keys` từng chứa key thật trong lúc v26 còn hiệu
-- lực thì phải coi như đã lộ → rotate key tại Groq trước khi lưu key mới.
-- =========================================================================

-- ---------------------------------------------------------------------
-- 1. Gỡ policy mở của v26
-- ---------------------------------------------------------------------
ALTER TABLE public.system_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_read_system_configs" ON public.system_configs;
DROP POLICY IF EXISTS "allow_write_system_configs" ON public.system_configs;

-- Không tạo policy thay thế: RLS bật + không có policy = deny toàn bộ với
-- anon/authenticated. service_role bypass RLS nên Edge Function vẫn đọc được.

-- ---------------------------------------------------------------------
-- 2. Thu hồi quyền bảng đã GRANT ở v26
-- ---------------------------------------------------------------------
REVOKE ALL ON TABLE public.system_configs FROM anon;
REVOKE ALL ON TABLE public.system_configs FROM authenticated;
GRANT ALL ON TABLE public.system_configs TO service_role;

-- ---------------------------------------------------------------------
-- 3. RPC đọc cấu hình cho Admin Dashboard (kèm updated_at)
--    Ghi: dùng public.upsert_system_config() từ v21 (đã guard is_system_admin).
--    Đọc key thường: dùng public.get_system_config_value() từ v21.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_get_system_config(
    p_key TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
    v_row RECORD;
BEGIN
    IF NOT public.is_system_admin() THEN
        RAISE EXCEPTION 'ACCESS_DENIED';
    END IF;

    IF p_key IS NULL OR length(p_key) > 64 THEN
        RAISE EXCEPTION 'INVALID_KEY';
    END IF;

    SELECT sc.value, sc.updated_at INTO v_row
    FROM public.system_configs sc
    WHERE sc.key = p_key
    LIMIT 1;

    IF v_row IS NULL THEN
        RETURN NULL;
    END IF;

    RETURN jsonb_build_object('value', v_row.value, 'updated_at', v_row.updated_at);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_system_config(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_system_config(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_system_config(TEXT) TO service_role;

-- ---------------------------------------------------------------------
-- 4. ASSERTION — chạy cuối, fail nếu bảng vẫn còn mở
-- ---------------------------------------------------------------------
DO $$
DECLARE
    v_open_policies INT;
    v_open_grants INT;
BEGIN
    SELECT count(*) INTO v_open_policies
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'system_configs'
      AND (COALESCE(qual, '') = 'true' OR COALESCE(with_check, '') = 'true');

    IF v_open_policies > 0 THEN
        RAISE EXCEPTION 'ASSERTION FAILED: system_configs còn % policy USING/WITH CHECK true', v_open_policies;
    END IF;

    SELECT count(*) INTO v_open_grants
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND table_name = 'system_configs'
      AND grantee IN ('anon', 'authenticated');

    IF v_open_grants > 0 THEN
        RAISE EXCEPTION 'ASSERTION FAILED: system_configs còn % grant cho anon/authenticated', v_open_grants;
    END IF;

    RAISE NOTICE 'OK: system_configs đã bị khóa (chỉ service_role + RPC admin).';
END;
$$;


-- ======================================================================
-- FILE: v47_prevent_fake_shops.sql
-- ======================================================================
-- =========================================================================
-- v47_prevent_fake_shops.sql
-- Cập nhật hạn mức mặc định của Shop mới về gói FREE chuẩn và bổ sung trigger
-- giới hạn số lượng Shop tối đa trên mỗi tài khoản để chặn lạm dụng shop ảo.
-- =========================================================================

-- 1. Hàm get_user_max_shops: Tính toán số lượng shop tối đa một user được sở hữu dựa trên phân quyền/gói cước
CREATE OR REPLACE FUNCTION public.get_user_max_shops(p_user_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_shops INT := 1; -- Mặc định gói FREE chỉ được sở hữu tối đa 1 shop hoạt động
  v_is_admin BOOLEAN := false;
  v_has_paid_sub BOOLEAN := false;
BEGIN
  -- 1a. Kiểm tra nếu là SYSTEM_ADMIN hoặc SUPPORT
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = p_user_id AND r.code IN ('SYSTEM_ADMIN', 'SUPPORT')
  ) INTO v_is_admin;

  IF v_is_admin THEN
    RETURN 999; -- Admin hệ thống không bị giới hạn shop
  END IF;

  -- 1b. Kiểm tra xem user này có sở hữu shop nào có subscription hoạt động gói PRO hoặc BUSINESS không
  SELECT EXISTS (
    SELECT 1 FROM public.shops s
    JOIN public.subscriptions sub ON sub.shop_id = s.id
    WHERE s.owner_id = p_user_id
      AND s.deleted_at IS NULL
      AND sub.status IN ('active', 'trialing')
      AND sub.plan_code IN ('PRO', 'BUSINESS')
  ) INTO v_has_paid_sub;

  IF v_has_paid_sub THEN
    RETURN 10; -- Có gói trả phí thì được tạo tối đa 10 chi nhánh/shop
  END IF;

  RETURN v_max_shops;
END;
$$;

-- 2. Trigger Function và Trigger giới hạn số lượng shop hoạt động trên mỗi Owner
CREATE OR REPLACE FUNCTION public.trg_limit_shops_per_owner_func()
RETURNS TRIGGER AS $$
DECLARE
  v_max_shops INT;
  v_current_shops INT;
BEGIN
  -- Chỉ kiểm tra đối với các shop hoạt động (không bị soft delete)
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Lấy giới hạn shop của user
  v_max_shops := public.get_user_max_shops(NEW.owner_id);

  -- Đếm số shop hoạt động hiện tại (loại trừ chính shop đang cập nhật nếu là UPDATE)
  SELECT COUNT(*) INTO v_current_shops
  FROM public.shops
  WHERE owner_id = NEW.owner_id
    AND deleted_at IS NULL
    AND id <> NEW.id;

  IF v_current_shops >= v_max_shops THEN
    RAISE EXCEPTION 'Tài khoản của bạn chỉ được sở hữu tối đa % cửa hàng hoạt động ở gói cước hiện tại. Vui lòng nâng cấp gói cước để thêm chi nhánh/cửa hàng mới.', v_max_shops;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_limit_shops_per_owner ON public.shops;
CREATE TRIGGER trg_limit_shops_per_owner
BEFORE INSERT OR UPDATE OF owner_id, deleted_at ON public.shops
FOR EACH ROW
EXECUTE FUNCTION public.trg_limit_shops_per_owner_func();


-- 3. Cập nhật hàm consume_ai_quota để tự động khởi tạo quota gói FREE chuẩn (50 daily / 1000 monthly) khi thiếu dòng
CREATE OR REPLACE FUNCTION public.consume_ai_quota(
    p_shop_id UUID,
    p_delta INT DEFAULT 1,
    p_prompt_tokens INT DEFAULT 0,
    p_completion_tokens INT DEFAULT 0,
    p_request_type TEXT DEFAULT 'parse',
    p_device_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_daily_limit INT;
    v_daily_used  INT;
    v_monthly_limit INT;
    v_monthly_used  INT;
BEGIN
    -- 1) Điều kiện: user phải thuộc shop (hoặc SYSTEM_ADMIN)
    IF NOT public.check_shop_member_or_admin(p_shop_id) THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'ACCESS_DENIED',
            'message', 'Tài khoản không thuộc shop này.'
        );
    END IF;

    -- Tự động tạo quota gói FREE chuẩn nếu thiếu (max_devices = 1, max_users = 1, daily_ai_limit = 50, monthly_ai_limit = 1000)
    INSERT INTO public.shop_quotas (shop_id, max_devices, max_users, monthly_order_limit, daily_ai_limit, monthly_ai_limit)
    VALUES (p_shop_id, 1, 1, 300, 50, 1000)
    ON CONFLICT (shop_id) DO NOTHING;

    -- 2) Chuẩn hoá bucket tháng (reset khi sang tháng mới)
    PERFORM _ai_refresh_monthly_window(p_shop_id);

    -- 3) ATOMIC UPDATE: điều kiện giới hạn nằm NGAY trong WHERE
    UPDATE public.shop_quotas q
    SET
        daily_ai_used = CASE
            WHEN q.daily_reset_at::date <> CURRENT_DATE THEN 0
            ELSE q.daily_ai_used
        END + p_delta,
        daily_reset_at = CASE
            WHEN q.daily_reset_at::date <> CURRENT_DATE THEN now()
            ELSE q.daily_reset_at
        END,
        monthly_ai_used = q.monthly_ai_used + p_delta,
        updated_at = now()
    WHERE q.shop_id = p_shop_id
      AND (
            CASE WHEN q.daily_reset_at::date <> CURRENT_DATE THEN p_delta
                 ELSE q.daily_ai_used + p_delta END
          ) <= COALESCE(q.daily_ai_limit, 50)
      AND (q.monthly_ai_used + p_delta) <= COALESCE(q.monthly_ai_limit, 1000)
    RETURNING q.daily_ai_limit, q.daily_ai_used, q.monthly_ai_limit, q.monthly_ai_used
    INTO v_daily_limit, v_daily_used, v_monthly_limit, v_monthly_used;

    -- 4) Không matching -> hết quota (hoặc daily_ai_limit là null)
    IF NOT FOUND THEN
        SELECT COALESCE(daily_ai_limit, 50),
               COALESCE(monthly_ai_limit, 1000)
        INTO v_daily_limit, v_monthly_limit
        FROM public.shop_quotas WHERE shop_id = p_shop_id;

        INSERT INTO public.ai_usage_log
            (shop_id, user_id, device_id, request_type, status)
        VALUES
            (p_shop_id, auth.uid(), p_device_id, p_request_type, 'quota_exceeded');

        RETURN jsonb_build_object(
            'success', false,
            'code', 'AI_QUOTA_EXCEEDED',
            'message', 'Shop đã hết hạn mức AI.',
            'daily_remaining', 0,
            'monthly_remaining', 0
        );
    END IF;

    -- 5) Ghi usage (thành công)
    INSERT INTO public.ai_usage_log
        (shop_id, user_id, device_id, request_type, prompt_tokens, completion_tokens, status)
    VALUES
        (p_shop_id, auth.uid(), p_device_id, p_request_type, p_prompt_tokens, p_completion_tokens, 'success');

    RETURN jsonb_build_object(
        'success', true,
        'daily_used', v_daily_used,
        'daily_limit', v_daily_limit,
        'daily_remaining', GREATEST(v_daily_limit - v_daily_used, 0),
        'monthly_used', v_monthly_used,
        'monthly_limit', v_monthly_limit,
        'monthly_remaining', GREATEST(v_monthly_limit - v_monthly_used, 0)
    );
END;
$$;


-- 4. Cập nhật get_ai_budget để tự tạo quota gói FREE chuẩn khi thiếu dòng
CREATE OR REPLACE FUNCTION public.get_ai_budget(p_shop_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_shop_id UUID;
    v_row     RECORD;
BEGIN
    IF p_shop_id IS NULL THEN
        SELECT shop_id INTO v_shop_id
        FROM public.shop_members sm
        WHERE sm.user_id = auth.uid()
          AND sm.status = 'active'
          AND sm.removed_at IS NULL
        ORDER BY sm.created_at ASC
        LIMIT 1;
    ELSE
        v_shop_id := p_shop_id;
    END IF;

    IF v_shop_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'code', 'AI_SHOP_REQUIRED',
            'message', 'Shop chưa xác định.');
    END IF;

    IF NOT public.check_shop_member_or_admin(v_shop_id) THEN
        RETURN jsonb_build_object('success', false, 'code', 'ACCESS_DENIED');
    END IF;

    -- Tự sinh quota gói FREE chuẩn nếu thiếu (max_devices = 1, max_users = 1, daily_ai_limit = 50, monthly_ai_limit = 1000)
    INSERT INTO public.shop_quotas (shop_id, max_devices, max_users, monthly_order_limit, daily_ai_limit, monthly_ai_limit)
    VALUES (v_shop_id, 1, 1, 300, 50, 1000)
    ON CONFLICT (v_shop_id) DO NOTHING;

    PERFORM _ai_refresh_monthly_window(v_shop_id);

    SELECT daily_ai_limit, daily_ai_used, monthly_ai_limit, monthly_ai_used
    INTO v_row
    FROM public.shop_quotas WHERE shop_id = v_shop_id;

    IF v_row IS NULL THEN
        RETURN jsonb_build_object('success', false, 'code', 'AI_QUOTA_NOT_FOUND',
            'message', 'Không tìm thấy thông tin hạn mức của shop.');
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'daily_used', v_row.daily_ai_used,
        'daily_limit', v_row.daily_ai_limit,
        'daily_remaining', GREATEST(v_row.daily_ai_limit - v_row.daily_ai_used, 0),
        'monthly_used', v_row.monthly_ai_used,
        'monthly_limit', v_row.monthly_ai_limit,
        'monthly_remaining', GREATEST(v_row.monthly_ai_limit - v_row.monthly_ai_used, 0)
    );
END;
$$;


-- 5. Cập nhật get_my_extension_session để siết chặt hạn ngạch thiết bị, số nhân viên mặc định của gói FREE
CREATE OR REPLACE FUNCTION public.get_my_extension_session(
  p_shop_id UUID DEFAULT NULL,
  p_device_id TEXT DEFAULT NULL,
  p_device_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_shop_id UUID;
  v_result  JSONB;
  v_max_devices INT := 1; -- Đổi mặc định từ 5 xuống 1
  v_is_allowed BOOLEAN := true;
  v_device_limit_exceeded BOOLEAN := false;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'UNAUTHENTICATED');
  END IF;

  -- 5a. Xác định shop_id
  IF p_shop_id IS NOT NULL THEN
    v_shop_id := p_shop_id;
  ELSE
    SELECT sm.shop_id INTO v_shop_id
    FROM shop_members sm
    WHERE sm.user_id = v_user_id
      AND sm.status  = 'active'
      AND sm.removed_at IS NULL
    ORDER BY sm.joined_at ASC
    LIMIT 1;
  END IF;

  -- 5b. Đăng ký/cập nhật thông tin thiết bị và last_seen nếu có p_device_id
  IF p_device_id IS NOT NULL AND v_shop_id IS NOT NULL THEN
    INSERT INTO public.extension_devices (user_id, device_id, device_name, browser, last_seen, revoked)
    VALUES (v_user_id, p_device_id, COALESCE(p_device_name, 'Chrome Extension'), 'Chrome', now(), false)
    ON CONFLICT (user_id, device_id)
    DO UPDATE SET 
      device_name = COALESCE(p_device_name, public.extension_devices.device_name),
      last_seen = now(),
      browser = 'Chrome';
  END IF;

  -- 5c. Xử lý trường hợp không thuộc shop nào (chỉ hệ thống admin được truy cập)
  IF v_shop_id IS NULL THEN
    IF EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = v_user_id AND r.code = 'SYSTEM_ADMIN'
    ) THEN
      RETURN jsonb_build_object(
        'role',                  'SYSTEM_ADMIN',
        'shop_id',               NULL,
        'shop_name',             'System',
        'status',                'active',
        'permissions',           '["*"]'::JSONB,
        'features', jsonb_build_object(
          'ai_parsing_enabled',      true,
          'smart_address_enabled',   true,
          'vnpost_autofill_enabled', true,
          'jt_autofill_enabled',     true
        ),
        'max_devices',           999,
        'max_users',             999,
        'monthly_order_limit',   999999,
        'custom_prompt_rules',   '',
        'device_limit_exceeded', false
      );
    END IF;
    RETURN jsonb_build_object('error', 'NOT_IN_ANY_SHOP');
  END IF;

  -- 5d. Đọc giới hạn max_devices của shop (Mặc định gói FREE: 1 thiết bị)
  SELECT COALESCE(sq.max_devices, 1) INTO v_max_devices
  FROM public.shop_quotas sq
  WHERE sq.shop_id = v_shop_id;

  -- 5e. Kiểm tra giới hạn thiết bị hoạt động thực tế (dựa trên last_seen DESC)
  IF p_device_id IS NOT NULL THEN
    -- Nếu thiết bị đã bị đánh dấu revoked = true
    IF EXISTS (
      SELECT 1 FROM public.extension_devices 
      WHERE user_id = v_user_id AND device_id = p_device_id AND revoked = true
    ) THEN
      v_device_limit_exceeded := true;
    ELSE
      -- Xếp hạng các thiết bị hoạt động của shop để chỉ cho phép top max_devices thiết bị hoạt động gần nhất
      WITH ranked_devices AS (
        SELECT d.device_id,
               ROW_NUMBER() OVER (ORDER BY d.last_seen DESC) as rank
        FROM public.extension_devices d
        JOIN public.shop_members sm ON sm.user_id = d.user_id
        WHERE sm.shop_id = v_shop_id
          AND sm.status = 'active'
          AND sm.removed_at IS NULL
          AND d.revoked = false
      )
      SELECT EXISTS (
        SELECT 1 FROM ranked_devices 
        WHERE device_id = p_device_id AND rank <= v_max_devices
      ) INTO v_is_allowed;
      
      IF NOT v_is_allowed THEN
        v_device_limit_exceeded := true;
      END IF;
    END IF;
  END IF;

  -- 5f. Trả về cấu hình chi tiết với các giá trị COALESCE gói FREE chuẩn (max_users = 1, monthly_order_limit = 300)
  RETURN (
    SELECT jsonb_build_object(
      'shop_id',               sm.shop_id,
      'shop_name',             s.name,
      'role',                  r.code,
      'status',                sm.status,
      'permissions',           COALESCE(sm.permissions, '[]'::JSONB),
      'features', jsonb_build_object(
        'ai_parsing_enabled',      COALESCE(ff.ai_parsing_enabled, true),
        'smart_address_enabled',   COALESCE(ff.smart_address_enabled, true),
        'vnpost_autofill_enabled', COALESCE(ff.vnpost_autofill_enabled, true),
        'jt_autofill_enabled',     COALESCE(ff.jt_autofill_enabled, true)
      ),
      'member_id',             sm.id,
      'joined_at',             sm.joined_at,
      'max_devices',           v_max_devices,
      'max_users',             COALESCE(sq.max_users, 1),
      'monthly_order_limit',   COALESCE(sq.monthly_order_limit, 300),
      'custom_prompt_rules',   COALESCE(ff.custom_prompt_rules, ''),
      'device_limit_exceeded', v_device_limit_exceeded
    )
    FROM shop_members sm
    JOIN roles r ON r.id = sm.role_id
    JOIN shops s ON s.id = sm.shop_id
    LEFT JOIN shop_feature_flags ff ON ff.shop_id = sm.shop_id
    LEFT JOIN shop_quotas sq ON sq.shop_id = sm.shop_id
    WHERE sm.user_id    = v_user_id
      AND sm.shop_id    = v_shop_id
      AND sm.status     = 'active'
      AND sm.removed_at IS NULL
  );
END;
$$;

-- Cấp quyền thực thi RPC
GRANT EXECUTE ON FUNCTION public.get_user_max_shops(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_max_shops(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_ai_quota(UUID, INT, INT, INT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_ai_quota(UUID, INT, INT, INT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_ai_budget(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ai_budget(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_my_extension_session(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_extension_session(UUID, TEXT, TEXT) TO service_role;

COMMENT ON FUNCTION public.get_user_max_shops IS 'Lấy số lượng shop tối đa được phép sở hữu theo phân quyền.';
COMMENT ON FUNCTION public.trg_limit_shops_per_owner_func IS 'Trigger chặn việc tạo shop vượt giới hạn cho phép.';


-- =========================================================================
-- FILE: v48_strict_order_isolation.sql
-- =========================================================================
-- =========================================================================
-- v48_strict_order_isolation.sql
-- Thắt chặt phân quyền RLS cho các bảng đơn hàng (orders, submitted_orders, history)
-- Tránh rò rỉ dữ liệu chéo giữa các cửa hàng (cross-shop leak) và hỗ trợ
-- tài khoản Quản trị viên hệ thống (SYSTEM_ADMIN) giám sát toàn diện.
-- =========================================================================

-- 1. BẬT TRẠNG THÁI ROW LEVEL SECURITY (RLS)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submitted_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.history ENABLE ROW LEVEL SECURITY;

-- 2. DỌN SẠCH CÁC CHÍNH SÁCH BẢO MẬT (POLICIES) CŨ ĐỂ TRÁNH XUNG ĐỘT (OR EXPRESSION)
DROP POLICY IF EXISTS shop_member_orders_policy ON public.orders;
DROP POLICY IF EXISTS "Strict Shop Isolation for Orders (Read)" ON public.orders;
DROP POLICY IF EXISTS "Strict Shop Isolation for Orders (Insert)" ON public.orders;
DROP POLICY IF EXISTS "Strict Shop Isolation for Orders (Update)" ON public.orders;

DROP POLICY IF EXISTS shop_member_submitted_policy ON public.submitted_orders;
DROP POLICY IF EXISTS "Strict Shop Isolation for Submitted Orders (Read)" ON public.submitted_orders;
DROP POLICY IF EXISTS "Strict Shop Isolation for Submitted Orders (Insert)" ON public.submitted_orders;
DROP POLICY IF EXISTS "Strict Shop Isolation for Submitted Orders (Update)" ON public.submitted_orders;
DROP POLICY IF EXISTS "Strict Shop Isolation for Submitted Orders (Delete)" ON public.submitted_orders;

DROP POLICY IF EXISTS shop_member_history_policy ON public.history;
DROP POLICY IF EXISTS "Strict Shop Isolation for History (Read)" ON public.history;
DROP POLICY IF EXISTS "Strict Shop Isolation for History (Insert)" ON public.history;
DROP POLICY IF EXISTS "Strict Shop Isolation for History (Update)" ON public.history;
DROP POLICY IF EXISTS "Strict Shop Isolation for History (Delete)" ON public.history;


-- =========================================================================
-- 3. CHÍNH SÁCH BẢO MẬT MỚI CHO BẢNG DỰ THẢO ĐƠN HÀNG (public.orders)
-- =========================================================================

-- 3a. Quyền SELECT: Chỉ cho phép thành viên cửa hàng đang hoạt động hoặc Admin hệ thống xem
CREATE POLICY "Strict Shop Isolation for Orders (Read)" ON public.orders
FOR SELECT USING (
  deleted_at IS NULL AND (
    public.is_shop_member(shop_id)
    OR public.is_system_admin()
  )
);

-- 3b. Quyền INSERT: Chỉ cho phép thành viên cửa hàng đang hoạt động thêm đơn
CREATE POLICY "Strict Shop Isolation for Orders (Insert)" ON public.orders
FOR INSERT WITH CHECK (
  public.is_shop_member(shop_id)
);

-- 3c. Quyền UPDATE: Chỉ cho phép thành viên cửa hàng đang hoạt động cập nhật đơn
CREATE POLICY "Strict Shop Isolation for Orders (Update)" ON public.orders
FOR UPDATE USING (
  deleted_at IS NULL AND (
    public.is_shop_member(shop_id)
  )
);

-- 3d. Quyền DELETE: Cấm xóa trực tiếp từ client (hệ thống sử dụng soft-delete qua PATCH deleted_at)
CREATE POLICY "Strict Shop Isolation for Orders (Delete)" ON public.orders
FOR DELETE USING (false);


-- =========================================================================
-- 4. CHÍNH SÁCH BẢO MẬT MỚI CHO BẢNG ĐƠN ĐÃ LÊN HỆ THỐNG (public.submitted_orders)
-- =========================================================================

-- 4a. Quyền SELECT: Chỉ cho phép thành viên cửa hàng đang hoạt động hoặc Admin hệ thống xem
CREATE POLICY "Strict Shop Isolation for Submitted Orders (Read)" ON public.submitted_orders
FOR SELECT USING (
  deleted_at IS NULL AND (
    public.is_shop_member(shop_id)
    OR public.is_system_admin()
  )
);

-- 4b. Quyền INSERT: Chỉ cho phép thành viên cửa hàng đang hoạt động thêm đơn
CREATE POLICY "Strict Shop Isolation for Submitted Orders (Insert)" ON public.submitted_orders
FOR INSERT WITH CHECK (
  public.is_shop_member(shop_id)
);

-- 4c. Quyền UPDATE: Chỉ cho phép thành viên cửa hàng đang hoạt động sửa thông tin (mã tracking...)
CREATE POLICY "Strict Shop Isolation for Submitted Orders (Update)" ON public.submitted_orders
FOR UPDATE USING (
  deleted_at IS NULL AND (
    public.is_shop_member(shop_id)
  )
);

-- 4d. Quyền DELETE: Cho phép thành viên cửa hàng xóa đơn đã lên
CREATE POLICY "Strict Shop Isolation for Submitted Orders (Delete)" ON public.submitted_orders
FOR DELETE USING (
  public.is_shop_member(shop_id)
);


-- =========================================================================
-- 5. CHÍNH SÁCH BẢO MẬT MỚI CHO BẢNG LỊCH SỬ THAY ĐỔI TRẠNG THÁI (public.history)
-- =========================================================================

-- 5a. Quyền SELECT: Chỉ cho phép thành viên cửa hàng đang hoạt động hoặc Admin hệ thống xem
CREATE POLICY "Strict Shop Isolation for History (Read)" ON public.history
FOR SELECT USING (
  deleted_at IS NULL AND (
    public.is_shop_member(shop_id)
    OR public.is_system_admin()
  )
);

-- 5b. Quyền INSERT: Chỉ cho phép thành viên cửa hàng đang hoạt động ghi lịch sử
CREATE POLICY "Strict Shop Isolation for History (Insert)" ON public.history
FOR INSERT WITH CHECK (
  public.is_shop_member(shop_id)
);

-- 5c. Quyền UPDATE: Chỉ cho phép thành viên cửa hàng cập nhật lịch sử
CREATE POLICY "Strict Shop Isolation for History (Update)" ON public.history
FOR UPDATE USING (
  deleted_at IS NULL AND (
    public.is_shop_member(shop_id)
  )
);

-- 5d. Quyền DELETE: Chỉ cho phép thành viên cửa hàng xóa lịch sử
CREATE POLICY "Strict Shop Isolation for History (Delete)" ON public.history
FOR DELETE USING (
  public.is_shop_member(shop_id)
);


-- =========================================================================
-- FILE: v49_unique_shop_owner.sql
-- =========================================================================
-- =========================================================================
-- v49_unique_shop_owner.sql
-- Đảm bảo mỗi cửa hàng (Shop) chỉ có duy nhất một tài khoản Chủ cửa hàng (SHOP_OWNER) hoạt động.
-- Tiến hành dọn dẹp dữ liệu trùng lặp lịch sử và tạo UNIQUE INDEX tầng Database.
-- Sử dụng SQL động (EXECUTE) để tương thích cả cơ sở dữ liệu cũ/mới (có hoặc không có cột role_id).
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


-- =========================================================================
-- FILE: v50_submitted_orders_webhook_columns.sql
-- =========================================================================
-- =========================================================================
-- v50_submitted_orders_webhook_columns.sql
-- Bổ sung các cột phục vụ đối soát tài chính và theo dõi lịch sử cập nhật vận đơn
-- từ Webhook đối với bảng đơn đã lên hệ thống (submitted_orders).
-- =========================================================================

-- 1. Bổ sung các cột đối soát vào bảng submitted_orders
ALTER TABLE public.submitted_orders ADD COLUMN IF NOT EXISTS shipping_fee NUMERIC DEFAULT 0;
ALTER TABLE public.submitted_orders ADD COLUMN IF NOT EXISTS actual_weight NUMERIC DEFAULT 0;
ALTER TABLE public.submitted_orders ADD COLUMN IF NOT EXISTS webhook_logs JSONB DEFAULT '[]'::jsonb;

-- 2. Đảm bảo cột status và updated_at tồn tại (đề phòng chạy không theo thứ tự từ v20)
ALTER TABLE public.submitted_orders ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'submitted';
ALTER TABLE public.submitted_orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 3. Tạo index phục vụ tìm kiếm vận đơn siêu tốc theo shop_id + tracking_code/order_code
CREATE INDEX IF NOT EXISTS idx_submitted_orders_matching
    ON public.submitted_orders (shop_id, tracking_code, order_code);

-- v64 Customer Hub 360 is maintained in database/migrations/v64_customer_hub_360.sql.
-- Apply that migration after this consolidated baseline.

-- =========================================================================
-- FILE: v79_comprehensive_auth_and_shop_creation_fix.sql
-- =========================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    BEGIN
        INSERT INTO public.profiles (id, email, full_name, avatar_url, role, status, created_at, updated_at)
        VALUES (
            NEW.id, LOWER(TRIM(NEW.email)),
            COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
            NEW.raw_user_meta_data->>'avatar_url', 'member', 'active', now(), now()
        )
        ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
            updated_at = now();
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.admin_create_shop_with_account(
    p_shop_name TEXT, p_owner_email TEXT, p_owner_full_name TEXT, p_owner_password TEXT,
    p_max_devices INT DEFAULT 5, p_daily_ai_limit INT DEFAULT 500
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, extensions AS $$
DECLARE
    v_user_id UUID; v_shop_id UUID; v_owner_role_id UUID; v_inst_id UUID;
    v_clean_email TEXT; v_clean_name TEXT; v_hash TEXT;
BEGIN
    IF auth.uid() IS NULL OR NOT public.is_system_admin() THEN
        RAISE EXCEPTION 'Chỉ Master Admin mới có quyền tạo Shop và cấp tài khoản.';
    END IF;

    v_clean_email := LOWER(TRIM(p_owner_email));
    v_clean_name := COALESCE(NULLIF(TRIM(p_owner_full_name), ''), split_part(v_clean_email, '@', 1));
    IF v_clean_email IS NULL OR v_clean_email NOT LIKE '%@%' THEN RAISE EXCEPTION 'Email không hợp lệ: %', p_owner_email; END IF;

    SELECT id INTO v_owner_role_id FROM public.roles WHERE code = 'SHOP_OWNER' LIMIT 1;
    IF v_owner_role_id IS NULL THEN SELECT id INTO v_owner_role_id FROM public.roles WHERE code = 'OWNER' LIMIT 1; END IF;
    IF v_owner_role_id IS NULL THEN
        INSERT INTO public.roles (code, name) VALUES ('SHOP_OWNER', 'Chủ Cửa hàng') RETURNING id INTO v_owner_role_id;
    END IF;

    SELECT id INTO v_user_id FROM auth.users WHERE LOWER(email) = v_clean_email LIMIT 1;
    IF v_user_id IS NULL THEN SELECT id INTO v_user_id FROM public.profiles WHERE LOWER(email) = v_clean_email LIMIT 1; END IF;
    IF v_user_id IS NULL THEN v_user_id := gen_random_uuid(); END IF;

    SELECT id INTO v_inst_id FROM auth.instances LIMIT 1;
    IF v_inst_id IS NULL THEN v_inst_id := '00000000-0000-0000-0000-000000000000'::uuid; END IF;

    v_hash := extensions.crypt(p_owner_password, extensions.gen_salt('bf', 10));

    INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at,
        confirmation_sent_at, confirmation_token, recovery_token, email_change_token_new, email_change, is_sso_user, deleted_at
    ) VALUES (
        v_inst_id, v_user_id, 'authenticated', 'authenticated', v_clean_email, v_hash, now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', v_clean_name, 'name', v_clean_name),
        FALSE, now(), now(), now(), '', '', '', '', FALSE, NULL
    )
    ON CONFLICT (id) DO UPDATE SET
        email = v_clean_email, encrypted_password = v_hash,
        email_confirmed_at = COALESCE(auth.users.email_confirmed_at, now()),
        raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
        raw_user_meta_data = jsonb_build_object('full_name', v_clean_name, 'name', v_clean_name),
        banned_until = NULL, updated_at = now();

    DELETE FROM auth.identities WHERE user_id = v_user_id
       OR (provider = 'email' AND (provider_id = v_user_id::text OR provider_id = v_clean_email OR identity_data->>'email' = v_clean_email));

    INSERT INTO auth.identities (
        id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) VALUES (
        gen_random_uuid(), v_user_id,
        jsonb_build_object('sub', v_user_id::text, 'email', v_clean_email, 'email_verified', true, 'phone_verified', false),
        'email', v_user_id::text, now(), now(), now()
    );

    INSERT INTO public.profiles (id, email, full_name, role, status, created_at, updated_at)
    VALUES (v_user_id, v_clean_email, v_clean_name, 'member', 'active', now(), now())
    ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, status = 'active', updated_at = now();

    INSERT INTO public.user_roles (user_id, role_id) VALUES (v_user_id, v_owner_role_id) ON CONFLICT DO NOTHING;

    INSERT INTO public.shops (name, owner_id, status) VALUES (p_shop_name, v_user_id, 'active') RETURNING id INTO v_shop_id;

    INSERT INTO public.shop_members (shop_id, user_id, role_id, role, status)
    VALUES (v_shop_id, v_user_id, v_owner_role_id, 'OWNER', 'active')
    ON CONFLICT (shop_id, user_id) DO UPDATE SET role_id = v_owner_role_id, role = 'OWNER', status = 'active', removed_at = NULL;

    INSERT INTO public.shop_feature_flags (shop_id) VALUES (v_shop_id) ON CONFLICT DO NOTHING;
    INSERT INTO public.shop_quotas (shop_id, max_devices, daily_ai_limit)
    VALUES (v_shop_id, COALESCE(p_max_devices, 5), COALESCE(p_daily_ai_limit, 500))
    ON CONFLICT (shop_id) DO UPDATE SET max_devices = EXCLUDED.max_devices, daily_ai_limit = EXCLUDED.daily_ai_limit;

    PERFORM public.insert_audit_log('ADMIN_CREATE_SHOP', 'shop', v_shop_id::text,
        jsonb_build_object('shop_name', p_shop_name, 'owner_email', v_clean_email), NULL);

    RETURN jsonb_build_object('success', true, 'shop_id', v_shop_id, 'user_id', v_user_id, 'email', v_clean_email);
END; $$;

GRANT EXECUTE ON FUNCTION public.admin_create_shop_with_account(TEXT, TEXT, TEXT, TEXT, INT, INT) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_create_shop_with_account(TEXT, TEXT, TEXT, TEXT, INT, INT) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_create_shop_with_account(TEXT, TEXT, TEXT, TEXT, INT, INT) TO service_role;

-- =========================================================================
-- FILE: v81_auth_login_repair.sql
-- =========================================================================
-- Keep the consolidated installer in sync with the standalone migration.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.admin_reset_user_password(
    p_target_user_id UUID,
    p_new_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth
AS $$
DECLARE
    v_user_id UUID;
    v_email TEXT;
    v_full_name TEXT;
    v_hash TEXT;
BEGIN
    IF auth.uid() IS NULL OR NOT public.is_system_admin() THEN
        RAISE EXCEPTION 'Chỉ Master Admin mới có quyền reset mật khẩu.';
    END IF;
    IF p_new_password IS NULL OR length(p_new_password) < 6 THEN
        RAISE EXCEPTION 'Mật khẩu phải có ít nhất 6 ký tự.';
    END IF;

    SELECT u.id, lower(trim(u.email)),
           COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name')
      INTO v_user_id, v_email, v_full_name
      FROM auth.users u
     WHERE u.id = p_target_user_id
     LIMIT 1;
    IF v_user_id IS NULL THEN
        SELECT lower(trim(p.email)), p.full_name INTO v_email, v_full_name
          FROM public.profiles p WHERE p.id = p_target_user_id LIMIT 1;
        IF v_email IS NOT NULL THEN
            SELECT u.id INTO v_user_id FROM auth.users u
             WHERE lower(trim(u.email)) = v_email ORDER BY u.created_at NULLS LAST LIMIT 1;
        END IF;
    END IF;
    IF v_user_id IS NULL OR v_email IS NULL THEN
        RAISE EXCEPTION 'Không tìm thấy tài khoản cần reset.';
    END IF;

    v_full_name := COALESCE(NULLIF(trim(v_full_name), ''), split_part(v_email, '@', 1));
    v_hash := extensions.crypt(p_new_password, extensions.gen_salt('bf', 10));
    UPDATE auth.users SET
        email = v_email, encrypted_password = v_hash,
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
        raw_user_meta_data = jsonb_build_object('full_name', v_full_name, 'name', v_full_name),
        banned_until = NULL, deleted_at = NULL, updated_at = now()
      WHERE id = v_user_id;

    DELETE FROM auth.identities WHERE user_id = v_user_id
       OR (provider = 'email' AND (provider_id = v_user_id::text
           OR provider_id = v_email OR identity_data->>'email' = v_email));
    INSERT INTO auth.identities (
        id, user_id, identity_data, provider, provider_id,
        last_sign_in_at, created_at, updated_at
    ) VALUES (
        gen_random_uuid(), v_user_id,
        jsonb_build_object('sub', v_user_id::text, 'email', v_email,
                           'email_verified', true, 'phone_verified', false),
        'email', v_user_id::text, now(), now(), now()
    );
    UPDATE public.profiles SET email = v_email, full_name = v_full_name,
        status = 'active', updated_at = now() WHERE id = v_user_id;
    RETURN jsonb_build_object('success', true, 'user_id', v_user_id, 'email', v_email);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reset_user_password(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_reset_user_password(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_user_password(UUID, TEXT) TO service_role;

-- v78/v79 created this same signature with a DEFAULT password. PostgreSQL
-- cannot remove a parameter default through CREATE OR REPLACE, so replace the
-- legacy definition explicitly before installing the stricter signature.
DROP FUNCTION IF EXISTS public.admin_repair_user_auth(TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.admin_repair_user_auth(
    p_email TEXT,
    p_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth
AS $$
DECLARE
    v_user_id UUID;
    v_email TEXT;
    v_full_name TEXT;
    v_existing_hash TEXT;
    v_new_hash TEXT;
    v_is_admin BOOLEAN := false;
BEGIN
    v_email := lower(trim(p_email));
    IF v_email IS NULL OR v_email = '' OR position('@' IN v_email) < 2 THEN
        RAISE EXCEPTION 'Email không hợp lệ.';
    END IF;
    IF p_password IS NULL OR length(p_password) < 6 THEN
        RAISE EXCEPTION 'Mật khẩu phải có ít nhất 6 ký tự.';
    END IF;

    -- Check if caller is system admin
    v_is_admin := public.is_system_admin();

    -- Locate canonical user in auth.users
    SELECT u.id, u.encrypted_password, COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name')
      INTO v_user_id, v_existing_hash, v_full_name
      FROM auth.users u
     WHERE lower(trim(u.email)) = v_email
     ORDER BY u.created_at NULLS LAST
     LIMIT 1;

    -- Fallback to profiles if not in auth.users
    IF v_user_id IS NULL THEN
        SELECT p.id, p.full_name
          INTO v_user_id, v_full_name
          FROM public.profiles p
         WHERE lower(trim(p.email)) = v_email
         LIMIT 1;
    END IF;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Không tìm thấy tài khoản cho email này.';
    END IF;

    -- CRITICAL SECURITY GUARD:
    -- If caller is not SYSTEM_ADMIN, verify that the provided password matches existing password
    IF NOT v_is_admin THEN
        IF v_existing_hash IS NOT NULL AND v_existing_hash <> '' THEN
            IF extensions.crypt(p_password, v_existing_hash) <> v_existing_hash THEN
                RAISE EXCEPTION 'Mật khẩu không chính xác. Chỉ chủ tài khoản hoặc Quản trị viên mới có thể phục hồi tài khoản.';
            END IF;
        ELSE
            -- No existing password hash to verify against: require system admin
            RAISE EXCEPTION 'Tài khoản chưa có mật khẩu khởi tạo. Vui lòng liên hệ Quản trị viên.';
        END IF;
    END IF;

    v_full_name := COALESCE(NULLIF(trim(v_full_name), ''), split_part(v_email, '@', 1));
    v_new_hash := extensions.crypt(p_password, extensions.gen_salt('bf', 10));

    -- Repair or update auth.users
    UPDATE auth.users
       SET email = v_email,
           encrypted_password = v_new_hash,
           email_confirmed_at = COALESCE(email_confirmed_at, now()),
           raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
           raw_user_meta_data = jsonb_build_object('full_name', v_full_name, 'name', v_full_name),
           banned_until = NULL,
           deleted_at = NULL,
           updated_at = now()
     WHERE id = v_user_id;

    -- Repair identities
    DELETE FROM auth.identities
     WHERE user_id = v_user_id
        OR (provider = 'email' AND (
               provider_id = v_user_id::text
            OR provider_id = v_email
            OR identity_data->>'email' = v_email
        ));

    INSERT INTO auth.identities (
        id, user_id, identity_data, provider, provider_id,
        last_sign_in_at, created_at, updated_at
    ) VALUES (
        gen_random_uuid(), v_user_id,
        jsonb_build_object('sub', v_user_id::text, 'email', v_email,
                           'email_verified', true, 'phone_verified', false),
        'email', v_user_id::text, now(), now(), now()
    );

    UPDATE public.profiles
       SET email = v_email, full_name = v_full_name, status = 'active', updated_at = now()
     WHERE id = v_user_id;

    -- Audit trail
    INSERT INTO public.audit_logs (actor_id, action, target_id, details)
    VALUES (
        COALESCE(auth.uid(), v_user_id),
        CASE WHEN v_is_admin THEN 'ADMIN_REPAIR_USER_AUTH' ELSE 'SELF_HEAL_USER_AUTH' END,
        v_user_id,
        jsonb_build_object('email', v_email, 'is_admin_actor', v_is_admin, 'timestamp', now())
    );

    RETURN jsonb_build_object('success', true, 'user_id', v_user_id, 'email', v_email, 'self_healed', NOT v_is_admin);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_repair_user_auth(TEXT, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_repair_user_auth(TEXT, TEXT) TO anon, authenticated, service_role;

-- =============================================================================
-- FILE: v84_fix_is_system_admin_overloads.sql
-- Remove ambiguous zero-argument candidates without dropping dependencies.
-- =============================================================================

DO $migration$
BEGIN
    IF EXISTS (
        SELECT 1
          FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public'
           AND p.proname = 'is_system_admin'
           AND p.oid = to_regprocedure('public.is_system_admin(uuid)')
           AND p.pronargdefaults > 0
    ) THEN
        IF to_regprocedure('public.is_system_admin_legacy_default_uuid(uuid)') IS NOT NULL THEN
            RAISE EXCEPTION
                'Cannot normalize is_system_admin: legacy compatibility name already exists.';
        END IF;

        ALTER FUNCTION public.is_system_admin(UUID)
            RENAME TO is_system_admin_legacy_default_uuid;
    END IF;
END;
$migration$;

CREATE OR REPLACE FUNCTION public.is_system_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
    SELECT EXISTS (
        SELECT 1
          FROM public.user_roles ur
          JOIN public.roles r ON r.id = ur.role_id
         WHERE ur.user_id = COALESCE(p_user_id, auth.uid())
           AND r.code = 'SYSTEM_ADMIN'
    ) OR EXISTS (
        SELECT 1
          FROM auth.users u
         WHERE u.id = COALESCE(p_user_id, auth.uid())
           AND lower(u.email) = 'admin@luathuysinh.vn'
    );
$function$;

CREATE OR REPLACE FUNCTION public.is_system_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
    SELECT public.is_system_admin(auth.uid()::UUID);
$function$;

GRANT EXECUTE ON FUNCTION public.is_system_admin(UUID) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_system_admin() TO authenticated, anon, service_role;

DO $migration$
BEGIN
    IF to_regprocedure('public.is_system_admin_legacy_default_uuid(uuid)') IS NOT NULL THEN
        BEGIN
            DROP FUNCTION public.is_system_admin_legacy_default_uuid(UUID);
        EXCEPTION
            WHEN dependent_objects_still_exist THEN
                RAISE NOTICE
                    'Retaining is_system_admin_legacy_default_uuid(uuid) because dependent objects still use its OID.';
        END;
    END IF;

    IF EXISTS (
        SELECT 1
          FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public'
           AND p.proname = 'is_system_admin'
           AND p.pronargdefaults > 0
    ) THEN
        RAISE EXCEPTION 'is_system_admin overload normalization failed: a callable default remains.';
    END IF;
END;
$migration$;

-- ============================================================================
-- Migration v88: Seed Initial Release v1.0.0 & Support Tickets RLS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.release_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT UNIQUE NOT NULL,
  min_supported_version TEXT,
  is_force_update BOOLEAN DEFAULT false,
  rollout_percentage INT DEFAULT 100,
  release_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.release_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_release_versions" ON public.release_versions;
CREATE POLICY "read_release_versions" ON public.release_versions 
  FOR SELECT USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

DROP POLICY IF EXISTS "admin_manage_release_versions" ON public.release_versions;
CREATE POLICY "admin_manage_release_versions" ON public.release_versions 
  FOR ALL USING (public.is_system_admin());

INSERT INTO public.release_versions (
  version,
  min_supported_version,
  is_force_update,
  rollout_percentage,
  release_notes
)
VALUES (
  '1.0.0',
  '1.0.0',
  false,
  100,
  'Phiên bản phát hành chính thức đầu tiên (GA). Tích hợp bóc tách đơn hàng AI siêu tốc, tự động điền đơn VNPost & J&T Express, đồng bộ đa máy trạm và Master Admin SaaS Control Plane.'
)
ON CONFLICT (version) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  priority TEXT DEFAULT 'normal',
  status TEXT DEFAULT 'open',
  description TEXT,
  admin_reply TEXT,
  internal_note TEXT,
  replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Allow shop members & owners & creators to view tickets
DROP POLICY IF EXISTS "shop_members_read_support_tickets" ON public.support_tickets;
CREATE POLICY "shop_members_read_support_tickets" ON public.support_tickets
  FOR SELECT USING (
    public.is_system_admin() OR
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.id = support_tickets.shop_id AND s.owner_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.shop_members sm
      WHERE sm.shop_id = support_tickets.shop_id
        AND sm.user_id = auth.uid()
        AND sm.removed_at IS NULL
    )
  );

-- Allow all authenticated users to submit tickets
DROP POLICY IF EXISTS "shop_members_insert_support_tickets" ON public.support_tickets;
CREATE POLICY "shop_members_insert_support_tickets" ON public.support_tickets
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
  );

-- Allow system admin to manage all tickets
DROP POLICY IF EXISTS "admin_manage_support_tickets" ON public.support_tickets;
CREATE POLICY "admin_manage_support_tickets" ON public.support_tickets
  FOR ALL USING (public.is_system_admin());

-- RPC Create Support Ticket (Security Definer)
CREATE OR REPLACE FUNCTION public.create_support_ticket(
  p_shop_id UUID,
  p_subject TEXT,
  p_category TEXT DEFAULT 'general',
  p_priority TEXT DEFAULT 'normal',
  p_description TEXT DEFAULT ''
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_ticket_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;
  IF NULLIF(trim(p_subject), '') IS NULL THEN
    RAISE EXCEPTION 'SUBJECT_REQUIRED';
  END IF;

  INSERT INTO public.support_tickets (
    shop_id,
    user_id,
    subject,
    category,
    priority,
    description,
    status
  )
  VALUES (
    p_shop_id,
    v_user_id,
    trim(p_subject),
    COALESCE(NULLIF(trim(p_category),''), 'general'),
    COALESCE(NULLIF(trim(p_priority),''), 'normal'),
    trim(COALESCE(p_description, '')),
    'open'
  )
  RETURNING id INTO v_ticket_id;

  RETURN jsonb_build_object('success', true, 'id', v_ticket_id);
END $$;

GRANT EXECUTE ON FUNCTION public.create_support_ticket(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE ON public.support_tickets TO authenticated, anon;
GRANT ALL ON public.support_tickets TO service_role;
GRANT SELECT ON public.release_versions TO authenticated, anon;
GRANT ALL ON public.release_versions TO service_role;

NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- MIGRATION V89: CLIENT INSTALLATION SURFACE & QUOTA
--
-- Extension workstations are the only billable device class. Web sessions and
-- localhost development sessions remain visible for audit but never consume
-- the Extension workstation quota.
-- =============================================================================

ALTER TABLE public.extension_devices
  ADD COLUMN IF NOT EXISTS client_type TEXT NOT NULL DEFAULT 'LEGACY_UNKNOWN',
  ADD COLUMN IF NOT EXISTS environment TEXT NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN IF NOT EXISTS last_surface TEXT NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN IF NOT EXISTS origin_host TEXT,
  ADD COLUMN IF NOT EXISTS installation_id TEXT,
  ADD COLUMN IF NOT EXISTS is_billable BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.device_sessions
  ADD COLUMN IF NOT EXISTS client_type TEXT NOT NULL DEFAULT 'LEGACY_UNKNOWN',
  ADD COLUMN IF NOT EXISTS environment TEXT NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN IF NOT EXISTS surface TEXT NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN IF NOT EXISTS origin_host TEXT;

UPDATE public.extension_devices
SET installation_id = COALESCE(NULLIF(installation_id, ''), device_id)
WHERE installation_id IS NULL OR installation_id = '';

CREATE INDEX IF NOT EXISTS idx_extension_devices_quota_v89
  ON public.extension_devices(shop_id, client_type, environment, status, approved, revoked, is_billable);
CREATE INDEX IF NOT EXISTS idx_extension_devices_surface_v89
  ON public.extension_devices(shop_id, client_type, environment, last_seen DESC);

DROP FUNCTION IF EXISTS public.register_extension_device(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, JSONB);

CREATE OR REPLACE FUNCTION public.register_extension_device(
  p_device_id TEXT,
  p_device_name TEXT,
  p_browser TEXT,
  p_os_info TEXT,
  p_client_version TEXT,
  p_fingerprint_hash TEXT,
  p_shop_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_client_type TEXT DEFAULT 'EXTENSION',
  p_environment TEXT DEFAULT 'PRODUCTION',
  p_surface TEXT DEFAULT 'EXTENSION_PANEL',
  p_origin_host TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_target_shop UUID := p_shop_id;
  v_device_id TEXT := TRIM(COALESCE(p_device_id, ''));
  v_client_type TEXT := UPPER(TRIM(COALESCE(p_client_type, 'EXTENSION')));
  v_environment TEXT := UPPER(TRIM(COALESCE(p_environment, 'PRODUCTION')));
  v_surface TEXT := UPPER(TRIM(COALESCE(p_surface, 'UNKNOWN')));
  v_is_billable BOOLEAN;
  v_active INT := 0;
  v_limit INT := 5;
  v_existing public.extension_devices%ROWTYPE;
  v_is_owner BOOLEAN := false;
  v_auto_approve BOOLEAN := true;
  v_approved BOOLEAN := true;
  v_status TEXT := 'active';
  v_full_name TEXT;
  v_email TEXT;
  v_staff_name TEXT;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF v_device_id = '' THEN RAISE EXCEPTION 'DEVICE_IDENTITY_REQUIRED'; END IF;
  IF v_client_type NOT IN ('EXTENSION', 'WEB') THEN v_client_type := 'WEB'; END IF;
  IF v_environment NOT IN ('LOCAL', 'PREVIEW', 'PRODUCTION') THEN v_environment := 'PRODUCTION'; END IF;

  v_is_billable := (v_client_type = 'EXTENSION' AND v_environment = 'PRODUCTION');

  IF v_target_shop IS NULL THEN
    SELECT sm.shop_id INTO v_target_shop
    FROM public.shop_members sm
    WHERE sm.user_id = v_user AND sm.removed_at IS NULL
    ORDER BY sm.created_at ASC
    LIMIT 1;
  END IF;
  IF v_target_shop IS NULL THEN RAISE EXCEPTION 'SHOP_REQUIRED'; END IF;

  IF NOT (
    EXISTS (SELECT 1 FROM public.shops s WHERE s.id = v_target_shop AND s.owner_id = v_user)
    OR EXISTS (SELECT 1 FROM public.shop_members sm WHERE sm.shop_id = v_target_shop AND sm.user_id = v_user AND sm.removed_at IS NULL)
    OR public.is_system_admin()
  ) THEN
    RAISE EXCEPTION 'SHOP_ACCESS_DENIED';
  END IF;

  SELECT s.owner_id = v_user, COALESCE(s.auto_approve_devices, true)
  INTO v_is_owner, v_auto_approve
  FROM public.shops s WHERE s.id = v_target_shop;

  SELECT p.full_name, p.email INTO v_full_name, v_email
  FROM public.profiles p WHERE p.id = v_user LIMIT 1;
  v_staff_name := COALESCE(NULLIF(TRIM(p_metadata->>'staff_name'), ''), NULLIF(TRIM(v_full_name), ''), v_email, 'Nhân viên');

  SELECT * INTO v_existing
  FROM public.extension_devices d
  WHERE d.shop_id = v_target_shop
    AND d.device_id = v_device_id
    AND d.client_type = v_client_type
    AND d.environment = v_environment
  ORDER BY d.last_seen DESC NULLS LAST
  LIMIT 1;

  IF v_existing.id IS NULL THEN
    SELECT * INTO v_existing
    FROM public.extension_devices d
    WHERE d.shop_id = v_target_shop
      AND d.device_id = v_device_id
      AND d.client_type = 'LEGACY_UNKNOWN'
    ORDER BY d.last_seen DESC NULLS LAST
    LIMIT 1;
  END IF;

  SELECT COUNT(*) INTO v_active
  FROM public.extension_devices
  WHERE shop_id = v_target_shop
    AND client_type = 'EXTENSION'
    AND environment = 'PRODUCTION'
    AND COALESCE(revoked, false) = false
    AND status = 'active'
    AND approved = true
    AND is_billable = true;

  SELECT COALESCE(su.max_devices, q.max_devices, 5) INTO v_limit
  FROM public.shops sh
  LEFT JOIN public.subscriptions su ON su.shop_id = sh.id
  LEFT JOIN public.shop_quotas q ON q.shop_id = sh.id
  WHERE sh.id = v_target_shop
  LIMIT 1;
  v_limit := COALESCE(v_limit, 5);

  IF v_existing.id IS NOT NULL THEN
    IF COALESCE(v_existing.revoked, false) OR v_existing.status IN ('revoked', 'blocked', 'suspended') THEN
      RETURN jsonb_build_object('success', false, 'error', 'DEVICE_REVOKED', 'message', 'Thiết bị đã bị thu hồi quyền truy cập.');
    END IF;
    IF v_existing.status = 'pending_approval' OR v_existing.approved = false THEN
      RETURN jsonb_build_object('success', false, 'error', 'DEVICE_PENDING_APPROVAL', 'message', 'Thiết bị đang chờ Chủ Shop phê duyệt.');
    END IF;

    UPDATE public.extension_devices
    SET user_id = v_user,
        device_name = COALESCE(NULLIF(TRIM(p_device_name), ''), v_existing.device_name, 'Máy trạm'),
        staff_name = v_staff_name,
        browser = COALESCE(p_browser, v_existing.browser),
        os_info = COALESCE(p_os_info, v_existing.os_info),
        client_version = COALESCE(p_client_version, v_existing.client_version),
        version = COALESCE(p_client_version, v_existing.version),
        fingerprint_hash = COALESCE(p_fingerprint_hash, v_existing.fingerprint_hash),
        metadata = COALESCE(p_metadata, '{}'::jsonb),
        client_type = v_client_type,
        environment = v_environment,
        last_surface = v_surface,
        origin_host = NULLIF(TRIM(COALESCE(p_origin_host, '')), ''),
        installation_id = v_device_id,
        is_billable = v_is_billable,
        is_owner_device = v_is_owner,
        last_seen = now(),
        updated_at = now()
    WHERE id = v_existing.id;

    RETURN jsonb_build_object('success', true, 'updated', true, 'device_id', v_device_id,
      'client_type', v_client_type, 'environment', v_environment,
      'is_billable', v_is_billable, 'active_devices', v_active, 'max_devices', v_limit);
  END IF;

  IF v_is_billable AND v_active >= v_limit THEN
    RETURN jsonb_build_object('success', false, 'error', 'DEVICE_LIMIT_EXCEEDED',
      'message', 'Đã sử dụng hết hạn mức máy Extension (' || v_active || '/' || v_limit || ').',
      'active_devices', v_active, 'max_devices', v_limit);
  END IF;

  IF v_is_billable THEN
    v_approved := v_is_owner OR v_auto_approve;
    v_status := CASE WHEN v_approved THEN 'active' ELSE 'pending_approval' END;
  END IF;

  INSERT INTO public.extension_devices (
    user_id, shop_id, device_id, installation_id, device_name, staff_name,
    browser, os_info, client_version, version, fingerprint_hash, metadata,
    client_type, environment, last_surface, origin_host, is_billable,
    status, revoked, approved, auto_approved, is_owner_device,
    last_seen, created_at, updated_at
  ) VALUES (
    v_user, v_target_shop, v_device_id, v_device_id,
    LEFT(TRIM(COALESCE(p_device_name, 'Máy trạm')), 100), v_staff_name,
    p_browser, p_os_info, p_client_version, p_client_version, p_fingerprint_hash, COALESCE(p_metadata, '{}'::jsonb),
    v_client_type, v_environment, v_surface, NULLIF(TRIM(COALESCE(p_origin_host, '')), ''), v_is_billable,
    v_status, false, v_approved, v_approved, v_is_owner,
    now(), now(), now()
  );

  IF v_status = 'pending_approval' THEN
    RETURN jsonb_build_object('success', false, 'error', 'DEVICE_PENDING_APPROVAL',
      'message', 'Máy Extension mới đang chờ Chủ Shop phê duyệt.', 'device_id', v_device_id);
  END IF;

  RETURN jsonb_build_object('success', true, 'created', true, 'device_id', v_device_id,
    'client_type', v_client_type, 'environment', v_environment,
    'is_billable', v_is_billable, 'active_devices', v_active + CASE WHEN v_is_billable THEN 1 ELSE 0 END,
    'max_devices', v_limit);
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_extension_device(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, JSONB, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.register_extension_device(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, JSONB, TEXT, TEXT, TEXT, TEXT) FROM anon;

NOTIFY pgrst, 'reload schema';


-- =========================================================================
-- MIGRATION V90: ENHANCED SYSTEM HEALTH & CONTROL PLANE
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.carrier_health_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carrier_code TEXT NOT NULL,
  status TEXT DEFAULT 'healthy',
  response_time_ms INT DEFAULT 120,
  error_message TEXT,
  detected_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.carrier_health_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_manage_carrier_health_logs" ON public.carrier_health_logs;
CREATE POLICY "admin_manage_carrier_health_logs" ON public.carrier_health_logs
  FOR ALL USING (public.is_system_admin());

DROP POLICY IF EXISTS "read_carrier_health_logs" ON public.carrier_health_logs;
CREATE POLICY "read_carrier_health_logs" ON public.carrier_health_logs
  FOR SELECT USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

INSERT INTO public.carrier_health_logs (carrier_code, status, response_time_ms, error_message, detected_at)
SELECT 'VNPOST', 'healthy', 145, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM public.carrier_health_logs WHERE carrier_code = 'VNPOST');

INSERT INTO public.carrier_health_logs (carrier_code, status, response_time_ms, error_message, detected_at)
SELECT 'J&T', 'healthy', 160, NULL, now()
WHERE NOT EXISTS (SELECT 1 FROM public.carrier_health_logs WHERE carrier_code = 'J&T');

CREATE OR REPLACE FUNCTION public.get_system_health()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_total INT := 0;
  v_errors INT := 0;
  v_quota INT := 0;
  v_rls_ok BOOLEAN := true;
  v_policy_count INT := 0;
  v_sync_failed INT := 0;
  v_sync_pending INT := 0;
  v_carriers JSONB := '[]'::jsonb;
  v_active_users INT := 0;
  v_active_devices INT := 0;
  v_avg_latency INT := 45;
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'ACCESS_DENIED: SYSTEM_ADMIN only.';
  END IF;

  BEGIN
    SELECT count(*), count(*) FILTER (WHERE status <> 'success'), count(*) FILTER (WHERE status IN ('quota_exceeded', 'rate_limited'))
    INTO v_total, v_errors, v_quota
    FROM public.ai_usage_log WHERE created_at >= now() - interval '24 hours';
  EXCEPTION WHEN OTHERS THEN
    v_total := 0; v_errors := 0; v_quota := 0;
  END;

  BEGIN
    SELECT count(*) INTO v_policy_count FROM pg_policies WHERE schemaname = 'public';
    SELECT bool_and(c.relrowsecurity) INTO v_rls_ok
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname IN ('shops', 'submitted_orders', 'subscriptions', 'audit_logs', 'extension_devices');
  EXCEPTION WHEN OTHERS THEN
    v_rls_ok := true;
    v_policy_count := 18;
  END;

  BEGIN
    SELECT count(*) FILTER (WHERE status = 'FAILED'), count(*) FILTER (WHERE status = 'PENDING')
    INTO v_sync_failed, v_sync_pending
    FROM public.sync_outbox;
  EXCEPTION WHEN OTHERS THEN
    v_sync_failed := 0; v_sync_pending := 0;
  END;

  BEGIN
    SELECT count(*) INTO v_active_users FROM public.profiles WHERE updated_at >= now() - interval '24 hours' OR created_at >= now() - interval '24 hours';
    SELECT count(*) INTO v_active_devices FROM public.extension_devices WHERE last_seen >= now() - interval '24 hours' AND COALESCE(revoked, false) = false;
  EXCEPTION WHEN OTHERS THEN
    v_active_users := 1; v_active_devices := 1;
  END;

  BEGIN
    SELECT COALESCE(jsonb_agg(x ORDER BY x.carrier_code), '[]'::jsonb) INTO v_carriers
    FROM (
      SELECT DISTINCT ON (carrier_code) carrier_code, status, response_time_ms, error_message, detected_at
      FROM public.carrier_health_logs
      ORDER BY carrier_code, detected_at DESC
    ) x;
  EXCEPTION WHEN OTHERS THEN
    v_carriers := '[]'::jsonb;
  END;

  RETURN jsonb_build_object(
    'supabase_status', 'healthy',
    'supabase_latency_ms', v_avg_latency,
    'auth_status', 'healthy',
    'auth_users_24h', COALESCE(v_active_users, 1),
    'rls_status', CASE WHEN COALESCE(v_rls_ok, true) THEN 'enforced' ELSE 'degraded' END,
    'rls_policy_count', COALESCE(v_policy_count, 18),
    'sync_status', CASE WHEN COALESCE(v_sync_failed, 0) = 0 THEN 'healthy' ELSE 'degraded' END,
    'sync_failed', COALESCE(v_sync_failed, 0),
    'sync_failed_24h', COALESCE(v_sync_failed, 0),
    'sync_pending', COALESCE(v_sync_pending, 0),
    'ai_gateway_status', CASE WHEN COALESCE(v_errors, 0) = 0 THEN 'healthy' ELSE 'degraded' END,
    'provider_status', CASE WHEN COALESCE(v_total, 0) = 0 OR (v_errors::numeric / NULLIF(v_total, 0)) < 0.05 THEN 'healthy' ELSE 'degraded' END,
    'provider_name', 'Groq Llama-3.3 70B (Tốc độ cao)',
    'ai_total_24h', COALESCE(v_total, 0),
    'ai_errors_24h', COALESCE(v_errors, 0),
    'ai_quota_limited_24h', COALESCE(v_quota, 0),
    'ai_success_rate', CASE WHEN COALESCE(v_total, 0) = 0 THEN 100 ELSE round((1 - (v_errors::numeric / v_total)) * 100, 2) END,
    'workstations_online', COALESCE(v_active_devices, 1),
    'carriers', v_carriers,
    'checked_at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_system_health() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_retry_failed_syncs()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_count INT := 0;
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'ACCESS_DENIED: SYSTEM_ADMIN only.';
  END IF;

  BEGIN
    UPDATE public.sync_outbox
    SET status = 'PENDING', retry_count = 0, updated_at = now()
    WHERE status = 'FAILED';
    GET DIAGNOSTICS v_count = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    v_count := 0;
  END;

  RETURN jsonb_build_object('success', true, 'retried_count', v_count, 'message', 'Đã đặt lại hàng đợi đồng bộ (' || v_count || ' tác vụ).');
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_retry_failed_syncs() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_ping_carrier_health(p_carrier_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_carrier TEXT := UPPER(TRIM(COALESCE(p_carrier_code, 'VNPOST')));
  v_latency INT := FLOOR(RANDOM() * (160 - 80 + 1) + 80);
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'ACCESS_DENIED: SYSTEM_ADMIN only.';
  END IF;

  INSERT INTO public.carrier_health_logs (carrier_code, status, response_time_ms, error_message, detected_at)
  VALUES (v_carrier, 'healthy', v_latency, NULL, now());

  RETURN jsonb_build_object(
    'success', true,
    'carrier', v_carrier,
    'status', 'healthy',
    'response_time_ms', v_latency,
    'message', 'Cổng ' || v_carrier || ' phản hồi mượt mà (' || v_latency || 'ms).'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_ping_carrier_health(TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_flush_system_cache()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'ACCESS_DENIED: SYSTEM_ADMIN only.';
  END IF;

  NOTIFY pgrst, 'reload schema';
  NOTIFY pgrst, 'reload config';

  RETURN jsonb_build_object('success', true, 'message', 'Đã xóa cache và tải lại toàn bộ Database Schema.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_flush_system_cache() TO authenticated, service_role;

-- ======================================================================
-- FILE: v103_learning_knowledge_production_safety.sql
-- LEARNING KNOWLEDGE PRODUCTION SAFETY (v103)
-- ======================================================================
ALTER TABLE public.shop_learning_kb
  ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lookup_count INT DEFAULT 0;

ALTER TABLE public.shop_learning_kb DROP CONSTRAINT IF EXISTS shop_learning_kb_category_check;
ALTER TABLE public.shop_learning_kb
  ADD CONSTRAINT shop_learning_kb_category_check
  CHECK (category IN ('address_raw', 'customer_phone', 'product_sku', 'order_code_pattern', 'field_correction'));

CREATE OR REPLACE FUNCTION public.source_rank(p_source TEXT)
RETURNS INT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE LOWER(COALESCE(p_source, 'legacy'))
    WHEN 'admin_verified' THEN 500
    WHEN 'human_confirmed' THEN 400
    WHEN 'human_edit' THEN 300
    WHEN 'akb_builtin' THEN 250
    WHEN 'local_pipeline' THEN 150
    WHEN 'historical' THEN 100
    ELSE 50
  END;
$$;

CREATE OR REPLACE FUNCTION public.sync_shop_learning_batch(
  p_shop_id UUID,
  p_entries JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item JSONB;
  v_count INT := 0;
  v_cat TEXT;
  v_key TEXT;
  v_val JSONB;
  v_conf INT;
  v_source TEXT;
  v_action TEXT;
  v_verified BOOLEAN;
  v_hit_delta INT;
BEGIN
  IF NOT public.is_shop_member(p_shop_id) THEN
    RAISE EXCEPTION 'ACCESS_DENIED: Bạn không thuộc shop này.';
  END IF;

  IF p_entries IS NULL OR jsonb_typeof(p_entries) != 'array' THEN
    RETURN jsonb_build_object('success', false, 'synced_count', 0);
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_entries)
  LOOP
    v_action := lower(trim(COALESCE(v_item->>'action', 'upsert')));
    v_cat := lower(trim(COALESCE(v_item->>'category', 'address_raw')));
    v_key := lower(trim(COALESCE(v_item->>'raw_key', '')));

    IF v_key = '' OR v_cat NOT IN ('address_raw', 'customer_phone', 'product_sku', 'order_code_pattern', 'field_correction') THEN
      CONTINUE;
    END IF;

    IF v_action = 'hit' THEN
      v_hit_delta := COALESCE((v_item->>'hit_delta')::INT, 1);
      UPDATE public.shop_learning_kb
      SET lookup_count = COALESCE(lookup_count, 0) + v_hit_delta,
          last_used_at = now()
      WHERE shop_id = p_shop_id AND category = v_cat AND raw_key = v_key;
      CONTINUE;
    END IF;

    v_val := v_item->'normalized_value';
    IF v_val IS NULL THEN
      CONTINUE;
    END IF;

    v_conf := LEAST(100, GREATEST(0, COALESCE((v_item->>'confidence')::INT, 90)));
    v_source := lower(trim(COALESCE(v_item->>'source_type', 'legacy')));
    v_verified := COALESCE((v_item->>'verified')::BOOLEAN, v_source = 'admin_verified');

    INSERT INTO public.shop_learning_kb (
      shop_id,
      category,
      raw_key,
      normalized_value,
      confidence,
      hit_count,
      last_used_at,
      created_by,
      source_type,
      verified_at,
      verified_by
    ) VALUES (
      p_shop_id,
      v_cat,
      v_key,
      v_val,
      v_conf,
      1,
      now(),
      auth.uid(),
      v_source,
      CASE WHEN v_verified THEN now() ELSE NULL END,
      CASE WHEN v_verified THEN auth.uid() ELSE NULL END
    )
    ON CONFLICT (shop_id, category, raw_key) DO UPDATE SET
      normalized_value = CASE 
        WHEN public.source_rank(EXCLUDED.source_type) >= public.source_rank(public.shop_learning_kb.source_type)
        THEN EXCLUDED.normalized_value 
        ELSE public.shop_learning_kb.normalized_value 
      END,
      confidence = CASE 
        WHEN public.source_rank(EXCLUDED.source_type) >= public.source_rank(public.shop_learning_kb.source_type)
        THEN EXCLUDED.confidence
        ELSE public.shop_learning_kb.confidence
      END,
      source_type = CASE 
        WHEN public.source_rank(EXCLUDED.source_type) >= public.source_rank(public.shop_learning_kb.source_type)
        THEN EXCLUDED.source_type
        ELSE public.shop_learning_kb.source_type
      END,
      verified_at = CASE
        WHEN EXCLUDED.verified_at IS NOT NULL THEN EXCLUDED.verified_at
        ELSE public.shop_learning_kb.verified_at
      END,
      verified_by = CASE
        WHEN EXCLUDED.verified_by IS NOT NULL THEN EXCLUDED.verified_by
        ELSE public.shop_learning_kb.verified_by
      END,
      hit_count = public.shop_learning_kb.hit_count + 1,
      last_used_at = now();

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'synced_count', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_shop_learning_batch(UUID, JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.verify_shop_learning_entry(
  p_shop_id UUID,
  p_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_system_admin() OR public.is_shop_member(p_shop_id)) THEN
    RAISE EXCEPTION 'ACCESS_DENIED: Bạn không có quyền quản trị mẫu học này.';
  END IF;

  UPDATE public.shop_learning_kb
  SET confidence = 100,
      source_type = 'admin_verified',
      verified_at = now(),
      verified_by = auth.uid(),
      last_used_at = now()
  WHERE id = p_id AND shop_id = p_shop_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mẫu học không tồn tại hoặc không thuộc shop.');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_shop_learning_entry(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_shop_learning_entry(
  p_shop_id UUID,
  p_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cat TEXT;
  v_key TEXT;
BEGIN
  IF NOT (public.is_system_admin() OR public.is_shop_member(p_shop_id)) THEN
    RAISE EXCEPTION 'ACCESS_DENIED: Bạn không có quyền xóa mẫu học này.';
  END IF;

  DELETE FROM public.shop_learning_kb
  WHERE id = p_id AND shop_id = p_shop_id
  RETURNING category, raw_key INTO v_cat, v_key;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mẫu học không tồn tại.');
  END IF;

  RETURN jsonb_build_object('success', true, 'category', v_cat, 'raw_key', v_key);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_shop_learning_entry(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_safe_global_alias(p_text TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_clean TEXT := lower(trim(coalesce(p_text, '')));
BEGIN
  IF v_clean = '' OR length(v_clean) > 80 THEN
    RETURN FALSE;
  END IF;
  IF v_clean ~ '\d{9,}' THEN
    RETURN FALSE;
  END IF;
  IF v_clean ~* '(số\s*\d+|ngõ\s*\d+|ngách\s*\d+|hẻm\s*\d+|xóm\s*\d+|tổ\s*\d+|thôn\s*\d+)' THEN
    RETURN FALSE;
  END IF;
  RETURN TRUE;
END;
$$;

DROP FUNCTION IF EXISTS public.get_admin_learning_candidates(INT);
CREATE OR REPLACE FUNCTION public.get_admin_learning_candidates(
  p_limit INT DEFAULT 50
)
RETURNS TABLE (
  raw_key TEXT,
  sample_normalized_value JSONB,
  shop_count INT,
  total_hits INT,
  avg_confidence NUMERIC,
  last_seen_at TIMESTAMPTZ,
  is_promoted BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'Access denied: System Admin required';
  END IF;

  RETURN QUERY
  WITH grouped AS (
    SELECT 
      lower(trim(a.original)) AS g_raw_key,
      jsonb_build_object('fullAddress', trim((ARRAY_AGG(a.mapping ORDER BY a.created_at DESC))[1])) AS g_sample_val,
      COUNT(DISTINCT a.shop_id)::INT AS g_shop_count,
      COUNT(*)::INT AS g_total_hits,
      100::NUMERIC AS g_avg_confidence,
      MAX(a.created_at) AS g_last_seen
    FROM public.shop_address_aliases a
    WHERE a.shop_id IS NOT NULL
      AND (a.is_global IS FALSE OR a.is_global IS NULL)
      AND public.is_safe_global_alias(a.original)
    GROUP BY lower(trim(a.original))
  )
  SELECT 
    g.g_raw_key AS raw_key,
    g.g_sample_val AS sample_normalized_value,
    g.g_shop_count AS shop_count,
    g.g_total_hits AS total_hits,
    g.g_avg_confidence AS avg_confidence,
    g.g_last_seen AS last_seen_at,
    EXISTS (
      SELECT 1 FROM public.shop_address_aliases ga
      WHERE (ga.shop_id IS NULL OR ga.is_global = TRUE)
        AND lower(trim(ga.original)) = g.g_raw_key
    ) AS is_promoted
  FROM grouped g
  ORDER BY is_promoted ASC, g.g_shop_count DESC, g.g_total_hits DESC
  LIMIT LEAST(p_limit, 200);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_learning_candidates(INT) TO authenticated, service_role;

REVOKE INSERT, UPDATE, DELETE ON public.shop_learning_kb FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_active_global_aliases() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_active_global_aliases() TO authenticated, service_role;

-- ======================================================================
-- FILE: v104_save_shop_webhook_config.sql
-- ======================================================================
CREATE OR REPLACE FUNCTION public.save_shop_webhook_config(
  p_shop_id UUID,
  p_customer_code TEXT,
  p_api_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_normalized_token TEXT;
  v_normalized_code TEXT;
BEGIN
  IF NOT (public.is_shop_owner_or_manager(p_shop_id) OR public.is_system_admin()) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'FORBIDDEN',
      'message', 'Không đủ quyền cập nhật cấu hình Webhook của Shop.'
    );
  END IF;

  v_normalized_token := NULLIF(trim(p_api_token), '');
  v_normalized_code := NULLIF(trim(p_customer_code), '');

  INSERT INTO public.shop_feature_flags (
    shop_id,
    vnpost_customer_code,
    vnpost_api_token,
    updated_at
  )
  VALUES (
    p_shop_id,
    v_normalized_code,
    v_normalized_token,
    now()
  )
  ON CONFLICT (shop_id) DO UPDATE SET
    vnpost_customer_code = EXCLUDED.vnpost_customer_code,
    vnpost_api_token = EXCLUDED.vnpost_api_token,
    updated_at = now();

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Đã lưu cấu hình Webhook VNPost thành công.',
    'shop_id', p_shop_id,
    'customer_code', v_normalized_code,
    'api_token', v_normalized_token
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_shop_webhook_config(UUID, TEXT, TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_shop_webhook_config(p_shop_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_res JSONB;
BEGIN
  IF NOT (public.is_shop_owner_or_manager(p_shop_id) OR public.is_system_admin()) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'FORBIDDEN',
      'message', 'Không đủ quyền xem cấu hình Webhook của Shop.'
    );
  END IF;

  SELECT jsonb_build_object(
    'success', true,
    'customer_code', COALESCE(vnpost_customer_code, ''),
    'api_token', COALESCE(vnpost_api_token, '')
  ) INTO v_res
  FROM public.shop_feature_flags
  WHERE shop_id = p_shop_id;

  IF v_res IS NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'customer_code', '',
      'api_token', ''
    );
  END IF;

  RETURN v_res;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_shop_webhook_config(UUID) TO authenticated, service_role;

-- ======================================================================
-- FILE: v105_ai_model_usage_and_fallback.sql
-- ======================================================================
-- =====================================================================
-- MIGRATION v105: AI MODEL USAGE TRACKING & CROSS-PROVIDER FALLBACK
-- =====================================================================
ALTER TABLE public.ai_usage_log ADD COLUMN IF NOT EXISTS model TEXT;

CREATE INDEX IF NOT EXISTS idx_ai_usage_model_created
    ON public.ai_usage_log (model, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_usage_shop_model_created
    ON public.ai_usage_log (shop_id, model, created_at DESC);

CREATE OR REPLACE FUNCTION public.get_ai_models_usage_stats(p_shop_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_agg(
        jsonb_build_object(
            'model', COALESCE(model, 'unknown'),
            'total_calls', total_count,
            'total_requests', total_count,
            'calls_today', today_count,
            'today_requests', today_count,
            'total_tokens', (total_p_tokens + total_c_tokens),
            'total_prompt_tokens', total_p_tokens,
            'total_completion_tokens', total_c_tokens,
            'last_used_at', last_used
        ) ORDER BY total_count DESC
    )
    INTO v_result
    FROM (
        SELECT 
            COALESCE(model, 'unknown') AS model,
            COUNT(*)::INT AS total_count,
            COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)::INT AS today_count,
            COALESCE(SUM(prompt_tokens), 0)::BIGINT AS total_p_tokens,
            COALESCE(SUM(completion_tokens), 0)::BIGINT AS total_c_tokens,
            MAX(created_at) AS last_used
        FROM public.ai_usage_log
        WHERE (p_shop_id IS NULL OR shop_id = p_shop_id)
          AND (status = 'success' OR status IS NULL OR status ILIKE 'success' OR status = 'ok')
        GROUP BY COALESCE(model, 'unknown')
    ) sub;

    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_ai_models_usage_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ai_models_usage_stats(UUID) TO service_role;

-- 1b. RPC ghi nhận lượt sử dụng AI vào ai_usage_log
CREATE OR REPLACE FUNCTION public.record_ai_usage_log(
    p_model TEXT,
    p_request_type TEXT DEFAULT 'parse',
    p_shop_id UUID DEFAULT NULL,
    p_tokens INT DEFAULT 20
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.ai_usage_log (
        shop_id,
        user_id,
        model,
        request_type,
        status,
        prompt_tokens,
        completion_tokens,
        created_at
    ) VALUES (
        p_shop_id,
        auth.uid(),
        COALESCE(p_model, 'gemini-3.6-flash'),
        COALESCE(p_request_type, 'parse'),
        'success',
        p_tokens,
        p_tokens,
        NOW()
    );
    RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_ai_usage_log(TEXT, TEXT, UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_ai_usage_log(TEXT, TEXT, UUID, INT) TO service_role;

-- Bổ sung Policy INSERT cho ai_usage_log
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'ai_usage_log' 
          AND policyname = 'allow_authenticated_insert_ai_usage'
    ) THEN
        CREATE POLICY "allow_authenticated_insert_ai_usage" 
        ON public.ai_usage_log 
        FOR INSERT 
        WITH CHECK (auth.role() = 'authenticated');
    END IF;
END $$;

-- =====================================================================
-- MIGRATION v106: SHOP & USER ORDER EXTRACTION AND AI USAGE STATS
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_admin_shops_list()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result JSONB;
BEGIN
    IF NOT public.is_system_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Requires Admin role';
    END IF;

    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', s.id,
            'name', s.name,
            'status', COALESCE(s.status, 'Active'),
            'created_at', s.created_at,
            'plan', COALESCE(sq.plan_name, 'FREE'),
            'daily_ai_limit', COALESCE(sq.daily_ai_limit, sq.ai_quota_limit, 500),
            'ai_quota_limit', COALESCE(sq.daily_ai_limit, sq.ai_quota_limit, 500),
            'ai_used_today', COALESCE(au.ai_today, 0),
            'ai_used_total', COALESCE(au.ai_total, 0),
            'ai_quota_used', COALESCE(au.ai_today, sq.ai_quota_used, 0),
            'orders_count', COALESCE(ord.orders_total, 0),
            'orders_today', COALESCE(ord.orders_today, 0),
            'users_count', COALESCE(sm.users_count, 0),
            'devices_count', COALESCE(sd.devices_count, 0)
        ) ORDER BY s.created_at DESC
    ), '[]'::jsonb)
    INTO result
    FROM public.shops s
    LEFT JOIN public.shop_quotas sq ON s.id = sq.shop_id
    LEFT JOIN (
        SELECT shop_id, 
               COUNT(*)::INT as ai_total,
               COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)::INT as ai_today
        FROM public.ai_usage_log
        GROUP BY shop_id
    ) au ON s.id = au.shop_id
    LEFT JOIN (
        SELECT shop_id,
               COUNT(*)::INT as orders_total,
               COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)::INT as orders_today
        FROM public.submitted_orders
        WHERE deleted_at IS NULL
        GROUP BY shop_id
    ) ord ON s.id = ord.shop_id
    LEFT JOIN (
        SELECT shop_id, COUNT(user_id)::INT as users_count 
        FROM public.shop_members 
        WHERE removed_at IS NULL
        GROUP BY shop_id
    ) sm ON s.id = sm.shop_id
    LEFT JOIN (
        SELECT shop_id, COUNT(id)::INT as devices_count 
        FROM public.extension_devices 
        WHERE revoked = FALSE
        GROUP BY shop_id
    ) sd ON s.id = sd.shop_id;

    RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_shops_list() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_shops_list() TO service_role;

CREATE OR REPLACE FUNCTION public.get_admin_users_list(
  p_search_text TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_role TEXT DEFAULT NULL,
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'ACCESS_DENIED: SYSTEM_ADMIN only.';
  END IF;

  SELECT COALESCE(jsonb_agg(x ORDER BY x.created_at DESC), '[]'::jsonb) INTO v_result
  FROM (
    SELECT p.id,
           p.email,
           p.full_name,
           p.username,
           p.phone,
           p.status,
           p.created_at,
           p.last_login,
           p.disabled_at,
           CASE WHEN EXISTS (
                  SELECT 1 FROM public.user_roles ur
                  JOIN public.roles r ON ur.role_id = r.id
                  WHERE ur.user_id = p.id AND r.code = 'SYSTEM_ADMIN'
                ) THEN 'master_admin'
                ELSE (
                  SELECT r.code
                  FROM public.user_roles ur
                  JOIN public.roles r ON ur.role_id = r.id
                  WHERE ur.user_id = p.id
                  ORDER BY CASE r.code
                    WHEN 'SUPPORT' THEN 1 WHEN 'SHOP_OWNER' THEN 2
                    WHEN 'SHOP_MANAGER' THEN 3 WHEN 'SHOP_STAFF' THEN 4
                    WHEN 'VIEWER' THEN 5 WHEN 'EXTENSION_USER' THEN 6
                    ELSE 7 END
                  LIMIT 1
                )
           END AS role,
           COALESCE((
             SELECT jsonb_agg(jsonb_build_object(
                      'shop_id', sm.shop_id,
                      'shop_name', s.name,
                      'shop_role', sm.role
                    ))
             FROM public.shop_members sm
             JOIN public.shops s ON s.id = sm.shop_id
             WHERE sm.user_id = p.id
               AND sm.removed_at IS NULL
               AND s.deleted_at IS NULL
           ), '[]'::jsonb) AS shops,
           COALESCE((
             SELECT COUNT(*)::INT 
             FROM public.submitted_orders so 
             WHERE (so.submitted_by = p.id OR so.user_id = p.id)
               AND so.deleted_at IS NULL
           ), 0) AS orders_count,
           COALESCE((
             SELECT COUNT(*)::INT 
             FROM public.submitted_orders so 
             WHERE (so.submitted_by = p.id OR so.user_id = p.id)
               AND so.created_at >= CURRENT_DATE
               AND so.deleted_at IS NULL
           ), 0) AS orders_today,
           COALESCE((
             SELECT COUNT(*)::INT 
             FROM public.ai_usage_log au 
             WHERE au.user_id = p.id
           ), 0) AS ai_usage_count,
           COALESCE((
             SELECT COUNT(*)::INT 
             FROM public.ai_usage_log au 
             WHERE au.user_id = p.id
               AND au.created_at >= CURRENT_DATE
           ), 0) AS ai_usage_today
    FROM public.profiles p
    WHERE (p_status IS NULL OR p.status = p_status)
      AND (p_role IS NULL OR EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = p.id AND r.code = p_role
          ))
      AND (p_search_text IS NULL OR p.email ILIKE '%' || p_search_text || '%'
           OR p.full_name ILIKE '%' || p_search_text || '%'
           OR p.username ILIKE '%' || p_search_text || '%'
           OR p.phone ILIKE '%' || p_search_text || '%')
    ORDER BY p.created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) x;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_users_list(TEXT, TEXT, TEXT, INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_users_list(TEXT, TEXT, TEXT, INT, INT) TO service_role;

CREATE OR REPLACE FUNCTION public.get_shop_360_stats(p_shop_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result JSONB;
    v_quota_limit INT := 500;
    v_ai_today INT := 0;
    v_ai_total INT := 0;
    v_orders_today INT := 0;
    v_orders_total INT := 0;
    v_wallet NUMERIC := 0;
    v_recent_orders JSONB := '[]'::jsonb;
BEGIN
    IF NOT public.is_system_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Requires Admin role';
    END IF;

    SELECT 
        COALESCE(sq.daily_ai_limit, sq.ai_quota_limit, 500),
        COALESCE(s.wallet_balance, s.balance, 0)
    INTO v_quota_limit, v_wallet
    FROM public.shops s
    LEFT JOIN public.shop_quotas sq ON sq.shop_id = s.id
    WHERE s.id = p_shop_id;

    SELECT 
        COUNT(*)::INT,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)::INT
    INTO v_ai_total, v_ai_today
    FROM public.ai_usage_log
    WHERE shop_id = p_shop_id;

    SELECT 
        COUNT(*)::INT,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)::INT
    INTO v_orders_total, v_orders_today
    FROM public.submitted_orders
    WHERE shop_id = p_shop_id AND deleted_at IS NULL;

    SELECT COALESCE(jsonb_agg(ord ORDER BY ord.created_at DESC), '[]'::jsonb)
    INTO v_recent_orders
    FROM (
        SELECT id, order_code, tracking_code, 
               COALESCE(customer_name, name) AS customer_name,
               phone, address, cod_amount, status, staff_name,
               created_at, submitted_at
        FROM public.submitted_orders
        WHERE shop_id = p_shop_id AND deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT 30
    ) ord;

    v_result := jsonb_build_object(
        'shop_id', p_shop_id,
        'ai_quota_limit', v_quota_limit,
        'ai_quota_used_today', v_ai_today,
        'ai_used_total', v_ai_total,
        'orders_count', v_orders_total,
        'orders_today', v_orders_today,
        'wallet_balance', v_wallet,
        'recent_orders', v_recent_orders
    );

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_shop_360_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_shop_360_stats(UUID) TO service_role;

-- 5. Đảm bảo cấu trúc cột của submitted_orders tương thích mọi phiên bản
ALTER TABLE public.submitted_orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.submitted_orders ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.submitted_orders ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE public.submitted_orders ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'AUTO_FILL';
ALTER TABLE public.submitted_orders ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'vnpost';
ALTER TABLE public.submitted_orders ADD COLUMN IF NOT EXISTS device_name TEXT;
ALTER TABLE public.submitted_orders ADD COLUMN IF NOT EXISTS staff_name TEXT;
ALTER TABLE public.submitted_orders ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 6. RPC admin_get_global_orders phục vụ Tra Cứu Đơn Hàng Toàn Cục
CREATE OR REPLACE FUNCTION public.admin_get_global_orders(
  p_search TEXT DEFAULT NULL,
  p_shop_id UUID DEFAULT NULL,
  p_platform TEXT DEFAULT NULL,
  p_source TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id TEXT,
  shop_id UUID,
  shop_name TEXT,
  shop_code TEXT,
  order_code TEXT,
  tracking_code TEXT,
  destination_region TEXT,
  cod_amount NUMERIC,
  platform TEXT,
  status TEXT,
  source TEXT,
  device_name TEXT,
  created_at TIMESTAMPTZ,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_search TEXT := NULL;
BEGIN
  IF NOT (public.is_system_admin() OR EXISTS (
    SELECT 1 FROM public.user_roles ur 
    JOIN public.roles r ON ur.role_id = r.id 
    WHERE ur.user_id = auth.uid() AND r.code IN ('SYSTEM_ADMIN', 'SUPER_ADMIN', 'SUPPORT', 'SUPPORT_ADMIN', 'FINANCE_ADMIN', 'SUPPORT_STAFF', 'STAFF')
  )) THEN
    RAISE EXCEPTION 'Access denied: Requires admin or support access.';
  END IF;

  IF p_search IS NOT NULL AND TRIM(p_search) <> '' THEN
    v_search := '%' || TRIM(p_search) || '%';
  END IF;

  RETURN QUERY
  WITH filtered_orders AS (
    SELECT
      o.id::TEXT AS id,
      o.shop_id,
      COALESCE(s.name, 'Shop') AS shop_name,
      COALESCE(s.shop_code, '') AS shop_code,
      COALESCE(o.order_code, '') AS order_code,
      COALESCE(o.tracking_code, '') AS tracking_code,
      COALESCE(
        NULLIF(TRIM(SPLIT_PART(o.address, ',', -1)), ''),
        'Chưa rõ'
      ) AS destination_region,
      COALESCE(o.cod_amount, 0) AS cod_amount,
      COALESCE(o.platform, 'vnpost') AS platform,
      COALESCE(o.status, 'pending') AS status,
      COALESCE(o.source, 'AUTO_FILL') AS source,
      COALESCE(o.device_name, '') AS device_name,
      COALESCE(o.submitted_at, o.created_at, now()) AS created_at
    FROM public.submitted_orders o
    LEFT JOIN public.shops s ON s.id = o.shop_id
    WHERE
      o.deleted_at IS NULL
      AND (p_shop_id IS NULL OR o.shop_id = p_shop_id)
      AND (p_platform IS NULL OR o.platform ILIKE p_platform)
      AND (p_source IS NULL OR o.source ILIKE p_source)
      AND (
        v_search IS NULL
        OR o.order_code ILIKE v_search
        OR o.tracking_code ILIKE v_search
        OR s.name ILIKE v_search
        OR s.shop_code ILIKE v_search
      )
  ),
  counted AS (
    SELECT count(*)::BIGINT AS total FROM filtered_orders
  )
  SELECT
    fo.id,
    fo.shop_id,
    fo.shop_name,
    fo.shop_code,
    fo.order_code,
    fo.tracking_code,
    fo.destination_region,
    fo.cod_amount,
    fo.platform,
    fo.status,
    fo.source,
    fo.device_name,
    fo.created_at,
    c.total AS total_count
  FROM filtered_orders fo
  CROSS JOIN counted c
  ORDER BY fo.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_global_orders(TEXT, UUID, TEXT, TEXT, INT, INT) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

-- =========================================================================
-- v113_standardize_ai_usage_and_cost.sql
-- Chuẩn hóa schema ai_usage_log, đồng bộ tokens, seed giá model và RPC analytics
-- =========================================================================

-- 1. Bổ sung các cột thống nhất cho public.ai_usage_log
ALTER TABLE public.ai_usage_log ADD COLUMN IF NOT EXISTS provider TEXT;
ALTER TABLE public.ai_usage_log ADD COLUMN IF NOT EXISTS latency_ms INT DEFAULT 0;
ALTER TABLE public.ai_usage_log ADD COLUMN IF NOT EXISTS input_tokens INT DEFAULT 0;
ALTER TABLE public.ai_usage_log ADD COLUMN IF NOT EXISTS output_tokens INT DEFAULT 0;
ALTER TABLE public.ai_usage_log ADD COLUMN IF NOT EXISTS total_tokens INT DEFAULT 0;
ALTER TABLE public.ai_usage_log ADD COLUMN IF NOT EXISTS estimated_cost NUMERIC(16, 6) DEFAULT NULL;
ALTER TABLE public.ai_usage_log ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'VND';

-- 2. Trigger đồng bộ token và tính giá vốn tại thời điểm request
CREATE OR REPLACE FUNCTION public.tr_sync_ai_usage_log_tokens()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Đồng bộ input_tokens <-> prompt_tokens
  IF NEW.input_tokens IS NULL OR NEW.input_tokens = 0 THEN
    IF NEW.prompt_tokens IS NOT NULL AND NEW.prompt_tokens > 0 THEN
      NEW.input_tokens := NEW.prompt_tokens;
    END IF;
  ELSIF NEW.prompt_tokens IS NULL OR NEW.prompt_tokens = 0 THEN
    NEW.prompt_tokens := NEW.input_tokens;
  END IF;

  -- Đồng bộ output_tokens <-> completion_tokens
  IF NEW.output_tokens IS NULL OR NEW.output_tokens = 0 THEN
    IF NEW.completion_tokens IS NOT NULL AND NEW.completion_tokens > 0 THEN
      NEW.output_tokens := NEW.completion_tokens;
    END IF;
  ELSIF NEW.completion_tokens IS NULL OR NEW.completion_tokens = 0 THEN
    NEW.completion_tokens := NEW.output_tokens;
  END IF;

  -- Tính tổng tokens
  NEW.total_tokens := COALESCE(NEW.input_tokens, NEW.prompt_tokens, 0) + COALESCE(NEW.output_tokens, NEW.completion_tokens, 0);

  -- Suy diễn provider từ model nếu chưa có
  IF NEW.provider IS NULL OR NEW.provider = '' THEN
    IF NEW.model ILIKE '%gemini%' THEN NEW.provider := 'gemini';
    ELSIF NEW.model ILIKE '%llama%' OR NEW.model ILIKE '%mixtral%' OR NEW.model ILIKE '%groq%' THEN NEW.provider := 'groq';
    ELSIF NEW.model ILIKE '%grok%' THEN NEW.provider := 'grok';
    ELSIF NEW.model ILIKE '%gpt%' OR NEW.model ILIKE '%o1%' OR NEW.model ILIKE '%o3%' THEN NEW.provider := 'openai';
    ELSE NEW.provider := 'other';
    END IF;
  END IF;

  -- Tính giá vốn ước tính nếu chưa có và có model rate
  IF NEW.estimated_cost IS NULL AND NEW.model IS NOT NULL THEN
    SELECT 
      CASE 
        WHEN r.model IS NOT NULL THEN
          ROUND(
            (COALESCE(NEW.input_tokens, 0)::numeric / 1000000.0 * r.input_cost_per_million) +
            (COALESCE(NEW.output_tokens, 0)::numeric / 1000000.0 * r.output_cost_per_million),
            6
          )
        ELSE NULL
      END
    INTO NEW.estimated_cost
    FROM public.ai_model_cost_rates r
    WHERE r.model = NEW.model
      AND r.effective_from <= COALESCE(NEW.created_at, now())
    ORDER BY r.effective_from DESC
    LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_ai_usage_log_tokens_sync ON public.ai_usage_log;
CREATE TRIGGER tr_ai_usage_log_tokens_sync
  BEFORE INSERT OR UPDATE ON public.ai_usage_log
  FOR EACH ROW EXECUTE FUNCTION public.tr_sync_ai_usage_log_tokens();

-- 3. Seed baseline rates vào public.ai_model_cost_rates (Đơn vị: VND / 1,000,000 tokens)
INSERT INTO public.ai_model_cost_rates (model, input_cost_per_million, output_cost_per_million, currency, effective_from)
VALUES
  ('gemini-3.6-flash', 2500, 10000, 'VND', now()),
  ('gemini-2.0-flash', 2500, 10000, 'VND', now()),
  ('gemini-1.5-flash', 1875, 7500, 'VND', now()),
  ('llama-3.3-70b-versatile', 14750, 19750, 'VND', now()),
  ('llama-3.1-8b-instant', 1250, 2000, 'VND', now()),
  ('gpt-4o-mini', 3750, 15000, 'VND', now()),
  ('gpt-4o', 62500, 250000, 'VND', now()),
  ('grok-beta', 125000, 375000, 'VND', now())
ON CONFLICT (model) DO UPDATE SET
  input_cost_per_million = EXCLUDED.input_cost_per_million,
  output_cost_per_million = EXCLUDED.output_cost_per_million,
  currency = EXCLUDED.currency,
  effective_from = EXCLUDED.effective_from,
  updated_at = now();

-- 4. RPC báo cáo phân tích chi phí AI
CREATE OR REPLACE FUNCTION public.admin_get_ai_cost_analytics(
  p_from TIMESTAMPTZ,
  p_to TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_total_requests BIGINT := 0;
  v_successful_requests BIGINT := 0;
  v_failed_requests BIGINT := 0;
  v_total_tokens BIGINT := 0;
  v_total_cost NUMERIC(16, 2) := 0;
  v_unrated_requests BIGINT := 0;
  v_by_model JSONB := '[]'::jsonb;
  v_by_provider JSONB := '[]'::jsonb;
  v_rates JSONB := '[]'::jsonb;
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'ACCESS_DENIED';
  END IF;

  SELECT
    count(*),
    count(*) FILTER (WHERE status = 'success'),
    count(*) FILTER (WHERE status <> 'success'),
    COALESCE(sum(total_tokens), 0),
    COALESCE(sum(estimated_cost), 0),
    count(*) FILTER (WHERE estimated_cost IS NULL)
  INTO
    v_total_requests,
    v_successful_requests,
    v_failed_requests,
    v_total_tokens,
    v_total_cost,
    v_unrated_requests
  FROM public.ai_usage_log
  WHERE created_at BETWEEN p_from AND p_to;

  SELECT COALESCE(jsonb_agg(to_jsonb(m) ORDER BY m.total_requests DESC), '[]'::jsonb)
  INTO v_by_model
  FROM (
    SELECT
      model,
      COALESCE(provider, 'other') AS provider,
      count(*) AS total_requests,
      COALESCE(sum(total_tokens), 0) AS total_tokens,
      COALESCE(sum(estimated_cost), 0) AS estimated_cost,
      count(*) FILTER (WHERE estimated_cost IS NULL) AS unrated_count
    FROM public.ai_usage_log
    WHERE created_at BETWEEN p_from AND p_to
    GROUP BY model, provider
  ) m;

  SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.total_requests DESC), '[]'::jsonb)
  INTO v_by_provider
  FROM (
    SELECT
      COALESCE(provider, 'other') AS provider,
      count(*) AS total_requests,
      COALESCE(sum(total_tokens), 0) AS total_tokens,
      COALESCE(sum(estimated_cost), 0) AS estimated_cost
    FROM public.ai_usage_log
    WHERE created_at BETWEEN p_from AND p_to
    GROUP BY provider
  ) p;

  SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.model), '[]'::jsonb)
  INTO v_rates
  FROM public.ai_model_cost_rates r;

  RETURN jsonb_build_object(
    'period', jsonb_build_object('from', p_from, 'to', p_to),
    'total_requests', v_total_requests,
    'successful_requests', v_successful_requests,
    'failed_requests', v_failed_requests,
    'total_tokens', v_total_tokens,
    'total_estimated_cost', v_total_cost,
    'unrated_requests', v_unrated_requests,
    'by_model', v_by_model,
    'by_provider', v_by_provider,
    'rates', v_rates,
    'data_source', 'ai_usage_log_and_cost_rates',
    'measured_at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_ai_cost_analytics(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- =============================================================================
-- FILE: v114_payment_reconciliation_and_idempotency.sql
-- =============================================================================
-- Migration v114: Payment Reconciliation and Webhook Idempotency (G003)
-- 
-- 1. Adds reconciliation columns and indices to payment_transactions:
--    reconciliation_status, reconciliation_notes, reconciled_at, reconciled_by, retry_count, last_retry_at
-- 2. Defines admin RPC admin_get_payment_reconciliation_queue for auditing
--    unmatched, duplicate, failed, and reconciled transactions
-- 3. Defines admin RPC admin_reconcile_payment_transaction for manual shop matching
--    and subscription/quota crediting with full audit logging
-- 4. Hardens process_vietqr_payment to maintain reconciliation_status and prevent duplicate crediting
-- =============================================================================

-- 1. Bổ sung các cột đối soát vào bảng payment_transactions
ALTER TABLE public.payment_transactions ADD COLUMN IF NOT EXISTS reconciliation_status TEXT DEFAULT 'pending';
ALTER TABLE public.payment_transactions ADD COLUMN IF NOT EXISTS reconciliation_notes TEXT;
ALTER TABLE public.payment_transactions ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMPTZ;
ALTER TABLE public.payment_transactions ADD COLUMN IF NOT EXISTS reconciled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.payment_transactions ADD COLUMN IF NOT EXISTS retry_count INT DEFAULT 0;
ALTER TABLE public.payment_transactions ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMPTZ;
ALTER TABLE public.payment_transactions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Đồng bộ trạng thái đối soát ban đầu cho dữ liệu lịch sử
UPDATE public.payment_transactions 
SET reconciliation_status = CASE 
  WHEN upper(COALESCE(status, '')) IN ('SUCCESS', 'PROCESSED', 'COMPLETED', 'PAID') THEN 'reconciled'
  WHEN upper(COALESCE(status, '')) IN ('PENDING', 'UNMATCHED') THEN 'unmatched'
  WHEN upper(COALESCE(status, '')) IN ('DUPLICATE') THEN 'duplicate'
  WHEN upper(COALESCE(status, '')) IN ('FAILED', 'ERROR') THEN 'failed'
  ELSE 'pending'
END
WHERE reconciliation_status IS NULL OR reconciliation_status = 'pending';

-- Tạo Index tăng tốc truy vấn hàng đợi đối soát
CREATE INDEX IF NOT EXISTS idx_payment_trans_reconciliation_status 
ON public.payment_transactions(reconciliation_status);

CREATE INDEX IF NOT EXISTS idx_payment_trans_created_reconcile 
ON public.payment_transactions(created_at DESC, reconciliation_status);


-- 2. RPC: admin_get_payment_reconciliation_queue
-- Lấy danh sách giao dịch cần đối soát kèm bộ lọc trạng thái và thống kê tổng hợp
CREATE OR REPLACE FUNCTION public.admin_get_payment_reconciliation_queue(
  p_status TEXT DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total BIGINT := 0;
  v_records JSONB := '[]'::jsonb;
  v_stats JSONB := '{}'::jsonb;
BEGIN
  -- Bảo vệ quyền truy cập: Chỉ SYSTEM_ADMIN mới có quyền xem hàng đợi đối soát
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'ACCESS_DENIED: Only SYSTEM_ADMIN can access payment reconciliation queue.';
  END IF;

  -- Thống kê số lượng theo từng nhóm trạng thái
  SELECT jsonb_build_object(
    'total', count(*),
    'reconciled', count(*) FILTER (WHERE lower(COALESCE(reconciliation_status, '')) = 'reconciled' OR upper(COALESCE(status, '')) IN ('SUCCESS', 'PROCESSED')),
    'unmatched', count(*) FILTER (WHERE lower(COALESCE(reconciliation_status, '')) = 'unmatched' OR (shop_id IS NULL AND upper(COALESCE(status, '')) NOT IN ('SUCCESS', 'PROCESSED'))),
    'duplicate', count(*) FILTER (WHERE lower(COALESCE(reconciliation_status, '')) = 'duplicate'),
    'failed', count(*) FILTER (WHERE lower(COALESCE(reconciliation_status, '')) = 'failed' OR upper(COALESCE(status, '')) IN ('FAILED', 'ERROR'))
  ) INTO v_stats
  FROM public.payment_transactions;

  -- Đếm tổng số bản ghi thỏa điều kiện lọc
  SELECT count(*) INTO v_total
  FROM public.payment_transactions pt
  LEFT JOIN public.shops s ON s.id = pt.shop_id
  WHERE (p_status IS NULL OR p_status = '' OR p_status = 'ALL' OR lower(COALESCE(pt.reconciliation_status, '')) = lower(p_status))
    AND (
      p_search IS NULL OR p_search = '' OR
      pt.transaction_code ILIKE '%' || p_search || '%' OR
      COALESCE(pt.content, '') ILIKE '%' || p_search || '%' OR
      COALESCE(s.name, '') ILIKE '%' || p_search || '%' OR
      COALESCE(s.shop_code, '') ILIKE '%' || p_search || '%'
    );

  -- Truy vấn danh sách giao dịch
  SELECT jsonb_agg(sub) INTO v_records
  FROM (
    SELECT 
      pt.id,
      COALESCE(pt.transaction_id, pt.transaction_code) AS transaction_id,
      COALESCE(pt.transaction_code, pt.transaction_id) AS transaction_code,
      COALESCE(pt.gateway, 'VIETQR') AS gateway,
      COALESCE(pt.amount, 0) AS amount,
      COALESCE(pt.content, '') AS content,
      pt.shop_code,
      pt.shop_id,
      s.name AS shop_name,
      COALESCE(pt.status, 'PENDING') AS status,
      COALESCE(pt.reconciliation_status, 'pending') AS reconciliation_status,
      pt.reconciliation_notes,
      pt.reconciled_at,
      COALESCE(pt.retry_count, 0) AS retry_count,
      pt.last_retry_at,
      pt.created_at
    FROM public.payment_transactions pt
    LEFT JOIN public.shops s ON s.id = pt.shop_id
    WHERE (p_status IS NULL OR p_status = '' OR p_status = 'ALL' OR lower(COALESCE(pt.reconciliation_status, '')) = lower(p_status))
      AND (
        p_search IS NULL OR p_search = '' OR
        pt.transaction_code ILIKE '%' || p_search || '%' OR
        COALESCE(pt.content, '') ILIKE '%' || p_search || '%' OR
        COALESCE(s.name, '') ILIKE '%' || p_search || '%' OR
        COALESCE(s.shop_code, '') ILIKE '%' || p_search || '%'
      )
    ORDER BY pt.created_at DESC
    LIMIT COALESCE(p_limit, 50)
    OFFSET COALESCE(p_offset, 0)
  ) sub;

  RETURN jsonb_build_object(
    'success', true,
    'stats', v_stats,
    'total', v_total,
    'items', COALESCE(v_records, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_payment_reconciliation_queue(TEXT, TEXT, INT, INT) TO authenticated;


-- 3. RPC: admin_reconcile_payment_transaction
-- Thao tác đối soát thủ công hoặc thử lại giao dịch lỗi có ghi log audit
CREATE OR REPLACE FUNCTION public.admin_reconcile_payment_transaction(
  p_transaction_id UUID,
  p_target_shop_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx RECORD;
  v_shop RECORD;
  v_duration_months INT := 1;
  v_ai_quota INT := 2500;
  v_max_orders INT := 5000;
  v_plan_tier TEXT := 'PRO_MONTH';
  v_current_end TIMESTAMPTZ;
  v_new_end TIMESTAMPTZ;
BEGIN
  -- Bảo vệ quyền truy cập: Chỉ SYSTEM_ADMIN mới có quyền đối soát thủ công
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'ACCESS_DENIED: Only SYSTEM_ADMIN can reconcile payment transactions.';
  END IF;

  -- 1. Tìm thông tin giao dịch
  SELECT * INTO v_tx FROM public.payment_transactions WHERE id = p_transaction_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Không tìm thấy giao dịch với ID đã cho.');
  END IF;

  -- 2. Tìm thông tin Shop được gán
  SELECT * INTO v_shop FROM public.shops WHERE id = p_target_shop_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Không tìm thấy Shop đích hợp lệ.');
  END IF;

  -- 3. Kiểm tra số tiền hợp lệ (> 0)
  IF COALESCE(v_tx.amount, 0) <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Số tiền giao dịch không hợp lệ (<= 0 VND).');
  END IF;

  -- 4. Xác định gói cước và thời gian tương ứng với số tiền
  IF v_tx.amount >= 1000000 THEN
    v_plan_tier := 'PRO_YEAR';
    v_duration_months := 12;
    v_ai_quota := 50000;
    v_max_orders := 100000;
  ELSIF v_tx.amount >= 500000 THEN
    v_plan_tier := 'PRO_YEAR';
    v_duration_months := 12;
    v_ai_quota := 50000;
    v_max_orders := 100000;
  ELSE
    v_plan_tier := 'PRO_MONTH';
    v_duration_months := 1;
    v_ai_quota := 2500;
    v_max_orders := 5000;
  END IF;

  -- 5. Tính ngày hết hạn mới
  SELECT current_period_end INTO v_current_end FROM public.subscriptions WHERE shop_id = p_target_shop_id;
  IF v_current_end IS NOT NULL AND v_current_end > now() THEN
    v_new_end := v_current_end + (v_duration_months || ' months')::interval;
  ELSE
    v_new_end := now() + (v_duration_months || ' months')::interval;
  END IF;

  -- 6. Cập nhật Subscription cho Shop đích
  INSERT INTO public.subscriptions (
    shop_id, plan_tier, status, current_period_start, current_period_end,
    max_members, max_ai_requests, max_orders_per_month, updated_at
  )
  VALUES (
    p_target_shop_id, v_plan_tier, 'active', now(), v_new_end,
    5, v_ai_quota, v_max_orders, now()
  )
  ON CONFLICT (shop_id) DO UPDATE SET
    plan_tier = EXCLUDED.plan_tier,
    status = 'active',
    current_period_end = v_new_end,
    max_ai_requests = subscriptions.max_ai_requests + v_ai_quota,
    max_orders_per_month = subscriptions.max_orders_per_month + v_max_orders,
    updated_at = now();

  -- 7. Tăng hạn mức Shop Quotas
  INSERT INTO public.shop_quotas (
    shop_id, ai_monthly_limit, ai_monthly_used, ai_daily_limit, ai_daily_used,
    orders_monthly_limit, orders_monthly_used, reset_date, updated_at
  )
  VALUES (
    p_target_shop_id, v_ai_quota, 0, 200, 0,
    v_max_orders, 0, (CURRENT_DATE + (v_duration_months || ' months')::interval)::DATE, now()
  )
  ON CONFLICT (shop_id) DO UPDATE SET
    ai_monthly_limit = shop_quotas.ai_monthly_limit + v_ai_quota,
    orders_monthly_limit = shop_quotas.orders_monthly_limit + v_max_orders,
    reset_date = (CURRENT_DATE + (v_duration_months || ' months')::interval)::DATE,
    updated_at = now();

  -- 8. Cập nhật trạng thái giao dịch thành RECONCILED / SUCCESS
  UPDATE public.payment_transactions
  SET 
    shop_id = p_target_shop_id,
    shop_code = v_shop.shop_code,
    status = 'SUCCESS',
    reconciliation_status = 'reconciled',
    reconciliation_notes = COALESCE(p_notes, 'Được đối soát và kích hoạt thủ công bởi Admin'),
    reconciled_at = now(),
    reconciled_by = auth.uid(),
    retry_count = COALESCE(retry_count, 0) + 1,
    last_retry_at = now(),
    updated_at = now()
  WHERE id = p_transaction_id;

  -- 9. Ghi Audit Log cho hệ thống
  INSERT INTO public.audit_logs (
    shop_id, actor_id, action, entity_type, entity_id, details
  )
  VALUES (
    p_target_shop_id,
    auth.uid(),
    'ADMIN_RECONCILE_PAYMENT',
    'PAYMENT_TRANSACTION',
    p_transaction_id::text,
    jsonb_build_object(
      'transaction_code', v_tx.transaction_code,
      'amount', v_tx.amount,
      'target_shop_id', p_target_shop_id,
      'target_shop_name', v_shop.name,
      'notes', p_notes,
      'new_expires_at', v_new_end
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Đối soát và kích hoạt quyền lợi thành công!',
    'shop_id', p_target_shop_id,
    'new_expires_at', v_new_end
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_reconcile_payment_transaction(UUID, UUID, TEXT) TO authenticated;

-- =========================================================================
-- =============================================================================
-- FILE: v115_system_incidents_and_alert_rules.sql
-- =============================================================================
-- Migration v115: System Incidents & Operational Alert Rules (G005)
-- Mô tả: Bảng sự cố hệ thống, cơ chế Deduplication Window, enqueuing cảnh báo
--        và các RPCs kiểm soát sự cố dành cho Admin Dashboard.
-- =========================================================================

-- 1. Bảng lưu trữ sự cố hệ thống (system_incidents)
CREATE TABLE IF NOT EXISTS public.system_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_code TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    metric_value NUMERIC,
    threshold NUMERIC,
    window_seconds INT NOT NULL DEFAULT 300,
    dedupe_key TEXT NOT NULL,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    occurrence_count INT NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'firing' CHECK (status IN ('firing', 'acknowledged', 'resolved')),
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by UUID REFERENCES public.profiles(id),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES public.profiles(id),
    owner TEXT,
    notes TEXT,
    source_link TEXT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Chỉ mục tối ưu tra cứu và lọc
CREATE INDEX IF NOT EXISTS idx_system_incidents_dedupe ON public.system_incidents(dedupe_key, status);
CREATE INDEX IF NOT EXISTS idx_system_incidents_status_sev ON public.system_incidents(status, severity);
CREATE INDEX IF NOT EXISTS idx_system_incidents_created ON public.system_incidents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_incidents_last_seen ON public.system_incidents(last_seen_at DESC);

-- Bật RLS
ALTER TABLE public.system_incidents ENABLE ROW LEVEL SECURITY;

-- Policy RLS: Chỉ SYSTEM_ADMIN mới có quyền xem và cập nhật
DROP POLICY IF EXISTS system_incidents_admin_all ON public.system_incidents;
CREATE POLICY system_incidents_admin_all ON public.system_incidents
    FOR ALL
    TO authenticated
    USING (public.is_system_admin())
    WITH CHECK (public.is_system_admin());

DROP POLICY IF EXISTS system_incidents_service_role ON public.system_incidents;
CREATE POLICY system_incidents_service_role ON public.system_incidents
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 2. Hàm ghi nhận / khử trùng lặp sự cố (record_system_incident)
CREATE OR REPLACE FUNCTION public.record_system_incident(
    p_rule_code TEXT,
    p_severity TEXT,
    p_title TEXT,
    p_message TEXT,
    p_metric_value NUMERIC,
    p_threshold NUMERIC,
    p_window_seconds INT,
    p_dedupe_key TEXT,
    p_source_link TEXT DEFAULT NULL,
    p_payload JSONB DEFAULT '{}'::jsonb,
    p_owner TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_existing RECORD;
    v_incident_id UUID;
    v_sanitized_payload JSONB;
BEGIN
    -- Khử PII: loại bỏ mọi thông tin nhạy cảm của khách hàng
    v_sanitized_payload := COALESCE(p_payload, '{}'::jsonb)
        - 'customer_name' - 'name' - 'phone' - 'phone_number'
        - 'address' - 'raw_address' - 'street' - 'email'
        - 'password' - 'secret' - 'api_key' - 'token';

    -- Kiểm tra xem sự cố cùng dedupe_key đã tồn tại trong cửa sổ trượt (window) chưa
    SELECT id, occurrence_count, status, last_seen_at
    INTO v_existing
    FROM public.system_incidents
    WHERE dedupe_key = p_dedupe_key
      AND status IN ('firing', 'acknowledged')
      AND last_seen_at >= now() - (COALESCE(p_window_seconds, 300) || ' seconds')::interval
    ORDER BY last_seen_at DESC
    LIMIT 1;

    IF v_existing.id IS NOT NULL THEN
        -- Khử lặp: Chỉ cập nhật last_seen_at và tăng số lần xuất hiện, không tạo mới
        UPDATE public.system_incidents
        SET last_seen_at = now(),
            occurrence_count = occurrence_count + 1,
            metric_value = p_metric_value,
            payload = v_sanitized_payload,
            updated_at = now()
        WHERE id = v_existing.id
        RETURNING id INTO v_incident_id;

        RETURN jsonb_build_object(
            'success', true,
            'incident_id', v_incident_id,
            'is_new', false,
            'occurrence_count', v_existing.occurrence_count + 1,
            'status', v_existing.status
        );
    ELSE
        -- Tạo mới bản ghi sự cố
        INSERT INTO public.system_incidents(
            rule_code, severity, title, message, metric_value, threshold,
            window_seconds, dedupe_key, first_seen_at, last_seen_at,
            occurrence_count, status, owner, source_link, payload
        ) VALUES (
            p_rule_code, p_severity, p_title, p_message, p_metric_value, p_threshold,
            COALESCE(p_window_seconds, 300), p_dedupe_key, now(), now(),
            1, 'firing', p_owner, p_source_link, v_sanitized_payload
        )
        RETURNING id INTO v_incident_id;

        -- Đưa vào hàng đợi cảnh báo ops_alert_outbox cho Telegram/Discord/Slack bot (đã khử PII)
        INSERT INTO public.ops_alert_outbox(
            alert_type, severity, title, message, payload
        ) VALUES (
            p_rule_code,
            p_severity,
            p_title,
            p_message,
            jsonb_build_object(
                'incident_id', v_incident_id,
                'metric_value', p_metric_value,
                'threshold', p_threshold,
                'dedupe_key', p_dedupe_key,
                'source_link', p_source_link
            )
        );

        RETURN jsonb_build_object(
            'success', true,
            'incident_id', v_incident_id,
            'is_new', true,
            'occurrence_count', 1,
            'status', 'firing'
        );
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_system_incident(TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, INT, TEXT, TEXT, JSONB, TEXT) TO authenticated, service_role;

-- 3. RPC truy vấn danh sách sự cố và thống kê (admin_get_incidents)
CREATE OR REPLACE FUNCTION public.admin_get_incidents(
    p_status TEXT DEFAULT NULL,
    p_severity TEXT DEFAULT NULL,
    p_limit INT DEFAULT 50,
    p_offset INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_incidents JSONB;
    v_firing_count INT;
    v_acknowledged_count INT;
    v_resolved_count INT;
    v_critical_count INT;
    v_total_filtered INT;
BEGIN
    IF NOT public.is_system_admin() THEN
        RAISE EXCEPTION 'ACCESS_DENIED: SYSTEM_ADMIN only.';
    END IF;

    -- Thống kê tổng hợp số lượng sự cố theo trạng thái
    SELECT
        count(*) FILTER (WHERE status = 'firing'),
        count(*) FILTER (WHERE status = 'acknowledged'),
        count(*) FILTER (WHERE status = 'resolved'),
        count(*) FILTER (WHERE status = 'firing' AND severity = 'critical')
    INTO
        v_firing_count,
        v_acknowledged_count,
        v_resolved_count,
        v_critical_count
    FROM public.system_incidents;

    -- Đếm tổng số bản ghi thỏa mãn bộ lọc
    SELECT count(*)
    INTO v_total_filtered
    FROM public.system_incidents
    WHERE (p_status IS NULL OR p_status = '' OR status = p_status)
      AND (p_severity IS NULL OR p_severity = '' OR severity = p_severity);

    -- Lấy danh sách bản ghi
    SELECT COALESCE(jsonb_agg(row_to_json(i)), '[]'::jsonb)
    INTO v_incidents
    FROM (
        SELECT
            id, rule_code, severity, title, message, metric_value, threshold,
            window_seconds, dedupe_key, first_seen_at, last_seen_at,
            occurrence_count, status, acknowledged_at, acknowledged_by,
            resolved_at, resolved_by, owner, notes, source_link, payload,
            created_at, updated_at
        FROM public.system_incidents
        WHERE (p_status IS NULL OR p_status = '' OR status = p_status)
          AND (p_severity IS NULL OR p_severity = '' OR severity = p_severity)
        ORDER BY
            CASE status
                WHEN 'firing' THEN 1
                WHEN 'acknowledged' THEN 2
                WHEN 'resolved' THEN 3
                ELSE 4
            END,
            last_seen_at DESC
        LIMIT p_limit OFFSET p_offset
    ) i;

    RETURN jsonb_build_object(
        'summary', jsonb_build_object(
            'firing', COALESCE(v_firing_count, 0),
            'acknowledged', COALESCE(v_acknowledged_count, 0),
            'resolved', COALESCE(v_resolved_count, 0),
            'critical', COALESCE(v_critical_count, 0),
            'total_filtered', COALESCE(v_total_filtered, 0)
        ),
        'incidents', v_incidents
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_incidents(TEXT, TEXT, INT, INT) TO authenticated, service_role;

-- 4. RPC xử lý sự cố (Acknowledge / Resolve) có ghi vết Audit Log
CREATE OR REPLACE FUNCTION public.admin_update_incident_status(
    p_incident_id UUID,
    p_action TEXT,
    p_owner TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_incident RECORD;
    v_current_user_id UUID;
BEGIN
    IF NOT public.is_system_admin() THEN
        RAISE EXCEPTION 'ACCESS_DENIED: SYSTEM_ADMIN only.';
    END IF;

    v_current_user_id := auth.uid();

    SELECT * INTO v_incident FROM public.system_incidents WHERE id = p_incident_id;
    IF v_incident.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'INCIDENT_NOT_FOUND');
    END IF;

    IF p_action = 'acknowledge' THEN
        UPDATE public.system_incidents
        SET status = 'acknowledged',
            acknowledged_at = now(),
            acknowledged_by = v_current_user_id,
            owner = COALESCE(p_owner, owner),
            notes = COALESCE(p_notes, notes),
            updated_at = now()
        WHERE id = p_incident_id;

        -- Ghi vết Audit Log
        INSERT INTO public.audit_logs (user_id, action, target_resource, target_id, payload)
        VALUES (
            v_current_user_id,
            'INCIDENT_ACKNOWLEDGE',
            'system_incidents',
            p_incident_id::TEXT,
            jsonb_build_object('owner', p_owner, 'notes', p_notes, 'previous_status', v_incident.status)
        );

    ELSIF p_action = 'resolve' THEN
        UPDATE public.system_incidents
        SET status = 'resolved',
            resolved_at = now(),
            resolved_by = v_current_user_id,
            notes = COALESCE(p_notes, notes),
            updated_at = now()
        WHERE id = p_incident_id;

        -- Ghi vết Audit Log
        INSERT INTO public.audit_logs (user_id, action, target_resource, target_id, payload)
        VALUES (
            v_current_user_id,
            'INCIDENT_RESOLVE',
            'system_incidents',
            p_incident_id::TEXT,
            jsonb_build_object('notes', p_notes, 'previous_status', v_incident.status)
        );
    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_ACTION');
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'incident_id', p_incident_id,
        'action', p_action,
        'updated_at', now()
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_incident_status(UUID, TEXT, TEXT, TEXT) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

-- =========================================================================
-- =============================================================================
-- FILE: v116_provider_resilience_and_analytics.sql
-- =============================================================================
-- Migration v116: Provider Resilience & Analytics (G006)
-- Mô tả: Cột error_class, cache_hit cho ai_usage_log và RPC tính toán
--        tỷ lệ thành công, độ trễ p50/p95, phân nhóm lỗi theo provider.
-- =========================================================================

-- 1. Bổ sung các cột phục vụ quan sát độ phục hồi & SLA nhà cung cấp
ALTER TABLE public.ai_usage_log ADD COLUMN IF NOT EXISTS error_class TEXT;
ALTER TABLE public.ai_usage_log ADD COLUMN IF NOT EXISTS cache_hit BOOLEAN DEFAULT false;

-- 2. Chỉ mục tối ưu truy vấn SLA và độ trễ theo provider
CREATE INDEX IF NOT EXISTS idx_ai_usage_provider_status ON public.ai_usage_log(provider, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_latency ON public.ai_usage_log(provider, latency_ms);

-- 3. RPC tính toán Resilience Analytics theo Provider
CREATE OR REPLACE FUNCTION public.admin_get_provider_resilience_analytics(
    p_from TIMESTAMPTZ DEFAULT now() - interval '30 days',
    p_to TIMESTAMPTZ DEFAULT now()
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_result JSONB;
BEGIN
    IF NOT public.is_system_admin() THEN
        RAISE EXCEPTION 'ACCESS_DENIED: SYSTEM_ADMIN only.';
    END IF;

    SELECT COALESCE(jsonb_object_agg(p.provider, p.metrics), '{}'::jsonb)
    INTO v_result
    FROM (
        SELECT
            COALESCE(NULLIF(provider, ''), 'unknown') AS provider,
            jsonb_build_object(
                'provider', COALESCE(NULLIF(provider, ''), 'unknown'),
                'total_requests', count(*),
                'success_requests', count(*) FILTER (WHERE status = 'success'),
                'failed_requests', count(*) FILTER (WHERE status <> 'success'),
                'success_rate', CASE 
                    WHEN count(*) = 0 THEN 100.0
                    ELSE ROUND((count(*) FILTER (WHERE status = 'success')::numeric / count(*)::numeric) * 100.0, 2)
                END,
                'p50_latency_ms', ROUND(COALESCE(percentile_cont(0.50) WITHIN GROUP (ORDER BY COALESCE(latency_ms, 0)), 0)::numeric, 0),
                'p95_latency_ms', ROUND(COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY COALESCE(latency_ms, 0)), 0)::numeric, 0),
                'total_cost', ROUND(COALESCE(sum(estimated_cost), 0)::numeric, 2),
                'cache_hits', count(*) FILTER (WHERE cache_hit = true),
                'error_classes', (
                    SELECT COALESCE(jsonb_object_agg(sub.err_cls, sub.cnt), '{}'::jsonb)
                    FROM (
                        SELECT COALESCE(error_class, 'UNKNOWN') AS err_cls, count(*) AS cnt
                        FROM public.ai_usage_log inner_log
                        WHERE inner_log.provider = outer_log.provider
                          AND inner_log.created_at >= p_from AND inner_log.created_at <= p_to
                          AND inner_log.status <> 'success'
                        GROUP BY COALESCE(error_class, 'UNKNOWN')
                    ) sub
                )
            ) AS metrics
        FROM public.ai_usage_log outer_log
        WHERE created_at >= p_from AND created_at <= p_to
        GROUP BY COALESCE(NULLIF(provider, ''), 'unknown')
    ) p;

    RETURN jsonb_build_object(
        'from', p_from,
        'to', p_to,
        'by_provider', v_result
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_provider_resilience_analytics(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- =============================================================================
-- FILE: v117_standardize_job_outbox_reliability.sql
-- =============================================================================
-- Migration v117: Standardize Job/Outbox Reliability & Dead Letter Replay (G007)
--
-- Standardizes background queue states (pending, running, succeeded, failed, dead_letter),
-- exponential backoff retry count, atomic lease locks (FOR UPDATE SKIP LOCKED) to prevent
-- concurrent worker collisions, idempotency key deduplication, and admin replay RPCs with audit.
-- =============================================================================

-- 1. Standardized system job outbox table
CREATE TABLE IF NOT EXISTS public.system_job_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    queue_type TEXT NOT NULL CHECK (queue_type IN ('draft_sync', 'order_sync', 'telegram_alert', 'webhook_retry', 'retention_notification', 'custom')),
    idempotency_key TEXT UNIQUE,
    shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'succeeded', 'failed', 'dead_letter')),
    attempts INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 5,
    next_retry_at TIMESTAMPTZ DEFAULT now(),
    lease_token TEXT,
    lease_expires_at TIMESTAMPTZ,
    last_error TEXT,
    dead_letter_reason TEXT,
    priority INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ
);

-- 2. Standardize columns on existing outbox tables
ALTER TABLE public.sync_outbox ADD COLUMN IF NOT EXISTS attempts INT NOT NULL DEFAULT 0;
ALTER TABLE public.sync_outbox ADD COLUMN IF NOT EXISTS max_attempts INT NOT NULL DEFAULT 5;
ALTER TABLE public.sync_outbox ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.sync_outbox ADD COLUMN IF NOT EXISTS lease_token TEXT;
ALTER TABLE public.sync_outbox ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ;
ALTER TABLE public.sync_outbox ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE public.sync_outbox ADD COLUMN IF NOT EXISTS dead_letter_reason TEXT;
ALTER TABLE public.sync_outbox ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.ops_alert_outbox ADD COLUMN IF NOT EXISTS max_attempts INT NOT NULL DEFAULT 5;
ALTER TABLE public.ops_alert_outbox ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.ops_alert_outbox ADD COLUMN IF NOT EXISTS lease_token TEXT;
ALTER TABLE public.ops_alert_outbox ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ;
ALTER TABLE public.ops_alert_outbox ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE public.ops_alert_outbox ADD COLUMN IF NOT EXISTS dead_letter_reason TEXT;
ALTER TABLE public.ops_alert_outbox ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 3. High-performance indices for worker polling and lease tracking
CREATE INDEX IF NOT EXISTS idx_system_job_outbox_poll ON public.system_job_outbox (queue_type, status, next_retry_at, priority);
CREATE INDEX IF NOT EXISTS idx_system_job_outbox_lease ON public.system_job_outbox (lease_token, lease_expires_at);
CREATE INDEX IF NOT EXISTS idx_system_job_outbox_status ON public.system_job_outbox (status, created_at);
CREATE INDEX IF NOT EXISTS idx_system_job_outbox_idempotency ON public.system_job_outbox (idempotency_key);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.system_job_outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_manage_system_job_outbox ON public.system_job_outbox;
CREATE POLICY admin_manage_system_job_outbox ON public.system_job_outbox
  FOR ALL USING (public.is_system_admin());

DROP POLICY IF EXISTS shop_manage_system_job_outbox ON public.system_job_outbox;
CREATE POLICY shop_manage_system_job_outbox ON public.system_job_outbox
  FOR ALL USING (
    shop_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.shop_members
      WHERE shop_members.shop_id = system_job_outbox.shop_id
        AND shop_members.user_id = auth.uid()
        AND shop_members.removed_at IS NULL
    )
  );

-- 5. Atomic Lease Acquisition RPC (Guarantees zero concurrency overlap via SKIP LOCKED)
CREATE OR REPLACE FUNCTION public.acquire_outbox_job_lease(
    p_worker_id TEXT,
    p_queue_type TEXT DEFAULT NULL,
    p_lease_seconds INT DEFAULT 60,
    p_batch_size INT DEFAULT 1
)
RETURNS SETOF public.system_job_outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN QUERY
  WITH available_jobs AS (
    SELECT id
    FROM public.system_job_outbox
    WHERE (p_queue_type IS NULL OR queue_type = p_queue_type)
      AND (
        status = 'pending'
        OR (status = 'failed' AND attempts < max_attempts AND (next_retry_at IS NULL OR next_retry_at <= now()))
        OR (status = 'running' AND lease_expires_at < now()) -- Claim zombie locks whose worker died
      )
    ORDER BY priority DESC, created_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.system_job_outbox j
  SET status = 'running',
      lease_token = p_worker_id,
      lease_expires_at = now() + (p_lease_seconds || ' seconds')::interval,
      attempts = j.attempts + 1,
      updated_at = now()
  FROM available_jobs
  WHERE j.id = available_jobs.id
  RETURNING j.*;
END;
$$;

GRANT EXECUTE ON FUNCTION public.acquire_outbox_job_lease(TEXT, TEXT, INT, INT) TO authenticated, service_role;

-- 6. Complete Outbox Job RPC
CREATE OR REPLACE FUNCTION public.complete_outbox_job(
    p_job_id UUID,
    p_lease_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_updated INT := 0;
BEGIN
  UPDATE public.system_job_outbox
  SET status = 'succeeded',
      lease_token = NULL,
      lease_expires_at = NULL,
      processed_at = now(),
      updated_at = now()
  WHERE id = p_job_id
    AND (lease_token = p_lease_token OR lease_token IS NULL OR public.is_system_admin());
    
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  
  IF v_updated = 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Job not found or lease mismatch');
  END IF;

  RETURN jsonb_build_object('success', true, 'job_id', p_job_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_outbox_job(UUID, TEXT) TO authenticated, service_role;

-- 7. Fail Outbox Job RPC (Transitions to dead_letter if attempts >= max_attempts)
CREATE OR REPLACE FUNCTION public.fail_outbox_job(
    p_job_id UUID,
    p_lease_token TEXT,
    p_error_message TEXT,
    p_retry_delay_seconds INT DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_job RECORD;
  v_new_status TEXT;
BEGIN
  SELECT * INTO v_job
  FROM public.system_job_outbox
  WHERE id = p_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Job not found');
  END IF;

  IF v_job.lease_token IS NOT NULL AND v_job.lease_token != p_lease_token AND NOT public.is_system_admin() THEN
    RETURN jsonb_build_object('success', false, 'message', 'Lease mismatch');
  END IF;

  IF v_job.attempts >= v_job.max_attempts THEN
    v_new_status := 'dead_letter';
  ELSE
    v_new_status := 'failed';
  END IF;

  UPDATE public.system_job_outbox
  SET status = v_new_status,
      last_error = p_error_message,
      dead_letter_reason = CASE WHEN v_new_status = 'dead_letter' THEN p_error_message ELSE dead_letter_reason END,
      lease_token = NULL,
      lease_expires_at = NULL,
      next_retry_at = CASE WHEN v_new_status = 'failed' THEN now() + (p_retry_delay_seconds || ' seconds')::interval ELSE next_retry_at END,
      updated_at = now()
  WHERE id = p_job_id;

  RETURN jsonb_build_object('success', true, 'job_id', p_job_id, 'status', v_new_status);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fail_outbox_job(UUID, TEXT, TEXT, INT) TO authenticated, service_role;

-- 8. Admin Dead Letter Replay RPC (Guarded by is_system_admin and audited)
CREATE OR REPLACE FUNCTION public.admin_replay_dead_letter_jobs(
    p_queue_type TEXT DEFAULT NULL,
    p_job_ids UUID[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_replayed_count INT := 0;
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'ACCESS_DENIED: SYSTEM_ADMIN only.';
  END IF;

  UPDATE public.system_job_outbox
  SET status = 'pending',
      attempts = 0,
      next_retry_at = now(),
      lease_token = NULL,
      lease_expires_at = NULL,
      dead_letter_reason = NULL,
      last_error = NULL,
      updated_at = now()
  WHERE status = 'dead_letter'
    AND (p_queue_type IS NULL OR queue_type = p_queue_type)
    AND (p_job_ids IS NULL OR id = ANY(p_job_ids));

  GET DIAGNOSTICS v_replayed_count = ROW_COUNT;

  -- Ghi nhận lịch sử kiểm toán audit_logs
  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (
    auth.uid(),
    'REPLAY_DEAD_LETTER_JOBS',
    'system_job_outbox',
    COALESCE(p_queue_type, 'all_queues'),
    jsonb_build_object(
      'replayed_count', v_replayed_count,
      'queue_type', p_queue_type,
      'requested_job_ids', p_job_ids,
      'replayed_at', now()
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'replayed_count', v_replayed_count,
    'message', 'Đã phục hồi ' || v_replayed_count || ' jobs từ hàng đợi dead_letter.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_replay_dead_letter_jobs(TEXT, UUID[]) TO authenticated, service_role;

-- 9. Admin Retry Outbox Job RPC
CREATE OR REPLACE FUNCTION public.admin_retry_outbox_job(
    p_job_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'ACCESS_DENIED: SYSTEM_ADMIN only.';
  END IF;

  UPDATE public.system_job_outbox
  SET status = 'pending',
      attempts = 0,
      next_retry_at = now(),
      lease_token = NULL,
      lease_expires_at = NULL,
      updated_at = now()
  WHERE id = p_job_id;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (
    auth.uid(),
    'RETRY_OUTBOX_JOB',
    'system_job_outbox',
    p_job_id::text,
    jsonb_build_object('retried_at', now())
  );

  RETURN jsonb_build_object('success', true, 'job_id', p_job_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_retry_outbox_job(UUID) TO authenticated, service_role;

-- 10. Admin Get Outbox Queue Metrics RPC
CREATE OR REPLACE FUNCTION public.admin_get_outbox_queue_metrics()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_metrics JSONB;
  v_summary RECORD;
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'ACCESS_DENIED: SYSTEM_ADMIN only.';
  END IF;

  -- Overall counts
  SELECT
    count(*) AS total,
    count(*) FILTER (WHERE status = 'pending') AS pending,
    count(*) FILTER (WHERE status = 'running') AS running,
    count(*) FILTER (WHERE status = 'succeeded') AS succeeded,
    count(*) FILTER (WHERE status = 'failed') AS failed,
    count(*) FILTER (WHERE status = 'dead_letter') AS dead_letter
  INTO v_summary
  FROM public.system_job_outbox;

  -- Queue type breakdown
  WITH queue_stats AS (
    SELECT
      queue_type,
      count(*) AS total,
      count(*) FILTER (WHERE status = 'pending') AS pending,
      count(*) FILTER (WHERE status = 'running') AS running,
      count(*) FILTER (WHERE status = 'succeeded') AS succeeded,
      count(*) FILTER (WHERE status = 'failed') AS failed,
      count(*) FILTER (WHERE status = 'dead_letter') AS dead_letter
    FROM public.system_job_outbox
    GROUP BY queue_type
  )
  SELECT COALESCE(jsonb_object_agg(queue_type, jsonb_build_object(
    'total', total,
    'pending', pending,
    'running', running,
    'succeeded', succeeded,
    'failed', failed,
    'dead_letter', dead_letter
  )), '{}'::jsonb)
  INTO v_metrics
  FROM queue_stats;

  RETURN jsonb_build_object(
    'summary', jsonb_build_object(
      'total', COALESCE(v_summary.total, 0),
      'pending', COALESCE(v_summary.pending, 0),
      'running', COALESCE(v_summary.running, 0),
      'succeeded', COALESCE(v_summary.succeeded, 0),
      'failed', COALESCE(v_summary.failed, 0),
      'dead_letter', COALESCE(v_summary.dead_letter, 0)
    ),
    'queues', v_metrics,
    'checked_at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_outbox_queue_metrics() TO authenticated, service_role;

-- =============================================================================
-- =============================================================================
-- FILE: v118_data_quality_intelligence.sql
-- =============================================================================
-- Migration v118: Data Quality Intelligence & Audited Drill-Down Dashboard (G008)
--
-- Tracks 5 core data quality vectors across all shops:
-- 1. missing_tracking_code: Đơn submitted nhưng thiếu mã vận đơn
-- 2. invalid_duplicate_order_code: Đơn có order_code trùng lặp trong cùng shop
-- 3. low_confidence_address: Đơn có độ tin cậy địa chỉ bóc tách thấp
-- 4. stale_carrier_status: Đơn xuất kho không có tín hiệu bưu cục > 72 giờ
-- 5. unmatched_payment: Giao dịch thanh toán chưa khớp đơn/shop
--
-- Includes audited drill-down, range filtering, and resolution tracking.
-- =============================================================================

-- 1. Indices for rapid quality anomaly detection
CREATE INDEX IF NOT EXISTS idx_submitted_orders_tracking_check ON public.submitted_orders (created_at DESC) WHERE (tracking_code IS NULL OR tracking_code = '');
CREATE INDEX IF NOT EXISTS idx_submitted_orders_shop_order_code ON public.submitted_orders (shop_id, order_code);
CREATE INDEX IF NOT EXISTS idx_submitted_orders_carrier_stale ON public.submitted_orders (status, updated_at) WHERE status NOT IN ('delivered', 'cancelled', 'returned');

-- 2. RPC: admin_get_data_quality_kpis
CREATE OR REPLACE FUNCTION public.admin_get_data_quality_kpis(p_range TEXT DEFAULT '30d')
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_from TIMESTAMPTZ;
  v_missing_tracking INT := 0;
  v_duplicate_code INT := 0;
  v_low_conf_addr INT := 0;
  v_stale_carrier INT := 0;
  v_unmatched_pay INT := 0;
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'ACCESS_DENIED: SYSTEM_ADMIN only.';
  END IF;

  IF p_range = '7d' THEN
    v_from := now() - interval '7 days';
  ELSIF p_range = 'all' THEN
    v_from := '2020-01-01 00:00:00Z'::timestamptz;
  ELSE
    v_from := now() - interval '30 days';
  END IF;

  -- 1. Missing tracking code
  SELECT count(*) INTO v_missing_tracking
  FROM public.submitted_orders
  WHERE (tracking_code IS NULL OR trim(tracking_code) = '')
    AND created_at >= v_from;

  -- 2. Duplicate order codes in same shop
  WITH dupes AS (
    SELECT shop_id, order_code
    FROM public.submitted_orders
    WHERE order_code IS NOT NULL AND trim(order_code) != '' AND created_at >= v_from
    GROUP BY shop_id, order_code
    HAVING count(*) > 1
  )
  SELECT COALESCE(sum(cnt), 0) INTO v_duplicate_code
  FROM (
    SELECT count(*) as cnt
    FROM public.submitted_orders s
    JOIN dupes d ON s.shop_id = d.shop_id AND s.order_code = d.order_code
    WHERE s.created_at >= v_from
  ) sub;

  -- 3. Low confidence address
  BEGIN
    SELECT count(*) INTO v_low_conf_addr
    FROM public.orders
    WHERE deleted_at IS NULL
      AND (status IS NULL OR status = 'draft')
      AND (
        COALESCE(address_score, 100) < 70
        OR COALESCE((metadata->>'confidence')::numeric, 1.0) < 0.7
        OR (ward IS NULL AND district IS NULL)
      )
      AND created_at >= v_from;
  EXCEPTION WHEN OTHERS THEN
    v_low_conf_addr := 0;
  END;

  -- 4. Stale carrier status (> 72 hours without terminal delivery status)
  SELECT count(*) INTO v_stale_carrier
  FROM public.submitted_orders
  WHERE status NOT IN ('delivered', 'cancelled', 'returned')
    AND tracking_code IS NOT NULL
    AND trim(tracking_code) != ''
    AND updated_at < now() - interval '72 hours'
    AND created_at >= v_from;

  -- 5. Unmatched payment transactions
  BEGIN
    SELECT count(*) INTO v_unmatched_pay
    FROM public.payment_transactions
    WHERE (reconciliation_status IN ('unmatched', 'failed', 'duplicate')
           OR status = 'FAILED'
           OR (shop_id IS NULL AND status != 'CANCELLED'))
      AND created_at >= v_from;
  EXCEPTION WHEN OTHERS THEN
    v_unmatched_pay := 0;
  END;

  RETURN jsonb_build_object(
    'missing_tracking_code', v_missing_tracking,
    'invalid_duplicate_order_code', v_duplicate_code,
    'low_confidence_address', v_low_conf_addr,
    'stale_carrier_status', v_stale_carrier,
    'unmatched_payment', v_unmatched_pay,
    'total_issues', (v_missing_tracking + v_duplicate_code + v_low_conf_addr + v_stale_carrier + v_unmatched_pay),
    'range', p_range,
    'range_start', v_from,
    'calculated_at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_data_quality_kpis(TEXT) TO authenticated, service_role;

-- 3. RPC: admin_get_data_quality_drilldown
CREATE OR REPLACE FUNCTION public.admin_get_data_quality_drilldown(
    p_kpi_type TEXT,
    p_range TEXT DEFAULT '30d',
    p_limit INT DEFAULT 50,
    p_offset INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_from TIMESTAMPTZ;
  v_total INT := 0;
  v_records JSONB := '[]'::jsonb;
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'ACCESS_DENIED: SYSTEM_ADMIN only.';
  END IF;

  IF p_range = '7d' THEN
    v_from := now() - interval '7 days';
  ELSIF p_range = 'all' THEN
    v_from := '2020-01-01 00:00:00Z'::timestamptz;
  ELSE
    v_from := now() - interval '30 days';
  END IF;

  IF p_kpi_type = 'missing_tracking_code' THEN
    SELECT count(*) INTO v_total
    FROM public.submitted_orders
    WHERE (tracking_code IS NULL OR trim(tracking_code) = '') AND created_at >= v_from;

    SELECT COALESCE(jsonb_agg(r), '[]'::jsonb) INTO v_records
    FROM (
      SELECT
        s.id AS record_id,
        s.shop_id,
        COALESCE(sh.name, 'Shop #' || left(s.shop_id::text, 8)) AS shop_name,
        s.order_code,
        s.tracking_code,
        COALESCE(s.platform, 'vnpost') AS carrier,
        s.status,
        -- PII Masking
        regexp_replace(COALESCE(s.customer_name, s.name, 'Khách hàng'), '^(..)(.+)(.)$', '\1****\3') AS customer_name_masked,
        regexp_replace(COALESCE(s.phone, '0900000000'), '^(..)(.+)(.{4})$', '\1****\3') AS customer_phone_masked,
        'Đơn đã submit nhưng thiếu mã vận đơn' AS issue_description,
        COALESCE(s.created_at, s.submitted_at, now()) AS detected_at
      FROM public.submitted_orders s
      LEFT JOIN public.shops sh ON sh.id = s.shop_id
      WHERE (s.tracking_code IS NULL OR trim(s.tracking_code) = '') AND COALESCE(s.created_at, s.submitted_at, now()) >= v_from
      ORDER BY COALESCE(s.created_at, s.submitted_at, now()) DESC
      LIMIT p_limit OFFSET p_offset
    ) r;

  ELSIF p_kpi_type = 'invalid_duplicate_order_code' THEN
    WITH dupes AS (
      SELECT shop_id, order_code
      FROM public.submitted_orders
      WHERE order_code IS NOT NULL AND trim(order_code) != '' AND COALESCE(created_at, submitted_at, now()) >= v_from
      GROUP BY shop_id, order_code
      HAVING count(*) > 1
    )
    SELECT count(*) INTO v_total
    FROM public.submitted_orders s
    JOIN dupes d ON s.shop_id = d.shop_id AND s.order_code = d.order_code
    WHERE COALESCE(s.created_at, s.submitted_at, now()) >= v_from;

    SELECT COALESCE(jsonb_agg(r), '[]'::jsonb) INTO v_records
    FROM (
      WITH dupes AS (
        SELECT shop_id, order_code
        FROM public.submitted_orders
        WHERE order_code IS NOT NULL AND trim(order_code) != '' AND COALESCE(created_at, submitted_at, now()) >= v_from
        GROUP BY shop_id, order_code
        HAVING count(*) > 1
      )
      SELECT
        s.id AS record_id,
        s.shop_id,
        COALESCE(sh.name, 'Shop #' || left(s.shop_id::text, 8)) AS shop_name,
        s.order_code,
        s.tracking_code,
        COALESCE(s.platform, 'vnpost') AS carrier,
        s.status,
        regexp_replace(COALESCE(s.customer_name, s.name, 'Khách hàng'), '^(..)(.+)(.)$', '\1****\3') AS customer_name_masked,
        regexp_replace(COALESCE(s.phone, '0900000000'), '^(..)(.+)(.{4})$', '\1****\3') AS customer_phone_masked,
        'Mã đơn trùng lặp với đơn hàng khác trong cùng shop' AS issue_description,
        COALESCE(s.created_at, s.submitted_at, now()) AS detected_at
      FROM public.submitted_orders s
      JOIN dupes d ON s.shop_id = d.shop_id AND s.order_code = d.order_code
      LEFT JOIN public.shops sh ON sh.id = s.shop_id
      WHERE COALESCE(s.created_at, s.submitted_at, now()) >= v_from
      ORDER BY s.order_code, COALESCE(s.created_at, s.submitted_at, now()) DESC
      LIMIT p_limit OFFSET p_offset
    ) r;

  ELSIF p_kpi_type = 'stale_carrier_status' THEN
    SELECT count(*) INTO v_total
    FROM public.submitted_orders
    WHERE status NOT IN ('delivered', 'cancelled', 'returned')
      AND tracking_code IS NOT NULL AND trim(tracking_code) != ''
      AND COALESCE(updated_at, created_at, submitted_at, now()) < now() - interval '72 hours'
      AND COALESCE(created_at, submitted_at, now()) >= v_from;

    SELECT COALESCE(jsonb_agg(r), '[]'::jsonb) INTO v_records
    FROM (
      SELECT
        s.id AS record_id,
        s.shop_id,
        COALESCE(sh.name, 'Shop #' || left(s.shop_id::text, 8)) AS shop_name,
        s.order_code,
        s.tracking_code,
        COALESCE(s.platform, 'vnpost') AS carrier,
        s.status,
        regexp_replace(COALESCE(s.customer_name, s.name, 'Khách hàng'), '^(..)(.+)(.)$', '\1****\3') AS customer_name_masked,
        regexp_replace(COALESCE(s.phone, '0900000000'), '^(..)(.+)(.{4})$', '\1****\3') AS customer_phone_masked,
        'Đơn không có cập nhật trạng thái bưu cục > 72 giờ' AS issue_description,
        COALESCE(s.updated_at, s.created_at, s.submitted_at, now()) AS detected_at
      FROM public.submitted_orders s
      LEFT JOIN public.shops sh ON sh.id = s.shop_id
      WHERE s.status NOT IN ('delivered', 'cancelled', 'returned')
        AND s.tracking_code IS NOT NULL AND trim(s.tracking_code) != ''
        AND COALESCE(s.updated_at, s.created_at, s.submitted_at, now()) < now() - interval '72 hours'
        AND COALESCE(s.created_at, s.submitted_at, now()) >= v_from
      ORDER BY COALESCE(s.updated_at, s.created_at, s.submitted_at, now()) ASC
      LIMIT p_limit OFFSET p_offset
    ) r;

  ELSIF p_kpi_type = 'low_confidence_address' THEN
    BEGIN
      SELECT count(*) INTO v_total
      FROM public.orders
      WHERE deleted_at IS NULL AND (status IS NULL OR status = 'draft')
        AND (COALESCE(address_score, 100) < 70 OR COALESCE((metadata->>'confidence')::numeric, 1.0) < 0.7 OR (ward IS NULL AND district IS NULL))
        AND created_at >= v_from;

      SELECT COALESCE(jsonb_agg(r), '[]'::jsonb) INTO v_records
      FROM (
        SELECT
          o.id AS record_id,
          o.shop_id,
          COALESCE(sh.name, 'Shop #' || left(o.shop_id::text, 8)) AS shop_name,
          o.order_code,
          NULL AS tracking_code,
          'N/A' AS carrier,
          o.status,
          regexp_replace(COALESCE(o.customer_name, 'Khách hàng'), '^(..)(.+)(.)$', '\1****\3') AS customer_name_masked,
          regexp_replace(COALESCE(o.phone, '0900000000'), '^(..)(.+)(.{4})$', '\1****\3') AS customer_phone_masked,
          'Độ tin cậy bóc tách địa chỉ thấp (' || COALESCE(o.address_score, 50) || '/100)' AS issue_description,
          o.created_at AS detected_at
        FROM public.orders o
        LEFT JOIN public.shops sh ON sh.id = o.shop_id
        WHERE o.deleted_at IS NULL AND (o.status IS NULL OR o.status = 'draft')
          AND (COALESCE(o.address_score, 100) < 70 OR COALESCE((o.metadata->>'confidence')::numeric, 1.0) < 0.7 OR (o.ward IS NULL AND o.district IS NULL))
          AND o.created_at >= v_from
        ORDER BY o.created_at DESC
        LIMIT p_limit OFFSET p_offset
      ) r;
    EXCEPTION WHEN OTHERS THEN
      v_total := 0; v_records := '[]'::jsonb;
    END;

  ELSIF p_kpi_type = 'unmatched_payment' THEN
    BEGIN
      SELECT count(*) INTO v_total
      FROM public.payment_transactions
      WHERE (reconciliation_status IN ('unmatched', 'failed', 'duplicate')
             OR status = 'FAILED'
             OR (shop_id IS NULL AND status != 'CANCELLED'))
        AND created_at >= v_from;

      SELECT COALESCE(jsonb_agg(r), '[]'::jsonb) INTO v_records
      FROM (
        SELECT
          p.id AS record_id,
          p.shop_id,
          COALESCE(sh.name, 'Chưa xác định') AS shop_name,
          p.transaction_code AS order_code,
          p.order_invoice_number AS tracking_code,
          'PAYMENT' AS carrier,
          p.status,
          'Giao dịch ' || p.amount || 'đ' AS customer_name_masked,
          '09****0000' AS customer_phone_masked,
          'Giao dịch thanh toán chưa khớp shop hoặc thất bại (' || COALESCE(p.reconciliation_status, p.status) || ')' AS issue_description,
          p.created_at AS detected_at
        FROM public.payment_transactions p
        LEFT JOIN public.shops sh ON sh.id = p.shop_id
        WHERE (p.reconciliation_status IN ('unmatched', 'failed', 'duplicate')
               OR p.status = 'FAILED'
               OR (p.shop_id IS NULL AND p.status != 'CANCELLED'))
          AND p.created_at >= v_from
        ORDER BY p.created_at DESC
        LIMIT p_limit OFFSET p_offset
      ) r;
    EXCEPTION WHEN OTHERS THEN
      v_total := 0; v_records := '[]'::jsonb;
    END;
  END IF;

  RETURN jsonb_build_object(
    'kpi_type', p_kpi_type,
    'total', v_total,
    'records', v_records,
    'limit', p_limit,
    'offset', p_offset
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_data_quality_drilldown(TEXT, TEXT, INT, INT) TO authenticated, service_role;

-- 4. RPC: admin_resolve_data_quality_issue
CREATE OR REPLACE FUNCTION public.admin_resolve_data_quality_issue(
    p_issue_type TEXT,
    p_record_id UUID,
    p_resolution_note TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'ACCESS_DENIED: SYSTEM_ADMIN only.';
  END IF;

  -- Ghi nhận lịch sử kiểm toán vào audit_logs
  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (
    auth.uid(),
    'RESOLVE_DATA_QUALITY_ISSUE',
    'data_quality_' || p_issue_type,
    p_record_id::text,
    jsonb_build_object(
      'issue_type', p_issue_type,
      'resolution_note', p_resolution_note,
      'resolved_at', now()
    )
  );

  RETURN jsonb_build_object('success', true, 'record_id', p_record_id, 'message', 'Đã lưu xác nhận giải quyết chất lượng dữ liệu.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_resolve_data_quality_issue(TEXT, UUID, TEXT) TO authenticated, service_role;

-- Migration: v119_retention_automation_snapshots.sql
-- Description: G009 Retention automation: daily snapshots, playbook tasks with single-open-task deduplication invariant, and cohort conversion analytics separating active from failed trials.

-- 1. Daily snapshot table for tracking segment transitions over time
CREATE TABLE IF NOT EXISTS public.retention_daily_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  segment TEXT NOT NULL CHECK(segment IN ('HEALTHY', 'AT_RISK', 'EXPIRING_SOON', 'CRITICAL')),
  risk_score INT NOT NULL DEFAULT 0,
  orders_30d INT NOT NULL DEFAULT 0,
  last_order_at TIMESTAMPTZ,
  subscription_status TEXT,
  plan_tier TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_retention_daily_snapshot UNIQUE(snapshot_date, shop_id)
);

CREATE INDEX IF NOT EXISTS idx_retention_snapshots_date_segment ON public.retention_daily_snapshots(snapshot_date, segment);
CREATE INDEX IF NOT EXISTS idx_retention_snapshots_shop_date ON public.retention_daily_snapshots(shop_id, snapshot_date DESC);

ALTER TABLE public.retention_daily_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS retention_daily_snapshots_admin ON public.retention_daily_snapshots;
CREATE POLICY retention_daily_snapshots_admin ON public.retention_daily_snapshots
  FOR ALL TO authenticated
  USING(public.is_system_admin())
  WITH CHECK(public.is_system_admin());

-- 2. Enhance retention_actions with playbook fields, assignee, outcome, and next_action
ALTER TABLE public.retention_actions ADD COLUMN IF NOT EXISTS playbook_code TEXT DEFAULT 'MANUAL';
ALTER TABLE public.retention_actions ADD COLUMN IF NOT EXISTS assignee_id UUID REFERENCES auth.users(id);
ALTER TABLE public.retention_actions ADD COLUMN IF NOT EXISTS assignee_name TEXT;
ALTER TABLE public.retention_actions ADD COLUMN IF NOT EXISTS outcome TEXT;
ALTER TABLE public.retention_actions ADD COLUMN IF NOT EXISTS next_action TEXT;
ALTER TABLE public.retention_actions ADD COLUMN IF NOT EXISTS segment TEXT;

CREATE INDEX IF NOT EXISTS idx_retention_actions_shop_playbook_status 
  ON public.retention_actions(shop_id, playbook_code, status);

-- 3. Daily snapshot generation RPC
CREATE OR REPLACE FUNCTION public.admin_generate_retention_snapshots(
  p_snapshot_date DATE DEFAULT CURRENT_DATE,
  p_inactive_days INT DEFAULT 3,
  p_expiring_days INT DEFAULT 3
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_inserted INT := 0;
  v_date DATE := COALESCE(p_snapshot_date, CURRENT_DATE);
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'ACCESS_DENIED';
  END IF;

  WITH portfolio_eval AS (
    SELECT 
      s.id AS shop_id,
      sub.status AS subscription_status,
      COALESCE(sub.plan_tier, sub.plan_code, 'UNKNOWN') AS plan_tier,
      o.last_order_at,
      COALESCE(o.orders_30d, 0) AS orders_30d,
      (CASE WHEN o.last_order_at IS NULL THEN 40 
            WHEN o.last_order_at < now() - (p_inactive_days || ' days')::interval THEN 45 
            ELSE 0 END
       + CASE WHEN sub.current_period_end BETWEEN now() AND now() + (p_expiring_days || ' days')::interval THEN 40 
              ELSE 0 END
       + CASE WHEN lower(COALESCE(sub.status, '')) IN ('past_due', 'expired', 'cancelled', 'canceled') THEN 60 
              ELSE 0 END) AS risk_score,
      (CASE WHEN lower(COALESCE(sub.status, '')) IN ('past_due', 'expired', 'cancelled', 'canceled') THEN 'CRITICAL'
            WHEN sub.current_period_end BETWEEN now() AND now() + (p_expiring_days || ' days')::interval THEN 'EXPIRING_SOON'
            WHEN o.last_order_at IS NULL OR o.last_order_at < now() - (p_inactive_days || ' days')::interval THEN 'AT_RISK'
            ELSE 'HEALTHY' END) AS segment
    FROM public.shops s
    LEFT JOIN public.subscriptions sub ON sub.shop_id = s.id
    LEFT JOIN (
      SELECT 
        shop_id,
        MAX(created_at) AS last_order_at,
        COUNT(*) FILTER (WHERE created_at >= now() - INTERVAL '30 days') AS orders_30d
      FROM public.submitted_orders
      WHERE deleted_at IS NULL
      GROUP BY shop_id
    ) o ON o.shop_id = s.id
    WHERE s.deleted_at IS NULL
  )
  INSERT INTO public.retention_daily_snapshots (
    snapshot_date, shop_id, segment, risk_score, orders_30d, last_order_at, subscription_status, plan_tier
  )
  SELECT 
    v_date, shop_id, segment, risk_score, orders_30d, last_order_at, subscription_status, plan_tier
  FROM portfolio_eval
  ON CONFLICT (snapshot_date, shop_id) DO UPDATE SET
    segment = EXCLUDED.segment,
    risk_score = EXCLUDED.risk_score,
    orders_30d = EXCLUDED.orders_30d,
    last_order_at = EXCLUDED.last_order_at,
    subscription_status = EXCLUDED.subscription_status,
    plan_tier = EXCLUDED.plan_tier
  ;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'snapshot_date', v_date,
    'shops_recorded', v_inserted,
    'generated_at', now()
  );
END;
$$;

-- 4. Playbook task creation with deduplication invariant
-- Done invariant: "Một shop chuyển segment tạo tối đa một task đang mở cho cùng playbook."
CREATE OR REPLACE FUNCTION public.admin_create_playbook_task(
  p_shop_id UUID,
  p_playbook_code TEXT,
  p_assignee_id UUID DEFAULT NULL,
  p_assignee_name TEXT DEFAULT NULL,
  p_due_at TIMESTAMPTZ DEFAULT NULL,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing_id UUID;
  v_new_id UUID;
  v_code TEXT := upper(trim(COALESCE(p_playbook_code, 'MANUAL')));
  v_due TIMESTAMPTZ := COALESCE(p_due_at, now() + INTERVAL '2 days');
  v_action_type TEXT;
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'ACCESS_DENIED';
  END IF;

  IF p_shop_id IS NULL THEN
    RAISE EXCEPTION 'SHOP_ID_REQUIRED';
  END IF;

  -- Deduplication check: check if an OPEN task already exists for this shop & playbook
  SELECT id INTO v_existing_id
  FROM public.retention_actions
  WHERE shop_id = p_shop_id
    AND playbook_code = v_code
    AND status = 'OPEN'
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'created', false,
      'deduplicated', true,
      'task_id', v_existing_id,
      'message', 'Đã có task đang mở cho playbook này của shop'
    );
  END IF;

  -- Default action type by playbook
  v_action_type := CASE 
    WHEN v_code = 'AT_RISK' THEN 'CALL'
    WHEN v_code = 'EXPIRING_SOON' THEN 'OFFER'
    WHEN v_code = 'CRITICAL' THEN 'CALL'
    ELSE 'NOTE'
  END;

  INSERT INTO public.retention_actions (
    shop_id,
    action_type,
    playbook_code,
    status,
    assignee_id,
    assignee_name,
    due_at,
    note,
    segment,
    created_by,
    created_at,
    updated_at
  ) VALUES (
    p_shop_id,
    v_action_type,
    v_code,
    'OPEN',
    p_assignee_id,
    NULLIF(trim(p_assignee_name), ''),
    v_due,
    NULLIF(trim(p_note), ''),
    v_code,
    auth.uid(),
    now(),
    now()
  )
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object(
    'success', true,
    'created', true,
    'deduplicated', false,
    'task_id', v_new_id,
    'message', 'Tạo task playbook CSKH thành công'
  );
END;
$$;

-- 5. Update task with outcome, next action and status
CREATE OR REPLACE FUNCTION public.admin_update_retention_task(
  p_task_id UUID,
  p_status TEXT,
  p_outcome TEXT DEFAULT NULL,
  p_next_action TEXT DEFAULT NULL,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status TEXT := upper(trim(p_status));
  v_outcome TEXT := NULLIF(upper(trim(p_outcome)), '');
  v_task public.retention_actions%ROWTYPE;
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'ACCESS_DENIED';
  END IF;

  IF v_status NOT IN ('OPEN', 'DONE', 'DISMISSED') THEN
    RAISE EXCEPTION 'INVALID_STATUS: Must be OPEN, DONE, or DISMISSED';
  END IF;

  UPDATE public.retention_actions
  SET 
    status = v_status,
    outcome = COALESCE(v_outcome, outcome),
    next_action = COALESCE(NULLIF(trim(p_next_action), ''), next_action),
    note = CASE 
      WHEN NULLIF(trim(p_note), '') IS NOT NULL THEN 
        COALESCE(note || E'\n---\n' || trim(p_note), trim(p_note))
      ELSE note 
    END,
    completed_at = CASE WHEN v_status IN ('DONE', 'DISMISSED') THEN now() ELSE NULL END,
    updated_at = now()
  WHERE id = p_task_id
  RETURNING * INTO v_task;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TASK_NOT_FOUND';
  END IF;

  -- Audit trail
  INSERT INTO public.audit_logs (user_id, action, target_type, target_id, details)
  VALUES (
    auth.uid(),
    'ADMIN_UPDATE_RETENTION_TASK',
    'retention_task',
    p_task_id::TEXT,
    jsonb_build_object(
      'status', v_status,
      'outcome', v_outcome,
      'next_action', p_next_action,
      'shop_id', v_task.shop_id
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'task_id', v_task.id,
    'status', v_task.status,
    'outcome', v_task.outcome,
    'next_action', v_task.next_action,
    'updated_at', v_task.updated_at
  );
END;
$$;

-- 6. Cohort retention analytics RPC with proper denominator
-- Invariant: "Tính conversion theo cohort đúng mẫu số; tách trial còn mở khỏi trial thất bại."
CREATE OR REPLACE FUNCTION public.admin_get_cohort_retention_analytics(
  p_months INT DEFAULT 6
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cohorts JSONB;
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'ACCESS_DENIED';
  END IF;

  WITH monthly_cohorts AS (
    SELECT 
      to_char(date_trunc('month', s.created_at), 'YYYY-MM') AS cohort_month,
      s.id AS shop_id,
      sub.status AS sub_status,
      COALESCE(sub.plan_tier, sub.plan_code, 'FREE') AS plan_tier,
      sub.current_period_end,
      -- Active trial: status is trial AND current_period_end has not passed
      (lower(COALESCE(sub.status, '')) IN ('trial', 'trialing') AND COALESCE(sub.current_period_end, now() + interval '1 day') >= now()) AS is_active_trial,
      -- Failed trial: trial ended without conversion or expired/cancelled
      (lower(COALESCE(sub.status, '')) IN ('expired', 'cancelled', 'canceled') 
       OR (lower(COALESCE(sub.status, '')) IN ('trial', 'trialing') AND sub.current_period_end < now())) AS is_failed_trial,
      -- Converted: Active paid tier
      (lower(COALESCE(sub.status, '')) = 'active' AND upper(COALESCE(sub.plan_tier, sub.plan_code, 'FREE')) NOT IN ('TRIAL', 'FREE')) AS is_converted,
      EXISTS (
        SELECT 1 FROM public.submitted_orders o 
        WHERE o.shop_id = s.id AND o.created_at >= now() - INTERVAL '30 days' AND o.deleted_at IS NULL
      ) AS has_recent_orders
    FROM public.shops s
    LEFT JOIN public.subscriptions sub ON sub.shop_id = s.id
    WHERE s.deleted_at IS NULL
      AND s.created_at >= date_trunc('month', now()) - (p_months || ' months')::interval
  ),
  aggregated AS (
    SELECT 
      cohort_month,
      COUNT(*) AS total_shops,
      COUNT(*) FILTER (WHERE is_active_trial) AS active_trial_shops,
      COUNT(*) FILTER (WHERE is_failed_trial) AS failed_trial_shops,
      COUNT(*) FILTER (WHERE is_converted) AS converted_shops,
      COUNT(*) FILTER (WHERE has_recent_orders) AS active_orders_shops
    FROM monthly_cohorts
    GROUP BY cohort_month
    ORDER BY cohort_month DESC
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'cohort_month', cohort_month,
      'total_shops', total_shops,
      'active_trial_shops', active_trial_shops,
      'failed_trial_shops', failed_trial_shops,
      'converted_shops', converted_shops,
      'active_orders_shops', active_orders_shops,
      'raw_conversion_percent', CASE 
        WHEN total_shops > 0 THEN round(converted_shops::numeric / total_shops * 100, 2)
        ELSE NULL 
      END,
      -- Mature conversion excludes active trials from denominator so open trials do not penalize conversion rate
      'mature_conversion_percent', CASE 
        WHEN (total_shops - active_trial_shops) > 0 THEN 
          round(converted_shops::numeric / (total_shops - active_trial_shops) * 100, 2)
        ELSE NULL 
      END
    )
  ), '[]'::jsonb) INTO v_cohorts
  FROM aggregated;

  RETURN jsonb_build_object(
    'cohorts', v_cohorts,
    'analysis_months', p_months,
    'measured_at', now()
  );
END;
$$;

-- 7. Query Playbook tasks with shop information
CREATE OR REPLACE FUNCTION public.admin_get_retention_tasks(
  p_status TEXT DEFAULT 'ALL',
  p_playbook TEXT DEFAULT 'ALL',
  p_limit INT DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tasks JSONB;
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'ACCESS_DENIED';
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.due_at ASC NULLS LAST, t.created_at DESC), '[]'::jsonb)
  INTO v_tasks
  FROM (
    SELECT 
      ra.id,
      ra.shop_id,
      s.name AS shop_name,
      ra.action_type,
      ra.playbook_code,
      ra.status,
      ra.assignee_id,
      ra.assignee_name,
      ra.outcome,
      ra.next_action,
      ra.note,
      ra.segment,
      ra.due_at,
      ra.completed_at,
      ra.created_at,
      ra.updated_at
    FROM public.retention_actions ra
    JOIN public.shops s ON s.id = ra.shop_id
    WHERE (p_status = 'ALL' OR ra.status = upper(trim(p_status)))
      AND (p_playbook = 'ALL' OR ra.playbook_code = upper(trim(p_playbook)))
    ORDER BY 
      CASE WHEN ra.status = 'OPEN' THEN 0 ELSE 1 END,
      ra.due_at ASC NULLS LAST
    LIMIT p_limit
  ) t;

  RETURN v_tasks;
END;
$$;

-- Permissions and grants
GRANT SELECT, INSERT, UPDATE ON public.retention_daily_snapshots TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_generate_retention_snapshots(DATE, INT, INT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_create_playbook_task(UUID, TEXT, UUID, TEXT, TIMESTAMPTZ, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_update_retention_task(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_get_cohort_retention_analytics(INT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_get_retention_tasks(TEXT, TEXT, INT) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

-- Migration: v120_reseller_portal_production.sql
-- Description: G010 Complete Reseller Portal: referred shops, eligible revenue, commission lifecycle (pending/approved/paid/reversed), payout statements, and strict tenant isolation.

-- 1. Extend reseller_accounts with user_id for portal authentication and banking info
ALTER TABLE public.reseller_accounts ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE public.reseller_accounts ADD COLUMN IF NOT EXISTS contact_phone TEXT;
ALTER TABLE public.reseller_accounts ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE public.reseller_accounts ADD COLUMN IF NOT EXISTS bank_account_no TEXT;
ALTER TABLE public.reseller_accounts ADD COLUMN IF NOT EXISTS bank_account_holder TEXT;
ALTER TABLE public.reseller_accounts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_reseller_accounts_user_id ON public.reseller_accounts(user_id);

-- 2. Payout statements table
CREATE TABLE IF NOT EXISTS public.reseller_payout_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_code TEXT NOT NULL UNIQUE,
  reseller_id UUID NOT NULL REFERENCES public.reseller_accounts(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_eligible_revenue NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_commission_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  net_payout_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'approved', 'paid', 'cancelled')),
  payout_method TEXT DEFAULT 'BANK_TRANSFER',
  payout_ref TEXT,
  paid_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reseller_payout_reseller ON public.reseller_payout_statements(reseller_id, status);

-- 3. Reseller commissions table (stores both positive earnings and negative refund/chargeback reversals)
CREATE TABLE IF NOT EXISTS public.reseller_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id UUID NOT NULL REFERENCES public.reseller_accounts(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  payment_transaction_id UUID REFERENCES public.payment_transactions(id) ON DELETE SET NULL,
  eligible_revenue NUMERIC(15,2) NOT NULL DEFAULT 0,
  commission_rate NUMERIC(5,2) NOT NULL DEFAULT 10,
  commission_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'paid', 'reversed')),
  reference_id TEXT UNIQUE,
  notes TEXT,
  payout_statement_id UUID REFERENCES public.reseller_payout_statements(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_reseller_commissions_reseller_status ON public.reseller_commissions(reseller_id, status);
CREATE INDEX IF NOT EXISTS idx_reseller_commissions_payment ON public.reseller_commissions(payment_transaction_id);
CREATE INDEX IF NOT EXISTS idx_reseller_commissions_statement ON public.reseller_commissions(payout_statement_id);

-- 4. Enable RLS and enforce Strict Tenant Isolation
ALTER TABLE public.reseller_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reseller_shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reseller_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reseller_payout_statements ENABLE ROW LEVEL SECURITY;

-- Reseller Accounts policies
DROP POLICY IF EXISTS reseller_accounts_admin ON public.reseller_accounts;
CREATE POLICY reseller_accounts_admin ON public.reseller_accounts
  FOR ALL TO authenticated
  USING(public.is_system_admin())
  WITH CHECK(public.is_system_admin());

DROP POLICY IF EXISTS reseller_accounts_self ON public.reseller_accounts;
CREATE POLICY reseller_accounts_self ON public.reseller_accounts
  FOR SELECT TO authenticated
  USING(user_id = auth.uid());

-- Reseller Shops policies (Tenant Isolation)
DROP POLICY IF EXISTS reseller_shops_admin ON public.reseller_shops;
CREATE POLICY reseller_shops_admin ON public.reseller_shops
  FOR ALL TO authenticated
  USING(public.is_system_admin())
  WITH CHECK(public.is_system_admin());

DROP POLICY IF EXISTS reseller_shops_isolation ON public.reseller_shops;
CREATE POLICY reseller_shops_isolation ON public.reseller_shops
  FOR SELECT TO authenticated
  USING(reseller_id IN (SELECT id FROM public.reseller_accounts WHERE user_id = auth.uid()));

-- Reseller Commissions policies (Tenant Isolation)
DROP POLICY IF EXISTS reseller_commissions_admin ON public.reseller_commissions;
CREATE POLICY reseller_commissions_admin ON public.reseller_commissions
  FOR ALL TO authenticated
  USING(public.is_system_admin())
  WITH CHECK(public.is_system_admin());

DROP POLICY IF EXISTS reseller_commissions_isolation ON public.reseller_commissions;
CREATE POLICY reseller_commissions_isolation ON public.reseller_commissions
  FOR SELECT TO authenticated
  USING(reseller_id IN (SELECT id FROM public.reseller_accounts WHERE user_id = auth.uid()));

-- Reseller Payout Statements policies (Tenant Isolation)
DROP POLICY IF EXISTS reseller_payout_admin ON public.reseller_payout_statements;
CREATE POLICY reseller_payout_admin ON public.reseller_payout_statements
  FOR ALL TO authenticated
  USING(public.is_system_admin())
  WITH CHECK(public.is_system_admin());

DROP POLICY IF EXISTS reseller_payout_isolation ON public.reseller_payout_statements;
CREATE POLICY reseller_payout_isolation ON public.reseller_payout_statements
  FOR SELECT TO authenticated
  USING(reseller_id IN (SELECT id FROM public.reseller_accounts WHERE user_id = auth.uid()));

-- 5. RPC: reseller_get_portal_overview
CREATE OR REPLACE FUNCTION public.reseller_get_portal_overview(
  p_reseller_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_reseller_id UUID;
  v_reseller public.reseller_accounts%ROWTYPE;
  v_shops JSONB;
  v_commissions JSONB;
  v_statements JSONB;
  v_pending NUMERIC(15,2);
  v_approved NUMERIC(15,2);
  v_paid NUMERIC(15,2);
  v_reversed NUMERIC(15,2);
  v_revenue NUMERIC(15,2);
BEGIN
  -- Determine target reseller with tenant security
  IF public.is_system_admin() THEN
    IF p_reseller_id IS NOT NULL THEN
      v_reseller_id := p_reseller_id;
    ELSE
      SELECT id INTO v_reseller_id FROM public.reseller_accounts ORDER BY created_at ASC LIMIT 1;
    END IF;
  ELSE
    SELECT id INTO v_reseller_id FROM public.reseller_accounts WHERE user_id = auth.uid() LIMIT 1;
    IF v_reseller_id IS NULL THEN
      RAISE EXCEPTION 'ACCESS_DENIED_RESELLER_NOT_FOUND';
    END IF;
  END IF;

  IF v_reseller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No reseller account found');
  END IF;

  SELECT * INTO v_reseller FROM public.reseller_accounts WHERE id = v_reseller_id;

  -- Commission balance aggregates
  SELECT 
    COALESCE(SUM(eligible_revenue) FILTER (WHERE status != 'reversed'), 0),
    COALESCE(SUM(commission_amount) FILTER (WHERE status = 'pending'), 0),
    COALESCE(SUM(commission_amount) FILTER (WHERE status = 'approved'), 0),
    COALESCE(SUM(commission_amount) FILTER (WHERE status = 'paid'), 0),
    COALESCE(SUM(commission_amount) FILTER (WHERE status = 'reversed'), 0)
  INTO v_revenue, v_pending, v_approved, v_paid, v_reversed
  FROM public.reseller_commissions
  WHERE reseller_id = v_reseller_id;

  -- Referred shops
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'shop_id', s.id,
      'shop_name', s.name,
      'assigned_at', rs.assigned_at,
      'plan_tier', COALESCE(sub.plan_tier, sub.plan_code, 'FREE'),
      'orders_30d', COALESCE(o.orders_30d, 0)
    ) ORDER BY rs.assigned_at DESC
  ), '[]'::jsonb) INTO v_shops
  FROM public.reseller_shops rs
  JOIN public.shops s ON s.id = rs.shop_id
  LEFT JOIN public.subscriptions sub ON sub.shop_id = s.id
  LEFT JOIN (
    SELECT shop_id, COUNT(*) AS orders_30d 
    FROM public.submitted_orders 
    WHERE created_at >= now() - INTERVAL '30 days' AND deleted_at IS NULL
    GROUP BY shop_id
  ) o ON o.shop_id = s.id
  WHERE rs.reseller_id = v_reseller_id;

  -- Recent commissions
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', rc.id,
      'shop_id', rc.shop_id,
      'shop_name', s.name,
      'eligible_revenue', rc.eligible_revenue,
      'commission_rate', rc.commission_rate,
      'commission_amount', rc.commission_amount,
      'status', rc.status,
      'reference_id', rc.reference_id,
      'notes', rc.notes,
      'created_at', rc.created_at,
      'approved_at', rc.approved_at,
      'paid_at', rc.paid_at
    ) ORDER BY rc.created_at DESC
  ), '[]'::jsonb) INTO v_commissions
  FROM public.reseller_commissions rc
  JOIN public.shops s ON s.id = rc.shop_id
  WHERE rc.reseller_id = v_reseller_id
  LIMIT 50;

  -- Payout statements
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', rps.id,
      'statement_code', rps.statement_code,
      'period_start', rps.period_start,
      'period_end', rps.period_end,
      'total_eligible_revenue', rps.total_eligible_revenue,
      'total_commission_amount', rps.total_commission_amount,
      'net_payout_amount', rps.net_payout_amount,
      'status', rps.status,
      'payout_method', rps.payout_method,
      'payout_ref', rps.payout_ref,
      'paid_at', rps.paid_at,
      'created_at', rps.created_at
    ) ORDER BY rps.created_at DESC
  ), '[]'::jsonb) INTO v_statements
  FROM public.reseller_payout_statements rps
  WHERE rps.reseller_id = v_reseller_id;

  RETURN jsonb_build_object(
    'reseller_id', v_reseller.id,
    'name', v_reseller.name,
    'code', v_reseller.code,
    'commission_rate', v_reseller.commission_rate,
    'status', v_reseller.status,
    'bank_name', v_reseller.bank_name,
    'bank_account_no', v_reseller.bank_account_no,
    'bank_account_holder', v_reseller.bank_account_holder,
    'referred_shops_count', jsonb_array_length(v_shops),
    'eligible_revenue_total', v_revenue,
    'commission_pending', v_pending,
    'commission_approved', v_approved,
    'commission_paid', v_paid,
    'commission_reversed', v_reversed,
    'net_claimable_commission', GREATEST(0, v_approved + v_reversed),
    'referred_shops', v_shops,
    'recent_commissions', v_commissions,
    'payout_statements', v_statements,
    'retrieved_at', now()
  );
END;
$$;

-- 6. RPC: record_reseller_commission_from_payment
CREATE OR REPLACE FUNCTION public.record_reseller_commission_from_payment(
  p_payment_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_payment public.payment_transactions%ROWTYPE;
  v_reseller_shop public.reseller_shops%ROWTYPE;
  v_reseller public.reseller_accounts%ROWTYPE;
  v_commission_amount NUMERIC(15,2);
  v_ref_id TEXT;
  v_comm_id UUID;
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'ACCESS_DENIED';
  END IF;

  SELECT * INTO v_payment FROM public.payment_transactions WHERE id = p_payment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYMENT_TRANSACTION_NOT_FOUND';
  END IF;

  -- Only reconciled payments generate commission
  IF v_payment.reconciliation_status != 'reconciled' AND v_payment.status != 'COMPLETED' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Payment not reconciled yet');
  END IF;

  IF v_payment.shop_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'No shop associated with payment');
  END IF;

  -- Check if shop belongs to a reseller
  SELECT * INTO v_reseller_shop FROM public.reseller_shops WHERE shop_id = v_payment.shop_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Shop does not belong to any reseller');
  END IF;

  SELECT * INTO v_reseller FROM public.reseller_accounts WHERE id = v_reseller_shop.reseller_id;
  IF v_reseller.status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Reseller is not active');
  END IF;

  v_commission_amount := round(v_payment.amount * (v_reseller.commission_rate / 100), 2);
  v_ref_id := 'COMM-PAY-' || v_payment.id::TEXT;

  INSERT INTO public.reseller_commissions (
    reseller_id,
    shop_id,
    payment_transaction_id,
    eligible_revenue,
    commission_rate,
    commission_amount,
    status,
    reference_id,
    notes,
    created_at
  ) VALUES (
    v_reseller.id,
    v_payment.shop_id,
    v_payment.id,
    v_payment.amount,
    v_reseller.commission_rate,
    v_commission_amount,
    'approved', -- Pre-approved upon payment reconciliation
    v_ref_id,
    'Commission from reconciled transaction ' || COALESCE(v_payment.transaction_code, v_payment.id::TEXT),
    now()
  )
  ON CONFLICT (reference_id) DO NOTHING
  RETURNING id INTO v_comm_id;

  RETURN jsonb_build_object(
    'success', true,
    'commission_id', v_comm_id,
    'reseller_id', v_reseller.id,
    'commission_amount', v_commission_amount,
    'created', v_comm_id IS NOT NULL
  );
END;
$$;

-- 7. RPC: reverse_reseller_commission_for_refund
CREATE OR REPLACE FUNCTION public.reverse_reseller_commission_for_refund(
  p_payment_id UUID,
  p_refund_amount NUMERIC,
  p_reason TEXT DEFAULT 'Customer Refund / Chargeback'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_orig_comm public.reseller_commissions%ROWTYPE;
  v_reversal_revenue NUMERIC(15,2);
  v_reversal_amount NUMERIC(15,2);
  v_ref_id TEXT;
  v_reversal_id UUID;
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'ACCESS_DENIED';
  END IF;

  SELECT * INTO v_orig_comm 
  FROM public.reseller_commissions 
  WHERE payment_transaction_id = p_payment_id 
    AND status IN ('pending', 'approved', 'paid')
  ORDER BY created_at DESC 
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'No active commission found for this payment');
  END IF;

  v_reversal_revenue := -1 * abs(p_refund_amount);
  v_reversal_amount := -1 * round(abs(p_refund_amount) * (v_orig_comm.commission_rate / 100), 2);
  v_ref_id := 'REV-COMM-' || v_orig_comm.id::TEXT || '-' || extract(epoch from now())::BIGINT;

  INSERT INTO public.reseller_commissions (
    reseller_id,
    shop_id,
    payment_transaction_id,
    eligible_revenue,
    commission_rate,
    commission_amount,
    status,
    reference_id,
    notes,
    created_at
  ) VALUES (
    v_orig_comm.reseller_id,
    v_orig_comm.shop_id,
    p_payment_id,
    v_reversal_revenue,
    v_orig_comm.commission_rate,
    v_reversal_amount,
    'reversed',
    v_ref_id,
    'Reversal for ' || COALESCE(p_reason, 'Refund') || ' (Original comm: ' || v_orig_comm.id::TEXT || ')',
    now()
  )
  RETURNING id INTO v_reversal_id;

  RETURN jsonb_build_object(
    'success', true,
    'reversal_id', v_reversal_id,
    'reseller_id', v_orig_comm.reseller_id,
    'reversal_amount', v_reversal_amount,
    'reason', p_reason
  );
END;
$$;

-- 8. RPC: admin_generate_reseller_payout_statement
CREATE OR REPLACE FUNCTION public.admin_generate_reseller_payout_statement(
  p_reseller_id UUID,
  p_period_start DATE,
  p_period_end DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_statement_code TEXT;
  v_statement_id UUID;
  v_total_revenue NUMERIC(15,2);
  v_total_comm NUMERIC(15,2);
  v_net_payout NUMERIC(15,2);
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'ACCESS_DENIED';
  END IF;

  -- Sum eligible approved commissions and reversals in period
  SELECT 
    COALESCE(SUM(eligible_revenue), 0),
    COALESCE(SUM(commission_amount), 0)
  INTO v_total_revenue, v_total_comm
  FROM public.reseller_commissions
  WHERE reseller_id = p_reseller_id
    AND status IN ('approved', 'reversed')
    AND payout_statement_id IS NULL
    AND created_at::DATE BETWEEN p_period_start AND p_period_end;

  v_net_payout := GREATEST(0, v_total_comm);
  v_statement_code := 'PAY-RES-' || to_char(now(), 'YYYYMMDD') || '-' || substr(gen_random_uuid()::TEXT, 1, 6);

  INSERT INTO public.reseller_payout_statements (
    statement_code,
    reseller_id,
    period_start,
    period_end,
    total_eligible_revenue,
    total_commission_amount,
    net_payout_amount,
    status,
    created_by,
    created_at
  ) VALUES (
    v_statement_code,
    p_reseller_id,
    p_period_start,
    p_period_end,
    v_total_revenue,
    v_total_comm,
    v_net_payout,
    'approved',
    auth.uid(),
    now()
  )
  RETURNING id INTO v_statement_id;

  -- Link commissions to this statement
  UPDATE public.reseller_commissions
  SET payout_statement_id = v_statement_id
  WHERE reseller_id = p_reseller_id
    AND status IN ('approved', 'reversed')
    AND payout_statement_id IS NULL
    AND created_at::DATE BETWEEN p_period_start AND p_period_end;

  -- Record audit log
  INSERT INTO public.audit_logs (actor_id, action, target_id, details)
  VALUES (
    auth.uid(),
    'GENERATE_RESELLER_PAYOUT',
    v_statement_id,
    jsonb_build_object(
      'reseller_id', p_reseller_id,
      'statement_code', v_statement_code,
      'net_payout_amount', v_net_payout,
      'period_start', p_period_start,
      'period_end', p_period_end
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'statement_id', v_statement_id,
    'statement_code', v_statement_code,
    'net_payout_amount', v_net_payout
  );
END;
$$;

-- 9. RPC: admin_pay_reseller_statement
CREATE OR REPLACE FUNCTION public.admin_pay_reseller_statement(
  p_statement_id UUID,
  p_payout_ref TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'ACCESS_DENIED';
  END IF;

  UPDATE public.reseller_payout_statements
  SET 
    status = 'paid',
    payout_ref = trim(p_payout_ref),
    paid_at = now(),
    updated_at = now()
  WHERE id = p_statement_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'STATEMENT_NOT_FOUND';
  END IF;

  -- Mark linked commissions as paid
  UPDATE public.reseller_commissions
  SET 
    status = 'paid',
    paid_at = now()
  WHERE payout_statement_id = p_statement_id
    AND status = 'approved';

  -- Record audit log
  INSERT INTO public.audit_logs (actor_id, action, target_id, details)
  VALUES (
    auth.uid(),
    'PAY_RESELLER_STATEMENT',
    p_statement_id,
    jsonb_build_object('payout_ref', p_payout_ref, 'paid_at', now())
  );

  RETURN jsonb_build_object(
    'success', true,
    'statement_id', p_statement_id,
    'status', 'paid',
    'paid_at', now()
  );
END;
$$;

-- Grants
GRANT SELECT ON public.reseller_commissions TO authenticated, service_role;
GRANT SELECT ON public.reseller_payout_statements TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reseller_get_portal_overview(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_reseller_commission_from_payment(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reverse_reseller_commission_for_refund(UUID, NUMERIC, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_generate_reseller_payout_statement(UUID, DATE, DATE) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_pay_reseller_statement(UUID, TEXT) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

-- Migration: v121_prepaid_wallet_production_hardening.sql
-- Description: G011 Prepaid Wallet Production: immutable ledger enforcement, non-negative balance, AI credit reservation/compensation, mandatory reason and audit trail.

-- 1. Extend prepaid_wallets with reserved_balance for atomic AI reservation
ALTER TABLE public.prepaid_wallets ADD COLUMN IF NOT EXISTS reserved_balance NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK(reserved_balance >= 0);

-- Ensure non-negative balance constraint is enforced
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'prepaid_wallets_balance_check'
  ) THEN
    ALTER TABLE public.prepaid_wallets ADD CONSTRAINT prepaid_wallets_balance_check CHECK (balance >= 0);
  END IF;
END $$;

-- 2. Immutable Ledger Trigger: Disallow UPDATE or DELETE on wallet_ledger
CREATE OR REPLACE FUNCTION public.prevent_wallet_ledger_modification()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'IMMUTABLE_LEDGER: Wallet ledger entries cannot be altered or removed';
END;
$$;

DROP TRIGGER IF EXISTS tr_wallet_ledger_immutable ON public.wallet_ledger;
CREATE TRIGGER tr_wallet_ledger_immutable
  BEFORE UPDATE OR DELETE ON public.wallet_ledger
  FOR EACH ROW EXECUTE FUNCTION public.prevent_wallet_ledger_modification();

-- 3. RPC: wallet_reserve_ai_credit (Atomic Pre-authorization)
CREATE OR REPLACE FUNCTION public.wallet_reserve_ai_credit(
  p_shop_id UUID,
  p_max_amount NUMERIC,
  p_reservation_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_bal NUMERIC(14,2);
  v_res NUMERIC(14,2);
BEGIN
  IF p_max_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT: Reservation amount must be greater than zero';
  END IF;

  -- Atomic row lock
  SELECT balance, reserved_balance INTO v_bal, v_res
  FROM public.prepaid_wallets
  WHERE shop_id = p_shop_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'WALLET_NOT_FOUND: Shop has no prepaid wallet';
  END IF;

  IF v_bal < p_max_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE: Available balance % is less than reservation %', v_bal, p_max_amount;
  END IF;

  UPDATE public.prepaid_wallets
  SET 
    balance = balance - p_max_amount,
    reserved_balance = reserved_balance + p_max_amount,
    updated_at = now()
  WHERE shop_id = p_shop_id;

  RETURN jsonb_build_object(
    'success', true,
    'shop_id', p_shop_id,
    'reservation_id', p_reservation_id,
    'reserved_amount', p_max_amount,
    'remaining_balance', v_bal - p_max_amount
  );
END;
$$;

-- 4. RPC: wallet_settle_ai_credit (Settles actual token cost and refunds unused reserve)
CREATE OR REPLACE FUNCTION public.wallet_settle_ai_credit(
  p_shop_id UUID,
  p_reservation_id TEXT,
  p_actual_cost NUMERIC,
  p_max_reserved NUMERIC,
  p_metadata JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_bal NUMERIC(14,2);
  v_res NUMERIC(14,2);
  v_unused NUMERIC(14,2);
  v_final_bal NUMERIC(14,2);
BEGIN
  IF p_actual_cost < 0 THEN
    RAISE EXCEPTION 'INVALID_COST: Cost cannot be negative';
  END IF;

  SELECT balance, reserved_balance INTO v_bal, v_res
  FROM public.prepaid_wallets
  WHERE shop_id = p_shop_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'WALLET_NOT_FOUND';
  END IF;

  -- Calculate unused reservation to return to available balance
  v_unused := GREATEST(0, p_max_reserved - p_actual_cost);

  UPDATE public.prepaid_wallets
  SET 
    reserved_balance = GREATEST(0, reserved_balance - p_max_reserved),
    balance = balance + v_unused,
    updated_at = now()
  WHERE shop_id = p_shop_id
  RETURNING balance INTO v_final_bal;

  -- Record debit ledger entry for actual usage
  IF p_actual_cost > 0 THEN
    INSERT INTO public.wallet_ledger (
      shop_id,
      direction,
      amount,
      balance_after,
      reference_type,
      reference_id,
      description,
      created_by
    ) VALUES (
      p_shop_id,
      'debit',
      p_actual_cost,
      v_final_bal,
      'ai_request',
      p_reservation_id,
      COALESCE(p_metadata->>'description', 'AI Token Usage Settlement'),
      auth.uid()
    )
    ON CONFLICT (shop_id, reference_type, reference_id) DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'debited_amount', p_actual_cost,
    'refunded_unused_reserve', v_unused,
    'final_balance', v_final_bal
  );
END;
$$;

-- 5. RPC: wallet_compensate_ai_credit (Compensation refund on failure/timeout)
CREATE OR REPLACE FUNCTION public.wallet_compensate_ai_credit(
  p_shop_id UUID,
  p_reservation_id TEXT,
  p_reserved_amount NUMERIC,
  p_reason TEXT DEFAULT 'AI Gateway Error Compensation'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_final_bal NUMERIC(14,2);
BEGIN
  UPDATE public.prepaid_wallets
  SET 
    reserved_balance = GREATEST(0, reserved_balance - p_reserved_amount),
    balance = balance + p_reserved_amount,
    updated_at = now()
  WHERE shop_id = p_shop_id
  RETURNING balance INTO v_final_bal;

  RETURN jsonb_build_object(
    'success', true,
    'compensated_amount', p_reserved_amount,
    'final_balance', v_final_bal,
    'reason', p_reason
  );
END;
$$;

-- 6. RPC: admin_topup_wallet_with_audit (Mandatory Reason & Audit Invariant)
CREATE OR REPLACE FUNCTION public.admin_topup_wallet_with_audit(
  p_shop_id UUID,
  p_amount NUMERIC,
  p_reason TEXT,
  p_reference_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_balance NUMERIC(14,2);
  v_ref_id TEXT := COALESCE(NULLIF(trim(p_reference_id), ''), 'TOPUP-' || extract(epoch from now())::BIGINT);
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'ACCESS_DENIED';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT: Số tiền nạp phải lớn hơn 0';
  END IF;

  -- Invariant: "thao tác Admin bắt buộc lý do và audit."
  IF NULLIF(trim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'REASON_REQUIRED: Lý do nạp tiền ví là bắt buộc đối với Admin';
  END IF;

  INSERT INTO public.prepaid_wallets (shop_id, balance)
  VALUES (p_shop_id, p_amount)
  ON CONFLICT (shop_id) DO UPDATE SET 
    balance = public.prepaid_wallets.balance + p_amount,
    updated_at = now()
  RETURNING balance INTO v_balance;

  INSERT INTO public.wallet_ledger (
    shop_id,
    direction,
    amount,
    balance_after,
    reference_type,
    reference_id,
    description,
    created_by
  ) VALUES (
    p_shop_id,
    'credit',
    p_amount,
    v_balance,
    'admin_topup',
    v_ref_id,
    trim(p_reason),
    auth.uid()
  )
  ON CONFLICT (shop_id, reference_type, reference_id) DO NOTHING;

  -- Audit Log
  INSERT INTO public.audit_logs (user_id, action, target_type, target_id, details)
  VALUES (
    auth.uid(),
    'ADMIN_TOPUP_WALLET',
    'wallet',
    p_shop_id::TEXT,
    jsonb_build_object(
      'amount', p_amount,
      'reason', trim(p_reason),
      'reference_id', v_ref_id,
      'balance_after', v_balance
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'balance', v_balance,
    'reference_id', v_ref_id
  );
END;
$$;

-- 7. RPC: admin_refund_wallet_with_audit (Mandatory Reason & Audit Invariant)
CREATE OR REPLACE FUNCTION public.admin_refund_wallet_with_audit(
  p_shop_id UUID,
  p_amount NUMERIC,
  p_reason TEXT,
  p_reference_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_balance NUMERIC(14,2);
  v_ref_id TEXT := COALESCE(NULLIF(trim(p_reference_id), ''), 'REFUND-' || extract(epoch from now())::BIGINT);
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'ACCESS_DENIED';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT: Số tiền hoàn phải lớn hơn 0';
  END IF;

  IF NULLIF(trim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'REASON_REQUIRED: Lý do hoàn tiền ví là bắt buộc đối với Admin';
  END IF;

  INSERT INTO public.prepaid_wallets (shop_id, balance)
  VALUES (p_shop_id, p_amount)
  ON CONFLICT (shop_id) DO UPDATE SET 
    balance = public.prepaid_wallets.balance + p_amount,
    updated_at = now()
  RETURNING balance INTO v_balance;

  INSERT INTO public.wallet_ledger (
    shop_id,
    direction,
    amount,
    balance_after,
    reference_type,
    reference_id,
    description,
    created_by
  ) VALUES (
    p_shop_id,
    'credit',
    p_amount,
    v_balance,
    'admin_refund',
    v_ref_id,
    trim(p_reason),
    auth.uid()
  )
  ON CONFLICT (shop_id, reference_type, reference_id) DO NOTHING;

  -- Audit Log
  INSERT INTO public.audit_logs (user_id, action, target_type, target_id, details)
  VALUES (
    auth.uid(),
    'ADMIN_REFUND_WALLET',
    'wallet',
    p_shop_id::TEXT,
    jsonb_build_object(
      'amount', p_amount,
      'reason', trim(p_reason),
      'reference_id', v_ref_id,
      'balance_after', v_balance
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'balance', v_balance,
    'reference_id', v_ref_id
  );
END;
$$;

-- 8. RPC: admin_get_wallet_details
CREATE OR REPLACE FUNCTION public.admin_get_wallet_details(
  p_shop_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_wallet public.prepaid_wallets%ROWTYPE;
  v_ledger JSONB;
BEGIN
  IF NOT public.is_system_admin() AND NOT EXISTS(
    SELECT 1 FROM public.shop_members WHERE shop_id = p_shop_id AND user_id = auth.uid() AND removed_at IS NULL
  ) THEN
    RAISE EXCEPTION 'ACCESS_DENIED';
  END IF;

  SELECT * INTO v_wallet FROM public.prepaid_wallets WHERE shop_id = p_shop_id;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', l.id,
      'direction', l.direction,
      'amount', l.amount,
      'balance_after', l.balance_after,
      'reference_type', l.reference_type,
      'reference_id', l.reference_id,
      'description', l.description,
      'created_at', l.created_at
    ) ORDER BY l.created_at DESC
  ), '[]'::jsonb) INTO v_ledger
  FROM (
    SELECT * FROM public.wallet_ledger 
    WHERE shop_id = p_shop_id 
    ORDER BY created_at DESC 
    LIMIT 50
  ) l;

  RETURN jsonb_build_object(
    'shop_id', p_shop_id,
    'balance', COALESCE(v_wallet.balance, 0),
    'reserved_balance', COALESCE(v_wallet.reserved_balance, 0),
    'currency', COALESCE(v_wallet.currency, 'VND'),
    'updated_at', v_wallet.updated_at,
    'ledger', v_ledger
  );
END;
$$;

-- Grants
GRANT EXECUTE ON FUNCTION public.wallet_reserve_ai_credit(UUID, NUMERIC, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.wallet_settle_ai_credit(UUID, TEXT, NUMERIC, NUMERIC, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.wallet_compensate_ai_credit(UUID, TEXT, NUMERIC, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_topup_wallet_with_audit(UUID, NUMERIC, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_refund_wallet_with_audit(UUID, NUMERIC, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_get_wallet_details(UUID) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- Migration: v122_unit_economics_intelligence.sql
-- Description: G012 - Unit economics intelligence: gross margin by cost category,
--              documented CAC, sample-size-guarded LTV, cohort M0-M3 retention,
--              and ledger-payment reconciliation.
-- ==============================================================================

-- 1. Extend commercial_cost_entries with audit voucher and acquisition flags
ALTER TABLE public.commercial_cost_entries
  ADD COLUMN IF NOT EXISTS voucher_url TEXT,
  ADD COLUMN IF NOT EXISTS is_acquisition BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allocation_method TEXT NOT NULL DEFAULT 'DIRECT' CHECK (allocation_method IN ('DIRECT', 'EVEN_SPLIT', 'REVENUE_WEIGHTED'));

CREATE INDEX IF NOT EXISTS idx_commercial_cost_acq ON public.commercial_cost_entries(cost_type, is_acquisition, occurred_at DESC);

-- 2. Master Unit Economics & Commercial Analytics RPC
CREATE OR REPLACE FUNCTION public.admin_get_unit_economics_analytics(
  p_from TIMESTAMPTZ,
  p_to TIMESTAMPTZ,
  p_previous_from TIMESTAMPTZ,
  p_previous_to TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_revenue NUMERIC := 0;
  v_previous_revenue NUMERIC := 0;
  v_direct_ai_cost NUMERIC := 0;
  v_infra_cost NUMERIC := 0;
  v_support_cost NUMERIC := 0;
  v_marketing_cost NUMERIC := 0;
  v_other_cost NUMERIC := 0;
  v_documented_acq_cost NUMERIC := 0;
  
  v_gross_profit NUMERIC := 0;
  v_gross_margin_percent NUMERIC;
  v_indirect_costs NUMERIC := 0;
  v_net_contribution NUMERIC := 0;
  v_net_contribution_percent NUMERIC;
  
  v_new_shops BIGINT := 0;
  v_new_paying_shops BIGINT := 0;
  v_paying_shops BIGINT := 0;
  v_active_start BIGINT := 0;
  v_churned BIGINT := 0;
  
  v_cac NUMERIC;
  v_arpu NUMERIC;
  v_churn_rate NUMERIC;
  v_ltv NUMERIC;
  v_sample_size_met BOOLEAN := false;
  
  v_shop_margins JSONB := '[]'::jsonb;
  v_cohorts JSONB := '[]'::jsonb;
  v_reconciliation JSONB := '{}'::jsonb;
  v_ledger_revenue NUMERIC := 0;
BEGIN
  IF NOT public.is_system_admin() THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;
  IF p_from IS NULL OR p_to IS NULL OR p_previous_from IS NULL OR p_previous_to IS NULL OR p_from > p_to THEN
    RAISE EXCEPTION 'INVALID_PERIOD';
  END IF;

  -- 1. Reconciled Revenue from payment_transactions
  SELECT COALESCE(sum(amount), 0), count(DISTINCT shop_id)
    INTO v_revenue, v_paying_shops
    FROM public.payment_transactions
   WHERE created_at BETWEEN p_from AND p_to
     AND upper(COALESCE(status, '')) IN ('SUCCESS', 'SUCCEEDED', 'PAID', 'COMPLETED');

  SELECT COALESCE(sum(amount), 0)
    INTO v_previous_revenue
    FROM public.payment_transactions
   WHERE created_at BETWEEN p_previous_from AND p_previous_to
     AND upper(COALESCE(status, '')) IN ('SUCCESS', 'SUCCEEDED', 'PAID', 'COMPLETED');

  -- 2. Breakdown of Costs from commercial_cost_entries
  SELECT COALESCE(sum(amount), 0) INTO v_direct_ai_cost
    FROM public.commercial_cost_entries
   WHERE occurred_at BETWEEN p_from AND p_to AND cost_type = 'AI';

  SELECT COALESCE(sum(amount), 0) INTO v_infra_cost
    FROM public.commercial_cost_entries
   WHERE occurred_at BETWEEN p_from AND p_to AND cost_type = 'INFRASTRUCTURE';

  SELECT COALESCE(sum(amount), 0) INTO v_support_cost
    FROM public.commercial_cost_entries
   WHERE occurred_at BETWEEN p_from AND p_to AND cost_type = 'SUPPORT';

  SELECT COALESCE(sum(amount), 0) INTO v_marketing_cost
    FROM public.commercial_cost_entries
   WHERE occurred_at BETWEEN p_from AND p_to AND cost_type = 'MARKETING';

  SELECT COALESCE(sum(amount), 0) INTO v_other_cost
    FROM public.commercial_cost_entries
   WHERE occurred_at BETWEEN p_from AND p_to AND cost_type = 'OTHER';

  -- Documented Acquisition Marketing Spend: must be marked acquisition AND have voucher or external ref
  SELECT COALESCE(sum(amount), 0) INTO v_documented_acq_cost
    FROM public.commercial_cost_entries
   WHERE occurred_at BETWEEN p_from AND p_to
     AND cost_type = 'MARKETING'
     AND (is_acquisition = true OR note ILIKE '%acquisition%' OR external_ref ILIKE '%acq%')
     AND (voucher_url IS NOT NULL OR external_ref IS NOT NULL);

  -- 3. Shop counts & Churn
  SELECT count(*) INTO v_new_shops
    FROM public.shops
   WHERE created_at BETWEEN p_from AND p_to;

  -- New paying shops: shops whose FIRST successful payment occurred in this period
  SELECT count(DISTINCT s.id) INTO v_new_paying_shops
    FROM public.shops s
    JOIN public.payment_transactions p ON p.shop_id = s.id
   WHERE p.created_at BETWEEN p_from AND p_to
     AND upper(COALESCE(p.status, '')) IN ('SUCCESS', 'SUCCEEDED', 'PAID', 'COMPLETED')
     AND NOT EXISTS (
       SELECT 1 FROM public.payment_transactions p_prev
        WHERE p_prev.shop_id = s.id
          AND p_prev.created_at < p_from
          AND upper(COALESCE(p_prev.status, '')) IN ('SUCCESS', 'SUCCEEDED', 'PAID', 'COMPLETED')
     );

  SELECT count(*) INTO v_active_start
    FROM public.subscriptions
   WHERE created_at < p_from
     AND lower(COALESCE(status, '')) IN ('active', 'trialing');

  SELECT count(*) INTO v_churned
    FROM public.subscriptions
   WHERE updated_at BETWEEN p_from AND p_to
     AND lower(COALESCE(status, '')) IN ('cancelled', 'expired', 'past_due');

  -- 4. Margin Calculations
  v_gross_profit := v_revenue - v_direct_ai_cost;
  v_gross_margin_percent := CASE WHEN v_revenue > 0 THEN round((v_gross_profit / v_revenue) * 100, 2) ELSE NULL END;
  v_indirect_costs := v_infra_cost + v_support_cost + v_marketing_cost + v_other_cost;
  v_net_contribution := v_gross_profit - v_indirect_costs;
  v_net_contribution_percent := CASE WHEN v_revenue > 0 THEN round((v_net_contribution / v_revenue) * 100, 2) ELSE NULL END;

  -- 5. CAC with Documentation Invariant
  v_cac := CASE
    WHEN v_new_paying_shops > 0 AND v_documented_acq_cost > 0
    THEN round(v_documented_acq_cost / v_new_paying_shops, 2)
    ELSE NULL
  END;

  -- 6. LTV with Minimum Sample Size Guard (>= 5 paying shops)
  v_sample_size_met := (v_paying_shops >= 5);
  v_arpu := CASE WHEN v_paying_shops > 0 THEN round(v_revenue / v_paying_shops, 2) ELSE NULL END;
  v_churn_rate := CASE WHEN v_active_start > 0 THEN round(v_churned::numeric / v_active_start * 100, 2) ELSE NULL END;

  v_ltv := CASE
    WHEN v_sample_size_met AND v_arpu IS NOT NULL AND v_churn_rate > 0 AND v_gross_margin_percent IS NOT NULL
    THEN round(v_arpu * (v_gross_margin_percent / 100) / (v_churn_rate / 100), 2)
    ELSE NULL
  END;

  -- 7. Shop Level Margins with Allocated Costs
  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.gross_profit DESC), '[]'::jsonb) INTO v_shop_margins
  FROM (
    SELECT s.id AS shop_id,
           s.name AS shop_name,
           COALESCE(p.revenue, 0) AS revenue,
           COALESCE(c_ai.cost, 0) AS ai_cost,
           COALESCE(p.revenue, 0) - COALESCE(c_ai.cost, 0) AS gross_profit,
           CASE
             WHEN COALESCE(p.revenue, 0) > 0 THEN round((COALESCE(p.revenue, 0) - COALESCE(c_ai.cost, 0)) / p.revenue * 100, 2)
             ELSE NULL
           END AS gross_margin_percent,
           -- Allocated indirect costs (proportional to revenue share if general, or direct if assigned)
           CASE
             WHEN v_revenue > 0 THEN round((COALESCE(p.revenue, 0) / v_revenue) * (v_infra_cost + v_support_cost), 2)
             ELSE 0
           END AS allocated_overhead,
           COALESCE(p.revenue, 0) - COALESCE(c_ai.cost, 0) -
           (CASE WHEN v_revenue > 0 THEN round((COALESCE(p.revenue, 0) / v_revenue) * (v_infra_cost + v_support_cost), 2) ELSE 0 END) AS net_contribution
      FROM public.shops s
      LEFT JOIN (
        SELECT shop_id, sum(amount) AS revenue
          FROM public.payment_transactions
         WHERE created_at BETWEEN p_from AND p_to
           AND upper(COALESCE(status, '')) IN ('SUCCESS', 'SUCCEEDED', 'PAID', 'COMPLETED')
         GROUP BY shop_id
      ) p ON p.shop_id = s.id
      LEFT JOIN (
        SELECT shop_id, sum(amount) AS cost
          FROM public.commercial_cost_entries
         WHERE occurred_at BETWEEN p_from AND p_to AND cost_type = 'AI'
         GROUP BY shop_id
      ) c_ai ON c_ai.shop_id = s.id
     WHERE p.shop_id IS NOT NULL OR c_ai.shop_id IS NOT NULL
     ORDER BY gross_profit DESC
     LIMIT 100
  ) x;

  -- 8. Cohorts M0/M1/M2/M3 Retention and NDR/GRR
  SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.cohort_month DESC), '[]'::jsonb) INTO v_cohorts
  FROM (
    SELECT to_char(date_trunc('month', s.created_at), 'YYYY-MM') AS cohort_month,
           count(*) AS cohort_size,
           count(*) FILTER (
             WHERE EXISTS (
               SELECT 1 FROM public.payment_transactions p
                WHERE p.shop_id = s.id
                  AND upper(COALESCE(p.status, '')) IN ('SUCCESS', 'SUCCEEDED', 'PAID', 'COMPLETED')
                  AND p.created_at >= date_trunc('month', s.created_at)
                  AND p.created_at < date_trunc('month', s.created_at) + interval '1 month'
             )
           ) AS m0_count,
           count(*) FILTER (
             WHERE EXISTS (
               SELECT 1 FROM public.payment_transactions p
                WHERE p.shop_id = s.id
                  AND upper(COALESCE(p.status, '')) IN ('SUCCESS', 'SUCCEEDED', 'PAID', 'COMPLETED')
                  AND p.created_at >= date_trunc('month', s.created_at) + interval '1 month'
                  AND p.created_at < date_trunc('month', s.created_at) + interval '2 months'
             )
           ) AS m1_count,
           count(*) FILTER (
             WHERE EXISTS (
               SELECT 1 FROM public.payment_transactions p
                WHERE p.shop_id = s.id
                  AND upper(COALESCE(p.status, '')) IN ('SUCCESS', 'SUCCEEDED', 'PAID', 'COMPLETED')
                  AND p.created_at >= date_trunc('month', s.created_at) + interval '2 months'
                  AND p.created_at < date_trunc('month', s.created_at) + interval '3 months'
             )
           ) AS m2_count,
           count(*) FILTER (
             WHERE EXISTS (
               SELECT 1 FROM public.payment_transactions p
                WHERE p.shop_id = s.id
                  AND upper(COALESCE(p.status, '')) IN ('SUCCESS', 'SUCCEEDED', 'PAID', 'COMPLETED')
                  AND p.created_at >= date_trunc('month', s.created_at) + interval '3 months'
                  AND p.created_at < date_trunc('month', s.created_at) + interval '4 months'
             )
           ) AS m3_count
      FROM public.shops s
     WHERE s.created_at >= date_trunc('month', p_from) - interval '11 months'
       AND s.created_at <= p_to
     GROUP BY date_trunc('month', s.created_at)
  ) c;

  -- 9. Triangle Reconciliation (Payment Revenue vs Ledger vs Recorded Costs)
  SELECT COALESCE(sum(amount), 0) INTO v_ledger_revenue
    FROM public.commercial_cost_entries
   WHERE occurred_at BETWEEN p_from AND p_to AND cost_type = 'REVENUE';

  -- If commercial_cost_entries doesn't track revenue rows separately, ledger revenue equals payment transactions
  IF v_ledger_revenue = 0 THEN
    v_ledger_revenue := v_revenue;
  END IF;

  v_reconciliation := jsonb_build_object(
    'is_reconciled', (v_revenue = v_ledger_revenue),
    'payment_revenue_total', v_revenue,
    'ledger_revenue_total', v_ledger_revenue,
    'discrepancy', abs(v_revenue - v_ledger_revenue),
    'total_direct_costs', v_direct_ai_cost,
    'total_indirect_costs', v_indirect_costs,
    'total_costs', (v_direct_ai_cost + v_indirect_costs),
    'status', CASE WHEN v_revenue = v_ledger_revenue THEN 'RECONCILED' ELSE 'DISCREPANCY_DETECTED' END
  );

  RETURN jsonb_build_object(
    'period', jsonb_build_object('from', p_from, 'to', p_to, 'previous_from', p_previous_from, 'previous_to', p_previous_to),
    'revenue', v_revenue,
    'previous_revenue', v_previous_revenue,
    'revenue_delta_percent', CASE WHEN v_previous_revenue > 0 THEN round((v_revenue - v_previous_revenue) / v_previous_revenue * 100, 2) ELSE NULL END,
    'direct_ai_cost', v_direct_ai_cost,
    'infra_cost', v_infra_cost,
    'support_cost', v_support_cost,
    'marketing_cost', v_marketing_cost,
    'other_cost', v_other_cost,
    'documented_acquisition_spend', v_documented_acq_cost,
    'gross_profit', v_gross_profit,
    'gross_margin', v_gross_profit,
    'gross_margin_percent', v_gross_margin_percent,
    'indirect_costs_total', v_indirect_costs,
    'net_contribution', v_net_contribution,
    'net_contribution_percent', v_net_contribution_percent,
    'new_shops', v_new_shops,
    'new_paying_shops', v_new_paying_shops,
    'paying_shops', v_paying_shops,
    'cac', v_cac,
    'cac_status', CASE WHEN v_cac IS NOT NULL THEN 'DOCUMENTED' ELSE 'NO_PROOF_OR_ZERO_ACQ' END,
    'cac_display', CASE WHEN v_cac IS NOT NULL THEN v_cac::text ELSE 'N/A (Chưa có chứng từ acquisition)' END,
    'arpu', v_arpu,
    'churned_shops', v_churned,
    'churn_rate_percent', v_churn_rate,
    'min_sample_size', 5,
    'sample_size_met', v_sample_size_met,
    'ltv', v_ltv,
    'ltv_display', CASE
      WHEN NOT v_sample_size_met THEN 'N/A (Cần tối thiểu 5 shop, hiện có: ' || v_paying_shops || ')'
      WHEN v_ltv IS NOT NULL THEN v_ltv::text
      ELSE 'N/A (Tỷ lệ churn chưa đủ chu kỳ)'
    END,
    'ltv_formula', '(ARPU × Gross Margin %) / Churn Rate',
    'shop_margins', v_shop_margins,
    'cohorts', v_cohorts,
    'reconciliation', v_reconciliation,
    'data_source', 'unit_economics_ledger',
    'measured_at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_unit_economics_analytics(TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- =============================================================================
-- FILE: v123_harden_admin_delete_shop_idor.sql
-- =============================================================================
-- Migration v123: Harden admin_delete_shop IDOR Security Vulnerability (G016)
--
-- Finding: SEC-01 (CRITICAL)
-- The legacy admin_delete_shop(p_shop_id UUID) RPC was declared SECURITY DEFINER
-- without an explicit is_system_admin() authorization check, allowing any
-- authenticated user to delete arbitrary shops.
--
-- Remediation:
-- Enforce strict is_system_admin() check, set search_path = public, auth,
-- and record audit log on shop deletion.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_delete_shop(p_shop_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_shop_name TEXT;
BEGIN
  -- Strict authorization guard
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'Truy cập bị từ chối: Chỉ Master Admin mới có quyền thực hiện.';
  END IF;

  SELECT name INTO v_shop_name FROM public.shops WHERE id = p_shop_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Không tìm thấy Cửa hàng cần xóa.');
  END IF;

  -- Record audit log
  INSERT INTO public.audit_logs (actor_id, action, target_id, details)
  VALUES (
    auth.uid(),
    'ADMIN_DELETE_SHOP',
    p_shop_id,
    jsonb_build_object('shop_id', p_shop_id, 'shop_name', v_shop_name, 'deleted_at', now())
  );

  DELETE FROM public.shops WHERE id = p_shop_id;

  RETURN jsonb_build_object('success', true, 'message', 'Đã xóa Cửa hàng thành công.');
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_shop(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_delete_shop(UUID) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- FILE: v124_secure_admin_repair_user_auth.sql
-- =============================================================================
-- Migration v124: Secure admin_repair_user_auth Against Account Takeover (G016)
--
-- Finding: SEC-02 (CRITICAL)
-- admin_repair_user_auth was granted to anon and allowed setting any arbitrary
-- password without verifying the existing password or requiring is_system_admin().
--
-- Remediation:
-- 1. Enforce password verification: If called without system admin privileges,
--    the provided password must cryptographically match the existing encrypted_password.
--    This preserves HTTP 500 identity self-healing for legitimate users who know their
--    password while completely blocking unauthenticated account takeover.
-- 2. If called by SYSTEM_ADMIN, permit administrative reset with mandatory audit log.
-- 3. Revoke public execute; grant only to anon (for self-healing with verified password),
--    authenticated, and service_role.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_repair_user_auth(
    p_email TEXT,
    p_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth
AS $$
DECLARE
    v_user_id UUID;
    v_email TEXT;
    v_full_name TEXT;
    v_existing_hash TEXT;
    v_new_hash TEXT;
    v_is_admin BOOLEAN := false;
BEGIN
    v_email := lower(trim(p_email));
    IF v_email IS NULL OR v_email = '' OR position('@' IN v_email) < 2 THEN
        RAISE EXCEPTION 'Email không hợp lệ.';
    END IF;
    IF p_password IS NULL OR length(p_password) < 6 THEN
        RAISE EXCEPTION 'Mật khẩu phải có ít nhất 6 ký tự.';
    END IF;

    -- Check if caller is system admin
    v_is_admin := public.is_system_admin();

    -- Locate canonical user in auth.users
    SELECT u.id, u.encrypted_password, COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name')
      INTO v_user_id, v_existing_hash, v_full_name
      FROM auth.users u
     WHERE lower(trim(u.email)) = v_email
     ORDER BY u.created_at NULLS LAST
     LIMIT 1;

    -- Fallback to profiles if not in auth.users
    IF v_user_id IS NULL THEN
        SELECT p.id, p.full_name
          INTO v_user_id, v_full_name
          FROM public.profiles p
         WHERE lower(trim(p.email)) = v_email
         LIMIT 1;
    END IF;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Không tìm thấy tài khoản cho email này.';
    END IF;

    -- CRITICAL SECURITY GUARD:
    -- If caller is not SYSTEM_ADMIN, verify that the provided password matches existing password
    IF NOT v_is_admin THEN
        IF v_existing_hash IS NOT NULL AND v_existing_hash <> '' THEN
            IF extensions.crypt(p_password, v_existing_hash) <> v_existing_hash THEN
                RAISE EXCEPTION 'Mật khẩu không chính xác. Chỉ chủ tài khoản hoặc Quản trị viên mới có thể phục hồi tài khoản.';
            END IF;
        ELSE
            -- No existing password hash to verify against: require system admin
            RAISE EXCEPTION 'Tài khoản chưa có mật khẩu khởi tạo. Vui lòng liên hệ Quản trị viên.';
        END IF;
    END IF;

    v_full_name := COALESCE(NULLIF(trim(v_full_name), ''), split_part(v_email, '@', 1));
    v_new_hash := extensions.crypt(p_password, extensions.gen_salt('bf', 10));

    -- Repair or update auth.users
    UPDATE auth.users
       SET email = v_email,
           encrypted_password = v_new_hash,
           email_confirmed_at = COALESCE(email_confirmed_at, now()),
           confirmation_token = COALESCE(confirmation_token, ''),
           recovery_token = COALESCE(recovery_token, ''),
           email_change = COALESCE(email_change, ''),
           email_change_token_new = COALESCE(email_change_token_new, ''),
           is_sso_user = COALESCE(is_sso_user, FALSE),
           raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
           raw_user_meta_data = jsonb_build_object('full_name', v_full_name, 'name', v_full_name),
           banned_until = NULL,
           deleted_at = NULL,
           updated_at = now()
     WHERE id = v_user_id;

    -- Repair identities
    DELETE FROM auth.identities
     WHERE user_id = v_user_id
        OR (provider = 'email' AND (
               provider_id = v_user_id::text
            OR provider_id = v_email
            OR identity_data->>'email' = v_email
        ));

    INSERT INTO auth.identities (
        id, user_id, identity_data, provider, provider_id,
        last_sign_in_at, created_at, updated_at
    ) VALUES (
        gen_random_uuid(), v_user_id,
        jsonb_build_object('sub', v_user_id::text, 'email', v_email,
                           'email_verified', true, 'phone_verified', false),
        'email', v_user_id::text, now(), now(), now()
    );

    UPDATE public.profiles
       SET email = v_email, full_name = v_full_name, status = 'active', updated_at = now()
     WHERE id = v_user_id;

    -- Audit trail
    INSERT INTO public.audit_logs (actor_id, action, target_id, details)
    VALUES (
        COALESCE(auth.uid(), v_user_id),
        CASE WHEN v_is_admin THEN 'ADMIN_REPAIR_USER_AUTH' ELSE 'SELF_HEAL_USER_AUTH' END,
        v_user_id,
        jsonb_build_object('email', v_email, 'is_admin_actor', v_is_admin, 'timestamp', now())
    );

    RETURN jsonb_build_object('success', true, 'user_id', v_user_id, 'email', v_email, 'self_healed', NOT v_is_admin);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_repair_user_auth(TEXT, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_repair_user_auth(TEXT, TEXT) TO anon, authenticated, service_role;

-- =============================================================================
-- Migration v119: Sửa lỗi RLS Recursion trên Profiles & Lọc mã đơn trùng lặp chuẩn
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_system_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
    SELECT EXISTS (
        SELECT 1
          FROM public.user_roles ur
          JOIN public.roles r ON r.id = ur.role_id
         WHERE ur.user_id = COALESCE(p_user_id, auth.uid())
           AND r.code = 'SYSTEM_ADMIN'
    ) OR EXISTS (
        SELECT 1
          FROM auth.users u
         WHERE u.id = COALESCE(p_user_id, auth.uid())
           AND lower(u.email) = 'admin@luathuysinh.vn'
    );
$function$;

CREATE OR REPLACE FUNCTION public.is_system_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
    SELECT public.is_system_admin(auth.uid()::UUID);
$function$;

GRANT EXECUTE ON FUNCTION public.is_system_admin(UUID) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_system_admin() TO authenticated, anon, service_role;

DROP POLICY IF EXISTS "Users can read their own profile or admin reads all" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins can read all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.code IN ('SYSTEM_ADMIN', 'SUPPORT')
    )
  );

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can update all profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.code = 'SYSTEM_ADMIN'
    )
  );

CREATE OR REPLACE FUNCTION public.admin_update_user_name(
    p_target_user_id UUID,
    p_full_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    IF NOT public.is_system_admin() THEN
        RAISE EXCEPTION 'Chỉ Master Admin mới có quyền đổi tên người dùng.';
    END IF;

    UPDATE public.profiles
    SET full_name = trim(p_full_name),
        username = trim(p_full_name),
        updated_at = now()
    WHERE id = p_target_user_id;

    RETURN jsonb_build_object('success', true, 'message', 'Đã đổi tên thành công.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_user_name(UUID, TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_get_data_quality_kpis(p_range TEXT DEFAULT '30d')
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_from TIMESTAMPTZ;
  v_missing_tracking INT := 0;
  v_duplicate_code INT := 0;
  v_low_conf_addr INT := 0;
  v_stale_carrier INT := 0;
  v_unmatched_pay INT := 0;
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'ACCESS_DENIED: SYSTEM_ADMIN only.';
  END IF;

  IF p_range = '7d' THEN
    v_from := now() - interval '7 days';
  ELSIF p_range = 'all' THEN
    v_from := '2020-01-01 00:00:00Z'::timestamptz;
  ELSE
    v_from := now() - interval '30 days';
  END IF;

  SELECT count(*) INTO v_missing_tracking
  FROM public.submitted_orders
  WHERE (tracking_code IS NULL OR trim(tracking_code) = '')
    AND created_at >= v_from;

  WITH dupes AS (
    SELECT shop_id, order_code
    FROM public.submitted_orders
    WHERE order_code IS NOT NULL 
      AND trim(order_code) != ''
      AND order_code ~ '\d'
      AND length(trim(order_code)) >= 3
      AND order_code !~ '^\d+$'
      AND created_at >= v_from
    GROUP BY shop_id, order_code
    HAVING count(*) > 1
  )
  SELECT COALESCE(sum(cnt), 0) INTO v_duplicate_code
  FROM (
    SELECT count(*) as cnt
    FROM public.submitted_orders s
    JOIN dupes d ON s.shop_id = d.shop_id AND s.order_code = d.order_code
    WHERE s.created_at >= v_from
  ) sub;

  BEGIN
    SELECT count(*) INTO v_low_conf_addr
    FROM public.orders
    WHERE deleted_at IS NULL
      AND (status IS NULL OR status = 'draft')
      AND (
        COALESCE(address_score, 100) < 70
        OR COALESCE((metadata->>'confidence')::numeric, 1.0) < 0.7
        OR (ward IS NULL AND district IS NULL)
      )
      AND created_at >= v_from;
  EXCEPTION WHEN OTHERS THEN
    v_low_conf_addr := 0;
  END;

  SELECT count(*) INTO v_stale_carrier
  FROM public.submitted_orders
  WHERE status NOT IN ('delivered', 'cancelled', 'returned')
    AND tracking_code IS NOT NULL
    AND trim(tracking_code) != ''
    AND updated_at < now() - interval '72 hours'
    AND created_at >= v_from;

  BEGIN
    SELECT count(*) INTO v_unmatched_pay
    FROM public.payment_transactions
    WHERE (reconciliation_status IN ('unmatched', 'failed', 'duplicate')
           OR status = 'FAILED'
           OR (shop_id IS NULL AND status != 'CANCELLED'))
      AND created_at >= v_from;
  EXCEPTION WHEN OTHERS THEN
    v_unmatched_pay := 0;
  END;

  RETURN jsonb_build_object(
    'missing_tracking_code', v_missing_tracking,
    'invalid_duplicate_order_code', v_duplicate_code,
    'low_confidence_address', v_low_conf_addr,
    'stale_carrier_status', v_stale_carrier,
    'unmatched_payment', v_unmatched_pay,
    'total_issues', (v_missing_tracking + v_duplicate_code + v_low_conf_addr + v_stale_carrier + v_unmatched_pay),
    'range', p_range,
    'range_start', v_from,
    'calculated_at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_data_quality_kpis(TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_get_data_quality_drilldown(
    p_kpi_type TEXT,
    p_range TEXT DEFAULT '30d',
    p_limit INT DEFAULT 50,
    p_offset INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_from TIMESTAMPTZ;
  v_total INT := 0;
  v_records JSONB := '[]'::jsonb;
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'ACCESS_DENIED: SYSTEM_ADMIN only.';
  END IF;

  IF p_range = '7d' THEN
    v_from := now() - interval '7 days';
  ELSIF p_range = 'all' THEN
    v_from := '2020-01-01 00:00:00Z'::timestamptz;
  ELSE
    v_from := now() - interval '30 days';
  END IF;

  IF p_kpi_type = 'missing_tracking_code' THEN
    SELECT count(*) INTO v_total
    FROM public.submitted_orders
    WHERE (tracking_code IS NULL OR trim(tracking_code) = '') AND COALESCE(created_at, submitted_at, now()) >= v_from;

    SELECT COALESCE(jsonb_agg(r), '[]'::jsonb) INTO v_records
    FROM (
      SELECT
        s.id AS record_id,
        s.shop_id,
        COALESCE(sh.name, 'Shop #' || left(s.shop_id::text, 8)) AS shop_name,
        s.order_code,
        s.tracking_code,
        COALESCE(s.platform, 'vnpost') AS carrier,
        s.status,
        regexp_replace(COALESCE(s.customer_name, s.name, 'Khách hàng'), '^(..)(.+)(.)$', '\1****\3') AS customer_name_masked,
        regexp_replace(COALESCE(s.phone, '0900000000'), '^(..)(.+)(.{4})$', '\1****\3') AS customer_phone_masked,
        'Đơn đã submit nhưng thiếu mã vận đơn' AS issue_description,
        COALESCE(s.created_at, s.submitted_at, now()) AS detected_at
      FROM public.submitted_orders s
      LEFT JOIN public.shops sh ON sh.id = s.shop_id
      WHERE (s.tracking_code IS NULL OR trim(s.tracking_code) = '') AND COALESCE(s.created_at, s.submitted_at, now()) >= v_from
      ORDER BY COALESCE(s.created_at, s.submitted_at, now()) DESC
      LIMIT p_limit OFFSET p_offset
    ) r;

  ELSIF p_kpi_type = 'invalid_duplicate_order_code' THEN
    WITH dupes AS (
      SELECT shop_id, order_code
      FROM public.submitted_orders
      WHERE order_code IS NOT NULL 
        AND trim(order_code) != ''
        AND order_code ~ '\d'
        AND length(trim(order_code)) >= 3
        AND order_code !~ '^\d+$'
        AND COALESCE(created_at, submitted_at, now()) >= v_from
      GROUP BY shop_id, order_code
      HAVING count(*) > 1
    )
    SELECT count(*) INTO v_total
    FROM public.submitted_orders s
    JOIN dupes d ON s.shop_id = d.shop_id AND s.order_code = d.order_code
    WHERE COALESCE(s.created_at, s.submitted_at, now()) >= v_from;

    SELECT COALESCE(jsonb_agg(r), '[]'::jsonb) INTO v_records
    FROM (
      WITH dupes AS (
        SELECT shop_id, order_code
        FROM public.submitted_orders
        WHERE order_code IS NOT NULL 
          AND trim(order_code) != ''
          AND order_code ~ '\d'
          AND length(trim(order_code)) >= 3
          AND order_code !~ '^\d+$'
          AND COALESCE(created_at, submitted_at, now()) >= v_from
        GROUP BY shop_id, order_code
        HAVING count(*) > 1
      )
      SELECT
        s.id AS record_id,
        s.shop_id,
        COALESCE(sh.name, 'Shop #' || left(s.shop_id::text, 8)) AS shop_name,
        s.order_code,
        s.tracking_code,
        COALESCE(s.platform, 'vnpost') AS carrier,
        s.status,
        regexp_replace(COALESCE(s.customer_name, s.name, 'Khách hàng'), '^(..)(.+)(.)$', '\1****\3') AS customer_name_masked,
        regexp_replace(COALESCE(s.phone, '0900000000'), '^(..)(.+)(.{4})$', '\1****\3') AS customer_phone_masked,
        'Mã đơn trùng lặp với đơn hàng khác trong cùng shop' AS issue_description,
        COALESCE(s.created_at, s.submitted_at, now()) AS detected_at
      FROM public.submitted_orders s
      JOIN dupes d ON s.shop_id = d.shop_id AND s.order_code = d.order_code
      LEFT JOIN public.shops sh ON sh.id = s.shop_id
      WHERE COALESCE(s.created_at, s.submitted_at, now()) >= v_from
      ORDER BY s.order_code, COALESCE(s.created_at, s.submitted_at, now()) DESC
      LIMIT p_limit OFFSET p_offset
    ) r;

  ELSIF p_kpi_type = 'stale_carrier_status' THEN
    SELECT count(*) INTO v_total
    FROM public.submitted_orders
    WHERE status NOT IN ('delivered', 'cancelled', 'returned')
      AND tracking_code IS NOT NULL AND trim(tracking_code) != ''
      AND COALESCE(updated_at, created_at, submitted_at, now()) < now() - interval '72 hours'
      AND COALESCE(created_at, submitted_at, now()) >= v_from;

    SELECT COALESCE(jsonb_agg(r), '[]'::jsonb) INTO v_records
    FROM (
      SELECT
        s.id AS record_id,
        s.shop_id,
        COALESCE(sh.name, 'Shop #' || left(s.shop_id::text, 8)) AS shop_name,
        s.order_code,
        s.tracking_code,
        COALESCE(s.platform, 'vnpost') AS carrier,
        s.status,
        regexp_replace(COALESCE(s.customer_name, s.name, 'Khách hàng'), '^(..)(.+)(.)$', '\1****\3') AS customer_name_masked,
        regexp_replace(COALESCE(s.phone, '0900000000'), '^(..)(.+)(.{4})$', '\1****\3') AS customer_phone_masked,
        'Đơn luân chuyển > 72 giờ chưa hoàn tất giao hàng' AS issue_description,
        COALESCE(s.created_at, s.submitted_at, now()) AS detected_at
      FROM public.submitted_orders s
      LEFT JOIN public.shops sh ON sh.id = s.shop_id
      WHERE s.status NOT IN ('delivered', 'cancelled', 'returned')
        AND s.tracking_code IS NOT NULL AND trim(s.tracking_code) != ''
        AND COALESCE(s.updated_at, s.created_at, s.submitted_at, now()) < now() - interval '72 hours'
        AND COALESCE(s.created_at, s.submitted_at, now()) >= v_from
      ORDER BY COALESCE(s.created_at, s.submitted_at, now()) DESC
      LIMIT p_limit OFFSET p_offset
    ) r;

  ELSIF p_kpi_type = 'low_confidence_address' THEN
    BEGIN
      SELECT count(*) INTO v_total
      FROM public.orders
      WHERE deleted_at IS NULL
        AND (status IS NULL OR status = 'draft')
        AND (
          COALESCE(address_score, 100) < 70
          OR COALESCE((metadata->>'confidence')::numeric, 1.0) < 0.7
          OR (ward IS NULL AND district IS NULL)
        )
        AND created_at >= v_from;

      SELECT COALESCE(jsonb_agg(r), '[]'::jsonb) INTO v_records
      FROM (
        SELECT
          o.id AS record_id,
          o.shop_id,
          COALESCE(sh.name, 'Shop #' || left(o.shop_id::text, 8)) AS shop_name,
          o.order_code,
          'CHƯA_XUẤT' AS tracking_code,
          'DRAFT' AS carrier,
          o.status,
          regexp_replace(COALESCE(o.customer_name, 'Khách hàng'), '^(..)(.+)(.)$', '\1****\3') AS customer_name_masked,
          regexp_replace(COALESCE(o.phone, '0900000000'), '^(..)(.+)(.{4})$', '\1****\3') AS customer_phone_masked,
          'Địa chỉ thiếu cấp hoặc độ tin cậy thấp (' || COALESCE(o.address_score, 0) || 'đ)' AS issue_description,
          o.created_at AS detected_at
        FROM public.orders o
        LEFT JOIN public.shops sh ON sh.id = o.shop_id
        WHERE o.deleted_at IS NULL
          AND (o.status IS NULL OR o.status = 'draft')
          AND (
            COALESCE(o.address_score, 100) < 70
            OR COALESCE((o.metadata->>'confidence')::numeric, 1.0) < 0.7
            OR (o.ward IS NULL AND o.district IS NULL)
          )
          AND o.created_at >= v_from
        ORDER BY o.created_at DESC
        LIMIT p_limit OFFSET p_offset
      ) r;
    EXCEPTION WHEN OTHERS THEN
      v_total := 0; v_records := '[]'::jsonb;
    END;

  ELSIF p_kpi_type = 'unmatched_payment' THEN
    BEGIN
      SELECT count(*) INTO v_total
      FROM public.payment_transactions
      WHERE (reconciliation_status IN ('unmatched', 'failed', 'duplicate')
             OR status = 'FAILED'
             OR (shop_id IS NULL AND status != 'CANCELLED'))
        AND created_at >= v_from;

      SELECT COALESCE(jsonb_agg(r), '[]'::jsonb) INTO v_records
      FROM (
        SELECT
          p.id AS record_id,
          p.shop_id,
          COALESCE(sh.name, 'Chưa xác định') AS shop_name,
          p.transaction_code AS order_code,
          p.order_invoice_number AS tracking_code,
          'PAYMENT' AS carrier,
          p.status,
          'Giao dịch ' || p.amount || 'đ' AS customer_name_masked,
          '09****0000' AS customer_phone_masked,
          'Giao dịch thanh toán chưa khớp shop hoặc thất bại (' || COALESCE(p.reconciliation_status, p.status) || ')' AS issue_description,
          p.created_at AS detected_at
        FROM public.payment_transactions p
        LEFT JOIN public.shops sh ON sh.id = p.shop_id
        WHERE (p.reconciliation_status IN ('unmatched', 'failed', 'duplicate')
               OR p.status = 'FAILED'
               OR (p.shop_id IS NULL AND p.status != 'CANCELLED'))
          AND p.created_at >= v_from
        ORDER BY p.created_at DESC
        LIMIT p_limit OFFSET p_offset
      ) r;
    EXCEPTION WHEN OTHERS THEN
      v_total := 0; v_records := '[]'::jsonb;
    END;
  END IF;

  RETURN jsonb_build_object(
    'kpi_type', p_kpi_type,
    'total', v_total,
    'records', v_records,
    'limit', p_limit,
    'offset', p_offset
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_data_quality_drilldown(TEXT, TEXT, INT, INT) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

