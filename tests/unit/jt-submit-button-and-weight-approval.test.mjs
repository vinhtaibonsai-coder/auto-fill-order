import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

console.log('🧪 Running J&T Submit Button and Review Approval Unit Tests...');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');
const contentIndex = fs.readFileSync(path.join(rootDir, 'src/runtime/content/index.js'), 'utf8');
const carrierRuntime = fs.readFileSync(path.join(rootDir, 'src/runtime/content/carrier-runtime.js'), 'utf8');
const panelJs = fs.readFileSync(path.join(rootDir, 'frontend/panel/panel.js'), 'utf8');

// Mock DOM helper
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
      if (selector.includes('#vnpost-autofill-shadow-host')) return null;
      if (selector.includes('.el-menu') && props.inMenu) return {};
      return null;
    },
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {}
  };
  return el;
}

const mockDocument = {
  readyState: 'complete',
  getElementById: () => null,
  querySelectorAll: () => [],
  querySelector: () => null,
  createElement: (tag) => createElement(tag),
  head: { appendChild: () => {} },
  body: {
    addEventListener: () => {},
    innerText: ''
  },
  addEventListener: () => {}
};

const mockWindow = {
  location: { href: 'https://khachhang.jtexpress.vn/order/create', hostname: 'khachhang.jtexpress.vn' },
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
  JT_SELECTORS: { getAccountName: () => 'test-jt-user' },
  VNPOST_SELECTORS: { getAccountName: () => 'test-vnp-user' },
  chrome: {
    storage: {
      local: { get: (keys, cb) => cb({}), set: (obj, cb) => cb && cb() },
      onChanged: { addListener: () => {} }
    },
    runtime: { id: 'test-ext-id', getURL: (p) => p, sendMessage: () => {}, onMessage: { addListener: () => {} } }
  }
};
sandbox.globalThis = sandbox;

// Run scripts in sandbox
vm.runInNewContext(carrierRuntime, sandbox);
vm.runInNewContext(contentIndex, sandbox);

const isCarrierSubmitButton = sandbox.globalThis.isCarrierSubmitButton;
assert.equal(typeof isCarrierSubmitButton, 'function', 'isCarrierSubmitButton must be a function');

// ─── 1. KIỂM TRA PHÂN BIỆT NÚT SUBMIT TRÊN J&T ───
const jtTaoDonBtn = createElement('button', { text: 'Tạo đơn' });
const jtTaoDonNhanhBtn = createElement('button', { text: 'Tạo đơn nhanh' });
const jtTaoDonMauBtn = createElement('button', { text: 'Tạo đơn mẫu' });
const jtTaoDonMoiBtn = createElement('button', { text: 'Tạo đơn mới' });
const jtDangDonHangBtn = createElement('button', { text: 'Đăng đơn hàng' });
const jtDangDonBtn = createElement('button', { text: 'Đăng đơn' });
const jtDangDonVaInBtn = createElement('button', { text: 'Đăng đơn hàng & in' });

// "Tạo đơn" trên J&T KHÔNG ĐƯỢC coi là nút gửi đơn
assert.equal(
  isCarrierSubmitButton(jtTaoDonBtn, 'jt'),
  false,
  'J&T "Tạo đơn" button must NOT be recognized as submit button'
);

assert.equal(
  isCarrierSubmitButton(jtTaoDonNhanhBtn, 'jt'),
  false,
  'J&T "Tạo đơn nhanh" button must NOT be recognized as submit button'
);

assert.equal(
  isCarrierSubmitButton(jtTaoDonMauBtn, 'jt'),
  false,
  'J&T "Tạo đơn mẫu" button must NOT be recognized as submit button'
);

assert.equal(
  isCarrierSubmitButton(jtTaoDonMoiBtn, 'jt'),
  false,
  'J&T "Tạo đơn mới" button must NOT be recognized as submit button'
);

// "Đăng đơn hàng" trên J&T PHẢI ĐƯỢC coi là nút gửi đơn
assert.equal(
  isCarrierSubmitButton(jtDangDonHangBtn, 'jt'),
  true,
  'J&T "Đăng đơn hàng" button MUST be recognized as submit button'
);

assert.equal(
  isCarrierSubmitButton(jtDangDonBtn, 'jt'),
  true,
  'J&T "Đăng đơn" button MUST be recognized as submit button'
);

assert.equal(
  isCarrierSubmitButton(jtDangDonVaInBtn, 'jt'),
  true,
  'J&T "Đăng đơn hàng & in" button MUST be recognized as submit button'
);

// ─── 2. KIỂM TRA ĐỐI CHIẾU KHỐI LƯỢNG TRONG BẢNG XÉT DUYỆT ───
assert.match(
  panelJs,
  /activePanelData\.defaultWeightJt/,
  'panel.js must check activePanelData.defaultWeightJt for J&T'
);

assert.match(
  panelJs,
  /cWeightNum\s*<\s*50\s*\?\s*`\$\{cWeightNum\}\s*kg`/,
  'panel.js must format J&T carrier weight in kg'
);

// ─── 3. KIỂM TRA ĐỐI CHIẾU TÊN HÀNG HÓA VỚI MÃ ĐƠN SKU ───
assert.match(
  panelJs,
  /orderCodeVal\s*&&\s*\(isValueMatch\(formGoods,\s*orderCodeVal,\s*'code'\)\s*\|\|\s*formGoods\.includes\(orderCodeVal\)\)/,
  'panel.js must recognize form goods name matching orderCode as match'
);

// ─── 4. KIỂM TRA CÀO TRỌNG LƯỢNG FLOAT VÀ GHI CHÚ TRÊN J&T (index.js) ───
assert.match(
  contentIndex,
  /parseFloat\(m\[0\]\)/,
  'content script must parse J&T weight using parseFloat to preserve decimals like 0.5 kg'
);

assert.match(
  contentIndex,
  /Nội dung\|Ghi chú\|Lưu ý/,
  'content script must scrape J&T note elements'
);

assert.match(
  contentIndex,
  /productItem\.split\('\|'\)/,
  'content script must fallback extraNote from productItem when J&T embeds notes into goods name'
);

// ─── 5. KIỂM TRA ĐỐI CHIẾU GHI CHÚ TRÊN J&T KHI ĐÃ GỘP VÀO PRODUCTITEM (panel.js) ───
assert.match(
  panelJs,
  /!cNote(?:Raw)?\s*&&\s*isJT\s*&&\s*currentOrderData\.productItem\s*&&\s*pNote(?:Raw)?/,
  'panel.js must fallback cNote from productItem if J&T merged notes into goods name'
);

console.log('✅ ALL J&T SUBMIT BUTTON & APPROVAL TESTS PASSED SUCCESSFULLY!');
