import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');
const readSource = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), 'utf8');

const vnpostSelectors = readSource('src/domain/carrier/vnpost/selectors.js');
const vnpostAutofill = readSource('src/domain/carrier/vnpost/autofill.js');
const contentIndex = readSource('src/runtime/content/index.js');
const supabaseClient = readSource('src/infrastructure/supabase/client.js');
const serviceWorker = readSource('src/runtime/service-worker/service-worker.js');
const storage = readSource('src/application/storage.js');
const submittedOrdersPage = readSource('src/ui/options/pages/Orders/SubmittedOrders.jsx');

console.log('Running COD Selector and Cloud Sync Contract Tests...');

// 1. codSelectorScoped contract
// Ensure global input.ant-input-number-input is NOT used for COD anywhere in VNPost
assert.doesNotMatch(
  vnpostSelectors,
  /codInputFallbacks:\s*\[[\s\S]*?input\.ant-input-number-input[\s\S]*?\]/,
  'VNPost selectors must not include broad input.ant-input-number-input in codInputFallbacks'
);

assert.doesNotMatch(
  vnpostAutofill,
  /querySelector\(['"]input\.ant-input-number-input['"]\)/,
  'VNPost autofill must not query broad input.ant-input-number-input for COD'
);

assert.doesNotMatch(
  contentIndex,
  /querySelector\(['"]input\.ant-input-number-input['"]\)\s*\|\|\s*document\.querySelector\(['"]input\[name="PROP0018"\]['"]\)/,
  'content/index.js must not prioritize broad ant-input-number-input over PROP0018'
);

assert.match(
  contentIndex,
  /hasValidCodField\s*=\s*true/,
  'content/index.js must mark hasValidCodField = true only when a scoped COD input is matched'
);

assert.match(
  contentIndex,
  /latestDom\.hasValidCodField[\s\S]*?latestDom\.codAmount\s*>\s*0/,
  'content/index.js must only override parsed COD when a valid COD field was actually detected'
);

// 2. fetchUsesRequestedShop contract
assert.match(
  supabaseClient,
  /action:\s*'fetchSubmittedOrders',\s*shopId:\s*customShopId/,
  'SupabaseCloud.fetchSubmittedOrders must forward customShopId to service worker'
);

assert.match(
  supabaseClient,
  /const\s+shopId\s*=\s*customShopId\s*\|\|\s*await\s+this\._getActiveShopId\(\)/,
  'SupabaseCloud.fetchSubmittedOrders must prioritize customShopId over session activeShopId'
);

assert.match(
  serviceWorker,
  /SupabaseCloud\.fetchSubmittedOrders\(message\.shopId/,
  'service-worker must pass message.shopId to SupabaseCloud.fetchSubmittedOrders'
);

// 3. pushLoadsSessionToken contract
assert.match(
  supabaseClient,
  /pushSubmittedOrder\s*=\s*async\s*function[\s\S]*?const\s+token\s*=\s*await\s+this\._sessionToken\(\)/,
  'pushSubmittedOrder must load session token before making request'
);

assert.match(
  supabaseClient,
  /pushSubmittedOrders\s*=\s*async\s*function[\s\S]*?const\s+token\s*=\s*await\s+this\._sessionToken\(\)/,
  'pushSubmittedOrders must load session token before making request'
);

assert.match(
  supabaseClient,
  /_headers\s*=\s*function\(accessToken[\s\S]*?isJwt\s*=[\s\S]*?bearerToken\s*=\s*isJwt\s*\?\s*token\s*:\s*key/,
  'SupabaseCloud._headers must verify 3-part JWT to prevent PostgREST 401 errors on PIN session tokens'
);

assert.match(
  supabaseClient,
  /sync_offline_submitted_orders/,
  'SupabaseCloud must use sync_offline_submitted_orders RPC for reliable submission'
);

// 4. Repeat Customer Order Preservation (no deletion by phone + name + date)
assert.doesNotMatch(
  storage,
  /custKey\s*=\s*`\$\{phone\}_/,
  'storage.js getSubmittedOrders must NOT deduplicate by customer phone + name + date'
);

assert.doesNotMatch(
  storage,
  /seenCustomerKeys\.has\(custKey\)/,
  'storage.js must NOT discard orders from returning customers on the same day'
);

// 5. Storage Key Synchronization between OrderStorage and service-worker
assert.match(
  serviceWorker,
  /submittedOrders_\$\{shopId\}[\s\S]*?submittedOrders_\$\{userId\}/,
  'service-worker must sync submitted orders to both shopId and userId keys'
);

assert.match(
  storage,
  /fallbackKey\s*=\s*`submittedOrders_\$\{shopId\}`[\s\S]*?\[key\]:\s*orders,\s*\[fallbackKey\]:\s*orders/,
  'OrderStorage must unify submitted orders local storage across both user and shopId keys'
);

// 6. SubmittedOrders UI auto-sync listeners
assert.match(
  submittedOrdersPage,
  /chrome\.storage\.onChanged\.addListener/,
  'SubmittedOrders.jsx must listen for chrome.storage changes'
);

assert.match(
  submittedOrdersPage,
  /chrome\.runtime\.onMessage\.addListener/,
  'SubmittedOrders.jsx must listen for chrome.runtime messages'
);

assert.match(
  submittedOrdersPage,
  /loadOrders\s*=\s*async\s*\(\s*silent\s*=\s*false\s*\)/,
  'SubmittedOrders.jsx loadOrders must support silent background refreshing'
);

console.log('All contract checks passed successfully:');
console.log(JSON.stringify({
  codSelectorScoped: true,
  fetchUsesRequestedShop: true,
  pushLoadsSessionToken: true,
  repeatCustomerPreserved: true,
  storageKeysSynchronized: true,
  realtimeListenerActive: true
}, null, 2));
