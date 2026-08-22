-- =========================================================================
-- v60_add_admin_delete_user_rpc.sql
-- Định nghĩa RPC admin_delete_user để xóa cứng một tài khoản thành viên khỏi hệ thống.
-- Xóa sạch khỏi auth.users, auth.identities, profiles và các bảng liên kết,
-- đồng thời xử lý null các khóa ngoại tham chiếu động (audit_logs, orders, shops).
-- =========================================================================

CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_email TEXT;
    v_role_code TEXT;
BEGIN
    -- 1. Bảo vệ: Chỉ cho phép SYSTEM_ADMIN thực hiện
    IF NOT public.is_system_admin() THEN
        RAISE EXCEPTION 'Truy cập bị từ chối: Yêu cầu quyền SYSTEM_ADMIN.';
    END IF;

    -- 2. Lấy email và vai trò của tài khoản cần xóa để kiểm tra điều kiện bảo vệ
    SELECT p.email INTO v_email FROM public.profiles p WHERE p.id = p_user_id;
    
    SELECT r.code INTO v_role_code 
    FROM public.user_roles ur 
    JOIN public.roles r ON ur.role_id = r.id 
    WHERE ur.user_id = p_user_id 
    LIMIT 1;

    -- 3. Không bao giờ cho phép xóa tài khoản SYSTEM_ADMIN hoặc email admin@luathuysinh.vn
    IF v_role_code = 'SYSTEM_ADMIN' OR v_email = 'admin@luathuysinh.vn' THEN
        RAISE EXCEPTION 'Không thể xóa tài khoản Quản trị viên hệ thống.';
    END IF;

    -- 4. Cập nhật NULL các khóa ngoại tham chiếu động để tránh lỗi FK
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='audit_logs' AND column_name='user_id') THEN
        EXECUTE 'UPDATE public.audit_logs SET user_id = NULL WHERE user_id = $1' USING p_user_id;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='audit_logs' AND column_name='actor_id') THEN
        EXECUTE 'UPDATE public.audit_logs SET actor_id = NULL WHERE actor_id = $1' USING p_user_id;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='created_by') THEN
        EXECUTE 'UPDATE public.orders SET created_by = NULL WHERE created_by = $1' USING p_user_id;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='updated_by') THEN
        EXECUTE 'UPDATE public.orders SET updated_by = NULL WHERE updated_by = $1' USING p_user_id;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='submitted_orders' AND column_name='submitted_by') THEN
        EXECUTE 'UPDATE public.submitted_orders SET submitted_by = NULL WHERE submitted_by = $1' USING p_user_id;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='shops' AND column_name='owner_id') THEN
        EXECUTE 'UPDATE public.shops SET owner_id = NULL WHERE owner_id = $1' USING p_user_id;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='shops' AND column_name='deleted_by') THEN
        EXECUTE 'UPDATE public.shops SET deleted_by = NULL WHERE deleted_by = $1' USING p_user_id;
    END IF;

    -- 5. Xóa liên kết quyền và thành viên shop
    DELETE FROM public.user_roles WHERE user_id = p_user_id;
    DELETE FROM public.shop_members WHERE user_id = p_user_id;

    -- 6. Xóa cứng tài khoản trong hệ thống xác thực Supabase Auth & Profiles
    DELETE FROM auth.identities WHERE user_id = p_user_id;
    DELETE FROM auth.users WHERE id = p_user_id;
    DELETE FROM public.profiles WHERE id = p_user_id;

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Đã xóa vĩnh viễn tài khoản thành công.'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(UUID) TO service_role;
