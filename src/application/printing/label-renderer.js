/**
 * @file label-renderer.js
 * @description Official VNPost A6/A5 shipping label rendering module (Wave 1 Task A02).
 * Formats shipping labels matching the exact Vietnam Post standard thermal print specifications.
 */

import { maskPhone, maskAddress } from '../../domain/order/order-event.taxonomy.js';

export const PAPER_DIMENSIONS = Object.freeze({
  A4: { width: '210mm', height: '297mm', widthPx: 794, heightPx: 1123, label: 'A4 (210 x 297 mm) - Khổ văn phòng' },
  A5: { width: '148mm', height: '210mm', widthPx: 559, heightPx: 794, label: 'A5 (148 x 210 mm) - Nửa tờ A4' },
  A6: { width: '105mm', height: '148mm', widthPx: 397, heightPx: 559, label: 'A6 (105 x 148 mm) - Chuẩn bưu điện VNPost' },
  K100: { width: '100mm', height: '150mm', widthPx: 378, heightPx: 567, label: '100 x 150 mm (K100) - Cuộn in nhiệt TMĐT' },
  '100X150': { width: '100mm', height: '150mm', widthPx: 378, heightPx: 567, label: '100 x 150 mm (K100) - Cuộn in nhiệt TMĐT' }
});

export function normalizeMarginCss(margin) {
  if (!margin && margin !== 0) return '20mm'; // Default 2cm (cách lề 2cm theo yêu cầu)
  const s = String(margin).trim().toLowerCase();
  if (s === '0' || s === '0cm' || s === '0mm') return '0mm';
  if (s === '2cm' || s === '20mm') return '20mm';
  if (s === '1.5cm' || s === '15mm') return '15mm';
  if (s === '1cm' || s === '10mm') return '10mm';
  if (s === '0.5cm' || s === '5mm') return '5mm';

  // Support multi-value space-separated margins (e.g. "10mm 20mm" or "10mm 15mm 10mm 15mm")
  if (s.includes(' ')) {
    return s.split(/\s+/).filter(Boolean).map(p => normalizeMarginCss(p)).join(' ');
  }

  if (s.endsWith('cm') || s.endsWith('mm') || s.endsWith('in') || s.endsWith('px')) return s;
  const num = parseFloat(s);
  if (!isNaN(num)) return `${num}mm`;
  return '20mm';
}

const CODE128_PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112"
];

/**
 * Generates Code 128 (Subset B) SVG Barcode representation.
 */
export function generateBarcodeSvg(text, height = 44) {
  if (!text) text = 'NO-TRACKING';
  const clean = String(text).trim();
  const codes = [104]; // START B
  let checksum = 104;
  for (let i = 0; i < clean.length; i++) {
    const val = clean.charCodeAt(i) - 32;
    const code = (val >= 0 && val <= 95) ? val : 0;
    codes.push(code);
    checksum += code * (i + 1);
  }
  codes.push(checksum % 103);
  codes.push(106); // STOP

  let modules = '';
  for (const c of codes) {
    const pat = CODE128_PATTERNS[c] || CODE128_PATTERNS[0];
    let isBar = true;
    for (const ch of pat) {
      const w = parseInt(ch, 10);
      modules += (isBar ? '1' : '0').repeat(w);
      isBar = !isBar;
    }
  }

  let pathD = '';
  let x = 0;
  const barWidth = 1.35;
  for (let i = 0; i < modules.length; i++) {
    if (modules[i] === '1') {
      const bx = (x * barWidth).toFixed(1);
      const bw = barWidth.toFixed(1);
      pathD += `M${bx} 0h${bw}v${height}h-${bw}z `;
    }
    x++;
  }
  const totalWidth = (modules.length * barWidth).toFixed(1);

  return `<svg viewBox="0 0 ${totalWidth} ${height}" class="barcode-svg vnpost-barcode-svg" style="width: 100%; max-width: ${totalWidth}px; height: ${height}px; display: block; margin: 0 auto;" preserveAspectRatio="none"><path d="${pathD}" fill="#000"/></svg>`;
}

/**
 * Generates a clean 25x25 QR Code SVG representation.
 */
export function generateQrCodeSvg(text, size = 68) {
  const n = 25;
  const matrix = Array.from({ length: n }, () => Array(n).fill(null));

  function placeFinder(startX, startY) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const y = startY + r;
        const x = startX + c;
        if (x < 0 || x >= n || y < 0 || y >= n) continue;
        if (r === -1 || r === 7 || c === -1 || c === 7) {
          matrix[y][x] = false;
        } else if (r === 0 || r === 6 || c === 0 || c === 6) {
          matrix[y][x] = true;
        } else if (r >= 2 && r <= 4 && c >= 2 && c <= 4) {
          matrix[y][x] = true;
        } else {
          matrix[y][x] = false;
        }
      }
    }
  }

  placeFinder(0, 0);
  placeFinder(n - 7, 0);
  placeFinder(0, n - 7);

  // Alignment at (18, 18)
  for (let r = -2; r <= 2; r++) {
    for (let c = -2; c <= 2; c++) {
      const y = 18 + r;
      const x = 18 + c;
      matrix[y][x] = (Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0));
    }
  }

  // Timing patterns
  for (let i = 8; i < n - 8; i++) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }
  matrix[n - 8][8] = true; // Dark module

  // Format bits
  const formatBits = [1,1,1,0,1,1,1,1,1,0,0,0,1,0,0];
  const formatPos = [
    [8,0],[8,1],[8,2],[8,3],[8,4],[8,5],[8,7],[8,8],
    [7,8],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8]
  ];
  for (let i = 0; i < 15; i++) matrix[formatPos[i][0]][formatPos[i][1]] = formatBits[i] === 1;

  // Data payload
  const str = String(text || '');
  const dataBits = [0, 1, 0, 0];
  const len = Math.min(str.length, 28);
  for (let b = 7; b >= 0; b--) dataBits.push((len >> b) & 1);
  for (let i = 0; i < len; i++) {
    const code = str.charCodeAt(i);
    for (let b = 7; b >= 0; b--) dataBits.push((code >> b) & 1);
  }
  while (dataBits.length < 28 * 8 && dataBits.length % 8 !== 0) dataBits.push(0);
  while (dataBits.length < 28 * 8) {
    dataBits.push(1,1,1,0,1,1,0,0);
    if (dataBits.length < 28 * 8) dataBits.push(0,0,0,1,0,0,0,1);
  }

  let bitIdx = 0;
  let dir = -1;
  let x = n - 1;
  while (x > 0) {
    if (x === 6) x--;
    let y = dir === -1 ? n - 1 : 0;
    while (y >= 0 && y < n) {
      for (let c = 0; c < 2; c++) {
        const col = x - c;
        if (matrix[y][col] === null) {
          let bit = bitIdx < dataBits.length ? dataBits[bitIdx++] : 0;
          if ((y + col) % 2 === 0) bit = bit ^ 1; // Mask 0
          matrix[y][col] = bit === 1;
        }
      }
      y += dir;
    }
    dir = -dir;
    x -= 2;
  }

  const cellSize = (size / n).toFixed(2);
  let pathD = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (matrix[r][c]) {
        const cx = (c * cellSize).toFixed(1);
        const cy = (r * cellSize).toFixed(1);
        pathD += `M${cx} ${cy}h${cellSize}v${cellSize}h-${cellSize}z `;
      }
    }
  }

  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" class="vnpost-qr-svg" style="display: block;"><path d="${pathD}" fill="#000"/></svg>`;
}

