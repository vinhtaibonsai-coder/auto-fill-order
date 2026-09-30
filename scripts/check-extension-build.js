#!/usr/bin/env node
// P0-2 CI guard: extension/ phải là production standalone, không chứa vite dev stub
// Fail nếu: chứa localhost:5173, @vite/client, Vite Dev Mode, hoặc dist/assets != extension/assets
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function fail(msg) {
  console.error(`❌ P0-2 FAIL: ${msg}`);
  process.exit(1);
}
function pass(msg) {
  console.log(`✅ P0-2 PASS: ${msg}`);
}

const root = path.resolve(__dirname, '..');
const extHtmlPaths = [
  path.join(root, 'extension', 'options.html'),
  path.join(root, 'extension', 'index.html'),
  path.join(root, 'extension', 'admin.html'),
];
const forbiddenPatterns = ['localhost:5173', '/@vite/client', 'Vite Dev Mode', '__vite__'];

let hasError = false;
for (const p of extHtmlPaths) {
  if (!fs.existsSync(p)) {
    console.warn(`⚠️  Không tìm thấy ${path.relative(root, p)} - skip`);
    continue;
  }
  const content = fs.readFileSync(p, 'utf8');
  for (const pat of forbiddenPatterns) {
    if (content.includes(pat)) {
      fail(`${path.relative(root, p)} chứa dev stub "${pat}" - extension/ phải là production build (vite build && node scripts/sync-extension.js).`);
    }
  }
  // kiểm tra có chứa production asset không (bất kỳ file trong /assets/)
  const hasProdAsset = /<script[^>]+crossorigin[^>]+\/assets\/[^"]+\.js/.test(content) || /<link[^>]+\/assets\/[^"]+\.css/.test(content) || /\/assets\//.test(content);
  if (!hasProdAsset) {
    console.warn(`⚠️  ${path.relative(root, p)} không thấy prod asset /assets/* (có thể chưa build)`);
  }
}
pass('Không phát hiện vite dev stub trong extension/*.html');

function hashDir(dir) {
  if (!fs.existsSync(dir)) return null;
  const files = [];
  function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const fp = path.join(d, e.name);
      if (e.isDirectory()) walk(fp);
      else if (e.isFile()) files.push(fp);
    }
  }
  walk(dir);
  files.sort();
  const h = crypto.createHash('sha256');
  for (const f of files) {
    const rel = path.relative(dir, f);
    h.update(rel);
    h.update(fs.readFileSync(f));
  }
  return h.digest('hex');
}

const distAssets = path.join(root, 'dist', 'assets');
const extAssets = path.join(root, 'extension', 'assets');
if (fs.existsSync(distAssets) && fs.existsSync(extAssets)) {
  const dHash = hashDir(distAssets);
  const eHash = hashDir(extAssets);
  if (dHash !== eHash) {
    fail(`Checksum mismatch: dist/assets (${dHash.slice(0,8)}) != extension/assets (${eHash.slice(0,8)}) - chạy lại "npm run build" để sync.`);
  }
  pass(`Checksum dist/assets == extension/assets (${dHash.slice(0,8)})`);
} else if (!fs.existsSync(distAssets)) {
  console.warn('⚠️  dist/assets chưa tồn tại - bỏ qua checksum (chạy npm run build trước)');
} else {
  fail('extension/assets không tồn tại sau build');
}

// Kiểm tra extension/manifest.json tồn tại
const manifest = path.join(root, 'extension', 'manifest.json');
if (!fs.existsSync(manifest)) {
  fail('extension/manifest.json không tồn tại');
}

console.log('\n✅ Tất cả kiểm tra P0-2 PASS - extension/ là production standalone');
