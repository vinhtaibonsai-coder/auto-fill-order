import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Setup environment
if (typeof globalThis.window === 'undefined') {
  globalThis.window = globalThis;
}

import '../../src/application/address/database/data.js';
import '../../src/application/address/aliases.js';
import '../../src/application/address/fuzzy.js';
import '../../src/application/address/database/data-new-loader.js';
import '../../src/application/address/database/ward_merger.js';
import '../../src/application/address/validator.js';
import '../../src/application/address/sanitizer.js';
import '../../src/application/address/normalizer.js';
import '../../src/application/address/learning.js';
import '../../src/application/address/rules.js';
import '../../src/application/address/parser.js';
import '../../src/application/address/engine.js';
import '../../src/application/order-parser/parser.js';

test('User Order: Số 10 ngõ Quan - Thôn Thượng Quán - Xã Thường Tín - Hà Nội', async () => {
  if (globalThis.loadNewAdmDb) await globalThis.loadNewAdmDb();

  const rawOrder = `Đc Số 10 ngõ Quan - Thôn Thượng Quán - Xã Thường Tín - Hà Nội
0359075399
bách khoa (acc kim sa tùng )
e120.206
cod 0đ`;

  // 1. OrderProcessor.parse
  const res = globalThis.OrderProcessor.parse(rawOrder);
  assert.equal(res.name, 'bách khoa', 'Tên khách hàng phải là bách khoa');
  assert.equal(res.phone, '0359075399', 'Số điện thoại phải là 0359075399');
  assert.equal(res.orderCode, 'e120.206', 'Mã đơn phải là e120.206');
  assert.equal(res.codAmount, 0, 'COD phải là 0đ');
  assert.ok(!res.address.includes('Quận'), 'ngõ Quan không được biến thành ngõ Quận');
  assert.match(res.address, /ngõ Quan/i, 'Địa chỉ phải giữ nguyên ngõ Quan');

  // 2. AddressParser.parse
  const parsed = globalThis.AddressParser.parse(res.address);
  assert.equal(parsed.ward, 'Xã Thường Tín', 'Phải nhận diện được Xã Thường Tín');
  assert.equal(parsed.district, '', 'Địa chỉ 2 cấp mới không được thêm Huyện Thường Tín');
  assert.match(parsed.province, /Hà Nội/i, 'Tỉnh thành là Hà Nội');
  assert.equal(parsed.isTwoLevel, true, 'isTwoLevel phải là true');

  // 3. AddressEngine.process
  const engineRes = await globalThis.AddressEngine.process(res.address);
  assert.equal(engineRes.ward, 'Xã Thường Tín', 'Engine ward là Xã Thường Tín');
  assert.equal(engineRes.district, '', 'Engine district phải là rỗng cho địa chỉ 2 cấp');
  assert.match(engineRes.province, /Hà Nội/i, 'Engine province là Hà Nội');
  assert.equal(engineRes.isTwoLevel, true, 'Engine isTwoLevel phải là true');
  assert.ok(!engineRes.fullAddress.includes('Huyện Thường Tín'), 'fullAddress không được chứa Huyện Thường Tín');
  assert.match(engineRes.fullAddress, /Xã Thường Tín, (?:Thành phố )?Hà Nội/, 'fullAddress phải theo định dạng 2 cấp: Xã Thường Tín, Hà Nội');
});

test('Address Hygiene: Bảo vệ ngõ Quan, phố Quan Hoa, thôn Quan không bị đổi thành Quận', () => {
  const samples = [
    { input: 'Đc 123 ngõ Quan, thôn Thượng Quán, Hà Nội', expected: 'ngõ Quan' },
    { input: 'Số 15 phố Quan Hoa, Cầu Giấy, Hà Nội', expected: 'phố Quan Hoa' },
    { input: 'Thôn Quan, xã Tiên Lữ, Lập Thạch, Vĩnh Phúc', expected: 'Thôn Quan' },
    { input: 'quan 1, tphcm', expected: 'Quận 1' }
  ];

  for (const s of samples) {
    const res = globalThis.OrderProcessor.parse(s.input);
    assert.match(res.address, new RegExp(s.expected, 'i'), `Địa chỉ "${s.input}" phải chứa "${s.expected}"`);
  }
});
