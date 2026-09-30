-- P1/P2 commercial intelligence: auditable costs, truthful unit economics,
-- retention cohorts and one permission-checked global search endpoint.

CREATE TABLE IF NOT EXISTS public.commercial_cost_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cost_type TEXT NOT NULL CHECK (cost_type IN ('MARKETING','AI','INFRASTRUCTURE','SUPPORT','OTHER')),
  amount NUMERIC(16,2) NOT NULL CHECK (amount >= 0),
  occurred_at TIMESTAMPTZ NOT NULL,
  shop_id UUID REFERENCES public.shops(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'MANUAL',
  external_ref TEXT,
  note TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(source, external_ref)
);

CREATE TABLE IF NOT EXISTS public.ai_model_cost_rates (
  model TEXT PRIMARY KEY,
  input_cost_per_million NUMERIC(16,6) NOT NULL CHECK (input_cost_per_million >= 0),
  output_cost_per_million NUMERIC(16,6) NOT NULL CHECK (output_cost_per_million >= 0),
  currency TEXT NOT NULL DEFAULT 'VND',
  effective_from TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_commercial_cost_entries_period ON public.commercial_cost_entries(occurred_at DESC, cost_type);
CREATE INDEX IF NOT EXISTS idx_commercial_cost_entries_shop ON public.commercial_cost_entries(shop_id, occurred_at DESC);
ALTER TABLE public.commercial_cost_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_model_cost_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS commercial_cost_entries_admin ON public.commercial_cost_entries;
CREATE POLICY commercial_cost_entries_admin ON public.commercial_cost_entries FOR ALL TO authenticated
  USING (public.is_system_admin()) WITH CHECK (public.is_system_admin());
DROP POLICY IF EXISTS ai_model_cost_rates_admin ON public.ai_model_cost_rates;
CREATE POLICY ai_model_cost_rates_admin ON public.ai_model_cost_rates FOR ALL TO authenticated
  USING (public.is_system_admin()) WITH CHECK (public.is_system_admin());

CREATE OR REPLACE FUNCTION public.admin_get_commercial_intelligence(
  p_from TIMESTAMPTZ,
  p_to TIMESTAMPTZ,
  p_previous_from TIMESTAMPTZ,
  p_previous_to TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_revenue NUMERIC := 0;
  v_previous_revenue NUMERIC := 0;
  v_marketing NUMERIC := 0;
  v_ai_cost NUMERIC := 0;
  v_new_shops BIGINT := 0;
  v_paying_shops BIGINT := 0;
  v_active_start BIGINT := 0;
  v_churned BIGINT := 0;
  v_cac NUMERIC;
  v_arpu NUMERIC;
  v_churn_rate NUMERIC;
  v_ltv NUMERIC;
  v_shop_margins JSONB := '[]'::jsonb;
  v_cohorts JSONB := '[]'::jsonb;
BEGIN
  IF NOT public.is_system_admin() THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;
  IF p_from IS NULL OR p_to IS NULL OR p_previous_from IS NULL OR p_previous_to IS NULL OR p_from > p_to THEN
    RAISE EXCEPTION 'INVALID_PERIOD';
  END IF;

  SELECT COALESCE(sum(amount),0), count(DISTINCT shop_id)
    INTO v_revenue, v_paying_shops
    FROM public.payment_transactions
   WHERE created_at BETWEEN p_from AND p_to AND upper(COALESCE(status,'')) IN ('SUCCESS','SUCCEEDED','PAID','COMPLETED');
  SELECT COALESCE(sum(amount),0) INTO v_previous_revenue
    FROM public.payment_transactions
   WHERE created_at BETWEEN p_previous_from AND p_previous_to AND upper(COALESCE(status,'')) IN ('SUCCESS','SUCCEEDED','PAID','COMPLETED');
  SELECT COALESCE(sum(amount),0) INTO v_marketing FROM public.commercial_cost_entries
   WHERE occurred_at BETWEEN p_from AND p_to AND cost_type='MARKETING';
  SELECT count(*) INTO v_new_shops FROM public.shops WHERE created_at BETWEEN p_from AND p_to;
  SELECT count(*) INTO v_active_start FROM public.subscriptions
   WHERE created_at < p_from AND lower(COALESCE(status,'')) IN ('active','trialing');
  SELECT count(*) INTO v_churned FROM public.subscriptions
   WHERE updated_at BETWEEN p_from AND p_to AND lower(COALESCE(status,'')) IN ('cancelled','expired','past_due');
  SELECT COALESCE(sum(amount),0) INTO v_ai_cost FROM public.commercial_cost_entries
   WHERE occurred_at BETWEEN p_from AND p_to AND cost_type='AI';

  v_cac := CASE WHEN v_new_shops > 0 THEN round(v_marketing / v_new_shops,2) ELSE NULL END;
  v_arpu := CASE WHEN v_paying_shops > 0 THEN round(v_revenue / v_paying_shops,2) ELSE NULL END;
  v_churn_rate := CASE WHEN v_active_start > 0 THEN round(v_churned::numeric / v_active_start * 100,2) ELSE NULL END;
  v_ltv := CASE WHEN v_arpu IS NOT NULL AND v_churn_rate > 0 THEN round(v_arpu / (v_churn_rate / 100),2) ELSE NULL END;

  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.margin_amount DESC), '[]'::jsonb) INTO v_shop_margins
  FROM (
    SELECT s.id AS shop_id, s.name AS shop_name,
           COALESCE(p.revenue,0) AS revenue,
           COALESCE(c.cost,0) AS ai_cost,
           COALESCE(p.revenue,0)-COALESCE(c.cost,0) AS margin_amount,
           CASE WHEN COALESCE(p.revenue,0)>0 THEN round((COALESCE(p.revenue,0)-COALESCE(c.cost,0))/p.revenue*100,2) ELSE NULL END AS margin_percent
      FROM public.shops s
      LEFT JOIN (SELECT shop_id,sum(amount) revenue FROM public.payment_transactions WHERE created_at BETWEEN p_from AND p_to AND upper(COALESCE(status,'')) IN ('SUCCESS','SUCCEEDED','PAID','COMPLETED') GROUP BY shop_id) p ON p.shop_id=s.id
      LEFT JOIN (SELECT shop_id,sum(amount) cost FROM public.commercial_cost_entries WHERE occurred_at BETWEEN p_from AND p_to AND cost_type='AI' GROUP BY shop_id) c ON c.shop_id=s.id
     WHERE p.shop_id IS NOT NULL OR c.shop_id IS NOT NULL
     ORDER BY margin_amount DESC LIMIT 100
  ) x;

  SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.cohort_month DESC), '[]'::jsonb) INTO v_cohorts
  FROM (
    SELECT to_char(date_trunc('month',s.created_at),'YYYY-MM') cohort_month,
           count(*) shops_created,
           count(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.payment_transactions p WHERE p.shop_id=s.id AND upper(COALESCE(p.status,'')) IN ('SUCCESS','SUCCEEDED','PAID','COMPLETED'))) shops_ever_paid,
           count(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.subscriptions sub WHERE sub.shop_id=s.id AND lower(COALESCE(sub.status,''))='active')) shops_active_now
      FROM public.shops s
     WHERE s.created_at >= date_trunc('month',p_from) - interval '11 months' AND s.created_at <= p_to
     GROUP BY date_trunc('month',s.created_at)
  ) c;

  RETURN jsonb_build_object(
    'period',jsonb_build_object('from',p_from,'to',p_to,'previous_from',p_previous_from,'previous_to',p_previous_to),
    'revenue',v_revenue,'previous_revenue',v_previous_revenue,
    'revenue_delta_percent',CASE WHEN v_previous_revenue>0 THEN round((v_revenue-v_previous_revenue)/v_previous_revenue*100,2) ELSE NULL END,
    'marketing_spend',v_marketing,'ai_cost',v_ai_cost,'gross_margin',v_revenue-v_ai_cost,
    'new_shops',v_new_shops,'paying_shops',v_paying_shops,'cac',v_cac,'arpu',v_arpu,
    'churned_shops',v_churned,'churn_rate_percent',v_churn_rate,'ltv',v_ltv,
    'shop_margins',v_shop_margins,'cohorts',v_cohorts,
    'data_source','commercial_ledger','measured_at',now()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_global_search(p_query TEXT, p_limit INT)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_q TEXT := trim(COALESCE(p_query,'')); v_limit INT := LEAST(GREATEST(COALESCE(p_limit,10),1),30);
BEGIN
  IF NOT public.is_system_admin() THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;
  IF length(v_q) < 2 THEN RETURN '[]'::jsonb; END IF;
  RETURN (
    SELECT COALESCE(jsonb_agg(to_jsonb(r)), '[]'::jsonb) FROM (
      SELECT 'shop' type,id::text id,name title,COALESCE(status,'') subtitle,'shops' target FROM public.shops WHERE name ILIKE '%'||v_q||'%'
      UNION ALL
      SELECT 'user',id::text,COALESCE(full_name,email),email,'users' FROM public.profiles WHERE full_name ILIKE '%'||v_q||'%' OR email ILIKE '%'||v_q||'%'
      UNION ALL
      SELECT 'ticket',id::text,COALESCE(subject,'Ticket #'||left(id::text,8)),COALESCE(status,''),'support' FROM public.support_tickets WHERE subject ILIKE '%'||v_q||'%' OR id::text=v_q
      UNION ALL
      SELECT 'payment',id::text,COALESCE(transaction_code,transaction_id),COALESCE(status,'')||' · '||amount::text,'subscriptions' FROM public.payment_transactions WHERE transaction_code ILIKE '%'||v_q||'%' OR transaction_id ILIKE '%'||v_q||'%'
    ) r LIMIT v_limit
  );
END;
$$;

GRANT SELECT, INSERT, UPDATE ON public.commercial_cost_entries, public.ai_model_cost_rates TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_get_commercial_intelligence(TIMESTAMPTZ,TIMESTAMPTZ,TIMESTAMPTZ,TIMESTAMPTZ) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_global_search(TEXT,INT) TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';
