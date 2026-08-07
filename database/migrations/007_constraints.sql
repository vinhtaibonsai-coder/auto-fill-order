-- 007_constraints.sql
-- Thiết lập ràng buộc UNIQUE cho shop_members và cấu hình RLS bảo vệ CSDL

-- 1. Đảm bảo một user chỉ thuộc về duy nhất 1 shop đang hoạt động
ALTER TABLE IF EXISTS public.shop_members DROP CONSTRAINT IF EXISTS shop_members_shop_id_user_id_key;
ALTER TABLE IF EXISTS public.shop_members DROP CONSTRAINT IF EXISTS shop_members_user_id_unique;
ALTER TABLE IF EXISTS public.shop_members ADD CONSTRAINT shop_members_user_id_unique UNIQUE (user_id);

-- 2. Kích hoạt RLS bảo vệ
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 3. Tạo RLS Policy cho audit_logs: Chỉ SYSTEM_ADMIN mới có quyền xem
DROP POLICY IF EXISTS admin_audit_logs_all ON public.audit_logs;
CREATE POLICY admin_audit_logs_all ON public.audit_logs 
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() AND r.code = 'SYSTEM_ADMIN'
  )
);

-- 4. Tạo RLS Policy cho notifications: Nhận thông báo của Shop mình hoặc Global
DROP POLICY IF EXISTS read_notifications ON public.notifications;
CREATE POLICY read_notifications ON public.notifications 
FOR SELECT USING (
  is_global = true OR 
  (shop_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.shop_members sm 
    WHERE sm.shop_id = notifications.shop_id AND sm.user_id = auth.uid() AND sm.removed_at IS NULL
  ))
);
