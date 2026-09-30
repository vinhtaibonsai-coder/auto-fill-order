-- Migration: v120_reseller_portal_production.sql
-- Description: G010 Complete Reseller Portal: referred shops, eligible revenue, commission lifecycle (pending/approved/paid/reversed), payout statements, and strict tenant isolation.

-- 1. Extend reseller_accounts with user_id for portal authentication and banking info
ALTER TABLE public.reseller_accounts ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE public.reseller_accounts ADD COLUMN IF NOT EXISTS contact_phone TEXT;
ALTER TABLE public.reseller_accounts ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE public.reseller_accounts ADD COLUMN IF NOT EXISTS bank_account_no TEXT;
ALTER TABLE public.reseller_accounts ADD COLUMN IF NOT EXISTS bank_account_holder TEXT;
ALTER TABLE public.reseller_accounts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_reseller_accounts_user_id ON public.reseller_accounts(user_id);

-- 2. Payout statements table
CREATE TABLE IF NOT EXISTS public.reseller_payout_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_code TEXT NOT NULL UNIQUE,
  reseller_id UUID NOT NULL REFERENCES public.reseller_accounts(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_eligible_revenue NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_commission_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  net_payout_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'approved', 'paid', 'cancelled')),
  payout_method TEXT DEFAULT 'BANK_TRANSFER',
  payout_ref TEXT,
  paid_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reseller_payout_reseller ON public.reseller_payout_statements(reseller_id, status);

