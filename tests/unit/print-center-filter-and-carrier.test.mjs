import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  generateLabelModel,
  renderHtmlLabel,
  renderBulkHtmlDocument,
  extractCodAmount,
  extractOrderCode,
  extractTrackingCode,
  detectCarrier,
  getCarrierAccount,
  isRecipientPayingFee,
  PAPER_DIMENSIONS,
  normalizeMarginCss,
  getPrintCss
} from '../../src/application/printing/label-renderer.js';

test('PrintCenter & LabelRenderer - 1. COD extraction handles all schema variations without returning fake 0 or losing values', () => {
  // Test case 1: Standard codAmount as integer
  assert.equal(extractCodAmount({ codAmount: 250000 }), 250000);

  // Test case 2: cod_amount as snake_case
  assert.equal(extractCodAmount({ cod_amount: 320000 }), 320000);

  // Test case 3: String with currency symbol and dots
  assert.equal(extractCodAmount({ codAmount: '450.000 đ' }), 450000);

  // Test case 4: tien_thu_ho fallback
  assert.equal(extractCodAmount({ tien_thu_ho: 180000 }), 180000);

  // Test case 5: cod field
  assert.equal(extractCodAmount({ cod: 99000 }), 99000);

  // Test case 6: Empty order or 0
  assert.equal(extractCodAmount(null), 0);
  assert.equal(extractCodAmount({}), 0);
});

test('PrintCenter & LabelRenderer - 2. Order Code and Tracking Code extraction does not cross-contaminate or invent fake IDs', () => {
  const order1 = {
    order_code: 'DH-HN-2026-001',
    tracking_code: 'VNPOST888999'
  };
  assert.equal(extractOrderCode(order1), 'DH-HN-2026-001');
  assert.equal(extractTrackingCode(order1), 'VNPOST888999');

  // When order has no tracking yet, order code is preserved and tracking is empty (not fake)
  const order2 = {
    orderCode: 'DH-SG-999',
    trackingCode: '-'
  };
  assert.equal(extractOrderCode(order2), 'DH-SG-999');
  assert.equal(extractTrackingCode(order2), '');

  // Sub_ prefixes from internal local sync are ignored in favor of real order codes
  const order3 = {
    savedOrderId: 'sub_1720000000_abc',
    order_code: 'DH-REAL-777'
  };
  assert.equal(extractOrderCode(order3), 'DH-REAL-777');
});

test('PrintCenter & LabelRenderer - 3. Carrier detection accurately distinguishes VNPost, J&T Express, Viettel Post, and GHTK', () => {
  const jtOrder = { platform: 'jt', carrier: 'J&T' };
  const vnpostOrder = { platform: 'vnpost' };
  const viettelOrder = { platform: 'viettelpost' };
  const ghtkOrder = { platform: 'ghtk' };

  assert.equal(detectCarrier(jtOrder).key, 'jt');
  assert.equal(detectCarrier(jtOrder).name, 'J&T Express');

  assert.equal(detectCarrier(vnpostOrder).key, 'vnpost');
  assert.equal(detectCarrier(vnpostOrder).name, 'VNPost');

  assert.equal(detectCarrier(viettelOrder).key, 'viettelpost');
  assert.equal(detectCarrier(viettelOrder).name, 'Viettel Post');

  assert.equal(detectCarrier(ghtkOrder).key, 'ghtk');
  assert.equal(detectCarrier(ghtkOrder).name, 'GHTK');
});

test('PrintCenter & LabelRenderer - 4. Label Renderer outputs carrier-specific branding, slogans, and accurate COD', () => {
  const jtOrder = {
    order_code: 'DH-JT-01',
    tracking_code: '840012345678',
    customerName: 'Nguyễn Văn Minh',
    phone: '0912345678',
    address: '123 Lê Lợi, Phường Bến Nghé, Quận 1, TP Hồ Chí Minh',
    platform: 'jt',
    codAmount: 520000
  };

  const jtHtml = renderHtmlLabel(jtOrder, { paper_size: 'A6' });
  assert.ok(jtHtml.includes('J&amp;T') || jtHtml.includes('J&T'), 'Must render J&T branding');
  assert.ok(jtHtml.includes('J&T Express - Express Your Online Business') || jtHtml.includes('1900 1088'), 'Must include J&T slogan');
  assert.ok(jtHtml.includes('520.000 đ'), 'Must render accurate COD amount');
  assert.ok(jtHtml.includes('DH-JT-01'), 'Must include clean order code');

  const vnpostOrder = {
    order_code: 'DH-VNPOST-02',
    tracking_code: 'CP123456789VN',
    customerName: 'Trần Thị Hà',
    phone: '0988776655',
    address: '45 Đinh Tiên Hoàng, Phường Tràng Tiền, Quận Hoàn Kiếm, Hà Nội',
    platform: 'vnpost',
    codAmount: 300000
  };

  const vnpostHtml = renderHtmlLabel(vnpostOrder, { paper_size: 'A6' });
  assert.ok(vnpostHtml.includes('VIETNAM POST'), 'Must render VNPost branding');
  assert.ok(vnpostHtml.includes('1900') || vnpostHtml.includes('545481'), 'Must include VNPost helpline/slogan');
  assert.ok(vnpostHtml.includes('300.000 đ'), 'Must render accurate VNPost COD');
});

