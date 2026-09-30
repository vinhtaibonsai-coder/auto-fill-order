# Kế hoạch V2 — Quản lý máy nhân viên an toàn, đối soát được và không lỗi 400/404

Ngày lập: 2026-08-29  
Phạm vi: Options → Team/Thiết bị, Extension runtime, Supabase RPC/schema, audit và dữ liệu đơn hàng.

## Implementation status (2026-08-29)

- [x] V2 migration with audited revoke, atomic member removal, device sessions, and corrected RPC contracts added (`database/migrations/v80_device_management_v2.sql`).
- [x] Team and Security UI switched from DELETE to revoke/remove RPCs; order attribution no longer falls back to display names.
- [x] Runtime checks are shop-scoped and use bounded offline grace instead of indefinite fail-open behavior.
- [x] Contract, repeat-order, full test suite, build, and extension sync verified locally.
- [ ] Apply v80 in the target Supabase project and run the verification SQL in `docs/incidents/2026-08-29-device-management-rpc-contract.md`.

## 1. Kết luận điều tra lỗi hiện tại

| Dấu hiệu | Nguyên nhân kỹ thuật | Rủi ro |
|---|---|---|
| `owner_get_members_v3` trả HTTP 400 | Bản `v77` tham chiếu `submitted_orders.user_id`, nhưng schema baseline dùng `submitted_by`. Đây là lỗi SQL trong RPC khi đếm đơn của thành viên. | Trang Team không tải được danh sách thành viên; fallback gây thêm request lỗi. |
| `owner_get_members_v2` trả HTTP 404 | RPC fallback không tồn tại trên project Supabase đang chạy. | Chuỗi fallback không có hợp đồng, làm lỗi bị che khuất. |
| `owner_delete_staff_device` trả HTTP 404 | RPC xoá thiết bị trong migration `v77` chưa được deploy (hoặc migration bị dừng trước phần RPC). | Nút xoá không thực hiện được; fallback DELETE trực tiếp phụ thuộc RLS/schema. |
| `profiles` trả HTTP 500 | Fallback client đọc trực tiếp bảng Profile; schema/RLS thực tế không đồng nhất với giả định của UI. | Console nhiễu, lộ chi tiết hạ tầng, dữ liệu thành viên thiếu. |
| `shop_invites` trả HTTP 404 | Bảng/RPC invite của migration thương mại chưa có trên project hiện tại. | UI gọi tính năng chưa có capability. |

### Việc sửa ngay trước khi làm V2

1. Chạy preflight read-only trên Supabase: xác nhận migration đã áp dụng, chữ ký RPC, cột thực tế của `submitted_orders`, `shop_members`, `extension_devices`, `profiles` và `shop_invites`.
2. Tạo migration sửa riêng, không chạy lại toàn bộ lịch sử mù:
   - sửa `owner_get_members_v3` dùng `submitted_by` (hoặc cột tồn tại sau introspection), `LEFT JOIN profiles`;
   - tạo RPC thu hồi/xoá thiết bị và cấp quyền đúng role;
   - nếu chưa có `shop_invites`, UI phải tắt capability thay vì gọi endpoint lặp lại.
3. Sau deploy, gọi từng RPC bằng payload mẫu và ghi lại HTTP status + body đã loại bỏ token.
4. Không dùng fallback DELETE trực tiếp trong UI sau khi API ổn định; nếu bắt buộc fallback khẩn cấp phải giới hạn `shop_id + device_id`, kiểm tra số dòng bị ảnh hưởng và ghi audit.

## 2. Mô hình nghiệp vụ chuẩn

```text
Shop
 ├─ Member (tài khoản + vai trò)
 │   └─ Device × N (máy/trình duyệt)
 │       └─ Session × N (phiên truy cập)
 └─ Order (giữ source_device_id + submitted_by bất biến)
```

Quy tắc bất biến:

