# Implementation Plan: Sổ Bạ Khách Hàng 360

**Branch**: `002-customer-hub-360` | **Date**: 2026-08-28 | **Spec**: [spec.md](spec.md)

## Summary

Xây Customer Hub có nguồn dữ liệu chuẩn trên Supabase thay cho việc tổng hợp tạm thời và lưu tags/notes trong localStorage. Dữ liệu khách được đồng bộ idempotent từ `orders` và `submitted_orders`, hiển thị hồ sơ 360 trong Options, sau đó cung cấp bản tra cứu nhẹ cho panel VNPost/J&T. Phân quyền, RLS và audit được triển khai trước khi mở export hoặc blacklist.

## Technical Context

**Language/Version**: JavaScript ES2022, React 19, PostgreSQL/Supabase SQL  
**Primary Dependencies**: Vite 5, `@supabase/supabase-js`, Chrome Extension APIs, lucide-react  
**Storage**: Supabase PostgreSQL là nguồn chuẩn; Chrome Storage chỉ làm cache/fallback không nhạy cảm  
**Testing**: Node test contracts, Vitest khi phù hợp, SQL/RLS security tests, kiểm thử Extension thủ công  
**Target Platform**: Chrome Extension Options + content panel trên VNPost/J&T  
**Project Type**: Browser extension với React Options và content scripts Shadow DOM  
**Performance Goals**: Tra cứu thông thường <1 giây p95; backfill 10.000 đơn theo batch, không khóa UI  
**Constraints**: Bảo toàn paste → parse → review → fill; tenant isolation; không tự ghi đè địa chỉ lịch sử; không hard-code secret  
**Scale/Scope**: Tối thiểu 10.000 đơn/shop, nhiều thiết bị và nhiều nhân viên trong cùng shop

## Constitution Check

### Trước thiết kế

- **Preserve Core Workflow**: PASS — CRM lookup là bổ sung, cloud lỗi không chặn parser/autofill.
- **Lightweight & Encapsulated UI**: PASS — panel chỉ nhận customer summary; hồ sơ đầy đủ ở Options.
- **DOM Compatibility**: PASS — không thay selector hoặc automation carrier trong MVP.
- **Security & Privacy**: PASS — Supabase HTTPS, RLS theo `active_shop_id`, RBAC và audit.
- **Localization**: PASS — giao diện và thông báo tiếng Việt.

### Sau thiết kế

PASS. Không có vi phạm cần ghi trong Complexity Tracking. Trigger chỉ duy trì liên kết/idempotency; thống kê có thể rebuild từ nguồn đơn để tránh drift.

## Architecture Decisions

1. **Customer identity**: `(shop_id, normalized_phone)`; không hợp nhất xuyên shop.
2. **Idempotency**: bảng `customer_order_links` có unique `(shop_id, source_type, source_order_id)`; không tăng counter trực tiếp thiếu khóa nguồn.
3. **Derived metrics**: cập nhật qua hàm rebuild một khách/batch; trigger enqueue hoặc gọi hàm đồng bộ với khóa đơn.
4. **Multi-address**: lưu raw + normalized riêng; lịch sử chỉ gợi ý, áp dụng bằng click.
5. **Cloud-first notes/tags/blacklist**: localStorage cũ chỉ được migration một lần, không còn là source of truth.
6. **Extension degradation**: lookup có timeout ngắn, cache theo shop/SĐT và không làm hỏng luồng nhập đơn.
7. **Imports**: V1 nhận CSV/XLSX upload thủ công; connector trực tiếp POS/sàn để giai đoạn sau.

## Delivery Phases

### Phase 1 — Data Activation (MVP)

- Migration bảng khách, địa chỉ, liên kết đơn, notes/tags, job và risk events.
- RLS/RBAC/audit contracts.
- Đồng bộ idempotent từ đơn mới và backfill lịch sử có progress/retry.
- CustomerHub đọc dữ liệu thật, có empty/loading/error states.

### Phase 2 — Customer 360

- Hồ sơ đa địa chỉ, timeline, KPI và favorite carrier.
- Notes/tags cloud và realtime refresh.
- RFM/risk rules, blacklist có lý do.

### Phase 3 — Extension Integration

- Customer summary lookup theo SĐT.
- VIP/risk badges và lịch sử đơn/địa chỉ gọn trong panel.
- Địa chỉ cũ chỉ là đối chiếu, không auto-overwrite.

### Phase 4 — Security & Activation

- Phone masking theo role, permission export/import/backfill.
- CSV audience, churn filters và audit đầy đủ.

## Project Structure

```text
database/migrations/
└── v64_customer_hub_360.sql

src/
├── application/customer/
│   ├── customer.repository.js
│   ├── customer.service.js
│   ├── customer-import.service.js
│   └── customer-risk.service.js
├── ui/options/pages/Customers/
│   └── CustomerHub.jsx
├── runtime/content/
│   └── index.js
└── application/storage.js

frontend/panel/
├── panel.js
└── styling/styles.js

tests/
├── unit/customer-hub-*.test.mjs
├── integration/customer-hub-*.test.mjs
└── security/customer-hub-rls.test.mjs

specs/002-customer-hub-360/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/customer-hub-contracts.md
└── tasks.md
```

**Structure Decision**: Giữ kiến trúc hiện tại, thêm deep module `src/application/customer/`; UI không gọi REST phân tán mà đi qua repository/service để tập trung tenant, masking và fallback.

## Migration & Rollout

1. Chạy migration schema/RLS/RPC trên staging.
2. Chạy dry-run backfill và đối chiếu sample theo SĐT.
3. Backfill thật theo shop/batch, lưu checkpoint.
4. Chuyển CustomerHub sang cloud read, vẫn giữ màn hình lỗi có retry.
5. Kích hoạt Extension summary bằng feature flag theo shop.
6. Sau thời gian quan sát mới migration tags/notes local và mở export.

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Double count từ `orders` và `submitted_orders` | Liên kết nguồn unique + test chạy backfill lặp |
| Counter drift khi trạng thái đơn đổi | Rebuild metrics từ links/source orders |
| Rò rỉ dữ liệu xuyên shop | RLS, explicit shop filter, security tests |
| Cache khách cũ làm cảnh báo sai | TTL + invalidation theo update timestamp |
| Địa chỉ lịch sử ghi đè địa chỉ mới | Explicit user confirmation + regression test |
| Backfill lớn gây timeout | Batch, checkpoint, retry và progress |

## Complexity Tracking

Không có vi phạm hiến chương cần biện minh.