test('PrintCenter & LabelRenderer - 5. PrintCenter.jsx contains full filter bar matching SubmittedOrders and user specification', () => {
  const content = readFileSync(resolve('src/ui/options/pages/Printing/PrintCenter.jsx'), 'utf8');

  // Search input with exact multi-keyword prompt
  assert.ok(content.includes('Tìm theo Tên khách, SĐT (đầy đủ hoặc 4 số cuối), Mã đơn, Vận đơn, Tài khoản bưu điện...'));

  // Date Preset tabs
  assert.ok(content.includes("'today'"));
  assert.ok(content.includes("'yesterday'"));
  assert.ok(content.includes("'7days'"));
  assert.ok(content.includes("'thisMonth'"));
  assert.ok(content.includes("'lastMonth'"));
  assert.ok(content.includes("'custom'"));

  // Secondary dropdown filters
  assert.ok(content.includes('carrierFilter'));
  assert.ok(content.includes('feeFilter'));
  assert.ok(content.includes('trackingFilter'));
  assert.ok(content.includes('deliveryFilter'));

  // Carrier differentiation column in table
  assert.ok(content.includes('HÃNG &amp; CƯỚC'));
  assert.ok(content.includes('detectCarrier'));
  assert.ok(content.includes('isRecipientPayingFee'));
  assert.ok(content.includes('extractCodAmount'));
});

test('PrintCenter & LabelRenderer - 6. Sender name prioritizes VNPost account name as requested by user', () => {
  // Case A: Order has carrierAccount detected from VNPost
  const orderWithVnpostAcc = {
    order_code: 'DH-VNP-001',
    carrierAccount: 'TÀI BONSAI VNPOST ĐÀ NẴNG',
    senderShopName: 'VĨNH TÀI BONSAI',
    phone: '0901234567',
    customerName: 'Anh Vũ',
    address: '100 Lê Duẩn, Đà Nẵng'
  };
  const modelA = generateLabelModel(orderWithVnpostAcc);
  assert.equal(modelA.sender_name, 'TÀI BONSAI VNPOST ĐÀ NẴNG', 'Sender name must use the VNPost account name');

  const htmlA = renderHtmlLabel(orderWithVnpostAcc);
  assert.ok(htmlA.includes('TÀI BONSAI VNPOST ĐÀ NẴNG'), 'Rendered label HTML must contain the VNPost account name');

  // Case B: Options pass defaultCarrierAccount from active session / storage
  const orderNoAcc = {
    order_code: 'DH-VNP-002',
    phone: '0901234567',
    customerName: 'Chị Mai',
    address: '50 Nguyễn Huệ, TP HCM'
  };
  const modelB = generateLabelModel(orderNoAcc, {}, { defaultCarrierAccount: 'SHOP HOA VĨNH TÀI' });
  assert.equal(modelB.sender_name, 'SHOP HOA VĨNH TÀI', 'Sender name must use the session carrier account from options');

  // Case C: Fallback to senderShopName if no carrierAccount exists
  const orderFallback = {
    order_code: 'DH-VNP-003',
    senderShopName: 'CỬA HÀNG VĨNH TÀI',
    phone: '0901234567',
    customerName: 'Anh Bình',
    address: '10 Hai Bà Trưng, Hà Nội'
  };
  const modelC = generateLabelModel(orderFallback);
  assert.equal(modelC.sender_name, 'CỬA HÀNG VĨNH TÀI', 'Sender name must fall back to shop name when no carrier account');

  // Case D: Order created by VNPost account "NGUYỄN THANH NHỰT" MUST NOT be overridden by shop options.senderName
  const orderNhut = {
    order_code: 'DH-VNP-NHUT-01',
    carrierAccount: 'NGUYỄN THANH NHỰT',
    phone: '0901234567',
    customerName: 'Khách hàng A',
    address: 'Đà Nẵng'
  };
  const modelNhut = generateLabelModel(orderNhut, {}, {
    senderName: 'VĨNH TÀI BONSAI',
    carrierAccounts: {
      'NGUYỄN THANH NHỰT': {
        name: 'NGUYỄN THANH NHỰT',
        phone: '0988776655',
        address: 'BÌNH NINH, Điện Bàn Đông, Quảng Nam'
      }
    }
  });
  assert.equal(modelNhut.sender_name, 'NGUYỄN THANH NHỰT', 'Label sender_name must be NGUYỄN THANH NHỰT from order carrier account');
  assert.equal(modelNhut.sender_phone, '0988776655', 'Label sender_phone must match NGUYỄN THANH NHỰT account phone from registry');
  assert.equal(modelNhut.sender_address, 'BÌNH NINH, Điện Bàn Đông, Quảng Nam', 'Label sender_address must match NGUYỄN THANH NHỰT account address');

  const htmlNhut = renderHtmlLabel(orderNhut, {}, {
    senderName: 'VĨNH TÀI BONSAI',
    carrierAccounts: {
      'NGUYỄN THANH NHỰT': {
        name: 'NGUYỄN THANH NHỰT',
        phone: '0988776655',
        address: 'BÌNH NINH, Điện Bàn Đông, Quảng Nam'
      }
    }
  });
  assert.ok(htmlNhut.includes('NGUYỄN THANH NHỰT'), 'Rendered label HTML must contain NGUYỄN THANH NHỰT');
  assert.ok(htmlNhut.includes('0988776655'), 'Rendered label HTML must contain phone from NGUYỄN THANH NHỰT account');
});

