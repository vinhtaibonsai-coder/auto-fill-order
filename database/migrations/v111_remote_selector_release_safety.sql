-- P5 Remote Selector operational safety: history and audited rollback.
ALTER TABLE public.remote_selector_releases ADD COLUMN IF NOT EXISTS rollback_reason TEXT;
ALTER TABLE public.remote_selector_releases ADD COLUMN IF NOT EXISTS rolled_back_at TIMESTAMPTZ;
ALTER TABLE public.remote_selector_releases ADD COLUMN IF NOT EXISTS rolled_back_by UUID REFERENCES auth.users(id);

CREATE OR REPLACE FUNCTION public.admin_list_remote_selector_releases(p_carrier_code TEXT,p_limit INT)
RETURNS SETOF public.remote_selector_releases LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN IF NOT public.is_system_admin() THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;
 RETURN QUERY SELECT * FROM public.remote_selector_releases WHERE carrier_code=upper(trim(p_carrier_code)) ORDER BY version DESC LIMIT LEAST(GREATEST(p_limit,1),100); END $$;

CREATE OR REPLACE FUNCTION public.admin_rollback_remote_selectors(p_carrier_code TEXT,p_target_version INT,p_reason TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_target public.remote_selector_releases%ROWTYPE;
BEGIN IF NOT public.is_system_admin() THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;
 IF length(trim(COALESCE(p_reason,'')))<5 THEN RAISE EXCEPTION 'ROLLBACK_REASON_REQUIRED'; END IF;
 SELECT * INTO v_target FROM public.remote_selector_releases WHERE carrier_code=upper(trim(p_carrier_code)) AND version=p_target_version;
 IF v_target.id IS NULL THEN RAISE EXCEPTION 'RELEASE_NOT_FOUND'; END IF;
 UPDATE public.remote_selector_releases SET status='rolled_back',rollback_reason=p_reason,rolled_back_at=now(),rolled_back_by=auth.uid() WHERE carrier_code=v_target.carrier_code AND status='active';
 UPDATE public.remote_selector_releases SET status='active',published_at=now(),rollback_reason=NULL,rolled_back_at=NULL,rolled_back_by=NULL WHERE id=v_target.id;
 PERFORM public.insert_audit_log('ADMIN_ROLLBACK_REMOTE_SELECTORS','remote_selector_release',v_target.id::text,jsonb_build_object('carrier',v_target.carrier_code,'version',v_target.version,'reason',p_reason),NULL);
 RETURN jsonb_build_object('success',true,'carrier_code',v_target.carrier_code,'version',v_target.version);
END $$;
GRANT EXECUTE ON FUNCTION public.admin_list_remote_selector_releases(TEXT,INT),public.admin_rollback_remote_selectors(TEXT,INT,TEXT) TO authenticated,service_role;
NOTIFY pgrst,'reload schema';
