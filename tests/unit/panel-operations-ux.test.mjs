import assert from 'node:assert/strict';
import fs from 'node:fs';

const panel = fs.readFileSync(new URL('../../frontend/panel/panel.js', import.meta.url), 'utf8');
const styles = fs.readFileSync(new URL('../../frontend/panel/styling/styles.js', import.meta.url), 'utf8');
const toast = fs.readFileSync(new URL('../../frontend/panel/toast/toast.js', import.meta.url), 'utf8');

assert.ok(panel.indexOf('id="gemini-progress-container"') > panel.indexOf('id="panel-sticky-footer"'), 'Progress must live at the bottom of the sticky footer');
assert.match(styles, /\.cod-primary-val[\s\S]*#dc2626/, 'COD amount must use a high-attention red');
assert.match(toast, /sanitizeToastMessage/, 'Toast must centrally remove decorative message emoji');
assert.match(toast, /resolveToastType/, 'Toast must centrally normalize success, error and warning semantics');
assert.match(panel, /id="customer-history-search"/, 'Panel must support customer lookup by name or phone');
assert.match(panel, /OrderStorage\.getSubmittedOrders/, 'Customer lookup must use submitted-order history');
assert.match(panel, /Mã đơn:.*order\.orderCode/, 'Customer history must show the order code for purchase comparison');
assert.match(styles, /customer-history-count-badge/, 'Customer history must show a compact successful-order count badge');

console.log('Panel operations UX contracts passed.');
