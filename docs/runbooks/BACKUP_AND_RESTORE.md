# Sổ tay Sao lưu & Phục hồi Thảm họa (Backup & Disaster Recovery Runbook)

> **Mã quy trình**: RB-DR-01  
> **Mục tiêu Cam kết Vận hành**:
> - **RTO (Recovery Time Objective)**: <= 4 giờ (Thời gian tối đa để toàn bộ hệ thống phục hồi hoạt động sau thảm họa).
> - **RPO (Recovery Point Objective)**: <= 24 giờ (Giới hạn mất mát dữ liệu tối đa chấp nhận được - không quá 24h).
> - **Tiêu chuẩn Tuân thủ**: Nghị định 13/2023/NĐ-CP (Bảo vệ dữ liệu cá nhân) & Google Chrome Web Store Policy.

---

## 1. Chiến lược & Lịch trình Sao lưu (Backup Strategy)

Hệ thống triển khai mô hình sao lưu 3 lớp:

1. **Sao lưu Tự động Toàn phần Cơ sở Dữ liệu (Daily Supabase Physical Backup)**:
   - Thực hiện tự động mỗi 24 giờ vào lúc 02:00 AM UTC.
   - Lưu trữ tại cụm lưu trữ đám mây độc lập có bật mã hóa dữ liệu khi nghỉ (Encryption at Rest - AES-256).
   - Thời gian lưu trữ snapshot: 30 ngày cho các bản sao lưu hàng ngày.

2. **Sao lưu Dữ liệu Nghiệp vụ Từng Shop (Point-in-Time Business Backup)**:
   - Tiện ích `scripts/disaster-recovery-purge.js` và `scripts/backup-restore-drill.js` cho phép tạo bản sao lưu dữ liệu đơn hàng (`orders`, `submitted_orders`), cấu hình shop (`shops`, `quotas`), và nhật ký ví tiền (`wallet_ledger`).
   - Mỗi file sao lưu được ký bằng mã băm kiểm tra toàn vẹn **SHA-256**. Mọi thay đổi dù chỉ 1 bit đều sẽ bị phát hiện khi phục hồi.

3. **Sao lưu Ngoại tuyến Cục bộ tại Extension (Client Local Backup)**:
   - Trình duyệt tự động lưu trữ 100 đơn gần nhất trong `chrome.storage.local` dưới dạng mã hóa xor/b64, đảm bảo người dùng vẫn truy cập được lịch sử đơn hàng ngay cả khi mất kết nối mạng.

---

## 2. Quy trình Thực thi Diễn tập Sao lưu & Phục hồi (Drill Procedure)

Trước khi phát hành lên môi trường thực tế hoặc định kỳ hàng quý, đội ngũ kỹ thuật bắt buộc phải chạy diễn tập khôi phục thảm họa (Disaster Recovery Drill) trên môi trường Staging/Non-prod.

### Bước 1: Thực thi Lệnh Diễn tập Tự động
```bash
# Chạy diễn tập mô phỏng sao lưu, xác thực tính toàn vẹn và phục hồi
node scripts/backup-restore-drill.js --dry-run
```

Lệnh này sẽ tự động:
1. Tạo một snapshot dữ liệu shop mẫu hoàn chỉnh gồm đơn hàng, cấu hình và số dư ví.
2. Tính toán mã băm SHA-256 của file snapshot.
3. Xác minh tính toàn vẹn của file sao lưu bằng thuật toán so khớp mã băm (Checksum Integrity Verification).
4. Phục hồi dữ liệu vào một cấu trúc bảng tạm hoặc đối tượng thử nghiệm.
5. Kiểm tra tính đồng nhất (Zero Record Loss): Đảm bảo số lượng bản ghi sau phục hồi trùng khớp 100% với bản ghi ban đầu.
6. Thử nghiệm kịch bản rollback mô phỏng.

### Bước 2: Báo cáo Kết quả Diễn tập
Khi lệnh chạy thành công, đầu ra sẽ hiển thị:
```text
✅ BACKUP_VERIFIED_SUCCESS: Snapshot created with valid SHA-256 checksum
✅ RESTORE_DRILL_SUCCESS: 100% records recovered with 0 record variance
✅ ROLLBACK_SIMULATION_SUCCESS: Configuration successfully reverted to previous state
```

---

## 3. Quy trình Phục hồi Thực tế khi Xảy ra Thảm họa (Actual Disaster Recovery)

Khi máy chủ chính gặp sự cố phần cứng hoặc thảm họa trung tâm dữ liệu:

### Bước 1: Kích hoạt Máy chủ Staging / Dự phòng
1. Khởi tạo một dự án Supabase mới hoặc máy chủ PostgreSQL dự phòng.
2. Nạp toàn bộ cấu trúc cơ sở dữ liệu mới nhất:
   ```bash
   psql -h <BACKUP_HOST> -U postgres -d postgres -f database/migrations/RUN_ALL_MIGRATIONS.sql
   ```

### Bước 2: Nạp Dữ liệu từ Bản Sao lưu Gần Nhất
```bash
# Phục hồi dữ liệu từ file backup JSON đã được kiểm tra SHA-256
node -e "
const fs = require('fs');
const { verifyBackupIntegrity } = require('./scripts/disaster-recovery-purge.js');
const isValid = verifyBackupIntegrity('backups/backup-latest.json');
if (!isValid) throw new Error('File sao lưu đã bị thay đổi hoặc hư hại!');
console.log('File sao lưu hợp lệ. Đang tiến hành nạp dữ liệu vào Database...');
"
```

### Bước 3: Chuyển hướng Cấu hình Client (DNS & Environment)
Cập nhật biến môi trường `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY` trỏ sang máy chủ mới và kích hoạt Extension đồng bộ.

---

## 4. Tiêu chí Xác minh Khôi phục (Verification Criteria)
- [ ] Thời gian phục hồi từ lúc kích hoạt đến khi hoạt động lại nằm trong phạm vi cam kết: `RTO <= 4 giờ`.
- [ ] Dữ liệu không bị mất quá chu kỳ sao lưu: `RPO <= 24 giờ`.
- [ ] Tính toàn vẹn mã băm `SHA-256` của bản sao lưu được xác thực 100% thành công trước khi nạp.
- [ ] Số lượng đơn hàng và số dư ví trước và sau phục hồi hoàn toàn đồng nhất (Zero discrepancy).
