import assert from 'node:assert/strict';

import '../../src/application/order-parser/parser.js';

const rawText = `9/9A2 Lê Trực, phường Gia Định, Quận Bình Thạnh, TP.HCM.
0399016443
trương lâm nhựt (acc diem huong )
e60.218
cod 100k`;

const result = globalThis.OrderProcessor.parse(rawText);

assert.equal(result.address, '9/9A2 Lê Trực, phường Gia Định, Quận Bình Thạnh, TP.HCM');
assert.equal(result.phone, '0399016443');
assert.equal(result.name, 'trương lâm nhựt');
assert.equal(result.orderCode, 'e60.218');
assert.equal(result.codAmount, 100000);

console.log('Lê Trực address-first parser regression test passed.');
