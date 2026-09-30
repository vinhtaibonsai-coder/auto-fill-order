import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateLabelModel,
  renderHtmlLabel,
  renderBulkHtmlDocument,
  getPrintCss
} from '../../src/application/printing/label-renderer.js';

test('A02: Label Renderer - 1. Generates correct model with required shipping fields', () => {
  const order = {
    order_id: 'ord_123',
    order_code: 'DH-HN-001',
    tracking_code: 'VNPOST-TRACK-999',
    customerName: 'Nguyễn Văn Long',
    phone: '0987654321',
    address: 'Số 10 Ngõ 45 Đường Hoàng Hoa Thám, Phường Liễu Giai, Quận Ba Đình, Hà Nội',
    cod: 350000,
    items: [{ name: 'Cây thủy sinh Rotala Super Red', quantity: 3 }],
    senderShopName: 'Vĩnh Tài Bonsai & Thủy Sinh',
    senderPhone: '0901234567'
  };

  const template = {
    paper_size: 'A6',
    orientation: 'portrait'
  };

  const model = generateLabelModel(order, template, { hasFullPiiAccess: true });

  assert.equal(model.tracking_code, 'VNPOST-TRACK-999');
  assert.equal(model.recipient_name, 'Nguyễn Văn Long');
  assert.equal(model.recipient_phone, '0987654321');
  assert.equal(model.formatted_cod, '350.000 đ');
  assert.equal(model.paper_size, 'A6');
});

test('A02: Label Renderer - 2. Masks recipient PII when role lacks customers.view_pii', () => {
  const order = {
    order_code: 'DH-002',
    tracking_code: 'JT888999',
    customerName: 'Trần Thị Mai',
    phone: '0912345678',
    address: 'Căn hộ 702 Tòa nhà Landmark, 208 Nguyễn Hữu Cảnh, Phường 22, Quận Bình Thạnh, TP Hồ Chí Minh'
  };

  const model = generateLabelModel(order, { paper_size: 'A6' }, { hasFullPiiAccess: false });
  assert.equal(model.recipient_phone, '091***5678');
  assert.match(model.recipient_address, /^\*\*\*/);
});

test('A02: Label Renderer - 3. HTML Render contains @page mm styles and prevents overflow on long text', () => {
  const cssA6 = getPrintCss('A6', 'portrait');
  assert.ok(cssA6.includes('@page'), 'Must include @page CSS directive');
  assert.ok(cssA6.includes('105mm') && cssA6.includes('148mm'), 'A6 must have 105mm x 148mm dimensions');

  const cssA5 = getPrintCss('A5', 'portrait');
  assert.ok(cssA5.includes('148mm') && cssA5.includes('210mm'), 'A5 must have 148mm x 210mm dimensions');

  const longOrder = {
    order_code: 'DH-LONG-ADDRESS',
    tracking_code: 'VNPOST-LONG',
    customerName: 'Vương Phi Triều Đình Thần Kiếm Nhất Chi Mai',
    address: 'Tổ dân phố 14, Thôn Đông Đoài Lĩnh Nam Bắc Cầu, Xã Hợp Tiến, Huyện Triệu Sơn, Tỉnh Thanh Hóa (Đi vào ngõ sâu gần cây gạo rẽ phải qua cầu khỉ)',
    phone: '0988888888',
    cod: 1250000
  };

  const html = renderHtmlLabel(longOrder, { paper_size: 'A6' });
  assert.ok(html.includes('overflow: hidden') || html.includes('word-break: break-word'), 'Must prevent overflow');
  assert.ok(html.includes('VNPOST-LONG'), 'Must contain tracking code');
});

test('A02: Label Renderer - 4. Bulk HTML Document generates multiple printable pages', () => {
  const orders = [
    { order_code: 'ORD-1', tracking_code: 'TRK-1', customerName: 'Khách 1', phone: '0901' },
    { order_code: 'ORD-2', tracking_code: 'TRK-2', customerName: 'Khách 2', phone: '0902' }
  ];

  const fullDoc = renderBulkHtmlDocument(orders, { paper_size: 'A6' });
  assert.ok(fullDoc.includes('<!DOCTYPE html>'), 'Must be a valid standalone HTML document');
  assert.ok(fullDoc.includes('page-break-after: always'), 'Must have page break between labels');
  assert.ok(fullDoc.includes('TRK-1') && fullDoc.includes('TRK-2'), 'Must include both orders');
});
