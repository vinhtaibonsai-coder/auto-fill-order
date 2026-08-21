-- =========================================================================
-- v47_prevent_fake_shops.sql
-- Cập nhật hạn mức mặc định của Shop mới về gói FREE chuẩn và bổ sung trigger
-- giới hạn số lượng Shop tối đa trên mỗi tài khoản để chặn lạm dụng shop ảo.
-- =========================================================================

-- 1. Hàm get_user_max_shops: Tính toán số lượng shop tối đa một user được sở hữu dựa trên phân quyền/gói cước
CREATE OR REPLACE FUNCTION public.get_user_max_shops(p_user_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_shops INT := 1; -- Mặc định gói FREE chỉ được sở hữu tối đa 1 shop hoạt động
  v_is_admin BOOLEAN := false;
  v_has_paid_sub BOOLEAN := false;
BEGIN
  -- 1a. Kiểm tra nếu là SYSTEM_ADMIN hoặc SUPPORT
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = p_user_id AND r.code IN ('SYSTEM_ADMIN', 'SUPPORT')
  ) INTO v_is_admin;

  IF v_is_admin THEN
    RETURN 999; -- Admin hệ thống không bị giới hạn shop
  END IF;

  -- 1b. Kiểm tra xem user này có sở hữu shop nào có subscription hoạt động gói PRO hoặc BUSINESS không
  SELECT EXISTS (
    SELECT 1 FROM public.shops s
    JOIN public.subscriptions sub ON sub.shop_id = s.id
    WHERE s.owner_id = p_user_id
      AND s.deleted_at IS NULL
      AND sub.status IN ('active', 'trialing')
      AND sub.plan_code IN ('PRO', 'BUSINESS')
  ) INTO v_has_paid_sub;

  IF v_has_paid_sub THEN
    RETURN 10; -- Có gói trả phí thì được tạo tối đa 10 chi nhánh/shop
  END IF;

  RETURN v_max_shops;
END;
$$;

-- 2. Trigger Function và Trigger giới hạn số lượng shop hoạt động trên mỗi Owner
CREATE OR REPLACE FUNCTION public.trg_limit_shops_per_owner_func()
RETURNS TRIGGER AS $$
DECLARE
  v_max_shops INT;
  v_current_shops INT;
BEGIN
  -- Chỉ kiểm tra đối với các shop hoạt động (không bị soft delete)
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Lấy giới hạn shop của user
  v_max_shops := public.get_user_max_shops(NEW.owner_id);

  -- Đếm số shop hoạt động hiện tại (loại trừ chính shop đang cập nhật nếu là UPDATE)
  SELECT COUNT(*) INTO v_current_shops
  FROM public.shops
  WHERE owner_id = NEW.owner_id
    AND deleted_at IS NULL
    AND id <> NEW.id;

  IF v_current_shops >= v_max_shops THEN
    RAISE EXCEPTION 'Tài khoản của bạn chỉ được sở hữu tối đa % cửa hàng hoạt động ở gói cước hiện tại. Vui lòng nâng cấp gói cước để thêm chi nhánh/cửa hàng mới.', v_max_shops;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_limit_shops_per_owner ON public.shops;
CREATE TRIGGER trg_limit_shops_per_owner
BEFORE INSERT OR UPDATE OF owner_id, deleted_at ON public.shops
FOR EACH ROW
EXECUTE FUNCTION public.trg_limit_shops_per_owner_func();


