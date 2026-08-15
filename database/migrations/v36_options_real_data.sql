-- =========================================================================
-- v36_options_real_data.sql
-- MIGRATION BỔ SUNG (ADDITIVE) cho P3 "Options — dữ liệu thật".
-- Xác minh DB thật (2026-08-11):
--   * shop_members: cột thật user_id, shop_id, role TEXT (OWNER/MANAGER/STAFF/VIEWER),
--     status, removed_at, created_at. KHÔNG có role_id (006_admin_rpc cũ dùng role_id
--     -> sẽ lỗi 42703 lúc chạy với user thật; bỏ qua, dùng RPC _v2 mới).
--   * shop_members đã ENABLE RLS nhưng KHÔNG có policy -> user bị deny mọi truy cập.
--   * shop_feature_flags: bảng thật (shop_id PK-ish, boolean flags, custom_prompt_rules).
--   * subscriptions: cột thật plan_code/status/billing_cycle/current_period_*/max_users/max_devices.
--   * RLS subscriptions: chỉ OWNER được SELECT (01_rls_policies).
--
-- Migration này chỉ:
--   1. RLS policy shop_members: member được SELECT danh sách thành viên shop mình
--   2. RLS policy shop_feature_flags: member SELECT + OWNER/ADMIN UPDATE
--   3. shop_feature_flags: thêm cột ai_confidence_threshold, ai_auto_correct
--   4. RPC owner_get_members_v2() — đọc members theo schema THẬT (role TEXT)
--   5. RPC owner_invite_staff_v2() — mời member (ghi notifications + audit_logs)
--   6. RPC owner_remove_staff_v2() — xóa member (soft-delete removed_at + audit)
-- =========================================================================

-- ---------------------------------------------------------------------
-- 1. RLS: shop_members — member đọc được danh sách thành viên cùng shop
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Shop members view members" ON public.shop_members;
CREATE POLICY "Shop members view members" ON public.shop_members
  FOR SELECT USING (
    shop_id IN (
      SELECT sm2.shop_id FROM public.shop_members sm2
      WHERE sm2.user_id = auth.uid() AND sm2.removed_at IS NULL
    )
  );

-- ---------------------------------------------------------------------
-- 2. RLS: shop_feature_flags — đọc mọi member, ghi chỉ OWNER/SYSTEM_ADMIN
-- ---------------------------------------------------------------------
ALTER TABLE public.shop_feature_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Shop members read feature flags" ON public.shop_feature_flags;
CREATE POLICY "Shop members read feature flags" ON public.shop_feature_flags
  FOR SELECT USING (
    public.is_shop_member(shop_id)
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.code = 'SYSTEM_ADMIN'
    )
  );

DROP POLICY IF EXISTS "Shop owners update feature flags" ON public.shop_feature_flags;
CREATE POLICY "Shop owners update feature flags" ON public.shop_feature_flags
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.shop_members sm
      WHERE sm.shop_id = shop_feature_flags.shop_id
        AND sm.user_id = auth.uid()
        AND UPPER(sm.role) = 'OWNER'
        AND sm.status = 'active'
        AND sm.removed_at IS NULL
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.code = 'SYSTEM_ADMIN'
    )
  );

DROP POLICY IF EXISTS "Shop owners insert feature flags" ON public.shop_feature_flags;
CREATE POLICY "Shop owners insert feature flags" ON public.shop_feature_flags
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shop_members sm
      WHERE sm.shop_id = shop_feature_flags.shop_id
        AND sm.user_id = auth.uid()
        AND UPPER(sm.role) = 'OWNER'
        AND sm.status = 'active'
        AND sm.removed_at IS NULL
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.code = 'SYSTEM_ADMIN'
    )
  );

-- ---------------------------------------------------------------------
-- 3. shop_feature_flags: cột AI Settings (Options O-06)
-- ---------------------------------------------------------------------
ALTER TABLE public.shop_feature_flags
  ADD COLUMN IF NOT EXISTS ai_confidence_threshold INT DEFAULT 90;

