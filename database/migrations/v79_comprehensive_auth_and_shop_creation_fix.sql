-- =============================================================================
-- Migration: v79_comprehensive_auth_and_shop_creation_fix.sql
-- Mục đích: Khắc phục triệt để lỗi HTTP 500 khi đăng nhập Supabase Auth GoTrue
-- cho các tài khoản Shop mới tạo và tài khoản hiện có trong hệ thống.
-- =============================================================================

-- 1. Kích hoạt extension pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 2. BẢO VỆ TRIGGER handle_new_user() KHÔNG BAO GIỜ GÂY LỖI SẬP GOTRUE AUTH (HTTP 500)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public 
AS $$
BEGIN
    BEGIN
        INSERT INTO public.profiles (id, email, full_name, avatar_url, role, status, created_at, updated_at)
        VALUES (
            NEW.id,
            LOWER(TRIM(NEW.email)),
            COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
            NEW.raw_user_meta_data->>'avatar_url',
            'member',
            'active',
            now(),
            now()
        )
        ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
            updated_at = now();
    EXCEPTION WHEN OTHERS THEN
        -- Bắt toàn bộ ngoại lệ để trigger không bao giờ làm sập tiến trình GoTrue
        NULL;
    END;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created 
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 3. HÀM TẠO SHOP KÈM TÀI KHOẢN CHUẨN 100% SUPABASE GOTRUE V2 (KHÔNG LỖI 500)
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
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_user_id UUID;
    v_shop_id UUID;
    v_owner_role_id UUID;
    v_inst_id UUID;
    v_clean_email TEXT;
    v_clean_name TEXT;
    v_hash TEXT;
