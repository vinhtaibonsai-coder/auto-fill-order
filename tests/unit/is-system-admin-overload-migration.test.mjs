import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const forwardPath = path.join(root, 'database/migrations/v84_fix_is_system_admin_overloads.sql');
const consolidatedPath = path.join(root, 'database/migrations/RUN_ALL_MIGRATIONS.sql');

assert.equal(
  fs.existsSync(forwardPath),
  true,
  'a forward migration must remove ambiguous is_system_admin overloads from existing databases'
);

const forward = fs.readFileSync(forwardPath, 'utf8');
const consolidated = fs.readFileSync(consolidatedPath, 'utf8');
const safeLegacyRename = /pronargdefaults\s*>\s*0[\s\S]*ALTER FUNCTION public\.is_system_admin\(UUID\)\s+RENAME TO is_system_admin_legacy_default_uuid/;
const explicitUuidOverload = /CREATE OR REPLACE FUNCTION public\.is_system_admin\(p_user_id UUID\)\s*RETURNS BOOLEAN/;
const noArgOverload = /CREATE OR REPLACE FUNCTION public\.is_system_admin\(\s*\)\s*RETURNS BOOLEAN/;

assert.match(forward, safeLegacyRename);
assert.match(forward, explicitUuidOverload);
assert.match(forward, noArgOverload);
assert.match(forward, /NOTIFY pgrst, 'reload schema';/);
assert.match(consolidated, /FILE: v84_fix_is_system_admin_overloads\.sql/);
assert.match(consolidated, safeLegacyRename);
assert.match(consolidated, explicitUuidOverload);
assert.match(consolidated, noArgOverload);
assert.doesNotMatch(
  forward,
  /CREATE OR REPLACE FUNCTION public\.is_system_admin\([^)]*DEFAULT/i,
  'the canonical authorization guard must not accept an implicit/default user id'
);
assert.doesNotMatch(forward, /DROP FUNCTION[^;]*is_system_admin[^;]*CASCADE/i);

console.log('System-admin overload cleanup migration contract passed.');
