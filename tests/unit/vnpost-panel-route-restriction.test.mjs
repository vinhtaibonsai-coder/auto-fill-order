import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');
const readSource = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), 'utf8');

const carrierRuntimeCode = readSource('src/runtime/content/carrier-runtime.js');
const panelIndexCode = readSource('src/ui/panel/index.jsx');
const contentIndexCode = readSource('src/runtime/content/index.js');

function createRuntime(url) {
  const sandbox = {
    globalThis: null,
    location: { href: url }
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(carrierRuntimeCode, sandbox);
  return sandbox.AutoFillCarrierRuntime;
}

// 1. Chỉ hiển thị tại trang tạo đơn VNPost
const createUrl1 = 'https://my.vnpost.vn/order/domestic/create';
assert.equal(createRuntime(createUrl1).getCurrentPlatform()?.id, 'vnpost', 'Must match /order/domestic/create');

const createUrlWithQuery = 'https://my.vnpost.vn/order/domestic/create?id=123#step2';
assert.equal(createRuntime(createUrlWithQuery).getCurrentPlatform()?.id, 'vnpost', 'Must match /order/domestic/create with query/hash');

// 2. Tuyệt đối KHÔNG hiển thị trên các trang khác của VNPost
const nonCreateUrls = [
  'https://my.vnpost.vn/',
  'https://my.vnpost.vn/dashboard',
  'https://my.vnpost.vn/order/domestic/manage',
  'https://my.vnpost.vn/order/domestic/history',
  'https://my.vnpost.vn/order/domestic/search',
  'https://my.vnpost.vn/order/domestic/batch',
  'https://my.vnpost.vn/order/domestic/pickup',
  'https://my.vnpost.vn/finance/reconciliation',
  'https://my.vnpost.vn/profile'
];

for (const url of nonCreateUrls) {
  const plat = createRuntime(url).getCurrentPlatform();
  assert.equal(plat, null, `URL ${url} must NOT trigger VNPost panel`);
}

// 3. Kiểm tra kiểm soát route trong src/ui/panel/index.jsx
assert.match(panelIndexCode, /my\.vnpost\.vn\/order\/domestic\/create/, 'Panel index.jsx must strictly match /order/domestic/create');
assert.doesNotMatch(panelIndexCode, /isCreatePage\s*=\s*url\.includes\('create'\)\s*\|\|\s*url\.includes\('tao-don'\);?\s*}?\s*else\s*if\s*\(url\.includes\('jtexpress/, 'Panel index must not use broad url.includes(create) for all vnpost');

// 4. Kiểm tra SPA route transition cleanup trong src/runtime/content/index.js
assert.match(contentIndexCode, /af-react-root[\s\S]*?remove/, 'content index.js must remove af-react-root when platform is null');
assert.match(contentIndexCode, /history\.pushState/, 'content index.js must intercept pushState for SPA navigation');
assert.match(contentIndexCode, /history\.replaceState/, 'content index.js must intercept replaceState for SPA navigation');

console.log('VNPost panel route restriction tests passed successfully.');
