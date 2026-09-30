-- =========================================================================
-- Migration v72: Khắc phục triệt để đồng bộ auth.users & Tự động sửa tài khoản mồ côi
-- =========================================================================

-- 1. Bật extension pgcrypto trong schema extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 2. Tự động sửa chữa tất cả profiles mồ côi (chưa có trong auth.users như nga@afo.vn)
DO $$
DECLARE
  r RECORD;
  v_inst_id UUID;
BEGIN
  SELECT id INTO v_inst_id FROM auth.instances LIMIT 1;
  IF v_inst_id IS NULL THEN
    v_inst_id := '00000000-0000-0000-0000-000000000000'::uuid;
  END IF;

  FOR r IN 
    SELECT p.id, p.email, p.full_name 
    FROM public.profiles p
    LEFT JOIN auth.users u ON p.id = u.id OR LOWER(p.email) = LOWER(u.email)
    WHERE u.id IS NULL AND p.email IS NOT NULL AND p.email <> ''
  LOOP
    -- Xóa identity kẹt nếu có
    DELETE FROM auth.identities WHERE user_id = r.id OR provider_id = LOWER(TRIM(r.email));

    -- Tạo auth.users cho tài khoản bị thiếu với mật khẩu mặc định 12345678
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      is_super_admin, created_at, updated_at, confirmation_sent_at,
      confirmation_token, recovery_token
    ) VALUES (
      v_inst_id, r.id, 'authenticated', 'authenticated', LOWER(TRIM(r.email)),
      extensions.crypt('12345678', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', r.full_name),
      FALSE, now(), now(), now(),
      '', ''
    )
    ON CONFLICT (id) DO UPDATE SET 
      email = EXCLUDED.email,
      encrypted_password = EXCLUDED.encrypted_password,
      raw_user_meta_data = EXCLUDED.raw_user_meta_data,
      updated_at = now();

    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      r.id, r.id,
      jsonb_build_object('sub', r.id::text, 'email', LOWER(TRIM(r.email)), 'email_verified', true),
      'email', LOWER(TRIM(r.email)),
      now(), now(), now()
    )
    ON CONFLICT (provider, provider_id) 
    DO UPDATE SET identity_data = EXCLUDED.identity_data, updated_at = now();
  END LOOP;
END $$;

-- 3. Cập nhật hàm admin_create_shop_with_account luôn đồng bộ auth.users
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
    v_auth_exists BOOLEAN := FALSE;
