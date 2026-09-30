import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const bulkServiceCode = fs.readFileSync(path.join(root, 'src/domain/parser/bulk-parser.service.js'), 'utf8');

const sandbox = {};
sandbox.globalThis = sandbox;
vm.runInNewContext(bulkServiceCode, sandbox);
const { splitRawTextToChunks, parseBulkOrders, exportCarrierCsv } = sandbox.BulkParserService;

// 1. Text chunk splitting
const sampleMultiOrder = `
Đơn 1: Chị Mai 0912345678, 123 Lê Lợi Q1 HCM, thu hộ 200k, áo thun
---
Đơn 2: Anh Hùng 0987654321, 456 Hai Bà Trưng Hà Nội, cod: 350.000đ, giày thể thao
`;

const chunks = splitRawTextToChunks(sampleMultiOrder);
assert.equal(chunks.length, 2, 'Should split into 2 chunks');

// 2. Parse bulk orders
const parsed = await parseBulkOrders(sampleMultiOrder);
assert.equal(parsed.length, 2);
assert.equal(parsed[0].phone, '0912345678');
assert.equal(parsed[0].cod, 200000);
assert.equal(parsed[1].phone, '0987654321');
assert.equal(parsed[1].cod, 350000);

// 3. Export CSV with UTF-8 BOM
const vnpostCsv = exportCarrierCsv(parsed, 'vnpost');
assert.ok(vnpostCsv.startsWith('\uFEFF'), 'CSV must start with UTF-8 BOM');
assert.ok(vnpostCsv.includes('0912345678'));
assert.ok(vnpostCsv.includes('Họ tên người nhận'));

const jtCsv = exportCarrierCsv(parsed, 'jt');
assert.ok(jtCsv.startsWith('\uFEFF'), 'J&T CSV must start with UTF-8 BOM');
assert.ok(jtCsv.includes('Tên người nhận'));
assert.ok(jtCsv.includes('Khối lượng (kg)'));

console.log('Bulk parser and carrier CSV export unit tests passed!');
