-- =========================================================================
-- Migration v132: Fix 7 Features Production Gaps
-- (Social RBAC Action Enforcement, CS Daily Evaluator RPC, Image Asset Pipeline)
-- =========================================================================

-- 1. SOCIAL CHANNELS ACTION RBAC ENFORCEMENT (Gap 6)
-- Thu hồi chính sách FOR ALL trên channel_connections; yêu cầu channels.manage khi chỉnh sửa / thêm / xóa
DROP POLICY IF EXISTS "channel_connections_tenant_isolation" ON public.channel_connections;
DROP POLICY IF EXISTS "channel_connections_select" ON public.channel_connections;
DROP POLICY IF EXISTS "channel_connections_modify" ON public.channel_connections;

-- Cho phép thành viên shop đọc thông tin trạng thái kênh
CREATE POLICY "channel_connections_select" ON public.channel_connections
    FOR SELECT
    USING (
        shop_id IN (
            SELECT sm.shop_id FROM public.shop_members sm
            WHERE sm.user_id = auth.uid()
        )
        OR public.is_system_admin(auth.uid())
        OR auth.role() = 'service_role'
    );

-- Bắt buộc quyền channels.manage hoặc system_admin khi Thêm, Sửa, Xóa kênh mạng xã hội
CREATE POLICY "channel_connections_modify" ON public.channel_connections
    FOR ALL
    USING (
        public.is_system_admin(auth.uid())
        OR public.has_shop_permission(shop_id, 'channels.manage')
        OR auth.role() = 'service_role'
    )
    WITH CHECK (
        public.is_system_admin(auth.uid())
        OR public.has_shop_permission(shop_id, 'channels.manage')
        OR auth.role() = 'service_role'
    );

