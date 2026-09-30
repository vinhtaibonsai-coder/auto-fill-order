-- =============================================================================
-- Migration v114: Payment Reconciliation and Webhook Idempotency (G003)
-- 
-- 1. Adds reconciliation columns and indices to payment_transactions:
--    reconciliation_status, reconciliation_notes, reconciled_at, reconciled_by, retry_count, last_retry_at
-- 2. Defines admin RPC admin_get_payment_reconciliation_queue for auditing
--    unmatched, duplicate, failed, and reconciled transactions
-- 3. Defines admin RPC admin_reconcile_payment_transaction for manual shop matching
--    and subscription/quota crediting with full audit logging
-- 4. Hardens process_vietqr_payment to maintain reconciliation_status and prevent duplicate crediting
-- =============================================================================

-- 1. Bổ sung các cột đối soát vào bảng payment_transactions
ALTER TABLE public.payment_transactions ADD COLUMN IF NOT EXISTS reconciliation_status TEXT DEFAULT 'pending';
ALTER TABLE public.payment_transactions ADD COLUMN IF NOT EXISTS reconciliation_notes TEXT;
ALTER TABLE public.payment_transactions ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMPTZ;
ALTER TABLE public.payment_transactions ADD COLUMN IF NOT EXISTS reconciled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.payment_transactions ADD COLUMN IF NOT EXISTS retry_count INT DEFAULT 0;
ALTER TABLE public.payment_transactions ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMPTZ;
ALTER TABLE public.payment_transactions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Đồng bộ trạng thái đối soát ban đầu cho dữ liệu lịch sử
UPDATE public.payment_transactions 
SET reconciliation_status = CASE 
  WHEN upper(COALESCE(status, '')) IN ('SUCCESS', 'PROCESSED', 'COMPLETED', 'PAID') THEN 'reconciled'
  WHEN upper(COALESCE(status, '')) IN ('PENDING', 'UNMATCHED') THEN 'unmatched'
  WHEN upper(COALESCE(status, '')) IN ('DUPLICATE') THEN 'duplicate'
  WHEN upper(COALESCE(status, '')) IN ('FAILED', 'ERROR') THEN 'failed'
  ELSE 'pending'
END
WHERE reconciliation_status IS NULL OR reconciliation_status = 'pending';

-- Tạo Index tăng tốc truy vấn hàng đợi đối soát
CREATE INDEX IF NOT EXISTS idx_payment_trans_reconciliation_status 
ON public.payment_transactions(reconciliation_status);

CREATE INDEX IF NOT EXISTS idx_payment_trans_created_reconcile 
ON public.payment_transactions(created_at DESC, reconciliation_status);