test('PrintCenter & LabelRenderer - 7. Product items & content summary extract productNote/productItem and print the order code', () => {
  // Case A: Order with productItem and order_code
  const orderWithProductItem = {
    order_code: 'DH-KIM-TIEN-88',
    productItem: 'Cây kim tiền để bàn phong thủy',
    customerName: 'Lê Hoàng Nam',
    phone: '0933445566',
    address: '15 Trần Phú, Hải Châu, Đà Nẵng'
  };
  const htmlA = renderHtmlLabel(orderWithProductItem);
  assert.ok(htmlA.includes('Cây kim tiền để bàn phong thủy'), 'Label must display the real product item');
  assert.ok(htmlA.includes('DH-KIM-TIEN-88'), 'Product item line must clearly include the order code');
  assert.ok(htmlA.includes('(Mã: DH-KIM-TIEN-88)'), 'Must contain formatted order code tag');

  // Case B: Order with productNote
  const orderWithProductNote = {
    order_code: 'DH-TUNG-99',
    productNote: 'Tùng la hán mini bonsai',
    customerName: 'Võ Minh Trí',
    phone: '0977889900',
    address: '88 Cầu Giấy, Hà Nội'
  };
  const htmlB = renderHtmlLabel(orderWithProductNote);
  assert.ok(htmlB.includes('Tùng la hán mini bonsai'), 'Label must display the real product note');
  assert.ok(htmlB.includes('DH-TUNG-99'), 'Must include order code on the label');

  // Case C: Order with no product text specified (fallback) but has order_code
  const orderNoProductText = {
    order_code: 'DH-EMPTY-PROD-01',
    customerName: 'Phạm Thanh',
    phone: '0911223344',
    address: '22 Pasteur, Quận 3, TP HCM'
  };
  const htmlC = renderHtmlLabel(orderNoProductText);
  assert.ok(htmlC.includes('DH-EMPTY-PROD-01'), 'Must include order code even for generic goods');
});

