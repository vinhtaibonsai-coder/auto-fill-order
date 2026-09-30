import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const source = fs.readFileSync(path.join(process.cwd(), 'src/domain/admin/admin.service.js'), 'utf8');

assert.doesNotMatch(source, /SupabaseCloud\.getClient\(/, 'AdminService must not depend on a non-existent SupabaseCloud.getClient API');
assert.match(source, /AdminRepository\._getConfig\(\)/, 'AdminService must reuse REST Supabase config');
assert.match(source, /AdminRepository\._getAuthHeaders\(configRes\)/, 'AdminService must reuse authenticated REST headers');
assert.match(source, /\/rest\/v1\/user_roles\?user_id=eq\.\$\{encodeURIComponent\(sess\.user\.id\)\}&select=role_id,roles\(code\)/, 'AdminService must verify SYSTEM_ADMIN via user_roles REST join');
assert.match(source, /SYSTEM_ADMIN/, 'AdminService must preserve SYSTEM_ADMIN authorization');

console.log('Admin service REST authorization contracts verified.');
