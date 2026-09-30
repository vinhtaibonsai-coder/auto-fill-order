import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateOcrResult } from '../../src/application/ai/ocr-evaluator.js';
import '../../src/application/order-parser/parser.js';

test('Image-to-Order Pipeline: GOOD branch produces full Order JSON matching standard format', () => {
  const ocrText = `Nguyễn Văn An
0912345678
Số 45 Lê Duẩn, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh
Mã đơn: DH-9921
Thu hộ: 350.000đ
Ghi chú: Giao giờ hành chính`;

  const parsed = globalThis.OrderProcessor.parse(ocrText);

  assert.equal(parsed.name, 'Nguyễn Văn An');
  assert.equal(parsed.phone, '0912345678');
  assert.ok(parsed.address.includes('Lê Duẩn'));
  assert.equal(parsed.orderCode, 'DH-9921');
  assert.equal(parsed.codAmount, 350000);
  assert.equal(parsed.extraNote, 'Giao giờ hành chính');
});

test('Image-to-Order Pipeline: Handles COD parsing variations from OCR correctly', () => {
  const textWithMillions = `Chị Hương\n0909123456\n120 Trần Phú, Đà Nẵng\nCOD: 1tr5`;
  const parsedMillion = globalThis.OrderProcessor.parse(textWithMillions);
  assert.equal(parsedMillion.codAmount, 1500000);

  const textWithCk = `Anh Minh\n0933112233\n50 Hai Bà Trưng, Hà Nội\nĐã chuyển khoản`;
  const parsedCk = globalThis.OrderProcessor.parse(textWithCk);
  assert.equal(parsedCk.codAmount, 0);
});