test('PrintCenter & LabelRenderer - 8. Barcode generation cleanly falls back to order_code when tracking_code is missing or "-"', () => {
  const orderWithoutTracking = {
    order_code: 'DH-SCAN-ME-123',
    tracking_code: '-',
    customerName: 'Đỗ Quốc Tuấn',
    phone: '0944556677',
    address: '12 Quang Trung, TP Đà Nẵng'
  };

  const model = generateLabelModel(orderWithoutTracking);
  assert.equal(model.order_code, 'DH-SCAN-ME-123');
  assert.equal(model.barcode_value, 'DH-SCAN-ME-123', 'Barcode value must encode order_code when tracking is "-"');

  const html = renderHtmlLabel(orderWithoutTracking);
  assert.ok(html.includes('DH-SCAN-ME-123'), 'Label text must display order code under the barcode');
  assert.ok(!html.includes('vnpost-tracking-code">-<'), 'Barcode text must NOT be a bare "-"');
});

test('PrintCenter & LabelRenderer - 9. Bulk PDF Document creates exact VNPost PDF layout and screen toolbar matching media_1790320541842', () => {
  const sampleOrders = [
    {
      order_code: 'CF374463701VN',
      tracking_code: 'CF374463701VN',
      carrierAccount: 'ĐÀO DUY PHƯỚC',
      customerName: 'Ngô Duy Đông',
      phone: '0979998888',
      address: '28 Ngõ 65, Phường Phúc Xá, Quận Ba Đình, Thành phố Hà Nội',
      productItem: 'Cây cover',
      weight: 2000,
      codAmount: 0,
      platform: 'vnpost'
    }
  ];

  const fullDoc = renderBulkHtmlDocument(sampleOrders, { paper_size: 'A6' });

  // 1. Exact VNPost Header & Meta columns
  assert.ok(fullDoc.includes('Lô:'), 'Must contain exact Lô label');
  assert.ok(fullDoc.includes('Thứ tự:'), 'Must contain exact Thứ tự label');
  assert.ok(fullDoc.includes('Số ĐH: CF374463701VN'), 'Must contain exact Số ĐH label and code');
  assert.ok(fullDoc.includes('ĐÀO DUY PHƯỚC'), 'Must display sender VNPost account name');

  // 2. Exact Routing and Items
  assert.ok(fullDoc.includes('111662 - BCP'), 'Must contain BCP sorting routing');
  assert.ok(fullDoc.includes('Chỉ dẫn giao hàng'), 'Must contain delivery instructions');
  assert.ok(fullDoc.includes('Cây cover'), 'Must contain goods product name');
  assert.ok(fullDoc.includes('Chữ kí người nhận'), 'Must contain signature box');
  assert.ok(fullDoc.includes('vnpost-qr-svg'), 'Must contain clean QR code');

  // 3. Screen toolbar & auto-print script for PDF generation parity
  assert.ok(fullDoc.includes('screen-toolbar'), 'Must include interactive screen toolbar');
  assert.ok(fullDoc.includes('In ngay / Lưu PDF'), 'Must have 1-click print / PDF button');
  assert.ok(fullDoc.includes('window.print()'), 'Must contain print trigger script');
  assert.ok(fullDoc.includes('@media screen') && fullDoc.includes('@media print'), 'Must have responsive screen and print styles');
});

test('PrintCenter & LabelRenderer - 10. Sender Phone must strictly match real sender phone and not fallback to hardcoded phone', () => {
  // Case A: Sender name NGUYỄN THANH NHỰT with his own real sender phone passed in options
  const orderNhut = {
    order_code: 'DH-VNP-NHUT-01',
    carrierAccount: 'NGUYỄN THANH NHỰT',
    customerName: 'Khách hàng A',
    phone: '0909123456',
    address: 'Hà Nội'
  };

  const modelA = generateLabelModel(orderNhut, {}, {
    senderPhone: '0987654321',
    senderAddress: 'BÌNH NINH, P. Điện Bàn Đông, TP. Đà Nẵng'
  });

  assert.equal(modelA.sender_name, 'NGUYỄN THANH NHỰT');
  assert.equal(modelA.sender_phone, '0987654321', 'Must strictly use sender real phone number');
  assert.notEqual(modelA.sender_phone, '0346552224', 'Must NOT default to old hardcoded phone');

  const htmlA = renderHtmlLabel(orderNhut, {}, { senderPhone: '0987654321' });
  assert.ok(htmlA.includes('NGUYỄN THANH NHỰT'), 'HTML must contain sender name');
  assert.ok(htmlA.includes('0987654321'), 'HTML must contain real sender phone');
  assert.ok(!htmlA.includes('0346552224'), 'HTML must NOT contain old fake phone number');

  // Case B: Order itself specifies sender_phone
  const orderWithEmbeddedSender = {
    order_code: 'DH-VNP-SHOP-02',
    sender_name: 'NGUYỄN THANH NHỰT',
    sender_phone: '0912334455',
    customerName: 'Khách B',
    phone: '0909999999',
    address: 'Đà Nẵng'
  };
  const modelB = generateLabelModel(orderWithEmbeddedSender);
  assert.equal(modelB.sender_phone, '0912334455', 'Must use order sender_phone directly');
});

