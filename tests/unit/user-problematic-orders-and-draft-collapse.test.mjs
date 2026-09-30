import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import '../../src/application/address/database/data.js';
import '../../src/application/address/aliases.js';
import '../../src/application/address/fuzzy.js';
import '../../src/application/address/normalizer.js';
import '../../src/application/address/parser.js';
import '../../src/application/order-parser/parser.js';
import '../../src/domain/parser/bulk-parser.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

test('Order 1: Đặng Anh Khôi with complex address and parenthesized note', async () => {
  const raw = `Đặng Anh Khôi
Địa chỉ: 63b(đối diện 90c) cuối ngõ 111 Đông Khê, Ngô Quyền, Hải Phòng
0932.966.195
E100.475
Cod 450k`;

  const parsed = globalThis.OrderProcessor.parse(raw);
  assert.equal(parsed.name, 'Đặng Anh Khôi');
  assert.equal(parsed.phone, '0932966195');
  assert.equal(parsed.orderCode, 'E100.475');
  assert.equal(parsed.codAmount, 450000);

  const parsedAddr = globalThis.AddressParser.parse(parsed.address);
  assert.match(parsedAddr.province, /Hải Phòng/i);
  assert.match(parsedAddr.district, /Ngô Quyền/i);
  assert.match(parsedAddr.ward, /Đông Khê/i);
});

test('Order 2: Banh Kem Kien Thanh with unaccented tone variations (đức hoà)', async () => {
  const raw = `Banh Kem Kien Thanh
E100.477
Cod 500k
0989878573
Số 95 bánh kem kiến thành ấp chánh xã đức lập hạ đức hoà long an`;

  const parsed = globalThis.OrderProcessor.parse(raw);
  assert.equal(parsed.name, 'Banh Kem Kien Thanh');
  assert.equal(parsed.phone, '0989878573');
  assert.equal(parsed.orderCode, 'E100.477');
  assert.equal(parsed.codAmount, 500000);

  const parsedAddr = globalThis.AddressParser.parse(parsed.address);
  assert.match(parsedAddr.province, /Long An/i);
  assert.match(parsedAddr.district, /Đức Hòa/i);
  assert.match(parsedAddr.ward, /Đức Lập Hạ/i);
});

test('Order 3: Bam with short single-word name, phone attached to address with slashes', async () => {
  const raw = `Bam
0928552000 số 12 xóm vực/Vân từ/ chuyên mỹ/ hà nội
P80.44
Cod 300k`;

  const parsed = globalThis.OrderProcessor.parse(raw);
  assert.equal(parsed.name, 'Bam', 'Name must be Bam, not misinterpreted as orderCode');
  assert.equal(parsed.phone, '0928552000');
  assert.equal(parsed.orderCode, 'P80.44');
  assert.equal(parsed.codAmount, 300000);

  const parsedAddr = globalThis.AddressParser.parse(parsed.address);
  assert.match(parsedAddr.province, /Hà Nội/i);
  assert.match(parsedAddr.district, /Phú Xuyên/i);
  assert.match(parsedAddr.ward, /(Vân Từ|Chuyên Mỹ)/i);
});

test('UI Check: Draft queue HTML contains collapse button and mini summary', () => {
  const panelPath = path.join(rootDir, 'frontend/panel/panel.js');
  const content = fs.readFileSync(panelPath, 'utf8');

  assert.ok(content.includes('id="btn-draft-queue-toggle-collapse"'), 'Must have collapse toggle button in panel');
  assert.ok(content.includes('id="draft-queue-mini-summary"'), 'Must have mini summary element in panel');
  assert.ok(content.includes('draft_queue_collapsed'), 'Must handle draft_queue_collapsed in storage');
  assert.ok(content.includes('isDraftQueueCollapsed'), 'Must maintain collapsed state variable');
});

test('CSS Check: Draft queue styles support is-collapsed and mini-summary', () => {
  const stylesPath = path.join(rootDir, 'frontend/panel/styling/styles.js');
  const css = fs.readFileSync(stylesPath, 'utf8');

  assert.ok(css.includes('.draft-queue-container.is-collapsed'), 'Must have .is-collapsed rule');
  assert.ok(css.includes('.draft-queue-btn-collapse'), 'Must have .draft-queue-btn-collapse rule');
  assert.ok(css.includes('.draft-queue-mini-summary'), 'Must have .draft-queue-mini-summary rule');
});

test('Sync Check: Service worker relays draft queue events to tabs', () => {
  const swPath = path.join(rootDir, 'src/runtime/service-worker/service-worker.js');
  const sw = fs.readFileSync(swPath, 'utf8');

  assert.ok(sw.includes('draftOrdersUpdated'), 'Service worker must handle draftOrdersUpdated');
  assert.ok(sw.includes('chrome.tabs.sendMessage'), 'Service worker must broadcast to tabs');
});

