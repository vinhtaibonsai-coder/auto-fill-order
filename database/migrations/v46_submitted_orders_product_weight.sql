-- v46_submitted_orders_product_weight.sql
-- Thêm cột product_note và weight cho bảng submitted_orders

ALTER TABLE public.submitted_orders ADD COLUMN IF NOT EXISTS product_note TEXT;
ALTER TABLE public.submitted_orders ADD COLUMN IF NOT EXISTS weight INT;

COMMENT ON COLUMN public.submitted_orders.product_note IS 'Tên sản phẩm / hàng hóa hoặc ghi chú đơn hàng của vận chuyển';
COMMENT ON COLUMN public.submitted_orders.weight IS 'Cân nặng của gói hàng (grams)';
