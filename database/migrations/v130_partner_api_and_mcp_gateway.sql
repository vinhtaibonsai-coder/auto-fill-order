-- =========================================================================
-- Migration v130: Partner API & MCP Gateway with Scope, Quota & Audit (Epic G)
-- =========================================================================

-- 1. Partner API Clients Table (Only stores key_prefix and SHA-256 hash)
CREATE TABLE IF NOT EXISTS public.partner_api_clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    key_prefix TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    scopes TEXT[] NOT NULL DEFAULT ARRAY['orders:parse', 'address:normalize'],
    status TEXT NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'REVOKED', 'SUSPENDED'
    rate_limit_per_minute INTEGER NOT NULL DEFAULT 60,
    monthly_quota INTEGER NOT NULL DEFAULT 1000,
    monthly_usage INTEGER NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_api_clients_shop ON public.partner_api_clients(shop_id);
CREATE INDEX IF NOT EXISTS idx_partner_api_clients_key_hash ON public.partner_api_clients(key_hash);

-- 2. Partner API Usage Table (Aggregated Metrics only, ZERO raw text / PII)
CREATE TABLE IF NOT EXISTS public.partner_api_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES public.partner_api_clients(id) ON DELETE CASCADE,
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    request_id TEXT NOT NULL,
    tool_or_endpoint TEXT NOT NULL,
    status_code INTEGER NOT NULL,
    latency_ms INTEGER NOT NULL,
    units INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_api_usage_shop_date ON public.partner_api_usage(shop_id, created_at);
CREATE INDEX IF NOT EXISTS idx_partner_api_usage_client ON public.partner_api_usage(client_id);

-- 3. RLS Policies
ALTER TABLE public.partner_api_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_api_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "partner_api_clients_tenant_isolation" ON public.partner_api_clients;
CREATE POLICY "partner_api_clients_tenant_isolation" ON public.partner_api_clients
    FOR ALL
    USING (
        shop_id IN (
            SELECT sm.shop_id FROM public.shop_members sm
            WHERE sm.user_id = auth.uid()
        )
        OR public.is_system_admin(auth.uid())
    )
    WITH CHECK (
        shop_id IN (
            SELECT sm.shop_id FROM public.shop_members sm
            WHERE sm.user_id = auth.uid()
        )
        OR public.is_system_admin(auth.uid())
    );

DROP POLICY IF EXISTS "partner_api_usage_tenant_isolation" ON public.partner_api_usage;
CREATE POLICY "partner_api_usage_tenant_isolation" ON public.partner_api_usage
    FOR ALL
    USING (
        shop_id IN (
            SELECT sm.shop_id FROM public.shop_members sm
            WHERE sm.user_id = auth.uid()
        )
        OR public.is_system_admin(auth.uid())
    )
    WITH CHECK (
        shop_id IN (
            SELECT sm.shop_id FROM public.shop_members sm
            WHERE sm.user_id = auth.uid()
        )
        OR public.is_system_admin(auth.uid())
    );

-- 4. RPC Create Partner API Key (Requires api_keys.manage permission)
CREATE OR REPLACE FUNCTION public.create_partner_api_key(
    p_shop_id UUID,
    p_name TEXT,
    p_key_prefix TEXT,
    p_key_hash TEXT,
    p_scopes TEXT[],
    p_monthly_quota INTEGER,
    p_expires_at TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_calling_user UUID;
    v_new_id UUID;
BEGIN
    v_calling_user := auth.uid();

    IF v_calling_user IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Yêu cầu đăng nhập');
    END IF;

    -- Check api_keys.manage permission
    IF NOT (public.has_shop_permission(p_shop_id, 'api_keys.manage') OR public.is_system_admin(v_calling_user)) THEN
        RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'Không có quyền quản lý API key (api_keys.manage)');
    END IF;

    INSERT INTO public.partner_api_clients (
        shop_id,
        name,
        key_prefix,
        key_hash,
        scopes,
        monthly_quota,
        expires_at
    ) VALUES (
        p_shop_id,
        p_name,
        p_key_prefix,
        p_key_hash,
        COALESCE(p_scopes, ARRAY['orders:parse', 'address:normalize']),
        COALESCE(p_monthly_quota, 1000),
        p_expires_at
    )
    RETURNING id INTO v_new_id;

    RETURN jsonb_build_object(
        'success', true,
        'client_id', v_new_id,
        'prefix', p_key_prefix,
        'name', p_name
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_partner_api_key(UUID, TEXT, TEXT, TEXT, TEXT[], INTEGER, TIMESTAMPTZ) TO authenticated, service_role;

-- 5. RPC Revoke Partner API Key
CREATE OR REPLACE FUNCTION public.revoke_partner_api_key(
    p_client_id UUID,
    p_shop_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_calling_user UUID;
BEGIN
    v_calling_user := auth.uid();

    IF v_calling_user IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED');
    END IF;

    IF NOT (public.has_shop_permission(p_shop_id, 'api_keys.manage') OR public.is_system_admin(v_calling_user)) THEN
        RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN');
    END IF;

    UPDATE public.partner_api_clients
    SET status = 'REVOKED'
    WHERE id = p_client_id AND shop_id = p_shop_id;

    RETURN jsonb_build_object('success', true, 'client_id', p_client_id, 'status', 'REVOKED');
END;
$$;

GRANT EXECUTE ON FUNCTION public.revoke_partner_api_key(UUID, UUID) TO authenticated, service_role;
