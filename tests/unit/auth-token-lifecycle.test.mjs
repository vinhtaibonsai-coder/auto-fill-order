import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');
const readSource = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), 'utf8');

const session = readSource('src/domain/auth/auth.session.js');
const service = readSource('src/domain/auth/auth.service.js');
const supabaseClient = readSource('src/infrastructure/supabase/client.js');
const viteConfig = readSource('vite.config.js');
const rootAdmin = readSource('admin.html');

assert.match(session, /async _loadSupabaseConfig\(\)/, 'AuthSession must load Supabase config dynamically');
assert.match(session, /SupabaseCloud\.loadConfig/, 'AuthSession refresh must use SupabaseCloud config when available');
assert.doesNotMatch(session, /https:\/\/xlgovgynbsahuykyjzcx\.supabase\.co/, 'AuthSession must not hard-code a project URL');
assert.doesNotMatch(session, /AytQ0MPBklNajTadr2KyNwk/, 'AuthSession must not hard-code anon keys');
assert.match(session, /grant_type=refresh_token/, 'AuthSession must refresh access tokens with refresh_token grant');
assert.match(session, /Date\.now\(\) \+ 300000 < session\.expires_at/, 'AuthSession must refresh before access token expiry');
assert.match(session, /_isRefreshRejection\(resp\.status, text\)/, 'Rejected refresh tokens must be detected');
assert.match(session, /await this\.clearSession\(\);\s*return null;/, 'Rejected refresh tokens must clear local session');

assert.match(service, /\/auth\/v1\/logout/, 'AuthService.logout must revoke the Supabase session server-side');
assert.match(service, /Authorization': `Bearer \$\{session\.access_token\}`/, 'Logout revoke must use the current access token');
assert.match(service, /AuthSession\.clearSession\(\)/, 'Logout must clear local session after server-side revoke attempt');

assert.match(supabaseClient, /SupabaseCloud\.signOut = async function\(accessToken = null\)/, 'SupabaseCloud.signOut must accept a token');
assert.match(supabaseClient, /\/auth\/v1\/logout/, 'SupabaseCloud.signOut must revoke server-side sessions');

assert.match(viteConfig, /admin:\s*'admin\.html'/, 'Root admin.html must be the Vite admin-dashboard build entry');
assert.match(viteConfig, /const isVercel = Boolean\(process\.env\.VERCEL\)/, 'Vercel builds must disable CRX plugin via VERCEL env');
assert.match(rootAdmin, /src\/ui\/admin-dashboard\/index\.jsx/, 'Root admin.html must mount the React admin dashboard');

console.log('Auth token lifecycle and admin deployment mapping tests passed.');