ALTER TABLE public.shop_feature_flags
  ADD COLUMN IF NOT EXISTS ai_auto_correct BOOLEAN DEFAULT true;

-- ---------------------------------------------------------------------
-- 4. RPC: owner_get_members_v2() — schema THẬT (shop_members.role TEXT)
--    Chỉ OWNER (hoặc manager? giữ chuẩn 006: OWNER) mới gọi được.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.owner_get_members_v2(p_shop_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.shop_members sm
    WHERE sm.shop_id = p_shop_id
      AND sm.user_id = auth.uid()
      AND UPPER(sm.role) IN ('OWNER', 'MANAGER')
      AND sm.status = 'active'
      AND sm.removed_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Bạn không có quyền quản lý thành viên của Shop này.';
  END IF;

  SELECT COALESCE(json_agg(t ORDER BY CASE UPPER(t.role_code)
      WHEN 'OWNER' THEN 1 WHEN 'MANAGER' THEN 2
      WHEN 'STAFF' THEN 3 WHEN 'VIEWER' THEN 4 ELSE 5 END), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT
      p.id   AS user_id,
      p.email,
      p.full_name,
      sm.role AS role_code,
      sm.status,
      sm.created_at AS joined_at
    FROM public.shop_members sm
    JOIN public.profiles p ON sm.user_id = p.id
    WHERE sm.shop_id = p_shop_id AND sm.removed_at IS NULL
  ) t;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_get_members_v2(UUID) TO authenticated;

-- ---------------------------------------------------------------------
-- 5. RPC: owner_invite_staff_v2() — mời member qua email
--    Không auto-add: ghi notification (invite) + audit_logs.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.owner_invite_staff_v2(
  p_email TEXT,
  p_shop_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_invite_code TEXT;
  v_shop_name   TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.shop_members sm
    WHERE sm.shop_id = p_shop_id
      AND sm.user_id = auth.uid()
      AND UPPER(sm.role) IN ('OWNER', 'MANAGER')
      AND sm.status = 'active'
      AND sm.removed_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Chỉ Chủ Shop hoặc Quản lý mới có quyền mời nhân viên.';
  END IF;

  v_invite_code := 'INV-' || upper(substr(md5(random()::text), 1, 6));

  SELECT name INTO v_shop_name FROM public.shops WHERE id = p_shop_id;

  INSERT INTO public.notifications (title, content, type, level, target, shop_id)
  VALUES (
    'Lời mời thành viên',
    'Tài khoản ' || p_email || ' được mời tham gia shop ' || COALESCE(v_shop_name, '') || '. Mã: ' || v_invite_code,
    'invite', 'INFO', p_email, p_shop_id
  );

  INSERT INTO public.audit_logs (shop_id, user_id, action, entity_type, entity_id, details)
  VALUES (
    p_shop_id, auth.uid(), 'INVITE_MEMBER', 'MEMBER', p_email,
    jsonb_build_object('invite_code', v_invite_code)
  );

  RETURN jsonb_build_object('success', true, 'invite_code', v_invite_code);
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_invite_staff_v2(TEXT, UUID) TO authenticated;

-- ---------------------------------------------------------------------
-- 6. RPC: owner_remove_staff_v2() — soft-delete member
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.owner_remove_staff_v2(
  p_user_id UUID,
  p_shop_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.shop_members sm
    WHERE sm.shop_id = p_shop_id
      AND sm.user_id = auth.uid()
      AND UPPER(sm.role) IN ('OWNER', 'MANAGER')
      AND sm.status = 'active'
      AND sm.removed_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Không có quyền thực hiện.';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Không thể tự xóa chính mình khỏi Shop.';
  END IF;

  UPDATE public.shop_members
  SET removed_at = now()
  WHERE user_id = p_user_id AND shop_id = p_shop_id AND removed_at IS NULL;

  INSERT INTO public.audit_logs (shop_id, user_id, action, entity_type, entity_id)
  VALUES (p_shop_id, auth.uid(), 'REMOVE_MEMBER', 'MEMBER', p_user_id::TEXT);

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_remove_staff_v2(UUID, UUID) TO authenticated;