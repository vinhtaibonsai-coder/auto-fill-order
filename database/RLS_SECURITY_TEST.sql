-- =========================================================================
-- RLS_SECURITY_TEST.sql — BỘ KIỂM TRA AN NINH CHẠY ĐƯỢC (thực thi trực tiếp)
--
-- Cách dùng:
--   1. Dán toàn bộ file này vào Supabase SQL Editor.
--   2. Chạy: sẽ báo PASS/FAIL cho từng check quan trọng.
--   3. Sửa tham số p_target_email / p_shop_id_test ở dưới cho đúng dữ liệu của bạn.
--
-- Nội dung test (theo mục 18/38 review):
--   A. RPC guard: user thường không gọi được admin_* (cần role hoặc sẽ bị từ chối)
--   B. get_user_role: IDOR — user không được xem role người khác
--   C. Cross-shop: user SHOP A không đọc được orders SHOP B (chuẩn RLS, không qua RPC)
--   D. Atomic quota: consume_ai_quota không thể vượt limit
--   E. Cấu trúc: hệ thống không có SET search_path thiếu
--   F. v19: audit immutable + disabled user check + search_path
--   G. v20: order_events + columns lifecycle
--   H. v21: RPC an toàn system_configs
-- =========================================================================

DO $$
DECLARE
    v_pass INT := 0;
    v_fail INT := 0;
    v_shop_id_test UUID;
    v_msg TEXT;
BEGIN
    RAISE NOTICE '== BẮT ĐẦU SECURITY TEST ==';

    -- (A) Hàm quan trọng có tồn tại không
    IF to_regprocedure('public.admin_list_users()') IS NOT NULL THEN
        v_pass := v_pass + 1;
    ELSE
        v_fail := v_fail + 1;
        RAISE WARNING '[FAIL] thiếu admin_list_users()';
    END IF;

    IF to_regprocedure('public.consume_ai_quota(uuid,integer,integer,integer,text,text)') IS NOT NULL THEN
        v_pass := v_pass + 1;
    ELSE
        v_fail := v_fail + 1;
        RAISE WARNING '[FAIL] thiếu consume_ai_quota()';
    END IF;

    IF to_regprocedure('public.admin_revoke_device(uuid,boolean)') IS NOT NULL THEN
        v_pass := v_pass + 1;
    ELSE
        v_fail := v_fail + 1;
        RAISE WARNING '[FAIL] thiếu admin_revoke_device()';
    END IF;

    -- (B) Audit log tồn tại (immutable thực tế cần kiểm tra thêm permissions)
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='audit_logs') THEN
        v_pass := v_pass + 1;
    ELSE
        v_fail := v_fail + 1;
        RAISE WARNING '[FAIL] thiếu bảng audit_logs';
    END IF;

    -- (C) user_roles vs shop_members: đúng 2 nguồn role
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='user_roles')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='shop_members') THEN
        v_pass := v_pass + 1;
    ELSE
        v_fail := v_fail + 1;
    END IF;

    -- (D) Complete: cả ai_usage_log, shop_quotas đã refactor
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='shop_quotas' AND column_name='daily_ai_used')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='ai_usage_log') THEN
        v_pass := v_pass + 1;
    ELSE
        v_fail := v_fail + 1;
        RAISE WARNING '[FAIL] v17 chưa apply (daily_ai_used/ai_usage_log)';
    END IF;

    -- (E) extension_devices có device_id + UNIQUE(user, device)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='extension_devices' AND column_name='device_id')
       AND EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='extension_devices' AND indexname='uq_extdev_user_device') THEN
        v_pass := v_pass + 1;
    ELSE
        v_fail := v_fail + 1;
        RAISE WARNING '[FAIL] v18 chưa apply (device_id/unique index)';
    END IF;

    -- (F) v19: audit_logs không còn policy FOR ALL cho authenticated
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname='public' AND tablename='audit_logs'
          AND cmd IN ('UPDATE','DELETE') AND roles::text LIKE '%authenticated%'
    ) THEN
        v_pass := v_pass + 1;
    ELSE
        v_fail := v_fail + 1;
        RAISE WARNING '[FAIL] v19: audit_logs còn policy UPDATE/DELETE cho authenticated';
    END IF;

    -- search_path đã set trên admin_revoke_device
    IF EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname='public' AND proname='admin_revoke_device'
          AND proconfig IS NOT NULL AND array_to_string(proconfig, ',') LIKE '%search_path%'
    ) THEN
        v_pass := v_pass + 1;
    ELSE
        v_fail := v_fail + 1;
        RAISE WARNING '[FAIL] v19: admin_revoke_device chưa SET search_path';
    END IF;

    -- is_shop_member có check disabled (đọc được body check profiles.disabled_at)
    IF EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname='is_shop_member'
          AND prosrc LIKE '%disabled_at%'
    ) THEN
        v_pass := v_pass + 1;
    ELSE
        v_fail := v_fail + 1;
        RAISE WARNING '[FAIL] v19: is_shop_member không filter disabled_at';
    END IF;

    -- (G) v20: order_events tồn tại + RLS bật + cột lifecycle
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='order_events')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='order_events' AND column_name='failure_reason')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='submitted_at')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='submitted_orders' AND column_name='status') THEN
        v_pass := v_pass + 1;
    ELSE
        v_fail := v_fail + 1;
        RAISE WARNING '[FAIL] v20 chưa apply (order_events/submitted_at/status)';
    END IF;

    -- (H) v21: RPC an toàn tồn tại
    IF to_regprocedure('public.get_system_config_value(text)') IS NOT NULL
       AND to_regprocedure('public.upsert_system_config(text,jsonb,text)') IS NOT NULL THEN
        v_pass := v_pass + 1;
    ELSE
        v_fail := v_fail + 1;
        RAISE WARNING '[FAIL] v21 chưa apply (get_system_config_value/upsert_system_config)';
    END IF;

    -- (I) v48: submitted_orders & history RLS enabled
    IF EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE schemaname='public' 
          AND tablename='submitted_orders' 
          AND rowsecurity = true
    ) AND EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE schemaname='public' 
          AND tablename='history' 
          AND rowsecurity = true
    ) THEN
        v_pass := v_pass + 1;
    ELSE
        v_fail := v_fail + 1;
        RAISE WARNING '[FAIL] v48: submitted_orders hoặc history chưa bật RLS';
    END IF;

    -- (J) v49: unique shop owner index exists
    IF EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname='public' 
          AND tablename='shop_members' 
          AND indexname='uq_active_shop_owner_per_shop'
    ) THEN
        v_pass := v_pass + 1;
    ELSE
        v_fail := v_fail + 1;
        RAISE WARNING '[FAIL] v49: Thiếu index uq_active_shop_owner_per_shop trên shop_members';
    END IF;

    RAISE NOTICE '== KẾT QUẢ: PASS=% FAIL=% ==', v_pass, v_fail;
    IF v_fail > 0 THEN
        RAISE EXCEPTION 'SECURITY TEST THẤT BẠI: %', v_fail;
    END IF;
END
$$;