- Member và Device là hai thực thể khác nhau; một người có thể có nhiều máy.
- Thu hồi Device không xoá Member; xoá Member khỏi Shop phải thu hồi toàn bộ Device của Member trong cùng một transaction.
- Tên, SĐT, địa chỉ, COD không bao giờ là khoá nhận diện Device hay Order.
- Đơn cũ không đổi người/máy tạo chỉ vì quyền của nhân viên bị thay đổi.
- `shop_id` luôn là điều kiện bắt buộc ở mọi đọc/ghi; không thao tác theo `device_id` toàn cục.

### Vòng đời

`pending → active → suspended → revoked → retired`  
`active → lost` (sự cố mất máy) → `revoked`.

`purged` không phải trạng thái hiển thị thường ngày; chỉ là thao tác xoá vật lý sau thời hạn lưu giữ và phê duyệt.

## 3. Luồng vận hành đề xuất

### 3.1. Cấp máy mới

1. Owner/Manager tạo lời mời hoặc Shop Access Key có thời hạn.
2. Nhân viên đăng nhập/kích hoạt; hệ thống tạo Device ID ổn định, fingerprint hash và gắn Member + Shop.
3. Hiển thị xác nhận: tên máy, trình duyệt, hệ điều hành, IP gần nhất, thời điểm đăng ký.
4. Ghi audit `DEVICE_REGISTERED`; không ghi access key/token thô.

### 3.2. Theo dõi hằng ngày

- Bảng thiết bị hiển thị: nhân viên, tên máy, trạng thái, Last seen, phiên đang hoạt động, IP, phiên bản Extension, số đơn và COD.
- Heartbeat/check quyền có chu kỳ; sự kiện `deviceRevoked` phải làm panel chuyển sang Login và xoá session cục bộ.
- Mạng lỗi chỉ được vào `offline_grace` trong khoảng thời gian hữu hạn; không được fail-open vô thời hạn.

### 3.3. Khoá tạm thời

Nút **Tạm dừng** dùng cho nghỉ phép/nghi ngờ ngắn hạn. Có thể khôi phục, không giải phóng dữ liệu, bắt buộc lý do và audit.

### 3.4. Thu hồi máy

1. Modal hiển thị chính xác máy, nhân viên, Last seen, phiên đang hoạt động và số đơn lịch sử.
2. Owner xác nhận lý do: nghỉ việc, mất máy, đổi máy, vi phạm, khác.
3. Transaction server:
   - set `status = revoked`, `revoked_at`, `revoked_by`, `revoke_reason`;
   - vô hiệu session/token của Device;
   - ghi audit trước khi trả thành công.
4. Extension nhận sự kiện/heartbeat và đăng xuất; không xoá lịch sử đơn.
5. UI hiển thị “Đã thu hồi” và thời điểm, không biến mất ngay khỏi lịch sử.

### 3.5. Xoá nhân viên khỏi Shop

Đây là thao tác khác với xoá máy:

1. Hiển thị danh sách toàn bộ máy của Member và số phiên/đơn liên quan.
2. Bắt buộc chọn: “Thu hồi tất cả máy và giữ tài khoản ngoài Shop” hoặc “Thu hồi + gỡ Member khỏi Shop”.
3. Server transaction thu hồi tất cả Device → đóng phiên → set `shop_members.removed_at`, `removed_by`, `removal_reason`.
4. Nếu người dùng đang mở panel, phiên phải bị đẩy ra trong lần kiểm tra kế tiếp.
5. Không xoá `submitted_orders`, Customer Hub hay audit. Đơn lịch sử vẫn quy thuộc `submitted_by/source_device_id` cũ.

### 3.6. Khôi phục/chuyển máy

- Restore phải là hành động riêng, có quyền Owner/Manager và audit.
- Đổi máy tạo bản ghi Device mới; không tái sử dụng Device ID cũ.
- Không tự động chuyển đơn cũ sang máy mới.

## 4. Hợp đồng database/API cần chốt

Tạo migration phiên bản kế tiếp (ví dụ `v80_device_management_v2.sql`) sau preflight, gồm:

