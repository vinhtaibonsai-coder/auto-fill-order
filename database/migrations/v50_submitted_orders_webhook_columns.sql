-- =========================================================================
-- v50_submitted_orders_webhook_columns.sql
-- Bổ sung các cột phục vụ đối soát tài chính và theo dõi lịch sử cập nhật vận đơn
-- từ Webhook đối với bảng đơn đã lên hệ thống (submitted_orders).
-- =========================================================================

-- 1. Bổ sung các cột đối soát vào bảng submitted_orders
ALTER TABLE public.submitted_orders ADD COLUMN IF NOT EXISTS shipping_fee NUMERIC DEFAULT 0;
ALTER TABLE public.submitted_orders ADD COLUMN IF NOT EXISTS actual_weight NUMERIC DEFAULT 0;
ALTER TABLE public.submitted_orders ADD COLUMN IF NOT EXISTS webhook_logs JSONB DEFAULT '[]'::jsonb;

-- 2. Đảm bảo cột status và updated_at tồn tại (đề phòng chạy không theo thứ tự từ v20)
ALTER TABLE public.submitted_orders ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'submitted';
ALTER TABLE public.submitted_orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 3. Tạo index phục vụ tìm kiếm vận đơn siêu tốc theo shop_id + tracking_code/order_code
CREATE INDEX IF NOT EXISTS idx_submitted_orders_matching
    ON public.submitted_orders (shop_id, tracking_code, order_code);
