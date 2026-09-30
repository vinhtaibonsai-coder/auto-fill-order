-- Migration: v121_prepaid_wallet_production_hardening.sql
-- Description: G011 Prepaid Wallet Production: immutable ledger enforcement, non-negative balance, AI credit reservation/compensation, mandatory reason and audit trail.

-- 1. Extend prepaid_wallets with reserved_balance for atomic AI reservation
ALTER TABLE public.prepaid_wallets ADD COLUMN IF NOT EXISTS reserved_balance NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK(reserved_balance >= 0);

-- Ensure non-negative balance constraint is enforced
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'prepaid_wallets_balance_check'
  ) THEN
    ALTER TABLE public.prepaid_wallets ADD CONSTRAINT prepaid_wallets_balance_check CHECK (balance >= 0);
  END IF;
END $$;

-- 2. Immutable Ledger Trigger: Disallow UPDATE or DELETE on wallet_ledger
CREATE OR REPLACE FUNCTION public.prevent_wallet_ledger_modification()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'IMMUTABLE_LEDGER: Wallet ledger entries cannot be altered or removed';
END;
$$;

DROP TRIGGER IF EXISTS tr_wallet_ledger_immutable ON public.wallet_ledger;
CREATE TRIGGER tr_wallet_ledger_immutable
  BEFORE UPDATE OR DELETE ON public.wallet_ledger
  FOR EACH ROW EXECUTE FUNCTION public.prevent_wallet_ledger_modification();

