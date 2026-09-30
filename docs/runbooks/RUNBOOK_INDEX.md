# Sổ tay Vận hành & Xử lý Sự cố Hệ thống (Operations Runbook Index)

> **Dự án**: Nền tảng Tự động Điền Đơn Hàng & Đồng bộ Vận chuyển Đa Nhà Xe (Auto-Fill Order Platform)  
> **Phiên bản chuẩn**: Production 1.0.2  
> **Cam kết SLA**: Tính sẵn sàng 99.9%, RTO <= 4 giờ, RPO <= 24 giờ  
> **Mục tiêu**: Cung cấp hướng dẫn trực quan, có câu lệnh thực thi rõ ràng, có tiêu chí xác minh cụ thể cho đội ngũ trực ca (On-call Engineers) và Master Admin khi xảy ra sự cố.

---

## 1. Phân loại Mức độ Nghiêm trọng (Incident Severity Matrix)

| Mức độ | Định nghĩa | Tiêu chuẩn Thời gian Phản hồi (SLA) | Kênh thông báo |
| :--- | :--- | :--- | :--- |
| **P0 (Critical)** | Toàn bộ hệ thống ngưng hoạt động; người dùng không thể tạo/điền đơn; lỗi thanh toán hàng loạt; rò rỉ dữ liệu hoặc vi phạm RLS. | Phản hồi <= 15 phút, Khắc phục <= 2 giờ | Telegram Hot Alert, Hotline Master Admin |
| **P1 (High)** | Một nhà vận chuyển lớn bị hỏng selector DOM; nhà cung cấp AI chính lỗi 100% nhưng fallback chạy chậm; lỗi phân trang/báo cáo doanh thu. | Phản hồi <= 30 phút, Khắc phục <= 4 giờ | Telegram Operations Channel |
| **P2 (Medium)** | Lỗi giao diện nhỏ trên mobile; lỗi chậm đồng bộ draft; một số đơn hàng bị cảnh báo địa chỉ độ tin cậy thấp. | Phản hồi <= 2 giờ, Khắc phục <= 12 giờ | Issue Tracker / Daily Standup |
| **P3 (Low)** | Yêu cầu cải thiện UX, câu từ tiếng Việt, màu sắc badge hoặc câu hỏi hỗ trợ người dùng. | Xử lý theo chu kỳ Sprint tiếp theo | Github Backlog |

---

## 2. Danh mục Runbook Thành phần

1. [Sự cố Cổng thanh toán & Webhook (Payment Gateway Outage)](./PAYMENT_GATEWAY_OUTAGE.md)
   - Xử lý gián đoạn VietQR/SePay, webhook không gửi được, giao dịch chưa đối soát, cộng quota thủ công và chống trùng lặp (Idempotency).
2. [Sự cố Nhà cung cấp Trí tuệ Nhân tạo (AI Provider Outage)](./AI_PROVIDER_OUTAGE.md)
   - Xử lý khi Groq, Gemini hoặc OpenAI chạm hạn mức (429), lỗi mạng (503), chuyển đổi trạng thái Circuit Breaker, kích hoạt chuỗi dự phòng (Fallback Chain) và chế độ Local-First.
3. [Sự cố Thay đổi DOM Nhà xe (Carrier DOM Change)](./CARRIER_DOM_CHANGE.md)
   - Phát hiện form VNPost / J&T thay đổi selector, phát hành bản vá khẩn cấp qua Remote Selectors OTA, kiểm tra tính toàn vẹn SHA-256 và quy trình hoàn tác (Rollback).
4. [Sự cố Hạ tầng Supabase / Database (Supabase Outage)](./SUPABASE_OUTAGE.md)
   - Ứng phó khi Database hoặc Auth Gotrue gặp sự cố; chuyển Extension sang chế độ bộ đệm ngoại tuyến (Offline Local Queue); công cụ tự phục hồi token Gotrue và ghi nhận sự cố hệ thống.
5. [Quy trình Hoàn tác Toàn diện (Rollback Procedures)](./ROLLBACK_PROCEDURES.md)
   - Hướng dẫn rollback 3 lớp: Chrome Extension, Remote Selectors, và Database Migrations.
6. [Sao lưu & Phục hồi Dữ liệu Thảm họa (Backup & Restore)](./BACKUP_AND_RESTORE.md)
   - Quy trình tự động tạo snapshot, tính toán kiểm tra mã băm SHA-256, diễn tập khôi phục thảm họa (Disaster Recovery Drill) định kỳ trên môi trường Staging/Non-prod.
7. [Bằng chứng Đối soát Ví P0-7 & Chạy Pilot (Reconciliation Evidence)](./P0-7-RECONCILIATION-EVIDENCE.md)
   - Bộ SQL copy-paste trên SQL Editor để thu bằng chứng 7 ngày đối soát 0đ (cron, backfill 30 ngày, alert), kèm checklist KPI pilot 5–10 shop.

---

## 3. Liên hệ Khẩn cấp & Phân quyền

- **Master Admin On-Call**: `admin@vinhtaibonsai.com`
- **Kỹ thuật Hạ tầng / Edge Functions**: `devops@vinhtaibonsai.com`
- **Telegram Bot Giám sát**: `@VinhTaiAutoFillOpsBot` (nhận cảnh báo tức thời từ `v115_system_incidents_and_alert_rules`)
