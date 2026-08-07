# BỐI CẢNH DỰ ÁN — GỬI CHO AI ĐÁNH GIÁ & ĐỀ XUẤT PHÁT TRIỂN TÍNH NĂNG

> File này tổng hợp toàn bộ bối cảnh project để bạn (AI) đánh giá hiện trạng,
> phát hiện rủi ro và đề xuất lộ trình phát triển tính năng. Trả lời vui lòng
> bằng tiếng Việt, trình bày rõ ràng từng phần.

---

## 1. GIỚI THIỆU DỰ ÁN

Browser Extension giúp người bán **tự động điền đơn hàng lên VNPost và J&T**.
Luồng thao tác: dán text đơn thô -> parser bóc tách -> (tùy chọn) AI chỉnh chuẩn
(Groq) -> review -> tự động điền form trên trang web của bưu cục.

Hạ tầng backend: **Supabase** (Postgres + RLS + RPC functions + supabase-js).

---

## 2. CẤU TRÚC THƯ MỤC

```
EXT ANTIGRAVIY/
├── manifest.json            # Extension manifest (MV2/MV3), content script
├── content.js               # Parse đơn, gọi API AI, điền form VNPost/J&T
├── ui.js                    # Panel UI (shadow DOM), drag, wiring nút
├── style.css                # Stylesheet panel
│
├── admin-dashboard/         # PORTAL ADMIN (chạy bằng file://, không build)
│   ├── login.html           # Trang đăng nhập
│   ├── index.html           # Trang dashboard (options-like)
│   ├── admin.html           # Master Admin Portal (sidebar 6 tab)
│   ├── options.css          # Bộ CSS dùng chung
│   ├── supabase-config.js   # Chứa SUPABASE_URL + anon key
│   ├── auth.session.js      # Quản lý session (access_token/refresh_token)
│   ├── auth.service.js      # Login/logout/RPC, đồng bộ token localStorage
│   ├── app.js               # Logic options page
│   ├── master-admin.js      # Logic Master Admin Portal (tab, CRUD, RPC)
│   ├── storage.js           # Storage cho extension (chrome.storage / fallback)
│   ├── shops.js             # Logic quản lý shop của tài khoản owner
│   └── parser.js            # Parser đơn hàng
│
└── database/migrations/     # Toàn bộ SQL migration (Supabase)
```

**LƯU Ý KIẾN TRÚC**:
- Portal admin **không có build**, là các file .html/.js tĩnh chạy bằng `file://`.
- Không dùng framework (vanilla JS) — mọi logic viết tay.
- Phân vai: `master-admin.js` = dashboard SYSTEM_ADMIN; `app.js`/`shops.js` = khu vực user thường.

---

## 3. DATABASE (SUPABASE) — SCHEMA THỰC TẾ

Kiểm tra trực tiếp trên DB `https://xlgovgynbsahuykyjzcx.supabase.co`

### Bảng chính
| bảng | cột |
|------|-----|
| `profiles` | id, email, role, created_at, status, username, phone, updated_at, full_name, disabled_at, last_login |
| `roles` | id (UUID), code, name, created_at |
| `user_roles` | user_id, role_id, created_at |
| `shop_members` | id, shop_id, user_id, role, permissions, status, joined_at, created_by, role_id, removed_at |
| `shops` | id, name, owner_id, sender_name/phone/address/province/district/ward, vnpost_customer_code, jt_contract_code, order_code_prefix, bank_name, bank_account_no, created_at, updated_at, status, deleted_at, deleted_by |
| `orders` | id, name, phone, address, order_code, cod_amount, collect_fee, platform, created_at, device_name, shop_id, deleted_at, deleted_by |
| `audit_logs` | id, actor_email, action, details, shop_id, user_id, actor_id, target_user, old_value, new_value, target_resource, target_id, payload, created_at |
| `notifications` | id, shop_id, user_id, title, message/content, type, is_read, is_global, level, created_at |
| `system_configs` | key (PK), value JSONB, description, updated_at, updated_by |
| `extension_devices` | id, user_id, device_name, browser, version, revoked, last_seen, created_at |
| `shop_feature_flags` | shop_id (PK), ai_parsing_enabled, smart_address_enabled, vnpost_autofill_enabled, jt_autofill_enabled, use_system_groq_key |
| `shop_quotas` | (theo v5) |

### system_configs hiện có (key -> value)
- `groq_api_keys` -> `["gsk_default_system_key_placeholder"]` *(chưa có key thật)*
- `default_ai_prompt` -> `"Bóc tách thông tin đơn hàng thô thành JSON chuẩn: {customer_name, phone, address, items, cod_amount, note}"`
- `global_blacklist_phones` -> `["0900000000", "0911111111"]`
- `maintenance_mode` -> `{"enabled": false, "message": "..."}`
- `extension_version` -> `{"min_required":"1.0","latest":"1.1","force_update":false}`

### Roles (code)
`SYSTEM_ADMIN`, `SHOP_OWNER`, `SHOP_MANAGER`, `SHOP_STAFF`, `EXTENSION_USER`, `SUPPORT`, `VIEWER`

---

## 4. RPC FUNCTIONS (SECURITY DEFINER) — `006_admin_rpc.sql`

