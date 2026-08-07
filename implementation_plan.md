# Kế hoạch FINAL v3 — Admin Dashboard (Đã chốt toàn bộ quyết định)

> [!IMPORTANT]
> Tất cả open questions đã được chốt. Kế hoạch này là **bản cuối cùng** sẵn sàng để thực thi.

---

## Quyết định đã chốt

| # | Chủ đề | Quyết định |
|---|--------|-----------|
| 1 | **Role model** | Dashboard dùng 4 UI role (`master_admin`, `admin`, `shop_admin`, `viewer`) **map từ schema thật** — KHÔNG tạo bảng mới |
| 2 | **Nguồn role** | `user_roles` (global) + `shop_members` (per-shop) + `roles` — schema đang chạy, dùng chung với Extension |
| 3 | **Multi-shop** | `shop_members(shop_id, user_id, role_id)` — đã tồn tại |
| 4 | **MFA** | Bắt buộc `SYSTEM_ADMIN`; configurable qua `system_configs` (real code) |
| 5 | **Deploy** | Vercel + HTTPS mặc định |
| 6 | **UI** | Next.js 15 App Router + shadcn/ui + TanStack Table |

### Mapping role thật → UI role

| Real role (schema) | Tầng đọc | → UI role | Phạm vi |
|---|---|---|---|
| `SYSTEM_ADMIN` | `user_roles` | `master_admin` | Toàn hệ thống |
| `SUPPORT` | `user_roles` | `admin` | Đọc mọi shop (read-only) |
| `SHOP_OWNER`, `SHOP_MANAGER` | `shop_members` | `shop_admin` | Shop trong `shop_members` |
| `SHOP_STAFF`, `VIEWER` | `shop_members` | `viewer` | Shop trong `shop_members` |
| `EXTENSION_USER` | `user_roles` | *(chặn)* | Redirect `/unauthorized` |

> Resolver 2 tầng: check `user_roles` trước → nếu không match thì check `shop_members` → nếu rỗng thì unauthorized. Xử lý đúng việc chủ shop KHÔNG có row trong `user_roles`.

---

## Kiến trúc tổng thể (Final)

```
[ Browser ]
     │ HTTPS / HttpOnly Cookies
     ▼
[ middleware.ts ]
  └─ updateSession()   → refresh token rotation
  └─ !session          → redirect /login
  └─ KHÔNG query DB
     │
     ▼
[ dashboard/layout.tsx ]  ← Server Component
  └─ getUser()
  └─ resolve_dashboard_role() → RPC 2 tầng (user_roles → shop_members)
  └─ !role / EXTENSION_USER → redirect /unauthorized
  └─ CHECK MFA by role → redirect /login/mfa-verify nếu cần
     │
     ▼
[ Server Components ]     ← Tối đa hóa
  └─ Fetch data qua Supabase server client (anon + cookies)
  └─ RLS áp dụng tự động
  └─ Chỉ truyền data xuống Client Components
     │
     ▼
[ Supabase Postgres ]
  └─ RLS trên mọi bảng
  └─ Indexes trên cột filter
  └─ Audit trigger
```

---

## Database Schema (Final)

### Sơ đồ quan hệ

```
auth.users (Supabase)
     │ 1
     ▼ 1
profiles ──────────────┐
(id, email, full_name)  │
     │ 1                │ 1
     ▼ N                ▼ N
user_roles          shop_members ──────────► roles
(user_id, role_id)  (shop_id, user_id,       (id, code, name)
     │               role_id, status)
     │ N                  │ N
     ▼ 1                  ▼ 1
  roles                shops
(SYSTEM_ADMIN,     (id, name, owner_id, status)
 SUPPORT, ...)          │ 1
                        ▼ N
                     orders
             (id, shop_id, created_by, ...)
```

