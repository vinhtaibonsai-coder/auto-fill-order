-- =====================================================================
-- Migration v23: Sửa lỗi RPC Đổi tên & Đổi mật khẩu cho Master Admin
-- =====================================================================

-- 1. Hàm admin_update_user_name (Đổi tên bất kỳ người dùng nào)
CREATE OR REPLACE FUNCTION public.admin_update_user_name(
    p_target_user_id UUID,
    p_full_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    IF NOT public.is_system_admin() THEN
        RAISE EXCEPTION 'Chỉ Master Admin mới có quyền đổi tên người dùng.';
    END IF;

    UPDATE public.profiles
    SET full_name = p_full_name, updated_at = now()
    WHERE id = p_target_user_id;

    RETURN jsonb_build_object('success', true, 'message', 'Đã đổi tên thành công.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_user_name(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_user_name(UUID, TEXT) TO service_role;

-- 2. Hàm admin_reset_user_password (Fix search_path để gọi crypt/gen_salt từ extensions hoặc public)
CREATE OR REPLACE FUNCTION public.admin_reset_user_password(
    p_target_user_id UUID,
    p_new_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth
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

