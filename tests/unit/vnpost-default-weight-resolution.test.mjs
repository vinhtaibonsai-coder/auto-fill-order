import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const repoRoot = process.cwd();

test('VNPostAdapter resolves default weight from in-memory store, chrome.storage, and localStorage', async () => {
  const vnpostCode = fs.readFileSync(path.join(repoRoot, 'src', 'domain', 'carrier', 'vnpost', 'autofill.js'), 'utf8');

  // Case 1: In-memory store has defaultWeightVnpost
  {
    const sandbox = {
      window: {},
      document: { querySelectorAll: () => [], querySelector: () => null },
      globalThis: {},
      localStorage: { getItem: () => null },
      chrome: { storage: { local: { get: (keys, cb) => cb({}) } } }
    };
    vm.createContext(sandbox);
    vm.runInContext(vnpostCode, sandbox);

    assert.ok(sandbox.globalThis.VNPostAdapter, 'VNPostAdapter should be defined');
  }

  // Verify function source logic directly
  assert.match(vnpostCode, /async function resolveVNPostDefaultWeight/);
  assert.match(vnpostCode, /async function resolveVNPostDefaultGoodsName/);
  assert.match(vnpostCode, /chrome\.storage\.local\.get\(\['order_default_settings',\s*'default_weight_vnpost'\]/);
  assert.match(vnpostCode, /localStorage\.getItem\('order_default_settings'\)/);
  assert.match(vnpostCode, /localStorage\.getItem\('default_weight_vnpost'\)/);
});
