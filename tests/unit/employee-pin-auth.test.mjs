import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const migration = read('database/migrations/v83_employee_pin_trusted_device_architecture.sql');
const authService = read('src/domain/auth/auth.service.js');
const authSession = read('src/domain/auth/auth.session.js');
const client = read('src/infrastructure/supabase/client.js');
const loginPage = read('src/ui/options/pages/Auth/Login.jsx');
const panelLogin = read('src/ui/panel/components/LoginForm.jsx');
const deviceMgmt = read('src/ui/options/pages/Security/DeviceManagement.jsx');

// 1. Migration checks
assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.employee_pin_credentials/, 'v83 migration must create employee_pin_credentials table');
assert.match(migration, /public\.employee_pin_login/, 'v83 migration must expose employee_pin_login RPC');
assert.match(migration, /public\.owner_set_employee_pin/, 'v83 migration must expose owner_set_employee_pin RPC');
assert.match(migration, /public\.owner_approve_device/, 'v83 migration must expose owner_approve_device RPC');
assert.match(migration, /public\.owner_get_devices_v3/, 'v83 migration must expose owner_get_devices_v3 RPC');
assert.match(migration, /REVOKE EXECUTE ON FUNCTION public\.admin_repair_user_auth\(TEXT, TEXT\) FROM anon/, 'Must revoke repair RPC from anon');

// 2. Fail-Closed RBAC checks (P0 Vulnerability Fix)
assert.match(authService, /role:\s*['"]SHOP_STAFF['"]/, 'Fallback RBAC must default to SHOP_STAFF');
assert.doesNotMatch(authService, /catch\s*\([^)]*\)\s*\{\s*console\.warn\([^)]*\);\s*return\s*\{[^}]*role:\s*['"]SYSTEM_ADMIN['"]/, 'Catch block must never return SYSTEM_ADMIN (Fail-Closed invariant)');

// 3. PIN Login Service checks
assert.match(authService, /loginWithPin/, 'AuthService must implement loginWithPin');
assert.match(authService, /DEVICE_PENDING_APPROVAL/, 'AuthService must handle DEVICE_PENDING_APPROVAL state');

// 4. Device ID Preservation checks
assert.doesNotMatch(authSession, /keysToRemove\s*=\s*\[[^\]]*'fbDeviceId'/, 'AuthSession clearSession must never remove fbDeviceId');
assert.doesNotMatch(authSession, /keysToRemove\s*=\s*\[[^\]]*'device_id'/, 'AuthSession clearSession must never remove device_id');

// 5. Client _getDeviceId compatibility
assert.match(client, /device_id/, 'Client must support unified device_id');
assert.match(client, /fbDeviceId/, 'Client must preserve fbDeviceId backward compatibility');

// 6. UI integration checks
assert.match(loginPage, /loginWithPin/, 'Login page must invoke loginWithPin');
assert.match(loginPage, /DEVICE_PENDING_APPROVAL/, 'Login page must render pending approval state');
assert.match(panelLogin, /loginWithPin/, 'Panel LoginForm must invoke loginWithPin');
assert.match(deviceMgmt, /owner_approve_device|owner_get_devices_v3/, 'DeviceManagement must support device approval');
assert.match(deviceMgmt, /owner_set_employee_pin/, 'DeviceManagement must support setting employee PIN');

console.log('Employee PIN and Trusted Device Architecture contract tests passed!');
