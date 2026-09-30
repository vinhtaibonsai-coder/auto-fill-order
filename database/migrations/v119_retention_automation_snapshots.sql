-- Migration: v119_retention_automation_snapshots.sql
-- Description: G009 Retention automation: daily snapshots, playbook tasks with single-open-task deduplication invariant, and cohort conversion analytics separating active from failed trials.

-- 1. Daily snapshot table for tracking segment transitions over time
CREATE TABLE IF NOT EXISTS public.retention_daily_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  segment TEXT NOT NULL CHECK(segment IN ('HEALTHY', 'AT_RISK', 'EXPIRING_SOON', 'CRITICAL')),
  risk_score INT NOT NULL DEFAULT 0,
  orders_30d INT NOT NULL DEFAULT 0,
  last_order_at TIMESTAMPTZ,
  subscription_status TEXT,
  plan_tier TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_retention_daily_snapshot UNIQUE(snapshot_date, shop_id)
);

CREATE INDEX IF NOT EXISTS idx_retention_snapshots_date_segment ON public.retention_daily_snapshots(snapshot_date, segment);
CREATE INDEX IF NOT EXISTS idx_retention_snapshots_shop_date ON public.retention_daily_snapshots(shop_id, snapshot_date DESC);

ALTER TABLE public.retention_daily_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS retention_daily_snapshots_admin ON public.retention_daily_snapshots;
CREATE POLICY retention_daily_snapshots_admin ON public.retention_daily_snapshots
  FOR ALL TO authenticated
  USING(public.is_system_admin())
  WITH CHECK(public.is_system_admin());

-- 2. Enhance retention_actions with playbook fields, assignee, outcome, and next_action
ALTER TABLE public.retention_actions ADD COLUMN IF NOT EXISTS playbook_code TEXT DEFAULT 'MANUAL';
ALTER TABLE public.retention_actions ADD COLUMN IF NOT EXISTS assignee_id UUID REFERENCES auth.users(id);
ALTER TABLE public.retention_actions ADD COLUMN IF NOT EXISTS assignee_name TEXT;
ALTER TABLE public.retention_actions ADD COLUMN IF NOT EXISTS outcome TEXT;
ALTER TABLE public.retention_actions ADD COLUMN IF NOT EXISTS next_action TEXT;
ALTER TABLE public.retention_actions ADD COLUMN IF NOT EXISTS segment TEXT;

CREATE INDEX IF NOT EXISTS idx_retention_actions_shop_playbook_status 
  ON public.retention_actions(shop_id, playbook_code, status);

