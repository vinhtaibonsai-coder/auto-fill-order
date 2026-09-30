// =========================================================================
// ORDER.VALIDATOR.JS — CHUẨN HÓA & ĐỐI SOÁT ĐƠN HÀNG (PHASE 2)
// =========================================================================

(function (global) {
  'use strict';

  function cleanPhone(phone) {
    if (!phone) return '';
    let p = String(phone).replace(/\D/g, '');
    if (p.startsWith('84') && p.length >= 11) {
      p = '0' + p.slice(2);
    }
    return p;
  }

  function isValidVietnamesePhone(phone) {
    const p = cleanPhone(phone);
    return /^0[35789]\d{8}$/.test(p);
  }

  /**
   * Kiểm tra xem SĐT này đã có đơn hàng nào trong vòng X giờ (mặc định 24h) không.
   * QUY TẮC BẤT BIẾN: Chỉ dùng để hiện cảnh báo (Warning Banner) cho nhân viên,
   * TUYỆT ĐỐI không dùng để merge/ghi đè đơn hàng.
   */
  function checkDuplicatePhone(phone, recentOrders = [], hours = 24) {
    const targetPhone = cleanPhone(phone);
    if (!targetPhone || targetPhone.length < 9) {
      return { isDuplicate: false, matchedOrder: null, hoursAgo: null };
    }

    const now = Date.now();
    const thresholdMs = hours * 60 * 60 * 1000;

    for (const order of recentOrders) {
      if (!order) continue;
      const orderPhone = cleanPhone(order.phone || order.customer_phone || '');
      if (orderPhone !== targetPhone) continue;

      const orderTimeRaw = order.submittedAt || order.submitted_at || order.createdAt || order.created_at || '';
      let orderTime = orderTimeRaw ? new Date(orderTimeRaw).getTime() : 0;
      if (isNaN(orderTime) || orderTime <= 0) {
        orderTime = now - 1000; // coi như gần đây nếu không có timestamp
      }

      const diffMs = now - orderTime;
      if (diffMs <= thresholdMs && diffMs >= 0) {
        const hoursAgo = Math.max(0, Math.round(diffMs / (60 * 60 * 1000)));
        return {
          isDuplicate: true,
          matchedOrder: order,
          orderCode: order.orderCode || order.order_code || '—',
          trackingCode: order.trackingCode || order.tracking_code || '',
          customerName: order.name || order.customer_name || '',
          phone: orderPhone,
          hoursAgo
        };
      }
    }

    return { isDuplicate: false, matchedOrder: null, hoursAgo: null };
  }

  /**
   * Đối soát số điện thoại với danh sách đen (Blacklist / Khách bom hàng)
   */
  function checkBlacklist(phone, blacklist = []) {
    const targetPhone = cleanPhone(phone);
    if (!targetPhone || targetPhone.length < 9 || !Array.isArray(blacklist)) {
      return { isBlacklisted: false, reason: '' };
    }

    for (const item of blacklist) {
      if (!item) continue;
      const itemPhone = typeof item === 'string' ? cleanPhone(item) : cleanPhone(item.phone || item.sdt || '');
      if (itemPhone === targetPhone) {
        const reason = typeof item === 'object' && item.reason ? item.reason : 'Khách hàng có lịch sử bom hàng / cảnh báo';
        return {
          isBlacklisted: true,
          reason,
          phone: targetPhone
        };
      }
    }

    return { isBlacklisted: false, reason: '' };
  }

  /**
   * Đọc số tiền thành chữ tiếng Việt chuẩn kế toán
   * Ví dụ: 350000 -> "Ba trăm năm mươi nghìn đồng"
   * 4500000 -> "Bốn triệu năm trăm nghìn đồng"
   * 0 -> "Không đồng"
   */
  function readVietnameseCurrency(number) {
    const n = Number(number);
    if (isNaN(n) || n === 0) return 'Không đồng';
    if (n < 0) return 'Âm ' + readVietnameseCurrency(-n).toLowerCase();

    const digits = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
    const scales = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];

    function readTriple(c, b, a, isLastGroup) {
      let res = '';
      if (c === 0 && b === 0 && a === 0) return '';

      // Hàng trăm
      if (c !== null) {
        res += digits[c] + ' trăm ';
      }

      // Hàng chục
      if (b === 0) {
        if (a !== 0 && c !== null) res += 'lẻ ';
      } else if (b === 1) {
        res += 'mười ';
      } else {
        res += digits[b] + ' mươi ';
      }

      // Hàng đơn vị
      if (a === 1) {
        if (b > 1) res += 'mốt';
        else res += 'một';
      } else if (a === 4) {
        if (b > 1) res += 'tư';
        else res += 'bốn';
      } else if (a === 5) {
        if (b > 0) res += 'lăm';
        else res += 'năm';
      } else if (a > 0) {
        res += digits[a];
      }

      return res.trim();
    }

    // Tách thành các nhóm 3 số từ phải sang trái
    const str = Math.round(n).toString();
    const groups = [];
    for (let i = str.length; i > 0; i -= 3) {
      groups.push(str.substring(Math.max(0, i - 3), i));
    }

    const groupWords = [];
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i];
      const a = parseInt(g[g.length - 1], 10);
      const b = g.length >= 2 ? parseInt(g[g.length - 2], 10) : 0;
      const c = g.length >= 3 ? parseInt(g[g.length - 3], 10) : (i < groups.length - 1 ? 0 : null);
      
      const tripleText = readTriple(c, b, a, i === groups.length - 1);
      if (tripleText) {
        const scale = scales[i];
        groupWords.unshift(tripleText + (scale ? ' ' + scale : ''));
      }
    }

    let result = groupWords.join(' ').replace(/\s+/g, ' ').trim();
    if (!result) return 'Không đồng';
    result = result.charAt(0).toUpperCase() + result.slice(1) + ' đồng';
    return result;
  }

  /**
   * Trích xuất thông tin COD và các dấu hiệu đơn 0đ từ văn bản đơn thô
   */
  function extractRawCODDetails(rawText) {
    const raw = String(rawText || '').trim();
    if (!raw) {
      return { found: false, amount: 0, explicitZero: false, rawMatched: '' };
    }

    // 1. Kiểm tra từ khóa 0đ rõ ràng (explicit zero)
    // Các dạng: 0đ, 0k, 0d, 0vnd, ck, chuyển khoản, đã ck, đã thanh toán, đã tt, không thu cod, ko thu cod, miễn thu, free cod
    const explicitZeroRegex = /(?:^|[\s,;:\-•|/(])(?:0\s*(?:đ|d|k|vnd)|(?:đã\s*)?(?:ck|chuyển\s*khoản|chuyen\s*khoan|thanh\s*toán|tt)|(?:không|ko|k)\s*thu\s*(?:tiền|hộ|cod)?|miễn\s*(?:thu|tiền|cước)?|free\s*cod)(?:[\s,;:\-•|/)]|$)/iu;
    const hasExplicitZeroWord = explicitZeroRegex.test(raw);

    // 2. Tận dụng OrderProcessor nếu có
    if (typeof globalThis !== 'undefined' && globalThis.OrderProcessor) {
      const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      let foundAmount = 0;
      let explicitZeroFound = globalThis.OrderProcessor.hasStandaloneZeroAmount ? globalThis.OrderProcessor.hasStandaloneZeroAmount(raw, lines) : false;
      if (hasExplicitZeroWord) explicitZeroFound = true;

      for (const line of lines) {
        if (typeof globalThis.OrderProcessor.extractCODFromLine === 'function') {
          const res = globalThis.OrderProcessor.extractCODFromLine(line);
          if (res.found) {
            if (res.explicitZero) explicitZeroFound = true;
            if (res.amount > 0 && foundAmount === 0) {
              foundAmount = res.amount;
            }
          }
        }
      }

      if (foundAmount > 0) {
        return {
          found: true,
          amount: foundAmount,
          explicitZero: foundAmount === 0 || explicitZeroFound,
          rawMatched: ''
        };
      }

      if (explicitZeroFound) {
        return {
          found: true,
          amount: 0,
          explicitZero: true,
          rawMatched: '0đ'
        };
      }
    }

    // Fallback regex độc lập nếu chưa nạp OrderProcessor
    const standaloneZero = /(?:^|[\s,;])0\s*(?:đ|d|vnd|k)(?=[\s,;]|$)/iu.test(raw);
    if (hasExplicitZeroWord || standaloneZero) {
      return { found: true, amount: 0, explicitZero: true, rawMatched: '0đ' };
    }

    const codMatch = raw.match(/(?:cod|thu\s*hộ|thu\s*ho|tiền\s*cod|tien\s*cod|tiền\s*thu|tien\s*thu|tiền|tien)\s*[:\-\s]*([0-9][0-9.,\s]*(?:triệu|trieu|tr)[0-9.,\s]*(?:k|nghìn|ngàn|ngan|đ|d|vnd)?|[0-9][0-9.,\s]*(?:k|nghìn|ngàn|ngan|đ|d|vnd)|[0-9][0-9.,\s]*[a-zA-Z]+|[0-9][0-9.,]*)/iu);
    if (codMatch && codMatch[1]) {
      let parsedAmt = 0;
      if (typeof globalThis !== 'undefined' && globalThis.OrderProcessor && globalThis.OrderProcessor.parseCOD) {
        parsedAmt = globalThis.OrderProcessor.parseCOD(codMatch[1]);
      } else {
        const cleanDigits = codMatch[1].replace(/\D/g, '');
        parsedAmt = cleanDigits ? parseInt(cleanDigits, 10) : 0;
      }
      return { found: true, amount: parsedAmt, explicitZero: parsedAmt === 0, rawMatched: codMatch[0] };
    }

    return { found: false, amount: 0, explicitZero: false, rawMatched: '' };
  }

  /**
   * Kiểm định và đối soát tiền COD giữa Form bưu điện và Đơn thô gốc
   * Phân thành 5 trạng thái theo chuẩn nghiệp vụ kế toán
   */
  function auditCOD(orderData, rawText = '', options = {}) {
    const rawCOD = extractRawCODDetails(rawText);
    
    // Lấy số tiền COD trên form
    let codForm = 0;
    if (orderData && orderData.codAmount !== undefined && orderData.codAmount !== null && orderData.codAmount !== '') {
      codForm = parseInt(String(orderData.codAmount).replace(/\D/g, ''), 10) || 0;
    }

    const userConfirmedZero = Boolean(options.userConfirmedZero || orderData?.codExplicitZero);
    const hasRawText = Boolean(rawText && String(rawText).trim().length > 0);
    const rawHasCOD = rawCOD.found && rawCOD.amount > 0;
    const rawIsExplicitZero = rawCOD.explicitZero;

    // Phân loại 5 trạng thái
    let status = 'NO_COD_WARNING';
    let level = 'warning'; // 'success' | 'warning' | 'danger' | 'info'
    let badge = 'CHƯA CÓ TIỀN COD';
    let title = '';
    let message = '';
    let canProceed = false;
    let suggestedCod = null;

    if (codForm > 0 && (!rawHasCOD || codForm === rawCOD.amount)) {
      // TRƯỜNG HỢP 1: Form có COD và (khớp với đơn thô HOẶC không có đơn thô / lên đơn bằng tay)
      status = 'VALID_MATCH';
      level = 'success';
      badge = rawHasCOD ? '✓ COD KHỚP 100%' : '✓ COD HỢP LỆ';
      title = 'Số tiền COD hợp lệ';
      message = rawHasCOD
        ? `Số tiền COD (${codForm.toLocaleString('vi-VN')} đ) khớp chính xác với nội dung đơn thô.`
        : `Đã nhập số tiền COD (${codForm.toLocaleString('vi-VN')} đ) hợp lệ trên đơn bưu điện.`;
      canProceed = true;
    } else if (codForm > 0 && rawHasCOD && codForm !== rawCOD.amount) {
      // TRƯỜNG HỢP 2: Cả 2 đều có COD nhưng lệch tiền
      status = 'MISMATCH';
      level = 'warning';
      badge = '⚠️ LỆCH TIỀN COD';
      title = 'Số tiền COD trên form khác với đơn thô!';
      message = `Form bưu điện đang nhập: ${codForm.toLocaleString('vi-VN')} đ, nhưng đơn thô ghi: ${rawCOD.amount.toLocaleString('vi-VN')} đ. Vui lòng đối chiếu tránh thu thừa hoặc thiếu tiền của khách!`;
      canProceed = true; // Cho phép nhưng cảnh báo nổi bật
      suggestedCod = rawCOD.amount;
    } else if (codForm === 0 && rawHasCOD && !rawIsExplicitZero) {
      // TRƯỜNG HỢP 3: Nguy hiểm cực độ: Đơn thô có COD nhưng form lại là 0đ/trống
      status = 'CRITICAL_MISSING_COD';
      level = 'danger';
      badge = '🚨 NGUY HIỂM: THIẾU TIỀN COD';
      title = 'Đơn thô có ghi COD nhưng đơn bưu điện đang là 0đ!';
      message = `Phát hiện đơn thô có tiền COD (${rawCOD.amount.toLocaleString('vi-VN')} đ), nhưng trên form bưu điện đang để trống / 0đ! Nếu gửi đi bưu tá sẽ phát miễn phí và bạn sẽ MẤT TRẮNG TIỀN HÀNG.`;
      canProceed = false;
      suggestedCod = rawCOD.amount;
    } else if (codForm === 0 && (rawIsExplicitZero || userConfirmedZero)) {
      // TRƯỜNG HỢP 5: 0đ rõ ràng có xác nhận (explicit zero)
      status = 'EXPLICIT_ZERO';
      level = 'info';
      badge = '✓ MIỄN THU TIỀN (0 Đ)';
      title = 'Đơn hàng không thu tiền (0 đ)';
      message = 'Đã có xác nhận rõ ràng: Miễn thu tiền COD (Khách đã chuyển khoản trước hoặc đơn tặng kèm/bảo hành).';
      canProceed = true;
    } else {
      // TRƯỜNG HỢP 4: Cả hai đều không có COD hoặc lên đơn bằng tay không nhập COD (và chưa được confirm explicit zero)
      status = 'NO_COD_WARNING';
      level = 'warning';
      badge = '⚠️ CHƯA CÓ TIỀN COD';
      title = 'Cảnh báo: Đơn hàng này CHƯA CÓ TIỀN COD (0 đ)!';
      message = hasRawText
        ? 'Cảnh báo: Đơn hàng chưa có tiền COD (nội dung đơn thô không có thông tin thu tiền COD). Vui lòng kiểm tra: Khách đã chuyển khoản trước, hay đây là đơn đổi trả / gửi tặng?'
        : 'Cảnh báo: Đơn hàng chưa có tiền COD (bạn chưa nhập số tiền COD trên đơn bưu điện). Khách đã chuyển khoản trước hay đơn đổi trả / quà tặng?';
      canProceed = false; // Phải nhập COD hoặc click xác nhận đơn 0đ
    }

    return {
      status,
      level,
      badge,
      title,
      message,
      canProceed,
      suggestedCod,
      codForm,
      codRaw: rawCOD.amount,
      rawExplicitZero: rawIsExplicitZero,
      userConfirmedZero,
      spelledOutWords: readVietnameseCurrency(codForm),
      rawSpelledOutWords: rawHasCOD ? readVietnameseCurrency(rawCOD.amount) : '',
      hasRawText
    };
  }

  const OrderValidator = {
    cleanPhone,
    isValidVietnamesePhone,
    checkDuplicatePhone,
    checkBlacklist,
    readVietnameseCurrency,
    extractRawCODDetails,
    auditCOD
  };

  global.OrderValidator = OrderValidator;
  if (typeof globalThis !== 'undefined') {
    globalThis.OrderValidator = OrderValidator;
  }
  if (typeof window !== 'undefined') {
    window.OrderValidator = OrderValidator;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);


