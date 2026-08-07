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