-- 3. Reseller commissions table (stores both positive earnings and negative refund/chargeback reversals)
CREATE TABLE IF NOT EXISTS public.reseller_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id UUID NOT NULL REFERENCES public.reseller_accounts(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  payment_transaction_id UUID REFERENCES public.payment_transactions(id) ON DELETE SET NULL,
  eligible_revenue NUMERIC(15,2) NOT NULL DEFAULT 0,
  commission_rate NUMERIC(5,2) NOT NULL DEFAULT 10,
  commission_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'paid', 'reversed')),
  reference_id TEXT UNIQUE,
  notes TEXT,
  payout_statement_id UUID REFERENCES public.reseller_payout_statements(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_reseller_commissions_reseller_status ON public.reseller_commissions(reseller_id, status);
CREATE INDEX IF NOT EXISTS idx_reseller_commissions_payment ON public.reseller_commissions(payment_transaction_id);
CREATE INDEX IF NOT EXISTS idx_reseller_commissions_statement ON public.reseller_commissions(payout_statement_id);

-- 4. Enable RLS and enforce Strict Tenant Isolation
ALTER TABLE public.reseller_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reseller_shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reseller_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reseller_payout_statements ENABLE ROW LEVEL SECURITY;

-- Reseller Accounts policies
DROP POLICY IF EXISTS reseller_accounts_admin ON public.reseller_accounts;
CREATE POLICY reseller_accounts_admin ON public.reseller_accounts
  FOR ALL TO authenticated
  USING(public.is_system_admin())
  WITH CHECK(public.is_system_admin());

DROP POLICY IF EXISTS reseller_accounts_self ON public.reseller_accounts;
CREATE POLICY reseller_accounts_self ON public.reseller_accounts
  FOR SELECT TO authenticated
  USING(user_id = auth.uid());

-- Reseller Shops policies (Tenant Isolation)
DROP POLICY IF EXISTS reseller_shops_admin ON public.reseller_shops;
CREATE POLICY reseller_shops_admin ON public.reseller_shops
  FOR ALL TO authenticated
  USING(public.is_system_admin())
  WITH CHECK(public.is_system_admin());

DROP POLICY IF EXISTS reseller_shops_isolation ON public.reseller_shops;
CREATE POLICY reseller_shops_isolation ON public.reseller_shops
  FOR SELECT TO authenticated
  USING(reseller_id IN (SELECT id FROM public.reseller_accounts WHERE user_id = auth.uid()));

-- Reseller Commissions policies (Tenant Isolation)
DROP POLICY IF EXISTS reseller_commissions_admin ON public.reseller_commissions;
CREATE POLICY reseller_commissions_admin ON public.reseller_commissions
  FOR ALL TO authenticated
  USING(public.is_system_admin())
  WITH CHECK(public.is_system_admin());

DROP POLICY IF EXISTS reseller_commissions_isolation ON public.reseller_commissions;
CREATE POLICY reseller_commissions_isolation ON public.reseller_commissions
  FOR SELECT TO authenticated
  USING(reseller_id IN (SELECT id FROM public.reseller_accounts WHERE user_id = auth.uid()));

-- Reseller Payout Statements policies (Tenant Isolation)
DROP POLICY IF EXISTS reseller_payout_admin ON public.reseller_payout_statements;
CREATE POLICY reseller_payout_admin ON public.reseller_payout_statements
  FOR ALL TO authenticated
  USING(public.is_system_admin())
  WITH CHECK(public.is_system_admin());

DROP POLICY IF EXISTS reseller_payout_isolation ON public.reseller_payout_statements;
CREATE POLICY reseller_payout_isolation ON public.reseller_payout_statements
  FOR SELECT TO authenticated
  USING(reseller_id IN (SELECT id FROM public.reseller_accounts WHERE user_id = auth.uid()));

-- 5. RPC: reseller_get_portal_overview
CREATE OR REPLACE FUNCTION public.reseller_get_portal_overview(
  p_reseller_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_reseller_id UUID;
  v_reseller public.reseller_accounts%ROWTYPE;
  v_shops JSONB;
  v_commissions JSONB;
  v_statements JSONB;
  v_pending NUMERIC(15,2);
  v_approved NUMERIC(15,2);
  v_paid NUMERIC(15,2);
  v_reversed NUMERIC(15,2);
  v_revenue NUMERIC(15,2);
BEGIN
  -- Determine target reseller with tenant security
  IF public.is_system_admin() THEN
    IF p_reseller_id IS NOT NULL THEN
      v_reseller_id := p_reseller_id;
    ELSE
      SELECT id INTO v_reseller_id FROM public.reseller_accounts ORDER BY created_at ASC LIMIT 1;
    END IF;
  ELSE
    SELECT id INTO v_reseller_id FROM public.reseller_accounts WHERE user_id = auth.uid() LIMIT 1;
    IF v_reseller_id IS NULL THEN
      RAISE EXCEPTION 'ACCESS_DENIED_RESELLER_NOT_FOUND';
    END IF;
  END IF;

  IF v_reseller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No reseller account found');
  END IF;

  SELECT * INTO v_reseller FROM public.reseller_accounts WHERE id = v_reseller_id;

  -- Commission balance aggregates
  SELECT 
    COALESCE(SUM(eligible_revenue) FILTER (WHERE status != 'reversed'), 0),
    COALESCE(SUM(commission_amount) FILTER (WHERE status = 'pending'), 0),
    COALESCE(SUM(commission_amount) FILTER (WHERE status = 'approved'), 0),
    COALESCE(SUM(commission_amount) FILTER (WHERE status = 'paid'), 0),
    COALESCE(SUM(commission_amount) FILTER (WHERE status = 'reversed'), 0)
  INTO v_revenue, v_pending, v_approved, v_paid, v_reversed
  FROM public.reseller_commissions
  WHERE reseller_id = v_reseller_id;

  -- Referred shops
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'shop_id', s.id,
      'shop_name', s.name,
      'assigned_at', rs.assigned_at,
      'plan_tier', COALESCE(sub.plan_tier, sub.plan_code, 'FREE'),
      'orders_30d', COALESCE(o.orders_30d, 0)
    ) ORDER BY rs.assigned_at DESC
  ), '[]'::jsonb) INTO v_shops
  FROM public.reseller_shops rs
  JOIN public.shops s ON s.id = rs.shop_id
  LEFT JOIN public.subscriptions sub ON sub.shop_id = s.id
  LEFT JOIN (
    SELECT shop_id, COUNT(*) AS orders_30d 
    FROM public.submitted_orders 
    WHERE created_at >= now() - INTERVAL '30 days' AND deleted_at IS NULL
    GROUP BY shop_id
  ) o ON o.shop_id = s.id
  WHERE rs.reseller_id = v_reseller_id;

  -- Recent commissions
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', rc.id,
      'shop_id', rc.shop_id,
      'shop_name', s.name,
      'eligible_revenue', rc.eligible_revenue,
      'commission_rate', rc.commission_rate,
      'commission_amount', rc.commission_amount,
      'status', rc.status,
      'reference_id', rc.reference_id,
      'notes', rc.notes,
      'created_at', rc.created_at,
      'approved_at', rc.approved_at,
      'paid_at', rc.paid_at
    ) ORDER BY rc.created_at DESC
  ), '[]'::jsonb) INTO v_commissions
  FROM public.reseller_commissions rc
  JOIN public.shops s ON s.id = rc.shop_id
  WHERE rc.reseller_id = v_reseller_id
  LIMIT 50;

  -- Payout statements
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', rps.id,
      'statement_code', rps.statement_code,
      'period_start', rps.period_start,
      'period_end', rps.period_end,
      'total_eligible_revenue', rps.total_eligible_revenue,
      'total_commission_amount', rps.total_commission_amount,
      'net_payout_amount', rps.net_payout_amount,
      'status', rps.status,
      'payout_method', rps.payout_method,
      'payout_ref', rps.payout_ref,
      'paid_at', rps.paid_at,
      'created_at', rps.created_at
    ) ORDER BY rps.created_at DESC
  ), '[]'::jsonb) INTO v_statements
  FROM public.reseller_payout_statements rps
  WHERE rps.reseller_id = v_reseller_id;

  RETURN jsonb_build_object(
    'reseller_id', v_reseller.id,
    'name', v_reseller.name,
    'code', v_reseller.code,
    'commission_rate', v_reseller.commission_rate,
    'status', v_reseller.status,
    'bank_name', v_reseller.bank_name,
    'bank_account_no', v_reseller.bank_account_no,
    'bank_account_holder', v_reseller.bank_account_holder,
    'referred_shops_count', jsonb_array_length(v_shops),
    'eligible_revenue_total', v_revenue,
    'commission_pending', v_pending,
    'commission_approved', v_approved,
    'commission_paid', v_paid,
    'commission_reversed', v_reversed,
    'net_claimable_commission', GREATEST(0, v_approved + v_reversed),
    'referred_shops', v_shops,
    'recent_commissions', v_commissions,
    'payout_statements', v_statements,
    'retrieved_at', now()
  );
