import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

const viettelSelectors = read('src/domain/carrier/viettelpost/selectors.js');
const viettelAutofill = read('src/domain/carrier/viettelpost/autofill.js');
const ghtkSelectors = read('src/domain/carrier/ghtk/selectors.js');
const ghtkAutofill = read('src/domain/carrier/ghtk/autofill.js');
const manifest = JSON.parse(read('manifest.json'));

const sandbox = {};
sandbox.globalThis = sandbox;
vm.runInNewContext(viettelSelectors, sandbox);
vm.runInNewContext(viettelAutofill, sandbox);
vm.runInNewContext(ghtkSelectors, sandbox);
vm.runInNewContext(ghtkAutofill, sandbox);

// 1. Viettel Post
assert.ok(sandbox.VIETTELPOST_SELECTORS, 'VIETTELPOST_SELECTORS must be defined');
assert.ok(Array.isArray(sandbox.VIETTELPOST_SELECTORS.phoneFallbacks), 'phoneFallbacks must be an array');
assert.ok(sandbox.ViettelPostAdapter, 'ViettelPostAdapter must be defined');
assert.equal(typeof sandbox.ViettelPostAdapter.fillForm, 'function', 'ViettelPostAdapter must implement fillForm');

// 2. GHTK
assert.ok(sandbox.GHTK_SELECTORS, 'GHTK_SELECTORS must be defined');
assert.ok(Array.isArray(sandbox.GHTK_SELECTORS.phoneFallbacks), 'phoneFallbacks must be an array');
assert.ok(sandbox.GHTKAdapter, 'GHTKAdapter must be defined');
assert.equal(typeof sandbox.GHTKAdapter.fillForm, 'function', 'GHTKAdapter must implement fillForm');

// 3. Manifest script inclusions
const scripts = manifest.content_scripts[0].js;
assert.ok(scripts.includes('src/domain/carrier/viettelpost/selectors.js'));
assert.ok(scripts.includes('src/domain/carrier/viettelpost/autofill.js'));
assert.ok(scripts.includes('src/domain/carrier/ghtk/selectors.js'));
assert.ok(scripts.includes('src/domain/carrier/ghtk/autofill.js'));

console.log('Viettel Post and GHTK carrier unit tests passed!');
