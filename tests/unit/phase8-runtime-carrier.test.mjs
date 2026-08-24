import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');
const readSource = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), 'utf8');

const carrierRuntime = readSource('src/runtime/content/carrier-runtime.js');
const contentIndex = readSource('src/runtime/content/index.js');
const manifest = JSON.parse(readSource('manifest.json'));
const refactorPlan = readSource('PLAN/RUNTIME_CONTENT_REFACTOR_PLAN.md');
const vnpostSelectors = readSource('src/domain/carrier/vnpost/selectors.js');
const vnpostAutofill = readSource('src/domain/carrier/vnpost/autofill.js');
const jtSelectors = readSource('src/domain/carrier/jt/selectors.js');
const jtAutofill = readSource('src/domain/carrier/jt/autofill.js');

function createRuntimeForUrl(url) {
  const sandbox = {
    globalThis: null,
    location: { href: url },
    VNPOST_SELECTORS: { getAccountName: () => 'vnpost-account' },
    JT_SELECTORS: { getAccountName: () => 'jt-account' }
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(carrierRuntime, sandbox);
  return sandbox;
}

const vnpost = createRuntimeForUrl('https://my.vnpost.vn/order/domestic/create');
assert.equal(vnpost.AutoFillCarrierRuntime.getCurrentPlatform().id, 'vnpost', 'VNPost create-order URL must resolve to vnpost');
assert.equal(vnpost.detectCarrierAccount('vnpost'), 'vnpost-account', 'VNPost account detection must delegate to VNPOST_SELECTORS');

const jt = createRuntimeForUrl('https://khachhang.jtexpress.vn/#/orderCreate');
assert.equal(jt.AutoFillCarrierRuntime.getCurrentPlatform().id, 'jt', 'J&T create-order URL must resolve to jt');
assert.equal(jt.detectCarrierAccount('jt'), 'jt-account', 'J&T account detection must delegate to JT_SELECTORS');

const contentScripts = manifest.content_scripts[0].js;
const runtimeIndex = contentScripts.indexOf('src/runtime/content/carrier-runtime.js');
const orchestratorIndex = contentScripts.indexOf('src/runtime/content/index.js');
assert.ok(runtimeIndex >= 0, 'Manifest must load carrier-runtime.js');
assert.ok(orchestratorIndex > runtimeIndex, 'Manifest must load carrier-runtime.js before content index.js');

assert.match(contentIndex, /globalThis\.AutoFillCarrierRuntime/, 'Content orchestrator must consume extracted carrier runtime');
assert.match(contentIndex, /globalThis\.checkUrlAndInject = checkUrlAndInject/, 'Public checkUrlAndInject contract must remain stable');
assert.match(contentIndex, /globalThis\.afTriggerFillForm = triggerFillForm/, 'Public fill contract must remain stable');
assert.match(contentIndex, /globalThis\.afHandleSaveOrder = handleSaveOrder/, 'Public save contract must remain stable');
assert.match(contentIndex, /autofill:parsed/, 'Parsed event contract must remain stable');
assert.match(contentIndex, /order-saved-db/, 'Order saved event contract must remain stable');
assert.match(contentIndex, /request\.action === 'FILL_FROM_BULK'/, 'Bulk fill message contract must remain stable');
assert.match(contentIndex, /request\.type === 'deviceRevoked' \|\| request\.action === 'deviceRevoked'/, 'Device revoked message contract must remain stable');

assert.match(vnpostSelectors, /globalThis\.VNPOST_SELECTORS/, 'VNPost selectors must stay in the VNPost carrier module');
assert.match(vnpostAutofill, /globalThis\.VNPostAdapter/, 'VNPost fill behavior must stay in the VNPost carrier module');
assert.match(jtSelectors, /globalThis\.JT_SELECTORS/, 'J&T selectors must stay in the J&T carrier module');
assert.match(jtAutofill, /globalThis\.JTAdapter/, 'J&T fill behavior must stay in the J&T carrier module');

for (const phrase of [
  'Parser responsibilities',
  'DOM automation responsibilities',
  'State, observers, and interception responsibilities',
  'carrier-runtime.js',
  'Stable Contracts To Preserve'
]) {
  assert.match(refactorPlan, new RegExp(phrase), `Runtime refactor plan must document ${phrase}`);
}

console.log('Phase 8 runtime carrier tests passed.');
