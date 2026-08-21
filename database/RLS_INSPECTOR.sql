-- =========================================================================
-- RLS_INSPECTOR.sql — KIỂM TRA TOÀN DIỆN TRẠNG THÁI RLS VÀ CHÍNH SÁCH BẢO MẬT
--
-- Hướng dẫn:
--   1. Dán toàn bộ file này vào Supabase SQL Editor.
--   2. Bấm RUN để thực thi.
--   3. Xem kết quả trả về ở tab NOTICE và kết quả bảng bên dưới.
-- =========================================================================

-- 1. KIỂM TRA TRẠNG THÁI RLS CỦA CÁC BẢNG CORE
SELECT 
    schemaname,
    tablename,
    rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename IN ('shops', 'shop_members', 'orders', 'submitted_orders', 'customers')
ORDER BY tablename;

-- 2. CHI TIẾT CÁC CHÍNH SÁCH BẢO MẬT (POLICIES) ĐANG HOẠT ĐỘNG
SELECT 
    schemaname,
    tablename,
    policyname,
    roles,
    cmd,
    qual AS using_expression,
    with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('shops', 'shop_members', 'orders', 'submitted_orders', 'customers')
ORDER BY tablename, cmd;

-- 3. THỐNG KÊ SỐ LƯỢNG ĐƠN HÀNG BỊ LỖI KHÔNG GẮN SHOP_ID (DẪN ĐẾN RÒ RỈ DỮ LIỆU)
SELECT 
    'orders (draft)' AS table_name,
    COUNT(*) AS total_rows,
    COUNT(*) FILTER (WHERE shop_id IS NULL) AS rows_with_null_shop_id
FROM public.orders
UNION ALL
SELECT 
    'submitted_orders' AS table_name,
    COUNT(*) AS total_rows,
    COUNT(*) FILTER (WHERE shop_id IS NULL) AS rows_with_null_shop_id
FROM public.submitted_orders;

-- 4. KIỂM TRA SỐ LƯỢNG CHỦ SHOP HOẠT ĐỘNG TRÊN MỖI SHOP (BẮT BUỘC CHỈ CÓ 1)
SELECT 
    sm.shop_id,
    s.name AS shop_name,
    COUNT(sm.id) AS active_owners_count
FROM public.shop_members sm
JOIN public.shops s ON s.id = sm.shop_id
WHERE sm.role IN ('SHOP_OWNER', 'OWNER')
  AND sm.status = 'active'
GROUP BY sm.shop_id, s.name
ORDER BY active_owners_count DESC;
