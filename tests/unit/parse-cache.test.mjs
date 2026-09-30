import assert from 'node:assert/strict';
import { ParseCache, parseCache } from '../../src/application/cache/parse-cache.js';

console.log('🧪 Running ParseCache Unit Tests...');

// 1. Tính toán Hash đơn định (Deterministic Hash)
const textSample = 'Nguyễn Văn A 0987654321 123 Cầu Giấy Hà Nội COD 500k';
const hash1 = await parseCache.computeHash(textSample, 'shop_1');
const hash2 = await parseCache.computeHash(textSample, 'shop_1');
assert.equal(hash1, hash2, 'Hash must be strictly deterministic for identical text and shopId');

// 2. Phân lập theo Shop (Shop isolation)
const hashShop2 = await parseCache.computeHash(textSample, 'shop_2');
assert.notEqual(hash1, hashShop2, 'Different shopIds must produce different cache keys');

// 3. Cache Set & Get (Hit)
const mockResult = {
  name: 'Nguyễn Văn A',
  phone: '0987654321',
  address: '123 Cầu Giấy Hà Nội',
  codAmount: 500000
};

await parseCache.set(textSample, 'shop_1', mockResult);
const cached = await parseCache.get(textSample, 'shop_1');
assert.ok(cached, 'Cached result must exist');
assert.equal(cached.name, 'Nguyễn Văn A');
assert.equal(cached.codAmount, 500000);
assert.equal(cached._fromCache, true);

// 4. Cache Miss trên text khác hoặc shop khác
const missText = await parseCache.get('Đơn hàng khác 0912345678', 'shop_1');
assert.equal(missText, null, 'Uncached text must return null');

const missShop = await parseCache.get(textSample, 'shop_2');
assert.equal(missShop, null, 'Cache from another shop must return null');

// 5. TTL Expiration
const shortLivedCache = new ParseCache({ ttlMs: 10 }); // 10ms TTL
await shortLivedCache.set('Text hết hạn', 'shop_test', { ok: true });
await new Promise(r => setTimeout(r, 25)); // Đợi 25ms
const expired = await shortLivedCache.get('Text hết hạn', 'shop_test');
assert.equal(expired, null, 'Expired cache entry must return null');

console.log('✅ ALL PARSE CACHE UNIT TESTS PASSED 100%!');
