# GEMINI_CODE_REWRITE_TASK_LIST.md

## Feature

Full system rewrite plan for Auto Fill Order commercial architecture.

Primary goal: turn the current browser extension and dashboard codebase into a clearer product with three separate surfaces:

- `index / panel`: worker order workspace
- `options`: shop control center
- `admin-dashboard`: SaaS control plane

## MVP Scope

MVP is Phase 1 plus Phase 2:

1. Remove dangerous production mock behavior.
2. Fix runtime/autofill errors that can break order scraping.
3. Stop fake success responses in admin mutations.
4. Confirm each surface owns the correct product responsibility.

Do not start large UI redesign work until MVP tasks are complete.

## Phase 1: Setup And Baseline

- [x] T001 Read `PLAN/GEMINI_CODE_FULL_REWRITE_PLAN.md` and confirm the intended product surfaces.
- [x] T002 Read `AUTO_FILL_ORDER_COMMERCIAL_UI_UX_MASTER_PLAN(1).md` and extract the required navigation groups for `index`, `options`, and `admin-dashboard`.
- [x] T003 Read `PLAN/DASHBOARD_PAGE_SPEC.md` and decide whether its dashboard belongs to `index / panel`, `options`, or `admin-dashboard`.
- [x] T004 Run `git status --short` and record unrelated user changes before editing.
- [x] T005 [P] Inspect `package.json` for available build, test, and sync scripts.
- [x] T006 [P] Inspect `vite.config.js` to confirm active app entry points.
- [x] T007 [P] Inspect `manifest.json` to confirm extension entry points and content scripts.
- [x] T008 Create a short implementation note in `PLAN/GEMINI_CODE_REWRITE_PROGRESS.md` listing confirmed surfaces, active entry points, and known dirty files.

## Phase 2: Foundational Risk Fixes

- [x] T009 Search for production mock order/customer fallbacks in `src/ui/panel/App.jsx`.
- [x] T010 Search for duplicated production mock order/customer fallbacks in `extension/src/ui/panel/App.jsx`.
- [x] T011 Remove or gate production mock fallback behavior in `src/ui/panel/App.jsx`.
- [x] T012 Mirror the safe fallback behavior in `extension/src/ui/panel/App.jsx` only if `extension/src` is still used as a runtime source.
- [x] T013 Add a non-production-only mock helper or explicit dev fixture file if the panel still needs demo data.
- [x] T014 Search for undefined runtime references in `src/runtime/content/index.js`, especially scrape/autofill variables.
- [x] T015 Fix the undefined `shipFeeBox` reference or replace it with a scoped DOM lookup in `src/runtime/content/index.js`.
- [x] T016 Mirror the runtime fix in `extension/src/runtime/content/index.js` only if `extension/src` is still used as a runtime source.
- [x] T017 Search for fake success responses in admin services, starting with `src/domain/admin/admin.service.js`.
- [x] T018 Replace admin mutation fake success behavior with a real repository update or an explicit unsupported/error response in `src/domain/admin/admin.service.js`.
- [x] T019 Add audit logging only after the real mutation succeeds in `src/domain/admin/admin.service.js`.
- [x] T020 Add admin authorization checks beyond logged-in session in `src/domain/admin/admin.service.js`.

## Phase 3: Tests For Risk Fixes

- [x] T021 [P] Add or update tests proving panel production flow does not inject fake customer/order data.
- [x] T022 [P] Add or update tests covering scrape behavior when shipping fee elements are absent.
- [x] T023 [P] Add or update tests proving admin plan mutation cannot return success without a real update.
- [x] T024 [P] Add or update tests proving non-admin users cannot perform admin-only mutations.
- [x] T025 Run the narrow test files added or modified for Phase 2.
- [x] T026 Record test command results in `PLAN/GEMINI_CODE_REWRITE_PROGRESS.md`.

## Phase 4: Surface Boundary Audit

- [x] T027 Inspect `src/ui/index/App.jsx` and map all current pages to the `index / panel` responsibility.
- [x] T028 Inspect `src/ui/options` and map all current pages to the `options` responsibility.
- [x] T029 Inspect `src/ui/admin-dashboard/App.jsx` and map all current pages to the `admin-dashboard` responsibility.
- [x] T030 Inspect legacy `admin-dashboard/admin.html` without reverting existing user edits.
- [x] T031 Inspect legacy `admin-dashboard/master-admin.js` without reverting existing user edits.
- [x] T032 Inspect legacy `admin-dashboard/shops-service.js` without reverting existing user edits.
- [x] T033 Create `PLAN/SURFACE_BOUNDARY_AUDIT.md` documenting pages that are correct, misplaced, duplicated, or missing.
- [x] T034 Move or rename only the smallest set of routes/components needed to stop obvious surface mixing.
- [x] T035 Update navigation labels so `index`, `options`, and `admin-dashboard` do not imply the same job.