/**
 * Format currency to Vietnamese dong representation (e.g. 350000 -> 350.000 đ)
 */
export function formatVnd(amount) {
  if (amount === undefined || amount === null || isNaN(amount)) return '0 đ';
  const num = Math.round(Number(amount));
  return `${num.toLocaleString('vi-VN')} đ`;
}

/**
 * Derives realistic VNPost routing and BCP sorting center from destination address.
 */
export function extractVnpostRouting(address = '', order = {}) {
  const addr = (address || '').toLowerCase();

  if (addr.includes('hà nội') || addr.includes('ha noi')) {
    let district = 'Hoàn Kiếm';
    if (addr.includes('ba đình') || addr.includes('phúc xá')) district = 'Ba Đình';
    else if (addr.includes('đống đa')) district = 'Đống Đa';
    else if (addr.includes('cầu giấy')) district = 'Cầu Giấy';
    else if (addr.includes('hai bà trưng')) district = 'Hai Bà Trưng';
    else if (addr.includes('hoàng mai')) district = 'Hoàng Mai';
    else if (addr.includes('thanh xuân')) district = 'Thanh Xuân';
    else if (addr.includes('hà đông')) district = 'Hà Đông';
    else if (addr.includes('tây hồ')) district = 'Tây Hồ';
    else if (addr.includes('bắc từ liêm')) district = 'Bắc Từ Liêm';
    else if (addr.includes('nam từ liêm')) district = 'Nam Từ Liêm';
    else if (addr.includes('long biên')) district = 'Long Biên';

    return {
      line1: 'LV/10 - Hà Nội/100920 - KTNT Hà Nội',
      bcp: `111662 - BCP ${district}`,
      serviceChar: 'C'
    };
  }

  if (addr.includes('hồ chí minh') || addr.includes('ho chi minh') || addr.includes('hcm') || addr.includes('sài gòn')) {
    let district = 'Tân Bình';
    if (addr.includes('quận 1') || addr.includes('q1')) district = 'Quận 1';
    else if (addr.includes('quận 3') || addr.includes('q3')) district = 'Quận 3';
    else if (addr.includes('bình thạnh')) district = 'Bình Thạnh';
    else if (addr.includes('gò vấp')) district = 'Gò Vấp';
    else if (addr.includes('thủ đức')) district = 'Thủ Đức';
    else if (addr.includes('quận 7') || addr.includes('q7')) district = 'Quận 7';
    else if (addr.includes('quận 10') || addr.includes('q10')) district = 'Quận 10';

    return {
      line1: 'LV/70 - TP. Hồ Chí Minh/700920 - KTNT Tân Bình',
      bcp: `711800 - BCP ${district}`,
      serviceChar: 'C'
    };
  }

  if (addr.includes('đà nẵng') || addr.includes('da nang')) {
    return {
      line1: 'LV/55 - TP. Đà Nẵng/550920 - KTNT Đà Nẵng',
      bcp: '551200 - BCP Hải Châu',
      serviceChar: 'C'
    };
  }

  if (addr.includes('hải phòng') || addr.includes('hai phong')) {
    return {
      line1: 'LV/18 - TP. Hải Phòng/180920 - KTNT Hải Phòng',
      bcp: '181000 - BCP Lê Chân',
      serviceChar: 'C'
    };
  }

  if (addr.includes('quảng ninh')) {
    return {
      line1: 'LV/20 - Quảng Ninh/200920 - KTNT Quảng Ninh',
      bcp: '201000 - BCP Quảng Yên',
      serviceChar: 'C'
    };
  }

  if (addr.includes('hưng yên')) {
    return {
      line1: 'LV/16 - Hưng Yên/160920 - KTNT Hưng Yên',
      bcp: '161000 - BCP Kim Động',
      serviceChar: 'C'
    };
  }

  if (addr.includes('bắc ninh')) {
    return {
      line1: 'LV/22 - Bắc Ninh/220920 - KTNT Bắc Ninh',
      bcp: '221000 - BCP Trí Quả',
      serviceChar: 'C'
    };
  }

  if (addr.includes('đồng nai') || addr.includes('biên hòa')) {
    return {
      line1: 'LV/81 - Đồng Nai/810920 - KTNT Biên Hòa',
      bcp: '811000 - BCP Tam Hiệp',
      serviceChar: 'C'
    };
  }

  const parts = address.split(',').map(p => p.trim()).filter(Boolean);
  const prov = parts.length > 0 ? parts[parts.length - 1] : 'Việt Nam';
  const dist = parts.length > 1 ? parts[parts.length - 2] : prov;

  return {
    line1: `LV/20 - ${prov} - KTNT ${prov}`,
    bcp: `BCP ${dist}`,
    serviceChar: 'C'
  };
}

/**
 * Format recipient address for VNPost standard label:
 * Splits highlighted locality and detailed street address.
 */
export function formatVnpostRecipientAddress(address = '') {
  if (!address) return { short: 'Việt Nam', full: '' };
  const parts = address.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length <= 2) {
    return { short: address, full: address };
  }
  // Standard format: Last 2 parts as short locality (e.g. "P. Phúc Xá, TP. Hà Nội")
  const short = parts.slice(-2).join(', ');
  return { short, full: address };
}

