import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');

console.log('--- 1. Testing Migration v98: shop_learning_kb schema and RPC contracts ---');

const migrationPath = path.join(rootDir, 'database/migrations/v98_shop_learning_kb_and_sync.sql');
assert.ok(fs.existsSync(migrationPath), 'Migration v98 must exist');
const sqlContent = fs.readFileSync(migrationPath, 'utf8');

assert.match(sqlContent, /CREATE TABLE IF NOT EXISTS public\.shop_learning_kb/, 'Must create shop_learning_kb table');
assert.match(sqlContent, /CONSTRAINT uq_shop_learning_entry UNIQUE\s*\(shop_id,\s*category,\s*raw_key\)/, 'Must enforce uniqueness on (shop_id, category, raw_key)');
assert.match(sqlContent, /ALTER TABLE public\.shop_learning_kb ENABLE ROW LEVEL SECURITY/, 'Must enable RLS');
assert.match(sqlContent, /CREATE OR REPLACE FUNCTION public\.get_shop_learning_snapshot/, 'Must provide get_shop_learning_snapshot RPC');
assert.match(sqlContent, /CREATE OR REPLACE FUNCTION public\.sync_shop_learning_batch/, 'Must provide sync_shop_learning_batch RPC');
assert.match(sqlContent, /GRANT EXECUTE ON FUNCTION public\.get_shop_learning_snapshot/i, 'Must grant execute on get_shop_learning_snapshot');
assert.match(sqlContent, /GRANT EXECUTE ON FUNCTION public\.sync_shop_learning_batch/i, 'Must grant execute on sync_shop_learning_batch');

console.log('✅ Migration v98 verified successfully.');

console.log('--- 2. Testing AddressNormalizer Shop Aliases Expansion ---');

// Load normalizer in node environment
const normalizerPath = path.join(rootDir, 'src/application/address/normalizer.js');
const normalizerCode = fs.readFileSync(normalizerPath, 'utf8');
eval(normalizerCode);

const customAliases = [
  { original: 'kcx tân thuận', mapping: 'Khu Chế Xuất Tân Thuận, Phường Tân Thuận Đông, Quận 7, TP Hồ Chí Minh' },
  { original: 'qbt', mapping: 'Quận Bình Thạnh, TP Hồ Chí Minh' },
  { original: 'ngũ hiệp thanh trì', mapping: 'Xã Ngũ Hiệp, Huyện Thanh Trì, Hà Nội' }
];

// Test 1: KCX Tân Thuận alias expansion
const input1 = 'Tòa Nhà TTC Đường Số 14, KCX Tân Thuận, Tên Phổ';
const expanded1 = globalThis.AddressNormalizer.applyShopAliases(input1, customAliases);
assert.ok(expanded1.includes('Khu Chế Xuất Tân Thuận, Phường Tân Thuận Đông, Quận 7, TP Hồ Chí Minh'), 'Must expand kcx tân thuận to standard administrative hierarchy');

// Test 2: QBT alias expansion
const input2 = 'Số 12 Ung Văn Khiêm, qbt';
const expanded2 = globalThis.AddressNormalizer.applyShopAliases(input2, customAliases);
assert.ok(expanded2.includes('Quận Bình Thạnh, TP Hồ Chí Minh'), 'Must expand qbt to Quận Bình Thạnh');

// Test 3: Normalizer main method applies shop aliases
const normalizedFull = globalThis.AddressNormalizer.normalize('Gần đền lưu phái, ngũ hiệp thanh trì', customAliases);
assert.ok(normalizedFull.includes('xã ngũ hiệp') && normalizedFull.includes('huyện thanh trì'), 'Normalizer should incorporate expanded alias into parsed token flow');

console.log('✅ AddressNormalizer shop alias expansion verified.');

console.log('--- 3. Testing AddressLearning Two-Tier Hybrid Cache & Sync ---');

const learningPath = path.join(rootDir, 'src/application/address/learning.js');
const learningCode = fs.readFileSync(learningPath, 'utf8');

// Mock localStorage and chrome environment for testing
const mockStorage = new Map();
globalThis.localStorage = {
  getItem: (key) => mockStorage.get(key) || null,
  setItem: (key, val) => mockStorage.set(key, String(val)),
  removeItem: (key) => mockStorage.delete(key)
};

