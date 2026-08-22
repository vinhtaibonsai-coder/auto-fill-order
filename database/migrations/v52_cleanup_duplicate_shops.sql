-- =========================================================================
-- v52_cleanup_duplicate_shops.sql
-- Tự động dọn dẹp các shop trùng lặp tự sinh do lỗi đăng nhập.
-- Giữ lại đúng 1 shop duy nhất cho mỗi tài khoản (ưu tiên shop có đơn hàng hoặc shop cũ nhất).
-- =========================================================================

DO $$
DECLARE
    r_owner RECORD;
    v_keep_shop_id UUID;
BEGIN
    -- Lặp qua tất cả các chủ shop sở hữu nhiều hơn 1 cửa hàng hoạt động
    FOR r_owner IN 
        SELECT owner_id, COUNT(*) as cnt 
        FROM public.shops 
        WHERE deleted_at IS NULL 
        GROUP BY owner_id 
        HAVING COUNT(*) > 1
    LOOP
        -- Xác định shop tối ưu nhất để giữ lại:
        -- 1. Ưu tiên shop có nhiều đơn hàng nhất trong bảng submitted_orders
        -- 2. Nếu bằng nhau, chọn shop được tạo trước tiên (created_at tăng dần)
        SELECT s.id INTO v_keep_shop_id
        FROM public.shops s
        LEFT JOIN (
            SELECT shop_id, COUNT(*) as order_count 
            FROM public.submitted_orders 
            GROUP BY shop_id
        ) o ON o.shop_id = s.id
        WHERE s.owner_id = r_owner.owner_id AND s.deleted_at IS NULL
        ORDER BY COALESCE(o.order_count, 0) DESC, s.created_at ASC
        LIMIT 1;

        IF v_keep_shop_id IS NOT NULL THEN
            -- Đưa tất cả các shop trùng lặp khác của chủ shop này vào trạng thái xóa tạm (soft delete)
            UPDATE public.shops
            SET deleted_at = now(),
                status = 'inactive'
            WHERE owner_id = r_owner.owner_id
              AND id <> v_keep_shop_id
              AND deleted_at IS NULL;

            -- Cập nhật profile của chủ shop để gắn chặt với duy nhất shop được giữ lại
            UPDATE public.profiles
            SET shop_id = v_keep_shop_id
            WHERE id = r_owner.owner_id;

            -- Loại bỏ quyền thành viên của chủ shop tại các shop đã bị xóa tạm
            DELETE FROM public.shop_members
            WHERE user_id = r_owner.owner_id
              AND shop_id <> v_keep_shop_id;

            -- Đảm bảo quyền sở hữu (SHOP_OWNER) tại shop giữ lại được kích hoạt
            INSERT INTO public.shop_members (shop_id, user_id, role, status)
            VALUES (v_keep_shop_id, r_owner.owner_id, 'SHOP_OWNER', 'active')
            ON CONFLICT (shop_id, user_id) 
            DO UPDATE SET role = 'SHOP_OWNER', status = 'active', removed_at = NULL;
        END IF;
    END LOOP;
END $$;
