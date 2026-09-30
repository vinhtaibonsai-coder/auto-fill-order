-- =========================================================================
-- Migration v69: Cập nhật hàm admin_set_user_role hỗ trợ hạ quyền về USER
-- =========================================================================

CREATE OR REPLACE FUNCTION public.admin_set_user_role(p_user_id UUID, p_role_code TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE 
  v_role_id UUID;
  v_normalized_role TEXT;
BEGIN
  IF NOT public.is_system_admin() THEN 
    RAISE EXCEPTION 'ACCESS_DENIED'; 
  END IF;

  v_normalized_role := UPPER(TRIM(p_role_code));

  -- Chống tự hạ quyền của chính mình khi đang là SYSTEM_ADMIN
  IF p_user_id = auth.uid() AND v_normalized_role <> 'SYSTEM_ADMIN' THEN
    RAISE EXCEPTION 'Không thể tự hạ quyền SYSTEM_ADMIN của chính mình.';
  END IF;

  -- Trường hợp hạ quyền về người dùng tiêu chuẩn (USER / MEMBER / NONE / EXTENSION_USER)
  IF v_normalized_role IN ('USER', 'NONE', 'MEMBER', 'EXTENSION_USER', 'SHOP_STAFF', 'VIEWER') THEN
    DELETE FROM public.user_roles ur 
    USING public.roles r 
    WHERE ur.user_id = p_user_id 
      AND ur.role_id = r.id 
      AND r.code IN ('SYSTEM_ADMIN', 'SUPPORT_ADMIN', 'FINANCE_ADMIN', 'SUPPORT');
      
    PERFORM public.insert_audit_log('ADMIN_SET_USER_ROLE', 'user', p_user_id::text, jsonb_build_object('role', v_normalized_role), NULL);
    RETURN jsonb_build_object('success', true, 'message', 'Đã chuyển thành tài khoản người dùng tiêu chuẩn');
  END IF;

  -- Các vai trò quản trị hệ thống
  IF v_normalized_role NOT IN ('SYSTEM_ADMIN', 'SUPPORT_ADMIN', 'FINANCE_ADMIN', 'SUPPORT') THEN
    RAISE EXCEPTION 'INVALID_ROLE: %', p_role_code;
  END IF;

  SELECT id INTO v_role_id FROM public.roles WHERE code = v_normalized_role LIMIT 1;
  IF v_role_id IS NULL THEN
    -- Tự động thêm role nếu chưa tồn tại
    INSERT INTO public.roles (code, name) 
    VALUES (v_normalized_role, v_normalized_role)
    RETURNING id INTO v_role_id;
  END IF;

  -- Xóa các quyền admin cũ và gán quyền admin mới
  DELETE FROM public.user_roles ur 
  USING public.roles r 
  WHERE ur.user_id = p_user_id 
    AND ur.role_id = r.id 
    AND r.code IN ('SYSTEM_ADMIN', 'SUPPORT_ADMIN', 'FINANCE_ADMIN', 'SUPPORT');

  INSERT INTO public.user_roles (user_id, role_id) 
  VALUES (p_user_id, v_role_id) 
  ON CONFLICT DO NOTHING;

  PERFORM public.insert_audit_log('ADMIN_SET_USER_ROLE', 'user', p_user_id::text, jsonb_build_object('role', v_normalized_role), NULL);
  RETURN jsonb_build_object('success', true);
END $$;

GRANT EXECUTE ON FUNCTION public.admin_set_user_role(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(UUID, TEXT) TO service_role;
