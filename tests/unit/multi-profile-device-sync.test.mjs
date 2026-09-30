import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const migration = read('database/migrations/v86_fix_multi_profile_device_sync_and_rls.sql');
const team = read('src/ui/options/pages/Team/Team.jsx');
const devices = read('src/ui/options/pages/Security/DeviceManagement.jsx');
const client = read('src/infrastructure/supabase/client.js');

// 1. Database Migration V86 Invariants
assert.match(migration, /is_shop_owner_or_manager\(shop_id\)/, 'RLS policy must allow shop owners and managers to access all devices in the shop');
assert.match(migration, /user_email/, 'owner_get_shop_staff_and_devices must return accurate user_email');
assert.match(migration, /user_full_name/, 'owner_get_shop_staff_and_devices must return accurate user_full_name');
assert.match(migration, /is_owner_device/, 'owner_get_shop_staff_and_devices must return is_owner_device flag');
assert.match(migration, /owner_cleanup_inactive_devices/, 'Migration must provide enhanced 1-click cleanup RPC');
assert.match(migration, /PARTITION BY shop_id, device_id/, 'Migration must deduplicate duplicate device rows per shop');
assert.match(migration, /register_extension_device/, 'Migration must provide shop-scoped device upsert');

// 2. Team Page UI Invariants
assert.match(team, /owner_get_shop_staff_and_devices/, 'Team page must prioritize owner_get_shop_staff_and_devices RPC');
assert.match(team, /seenDevIds/, 'Team page must deduplicate devices by device_id');
assert.doesNotMatch(team, /devRes\.ok[\s\S]*devs\.length > 0[\s\S]*owner_get_shop_staff_and_devices/, 'Team page must not shadow the RPC with a restrictive direct table fetch');

// 3. Device Management Page UI Invariants
assert.match(devices, /seenDevIds/, 'DeviceManagement page must deduplicate devices by device_id');

// 4. Client Telemetry Invariants
assert.match(client, /staff_name:\s*userFullName/, 'syncDeviceRecord must include staff_name from auth session in metadata');
assert.match(client, /user_email:\s*userEmail/, 'syncDeviceRecord must include user_email in metadata');

console.log('Multi-profile workstation sync and RLS isolation contract tests passed.');
