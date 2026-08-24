import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');
const readSource = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), 'utf8');

const panelApp = readSource('src/ui/panel/App.jsx');
const confidenceReview = readSource('src/ui/panel/components/ConfidenceReview.jsx');
const runtime = readSource('src/runtime/content/index.js');

assert.doesNotMatch(panelApp, /SaaS administration|SYSTEM_ADMIN/, 'Panel must remain a worker operation surface');
assert.match(panelApp, /state === 'LOADING'/, 'Panel must render a loading state');
assert.match(panelApp, /state === 'ERROR'/, 'Panel must render an error state');
assert.match(panelApp, /degrade gracefully using local parsed data/, 'Panel must expose partial AI failure fallback');

for (const field of ['rawAddress', 'normalizedAddress', 'province', 'ward', 'addressSource']) {
  assert.match(panelApp, new RegExp(field), `Panel result must include ${field}`);
  assert.match(confidenceReview, new RegExp(field), `Review UI must display ${field}`);
}

assert.match(confidenceReview, /needsReview && !lowConfidenceReviewed/, 'Low-confidence autofill must require explicit review');
assert.match(confidenceReview, /Tôi đã đối chiếu/, 'Low-confidence review acknowledgement must be visible');

const detectIndex = runtime.indexOf('const platform = getCurrentPlatform()');
const findFormIndex = runtime.indexOf("const inputEl = await waitFor");
const fillIndex = runtime.indexOf('await adapter.fill');
const verifyIndex = runtime.indexOf("showVnpostToast('✅ Đã điền đơn thành công!'");
assert.ok(detectIndex >= 0, 'Runtime must detect the carrier');
assert.ok(findFormIndex > detectIndex, 'Runtime must find the carrier form after detection');
assert.ok(fillIndex > findFormIndex, 'Runtime must fill only after finding the form');
assert.ok(verifyIndex > fillIndex, 'Runtime must report verification only after fill completes');

console.log('Phase 5 panel workflow tests passed.');
