-- =========================================================================
-- v19_hardening_gaps.sql
-- VÁ CÁC KHOẢNG TRỐNG CÒN SÓT TỪ RLS_MATRIX.md
--
-- Mục tiêu:
--   1. AUDIT LOG IMMUTABLE (mục 29): hiện policy 007 cho phép SYSTEM_ADMIN
--      FOR ALL (kể cả UPDATE/DELETE). -> Chỉ cho SELECT, cấm mọi ghi trực tiếp,
--      retro chỉ viết qua RPC.
--   2. DISABLED USER bị chặn toàn hệ thống (mục 38/Auth): thêm check
--      profiles.status='active' vào mọi `is_shop_member`/`is_system_admin`/
--      `check_shop_member_or_admin` -> user bị khóa không gọi được RPC mặc dù
--      còn token JWT hợp lệ.
--   3. SEARCH_PATH HARDENING: mọi hàm SECURITY DEFINER quan trọng phải
--      SET search_path='' (chống search-path hijack).
--   4. Chỉ lưu index cho query thực tế (mục 25): bổ sung index còn thiếu
--      trên orders (shop_id, created_at DESC) nếu chưa có.
-- =========================================================================

-- =====================================================================
-- 1. AUDIT LOG IMMUTABLE
--    - Drop policy FOR ALL cũ (nguy hiểm: sysadmin/writer có thể UPDATE/DELETE)
--    - Policy mới: SELECT cho SYSTEM_ADMIN; INSERT cho hệ thống/service_role
--      (các RPC SECURITY DEFINER chạy với quyền owner vẫn ghi được)
-- =====================================================================
DROP POLICY IF EXISTS admin_audit_logs_all ON public.audit_logs;
DROP POLICY IF EXISTS "Admin can manage audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS admin_audit_logs_read ON public.audit_logs;

CREATE POLICY admin_audit_logs_read ON public.audit_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid() AND r.code = 'SYSTEM_ADMIN'
        )
    );

-- Chặn UPDATE/DELETE từ client bằng policy "nothing": thông thường RLS
-- deny toàn bộ khi không có policy; ta thêm policy no-op để rõ ràng.
DROP POLICY IF EXISTS no_audit_update ON public.audit_logs;
CREATE POLICY no_audit_update ON public.audit_logs
    FOR UPDATE USING (false);

DROP POLICY IF EXISTS no_audit_delete ON public.audit_logs;
CREATE POLICY no_audit_delete ON public.audit_logs
    FOR DELETE USING (false);

-- Không cho role 'authenticated' UPDATE/DELETE trên audit_logs (an toàn tầng 2)
REVOKE UPDATE, DELETE ON public.audit_logs FROM authenticated;
REVOKE UPDATE, DELETE ON public.audit_logs FROM anon;

-- =====================================================================
-- 2. DISABLED USER CHECK — bổ sung trạng thái profile vào mọi RPC guard
--    (profiles.disabled_at đã có từ v12; status có từ đầu)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.is_shop_member(p_shop_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.shop_members sm
        JOIN public.profiles p ON p.id = sm.user_id
        WHERE sm.user_id = auth.uid()
          AND sm.shop_id = p_shop_id
          AND sm.removed_at IS NULL
          AND sm.status = 'active'
          AND p.status = 'active'
          AND p.disabled_at IS NULL
    );
$$;

CREATE OR REPLACE FUNCTION public.is_system_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        JOIN public.profiles p ON p.id = ur.user_id
        WHERE ur.user_id = auth.uid()
          AND r.code = 'SYSTEM_ADMIN'
          AND p.status = 'active'
          AND p.disabled_at IS NULL
    );
$$;

-- Helper v17 check_shop_member_or_admin — đồng bộ bằng is_shop_member/is_system_admin
-- (đã gồm guard disabled qua 2 hàm trên)
-- =====================================================================
-- 3. SEARCH_PATH HARDENING trên các RPC ADMIN còn thiếu (v16 đã dùng helper)
--    set trên các hàm ghi dữ liệu (không cần schema mở).
-- =====================================================================
ALTER FUNCTION public.consume_ai_quota(UUID, INT, INT, INT, TEXT, TEXT) SET search_path = '';
ALTER FUNCTION public._ai_refresh_monthly_window(UUID) SET search_path = '';
ALTER FUNCTION public.get_ai_budget(UUID) SET search_path = '';
ALTER FUNCTION public.check_ai_rate_limit(UUID, INT) SET search_path = '';
ALTER FUNCTION public.check_shop_member_or_admin(UUID) SET search_path = '';
ALTER FUNCTION public.admin_list_users() SET search_path = '';
ALTER FUNCTION public.admin_set_user_role(UUID, TEXT) SET search_path = '';
ALTER FUNCTION public.admin_create_user(TEXT, TEXT, TEXT, TEXT) SET search_path = '';
ALTER FUNCTION public.admin_reset_user_password(UUID, TEXT) SET search_path = '';
ALTER FUNCTION public.admin_assign_user_shop(UUID, UUID, TEXT) SET search_path = '';
ALTER FUNCTION public.admin_change_user_role(UUID, TEXT) SET search_path = '';
ALTER FUNCTION public.admin_list_devices() SET search_path = '';
ALTER FUNCTION public.admin_revoke_device(UUID, BOOLEAN) SET search_path = '';

-- =====================================================================
-- 4. INDEX cho query thực tế (mục 25)
--    orders (shop_id, created_at DESC) — nếu chưa có
--    orders (shop_id, status)
--    orders (phone) — dùng cho search SĐT nhanh
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_orders_shop_created
    ON public.orders (shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_shop_status
    ON public.orders (shop_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_phone
    ON public.orders (phone);

-- submitted_orders: cần index tương tự cho danh sách đã lên đơn
CREATE INDEX IF NOT EXISTS idx_submitted_shop_created
    ON public.submitted_orders (shop_id, submitted_at DESC);

-- =====================================================================
-- GHI CHÚ:
--   - RLS audit_logs giờ chỉ SELECT(SYSTEM_ADMIN); mọi ghi audit đi qua RPC.
--   - User bị disabled ngay lập tức mất quyền truy cập mọi RPC/RLS.
--   - search_path='' template hardening giống Supabase best-practice.
--   - Constraint UNIQUE(user_id) trên shop_members (007) đã (1 user/1 shop
--     active); nếu cần đa shop/user hãy chú ý ở v15+.
-- =====================================================================