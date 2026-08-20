-- =========================================================================
-- v45_admin_impersonation_audit.sql
-- Thêm chức năng nạp log và kiểm tra đặc quyền cho việc hóa thân (Impersonation).
-- =========================================================================

CREATE OR REPLACE FUNCTION public.admin_start_impersonation(
  p_shop_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_user_email TEXT;
BEGIN
  -- 1. Xác thực đăng nhập
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Phiên đăng nhập không hợp lệ.');
  END IF;

  -- Đọc email admin
  SELECT email INTO v_user_email FROM public.profiles WHERE id = v_user_id;

  -- 2. Xác thực quyền SYSTEM_ADMIN của người hóa thân
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = v_user_id AND r.code = 'SYSTEM_ADMIN'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Chỉ Quản trị viên hệ thống (SYSTEM_ADMIN) mới có quyền hóa thân.');
  END IF;

  -- 3. Lý do bắt buộc
  IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lý do hóa thân (Reason) là bắt buộc để ghi nhận nhật ký hệ thống.');
  END IF;

  -- 4. Ghi nhận log hóa thân vào bảng audit_logs
  INSERT INTO public.audit_logs (
    actor_id,
    target_user,
    shop_id,
    action,
    target_resource,
    target_id,
    new_value
  )
  VALUES (
    v_user_id,
    NULL,
    p_shop_id,
    'IMPERSONATION_START',
    'shops',
    p_shop_id::text,
    jsonb_build_object('reason', p_reason, 'admin_email', v_user_email)::text
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Cấp quyền thực thi RPC cho Admin
GRANT EXECUTE ON FUNCTION public.admin_start_impersonation(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_start_impersonation(UUID, TEXT) TO service_role;

COMMENT ON FUNCTION public.admin_start_impersonation IS 'RPC kiểm tra quyền quản trị viên và ghi lại nhật ký bắt đầu hóa thân hỗ trợ shop khách hàng.';
