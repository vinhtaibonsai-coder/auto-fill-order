/**
 * Data Quality Engine
 *
 * Implements data quality vector analysis, audited source drill-down,
 * zero-variance reconciliation validation, and strict PII masking.
 */

export const DATA_QUALITY_KPIS = Object.freeze({
  MISSING_TRACKING: 'missing_tracking_code',
  DUPLICATE_CODE: 'invalid_duplicate_order_code',
  LOW_CONFIDENCE_ADDRESS: 'low_confidence_address',
  STALE_CARRIER_STATUS: 'stale_carrier_status',
  UNMATCHED_PAYMENT: 'unmatched_payment'
});

export const DATA_QUALITY_LABELS = Object.freeze({
  [DATA_QUALITY_KPIS.MISSING_TRACKING]: {
    label: 'Thiếu Mã Vận Đơn',
    description: 'Đơn đã xuất bưu cục nhưng chưa có số vận đơn hoặc waybill bị trống',
    severity: 'warning'
  },
  [DATA_QUALITY_KPIS.DUPLICATE_CODE]: {
    label: 'Trùng Lặp Mã Đơn',
    description: 'Nhiều đơn hàng có cùng order_code trong phạm vi cùng một cửa hàng',
    severity: 'critical'
  },
  [DATA_QUALITY_KPIS.LOW_CONFIDENCE_ADDRESS]: {
    label: 'Địa Chỉ Độ Tin Cậy Thấp',
    description: 'Địa chỉ bóc tách không đủ 2 cấp hoặc điểm chuẩn hóa dưới 70 điểm',
    severity: 'warning'
  },
  [DATA_QUALITY_KPIS.STALE_CARRIER_STATUS]: {
    label: 'Trạng Thái Vận Đơn Bị Đóng Băng',
    description: 'Đơn đang luân chuyển nhưng không nhận được tín hiệu cập nhật > 72 giờ',
    severity: 'warning'
  },
  [DATA_QUALITY_KPIS.UNMATCHED_PAYMENT]: {
    label: 'Giao Dịch Thanh Toán Chưa Khớp',
    description: 'Tiền về nhưng không map được shop/đơn hoặc số tiền bị sai lệch',
    severity: 'critical'
  }
});

/**
 * Masks sensitive Customer PII for audit views
 *
 * @param {string} name - Customer full name
 * @param {string} phone - Customer phone number
 * @returns {{ maskedName: string, maskedPhone: string }}
 */
export function maskCustomerPii(name, phone) {
  let maskedName = 'Khách hàng';
  if (name && typeof name === 'string') {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) {
      maskedName = parts[0].length > 2 ? `${parts[0].slice(0, 2)}****` : `${parts[0]}*`;
    } else {
      const first = parts[0];
      const last = parts[parts.length - 1];
      const prefix = first.length > 2 ? first.slice(0, 2) : first;
      maskedName = `${prefix}**** ${last}`;
    }
  }

  let maskedPhone = '09****0000';
  if (phone && typeof phone === 'string') {
    const digits = phone.replace(/\D/g, '');
    if (digits.length >= 6) {
      maskedPhone = `${digits.slice(0, 2)}****${digits.slice(-4)}`;
    } else if (digits.length > 0) {
      maskedPhone = `${digits.slice(0, 2)}****`;
    }
  }

  return { maskedName, maskedPhone };
}

/**
 * Strips raw PII fields and produces sanitized drilldown record
 *
 * @param {Object} rawRecord
 * @returns {Object} Sanitized record with masked PII
 */
export function sanitizeDrilldownRecord(rawRecord = {}) {
  const { customer_name, phone, raw_address, address, street, email, ...safeFields } = rawRecord;
  const { maskedName, maskedPhone } = maskCustomerPii(customer_name, phone);

  return {
    ...safeFields,
    customer_name_masked: maskedName,
    customer_phone_masked: maskedPhone
  };
}

/**
 * Kiểm tra xem chuỗi có phải là mã đơn riêng hợp lệ của shop hay không.
 * Mã đơn hợp lệ phải có cấu trúc (chứa chữ số, độ dài >= 3, không phải thuần số như SĐT hay tiền COD, và không phải thuần chữ như 'caycover').
 *
 * @param {string} code
 * @returns {boolean}
 */
export function isValidShopOrderCode(code) {
  if (!code) return false;
  const str = String(code).trim();
  return str.length >= 3 && /\d/.test(str) && !/^\d+$/.test(str);
}

/**
 * Evaluates the 5 data quality vectors against a dataset
 *
 * @param {Object} params
 * @param {Array<Object>} params.orders - Submitted orders
 * @param {Array<Object>} params.drafts - Draft orders
 * @param {Array<Object>} params.payments - Payment transactions
 * @returns {Object}
 */
