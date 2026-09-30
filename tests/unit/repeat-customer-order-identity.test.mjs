import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const storage = fs.readFileSync(path.join(root, 'src/application/storage.js'), 'utf8');
const match = storage.match(/function isSameSubmittedOrder\(existing, incoming\) \{[\s\S]*?\n  \}/);
assert.ok(match, 'OrderStorage must centralize submitted-order identity matching');
const context = {};
vm.runInNewContext(`${match[0]}; this.isSameSubmittedOrder = isSameSubmittedOrder;`, context);

const oldOrder = { id: 'old', name: 'Nguyễn An', phone: '0901234567', orderCode: 'E90.100', codAmount: 400000 };
const repeatPurchase = { id: 'new', name: 'Nguyễn An', phone: '0901234567', orderCode: 'E90.200', codAmount: 400000 };
assert.equal(context.isSameSubmittedOrder(oldOrder, repeatPurchase), false, 'A different order code must create a new purchase');
assert.equal(context.isSameSubmittedOrder(oldOrder, { ...oldOrder, id: 'retry' }), true, 'Same order code must remain idempotent');
assert.equal(context.isSameSubmittedOrder({ ...oldOrder, trackingCode: 'VN123' }, { ...repeatPurchase, trackingCode: 'VN123' }), true, 'Same tracking code identifies the same shipment');

const history = fs.readFileSync(path.join(root, 'src/application/history/history.js'), 'utf8');
assert.match(history, /sameOrderCode/, 'Split history must not collapse repeat purchases with different order codes');
const submittedPage = fs.readFileSync(path.join(root, 'src/ui/options/pages/Orders/SubmittedOrders.jsx'), 'utf8');
assert.doesNotMatch(submittedPage, /keys\.push\('ph_'|keys\.push\('pn_'/, 'Submitted Orders must not hide repeat purchases by customer identity');
const contentRuntime = fs.readFileSync(path.join(root, 'src/runtime/content/index.js'), 'utf8');
assert.doesNotMatch(contentRuntime, /keys\.push\('ph_'|keys\.push\('pn_'/, 'Submission event guard must not block a new order from the same customer');
const cloud = fs.readFileSync(path.join(root, 'src/infrastructure/supabase/client.js'), 'utf8');
assert.doesNotMatch(cloud, /sub_cust_/, 'Cloud submitted-order ids must never be derived from customer identity');
const worker = fs.readFileSync(path.join(root, 'src/runtime/service-worker/service-worker.js'), 'utf8');
assert.match(worker, /targetOrderCode \? codeMatched : \(phoneMatched && nameMatched\)/, 'Background waybill matching must require the order code whenever one exists');
console.log('Repeat customer order identity regression tests passed.');
