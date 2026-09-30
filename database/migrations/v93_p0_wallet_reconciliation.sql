-- =============================================================================
-- Migration v93: P0-7 Wallet Reconciliation - ledger vs gateway daily
-- Job hằng ngày đối soát ví, lệch 0đ trong 7 ngày mới GO
-- =============================================================================

-- 1. Gateway reports (nếu chưa có, dùng payment_transactions làm nguồn thì vẫn tạo bảng tổng hợp)
CREATE TABLE IF NOT EXISTS public.gateway_daily_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  report_date DATE NOT NULL,
  gateway_sum BIGINT NOT NULL DEFAULT 0, -- tổng tiền gateway báo trong ngày (đơn vị đồng)
  transaction_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (shop_id, report_date)
);

ALTER TABLE public.gateway_daily_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_manage_gateway_reports" ON public.gateway_daily_reports;
CREATE POLICY "service_manage_gateway_reports" ON public.gateway_daily_reports
  FOR ALL USING (auth.role() = 'service_role' OR public.is_system_admin())
  WITH CHECK (auth.role() = 'service_role' OR public.is_system_admin());
DROP POLICY IF EXISTS "shop_read_gateway_reports" ON public.gateway_daily_reports;
CREATE POLICY "shop_read_gateway_reports" ON public.gateway_daily_reports
  FOR SELECT USING (public.is_shop_member(shop_id) OR public.is_system_admin());

-- 2. Reconciliation runs (log hằng ngày)
CREATE TABLE IF NOT EXISTS public.reconciliation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date DATE NOT NULL,
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  ledger_sum BIGINT NOT NULL DEFAULT 0,
  gateway_sum BIGINT NOT NULL DEFAULT 0,
  diff BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ok', -- ok, diff, error
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (report_date, shop_id)
);

ALTER TABLE public.reconciliation_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_manage_reconciliation_runs" ON public.reconciliation_runs;
CREATE POLICY "service_manage_reconciliation_runs" ON public.reconciliation_runs
  FOR ALL USING (auth.role() = 'service_role' OR public.is_system_admin())
  WITH CHECK (auth.role() = 'service_role' OR public.is_system_admin());
DROP POLICY IF EXISTS "shop_read_reconciliation_runs" ON public.reconciliation_runs;
CREATE POLICY "shop_read_reconciliation_runs" ON public.reconciliation_runs
  FOR SELECT USING (public.is_shop_member(shop_id) OR public.is_system_admin());

CREATE INDEX IF NOT EXISTS idx_reconciliation_runs_date ON public.reconciliation_runs(report_date);
CREATE INDEX IF NOT EXISTS idx_reconciliation_runs_shop ON public.reconciliation_runs(shop_id);

-- 3. Alerts khi lệch
CREATE TABLE IF NOT EXISTS public.reconciliation_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date DATE NOT NULL,
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  diff BIGINT NOT NULL,
  ledger_sum BIGINT NOT NULL,
  gateway_sum BIGINT NOT NULL,
  resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.reconciliation_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_manage_reconciliation_alerts" ON public.reconciliation_alerts;
CREATE POLICY "service_manage_reconciliation_alerts" ON public.reconciliation_alerts
  FOR ALL USING (auth.role() = 'service_role' OR public.is_system_admin())
  WITH CHECK (auth.role() = 'service_role' OR public.is_system_admin());

-- 4. Function reconcile_wallets(p_date)
CREATE OR REPLACE FUNCTION public.reconcile_wallets(p_date DATE DEFAULT (CURRENT_DATE - 1))
RETURNS TABLE(shop_id UUID, ledger_sum BIGINT, gateway_sum BIGINT, diff BIGINT, status TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  IF NOT (public.is_system_admin() OR auth.role() = 'service_role') THEN
    RAISE EXCEPTION 'ACCESS_DENIED: chỉ SYSTEM_ADMIN/service_role mới được chạy reconcile';
  END IF;

  -- Xóa runs cũ cho ngày đó để idempotent
  -- (không xóa nếu muốn giữ history, nhưng cho phép rerun)
  FOR r IN
    SELECT
      coalesce(l.shop_id, g.shop_id) as sid,
      coalesce(l.sum_amount, 0) as lsum,
      coalesce(g.gateway_sum, 0) as gsum
    FROM
      (SELECT shop_id, SUM(amount)::BIGINT as sum_amount FROM public.wallet_ledger WHERE (created_at::date = p_date) GROUP BY shop_id) l
      FULL JOIN
      (SELECT shop_id, gateway_sum FROM public.gateway_daily_reports WHERE report_date = p_date) g
      ON l.shop_id = g.shop_id
  LOOP
    INSERT INTO public.reconciliation_runs (report_date, shop_id, ledger_sum, gateway_sum, diff, status)
    VALUES (p_date, r.sid, r.lsum, r.gsum, r.lsum - r.gsum, CASE WHEN r.lsum = r.gsum THEN 'ok' ELSE 'diff' END)
    ON CONFLICT (report_date, shop_id) DO UPDATE SET
      ledger_sum = EXCLUDED.ledger_sum,
      gateway_sum = EXCLUDED.gateway_sum,
      diff = EXCLUDED.diff,
      status = EXCLUDED.status,
      created_at = now();

    IF r.lsum <> r.gsum THEN
      INSERT INTO public.reconciliation_alerts (report_date, shop_id, diff, ledger_sum, gateway_sum)
      VALUES (p_date, r.sid, r.lsum - r.gsum, r.lsum, r.gsum)
      ON CONFLICT DO NOTHING;
    END IF;

    shop_id := r.sid;
    ledger_sum := r.lsum;
    gateway_sum := r.gsum;
    diff := r.lsum - r.gsum;
    status := CASE WHEN r.lsum = r.gsum THEN 'ok' ELSE 'diff' END;
    RETURN NEXT;
  END LOOP;

  -- Trường hợp không có shop nào trong ngày -> trả về 0 dòng (coi là ok)
  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reconcile_wallets(DATE) TO authenticated, service_role;

-- 5. Cron job 02:00 daily (nếu pg_cron có sẵn)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('reconcile-wallets-daily', '0 2 * * *', 'SELECT public.reconcile_wallets(CURRENT_DATE - 1)');
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;

COMMENT ON FUNCTION public.reconcile_wallets(DATE) IS 'P0-7: đối soát ledger vs gateway hằng ngày, lệch tạo alert';
