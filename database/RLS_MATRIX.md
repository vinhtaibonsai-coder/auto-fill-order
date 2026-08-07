# RLS MATRIX & SECURITY AUDIT

Ngày chốt: 2026-08-03 — dựa trên quét toàn bộ migrations (v1..v21).

## Trạng thái vá các khoảng trống (v19–v21)

| # | Khoảng trống | Bản vá | Trạng thái |
|---|---|---|---|
| 1 | `audit_logs` policy `FOR ALL` (007) cho phép admin UPDATE/DELETE | v19 §1 — policy SELECT-only + `REVOKE UPDATE,DELETE` cho authenticated/anon | ✅ |
| 2 | User disabled vẫn gọi được RPC (JWT còn hạn) | v19 §2 — `is_shop_member`/`is_system_admin` giờ check `profiles.status='active'` và `disabled_at IS NULL` | ✅ |
| 3 | `search_path` hầu hết RPC chưa set | v19 §3 — `SET search_path=''` cho mọi admin RPC + helper | ✅ |
| 4 | Index orders theo `(shop_id, created_at DESC)` còn thiếu | v19 §4 — `idx_orders_shop_created`, `idx_orders_shop_status`, `idx_orders_phone`, `idx_submitted_shop_created` | ✅ |
| 5 | Chưa có sổ theo dõi lifecycle đơn | v20 → `order_events` (bất biến qua RLS) + columns `submitted_at/by`, `failure_reason`, `source_device_id`; RPC `create_order_event` guard member | ✅ |
| 6 | `system_configs` (chứa groq_api_keys) đọc được REST công khai | v21 → RPC `get_system_config_value` (mask secret cho non-admin) + `upsert_system_config` (guard admin) | ✅ (REVOKE cuối sau khi chuyển client) |

## Quy tắc chung

| Layer | Quy tắc |
|---|---|
| Core | `ELECT = RLS policy`; `INSERT/UPDATE/DELETE` chỉ qua **RPC SECURITY DEFINER** có guard `is_system_admin()` / `check_shop_member_or_admin()` |
| Role nguồn | `user_roles.code` (system) + `shop_members.role` (shop) — đã thống nhất theo v15 |
| Helper | `public.is_system_admin()` (v10), `public.check_shop_member_or_admin()` (v17) |
| Audit | Mọi mutate RPC ghi `audit_logs` trên cùng transaction |

## Ma trận RLS theo bảng (đã quét 2026-08-03)

| Bảng | SELECT | INSERT | UPDATE | DELETE | Ghi chú |
|---|---|---|---|---|---|
| profiles | user tự xem (có policy) | ✗ | ✗ (qua RPC/v1) | ✗ | Cập nhật cá nhân qua `AuthService` |
| roles / permissions / role_permissions | Đọc khi active (policy) | ✗ | ✗ | ✗ | Chỉ admin RPC |
| user_roles | Bản thân | ✗ | ✗ | ✗ | admin RPC `admin_set_user_role` |
| shops | active member / SYSTEM_ADMIN | ✗ | ✗ | ✗ | admin RPC `admin_create_shop` |
| shop_members | active member / admin | ✗ | ✗ | ✗ | RPC `admin_assign_user_shop` |
| shop_quotas | active member (policy) | ✗ | ✗ | ✗ | chỉ consume qua RPC |
| shop_feature_flags | member | ✗ | ✗ | ✗ | admin RPC |
| orders | member của shop + deleted_at IS NULL | WITH CHECK (member) | policy | ✗ | soft delete via PATCH, có check shop |
| submitted_orders / history / customers | member | ✗ | ✗ | ✗ | (cần xác nhận) |
| extension_devices | user tự (v18) | WITH CHECK (tự, v18) | UPDATE own (v18) | ✗ | revoke qua `admin_revoke_device` |
| ai_usage_log | member shop (v17) | ✗ client | ✗ | ✗ | ghi qua RPC consume |
| order_events | member shop / SYSTEM_ADMIN (v20) | ✗ client (no-op policy + REVOKE) | ✗ | ✗ | ghi qua RPC `create_order_event` |
| audit_logs | SELECT (SYSTEM_ADMIN) | ✗ | ✗ (no-op v19) | ✗ (no-op v19) | immutable — chỉ INSERT qua RPC |
| notifications | member | ✗ | ✗ | ✗ | |
| system_configs | SELECT (all authenticated — anon key!) | ✗ | ✗ | ✗ | **PATCH**: dùng RPC v21; REVOKE khi client chuyển xong |