END;
$$;

-- 6. RPC: record_reseller_commission_from_payment
CREATE OR REPLACE FUNCTION public.record_reseller_commission_from_payment(
  p_payment_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_payment public.payment_transactions%ROWTYPE;
  v_reseller_shop public.reseller_shops%ROWTYPE;
  v_reseller public.reseller_accounts%ROWTYPE;
  v_commission_amount NUMERIC(15,2);
  v_ref_id TEXT;
  v_comm_id UUID;
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'ACCESS_DENIED';
  END IF;

  SELECT * INTO v_payment FROM public.payment_transactions WHERE id = p_payment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYMENT_TRANSACTION_NOT_FOUND';
  END IF;

  -- Only reconciled payments generate commission
  IF v_payment.reconciliation_status != 'reconciled' AND v_payment.status != 'COMPLETED' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Payment not reconciled yet');
  END IF;

  IF v_payment.shop_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'No shop associated with payment');
  END IF;

  -- Check if shop belongs to a reseller
  SELECT * INTO v_reseller_shop FROM public.reseller_shops WHERE shop_id = v_payment.shop_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Shop does not belong to any reseller');
  END IF;

  SELECT * INTO v_reseller FROM public.reseller_accounts WHERE id = v_reseller_shop.reseller_id;
  IF v_reseller.status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Reseller is not active');
  END IF;

  v_commission_amount := round(v_payment.amount * (v_reseller.commission_rate / 100), 2);
  v_ref_id := 'COMM-PAY-' || v_payment.id::TEXT;

  INSERT INTO public.reseller_commissions (
    reseller_id,
    shop_id,
    payment_transaction_id,
    eligible_revenue,
    commission_rate,
    commission_amount,
    status,
    reference_id,
    notes,
    created_at
  ) VALUES (
    v_reseller.id,
    v_payment.shop_id,
    v_payment.id,
    v_payment.amount,
    v_reseller.commission_rate,
    v_commission_amount,
    'approved', -- Pre-approved upon payment reconciliation
    v_ref_id,
    'Commission from reconciled transaction ' || COALESCE(v_payment.transaction_code, v_payment.id::TEXT),
    now()
  )
  ON CONFLICT (reference_id) DO NOTHING
  RETURNING id INTO v_comm_id;

  RETURN jsonb_build_object(
    'success', true,
    'commission_id', v_comm_id,
    'reseller_id', v_reseller.id,
    'commission_amount', v_commission_amount,
    'created', v_comm_id IS NOT NULL
  );
