-- =========================================================================
-- v62_alter_shops_owner_id_nullable.sql
-- Loại bỏ ràng buộc NOT NULL của cột owner_id trong bảng public.shops.
-- Việc này giải quyết lỗi Catch-22 khi xóa một người dùng đang sở hữu cửa hàng:
-- database không cho phép đặt owner_id = NULL do ràng buộc NOT NULL,
-- đồng thời không cho phép xóa profiles do ràng buộc khóa ngoại (Foreign Key).
-- =========================================================================

-- 1. Bỏ ràng buộc NOT NULL của owner_id trong bảng shops
ALTER TABLE public.shops ALTER COLUMN owner_id DROP NOT NULL;
