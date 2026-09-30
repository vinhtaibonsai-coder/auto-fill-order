-- P3 Retention & Anti-Churn Engine

-- Ensure subscriptions schema supports both plan_tier and plan_code safely
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS plan_tier TEXT DEFAULT 'FREE';
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS plan_code TEXT DEFAULT 'FREE';
UPDATE public.subscriptions SET plan_tier = COALESCE(plan_tier, plan_code, 'FREE') WHERE plan_tier IS NULL;
UPDATE public.subscriptions SET plan_code = COALESCE(plan_code, plan_tier, 'FREE') WHERE plan_code IS NULL;

CREATE OR REPLACE FUNCTION public.tr_sync_subscriptions_tier_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.plan_tier IS NULL AND NEW.plan_code IS NOT NULL THEN
    NEW.plan_tier := NEW.plan_code;
  ELSIF NEW.plan_code IS NULL AND NEW.plan_tier IS NOT NULL THEN
    NEW.plan_code := NEW.plan_tier;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_subscriptions_tier_code_sync ON public.subscriptions;
CREATE TRIGGER tr_subscriptions_tier_code_sync
  BEFORE INSERT OR UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.tr_sync_subscriptions_tier_code();

CREATE TABLE IF NOT EXISTS public.retention_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK(action_type IN ('CALL','ZALO','EMAIL','OFFER','NOTE')),
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','DONE','DISMISSED')),
  note TEXT, due_at TIMESTAMPTZ, completed_at TIMESTAMPTZ, created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_retention_actions_shop_status ON public.retention_actions(shop_id,status,created_at DESC);
ALTER TABLE public.retention_actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS retention_actions_admin ON public.retention_actions;
CREATE POLICY retention_actions_admin ON public.retention_actions FOR ALL TO authenticated USING(public.is_system_admin()) WITH CHECK(public.is_system_admin());

CREATE OR REPLACE FUNCTION public.admin_get_retention_portfolio(p_inactive_days INT, p_expiring_days INT)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_rows JSONB; v_trial BIGINT; v_converted BIGINT;
BEGIN
  IF NOT public.is_system_admin() THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;
  IF p_inactive_days < 1 OR p_expiring_days < 1 THEN RAISE EXCEPTION 'INVALID_THRESHOLD'; END IF;
  SELECT count(*) FILTER(WHERE lower(COALESCE(status,'')) IN ('trial','trialing')), count(*) FILTER(WHERE upper(COALESCE(plan_tier,plan_code,'')) NOT IN ('TRIAL','FREE') AND lower(COALESCE(status,''))='active')
    INTO v_trial,v_converted FROM public.subscriptions;
  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.risk_score DESC,x.shop_name),'[]'::jsonb) INTO v_rows FROM (
    SELECT s.id shop_id,s.name shop_name,sub.status subscription_status,COALESCE(sub.plan_tier,sub.plan_code,'UNKNOWN') plan,
      sub.current_period_end expires_at,o.last_order_at,COALESCE(o.orders_30d,0) orders_30d,
      CASE WHEN o.last_order_at IS NULL THEN 40 WHEN o.last_order_at < now()-(p_inactive_days||' days')::interval THEN 45 ELSE 0 END
        + CASE WHEN sub.current_period_end BETWEEN now() AND now()+(p_expiring_days||' days')::interval THEN 40 ELSE 0 END
        + CASE WHEN lower(COALESCE(sub.status,'')) IN ('past_due','expired','cancelled','canceled') THEN 60 ELSE 0 END risk_score,
      CASE WHEN lower(COALESCE(sub.status,'')) IN ('past_due','expired','cancelled','canceled') THEN 'CRITICAL'
           WHEN sub.current_period_end BETWEEN now() AND now()+(p_expiring_days||' days')::interval THEN 'EXPIRING_SOON'
           WHEN o.last_order_at IS NULL OR o.last_order_at < now()-(p_inactive_days||' days')::interval THEN 'AT_RISK' ELSE 'HEALTHY' END segment,
      (SELECT count(*) FROM public.retention_actions ra WHERE ra.shop_id=s.id AND ra.status='OPEN') open_actions
    FROM public.shops s LEFT JOIN public.subscriptions sub ON sub.shop_id=s.id
    LEFT JOIN (SELECT shop_id,max(created_at) last_order_at,count(*) FILTER(WHERE created_at>=now()-interval '30 days') orders_30d FROM public.submitted_orders WHERE deleted_at IS NULL GROUP BY shop_id) o ON o.shop_id=s.id
    WHERE s.deleted_at IS NULL
  ) x;
  RETURN jsonb_build_object('shops',v_rows,'trial_shops',v_trial,'converted_shops',v_converted,
    'trial_conversion_percent',CASE WHEN v_trial+v_converted>0 THEN round(v_converted::numeric/(v_trial+v_converted)*100,2) ELSE NULL END,
    'inactive_days',p_inactive_days,'expiring_days',p_expiring_days,'data_source','retention_engine','measured_at',now());
END $$;

CREATE OR REPLACE FUNCTION public.admin_record_retention_action(p_shop_id UUID,p_action_type TEXT,p_note TEXT,p_status TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ DECLARE v_id UUID;
BEGIN IF NOT public.is_system_admin() THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;
  INSERT INTO public.retention_actions(shop_id,action_type,note,status,completed_at,created_by)
  VALUES(p_shop_id,upper(p_action_type),NULLIF(trim(p_note),''),upper(p_status),CASE WHEN upper(p_status)='DONE' THEN now() END,auth.uid()) RETURNING id INTO v_id;
  RETURN jsonb_build_object('success',true,'id',v_id);
END $$;
GRANT SELECT,INSERT,UPDATE ON public.retention_actions TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.admin_get_retention_portfolio(INT,INT),public.admin_record_retention_action(UUID,TEXT,TEXT,TEXT) TO authenticated,service_role;
NOTIFY pgrst,'reload schema';
