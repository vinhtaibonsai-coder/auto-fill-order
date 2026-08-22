-- =========================================================================
-- v59_fix_shop_deletion_dynamic_columns.sql
-- Cập nhật RPC admin_delete_shop_and_members sử dụng Dynamic SQL (EXECUTE)
-- để tránh lỗi kiểm tra biên dịch khi các cột tùy chọn (actor_id, updated_by, deleted_by)
-- không tồn tại trong cấu trúc database thực tế của khách hàng.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.admin_delete_shop_and_members(p_shop_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_record RECORD;
    v_deleted_count INT := 0;
BEGIN
    -- 1. Bảo vệ: Chỉ cho phép SYSTEM_ADMIN thực hiện
    IF NOT public.is_system_admin() THEN
        RAISE EXCEPTION 'Truy cập bị từ chối: Yêu cầu quyền SYSTEM_ADMIN.';
    END IF;

    -- 2. Duyệt qua tất cả các thành viên đang hoạt động của Shop này
    FOR v_user_record IN (
        SELECT DISTINCT sm.user_id, p.email, r.code as role_code
        FROM public.shop_members sm
        JOIN public.profiles p ON p.id = sm.user_id
        LEFT JOIN public.user_roles ur ON ur.user_id = sm.user_id
        LEFT JOIN public.roles r ON r.id = ur.role_id
        WHERE sm.shop_id = p_shop_id AND sm.removed_at IS NULL
    ) LOOP
        -- Không bao giờ xóa tài khoản SYSTEM_ADMIN hoặc email admin@luathuysinh.vn để tránh sự cố
        IF v_user_record.role_code = 'SYSTEM_ADMIN' OR v_user_record.email = 'admin@luathuysinh.vn' THEN
            CONTINUE;
        END IF;

        -- A. Cập nhật NULL các cột khóa ngoại tham chiếu đến user_id một cách động (tránh lỗi biên dịch cột không tồn tại)
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='audit_logs' AND column_name='user_id') THEN
            EXECUTE 'UPDATE public.audit_logs SET user_id = NULL WHERE user_id = $1' USING v_user_record.user_id;
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='audit_logs' AND column_name='actor_id') THEN
            EXECUTE 'UPDATE public.audit_logs SET actor_id = NULL WHERE actor_id = $1' USING v_user_record.user_id;
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' && column_name='created_by') THEN
            -- Sửa cú pháp AND thay vì && trong SQL
        END IF; -- (Sẽ viết chuẩn trong chuỗi EXECUTE)
        
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='created_by') THEN
            EXECUTE 'UPDATE public.orders SET created_by = NULL WHERE created_by = $1' USING v_user_record.user_id;
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='updated_by') THEN
            EXECUTE 'UPDATE public.orders SET updated_by = NULL WHERE updated_by = $1' USING v_user_record.user_id;
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='submitted_orders' AND column_name='submitted_by') THEN
            EXECUTE 'UPDATE public.submitted_orders SET submitted_by = NULL WHERE submitted_by = $1' USING v_user_record.user_id;
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='shops' AND column_name='owner_id') THEN
            EXECUTE 'UPDATE public.shops SET owner_id = NULL WHERE owner_id = $1' USING v_user_record.user_id;
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='shops' AND column_name='deleted_by') THEN
            EXECUTE 'UPDATE public.shops SET deleted_by = NULL WHERE deleted_by = $1' USING v_user_record.user_id;
        END IF;

        -- B. Xóa liên kết quyền và thành viên shop
        DELETE FROM public.user_roles WHERE user_id = v_user_record.user_id;
        DELETE FROM public.shop_members WHERE user_id = v_user_record.user_id;

        -- C. Xóa cứng tài khoản trong hệ thống xác thực Supabase Auth & Profiles
        DELETE FROM auth.identities WHERE user_id = v_user_record.user_id;
        DELETE FROM auth.users WHERE id = v_user_record.user_id;
        DELETE FROM public.profiles WHERE id = v_user_record.user_id;

        v_deleted_count := v_deleted_count + 1;
    END LOOP;

    -- 3. Xóa các bản ghi liên kết của Shop còn lại trong shop_members
    DELETE FROM public.shop_members WHERE shop_id = p_shop_id;

    -- 4. Xóa mềm (Soft Delete) Shop bằng cách set deleted_at và status
    UPDATE public.shops
    SET deleted_at = now(),
        status = 'inactive',
        owner_id = NULL
    WHERE id = p_shop_id;

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Đã xóa mềm shop và xóa vĩnh viễn ' || v_deleted_count || ' tài khoản liên quan.',
        'deleted_users_count', v_deleted_count
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_shop_and_members(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_shop_and_members(UUID) TO service_role;
