-- =============================================================================
-- Migration v87: Shop Order Defaults Cloud Sync & Carrier Autofill Settings
--
-- Goals:
--   1. Add order_defaults JSONB column to public.shops for persistent Cloud-level
--      single source of truth across all browser profiles, workstations, and staff.
--   2. Expose RPC owner_update_shop_order_defaults & owner_get_shop_order_defaults
--      with strict multi-tenant authorization (is_shop_owner_or_manager).
--   3. Ensure all members of a shop can read order_defaults while only managers/owners can update.
-- =============================================================================

-- 1. Bổ sung cột order_defaults vào bảng shops nếu chưa có
ALTER TABLE public.shops 
  ADD COLUMN IF NOT EXISTS order_defaults JSONB DEFAULT '{
    "defaultCarrier": "vnpost",
    "defaultItemName": "Hàng hóa",
    "defaultWeight": 200,
    "defaultWeightKg": 0.2,
    "defaultCod": 0,
    "autoParse": true,
    "autoNormalizeAddress": true,
    "requireReviewOnLowConfidence": true
  }'::jsonb;

-- 2. RPC: Cập nhật Cấu Hình Mặc Định Đơn Hàng của Shop lên Cloud
CREATE OR REPLACE FUNCTION public.owner_update_shop_order_defaults(
  p_shop_id UUID,
  p_defaults JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_current JSONB;
  v_merged JSONB;
BEGIN
  IF NOT (public.is_shop_owner_or_manager(p_shop_id) OR public.is_system_admin()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'Không có quyền cập nhật cấu hình của Shop.');
  END IF;

  SELECT order_defaults INTO v_current FROM public.shops WHERE id = p_shop_id;

  v_merged := COALESCE(v_current, '{}'::jsonb) || COALESCE(p_defaults, '{}'::jsonb);

  UPDATE public.shops
  SET order_defaults = v_merged,
      updated_at = now()
  WHERE id = p_shop_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Đã lưu cấu hình mặc định đơn hàng lên Cloud thành công!',
    'order_defaults', v_merged
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_update_shop_order_defaults(UUID, JSONB) TO authenticated, service_role;

-- 3. RPC: Đọc Cấu Hình Mặc Định Đơn Hàng của Shop từ Cloud
CREATE OR REPLACE FUNCTION public.owner_get_shop_order_defaults(p_shop_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_defaults JSONB;
  v_shop_name TEXT;
BEGIN
  SELECT name, order_defaults 
  INTO v_shop_name, v_defaults 
  FROM public.shops 
  WHERE id = p_shop_id;

  IF v_shop_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'SHOP_NOT_FOUND', 'message', 'Không tìm thấy cửa hàng.');
  END IF;

  IF v_defaults IS NULL OR v_defaults = '{}'::jsonb THEN
    v_defaults := '{
      "defaultCarrier": "vnpost",
      "defaultItemName": "Hàng hóa",
      "defaultWeight": 200,
      "defaultWeightKg": 0.2,
      "defaultCod": 0,
      "autoParse": true,
      "autoNormalizeAddress": true,
      "requireReviewOnLowConfidence": true
    }'::jsonb;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'shop_id', p_shop_id,
    'shop_name', v_shop_name,
    'order_defaults', v_defaults
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_get_shop_order_defaults(UUID) TO authenticated, anon, service_role;
