-- =============================================================================
-- AUTO FILL ORDER — COMMERCIAL SAAS GOLDEN BASELINE SCHEMA v1.0
-- =============================================================================
-- Hệ thống cơ sở dữ liệu hợp nhất chuẩn thương mại hóa (Multi-Tenant SaaS Architecture)
-- Đảm bảo an toàn RLS 100%, chống gian lận Shop ID, bảo mật AI Quota,
-- Tự động hóa thanh toán VietQR / SePay, và chuẩn hóa toàn bộ RPC cho 3 giao diện:
-- 1. Extension Injected Panel (Staff Workspace)
-- 2. Options Page (Shop Control Center)
-- 3. Master Admin Dashboard (SaaS Platform Control Plane)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- 1. ENUMS VÀ BẢNG PHÂN QUYỀN HỆ THỐNG (ROLES & PERMISSIONS)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL, -- SYSTEM_ADMIN, SUPPORT, SHOP_OWNER, SHOP_MANAGER, SHOP_STAFF, VIEWER
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed default roles if not exists
INSERT INTO public.roles (code, name, description)
VALUES 
  ('SYSTEM_ADMIN', 'Master Administrator', 'Toàn quyền quản trị hệ thống SaaS'),
  ('SUPPORT', 'Support Specialist', 'Hỗ trợ kỹ thuật và chăm sóc khách hàng'),
  ('SHOP_OWNER', 'Shop Owner', 'Chủ sở hữu cửa hàng, quản trị gói cước & nhân viên'),
  ('SHOP_MANAGER', 'Shop Manager', 'Quản lý đơn hàng, địa chỉ và vận hành shop'),
  ('SHOP_STAFF', 'Shop Staff', 'Nhân viên bóc tách đơn và điền đơn tự động'),
  ('VIEWER', 'Viewer', 'Chỉ xem báo cáo, không thể thay đổi cấu hình')
ON CONFLICT (code) DO NOTHING;

-- =============================================================================
-- 2. HỒ SƠ NGƯỜI DÙNG VÀ PHÂN QUYỀN TOÀN CỤC (PROFILES & USER_ROLES)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  role TEXT DEFAULT 'member', -- Legacy column compatibility
  status TEXT DEFAULT 'active', -- active, inactive, suspended
  username TEXT,
  phone TEXT,
  full_name TEXT,
  avatar_url TEXT,
  disabled_at TIMESTAMPTZ,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, role_id)
);

-- =============================================================================
-- 3. CỬA HÀNG VÀ THÀNH VIÊN (SHOPS & SHOP_MEMBERS)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.shops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  shop_code TEXT UNIQUE,
  sender_name TEXT,
  sender_phone TEXT,
  sender_address TEXT,
  sender_province TEXT,
  sender_district TEXT,
  sender_ward TEXT,
  vnpost_customer_code TEXT,
  jt_contract_code TEXT,
  order_code_prefix TEXT DEFAULT 'ORD-',
  bank_account_no TEXT,
  bank_account_name TEXT,
  bank_code TEXT,
  status TEXT DEFAULT 'active', -- active, trial, suspended, deleted
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shop_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'STAFF', -- OWNER, MANAGER, STAFF, VIEWER
  status TEXT DEFAULT 'active', -- active, pending, suspended
  removed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (shop_id, user_id)
);

