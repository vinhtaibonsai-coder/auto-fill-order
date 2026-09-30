import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

const client = read('src/infrastructure/supabase/client.js');
const worker = read('src/runtime/service-worker/service-worker.js');
const richMigration = read('database/migrations/v74_rich_device_telemetry.sql');

assert.match(
  client,
  /SupabaseCloud\.registerDevice\s*=\s*async function\(\)[\s\S]*return this\.syncDeviceRecord\(\)/,
  'The public registration API must write the canonical extension_devices record'
);
assert.doesNotMatch(
  client,
  /SupabaseCloud\.registerDevice\s*=\s*async function\(\)[\s\S]*this\._url\(['"]devices['"]\)/,
  'Device registration must not write the legacy devices table'
);
assert.match(client, /PGRST202/, 'The client must recognize a PostgREST RPC signature mismatch');
assert.match(client, /p_fingerprint_hash:[\s\S]*p_shop_id:[\s\S]*p_metadata:/, 'Rich telemetry must use the v74 RPC contract');
assert.match(client, /legacyPayload/, 'The client must fall back to the v67 six-argument RPC during rollout');
assert.doesNotMatch(worker, /syncDeviceRecord\(\)\.catch\(\(\) => \{\}\)/, 'Background registration failures must remain observable');
assert.match(worker, /DEVICE_REGISTRATION_FAILED/, 'The service worker must expose a stable registration failure code');
assert.match(richMigration, /owner_get_devices_v2/, 'The device management read RPC must ship with the rich registration migration');

console.log('Device registration compatibility and observability contracts passed.');
