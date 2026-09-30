import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

function assertProfileRoleCompatibility(source, label) {
  const inserts = [...source.matchAll(
    /INSERT INTO public\.profiles\s*\(([^)]*)\)\s*VALUES\s*\(([^;]+?)\)\s*(?:ON CONFLICT|;)/gis
  )];
  assert.ok(inserts.length > 0, `${label} must contain a profiles insert`);

  for (const [, columns, values] of inserts) {
    if (!/\brole\b/i.test(columns)) continue;
    assert.doesNotMatch(
      values,
      /'SHOP_OWNER'|p_role_code/i,
      `${label} must not put RBAC role codes in profiles.role`
    );
    assert.match(
      values,
      /,\s*'member'\s*,/i,
      `${label} must write profiles.role='member'; shop/system roles belong in shop_members/user_roles`
    );
  }
}

assertProfileRoleCompatibility(
  read('database/migrations/v79_comprehensive_auth_and_shop_creation_fix.sql'),
  'v79 auth/shop creation migration'
);
const forwardFix = read('database/migrations/v83_fix_admin_create_shop_profile_role.sql');
assertProfileRoleCompatibility(forwardFix, 'v83 forward repair migration');
assert.match(forwardFix, /REVOKE ALL ON FUNCTION public\.admin_create_shop_with_account[^;]+FROM anon/i);
assert.match(forwardFix, /INSERT INTO public\.shop_members[\s\S]+?'OWNER'/i);
assertProfileRoleCompatibility(
  read('database/migrations/RUN_ALL_MIGRATIONS.sql'),
  'consolidated migration'
);

console.log('Admin create-shop profile role compatibility contract passed.');