test('PrintCenter & LabelRenderer - 11. Print margins respect "cách lề 2cm" (20mm) and support A4, A5, A6', () => {
  const sampleOrders = [
    {
      order_code: 'DH-MARGIN-TEST',
      carrierAccount: 'NGUYỄN THANH NHỰT',
      customerName: 'Khách Test',
      phone: '0911222333',
      address: 'Đà Nẵng'
    }
  ];

  // Default margin is 2cm (20mm)
  const doc2cm = renderBulkHtmlDocument(sampleOrders, { paper_size: 'A4', margin: '2cm' });
  assert.ok(doc2cm.includes('padding: 20mm;'), 'Must apply 20mm (2cm) padding on page');
  assert.ok(doc2cm.includes('Cách lề 2cm'), 'Toolbar must reflect 2cm margin setting');
  assert.ok(doc2cm.includes('size: 210mm 297mm;'), 'Must support standard A4 size');

  // Also support custom margin like 1cm
  const doc1cm = renderBulkHtmlDocument(sampleOrders, { paper_size: 'A6', margin: '1cm' });
  assert.ok(doc1cm.includes('padding: 10mm;'), 'Must apply 10mm (1cm) padding on page');
});

test('PrintCenter & LabelRenderer - 12. Template customization allows modifying title, slogan, delivery notes, and toggling elements', () => {
  const sampleOrder = {
    order_code: 'DH-CUSTOM-TPL',
    tracking_code: 'VNPOST999888',
    customerName: 'Trần Văn Custom',
    phone: '0901234567',
    address: '100 Nguyễn Huệ, Quận 1, TP Hồ Chí Minh'
  };

  // Case 1: Custom service title, custom slogan, and custom instructions
  const customizedHtml = renderHtmlLabel(sampleOrder, {
    service_title: 'ĐỒNG GIÁ VIP - GIAO HÀNG HỎA TỐC 24H',
    instruction_note: 'CHO XEM HÀNG - KHÔNG CHO THỬ - GỌI TRƯỚC KHI GIAO',
    custom_slogan: 'VĨNH TÀI BONSAI - CẢM ƠN QUÝ KHÁCH ĐÃ TIN TƯỞNG',
    paper_size: 'A6'
  });

  assert.ok(customizedHtml.includes('ĐỒNG GIÁ VIP - GIAO HÀNG HỎA TỐC 24H'), 'Must display customized service title');
  assert.ok(customizedHtml.includes('CHO XEM HÀNG - KHÔNG CHO THỬ'), 'Must display customized instruction note');
  assert.ok(customizedHtml.includes('VĨNH TÀI BONSAI - CẢM ƠN QUÝ KHÁCH'), 'Must display customized footer slogan');

  // Case 2: Toggling elements off (hide barcode, QR, signature, slogan, sender)
  const toggledHtml = renderHtmlLabel(sampleOrder, {
    show_barcode: false,
    show_qr: false,
    show_signature_box: false,
    show_slogan: false,
    show_sender: false,
    show_order_meta: false
  });

  assert.ok(!toggledHtml.includes('vnpost-barcode-svg'), 'Must hide barcode when show_barcode is false');
  assert.ok(!toggledHtml.includes('vnpost-qr-svg'), 'Must hide QR code when show_qr is false');
  assert.ok(!toggledHtml.includes('Chữ kí người nhận'), 'Must hide signature box when show_signature_box is false');
  assert.ok(!toggledHtml.includes('vnpost-footer-slogan'), 'Must hide slogan when show_slogan is false');
  assert.ok(!toggledHtml.includes('vnpost-sender-col">'), 'Must hide sender details when show_sender is false');
  assert.ok(!toggledHtml.includes('<div>Lô:</div>'), 'Must hide order meta when show_order_meta is false');
});

