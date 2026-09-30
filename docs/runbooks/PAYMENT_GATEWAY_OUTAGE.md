# Runbook: Xử lý Sự cố Cổng Thanh toán & Webhook (Payment Gateway Outage)

> **Mã quy trình**: RB-PAY-01  
> **Mức độ sự cố**: P0 (Nếu toàn bộ thanh toán ngưng trệ) hoặc P1 (Nếu lỗi một phần giao dịch)  
> **Thành phần liên quan**: Ngân hàng/VietQR, Supabase Edge Function `payment-webhook`, bảng `payment_transactions`, RPC `admin_reconcile_payment_transaction`.

---

## 1. Triệu chứng & Dấu hiệu Nhận biết (Symptoms)
- Khách hàng đã chuyển khoản thành công nhưng hạn mức (Quota / AI Credit) không được kích hoạt sau 60 giây.
- Dashboard Quản trị (`admin-dashboard/` mục Subscriptions) xuất hiện cảnh báo giao dịch có trạng thái `reconciliation_status = 'unmatched'` hoặc `'failed'`.
- Nhật ký Edge Function `payment-webhook` báo lỗi `401 Unauthorized` (Sai chữ ký HMAC), `400 Replay Detected` (Trùng lặp Nonce), hoặc `400 Timestamp Drift` (Lệch thời gian > 300s).

---

## 2. Các bước Khoanh vùng Khẩn cấp (Immediate Containment)

1. **Kiểm tra trạng thái Edge Function và Webhook Secrets**:
   ```bash
   # Kiểm tra log webhook trong 15 phút gần nhất
   npx supabase functions logs payment-webhook --limit 50
   ```
2. **Kiểm tra xem Cổng thanh toán có bị sập diện rộng hay không**:
   - Truy cập trang trạng thái của cổng ngân hàng (VietQR / Casso / SePay / VNPay).
   - Nếu cổng ngân hàng bị nghẽn, kích hoạt kênh thông báo tạm thời trên trang `subscriptions.html` báo bảo trì cổng nạp.

---

## 3. Quy trình Xử lý & Đối soát Thủ công (Remediation Procedure)

Khi webhook bị gián đoạn hoặc gửi thiếu thông tin nhận diện (ví dụ người dùng chuyển khoản ghi thiếu cú pháp mã Shop/Mã đơn):

### Bước 1: Tra cứu hàng đợi giao dịch chưa khớp
Truy vấn danh sách các giao dịch thanh toán đang bị nghẽn:
```sql
SELECT id, transaction_code, amount, shop_id, reconciliation_status, reconciliation_notes, created_at
FROM public.payment_transactions
WHERE reconciliation_status IN ('unmatched', 'failed', 'duplicate')
ORDER BY created_at DESC
LIMIT 20;
```

### Bước 2: Thực thi RPC Đối soát & Cộng Quota an toàn
Sử dụng RPC chuyên dụng có bảo vệ Idempotency và ghi vết kiểm toán:
```sql
SELECT public.admin_reconcile_payment_transaction(
    '00000000-0000-0000-0000-000000000000'::UUID, -- p_transaction_id
    '11111111-1111-1111-1111-111111111111'::UUID, -- p_target_shop_id
    'approved',                                    -- p_action ('approved' hoặc 'rejected')
    'Đối soát thủ công xác nhận tiền đã vào tài khoản ngân hàng techcombank 102xxx' -- p_notes
);
```

*Cơ chế Idempotency & Bảo vệ kép*:
- Hàm `admin_reconcile_payment_transaction` tự động kiểm tra xem giao dịch đã từng được ghi nhận thành công hay chưa.
- Tuyệt đối không cho phép cộng trùng lặp quota ngay cả khi kỹ thuật viên bấm nút đối soát nhiều lần.
- Tự động ghi nhận bản ghi kiểm toán vào `public.audit_logs` với loại hành động `ADMIN_RECONCILE_PAYMENT`.

### Bước 3: Kiểm tra Xác thực Chữ ký HMAC & Nonce Replay
Nếu phát hiện webhook bị tấn công replay hoặc bị nhà cung cấp gọi lại liên tục:
- Edge Function tự động so sánh chữ ký bằng thuật toán an toàn thời gian cố định `crypto.subtle.timingSafeEqual` để loại trừ tấn công timing attack.
- Chặn mọi request có timestamp lệch quá 300 giây.
- Khóa nonce đã sử dụng trong bộ đệm nhằm bảo vệ tuyệt đối số dư ví của cửa hàng.

---

## 4. Tiêu chí Nghiệm thu & Khôi phục (Verification Criteria)
- [ ] Giao dịch chuyển từ `reconciliation_status = 'unmatched'` sang `'reconciled'`.
- [ ] Số dư Quota hoặc Tiền trong Ví trả trước (`prepaid_wallets`) của Shop mục tiêu được cập nhật chính xác với số tiền tương ứng.
- [ ] Bảng `audit_logs` ghi nhận đầy đủ `actor_id` (kỹ thuật viên xử lý), `target_id` (mã giao dịch) và thời điểm đối soát.
- [ ] Khách hàng nhận được thông báo nạp thành công trên màn hình Extension và Dashboard.
