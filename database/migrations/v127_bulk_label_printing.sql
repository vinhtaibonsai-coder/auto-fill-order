-- =========================================================================
-- Migration v127: Bulk Label Printing Schema, Idempotent Jobs & RLS
-- (Wave 1 Task A01)
-- =========================================================================

-- 1. BẢNG MẪU IN (PRINT_TEMPLATES)
CREATE TABLE IF NOT EXISTS public.print_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    paper_size TEXT NOT NULL DEFAULT 'A6', -- 'A5', 'A6'
    orientation TEXT NOT NULL DEFAULT 'portrait', -- 'portrait', 'landscape'
    layout JSONB DEFAULT '{"labels_per_page": 1, "show_barcode": true, "show_cod": true}'::jsonb,
    is_default BOOLEAN DEFAULT FALSE,
    version INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.print_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shop_read_print_templates" ON public.print_templates;
CREATE POLICY "shop_read_print_templates" ON public.print_templates
    FOR SELECT USING (
        public.is_system_admin(auth.uid())
        OR public.has_shop_permission_for_user(shop_id, 'labels.print', auth.uid())
        OR public.has_shop_permission_for_user(shop_id, 'orders.view', auth.uid())
    );

DROP POLICY IF EXISTS "shop_write_print_templates" ON public.print_templates;
CREATE POLICY "shop_write_print_templates" ON public.print_templates
    FOR ALL USING (
        public.is_system_admin(auth.uid())
        OR public.has_shop_permission_for_user(shop_id, 'orders.edit', auth.uid())
    );

-- 2. BẢNG LỆNH IN (PRINT_JOBS)
CREATE TABLE IF NOT EXISTS public.print_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
    created_by UUID REFERENCES public.profiles(id),
    template_id UUID REFERENCES public.print_templates(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, PRINT_REQUESTED, COMPLETED, PARTIAL, FAILED
    copies INT NOT NULL DEFAULT 1,
    printer_profile TEXT DEFAULT 'A6_STANDARD',
    idempotency_key TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (shop_id, idempotency_key)
);

ALTER TABLE public.print_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shop_read_print_jobs" ON public.print_jobs;
CREATE POLICY "shop_read_print_jobs" ON public.print_jobs
    FOR SELECT USING (
        public.is_system_admin(auth.uid())
        OR public.has_shop_permission_for_user(shop_id, 'labels.print', auth.uid())
        OR public.has_shop_permission_for_user(shop_id, 'orders.view', auth.uid())
    );

DROP POLICY IF EXISTS "shop_write_print_jobs" ON public.print_jobs;
CREATE POLICY "shop_write_print_jobs" ON public.print_jobs
    FOR ALL USING (
        public.is_system_admin(auth.uid())
        OR public.has_shop_permission_for_user(shop_id, 'labels.print', auth.uid())
    );

-- 3. BẢNG CHI TIẾT NHÃN IN (PRINT_JOB_ITEMS)
CREATE TABLE IF NOT EXISTS public.print_job_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    print_job_id UUID REFERENCES public.print_jobs(id) ON DELETE CASCADE,
    order_id TEXT NOT NULL,
    tracking_code TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, PRINTED, REPRINTED, FAILED
    printed_at TIMESTAMPTZ,
    print_count INT NOT NULL DEFAULT 0,
    reprint_reason TEXT,
    last_error TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.print_job_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shop_read_print_job_items" ON public.print_job_items;
CREATE POLICY "shop_read_print_job_items" ON public.print_job_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.print_jobs pj
            WHERE pj.id = print_job_items.print_job_id
              AND (
                  public.is_system_admin(auth.uid())
                  OR public.has_shop_permission_for_user(pj.shop_id, 'labels.print', auth.uid())
                  OR public.has_shop_permission_for_user(pj.shop_id, 'orders.view', auth.uid())
              )
        )
    );

