import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const client = read('src/infrastructure/supabase/client.js');
const auth = read('src/domain/auth/auth.service.js');
const migration = read('database/migrations/v89_client_installation_surface_quota.sql');
const team = read('src/ui/options/pages/Team/Team.jsx');
const devices = read('src/ui/options/pages/Security/DeviceManagement.jsx');
const runAll = read('database/migrations/RUN_ALL_MIGRATIONS.sql');

// Runtime identity must distinguish a browser-extension installation from every web origin.
assert.match(client, /SupabaseCloud\.getClientContext\s*=\s*function/, 'Client must expose canonical client context detection');
assert.match(client, /chrome\.runtime\?\.id/, 'Extension detection must use the extension runtime, not the current page URL');
assert.match(client, /clientType:\s*isExtensionRuntime\s*\?\s*'EXTENSION'\s*:\s*'WEB'/, 'Client context must distinguish Extension and Web');
assert.match(client, /environment:\s*environment/, 'Client context must distinguish Local and Production');
assert.match(client, /'ext_'[\s\S]*'web_'/, 'New installation IDs must be namespaced by client type');
assert.match(client, /p_client_type:[\s\S]*p_environment:[\s\S]*p_surface:[\s\S]*p_origin_host:/, 'Registration RPC must receive the complete client context');

// PIN authentication is an independent entry point and must carry the same context.
assert.match(auth, /clientContext\s*=\s*SupabaseCloud\.getClientContext/, 'PIN login must use the canonical client context');
assert.match(auth, /client_type:\s*clientContext\.clientType/, 'PIN login must send the client type');
assert.match(auth, /environment:\s*clientContext\.environment/, 'PIN login must send the runtime environment');
assert.match(auth, /client_context:\s*clientContext/, 'Authenticated sessions must retain their source context');

// Database quota is for approved production Extension workstations only.
for (const column of ['client_type', 'environment', 'last_surface', 'origin_host', 'installation_id', 'is_billable']) {
  assert.match(migration, new RegExp(`ADD COLUMN IF NOT EXISTS ${column}`), `Migration must add ${column}`);
}
assert.match(migration, /DROP FUNCTION IF EXISTS public\.register_extension_device\(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, JSONB\)/, 'Migration must remove the old RPC signature before changing defaults');
assert.match(migration, /client_type = 'EXTENSION'[\s\S]*environment = 'PRODUCTION'[\s\S]*approved = true[\s\S]*is_billable = true/, 'Quota count must include only approved production Extension installations');
assert.doesNotMatch(migration, /IF NOT v_is_owner AND v_active >= v_limit/, 'Owners must not silently bypass the Extension workstation quota');
assert.match(migration, /v_is_billable := \(v_client_type = 'EXTENSION' AND v_environment = 'PRODUCTION'\)/, 'Web and Local installations must be non-billable');
assert.match(migration, /DEVICE_PENDING_APPROVAL/, 'New Extension workstations must support owner approval');

// Both management screens must expose the distinction instead of reporting one misleading total.
assert.match(team, /extensionDeviceCount/, 'Team KPIs must count Extension workstations separately');
assert.match(team, /webSessionCount/, 'Team KPIs must count Web sessions separately');
assert.match(team, /localSessionCount/, 'Team KPIs must expose Local development sessions');
assert.match(devices, /billableActiveCount/, 'Device quota UI must use billable Extension workstations only');
assert.match(devices, /getClientBadge/, 'Device rows must show their client/environment classification');

assert.match(runAll, /MIGRATION V89: CLIENT INSTALLATION SURFACE & QUOTA/, 'The consolidated migration entry point must include v89');

console.log('Client surface, installation identity, and device quota contracts passed.');
