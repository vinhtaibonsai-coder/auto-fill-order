-- =========================================================================
-- MIGRATION v100: MINE HISTORICAL ORDERS & CUSTOMERS TO LEARNING KB
-- Tự động khai phá toàn bộ dữ liệu đơn gửi lịch sử (submitted_orders)
-- và khách hàng (customers) để nạp vào hàng đợi học máy phục vụ người dùng duyệt.
-- =========================================================================

-- 1. Cho phép shop_id có thể NULL trong shop_learning_kb đối với các bài học toàn cầu hoặc đơn cũ
ALTER TABLE public.shop_learning_kb 
  ALTER COLUMN shop_id DROP NOT NULL;

ALTER TABLE public.shop_learning_kb 
  ADD COLUMN IF NOT EXISTS is_global BOOLEAN DEFAULT FALSE;

-- Cập nhật RLS Policies cho shop_learning_kb để hỗ trợ tri thức toàn cầu
DROP POLICY IF EXISTS "Shop members read learning kb" ON public.shop_learning_kb;
CREATE POLICY "Shop members read learning kb" ON public.shop_learning_kb
  FOR SELECT USING (
    (shop_id IS NOT NULL AND public.is_shop_member(shop_id))
    OR is_global = TRUE
    OR shop_id IS NULL
    OR public.is_system_admin()
  );