-- 4. RPC TẠO LỆNH IN IDEMPOTENT (create_print_job_idempotent)
CREATE OR REPLACE FUNCTION public.create_print_job_idempotent(
    p_shop_id UUID,
    p_template_id UUID,
    p_idempotency_key TEXT,
    p_copies INT,
    p_printer_profile TEXT,
    p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_job RECORD;
    v_item JSONB;
    v_order_id TEXT;
    v_tracking_code TEXT;
    v_new_job_id UUID;
    v_inserted_items INT := 0;
BEGIN
    -- 1. Kiểm tra tham số
    IF p_shop_id IS NULL OR p_idempotency_key IS NULL OR trim(p_idempotency_key) = '' THEN
        RAISE EXCEPTION 'INVALID_ARGUMENTS: shop_id và idempotency_key là bắt buộc.';
    END IF;

    -- 2. Kiểm tra nếu job đã tồn tại với idempotency_key này -> Trả về kết quả cũ (Idempotent)
    SELECT * INTO v_job FROM public.print_jobs 
    WHERE shop_id = p_shop_id AND idempotency_key = p_idempotency_key LIMIT 1;

    IF v_job.id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', TRUE,
            'job_id', v_job.id,
            'shop_id', v_job.shop_id,
            'status', v_job.status,
            'idempotent_replay', TRUE,
            'created_at', v_job.created_at
        );
    END IF;

    -- 3. Kiểm tra phân quyền in nhãn
    IF NOT (auth.role() = 'service_role' 
            OR public.is_system_admin(v_user_id) 
            OR public.has_shop_permission_for_user(p_shop_id, 'labels.print', v_user_id)) THEN
        RAISE EXCEPTION 'ACCESS_DENIED: Bạn không có quyền in nhãn cho cửa hàng này.';
    END IF;

    -- 4. Tạo job mới
    INSERT INTO public.print_jobs (
        shop_id, created_by, template_id, status, copies, printer_profile, idempotency_key, created_at
    ) VALUES (
        p_shop_id, v_user_id, p_template_id, 'PENDING', COALESCE(p_copies, 1), 
        COALESCE(p_printer_profile, 'A6_STANDARD'), p_idempotency_key, now()
    )
    RETURNING id INTO v_new_job_id;

    -- 5. Chèn danh sách items và ghi sự kiện PRINT_JOB_CREATED
    IF p_items IS NOT NULL AND jsonb_typeof(p_items) = 'array' THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
            v_order_id := v_item->>'order_id';
            v_tracking_code := v_item->>'tracking_code';

            IF v_order_id IS NOT NULL AND trim(v_order_id) <> '' THEN
                INSERT INTO public.print_job_items (
                    print_job_id, order_id, tracking_code, status, print_count
                ) VALUES (
                    v_new_job_id, v_order_id, v_tracking_code, 'PENDING', 0
                );
                v_inserted_items := v_inserted_items + 1;

                -- Ghi nhận sự kiện vòng đời đơn
                PERFORM public.append_order_event(
                    p_shop_id, v_order_id, v_order_id, 'PRINT_JOB_CREATED', 'USER', 'print_center',
                    '{}'::jsonb, '{}'::jsonb, 
                    jsonb_build_object('print_job_id', v_new_job_id, 'tracking_code', v_tracking_code)
                );
            END IF;
        END LOOP;
    END IF;

    RETURN jsonb_build_object(
        'success', TRUE,
        'job_id', v_new_job_id,
        'shop_id', p_shop_id,
        'status', 'PENDING',
        'items_count', v_inserted_items,
        'idempotent_replay', FALSE
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_print_job_idempotent(UUID, UUID, TEXT, INT, TEXT, JSONB) TO authenticated, anon, service_role;

-- 5. RPC XÁC NHẬN KẾT QUẢ IN (confirm_print_job_items)
CREATE OR REPLACE FUNCTION public.confirm_print_job_items(
    p_shop_id UUID,
    p_job_id UUID,
    p_item_results JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_res JSONB;
    v_order_id TEXT;
    v_tracking_code TEXT;
    v_status TEXT;
    v_reprint_reason TEXT;
    v_error TEXT;
    v_success_count INT := 0;
    v_failed_count INT := 0;
    v_total_count INT := 0;
    v_final_job_status TEXT;
BEGIN
    -- 1. Kiểm tra quyền
    IF NOT (auth.role() = 'service_role' 
            OR public.is_system_admin(v_user_id) 
            OR public.has_shop_permission_for_user(p_shop_id, 'labels.print', v_user_id)) THEN
        RAISE EXCEPTION 'ACCESS_DENIED: Bạn không có quyền cập nhật lệnh in.';
    END IF;

    -- 2. Duyệt qua từng item kết quả
    IF p_item_results IS NOT NULL AND jsonb_typeof(p_item_results) = 'array' THEN
        FOR v_res IN SELECT * FROM jsonb_array_elements(p_item_results) LOOP
            v_order_id := v_res->>'order_id';
            v_tracking_code := v_res->>'tracking_code';
            v_status := COALESCE(v_res->>'status', 'PRINTED');
            v_reprint_reason := v_res->>'reprint_reason';
            v_error := v_res->>'error';
            v_total_count := v_total_count + 1;

            IF v_status = 'PRINTED' OR v_status = 'REPRINTED' THEN
                v_success_count := v_success_count + 1;

                UPDATE public.print_job_items
                SET status = v_status,
                    printed_at = now(),
                    print_count = print_count + 1,
                    reprint_reason = v_reprint_reason,
                    last_error = NULL
                WHERE print_job_id = p_job_id AND order_id = v_order_id;

                -- Ghi nhận event LABEL_PRINTED hoặc LABEL_REPRINTED
                PERFORM public.append_order_event(
                    p_shop_id, v_order_id, v_order_id,
                    CASE WHEN v_status = 'REPRINTED' THEN 'LABEL_REPRINTED' ELSE 'LABEL_PRINTED' END,
                    'USER', 'print_center',
                    '{}'::jsonb, '{}'::jsonb,
                    jsonb_build_object('print_job_id', p_job_id, 'reprint_reason', v_reprint_reason)
                );
            ELSE
                v_failed_count := v_failed_count + 1;

                UPDATE public.print_job_items
                SET status = 'FAILED',
                    last_error = v_error
                WHERE print_job_id = p_job_id AND order_id = v_order_id;

                PERFORM public.append_order_event(
                    p_shop_id, v_order_id, v_order_id, 'PRINT_FAILED', 'SYSTEM', 'print_center',
                    '{}'::jsonb, '{}'::jsonb,
                    jsonb_build_object('print_job_id', p_job_id, 'error', v_error)
                );
            END IF;
        END LOOP;
    END IF;

    -- 3. Cập nhật trạng thái tổng thể của print_job
    IF v_failed_count = 0 AND v_success_count > 0 THEN
        v_final_job_status := 'COMPLETED';
    ELSIF v_success_count > 0 AND v_failed_count > 0 THEN
        v_final_job_status := 'PARTIAL';
    ELSE
        v_final_job_status := 'FAILED';
    END IF;

    UPDATE public.print_jobs
    SET status = v_final_job_status
    WHERE id = p_job_id AND shop_id = p_shop_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'job_id', p_job_id,
        'job_status', v_final_job_status,
        'success_count', v_success_count,
        'failed_count', v_failed_count,
        'total_count', v_total_count
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_print_job_items(UUID, UUID, JSONB) TO authenticated, anon, service_role;