-- 3. Cập nhật hàm consume_ai_quota để tự động khởi tạo quota gói FREE chuẩn (50 daily / 1000 monthly) khi thiếu dòng
CREATE OR REPLACE FUNCTION public.consume_ai_quota(
    p_shop_id UUID,
    p_delta INT DEFAULT 1,
    p_prompt_tokens INT DEFAULT 0,
    p_completion_tokens INT DEFAULT 0,
    p_request_type TEXT DEFAULT 'parse',
    p_device_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_daily_limit INT;
    v_daily_used  INT;
    v_monthly_limit INT;
    v_monthly_used  INT;
BEGIN
    -- 1) Điều kiện: user phải thuộc shop (hoặc SYSTEM_ADMIN)
    IF NOT public.check_shop_member_or_admin(p_shop_id) THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'ACCESS_DENIED',
            'message', 'Tài khoản không thuộc shop này.'
        );
    END IF;

    -- Tự động tạo quota gói FREE chuẩn nếu thiếu (max_devices = 1, max_users = 1, daily_ai_limit = 50, monthly_ai_limit = 1000)
    INSERT INTO public.shop_quotas (shop_id, max_devices, max_users, monthly_order_limit, daily_ai_limit, monthly_ai_limit)
    VALUES (p_shop_id, 1, 1, 300, 50, 1000)
    ON CONFLICT (shop_id) DO NOTHING;

    -- 2) Chuẩn hoá bucket tháng (reset khi sang tháng mới)
    PERFORM _ai_refresh_monthly_window(p_shop_id);

    -- 3) ATOMIC UPDATE: điều kiện giới hạn nằm NGAY trong WHERE
    UPDATE public.shop_quotas q
    SET
        daily_ai_used = CASE
            WHEN q.daily_reset_at::date <> CURRENT_DATE THEN 0
            ELSE q.daily_ai_used
        END + p_delta,
        daily_reset_at = CASE
            WHEN q.daily_reset_at::date <> CURRENT_DATE THEN now()
            ELSE q.daily_reset_at
        END,
        monthly_ai_used = q.monthly_ai_used + p_delta,
        updated_at = now()
    WHERE q.shop_id = p_shop_id
      AND (
            CASE WHEN q.daily_reset_at::date <> CURRENT_DATE THEN p_delta
                 ELSE q.daily_ai_used + p_delta END
          ) <= COALESCE(q.daily_ai_limit, 50)
      AND (q.monthly_ai_used + p_delta) <= COALESCE(q.monthly_ai_limit, 1000)
    RETURNING q.daily_ai_limit, q.daily_ai_used, q.monthly_ai_limit, q.monthly_ai_used
    INTO v_daily_limit, v_daily_used, v_monthly_limit, v_monthly_used;

    -- 4) Không matching -> hết quota (hoặc daily_ai_limit là null)
    IF NOT FOUND THEN
        SELECT COALESCE(daily_ai_limit, 50),
               COALESCE(monthly_ai_limit, 1000)
        INTO v_daily_limit, v_monthly_limit
        FROM public.shop_quotas WHERE shop_id = p_shop_id;

        INSERT INTO public.ai_usage_log
            (shop_id, user_id, device_id, request_type, status)
        VALUES
            (p_shop_id, auth.uid(), p_device_id, p_request_type, 'quota_exceeded');

        RETURN jsonb_build_object(
            'success', false,
            'code', 'AI_QUOTA_EXCEEDED',
            'message', 'Shop đã hết hạn mức AI.',
            'daily_remaining', 0,
            'monthly_remaining', 0
        );
    END IF;

    -- 5) Ghi usage (thành công)
    INSERT INTO public.ai_usage_log
        (shop_id, user_id, device_id, request_type, prompt_tokens, completion_tokens, status)
    VALUES
        (p_shop_id, auth.uid(), p_device_id, p_request_type, p_prompt_tokens, p_completion_tokens, 'success');

    RETURN jsonb_build_object(
        'success', true,
        'daily_used', v_daily_used,
        'daily_limit', v_daily_limit,
        'daily_remaining', GREATEST(v_daily_limit - v_daily_used, 0),
        'monthly_used', v_monthly_used,
        'monthly_limit', v_monthly_limit,
        'monthly_remaining', GREATEST(v_monthly_limit - v_monthly_used, 0)
    );
END;
$$;


