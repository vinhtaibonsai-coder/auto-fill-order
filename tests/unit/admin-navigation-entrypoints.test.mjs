import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');
const readSource = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), 'utf8');

const workspaceApp = readSource('src/ui/index/App.jsx');
const adminHeader = readSource('src/ui/admin-dashboard/components/Header.jsx');
const pkg = JSON.parse(readSource('package.json'));

assert.match(workspaceApp, /const openAdminDashboard = \(\) =>/, 'Workspace must expose an Admin Dashboard navigation handler');
assert.match(workspaceApp, /chrome\.runtime\.getURL\('admin\.html'\)/, 'Workspace admin navigation must support extension builds');
assert.match(workspaceApp, /window\.location\.assign\('\/admin'\)/, 'Workspace admin navigation must support web/Vercel builds');
assert.match(workspaceApp, /const (canOpenAdminDashboard|isMasterAdmin) = \(\) =>/, 'Workspace must gate Admin Dashboard entry by role');
assert.match(workspaceApp, /SYSTEM_ADMIN[\s\S]*SUPER_ADMIN[\s\S]*ADMIN/, 'Workspace admin gate must allow admin roles');
assert.match(workspaceApp, /role:\s*sess\.role\s*\|\|[\s\S]*'SHOP_STAFF'/, 'Workspace must preserve top-level session role from AuthService');
assert.match(workspaceApp, /onClick=\{openShopControl\}/, 'Workspace extension button must use the current Shop Control route helper');
assert.doesNotMatch(workspaceApp, /\/frontend\/options\/options\.html/, 'Workspace must not link to the obsolete frontend/options/options.html path');

assert.match(adminHeader, /function Header\(\{[^}]*onLogout/, 'Admin header must keep logout callback wiring');
assert.match(adminHeader, /const openWorkspace = \(\) =>/, 'Admin header must expose a Workspace navigation handler');
assert.match(adminHeader, /window\.location\.assign\('\/workspace'\)/, 'Admin header must support web Workspace navigation');
assert.match(adminHeader, /const openShopControl = \(\) =>/, 'Admin header must expose a Shop Control navigation handler');
assert.match(adminHeader, /window\.location\.assign\('\/options'\)/, 'Admin header must support web Shop Control navigation');
assert.match(adminHeader, /onClick=\{onLogout\}/, 'Admin header must render the logout action');
assert.match(adminHeader, /minWidth:\s*'96px'/, 'Admin logout button must stay visible in the top bar');

assert.match(pkg.scripts.test, /admin-navigation-entrypoints\.test\.mjs/, 'Main test script must include admin navigation entrypoint coverage');

console.log('Admin navigation entrypoint tests passed.');
