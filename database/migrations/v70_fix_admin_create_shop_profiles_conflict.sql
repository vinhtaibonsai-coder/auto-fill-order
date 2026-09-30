-- =========================================================================
-- Migration v70: Sửa lỗi xung đột profiles_pkey & tương thích cột role / role_id trong shop_members
-- =========================================================================

-- 1. Đảm bảo bảng shop_members có đầy đủ cả 2 cột role (TEXT) và role_id (UUID)
ALTER TABLE public.shop_members ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES public.roles(id);
ALTER TABLE public.shop_members ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'STAFF';

-- 2. Cập nhật hàm admin_create_shop_with_account an toàn tuyệt đối
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
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_user_id UUID;
    v_shop_id UUID;
    v_owner_role_id UUID;
    v_inst_id UUID;
    v_clean_email TEXT;
BEGIN
    -- 1. Kiểm tra quyền Master Admin
    IF NOT public.is_system_admin() THEN
        IF auth.uid() IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid() AND r.code = 'SYSTEM_ADMIN'
        ) AND NOT EXISTS (
            SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.email = 'admin@luathuysinh.vn'
        ) THEN
            RAISE EXCEPTION 'Chỉ Master Admin mới có quyền tạo Shop và cấp tài khoản.';
        END IF;
    END IF;

    v_clean_email := LOWER(TRIM(p_owner_email));

    -- 2. Lấy role_id của SHOP_OWNER hoặc OWNER
    SELECT id INTO v_owner_role_id FROM public.roles WHERE code = 'SHOP_OWNER' LIMIT 1;
    IF v_owner_role_id IS NULL THEN
        SELECT id INTO v_owner_role_id FROM public.roles WHERE code = 'OWNER' LIMIT 1;
    END IF;
    IF v_owner_role_id IS NULL THEN
        INSERT INTO public.roles (code, name) VALUES ('SHOP_OWNER', 'Chủ Cửa hàng')
        RETURNING id INTO v_owner_role_id;
    END IF;

    -- 3. Kiểm tra email xem đã tồn tại trong profiles hoặc auth.users chưa
    SELECT id INTO v_user_id FROM public.profiles WHERE LOWER(email) = v_clean_email LIMIT 1;
    IF v_user_id IS NULL THEN
        SELECT id INTO v_user_id FROM auth.users WHERE LOWER(email) = v_clean_email LIMIT 1;
    END IF;

    -- 4. Nếu user chưa tồn tại, thực hiện tạo mới trong auth.users + auth.identities + profiles
    IF v_user_id IS NULL THEN
        SELECT id INTO v_inst_id FROM auth.instances LIMIT 1;
        v_user_id := gen_random_uuid();

        -- Thêm vào auth.users (Tài khoản để đăng nhập)
        INSERT INTO auth.users (
            instance_id, id, aud, role, email,
            encrypted_password, email_confirmed_at,
            raw_user_meta_data,
            confirmation_token, recovery_token,
            created_at, updated_at, confirmation_sent_at
        ) VALUES (
            v_inst_id,
            v_user_id, 'authenticated', 'authenticated', v_clean_email,
            crypt(p_owner_password, gen_salt('bf')), now(),
            jsonb_build_object('full_name', p_owner_full_name),
            '', '', now(), now(), now()
        );

        -- Thêm vào auth.identities
        INSERT INTO auth.identities (
            id, user_id, identity_data, provider, provider_id,
            last_sign_in_at, created_at, updated_at
        ) VALUES (
            v_user_id, v_user_id,
            jsonb_build_object('sub', v_user_id::text, 'email', v_clean_email),
            'email', v_clean_email, now(), now(), now()
        )
        ON CONFLICT (provider, provider_id) DO NOTHING;

        -- Thêm vào profiles với ON CONFLICT an toàn
        INSERT INTO public.profiles (id, email, full_name, status)
        VALUES (v_user_id, v_clean_email, p_owner_full_name, 'active')
        ON CONFLICT (id) DO UPDATE SET 
            full_name = EXCLUDED.full_name, 
            email = EXCLUDED.email, 
            status = 'active',
            updated_at = now();
    ELSE
        -- Nếu user đã tồn tại, đảm bảo profile được kích hoạt và cập nhật mật khẩu nếu có
        UPDATE public.profiles
        SET status = 'active', 
            full_name = COALESCE(NULLIF(p_owner_full_name, ''), full_name),
            updated_at = now()
        WHERE id = v_user_id;

        IF p_owner_password IS NOT NULL AND LENGTH(p_owner_password) >= 6 THEN
            UPDATE auth.users
            SET encrypted_password = crypt(p_owner_password, gen_salt('bf')),
                updated_at = now()
            WHERE id = v_user_id;
        END IF;
    END IF;

    -- 5. Tạo Shop mới
    INSERT INTO public.shops (name, owner_id, status)
    VALUES (p_shop_name, v_user_id, 'active')
    RETURNING id INTO v_shop_id;

    -- 6. Thêm User vào shop_members làm Owner (Gán cả role và role_id)
    INSERT INTO public.shop_members (shop_id, user_id, role_id, role, status)
    VALUES (v_shop_id, v_user_id, v_owner_role_id, 'OWNER', 'active')
    ON CONFLICT (shop_id, user_id) 
    DO UPDATE SET 
        role_id = v_owner_role_id, 
        role = 'OWNER', 
        status = 'active', 
        removed_at = NULL;

    -- 7. Khởi tạo cờ tính năng & hạn ngạch cho Shop
    INSERT INTO public.shop_feature_flags (shop_id) VALUES (v_shop_id) ON CONFLICT DO NOTHING;
    INSERT INTO public.shop_quotas (shop_id, max_devices, daily_ai_limit)
    VALUES (v_shop_id, p_max_devices, p_daily_ai_limit)
    ON CONFLICT (shop_id) DO UPDATE SET max_devices = p_max_devices, daily_ai_limit = p_daily_ai_limit;

    -- 8. Ghi Audit Log
    PERFORM public.insert_audit_log('ADMIN_CREATE_SHOP', 'shop', v_shop_id::text, 
        jsonb_build_object('shop_name', p_shop_name, 'owner_email', v_clean_email), NULL);

    RETURN jsonb_build_object('success', true, 'shop_id', v_shop_id, 'user_id', v_user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_shop_with_account(TEXT, TEXT, TEXT, TEXT, INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_shop_with_account(TEXT, TEXT, TEXT, TEXT, INT, INT) TO service_role;

-- 3. Cập nhật Trigger trg_limit_shops_per_owner cho phép Master Admin tạo nhiều Shop
CREATE OR REPLACE FUNCTION public.trg_limit_shops_per_owner_func()
RETURNS TRIGGER AS $$
DECLARE
  v_max_shops INT;
  v_current_shops INT;
BEGIN
  IF public.is_system_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.deleted_at IS NOT NULL OR NEW.status = 'inactive' OR NEW.status = 'deleted' THEN
    RETURN NEW;
  END IF;

  v_max_shops := public.get_user_max_shops(NEW.owner_id);

  SELECT COUNT(*) INTO v_current_shops
  FROM public.shops
  WHERE owner_id = NEW.owner_id
    AND deleted_at IS NULL
    AND status = 'active'
    AND id <> NEW.id;

  IF v_current_shops >= v_max_shops THEN
    RAISE EXCEPTION 'Tài khoản của bạn chỉ được sở hữu tối đa % cửa hàng hoạt động ở gói cước hiện tại. Vui lòng nâng cấp gói cước để thêm chi nhánh/cửa hàng mới.', v_max_shops;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_limit_shops_per_owner ON public.shops;
CREATE TRIGGER trg_limit_shops_per_owner
BEFORE INSERT OR UPDATE OF owner_id, deleted_at, status ON public.shops
FOR EACH ROW
EXECUTE FUNCTION public.trg_limit_shops_per_owner_func();
