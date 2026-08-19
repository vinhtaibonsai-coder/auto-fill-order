-- =========================================================================
-- CREATE TABLE: address_dictionary
-- Bảng này dùng để lưu trữ dữ liệu ward_merger (giảm tải 4MB cho extension)
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.address_dictionary (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  search_key text NOT NULL UNIQUE,
  mapped_value jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Kích hoạt RLS (Read-only cho mọi người, chỉ cho phép sửa nếu có quyền nâng cao)
ALTER TABLE public.address_dictionary ENABLE ROW LEVEL SECURITY;

-- Mọi người dùng (kể cả không đăng nhập) đều có thể đọc từ điển địa chỉ
DROP POLICY IF EXISTS "Anyone can read address dictionary" ON public.address_dictionary;
CREATE POLICY "Anyone can read address dictionary" 
ON public.address_dictionary FOR SELECT USING (true);