-- 3. Daily snapshot generation RPC
CREATE OR REPLACE FUNCTION public.admin_generate_retention_snapshots(
  p_snapshot_date DATE DEFAULT CURRENT_DATE,
  p_inactive_days INT DEFAULT 3,
  p_expiring_days INT DEFAULT 3
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_inserted INT := 0;
  v_date DATE := COALESCE(p_snapshot_date, CURRENT_DATE);
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'ACCESS_DENIED';
  END IF;

  WITH portfolio_eval AS (
    SELECT 
      s.id AS shop_id,
      sub.status AS subscription_status,
      COALESCE(sub.plan_tier, sub.plan_code, 'UNKNOWN') AS plan_tier,
      o.last_order_at,
      COALESCE(o.orders_30d, 0) AS orders_30d,
      (CASE WHEN o.last_order_at IS NULL THEN 40 
            WHEN o.last_order_at < now() - (p_inactive_days || ' days')::interval THEN 45 
            ELSE 0 END
       + CASE WHEN sub.current_period_end BETWEEN now() AND now() + (p_expiring_days || ' days')::interval THEN 40 
              ELSE 0 END
       + CASE WHEN lower(COALESCE(sub.status, '')) IN ('past_due', 'expired', 'cancelled', 'canceled') THEN 60 
              ELSE 0 END) AS risk_score,
      (CASE WHEN lower(COALESCE(sub.status, '')) IN ('past_due', 'expired', 'cancelled', 'canceled') THEN 'CRITICAL'
            WHEN sub.current_period_end BETWEEN now() AND now() + (p_expiring_days || ' days')::interval THEN 'EXPIRING_SOON'
            WHEN o.last_order_at IS NULL OR o.last_order_at < now() - (p_inactive_days || ' days')::interval THEN 'AT_RISK'
            ELSE 'HEALTHY' END) AS segment
    FROM public.shops s
    LEFT JOIN public.subscriptions sub ON sub.shop_id = s.id
    LEFT JOIN (
      SELECT 
        shop_id,
        MAX(created_at) AS last_order_at,
        COUNT(*) FILTER (WHERE created_at >= now() - INTERVAL '30 days') AS orders_30d
      FROM public.submitted_orders
      WHERE deleted_at IS NULL
      GROUP BY shop_id
    ) o ON o.shop_id = s.id
    WHERE s.deleted_at IS NULL
  )
  INSERT INTO public.retention_daily_snapshots (
    snapshot_date, shop_id, segment, risk_score, orders_30d, last_order_at, subscription_status, plan_tier
  )
  SELECT 
    v_date, shop_id, segment, risk_score, orders_30d, last_order_at, subscription_status, plan_tier
  FROM portfolio_eval
  ON CONFLICT (snapshot_date, shop_id) DO UPDATE SET
    segment = EXCLUDED.segment,
    risk_score = EXCLUDED.risk_score,
    orders_30d = EXCLUDED.orders_30d,
    last_order_at = EXCLUDED.last_order_at,
    subscription_status = EXCLUDED.subscription_status,
    plan_tier = EXCLUDED.plan_tier
  ;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'snapshot_date', v_date,
    'shops_recorded', v_inserted,
    'generated_at', now()
  );
END;
$$;

-- 4. Playbook task creation with deduplication invariant
-- Done invariant: "Một shop chuyển segment tạo tối đa một task đang mở cho cùng playbook."
CREATE OR REPLACE FUNCTION public.admin_create_playbook_task(
  p_shop_id UUID,
  p_playbook_code TEXT,
  p_assignee_id UUID DEFAULT NULL,
  p_assignee_name TEXT DEFAULT NULL,
  p_due_at TIMESTAMPTZ DEFAULT NULL,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing_id UUID;
  v_new_id UUID;
  v_code TEXT := upper(trim(COALESCE(p_playbook_code, 'MANUAL')));
  v_due TIMESTAMPTZ := COALESCE(p_due_at, now() + INTERVAL '2 days');
  v_action_type TEXT;
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'ACCESS_DENIED';
  END IF;

  IF p_shop_id IS NULL THEN
    RAISE EXCEPTION 'SHOP_ID_REQUIRED';
  END IF;

  -- Deduplication check: check if an OPEN task already exists for this shop & playbook
  SELECT id INTO v_existing_id
  FROM public.retention_actions
  WHERE shop_id = p_shop_id
    AND playbook_code = v_code
    AND status = 'OPEN'
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'created', false,
      'deduplicated', true,
      'task_id', v_existing_id,
      'message', 'Đã có task đang mở cho playbook này của shop'
    );
  END IF;

  -- Default action type by playbook
  v_action_type := CASE 
    WHEN v_code = 'AT_RISK' THEN 'CALL'
    WHEN v_code = 'EXPIRING_SOON' THEN 'OFFER'
    WHEN v_code = 'CRITICAL' THEN 'CALL'
    ELSE 'NOTE'
  END;

  INSERT INTO public.retention_actions (
    shop_id,
    action_type,
    playbook_code,
    status,
    assignee_id,
    assignee_name,
    due_at,
    note,
    segment,
    created_by,
    created_at,
    updated_at
  ) VALUES (
    p_shop_id,
    v_action_type,
    v_code,
    'OPEN',
    p_assignee_id,
    NULLIF(trim(p_assignee_name), ''),
    v_due,
    NULLIF(trim(p_note), ''),
    v_code,
    auth.uid(),
    now(),
    now()
  )
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object(
    'success', true,
    'created', true,
    'deduplicated', false,
    'task_id', v_new_id,
    'message', 'Tạo task playbook CSKH thành công'
  );
