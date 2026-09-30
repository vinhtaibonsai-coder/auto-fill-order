import assert from 'node:assert/strict';
import {
  detectOrderCarrier,
  getCarrierMeta,
  getCarrierTrackingUrl,
  CARRIER_IDS
} from '../../src/application/carriers/carrier-detection.js';

console.log('--- Testing Carrier Detection & Tracking Segregation ---');

// 1. Kiểm tra chính xác các mã vận đơn thực tế của người dùng từ ảnh chụp
const userOrders = [
  { order_code: 'E100.103', tracking_code: '841327113159', expected: CARRIER_IDS.JT },
  { order_code: 'K120.41', tracking_code: '842616563439', expected: CARRIER_IDS.JT },
  { order_code: 'Pt259', tracking_code: '842616255623', expected: CARRIER_IDS.JT },
  { order_code: 'hs40', tracking_code: 'CD377518642VN', expected: CARRIER_IDS.VNPOST },
  { order_code: 'K120.43', tracking_code: 'CD377532600VN', expected: CARRIER_IDS.VNPOST }
];

userOrders.forEach((o) => {
  const carrier = detectOrderCarrier(o);
  assert.equal(carrier, o.expected, `Đơn ${o.order_code} (${o.tracking_code}) phải nhận diện là ${o.expected}, nhưng ra ${carrier}`);
});
console.log('✅ Nhận diện chính xác 5 đơn thực tế từ ảnh chụp người dùng.');

// 2. Kiểm tra nhận diện theo platform rõ ràng
assert.equal(detectOrderCarrier({ platform: 'jt', tracking_code: '123' }), CARRIER_IDS.JT);
assert.equal(detectOrderCarrier({ platform: 'j&t express', tracking_code: '456' }), CARRIER_IDS.JT);
assert.equal(detectOrderCarrier({ platform: 'vnpost', tracking_code: '789' }), CARRIER_IDS.VNPOST);
console.log('✅ Nhận diện đúng theo trường platform trong database.');

// 3. Kiểm tra link tra cứu hành trình theo từng hãng
const jtLink = getCarrierTrackingUrl(CARRIER_IDS.JT, '841327113159');
assert.ok(jtLink.includes('jtexpress.vn/vi/tracking?billcode=841327113159'), `Link J&T không đúng: ${jtLink}`);

const vnpostLink = getCarrierTrackingUrl(CARRIER_IDS.VNPOST, 'CD377518642VN');
assert.ok(vnpostLink.includes('my.vnpost.vn/tra-cuu-hanh-trinh?tracking=CD377518642VN'), `Link VNPost không đúng: ${vnpostLink}`);
console.log('✅ Tạo đúng đường dẫn tra cứu bưu phẩm chuyên biệt cho từng hãng.');

// 4. Metadata badges
const jtMeta = getCarrierMeta(CARRIER_IDS.JT);
assert.equal(jtMeta.badgeText, 'J&T Express');
assert.equal(jtMeta.hasApiSupport, false);

const vnpMeta = getCarrierMeta(CARRIER_IDS.VNPOST);
assert.equal(vnpMeta.badgeText, 'VNPost');
assert.equal(vnpMeta.hasApiSupport, true);
console.log('✅ Metadata và nhãn phân loại hiển thị chuẩn xác.');

console.log('🎉 Tất cả kiểm thử phân tách hãng vận chuyển và tra cứu API đã vượt qua 100%!');
