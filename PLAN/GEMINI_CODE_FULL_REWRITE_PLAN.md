# GEMINI_CODE_FULL_REWRITE_PLAN.md

## Mục tiêu

Chỉnh sửa lại toàn bộ hệ thống theo hướng rõ ràng, an toàn và dễ triển khai bằng Gemini Code.

Mục tiêu chốt:

1. `index / panel` là workspace xử lý đơn hàng.
2. `options` là shop control center.
3. `admin-dashboard` là SaaS control plane.
4. Không còn mock production, logic mơ hồ, hoặc luồng thành công giả.
5. Có thể kiểm soát bằng role, shop scope, quota, audit, feature flag và RLS.

## Phạm vi

### Giữ nguyên

- Luồng chính: dán nội dung -> parse -> review -> autofill -> verify -> submit.
- Tương thích VNPost và J&T.
- Multi-tenant theo `shop_id`.
- RLS là lớp bảo vệ cuối cùng.

### Phải sửa

- Ranh giới giữa 3 surface sản phẩm.
- Dữ liệu giả chạy vào production flow.
- Logic chưa hoàn thiện hoặc chỉ trả success trên giấy.
- Module quá lớn, đặc biệt content/runtime/admin.
- Test path đang lệch với cấu trúc hiện tại.

### Không làm ở giai đoạn này

- Không thêm carrier mới.
- Không làm landing page/marketing page.
- Không đổi tone tiếng Việt nếu không cần.
- Không rewrite toàn bộ theo kiểu đập đi làm lại vô tổ chức.

## Bản đồ sản phẩm

### 1. `index / panel`

Workspace cho người dùng thao tác đơn hàng.

Phân hệ:

- Dashboard vận hành
- Tạo đơn
- Review AI
- Address normalization
- Autofill theo carrier
- Order history
- Customer mini CRM
- Sync / notifications

### 2. `options`

Nơi shop owner/manager cấu hình.

Phân hệ:

- Shop profile
- Team / roles / permissions
- AI settings / quota / usage
- Address engine / alias / learning
- Carrier settings
- Order defaults
- Sync policy
- Notifications
- Security / audit / devices
- Subscription / billing

### 3. `admin-dashboard`

SaaS control plane cho system admin.

Phân hệ:

- Overview
- Shops
- Users
- Subscriptions
- AI platform
- Feature flags
- Address dataset
- Carriers
- Devices
- Security / RLS health
- System health
- Support
- Releases

## Các việc ưu tiên

### Phase 1. Fix rủi ro nguy hiểm trước

Việc cần làm:

- Xóa mọi fallback mock có thể lọt vào luồng sản xuất.
- Sửa runtime reference undefined trong flow scrape/autofill.
- Chốt lại contract giữa UI, parser, autofill và backend.

Hoàn thành khi:

- Không còn fake customer/order data trong production flow.
- Không còn biến undefined làm vỡ scrape.
- Không có chỗ nào báo success khi chưa cập nhật thật.

### Phase 2. Chốt ranh giới sản phẩm

Việc cần làm:

- Rà lại `index`, `options`, `admin-dashboard`.
- Đảm bảo dashboard spec nằm đúng surface.
- Loại bỏ nội dung thuộc nhầm tầng.

Hoàn thành khi:

- Mỗi surface chỉ phục vụ đúng vai trò của nó.
- Không còn sidebar/header/dashboard bị nhân đôi vô lý.
- Admin không bị trộn với dashboard vận hành của shop.

### Phase 3. Dọn module lớn

Việc cần làm:

- Tách parser, DOM interaction, state và transport nếu đang dính chùm.
- Làm rõ carrier-specific logic.
- Rà lại duplicated source giữa `src` và `extension/src`.

Hoàn thành khi:

- Trách nhiệm module rõ hơn.
- Code dễ test hơn.
- Giảm tình trạng một file ôm quá nhiều việc.

### Phase 4. Khôi phục test và build confidence

Việc cần làm:

- Sửa test path lỗi thời.
- Cập nhật test theo cấu trúc mới.
- Thêm smoke test cho flow VNPost/J&T.

Hoàn thành khi:

- Test suite phản ánh đúng codebase hiện tại.
- Có kiểm tra cho flow chính.
- Build/dev run ổn định hơn.

### Phase 5. Cứng hóa quyền và dữ liệu đa tenant

