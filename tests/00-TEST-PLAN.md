# 📋 KẾ HOẠCH KIỂM THỬ HỆ THỐNG (TEST PLAN)

**Dự án:** Auto Fill Extension & Admin Dashboard
**Ngày tạo:** 28/07/2026
**Phiên bản:** v1.0
**Môi trường:** Supabase riêng (xlgovgynbsahuykyjzcx.supabase.co)

---

## 1. MỤC TIÊU KIỂM THỬ

- Đảm bảo **Admin Dashboard** hoạt động đúng toàn bộ chức năng
- Đảm bảo **hệ thống backend** (API, Services, Database) tích hợp chính xác với Supabase
- Xác minh **luồng End-to-End** từ UI đến Database
- Phát hiện lỗi trước khi release

## 2. PHẠM VI

### ✅ Trong phạm vi
- Admin Dashboard (`admin.html`, `master-admin.js`)
- Auth Service, Permission Service, Audit Service
- Shop Service, Member Service, Invite Service
- Realtime Service
- Supabase Client, Database RPC
- Luồng End-to-End (Login → Tạo shop → Config → Sử dụng)

### ❌ Ngoài phạm vi
- Browser Extension (Chrome/Firefox)
- VNPost/J&T page integration
- Mobile app (nếu có)

## 3. LOẠI KIỂM THỬ

| Loại | Mô tả | Công cụ |
|------|-------|---------|
| **Smoke Test** | Kiểm tra các chức năng cốt lõi có hoạt động không | Browser + Supabase |
| **Functional Test** | Kiểm tra chi tiết từng chức năng | Browser + Supabase Studio |
| **Integration Test** | Kiểm tra tích hợp giữa các service | Postman / Script |
| **Security Test** | RLS, Auth, Permission | Supabase Studio |
| **UI/UX Test** | Giao diện, trải nghiệm | Browser |

## 4. CẤU TRÚC TEST

```
tests/
├── 00-TEST-PLAN.md                  # File này
├── 01-CHECKLIST.md                  # Checklist tổng hợp
├── admin-dashboard/
│   ├── 01-auth.test.md              # Test xác thực
│   ├── 02-metrics.test.md           # Test metrics
│   ├── 03-shops.test.md             # Test quản lý shop
│   ├── 04-quotas.test.md            # Test hạn ngạch & quyền
│   ├── 05-configs.test.md           # Test cấu hình extension
│   └── 06-audit-logs.test.md        # Test audit logs
├── system/
│   ├── 01-supabase-connection.md    # Test kết nối DB
│   ├── 02-rpc-tests.md              # Test các RPC
│   ├── 03-rls-policies.md           # Test Row Level Security
│   └── 04-e2e-flows.md              # Test End-to-End
├── fixtures/
│   └── test-data.json               # Dữ liệu test
└── reports/
    └── TEST-RESULTS.md              # Báo cáo kết quả
```

## 5. TIÊU CHÍ ĐẦU VÀO (Prerequisites)

- [ ] Supabase project đã sẵn sàng
- [ ] Các migration SQL đã chạy: v3, v3_1, v4, v5, v6
- [ ] Master Admin account đã tồn tại trong `profiles`
- [ ] RLS policies đã được enable
- [ ] Browser (Chrome/Edge) đã cập nhật
- [ ] DevTools đã mở sẵn (Console + Network tab)

## 6. TIÊU CHÍ ĐẦU RA (Exit Criteria)

- 100% test cases đã được thực thi
- Tất cả lỗi **Critical** và **High** đã được sửa
- Test report đã được viết và lưu vào `tests/reports/`

## 7. RỦI RO

| # | Rủi ro | Mức độ | Giảm thiểu |
|---|--------|--------|------------|
| 1 | Test data ảnh hưởng production | Cao | Dùng prefix `test_` cho mọi record mới |
| 2 | RLS chặn truy vấn test | Trung bình | Test với role admin trước |
| 3 | Supabase rate limit | Thấp | Test tuần tự, không song song |
| 4 | Browser cache cũ | Trung bình | Hard refresh trước mỗi test (Ctrl+Shift+R) |

## 8. LỊCH TRÌNH

| Giai đoạn | Nội dung | Thời gian |
|-----------|----------|-----------|
| Setup | Chuẩn bị môi trường + test data | 15 phút |
| Admin Dashboard | Test 6 nhóm chức năng | 90 phút |
| System | Test DB + RPC + RLS + E2E | 60 phút |
| Report | Viết báo cáo tổng hợp | 30 phút |

## 9. CÔNG CỤ

- **Supabase Studio:** https://supabase.com/dashboard
- **Browser DevTools:** F12
- **Postman / REST Client:** Test API trực tiếp
- **VS Code + Antigravity:** Đọc & phân tích code

## 10. PHÂN CÔNG (nếu có team)

| Người | Phụ trách |
|-------|-----------|
| Tester 1 | Admin Dashboard (UI/UX + Functional) |
| Tester 2 | System (DB + RPC + RLS) |
| Tester 3 | E2E + Báo cáo |

## 11. ĐỊNH NGHĨA MỨC ĐỘ LỖI

| Mức độ | Mô tả | Ví dụ |
|--------|-------|-------|
| **Critical** | Hệ thống không hoạt động, mất dữ liệu | Login thất bại, mất toàn bộ shop |
| **High** | Chức năng chính bị lỗi | Tạo shop thất bại, không lưu quota |
| **Medium** | Chức năng phụ bị lỗi | Audit log hiển thị sai format |
