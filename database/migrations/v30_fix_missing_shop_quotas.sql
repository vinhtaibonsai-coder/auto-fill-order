-- v30_fix_missing_shop_quotas.sql
-- Tự động tạo shop_quotas cho những shop bị thiếu
-- Sửa lại hàm consume_ai_quota để tự sinh quota nếu shop chưa có

-- 1. Chèn shop_quotas cho những shop chưa có
INSERT INTO public.shop_quotas (shop_id, daily_ai_limit, monthly_ai_limit)
SELECT id, 500, 10000
FROM public.shops
WHERE id NOT IN (SELECT shop_id FROM public.shop_quotas);

-- 2. Cập nhật hàm consume_ai_quota để tự động xử lý khi thiếu dòng
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

    -- Tự động tạo quota nếu thiếu
    INSERT INTO public.shop_quotas (shop_id, daily_ai_limit, monthly_ai_limit)
    VALUES (p_shop_id, 500, 10000)
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
          ) <= COALESCE(q.daily_ai_limit, 500)
      AND (q.monthly_ai_used + p_delta) <= COALESCE(q.monthly_ai_limit, 10000)
    RETURNING q.daily_ai_limit, q.daily_ai_used, q.monthly_ai_limit, q.monthly_ai_used
    INTO v_daily_limit, v_daily_used, v_monthly_limit, v_monthly_used;

    -- 4) Không matching -> hết quota (hoặc daily_ai_limit là null)
    IF NOT FOUND THEN
        SELECT COALESCE(daily_ai_limit, 500),
               COALESCE(monthly_ai_limit, 10000)
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

-- 3. Cập nhật get_ai_budget để tự tạo quota nếu thiếu
CREATE OR REPLACE FUNCTION public.get_ai_budget(p_shop_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
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

    -- Tự sinh quota nếu thiếu
    INSERT INTO public.shop_quotas (shop_id, daily_ai_limit, monthly_ai_limit)
    VALUES (v_shop_id, 500, 10000)
    ON CONFLICT (shop_id) DO NOTHING;

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
