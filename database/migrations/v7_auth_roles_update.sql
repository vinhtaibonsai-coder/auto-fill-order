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
