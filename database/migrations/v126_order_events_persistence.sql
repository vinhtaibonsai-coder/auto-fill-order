-- =========================================================================
-- Migration v126: Order Events Schema Expansion & Atomic Append RPC
-- (Wave 1 Task B02)
-- =========================================================================

-- 1. Bổ sung các cột Taxonomy vào bảng order_events
ALTER TABLE public.order_events ADD COLUMN IF NOT EXISTS order_code TEXT;
ALTER TABLE public.order_events ADD COLUMN IF NOT EXISTS event_type TEXT;
ALTER TABLE public.order_events ADD COLUMN IF NOT EXISTS actor_type TEXT DEFAULT 'SYSTEM';
ALTER TABLE public.order_events ADD COLUMN IF NOT EXISTS actor_id UUID;
ALTER TABLE public.order_events ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'extension';
ALTER TABLE public.order_events ADD COLUMN IF NOT EXISTS before_patch JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.order_events ADD COLUMN IF NOT EXISTS after_patch JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.order_events ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Chỉ mục hỗ trợ truy vấn dòng thời gian (Timeline) theo đơn và theo shop
CREATE INDEX IF NOT EXISTS idx_order_events_shop_code ON public.order_events(shop_id, order_code);
CREATE INDEX IF NOT EXISTS idx_order_events_timeline ON public.order_events(shop_id, event_type, created_at DESC);

-- 2. RPC APPEND_ORDER_EVENT: Ghi sự kiện đơn hàng có kiểm soát quyền hạn (RBAC)
-- Bắt buộc định danh đơn: order_id hoặc order_code (Tuân thủ Repeat Customer Invariant)
-- Kiểm tra quyền: has_shop_permission(p_shop_id, 'orders.edit') hoặc SYSTEM_ADMIN
CREATE OR REPLACE FUNCTION public.append_order_event(
    p_shop_id UUID,
    p_order_id TEXT,
    p_order_code TEXT,
    p_event_type TEXT,
    p_actor_type TEXT,
    p_source TEXT,
    p_before_patch JSONB,
    p_after_patch JSONB,
    p_metadata JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_is_authorized BOOLEAN := FALSE;
    v_inserted_id BIGINT;
    v_created_at TIMESTAMPTZ := now();
BEGIN
    -- 1. Kiểm tra tham số đầu vào bắt buộc
    IF p_shop_id IS NULL THEN
        RAISE EXCEPTION 'SHOP_ID_REQUIRED: shop_id không được để trống.';
    END IF;

    IF (p_order_id IS NULL OR trim(p_order_id) = '') AND (p_order_code IS NULL OR trim(p_order_code) = '') THEN
        RAISE EXCEPTION 'ORDER_IDENTITY_REQUIRED: order_id hoặc order_code phải có giá trị.';
    END IF;

    IF p_event_type IS NULL OR trim(p_event_type) = '' THEN
        RAISE EXCEPTION 'EVENT_TYPE_REQUIRED: event_type không được để trống.';
    END IF;

    -- 2. Kiểm tra phân quyền truy cập
    IF auth.role() = 'service_role' OR public.is_system_admin(v_user_id) THEN
        v_is_authorized := TRUE;
    ELSE
        -- Kiểm tra quyền chỉnh sửa đơn hàng qua Action RBAC Helper
        v_is_authorized := public.has_shop_permission_for_user(p_shop_id, 'orders.edit', v_user_id)
                           OR public.has_shop_permission_for_user(p_shop_id, 'orders.view', v_user_id);
    END IF;

    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'ACCESS_DENIED: Bạn không có quyền ghi sự kiện cho đơn hàng của cửa hàng này.';
    END IF;

    -- 3. Ghi vào bảng append-only order_events
    INSERT INTO public.order_events (
        shop_id,
        order_id,
        order_code,
        event,
        event_type,
        actor_type,
        actor_id,
        source,
        before_patch,
        after_patch,
        metadata,
        created_at
    ) VALUES (
        p_shop_id,
        COALESCE(p_order_id, p_order_code),
        p_order_code,
        p_event_type,
        p_event_type,
        COALESCE(p_actor_type, 'SYSTEM'),
        v_user_id,
        COALESCE(p_source, 'extension'),
        COALESCE(p_before_patch, '{}'::jsonb),
        COALESCE(p_after_patch, '{}'::jsonb),
        COALESCE(p_metadata, '{}'::jsonb),
        v_created_at
    )
    RETURNING id INTO v_inserted_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'event_id', v_inserted_id,
        'shop_id', p_shop_id,
        'order_id', COALESCE(p_order_id, p_order_code),
        'order_code', p_order_code,
        'event_type', p_event_type,
        'created_at', v_created_at
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.append_order_event(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, JSONB) TO authenticated, anon, service_role;

COMMENT ON FUNCTION public.append_order_event IS 'B02: Ghi sự kiện vòng đời đơn hàng bất biến (append-only), tenant-isolated và bảo đảm định danh đơn';
