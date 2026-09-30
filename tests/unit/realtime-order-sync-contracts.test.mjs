import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');

// 1. App.jsx Realtime Channels
const appCode = read('src/ui/options/App.jsx');
assert.match(appCode, /table:\s*'submitted_orders'/, 'App.jsx must subscribe to submitted_orders in realtime');
assert.match(appCode, /table:\s*'orders'/, 'App.jsx must subscribe to orders in realtime');
assert.match(appCode, /table:\s*'customers'/, 'App.jsx must subscribe to customers in realtime');
assert.match(appCode, /table:\s*'customer_order_links'/, 'App.jsx must subscribe to customer_order_links in realtime');
assert.match(appCode, /submitted-orders-updated/, 'App.jsx must dispatch submitted-orders-updated on realtime change');
assert.match(appCode, /customer-hub-updated/, 'App.jsx must dispatch customer-hub-updated on realtime change');

// 2. SubmittedOrders.jsx Realtime Listeners
const submittedOrdersCode = read('src/ui/options/pages/Orders/SubmittedOrders.jsx');
assert.match(submittedOrdersCode, /submitted-orders-updated/, 'SubmittedOrders.jsx must listen for submitted-orders-updated event');
assert.match(submittedOrdersCode, /orders-updated/, 'SubmittedOrders.jsx must listen for orders-updated event');
assert.match(submittedOrdersCode, /order-saved-db/, 'SubmittedOrders.jsx must listen for order-saved-db event');
assert.match(submittedOrdersCode, /chrome\.storage\.onChanged\.addListener/, 'SubmittedOrders.jsx must listen for storage changes');

// 3. CustomerHub.jsx Realtime Listeners
const customerHubCode = read('src/ui/options/pages/Customers/CustomerHub.jsx');
assert.match(customerHubCode, /customer-hub-updated/, 'CustomerHub.jsx must listen for customer-hub-updated event');
assert.match(customerHubCode, /submitted-orders-updated/, 'CustomerHub.jsx must listen for submitted-orders-updated event');
assert.match(customerHubCode, /chrome\.storage\.onChanged\.addListener/, 'CustomerHub.jsx must listen for storage changes');

// 4. Overview.jsx Realtime Listeners
const overviewCode = read('src/ui/options/pages/Overview/Overview.jsx');
assert.match(overviewCode, /submitted-orders-updated/, 'Overview.jsx must listen for submitted-orders-updated event');
assert.match(overviewCode, /orders-updated/, 'Overview.jsx must listen for orders-updated event');
assert.match(overviewCode, /chrome\.storage\.onChanged\.addListener/, 'Overview.jsx must listen for storage changes');

// 5. OrderList.jsx Realtime Listeners
const orderListCode = read('src/ui/options/pages/Workspace/OrderList.jsx');
assert.match(orderListCode, /orders-updated/, 'OrderList.jsx must listen for orders-updated event');
assert.match(orderListCode, /draft-queue-updated/, 'OrderList.jsx must listen for draft-queue-updated event');

// 6. Storage.js Event Dispatching
const storageCode = read('src/application/storage.js');
assert.match(storageCode, /order_submitted/, 'storage.js must broadcast order_submitted message on saveSubmittedOrder');
assert.match(storageCode, /submitted-orders-updated/, 'storage.js must dispatch submitted-orders-updated event on saveSubmittedOrder');
assert.match(storageCode, /draft-queue-updated/, 'storage.js must dispatch draft-queue-updated event on saveOrder');

// 7. Service Worker Multi-Tab Relay
const swCode = read('src/runtime/service-worker/service-worker.js');
assert.match(swCode, /order_submitted/, 'service-worker.js must relay order_submitted to all tabs');
assert.match(swCode, /refresh_orders/, 'service-worker.js must relay refresh_orders to all tabs');

// 8. Admin Dashboard Realtime
const adminAppCode = read('src/ui/admin-dashboard/App.jsx');
assert.match(adminAppCode, /table:\s*'submitted_orders'/, 'admin App.jsx must subscribe to submitted_orders');
assert.match(adminAppCode, /table:\s*'orders'/, 'admin App.jsx must subscribe to orders');

const globalOrdersCode = read('src/ui/admin-dashboard/pages/GlobalOrders/GlobalOrders.jsx');
assert.match(globalOrdersCode, /admin:refresh_data/, 'GlobalOrders.jsx must listen for admin:refresh_data');

console.log('All real-time continuous order sync contracts verified successfully!');
