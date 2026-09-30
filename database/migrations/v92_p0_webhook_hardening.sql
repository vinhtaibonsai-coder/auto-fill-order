-- =============================================================================
-- Migration v92: P0-4 Webhook HMAC hardening - nonce + timestamp + idempotency
-- Tạo bảng webhook_nonces để chống replay, TTL 10m
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.webhook_nonces (
  nonce TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '10 minutes')
);

ALTER TABLE public.webhook_nonces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_manage_nonces" ON public.webhook_nonces;
CREATE POLICY "service_manage_nonces" ON public.webhook_nonces
  FOR ALL USING (auth.role() = 'service_role' OR public.is_system_admin())
  WITH CHECK (auth.role() = 'service_role' OR public.is_system_admin());

-- Index expires để cleanup nhanh
CREATE INDEX IF NOT EXISTS idx_webhook_nonces_expires ON public.webhook_nonces(expires_at);

-- Cron cleanup (nếu pg_cron có sẵn, không fail nếu chưa cài)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('cleanup-webhook-nonces', '*/10 * * * *', 'DELETE FROM public.webhook_nonces WHERE expires_at < now()');
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;

COMMENT ON TABLE public.webhook_nonces IS 'P0-4: nonce chống replay cho payment webhook, TTL 10m';

-- Đảm bảo payment_transactions.transaction_code đã có UNIQUE (đã có trong 001), thêm index cho idempotency-key alias
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_transactions_code ON public.payment_transactions(transaction_code);
