import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');
const readSource = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), 'utf8');

test('AI async response lifecycle gate: content/index.js defines session management functions', () => {
  const contentSource = readSource('src/runtime/content/index.js');

  assert.ok(contentSource.includes('function beginParseSession('), 'content/index.js must define beginParseSession');
  assert.ok(contentSource.includes('function isAiSessionActive('), 'content/index.js must define isAiSessionActive');
  assert.ok(contentSource.includes('function invalidateActiveAiSession('), 'content/index.js must define invalidateActiveAiSession');
  assert.ok(contentSource.includes('globalThis.invalidateActiveAiSession = invalidateActiveAiSession'), 'invalidateActiveAiSession must be exported globally');
});

test('AI async response lifecycle gate: verifyWithAI guards against stale callback execution', () => {
  const contentSource = readSource('src/runtime/content/index.js');

  assert.ok(
    contentSource.includes('!isAiSessionActive(boundSessionId, rawText)'),
    'verifyWithAI must check isAiSessionActive before updating panel'
  );
  assert.ok(
    contentSource.includes("invalidateActiveAiSession('ORDER_SUBMITTED_DOM')"),
    'onSuccess DOM submission must invalidate active AI session'
  );
  assert.ok(
    contentSource.includes("invalidateActiveAiSession('ORDER_SUBMITTED_INTERCEPTOR')"),
    'interceptor submission must invalidate active AI session'
  );
  assert.ok(
    contentSource.includes("invalidateActiveAiSession('ORDER_CLEARED')"),
    'handleClearOrder must invalidate active AI session'
  );
  assert.ok(
    contentSource.includes("window.addEventListener('order-saved-db'"),
    'order-saved-db event must invalidate active AI session'
  );
  assert.ok(
    contentSource.includes("window.addEventListener('autofill:clear-order'"),
    'autofill:clear-order event must invalidate active AI session'
  );
});

test('AI async response lifecycle gate: React Panel App.jsx invalidates gate on confirm and save', () => {
  const panelSource = readSource('src/ui/panel/App.jsx');

  const confirmIndex = panelSource.indexOf('const handleConfirm = async (editedData) => {');
  assert.ok(confirmIndex >= 0, 'App.jsx must define handleConfirm');
  const confirmSlice = panelSource.slice(confirmIndex, confirmIndex + 150);
  assert.ok(
    confirmSlice.includes('asyncResultGate.current.invalidate()'),
    'handleConfirm must invalidate asyncResultGate to cancel in-flight AI results'
  );

  const onSaveIndex = panelSource.indexOf('onSave={() => {');
  assert.ok(onSaveIndex >= 0, 'App.jsx must define onSave');
  const onSaveSlice = panelSource.slice(onSaveIndex, onSaveIndex + 150);
  assert.ok(
    onSaveSlice.includes('asyncResultGate.current.invalidate()'),
    'onSave must invalidate asyncResultGate'
  );
});
