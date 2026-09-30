-- =============================================================================
-- Migration Patch: Fix admin_get_data_quality_drilldown Column Carrier -> Platform
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_get_data_quality_drilldown(
    p_kpi_type TEXT,
    p_range TEXT DEFAULT '30d',
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
  v_from TIMESTAMPTZ;
  v_total INT := 0;
  v_records JSONB := '[]'::jsonb;
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'ACCESS_DENIED: SYSTEM_ADMIN only.';
  END IF;

  IF p_range = '7d' THEN
    v_from := now() - interval '7 days';
  ELSIF p_range = 'all' THEN
    v_from := '2020-01-01 00:00:00Z'::timestamptz;
  ELSE
    v_from := now() - interval '30 days';
  END IF;

  IF p_kpi_type = 'missing_tracking_code' THEN
    SELECT count(*) INTO v_total
    FROM public.submitted_orders
    WHERE (tracking_code IS NULL OR trim(tracking_code) = '') AND COALESCE(created_at, submitted_at, now()) >= v_from;

    SELECT COALESCE(jsonb_agg(r), '[]'::jsonb) INTO v_records
    FROM (
      SELECT
        s.id AS record_id,
        s.shop_id,
        COALESCE(sh.name, 'Shop #' || left(s.shop_id::text, 8)) AS shop_name,
        s.order_code,
        s.tracking_code,
        COALESCE(s.platform, 'vnpost') AS carrier,
        s.status,
        -- PII Masking
        regexp_replace(COALESCE(s.customer_name, s.name, 'Khách hàng'), '^(..)(.+)(.)$', '\1****\3') AS customer_name_masked,
        regexp_replace(COALESCE(s.phone, '0900000000'), '^(..)(.+)(.{4})$', '\1****\3') AS customer_phone_masked,
        'Đơn đã submit nhưng thiếu mã vận đơn' AS issue_description,
        COALESCE(s.created_at, s.submitted_at, now()) AS detected_at
      FROM public.submitted_orders s
      LEFT JOIN public.shops sh ON sh.id = s.shop_id
      WHERE (s.tracking_code IS NULL OR trim(s.tracking_code) = '') AND COALESCE(s.created_at, s.submitted_at, now()) >= v_from
      ORDER BY COALESCE(s.created_at, s.submitted_at, now()) DESC
      LIMIT p_limit OFFSET p_offset
    ) r;

  ELSIF p_kpi_type = 'invalid_duplicate_order_code' THEN
    WITH dupes AS (
      SELECT shop_id, order_code
      FROM public.submitted_orders
      WHERE order_code IS NOT NULL AND trim(order_code) != '' AND COALESCE(created_at, submitted_at, now()) >= v_from
      GROUP BY shop_id, order_code
      HAVING count(*) > 1
    )
    SELECT count(*) INTO v_total
    FROM public.submitted_orders s
    JOIN dupes d ON s.shop_id = d.shop_id AND s.order_code = d.order_code
    WHERE COALESCE(s.created_at, s.submitted_at, now()) >= v_from;

    SELECT COALESCE(jsonb_agg(r), '[]'::jsonb) INTO v_records
    FROM (
      WITH dupes AS (
        SELECT shop_id, order_code
        FROM public.submitted_orders
        WHERE order_code IS NOT NULL AND trim(order_code) != '' AND COALESCE(created_at, submitted_at, now()) >= v_from
        GROUP BY shop_id, order_code
        HAVING count(*) > 1
      )
      SELECT
        s.id AS record_id,
        s.shop_id,
        COALESCE(sh.name, 'Shop #' || left(s.shop_id::text, 8)) AS shop_name,
        s.order_code,
        s.tracking_code,
        COALESCE(s.platform, 'vnpost') AS carrier,
        s.status,
        regexp_replace(COALESCE(s.customer_name, s.name, 'Khách hàng'), '^(..)(.+)(.)$', '\1****\3') AS customer_name_masked,
        regexp_replace(COALESCE(s.phone, '0900000000'), '^(..)(.+)(.{4})$', '\1****\3') AS customer_phone_masked,
        'Mã đơn trùng lặp với đơn hàng khác trong cùng shop' AS issue_description,
        COALESCE(s.created_at, s.submitted_at, now()) AS detected_at
      FROM public.submitted_orders s
      JOIN dupes d ON s.shop_id = d.shop_id AND s.order_code = d.order_code
      LEFT JOIN public.shops sh ON sh.id = s.shop_id
      WHERE COALESCE(s.created_at, s.submitted_at, now()) >= v_from
      ORDER BY s.order_code, COALESCE(s.created_at, s.submitted_at, now()) DESC
      LIMIT p_limit OFFSET p_offset
    ) r;

  ELSIF p_kpi_type = 'stale_carrier_status' THEN
    SELECT count(*) INTO v_total
    FROM public.submitted_orders
    WHERE status NOT IN ('delivered', 'cancelled', 'returned')
      AND tracking_code IS NOT NULL AND trim(tracking_code) != ''
      AND COALESCE(updated_at, created_at, submitted_at, now()) < now() - interval '72 hours'
      AND COALESCE(created_at, submitted_at, now()) >= v_from;

    SELECT COALESCE(jsonb_agg(r), '[]'::jsonb) INTO v_records
    FROM (
      SELECT
        s.id AS record_id,
        s.shop_id,
        COALESCE(sh.name, 'Shop #' || left(s.shop_id::text, 8)) AS shop_name,
        s.order_code,
        s.tracking_code,
        COALESCE(s.platform, 'vnpost') AS carrier,
        s.status,
        regexp_replace(COALESCE(s.customer_name, s.name, 'Khách hàng'), '^(..)(.+)(.)$', '\1****\3') AS customer_name_masked,
        regexp_replace(COALESCE(s.phone, '0900000000'), '^(..)(.+)(.{4})$', '\1****\3') AS customer_phone_masked,
        'Đơn không có cập nhật trạng thái bưu cục > 72 giờ' AS issue_description,
        COALESCE(s.updated_at, s.created_at, s.submitted_at, now()) AS detected_at
      FROM public.submitted_orders s
      LEFT JOIN public.shops sh ON sh.id = s.shop_id
      WHERE s.status NOT IN ('delivered', 'cancelled', 'returned')
        AND s.tracking_code IS NOT NULL AND trim(s.tracking_code) != ''
        AND COALESCE(s.updated_at, s.created_at, s.submitted_at, now()) < now() - interval '72 hours'
        AND COALESCE(s.created_at, s.submitted_at, now()) >= v_from
      ORDER BY COALESCE(s.updated_at, s.created_at, s.submitted_at, now()) ASC
      LIMIT p_limit OFFSET p_offset
    ) r;

  ELSIF p_kpi_type = 'low_confidence_address' THEN
    BEGIN
      SELECT count(*) INTO v_total
      FROM public.orders
      WHERE deleted_at IS NULL AND (status IS NULL OR status = 'draft')
        AND (COALESCE(address_score, 100) < 70 OR COALESCE((metadata->>'confidence')::numeric, 1.0) < 0.7 OR (ward IS NULL AND district IS NULL))
        AND created_at >= v_from;

      SELECT COALESCE(jsonb_agg(r), '[]'::jsonb) INTO v_records
      FROM (
        SELECT
          o.id AS record_id,
          o.shop_id,
          COALESCE(sh.name, 'Shop #' || left(o.shop_id::text, 8)) AS shop_name,
          o.order_code,
          NULL AS tracking_code,
          'N/A' AS carrier,
          o.status,
          regexp_replace(COALESCE(o.customer_name, 'Khách hàng'), '^(..)(.+)(.)$', '\1****\3') AS customer_name_masked,
          regexp_replace(COALESCE(o.phone, '0900000000'), '^(..)(.+)(.{4})$', '\1****\3') AS customer_phone_masked,
          'Độ tin cậy bóc tách địa chỉ thấp (' || COALESCE(o.address_score, 50) || '/100)' AS issue_description,
          o.created_at AS detected_at
        FROM public.orders o
        LEFT JOIN public.shops sh ON sh.id = o.shop_id
        WHERE o.deleted_at IS NULL AND (o.status IS NULL OR o.status = 'draft')
          AND (COALESCE(o.address_score, 100) < 70 OR COALESCE((o.metadata->>'confidence')::numeric, 1.0) < 0.7 OR (o.ward IS NULL AND o.district IS NULL))
          AND o.created_at >= v_from
        ORDER BY o.created_at DESC
        LIMIT p_limit OFFSET p_offset
      ) r;
    EXCEPTION WHEN OTHERS THEN
      v_total := 0; v_records := '[]'::jsonb;
    END;

  ELSIF p_kpi_type = 'unmatched_payment' THEN
    BEGIN
      SELECT count(*) INTO v_total
      FROM public.payment_transactions
      WHERE (reconciliation_status IN ('unmatched', 'failed', 'duplicate')
             OR status = 'FAILED'
             OR (shop_id IS NULL AND status != 'CANCELLED'))
        AND created_at >= v_from;

      SELECT COALESCE(jsonb_agg(r), '[]'::jsonb) INTO v_records
      FROM (
        SELECT
          p.id AS record_id,
          p.shop_id,
          COALESCE(sh.name, 'Chưa xác định') AS shop_name,
          p.transaction_code AS order_code,
          p.order_invoice_number AS tracking_code,
          'PAYMENT' AS carrier,
          p.status,
          'Giao dịch ' || p.amount || 'đ' AS customer_name_masked,
          '09****0000' AS customer_phone_masked,
          'Giao dịch thanh toán chưa khớp shop hoặc thất bại (' || COALESCE(p.reconciliation_status, p.status) || ')' AS issue_description,
          p.created_at AS detected_at
        FROM public.payment_transactions p
        LEFT JOIN public.shops sh ON sh.id = p.shop_id
        WHERE (p.reconciliation_status IN ('unmatched', 'failed', 'duplicate')
               OR p.status = 'FAILED'
               OR (p.shop_id IS NULL AND p.status != 'CANCELLED'))
          AND p.created_at >= v_from
        ORDER BY p.created_at DESC
        LIMIT p_limit OFFSET p_offset
      ) r;
    EXCEPTION WHEN OTHERS THEN
      v_total := 0; v_records := '[]'::jsonb;
    END;
  END IF;

  RETURN jsonb_build_object(
    'kpi_type', p_kpi_type,
    'total', v_total,
    'records', v_records,
    'limit', p_limit,
    'offset', p_offset
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_data_quality_drilldown(TEXT, TEXT, INT, INT) TO authenticated, service_role;
