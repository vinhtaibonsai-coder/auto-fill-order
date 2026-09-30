-- v64_customer_hub_360.sql
-- Customer Hub & 360 Profile: tenant-safe, idempotent aggregation.

BEGIN;

-- Upgrade the oldest customer table variant before child tables reference it.
-- A UNIQUE key is sufficient as an FK target and avoids replacing a legacy PK.
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
UPDATE public.customers SET id = gen_random_uuid() WHERE id IS NULL;
ALTER TABLE public.customers ALTER COLUMN id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS customers_id_uidx ON public.customers(id);

ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS normalized_phone TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS display_phone TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS primary_address_id UUID;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS risk_level TEXT DEFAULT 'safe';
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS successful_orders INTEGER DEFAULT 0;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS failed_orders INTEGER DEFAULT 0;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS total_spent NUMERIC DEFAULT 0;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS aov NUMERIC DEFAULT 0;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS delivery_success_rate NUMERIC DEFAULT 0;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS first_order_at TIMESTAMPTZ;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS last_order_at TIMESTAMPTZ;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS is_blacklisted BOOLEAN DEFAULT false;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS blacklist_reason TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS metrics_updated_at TIMESTAMPTZ;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
-- Some commercial/legacy deployments created customers without created_at.
-- Add it before backfill, ranking and upsert statements reference the column.
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS segment TEXT DEFAULT 'new';
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS total_orders INTEGER DEFAULT 0;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS total_cod NUMERIC DEFAULT 0;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS latest_date TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS fav_carrier TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS entity_type TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS entity_id TEXT;

UPDATE public.customers
SET normalized_phone = regexp_replace(COALESCE(normalized_phone, phone, ''), '\D', '', 'g'),
    display_phone = COALESCE(display_phone, phone),
    total_spent = COALESCE(total_spent, total_cod, 0),
    last_order_at = COALESCE(last_order_at, latest_date, created_at),
    first_order_at = COALESCE(first_order_at, created_at)
WHERE normalized_phone IS NULL OR normalized_phone = '';

-- Existing CRM rows were historically append-only. Keep the strongest row per
-- shop/phone before enforcing the canonical identity.
WITH ranked AS (
  SELECT ctid, row_number() OVER (
    PARTITION BY shop_id, normalized_phone
    ORDER BY COALESCE(total_orders,0) DESC, COALESCE(total_cod,0) DESC, created_at DESC
  ) AS rn
  FROM public.customers
  WHERE normalized_phone IS NOT NULL AND normalized_phone <> ''
)
DELETE FROM public.customers c USING ranked r WHERE c.ctid=r.ctid AND r.rn>1;

CREATE UNIQUE INDEX IF NOT EXISTS customers_shop_normalized_phone_uidx
  ON public.customers(shop_id, normalized_phone)
  WHERE normalized_phone IS NOT NULL AND normalized_phone <> '';
CREATE INDEX IF NOT EXISTS customers_shop_segment_idx ON public.customers(shop_id, segment);
CREATE INDEX IF NOT EXISTS customers_shop_last_order_idx ON public.customers(shop_id, last_order_at DESC);

CREATE TABLE IF NOT EXISTS public.customer_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  raw_address TEXT NOT NULL,
  normalized_address TEXT,
  province TEXT,
  district TEXT,
  ward TEXT,
  address_fingerprint TEXT NOT NULL,
  use_count INTEGER NOT NULL DEFAULT 1 CHECK (use_count >= 0),
  successful_delivery_count INTEGER NOT NULL DEFAULT 0 CHECK (successful_delivery_count >= 0),
  first_used_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ DEFAULT now(),
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(customer_id, address_fingerprint)
);

CREATE UNIQUE INDEX IF NOT EXISTS customer_addresses_one_primary_uidx
  ON public.customer_addresses(customer_id) WHERE is_primary = true;
