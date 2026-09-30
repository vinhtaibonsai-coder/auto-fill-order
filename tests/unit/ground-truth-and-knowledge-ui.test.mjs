import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');

console.log('--- 1. Testing detectAndRecordGroundTruth in Content Script ---');

const contentIndexPath = path.join(rootDir, 'src/runtime/content/index.js');
const contentIndexCode = fs.readFileSync(contentIndexPath, 'utf8');

assert.match(contentIndexCode, /function detectAndRecordGroundTruth/, 'detectAndRecordGroundTruth function must be defined in content/index.js');
assert.match(contentIndexCode, /globalThis\.__AF_INITIAL_PARSED_DATA__/, 'Must snapshot initial parsed data');
assert.match(contentIndexCode, /globalThis\.__AF_RAW_ORDER_INPUT__/, 'Must snapshot raw order input');
assert.match(contentIndexCode, /confidence:\s*100/, 'Ground truth learning must set confidence to 100');
assert.match(contentIndexCode, /category:\s*'order_code_pattern'/, 'Order code delta must sync to shop_learning_kb as order_code_pattern');
assert.match(contentIndexCode, /detectAndRecordGroundTruth\(\s*globalThis\.__AF_INITIAL_PARSED_DATA__/, 'Must be invoked during carrier order approval');

// Mock execution environment to test detectAndRecordGroundTruth logic
const mockLearned = [];
let mockBatchSyncCalls = [];

globalThis.AddressNormalizer = {
  normalize: (addr) => addr
};

globalThis.AddressParser = {
  parse: (addr) => ({
    province: 'TP. Hồ Chí Minh',
    district: 'Quận 7',
    ward: 'Phường Tân Thuận Đông',
    street: addr
  })
};

globalThis.AddressLearning = {
  learn: async (rawAddr, parsed, phone) => {
    mockLearned.push({ rawAddr, parsed, phone });
  },
  getAuthAndConfig: async () => ({
    session: { active_shop_id: 'shop-test-123', access_token: 'token-abc' },
    config: { url: 'https://test.supabase.co', anonKey: 'anon-xyz' }
  })
};

globalThis.fetch = async (url, options) => {
  mockBatchSyncCalls.push({ url, body: JSON.parse(options.body) });
  return { ok: true, json: async () => ({ status: 'success' }) };
};

// Evaluate the detectAndRecordGroundTruth implementation logic
const fnMatch = contentIndexCode.match(/async function detectAndRecordGroundTruth[\s\S]*?\n  \}/);
assert.ok(fnMatch, 'Should be able to locate detectAndRecordGroundTruth block');
eval(fnMatch[0] + '\nglobalThis.detectAndRecordGroundTruth = detectAndRecordGroundTruth;');
const detectAndRecordGroundTruth = globalThis.detectAndRecordGroundTruth;

// Case 1: No delta -> Should not record ground truth
mockLearned.length = 0;
mockBatchSyncCalls.length = 0;
const initial1 = {
  address: 'KCX Tân Thuận, Quận 7, TP Hồ Chí Minh',
  orderCode: 'ORD-001',
  phone: '0912345678'
};
const final1 = {
  address: 'KCX Tân Thuận, Quận 7, TP Hồ Chí Minh',
  orderCode: 'ORD-001',
  phone: '0912345678'
};
await detectAndRecordGroundTruth(initial1, final1, 'KCX Tân Thuận, Quận 7, TP Hồ Chí Minh');
assert.equal(mockLearned.length, 0, 'No address delta should result in no learning');
assert.equal(mockBatchSyncCalls.length, 0, 'No code delta should result in no cloud entry');

// Case 2: Address corrected by human -> Should record with confidence 100
const initial2 = {
  address: 'Tòa nhà TTC, Phường Tân Thuận',
  orderCode: 'ORD-002',
  phone: '0774826209'
};
const final2 = {
  address: 'Tòa nhà TTC, KCX Tân Thuận, Phường Tân Thuận Đông, Quận 7, TP Hồ Chí Minh',
  orderCode: 'ORD-002',
  phone: '0774826209'
};
await detectAndRecordGroundTruth(initial2, final2, 'Tòa nhà TTC, Phường Tân Thuận\n0774826209');
assert.equal(mockLearned.length, 2, 'Should record 2 ground truth address learning entries (raw initial and corrected target)');
assert.equal(mockLearned[0].rawAddr, 'Tòa nhà TTC, Phường Tân Thuận');
assert.equal(mockLearned[0].parsed.confidence, 100, 'Human confirmed must set confidence to 100');
assert.equal(mockLearned[0].parsed.province, 'TP. Hồ Chí Minh');
assert.equal(mockLearned[0].parsed.district, 'Quận 7');
assert.equal(mockLearned[0].parsed.ward, 'Phường Tân Thuận Đông');

// Case 3: Order code corrected by human -> Should queue order_code_pattern
const initial3 = {
  address: '123 Le Loi',
  orderCode: 'LỖI_MÃ',
  phone: '0988776655'
};
const final3 = {
  address: '123 Le Loi',
  orderCode: 'NHUT-889',
  phone: '0988776655'
};
await detectAndRecordGroundTruth(initial3, final3, '123 Le Loi\nNHUT-889');
assert.equal(mockBatchSyncCalls.length, 1, 'Should call sync_shop_learning_batch for order_code_pattern');
const entry = mockBatchSyncCalls[0].body.p_entries[0];
assert.equal(entry.category, 'order_code_pattern');
assert.equal(entry.raw_key, 'NHUT-889');
assert.equal(entry.normalized_value.code, 'NHUT-889');
assert.equal(entry.confidence, 100);

console.log('✅ detectAndRecordGroundTruth logic verified successfully.');

console.log('--- 2. Testing AddressEngine Options UI Knowledge Management ---');

const addressEnginePath = path.join(rootDir, 'src/ui/options/pages/AddressEngine/AddressEngine.jsx');
const addressEngineCode = fs.readFileSync(addressEnginePath, 'utf8');

// Check sub-tab navigation
assert.match(addressEngineCode, /activeSubTab === 'aliases'/, 'Must support aliases sub-tab');
assert.match(addressEngineCode, /activeSubTab === 'learning_kb'/, 'Must support learning_kb sub-tab');
assert.match(addressEngineCode, /Tri Thức Học Máy Cloud/i, 'Must have tab label for cloud learning KB');

// Check category filters
assert.match(addressEngineCode, /address_raw/, 'Must support address_raw category');
assert.match(addressEngineCode, /customer_phone/, 'Must support customer_phone category');
assert.match(addressEngineCode, /product_sku/, 'Must support product_sku category');
assert.match(addressEngineCode, /order_code_pattern/, 'Must support order_code_pattern category');

// Check human verification (confidence: 100)
assert.match(addressEngineCode, /handleVerifyKbEntry/, 'Must implement handleVerifyKbEntry');
assert.match(addressEngineCode, /confidence:\s*100/, 'Verification must update confidence to 100');

// Check deletion of KB entries
assert.match(addressEngineCode, /confirmDeleteKb/, 'Must implement confirmDeleteKb');
assert.match(addressEngineCode, /deleteKbTarget/, 'Must have delete confirmation target for KB');

// Check promote to alias
assert.match(addressEngineCode, /handlePromoteToAlias/, 'Must implement handlePromoteToAlias');
assert.match(addressEngineCode, /setActiveSubTab\('aliases'\)/, 'Promoting should switch to aliases sub-tab');

console.log('✅ AddressEngine Options UI Knowledge Management verified successfully.');
