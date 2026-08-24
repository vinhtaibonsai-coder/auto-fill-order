-- Admin control-plane contracts: scoped flags, transactional address releases,
-- complete KPIs, and infrastructure health. Apply after v35 and v45.

ALTER TABLE public.feature_flags
  ADD COLUMN IF NOT EXISTS scope_type TEXT NOT NULL DEFAULT 'global',
  ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS plan_code TEXT;

ALTER TABLE public.feature_flags DROP CONSTRAINT IF EXISTS feature_flags_scope_type_check;
ALTER TABLE public.feature_flags ADD CONSTRAINT feature_flags_scope_type_check
  CHECK (scope_type IN ('global', 'plan', 'shop', 'user'));

CREATE OR REPLACE FUNCTION public.activate_address_dataset(
  p_dataset_id UUID,
  p_action TEXT,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_dataset public.address_dataset_versions%ROWTYPE;
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'ACCESS_DENIED: SYSTEM_ADMIN only.';
  END IF;
  IF p_action NOT IN ('publish', 'rollback') THEN
    RAISE EXCEPTION 'INVALID_ACTION: publish or rollback required.';
  END IF;
  IF NULLIF(trim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'REASON_REQUIRED: release reason is required.';
  END IF;

  SELECT * INTO v_dataset
  FROM public.address_dataset_versions
  WHERE id = p_dataset_id
  FOR UPDATE;

  IF NOT FOUND OR COALESCE(v_dataset.total_records, 0) <= 0 THEN
    RAISE EXCEPTION 'DATASET_INVALID: version missing or contains no records.';
  END IF;

  UPDATE public.address_dataset_versions SET is_active = false WHERE is_active = true;
  UPDATE public.address_dataset_versions
  SET is_active = true, published_at = now()
  WHERE id = p_dataset_id;

  PERFORM public.insert_audit_log(
    CASE WHEN p_action = 'rollback' THEN 'ADDRESS_DATASET_ROLLBACK' ELSE 'ADDRESS_DATASET_PUBLISH' END,
    'address_dataset_version',
    p_dataset_id::text,
    jsonb_build_object('version', v_dataset.version, 'reason', p_reason, 'monitor_required', true),
    NULL
  );

  RETURN jsonb_build_object('success', true, 'dataset_id', p_dataset_id, 'action', p_action, 'monitor_required', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.activate_address_dataset(UUID, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_admin_kpis()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'ACCESS_DENIED: SYSTEM_ADMIN only.';
  END IF;

  SELECT jsonb_build_object(
    'shops_total', (SELECT count(*) FROM public.shops WHERE deleted_at IS NULL),
    'shops_active', (SELECT count(*) FROM public.shops WHERE deleted_at IS NULL AND lower(status) = 'active'),
    'shops_trial', (SELECT count(*) FROM public.subscriptions WHERE lower(status) = 'trial' OR plan_tier = 'TRIAL'),
    'shops_suspended', (SELECT count(*) FROM public.shops WHERE deleted_at IS NULL AND lower(status) = 'suspended'),
    'users_total', (SELECT count(*) FROM public.profiles),
    'users_active', (SELECT count(*) FROM public.profiles WHERE lower(status) = 'active'),
    'orders_total', (SELECT count(*) FROM public.submitted_orders WHERE deleted_at IS NULL),
    'orders_today', (SELECT count(*) FROM public.submitted_orders WHERE deleted_at IS NULL AND submitted_date = current_date),
    'ai_requests_total', (SELECT count(*) FROM public.ai_usage_log),
    'ai_requests_today', (SELECT count(*) FROM public.ai_usage_log WHERE created_at >= current_date),
    'ai_tokens_today', (SELECT COALESCE(sum(prompt_tokens + completion_tokens), 0) FROM public.ai_usage_log WHERE created_at >= current_date),
    'ai_errors_today', (SELECT count(*) FROM public.ai_usage_log WHERE created_at >= current_date AND status <> 'success'),
    'quota_risk_count', (SELECT count(*) FROM public.shop_quotas WHERE ai_monthly_limit > 0 AND ai_monthly_used::numeric / ai_monthly_limit >= 0.9),
    'subscription_risk_count', (SELECT count(*) FROM public.subscriptions WHERE lower(status) IN ('active', 'trial') AND current_period_end <= now() + interval '7 days'),
    'mrr', (SELECT COALESCE(sum(CASE plan_tier WHEN 'PRO_MONTH' THEN 199000 WHEN 'PRO_YEAR' THEN 1490000.0 / 12 WHEN 'ENTERPRISE' THEN 3990000.0 / 12 ELSE 0 END), 0) FROM public.subscriptions WHERE lower(status) = 'active')
  ) INTO v_result;
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_kpis() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_system_health()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_total INT;
  v_errors INT;
  v_quota INT;
  v_rls_ok BOOLEAN;
  v_sync_failed INT;
  v_carriers JSONB;
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'ACCESS_DENIED: SYSTEM_ADMIN only.';
  END IF;

  SELECT count(*), count(*) FILTER (WHERE status <> 'success'), count(*) FILTER (WHERE status IN ('quota_exceeded', 'rate_limited'))
  INTO v_total, v_errors, v_quota
  FROM public.ai_usage_log WHERE created_at >= now() - interval '24 hours';

  SELECT bool_and(c.relrowsecurity) INTO v_rls_ok
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname IN ('shops', 'submitted_orders', 'subscriptions', 'audit_logs', 'devices');

  SELECT count(*) INTO v_sync_failed FROM public.sync_outbox WHERE status = 'FAILED';

  SELECT COALESCE(jsonb_agg(x ORDER BY x.carrier_code), '[]'::jsonb) INTO v_carriers
  FROM (SELECT DISTINCT ON (carrier_code) carrier_code, status, response_time_ms, error_message, detected_at FROM public.carrier_health_logs ORDER BY carrier_code, detected_at DESC) x;

  RETURN jsonb_build_object(
    'supabase_status', 'healthy', 'auth_status', 'healthy',
    'rls_status', CASE WHEN COALESCE(v_rls_ok, false) THEN 'enforced' ELSE 'degraded' END,
    'sync_status', CASE WHEN v_sync_failed = 0 THEN 'healthy' ELSE 'degraded' END,
    'sync_failed', v_sync_failed,
    'ai_gateway_status', CASE WHEN v_errors = 0 THEN 'healthy' ELSE 'degraded' END,
    'provider_status', CASE WHEN v_total = 0 OR v_errors::numeric / NULLIF(v_total, 0) < 0.05 THEN 'healthy' ELSE 'degraded' END,
    'ai_total_24h', COALESCE(v_total, 0), 'ai_errors_24h', COALESCE(v_errors, 0),
    'ai_quota_limited_24h', COALESCE(v_quota, 0),
    'ai_success_rate', CASE WHEN COALESCE(v_total, 0) = 0 THEN 100 ELSE round((1 - v_errors::numeric / v_total) * 100, 2) END,
    'carriers', v_carriers, 'checked_at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_system_health() TO authenticated;
