-- =========================================================================
-- v12_fix_profiles_columns.sql
-- FIX: column p.disabled_at / p.last_login does not exist (code 42703)
-- profiles hiện chỉ có: id, email, full_name, status, username, phone, ...
-- Các RPC admin (006) tham chiếu disabled_at + last_login -> thêm cột.
-- =========================================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_disabled_at ON public.profiles (disabled_at);
