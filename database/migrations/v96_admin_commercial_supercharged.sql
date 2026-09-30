-- Migration v96: Admin Commercial Supercharged Features (Self-Healing & Backward Compatible)
-- =========================================================================
-- 1. Tra cứu đơn hàng toàn cục (Global Orders Explorer)
-- 2. Quản lý bản quyền 16 ký tự (License Keys Generator)
-- 3. Cổng thanh toán SePay Webhook tự động (Payment Transactions)
-- 4. Kênh cảnh báo đa kênh (System Webhooks: Discord/Zalo/Lark/Slack)
-- 5. Phân quyền SUPPORT / SUPPORT_STAFF vs MASTER_ADMIN
-- =========================================================================

-- =========================================================================
-- PHẦN 1: BẢNG LICENSE_KEYS (MÃ KÍCH HOẠT / VOUCHER BẢN QUYỀN)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.license_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tự động bổ sung tất cả các cột cần thiết (tương thích cả schema cũ lẫn mới)
ALTER TABLE public.license_keys ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE public.license_keys ADD COLUMN IF NOT EXISTS key_code TEXT;
ALTER TABLE public.license_keys ADD COLUMN IF NOT EXISTS key_type TEXT DEFAULT 'DAYS';
ALTER TABLE public.license_keys ADD COLUMN IF NOT EXISTS plan_code TEXT DEFAULT 'PRO';
ALTER TABLE public.license_keys ADD COLUMN IF NOT EXISTS value INT DEFAULT 30;
ALTER TABLE public.license_keys ADD COLUMN IF NOT EXISTS duration_days INT DEFAULT 30;
ALTER TABLE public.license_keys ADD COLUMN IF NOT EXISTS max_users INT DEFAULT 5;
ALTER TABLE public.license_keys ADD COLUMN IF NOT EXISTS max_devices INT DEFAULT 5;
ALTER TABLE public.license_keys ADD COLUMN IF NOT EXISTS max_ai_requests INT DEFAULT 1000;
ALTER TABLE public.license_keys ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'UNUSED';
ALTER TABLE public.license_keys ADD COLUMN IF NOT EXISTS used_by_shop_id UUID REFERENCES public.shops(id) ON DELETE SET NULL;
ALTER TABLE public.license_keys ADD COLUMN IF NOT EXISTS redeemed_by_shop_id UUID REFERENCES public.shops(id) ON DELETE SET NULL;
ALTER TABLE public.license_keys ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ;
ALTER TABLE public.license_keys ADD COLUMN IF NOT EXISTS redeemed_at TIMESTAMPTZ;
ALTER TABLE public.license_keys ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE public.license_keys ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE public.license_keys ADD COLUMN IF NOT EXISTS notes TEXT;

-- Đồng bộ dữ liệu hai chiều giữa code (v96) và key_code (v41)
UPDATE public.license_keys SET code = key_code WHERE code IS NULL AND key_code IS NOT NULL;
UPDATE public.license_keys SET key_code = code WHERE key_code IS NULL AND code IS NOT NULL;
UPDATE public.license_keys SET used_by_shop_id = redeemed_by_shop_id WHERE used_by_shop_id IS NULL AND redeemed_by_shop_id IS NOT NULL;
UPDATE public.license_keys SET used_at = redeemed_at WHERE used_at IS NULL AND redeemed_at IS NOT NULL;
UPDATE public.license_keys SET status = 'USED' WHERE (used_at IS NOT NULL OR redeemed_at IS NOT NULL) AND (status IS NULL OR status = 'UNUSED');

-- Đảm bảo index cho tra cứu nhanh
CREATE INDEX IF NOT EXISTS idx_license_keys_code ON public.license_keys(code);
CREATE INDEX IF NOT EXISTS idx_license_keys_key_code ON public.license_keys(key_code);
CREATE INDEX IF NOT EXISTS idx_license_keys_status ON public.license_keys(status);
CREATE INDEX IF NOT EXISTS idx_license_keys_used_by ON public.license_keys(used_by_shop_id);

ALTER TABLE public.license_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS license_keys_admin_policy ON public.license_keys;
CREATE POLICY license_keys_admin_policy ON public.license_keys
  FOR ALL TO authenticated
  USING (
    public.is_system_admin() OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid() AND r.code IN ('SYSTEM_ADMIN', 'SUPER_ADMIN')
    )
  );