> **Multi-tenant qua 2 tầng:** role toàn cục ở `user_roles` (SYSTEM_ADMIN/SUPPORT), role theo shop ở `shop_members` (SHOP_OWNER/MANAGER/STAFF). Không có bảng `admin_users`/`admin_shop_permissions` — plan cũ đã bỏ.

### SQL Migration đầy đủ

> [!IMPORTANT]
> Migration này **THUẦN BỔ SUNG** trên schema đang chạy (v4→v9). KHÔNG `CREATE TABLE`,
> KHÔNG `DROP`, KHÔNG đụng `shop_members`/`user_roles`/`roles` (Extension backend
> `src/backend/member/member.service.js` đang dùng trực tiếp qua REST). Chỉ thêm:
> (1) MFA config, (2) RPC resolver role 2 tầng cho dashboard, (3) vá policy đọc còn thiếu
> cho `SUPPORT`, (4) policy SELECT cho `audit_logs`. Đặt file: `database/migrations/v10_admin_dashboard.sql`.

```sql
-- ================================================================
-- MIGRATION v10: Admin Dashboard (ADDITIVE — chạy sau v9)
-- Không tạo bảng mới. Dùng schema thật + RPC map role.
-- ================================================================

-- ── 1. MFA CONFIG (dùng bảng system_configs SỐ NHIỀU đã tồn tại) ─
-- Key mới, không đụng các config sẵn có. real role code.
INSERT INTO public.system_configs (key, value, description) VALUES
  ('mfa_required_roles', '["SYSTEM_ADMIN"]'::jsonb,
     'Danh sách role (code thật) bắt buộc MFA khi vào dashboard'),
  ('mfa_recommended_roles', '["SUPPORT"]'::jsonb,
     'Role được khuyến nghị bật MFA (không bắt buộc)')
ON CONFLICT (key) DO NOTHING;

-- ── 2. RPC RESOLVER ROLE 2 TẦNG (nguồn role DUY NHẤT cho dashboard)
-- Trả về (real_role, ui_role). Check user_roles trước → shop_members sau.
-- SHOP_OWNER/MANAGER KHÔNG có row trong user_roles nên get_user_role()
-- trả NULL cho họ — hàm này xử lý đúng bằng cách fallback shop_members.
CREATE OR REPLACE FUNCTION public.resolve_dashboard_role(
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS TABLE (real_role TEXT, ui_role TEXT)
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  v_global TEXT;
  v_shop   TEXT;
BEGIN
  -- Tầng 1: role global (user_roles)
  SELECT r.code INTO v_global
  FROM public.user_roles ur
  JOIN public.roles r ON ur.role_id = r.id
  WHERE ur.user_id = p_user_id
  ORDER BY CASE r.code
    WHEN 'SYSTEM_ADMIN' THEN 1 WHEN 'SUPPORT' THEN 2 ELSE 3 END
  LIMIT 1;

  IF v_global = 'SYSTEM_ADMIN' THEN
    RETURN QUERY SELECT 'SYSTEM_ADMIN', 'master_admin'; RETURN;
  ELSIF v_global = 'SUPPORT' THEN
    RETURN QUERY SELECT 'SUPPORT', 'admin'; RETURN;
  END IF;

  -- Tầng 2: role per-shop (shop_members) — lấy role cao nhất
  SELECT r.code INTO v_shop
  FROM public.shop_members sm
  JOIN public.roles r ON sm.role_id = r.id
  WHERE sm.user_id = p_user_id AND sm.status = 'active'
  ORDER BY CASE r.code
    WHEN 'SHOP_OWNER' THEN 1 WHEN 'SHOP_MANAGER' THEN 2
    WHEN 'SHOP_STAFF' THEN 3 WHEN 'VIEWER' THEN 4 ELSE 5 END
  LIMIT 1;

  IF v_shop IN ('SHOP_OWNER', 'SHOP_MANAGER') THEN
    RETURN QUERY SELECT v_shop, 'shop_admin'; RETURN;
  ELSIF v_shop IN ('SHOP_STAFF', 'VIEWER') THEN
    RETURN QUERY SELECT v_shop, 'viewer'; RETURN;
  END IF;

  -- Không có quyền dashboard (EXTENSION_USER hoặc không role) → NULL
  RETURN QUERY SELECT COALESCE(v_global, 'NONE'), NULL::TEXT;
END;
$$;

-- ── 3. HELPER: check global role (dùng lại cho policy) ───────────
CREATE OR REPLACE FUNCTION public.has_global_role(p_codes TEXT[])
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() AND r.code = ANY(p_codes)
  );
$$;

-- ── 4. VÁ POLICY ĐỌC CÒN THIẾU CHO SUPPORT (→ UI "admin") ────────
-- RLS orders/shops hiện chỉ cho shop_members HOẶC SYSTEM_ADMIN.
-- SUPPORT cần đọc-all (read-only) để làm role "admin" của dashboard.

-- orders: SUPPORT đọc tất cả đơn chưa xóa
DROP POLICY IF EXISTS "support_read_all_orders" ON public.orders;
CREATE POLICY "support_read_all_orders" ON public.orders
  FOR SELECT USING (
    deleted_at IS NULL AND public.has_global_role(ARRAY['SUPPORT'])
  );

-- shops: SUPPORT đọc tất cả shop
DROP POLICY IF EXISTS "support_read_all_shops" ON public.shops;
CREATE POLICY "support_read_all_shops" ON public.shops
  FOR SELECT USING (
    public.has_global_role(ARRAY['SUPPORT'])
  );

-- ── 5. AUDIT_LOGS: POLICY SELECT (v4 bật RLS nhưng CHƯA có policy đọc)
-- Hiện không ai đọc được audit_logs trừ service_role. Thêm SELECT.
DROP POLICY IF EXISTS "admins_read_audit_logs" ON public.audit_logs;
CREATE POLICY "admins_read_audit_logs" ON public.audit_logs
  FOR SELECT USING (
    public.has_global_role(ARRAY['SYSTEM_ADMIN', 'SUPPORT'])
  );

-- POLICY INSERT — BẮT BUỘC: lib/audit.ts ghi log bằng server client
-- (anon + cookies). Không có policy này thì RLS default deny và
-- logAuditEvent() fail IM LẶNG (Supabase không throw khi insert bị chặn).
-- Chỉ cho ghi row có user_id = chính mình → không mạo danh được.
DROP POLICY IF EXISTS "users_insert_own_audit_logs" ON public.audit_logs;
CREATE POLICY "users_insert_own_audit_logs" ON public.audit_logs
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Không thêm policy UPDATE/DELETE → audit_logs bất biến (RLS default deny).

-- ── 5b. SYSTEM_CONFIGS: POLICY SELECT cho key MFA ────────────────
-- lib/mfa.ts đọc system_configs bằng anon client. Nếu bảng không có
-- SELECT policy cho authenticated → data null → luôn fallback default
-- và tính "configurable" mất tác dụng mà không báo lỗi.
-- Chỉ mở đúng 2 key MFA, các config khác vẫn deny.
DROP POLICY IF EXISTS "authenticated_read_mfa_configs" ON public.system_configs;
CREATE POLICY "authenticated_read_mfa_configs" ON public.system_configs
  FOR SELECT TO authenticated USING (
    key IN ('mfa_required_roles', 'mfa_recommended_roles')
  );

-- ── 6. INDEX BỔ SUNG (nếu chưa có) cho truy vấn dashboard ────────
CREATE INDEX IF NOT EXISTS idx_orders_shop_id    ON public.orders(shop_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_deleted_at ON public.orders(deleted_at);
CREATE INDEX IF NOT EXISTS idx_shop_members_user ON public.shop_members(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);
```

