-- Commercial Phase 3: privacy-safe fraud network, prepaid wallet,
-- reseller channel and Telegram operations outbox.

CREATE TABLE IF NOT EXISTS public.network_risk_signals(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  phone_hash TEXT NOT NULL,risk_type TEXT NOT NULL CHECK(risk_type IN('boom','refused','fraud','resolved')),
  severity INT NOT NULL DEFAULT 1 CHECK(severity BETWEEN 1 AND 5),note TEXT,created_by UUID REFERENCES auth.users(id),created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_network_risk_phone_hash ON public.network_risk_signals(phone_hash);
ALTER TABLE public.network_risk_signals ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.prepaid_wallets(
  shop_id UUID PRIMARY KEY REFERENCES public.shops(id) ON DELETE CASCADE,balance NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK(balance>=0),currency TEXT NOT NULL DEFAULT 'VND',updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.wallet_ledger(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK(direction IN('credit','debit')),amount NUMERIC(14,2) NOT NULL CHECK(amount>0),
  balance_after NUMERIC(14,2) NOT NULL,reference_type TEXT NOT NULL,reference_id TEXT NOT NULL,description TEXT,created_by UUID REFERENCES auth.users(id),created_at TIMESTAMPTZ NOT NULL DEFAULT now(),UNIQUE(shop_id,reference_type,reference_id)
);
ALTER TABLE public.prepaid_wallets ENABLE ROW LEVEL SECURITY;ALTER TABLE public.wallet_ledger ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.reseller_accounts(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),name TEXT NOT NULL,code TEXT UNIQUE NOT NULL,commission_rate NUMERIC(5,2) NOT NULL DEFAULT 10 CHECK(commission_rate BETWEEN 0 AND 50),status TEXT NOT NULL DEFAULT 'active',created_by UUID REFERENCES auth.users(id),created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.reseller_shops(
  reseller_id UUID REFERENCES public.reseller_accounts(id) ON DELETE CASCADE,shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),PRIMARY KEY(reseller_id,shop_id),UNIQUE(shop_id)
);
ALTER TABLE public.reseller_accounts ENABLE ROW LEVEL SECURITY;ALTER TABLE public.reseller_shops ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.ops_alert_outbox(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),alert_type TEXT NOT NULL,severity TEXT NOT NULL CHECK(severity IN('info','warning','critical')),
  title TEXT NOT NULL,message TEXT NOT NULL,payload JSONB NOT NULL DEFAULT '{}'::jsonb,status TEXT NOT NULL DEFAULT 'pending',attempts INT NOT NULL DEFAULT 0,last_error TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),sent_at TIMESTAMPTZ
);
ALTER TABLE public.ops_alert_outbox ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.enqueue_carrier_ops_alert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NEW.status IN('offline','dom_changed','degraded') THEN
    INSERT INTO public.ops_alert_outbox(alert_type,severity,title,message,payload)
    VALUES('carrier_health',CASE WHEN NEW.status='offline' THEN 'critical' ELSE 'warning' END,
      'Carrier '||NEW.carrier_code||' '||NEW.status,
      COALESCE(NEW.error_message,'Thời gian phản hồi: '||COALESCE(NEW.response_time_ms,0)||' ms'),
      jsonb_build_object('carrier_code',NEW.carrier_code,'status',NEW.status,'response_time_ms',NEW.response_time_ms));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_carrier_ops_alert ON public.carrier_health_logs;
CREATE TRIGGER trg_carrier_ops_alert AFTER INSERT ON public.carrier_health_logs FOR EACH ROW EXECUTE FUNCTION public.enqueue_carrier_ops_alert();

