import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const source = fs.readFileSync(path.join(process.cwd(), 'src/application/order-parser/parser.js'), 'utf8');
const sandbox = { globalThis: null, console };
sandbox.globalThis = sandbox;
vm.runInNewContext(source, sandbox);
const OrderProcessor = sandbox.OrderProcessor;

// Case 1: P120.43 must not be appended to address
const raw1 = `Nguyễn Tiến Thanh 
Sdt 0916144938
Sn 14 tổ dân phố tân lập 12 phường tích lương tỉnh thái nguyên
P120.43
Cod 900k`;

const p1 = OrderProcessor.parse(raw1);
assert.equal(p1.name, 'Nguyễn Tiến Thanh');
assert.equal(p1.phone, '0916144938');
assert.equal(p1.orderCode, 'P120.43');
assert.equal(p1.codAmount, 900000);
assert.doesNotMatch(p1.address, /P120\.43/i, 'Order code P120.43 must not be appended to address');
assert.match(p1.address, /tân lập 12 phường tích lương/i);

// Case 2: lại văn vũ ( acc kim sa tùng ) -> name: "lại văn vũ", extraNote: "acc kim sa tùng"
const raw2 = `0964659922
số 5 ngõ 122 vĩnh tuy hai bà trưng hà nội
lại văn vũ ( acc kim sa tùng ) 
e90.189
cod 200k`;

const p2 = OrderProcessor.parse(raw2);
assert.equal(p2.name, 'lại văn vũ');
assert.equal(p2.phone, '0964659922');
assert.equal(p2.orderCode, 'e90.189');
assert.equal(p2.codAmount, 200000);
assert.equal(p2.extraNote, 'acc kim sa tùng');
assert.match(p2.address, /122 vĩnh tuy/i);

// Case 3: Đc : 84 Nguyễn Văn Giáp -> address found, name is vu quang anh
const raw3 = `Đc : 84 Nguyễn Văn Giáp - Từ Liêm - HN
Sđt : 090.474.6616
vu quang anh ( acc diem huong ) 
e80.48
cod 200k`;

const p3 = OrderProcessor.parse(raw3);
assert.equal(p3.name, 'vu quang anh');
assert.equal(p3.phone, '0904746616');
assert.equal(p3.orderCode, 'e80.48');
assert.equal(p3.codAmount, 200000);
assert.equal(p3.extraNote, 'acc diem huong');
assert.match(p3.address, /84 Nguyễn Văn Giáp/i);
assert.notEqual(p3.name, 'Đc');
assert.notEqual(p3.address, 'không tìm thấy');

// Case 4: Cod : 0 đồng -> name is Minh Huy, address is Huỳnh Tịnh Của, cod is 0
const raw4 = `27/7A huỳnh tịnh của ,quận 3 tp hcm

Minh Huy
0948841460
E100.74

Cod : 0 đồng`;

const p4 = OrderProcessor.parse(raw4);
assert.equal(p4.name, 'Minh Huy');
assert.equal(p4.phone, '0948841460');
assert.equal(p4.orderCode, 'E100.74');
assert.equal(p4.codAmount, 0);
assert.equal(p4.codExplicitZero, true);
assert.notEqual(p4.name, 'Cod');
assert.match(p4.address, /huỳnh tịnh của/i);

// Bulk splitting test: All 4 orders pasted together
const bpSource = fs.readFileSync(path.join(process.cwd(), 'src/domain/parser/bulk-parser.service.js'), 'utf8');
vm.runInNewContext(bpSource, sandbox);
const { splitRawTextToChunks } = sandbox.BulkParserService;

const rawAll = [raw1, raw2, raw3, raw4].join('\n\n');
const chunks = splitRawTextToChunks(rawAll);
assert.equal(chunks.length, 4, 'Must split exactly into 4 chunks');

console.log('User order parser cases unit tests passed!');
