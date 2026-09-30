import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');
const contentIndex = fs.readFileSync(path.join(rootDir, 'src/runtime/content/index.js'), 'utf8');
const carrierRuntime = fs.readFileSync(path.join(rootDir, 'src/runtime/content/carrier-runtime.js'), 'utf8');

console.log('--- 1. Testing VNPost Submit Button Recognition in Footer Bar ---');

// Mock DOM elements
function createElement(tagName, props = {}) {
  const el = {
    nodeType: 1,
    tagName: tagName.toUpperCase(),
    id: props.id || '',
    innerText: props.text || '',
    textContent: props.text || '',
    dataset: {},
    parentElement: null,
    attributes: props.attributes || {},
    getAttribute(name) {
      return this.attributes[name] || (name === 'title' ? props.title : null) || null;
    },
    closest(selector) {
      let cur = this;
      while (cur) {
        if (matchesSelector(cur, selector)) return cur;
        cur = cur.parentElement;
      }
      return null;
    },
    querySelector(sel) {
      return null;
    },
    querySelectorAll(sel) {
      return [];
    },
    addEventListener() {}
  };
  return el;
}

function matchesSelector(el, selector) {
  const parts = selector.split(',').map(s => s.trim());
  for (const part of parts) {
    if (part.startsWith('#')) {
      if (el.id === part.slice(1)) return true;
    } else if (part.startsWith('.')) {
      if (el.className && el.className.includes(part.slice(1))) return true;
    } else if (part.toLowerCase() === el.tagName.toLowerCase()) {
      return true;
    }
  }
  return false;
}

function appendChild(parent, child) {
  child.parentElement = parent;
  return child;
}

// Build DOM tree
// 1. Sidebar menu with "Tạo đơn mới"
const sidebar = createElement('div', { id: 'sidebar' });
sidebar.className = 'ant-layout-sider ant-menu';
const menuLink = createElement('a', { text: 'Tạo đơn mới' });
menuLink.className = 'ant-menu-item';
appendChild(sidebar, menuLink);

// 2. Header with "Tạo đơn"
const header = createElement('header', { id: 'header' });
header.className = 'ant-pro-global-header';
const headerBtn = createElement('button', { text: 'Tạo đơn' });
appendChild(header, headerBtn);

// 3. Random page button outside footer
const randomBtn = createElement('button', { text: 'Tạo đơn mới' });

// 4. Order creation footer bar (.ant-pro-footer-bar)
const footerBar = createElement('div', { id: 'footer-bar' });
footerBar.className = 'ant-pro-footer-bar';

const calcFeeBtn = createElement('button', { id: 'calculate_fee', text: 'Tính cước', title: 'Tính cước' });
calcFeeBtn.className = 'ant-btn btn-outline-warning';
appendChild(footerBar, calcFeeBtn);

const createOrderBtn = createElement('button', { id: 'create_order', text: 'Tạo đơn', title: 'Tạo đơn' });
createOrderBtn.className = 'ant-btn btn-outline-info';
appendChild(footerBar, createOrderBtn);

const saveDraftBtn = createElement('button', { id: 'save_draft_order', text: 'Lưu nháp', title: 'Lưu nháp' });
appendChild(footerBar, saveDraftBtn);

const refreshBtn = createElement('button', { id: 'refresh_create_order', text: 'Làm mới', title: 'Làm mới' });
appendChild(footerBar, refreshBtn);

// Setup sandbox
const mockDocument = {
  readyState: 'complete',
  getElementById: (id) => null,
  querySelectorAll: (sel) => [],
  querySelector: (sel) => null,
  createElement: (tag) => createElement(tag),
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
  setTimeout: (fn, ms) => {},
  clearTimeout: (id) => {}
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
  setTimeout: () => 1,
  clearTimeout: () => {},
  setInterval: () => 1,
  clearInterval: () => {},
  console: console,
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

// Run scripts
vm.runInNewContext(carrierRuntime, sandbox);
vm.runInNewContext(contentIndex, sandbox);

const isVnpostSubmitButton = sandbox.globalThis.isVnpostSubmitButton;
const isCarrierSubmitButton = sandbox.globalThis.isCarrierSubmitButton;

assert.equal(typeof isVnpostSubmitButton, 'function', 'isVnpostSubmitButton must be a function');
assert.equal(typeof isCarrierSubmitButton, 'function', 'isCarrierSubmitButton must be a function');

// Assertions for Footer Bar Create Order button
assert.equal(
  isVnpostSubmitButton(createOrderBtn),
  true,
  'Button #create_order in .ant-pro-footer-bar MUST be recognized as VNPost submit button'
);

assert.equal(
  isCarrierSubmitButton(createOrderBtn, 'vnpost'),
  true,
  'isCarrierSubmitButton must return true for VNPost #create_order'
);

// Assertions for Footer Bar non-create buttons
assert.equal(
  isVnpostSubmitButton(calcFeeBtn),
  false,
  'Button #calculate_fee in footer bar must NOT be recognized as submit button'
);

assert.equal(
  isVnpostSubmitButton(saveDraftBtn),
  false,
  'Button #save_draft_order in footer bar must NOT be recognized as submit button'
);

assert.equal(
  isVnpostSubmitButton(refreshBtn),
  false,
  'Button #refresh_create_order in footer bar must NOT be recognized as submit button'
);

// Assertions for Sidebar / Navigation Menu buttons
assert.equal(
  isVnpostSubmitButton(menuLink),
  false,
  'Sidebar menu link "Tạo đơn mới" must NOT be recognized as submit button'
);

assert.equal(
  isCarrierSubmitButton(menuLink, 'vnpost'),
  false,
  'isCarrierSubmitButton must return false for menu link'
);

// Assertions for Header buttons
assert.equal(
  isVnpostSubmitButton(headerBtn),
  false,
  'Header button "Tạo đơn" must NOT be recognized as submit button'
);

// Assertions for other random buttons outside footer bar
assert.equal(
  isVnpostSubmitButton(randomBtn),
  false,
  'Random button "Tạo đơn mới" outside footer bar must NOT be recognized as submit button'
);

console.log('✅ ALL VNPost Submit Button Recognition Tests Passed Successfully!');