export function evaluateDataQualityMetrics({ orders = [], drafts = [], payments = [] }) {
  const now = Date.now();
  const staleThresholdMs = 72 * 3600 * 1000;

  // 1. Missing tracking code
  const missingTracking = orders.filter(o =>
    (!o.tracking_code || String(o.tracking_code).trim() === '') &&
    (o.status === 'submitted' || !o.status)
  ).length;

  // 2. Duplicate order codes within the same shop (chỉ áp dụng với mã riêng có cấu trúc chứa số, vd: e120.02, p150.12, TAI0001...)
  const codeGroups = new Map();
  for (const o of orders) {
    if (!isValidShopOrderCode(o.order_code)) continue;
    const key = `${o.shop_id || 'unknown'}:${String(o.order_code).trim()}`;
    codeGroups.set(key, (codeGroups.get(key) || 0) + 1);
  }

  let duplicateCodes = 0;
  for (const o of orders) {
    if (!isValidShopOrderCode(o.order_code)) continue;
    const key = `${o.shop_id || 'unknown'}:${String(o.order_code).trim()}`;
    if (codeGroups.get(key) > 1) {
      duplicateCodes++;
    }
  }

  // 3. Low confidence address
  const lowConfidenceAddr = drafts.filter(d => {
    const score = d.address_score != null ? Number(d.address_score) : 100;
    const conf = d.confidence != null ? Number(d.confidence) : 1.0;
    const missingUnits = d.ward == null && d.district == null;
    return score < 70 || conf < 0.7 || missingUnits;
  }).length;

  // 4. Stale carrier status (> 72 hours without terminal state)
  const terminalStatuses = new Set(['delivered', 'cancelled', 'returned', 'failed_delivery']);
  const staleCarrier = orders.filter(o => {
    if (!o.tracking_code || !String(o.tracking_code).trim()) return false;
    if (terminalStatuses.has(o.status)) return false;
    const updatedTime = o.updated_at ? new Date(o.updated_at).getTime() : 0;
    return (now - updatedTime) > staleThresholdMs;
  }).length;

  // 5. Unmatched payment transactions
  const unmatchedPayments = payments.filter(p => {
    const unrec = ['unmatched', 'failed', 'duplicate'].includes(p.reconciliation_status);
    const isFailed = p.status === 'FAILED';
    const noShop = !p.shop_id && p.status !== 'CANCELLED';
    return unrec || isFailed || noShop;
  }).length;

  const total = missingTracking + duplicateCodes + lowConfidenceAddr + staleCarrier + unmatchedPayments;

  return {
    missing_tracking_code: missingTracking,
    invalid_duplicate_order_code: duplicateCodes,
    low_confidence_address: lowConfidenceAddr,
    stale_carrier_status: staleCarrier,
    unmatched_payment: unmatchedPayments,
    total_issues: total
  };
}

/**
 * Invariant Check: Verifies that KPI count matches drill-down total with 0 variance
 *
 * @param {number} kpiCount - Expected KPI metric count
 * @param {Object} drilldownResult - Drilldown response with total and records
 * @returns {{ reconciled: boolean, variance: number, kpiCount: number, drilldownTotal: number }}
 */
export function verifyKpiDrilldownReconciliation(kpiCount, drilldownResult) {
  const drilldownTotal = drilldownResult?.total != null
    ? Number(drilldownResult.total)
    : (Array.isArray(drilldownResult?.records) ? drilldownResult.records.length : 0);

  const variance = Math.abs(kpiCount - drilldownTotal);

  return {
    reconciled: variance === 0,
    variance,
    kpiCount,
    drilldownTotal
  };
}

/**
 * Exports sanitized data quality drill-down records to CSV format
 *
 * @param {Array<Object>} records - Sanitized drill-down records
 * @returns {string} CSV text
 */
export function exportDataQualityCsv(records = []) {
  const headers = [
    'Mã Bản Ghi',
    'Cửa Hàng',
    'Mã Đơn Hàng',
    'Mã Vận Đơn',
    'Khách Hàng (Masked)',
    'Số Điện Thoại (Masked)',
    'Loại Vấn Đề',
    'Thời Gian Phát Hiện'
  ];

  const rows = records.map(r => [
    `"${r.record_id || r.id || ''}"`,
    `"${(r.shop_name || r.shop_id || '').replace(/"/g, '""')}"`,
    `"${(r.order_code || '').replace(/"/g, '""')}"`,
    `"${(r.tracking_code || '').replace(/"/g, '""')}"`,
    `"${(r.customer_name_masked || '').replace(/"/g, '""')}"`,
    `"${(r.customer_phone_masked || '').replace(/"/g, '""')}"`,
    `"${(r.issue_description || '').replace(/"/g, '""')}"`,
    `"${r.detected_at || ''}"`
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}
