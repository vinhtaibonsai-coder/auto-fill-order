# KẾ HOẠCH: Chuyển 3 Trang (Index / Options / Admin) sang Dữ Liệu Hệ Thống Thật

**Ngày**: 2026-08-11 | **Thiết kế gốc**: `AUTO_FILL_ORDER_COMMERCIAL_UI_UX_MASTER_PLAN(1).md` + `implementation_plan.md`

> **Nguyên tắc duy nhất của kế hoạch này**: Mọi con số, danh sách, trạng thái hiển thị trên cả 3 trang phải đọc từ **Supabase (hệ thống)**. Không còn dữ liệu ảo (mock/hardcode) trong bất kỳ màn hình nào. Chức năng nào chưa có bảng/cột/RPC tương ứng → phát triển tầng dữ liệu trước (migration), rồi mới gắn UI.

---

## 0. KẾT QUẢ P0 — XÁC MINH DB THẬT (2026-08-11)

Đã kết nối Supabase project `xlgovgynbsahuykyjzcx` (orderautofill) và rà toàn bộ schema qua PostgREST + RPC probe.

### 0.1 Bảng THẬT tồn tại trong DB (39 bảng)

`activity_logs`, `address_dataset_versions`, `address_dictionary`, `ai_usage_log`, `audit_logs`, `carrier_configs`, `carrier_health_logs`, `customers`, `devices`, `extension_devices`, `feature_flags`, `history`, `invite_codes`, `login_attempts`, `member_permissions`, `notifications`, `order_events`, `orders`, `permissions`, `profiles`, `release_versions`, `role_permissions`, `roles`, `settings`, `shop_devices`, `shop_feature_flags`, `shop_members`, `shop_quotas`, `shop_templates`, `shops`, `submitted_orders`, `subscriptions`, `support_tickets`, `sync_outbox`, `system_configs`, `system_templates`, `user_roles`, `user_sessions`

### 0.2 ⚠️ KHÁC BIỆT QUAN TRỌNG so với migration trong repo

| Giả định trong repo (v1-v34) | SỰ THẬT trong DB | Hệ quả |
|---|---|---|
| Bảng AI usage: `ai_usage_logs` (v25, số nhiều) | Chỉ có **`ai_usage_log`** (số ít, có `prompt_tokens`, `completion_tokens`) | Mọi code/migration mới phải dùng `ai_usage_log`. ai-gateway function đã ghi đúng bảng này ✅ |
| `admin_audit_logs` (admin.repository.js:64 INSERT) | **KHÔNG TỒN TẠI** | Audit admin đang fail âm thầm → sửa repository sang `audit_logs` thật (cột: `shop_id, user_id, action, entity_type, entity_id, details`) |
| `shop_members.role_id` (v15 migration) | Thật: cột **`role` TEXT** (OWNER/MANAGER/STAFF/VIEWER) | `resolve_dashboard_role` phải đọc `sm.role` (đã viết đúng trong v35) |
| `get_admin_users_list` (v29) | **KHÔNG TỒN TẠI** | Admin Users page đang hỏng → v35 tạo mới |
| `is_shop_member()` (v10/v19) | **KHÔNG TỒN TẠI** | RLS bảng mới + RPC mới cần nó → v35 tạo mới |
| `resolve_dashboard_role` (implementation_plan) | **KHÔNG TỒN TẠI** | → v35 tạo mới |
| `check_shop_member_or_admin`, `consume_ai_quota`, `create_order_event`, `owner_get_members`, `get_system_config_value`, `get_user_role` | **KHÔNG TỒN TẠI** | Các RPC này trong repo nhưng chưa được deploy; cần kiểm tra từng chỗ UI gọi |
| `carrier_configs`, `customers`, `sync_outbox`, `activity_logs`, `settings`, `address_dictionary`, `shop_quotas`, `invite_codes`, `login_attempts`, `user_sessions`, `role_permissions`, `member_permissions`, `shop_templates`, `system_templates`, `extension_devices`, `devices`, `history` | **ĐÃ CÓ** (không có trong repo migration) | DB được quản lý trực tiếp trên Supabase SQL Editor, migration repo không đầy đủ → **Migration mới phải dựa trên DB THẬT, không dựa trên repo** |

### 0.3 RPC tồn tại thật — KẾT QUẢ CHÍNH XÁC (probe lần 2, 2026-08-11)

> ⚠️ **Phương pháp**: probe bằng body `{}` chỉ khớp hàm *không tham số* hoặc 1 tham số json — **KHÔNG dùng được** để kết luận hàm có tham số. Lần 1 đã kết luận nhầm. Lần 2 probe với đúng tên+loại tham số (lấy từ migrations repo).

