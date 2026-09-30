# Runbook: Xử lý Sự cố Thay đổi DOM Nhà Vận Chuyển (Carrier DOM Change)

> **Mã quy trình**: RB-DOM-01  
> **Mức độ sự cố**: P1 (Nhà vận chuyển thay đổi cấu trúc web khiến Extension không điền được thông tin)  
> **Thành phần liên quan**: VNPost (My VNPost), J&T Express (VIP J&T), Remote Selectors Engine, RPC `admin_publish_remote_selector_release`, RPC `admin_rollback_remote_selector_release`.

---

## 1. Triệu chứng & Dấu hiệu Nhận biết (Symptoms)
- Khách hàng báo cáo nút "Điền Đơn" không bấm được hoặc các trường Tên người nhận, Số điện thoại, Địa chỉ, Tiền COD bị bỏ trống trên trang tạo đơn của VNPost hoặc J&T.
- Console trình duyệt báo lỗi `Cannot read properties of null (reading 'value')` hoặc cảnh báo selector không tìm thấy phần tử DOM.
- Tỷ lệ hoàn thành điền đơn (Autofill Success Rate) của nhà xe tương ứng sụt giảm đột ngột dưới 80%.

---

## 2. Cơ chế Cập nhật Không Cần Duyệt Store (Over-The-Air Remote Selectors)

Trước đây, khi VNPost hoặc J&T thay đổi tên class HTML (ví dụ: `.ant-input` đổi thành `.custom-input-v2`), Extension phải đóng gói lại và chờ Google Chrome Web Store duyệt từ 1 đến 3 ngày.

Hệ thống hiện tại tích hợp cơ chế **Remote Selectors Release Safety**:
1. Extension định kỳ tải cấu hình selector động từ máy chủ.
2. Cấu hình được bảo vệ bằng mã băm kiểm tra tính toàn vẹn **SHA-256 (checksum)**.
3. Nếu cấu hình OTA hợp lệ và tương thích, Extension sẽ nạp ngay lập tức mà không cần người dùng cập nhật lại Extension.

---

## 3. Quy trình Xử lý & Phát hành Bản vá Selector (Remediation Procedure)

### Bước 1: Khảo sát DOM mới trên trang nhà xe
1. Kỹ thuật viên mở DevTools (F12) trên trang tạo đơn VNPost hoặc J&T.
2. Kiểm tra phần tử input bị thay đổi và ghi nhận selector CSS mới nhất.
3. Thử nghiệm điền dữ liệu bằng console JavaScript để chắc chắn selector mới kích hoạt đúng sự kiện `input` và `change` của React/Vue.

### Bước 2: Phát hành Bản cập nhật Selector OTA
Sử dụng RPC quản trị an toàn để công bố bản cập nhật selector mới:
```sql
SELECT public.admin_publish_remote_selector_release(
    'v1.0.3-hotfix-vnpost-receiver-address', -- p_release_name
    'vnpost',                                -- p_carrier ('vnpost' hoặc 'jt')
    jsonb_build_object(
        'name', 'input[placeholder*="Họ và tên người nhận"]',
        'phone', 'input[placeholder*="Số điện thoại người nhận"]',
        'address', 'textarea[placeholder*="Địa chỉ chi tiết"]',
        'province', '#receiver_province_select',
        'district', '#receiver_district_select',
        'ward', '#receiver_ward_select',
        'cod', 'input[name="cod_amount"]',
        'note', 'textarea[name="order_note"]',
        'submit_button', 'button[type="submit"].btn-create-order'
    ),
    'b4c81a95e7d56fa7b120c9e6...sha256checksum...', -- p_checksum (SHA-256)
    'Bản vá khẩn cấp do VNPost thay đổi giao diện form tạo đơn ngày 24/09' -- p_notes
);
```

*Lưu ý an toàn*:
- Hàm `admin_publish_remote_selector_release` yêu cầu quyền `is_system_admin()`.
- Hệ thống tự động kiểm tra tính hợp lệ của schema JSON và tính toàn vẹn của mã băm SHA-256 checksum trước khi kích hoạt.
- Tự động lưu trữ lịch sử phát hành để hỗ trợ hoàn tác khi cần.

### Bước 3: Quy trình Hoàn tác Khẩn cấp (Rollback Remote Selector)
Nếu bản phát hành mới gây ra lỗi phụ hoặc không tương thích trên các phiên bản Chrome cũ:
```sql
SELECT public.admin_rollback_remote_selector_release(
    '00000000-0000-0000-0000-000000000000'::UUID, -- p_target_release_id (ID bản phát hành ổn định trước đó)
    'Hoàn tác về bản selector trước đó do phát hiện xung đột trên trang VNPost cũ' -- p_reason
);
```
Ngay sau khi lệnh thực thi:
- Bản phát hành mục tiêu được đánh dấu `is_active = true`.
- Toàn bộ Extension client sẽ tự động đồng bộ lại selector ổn định trong chu kỳ heartbeat tiếp theo.

---

## 4. Tiêu chí Xác minh Phục hồi (Verification Criteria)
- [ ] Chạy kiểm thử smoke test `npm run test:e2e` thành công với toàn bộ các selector của VNPost và J&T.
- [ ] Thao tác điền đơn mẫu trên trang thực tế của nhà xe hoàn thành đầy đủ các trường (Tên, SĐT, Địa chỉ, Phường xã, COD, Ghi chú) trong < 50ms.
- [ ] Bảng điều khiển Quản trị (`admin-dashboard/` mục Carriers) hiển thị trạng thái `Operational` màu xanh cho nhà vận chuyển tương ứng.
- [ ] Tỷ lệ điền đơn thành công trở lại mức bình thường (> 99%).
