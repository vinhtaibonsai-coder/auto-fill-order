-- 004_notifications.sql
-- Cấu trúc bảng notifications hỗ trợ thông báo hệ thống và thông báo theo Shop

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL, -- Tiêu đề thông báo
    content TEXT NOT NULL, -- Nội dung chi tiết
    type TEXT DEFAULT 'general', -- Loại thông báo (system, order, promo)
    level TEXT CHECK (level IN ('INFO', 'WARNING', 'SUCCESS', 'ERROR')) DEFAULT 'INFO', -- Mức độ cảnh báo
    target TEXT, -- Đối tượng người nhận (email, 'all', 'owner', 'staff')
    shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE DEFAULT NULL, -- Gắn với Shop (nếu có)
    is_global BOOLEAN DEFAULT false, -- Thông báo chung toàn hệ thống
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Kích hoạt Row Level Security (RLS) để bảo mật
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Tạo Policy cho phép người dùng đọc thông tin thông báo thuộc shop hoặc toàn quốc
DROP POLICY IF EXISTS "Allow users to read shop or global notifications" ON public.notifications;
CREATE POLICY "Allow users to read shop or global notifications" ON public.notifications
    FOR SELECT USING (
        is_global = true OR
        (shop_id IS NOT NULL AND shop_id IN (
            SELECT shop_id FROM public.shop_members WHERE user_id = auth.uid() AND removed_at IS NULL
        ))
    );