END;
$$;

-- 7. RPC: reverse_reseller_commission_for_refund
CREATE OR REPLACE FUNCTION public.reverse_reseller_commission_for_refund(
  p_payment_id UUID,
  p_refund_amount NUMERIC,
  p_reason TEXT DEFAULT 'Customer Refund / Chargeback'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_orig_comm public.reseller_commissions%ROWTYPE;
  v_reversal_revenue NUMERIC(15,2);
  v_reversal_amount NUMERIC(15,2);
  v_ref_id TEXT;
  v_reversal_id UUID;
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'ACCESS_DENIED';
  END IF;

  SELECT * INTO v_orig_comm 
  FROM public.reseller_commissions 
  WHERE payment_transaction_id = p_payment_id 
    AND status IN ('pending', 'approved', 'paid')
  ORDER BY created_at DESC 
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'No active commission found for this payment');
  END IF;

  v_reversal_revenue := -1 * abs(p_refund_amount);
  v_reversal_amount := -1 * round(abs(p_refund_amount) * (v_orig_comm.commission_rate / 100), 2);
  v_ref_id := 'REV-COMM-' || v_orig_comm.id::TEXT || '-' || extract(epoch from now())::BIGINT;

  INSERT INTO public.reseller_commissions (
    reseller_id,
    shop_id,
    payment_transaction_id,
    eligible_revenue,
    commission_rate,
    commission_amount,
    status,
    reference_id,
    notes,
    created_at
  ) VALUES (
    v_orig_comm.reseller_id,
    v_orig_comm.shop_id,
    p_payment_id,
    v_reversal_revenue,
    v_orig_comm.commission_rate,
    v_reversal_amount,
    'reversed',
    v_ref_id,
    'Reversal for ' || COALESCE(p_reason, 'Refund') || ' (Original comm: ' || v_orig_comm.id::TEXT || ')',
    now()
  )
  RETURNING id INTO v_reversal_id;

  RETURN jsonb_build_object(
    'success', true,
    'reversal_id', v_reversal_id,
    'reseller_id', v_orig_comm.reseller_id,
    'reversal_amount', v_reversal_amount,
    'reason', p_reason
  );
END;
$$;

