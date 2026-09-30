import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');
const read = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), 'utf8');

const adminRepo = read('src/domain/admin/admin.repository.js');
const adminService = read('src/domain/admin/admin.service.js');
const deviceMgmtUi = read('src/ui/admin-dashboard/pages/Devices/DeviceManagement.jsx');

// 1. Modals existence
const modals = [
  'src/ui/admin-dashboard/modals/DeviceOrdersModal.jsx',
  'src/ui/admin-dashboard/modals/AssignDeviceShopModal.jsx',
  'src/ui/admin-dashboard/modals/EditDeviceNameModal.jsx',
  'src/ui/admin-dashboard/modals/EditShopMaxDevicesModal.jsx'
];

for (const modalPath of modals) {
  assert.ok(fs.existsSync(path.join(rootDir, modalPath)), `Expected modal file to exist: ${modalPath}`);
  const content = read(modalPath);
  assert.ok(content.length > 200, `Modal file should have non-empty content: ${modalPath}`);
}

// 2. AdminRepository methods
assert.match(adminRepo, /listDevices\s*\(/, 'AdminRepository must expose listDevices');
assert.match(adminRepo, /shops:shop_id\(id,\s*name,\s*shop_code,\s*max_devices\)/, 'listDevices must select shop metadata including max_devices');
assert.match(adminRepo, /revokeDevice\s*\(deviceId,\s*revoked/, 'AdminRepository must expose revokeDevice');
assert.match(adminRepo, /revokeShopDevices\s*\(shopId\)/, 'AdminRepository must expose revokeShopDevices');
assert.match(adminRepo, /assignDeviceToShop\s*\(deviceId,\s*shopId\)/, 'AdminRepository must expose assignDeviceToShop');
assert.match(adminRepo, /updateDeviceName\s*\(deviceId,\s*deviceName\)/, 'AdminRepository must expose updateDeviceName');
assert.match(adminRepo, /updateShopMaxDevices\s*\(shopId,\s*maxDevices\)/, 'AdminRepository must expose updateShopMaxDevices');
assert.match(adminRepo, /deleteDevice\s*\(deviceId\)/, 'AdminRepository must expose deleteDevice');
assert.match(adminRepo, /getDeviceOrders\s*\(deviceId,\s*limit/, 'AdminRepository must expose getDeviceOrders');

// 3. AdminService role guard and audit logging
for (const method of [
  'revokeDevice',
  'revokeShopDevices',
  'assignDeviceToShop',
  'updateDeviceName',
  'updateShopMaxDevices',
  'deleteDevice',
  'getDeviceOrders'
]) {
  assert.match(adminService, new RegExp(`${method}\\s*\\(`), `AdminService must expose ${method}`);
}

assert.match(adminService, /assignDeviceToShop[\s\S]*?insertAuditLog/, 'assignDeviceToShop must log audit event');
assert.match(adminService, /updateDeviceName[\s\S]*?insertAuditLog/, 'updateDeviceName must log audit event');
assert.match(adminService, /updateShopMaxDevices[\s\S]*?insertAuditLog/, 'updateShopMaxDevices must log audit event');
assert.match(adminService, /deleteDevice[\s\S]*?insertAuditLog/, 'deleteDevice must log audit event');
assert.match(adminService, /revokeShopDevices[\s\S]*?insertAuditLog/, 'revokeShopDevices must log audit event');

// 4. UI: DeviceManagement.jsx
assert.match(deviceMgmtUi, /Phân nhóm Shop/, 'DeviceManagement UI must support shop-grouped view');
assert.match(deviceMgmtUi, /quota|max_devices/i, 'DeviceManagement UI must display shop quota tracking');
assert.match(deviceMgmtUi, /SkeletonHeroKpis|SkeletonTableRows|animate-pulse/, 'DeviceManagement UI must include skeleton loading states');
assert.match(deviceMgmtUi, /AssignDeviceShopModal/, 'DeviceManagement UI must integrate AssignDeviceShopModal');
assert.match(deviceMgmtUi, /EditDeviceNameModal/, 'DeviceManagement UI must integrate EditDeviceNameModal');
assert.match(deviceMgmtUi, /Đang Online/, 'DeviceManagement UI must display accurate Online status');
assert.match(deviceMgmtUi, /diffMins\s*<=\s*7/, 'Online detection must use accurate 7-minute heartbeat window');
assert.match(deviceMgmtUi, /Quét Trực Tuyến/, 'DeviceManagement UI must provide manual scan button');
assert.match(deviceMgmtUi, /Tự Động Quét/, 'DeviceManagement UI must provide auto-refresh toggle');

console.log('Admin Device Management Shop Partition tests passed successfully.');