-- 2. TỰ ĐỘNG ĐÁNH GIÁ VÀ SINH TASK CSKH HẰNG NGÀY (Gap 3)
-- RPC evaluate_and_generate_cs_tasks: Quét chỉ số shop, đối chiếu Playbook, sinh task không trùng lặp
CREATE OR REPLACE FUNCTION public.evaluate_and_generate_cs_tasks(
    p_shop_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_shop RECORD;
    v_created_count INT := 0;
    v_recent_order_count INT := 0;
    v_baseline_order_count INT := 0;
    v_baseline_weekly INT := 0;
    v_shop_age_days INT := 0;
    v_days_until_exp INT := 999;
    v_now TIMESTAMPTZ := now();
BEGIN
    -- 1. Kiểm tra tham số
    IF p_shop_id IS NULL THEN
        RAISE EXCEPTION 'SHOP_ID_REQUIRED: shop_id không được để trống.';
    END IF;

    -- 2. Kiểm tra quyền thực thi (support.manage hoặc system admin)
    IF NOT (auth.role() = 'service_role'
            OR public.is_system_admin(v_user_id)
            OR public.has_shop_permission(p_shop_id, 'support.manage')) THEN
        RAISE EXCEPTION 'ACCESS_DENIED: Bạn không có quyền thực hiện quét tự động CSKH.';
    END IF;

    -- 3. Đọc dữ liệu shop
    SELECT * INTO v_shop FROM public.shops WHERE id = p_shop_id;
    IF v_shop.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'SHOP_NOT_FOUND');
    END IF;

    v_shop_age_days := GREATEST(1, EXTRACT(DAY FROM (v_now - COALESCE(v_shop.created_at, v_now)))::INT);

    IF v_shop.expires_at IS NOT NULL THEN
        v_days_until_exp := EXTRACT(DAY FROM (v_shop.expires_at - v_now))::INT;
    END IF;

    -- 4. Thống kê sản lượng đơn hàng: 7 ngày qua vs 21 ngày trước đó
    SELECT COUNT(*) INTO v_recent_order_count
    FROM public.order_events
    WHERE shop_id = p_shop_id
      AND event_type IN ('ORDER_CREATED', 'ORDER_SUBMITTED_CARRIER', 'ORDER_WAYBILL_ASSIGNED')
      AND created_at >= (v_now - INTERVAL '7 days');

    SELECT COUNT(*) INTO v_baseline_order_count
    FROM public.order_events
    WHERE shop_id = p_shop_id
      AND event_type IN ('ORDER_CREATED', 'ORDER_SUBMITTED_CARRIER', 'ORDER_WAYBILL_ASSIGNED')
      AND created_at >= (v_now - INTERVAL '28 days')
      AND created_at < (v_now - INTERVAL '7 days');

    v_baseline_weekly := GREATEST(0, ROUND(v_baseline_order_count / 3.0)::INT);

    -- 5. Đánh giá Playbook 1: EXPIRED_RECOVERY (Quá hạn gói cước)
    IF v_days_until_exp <= 0 THEN
        INSERT INTO public.customer_success_tasks (
            shop_id, playbook_code, segment, priority, status, due_at, reason, risk_score, suggested_channel
        ) VALUES (
            p_shop_id, 'EXPIRED_RECOVERY', 'PAST_DUE', 'URGENT', 'NEW',
            (v_now + INTERVAL '12 hours'), 'Gói cước của cửa hàng đã hết hạn.', 95.0, 'PHONE_CALL'
        )
        ON CONFLICT (shop_id, playbook_code) WHERE status IN ('NEW', 'IN_PROGRESS', 'WAITING_REPLY') DO NOTHING;

        IF FOUND THEN v_created_count := v_created_count + 1; END IF;

    -- Đánh giá Playbook 2: EXPIRING_RENEWAL_ASSIST (Sắp hết hạn trong 5 ngày)
    ELSIF v_days_until_exp <= 5 THEN
        INSERT INTO public.customer_success_tasks (
            shop_id, playbook_code, segment, priority, status, due_at, reason, risk_score, suggested_channel
        ) VALUES (
            p_shop_id, 'EXPIRING_RENEWAL_ASSIST', 'EXPIRING_SOON', 'HIGH', 'NEW',
            (v_now + INTERVAL '24 hours'), 'Gói cước sắp hết hạn sau ' || v_days_until_exp || ' ngày.', 80.0, 'ZALO_OA'
        )
        ON CONFLICT (shop_id, playbook_code) WHERE status IN ('NEW', 'IN_PROGRESS', 'WAITING_REPLY') DO NOTHING;

        IF FOUND THEN v_created_count := v_created_count + 1; END IF;

    -- Đánh giá Playbook 3: CHECK_IN_ASSISTANCE (Đến hạn trong 14 ngày)
    ELSIF v_days_until_exp <= 14 THEN
        INSERT INTO public.customer_success_tasks (
            shop_id, playbook_code, segment, priority, status, due_at, reason, risk_score, suggested_channel
        ) VALUES (
            p_shop_id, 'CHECK_IN_ASSISTANCE', 'AT_RISK', 'MEDIUM', 'NEW',
            (v_now + INTERVAL '72 hours'), 'Gói cước đến hạn trong 2 tuần tới (' || v_days_until_exp || ' ngày).', 50.0, 'IN_APP_MESSAGE'
        )
        ON CONFLICT (shop_id, playbook_code) WHERE status IN ('NEW', 'IN_PROGRESS', 'WAITING_REPLY') DO NOTHING;

        IF FOUND THEN v_created_count := v_created_count + 1; END IF;
    END IF;

    -- Đánh giá Playbook 4: USAGE_DROP_DIAGNOSTIC (Sụt giảm đơn >= 40% so với baseline 28 ngày)
    IF v_shop_age_days >= 14 AND v_baseline_weekly >= 5 THEN
        IF (v_baseline_weekly - v_recent_order_count)::NUMERIC / v_baseline_weekly >= 0.40 THEN
            INSERT INTO public.customer_success_tasks (
                shop_id, playbook_code, segment, priority, status, due_at, reason, risk_score, suggested_channel
            ) VALUES (
                p_shop_id, 'USAGE_DROP_DIAGNOSTIC', 'USAGE_DROP', 'HIGH', 'NEW',
                (v_now + INTERVAL '48 hours'), 
                'Sản lượng tuần giảm >= 40% (' || v_recent_order_count || ' đơn vs baseline ' || v_baseline_weekly || ').',
                75.0, 'ZALO_OA'
            )
            ON CONFLICT (shop_id, playbook_code) WHERE status IN ('NEW', 'IN_PROGRESS', 'WAITING_REPLY') DO NOTHING;

            IF FOUND THEN v_created_count := v_created_count + 1; END IF;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'shop_id', p_shop_id,
        'tasks_created', v_created_count,
        'recent_weekly_orders', v_recent_order_count,
        'baseline_weekly_orders', v_baseline_weekly,
        'days_until_expiration', v_days_until_exp,
        'evaluated_at', v_now
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.evaluate_and_generate_cs_tasks(UUID) TO authenticated, anon, service_role;

