-- =========================================================================
-- Migration v97: Khắc phục triệt để lỗi GoTrue Auth HTTP 500 khi đăng nhập
-- =========================================================================
-- NGUYÊN NHÂN CỐT LÕI HTTP 500 TẠI /auth/v1/token?grant_type=password:
-- Máy chủ Supabase GoTrue (Golang) quét các trường token chuỗi trong bảng auth.users
-- (email_change, email_change_token_new, confirmation_token, recovery_token, ...)
-- vào biến Go string thông thường. Nếu các trường này bị NULL (do tạo user bằng SQL
-- mà không chỉ định giá trị), Go driver ném lỗi:
-- "sql: Scan error on column index X: converting NULL to string is unsupported"
-- dẫn đến toàn bộ request đăng nhập sập với HTTP 500 Internal Server Error.
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 1. QUÉT SẠCH VÀ THAY THẾ TẤT CẢ CỘT TOKEN NULL BẰNG '' (EMPTY STRING)
DO $$
DECLARE
    v_col TEXT;
    v_cols TEXT[] := ARRAY[
        'confirmation_token',
        'recovery_token',
        'email_change',
        'email_change_token_new',
        'email_change_token_current',
        'phone_change',
        'phone_change_token',
        'reauthentication_token'
    ];
BEGIN
    FOR v_col IN SELECT unnest(v_cols) LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = v_col
        ) THEN
            EXECUTE format('UPDATE auth.users SET %I = '''' WHERE %I IS NULL', v_col, v_col);
        END IF;
    END LOOP;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'is_sso_user'
    ) THEN
        EXECUTE 'UPDATE auth.users SET is_sso_user = FALSE WHERE is_sso_user IS NULL';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'is_anonymous'
    ) THEN
        EXECUTE 'UPDATE auth.users SET is_anonymous = FALSE WHERE is_anonymous IS NULL';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'email_confirmed_at'
    ) THEN
        EXECUTE 'UPDATE auth.users SET email_confirmed_at = COALESCE(email_confirmed_at, now()) WHERE email_confirmed_at IS NULL';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'confirmed_at'
          AND (is_generated IS NULL OR is_generated = 'NEVER')
    ) THEN
        BEGIN
            EXECUTE 'UPDATE auth.users SET confirmed_at = COALESCE(confirmed_at, email_confirmed_at, now()) WHERE confirmed_at IS NULL';
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'email_change_confirm_status'
    ) THEN
        EXECUTE 'UPDATE auth.users SET email_change_confirm_status = 0 WHERE email_change_confirm_status IS NULL';
    END IF;
END $$;

-- 2. TÁI ĐỒNG BỘ TÀI KHOẢN vinhtai@luathuysinh.vn VỚI MẬT KHẨU admin123@
DO $$
DECLARE
    v_user_id UUID;
    v_ref_inst UUID;
    v_ref_provider_id TEXT;
    v_target_provider_id TEXT;
    v_ref_user_id UUID;
BEGIN
    SELECT id INTO v_user_id FROM auth.users WHERE lower(trim(email)) = 'vinhtai@luathuysinh.vn' LIMIT 1;
    
    IF v_user_id IS NULL THEN
        SELECT id INTO v_user_id FROM public.profiles WHERE lower(trim(email)) = 'vinhtai@luathuysinh.vn' LIMIT 1;
        IF v_user_id IS NULL THEN
            v_user_id := gen_random_uuid();
        END IF;
    END IF;

    -- Lấy instance_id chuẩn từ tài khoản admin đang hoạt động bình thường
    SELECT instance_id INTO v_ref_inst FROM auth.users WHERE lower(trim(email)) = 'admin@luathuysinh.vn' LIMIT 1;
    IF v_ref_inst IS NULL THEN
        SELECT id INTO v_ref_inst FROM auth.instances LIMIT 1;
    END IF;
    IF v_ref_inst IS NULL THEN
        v_ref_inst := '00000000-0000-0000-0000-000000000000'::uuid;
    END IF;

    -- Upsert tài khoản vào auth.users với đầy đủ các trường chuẩn GoTrue
    INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, confirmation_token, recovery_token, email_change, email_change_token_new,
        is_sso_user, created_at, updated_at, confirmation_sent_at,
        raw_app_meta_data, raw_user_meta_data, is_super_admin
    ) VALUES (
        v_ref_inst, v_user_id, 'authenticated', 'authenticated',
        'vinhtai@luathuysinh.vn',
        extensions.crypt('admin123@', extensions.gen_salt('bf', 10)),
        now(), '', '', '', '',
        FALSE, now(), now(), now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', 'Vĩnh Tài', 'name', 'Vĩnh Tài'),
        FALSE
    )
    ON CONFLICT (id) DO UPDATE SET
        instance_id = EXCLUDED.instance_id,
        aud = 'authenticated',
        role = 'authenticated',
        encrypted_password = extensions.crypt('admin123@', extensions.gen_salt('bf', 10)),
        email_confirmed_at = COALESCE(auth.users.email_confirmed_at, now()),
        confirmation_token = '',
        recovery_token = '',
        email_change = '',
        email_change_token_new = '',
        is_sso_user = FALSE,
        raw_app_meta_data = EXCLUDED.raw_app_meta_data,
        raw_user_meta_data = EXCLUDED.raw_user_meta_data,
        banned_until = NULL,
        deleted_at = NULL,
        updated_at = now();

    -- Xác định quy tắc provider_id (email hay user_id::text)
    SELECT id INTO v_ref_user_id FROM auth.users WHERE lower(trim(email)) = 'admin@luathuysinh.vn' LIMIT 1;
    IF v_ref_user_id IS NOT NULL THEN
        SELECT provider_id INTO v_ref_provider_id FROM auth.identities WHERE user_id = v_ref_user_id LIMIT 1;
    END IF;

    IF v_ref_provider_id = 'admin@luathuysinh.vn' THEN
        v_target_provider_id := 'vinhtai@luathuysinh.vn';
    ELSE
        v_target_provider_id := v_user_id::text;
    END IF;

    -- Tái tạo danh tính (identities)
    DELETE FROM auth.identities 
    WHERE user_id = v_user_id 
       OR (provider = 'email' AND (provider_id = v_user_id::text OR provider_id = 'vinhtai@luathuysinh.vn'));

    INSERT INTO auth.identities (
        id, user_id, identity_data, provider, provider_id,
        last_sign_in_at, created_at, updated_at
    ) VALUES (
        gen_random_uuid(),
        v_user_id,
        jsonb_build_object(
            'sub', v_user_id::text,
            'email', 'vinhtai@luathuysinh.vn',
            'email_verified', true,
            'phone_verified', false
        ),
        'email',
        v_target_provider_id,
        now(),
        now(),
        now()
    );

    -- Đảm bảo profiles (Tuân thủ Account Creation Role Invariant: role='member')
    INSERT INTO public.profiles (id, email, full_name, status, role)
    VALUES (v_user_id, 'vinhtai@luathuysinh.vn', 'Vĩnh Tài', 'active', 'member')
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        status = 'active';

    -- Đảm bảo vai trò SUPPORT_ADMIN trong user_roles
    IF EXISTS (SELECT 1 FROM public.roles WHERE code = 'SUPPORT_ADMIN') THEN
        INSERT INTO public.user_roles (user_id, role_id)
        SELECT v_user_id, id FROM public.roles WHERE code = 'SUPPORT_ADMIN'
        ON CONFLICT (user_id, role_id) DO NOTHING;
    END IF;
END $$;

-- 3. CẬP NHẬT HÀM admin_repair_user_auth ĐỂ TỰ ĐỘNG SỬA TOKEN KHI CÓ SỰ CỐ
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
    v_hash TEXT;
BEGIN
    v_email := lower(trim(p_email));
    IF v_email IS NULL OR v_email = '' OR position('@' IN v_email) < 2 THEN
        RAISE EXCEPTION 'Email không hợp lệ.';
    END IF;
    IF p_password IS NULL OR length(p_password) < 6 THEN
        RAISE EXCEPTION 'Mật khẩu phải có ít nhất 6 ký tự.';
    END IF;

    SELECT u.id, COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name')
      INTO v_user_id, v_full_name
      FROM auth.users u
     WHERE lower(trim(u.email)) = v_email
     ORDER BY u.created_at NULLS LAST
     LIMIT 1;

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

    v_full_name := COALESCE(NULLIF(trim(v_full_name), ''), split_part(v_email, '@', 1));
    v_hash := extensions.crypt(p_password, extensions.gen_salt('bf', 10));

    UPDATE auth.users
       SET email = v_email,
           encrypted_password = v_hash,
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

    RETURN jsonb_build_object('success', true, 'user_id', v_user_id, 'email', v_email);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_repair_user_auth(TEXT, TEXT) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
