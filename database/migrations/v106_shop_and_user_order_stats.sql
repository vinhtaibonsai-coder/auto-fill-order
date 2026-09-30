-- =====================================================================
-- MIGRATION v106: SHOP & USER ORDER EXTRACTION AND AI USAGE STATS
-- Thống kê số lần bóc tách đơn và sử dụng AI theo từng nhân viên & từng Shop
-- =====================================================================

-- 1. Cập nhật RPC get_ai_models_usage_stats trả về cả total_calls lẫn total_requests
CREATE OR REPLACE FUNCTION public.get_ai_models_usage_stats(p_shop_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_agg(
        jsonb_build_object(
            'model', COALESCE(model, 'unknown'),
            'total_calls', total_count,
            'total_requests', total_count,
            'calls_today', today_count,
            'today_requests', today_count,
            'total_tokens', (total_p_tokens + total_c_tokens),
            'total_prompt_tokens', total_p_tokens,
            'total_completion_tokens', total_c_tokens,
            'last_used_at', last_used
        ) ORDER BY total_count DESC
    )
    INTO v_result
    FROM (
        SELECT 
            COALESCE(model, 'unknown') AS model,
            COUNT(*)::INT AS total_count,
            COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)::INT AS today_count,
            COALESCE(SUM(prompt_tokens), 0)::BIGINT AS total_p_tokens,
            COALESCE(SUM(completion_tokens), 0)::BIGINT AS total_c_tokens,
            MAX(created_at) AS last_used
        FROM public.ai_usage_log
        WHERE (p_shop_id IS NULL OR shop_id = p_shop_id)
          AND (status = 'success' OR status IS NULL OR status ILIKE 'success' OR status = 'ok')
        GROUP BY COALESCE(model, 'unknown')
    ) sub;

    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_ai_models_usage_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ai_models_usage_stats(UUID) TO service_role;

-- 1b. RPC ghi nhận lượt sử dụng AI vào ai_usage_log (Dùng khi test key, bóc tách đơn hoặc gọi AI)
CREATE OR REPLACE FUNCTION public.record_ai_usage_log(
    p_model TEXT,
    p_request_type TEXT DEFAULT 'parse',
    p_shop_id UUID DEFAULT NULL,
    p_tokens INT DEFAULT 20
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.ai_usage_log (
        shop_id,
        user_id,
        model,
        request_type,
        status,
        prompt_tokens,
        completion_tokens,
        created_at
    ) VALUES (
        p_shop_id,
        auth.uid(),
        COALESCE(p_model, 'gemini-3.6-flash'),
        COALESCE(p_request_type, 'parse'),
        'success',
        p_tokens,
        p_tokens,
        NOW()
    );
    RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_ai_usage_log(TEXT, TEXT, UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_ai_usage_log(TEXT, TEXT, UUID, INT) TO service_role;

-- Bổ sung Policy INSERT cho ai_usage_log
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'ai_usage_log' 
          AND policyname = 'allow_authenticated_insert_ai_usage'
    ) THEN
        CREATE POLICY "allow_authenticated_insert_ai_usage" 
        ON public.ai_usage_log 
        FOR INSERT 
        WITH CHECK (auth.role() = 'authenticated');
    END IF;
END $$;

-- 2. Cập nhật RPC get_admin_shops_list trả về chi tiết lượt dùng AI hôm nay & tổng đơn bóc tách
CREATE OR REPLACE FUNCTION public.get_admin_shops_list()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result JSONB;
BEGIN
    IF NOT public.is_system_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Requires Admin role';
    END IF;

    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', s.id,
            'name', s.name,
            'status', COALESCE(s.status, 'Active'),
            'created_at', s.created_at,
            'plan', COALESCE(sq.plan_name, 'FREE'),
            'daily_ai_limit', COALESCE(sq.daily_ai_limit, sq.ai_quota_limit, 500),
            'ai_quota_limit', COALESCE(sq.daily_ai_limit, sq.ai_quota_limit, 500),
            'ai_used_today', COALESCE(au.ai_today, 0),
            'ai_used_total', COALESCE(au.ai_total, 0),
            'ai_quota_used', COALESCE(au.ai_today, sq.ai_quota_used, 0),
            'orders_count', COALESCE(ord.orders_total, 0),
            'orders_today', COALESCE(ord.orders_today, 0),
            'users_count', COALESCE(sm.users_count, 0),
            'devices_count', COALESCE(sd.devices_count, 0)
        ) ORDER BY s.created_at DESC
    ), '[]'::jsonb)
    INTO result
    FROM public.shops s
    LEFT JOIN public.shop_quotas sq ON s.id = sq.shop_id
    LEFT JOIN (
        SELECT shop_id, 
               COUNT(*)::INT as ai_total,
               COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)::INT as ai_today
        FROM public.ai_usage_log
        GROUP BY shop_id
    ) au ON s.id = au.shop_id
    LEFT JOIN (
        SELECT shop_id,
               COUNT(*)::INT as orders_total,
               COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)::INT as orders_today
        FROM public.submitted_orders
        WHERE deleted_at IS NULL
        GROUP BY shop_id
    ) ord ON s.id = ord.shop_id
    LEFT JOIN (
        SELECT shop_id, COUNT(user_id)::INT as users_count 
        FROM public.shop_members 
        WHERE removed_at IS NULL
        GROUP BY shop_id
    ) sm ON s.id = sm.shop_id
    LEFT JOIN (
        SELECT shop_id, COUNT(id)::INT as devices_count 
        FROM public.extension_devices 
        WHERE revoked = FALSE
        GROUP BY shop_id
    ) sd ON s.id = sd.shop_id;

    RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_shops_list() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_shops_list() TO service_role;