test('PrintCenter & LabelRenderer - 13. PrintCenter UI invariants (full width, no preselection, rich columns, template customizer)', () => {
  const printCenterSource = readFileSync(resolve('src/ui/options/pages/Printing/PrintCenter.jsx'), 'utf8');

  // 1. RỘNG RA Invariant: Container must be 100% width or not restricted to 1240px
  assert.ok(!printCenterSource.includes("maxWidth: '1240px'"), 'PrintCenter container must NOT be restricted to 1240px');

  // 2. ĐỪNG TÍCH CHỌN TRƯỚC Invariant: Do not auto-select on load
  assert.ok(!printCenterSource.includes("setSelectedIds(unprinted.map"), 'PrintCenter must NOT auto-select unprinted orders on load');

  // 3. CHO CHỈNH SỬA TRANG IN MẪU Invariant: Must have template customizer trigger & modal
  assert.ok(printCenterSource.includes('Chỉnh sửa trang in mẫu') || printCenterSource.includes('Chỉnh sửa mẫu in'), 'Must have Template Customizer button');
});

test('PrintCenter & LabelRenderer - 14. Flexible margin adjustment and K100 paper size support', () => {
  // 1. K100 / 100x150 mm paper dimensions
  assert.ok(PAPER_DIMENSIONS.K100, 'PAPER_DIMENSIONS must define K100');
  assert.equal(PAPER_DIMENSIONS.K100.width, '100mm');
  assert.equal(PAPER_DIMENSIONS.K100.height, '150mm');

  assert.ok(PAPER_DIMENSIONS['100X150'], 'PAPER_DIMENSIONS must define 100X150');
  assert.equal(PAPER_DIMENSIONS['100X150'].width, '100mm');
  assert.equal(PAPER_DIMENSIONS['100X150'].height, '150mm');

  // 2. Margin normalization: numbers, cm, mm, and split margins
  assert.equal(normalizeMarginCss('2cm'), '20mm', '2cm must normalize to 20mm');
  assert.equal(normalizeMarginCss('20mm'), '20mm', '20mm must normalize to 20mm');
  assert.equal(normalizeMarginCss('1.5cm'), '15mm', '1.5cm must normalize to 15mm');
  assert.equal(normalizeMarginCss('1cm'), '10mm', '1cm must normalize to 10mm');
  assert.equal(normalizeMarginCss('0.5cm'), '5mm', '0.5cm must normalize to 5mm');
  assert.equal(normalizeMarginCss('0'), '0mm', '0 must normalize to 0mm');
  assert.equal(normalizeMarginCss('0mm'), '0mm', '0mm must normalize to 0mm');
  assert.equal(normalizeMarginCss(18), '18mm', 'Raw number 18 must normalize to 18mm');
  assert.equal(normalizeMarginCss('12mm'), '12mm', '12mm must normalize to 12mm');
  assert.equal(normalizeMarginCss('10mm 20mm'), '10mm 20mm', 'Split margin must normalize cleanly');

  // 3. Document output with K100 and custom mm margin
  const sampleOrder = {
    order_code: 'DH-K100-TEST',
    customerName: 'Khách Shopee',
    phone: '0988776655',
    address: 'Hà Nội'
  };
  const doc = renderBulkHtmlDocument([sampleOrder], { paper_size: 'K100', margin: '12mm' });
  assert.ok(doc.includes('size: 100mm 150mm;'), 'K100 document must have 100mm 150mm page size');
  assert.ok(doc.includes('padding: 12mm;'), 'K100 document must have 12mm padding');
});

test('PrintCenter UI - 15. Explicit default paper size and margin controls with unmistakable indicators', () => {
  const printCenterSource = readFileSync(resolve('src/ui/options/pages/Printing/PrintCenter.jsx'), 'utf8');

  // 1. Explicit default states and setters
  assert.ok(printCenterSource.includes('defaultPaperSize'), 'Must maintain defaultPaperSize state');
  assert.ok(printCenterSource.includes('defaultPrintMargin'), 'Must maintain defaultPrintMargin state');
  assert.ok(printCenterSource.includes('handleSetDefaultPaperSize'), 'Must have handleSetDefaultPaperSize handler');
  assert.ok(printCenterSource.includes('handleSetDefaultMargin'), 'Must have handleSetDefaultMargin handler');

  // 2. Storage keys for permanent persistence
  assert.ok(printCenterSource.includes('default_paper_size'), 'Must persist default_paper_size key');
  assert.ok(printCenterSource.includes('default_print_margin'), 'Must persist default_print_margin key');

  // 3. Visual indicators and buttons for defaults
  assert.ok(printCenterSource.includes('⭐ Khổ mặc định') || printCenterSource.includes('Khổ mặc định'), 'Must display default paper size indicator');
  assert.ok(printCenterSource.includes('⭐ Lề mặc định') || printCenterSource.includes('Lề mặc định'), 'Must display default margin indicator');
  assert.ok(printCenterSource.includes('Đang là mặc định'), 'Must display Đang là mặc định badge on active default card');

  // 4. Granular margin slider and step buttons
  assert.ok(printCenterSource.includes('type="range"'), 'Must have interactive margin range slider');
  assert.ok(printCenterSource.includes('+1mm') || printCenterSource.includes('-1mm'), 'Must provide step buttons for margin');
  assert.ok(printCenterSource.includes('Căn đều 4 cạnh') || printCenterSource.includes('Căn riêng'), 'Must support uniform and split margin modes');
});

