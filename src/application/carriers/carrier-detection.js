/**
 * Carrier Detection & Metadata Utility
 * Phân định chính xác đơn hàng thuộc hãng vận chuyển nào (VNPost, J&T Express...)
 * Dựa trên:
 * 1. Trường platform / carrier lưu trong database
 * 2. Định dạng mã vận đơn (tracking_code) chuẩn của từng nhà vận chuyển
 */

export const CARRIER_IDS = {
  VNPOST: 'vnpost',
  JT: 'jt',
  UNKNOWN: 'unknown'
};

export const CARRIER_METAS = {
  vnpost: {
    id: 'vnpost',
    name: 'Vietnam Post',
    shortName: 'VNPost',
    badgeText: 'VNPost',
    badgeBg: '#fef3c7',
    badgeColor: '#b45309',
    badgeBorder: '#fde68a',
    iconColor: '#f59e0b',
    trackingUrl: (code) => `https://my.vnpost.vn/tra-cuu-hanh-trinh?tracking=${encodeURIComponent(code)}`,
    portalUrl: 'https://my.vnpost.vn',
    hasApiSupport: true,
    actionLabel: 'Tra cứu API'
  },
  jt: {
    id: 'jt',
    name: 'J&T Express',
    shortName: 'J&T',
    badgeText: 'J&T Express',
    badgeBg: '#fee2e2',
    badgeColor: '#b91c1c',
    badgeBorder: '#fca5a5',
    iconColor: '#ef4444',
    trackingUrl: (code) => `https://jtexpress.vn/vi/tracking?billcode=${encodeURIComponent(code)}`,
    portalUrl: 'https://jtexpress.vn',
    hasApiSupport: false,
    actionLabel: 'Tra cứu J&T ↗'
  }
};

/**
 * Nhận diện hãng vận chuyển từ đối tượng đơn hàng hoặc chuỗi mã vận đơn
 * @param {Object|string} orderOrCode
 * @returns {'vnpost'|'jt'|'unknown'}
 */
export function detectOrderCarrier(orderOrCode) {
  if (!orderOrCode) return CARRIER_IDS.VNPOST;

  let platform = '';
  let trackingCode = '';
  let hasVnpostLogs = false;

  if (typeof orderOrCode === 'object') {
    platform = String(orderOrCode.platform || orderOrCode.carrier || orderOrCode.carrier_id || '').toLowerCase().trim();
    trackingCode = String(orderOrCode.tracking_code || orderOrCode.trackingCode || orderOrCode.waybill_code || '').trim();
    if (Array.isArray(orderOrCode.webhook_logs) && orderOrCode.webhook_logs.length > 0) {
      hasVnpostLogs = true;
    }
  } else {
    trackingCode = String(orderOrCode).trim();
  }

  // 1. Kiểm tra trường platform tường minh
  if (platform === 'jt' || platform.includes('j&t') || platform.includes('jtexpress')) {
    return CARRIER_IDS.JT;
  }
  if (platform === 'vnpost' || platform.includes('vietnam post') || platform.includes('buudien')) {
    return CARRIER_IDS.VNPOST;
  }

  const cleanCode = trackingCode.toUpperCase();

  // 2. Nhận diện theo mã vận đơn J&T Express
  // Quy chuẩn J&T Express tại Việt Nam: 12 chữ số (bắt đầu bằng 84..., 85...) hoặc tiền tố JTE
  if (/^84\d{10}$/.test(cleanCode) || /^85\d{10}$/.test(cleanCode) || /^8\d{11}$/.test(cleanCode) || /^JTE\d+/i.test(cleanCode)) {
    return CARRIER_IDS.JT;
  }

  // 3. Nhận diện theo mã vận đơn Vietnam Post (VNPost)
  // Quy chuẩn VNPost S10: 2 ký tự chữ + 9 chữ số + VN (VD: CD377518642VN, MP377518642VN, EA..., EB...)
  if (/[A-Z]{2}\d{9,12}VN$/i.test(cleanCode) || /VN$/i.test(cleanCode) || /^(CD|MP|EB|EA|EM|CP|CV|VT)\d+/i.test(cleanCode)) {
    return CARRIER_IDS.VNPOST;
  }

  // Nếu có log webhook của VNPost
  if (hasVnpostLogs) {
    return CARRIER_IDS.VNPOST;
  }

  // Fallback mặc định
  return CARRIER_IDS.VNPOST;
}

/**
 * Lấy metadata hiển thị của hãng vận chuyển
 * @param {'vnpost'|'jt'|'unknown'} carrierId
 * @returns {typeof CARRIER_METAS.vnpost}
 */
export function getCarrierMeta(carrierId) {
  return CARRIER_METAS[carrierId] || CARRIER_METAS.vnpost;
}

/**
 * Lấy đường dẫn tra cứu hành trình theo hãng
 * @param {'vnpost'|'jt'|'unknown'} carrierId
 * @param {string} trackingCode
 * @returns {string}
 */
export function getCarrierTrackingUrl(carrierId, trackingCode) {
  if (!trackingCode) return '';
  const meta = getCarrierMeta(carrierId);
  return meta.trackingUrl(trackingCode);
}
