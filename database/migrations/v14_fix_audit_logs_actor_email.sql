-- =========================================================================
-- v14_fix_audit_logs_actor_email.sql
-- FIX: null value in column "actor_email" of relation "audit_logs"
-- violates not-null constraint
-- audit_logs.actor_email là NOT NULL nhưng các RPC (006/008) chỉ insert
-- actor_id -> dùng trigger tự điền actor_email từ profiles mỗi khi INSERT.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.fn_audit_logs_auto_actor_email()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.actor_email IS NULL THEN
        SELECT email INTO NEW.actor_email
        FROM public.profiles
        WHERE id = COALESCE(NEW.actor_id, auth.uid())
        LIMIT 1;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_logs_auto_actor_email ON public.audit_logs;
CREATE TRIGGER trg_audit_logs_auto_actor_email
    BEFORE INSERT ON public.audit_logs
    FOR EACH ROW EXECUTE FUNCTION public.fn_audit_logs_auto_actor_email();
