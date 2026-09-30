import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const learningCode = fs.readFileSync(path.join(rootDir, 'src/application/address/learning.js'), 'utf8');

function createHarness() {
  const storage = new Map();
  const snapshots = new Map();
  let activeShopId = 'shop-a';
  let syncShouldFail = false;

  const context = vm.createContext({
    console,
    setTimeout: () => 1,
    clearTimeout: () => {},
    localStorage: {
      getItem: key => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: key => storage.delete(key)
    },
    AuthSession: {
      getSession: async () => ({
        active_shop_id: activeShopId,
        access_token: 'test-token'
      })
    },
    SupabaseCloud: {
      loadConfig: async () => ({ url: 'https://example.supabase.co', anonKey: 'anon-key' })
    },
    fetch: async (url, options = {}) => {
      if (url.includes('/rpc/get_shop_learning_snapshot')) {
        const body = JSON.parse(options.body || '{}');
        return { ok: true, json: async () => snapshots.get(body.p_shop_id) || [] };
      }
      if (url.includes('/rpc/sync_shop_learning_batch')) {
        if (syncShouldFail) return { ok: false, status: 503 };
        return { ok: true, json: async () => ({ success: true }) };
      }
      return { ok: true, json: async () => [] };
    }
  });

  vm.runInContext(learningCode, context);

  return {
    learning: context.AddressLearning,
    snapshots,
    setActiveShop: shopId => { activeShopId = shopId; },
    setSyncFailure: value => { syncShouldFail = value; }
  };
}

function address(street, confidence = 90) {
  return {
    street,
    ward: 'Phường Bến Thành',
    district: 'Quận 1',
    province: 'Thành phố Hồ Chí Minh',
    fullAddress: `${street}, Phường Bến Thành, Quận 1, Thành phố Hồ Chí Minh`,
    confidence
  };
}

console.log('--- AddressLearning production safety behavior ---');

{
  const h = createHarness();
  h.snapshots.set('shop-a', [{
    category: 'address_raw', raw_key: 'địa chỉ riêng a',
    normalized_value: address('Kho A'), confidence: 91, source_type: 'human_edit'
  }]);
  h.snapshots.set('shop-b', [{
    category: 'address_raw', raw_key: 'địa chỉ riêng b',
    normalized_value: address('Kho B'), confidence: 88, source_type: 'local_pipeline'
  }]);

  await h.learning.syncFromCloud();
  assert.equal((await h.learning.lookup('địa chỉ riêng a')).match.street, 'Kho A');

  h.setActiveShop('shop-b');
  await h.learning.syncFromCloud();
  assert.equal(await h.learning.lookup('địa chỉ riêng a'), null,
    'Shop B must never see the local learning cache of Shop A');
  assert.equal((await h.learning.lookup('địa chỉ riêng b')).match.street, 'Kho B');

  h.setActiveShop('shop-a');
  assert.equal((await h.learning.lookup('địa chỉ riêng a')).match.street, 'Kho A',
    'Switching back should restore only that shop scoped cache');
}

{
  const h = createHarness();
  h.snapshots.set('shop-a', [{
    category: 'address_raw', raw_key: 'mẫu độ tin cậy thấp',
    normalized_value: address('12 Lê Lợi', 72), confidence: 72, source_type: 'historical'
  }]);
  await h.learning.syncFromCloud();
  const result = await h.learning.lookup('mẫu độ tin cậy thấp');
  assert.equal(result.confidence, 72, 'Cloud confidence must not be inflated to 100');
  assert.equal(result.sourceType, 'historical');
}

{
  const h = createHarness();
  await h.learning.learn('cùng một đầu vào', address('Địa chỉ do người xác nhận', 100), '', {
    shopId: 'shop-a', sourceType: 'human_confirmed', verified: true
  });
  await h.learning.learn('cùng một đầu vào', address('Kết quả tự động sai', 90), '', {
    shopId: 'shop-a', sourceType: 'local_pipeline'
  });
  const result = await h.learning.lookup('cùng một đầu vào', '', 'shop-a');
  assert.equal(result.match.street, 'Địa chỉ do người xác nhận',
    'Automatic evidence must not overwrite human-confirmed knowledge');
  assert.equal(result.confidence, 100);
}