delete globalThis.chrome; // Force localStorage mode in Node
eval(learningCode);

assert.ok(typeof globalThis.AddressLearning !== 'undefined', 'AddressLearning must be exported');
assert.ok(typeof globalThis.AddressLearning.syncFromCloud === 'function', 'syncFromCloud must exist');
assert.ok(typeof globalThis.AddressLearning.learn === 'function', 'learn must exist');
assert.ok(typeof globalThis.AddressLearning.lookup === 'function', 'lookup must exist');

// Test learning a high-confidence address
const testRaw = 'Tòa Nhà TTC Đường Số 14 KCX Tân Thuận';
const testAddrObj = {
  street: 'Tòa Nhà TTC Đường Số 14',
  ward: 'Phường Tân Thuận Đông',
  district: 'Quận 7',
  province: 'Thành phố Hồ Chí Minh',
  confidence: 95
};

await globalThis.AddressLearning.learn(testRaw, testAddrObj, '0774826209');

// Immediate lookup must return match with 100% confidence
const lookupResult = await globalThis.AddressLearning.lookup(testRaw, '0774826209');
assert.ok(lookupResult, 'Lookup must find newly learned entry');
assert.equal(lookupResult.confidence, 100);
assert.equal(lookupResult.source, 'akb_raw');
assert.equal(lookupResult.match.ward, 'Phường Tân Thuận Đông');

console.log('✅ AddressLearning local cache verified.');

// Test mock syncFromCloud
let rpcCalled = false;
let aliasCalled = false;

globalThis.fetch = async (url, options) => {
  if (url.includes('rpc/get_shop_learning_snapshot')) {
    rpcCalled = true;
    return {
      ok: true,
      json: async () => [
        {
          id: '123',
          category: 'address_raw',
          raw_key: 'gần đền lưu phái ngũ hiệp',
          normalized_value: {
            street: 'Gần đền Lưu Phái',
            ward: 'Xã Ngũ Hiệp',
            district: 'Huyện Thanh Trì',
            province: 'Thành phố Hà Nội',
            confidence: 90
          },
          confidence: 90
        },
        {
          id: '124',
          category: 'customer_phone',
          raw_key: '0946661360',
          normalized_value: {
            street: 'Gần đền Lưu Phái',
            ward: 'Xã Ngũ Hiệp',
            district: 'Huyện Thanh Trì',
            province: 'Thành phố Hà Nội',
            confidence: 90
          },
          confidence: 90
        }
      ]
    };
  }
  if (url.includes('shop_address_aliases')) {
    aliasCalled = true;
    return {
      ok: true,
      json: async () => [
        { id: 1, original: 'kcx tân thuận', mapping: 'Khu Chế Xuất Tân Thuận, Phường Tân Thuận Đông, Quận 7' }
      ]
    };
  }
  return { ok: false, status: 404 };
};

globalThis.AuthSession = {
  getSession: async () => ({
    active_shop_id: '00000000-0000-0000-0000-000000000001',
    access_token: 'mock-token'
  })
};

globalThis.SupabaseCloud = {
  loadConfig: async () => ({
    url: 'https://mock.supabase.co',
    anonKey: 'mock-anon-key'
  })
};

const syncRes = await globalThis.AddressLearning.syncFromCloud();
assert.ok(syncRes.success, 'syncFromCloud must succeed with mock credentials');
assert.ok(rpcCalled, 'Must call get_shop_learning_snapshot RPC');
assert.ok(aliasCalled, 'Must call shop_address_aliases endpoint');

// Test that the synced cloud entry can now be looked up locally with 0ms
const cloudLookup = await globalThis.AddressLearning.lookup('gần đền lưu phái ngũ hiệp', '0946661360');
assert.ok(cloudLookup, 'Cloud-synced entry must be immediately accessible in local lookup');
assert.equal(cloudLookup.match.district, 'Huyện Thanh Trì');
assert.equal(cloudLookup.match.province, 'Thành phố Hà Nội');

console.log('✅ AddressLearning cloud sync and local cache population verified.');
console.log('🎉 ALL PHASE 1 & 2 CLOUD LEARNING TESTS PASSED SUCCESSFULLY!');
