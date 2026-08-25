import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), 'utf8'));
const readSource = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), 'utf8');

const vercel = readJson('vercel.json');
const pkg = readJson('package.json');
const viteConfig = readSource('vite.config.js');
const plan = readSource('PLAN/AUTH_AND_ADMIN_DASHBOARD_DEVELOPMENT_PLAN.md');

assert.equal(vercel.framework, 'vite', 'Vercel framework must be Vite');
assert.equal(vercel.buildCommand, 'npm run build', 'Vercel build command must use npm run build');
assert.equal(vercel.outputDirectory, 'dist', 'Vercel output directory must be dist');
assert.equal(vercel.installCommand, 'npm install', 'Vercel install command must be explicit');
assert.equal(vercel.cleanUrls, true, 'Vercel cleanUrls must be enabled');

const rewriteMap = new Map((vercel.rewrites || []).map(r => [r.source, r.destination]));
assert.equal(rewriteMap.get('/admin'), '/admin.html', '/admin must rewrite to admin.html');
assert.equal(rewriteMap.get('/options'), '/options.html', '/options must rewrite to options.html');
assert.equal(rewriteMap.get('/workspace'), '/index.html', '/workspace must rewrite to index.html');

const globalHeaders = (vercel.headers || []).find(h => h.source === '/(.*)')?.headers || [];
const headerMap = new Map(globalHeaders.map(h => [h.key, h.value]));
assert.equal(headerMap.get('X-Content-Type-Options'), 'nosniff', 'Vercel must set nosniff');
assert.equal(headerMap.get('Referrer-Policy'), 'strict-origin-when-cross-origin', 'Vercel must set referrer policy');
assert.match(headerMap.get('Permissions-Policy') || '', /camera=\(\)/, 'Vercel must disable camera permission by default');

assert.equal(pkg.scripts['deploy:vercel'], 'npx vercel --prod', 'Package must expose production Vercel deploy');
assert.equal(pkg.scripts['deploy:vercel:preview'], 'npx vercel', 'Package must expose preview Vercel deploy');

assert.match(viteConfig, /const isVercel = Boolean\(process\.env\.VERCEL\)/, 'Vite config must detect Vercel');
assert.match(viteConfig, /!isVercel && crx\(\{ manifest \}\)/, 'Vercel builds must disable CRX plugin');
assert.match(viteConfig, /admin:\s*'admin\.html'/, 'Admin dashboard must remain a Vite build input');

assert.match(plan, /Vercel is the primary production target/, 'Plan must document Vercel as primary target');
assert.match(plan, /\/admin.*SaaS Admin Dashboard/, 'Plan must document /admin route');

console.log('Vercel admin deploy tests passed.');