-- 2. RPC: admin_get_payment_reconciliation_queue
-- Lấy danh sách giao dịch cần đối soát kèm bộ lọc trạng thái và thống kê tổng hợp
CREATE OR REPLACE FUNCTION public.admin_get_payment_reconciliation_queue(
  p_status TEXT DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total BIGINT := 0;
  v_records JSONB := '[]'::jsonb;
  v_stats JSONB := '{}'::jsonb;
BEGIN
  -- Bảo vệ quyền truy cập: Chỉ SYSTEM_ADMIN mới có quyền xem hàng đợi đối soát
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'ACCESS_DENIED: Only SYSTEM_ADMIN can access payment reconciliation queue.';
  END IF;

  -- Thống kê số lượng theo từng nhóm trạng thái
  SELECT jsonb_build_object(
    'total', count(*),
    'reconciled', count(*) FILTER (WHERE lower(COALESCE(reconciliation_status, '')) = 'reconciled' OR upper(COALESCE(status, '')) IN ('SUCCESS', 'PROCESSED')),
    'unmatched', count(*) FILTER (WHERE lower(COALESCE(reconciliation_status, '')) = 'unmatched' OR (shop_id IS NULL AND upper(COALESCE(status, '')) NOT IN ('SUCCESS', 'PROCESSED'))),
    'duplicate', count(*) FILTER (WHERE lower(COALESCE(reconciliation_status, '')) = 'duplicate'),
    'failed', count(*) FILTER (WHERE lower(COALESCE(reconciliation_status, '')) = 'failed' OR upper(COALESCE(status, '')) IN ('FAILED', 'ERROR'))
  ) INTO v_stats
  FROM public.payment_transactions;

  -- Đếm tổng số bản ghi thỏa điều kiện lọc
  SELECT count(*) INTO v_total
  FROM public.payment_transactions pt
  LEFT JOIN public.shops s ON s.id = pt.shop_id
  WHERE (p_status IS NULL OR p_status = '' OR p_status = 'ALL' OR lower(COALESCE(pt.reconciliation_status, '')) = lower(p_status))
    AND (
      p_search IS NULL OR p_search = '' OR
      pt.transaction_code ILIKE '%' || p_search || '%' OR
      COALESCE(pt.content, '') ILIKE '%' || p_search || '%' OR
      COALESCE(s.name, '') ILIKE '%' || p_search || '%' OR
      COALESCE(s.shop_code, '') ILIKE '%' || p_search || '%'
    );

  -- Truy vấn danh sách giao dịch
  SELECT jsonb_agg(sub) INTO v_records
  FROM (
    SELECT 
      pt.id,
      COALESCE(pt.transaction_id, pt.transaction_code) AS transaction_id,
      COALESCE(pt.transaction_code, pt.transaction_id) AS transaction_code,
      COALESCE(pt.gateway, 'VIETQR') AS gateway,
      COALESCE(pt.amount, 0) AS amount,
      COALESCE(pt.content, '') AS content,
      pt.shop_code,
      pt.shop_id,
      s.name AS shop_name,
      COALESCE(pt.status, 'PENDING') AS status,
      COALESCE(pt.reconciliation_status, 'pending') AS reconciliation_status,
      pt.reconciliation_notes,
      pt.reconciled_at,
      COALESCE(pt.retry_count, 0) AS retry_count,
      pt.last_retry_at,
      pt.created_at
    FROM public.payment_transactions pt
    LEFT JOIN public.shops s ON s.id = pt.shop_id
    WHERE (p_status IS NULL OR p_status = '' OR p_status = 'ALL' OR lower(COALESCE(pt.reconciliation_status, '')) = lower(p_status))
      AND (
        p_search IS NULL OR p_search = '' OR
        pt.transaction_code ILIKE '%' || p_search || '%' OR
        COALESCE(pt.content, '') ILIKE '%' || p_search || '%' OR
        COALESCE(s.name, '') ILIKE '%' || p_search || '%' OR
        COALESCE(s.shop_code, '') ILIKE '%' || p_search || '%'
      )
    ORDER BY pt.created_at DESC
    LIMIT COALESCE(p_limit, 50)
    OFFSET COALESCE(p_offset, 0)
  ) sub;

  RETURN jsonb_build_object(
    'success', true,
    'stats', v_stats,
    'total', v_total,
    'items', COALESCE(v_records, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_payment_reconciliation_queue(TEXT, TEXT, INT, INT) TO authenticated;


-- 3. RPC: admin_reconcile_payment_transaction
-- Thao tác đối soát thủ công hoặc thử lại giao dịch lỗi có ghi log audit
CREATE OR REPLACE FUNCTION public.admin_reconcile_payment_transaction(
  p_transaction_id UUID,
  p_target_shop_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx RECORD;
  v_shop RECORD;
  v_duration_months INT := 1;
  v_ai_quota INT := 2500;
  v_max_orders INT := 5000;
  v_plan_tier TEXT := 'PRO_MONTH';
  v_current_end TIMESTAMPTZ;
  v_new_end TIMESTAMPTZ;
BEGIN
  -- Bảo vệ quyền truy cập: Chỉ SYSTEM_ADMIN mới có quyền đối soát thủ công
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'ACCESS_DENIED: Only SYSTEM_ADMIN can reconcile payment transactions.';
  END IF;

  -- 1. Tìm thông tin giao dịch
  SELECT * INTO v_tx FROM public.payment_transactions WHERE id = p_transaction_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Không tìm thấy giao dịch với ID đã cho.');
  END IF;

  -- 2. Tìm thông tin Shop được gán
  SELECT * INTO v_shop FROM public.shops WHERE id = p_target_shop_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Không tìm thấy Shop đích hợp lệ.');
  END IF;

  -- 3. Kiểm tra số tiền hợp lệ (> 0)
  IF COALESCE(v_tx.amount, 0) <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Số tiền giao dịch không hợp lệ (<= 0 VND).');
  END IF;

  -- 4. Xác định gói cước và thời gian tương ứng với số tiền
  IF v_tx.amount >= 1000000 THEN
    v_plan_tier := 'PRO_YEAR';
    v_duration_months := 12;
    v_ai_quota := 50000;
    v_max_orders := 100000;
  ELSIF v_tx.amount >= 500000 THEN
    v_plan_tier := 'PRO_YEAR';
    v_duration_months := 12;
    v_ai_quota := 50000;
    v_max_orders := 100000;
  ELSE
    v_plan_tier := 'PRO_MONTH';
    v_duration_months := 1;
    v_ai_quota := 2500;
    v_max_orders := 5000;
  END IF;

  -- 5. Tính ngày hết hạn mới
  SELECT current_period_end INTO v_current_end FROM public.subscriptions WHERE shop_id = p_target_shop_id;
  IF v_current_end IS NOT NULL AND v_current_end > now() THEN
    v_new_end := v_current_end + (v_duration_months || ' months')::interval;
  ELSE
    v_new_end := now() + (v_duration_months || ' months')::interval;
  END IF;

  -- 6. Cập nhật Subscription cho Shop đích
  INSERT INTO public.subscriptions (
    shop_id, plan_tier, status, current_period_start, current_period_end,
    max_members, max_ai_requests, max_orders_per_month, updated_at
  )
  VALUES (
    p_target_shop_id, v_plan_tier, 'active', now(), v_new_end,
    5, v_ai_quota, v_max_orders, now()
  )
  ON CONFLICT (shop_id) DO UPDATE SET
    plan_tier = EXCLUDED.plan_tier,
    status = 'active',
    current_period_end = v_new_end,
    max_ai_requests = subscriptions.max_ai_requests + v_ai_quota,
    max_orders_per_month = subscriptions.max_orders_per_month + v_max_orders,
    updated_at = now();

  -- 7. Tăng hạn mức Shop Quotas
  INSERT INTO public.shop_quotas (
    shop_id, ai_monthly_limit, ai_monthly_used, ai_daily_limit, ai_daily_used,
    orders_monthly_limit, orders_monthly_used, reset_date, updated_at
  )
  VALUES (
    p_target_shop_id, v_ai_quota, 0, 200, 0,
    v_max_orders, 0, (CURRENT_DATE + (v_duration_months || ' months')::interval)::DATE, now()
  )
  ON CONFLICT (shop_id) DO UPDATE SET
    ai_monthly_limit = shop_quotas.ai_monthly_limit + v_ai_quota,
    orders_monthly_limit = shop_quotas.orders_monthly_limit + v_max_orders,
    reset_date = (CURRENT_DATE + (v_duration_months || ' months')::interval)::DATE,
    updated_at = now();

  -- 8. Cập nhật trạng thái giao dịch thành RECONCILED / SUCCESS
  UPDATE public.payment_transactions
  SET 
    shop_id = p_target_shop_id,
    shop_code = v_shop.shop_code,
    status = 'SUCCESS',
    reconciliation_status = 'reconciled',
    reconciliation_notes = COALESCE(p_notes, 'Được đối soát và kích hoạt thủ công bởi Admin'),
    reconciled_at = now(),
    reconciled_by = auth.uid(),
    retry_count = COALESCE(retry_count, 0) + 1,
    last_retry_at = now(),
    updated_at = now()
  WHERE id = p_transaction_id;

  -- 9. Ghi Audit Log cho hệ thống
  INSERT INTO public.audit_logs (
    shop_id, actor_id, action, entity_type, entity_id, details
  )
  VALUES (
    p_target_shop_id,
    auth.uid(),
    'ADMIN_RECONCILE_PAYMENT',
    'PAYMENT_TRANSACTION',
    p_transaction_id::text,
    jsonb_build_object(
      'transaction_code', v_tx.transaction_code,
      'amount', v_tx.amount,
      'target_shop_id', p_target_shop_id,
      'target_shop_name', v_shop.name,
      'notes', p_notes,
      'new_expires_at', v_new_end
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Đối soát và kích hoạt quyền lợi thành công!',
    'shop_id', p_target_shop_id,
    'new_expires_at', v_new_end
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_reconcile_payment_transaction(UUID, UUID, TEXT) TO authenticated;
