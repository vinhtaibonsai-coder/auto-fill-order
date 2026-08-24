import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ERROR_CODES, normalizeErrorCode, toUserSafeError } from '../../src/application/error-codes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');
const readSource = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), 'utf8');

const errorCodes = readSource('src/application/error-codes.js');
const panel = readSource('src/ui/panel/App.jsx');
const serviceWorker = readSource('src/runtime/service-worker/service-worker.js');
const aiGateway = readSource('supabase/functions/ai-gateway/index.ts');
const storage = readSource('src/application/storage.js');
const storageEsm = readSource('src/application/storage.esm.js');
const syncSettings = readSource('src/ui/options/pages/Sync/SyncSettings.jsx');
const overview = readSource('src/ui/options/pages/Overview/Overview.jsx');
const systemHealth = readSource('src/ui/admin-dashboard/pages/SystemHealth/SystemHealth.jsx');

for (const code of [
  'AI_AUTH_REQUIRED',
  'AI_SHOP_REQUIRED',
  'AI_SHOP_FORBIDDEN',
  'AI_FEATURE_DISABLED',
  'AI_RATE_LIMITED',
  'AI_QUOTA_EXCEEDED',
  'AI_KEY_UNAVAILABLE',
  'AI_PROVIDER_UNAVAILABLE',
  'AI_UPSTREAM_ERROR',
  'AI_TIMEOUT',
  'ADDRESS_ENGINE_FAILED',
  'CARRIER_FORM_NOT_FOUND',
  'CARRIER_AUTOFILL_FAILED',
  'SYNC_CLOUD_UNAVAILABLE',
  'SYNC_OUTBOX_PENDING',
  'AUTH_SESSION_EXPIRED'
]) {
  assert.equal(ERROR_CODES[code], code, `${code} must be a stable machine-readable error code`);
  assert.match(errorCodes, new RegExp(`\\[ERROR_CODES\\.${code}\\]`), `${code} must have a user-safe Vietnamese message`);
}

assert.equal(normalizeErrorCode({ message: 'quota exceeded' }), ERROR_CODES.AI_QUOTA_EXCEEDED);
assert.equal(normalizeErrorCode({ message: 'jwt expired' }), ERROR_CODES.AI_AUTH_REQUIRED);
assert.equal(toUserSafeError({ code: ERROR_CODES.AI_PROVIDER_UNAVAILABLE }).retryable, true);
assert.equal(toUserSafeError({ code: ERROR_CODES.AI_AUTH_REQUIRED }).retryable, false);

assert.match(panel, /import \{ ERROR_CODES, toUserSafeError \}/, 'Panel must use centralized safe error mapping');
assert.match(panel, /safeError\.message/, 'Panel must show user-safe error messages');
assert.match(panel, /ERROR_CODES\.AI_QUOTA_EXCEEDED/, 'Panel must use AI quota error code');
assert.match(panel, /ERROR_CODES\.AI_AUTH_REQUIRED/, 'Panel must use AI auth error code');
assert.match(panel, /ERROR_CODES\.ADDRESS_ENGINE_FAILED/, 'Address engine failures must map to safe review warning');
assert.match(panel, /ERROR_CODES\.AI_PROVIDER_UNAVAILABLE/, 'Provider failures must map to safe fallback warning');
assert.match(panel, /Fallback to local reviewed data if AI fails[\s\S]*setState\('REVIEW'\)/, 'AI failure must degrade to local reviewed data and manual review');
assert.match(panel, /ConfidenceReview/, 'Low-confidence address results must remain review-gated');
assert.match(panel, /Thử lại/, 'Panel must expose a retry path for recoverable parse failures');

assert.match(serviceWorker, /import \{ ERROR_CODES, toUserSafeError \}/, 'Service worker must use centralized safe error mapping');
assert.match(serviceWorker, /code:\s*safeError\.code/, 'Service worker must return machine-readable error codes');
assert.match(serviceWorker, /ERROR_CODES\.AI_TIMEOUT/, 'Service worker timeout must have a standard code');
assert.match(serviceWorker, /errData\.error \|\| ERROR_CODES\.AI_UPSTREAM_ERROR/, 'Gateway HTTP errors must default to a standard upstream code');

for (const code of [
  'AI_AUTH_REQUIRED',
  'AI_SHOP_REQUIRED',
  'AI_SHOP_FORBIDDEN',
  'AI_FEATURE_DISABLED',
  'AI_RATE_LIMITED',
  'AI_QUOTA_EXCEEDED',
  'AI_KEY_UNAVAILABLE',
  'AI_PROVIDER_UNAVAILABLE',
  'AI_UPSTREAM_ERROR'
]) {
  assert.match(aiGateway, new RegExp(`error:\\s*['"]${code}['"]|['"]${code}['"]`), `AI Gateway must emit ${code}`);
}

assert.match(storage, /await this\._saveOrdersToLocal\(mergedAllOrders\)[\s\S]*this\._pushToCloud\(order\)[\s\S]*return order/, 'Order saves must commit local data before cloud push');
assert.match(storage, /async _pushToCloud\(order\)[\s\S]*catch \(e\) \{ console\.warn\('Cloud push error:', e\); \}/, 'Cloud push failures must not make local order saves unusable');
assert.doesNotMatch(storage, /^\s*export\s+\{ OrderStorage \};/m, 'Classic extension storage script must not contain ESM exports');
assert.match(storageEsm, /import '\.\/storage\.js';[\s\S]*export const OrderStorage = globalThis\.OrderStorage/, 'React/Vite imports must use an ESM wrapper around classic storage');

assert.match(syncSettings, /sync_outbox/, 'Sync settings must surface the cloud outbox');
assert.match(syncSettings, /handleSyncNow/, 'Sync settings must expose a manual refresh/retry path');
assert.match(overview, /function ErrorState\(\{ title, onRetry \}\)/, 'Options overview must have reusable retryable error state');
assert.match(overview, /Thử lại/, 'Options overview errors must expose retry copy');
assert.match(systemHealth, /onClick=\{fetchHealth\}/, 'Admin system health must expose refresh/retry');

console.log('Phase 12 graceful error and degradation tests passed.');
