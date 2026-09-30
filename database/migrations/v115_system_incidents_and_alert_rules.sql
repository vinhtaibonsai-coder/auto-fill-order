-- =========================================================================
-- Migration v115: System Incidents & Operational Alert Rules (G005)
-- Mô tả: Bảng sự cố hệ thống, cơ chế Deduplication Window, enqueuing cảnh báo
--        và các RPCs kiểm soát sự cố dành cho Admin Dashboard.
-- =========================================================================

-- 1. Bảng lưu trữ sự cố hệ thống (system_incidents)
CREATE TABLE IF NOT EXISTS public.system_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_code TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    metric_value NUMERIC,
    threshold NUMERIC,
    window_seconds INT NOT NULL DEFAULT 300,
    dedupe_key TEXT NOT NULL,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    occurrence_count INT NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'firing' CHECK (status IN ('firing', 'acknowledged', 'resolved')),
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by UUID REFERENCES public.profiles(id),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES public.profiles(id),
    owner TEXT,
    notes TEXT,
    source_link TEXT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Chỉ mục tối ưu tra cứu và lọc
CREATE INDEX IF NOT EXISTS idx_system_incidents_dedupe ON public.system_incidents(dedupe_key, status);
CREATE INDEX IF NOT EXISTS idx_system_incidents_status_sev ON public.system_incidents(status, severity);
CREATE INDEX IF NOT EXISTS idx_system_incidents_created ON public.system_incidents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_incidents_last_seen ON public.system_incidents(last_seen_at DESC);

-- Bật RLS
ALTER TABLE public.system_incidents ENABLE ROW LEVEL SECURITY;

-- Policy RLS: Chỉ SYSTEM_ADMIN mới có quyền xem và cập nhật
DROP POLICY IF EXISTS system_incidents_admin_all ON public.system_incidents;
CREATE POLICY system_incidents_admin_all ON public.system_incidents
    FOR ALL
    TO authenticated
    USING (public.is_system_admin())
    WITH CHECK (public.is_system_admin());

