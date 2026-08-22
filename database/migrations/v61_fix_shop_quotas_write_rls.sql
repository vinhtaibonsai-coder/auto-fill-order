-- =========================================================================
-- v61_fix_shop_quotas_write_rls.sql
-- Thêm chính sách INSERT và UPDATE bảo mật RLS cho bảng shop_quotas.
-- Đảm bảo tài khoản SYSTEM_ADMIN được quyền cập nhật/thêm mới hạn ngạch shop
-- trực tiếp từ giao diện Admin Portal mà không bị lỗi vi phạm chính sách RLS.
-- =========================================================================

-- 1. Cho phép SYSTEM_ADMIN thêm mới cấu hình hạn ngạch
DROP POLICY IF EXISTS "Admins can insert quotas" ON public.shop_quotas;
CREATE POLICY "Admins can insert quotas" ON public.shop_quotas
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.code = 'SYSTEM_ADMIN'
    ) OR EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid() AND u.email = 'admin@luathuysinh.vn'
    )
  );

-- 2. Cho phép SYSTEM_ADMIN cập nhật cấu hình hạn ngạch
DROP POLICY IF EXISTS "Admins can update quotas" ON public.shop_quotas;
CREATE POLICY "Admins can update quotas" ON public.shop_quotas
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.code = 'SYSTEM_ADMIN'
    ) OR EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid() AND u.email = 'admin@luathuysinh.vn'
    )
  );
