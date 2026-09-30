# Tasks: Sổ Bạ Khách Hàng 360

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/customer-hub-contracts.md](contracts/customer-hub-contracts.md)  
**Tests**: Có task regression, integration và RLS vì feature xử lý dữ liệu khách hàng, chống trùng và phân quyền nhạy cảm.

## Format

- `[P]`: Có thể thực hiện song song vì khác file và không phụ thuộc task chưa hoàn thành.
- `[USn]`: Liên kết tới User Story trong `spec.md`.

## Phase 1: Setup

**Purpose**: Khóa contract, fixture và cấu trúc module trước khi triển khai.

- [X] T001 Tạo fixture đơn hàng/customer đa shop, duplicate, hoàn và đa địa chỉ tại `tests/fixtures/customer-hub-orders.json`
- [X] T002 [P] Tạo bộ helper assertion cho customer metrics và tenant isolation tại `tests/helpers/customer-hub-assertions.mjs`
- [X] T003 [P] Tạo skeleton deep module Customer Hub tại `src/application/customer/customer.repository.js`, `src/application/customer/customer.service.js`, `src/application/customer/customer-risk.service.js`, và `src/application/customer/customer-import.service.js`
- [X] T004 Ghi mapping trạng thái đơn VNPost/J&T sang success/failed/pending tại `specs/002-customer-hub-360/contracts/customer-hub-contracts.md`

---

## Phase 2: Foundational

**Purpose**: Schema, tenant security và idempotency dùng chung cho mọi story.

**⚠️ CRITICAL**: Hoàn thành phase này trước các user story.

- [X] T005 Viết migration bảng customers, customer_addresses, customer_order_links, customer_notes, customer_tags, customer_tag_assignments, customer_risk_events và customer_sync_jobs tại `database/migrations/v64_customer_hub_360.sql`
- [X] T006 Bổ sung unique constraints, indexes theo shop/phone/order source và address fingerprint tại `database/migrations/v64_customer_hub_360.sql`
- [X] T007 Cài RLS policies theo shop membership và role cho toàn bộ bảng Customer Hub tại `database/migrations/v64_customer_hub_360.sql`
- [X] T008 Cài RPC normalize phone, upsert order link, rebuild customer metrics và backfill batch tại `database/migrations/v64_customer_hub_360.sql`
- [X] T009 Cài audit hooks cho blacklist, export và import/backfill tại `database/migrations/v64_customer_hub_360.sql`
- [X] T010 [P] Viết contract test kiểm tra migration có đủ bảng, constraints, RPC và RLS tại `tests/unit/customer-hub-schema-contract.test.mjs`
- [X] T011 [P] Viết security test chống đọc/ghi dữ liệu customer xuyên shop tại `tests/security/customer-hub-rls.test.mjs`
- [X] T012 Cập nhật migration runner để đưa `v64_customer_hub_360.sql` vào thứ tự triển khai tại `database/migrations/RUN_ALL_MIGRATIONS.sql`

**Checkpoint**: Schema idempotent và tenant isolation sẵn sàng.

---

## Phase 3: User Story 1 — Tự động hình thành sổ khách hàng (P1) 🎯 MVP

**Goal**: Customer Hub có dữ liệu thật từ đơn mới, backfill và import, không đếm trùng.

**Independent Test**: Chạy sync/backfill hai lần trên fixture 2 shop; số customer/order links/metrics lần hai không đổi.

### Tests

- [X] T013 [P] [US1] Viết regression test chống double count giữa orders và submitted_orders tại `tests/unit/customer-hub-deduplication.test.mjs`
- [X] T014 [P] [US1] Viết integration test backfill restart/retry/idempotency tại `tests/integration/customer-hub-backfill.test.mjs`
- [X] T015 [P] [US1] Viết import validation test cho thiếu cột, SĐT lỗi và duplicate tại `tests/unit/customer-hub-import.test.mjs`

### Implementation

- [X] T016 [US1] Implement repository query/upsert/job APIs với active shop bắt buộc tại `src/application/customer/customer.repository.js`
- [X] T017 [US1] Implement normalize phone, order fingerprint và idempotent sync orchestration tại `src/application/customer/customer.service.js`
- [X] T018 [US1] Kết nối luồng lưu/gửi đơn với Customer Hub sync sau khi order persistence thành công tại `src/application/storage.js`
- [X] T019 [US1] Implement backfill theo batch, checkpoint, cancel và retry tại `src/application/customer/customer-import.service.js`
- [X] T020 [US1] Implement CSV/XLSX mapping-preview-validation contract tại `src/application/customer/customer-import.service.js`
- [X] T021 [US1] Thay logic tổng hợp tạm trong CustomerHub bằng repository/service cloud tại `src/ui/options/pages/Customers/CustomerHub.jsx`
- [X] T022 [US1] Thêm empty state, nút Quét đơn lịch sử, tiến độ, partial-error và retry tại `src/ui/options/pages/Customers/CustomerHub.jsx`
- [X] T023 [US1] Thêm luồng Import file, ánh xạ cột, preview và tải báo cáo lỗi tại `src/ui/options/pages/Customers/CustomerHub.jsx`
- [X] T024 [US1] Đồng bộ bản build Options sau khi CustomerHub MVP đạt test bằng `npm run build` và `npm run sync:ext`

