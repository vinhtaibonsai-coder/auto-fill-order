import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');
const readSource = (relPath) => fs.readFileSync(path.join(rootDir, relPath), 'utf8');

const contentSrc = readSource('src/runtime/content/index.js');

// 1. Must implement updateSingleCarrierFieldInDOM
assert.match(contentSrc, /function updateSingleCarrierFieldInDOM\s*\(/, 'Must define updateSingleCarrierFieldInDOM');

// 2. updateParsedField must pass (field, value) to scheduleCarrierRefillAfterEdit
assert.match(contentSrc, /scheduleCarrierRefillAfterEdit\s*\(\s*field\s*,\s*value\s*\)/, 'updateParsedField must pass field and value');

// 3. scheduleCarrierRefillAfterEdit must call updateSingleCarrierFieldInDOM and NEVER call triggerFillForm
const scheduleFnMatch = contentSrc.match(/function scheduleCarrierRefillAfterEdit[\s\S]*?\n  \}/);
assert.ok(scheduleFnMatch, 'Must find scheduleCarrierRefillAfterEdit definition');
const scheduleFnSrc = scheduleFnMatch[0];
assert.match(scheduleFnSrc, /updateSingleCarrierFieldInDOM\s*\(/, 'scheduleCarrierRefillAfterEdit must call updateSingleCarrierFieldInDOM');
assert.doesNotMatch(scheduleFnSrc, /triggerFillForm\s*\(/, 'scheduleCarrierRefillAfterEdit must NOT re-trigger full form fill');

// 4. Must support surgical updates for specific fields
assert.match(contentSrc, /field === 'codAmount'[\s\S]*?updateCodInputInDOM/, 'Must update only COD for codAmount');
assert.match(contentSrc, /field === 'name'/, 'Must support surgical update for name');
assert.match(contentSrc, /field === 'phone'/, 'Must support surgical update for phone');
assert.match(contentSrc, /field === 'orderCode'/, 'Must support surgical update for orderCode');
assert.match(contentSrc, /field === 'address'/, 'Must support surgical update for address');

console.log('✅ ALL PANEL SURGICAL FIELD EDIT TESTS PASSED (100%)');
