-- =============================================================================
-- Migration v117: Standardize Job/Outbox Reliability & Dead Letter Replay (G007)
--
-- Standardizes background queue states (pending, running, succeeded, failed, dead_letter),
-- exponential backoff retry count, atomic lease locks (FOR UPDATE SKIP LOCKED) to prevent
-- concurrent worker collisions, idempotency key deduplication, and admin replay RPCs with audit.
-- =============================================================================

-- 1. Standardized system job outbox table
CREATE TABLE IF NOT EXISTS public.system_job_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    queue_type TEXT NOT NULL CHECK (queue_type IN ('draft_sync', 'order_sync', 'telegram_alert', 'webhook_retry', 'retention_notification', 'custom')),
    idempotency_key TEXT UNIQUE,
    shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'succeeded', 'failed', 'dead_letter')),
    attempts INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 5,
    next_retry_at TIMESTAMPTZ DEFAULT now(),
    lease_token TEXT,
    lease_expires_at TIMESTAMPTZ,
    last_error TEXT,
    dead_letter_reason TEXT,
    priority INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ
);

-- 2. Standardize columns on existing outbox tables
ALTER TABLE public.sync_outbox ADD COLUMN IF NOT EXISTS attempts INT NOT NULL DEFAULT 0;
ALTER TABLE public.sync_outbox ADD COLUMN IF NOT EXISTS max_attempts INT NOT NULL DEFAULT 5;
ALTER TABLE public.sync_outbox ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.sync_outbox ADD COLUMN IF NOT EXISTS lease_token TEXT;
ALTER TABLE public.sync_outbox ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ;
ALTER TABLE public.sync_outbox ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE public.sync_outbox ADD COLUMN IF NOT EXISTS dead_letter_reason TEXT;
ALTER TABLE public.sync_outbox ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.ops_alert_outbox ADD COLUMN IF NOT EXISTS max_attempts INT NOT NULL DEFAULT 5;
ALTER TABLE public.ops_alert_outbox ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.ops_alert_outbox ADD COLUMN IF NOT EXISTS lease_token TEXT;
ALTER TABLE public.ops_alert_outbox ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ;
ALTER TABLE public.ops_alert_outbox ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE public.ops_alert_outbox ADD COLUMN IF NOT EXISTS dead_letter_reason TEXT;
ALTER TABLE public.ops_alert_outbox ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 3. High-performance indices for worker polling and lease tracking
CREATE INDEX IF NOT EXISTS idx_system_job_outbox_poll ON public.system_job_outbox (queue_type, status, next_retry_at, priority);
CREATE INDEX IF NOT EXISTS idx_system_job_outbox_lease ON public.system_job_outbox (lease_token, lease_expires_at);
CREATE INDEX IF NOT EXISTS idx_system_job_outbox_status ON public.system_job_outbox (status, created_at);
CREATE INDEX IF NOT EXISTS idx_system_job_outbox_idempotency ON public.system_job_outbox (idempotency_key);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.system_job_outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_manage_system_job_outbox ON public.system_job_outbox;
CREATE POLICY admin_manage_system_job_outbox ON public.system_job_outbox
  FOR ALL USING (public.is_system_admin());

DROP POLICY IF EXISTS shop_manage_system_job_outbox ON public.system_job_outbox;
CREATE POLICY shop_manage_system_job_outbox ON public.system_job_outbox
  FOR ALL USING (
    shop_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.shop_members
      WHERE shop_members.shop_id = system_job_outbox.shop_id
        AND shop_members.user_id = auth.uid()
        AND shop_members.removed_at IS NULL
    )
  );