BEGIN
    -- 1. Kiểm tra quyền Master Admin
    IF NOT public.is_system_admin() THEN
        IF auth.uid() IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid() AND r.code = 'SYSTEM_ADMIN'
        ) AND NOT EXISTS (
            SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.email = 'admin@luathuysinh.vn'
        ) THEN
            RAISE EXCEPTION 'Chỉ Master Admin mới có quyền tạo Shop và cấp tài khoản.';
        END IF;
    END IF;

    v_clean_email := LOWER(TRIM(p_owner_email));

    -- 2. Lấy role_id của SHOP_OWNER
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
    IF v_user_id IS NOT NULL THEN
        v_auth_exists := TRUE;
    ELSE
        SELECT id INTO v_user_id FROM public.profiles WHERE LOWER(email) = v_clean_email LIMIT 1;
    END IF;

    -- 4. Nếu chưa có user_id nào, tạo mới uuid
    IF v_user_id IS NULL THEN
        v_user_id := gen_random_uuid();
    END IF;

    SELECT id INTO v_inst_id FROM auth.instances LIMIT 1;
    IF v_inst_id IS NULL THEN
        v_inst_id := '00000000-0000-0000-0000-000000000000'::uuid;
    END IF;

    -- 5. Đảm bảo user LUÔN có trong auth.users để đăng nhập được
    IF NOT v_auth_exists THEN
        INSERT INTO auth.users (
            instance_id, id, aud, role, email,
            encrypted_password, email_confirmed_at,
            raw_app_meta_data, raw_user_meta_data,
            is_super_admin, created_at, updated_at, confirmation_sent_at,
            confirmation_token, recovery_token
        ) VALUES (
            v_inst_id,
            v_user_id, 'authenticated', 'authenticated', v_clean_email,
            extensions.crypt(p_owner_password, extensions.gen_salt('bf')), now(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            jsonb_build_object('full_name', p_owner_full_name),
            FALSE, now(), now(), now(),
            '', ''
        )
        ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            encrypted_password = EXCLUDED.encrypted_password,
            raw_user_meta_data = EXCLUDED.raw_user_meta_data,
            updated_at = now();

        INSERT INTO auth.identities (
            id, user_id, identity_data, provider, provider_id,
            last_sign_in_at, created_at, updated_at
        ) VALUES (
            v_user_id, v_user_id,
            jsonb_build_object('sub', v_user_id::text, 'email', v_clean_email, 'email_verified', true),
            'email', v_clean_email,
            now(), now(), now()
        )
        ON CONFLICT (provider, provider_id) 
        DO UPDATE SET identity_data = EXCLUDED.identity_data, updated_at = now();
    ELSE
        -- Đã có trong auth.users, cập nhật mật khẩu nếu được truyền vào
        IF p_owner_password IS NOT NULL AND LENGTH(p_owner_password) >= 6 THEN
            UPDATE auth.users
            SET encrypted_password = extensions.crypt(p_owner_password, extensions.gen_salt('bf')),
                updated_at = now()
            WHERE id = v_user_id;
        END IF;
    END IF;

    -- 6. Đồng bộ sang public.profiles
    INSERT INTO public.profiles (id, email, full_name, status)
    VALUES (v_user_id, v_clean_email, p_owner_full_name, 'active')
    ON CONFLICT (id) DO UPDATE SET 
        full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), profiles.full_name), 
        email = EXCLUDED.email, 
        status = 'active',
        updated_at = now();

    -- 7. Tạo Shop mới
    INSERT INTO public.shops (name, owner_id, status)
    VALUES (p_shop_name, v_user_id, 'active')
    RETURNING id INTO v_shop_id;

    -- 8. Thêm User vào shop_members làm Owner (Gán cả role và role_id)
    INSERT INTO public.shop_members (shop_id, user_id, role_id, role, status)
    VALUES (v_shop_id, v_user_id, v_owner_role_id, 'OWNER', 'active')
    ON CONFLICT (shop_id, user_id) 
    DO UPDATE SET 
        role_id = v_owner_role_id, 
        role = 'OWNER', 
        status = 'active', 
        removed_at = NULL;

    -- 9. Khởi tạo cờ tính năng & hạn ngạch cho Shop
    INSERT INTO public.shop_feature_flags (shop_id) VALUES (v_shop_id) ON CONFLICT DO NOTHING;
    INSERT INTO public.shop_quotas (shop_id, max_devices, daily_ai_limit)
    VALUES (v_shop_id, p_max_devices, p_daily_ai_limit)
    ON CONFLICT (shop_id) DO UPDATE SET max_devices = p_max_devices, daily_ai_limit = p_daily_ai_limit;

    -- 10. Ghi Audit Log
    PERFORM public.insert_audit_log('ADMIN_CREATE_SHOP', 'shop', v_shop_id::text, 
        jsonb_build_object('shop_name', p_shop_name, 'owner_email', v_clean_email), NULL);

    RETURN jsonb_build_object('success', true, 'shop_id', v_shop_id, 'user_id', v_user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_shop_with_account(TEXT, TEXT, TEXT, TEXT, INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_shop_with_account(TEXT, TEXT, TEXT, TEXT, INT, INT) TO service_role;

-- 4. Nâng cấp admin_reset_user_password tự động phục hồi auth.users nếu thiếu
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
BEGIN
    IF NOT public.is_system_admin() THEN
        RAISE EXCEPTION 'Chỉ Master Admin mới có quyền reset mật khẩu.';
    END IF;

    -- Lấy thông tin từ profiles
    SELECT email, full_name INTO v_email, v_full_name 
    FROM public.profiles 
    WHERE id = p_target_user_id;

    IF v_email IS NULL THEN
        SELECT email INTO v_email FROM auth.users WHERE id = p_target_user_id;
    END IF;

    IF v_email IS NULL THEN
        RAISE EXCEPTION 'Tài khoản không tồn tại.';
    END IF;

    SELECT id INTO v_inst_id FROM auth.instances LIMIT 1;
    IF v_inst_id IS NULL THEN
        v_inst_id := '00000000-0000-0000-0000-000000000000'::uuid;
    END IF;

    -- Nếu user chưa có trong auth.users, tự động tạo mới
    INSERT INTO auth.users (
        instance_id, id, aud, role, email,
        encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data,
        is_super_admin, created_at, updated_at, confirmation_sent_at,
        confirmation_token, recovery_token
    ) VALUES (
        v_inst_id,
        p_target_user_id, 'authenticated', 'authenticated', LOWER(TRIM(v_email)),
        extensions.crypt(p_new_password, extensions.gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', v_full_name),
        FALSE, now(), now(), now(),
        '', ''
    )
    ON CONFLICT (id) DO UPDATE SET
        encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf')),
        updated_at = now();

    INSERT INTO auth.identities (
        id, user_id, identity_data, provider, provider_id,
        last_sign_in_at, created_at, updated_at
    ) VALUES (
        p_target_user_id, p_target_user_id,
        jsonb_build_object('sub', p_target_user_id::text, 'email', LOWER(TRIM(v_email)), 'email_verified', true),
        'email', LOWER(TRIM(v_email)),
        now(), now(), now()
    )
    ON CONFLICT (provider, provider_id) 
    DO UPDATE SET identity_data = EXCLUDED.identity_data, updated_at = now();

    RETURN jsonb_build_object('success', true, 'message', 'Đã đặt lại mật khẩu và kích hoạt tài khoản thành công.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_reset_user_password(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_user_password(UUID, TEXT) TO service_role;