CREATE OR REPLACE FUNCTION public.report_network_risk(p_phone TEXT,p_risk_type TEXT,p_severity INT,p_note TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_shop UUID;v_hash TEXT;
BEGIN
  SELECT shop_id INTO v_shop FROM public.shop_members WHERE user_id=auth.uid() AND removed_at IS NULL ORDER BY CASE role WHEN 'OWNER' THEN 0 ELSE 1 END LIMIT 1;
  IF v_shop IS NULL THEN RAISE EXCEPTION 'SHOP_MEMBERSHIP_REQUIRED'; END IF;
  IF p_risk_type NOT IN('boom','refused','fraud','resolved') OR p_severity NOT BETWEEN 1 AND 5 THEN RAISE EXCEPTION 'INVALID_RISK_SIGNAL'; END IF;
  v_hash:=encode(digest(regexp_replace(p_phone,'\D','','g'),'sha256'),'hex');
  INSERT INTO public.network_risk_signals(shop_id,phone_hash,risk_type,severity,note,created_by) VALUES(v_shop,v_hash,p_risk_type,p_severity,left(p_note,500),auth.uid());
  RETURN jsonb_build_object('success',true);
END $$;

CREATE OR REPLACE FUNCTION public.check_network_risk(p_phone TEXT)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_hash TEXT;v_shops INT;v_reports INT;v_score INT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  v_hash:=encode(digest(regexp_replace(p_phone,'\D','','g'),'sha256'),'hex');
  SELECT count(DISTINCT shop_id),count(*),COALESCE(sum(CASE WHEN risk_type='resolved' THEN -severity ELSE severity END),0) INTO v_shops,v_reports,v_score FROM public.network_risk_signals WHERE phone_hash=v_hash AND created_at>=now()-interval '365 days';
  RETURN jsonb_build_object('risk_level',CASE WHEN v_shops<2 THEN 'unknown' WHEN v_score>=12 THEN 'high' WHEN v_score>=5 THEN 'medium' ELSE 'low' END,'reporting_shops',CASE WHEN v_shops>=2 THEN v_shops ELSE 0 END,'reports',CASE WHEN v_shops>=2 THEN v_reports ELSE 0 END,'privacy_threshold_met',v_shops>=2);
END $$;

CREATE OR REPLACE FUNCTION public.admin_credit_wallet(p_shop_id UUID,p_amount NUMERIC,p_reference_id TEXT,p_description TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_balance NUMERIC;
BEGIN
  IF NOT public.is_system_admin() THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;IF p_amount<=0 OR NULLIF(trim(p_reference_id),'') IS NULL THEN RAISE EXCEPTION 'INVALID_WALLET_CREDIT'; END IF;
  INSERT INTO public.prepaid_wallets(shop_id,balance)VALUES(p_shop_id,p_amount)ON CONFLICT(shop_id)DO UPDATE SET balance=public.prepaid_wallets.balance+p_amount,updated_at=now() RETURNING balance INTO v_balance;
  INSERT INTO public.wallet_ledger(shop_id,direction,amount,balance_after,reference_type,reference_id,description,created_by)VALUES(p_shop_id,'credit',p_amount,v_balance,'admin_credit',p_reference_id,p_description,auth.uid());
  RETURN jsonb_build_object('success',true,'balance',v_balance);
EXCEPTION WHEN unique_violation THEN RETURN jsonb_build_object('success',true,'idempotent',true,'balance',(SELECT balance FROM public.prepaid_wallets WHERE shop_id=p_shop_id));END $$;

CREATE OR REPLACE FUNCTION public.consume_wallet_credit(p_shop_id UUID,p_amount NUMERIC,p_reference_type TEXT,p_reference_id TEXT,p_description TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_balance NUMERIC;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.shop_members WHERE shop_id=p_shop_id AND user_id=auth.uid() AND removed_at IS NULL) AND NOT public.is_system_admin() THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;
  IF p_amount<=0 THEN RAISE EXCEPTION 'INVALID_DEBIT'; END IF;
  UPDATE public.prepaid_wallets SET balance=balance-p_amount,updated_at=now() WHERE shop_id=p_shop_id AND balance>=p_amount RETURNING balance INTO v_balance;
  IF v_balance IS NULL THEN RAISE EXCEPTION 'INSUFFICIENT_BALANCE'; END IF;
  INSERT INTO public.wallet_ledger(shop_id,direction,amount,balance_after,reference_type,reference_id,description,created_by)VALUES(p_shop_id,'debit',p_amount,v_balance,p_reference_type,p_reference_id,p_description,auth.uid());
  RETURN jsonb_build_object('success',true,'balance',v_balance);
EXCEPTION WHEN unique_violation THEN RETURN jsonb_build_object('success',true,'idempotent',true,'balance',(SELECT balance FROM public.prepaid_wallets WHERE shop_id=p_shop_id));END $$;

CREATE OR REPLACE FUNCTION public.admin_create_reseller(p_name TEXT,p_code TEXT,p_commission_rate NUMERIC)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE v_id UUID;BEGIN IF NOT public.is_system_admin() THEN RAISE EXCEPTION 'ACCESS_DENIED';END IF;INSERT INTO public.reseller_accounts(name,code,commission_rate,created_by)VALUES(trim(p_name),upper(trim(p_code)),p_commission_rate,auth.uid())RETURNING id INTO v_id;RETURN jsonb_build_object('success',true,'id',v_id);END $$;

CREATE OR REPLACE FUNCTION public.admin_get_growth_metrics()
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ BEGIN IF NOT public.is_system_admin() THEN RAISE EXCEPTION 'ACCESS_DENIED';END IF;RETURN jsonb_build_object('wallet_balance_total',(SELECT COALESCE(sum(balance),0)FROM public.prepaid_wallets),'wallet_shops',(SELECT count(*)FROM public.prepaid_wallets),'resellers',(SELECT count(*)FROM public.reseller_accounts WHERE status='active'),'risk_reports_30d',(SELECT count(*)FROM public.network_risk_signals WHERE created_at>=now()-interval '30 days'),'telegram_pending',(SELECT count(*)FROM public.ops_alert_outbox WHERE status='pending'));END $$;

GRANT EXECUTE ON FUNCTION public.report_network_risk(TEXT,TEXT,INT,TEXT),public.check_network_risk(TEXT),public.admin_credit_wallet(UUID,NUMERIC,TEXT,TEXT),public.consume_wallet_credit(UUID,NUMERIC,TEXT,TEXT,TEXT),public.admin_create_reseller(TEXT,TEXT,NUMERIC),public.admin_get_growth_metrics() TO authenticated;
