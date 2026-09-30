import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');
const contentIndex = fs.readFileSync(path.join(rootDir, 'src/runtime/content/index.js'), 'utf8');
const carrierRuntime = fs.readFileSync(path.join(rootDir, 'src/runtime/content/carrier-runtime.js'), 'utf8');

console.log('--- 1. Testing lexical declaration order of _carrierSubmitInterceptorAttached ---');
const interceptorDeclIdx = contentIndex.indexOf('let _carrierSubmitInterceptorAttached');
const checkUrlCallIdx = contentIndex.indexOf('checkUrlAndInject();');

assert.ok(interceptorDeclIdx > 0, '_carrierSubmitInterceptorAttached must be declared');
assert.ok(
  interceptorDeclIdx < checkUrlCallIdx,
  `_carrierSubmitInterceptorAttached (pos ${interceptorDeclIdx}) must be declared before initial checkUrlAndInject call (pos ${checkUrlCallIdx}) to prevent TDZ ReferenceError`
);
console.log('✅ Lexical declaration order is verified: _carrierSubmitInterceptorAttached is hoisted to top block.');

console.log('--- 2. Testing runtime initialization in simulated browser context ---');
const errors = [];
const warns = [];

const mockDocument = {
  readyState: 'complete',
  getElementById: (id) => null,
  querySelectorAll: (sel) => [],
  querySelector: (sel) => null,
  createElement: (tag) => ({ setAttribute: () => {}, appendChild: () => {}, addEventListener: () => {} }),
  head: { appendChild: () => {} },
  body: {
    addEventListener: () => {},
    innerText: ''
  },
  addEventListener: () => {}
};

const mockWindow = {
  location: { href: 'https://my.vnpost.vn/order/domestic/create/', hostname: 'my.vnpost.vn' },
  addEventListener: () => {},
  setInterval: () => 1,
  clearInterval: () => {},
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (id) => clearTimeout(id)
};
mockWindow.top = mockWindow;

const sandbox = {
  window: mockWindow,
  document: mockDocument,
  location: mockWindow.location,
  MutationObserver: class {
    observe() {}
    disconnect() {}
  },
  Event: class { constructor(type) { this.type = type; } },
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (id) => clearTimeout(id),
  setInterval: () => 1,
  clearInterval: () => {},
  console: {
    ...console,
    warn: (...args) => {
      warns.push(args.join(' '));
      console.warn(...args);
    },
    error: (...args) => {
      errors.push(args.join(' '));
      console.error(...args);
    }
  },
  globalThis: null,
  VNPOST_SELECTORS: { getAccountName: () => 'test-user' },
  JT_SELECTORS: { getAccountName: () => 'test-user' },
  chrome: {
    storage: {
      local: { get: (keys, cb) => cb({}), set: (obj, cb) => cb && cb() },
      onChanged: { addListener: () => {} }
    },
    runtime: { id: 'test-ext-id', getURL: (p) => p, sendMessage: () => {}, onMessage: { addListener: () => {} } }
  }
};
sandbox.globalThis = sandbox;

// First execute carrier-runtime.js (as per manifest order)
vm.runInNewContext(carrierRuntime, sandbox);

// Now execute index.js — this will synchronously run checkUrlAndInject() because document.readyState === 'complete'
vm.runInNewContext(contentIndex, sandbox);

// Verify that no ReferenceError was logged to console.warn/error
const interceptorErrors = warns.filter(w => w.includes('Error initializing submit interceptor'));
assert.equal(
  interceptorErrors.length,
  0,
  `Must NOT log "Error initializing submit interceptor": ${interceptorErrors.join(', ')}`
);

console.log('✅ Content script evaluated cleanly with zero submit interceptor TDZ ReferenceErrors.');
