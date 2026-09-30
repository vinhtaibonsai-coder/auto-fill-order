import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

const panelJs = read('frontend/panel/panel.js');
const storageJs = read('src/application/storage.js');
const orderListJs = read('src/ui/options/pages/Workspace/OrderList.jsx');
const orderSettingsJs = read('src/ui/options/pages/General/OrderSettings.jsx');
const stylesJs = read('frontend/panel/styling/styles.js');

// 1. Panel Layout & Markup Verification
assert.ok(panelJs.includes('id="vnpost-btn-toggle-draft-queue"'), 'Panel header must contain draft queue toggle button');
assert.ok(panelJs.includes('id="header-draft-count-badge"'), 'Panel header must contain draft count badge');
assert.ok(panelJs.includes('draft-queue-primary-row'), 'Panel must structure primary actions in primary row');
assert.ok(panelJs.includes('draft-queue-secondary-row'), 'Panel must structure secondary actions in secondary row');
assert.ok(panelJs.includes('btn-draft-action-ghost-danger'), 'Panel must have ghost danger delete button');
assert.ok(panelJs.includes('btn-draft-action-ghost-warning'), 'Panel must have ghost warning clear all button');
assert.ok(panelJs.includes('draft_queue_enabled'), 'Panel controller must respect draft_queue_enabled preference');

// 2. CSS Styles Verification
assert.ok(stylesJs.includes('.draft-queue-primary-row'), 'styles.js must define .draft-queue-primary-row');
assert.ok(stylesJs.includes('.draft-queue-secondary-row'), 'styles.js must define .draft-queue-secondary-row');
assert.ok(stylesJs.includes('.btn-draft-action-ghost-danger'), 'styles.js must define .btn-draft-action-ghost-danger');
assert.ok(stylesJs.includes('.btn-draft-action-ghost-warning'), 'styles.js must define .btn-draft-action-ghost-warning');
assert.ok(stylesJs.includes('.header-draft-badge'), 'styles.js must define .header-draft-badge');

// 3. Options UI Verification
assert.ok(orderListJs.includes('handleToggleQueue'), 'OrderList.jsx must provide handleToggleQueue');
assert.ok(orderListJs.includes('draft_queue_enabled'), 'OrderList.jsx must read/write draft_queue_enabled');
assert.ok(orderListJs.includes('draft_queue_updated_at'), 'OrderList.jsx must touch draft_queue_updated_at on deletion');
assert.ok(orderSettingsJs.includes('showDraftQueue'), 'OrderSettings.jsx must support showDraftQueue');
assert.ok(orderSettingsJs.includes('draft_queue_enabled'), 'OrderSettings.jsx must sync draft_queue_enabled');

// 4. Storage Deletion & Real-time Synchronization Contract
let storageState = {};
let messagesSent = [];
let dispatchedEvents = [];

const sandbox = {
  chrome: {
    runtime: {
      id: 'mock-ext-id',
      getManifest: () => ({ version: '1.0.0' }),
      sendMessage: (msg, cb) => {
        messagesSent.push(msg);
        if (typeof cb === 'function') cb([]);
      }
    },
    storage: {
      local: {
        get: (keys, cb) => {
          const res = {};
          if (Array.isArray(keys)) {
            keys.forEach(k => { res[k] = storageState[k]; });
          } else if (typeof keys === 'string') {
            res[keys] = storageState[keys];
          }
          cb(res);
        },
        set: (items, cb) => {
          Object.assign(storageState, items);
          cb?.();
        }
      }
    }
  },
  localStorage: {
    getItem: (k) => storageState[k] !== undefined ? JSON.stringify(storageState[k]) : null,
    setItem: (k, v) => {
      try { storageState[k] = JSON.parse(v); } catch (_) { storageState[k] = v; }
    },
    removeItem: (k) => { delete storageState[k]; }
  },
  window: {
    dispatchEvent: (evt) => { dispatchedEvents.push(evt); }
  },
  CustomEvent: class {
    constructor(type, options) {
      this.type = type;
      this.detail = options?.detail;
    }
  },
  console
};
sandbox.globalThis = sandbox;
vm.runInNewContext(storageJs, sandbox);
const OrderStorage = sandbox.OrderStorage;

// Setup existing draft orders
const testOrders = [
  { id: 'draft_1', name: 'Nguyễn Văn A', phone: '0911111111' },
  { id: 'draft_2', name: 'Lê Thị B', phone: '0922222222' }
];

await OrderStorage._saveOrdersToLocal(testOrders);
assert.ok(storageState.draft_queue_updated_at > 0, 'Saving orders must stamp draft_queue_updated_at');

const draftsBefore = await OrderStorage.getDraftOrders();
assert.equal(draftsBefore.length, 2, 'Should have 2 draft orders initially');

// Delete all drafts
const deleteRes = await OrderStorage.deleteBulkOrders(['draft_1', 'draft_2']);
assert.equal(deleteRes.success, 2, 'Should report 2 orders successfully deleted');

const draftsAfter = await OrderStorage.getDraftOrders();
assert.equal(draftsAfter.length, 0, 'Draft orders list must now be empty');
assert.ok(messagesSent.some(m => m.action === 'draftOrdersUpdated' && m.count === 0), 'Must send runtime message draftOrdersUpdated with count 0');
assert.ok(dispatchedEvents.some(e => e.type === 'draft-queue-updated' && e.detail.count === 0), 'Must dispatch draft-queue-updated event with count 0');

console.log('🎉 ALL DRAFT QUEUE TOGGLE, 2-TIER LAYOUT & REALTIME SYNC TESTS PASSED!');