-- 3. LƯU TRỮ VÀ ĐĂNG KÝ TRƯỜNG DỮ LIỆU ĐƠN TỪ ẢNH (Gap 5)
-- RPC record_image_order_extractions: Lưu trữ tài sản ảnh và bóc tách từng trường có độ tin cậy
CREATE OR REPLACE FUNCTION public.record_image_order_extractions(
    p_shop_id UUID,
    p_sha256 TEXT,
    p_storage_path TEXT,
    p_mime_type TEXT,
    p_file_size INT,
    p_fields JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_asset_id UUID;
    v_field JSONB;
    v_field_name TEXT;
    v_raw_val TEXT;
    v_norm_val TEXT;
    v_conf NUMERIC;
    v_inserted_fields INT := 0;
BEGIN
    IF p_shop_id IS NULL OR p_sha256 IS NULL THEN
        RAISE EXCEPTION 'INVALID_ARGUMENTS: shop_id và sha256 là bắt buộc.';
    END IF;

    -- Kiểm tra quyền orders.edit hoặc orders.view
    IF NOT (auth.role() = 'service_role'
            OR public.is_system_admin(v_user_id)
            OR public.has_shop_permission(p_shop_id, 'orders.edit')
            OR public.has_shop_permission(p_shop_id, 'orders.view')) THEN
        RAISE EXCEPTION 'ACCESS_DENIED: Bạn không có quyền tải ảnh hoặc lưu trường bóc tách.';
    END IF;

    -- 1. Upsert Asset
    SELECT id INTO v_asset_id FROM public.order_image_assets
    WHERE shop_id = p_shop_id AND sha256 = p_sha256 LIMIT 1;

    IF v_asset_id IS NULL THEN
        INSERT INTO public.order_image_assets (
            shop_id, storage_path, mime_type, file_size, sha256, status
        ) VALUES (
            p_shop_id, COALESCE(p_storage_path, 'local://' || p_sha256),
            COALESCE(p_mime_type, 'image/jpeg'), COALESCE(p_file_size, 0),
            p_sha256, 'PROCESSED'
        )
        RETURNING id INTO v_asset_id;
    END IF;

    -- 2. Chèn danh sách bóc tách trường (Field Extractions)
    IF p_fields IS NOT NULL AND jsonb_typeof(p_fields) = 'array' THEN
        FOR v_field IN SELECT * FROM jsonb_array_elements(p_fields) LOOP
            v_field_name := v_field->>'field_name';
            v_raw_val := v_field->>'raw_value';
            v_norm_val := v_field->>'normalized_value';
            v_conf := COALESCE((v_field->>'confidence')::NUMERIC, 0.85);

            IF v_field_name IS NOT NULL AND trim(v_field_name) <> '' THEN
                INSERT INTO public.field_extractions (
                    asset_id, shop_id, field_name, raw_value, normalized_value,
                    confidence, source, review_status
                ) VALUES (
                    v_asset_id, p_shop_id, v_field_name, v_raw_val, v_norm_val,
                    v_conf, COALESCE(v_field->>'source', 'OCR'),
                    CASE WHEN v_conf >= 0.85 THEN 'CONFIRMED' ELSE 'PENDING' END
                );
                v_inserted_fields := v_inserted_fields + 1;
            END IF;
        END LOOP;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'asset_id', v_asset_id,
        'fields_recorded', v_inserted_fields
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_image_order_extractions(UUID, TEXT, TEXT, TEXT, INT, JSONB) TO authenticated, anon, service_role;
