-- =========================================================================
-- v54_fix_admin_create_shop_with_account.sql
-- Cập nhật RPC admin_create_shop_with_account để tự động khởi tạo tài khoản auth.users
-- và auth.identities tương ứng (tránh lỗi tạo shop thành công nhưng tài khoản đăng nhập không tồn tại).
-- =========================================================================

CREATE OR REPLACE FUNCTION public.admin_create_shop_with_account(
    p_shop_name TEXT,
    p_owner_email TEXT,
    p_owner_full_name TEXT,
    p_owner_password TEXT,
    p_max_devices INT DEFAULT 5,
    p_daily_ai_limit INT DEFAULT 500
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_shop_id UUID;
    v_owner_role_id UUID;
    v_inst_id UUID;
BEGIN
    -- 1. Kiểm tra quyền Master Admin
    IF auth.uid() IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() AND r.code = 'SYSTEM_ADMIN'
    ) AND NOT EXISTS (
        SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.email = 'admin@luathuysinh.vn'
    ) THEN
        RAISE EXCEPTION 'Chỉ Master Admin mới có quyền tạo Shop và cấp tài khoản.';
    END IF;

    -- 2. Lấy role_id của SHOP_OWNER
    SELECT id INTO v_owner_role_id FROM public.roles WHERE code = 'SHOP_OWNER' LIMIT 1;

    -- 3. Kiểm tra email xem đã tồn tại trong profiles hoặc auth.users chưa
    SELECT id INTO v_user_id FROM public.profiles WHERE email = p_owner_email LIMIT 1;
    IF v_user_id IS NULL THEN
        SELECT id INTO v_user_id FROM auth.users WHERE email = p_owner_email LIMIT 1;
    END IF;

    -- 4. Nếu user chưa tồn tại, thực hiện tạo mới trong auth.users + auth.identities + profiles
    IF v_user_id IS NULL THEN
        SELECT id INTO v_inst_id FROM auth.instances LIMIT 1;
        v_user_id := gen_random_uuid();

        -- Thêm vào auth.users (Tài khoản để đăng nhập)
        INSERT INTO auth.users (
            instance_id, id, aud, role, email,
            encrypted_password, email_confirmed_at,
            confirmation_token, recovery_token,
            created_at, updated_at, confirmation_sent_at
        ) VALUES (
            v_inst_id,
            v_user_id, 'authenticated', 'authenticated', p_owner_email,
            crypt(p_owner_password, gen_salt('bf')), now(),
            '', '', now(), now(), now()
        );

        -- Thêm vào auth.identities (Tránh lỗi xác thực email của Supabase)
        INSERT INTO auth.identities (
            id, user_id, identity_data, provider, provider_id,
            last_sign_in_at, created_at, updated_at
        ) VALUES (
            v_user_id, v_user_id,
            jsonb_build_object('sub', v_user_id::text, 'email', p_owner_email),
            'email', p_owner_email, now(), now(), now()
        );

        -- Thêm vào profiles
        INSERT INTO public.profiles (id, email, full_name, status)
        VALUES (v_user_id, p_owner_email, p_owner_full_name, 'active');
    ELSE
        -- Nếu user đã tồn tại, đảm bảo profile được kích hoạt
        UPDATE public.profiles
        SET status = 'active'
        WHERE id = v_user_id;
    END IF;

    -- 5. Tạo Shop mới
    INSERT INTO public.shops (name, owner_id, status)
    VALUES (p_shop_name, v_user_id, 'active')
    RETURNING id INTO v_shop_id;

    -- 6. Thêm User vào shop_members làm Owner
    INSERT INTO public.shop_members (shop_id, user_id, role_id, status)
    VALUES (v_shop_id, v_user_id, v_owner_role_id, 'active')
    ON CONFLICT (shop_id, user_id) 
    DO UPDATE SET role_id = v_owner_role_id, status = 'active', removed_at = NULL;

    -- 7. Khởi tạo cờ tính năng & hạn ngạch cho Shop
    INSERT INTO public.shop_feature_flags (shop_id) VALUES (v_shop_id) ON CONFLICT DO NOTHING;
    INSERT INTO public.shop_quotas (shop_id, max_devices, daily_ai_limit)
    VALUES (v_shop_id, p_max_devices, p_daily_ai_limit)
    ON CONFLICT (shop_id) DO UPDATE SET max_devices = p_max_devices, daily_ai_limit = p_daily_ai_limit;

    -- 8. Ghi Audit Log
    INSERT INTO public.audit_logs (user_id, shop_id, action, target_resource, target_id, payload)
    VALUES (auth.uid(), v_shop_id, 'ADMIN_CREATE_SHOP', 'shops', v_shop_id::text, 
        jsonb_build_object('shop_name', p_shop_name, 'owner_email', p_owner_email));

    RETURN jsonb_build_object('success', true, 'shop_id', v_shop_id, 'user_id', v_user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_shop_with_account(TEXT, TEXT, TEXT, TEXT, INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_shop_with_account(TEXT, TEXT, TEXT, TEXT, INT, INT) TO service_role;
