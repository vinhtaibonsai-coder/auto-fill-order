-- =========================================================================
-- v21_system_configs_safe_rpc.sql
-- CHẶN LỘ: cấu hình cần cho client/extension phải qua RPC an toàn,
-- không SELECT thẳng REST (matrix: rủi ro #1).
--
-- Vì extension còn phụ thuộc `groq_api_keys` từ system_configs cho đến khi
-- Gateway live, ta KHÔNG REVOKE SELECT ngay — thay vào đó:
--   1. Tạo RPC	`get_system_config_value(p_key)` — trả value; nếu p_key là
--      `groq_api_keys` thì CHỈ trả khi hệ thống admin; còn lại trả bình thường.
--   2. Tạo RPC   `admin_upsert_system_config(p_key, p_value, p_description)`
--      guard is_system_admin — thay cho upsert REST của admin-dashboard.
--  Khi Gateway live -> REVOKE SELECT system_configs khỏi authenticated/anon
--  và chuyển mọi client sang dùng 2 RPC này.
-- =========================================================================

-- ---------------------------------------------------------------------
-- 1. RPC đọc cấu hình an toàn (mask bí mật cho non-admin)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_system_config_value(
    p_key TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
    v_value JSONB;
    v_secret BOOLEAN;
BEGIN
    -- Không cho phép chọn bảng, chỉ 1 key tại thời gian; kiểm tra tồn tại.
    IF p_key IS NULL OR length(p_key) > 64 THEN
        RAISE EXCEPTION 'INVALID_KEY';
    END IF;

    v_secret := (p_key IN ('groq_api_keys'));

    SELECT sc.value INTO v_value
    FROM public.system_configs sc
    WHERE sc.key = p_key
    LIMIT 1;

    -- Không có cấu hình -> trả null, đừng lộ.
    IF v_value IS NULL THEN
        RETURN NULL;
    END IF;

    -- Key nhạy cảm: chỉ SYSTEM_ADMIN đọc được; nếu không phải admin → NULL.
    IF v_secret AND NOT public.is_system_admin() THEN
        RETURN NULL;
    END IF;

    RETURN v_value;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_system_config_value(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_system_config_value(TEXT) TO service_role;

-- ---------------------------------------------------------------------
-- 2. RPC cập	nhật cấu hình (thay upsert REST)  -- guard admin
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_system_config(
    p_key TEXT,
    p_value JSONB,
    p_description TEXT DEFAULT NULL
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NOT public.is_system_admin() THEN
        RAISE EXCEPTION 'ACCESS_DENIED';
    END IF;

    INSERT INTO public.system_configs (key, value, description, updated_at)
    VALUES (p_key, p_value, COALESCE(p_description, p_key), now())
    ON CONFLICT (key)
    DO UPDATE SET value = EXCLUDED.value,
                  description = EXCLUDED.description,
                  updated_at = now();

    RETURN 'OK';
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_system_config(TEXT, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_system_config(TEXT, JSONB, TEXT) TO service_role;

-- ---------------------------------------------------------------------
-- GHI CHÚ:
--   - `groq_api_keys` giờ chỉ đọc được qua service_role hoặc RPC cho
--     SYSTEM_ADMIN; client thường thấy NULL.
--   - Bước REVOKE SELECT toàn bộ authenticated/anon từ system_configs
--     sẽ được bắn khi mã nguồn extension/admin đã chuyển sang RPC này.
-- =========================================================================