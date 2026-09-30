import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');
const readSource = relativePath => fs.readFileSync(path.join(rootDir, relativePath), 'utf8');

const app = readSource('src/ui/index/App.jsx');
const styles = readSource('src/ui/index/index-styles.css');
const indexHtml = readSource('index.html');
const manifest = JSON.parse(readSource('public/manifest.webmanifest'));
const icon = readSource('public/pwa-icon.svg');
const pkg = JSON.parse(readSource('package.json'));

assert.match(indexHtml, /viewport-fit=cover/, 'Workspace viewport must include safe-area support');
assert.match(indexHtml, /rel="manifest" href="\/manifest\.webmanifest"/, 'Workspace must link the web app manifest');
assert.match(indexHtml, /apple-mobile-web-app-capable/, 'Workspace must include iOS standalone metadata');
assert.equal(manifest.display, 'standalone', 'PWA must open as a standalone app');
assert.equal(manifest.orientation, 'portrait', 'PWA must prefer portrait orientation');
assert.equal(manifest.start_url, '/index.html', 'PWA must start at the workspace entrypoint');
assert.ok(manifest.icons.some(item => item.src === '/pwa-icon.svg' && item.sizes === 'any'), 'PWA must expose its scalable icon');
assert.match(icon, /viewBox="0 0 512 512"/, 'PWA SVG icon must provide a scalable square viewBox');

assert.match(app, /AuthService\.isSystemAdmin\(\)/, 'Workspace must verify system admin role during initialization');
assert.match(app, /SYSTEM_ADMIN[\s\S]*SUPER_ADMIN[\s\S]*MASTER_ADMIN[\s\S]*ADMIN/, 'Workspace must recognize all supported master-admin role labels');
assert.match(app, /window\.location\.replace\(target\)/, 'System admins must be auto-routed without keeping workspace in browser history');
assert.match(app, /: '\/admin\.html'/, 'Web workspace must auto-route system admins to admin.html');
assert.match(app, /function OrderCard\(/, 'Workspace must use a dedicated mobile order card');
assert.match(app, /className="copy-btn-touch"/, 'Tracking cards must expose a dedicated touch copy action');
assert.match(app, /href=\{phone \? `tel:\$\{phone\}`/, 'Customer cards must support one-tap phone calls');
assert.match(app, /key: 'vnpost', label: 'VNPost'/, 'Workspace must normalize VNPost identity');
assert.match(app, /key: 'jt', label: 'J&T Express'/, 'Workspace must normalize J&T identity');
assert.match(app, /<BottomNavButton[\s\S]*label="Tổng quan"/, 'Workspace must render thumb-zone bottom navigation');
assert.doesNotMatch(app, /📊|📦|👤|⚙️|💾/, 'Structural navigation and actions must use vector icons, not emoji');

assert.match(styles, /env\(safe-area-inset-bottom/, 'Bottom navigation must account for mobile safe area');
assert.match(styles, /min-height:\s*48px/, 'Primary mobile actions must provide touch-sized targets');
assert.match(styles, /prefers-reduced-motion:\s*reduce/, 'Workspace must respect reduced-motion preference');
assert.match(styles, /prefers-color-scheme:\s*dark/, 'Workspace must provide readable dark-mode tokens');
assert.match(styles, /\.carrier-vnpost/, 'Styles must define VNPost carrier treatment');
assert.match(styles, /\.carrier-jt/, 'Styles must define J&T carrier treatment');
assert.match(styles, /\.tracking-card code/, 'Styles must make the tracking code a distinct visual focus');

// Quick Copy iOS assertions (QC-09)
assert.match(app, /QuickCopyPanel/, 'Workspace must render QuickCopyPanel component for fast iOS copying');
assert.match(app, /copyToClipboard/, 'Workspace must use robust copyToClipboard adapter');
assert.doesNotMatch(app, /useEffect\(\s*\(\)\s*=>\s*\{[^}]*readText/, 'Workspace must never automatically read clipboard on page load without user action');
assert.match(styles, /\.qc-sticky-bar/, 'Styles must define sticky action bar for iPhone thumb reach');
assert.match(styles, /\.qc-btn-next/, 'Styles must define touch target button for Copy Next');
assert.match(styles, /\.qc-carrier-tabs/, 'Styles must define carrier selector tabs for J&T and VNPost');
assert.match(styles, /has-sticky-bar/, 'Styles must accommodate safe padding when sticky bar is active');

assert.match(pkg.scripts.test, /index-mobile-pwa\.test\.mjs/, 'Main test suite must include mobile PWA coverage');

console.log('Index mobile PWA tests passed.');
