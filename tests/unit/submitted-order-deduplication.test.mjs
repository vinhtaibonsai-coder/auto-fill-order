import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');
const readSource = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), 'utf8');

const workspace = readSource('src/ui/index/App.jsx');
const storage = readSource('src/application/storage.js');
const supabase = readSource('src/infrastructure/supabase/client.js');
const pkg = JSON.parse(readSource('package.json'));

assert.match(workspace, /const submittedIdentityKey = order =>/, 'Workspace dashboard must compute submitted order identity keys');
assert.match(workspace, /const hasSubmittedCustomer = order =>/, 'Workspace dashboard must reject ghost submitted rows');
assert.match(workspace, /const dedupeSubmittedRows = rows =>/, 'Workspace dashboard must dedupe submitted rows before rendering');
assert.match(workspace, /if \(!hasSubmittedCustomer\(row\)\) return false/, 'Workspace dashboard must hide tracking-only ghost rows');
assert.match(workspace, /const submitted = dedupeSubmittedRows\(submittedRows\)/, 'Workspace dashboard must dedupe rows from submitted_orders');

assert.match(storage, /function normalizeSubmittedIdentity\(order\)/, 'OrderStorage must compute a robust submitted identity');
assert.match(storage, /const seenSubmittedKeys = new Set\(\)/, 'OrderStorage must track submitted identity keys');
assert.match(storage, /seenSubmittedKeys\.has\(submittedKey\)/, 'OrderStorage must skip duplicate submitted identities');

assert.match(supabase, /_stableSubmittedOrderId/, 'Supabase client must build stable submitted order ids');
assert.match(supabase, /_hasSubmittedCustomer/, 'Supabase client must validate submitted customer data before insert');
assert.match(supabase, /updateSubmittedOrderTracking/, 'Supabase client must patch tracking-only updates');
assert.match(supabase, /sub_track_/, 'Supabase submitted ids must prefer tracking code');
assert.match(supabase, /orders\.filter\(o => this\._hasSubmittedCustomer\(o\)\)\.map/, 'Bulk submitted upsert must skip ghost rows');
assert.match(supabase, /id:\s*o\.id \|\| this\._stableSubmittedOrderId\(o\)/, 'Bulk submitted upsert must preserve existing ids before stable ids');
assert.match(supabase, /return targetId && tracking \? await this\.updateSubmittedOrderTracking\(targetId, tracking\) : false/, 'Sparse submitted upsert must patch existing tracking instead of inserting');
assert.match(supabase, /const id = order\.id \|\| this\._stableSubmittedOrderId\(order\)/, 'Single submitted upsert must preserve existing ids before stable ids');

const serviceWorker = readSource('src/runtime/service-worker/service-worker.js');
assert.match(serviceWorker, /SupabaseCloud\.updateSubmittedOrderTracking\(orderId, waybillCode\)/, 'Waybill found event must update tracking only');
assert.doesNotMatch(serviceWorker, /pushSubmittedOrder\(\{ id: orderId, tracking_code: waybillCode/, 'Waybill found event must not insert tracking-only ghost orders');

assert.match(pkg.scripts.test, /submitted-order-deduplication\.test\.mjs/, 'Main test script must include submitted order dedupe coverage');

console.log('Submitted order deduplication tests passed.');
await import('./repeat-customer-order-identity.test.mjs');
