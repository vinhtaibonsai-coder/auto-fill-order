import assert from 'node:assert/strict';
import test from 'node:test';
import { OrderProcessor } from '../../src/application/order-parser/parser.esm.js';
import pkg from '../../src/domain/parser/bulk-parser.service.js';
const BulkParserService = pkg;

test('Order with multiple order codes records all codes', async () => {
  const raw = `Phạm Lân
lân 0946661360
Gần đền lưu phái, ngũ hiệp, thanh trì , hà nội ( cá cảnh đăng khoa )
e135.71
E120.326
E120.314
E120.317
Cod 3.700k`;

  // 1. Single OrderProcessor
  const single = OrderProcessor.parse(raw);
  assert.equal(single.name, 'Phạm Lân', 'Name should be Phạm Lân (not chatter and not single word)');
  assert.equal(single.phone, '0946661360', 'Phone should be 0946661360');
  assert.equal(single.orderCode, 'e135.71, E120.326, E120.314, E120.317', 'orderCode string must contain all 4 codes');
  assert.deepEqual(single.orderCodes, ['e135.71', 'E120.326', 'E120.314', 'E120.317'], 'orderCodes array must contain all 4 codes');
  assert.equal(single.codAmount, 3700000, 'COD should be 3.700.000đ');
  assert.equal(single.extraNote, 'cá cảnh đăng khoa', 'Extra note should be cá cảnh đăng khoa');

  // 2. BulkParserService
  const bulk = await BulkParserService.parseBulkOrders(raw);
  assert.equal(bulk.length, 1, 'Should parse as 1 single order chunk');
  assert.equal(bulk[0].name, 'Phạm Lân', 'Bulk name should be Phạm Lân');
  assert.equal(bulk[0].orderCode, 'e135.71, E120.326, E120.314, E120.317', 'Bulk orderCode must contain all 4 codes');
  assert.equal(bulk[0].cod, 3700000, 'Bulk cod must be 3.700.000đ');
});
