-- =========================================================================
-- v44_carrier_configs_rls.sql
-- Kích hoạt Row-Level Security (RLS) và thiết lập chính sách bảo mật đa thuê
-- (multi-tenant) cho cấu hình kết nối bưu cục (carrier_configs).
-- =========================================================================

-- 1. Kích hoạt RLS
ALTER TABLE public.carrier_configs ENABLE ROW LEVEL SECURITY;

-- 2. Chính sách SELECT: Chỉ cho phép thành viên hoạt động của shop xem cấu hình
DROP POLICY IF EXISTS "Shop members can read carrier configs" ON public.carrier_configs;
CREATE POLICY "Shop members can read carrier configs" ON public.carrier_configs
  FOR SELECT TO authenticated
  USING (
    shop_id IN (
      SELECT shop_id FROM public.shop_members 
      WHERE user_id = auth.uid() AND removed_at IS NULL
    )
  );

-- 3. Chính sách ALL (INSERT/UPDATE/DELETE): Chỉ cho phép Chủ shop/Quản lý chỉnh sửa cấu hình
DROP POLICY IF EXISTS "Shop managers can write carrier configs" ON public.carrier_configs;
CREATE POLICY "Shop managers can write carrier configs" ON public.carrier_configs
  FOR ALL TO authenticated
  USING (
    shop_id IN (
      SELECT shop_id FROM public.shop_members 
      WHERE user_id = auth.uid() 
        AND role IN ('OWNER', 'SHOP_OWNER', 'MANAGER', 'SHOP_MANAGER')
        AND removed_at IS NULL
    )
  );

COMMENT ON TABLE public.carrier_configs IS 'Chính sách bảo mật RLS đa thuê bảo vệ mã bưu cục và tài khoản tích hợp bưu điện.';
