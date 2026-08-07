-- 002_shops.sql
-- Cấu trúc bảng shops và bổ sung các trường phục vụ Soft Delete

CREATE TABLE IF NOT EXISTS public.shops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    owner_id UUID REFERENCES public.profiles(id),
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    deleted_by UUID REFERENCES public.profiles(id) DEFAULT NULL
);

-- Đảm bảo các cột soft delete tồn tại nếu bảng đã được tạo trước đó
ALTER TABLE IF EXISTS public.shops ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE IF EXISTS public.shops ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES public.profiles(id) DEFAULT NULL;

-- Kích hoạt Row Level Security (RLS) để bảo mật
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;

-- Tạo Policy cho phép người dùng đọc thông tin Shop của chính mình
DROP POLICY IF EXISTS "Allow user to read assigned shops" ON public.shops;
CREATE POLICY "Allow user to read assigned shops" ON public.shops
    FOR SELECT USING (
        owner_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.shop_members sm
            WHERE sm.shop_id = shops.id AND sm.user_id = auth.uid() AND sm.removed_at IS NULL
        )
    );
