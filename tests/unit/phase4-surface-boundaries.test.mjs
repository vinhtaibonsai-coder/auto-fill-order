import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');

const readSource = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), 'utf8');

const indexApp = readSource('src/ui/index/App.jsx');
const optionsApp = readSource('src/ui/options/App.jsx');

const workerNav = indexApp.match(/\{\/\* Modern Bottom \/ Mobile Nav Bar \*\/\}([\s\S]*?)\{\/\* MODAL:/)?.[1];
assert.ok(workerNav, 'Worker navigation section must be present');
assert.match(workerNav, /setActiveTab\('parse'\)/, 'Worker navigation must expose order parsing');
assert.match(workerNav, /setActiveTab\('orders'\)/, 'Worker navigation must expose orders');
assert.doesNotMatch(workerNav, /setActiveTab\('shops'\)/, 'Worker navigation must not expose shop configuration');
assert.doesNotMatch(workerNav, /setActiveTab\('staff'\)/, 'Worker navigation must not expose team configuration');
assert.match(indexApp, /chrome\.runtime\?\.openOptionsPage/, 'Shop configuration CTA must open Options');

const optionsNav = optionsApp.match(/<nav className="nav-menu">([\s\S]*?)<\/nav>/)?.[1];
assert.ok(optionsNav, 'Options navigation section must be present');
assert.match(optionsNav, /Cấu hình cửa hàng/, 'Options must identify itself as shop configuration');
assert.doesNotMatch(optionsNav, />Workspace</, 'Options must not expose a worker workspace group');
assert.doesNotMatch(optionsNav, /setActiveTab\('(orders|bulk|history|customers)'\)/, 'Options must not expose order execution pages');

console.log('Phase 4 surface boundary tests passed.');
