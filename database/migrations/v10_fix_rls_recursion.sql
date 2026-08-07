-- =========================================================================
-- v10_fix_rls_recursion.sql
-- FIX: Infinite recursion detected in policy for relation "shop_members"
-- Policy cũ (003_members.sql) tự tham chiếu chính bảng shop_members
-- -> PostgreSQL loop vô hạn -> mọi query chạm shop_members/shops/orders lỗi 500
-- Cách fix: dùng hàm SECURITY DEFINER để kiểm tra quyền thành viên,
-- tránh self-reference trong policy.
-- =========================================================================

-- 1. Xoá policy cũ gây recursion
DROP POLICY IF EXISTS "Allow users to read members in same shop" ON public.shop_members;

-- 2. Hàm kiểm tra user có phải thành viên shop không (SECURITY DEFINER -> không bị RLS cản)
CREATE OR REPLACE FUNCTION public.is_shop_member(p_shop_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.shop_members
        WHERE user_id = auth.uid()
          AND shop_id = p_shop_id
          AND removed_at IS NULL
    );
$$;

-- 3. Hàm kiểm tra user có phải SYSTEM_ADMIN không
CREATE OR REPLACE FUNCTION public.is_system_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() AND r.code = 'SYSTEM_ADMIN'
    );
$$;

-- 4. Policy mới cho shop_members (dùng hàm, KHÔNG self-reference)
DROP POLICY IF EXISTS "Shop members can read members in same shop" ON public.shop_members;
CREATE POLICY "Shop members can read members in same shop" ON public.shop_members
    FOR SELECT USING (
        user_id = auth.uid()
        OR public.is_shop_member(shop_id)
        OR public.is_system_admin()
    );

-- 5. Policy cho phép ADMIN thêm/xoá thành viên shop (thao tác ghi)
DROP POLICY IF EXISTS "Admin can manage shop members" ON public.shop_members;
CREATE POLICY "Admin can manage shop members" ON public.shop_members
    FOR ALL USING (public.is_system_admin())
    WITH CHECK (public.is_system_admin());

-- 6. Thay policy bảng shops bằng version dùng hàm (tránh chain recursion với shop_members)
DROP POLICY IF EXISTS "Users can only access owned or member shops" ON public.shops;
DROP POLICY IF EXISTS "Allow user to read assigned shops" ON public.shops;
CREATE POLICY "Users can only access owned or member shops" ON public.shops
    FOR ALL USING (
        owner_id = auth.uid()
        OR public.is_shop_member(id)
        OR public.is_system_admin()
    );

-- 7. Dọn policy tự tham chiếu ở bảng notifications nếu có (004_notifications.sql)
DROP POLICY IF EXISTS "Allow users to read shop or global notifications" ON public.notifications;
CREATE POLICY "Allow users to read shop or global notifications" ON public.notifications
    FOR SELECT USING (
        is_global = true
        OR public.is_shop_member(shop_id)
        OR public.is_system_admin()
    );
