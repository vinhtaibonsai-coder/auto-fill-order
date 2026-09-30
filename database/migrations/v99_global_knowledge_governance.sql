-- =========================================================================
-- MIGRATION v99: GLOBAL KNOWLEDGE GOVERNANCE & CROSS-SHOP LEARNING
-- Cho phép Admin duyệt các bài học địa chỉ phổ biến từ các shop thành
-- Từ Điển Toàn Hệ Thống (Universal / Global Aliases) áp dụng cho mọi Shop.
-- =========================================================================

-- 1. Cập nhật bảng shop_address_aliases để hỗ trợ quy tắc Toàn Cầu (Global)
ALTER TABLE public.shop_address_aliases 
  ALTER COLUMN shop_id DROP NOT NULL;

ALTER TABLE public.shop_address_aliases
  ADD COLUMN IF NOT EXISTS is_global BOOLEAN DEFAULT FALSE;

-- Tạo index độc nhất cho các từ khóa toàn cầu (tránh trùng lặp từ khóa Global)
CREATE UNIQUE INDEX IF NOT EXISTS uq_global_address_alias 
  ON public.shop_address_aliases (LOWER(TRIM(original))) 
  WHERE (shop_id IS NULL OR is_global = TRUE);

-- 2. Cập nhật RLS Policies cho shop_address_aliases
DROP POLICY IF EXISTS "Shop members read aliases" ON public.shop_address_aliases;
CREATE POLICY "Shop members read aliases" ON public.shop_address_aliases
  FOR SELECT USING (
    (shop_id IS NOT NULL AND public.is_shop_member(shop_id))
    OR is_global = TRUE
    OR shop_id IS NULL
    OR public.is_system_admin()
  );

DROP POLICY IF EXISTS "Shop members insert aliases" ON public.shop_address_aliases;
CREATE POLICY "Shop members insert aliases" ON public.shop_address_aliases
  FOR INSERT WITH CHECK (
    (public.is_system_admin() AND (is_global = TRUE OR shop_id IS NULL))
    OR (shop_id IS NOT NULL AND public.is_shop_member(shop_id) AND (is_global IS FALSE OR is_global IS NULL))
  );

DROP POLICY IF EXISTS "Shop members update aliases" ON public.shop_address_aliases;
CREATE POLICY "Shop members update aliases" ON public.shop_address_aliases
  FOR UPDATE USING (
    public.is_system_admin()
    OR (shop_id IS NOT NULL AND public.is_shop_member(shop_id) AND (is_global IS FALSE OR is_global IS NULL))
  );

DROP POLICY IF EXISTS "Shop members delete aliases" ON public.shop_address_aliases;
CREATE POLICY "Shop members delete aliases" ON public.shop_address_aliases
  FOR DELETE USING (
    public.is_system_admin()
    OR (shop_id IS NOT NULL AND public.is_shop_member(shop_id) AND (is_global IS FALSE OR is_global IS NULL))
  );

-- 3. RPC: Lấy danh sách ứng viên học máy để Admin duyệt (Candidate Mining)
-- Gom nhóm theo từ khóa gốc, tính số lượng shop cùng dùng và độ tin cậy trung bình
CREATE OR REPLACE FUNCTION public.get_admin_learning_candidates(
  p_limit INT DEFAULT 50
)
RETURNS TABLE (
  raw_key TEXT,
  sample_normalized_value JSONB,
  shop_count INT,
  total_hits INT,
  avg_confidence NUMERIC,
  last_seen_at TIMESTAMPTZ,
  is_promoted BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Chỉ System Admin mới có quyền truy cập
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'Access denied: System Admin required';
  END IF;

  RETURN QUERY
  WITH grouped AS (
    SELECT 
      LOWER(TRIM(kb.raw_key)) AS g_raw_key,
      (ARRAY_AGG(kb.normalized_value ORDER BY kb.confidence DESC, kb.hit_count DESC))[1] AS g_sample_val,
      COUNT(DISTINCT kb.shop_id)::INT AS g_shop_count,
      SUM(COALESCE(kb.hit_count, 1))::INT AS g_total_hits,
      ROUND(AVG(COALESCE(kb.confidence, 90)), 1)::NUMERIC AS g_avg_confidence,
      MAX(kb.last_used_at) AS g_last_seen
    FROM public.shop_learning_kb kb
    WHERE kb.category = 'address_raw'
      AND COALESCE(kb.confidence, 0) >= 70
    GROUP BY LOWER(TRIM(kb.raw_key))
  )
  SELECT 
    g.g_raw_key AS raw_key,
    g.g_sample_val AS sample_normalized_value,
    g.g_shop_count AS shop_count,
    g.g_total_hits AS total_hits,
    g.g_avg_confidence AS avg_confidence,
    g.g_last_seen AS last_seen_at,
    EXISTS (
      SELECT 1 FROM public.shop_address_aliases a
      WHERE (a.shop_id IS NULL OR a.is_global = TRUE)
        AND LOWER(TRIM(a.original)) = g.g_raw_key
    ) AS is_promoted
  FROM grouped g
  ORDER BY is_promoted ASC, g.g_shop_count DESC, g.g_total_hits DESC
  LIMIT LEAST(p_limit, 200);
END;
$$;

-- 4. RPC: Admin Phê duyệt 1-Click thành Từ điển Toàn Hệ Thống (Promote to Global)
CREATE OR REPLACE FUNCTION public.admin_promote_to_global_alias(
  p_raw_key TEXT,
  p_mapping TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_normalized_key TEXT;
  v_result_id UUID;
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'Access denied: System Admin required';
  END IF;

  v_normalized_key := LOWER(TRIM(p_raw_key));
  IF v_normalized_key = '' OR TRIM(p_mapping) = '' THEN
    RAISE EXCEPTION 'Từ khóa gốc và địa chỉ chuẩn hóa không được để trống';
  END IF;

  -- Upsert vào shop_address_aliases dưới dạng Global Rule (shop_id = NULL, is_global = TRUE)
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
    v_normalized_key,
    TRIM(p_mapping),
    TRUE,
    auth.uid(),
    now()
  )
  ON CONFLICT (LOWER(TRIM(original))) WHERE (shop_id IS NULL OR is_global = TRUE)
  DO UPDATE SET
    mapping = EXCLUDED.mapping,
    is_global = TRUE,
    created_at = now()
  RETURNING id INTO v_result_id;

  RETURN jsonb_build_object(
    'success', true,
    'alias_id', v_result_id,
    'original', v_normalized_key,
    'mapping', TRIM(p_mapping),
    'is_global', true
  );
END;
$$;

-- 5. RPC: Lấy danh sách Từ Điển Toàn Hệ Thống (Dành cho Extension Client nạp Cache)
CREATE OR REPLACE FUNCTION public.get_active_global_aliases()
RETURNS TABLE (
  id UUID,
  original TEXT,
  mapping TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.original,
    a.mapping,
    a.created_at
  FROM public.shop_address_aliases a
  WHERE a.is_global = TRUE OR a.shop_id IS NULL
  ORDER BY a.created_at DESC;
END;
$$;

-- Phân quyền thực thi
GRANT EXECUTE ON FUNCTION public.get_admin_learning_candidates(INT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_promote_to_global_alias(TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_active_global_aliases() TO authenticated, anon, service_role;
