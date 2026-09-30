import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

// 1. Verify frontend/panel/panel.js declares txtArea before using it
const panelJs = read('frontend/panel/panel.js');
assert.ok(
  panelJs.includes("const txtArea = root.getElementById('rawOrderText');"),
  'panel.js must declare const txtArea = root.getElementById(\'rawOrderText\');'
);

const declIndex = panelJs.indexOf("const txtArea = root.getElementById('rawOrderText');");
const firstUseIndex = panelJs.indexOf("txtArea.value = d.rawText");
const focusListenerIndex = panelJs.indexOf("txtArea.addEventListener('focus'");

assert.ok(declIndex !== -1, 'txtArea declaration must exist');
assert.ok(firstUseIndex === -1 || declIndex < firstUseIndex, 'txtArea must be declared before loadCurrentDraftToReview uses it');
assert.ok(focusListenerIndex === -1 || declIndex < focusListenerIndex, 'txtArea must be declared before event listeners are attached');

// 2. Verify extension/ has NO illegal files (desktop.ini, thumbs.db, .ds_store)
function checkNoIllegalFiles(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const lower = entry.name.toLowerCase();
    assert.notEqual(lower, 'desktop.ini', `Found illegal file desktop.ini at ${fullPath}`);
    assert.notEqual(lower, 'thumbs.db', `Found illegal file thumbs.db at ${fullPath}`);
    assert.notEqual(lower, '.ds_store', `Found illegal file .DS_Store at ${fullPath}`);
    if (entry.isDirectory()) {
      checkNoIllegalFiles(fullPath);
    }
  }
}

checkNoIllegalFiles(path.join(root, 'extension'));

// 3. Verify sync-extension.js has filtering for illegal files
const syncJs = read('scripts/sync-extension.js');
assert.ok(syncJs.includes('desktop.ini'), 'sync-extension.js must explicitly filter desktop.ini');
assert.ok(syncJs.includes('cleanIllegalFiles'), 'sync-extension.js must run cleanIllegalFiles');

console.log('✅ txtArea definition and clean extension files regression tests passed!');
