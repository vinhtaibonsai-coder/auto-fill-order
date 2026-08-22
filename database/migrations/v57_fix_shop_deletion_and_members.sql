-- =========================================================================
-- v57_fix_shop_deletion_and_members.sql
-- Định nghĩa RPC admin_delete_shop_and_members để xóa đồng bộ Cửa hàng và Tài khoản liên kết.
-- Thực hiện xóa mềm Cửa hàng, cảnh báo dữ liệu đơn hàng và xóa cứng toàn bộ các tài khoản
-- nhân viên/chủ shop thuộc shop đó (ngoại trừ các tài khoản Admin).
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

        -- A. Cập nhật NULL các cột khóa ngoại tham chiếu đến user_id trong các bảng nghiệp vụ để tránh lỗi FK
        UPDATE public.audit_logs SET user_id = NULL WHERE user_id = v_user_record.user_id;
        UPDATE public.audit_logs SET actor_id = NULL WHERE actor_id = v_user_record.user_id;
        UPDATE public.orders SET created_by = NULL WHERE created_by = v_user_record.user_id;
        UPDATE public.orders SET updated_by = NULL WHERE updated_by = v_user_record.user_id;
        UPDATE public.submitted_orders SET submitted_by = NULL WHERE submitted_by = v_user_record.user_id;
        UPDATE public.shops SET owner_id = NULL WHERE owner_id = v_user_record.user_id;
        UPDATE public.shops SET deleted_by = NULL WHERE deleted_by = v_user_record.user_id;

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
