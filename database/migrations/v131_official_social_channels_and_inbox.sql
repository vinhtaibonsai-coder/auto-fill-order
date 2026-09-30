-- =========================================================================
-- Migration v131: Official Social Channels & Unified Inbox (Epic D)
-- =========================================================================

-- 1. Channel Connections Table (Server-side Secret Reference, never plain credentials)
CREATE TABLE IF NOT EXISTS public.channel_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    provider TEXT NOT NULL, -- 'META_MESSENGER', 'ZALO_OA'
    external_account_id TEXT NOT NULL,
    account_name TEXT,
    status TEXT NOT NULL DEFAULT 'NEEDS_APPROVAL', -- 'ACTIVE', 'NEEDS_APPROVAL', 'DISCONNECTED', 'SUSPENDED'
    scopes TEXT[] NOT NULL DEFAULT '{}',
    encrypted_secret_ref TEXT, -- KMS reference only
    connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_channel_connections_shop_provider UNIQUE (shop_id, provider, external_account_id)
);

CREATE INDEX IF NOT EXISTS idx_channel_connections_shop ON public.channel_connections(shop_id);

-- 2. Channel Conversations Table
CREATE TABLE IF NOT EXISTS public.channel_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    connection_id UUID REFERENCES public.channel_connections(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    external_conversation_id TEXT NOT NULL,
    customer_name TEXT,
    customer_ref TEXT,
    last_message_preview TEXT,
    last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_channel_conversations_shop_external UNIQUE (shop_id, provider, external_conversation_id)
);

CREATE INDEX IF NOT EXISTS idx_channel_conversations_shop_last ON public.channel_conversations(shop_id, last_message_at DESC);

-- 3. Channel Messages Table (Idempotent by external_message_id)
CREATE TABLE IF NOT EXISTS public.channel_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.channel_conversations(id) ON DELETE CASCADE,
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    external_message_id TEXT NOT NULL UNIQUE,
    direction TEXT NOT NULL DEFAULT 'INBOUND', -- 'INBOUND', 'OUTBOUND'
    text_redacted TEXT NOT NULL,
    attachment_refs JSONB DEFAULT '[]'::jsonb,
    is_draft_created BOOLEAN DEFAULT false,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_channel_messages_conv_received ON public.channel_messages(conversation_id, received_at DESC);

-- 4. RLS Security Policies
ALTER TABLE public.channel_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "channel_connections_tenant_isolation" ON public.channel_connections;
CREATE POLICY "channel_connections_tenant_isolation" ON public.channel_connections
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

DROP POLICY IF EXISTS "channel_conversations_tenant_isolation" ON public.channel_conversations;
CREATE POLICY "channel_conversations_tenant_isolation" ON public.channel_conversations
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

DROP POLICY IF EXISTS "channel_messages_tenant_isolation" ON public.channel_messages;
CREATE POLICY "channel_messages_tenant_isolation" ON public.channel_messages
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

-- 5. RPC Ingest Social Message Idempotent
CREATE OR REPLACE FUNCTION public.ingest_social_message_idempotent(
    p_shop_id UUID,
    p_provider TEXT,
    p_external_conv_id TEXT,
    p_external_msg_id TEXT,
    p_customer_name TEXT,
    p_customer_ref TEXT,
    p_text TEXT,
    p_direction TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_conv_id UUID;
    v_msg_id UUID;
    v_existing_msg RECORD;
BEGIN
    -- Idempotency check on external_message_id
    SELECT * INTO v_existing_msg FROM public.channel_messages 
    WHERE external_message_id = p_external_msg_id;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'success', true,
            'duplicate', true,
            'message_id', v_existing_msg.id,
            'conversation_id', v_existing_msg.conversation_id
        );
    END IF;

    -- Upsert Conversation
    INSERT INTO public.channel_conversations (
        shop_id,
        provider,
        external_conversation_id,
        customer_name,
        customer_ref,
        last_message_preview,
        last_message_at
    ) VALUES (
        p_shop_id,
        p_provider,
        p_external_conv_id,
        p_customer_name,
        p_customer_ref,
        SUBSTRING(p_text FROM 1 FOR 100),
        now()
    )
    ON CONFLICT (shop_id, provider, external_conversation_id)
    DO UPDATE SET
        customer_name = COALESCE(EXCLUDED.customer_name, public.channel_conversations.customer_name),
        last_message_preview = EXCLUDED.last_message_preview,
        last_message_at = now()
    RETURNING id INTO v_conv_id;

    -- Insert Message
    INSERT INTO public.channel_messages (
        conversation_id,
        shop_id,
        external_message_id,
        direction,
        text_redacted,
        received_at
    ) VALUES (
        v_conv_id,
        p_shop_id,
        p_external_msg_id,
        COALESCE(p_direction, 'INBOUND'),
        p_text,
        now()
    )
    RETURNING id INTO v_msg_id;

    RETURN jsonb_build_object(
        'success', true,
        'duplicate', false,
        'message_id', v_msg_id,
        'conversation_id', v_conv_id
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.ingest_social_message_idempotent(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;