## Phase 5: Index / Panel Tasks

- [x] T036 [US1] Confirm the panel dashboard only shows worker operations in `src/ui/panel/App.jsx`.
- [x] T037 [US1] Add clear loading, empty, error, and partial failure states to panel dashboard widgets.
- [x] T038 [US1] Ensure primary CTA remains create/review/fill order, not SaaS administration.
- [x] T039 [US1] Confirm AI review displays field confidence and requires review for low-confidence fields.
- [x] T040 [US1] Confirm address normalization output includes raw address, normalized address, province/ward, confidence, and source.
- [x] T041 [US1] Confirm autofill flow keeps the order: detect carrier -> find form -> fill -> verify.
- [x] T042 [US1] Add or update a smoke test for panel parse -> review -> autofill handoff.

## Phase 6: Options Tasks

- [x] T043 [US2] Confirm options navigation is grouped by shop, team, AI, address, carriers, order, sync, notifications, security, audit, and subscription.
- [x] T044 [US2] Ensure shop settings are separated from order execution UI.
- [x] T045 [US2] Ensure AI settings do not expose provider secrets in any browser UI.
- [x] T046 [US2] Ensure quota and usage display comes from real service contracts, not placeholder constants.
- [x] T047 [US2] Ensure carrier settings are per-shop and permission-aware.
- [x] T048 [US2] Ensure device/session actions are audited where applicable.
- [x] T049 [US2] Add or update tests for options permission-aware visibility.

## Phase 7: Admin Dashboard Tasks

- [x] T050 [US3] Confirm admin overview answers system health, active shops, errors, AI health, quota risk, subscription risk, and MRR.
- [x] T051 [US3] Ensure admin shop management does not arbitrarily modify customer business data.
- [x] T052 [US3] Ensure support access or impersonation is explicit, time-limited, and audited.
- [x] T053 [US3] Ensure feature flags support global, plan, shop, and user scopes.
- [x] T054 [US3] Ensure address dataset publishing uses validate -> preview diff -> test -> publish -> monitor -> rollback.
- [x] T055 [US3] Ensure admin health views include Supabase, Auth, RLS, AI gateway, provider, sync, and carrier health.
- [x] T056 [US3] Add or update tests for admin authorization and sensitive action audit.

## Phase 8: Runtime And Carrier Refactor

- [x] T057 Identify parser responsibilities inside `src/runtime/content/index.js`.
- [x] T058 Identify DOM automation responsibilities inside `src/runtime/content/index.js`.
- [x] T059 Identify state, observer, and fetch interception responsibilities inside `src/runtime/content/index.js`.
- [x] T060 Create a minimal extraction plan in `PLAN/RUNTIME_CONTENT_REFACTOR_PLAN.md`.
- [x] T061 Extract carrier detection helpers from `src/runtime/content/index.js` into a focused module if current imports allow it.
- [x] T062 Extract VNPost-specific selectors/fill behavior into a focused module if current imports allow it.
- [x] T063 Extract J&T-specific selectors/fill behavior into a focused module if current imports allow it.
- [x] T064 Keep public message/event contracts stable after runtime extraction.
- [x] T065 Add or update smoke tests for VNPost runtime behavior.
- [x] T066 Add or update smoke tests for J&T runtime behavior.

## Phase 9: Source Duplication And Build Flow

- [x] T067 Confirm whether `src` or `extension/src` is the source of truth.
- [x] T068 Inspect `scripts/sync-extension.js` or equivalent sync script.
- [x] T069 Document the selected source-of-truth rule in `PLAN/GEMINI_CODE_REWRITE_PROGRESS.md`.
- [x] T070 If `src` is source of truth, ensure `extension/src` is treated as generated/synced output.
- [x] T071 If both trees are required, create a clear sync checklist and avoid manual drift.
- [x] T072 Run the extension sync script if required by the selected source-of-truth rule.

## Phase 10: Test Suite Repair

- [x] T073 Inspect `tests/reports/TEST-RESULTS.json` for stale path failures.
- [x] T074 Search tests for old paths such as `src/backend` and `backend/content/index.js`.
- [x] T075 Update stale imports to current paths such as `src/domain` and `src/runtime`.
- [x] T076 Fix dependency or optional native binding issues that block `npm test`.
- [x] T077 Run `npm test` and capture failures.
- [x] T078 Run the narrow security tests if available.
- [x] T079 Run `npm run build` and capture build status.
- [x] T080 Record remaining test/build blockers in `PLAN/GEMINI_CODE_REWRITE_PROGRESS.md`.