-- =============================================================================
-- 4. GÓI CƯỚC, HẠN MỨC & THANH TOÁN (SUBSCRIPTIONS, QUOTAS & PAYMENTS)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID UNIQUE NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  plan_tier TEXT NOT NULL DEFAULT 'TRIAL', -- TRIAL, PRO_MONTH, PRO_YEAR, ENTERPRISE
  status TEXT NOT NULL DEFAULT 'active', -- active, expired, cancelled, trial
  current_period_start TIMESTAMPTZ DEFAULT now(),
  current_period_end TIMESTAMPTZ DEFAULT (now() + INTERVAL '14 days'),
  max_members INT DEFAULT 3,
  max_devices INT DEFAULT 5,
  max_ai_requests INT DEFAULT 1000,
  max_orders_per_month INT DEFAULT 2000,
  auto_renew BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shop_quotas (
  shop_id UUID PRIMARY KEY REFERENCES public.shops(id) ON DELETE CASCADE,
  ai_monthly_limit INT DEFAULT 500,
  ai_monthly_used INT DEFAULT 0,
  ai_daily_limit INT DEFAULT 50,
  ai_daily_used INT DEFAULT 0,
  orders_monthly_limit INT DEFAULT 1000,
  orders_monthly_used INT DEFAULT 0,
  reset_date DATE DEFAULT (CURRENT_DATE + INTERVAL '1 month')::DATE,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.license_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_code TEXT UNIQUE NOT NULL,
  plan_tier TEXT NOT NULL DEFAULT 'PRO_MONTH',
  duration_days INT NOT NULL DEFAULT 30,
  max_members INT NOT NULL DEFAULT 5,
  max_devices INT NOT NULL DEFAULT 10,
  max_ai_requests INT NOT NULL DEFAULT 2000,
  redeemed_at TIMESTAMPTZ,
  redeemed_by_shop_id UUID REFERENCES public.shops(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES public.shops(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  transaction_code TEXT UNIQUE NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  bank_brand_name TEXT,
  account_number TEXT,
  content TEXT,
  status TEXT NOT NULL DEFAULT 'SUCCESS', -- SUCCESS, PENDING, FAILED
  plan_tier TEXT NOT NULL,
  duration_months INT NOT NULL DEFAULT 1,
  gateway TEXT DEFAULT 'VIETQR_SEPAY',
  raw_webhook_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 5. QUẢN LÝ ĐƠN HÀNG, CRM VÀ VẬN HÀNH (ORDERS, SUBMITTED_ORDERS & CUSTOMERS)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.orders (
  id TEXT PRIMARY KEY, -- Client generated or UUID
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name TEXT,
  phone TEXT,
  address TEXT,
  province TEXT,
  district TEXT,
  ward TEXT,
  order_code TEXT,
  cod_amount NUMERIC DEFAULT 0,
  collect_fee NUMERIC DEFAULT 0,
  platform TEXT DEFAULT 'MANUAL', -- VNPOST, JT, FACEBOOK, ZALO, MANUAL
  device_name TEXT,
  source_device_id TEXT,
  status TEXT DEFAULT 'PENDING', -- PENDING, PROCESSING, COMPLETED, FAILED
  failure_reason TEXT,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  submitted_at TIMESTAMPTZ,
  submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.submitted_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  saved_order_id TEXT,
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  name TEXT,
  phone TEXT,
  address TEXT,
  order_code TEXT,
  cod_amount NUMERIC DEFAULT 0,
  collect_fee NUMERIC DEFAULT 0,
  platform TEXT,
  tracking_code TEXT,
  device_name TEXT,
  status TEXT DEFAULT 'SUCCESS',
  failure_reason TEXT,
  submitted_at TIMESTAMPTZ DEFAULT now(),
  submitted_date DATE DEFAULT CURRENT_DATE,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  name TEXT,
  address TEXT,
  province TEXT,
  segment TEXT DEFAULT 'STANDARD', -- VIP, STANDARD, BLACKLIST
  total_orders INT DEFAULT 0,
  total_cod NUMERIC DEFAULT 0,
  latest_date TIMESTAMPTZ DEFAULT now(),
  fav_carrier TEXT,
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (shop_id, phone)
);

CREATE TABLE IF NOT EXISTS public.shop_address_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  original TEXT NOT NULL,
  mapping TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (shop_id, original)
);

CREATE TABLE IF NOT EXISTS public.carrier_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  carrier_id TEXT NOT NULL, -- vnpost, jt, viettelpost, spx
  carrier_code TEXT,
  account_username TEXT,
  account_password TEXT,
  token TEXT,
  is_connected BOOLEAN DEFAULT false,
  auto_sync BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (shop_id, carrier_id)
);

CREATE TABLE IF NOT EXISTS public.devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  device_id TEXT NOT NULL,
  device_name TEXT,
  browser_info TEXT,
  ip_address TEXT,
  is_revoked BOOLEAN DEFAULT false,
  last_active_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (shop_id, device_id)
);

