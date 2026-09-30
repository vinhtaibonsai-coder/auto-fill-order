import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

const panelJs = read('frontend/panel/panel.js');
const storageJs = read('src/application/storage.js');
const bulkJs = read('src/ui/options/pages/Workspace/Bulk.jsx');

// 1. Panel UI Verification
assert.ok(panelJs.includes('id="vnpost-draft-queue"'), 'Panel must contain draft queue container');
assert.ok(panelJs.includes('id="btn-draft-prev"'), 'Panel must contain prev draft button');
assert.ok(panelJs.includes('id="btn-draft-next"'), 'Panel must contain next draft button');
assert.ok(panelJs.includes('id="btn-draft-load"'), 'Panel must contain load draft button');
assert.ok(panelJs.includes('id="btn-draft-fill-next"'), 'Panel must contain fill and next button');
assert.ok(panelJs.includes('refreshDraftQueue'), 'Panel must implement refreshDraftQueue');

// 2. Storage Draft Orders Filter Verification
const sandbox = {
  chrome: {
    runtime: {
      id: 'mock-ext-id',
      getManifest: () => ({ version: '1.0.0' })
    },
    storage: {
      local: {
        get: (keys, cb) => cb({}),
        set: (items, cb) => cb?.()
      }
    }
  },
  localStorage: {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
  },
  console
};
sandbox.globalThis = sandbox;
vm.runInNewContext(storageJs, sandbox);
const OrderStorage = sandbox.OrderStorage;

assert.equal(typeof OrderStorage.getDraftOrders, 'function', 'OrderStorage must provide getDraftOrders');

// Mock orders in memory
OrderStorage.getActiveShop = async () => ({ id: 'shop_test_1' });
OrderStorage._getOrdersFromLocal = async () => [
  {
    id: 'ord_1',
    shopId: 'shop_test_1',
    name: 'Khách Nháp 1',
    phone: '0911111111',
    status: 'draft'
  },
  {
    id: 'ord_2',
    shopId: 'shop_test_1',
    name: 'Khách Đã Gửi',
    phone: '0922222222',
    trackingCode: 'VN123456789VN',
    submittedAt: '2026-09-02T10:00:00Z'
  },
  {
    id: 'ord_3',
    shopId: 'shop_test_1',
    name: 'Khách Nháp 2',
    phone: '0933333333',
    status: 'draft'
  }
];

const drafts = await OrderStorage.getDraftOrders();
assert.equal(drafts.length, 2, 'Should only return 2 unsubmitted drafts');
assert.equal(drafts[0].id, 'ord_1');
assert.equal(drafts[1].id, 'ord_3');

// 3. Bulk UI Draft Save Payload Verification
assert.ok(bulkJs.includes("status: 'draft'"), 'Bulk.jsx must tag saved orders with status draft');
assert.ok(bulkJs.includes('rawText: order.rawText'), 'Bulk.jsx must pass rawText for quick review in panel');

console.log('Draft queue workflow unit tests passed!');