| RPC | Trạng thái THẬT | Bằng chứng |
|---|---|---|
| `is_system_admin()` | ✅ Tồn tại | probe `{}` → false |
| `get_user_role(p_user_id)` | ✅ **Tồn tại** (lần 1 sai) | `"SYSTEM_ADMIN"` cho admin, `"SHOP_STAFF"` cho staff |
| `is_shop_member(p_shop_id)` | ✅ **Tồn tại** (lần 1 sai) | trả `false` (service role → auth.uid() null) |
| `check_shop_member_or_admin(p_shop_id)` | ✅ **Tồn tại** (lần 1 sai) | trả `false` |
| `consume_ai_quota(shop_id,delta,tokens...)` | ✅ **Tồn tại** (lần 1 sai) | trả `{code:ACCESS_DENIED, success:false}` |
| `get_ai_budget(p_shop_id)` | ✅ Tồn tại | `{code:ACCESS_DENIED, success:false}` |
| `check_ai_rate_limit(p_shop_id)` | ✅ **Tồn tại** | `{code:ACCESS_DENIED, success:false}` |
| `owner_get_members(p_shop_id)` | ✅ **Tồn tại** (lần 1 sai) | P0001 "Bạn không thuộc Shop này." |
| `create_order_event(...)` | ✅ **Tồn tại** (lần 1 sai) | P0001 "ACCESS_DENIED" |
| `get_system_config_value(p_key)` | ✅ **Tồn tại** (lần 1 sai) | trả `null` (key không tồn tại) |
| `admin_get_system_config(p_key)` | ✅ **Tồn tại** (lần 1 sai) | P0001 "ACCESS_DENIED" |
| `upsert_system_config(p_key,p_value,p_description)` | ✅ **Tồn tại** (lần 1 sai) | P0001 "ACCESS_DENIED" |
| `admin_revoke_device(p_device_id,p_revoked)` | ✅ **Tồn tại** | 22P02 (lỗi uuid — hàm nhận đúng param) |
| `get_admin_kpis()` | ✅ Tồn tại (bản v32 — v35 sẽ REPLACE token thật) | P0001 ACCESS_DENIED |
| `admin_get_system_metrics()`, `get_admin_shops_list()`, `admin_list_devices()`, `get_master_admin_shops()`, `get_my_extension_session()`, `set_shop_plan` | ✅ Tồn tại | probe + hint PostgREST |
| `resolve_dashboard_role(p_user_id)` | ❌ **THẬT SỰ thiếu** | probe đúng param vẫn 404 |
| `get_shop_dashboard_stats(p_shop_id)` | ❌ **THẬT SỰ thiếu** | probe đúng param vẫn 404 |
| `get_system_health()` | ❌ **THẬT SỰ thiếu** | probe `{}` 404 |
| `get_admin_users_list(5 params)` | ❌ **THẬT SỰ thiếu** | probe đủ 5 param vẫn 404 |
| `insert_audit_log(...)` | ❌ **THẬT SỰ thiếu** | bảng audit_logs chặn INSERT REST (42501) — cần RPC SECURITY DEFINER |

### 0.4 Schema thật một số bảng quan trọng (đã capture)

- **`orders`**: id, name, phone, address, order_code, cod_amount, collect_fee, platform, created_at, device_name, shop_id, deleted_at, deleted_by, status, updated_by, submitted_at, submitted_by, failure_reason, source_device_id → **id là TEXT** (v20 đúng)
- **`ai_usage_log`**: id, shop_id, user_id, device_id, request_type, prompt_tokens, completion_tokens, status, rate_bucket, created_at → **có tokens thật, KHÔNG cần thêm cột**
- **`profiles`**: id, email, role, status, username, phone, full_name, disabled_at, last_login
- **`shops`**: id, name, owner_id, sender_*, vnpost_customer_code, jt_contract_code, order_code_prefix, bank_*, status, deleted_at
- **`customers`**: phone, name, address, province, segment, total_orders, total_cod, latest_date, fav_carrier, tags, notes, shop_id → **ĐÃ CÓ bảng customers — Index I-04 KHÔNG cần RPC gom từ orders, đọc thẳng**
- **`carrier_configs`**: shop_id, carrier_id, is_connected, account_username → **ĐÃ CÓ — Options O-08 KHÔNG cần bảng mới**
- **`sync_outbox`**: shop_id, operation, table_name, payload, status → **ĐÃ CÓ — dùng cho Index I-06 Sync thật**
- **`history`**: raw_text, result, customer_name, phone, address, order_code, waybill_code, cod_amount, platform, shop_id → **ĐÃ CÓ — Index I-05 History đọc thẳng**

### 0.5 Điều chỉnh kế hoạch do P0

