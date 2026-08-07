-- =========================================================================
-- v16_harden_security_rpc.sql
-- HARDCEN SECURITY: RPC ADMIN PHẢI KIỂM TRA QUYỀN Ở SERVER.
-- Nguyên tắc: Frontend chỉ là UX, KHÔNG phải security boundary.
-- Security boundary phải là: Browser -> RPC -> auth.uid() -> DB check.
--
-- Sửa 4 lỗ hổng:
--   1. get_user_role        -> IDOR: ai cũng truyền p_user_id bất kỳ để tra role
--   2. admin_list_users     -> Lộ toàn bộ user, không có guard quyền
--   3. admin_set_user_role  -> Guard dựa email hardcode; chuẩn hoá về is_system_admin()
--   4. admin_create_user / admin_reset_user_password -> Guard email hardcode
--
-- Dùng helper public.is_system_admin() đã định nghĩa ở v10_fix_rls_recursion.sql.
-- =========================================================================

-- =====================================================================
-- 1. get_user_role: chỉ cho phép xem role CỦA CHÍNH MÌNH, hoặc
--    Administrator được phép tra của người khác.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_user_role(p_user_id UUID DEFAULT auth.uid())
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    v_role_code TEXT;
BEGIN
    -- IDOR guard: user chỉ được xem chính mình; SYSTEM_ADMIN xem được bất kỳ ai
    IF p_user_id IS DISTINCT FROM auth.uid() AND NOT public.is_system_admin() THEN
        RAISE EXCEPTION 'Truy cập bị từ chối: Không có quyền xem vai trò của người khác.';
    END IF;

    SELECT r.code INTO v_role_code
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = p_user_id
    ORDER BY ur.created_at ASC
    LIMIT 1;

    RETURN v_role_code;
END;
$$;

-- =====================================================================
-- 2. admin_list_users: thêm guard SYSTEM_ADMIN
-- =====================================================================
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
    IF NOT public.is_system_admin() THEN
        RAISE EXCEPTION 'Truy cập bị từ chối: Yêu cầu quyền SYSTEM_ADMIN.';
    END IF;

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

-- =====================================================================
-- 3. admin_set_user_role: guard chuẩn hoá về is_system_admin()
-- =====================================================================
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
    IF NOT public.is_system_admin() THEN
        RAISE EXCEPTION 'Truy cập bị từ chối: Yêu cầu quyền SYSTEM_ADMIN.';
    END IF;

    -- Chống tự hạ cấp admin trên cùng -> an toàn hơn
    IF p_user_id = auth.uid() AND p_role_code <> 'SYSTEM_ADMIN' THEN
        RAISE EXCEPTION 'Không thể tự hạ quyền SYSTEM_ADMIN của chính mình.';
    END IF;

    SELECT id INTO v_role_id FROM public.roles WHERE code = p_role_code;
    IF v_role_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Role không tồn tại: ' || p_role_code);
    END IF;

    DELETE FROM public.user_roles WHERE user_id = p_user_id;
    INSERT INTO public.user_roles (user_id, role_id) VALUES (p_user_id, v_role_id);

    RETURN jsonb_build_object('success', true, 'user_id', p_user_id, 'role', p_role_code);
END;
$$;

-- =====================================================================
-- 4. admin_create_user: guard chuẩn hoá (giữ email fallback cũ nếu vẫn
--    muốn tương thích; khuyến nghị xoá khi DB đã có user_roles admin).
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
    IF NOT public.is_system_admin() THEN
        RAISE EXCEPTION 'Chỉ Master Admin mới có quyền tạo tài khoản mới.';
    END IF;

    IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_email) THEN
        RAISE EXCEPTION 'Email này đã được đăng ký trên hệ thống.';
    END IF;

    SELECT id INTO v_role_id FROM public.roles WHERE code = p_role_code;
    IF v_role_id IS NULL THEN
        RAISE EXCEPTION 'Role không tồn tại: %', p_role_code;
    END IF;

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
-- 5. admin_reset_user_password: guard chuẩn hoá
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
    IF NOT public.is_system_admin() THEN
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

