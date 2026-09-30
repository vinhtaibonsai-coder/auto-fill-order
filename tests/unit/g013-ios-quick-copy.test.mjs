import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  saveQuickCopyProgress,
  loadQuickCopyProgress,
  clearQuickCopyProgress,
  clearAllLocalDrafts,
  obfuscatePayload,
  deobfuscatePayload,
  QUICK_COPY_STORAGE_KEY
} from '../../src/ui/index/quick-copy.persistence.js';
import {
  QUICK_COPY_PRESETS,
  buildQuickCopyFields,
  formatFullOrderCopy,
  getNextCopyIndex
} from '../../src/ui/index/quick-copy.js';

console.log('--- Test Suite: G013 iOS/PWA Quick-Copy Workflow ---');

// 1. Static Contract & Source Checks for iOS/PWA Capabilities
const quickCopyPanelSource = fs.readFileSync('src/ui/index/components/QuickCopyPanel.jsx', 'utf8');
const indexStylesSource = fs.readFileSync('src/ui/index/index-styles.css', 'utf8');
const appSource = fs.readFileSync('src/ui/index/App.jsx', 'utf8');

// Truthful iOS Boundary Invariant: Must not claim autofill into native J&T/VNPost iOS apps
assert.match(
  quickCopyPanelSource,
  /iOS.*không.*autofill|không.*cấp quyền.*autofill/i,
  'QuickCopyPanel must display explicit disclaimer that iOS restricts autofill into native carrier apps'
);

// Native Share Sheet Integration: Must support navigator.share
assert.match(
  quickCopyPanelSource,
  /navigator\.share/i,
  'QuickCopyPanel must implement native iOS Share Sheet support'
);

// Clear Local Data Button
assert.match(
  quickCopyPanelSource,
  /clearAllLocalDrafts|Xóa dữ liệu/i,
  'QuickCopyPanel must provide an explicit button to clear local drafts'
);

// Viewport 375px Design Contract: Check CSS handles 375px without overflow
assert.match(indexStylesSource, /box-sizing:\s*border-box/, 'Styles must enforce border-box sizing');
assert.match(indexStylesSource, /\.qc-sticky-bar/, 'Styles must define sticky action bar for thumb ergonomics');
assert.match(indexStylesSource, /min-height:\s*(44|48|50)px/, 'Touch action targets must have at least 44px min-height');
console.log('✔ 1. iOS boundary, Share Sheet, and 375px viewport contracts verified');

// 2. Encrypted / Obfuscated Local Draft Storage Contract
const rawSample = {
  parsedResult: {
    name: 'Nguyễn Văn Test',
    phone: '0988776655',
    address: '123 Phố Huế, Hai Bà Trưng, Hà Nội',
    codAmount: 450000,
    orderCode: 'DH-999'
  },
  carrier: 'jt',
  copiedKeys: ['name', 'phone'],
  currentIndex: 2
};

// Test obfuscation engine: raw PII must NOT appear as plain text in the serialized storage value
const obfuscated = obfuscatePayload(rawSample);
assert.notEqual(obfuscated, JSON.stringify(rawSample), 'Obfuscated payload must not match raw JSON string');
assert.ok(!obfuscated.includes('Nguyễn Văn Test'), 'Customer name must not be stored in plain text');
assert.ok(!obfuscated.includes('0988776655'), 'Customer phone must not be stored in plain text');
assert.ok(!obfuscated.includes('123 Phố Huế'), 'Customer address must not be stored in plain text');

// Test deobfuscation
const restored = deobfuscatePayload(obfuscated);
assert.equal(restored.parsedResult.name, 'Nguyễn Văn Test');
assert.equal(restored.parsedResult.phone, '0988776655');
assert.equal(restored.carrier, 'jt');
assert.deepEqual(Array.from(restored.copiedKeys), ['name', 'phone']);

// Test LocalStorage persistence with simulated storage
const mockStore = new Map();
globalThis.localStorage = {
  getItem: (k) => mockStore.get(k) || null,
  setItem: (k, v) => mockStore.set(k, String(v)),
  removeItem: (k) => mockStore.delete(k)
};

saveQuickCopyProgress(rawSample);
const storedRaw = mockStore.get(QUICK_COPY_STORAGE_KEY);
assert.ok(storedRaw, 'Storage key must be populated');
assert.ok(!storedRaw.includes('0988776655'), 'Stored item in localStorage must be obfuscated/encrypted');

const loaded = loadQuickCopyProgress();
assert.ok(loaded);
assert.equal(loaded.parsedResult.name, 'Nguyễn Văn Test');
assert.equal(loaded.parsedResult.phone, '0988776655');

// Test clear data
clearAllLocalDrafts();
assert.equal(mockStore.get(QUICK_COPY_STORAGE_KEY), undefined, 'clearAllLocalDrafts must completely wipe storage');
assert.equal(loadQuickCopyProgress(), null, 'Storage must be empty after wipe');
console.log('✔ 2. Obfuscated draft storage and wipe invariants verified');

// 3. One-touch Copy Sequence on J&T and VNPost
const order = {
  name: 'Trần Thị B',
  phone: '0912345678',
  address: 'Số 5 Lê Duẩn, Quận 1, TP.HCM',
  codAmount: 250000,
  orderCode: 'VN123',
  extraNote: 'Giao giờ hành chính'
};

// J&T Sequence: Name -> Phone -> Address -> COD -> Order Code -> Note
const jtFields = buildQuickCopyFields(order, 'jt');
assert.deepEqual(
  jtFields.map(f => f.key),
  ['name', 'phone', 'address', 'codAmount', 'orderCode', 'extraNote']
);

// VNPost Sequence: Phone -> Name -> Address -> COD -> Order Code -> Note
const vnpostFields = buildQuickCopyFields(order, 'vnpost');
assert.deepEqual(
  vnpostFields.map(f => f.key),
  ['phone', 'name', 'address', 'codAmount', 'orderCode', 'extraNote']
);

// One-touch next index resolution
const progress = new Set();
assert.equal(getNextCopyIndex(jtFields, progress), 0); // Name
progress.add('name');
assert.equal(getNextCopyIndex(jtFields, progress), 1); // Phone
progress.add('phone');
assert.equal(getNextCopyIndex(jtFields, progress), 2); // Address
console.log('✔ 3. One-touch copy sequence on J&T and VNPost verified');

console.log('All G013 iOS/PWA Quick-Copy contracts verified successfully.');