-- =========================================================================
-- PHẦN 2: BẢNG PAYMENT_TRANSACTIONS (LỊCH SỬ BIẾN ĐỘNG SỐ DƯ SEPAY)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tự động bổ sung các cột cho payment_transactions
ALTER TABLE public.payment_transactions ADD COLUMN IF NOT EXISTS transaction_id TEXT;
ALTER TABLE public.payment_transactions ADD COLUMN IF NOT EXISTS transaction_code TEXT;
ALTER TABLE public.payment_transactions ADD COLUMN IF NOT EXISTS gateway TEXT DEFAULT 'SEPAY';
ALTER TABLE public.payment_transactions ADD COLUMN IF NOT EXISTS amount NUMERIC DEFAULT 0;
ALTER TABLE public.payment_transactions ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE public.payment_transactions ADD COLUMN IF NOT EXISTS shop_code TEXT;
ALTER TABLE public.payment_transactions ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES public.shops(id) ON DELETE SET NULL;
ALTER TABLE public.payment_transactions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'PENDING';
ALTER TABLE public.payment_transactions ADD COLUMN IF NOT EXISTS plan_tier TEXT DEFAULT 'PRO_AUTO';
ALTER TABLE public.payment_transactions ADD COLUMN IF NOT EXISTS raw_payload JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.payment_transactions ADD COLUMN IF NOT EXISTS raw_webhook_payload JSONB DEFAULT '{}'::jsonb;

-- Gỡ bỏ ràng buộc NOT NULL của plan_tier trong schema cũ (nếu có)
DO $$
BEGIN
  ALTER TABLE public.payment_transactions ALTER COLUMN plan_tier DROP NOT NULL;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Đồng bộ hai chiều giữa transaction_id và transaction_code
UPDATE public.payment_transactions SET transaction_id = transaction_code WHERE transaction_id IS NULL AND transaction_code IS NOT NULL;
UPDATE public.payment_transactions SET transaction_code = transaction_id WHERE transaction_code IS NULL AND transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_trans_id ON public.payment_transactions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_trans_code ON public.payment_transactions(transaction_code);
CREATE INDEX IF NOT EXISTS idx_payment_shop_id ON public.payment_transactions(shop_id);
CREATE INDEX IF NOT EXISTS idx_payment_created_at ON public.payment_transactions(created_at DESC);

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_trans_admin_policy ON public.payment_transactions;
CREATE POLICY payment_trans_admin_policy ON public.payment_transactions
  FOR ALL TO authenticated
  USING (
    public.is_system_admin() OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid() AND r.code IN ('SYSTEM_ADMIN', 'SUPER_ADMIN')
    )
  );

-- =========================================================================
-- PHẦN 3: BẢNG SYSTEM_WEBHOOKS (CẢNH BÁO ĐA KÊNH: DISCORD, ZALO, LARK...)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.system_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Default Webhook',
  url TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'DISCORD',
  secret_token TEXT,
  events TEXT[] DEFAULT ARRAY['carrier_down', 'quota_exhausted', 'payment_received', 'device_limit']::TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  last_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.system_webhooks ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'DISCORD';

ALTER TABLE public.system_webhooks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS system_webhooks_admin_policy ON public.system_webhooks;
CREATE POLICY system_webhooks_admin_policy ON public.system_webhooks
  FOR ALL TO authenticated
  USING (
    public.is_system_admin() OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid() AND r.code IN ('SYSTEM_ADMIN', 'SUPER_ADMIN')
    )
  );

-- =========================================================================
-- PHẦN 4: HÀM SINH MÃ BẢN QUYỀN HÀNG LOẠT (RPC)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.admin_generate_license_keys(
  p_type TEXT,
  p_value INT,
  p_count INT DEFAULT 1,
  p_notes TEXT DEFAULT NULL,
  p_expires_days INT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_res JSONB := '[]'::jsonb;
  v_code TEXT;
  v_chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_expires_at TIMESTAMPTZ := NULL;
  v_inserted INT := 0;
  v_part1 TEXT;
  v_part2 TEXT;
  v_part3 TEXT;
  i INT;
  j INT;
BEGIN
  IF NOT (public.is_system_admin() OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid() AND r.code IN ('SYSTEM_ADMIN', 'SUPER_ADMIN')
  )) THEN
    RAISE EXCEPTION 'Access denied: Requires SYSTEM_ADMIN role.';
  END IF;

  IF p_type NOT IN ('DAYS', 'AI_QUOTA') THEN
    RAISE EXCEPTION 'Invalid key_type: must be DAYS or AI_QUOTA';
  END IF;

  IF p_value <= 0 OR p_count <= 0 OR p_count > 100 THEN
    RAISE EXCEPTION 'Invalid parameters: value > 0 and 1 <= count <= 100';
  END IF;

  IF p_expires_days IS NOT NULL AND p_expires_days > 0 THEN
    v_expires_at := now() + (p_expires_days || ' days')::INTERVAL;
  END IF;

  FOR i IN 1..p_count LOOP
    -- Sinh mã dạng AF-XXXX-YYYY-ZZZZ (16 ký tự)
    LOOP
      v_part1 := ''; v_part2 := ''; v_part3 := '';
      FOR j IN 1..4 LOOP
        v_part1 := v_part1 || substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1);
        v_part2 := v_part2 || substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1);
        v_part3 := v_part3 || substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1);
      END LOOP;
      v_code := 'AF-' || v_part1 || '-' || v_part2 || '-' || v_part3;

      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.license_keys 
        WHERE code = v_code OR key_code = v_code
      );
    END LOOP;

    INSERT INTO public.license_keys (
      code, key_code, key_type, plan_code, value, duration_days,
      max_users, max_devices, max_ai_requests, status, created_by, expires_at, notes
    ) VALUES (
      v_code, v_code, p_type, 'PRO', p_value, p_value,
      5, 5, 1000, 'UNUSED', auth.uid(), v_expires_at, p_notes
    );

    v_res := v_res || jsonb_build_object(
      'code', v_code,
      'key_type', p_type,
      'value', p_value,
      'status', 'UNUSED',
      'expires_at', v_expires_at
    );
    v_inserted := v_inserted + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'count', v_inserted,
    'keys', v_res
  );
