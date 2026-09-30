-- =========================================================================
-- v113_standardize_ai_usage_and_cost.sql
-- Chuẩn hóa schema ai_usage_log, đồng bộ tokens, seed giá model và RPC analytics
-- =========================================================================

-- 1. Bổ sung các cột thống nhất cho public.ai_usage_log
ALTER TABLE public.ai_usage_log ADD COLUMN IF NOT EXISTS provider TEXT;
ALTER TABLE public.ai_usage_log ADD COLUMN IF NOT EXISTS latency_ms INT DEFAULT 0;
ALTER TABLE public.ai_usage_log ADD COLUMN IF NOT EXISTS input_tokens INT DEFAULT 0;
ALTER TABLE public.ai_usage_log ADD COLUMN IF NOT EXISTS output_tokens INT DEFAULT 0;
ALTER TABLE public.ai_usage_log ADD COLUMN IF NOT EXISTS total_tokens INT DEFAULT 0;
ALTER TABLE public.ai_usage_log ADD COLUMN IF NOT EXISTS estimated_cost NUMERIC(16, 6) DEFAULT NULL;
ALTER TABLE public.ai_usage_log ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'VND';

-- 2. Trigger đồng bộ token và tính giá vốn tại thời điểm request
CREATE OR REPLACE FUNCTION public.tr_sync_ai_usage_log_tokens()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Đồng bộ input_tokens <-> prompt_tokens
  IF NEW.input_tokens IS NULL OR NEW.input_tokens = 0 THEN
    IF NEW.prompt_tokens IS NOT NULL AND NEW.prompt_tokens > 0 THEN
      NEW.input_tokens := NEW.prompt_tokens;
    END IF;
  ELSIF NEW.prompt_tokens IS NULL OR NEW.prompt_tokens = 0 THEN
    NEW.prompt_tokens := NEW.input_tokens;
  END IF;

  -- Đồng bộ output_tokens <-> completion_tokens
  IF NEW.output_tokens IS NULL OR NEW.output_tokens = 0 THEN
    IF NEW.completion_tokens IS NOT NULL AND NEW.completion_tokens > 0 THEN
      NEW.output_tokens := NEW.completion_tokens;
    END IF;
  ELSIF NEW.completion_tokens IS NULL OR NEW.completion_tokens = 0 THEN
    NEW.completion_tokens := NEW.output_tokens;
  END IF;

  -- Tính tổng tokens
  NEW.total_tokens := COALESCE(NEW.input_tokens, NEW.prompt_tokens, 0) + COALESCE(NEW.output_tokens, NEW.completion_tokens, 0);

  -- Suy diễn provider từ model nếu chưa có
  IF NEW.provider IS NULL OR NEW.provider = '' THEN
    IF NEW.model ILIKE '%gemini%' THEN NEW.provider := 'gemini';
    ELSIF NEW.model ILIKE '%llama%' OR NEW.model ILIKE '%mixtral%' OR NEW.model ILIKE '%groq%' THEN NEW.provider := 'groq';
    ELSIF NEW.model ILIKE '%grok%' THEN NEW.provider := 'grok';
    ELSIF NEW.model ILIKE '%gpt%' OR NEW.model ILIKE '%o1%' OR NEW.model ILIKE '%o3%' THEN NEW.provider := 'openai';
    ELSE NEW.provider := 'other';
    END IF;
  END IF;

  -- Tính giá vốn ước tính nếu chưa có và có model rate
  IF NEW.estimated_cost IS NULL AND NEW.model IS NOT NULL THEN
    SELECT 
      CASE 
        WHEN r.model IS NOT NULL THEN
          ROUND(
            (COALESCE(NEW.input_tokens, 0)::numeric / 1000000.0 * r.input_cost_per_million) +
            (COALESCE(NEW.output_tokens, 0)::numeric / 1000000.0 * r.output_cost_per_million),
            6
          )
        ELSE NULL
      END
    INTO NEW.estimated_cost
    FROM public.ai_model_cost_rates r
    WHERE r.model = NEW.model
      AND r.effective_from <= COALESCE(NEW.created_at, now())
    ORDER BY r.effective_from DESC
    LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_ai_usage_log_tokens_sync ON public.ai_usage_log;
CREATE TRIGGER tr_ai_usage_log_tokens_sync
  BEFORE INSERT OR UPDATE ON public.ai_usage_log
  FOR EACH ROW EXECUTE FUNCTION public.tr_sync_ai_usage_log_tokens();

