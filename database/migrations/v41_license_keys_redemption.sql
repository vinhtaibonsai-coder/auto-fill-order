-- =========================================================================
-- v41_license_keys_redemption.sql
-- Thêm bảng khóa bản quyền (license_keys), thiết lập ràng buộc duy nhất cho
-- subscriptions, và viết RPC redeem_license_key để kích hoạt bản quyền.
-- =========================================================================

-- 1. Đảm bảo bảng subscriptions có ràng buộc duy nhất theo shop_id
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS uq_subscriptions_shop_id;
ALTER TABLE public.subscriptions ADD CONSTRAINT uq_subscriptions_shop_id UNIQUE (shop_id);

-- 2. Tạo bảng khóa bản quyền
CREATE TABLE IF NOT EXISTS public.license_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_code TEXT UNIQUE NOT NULL,
  plan_code TEXT NOT NULL, -- FREE, PRO, BUSINESS
  duration_days INT NOT NULL,
  max_users INT NOT NULL,
  max_devices INT NOT NULL,
  max_ai_requests INT NOT NULL,
  redeemed_at TIMESTAMPTZ,
  redeemed_by_shop_id UUID REFERENCES public.shops(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Bật RLS cho bảng license_keys (Chỉ Admin xem toàn bộ, user không được ghi trực tiếp)
ALTER TABLE public.license_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view license keys" ON public.license_keys;
CREATE POLICY "Admins can view license keys" ON public.license_keys
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid() AND r.code = 'SYSTEM_ADMIN'
    )
  );

-- 3. Tạo RPC nạp thẻ/kích hoạt mã bản quyền
CREATE OR REPLACE FUNCTION public.redeem_license_key(
  p_shop_id UUID,
  p_key_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_key_record RECORD;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- 1. Xác thực người dùng
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Phiên đăng nhập hết hạn hoặc không hợp lệ.');
  END IF;

  -- 2. Kiểm tra quyền sở hữu/quản lý shop của người nạp
  IF NOT EXISTS (
    SELECT 1 FROM public.shop_members 
    WHERE shop_id = p_shop_id 
      AND user_id = v_user_id 
      AND role IN ('OWNER', 'SHOP_OWNER', 'MANAGER', 'SHOP_MANAGER')
      AND removed_at IS NULL
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bạn không có quyền quản lý cửa hàng này để kích hoạt bản quyền.');
  END IF;

  -- 3. Đọc và khóa bản ghi mã kích hoạt để tránh tranh chấp (Race Condition)
  SELECT * INTO v_key_record 
  FROM public.license_keys 
  WHERE key_code = UPPER(TRIM(p_key_code))
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mã kích hoạt này không tồn tại hoặc đã nhập sai.');
  END IF;

  IF v_key_record.redeemed_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mã kích hoạt này đã được sử dụng cho một cửa hàng khác.');
  END IF;

  -- 4. Đánh dấu mã đã sử dụng
  UPDATE public.license_keys
  SET redeemed_at = now(),
      redeemed_by_shop_id = p_shop_id
  WHERE id = v_key_record.id;

  -- 5. Tính toán ngày hết hạn mới
  v_expires_at := now() + (v_key_record.duration_days || ' days')::interval;

  -- 6. Ghi/Cập nhật thông tin gói cước của shop (Sẽ tự kích hoạt trigger sync sang shop_quotas)
  INSERT INTO public.subscriptions (
    shop_id,
    plan_code,
    status,
    current_period_start,
    current_period_end,
    max_users,
    max_devices,
    max_ai_requests,
    price_monthly
  )
  VALUES (
    p_shop_id,
    v_key_record.plan_code,
    'active',
    now(),
    v_expires_at,
    v_key_record.max_users,
    v_key_record.max_devices,
    v_key_record.max_ai_requests,
    CASE 
      WHEN v_key_record.plan_code = 'PRO' THEN 199000.00
      WHEN v_key_record.plan_code = 'BUSINESS' THEN 499000.00
      ELSE 0.00
    END
  )
  ON CONFLICT (shop_id)
  DO UPDATE SET
    plan_code = EXCLUDED.plan_code,
    status = 'active',
    current_period_start = now(),
    current_period_end = EXCLUDED.current_period_end,
    max_users = EXCLUDED.max_users,
    max_devices = EXCLUDED.max_devices,
    max_ai_requests = EXCLUDED.max_ai_requests,
    price_monthly = EXCLUDED.price_monthly,
    updated_at = now();

  -- 7. Ghi nhận log vào audit_logs
  INSERT INTO public.audit_logs
    (actor_id, target_user, shop_id, action, target_resource, target_id, new_value)
  VALUES
    (v_user_id, NULL, p_shop_id, 'REDEEM_LICENSE', 'license_keys', v_key_record.id::text, jsonb_build_object('plan_code', v_key_record.plan_code, 'key', p_key_code)::text);

  RETURN jsonb_build_object(
    'success', true,
    'plan_code', v_key_record.plan_code,
    'expires_at', v_expires_at
  );
END;
$$;

-- Cấp quyền thực thi RPC
GRANT EXECUTE ON FUNCTION public.redeem_license_key(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_license_key(UUID, TEXT) TO service_role;

-- 4. Thêm một số mã bản quyền mẫu để thử nghiệm (Gói PRO 30 ngày, 180 ngày; BUSINESS 365 ngày)
INSERT INTO public.license_keys (key_code, plan_code, duration_days, max_users, max_devices, max_ai_requests)
VALUES
  ('FREE-30D-TEST', 'FREE', 30, 2, 2, 100),
  ('PRO-30D-TEST', 'PRO', 30, 10, 5, 3000),
  ('PRO-180D-TEST', 'PRO', 180, 10, 5, 3000),
  ('BUS-365D-TEST', 'BUSINESS', 365, 50, 20, 20000)
ON CONFLICT (key_code) DO NOTHING;

COMMENT ON FUNCTION public.redeem_license_key IS 'RPC nạp mã khóa bản quyền nâng cấp gói cước và hạn ngạch của chi nhánh/shop.';