## Phase 11: Security And Tenant Hardening

- [x] T081 Search all business data queries for explicit or implicit `shop_id` scope.
- [x] T082 Search all mutations for membership/role checks.
- [x] T083 Verify frontend-provided `shop_id` is not trusted as the authorization boundary.
- [x] T084 Verify Supabase RLS policies cover orders, customers, usage, audit, subscriptions, and devices.
- [x] T085 Verify sensitive actions write audit records with actor, action, target, before, after, reason, and timestamp.
- [x] T086 Add or update tests for shop isolation.
- [x] T087 Add or update tests for role-based access.

## Phase 12: Product Quality And Error Handling

- [x] T088 Standardize machine-readable error codes for AI, address, carrier, sync, and auth errors.
- [x] T089 Replace raw provider errors with user-safe Vietnamese messages.
- [x] T090 Ensure AI failure degrades to manual parser, local address engine, and manual review.
- [x] T091 Ensure cloud failure degrades to local mode, outbox, and later sync.
- [x] T092 Add visible retry paths for recoverable errors in panel, options, and admin.
- [x] T093 Add or update tests for graceful degradation paths.

## Phase 13: Manual Verification

- [ ] T094 Reload unpacked extension in browser after build/sync. BLOCKED in terminal: requires a browser extension reload session.
- [ ] T095 Verify VNPost flow manually: paste order -> parse -> review -> autofill -> verify. BLOCKED: requires logged-in VNPost page.
- [ ] T096 Verify J&T flow manually: paste order -> parse -> review -> autofill -> verify. BLOCKED: requires logged-in J&T page.
- [ ] T097 Verify low-confidence address requires review before autofill. BLOCKED: requires live extension panel/manual browser run.
- [ ] T098 Verify offline/cloud failure does not make the extension unusable. BLOCKED: requires live browser extension runtime.
- [ ] T099 Verify admin user can access admin dashboard and normal shop user cannot. BLOCKED: requires Supabase test credentials.
- [ ] T100 Verify options pages respect role and shop scope. BLOCKED: requires Supabase test credentials/browser session.

## Phase 14: Final Documentation

- [x] T101 Update `PLAN/GEMINI_CODE_REWRITE_PROGRESS.md` with completed phases and remaining blockers.
- [x] T102 Update `PLAN/SURFACE_BOUNDARY_AUDIT.md` with final surface decisions.
- [x] T103 Add a final verification summary listing test commands, build status, and manual checks.
- [x] T104 Add a release-risk note for any remaining non-blocking issues.
- [x] T105 Confirm no unrelated user changes were reverted.

## Dependencies

Phase order:

1. Phase 1 must finish before any code edits.
2. Phase 2 must finish before surface UI redesign.
3. Phase 3 should run immediately after Phase 2.
4. Phase 4 must finish before major page moves.
5. Phases 5, 6, and 7 can run after Phase 4.
6. Phase 8 should wait until high-risk runtime bugs are fixed.
7. Phase 9 must happen before broad duplicated-source edits.
8. Phase 10 should happen before final hardening.
9. Phases 11 and 12 can run after contracts are stable.
10. Phase 13 and Phase 14 close the work.

## Parallel Opportunities

- T005, T006, and T007 can run in parallel.
- T021, T022, T023, and T024 can run in parallel.
- T027, T028, and T029 can run in parallel.
- T043 through T048 can be split by Options subpage.
- T050 through T055 can be split by Admin domain.
- T065 and T066 can run in parallel after runtime contracts are stable.
- T081 through T085 can be audited in parallel by domain area.

## Independent Test Criteria

### US1: Worker order workspace

Passes when a staff user can parse, review, autofill, and verify an order without fake data and without touching admin/shop configuration screens.

### US2: Shop control center

Passes when an owner/manager can configure shop, team, AI, carrier, sync, security, and subscription settings while staff users cannot access restricted configuration.

### US3: SaaS control plane

Passes when a system admin can monitor shops, users, subscriptions, AI health, feature flags, address datasets, carrier health, support, audit, and releases without crossing into ordinary shop operations.

## Done Definition

- All task items that are in MVP scope are complete.
- Production mock fallbacks are removed or gated to development-only fixtures.
- Runtime scrape/autofill no longer depends on undefined variables.
- Admin mutations do not return fake success.
- Surface ownership is documented.
- Tests and build status are recorded.
- VNPost and J&T are manually verified.
