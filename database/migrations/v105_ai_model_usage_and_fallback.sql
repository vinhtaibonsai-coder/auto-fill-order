-- =====================================================================
-- MIGRATION v105: AI MODEL USAGE TRACKING & CROSS-PROVIDER FALLBACK
-- Thêm cột model vào ai_usage_log và RPC thống kê lượt dùng theo model
-- =====================================================================

-- 1. Thêm cột model vào bảng ai_usage_log nếu chưa có
ALTER TABLE public.ai_usage_log ADD COLUMN IF NOT EXISTS model TEXT;

-- 2. Tạo index tối ưu truy vấn đếm theo model và thời gian
CREATE INDEX IF NOT EXISTS idx_ai_usage_model_created
    ON public.ai_usage_log (model, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_usage_shop_model_created
    ON public.ai_usage_log (shop_id, model, created_at DESC);

-- 3. Tạo RPC get_ai_models_usage_stats để thống kê số lần gọi theo từng model
CREATE OR REPLACE FUNCTION public.get_ai_models_usage_stats(p_shop_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result JSONB;
BEGIN
    -- Gom nhóm theo model, tính tổng số request và số request hôm nay
    SELECT jsonb_agg(
        jsonb_build_object(
            'model', COALESCE(model, 'unknown'),
            'total_calls', total_count,
            'total_requests', total_count,
            'calls_today', today_count,
            'today_requests', today_count,
            'total_tokens', (total_p_tokens + total_c_tokens),
            'total_prompt_tokens', total_p_tokens,
            'total_completion_tokens', total_c_tokens,
            'last_used_at', last_used
        ) ORDER BY total_count DESC
    )
    INTO v_result
    FROM (
        SELECT 
            COALESCE(model, 'unknown') AS model,
            COUNT(*)::INT AS total_count,
            COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)::INT AS today_count,
            COALESCE(SUM(prompt_tokens), 0)::BIGINT AS total_p_tokens,
            COALESCE(SUM(completion_tokens), 0)::BIGINT AS total_c_tokens,
            MAX(created_at) AS last_used
        FROM public.ai_usage_log
        WHERE (p_shop_id IS NULL OR shop_id = p_shop_id)
          AND status = 'success'
        GROUP BY COALESCE(model, 'unknown')
    ) sub;

    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- 4. Phân quyền thực thi RPC
GRANT EXECUTE ON FUNCTION public.get_ai_models_usage_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ai_models_usage_stats(UUID) TO service_role;