-- 3. Cập nhật RPC get_admin_users_list trả về số lần bóc tách đơn và số lượt dùng AI của từng user
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
SET search_path = public
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
           ), '[]'::jsonb) AS shops,
           -- Thống kê số lần bóc tách đơn (tổng & hôm nay)
           COALESCE((
             SELECT COUNT(*)::INT 
             FROM public.submitted_orders so 
             WHERE (so.submitted_by = p.id OR so.user_id = p.id)
               AND so.deleted_at IS NULL
           ), 0) AS orders_count,
           COALESCE((
             SELECT COUNT(*)::INT 
             FROM public.submitted_orders so 
             WHERE (so.submitted_by = p.id OR so.user_id = p.id)
               AND so.created_at >= CURRENT_DATE
               AND so.deleted_at IS NULL
           ), 0) AS orders_today,
           -- Thống kê số lần gọi AI (tổng & hôm nay)
           COALESCE((
             SELECT COUNT(*)::INT 
             FROM public.ai_usage_log au 
             WHERE au.user_id = p.id
           ), 0) AS ai_usage_count,
           COALESCE((
             SELECT COUNT(*)::INT 
             FROM public.ai_usage_log au 
             WHERE au.user_id = p.id
               AND au.created_at >= CURRENT_DATE
           ), 0) AS ai_usage_today
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
GRANT EXECUTE ON FUNCTION public.get_admin_users_list(TEXT, TEXT, TEXT, INT, INT) TO service_role;

-- 4. RPC get_shop_360_stats lấy toàn diện chỉ số của 1 Shop cho Admin
CREATE OR REPLACE FUNCTION public.get_shop_360_stats(p_shop_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result JSONB;
    v_quota_limit INT := 500;
    v_ai_today INT := 0;
    v_ai_total INT := 0;
    v_orders_today INT := 0;
    v_orders_total INT := 0;
    v_wallet NUMERIC := 0;
    v_recent_orders JSONB := '[]'::jsonb;
BEGIN
    IF NOT public.is_system_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Requires Admin role';
    END IF;

    -- 1. Lấy quota & ví
    SELECT 
        COALESCE(sq.daily_ai_limit, sq.ai_quota_limit, 500),
        COALESCE(s.wallet_balance, s.balance, 0)
    INTO v_quota_limit, v_wallet
    FROM public.shops s
    LEFT JOIN public.shop_quotas sq ON sq.shop_id = s.id
    WHERE s.id = p_shop_id;

    -- 2. Thống kê AI
    SELECT 
        COUNT(*)::INT,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)::INT
    INTO v_ai_total, v_ai_today
    FROM public.ai_usage_log
    WHERE shop_id = p_shop_id;

    -- 3. Thống kê Đơn bóc tách
    SELECT 
        COUNT(*)::INT,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)::INT
    INTO v_orders_total, v_orders_today
    FROM public.submitted_orders
    WHERE shop_id = p_shop_id AND deleted_at IS NULL;

    -- 4. Lấy 30 đơn gần nhất
    SELECT COALESCE(jsonb_agg(ord ORDER BY ord.created_at DESC), '[]'::jsonb)
    INTO v_recent_orders
    FROM (
        SELECT id, order_code, tracking_code, 
               COALESCE(customer_name, name) AS customer_name,
               phone, address, cod_amount, status, staff_name,
               created_at, submitted_at
        FROM public.submitted_orders
        WHERE shop_id = p_shop_id AND deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT 30
    ) ord;

    v_result := jsonb_build_object(
        'shop_id', p_shop_id,
        'ai_quota_limit', v_quota_limit,
        'ai_quota_used_today', v_ai_today,
        'ai_used_total', v_ai_total,
        'orders_count', v_orders_total,
        'orders_today', v_orders_today,
        'wallet_balance', v_wallet,
        'recent_orders', v_recent_orders
    );

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_shop_360_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_shop_360_stats(UUID) TO service_role;

