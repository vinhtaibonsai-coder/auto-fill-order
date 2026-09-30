-- =========================================================================
-- MIGRATION v98: BẢNG TRI THỨC HỌC MÁY THEO SHOP (shop_learning_kb) & ĐỒNG BỘ 2 CHIỀU
-- Cho phép chia sẻ dữ liệu học máy (Địa chỉ thô, Khách hàng, Viết tắt) giữa các thiết bị trong cùng shop
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.shop_learning_kb (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('address_raw', 'customer_phone', 'product_sku', 'order_code_pattern')),
  raw_key TEXT NOT NULL,
  normalized_value JSONB NOT NULL,
  confidence INT DEFAULT 90,
  hit_count INT DEFAULT 1,
  last_used_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_shop_learning_entry UNIQUE (shop_id, category, raw_key)
);

CREATE INDEX IF NOT EXISTS idx_shop_learning_lookup ON public.shop_learning_kb (shop_id, category, raw_key);
CREATE INDEX IF NOT EXISTS idx_shop_learning_recent ON public.shop_learning_kb (shop_id, last_used_at DESC);

ALTER TABLE public.shop_learning_kb ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Shop members read learning kb" ON public.shop_learning_kb;
CREATE POLICY "Shop members read learning kb" ON public.shop_learning_kb
  FOR SELECT USING (
    public.is_shop_member(shop_id)
  );

DROP POLICY IF EXISTS "Shop members insert learning kb" ON public.shop_learning_kb;
CREATE POLICY "Shop members insert learning kb" ON public.shop_learning_kb
  FOR INSERT WITH CHECK (
    public.is_shop_member(shop_id)
  );

DROP POLICY IF EXISTS "Shop members update learning kb" ON public.shop_learning_kb;
CREATE POLICY "Shop members update learning kb" ON public.shop_learning_kb
  FOR UPDATE USING (
    public.is_shop_member(shop_id)
  );

DROP POLICY IF EXISTS "Shop members delete learning kb" ON public.shop_learning_kb;
CREATE POLICY "Shop members delete learning kb" ON public.shop_learning_kb
  FOR DELETE USING (
    public.is_shop_member(shop_id)
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_learning_kb TO authenticated;

-- ---------------------------------------------------------------------
-- 1. RPC: get_shop_learning_snapshot
-- Tải danh sách tri thức của shop để lưu vào bộ nhớ đệm (local cache)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_shop_learning_snapshot(
  p_shop_id UUID,
  p_limit INT DEFAULT 2000
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT public.is_shop_member(p_shop_id) THEN
    RAISE EXCEPTION 'ACCESS_DENIED: Bạn không thuộc shop này.';
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', id,
      'category', category,
      'raw_key', raw_key,
      'normalized_value', normalized_value,
      'confidence', confidence,
      'hit_count', hit_count,
      'last_used_at', last_used_at
    ) ORDER BY last_used_at DESC
  ), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT id, category, raw_key, normalized_value, confidence, hit_count, last_used_at
    FROM public.shop_learning_kb
    WHERE shop_id = p_shop_id
    ORDER BY last_used_at DESC
    LIMIT LEAST(p_limit, 5000)
  ) sub;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_shop_learning_snapshot(UUID, INT) TO authenticated;

-- ---------------------------------------------------------------------
-- 2. RPC: sync_shop_learning_batch
-- Đồng bộ một mảng các bản ghi học mới lên shop_learning_kb (upsert)
-- ---------------------------------------------------------------------
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
BEGIN
  IF NOT public.is_shop_member(p_shop_id) THEN
    RAISE EXCEPTION 'ACCESS_DENIED: Bạn không thuộc shop này.';
  END IF;

  IF p_entries IS NULL OR jsonb_typeof(p_entries) != 'array' THEN
    RETURN jsonb_build_object('success', false, 'synced_count', 0);
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_entries)
  LOOP
    v_cat := trim(lower(COALESCE(v_item->>'category', 'address_raw')));
    v_key := trim(lower(COALESCE(v_item->>'raw_key', '')));
    v_val := v_item->'normalized_value';
    v_conf := COALESCE((v_item->>'confidence')::INT, 90);

    IF v_key != '' AND v_val IS NOT NULL AND v_cat IN ('address_raw', 'customer_phone', 'product_sku', 'order_code_pattern') THEN
      INSERT INTO public.shop_learning_kb (
        shop_id,
        category,
        raw_key,
        normalized_value,
        confidence,
        hit_count,
        last_used_at,
        created_by
      ) VALUES (
        p_shop_id,
        v_cat,
        v_key,
        v_val,
        v_conf,
        1,
        now(),
        auth.uid()
      )
      ON CONFLICT (shop_id, category, raw_key) DO UPDATE SET
        normalized_value = EXCLUDED.normalized_value,
        confidence = GREATEST(public.shop_learning_kb.confidence, EXCLUDED.confidence),
        hit_count = public.shop_learning_kb.hit_count + 1,
        last_used_at = now();

      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'synced_count', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_shop_learning_batch(UUID, JSONB) TO authenticated;
