-- =========================================================================
-- v34_harden_system_configs.sql
-- KHÓA BẢNG system_configs — VÁ LỖ HỔNG DO v26_system_configs_open_policy.sql
--
-- v26 đã tạo policy USING(true) / WITH CHECK(true) và GRANT ALL cho anon +
-- authenticated trên public.system_configs. Bảng này chứa `groq_api_keys`
-- (khóa nhà cung cấp AI), nên bất kỳ ai có anon key của project (anon key
-- nằm sẵn trong extension) đều đọc/ghi được.
--
-- Migration này forward-only:
--   1. Drop 2 policy mở của v26.
--   2. REVOKE toàn bộ quyền bảng khỏi anon + authenticated (chỉ service_role
--      còn quyền trực tiếp — Edge Function ai-gateway dùng service role).
--   3. Bổ sung RPC admin_get_system_config() để Admin Dashboard đọc cấu hình
--      (kèm updated_at) mà không cần SELECT thẳng REST. Ghi vẫn dùng
--      upsert_system_config() đã có từ v21 (guard is_system_admin).
--   4. Assertion: fail nếu vẫn còn policy/grant mở.
--
-- SAU KHI CHẠY: nếu `groq_api_keys` từng chứa key thật trong lúc v26 còn hiệu
-- lực thì phải coi như đã lộ → rotate key tại Groq trước khi lưu key mới.
-- =========================================================================

-- ---------------------------------------------------------------------
-- 1. Gỡ policy mở của v26
-- ---------------------------------------------------------------------
ALTER TABLE public.system_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_read_system_configs" ON public.system_configs;
DROP POLICY IF EXISTS "allow_write_system_configs" ON public.system_configs;

-- Không tạo policy thay thế: RLS bật + không có policy = deny toàn bộ với
-- anon/authenticated. service_role bypass RLS nên Edge Function vẫn đọc được.

-- ---------------------------------------------------------------------
-- 2. Thu hồi quyền bảng đã GRANT ở v26
-- ---------------------------------------------------------------------
REVOKE ALL ON TABLE public.system_configs FROM anon;
REVOKE ALL ON TABLE public.system_configs FROM authenticated;
GRANT ALL ON TABLE public.system_configs TO service_role;

-- ---------------------------------------------------------------------
-- 3. RPC đọc cấu hình cho Admin Dashboard (kèm updated_at)
--    Ghi: dùng public.upsert_system_config() từ v21 (đã guard is_system_admin).
--    Đọc key thường: dùng public.get_system_config_value() từ v21.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_get_system_config(
    p_key TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
    v_row RECORD;
BEGIN
    IF NOT public.is_system_admin() THEN
        RAISE EXCEPTION 'ACCESS_DENIED';
    END IF;

    IF p_key IS NULL OR length(p_key) > 64 THEN
        RAISE EXCEPTION 'INVALID_KEY';
    END IF;

    SELECT sc.value, sc.updated_at INTO v_row
    FROM public.system_configs sc
    WHERE sc.key = p_key
    LIMIT 1;

    IF v_row IS NULL THEN
        RETURN NULL;
    END IF;

    RETURN jsonb_build_object('value', v_row.value, 'updated_at', v_row.updated_at);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_system_config(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_system_config(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_system_config(TEXT) TO service_role;

-- ---------------------------------------------------------------------
-- 4. ASSERTION — chạy cuối, fail nếu bảng vẫn còn mở
-- ---------------------------------------------------------------------
DO $$
DECLARE
    v_open_policies INT;
    v_open_grants INT;
BEGIN
    SELECT count(*) INTO v_open_policies
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'system_configs'
      AND (COALESCE(qual, '') = 'true' OR COALESCE(with_check, '') = 'true');

    IF v_open_policies > 0 THEN
        RAISE EXCEPTION 'ASSERTION FAILED: system_configs còn % policy USING/WITH CHECK true', v_open_policies;
    END IF;

    SELECT count(*) INTO v_open_grants
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND table_name = 'system_configs'
      AND grantee IN ('anon', 'authenticated');

    IF v_open_grants > 0 THEN
        RAISE EXCEPTION 'ASSERTION FAILED: system_configs còn % grant cho anon/authenticated', v_open_grants;
    END IF;

    RAISE NOTICE 'OK: system_configs đã bị khóa (chỉ service_role + RPC admin).';
END;
$$;
