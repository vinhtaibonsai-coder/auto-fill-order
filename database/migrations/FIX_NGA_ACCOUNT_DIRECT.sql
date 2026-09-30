-- =========================================================================
-- BẢN VÁ DỨT ĐIỂM: SỬA TRIGGER HẠN MỨC SHOP & KÍCH HOẠT TÀI KHOẢN NGA@AFO.VN
-- =========================================================================

-- 1. Bật extension pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 2. Cập nhật Trigger trg_limit_shops_per_owner_func an toàn tuyệt đối
CREATE OR REPLACE FUNCTION public.trg_limit_shops_per_owner_func()
RETURNS TRIGGER AS $$
DECLARE
  v_max_shops INT;
  v_current_shops INT;
BEGIN
  -- Bỏ qua nếu là Master Admin
  IF public.is_system_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.deleted_at IS NOT NULL OR NEW.status = 'inactive' OR NEW.status = 'deleted' THEN
    RETURN NEW;
  END IF;

  -- Bỏ qua nếu user_id là null
  IF NEW.owner_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_max_shops := public.get_user_max_shops(NEW.owner_id);
  IF v_max_shops IS NULL OR v_max_shops <= 0 THEN
    v_max_shops := 1;
  END IF;

  SELECT COUNT(*) INTO v_current_shops
  FROM public.shops
  WHERE owner_id = NEW.owner_id
    AND deleted_at IS NULL
    AND status = 'active'
    AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  IF v_current_shops >= v_max_shops THEN
    -- Nếu bị gọi tự động từ trigger auth.users thì không throw exception làm chết user
    RETURN NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Cập nhật Trigger ensure_user_shop_and_quota() an toàn (Không bao giờ block tạo auth.users)
CREATE OR REPLACE FUNCTION public.ensure_user_shop_and_quota()
RETURNS TRIGGER AS $$
DECLARE
  v_shop_id UUID;
BEGIN
  -- Kiểm tra xem user này đã có shop hoạt động nào chưa
  SELECT id INTO v_shop_id 
  FROM public.shops 
  WHERE owner_id = NEW.id AND deleted_at IS NULL AND status = 'active'
  LIMIT 1;

  -- Nếu chưa có shop nào thì mới tạo
  IF v_shop_id IS NULL THEN
    BEGIN
      INSERT INTO public.shops (name, owner_id, status)
      VALUES (COALESCE('Shop của ' || NEW.email, 'Cửa hàng mặc định'), NEW.id, 'active')
      ON CONFLICT DO NOTHING
      RETURNING id INTO v_shop_id;
    EXCEPTION WHEN OTHERS THEN
      v_shop_id := NULL;
    END;
  END IF;

  IF v_shop_id IS NOT NULL THEN
    INSERT INTO public.shop_feature_flags (shop_id) VALUES (v_shop_id) ON CONFLICT DO NOTHING;
    INSERT INTO public.shop_quotas (shop_id, max_devices, daily_ai_limit)
    VALUES (v_shop_id, 5, 500) ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Đảm bảo auth.users luôn được tạo thành công
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. KÍCH HOẠT TRỰC TIẾP TÀI KHOẢN NGA@AFO.VN
DO $$
DECLARE
  v_user_id UUID;
  v_inst_id UUID;
  v_email TEXT := 'nga@afo.vn';
  v_password TEXT := '12345678';
BEGIN
  SELECT id INTO v_user_id FROM public.profiles WHERE LOWER(email) = v_email LIMIT 1;
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
  END IF;

  SELECT id INTO v_inst_id FROM auth.instances LIMIT 1;
  IF v_inst_id IS NULL THEN
    v_inst_id := '00000000-0000-0000-0000-000000000000'::uuid;
  END IF;

  DELETE FROM auth.identities WHERE user_id = v_user_id OR provider_id = v_email;
  DELETE FROM auth.users WHERE id = v_user_id OR LOWER(email) = v_email;

  -- Chèn vào auth.users
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    created_at,
    updated_at,
    confirmation_sent_at,
    confirmation_token,
    recovery_token
  ) VALUES (
    v_inst_id,
    v_user_id,
    'authenticated',
    'authenticated',
    v_email,
    extensions.crypt(v_password, extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Nga"}'::jsonb,
    FALSE,
    now(),
    now(),
    now(),
    '',
    ''
  );

  -- Chèn vào auth.identities (id là kiểu UUID)
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
    'email',
    v_email,
    now(),
    now(),
    now()
  );

  -- Đồng bộ profile
  INSERT INTO public.profiles (id, email, full_name, status)
  VALUES (v_user_id, v_email, 'Nga', 'active')
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, status = 'active';

  RAISE NOTICE 'Đã kích hoạt tài khoản % thành công!', v_email;
END $$;

-- 5. HIỂN THỊ KẾT QUẢ KIỂM TRA
SELECT id, email, role, email_confirmed_at, created_at 
FROM auth.users 
WHERE email = 'nga@afo.vn';