{
  const h = createHarness();
  await h.learning.recordUserCorrection({
    field: 'orderCode',
    originalValue: 'SAI-001',
    correctedValue: 'DH-001',
    rawText: 'Nguyễn Văn A 0901234567 mã DH-001',
    shopId: 'shop-a'
  });

  const corrected = await h.learning.applyCorrections(
    { name: 'Nguyễn Văn A', orderCode: 'SAI-001' },
    'Nguyễn Văn A 0901234567 mã DH-001',
    'shop-a'
  );
  assert.equal(corrected.orderCode, 'DH-001', 'A confirmed field correction must be reusable');

  const unrelated = await h.learning.applyCorrections(
    { name: 'Nguyễn Văn B', orderCode: 'SAI-001' },
    'Nguyễn Văn B 0909999999 mã khác',
    'shop-a'
  );
  assert.equal(unrelated.orderCode, 'SAI-001', 'Corrections must only replay for the same input fingerprint');
}

{
  const h = createHarness();
  h.snapshots.set('shop-a', [{
    category: 'address_raw', raw_key: 'sẽ bị xóa',
    normalized_value: address('Dữ liệu cũ'), confidence: 90, source_type: 'local_pipeline'
  }]);
  await h.learning.syncFromCloud();
  assert.ok(await h.learning.lookup('sẽ bị xóa'));

  h.snapshots.set('shop-a', []);
  await h.learning.syncFromCloud();
  assert.equal(await h.learning.lookup('sẽ bị xóa'), null,
    'A fresh cloud snapshot must purge entries deleted on another device');
}

{
  const h = createHarness();
  h.snapshots.set('shop-a', [{
    category: 'address_raw', raw_key: '123 lê lợi',
    normalized_value: {
      fullAddress: '123 Lê Lợi, Phường Bến Thành, Quận 1, Thành phố Hồ Chí Minh',
      source: 'historical_submitted_orders'
    },
    confidence: 90,
    source_type: 'historical'
  }]);
  await h.learning.syncFromCloud();
  const result = await h.learning.lookup('123 lê lợi');
  assert.ok(result.match.street, 'Historical fullAddress records must produce a non-empty address result');
  assert.equal(result.match.fullAddress, '123 Lê Lợi, Phường Bến Thành, Quận 1, Thành phố Hồ Chí Minh');
}

{
  const h = createHarness();
  await h.learning.recordUserCorrection({
    field: 'name', originalValue: 'Nguen Van A', correctedValue: 'Nguyễn Văn A',
    rawText: 'Nguen Van A 0901234567', shopId: 'shop-a'
  });

  h.setSyncFailure(true);
  const failed = await h.learning.flushPendingCloudSync('shop-a');
  assert.equal(failed.success, false);
  assert.equal(failed.pendingCount, 1, 'Failed sync must keep a durable pending entry');

  h.setSyncFailure(false);
  const recovered = await h.learning.flushPendingCloudSync('shop-a');
  assert.equal(recovered.success, true);
  assert.equal(recovered.pendingCount, 0, 'Successful retry must drain the durable outbox');
}

{
  const h = createHarness();
  await h.learning.learn('xóa cục bộ', address('Địa chỉ cần xóa', 100), '', {
    shopId: 'shop-a', sourceType: 'human_confirmed', verified: true
  });
  assert.ok(await h.learning.lookup('xóa cục bộ', '', 'shop-a'));
  await h.learning.removeLocalEntry('address_raw', 'xóa cục bộ', 'shop-a');
  assert.equal(await h.learning.lookup('xóa cục bộ', '', 'shop-a'), null);
}

console.log('✅ AddressLearning production safety behavior passed.');

const contentCode = fs.readFileSync(path.join(rootDir, 'src/runtime/content/index.js'), 'utf8');
assert.match(
  contentCode,
  /AddressLearning\.applyCorrections\([\s\S]*?localResult[\s\S]*?text/,
  'The live parser must apply shop-scoped corrections before presenting its result'
);
assert.match(
  contentCode,
  /recordUserCorrection\([\s\S]*?confirmed:\s*true/,
  'Carrier approval must promote changed fields to confirmed human evidence'
);
assert.doesNotMatch(
  contentCode,
  /category:\s*'order_code_pattern'/,
  'Order-code corrections must use the reusable field-correction pipeline'
);
