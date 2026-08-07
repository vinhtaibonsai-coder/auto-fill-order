-- ============================================================================
-- 007_extension_rbac.sql
-- RPC cho Extension đọc quyền live từ shop_members (không hardcode)
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_my_extension_session(UUID);
DROP FUNCTION IF EXISTS public.get_my_extension_session();

CREATE OR REPLACE FUNCTION public.get_my_extension_session(
  p_shop_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_shop_id UUID;
  v_result  JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'UNAUTHENTICATED');
  END IF;

  IF p_shop_id IS NOT NULL THEN
    v_shop_id := p_shop_id;
  ELSE
    SELECT sm.shop_id INTO v_shop_id
    FROM shop_members sm
    WHERE sm.user_id = v_user_id
      AND sm.status  = 'active'
      AND sm.removed_at IS NULL
    ORDER BY sm.joined_at ASC
    LIMIT 1;
  END IF;

  IF v_shop_id IS NULL THEN
    IF EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = v_user_id AND r.code = 'SYSTEM_ADMIN'
    ) THEN
      RETURN jsonb_build_object(
        'role',        'SYSTEM_ADMIN',
        'shop_id',     NULL,
        'shop_name',   'System',
        'status',      'active',
        'permissions', '["*"]'::JSONB,
        'features', jsonb_build_object(
          'ai_parsing_enabled',      true,
          'smart_address_enabled',   true,
          'vnpost_autofill_enabled', true,
          'jt_autofill_enabled',     true
        )
      );
    END IF;
    RETURN jsonb_build_object('error', 'NOT_IN_ANY_SHOP');
  END IF;

  SELECT jsonb_build_object(
    'shop_id',     sm.shop_id,
    'shop_name',   s.name,
    'role',        r.code,
    'status',      sm.status,
    'permissions', COALESCE(sm.permissions, '[]'::JSONB),
    'features', jsonb_build_object(
      'ai_parsing_enabled',      COALESCE(ff.ai_parsing_enabled, true),
      'smart_address_enabled',   COALESCE(ff.smart_address_enabled, true),
      'vnpost_autofill_enabled', COALESCE(ff.vnpost_autofill_enabled, true),
      'jt_autofill_enabled',     COALESCE(ff.jt_autofill_enabled, true)
    ),
    'member_id',   sm.id,
    'joined_at',   sm.joined_at
  ) INTO v_result
  FROM shop_members sm
  JOIN roles r ON r.id = sm.role_id
  JOIN shops s ON s.id = sm.shop_id
  LEFT JOIN shop_feature_flags ff ON ff.shop_id = sm.shop_id
  WHERE sm.user_id    = v_user_id
    AND sm.shop_id    = v_shop_id
    AND sm.status     = 'active'
    AND sm.removed_at IS NULL;

  IF v_result IS NULL THEN
    RETURN jsonb_build_object('error', 'NOT_MEMBER_OF_SHOP');
  END IF;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_extension_session(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_my_extension_session IS
  'Extension RBAC: role + permissions + features của user trong shop. '
  'Gọi sau login và mỗi 5 phút để sync quyền live từ shop_members.';