- ❌ BỎ: `shop_carrier_configs` (bảng mới) → dùng `carrier_configs` đã có
- ❌ BỎ: cột `tokens` cho ai_usage_logs → `ai_usage_log.prompt_tokens/completion_tokens` đã có
- ❌ BỎ: RPC `get_shop_customers` → dùng bảng `customers` đã có (chỉ cần policy đọc theo shop)
- ✅ GIỮ: bảng `shop_address_aliases` (không tồn tại trong DB thật)
- ✅ GIỮ: `resolve_dashboard_role`, `get_shop_dashboard_stats`, `get_system_health`, `get_admin_users_list` (đều thiếu)
- ➕ THÊM: helper `is_shop_member()` (thiếu, là nền của mọi RLS bảng mới)
- 🔧 SỬA CODE: `admin.repository.js` `insertAuditLog` → bảng `audit_logs` thật; `getSecurityStats` → `audit_logs` (không phải `admin_audit_logs`)
- 📄 **Migration v35 đã viết xong**: `database/migrations/v35_real_data_support.sql`

### 0.6 Kiểm tra lần 2 (2026-08-11, sau khi key được cấp lại)

- Service/an anon key hoạt động trở lại (HTTP 200). Lỗi 401 ban đầu là tạm thời.
- **Cột thật** đã xác minh từng bảng migration tham chiếu:
  - `carrier_health_logs`: `id, carrier_code, status, response_time_ms, error_message, detected_at` ✅ (khớp get_system_health)
  - `submitted_orders`: `id, saved_order_id, name, phone, address, order_code, cod_amount, collect_fee, platform, tracking_code, submitted_at, submitted_date, device_name, shop_id, deleted_at, deleted_by, status, failure_reason, updated_at` ✅ (khớp get_shop_dashboard_stats)
  - `sync_outbox`: `id, shop_id, user_id, operation, table_name, payload, status, error_message, created_at` ✅
  - `user_roles`: `user_id, role_id, created_at` ✅; `roles`: `id, code, name` ✅ (codes: `SYSTEM_ADMIN, SUPPORT, SHOP_OWNER, SHOP_MANAGER, SHOP_STAFF, VIEWER, EXTENSION_USER`)
  - `audit_logs`: `shop_id, user_id, action, entity_type, entity_id, details, created_at` ✅ (đúng thứ admin.repository.js sẽ chuyển sang)
- **Dữ liệu mẫu thật**: 6 shops (status lẫn lộn `'active'`/`'Active'`!), 5 profiles (`role` LUÔN `'member'`), `shop_members.role` = `OWNER/MANAGER/STAFF` (hoa), `ai_usage_log` có 140+ bản ghi `status='success'`, `submitted_orders` có 1 đơn J&T (`shop_id: null`), `orders`/`sync_outbox`/`carrier_health_logs` đang rỗng.

### 0.7 Sửa migration v35 sau kiểm tra lần 2 (đã áp vào file)

1. `is_shop_member()` → thêm JOIN `profiles` (phải `status='active'` + `disabled_at IS NULL`) — đồng bộ chuẩn v19 (hàm đã tồn tại, CREATE OR REPLACE an toàn)
2. `get_admin_users_list()` → **viết lại theo contract UI thật** (Users.jsx):
   - Trả **MẢNG JSON trực tiếp** (UI gọi `.filter()/.map()` trên kết quả — `{total,rows}` sẽ crash)
   - `role = 'master_admin'` khi user có `SYSTEM_ADMIN` trong user_roles (UI so sánh `=== 'master_admin'`); nếu không, lấy role code ưu tiên cao nhất
   - `shops[] = {shop_id, shop_name, shop_role}` (join `shops.name`, `sm.role`) — v29 cũ join `sm.role_id` = **cột không tồn tại** trong DB thật
   - `p_role` filter qua `user_roles JOIN roles.code` (không lọc `profiles.role` — luôn `'member'`)
3. `get_admin_kpis()` → `shops.status` đổi thành `LOWER(status) = 'active'|'trial'|'suspended'` (dữ liệu lẫn chữ thường/hoa)
4. **Thêm RPC `insert_audit_log(p_action, p_entity_type, p_entity_id, p_details, p_shop_id)`** — ghi audit admin: audit_logs chặn INSERT qua REST (probe 42501), admin.repository.js đang ghi nhầm bảng `admin_audit_logs` không tồn tại → RPC SECURITY DEFINER guard `is_system_admin()`

### 0.8 KẾT QUẢ P2 (Admin) — code đã sửa xong (2026-08-11)