test('Version Display: Panel header & context menu show extension version', () => {
  const panelPath = path.join(rootDir, 'frontend/panel/panel.js');
  const panelContent = fs.readFileSync(panelPath, 'utf8');
  const stylesPath = path.join(rootDir, 'frontend/panel/styling/styles.js');
  const cssContent = fs.readFileSync(stylesPath, 'utf8');

  assert.ok(panelContent.includes('id="vnpost-panel-version-badge"'), 'Panel header must have version badge element');
  assert.ok(panelContent.includes('class="panel-version-badge"'), 'Panel must apply panel-version-badge class');
  assert.ok(panelContent.includes('menu-version-badge'), 'Account menu must display version');
  assert.ok(cssContent.includes('.panel-version-badge'), 'CSS must define .panel-version-badge styling');
});

test('Version Display: Options page displays version in Sidebar, TopHeader and Popover', () => {
  const appPath = path.join(rootDir, 'src/ui/options/App.jsx');
  const appContent = fs.readFileSync(appPath, 'utf8');
  const topHeaderPath = path.join(rootDir, 'src/ui/options/components/TopHeader.jsx');
  const topHeaderContent = fs.readFileSync(topHeaderPath, 'utf8');
  const userProfileCardPath = path.join(rootDir, 'src/ui/options/components/UserProfileCard.jsx');
  const userProfileCardContent = fs.readFileSync(userProfileCardPath, 'utf8');
  const stylesPath = path.join(rootDir, 'src/ui/options/options-styles.css');
  const cssContent = fs.readFileSync(stylesPath, 'utf8');

  assert.ok(appContent.includes('nav-brand-version-badge'), 'Sidebar brand must have version badge');
  assert.ok(topHeaderContent.includes('topbar-version-badge'), 'TopHeader must have topbar-version-badge');
  assert.ok(userProfileCardContent.includes('popover-footer-version'), 'UserProfileCard popover must show version');
  assert.ok(cssContent.includes('.nav-brand-version-badge'), 'options-styles.css must style .nav-brand-version-badge');
  assert.ok(cssContent.includes('.topbar-version-badge'), 'options-styles.css must style .topbar-version-badge');
  assert.ok(cssContent.includes('.popover-footer-version'), 'options-styles.css must style .popover-footer-version');
});

test('Order Approval Modal: Expanded to 920px and displays comprehensive order details', () => {
  const stylesPath = path.join(rootDir, 'frontend/panel/styling/styles.js');
  const cssContent = fs.readFileSync(stylesPath, 'utf8');
  const panelPath = path.join(rootDir, 'frontend/panel/panel.js');
  const panelContent = fs.readFileSync(panelPath, 'utf8');

  assert.ok(cssContent.includes('max-width: 1700px') || cssContent.includes('max-width: 1220px') || cssContent.includes('max-width: 1060px') || cssContent.includes('max-width: 920px'), 'Modal card must be expanded to at least 920px');
  assert.ok(cssContent.includes('.af-hero-cod'), 'CSS must include hero COD styling');
  assert.ok(cssContent.includes('.af-address-breakdown'), 'CSS must include address breakdown styling');
  assert.ok(panelContent.includes('Địa giới hành chính nhận diện'), 'Modal must show 3-tier address breakdown');
  assert.ok(panelContent.includes('TIỀN THU HỘ (COD)'), 'Modal must prominently show COD comparison');
  assert.ok(panelContent.includes('Nguồn gốc tạo đơn'), 'Modal must show order source');
});

test('Order 1 Landmark: Landmark note (đối diện 90c) is preserved in address street', () => {
  const addr = '63b(đối diện 90c) cuối ngõ 111 Đông Khê, Ngô Quyền, Hải Phòng';
  const parsedAddr = globalThis.AddressParser.parse(addr);
  assert.match(parsedAddr.street, /đối diện 90c/i, 'Street must preserve landmark note in parentheses');
  assert.match(parsedAddr.ward, /Đông Khê/i);
  assert.match(parsedAddr.district, /Ngô Quyền/i);
  assert.match(parsedAddr.province, /Hải Phòng/i);
});

test('Order 4: Khoa Trần with reverse name and cross-district An Khê Đà Nẵng', () => {
  const raw = `Khoa Trần
E80.344
Cod 300k
Sdt : 0775407193
Đc: k49/16 trần văn ơn , An Khê , cẩm lệ , đà nẵng`;

  const parsed = globalThis.OrderProcessor.parse(raw);
  assert.equal(parsed.name, 'Khoa Trần', 'Must recognize reverse name Khoa Trần');
  assert.equal(parsed.phone, '0775407193');
  assert.equal(parsed.orderCode, 'E80.344');
  assert.equal(parsed.codAmount, 300000);

  const parsedAddr = globalThis.AddressParser.parse(parsed.address);
  assert.match(parsedAddr.ward, /An Khê/i, 'Must resolve ward An Khê');
  assert.match(parsedAddr.district, /Thanh Khê/i, 'Must cross-validate An Khê to Quận Thanh Khê, not Cẩm Lệ');
  assert.match(parsedAddr.province, /Đà Nẵng/i);
});