CREATE INDEX IF NOT EXISTS customer_addresses_shop_customer_idx
  ON public.customer_addresses(shop_id, customer_id, last_used_at DESC);

CREATE TABLE IF NOT EXISTS public.customer_order_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('order', 'submitted_order', 'import')),
  source_order_id TEXT NOT NULL,
  canonical_key TEXT,
  order_code TEXT,
  tracking_code TEXT,
  carrier TEXT,
  status TEXT DEFAULT 'pending',
  address_fingerprint TEXT,
  cod_amount NUMERIC DEFAULT 0 CHECK (cod_amount >= 0),
  ordered_at TIMESTAMPTZ DEFAULT now(),
  synced_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(shop_id, source_type, source_order_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS customer_order_links_canonical_uidx
  ON public.customer_order_links(shop_id, canonical_key)
  WHERE canonical_key IS NOT NULL AND canonical_key <> '';
CREATE INDEX IF NOT EXISTS customer_order_links_customer_idx
  ON public.customer_order_links(customer_id, ordered_at DESC);
ALTER TABLE public.customer_order_links ADD COLUMN IF NOT EXISTS address_fingerprint TEXT;

DO $$ BEGIN
  ALTER TABLE public.customers
    ADD CONSTRAINT customers_primary_address_fk
    FOREIGN KEY (primary_address_id) REFERENCES public.customer_addresses(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.customer_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (length(btrim(content)) BETWEEN 1 AND 2000),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_by_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.customer_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#2563eb',
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(shop_id, name)
);

CREATE TABLE IF NOT EXISTS public.customer_tag_assignments (
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.customer_tags(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY(customer_id, tag_id)
);

CREATE TABLE IF NOT EXISTS public.customer_risk_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  source_order_link_id UUID REFERENCES public.customer_order_links(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  reason TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customer_sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL CHECK (job_type IN ('backfill', 'import')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'partial', 'failed', 'cancelled')),
  cursor_value TEXT,
  total_rows INTEGER DEFAULT 0,
  processed_rows INTEGER DEFAULT 0,
  success_rows INTEGER DEFAULT 0,
  error_rows INTEGER DEFAULT 0,
  error_report JSONB DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.customer_hub_normalize_phone(p_phone TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT CASE
    WHEN regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g') ~ '^84[0-9]{9}$'
      THEN '0' || substring(regexp_replace(p_phone, '\D', '', 'g') FROM 3)
    ELSE regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g')
  END;
$$;

CREATE OR REPLACE FUNCTION public.customer_hub_address_fingerprint(p_address TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT md5(lower(regexp_replace(btrim(COALESCE(p_address, '')), '\s+', ' ', 'g')));
$$;

CREATE OR REPLACE FUNCTION public.customer_hub_rebuild_metrics(p_customer_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_total INT; v_success INT; v_failed INT; v_spent NUMERIC; v_first TIMESTAMPTZ; v_last TIMESTAMPTZ; v_fav TEXT;
BEGIN
  SELECT count(*),
         count(*) FILTER (WHERE lower(status) IN ('success','completed','delivered','giao thành công')),
         count(*) FILTER (WHERE lower(status) IN ('failed','returned','cancelled','hoàn','hủy')),
         COALESCE(sum(cod_amount) FILTER (WHERE lower(status) IN ('success','completed','delivered','giao thành công')), 0),
         min(ordered_at), max(ordered_at)
  INTO v_total, v_success, v_failed, v_spent, v_first, v_last
  FROM public.customer_order_links WHERE customer_id = p_customer_id;

  SELECT carrier INTO v_fav FROM public.customer_order_links
  WHERE customer_id = p_customer_id AND carrier IS NOT NULL
  GROUP BY carrier ORDER BY count(*) FILTER (WHERE lower(status) IN ('success','completed','delivered','giao thành công')) DESC, count(*) DESC LIMIT 1;

  UPDATE public.customers SET
    total_orders = COALESCE(v_total, 0), successful_orders = COALESCE(v_success, 0), failed_orders = COALESCE(v_failed, 0),
    total_spent = COALESCE(v_spent, 0), total_cod = COALESCE(v_spent, 0),
    aov = CASE WHEN COALESCE(v_success,0) > 0 THEN round(v_spent / v_success, 0) ELSE 0 END,
    delivery_success_rate = CASE WHEN COALESCE(v_total,0) > 0 THEN round(v_success * 100.0 / v_total, 2) ELSE 0 END,
    first_order_at = v_first, last_order_at = v_last, latest_date = COALESCE(v_last, latest_date), fav_carrier = v_fav,
    segment = CASE
      WHEN is_blacklisted OR COALESCE(v_failed,0) > 0 THEN 'risk'
      WHEN COALESCE(v_spent,0) >= 2000000 OR COALESCE(v_success,0) >= 5 THEN 'vip'
      WHEN COALESCE(v_success,0) >= 2 AND v_last < now() - interval '60 days' THEN 'churn_risk'
      WHEN COALESCE(v_success,0) >= 2 THEN 'repeat'
      ELSE 'new' END,
    risk_level = CASE WHEN is_blacklisted THEN 'blacklist' WHEN COALESCE(v_failed,0) > 0 THEN 'warning' ELSE 'safe' END,
    metrics_updated_at = now(), updated_at = now()
  WHERE id = p_customer_id;

  WITH address_stats AS (
    SELECT address_fingerprint,
           count(*)::integer AS use_count,
           count(*) FILTER (WHERE lower(status) IN ('success','completed','delivered','giao thành công'))::integer AS success_count,
           min(ordered_at) AS first_used_at,
           max(ordered_at) AS last_used_at
    FROM public.customer_order_links
    WHERE customer_id = p_customer_id AND address_fingerprint IS NOT NULL
    GROUP BY address_fingerprint
  )
  UPDATE public.customer_addresses a SET
    use_count=s.use_count, successful_delivery_count=s.success_count,
    first_used_at=s.first_used_at, last_used_at=s.last_used_at, updated_at=now(), is_primary=false
  FROM address_stats s
  WHERE a.customer_id=p_customer_id AND a.address_fingerprint=s.address_fingerprint;

  UPDATE public.customer_addresses SET is_primary=true
  WHERE id = (
    SELECT id FROM public.customer_addresses
    WHERE customer_id=p_customer_id
    ORDER BY successful_delivery_count DESC, use_count DESC, last_used_at DESC, id
    LIMIT 1
  );
  UPDATE public.customers SET primary_address_id=(
    SELECT id FROM public.customer_addresses WHERE customer_id=p_customer_id AND is_primary=true LIMIT 1
  ) WHERE id=p_customer_id;

  INSERT INTO public.customer_risk_events(shop_id,customer_id,source_order_link_id,event_type,severity,reason)
  SELECT l.shop_id,l.customer_id,l.id,'delivery_failure','warning','Đơn giao thất bại/hoàn/hủy'
  FROM public.customer_order_links l
  WHERE l.customer_id=p_customer_id
    AND lower(l.status) IN ('failed','returned','cancelled','hoàn','hủy')
    AND NOT EXISTS (
      SELECT 1 FROM public.customer_risk_events e
      WHERE e.source_order_link_id=l.id AND e.event_type='delivery_failure'
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.customer_hub_sync_order(
  p_shop_id UUID, p_source_type TEXT, p_source_order_id TEXT, p_phone TEXT, p_name TEXT,
  p_address TEXT, p_order_code TEXT, p_tracking_code TEXT, p_carrier TEXT,
  p_status TEXT, p_cod_amount NUMERIC, p_ordered_at TIMESTAMPTZ DEFAULT now()
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_phone TEXT; v_customer UUID; v_link UUID; v_canonical TEXT; v_address_fp TEXT;
BEGIN
  IF NOT (public.is_shop_member(p_shop_id) OR public.is_system_admin()) THEN RAISE EXCEPTION 'customer_hub_forbidden'; END IF;
  v_phone := public.customer_hub_normalize_phone(p_phone);
  IF length(v_phone) < 9 OR length(v_phone) > 11 THEN RETURN NULL; END IF;
  v_canonical := CASE
    WHEN COALESCE(btrim(p_tracking_code),'') <> '' THEN 'tracking:' || lower(btrim(p_tracking_code))
    WHEN COALESCE(btrim(p_order_code),'') <> '' THEN 'phone-order:' || v_phone || ':' || lower(btrim(p_order_code))
    ELSE p_source_type || ':' || p_source_order_id END;

  INSERT INTO public.customers(shop_id, phone, normalized_phone, display_phone, name, address, segment, created_at, updated_at)
  VALUES(p_shop_id, v_phone, v_phone, p_phone, COALESCE(NULLIF(btrim(p_name),''),'Khách hàng'), NULLIF(btrim(p_address),''), 'new', now(), now())
  ON CONFLICT (shop_id, normalized_phone) WHERE normalized_phone IS NOT NULL AND normalized_phone <> ''
  DO UPDATE SET
    name = CASE WHEN public.customers.name IS NULL OR public.customers.name IN ('','Khách hàng') THEN EXCLUDED.name ELSE public.customers.name END,
    address = COALESCE(NULLIF(EXCLUDED.address,''), public.customers.address), updated_at = now()
  RETURNING id INTO v_customer;

  v_address_fp := CASE WHEN COALESCE(btrim(p_address),'') <> '' THEN public.customer_hub_address_fingerprint(p_address) ELSE NULL END;
  INSERT INTO public.customer_order_links(shop_id, customer_id, source_type, source_order_id, canonical_key, order_code, tracking_code, carrier, status, address_fingerprint, cod_amount, ordered_at)
  VALUES(p_shop_id, v_customer, p_source_type, p_source_order_id, v_canonical, p_order_code, p_tracking_code, lower(p_carrier), lower(COALESCE(p_status,'pending')), v_address_fp, GREATEST(COALESCE(p_cod_amount,0),0), COALESCE(p_ordered_at,now()))
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_link;
  IF v_link IS NULL THEN
    SELECT id, customer_id INTO v_link, v_customer FROM public.customer_order_links
    WHERE shop_id=p_shop_id AND ((source_type=p_source_type AND source_order_id=p_source_order_id) OR canonical_key=v_canonical) LIMIT 1;
    UPDATE public.customer_order_links SET
      status=lower(COALESCE(p_status,'pending')), tracking_code=COALESCE(NULLIF(p_tracking_code,''),tracking_code),
      address_fingerprint=COALESCE(v_address_fp,address_fingerprint),
      cod_amount=GREATEST(COALESCE(p_cod_amount,0),0), ordered_at=COALESCE(p_ordered_at,ordered_at), synced_at=now()
    WHERE id=v_link;
  END IF;
  IF v_customer IS NULL THEN RETURN NULL; END IF;

  IF COALESCE(btrim(p_address),'') <> '' THEN
    INSERT INTO public.customer_addresses(shop_id, customer_id, raw_address, normalized_address, address_fingerprint, use_count, successful_delivery_count, first_used_at, last_used_at)
    VALUES(p_shop_id, v_customer, btrim(p_address), btrim(p_address), v_address_fp, 1,
      CASE WHEN lower(COALESCE(p_status,'')) IN ('success','completed','delivered','giao thành công') THEN 1 ELSE 0 END,
      COALESCE(p_ordered_at,now()), COALESCE(p_ordered_at,now()))
    ON CONFLICT (customer_id, address_fingerprint) DO UPDATE SET
      raw_address=EXCLUDED.raw_address, last_used_at=GREATEST(public.customer_addresses.last_used_at,EXCLUDED.last_used_at),
      updated_at=now();
  END IF;
  PERFORM public.customer_hub_rebuild_metrics(v_customer);
  RETURN v_customer;
END;
$$;

CREATE OR REPLACE FUNCTION public.customer_hub_backfill_batch(p_shop_id UUID, p_orders JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE item JSONB; processed INTEGER := 0; succeeded INTEGER := 0; failed INTEGER := 0; errors JSONB := '[]'::jsonb;
BEGIN
  IF NOT (public.is_shop_owner_or_manager(p_shop_id) OR public.is_system_admin()) THEN RAISE EXCEPTION 'customer_hub_forbidden'; END IF;
  IF jsonb_typeof(COALESCE(p_orders,'[]'::jsonb)) <> 'array' THEN RAISE EXCEPTION 'customer_hub_invalid_batch'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(COALESCE(p_orders,'[]'::jsonb)) LOOP
    processed := processed + 1;
    BEGIN
      PERFORM public.customer_hub_sync_order(
        p_shop_id, COALESCE(item->>'sourceType','import'), COALESCE(item->>'id',item->>'source_order_id',processed::text),
        item->>'phone', COALESCE(item->>'name',item->>'customer_name'), item->>'address',
        COALESCE(item->>'orderCode',item->>'order_code'), COALESCE(item->>'trackingCode',item->>'tracking_code'),
        COALESCE(item->>'carrier',item->>'platform'), COALESCE(item->>'status','pending'),
        COALESCE(NULLIF(regexp_replace(COALESCE(item->>'codAmount',item->>'cod_amount',item->>'cod','0'),'[^0-9.]','','g'),''),'0')::numeric,
        COALESCE(NULLIF(item->>'orderedAt','')::timestamptz,NULLIF(item->>'submitted_at','')::timestamptz,now())
      );
      succeeded := succeeded + 1;
    EXCEPTION WHEN OTHERS THEN
      failed := failed + 1;
      errors := errors || jsonb_build_array(jsonb_build_object('row',processed,'error',SQLERRM));
    END;
  END LOOP;
  RETURN jsonb_build_object('processed',processed,'succeeded',succeeded,'failed',failed,'errors',errors);
END;
$$;

CREATE OR REPLACE FUNCTION public.customer_hub_audit_export(p_shop_id UUID, p_details JSONB DEFAULT '{}'::jsonb)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT (public.is_shop_owner_or_manager(p_shop_id) OR public.is_system_admin()) THEN RAISE EXCEPTION 'customer_hub_forbidden'; END IF;
  INSERT INTO public.audit_logs(shop_id,user_id,action,entity_type,details)
  VALUES(p_shop_id,auth.uid(),'CUSTOMER_EXPORT','CUSTOMER_HUB',COALESCE(p_details,'{}'::jsonb));
END;
$$;

CREATE OR REPLACE FUNCTION public.customer_hub_sync_job_audit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.audit_logs(shop_id,user_id,action,entity_type,entity_id,details)
    VALUES(NEW.shop_id,COALESCE(NEW.created_by,auth.uid()),
      CASE WHEN TG_OP='INSERT' THEN 'CUSTOMER_SYNC_STARTED' ELSE 'CUSTOMER_SYNC_' || upper(NEW.status) END,
      'CUSTOMER_SYNC_JOB',NEW.id::text,
      jsonb_build_object('jobType',NEW.job_type,'processed',NEW.processed_rows,'success',NEW.success_rows,'errors',NEW.error_rows));
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_customer_hub_sync_job_audit ON public.customer_sync_jobs;
CREATE TRIGGER trg_customer_hub_sync_job_audit AFTER INSERT OR UPDATE OF status ON public.customer_sync_jobs
FOR EACH ROW EXECUTE FUNCTION public.customer_hub_sync_job_audit();

-- Trigger wrapper. Exceptions are swallowed so CRM can never block order persistence.
CREATE OR REPLACE FUNCTION public.customer_hub_order_trigger()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.customer_hub_sync_order(
    NEW.shop_id,
    CASE WHEN TG_TABLE_NAME='submitted_orders' THEN 'submitted_order' ELSE 'order' END,
    NEW.id::text,
    NEW.phone, NEW.name, NEW.address, NEW.order_code,
    CASE WHEN TG_TABLE_NAME='submitted_orders' THEN NEW.tracking_code ELSE NULL END,
    NEW.platform, NEW.status, NEW.cod_amount,
    COALESCE(NEW.submitted_at,NEW.updated_at,now())
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'customer_hub_sync_failed table=% id=% error=%', TG_TABLE_NAME, NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_customer_hub_orders ON public.orders;
CREATE TRIGGER trg_customer_hub_orders AFTER INSERT OR UPDATE OF phone,address,status,cod_amount ON public.orders
FOR EACH ROW WHEN (NEW.deleted_at IS NULL) EXECUTE FUNCTION public.customer_hub_order_trigger();
DROP TRIGGER IF EXISTS trg_customer_hub_submitted_orders ON public.submitted_orders;
CREATE TRIGGER trg_customer_hub_submitted_orders AFTER INSERT OR UPDATE OF phone,address,status,cod_amount,tracking_code ON public.submitted_orders
FOR EACH ROW WHEN (NEW.deleted_at IS NULL) EXECUTE FUNCTION public.customer_hub_order_trigger();

CREATE OR REPLACE FUNCTION public.customer_hub_set_blacklist(p_customer_id UUID, p_blacklisted BOOLEAN, p_reason TEXT DEFAULT NULL)
RETURNS public.customers LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_customer public.customers;
BEGIN
  SELECT * INTO v_customer FROM public.customers WHERE id=p_customer_id;
  IF v_customer.id IS NULL OR NOT public.is_shop_owner_or_manager(v_customer.shop_id) THEN RAISE EXCEPTION 'customer_hub_forbidden'; END IF;
  IF p_blacklisted AND length(btrim(COALESCE(p_reason,''))) < 3 THEN RAISE EXCEPTION 'blacklist_reason_required'; END IF;
  UPDATE public.customers SET is_blacklisted=p_blacklisted, blacklist_reason=CASE WHEN p_blacklisted THEN btrim(p_reason) ELSE NULL END, updated_at=now() WHERE id=p_customer_id RETURNING * INTO v_customer;
  INSERT INTO public.customer_risk_events(shop_id,customer_id,event_type,severity,reason,created_by)
  VALUES(v_customer.shop_id,p_customer_id,CASE WHEN p_blacklisted THEN 'blacklist_added' ELSE 'blacklist_removed' END,CASE WHEN p_blacklisted THEN 'critical' ELSE 'info' END,p_reason,auth.uid());
  INSERT INTO public.audit_logs(shop_id,user_id,action,entity_type,entity_id,details)
  VALUES(v_customer.shop_id,auth.uid(),CASE WHEN p_blacklisted THEN 'CUSTOMER_BLACKLIST' ELSE 'CUSTOMER_UNBLACKLIST' END,'CUSTOMER',p_customer_id::text,jsonb_build_object('reason',p_reason));
  PERFORM public.customer_hub_rebuild_metrics(p_customer_id);
  RETURN v_customer;
END;
$$;

CREATE OR REPLACE FUNCTION public.customer_hub_protect_sensitive_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF (OLD.is_blacklisted IS DISTINCT FROM NEW.is_blacklisted OR OLD.blacklist_reason IS DISTINCT FROM NEW.blacklist_reason)
     AND NOT public.is_shop_owner_or_manager(OLD.shop_id) THEN
    RAISE EXCEPTION 'customer_hub_forbidden';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_customer_hub_protect_sensitive ON public.customers;
CREATE TRIGGER trg_customer_hub_protect_sensitive BEFORE UPDATE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.customer_hub_protect_sensitive_update();

CREATE OR REPLACE FUNCTION public.customer_hub_list(p_shop_id UUID, p_limit INTEGER DEFAULT 1000)
RETURNS SETOF JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_full BOOLEAN;
BEGIN
  IF NOT public.is_shop_member(p_shop_id) THEN RAISE EXCEPTION 'customer_hub_forbidden'; END IF;
  v_full := public.is_shop_owner_or_manager(p_shop_id) OR public.is_system_admin();
  RETURN QUERY SELECT to_jsonb(c) || jsonb_build_object(
    'phone', CASE WHEN v_full THEN COALESCE(c.normalized_phone,c.phone) ELSE left(COALESCE(c.normalized_phone,c.phone),4) || '***' || right(COALESCE(c.normalized_phone,c.phone),3) END,
    'normalized_phone', CASE WHEN v_full THEN c.normalized_phone ELSE NULL END,
    'display_phone', CASE WHEN v_full THEN c.display_phone ELSE NULL END
  ) FROM public.customers c WHERE c.shop_id=p_shop_id ORDER BY c.last_order_at DESC NULLS LAST LIMIT LEAST(GREATEST(p_limit,1),5000);
END;
$$;

CREATE OR REPLACE FUNCTION public.customer_hub_lookup(p_shop_id UUID, p_phone TEXT)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_customer public.customers; v_phone TEXT; v_full BOOLEAN;
BEGIN
  IF NOT public.is_shop_member(p_shop_id) THEN RAISE EXCEPTION 'customer_hub_forbidden'; END IF;
  v_phone := public.customer_hub_normalize_phone(p_phone);
  SELECT * INTO v_customer FROM public.customers WHERE shop_id=p_shop_id AND normalized_phone=v_phone LIMIT 1;
  IF v_customer.id IS NULL THEN RETURN NULL; END IF;
  v_full := public.is_shop_owner_or_manager(p_shop_id) OR public.is_system_admin();
  RETURN to_jsonb(v_customer) || jsonb_build_object(
    'phone', CASE WHEN v_full THEN v_phone ELSE left(v_phone,4) || '***' || right(v_phone,3) END,
    'normalized_phone', CASE WHEN v_full THEN v_phone ELSE NULL END,
    'display_phone', CASE WHEN v_full THEN v_customer.display_phone ELSE NULL END
  );
END;
$$;

ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_order_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_tag_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_risk_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_sync_jobs ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['customer_addresses','customer_order_links','customer_notes','customer_tags','customer_tag_assignments','customer_risk_events','customer_sync_jobs'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS customer_hub_member_select ON public.%I',t);
    EXECUTE format('CREATE POLICY customer_hub_member_select ON public.%I FOR SELECT USING (public.is_shop_member(shop_id) OR public.is_system_admin())',t);
    EXECUTE format('DROP POLICY IF EXISTS customer_hub_member_write ON public.%I',t);
    EXECUTE format('CREATE POLICY customer_hub_member_write ON public.%I FOR ALL USING (public.is_shop_member(shop_id) OR public.is_system_admin()) WITH CHECK (public.is_shop_member(shop_id) OR public.is_system_admin())',t);
  END LOOP;
END $$;

GRANT SELECT,INSERT,UPDATE,DELETE ON public.customer_addresses,public.customer_order_links,public.customer_notes,public.customer_tags,public.customer_tag_assignments,public.customer_risk_events,public.customer_sync_jobs TO authenticated;
GRANT EXECUTE ON FUNCTION public.customer_hub_sync_order(UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,NUMERIC,TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.customer_hub_backfill_batch(UUID,JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.customer_hub_audit_export(UUID,JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.customer_hub_rebuild_metrics(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.customer_hub_set_blacklist(UUID,BOOLEAN,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.customer_hub_list(UUID,INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.customer_hub_lookup(UUID,TEXT) TO authenticated;

COMMIT;