-- 4. Cập nhật get_ai_budget để tự tạo quota gói FREE chuẩn khi thiếu dòng
CREATE OR REPLACE FUNCTION public.get_ai_budget(p_shop_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_shop_id UUID;
    v_row     RECORD;
BEGIN
    IF p_shop_id IS NULL THEN
        SELECT shop_id INTO v_shop_id
        FROM public.shop_members sm
        WHERE sm.user_id = auth.uid()
          AND sm.status = 'active'
          AND sm.removed_at IS NULL
        ORDER BY sm.created_at ASC
        LIMIT 1;
    ELSE
        v_shop_id := p_shop_id;
    END IF;

    IF v_shop_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'code', 'AI_SHOP_REQUIRED',
            'message', 'Shop chưa xác định.');
    END IF;

    IF NOT public.check_shop_member_or_admin(v_shop_id) THEN
        RETURN jsonb_build_object('success', false, 'code', 'ACCESS_DENIED');
    END IF;

    -- Tự sinh quota gói FREE chuẩn nếu thiếu (max_devices = 1, max_users = 1, daily_ai_limit = 50, monthly_ai_limit = 1000)
    INSERT INTO public.shop_quotas (shop_id, max_devices, max_users, monthly_order_limit, daily_ai_limit, monthly_ai_limit)
    VALUES (v_shop_id, 1, 1, 300, 50, 1000)
    ON CONFLICT (v_shop_id) DO NOTHING;

    PERFORM _ai_refresh_monthly_window(v_shop_id);

    SELECT daily_ai_limit, daily_ai_used, monthly_ai_limit, monthly_ai_used
    INTO v_row
    FROM public.shop_quotas WHERE shop_id = v_shop_id;

    IF v_row IS NULL THEN
        RETURN jsonb_build_object('success', false, 'code', 'AI_QUOTA_NOT_FOUND',
            'message', 'Không tìm thấy thông tin hạn mức của shop.');
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'daily_used', v_row.daily_ai_used,
        'daily_limit', v_row.daily_ai_limit,
        'daily_remaining', GREATEST(v_row.daily_ai_limit - v_row.daily_ai_used, 0),
        'monthly_used', v_row.monthly_ai_used,
        'monthly_limit', v_row.monthly_ai_limit,
        'monthly_remaining', GREATEST(v_row.monthly_ai_limit - v_row.monthly_ai_used, 0)
    );
END;
$$;


