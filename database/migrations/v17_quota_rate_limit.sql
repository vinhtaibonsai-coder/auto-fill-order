-- =========================================================================
-- v17_quota_rate_limit.sql
-- AI GATEWAY TẦNG DATABASE: QUOTA ATOMIC + RATE LIMIT + USAGE LOG.
--
-- Nguyên tắc (xem phần 30/35/36 của review):
--   1. QUOTA PHẢI ATOMIC - không SELECT rồi UPDATE ở JS (race condition).
--      Dùng 1 câu UPDATE ... WHERE used < limit RETURNING ... duy nhất.
--   2. RATE LIMIT tầng 3 (Database) - bổ sung cho debounce (extension)
--      và rate-limit (Edge Function, sẽ làm sau).
--   3. Trả mã lỗi chuẩn để extension hiển thị:
--        AI_QUOTA_EXCEEDED   -> "Shop đã hết hạn mức AI."
--        AI_RATE_LIMITED     -> "Quá nhiều yêu cầu, chờ một lúc."
--        AI_SHOP_REQUIRED    -> "Tài khoản chưa gắn shop."
--
-- =========================================================================

-- =====================================================================
-- 1. THÊM CỘT SỬ DỤNG THỰC TẾ VÀO shop_quotas
--    daily_ai_used   : số đơn AI đã dùng hôm nay
--    daily_reset_at  : mốc hôm nay (reset window theo ngày)
--    monthly_ai_limit: giới hạn tháng (mặc định 10.000)
--    monthly_ai_used : số đơn AI tháng này
--    monthly_tag     : chuỗi 'YYYY-MM' đang đếm
-- =====================================================================
ALTER TABLE public.shop_quotas ADD COLUMN IF NOT EXISTS daily_ai_used INT DEFAULT 0;
ALTER TABLE public.shop_quotas ADD COLUMN IF NOT EXISTS daily_reset_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.shop_quotas ADD COLUMN IF NOT EXISTS monthly_ai_limit INT DEFAULT 10000;
ALTER TABLE public.shop_quotas ADD COLUMN IF NOT EXISTS monthly_ai_used INT DEFAULT 0;
ALTER TABLE public.shop_quotas ADD COLUMN IF NOT EXISTS monthly_tag TEXT DEFAULT to_char(now(), 'YYYY-MM');

CREATE INDEX IF NOT EXISTS idx_shop_quotas_shop_id ON public.shop_quotas (shop_id);

-- =====================================================================
-- BẢNG LOG: mỗi lần dùng AI ghi 1 dòng (phục vụ rate limit + audit + kế toán)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.ai_usage_log (
    id BIGSERIAL PRIMARY KEY,
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id),
    device_id TEXT,
    request_type TEXT NOT NULL DEFAULT 'parse',      -- parse / address / other
    prompt_tokens INT DEFAULT 0,
    completion_tokens INT DEFAULT 0,
    status TEXT DEFAULT 'success',                   -- success / quota_exceeded / rate_limited / error
    rate_bucket TEXT,                               -- 'YYYY-MM-DD HH24:00' hiện đang dùng
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_shop_created
    ON public.ai_usage_log (shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_created
    ON public.ai_usage_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_bucket
    ON public.ai_usage_log (shop_id, rate_bucket);

ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

-- Members của shop được đọc usage log của chính shop mình (phục vụ metric)
DROP POLICY IF EXISTS "Shop members can read their ai usage" ON public.ai_usage_log;
CREATE POLICY "Shop members can read their ai usage" ON public.ai_usage_log
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.shop_members sm
            WHERE sm.shop_id = ai_usage_log.shop_id
              AND sm.user_id = auth.uid()
              AND sm.status = 'active'
              AND sm.removed_at IS NULL
        )
    );

-- =====================================================================
-- HELPER: người gọi có thuộc shop / là admin không?
-- Dùng trong tất cả RPC quota dưới đây.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.check_shop_member_or_admin(p_shop_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.shop_members sm
        WHERE sm.shop_id = p_shop_id
          AND sm.user_id = auth.uid()
          AND sm.status = 'active'
          AND sm.removed_at IS NULL
    ) OR public.is_system_admin();
END;
$$;

REVOKE ALL ON FUNCTION public.check_shop_member_or_admin(UUID) FROM PUBLIC;
-- (helper nội bộ dùng SECURITY DEFINER; chỉ cho extension gọi gián tiếp qua RPC)

-- =====================================================================
-- RPC 1: consume_ai_quota() — TIÊU THỤ QUOTA ATOMIC
--
-- Một câu UPDATE duy nhất, dùng RETURNING để:
--   - reset ngày/tháng khi hết window
--   - tăng counters
--   - trong cùng transaction → KHÔNG race condition
--
-- Trả về:
--   { success, remaining_daily, remaining_monthly, code }
--   Hoặc khi hết quota:
--   { success:false, code:'AI_QUOTA_EXCEEDED', ... }
-- =====================================================================
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
            CASE WHEN q.daily_reset_at::date <> CURRENT_DATE THEN p_delta -- ngày mới, bắt đầu từ 0
                 ELSE q.daily_ai_used + p_delta END
          ) <= q.daily_ai_limit
      AND (q.monthly_ai_used + p_delta) <= q.monthly_ai_limit
    RETURNING q.daily_ai_limit, q.daily_ai_used, q.monthly_ai_limit, q.monthly_ai_used
    INTO v_daily_limit, v_daily_used, v_monthly_limit, v_monthly_used;

    -- 4) Không matching -> hết quota (hoặc chưa có row)
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

