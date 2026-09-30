# Feature Specification: Sổ Bạ Khách Hàng 360

**Feature Branch**: `002-customer-hub-360`  
**Created**: 2026-08-28  
**Status**: Draft  
**Input**: Phát triển Customer Hub tập trung từ dữ liệu đơn hàng, hồ sơ 360, chống bom, phân khúc khách hàng, tích hợp Extension và bảo vệ dữ liệu.

## User Scenarios & Testing

### User Story 1 - Tự động hình thành sổ khách hàng (Priority: P1)

Chủ shop mở Sổ bạ và thấy khách hàng được tổng hợp tự động từ đơn đã lưu/đã gửi; có thể quét đơn lịch sử hoặc nhập tệp để khởi tạo dữ liệu mà không nhập tay.

**Why this priority**: Không có dữ liệu nền thì mọi chức năng CRM, cảnh báo và phân tích đều không tạo giá trị.

**Independent Test**: Tạo hoặc đồng bộ các đơn có cùng số điện thoại và xác nhận hệ thống tạo đúng một hồ sơ, thống kê đúng số đơn và không đếm trùng.

**Acceptance Scenarios**:

1. **Given** một đơn hợp lệ có shop và SĐT, **When** đơn được lưu hoặc gửi, **Then** hồ sơ khách tương ứng được tạo/cập nhật.
2. **Given** nhiều bản ghi của cùng một đơn, **When** chạy đồng bộ lịch sử nhiều lần, **Then** số liệu khách hàng không tăng trùng.
3. **Given** Sổ bạ trống, **When** chủ shop chọn quét lịch sử, **Then** hệ thống hiển thị tiến độ, kết quả thành công/lỗi và danh sách khách vừa tạo.

---

### User Story 2 - Tra cứu hồ sơ khách hàng 360 (Priority: P2)

Nhân viên tìm theo tên hoặc SĐT để xem thông tin khách, nhiều địa chỉ giao hàng, timeline đơn, LTV, AOV, hãng vận chuyển phù hợp, ghi chú và nhãn dùng chung.

**Why this priority**: Đây là giá trị vận hành cốt lõi sau khi dữ liệu đã được hình thành.

**Independent Test**: Tra cứu một khách có nhiều đơn và xác nhận hồ sơ, địa chỉ, timeline, thống kê, ghi chú được hiển thị đúng theo shop hiện tại.

**Acceptance Scenarios**:

1. **Given** khách có nhiều địa chỉ, **When** mở hồ sơ, **Then** mỗi địa chỉ hiển thị tần suất và lần giao gần nhất.
2. **Given** người dùng thêm ghi chú hoặc nhãn, **When** tài khoản khác cùng shop mở hồ sơ, **Then** dữ liệu mới được hiển thị.
3. **Given** hai shop có cùng SĐT khách, **When** tra cứu, **Then** mỗi shop chỉ thấy dữ liệu của mình.

---

### User Story 3 - Nhận diện phân khúc và rủi ro (Priority: P3)

Chủ shop xem nhãn VIP, khách quen, khách mới, ngủ đông và mức rủi ro dựa trên lịch sử giao hàng; người có quyền có thể đưa khách vào blacklist kèm lý do.

**Why this priority**: Giúp ưu tiên chăm sóc và giảm thiệt hại từ đơn COD hoàn/bom.

**Independent Test**: Chuẩn bị khách ở từng ngưỡng và xác nhận phân khúc, chỉ số, mức cảnh báo và lịch sử thay đổi blacklist chính xác.

**Acceptance Scenarios**:

1. **Given** khách đạt ngưỡng VIP hoặc khách quen, **When** số liệu đơn thay đổi, **Then** phân khúc được tính lại nhất quán.
2. **Given** khách có đơn giao thất bại hoặc bị blacklist, **When** xem hồ sơ, **Then** cảnh báo và lý do được hiển thị rõ.
3. **Given** người không có quyền quản lý rủi ro, **When** cố thay đổi blacklist, **Then** thao tác bị từ chối và được ghi nhận.

---

### User Story 4 - Cảnh báo và gợi ý ngay trên Extension (Priority: P4)

Khi nhân viên bóc đơn trên VNPost/J&T, panel nhận diện khách theo SĐT, hiển thị lịch sử, VIP/rủi ro và gợi ý địa chỉ từng giao thành công nhưng không tự ý ghi đè địa chỉ mới.

**Why this priority**: Đưa thông tin CRM tới đúng thời điểm quyết định lên đơn.

**Independent Test**: Bóc đơn của khách VIP, khách rủi ro và khách cũ có nhiều địa chỉ; xác nhận panel hiển thị đúng và chỉ áp dụng địa chỉ khi người dùng chủ động chọn.

**Acceptance Scenarios**:

1. **Given** SĐT thuộc blacklist, **When** bóc đơn, **Then** panel cảnh báo đỏ và khóa nhập đơn theo chính sách shop.
2. **Given** khách VIP, **When** bóc đơn, **Then** panel hiển thị huy hiệu cùng tổng số đơn/LTV.
3. **Given** địa chỉ mới khác lịch sử, **When** bóc đơn, **Then** lịch sử chỉ là gợi ý đối chiếu và không ghi đè tự động.

---

### User Story 5 - Bảo vệ và khai thác dữ liệu (Priority: P5)

Owner/Manager quản lý quyền xem SĐT, xuất danh sách và tạo tệp audience; mọi thao tác nhạy cảm có audit log.

**Why this priority**: Danh sách khách hàng là tài sản nhạy cảm cần kiểm soát trước khi mở rộng khai thác.

**Independent Test**: Đăng nhập từng vai trò, kiểm tra masking, quyền xuất và audit log tương ứng.

