#!/usr/bin/env node
// =========================================================================
// BENCHMARK SUITE: Order Parsing, Address Normalization & Cache Latency
// =========================================================================

import { parseOrderText, normalizeAddress, parseAndNormalize } from '../src/application/order-parser/core-parser.js';
import { parseCache } from '../src/application/cache/parse-cache.js';

const SAMPLE_ORDERS = [
  'Lê Tuấn Ngọc 0943079679 Số 55, Quốc Lộ 5, Phường Sở Dầu, Quận Hồng Bàng, Hải Phòng COD 899k',
  'Nguyễn Thị Mai 0988123456 Thôn 3, Xã Ea Kao, Thành phố Buôn Ma Thuột, Đắk Lắk Tiền thu hộ 350.000',
  'Anh Hùng 0905123987 12/45 Trần Phú, Phường 1, Thành phố Vũng Tàu, Bà Rịa - Vũng Tàu cod 1tr2',
  'Chị Lan 0976543210 339 Ngõ Quỳnh, Phường Bạch Mai, Hà Nội thu 0đ (khách chuyển khoản)',
  'Đặng Anh Khôi (đối diện 90c) 0918776655 63b cuối ngõ 111 Đông Khê, Ngô Quyền, Hải Phòng COD 4tr150k',
  'Banh Kem Kien Thanh 0938112233 ấp 4 đức hoà long an cod 250k',
  'Trương Phong (+84)912334455 Số 10 Mai Hắc Đế, Phường Bùi Thị Xuân, Quận Hai Bà Trưng, Hà Nội COD 1.500.000 đ',
  'Khoa Trần 0909887766 K34/12 An Khê, Thanh Khê, Đà Nẵng cod 500k',
  'Phạm Thu Hà 0966554433 Số 18/189 đường Cầu Diễn, Xuân Phương, Nam Từ Liêm, Hà Nội 750k',
  'Vũ Minh Trí 0934567890 120 đường 30/4, Phường Thắng Nhất, Vũng Tàu COD 180k',
  'Nguyễn Văn A 0912111222 Xã Tân Triều, Huyện Thanh Trì, Hà Nội tiền 320k',
  'Hoàng Yến 0989000111 Số 5 ngõ 122 Vĩnh Tuy Hai Bà Trưng Hà Nội COD 600.000',
  'Trần Bích Phương 0945678123 45 Lê Lợi, Phường Bến Nghé, Quận 1, TP Hồ Chí Minh COD 2.3tr',
  'Lê Hoàng Long 0977112233 Thôn Đoài, Xã Tam Giang, Huyện Yên Phong, Bắc Ninh thu hộ 400k',
  'Bùi Thúy Hằng 0988991122 Tổ 4, Khu phố 2, Phường Trảng Dài, Biên Hòa, Đồng Nai COD 120k',
  'Đỗ Quốc Bảo 0903445566 88 đường 2/9, Phường Bình Hiên, Quận Hải Châu, Đà Nẵng COD 950k',
  'Võ Thị Ngọc 0919223344 Ấp Tân Hưng, Xã Tân An, Huyện Vĩnh Cửu, Đồng Nai COD 300k',
  'Phan Thanh Tùng 0961234890 Số 9 phố Hàng Mành, Hàng Gai, Hoàn Kiếm, Hà Nội 1.1tr',
  'Đinh Mai Anh 0978998877 Khu đô thị Ecopark, Xã Xuân Quan, Văn Giang, Hưng Yên COD 550k',
  'Lý Văn Hậu 0933778899 Phường Hưng Thạnh, Quận Cái Răng, Cần Thơ COD 420.000 đ',
  'Lê Thị Thu Thảo 0987112233 Số 12A hẻm 45 đường Cách Mạng Tháng 8, Phường 4, Quận 3, HCM COD 850k',
  'Nguyễn Đức Thịnh 0908123456 Thôn Đông, Xã Phù Lương, Quế Võ, Bắc Ninh COD 290k',
  'Trần Thu Trang 0914556677 Tòa S2.01 Vinhomes Ocean Park, Đa Tốn, Gia Lâm, Hà Nội COD 1.8tr',
  'Phạm Thanh Sơn 0972334455 Số 56 Nguyễn Trãi, Phường 3, Thành phố Tây Ninh, Tây Ninh 650k',
  'Vũ Đình Trọng 0937889900 102 Lê Hồng Phong, Phường 7, TP Tuy Hòa, Phú Yên COD 380k'
];

function calculatePercentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

async function runBenchmark() {
  console.log('🚀 Bắt đầu Benchmark Bộ Máy Bóc Tách & Chuẩn Hóa Đơn Hàng (25 mẫu thực tế)...');
  console.log(`📦 Số lượng đơn test: ${SAMPLE_ORDERS.length}\n`);

  parseCache.clearMemory();

  // ── ĐỢT 1: COLD RUN (Chưa có Cache) ──────────────────────────────────────
  const coldParseTimes = [];
  const coldAddrTimes = [];
  const coldTotalTimes = [];

  for (const raw of SAMPLE_ORDERS) {
    const t0 = performance.now();
    const parseRes = await parseOrderText(raw, { shopId: 'bench_shop', useCache: false });
    const t1 = performance.now();

    const addrRes = await normalizeAddress(parseRes.order.address);
    const t2 = performance.now();

    coldParseTimes.push(t1 - t0);
    coldAddrTimes.push(t2 - t1);
    coldTotalTimes.push(t2 - t0);
  }

  // ── Nạp dữ liệu vào Cache cho Đợt 2 ─────────────────────────────────────
  for (const raw of SAMPLE_ORDERS) {
    await parseAndNormalize(raw, { shopId: 'bench_shop', useCache: true });
  }

  // ── ĐỢT 2: WARM RUN (Lấy trực tiếp từ Cache) ────────────────────────────
  const warmTimes = [];
  let cacheHits = 0;

  for (const raw of SAMPLE_ORDERS) {
    const t0 = performance.now();
    const res = await parseOrderText(raw, { shopId: 'bench_shop', useCache: true });
    const t1 = performance.now();
    warmTimes.push(t1 - t0);
    if (res.source === 'cache') cacheHits++;
  }

  // ── TỔNG HỢP VÀ IN BẢNG BÁO CÁO ────────────────────────────────────────
  const avg = (arr) => (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2);

  console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
  console.log('║                    KẾT QUẢ BENCHMARK HIỆU NĂNG                             ║');
  console.log('╠═══════════════════════════════════════════════════════════════════════════╣');
  console.log(`║ 1. Local Order Parse (Cold):  Avg: ${avg(coldParseTimes)}ms | p50: ${calculatePercentile(coldParseTimes, 50).toFixed(2)}ms | p95: ${calculatePercentile(coldParseTimes, 95).toFixed(2)}ms`);
  console.log(`║ 2. Address Normalizer (Cold): Avg: ${avg(coldAddrTimes)}ms | p50: ${calculatePercentile(coldAddrTimes, 50).toFixed(2)}ms | p95: ${calculatePercentile(coldAddrTimes, 95).toFixed(2)}ms`);
  console.log(`║ 3. Toàn bộ chu trình (Cold):  Avg: ${avg(coldTotalTimes)}ms | p50: ${calculatePercentile(coldTotalTimes, 50).toFixed(2)}ms | p95: ${calculatePercentile(coldTotalTimes, 95).toFixed(2)}ms`);
  console.log('╠───────────────────────────────────────────────────────────────────────────╣');
  console.log(`║ 4. Lấy từ Cache (Warm):       Avg: ${avg(warmTimes)}ms | p50: ${calculatePercentile(warmTimes, 50).toFixed(2)}ms | p95: ${calculatePercentile(warmTimes, 95).toFixed(2)}ms`);
  console.log(`║ 5. Tỷ lệ Cache Hit:           ${cacheHits}/${SAMPLE_ORDERS.length} (${Math.round((cacheHits / SAMPLE_ORDERS.length) * 100)}%)`);
  console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
  console.log('\n✅ BENCHMARK HOÀN TẤT THÀNH CÔNG!');
}

runBenchmark().catch(console.error);
