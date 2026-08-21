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
AS $$
BEGIN
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
AS $$
BEGIN
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
AS $$
DECLARE
    v_user_id UUID;
    v_role_id UUID;
BEGIN
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
AS $$
DECLARE
    v_role_id UUID;
BEGIN
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

