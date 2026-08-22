# GEMINI_CODE_REWRITE_PROGRESS.md

## Confirmed Surfaces and Roles
1. `index / panel`: Operational order workspace. Mainly used by staff. Primary entry point: `index.html` (main) and extension panel loaded via content scripts.
2. `options`: Shop control center. Mainly used by Owner/Manager. Primary entry point: `frontend/options/options.html`.
3. `admin-dashboard`: SaaS control plane. Mainly used by System Admin. Primary entry point: `admin-dashboard/admin.html` (admin).

## Active Entry Points and Configs
- **Vite entry points**: `index.html` (main page) and `admin-dashboard/admin.html` (admin page).
- **Extension content script files**: Defined in `manifest.json` under `content_scripts`, containing config files, supabase configs, domain auth/permissions services, address normalization engines, carrier autofill adapters, order-parser, and UI/panel loaders, leading to `src/runtime/content/index.js`.
- **Extension sync script**: `sync:ext` script in `package.json` copies manifest, frontend, and source files into the `extension` folder.

## Known Dirty Files (Git Status)
- `admin-dashboard/admin.html` (modified)
- `admin-dashboard/master-admin.js` (modified)
- `admin-dashboard/shops-service.js` (modified)

## Completed Milestones
### Phase 1: Setup And Baseline (Completed)
- Surfaces confirmed: `index / panel`, `options`, `admin-dashboard`.
- Analyzed and verified all entry points in `vite.config.js`, `manifest.json`, and `package.json`.

### Phase 2: Foundational Risk Fixes (Completed)
- Gated mock fallback in `src/ui/panel/App.jsx` to localhost/127.0.0.1 development only. In production, panel gracefully degrades using local parsed data.
- Fixed undefined `shipFeeBox` in `src/runtime/content/index.js` by explicitly scoping and querying the checkbox element from DOM.
- Implemented real database mutation in `AdminRepository.updateShopPlan` and connected it to `AdminService.updateShopPlan`.
- Added strict authorization check in `AdminService._ensureAdmin` verifying `SYSTEM_ADMIN` role against `user_roles`.
- Synced all modifications to the `extension/` bundle.

### Phase 3: Tests For Risk Fixes (Completed)
- Created automated test suite `tests/unit/phase2-risk-fixes.test.mjs` verifying:
  - T021: Production panel flow does not inject fake customer/order data. (PASS)
  - T022: Scrape behavior safely declares `shipFeeBox` before access. (PASS)
  - T023: Admin plan mutation performs a real database repository update. (PASS)
  - T024: Non-admin users are blocked from admin mutations. (PASS)
- Ran complete system test runner `node tests/run-tests.js` (45/45 tests PASSED).

