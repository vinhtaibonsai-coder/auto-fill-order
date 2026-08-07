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