-- window helper: tự reset monthly khi tháng mới thay vì chờ scheduled job
CREATE OR REPLACE FUNCTION public._ai_refresh_monthly_window(p_shop_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_current_tag TEXT DEFAULT to_char(now(), 'YYYY-MM');
BEGIN
    UPDATE public.shop_quotas
    SET monthly_tag = v_current_tag,
        monthly_ai_used = 0
    WHERE shop_id = p_shop_id
      AND monthly_tag IS DISTINCT FROM v_current_tag;
END;
$$;

-- =====================================================================
-- RPC 2: check_ai_budget() — KIỂM TRA CHỈ ĐỌC (extension gọi TRƯỚC khi
-- parsing để hiện cảnh báo "sắp hết", không được làm credential).
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_ai_budget(p_shop_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    v_shop_id UUID;
    v_row     RECORD;
BEGIN
    -- Không truyền shop_id thì lấy shop đang được gắn cho user đang đăng nhập
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

    SELECT daily_ai_limit, daily_ai_used, monthly_ai_limit, monthly_ai_used,
           daily_reset_at
    INTO v_row
    FROM public.shop_quotas WHERE shop_id = v_shop_id;

    IF v_row IS NULL THEN
        RETURN jsonb_build_object('success', false, 'code', 'AI_SHOP_REQUIRED',
            'message', 'Shop chưa có dữ liệu quota. Liên hệ admin.');
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'shop_id', v_shop_id,
        'daily_remaining', GREATEST(v_row.daily_ai_limit - v_row.daily_ai_used, 0),
        'daily_limit', v_row.daily_ai_limit,
        'monthly_remaining', GREATEST(v_row.monthly_ai_limit - v_row.monthly_ai_used, 0),
        'monthly_limit', v_row.monthly_ai_limit,
        'reset_at', v_row.daily_reset_at
    );
END;
$$;

-- =====================================================================
-- RPC 3: check_ai_rate_limit() — RATE LIMIT TẦNG DB (per shop / giờ).
-- Dùng cửa sổ TRƯỢT (sliding window) qua created_at -> đếm đúng từng giờ
-- hiện hành, không phụ thuộc thứ tự cập nhật bucket.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.check_ai_rate_limit(
    p_shop_id UUID DEFAULT NULL,
    p_max_per_hour INT DEFAULT 120
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    v_shop_id UUID;
    v_count   INT;
BEGIN
    IF p_shop_id IS NULL THEN
        SELECT shop_id INTO v_shop_id
        FROM public.shop_members sm
        WHERE sm.user_id = auth.uid()
          AND sm.status = 'active' AND sm.removed_at IS NULL
        ORDER BY sm.created_at ASC
        LIMIT 1;
    ELSE
        v_shop_id := p_shop_id;
    END IF;

    IF v_shop_id IS NULL OR NOT public.check_shop_member_or_admin(v_shop_id) THEN
        RETURN jsonb_build_object('success', false, 'code', 'ACCESS_DENIED');
    END IF;

    SELECT COUNT(*) INTO v_count
    FROM public.ai_usage_log
    WHERE shop_id = v_shop_id
      AND created_at >= now() - interval '1 hour';

    IF v_count >= p_max_per_hour THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'AI_RATE_LIMITED',
            'message', 'Quá nhiều yêu cầu AI trong giờ này. Vui lòng thử lại sau.'
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'used_in_hour', v_count,
        'limit_per_hour', p_max_per_hour
    );
END;
$$;

-- =====================================================================
-- GRANT
-- =====================================================================
GRANT EXECUTE ON FUNCTION public.consume_ai_quota(UUID, INT, INT, INT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_ai_quota(UUID, INT, INT, INT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_ai_budget(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ai_budget(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_ai_rate_limit(UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_ai_rate_limit(UUID, INT) TO service_role;

-- =====================================================================
-- GHI CHÚ:
--   - consume_ai_quota() là điểm DUY NHẤT tăng counter -> không race.
--   - rate limit là DB-level (tầng 3). Tầng 2 (Edge Function) và tầng 1
--     (extension debounce) sẽ bổ sung riêng ở bước AI Gateway (P0).
--   - extension nên gọi theo thứ tự:
--        get_ai_budget() (hiện cảnh báo nếu hết)
--        -> check_ai_rate_limit()
--        -> [AI Gateway sẽ thay chỗ này] -> consume_ai_quota()
--   - status 'quota_exceeded' vẫn ghi vào ai_usage_log để theo dõi.
-- =====================================================================