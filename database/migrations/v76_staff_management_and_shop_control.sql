-- =============================================================================
-- Migration: v76_staff_management_and_shop_control.sql
-- Mục đích: Quản lý Nhân viên Kho (Shop Key), Máy trạm, Thống kê KPI & Kill-Switch
-- =============================================================================

-- 1. RPC: Lấy danh sách nhân viên kho & máy trạm kèm thống kê KPI đơn hàng
CREATE OR REPLACE FUNCTION public.owner_get_shop_staff_and_devices(
  p_shop_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Kiểm tra quyền truy cập (Chủ shop, quản lý hoặc internal bypass)
  IF NOT public.check_shop_member_or_admin(p_shop_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'Không có quyền truy cập shop này.');
  END IF;

  -- Truy vấn danh sách thiết bị và tổng hợp số liệu đơn hàng
  WITH device_stats AS (
    SELECT 
      d.id,
      d.device_id,
      d.device_name,
      COALESCE(d.staff_name, 'Nhân viên kho') AS staff_name,
      d.browser,
      d.os_info,
      d.last_ip,
      d.last_seen,
      COALESCE(d.status, CASE WHEN d.revoked THEN 'revoked' ELSE 'active' END) AS status,
      COALESCE(d.revoked, false) AS revoked,
      d.created_at,
      -- Thống kê số đơn đã lên từ máy này hoặc nhân viên này
      COUNT(so.id) AS orders_count,
      COALESCE(SUM(so.cod_amount), 0) AS total_cod,
      MAX(so.submitted_at) AS last_order_at
    FROM public.extension_devices d
    LEFT JOIN public.submitted_orders so 
      ON so.shop_id = p_shop_id 
      AND (
        (so.source_device_id IS NOT NULL AND so.source_device_id = d.device_id)
        OR (d.staff_name IS NOT NULL AND so.created_by_name = d.staff_name)
      )
    WHERE d.shop_id = p_shop_id
    GROUP BY d.id, d.device_id, d.device_name, d.staff_name, d.browser, d.os_info, d.last_ip, d.last_seen, d.status, d.revoked, d.created_at
    ORDER BY d.last_seen DESC NULLS LAST, d.created_at DESC
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', id,
      'device_id', device_id,
      'device_name', device_name,
      'staff_name', staff_name,
      'browser', browser,
      'os_info', os_info,
      'last_ip', last_ip,
      'last_seen', last_seen,
      'status', status,
      'revoked', revoked,
      'created_at', created_at,
      'orders_count', orders_count,
      'total_cod', total_cod,
      'last_order_at', last_order_at
    )
  ) INTO v_result
  FROM device_stats;

  RETURN jsonb_build_object(
    'success', true,
    'staff_devices', COALESCE(v_result, '[]'::jsonb)
  );
END;
$$;

-- 2. RPC: Cập nhật thông tin nhân viên hoặc khóa/mở khóa máy trạm (Kill-Switch)
CREATE OR REPLACE FUNCTION public.owner_update_staff_device(
  p_shop_id UUID,
  p_device_id TEXT,
  p_staff_name TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_is_revoked BOOLEAN;
  v_row RECORD;
BEGIN
  -- Kiểm tra quyền
  IF NOT public.check_shop_member_or_admin(p_shop_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'Không có quyền thực hiện.');
  END IF;

  v_is_revoked := (p_status = 'revoked' OR p_status = 'REVOKED');

  -- Cập nhật bảng extension_devices
  UPDATE public.extension_devices
  SET 
    staff_name = COALESCE(NULLIF(TRIM(p_staff_name), ''), staff_name),
    status = COALESCE(NULLIF(TRIM(p_status), ''), status),
    revoked = CASE WHEN p_status IS NOT NULL THEN v_is_revoked ELSE revoked END,
    updated_at = NOW()
  WHERE shop_id = p_shop_id AND (device_id = p_device_id OR id::text = p_device_id)
  RETURNING * INTO v_row;

  IF v_row IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND', 'message', 'Không tìm thấy thiết bị nhân viên.');
  END IF;

  -- Ghi log kiểm toán audit_logs nếu có
  BEGIN
    INSERT INTO public.audit_logs (shop_id, user_id, action, entity_type, entity_id, details)
    VALUES (
      p_shop_id,
      auth.uid(),
      CASE WHEN v_is_revoked THEN 'STAFF_DEVICE_REVOKED' ELSE 'STAFF_DEVICE_UPDATED' END,
      'device',
      v_row.id::text,
      jsonb_build_object(
        'device_name', v_row.device_name,
        'staff_name', v_row.staff_name,
        'status', v_row.status,
        'revoked', v_row.revoked
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- Không chặn luồng nếu audit log lỗi
  END;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Đã cập nhật thông tin nhân viên thành công.',
    'device', jsonb_build_object(
      'id', v_row.id,
      'device_id', v_row.device_id,
      'staff_name', v_row.staff_name,
      'status', v_row.status,
      'revoked', v_row.revoked
    )
  );
END;
$$;

-- 3. RPC: Kiểm tra tính hợp lệ của thiết bị Extension (Kiểm tra Kill-Switch)
CREATE OR REPLACE FUNCTION public.check_device_session_validity(
  p_device_id TEXT,
  p_shop_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_dev RECORD;
BEGIN
  SELECT id, status, revoked, staff_name
  INTO v_dev
  FROM public.extension_devices
  WHERE shop_id = p_shop_id AND (device_id = p_device_id OR id::text = p_device_id)
  LIMIT 1;

  IF v_dev IS NULL THEN
    -- Thiết bị mới hoặc chưa đăng ký
    RETURN jsonb_build_object('valid', true, 'status', 'unregistered', 'revoked', false);
  END IF;

  IF v_dev.revoked = true OR v_dev.status = 'revoked' THEN
    RETURN jsonb_build_object('valid', false, 'status', 'revoked', 'revoked', true, 'message', 'Thiết bị này đã bị Chủ Shop thu hồi quyền.');
  END IF;

  RETURN jsonb_build_object('valid', true, 'status', 'active', 'revoked', false, 'staff_name', v_dev.staff_name);
END;
$$;

-- Cấp quyền execute cho authenticated và anon
GRANT EXECUTE ON FUNCTION public.owner_get_shop_staff_and_devices(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.owner_update_staff_device(UUID, TEXT, TEXT, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.check_device_session_validity(TEXT, UUID) TO authenticated, anon;