test('PrintCenter UI - 16. Print tab interactive toolbar, CSP-safe execution, and priority spread order', () => {
  const printCenterSource = readFileSync(resolve('src/ui/options/pages/Printing/PrintCenter.jsx'), 'utf8');

  // 1. Priority spread order check: templateConfig must NOT overwrite user-selected paperSize and printMargin
  assert.ok(
    printCenterSource.includes('{ ...templateConfig, paper_size: paperSize, margin: printMargin'),
    'Template spread order must ensure paper_size and margin take precedence over templateConfig'
  );

  // 2. CSP-safe wiring: wirePrintTabControls must be defined and exported
  assert.ok(printCenterSource.includes('export function wirePrintTabControls'), 'Must export wirePrintTabControls');
  assert.ok(printCenterSource.includes("doc.getElementById('btn-print')"), 'Must wire btn-print element');
  assert.ok(printCenterSource.includes("doc.getElementById('btn-close')"), 'Must wire btn-close element');
  assert.ok(printCenterSource.includes("doc.getElementById('tb-paper-size')"), 'Must wire tb-paper-size dropdown');
  assert.ok(printCenterSource.includes("doc.getElementById('tb-margin')"), 'Must wire tb-margin dropdown');
  assert.ok(printCenterSource.includes("doc.getElementById('tb-btn-set-default')"), 'Must wire tb-btn-set-default button');

  // 3. Document output toolbar must contain interactive controls
  const sampleOrder = {
    order_code: 'CF998877665VN',
    customerName: 'Hoàng Nam',
    phone: '0905123456',
    address: 'Đà Nẵng'
  };
  const html = renderBulkHtmlDocument([sampleOrder], { paper_size: 'K100', margin: '2mm' });
  assert.ok(html.includes('id="tb-paper-size"'), 'Print HTML must have interactive paper size select');
  assert.ok(html.includes('id="tb-margin"'), 'Print HTML must have interactive margin select');
  assert.ok(html.includes('id="tb-btn-set-default"'), 'Print HTML must have set-default button');
  assert.ok(html.includes('id="btn-print"'), 'Print HTML must have btn-print ID');
  assert.ok(html.includes('id="btn-close"'), 'Print HTML must have btn-close ID');
  assert.ok(html.includes('id="print-style-sheet"'), 'Print HTML must have style tag with id for dynamic updates');
  assert.ok(html.includes('selected>K100'), 'Active paper size must be selected in dropdown');
  assert.ok(html.includes('selected>2mm'), 'Active margin must be selected in dropdown');
});

