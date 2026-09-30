import assert from 'node:assert/strict';
import fs from 'node:fs';

const panel = fs.readFileSync(new URL('../../frontend/panel/panel.js', import.meta.url), 'utf8');
const styles = fs.readFileSync(new URL('../../frontend/panel/styling/styles.js', import.meta.url), 'utf8');

assert.match(panel, /id="panel-empty-state"/, 'Initial panel must render a focused empty state');
assert.match(panel, /id="panel-validation-error"/, 'Panel must render a validation error state');
assert.match(panel, /id="btnFillVNPost"[^>]+disabled/, 'Fill must start disabled');
assert.match(panel, /id="btnSaveOrder"[^>]+disabled/, 'Save must start disabled');
assert.match(panel, /missingChecks\.length[\s\S]*setActionsEnabled\(false\)/, 'Missing required data must keep actions disabled');
assert.match(panel, /setActionsEnabled\(true\)/, 'Valid parsed data must enable actions');
assert.match(panel, /id="panel-account-menu"/, 'Compact account header must expose a disclosure menu');
assert.match(panel, /parse-step-address/, 'Parsing state must explain address normalization progress');
assert.match(styles, /\.panel-empty-state/, 'Empty state must have dedicated styling');

console.log('Panel state-machine contracts passed.');
