-- =========================================================================
-- v32_admin_kpis_rpc.sql
-- Thêm hàm get_admin_kpis() để tính toán Overview Metrics cho Admin Dashboard
-- =========================================================================

CREATE OR REPLACE FUNCTION public.get_admin_kpis()
RETURNS JSONB
LANGUAGE plpgsql
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
    -- 1. Bảo mật: Chỉ cho phép SYSTEM_ADMIN
    IF NOT public.is_system_admin() THEN
        RAISE EXCEPTION 'ACCESS_DENIED: Bạn không có quyền xem thống kê này.';
    END IF;

    -- 2. Thống kê Shops
    SELECT count(*) INTO v_shops_total FROM public.shops;
    SELECT count(*) INTO v_shops_active FROM public.shops WHERE status = 'Active';
    SELECT count(*) INTO v_shops_trial FROM public.shops WHERE status = 'Trial';
    SELECT count(*) INTO v_shops_suspended FROM public.shops WHERE status = 'Suspended';

    -- 3. Thống kê Users
    SELECT count(*) INTO v_users_total FROM public.profiles;
    SELECT count(*) INTO v_users_active FROM public.profiles WHERE status = 'active';

    -- 4. Thống kê Orders
    SELECT count(*) INTO v_orders_total FROM public.orders;
    SELECT count(*) INTO v_orders_today FROM public.orders WHERE created_at >= date_trunc('day', now());

    -- 5. Thống kê AI
    SELECT count(*) INTO v_ai_requests_total FROM public.ai_usage_log;
    SELECT count(*) INTO v_ai_requests_today FROM public.ai_usage_log WHERE created_at >= date_trunc('day', now());
    SELECT count(*) INTO v_ai_errors_today FROM public.ai_usage_log WHERE created_at >= date_trunc('day', now()) AND status != 'success';
    
    -- MOCK Token count (nếu bảng chưa lưu số token chính xác)
    v_ai_tokens_today := v_ai_requests_today * 150;

    -- 6. Trả về JSONB
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
