-- =============================================================================
-- Migration v124: Secure admin_repair_user_auth Against Account Takeover (G016)
--
-- Finding: SEC-02 (CRITICAL)
-- admin_repair_user_auth was granted to anon and allowed setting any arbitrary
-- password without verifying the existing password or requiring is_system_admin().
--
-- Remediation:
-- 1. Enforce password verification: If called without system admin privileges,
--    the provided password must cryptographically match the existing encrypted_password.
--    This preserves HTTP 500 identity self-healing for legitimate users who know their
--    password while completely blocking unauthenticated account takeover.
-- 2. If called by SYSTEM_ADMIN, permit administrative reset with mandatory audit log.
-- 3. Revoke public execute; grant only to anon (for self-healing with verified password),
--    authenticated, and service_role.
-- =============================================================================

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
    v_existing_hash TEXT;
    v_new_hash TEXT;
    v_is_admin BOOLEAN := false;
BEGIN
    v_email := lower(trim(p_email));
    IF v_email IS NULL OR v_email = '' OR position('@' IN v_email) < 2 THEN
        RAISE EXCEPTION 'Email không hợp lệ.';
    END IF;
    IF p_password IS NULL OR length(p_password) < 6 THEN
        RAISE EXCEPTION 'Mật khẩu phải có ít nhất 6 ký tự.';
    END IF;

    -- Check if caller is system admin
    v_is_admin := public.is_system_admin();

    -- Locate canonical user in auth.users
    SELECT u.id, u.encrypted_password, COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name')
      INTO v_user_id, v_existing_hash, v_full_name
      FROM auth.users u
     WHERE lower(trim(u.email)) = v_email
     ORDER BY u.created_at NULLS LAST
     LIMIT 1;

    -- Fallback to profiles if not in auth.users
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

    -- CRITICAL SECURITY GUARD:
    -- If caller is not SYSTEM_ADMIN, verify that the provided password matches existing password
    IF NOT v_is_admin THEN
        IF v_existing_hash IS NOT NULL AND v_existing_hash <> '' THEN
            IF extensions.crypt(p_password, v_existing_hash) <> v_existing_hash THEN
                RAISE EXCEPTION 'Mật khẩu không chính xác. Chỉ chủ tài khoản hoặc Quản trị viên mới có thể phục hồi tài khoản.';
            END IF;
        ELSE
            -- No existing password hash to verify against: require system admin
            RAISE EXCEPTION 'Tài khoản chưa có mật khẩu khởi tạo. Vui lòng liên hệ Quản trị viên.';
        END IF;
    END IF;

    v_full_name := COALESCE(NULLIF(trim(v_full_name), ''), split_part(v_email, '@', 1));
    v_new_hash := extensions.crypt(p_password, extensions.gen_salt('bf', 10));

    -- Repair or update auth.users
    UPDATE auth.users
       SET email = v_email,
           encrypted_password = v_new_hash,
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

    -- Repair identities
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

    -- Audit trail
    INSERT INTO public.audit_logs (actor_id, action, target_id, details)
    VALUES (
        COALESCE(auth.uid(), v_user_id),
        CASE WHEN v_is_admin THEN 'ADMIN_REPAIR_USER_AUTH' ELSE 'SELF_HEAL_USER_AUTH' END,
        v_user_id,
        jsonb_build_object('email', v_email, 'is_admin_actor', v_is_admin, 'timestamp', now())
    );

    RETURN jsonb_build_object('success', true, 'user_id', v_user_id, 'email', v_email, 'self_healed', NOT v_is_admin);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_repair_user_auth(TEXT, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_repair_user_auth(TEXT, TEXT) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