> [!NOTE]
> **Không dùng lại** `get_my_role()` / `admin_users` / `admin_shop_permissions` / bảng
> `system_config` số ít trong plan gốc — tất cả đã thay bằng đối tượng schema thật.
> Audit ghi log qua bảng `audit_logs` thật (cột `user_id`, `action`, `target_resource`,
> `target_id`, `payload`, `ip_address`) — xem `lib/audit.ts` bên dưới đã cập nhật.

---

## Cấu trúc thư mục Next.js (Final)

```
admin-dashboard-v2/
│
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   │   ├── page.tsx              ← Login form
│   │   │   └── actions.ts            ← Server Action: signIn + rate limit
│   │   ├── login/mfa-verify/
│   │   │   ├── page.tsx              ← TOTP input
│   │   │   └── actions.ts            ← Server Action: challengeAndVerify
│   │   └── login/mfa-setup/
│   │       └── page.tsx              ← QR code enrollment (lần đầu)
│   │
│   ├── dashboard/
│   │   ├── layout.tsx                ← ⭐ Role check + MFA gating
│   │   ├── error.tsx                 ← Error boundary
│   │   ├── loading.tsx               ← Skeleton toàn trang
│   │   ├── page.tsx                  ← KPI Overview (Server Component)
│   │   │
│   │   ├── orders/
│   │   │   ├── page.tsx              ← Fetch + render (Server Component)
│   │   │   ├── loading.tsx
│   │   │   └── _components/
│   │   │       ├── orders-table.tsx  ← TanStack Table (Client Component)
│   │   │       └── order-columns.tsx ← Column definitions
│   │   │
│   │   ├── shops/
│   │   │   ├── page.tsx
│   │   │   ├── [shopId]/
│   │   │   │   └── page.tsx          ← Chi tiết shop (shop_admin truy cập được)
│   │   │   └── _components/
│   │   │       └── shops-table.tsx
│   │   │
│   │   ├── admins/                   ← master_admin only
│   │   │   ├── page.tsx
│   │   │   └── _components/
│   │   │       └── admins-table.tsx
│   │   │
│   │   ├── audit-logs/               ← master_admin + admin
│   │   │   └── page.tsx
│   │   │
│   │   └── settings/                 ← master_admin only
│   │       └── page.tsx
│   │
│   ├── unauthorized/
│   │   └── page.tsx
│   │
│   └── api/
│       └── admin/
│           └── export/
│               └── route.ts          ← CSV export (session-checked)
│
├── components/
│   ├── ui/                           ← shadcn/ui (auto-generated)
│   ├── data-table/
│   │   ├── data-table.tsx            ← Generic TanStack wrapper (Client)
│   │   ├── data-table-toolbar.tsx    ← Filter + Search (Client)
│   │   └── data-table-pagination.tsx
│   ├── auth/
│   │   ├── login-form.tsx
│   │   ├── mfa-form.tsx
│   │   └── mfa-setup-form.tsx
│   └── dashboard/
│       ├── sidebar.tsx               ← Role-aware navigation
│       ├── header.tsx                ← User info + MFA badge
│       ├── kpi-card.tsx
│       └── role-gate.tsx             ← Component-level role guard
│
├── utils/
│   └── supabase/
│       ├── client.ts                 ← Browser (anon key)
│       ├── server.ts                 ← Server (cookies + RLS)
│       ├── middleware.ts             ← updateSession helper
│       └── admin.ts                  ← Service Role (chỉ khi cần)
│
├── lib/
│   ├── audit.ts                      ← logAuditEvent() helper
│   ├── mfa.ts                        ← getMfaRequiredRoles() từ system_configs
│   └── permissions.ts               ← hasPermission(role, action) helper
│
├── types/
│   └── database.ts                   ← Generated Supabase types
│
├── middleware.ts                     ← updateSession() only
├── next.config.ts                    ← Security headers + CSP
└── .env.local                        ← KHÔNG commit
```

