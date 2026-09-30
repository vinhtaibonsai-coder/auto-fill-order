import test from 'node:test';
import assert from 'node:assert/strict';

import '../../src/application/address/database/data.js';
import '../../src/application/address/aliases.js';
import '../../src/application/address/fuzzy.js';
import '../../src/application/address/normalizer.js';
import '../../src/application/address/parser.js';
import '../../src/application/order-parser/parser.js';
import '../../src/application/address/learning.js';

test('1. Sender Disambiguation: Dao Duy Phuoc (sender) vs Thanh Dat (receiver)', () => {
  const rawText = `CD374508178VN
Thành Đạt
0971579028
Pt263
Đã lên Cloud 1.100.000đ 🔵 Shop trả cước
VNPost
ĐÀO DUY PHƯỚC
TP. Đà Nẵng, P. Điện Bàn Đông`;

  const parseCtx = {
    carrierAccount: 'ĐÀO DUY PHƯỚC',
    activeShopName: 'Bonsai Shop'
  };

  const parsed = globalThis.OrderProcessor.parse(rawText, parseCtx);

  // Receiver verification
  assert.equal(parsed.name, 'Thành Đạt', 'Receiver name should be Thành Đạt, not sender');
  assert.equal(parsed.phone, '0971579028', 'Receiver phone should be 0971579028');
  assert.equal(parsed.orderCode, 'Pt263', 'Order code should be Pt263');
  assert.equal(parsed.codAmount, 1100000, 'COD should be 1,100,000');
  assert.equal(parsed.collectFee, false, 'Shop trả cước means collectFee is false');

  // Sender verification
  assert.ok(parsed.senderInfo, 'Sender info block should be detected');
  assert.match(parsed.senderInfo.senderRaw, /ĐÀO DUY PHƯỚC/i, 'Sender block should contain sender name');
  
  // Receiver address should NOT be sender address
  assert.doesNotMatch(parsed.address || '', /Đào Duy Phước/i, 'Receiver address must not include sender name');
  assert.doesNotMatch(parsed.address || '', /Điện Bàn Đông/i, 'Receiver address must not include sender address');
});

test('2. Conversational Preprocessing: 1-line chat message with conversational filler', () => {
  const rawText = 'shop ơi gửi cho mình về địa chỉ 123 đường Lê Lợi, P. Bến Nghé, Quận 1, HCM sđt 0912345678 tên Minh Quân mã đơn MQ88 cod 250k bọc xốp cẩn thận giùm mình nha shop';

  const parsed = globalThis.OrderProcessor.parse(rawText);

  assert.equal(parsed.name, 'Minh Quân', 'Receiver name should be extracted properly from 1-line chat');
  assert.equal(parsed.phone, '0912345678', 'Receiver phone should be extracted');
  assert.match(parsed.orderCode, /MQ88/i, 'Order code MQ88 should be extracted');
  assert.equal(parsed.codAmount, 250000, 'COD amount should be 250,000');
  assert.match(parsed.address, /123.*Lê Lợi/i, 'Address should contain street');
  assert.match(parsed.address, /Bến Nghé/i, 'Address should contain ward');
  assert.match(parsed.address, /HCM/i, 'Address should contain province');
});

test('3. Confidence Scoring Engine: High, Medium, and Low evaluations', () => {
  // Case 3.1: Complete valid order with all 4 criteria
  const fullOrder = `Nguyễn Văn An
0987654321
Số 45 Lê Duẩn, Phường Bến Nghé, Quận 1, TP Hồ Chí Minh
Mã: ORD1001
COD: 350.000đ`;

  const parsedFull = globalThis.OrderProcessor.parse(fullOrder);
  assert.ok(parsedFull.confidence, 'Parsed result must contain confidence object');
  assert.ok(parsedFull.confidence.score >= 85, `Full order score should be >= 85, got ${parsedFull.confidence.score}`);
  assert.equal(parsedFull.confidence.level, 'high', 'Full order level should be high');

  // Case 3.2: Missing phone and incomplete address
  const incompleteOrder = `Trần Thị Mai
Giao nhanh nha shop`;
  const parsedIncomplete = globalThis.OrderProcessor.parse(incompleteOrder);
  assert.ok(parsedIncomplete.confidence.score < 60, `Incomplete order score should be < 60, got ${parsedIncomplete.confidence.score}`);
  assert.equal(parsedIncomplete.confidence.level, 'low', 'Incomplete order level should be low');
});

test('4. Active Learning: recordUserCorrection stores and updates cache', async () => {
  // Mock chrome storage
  const mockStorage = {};
  globalThis.chrome = {
    runtime: { id: 'mock-test-extension' },
    storage: {
      local: {
        get: (keys, cb) => {
          const res = {};
          (Array.isArray(keys) ? keys : [keys]).forEach(k => { res[k] = mockStorage[k]; });
          cb(res);
        },
        set: (obj, cb) => {
          Object.assign(mockStorage, obj);
          if (cb) cb();
        }
      }
    }
  };

  assert.ok(typeof globalThis.AddressLearning !== 'undefined', 'AddressLearning should exist');
  assert.ok(typeof globalThis.AddressLearning.recordUserCorrection === 'function', 'recordUserCorrection must be a function');

  const result = await globalThis.AddressLearning.recordUserCorrection({
    field: 'address',
    originalValue: '123 Le Loi Q1',
    correctedValue: '123 Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
    rawText: 'anh Ba 0909123456 123 Le Loi Q1',
    phone: '0909123456'
  });

  assert.ok(result, 'Correction result should be returned');
  assert.equal(result.field, 'address');
  assert.equal(result.originalValue, '123 Le Loi Q1');
  assert.equal(result.correctedValue, '123 Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh');

  // Verify memory cache
  const cache = globalThis.__SHOP_USER_CORRECTIONS_CACHE__ || [];
  const found = cache.find(c => c.originalValue === '123 Le Loi Q1');
  assert.ok(found, 'Correction should be recorded in local memory cache');
});