| Mục | Trạng thái |
|---|---|
| A-01 Overview | ✅ `get_admin_kpis` thật; v35 thay token ước lượng ×150 bằng `sum(prompt_tokens+completion_tokens)` thật |
| A-02 SystemHealth | ✅ **Xóa toàn bộ hardcode** (45ms/99.99%/210ms/incident giả): thêm `AdminRepository.getSystemHealth()` + `AdminService.getSystemHealth()` → RPC `get_system_health()`; `SystemHealth.jsx` hiển thị requests/errors/success-rate/quota-limited/carrier health thật + checked_at |
| A-03 AIPlatform/Quotas | ✅ Đã thật: `system_configs` qua `admin_get_system_config`/`upsert_system_config` (RPC guard), `shop_quotas` trực tiếp |
| A-04 Role resolver | ✅ `resolve_dashboard_role` trong v35 (thật sự thiếu — probe đúng param vẫn 404) |
| A-06 Audit | ✅ `insertAuditLog` → RPC `insert_audit_log` (bảng `admin_audit_logs` không tồn tại + REST INSERT bị RLS chặn); `getSecurityStats` → bảng `audit_logs` thật (cột `entity_type/entity_id/details`) |
| A-07 Các page khác | ✅ CarrierHealth/Subscriptions/Features/Devices/Support/Releases/Shops đã đọc bảng thật; chỉ còn `Users.jsx handleInvite` là mock trung thực (cần Mail Service — ngoài phạm vi) |
| Xác minh phụ | ✅ `get_user_role` chạy đúng (admin → SYSTEM_ADMIN) nên auth gate Admin portal hoạt động; `insert_audit_log` RLS chặn REST INSERT đã xác minh bằng probe 42501 |

**CHỜ**: migration v35 chưa áp lên DB → `get_admin_users_list` (Users page), `get_system_health` (SystemHealth page), `insert_audit_log` (audit) chỉ chạy sau khi chạy migration.

---

## 1. Hiện trạng khảo sát (đã xác minh trong code)

### 1.1 INDEX (`src/ui/index/App.jsx`, `index.html`) — 100% ẢO

| Module | File | Nguồn dữ liệu hiện tại | Trạng thái |
|---|---|---|---|
| Dashboard KPIs | `App.jsx:56-86` | Hardcode: "24 Đơn", "8.450.000 đ", "22 (91.6%)", "14/10 đơn" | 🔴 ẢO |
| Orders list | `App.jsx:9-13,97` | `mockOrders` 3 đơn cứng | 🔴 ẢO |
| Remote parse | `App.jsx:19-27` | `setTimeout` + fake result | 🔴 ẢO |
| Customers CRM | `App.jsx:157-160` | 1 khách hàng cứng | 🔴 ẢO |
| Sync status | `App.jsx:168-170` | Chuỗi cứng "Cloud Live Online" | 🔴 ẢO |

### 1.2 OPTIONS (`src/ui/options/`) — Phần lớn ẢO / Local

| Module | File | Nguồn dữ liệu hiện tại | Trạng thái |
|---|---|---|---|
| RBAC | `App.jsx:36` | `useState('OWNER')` — role chọn tay | 🔴 ẢO |
| Overview | `Overview.jsx:25` | `confidenceRate: 94.5` cứng | 🔴 ẢO |
| OrderList/History | `OrderList.jsx:18` | `OrderStorage` (chrome.storage.local) | 🟠 LOCAL |
| CustomerCRM | `CustomerCRM.jsx:48` | gom từ storage local | 🟠 LOCAL |
| AddressEngine | `AddressEngine.jsx:12-15` | storage local + fallback 2 alias mẫu | 🟠 LOCAL |
| Carriers | `Carriers.jsx:12` | storage local | 🟠 LOCAL |
| AISettings | `AISettings.jsx:28` | storage local + feature flags thật | 🟡 LAI |
| ShopProfile | `ShopProfile.jsx:24` | `fetch /shops?id=...` thật | 🟢 THẬT |
| Team | `Team.jsx:4-8` | staff cứng | 🔴 ẢO |
| Subscription | `Subscription.jsx:4,6-12` | plan "STARTER", "480/1000" cứng | 🔴 ẢO |
| PermissionMatrix, DeviceManagement, Notifications, SyncSettings, Security, AuditLogs | — | cần rà lại từng page | 🟠 1 phần LOCAL |

### 1.3 ADMIN (`src/ui/admin-dashboard/`) — Phần lớn THẬT, còn lỗ hổng

| Module | File | Nguồn dữ liệu hiện tại | Trạng thái |
|---|---|---|---|
| Overview | `Overview.jsx:25` | `get_admin_kpis` RPC | 🟢 THẬT* |
| ShopList | `ShopList.jsx:17` | `get_admin_shops_list` | 🟢 THẬT |
| Users | `Users.jsx:23` | `get_admin_users_list` | 🟢 THẬT |
| Subscriptions | `Subscriptions.jsx:13` | `getSubscriptions` | 🟢 THẬT |
| FeatureFlags | `FeatureFlags.jsx:13` | `getFeatureFlags` | 🟢 THẬT |
| CarrierHealth | `CarrierHealth.jsx:12` | `getCarrierHealth` | 🟢 THẬT |
| Devices | `DeviceManagement.jsx:22` | `listDevices` | 🟢 THẬT |
| SecurityRLS | `SecurityRLS.jsx:20` | `getSecurityStats` | 🟢 THẬT |
| SupportTickets | `SupportTickets.jsx:13` | `getSupportTickets` | 🟢 THẬT |
| Releases | `ReleaseCenter.jsx:12` | `getReleaseVersions` | 🟢 THẬT |
| AddressDataset | `AddressDataset.jsx:13` | `getAddressDatasets` | 🟢 THẬT |
| **SystemHealth** | `SystemHealth.jsx:25-68` | **Hardcode: 45ms, 99.99%, 210ms, incident giả** | 🔴 ẢO |
| AIPlatform/Quotas | `Quotas.jsx` | gọi AdminService (cần rà chi tiết) | 🟡 1 phần |

