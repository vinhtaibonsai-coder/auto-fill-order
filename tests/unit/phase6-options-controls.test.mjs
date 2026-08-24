import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');
const readSource = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), 'utf8');

const app = readSource('src/ui/options/App.jsx');
const ai = readSource('src/ui/options/pages/AISettings/AISettings.jsx');
const carriers = readSource('src/ui/options/pages/Carriers/Carriers.jsx');
const devices = readSource('src/ui/options/pages/Security/DeviceManagement.jsx');

for (const route of ['shop-profile', 'team', 'ai-settings', 'address', 'carriers', 'order-settings', 'sync', 'notifications', 'security', 'audit', 'subscription']) {
  assert.match(app, new RegExp(`activeTab === '${route}'`), `Options navigation must include ${route}`);
}

assert.match(app, /const isConfigAllowed = uiRole !== 'viewer'/, 'Configuration visibility must be role-aware');
assert.match(app, /Access Denied/, 'Restricted routes must enforce permission-aware rendering');
assert.match(app, /resolvedUiRole === 'viewer'/, 'Session fallback must not overwrite an RPC-resolved role');

assert.doesNotMatch(ai, /type=["']password["']|groqApiKey|providerSecret/, 'AI settings must not expose provider secrets');
assert.match(ai, /rpc\/get_ai_budget/, 'AI quota must come from the server budget contract');

assert.match(carriers, /shop_id=eq\.\$\{sess\.active_shop_id\}/, 'Carrier reads must be scoped to the active shop');
assert.match(carriers, /shop_id: sess\.active_shop_id/, 'Carrier writes must be scoped to the active shop');
assert.match(carriers, /setLoginForm\(prev => \(\{ \.\.\.prev, password: '' \}\)\)/, 'Carrier password must be cleared after use');

assert.match(devices, /AuditService\.logAction\('DEVICE_REVOKED'/, 'Device revocation must write an audit event');

console.log('Phase 6 options control tests passed.');