export function extractCodAmount(order) {
  if (!order) return 0;
  const raw = order.codAmount !== undefined ? order.codAmount
    : (order.cod_amount !== undefined ? order.cod_amount
    : (order.cod !== undefined ? order.cod
    : (order.tien_thu_ho !== undefined ? order.tien_thu_ho
    : (order.totalAmount !== undefined ? order.totalAmount : 0))));
  if (typeof raw === 'string') {
    const cleaned = raw.replace(/\D/g, '');
    return Number(cleaned) || 0;
  }
  return Number(raw) || 0;
}

export function extractOrderCode(order) {
  if (!order) return '—';
  const candidates = [
    order.orderCode,
    order.order_code,
    order.code,
    order.orderId,
    order.order_id,
    order.savedOrderId,
    order.saved_order_id,
    order.id
  ];
  for (const c of candidates) {
    if (c !== undefined && c !== null) {
      const s = String(c).trim();
      if (s && s !== '-' && s !== '—' && s !== 'null' && s !== 'undefined' && !s.startsWith('sub_') && !s.startsWith('temp_')) {
        return s;
      }
    }
  }
  return '—';
}

export function extractTrackingCode(order) {
  if (!order) return '';
  const candidates = [
    order.trackingCode,
    order.tracking_code,
    order.tracking_number,
    order.trackingNumber,
    order.waybillCode,
    order.waybill_code
  ];
  for (const c of candidates) {
    if (c !== undefined && c !== null) {
      const s = String(c).trim();
      if (s && s !== '-' && s !== '—' && !s.toLowerCase().includes('chờ') && s !== 'null' && s !== 'undefined') {
        return s;
      }
    }
  }
  return '';
}