**Checkpoint**: Shop có thể tạo sổ khách thật và chạy lại không trùng.

---

## Phase 4: User Story 2 — Hồ sơ khách hàng 360 (P2)

**Goal**: Tra cứu nhanh hồ sơ, đa địa chỉ, timeline, KPI, notes và tags dùng chung.

**Independent Test**: Tìm một khách fixture và đối chiếu toàn bộ timeline, địa chỉ, metrics và ghi chú giữa hai tài khoản cùng shop.

### Tests

- [X] T025 [P] [US2] Viết unit test tính multi-address fingerprint/tần suất/primary address tại `tests/unit/customer-hub-addresses.test.mjs`
- [X] T026 [P] [US2] Viết integration test notes/tags cloud theo shop tại `tests/integration/customer-hub-notes-tags.test.mjs`
- [X] T027 [P] [US2] Viết component contract test cho search, profile drawer và timeline tại `tests/unit/customer-hub-ui.test.mjs`

### Implementation

- [X] T028 [US2] Implement customer list/search/profile/timeline queries tại `src/application/customer/customer.repository.js`
- [X] T029 [US2] Implement address aggregation và primary-address selection tại `src/application/customer/customer.service.js`
- [X] T030 [US2] Implement cloud CRUD cho notes/tags với optimistic state và rollback tại `src/application/customer/customer.service.js`
- [X] T031 [US2] Xây danh sách customer có search/filter/KPI từ dữ liệu cloud tại `src/ui/options/pages/Customers/CustomerHub.jsx`
- [X] T032 [US2] Xây Customer 360 drawer gồm nhiều địa chỉ, timeline mã đơn/COD/tracking/carrier tại `src/ui/options/pages/Customers/CustomerHub.jsx`
- [X] T033 [US2] Chuyển tags/notes localStorage cũ sang cloud một lần và đánh dấu migration tại `src/ui/options/pages/Customers/CustomerHub.jsx`
- [X] T034 [US2] Thêm refresh/realtime invalidation cho hồ sơ đang mở tại `src/ui/options/pages/Customers/CustomerHub.jsx`

**Checkpoint**: Hồ sơ 360 hoạt động độc lập trên trang Options.

---

## Phase 5: User Story 3 — Phân khúc và rủi ro (P3)

**Goal**: Tính RFM/risk nhất quán và quản lý blacklist có kiểm soát.

**Independent Test**: Fixture ở từng ngưỡng tạo đúng new/repeat/vip/churn-risk/risk và blacklist mutation tuân thủ role.

### Tests

- [X] T035 [P] [US3] Viết threshold table tests cho segment, LTV, AOV và success rate tại `tests/unit/customer-hub-rfm.test.mjs`
- [X] T036 [P] [US3] Viết authorization/audit tests cho blacklist tại `tests/security/customer-hub-blacklist.test.mjs`

### Implementation

- [X] T037 [US3] Implement deterministic RFM/risk calculation và shop thresholds tại `src/application/customer/customer-risk.service.js`
- [X] T038 [US3] Cập nhật RPC rebuild metrics để áp dụng mapping trạng thái và risk events tại `database/migrations/v64_customer_hub_360.sql`
- [X] T039 [US3] Implement blacklist/unblacklist mutation với reason và audit tại `src/application/customer/customer.repository.js`
- [X] T040 [US3] Thêm badges, bộ lọc segment/risk và hành động blacklist theo quyền tại `src/ui/options/pages/Customers/CustomerHub.jsx`

**Checkpoint**: Phân khúc và cảnh báo có thể kiểm thử từ Options mà chưa cần Extension.

---

## Phase 6: User Story 4 — Tích hợp hai chiều với Extension (P4)

**Goal**: Panel hiển thị customer summary/risk/address history mà vẫn nhẹ và không phá luồng autofill.

**Independent Test**: Bóc đơn VIP/risk khi online và offline; lookup đúng khi online, graceful fallback khi offline, địa chỉ không bị ghi đè nếu chưa click.

### Tests

- [X] T041 [P] [US4] Viết lookup timeout/cache/tenant contract test tại `tests/unit/panel-customer-summary.test.mjs`
- [X] T042 [P] [US4] Viết regression test cấm tự ghi đè địa chỉ parser bằng địa chỉ lịch sử tại `tests/unit/customer-history-address-safety.test.mjs`

### Implementation