*\* `get_admin_kpis` (v32) có dòng `v_ai_tokens_today := v_ai_requests_today * 150;` — token count là ước lượng nhân, chưa phải số liệu thật. Xem §5.2.*

---

## 2. Dữ liệu hệ thống SẴN CÓ (dùng được ngay)

Từ `database/migrations/` v1→v34:

**Bảng**: `roles`, `shops`, `shop_members`, `profiles`, `user_roles`, `orders`, `submitted_orders`, `order_events`, `notifications`, `permissions`, `subscriptions`, `feature_flags`, `shop_devices`, `carrier_health_logs`, `address_dataset_versions`, `support_tickets`, `release_versions`, `ai_usage_logs`, `system_configs`, `audit_logs`

**RPC chính**: `get_admin_kpis`, `get_admin_shops_list`, `get_admin_users_list`, `get_user_role`, `get_ai_budget`, `consume_ai_quota`, `check_ai_rate_limit`, `is_shop_member`, `is_system_admin`, `create_order_event`, `get_system_config_value`, `upsert_system_config`, `owner_get_members`, `owner_invite_staff`, `owner_remove_staff`

**Lưu ý**: `resolve_dashboard_role` (2 tầng) được mô tả trong `implementation_plan.md` nhưng **chưa thấy file migration tương ứng** trong `database/migrations/` (chỉ có `v10_fix_rls_recursion.sql`, không có `v10_admin_dashboard.sql`) → cần kiểm tra DB thật, nếu thiếu thì tạo mới (thuộc §5).

---

## 3. KẾ HOẠCH INDEX (Worker Workspace)

Mục tiêu: biến `src/ui/index/App.jsx` từ màn hình demo → workspace làm việc thật, đọc từ hệ thống.

| # | Module (theo master plan) | Thay đổi | Nguồn dữ liệu |
|---|---|---|---|
| I-01 | **Dashboard** | ✅ XONG — bỏ "24 Đơn"/"8.450.000 đ" cứng → `get_shop_dashboard_stats(shop_id)`: đơn hôm nay, COD hôm nay, đã gửi, nháp, lỗi, sync chờ, tổng; tên shop thật từ `shops` | RPC `get_shop_dashboard_stats` (v35) |
| I-02 | **Create Order** | ✅ XONG — `handleRemoteParse` gọi THẬT `ai-gateway` (task `parse`, body `{task, text, deviceId, shop_id}`) giống service-worker; map lỗi AI sang tiếng Việt; POST `orders` draft (owner; lỗi RLS không chặn luồng) | `ai-gateway` (đã có) + POST `/rest/v1/orders` |
| I-03 | **Orders list** | ✅ XONG — bỏ `mockOrders` → `orders` (Nháp) + `submitted_orders` (Đã gửi) theo shop, mới nhất trước; platform/COD/địa chỉ/tracking thật | Bảng `orders` + `submitted_orders` |
| I-04 | **Customers (Mini CRM)** | ✅ XONG — gom client-side từ `submitted_orders` theo phone (tên, sđt, địa chỉ mới nhất, số đơn, thời gian gần nhất); không cần RPC mới (bảng `customers` tồn tại nhưng chưa được ghi) | Gom từ `submitted_orders` |
| I-05 | **History** | ✅ gộp vào tab Orders (submitted_orders = lịch sử đã gửi); không có tab riêng trên mobile | Bảng `submitted_orders` |
| I-06 | **Sync status** | ✅ XONG — bỏ "Cloud Live Online" cứng → đếm `sync_outbox` PENDING thật (xanh nếu 0, vàng nếu có chờ) | Bảng `sync_outbox` |
| I-07 | **Notifications** | ↦ Chuyển về Options (page Notifications đã thật qua `system_get_notifications`) — giữ 5 tab mobile | RPC `system_get_notifications` |
| I-08 | **Auth** | ✅ XONG — `AuthService.isAuthenticated()` + `AuthSession.getSession().active_shop_id`; không auth → màn hình yêu cầu mở Options đăng nhập; offline session → báo cần đăng nhập | `AuthSession`/`AuthService` |

