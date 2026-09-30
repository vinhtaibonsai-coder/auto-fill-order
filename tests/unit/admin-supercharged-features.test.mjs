import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');
const readSource = (relPath) => fs.readFileSync(path.join(rootDir, relPath), 'utf8');

// 1. Migration SQL check
const migrationSql = readSource('database/migrations/v96_admin_commercial_supercharged.sql');
assert.match(migrationSql, /CREATE TABLE IF NOT EXISTS public\.license_keys/i, 'Must create license_keys table');
assert.match(migrationSql, /CREATE TABLE IF NOT EXISTS public\.payment_transactions/i, 'Must create payment_transactions table');
assert.match(migrationSql, /CREATE TABLE IF NOT EXISTS public\.system_webhooks/i, 'Must create system_webhooks table');
assert.match(migrationSql, /CREATE OR REPLACE FUNCTION (public\.)?admin_generate_license_keys/i, 'Must define admin_generate_license_keys RPC');
assert.match(migrationSql, /CREATE OR REPLACE FUNCTION (public\.)?apply_license_key/i, 'Must define apply_license_key RPC');
assert.match(migrationSql, /CREATE OR REPLACE FUNCTION (public\.)?process_payment_webhook/i, 'Must define process_payment_webhook RPC');
assert.match(migrationSql, /CREATE OR REPLACE FUNCTION (public\.)?admin_get_global_orders/i, 'Must define admin_get_global_orders RPC');
assert.match(migrationSql, /AF-/i, 'License key format must follow AF- prefix');

// 2. Admin Repository check
const repoSrc = readSource('src/domain/admin/admin.repository.js');
assert.match(repoSrc, /getGlobalOrders\s*\(/, 'AdminRepository must implement getGlobalOrders');
assert.match(repoSrc, /generateLicenseKeys\s*\(/, 'AdminRepository must implement generateLicenseKeys');
assert.match(repoSrc, /getLicenseKeys\s*\(/, 'AdminRepository must implement getLicenseKeys');
assert.match(repoSrc, /getPaymentTransactions\s*\(/, 'AdminRepository must implement getPaymentTransactions');
assert.match(repoSrc, /applyLicenseKey\s*\(/, 'AdminRepository must implement applyLicenseKey');
assert.match(repoSrc, /getSystemWebhooks\s*\(/, 'AdminRepository must implement getSystemWebhooks');
assert.match(repoSrc, /saveSystemWebhook\s*\(/, 'AdminRepository must implement saveSystemWebhook');

// 3. Admin Service check
const serviceSrc = readSource('src/domain/admin/admin.service.js');
assert.match(serviceSrc, /_ensureAdmin\s*\(\s*allowSupport\s*=\s*false\s*\)/, 'AdminService must accept allowSupport in _ensureAdmin');
assert.match(serviceSrc, /SUPPORT_STAFF/, 'AdminService must recognize SUPPORT_STAFF role');
assert.match(serviceSrc, /getGlobalOrders\s*\(/, 'AdminService must implement getGlobalOrders');
assert.match(serviceSrc, /generateLicenseKeys\s*\(/, 'AdminService must implement generateLicenseKeys');
assert.match(serviceSrc, /getLicenseKeys\s*\(/, 'AdminService must implement getLicenseKeys');
assert.match(serviceSrc, /getPaymentTransactions\s*\(/, 'AdminService must implement getPaymentTransactions');
assert.match(serviceSrc, /applyLicenseKey\s*\(/, 'AdminService must implement applyLicenseKey');
assert.match(serviceSrc, /getSystemWebhooks\s*\(/, 'AdminService must implement getSystemWebhooks');
assert.match(serviceSrc, /saveSystemWebhook\s*\(/, 'AdminService must implement saveSystemWebhook');
assert.match(serviceSrc, /sendTestWebhook\s*\(/, 'AdminService must implement sendTestWebhook');

// 4. GlobalOrders UI check
const globalOrdersSrc = readSource('src/ui/admin-dashboard/pages/GlobalOrders/GlobalOrders.jsx');
assert.match(globalOrdersSrc, /Tra Cứu Đơn Hàng Toàn Cục/, 'GlobalOrders must render title');
assert.match(globalOrdersSrc, /Read-Only/i, 'GlobalOrders must declare read-only audit status');
assert.doesNotMatch(globalOrdersSrc, /deleteOrder|deleteSubmittedOrder|handleDeleteOrder/, 'GlobalOrders must not contain deletion actions');

// 5. LicenseKeys UI check
const licenseKeysSrc = readSource('src/ui/admin-dashboard/pages/LicenseKeys/LicenseKeys.jsx');
assert.match(licenseKeysSrc, /Sinh Mã Bản Quyền/, 'LicenseKeys must provide batch key generation');
assert.match(licenseKeysSrc, /Biến Động Số Dư SePay/, 'LicenseKeys must provide SePay transactions tab');
assert.match(licenseKeysSrc, /AF (&lt;|<)MÃ_SHOP(&gt;|>)/i, 'LicenseKeys must explain SePay syntax AF <SHOP_CODE>');

// 6. SystemHealth Generic Webhook check
const healthSrc = readSource('src/ui/admin-dashboard/pages/SystemHealth/SystemHealth.jsx');
assert.match(healthSrc, /Cảnh Báo Sự Cố Đa Kênh \(Generic Webhooks\)/, 'SystemHealth must have Generic Webhooks card');
assert.match(healthSrc, /handleTestPingWebhook/, 'SystemHealth must have test ping handler');
assert.match(healthSrc, /handleSaveWebhook/, 'SystemHealth must have save webhook handler');

// 7. Sidebar & RoleGuard check
const sidebarSrc = readSource('src/ui/admin-dashboard/components/Sidebar.jsx');
assert.match(sidebarSrc, /id:\s*'global-orders'/, 'Sidebar must contain global-orders menu item');
assert.match(sidebarSrc, /id:\s*'license-keys'/, 'Sidebar must contain license-keys menu item');
assert.match(sidebarSrc, /isSupportStaff\s*\?\s*['"]Support Staff \(CSKH\)['"]/, 'Sidebar must render Support Staff role indicator');
assert.match(sidebarSrc, /visibleItems\s*=/, 'Sidebar must filter adminOnly items for support staff');

// 8. App.jsx RoleGuard check
const appSrc = readSource('src/ui/admin-dashboard/App.jsx');
assert.match(appSrc, /'global-orders':\s*GlobalOrders/, 'App.jsx must register GlobalOrders');
assert.match(appSrc, /'license-keys':\s*LicenseKeys/, 'App.jsx must register LicenseKeys');
assert.match(appSrc, /ADMIN_ONLY_TABS/, 'App.jsx must declare ADMIN_ONLY_TABS');
assert.match(appSrc, /userRole === 'SUPPORT_STAFF' \? null :[\s\S]*<FastOperationsHub/, 'App.jsx must hide FastOperationsHub for support staff');

// 9. Subscription Options check
const subSrc = readSource('src/ui/options/pages/Subscription/Subscription.jsx');
assert.match(subSrc, /apply_license_key/, 'Subscription must invoke apply_license_key RPC');
assert.match(subSrc, /AF-98X2-K9L1-M4N3/, 'Subscription must show AF-XXXX-YYYY-ZZZZ placeholder');

console.log('✅ ALL ADMIN COMMERCIAL SUPERCHARGED TESTS PASSED (100%)');
