# Sổ tay Quy trình Hoàn tác Khẩn cấp (Rollback Procedures)

> **Mã quy trình**: RB-ROLLBACK-01  
> **Mục tiêu**: Cung cấp hướng dẫn từng bước để hoàn tác (rollback) an toàn trên cả 3 lớp kiến trúc: Trình duyệt (Chrome Extension), Cấu hình động (Remote Selectors) và Cơ sở dữ liệu (Database Migrations) mà không gây gián đoạn kinh doanh hay mất mát dữ liệu.

---

## 1. Hoàn tác Trình duyệt (Chrome Extension Rollback)

### Khi nào cần hoàn tác?
- Phiên bản Extension mới phát sinh lỗi nghiêm trọng (crash tab, treo trang nhà xe, xung đột giao diện).
- Cần quay lại phiên bản đóng gói ổn định trước đó ngay lập tức cho người dùng nội bộ hoặc người dùng cài đặt Unpacked/Enterprise.

### Các bước thực hiện:

#### Bước 1: Khôi phục mã nguồn từ Git Tag hoặc Commit ổn định
```bash
# Kiểm tra lịch sử tag phát hành
git tag -l "v*"

# Checkout hoặc khôi phục mã nguồn bản ổn định trước đó (ví dụ v1.0.1)
git checkout v1.0.1 -- src/ vite.config.js manifest.json package.json
```

#### Bước 2: Biên dịch và Đồng bộ vào thư mục extension/
> **Bắt buộc**: Tuyệt đối KHÔNG sửa file trong thư mục `extension/` bằng tay! Luôn sử dụng lệnh build chuẩn để đảm bảo tính toàn vẹn và loại bỏ file thừa.
```bash
# Biên dịch production bundle và đồng bộ extension/
npm run build
```

#### Bước 3: Đóng gói Bản phát hành An toàn bằng Release Packager
Sử dụng script đóng gói chuyên dụng đã được kiểm thử:
```bash
# Đóng gói zip chuẩn với kiểm tra SHA-256 và loại bỏ file rác hệ điều hành
node scripts/package-release.js
```
Kết quả: Tạo file zip sẵn sàng tại thư mục `dist-release/auto-fill-order-vX.Y.Z.zip` với đường dẫn file chuẩn (dấu gạch xuôi `/` không chứa backslash `\`) theo đúng quy định của Chrome Web Store.

---

## 2. Hoàn tác Cấu hình Động (Remote Selectors Rollback)

Khi nhà xe cập nhật lại hoặc bản selector OTA mới bị lỗi:
Không cần can thiệp Extension hay nộp duyệt Google Store. Sử dụng RPC hoàn tác ngay trên Database:

```sql
-- 1. Xem lịch sử các bản phát hành selector
SELECT id, release_name, carrier, is_active, checksum, created_at, notes
FROM public.remote_selector_releases
ORDER BY created_at DESC
LIMIT 5;

-- 2. Kích hoạt hoàn tác về bản phát hành trước đó
SELECT public.admin_rollback_remote_selector_release(
    '<ID_CỦA_BẢN_PHÁT_HÀNH_CŨ_ỔN_ĐỊNH>'::UUID,
    'Hoàn tác khẩn cấp do bản cập nhật phát sinh lỗi giao diện'
);
```

Extension của tất cả người dùng sẽ tự động nhận diện bản selector cũ và khôi phục hoạt động trong vòng vài giây.

---

## 3. Hoàn tác Cơ sở Dữ liệu (Database Migration Rollback)

### Nguyên tắc Bất di bất dịch:
- **Không bao giờ dùng DROP TABLE CASCADE** trong môi trường vận hành vì sẽ phá hủy các chính sách bảo mật RLS và khóa ngoại.
- **Tuân thủ quy chuẩn Incident 2026-08-29**: Khi hoàn tác hàm PostgreSQL có tham số mặc định, phải gọi `DROP FUNCTION schema.name(argument_types)` trước khi tạo lại hàm cũ.
- Thực hiện trong giao dịch an toàn (Transaction Block `BEGIN ... COMMIT`).

### Mẫu Hoàn tác Di chuyển Dữ liệu an toàn:
Ví dụ: Khi cần hoàn tác một hàm hoặc bảng mới thêm vào:
```sql
BEGIN;

-- 1. Hủy hàm phiên bản mới
DROP FUNCTION IF EXISTS public.ham_moi_can_rollback(TEXT, INT);

-- 2. Khôi phục lại định nghĩa hàm phiên bản cũ
CREATE OR REPLACE FUNCTION public.ham_moi_can_rollback(TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Nội dung phiên bản cũ ổn định
    RETURN jsonb_build_object('success', true);
END;
$$;

-- 3. Phục hồi phân quyền chính xác
REVOKE ALL ON FUNCTION public.ham_moi_can_rollback(TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.ham_moi_can_rollback(TEXT) TO authenticated, service_role;

-- 4. Thông báo PostgREST nạp lại schema cache
NOTIFY pgrst, 'reload schema';

COMMIT;
```

---

## 4. Tiêu chí Nghiệm thu Hoàn tất Hoàn tác (Verification Criteria)
- [ ] Chạy bộ kiểm thử toàn diện: `npm test && npm run test:security && npm run test:e2e`.
- [ ] Lệnh kiểm tra cấu trúc build `node scripts/check-extension-build.js` trả về thành công 100%.
- [ ] Khách hàng trên trang nhà xe tiếp tục thao tác bình thường mà không cần khởi động lại máy tính.
