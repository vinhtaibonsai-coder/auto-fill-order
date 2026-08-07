# ✅ CHECKLIST KIỂM THỬ TỔNG HỢP

> Đánh dấu ✅ khi pass, ❌ khi fail, ⚠️ khi có vấn đề cần theo dõi.
> Ghi chú chi tiết trong từng file `.test.md` tương ứng.

---

## A. SETUP MÔI TRƯỜNG

- [ ] A1. Đã cài đặt Chrome/Edge bản mới nhất
- [ ] A2. Đã mở Supabase Studio và đăng nhập
- [ ] A3. Tất cả migration đã chạy (v3, v3_1, v4, v5, v6)
- [ ] A4. Đã clear cache browser (Ctrl+Shift+R)
- [ ] A5. DevTools đã mở (F12) — tab Console + Network
- [ ] A6. Đã tạo file test data trong `fixtures/test-data.json`

---

## B. ADMIN DASHBOARD — AUTH

> File: `admin-dashboard/01-auth.test.md`

- [ ] B1. Login với email/password đúng → vào `admin.html`
- [ ] B2. Login với email sai → hiện lỗi đỏ
- [ ] B3. Login với password sai → hiện lỗi đỏ
- [ ] B4. Login với email trống → validation chặn
- [ ] B5. Login với password < 6 ký tự → chặn
- [ ] B6. Session lưu trong localStorage → reload không bị logout
- [ ] B7. Logout → xóa session, chuyển về `login.html`

---

## C. ADMIN DASHBOARD — METRICS

> File: `admin-dashboard/02-metrics.test.md`

- [ ] C1. Tổng số Shop hiển thị đúng (đếm từ DB)
- [ ] C2. Tổng số User hiển thị đúng
- [ ] C3. Tổng số Orders hiển thị đúng
- [ ] C4. Số shop active hiển thị đúng
- [ ] C5. Loading spinner hiển thị khi đang tải
- [ ] C6. Xử lý lỗi khi mất kết nối Supabase

---

## D. ADMIN DASHBOARD — SHOPS

> File: `admin-dashboard/03-shops.test.md`

- [ ] D1. Load danh sách shop từ Supabase
- [ ] D2. Hiển thị owner name & email
- [ ] D3. Hiển thị ngày tạo (định dạng vi-VN)
- [ ] D4. Status badge màu đúng (active=green, locked=red)
- [ ] D5. Mở modal "Tạo Shop"
- [ ] D6. Tạo shop mới với dữ liệu hợp lệ
- [ ] D7. Validation khi tên shop trống
- [ ] D8. Validation khi email owner trống/sai
- [ ] D9. Validation khi password owner < 6 ký tự
- [ ] D10. Sau tạo → reload danh sách thấy shop mới
- [ ] D11. Reset password chủ shop thành công
- [ ] D12. Khóa shop → status chuyển `locked`
- [ ] D13. Mở khóa shop → status chuyển `active`
- [ ] D14. Xóa shop (có confirm dialog)
- [ ] D15. Xử lý lỗi khi tạo shop thất bại

---

## E. ADMIN DASHBOARD — QUOTAS & FLAGS

> File: `admin-dashboard/04-quotas.test.md`

- [ ] E1. Dropdown hiển thị tất cả shops
- [ ] E2. Chọn shop → hiện form quota
- [ ] E3. Load quota hiện tại của shop
- [ ] E4. Load feature flags hiện tại
- [ ] E5. Lưu daily_quota mới
- [ ] E6. Lưu max_devices mới
- [ ] E7. Toggle flag AI Parsing
- [ ] E8. Toggle flag VNPost
- [ ] E9. Toggle flag J&T
- [ ] E10. Sau lưu → reload lại thấy giá trị đúng
- [ ] E11. Validation khi nhập số âm / 0

---

## F. ADMIN DASHBOARD — EXTENSION CONFIGS

> File: `admin-dashboard/05-configs.test.md`

- [ ] F1. Load Groq API Keys từ DB
- [ ] F2. Load Default AI Prompt
- [ ] F3. Load Global Blacklist Phones
- [ ] F4. Lưu Groq Keys hợp lệ (JSON array)
- [ ] F5. Lưu Groq Keys sai JSON → báo lỗi
- [ ] F6. Lưu AI Prompt (text)
- [ ] F7. Lưu Blacklist Phones hợp lệ
- [ ] F8. Lưu Blacklist Phones sai JSON → báo lỗi
- [ ] F9. Sau lưu → reload thấy giá trị đúng

---

## G. ADMIN DASHBOARD — AUDIT LOGS

> File: `admin-dashboard/06-audit-logs.test.md`

- [ ] G1. Load danh sách audit logs
- [ ] G2. Hiển thị thời gian (vi-VN format)
- [ ] G3. Hiển thị action name
- [ ] G4. Hiển thị user_id
- [ ] G5. Hiển thị payload (JSON)
- [ ] G6. Sắp xếp theo thời gian giảm dần
- [ ] G7. Giới hạn 20 records mới nhất
- [ ] G8. Hiển thị empty state khi chưa có log

---

## H. SYSTEM — SUPABASE CONNECTION

> File: `system/01-supabase-connection.md`

- [ ] H1. Supabase URL trong config đúng
- [ ] H2. Anon key hợp lệ
- [ ] H3. Kết nối từ browser thành công
- [ ] H4. Ping REST API endpoint
- [ ] H5. Kiểm tra realtime websocket

---

## I. SYSTEM — RPC TESTS

> File: `system/02-rpc-tests.md`

- [ ] I1. RPC `admin_create_shop_with_account`
- [ ] I2. RPC `admin_delete_shop`
- [ ] I3. RPC `admin_reset_user_password`
- [ ] I4. RPC `get_shop_stats` (nếu có)
- [ ] I5. RPC `accept_invite` (nếu có)

---

## J. SYSTEM — RLS POLICIES

> File: `system/03-rls-policies.md`

- [ ] J1. Anon không đọc được `shops`
- [ ] J2. User chỉ đọc shop của mình
- [ ] J3. Master Admin đọc được tất cả
- [ ] J4. Audit logs không bị user xóa
- [ ] J5. System configs chỉ master admin sửa được

---

## K. SYSTEM — END-TO-END FLOWS

> File: `system/04-e2e-flows.md`

- [ ] K1. **E2E 1:** Login master admin → Tạo shop → Cấp quota → Extension đọc được config
- [ ] K2. **E2E 2:** Login shop owner → Reset pass → Login lại thành công
- [ ] K3. **E2E 3:** Tạo shop → Khóa → Extension bị chặn
- [ ] K4. **E2E 4:** Tạo shop → Tạo invite → User nhận → Join shop
- [ ] K5. **E2E 5:** Audit log ghi nhận mọi thao tác critical

---

## L. BÁO CÁO

- [ ] L1. Viết `tests/reports/TEST-RESULTS.md`
- [ ] L2. Tổng hợp lỗi theo mức độ (Critical/High/Medium/Low)
- [ ] L3. Đề xuất fix cho từng lỗi
- [ ] L4. Đánh giá tổng quan chất lượng hệ thống

---

> **Trạng thái:** ⏳ Đang thực thi