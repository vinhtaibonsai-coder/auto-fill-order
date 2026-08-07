-- =========================================================================
-- v26_system_configs_open_policy.sql
-- Cấp quyền Đọc / Ghi (SELECT / ALL) trên bảng system_configs cho Admin Dashboard
-- Chạy script này trong Supabase SQL Editor để sửa dứt điểm lỗi RLS CHƯA ĐỒNG BỘ DB
-- =========================================================================

-- 1. Bật RLS
ALTER TABLE public.system_configs ENABLE ROW LEVEL SECURITY;

-- 2. Cấp quyền Đọc công khai cho system_configs
DROP POLICY IF EXISTS "allow_read_system_configs" ON public.system_configs;
CREATE POLICY "allow_read_system_configs" ON public.system_configs
  FOR SELECT
  USING (true);

-- 3. Cấp quyền Thêm / Sửa / Ghi cho system_configs
DROP POLICY IF EXISTS "allow_write_system_configs" ON public.system_configs;
CREATE POLICY "allow_write_system_configs" ON public.system_configs
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 4. GRANT bổ sung quyền bảng cho anon và authenticated
GRANT ALL ON TABLE public.system_configs TO authenticated;
GRANT ALL ON TABLE public.system_configs TO anon;
GRANT ALL ON TABLE public.system_configs TO service_role;

-- 5. Seed sẵn key groq_api_keys nếu chưa có
INSERT INTO public.system_configs (key, value, description)
VALUES (
  'groq_api_keys',
  '{"provider": "groq", "keys": ["gsk_placeholder_key"], "model": "llama-3.3-70b-versatile"}'::jsonb,
  'Groq API Keys do Master Admin cấu hình'
)
ON CONFLICT (key) DO NOTHING;
