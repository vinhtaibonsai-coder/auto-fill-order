import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const parserCode = fs.readFileSync(path.join(root, 'src/application/order-parser/parser.js'), 'utf8');
const validatorCode = fs.readFileSync(path.join(root, 'src/domain/order/order.validator.js'), 'utf8');

const sandbox = { console };
sandbox.globalThis = sandbox;

// Execute parser first so OrderProcessor is available in sandbox
vm.runInNewContext(parserCode, sandbox);
// Execute validator in same context
vm.runInNewContext(validatorCode, sandbox);

const { readVietnameseCurrency, extractRawCODDetails, auditCOD } = sandbox.OrderValidator;
const OrderProcessor = sandbox.OrderProcessor;

console.log('--- 1. Testing readVietnameseCurrency ---');
assert.equal(readVietnameseCurrency(0), 'Không đồng');
assert.equal(readVietnameseCurrency('0'), 'Không đồng');
assert.equal(readVietnameseCurrency(50000), 'Năm mươi nghìn đồng');
assert.equal(readVietnameseCurrency(350000), 'Ba trăm năm mươi nghìn đồng');
assert.equal(readVietnameseCurrency(4100000), 'Bốn triệu một trăm nghìn đồng');
assert.equal(readVietnameseCurrency(4150000), 'Bốn triệu một trăm năm mươi nghìn đồng');
assert.equal(readVietnameseCurrency(15850000), 'Mười lăm triệu tám trăm năm mươi nghìn đồng');
console.log('✅ readVietnameseCurrency passed all tests.');

console.log('--- 2. Testing extractRawCODDetails ---');
// Standalone 0đ / explicit zero
assert.equal(extractRawCODDetails('0đ').explicitZero, true);
assert.equal(extractRawCODDetails('Khách đã ck 500k').explicitZero, true);
assert.equal(extractRawCODDetails('đơn đổi trả miễn thu').explicitZero, true);

// Standard COD forms
const raw1 = extractRawCODDetails('cod 4tr1');
assert.equal(raw1.found, true);
assert.equal(raw1.amount, 4100000);

const raw2 = extractRawCODDetails('thu hộ 350k');
assert.equal(raw2.found, true);
assert.equal(raw2.amount, 350000);

// Text with no COD
const rawNone = extractRawCODDetails('Nguyễn Văn A 0912345678 Số 10 Tràng Thi Hà Nội');
assert.equal(rawNone.found, false);
assert.equal(rawNone.amount, 0);
assert.equal(rawNone.explicitZero, false);
console.log('✅ extractRawCODDetails passed all tests.');

console.log('--- 3. Testing auditCOD: 5 Business Cases ---');

// TRƯỜNG HỢP 1: Form có COD và khớp đơn thô
const case1 = auditCOD({ codAmount: 4100000 }, 'cod 4tr1');
assert.equal(case1.status, 'VALID_MATCH');
assert.equal(case1.level, 'success');
assert.equal(case1.canProceed, true);
assert.equal(case1.codForm, 4100000);
assert.equal(case1.codRaw, 4100000);

// TRƯỜNG HỢP 1b: Lên đơn bằng tay có COD, không có đơn thô
const case1b = auditCOD({ codAmount: 300000 }, '');
assert.equal(case1b.status, 'VALID_MATCH');
assert.equal(case1b.level, 'success');
assert.equal(case1b.canProceed, true);

// TRƯỜNG HỢP 2: Lệch tiền COD giữa form và đơn thô
const case2 = auditCOD({ codAmount: 300000 }, 'cod 500k');
assert.equal(case2.status, 'MISMATCH');
assert.equal(case2.level, 'warning');
assert.equal(case2.canProceed, true);
assert.equal(case2.suggestedCod, 500000);

// TRƯỜNG HỢP 3: Cực kỳ nguy hiểm: Đơn thô có ghi COD nhưng Form lại là 0đ hoặc bỏ trống!
const case3a = auditCOD({ codAmount: 0 }, 'cod 4tr1');
assert.equal(case3a.status, 'CRITICAL_MISSING_COD');
assert.equal(case3a.level, 'danger');
assert.equal(case3a.canProceed, false);
assert.equal(case3a.suggestedCod, 4100000);

const case3b = auditCOD({ codAmount: '' }, 'tiền thu hộ: 350k');
assert.equal(case3b.status, 'CRITICAL_MISSING_COD');
assert.equal(case3b.level, 'danger');
assert.equal(case3b.canProceed, false);
assert.equal(case3b.suggestedCod, 350000);

// TRƯỜNG HỢP 4: Cả 2 đều không có COD (hoặc lên đơn tay không nhập COD)
const case4a = auditCOD({ codAmount: 0 }, 'Nguyễn Văn A 0912345678 Số 10 Tràng Thi Hà Nội');
assert.equal(case4a.status, 'NO_COD_WARNING');
assert.equal(case4a.level, 'warning');
assert.equal(case4a.canProceed, false);

