/**
 * Logic thuần cho tính năng Quick Copy iOS / Webapp (QC-02)
 * Tuyệt đối không phụ thuộc vào React, DOM, clipboard hay storage globals.
 */

export const QUICK_COPY_PRESETS = {
  jt: ['name', 'phone', 'address', 'codAmount', 'orderCode', 'extraNote'],
  vnpost: ['phone', 'name', 'address', 'codAmount', 'orderCode', 'extraNote']
};

export const FIELD_LABELS = {
  name: 'Họ và tên',
  phone: 'Số điện thoại',
  address: 'Địa chỉ giao hàng',
  codAmount: 'Tiền thu hộ COD',
  orderCode: 'Mã đơn hàng',
  extraNote: 'Ghi chú giao hàng'
};

/**
 * Định dạng giá trị sao chép của từng trường
 * @param {string} field - Tên trường ('name', 'phone', 'codAmount', ...)
 * @param {any} value - Giá trị thô
 * @returns {string} - Chuỗi đã chuẩn hóa
 */
export function formatQuickCopyValue(field, value) {
  if (value === undefined || value === null) return '';

  if (field === 'codAmount') {
    if (value === 0 || value === '0') return '0';
    const digitsOnly = String(value).replace(/\D/g, '');
    return digitsOnly || '';
  }

  if (field === 'phone') {
    return String(value).replace(/\D/g, '').trim();
  }

  return String(value).trim();
}

/**
 * Xây dựng danh sách các trường hợp lệ theo hãng vận chuyển để Copy nhanh
 * @param {object} parsedResult - Dữ liệu đơn đã bóc tách
 * @param {string} carrier - 'jt' hoặc 'vnpost'
 * @returns {Array<{ key: string, label: string, value: string }>}
 */
export function buildQuickCopyFields(parsedResult, carrier = 'jt') {
  if (!parsedResult || typeof parsedResult !== 'object') return [];

  const preset = QUICK_COPY_PRESETS[carrier] || QUICK_COPY_PRESETS.jt;
  const fields = [];

  for (const key of preset) {
    const rawValue = parsedResult[key];
    if (rawValue === undefined || rawValue === null || rawValue === '') continue;

    // Đối với codAmount, nếu là số hợp lệ (kể cả 0)
    if (key === 'codAmount') {
      const cleanDigits = String(rawValue).replace(/\D/g, '');
      if (cleanDigits === '' && rawValue !== 0 && rawValue !== '0') continue;
    }

    const formatted = formatQuickCopyValue(key, rawValue);
    if (formatted !== '') {
      fields.push({
        key,
        label: FIELD_LABELS[key] || key,
        value: formatted,
        rawValue
      });
    }
  }

  return fields;
}

/**
 * Định dạng toàn bộ đơn hàng thành văn bản nhiều dòng theo quy chuẩn
 * @param {object} parsedResult 
 * @returns {string}
 */
export function formatFullOrderCopy(parsedResult) {
  if (!parsedResult || typeof parsedResult !== 'object') return '';

  const lines = [];

  if (parsedResult.name && String(parsedResult.name).trim()) {
    lines.push(`Người nhận: ${String(parsedResult.name).trim()}`);
  }

  if (parsedResult.phone && String(parsedResult.phone).trim()) {
    const cleanPhone = String(parsedResult.phone).replace(/\D/g, '').trim();
    if (cleanPhone) lines.push(`SĐT: ${cleanPhone}`);
  }

  if (parsedResult.address && String(parsedResult.address).trim()) {
    lines.push(`Địa chỉ: ${String(parsedResult.address).trim()}`);
  }

  if (parsedResult.orderCode && String(parsedResult.orderCode).trim()) {
    lines.push(`Mã đơn: ${String(parsedResult.orderCode).trim()}`);
  }

  if (parsedResult.codAmount !== undefined && parsedResult.codAmount !== null && parsedResult.codAmount !== '') {
    const cleanCod = formatQuickCopyValue('codAmount', parsedResult.codAmount);
    if (cleanCod !== '') lines.push(`COD: ${cleanCod}`);
  }

  if (parsedResult.extraNote && String(parsedResult.extraNote).trim()) {
    lines.push(`Ghi chú: ${String(parsedResult.extraNote).trim()}`);
  }

  return lines.join('\n');
}

/**
 * Xác định vị trí trường kế tiếp chưa được copy
 * @param {Array} fields - Danh sách fields hợp lệ
 * @param {Set|Array} copiedKeys - Tập hợp các key đã copy
 * @param {number} currentIndex - Vị trí hiện tại
 * @returns {number} - Index của trường tiếp theo hoặc -1 nếu đã copy hết
 */
export function getNextCopyIndex(fields, copiedKeys, currentIndex = 0) {
  if (!Array.isArray(fields) || fields.length === 0) return -1;

  const isCopied = key => {
    if (copiedKeys instanceof Set) return copiedKeys.has(key);
    if (Array.isArray(copiedKeys)) return copiedKeys.includes(key);
    return false;
  };

  // Tìm kiếm từ currentIndex đến hết danh sách
  for (let i = currentIndex; i < fields.length; i++) {
    if (!isCopied(fields[i].key)) {
      return i;
    }
  }

  // Nếu không thấy, tìm vòng lại từ đầu danh sách
  for (let i = 0; i < currentIndex; i++) {
    if (!isCopied(fields[i].key)) {
      return i;
    }
  }

  return -1;
}