-- 5. Atomic Lease Acquisition RPC (Guarantees zero concurrency overlap via SKIP LOCKED)
CREATE OR REPLACE FUNCTION public.acquire_outbox_job_lease(
    p_worker_id TEXT,
    p_queue_type TEXT DEFAULT NULL,
    p_lease_seconds INT DEFAULT 60,
    p_batch_size INT DEFAULT 1
)
RETURNS SETOF public.system_job_outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN QUERY
  WITH available_jobs AS (
    SELECT id
    FROM public.system_job_outbox
    WHERE (p_queue_type IS NULL OR queue_type = p_queue_type)
      AND (
        status = 'pending'
        OR (status = 'failed' AND attempts < max_attempts AND (next_retry_at IS NULL OR next_retry_at <= now()))
        OR (status = 'running' AND lease_expires_at < now()) -- Claim zombie locks whose worker died
      )
    ORDER BY priority DESC, created_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.system_job_outbox j
  SET status = 'running',
      lease_token = p_worker_id,
      lease_expires_at = now() + (p_lease_seconds || ' seconds')::interval,
      attempts = j.attempts + 1,
      updated_at = now()
  FROM available_jobs
  WHERE j.id = available_jobs.id
  RETURNING j.*;
END;
$$;

GRANT EXECUTE ON FUNCTION public.acquire_outbox_job_lease(TEXT, TEXT, INT, INT) TO authenticated, service_role;

-- 6. Complete Outbox Job RPC
CREATE OR REPLACE FUNCTION public.complete_outbox_job(
    p_job_id UUID,
    p_lease_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_updated INT := 0;
BEGIN
  UPDATE public.system_job_outbox
  SET status = 'succeeded',
      lease_token = NULL,
      lease_expires_at = NULL,
      processed_at = now(),
      updated_at = now()
  WHERE id = p_job_id
    AND (lease_token = p_lease_token OR lease_token IS NULL OR public.is_system_admin());
    
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  
  IF v_updated = 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Job not found or lease mismatch');
  END IF;

  RETURN jsonb_build_object('success', true, 'job_id', p_job_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_outbox_job(UUID, TEXT) TO authenticated, service_role;

-- 7. Fail Outbox Job RPC (Transitions to dead_letter if attempts >= max_attempts)
CREATE OR REPLACE FUNCTION public.fail_outbox_job(
    p_job_id UUID,
    p_lease_token TEXT,
    p_error_message TEXT,
    p_retry_delay_seconds INT DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_job RECORD;
  v_new_status TEXT;
BEGIN
  SELECT * INTO v_job
  FROM public.system_job_outbox
  WHERE id = p_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Job not found');
  END IF;

  IF v_job.lease_token IS NOT NULL AND v_job.lease_token != p_lease_token AND NOT public.is_system_admin() THEN
    RETURN jsonb_build_object('success', false, 'message', 'Lease mismatch');
  END IF;

  IF v_job.attempts >= v_job.max_attempts THEN
    v_new_status := 'dead_letter';
  ELSE
    v_new_status := 'failed';
  END IF;

  UPDATE public.system_job_outbox
  SET status = v_new_status,
      last_error = p_error_message,
      dead_letter_reason = CASE WHEN v_new_status = 'dead_letter' THEN p_error_message ELSE dead_letter_reason END,
      lease_token = NULL,
      lease_expires_at = NULL,
      next_retry_at = CASE WHEN v_new_status = 'failed' THEN now() + (p_retry_delay_seconds || ' seconds')::interval ELSE next_retry_at END,
      updated_at = now()
  WHERE id = p_job_id;

  RETURN jsonb_build_object('success', true, 'job_id', p_job_id, 'status', v_new_status);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fail_outbox_job(UUID, TEXT, TEXT, INT) TO authenticated, service_role;

-- 8. Admin Dead Letter Replay RPC (Guarded by is_system_admin and audited)
CREATE OR REPLACE FUNCTION public.admin_replay_dead_letter_jobs(
    p_queue_type TEXT DEFAULT NULL,
    p_job_ids UUID[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_replayed_count INT := 0;
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'ACCESS_DENIED: SYSTEM_ADMIN only.';
  END IF;

  UPDATE public.system_job_outbox
  SET status = 'pending',
      attempts = 0,
      next_retry_at = now(),
      lease_token = NULL,
      lease_expires_at = NULL,
      dead_letter_reason = NULL,
      last_error = NULL,
      updated_at = now()
  WHERE status = 'dead_letter'
    AND (p_queue_type IS NULL OR queue_type = p_queue_type)
    AND (p_job_ids IS NULL OR id = ANY(p_job_ids));

  GET DIAGNOSTICS v_replayed_count = ROW_COUNT;

  -- Ghi nhận lịch sử kiểm toán audit_logs
  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (
    auth.uid(),
    'REPLAY_DEAD_LETTER_JOBS',
    'system_job_outbox',
    COALESCE(p_queue_type, 'all_queues'),
    jsonb_build_object(
      'replayed_count', v_replayed_count,
      'queue_type', p_queue_type,
      'requested_job_ids', p_job_ids,
      'replayed_at', now()
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'replayed_count', v_replayed_count,
    'message', 'Đã phục hồi ' || v_replayed_count || ' jobs từ hàng đợi dead_letter.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_replay_dead_letter_jobs(TEXT, UUID[]) TO authenticated, service_role;

-- 9. Admin Retry Outbox Job RPC
CREATE OR REPLACE FUNCTION public.admin_retry_outbox_job(
    p_job_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'ACCESS_DENIED: SYSTEM_ADMIN only.';
  END IF;

  UPDATE public.system_job_outbox
  SET status = 'pending',
      attempts = 0,
      next_retry_at = now(),
      lease_token = NULL,
      lease_expires_at = NULL,
      updated_at = now()
  WHERE id = p_job_id;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (
    auth.uid(),
    'RETRY_OUTBOX_JOB',
    'system_job_outbox',
    p_job_id::text,
    jsonb_build_object('retried_at', now())
  );

  RETURN jsonb_build_object('success', true, 'job_id', p_job_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_retry_outbox_job(UUID) TO authenticated, service_role;

-- 10. Admin Get Outbox Queue Metrics RPC
CREATE OR REPLACE FUNCTION public.admin_get_outbox_queue_metrics()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_metrics JSONB;
  v_summary RECORD;
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'ACCESS_DENIED: SYSTEM_ADMIN only.';
  END IF;

  -- Overall counts
  SELECT
    count(*) AS total,
    count(*) FILTER (WHERE status = 'pending') AS pending,
    count(*) FILTER (WHERE status = 'running') AS running,
    count(*) FILTER (WHERE status = 'succeeded') AS succeeded,
    count(*) FILTER (WHERE status = 'failed') AS failed,
    count(*) FILTER (WHERE status = 'dead_letter') AS dead_letter
  INTO v_summary
  FROM public.system_job_outbox;

  -- Queue type breakdown
  WITH queue_stats AS (
    SELECT
      queue_type,
      count(*) AS total,
      count(*) FILTER (WHERE status = 'pending') AS pending,
      count(*) FILTER (WHERE status = 'running') AS running,
      count(*) FILTER (WHERE status = 'succeeded') AS succeeded,
      count(*) FILTER (WHERE status = 'failed') AS failed,
      count(*) FILTER (WHERE status = 'dead_letter') AS dead_letter
    FROM public.system_job_outbox
    GROUP BY queue_type
  )
  SELECT COALESCE(jsonb_object_agg(queue_type, jsonb_build_object(
    'total', total,
    'pending', pending,
    'running', running,
    'succeeded', succeeded,
    'failed', failed,
    'dead_letter', dead_letter
  )), '{}'::jsonb)
  INTO v_metrics
  FROM queue_stats;

  RETURN jsonb_build_object(
    'summary', jsonb_build_object(
      'total', COALESCE(v_summary.total, 0),
      'pending', COALESCE(v_summary.pending, 0),
      'running', COALESCE(v_summary.running, 0),
      'succeeded', COALESCE(v_summary.succeeded, 0),
      'failed', COALESCE(v_summary.failed, 0),
      'dead_letter', COALESCE(v_summary.dead_letter, 0)
    ),
    'queues', v_metrics,
    'checked_at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_outbox_queue_metrics() TO authenticated, service_role;
