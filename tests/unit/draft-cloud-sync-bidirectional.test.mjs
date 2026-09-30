import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

const appJs = read('src/ui/index/App.jsx');
const clientJs = read('src/infrastructure/supabase/client.js');
const storageJs = read('src/application/storage.js');
const orderListJs = read('src/ui/options/pages/Workspace/OrderList.jsx');
const serviceWorkerJs = read('src/runtime/service-worker/service-worker.js');

console.log('🧪 Running Bidirectional Draft Order Cloud Sync Tests...');

// Test 1: Static Code Contract Verification
// App.jsx must save locally AND post to Supabase Cloud without mutually exclusive else block
assert.ok(appJs.includes('savedOrder = await OrderStorage.saveOrder(orderData)'), 'App.jsx must save order locally via OrderStorage');
assert.ok(appJs.includes('rest/v1/orders'), 'App.jsx must post to rest/v1/orders');
assert.ok(appJs.includes('draft_queue_updated_at'), 'App.jsx must update draft_queue_updated_at');
assert.ok(appJs.includes('draft-queue-updated'), 'App.jsx must dispatch draft-queue-updated event');

// OrderList.jsx must call getOrders(true) and have manual sync button
assert.ok(orderListJs.includes('loadOrders(true)'), 'OrderList.jsx must support force sync on load');
assert.ok(orderListJs.includes('Đồng bộ Cloud'), 'OrderList.jsx must have a "Đồng bộ Cloud" button');
assert.ok(orderListJs.includes('draft-queue-updated'), 'OrderList.jsx must listen for draft-queue-updated');

// service-worker.js must forward shopId to fetchFn
assert.ok(serviceWorkerJs.includes('fetchFn(message.shopId || null)'), 'service-worker.js must forward shopId to fetchFn');

// Test 2: SupabaseCloud pushOrder in webapp environment (no chrome.runtime)
let fetchCalls = [];
let targetShopId = 'c201e6bc-8986-4f91-b900-e319865d1907';

const mockFetch = async (url, options = {}) => {
  fetchCalls.push({ url, options });
  if (url.includes('orders')) {
    if (options.method === 'POST') {
      return { ok: true, status: 201, json: async () => [{ id: 'mock-uuid-1', status: 'draft' }] };
    }
    if (options.method === 'GET' || !options.method) {
      return {
        ok: true,
        json: async () => [
          {
            id: 'ord_cloud_123',
            shop_id: targetShopId,
            name: 'Nguyen Van A',
            phone: '0901234567',
            address: '123 Le Loi, Q1, HCM',
            order_code: 'DH1001',
            cod_amount: 150000,
            status: 'draft',
            created_at: new Date().toISOString()
          }
        ]
      };
    }
    if (options.method === 'DELETE') {
      return { ok: true, status: 204 };
    }
  }
  return { ok: true, json: async () => ({}) };
};

const sandbox = {
  fetch: mockFetch,
  window: {}, // Simulate browser window / webapp
  chrome: undefined, // Simulating webapp where chrome is undefined
  localStorage: {
    _data: {
      'vnpost_session': JSON.stringify({
        access_token: 'fake.jwt.token',
        active_shop_id: targetShopId,
        user: { id: 'usr-1' }
      })
    },
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = String(v); },
    removeItem(k) { delete this._data[k]; }
  },
  console: {
    warn: () => {},
    log: () => {},
    error: () => {}
  },
  Date,
  Math,
  String,
  Number,
  Array,
  Set,
  Map,
  JSON,
  Promise,
  encodeURIComponent
};

vm.createContext(sandbox);

// Run client.js in sandbox
vm.runInContext(clientJs, sandbox);
assert.ok(sandbox.SupabaseCloud, 'SupabaseCloud must be defined in sandbox');

// Override config in sandbox
sandbox.SupabaseCloud._savedUrl = 'https://mock.supabase.co';
sandbox.SupabaseCloud._savedAnonKey = 'mock-anon-key';

// Test pushOrder without chrome.runtime
const pushResult = await sandbox.SupabaseCloud.pushOrder({
  name: 'Test Customer',
  phone: '0987654321',
  address: '456 Tran Hung Dao',
  orderCode: 'DH2002',
  codAmount: 250000,
  shopId: targetShopId
});

assert.strictEqual(pushResult, true, 'SupabaseCloud.pushOrder must succeed without throwing when chrome.runtime is undefined');
const postCall = fetchCalls.find(c => c.url.includes('/rest/v1/orders') && c.options.method === 'POST');
assert.ok(postCall, 'pushOrder must execute direct REST POST to /rest/v1/orders');
const postBody = JSON.parse(postCall.options.body);
assert.strictEqual(postBody[0].name, 'Test Customer');
assert.strictEqual(postBody[0].phone, '0987654321');
assert.strictEqual(postBody[0].order_code, 'DH2002');
assert.strictEqual(postBody[0].cod_amount, 250000);

// Test fetchOrders
const fetchedCloudOrders = await sandbox.SupabaseCloud.fetchOrders(targetShopId);
assert.strictEqual(fetchedCloudOrders.length, 1);
assert.strictEqual(fetchedCloudOrders[0].orderCode, 'DH1001');
assert.strictEqual(fetchedCloudOrders[0].name, 'Nguyen Van A');

// Test 3: OrderStorage.getOrders merging with Cloud orders
// Inject SupabaseCloud into sandbox for storage.js
sandbox.globalThis = sandbox;
sandbox.globalThis.SupabaseCloud = sandbox.SupabaseCloud;
sandbox.globalThis.OrderStorage = undefined;

vm.runInContext(storageJs, sandbox);
const OrderStorage = sandbox.OrderStorage;
assert.ok(OrderStorage, 'OrderStorage must be defined in sandbox');

const activeShop = await OrderStorage.getActiveShop();
targetShopId = activeShop.id;

// Seed local storage with an existing local order
await OrderStorage._saveOrdersToLocal([
  {
    id: 'ord_local_999',
    shopId: targetShopId,
    name: 'Local Customer',
    phone: '0912345678',
    orderCode: 'DH999',
    createdAt: '2026-09-20 10:00'
  }
]);

// Fetch orders with cloud sync
const mergedOrders = await OrderStorage.getOrders(true);
assert.ok(Array.isArray(mergedOrders), 'getOrders must return an array');
assert.strictEqual(mergedOrders.length, 2, 'getOrders must merge both the cloud order and local-only order');

const hasCloudOrder = mergedOrders.some(o => o.orderCode === 'DH1001');
const hasLocalOrder = mergedOrders.some(o => o.orderCode === 'DH999');
assert.ok(hasCloudOrder, 'Merged orders must include cloud draft order DH1001');
assert.ok(hasLocalOrder, 'Merged orders must include local draft order DH999');

// Test 4: Deduplication when cloud order has same orderCode as local order
await OrderStorage._saveOrdersToLocal([
  {
    id: 'ord_local_duplicate',
    shopId: targetShopId,
    name: 'Nguyen Van A',
    phone: '0901234567',
    orderCode: 'DH1001', // Same as cloud
    createdAt: '2026-09-19 10:00'
  }
]);

const deduplicatedOrders = await OrderStorage.getOrders(true);
const matchingOrders = deduplicatedOrders.filter(o => o.orderCode === 'DH1001');
assert.strictEqual(matchingOrders.length, 1, 'Orders with duplicate orderCode between cloud and local must be deduplicated to exactly 1');

console.log('✅ ALL BIDIRECTIONAL DRAFT ORDER CLOUD SYNC TESTS PASSED (100%)');
