import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');
const readSource = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), 'utf8');

// 1. Static source inspections
const clientSource = readSource('src/infrastructure/supabase/client.js');
const realtimeSource = readSource('src/domain/realtime/realtime.service.js');
const optionsAppSource = readSource('src/ui/options/App.jsx');
const adminAppSource = readSource('src/ui/admin-dashboard/App.jsx');
const authServiceSource = readSource('src/domain/auth/auth.service.js');

assert.match(
  clientSource,
  /SupabaseCloud\.getSupabaseClient\s*=\s*async\s*function/,
  'SupabaseCloud must export getSupabaseClient as a singleton provider'
);

assert.match(
  clientSource,
  /storageKey:\s*['"]sb-afo-singleton-auth['"]/,
  'SupabaseCloud.getSupabaseClient must use an isolated storageKey to prevent GoTrueClient instance warnings'
);

assert.match(
  clientSource,
  /_clientInitPromise/,
  'SupabaseCloud.getSupabaseClient must use an init promise lock to serialize concurrent calls'
);

assert.match(
  realtimeSource,
  /SupabaseCloud\.getSupabaseClient/,
  'RealtimeService._getClient must delegate to SupabaseCloud.getSupabaseClient'
);

assert.match(
  optionsAppSource,
  /SupabaseCloud\.getSupabaseClient/,
  'options/App.jsx must use SupabaseCloud.getSupabaseClient instead of direct createClient'
);

assert.doesNotMatch(
  optionsAppSource,
  /const\s*\{\s*createClient\s*\}\s*=\s*await\s*import\(['"]@supabase\/supabase-js['"]\)/,
  'options/App.jsx must not instantiate an ad-hoc createClient'
);

assert.match(
  adminAppSource,
  /SupabaseCloud\.getSupabaseClient/,
  'admin-dashboard/App.jsx must use SupabaseCloud.getSupabaseClient instead of direct createClient'
);

assert.doesNotMatch(
  adminAppSource,
  /const\s*\{\s*createClient\s*\}\s*=\s*await\s*import\(['"]@supabase\/supabase-js['"]\)/,
  'admin-dashboard/App.jsx must not instantiate an ad-hoc createClient'
);

assert.match(
  authServiceSource,
  /async\s+getSupabaseClient\s*\(\)/,
  'AuthService must export getSupabaseClient'
);

assert.doesNotMatch(
  authServiceSource,
  /window\.supabase\.createClient/,
  'AuthService must not call window.supabase.createClient directly'
);

// 2. Functional singleton test
let createClientCallCount = 0;
const mockClient = {
  id: 'singleton-client-' + Math.random(),
  channel: () => ({ on: () => ({ subscribe: () => {} }) })
};

globalThis.window = {
  supabase: {
    createClient: () => {
      createClientCallCount++;
      return mockClient;
    }
  }
};
globalThis.SUPABASE_CONFIG = {
  url: 'https://test-singleton.supabase.co',
  anonKey: 'test-anon-key'
};

// Evaluate client.js in this sandbox
const clientCode = fs.readFileSync(path.join(rootDir, 'src/infrastructure/supabase/client.js'), 'utf8');
new Function(clientCode)();

assert.ok(globalThis.SupabaseCloud, 'SupabaseCloud must be attached to globalThis');
assert.equal(typeof globalThis.SupabaseCloud.getSupabaseClient, 'function', 'getSupabaseClient must be a function');

// Invoke concurrently 5 times
const results = await Promise.all([
  globalThis.SupabaseCloud.getSupabaseClient(),
  globalThis.SupabaseCloud.getSupabaseClient(),
  globalThis.SupabaseCloud.getSupabaseClient(),
  globalThis.SupabaseCloud.getSupabaseClient(),
  globalThis.SupabaseCloud.getSupabaseClient()
]);

assert.equal(createClientCallCount, 1, 'createClient must be invoked exactly once across concurrent calls');
for (const res of results) {
  assert.equal(res, mockClient, 'All concurrent calls must resolve to the identical singleton client instance');
}

// Subsequent call after resolved
const followUp = await globalThis.SupabaseCloud.getSupabaseClient();
assert.equal(followUp, mockClient, 'Follow-up call must return the cached singleton instance');
assert.equal(createClientCallCount, 1, 'Follow-up call must not invoke createClient again');

console.log('✅ Supabase client singleton tests passed successfully!');