---

## Các file quan trọng — Code chi tiết

### `middleware.ts` (Final)

```typescript
import { type NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

### `app/dashboard/layout.tsx` (Final)

```typescript
import { redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/server'
import { getMfaRequiredRoles } from '@/lib/mfa'
import { Sidebar } from '@/components/dashboard/sidebar'
import { Header } from '@/components/dashboard/header'

type UiRole = 'master_admin' | 'admin' | 'shop_admin' | 'viewer'

// Resolve role qua RPC 2 tầng (user_roles → shop_members).
// Trả về { realRole, uiRole } — uiRole = null nghĩa là không có quyền dashboard.
// Nhận client từ ngoài để tái dùng 1 instance trong cả layout.
async function resolveRole(
  supabase: SupabaseClient,
): Promise<{ realRole: string; uiRole: UiRole | null }> {
  const { data } = await supabase.rpc('resolve_dashboard_role').single()
  return {
    realRole: (data?.real_role as string) ?? 'NONE',
    uiRole: (data?.ui_role as UiRole | null) ?? null,
  }
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { realRole, uiRole } = await resolveRole(supabase)

  // EXTENSION_USER / không role → không được vào dashboard
  if (!uiRole) redirect('/unauthorized')

  // MFA check — so khớp theo REAL role code từ system_configs
  const mfaRequiredRoles = await getMfaRequiredRoles(supabase)
  if (mfaRequiredRoles.includes(realRole)) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()

    if (aal?.currentLevel !== 'aal2') {
      // Phân biệt 2 trạng thái:
      //  - CHƯA enroll factor nào  → /login/mfa-setup  (test case #3)
      //  - Đã enroll, chưa verify  → /login/mfa-verify (test case #4)
      const { data: factors } = await supabase.auth.mfa.listFactors()
      const hasVerifiedFactor = (factors?.totp?.length ?? 0) > 0

      redirect(hasVerifiedFactor ? '/login/mfa-verify' : '/login/mfa-setup')
    }
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar role={uiRole} userId={user.id} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header user={user} role={uiRole} />
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
```

### `lib/mfa.ts` — Configurable MFA enforcement

```typescript
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/server'

// Trả về danh sách REAL role code (vd. ['SYSTEM_ADMIN']) bắt buộc MFA.
// system_configs.value đã là JSONB array → Supabase parse sẵn thành string[].
// Yêu cầu policy `authenticated_read_mfa_configs` (migration v10 §5b),
// nếu thiếu thì query trả null và hàm luôn rơi về default.
export async function getMfaRequiredRoles(
  client?: SupabaseClient,
): Promise<string[]> {
  const supabase = client ?? (await createClient())
  const { data, error } = await supabase
    .from('system_configs')
    .select('value')
    .eq('key', 'mfa_required_roles')
    .single()

  // Fail-closed: đọc config lỗi → giữ default an toàn nhất, và log để
  // không âm thầm mất tính configurable.
  if (error || !data) {
    console.error('[mfa] cannot read mfa_required_roles, using default', error)
    return ['SYSTEM_ADMIN']
  }

  return data.value as string[]
}
```

### `lib/permissions.ts` — Role-based permission helper

```typescript
type Role = 'master_admin' | 'admin' | 'shop_admin' | 'viewer'
type Action =
  | 'manage:admins'      // Tạo/xóa/sửa admin users
  | 'manage:shops'       // Tạo/xóa shops
  | 'manage:config'      // Sửa system_configs
  | 'write:orders'       // Sửa/xóa đơn hàng
  | 'read:audit_logs'    // Đọc audit logs
  | 'read:all_shops'     // Đọc mọi shop (không cần gán)
  | 'read:assigned_shops' // Đọc shop được gán

const PERMISSIONS: Record<Role, Action[]> = {
  master_admin: [
    'manage:admins', 'manage:shops', 'manage:config',
    'write:orders', 'read:audit_logs', 'read:all_shops',
  ],
  admin: [
    'write:orders', 'read:audit_logs', 'read:all_shops',
  ],
  shop_admin: [
    'write:orders', 'read:assigned_shops',
  ],
  viewer: [],
}

export function hasPermission(role: Role, action: Action): boolean {
  return PERMISSIONS[role]?.includes(action) ?? false
}
```

### `lib/audit.ts` — Audit logging

```typescript
import { createClient } from '@/utils/supabase/server'
import { headers } from 'next/headers'

// Cột khớp bảng audit_logs THẬT (v4): user_id, shop_id, action,
// target_resource, target_id, payload, ip_address, user_agent.
type AuditParams = {
  action: string          // 'DELETE_ORDER', 'CHANGE_ROLE', 'UPDATE_SHOP'
  targetResource: string  // tên bảng/entity: 'orders', 'shops', 'profiles'
  targetId?: string
  shopId?: string
  payload?: Record<string, unknown>
}

export async function logAuditEvent(params: AuditParams) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const headersList = await headers()

  // user_id BẮT BUỘC khớp auth.uid() — policy users_insert_own_audit_logs
  // (migration v10 §5) chặn mọi row khác. Không có user → không ghi.
  if (!user) return

  const { error } = await supabase.from('audit_logs').insert({
    user_id:         user.id,
    shop_id:         params.shopId ?? null,
    action:          params.action,
    target_resource: params.targetResource,
    target_id:       params.targetId,
    payload:         params.payload ?? {},
    ip_address:      headersList.get('x-forwarded-for') ?? 'unknown',
    user_agent:      headersList.get('user-agent') ?? 'unknown',
  })

  // KHÔNG throw: audit fail không được làm hỏng action chính.
  // Nhưng PHẢI log ra để không mất dấu im lặng khi RLS chặn.
  if (error) {
    console.error('[audit] insert failed', {
      action: params.action,
      target: `${params.targetResource}:${params.targetId ?? '-'}`,
      code: error.code,
      message: error.message,
    })
  }
}
```

### `next.config.ts` — Security Headers + CSP

```typescript
import type { NextConfig } from 'next'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

const securityHeaders = [
  { key: 'X-Frame-Options',           value: 'DENY' },
  { key: 'X-Content-Type-Options',    value: 'nosniff' },
  { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy',        value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      `connect-src 'self' ${SUPABASE_URL} wss://${new URL(SUPABASE_URL).hostname}`,
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob:",
      "frame-ancestors 'none'",
    ].join('; '),
  },
]

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }]
  },
}

