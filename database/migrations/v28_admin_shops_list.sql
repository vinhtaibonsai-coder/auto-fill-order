-- =================================================================================
-- v28_admin_shops_list.sql
-- Master Plan: PHASE 2 - Shops Management
-- =================================================================================

-- TẠO RPC get_admin_shops_list()
-- Gom dữ liệu từ shops, shop_quotas, shop_members, shop_devices để hiển thị Admin
CREATE OR REPLACE FUNCTION public.get_admin_shops_list()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Bỏ qua RLS để Admin có thể xem toàn bộ hệ thống
AS $$
DECLARE
    result JSONB;
BEGIN
    -- Kiểm tra quyền Admin bằng hàm chuẩn của hệ thống
    IF NOT public.is_system_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Requires Admin role';
    END IF;

    -- Query gom nhóm trả về JSON array
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', s.id,
            'name', s.name,
            'status', COALESCE(s.status, 'Active'),
            'created_at', s.created_at,
            'plan', COALESCE(sq.plan_name, 'FREE'),
            'ai_quota_limit', COALESCE(sq.ai_quota_limit, 100),
            'ai_quota_used', COALESCE(sq.ai_quota_used, 0),
            'users_count', COALESCE(sm.users_count, 0),
            'devices_count', COALESCE(sd.devices_count, 0)
        ) ORDER BY s.created_at DESC
    ), '[]'::jsonb)
    INTO result
    FROM public.shops s
    LEFT JOIN public.shop_quotas sq ON s.id = sq.shop_id
    LEFT JOIN (
        SELECT shop_id, COUNT(user_id) as users_count 
        FROM public.shop_members 
        GROUP BY shop_id
    ) sm ON s.id = sm.shop_id
    LEFT JOIN (
        SELECT shop_id, COUNT(id) as devices_count 
        FROM public.shop_devices 
        GROUP BY shop_id
    ) sd ON s.id = sd.shop_id;

    RETURN result;
END;
$$;
