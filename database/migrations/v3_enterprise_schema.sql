-- =========================================================================
-- AI ORDER EXTENSION V3 — ENTERPRISE MULTI-TENANT DATABASE MIGRATION (FIXED)
-- Copy toàn bộ nội dung này và dán vào Supabase SQL Editor -> Bấm RUN
-- =========================================================================

-- 1. Bảng Cửa Hàng (shops)
CREATE TABLE IF NOT EXISTS public.shops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    owner_id UUID NOT NULL,
    sender_name TEXT,
    sender_phone TEXT,
    sender_address TEXT,
    sender_province TEXT,
    sender_district TEXT,
    sender_ward TEXT,
    vnpost_customer_code TEXT,
    jt_contract_code TEXT,
    order_code_prefix TEXT DEFAULT 'DH',
    bank_name TEXT,
    bank_account_no TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Bảng User Profiles (profiles)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    avatar_url TEXT,
    status TEXT DEFAULT 'active',
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Bảng Thành Viên Shop (shop_members)
CREATE TABLE IF NOT EXISTS public.shop_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'staff',
    permissions JSONB DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'active',
    joined_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID,
    UNIQUE(shop_id, user_id)
);

-- 4. Bảng Mã Mời Shop (invite_codes)
CREATE TABLE IF NOT EXISTS public.invite_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    code TEXT UNIQUE NOT NULL,
    role TEXT DEFAULT 'staff',
    permissions JSONB DEFAULT '[]'::jsonb,
    expired_at TIMESTAMPTZ NOT NULL,
    max_usage INT DEFAULT 100,
    used INT DEFAULT 0,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Bảng Đơn Nháp (orders)
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
    created_by UUID REFERENCES public.profiles(id),
    customer_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT NOT NULL,
    order_code TEXT,
    cod_amount NUMERIC DEFAULT 0,
    platform TEXT DEFAULT 'vnpost',
    extra_note TEXT,
    status TEXT DEFAULT 'draft',
    device_id TEXT,
    device_name TEXT,
    version INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Bảng Đơn Đã Lên Đơn (submitted_orders)
CREATE TABLE IF NOT EXISTS public.submitted_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
    submitted_by UUID REFERENCES public.profiles(id),
    saved_order_id TEXT,
    customer_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT NOT NULL,
    order_code TEXT,
    tracking_code TEXT,
    cod_amount NUMERIC DEFAULT 0,
    platform TEXT DEFAULT 'vnpost',
    device_name TEXT,
    submitted_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Bảng Khách Hàng (customers)
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT,
    note TEXT,
    tier TEXT DEFAULT 'new',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Bảng Lịch Sử Tách Đơn (history)
CREATE TABLE IF NOT EXISTS public.history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id),
    raw_text TEXT,
    result JSONB,
    model_used TEXT,
    is_ai_used BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. Bảng Thiết Bị (devices)
CREATE TABLE IF NOT EXISTS public.devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    device_name TEXT,
    browser TEXT,
    platform TEXT,
    extension_version TEXT,
    last_online TIMESTAMPTZ DEFAULT now(),
    ip TEXT
);

-- 10. Bảng Nhật Ký Kiểm Toán (audit_logs)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id),
    action TEXT NOT NULL,
    target_table TEXT NOT NULL,
    old_value JSONB,
    new_value JSONB,
    device_name TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 11. Bảng Hoạt Động (activity_logs)
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id),
    user_name TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 12. Bảng Thông Báo (notifications)
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info',
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- =========================================================================
-- ⚡ ĐẢM BẢO BỔ SUNG CỘT `shop_id` CHO CÁC BẢNG ĐÃ TỒN TẠI TỪ TRƯỚC (SAFE ALTER)
-- =========================================================================
ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS shop_id UUID;
ALTER TABLE IF EXISTS public.submitted_orders ADD COLUMN IF NOT EXISTS shop_id UUID;
ALTER TABLE IF EXISTS public.customers ADD COLUMN IF NOT EXISTS shop_id UUID;
ALTER TABLE IF EXISTS public.history ADD COLUMN IF NOT EXISTS shop_id UUID;
ALTER TABLE IF EXISTS public.devices ADD COLUMN IF NOT EXISTS shop_id UUID;
ALTER TABLE IF EXISTS public.audit_logs ADD COLUMN IF NOT EXISTS shop_id UUID;
ALTER TABLE IF EXISTS public.activity_logs ADD COLUMN IF NOT EXISTS shop_id UUID;
ALTER TABLE IF EXISTS public.notifications ADD COLUMN IF NOT EXISTS shop_id UUID;

-- 13. Enable RLS Policy bảo mật Multi-Tenant
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submitted_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- 14. Standard RLS Policies (Cho phép xem/thêm/sửa/xóa nếu thuộc Shop)
DROP POLICY IF EXISTS shop_member_orders_policy ON public.orders;
CREATE POLICY shop_member_orders_policy ON public.orders
FOR ALL USING (
  shop_id IS NULL OR EXISTS (
    SELECT 1 FROM public.shop_members sm
    WHERE sm.shop_id = orders.shop_id
      AND sm.user_id = auth.uid()
      AND sm.status = 'active'
  )
);

DROP POLICY IF EXISTS shop_member_submitted_policy ON public.submitted_orders;
CREATE POLICY shop_member_submitted_policy ON public.submitted_orders
FOR ALL USING (
  shop_id IS NULL OR EXISTS (
    SELECT 1 FROM public.shop_members sm
    WHERE sm.shop_id = submitted_orders.shop_id
      AND sm.user_id = auth.uid()
      AND sm.status = 'active'
  )
);