-- 2. Procedure RPC: Khai phá dữ liệu đơn hàng & khách hàng lịch sử
CREATE OR REPLACE FUNCTION public.mine_historical_orders_to_learning_kb(
  p_shop_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_inserted_addresses INT := 0;
  v_inserted_customers INT := 0;
  v_total_orders_scanned INT := 0;
BEGIN
  -- 1. Kiểm tra quyền thực thi: System Admin hoặc Shop Member của p_shop_id
  v_is_admin := public.is_system_admin();
  IF NOT v_is_admin THEN
    IF p_shop_id IS NULL THEN
      RAISE EXCEPTION 'Chỉ System Admin mới có quyền khai phá toàn bộ hệ thống.';
    ELSIF NOT public.is_shop_member(p_shop_id) THEN
      RAISE EXCEPTION 'Bạn không có quyền truy cập dữ liệu của Shop này.';
    END IF;
  END IF;

  -- 2. Kiểm tra shop mục tiêu
  IF p_shop_id IS NULL THEN
    RAISE EXCEPTION 'Vui lòng chỉ định shop_id cụ thể để khai phá dữ liệu.';
  END IF;

  -- 3. Đếm tổng số đơn gửi sẽ được quét (chỉ thuộc shop hiện tại, không quét orphan)
  SELECT COUNT(*) INTO v_total_orders_scanned
  FROM public.submitted_orders o
  WHERE o.shop_id = p_shop_id
    AND o.shop_id IS NOT NULL
    AND o.address IS NOT NULL
    AND LENGTH(TRIM(o.address)) >= 6
    AND LOWER(TRIM(o.address)) NOT LIKE '%điện bàn đông%'
    AND LOWER(TRIM(o.address)) NOT IN ('không tìm thấy', 'null', 'chưa có', 'địa chỉ');

  -- 4. Khai phá Địa chỉ từ submitted_orders thuộc đúng Shop
  WITH aggregated_orders AS (
    SELECT 
      o.shop_id AS resolved_shop_id,
      'address_raw'::TEXT AS category,
      TRIM(o.address) AS raw_key,
      jsonb_build_object(
        'fullAddress', TRIM(o.address),
        'source', 'historical_submitted_orders',
        'sampleCustomerName', (ARRAY_AGG(o.customer_name ORDER BY o.submitted_at DESC))[1],
        'samplePhone', (ARRAY_AGG(o.phone ORDER BY o.submitted_at DESC))[1]
      ) AS normalized_value,
      COUNT(*)::INT AS hit_count,
      MAX(COALESCE(o.submitted_at, now())) AS last_used_at
    FROM public.submitted_orders o
    WHERE o.shop_id = p_shop_id
      AND o.shop_id IS NOT NULL
      AND o.address IS NOT NULL
      AND LENGTH(TRIM(o.address)) >= 6
      AND LOWER(TRIM(o.address)) NOT IN ('không tìm thấy', 'null', 'chưa có', 'địa chỉ')
      AND LOWER(TRIM(o.address)) NOT LIKE '%điện bàn đông%'
      AND NOT EXISTS (
        SELECT 1 FROM public.shops s
        WHERE s.id = o.shop_id
          AND (
            (s.sender_address IS NOT NULL AND LENGTH(TRIM(s.sender_address)) >= 5 AND LOWER(TRIM(o.address)) = LOWER(TRIM(s.sender_address)))
            OR (s.sender_ward IS NOT NULL AND s.sender_province IS NOT NULL AND LOWER(TRIM(o.address)) LIKE '%' || LOWER(TRIM(s.sender_ward)) || '%' AND LOWER(TRIM(o.address)) LIKE '%' || LOWER(TRIM(s.sender_province)) || '%' AND LENGTH(TRIM(o.address)) <= 80)
            OR (s.sender_name IS NOT NULL AND LENGTH(TRIM(s.sender_name)) >= 3 AND LOWER(TRIM(o.address)) LIKE '%' || LOWER(TRIM(s.sender_name)) || '%')
          )
      )
    GROUP BY 
      o.shop_id,
      TRIM(o.address)
  ),
  ins_addr AS (
    INSERT INTO public.shop_learning_kb (
      shop_id,
      category,
      raw_key,
      normalized_value,
      confidence,
      hit_count,
      last_used_at,
      created_at,
      is_global
    )
    SELECT 
      ao.resolved_shop_id,
      ao.category,
      ao.raw_key,
      ao.normalized_value,
      90 AS confidence,
      ao.hit_count,
      ao.last_used_at,
      now(),
      (ao.resolved_shop_id IS NULL) AS is_global
    FROM aggregated_orders ao
    JOIN public.shops sh ON sh.id = ao.resolved_shop_id
    WHERE ao.raw_key IS NOT NULL AND ao.raw_key != ''
    ON CONFLICT (shop_id, category, raw_key)
    DO UPDATE SET
      hit_count = GREATEST(public.shop_learning_kb.hit_count, EXCLUDED.hit_count),
      last_used_at = GREATEST(public.shop_learning_kb.last_used_at, EXCLUDED.last_used_at)
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_inserted_addresses FROM ins_addr;

  -- Dọn dẹp các tri thức bị nhiễm địa chỉ kho gửi trong bảng shop_learning_kb
  DELETE FROM public.shop_learning_kb
  WHERE category = 'address_raw'
    AND (
      LOWER(raw_key) LIKE '%điện bàn đông%'
      OR EXISTS (
        SELECT 1 FROM public.shops s
        WHERE s.id = shop_learning_kb.shop_id
          AND (
            (s.sender_address IS NOT NULL AND LENGTH(TRIM(s.sender_address)) >= 5 AND LOWER(TRIM(raw_key)) = LOWER(TRIM(s.sender_address)))
            OR (s.sender_ward IS NOT NULL AND s.sender_province IS NOT NULL AND LOWER(TRIM(raw_key)) LIKE '%' || LOWER(TRIM(s.sender_ward)) || '%' AND LOWER(TRIM(raw_key)) LIKE '%' || LOWER(TRIM(s.sender_province)) || '%' AND LENGTH(TRIM(raw_key)) <= 80)
            OR (s.sender_name IS NOT NULL AND LENGTH(TRIM(s.sender_name)) >= 3 AND LOWER(TRIM(raw_key)) LIKE '%' || LOWER(TRIM(s.sender_name)) || '%')
          )
      )
    );

  -- 5. Khai phá Khách hàng & SĐT từ bảng customers của đúng Shop
  WITH clean_customers AS (
    SELECT 
      c.shop_id AS resolved_shop_id,
      'customer_phone'::TEXT AS category,
      REGEXP_REPLACE(c.phone, '\D', '', 'g') AS clean_phone,
      jsonb_build_object(
        'name', TRIM(c.name),
        'phone', REGEXP_REPLACE(c.phone, '\D', '', 'g'),
        'address', TRIM(COALESCE(c.address, '')),
        'source', 'historical_customers'
      ) AS normalized_value,
      MAX(COALESCE(c.created_at, now())) AS last_used_at
    FROM public.customers c
    WHERE c.shop_id = p_shop_id
      AND c.shop_id IS NOT NULL
      AND c.phone IS NOT NULL
      AND LENGTH(REGEXP_REPLACE(c.phone, '\D', '', 'g')) >= 9
    GROUP BY 
      c.shop_id,
      REGEXP_REPLACE(c.phone, '\D', '', 'g'), 
      TRIM(c.name), 
      TRIM(COALESCE(c.address, ''))
  ),
  ins_cust AS (
    INSERT INTO public.shop_learning_kb (
      shop_id,
      category,
      raw_key,
      normalized_value,
      confidence,
      hit_count,
      last_used_at,
      created_at,
      is_global
    )
    SELECT 
      cc.resolved_shop_id,
      cc.category,
      cc.clean_phone,
      cc.normalized_value,
      95 AS confidence,
      1 AS hit_count,
      cc.last_used_at,
      now(),
      (cc.resolved_shop_id IS NULL) AS is_global
    FROM clean_customers cc
    JOIN public.shops sh ON sh.id = cc.resolved_shop_id
    WHERE cc.clean_phone IS NOT NULL AND cc.clean_phone != ''
    ON CONFLICT (shop_id, category, raw_key)
    DO UPDATE SET
      last_used_at = GREATEST(public.shop_learning_kb.last_used_at, EXCLUDED.last_used_at)
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_inserted_customers FROM ins_cust;

  RETURN jsonb_build_object(
    'success', true,
    'total_orders_scanned', v_total_orders_scanned,
    'learned_addresses_count', v_inserted_addresses,
    'learned_customers_count', v_inserted_customers,
    'target_shop_id', p_shop_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.mine_historical_orders_to_learning_kb(UUID) TO authenticated, service_role;

-- 3. Procedure RPC: Phê duyệt hàng loạt quy tắc toàn cầu (Batch Promote)
CREATE OR REPLACE FUNCTION public.admin_promote_batch_global_aliases(
  p_entries JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item JSONB;
  v_count INT := 0;
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'Access denied: System Admin required';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_entries)
  LOOP
    IF (v_item->>'raw_key') IS NOT NULL AND TRIM(v_item->>'raw_key') != '' 
       AND (v_item->>'mapping') IS NOT NULL AND TRIM(v_item->>'mapping') != '' THEN
      INSERT INTO public.shop_address_aliases (
        shop_id,
        original,
        mapping,
        is_global,
        created_by,
        created_at
      )
      VALUES (
        NULL,
        LOWER(TRIM(v_item->>'raw_key')),
        TRIM(v_item->>'mapping'),
        TRUE,
        auth.uid(),
        now()
      )
      ON CONFLICT (LOWER(TRIM(original))) WHERE (shop_id IS NULL OR is_global = TRUE)
      DO UPDATE SET
        mapping = EXCLUDED.mapping,
        is_global = TRUE,
        created_at = now();

      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'promoted_count', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_promote_batch_global_aliases(JSONB) TO authenticated, service_role;

