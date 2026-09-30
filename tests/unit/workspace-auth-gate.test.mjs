import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');
const readSource = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
const readJson = (relativePath) => JSON.parse(readSource(relativePath));

const entry = readSource('src/ui/index/index.jsx');
const app = readSource('src/ui/index/App.jsx');
const pkg = readJson('package.json');

assert.match(entry, /infrastructure\/supabase\/supabase-config\.js/, 'Workspace entry must load Supabase config');
assert.match(entry, /infrastructure\/supabase\/client\.js/, 'Workspace entry must load SupabaseCloud client');
assert.match(entry, /domain\/auth\/auth\.session\.js/, 'Workspace entry must load auth session bridge');
assert.match(entry, /domain\/auth\/auth\.service\.js/, 'Workspace entry must load auth service bridge');

assert.doesNotMatch(app, /const DEFAULT_SUPABASE/, 'Workspace must not contain a hardcoded Supabase fallback');
assert.doesNotMatch(app, /sb_publishable_/, 'Workspace must not hardcode a publishable Supabase key');
assert.match(app, /import Login from '\.\.\/options\/pages\/Auth\/Login\.jsx'/, 'Workspace must render login for unauthenticated users');
assert.match(app, /const \[isAuthenticated, setIsAuthenticated\] = useState\(false\)/, 'Workspace must track authentication state');
assert.match(app, /AuthService\.isAuthenticated\(\)/, 'Workspace must check authentication before loading data');
assert.match(app, /if \(isAuth\) \{\s+await loadAll\(\);/s, 'Workspace must only load data after authentication succeeds');
assert.match(app, /if \([\s\S]*!sess\?\.access_token[\s\S]*sess\.access_token\.startsWith\('local_dev_token_'\)[\s\S]*\)/, 'Workspace must reject missing or local-dev tokens before API access');
assert.match(app, /return <Login onLoginSuccess=/, 'Workspace must show Login when unauthenticated');
assert.doesNotMatch(app, /Authorization': `Bearer \$\{token\}`/, 'Workspace must not fall back to anon Authorization token');

assert.match(pkg.scripts.test, /workspace-auth-gate\.test\.mjs/, 'Main test script must include workspace auth gate coverage');

console.log('Workspace auth gate tests passed.');
