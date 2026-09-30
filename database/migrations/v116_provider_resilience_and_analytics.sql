-- =========================================================================
-- Migration v116: Provider Resilience & Analytics (G006)
-- Mô tả: Cột error_class, cache_hit cho ai_usage_log và RPC tính toán
--        tỷ lệ thành công, độ trễ p50/p95, phân nhóm lỗi theo provider.
-- =========================================================================

-- 1. Bổ sung các cột phục vụ quan sát độ phục hồi & SLA nhà cung cấp
ALTER TABLE public.ai_usage_log ADD COLUMN IF NOT EXISTS error_class TEXT;
ALTER TABLE public.ai_usage_log ADD COLUMN IF NOT EXISTS cache_hit BOOLEAN DEFAULT false;

-- 2. Chỉ mục tối ưu truy vấn SLA và độ trễ theo provider
CREATE INDEX IF NOT EXISTS idx_ai_usage_provider_status ON public.ai_usage_log(provider, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_latency ON public.ai_usage_log(provider, latency_ms);

-- 3. RPC tính toán Resilience Analytics theo Provider
CREATE OR REPLACE FUNCTION public.admin_get_provider_resilience_analytics(
    p_from TIMESTAMPTZ DEFAULT now() - interval '30 days',
    p_to TIMESTAMPTZ DEFAULT now()
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_result JSONB;
BEGIN
    IF NOT public.is_system_admin() THEN
        RAISE EXCEPTION 'ACCESS_DENIED: SYSTEM_ADMIN only.';
    END IF;

    SELECT COALESCE(jsonb_object_agg(p.provider, p.metrics), '{}'::jsonb)
    INTO v_result
    FROM (
        SELECT
            COALESCE(NULLIF(provider, ''), 'unknown') AS provider,
            jsonb_build_object(
                'provider', COALESCE(NULLIF(provider, ''), 'unknown'),
                'total_requests', count(*),
                'success_requests', count(*) FILTER (WHERE status = 'success'),
                'failed_requests', count(*) FILTER (WHERE status <> 'success'),
                'success_rate', CASE 
                    WHEN count(*) = 0 THEN 100.0
                    ELSE ROUND((count(*) FILTER (WHERE status = 'success')::numeric / count(*)::numeric) * 100.0, 2)
                END,
                'p50_latency_ms', ROUND(COALESCE(percentile_cont(0.50) WITHIN GROUP (ORDER BY COALESCE(latency_ms, 0)), 0)::numeric, 0),
                'p95_latency_ms', ROUND(COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY COALESCE(latency_ms, 0)), 0)::numeric, 0),
                'total_cost', ROUND(COALESCE(sum(estimated_cost), 0)::numeric, 2),
                'cache_hits', count(*) FILTER (WHERE cache_hit = true),
                'error_classes', (
                    SELECT COALESCE(jsonb_object_agg(sub.err_cls, sub.cnt), '{}'::jsonb)
                    FROM (
                        SELECT COALESCE(error_class, 'UNKNOWN') AS err_cls, count(*) AS cnt
                        FROM public.ai_usage_log inner_log
                        WHERE inner_log.provider = outer_log.provider
                          AND inner_log.created_at >= p_from AND inner_log.created_at <= p_to
                          AND inner_log.status <> 'success'
                        GROUP BY COALESCE(error_class, 'UNKNOWN')
                    ) sub
                )
            ) AS metrics
        FROM public.ai_usage_log outer_log
        WHERE created_at >= p_from AND created_at <= p_to
        GROUP BY COALESCE(NULLIF(provider, ''), 'unknown')
    ) p;

    RETURN jsonb_build_object(
        'from', p_from,
        'to', p_to,
        'by_provider', v_result
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_provider_resilience_analytics(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
