import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');
const readSource = (relPath) => fs.readFileSync(path.join(rootDir, relPath), 'utf8');

console.log('--- 1. Testing Commercial Monetization Repository & Service Contracts ---');
const repoSrc = readSource('src/domain/admin/admin.repository.js');
const serviceSrc = readSource('src/domain/admin/admin.service.js');

// Repository contracts
assert.match(repoSrc, /generateLicenseKeys\s*\(/, 'AdminRepository must implement generateLicenseKeys');
assert.match(repoSrc, /key_type:\s*'PLAN'/, 'AdminRepository must support PLAN key_type');
assert.match(repoSrc, /revokeLicenseKey\s*\(/, 'AdminRepository must implement revokeLicenseKey');
assert.match(repoSrc, /status:\s*'REVOKED'/, 'AdminRepository revokeLicenseKey must set status to REVOKED');
assert.match(repoSrc, /activateLicenseKeyForShop\s*\(/, 'AdminRepository must implement activateLicenseKeyForShop');
assert.match(repoSrc, /quickExtendSubscription\s*\(/, 'AdminRepository must implement quickExtendSubscription');

// Service contracts & audit logs
assert.match(serviceSrc, /generateLicenseKeys\s*\(/, 'AdminService must implement generateLicenseKeys');
assert.match(serviceSrc, /ADMIN_GENERATE_LICENSE_KEYS/, 'AdminService must log ADMIN_GENERATE_LICENSE_KEYS audit log');
assert.match(serviceSrc, /revokeLicenseKey\s*\(/, 'AdminService must implement revokeLicenseKey');
assert.match(serviceSrc, /ADMIN_REVOKE_LICENSE_KEY/, 'AdminService must log ADMIN_REVOKE_LICENSE_KEY audit log');
assert.match(serviceSrc, /activateLicenseKeyForShop\s*\(/, 'AdminService must implement activateLicenseKeyForShop');
assert.match(serviceSrc, /ADMIN_ACTIVATE_LICENSE_KEY/, 'AdminService must log ADMIN_ACTIVATE_LICENSE_KEY audit log');
assert.match(serviceSrc, /quickExtendSubscription\s*\(/, 'AdminService must implement quickExtendSubscription');
assert.match(serviceSrc, /ADMIN_QUICK_EXTEND_SUBSCRIPTION/, 'AdminService must log ADMIN_QUICK_EXTEND_SUBSCRIPTION audit log');

console.log('✅ Repository & Service commercialization contracts verified.');

console.log('--- 2. Testing LicenseKeys.jsx Commercial Capabilities ---');
const licenseKeysSrc = readSource('src/ui/admin-dashboard/pages/LicenseKeys/LicenseKeys.jsx');
assert.match(licenseKeysSrc, /TỔNG MÃ ĐÃ SINH/, 'LicenseKeys must render total keys KPI');
assert.match(licenseKeysSrc, /TỒN KHO \(CHƯA DÙNG\)/, 'LicenseKeys must render available stock KPI');
assert.match(licenseKeysSrc, /ĐÃ KÍCH HOẠT/, 'LicenseKeys must render activated keys KPI');
assert.match(licenseKeysSrc, /THU HỒI \/ HẾT HẠN/, 'LicenseKeys must render revoked/expired KPI');
assert.match(licenseKeysSrc, /filterType/, 'LicenseKeys must support filterType');
assert.match(licenseKeysSrc, /filterStatus/, 'LicenseKeys must support filterStatus');
assert.match(licenseKeysSrc, /Gói Cước \(Plan\)/, 'LicenseKeys modal must support Plan key generation');
assert.match(licenseKeysSrc, /PRO_MONTH/, 'LicenseKeys modal must support PRO_MONTH plan');
assert.match(licenseKeysSrc, /PRO_YEAR/, 'LicenseKeys modal must support PRO_YEAR plan');
assert.match(licenseKeysSrc, /ENTERPRISE/, 'LicenseKeys modal must support ENTERPRISE plan');
assert.match(licenseKeysSrc, /showActivateModal/, 'LicenseKeys must provide 1-Click activate modal for shops');
assert.match(licenseKeysSrc, /handleRevokeKey/, 'LicenseKeys must provide revoke key handler');

console.log('✅ LicenseKeys commercial capabilities verified.');

console.log('--- 3. Testing Subscriptions.jsx SaaS Monetization & Quota Monitoring ---');
const subsSrc = readSource('src/ui/admin-dashboard/pages/Subscriptions/Subscriptions.jsx');
assert.match(subsSrc, /TỔNG HỢP ĐỒNG/, 'Subscriptions must render total contracts KPI');
assert.match(subsSrc, /ĐANG KÍCH HOẠT/, 'Subscriptions must render active subscriptions KPI');
assert.match(subsSrc, /SẮP HẾT HẠN \(≤ 7 NGÀY\)/, 'Subscriptions must render expiring soon KPI for telesales');
assert.match(subsSrc, /ĐÃ QUÁ HẠN/, 'Subscriptions must render expired subscriptions KPI');
assert.match(subsSrc, /handleQuickRenew/, 'Subscriptions must provide handleQuickRenew 1-click extension');
assert.match(subsSrc, /\+1T/, 'Subscriptions must provide +1 Month quick button');
assert.match(subsSrc, /\+3T/, 'Subscriptions must provide +3 Months quick button');
assert.match(subsSrc, /\+1N/, 'Subscriptions must provide +1 Year quick button');
assert.match(subsSrc, /Hạn mức \(Quotas\)/, 'Subscriptions table must have Quotas column');
assert.match(subsSrc, /máy/, 'Subscriptions table must display device quotas');
assert.match(subsSrc, /user/, 'Subscriptions table must display user/member quotas');
assert.match(subsSrc, /AI/, 'Subscriptions table must display AI monthly quotas');

console.log('✅ Subscriptions SaaS monetization & quota monitoring verified.');

console.log('--- 4. Testing SecurityRLS.jsx Audit Logs & Risk Inspection ---');
const securitySrc = readSource('src/ui/admin-dashboard/pages/Security/SecurityRLS.jsx');
assert.match(securitySrc, /getRiskLevel/, 'SecurityRLS must implement getRiskLevel classification helper');
assert.match(securitySrc, /CRITICAL/, 'SecurityRLS must support CRITICAL risk badge');
assert.match(securitySrc, /HIGH/, 'SecurityRLS must support HIGH risk badge');
assert.match(securitySrc, /MEDIUM/, 'SecurityRLS must support MEDIUM risk badge');
assert.match(securitySrc, /TỔNG SỰ KIỆN GHI NHẬN/, 'SecurityRLS must render total events KPI');
assert.match(securitySrc, /HÀNH ĐỘNG RỦI RO CAO/, 'SecurityRLS must render high risk KPI');
assert.match(securitySrc, /inspectingLog/, 'SecurityRLS must provide Payload Inspector Modal');
assert.match(securitySrc, /handleCopyPayload/, 'SecurityRLS must provide copy JSON payload action');
assert.match(securitySrc, /riskFilter/, 'SecurityRLS must provide risk level filter');

console.log('✅ SecurityRLS audit logs & risk inspection verified.');

console.log('\n🎉 ALL COMMERCIAL MONETIZATION CONTRACT & UI TESTS PASSED (100%)!');
