-- =========================================================================
-- v38_shop_standardization.sql
-- Chuẩn hoá hạn ngạch Shop và tính năng quản lý nhân viên của Chủ Shop
-- =========================================================================

-- 1. Bổ sung cột quản lý giới hạn nhân viên và số lượng đơn hàng vào shop_quotas
ALTER TABLE public.shop_quotas ADD COLUMN IF NOT EXISTS max_users INT DEFAULT 5;
ALTER TABLE public.shop_quotas ADD COLUMN IF NOT EXISTS monthly_order_limit INT DEFAULT 5000;

COMMENT ON COLUMN public.shop_quotas.max_users IS 'Số lượng nhân viên tối đa được tham gia vào Shop';
COMMENT ON COLUMN public.shop_quotas.monthly_order_limit IS 'Số lượng đơn hàng tối đa Shop được phép xử lý mỗi tháng';

-- 2. Tạo Trigger kiểm tra giới hạn số lượng nhân viên trong Shop khi thêm mới/kích hoạt lại
CREATE OR REPLACE FUNCTION public.tg_check_shop_user_limit()
RETURNS TRIGGER AS $$
DECLARE
    v_max_users INT;
    v_current_users INT;
BEGIN
    -- Chỉ kiểm tra khi có hành động thêm mới (INSERT) hoặc cập nhật (UPDATE) chuyển từ đã xoá/khoá sang hoạt động
    IF (TG_OP = 'INSERT') OR 
       (TG_OP = 'UPDATE' AND ((NEW.removed_at IS NULL AND OLD.removed_at IS NOT NULL) OR (NEW.status = 'active' AND OLD.status <> 'active'))) THEN
        
        -- Lấy giới hạn max_users từ shop_quotas, nếu chưa cấu hình thì mặc định là 5
        SELECT COALESCE(max_users, 5) INTO v_max_users 
        FROM public.shop_quotas WHERE shop_id = NEW.shop_id;
        
        -- Đếm số nhân viên đang hoạt động trong shop
        SELECT COUNT(1) INTO v_current_users 
        FROM public.shop_members 
        WHERE shop_id = NEW.shop_id AND removed_at IS NULL AND status = 'active';
        
        IF v_current_users >= v_max_users THEN
            RAISE EXCEPTION 'Cửa hàng đã đạt giới hạn nhân viên tối đa (% người). Vui lòng liên hệ Admin để nâng cấp gói.', v_max_users;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_check_shop_user_limit ON public.shop_members;
CREATE TRIGGER tr_check_shop_user_limit
    BEFORE INSERT OR UPDATE ON public.shop_members
    FOR EACH ROW EXECUTE FUNCTION public.tg_check_shop_user_limit();

-- 3. RPC cho phép Chủ Shop đặt lại mật khẩu cho nhân viên thuộc cùng Shop
CREATE OR REPLACE FUNCTION public.owner_reset_member_password(
    p_target_user_id UUID,
    p_new_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Kiểm tra quyền: Phải là SYSTEM_ADMIN hoặc là OWNER của shop có nhân viên p_target_user_id
    IF NOT EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() AND r.code = 'SYSTEM_ADMIN'
    ) AND NOT EXISTS (
        SELECT 1 FROM public.shop_members sm_owner
        JOIN public.shop_members sm_member ON sm_owner.shop_id = sm_member.shop_id
        WHERE sm_owner.user_id = auth.uid()
          AND UPPER(sm_owner.role) IN ('OWNER', 'SHOP_OWNER')
          AND sm_owner.removed_at IS NULL
          AND sm_owner.status = 'active'
          AND sm_member.user_id = p_target_user_id
          AND sm_member.removed_at IS NULL
    ) THEN
        RAISE EXCEPTION 'Bạn không có quyền đổi mật khẩu cho thành viên này.';
    END IF;

    -- Đảm bảo tài khoản đích tồn tại trong auth.users
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_target_user_id) THEN
        RAISE EXCEPTION 'Tài khoản nhân viên không tồn tại trên hệ thống.';
    END IF;

    -- Cập nhật mật khẩu mã hoá bcrypt
    UPDATE auth.users
    SET encrypted_password = crypt(p_new_password, gen_salt('bf')), updated_at = now()
    WHERE id = p_target_user_id;

    -- Lưu log hoạt động
    INSERT INTO public.audit_logs (actor_id, action, target_resource, target_id, details)
    VALUES (auth.uid(), 'OWNER_RESET_PASSWORD', 'auth.users', p_target_user_id::text, 'Chủ Shop đặt lại mật khẩu cho nhân viên.');

    RETURN jsonb_build_object('success', true, 'message', 'Đã đặt lại mật khẩu nhân viên thành công.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_reset_member_password(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_reset_member_password(UUID, TEXT) TO service_role;
