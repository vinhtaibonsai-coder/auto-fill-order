import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');
const readSource = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), 'utf8');

const optionsApp = readSource('src/ui/options/App.jsx');
const pkg = JSON.parse(readSource('package.json'));

assert.match(optionsApp, /const getAdminDashboardUrl = \(\) =>/, 'Options app must centralize Admin Dashboard URL resolution');
assert.match(optionsApp, /typeof chrome !== 'undefined'[\s\S]*typeof chrome\.runtime\.getURL === 'function'/, 'Options app must guard chrome.runtime.getURL');
assert.match(optionsApp, /return '\/admin'/, 'Options app must fallback to Vercel/web /admin route');
assert.match(optionsApp, /window\.open\(getAdminDashboardUrl\(\)\)/, 'Admin Dashboard button must use safe URL helper');
assert.doesNotMatch(optionsApp, /window\.open\(chrome\.runtime\.getURL/, 'Admin Dashboard button must not call chrome.runtime.getURL directly');

assert.match(pkg.scripts.test, /options-admin-link\.test\.mjs/, 'Main test script must include Options admin link coverage');

console.log('Options admin link tests passed.');