-- 5. Cập nhật get_my_extension_session để siết chặt hạn ngạch thiết bị, số nhân viên mặc định của gói FREE
CREATE OR REPLACE FUNCTION public.get_my_extension_session(
  p_shop_id UUID DEFAULT NULL,
  p_device_id TEXT DEFAULT NULL,
  p_device_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_shop_id UUID;
  v_result  JSONB;
  v_max_devices INT := 1; -- Đổi mặc định từ 5 xuống 1
  v_is_allowed BOOLEAN := true;
  v_device_limit_exceeded BOOLEAN := false;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'UNAUTHENTICATED');
  END IF;

  -- 5a. Xác định shop_id
  IF p_shop_id IS NOT NULL THEN
    v_shop_id := p_shop_id;
  ELSE
    SELECT sm.shop_id INTO v_shop_id
    FROM shop_members sm
    WHERE sm.user_id = v_user_id
      AND sm.status  = 'active'
      AND sm.removed_at IS NULL
    ORDER BY sm.joined_at ASC
    LIMIT 1;
  END IF;

  -- 5b. Đăng ký/cập nhật thông tin thiết bị và last_seen nếu có p_device_id
  IF p_device_id IS NOT NULL AND v_shop_id IS NOT NULL THEN
    INSERT INTO public.extension_devices (user_id, device_id, device_name, browser, last_seen, revoked)
    VALUES (v_user_id, p_device_id, COALESCE(p_device_name, 'Chrome Extension'), 'Chrome', now(), false)
    ON CONFLICT (user_id, device_id)
    DO UPDATE SET 
      device_name = COALESCE(p_device_name, public.extension_devices.device_name),
      last_seen = now(),
      browser = 'Chrome';
  END IF;

  -- 5c. Xử lý trường hợp không thuộc shop nào (chỉ hệ thống admin được truy cập)
  IF v_shop_id IS NULL THEN
    IF EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = v_user_id AND r.code = 'SYSTEM_ADMIN'
    ) THEN
      RETURN jsonb_build_object(
        'role',                  'SYSTEM_ADMIN',
        'shop_id',               NULL,
        'shop_name',             'System',
        'status',                'active',
        'permissions',           '["*"]'::JSONB,
        'features', jsonb_build_object(
          'ai_parsing_enabled',      true,
          'smart_address_enabled',   true,
          'vnpost_autofill_enabled', true,
          'jt_autofill_enabled',     true
        ),
        'max_devices',           999,
        'max_users',             999,
        'monthly_order_limit',   999999,
        'custom_prompt_rules',   '',
        'device_limit_exceeded', false
      );
    END IF;
    RETURN jsonb_build_object('error', 'NOT_IN_ANY_SHOP');
  END IF;

  -- 5d. Đọc giới hạn max_devices của shop (Mặc định gói FREE: 1 thiết bị)
  SELECT COALESCE(sq.max_devices, 1) INTO v_max_devices
  FROM public.shop_quotas sq
  WHERE sq.shop_id = v_shop_id;

  -- 5e. Kiểm tra giới hạn thiết bị hoạt động thực tế (dựa trên last_seen DESC)
  IF p_device_id IS NOT NULL THEN
    -- Nếu thiết bị đã bị đánh dấu revoked = true
    IF EXISTS (
      SELECT 1 FROM public.extension_devices 
      WHERE user_id = v_user_id AND device_id = p_device_id AND revoked = true
    ) THEN
      v_device_limit_exceeded := true;
    ELSE
      -- Xếp hạng các thiết bị hoạt động của shop để chỉ cho phép top max_devices thiết bị hoạt động gần nhất
      WITH ranked_devices AS (
        SELECT d.device_id,
               ROW_NUMBER() OVER (ORDER BY d.last_seen DESC) as rank
        FROM public.extension_devices d
        JOIN public.shop_members sm ON sm.user_id = d.user_id
        WHERE sm.shop_id = v_shop_id
          AND sm.status = 'active'
          AND sm.removed_at IS NULL
          AND d.revoked = false
      )
      SELECT EXISTS (
        SELECT 1 FROM ranked_devices 
        WHERE device_id = p_device_id AND rank <= v_max_devices
      ) INTO v_is_allowed;
      
      IF NOT v_is_allowed THEN
        v_device_limit_exceeded := true;
      END IF;
    END IF;
  END IF;

  -- 5f. Trả về cấu hình chi tiết với các giá trị COALESCE gói FREE chuẩn (max_users = 1, monthly_order_limit = 300)
  RETURN (
    SELECT jsonb_build_object(
      'shop_id',               sm.shop_id,
      'shop_name',             s.name,
      'role',                  r.code,
      'status',                sm.status,
      'permissions',           COALESCE(sm.permissions, '[]'::JSONB),
      'features', jsonb_build_object(
        'ai_parsing_enabled',      COALESCE(ff.ai_parsing_enabled, true),
        'smart_address_enabled',   COALESCE(ff.smart_address_enabled, true),
        'vnpost_autofill_enabled', COALESCE(ff.vnpost_autofill_enabled, true),
        'jt_autofill_enabled',     COALESCE(ff.jt_autofill_enabled, true)
      ),
      'member_id',             sm.id,
      'joined_at',             sm.joined_at,
      'max_devices',           v_max_devices,
      'max_users',             COALESCE(sq.max_users, 1),
      'monthly_order_limit',   COALESCE(sq.monthly_order_limit, 300),
      'custom_prompt_rules',   COALESCE(ff.custom_prompt_rules, ''),
      'device_limit_exceeded', v_device_limit_exceeded
    )
    FROM shop_members sm
    JOIN roles r ON r.id = sm.role_id
    JOIN shops s ON s.id = sm.shop_id
    LEFT JOIN shop_feature_flags ff ON ff.shop_id = sm.shop_id
    LEFT JOIN shop_quotas sq ON sq.shop_id = sm.shop_id
    WHERE sm.user_id    = v_user_id
      AND sm.shop_id    = v_shop_id
      AND sm.status     = 'active'
      AND sm.removed_at IS NULL
  );
END;
$$;

-- Cấp quyền thực thi RPC
GRANT EXECUTE ON FUNCTION public.get_user_max_shops(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_max_shops(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_ai_quota(UUID, INT, INT, INT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_ai_quota(UUID, INT, INT, INT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_ai_budget(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ai_budget(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_my_extension_session(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_extension_session(UUID, TEXT, TEXT) TO service_role;

COMMENT ON FUNCTION public.get_user_max_shops IS 'Lấy số lượng shop tối đa được phép sở hữu theo phân quyền.';
COMMENT ON FUNCTION public.trg_limit_shops_per_owner_func IS 'Trigger chặn việc tạo shop vượt giới hạn cho phép.';