**Điều kiện hoàn thành I**: Mở trang index với tài khoản có shop thật → thấy số liệu khớp 100% với bảng `orders` trong DB; tạo 1 đơn mới → xuất hiện trong list mà không reload DB thủ công.

---

## 4. KẾ HOẠCH OPTIONS (Shop Control Center)

Mục tiêu: bỏ role chọn tay, bỏ storage local cho dữ liệu quản trị; mọi cấu hình shop nằm trên hệ thống.

| # | Module | Thay đổi | Nguồn dữ liệu |
|---|---|---|---|
| O-01 | **RBAC thật** | ✅ XONG — `useState('OWNER')` → `resolve_dashboard_role` + fallback `session.role`; menu Config chỉ hiện với `ui_role != viewer`; bỏ role-select mock; nút Admin Dashboard chỉ cho SYSTEM_ADMIN | RPC `resolve_dashboard_role` (v35) |
| O-02 | **Overview** | ✅ XONG — bỏ `94.5` cứng → `get_shop_dashboard_stats(shop_id)` (orders_today/submitted_today/failed_today/sync_pending/cod_today) + đếm `ai_usage_log` hôm nay (AI Parsed) | RPC `get_shop_dashboard_stats` (v35) + `ai_usage_log` |
| O-03 | **Shop Profile** | Giữ nguyên (đã thật — đọc/ghi `shops` qua REST; `updated_at` đã xác minh tồn tại). Avatar/logo upload: defer | Bảng `shops` |
| O-04 | **Team & Roles** | ✅ XONG — bỏ staff cứng → RPC mới `owner_get_members_v2` (JOIN `profiles` cho email/full_name; guard OWNER/MANAGER) + fallback REST `shop_members`; invite/remove qua `owner_invite_staff_v2`/`owner_remove_staff_v2` (guard, ghi notifications + audit_logs). RPC cũ `owner_*` dùng `sm.role_id` (cột KHÔNG tồn tại trong DB thật) — bỏ qua | RPC mới (§6, migration v36) |
| O-05 | **Permission Matrix** | ✅ XONG — ma trận thật từ `permissions` + `roles` + `role_permissions` (readonly; quyền do Admin quản lý) | Bảng `permissions`/`roles`/`role_permissions` |
| O-06 | **AI Settings** | ✅ XONG — bỏ đọc storage local cho threshold/autoCorrect → cột mới `shop_feature_flags.ai_confidence_threshold/ai_auto_correct` (v36) + RLS member đọc/OWNER ghi; hiển thị Quota thật từ `get_ai_budget(shop_id)`; `panel/App.jsx` đọc Cloud (fallback local) | Bảng `shop_feature_flags` (v36) + RPC `get_ai_budget` |
| O-07 | **Address Engine** | ✅ XONG — bỏ `af_address_aliases` local → bảng `shop_address_aliases` (RLS member đã có từ v35); add/delete qua REST (UNIQUE shop_id+original) | Bảng `shop_address_aliases` (v35) |
| O-08 | **Carriers** | ✅ XONG — bỏ `af_carrier_config` local → bảng `carrier_configs` (đã có: shop_id, carrier_id, is_connected, account_username; RLS: member đọc, OWNER ghi); connect/disconnect = PATCH/POST REST | Bảng `carrier_configs` (đã có) |
| O-09 | **Order Defaults** | ⏸️ DEFER — `shops.order_defaults` KHÔNG tồn tại trong DB thật; `upsert_system_config` guard `is_system_admin` (owner không ghi được). Cần quyết định schema (vd cột JSONB trong `shops`, hoặc bảng `shop_settings`) ở v37 | — |
| O-10 | **Devices** | ✅ XONG — bỏ device ảo → bảng thật tên `devices` (KHÔNG phải `shop_devices`; cột: user_id, browser_info, location_ip, last_active, status); empty state thật; revoke qua RPC `admin_revoke_device`; hạn mức từ `subscriptions.max_devices` | Bảng `devices` |
| O-11 | **Subscription** | ✅ XONG — bỏ plan "STARTER" cứng → đọc `subscriptions` theo shop (plan thật hiện FREE, XƯỞNG LŨA); quota từ `get_ai_budget`; đếm thiết bị thật; nâng cấp = request liên hệ admin (không tự sửa plan) | Bảng `subscriptions` (đã có) |
| O-12 | **Sync/Notifications/Security/Audit** | ✅ XONG — Notifications đọc RPC `system_get_notifications(shop_id)`; SyncSettings đọc `sync_outbox` (status/error thật); AuditLogs đọc `audit_logs` theo shop (RLS owner/manager); bảng thật đang rỗng → empty state đúng | Bảng `notifications`/`sync_outbox`/`audit_logs` + RPC đã có |

