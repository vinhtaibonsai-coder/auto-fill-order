import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');
const readSource = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), 'utf8');

const adminService = readSource('src/domain/admin/admin.service.js');
const adminRepository = readSource('src/domain/admin/admin.repository.js');
const overview = readSource('src/ui/admin-dashboard/pages/Overview/Overview.jsx');
const shopList = readSource('src/ui/admin-dashboard/pages/Shops/ShopList.jsx');
const featureFlags = readSource('src/ui/admin-dashboard/pages/Features/FeatureFlags.jsx');
const addressDataset = readSource('src/ui/admin-dashboard/pages/Address/AddressDataset.jsx');
const systemHealth = readSource('src/ui/admin-dashboard/pages/SystemHealth/SystemHealth.jsx');
const masterAdmin = readSource('admin-dashboard/master-admin.js');
const shopDashboard = readSource('admin-dashboard/app.js');
const migration = readSource('database/migrations/v63_admin_control_plane_hardening.sql');

assert.match(adminService, /roles\.code === 'SYSTEM_ADMIN'/, 'Admin service must only allow SYSTEM_ADMIN for admin control-plane calls');
assert.doesNotMatch(adminService, /admin@luathuysinh\.vn|roles\.code === 'SUPPORT'|roles\.code === 'ADMIN'/, 'Admin service must not keep support/admin email bypasses');

for (const metric of ['shops_total', 'shops_active', 'ai_errors_today', 'quota_risk_count', 'subscription_risk_count', 'mrr']) {
  assert.match(overview, new RegExp(metric), `Overview must expose ${metric}`);
}

assert.match(shopList, /updateShopStatus/, 'Shop management may update shop status through the admin service');
assert.match(shopList, /updateShopFeatureFlags/, 'Shop management may update scoped AI feature settings');
assert.doesNotMatch(shopList, /\.from\(['"]orders['"]\)\.update|\.from\(['"]submitted_orders['"]\)\.update|\.from\(['"]customers['"]\)\.update/, 'Shop management must not directly mutate customer business data');

assert.match(masterAdmin, /admin_start_impersonation/, 'Support impersonation must go through the audited RPC');
assert.match(masterAdmin, /p_reason:\s*reason\.trim\(\)/, 'Support impersonation must require an explicit reason');
assert.match(shopDashboard, /30 \* 60 \* 1000/, 'Support impersonation must be time-limited to 30 minutes');
assert.match(shopDashboard, /impersonation_started_at/, 'Support impersonation must persist and check start time');

for (const scope of ['scope_type', 'shop_id', 'user_id', 'plan_code']) {
  assert.match(featureFlags, new RegExp(scope), `Feature flags UI must support ${scope}`);
  assert.match(migration, new RegExp(scope), `Feature flags schema must support ${scope}`);
}
assert.match(migration, /feature_flags_scope_type_check/, 'Feature flag scopes must be constrained in the database');

for (const step of ['validate', 'preview', 'test', 'publish', 'monitor', 'rollback']) {
  assert.match(addressDataset.toLowerCase(), new RegExp(step), `Address release workflow must include ${step}`);
}
assert.match(addressDataset, /activateAddressDataset/, 'Address release UI must use the transactional activation RPC through AdminService');
assert.match(adminService, /activateAddressDataset/, 'Admin service must expose address dataset activation');
assert.match(adminRepository, /rpc\/activate_address_dataset/, 'Admin repository must call activate_address_dataset RPC');
assert.match(migration, /CREATE OR REPLACE FUNCTION public\.activate_address_dataset/, 'Address release RPC must exist');
assert.match(migration, /SECURITY DEFINER/, 'Sensitive admin RPCs must be SECURITY DEFINER');
assert.match(migration, /IF NOT public\.is_system_admin\(\)/, 'Sensitive admin RPCs must guard SYSTEM_ADMIN');
assert.match(migration, /insert_audit_log/, 'Address dataset release must write audit logs');
assert.match(migration, /UPDATE public\.address_dataset_versions SET is_active = false/, 'Address dataset release must deactivate previous production version transactionally');
assert.match(migration, /SET is_active = true, published_at = now\(\)/, 'Address dataset release must activate the selected version transactionally');

for (const status of ['supabase_status', 'auth_status', 'rls_status', 'sync_status', 'ai_gateway_status', 'provider_status', 'carriers']) {
  assert.match(systemHealth, new RegExp(status), `System health UI must show ${status}`);
  assert.match(migration, new RegExp(status), `System health RPC must return ${status}`);
}

console.log('Phase 7 admin control-plane tests passed.');
