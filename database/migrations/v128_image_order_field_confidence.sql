-- =========================================================================
-- Migration v128: Order Image Assets & Field Extractions with Confidence
-- =========================================================================

-- 1. Image Assets Table (Private Storage, SHA-256 Deduplication, Retention)
CREATE TABLE IF NOT EXISTS public.order_image_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    mime_type TEXT NOT NULL DEFAULT 'image/jpeg',
    file_size INTEGER NOT NULL DEFAULT 0,
    sha256 TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PROCESSED',
    retention_until TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_image_assets_shop_sha ON public.order_image_assets(shop_id, sha256);
CREATE INDEX IF NOT EXISTS idx_order_image_assets_retention ON public.order_image_assets(retention_until);

-- 2. Field Extractions Table (Per-Field Confidence & Verification Gate)
CREATE TABLE IF NOT EXISTS public.field_extractions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID REFERENCES public.order_image_assets(id) ON DELETE CASCADE,
    order_id UUID,
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    field_name TEXT NOT NULL, -- 'name', 'phone', 'address', 'ward', 'province', 'cod', 'product', 'order_code'
    raw_value TEXT,
    normalized_value TEXT,
    confidence NUMERIC(4,3) NOT NULL DEFAULT 0.850,
    source TEXT NOT NULL DEFAULT 'PARSER', -- 'OCR', 'PARSER', 'ADDRESS_DB', 'GEMINI_VISION', 'USER_CORRECTION'
    review_status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'CONFIRMED', 'CORRECTED', 'SKIPPED'
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_field_extractions_shop_order ON public.field_extractions(shop_id, order_id);
CREATE INDEX IF NOT EXISTS idx_field_extractions_asset ON public.field_extractions(asset_id);

-- 3. RLS Security Policies
ALTER TABLE public.order_image_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.field_extractions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_image_assets_tenant_isolation" ON public.order_image_assets;
CREATE POLICY "order_image_assets_tenant_isolation" ON public.order_image_assets
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

DROP POLICY IF EXISTS "field_extractions_tenant_isolation" ON public.field_extractions;
CREATE POLICY "field_extractions_tenant_isolation" ON public.field_extractions
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

-- 4. RPC Confirm or Correct Field Extraction (Explicit 4-argument signature to prevent overload ambiguity)
CREATE OR REPLACE FUNCTION public.confirm_field_extraction(
    p_extraction_id UUID,
    p_shop_id UUID,
    p_confirmed_value TEXT,
    p_review_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_calling_user UUID;
    v_extraction RECORD;
BEGIN
    v_calling_user := auth.uid();

    IF v_calling_user IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Yêu cầu đăng nhập');
    END IF;

    -- Server authorization: Check orders.edit permission
    IF NOT (public.has_shop_permission(p_shop_id, 'orders.edit') OR public.is_system_admin(v_calling_user)) THEN
        RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'Không có quyền chỉnh sửa đơn hàng (orders.edit)');
    END IF;

    SELECT * INTO v_extraction FROM public.field_extractions 
    WHERE id = p_extraction_id AND shop_id = p_shop_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND', 'message', 'Không tìm thấy thông tin trích xuất');
    END IF;

    UPDATE public.field_extractions
    SET normalized_value = p_confirmed_value,
        review_status = p_review_status,
        reviewed_by = v_calling_user,
        reviewed_at = now()
    WHERE id = p_extraction_id AND shop_id = p_shop_id;

    RETURN jsonb_build_object(
        'success', true,
        'extraction_id', p_extraction_id,
        'status', p_review_status,
        'value', p_confirmed_value
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_field_extraction(UUID, UUID, TEXT, TEXT) TO authenticated, service_role;