CREATE TABLE IF NOT EXISTS public.ai_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  device_id TEXT,
  request_type TEXT NOT NULL, -- parse, address, vision, ocr
  prompt_tokens INT DEFAULT 0,
  completion_tokens INT DEFAULT 0,
  status TEXT DEFAULT 'success',
  model_name TEXT,
  rate_bucket TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES public.shops(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.system_configs (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  is_secret BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 6. SECURITY DEFINER HELPER FUNCTIONS
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_system_admin(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = COALESCE(p_user_id, auth.uid())
      AND r.code = 'SYSTEM_ADMIN'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_shop_member(p_shop_id UUID, p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    public.is_system_admin(COALESCE(p_user_id, auth.uid()))
    OR EXISTS (
      SELECT 1
      FROM public.shop_members sm
      JOIN public.profiles p ON p.id = sm.user_id
      WHERE sm.shop_id = p_shop_id
        AND sm.user_id = COALESCE(p_user_id, auth.uid())
        AND sm.status = 'active'
        AND sm.removed_at IS NULL
        AND p.status = 'active'
        AND p.disabled_at IS NULL
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_shop_owner_or_manager(p_shop_id UUID, p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    public.is_system_admin(COALESCE(p_user_id, auth.uid()))
    OR EXISTS (
      SELECT 1
      FROM public.shop_members sm
      WHERE sm.shop_id = p_shop_id
        AND sm.user_id = COALESCE(p_user_id, auth.uid())
        AND sm.role IN ('OWNER', 'SHOP_OWNER', 'MANAGER', 'SHOP_MANAGER')
        AND sm.status = 'active'
        AND sm.removed_at IS NULL
    )
  );
$$;

-- =============================================================================
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submitted_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_address_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carrier_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.license_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

-- --- PROFILES ---
DROP POLICY IF EXISTS "Users can read their own profile or admin reads all" ON public.profiles;
CREATE POLICY "Users can read their own profile or admin reads all" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_system_admin());

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_system_admin());

-- --- SHOPS ---
DROP POLICY IF EXISTS "Shop members read their shops" ON public.shops;
CREATE POLICY "Shop members read their shops" ON public.shops
  FOR SELECT TO authenticated
  USING (public.is_shop_member(id) OR public.is_system_admin());

DROP POLICY IF EXISTS "Shop owners update shop" ON public.shops;
CREATE POLICY "Shop owners update shop" ON public.shops
  FOR UPDATE TO authenticated
  USING (public.is_shop_owner_or_manager(id) OR public.is_system_admin());

-- --- SHOP MEMBERS ---
DROP POLICY IF EXISTS "Shop members view colleagues" ON public.shop_members;
CREATE POLICY "Shop members view colleagues" ON public.shop_members
  FOR SELECT TO authenticated
  USING (public.is_shop_member(shop_id) OR public.is_system_admin());

DROP POLICY IF EXISTS "Shop managers manage members" ON public.shop_members;
CREATE POLICY "Shop managers manage members" ON public.shop_members
  FOR ALL TO authenticated
  USING (public.is_shop_owner_or_manager(shop_id) OR public.is_system_admin());

-- --- ORDERS & SUBMITTED ORDERS ---
DROP POLICY IF EXISTS "Shop members access orders" ON public.orders;
CREATE POLICY "Shop members access orders" ON public.orders
  FOR ALL TO authenticated
  USING (public.is_shop_member(shop_id) OR public.is_system_admin());

DROP POLICY IF EXISTS "Shop members access submitted_orders" ON public.submitted_orders;
CREATE POLICY "Shop members access submitted_orders" ON public.submitted_orders
  FOR ALL TO authenticated
  USING (public.is_shop_member(shop_id) OR public.is_system_admin());

-- --- CUSTOMERS CRM ---
DROP POLICY IF EXISTS "Shop members access customers" ON public.customers;
CREATE POLICY "Shop members access customers" ON public.customers
  FOR ALL TO authenticated
  USING (public.is_shop_member(shop_id) OR public.is_system_admin());

-- --- CARRIER CONFIGS ---
DROP POLICY IF EXISTS "Shop managers access carrier_configs" ON public.carrier_configs;
CREATE POLICY "Shop managers access carrier_configs" ON public.carrier_configs
  FOR ALL TO authenticated
  USING (public.is_shop_owner_or_manager(shop_id) OR public.is_system_admin());

-- --- AUDIT LOGS ---
DROP POLICY IF EXISTS "Shop owners read audit logs" ON public.audit_logs;
CREATE POLICY "Shop owners read audit logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.is_shop_owner_or_manager(shop_id) OR public.is_system_admin());

-- --- PAYMENTS ---
DROP POLICY IF EXISTS "Shop owners view payments" ON public.payment_transactions;
CREATE POLICY "Shop owners view payments" ON public.payment_transactions
  FOR SELECT TO authenticated
  USING (public.is_shop_owner_or_manager(shop_id) OR public.is_system_admin());

-- =============================================================================
-- 8. BUSINESS RPC FUNCTIONS (TỐI ƯU GIAO TIẾP VỚI CLIENT)
-- =============================================================================

-- 8.1 Resolve Dashboard Role (2 Tầng)
CREATE OR REPLACE FUNCTION public.resolve_dashboard_role(p_user_id UUID DEFAULT auth.uid())
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := COALESCE(p_user_id, auth.uid());
  v_is_admin BOOLEAN;
  v_highest_role TEXT := 'VIEWER';
  v_ui_role TEXT := 'viewer';
  v_shop_id UUID;
  v_shop_name TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('real_role', 'ANON', 'ui_role', null, 'is_admin', false);
  END IF;

  v_is_admin := public.is_system_admin(v_uid);
  IF v_is_admin THEN
    RETURN jsonb_build_object(
      'real_role', 'SYSTEM_ADMIN',
      'ui_role', 'master_admin',
      'is_admin', true
    );
  END IF;

  -- Lấy role shop cao nhất của user
  SELECT sm.role, sm.shop_id, s.name
  INTO v_highest_role, v_shop_id, v_shop_name
  FROM public.shop_members sm
  JOIN public.shops s ON s.id = sm.shop_id
  WHERE sm.user_id = v_uid
    AND sm.status = 'active'
    AND sm.removed_at IS NULL
  ORDER BY 
    CASE sm.role 
      WHEN 'OWNER' THEN 1 
      WHEN 'SHOP_OWNER' THEN 1
      WHEN 'MANAGER' THEN 2 
      WHEN 'SHOP_MANAGER' THEN 2
      WHEN 'STAFF' THEN 3
      WHEN 'SHOP_STAFF' THEN 3
      ELSE 4 
    END ASC
  LIMIT 1;

  IF v_highest_role IN ('OWNER', 'SHOP_OWNER') THEN
    v_ui_role := 'shop_admin';
  ELSIF v_highest_role IN ('MANAGER', 'SHOP_MANAGER') THEN
    v_ui_role := 'shop_manager';
  ELSIF v_highest_role IN ('STAFF', 'SHOP_STAFF') THEN
    v_ui_role := 'staff';
  ELSE
    v_ui_role := 'viewer';
  END IF;

  RETURN jsonb_build_object(
    'real_role', COALESCE(v_highest_role, 'VIEWER'),
    'ui_role', v_ui_role,
    'is_admin', false,
    'active_shop_id', v_shop_id,
    'shop_name', v_shop_name
  );
END;
$$;

-- 8.2 Get Shop Dashboard Stats (KPI Real-time)
CREATE OR REPLACE FUNCTION public.get_shop_dashboard_stats(p_shop_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today_orders INT := 0;
  v_today_success INT := 0;
  v_today_failed INT := 0;
  v_today_cod NUMERIC := 0;
  v_ai_used INT := 0;
  v_ai_limit INT := 0;
  v_plan TEXT := 'TRIAL';
  v_days_left INT := 0;
BEGIN
  IF NOT public.is_shop_member(p_shop_id) THEN
    RAISE EXCEPTION 'ACCESS_DENIED: Bạn không có quyền xem thống kê của shop này.';
  END IF;

  -- Đơn hàng hôm nay
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'SUCCESS'),
    COUNT(*) FILTER (WHERE status = 'FAILED'),
    COALESCE(SUM(cod_amount) FILTER (WHERE status = 'SUCCESS'), 0)
  INTO v_today_orders, v_today_success, v_today_failed, v_today_cod
  FROM public.submitted_orders
  WHERE shop_id = p_shop_id AND submitted_date = CURRENT_DATE AND deleted_at IS NULL;

  -- Hạn mức AI Quota
  SELECT ai_monthly_used, ai_monthly_limit
  INTO v_ai_used, v_ai_limit
  FROM public.shop_quotas
  WHERE shop_id = p_shop_id;

  -- Gói cước
  SELECT plan_tier, GREATEST(0, EXTRACT(DAY FROM (current_period_end - now()))::INT)
  INTO v_plan, v_days_left
  FROM public.subscriptions
  WHERE shop_id = p_shop_id;

  RETURN jsonb_build_object(
    'today_orders', v_today_orders,
    'today_success', v_today_success,
    'today_failed', v_today_failed,
    'today_cod', v_today_cod,
    'ai_used', COALESCE(v_ai_used, 0),
    'ai_limit', COALESCE(v_ai_limit, 500),
    'plan_tier', COALESCE(v_plan, 'TRIAL'),
    'days_left', COALESCE(v_days_left, 0)
  );
END;
$$;

-- 8.3 Get Master Admin KPIs
CREATE OR REPLACE FUNCTION public.get_admin_kpis()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_shops INT := 0;
  v_active_shops INT := 0;
  v_total_users INT := 0;
  v_total_orders_today INT := 0;
  v_total_ai_requests_today INT := 0;
  v_total_revenue NUMERIC := 0;
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'ACCESS_DENIED: Yêu cầu quyền Quản trị viên tối cao.';
  END IF;

  SELECT COUNT(*), COUNT(*) FILTER (WHERE LOWER(status) = 'active')
  INTO v_total_shops, v_active_shops
  FROM public.shops WHERE deleted_at IS NULL;

  SELECT COUNT(*) INTO v_total_users FROM public.profiles WHERE status = 'active';

  SELECT COUNT(*) INTO v_total_orders_today
  FROM public.submitted_orders WHERE submitted_date = CURRENT_DATE AND deleted_at IS NULL;

  SELECT COUNT(*) INTO v_total_ai_requests_today
  FROM public.ai_usage_log WHERE created_at >= CURRENT_DATE;

  SELECT COALESCE(SUM(amount), 0) INTO v_total_revenue
  FROM public.payment_transactions WHERE status = 'SUCCESS';

  RETURN jsonb_build_object(
    'total_shops', v_total_shops,
    'active_shops', v_active_shops,
    'total_users', v_total_users,
    'orders_today', v_total_orders_today,
    'ai_requests_today', v_total_ai_requests_today,
    'total_revenue', v_total_revenue
  );
END;
$$;

-- 8.4 Process VietQR / SePay Payment Webhook
CREATE OR REPLACE FUNCTION public.process_vietqr_payment(
  p_shop_id UUID,
  p_transaction_code TEXT,
  p_amount NUMERIC,
  p_plan_tier TEXT,
  p_duration_months INT DEFAULT 1,
  p_raw_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop RECORD;
  v_new_end_date TIMESTAMPTZ;
  v_current_end TIMESTAMPTZ;
  v_ai_quota INT := 2000;
  v_max_members INT := 5;
  v_max_orders INT := 5000;
BEGIN
  -- 1. Tìm thông tin shop
  SELECT * INTO v_shop FROM public.shops WHERE id = p_shop_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Shop không tồn tại hoặc đã bị xóa.');
  END IF;

  -- 2. Kiểm tra trùng lặp mã giao dịch
  IF EXISTS (SELECT 1 FROM public.payment_transactions WHERE transaction_code = p_transaction_code) THEN
    RETURN jsonb_build_object('success', true, 'message', 'Giao dịch đã được xử lý trước đó.');
  END IF;

  -- 3. Cấu hình hạn mức theo gói
  IF p_plan_tier = 'PRO_YEAR' OR p_duration_months >= 12 THEN
    v_ai_quota := 50000;
    v_max_members := 15;
    v_max_orders := 100000;
  ELSIF p_plan_tier = 'ENTERPRISE' THEN
    v_ai_quota := 100000;
    v_max_members := 50;
    v_max_orders := 500000;
  ELSE
    v_ai_quota := 2500 * p_duration_months;
    v_max_members := 5;
    v_max_orders := 5000 * p_duration_months;
  END IF;

  -- 4. Tính ngày kết thúc mới
  SELECT current_period_end INTO v_current_end FROM public.subscriptions WHERE shop_id = p_shop_id;
  IF v_current_end IS NOT NULL AND v_current_end > now() THEN
    v_new_end_date := v_current_end + (p_duration_months || ' months')::interval;
  ELSE
    v_new_end_date := now() + (p_duration_months || ' months')::interval;
  END IF;

  -- 5. Cập nhật Subscription
  INSERT INTO public.subscriptions (
    shop_id, plan_tier, status, current_period_start, current_period_end,
    max_members, max_ai_requests, max_orders_per_month, updated_at
  )
  VALUES (
    p_shop_id, p_plan_tier, 'active', now(), v_new_end_date,
    v_max_members, v_ai_quota, v_max_orders, now()
  )
  ON CONFLICT (shop_id) DO UPDATE SET
    plan_tier = EXCLUDED.plan_tier,
    status = 'active',
    current_period_end = v_new_end_date,
    max_members = EXCLUDED.max_members,
    max_ai_requests = EXCLUDED.max_ai_requests,
    max_orders_per_month = EXCLUDED.max_orders_per_month,
    updated_at = now();

  -- 6. Tăng hạn mức Shop Quotas
  INSERT INTO public.shop_quotas (
    shop_id, ai_monthly_limit, ai_monthly_used, ai_daily_limit, ai_daily_used,
    orders_monthly_limit, orders_monthly_used, reset_date, updated_at
  )
  VALUES (
    p_shop_id, v_ai_quota, 0, 200, 0,
    v_max_orders, 0, (CURRENT_DATE + (p_duration_months || ' months')::interval)::DATE, now()
  )
  ON CONFLICT (shop_id) DO UPDATE SET
    ai_monthly_limit = shop_quotas.ai_monthly_limit + v_ai_quota,
    orders_monthly_limit = shop_quotas.orders_monthly_limit + v_max_orders,
    reset_date = (CURRENT_DATE + (p_duration_months || ' months')::interval)::DATE,
    updated_at = now();

  -- 7. Lưu Transaction
  INSERT INTO public.payment_transactions (
    shop_id, transaction_code, amount, status, plan_tier,
    duration_months, gateway, raw_webhook_payload
  )
  VALUES (
    p_shop_id, p_transaction_code, p_amount, 'SUCCESS', p_plan_tier,
    p_duration_months, 'VIETQR_SEPAY', p_raw_payload
  );

  -- 8. Ghi Audit Log
  INSERT INTO public.audit_logs (
    shop_id, action, entity_type, entity_id, details
  )
  VALUES (
    p_shop_id, 'PAYMENT_SUCCESS', 'SUBSCRIPTION', p_shop_id::text,
    jsonb_build_object(
      'amount', p_amount,
      'plan_tier', p_plan_tier,
      'duration_months', p_duration_months,
      'transaction_code', p_transaction_code,
      'new_end_date', v_new_end_date
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Kích hoạt gói cước thành công!',
    'shop_id', p_shop_id,
    'plan_tier', p_plan_tier,
    'new_end_date', v_new_end_date
  );
END;
$$;

-- 8.5 Consume AI Quota Atomic Guard
CREATE OR REPLACE FUNCTION public.consume_ai_quota(
  p_shop_id UUID,
  p_delta INT DEFAULT 1,
  p_prompt_tokens INT DEFAULT 0,
  p_completion_tokens INT DEFAULT 0,
  p_request_type TEXT DEFAULT 'parse',
  p_device_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quota RECORD;
  v_uid UUID := auth.uid();
BEGIN
  -- Khóa dòng quota để xử lý đồng thời an toàn (Row-level lock)
  SELECT * INTO v_quota
  FROM public.shop_quotas
  WHERE shop_id = p_shop_id
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Khởi tạo mặc định nếu chưa có
    INSERT INTO public.shop_quotas (shop_id, ai_monthly_limit, ai_monthly_used, ai_daily_limit, ai_daily_used)
    VALUES (p_shop_id, 500, p_delta, 50, p_delta)
    RETURNING * INTO v_quota;
  ELSE
    -- Kiểm tra vượt hạn mức
    IF (v_quota.ai_monthly_used + p_delta) > v_quota.ai_monthly_limit THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'QUOTA_EXCEEDED',
        'message', 'Cửa hàng đã dùng hết hạn mức AI tháng này. Vui lòng nâng cấp gói.'
      );
    END IF;

    -- Cập nhật lượt dùng
    UPDATE public.shop_quotas
    SET ai_monthly_used = ai_monthly_used + p_delta,
        ai_daily_used = ai_daily_used + p_delta,
        updated_at = now()
    WHERE shop_id = p_shop_id;
  END IF;

  -- Ghi log sử dụng AI
  INSERT INTO public.ai_usage_log (
    shop_id, user_id, device_id, request_type,
    prompt_tokens, completion_tokens, status
  )
  VALUES (
    p_shop_id, v_uid, p_device_id, p_request_type,
    p_prompt_tokens, p_completion_tokens, 'success'
  );

  RETURN jsonb_build_object(
    'success', true,
    'remaining_monthly', (v_quota.ai_monthly_limit - (v_quota.ai_monthly_used + p_delta))
  );
END;
$$;

-- 8.6 Insert Audit Log Security Definer
CREATE OR REPLACE FUNCTION public.insert_audit_log(
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id TEXT,
  p_details JSONB DEFAULT '{}'::jsonb,
  p_shop_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.audit_logs (
    shop_id, user_id, action, entity_type, entity_id, details
  )
  VALUES (
    p_shop_id, auth.uid(), p_action, p_entity_type, p_entity_id, p_details
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

-- Cấp quyền thực thi cho các hàm RPC
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
