import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');
const contentSource = fs.readFileSync(path.join(root, 'src/runtime/content/index.js'), 'utf8');

test('a real carrier tracking event is persisted before the panel is cleared', () => {
  const listenerStart = contentSource.indexOf("event.data.type !== 'AF_ORDER_CREATED'");
  assert.notEqual(listenerStart, -1, 'AF_ORDER_CREATED listener must exist');

  // Cắt theo hàm kế tiếp thay vì cửa sổ ký tự cứng, để code thêm logging không làm test giòn.
  const listenerEnd = contentSource.indexOf('function drainOfflineQueue', listenerStart);
  const listener = contentSource.slice(listenerStart, listenerEnd === -1 ? undefined : listenerEnd);
  const persistIndex = listener.indexOf('OrderStorage.saveSubmittedOrder(submittedOrder)');
  const clearIndex = listener.indexOf('handleClearOrder(true)');

  assert.notEqual(persistIndex, -1, 'tracking event must persist the created order');
  assert.notEqual(clearIndex, -1, 'tracking event must clear the completed order from the panel');
  assert.ok(
    persistIndex < clearIndex,
    'created order must be persisted before panel/order context is cleared'
  );
});

test('tracking event retains the approved order after the visible panel has been cleared', () => {
  assert.match(
    contentSource,
    /const parsed = globalThis\.parsedDataStore\s*\|\|\s*globalThis\.__AF_LAST_APPROVED_ORDER__\s*\|\|\s*globalThis\.__AF_LAST_FILLED_ORDER__/,
    'AF_ORDER_CREATED must fall back to the approved/filled snapshot when parsedDataStore was cleared'
  );
});

test('deduplication is marked only after submitted-order persistence succeeds', () => {
  assert.match(contentSource, /function markSubmissionHandled\(/, 'submission guard must expose an explicit post-save mark');
  assert.match(
    contentSource,
    /OrderStorage\.saveSubmittedOrder\(submittedOrder\)\.then\(\(savedOrder\) => \{[\s\S]*?markSubmissionHandled\(/,
    'a submission must only be marked handled after saveSubmittedOrder resolves'
  );
});
