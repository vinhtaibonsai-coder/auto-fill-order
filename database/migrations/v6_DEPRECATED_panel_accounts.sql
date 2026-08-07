-- =========================================================================
-- AI ORDER EXTENSION V6 — PANEL ACCOUNTS MIGRATION
-- Bảng tài khoản đăng nhập Panel/Options độc lập với Supabase Auth
-- Sao chép và chạy trong Supabase SQL Editor
-- =========================================================================

-- 1. BẢNG TÀI KHOẢN PANEL (panel_accounts)
CREATE TABLE IF NOT EXISTS public.panel_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    full_name TEXT,
    role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'manager', 'user', 'viewer')),
    shop_id UUID REFERENCES public.shops(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'locked', 'suspended')),
    permissions JSONB DEFAULT '[]'::jsonb,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_panel_accounts_username ON public.panel_accounts(username);
CREATE INDEX IF NOT EXISTS idx_panel_accounts_email ON public.panel_accounts(email);
CREATE INDEX IF NOT EXISTS idx_panel_accounts_shop_id ON public.panel_accounts(shop_id);
CREATE INDEX IF NOT EXISTS idx_panel_accounts_status ON public.panel_accounts(status);

-- 2. BẢNG PHIÊN ĐĂNG NHẬP PANEL (panel_sessions)
CREATE TABLE IF NOT EXISTS public.panel_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.panel_accounts(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_panel_sessions_account_id ON public.panel_sessions(account_id);
CREATE INDEX IF NOT EXISTS idx_panel_sessions_token ON public.panel_sessions(token);
CREATE INDEX IF NOT EXISTS idx_panel_sessions_expires_at ON public.panel_sessions(expires_at);

-- 3. RLS POLICIES
ALTER TABLE public.panel_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.panel_sessions ENABLE ROW LEVEL SECURITY;

-- Master Admin toàn quyền trên panel_accounts
DROP POLICY IF EXISTS "Master Admin full access panel_accounts" ON public.panel_accounts;
CREATE POLICY "Master Admin full access panel_accounts" ON public.panel_accounts
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() AND r.code = 'SYSTEM_ADMIN'
    )
    OR auth.uid() IS NULL  -- Cho phép REST API / Service Key
);

-- Người dùng Panel có thể đọc thông tin của chính mình
DROP POLICY IF EXISTS "Panel users can read own account" ON public.panel_accounts;
CREATE POLICY "Panel users can read own account" ON public.panel_accounts
FOR SELECT USING (
    id IN (
        SELECT account_id FROM public.panel_sessions 
        WHERE token = current_setting('request.headers', true)::json->>'x-panel-token'
        AND expires_at > now()
    )
);

-- Master Admin toàn quyền trên panel_sessions
DROP POLICY IF EXISTS "Master Admin full access panel_sessions" ON public.panel_sessions;
CREATE POLICY "Master Admin full access panel_sessions" ON public.panel_sessions
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() AND r.code = 'SYSTEM_ADMIN'
    )
    OR auth.uid() IS NULL
);

