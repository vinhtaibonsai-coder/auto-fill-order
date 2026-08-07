-- =========================================================================
-- AUTO FILL ORDER: BẢO MẬT RLS (ROW LEVEL SECURITY)
-- File này chạy trên Supabase SQL Editor.
-- =========================================================================

-- 1. Bật RLS cho các bảng cốt lõi
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_members ENABLE ROW LEVEL SECURITY;

-- 2. Chính sách (Policies) cho bảng `orders`
-- Xóa các policy cũ nếu có
DROP POLICY IF EXISTS "Staff can view shop orders" ON public.orders;
DROP POLICY IF EXISTS "Owner can manage shop orders" ON public.orders;

-- STAFF: Chỉ được xem đơn hàng thuộc Shop mà họ là thành viên
CREATE POLICY "Staff can view shop orders" ON public.orders
FOR SELECT USING (
  shop_id IN (
    SELECT shop_id FROM shop_members 
    WHERE user_id = auth.uid() 
    AND role IN ('STAFF', 'OWNER')
  )
);

-- OWNER: Có toàn quyền (CRUD) đối với đơn hàng thuộc Shop của mình
CREATE POLICY "Owner can manage shop orders" ON public.orders
FOR ALL USING (
  shop_id IN (
    SELECT shop_id FROM shop_members 
    WHERE user_id = auth.uid() 
    AND role = 'OWNER'
  )
);

-- 3. Chính sách cho bảng `shops`
DROP POLICY IF EXISTS "Anyone can view their own shops" ON public.shops;
DROP POLICY IF EXISTS "Only Owner can edit shop" ON public.shops;

-- Tất cả member (Staff/Owner) đều xem được thông tin Shop
CREATE POLICY "Anyone can view their own shops" ON public.shops
FOR SELECT USING (
  id IN (
    SELECT shop_id FROM shop_members 
    WHERE user_id = auth.uid()
  )
);

-- Chỉ OWNER mới có quyền cập nhật cấu hình Shop (AI, Carriers...)
CREATE POLICY "Only Owner can edit shop" ON public.shops
FOR UPDATE USING (
  id IN (
    SELECT shop_id FROM shop_members 
    WHERE user_id = auth.uid() 
    AND role = 'OWNER'
  )
);

-- =========================================================================
-- 4. Chính sách cho các bảng SaaS (Master Architecture v2)
-- =========================================================================

-- Bật RLS
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carrier_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_outbox ENABLE ROW LEVEL SECURITY;

-- 4.1. DEVICES: Staff có thể xem thiết bị của mình, Owner xem được tất cả trong shop
CREATE POLICY "Users can view their own devices" ON public.devices
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Owner can manage all shop devices" ON public.devices
FOR ALL USING (
  shop_id IN (
    SELECT shop_id FROM shop_members WHERE user_id = auth.uid() AND role = 'OWNER'
  )
);

-- 4.2. AUDIT LOGS: Chỉ Owner hoặc Manager mới được xem
CREATE POLICY "Managers can view audit logs" ON public.audit_logs
FOR SELECT USING (
  shop_id IN (
    SELECT shop_id FROM shop_members WHERE user_id = auth.uid() AND role IN ('OWNER', 'MANAGER')
  )
);

CREATE POLICY "System can insert audit logs" ON public.audit_logs
FOR INSERT WITH CHECK (
  shop_id IN (
    SELECT shop_id FROM shop_members WHERE user_id = auth.uid()
  )
);

-- 4.3. SUBSCRIPTIONS: Chỉ Owner mới được xem và thanh toán
CREATE POLICY "Owner can view subscriptions" ON public.subscriptions
FOR SELECT USING (
  shop_id IN (
    SELECT shop_id FROM shop_members WHERE user_id = auth.uid() AND role = 'OWNER'
  )
);

-- 4.4. CARRIER CONFIGS: Staff xem được (để login autofill), Owner chỉnh sửa được
CREATE POLICY "Staff can view carrier configs" ON public.carrier_configs
FOR SELECT USING (
  shop_id IN (
    SELECT shop_id FROM shop_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Owner can update carrier configs" ON public.carrier_configs
FOR ALL USING (
  shop_id IN (
    SELECT shop_id FROM shop_members WHERE user_id = auth.uid() AND role = 'OWNER'
  )
);

-- 4.5. SYNC OUTBOX: Bất kỳ member nào cũng có thể đẩy Outbox, nhưng chỉ lấy được outbox của shop mình
CREATE POLICY "Members can manage shop outbox" ON public.sync_outbox
FOR ALL USING (
  shop_id IN (
    SELECT shop_id FROM shop_members WHERE user_id = auth.uid()
  )
);