test('Order 5: Trương Phong with (+84) phone and attached address label', () => {
  const raw = `E100.487
Cod 450k
Tên người nhận: Trương Phong 
Số điện thoại: (+84) 96 555 30 97Địa chỉ chi tiết: Tổ 37 Nhà trọ Minh Quốc, Số 26 đường số 1, Khu dân cư An Phú, khu phố Chiêu Liêu, Phường Tân Đông Hiệp, Thành phố Dĩ An, Tỉnh Bình Dương.`;

  const parsed = globalThis.OrderProcessor.parse(raw);
  assert.equal(parsed.name, 'Trương Phong', 'Name must not include label');
  assert.equal(parsed.phone, '0965553097', 'Must parse (+84) international format and detach from attached label');
  assert.equal(parsed.orderCode, 'E100.487');
  assert.equal(parsed.codAmount, 450000);

  const parsedAddr = globalThis.AddressParser.parse(parsed.address);
  assert.match(parsedAddr.ward, /Tân Đông Hiệp/i);
  assert.match(parsedAddr.district, /Dĩ An/i);
  assert.match(parsedAddr.province, /Bình Dương/i);
});

test('Bulk split: splits 5 sample orders cleanly into 5 chunks', () => {
  const allOrdersText = `Đặng Anh Khôi
Địa chỉ: 63b(đối diện 90c) cuối ngõ 111 Đông Khê, Ngô Quyền, Hải Phòng
0932.966.195
E100.475
Cod 450k


Banh Kem Kien Thanh
E100.477
Cod 500k
0989878573
Số 95 bánh kem kiến thành ấp chánh xã đức lập hạ đức hoà long an

Bam
0928552000 số 12 xóm vực/Vân từ/ chuyên mỹ/ hà nội
P80.44
Cod 300k
--
Khoa Trần
E80.344
Cod 300k
Sdt : 0775407193
Đc: k49/16 trần văn ơn , An Khê , cẩm lệ , đà nẵng
----
E100.487
Cod 450k
Tên người nhận: Trương Phong 
Số điện thoại: (+84) 96 555 30 97Địa chỉ chi tiết: Tổ 37 Nhà trọ Minh Quốc, Số 26 đường số 1, Khu dân cư An Phú, khu phố Chiêu Liêu, Phường Tân Đông Hiệp, Thành phố Dĩ An, Tỉnh Bình Dương.`;

  const chunks = globalThis.BulkParserService.splitRawTextToChunks(allOrdersText);
  assert.equal(chunks.length, 5, 'Must split exactly into 5 separate chunks');

  const p1 = globalThis.OrderProcessor.parse(chunks[0]);
  assert.equal(p1.name, 'Đặng Anh Khôi');

  const p2 = globalThis.OrderProcessor.parse(chunks[1]);
  assert.equal(p2.name, 'Banh Kem Kien Thanh');

  const p3 = globalThis.OrderProcessor.parse(chunks[2]);
  assert.equal(p3.name, 'Bam');

  const p4 = globalThis.OrderProcessor.parse(chunks[3]);
  assert.equal(p4.name, 'Khoa Trần');

  const p5 = globalThis.OrderProcessor.parse(chunks[4]);
  assert.equal(p5.name, 'Trương Phong');
});

test('Address 2-level: Phường Thanh Xuân, Hà Nội maps to Thanh Xuân Hà Nội, not Sóc Sơn', () => {
  const addr = 'Phường Thanh Xuân, hà nội';
  const parsed = globalThis.AddressParser.parse(addr);
  assert.match(parsed.ward, /Thanh Xuân/i);
  assert.match(parsed.district, /Thanh Xuân/i, 'Must not be confused with Huyện Sóc Sơn');
  assert.match(parsed.province, /Hà Nội/i);
});

test('Address 2-level: Số 18/189 đường Cầu Diễn, Xuân Phương, Hà Nội correctly parses ward and district without fuzzy match to Đan Phượng', () => {
  const raw = `0352141449
Số 18/189 đường Cầu Diễn, Xuân Phương, Hà Nội
đỗ quang tú ( acc zũ lũa )
s120.30
cod 600k`;
  const order = globalThis.OrderProcessor.parse(raw);
  assert.equal(order.name, 'đỗ quang tú');
  assert.equal(order.phone, '0352141449');
  assert.equal(order.orderCode, 's120.30');
  assert.equal(order.codAmount, 600000);

  const parsedAddr = globalThis.AddressParser.parse(order.address);
  assert.equal(parsedAddr.street, 'Số 18/189 Đường Cầu Diễn');
  assert.match(parsedAddr.ward, /Xuân Phương/i);
  assert.match(parsedAddr.district, /Nam Từ Liêm/i);
  assert.match(parsedAddr.province, /Hà Nội/i);
});



