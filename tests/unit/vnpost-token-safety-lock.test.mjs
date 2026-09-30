import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('VNPost Webhook Token Safety Lock Invariants in Carriers.jsx', () => {
  const carriersPath = path.resolve('src/ui/options/pages/Carriers/Carriers.jsx');
  assert.ok(fs.existsSync(carriersPath), 'Carriers.jsx must exist');

  const content = fs.readFileSync(carriersPath, 'utf8');

  // 1. Invariant: Must have safety states (isTokenLocked, originalToken, showConfirmTokenModal)
  assert.ok(content.includes('isTokenLocked'), 'Must define isTokenLocked state');
  assert.ok(content.includes('originalToken'), 'Must define originalToken state');
  assert.ok(content.includes('showConfirmTokenModal'), 'Must define showConfirmTokenModal state');

  // 2. Invariant: Token input must be readOnly when locked
  assert.ok(content.includes('readOnly={isTokenLocked}'), 'Token input must be readOnly when locked');

  // 3. Invariant: Must have Revert button to restore original token
  assert.ok(content.includes('handleRevertToken'), 'Must provide handleRevertToken handler');
  assert.ok(content.includes('Khôi phục Token gốc'), 'Must display Revert button');

  // 4. Invariant: handleGenToken must NOT write directly to chrome.storage.local before saving
  const genTokenBlock = content.match(/const handleGenToken = \(\) => \{([\s\S]*?)\};/);
  assert.ok(genTokenBlock, 'handleGenToken must be defined');
  assert.ok(!genTokenBlock[1].includes('chrome.storage.local.set'), 'handleGenToken must NOT prematurely overwrite chrome.storage.local');

  // 5. Invariant: Must display confirmation modal warning about VNPost re-configuration
  assert.ok(content.includes('Xác Nhận Thay Đổi Token Bảo Mật'), 'Confirmation modal must be present');
  assert.ok(content.includes('Giữ nguyên Token cũ (An toàn)'), 'Safe dismiss option must be available');
});