-- 3. RPC: wallet_reserve_ai_credit (Atomic Pre-authorization)
CREATE OR REPLACE FUNCTION public.wallet_reserve_ai_credit(
  p_shop_id UUID,
  p_max_amount NUMERIC,
  p_reservation_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_bal NUMERIC(14,2);
  v_res NUMERIC(14,2);
BEGIN
  IF p_max_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT: Reservation amount must be greater than zero';
  END IF;

  -- Atomic row lock
  SELECT balance, reserved_balance INTO v_bal, v_res
  FROM public.prepaid_wallets
  WHERE shop_id = p_shop_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'WALLET_NOT_FOUND: Shop has no prepaid wallet';
  END IF;

  IF v_bal < p_max_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE: Available balance % is less than reservation %', v_bal, p_max_amount;
  END IF;

  UPDATE public.prepaid_wallets
  SET 
    balance = balance - p_max_amount,
    reserved_balance = reserved_balance + p_max_amount,
    updated_at = now()
  WHERE shop_id = p_shop_id;

  RETURN jsonb_build_object(
    'success', true,
    'shop_id', p_shop_id,
    'reservation_id', p_reservation_id,
    'reserved_amount', p_max_amount,
    'remaining_balance', v_bal - p_max_amount
  );
END;
$$;

-- 4. RPC: wallet_settle_ai_credit (Settles actual token cost and refunds unused reserve)
CREATE OR REPLACE FUNCTION public.wallet_settle_ai_credit(
  p_shop_id UUID,
  p_reservation_id TEXT,
  p_actual_cost NUMERIC,
  p_max_reserved NUMERIC,
  p_metadata JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_bal NUMERIC(14,2);
  v_res NUMERIC(14,2);
  v_unused NUMERIC(14,2);
  v_final_bal NUMERIC(14,2);
BEGIN
  IF p_actual_cost < 0 THEN
    RAISE EXCEPTION 'INVALID_COST: Cost cannot be negative';
  END IF;

  SELECT balance, reserved_balance INTO v_bal, v_res
  FROM public.prepaid_wallets
  WHERE shop_id = p_shop_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'WALLET_NOT_FOUND';
  END IF;

  -- Calculate unused reservation to return to available balance
  v_unused := GREATEST(0, p_max_reserved - p_actual_cost);

  UPDATE public.prepaid_wallets
  SET 
    reserved_balance = GREATEST(0, reserved_balance - p_max_reserved),
    balance = balance + v_unused,
    updated_at = now()
  WHERE shop_id = p_shop_id
  RETURNING balance INTO v_final_bal;

  -- Record debit ledger entry for actual usage
  IF p_actual_cost > 0 THEN
    INSERT INTO public.wallet_ledger (
      shop_id,
      direction,
      amount,
      balance_after,
      reference_type,
      reference_id,
      description,
      created_by
    ) VALUES (
      p_shop_id,
      'debit',
      p_actual_cost,
      v_final_bal,
      'ai_request',
      p_reservation_id,
      COALESCE(p_metadata->>'description', 'AI Token Usage Settlement'),
      auth.uid()
    )
    ON CONFLICT (shop_id, reference_type, reference_id) DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'debited_amount', p_actual_cost,
    'refunded_unused_reserve', v_unused,
    'final_balance', v_final_bal
  );
END;
$$;

-- 5. RPC: wallet_compensate_ai_credit (Compensation refund on failure/timeout)
CREATE OR REPLACE FUNCTION public.wallet_compensate_ai_credit(
  p_shop_id UUID,
  p_reservation_id TEXT,
  p_reserved_amount NUMERIC,
  p_reason TEXT DEFAULT 'AI Gateway Error Compensation'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_final_bal NUMERIC(14,2);
BEGIN
  UPDATE public.prepaid_wallets
  SET 
    reserved_balance = GREATEST(0, reserved_balance - p_reserved_amount),
    balance = balance + p_reserved_amount,
    updated_at = now()
  WHERE shop_id = p_shop_id
  RETURNING balance INTO v_final_bal;

  RETURN jsonb_build_object(
    'success', true,
    'compensated_amount', p_reserved_amount,
    'final_balance', v_final_bal,
    'reason', p_reason
  );
END;
$$;

-- 6. RPC: admin_topup_wallet_with_audit (Mandatory Reason & Audit Invariant)
CREATE OR REPLACE FUNCTION public.admin_topup_wallet_with_audit(
  p_shop_id UUID,
  p_amount NUMERIC,
  p_reason TEXT,
  p_reference_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_balance NUMERIC(14,2);
  v_ref_id TEXT := COALESCE(NULLIF(trim(p_reference_id), ''), 'TOPUP-' || extract(epoch from now())::BIGINT);
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'ACCESS_DENIED';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT: Số tiền nạp phải lớn hơn 0';
  END IF;

  -- Invariant: "thao tác Admin bắt buộc lý do và audit."
  IF NULLIF(trim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'REASON_REQUIRED: Lý do nạp tiền ví là bắt buộc đối với Admin';
  END IF;

  INSERT INTO public.prepaid_wallets (shop_id, balance)
  VALUES (p_shop_id, p_amount)
  ON CONFLICT (shop_id) DO UPDATE SET 
    balance = public.prepaid_wallets.balance + p_amount,
    updated_at = now()
  RETURNING balance INTO v_balance;

  INSERT INTO public.wallet_ledger (
    shop_id,
    direction,
    amount,
    balance_after,
    reference_type,
    reference_id,
    description,
    created_by
  ) VALUES (
    p_shop_id,
    'credit',
    p_amount,
    v_balance,
    'admin_topup',
    v_ref_id,
    trim(p_reason),
    auth.uid()
  )
  ON CONFLICT (shop_id, reference_type, reference_id) DO NOTHING;

  -- Audit Log
  INSERT INTO public.audit_logs (user_id, action, target_type, target_id, details)
  VALUES (
    auth.uid(),
    'ADMIN_TOPUP_WALLET',
    'wallet',
    p_shop_id::TEXT,
    jsonb_build_object(
      'amount', p_amount,
      'reason', trim(p_reason),
      'reference_id', v_ref_id,
      'balance_after', v_balance
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'balance', v_balance,
    'reference_id', v_ref_id
  );
END;
$$;

-- 7. RPC: admin_refund_wallet_with_audit (Mandatory Reason & Audit Invariant)
CREATE OR REPLACE FUNCTION public.admin_refund_wallet_with_audit(
  p_shop_id UUID,
  p_amount NUMERIC,
  p_reason TEXT,
  p_reference_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_balance NUMERIC(14,2);
  v_ref_id TEXT := COALESCE(NULLIF(trim(p_reference_id), ''), 'REFUND-' || extract(epoch from now())::BIGINT);
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'ACCESS_DENIED';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT: Số tiền hoàn phải lớn hơn 0';
  END IF;

  IF NULLIF(trim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'REASON_REQUIRED: Lý do hoàn tiền ví là bắt buộc đối với Admin';
  END IF;

  INSERT INTO public.prepaid_wallets (shop_id, balance)
  VALUES (p_shop_id, p_amount)
  ON CONFLICT (shop_id) DO UPDATE SET 
    balance = public.prepaid_wallets.balance + p_amount,
    updated_at = now()
  RETURNING balance INTO v_balance;

  INSERT INTO public.wallet_ledger (
    shop_id,
    direction,
    amount,
    balance_after,
    reference_type,
    reference_id,
    description,
    created_by
  ) VALUES (
    p_shop_id,
    'credit',
    p_amount,
    v_balance,
    'admin_refund',
    v_ref_id,
    trim(p_reason),
    auth.uid()
  )
  ON CONFLICT (shop_id, reference_type, reference_id) DO NOTHING;

  -- Audit Log
  INSERT INTO public.audit_logs (user_id, action, target_type, target_id, details)
  VALUES (
    auth.uid(),
    'ADMIN_REFUND_WALLET',
    'wallet',
    p_shop_id::TEXT,
    jsonb_build_object(
      'amount', p_amount,
      'reason', trim(p_reason),
      'reference_id', v_ref_id,
      'balance_after', v_balance
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'balance', v_balance,
    'reference_id', v_ref_id
  );
END;
$$;

-- 8. RPC: admin_get_wallet_details
CREATE OR REPLACE FUNCTION public.admin_get_wallet_details(
  p_shop_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_wallet public.prepaid_wallets%ROWTYPE;
  v_ledger JSONB;
BEGIN
  IF NOT public.is_system_admin() AND NOT EXISTS(
    SELECT 1 FROM public.shop_members WHERE shop_id = p_shop_id AND user_id = auth.uid() AND removed_at IS NULL
  ) THEN
    RAISE EXCEPTION 'ACCESS_DENIED';
  END IF;

  SELECT * INTO v_wallet FROM public.prepaid_wallets WHERE shop_id = p_shop_id;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', l.id,
      'direction', l.direction,
      'amount', l.amount,
      'balance_after', l.balance_after,
      'reference_type', l.reference_type,
      'reference_id', l.reference_id,
      'description', l.description,
      'created_at', l.created_at
    ) ORDER BY l.created_at DESC
  ), '[]'::jsonb) INTO v_ledger
  FROM (
    SELECT * FROM public.wallet_ledger 
    WHERE shop_id = p_shop_id 
    ORDER BY created_at DESC 
    LIMIT 50
  ) l;

  RETURN jsonb_build_object(
    'shop_id', p_shop_id,
    'balance', COALESCE(v_wallet.balance, 0),
    'reserved_balance', COALESCE(v_wallet.reserved_balance, 0),
    'currency', COALESCE(v_wallet.currency, 'VND'),
    'updated_at', v_wallet.updated_at,
    'ledger', v_ledger
  );
END;
$$;

-- Grants
GRANT EXECUTE ON FUNCTION public.wallet_reserve_ai_credit(UUID, NUMERIC, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.wallet_settle_ai_credit(UUID, TEXT, NUMERIC, NUMERIC, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.wallet_compensate_ai_credit(UUID, TEXT, NUMERIC, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_topup_wallet_with_audit(UUID, NUMERIC, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_refund_wallet_with_audit(UUID, NUMERIC, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_get_wallet_details(UUID) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
