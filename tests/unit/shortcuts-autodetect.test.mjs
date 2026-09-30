import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

const manifest = JSON.parse(read('manifest.json'));
const runtimeIndex = read('src/runtime/content/index.js');
const carrierRuntimeCode = read('src/runtime/content/carrier-runtime.js');

// 1. Manifest permissions and matches
assert.ok(manifest.permissions.includes('clipboardRead'), 'manifest.json must include clipboardRead');
const matches = manifest.content_scripts[0].matches;
assert.ok(matches.some(m => m.includes('vnpost.vn')), 'manifest must match vnpost.vn');
assert.ok(matches.some(m => m.includes('jtexpress.vn')), 'manifest must match jtexpress.vn');
assert.ok(matches.some(m => m.includes('viettelpost.vn')), 'manifest must match viettelpost.vn');
assert.ok(matches.some(m => m.includes('ghtk.vn')), 'manifest must match ghtk.vn');

// 2. Keyboard shortcuts in content script
assert.match(runtimeIndex, /addEventListener\('keydown'/i, 'content/index.js must have keydown listener');
assert.match(runtimeIndex, /isPasteShortcut/i, 'content/index.js must handle Ctrl+Shift+V / Cmd+Shift+V');
assert.match(runtimeIndex, /navigator\.clipboard\.readText/i, 'content/index.js must read clipboard text');
assert.match(runtimeIndex, /e\.key === 'Escape'/i, 'content/index.js must handle Escape key');

// 3. Carrier Runtime platform detection
function getRuntime(url) {
  const sandbox = {
    location: { href: url },
    VNPOST_SELECTORS: { getAccountName: () => 'vnpost-user' },
    JT_SELECTORS: { getAccountName: () => 'jt-user' },
    VIETTELPOST_SELECTORS: { getAccountName: () => 'viettel-user' },
    GHTK_SELECTORS: { getAccountName: () => 'ghtk-user' }
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(carrierRuntimeCode, sandbox);
  return sandbox.AutoFillCarrierRuntime;
}

const vnpost1 = getRuntime('https://my.vnpost.vn/order/domestic/create');
assert.equal(vnpost1.getCurrentPlatform().id, 'vnpost');

const vnpost2 = getRuntime('https://donhang.vnpost.vn/create');
assert.equal(vnpost2.getCurrentPlatform().id, 'vnpost');

const jt = getRuntime('https://khachhang.jtexpress.vn/orderCreate');
assert.equal(jt.getCurrentPlatform().id, 'jt');

const viettel = getRuntime('https://viettelpost.vn/order/create');
assert.equal(viettel.getCurrentPlatform().id, 'viettel');

const ghtk = getRuntime('https://khachhang.ghtk.vn/orders');
assert.equal(ghtk.getCurrentPlatform().id, 'ghtk');

console.log('Shortcuts and auto-detect unit tests passed!');
