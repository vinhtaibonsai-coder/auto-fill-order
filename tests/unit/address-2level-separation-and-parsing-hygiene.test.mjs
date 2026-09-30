import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Mock browser globals for parser and address engine
if (typeof globalThis.window === 'undefined') {
  globalThis.window = globalThis;
}

const rawNewAdm = JSON.parse(readFileSync(resolve('src/application/address/database/data-new.json'), 'utf8'));

// Build NEW_ADM_DB structure
function buildNewAdmDb(data) {
  const provincesMap = {};
  const wardsMap = {};
  for (const entry of data) {
    const cleanShort = (entry.province_short_name || entry.province_name || '').trim();
    if (!cleanShort) continue;
    const placeType = cleanShort.startsWith('Thành phố') ? 'Thành phố Trung Ương' : 'Tỉnh';
    const fullName = placeType === 'Tỉnh' ? 'Tỉnh ' + cleanShort : cleanShort;
    if (!provincesMap[fullName]) {
      provincesMap[fullName] = {
        name: fullName,
        short_name: cleanShort,
        place_type: placeType
      };
    }
    if (!wardsMap[fullName]) wardsMap[fullName] = [];
    wardsMap[fullName].push({
      name: (entry.ward_name || '').trim(),
      code: entry.ward_code || '',
      old_units: entry.old_units || []
    });
  }
  return {
    provinces: Object.values(provincesMap),
    wards: wardsMap
  };
}

globalThis.NEW_ADM_DB = buildNewAdmDb(rawNewAdm);

import '../../src/application/address/database/data.js';
import '../../src/application/address/aliases.js';
import '../../src/application/address/fuzzy.js';
import '../../src/application/address/normalizer.js';
import '../../src/application/address/database/ward_merger.js';
import '../../src/application/address/rules.js';
import '../../src/application/address/parser.js';
import '../../src/application/address/validator.js';
import '../../src/application/address/learning.js';
import '../../src/application/address/engine.js';
import '../../src/application/order-parser/parser.js';

test('Địa chỉ 2 cấp mới 2025: Phường Tân Mỹ, HCM được bảo vệ tuyệt đối và không bị sáp nhập sai', async () => {
  const rawAddr = 'Block D27 16.03, Chung cư Belleza, Phường Tân Mỹ, HCM';
  const parsed = await globalThis.AddressEngine.process(rawAddr);

  assert.equal(parsed.province, 'Thành phố Hồ Chí Minh', 'Tỉnh/TP phải là Thành phố Hồ Chí Minh');
  assert.equal(parsed.ward, 'Phường Tân Mỹ', 'Phường phải giữ nguyên Phường Tân Mỹ, không bị đổi sang Tân Uyên hay Thường Tân');
  assert.equal(parsed.district, '', 'Địa chỉ 2 cấp mới không có quận/huyện');
});

test('Bóc tách đơn hàng hỗn hợp: SĐT dính tên, mã đơn dính COD', () => {
  const rawOrder = `Block D27 16.03, Chung cư Belleza, Phường Tân Mỹ, HCM\n0348043027võ trần ( acc nhựt lũa ) e60.205cod 200k`;
  const res = globalThis.OrderProcessor.parse(rawOrder);

  assert.equal(res.phone, '0348043027', 'SĐT phải được bóc tách chính xác');
  assert.match(res.name.toLowerCase(), /võ trần/, 'Tên khách hàng không được dính SĐT');
  assert.ok(!res.name.includes('0348043027'), 'Tên khách hàng không được chứa số điện thoại');
  assert.equal(res.orderCode, 'e60.205', 'Mã đơn e60.205 phải được nhận diện chính xác');
  assert.equal(res.codAmount, 200000, 'COD phải là 200000');
  assert.match(res.address, /Belleza/, 'Địa chỉ giữ nguyên đường/chung cư');
});

test('ward_merger.js đã dọn sạch mapping rác Tân Mỹ -> Tân Uyên / Thường Tân tại HCM', () => {
  const wmFile = readFileSync(resolve('src/application/address/database/ward_merger.js'), 'utf8');
  assert.ok(!wmFile.includes('"Xã Tân Mỹ (Thành phố Hồ Chí Minh)"'), 'Đã xóa mapping rác Xã Tân Mỹ (Thành phố Hồ Chí Minh)');
  assert.ok(!wmFile.includes('"xa tan my (ho chi minh)"'), 'Đã xóa mapping rác xa tan my (ho chi minh)');
});