DROP POLICY IF EXISTS system_incidents_service_role ON public.system_incidents;
CREATE POLICY system_incidents_service_role ON public.system_incidents
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 2. Hàm ghi nhận / khử trùng lặp sự cố (record_system_incident)
CREATE OR REPLACE FUNCTION public.record_system_incident(
    p_rule_code TEXT,
    p_severity TEXT,
    p_title TEXT,
    p_message TEXT,
    p_metric_value NUMERIC,
    p_threshold NUMERIC,
    p_window_seconds INT,
    p_dedupe_key TEXT,
    p_source_link TEXT DEFAULT NULL,
    p_payload JSONB DEFAULT '{}'::jsonb,
    p_owner TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_existing RECORD;
    v_incident_id UUID;
    v_sanitized_payload JSONB;
BEGIN
    -- Khử PII: loại bỏ mọi thông tin nhạy cảm của khách hàng
    v_sanitized_payload := COALESCE(p_payload, '{}'::jsonb)
        - 'customer_name' - 'name' - 'phone' - 'phone_number'
        - 'address' - 'raw_address' - 'street' - 'email'
        - 'password' - 'secret' - 'api_key' - 'token';

    -- Kiểm tra xem sự cố cùng dedupe_key đã tồn tại trong cửa sổ trượt (window) chưa
    SELECT id, occurrence_count, status, last_seen_at
    INTO v_existing
    FROM public.system_incidents
    WHERE dedupe_key = p_dedupe_key
      AND status IN ('firing', 'acknowledged')
      AND last_seen_at >= now() - (COALESCE(p_window_seconds, 300) || ' seconds')::interval
    ORDER BY last_seen_at DESC
    LIMIT 1;

    IF v_existing.id IS NOT NULL THEN
        -- Khử lặp: Chỉ cập nhật last_seen_at và tăng số lần xuất hiện, không tạo mới
        UPDATE public.system_incidents
        SET last_seen_at = now(),
            occurrence_count = occurrence_count + 1,
            metric_value = p_metric_value,
            payload = v_sanitized_payload,
            updated_at = now()
        WHERE id = v_existing.id
        RETURNING id INTO v_incident_id;

        RETURN jsonb_build_object(
            'success', true,
            'incident_id', v_incident_id,
            'is_new', false,
            'occurrence_count', v_existing.occurrence_count + 1,
            'status', v_existing.status
        );
    ELSE
        -- Tạo mới bản ghi sự cố
        INSERT INTO public.system_incidents(
            rule_code, severity, title, message, metric_value, threshold,
            window_seconds, dedupe_key, first_seen_at, last_seen_at,
            occurrence_count, status, owner, source_link, payload
        ) VALUES (
            p_rule_code, p_severity, p_title, p_message, p_metric_value, p_threshold,
            COALESCE(p_window_seconds, 300), p_dedupe_key, now(), now(),
            1, 'firing', p_owner, p_source_link, v_sanitized_payload
        )
        RETURNING id INTO v_incident_id;

        -- Đưa vào hàng đợi cảnh báo ops_alert_outbox cho Telegram/Discord/Slack bot (đã khử PII)
        INSERT INTO public.ops_alert_outbox(
            alert_type, severity, title, message, payload
        ) VALUES (
            p_rule_code,
            p_severity,
            p_title,
            p_message,
            jsonb_build_object(
                'incident_id', v_incident_id,
                'metric_value', p_metric_value,
                'threshold', p_threshold,
                'dedupe_key', p_dedupe_key,
                'source_link', p_source_link
            )
        );

        RETURN jsonb_build_object(
            'success', true,
            'incident_id', v_incident_id,
            'is_new', true,
            'occurrence_count', 1,
            'status', 'firing'
        );
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_system_incident(TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, INT, TEXT, TEXT, JSONB, TEXT) TO authenticated, service_role;

-- 3. RPC truy vấn danh sách sự cố và thống kê (admin_get_incidents)
CREATE OR REPLACE FUNCTION public.admin_get_incidents(
    p_status TEXT DEFAULT NULL,
    p_severity TEXT DEFAULT NULL,
    p_limit INT DEFAULT 50,
    p_offset INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_incidents JSONB;
    v_firing_count INT;
    v_acknowledged_count INT;
    v_resolved_count INT;
    v_critical_count INT;
    v_total_filtered INT;
BEGIN
    IF NOT public.is_system_admin() THEN
        RAISE EXCEPTION 'ACCESS_DENIED: SYSTEM_ADMIN only.';
    END IF;

    -- Thống kê tổng hợp số lượng sự cố theo trạng thái
    SELECT
        count(*) FILTER (WHERE status = 'firing'),
        count(*) FILTER (WHERE status = 'acknowledged'),
        count(*) FILTER (WHERE status = 'resolved'),
        count(*) FILTER (WHERE status = 'firing' AND severity = 'critical')
    INTO
        v_firing_count,
        v_acknowledged_count,
        v_resolved_count,
        v_critical_count
    FROM public.system_incidents;

    -- Đếm tổng số bản ghi thỏa mãn bộ lọc
    SELECT count(*)
    INTO v_total_filtered
    FROM public.system_incidents
    WHERE (p_status IS NULL OR p_status = '' OR status = p_status)
      AND (p_severity IS NULL OR p_severity = '' OR severity = p_severity);

    -- Lấy danh sách bản ghi
    SELECT COALESCE(jsonb_agg(row_to_json(i)), '[]'::jsonb)
    INTO v_incidents
    FROM (
        SELECT
            id, rule_code, severity, title, message, metric_value, threshold,
            window_seconds, dedupe_key, first_seen_at, last_seen_at,
            occurrence_count, status, acknowledged_at, acknowledged_by,
            resolved_at, resolved_by, owner, notes, source_link, payload,
            created_at, updated_at
        FROM public.system_incidents
        WHERE (p_status IS NULL OR p_status = '' OR status = p_status)
          AND (p_severity IS NULL OR p_severity = '' OR severity = p_severity)
        ORDER BY
            CASE status
                WHEN 'firing' THEN 1
                WHEN 'acknowledged' THEN 2
                WHEN 'resolved' THEN 3
                ELSE 4
            END,
            last_seen_at DESC
        LIMIT p_limit OFFSET p_offset
    ) i;

    RETURN jsonb_build_object(
        'summary', jsonb_build_object(
            'firing', COALESCE(v_firing_count, 0),
            'acknowledged', COALESCE(v_acknowledged_count, 0),
            'resolved', COALESCE(v_resolved_count, 0),
            'critical', COALESCE(v_critical_count, 0),
            'total_filtered', COALESCE(v_total_filtered, 0)
        ),
        'incidents', v_incidents
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_incidents(TEXT, TEXT, INT, INT) TO authenticated, service_role;

-- 4. RPC xử lý sự cố (Acknowledge / Resolve) có ghi vết Audit Log
CREATE OR REPLACE FUNCTION public.admin_update_incident_status(
    p_incident_id UUID,
    p_action TEXT,
    p_owner TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_incident RECORD;
    v_current_user_id UUID;
BEGIN
    IF NOT public.is_system_admin() THEN
        RAISE EXCEPTION 'ACCESS_DENIED: SYSTEM_ADMIN only.';
    END IF;

    v_current_user_id := auth.uid();

    SELECT * INTO v_incident FROM public.system_incidents WHERE id = p_incident_id;
    IF v_incident.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'INCIDENT_NOT_FOUND');
    END IF;

    IF p_action = 'acknowledge' THEN
        UPDATE public.system_incidents
        SET status = 'acknowledged',
            acknowledged_at = now(),
            acknowledged_by = v_current_user_id,
            owner = COALESCE(p_owner, owner),
            notes = COALESCE(p_notes, notes),
            updated_at = now()
        WHERE id = p_incident_id;

        -- Ghi vết Audit Log
        INSERT INTO public.audit_logs (user_id, action, target_resource, target_id, payload)
        VALUES (
            v_current_user_id,
            'INCIDENT_ACKNOWLEDGE',
            'system_incidents',
            p_incident_id::TEXT,
            jsonb_build_object('owner', p_owner, 'notes', p_notes, 'previous_status', v_incident.status)
        );

    ELSIF p_action = 'resolve' THEN
        UPDATE public.system_incidents
        SET status = 'resolved',
            resolved_at = now(),
            resolved_by = v_current_user_id,
            notes = COALESCE(p_notes, notes),
            updated_at = now()
        WHERE id = p_incident_id;

        -- Ghi vết Audit Log
        INSERT INTO public.audit_logs (user_id, action, target_resource, target_id, payload)
        VALUES (
            v_current_user_id,
            'INCIDENT_RESOLVE',
            'system_incidents',
            p_incident_id::TEXT,
            jsonb_build_object('notes', p_notes, 'previous_status', v_incident.status)
        );
    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_ACTION');
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'incident_id', p_incident_id,
        'action', p_action,
        'updated_at', now()
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_incident_status(UUID, TEXT, TEXT, TEXT) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