**Điều kiện hoàn thành O**: Đăng nhập 2 tài khoản khác role (OWNER/STAFF) → menu khác nhau đúng ma trận; sửa alias/carrier/default → reload trang vẫn còn (lưu trên DB, không phải storage local).

---

## 5. KẾ HOẠCH ADMIN (SaaS Control Plane)

Mục tiêu: vá các màn hình còn hardcode; chuẩn hóa số liệu thật.

| # | Module | Thay đổi | Nguồn dữ liệu |
|---|---|---|---|
| A-01 | **Overview** | `get_admin_kpis` đã thật; chỉ cần sửa token count ước lượng (xem §5.2) | RPC sửa |
| A-02 | **SystemHealth** | 🔴 **Xóa toàn bộ hardcode** (45ms/99.99%/210ms/incident giả) → đọc `carrier_health_logs` (bảng đã có) + thêm RPC `get_system_health()` đo thật: ping Supabase (query đếm 1 bảng), đếm lỗi gần đây trong `ai_usage_logs`/`order_events` | Bảng `carrier_health_logs` + RPC mới |
| A-03 | **AIPlatform/Quotas** | Rà từng phần tử hiển thị; chỗ nào số liệu giả (ví dụ model registry, rate limit) → nguồn thật là `ai_usage_logs` (latency, status, model) + `system_configs` (quota policy) | Bảng `ai_usage_logs` (đã có) |
| A-04 | **Role resolver 2 tầng** | Đảm bảo `resolve_dashboard_role` tồn tại trong DB (mô tả ở `implementation_plan.md`); nếu thiếu → thêm migration (additive, không đụng schema cũ) | Migration mới |
| A-05 | **Thiếu trang theo master plan** | Shops detail (thêm tab: users, orders, usage, devices, audit) — dùng các RPC admin đã có | RPC đã có |
| A-06 | **Audit** | Đã thật (`audit_logs`); bổ sung màn hình lọc theo admin/action/target nếu chưa có | Bảng `audit_logs` (đã có) |
| A-07 | **Releases/Carriers/Support/Devices/Features** | Giữ nguyên (đã thật) — chỉ rà lại lần cuối không còn placeholder | — |

**Điều kiện hoàn thành A**: Mở SystemHealth → số liệu thay đổi theo thời gian thật (không phải 45ms cố định); login `SYSTEM_ADMIN` → đúng role; login `SHOP_OWNER` → không vào được trang admin.

---

## 5.1 BẢNG ĐỐI CHIẾU: Chức năng master plan ⇔ Nguồn dữ liệu

| Chức năng master plan | Dữ liệu hệ thống | Trạng thái |
|---|---|---|
| Index: Dashboard / Orders / Customers / History / Sync | `orders`, `submitted_orders`, `order_events` + RPC mới `get_shop_dashboard_stats`, `get_shop_customers` | Phát triển RPC + gắn UI |
| Options: Team | `owner_get_members` (đã có) | Chỉ gắn UI |
| Options: AI Usage/Quota | `get_ai_budget` (đã có) | Chỉ gắn UI |
| Options: Address Alias | **Bảng `shop_address_aliases` CHƯA CÓ** | Migration mới |
| Options: Carrier config | **Bảng `shop_carrier_configs` CHƯA CÓ** | Migration mới |
| Options: Order defaults | `system_configs` + RPC (đã có) | Chỉ gắn UI |
| Options: Subscription | `subscriptions` (đã có) | Chỉ gắn UI |
| Admin: Overview KPIs | `get_admin_kpis` (có, sửa token) | Sửa RPC |
| Admin: System Health | `carrier_health_logs` (có) + RPC `get_system_health` mới | Migration + UI |
| Admin: AI tokens thật | `ai_usage_logs` **THIẾU cột `tokens`** | Migration mới (thêm cột) |
| Admin: Role 2 tầng | `resolve_dashboard_role` **CHƯA XÁC MINH có trong DB** | Kiểm tra + migration |

---

## 5.2 PHÁT TRIỂN DỮ LIỆU (Migration mới — additive, không phá vỡ schema hiện tại)

File đề xuất: `database/migrations/v35_real_data_support.sql` (tên tham khảo)