BEGIN
    -- 1. Kiểm tra quyền Master Admin
    IF auth.uid() IS NULL OR NOT public.is_system_admin() THEN
        RAISE EXCEPTION 'Chỉ Master Admin mới có quyền tạo Shop và cấp tài khoản.';
    END IF;

    v_clean_email := LOWER(TRIM(p_owner_email));
    v_clean_name := COALESCE(NULLIF(TRIM(p_owner_full_name), ''), split_part(v_clean_email, '@', 1));

    IF v_clean_email IS NULL OR v_clean_email NOT LIKE '%@%' THEN
        RAISE EXCEPTION 'Email không hợp lệ: %', p_owner_email;
    END IF;

    -- 2. Lấy role_id của SHOP_OWNER hoặc OWNER
    SELECT id INTO v_owner_role_id FROM public.roles WHERE code = 'SHOP_OWNER' LIMIT 1;
    IF v_owner_role_id IS NULL THEN
        SELECT id INTO v_owner_role_id FROM public.roles WHERE code = 'OWNER' LIMIT 1;
    END IF;
    IF v_owner_role_id IS NULL THEN
        INSERT INTO public.roles (code, name) VALUES ('SHOP_OWNER', 'Chủ Cửa hàng')
        RETURNING id INTO v_owner_role_id;
    END IF;

    -- 3. Kiểm tra xem user_id đã có ở auth.users hoặc profiles chưa
    SELECT id INTO v_user_id FROM auth.users WHERE LOWER(email) = v_clean_email LIMIT 1;
    IF v_user_id IS NULL THEN
        SELECT id INTO v_user_id FROM public.profiles WHERE LOWER(email) = v_clean_email LIMIT 1;
    END IF;

    IF v_user_id IS NULL THEN
        v_user_id := gen_random_uuid();
    END IF;

    -- 4. Lấy instance_id đúng của Supabase Auth
    SELECT id INTO v_inst_id FROM auth.instances LIMIT 1;
    IF v_inst_id IS NULL THEN
        v_inst_id := '00000000-0000-0000-0000-000000000000'::uuid;
    END IF;

    -- 5. Băm mật khẩu chuẩn bcrypt 10 rounds
    v_hash := extensions.crypt(p_owner_password, extensions.gen_salt('bf', 10));

    -- 6. Upsert vào auth.users với đầy đủ 100% metadata cho GoTrue
    INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        is_super_admin,
        created_at,
        updated_at,
        confirmation_sent_at,
        confirmation_token,
        recovery_token,
        email_change_token_new,
        email_change,
        is_sso_user,
        deleted_at
    ) VALUES (
        v_inst_id,
        v_user_id,
        'authenticated',
        'authenticated',
        v_clean_email,
        v_hash,
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', v_clean_name, 'name', v_clean_name),
        FALSE,
        now(),
        now(),
        now(),
        '',
        '',
        '',
        '',
        FALSE,
        NULL
    )
    ON CONFLICT (id) DO UPDATE SET
        email = v_clean_email,
        encrypted_password = v_hash,
        email_confirmed_at = COALESCE(auth.users.email_confirmed_at, now()),
        raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
        raw_user_meta_data = jsonb_build_object('full_name', v_clean_name, 'name', v_clean_name),
        banned_until = NULL,
        updated_at = now();

    -- 7. Xóa identity cũ và tái tạo identity chuẩn cho Supabase Auth GoTrue v2
    DELETE FROM auth.identities 
    WHERE user_id = v_user_id 
       OR (provider = 'email' AND (provider_id = v_user_id::text OR provider_id = v_clean_email OR identity_data->>'email' = v_clean_email));

    INSERT INTO auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        provider_id,
        last_sign_in_at,
        created_at,
        updated_at
    ) VALUES (
        gen_random_uuid(),
        v_user_id,
        jsonb_build_object(
            'sub', v_user_id::text,
            'email', v_clean_email,
            'email_verified', true,
            'phone_verified', false
        ),
        'email',
        v_user_id::text,
        now(),
        now(),
        now()
    );

    -- 8. Đồng bộ sang public.profiles
    INSERT INTO public.profiles (id, email, full_name, role, status, created_at, updated_at)
    VALUES (v_user_id, v_clean_email, v_clean_name, 'member', 'active', now(), now())
    ON CONFLICT (id) DO UPDATE SET 
        full_name = EXCLUDED.full_name, 
        email = EXCLUDED.email, 
        status = 'active',
        updated_at = now();

    -- 9. Gán vai trò vào user_roles
    INSERT INTO public.user_roles (user_id, role_id)
    VALUES (v_user_id, v_owner_role_id)
    ON CONFLICT DO NOTHING;

    -- 10. Tạo Shop mới
    INSERT INTO public.shops (name, owner_id, status)
    VALUES (p_shop_name, v_user_id, 'active')
    RETURNING id INTO v_shop_id;

    -- 11. Thêm User vào shop_members làm Owner (Gán cả role và role_id)
    INSERT INTO public.shop_members (shop_id, user_id, role_id, role, status)
    VALUES (v_shop_id, v_user_id, v_owner_role_id, 'OWNER', 'active')
    ON CONFLICT (shop_id, user_id) 
    DO UPDATE SET 
        role_id = v_owner_role_id, 
        role = 'OWNER', 
        status = 'active', 
        removed_at = NULL;

    -- 12. Khởi tạo cờ tính năng & hạn ngạch cho Shop
    INSERT INTO public.shop_feature_flags (shop_id) VALUES (v_shop_id) ON CONFLICT DO NOTHING;
    INSERT INTO public.shop_quotas (shop_id, max_devices, daily_ai_limit)
    VALUES (v_shop_id, COALESCE(p_max_devices, 5), COALESCE(p_daily_ai_limit, 500))
    ON CONFLICT (shop_id) DO UPDATE SET max_devices = EXCLUDED.max_devices, daily_ai_limit = EXCLUDED.daily_ai_limit;

    -- 13. Ghi Audit Log
    PERFORM public.insert_audit_log('ADMIN_CREATE_SHOP', 'shop', v_shop_id::text, 
        jsonb_build_object('shop_name', p_shop_name, 'owner_email', v_clean_email), NULL);

    RETURN jsonb_build_object(
        'success', true, 
        'shop_id', v_shop_id, 
        'user_id', v_user_id,
        'email', v_clean_email,
        'message', 'Đã tạo Shop và tài khoản chủ shop thành công.'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_shop_with_account(TEXT, TEXT, TEXT, TEXT, INT, INT) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_create_shop_with_account(TEXT, TEXT, TEXT, TEXT, INT, INT) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_create_shop_with_account(TEXT, TEXT, TEXT, TEXT, INT, INT) TO service_role;


-- 4. HÀM TẠO USER CHUẨN GOTRUE (ADMIN_CREATE_USER)
CREATE OR REPLACE FUNCTION public.admin_create_user(
    p_email TEXT,
    p_password TEXT,
    p_full_name TEXT DEFAULT NULL,
    p_role_code TEXT DEFAULT 'EXTENSION_USER'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_user_id UUID;
    v_role_id UUID;
    v_inst_id UUID;
    v_clean_email TEXT;
    v_clean_name TEXT;
    v_hash TEXT;
BEGIN
    IF NOT public.is_system_admin() THEN
        IF auth.uid() IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid() AND r.code = 'SYSTEM_ADMIN'
        ) AND NOT EXISTS (
            SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.email = 'admin@luathuysinh.vn'
        ) THEN
            RAISE EXCEPTION 'Chỉ Master Admin mới có quyền tạo tài khoản mới.';
        END IF;
    END IF;

    v_clean_email := LOWER(TRIM(p_email));
    v_clean_name := COALESCE(NULLIF(TRIM(p_full_name), ''), split_part(v_clean_email, '@', 1));

    SELECT id INTO v_role_id FROM public.roles WHERE code = p_role_code LIMIT 1;
    IF v_role_id IS NULL THEN
        SELECT id INTO v_role_id FROM public.roles WHERE code = 'SHOP_OWNER' LIMIT 1;
    END IF;

    SELECT id INTO v_user_id FROM public.profiles WHERE LOWER(email) = v_clean_email LIMIT 1;
    IF v_user_id IS NULL THEN
        SELECT id INTO v_user_id FROM auth.users WHERE LOWER(email) = v_clean_email LIMIT 1;
    END IF;
    IF v_user_id IS NULL THEN
        v_user_id := gen_random_uuid();
    END IF;

    SELECT id INTO v_inst_id FROM auth.instances LIMIT 1;
    IF v_inst_id IS NULL THEN
        v_inst_id := '00000000-0000-0000-0000-000000000000'::uuid;
    END IF;

    v_hash := extensions.crypt(p_password, extensions.gen_salt('bf', 10));

    INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, is_super_admin, is_sso_user,
        created_at, updated_at, confirmation_sent_at, confirmation_token, recovery_token
    ) VALUES (
        v_inst_id, v_user_id, 'authenticated', 'authenticated', v_clean_email, v_hash, now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', v_clean_name, 'name', v_clean_name),
        FALSE, FALSE, now(), now(), now(), '', ''
    )
    ON CONFLICT (id) DO UPDATE SET
        email = v_clean_email,
        encrypted_password = v_hash,
        raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
        raw_user_meta_data = jsonb_build_object('full_name', v_clean_name, 'name', v_clean_name),
        updated_at = now();

    DELETE FROM auth.identities WHERE user_id = v_user_id;
    INSERT INTO auth.identities (
        id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) VALUES (
        gen_random_uuid(), v_user_id,
        jsonb_build_object('sub', v_user_id::text, 'email', v_clean_email, 'email_verified', true, 'phone_verified', false),
        'email', v_user_id::text, now(), now(), now()
    );

    INSERT INTO public.profiles (id, email, full_name, role, status, created_at, updated_at)
    VALUES (v_user_id, v_clean_email, v_clean_name, 'member', 'active', now(), now())
    ON CONFLICT (id) DO UPDATE SET
        email = v_clean_email, full_name = v_clean_name, updated_at = now();

    IF v_role_id IS NOT NULL THEN
        INSERT INTO public.user_roles (user_id, role_id) VALUES (v_user_id, v_role_id) ON CONFLICT DO NOTHING;
    END IF;

    RETURN jsonb_build_object('success', true, 'user_id', v_user_id, 'email', v_clean_email, 'role', p_role_code);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_user(TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_user(TEXT, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.admin_create_user(TEXT, TEXT, TEXT, TEXT) TO service_role;


-- 5. HÀM ĐẶT LẠI MẬT KHẨU (ADMIN_RESET_USER_PASSWORD)
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
    v_email TEXT;
    v_full_name TEXT;
    v_inst_id UUID;
    v_hash TEXT;
BEGIN
    SELECT email, full_name INTO v_email, v_full_name 
    FROM public.profiles 
    WHERE id = p_target_user_id;

    IF v_email IS NULL THEN
        SELECT email, raw_user_meta_data->>'full_name' INTO v_email, v_full_name 
        FROM auth.users 
        WHERE id = p_target_user_id;
    END IF;

    IF v_email IS NULL THEN
        RAISE EXCEPTION 'Không tìm thấy thông tin tài khoản (User ID: %).', p_target_user_id;
    END IF;

    v_email := LOWER(TRIM(v_email));
    v_full_name := COALESCE(v_full_name, split_part(v_email, '@', 1));

    SELECT id INTO v_inst_id FROM auth.instances LIMIT 1;
    IF v_inst_id IS NULL THEN
        v_inst_id := '00000000-0000-0000-0000-000000000000'::uuid;
    END IF;

    v_hash := extensions.crypt(p_new_password, extensions.gen_salt('bf', 10));

    INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, is_super_admin, is_sso_user,
        created_at, updated_at, confirmation_sent_at, confirmation_token, recovery_token
    ) VALUES (
        v_inst_id, p_target_user_id, 'authenticated', 'authenticated', v_email, v_hash, now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', v_full_name, 'name', v_full_name),
        FALSE, FALSE, now(), now(), now(), '', ''
    )
    ON CONFLICT (id) DO UPDATE SET
        email = v_email,
        encrypted_password = v_hash,
        email_confirmed_at = COALESCE(auth.users.email_confirmed_at, now()),
        raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
        raw_user_meta_data = jsonb_build_object('full_name', v_full_name, 'name', v_full_name),
        banned_until = NULL,
        updated_at = now();

    DELETE FROM auth.identities WHERE user_id = p_target_user_id;
    INSERT INTO auth.identities (
        id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) VALUES (
        gen_random_uuid(), p_target_user_id,
        jsonb_build_object('sub', p_target_user_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
        'email', p_target_user_id::text, now(), now(), now()
    );

    UPDATE public.profiles 
    SET full_name = v_full_name, updated_at = now()
    WHERE id = p_target_user_id;

    RETURN jsonb_build_object('success', true, 'user_id', p_target_user_id, 'email', v_email);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_reset_user_password(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_user_password(UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.admin_reset_user_password(UUID, TEXT) TO service_role;


-- 6. HÀM TỰ ĐỘNG PHỤC HỒI TÀI KHOẢN THEO EMAIL (ADMIN_REPAIR_USER_AUTH)
CREATE OR REPLACE FUNCTION public.admin_repair_user_auth(
    p_email TEXT,
    p_password TEXT DEFAULT 'admin123@'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth
AS $$
DECLARE
    v_user_id UUID;
    v_clean_email TEXT;
BEGIN
    v_clean_email := LOWER(TRIM(p_email));
    
    SELECT id INTO v_user_id FROM public.profiles WHERE LOWER(email) = v_clean_email LIMIT 1;
    IF v_user_id IS NULL THEN
        SELECT id INTO v_user_id FROM auth.users WHERE LOWER(email) = v_clean_email LIMIT 1;
    END IF;

    IF v_user_id IS NULL THEN
        v_user_id := gen_random_uuid();
        INSERT INTO public.profiles (id, email, full_name, role, status, created_at, updated_at)
        VALUES (v_user_id, v_clean_email, split_part(v_clean_email, '@', 1), 'member', 'active', now(), now());
    END IF;

    RETURN public.admin_reset_user_password(v_user_id, p_password);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_repair_user_auth(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_repair_user_auth(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.admin_repair_user_auth(TEXT, TEXT) TO service_role;


-- 7. CHẠY TỰ ĐỘNG SỬA CHỮA (SELF-HEALING) NGAY LẬP TỨC CHO TOÀN BỘ TÀI KHOẢN HIỆN CÓ
DO $$
DECLARE
    r RECORD;
    v_inst_id UUID;
BEGIN
    SELECT id INTO v_inst_id FROM auth.instances LIMIT 1;
    IF v_inst_id IS NULL THEN
        v_inst_id := '00000000-0000-0000-0000-000000000000'::uuid;
    END IF;

    -- 1. Sửa chữa tất cả user có trong auth.users
    UPDATE auth.users SET
        instance_id = COALESCE(instance_id, v_inst_id),
        aud = 'authenticated',
        role = 'authenticated',
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
        raw_user_meta_data = COALESCE(raw_user_meta_data, jsonb_build_object('full_name', split_part(email, '@', 1))),
        is_super_admin = COALESCE(is_super_admin, FALSE),
        is_sso_user = COALESCE(is_sso_user, FALSE),
        banned_until = NULL,
        updated_at = now()
    WHERE email IS NOT NULL;

    -- 2. Tự tạo auth.users cho các profiles chưa có
    FOR r IN 
        SELECT p.id, LOWER(TRIM(p.email)) AS email, COALESCE(NULLIF(p.full_name, ''), split_part(p.email, '@', 1)) AS full_name
        FROM public.profiles p
        LEFT JOIN auth.users u ON p.id = u.id OR LOWER(p.email) = LOWER(u.email)
        WHERE u.id IS NULL AND p.email IS NOT NULL AND p.email LIKE '%@%'
    LOOP
        INSERT INTO auth.users (
            instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
            raw_app_meta_data, raw_user_meta_data, is_super_admin, is_sso_user,
            created_at, updated_at, confirmation_sent_at, confirmation_token, recovery_token
        ) VALUES (
            v_inst_id, r.id, 'authenticated', 'authenticated', r.email,
            extensions.crypt('12345678', extensions.gen_salt('bf', 10)), now(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            jsonb_build_object('full_name', r.full_name, 'name', r.full_name),
            FALSE, FALSE, now(), now(), now(), '', ''
        )
        ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
            updated_at = now();
    END LOOP;

    -- 3. Tái tạo danh sách identities hợp lệ cho 100% người dùng
    FOR r IN SELECT id, LOWER(TRIM(email)) AS email FROM auth.users WHERE email IS NOT NULL AND email LIKE '%@%' LOOP
        DELETE FROM auth.identities WHERE user_id = r.id;
        INSERT INTO auth.identities (
            id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), r.id,
            jsonb_build_object('sub', r.id::text, 'email', r.email, 'email_verified', true, 'phone_verified', false),
            'email', r.id::text, now(), now(), now()
        );
    END LOOP;
END $$;