-- =====================================================================
-- 6. admin_assign_user_shop / admin_change_user_role: thay guard trong
--    006_admin_rpc.sql bằng helper chuẩn (an toàn hơn, tránh lặp code).
-- =====================================================================
CREATE OR REPLACE FUNCTION public.admin_assign_user_shop(
    p_user_id UUID,
    p_shop_id UUID,
    p_role_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_role_id UUID;
    v_old_shop_id UUID;
    v_old_shop_name TEXT;
    v_new_shop_name TEXT;
BEGIN
    IF NOT public.is_system_admin() THEN
        RAISE EXCEPTION 'Truy cập bị từ chối: Yêu cầu quyền SYSTEM_ADMIN.';
    END IF;

    SELECT id INTO v_role_id FROM public.roles WHERE code = p_role_code LIMIT 1;
    IF v_role_id IS NULL THEN
        RAISE EXCEPTION 'Vai trò % không tồn tại.', p_role_code;
    END IF;

    SELECT shop_id INTO v_old_shop_id FROM public.shop_members WHERE user_id = p_user_id AND removed_at IS NULL LIMIT 1;
    SELECT name INTO v_old_shop_name FROM public.shops WHERE id = v_old_shop_id;
    SELECT name INTO v_new_shop_name FROM public.shops WHERE id = p_shop_id;

    UPDATE public.shop_members SET removed_at = now() WHERE user_id = p_user_id AND removed_at IS NULL;

    INSERT INTO public.shop_members (shop_id, user_id, role_id, status)
    VALUES (p_shop_id, p_user_id, v_role_id, 'active')
    ON CONFLICT (user_id) DO UPDATE SET
        shop_id = EXCLUDED.shop_id,
        role_id = EXCLUDED.role_id,
        removed_at = NULL,
        status = 'active';

    INSERT INTO public.audit_logs (actor_id, target_user, shop_id, action, old_value, new_value)
    VALUES (auth.uid(), p_user_id, p_shop_id, 'Assign Shop', coalesce(v_old_shop_name, 'Không có'), v_new_shop_name);

    RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_change_user_role(
    p_user_id UUID,
    p_new_role_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_role_id UUID;
    v_old_role_code TEXT;
    v_shop_id UUID;
BEGIN
    IF NOT public.is_system_admin() THEN
        RAISE EXCEPTION 'Truy cập bị từ chối: Yêu cầu quyền SYSTEM_ADMIN.';
    END IF;

    SELECT id INTO v_role_id FROM public.roles WHERE code = p_new_role_code LIMIT 1;
    IF v_role_id IS NULL THEN
        RAISE EXCEPTION 'Vai trò % không hợp lệ.', p_new_role_code;
    END IF;

    SELECT r.code, sm.shop_id INTO v_old_role_code, v_shop_id
    FROM public.shop_members sm
    JOIN public.roles r ON sm.role_id = r.id
    WHERE sm.user_id = p_user_id AND sm.removed_at IS NULL
    LIMIT 1;

    UPDATE public.shop_members SET role_id = v_role_id WHERE user_id = p_user_id AND removed_at IS NULL;

    INSERT INTO public.audit_logs (actor_id, target_user, shop_id, action, old_value, new_value)
    VALUES (auth.uid(), p_user_id, v_shop_id, 'Change Role', coalesce(v_old_role_code, 'Không có'), p_new_role_code);

    RETURN jsonb_build_object('success', true);
END;
$$;

-- Quyền gọi các RPC bảo mật: chỉ authenticated được EXECUTE
-- (mọi security quyết định nằm trong thân hàm qua is_system_admin())
GRANT EXECUTE ON FUNCTION public.get_user_role(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_assign_user_shop(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_change_user_role(UUID, TEXT) TO authenticated;

-- =====================================================================
-- GHI CHÚ:
--   - helper public.is_system_admin() định nghĩa tại v10_fix_rls_recursion.sql
--     -> query auth.uid() trực tiếp trong function SECURITY DEFINER.
--   - email hardcode ('admin@luathuysinh.vn') đã được thay bằng DB check.
--   - v15_role_dedup.sql vẫn có 1 guard email hardcode trong
--     admin_add_shop_member: chuẩn hoá nếu cần bổ sung ở bước sau.
-- =====================================================================