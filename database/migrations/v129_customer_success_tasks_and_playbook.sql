-- =========================================================================
-- Migration v129: Customer Success Tasks & Automated Playbooks (Epic C)
-- =========================================================================

-- 1. Customer Success Tasks Table
CREATE TABLE IF NOT EXISTS public.customer_success_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    playbook_code TEXT NOT NULL,
    segment TEXT NOT NULL DEFAULT 'HEALTHY',
    priority TEXT NOT NULL DEFAULT 'MEDIUM', -- 'LOW', 'MEDIUM', 'HIGH', 'URGENT'
    status TEXT NOT NULL DEFAULT 'NEW', -- 'NEW', 'IN_PROGRESS', 'WAITING_REPLY', 'COMPLETED', 'DISMISSED'
    assignee_id UUID REFERENCES auth.users(id),
    due_at TIMESTAMPTZ NOT NULL,
    reason TEXT NOT NULL,
    risk_score NUMERIC(5,2) DEFAULT 0,
    suggested_channel TEXT DEFAULT 'ZALO_OA',
    outcome TEXT,
    notes TEXT,
    idempotency_key TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partial Unique Index: Invariant guarantees at most ONE open task per shop & playbook
CREATE UNIQUE INDEX IF NOT EXISTS idx_cs_tasks_open_shop_playbook 
ON public.customer_success_tasks(shop_id, playbook_code) 
WHERE status IN ('NEW', 'IN_PROGRESS', 'WAITING_REPLY');

CREATE INDEX IF NOT EXISTS idx_cs_tasks_shop_status ON public.customer_success_tasks(shop_id, status);
CREATE INDEX IF NOT EXISTS idx_cs_tasks_due_at ON public.customer_success_tasks(due_at);

-- 2. RLS Tenant Isolation (Support Staff only see non-secret retention metadata)
ALTER TABLE public.customer_success_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cs_tasks_tenant_isolation" ON public.customer_success_tasks;
CREATE POLICY "cs_tasks_tenant_isolation" ON public.customer_success_tasks
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

-- 3. RPC Update CS Task Status (Explicit signature, no default overload ambiguity)
CREATE OR REPLACE FUNCTION public.update_cs_task_status(
    p_task_id UUID,
    p_shop_id UUID,
    p_status TEXT,
    p_outcome TEXT,
    p_notes TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_calling_user UUID;
    v_task RECORD;
BEGIN
    v_calling_user := auth.uid();

    IF v_calling_user IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Yêu cầu đăng nhập');
    END IF;

    -- Check support.manage permission
    IF NOT (public.has_shop_permission(p_shop_id, 'support.manage') OR public.is_system_admin(v_calling_user)) THEN
        RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'Không có quyền xử lý CSKH (support.manage)');
    END IF;

    SELECT * INTO v_task FROM public.customer_success_tasks
    WHERE id = p_task_id AND shop_id = p_shop_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND', 'message', 'Không tìm thấy công việc CSKH');
    END IF;

    UPDATE public.customer_success_tasks
    SET status = p_status,
        outcome = COALESCE(p_outcome, outcome),
        notes = COALESCE(p_notes, notes),
        updated_at = now()
    WHERE id = p_task_id AND shop_id = p_shop_id;

    RETURN jsonb_build_object(
        'success', true,
        'task_id', p_task_id,
        'status', p_status,
        'updated_at', now()
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_cs_task_status(UUID, UUID, TEXT, TEXT, TEXT) TO authenticated, service_role;