```sql
-- 1. Alias địa chỉ theo shop (Options O-07)
CREATE TABLE IF NOT EXISTS public.shop_address_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  original TEXT NOT NULL,
  mapping TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (shop_id, original)
);
ALTER TABLE public.shop_address_aliases ENABLE ROW LEVEL SECURITY;
-- policy: thành viên shop CRUD alias của shop mình
-- (dùng public.is_shop_member(shop_id))

-- 2. Cấu hình carrier theo shop (Options O-08)
CREATE TABLE IF NOT EXISTS public.shop_carrier_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  carrier_code TEXT NOT NULL,           -- VNPOST, JT
  enabled BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  config JSONB DEFAULT '{}'::jsonb,     -- field mapping, default service, COD...
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (shop_id, carrier_code)
);
ALTER TABLE public.shop_carrier_configs ENABLE ROW LEVEL SECURITY;

-- 3. AI tokens thật (Admin A-03) — bổ sung cột, giữ dữ liệu cũ
ALTER TABLE public.ai_usage_logs ADD COLUMN IF NOT EXISTS tokens INT DEFAULT 0;
-- (ai-gateway function ghi tokens thật từ response usage)

-- 4. RPC: dashboard stats cho shop (Index I-01 / Options O-02)
CREATE OR REPLACE FUNCTION public.get_shop_dashboard_stats(p_shop_id UUID)
RETURNS JSONB ...; -- đếm orders/submitted/events theo ngày, theo status

-- 5. RPC: customers gom theo phone (Index I-04)
CREATE OR REPLACE FUNCTION public.get_shop_customers(p_shop_id UUID)
RETURNS JSONB ...; -- GROUP BY phone

-- 6. RPC: system health thật (Admin A-02)
CREATE OR REPLACE FUNCTION public.get_system_health()
RETURNS JSONB ...; -- đếm lỗi gần đây, latency trung bình từ ai_usage_logs,
                   -- trạng thái carrier mới nhất từ carrier_health_logs

-- 7. Đảm bảo resolve_dashboard_role tồn tại (Admin A-04)
-- (copy từ implementation_plan.md nếu DB chưa có)
```

> ⚠️ Tất cả policy RLS của bảng mới phải dùng `is_shop_member()` / `is_system_admin()` sẵn có (đã chuẩn). KHÔNG mở policy `authenticated` tràn lan (tránh lỗi như `read_ai_usage_logs` ở v25 — policy SELECT toàn authenticated, cần rà lại khi gắn data thật).

---

## 6. THỨ TỰ TRIỂN KHAI (Phase)

| Phase | Nội dung | Output | Phụ thuộc |
|---|---|---|---|
| **P0** | Kiểm tra DB thật: bảng/RPC nào đã tồn tại (đặc biệt `resolve_dashboard_role`, `ai_usage_logs.tokens`) | Báo cáo diff DB | — |
| **P1** | Migration v35 (bảng alias, carrier configs, cột tokens, 3 RPC mới) + chạy trên DB | DB sẵn sàng | P0 |
| **P2** | ADMIN: SystemHealth + AIPlatform thật, sửa `get_admin_kpis` bỏ token ước lượng | Admin 100% thật | P1 |
| **P3** | OPTIONS: RBAC thật → Team, Subscription, AI Settings, Address, Carriers, Defaults | Options 100% thật | P1 |
| **P4** | INDEX: Dashboard, Orders, Customers, Create Order, History, Sync | Index 100% thật | P1 |
| **P5** | Rà toàn bộ: grep mock/hardcode = 0; chạy manual test 3 trang | DoD | P2-P4 |

---

## 7. ĐỊNH NGHĨA HOÀN THÀNH (DoD)

- [ ] `grep -r "mockOrders\|mockCustomer\|94.5\|setTimeout(() =>" src/ui` → 0 kết quả (trừ loading UI)
- [ ] Index/Options/Admin đăng nhập bằng tài khoản thật → mọi số liệu khớp 100% với DB (kiểm tra bằng SQL đối chiếu)
- [ ] Sửa cấu hình trên Options → reload trang → dữ liệu vẫn còn (lưu DB)
- [ ] SystemHealth admin hiển thị số đo thật, thay đổi theo thời gian
- [ ] Tuân thủ Constitution: giữ shadow DOM, HTTPS/RLS, tiếng Việt; không mở policy RLS tràn lan
- [ ] Các bảng mới đều có RLS `is_shop_member`/`is_system_admin`, không dùng service key trong UI

---

## 8. RỦI RO CẦN CHÚ Ý

1. **v25 `read_ai_usage_logs` mở SELECT cho mọi authenticated** — khi hiển thị AI usage thật, cần siết lại policy theo shop (migration sửa).
2. **`get_admin_kpis` đang đếm `ai_usage_log` (số ít)** — bảng thật là `ai_usage_logs` (số nhiều, v25). Nếu RPC đang chạy được thì DB có bảng `ai_usage_log` khác → cần xác minh để không đếm sai.
3. **`orders.id` kiểu TEXT** (v20) — khi JOIN các bảng mới phải dùng TEXT, không gắn FK UUID cứng (lỗi 42804).
4. **Không xóa `OrderStorage`** ngay — panel/extension content script vẫn đọc local để hoạt động offline; chỉ 3 trang web chuyển sang DB. Sync 2 chiều là phase sau.
5. **Thời gian thực**: nếu cần bảng xếp hạng/timer, dùng `realtime.service.js` đã có, không tự bấm giờ bằng setTimeout.
