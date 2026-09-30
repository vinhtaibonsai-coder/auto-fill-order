-- =========================================================================
-- v104_save_shop_webhook_config.sql
-- Cung cấp RPC lưu và đọc cấu hình Webhook VNPost cho Shop
-- Đảm bảo quyền truy cập an toàn, hỗ trợ cả REST và RPC không bị vướng RLS
-- =========================================================================

CREATE OR REPLACE FUNCTION public.save_shop_webhook_config(
  p_shop_id UUID,
  p_customer_code TEXT,
  p_api_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_normalized_token TEXT;
  v_normalized_code TEXT;
BEGIN
  -- Kiểm tra quyền: Owner, Manager hoặc System Admin
  IF NOT (public.is_shop_owner_or_manager(p_shop_id) OR public.is_system_admin()) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'FORBIDDEN',
      'message', 'Không đủ quyền cập nhật cấu hình Webhook của Shop.'
    );
  END IF;

  v_normalized_token := NULLIF(trim(p_api_token), '');
  v_normalized_code := NULLIF(trim(p_customer_code), '');

  -- Upsert vào shop_feature_flags
  INSERT INTO public.shop_feature_flags (
    shop_id,
    vnpost_customer_code,
    vnpost_api_token,
    updated_at
  )
  VALUES (
    p_shop_id,
    v_normalized_code,
    v_normalized_token,
    now()
  )
  ON CONFLICT (shop_id) DO UPDATE SET
    vnpost_customer_code = EXCLUDED.vnpost_customer_code,
    vnpost_api_token = EXCLUDED.vnpost_api_token,
    updated_at = now();

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Đã lưu cấu hình Webhook VNPost thành công.',
    'shop_id', p_shop_id,
    'customer_code', v_normalized_code,
    'api_token', v_normalized_token
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_shop_webhook_config(UUID, TEXT, TEXT) TO authenticated, service_role;

-- RPC đọc cấu hình Webhook
CREATE OR REPLACE FUNCTION public.get_shop_webhook_config(p_shop_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_res JSONB;
BEGIN
  IF NOT (public.is_shop_owner_or_manager(p_shop_id) OR public.is_system_admin()) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'FORBIDDEN',
      'message', 'Không đủ quyền xem cấu hình Webhook của Shop.'
    );
  END IF;

  SELECT jsonb_build_object(
    'success', true,
    'customer_code', COALESCE(vnpost_customer_code, ''),
    'api_token', COALESCE(vnpost_api_token, '')
  ) INTO v_res
  FROM public.shop_feature_flags
  WHERE shop_id = p_shop_id;

  IF v_res IS NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'customer_code', '',
      'api_token', ''
    );
  END IF;

  RETURN v_res;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_shop_webhook_config(UUID) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
