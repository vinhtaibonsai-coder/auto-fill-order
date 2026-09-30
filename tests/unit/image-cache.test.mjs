import test from 'node:test';
import assert from 'node:assert/strict';
import { ParseCache } from '../../src/application/cache/parse-cache.js';

test('Image Cache: caches and retrieves image OCR result by image hash', async () => {
  const cache = new ParseCache({ ttlMs: 10000 });
  const mockImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  
  const parsedData = {
    success: true,
    branch: 'GOOD',
    confidence: 96,
    orderData: {
      name: 'Trần Thị Thảo',
      phone: '0987654321',
      address: '456 Hai Bà Trưng, Phường Tân Định, Quận 1, TP. Hồ Chí Minh',
      codAmount: 350000
    }
  };

  // 1. First lookup: Miss
  const miss = await cache.getImage(mockImage, 'shop-1');
  assert.equal(miss, null);

  // 2. Set cache
  await cache.setImage(mockImage, 'shop-1', parsedData);

  // 3. Second lookup: Hit
  const hit = await cache.getImage(mockImage, 'shop-1');
  assert.ok(hit);
  assert.equal(hit.success, true);
  assert.equal(hit.branch, 'GOOD');
  assert.equal(hit._fromCache, true);
  assert.equal(hit.orderData.name, 'Trần Thị Thảo');
  assert.equal(hit.orderData.phone, '0987654321');
  assert.equal(hit.imageThumbnail, mockImage);
});

test('Image Cache: enforces shop isolation and image hash differentiation', async () => {
  const cache = new ParseCache();
  const imgA = 'data:image/png;base64,AAAAIMAGEAAAABBBB';
  const imgB = 'data:image/png;base64,CCCCIMAGECDDDDEEEE';

  await cache.setImage(imgA, 'shop-alpha', {
    orderData: { name: 'Khách Shop Alpha', phone: '0901111111' }
  });

  // Different shop cannot access Shop Alpha's cached image
  const crossShop = await cache.getImage(imgA, 'shop-beta');
  assert.equal(crossShop, null);

  // Different image returns null
  const diffImage = await cache.getImage(imgB, 'shop-alpha');
  assert.equal(diffImage, null);
});

test('Image Cache: storage sanitization strips large imageThumbnail from stored value', async () => {
  let storedObj = null;
  globalThis.chrome = {
    storage: {
      local: {
        get: (keys, cb) => cb({}),
        set: (obj) => { storedObj = obj; }
      }
    }
  };

  const cache = new ParseCache();
  const mockImage = 'data:image/jpeg;base64,' + 'X'.repeat(50000); // 50KB image

  await cache.setImage(mockImage, 'shop-1', {
    success: true,
    imageThumbnail: mockImage,
    orderData: { name: 'Nguyễn Văn Test' }
  });

  assert.ok(storedObj, 'Should persist to chrome.storage.local');
  const storedKey = Object.keys(storedObj)[0];
  const payload = storedObj[storedKey];

  assert.ok(payload.result);
  assert.equal(payload.result.imageThumbnail, undefined, 'imageThumbnail must be stripped to save storage');
  assert.equal(payload.result.orderData.name, 'Nguyễn Văn Test');

  // Clean up
  delete globalThis.chrome;
});
