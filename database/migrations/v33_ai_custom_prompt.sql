-- =========================================================================
-- v33_ai_custom_prompt.sql
-- Thêm trường custom_prompt_rules vào shop_feature_flags
-- =========================================================================

ALTER TABLE public.shop_feature_flags 
ADD COLUMN IF NOT EXISTS custom_prompt_rules TEXT DEFAULT '';

-- Cập nhật data mặc định
UPDATE public.shop_feature_flags SET custom_prompt_rules = '' WHERE custom_prompt_rules IS NULL;
