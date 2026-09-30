// =========================================================================
// BULK-PARSER.SERVICE.JS — BÓC TÁCH ĐƠN HÀNG LOẠT & XUẤT EXCEL (PHASE 3)
// =========================================================================

(function (global) {
  'use strict';

  /**
   * Phân tách một đoạn văn bản thô chứa nhiều đơn hàng thành từng chunk riêng biệt
   */
  function hasVietnamesePhone(str) {
    if (!str) return false;
    // Chuẩn hóa: loại bỏ dấu ngoặc đơn, ngoặc vuông, khoảng trắng, dấu chấm, gạch ngang
    const clean = str.replace(/[\s\.\-\(\)\[\]]/g, '');
    return /(?:(?:\+84|84|0)[35789]\d{8})/.test(clean);
  }

  function splitRawTextToChunks(rawText) {
    if (!rawText || typeof rawText !== 'string') return [];
    const text = rawText.trim();
    if (!text) return [];

    function splitBlockWithMultipleOrders(block) {
      if (!block) return [];
      const lines = block.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      if (lines.length <= 1) return [block];

      const result = [];
      let current = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const hasPhone = hasVietnamesePhone(line);
        const currentHasPhone = current.some(l => hasVietnamesePhone(l));

        if (hasPhone && currentHasPhone && current.length > 0) {
          // Tìm ranh giới bắt đầu của đơn thứ 2
          let splitIdx = current.length;
          for (let j = current.length - 1; j >= 0; j--) {
            const l = current[j].toLowerCase();
            const isPhone = hasVietnamesePhone(l);
            const isCod = /(?:cod|thu\s*hộ|thu\s*cước|tiền)[:\s]*\d+/i.test(l) || /^\d+k$/i.test(l);
            const isCode = /^[a-z]\d+[\.-]\d+/i.test(l);
            if (isPhone || isCod || isCode) {
              splitIdx = j + 1;
              break;
            }
          }

          if (splitIdx < current.length) {
            const firstChunkLines = current.slice(0, splitIdx);
            const secondChunkLines = current.slice(splitIdx);
            result.push(firstChunkLines.join('\n').trim());
            current = secondChunkLines.concat(line);
          } else {
            result.push(current.join('\n').trim());
            current = [line];
          }
        } else {
          current.push(line);
        }
      }

      if (current.length > 0) {
        result.push(current.join('\n').trim());
      }

      return result.length > 0 ? result : [block];
    }

    // 1. Thử tách theo đường kẻ ngang phân cách rõ ràng (-- hoặc --- hoặc ===)
    const explicitDividerRegex = /(?:^|\r?\n)\s*[-=_*]{2,}\s*(?:\r?\n|$)/;
    if (explicitDividerRegex.test(text)) {
      const explicitParts = text.split(explicitDividerRegex).map(c => c.trim()).filter(Boolean);
      if (explicitParts.length > 1) {
        const subChunks = [];
        for (const part of explicitParts) {
          subChunks.push(...splitRawTextToChunks(part));
        }
        if (subChunks.length > 1) {
          return subChunks;
        }
      }
    }

    // 2. Thử tách theo phân cách khối dòng trống và phân rã các block chứa nhiều đơn
    const rawBlocks = text.split(/(?:\r?\n\s*){2,}/).map(b => b.trim()).filter(Boolean);
    if (rawBlocks.length > 1) {
      const chunks = [];
      for (const block of rawBlocks) {
        const sub = splitBlockWithMultipleOrders(block);
        chunks.push(...sub);
      }
      if (chunks.length > 1) {
        return chunks;
      }
    }

    // 3. Thử tách theo tiền tố đánh số đơn hàng (VD: "Đơn 1:", "Đơn 2:", "1.", "2.", "#1", "#2")
    const orderPrefixRegex = /(?:^|\n)(?=(?:đơn\s*\d+|#\d+|\d+[\.)]|khách\s*\d+)[\s:]+)/i;
    const prefixChunks = text.split(orderPrefixRegex).map(c => c.trim()).filter(Boolean);
    if (prefixChunks.length > 1) {
      return prefixChunks;
    }

    // 4. Tách theo chu trình đơn & số điện thoại Việt Nam trong khối đơn lẻ
    const chunks = splitBlockWithMultipleOrders(text);
    return chunks.length > 0 ? chunks : [text];
  }

  /**
   * Trích xuất số tiền COD từ chuỗi
   */
  function extractCodAmount(text) {
    if (!text) return 0;
    // Tìm các cụm từ chỉ COD miễn phí: "chỉ thu cước", "ko thu", "0đ", "0k"
    if (/(?:chỉ\s+thu\s+cước|ko\s+thu|không\s+thu|\b0\s*(?:đ|k|vnđ)\b)/i.test(text)) {
      return 0;
    }

    const codRegex = /(?:cod|thu\s*hộ|tiền\s*thu|thu|tiền|giá)[\s:]*([0-9.,]+)\s*(k|đ|vnđ|d)?/i;
    const match = text.match(codRegex);
    if (match) {
      let numStr = match[1].replace(/[.,]/g, '');
      let val = parseInt(numStr, 10) || 0;
      if (match[2] && match[2].toLowerCase() === 'k') {
        val *= 1000;
      }
      return val;
    }

    // Thử tìm số tiền dạng 200k, 150k lẻ loi
    const shortK = text.match(/\b(\d{2,4})\s*k\b/i);
    if (shortK) {
      return parseInt(shortK[1], 10) * 1000;
    }

    return 0;
  }

  /**
   * Trích xuất SĐT từ chunk
   */
  function extractPhone(text) {
    if (!text) return '';
    const clean = text.replace(/[\(\)\[\]]/g, ' ');
    const match = clean.match(/(?:(?:\+84|84|0)[35789](?:[\s\.\-]?\d){8})/);
    if (match) {
      let p = match[0].replace(/\D/g, '');
      if (p.startsWith('84') && p.length > 10) p = '0' + p.slice(2);
      return p;
    }
    return '';
  }

  /**
   * Trích xuất tất cả mã đơn hàng nếu có (hỗ trợ nhiều mã trên một đơn)
   */
  function extractOrderCode(text) {
    if (!text) return '';
    const codes = [];
    const explicitRegex = /(?:mã\s*(?:đơn|đh)?|order\s*code|mđh)[\s:#]*([A-Za-z0-9_.-]{3,25})/gi;
    let m;
    while ((m = explicitRegex.exec(text)) !== null) {
      const code = m[1].trim();
      // Bắt buộc phải chứa chữ số (e120.02, p150.12, TAI0001...) và không phải số thuần
      if (/\d/.test(code) && !/^\d+$/.test(code) && !codes.includes(code)) {
        codes.push(code);
      }
    }
    // Bắt các mã đơn độc lập (vd: E100.475, P80.44, E80.344, e135.71, E120.326, TAI0001, TAI0002)
    const standaloneRegex = /(?:^|\n)\s*([A-Za-z]{1,5}\d{1,6}(?:[\.-]\d{1,6})?)\b/g;
    while ((m = standaloneRegex.exec(text)) !== null) {
      const code = m[1].trim();
      if (!codes.includes(code)) codes.push(code);
    }
    const shopCodes = codes.filter(c => !/^[A-Z]{2}\d{9,13}VN$/i.test(c));
    const finalCodes = shopCodes.length > 0 ? shopCodes : codes;
    if (finalCodes.length > 0) return finalCodes.join(', ');
    return '';
  }

  /**
   * Bóc tách một chunk đơn lẻ
   */
  function parseSingleChunk(chunk, index = 1) {
    const phone = extractPhone(chunk);
    const cod = extractCodAmount(chunk);
    const orderCode = extractOrderCode(chunk) || `DH-${Date.now().toString().slice(-4)}-${index}`;

    // Tìm tên và địa chỉ dựa trên các dòng
    const lines = chunk.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    let name = '';
    let address = '';
    let goodsName = '';
    let weightGrams = 200;

    // 1. Trích xuất họ tên
    const nameMatch = chunk.match(/(?:tên\s*người\s*nhận|người\s*nhận\s*hàng|người\s*nhận|tên\s*khách|khách\s*hàng|họ\s*và\s*tên|họ\s*tên|tên|kh)[\s:]+([^\n,]+)/i);
    if (nameMatch) {
      name = nameMatch[1].replace(/^(?:(?:tên\s*)?người\s*nhận|khách|tên)[:\s\-]*/i, '').trim();
    } else if (phone) {
      const beforePhone = chunk.split(phone)[0].replace(/(?:đơn\s*\d+|#\d+|\d+[\.)]|khách\s*\d+)[\s:]*/i, '').replace(/,\s*$/, '').trim();
      const linesBefore = beforePhone.split('\n').map(l => l.trim()).filter(Boolean);
      const nameWithSurname = linesBefore.find(l => /^(?:nguyễn|trần|lê|phạm|huỳnh|hoàng|vũ|võ|đặng|bùi|đỗ|hồ|ngô|dương|lý|đào|đinh|đoàn|mai|trịnh|thái|phan|cao|vương|lại|trương|lâm|phùng|hà|tạ|quách|lương|châu|chu|triệu|lưu|tống|tăng|diệp)\b/iu.test(l));
      if (nameWithSurname && nameWithSurname.length <= 40) {
        name = nameWithSurname;
      } else {
        const lastLineBefore = linesBefore.pop() || '';
        if (lastLineBefore && lastLineBefore.length <= 40 && !/[0-9]{4,}/.test(lastLineBefore)) {
          name = lastLineBefore;
        }
      }
    }

    // 2. Trích xuất hàng hóa / sản phẩm
    const itemMatch = chunk.match(/(?:hàng|sp|sản\s*phẩm|món)[\s:]+([^\n,]+)/i);
    if (itemMatch) {
      goodsName = itemMatch[1].trim();
    }

    // 3. Trích xuất địa chỉ
    const addrMatch = chunk.match(/(?:địa\s*chỉ|đ\/c|đc|nhận\s*tại)[\s:]+([^\n]+)/i);
    if (addrMatch) {
      address = addrMatch[1].trim();
    } else if (phone) {
      const afterPhone = chunk.split(phone)[1] || '';
      const segs = afterPhone.split(/,\s*(?:thu\s*hộ|cod|tiền|giá|sp|hàng|món)[\s:]*/i)[0];
      const cleanAddr = segs.replace(/^[\s,:-]+/, '').trim();
      if (cleanAddr.length >= 8) {
        address = cleanAddr.split('\n')[0].trim();
      }
    }

    // Trọng lượng
    const weightMatch = chunk.match(/(\d+(?:\.\d+)?)\s*(kg|kí|g|gram)\b/i);
    if (weightMatch) {
      const num = parseFloat(weightMatch[1]);
      const unit = weightMatch[2].toLowerCase();
      weightGrams = (unit === 'kg' || unit === 'kí') ? Math.round(num * 1000) : Math.round(num);
    }

    if (!name && lines.length > 0) {
      name = lines[0].replace(phone, '').replace(/(?:đơn\s*\d+|#\d+|\d+[\.)])[\s:]*/i, '').split(',')[0].trim() || 'Khách hàng';
    }

    if (!address) {
      address = chunk.replace(/\r?\n/g, ', ');
    }

    return {
      stt: index,
      orderCode,
      name: name || 'Khách hàng',
      phone: phone || '',
      address: address || chunk.replace(/\r?\n/g, ', '),
      cod,
      goodsName,
      weightGrams,
      weightKg: Number((weightGrams / 1000).toFixed(2)),
      notes: 'Cho xem hàng, không thử',
      rawText: chunk
    };
  }

  /**
   * Bóc tách hàng loạt danh sách đơn hàng có báo cáo tiến trình
   */
  async function parseBulkOrders(rawText, onProgress) {
    const chunks = splitRawTextToChunks(rawText);
    const results = [];
    const total = chunks.length;

    for (let i = 0; i < total; i++) {
      const parsed = parseSingleChunk(chunks[i], i + 1);
      results.push(parsed);

      if (typeof onProgress === 'function') {
        const percent = Math.round(((i + 1) / total) * 100);
        onProgress({ current: i + 1, total, percent, lastParsed: parsed });
      }

      // Cho phép UI render mượt mà giữa các chunk
      if (total > 5) {
        await new Promise(r => setTimeout(r, 10));
      }
    }

    return results;
  }

  /**
   * Xuất file CSV UTF-8 với BOM (\uFEFF) cho VNPost hoặc J&T
   */
  function exportCarrierCsv(orders, carrier = 'vnpost') {
    if (!Array.isArray(orders) || orders.length === 0) return '';

    const escapeCell = (str) => {
      if (str === null || str === undefined) return '""';
      const s = String(str).replace(/"/g, '""');
      return `"${s}"`;
    };

    let headers = [];
    let rows = [];

    if (carrier.toLowerCase() === 'jt') {
      headers = [
        'STT',
        'Mã đơn hàng (Tham chiếu)',
        'Tên người nhận',
        'Điện thoại',
        'Địa chỉ chi tiết',
        'Tên hàng hóa',
        'Khối lượng (kg)',
        'Tiền thu hộ COD (đ)',
        'Ghi chú giao hàng'
      ];

      rows = orders.map((o, idx) => [
        idx + 1,
        escapeCell(o.orderCode || ''),
        escapeCell(o.name || ''),
        escapeCell(o.phone || ''),
        escapeCell(o.address || ''),
        escapeCell(o.goodsName || 'Hàng hóa'),
        escapeCell(o.weightKg || (o.weightGrams ? (o.weightGrams / 1000).toFixed(2) : '0.2')),
        escapeCell(o.cod || 0),
        escapeCell(o.notes || '')
      ]);
    } else {
      // VNPost mặc định
      headers = [
        'STT',
        'Mã đơn khách hàng',
        'Họ tên người nhận',
        'Số điện thoại',
        'Địa chỉ nhận hàng',
        'Nội dung bưu gửi',
        'Khối lượng (gram)',
        'Tiền thu hộ COD',
        'Chỉ dẫn phát'
      ];

      rows = orders.map((o, idx) => [
        idx + 1,
        escapeCell(o.orderCode || ''),
        escapeCell(o.name || ''),
        escapeCell(o.phone || ''),
        escapeCell(o.address || ''),
        escapeCell(o.goodsName || 'Hàng hóa'),
        escapeCell(o.weightGrams || 200),
        escapeCell(o.cod || 0),
        escapeCell(o.notes || 'Cho xem hàng')
      ]);
    }

    // Thêm BOM UTF-8 (\uFEFF) để Excel trên Windows hiển thị đúng tiếng Việt
    const csvContent = '\uFEFF' + [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\r\n');

    return csvContent;
  }

  /**
   * Kích hoạt tải file về máy
   */
  function downloadCsvFile(content, fileName) {
    if (typeof document === 'undefined') return;
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', fileName || `Don_Hang_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  const BulkParserService = {
    splitRawTextToChunks,
    extractCodAmount,
    extractPhone,
    extractOrderCode,
    parseSingleChunk,
    parseBulkOrders,
    exportCarrierCsv,
    downloadCsvFile
  };

  global.BulkParserService = BulkParserService;
  if (typeof globalThis !== 'undefined') {
    globalThis.BulkParserService = BulkParserService;
  }
  if (typeof window !== 'undefined') {
    window.BulkParserService = BulkParserService;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);

