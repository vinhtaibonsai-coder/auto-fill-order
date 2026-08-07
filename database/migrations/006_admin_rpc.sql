-- 006_admin_rpc.sql
-- Khai báo 9 hàm RPC nghiệp vụ kiểm tra quyền và an toàn giao dịch ở CSDL

-- 1. admin_get_users_with_shops
CREATE OR REPLACE FUNCTION public.admin_get_users_with_shops()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() AND r.code = 'SYSTEM_ADMIN'
    ) THEN
        RAISE EXCEPTION 'Truy cập bị từ chối: Yêu cầu quyền SYSTEM_ADMIN.';
    END IF;

    SELECT json_agg(t) INTO v_result
    FROM (
        SELECT 
            p.id AS user_id,
            p.email,
            p.full_name,
            p.status,
            p.disabled_at,
            p.last_login,
            r.code AS role_code,
            s.id AS shop_id,
            s.name AS shop_name
        FROM public.profiles p
        LEFT JOIN public.shop_members sm ON p.id = sm.user_id AND sm.removed_at IS NULL
        LEFT JOIN public.roles r ON sm.role_id = r.id
        LEFT JOIN public.shops s ON sm.shop_id = s.id AND s.deleted_at IS NULL
        WHERE p.disabled_at IS NULL
        ORDER BY p.created_at DESC
    ) t;

    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- 2. admin_assign_user_shop
CREATE OR REPLACE FUNCTION public.admin_assign_user_shop(
    p_user_id UUID,
    p_shop_id UUID,
    p_role_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_role_id UUID;
    v_old_shop_id UUID;
    v_old_shop_name TEXT;
    v_new_shop_name TEXT;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() AND r.code = 'SYSTEM_ADMIN'
    ) THEN
        RAISE EXCEPTION 'Truy cập bị từ chối: Yêu cầu quyền SYSTEM_ADMIN.';
    END IF;

    SELECT id INTO v_role_id FROM public.roles WHERE code = p_role_code LIMIT 1;
    IF v_role_id IS NULL THEN 
        RAISE EXCEPTION 'Vai trò % không tồn tại.', p_role_code; 
    END IF;

    SELECT shop_id INTO v_old_shop_id FROM public.shop_members WHERE user_id = p_user_id AND removed_at IS NULL LIMIT 1;
    SELECT name INTO v_old_shop_name FROM public.shops WHERE id = v_old_shop_id;
    SELECT name INTO v_new_shop_name FROM public.shops WHERE id = p_shop_id;

    -- Soft-delete liên kết Shop cũ nếu có
    UPDATE public.shop_members SET removed_at = now() WHERE user_id = p_user_id AND removed_at IS NULL;

    -- Thêm liên kết Shop mới
    INSERT INTO public.shop_members (shop_id, user_id, role_id, status)
    VALUES (p_shop_id, p_user_id, v_role_id, 'active')
    ON CONFLICT (user_id) DO UPDATE SET 
        shop_id = EXCLUDED.shop_id, 
        role_id = EXCLUDED.role_id, 
        removed_at = NULL, 
        status = 'active';

    -- Ghi Audit Log hành động
    INSERT INTO public.audit_logs (actor_id, target_user, shop_id, action, old_value, new_value)
    VALUES (auth.uid(), p_user_id, p_shop_id, 'Assign Shop', coalesce(v_old_shop_name, 'Không có'), v_new_shop_name);

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 3. admin_change_user_role
CREATE OR REPLACE FUNCTION public.admin_change_user_role(
    p_user_id UUID,
    p_new_role_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_role_id UUID;
    v_old_role_code TEXT;
    v_shop_id UUID;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() AND r.code = 'SYSTEM_ADMIN'
    ) THEN
        RAISE EXCEPTION 'Truy cập bị từ chối: Yêu cầu quyền SYSTEM_ADMIN.';
    END IF;

    SELECT id INTO v_role_id FROM public.roles WHERE code = p_new_role_code LIMIT 1;
    IF v_role_id IS NULL THEN 
        RAISE EXCEPTION 'Vai trò % không hợp lệ.', p_new_role_code; 
    END IF;

    SELECT r.code, sm.shop_id INTO v_old_role_code, v_shop_id
    FROM public.shop_members sm 
    JOIN public.roles r ON sm.role_id = r.id 
    WHERE sm.user_id = p_user_id AND sm.removed_at IS NULL 
    LIMIT 1;

    UPDATE public.shop_members SET role_id = v_role_id WHERE user_id = p_user_id AND removed_at IS NULL;

    INSERT INTO public.audit_logs (actor_id, target_user, shop_id, action, old_value, new_value)
    VALUES (auth.uid(), p_user_id, v_shop_id, 'Change Role', coalesce(v_old_role_code, 'Không có'), p_new_role_code);

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 4. admin_disable_user
CREATE OR REPLACE FUNCTION public.admin_disable_user(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() AND r.code = 'SYSTEM_ADMIN'
    ) THEN
        RAISE EXCEPTION 'Truy cập bị từ chối: Yêu cầu quyền SYSTEM_ADMIN.';
    END IF;

    UPDATE public.profiles SET disabled_at = now(), status = 'suspended' WHERE id = p_user_id;
    INSERT INTO public.audit_logs (actor_id, target_user, action) VALUES (auth.uid(), p_user_id, 'Disable User');
    RETURN jsonb_build_object('success', true);
END;
$$;

-- 5. admin_enable_user
CREATE OR REPLACE FUNCTION public.admin_enable_user(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() AND r.code = 'SYSTEM_ADMIN'
    ) THEN
        RAISE EXCEPTION 'Truy cập bị từ chối: Yêu cầu quyền SYSTEM_ADMIN.';
    END IF;

    UPDATE public.profiles SET disabled_at = NULL, status = 'active' WHERE id = p_user_id;
    INSERT INTO public.audit_logs (actor_id, target_user, action) VALUES (auth.uid(), p_user_id, 'Enable User');
    RETURN jsonb_build_object('success', true);