-- 8. RPC: admin_generate_reseller_payout_statement
CREATE OR REPLACE FUNCTION public.admin_generate_reseller_payout_statement(
  p_reseller_id UUID,
  p_period_start DATE,
  p_period_end DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_statement_code TEXT;
  v_statement_id UUID;
  v_total_revenue NUMERIC(15,2);
  v_total_comm NUMERIC(15,2);
  v_net_payout NUMERIC(15,2);
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'ACCESS_DENIED';
  END IF;

  -- Sum eligible approved commissions and reversals in period
  SELECT 
    COALESCE(SUM(eligible_revenue), 0),
    COALESCE(SUM(commission_amount), 0)
  INTO v_total_revenue, v_total_comm
  FROM public.reseller_commissions
  WHERE reseller_id = p_reseller_id
    AND status IN ('approved', 'reversed')
    AND payout_statement_id IS NULL
    AND created_at::DATE BETWEEN p_period_start AND p_period_end;

  v_net_payout := GREATEST(0, v_total_comm);
  v_statement_code := 'PAY-RES-' || to_char(now(), 'YYYYMMDD') || '-' || substr(gen_random_uuid()::TEXT, 1, 6);

  INSERT INTO public.reseller_payout_statements (
    statement_code,
    reseller_id,
    period_start,
    period_end,
    total_eligible_revenue,
    total_commission_amount,
    net_payout_amount,
    status,
    created_by,
    created_at
  ) VALUES (
    v_statement_code,
    p_reseller_id,
    p_period_start,
    p_period_end,
    v_total_revenue,
    v_total_comm,
    v_net_payout,
    'approved',
    auth.uid(),
    now()
  )
  RETURNING id INTO v_statement_id;

  -- Link commissions to this statement
  UPDATE public.reseller_commissions
  SET payout_statement_id = v_statement_id
  WHERE reseller_id = p_reseller_id
    AND status IN ('approved', 'reversed')
    AND payout_statement_id IS NULL
    AND created_at::DATE BETWEEN p_period_start AND p_period_end;

  -- Record audit log
  INSERT INTO public.audit_logs (actor_id, action, target_id, details)
  VALUES (
    auth.uid(),
    'GENERATE_RESELLER_PAYOUT',
    v_statement_id,
    jsonb_build_object(
      'reseller_id', p_reseller_id,
      'statement_code', v_statement_code,
      'net_payout_amount', v_net_payout,
      'period_start', p_period_start,
      'period_end', p_period_end
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'statement_id', v_statement_id,
    'statement_code', v_statement_code,
    'net_payout_amount', v_net_payout
  );
END;
$$;

-- 9. RPC: admin_pay_reseller_statement
CREATE OR REPLACE FUNCTION public.admin_pay_reseller_statement(
  p_statement_id UUID,
  p_payout_ref TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'ACCESS_DENIED';
  END IF;

  UPDATE public.reseller_payout_statements
  SET 
    status = 'paid',
    payout_ref = trim(p_payout_ref),
    paid_at = now(),
    updated_at = now()
  WHERE id = p_statement_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'STATEMENT_NOT_FOUND';
  END IF;

  -- Mark linked commissions as paid
  UPDATE public.reseller_commissions
  SET 
    status = 'paid',
    paid_at = now()
  WHERE payout_statement_id = p_statement_id
    AND status = 'approved';

  -- Record audit log
  INSERT INTO public.audit_logs (actor_id, action, target_id, details)
  VALUES (
    auth.uid(),
    'PAY_RESELLER_STATEMENT',
    p_statement_id,
    jsonb_build_object('payout_ref', p_payout_ref, 'paid_at', now())
  );

  RETURN jsonb_build_object(
    'success', true,
    'statement_id', p_statement_id,
    'status', 'paid',
    'paid_at', now()
  );
END;
$$;

-- Grants
GRANT SELECT ON public.reseller_commissions TO authenticated, service_role;
GRANT SELECT ON public.reseller_payout_statements TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reseller_get_portal_overview(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_reseller_commission_from_payment(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reverse_reseller_commission_for_refund(UUID, NUMERIC, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_generate_reseller_payout_statement(UUID, DATE, DATE) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_pay_reseller_statement(UUID, TEXT) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
