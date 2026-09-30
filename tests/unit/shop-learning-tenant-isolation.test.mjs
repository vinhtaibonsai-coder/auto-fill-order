import assert from 'node:assert/strict';
import { test } from 'node:test';

test('Shop Tenant Cache Isolation and Runtime Compatibility', async () => {
  // Simulate mock storage for chrome.storage.local
  const mockLocalStorage = new Map();
  globalThis.chrome = {
    runtime: { id: 'test-ext' },
    storage: {
      local: {
        get(keys, cb) {
          const res = {};
          const list = Array.isArray(keys) ? keys : [keys];
          list.forEach(k => {
            if (mockLocalStorage.has(k)) res[k] = mockLocalStorage.get(k);
          });
          cb(res);
        },
        set(obj, cb) {
          Object.entries(obj).forEach(([k, v]) => mockLocalStorage.set(k, v));
          if (cb) cb();
        },
        remove(keys, cb) {
          const list = Array.isArray(keys) ? keys : [keys];
          list.forEach(k => mockLocalStorage.delete(k));
          if (cb) cb();
        }
      }
    }
  };

  // Mock global components needed by AddressEngine
  globalThis.AddressRules = {
    applyRules: async match => match
  };
  globalThis.AddressValidator = {
    validate: () => true
  };
  globalThis.AddressNormalizer = {
    normalize: str => str
  };
  globalThis.AddressParser = {
    parse: str => ({ street: str, ward: 'Phường Test', district: 'Quận Test', province: 'Hà Nội', confidence: 95 })
  };

  // 1. Load learning module
  await import('../../src/application/address/learning.js');
  await import('../../src/application/address/engine.js');

  const learning = globalThis.AddressLearning;
  const engine = globalThis.AddressEngine;
  assert.ok(learning, 'AddressLearning must be defined');
  assert.ok(engine, 'AddressEngine must be defined');

  const shopA = 'shop-111-aaa';
  const shopB = 'shop-222-bbb';

  // 2. Shop A learns an address
  await learning.learn('123 Phố Cổ Hà Nội', {
    street: '123 Phố Cổ',
    ward: 'Phường Hàng Bạc',
    district: 'Quận Hoàn Kiếm',
    province: 'Hà Nội',
    confidence: 95
  }, '0912345678', { shopId: shopA, sourceType: 'human_confirmed', verified: true });

  // 3. Lookup under Shop A must succeed
  const lookupShopA = await learning.lookup('123 Phố Cổ Hà Nội', '0912345678', shopA);
  assert.ok(lookupShopA, 'Shop A must find its learned address');
  assert.equal(lookupShopA.match.street, '123 Phố Cổ');

  // 4. Lookup under Shop B must NEVER find Shop A data!
  const lookupShopB = await learning.lookup('123 Phố Cổ Hà Nội', '0912345678', shopB);
  assert.equal(lookupShopB, null, 'Shop B must NEVER find Shop A learned data (strict tenant isolation)');

  // 5. Historical data compatibility test:
  // When a record has only fullAddress, AddressEngine.process must not return empty fullAddress
  await learning.learn('456 Đường Lịch Sử', {
    fullAddress: '456 Đường Lịch Sử, Phường Test, Quận Test, Hà Nội',
    confidence: 90
  }, '', { shopId: shopB, sourceType: 'historical' });

  const processed = await engine.process('456 Đường Lịch Sử');
  // Process should have parsed and built a non-empty fullAddress
  assert.ok(processed.fullAddress, 'Engine process must never return empty fullAddress for historical data');
  assert.match(processed.fullAddress, /456 Đường Lịch Sử/);

  console.log('✅ Shop Tenant Cache Isolation and Runtime Compatibility passed.');
});