**Acceptance Scenarios**:

1. **Given** nhân viên thường, **When** xem danh sách, **Then** SĐT được che và không có quyền export.
2. **Given** owner thực hiện export, **When** tải tệp, **Then** tệp đúng phạm vi lọc và audit log ghi đủ người, shop, thời gian, loại xuất.

### Edge Cases

- SĐT thiếu/không hợp lệ, khác định dạng `+84`, có dấu cách hoặc ký tự đặc biệt.
- Một số điện thoại xuất hiện ở nhiều shop hoặc nhiều tên khác nhau.
- Đơn được lưu rồi gửi tạo hai bản ghi; backfill được chạy lại sau khi gián đoạn.
- Đơn bị sửa trạng thái, hoàn/hủy sau khi hồ sơ đã tổng hợp.
- Địa chỉ mới không giống địa chỉ lịch sử hoặc chuẩn hóa bị cắt ngắn.
- Người dùng mất mạng, phiên đăng nhập hết hạn hoặc dịch vụ cloud không phản hồi.
- Tệp import có cột thiếu, encoding lỗi, dữ liệu trùng hoặc vượt giới hạn.

## Requirements

### Functional Requirements

- **FR-001**: Hệ thống MUST định danh khách theo cặp shop và SĐT đã chuẩn hóa.
- **FR-002**: Hệ thống MUST tự động đồng bộ khách từ đơn mới mà không đếm trùng cùng một đơn.
- **FR-003**: Owner/Manager MUST có thể chạy backfill đơn lịch sử an toàn, lặp lại được và có báo cáo kết quả.
- **FR-004**: Hệ thống MUST hỗ trợ import CSV/XLSX với bước ánh xạ cột, xem trước và báo lỗi theo dòng.
- **FR-005**: Hồ sơ MUST lưu nhiều địa chỉ, tần suất sử dụng và lần giao gần nhất.
- **FR-006**: Hồ sơ MUST hiển thị timeline đơn, mã đơn, mã vận đơn, COD, trạng thái, carrier và nhân viên phụ trách khi có.
- **FR-007**: Hệ thống MUST tính total orders, successful/failed orders, LTV, AOV, success rate, first/last order và carrier ưa thích từ nguồn đơn chuẩn.
- **FR-008**: Hệ thống MUST hỗ trợ tags, notes và blacklist đồng bộ theo shop; không dùng localStorage làm nguồn dữ liệu chuẩn.
- **FR-009**: Hệ thống MUST tính phân khúc new, repeat, vip, churn-risk và risk theo quy tắc cấu hình được.
- **FR-010**: Extension MUST tra cứu hồ sơ theo SĐT và hiển thị thông tin ngắn gọn mà không chặn luồng bóc đơn khi cloud tạm lỗi.
- **FR-011**: Gợi ý địa chỉ lịch sử MUST chỉ được áp dụng sau hành động xác nhận của người dùng.
- **FR-012**: Dữ liệu MUST được cô lập theo shop và áp dụng RBAC cho xem SĐT, blacklist, import, backfill và export.
- **FR-013**: Mọi thao tác export, blacklist và thay đổi dữ liệu nhạy cảm MUST được ghi audit log.
- **FR-014**: Backfill, trigger và cập nhật trạng thái MUST cho cùng kết quả tổng hợp khi chạy lại.
- **FR-015**: Hệ thống MUST có trạng thái loading, empty, partial error và retry rõ ràng.

### Key Entities

- **Customer**: Hồ sơ duy nhất theo shop + SĐT, chứa tên chuẩn, chỉ số tổng hợp, phân khúc và rủi ro.
- **Customer Address**: Một địa chỉ từng dùng, phiên bản thô/chuẩn hóa, tần suất, lần gần nhất và kết quả giao.
- **Customer Note**: Ghi chú nội bộ có người tạo và thời gian.
- **Customer Tag**: Nhãn dùng chung hoặc nhãn hệ thống.
- **Customer Order Link**: Liên kết idempotent giữa khách và một đơn nguồn.
- **Risk Event**: Sự kiện hoàn, thất bại, blacklist hoặc thay đổi mức rủi ro.
- **Import/Backfill Job**: Tiến trình nhập dữ liệu có trạng thái, bộ đếm và lỗi theo dòng.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Backfill 10.000 đơn hoàn thành mà không tạo khách/đơn liên kết trùng khi chạy lại.
- **SC-002**: 95% lượt tra cứu khách thông thường hiển thị kết quả trong 1 giây.
- **SC-003**: 100% dữ liệu khách được cô lập đúng shop trong kiểm thử phân quyền.
- **SC-004**: Nhân viên tra được lịch sử, địa chỉ và cảnh báo của khách trong tối đa 3 thao tác.
- **SC-005**: Mọi thao tác export/blacklist đều có audit log truy vết được.
- **SC-006**: Khi cloud lỗi, luồng paste → parse → review → fill vẫn hoạt động và panel thông báo trạng thái suy giảm.

## Assumptions

- Tái sử dụng hệ thống phiên đăng nhập, active shop, Supabase và RBAC hiện có.
- `submitted_orders` là nguồn ưu tiên cho đơn đã gửi; `orders` bổ sung các đơn chưa gửi nhưng phải chống trùng.
- Trạng thái giao thành công/thất bại cần ánh xạ thống nhất trước khi tính KPI.
- V1 ưu tiên backfill dữ liệu nội bộ và import CSV/XLSX; tích hợp API trực tiếp Pancake/KiotViet/Shopee/TikTok là giai đoạn sau.
- Cảnh báo rủi ro trong Extension không tự động từ chối đơn trừ khi chính sách shop được bật.