END;
$$;

-- 5. Update task with outcome, next action and status
CREATE OR REPLACE FUNCTION public.admin_update_retention_task(
  p_task_id UUID,
  p_status TEXT,
  p_outcome TEXT DEFAULT NULL,
  p_next_action TEXT DEFAULT NULL,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status TEXT := upper(trim(p_status));
  v_outcome TEXT := NULLIF(upper(trim(p_outcome)), '');
  v_task public.retention_actions%ROWTYPE;
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'ACCESS_DENIED';
  END IF;

  IF v_status NOT IN ('OPEN', 'DONE', 'DISMISSED') THEN
    RAISE EXCEPTION 'INVALID_STATUS: Must be OPEN, DONE, or DISMISSED';
  END IF;

  UPDATE public.retention_actions
  SET 
    status = v_status,
    outcome = COALESCE(v_outcome, outcome),
    next_action = COALESCE(NULLIF(trim(p_next_action), ''), next_action),
    note = CASE 
      WHEN NULLIF(trim(p_note), '') IS NOT NULL THEN 
        COALESCE(note || E'\n---\n' || trim(p_note), trim(p_note))
      ELSE note 
    END,
    completed_at = CASE WHEN v_status IN ('DONE', 'DISMISSED') THEN now() ELSE NULL END,
    updated_at = now()
  WHERE id = p_task_id
  RETURNING * INTO v_task;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TASK_NOT_FOUND';
  END IF;

  -- Audit trail
  INSERT INTO public.audit_logs (user_id, action, target_type, target_id, details)
  VALUES (
    auth.uid(),
    'ADMIN_UPDATE_RETENTION_TASK',
    'retention_task',
    p_task_id::TEXT,
    jsonb_build_object(
      'status', v_status,
      'outcome', v_outcome,
      'next_action', p_next_action,
      'shop_id', v_task.shop_id
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'task_id', v_task.id,
    'status', v_task.status,
    'outcome', v_task.outcome,
    'next_action', v_task.next_action,
    'updated_at', v_task.updated_at
  );
END;
$$;

-- 6. Cohort retention analytics RPC with proper denominator
-- Invariant: "Tính conversion theo cohort đúng mẫu số; tách trial còn mở khỏi trial thất bại."
CREATE OR REPLACE FUNCTION public.admin_get_cohort_retention_analytics(
  p_months INT DEFAULT 6
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cohorts JSONB;
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'ACCESS_DENIED';
  END IF;

  WITH monthly_cohorts AS (
    SELECT 
      to_char(date_trunc('month', s.created_at), 'YYYY-MM') AS cohort_month,
      s.id AS shop_id,
      sub.status AS sub_status,
      COALESCE(sub.plan_tier, sub.plan_code, 'FREE') AS plan_tier,
      sub.current_period_end,
      -- Active trial: status is trial AND current_period_end has not passed
      (lower(COALESCE(sub.status, '')) IN ('trial', 'trialing') AND COALESCE(sub.current_period_end, now() + interval '1 day') >= now()) AS is_active_trial,
      -- Failed trial: trial ended without conversion or expired/cancelled
      (lower(COALESCE(sub.status, '')) IN ('expired', 'cancelled', 'canceled') 
       OR (lower(COALESCE(sub.status, '')) IN ('trial', 'trialing') AND sub.current_period_end < now())) AS is_failed_trial,
      -- Converted: Active paid tier
      (lower(COALESCE(sub.status, '')) = 'active' AND upper(COALESCE(sub.plan_tier, sub.plan_code, 'FREE')) NOT IN ('TRIAL', 'FREE')) AS is_converted,
      EXISTS (
        SELECT 1 FROM public.submitted_orders o 
        WHERE o.shop_id = s.id AND o.created_at >= now() - INTERVAL '30 days' AND o.deleted_at IS NULL
      ) AS has_recent_orders
    FROM public.shops s
    LEFT JOIN public.subscriptions sub ON sub.shop_id = s.id
    WHERE s.deleted_at IS NULL
      AND s.created_at >= date_trunc('month', now()) - (p_months || ' months')::interval
  ),
  aggregated AS (
    SELECT 
      cohort_month,
      COUNT(*) AS total_shops,
      COUNT(*) FILTER (WHERE is_active_trial) AS active_trial_shops,
      COUNT(*) FILTER (WHERE is_failed_trial) AS failed_trial_shops,
      COUNT(*) FILTER (WHERE is_converted) AS converted_shops,
      COUNT(*) FILTER (WHERE has_recent_orders) AS active_orders_shops
    FROM monthly_cohorts
    GROUP BY cohort_month
    ORDER BY cohort_month DESC
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'cohort_month', cohort_month,
      'total_shops', total_shops,
      'active_trial_shops', active_trial_shops,
      'failed_trial_shops', failed_trial_shops,
      'converted_shops', converted_shops,
      'active_orders_shops', active_orders_shops,
      'raw_conversion_percent', CASE 
        WHEN total_shops > 0 THEN round(converted_shops::numeric / total_shops * 100, 2)
        ELSE NULL 
      END,
      -- Mature conversion excludes active trials from denominator so open trials do not penalize conversion rate
      'mature_conversion_percent', CASE 
        WHEN (total_shops - active_trial_shops) > 0 THEN 
          round(converted_shops::numeric / (total_shops - active_trial_shops) * 100, 2)
        ELSE NULL 
      END
    )
  ), '[]'::jsonb) INTO v_cohorts
  FROM aggregated;

  RETURN jsonb_build_object(
    'cohorts', v_cohorts,
    'analysis_months', p_months,
    'measured_at', now()
  );
END;
$$;

-- 7. Query Playbook tasks with shop information
CREATE OR REPLACE FUNCTION public.admin_get_retention_tasks(
  p_status TEXT DEFAULT 'ALL',
  p_playbook TEXT DEFAULT 'ALL',
  p_limit INT DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tasks JSONB;
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'ACCESS_DENIED';
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.due_at ASC NULLS LAST, t.created_at DESC), '[]'::jsonb)
  INTO v_tasks
  FROM (
    SELECT 
      ra.id,
      ra.shop_id,
      s.name AS shop_name,
      ra.action_type,
      ra.playbook_code,
      ra.status,
      ra.assignee_id,
      ra.assignee_name,
      ra.outcome,
      ra.next_action,
      ra.note,
      ra.segment,
      ra.due_at,
      ra.completed_at,
      ra.created_at,
      ra.updated_at
    FROM public.retention_actions ra
    JOIN public.shops s ON s.id = ra.shop_id
    WHERE (p_status = 'ALL' OR ra.status = upper(trim(p_status)))
      AND (p_playbook = 'ALL' OR ra.playbook_code = upper(trim(p_playbook)))
    ORDER BY 
      CASE WHEN ra.status = 'OPEN' THEN 0 ELSE 1 END,
      ra.due_at ASC NULLS LAST
    LIMIT p_limit
  ) t;

  RETURN v_tasks;
END;
$$;

-- Permissions and grants
GRANT SELECT, INSERT, UPDATE ON public.retention_daily_snapshots TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_generate_retention_snapshots(DATE, INT, INT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_create_playbook_task(UUID, TEXT, UUID, TEXT, TIMESTAMPTZ, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_update_retention_task(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_get_cohort_retention_analytics(INT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_get_retention_tasks(TEXT, TEXT, INT) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
