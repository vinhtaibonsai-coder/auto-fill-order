# KẾ HOẠCH: GỘP ROLE MODEL — LOẠI BỎ ROLE TRÙNG LẮP

> Trạng thái: NHÁP (chờ duyệt) — v6.0, rủi ro CAO khi touch role system.

---

## 1. VẤN ĐỀ

Hiện role tồn tại ở **4 nơi** cùng lúc mà chưa có nguồn "đúng" duy nhất:

| Nơi lưu | Hệ | Mục đích hiện tại | Dùng bởi |
|---------|----|-------------------|----------|
| `profiles.role` | Hệ thống lẫn shop | Legacy từ bảng đơn giản | `admin-dashboard/app.js` (đọc + GHI), `app.js:1964,2142` |
| `user_roles` | **Hệ thống** | RBAC chính (SYSTEM_ADMIN, ...) | `master-admin.js`, `shops.js`, RPC auth check |
| `shop_members.role` | Shop | Role tại shop (dạng TEXT code) | `v8 RPC`, `master-admin.js:600`, `shops.js:316` |
| `shop_members.role_id` | Shop | FK → `roles(id)` (nguồn chuẩn) | `006 RPC`, `v5`, RPC `admin_assign_user_shop` |

**Hậu quả khi không nhất quán** (đúng như bạn mô tả):

```
`profiles.role`       = SHOP_OWNER     ← Legacy
`user_roles`          = SHOP_MANAGER   ← RBAC hệ thống
`shop_members.role`   = STAFF          ← text code không chuẩn
`shop_members.role_id`= SHOP_OWNER     ← FK khác
```

→ User "thực sự là ai" không ai đảm bảo, gây: hiển thị sai role, từ chối/grant nhầm quyền, khó audit, khó mở rộng.

---

## 2. MÔ HÌNH ĐÍCH (TARGET MODEL)

```
profiles        ── chỉ thông tin user (không chứa role)
user_roles      ── QUYỀN CẤP HỆ THỐNG (SYSTEM_ADMIN, SUPPORT)
shop_members    ── user thuộc shop nào + role tại shop (SHOP_OWNER, SHOP_MANAGER, ...)
roles           ── bảng mã role chuẩn (id UUID, code, name)
```

Phân tầng rõ:
- **System Role** (nằm ở `user_roles`): `SYSTEM_ADMIN`, `SUPPORT`
- **Shop Role** (nằm ở `shop_members`): `SHOP_OWNER`, `SHOP_MANAGER`, `SHOP_STAFF`, `VIEWER`, `EXTENSION_USER`

Quy tắc:
- Không đọc/ghi `profiles.role` cho mục đích phân quyền.
- `shop_members` chỉ dùng **1 nguồn role**: `role_id` (FK → `roles.id`). Cột `role` (text) sẽ được đồng bộ / bỏ sau.

---

## 3. KHẢO SÁT THỰC TẾ (8/2026) — code phụ thuộc

### 3a. NHÁNH CHẠY THẬT (extension, theo `manifest.json`)
- `src/backend/auth/auth.service.js` + `frontend/options/options-account.js`
  - Dùng `user.role` (đọc từ Supabase `profiles`) để map nhãn
  - `user_roles`/`roles(code)` được gọi để lấy system role → **trùng logic** với `profiles.role`
- `src/backend/permission/permission.service.js` — có `shop_members.role` (text)
- `src/backend/member/member.service.js` — mock role `'owner'` + `role_id: 1` (cần sửa mock)

### 3b. NHÁNH PORTAL ADMIN (`admin-dashboard/` — mới, chạy bằng `file://`)
- `app.js:2191` → **GHI** `profiles.role` (upsert) — cần dừng ngay
- `app.js:170-174` — đọc role qua `user_roles` → đúng mô hình, giữ nguyên
- `master-admin.js` / `shops.js` — dùng `shop_members.role` (text) để render badge
- RPC `006_admin_rpc.sql` dùng `shop_members.role_id` (FK)

### 3c. Database (`database/migrations/`)
- `roles` (id UUID, `name`, `code`, `created_at`) — nguồn tham chiếu
- `v11_fix_shop_members_role_type` — mới sửa `role_id` từ INT → UUID, đã có FK `shop_members_role_id_fkey`

---

## 4. KẾ HOẠCH TRIỂN KHAI THEO PHA

