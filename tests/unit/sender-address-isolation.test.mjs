import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');
const interceptorJs = fs.readFileSync(path.join(rootDir, 'public/interceptor.js'), 'utf8');
const contentJs = fs.readFileSync(path.join(rootDir, 'src/runtime/content/index.js'), 'utf8');
const migrationV100 = fs.readFileSync(path.join(rootDir, 'database/migrations/v100_mine_historical_orders_to_learning_kb.sql'), 'utf8');

console.log('--- 1. Testing interceptor.js payload extraction ---');

// Invariant 1: extractOrderDetailsFromRequest must exist and parse receiver info
assert.match(
  interceptorJs,
  /function extractOrderDetailsFromRequest\(reqBody\)/,
  'interceptor.js must define extractOrderDetailsFromRequest'
);

assert.match(
  interceptorJs,
  /ReceiverAddress[\s\S]*?ReceiverProvinceName/,
  'interceptor.js must extract receiver address components'
);

assert.match(
  interceptorJs,
  /handleInterceptedResponse\(url,\s*method,\s*status,\s*bodyText,\s*reqBody\)/,
  'handleInterceptedResponse must accept reqBody parameter'
);

assert.match(
  interceptorJs,
  /payloadDetails:\s*payloadDetails/,
  'interceptor.js must pass payloadDetails in AF_ORDER_CREATED message'
);

console.log('✅ interceptor.js correctly captures payloadDetails from carrier request.');

console.log('--- 2. Testing sender address rejection in content script ---');

// Invariant 2: isSenderElement and isSenderAddress must be defined
assert.match(
  contentJs,
  /function isSenderElement\(el\)/,
  'content script must define isSenderElement'
);

assert.match(
  contentJs,
  /function isSenderAddress\(addr\)/,
  'content script must define isSenderAddress'
);

// Invariant 3: isSenderAddress must inspect sender containers & dropdowns
assert.match(
  contentJs,
  /senderAddressEls[\s\S]*?#form-create-order_senderAddress[\s\S]*?\[class\*="warehouse" i\]/,
  'isSenderAddress must inspect sender address and warehouse elements'
);

// Invariant 4: doSave must reject sender address
assert.match(
  contentJs,
  /if\s*\(isSenderAddress\(data\.address\)\)\s*\{[\s\S]*?data\.address\s*=\s*'';\s*\}/,
  'doSave must reject data.address if it matches sender address'
);

// Invariant 5: AF_ORDER_CREATED must use payloadDetails and prioritize non-sender address
assert.match(
  contentJs,
  /const payload = event\.data\.payloadDetails;/,
  'AF_ORDER_CREATED must extract payloadDetails'
);

assert.match(
  contentJs,
  /if\s*\(isSenderAddress\(data\.address\)\)\s*\{[\s\S]*?data\.address\s*=\s*'';\s*\}/,
  'AF_ORDER_CREATED must reject data.address if it matches sender address'
);

console.log('✅ content script reliably filters sender addresses.');

console.log('--- 3. Testing database migration v100 sender warehouse filtering ---');

// Invariant 6: v100 must repair contaminated submitted_orders
assert.match(
  migrationV100,
  /UPDATE public\.submitted_orders sub[\s\S]*?SET address = TRIM\(ord\.address\)[\s\S]*?FROM public\.orders ord/,
  'v100 must restore contaminated submitted_orders.address from orders.address'
);

// Invariant 7: v100 must exclude sender addresses from mining
assert.match(
  migrationV100,
  /AND LOWER\(TRIM\(o\.address\)\) NOT LIKE '%điện bàn đông%'/,
  'v100 must exclude sender warehouse address from aggregated_orders'
);

assert.match(
  migrationV100,
  /NOT EXISTS\s*\(\s*SELECT 1 FROM public\.shops s[\s\S]*?s\.sender_ward IS NOT NULL/,
  'v100 must exclude addresses matching shop sender warehouse'
);

// Invariant 8: v100 must clean up any existing contaminated rows in shop_learning_kb
assert.match(
  migrationV100,
  /DELETE FROM public\.shop_learning_kb[\s\S]*?WHERE category = 'address_raw'[\s\S]*?điện bàn đông/,
  'v100 must purge contaminated sender addresses from shop_learning_kb'
);

console.log('✅ migration v100 strictly isolates sender addresses from learning KB.');
console.log('🎉 ALL SENDER ADDRESS ISOLATION TESTS PASSED!');
