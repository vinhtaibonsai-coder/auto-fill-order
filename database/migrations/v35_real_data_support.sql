-- =========================================================================
-- v35_real_data_support.sql
-- MIGRATION BỔ SUNG (ADDITIVE) cho Kế hoạch "3 trang dữ liệu hệ thống thật".
-- Đã xác minh DB thật (2026-08-11) — KHÁC migration cũ trong repo:
--   * Bảng AI usage thật: ai_usage_log (SỐ ÍT, có prompt_tokens/completion_tokens)
--     -> KHÔNG tồn tại ai_usage_logs (số nhiều như v25 mô tả)
--   * carrier_configs, customers, sync_outbox, activity_logs, settings
--     -> ĐÃ TỒN TẠI, không tạo lại
--   * admin_audit_logs -> KHÔNG TỒN TẠI (code admin.repository.js đang INSERT
--     vào bảng này -> audit admin đang fail âm thầm; sẽ chuyển về audit_logs thật)
--
-- Migration này chỉ:
--   1. Bảng mới: shop_address_aliases (Options Address Engine — đang lưu local)
--   2. Helper is_shop_member() — REPLACE đồng bộ chuẩn v19 (hàm đã tồn tại)
--   3. RPC resolve_dashboard_role() — role 2 tầng cho Admin (THẬT SỰ thiếu)
--   4. RPC get_shop_dashboard_stats() — KPI thật cho Index/Options (THẬT SỰ thiếu)
--   5. RPC get_system_health() — System Health thật cho Admin (THẬT SỰ thiếu)
--   6. RPC get_admin_users_list() — THẬT SỰ thiếu nhưng UI gọi (Users page hỏng)
--   7. get_admin_kpis() — REPLACE: token thật (bỏ ước lượng ×150)
--   8. RPC insert_audit_log() — ghi audit admin (audit_logs chặn INSERT REST;
--      admin.repository.js đang ghi nhầm bảng admin_audit_logs không tồn tại)
-- =========================================================================

-- ---------------------------------------------------------------------
-- 1. BẢNG MỚI: shop_address_aliases (Options O-07)
--    Alias địa chỉ theo shop, thay thế chrome.storage.local
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shop_address_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  original TEXT NOT NULL,
  mapping TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (shop_id, original)
);

ALTER TABLE public.shop_address_aliases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Shop members read aliases" ON public.shop_address_aliases;
CREATE POLICY "Shop members read aliases" ON public.shop_address_aliases
  FOR SELECT USING (
    public.is_shop_member(shop_id)
  );

