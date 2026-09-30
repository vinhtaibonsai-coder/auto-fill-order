-- Admin Fast Operations Hub. Apply after v65.
-- Every write is SYSTEM_ADMIN-only, transactional and audited.

ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS admin_reply TEXT;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS internal_note TEXT;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.admin_get_ai_quota_overview()
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.is_system_admin() THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;
  RETURN (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.ai_monthly_used DESC),'[]'::jsonb) FROM (
    SELECT s.id shop_id,s.name shop_name,q.ai_monthly_used,q.ai_monthly_limit,
      CASE WHEN q.ai_monthly_limit>0 THEN round(q.ai_monthly_used::numeric/q.ai_monthly_limit*100,1) ELSE 0 END usage_percent
    FROM public.shops s LEFT JOIN public.shop_quotas q ON q.shop_id=s.id WHERE s.deleted_at IS NULL ORDER BY q.ai_monthly_used DESC NULLS LAST LIMIT 10
  ) x);
END $$;

CREATE OR REPLACE FUNCTION public.admin_topup_shop_quota(p_shop_id UUID, p_amount INT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_limit INT;
BEGIN
  IF NOT public.is_system_admin() THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;
  IF p_amount NOT IN (500, 1000, 2000) THEN RAISE EXCEPTION 'INVALID_QUOTA_AMOUNT'; END IF;
  INSERT INTO public.shop_quotas(shop_id, ai_monthly_limit, ai_monthly_used)
  VALUES (p_shop_id, p_amount, 0)
  ON CONFLICT (shop_id) DO UPDATE SET ai_monthly_limit = public.shop_quotas.ai_monthly_limit + p_amount, updated_at = now()
  RETURNING ai_monthly_limit INTO v_limit;
  PERFORM public.insert_audit_log('ADMIN_TOPUP_QUOTA','shop_quota',p_shop_id::text,jsonb_build_object('amount',p_amount,'new_limit',v_limit),p_shop_id);
  RETURN jsonb_build_object('success',true,'new_limit',v_limit);
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_user_role(p_user_id UUID, p_role_code TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_role_id UUID;
BEGIN
  IF NOT public.is_system_admin() THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;
  IF p_role_code NOT IN ('SYSTEM_ADMIN','SUPPORT_ADMIN','FINANCE_ADMIN') THEN RAISE EXCEPTION 'INVALID_ROLE'; END IF;
  SELECT id INTO v_role_id FROM public.roles WHERE code=p_role_code;
  IF v_role_id IS NULL THEN RAISE EXCEPTION 'ROLE_NOT_CONFIGURED: %',p_role_code; END IF;
  DELETE FROM public.user_roles ur USING public.roles r WHERE ur.user_id=p_user_id AND ur.role_id=r.id AND r.code IN ('SYSTEM_ADMIN','SUPPORT_ADMIN','FINANCE_ADMIN');
  INSERT INTO public.user_roles(user_id,role_id) VALUES(p_user_id,v_role_id) ON CONFLICT DO NOTHING;
  PERFORM public.insert_audit_log('ADMIN_SET_USER_ROLE','user',p_user_id::text,jsonb_build_object('role',p_role_code),NULL);
  RETURN jsonb_build_object('success',true);
END $$;

CREATE OR REPLACE FUNCTION public.admin_transfer_shop_ownership(p_shop_id UUID,p_new_owner_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_role_id UUID;
BEGIN
  IF NOT public.is_system_admin() THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_new_owner_id) THEN RAISE EXCEPTION 'USER_NOT_FOUND'; END IF;
  SELECT id INTO v_role_id FROM public.roles WHERE code='SHOP_OWNER';
  UPDATE public.shops SET owner_id=p_new_owner_id,updated_at=now() WHERE id=p_shop_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'SHOP_NOT_FOUND'; END IF;
  INSERT INTO public.shop_members(shop_id,user_id,role_id,status) VALUES(p_shop_id,p_new_owner_id,v_role_id,'active')
  ON CONFLICT(shop_id,user_id) DO UPDATE SET role_id=v_role_id,status='active',removed_at=NULL;
  PERFORM public.insert_audit_log('ADMIN_TRANSFER_OWNERSHIP','shop',p_shop_id::text,jsonb_build_object('new_owner_id',p_new_owner_id),p_shop_id);
  RETURN jsonb_build_object('success',true);
END $$;

CREATE OR REPLACE FUNCTION public.admin_create_admin_account(p_email TEXT,p_full_name TEXT,p_password TEXT,p_role_code TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user_id UUID:=gen_random_uuid(); v_role_id UUID; v_instance UUID;
BEGIN
  IF NOT public.is_system_admin() THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;
  IF p_role_code NOT IN ('SYSTEM_ADMIN','SUPPORT_ADMIN','FINANCE_ADMIN') OR p_email !~* '^[^@]+@[^@]+\.[^@]+$' OR length(p_password)<8 THEN RAISE EXCEPTION 'INVALID_ADMIN_ACCOUNT'; END IF;
  IF EXISTS(SELECT 1 FROM auth.users WHERE lower(email)=lower(p_email)) THEN RAISE EXCEPTION 'EMAIL_EXISTS'; END IF;
  SELECT id INTO v_role_id FROM public.roles WHERE code=p_role_code;
  IF v_role_id IS NULL THEN RAISE EXCEPTION 'ROLE_NOT_CONFIGURED'; END IF;
  SELECT id INTO v_instance FROM auth.instances LIMIT 1;
  INSERT INTO auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,confirmation_token,recovery_token,created_at,updated_at)
  VALUES(v_instance,v_user_id,'authenticated','authenticated',lower(trim(p_email)),crypt(p_password,gen_salt('bf')),now(),'','',now(),now());
  INSERT INTO auth.identities(id,user_id,identity_data,provider,provider_id,last_sign_in_at,created_at,updated_at)
  VALUES(v_user_id,v_user_id,jsonb_build_object('sub',v_user_id::text,'email',lower(trim(p_email))),'email',lower(trim(p_email)),now(),now(),now());
  INSERT INTO public.profiles(id,email,full_name,status) VALUES(v_user_id,lower(trim(p_email)),trim(p_full_name),'active');
  INSERT INTO public.user_roles(user_id,role_id) VALUES(v_user_id,v_role_id);
  PERFORM public.insert_audit_log('ADMIN_CREATE_ACCOUNT','user',v_user_id::text,jsonb_build_object('email',p_email,'role',p_role_code),NULL);
  RETURN jsonb_build_object('success',true,'user_id',v_user_id);
END $$;

CREATE OR REPLACE FUNCTION public.admin_override_subscription(p_shop_id UUID, p_plan_code TEXT, p_extend_months INT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_end TIMESTAMPTZ;
BEGIN
  IF NOT public.is_system_admin() THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;
  IF p_plan_code NOT IN ('FREE','TRIAL','PRO','PRO_MONTH','PRO_YEAR','ENTERPRISE') OR p_extend_months NOT IN (1,3,12) THEN RAISE EXCEPTION 'INVALID_SUBSCRIPTION_OVERRIDE'; END IF;
  INSERT INTO public.subscriptions(shop_id,plan_tier,status,current_period_start,current_period_end)
  VALUES(p_shop_id,p_plan_code,'active',now(),now() + make_interval(months=>p_extend_months))
  ON CONFLICT(shop_id) DO UPDATE SET plan_tier=p_plan_code,status='active',current_period_end=GREATEST(public.subscriptions.current_period_end,now()) + make_interval(months=>p_extend_months),updated_at=now()
  RETURNING current_period_end INTO v_end;
  PERFORM public.insert_audit_log('ADMIN_OVERRIDE_SUBSCRIPTION','subscription',p_shop_id::text,jsonb_build_object('plan',p_plan_code,'months',p_extend_months,'period_end',v_end),p_shop_id);
  RETURN jsonb_build_object('success',true,'current_period_end',v_end);
END $$;

CREATE OR REPLACE FUNCTION public.admin_revoke_shop_devices(p_shop_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_count INT;
BEGIN
  IF NOT public.is_system_admin() THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;
  UPDATE public.extension_devices d SET revoked=true
  WHERE EXISTS (SELECT 1 FROM public.shop_members sm WHERE sm.shop_id=p_shop_id AND sm.user_id=d.user_id AND sm.removed_at IS NULL) AND COALESCE(d.revoked,false)=false;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  PERFORM public.insert_audit_log('ADMIN_REVOKE_SHOP_DEVICES','device',p_shop_id::text,jsonb_build_object('revoked_count',v_count),p_shop_id);
  RETURN jsonb_build_object('success',true,'revoked_count',v_count);
END $$;

CREATE OR REPLACE FUNCTION public.admin_reply_support_ticket(p_ticket_id UUID, p_reply TEXT, p_internal_note TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.is_system_admin() THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;
  IF NULLIF(trim(p_reply),'') IS NULL THEN RAISE EXCEPTION 'REPLY_REQUIRED'; END IF;
  UPDATE public.support_tickets SET admin_reply=trim(p_reply),internal_note=NULLIF(trim(p_internal_note),''),status='in_progress',replied_at=now(),updated_at=now() WHERE id=p_ticket_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'TICKET_NOT_FOUND'; END IF;
  PERFORM public.insert_audit_log('ADMIN_REPLY_TICKET','support_ticket',p_ticket_id::text,jsonb_build_object('has_internal_note',NULLIF(trim(p_internal_note),'') IS NOT NULL),NULL);
  RETURN jsonb_build_object('success',true);
END $$;

CREATE OR REPLACE FUNCTION public.admin_publish_release(p_version TEXT,p_min_supported_version TEXT,p_force_update BOOLEAN,p_rollout_percentage INT,p_release_notes TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id UUID;
BEGIN
  IF NOT public.is_system_admin() THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;
  IF NULLIF(trim(p_version),'') IS NULL OR p_rollout_percentage NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'INVALID_RELEASE'; END IF;
  INSERT INTO public.release_versions(version,min_supported_version,is_force_update,rollout_percentage,release_notes)
  VALUES(trim(p_version),NULLIF(trim(p_min_supported_version),''),COALESCE(p_force_update,false),p_rollout_percentage,p_release_notes)
  ON CONFLICT(version) DO UPDATE SET min_supported_version=excluded.min_supported_version,is_force_update=excluded.is_force_update,rollout_percentage=excluded.rollout_percentage,release_notes=excluded.release_notes
  RETURNING id INTO v_id;
  PERFORM public.insert_audit_log('ADMIN_PUBLISH_RELEASE','release',v_id::text,jsonb_build_object('version',p_version,'rollout',p_rollout_percentage),NULL);
  RETURN jsonb_build_object('success',true,'id',v_id);
END $$;

CREATE OR REPLACE FUNCTION public.admin_record_carrier_probe(p_carrier_code TEXT,p_status TEXT,p_response_time_ms INT,p_error_message TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id UUID;
BEGIN
  IF NOT public.is_system_admin() THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;
  IF p_status NOT IN ('healthy','degraded','dom_changed','offline') THEN RAISE EXCEPTION 'INVALID_PROBE_STATUS'; END IF;
  INSERT INTO public.carrier_health_logs(carrier_code,status,response_time_ms,error_message) VALUES(upper(p_carrier_code),p_status,GREATEST(p_response_time_ms,0),p_error_message) RETURNING id INTO v_id;
  RETURN jsonb_build_object('success',true,'id',v_id);
END $$;

GRANT EXECUTE ON FUNCTION public.admin_get_ai_quota_overview(), public.admin_topup_shop_quota(UUID,INT), public.admin_set_user_role(UUID,TEXT), public.admin_transfer_shop_ownership(UUID,UUID), public.admin_create_admin_account(TEXT,TEXT,TEXT,TEXT), public.admin_override_subscription(UUID,TEXT,INT), public.admin_revoke_shop_devices(UUID), public.admin_reply_support_ticket(UUID,TEXT,TEXT), public.admin_publish_release(TEXT,TEXT,BOOLEAN,INT,TEXT), public.admin_record_carrier_probe(TEXT,TEXT,INT,TEXT) TO authenticated;
