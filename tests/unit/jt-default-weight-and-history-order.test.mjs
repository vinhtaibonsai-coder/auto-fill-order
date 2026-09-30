import assert from 'node:assert/strict';
import fs from 'node:fs';

const jt = fs.readFileSync(new URL('../../src/domain/carrier/jt/autofill.js', import.meta.url), 'utf8');
const panel = fs.readFileSync(new URL('../../frontend/panel/panel.js', import.meta.url), 'utf8');

assert.match(jt, /chrome\.storage\.local\.get\(\[[^\]]*default_weight_jt[^\]]*\]/, 'J&T must read the persisted default weight');
assert.match(jt, /await resolveJTDefaultWeight/, 'J&T fill must await the configured weight before writing the field');

const reviewIndex = panel.indexOf('id="review-panel"');
const historyIndex = panel.indexOf('id="customer-history-card"');
const footerIndex = panel.indexOf('id="panel-sticky-footer"');
assert.ok(historyIndex > reviewIndex && historyIndex < footerIndex, 'Customer history must sit below review and above the sticky footer');

console.log('J&T default weight and customer-history placement contracts passed.');
