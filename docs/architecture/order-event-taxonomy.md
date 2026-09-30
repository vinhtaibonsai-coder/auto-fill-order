# Order Event Taxonomy & Mutation Mapping (Wave 0 - Task B01)

## 1. Giới thiệu

Tài liệu này chuẩn hóa toàn bộ sự kiện vòng đời đơn hàng (`order_events`), các tác tử thao tác (`actor_type`), quy tắc tính toán `before_patch`/`after_patch`, che giấu dữ liệu nhạy cảm (PII Masking), và bảng tra cứu (mapping) mọi mutation đang diễn ra trong hệ thống sang event chuẩn.

Cơ sở pháp lý & kiến trúc:
- Bảng sự kiện append-only: `public.order_events` (từ `v20_order_lifecycle.sql`).
- Độc lập định danh đơn: Tuân thủ nghiêm ngặt [docs/incidents/2026-08-28-repeat-customer-order-overwrite.md](file:///d:/ODER%20AUTO%20FILL/docs/incidents/2026-08-28-repeat-customer-order-overwrite.md). Định danh đơn luôn là `order_id` hoặc `shop_id + order_code`. Không bao giờ sử dụng SĐT hoặc tên khách hàng làm định danh đơn hàng.

---

## 2. Danh mục sự kiện chuẩn (`ORDER_EVENT_TYPES`)

| Mã sự kiện (`event_type`) | Mô tả nghiệp vụ | Tác tử kích hoạt thông thường | Dữ liệu patch ghi nhận |
|---|---|---|---|
| `ORDER_PARSED` | Bóc tách đơn thô (từ text paste hoặc OCR) ra các trường có cấu trúc. | `USER`, `AI` | Trạng thái ban đầu của các trường đơn được nhận diện. |
| `AI_REVIEW_STARTED` | Gửi đơn sang mô hình AI (Groq/Gemini) để đánh giá hoặc sửa lỗi. | `SYSTEM`, `USER` | Request ID, model, provider, prompt tokens. |
| `AI_FIELD_CHANGED` | AI tự động chuẩn hóa địa chỉ, phát hiện lỗi COD hoặc điều chỉnh trường. | `AI` | `{ field: before_val }` -> `{ field: after_val }`. |
| `USER_FIELD_CHANGED` | Người dùng chỉnh sửa thủ công một trường trên Panel hoặc bảng quản trị. | `USER` | Chỉ ghi nhận trường bị sửa đổi (ví dụ: COD, địa chỉ, SĐT). |
| `AUTOFILL_STARTED` | Extension bắt đầu điền dữ liệu đơn hàng vào form hãng vận chuyển (VNPost / J&T). | `USER`, `SYSTEM` | Form DOM selector target, carrier type (`VNPOST`, `JT`). |
| `AUTOFILL_VERIFIED` | Xác thực các input trên form của hãng đã nhận đúng giá trị sau khi điền. | `SYSTEM` | Danh sách các field đã match / mismatch trong DOM. |
| `SUBMIT_STARTED` | Nhấn nút nộp đơn (Tạo đơn / Lưu đơn) trên giao diện hãng vận chuyển. | `USER`, `SYSTEM` | Payload gửi lên hãng, thời điểm submit. |
| `TRACKING_RECEIVED` | Nhận được mã vận đơn (tracking code / waybill) từ hãng vận chuyển. | `CARRIER`, `SYSTEM` | `tracking_code`, carrier order id, cước phí sơ bộ. |
| `ORDER_SAVED` | Đơn hàng được lưu vào `submitted_orders` hoặc hàng đợi nội bộ `draft_orders`. | `SYSTEM`, `USER` | Snapshot đơn hàng đầy đủ tại thời điểm lưu. |
| `SYNCED` | Đơn hàng được đồng bộ thành công lên Supabase Cloud hoặc giữa các thiết bị. | `SYSTEM` | Cloud order ID, sync outbox revision, timestamp. |
| `STATUS_CHANGED` | Trạng thái giao vận thay đổi (phát thành công, hoàn hàng, chuyển tiếp). | `CARRIER`, `SYSTEM` | `before_status` -> `after_status`, lý do từ carrier webhook. |
| `PRINT_JOB_CREATED` | Tạo một lệnh in nhãn hàng loạt hoặc đơn lẻ (A5/A6). | `USER`, `SYSTEM` | `print_job_id`, template, số lượng bản in, printer profile. |
| `LABEL_PRINTED` | Nhãn in hoàn tất lần đầu và được xác nhận thành công. | `USER`, `SYSTEM` | `print_job_id`, thời điểm in hoàn tất. |
| `LABEL_REPRINTED` | In lại nhãn đơn hàng (yêu cầu bắt buộc lý do in lại). | `USER` | Lý do in lại (`reprint_reason`), số lần in (`print_count`). |
| `PRINT_FAILED` | Lệnh in gặp sự cố (kẹt giấy, mất kết nối máy in, lỗi driver/bridge). | `SYSTEM`, `USER` | Mã lỗi, chi tiết thông báo lỗi từ print bridge hoặc OS. |
| `ERROR` | Phát sinh lỗi ngoại lệ trong luồng xử lý đơn hàng. | `SYSTEM`, `AI`, `CARRIER` | Error code, stack trace tóm tắt, module phát sinh. |

---

## 3. Danh mục tác tử (`ORDER_ACTOR_TYPES`)

- `USER`: Nhân viên shop, chủ shop hoặc quản trị viên thao tác trực tiếp qua giao diện.
- `AI`: Các mô hình ngôn ngữ / thị giác (Groq Llama, Gemini Vision, OCR Evaluator) hoạt động tự động.
- `SYSTEM`: Tiến trình nền của hệ thống (Service Worker, Outbox worker, Scheduler cron, Extension sync engine).
- `CARRIER`: Hệ thống của đối tác giao vận thông qua Webhook, API response hoặc kết quả tự động hóa DOM.
- `PARTNER_API`: Các hệ thống bên ngoài gọi thông qua Partner API Gateway hoặc MCP Server có cấp quyền.

---

## 4. Bảng Mapping toàn bộ Mutation hiện có trong mã nguồn

| File nguồn & Hàm thực thi | Hành vi hiện tại | Mã sự kiện chuẩn | Tác tử | Dữ liệu ghi vào `order_events` |
|---|---|---|---|---|
| `content.js` / `OrderParser.parse()` | Bóc tách đơn từ văn bản thô người dùng paste vào ô nhập | `ORDER_PARSED` | `USER` | Các trường bóc tách được: tên, SĐT, địa chỉ, COD, ghi chú. |
| `content.js` / `ReviewGate.reviewOrder()` | Gửi sang AI để kiểm tra và chuẩn hóa | `AI_REVIEW_STARTED` | `SYSTEM` | Thông tin prompt, provider (`groq`/`gemini`). |
| `src/application/ai/` / `AddressEngine.normalize()` | Sửa đổi cấp hành chính, ghép phường/xã mới | `AI_FIELD_CHANGED` | `AI` | `before_patch: { ward, district }`, `after_patch: { ward, district }`. |
| `frontend/panel/panel.js` (Surgical field edit) | Người dùng click vào trường trên panel để gõ sửa | `USER_FIELD_CHANGED` | `USER` | `before_patch` & `after_patch` của trường cụ thể (ví dụ SĐT, COD). |
| `content.js` / `CarrierAutofill.fillForm()` | Điền dữ liệu vào form của VNPost hoặc J&T | `AUTOFILL_STARTED` | `SYSTEM` | `metadata: { carrier: 'VNPOST', fields_count: 8 }`. |
| `content.js` / `CarrierAutofill.verifyFilledValues()` | Quét DOM kiểm tra giá trị form sau khi điền | `AUTOFILL_VERIFIED` | `SYSTEM` | `metadata: { verified: true, mismatch_fields: [] }`. |
| `content.js` (Submit Interceptor) | Bắt sự kiện click nút nộp đơn bưu cục | `SUBMIT_STARTED` | `USER` | `metadata: { carrier: 'VNPOST', url: window.location.href }`. |
| `content.js` (Waybill Matcher / Interceptor) | Trích xuất mã vận đơn từ response của bưu cục | `TRACKING_RECEIVED` | `CARRIER` | `metadata: { tracking_code: '...', carrier: 'VNPOST' }`. |
| `src/domain/orders/orders.service.js` / `saveOrder()` | Lưu đơn vào cơ sở dữ liệu `submitted_orders` | `ORDER_SAVED` | `SYSTEM` | Snapshot đơn hàng, `metadata: { saved_order_id: '...' }`. |
| `src/infrastructure/storage/supabase.js` / `syncDraftOrders()` | Đồng bộ đơn hàng lên Supabase cloud | `SYNCED` | `SYSTEM` | `metadata: { cloud_sync: true, sync_batch_id: '...' }`. |
| `supabase/functions/vnpost-webhook/` | Nhận webhook đổi trạng thái từ VNPost | `STATUS_CHANGED` | `CARRIER` | `before_status: 'delivering'`, `after_status: 'delivered'`. |
| `src/application/printing/label-renderer.js` | Tạo nhãn và chuẩn bị xuất in | `PRINT_JOB_CREATED` | `USER` | `metadata: { template: 'A6', order_count: 1 }`. |
| `src/ui/options/` (Print Confirmation) | Người dùng hoặc bridge báo đã in nhãn | `LABEL_PRINTED` | `USER` | `metadata: { copies: 1, print_job_id: '...' }`. |
| `src/ui/options/` (Reprint Dialog) | In lại nhãn có ghi nhận lý do | `LABEL_REPRINTED` | `USER` | `metadata: { reprint_reason: 'Rách giấy', print_count: 2 }`. |
| `content.js` / `showGlobalError()` | Xử lý ngoại lệ trong quá trình nộp hoặc bóc tách | `ERROR` | `SYSTEM` | `metadata: { error_message: '...', error_code: 'DOM_CHANGED' }`. |

---

## 5. Quy tắc Tính toán Patch & Bảo vệ PII (Data Masking)

1. **Nguyên tắc Minimal Patch**:
   - `before_patch` và `after_patch` chỉ chứa các thuộc tính thực sự có sự thay đổi giá trị.
   - Không lưu toàn bộ snapshot đơn hàng vào mỗi sự kiện nhỏ để tiết kiệm bộ nhớ và giảm tải I/O.
2. **Nguyên tắc PII Masking theo Role**:
   - Số điện thoại: Định dạng mặt nạ `098***4321` (giữ 3 số đầu, 4 số cuối).
   - Địa chỉ chi tiết: Che phần số nhà/tên đường (`***, Phường Bến Nghé, Quận 1, TP Hồ Chí Minh`).
   - Các vai trò không có quyền xem PII (`Accountant`, `SUPPORT_STAFF` ngoài phạm vi, hoặc người xem Audit logs toàn hệ thống) chỉ được nhận bản đã mask.
   - Các vai trò nghiệp vụ trực tiếp (`Owner`, `Manager`, `Packer` trong shop) được xem PII đầy đủ để phục vụ đóng gói và giao hàng.
