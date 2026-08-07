-- =========================================================================
-- AUTO FILL ORDER: SAAS CORE SCHEMA (MIGRATION 03)
-- This file defines the core architecture v2 tables for the SaaS Platform.
-- =========================================================================

-- 1. EXTEND SHOPS TABLE
-- (We assume public.shops exists, if not, we create/alter it)
CREATE TABLE IF NOT EXISTS public.shops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    name TEXT NOT NULL,
    shop_code TEXT UNIQUE NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    -- AI & Gateway Settings
    ai_quota_monthly INT DEFAULT 500,
    ai_quota_used INT DEFAULT 0,
    -- Order Defaults (JSONB for flexibility)
    order_defaults JSONB DEFAULT '{"defaultCarrier": "vnpost", "defaultWeight": 500, "defaultCOD": 0, "autoParse": true, "autoNormalize": true, "autoSubmit": false}'::jsonb
);

-- Note: Groq API Key is NOT stored here to prevent exposure. 
-- It should be managed via Edge Functions environment variables or a separate secure vault table accessible only by Service Role.

-- 2. DEVICES TABLE (Device Management & Security)
CREATE TABLE IF NOT EXISTS public.devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    device_fingerprint TEXT NOT NULL,
    browser_info TEXT,
    location_ip TEXT,
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REVOKED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. AUDIT LOGS TABLE (Activity Tracking)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL, -- e.g., 'CREATE_ORDER', 'UPDATE_SETTINGS', 'REVOKE_DEVICE'
    entity_type TEXT NOT NULL, -- e.g., 'ORDER', 'SHOP', 'DEVICE'
    entity_id TEXT,
    details JSONB, -- Additional payload
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. SUBSCRIPTIONS TABLE (Billing & Plans)
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE UNIQUE,
    plan_code TEXT DEFAULT 'BASIC' CHECK (plan_code IN ('BASIC', 'PRO', 'ENTERPRISE')),
    status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'EXPIRED', 'CANCELLED')),
    billing_cycle TEXT DEFAULT 'MONTHLY',
    current_period_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    current_period_end TIMESTAMP WITH TIME ZONE,
    max_users INT DEFAULT 3,
    max_devices INT DEFAULT 5,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. CARRIER CONFIGS TABLE
-- Keeps carrier login state separate from main shop table. Password should be stored locally, only connect status here.
CREATE TABLE IF NOT EXISTS public.carrier_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
    carrier_id TEXT NOT NULL, -- 'vnpost', 'jt'
    is_connected BOOLEAN DEFAULT false,
    account_username TEXT,
    last_synced TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(shop_id, carrier_id)
);

-- 6. SYNC OUTBOX (Offline support queue)
CREATE TABLE IF NOT EXISTS public.sync_outbox (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    operation TEXT NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
    table_name TEXT NOT NULL,
    payload JSONB NOT NULL,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSED', 'FAILED')),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