test('Địa chỉ Quy Nhơn - Bình Định: Phường Đống Đa không bị đổi sang Gia Lai hay Phường Quy Nhơn', async () => {
  const rawOrder = `Hưng Võ
Hưng 61 đường 1 tháng 5 , phường Đống Đa thành phố Quy Nhơn tỉnh Bình Định
0369099179
E80.361
Cod 380k`;

  const parsedOrder = globalThis.OrderProcessor.parse(rawOrder);
  assert.equal(parsedOrder.name, 'Hưng Võ');
  assert.equal(parsedOrder.phone, '0369099179');
  assert.equal(parsedOrder.orderCode, 'E80.361');
  assert.equal(parsedOrder.codAmount, 380000);

  const addrResult = await globalThis.AddressEngine.process(parsedOrder.address);
  assert.equal(addrResult.province, 'Tỉnh Bình Định', 'Tỉnh phải là Tỉnh Bình Định, tuyệt đối không bị đổi sang Gia Lai');
  assert.equal(addrResult.district, 'Thành phố Quy Nhơn', 'Quận/Huyện phải là Thành phố Quy Nhơn');
  assert.equal(addrResult.ward, 'Đống Đa', 'Phường phải là Đống Đa, không bị sáp nhập mù thành Phường Quy Nhơn');
  assert.match(addrResult.street, /61 Đường 1 Tháng 5/i);
  assert.equal(addrResult.warning, '', 'Không có cảnh báo sáp nhập sai');
  assert.ok(!addrResult.fullAddress.includes('Gia Lai'), 'Địa chỉ đầy đủ không được chứa chữ Gia Lai');
});

test('ward_merger.js và data-new.json đã dọn sạch mapping rác Quy Nhơn -> Gia Lai', () => {
  const wmFile = readFileSync(resolve('src/application/address/database/ward_merger.js'), 'utf8');
  assert.ok(!wmFile.includes('"Phường Đống Đa (thành phố Quy Nhơn)": { ward: "Phường Quy Nhơn", province: "Gia Lai" }'), 'Đã xóa mapping rác Đống Đa Quy Nhơn -> Gia Lai');
  assert.ok(!wmFile.includes('"Phường Đống Đa (Tỉnh Gia Lai)": { ward: "Phường Quy Nhơn", province: "Tỉnh Gia Lai" }'), 'Đã xóa mapping rác Đống Đa Gia Lai -> Quy Nhơn');

  const dataNew = JSON.parse(readFileSync(resolve('src/application/address/database/data-new.json'), 'utf8'));
  const bdBits = dataNew.filter(e => e.province_code === '52');
  assert.ok(bdBits.length > 0, 'Phải có các đơn vị cho tỉnh 52 (Bình Định)');
  assert.ok(bdBits.every(e => e.province_name === 'Tỉnh Bình Định'), 'Tất cả các đơn vị mã 52 phải có province_name là Tỉnh Bình Định');
});

test('P705 là số phòng, không được nhận thành Phường 705 hoặc đổi Bồ Đề sang Việt Hưng', async () => {
  const rawOrder = `Tai Nguyen
P705, nhà HH2B, đơn nguyên B, chung cư Gia Thuỵ, tổ 16 Phường Bồ Đề, Hà Nội
0986888383
Cod 0đ`;

  const parsedOrder = globalThis.OrderProcessor.parse(rawOrder);
  assert.equal(parsedOrder.name, 'Tai Nguyen');
  assert.equal(parsedOrder.phone, '0986888383');
  assert.equal(parsedOrder.codAmount, 0);
  assert.equal(parsedOrder.codExplicitZero, true);
  assert.match(parsedOrder.address, /^P705,/i, 'P705 phải được giữ trong địa chỉ chi tiết');

  const locallyParsedAddress = globalThis.AddressParser.parse(globalThis.AddressNormalizer.normalize(parsedOrder.address));
  assert.equal(locallyParsedAddress.ward, 'Phường Bồ Đề', 'parser phải ưu tiên cụm hành chính được ghi rõ Phường Bồ Đề');

  const address = await globalThis.AddressEngine.process(parsedOrder.address);
  assert.equal(address.province, 'Thành phố Hà Nội');
  assert.equal(address.ward, 'Phường Bồ Đề');
  assert.doesNotMatch(address.ward, /705|Việt Hưng/i);
  assert.match(address.street, /P705/i, 'số phòng P705 phải nằm trong phần đường/địa chỉ chi tiết');
});