-- 3. Seed baseline rates vào public.ai_model_cost_rates (Đơn vị: VND / 1,000,000 tokens)
INSERT INTO public.ai_model_cost_rates (model, input_cost_per_million, output_cost_per_million, currency, effective_from)
VALUES
  ('gemini-3.6-flash', 2500, 10000, 'VND', now()),
  ('gemini-2.0-flash', 2500, 10000, 'VND', now()),
  ('gemini-1.5-flash', 1875, 7500, 'VND', now()),
  ('llama-3.3-70b-versatile', 14750, 19750, 'VND', now()),
  ('llama-3.1-8b-instant', 1250, 2000, 'VND', now()),
  ('gpt-4o-mini', 3750, 15000, 'VND', now()),
  ('gpt-4o', 62500, 250000, 'VND', now()),
  ('grok-beta', 125000, 375000, 'VND', now())
ON CONFLICT (model) DO UPDATE SET
  input_cost_per_million = EXCLUDED.input_cost_per_million,
  output_cost_per_million = EXCLUDED.output_cost_per_million,
  currency = EXCLUDED.currency,
  effective_from = EXCLUDED.effective_from,
  updated_at = now();

-- 4. RPC báo cáo phân tích chi phí AI
CREATE OR REPLACE FUNCTION public.admin_get_ai_cost_analytics(
  p_from TIMESTAMPTZ,
  p_to TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_total_requests BIGINT := 0;
  v_successful_requests BIGINT := 0;
  v_failed_requests BIGINT := 0;
  v_total_tokens BIGINT := 0;
  v_total_cost NUMERIC(16, 2) := 0;
  v_unrated_requests BIGINT := 0;
  v_by_model JSONB := '[]'::jsonb;
  v_by_provider JSONB := '[]'::jsonb;
  v_rates JSONB := '[]'::jsonb;
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'ACCESS_DENIED';
  END IF;

  SELECT
    count(*),
    count(*) FILTER (WHERE status = 'success'),
    count(*) FILTER (WHERE status <> 'success'),
    COALESCE(sum(total_tokens), 0),
    COALESCE(sum(estimated_cost), 0),
    count(*) FILTER (WHERE estimated_cost IS NULL)
  INTO
    v_total_requests,
    v_successful_requests,
    v_failed_requests,
    v_total_tokens,
    v_total_cost,
    v_unrated_requests
  FROM public.ai_usage_log
  WHERE created_at BETWEEN p_from AND p_to;

  SELECT COALESCE(jsonb_agg(to_jsonb(m) ORDER BY m.total_requests DESC), '[]'::jsonb)
  INTO v_by_model
  FROM (
    SELECT
      model,
      COALESCE(provider, 'other') AS provider,
      count(*) AS total_requests,
      COALESCE(sum(total_tokens), 0) AS total_tokens,
      COALESCE(sum(estimated_cost), 0) AS estimated_cost,
      count(*) FILTER (WHERE estimated_cost IS NULL) AS unrated_count
    FROM public.ai_usage_log
    WHERE created_at BETWEEN p_from AND p_to
    GROUP BY model, provider
  ) m;

  SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.total_requests DESC), '[]'::jsonb)
  INTO v_by_provider
  FROM (
    SELECT
      COALESCE(provider, 'other') AS provider,
      count(*) AS total_requests,
      COALESCE(sum(total_tokens), 0) AS total_tokens,
      COALESCE(sum(estimated_cost), 0) AS estimated_cost
    FROM public.ai_usage_log
    WHERE created_at BETWEEN p_from AND p_to
    GROUP BY provider
  ) p;

  SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.model), '[]'::jsonb)
  INTO v_rates
  FROM public.ai_model_cost_rates r;

  RETURN jsonb_build_object(
    'period', jsonb_build_object('from', p_from, 'to', p_to),
    'total_requests', v_total_requests,
    'successful_requests', v_successful_requests,
    'failed_requests', v_failed_requests,
    'total_tokens', v_total_tokens,
    'total_estimated_cost', v_total_cost,
    'unrated_requests', v_unrated_requests,
    'by_model', v_by_model,
    'by_provider', v_by_provider,
    'rates', v_rates,
    'data_source', 'ai_usage_log_and_cost_rates',
    'measured_at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_ai_cost_analytics(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';
