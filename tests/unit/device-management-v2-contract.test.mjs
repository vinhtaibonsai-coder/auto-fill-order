import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const migration = read('database/migrations/v80_device_management_v2.sql');
const team = read('src/ui/options/pages/Team/Team.jsx');
const devices = read('src/ui/options/pages/Security/DeviceManagement.jsx');
const client = read('src/infrastructure/supabase/client.js');
const worker = read('src/runtime/service-worker/service-worker.js');
const authService = read('src/domain/auth/auth.service.js');

assert.match(migration, /submitted_by/, 'Member order counts must use the canonical submitted_by column');
assert.match(migration, /owner_revoke_device/, 'V2 migration must expose idempotent device revocation');
assert.match(migration, /owner_remove_shop_member/, 'V2 migration must revoke devices when removing a member');
assert.match(migration, /is_shop_owner_or_manager/, 'Owner RPCs must reject ordinary staff accounts');
assert.match(migration, /affected_device_id/);
assert.match(migration, /session_count/);
assert.match(migration, /audit_id/);
assert.match(migration, /revoked_at/); 
assert.match(migration, /revoke_reason/);
assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.device_sessions/);
assert.match(migration, /owner_get_shop_staff_and_devices/);
assert.doesNotMatch(migration, /so\.created_by_name/);
assert.doesNotMatch(migration, /so\.submitted_by\s*=\s*d\.user_id/);

assert.match(team, /owner_revoke_device/, 'Team must use revoke semantics for device removal');
assert.match(team, /owner_remove_shop_member/, 'Removing a member must revoke all linked devices atomically');
assert.doesNotMatch(team, /owner_delete_staff_device/, 'Team must not permanently delete devices from the browser');
assert.doesNotMatch(team, /owner_get_members_v2/, 'Team must not call an obsolete member RPC fallback');
assert.doesNotMatch(team, /sName\.includes\(cName\)|cName\.includes\(sName\)/, 'Order attribution must not use approximate staff names');
assert.match(devices, /owner_revoke_device/, 'Security device page must use the canonical revoke RPC');
assert.doesNotMatch(devices, /owner_delete_staff_device/, 'Security device page must not permanently delete devices');
assert.match(client, /shop_id=eq\./, 'Device revocation checks must be scoped to the active shop');
assert.match(client, /owner_revoke_device/, 'Legacy device removal must route to the audited revoke RPC');
const legacyDeviceRemoval = client.match(/SupabaseCloud\.deleteDevice[\s\S]*?SupabaseCloud\.adoptDeviceProfile/)?.[0] || '';
assert.doesNotMatch(legacyDeviceRemoval, /method:\s*'DELETE'/, 'Client must not hard-delete device rows');
assert.match(worker, /offline_grace|DEVICE_CHECK_FAILED/, 'Runtime must represent a bounded network grace state');
assert.match(authService, /DEVICE_VALIDATION_GRACE_MS|offline_grace/, 'Auth validation must not fail open indefinitely');

console.log('Device management V2 contract tests passed.');