const case4b = auditCOD({ codAmount: 0 }, ''); // Lên đơn bằng tay quên nhập COD
assert.equal(case4b.status, 'NO_COD_WARNING');
assert.equal(case4b.level, 'warning');
assert.equal(case4b.canProceed, false);

// TRƯỜNG HỢP 5: 0đ rõ ràng có xác nhận (explicit 0đ)
const case5a = auditCOD({ codAmount: 0 }, 'a Tâm 0909571159 0đ VNPost 218/14 Bưng Ông Thoàn');
assert.equal(case5a.status, 'EXPLICIT_ZERO');
assert.equal(case5a.level, 'info');
assert.equal(case5a.canProceed, true);

const case5b = auditCOD({ codAmount: 0 }, 'Khách đã chuyển khoản');
assert.equal(case5b.status, 'EXPLICIT_ZERO');
assert.equal(case5b.canProceed, true);

const case5c = auditCOD({ codAmount: 0 }, '', { userConfirmedZero: true });
assert.equal(case5c.status, 'EXPLICIT_ZERO');
assert.equal(case5c.canProceed, true);

// BẤT BIẾN KẾ TOÁN: Không có trường hợp nào tự động để 0đ nếu không có explicitZero
const silentZeroCheck = auditCOD({ codAmount: 0 }, 'Giao hàng nhanh trong ngày');
assert.notEqual(silentZeroCheck.status, 'EXPLICIT_ZERO');
assert.equal(silentZeroCheck.canProceed, false, 'Silent 0đ must NEVER be allowed to proceed without explicit confirmation!');

console.log('✅ auditCOD passed all 5 business cases and invariants.');

console.log('--- 4. Testing OrderProcessor.parse return properties ---');
const parsed = OrderProcessor.parse('a Tâm 0909571159 E160.86 0đ VNPost 218/14 Bưng Ông Thoàn');
assert.equal(parsed.codExplicitZero, true);
assert.equal(parsed.codFound, true);
assert.equal(parsed.codAmount, 0);
assert.equal(typeof parsed.rawText, 'string');

console.log('--- 5. Testing Global Submit Interceptor Simulation for Manual Entry ---');
// Giả lập nhân viên "lên đơn bằng tay" trực tiếp trên trang bưu cục
const manualOrderNoCOD = {
  name: 'Trần Văn Nam',
  phone: '0903123456',
  address: '123 Hai Bà Trưng, P. Bến Nghé, Q.1, TP.HCM',
  codAmount: 0
};
// Không có đơn thô (nhân viên gõ tay trực tiếp)
const auditManual1 = auditCOD(manualOrderNoCOD, '');
assert.equal(auditManual1.status, 'NO_COD_WARNING');
assert.equal(auditManual1.canProceed, false, 'Manual order without COD must be blocked for review');
assert.match(auditManual1.message, /chưa có tiền cod/i);

// Nhân viên nhập bổ sung COD = 450.000đ
manualOrderNoCOD.codAmount = 450000;
const auditManual2 = auditCOD(manualOrderNoCOD, '');
assert.equal(auditManual2.status, 'VALID_MATCH');
assert.equal(auditManual2.canProceed, true);
assert.equal(auditManual2.spelledOutWords, 'Bốn trăm năm mươi nghìn đồng');

// Nhân viên xác nhận đơn 0đ (khách đã chuyển khoản trước)
const manualPrepaid = {
  name: 'Phạm Thị Lan',
  phone: '0988776655',
  address: 'Số 5 Liễu Giai, Ba Đình, Hà Nội',
  codAmount: 0
};
const auditPrepaid = auditCOD(manualPrepaid, '', { userConfirmedZero: true });
assert.equal(auditPrepaid.status, 'EXPLICIT_ZERO');
assert.equal(auditPrepaid.canProceed, true);
assert.equal(auditPrepaid.spelledOutWords, 'Không đồng');

// --- 6. Testing Weight and Note Comparison Logic ---
const panelJs = fs.readFileSync(path.join(process.cwd(), 'frontend/panel/panel.js'), 'utf8');
assert.ok(panelJs.includes('isWeightMatch'), 'panel.js must compute isWeightMatch');
assert.ok(panelJs.includes('isNoteMatch'), 'panel.js must compute isNoteMatch');
assert.doesNotMatch(panelJs, /renderCompareRow\('⚖️ Khối lượng'[^,]+,[^,]+,\s*true\)/,
  'Weight comparison must NOT be hardcoded to true');

console.log('🎉 ALL COD & FIELD REVIEW TESTS (PARSER, AUDIT, WEIGHT & NOTE MATCH) PASSED SUCCESSFULLY!');

