-- 003_members.sql
-- Cấu trúc bảng shop_members và hỗ trợ Soft Delete thành viên shop

CREATE TABLE IF NOT EXISTS public.shop_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES public.roles(id),
    status TEXT DEFAULT 'active',
    joined_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES public.profiles(id),
    removed_at TIMESTAMPTZ DEFAULT NULL
);

-- Đảm bảo cột removed_at tồn tại nếu bảng đã được tạo trước đó
ALTER TABLE IF EXISTS public.shop_members ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ DEFAULT NULL;

-- Kích hoạt Row Level Security (RLS) để bảo mật
ALTER TABLE public.shop_members ENABLE ROW LEVEL SECURITY;

-- Tạo Policy cho phép người dùng đọc thông tin thành viên cùng Shop
DROP POLICY IF EXISTS "Allow users to read members in same shop" ON public.shop_members;
CREATE POLICY "Allow users to read members in same shop" ON public.shop_members
    FOR SELECT USING (
        user_id = auth.uid() OR
        shop_id IN (
            SELECT shop_id FROM public.shop_members WHERE user_id = auth.uid() AND removed_at IS NULL
        )
    );