test('PrintCenter UI & LabelRenderer - 17. Font size is doubled by default (200%) and supports dynamic font scaling and persistence', () => {
  const printCenterSource = readFileSync(resolve('src/ui/options/pages/Printing/PrintCenter.jsx'), 'utf8');

  // 1. Default scale in getPrintCss must be 2.0 (doubled font size as requested: "Phông chữu trang in to ra nhé! Gấp đôi đi")
  const defaultCss = getPrintCss('A6', 'portrait', '2cm');
  assert.ok(defaultCss.includes('font-size: 17px;'), 'A6 default base font must be ~17px (doubled from 8.5px)');
  assert.ok(defaultCss.includes('font-size: 23px;'), 'A6 tracking code must be ~23px (doubled from 11.5px)');
  assert.ok(defaultCss.includes('font-size: 28px;'), 'A6 BCP routing must be ~28px (doubled from 14px)');
  assert.ok(defaultCss.includes('font-size: 20px;'), 'A6 recipient address must be ~20px (doubled from 10px)');
  assert.ok(defaultCss.includes('font-size: 21px;'), 'A6 COD highlight must be ~21px (doubled from 10.5px)');

  // 2. Dynamic font scale support: 1.0 (standard 100%), 1.5 (large 150%), 2.5 (extra large 250%)
  const standardCss = getPrintCss('A6', 'portrait', '2cm', 1.0);
  assert.ok(standardCss.includes('font-size: 8.5px;'), 'Scale 1.0 must produce standard 8.5px base font');

  const largeCss = getPrintCss('A6', 'portrait', '2cm', 1.5);
  assert.ok(largeCss.includes('font-size: 12.8px;') || largeCss.includes('font-size: 13px;'), 'Scale 1.5 must produce ~12.8px base font');

  const xlCss = getPrintCss('A6', 'portrait', '2cm', 2.5);
  assert.ok(xlCss.includes('font-size: 21.3px;') || xlCss.includes('font-size: 21px;'), 'Scale 2.5 must produce ~21.3px base font');

  // 3. renderBulkHtmlDocument must include font scale toolbar dropdown
  const sampleOrder = {
    order_code: 'CF-FONT-TEST-01',
    carrierAccount: 'NGUYỄN THANH NHỰT',
    customerName: 'Trần Văn To',
    phone: '0901234567',
    address: 'Đà Nẵng'
  };
  const doc = renderBulkHtmlDocument([sampleOrder], { paper_size: 'A6' });
  assert.ok(doc.includes('id="tb-font-scale"'), 'Print HTML must have font scale select element');
  assert.ok(doc.includes('Gấp đôi (200%'), 'Dropdown must show 200% doubled option as default');
  assert.ok(doc.includes('vnpost-meta-account'), 'Carrier account must use scalable vnpost-meta-account class');

  // 4. PrintCenter.jsx must have state and storage wiring for fontScale
  assert.ok(printCenterSource.includes('fontScale'), 'PrintCenter must declare fontScale state');
  assert.ok(printCenterSource.includes('defaultFontScale'), 'PrintCenter must declare defaultFontScale state');
  assert.ok(printCenterSource.includes('handleSetDefaultFontScale'), 'PrintCenter must have handleSetDefaultFontScale handler');
  assert.ok(printCenterSource.includes('default_font_scale'), 'PrintCenter must persist default_font_scale');
  assert.ok(printCenterSource.includes('print_font_scale'), 'PrintCenter must persist print_font_scale');
  assert.ok(printCenterSource.includes('Cỡ chữ in:') || printCenterSource.includes('Cỡ chữ:'), 'Must show font scale selector in PrintCenter UI');
});

test('PrintCenter & LabelRenderer - 18. Mandatory CSP Invariant: Generated HTML documents MUST NEVER contain inline <script> tags or inline onclick attributes', () => {
  const sampleOrders = [
    {
      order_code: 'CF-CSP-VERIFY-01',
      carrierAccount: 'NGUYỄN THANH NHỰT',
      customerName: 'Khách hàng CSP',
      phone: '0988776655',
      address: 'Đà Nẵng'
    },
    {
      order_code: 'CF-CSP-VERIFY-02',
      carrierAccount: 'ĐÀO DUY PHƯỚC',
      customerName: 'Khách hàng 2',
      phone: '0911223344',
      address: 'Hà Nội'
    }
  ];

  const html = renderBulkHtmlDocument(sampleOrders, { paper_size: 'A6' });

  // 1. Must NEVER contain inline <script> tags (Manifest V3 blocks 'unsafe-inline' under extension origin)
  assert.ok(!html.includes('<script'), 'Rendered bulk print HTML must NEVER contain inline <script> tags');
  assert.ok(!html.includes('</script>'), 'Rendered bulk print HTML must NEVER contain closing </script> tags');

  // 2. Must NEVER contain inline onclick or other inline event handler attributes
  assert.ok(!html.includes('onclick='), 'Toolbar buttons must NEVER use inline onclick attributes');
  assert.ok(!html.includes('onload='), 'HTML elements must NEVER use inline onload attributes');
  assert.ok(!html.includes('onchange='), 'HTML elements must NEVER use inline onchange attributes');

  // 3. Must use semantic buttons with clean data attributes for external wiring via wirePrintTabControls
  assert.ok(html.includes('data-action="print"'), 'Print button must use data-action="print"');
  assert.ok(html.includes('data-action="close"'), 'Close button must use data-action="close"');
});