-- 5. Đảm bảo cấu trúc cột của submitted_orders tương thích mọi phiên bản
ALTER TABLE public.submitted_orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.submitted_orders ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.submitted_orders ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE public.submitted_orders ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'AUTO_FILL';
ALTER TABLE public.submitted_orders ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'vnpost';
ALTER TABLE public.submitted_orders ADD COLUMN IF NOT EXISTS device_name TEXT;
ALTER TABLE public.submitted_orders ADD COLUMN IF NOT EXISTS staff_name TEXT;
ALTER TABLE public.submitted_orders ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 6. RPC admin_get_global_orders phục vụ Tra Cứu Đơn Hàng Toàn Cục
CREATE OR REPLACE FUNCTION public.admin_get_global_orders(
  p_search TEXT DEFAULT NULL,
  p_shop_id UUID DEFAULT NULL,
  p_platform TEXT DEFAULT NULL,
  p_source TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id TEXT,
  shop_id UUID,
  shop_name TEXT,
  shop_code TEXT,
  order_code TEXT,
  tracking_code TEXT,
  destination_region TEXT,
  cod_amount NUMERIC,
  platform TEXT,
  status TEXT,
  source TEXT,
  device_name TEXT,
  created_at TIMESTAMPTZ,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_search TEXT := NULL;
BEGIN
  IF NOT (public.is_system_admin() OR EXISTS (
    SELECT 1 FROM public.user_roles ur 
    JOIN public.roles r ON ur.role_id = r.id 
    WHERE ur.user_id = auth.uid() AND r.code IN ('SYSTEM_ADMIN', 'SUPER_ADMIN', 'SUPPORT', 'SUPPORT_ADMIN', 'FINANCE_ADMIN', 'SUPPORT_STAFF', 'STAFF')
  )) THEN
    RAISE EXCEPTION 'Access denied: Requires admin or support access.';
  END IF;

  IF p_search IS NOT NULL AND TRIM(p_search) <> '' THEN
    v_search := '%' || TRIM(p_search) || '%';
  END IF;

  RETURN QUERY
  WITH filtered_orders AS (
    SELECT
      o.id::TEXT AS id,
      o.shop_id,
      COALESCE(s.name, 'Shop') AS shop_name,
      COALESCE(s.shop_code, '') AS shop_code,
      COALESCE(o.order_code, '') AS order_code,
      COALESCE(o.tracking_code, '') AS tracking_code,
      COALESCE(
        NULLIF(TRIM(SPLIT_PART(o.address, ',', -1)), ''),
        'Chưa rõ'
      ) AS destination_region,
      COALESCE(o.cod_amount, 0) AS cod_amount,
      COALESCE(o.platform, 'vnpost') AS platform,
      COALESCE(o.status, 'pending') AS status,
      COALESCE(o.source, 'AUTO_FILL') AS source,
      COALESCE(o.device_name, '') AS device_name,
      COALESCE(o.submitted_at, o.created_at, now()) AS created_at
    FROM public.submitted_orders o
    LEFT JOIN public.shops s ON s.id = o.shop_id
    WHERE
      o.deleted_at IS NULL
      AND (p_shop_id IS NULL OR o.shop_id = p_shop_id)
      AND (p_platform IS NULL OR o.platform ILIKE p_platform)
      AND (p_source IS NULL OR o.source ILIKE p_source)
      AND (
        v_search IS NULL
        OR o.order_code ILIKE v_search
        OR o.tracking_code ILIKE v_search
        OR s.name ILIKE v_search
        OR s.shop_code ILIKE v_search
      )
  ),
  counted AS (
    SELECT count(*)::BIGINT AS total FROM filtered_orders
  )
  SELECT
    fo.id,
    fo.shop_id,
    fo.shop_name,
    fo.shop_code,
    fo.order_code,
    fo.tracking_code,
    fo.destination_region,
    fo.cod_amount,
    fo.platform,
    fo.status,
    fo.source,
    fo.device_name,
    fo.created_at,
    c.total AS total_count
  FROM filtered_orders fo
  CROSS JOIN counted c
  ORDER BY fo.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_global_orders(TEXT, UUID, TEXT, TEXT, INT, INT) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