DROP POLICY IF EXISTS "Shop members insert aliases" ON public.shop_address_aliases;
CREATE POLICY "Shop members insert aliases" ON public.shop_address_aliases
  FOR INSERT WITH CHECK (
    public.is_shop_member(shop_id) AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS "Shop members update aliases" ON public.shop_address_aliases;
CREATE POLICY "Shop members update aliases" ON public.shop_address_aliases
  FOR UPDATE USING (
    public.is_shop_member(shop_id)
  );

DROP POLICY IF EXISTS "Shop members delete aliases" ON public.shop_address_aliases;
CREATE POLICY "Shop members delete aliases" ON public.shop_address_aliases
  FOR DELETE USING (
    public.is_shop_member(shop_id)
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_address_aliases TO authenticated;

-- ---------------------------------------------------------------------
-- 2. HELPER: is_shop_member() — ĐÃ TỒN TẠI trong DB thật (probe xác nhận).
--    CREATE OR REPLACE để ĐỒNG BỘ chuẩn v19: user phải active + chưa disabled.
--    Signature (p_shop_id UUID) -> BOOLEAN giữ nguyên nên thay thế an toàn.
--    shop_members thật có cột role TEXT (không phải role_id UUID như v15).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_shop_member(p_shop_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.shop_members sm
    JOIN public.profiles p ON p.id = sm.user_id
    WHERE sm.shop_id = p_shop_id
      AND sm.user_id = auth.uid()
      AND sm.status = 'active'
      AND sm.removed_at IS NULL
      AND p.status = 'active'
      AND p.disabled_at IS NULL
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_shop_member(UUID) TO authenticated;

-- ---------------------------------------------------------------------
-- 3. RPC: resolve_dashboard_role() — role 2 tầng cho Admin (A-04)
--    Tầng 1: user_roles (global) JOIN roles.code
--    Tầng 2: shop_members.role (TEXT code) — schema THẬT
--    Trả về (real_role, ui_role) | ui_role NULL = không có quyền dashboard
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_dashboard_role(
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS TABLE (real_role TEXT, ui_role TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_global TEXT;
  v_shop   TEXT;
BEGIN
  -- Tầng 1: role global
  SELECT r.code INTO v_global
  FROM public.user_roles ur
  JOIN public.roles r ON ur.role_id = r.id
  WHERE ur.user_id = p_user_id
  ORDER BY CASE r.code
    WHEN 'SYSTEM_ADMIN' THEN 1 WHEN 'SUPPORT' THEN 2 ELSE 3 END
  LIMIT 1;

  IF v_global = 'SYSTEM_ADMIN' THEN
    RETURN QUERY SELECT 'SYSTEM_ADMIN', 'master_admin'; RETURN;
  ELSIF v_global = 'SUPPORT' THEN
    RETURN QUERY SELECT 'SUPPORT', 'admin'; RETURN;
  END IF;

  -- Tầng 2: role per-shop (shop_members.role TEXT)
  SELECT sm.role INTO v_shop
  FROM public.shop_members sm
  WHERE sm.user_id = p_user_id AND sm.status = 'active' AND sm.removed_at IS NULL
  ORDER BY CASE UPPER(sm.role)
    WHEN 'OWNER' THEN 1 WHEN 'MANAGER' THEN 2
    WHEN 'STAFF' THEN 3 WHEN 'VIEWER' THEN 4 ELSE 5 END
  LIMIT 1;

  IF UPPER(v_shop) IN ('OWNER', 'MANAGER') THEN
    RETURN QUERY SELECT v_shop, 'shop_admin'; RETURN;
  ELSIF UPPER(v_shop) IN ('STAFF', 'VIEWER') THEN
    RETURN QUERY SELECT v_shop, 'viewer'; RETURN;
  END IF;

  RETURN QUERY SELECT COALESCE(v_global, 'NONE'), NULL::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_dashboard_role(UUID) TO authenticated;

-- ---------------------------------------------------------------------
-- 4. RPC: get_shop_dashboard_stats() — KPI THẬT cho Index I-01 / Options O-02
--    Đếm trên orders, submitted_orders, order_events, history theo shop.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_shop_dashboard_stats(p_shop_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_orders_today INT;
  v_orders_total INT;
  v_drafts INT;
  v_submitted_today INT;
  v_submitted_total INT;
  v_failed_today INT;
  v_sync_pending INT;
  v_cod_today NUMERIC(14,0);
BEGIN
  IF NOT public.is_shop_member(p_shop_id) THEN
    RAISE EXCEPTION 'ACCESS_DENIED: Bạn không thuộc cửa hàng này.';
  END IF;

  SELECT count(*) INTO v_orders_today
  FROM public.orders
  WHERE shop_id = p_shop_id AND deleted_at IS NULL
    AND created_at >= date_trunc('day', now());

  SELECT count(*) INTO v_orders_total
  FROM public.orders
  WHERE shop_id = p_shop_id AND deleted_at IS NULL;

  SELECT count(*) INTO v_drafts
  FROM public.orders
  WHERE shop_id = p_shop_id AND deleted_at IS NULL
    AND (status IS NULL OR status = 'draft');

  SELECT count(*) INTO v_submitted_today
  FROM public.submitted_orders
  WHERE shop_id = p_shop_id AND created_at >= date_trunc('day', now());

  SELECT count(*) INTO v_submitted_total
  FROM public.submitted_orders
  WHERE shop_id = p_shop_id;

  SELECT count(*) INTO v_failed_today
  FROM public.order_events
  WHERE shop_id = p_shop_id AND created_at >= date_trunc('day', now())
    AND (event ILIKE '%fail%' OR status ILIKE '%fail%');

  SELECT count(*) INTO v_sync_pending
  FROM public.sync_outbox
  WHERE shop_id = p_shop_id AND status = 'pending';

  SELECT COALESCE(sum(cod_amount), 0) INTO v_cod_today
  FROM public.orders
  WHERE shop_id = p_shop_id AND deleted_at IS NULL
    AND created_at >= date_trunc('day', now());

  RETURN jsonb_build_object(
    'orders_today', COALESCE(v_orders_today, 0),
    'orders_total', COALESCE(v_orders_total, 0),
    'drafts', COALESCE(v_drafts, 0),
    'submitted_today', COALESCE(v_submitted_today, 0),
    'submitted_total', COALESCE(v_submitted_total, 0),
    'failed_today', COALESCE(v_failed_today, 0),
    'sync_pending', COALESCE(v_sync_pending, 0),
    'cod_today', COALESCE(v_cod_today, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_shop_dashboard_stats(UUID) TO authenticated;

-- ---------------------------------------------------------------------
-- 5. RPC: get_system_health() — System Health THẬT cho Admin A-02
--    Thay toàn bộ hardcode (45ms/99.99%/210ms) trong SystemHealth.jsx
--    Nguồn: ai_usage_log (status/latency qua rate_bucket), carrier_health_logs
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_system_health()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_total INT;
  v_errors INT;
  v_quota_exceeded INT;
  v_carrier_health JSONB;
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'ACCESS_DENIED: Bạn không có quyền xem System Health.';
  END IF;

  SELECT count(*), count(*) FILTER (WHERE status != 'success'),
         count(*) FILTER (WHERE status IN ('quota_exceeded', 'rate_limited'))
    INTO v_total, v_errors, v_quota_exceeded
  FROM public.ai_usage_log
  WHERE created_at >= now() - interval '24 hours';

  SELECT COALESCE(jsonb_agg(x ORDER BY x.carrier_code), '[]'::jsonb) INTO v_carrier_health
  FROM (
    SELECT DISTINCT ON (carrier_code)
      carrier_code,
      status,
      response_time_ms,
      error_message,
      detected_at
    FROM public.carrier_health_logs
    ORDER BY carrier_code, detected_at DESC
  ) x;

  RETURN jsonb_build_object(
    'ai_total_24h', COALESCE(v_total, 0),
    'ai_errors_24h', COALESCE(v_errors, 0),
    'ai_quota_limited_24h', COALESCE(v_quota_exceeded, 0),
    'ai_success_rate', CASE WHEN COALESCE(v_total,0) = 0 THEN 100
        ELSE round((1 - COALESCE(v_errors,0)::numeric / v_total) * 100, 2) END,
    'carriers', COALESCE(v_carrier_health, '[]'::jsonb),
    'checked_at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_system_health() TO authenticated;

-- ---------------------------------------------------------------------
-- 6. RPC: get_admin_users_list() — THIẾU nhưng UI đang gọi (Users page hỏng).
--    DB THẬT: profiles(id,email,role,status,full_name,username,phone,...)
--             shop_members.role là TEXT (OWNER/MANAGER/STAFF/VIEWER)
--    CONTRACT UI (Users.jsx): trả MẢNG JSON user trực tiếp (KHÔNG bọc
--    {total,rows}); mỗi user có role='master_admin' khi SYSTEM_ADMIN
--    (UI so sánh === 'master_admin'); shops[] = {shop_id, shop_name, shop_role}.
--    p_role filter: lọc qua user_roles JOIN roles.code (profiles.role luôn
--    'member' nên KHÔNG lọc trên profiles.role).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_admin_users_list(
  p_search_text TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_role TEXT DEFAULT NULL,
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'ACCESS_DENIED: SYSTEM_ADMIN only.';
  END IF;

  SELECT COALESCE(jsonb_agg(x ORDER BY x.created_at DESC), '[]'::jsonb) INTO v_result
  FROM (
    SELECT p.id,
           p.email,
           p.full_name,
           p.username,
           p.phone,
           p.status,
           p.created_at,
           p.last_login,
           p.disabled_at,
           CASE WHEN EXISTS (
                  SELECT 1 FROM public.user_roles ur
                  JOIN public.roles r ON ur.role_id = r.id
                  WHERE ur.user_id = p.id AND r.code = 'SYSTEM_ADMIN'
                ) THEN 'master_admin'
                ELSE (
                  SELECT r.code
                  FROM public.user_roles ur
                  JOIN public.roles r ON ur.role_id = r.id
                  WHERE ur.user_id = p.id
                  ORDER BY CASE r.code
                    WHEN 'SUPPORT' THEN 1 WHEN 'SHOP_OWNER' THEN 2
                    WHEN 'SHOP_MANAGER' THEN 3 WHEN 'SHOP_STAFF' THEN 4
                    WHEN 'VIEWER' THEN 5 WHEN 'EXTENSION_USER' THEN 6
                    ELSE 7 END
                  LIMIT 1
                )
           END AS role,
           COALESCE((
             SELECT jsonb_agg(jsonb_build_object(
                      'shop_id', sm.shop_id,
                      'shop_name', s.name,
                      'shop_role', sm.role
                    ))
             FROM public.shop_members sm
             JOIN public.shops s ON s.id = sm.shop_id
             WHERE sm.user_id = p.id
               AND sm.removed_at IS NULL
               AND s.deleted_at IS NULL
           ), '[]'::jsonb) AS shops
    FROM public.profiles p
    WHERE (p_status IS NULL OR p.status = p_status)
      AND (p_role IS NULL OR EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = p.id AND r.code = p_role
          ))
      AND (p_search_text IS NULL OR p.email ILIKE '%' || p_search_text || '%'
           OR p.full_name ILIKE '%' || p_search_text || '%'
           OR p.username ILIKE '%' || p_search_text || '%'
           OR p.phone ILIKE '%' || p_search_text || '%')
    ORDER BY p.created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) x;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_users_list(TEXT, TEXT, TEXT, INT, INT) TO authenticated;

-- ---------------------------------------------------------------------
-- 7. get_admin_kpis() — REPLACE: token THẬT từ ai_usage_log
--    (bỏ ước lượng v_ai_requests_today * 150 của v32)
--    LƯU Ý: DB thật KHÔNG có bảng ai_usage_logs — chỉ có ai_usage_log
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_admin_kpis()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_shops_total INT;
  v_shops_active INT;
  v_shops_trial INT;
  v_shops_suspended INT;
  v_users_total INT;
  v_users_active INT;
  v_orders_total INT;
  v_orders_today INT;
  v_ai_requests_total INT;
  v_ai_requests_today INT;
  v_ai_tokens_today INT;
  v_ai_errors_today INT;
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'ACCESS_DENIED: Bạn không có quyền xem thống kê này.';
  END IF;

  SELECT count(*) INTO v_shops_total FROM public.shops;
  SELECT count(*) INTO v_shops_active FROM public.shops WHERE LOWER(status) = 'active';
  SELECT count(*) INTO v_shops_trial FROM public.shops WHERE LOWER(status) = 'trial';
  SELECT count(*) INTO v_shops_suspended FROM public.shops WHERE LOWER(status) = 'suspended';

  SELECT count(*) INTO v_users_total FROM public.profiles;
  SELECT count(*) INTO v_users_active FROM public.profiles WHERE status = 'active';

  SELECT count(*) INTO v_orders_total FROM public.orders WHERE deleted_at IS NULL;
  SELECT count(*) INTO v_orders_today FROM public.orders
    WHERE deleted_at IS NULL AND created_at >= date_trunc('day', now());

  SELECT count(*) INTO v_ai_requests_total FROM public.ai_usage_log;
  SELECT count(*) INTO v_ai_requests_today FROM public.ai_usage_log
    WHERE created_at >= date_trunc('day', now());
  SELECT COALESCE(sum(prompt_tokens + completion_tokens), 0) INTO v_ai_tokens_today
    FROM public.ai_usage_log WHERE created_at >= date_trunc('day', now());
  SELECT count(*) INTO v_ai_errors_today FROM public.ai_usage_log
    WHERE created_at >= date_trunc('day', now()) AND status != 'success';

  RETURN jsonb_build_object(
    'shops_total', COALESCE(v_shops_total, 0),
    'shops_active', COALESCE(v_shops_active, 0),
    'shops_trial', COALESCE(v_shops_trial, 0),
    'shops_suspended', COALESCE(v_shops_suspended, 0),
    'users_total', COALESCE(v_users_total, 0),
    'users_active', COALESCE(v_users_active, 0),
    'orders_total', COALESCE(v_orders_total, 0),
    'orders_today', COALESCE(v_orders_today, 0),
    'ai_requests_total', COALESCE(v_ai_requests_total, 0),
    'ai_requests_today', COALESCE(v_ai_requests_today, 0),
    'ai_tokens_today', COALESCE(v_ai_tokens_today, 0),
    'ai_errors_today', COALESCE(v_ai_errors_today, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_kpis() TO authenticated;

-- ---------------------------------------------------------------------
-- 8. RPC: insert_audit_log() — GHI AUDIT ADMIN (THIẾU).
--    Vì sao cần: audit_logs thật bị RLS chặn INSERT qua REST (probe 42501
--    "new row violates row-level security policy") — theo chuẩn v19 "mọi
--    ghi audit đi qua RPC SECURITY DEFINER". admin.repository.js hiện
--    INSERT thẳng admin_audit_logs (bảng không tồn tại) -> audit admin
--    luôn fail âm thầm. RPC này thay thế cho cả 2 lỗi đó.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.insert_audit_log(
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id TEXT DEFAULT NULL,
  p_details JSONB DEFAULT '{}'::jsonb,
  p_shop_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'ACCESS_DENIED: SYSTEM_ADMIN only.';
  END IF;

  INSERT INTO public.audit_logs (shop_id, user_id, action, entity_type, entity_id, details)
  VALUES (p_shop_id, auth.uid(), p_action, p_entity_type, p_entity_id, p_details)
  RETURNING jsonb_build_object('id', id, 'action', action, 'created_at', created_at)
  INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.insert_audit_log(TEXT, TEXT, TEXT, JSONB, UUID) TO authenticated;

-- ---------------------------------------------------------------------
-- GHI CHÚ KẾT QUẢ P0 (xác minh DB thật 2026-08-11 — KIỂM TRA LẦN 2):
--   * LƯU Ý PHƯƠNG PHÁP: probe RPC bằng body {} chỉ khớp hàm KHÔNG tham số
--     hoặc 1 tham số json/jsonb -> KHÔNG dùng để kết luận hàm có tham số
--     (lần 1 kết luận nhầm nhiều hàm "thiếu"). Lần 2 probe với đúng param:
--   * ĐÃ TỒN TẠI (không cần tạo): get_user_role(p_user_id) -> "SYSTEM_ADMIN"
--     cho admin, "SHOP_STAFF" cho staff; is_shop_member(UUID) -> boolean;
--     check_shop_member_or_admin(UUID); consume_ai_quota(UUID,...);
--     get_ai_budget(UUID); check_ai_rate_limit(UUID); owner_get_members(UUID);
--     create_order_event(...); get_system_config_value(p_key);
--     is_system_admin(); get_admin_kpis(); admin_get_system_metrics();
--     get_admin_shops_list(); admin_list_devices(); get_master_admin_shops();
--     get_my_extension_session().
--   * THẬT SỰ THIẾU (migration này tạo): resolve_dashboard_role(p_user_id),
--     get_shop_dashboard_stats(p_shop_id), get_system_health(),
--     get_admin_users_list(5 params — probe đủ param vẫn 404), và
--     insert_audit_log(...) (bảng audit_logs chặn INSERT REST — probe 42501).
--   * carrier_configs / customers / sync_outbox / activity_logs / settings
--     -> ĐÃ CÓ trong DB, KHÔNG cần migration; chỉ cần sửa UI code đọc bảng này.
--   * admin_audit_logs KHÔNG TỒN TẠI -> admin.repository.js phải gọi
--     insert_audit_log() (RPC mới ở phần 8), không INSERT thẳng REST.
--   * ai_usage_logs (số nhiều) KHÔNG TỒN TẠI -> mọi code/migration tham chiếu
--     phải dùng ai_usage_log (số ít).
--   * shops.status lẫn lộn 'active' (chữ thường) lẫn 'Active' (hoa đầu) ->
--     mọi filter status phải dùng LOWER(status).
--   * profiles.role LUÔN = 'member' -> role thật nằm ở user_roles JOIN roles
--     (codes: SYSTEM_ADMIN, SUPPORT, SHOP_OWNER, SHOP_MANAGER, SHOP_STAFF,
--     VIEWER, EXTENSION_USER); shop_members.role TEXT = OWNER/MANAGER/STAFF/
--     VIEWER (hoa). get_admin_users_list KHÔNG được lọc trên profiles.role.
--   * get_admin_users_list phải trả MẢNG JSON (Users.jsx gọi .filter/.map
--     trực tiếp trên kết quả), role='master_admin' khi SYSTEM_ADMIN, và
--     shops[] = {shop_id, shop_name, shop_role} (v29 cũ join sm.role_id —
--     cột KHÔNG tồn tại trong DB thật).
-- =========================================================================
