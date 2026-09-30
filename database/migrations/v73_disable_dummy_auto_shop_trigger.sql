-- =========================================================================
-- Migration v73: Xóa bỏ Trigger sinh Shop rác tự động & Dọn dẹp Shop trùng
-- =========================================================================

-- 1. Tắt vĩnh viễn việc tự động sinh shop rác "Shop của email" khi tạo auth.users
CREATE OR REPLACE FUNCTION public.ensure_user_shop_and_quota()
RETURNS TRIGGER AS $$
BEGIN
  -- Không tự động tạo shop rác nữa vì Admin và User sẽ tự tạo shop chính thức với tên đầy đủ
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Xóa trigger cũ nếu có gắn trực tiếp
DROP TRIGGER IF EXISTS trg_ensure_user_shop_and_quota ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_ensure_shop ON auth.users;

-- 2. Tự động dọn dẹp các shop rác mồ côi (Tên dạng "Shop của %" và không có thành viên nào)
DELETE FROM public.shop_feature_flags 
WHERE shop_id IN (
  SELECT id FROM public.shops 
  WHERE name LIKE 'Shop của %' 
    AND NOT EXISTS (SELECT 1 FROM public.shop_members WHERE shop_members.shop_id = shops.id)
    AND NOT EXISTS (SELECT 1 FROM public.submitted_orders WHERE submitted_orders.shop_id = shops.id)
);

DELETE FROM public.shop_quotas 
WHERE shop_id IN (
  SELECT id FROM public.shops 
  WHERE name LIKE 'Shop của %' 
    AND NOT EXISTS (SELECT 1 FROM public.shop_members WHERE shop_members.shop_id = shops.id)
    AND NOT EXISTS (SELECT 1 FROM public.submitted_orders WHERE submitted_orders.shop_id = shops.id)
);

DELETE FROM public.shops 
WHERE name LIKE 'Shop của %' 
  AND NOT EXISTS (SELECT 1 FROM public.shop_members WHERE shop_members.shop_id = shops.id)
  AND NOT EXISTS (SELECT 1 FROM public.submitted_orders WHERE submitted_orders.shop_id = shops.id);

-- 3. Hiển thị lại danh sách shop sạch sau dọn dẹp
SELECT s.id, s.name, s.status, s.created_at,
       (SELECT COUNT(*) FROM public.shop_members sm WHERE sm.shop_id = s.id) AS members_count
FROM public.shops s
ORDER BY s.created_at DESC;
