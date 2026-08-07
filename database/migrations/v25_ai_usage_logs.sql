-- =========================================================================
-- v25_ai_usage_logs.sql
-- Bảng theo dõi và thống kê lượt gọi AI thực tế từ Panel & Extension
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES public.shops(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  provider TEXT NOT NULL DEFAULT 'groq', -- groq, openai, gemini
  model TEXT,
  api_key_masked TEXT, -- e.g. gsk_xxxx...3a9f
  status TEXT NOT NULL DEFAULT 'success', -- success, error, quota_exceeded, rate_limited
  latency_ms INT DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Security
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_ai_usage_logs" ON public.ai_usage_logs;
CREATE POLICY "read_ai_usage_logs" ON public.ai_usage_logs FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "insert_ai_usage_logs" ON public.ai_usage_logs;
CREATE POLICY "insert_ai_usage_logs" ON public.ai_usage_logs FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Sample initial logs for active system checking
INSERT INTO public.ai_usage_logs (provider, model, api_key_masked, status, latency_ms, error_message) VALUES
  ('groq', 'llama-3.3-70b-versatile', 'gsk_xxxx...3a9f', 'success', 185, NULL),
  ('groq', 'llama-3.3-70b-versatile', 'gsk_xxxx...3a9f', 'success', 210, NULL),
  ('openai', 'gpt-4o-mini', 'sk-proj...4b91', 'success', 340, NULL),
  ('gemini', 'gemini-1.5-flash', 'AIzaSyxx...p2L0', 'success', 190, NULL)
ON CONFLICT DO NOTHING;
