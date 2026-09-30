import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const migration = fs.readFileSync(
  path.join(root, 'database/migrations/v108_p1_shop_access_key_and_device_revocation_hardening.sql'),
  'utf8'
);

assert.match(migration, /generate_shop_access_key\(\)/, 'must define a central strong shop key generator');
assert.match(migration, /gen_random_uuid\(\).*gen_random_uuid\(\)/s, 'shop key generator must use high-entropy random material');
assert.doesNotMatch(migration, /substr\(md5\([^)]*\),\s*1,\s*8\)/i, 'must not generate 8-hex shop keys');
assert.match(migration, /shop_access_key\s+~\s+'\^KEY-SHOP-\[A-Fa-f0-9\]\{8\}\$'/, 'must rotate legacy weak KEY-SHOP-XXXXXXXX keys');
assert.match(migration, /DEVICE_REVOKED/, 'verify_shop_access_key must reject revoked devices');
assert.match(migration, /coalesce\(v_existing\.revoked,\s*false\)/, 'revoked devices must be checked before updates');
assert.doesNotMatch(migration, /revoked\s*=\s*false[\s\S]{0,80}WHERE id = v_existing\.id/i, 'existing device update must not silently clear revoked');
assert.match(migration, /REVOKE ALL ON FUNCTION public\.consume_ai_quota/, 'AI quota RPC must not be executable by PUBLIC');
assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.consume_ai_quota\(UUID, INT, INT, INT, TEXT, TEXT\) TO authenticated, service_role;/, 'AI quota RPC grants must be explicit');

console.log('PASS [shop access key entropy + revoked device hardening]');
