-- =============================================================================
-- Migration v123: Harden admin_delete_shop IDOR Security Vulnerability (G016)
--
-- Finding: SEC-01 (CRITICAL)
-- The legacy admin_delete_shop(p_shop_id UUID) RPC was declared SECURITY DEFINER
-- without an explicit is_system_admin() authorization check, allowing any
-- authenticated user to delete arbitrary shops.
--
-- Remediation:
-- Enforce strict is_system_admin() check, set search_path = public, auth,
-- and record audit log on shop deletion.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_delete_shop(p_shop_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_shop_name TEXT;
BEGIN
  -- Strict authorization guard
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'Truy cập bị từ chối: Chỉ Master Admin mới có quyền thực hiện.';
  END IF;

  SELECT name INTO v_shop_name FROM public.shops WHERE id = p_shop_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Không tìm thấy Cửa hàng cần xóa.');
  END IF;

  -- Record audit log
  INSERT INTO public.audit_logs (actor_id, action, target_id, details)
  VALUES (
    auth.uid(),
    'ADMIN_DELETE_SHOP',
    p_shop_id,
    jsonb_build_object('shop_id', p_shop_id, 'shop_name', v_shop_name, 'deleted_at', now())
  );

  DELETE FROM public.shops WHERE id = p_shop_id;

  RETURN jsonb_build_object('success', true, 'message', 'Đã xóa Cửa hàng thành công.');
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_shop(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_delete_shop(UUID) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
