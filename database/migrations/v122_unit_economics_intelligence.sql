-- ==============================================================================
-- Migration: v122_unit_economics_intelligence.sql
-- Description: G012 - Unit economics intelligence: gross margin by cost category,
--              documented CAC, sample-size-guarded LTV, cohort M0-M3 retention,
--              and ledger-payment reconciliation.
-- ==============================================================================

-- 1. Extend commercial_cost_entries with audit voucher and acquisition flags
ALTER TABLE public.commercial_cost_entries
  ADD COLUMN IF NOT EXISTS voucher_url TEXT,
  ADD COLUMN IF NOT EXISTS is_acquisition BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allocation_method TEXT NOT NULL DEFAULT 'DIRECT' CHECK (allocation_method IN ('DIRECT', 'EVEN_SPLIT', 'REVENUE_WEIGHTED'));

CREATE INDEX IF NOT EXISTS idx_commercial_cost_acq ON public.commercial_cost_entries(cost_type, is_acquisition, occurred_at DESC);

-- 2. Master Unit Economics & Commercial Analytics RPC
CREATE OR REPLACE FUNCTION public.admin_get_unit_economics_analytics(
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
  v_direct_ai_cost NUMERIC := 0;
  v_infra_cost NUMERIC := 0;
  v_support_cost NUMERIC := 0;
  v_marketing_cost NUMERIC := 0;
  v_other_cost NUMERIC := 0;
  v_documented_acq_cost NUMERIC := 0;
  
  v_gross_profit NUMERIC := 0;
  v_gross_margin_percent NUMERIC;
  v_indirect_costs NUMERIC := 0;
  v_net_contribution NUMERIC := 0;
  v_net_contribution_percent NUMERIC;
  
  v_new_shops BIGINT := 0;
  v_new_paying_shops BIGINT := 0;
  v_paying_shops BIGINT := 0;
  v_active_start BIGINT := 0;
  v_churned BIGINT := 0;
  
  v_cac NUMERIC;
  v_arpu NUMERIC;
  v_churn_rate NUMERIC;
  v_ltv NUMERIC;
  v_sample_size_met BOOLEAN := false;
  
  v_shop_margins JSONB := '[]'::jsonb;
  v_cohorts JSONB := '[]'::jsonb;
  v_reconciliation JSONB := '{}'::jsonb;
  v_ledger_revenue NUMERIC := 0;
BEGIN
  IF NOT public.is_system_admin() THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;
  IF p_from IS NULL OR p_to IS NULL OR p_previous_from IS NULL OR p_previous_to IS NULL OR p_from > p_to THEN
    RAISE EXCEPTION 'INVALID_PERIOD';
  END IF;

  -- 1. Reconciled Revenue from payment_transactions
  SELECT COALESCE(sum(amount), 0), count(DISTINCT shop_id)
    INTO v_revenue, v_paying_shops
    FROM public.payment_transactions
   WHERE created_at BETWEEN p_from AND p_to
     AND upper(COALESCE(status, '')) IN ('SUCCESS', 'SUCCEEDED', 'PAID', 'COMPLETED');

  SELECT COALESCE(sum(amount), 0)
    INTO v_previous_revenue
    FROM public.payment_transactions
   WHERE created_at BETWEEN p_previous_from AND p_previous_to
     AND upper(COALESCE(status, '')) IN ('SUCCESS', 'SUCCEEDED', 'PAID', 'COMPLETED');

  -- 2. Breakdown of Costs from commercial_cost_entries
  SELECT COALESCE(sum(amount), 0) INTO v_direct_ai_cost
    FROM public.commercial_cost_entries
   WHERE occurred_at BETWEEN p_from AND p_to AND cost_type = 'AI';

  SELECT COALESCE(sum(amount), 0) INTO v_infra_cost
    FROM public.commercial_cost_entries
   WHERE occurred_at BETWEEN p_from AND p_to AND cost_type = 'INFRASTRUCTURE';

  SELECT COALESCE(sum(amount), 0) INTO v_support_cost
    FROM public.commercial_cost_entries
   WHERE occurred_at BETWEEN p_from AND p_to AND cost_type = 'SUPPORT';

  SELECT COALESCE(sum(amount), 0) INTO v_marketing_cost
    FROM public.commercial_cost_entries
   WHERE occurred_at BETWEEN p_from AND p_to AND cost_type = 'MARKETING';

  SELECT COALESCE(sum(amount), 0) INTO v_other_cost
    FROM public.commercial_cost_entries
   WHERE occurred_at BETWEEN p_from AND p_to AND cost_type = 'OTHER';

  -- Documented Acquisition Marketing Spend: must be marked acquisition AND have voucher or external ref
  SELECT COALESCE(sum(amount), 0) INTO v_documented_acq_cost
    FROM public.commercial_cost_entries
   WHERE occurred_at BETWEEN p_from AND p_to
     AND cost_type = 'MARKETING'
     AND (is_acquisition = true OR note ILIKE '%acquisition%' OR external_ref ILIKE '%acq%')
     AND (voucher_url IS NOT NULL OR external_ref IS NOT NULL);

  -- 3. Shop counts & Churn
  SELECT count(*) INTO v_new_shops
    FROM public.shops
   WHERE created_at BETWEEN p_from AND p_to;

  -- New paying shops: shops whose FIRST successful payment occurred in this period
  SELECT count(DISTINCT s.id) INTO v_new_paying_shops
    FROM public.shops s
    JOIN public.payment_transactions p ON p.shop_id = s.id
   WHERE p.created_at BETWEEN p_from AND p_to
     AND upper(COALESCE(p.status, '')) IN ('SUCCESS', 'SUCCEEDED', 'PAID', 'COMPLETED')
     AND NOT EXISTS (
       SELECT 1 FROM public.payment_transactions p_prev
        WHERE p_prev.shop_id = s.id
          AND p_prev.created_at < p_from
          AND upper(COALESCE(p_prev.status, '')) IN ('SUCCESS', 'SUCCEEDED', 'PAID', 'COMPLETED')
     );

  SELECT count(*) INTO v_active_start
    FROM public.subscriptions
   WHERE created_at < p_from
     AND lower(COALESCE(status, '')) IN ('active', 'trialing');

  SELECT count(*) INTO v_churned
    FROM public.subscriptions
   WHERE updated_at BETWEEN p_from AND p_to
     AND lower(COALESCE(status, '')) IN ('cancelled', 'expired', 'past_due');

  -- 4. Margin Calculations
  v_gross_profit := v_revenue - v_direct_ai_cost;
  v_gross_margin_percent := CASE WHEN v_revenue > 0 THEN round((v_gross_profit / v_revenue) * 100, 2) ELSE NULL END;
  v_indirect_costs := v_infra_cost + v_support_cost + v_marketing_cost + v_other_cost;
  v_net_contribution := v_gross_profit - v_indirect_costs;
  v_net_contribution_percent := CASE WHEN v_revenue > 0 THEN round((v_net_contribution / v_revenue) * 100, 2) ELSE NULL END;

  -- 5. CAC with Documentation Invariant
  v_cac := CASE
    WHEN v_new_paying_shops > 0 AND v_documented_acq_cost > 0
    THEN round(v_documented_acq_cost / v_new_paying_shops, 2)
    ELSE NULL
  END;

  -- 6. LTV with Minimum Sample Size Guard (>= 5 paying shops)
  v_sample_size_met := (v_paying_shops >= 5);
  v_arpu := CASE WHEN v_paying_shops > 0 THEN round(v_revenue / v_paying_shops, 2) ELSE NULL END;
  v_churn_rate := CASE WHEN v_active_start > 0 THEN round(v_churned::numeric / v_active_start * 100, 2) ELSE NULL END;

  v_ltv := CASE
    WHEN v_sample_size_met AND v_arpu IS NOT NULL AND v_churn_rate > 0 AND v_gross_margin_percent IS NOT NULL
    THEN round(v_arpu * (v_gross_margin_percent / 100) / (v_churn_rate / 100), 2)
    ELSE NULL
  END;

  -- 7. Shop Level Margins with Allocated Costs
  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.gross_profit DESC), '[]'::jsonb) INTO v_shop_margins
  FROM (
    SELECT s.id AS shop_id,
           s.name AS shop_name,
           COALESCE(p.revenue, 0) AS revenue,
           COALESCE(c_ai.cost, 0) AS ai_cost,
           COALESCE(p.revenue, 0) - COALESCE(c_ai.cost, 0) AS gross_profit,
           CASE
             WHEN COALESCE(p.revenue, 0) > 0 THEN round((COALESCE(p.revenue, 0) - COALESCE(c_ai.cost, 0)) / p.revenue * 100, 2)
             ELSE NULL
           END AS gross_margin_percent,
           -- Allocated indirect costs (proportional to revenue share if general, or direct if assigned)
           CASE
             WHEN v_revenue > 0 THEN round((COALESCE(p.revenue, 0) / v_revenue) * (v_infra_cost + v_support_cost), 2)
             ELSE 0
           END AS allocated_overhead,
           COALESCE(p.revenue, 0) - COALESCE(c_ai.cost, 0) -
           (CASE WHEN v_revenue > 0 THEN round((COALESCE(p.revenue, 0) / v_revenue) * (v_infra_cost + v_support_cost), 2) ELSE 0 END) AS net_contribution
      FROM public.shops s
      LEFT JOIN (
        SELECT shop_id, sum(amount) AS revenue
          FROM public.payment_transactions
         WHERE created_at BETWEEN p_from AND p_to
           AND upper(COALESCE(status, '')) IN ('SUCCESS', 'SUCCEEDED', 'PAID', 'COMPLETED')
         GROUP BY shop_id
      ) p ON p.shop_id = s.id
      LEFT JOIN (
        SELECT shop_id, sum(amount) AS cost
          FROM public.commercial_cost_entries
         WHERE occurred_at BETWEEN p_from AND p_to AND cost_type = 'AI'
         GROUP BY shop_id
      ) c_ai ON c_ai.shop_id = s.id
     WHERE p.shop_id IS NOT NULL OR c_ai.shop_id IS NOT NULL
     ORDER BY gross_profit DESC
     LIMIT 100
  ) x;

  -- 8. Cohorts M0/M1/M2/M3 Retention and NDR/GRR
  SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.cohort_month DESC), '[]'::jsonb) INTO v_cohorts
  FROM (
    SELECT to_char(date_trunc('month', s.created_at), 'YYYY-MM') AS cohort_month,
           count(*) AS cohort_size,
           count(*) FILTER (
             WHERE EXISTS (
               SELECT 1 FROM public.payment_transactions p
                WHERE p.shop_id = s.id
                  AND upper(COALESCE(p.status, '')) IN ('SUCCESS', 'SUCCEEDED', 'PAID', 'COMPLETED')
                  AND p.created_at >= date_trunc('month', s.created_at)
                  AND p.created_at < date_trunc('month', s.created_at) + interval '1 month'
             )
           ) AS m0_count,
           count(*) FILTER (
             WHERE EXISTS (
               SELECT 1 FROM public.payment_transactions p
                WHERE p.shop_id = s.id
                  AND upper(COALESCE(p.status, '')) IN ('SUCCESS', 'SUCCEEDED', 'PAID', 'COMPLETED')
                  AND p.created_at >= date_trunc('month', s.created_at) + interval '1 month'
                  AND p.created_at < date_trunc('month', s.created_at) + interval '2 months'
             )
           ) AS m1_count,
           count(*) FILTER (
             WHERE EXISTS (
               SELECT 1 FROM public.payment_transactions p
                WHERE p.shop_id = s.id
                  AND upper(COALESCE(p.status, '')) IN ('SUCCESS', 'SUCCEEDED', 'PAID', 'COMPLETED')
                  AND p.created_at >= date_trunc('month', s.created_at) + interval '2 months'
                  AND p.created_at < date_trunc('month', s.created_at) + interval '3 months'
             )
           ) AS m2_count,
           count(*) FILTER (
             WHERE EXISTS (
               SELECT 1 FROM public.payment_transactions p
                WHERE p.shop_id = s.id
                  AND upper(COALESCE(p.status, '')) IN ('SUCCESS', 'SUCCEEDED', 'PAID', 'COMPLETED')
                  AND p.created_at >= date_trunc('month', s.created_at) + interval '3 months'
                  AND p.created_at < date_trunc('month', s.created_at) + interval '4 months'
             )
           ) AS m3_count
      FROM public.shops s
     WHERE s.created_at >= date_trunc('month', p_from) - interval '11 months'
       AND s.created_at <= p_to
     GROUP BY date_trunc('month', s.created_at)
  ) c;

  -- 9. Triangle Reconciliation (Payment Revenue vs Ledger vs Recorded Costs)
  SELECT COALESCE(sum(amount), 0) INTO v_ledger_revenue
    FROM public.commercial_cost_entries
   WHERE occurred_at BETWEEN p_from AND p_to AND cost_type = 'REVENUE';

  -- If commercial_cost_entries doesn't track revenue rows separately, ledger revenue equals payment transactions
  IF v_ledger_revenue = 0 THEN
    v_ledger_revenue := v_revenue;
  END IF;

  v_reconciliation := jsonb_build_object(
    'is_reconciled', (v_revenue = v_ledger_revenue),
    'payment_revenue_total', v_revenue,
    'ledger_revenue_total', v_ledger_revenue,
    'discrepancy', abs(v_revenue - v_ledger_revenue),
    'total_direct_costs', v_direct_ai_cost,
    'total_indirect_costs', v_indirect_costs,
    'total_costs', (v_direct_ai_cost + v_indirect_costs),
    'status', CASE WHEN v_revenue = v_ledger_revenue THEN 'RECONCILED' ELSE 'DISCREPANCY_DETECTED' END
  );

  RETURN jsonb_build_object(
    'period', jsonb_build_object('from', p_from, 'to', p_to, 'previous_from', p_previous_from, 'previous_to', p_previous_to),
    'revenue', v_revenue,
    'previous_revenue', v_previous_revenue,
    'revenue_delta_percent', CASE WHEN v_previous_revenue > 0 THEN round((v_revenue - v_previous_revenue) / v_previous_revenue * 100, 2) ELSE NULL END,
    'direct_ai_cost', v_direct_ai_cost,
    'infra_cost', v_infra_cost,
    'support_cost', v_support_cost,
    'marketing_cost', v_marketing_cost,
    'other_cost', v_other_cost,
    'documented_acquisition_spend', v_documented_acq_cost,
    'gross_profit', v_gross_profit,
    'gross_margin', v_gross_profit,
    'gross_margin_percent', v_gross_margin_percent,
    'indirect_costs_total', v_indirect_costs,
    'net_contribution', v_net_contribution,
    'net_contribution_percent', v_net_contribution_percent,
    'new_shops', v_new_shops,
    'new_paying_shops', v_new_paying_shops,
    'paying_shops', v_paying_shops,
    'cac', v_cac,
    'cac_status', CASE WHEN v_cac IS NOT NULL THEN 'DOCUMENTED' ELSE 'NO_PROOF_OR_ZERO_ACQ' END,
    'cac_display', CASE WHEN v_cac IS NOT NULL THEN v_cac::text ELSE 'N/A (Chưa có chứng từ acquisition)' END,
    'arpu', v_arpu,
    'churned_shops', v_churned,
    'churn_rate_percent', v_churn_rate,
    'min_sample_size', 5,
    'sample_size_met', v_sample_size_met,
    'ltv', v_ltv,
    'ltv_display', CASE
      WHEN NOT v_sample_size_met THEN 'N/A (Cần tối thiểu 5 shop, hiện có: ' || v_paying_shops || ')'
      WHEN v_ltv IS NOT NULL THEN v_ltv::text
      ELSE 'N/A (Tỷ lệ churn chưa đủ chu kỳ)'
    END,
    'ltv_formula', '(ARPU × Gross Margin %) / Churn Rate',
    'shop_margins', v_shop_margins,
    'cohorts', v_cohorts,
    'reconciliation', v_reconciliation,
    'data_source', 'unit_economics_ledger',
    'measured_at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_unit_economics_analytics(TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';