### Bảng/cột

- `extension_devices`: `shop_id`, `user_id`, `device_id`, `fingerprint_hash`, `status`, `last_seen`, `last_ip`, `client_version`, `revoked_at`, `revoked_by`, `revoke_reason`, `retired_at`, `metadata`.
- `device_sessions`: hash phiên, `device_id`, `shop_id`, `issued_at`, `last_seen`, `expires_at`, `revoked_at`, `revoked_by`; không lưu token thô.
- `shop_members`: `removed_at`, `removed_by`, `removal_reason` (nếu chưa có).
- Index duy nhất theo `(shop_id, device_id)` và index lọc trạng thái hoạt động.

### RPC ổn định

- `owner_get_members_v3(p_shop_id uuid)` — trả danh sách thành viên qua một hợp đồng JSONB ổn định, không truy cập Profile từ browser.
- `owner_get_shop_staff_and_devices(p_shop_id uuid)` — trả danh sách máy và KPI theo `source_device_id` bất biến.
- `owner_revoke_device(p_shop_id uuid, p_device_id text, p_reason text)` — idempotent, trả `affected_device_id`, `session_count`, `audit_id`.
- `owner_restore_device(p_shop_id uuid, p_device_id text, p_reason text)` — kiểm quyền, không tạo Device mới.
- `owner_remove_shop_member(p_shop_id uuid, p_user_id uuid, p_reason text, p_revoke_devices boolean)` — transaction thu hồi + gỡ Member.
- Audit thiết bị được ghi tự động bởi các RPC revoke/restore/remove; không có đường xoá vật lý.
- `check_device_session_validity(p_device_id text, p_shop_id uuid)` — phân biệt `active`, `revoked`, `unknown`; endpoint read-only vẫn callable bởi shop-key runtime.

Tất cả RPC phải có chữ ký duy nhất, `SECURITY DEFINER`, `search_path` cố định, kiểm tra Owner/Manager, `shop_id` isolation và `GRANT` đúng role. Không duy trì chuỗi v2/v3 fallback lâu dài.

## 5. UI/UX Options

### Trang Team

- Hai tab rõ ràng: **Thành viên** và **Máy trạm**.
- Bộ lọc: Shop (nếu có), trạng thái, nhân viên, Last seen, phiên bản.
- Badge trạng thái: Hoạt động, Offline tạm thời, Tạm dừng, Đã thu hồi, Máy mất.
- Hành động nguy hiểm tách màu và tách cấp: Tạm dừng / Thu hồi / Gỡ khỏi Shop / Purge.
- Modal phải nêu hậu quả và số lượng máy/phiên bị ảnh hưởng; không dùng `confirm()` một dòng cho thao tác hàng loạt.
- Lỗi API hiển thị thông báo có mã tương quan, không spam console bằng các request endpoint không tồn tại.

### Chi tiết đối soát

- Click một Device mở: đơn đã tạo, COD, mã đơn, tracking, thời gian; dữ liệu lấy theo `source_device_id`/`submitted_by`.
- Không dùng so khớp gần đúng theo tên nhân viên/tên máy để gán đơn; nếu dữ liệu cũ thiếu định danh thì hiển thị “Chưa xác định” và cho phép đối soát thủ công.

## 6. Extension runtime và bảo mật

- Lưu state máy cục bộ tối thiểu: `device_id`, trạng thái phiên, thời điểm kiểm tra cuối; không lưu token nhạy cảm ngoài vùng phù hợp.
- Khi server trả revoked: xoá session, phát `deviceRevoked`, đóng panel/đưa về Login, chặn thao tác tạo đơn.
- Khi 401/403/422 do quyền: yêu cầu đăng nhập lại hoặc hiển thị bị thu hồi; khi timeout mạng: chỉ dùng `offline_grace` với đồng hồ hết hạn.
- Telemetry tối thiểu: register, heartbeat, revoke nhận được, logout do revoke; không gửi nội dung đơn hoặc token.
- Chống race: một thao tác revoke lặp lại phải trả thành công idempotent, không tạo audit rác.