- `admin_get_users_with_shops()` — danh sách user + shop + role
- `admin_assign_user_shop(uid, shop_id, role_code)` — gán shop cho user
- `admin_change_user_role(uid, role_code)` — đổi vai trò
- `admin_disable_user / admin_enable_user(uid)` — khóa/mở
- `admin_toggle_user_lock(uid)` — toggle lock
- `admin_get_system_metrics()` — tổng shops/users/orders/devices
- `owner_invite_staff/owner_remove_staff/owner_get_members` — quản lý nhân viên
- `system_get_notifications(p_shop_id)` / `mark_notification_read(id)` — thông báo
- (v9) `admin_create_user(...)` — tạo user mới vào auth.users + profiles + user_roles

Total: tất cả hàm admin đều kiểm tra quyền `SYSTEM_ADMIN` bằng query `user_roles
JOIN roles WHERE user_id = auth.uid()` rồi `RAISE EXCEPTION` nếu không đủ.

---

## 5. CÁC VẤN ĐỀ ĐÃ GẶP VÀ ĐÃ SỬA GẦN ĐÂY (log)

| Vấn đề | Nguyên nhân gốc | Cách xử lý |
|--------|-----------------|-----------|
| Admin các tab không bấm được | `auth.service.js` lỗi cú pháp (mất khai báo `async login`) -> module chết -> JS không có handler | Thêm lại khai báo hàm |
| Token không đồng bộ | `auth.session.js` saveSession không ghi access_token vào localStorage; supabase-js không setSession | Ghi token vào localStorage; master-admin/app.js đọc fallback từ `vnpost_session` |
| Trả 400 "Truy cập bị từ chối" | anon key có prefix `sb_` nên code nhầm là local dev session | Chỉ `!url \|\| !anonKey` mới thành local dev |
| 500 infinite recursion policy | `003_members.sql` policy tự tham chiếu `shop_members` | `v10` — thay policy bằng SECURITY DEFINER helper `is_shop_member()`,`is_system_admin()` |
| 404 `operator does not exist: integer = uuid` | `shop_members.role_id` còn INT (v3_1) nhưng `roles.id` UUID (v4) | `v11` đổi type role_id -> UUID |
| 400 `column p.disabled_at does not exist` | profiles thiếu cột `disabled_at`, `last_login` | `v12` thêm cột |
| Insert audit_logs thiếu cột | audit_logs/notifications thiếu cột RPC tham chiếu | `v13` thêm cột `actor_id,target_user,old_value,new_value,target_resource,target_id,payload` + `content,target` |
| `null value in column "actor_email"` | `actor_email` NOT NULL nhưng không được điền | `v14` trigger tự điền actor_email từ auth.uid() |

### Migration đã tồn tại (database/migrations/)
001..007, v3_enterprise, v3_1_rbac, v4_saas, v5_master_admin, v6_DEPRECATED,
v7_auth_roles, v8, v9, v10_fix_rls, v11_fix_role_type, v12_fix_profiles,
v13_fix_audit/fix_notifications, v14_fix_actor_email, RUN_ALL_MIGRATIONS.sql

---

## 6. TRẠNG THÁI GIAO DIỆN ADMIN HIỆN TẠI

Master Admin Portal (`admin.html`) gồm **7 tab sidebar** (hash routing `#tab`):
1. **#metrics** — Tổng quan Hệ thống
2. **#shops** — Quản lý & Cấp Shop (CRUD shop, khóa/khôi phục)
3. **#permissions** — Hạn ngạch & Quyền Shop
4. **#configs** — **Cấu hình Extension Tập trung** (menu trái 3 mục: Groq API Keys / AI System Prompt / SĐT đen; mỗi mục một card có chế độ xem + Sửa + nút Lưu riêng)
5. **#audit** — Audit Logs & Thiết bị
6. **#users** — Quản lý Người dùng & Vai trò (lọc, tạo, gán quyền)
7. Có thể thêm mới.

Feature hiện có:
- View/Sửa lưu riêng của Groq keys, AI Prompt, danh sách đen SĐT.
- Assign shop, change role, lock/unlock user, create user.
- Metrics dashboard.
- Hash routing để F5 không mất trang hiện tại.

---

## 7. CÂU HỎI CẦN AI ĐÁNH GIÁ / ĐỀ XUẤT

Hãy trả lời theo các mục sau hãy thật chi tiết:

1. **Đánh giá tổng quan kiến trúc**
   - Điểm mạnh/điểm yếu của cách tổ chức (vanilla JS, no build, RLS + RPC, file://)
   - Rủi ro bảo mật tiềm tàng: RLS, SECURITY DEFINER dùng `auth.uid()`, hardcode key.

2. **Phát triển tính năng tiếp theo — nên ưu tiên làm gì?**
   - Đề xuất 5 tính năng có giá trị nhất kèm lý do và độ phức tạp (S/M/L).
   - Theo cách ưu tiên "quick win" và "long-term".

3. **UI/UX admin**
   - Nhận xét luồng Cấu hình Extension hiện tại; đề xuất cải thiện (navigation, validation, confirm, feedback toast thay alert...).

4. **Database/schema**
   - Phát hiện thiếu hoặc hạn chế trong schema; gợi ý thêm constraints/index/SQL functions.

5. **Lỗ hổng vận hành**
   - Thiếu rate-limit/throttling trong nhiều RPC; gợi ý cách bảo vệ (defense-in-depth) tốt hơn cho RLS + RPC.

---

## 8. GHI CHÚ KHÁC

- `AGENTS.md` có quy tắc: giữ luồng sử dụng (paste -> parse -> review -> fill), chỉnh sửa có chủ đích, không refactor code đang chạy ngon.
- `CLAUDE.md`: connect theo hướng "Think Before Coding", "Simplicity First".
- Không có pipeline test/build trong repo — kiểm thử thủ công trên browser.

---

*(Hết file để gửi ChatGPT)*