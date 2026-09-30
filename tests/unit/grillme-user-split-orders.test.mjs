import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

if (typeof globalThis.window === 'undefined') {
  globalThis.window = globalThis;
}

const rawNewAdm = JSON.parse(readFileSync(resolve('src/application/address/database/data-new.json'), 'utf8'));

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

await import('../../src/application/address/database/data.js');
await import('../../src/application/address/aliases.js');
await import('../../src/application/address/fuzzy.js');
await import('../../src/application/address/normalizer.js');
await import('../../src/application/address/database/ward_merger.js');
await import('../../src/application/address/rules.js');
await import('../../src/application/address/parser.js');
await import('../../src/application/address/validator.js');
await import('../../src/application/address/learning.js');
await import('../../src/application/address/engine.js');
await import('../../src/domain/parser/bulk-parser.service.js');
await import('../../src/application/order-parser/parser.js');

const userRawInput = `Đặng Nam
Kho thuốc thú y
Cầu Thuận Giang xã chợ mới tỉnh an giang
Tuấn vandijk
0372662492
E90.249
Cod 300k


The Anh 
E90.242
Cod 400k
Thế anh
 172 lương thế vinh thanh xuân hà nội 
0377022433




Người nhận: Em Thịnh 	Kha
Sđt: 0888241555
địa chỉ: : 53 Mỹ Đa Tây 10, phường Khuê Mỹ, Quận Ngũ Hành Sơn, Tp Đà Nẵng (đặt app: 37 Mỹ Đa Tây 10)
Cod 0đ

Binh Le
149 duong huynh cuong phuong an cu ninh kieu tp can tho anh binh 0967225599
E100.494
E90.254
Cod 1 triệu

269 Huỳnh thị tươi kp Tân thắng p Tân bình dĩ an bình dương (cũ)
đạt lưu ) acc diem huong ) 
e80.331
cod 200k
0786134555
19 triệu việt vương, phường hai bà trưng, hà nội 
Quân 0904983747 
quan tran ( acc kim sa tùng ) 
e135.34
cod 800k



Việt Đức ( acc nhựt lũa )
0334729510
Ngõ Cao, Xóm 8, Thôn Nam Quang 2, Phường Hồng Quang, Ninh Bình
e80.333
cod 300k

Binh Le
149 duong huynh cuong phuong an cu ninh kieu tp can tho anh binh 0967225599
E100.494
E90.254
Cod 1 triệu ( lên dơn nhưng ko cảnh báo)
`;

test('BulkParserService correctly splits user input into 8 discrete order chunks', () => {
  const chunks = globalThis.BulkParserService.splitRawTextToChunks(userRawInput);
  assert.equal(chunks.length, 8, 'Must split the 7 raw blocks (with 1 double block) into exactly 8 chunks');
});

test('Chunk 1: Tuấn vandijk, An Giang, Đặng Nam in extraNote', () => {
  const chunks = globalThis.BulkParserService.splitRawTextToChunks(userRawInput);
  const parsed = globalThis.OrderProcessor.parse(chunks[0]);
  assert.equal(parsed.name, 'Tuấn vandijk');
  assert.equal(parsed.phone, '0372662492');
  assert.equal(parsed.orderCode, 'E90.249');
  assert.equal(parsed.codAmount, 300000);
  assert.equal(parsed.extraNote, 'Đặng Nam');
});

test('Chunk 2: Thế anh, Thanh Xuân Hà Nội', () => {
  const chunks = globalThis.BulkParserService.splitRawTextToChunks(userRawInput);
  const parsed = globalThis.OrderProcessor.parse(chunks[1]);
  assert.equal(parsed.name, 'Thế anh');
  assert.equal(parsed.phone, '0377022433');
  assert.equal(parsed.orderCode, 'E90.242');
  assert.equal(parsed.codAmount, 400000);
});

test('Chunk 3: Thịnh Kha (cleaned pronoun Em, tabs), 0d COD, Đà Nẵng', () => {
  const chunks = globalThis.BulkParserService.splitRawTextToChunks(userRawInput);
  const parsed = globalThis.OrderProcessor.parse(chunks[2]);
  assert.equal(parsed.name, 'Thịnh Kha');
  assert.equal(parsed.phone, '0888241555');
  assert.equal(parsed.codAmount, 0);
  assert.equal(parsed.codExplicitZero, true);
  assert.equal(parsed.extraNote, 'đặt app: 37 Mỹ Đa Tây 10');
  assert.ok(!parsed.address.includes('Người nhận:'));
});

test('Chunk 4: Binh Le, multi-code, 1 triệu COD, Cần Thơ unaccented address', () => {
  const chunks = globalThis.BulkParserService.splitRawTextToChunks(userRawInput);
  const parsed = globalThis.OrderProcessor.parse(chunks[3]);
  assert.equal(parsed.name, 'Binh Le');
  assert.equal(parsed.phone, '0967225599');
  assert.equal(parsed.codAmount, 1000000);
  assert.deepEqual(parsed.orderCodes, ['E100.494', 'E90.254']);
});

test('Chunk 5: đạt lưu, 0786134555, Dĩ An Bình Dương (cũ)', () => {
  const chunks = globalThis.BulkParserService.splitRawTextToChunks(userRawInput);
  const parsed = globalThis.OrderProcessor.parse(chunks[4]);
  assert.equal(parsed.name, 'đạt lưu');
  assert.equal(parsed.phone, '0786134555');
  assert.equal(parsed.orderCode, 'e80.331');
  assert.equal(parsed.codAmount, 200000);
});

test('Chunk 6: Quân, 0904983747, Hai Bà Trưng Hà Nội, note acc kim sa tùng', () => {
  const chunks = globalThis.BulkParserService.splitRawTextToChunks(userRawInput);
  const parsed = globalThis.OrderProcessor.parse(chunks[5]);
  assert.equal(parsed.name, 'Quân');
  assert.equal(parsed.phone, '0904983747');
  assert.equal(parsed.orderCode, 'e135.34');
  assert.equal(parsed.codAmount, 800000);
  assert.equal(parsed.extraNote, 'acc kim sa tùng');
});

test('Chunk 7: Việt Đức, 0334729510, Ninh Bình', () => {
  const chunks = globalThis.BulkParserService.splitRawTextToChunks(userRawInput);
  const parsed = globalThis.OrderProcessor.parse(chunks[6]);
  assert.equal(parsed.name, 'Việt Đức');
  assert.equal(parsed.phone, '0334729510');
  assert.equal(parsed.orderCode, 'e80.333');
  assert.equal(parsed.codAmount, 300000);
  assert.equal(parsed.extraNote, 'acc nhựt lũa');
});