- [X] T043 [US4] Implement API/service trả customer summary tối thiểu theo shop + phone tại `src/application/customer/customer.service.js`
- [X] T044 [US4] Gọi customer lookup sau parse với timeout và cache TTL theo shop/phone tại `src/runtime/content/index.js`
- [X] T045 [US4] Thay lookup lịch sử local bằng customer summary cloud có fallback tại `frontend/panel/panel.js`
- [X] T046 [US4] Hiển thị order count, LTV, VIP/risk và blacklist warning gọn trong vùng Lịch sử khách hàng tại `frontend/panel/panel.js`
- [X] T047 [US4] Hiển thị địa chỉ từng giao thành công dưới dạng lựa chọn xác nhận tại `frontend/panel/panel.js`
- [X] T048 [US4] Style trạng thái safe/warning/blacklist và graceful error trong Shadow DOM tại `frontend/panel/styling/styles.js`
- [X] T049 [US4] Đồng bộ source sang Extension bằng `npm run sync:ext`; ma trận kiểm thử thủ công VNPost/J&T được theo dõi riêng tại T060

**Checkpoint**: Killer feature hoạt động nhưng cloud outage không chặn nhập đơn.

---

## Phase 7: User Story 5 — Bảo vệ và khai thác dữ liệu (P5)

**Goal**: Masking/export/audience tuân thủ RBAC và audit.

**Independent Test**: Owner/Manager/Staff thấy đúng mức dữ liệu và quyền; export tạo audit log, query chéo shop bị từ chối.

### Tests

- [X] T050 [P] [US5] Viết role matrix tests cho phone masking/import/backfill/export tại `tests/security/customer-hub-permissions.test.mjs`
- [X] T051 [P] [US5] Viết export UTF-8/filter/audit contract test tại `tests/unit/customer-hub-export.test.mjs`

### Implementation

- [X] T052 [US5] Implement phone masking và permission checks tập trung tại `src/application/customer/customer.service.js`
- [X] T053 [US5] Implement export CSV UTF-8 theo filter và audit metadata tại `src/application/customer/customer-import.service.js`
- [X] T054 [US5] Thêm churn filters, export audience và disabled states theo role tại `src/ui/options/pages/Customers/CustomerHub.jsx`
- [X] T055 [US5] Bảo đảm Extension chỉ nhận fields phù hợp role tại `src/application/customer/customer.repository.js`

**Checkpoint**: Dữ liệu khách được bảo vệ trước khi rollout toàn shop.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T056 [P] Cập nhật hướng dẫn vận hành backfill/import/rollback tại `specs/002-customer-hub-360/quickstart.md`
- [X] T057 [P] Bổ sung metrics/logging cho job failure, lookup timeout và mutation denied tại `src/application/customer/customer.service.js`
- [X] T058 Kiểm tra performance với 10.000 đơn và ghi kết quả tại `specs/002-customer-hub-360/quickstart.md`
- [X] T059 Chạy `npm test`, `npm run build`, `npm run sync:ext` và toàn bộ security tests liên quan Customer Hub
- [ ] T060 Reload unpacked Extension và hoàn thành manual matrix VNPost/J&T/online/offline/Owner/Manager/Staff theo `specs/002-customer-hub-360/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

```text
Setup → Foundational → US1 (MVP) → US2 → US3 → US4 → US5 → Polish
```

- US1 phụ thuộc Foundational và tạo nguồn dữ liệu chuẩn.
- US2 phụ thuộc US1 để đọc hồ sơ thật.
- US3 phụ thuộc metrics/timeline của US1–US2.
- US4 phụ thuộc customer summary/risk từ US2–US3.
- US5 có thể bắt đầu phần permission sau Foundational, nhưng chỉ mở export sau US2.

### Parallel Opportunities

- T002–T003 có thể chạy song song sau T001.
- T010–T011 có thể chạy song song khi migration draft ổn định.
- Các test `[P]` trong từng story có thể viết song song và phải đỏ trước implementation.
- Sau Foundational, phần permission nền của US5 có thể chuẩn bị song song với US1; UI export vẫn chờ US2.

## Parallel Example: US1

```text
Track A: T013 → T017 → T018
Track B: T014 → T019
Track C: T015 → T020
Merge: T021 → T022/T023 → T024
```

## Implementation Strategy

### MVP First

1. T001–T012: schema, RLS, idempotency.
2. T013–T024: auto-sync, backfill và CustomerHub dữ liệu thật.
3. Dừng và xác nhận SC-001/SC-003 trước khi triển khai CRM nâng cao.

### Incremental Delivery

1. **MVP**: dữ liệu thật + backfill không trùng.
2. **CRM 360**: hồ sơ, địa chỉ, timeline, notes/tags.
3. **Risk**: RFM và blacklist.
4. **Extension**: cảnh báo tại thời điểm lên đơn.
5. **Security/Activation**: masking, export và churn audience.

## Format Validation

- Tổng số task: **60**.
- Mọi task đều theo dạng `- [ ] Txxx [P?] [US?] mô tả + đường dẫn`.
- Task thuộc user story đều có nhãn `[US1]`–`[US5]`.
- Task Setup/Foundational/Polish không dùng nhãn user story.
