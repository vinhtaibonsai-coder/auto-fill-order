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

