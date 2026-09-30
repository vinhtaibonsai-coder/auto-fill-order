-- =========================================================================
-- MIGRATION v103: LEARNING KNOWLEDGE PRODUCTION SAFETY & MULTI-TENANT GOVERNANCE
-- Khắc phục toàn diện các vấn đề an toàn dữ liệu, cách ly Tenant và độ tin cậy tri thức:
-- 1. Thêm các trường provenance & metadata: source_type, verified_at, verified_by, lookup_count
-- 2. Cho phép category 'field_correction' trong shop_learning_kb
-- 3. Cập nhật sync_shop_learning_batch với thứ tự ưu tiên nguồn (source_rank), không dùng GREATEST
-- 4. Bổ sung RPC verify_shop_learning_entry & delete_shop_learning_entry có kiểm soát
-- 5. Bảo vệ Global Alias: Hàm is_safe_global_alias ngăn chặn địa chỉ nhà riêng/PII
-- 6. Candidates chỉ lấy từ shop_address_aliases (Từ điển viết tắt chủ đích), không lấy raw customer addresses
-- 7. Thu hồi quyền anon đối với get_active_global_aliases() và kiểm soát quyền ghi shop_learning_kb
-- =========================================================================

-- 1. Bổ sung các cột phục vụ phân loại nguồn và kiểm toán
ALTER TABLE public.shop_learning_kb
  ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lookup_count INT DEFAULT 0;

-- Nới lỏng CHECK constraint để hỗ trợ 'field_correction'
ALTER TABLE public.shop_learning_kb DROP CONSTRAINT IF EXISTS shop_learning_kb_category_check;
ALTER TABLE public.shop_learning_kb
  ADD CONSTRAINT shop_learning_kb_category_check
  CHECK (category IN ('address_raw', 'customer_phone', 'product_sku', 'order_code_pattern', 'field_correction'));

-- 2. Hàm hỗ trợ tính thứ hạng nguồn dữ liệu (Provenance Ranking)
CREATE OR REPLACE FUNCTION public.source_rank(p_source TEXT)
RETURNS INT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE LOWER(COALESCE(p_source, 'legacy'))
    WHEN 'admin_verified' THEN 500
    WHEN 'human_confirmed' THEN 400
    WHEN 'human_edit' THEN 300
    WHEN 'akb_builtin' THEN 250
    WHEN 'local_pipeline' THEN 150
    WHEN 'historical' THEN 100
    ELSE 50
  END;
$$;

-- 3. RPC: sync_shop_learning_batch chuẩn hóa
CREATE OR REPLACE FUNCTION public.sync_shop_learning_batch(
  p_shop_id UUID,
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
  v_cat TEXT;
  v_key TEXT;
  v_val JSONB;
  v_conf INT;
  v_source TEXT;
  v_action TEXT;
  v_verified BOOLEAN;
  v_hit_delta INT;
BEGIN
  IF NOT public.is_shop_member(p_shop_id) THEN
    RAISE EXCEPTION 'ACCESS_DENIED: Bạn không thuộc shop này.';
  END IF;

  IF p_entries IS NULL OR jsonb_typeof(p_entries) != 'array' THEN
    RETURN jsonb_build_object('success', false, 'synced_count', 0);
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_entries)
  LOOP
    v_action := lower(trim(COALESCE(v_item->>'action', 'upsert')));
    v_cat := lower(trim(COALESCE(v_item->>'category', 'address_raw')));
    v_key := lower(trim(COALESCE(v_item->>'raw_key', '')));

    IF v_key = '' OR v_cat NOT IN ('address_raw', 'customer_phone', 'product_sku', 'order_code_pattern', 'field_correction') THEN
      CONTINUE;
    END IF;

    -- Xử lý action 'hit' để tăng lookup_count
    IF v_action = 'hit' THEN
      v_hit_delta := COALESCE((v_item->>'hit_delta')::INT, 1);
      UPDATE public.shop_learning_kb
      SET lookup_count = COALESCE(lookup_count, 0) + v_hit_delta,
          last_used_at = now()
      WHERE shop_id = p_shop_id AND category = v_cat AND raw_key = v_key;
      CONTINUE;
    END IF;

    -- Xử lý action 'upsert'
    v_val := v_item->'normalized_value';
    IF v_val IS NULL THEN
      CONTINUE;
    END IF;

    v_conf := LEAST(100, GREATEST(0, COALESCE((v_item->>'confidence')::INT, 90)));
    v_source := lower(trim(COALESCE(v_item->>'source_type', 'legacy')));
    v_verified := COALESCE((v_item->>'verified')::BOOLEAN, v_source = 'admin_verified');

    INSERT INTO public.shop_learning_kb (
      shop_id,
      category,
      raw_key,
      normalized_value,
      confidence,
      hit_count,
      last_used_at,
      created_by,
      source_type,
      verified_at,
      verified_by
    ) VALUES (
      p_shop_id,
      v_cat,
      v_key,
      v_val,
      v_conf,
      1,
      now(),
      auth.uid(),
      v_source,
      CASE WHEN v_verified THEN now() ELSE NULL END,
      CASE WHEN v_verified THEN auth.uid() ELSE NULL END
    )
    ON CONFLICT (shop_id, category, raw_key) DO UPDATE SET
      normalized_value = CASE 
        WHEN public.source_rank(EXCLUDED.source_type) >= public.source_rank(public.shop_learning_kb.source_type)
        THEN EXCLUDED.normalized_value 
        ELSE public.shop_learning_kb.normalized_value 
      END,
      confidence = CASE 
        WHEN public.source_rank(EXCLUDED.source_type) >= public.source_rank(public.shop_learning_kb.source_type)
        THEN EXCLUDED.confidence
        ELSE public.shop_learning_kb.confidence
      END,
      source_type = CASE 
        WHEN public.source_rank(EXCLUDED.source_type) >= public.source_rank(public.shop_learning_kb.source_type)
        THEN EXCLUDED.source_type
        ELSE public.shop_learning_kb.source_type
      END,
      verified_at = CASE
        WHEN EXCLUDED.verified_at IS NOT NULL THEN EXCLUDED.verified_at
        ELSE public.shop_learning_kb.verified_at
      END,
      verified_by = CASE
        WHEN EXCLUDED.verified_by IS NOT NULL THEN EXCLUDED.verified_by
        ELSE public.shop_learning_kb.verified_by
      END,
      hit_count = public.shop_learning_kb.hit_count + 1,
      last_used_at = now();

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'synced_count', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_shop_learning_batch(UUID, JSONB) TO authenticated;