## 7. Kiểm thử bắt buộc

### Database/API

- RPC tồn tại đúng chữ ký; payload sai bị trả lỗi có mã, không 500 mơ hồ.
- Owner của Shop A không đọc/sửa Device Shop B.
- Revoke một Device không làm mất Member hoặc Device khác.
- Remove Member thu hồi tất cả Device trong một transaction; retry không đổi kết quả.
- Không thể revoke/xoá Owner cuối cùng của Shop.
- Không có `submitted_orders.user_id` thì RPC vẫn hoạt động bằng `submitted_by`.

### Extension/UI

- Revoke từ tab khác làm panel đăng xuất trong chu kỳ kiểm tra.
- Mạng lỗi không mở quyền vô hạn.
- Reload Team không gọi endpoint 404 khi capability chưa có.
- Device có cùng tên nhưng ID khác vẫn hiển thị độc lập.
- Đơn lặp của cùng khách nhưng khác `order_code` vẫn giữ nguyên và quy thuộc đúng Device.

Chạy tối thiểu:

```bash
npm test
npm run test:repeat-order
```

Thêm test contract cho chữ ký RPC, state machine revoke và payload xoá nhân viên.

## 8. Lộ trình 8 giai đoạn

1. **Preflight & khoanh vùng** — snapshot schema/RPC/RLS, sửa 400/404 tối thiểu, ghi incident.
2. **Domain & identity** — chốt Member/Device/Session/Order attribution, loại bỏ fallback theo tên.
3. **Migration dữ liệu** — bổ sung cột trạng thái/audit/session, index, RLS; backfill định danh an toàn.
4. **RPC/API v2** — triển khai list/revoke/restore/remove/audit với transaction và idempotency.
5. **Runtime kill-switch** — heartbeat, offline grace hữu hạn, nhận revoke và logout panel.
6. **Options UX** — bảng thành viên–thiết bị, modal thu hồi/gỡ Shop, lọc/trạng thái/audit.
7. **Kiểm thử & chạy song song** — test contract, security, race/retry, shadow-read và đo lỗi 4xx/5xx.
8. **Rollout & vận hành** — canary một Shop, dashboard lỗi, runbook mất máy/nghỉ việc, sau đó bật toàn bộ; purge chỉ sau thời hạn lưu giữ.

## 9. Tiêu chí nghiệm thu

- Không còn request bắt buộc tới RPC/table không tồn tại.
- Nút thu hồi máy thành công ngay cả khi nhân viên có nhiều máy; retry an toàn.
- Trong vòng một chu kỳ kiểm tra, máy bị thu hồi không thể tạo đơn mới.
- Lịch sử đơn, COD, Customer Hub và audit không bị xoá hay gán lại.
- Owner xem được ai, máy nào, trạng thái gì, lần cuối hoạt động khi nào và vì sao bị thu hồi.
- Có thể khôi phục máy hợp lệ mà không tái sử dụng định danh hoặc làm thay đổi đơn cũ.

## 10. Runbook thao tác thực tế

### Nhân viên nghỉ việc

`Mở Member → xem danh sách máy → Thu hồi tất cả → Gỡ khỏi Shop → kiểm tra audit → xác nhận không còn phiên active.`

### Mất máy

`Mở Device → Thu hồi khẩn cấp → kiểm tra Last seen/IP → đổi Shop Access Key nếu có nguy cơ lộ → cấp máy mới.`

### Máy lỗi nhưng người vẫn làm việc

`Tạm dừng máy cũ → cấp Device mới → không chuyển đơn lịch sử → kiểm tra đơn mới có source_device_id mới.`

### Không thể gọi RPC

`Không xoá trực tiếp từ browser. Đánh dấu thao tác chờ xử lý, hiển thị mã lỗi, dùng migration/admin runbook có audit.`
