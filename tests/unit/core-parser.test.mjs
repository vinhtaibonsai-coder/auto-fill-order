import assert from 'node:assert/strict';
import { parseOrderText, normalizeAddress, parseAndNormalize } from '../../src/application/order-parser/core-parser.js';

console.log('🧪 Running CoreParser Interface Unit Tests...');

// 1. Test parseOrderText
const sample1 = 'Anh Tuấn 0912345678 số 12 phố Huế Hàng Bài Hoàn Kiếm Hà Nội COD 450k';
const res1 = await parseOrderText(sample1);
assert.equal(res1.order.phone, '0912345678');
assert.equal(res1.order.codAmount, 450000);
assert.ok(res1.order.name.includes('Tuấn'));
assert.ok(res1.confidence.overall >= 0.8, 'Confidence should be high for clear order');
assert.equal(res1.source, 'local');

// 2. Test cache integration on second parse
const resCached = await parseOrderText(sample1);
assert.equal(resCached.source, 'cache', 'Second call must be served from cache');
assert.equal(resCached.order.phone, '0912345678');

// 3. Test normalizeAddress
const addrSample = '339 ngõ quỳnh phường bạch mai hai bà trưng hà nội';
const addrRes = await normalizeAddress(addrSample);
assert.ok(addrRes.province.toLowerCase().includes('hà nội') || addrRes.normalized.toLowerCase().includes('hà nội'));
assert.ok(addrRes.ward.toLowerCase().includes('bạch mai') || addrRes.normalized.toLowerCase().includes('bạch mai'));

// 4. Test parseAndNormalize
const combinedRes = await parseAndNormalize('Chị Lan 0988776655 45 Lê Duẩn, Bến Nghé, Quận 1, Hồ Chí Minh thu hộ 1.2tr');
assert.equal(combinedRes.order.phone, '0988776655');
assert.equal(combinedRes.order.codAmount, 1200000);
assert.ok(combinedRes.order.province || combinedRes.order.normalizedAddress);

console.log('✅ ALL CORE PARSER INTERFACE TESTS PASSED 100%!');