export function detectCarrier(order) {
  const p = String(
    order?.platform || order?.carrier || order?.carrier_id || order?.carrierName || ''
  ).toLowerCase();
  if (p.includes('jt') || p.includes('j&t')) {
    return { key: 'jt', name: 'J&T Express', brandName: 'J&T EXPRESS', slogan: 'J&T Express - Express Your Online Business. Giao hàng chuẩn xác, tận tâm. Hotline: 1900 1088.', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' };
  }
  if (p.includes('viettel')) {
    return { key: 'viettelpost', name: 'Viettel Post', brandName: 'VIETTEL POST', slogan: 'Viettel Post - Đi sâu đi xa để gắn kết con người. Hotline: 1900 8095.', color: '#0284c7', bg: '#f0f9ff', border: '#bae6fd' };
  }
  if (p.includes('ghtk')) {
    return { key: 'ghtk', name: 'GHTK', brandName: 'GIAO HÀNG TIẾT KIỆM', slogan: 'Giao Hàng Tiết Kiệm - Nhanh, Linh hoạt, Thân thiện. Hotline: 1900 6092.', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' };
  }
  return { key: 'vnpost', name: 'VNPost', brandName: 'VIETNAM POST', slogan: 'Vietnam Post tuyển dụng nhân viên toàn quốc. Hotline: 1900 545481.', color: '#d97706', bg: '#fffbeb', border: '#fde68a' };
}

export function getCarrierAccount(order) {
  if (!order) return '';
  const acc = order.carrierAccount || order.carrier_account || order.senderName || order.sender_name || order.senderAccount || order.sender_account || order.vnpostAccount || order.vnpost_account;
  if (acc && acc !== '-' && acc !== '—' && acc !== 'Mặc định') return String(acc).trim();
  const rawName = order.name || order.customer_name || order.customerName;
  const match = String(rawName).match(/\((?:acc|tài khoản|tk)?\s*([^\)]+)\)/i);
  if (match && match[1]) return match[1].trim();
  return '';
}

export function findCarrierAccount(accountName, registry = {}) {
  if (!accountName || !registry || typeof registry !== 'object') return null;
  const clean = String(accountName).trim();
  if (registry[clean]) return registry[clean];
  const lower = clean.toLowerCase();
  for (const [key, val] of Object.entries(registry)) {
    if (key && key.trim().toLowerCase() === lower) return val;
  }
  return null;
}

export function isRecipientPayingFee(order) {
  if (!order) return false;
  const payerValue = order.shipping_fee_payer !== undefined ? order.shipping_fee_payer
    : (order.collect_fee !== undefined ? order.collect_fee
    : (order.collectFee !== undefined ? order.collectFee : order.shippingFeePayer));
  if (payerValue === true || payerValue === 'true' || payerValue === 1 || payerValue === '1') return true;
  const payer = String(payerValue || '').toUpperCase();
  if (payer === 'RECIPIENT' || payer === 'BUYER' || payer === 'KHÁCH' || payer === 'NGƯỜI NHẬN') return true;
  return false;
}

/**
 * Transform raw order and template into a clean label model.
 */
export function generateLabelModel(order = {}, template = {}, options = {}) {
  const paper_size = (template.paper_size || 'A6').toUpperCase();
  const orientation = template.orientation || 'portrait';
  const hasFullPii = options.hasFullPiiAccess !== false;

  const rawPhone = order.phone || order.customerPhone || order.recipientPhone || '';
  const rawAddress = order.address || order.customerAddress || order.deliveryAddress || '';

  const recipient_phone = hasFullPii ? rawPhone : maskPhone(rawPhone);
  const recipient_address = hasFullPii ? rawAddress : maskAddress(rawAddress);

  // Accurate COD extraction
  const codAmount = extractCodAmount(order);

  // Carrier differentiation & branding
  const carrierInfo = detectCarrier(order);
  const carrier = carrierInfo.key.toUpperCase();
  const carrierBrandName = carrierInfo.brandName;
  const customSlogan = (template.custom_slogan || template.customSlogan || '').trim();
  const carrierSlogan = customSlogan || carrierInfo.slogan;

  // Tracking and order identity resolution
  const trackingCodeExtracted = extractTrackingCode(order);
  const orderCodeExtracted = extractOrderCode(order);

  const tracking_code = trackingCodeExtracted || (orderCodeExtracted !== '—' ? orderCodeExtracted : 'NO_TRACKING');
  const order_code = orderCodeExtracted;
  const barcodeValue = trackingCodeExtracted || (orderCodeExtracted !== '—' ? orderCodeExtracted : 'NO_TRACKING');

  const routing = extractVnpostRouting(rawAddress, order);
  const addrFormatted = formatVnpostRecipientAddress(recipient_address);

  // Items and product note processing
  let items = [];
  if (Array.isArray(order.items) && order.items.length > 0) {
    items = order.items.map(it => {
      if (typeof it === 'string') return { name: it, quantity: 1, code: '' };
      return {
        name: it.name || it.title || it.product || 'Hàng hoá',
        quantity: it.quantity || it.qty || 1,
        code: it.code || it.sku || ''
      };
    });
  } else {
    const rawProduct = (
      order.productItem ||
      order.productNote ||
      order.product_note ||
      order.product ||
      order.goodsName ||
      order.goods_name ||
      order.defaultGoodsName ||
      order.productDescription ||
      order.product_description ||
      order.content ||
      order.extraNote ||
      ''
    ).trim();

    if (rawProduct) {
      items = [{
        name: rawProduct,
        quantity: order.quantity || order.qty || 1,
        code: order.productCode || order.product_code || (orderCodeExtracted !== '—' ? orderCodeExtracted : '')
      }];
    } else {
      items = [{
        name: orderCodeExtracted !== '—' ? `Hàng hoá (${orderCodeExtracted})` : 'Hàng hoá tổng hợp',
        quantity: order.quantity || order.qty || 1,
        code: orderCodeExtracted !== '—' ? orderCodeExtracted : ''
      }];
    }
  }

  const primaryItemName = items[0]?.name || (orderCodeExtracted !== '—' ? `Hàng hoá (${orderCodeExtracted})` : 'Hàng hoá');

  // Sender info resolution - prioritize VNPost / carrier account that created the order
  const isValidAccount = (acc) => Boolean(
    acc &&
    typeof acc === 'string' &&
    !['mặc định', 'chưa phân loại', 'tất cả', 'all', '-', '—', 'default'].includes(acc.trim().toLowerCase())
  );

  const orderCarrierAccount = getCarrierAccount(order);
  const accRegistry = options.carrierAccounts || options.carrier_accounts || {};

  // Case-insensitive lookup in registered carrier accounts
  const matchedAcc = (isValidAccount(orderCarrierAccount) && findCarrierAccount(orderCarrierAccount, accRegistry)) ||
                     (isValidAccount(order.senderName) && findCarrierAccount(order.senderName, accRegistry)) ||
                     (isValidAccount(order.carrierAccount) && findCarrierAccount(order.carrierAccount, accRegistry)) ||
                     null;

  const effectiveCarrierAccount = isValidAccount(orderCarrierAccount)
    ? orderCarrierAccount
    : (isValidAccount(order.senderName) ? order.senderName.trim() : (options.carrierAccount || options.defaultCarrierAccount || options.vnpostAccount || ''));

  // SENDER NAME RESOLUTION:
  // Ưu tiên cao nhất: Tài khoản VNPost được lên đơn (order carrier account / senderName của đơn)
  let sender_name = '';
  if (options.forceSenderName && (options.senderName || options.sender_name)) {
    sender_name = options.senderName || options.sender_name;
  } else if (isValidAccount(orderCarrierAccount)) {
    sender_name = orderCarrierAccount;
  } else if (isValidAccount(order.senderName)) {
    sender_name = order.senderName.trim();
  } else if (isValidAccount(order.sender_name)) {
    sender_name = order.sender_name.trim();
  } else if (matchedAcc?.name) {
    sender_name = matchedAcc.name;
  } else if (options.senderName || options.sender_name) {
    sender_name = options.senderName || options.sender_name;
  } else if (isValidAccount(effectiveCarrierAccount)) {
    sender_name = effectiveCarrierAccount;
  } else {
    sender_name = order.senderShopName || order.shopName || order.shop_name || 'VĨNH TÀI BONSAI';
  }

  const carrierAccount = effectiveCarrierAccount || sender_name;

  // SĐT Người gửi:
  // Ưu tiên SĐT của tài khoản VNPost đã lên đơn:
  // 1. SĐT người gửi của chính đơn hàng
  // 2. SĐT từ matched carrier account
  // 3. SĐT từ registry tra cứu theo sender_name
  // 4. SĐT từ options.senderPhone
  // 5. SĐT từ options.lastVnpostSenderInfo?.phone / options.vnpostPhone
  // 6. Shop phone
  const registryPhone = (sender_name && findCarrierAccount(sender_name, accRegistry)?.phone) || '';
  const rawSenderPhone = order.senderPhone ||
    order.sender_phone ||
    order.senderMobile ||
    order.sender_mobile ||
    matchedAcc?.phone ||
    registryPhone ||
    options.senderPhone ||
    options.sender_phone ||
    options.lastVnpostSenderInfo?.phone ||
    options.vnpostPhone ||
    order.shopPhone ||
    order.shop_phone ||
    order.pickupPhone ||
    order.pickup_phone ||
    order.sender_info?.phone ||
    order.sender?.phone ||
    options.activeShopPhone ||
    options.userPhone ||
    '';
  const sender_phone = rawSenderPhone ? String(rawSenderPhone).trim() : '';

  // Địa chỉ người gửi:
  // Ưu tiên địa chỉ của tài khoản VNPost đã lên đơn:
  // 1. Địa chỉ người gửi của chính đơn hàng
  // 2. Địa chỉ từ matched carrier account
  // 3. Địa chỉ từ registry tra cứu theo sender_name
  // 4. Địa chỉ từ options.senderAddress
  // 5. Địa chỉ từ options.lastVnpostSenderInfo?.address
  // 6. Shop address
  const registryAddress = (sender_name && findCarrierAccount(sender_name, accRegistry)?.address) || '';
  const rawSenderAddress = order.senderAddress ||
    order.sender_address ||
    matchedAcc?.address ||
    registryAddress ||
    options.senderAddress ||
    options.sender_address ||
    options.lastVnpostSenderInfo?.address ||
    order.shopAddress ||
    order.shop_address ||
    'BÌNH NINH, P. Điện Bàn Đông, TP. Đà Nẵng';
  const sender_address = rawSenderAddress ? String(rawSenderAddress).trim() : '';

  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  const printTimeFormatted = `${hours}h${minutes} ngày ${day}/${month}/${year}`;

  return {
    paper_size,
    orientation,
    tracking_code,
    order_code,
    barcode_value: barcodeValue,
    carrier,
    carrier_brand_name: carrierBrandName,
    carrier_slogan: carrierSlogan,
    carrier_account: carrierAccount,
    recipient_name: order.customerName || order.recipientName || order.name || 'Khách hàng',
    recipient_phone,
    recipient_address,
    recipient_address_short: addrFormatted.short,
    recipient_address_full: addrFormatted.full,
    routing_line1: routing.line1,
    routing_bcp: routing.bcp,
    service_char: routing.serviceChar,
    cod: codAmount,
    formatted_cod: formatVnd(codAmount),
    note: order.note || order.orderNote || template.instruction_note || template.instructionNote || 'Cho xem hàng; Hàng dễ vỡ, vui lòng nhẹ tay',
    items,
    primary_item_name: primaryItemName,
    sender_name,
    sender_phone,
    sender_address,
    weight_g: order.weight || order.actual_weight || 2000,
    created_date: now.toLocaleDateString('vi-VN'),
    print_time_formatted: printTimeFormatted
  };
}

/**
 * Generate print CSS containing precise @page dimensions and zero margins.
 */
export function getPrintCss(paperSize = 'A6', orientation = 'portrait', margin = '2cm', fontScale = 2.0) {
  const size = (paperSize || 'A6').toUpperCase();
  const dims = PAPER_DIMENSIONS[size] || PAPER_DIMENSIONS.A6;

  const pageWidth = orientation === 'landscape' ? dims.height : dims.width;
  const pageHeight = orientation === 'landscape' ? dims.width : dims.height;
  const marginCss = normalizeMarginCss(margin);

  const isA4 = size === 'A4';
  const isA5 = size === 'A5';

  // Support fontScale multiplier (mặc định 2.0 = chữ to gấp đôi theo yêu cầu người dùng)
  let scale = 2.0;
  if (typeof fontScale === 'number' && fontScale > 0) {
    scale = fontScale;
  } else if (typeof fontScale === 'string') {
    const s = fontScale.toLowerCase().trim();
    if (s === 'normal' || s === '1.0' || s === '100%') scale = 1.0;
    else if (s === 'large' || s === '1.5' || s === '150%') scale = 1.5;
    else if (s === 'double' || s === '2.0' || s === '200%') scale = 2.0;
    else {
      const parsed = parseFloat(s);
      if (!isNaN(parsed) && parsed > 0) scale = parsed;
    }
  }

  // Helper calculating doubled/scaled font size
  const f = (baseA6Px, baseA4Px) => {
    const base = isA4 ? baseA4Px : (isA5 ? (baseA6Px + baseA4Px) / 2 : baseA6Px);
    return `${Math.round(base * scale * 10) / 10}px`;
  };

  const baseFontSize = f(8.5, 11);

  return `
    @page {
      size: ${pageWidth} ${pageHeight};
      margin: 0;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
      color: #000;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      margin: 0;
      padding: 0;
    }
    .label-page {
      width: ${pageWidth};
      height: ${pageHeight};
      padding: ${marginCss};
      page-break-after: always;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;
      font-size: ${baseFontSize};
      line-height: 1.25;
      background: #fff;
      box-sizing: border-box;
      word-break: break-word;
    }
    .vnpost-container {
      width: 100%;
      flex: 1;
      min-height: 0;
      border: 1.5px solid #000;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-sizing: border-box;
      background: #fff;
      word-break: break-word;
    }

    /* ROW 1: HEADER & BARCODE */
    .vnpost-row-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px dotted #000;
      padding: 1.5mm 2.5mm;
      flex-shrink: 0;
    }
    .vnpost-logo-col {
      width: 22%;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      justify-content: center;
    }
    .vnpost-logo-svg {
      width: ${isA4 ? '75px' : '60px'};
      height: ${isA4 ? '36px' : '28px'};
    }
    .vnpost-logo-text {
      font-size: ${f(6.5, 8)};
      font-weight: 900;
      letter-spacing: 0.5px;
      margin-top: 1px;
      font-family: Arial, sans-serif;
    }
    .vnpost-barcode-col {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 0 1.5mm;
    }
    .vnpost-tracking-code {
      font-family: "Courier New", Courier, monospace;
      font-size: ${f(11.5, 14)};
      font-weight: 900;
      letter-spacing: 1px;
      margin-top: 1.5px;
      text-align: center;
    }
    .vnpost-meta-col {
      width: 26%;
      border-left: 1px dotted #000;
      padding-left: 2mm;
      font-size: ${f(8, 10)};
      line-height: 1.3;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .vnpost-meta-account {
      font-size: ${f(8.5, 10.5)};
      font-weight: 800;
      color: #000;
      margin-top: 2px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* ROW 2: ROUTING / HUB */
    .vnpost-row-routing {
      display: flex;
      border-bottom: 1px dotted #000;
      flex-shrink: 0;
    }
    .vnpost-routing-text-col {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: 1.5mm 2.5mm;
      text-align: center;
    }
    .vnpost-routing-line1 {
      font-size: ${f(10.5, 13)};
      font-weight: 800;
      letter-spacing: 0.2px;
    }
    .vnpost-routing-bcp {
      font-size: ${f(14, 17.5)};
      font-weight: 900;
      letter-spacing: 0.5px;
      margin-top: 2px;
    }
    .vnpost-routing-code-box {
      width: ${isA4 ? '22mm' : '17mm'};
      border-left: 1px dotted #000;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: ${f(21, 27)};
      font-weight: 900;
      font-family: Arial, sans-serif;
    }

    /* ROW 3: SENDER & RECIPIENT */
    .vnpost-row-parties {
      display: flex;
      border-bottom: 1px dotted #000;
      flex-shrink: 0;
      font-size: ${f(9, 11)};
      line-height: 1.35;
    }
    .vnpost-sender-col {
      width: 48%;
      padding: 1.5mm 2.5mm;
      overflow: hidden;
      word-break: break-word;
    }
    .vnpost-recipient-col {
      width: 52%;
      border-left: 1px dotted #000;
      padding: 1.5mm 2.5mm;
      overflow: hidden;
      word-break: break-word;
    }
    .vnpost-party-title {
      font-size: ${f(9.5, 11.5)};
      margin-bottom: 2px;
    }
    .vnpost-recipient-highlight {
      font-size: ${f(10, 12)};
      font-weight: 900;
    }

    /* ROW 4: INSTRUCTIONS & ITEMS vs SERVICES & COD & QR */
    .vnpost-row-body {
      display: flex;
      flex: 1;
      min-height: 0;
      border-bottom: 1px dotted #000;
    }
    .vnpost-left-body {
      width: 48%;
      display: flex;
      flex-direction: column;
    }
    .vnpost-instructions {
      padding: 1.5mm 2.5mm;
      border-bottom: 1px dotted #000;
      font-size: ${f(8.5, 10)};
      line-height: 1.25;
      flex-shrink: 0;
    }
    .vnpost-sec-title {
      font-weight: 800;
      font-size: ${f(9.5, 11)};
      margin-bottom: 2px;
    }
    .vnpost-items {
      flex: 1;
      padding: 1.5mm 2.5mm;
      font-size: ${f(8.5, 10)};
      line-height: 1.3;
      overflow: hidden;
      word-break: break-word;
    }
    .vnpost-right-body {
      width: 52%;
      border-left: 1px dotted #000;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 1.5mm 2.5mm;
      font-size: ${f(8.5, 10)};
      line-height: 1.3;
    }
    .vnpost-service-title {
      font-weight: 800;
      font-size: ${f(9, 10.5)};
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    .vnpost-cod-highlight {
      font-size: ${f(10.5, 12.5)};
      font-weight: 900;
      margin: 2px 0;
      color: #000;
    }
    .vnpost-signature-qr-row {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      margin-top: auto;
      padding-top: 1.5mm;
      flex-shrink: 0;
    }
    .vnpost-signature-box {
      border: 1px solid #000;
      padding: 1mm 1.5mm 2.5mm 1.5mm;
      text-align: center;
      font-size: ${f(7.5, 9)};
      width: 60%;
    }
    .vnpost-sig-title {
      font-weight: 700;
      font-size: ${f(8, 9.5)};
    }
    .vnpost-sig-date {
      font-style: italic;
      color: #333;
      margin-top: 1.5px;
    }
    .vnpost-qr-box {
      width: 38%;
      display: flex;
      justify-content: flex-end;
      align-items: flex-end;
    }

    .vnpost-row-footer {
      display: flex;
      flex-direction: column;
      padding: 1mm 2.5mm;
      font-size: ${f(7.5, 9)};
      line-height: 1.25;
      flex-shrink: 0;
    }
    .vnpost-footer-meta {
      display: flex;
      justify-content: space-between;
      font-size: ${f(8, 9.5)};
      margin-bottom: 1px;
    }
    .vnpost-footer-slogan {
      padding-top: 1mm;
      font-size: ${f(7, 8.5)};
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: #111;
      flex-shrink: 0;
    }

    @media screen {
      body {
        background: #525659;
        padding: 0;
        margin: 0;
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      .screen-toolbar {
        position: sticky;
        top: 0;
        z-index: 99999;
        width: 100%;
        background: #323639;
        color: #f1f5f9;
        padding: 10px 24px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
        box-sizing: border-box;
        font-family: system-ui, -apple-system, sans-serif;
      }
      .labels-container {
        padding: 24px 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 24px;
        width: 100%;
      }
      .label-page {
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
        background: #fff;
      }
    }
    @media print {
      .no-print {
        display: none !important;
      }
      body {
        background: #fff;
        padding: 0;
        margin: 0;
      }
      .label-page {
        box-shadow: none;
        margin: 0;
        padding: ${marginCss};
      }
    }
  `;
}

export function renderCarrierLogoHtml(carrier) {
  if (carrier === 'JT') {
    return `
      <div style="display: flex; flex-direction: column; align-items: flex-start; justify-content: center; line-height: 1.1;">
        <span style="font-family: 'Arial Black', Impact, sans-serif; font-size: 19px; font-weight: 900; letter-spacing: -0.5px; color: #000;">J&amp;T</span>
        <span style="font-family: Arial, sans-serif; font-size: 7px; font-weight: 900; letter-spacing: 1px; color: #000; text-transform: uppercase;">EXPRESS</span>
      </div>
    `;
  }
  if (carrier === 'VIETTELPOST') {
    return `
      <div style="display: flex; flex-direction: column; align-items: flex-start; justify-content: center; line-height: 1.1;">
        <span style="font-family: Arial, sans-serif; font-size: 13px; font-weight: 900; letter-spacing: -0.2px; color: #000;">VIETTEL</span>
        <span style="font-family: Arial, sans-serif; font-size: 7.5px; font-weight: 900; letter-spacing: 0.8px; color: #000;">POST</span>
      </div>
    `;
  }
  if (carrier === 'GHTK') {
    return `
      <div style="display: flex; flex-direction: column; align-items: flex-start; justify-content: center; line-height: 1.1;">
        <span style="font-family: 'Arial Black', Arial, sans-serif; font-size: 15px; font-weight: 900; letter-spacing: 0.2px; color: #000;">GHTK</span>
        <span style="font-family: Arial, sans-serif; font-size: 6.5px; font-weight: 800; letter-spacing: 0.4px; color: #000;">TIẾT KIỆM</span>
      </div>
    `;
  }
  return `
    <svg viewBox="0 0 100 45" class="vnpost-logo-svg">
      <path d="M5 25 L25 8 L50 25 L36 29 L25 19 L15 29 Z" fill="#000"/>
      <path d="M25 21 L50 27 L43 32 L25 25 Z" fill="#000"/>
      <path d="M8 27 L25 32 L44 27 L25 37 Z" fill="#000"/>
      <text x="25" y="43" font-family="Arial, Helvetica, sans-serif" font-size="7" font-weight="900" text-anchor="middle" letter-spacing="0.5">VIETNAM POST</text>
    </svg>
  `;
}

/**
 * Render single HTML label string matching official carrier format.
 */
export function renderHtmlLabel(order, template = {}, options = {}) {
  const m = generateLabelModel(order, template, options);

  const barcodeSvg = generateBarcodeSvg(m.barcode_value, 40);
  const qrSvg = generateQrCodeSvg(m.tracking_code !== 'NO_TRACKING' ? m.tracking_code : m.order_code, 64);

  const itemsFormatted = m.items && m.items.length > 0
    ? m.items.map(it => {
        const itName = String(it.name || it || '').trim();
        const itCode = String(it.code || '').trim();
        let nameWithCode = itName;
        if (itCode && !itName.includes(itCode)) {
          nameWithCode = `${itName} (Mã: ${itCode})`;
        } else if (m.order_code && m.order_code !== '—' && !itName.includes(m.order_code)) {
          nameWithCode = `${itName} (Mã: ${m.order_code})`;
        }
        return `${nameWithCode} * ${it.quantity || 1};`;
      }).join(' ')
    : (m.order_code && m.order_code !== '—'
        ? `${m.primary_item_name} (Mã: ${m.order_code}) * 1;`
        : `${m.primary_item_name} * 1;`);

  // Primary item summary for "Nội dung:"
  let contentSummary = m.primary_item_name;
  if (m.order_code && m.order_code !== '—' && !contentSummary.includes(m.order_code)) {
    contentSummary = `${contentSummary} (Mã: ${m.order_code})`;
  }

  const seqIndex = options.index !== undefined ? options.index + 1 : 1;
  const seqTotal = options.total !== undefined ? options.total : 1;

  let serviceTitle = (template.service_title || template.serviceTitle || '').trim();
  if (!serviceTitle) {
    serviceTitle = 'TC TMĐT ĐỒNG GIÁ - HÀNG THÔNG THƯỜNG';
    if (m.carrier === 'JT') {
      serviceTitle = 'J&T EXPRESS - CHUYỂN PHÁT TIÊU CHUẨN';
    } else if (m.carrier === 'VIETTELPOST') {
      serviceTitle = 'VIETTEL POST - DỊCH VỤ CHUYỂN PHÁT';
    } else if (m.carrier === 'GHTK') {
      serviceTitle = 'GIAO HÀNG TIẾT KIỆM - CHUYỂN PHÁT NHANH';
    }
  }

  const showBarcode = template.show_barcode !== false && template.showBarcode !== false;
  const showQr = template.show_qr !== false && template.showQr !== false;
  const showSignature = template.show_signature_box !== false && template.showSignatureBox !== false;
  const showSlogan = template.show_slogan !== false && template.showSlogan !== false;
  const showOrderMeta = template.show_order_meta !== false && template.showOrderMeta !== false;
  const showSender = template.show_sender !== false && template.showSender !== false;

  const logoHtml = renderCarrierLogoHtml(m.carrier);

  return `
    <div class="label-page" style="overflow: hidden; word-break: break-word;">
      <div class="vnpost-container" style="overflow: hidden; word-break: break-word;">
        <!-- ROW 1: HEADER & BARCODE -->
        <div class="vnpost-row-header">
          <div class="vnpost-logo-col">
            ${logoHtml}
          </div>
          <div class="vnpost-barcode-col">
            ${showBarcode ? barcodeSvg : ''}
            <div class="vnpost-tracking-code">${m.tracking_code && m.tracking_code !== 'NO_TRACKING' && m.tracking_code !== '-' ? m.tracking_code : (m.order_code && m.order_code !== '—' ? m.order_code : 'CHƯA CÓ VẬN ĐƠN')}</div>
          </div>
          ${showOrderMeta ? `
          <div class="vnpost-meta-col">
            <div>Lô:</div>
            <div>Thứ tự:</div>
            <div style="word-break: break-all;">Số ĐH: ${m.order_code}</div>
            ${m.carrier_account ? `<div class="vnpost-meta-account">TK: ${m.carrier_account}</div>` : ''}
          </div>` : '<div class="vnpost-meta-col" style="visibility: hidden;"></div>'}
        </div>

        <!-- ROW 2: ROUTING / HUB -->
        <div class="vnpost-row-routing">
          <div class="vnpost-routing-text-col">
            <div class="vnpost-routing-line1">${m.routing_line1}</div>
            <div class="vnpost-routing-bcp">${m.routing_bcp}</div>
          </div>
          <div class="vnpost-routing-code-box">
            <span>${m.service_char}</span>
          </div>
        </div>

        <!-- ROW 3: SENDER & RECIPIENT -->
        <div class="vnpost-row-parties">
          ${showSender ? `
          <div class="vnpost-sender-col">
            <div class="vnpost-party-title"><strong>Từ:</strong> <strong>${m.sender_name}</strong> - SĐT: ${m.sender_phone}</div>
            <div style="color: #111;">${m.sender_address}</div>
          </div>` : `
          <div class="vnpost-sender-col" style="visibility: hidden;"></div>
          `}
          <div class="vnpost-recipient-col">
            <div class="vnpost-party-title"><strong>Đến:</strong> <strong>${m.recipient_name}</strong> - <strong>${m.recipient_phone}</strong></div>
            <div>
              <span class="vnpost-recipient-highlight">${m.recipient_address_short}</span>
              ${m.recipient_address_full && m.recipient_address_full !== m.recipient_address_short ? ` (${m.recipient_address_full})` : ''}
            </div>
          </div>
        </div>

        <!-- ROW 4: INSTRUCTIONS & ITEMS vs SERVICES & COD & QR -->
        <div class="vnpost-row-body">
          <div class="vnpost-left-body">
            <div class="vnpost-instructions">
              <div class="vnpost-sec-title">Chỉ dẫn giao hàng</div>
              <div>- ${m.note}</div>
            </div>
            <div class="vnpost-items">
              <div>- Nội dung: <strong>${contentSummary}</strong></div>
              <div>- Hàng hoá: ${itemsFormatted}</div>
            </div>
          </div>
          <div class="vnpost-right-body">
            <div>
              <div class="vnpost-service-title">${serviceTitle}</div>
              <div style="margin: 2px 0;"><strong>KL (gram): ${m.weight_g} / ***</strong></div>
              <div class="vnpost-cod-highlight"><strong>- COD: ${m.formatted_cod}</strong></div>
              <div>- Thu khác: 0 đ</div>
              <div class="vnpost-cod-highlight"><strong>- Tổng thu: ${m.formatted_cod}</strong></div>
              <div>- Phí huỷ: 0 đ</div>
            </div>

            <div class="vnpost-signature-qr-row">
              ${showSignature ? `
              <div class="vnpost-signature-box">
                <div class="vnpost-sig-title">Chữ kí người nhận</div>
                <div class="vnpost-sig-date">Ngày... Tháng... Năm</div>
              </div>` : '<div style="flex: 1;"></div>'}
              ${showQr ? `
              <div class="vnpost-qr-box">
                ${qrSvg}
              </div>` : ''}
            </div>
          </div>
        </div>

        <!-- ROW 5: FOOTER -->
        <div class="vnpost-row-footer">
          <div class="vnpost-footer-meta">
            <span>Ngày in: ${m.print_time_formatted}</span>
            <span>STT in: ${seqIndex}/${seqTotal}</span>
          </div>
        </div>
      </div>
      ${showSlogan ? `
      <div class="vnpost-footer-slogan">
        ${m.carrier_slogan}
      </div>` : ''}
    </div>
  `;
}

/**
 * Render a complete, standalone, multi-page printable HTML document for bulk orders.
 */
export function renderBulkHtmlDocument(orders = [], template = {}, options = {}) {
  const paper_size = (template.paper_size || options.paper_size || options.paperSize || 'A6').toUpperCase();
  const orientation = template.orientation || options.orientation || 'portrait';
  const margin = template.margin || options.margin || options.printMargin || '2cm';
  const font_scale = template.font_scale !== undefined ? template.font_scale
    : (template.fontScale !== undefined ? template.fontScale
    : (options.font_scale !== undefined ? options.font_scale
    : (options.fontScale !== undefined ? options.fontScale : 2.0)));
  const css = getPrintCss(paper_size, orientation, margin, font_scale);

  const total = orders.length;
  const labelsHtml = orders.map((ord, idx) => renderHtmlLabel(ord, { ...template, paper_size, orientation, margin, font_scale }, { ...options, index: idx, total, font_scale })).join('\n');
  const dimText = paper_size === 'A4' ? '210 x 297 mm' : (paper_size === 'A5' ? '148 x 210 mm' : (paper_size === 'K100' || paper_size === '100X150' ? '100 x 150 mm' : '105 x 148 mm'));

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>In nhãn vận đơn VNPost (${orders.length} nhãn)</title>
  <style id="print-style-sheet">
    ${css}
  </style>
</head>
<body>
  <div class="no-print screen-toolbar">
    <div class="toolbar-info" style="display: flex; flex-direction: column; gap: 4px;">
      <div style="font-weight: 800; font-size: 14px; display: flex; align-items: center; gap: 8px;">
        <span>📄</span>
        <span>Trang in tem vận đơn VNPost chuẩn PDF</span>
        <span style="font-size: 12px; background: #2563eb; color: #fff; padding: 2px 8px; border-radius: 4px; font-weight: 700;">${orders.length} nhãn</span>
      </div>
      <div style="font-size: 12px; color: #cbd5e1; display: flex; align-items: center; flex-wrap: wrap; gap: 10px;">
        <div style="display: flex; align-items: center; gap: 5px;">
          <span>Khổ giấy:</span>
          <select id="tb-paper-size" style="background: #1e293b; color: #f8fafc; border: 1px solid #475569; padding: 3px 6px; border-radius: 4px; font-size: 12px; font-weight: 600; cursor: pointer;">
            <option value="A6" ${paper_size === 'A6' ? 'selected' : ''}>A6 (105 x 148 mm - Chuẩn VNPost)</option>
            <option value="A5" ${paper_size === 'A5' ? 'selected' : ''}>A5 (148 x 210 mm)</option>
            <option value="A4" ${paper_size === 'A4' ? 'selected' : ''}>A4 (210 x 297 mm)</option>
            <option value="K100" ${paper_size === 'K100' || paper_size === '100X150' ? 'selected' : ''}>K100 (100 x 150 mm - Tem nhiệt)</option>
          </select>
          <span id="tb-dim-badge" style="background: #334155; color: #94a3b8; padding: 2px 6px; border-radius: 3px; font-size: 11px;">
            ${dimText}
          </span>
        </div>
        <div style="display: flex; align-items: center; gap: 5px;">
          <span>Canh lề:</span>
          <select id="tb-margin" style="background: #1e293b; color: #f8fafc; border: 1px solid #475569; padding: 3px 6px; border-radius: 4px; font-size: 12px; font-weight: 600; cursor: pointer;">
            <option value="0mm" ${margin === '0mm' || margin === '0' ? 'selected' : ''}>0mm (Sát viền tem)</option>
            <option value="2mm" ${margin === '2mm' ? 'selected' : ''}>2mm (Khuyên dùng K100/A6)</option>
            <option value="5mm" ${margin === '5mm' ? 'selected' : ''}>5mm (Viền gọn gàng)</option>
            <option value="10mm" ${margin === '10mm' || margin === '1cm' ? 'selected' : ''}>10mm (Cách lề 1cm)</option>
            <option value="15mm" ${margin === '15mm' ? 'selected' : ''}>15mm (Cách lề 1.5cm)</option>
            <option value="20mm" ${margin === '20mm' || margin === '2cm' ? 'selected' : ''}>20mm (Cách lề 2cm - Khổ A4/A5)</option>
          </select>
        </div>
        <div style="display: flex; align-items: center; gap: 5px;">
          <span>Cỡ chữ:</span>
          <select id="tb-font-scale" style="background: #1e293b; color: #f8fafc; border: 1px solid #475569; padding: 3px 6px; border-radius: 4px; font-size: 12px; font-weight: 600; cursor: pointer;">
            <option value="2" ${Number(font_scale) === 2 || String(font_scale) === '2' || String(font_scale) === '2.0' ? 'selected' : ''}>Gấp đôi (200% - Rõ to mặc định)</option>
            <option value="1.5" ${Number(font_scale) === 1.5 || String(font_scale) === '1.5' ? 'selected' : ''}>Lớn (150%)</option>
            <option value="1" ${Number(font_scale) === 1 || String(font_scale) === '1' || String(font_scale) === '1.0' ? 'selected' : ''}>Chuẩn (100%)</option>
            <option value="2.5" ${Number(font_scale) === 2.5 || String(font_scale) === '2.5' ? 'selected' : ''}>Cực lớn (250%)</option>
          </select>
        </div>
        <button id="tb-btn-set-default" type="button" style="background: #334155; color: #f1f5f9; border: 1px solid #64748b; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; cursor: pointer;" title="Lưu khổ giấy, lề và cỡ chữ hiện tại làm mặc định">
          ⭐ Đặt làm mặc định
        </button>
      </div>
    </div>
    <div class="toolbar-actions" style="display: flex; align-items: center; gap: 8px;">
      <button id="btn-print" type="button" data-action="print" data-trigger="window.print()" class="btn-print" style="background: #2563eb; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 700; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 6px;">
        🖨️ In ngay / Lưu PDF (Ctrl+P)
      </button>
      <button id="btn-close" type="button" data-action="close" data-trigger="window.close()" class="btn-close" style="background: #475569; color: #f8fafc; border: none; padding: 8px 12px; border-radius: 6px; font-weight: 600; font-size: 13px; cursor: pointer;">
        ✕ Đóng
      </button>
    </div>
  </div>

  <div class="labels-container">
    ${labelsHtml}
  </div>

  <!-- CSP-safe print trigger: window.print() automation and toolbar actions handled externally by wirePrintTabControls -->
</body>
</html>`;
}

const LabelRenderer = {
  PAPER_DIMENSIONS,
  normalizeMarginCss,
  formatVnd,
  generateBarcodeSvg,
  generateQrCodeSvg,
  extractVnpostRouting,
  formatVnpostRecipientAddress,
  generateLabelModel,
  getCarrierAccount,
  findCarrierAccount,
  getPrintCss,
  renderHtmlLabel,
  renderBulkHtmlDocument
};

if (typeof globalThis !== 'undefined') {
  globalThis.LabelRenderer = LabelRenderer;
}

export default LabelRenderer;
