-- =========================================================================
-- v43_notifications_realtime_rbac.sql
-- Hoàn thiện hệ thống quản lý thông báo:
-- 1. Bật RLS và thêm chính sách bảo mật cho notifications.
-- 2. Cập nhật RPC system_get_notifications để trả về trạng thái is_read.
-- 3. Sửa hàm mark_notification_read để cập nhật thực tế vào DB.
-- =========================================================================

-- 1. Bật RLS cho bảng notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view notifications of their shop" ON public.notifications;
CREATE POLICY "Users can view notifications of their shop" ON public.notifications
  FOR SELECT TO authenticated
  USING (
    is_global = true OR
    shop_id IN (
      SELECT shop_id FROM public.shop_members 
      WHERE user_id = auth.uid() AND removed_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Admins can manage notifications" ON public.notifications;
CREATE POLICY "Admins can manage notifications" ON public.notifications
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid() AND r.code = 'SYSTEM_ADMIN'
    )
  );

-- 2. Cập nhật RPC system_get_notifications (trả về thêm cột is_read)
CREATE OR REPLACE FUNCTION public.system_get_notifications(p_shop_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT json_agg(t) INTO v_result FROM (
        SELECT id, title, content, type, level, is_read, created_at
        FROM public.notifications
        WHERE is_global = true OR shop_id = p_shop_id
        ORDER BY created_at DESC LIMIT 50
    ) t;
    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- 3. Sửa RPC mark_notification_read (cập nhật thực tế vào DB)
CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.notifications
    SET is_read = true
    WHERE id = p_notification_id;
    
    RETURN jsonb_build_object('success', true);
END;
$$;

-- Cấp quyền thực thi các RPC
GRANT EXECUTE ON FUNCTION public.system_get_notifications(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.system_get_notifications(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_notification_read(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_notification_read(UUID) TO service_role;

-- 4. Thêm một vài thông báo mẫu cho shop đang hoạt động để hiển thị
-- (Chạy trigger tự tạo thông báo chào mừng cho Shop mới nếu cần)
INSERT INTO public.notifications (title, message, content, type, level, is_read, is_global, created_at)
VALUES 
  (
    'Chào mừng bạn đến với VietAutoFill!', 
    'VietAutoFill V1 Commercial đã sẵn sàng hỗ trợ shop của bạn đi đơn thần tốc!', 
    'VietAutoFill V1 Commercial đã sẵn sàng hỗ trợ shop của bạn đi đơn thần tốc!', 
    'system', 
    'info', 
    false, 
    true, 
    now() - interval '1 hour'
  ),
  (
    'Cảnh báo bảo mật hệ thống', 
    'Vui lòng kiểm tra lại cấu hình tài khoản bưu cục và không chia sẻ mật khẩu nhân viên.', 
    'Vui lòng kiểm tra lại cấu hình tài khoản bưu cục và không chia sẻ mật khẩu nhân viên.', 
    'security', 
    'warning', 
    false, 
    true, 
    now()
  )
ON CONFLICT DO NOTHING;

COMMENT ON FUNCTION public.system_get_notifications IS 'Đọc danh sách thông báo hệ thống và chi nhánh (bao gồm trạng thái đọc is_read).';
COMMENT ON FUNCTION public.mark_notification_read IS 'Đánh dấu một thông báo đã đọc trong database.';
