import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const source = fs.readFileSync(path.join(process.cwd(), 'src/application/order-parser/parser.js'), 'utf8');
const sandbox = { globalThis: null, console };
sandbox.globalThis = sandbox;
vm.runInNewContext(source, sandbox);

const multiline = [
  'a Tâm',
  '0909571159',
  'E160.86',
  'CE213481828VN',
  '0đ',
  'VNPost',
  '218/14 Bưng Ông Thoàn, P Phú Hữu, COD 2.000đ'
].join('\n');

const parsed = sandbox.OrderProcessor.parse(multiline);
assert.equal(parsed.phone, '0909571159');
assert.equal(parsed.orderCode, 'E160.86');
assert.equal(parsed.codAmount, 0, 'Standalone 0đ must win over trailing address COD notes');
assert.doesNotMatch(parsed.address.toLowerCase(), /cod/, 'Trailing COD note must not remain in address');

const oneLine = 'a Tâm 0909571159 E160.86 CE213481828VN 0đ VNPost 218/14 Bưng Ông Thoàn, P Phú Hữu, COD 2.000đ';
assert.equal(sandbox.OrderProcessor.parse(oneLine).codAmount, 0, 'One-line imports must also preserve explicit zero COD');

const normalCod = sandbox.OrderProcessor.parse([
  'Nguyễn Văn A',
  '0901234567',
  'COD 300k',
  '12 Nguyễn Trãi, Q1, HCM'
].join('\n'));
assert.equal(normalCod.codAmount, 300000, 'Normal labeled COD still parses');

// ─── KIỂM THỬ BÓC TÁCH COD DẠNG TRIỆU LẺ (4tr1, 1tr8, 4tr150, 4.5tr, 4 triệu 1) ───
const testCases = [
  { text: 'cod 4tr1', expected: 4100000 },
  { text: 'cod 4tr100', expected: 4100000 },
  { text: 'cod 4tr100k', expected: 4100000 },
  { text: 'cod 4tr150', expected: 4150000 },
  { text: 'cod 4tr150k', expected: 4150000 },
  { text: 'cod 4tr5', expected: 4500000 },
  { text: 'cod 4tr500k', expected: 4500000 },
  { text: 'cod 4.5tr', expected: 4500000 },
  { text: 'cod 4tr', expected: 4000000 },
  { text: 'cod 4 triệu 1', expected: 4100000 },
  { text: 'cod 4 triệu 100k', expected: 4100000 },
  { text: 'cod 4 triệu', expected: 4000000 },
  { text: 'thu hộ 4tr1', expected: 4100000 },
  { text: 'tiền cod: 4tr1', expected: 4100000 },
  { text: 'tiền thu 4tr1', expected: 4100000 },
  { text: 'tiền thu hộ: 4tr1', expected: 4100000 }
];

for (const tc of testCases) {
  const lineParsed = sandbox.OrderProcessor.extractCODFromLine(tc.text);
  assert.equal(lineParsed.found, true, `Must find COD in: ${tc.text}`);
  assert.equal(lineParsed.amount, tc.expected, `Amount for "${tc.text}" must be ${tc.expected}, got ${lineParsed.amount}`);
}

// Kiểm thử đơn hàng thực tế của khách hàng (Lê Đức - cod 4tr1)
const userOrder = sandbox.OrderProcessor.parse([
  '39 phan bội châu phường Ba Đồn Quảng Trị',
  '0917947575',
  'Lê Đức ( acc kim sa tùng )',
  'lũa cover',
  'cod 4tr1'
].join('\n'));

assert.equal(userOrder.phone, '0917947575');
assert.equal(userOrder.name, 'Lê Đức');
assert.equal(userOrder.codAmount, 4100000, 'COD for "cod 4tr1" must be 4,100,000đ (4tr1 = 4.100.000đ)');
assert.doesNotMatch(userOrder.address.toLowerCase(), /cod/, 'Address must not contain trailing COD');

console.log('Order parser COD zero and million-decimal regression tests passed.');
