import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');
const readSource = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), 'utf8');

const overview = readSource('src/ui/options/pages/Overview/Overview.jsx');
const submitted = readSource('src/ui/options/pages/Orders/SubmittedOrders.jsx');
const supabase = readSource('src/infrastructure/supabase/client.js');
const storage = readSource('src/application/storage.js');
const pkg = JSON.parse(readSource('package.json'));

for (const [name, source] of [['Overview', overview], ['SubmittedOrders', submitted]]) {
  assert.match(source, /normalizeCarrierValue/, `${name} must normalize carrier values before rendering`);
  assert.match(source, /JSON\.parse\(raw\)/, `${name} must parse legacy carrier JSON strings`);
  assert.match(source, /value\.ID/, `${name} must support legacy carrier objects with ID`);
  assert.match(source, /J&T Express/, `${name} must render J&T with a readable label`);
}

assert.match(supabase, /_normalizeCarrierCode/, 'Supabase client must normalize carrier codes');
assert.match(supabase, /platform:\s*this\._normalizeCarrierCode\(o\.platform \|\| o\.carrier \|\| o\.carrier_id\)/, 'Bulk upsert must store normalized carrier codes');
assert.match(supabase, /platform:\s*this\._normalizeCarrierCode\(order\.platform \|\| order\.carrier \|\| order\.carrier_id\)/, 'Single upsert must store normalized carrier codes');
assert.match(supabase, /platform:\s*SupabaseCloud\._normalizeCarrierCode\(o\.platform \|\| o\.carrier \|\| o\.carrier_id\)/, 'Cloud fetch must normalize old carrier rows');

assert.match(storage, /function normalizeCarrierCode/, 'Local storage must normalize carrier codes');
assert.match(storage, /order\.platform = normalizeCarrierCode\(order\.platform \|\| order\.carrier \|\| order\.carrier_id\)/, 'Local saves must normalize carrier codes');

assert.match(pkg.scripts.test, /carrier-platform-normalization\.test\.mjs/, 'Main test script must include carrier normalization coverage');

console.log('Carrier platform normalization tests passed.');
