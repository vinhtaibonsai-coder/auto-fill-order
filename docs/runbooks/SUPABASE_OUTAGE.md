# Runbook: Xử lý Sự cố Hạ tầng Cơ sở Dữ liệu Supabase (Supabase Outage)

> **Mã quy trình**: RB-DB-01  
> **Mức độ sự cố**: P0 (Cơ sở dữ liệu Supabase hoặc dịch vụ Auth Gotrue ngừng phản hồi)  
> **Thành phần liên quan**: Supabase PostgreSQL, Gotrue Auth Service, PostgREST API, Extension Offline Local Queue, RPC `admin_repair_user_auth`, RPC `record_system_incident`, bảng `system_incidents`.

---

## 1. Triệu chứng & Dấu hiệu Nhận biết (Symptoms)
- Các cuộc gọi API đến Supabase trả về lỗi `HTTP 500 Internal Server Error`, `HTTP 502 Bad Gateway`, hoặc `HTTP 503 Service Unavailable`.
- Extension hiển thị cảnh báo mất kết nối đám mây (Cloud Sync Disconnected) hoặc báo lỗi xác thực phiên đăng nhập Gotrue.
- Người dùng đăng nhập nhận được thông báo lỗi hệ thống hoặc không tải được cấu hình tài khoản.

---

## 2. Các bước Khoanh vùng & Chế độ Ngoại tuyến (Immediate Containment)

### Bước 1: Kích hoạt Tự động Chế độ Bộ đệm Ngoại tuyến (Offline Local Storage Queue)
Kiến trúc Extension đã được thiết kế sẵn sàng cho sự cố mạng và gián đoạn đám mây:
- Toàn bộ thao tác bóc tách đơn hàng và điền đơn tự động tiếp tục hoạt động bình thường nhờ engine bóc tách nội bộ (`AddressEngine`).
- Các đơn hàng đã điền thành công sẽ được tạm lưu vào **Offline Local Queue** trong `chrome.storage.local`.
- Khi máy chủ Supabase khôi phục kết nối, tiến trình nền tự động đồng bộ hai chiều (Bidirectional Draft Order Cloud Sync) sẽ đẩy các đơn từ hàng đợi cục bộ lên đám mây mà không làm mất bất kỳ đơn hàng nào.

### Bước 2: Kiểm tra Trạng thái Cụm Máy chủ Supabase
Kiểm tra trang trạng thái chính thức: `https://status.supabase.com/` và log của hệ thống:
```bash
# Kiểm tra tình trạng kết nối từ terminal
node -e "
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
sb.from('shops').select('count', { count: 'exact', head: true })
  .then(r => console.log('Supabase DB Status:', r.error ? r.error.message : 'HEALTHY'))
  .catch(e => console.error('Connection Failed:', e.message));
"
```

---

## 3. Quy trình Xử lý & Phục hồi Sự cố (Remediation Procedure)

### Kịch bản A: Lỗi HTTP 500 Gotrue Auth Token Corruption
Khi máy chủ Supabase Auth bị lỗi tạo identity hoặc token không khớp:
Sử dụng RPC tự phục hồi đã được bảo mật (`v124_secure_admin_repair_user_auth`):
```sql
SELECT public.admin_repair_user_auth(
    'user@vinhtaibonsai.com', -- p_email
    'CurrentPassword123'      -- p_password (chứng minh quyền sở hữu hoặc do Quản trị viên chỉ định)
);
```
*Tác vụ hàm thực hiện*:
- Đồng bộ lại `auth.users`, tạo lại bản ghi `auth.identities` email hợp lệ.
- Xóa bỏ các token xác thực bị hỏng.
- Kích hoạt lại trạng thái người dùng trong `public.profiles`.
- Tự động ghi nhật ký kiểm toán vào `public.audit_logs`.

### Kịch bản B: Khởi động lại hoặc Chuyển vùng Dự phòng (Failover)
Nếu dự án Supabase bị treo hoặc đạt trần kết nối Connection Pool:
1. Đăng nhập Supabase Dashboard -> Project Settings -> Database.
2. Kiểm tra biểu đồ CPU, RAM và Disk I/O.
3. Nếu Connection Pool bị đầy, thực hiện khởi động lại Supabase PostgREST:
   ```sql
   NOTIFY pgrst, 'reload config';
   NOTIFY pgrst, 'reload schema';
   ```
4. Nếu cụm chính bị lỗi phần cứng, chuyển sang kết nối URL máy chủ dự phòng (Read Replica hoặc Backup Project).

### Bước 3: Ghi nhận sự cố hệ thống vào System Incidents
Ghi vết sự cố vào bảng `system_incidents` bằng RPC chuẩn hóa:
```sql
SELECT public.record_system_incident(
    'database_outage',
    'CRITICAL',
    'Supabase Database gặp sự cố gián đoạn kết nối trong 12 phút. Extension đã chạy qua chế độ Offline Local Queue.',
    jsonb_build_object(
        'error_type', 'connection_timeout',
        'offline_queue_buffered', true,
        'recovered_at', now()
    )
);
```

---

## 4. Tiêu chí Xác minh Phục hồi (Verification Criteria)
- [ ] Lệnh kiểm tra kết nối Supabase phản hồi với mã trạng thái `200 OK` và trả về kết quả truy vấn trong < 200ms.
- [ ] Toàn bộ đơn hàng đệm trong hàng đợi ngoại tuyến (`Offline Local Queue`) của các client được đồng bộ đẩy lên bảng `submitted_orders` thành công với 0 mất mát dữ liệu.
- [ ] Bảng `system_incidents` ghi nhận sự cố với thời gian bắt đầu và thời gian giải quyết rõ ràng.
- [ ] Người dùng đăng nhập lại bình thường mà không nhận lỗi HTTP 500.
