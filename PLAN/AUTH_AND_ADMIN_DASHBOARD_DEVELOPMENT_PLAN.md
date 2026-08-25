# Auth And Admin Dashboard Development Plan

## 1. Current Admin Dashboard Deployment Mapping

### What exists now

- React admin entry: `admin.html`
- React admin app mount: `src/ui/admin-dashboard/index.jsx`
- Vite build input: `admin: 'admin.html'` in `vite.config.js`
- Production build output: `dist/admin.html`
- Extension legacy admin page: `admin-dashboard/admin.html`

### What is configured now

- Vercel is the primary production target via root `vercel.json`.
- Build command: `npm run build`
- Output directory: `dist`
- Production deploy command: `npm run deploy:vercel`
- Preview deploy command: `npm run deploy:vercel:preview`
- Clean routes:
  - `/admin` -> `/admin.html`
  - `/options` -> `/options.html`
  - `/workspace` -> `/index.html`
- Direct HTML routes remain valid:
  - `/admin.html`
  - `/options.html`
  - `/index.html`

### Practical conclusion

The admin dashboard is now **buildable and Vercel-deployable** from this workspace.

Deploy the Vite output and open:

- `/admin` for SaaS Admin Dashboard
- `/options` for Shop Control Center
- `/workspace` for Worker Order Workspace

If used inside the extension only, keep `admin-dashboard/admin.html` as a legacy extension page, but the preferred React control plane is the root `admin.html` entry.

## 2. Primary Deployment Direction

### Vercel

Deploy the root Vite app to Vercel:

- Build command: `npm run build`
- Output directory: `dist`
- Admin URL: `https://<domain>/admin`
- Options URL: `https://<domain>/options`
- Worker URL: `https://<domain>/workspace`

Local commands:

```bash
npm run build
npm run deploy:vercel:preview
npm run deploy:vercel
```

`vite.config.js` already disables the CRX plugin when `VERCEL` env is set:

```js
const isVercel = Boolean(process.env.VERCEL)
!isVercel && crx({ manifest })
```

This means Vercel builds avoid extension-only CRX behavior.

### Required Vercel project settings

- Framework preset: Vite
- Build command: `npm run build`
- Output directory: `dist`
- Install command: `npm install`
- Environment variables:
  - `VERCEL=1` is set by Vercel automatically.
  - No Supabase service role key should be configured in frontend Vercel env.
  - Supabase URL/Anon Key are configured inside the app through Server Connection, unless later replaced with public build env.

### Keep Extension Packaging Separate

Use:

```bash
npm run sync:ext
```

for the unpacked Chrome extension folder.

## 3. Auth Model To Use Across The Whole System

### Standard flow

1. Login
   - Supabase returns `access_token`, `refresh_token`, `expires_in`, and user data.
   - Store session in `chrome.storage.local` under `vnpost_session`.

2. API calls
   - Always call `AuthSession.getSession()`.
   - `getSession()` refreshes token if it expires within 5 minutes.
   - Use `Authorization: Bearer <access_token>`.

3. Refresh
   - Use `/auth/v1/token?grant_type=refresh_token`.
   - Replace both access token and refresh token.
   - If refresh is rejected with 400/401/403 or invalid refresh token, clear local session and force login.

4. Logout
   - Call Supabase `/auth/v1/logout` with current access token.
   - Then clear local session and local compatibility keys.
   - Broadcast logout through `AuthEvents` and extension messages.

5. Device revoke
   - Continue checking current device status.
   - If revoked, clear local session.
   - Long term: add a server-side session/device version check in protected RPCs.

## 4. Implemented In This Pass

- Removed hard-coded Supabase URL/Anon Key fallback from `src/domain/auth/auth.session.js`.
- `AuthSession` now loads Supabase config dynamically via `SupabaseCloud.loadConfig()` or `SUPABASE_CONFIG`.
- Refresh token rejection now clears local session.
- `AuthService.logout()` now attempts Supabase `/auth/v1/logout` before clearing local session.
- `SupabaseCloud.signOut()` now attempts Supabase `/auth/v1/logout`.
- Added `tests/unit/auth-token-lifecycle.test.mjs`.

## 5. Next Development Phases

### Phase A: Auth hardening

- Add a user-visible "session expired" state on Options and Panel.
- Add a single `authFetch()` helper that always refreshes session and attaches headers.
- Replace scattered manual `fetch(... Authorization ...)` calls in Options/Admin with `authFetch()`.
- Add logout-all-devices RPC for owner/admin flows.

### Phase B: Admin deploy hardening

- Vercel is selected as the primary production hosting target.
- Add Vercel project/team/domain IDs after the first real deployment.
- Add route protection for `/admin.html` so only `SYSTEM_ADMIN` can enter.
- Add a deployment smoke test checklist.

### Phase C: Supabase schema drift cleanup

- Standardize order columns on `name` or `customer_name`, not both.
- Add compatibility views if older databases cannot migrate immediately.
- Fix missing RPCs observed from the browser console, especially `owner_get_members_v2`.

### Phase D: Browser verification

- Reload unpacked extension.
- Verify login, token refresh, logout, and device revoke.
- Verify `/admin.html` with system admin and normal shop user.
- Verify Options `Đơn đã lên` and Overview against the live Supabase database.

## 6. Release Risks

- Server-side refresh token revocation depends on Supabase Auth behavior. Local logout is safe even if network revoke fails.
- Browser extension storage is not as protected as HttpOnly cookies; keep refresh token exposure minimized.
- Admin deployment target is Vercel, but the production project/domain must still be linked in the Vercel account.
- Live Supabase has schema/RPC drift according to recent console errors; deploy migrations before release.