END;
$$;

-- =========================================================================
-- PHẦN 5: HÀM KÍCH HOẠT MÃ BẢN QUYỀN PHÍA SHOP (RPC)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.apply_license_key(
  p_shop_id UUID,
  p_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key public.license_keys;
  v_clean_code TEXT;
  v_shop public.shops;
  v_new_expires TIMESTAMPTZ;
  v_type TEXT;
  v_val INT;
BEGIN
  -- 1. Kiểm tra quyền thao tác trên shop
  IF NOT (public.is_shop_owner_or_manager(p_shop_id) OR public.is_system_admin()) THEN
    RAISE EXCEPTION 'Access denied: Must be shop owner or manager.';
  END IF;

  SELECT * INTO v_shop FROM public.shops WHERE id = p_shop_id;
  IF v_shop.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Cửa hàng không tồn tại.');
  END IF;

  -- 2. Tìm mã kích hoạt (hỗ trợ cả cột code lẫn key_code)
  v_clean_code := UPPER(TRIM(p_code));
  SELECT * INTO v_key FROM public.license_keys 
  WHERE UPPER(COALESCE(code, key_code, '')) = v_clean_code 
  LIMIT 1 FOR UPDATE;

  IF v_key.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Mã kích hoạt không hợp lệ hoặc không tồn tại.');
  END IF;

  IF v_key.status = 'USED' OR v_key.redeemed_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Mã kích hoạt này đã được sử dụng trước đó.');
  END IF;

  IF v_key.expires_at IS NOT NULL AND v_key.expires_at < now() THEN
    UPDATE public.license_keys SET status = 'EXPIRED' WHERE id = v_key.id;
    RETURN jsonb_build_object('success', false, 'message', 'Mã kích hoạt này đã hết hạn sử dụng.');
  END IF;

  v_type := COALESCE(v_key.key_type, 'DAYS');
  v_val := COALESCE(v_key.value, v_key.duration_days, 30);

  -- 3. Áp dụng mã
  IF v_type = 'DAYS' THEN
    IF v_shop.expires_at IS NOT NULL AND v_shop.expires_at > now() THEN
      v_new_expires := v_shop.expires_at + (v_val || ' days')::INTERVAL;
    ELSE
      v_new_expires := now() + (v_val || ' days')::INTERVAL;
    END IF;

    UPDATE public.shops
    SET expires_at = v_new_expires,
        status = 'active',
        updated_at = now()
    WHERE id = p_shop_id;

  ELSIF v_type = 'AI_QUOTA' THEN
    INSERT INTO public.shop_quotas (shop_id, ai_quota_balance, updated_at)
    VALUES (p_shop_id, v_val, now())
    ON CONFLICT (shop_id)
    DO UPDATE SET
      ai_quota_balance = COALESCE(public.shop_quotas.ai_quota_balance, 0) + EXCLUDED.ai_quota_balance,
      updated_at = now();
  END IF;

  -- 4. Đánh dấu đã sử dụng (đồng bộ cả 2 bộ cột)
  UPDATE public.license_keys
  SET status = 'USED',
      used_by_shop_id = p_shop_id,
      redeemed_by_shop_id = p_shop_id,
      used_at = now(),
      redeemed_at = now()
  WHERE id = v_key.id;

  -- Ghi log audit
  INSERT INTO public.audit_logs (shop_id, user_id, action, entity_type, entity_id, details)
  VALUES (
    p_shop_id,
    auth.uid(),
    'APPLY_LICENSE_KEY',
    'LICENSE_KEY',
    v_key.id::text,
    jsonb_build_object('code', v_clean_code, 'type', v_type, 'value', v_val)
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', CASE
      WHEN v_type = 'DAYS' THEN 'Kích hoạt thành công! Cửa hàng được gia hạn thêm ' || v_val || ' ngày.'
      ELSE 'Kích hoạt thành công! Cửa hàng được cộng thêm ' || v_val || ' lượt AI.'
    END,
    'key_type', v_type,
    'value', v_val,
    'new_expires_at', v_new_expires
  );
END;
$$;

-- Alias cho các code cũ gọi redeem_license_key
CREATE OR REPLACE FUNCTION public.redeem_license_key(
  p_shop_id UUID,
  p_key_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.apply_license_key(p_shop_id, p_key_code);
END;
$$;

-- =========================================================================
-- PHẦN 6: XỬ LÝ WEBHOOK SEPAY TỰ ĐỘNG (RPC)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.process_payment_webhook(
  p_gateway TEXT,
  p_transaction_id TEXT,
  p_amount NUMERIC,
  p_content TEXT,
  p_raw JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean_tx TEXT;
  v_shop_code TEXT;
  v_shop public.shops;
  v_days_to_add INT;
  v_new_expires TIMESTAMPTZ;
  v_match TEXT[];
BEGIN
  v_clean_tx := TRIM(p_transaction_id);

  -- 1. Chống lặp giao dịch (Idempotency trên cả 2 cột transaction_id và transaction_code)
  IF EXISTS (
    SELECT 1 FROM public.payment_transactions 
    WHERE transaction_id = v_clean_tx OR transaction_code = v_clean_tx
  ) THEN
    RETURN jsonb_build_object('success', true, 'message', 'Giao dịch đã được ghi nhận trước đó.');
  END IF;

  -- 2. Tìm mã shop trong nội dung chuyển khoản (Cú pháp: AF SHOP123 hoặc AFO SHOP123)
  v_match := regexp_matches(UPPER(COALESCE(p_content, '')), '(?:AF|AFO)[_ \-\.]*([A-Z0-9\-_]{3,20})', 'i');
  IF array_length(v_match, 1) >= 1 THEN
    v_shop_code := TRIM(v_match[1]);
    SELECT * INTO v_shop FROM public.shops
    WHERE UPPER(shop_code) = v_shop_code
    LIMIT 1;
  END IF;

  -- Nếu không tìm thấy bằng regex, thử tìm tên shop trực tiếp
  IF v_shop.id IS NULL AND p_content IS NOT NULL THEN
    SELECT * INTO v_shop FROM public.shops
    WHERE p_content ILIKE ('%' || shop_code || '%')
    LIMIT 1;
  END IF;

  -- 3. Quy đổi số tiền thành ngày sử dụng
  IF p_amount >= 500000 THEN
    v_days_to_add := 365; -- Gói năm 500k
  ELSIF p_amount >= 250000 THEN
    v_days_to_add := 180; -- Gói 6 tháng 250k
  ELSIF p_amount >= 120000 THEN
    v_days_to_add := 90;  -- Gói 3 tháng 120k
  ELSIF p_amount >= 50000 THEN
    v_days_to_add := 30;  -- Gói 1 tháng 50k
  ELSE
    v_days_to_add := floor(p_amount / 1666)::int;
  END IF;

  -- 4. Kích hoạt cho shop nếu tìm thấy
  IF v_shop.id IS NOT NULL AND v_days_to_add > 0 THEN
    IF v_shop.expires_at IS NOT NULL AND v_shop.expires_at > now() THEN
      v_new_expires := v_shop.expires_at + (v_days_to_add || ' days')::INTERVAL;
    ELSE
      v_new_expires := now() + (v_days_to_add || ' days')::INTERVAL;
    END IF;

    UPDATE public.shops
    SET expires_at = v_new_expires,
        status = 'active',
        updated_at = now()
    WHERE id = v_shop.id;

    INSERT INTO public.payment_transactions (
      transaction_id, transaction_code, gateway, amount, content, 
      shop_code, shop_id, status, plan_tier, raw_payload, raw_webhook_payload
    ) VALUES (
      v_clean_tx, v_clean_tx, COALESCE(p_gateway, 'SEPAY'), p_amount, p_content, 
      v_shop.shop_code, v_shop.id, 'PROCESSED', 'PRO_AUTO', p_raw, p_raw
    );

    RETURN jsonb_build_object(
      'success', true,
      'matched', true,
      'shop_id', v_shop.id,
      'shop_code', v_shop.shop_code,
      'days_added', v_days_to_add,
      'new_expires_at', v_new_expires
    );
  ELSE
    -- Ghi nhận giao dịch treo để Admin đối soát thủ công
    INSERT INTO public.payment_transactions (
      transaction_id, transaction_code, gateway, amount, content, 
      shop_code, shop_id, status, plan_tier, raw_payload, raw_webhook_payload
    ) VALUES (
      v_clean_tx, v_clean_tx, COALESCE(p_gateway, 'SEPAY'), p_amount, p_content, 
      v_shop_code, NULL, 'PENDING', 'PRO_AUTO', p_raw, p_raw
    );

    RETURN jsonb_build_object(
      'success', true,
      'matched', false,
      'message', 'Giao dịch chưa khớp mã shop, đã đưa vào danh sách chờ đối soát.'
    );
  END IF;
END;
$$;

-- =========================================================================
-- PHẦN 7: TƯƠNG THÍCH BẢNG SUBMITTED_ORDERS & TRA CỨU TOÀN CỤC
-- =========================================================================
-- Đảm bảo tương thích cấu trúc submitted_orders giữa các phiên bản
ALTER TABLE public.submitted_orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.submitted_orders ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.submitted_orders ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE public.submitted_orders ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.submitted_orders ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE public.submitted_orders ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'AUTO_FILL';
ALTER TABLE public.submitted_orders ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'vnpost';
ALTER TABLE public.submitted_orders ADD COLUMN IF NOT EXISTS order_code TEXT;
ALTER TABLE public.submitted_orders ADD COLUMN IF NOT EXISTS tracking_code TEXT;
ALTER TABLE public.submitted_orders ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.submitted_orders ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.submitted_orders ADD COLUMN IF NOT EXISTS cod_amount NUMERIC DEFAULT 0;

-- Đồng bộ hai chiều giữa created_at và submitted_at, customer_name và name
UPDATE public.submitted_orders SET created_at = submitted_at WHERE created_at IS NULL AND submitted_at IS NOT NULL;
UPDATE public.submitted_orders SET submitted_at = created_at WHERE submitted_at IS NULL AND created_at IS NOT NULL;
UPDATE public.submitted_orders SET customer_name = name WHERE customer_name IS NULL AND name IS NOT NULL;
UPDATE public.submitted_orders SET name = customer_name WHERE name IS NULL AND customer_name IS NOT NULL;

-- Tự động sinh shop_code cho shop nào chưa có (để hiển thị mã thay vì N/A)
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS shop_code TEXT;
UPDATE public.shops 
SET shop_code = 'SHOP_' || UPPER(SUBSTRING(COALESCE(NULLIF(TRIM(name), ''), 'STORE'), 1, 4)) || '_' || SUBSTRING(id::text, 1, 4)
WHERE shop_code IS NULL OR TRIM(shop_code) = '';

-- Hàm tra cứu đơn hàng toàn cục cho Admin & Support
CREATE OR REPLACE FUNCTION public.admin_get_global_orders(
  p_search TEXT DEFAULT NULL,
  p_shop_id UUID DEFAULT NULL,
  p_platform TEXT DEFAULT NULL,
  p_source TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  shop_id UUID,
  shop_name TEXT,
  order_code TEXT,
  tracking_code TEXT,
  customer_name TEXT,
  phone TEXT,
  address TEXT,
  cod_amount NUMERIC,
  platform TEXT,
  status TEXT,
  source TEXT,
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
      o.id,
      o.shop_id,
      COALESCE(s.name, 'Shop') AS shop_name,
      o.order_code,
      COALESCE(o.tracking_code, '') AS tracking_code,
      COALESCE(o.customer_name, o.name, '') AS customer_name,
      COALESCE(o.phone, '') AS phone,
      COALESCE(o.address, '') AS address,
      COALESCE(o.cod_amount, 0) AS cod_amount,
      COALESCE(o.platform, 'vnpost') AS platform,
      COALESCE(o.status, 'pending') AS status,
      COALESCE(o.source, 'AUTO_FILL') AS source,
      COALESCE(o.created_at, o.submitted_at, now()) AS created_at
    FROM public.submitted_orders o
    LEFT JOIN public.shops s ON s.id = o.shop_id
    WHERE
      (p_shop_id IS NULL OR o.shop_id = p_shop_id)
      AND (p_platform IS NULL OR o.platform ILIKE p_platform)
      AND (p_source IS NULL OR o.source ILIKE p_source)
      AND (
        v_search IS NULL
        OR o.phone ILIKE v_search
        OR o.name ILIKE v_search
        OR o.customer_name ILIKE v_search
        OR o.order_code ILIKE v_search
        OR o.tracking_code ILIKE v_search
        OR s.name ILIKE v_search
      )
  ),
  counted AS (
    SELECT count(*)::BIGINT AS total FROM filtered_orders
  )
  SELECT
    fo.id,
    fo.shop_id,
    fo.shop_name,
    fo.order_code,
    fo.tracking_code,
    fo.customer_name,
    fo.phone,
    fo.address,
    fo.cod_amount,
    fo.platform,
    fo.status,
    fo.source,
    fo.created_at,
    c.total AS total_count
  FROM filtered_orders fo
  CROSS JOIN counted c
  ORDER BY fo.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

-- =========================================================================
-- PHẦN 8: FIX LỖI TẠO TÀI KHOẢN ADMIN (ROLE_NOT_CONFIGURED FIX)
-- =========================================================================
-- Đảm bảo bảng public.roles có đủ cột và toàn bộ các mã vai trò Quản trị viên
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS description TEXT;

INSERT INTO public.roles (code, name)
VALUES 
  ('SYSTEM_ADMIN', 'Master Administrator'),
  ('SUPPORT_ADMIN', 'Support Administrator'),
  ('FINANCE_ADMIN', 'Finance Administrator'),
  ('SUPPORT_STAFF', 'Support Staff'),
  ('SUPPORT', 'Support Specialist')
ON CONFLICT (code) DO NOTHING;

-- Đảm bảo extension pgcrypto luôn sẵn sàng trong schema extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Tự phục hồi RPC admin_create_admin_account nếu vai trò chưa tồn tại
CREATE OR REPLACE FUNCTION public.admin_create_admin_account(
  p_email TEXT,
  p_full_name TEXT,
  p_password TEXT,
  p_role_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_user_id UUID := gen_random_uuid();
  v_role_id UUID;
  v_instance UUID;
  v_encrypted_pw TEXT;
BEGIN
  IF NOT (public.is_system_admin() OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid() AND r.code IN ('SYSTEM_ADMIN', 'SUPER_ADMIN')
  )) THEN
    RAISE EXCEPTION 'ACCESS_DENIED';
  END IF;

  IF p_role_code NOT IN ('SYSTEM_ADMIN', 'SUPPORT_ADMIN', 'FINANCE_ADMIN', 'SUPPORT', 'SUPPORT_STAFF') 
     OR p_email !~* '^[^@]+@[^@]+\.[^@]+$' 
     OR length(p_password) < 6 THEN
    RAISE EXCEPTION 'INVALID_ADMIN_ACCOUNT';
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = lower(trim(p_email))) THEN
    RAISE EXCEPTION 'EMAIL_EXISTS';
  END IF;

  -- Tìm role_id, nếu chưa có thì tự động map tương đương hoặc sinh role mới
  SELECT id INTO v_role_id FROM public.roles WHERE code = p_role_code;
  IF v_role_id IS NULL AND p_role_code = 'SUPPORT_ADMIN' THEN
    SELECT id INTO v_role_id FROM public.roles WHERE code = 'SUPPORT';
  END IF;

  IF v_role_id IS NULL THEN
    INSERT INTO public.roles (code, name)
    VALUES (p_role_code, p_role_code)
    RETURNING id INTO v_role_id;
  END IF;

  DECLARE
    v_ref_user auth.users%ROWTYPE;
    v_ref_ident auth.identities%ROWTYPE;
    v_provider_id TEXT;
    v_ident_id UUID;
  BEGIN
    SELECT * INTO v_ref_user FROM auth.users WHERE instance_id IS NOT NULL AND email != lower(trim(p_email)) LIMIT 1;
    IF v_ref_user.id IS NOT NULL THEN
      SELECT * INTO v_ref_ident FROM auth.identities WHERE user_id = v_ref_user.id LIMIT 1;
      v_instance := v_ref_user.instance_id;
    END IF;

    IF v_instance IS NULL THEN
      SELECT id INTO v_instance FROM auth.instances LIMIT 1;
    END IF;
    IF v_instance IS NULL THEN
      v_instance := '00000000-0000-0000-0000-000000000000'::uuid;
    END IF;

    -- Tự động thích ứng quy tắc provider_id theo tài khoản chuẩn của database
    IF v_ref_ident.provider_id = v_ref_user.email THEN
      v_provider_id := lower(trim(p_email));
      v_ident_id := v_user_id;
    ELSE
      v_provider_id := v_user_id::text;
      v_ident_id := gen_random_uuid();
    END IF;

    -- Mã hóa mật khẩu an toàn tương thích mọi môi trường Supabase/PostgreSQL
    BEGIN
      v_encrypted_pw := extensions.crypt(p_password, extensions.gen_salt('bf', 10));
    EXCEPTION WHEN OTHERS THEN
      BEGIN
        v_encrypted_pw := crypt(p_password, gen_salt('bf', 10));
      EXCEPTION WHEN OTHERS THEN
        v_encrypted_pw := extensions.crypt(p_password, extensions.gen_salt('bf'));
      END;
    END;

    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, 
      email_confirmed_at, confirmation_token, recovery_token, email_change, email_change_token_new,
      is_sso_user, created_at, updated_at, confirmation_sent_at,
      raw_app_meta_data, raw_user_meta_data, is_super_admin
    ) VALUES (
      v_instance, v_user_id, 'authenticated', 'authenticated', 
      lower(trim(p_email)), v_encrypted_pw, 
      now(), '', '', '', '',
      FALSE, now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', trim(p_full_name), 'name', trim(p_full_name)),
      FALSE
    )
    ON CONFLICT (id) DO UPDATE SET
      instance_id = EXCLUDED.instance_id,
      encrypted_password = EXCLUDED.encrypted_password,
      email_confirmed_at = COALESCE(auth.users.email_confirmed_at, now()),
      confirmation_token = COALESCE(auth.users.confirmation_token, ''),
      recovery_token = COALESCE(auth.users.recovery_token, ''),
      email_change = COALESCE(auth.users.email_change, ''),
      email_change_token_new = COALESCE(auth.users.email_change_token_new, ''),
      is_sso_user = COALESCE(auth.users.is_sso_user, FALSE),
      raw_app_meta_data = EXCLUDED.raw_app_meta_data,
      raw_user_meta_data = EXCLUDED.raw_user_meta_data,
      updated_at = now();

    -- Vệ sinh triệt để tránh trường hợp các cột token bị NULL gây lỗi GoTrue 500
    UPDATE auth.users
       SET confirmation_token = COALESCE(confirmation_token, ''),
           recovery_token = COALESCE(recovery_token, ''),
           email_change = COALESCE(email_change, ''),
           email_change_token_new = COALESCE(email_change_token_new, ''),
           is_sso_user = COALESCE(is_sso_user, FALSE)
     WHERE id = v_user_id;

    DELETE FROM auth.identities
    WHERE user_id = v_user_id
       OR (provider = 'email' AND (
              provider_id = v_user_id::text
           OR provider_id = lower(trim(p_email))
           OR identity_data->>'email' = lower(trim(p_email))
       ));

    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id, 
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_ident_id, v_user_id, 
      jsonb_build_object('sub', v_user_id::text, 'email', lower(trim(p_email)), 'email_verified', true, 'phone_verified', false), 
      'email', v_provider_id, 
      now(), now(), now()
    );
  END;

  -- Tuân thủ Account Creation Role Invariant: profiles.role luôn là 'member'
  INSERT INTO public.profiles (id, email, full_name, status, role)
  VALUES (v_user_id, lower(trim(p_email)), trim(p_full_name), 'active', 'member')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    status = 'active';

  INSERT INTO public.user_roles (user_id, role_id)
  VALUES (v_user_id, v_role_id)
  ON CONFLICT (user_id, role_id) DO NOTHING;

  BEGIN
    PERFORM public.insert_audit_log('ADMIN_CREATE_ACCOUNT', 'user', v_user_id::text, jsonb_build_object('email', p_email, 'role', p_role_code), NULL);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object('success', true, 'user_id', v_user_id);
