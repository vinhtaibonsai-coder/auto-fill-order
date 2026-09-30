-- =========================================================================
-- MIGRATION V101: FIX THỨ TỰ SẮP XẾP VÀ BẢO VỆ DỮ LIỆU KHÁCH HÀNG TOÀN CỤC
-- Global Orders Explorer: Carrier Audit & Multi-tenant Privacy Enforcement
-- =========================================================================
-- 1. Khắc phục lỗi đơn mới không cập nhật:
--    - Sắp xếp giảm dần theo thời gian gửi (ORDER BY COALESCE(o.submitted_at, o.created_at, now()) DESC).
--    - Đổi kiểu trả về id từ UUID sang TEXT để tương thích hoàn toàn với định danh chuỗi (sub_...).
-- 2. Tuân thủ nguyên tắc bảo mật và cô lập dữ liệu khách hàng (Tenant PII Isolation):
--    - Loại bỏ hoàn toàn phone, customer_name, full address chi tiết khỏi kết quả trả về của RPC toàn cục.
--    - Chỉ trích xuất destination_region (Tỉnh/Thành phố nhận hàng) để phục vụ kiểm toán điều phối bưu cục.
--    - Bộ lọc tìm kiếm toàn cục chỉ tìm theo Mã đơn (order_code), Mã vận đơn (tracking_code), Tên Shop (shop_name).
-- =========================================================================

-- Xóa function cũ để thay đổi signature bảng kết quả trả về
DROP FUNCTION IF EXISTS public.admin_get_global_orders(TEXT, UUID, TEXT, TEXT, INT, INT);

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
      (p_shop_id IS NULL OR o.shop_id = p_shop_id)
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
