import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

test('Order Submit Panel Clear and Create New Order Clear Rule', () => {
  const contentJs = fs.readFileSync(path.join(process.cwd(), 'src/runtime/content/index.js'), 'utf8');

  // Extract the setupAutoSaveOnSubmit function block
  const setupMatch = contentJs.match(/function setupAutoSaveOnSubmit[\s\S]*?\n  \}/);
  assert.ok(setupMatch, 'setupAutoSaveOnSubmit function must exist');
  const setupBlock = setupMatch[0];

  // 1. Invariant: setupAutoSaveOnSubmit MUST call handleClearOrder(true) on successful submission
  assert.match(
    setupBlock,
    /handleClearOrder\(true\)/,
    'setupAutoSaveOnSubmit must call handleClearOrder(true) upon successful order creation to prevent duplicate alerts'
  );

  // 2. Invariant: Review modal approval MUST clear order data on panel
  assert.match(
    contentJs,
    /approval\.confirmed[\s\S]*?handleClearOrder\(true\)/,
    'handleCarrierSubmitClick must call handleClearOrder(true) when order is approved'
  );

  // 3. Invariant: Click listener must listen in capture phase for "Tạo đơn hàng mới"
  assert.match(
    contentJs,
    /document\.addEventListener\('click',\s*\(e\)\s*=>\s*\{[\s\S]*?tạo đơn hàng mới[\s\S]*?handleClearOrder\(true\)[\s\S]*?\},\s*true\);/,
    'Click listener must capture "Tạo đơn hàng mới" in capture phase and call handleClearOrder(true)'
  );

  // 4. Invariant: Click listener supports variations like "Tạo đơn mới", "Tạo vận đơn mới", "Làm mới" footer
  assert.match(contentJs, /tạo vận đơn mới/, 'Listener must support "tạo vận đơn mới"');
  assert.match(contentJs, /refresh_create_order/, 'Listener must support VNPost footer refresh button');
});
