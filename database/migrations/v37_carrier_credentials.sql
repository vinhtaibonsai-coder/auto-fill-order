-- =========================================================================
-- v37_carrier_credentials.sql
-- MIGRATION BỔ SUNG: Cấu hình mã khách hàng và API token cho VNPost & J&T Express
-- =========================================================================

ALTER TABLE public.shop_feature_flags
ADD COLUMN IF NOT EXISTS vnpost_customer_code TEXT,
ADD COLUMN IF NOT EXISTS vnpost_api_token TEXT,
ADD COLUMN IF NOT EXISTS jt_customer_code TEXT,
ADD COLUMN IF NOT EXISTS jt_api_key TEXT;

ALTER TABLE public.submitted_orders
ADD COLUMN IF NOT EXISTS carrier_account TEXT;

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS carrier_account TEXT;

COMMENT ON COLUMN public.shop_feature_flags.vnpost_customer_code IS 'Mã khách hàng VNPost (Customer Code) dùng cho Webhook & API';
COMMENT ON COLUMN public.shop_feature_flags.vnpost_api_token IS 'Token bảo mật API VNPost';
COMMENT ON COLUMN public.shop_feature_flags.jt_customer_code IS 'Mã khách hàng J&T (VIP Code) dùng cho API';
COMMENT ON COLUMN public.shop_feature_flags.jt_api_key IS 'Mật khẩu API hoặc Secret Key của J&T Express';
COMMENT ON COLUMN public.submitted_orders.carrier_account IS 'Tài khoản đại lý/cá nhân dùng để đăng nhập và lên đơn trên trang VNPost/J&T';
COMMENT ON COLUMN public.orders.carrier_account IS 'Tài khoản đại lý/cá nhân dùng để đăng nhập và lên đơn trên trang VNPost/J&T';