Việc cần làm:

- Chốt role model.
- Rà lại shop scope ở query và mutation.
- Bảo đảm action nhạy cảm có audit.
- Xác nhận quota/feature flag không chỉ là UI logic.

Hoàn thành khi:

- `shop_id` là ranh giới dữ liệu thật.
- Thay đổi nhạy cảm luôn có audit.
- Backend vẫn là nơi quyết định cuối cùng.

## Danh sách triển khai chi tiết

### A. Index / Panel

1. Làm lại dashboard theo hướng vận hành.
2. Tách KPI, alerts, recent orders, quick actions.
3. Chỉ hiển thị thông tin phục vụ công việc.
4. Giữ loading / empty / error / partial failure.
5. Xóa fallback fake data.
6. Củng cố review UI theo confidence từng field.
7. Rà lại autofill center cho VNPost/J&T.

### B. Options

1. Tổ chức lại navigation theo nhóm nghiệp vụ.
2. Chốt các trang: shop, team, AI, address, carrier, order, sync, security, audit, subscription.
3. Mọi mutation cần audit.
4. AI quota và billing phải là số liệu thật.
5. Tách cấu hình shop khỏi logic vận hành đơn hàng.

### C. Admin Dashboard

1. Overview phải trả lời được hệ thống có khỏe không.
2. Chuẩn hóa shops/users/subscriptions.
3. Thêm health view cho AI, Supabase, sync, carrier.
4. Chuẩn hóa feature flags và rollout.
5. Củng cố support và audit.

### D. Domain / Backend

1. Sửa service nào chỉ audit mà chưa thực thi.
2. Hoàn thiện các mutation còn TODO.
3. Rà lại admin authorization.
4. Rà lại RLS / membership / shop scope.
5. Chuẩn hóa error codes và response contracts.

### E. Runtime / Content Script

1. Tách parser khỏi DOM automation nếu còn dính nhau.
2. Làm rõ logic theo carrier.
3. Sửa biến chưa khai báo và nhánh dễ nổ.
4. Dọn observer, fetch interception và state tracking.
5. Giữ điểm nối ổn định cho review -> fill -> verify.

### F. Testing

1. Cập nhật test paths đúng cấu trúc hiện tại.
2. Sửa test phụ thuộc file cũ.
3. Thêm smoke test cho VNPost/J&T.
4. Thêm test cho removal của mock fallback.
5. Thêm test cho admin auth và mutation safety.

## Tiêu chí chấp nhận

### Sản phẩm

- Không còn dữ liệu giả đi vào production flow.
- Không còn luồng thành công giả.
- Không còn dashboard lẫn vai.
- Không có mutation nhạy cảm thiếu audit.

### Kỹ thuật

- Module boundaries rõ hơn.
- Code dễ đọc và dễ test hơn.
- Test phản ánh kiến trúc mới.
- Luồng chính chạy ổn trên site mục tiêu.

### Vận hành

- Có loading state, empty state, error state.
- Có permission-aware visibility.
- Có shop scope rõ ràng.
- Dễ debug hơn khi có lỗi.

## Rủi ro cần tránh

- Không làm quá rộng rồi vỡ tiến độ.
- Không tách module nhưng giữ contract mơ hồ.
- Không sửa UI trước khi chốt data contract.
- Không để admin dashboard thành bản sao của shop dashboard.
- Không chấp nhận “có vẻ chạy” nếu contract chưa thật.

## Trình tự cho Gemini Code

1. Đọc repo và xác nhận surface thực tế.
2. Sửa bug nguy hiểm nhất trong runtime/content/admin.
3. Chốt ranh giới giữa `index`, `options`, `admin-dashboard`.
4. Cập nhật hoặc bổ sung test.
5. Tách module lớn nếu còn dính chùm.
6. Chạy kiểm tra thủ công trên flow VNPost/J&T.
7. Chỉ mở rộng tính năng khi contract đã ổn.

## Định nghĩa xong việc

Hệ thống chỉ được xem là hoàn thành khi:

- `index / panel` là worker workspace thật.
- `options` là shop control center thật.
- `admin-dashboard` là SaaS control plane thật.
- Flow autofill không còn dữ liệu giả.
- Các thay đổi nhạy cảm có audit.
- Test và contract không còn lệch kiến trúc hiện tại.

