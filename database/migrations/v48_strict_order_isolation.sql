-- =========================================================================
-- v48_strict_order_isolation.sql
-- Thắt chặt phân quyền RLS cho các bảng đơn hàng (orders, submitted_orders, history)
-- Tránh rò rỉ dữ liệu chéo giữa các cửa hàng (cross-shop leak) và hỗ trợ
-- tài khoản Quản trị viên hệ thống (SYSTEM_ADMIN) giám sát toàn diện.
-- =========================================================================

-- 1. BẬT TRẠNG THÁI ROW LEVEL SECURITY (RLS)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submitted_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.history ENABLE ROW LEVEL SECURITY;

-- 2. DỌN SẠCH CÁC CHÍNH SÁCH BẢO MẬT (POLICIES) CŨ ĐỂ TRÁNH XUNG ĐỘT (OR EXPRESSION)
DROP POLICY IF EXISTS shop_member_orders_policy ON public.orders;
DROP POLICY IF EXISTS "Strict Shop Isolation for Orders (Read)" ON public.orders;
DROP POLICY IF EXISTS "Strict Shop Isolation for Orders (Insert)" ON public.orders;
DROP POLICY IF EXISTS "Strict Shop Isolation for Orders (Update)" ON public.orders;

DROP POLICY IF EXISTS shop_member_submitted_policy ON public.submitted_orders;
DROP POLICY IF EXISTS "Strict Shop Isolation for Submitted Orders (Read)" ON public.submitted_orders;
DROP POLICY IF EXISTS "Strict Shop Isolation for Submitted Orders (Insert)" ON public.submitted_orders;
DROP POLICY IF EXISTS "Strict Shop Isolation for Submitted Orders (Update)" ON public.submitted_orders;
DROP POLICY IF EXISTS "Strict Shop Isolation for Submitted Orders (Delete)" ON public.submitted_orders;

DROP POLICY IF EXISTS shop_member_history_policy ON public.history;
DROP POLICY IF EXISTS "Strict Shop Isolation for History (Read)" ON public.history;
DROP POLICY IF EXISTS "Strict Shop Isolation for History (Insert)" ON public.history;
DROP POLICY IF EXISTS "Strict Shop Isolation for History (Update)" ON public.history;
DROP POLICY IF EXISTS "Strict Shop Isolation for History (Delete)" ON public.history;


-- =========================================================================
-- 3. CHÍNH SÁCH BẢO MẬT MỚI CHO BẢNG DỰ THẢO ĐƠN HÀNG (public.orders)
-- =========================================================================

-- 3a. Quyền SELECT: Chỉ cho phép thành viên cửa hàng đang hoạt động hoặc Admin hệ thống xem
CREATE POLICY "Strict Shop Isolation for Orders (Read)" ON public.orders
FOR SELECT USING (
  deleted_at IS NULL AND (
    public.is_shop_member(shop_id)
    OR public.is_system_admin()
  )
);

-- 3b. Quyền INSERT: Chỉ cho phép thành viên cửa hàng đang hoạt động thêm đơn
CREATE POLICY "Strict Shop Isolation for Orders (Insert)" ON public.orders
FOR INSERT WITH CHECK (
  public.is_shop_member(shop_id)
);

-- 3c. Quyền UPDATE: Chỉ cho phép thành viên cửa hàng đang hoạt động cập nhật đơn
CREATE POLICY "Strict Shop Isolation for Orders (Update)" ON public.orders
FOR UPDATE USING (
  deleted_at IS NULL AND (
    public.is_shop_member(shop_id)
  )
);

-- 3d. Quyền DELETE: Cấm xóa trực tiếp từ client (hệ thống sử dụng soft-delete qua PATCH deleted_at)
CREATE POLICY "Strict Shop Isolation for Orders (Delete)" ON public.orders
FOR DELETE USING (false);


-- =========================================================================
-- 4. CHÍNH SÁCH BẢO MẬT MỚI CHO BẢNG ĐƠN ĐÃ LÊN HỆ THỐNG (public.submitted_orders)
-- =========================================================================

-- 4a. Quyền SELECT: Chỉ cho phép thành viên cửa hàng đang hoạt động hoặc Admin hệ thống xem
CREATE POLICY "Strict Shop Isolation for Submitted Orders (Read)" ON public.submitted_orders
FOR SELECT USING (
  deleted_at IS NULL AND (
    public.is_shop_member(shop_id)
    OR public.is_system_admin()
  )
);

-- 4b. Quyền INSERT: Chỉ cho phép thành viên cửa hàng đang hoạt động thêm đơn
CREATE POLICY "Strict Shop Isolation for Submitted Orders (Insert)" ON public.submitted_orders
FOR INSERT WITH CHECK (
  public.is_shop_member(shop_id)
);

-- 4c. Quyền UPDATE: Chỉ cho phép thành viên cửa hàng đang hoạt động sửa thông tin (mã tracking...)
CREATE POLICY "Strict Shop Isolation for Submitted Orders (Update)" ON public.submitted_orders
FOR UPDATE USING (
  deleted_at IS NULL AND (
    public.is_shop_member(shop_id)
  )
);

-- 4d. Quyền DELETE: Cho phép thành viên cửa hàng xóa đơn đã lên
CREATE POLICY "Strict Shop Isolation for Submitted Orders (Delete)" ON public.submitted_orders
FOR DELETE USING (
  public.is_shop_member(shop_id)
);


-- =========================================================================
-- 5. CHÍNH SÁCH BẢO MẬT MỚI CHO BẢNG LỊCH SỬ THAY ĐỔI TRẠNG THÁI (public.history)
-- =========================================================================

-- 5a. Quyền SELECT: Chỉ cho phép thành viên cửa hàng đang hoạt động hoặc Admin hệ thống xem
CREATE POLICY "Strict Shop Isolation for History (Read)" ON public.history
FOR SELECT USING (
  deleted_at IS NULL AND (
    public.is_shop_member(shop_id)
    OR public.is_system_admin()
  )
);

-- 5b. Quyền INSERT: Chỉ cho phép thành viên cửa hàng đang hoạt động ghi lịch sử
CREATE POLICY "Strict Shop Isolation for History (Insert)" ON public.history
FOR INSERT WITH CHECK (
  public.is_shop_member(shop_id)
);

-- 5c. Quyền UPDATE: Chỉ cho phép thành viên cửa hàng cập nhật lịch sử
CREATE POLICY "Strict Shop Isolation for History (Update)" ON public.history
FOR UPDATE USING (
  deleted_at IS NULL AND (
    public.is_shop_member(shop_id)
  )
);

-- 5d. Quyền DELETE: Chỉ cho phép thành viên cửa hàng xóa lịch sử
CREATE POLICY "Strict Shop Isolation for History (Delete)" ON public.history
FOR DELETE USING (
  public.is_shop_member(shop_id)
);