END;
$$;

-- 6. owner_invite_staff
CREATE OR REPLACE FUNCTION public.owner_invite_staff(
    p_email TEXT,
    p_shop_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_invite_code TEXT;
BEGIN
    -- Kiểm tra người gọi có là OWNER của Shop này không
    IF NOT EXISTS (
        SELECT 1 FROM public.shop_members sm 
        JOIN public.roles r ON sm.role_id = r.id 
        WHERE sm.user_id = auth.uid() AND sm.shop_id = p_shop_id AND r.code = 'SHOP_OWNER' AND sm.removed_at IS NULL
    ) THEN
        RAISE EXCEPTION 'Chỉ Chủ Shop mới có quyền mời nhân viên.';
    END IF;

    v_invite_code := 'INV-' || upper(substring(md5(random()::text) from 1 for 6));
    
    INSERT INTO public.notifications (title, content, type, level, target, shop_id)
    VALUES ('Lời mời thành viên', 'Tài khoản ' || p_email || ' được mời tham gia shop.', 'invite', 'INFO', p_email, p_shop_id);

    INSERT INTO public.audit_logs (actor_id, shop_id, action, new_value)
    VALUES (auth.uid(), p_shop_id, 'Invite User', p_email);

    RETURN jsonb_build_object('success', true, 'invite_code', v_invite_code);
END;
$$;

-- 7. owner_remove_staff
CREATE OR REPLACE FUNCTION public.owner_remove_staff(
    p_user_id UUID,
    p_shop_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.shop_members sm 
        JOIN public.roles r ON sm.role_id = r.id 
        WHERE sm.user_id = auth.uid() AND sm.shop_id = p_shop_id AND r.code = 'SHOP_OWNER' AND sm.removed_at IS NULL
    ) THEN
        RAISE EXCEPTION 'Không có quyền thực hiện.';
    END IF;

    UPDATE public.shop_members SET removed_at = now() WHERE user_id = p_user_id AND shop_id = p_shop_id;
    INSERT INTO public.audit_logs (actor_id, target_user, shop_id, action) VALUES (auth.uid(), p_user_id, p_shop_id, 'Delete Member');

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 8. owner_get_members
CREATE OR REPLACE FUNCTION public.owner_get_members(p_shop_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.shop_members WHERE user_id = auth.uid() AND shop_id = p_shop_id AND removed_at IS NULL
    ) THEN
        RAISE EXCEPTION 'Bạn không thuộc Shop này.';
    END IF;

    SELECT json_agg(t) INTO v_result FROM (
        SELECT p.id, p.email, p.full_name, r.code AS role_code, sm.joined_at
        FROM public.shop_members sm
        JOIN public.profiles p ON sm.user_id = p.id
        JOIN public.roles r ON sm.role_id = r.id
        WHERE sm.shop_id = p_shop_id AND sm.removed_at IS NULL
    ) t;
    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- 9. system_get_notifications & mark_notification_read
CREATE OR REPLACE FUNCTION public.system_get_notifications(p_shop_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT json_agg(t) INTO v_result FROM (
        SELECT id, title, content, type, level, created_at
        FROM public.notifications
        WHERE is_global = true OR shop_id = p_shop_id
        ORDER BY created_at DESC LIMIT 50
    ) t;
    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN jsonb_build_object('success', true);
END;
$$;

-- 10. admin_get_system_metrics
CREATE OR REPLACE FUNCTION public.admin_get_system_metrics()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_shops INT;
    v_active_shops INT;
    v_total_users INT;
    v_total_orders INT;
    v_active_devices INT;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() AND r.code = 'SYSTEM_ADMIN'
    ) THEN
        RAISE EXCEPTION 'Truy cập bị từ chối: Yêu cầu quyền SYSTEM_ADMIN.';
    END IF;

    SELECT count(*), count(*) FILTER (WHERE status = 'active')
    INTO v_total_shops, v_active_shops
    FROM public.shops
    WHERE deleted_at IS NULL;

    SELECT count(*) INTO v_total_users FROM public.profiles WHERE disabled_at IS NULL;
    SELECT count(*) INTO v_total_orders FROM public.orders;
    SELECT count(*) INTO v_active_devices FROM public.extension_devices WHERE revoked = false;

    RETURN jsonb_build_object(
        'total_shops', v_total_shops,
        'active_shops', v_active_shops,
        'total_users', v_total_users,
        'total_orders', v_total_orders,
        'active_devices', v_active_devices
    );
END;
$$;

-- 11. admin_toggle_user_lock
CREATE OR REPLACE FUNCTION public.admin_toggle_user_lock(
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_disabled_at TIMESTAMP WITH TIME ZONE;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() AND r.code = 'SYSTEM_ADMIN'
    ) THEN
        RAISE EXCEPTION 'Truy cập bị từ chối: Yêu cầu quyền SYSTEM_ADMIN.';
    END IF;

    SELECT disabled_at INTO v_disabled_at FROM public.profiles WHERE id = p_user_id;

    IF v_disabled_at IS NULL THEN
        UPDATE public.profiles
        SET disabled_at = now(), status = 'locked'
        WHERE id = p_user_id;
        RETURN jsonb_build_object('success', true, 'locked', true);
    ELSE
        UPDATE public.profiles
        SET disabled_at = NULL, status = 'active'
        WHERE id = p_user_id;
        RETURN jsonb_build_object('success', true, 'locked', false);
    END IF;
END;
$$;
