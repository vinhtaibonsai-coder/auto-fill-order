import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');
const readSource = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), 'utf8');

const rlsMatrix = readSource('database/RLS_MATRIX.md');
const strictOrders = readSource('database/migrations/v48_strict_order_isolation.sql');
const baseline = readSource('database/migrations/001_baseline_commercial_schema.sql');
const aiQuotas = readSource('database/migrations/v30_fix_missing_shop_quotas.sql');
const deviceManagement = readSource('database/migrations/v18_device_management.sql');
const auditSupport = readSource('database/migrations/v35_real_data_support.sql');
const adminHardening = readSource('database/migrations/v63_admin_control_plane_hardening.sql');
const aiGateway = readSource('supabase/functions/ai-gateway/index.ts');
const adminService = readSource('src/domain/admin/admin.service.js');
const adminRepository = readSource('src/domain/admin/admin.repository.js');
const rlsIntegration = readSource('tests/security/rls-isolation.test.mjs');
const aiIntegration = readSource('tests/security/ai-gateway.test.mjs');

for (const table of ['orders', 'submitted_orders', 'history']) {
  assert.match(strictOrders, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`), `${table} must have RLS enabled`);
  assert.match(strictOrders, new RegExp(`ON public\\.${table}[\\s\\S]*public\\.is_shop_member\\(shop_id\\)`), `${table} policies must scope by shop membership`);
}

for (const table of ['customers', 'subscriptions', 'shop_quotas', 'devices', 'ai_usage_log', 'audit_logs']) {
  assert.match(baseline, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`), `${table} must have RLS enabled in the commercial baseline`);
}

assert.match(baseline, /CREATE POLICY "Shop members access customers" ON public\.customers[\s\S]*is_shop_member\(shop_id\)/, 'Customers must be tenant-scoped by shop membership');
assert.match(baseline, /CREATE POLICY "Shop owners read audit logs" ON public\.audit_logs[\s\S]*is_shop_owner_or_manager\(shop_id\)/, 'Audit logs must be shop-scoped for shop owners/managers');
assert.match(aiQuotas, /IF NOT public\.check_shop_member_or_admin\(p_shop_id\) THEN/, 'AI quota consumption must verify shop membership server-side');
assert.match(aiQuotas, /IF NOT public\.check_shop_member_or_admin\(v_shop_id\) THEN/, 'AI budget reads must verify shop membership server-side');
assert.match(deviceManagement, /CREATE POLICY "Users can read own devices" ON public\.extension_devices[\s\S]*user_id = auth\.uid\(\)/, 'Device reads must be scoped to the owning user');
assert.match(deviceManagement, /IF NOT public\.is_system_admin\(\) THEN/, 'Device admin RPCs must be SYSTEM_ADMIN guarded');

assert.match(aiGateway, /shop_id.*KH[^\n]+tin c[^\n]+y/i, 'AI gateway must document that frontend-provided shop_id is not trusted');
assert.match(aiGateway, /\.from\('shop_members'\)[\s\S]*\.eq\('user_id', userId\)[\s\S]*\.eq\('shop_id', shopId\)/, 'AI gateway must verify requested shop membership');
assert.match(aiGateway, /\.eq\('roles\.code', 'SYSTEM_ADMIN'\)/, 'AI gateway must only allow SYSTEM_ADMIN to bypass shop membership');
assert.match(aiGateway, /userClient\.rpc\('consume_ai_quota', \{[\s\S]*p_shop_id: shopId/, 'AI gateway must consume quota through the user-scoped RPC');

for (const action of [
  'ADMIN_CHANGE_PLAN',
  'ADMIN_UPDATE_SHOP_STATUS',
  'ADMIN_UPDATE_SHOP_FLAGS',
  'ADMIN_UPDATE_FEATURE_FLAG',
  'ADDRESS_DATASET_PUBLISH',
  'ADDRESS_DATASET_ROLLBACK',
  'ADMIN_REVOKE_DEVICE',
  'REVOKE_DEVICE'
]) {
  const combined = `${adminService}\n${adminRepository}\n${adminHardening}\n${deviceManagement}`;
  assert.match(combined, new RegExp(action), `Sensitive action ${action} must be audited`);
}

assert.match(adminRepository, /p_details:\s*\{[\s\S]*before_state[\s\S]*after_state[\s\S]*result/, 'Admin audit details must include before/after/result');
assert.match(auditSupport, /INSERT INTO public\.audit_logs \(shop_id, user_id, action, entity_type, entity_id, details\)/, 'Audit RPC must record actor, target, action, details, and timestamp via audit_logs.created_at');
assert.match(adminHardening, /reason', p_reason/, 'Dataset publish/rollback audit must preserve the operator reason');

assert.match(rlsMatrix, /orders \| member of shop|orders \| member c/i, 'RLS matrix must document order isolation');
assert.match(rlsIntegration, /CROSS-SHOP SELECT denied/, 'Integration security test must cover cross-shop select denial');
assert.match(rlsIntegration, /admin_list_users guard/, 'Integration security test must cover role-based admin RPC denial');
assert.match(aiIntegration, /Gateway rejects cross-shop access/, 'AI gateway integration test must cover cross-shop denial');

console.log('Phase 11 security tenant tests passed.');
