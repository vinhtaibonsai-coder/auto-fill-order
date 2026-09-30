import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');
const interceptorJs = fs.readFileSync(path.join(rootDir, 'public/interceptor.js'), 'utf8');
const contentJs = fs.readFileSync(path.join(rootDir, 'src/runtime/content/index.js'), 'utf8');

console.log('--- 1. Testing interceptor.js guards against phantom order creation ---');

// Invariant 1: Blacklist must exclude fee, price, calc, quote, draft requests
assert.match(
  interceptorJs,
  /u\.includes\('fee'\)[\s\S]*?u\.includes\('price'\)[\s\S]*?u\.includes\('draft'\)/,
  'interceptor.js must ignore background fee, price, calc, and draft requests'
);

// Invariant 2: Must NOT postMessage AF_ORDER_CREATED without valid trackingCode
assert.match(
  interceptorJs,
  /if\s*\(!trackingCode\s*\|\|\s*!isCarrierTrackingCode\(trackingCode\)\)\s*\{\s*return;\s*\}/,
  'interceptor.js must explicitly abort if trackingCode is missing or not a carrier tracking code'
);

console.log('✅ interceptor.js properly ignores non-order requests and guards trackingCode.');

console.log('--- 2. Testing content script message listener invariant ---');

// Invariant 3: Message listener in content.js must guard against empty/invalid trackingCode
assert.match(
  contentJs,
  /if\s*\(!trackingCode\s*\|\|\s*!isCarrierTrackingCode\(trackingCode\)\)\s*\{\s*console\.log\([^)]+\);\s*return;\s*\}/,
  'content script must reject AF_ORDER_CREATED messages that lack a valid carrier tracking code'
);

// Invariant 4: triggerFillForm MUST NOT call setupAutoSaveOnSubmit
const fillFormRegex = /async function triggerFillForm[\s\S]*?Mutex\.release\('autofill_execution'\);/;
const fillFormMatch = contentJs.match(fillFormRegex);
assert.ok(fillFormMatch, 'triggerFillForm must exist');
assert.doesNotMatch(
  fillFormMatch[0],
  /setupAutoSaveOnSubmit\s*\(/,
  'triggerFillForm must NOT call setupAutoSaveOnSubmit when merely filling form'
);

console.log('✅ content.js strictly forbids phantom order auto-saving.');
console.log('🎉 ALL PHANTOM ORDER PREVENTION TESTS PASSED!');
