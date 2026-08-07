-- =========================================================================
-- v17_fix_audit_logs_not_null.sql
-- Bỏ ràng buộc NOT NULL của cột details trong bảng audit_logs
-- Lý do: Các RPC thao tác Admin (006, v16) không truyền details mà 
-- dùng old_value, new_value, target_user, do đó gây lỗi "violates not-null constraint"
-- =========================================================================

ALTER TABLE public.audit_logs ALTER COLUMN details DROP NOT NULL;