export default nextConfig
```

---

## Phân quyền theo route (Summary)

| Route | `master_admin` | `admin` | `shop_admin` | `viewer` |
|-------|:-:|:-:|:-:|:-:|
| `/dashboard` (KPI) | ✅ | ✅ | ✅ | ✅ |
| `/dashboard/orders` | ✅ All | ✅ All | ✅ Assigned shops | ✅ Own |
| `/dashboard/shops` | ✅ All | ✅ All | ✅ Assigned | ❌ |
| `/dashboard/shops/[id]` | ✅ | ✅ | ✅ (nếu assigned) | ❌ |
| `/dashboard/admins` | ✅ | ✅ (read) | ❌ | ❌ |
| `/dashboard/audit-logs` | ✅ | ✅ | ❌ | ❌ |
| `/dashboard/settings` | ✅ | ❌ | ❌ | ❌ |

---

## MFA Enforcement Strategy

```
Login (email + password)
         │
         ▼
   getMfaRequiredRoles()   ← đọc từ system_configs (real role code)
         │
         ▼
   role IN required_roles?
    YES              NO
     │                │
     ▼                ▼
  getAAL()        → Dashboard
  aal2?
  NO    YES
   │     │
   ▼     ▼
/mfa  → Dashboard
-verify
```

**Bật MFA bắt buộc cho thêm role** (không cần deploy lại) — dùng REAL role code:
```sql
-- Ví dụ: bắt buộc thêm cho SUPPORT và SHOP_OWNER
UPDATE public.system_configs
SET value = '["SYSTEM_ADMIN", "SUPPORT", "SHOP_OWNER"]'::jsonb
WHERE key = 'mfa_required_roles';
```

---

## Environment Variables

```env
# .env.local — KHÔNG commit vào Git