-- 4. RPC: Xác minh một mẫu học của Shop
CREATE OR REPLACE FUNCTION public.verify_shop_learning_entry(
  p_shop_id UUID,
  p_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_system_admin() OR public.is_shop_member(p_shop_id)) THEN
    RAISE EXCEPTION 'ACCESS_DENIED: Bạn không có quyền quản trị mẫu học này.';
  END IF;

  UPDATE public.shop_learning_kb
  SET confidence = 100,
      source_type = 'admin_verified',
      verified_at = now(),
      verified_by = auth.uid(),
      last_used_at = now()
  WHERE id = p_id AND shop_id = p_shop_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mẫu học không tồn tại hoặc không thuộc shop.');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_shop_learning_entry(UUID, UUID) TO authenticated;

-- 5. RPC: Xóa an toàn một mẫu học của Shop
CREATE OR REPLACE FUNCTION public.delete_shop_learning_entry(
  p_shop_id UUID,
  p_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cat TEXT;
  v_key TEXT;
BEGIN
  IF NOT (public.is_system_admin() OR public.is_shop_member(p_shop_id)) THEN
    RAISE EXCEPTION 'ACCESS_DENIED: Bạn không có quyền xóa mẫu học này.';
  END IF;

  DELETE FROM public.shop_learning_kb
  WHERE id = p_id AND shop_id = p_shop_id
  RETURNING category, raw_key INTO v_cat, v_key;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mẫu học không tồn tại.');
  END IF;

  RETURN jsonb_build_object('success', true, 'category', v_cat, 'raw_key', v_key);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_shop_learning_entry(UUID, UUID) TO authenticated;

-- 6. Hàm kiểm tra độ an toàn của Global Alias (Chống PII / Số nhà / SĐT)
CREATE OR REPLACE FUNCTION public.is_safe_global_alias(p_text TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_clean TEXT := lower(trim(coalesce(p_text, '')));
BEGIN
  IF v_clean = '' OR length(v_clean) > 80 THEN
    RETURN FALSE;
  END IF;
  -- Không được chứa số điện thoại (dãy 9 chữ số liên tiếp)
  IF v_clean ~ '\d{9,}' THEN
    RETURN FALSE;
  END IF;
  -- Không được chứa địa chỉ nhà chi tiết (số nhà / ngõ ngách / hẻm / xóm)
  IF v_clean ~* '(số\s*\d+|ngõ\s*\d+|ngách\s*\d+|hẻm\s*\d+|xóm\s*\d+|tổ\s*\d+|thôn\s*\d+)' THEN
    RETURN FALSE;
  END IF;
  RETURN TRUE;
END;
$$;

-- 7. Cập nhật get_admin_learning_candidates:
-- Không bao giờ lấy từ shop_learning_kb (địa chỉ khách hàng riêng).
-- Chỉ lấy từ shop_address_aliases (từ điển viết tắt chủ đích) đáp ứng is_safe_global_alias.
DROP FUNCTION IF EXISTS public.get_admin_learning_candidates(INT);
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
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'Access denied: System Admin required';
  END IF;

  RETURN QUERY
  WITH grouped AS (
    SELECT 
      lower(trim(a.original)) AS g_raw_key,
      jsonb_build_object('fullAddress', trim((ARRAY_AGG(a.mapping ORDER BY a.created_at DESC))[1])) AS g_sample_val,
      COUNT(DISTINCT a.shop_id)::INT AS g_shop_count,
      COUNT(*)::INT AS g_total_hits,
      100::NUMERIC AS g_avg_confidence,
      MAX(a.created_at) AS g_last_seen
    FROM public.shop_address_aliases a
    WHERE a.shop_id IS NOT NULL
      AND (a.is_global IS FALSE OR a.is_global IS NULL)
      AND public.is_safe_global_alias(a.original)
    GROUP BY lower(trim(a.original))
  )
  SELECT 
    g.g_raw_key AS raw_key,
    g.g_sample_val AS sample_normalized_value,
    g.g_shop_count AS shop_count,
    g.g_total_hits AS total_hits,
    g.g_avg_confidence AS avg_confidence,
    g.g_last_seen AS last_seen_at,
    EXISTS (
      SELECT 1 FROM public.shop_address_aliases ga
      WHERE (ga.shop_id IS NULL OR ga.is_global = TRUE)
        AND lower(trim(ga.original)) = g.g_raw_key
    ) AS is_promoted
  FROM grouped g
  ORDER BY is_promoted ASC, g.g_shop_count DESC, g.g_total_hits DESC
  LIMIT LEAST(p_limit, 200);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_learning_candidates(INT) TO authenticated, service_role;

-- 8. Bảo vệ bảo mật Tenant & PII
REVOKE INSERT, UPDATE, DELETE ON public.shop_learning_kb FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_active_global_aliases() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_active_global_aliases() TO authenticated, service_role;

