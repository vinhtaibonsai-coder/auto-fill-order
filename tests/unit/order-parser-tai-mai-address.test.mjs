import assert from 'node:assert/strict';

import '../../src/application/order-parser/parser.js';
import '../../src/application/address/normalizer.js';

const rawText = `Tài Mai
50/22 đường B khu ADC phường Phú Thạnh Tân Phú Hồ Chí Minh
0345119839
E90.39
Cod 400k`;

const result = globalThis.OrderProcessor.parse(rawText);

assert.equal(result.name, 'Tài Mai');
assert.equal(result.phone, '0345119839');
assert.equal(result.orderCode, 'E90.39');
assert.equal(result.codAmount, 400000);
assert.equal(result.address, '50/22 đường B khu ADC phường Phú Thạnh Tân Phú Hồ Chí Minh');
assert.equal(
  globalThis.AddressNormalizer.preserveComplete(
    result.address,
    '50/22 Đường B Khu Adc Phường Phú Th'
  ),
  result.address,
  'A shortened normalization must never overwrite the complete raw address'
);

console.log('Tài Mai full-address parser regression test passed.');