# PUBLIC (an toàn vì có RLS)
NEXT_PUBLIC_SUPABASE_URL=https://xlgovgynbsahuykyjzcx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key_từ_supabase_dashboard>

# PRIVATE — TUYỆT ĐỐI không prefix NEXT_PUBLIC_
SUPABASE_SERVICE_ROLE_KEY=<service_role_key_từ_supabase_dashboard>

# Rate limiting (nếu dùng Upstash)
UPSTASH_REDIS_REST_URL=<url>
UPSTASH_REDIS_REST_TOKEN=<token>
```

---

## Thứ tự triển khai (9 Phases — Sẵn sàng thực thi)

| Phase | Nội dung | Output |
|-------|----------|--------|
| **1** | `create-next-app` + cài dependencies | Project skeleton |
| **2** | 3 Supabase clients + `.env.local` | `utils/supabase/` |
| **3** | `middleware.ts` với `updateSession` | Route protection |
| **4** | Migration v10 ADDITIVE: MFA config + RPC resolver + vá RLS (SUPPORT/audit) | Database ready |
| **5** | Login + MFA setup + MFA verify pages | Auth flow hoàn chỉnh |
| **6** | `dashboard/layout.tsx` — role check + MFA gating | Access control |
| **7** | Dashboard pages (Server Components) + TanStack Tables | Core features |
| **8** | Security headers + rate limiting + audit logging | Security hardened |
| **9** | Testing 14 test cases + Vercel deploy | Production ready |

---

## Security Test Cases (Verification)

| # | Test | Expected |
|---|------|----------|
| 1 | Truy cập `/dashboard` khi chưa login | Redirect `/login` |
| 2 | Login `EXTENSION_USER` / user không có role dashboard | Redirect `/unauthorized` |
| 3 | `SYSTEM_ADMIN` login nhưng chưa setup MFA | Redirect `/login/mfa-setup` |
| 4 | `SYSTEM_ADMIN` đã setup MFA nhưng skip verify | Redirect `/login/mfa-verify` |
| 5 | Inspect Network tab → tìm `SUPABASE_SERVICE_ROLE_KEY` | Không tìm thấy |
| 6 | SQL: `SET LOCAL role = anon; SELECT * FROM orders;` | 0 rows |
| 7 | Login sai password 6 lần/phút | HTTP 429 |
| 8 | Embed dashboard trong iframe | Bị block (X-Frame-Options: DENY) |
| 9 | `shop_admin` (SHOP_OWNER) cố truy cập `/dashboard/settings` | 403 / redirect |
| 10 | `viewer` (SHOP_STAFF) cố xem orders của shop khác | 0 rows (RLS filter) |
| 11 | Chủ shop (chỉ có row `shop_members`, KHÔNG có `user_roles`) login | `resolve_dashboard_role` trả `shop_admin`, vào được dashboard |
| 12 | `SUPPORT` xem `/dashboard/orders` | Thấy tất cả đơn (policy `support_read_all_orders`) |
| 13 | Gọi `logAuditEvent()` rồi query `audit_logs` | Row được ghi (policy `users_insert_own_audit_logs`), không có log `[audit] insert failed` |
| 14 | `UPDATE system_configs SET value='["SYSTEM_ADMIN","SUPPORT"]' WHERE key='mfa_required_roles'` → login `SUPPORT` | Bị gating MFA; không có log `[mfa] cannot read...` |
