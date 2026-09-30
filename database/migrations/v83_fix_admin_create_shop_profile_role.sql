-- =============================================================================
-- Migration v83: Fix profiles_role_check when creating a Shop account
--
-- profiles.role is a legacy compatibility column whose valid/default value is
-- `member`.  Real authorization belongs to user_roles and shop_members.  The
-- previous RPC wrote SHOP_OWNER into profiles.role and therefore failed with
-- PostgreSQL 23514 before the Shop could be created.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    BEGIN
        INSERT INTO public.profiles (
            id, email, full_name, avatar_url, status, created_at, updated_at
        ) VALUES (
            NEW.id,
            lower(trim(NEW.email)),
            COALESCE(
                NEW.raw_user_meta_data->>'full_name',
                NEW.raw_user_meta_data->>'name',
                split_part(NEW.email, '@', 1)
            ),
            NEW.raw_user_meta_data->>'avatar_url',
            'active',
            now(),
            now()
        )
        ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
            updated_at = now();
    EXCEPTION WHEN OTHERS THEN
        -- Profile metadata must never make GoTrue user creation fail.  The
        -- explicit upsert in admin_create_shop_with_account remains strict.
        NULL;
    END;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

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
    IF auth.uid() IS NULL OR NOT public.is_system_admin() THEN
        RAISE EXCEPTION 'Chỉ Master Admin mới có quyền tạo Shop và cấp tài khoản.';
    END IF;

    v_clean_email := lower(trim(p_owner_email));
    v_clean_name := COALESCE(NULLIF(trim(p_owner_full_name), ''), split_part(v_clean_email, '@', 1));

    IF NULLIF(trim(p_shop_name), '') IS NULL THEN
        RAISE EXCEPTION 'Tên Shop không được để trống.';
    END IF;
    IF v_clean_email IS NULL OR position('@' IN v_clean_email) < 2 THEN
        RAISE EXCEPTION 'Email không hợp lệ: %', p_owner_email;
    END IF;
    IF p_owner_password IS NULL OR length(p_owner_password) < 6 THEN
        RAISE EXCEPTION 'Mật khẩu phải có ít nhất 6 ký tự.';
    END IF;

    SELECT id INTO v_owner_role_id
    FROM public.roles
    WHERE code = 'SHOP_OWNER'
    LIMIT 1;
    IF v_owner_role_id IS NULL THEN
        SELECT id INTO v_owner_role_id
        FROM public.roles
        WHERE code = 'OWNER'
        LIMIT 1;
    END IF;
    IF v_owner_role_id IS NULL THEN
        INSERT INTO public.roles (code, name)
        VALUES ('SHOP_OWNER', 'Chủ Cửa hàng')
        RETURNING id INTO v_owner_role_id;
    END IF;

    -- auth.users is canonical.  profiles is a legacy fallback only.
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE lower(trim(email)) = v_clean_email
    LIMIT 1;
    IF v_user_id IS NULL THEN
        SELECT id INTO v_user_id
        FROM public.profiles
        WHERE lower(trim(email)) = v_clean_email
        LIMIT 1;
    END IF;
    IF v_user_id IS NULL THEN
        v_user_id := gen_random_uuid();
    END IF;

    SELECT id INTO v_inst_id FROM auth.instances LIMIT 1;
    IF v_inst_id IS NULL THEN
        v_inst_id := '00000000-0000-0000-0000-000000000000'::uuid;
    END IF;
    v_hash := extensions.crypt(p_owner_password, extensions.gen_salt('bf', 10));

    INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        is_super_admin, created_at, updated_at, confirmation_sent_at,
        confirmation_token, recovery_token, email_change_token_new,
        email_change, is_sso_user, deleted_at
    ) VALUES (
        v_inst_id, v_user_id, 'authenticated', 'authenticated', v_clean_email, v_hash,
        now(), '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', v_clean_name, 'name', v_clean_name),
        FALSE, now(), now(), now(), '', '', '', '', FALSE, NULL
    )
    ON CONFLICT (id) DO UPDATE SET
        email = v_clean_email,
        encrypted_password = v_hash,
        email_confirmed_at = COALESCE(auth.users.email_confirmed_at, now()),
        raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
        raw_user_meta_data = jsonb_build_object('full_name', v_clean_name, 'name', v_clean_name),
        banned_until = NULL,
        deleted_at = NULL,
        updated_at = now();

    DELETE FROM auth.identities
    WHERE user_id = v_user_id
       OR (provider = 'email' AND (
              provider_id = v_user_id::text
           OR provider_id = v_clean_email
           OR identity_data->>'email' = v_clean_email
       ));
    INSERT INTO auth.identities (
        id, user_id, identity_data, provider, provider_id,
        last_sign_in_at, created_at, updated_at
    ) VALUES (
        gen_random_uuid(), v_user_id,
        jsonb_build_object(
            'sub', v_user_id::text,
            'email', v_clean_email,
            'email_verified', true,
            'phone_verified', false
        ),
        'email', v_user_id::text, now(), now(), now()
    );

    -- Do not write a Shop role into profiles.role.  Its default remains member.
    INSERT INTO public.profiles (
        id, email, full_name, status, created_at, updated_at
    ) VALUES (
        v_user_id, v_clean_email, v_clean_name, 'active', now(), now()
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        status = 'active',
        updated_at = now();

    INSERT INTO public.user_roles (user_id, role_id)
    VALUES (v_user_id, v_owner_role_id)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.shops (name, owner_id, status)
    VALUES (trim(p_shop_name), v_user_id, 'active')
    RETURNING id INTO v_shop_id;

    INSERT INTO public.shop_members (shop_id, user_id, role_id, role, status)
    VALUES (v_shop_id, v_user_id, v_owner_role_id, 'OWNER', 'active')
    ON CONFLICT (shop_id, user_id) DO UPDATE SET
        role_id = v_owner_role_id,
        role = 'OWNER',
        status = 'active',
        removed_at = NULL;

    INSERT INTO public.shop_feature_flags (shop_id)
    VALUES (v_shop_id)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.shop_quotas (shop_id, max_devices, daily_ai_limit)
    VALUES (
        v_shop_id,
        GREATEST(COALESCE(p_max_devices, 5), 1),
        GREATEST(COALESCE(p_daily_ai_limit, 500), 0)
    )
    ON CONFLICT (shop_id) DO UPDATE SET
        max_devices = EXCLUDED.max_devices,
        daily_ai_limit = EXCLUDED.daily_ai_limit;

    PERFORM public.insert_audit_log(
        'ADMIN_CREATE_SHOP',
        'shop',
        v_shop_id::text,
        jsonb_build_object('shop_name', trim(p_shop_name), 'owner_email', v_clean_email),
        NULL
    );

    RETURN jsonb_build_object(
        'success', true,
        'shop_id', v_shop_id,
        'user_id', v_user_id,
        'email', v_clean_email
    );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_shop_with_account(TEXT, TEXT, TEXT, TEXT, INT, INT) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_create_shop_with_account(TEXT, TEXT, TEXT, TEXT, INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_shop_with_account(TEXT, TEXT, TEXT, TEXT, INT, INT) TO service_role;
