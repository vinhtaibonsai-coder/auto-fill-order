import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');
const readSource = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), 'utf8');

const adminEntry = readSource('src/ui/admin-dashboard/index.jsx');
const repository = readSource('src/domain/admin/admin.repository.js');
const pkg = JSON.parse(readSource('package.json'));

assert.match(adminEntry, /application\/config\.js/, 'Admin entry must load shared app config before rendering');
assert.match(adminEntry, /infrastructure\/supabase\/supabase-config\.js/, 'Admin entry must load Supabase config');
assert.match(adminEntry, /infrastructure\/supabase\/client\.js/, 'Admin entry must load SupabaseCloud client');
assert.match(adminEntry, /domain\/auth\/auth\.session\.js/, 'Admin entry must load global auth session bridge');
assert.match(adminEntry, /domain\/auth\/auth\.service\.js/, 'Admin entry must load global auth service bridge');

assert.match(repository, /globalThis\.SupabaseCloud/, 'Admin repository expects SupabaseCloud on globalThis');
assert.match(pkg.scripts.test, /admin-supabase-bootstrap\.test\.mjs/, 'Main test script must include admin Supabase bootstrap coverage');

console.log('Admin Supabase bootstrap tests passed.');
