-- Commercial Phase 2 foundation: device fingerprint enforcement,
-- remote selector releases and unit-economics reporting.

ALTER TABLE public.extension_devices ADD COLUMN IF NOT EXISTS fingerprint_hash TEXT;
ALTER TABLE public.extension_devices ADD COLUMN IF NOT EXISTS approved BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.extension_devices ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
CREATE INDEX IF NOT EXISTS idx_extension_devices_fingerprint ON public.extension_devices(fingerprint_hash);

CREATE TABLE IF NOT EXISTS public.remote_selector_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carrier_code TEXT NOT NULL CHECK (carrier_code IN ('VNPOST','JT')),
  version INT NOT NULL,
  selectors JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','rolled_back')),
  min_extension_version TEXT,
  release_note TEXT,
  published_by UUID REFERENCES auth.users(id),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(carrier_code,version)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_remote_selector_active ON public.remote_selector_releases(carrier_code) WHERE status='active';
ALTER TABLE public.remote_selector_releases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS remote_selectors_authenticated_read ON public.remote_selector_releases;
CREATE POLICY remote_selectors_authenticated_read ON public.remote_selector_releases FOR SELECT TO authenticated USING(status='active' OR public.is_system_admin());

CREATE OR REPLACE FUNCTION public.register_extension_device(p_device_id TEXT,p_device_name TEXT,p_browser TEXT,p_os_info TEXT,p_client_version TEXT,p_fingerprint_hash TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user UUID:=auth.uid();v_active INT;v_limit INT;v_existing public.extension_devices%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NULLIF(trim(p_device_id),'') IS NULL OR NULLIF(trim(p_fingerprint_hash),'') IS NULL THEN RAISE EXCEPTION 'DEVICE_IDENTITY_REQUIRED'; END IF;
  SELECT * INTO v_existing FROM public.extension_devices WHERE user_id=v_user AND device_id=p_device_id LIMIT 1;
  SELECT count(*) INTO v_active FROM public.extension_devices WHERE user_id=v_user AND COALESCE(revoked,false)=false AND approved=true;
  SELECT COALESCE(max(s.max_devices),1) INTO v_limit FROM public.shop_members sm LEFT JOIN public.subscriptions s ON s.shop_id=sm.shop_id WHERE sm.user_id=v_user AND sm.removed_at IS NULL;
  IF v_existing.id IS NULL AND v_active>=v_limit THEN
    RETURN jsonb_build_object('success',false,'message','DEVICE_LIMIT_EXCEEDED','active_devices',v_active,'max_devices',v_limit);
  END IF;
  INSERT INTO public.extension_devices(user_id,device_id,device_name,browser,os_info,client_version,fingerprint_hash,last_seen,revoked,approved,status)
  VALUES(v_user,trim(p_device_id),left(trim(p_device_name),80),p_browser,p_os_info,p_client_version,p_fingerprint_hash,now(),false,true,'active')
  ON CONFLICT(user_id,device_id) DO UPDATE SET device_name=excluded.device_name,browser=excluded.browser,os_info=excluded.os_info,client_version=excluded.client_version,fingerprint_hash=excluded.fingerprint_hash,last_seen=now();
  RETURN jsonb_build_object('success',true,'active_devices',v_active+CASE WHEN v_existing.id IS NULL THEN 1 ELSE 0 END,'max_devices',v_limit);
END $$;

CREATE OR REPLACE FUNCTION public.admin_publish_remote_selectors(p_carrier_code TEXT,p_selectors JSONB,p_min_extension_version TEXT,p_release_note TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_carrier TEXT:=upper(trim(p_carrier_code));v_version INT;v_id UUID;
BEGIN
  IF NOT public.is_system_admin() THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;
  IF v_carrier NOT IN('VNPOST','JT') OR jsonb_typeof(p_selectors)<>'object' OR p_selectors='{}'::jsonb THEN RAISE EXCEPTION 'INVALID_SELECTOR_RELEASE'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_each(p_selectors) e WHERE jsonb_typeof(e.value) NOT IN('string','array')) THEN RAISE EXCEPTION 'UNSAFE_SELECTOR_VALUE'; END IF;
  SELECT COALESCE(max(version),0)+1 INTO v_version FROM public.remote_selector_releases WHERE carrier_code=v_carrier;
  UPDATE public.remote_selector_releases SET status='rolled_back' WHERE carrier_code=v_carrier AND status='active';
  INSERT INTO public.remote_selector_releases(carrier_code,version,selectors,status,min_extension_version,release_note,published_by,published_at)
  VALUES(v_carrier,v_version,p_selectors,'active',p_min_extension_version,p_release_note,auth.uid(),now()) RETURNING id INTO v_id;
  PERFORM public.insert_audit_log('ADMIN_PUBLISH_REMOTE_SELECTORS','remote_selector_release',v_id::text,jsonb_build_object('carrier',v_carrier,'version',v_version),NULL);
  RETURN jsonb_build_object('success',true,'id',v_id,'version',v_version);
END $$;

CREATE OR REPLACE FUNCTION public.admin_get_unit_economics()
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_revenue NUMERIC;v_tokens BIGINT;v_requests BIGINT;v_active BIGINT;
BEGIN
  IF NOT public.is_system_admin() THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;
  SELECT COALESCE(sum(CASE plan_tier WHEN 'PRO_MONTH' THEN 199000 WHEN 'PRO_YEAR' THEN 1490000.0/12 WHEN 'ENTERPRISE' THEN 3990000.0/12 ELSE 0 END),0),count(*) INTO v_revenue,v_active FROM public.subscriptions WHERE lower(status)='active';
  SELECT COALESCE(sum(prompt_tokens+completion_tokens),0),count(*) INTO v_tokens,v_requests FROM public.ai_usage_log WHERE created_at>=date_trunc('month',now());
  RETURN jsonb_build_object('mrr',v_revenue,'active_subscriptions',v_active,'ai_tokens_month',v_tokens,'ai_requests_month',v_requests,'estimated_ai_cost',round(v_tokens::numeric/1000000*25000,0),'gross_margin',v_revenue-round(v_tokens::numeric/1000000*25000,0),'generated_at',now());
END $$;

GRANT EXECUTE ON FUNCTION public.register_extension_device(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT), public.admin_publish_remote_selectors(TEXT,JSONB,TEXT,TEXT), public.admin_get_unit_economics() TO authenticated;
