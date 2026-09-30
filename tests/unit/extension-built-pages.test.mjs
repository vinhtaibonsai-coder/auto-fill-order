import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');
const readSource = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
const readJson = (relativePath) => JSON.parse(readSource(relativePath));

const syncScript = readSource('scripts/sync-extension.js');
const pkg = readJson('package.json');

assert.match(syncScript, /const distBase = path\.resolve/, 'Extension sync must know the Vite dist directory');
assert.match(syncScript, /builtItemsToSync = \['admin\.html', 'options\.html', 'index\.html', 'assets'\]/, 'Extension sync must copy built HTML and assets');
assert.match(syncScript, /pwaItemsToSync = \['manifest\.webmanifest', 'pwa-icon\.svg'\]/, 'Extension sync must copy root PWA assets referenced by built index.html');
assert.doesNotMatch(syncScript, /itemsToSync = \['manifest\.json', 'src', 'public', 'admin\.html', 'options\.html', 'index\.html'\]/, 'Extension sync must not copy dev HTML over built HTML');
assert.match(pkg.scripts.build, /vite build && node scripts\/sync-extension\.js/, 'Build script must automatically synchronize to extension directory');

if (fs.existsSync(path.join(rootDir, 'extension/options.html'))) {
  const extOptions = readSource('extension/options.html');
  assert.doesNotMatch(extOptions, /Vite Dev Mode/, 'extension/options.html must never contain Vite Dev Mode stubs');
  assert.match(extOptions, /id="root"/, 'extension/options.html must have root mount point');
}

if (fs.existsSync(path.join(rootDir, 'extension/index.html'))) {
  const extIndex = readSource('extension/index.html');
  assert.doesNotMatch(extIndex, /Vite Dev Mode|localhost:5173/, 'extension/index.html must remain a standalone production page');
  assert.match(extIndex, /manifest\.webmanifest/, 'extension/index.html must preserve its PWA manifest link');
}

if (fs.existsSync(path.join(rootDir, 'dist/manifest.webmanifest'))) {
  assert.ok(fs.existsSync(path.join(rootDir, 'extension/manifest.webmanifest')), 'Extension root must receive manifest.webmanifest after build sync');
  assert.ok(fs.existsSync(path.join(rootDir, 'extension/pwa-icon.svg')), 'Extension root must receive pwa-icon.svg after build sync');
}

console.log('Extension built pages tests passed.');
await import('./workspace-number-format.test.mjs');
