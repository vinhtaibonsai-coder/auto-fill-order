-- =========================================================================
-- v24_commercial_master_plan.sql
-- ADDITIVE MIGRATION for Commercial SaaS Master Plan
-- =========================================================================

-- 1. Subscriptions & Billing
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  plan_code TEXT NOT NULL DEFAULT 'FREE', -- FREE, STARTER, PRO, BUSINESS, ENTERPRISE
  status TEXT NOT NULL DEFAULT 'active', -- active, past_due, canceled, trialing
  current_period_start TIMESTAMPTZ DEFAULT now(),
  current_period_end TIMESTAMPTZ DEFAULT (now() + interval '30 days'),
  max_users INT DEFAULT 1,
  max_devices INT DEFAULT 1,
  max_ai_requests INT DEFAULT 100,
  price_monthly NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Feature Flags
CREATE TABLE IF NOT EXISTS public.feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  description TEXT,
  is_enabled BOOLEAN DEFAULT false,
  rollout_percentage INT DEFAULT 100, -- 0..100
  target_plans JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Device Management
CREATE TABLE IF NOT EXISTS public.shop_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  device_name TEXT NOT NULL,
  browser_info TEXT,
  ip_address TEXT,
  last_active_at TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'active', -- active, revoked
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Carrier Health Logs
CREATE TABLE IF NOT EXISTS public.carrier_health_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carrier_code TEXT NOT NULL, -- VNPOST, JT, GHN, GHTK, VIETTEL
  status TEXT NOT NULL, -- healthy, degraded, dom_changed, offline
  response_time_ms INT DEFAULT 0,
  error_message TEXT,
  detected_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Address Dataset Versions
CREATE TABLE IF NOT EXISTS public.address_dataset_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT UNIQUE NOT NULL,
  description TEXT,
  total_records INT DEFAULT 0,
  is_active BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Support Tickets
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  category TEXT DEFAULT 'general', -- login, ai, address, carrier, billing, bug
  priority TEXT DEFAULT 'normal', -- low, normal, high, urgent
  status TEXT DEFAULT 'open', -- open, in_progress, resolved, closed
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Extension Release Versions
CREATE TABLE IF NOT EXISTS public.release_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT UNIQUE NOT NULL,
  min_supported_version TEXT,
  is_force_update BOOLEAN DEFAULT false,
  rollout_percentage INT DEFAULT 100,
  release_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Enablement
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carrier_health_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.address_dataset_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.release_versions ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read feature flags & active dataset
DROP POLICY IF EXISTS "read_feature_flags" ON public.feature_flags;
CREATE POLICY "read_feature_flags" ON public.feature_flags FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "read_release_versions" ON public.release_versions;
CREATE POLICY "read_release_versions" ON public.release_versions FOR SELECT USING (auth.role() = 'authenticated');
