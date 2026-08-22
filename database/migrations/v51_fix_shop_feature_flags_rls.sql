-- =========================================================================
-- v51_fix_shop_feature_flags_rls.sql
-- Nâng cấp quyền cập nhật/thêm mới bảng shop_feature_flags cho cả vai trò MANAGER/SHOP_MANAGER
-- và các biến thể vai trò (tránh lỗi RLS khi lưu cấu hình).
-- =========================================================================

-- 1. Cập nhật chính sách UPDATE cho shop_feature_flags
DROP POLICY IF EXISTS "Shop owners update feature flags" ON public.shop_feature_flags;
CREATE POLICY "Shop owners update feature flags" ON public.shop_feature_flags
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.shop_members sm
      WHERE sm.shop_id = shop_feature_flags.shop_id
        AND sm.user_id = auth.uid()
        AND UPPER(sm.role) IN ('OWNER', 'SHOP_OWNER', 'MANAGER', 'SHOP_MANAGER', 'ADMIN', 'SHOP_ADMIN')
        AND LOWER(sm.status) = 'active'
        AND sm.removed_at IS NULL
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.code = 'SYSTEM_ADMIN'
    )
  );

-- 2. Cập nhật chính sách INSERT cho shop_feature_flags
DROP POLICY IF EXISTS "Shop owners insert feature flags" ON public.shop_feature_flags;
CREATE POLICY "Shop owners insert feature flags" ON public.shop_feature_flags
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shop_members sm
      WHERE sm.shop_id = shop_feature_flags.shop_id
        AND sm.user_id = auth.uid()
        AND UPPER(sm.role) IN ('OWNER', 'SHOP_OWNER', 'MANAGER', 'SHOP_MANAGER', 'ADMIN', 'SHOP_ADMIN')
        AND LOWER(sm.status) = 'active'
        AND sm.removed_at IS NULL
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.code = 'SYSTEM_ADMIN'
    )
  );

COMMENT ON POLICY "Shop owners update feature flags" ON public.shop_feature_flags IS 'Cho phép Owner và Manager cập nhật cờ tính năng và token API của shop.';
COMMENT ON POLICY "Shop owners insert feature flags" ON public.shop_feature_flags IS 'Cho phép Owner và Manager khởi tạo cờ tính năng và token API của shop.';