### PHASE 1 — DỪNG GHI & ĐỌC TRÙNG (ngay, ngày 1-3)
Mục tiêu: ngừng tạo dữ liệu role trùng, vẫn không phá màn hình đang chạy.
Không có migration khó:

1. **Ngừng ghi `profiles.role`**:
   - `admin-dashboard/app.js:2191` — bỏ `update({ role })`. Role user thuộc về `user_roles`.
2. **Đồng bộ `shop_members.role_id` là nguồn duy nhất**:
   - RPC `admin_assign_user_shop`, `admin_change_user_role` — ghi `role_id` (đã đúng); bỏ `role` text mới nếu có.
   - Thêm **trigger đồng bộ 1 chiều**: khi `role_id` đổi → tự `UPDATE shop_members.role = (SELECT code FROM roles WHERE id = NEW.role_id)` để không phá màn hình đọc `role` text (thời gian chuyển tiếp).
3. Viết **bài kiểm tra DB** (SQL thủ công hoặc script):
   - Query mọi user: liệt kê 4 nguồn role cho ra KẾT QUẢ THỰC TẾ, xem có lệch không.

### PHASE 2 — CHUYỂN CODE ĐỌC VỀ MÔ HÌNH (tuần 2-3)
1. `admin-dashboard/master-admin.js:600`, `shops.js:316`:
   - Đổi render badge từ lấy `role` (text) → `role_id` join `roles.code` (hoặc dùng RPC `admin_get_users_with_shops` đã trả `role_code`).
2. `src/backend/permission.service.js`, `member.service.js`, `invite.service.js` (nhánh cũ):
   - Vì nhánh cũ được giữ cho khả năng fallback, chuyển từ đọc `role` → `role_id`/`role_code`.
3. `frontend/options/options-account.js`: bỏ đọc `user.role`, thay bằng `user_roles` join `roles.code`.

### PHASE 3 — CLEANUP DB (sau khi code không còn đọc)
1. Tạo migration `v15_cleanup_legacy_role`:
   - `UPDATE shop_members SET role = r.code FROM roles r WHERE shop_members.role_id = r.id` (đồng bộ nốt dữ liệu lịch sử)
   - Kiểm tra: không script nào còn đọc `profiles.role`. Nếu còn → quay lại PHASE 2.
   - `ALTER TABLE profiles DROP COLUMN role;`
2. (Tùy chọn) tách/biến `shop_members.role` thành **generated column** (đọc từ `role_id`) — vẫn giữ field cho hiển thị, không thủ công.

---

## 4. RỦI RO & CÁCH GIẢM

| Rủi ro | Mức | Giảm |
|--------|-----|------|
| PHASE 2 chưa xong mà PHASE 3 drop cột → crash | CAO | Bắt buộc giữ cột trước; gate PHASE 3 = code không còn đọc |
| Màn hình cũ đọc `shop_members.role` dạng text | TRUNG | Giữ trigger đồng bộ `role_id` → `role` |
| 2 nhánh (`admin-dashboard` vs `src/`) đang song song, có thể lệch nhau | CAO | Khóa: nhánh cũ không phải mục tiêu; liệt kê rõ ràng trong story |
| Mock/service cứ `role_id: 1` INT (member.service.js) không khớp UUID hiện tại | TRUNG | Sửa mock thành `role_id` UUID |

---

## 5. KẾT QUẢ ĐẦU RA (success criteria)
- Không còn code/DB nào GHI `profiles.role`.
- 100% truy vấn role hệ thống → `user_roles`.
- 100% role shop → `shop_members.role_id` (join `roles`); cột `role` text là phái sinh.
- Kiểm thử: chạy query "tổng các nguồn role" → không còn bản ghi mâu thuẫn.
- Drop được cột `profiles.role` mà không lỗi runtime (xác nhận PHASE 3 thành công).

---

## 6. MANIFEST CẦN LÀM ĐỒNG THỜI

1. Cảnh báo (flag) nếu một user có 2 role hệ thống trong cùng ngữ cảnh → hiện warning.
2. `SUPPORT` chỉ thuộc hệ thống, không nằm trong shop member.
3. Khi tạo user mới: không tự tạo cả 3 nguồn; tạo `profiles` + `user_roles` (hệ thống) + đợi `shop_members` nếu được gán shop.

---

*Kế hoạch viết dựa trên khảo sát các script hiện tại. Trước khi code hãy đọc kỹ; chỉ drop cột `profiles.role` sau khi toàn bộ code đọc role đã chuyển sang `role_id`/`user_roles`.*