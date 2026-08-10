-- =================================================================================
-- v29_admin_users_list.sql
-- Master Plan: PHASE 3 - Users Management
-- Sửa lỗi: function không tạo được do profiles.role không tồn tại,
--         đồng thời trả về JSONB để PostgREST dễ parse.
-- =================================================================================

CREATE OR REPLACE FUNCTION public.get_admin_users_list(
  p_search_text text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_role text DEFAULT NULL,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_total bigint;
  v_result jsonb;
BEGIN
  -- 1. Bảo mật: Chỉ cho phép SYSTEM_ADMIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'Access denied. SYSTEM_ADMIN only.';
  END IF;

  -- 2. Gom dữ liệu trả về mảng JSON
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'email', p.email,
      'full_name', p.full_name,
      'status', p.status,
      'created_at', p.created_at,
      'last_login', p.last_login,
      'role', (
         -- Lấy role cao nhất hoặc đầu tiên của user này từ user_roles (nếu có)
         SELECT r.code 
         FROM public.user_roles ur 
         JOIN public.roles r ON ur.role_id = r.id 
         WHERE ur.user_id = p.id 
         LIMIT 1
      ),
      'shops', COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'shop_id', sm.shop_id,
              'shop_name', s.name,
              'shop_role', r.code
            )
          )
          FROM public.shop_members sm
          JOIN public.shops s ON s.id = sm.shop_id
          JOIN public.roles r ON r.id = sm.role_id
          WHERE sm.user_id = p.id
        ),
        '[]'::jsonb
      )
    ) ORDER BY p.created_at DESC
  ), '[]'::jsonb)
  INTO v_result
  FROM public.profiles p
  WHERE (p_search_text IS NULL OR p.email ILIKE '%' || p_search_text || '%' OR p.full_name ILIKE '%' || p_search_text || '%')
    AND (p_status IS NULL OR p.status = p_status)
    -- Nếu p_role không null, check xem user có role đó không (ở bảng user_roles)
    AND (p_role IS NULL OR EXISTS (
        SELECT 1 FROM public.user_roles ur 
        JOIN public.roles r ON ur.role_id = r.id 
        WHERE ur.user_id = p.id AND r.code = p_role
    ))
  LIMIT p_limit
  OFFSET p_offset;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_users_list(text, text, text, integer, integer) TO authenticated;