## ⚠️ Phát hiện rủi ro quan trọng

1. **`system_configs` SELECT mở cho authenticated** — chứa `groq_api_keys`. Đây chính là lý do Groq key phải dời về Edge Function (đã làm bước 5). **Khi deploy gateway, rã (REVOKE) SELECT `system_configs` khỏi role authenticated**, thay bằng RPC `admin_get_system_config_safe()` chỉ trả blacklist/prompt, không trả key.

2. **`admin_list_users` (v16) trả full email/nữa toàn bộ** — chỉ SYSTEM_ADMIN. OK.

3. **`orders.DELETE` không policy → deny write trực tiếp từ client** ✅ → soft-delete qua PATCH `deleted_at` cần policy UPDATE cho member. Đã có.

4. **`shop_members` không có UNIQUE(user_id) active** — v tried hạt user có nhiều active shop OK theo thiết kế (nhiều shop/user). v15 đã làm role sync.

## Security test suite (cross-shop isolation)

Test phải chứng minh: user của SHOP A không thể read/write/delete SHOP B, và mọi RPC đều từ chối.

Chạy: `node tests/security/rls-security.test.js` (đọc `.env.local`):

```js
// (nội dung hướng dẫn chi tiết tại tests/README.md)
```

### Checklist mục 38 (đánh dấu trạng thái)

**Auth**
- [x] JWT validation (Edge gateway `verify_jwt=true`, `getUserRole` IDOR guard v16)
- [x] refresh token (AuthService `login` flow /auth/v1/token)
- [x] session expiration (AuthSession expire check)
- [x] logout (`logout()`, xoá session)
- [x] revoke device (v18 + auto-logout trong extension) ✅
- [x] disabled user bị chặn (v19) — `is_shop_member`/`is_system_admin` check `profiles.status='active'` + `disabled_at IS NULL` ✅

**RBAC**
- [x] System role (`is_system_admin`)
- [x] Shop role (`check_shop_member_or_admin`)
- [x] Permission (user_roles + role_permissions)
- [x] Cross-shop isolation (test suite)

**RLS** (SELECT/INSERT/UPDATE/DELETE từng bảng) — ma trận trên + test

**RPC**
- [x] auth.uid() (v10/v16)
- [x] authorization (is_system_admin / member check)
- [x] input validation (shop ownership, exists checks)
- [x] SECURITY DEFINER (tất cả admin RPC)
- [x] search_path == '' đã set trên mọi admin RPC + helper (v19 §3) ✅
- [ ] EXECUTE privilege (đã GRANT trong v16-v21, cần audit tất cả)
- [ ] error handling (jsonb success/error pattern)

**AI/Edge**
- [x] Groq key server-side (Edge gateway) — deploy bước 5
- [x] rate limit (v17)
- [x] quota atomic (v17)
- [x] timeout (gateway 30s)
- [x] retry limit (gateway 1 lần 5xx)
- [x] usage logging (ai_usage_log)

## Việc lưu ý tiếp theo
1. **REVOKE SELECT `system_configs`** khỏi authenticated/anon — v21 đã thêm RPC `get_system_config_value`/`upsert_system_config`; REVOKE toàn bộ khi mã extension/admin đã chuyển hết sang RPC (hiện `service-worker.js:616`, `client.js:1299`, `options-config.js:197`, admin `loadSystemConfigs` và `fetchSystemConfigs` còn SELECT REST).
2. Deploy Gateway nhớ `supabase secrets set GROQ_API_KEY=...` rồi `supabase functions deploy ai-gateway`.
3. Chạy `RLS_SECURITY_TEST.sql` sau khi dán v16-v21 — bổ sung test order_events/get_system_config_value (đang mở rộng, xem file).
4. Audit toàn diện EXECUTE privilege (item mở) — sau khi có danh sách RPC live.