-- 4. RPC: ĐĂNG NHẬP PANEL (xác thực username/password)
CREATE OR REPLACE FUNCTION public.panel_login(
    p_username TEXT,
    p_password_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_account RECORD;
    v_token TEXT;
    v_session_id UUID;
BEGIN
    -- Tìm tài khoản theo username
    SELECT * INTO v_account 
    FROM public.panel_accounts 
    WHERE username = p_username AND status = 'active'
    LIMIT 1;

    IF v_account IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Tài khoản không tồn tại hoặc đã bị khóa.');
    END IF;

    -- Kiểm tra mật khẩu
    IF v_account.password_hash != p_password_hash THEN
        RETURN jsonb_build_object('success', false, 'error', 'Mật khẩu không chính xác.');
    END IF;

    -- Tạo token phiên mới (SHA-256 hash ngẫu nhiên)
    v_token := encode(gen_random_bytes(32), 'hex');
    
    INSERT INTO public.panel_sessions (account_id, token, expires_at)
    VALUES (v_account.id, v_token, now() + interval '24 hours')
    RETURNING id INTO v_session_id;

    -- Cập nhật last_login
    UPDATE public.panel_accounts SET last_login = now(), updated_at = now()
    WHERE id = v_account.id;

    RETURN jsonb_build_object(
        'success', true,
        'token', v_token,
        'account', jsonb_build_object(
            'id', v_account.id,
            'username', v_account.username,
            'email', v_account.email,
            'full_name', v_account.full_name,
            'role', v_account.role,
            'shop_id', v_account.shop_id,
            'permissions', v_account.permissions
        )
    );
END;
$$;

-- 5. RPC: XÁC THỰC TOKEN PHIÊN
CREATE OR REPLACE FUNCTION public.panel_validate_token(
    p_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_account RECORD;
    v_session RECORD;
BEGIN
    -- Tìm phiên hợp lệ
    SELECT * INTO v_session
    FROM public.panel_sessions
    WHERE token = p_token AND expires_at > now()
    LIMIT 1;

    IF v_session IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.');
    END IF;

    -- Lấy thông tin tài khoản
    SELECT * INTO v_account
    FROM public.panel_accounts
    WHERE id = v_session.account_id AND status = 'active'
    LIMIT 1;

    IF v_account IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Tài khoản đã bị khóa hoặc không tồn tại.');
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'account', jsonb_build_object(
            'id', v_account.id,
            'username', v_account.username,
            'email', v_account.email,
            'full_name', v_account.full_name,
            'role', v_account.role,
            'shop_id', v_account.shop_id,
            'permissions', v_account.permissions
        )
    );
END;
$$;

-- 6. RPC: ĐĂNG XUẤT PANEL
CREATE OR REPLACE FUNCTION public.panel_logout(
    p_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM public.panel_sessions WHERE token = p_token;
    RETURN jsonb_build_object('success', true, 'message', 'Đã đăng xuất.');
END;
$$;

-- 7. RPC: MASTER ADMIN TẠO TÀI KHOẢN PANEL
CREATE OR REPLACE FUNCTION public.panel_admin_create_account(
    p_username TEXT,
    p_password_hash TEXT,
    p_email TEXT DEFAULT NULL,
    p_full_name TEXT DEFAULT NULL,
    p_role TEXT DEFAULT 'user',
    p_shop_id UUID DEFAULT NULL,
    p_permissions JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_account_id UUID;
BEGIN
    -- Kiểm tra username đã tồn tại
    IF EXISTS (SELECT 1 FROM public.panel_accounts WHERE username = p_username) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Tên đăng nhập đã tồn tại.');
    END IF;

    -- Kiểm tra email nếu có
    IF p_email IS NOT NULL AND EXISTS (SELECT 1 FROM public.panel_accounts WHERE email = p_email) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Email đã được sử dụng.');
    END IF;

    INSERT INTO public.panel_accounts (username, email, password_hash, full_name, role, shop_id, permissions)
    VALUES (p_username, p_email, p_password_hash, p_full_name, p_role, p_shop_id, p_permissions)
    RETURNING id INTO v_account_id;

    RETURN jsonb_build_object('success', true, 'account_id', v_account_id, 'username', p_username);
END;
$$;

-- 8. RPC: MASTER ADMIN LẤY DANH SÁCH TÀI KHOẢN PANEL
CREATE OR REPLACE FUNCTION public.panel_admin_list_accounts()
RETURNS TABLE (
    id UUID,
    username TEXT,
    email TEXT,
    full_name TEXT,
    role TEXT,
    shop_id UUID,
    shop_name TEXT,
    status TEXT,
    permissions JSONB,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pa.id,
        pa.username,
        pa.email,
        pa.full_name,
        pa.role,
        pa.shop_id,
        s.name AS shop_name,
        pa.status,
        pa.permissions,
        pa.last_login,
        pa.created_at
    FROM public.panel_accounts pa
    LEFT JOIN public.shops s ON pa.shop_id = s.id
    ORDER BY pa.created_at DESC;
END;
$$;

-- 9. RPC: MASTER ADMIN CẬP NHẬT TRẠNG THÁI TÀI KHOẢN
CREATE OR REPLACE FUNCTION public.panel_admin_update_status(
    p_account_id UUID,
    p_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.panel_accounts 
    SET status = p_status, updated_at = now()
    WHERE id = p_account_id;

    -- Nếu khóa tài khoản, xóa tất cả phiên
    IF p_status IN ('locked', 'suspended') THEN
        DELETE FROM public.panel_sessions WHERE account_id = p_account_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'Đã cập nhật trạng thái tài khoản.');
END;
$$;

-- 10. RPC: MASTER ADMIN RESET MẬT KHẨU PANEL
CREATE OR REPLACE FUNCTION public.panel_admin_reset_password(
    p_account_id UUID,
    p_new_password_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.panel_accounts 
    SET password_hash = p_new_password_hash, updated_at = now()
    WHERE id = p_account_id;

    -- Xóa tất cả phiên hiện tại để buộc đăng nhập lại
    DELETE FROM public.panel_sessions WHERE account_id = p_account_id;

    RETURN jsonb_build_object('success', true, 'message', 'Đã đặt lại mật khẩu. Tất cả phiên đăng nhập đã bị hủy.');
END;
$$;

-- 11. SEED TÀI KHOẢN ADMIN MẶC ĐỊNH (admin / admin123)
-- Password hash: SHA-256 của "admin123"
INSERT INTO public.panel_accounts (username, email, password_hash, full_name, role, permissions)
VALUES (
    'admin',
    'admin@luathuysinh.vn',
    '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',
    'Quản trị viên Hệ thống',
    'admin',
    '["*"]'::jsonb
)
ON CONFLICT (username) DO NOTHING;

-- 12. SEED TÀI KHOẢN USER MẶC ĐỊNH (yenlua / yenlua123)
INSERT INTO public.panel_accounts (username, email, password_hash, full_name, role, permissions)
VALUES (
    'yenlua',
    'yenlua@shop.com',
    '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92',
    'Yến Lũa Shop',
    'manager',
    '["ai_parsing", "vnpost_autofill", "jt_autofill", "excel_export"]'::jsonb
)
ON CONFLICT (username) DO NOTHING;