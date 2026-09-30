-- =============================================================================
-- Migration v81: Repair Supabase Auth rows used by password login
--
-- The previous reset RPC trusted profiles.id and only changed encrypted_password.
-- When profiles.id and auth.users.id drifted, the RPC could report success while
-- GoTrue still failed with HTTP 500 because the email identity was stale.  This
-- migration always resolves the canonical auth user by email, normalizes the
-- GoTrue fields, and recreates exactly one email identity.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

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
    v_user_id UUID;
    v_email TEXT;
    v_full_name TEXT;
    v_hash TEXT;
BEGIN
    IF auth.uid() IS NULL OR NOT public.is_system_admin() THEN
        RAISE EXCEPTION 'Chỉ Master Admin mới có quyền reset mật khẩu.';
    END IF;
    IF p_new_password IS NULL OR length(p_new_password) < 6 THEN
        RAISE EXCEPTION 'Mật khẩu phải có ít nhất 6 ký tự.';
    END IF;

    -- Prefer the existing auth row.  Falling back to profiles is only needed
    -- for legacy users whose auth row has not been created yet.
    SELECT u.id, lower(trim(u.email)),
           COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name')
      INTO v_user_id, v_email, v_full_name
      FROM auth.users u
     WHERE u.id = p_target_user_id
     LIMIT 1;

    IF v_user_id IS NULL THEN
        SELECT lower(trim(p.email)), p.full_name
          INTO v_email, v_full_name
          FROM public.profiles p
         WHERE p.id = p_target_user_id
         LIMIT 1;
        IF v_email IS NOT NULL THEN
            SELECT u.id
              INTO v_user_id
              FROM auth.users u
             WHERE lower(trim(u.email)) = v_email
             ORDER BY u.created_at NULLS LAST
             LIMIT 1;
        END IF;
    END IF;

    IF v_user_id IS NULL OR v_email IS NULL THEN
        RAISE EXCEPTION 'Không tìm thấy tài khoản cần reset.';
    END IF;

    v_full_name := COALESCE(NULLIF(trim(v_full_name), ''), split_part(v_email, '@', 1));
    v_hash := extensions.crypt(p_new_password, extensions.gen_salt('bf', 10));

    UPDATE auth.users
       SET email = v_email,
           encrypted_password = v_hash,
           email_confirmed_at = COALESCE(email_confirmed_at, now()),
           raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
           raw_user_meta_data = jsonb_build_object('full_name', v_full_name, 'name', v_full_name),
           banned_until = NULL,
           deleted_at = NULL,
           updated_at = now()
     WHERE id = v_user_id;

    -- GoTrue expects one coherent email identity for a password user.
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

REVOKE ALL ON FUNCTION public.admin_reset_user_password(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_reset_user_password(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_user_password(UUID, TEXT) TO service_role;

-- Login-time repair is intentionally narrow: it accepts an email, never a
-- caller-supplied user id, and repairs only an existing auth/profile record.
-- This preserves the extension's recovery path for projects without an Edge
-- Function.  Keep the RPC rate-limited at the Supabase/API gateway layer.
-- v78/v79 created this same signature with a DEFAULT password. PostgreSQL
-- cannot remove a parameter default through CREATE OR REPLACE, so replace the
-- legacy definition explicitly before installing the stricter signature.
DROP FUNCTION IF EXISTS public.admin_repair_user_auth(TEXT, TEXT);

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

    -- auth.users is canonical.  Profiles is only a legacy fallback.
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

GRANT EXECUTE ON FUNCTION public.admin_repair_user_auth(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.admin_repair_user_auth(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_repair_user_auth(TEXT, TEXT) TO service_role;
