import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();

test('VNPost autofill defines store and protects against search input hijacking', () => {
  const vnpostPath = path.join(repoRoot, 'src', 'domain', 'carrier', 'vnpost', 'autofill.js');
  assert.ok(fs.existsSync(vnpostPath), 'autofill.js must exist');

  const content = fs.readFileSync(vnpostPath, 'utf8');

  // 1. Must define store at beginning of fill
  assert.match(content, /const store = globalThis\.parsedDataStore \|\| \{\};/, 'Must define store in fill');

  // 2. Must filter out search inputs
  assert.match(content, /isSearchOrFilterInput/, 'Must implement search/filter input detection');
  assert.match(content, /findVNPostOrderCodeEl/, 'Must implement safe order code lookup');

  // 3. Must not use naked input[placeholder*="mã đơn" i] at document level without search check
  assert.doesNotMatch(
    content,
    /orderCodeEl\s*=\s*document\.querySelector\('[^']*mã đơn[^']*'\)/,
    'Must not directly query global document placeholder for mã đơn without search protection'
  );

  // 4. Must support separate goods name and content
  assert.match(content, /separateGoodsEl/, 'Must support separate goods name element');

  // 5. Must await autoCOD
  assert.match(content, /await autoCOD\(codAmount\)/, 'Must await autoCOD');
});
