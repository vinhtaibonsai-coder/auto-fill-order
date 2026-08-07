-- =========================================================================
-- v13_fix_audit_notifications_columns.sql
-- FIX: các RPC 006/008/009 dùng cột không tồn tại trong audit_logs/notifications
--   audit_logs   (thực tế: id, actor_email, action, details, shop_id, user_id, created_at)
--                thiếu: actor_id, target_user, old_value, new_value, target_resource, target_id, payload
--   notifications (thực tế có: title, message, type, is_read, is_global, level, user_id, shop_id)
--                thiếu: content, target
-- =========================================================================

-- 1. audit_logs: bổ sung cột cho RPC admin (006) + RPC member (008) + trigger v5
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS actor_id UUID REFERENCES public.profiles(id);
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS target_user UUID;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS old_value TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS new_value TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS target_resource TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS target_id TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS payload JSONB;

-- 2. notifications: bổ sung cột content + target (RPC system_get_notifications, owner_invite_staff)
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS target TEXT;
