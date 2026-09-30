# Quickstart Validation: Customer Hub 360

## Prerequisites

- Supabase staging có schema hiện tại và hai shop kiểm thử.
- Tài khoản Owner, Manager và Staff.
- Bộ dữ liệu gồm đơn lưu, đơn đã gửi, duplicate, hoàn và nhiều địa chỉ.

## Automated Validation

```bash
npm test
npm run build
npm run sync:ext
```

Chạy thêm security/integration tests của Customer Hub sau khi các task tương ứng hoàn thành.

## MVP Scenario

1. Chạy migration Customer Hub trên staging.
2. Mở Options → Sổ bạ với shop có đơn lịch sử.
3. Chọn **Quét đơn lịch sử** và theo dõi tiến độ.
4. Chạy lại cùng job; xác nhận customer count và order count không đổi.
5. Tìm bằng tên/SĐT; kiểm tra timeline, mã đơn, COD và địa chỉ.
6. Đổi active shop; xác nhận không nhìn thấy dữ liệu shop trước.

## Extension Scenario

1. Reload unpacked Extension.
2. Mở VNPost và J&T, dán đơn của khách VIP/risk.
3. Xác nhận customer summary xuất hiện nhưng parser/autofill vẫn hoạt động nếu tắt mạng.
4. Chọn một địa chỉ lịch sử và xác nhận chỉ lúc đó địa chỉ chính mới thay đổi.

## Backfill, import and rollback operations

1. Apply `database/migrations/v64_customer_hub_360.sql` on staging before enabling the Options entry for users.
2. Run **Quét đơn lịch sử** as Owner/Manager. A job stores its cursor, processed/success/error counters and the last 100 row errors in `customer_sync_jobs`.
3. Re-running the same source is safe: `(shop_id, source_type, source_order_id)` and the canonical order key prevent double counting.
4. Import accepts CSV UTF-8, validates the phone column and returns row-level errors. Native XLSX remains disabled until its parser dependency is approved; save Excel files as CSV UTF-8.
5. To stop a rollout, hide the Customer Hub navigation entry first. The CRM trigger swallows failures and cannot block normal order persistence. Roll back the schema only after exporting required customer data and disabling both Customer Hub triggers.

## Performance record

- Date/environment: 2026-08-28, local Node process, production source modules.
- Dataset: 10,000 customer records passed through `mapCustomerDashboard`.
- Result: **101.43 ms**, approximately **98,594 records/second**.
- This measures client-side mapping only. Before production rollout, validate RPC latency and backfill throughput against staging Supabase with realistic network conditions.

## Manual release matrix

| Carrier | Network | Role | Parse/autofill | Summary | Masking/RBAC | Address requires click |
| --- | --- | --- | --- | --- | --- | --- |
| VNPost | Online | Owner | Pending | Pending | Pending | Pending |
| VNPost | Offline | Staff | Pending | Pending | Pending | Pending |
| J&T | Online | Manager | Pending | Pending | Pending | Pending |
| J&T | Offline | Staff | Pending | Pending | Pending | Pending |

## Security Scenario

1. Staff thấy SĐT masked và không thấy Export.
2. Manager thay blacklist có reason; Staff bị từ chối.
3. Owner export; kiểm tra audit log.
4. Thử truy vấn customer của shop khác; kết quả phải rỗng/bị từ chối.