END;
$$;

-- Sửa ngay lập tức toàn bộ tài khoản bị lỗi GoTrue HTTP 500 (do lệch provider_id hoặc token NULL)
UPDATE auth.identities i
SET provider_id = i.user_id::text,
    identity_data = jsonb_build_object('sub', i.user_id::text, 'email', lower(trim(u.email)), 'email_verified', true, 'phone_verified', false)
FROM auth.users u
WHERE i.user_id = u.id AND i.provider = 'email' AND i.provider_id != i.user_id::text;

-- Xử lý triệt để tài khoản vinhtai@luathuysinh.vn và đồng bộ mật khẩu admin123@
DO $$
DECLARE
    v_user_id UUID;
    v_ref_inst UUID;
    v_ref_provider_id TEXT;
    v_target_provider_id TEXT;
    v_ref_user_id UUID;
    v_col TEXT;
    v_cols TEXT[] := ARRAY[
        'confirmation_token',
        'recovery_token',
        'email_change',
        'email_change_token_new',
        'email_change_token_current',
        'phone_change',
        'phone_change_token',
        'reauthentication_token'
    ];
BEGIN
    -- 1. Quét sạch tất cả các cột token bị NULL trên toàn bộ bảng auth.users
    FOR v_col IN SELECT unnest(v_cols) LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = v_col
        ) THEN
            EXECUTE format('UPDATE auth.users SET %I = '''' WHERE %I IS NULL', v_col, v_col);
        END IF;
    END LOOP;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'is_sso_user'
    ) THEN
        EXECUTE 'UPDATE auth.users SET is_sso_user = FALSE WHERE is_sso_user IS NULL';
    END IF;

    -- 2. Tìm user vinhtai@luathuysinh.vn
    SELECT id INTO v_user_id FROM auth.users WHERE lower(trim(email)) = 'vinhtai@luathuysinh.vn' LIMIT 1;
    IF v_user_id IS NOT NULL THEN
        -- Lấy instance_id chuẩn từ admin@luathuysinh.vn
        SELECT instance_id INTO v_ref_inst FROM auth.users WHERE lower(trim(email)) = 'admin@luathuysinh.vn' LIMIT 1;
        IF v_ref_inst IS NULL THEN
            SELECT id INTO v_ref_inst FROM auth.instances LIMIT 1;
        END IF;
        IF v_ref_inst IS NULL THEN
            v_ref_inst := '00000000-0000-0000-0000-000000000000'::uuid;
        END IF;

        -- Cập nhật mật khẩu chuẩn bcrypt cho admin123@ và metadata chuẩn GoTrue
        UPDATE auth.users
        SET instance_id = v_ref_inst,
            aud = 'authenticated',
            role = 'authenticated',
            encrypted_password = extensions.crypt('admin123@', extensions.gen_salt('bf', 10)),
            email_confirmed_at = COALESCE(email_confirmed_at, now()),
            raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
            raw_user_meta_data = '{"full_name":"Vĩnh Tài","name":"Vĩnh Tài"}'::jsonb,
            banned_until = NULL,
            deleted_at = NULL,
            updated_at = now()
        WHERE id = v_user_id;

        -- Xác định provider_id theo chuẩn của project
        SELECT id INTO v_ref_user_id FROM auth.users WHERE lower(trim(email)) = 'admin@luathuysinh.vn' LIMIT 1;
        IF v_ref_user_id IS NOT NULL THEN
            SELECT provider_id INTO v_ref_provider_id FROM auth.identities WHERE user_id = v_ref_user_id LIMIT 1;
        END IF;

        IF v_ref_provider_id = 'admin@luathuysinh.vn' THEN
            v_target_provider_id := 'vinhtai@luathuysinh.vn';
        ELSE
            v_target_provider_id := v_user_id::text;
        END IF;

        -- Tái tạo bản ghi auth.identities
        DELETE FROM auth.identities 
        WHERE user_id = v_user_id 
           OR (provider = 'email' AND (provider_id = v_user_id::text OR provider_id = 'vinhtai@luathuysinh.vn'));

        INSERT INTO auth.identities (
            id, user_id, identity_data, provider, provider_id,
            last_sign_in_at, created_at, updated_at
        ) VALUES (
            gen_random_uuid(),
            v_user_id,
            jsonb_build_object(
                'sub', v_user_id::text,
                'email', 'vinhtai@luathuysinh.vn',
                'email_verified', true,
                'phone_verified', false
            ),
            'email',
            v_target_provider_id,
            now(),
            now(),
            now()
        );

        -- Đảm bảo profiles và user_roles
        INSERT INTO public.profiles (id, email, full_name, status, role)
        VALUES (v_user_id, 'vinhtai@luathuysinh.vn', 'Vĩnh Tài', 'active', 'member')
        ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            full_name = EXCLUDED.full_name,
            status = 'active';

        IF EXISTS (SELECT 1 FROM public.roles WHERE code = 'SUPPORT_ADMIN') THEN
            INSERT INTO public.user_roles (user_id, role_id)
            SELECT v_user_id, id FROM public.roles WHERE code = 'SUPPORT_ADMIN'
            ON CONFLICT (user_id, role_id) DO NOTHING;
        END IF;
    END IF;
END $$;

-- Cung cấp RPC admin_repair_user_auth tự phục hồi đăng nhập nếu xảy ra sự cố
CREATE OR REPLACE FUNCTION public.admin_repair_user_auth(
    p_email TEXT,
    p_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth
AS $$
DECLARE
    v_user_id UUID;
    v_email TEXT;
    v_full_name TEXT;
    v_hash TEXT;
BEGIN
    v_email := lower(trim(p_email));
    IF v_email IS NULL OR v_email = '' OR position('@' IN v_email) < 2 THEN
        RAISE EXCEPTION 'Email không hợp lệ.';
    END IF;
    IF p_password IS NULL OR length(p_password) < 6 THEN
        RAISE EXCEPTION 'Mật khẩu phải có ít nhất 6 ký tự.';
    END IF;

    SELECT u.id, COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name')
      INTO v_user_id, v_full_name
      FROM auth.users u
     WHERE lower(trim(u.email)) = v_email
     ORDER BY u.created_at NULLS LAST
     LIMIT 1;

    IF v_user_id IS NULL THEN
        SELECT p.id, p.full_name
          INTO v_user_id, v_full_name
          FROM public.profiles p
         WHERE lower(trim(p.email)) = v_email
         LIMIT 1;
    END IF;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Không tìm thấy tài khoản cho email này.';
    END IF;

    v_full_name := COALESCE(NULLIF(trim(v_full_name), ''), split_part(v_email, '@', 1));
    v_hash := extensions.crypt(p_password, extensions.gen_salt('bf', 10));

    UPDATE auth.users
       SET email = v_email,
           encrypted_password = v_hash,
           email_confirmed_at = COALESCE(email_confirmed_at, now()),
           confirmation_token = COALESCE(confirmation_token, ''),
           recovery_token = COALESCE(recovery_token, ''),
           email_change = COALESCE(email_change, ''),
           email_change_token_new = COALESCE(email_change_token_new, ''),
           is_sso_user = COALESCE(is_sso_user, FALSE),
           raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
           raw_user_meta_data = jsonb_build_object('full_name', v_full_name, 'name', v_full_name),
           banned_until = NULL,
           deleted_at = NULL,
           updated_at = now()
     WHERE id = v_user_id;

    DELETE FROM auth.identities
     WHERE user_id = v_user_id
        OR (provider = 'email' AND (
               provider_id = v_user_id::text
            OR provider_id = v_email
            OR identity_data->>'email' = v_email
        ));

    INSERT INTO auth.identities (
        id, user_id, identity_data, provider, provider_id,
        last_sign_in_at, created_at, updated_at
    ) VALUES (
        gen_random_uuid(), v_user_id,
        jsonb_build_object('sub', v_user_id::text, 'email', v_email,
                           'email_verified', true, 'phone_verified', false),
        'email', v_user_id::text, now(), now(), now()
    );

    UPDATE public.profiles
       SET email = v_email, full_name = v_full_name, status = 'active', updated_at = now()
     WHERE id = v_user_id;

    RETURN jsonb_build_object('success', true, 'user_id', v_user_id, 'email', v_email);
END;
$$;

-- =========================================================================
-- PHẦN 9: CẤP QUYỀN THI HÀNH (GRANTS) & LÀM MỚI SCHEMA CACHE
-- =========================================================================
GRANT EXECUTE ON FUNCTION public.admin_get_global_orders TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_generate_license_keys TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.apply_license_key TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.redeem_license_key TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.process_payment_webhook TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_create_admin_account(TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_repair_user_auth(TEXT, TEXT) TO anon, authenticated, service_role;

-- Gửi tín hiệu reload schema cache cho PostgREST ngay lập tức
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
