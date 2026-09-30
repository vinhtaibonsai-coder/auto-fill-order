// =========================================================================
// MÔ ĐUN BÓC TÁCH ĐƠN HÀNG (PARSER)
// =========================================================================

const OrderProcessor = {
  parseCOD(text) {
    if (!text) return 0;
    let s = text.toLowerCase().replace(/\s+/g, '');

    s = s.replace(/^(?:cod|tiền|tien|thu\s*hộ|thuho|thu\s*ho|tiềncod|tienco|tiềnthu|tienthu)[:\-\s]*/i, '');

    // 1. Dạng Triệu (vd: "1.8tr", "1tr8", "1tr800", "2.5tr", "2tr500k")
    let normalized = s.replace(/,/g, '.');
    if (normalized.includes('tr') || normalized.includes('triệu') || normalized.includes('trieu')) {
      const cleanText = normalized.replace(/(?:triệu|trieu)/g, 'tr');
      const trIndex = cleanText.indexOf('tr');
      const afterTr = cleanText.substring(trIndex + 2).replace(/k/g, '');
      const cleanNormalized = cleanText.substring(0, trIndex + 2) + afterTr;

      let parts = cleanNormalized.split('tr');
      const numBeforeTr = (parts[0].match(/[\d.]+$/) || [''])[0];
      let val = parseFloat(numBeforeTr) || 0;
      if (parts[1]) {
        const suffix = parts[1].replace(/\D/g, '');
        if (suffix.length === 1) {
          val += parseFloat('0.' + suffix);
        } else if (suffix.length === 2) {
          val += parseFloat('0.' + suffix);
        } else if (suffix.length === 3) {
          val += parseFloat('0.' + suffix);
        } else if (suffix.length >= 4) {
          val += parseFloat(suffix) / 1000000;
        }
      }
      return Math.round(val * 1000000);
    }

    // 2. Dạng nghìn có chữ 'k' (vd: "300k", "1.500k", "250k", "50k")
    if (s.includes('k') || s.includes('nghìn') || s.includes('ngan') || s.includes('ngàn')) {
      let raw = s.replace(/(?:k|nghìn|ngan|ngàn)/g, '').replace(/,/g, '.');
      const numMatch = raw.match(/[\d.]+/);
      if (!numMatch) return 0;
      raw = numMatch[0];
      const grouped = /^\d{1,3}(?:\.\d{3})+$/.test(raw);
      if (grouped) {
        const digits = raw.replace(/\./g, '');
        return Number(digits) * 1000;
      }
      const decimal = parseFloat(raw);
      if (!isNaN(decimal)) {
        return Math.round(decimal * 1000);
      }
      const digitsOnly = raw.replace(/\D/g, '');
      return digitsOnly ? parseInt(digitsOnly, 10) * 1000 : 0;
    }

    // 3. Dạng số có dấu chấm phân cách hàng nghìn (vd: "1.800.000", "300.000", "50.000")
    if (/^\d{1,3}(?:\.\d{3})+$/.test(normalized)) {
      const digits = normalized.replace(/\./g, '');
      return parseInt(digits, 10) || 0;
    }

    // 4. Dạng số nguyên thuần (vd: "300", "250", "850", "50000", "1800000")
    const digits = normalized.replace(/\D/g, '');
    if (!digits) return 0;
    const num = parseInt(digits, 10);
    if (num > 0 && num < 1000) {
      // Số dưới 1000 trong bóc đơn luôn là nghìn đồng (vd: Cod 300 -> 300.000đ, 250 -> 250.000đ)
      return num * 1000;
    }
    if (num >= 1000 && num < 10000 && !normalized.includes('.')) {
      // Số 4 chữ số trong bóc đơn (vd: 1200, 1500) là nghìn đồng (1.200k -> 1.200.000đ)
      return num * 1000;
    }
    return num;
  },

    extractCODFromLine(line) {
      const raw = String(line || '').trim();
      if (!raw) return { found: false, amount: 0 };

      if (/^(?:(?:cod|thu\s*hộ|thu\s*ho|tiền\s*cod|tien\s*cod|tiền\s*thu\s*hộ|tien\s*thu\s*ho|tiền\s*thu|tien\s*thu|tiền|tien)\s*[:\-\s]*)?0\s*(?:k|đ|d|vnd|đồng|dong|[^\d\s])?$/iu.test(raw)) {
        return { found: true, amount: 0, explicitZero: true };
      }

      const match = raw.match(/(?:cod|thu\s*hộ|thu\s*ho|tiền\s*cod|tien\s*cod|tiền\s*thu\s*hộ|tien\s*thu\s*ho|tiền\s*thu|tien\s*thu|tiền|tien)\s*[:\-\s]*([0-9][0-9.,\s]*(?:triệu|trieu|tr)[0-9.,\s]*(?:k|nghìn|ngàn|ngan|đ|d|vnd|đồng|dong)?|[0-9][0-9.,\s]*(?:k|nghìn|ngàn|ngan|đ|d|vnd|đồng|dong)|[0-9][0-9.,\s]*[a-zA-Z]+|[0-9][0-9.,]*)/iu);
      if (match && match[1]) {
        const amount = OrderProcessor.parseCOD(match[1]) || 0;
        return { found: true, amount, explicitZero: amount === 0 };
      }

      const standaloneMatch = raw.match(/^([0-9][0-9.,\s]*(?:triệu|trieu|tr)[0-9.,\s]*(?:k|nghìn|ngàn|ngan|đ|d|vnd|đồng|dong)?|[0-9][0-9.,\s]*(?:k|nghìn|ngàn|ngan|đ|d|vnd|đồng|dong)|[0-9][0-9.,\s]*(?:đ|d|vnd|đồng|dong))\s*$/iu);
      if (standaloneMatch && standaloneMatch[1]) {
        const amount = OrderProcessor.parseCOD(standaloneMatch[1]) || 0;
        return { found: true, amount, explicitZero: amount === 0 };
      }

      // 3. Tìm số tiền kèm đơn vị tiền tệ rõ ràng nằm trong dòng (vd: "Đã lên Cloud 1.100.000đ 🔵 Shop trả cước")
      const currencyMatch = raw.match(/\b([0-9]{1,3}(?:\.[0-9]{3})+|[0-9]+)\s*(?:đ|d|vnd|đồng|dong)(?!\p{L})/iu);
      if (currencyMatch && currencyMatch[1]) {
        const amount = OrderProcessor.parseCOD(currencyMatch[1]) || 0;
        if (amount > 0) {
          return { found: true, amount, explicitZero: false };
        }
      }

      return { found: false, amount: 0 };
    },

    stripCODNoteFromAddress(address) {
      return String(address || '')
        .replace(/(?:[,;\-\s]*)?(?:cod|thu\s*hộ|thu\s*ho|tiền\s*cod|tien\s*cod|tiền\s*thu\s*hộ|tien\s*thu\s*ho|tiền\s*thu|tien\s*thu|tiền|tien)\s*[:\-\s]*(?:[0-9][0-9.,\s]*(?:triệu|trieu|tr)[0-9.,\s]*(?:k|nghìn|ngàn|ngan|đ|d|vnd|đồng|dong)?|[0-9][0-9.,\s]*(?:k|nghìn|ngàn|ngan|đ|d|vnd|đồng|dong)|[0-9][0-9.,\s]*[a-zA-Z]+|[0-9][0-9.,]*)\s*$/iu, '')
        .trim();
    },

    hasStandaloneZeroAmount(text, lines = []) {
      if ((lines || []).some(line => {
        const candidate = OrderProcessor.extractCODFromLine(line);
        return candidate.found && candidate.explicitZero;
      })) return true;

      return /(?:^|[\s,;])0\s*(?:đ|d|vnd|đồng|dong|[^\d\s])(?=\s+(?:vnpost|j\s*&?\s*t|jt|[A-Z]{2}\d{9,13}VN|C[A-Z0-9]{8,13}VN|\d{1,4}\/))/iu.test(String(text || ''));
    },

    extractPhoneNumbers(text) {
      if (!text) return [];
      const normalized = text.replace(/[\u00A0]/g, ' ');
      const unique = [];

      const pushPhone = (phone) => {
        let clean = phone.replace(/\D/g, '');
        if ((clean.startsWith('84') || clean.startsWith('084')) && clean.length >= 11) {
          clean = '0' + clean.slice(clean.startsWith('084') ? 3 : 2);
        }
        if (clean && !unique.includes(clean) && (clean.length === 10 || clean.length === 11)) {
          unique.push(clean);
        }
      };

      const phoneRegex = /(?:\(\+84\)|\+84|\(084\)|084|0)(?:\s*[\.\-]?\s*\d){9,10}(?!\d)/g;
      let match;
      while ((match = phoneRegex.exec(normalized)) !== null) {
        const matchedStr = match[0];
        const matchIndex = match.index;
        
        if (matchIndex > 0 && /\d/.test(normalized[matchIndex - 1])) {
          continue;
        }
        pushPhone(matchedStr);
      }

      const longMatches = normalized.match(/\b0\d{19,43}\b/g) || [];
      longMatches.forEach(longPhone => {
        const clean = longPhone.replace(/\D/g, '');
        const segments = OrderProcessor.segmentPhoneDigits(clean);
        segments.forEach(pushPhone);
      });

      return unique;
    },

    segmentPhoneDigits(digits) {
      function helper(str) {
        if (str.length === 0) return [];
        if (str[0] !== '0') return null;
        for (const len of [10, 11]) {
          if (str.length >= len) {
            const rest = str.slice(len);
            if (rest.length === 0 || rest[0] === '0') {
              const result = helper(rest);
              if (result !== null) return [str.slice(0, len)].concat(result);
            }
          }
        }
        return null;
      }
      return helper(digits) || [];
    },

    preprocessText(text) {
      if (!text) return "";
      let s = text.trim();

      // Chuẩn hóa ký tự tab và dấu hai chấm dính
      s = s.replace(/\t+/g, ' ');
      s = s.replace(/:\s*:/g, ':');

      // Sửa lỗi cú pháp ngoặc đơn lệch dòng (vd: "đạt lưu ) acc diem huong )" -> "đạt lưu ( acc diem huong )")
      s = s.replace(/^([^\(\)\n\r]+?)\)\s*(acc\s+[^\(\)\n\r]+?)\)/gim, '$1 ($2)');

      // 1. Loại bỏ các câu hội thoại cửa miệng của khách hàng mua online (không đụng vào các dòng ghi chú rõ ràng)
      s = s.replace(/(?:^|\s+)(?:shop\s+ơi|bạn\s+ơi|ad\s+ơi|ơi|dạ|ạ)?\s*(?:cho\s+mình|cho\s+em|cho\s+tôi)?\s*(?:gửi|ship|giao|chuyển)\s*(?:cho\s+(?:mình|em|tôi|khách)\s*)?(?:về|đến|tới)\s*(?:địa\s*chỉ\s*)?[:\s\-–•]*/gi, '\nĐịa chỉ: ');
      s = s.replace(/(?<!(?:ghi\s*chú|note|lưu\s*ý)[:\s\-•]*)(?:bọc\s+xốp\s+cẩn\s+thận|bọc\s+cẩn\s+thận|ship\s+nhanh\s+giúp|check\s+inbox\s+shop)\s*(?:giùm\s+(?:mình|em|tôi|shop))?(?:\s+(?:nhé|nha|ạ|ơi|shop))*(?!\p{L})/giu, '');

      // 2. Tách các trường bị dính liền vào nhau (vd: "97Địa chỉ", "97Tên", "97Cod", "0901234567Đc")
      s = s.replace(/(\d{2,4})\s*(địa\s*chỉ(?:\s*chi\s*tiết|\s*nhận\s*hàng)?|đ\/c|đc|dc|address|tên(?:\s*người\s*nhận|\s*khách)?|khách|cod|thu\s*hộ|tiền|mã(?:\s*đơn|\s*đh)?|ghi\s*chú|note)[:\s]*/gi, '$1\n$2: ');
      s = s.replace(/(?:^|\s+)(?:sđt|sdt|đt|dt|tel|phone|lh|liên\s*hệ|điện\s*thoại)[:\s]*(\(?\+?84|\(084\)|0[35789])/gi, '\nSđt: $1');

      // 2.1 Tách số điện thoại dính liền chữ cái tên người nhận (vd: "0348043027võ trần" -> "0348043027 võ trần")
      s = s.replace(/(\b(?:0|\+?84)[35789]\d{8})([a-zA-ZÀ-ỹ])/gu, '$1 $2');

      // 2.2 Tách mã đơn hàng dính liền nhãn COD hoặc thu hộ (vd: "e60.205cod 200k" -> "e60.205 cod 200k")
      s = s.replace(/(\b[A-Za-z0-9][A-Za-z0-9.\-_]*\d)(cod|thu\s*hộ|thuho|tiền|tien|ship|cước)\b/giu, '$1 $2');

      // 2.3 Tách số điện thoại và tên xưng hô nằm ở đuôi địa chỉ trên CÙNG MỘT DÒNG (vd: "...can tho anh binh 0967225599")
      // Không tách nếu đứng trước SĐT là nhãn SĐT/Phone
      s = s.replace(/([^\n\r]+?)[^\S\r\n]+((?:(?:anh|chị|em|c\/|a\/|đ\/c|khách)?[^\S\r\n]+[a-zA-ZÀ-ỹ]{2,20}[^\S\r\n]+)?(?:\(\+84\)|\+84|\(084\)|084|0)(?:[^\S\r\n\.\-]?\d){9,10}\b)/gi, (m, g1, g2) => {
        if (/(?:sđt|sdt|đt|dt|tel|phone|lh|liên\s*hệ)[:\s\-•]*$/i.test(g1.trim())) {
          return m;
        }
        return g1 + '\n' + g2;
      });

      // 3. Nếu văn bản chỉ có 1 dòng (hoặc không có dấu ngắt dòng) nhưng dài và có nhiều thông tin
      const lines = s.split(/\r?\n/).filter(l => l.trim().length > 0);
      if (lines.length <= 2) {
        s = s.replace(/;\s*/g, '\n');
        s = s.replace(/(?:^|\s+)(?:sđt|sdt|đt|dt|tel|phone|lh)[:\s]*((?:\(\+84\)|\+84|\(084\)|084|0)(?:\s*[\.\-]?\s*\d){9,10}\b)/gi, '\nSđt:$1\n');
        s = s.replace(/(?:^|\s+)((?:\(\+84\)|\+84|\(084\)|084|0)(?:\s*[\.\-]?\s*\d){9,10}\b)/g, '\n$1\n');
        s = s.replace(/(?:^|\s+)(địa chỉ|đ\/c|dc|address)[:\s]/gi, '\n$1: ');
        s = s.replace(/(?:^|\s+)(khách hàng|người nhận|tên khách|tên kh|khách|tên)[:\s]/gi, '\n$1: ');
        s = s.replace(/(?:^|\s+)(cod|tiền|thu hộ|tiền cod)[:\s]/gi, '\n$1: ');
        s = s.replace(/(?:^|\s+)(mã đơn|mã đh|mã dh|mã vận đơn|mã order|mã)[:\s]/gi, '\n$1: ');
        s = s.replace(/(?:^|\s+)(chỉ\s*thu\s*cước|thu\s*cước|chỉ\s*thu\s*ship|thu\s*ship)[:\s]*/gi, '\n$1');
      }
      return s;
    },

    detectSenderDisambiguation(lines, context = {}) {
      if (!Array.isArray(lines) || lines.length === 0) {
        return { receiverLines: [], senderLines: [], hasExplicitSenderBlock: false, senderInfo: null };
      }

      const knownCarriers = /^(?:vnpost|vietnam\s*post|bưu\s*điện(?:\s*việt\s*nam)?|j\s*&?\s*t(?:\s*express)?|jt|viettel\s*post|ghtk|giao\s*hàng\s*tiết\s*kiệm|ghn|giao\s*hàng\s*nhanh|ninja\s*van|best\s*express)$/iu;
      const senderHeaderKeywords = /^(?:đã\s*lên\s*cloud|người\s*gửi|bên\s*gửi|từ(?:\s*bưu\s*cục)?|sender|bưu\s*cục(?:\s*gửi)?|kho(?:\s*(?:gửi|xuất|tổng|hàng\s*gửi))|shop\s*gửi|địa\s*chỉ\s*gửi)[:\s\-•]+/iu;
      const receiverHeaderKeywords = /^(?:người\s*nhận(?:\s*hàng)?|bên\s*nhận|gửi\s*(?:đến|tới|cho|về)|đến|tới|receiver|khách(?:\s*hàng)?|tên\s*khách)[:\s\-•]*/iu;

      const shopNameNorm = (context.activeShopName || context.shopName || '').toLowerCase().trim();
      const carrierAccNorm = (context.carrierAccount || '').toLowerCase().trim();

      let splitIndex = -1;
      let senderIsAtBottom = true;

      // Quét tìm vị trí xuất hiện ranh giới khối Người gửi
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const low = line.toLowerCase();

        // 1. Gặp dòng "Đã lên Cloud..."
        if (/đã\s*lên\s*cloud/i.test(low)) {
          splitIndex = i;
          senderIsAtBottom = true;
          break;
        }

        // 2. Gặp tiêu đề carrier độc lập hoặc kèm trạng thái cước: "VNPost", "J&T Express"
        if (knownCarriers.test(low) || /^(?:vnpost|j\s*&?\s*t)\s*$/i.test(low)) {
          splitIndex = i;
          senderIsAtBottom = true;
          break;
        }

        // 3. Gặp nhãn Người gửi rõ ràng
        if (senderHeaderKeywords.test(low)) {
          if (i === 0) {
            senderIsAtBottom = false;
          } else {
            splitIndex = i;
            senderIsAtBottom = true;
            break;
          }
        }

        // 4. Khớp với carrier account (tài khoản bưu điện đang đăng nhập) hoặc tên shop
        if (carrierAccNorm && low === carrierAccNorm && i > 0) {
          splitIndex = i;
          senderIsAtBottom = true;
          break;
        }
      }

      // Khối senderLines tuyệt đối không được chứa mã đơn hàng hoặc tiền COD
      if (splitIndex !== -1 && splitIndex > 0) {
        const potentialSender = lines.slice(splitIndex);
        const hasOrderCodeOrCod = potentialSender.some(l => {
          if (/^[A-Za-z][0-9]{1,4}[\.-][0-9]{1,6}$/i.test(l.trim())) return true;
          const codCheck = OrderProcessor.extractCODFromLine(l);
          return codCheck.found && codCheck.amount > 0;
        });
        if (hasOrderCodeOrCod) {
          return { receiverLines: lines, senderLines: [], hasExplicitSenderBlock: false, senderInfo: null };
        }
      }

      // Trường hợp Người gửi nằm ở ĐẦU văn bản (senderIsAtBottom = false)
      if (!senderIsAtBottom) {
        let receiverStartIndex = -1;
        for (let j = 1; j < lines.length; j++) {
          const lLow = lines[j].toLowerCase().trim();
          if (receiverHeaderKeywords.test(lLow)) {
            receiverStartIndex = j;
            break;
          }
        }
        if (receiverStartIndex !== -1) {
          return {
            receiverLines: lines.slice(receiverStartIndex),
            senderLines: lines.slice(0, receiverStartIndex),
            hasExplicitSenderBlock: true,
            senderInfo: {
              raw: lines.slice(0, receiverStartIndex).join('\n'),
              senderRaw: lines.slice(0, receiverStartIndex).join('\n')
            }
          };
        }
      }

      // Trường hợp Người gửi nằm ở CUỐI văn bản (sau splitIndex)
      if (splitIndex !== -1 && splitIndex > 0) {
        const receiverLines = lines.slice(0, splitIndex);
        const senderLines = lines.slice(splitIndex);
        return {
          receiverLines,
          senderLines,
          hasExplicitSenderBlock: true,
          senderInfo: {
            raw: senderLines.join('\n'),
            senderRaw: senderLines.join('\n')
          }
        };
      }

      // Không tìm thấy khối người gửi rõ ràng: lọc các dòng đơn lẻ khớp tên shop/tài khoản
      const filteredReceiverLines = [];
      const extractedSenderLines = [];
      lines.forEach(l => {
        const low = l.toLowerCase().trim();
        if (carrierAccNorm && (low === carrierAccNorm || low.includes(carrierAccNorm)) && !receiverHeaderKeywords.test(low)) {
          extractedSenderLines.push(l);
        } else if (shopNameNorm && (low === shopNameNorm) && !receiverHeaderKeywords.test(low)) {
          extractedSenderLines.push(l);
        } else {
          filteredReceiverLines.push(l);
        }
      });

      return {
        receiverLines: filteredReceiverLines.length > 0 ? filteredReceiverLines : lines,
        senderLines: extractedSenderLines,
        hasExplicitSenderBlock: extractedSenderLines.length > 0,
        senderInfo: extractedSenderLines.length > 0 ? { raw: extractedSenderLines.join('\n') } : null
      };
    },

    parseCollectFee(text) {
      if (!text) return false;
      const low = text.toLowerCase();

      // Rule 1: Kiểm tra quy tắc PHỦ ĐỊNH trước (Free ship / Đã thanh toán ship)
      const isNegative = /(?:bên\s*bán\s*chịu\s*ship|freeship|free\s*ship|bao\s*ship|đã\s*ck\s*ship|đã\s*chuyển\s*khoản\s*ship|shop\s*chịu\s*ship|không\s*thu\s*ship|miễn\s*phí\s*ship|miễn\s*phí\s*vận\s*chuyển|k\s*thu\s*ship|ko\s*thu\s*ship|0k\s*ship|k\s*ship|ko\s*ship)/i.test(low);
      if (isNegative) return false;

      // Rule 2: Kiểm tra quy tắc KHẲNG ĐỊNH (Thu cước người nhận)
      const isPositive = /(?:\.\s*cước\s*:\s*có|thu\s*ship\s*:\s*có|thu\s*cước\s*:\s*có|có\s*thu\s*ship|có\s*thu\s*cước|\+\s*cước|\+\s*cuoc|\+\s*phí\s*ship|\+\s*ship|người\s*nhận\s*trả\s*ship|khách\s*trả\s*ship|cước\s*người\s*nhận|chỉ\s*thu\s*cước|thu\s*cước|chỉ\s*thu\s*ship|thu\s*ship)/i.test(low);
      return isPositive;
    },

    extractProductItem(lines) {
      let productItem = "";
      const addressKeywords = /(?:ấp|thôn|xóm|xã|huyện|tỉnh|quận|phường|đường|phố|ngõ|ngách|số\s*nhà|tdp|kp|tổ|đội|buôn|bản|chung\s*cư|tòa|khu|vinhomes|city)/i;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // 1. Kiểm tra trường hợp Sản phẩm nằm ở đầu dòng cùng Địa chỉ (vd: "5kg đỗ quyên 13e/28 trương Văn lực,cam lộ...")
        const combinedMatch = line.match(/^(\d+\s*(?:kg|gram|g|hộp|chai|cái|chiếc|bao|túi|lọ|gói|bịch|set|combo|sp|đôi|bộ)\s+[a-zA-ZÀ-ỹ0-9\s]+?)\s+(?=(?:\d+[a-zA-Z]?\/\d+|số\s*\d+|\b(?:đường|phố|ngõ|ngách|số|thôn|xóm|xã|phường|huyện|quận|tỉnh|tp|ấp|kđt|tòa|chung\s*cư)\b|[a-zA-ZÀ-ỹ\s]+,))/i);
        if (combinedMatch && combinedMatch[1]) {
          productItem = combinedMatch[1].trim();
          lines[i] = line.substring(combinedMatch[1].length).trim();
          break;
        }

        // 2. Dòng có tiền tố sản phẩm / đơn hàng (vd: "Hàng: Cây Cover", "SP: Cây cover", "ĐH: Cây Cover", "Đơn hàng: Cây Cover")
        const prefixProductMatch = line.match(/^(?:sản\s*phẩm|sp|hàng\s*hóa|hàng|tên\s*hàng|món|loại\s*hàng|đơn\s*hàng|đh|dh)[:\s\-•]+([a-zA-ZÀ-ỹ0-9\s,._+-]+)$/i);
        if (prefixProductMatch && prefixProductMatch[1]) {
          const cand = prefixProductMatch[1].trim();
          if (!addressKeywords.test(cand) && !/^(sđt|sdt|đt|dt|tel|phone|lh|cod|tiền|thu\s*hộ)/i.test(cand) && !/^\d+$/.test(cand) && cand.length >= 2) {
            productItem = cand;
            break;
          }
        }

        // 3. Kiểm tra dòng đứng độc lập chỉ chứa thông tin sản phẩm (vd: "5kg đỗ quyên", "1 Cây cover", "Cây cover", "Lũa bonsai")
        if (!addressKeywords.test(line) && !/^(sđt|sdt|đt|dt|tel|phone|lh|cod|tiền|thu\s*hộ|chỉ\s*thu\s*cước|thu\s*cước|địa\s*chỉ|đc|đ\/c)/i.test(line)) {
          const matchWithUnit = line.match(/^(\d*\s*(?:kg|gram|g|hộp|chai|cái|chiếc|bao|túi|lọ|gói|bịch|set|combo|sp|đôi|bộ|cây|chậu|bình|cành|gốc|ngọn)\s+[a-zA-ZÀ-ỹ0-9\s]+)/i);
          if (matchWithUnit && matchWithUnit[1]) {
            productItem = matchWithUnit[1].trim();
            break;
          }
          // Dòng chứa tên sản phẩm thực vật thủy sinh / nông sản / hàng hóa phổ biến không có địa chỉ/sđt
          const plantMatch = line.match(/^(?:cây|lũa|rêu|đá|phân|thuốc|hồ|bể|lọc|đèn)\s+[a-zA-ZÀ-ỹ0-9\s]+$/i);
          if (plantMatch && line.trim().length >= 3 && line.trim().length <= 40) {
            productItem = line.trim();
            break;
          }
        }
      }

      return productItem;
    },

    extractOrderCode(text, lines, phones = []) {
      if (!text) return "";
      const orderCodes = [];

      // Từ khóa nhận diện Mã sản phẩm / SKU
      const skuKeywords = /(?:size|màu|mau|xl|xxl|áo|quần|váy|đầm|hộp|chai|cái|chiếc|bao|túi|lọ|sp|sản\s*phẩm|kg|gram|gói|bịch|set|combo)/i;

      // Từ khóa nhận diện Dòng Địa chỉ (Chung cư, Số nhà, Phòng, Tầng, Đường...) để không bóc nhầm số phòng thành mã đơn
      const addressKeywords = /(?:chung\s*cư|căn\s*hộ|toà\s*nhà|tòa\s*nhà|tòa|toà|block|tầng|lầu|phòng|khu\s*đô\s*thị|kđt|đường|phố|ngõ|ngách|hẻm|kiệt|số\s*nhà|thôn|xóm|ấp|bản|tổ|kp|khu\s*phố|xã|phường|quận|huyện|thị\s*xã|thành\s*phố|tp\.|tp\s|tỉnh|hcm|hà\s*nội|hn|đà\s*nẵng)/i;

      const isStandalonePhoneOrCodLine = (line) => {
        const trimmed = String(line || '').trim();
        if (/^(?:cod|thu\s*hộ|ship|cước|tiền)?\s*\d+k?$/i.test(trimmed)) return true;
        let stripped = trimmed.replace(/(?:\(\+84\)|\+84|\(084\)|084|0)(?:[\s\.\-]?\d){9,10}\b/g, '').trim();
        phones.forEach(p => { stripped = stripped.replace(p, '').trim(); });
        stripped = stripped.replace(/^(?:sđt|sdt|đt|dt|tel|phone|lh|liên\s*hệ|điện\s*thoại)[:\-\s]*/i, '').trim();
        stripped = stripped.replace(/^[-\|\:\s\.\,\/]+|[-\|\:\s\.\,\/]+$/g, '').trim();
        return stripped.length === 0;
      };

      const isCandidatePhoneOrCod = (cand) => {
        const clean = String(cand || '').replace(/[\s\.\-]/g, '');
        const digits = String(cand || '').replace(/\D/g, '');
        if (/^(?:0|\+?84)[3|5|7|8|9]\d{8}$/.test(digits) || /^\d{10,11}$/.test(digits)) return true;
        if (phones && phones.some(p => p && clean === p.replace(/\D/g, ''))) return true;
        if (/^(?:cod|thu\s*hộ|ship|cước|tiền)?\s*\d+k?$/i.test(cand)) return true;
        return false;
      };

      // Helper kiểm tra mã đơn riêng hợp lệ của shop:
      // Bắt buộc phải có chữ số (vd: e120.02, p150.12, TAI0001, TAI0002, DH123...)
      // Tuyệt đối không nhận chuỗi chữ thuần không có số như 'caycover', 'Cây Cover', 'bonsai'
      const isValidShopCode = (cand) => {
        if (!cand) return false;
        const str = String(cand).trim();
        if (str.length < 3 || str.length > 30) return false;
        if (!/\d/.test(str)) return false; // PHẢI CHỨA CHỮ SỐ
        if (/^\d+$/.test(str)) return false; // Không phải số thuần (tránh nhầm SĐT/tiền)
        if (/\d+k$/i.test(str)) return false; // Không phải tiền COD như 150k
        if (/^[A-Za-z]\d+\.\d+\.\d+/i.test(str)) return false; // Không phải số phòng căn hộ
        if (skuKeywords.test(str)) return false;
        if (isCandidatePhoneOrCod(str)) return false;
        if (/^(hàng|gửi|tới|số|vận|đơn|cước|ship|thu|cod)$/i.test(str)) return false;
        return true;
      };

      // Ưu tiên 1: Dòng độc lập chỉ chứa duy nhất mã đơn/mã hàng (ví dụ: dòng "E80.290" hoặc "DH-12345" hoặc "Mã: E80.290")
      for (const l of lines) {
        const trimmed = l.trim();
        if (!trimmed) continue;
        if (isStandalonePhoneOrCodLine(trimmed)) continue;

        // Bắt mã đơn theo tiền tố rõ ràng ("mã:", "mã đơn:", "mã đh:", "order:", "dh:")
        const explicitMatch = trimmed.match(/^(?:mã\s*đơn(?:\s*hàng)?(?:\s*là)?|mã\s*đh|mã\s*dh|mã\s*vận\s*đơn|mã\s*order|order\s*id|mã|dh)[:\s\-•]*([a-zA-Z0-9.\-_]{2,25})$/i);
        if (explicitMatch && explicitMatch[1]) {
          const candidate = explicitMatch[1].trim();
          if (isValidShopCode(candidate)) {
            if (!orderCodes.includes(candidate)) orderCodes.push(candidate);
            continue;
          }
        }

        // Dòng đứng độc lập 100% khớp pattern mã (ví dụ: "E80.290", "VN123456789", "JT987654321", "DH100462959", "TAI0001")
        if (!addressKeywords.test(trimmed) && /^[A-Za-z0-9][A-Za-z0-9.\-_]{2,20}$/.test(trimmed)) {
          if (isValidShopCode(trimmed)) {
            if (!orderCodes.includes(trimmed)) orderCodes.push(trimmed);
            continue;
          }
        }
      }

      // Ưu tiên 2: Quét các dòng thông thường nhưng loại trừ dòng địa chỉ và dòng thuần túy SĐT/COD
      lines.forEach(l => {
        const low = l.toLowerCase();

        if (addressKeywords.test(low) || isStandalonePhoneOrCodLine(l)) {
          return;
        }

        if (skuKeywords.test(low) && !/(?:mã\s*đơn|mã\s*đh|mã\s*dh|mã\s*vận\s*đơn|mã\s*order|order\s*id)/i.test(low)) {
          if (!/\b(?:VN[0-9]{8,12}|JT[0-9]{8,12}|DH[-_]?[0-9]{3,10}|ORD[-_]?[0-9]{3,10}|[A-Za-z][0-9]{1,4}[\.-][0-9]{1,6}|[A-Za-z]{1,5}[-_]?[0-9]{2,10})\b/i.test(low)) {
            return;
          }
        }

        // Bắt mã đơn theo tiền tố rõ ràng
        const explicitMatch = l.match(/(?:mã\s*đơn(?:\s*hàng)?(?:\s*là)?|mã\s*đh|mã\s*dh|mã\s*vận\s*đơn|mã\s*order|order\s*id|mã|dh)[:\s\-•]*([a-zA-Z0-9.\-_]{2,25})/i);
        if (explicitMatch && explicitMatch[1]) {
          const candidate = explicitMatch[1].trim();
          if (isValidShopCode(candidate)) {
            if (!orderCodes.includes(candidate)) orderCodes.push(candidate);
            return;
          }
        }

        // Bắt mọi mã đơn đứng trong dòng (kể cả nhiều mã trên cùng 1 dòng, e120.02, p150.12, TAI0001...)
        const codePattern = /\b(VN[0-9]{8,12}|JT[0-9]{8,12}|DH[-_]?[0-9]{3,10}|ORD[-_]?[0-9]{3,10}|[A-Za-z][0-9]{1,4}[\.-][0-9]{1,6}|[A-Za-z]{1,5}[-_]?[0-9]{2,10})\b/gi;
        let match;
        while ((match = codePattern.exec(l)) !== null) {
          const cand = match[1].trim();
          if (isValidShopCode(cand)) {
            if (!orderCodes.includes(cand)) orderCodes.push(cand);
          }
        }
      });

      // Nếu có mã đơn riêng của Shop thì ưu tiên lấy mã đơn của Shop, bỏ qua mã bưu gửi bưu cục (tracking code)
      const shopCodes = orderCodes.filter(c => !/^[A-Z]{2}\d{9,13}VN$/i.test(c));
      const finalCodes = shopCodes.length > 0 ? shopCodes : orderCodes;

      return finalCodes.join(', ');
    },

    extractName(lines, phones, rawText) {
      // Từ điển Họ phổ biến ở Việt Nam
      const vnSurnames = /^(nguyễn|trần|lê|phạm|huỳnh|hoàng|vũ|võ|đặng|bùi|đỗ|hồ|ngô|dương|lý|đào|đinh|đoàn|mai|trịnh|thái|phan|cao|vương|lại|trương|lâm|phùng|hà|tạ|quách|lương|châu|chu|triệu|lưu|tống|tăng|diệp|nguyen|tran|le|pham|huynh|hoang|vu|vo|dang|bui|do|ho|ngo|duong|ly|dao|dinh|doan|mai|trinh|thai|phan|cao|vuong|lai|truong|lam|phung|ha|ta|quach|luong|chau|chu|trieu|luu|tong|tang|diep)\b/iu;
      
      // Từ khóa giao tiếp / câu hội thoại không phải Tên (dùng unicode lookaround (?<!\p{L}) để không dính chữ 'ạ' trong họ Phạm, Tạ, Hạ...)
      const chatterKeywords = /(?:freeship|free\s*ship|bao\s*ship|ship|cho\s*mình|gửi\s*cho|cho\s*xin|check\s*inbox|tư\s*vấn|tách\s*ko|hàng\s*dễ\s*vỡ|xem\s*hàng|đã\s*chuyển\s*khoản|chuyển\s*khoản|giao\s*giờ|(?<!\p{L})(?:nhé|nha|ạ|dạ|shop|ơi)(?!\p{L})|\bfb\b|facebook|zalo|tiktok|instagram)/iu;

      let candidateName = "";

      // Bước 0: Bắt tên đứng ở đầu câu/dòng trước SĐT (vd: "Phương: 0989.935.936", "Vũ Trang - 0962004039")
      for (const l of lines) {
        if (/^(?:fb|facebook|nick\s*fb|page|zalo|tiktok|ig|instagram)[:\s\-]/i.test(l.trim()) || /^fb\s+/i.test(l.trim())) continue;
        const prefixNameMatch = l.match(/^([a-zA-ZÀ-ỹ\s]{2,35})[:;\-–]\s*(?:sđt|sdt|đt|dt|tel|phone|lh)?\s*(?:\+84|84|0)(?:\s*[\.\-]?\s*\d){8,10}\b/i);
        if (prefixNameMatch && prefixNameMatch[1]) {
          let clean = prefixNameMatch[1].trim();
          // Loại bỏ nếu phần bắt match chỉ là nhãn SĐT, địa chỉ, COD (vd: "Sdt: 0982...", "Đc : 84...", "Cod : 0...")
          if (/^(?:sđt|sdt|đt|dt|tel|phone|lh|liên\s*hệ|điện\s*thoại|hotline|zalo|địa\s*chỉ|đ\/c|đc|dc|address|cod|tiền|thu\s*hộ|thu\s*cước|cước|ship|giá)(?:\s*(?:nhận|người\s*nhận|kh|khách|của\s*khách|liên\s*hệ))?$/i.test(clean)) continue;
          clean = clean.replace(/^(khách\s*hàng|người\s*nhận|khách|tên)[:\s]*/i, '').trim();
          clean = clean.replace(/^[-\|\:\s\.\,\/]+|[-\|\:\s\.\,\/]+$/g, '').trim();
          const isAddress = /(?:ấp|thôn|xóm|xã|huyện|tỉnh|quận|phường|đường|phố|ngõ|ngách|số\s*nhà|tdp|kp|cụm|tổ|khu|vinhomes|city|chung\s*cư|tòa|toà)/i.test(clean);
          if (clean.length >= 2 && clean.length <= 40 && !isAddress && !chatterKeywords.test(clean)) {
            return clean;
          }
        }
      }

      // Bước 1: Tìm dòng chứa nhãn tên người nhận rõ ràng ("tên người nhận:", "khách:", "tên:", "người nhận:")
      for (const l of lines) {
        if (/^(?:fb|facebook|nick\s*fb|page|zalo|tiktok|ig|instagram)[:\s\-]/i.test(l.trim()) || /^fb\s+/i.test(l.trim())) continue;
        const nameLabelMatch = l.match(/(?:người\s*nhận\s*hàng|tên\s*người\s*nhận|tên\s*khách\s*hàng|người\s*nhận|tên\s*khách|tên\s*kh\b|khách\s*hàng|họ\s*và\s*tên|họ\s*tên|tên\b|kh\b)[:\s\-•]+([^,;\n]+)/i);
        if (nameLabelMatch && nameLabelMatch[1]) {
          let clean = nameLabelMatch[1].trim();
          clean = clean.split(/\b(?:mã\s*đơn|mã|order|sđt|sdt|đt|dt|tel|phone|lh|cod|tiền|thu\s*hộ|địa\s*chỉ|đc|đ\/c)\b/i)[0].trim();
          clean = clean.replace(/^(?:(?:tên\s*)?người\s*nhận|tên\s*khách|tên|khách)[:\s\-]*/i, '').trim();
          clean = clean.replace(/^(?:anh|chị|em|c\/|a\/|đ\/c|khách)\s+/iu, '').trim();
          clean = clean.replace(/\t+/g, ' ').replace(/\s+/g, ' ');
          clean = clean.replace(/(?:\(\+84\)|\+84|\(084\)|084|0)(?:[\s\.\-]?\d){9,10}\b/g, '');
          phones.forEach(p => { clean = clean.replace(p, ''); });
          clean = clean.replace(/^[-\|\:\s\.\,\/]+|[-\|\:\s\.\,\/]+$/g, '').trim();
          if (clean.length >= 2 && clean.length <= 40 && !chatterKeywords.test(clean)) {
            return clean;
          }
        }
      }

      // Bước 1.1: Ưu tiên dòng tên ngắn nằm sát ngay trên dòng SĐT (vd: "Tuấn vandijk\n0372662492")
      if (phones.length > 0) {
        for (let i = 0; i < lines.length; i++) {
          const l = lines[i];
          if (phones.some(p => l.replace(/\D/g, '').includes(p.replace(/\D/g, '')))) {
            if (i > 0) {
              let prev = lines[i - 1].trim();
              prev = prev.replace(/^(?:(?:tên\s*)?người\s*nhận|tên\s*khách|tên|khách|anh|chị|em|c\/|a\/|đ\/c)[:\s\-•]*/iu, '').trim();
              prev = prev.replace(/\t+/g, ' ').replace(/\s+/g, ' ');
              prev = prev.split(/[\(\[]/)[0].trim();
              const isAddrOrCode = /\d/.test(prev) || /(?:ấp|thôn|xóm|xã|huyện|tỉnh|quận|phường|đường|phố|ngõ|ngách|số\s*nhà|cầu|kho|chung\s*cư|tòa|e\d+[\.-]|cod|tiền|hà\s*nội|hcm|đà\s*nẵng|cần\s*thơ)/i.test(prev);
              const isPhoneOrLabel = /^(?:sđt|sdt|đt|dt|tel|phone|lh|liên\s*hệ|mobile|cod|tiền|cước|người\s*nhận|tên\s*khách|khách|địa\s*chỉ|đc|đ\/c)[:\s\-•]*$/iu.test(prev);
              if (!isAddrOrCode && !isPhoneOrLabel && prev.length >= 2 && prev.length <= 35 && !chatterKeywords.test(prev)) {
                return prev;
              }
            }
          }
        }
      }

      // Bước 1.5: Tìm dòng chứa tên kèm Nick/Acc Facebook (vd: "lại văn vũ ( acc kim sa tùng )", "vu quang anh ( acc diem huong )", "đạt lưu ) acc diem huong )")
      for (const l of lines) {
        const trimmed = l.trim();
        if (/^(?:fb|facebook|zalo|tiktok)[:\s\-]/i.test(trimmed)) continue;
        const accMatch = trimmed.match(/^([a-zA-ZÀ-ỹ0-9\s._-]+?)\s*[\(\[]\s*(?:acc|fb|nick|page|facebook|nhựt|lũa|bonsai|shop)[^)\]]*[)\]]?/i) ||
                         trimmed.match(/^([a-zA-ZÀ-ỹ0-9\s._-]+?)\s*\)\s*(?:acc|fb|nick|page|facebook|nhựt|lũa|bonsai|shop)[^)\]]*[)\]]?/i);
        if (accMatch && accMatch[1]) {
          let clean = accMatch[1].trim();
          clean = clean.replace(/^(?:anh|chị|em|c\/|a\/|đ\/c|khách)\s+/iu, '').trim();
          clean = clean.replace(/\t+/g, ' ').replace(/\s+/g, ' ');
          clean = clean.replace(/(?:\(\+84\)|\+84|\(084\)|084|0)(?:[\s\.\-]?\d){9,10}\b/g, '');
          phones.forEach(p => { clean = clean.replace(p, ''); });
          clean = clean.replace(/^(?:sđt|sdt|đt|dt|tel|phone|lh|liên\s*hệ)[:\-\s]*/i, '').trim();
          clean = clean.replace(/^[-\|\:\s\.\,\/]+|[-\|\:\s\.\,\/]+$/g, '').trim();
          const isAddress = /(?:ấp|thôn|xóm|xã|huyện|tỉnh|quận|phường|đường|phố|ngõ|ngách|số\s*nhà|tdp|kp|khu|vinhomes|city|chung\s*cư|tòa|toà)/i.test(clean);
          if (clean.length >= 2 && clean.length <= 45 && !isAddress && !chatterKeywords.test(clean)) {
            return clean;
          }
        }
      }

      // Bước 2: Tìm dòng bắt đầu bằng Họ tiếng Việt HOẶC có Họ tiếng Việt ở cuối (vd: "Khoa Trần", "Đặng Anh Khôi")
      candidateName = null;
      for (const l of lines) {
        if (/^(?:fb|facebook|nick\s*fb|page|zalo|tiktok|ig|instagram)[:\s\-]/i.test(l.trim()) || /^fb\s+/i.test(l.trim())) continue;
        let clean = l;
        clean = clean.replace(/(?:\(\+84\)|\+84|\(084\)|084|0)(?:[\s\.\-]?\d){9,10}\b/g, '');
        phones.forEach(p => { clean = clean.replace(p, ''); });
        clean = clean.replace(/(?:sđt|sdt|đt|dt|tel|phone|lh|liên\s*hệ)[:\-\s]*/i, '').trim();
        clean = clean.replace(/^[-\|\:\s\.\,\/]+|[-\|\:\s\.\,\/]+$/g, '').trim();

        // Tách phần tên đứng trước ngoặc đơn, dấu phẩy, hoặc tiền tố địa chỉ nếu nằm chung 1 dòng
        let cleanFront = clean.split(/[,\(\-–:]|\b(?:sđt|sdt|đt|dt|tel|phone|lh|địa\s*chỉ|đ\/c|dc|đc|số\s*nhà|thôn|xóm|xã|huyện|tỉnh|quận|phường|đường|phố|ngõ|ngách|ấp)\b/i)[0].trim();
        cleanFront = cleanFront.replace(/^(?:anh|chị|em|c\/|a\/|đ\/c|khách)\s+/iu, '').trim();

        const words = cleanFront.split(/\s+/);
        if (words.length >= 2 && words.length <= 5 && !chatterKeywords.test(cleanFront)) {
          const hasSurname = vnSurnames.test(words[0]) || vnSurnames.test(words[words.length - 1]);
          if (hasSurname) {
            const isAddress = /thôn|xóm|xã|huyện|tỉnh|quận|phường|đường|phố|ngõ|ngách|số\s*nhà|tdp|cụm|khu|tòa|chung\s*cư|kho thuốc/i.test(cleanFront);
            const isCodOrCode = /^(?:cod|thu\s*hộ|tiền|cước|[a-z]\d+[\.-]\d+)/i.test(cleanFront);
            if (!isAddress && !isCodOrCode) {
              candidateName = cleanFront;
              break;
            }
          }
        }
      }

      // Nếu tìm được tên, kiểm tra xem trong các dòng có bản có dấu tiếng Việt chuẩn hơn không (vd: "Thế anh" vs "The Anh")
      if (candidateName) {
        const normCand = candidateName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        for (const l of lines) {
          const trimmed = l.trim().replace(/^(?:anh|chị|em|c\/|a\/|đ\/c|khách)\s+/iu, '').trim();
          const normL = trimmed.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
          if (normL === normCand && /[à-ỹ]/i.test(trimmed) && !/[à-ỹ]/i.test(candidateName)) {
            return trimmed;
          }
        }
        return candidateName;
      }

      // Bước 3: Fallback lấy phần tên nằm chung dòng với SĐT (vd: "0901234567 Nguyễn Văn A", "Hoà Trương 0944.639.639")
      for (const l of lines) {
        if (/^(?:fb|facebook|nick\s*fb|page|zalo|tiktok|ig|instagram)[:\s\-]/i.test(l.trim()) || /^fb\s+/i.test(l.trim())) continue;
        if (phones.some(p => l.replace(/\D/g, '').includes(p.replace(/\D/g, '')))) {
          let clean = l;
          clean = clean.replace(/(?:\(\+84\)|\+84|\(084\)|084|0)(?:[\s\.\-]?\d){9,10}\b/g, '');
          phones.forEach(p => { clean = clean.replace(p, ''); });
          clean = clean.replace(/(?:sđt|sdt|đt|dt|tel|phone|lh|liên\s*hệ)[:\-\s]*/i, '').trim();
          clean = clean.replace(/^(ship|gửi|chuyển|cho|xin|khách|tên)[:\s]*/i, '').trim();
          clean = clean.replace(/^[-\|\:\s\.\,\/]+|[-\|\:\s\.\,\/]+$/g, '').trim();

          const isAddress = /thôn|xóm|xã|huyện|tỉnh|quận|phường|đường|phố|ngõ|ngách|số\s*nhà|tdp|cụm|tổ|khu|vinhomes|ocean\s*park|chung\s*cư|tòa|toà|kđt/i.test(clean);
          const isCodOrCode = /cod|tiền|thu\s*hộ|mã/i.test(clean);

          if (clean && clean.length >= 2 && clean.length <= 35 && !isAddress && !isCodOrCode && !chatterKeywords.test(clean)) {
            return clean;
          }
        }
      }

      // Bước 4: Fallback cuối — lấy dòng đầu tiên không phải SĐT, địa chỉ, COD, mã, tên cửa hàng
      if (!candidateName) {
        const knownLabels = /^(?:sđt|sdt|đt|dt|tel|phone|lh|địa\s*chỉ|đ\/c|dc|đc|cod|tiền\s*thu\s*hộ|tiền|thu\s*hộ|mã\s*đơn|mã\s*vận|mã|order|ship|gửi|cho|kh\b|tên\b|fb\b|facebook|zalo|tiktok|chỉ\s*thu\s*cước|thu\s*cước|cước)(?:[:\s\-•]|$)/i;
        for (const l of lines) {
          let clean = l.replace(/(?:\(\+84\)|\+84|\(084\)|084|0)(?:[\s\.\-]?\d){9,10}\b/g, '');
          phones.forEach(p => { clean = clean.replace(p, ''); });
          clean = clean.replace(/^[-\|\:\s\.\,\/]+|[-\|\:\s\.\,\/]+$/g, '').trim();
          if (clean && clean.length >= 2 && clean.length <= 50 && !knownLabels.test(clean)) {
            const isAddress = (
              /(?:ấp|thôn|xóm|xã|huyện|tỉnh|quận|phường|đường|phố|ngõ|ngách|hẻm|kiệt|số\s*nhà|tdp|kp|khu\s*phố|tổ|đội|buôn|bản|cụm|chung\s*cư|tòa\s*nhà|tòa|toà|khu\s*đô\s*thị|kđt|vinhomes|city|smart\s*city|dự\s*án|building|block|lô|căn\s*hộ|apartment|villa|eco|ecohome|ocean\s*park)/i.test(clean) ||
              /^(?:hà\s*nội|hn|hcm|tp\s*hcm|sài\s*gòn|đà\s*nẵng|hải\s*phòng|cần\s*thơ|bình\s*dương|đồng\s*nai|bắc\s*ninh)\b/i.test(clean) ||
              /(?:hà\s*nội|hn|hcm|tp\s*hcm|sài\s*gòn|đà\s*nẵng|hải\s*phòng|cần\s*thơ|bình\s*dương|đồng\s*nai|bắc\s*ninh)$/i.test(clean) ||
              /^\d+[a-zA-Z]?[\/\.-]/.test(clean) ||
              clean.split(/[,;\-\.]/).filter(part => part.trim().length > 0).length >= 3
            );
            const isCod = /^(cod|thu\s*hộ|tiền|cước|chỉ\s*thu\s*cước|thu\s*cước|thu\s*ship)/i.test(clean);
            const isNumericOnly = /^\d+$/.test(clean);
            const isDistrictOnly = /^(gò\s*vấp|bình\s*thạnh|tân\s*bình|thủ\s*đức|quận\s*\d|huyện\s*|tp\.|tphcm|hà\s*nội|đà\s*nẵng)$/i.test(clean);
            const isTrackingCode = !/\s/.test(clean) && /^(?:[A-Z]{2}\d{9,13}VN|C\d{9,13}VN|MP\d{8,12}VN|E[A-Z]\d{8,12}VN|8\d{11,14}|(?=.*\d)[A-Z0-9]{8,22})$/i.test(clean);
            const isOrderCode = /^[A-Za-z][0-9]{1,4}[\.-][0-9]{1,6}$/.test(clean) || (!/\s/.test(clean) && /\d/.test(clean) && /[A-Za-z]/.test(clean));
            if (!isAddress && !isCod && !isNumericOnly && !isDistrictOnly && !isOrderCode && !isTrackingCode) {
              const cleanNoParen = clean.replace(/\s*\([^)]*\)\s*$/, '').trim();
              candidateName = cleanNoParen || clean;
              break;
            }
          }
        }
      }

      if (candidateName) {
        const normCand = candidateName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        for (const l of lines) {
          const trimmed = l.trim().replace(/^(?:anh|chị|em|c\/|a\/|đ\/c|khách)\s+/iu, '').trim();
          const normL = trimmed.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
          if (normL === normCand && /[à-ỹ]/i.test(trimmed) && !/[à-ỹ]/i.test(candidateName)) {
            return trimmed;
          }
        }
      }

      return candidateName;
    },

    evaluateParseConfidence(result, rawText = '', context = {}) {
      let score = 0;
      const signals = [];
      const warnings = [];

      // 1. Đánh giá Số Điện Thoại (Tối đa 30 điểm)
      const cleanPhone = String(result.phone || '').replace(/\D/g, '');
      if (cleanPhone.length === 10 || cleanPhone.length === 11) {
        score += 25;
        signals.push('SĐT hợp lệ (' + cleanPhone + ')');
        if (/^0(3|5|7|8|9)/.test(cleanPhone)) {
          score += 5;
          signals.push('Đầu số di động Việt Nam chuẩn');
        }
      } else if (cleanPhone.length > 0) {
        score += 10;
        warnings.push('SĐT có độ dài bất thường: ' + cleanPhone);
      } else {
        warnings.push('Thiếu số điện thoại người nhận');
      }

      // 2. Đánh giá Tên Người Nhận (Tối đa 25 điểm)
      const name = String(result.name || '').trim();
      const vnSurnames = /^(nguyễn|trần|lê|phạm|huỳnh|hoàng|vũ|võ|đặng|bùi|đỗ|hồ|ngô|dương|lý|đào|đinh|đoàn|mai|trịnh|thái|phan|cao|vương|lại|trương|lâm|phùng|hà|tạ|quách|lương|châu|chu|triệu|lưu|tống|tăng|diệp)\b/iu;
      if (name && name !== 'không tìm thấy') {
        score += 15;
        signals.push('Tên: ' + name);
        const words = name.split(/\s+/);
        if (words.length >= 2 && words.length <= 5) {
          score += 5;
          signals.push('Độ dài tên chuẩn (' + words.length + ' từ)');
        }
        if (vnSurnames.test(words[0]) || vnSurnames.test(words[words.length - 1])) {
          score += 5;
          signals.push('Nhận diện Họ tiếng Việt');
        }
      } else {
        warnings.push('Chưa nhận diện được tên người nhận');
      }

      // 3. Đánh giá Địa Chỉ Giao Hàng (Tối đa 30 điểm)
      const addr = String(result.address || '').trim();
      if (addr && addr !== 'không tìm thấy') {
        score += 15;
        signals.push('Có địa chỉ giao hàng');
        if (addr.length >= 15) {
          score += 5;
        }
        if (typeof globalThis.AddressParser !== 'undefined' && typeof globalThis.AddressParser.parse === 'function') {
          try {
            const pAddr = globalThis.AddressParser.parse(addr);
            if (pAddr.province) {
              score += 5;
              signals.push('Xác định Tỉnh/TP: ' + pAddr.province);
            }
            if (pAddr.district || pAddr.ward) {
              score += 5;
              signals.push('Khớp cấp Phường/Xã/Quận: ' + (pAddr.ward || pAddr.district));
            }
          } catch (_) {}
        }
      } else {
        warnings.push('Thiếu địa chỉ giao hàng');
      }

      // 4. Đánh giá Tiền Thu Hộ COD & Cước (Tối đa 15 điểm)
      if (result.codAmount > 0) {
        score += 15;
        signals.push('Tiền COD: ' + Number(result.codAmount).toLocaleString('vi-VN') + ' đ');
      } else if (result.codExplicitZero) {
        score += 15;
        signals.push('Xác nhận đơn 0đ / Chuyển khoản');
      } else {
        score += 5;
        warnings.push('Đơn chưa có tiền COD (0đ)');
      }

      // 5. Điểm trừ nếu có dấu hiệu mâu thuẫn / trùng người gửi
      if (context.carrierAccount && name.toLowerCase().includes(context.carrierAccount.toLowerCase())) {
        score = Math.max(0, score - 30);
        warnings.push('CẢNH BÁO: Tên người nhận trùng với tài khoản bưu điện gửi hàng!');
      }

      score = Math.max(0, Math.min(100, score));
      const level = score >= 85 ? 'high' : score >= 60 ? 'medium' : 'low';

      return {
        score,
        level,
        signals,
        warnings,
        isConfident: score >= 85
      };
    },

    parse(rawInputText, parseContext = {}) {
      if (!rawInputText) {
        return {
          name: "", phone: "", address: "không tìm thấy", orderCode: "", orderCodes: [],
          productItem: "", codAmount: 0, collectFee: false, extraPhones: [], extraNote: "",
          codExplicitZero: false, codFound: false, rawText: "",
          confidence: { score: 0, level: 'low', signals: [], warnings: ['Không có dữ liệu đầu vào'] }
        };
      }

      // Preprocess text (Xử lý tin nhắn 1 dòng không ngắt dòng)
      const text = OrderProcessor.preprocessText(rawInputText);
      const allLines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);

      // Phân định Người Gửi vs Người Nhận (Khử hoàn toàn các dòng thông tin bưu cục / người gửi)
      const disambiguation = OrderProcessor.detectSenderDisambiguation(allLines, parseContext);
      const lines = disambiguation.receiverLines && disambiguation.receiverLines.length > 0
        ? disambiguation.receiverLines
        : allLines;

      // 1. Trích xuất SĐT (Ưu tiên tuyệt đối trên các dòng thuộc người nhận)
      const phones = OrderProcessor.extractPhoneNumbers(lines.join('\n'));
      let phone = phones[0] || "";
      const extraPhones = phones.slice(1);

      // Nếu khối người nhận không có SĐT nhưng toàn bài có SĐT không thuộc người gửi
      if (!phone) {
        const fallbackPhones = OrderProcessor.extractPhoneNumbers(text);
        if (fallbackPhones.length > 0) {
          phone = fallbackPhones[0];
        }
      }

      // 2. Trích xuất Tiền cước (collectFee) chuẩn xác theo ngữ cảnh
      const collectFee = OrderProcessor.parseCollectFee(text);

      // 3. Trích xuất Mặt hàng / Sản phẩm (vd: "5kg đỗ quyên")
      const productItem = OrderProcessor.extractProductItem(lines);

      // 4. Trích xuất Mã đơn hàng (Phân biệt với SKU Sản phẩm, loại trừ SĐT và địa chỉ)
      const orderCode = OrderProcessor.extractOrderCode(text, lines, phones);

      // 5. Trích xuất Tên người nhận (Dựa vào Họ VN & từ khóa lọc rác, quét trên khối người nhận)
      let name = OrderProcessor.extractName(lines, phones, text);

      let address = "";
      let codAmount = 0;
      let codExplicitZero = OrderProcessor.hasStandaloneZeroAmount(text, allLines);
      let extraNote = "";

      // Trích xuất Ghi chú MXH & Ghi chú đơn hàng
      allLines.forEach(l => {
        const low = l.toLowerCase().trim();
        if (/^(?:fb|facebook|nick\s*fb|page|zalo|tiktok|ig|instagram|ghi\s*chú|note|lưu\s*ý)[:\s\-]/i.test(low) || /^fb\s+/i.test(low)) {
          const noteText = l.replace(/^(?:ghi\s*chú|note|lưu\s*ý)[:\s\-]*/i, '').trim() || l.trim();
          if (!extraNote) extraNote = noteText;
          else if (!extraNote.includes(noteText)) extraNote += ', ' + noteText;
        }
      });

      // 6. Duyệt dòng để trích xuất COD (quét trên allLines để không sót COD ở dòng trạng thái)
      allLines.forEach(l => {
        const low = l.toLowerCase();
        const lineCodCandidate = OrderProcessor.extractCODFromLine(l);
        if (lineCodCandidate.found) {
          if (lineCodCandidate.explicitZero) {
            codExplicitZero = true;
            codAmount = 0;
          } else if (!codExplicitZero && lineCodCandidate.amount > 0 && codAmount === 0) {
            codAmount = lineCodCandidate.amount;
          }
        }
        if (low.includes('cod') || low.includes('thu hộ') || (low.includes('tiền') && /\d/.test(low))) {
          const codCandidate = OrderProcessor.extractCODFromLine(l);
          if (codCandidate.found) {
            if (codCandidate.explicitZero) {
              codExplicitZero = true;
              codAmount = 0;
            } else if (!codExplicitZero && codCandidate.amount > 0 && codAmount === 0) {
              codAmount = codCandidate.amount;
            }
          }
        }
      });

      // 7. Duyệt dòng để trích xuất Địa chỉ (CHỈ DUYỆT TRÊN KHỐI NGƯỜI NHẬN - BỎ QUA NGƯỜI GỬI)
      lines.forEach(l => {
        const low = l.toLowerCase();

        // Bỏ qua dòng nếu dòng bắt đầu bằng nhãn Người nhận / Tên khách
        if (/^(?:người\s*nhận|tên\s*khách|khách\s*hàng|họ\s*tên|tên\s*người\s*nhận)[:\s\-•]/i.test(l) && !/(?:địa\s*chỉ|đ\/c|đc|dc)/i.test(l)) {
          return;
        }

        // Bỏ qua dòng nếu dòng đó chỉ chứa Tên người nhận và/hoặc Số điện thoại
        let tempLine = l.trim().toLowerCase().replace(/\t+/g, ' ').replace(/\s+/g, ' ');
        if (name) {
          tempLine = tempLine.replace(name.toLowerCase().trim(), '');
        }
        phones.forEach(p => {
          tempLine = tempLine.replace(p.toLowerCase().trim(), '');
        });
        tempLine = tempLine.replace(/(?:\+84|84|0)(?:[\s\.\-]?\d){9,10}\b/g, '');
        tempLine = tempLine.replace(/^(?:sđt|sdt|đt|dt|tel|phone|lh|liên\s*hệ|người\s*nhận|tên\s*khách|khách\s*hàng|tên|họ\s*tên|kh)[:\s\-•,]+/i, '').trim();
        tempLine = tempLine.replace(/^(?:anh|chị|em|c\/|a\/|bác|chú|cô)\s+/iu, '').trim();
        tempLine = tempLine.replace(/^[-\|\:\s\.\,\/]+|[-\|\:\s\.\,\/]+$/g, '').trim();
        if (tempLine.length === 0) {
          return;
        }

        // Bỏ qua dòng nếu dòng đó là mã đơn hàng hoặc SKU
        const cleanTrimmed = l.trim();
        const individualCodes = orderCode ? orderCode.split(/[,;\s]+/).map(c => c.trim().toLowerCase()).filter(Boolean) : [];
        if (orderCode && (cleanTrimmed.toLowerCase() === orderCode.toLowerCase() || tempLine === orderCode.toLowerCase() || individualCodes.includes(cleanTrimmed.toLowerCase()) || individualCodes.includes(tempLine))) {
          return;
        }
        if (/^[A-Za-z][0-9]{1,4}[\.-][0-9]{1,6}$/i.test(cleanTrimmed)) {
          return;
        }

        // Bỏ qua dòng nếu là dòng tên mạng xã hội (vd: "quan tran ( acc kim sa tùng )")
        if (/[\(\[]\s*(?:acc|fb|nick|page|facebook|nhựt|lũa|bonsai|shop)[^)\]]*[)\]]?/i.test(l) ||
            /\)\s*(?:acc|fb|nick|page|facebook|nhựt|lũa|bonsai|shop)[^)\]]*[)\]]?/i.test(l)) {
          return;
        }

        // Trích xuất Địa chỉ
        let hasProvinceAlias = false;
        if (typeof ADM_DB !== 'undefined' && ADM_DB.provinces) {
          hasProvinceAlias = ADM_DB.provinces.some(p => {
            return p.aliases.some(a => {
              const regex = new RegExp('\\b' + a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
              return regex.test(low);
            }) || low.includes(p.name.toLowerCase());
          });
        }

        const isAddressByProvince = hasProvinceAlias && (
          /\d/.test(l) || 
          l.includes(',') || 
          /(?<!\p{L})(?:ấp|thôn|xóm|xã|huyện|tỉnh|quận|phường|đường|phố|ngõ|ngách|số\s*nhà|tdp|khu\s*phố|kp|tổ|đội|buôn|bản|cụm|chung\s*cư|tòa\s*nhà|tòa|toà|khu\s*đô\s*thị|kđt|vinhomes|city|smart\s*city|dự\s*án|building|block|lô|căn\s*hộ|apartment|villa|duong|phuong|quan|huyen|tinh|tp|thanh\s*pho|ap|thon|xom|xa|so\s*nha)(?!\p{L})/iu.test(l) ||
          l.split(/\s+/).length >= 2
        );

        const isAddressLine = (
          /(?:địa\s*chỉ(?:\s*chi\s*tiết)?|đ\/c|đc|dc|address)[\s:;\-–•]/i.test(l) ||
          /(?<!\p{L})(?:ấp|thôn|xóm|xã|huyện|tỉnh|quận|phường|đường|phố|ngõ|ngách|số\s*nhà|tdp|khu\s*phố|kp|tổ|đội|buôn|bản|cụm|chung\s*cư|tòa\s*nhà|tòa|toà|khu\s*đô\s*thị|kđt|vinhomes|city|smart\s*city|dự\s*án|building|block|lô|căn\s*hộ|apartment|villa|duong|phuong|quan|huyen|tinh|tp|thanh\s*pho|ap|thon|xom|xa|so\s*nha)(?!\p{L})/iu.test(l) ||
          (/^[pq](?:\.|\s+)(?:[a-zA-ZÀ-ỹ\d]|\d{1,2}\b)/i.test(cleanTrimmed) && !/^[A-Za-z]\d+[\.-]\d+$/i.test(cleanTrimmed)) ||
          l.split(',').filter(part => part.trim().length > 0).length >= 3 ||
          isAddressByProvince
        );

        if (isAddressLine) {
          let ca = l;
          const addressLabelMatch = l.match(/^(?:[\s\-\–•]*)(?:địa\s*chỉ\s*chi\s*tiết|địa\s*chỉ\s*nhận\s*hàng|địa\s*chỉ|đ\/c|đc|dc|address|chi\s*tiết)[:\s\-•]+\s*(.*)/i);
          if (addressLabelMatch && addressLabelMatch[1]) {
            ca = addressLabelMatch[1].trim();
          } else {
            ca = ca.replace(/^(?:địa\s*chỉ\s*chi\s*tiết|địa\s*chỉ\s*nhận\s*hàng|địa\s*chỉ|đ\/c|đc|dc|sđt|sdt|đt|dt|tel|phone|lh|liên\s*hệ|chi\s*tiết)\s*:?\s*/gi, '').trim();
          }
          ca = ca.replace(/^(?:shop\s+ơi|bạn\s+ơi|ad\s+ơi|ơi|dạ|ạ)?\s*(?:gửi\s+cho\s+(?:mình|em|tôi)|gửi|ship|giao|chuyển)?\s*(?:cho\s+(?:mình|em|tôi|khách))?\s*(?:đến|về|tới)?\s*(?:địa\s*chỉ\s*)?[:\s\-•]*/gi, '').trim();
          ca = ca.replace(/(?:\(\+84\)|\+84|\(084\)|084|0)(?:[\s\.\-]?\d){9,10}\b/g, '');
          phones.forEach(p => { ca = ca.replace(p, ''); });
          ca = ca.replace(/[\s\.\,\-\–•]*(?:sđt|sdt|đt|dt|tel|phone|lh|liên\s*hệ|zalo|hotline)[:\s\-•]*$/gi, '').trim();
          ca = ca.replace(/\s+(?:anh|chị|em|c\/|a\/|đ\/c|khách)\s+[a-zA-ZÀ-ỹ]{2,20}\s*$/iu, '').trim();
          ca = ca.replace(/\s+(?:anh|chị|em)\s*$/iu, '').trim();

          // Chuẩn hóa prefix
          ca = ca.replace(/^Q(?:\.|\s+)(\d+|[a-zA-ZÀ-ỹ][a-zA-ZÀ-ỹ\s]*)/i, (m, g) => 'Quận ' + g.trim());
          ca = ca.replace(/^P(?:\.|\s+)(\d+|[a-zA-ZÀ-ỹ\d][a-zA-ZÀ-ỹ\s\d]*)/i, (m, g) => 'Phường ' + g.trim());
          ca = ca.replace(/^H(?:\.|\s+)([a-zA-ZÀ-ỹ][a-zA-ZÀ-ỹ\s]*)/i, (m, g) => 'Huyện ' + g.trim());
          ca = ca.replace(/^TX(?:\.|\s+)([a-zA-ZÀ-ỹ][a-zA-ZÀ-ỹ\s]*)/i, (m, g) => 'Thị xã ' + g.trim());
          ca = ca.replace(/^TP(?:\.|\s+)([a-zA-ZÀ-ỹ][a-zA-ZÀ-ỹ\s]*)/i, (m, g) => 'TP. ' + g.trim());
          ca = ca.replace(/^X(?:\.|\s+)([a-zA-ZÀ-ỹ][a-zA-ZÀ-ỹ\s]*)/i, (m, g) => 'Xã ' + g.trim());
          ca = ca.replace(/^TT(?:\.|\s+)([a-zA-ZÀ-ỹ][a-zA-ZÀ-ỹ\s]*)/i, (m, g) => 'Thị trấn ' + g.trim());

          ca = ca.replace(/\bduong\s+/gi, 'Đường ');
          ca = ca.replace(/\bphuong\s+/gi, 'Phường ');
          ca = ca.replace(/(?<!(?:ngõ|ngo|ngách|ngach|hẻm|hem|kiệt|kiet|đường|duong|phố|pho|thôn|thon|xóm|xom|ấp|ap|bản|ban|tổ|to|cụm|cum|đội|doi|chợ|cho|chùa|chua|đền|den|miếu|mieu|khu|tòa|toà|toa|chung\s*cư|chung\s*cu|số\s*nhà|so\s*nha|số|so)\s+)\bquan\s+(?!(?:hoa|nhân|thánh|âm|thổ|họ|quán|lạn|triều|chánh|tiến)\b)/gi, 'Quận ');
          ca = ca.replace(/\bhuyen\s+/gi, 'Huyện ');
          ca = ca.replace(/\btp\s+can\s+tho\b/gi, 'TP. Cần Thơ');
          ca = ca.replace(/\btp\s+ho\s+chi\s+minh\b/gi, 'TP. Hồ Chí Minh');
          ca = ca.replace(/\btp\s+da\s+nang\b/gi, 'TP. Đà Nẵng');
          ca = ca.replace(/\btp\s+hai\s+phong\b/gi, 'TP. Hải Phòng');
          ca = ca.replace(/\btp\s+ha\s+noi\b/gi, 'TP. Hà Nội');

          ca = OrderProcessor.stripCODNoteFromAddress(ca);
          ca = ca.replace(/\s+/g, ' ').trim();
          // Xóa các đuôi hội thoại thừa (e nhé, em nha, v.v.)
          ca = ca.replace(/\s+(?:e\s+nhé|em\s+nhé|e\s+nha|em\s+nha|nhé\s+e|nhé\s+em|nha\s+e|nha\s+em|nhé|nha(?!\s+(?:trang|xá|mần|bè|nam|bắc|tây|đông|trung))|nghe|nhé\s+bạn|nhé\s+shop|nhé\s+ad|nhé\s+anh|nhé\s+chị|ạ|dạ)\s*$/iu, '').trim();
          // Xóa các ghi chú trong ngoặc ở đuôi địa chỉ
          ca = ca.replace(/\s*\(\s*(?:địa\s*chỉ\s*)?(?:sau\s*)?(?:sáp\s*nhập|xác\s*nhập|cũ|mới|giao\s*giờ\s*hành\s*chính)[^)]*\)\s*$/i, '').trim();
          ca = ca.replace(/^[-\s\.\,\/]+|[-\s\.\,\/]+$/g, '').trim();

          const isChatterOnly = /^(?:e\s+nhé|em\s+nhé|e\s+nha|em\s+nha|nhé|nha|sđt|đt|dt|tel|phone|lh)$/i.test(ca);

          if (ca && !isChatterOnly) {
            if (!address) { address = ca; }
            else if (!address.toLowerCase().includes(ca.toLowerCase())) { address += ", " + ca; }
          }
        } else if (
          // Fallback địa chỉ: bắt đầu bằng số, độ dài >= 12, không phải số lượng sản phẩm, không phải dòng SĐT
          /^\d/.test(l) && /[a-zà-ỹ]/i.test(l) && l.length >= 12 &&
          !/\d+\s*(kg|gói|hộp|thùng|bao|bịch|cái|chiếc|chai|lọ|túi|tấn|yến|lít)\b/i.test(l) &&
          !phones.some(p => l.includes(p))
        ) {
          let ca = OrderProcessor.stripCODNoteFromAddress(l.trim());
          ca = ca.replace(/^(?:gửi\s+)?(?:ship\s+)?(?:cho\s+mình|cho\s+em|cho\s+tôi|cho\s+khách)?\s*(?:đến|về|tới)?\s*(?:địa\s*chỉ)?\s*[:\s\-•]*/gi, '').trim();
          ca = ca.replace(/(?:\+84|84|0)(?:[\s\.\-]?\d){9,10}\b/g, '');
          phones.forEach(p => { ca = ca.replace(p, ''); });
          ca = ca.replace(/[\s\.\,\-\–•]*(?:sđt|sdt|đt|dt|tel|phone|lh|liên\s*hệ|zalo|hotline)[:\s\-•]*$/gi, '').trim();
          ca = ca.replace(/\s+(?:e\s+nhé|em\s+nhé|e\s+nha|em\s+nha|nhé\s+e|nhé\s+em|nha\s+e|nha\s+em|nhé|nha(?!\s+(?:trang|xá|mần|bè|nam|bắc|tây|đông|trung))|nghe|ơi|nhé\s+bạn|nhé\s+shop|nhé\s+ad|nhé\s+anh|nhé\s+chị|ạ|dạ)(?!\p{L}).*$/iu, '').trim();
          ca = ca.replace(/\s*\(\s*(?:địa\s*chỉ\s*)?(?:sau\s*)?(?:sáp\s*nhập|xác\s*nhập|cũ|mới|giao\s*giờ\s*hành\s*chính)[^)]*\)\s*$/i, '').trim();
          ca = ca.replace(/^[-\s\.\,\/]+|[-\s\.\,\/]+$/g, '').trim();

          const isChatterOnly = /^(?:e\s+nhé|em\s+nhé|e\s+nha|em\s+nha|nhé|nha|sđt|đt|dt|tel|phone|lh)$/i.test(ca);

          if (ca && !isChatterOnly) {
            if (!address) { address = ca; }
            else if (!address.toLowerCase().includes(ca.toLowerCase())) { address += ", " + ca; }
          }
        } else {
          // Bắt ghi chú trong ngoặc (vd: "(Giao giờ hành chính)")
          const parenMatch = l.match(/\(([^)]+)\)/);
          if (parenMatch && !extraNote) {
            extraNote = parenMatch[1].trim();
          }
        }
      });

      if (!extraNote) {
        for (const l of lines) {
          const parenMatch = l.match(/\(([^)]+)\)/);
          if (parenMatch && parenMatch[1]) {
            extraNote = parenMatch[1].trim();
            break;
          }
        }
      }

      if (name && address && address !== 'không tìm thấy') {
        const baseName = name.split(/[\(\[]/)[0].trim();
        const normName = baseName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        const normAddr = address.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        if (normName && normName.length >= 3 && normAddr.startsWith(normName)) {
          address = address.substring(baseName.length).trim();
          address = address.replace(/^[-\s\.\,\/]+/, '').trim();
        }
      }

      const vnSurnamesList = /^(nguyễn|trần|lê|phạm|huỳnh|hoàng|vũ|võ|đặng|bùi|đỗ|hồ|ngô|dương|lý|đào|đinh|đoàn|mai|trịnh|thái|phan|cao|vương|lại|trương|lâm|phùng|hà|tạ|quách|lương|châu|chu|triệu|lưu|tống|tăng|diệp)\b/iu;
      allLines.forEach(l => {
        const trimmed = l.trim().replace(/^(?:anh|chị|em|c\/|a\/|đ\/c|khách)\s+/iu, '').trim();
        if (!trimmed || trimmed === name || (address && address.toLowerCase().includes(trimmed.toLowerCase()))) return;
        if (trimmed.toLowerCase().includes('kho') || trimmed.toLowerCase().includes('cod') || /^[A-Za-z]\d+[\.-]/i.test(trimmed)) return;
        if (/^(?:fb|zalo|page|sđt|đt|tel|người|tên|địa|đc)/i.test(trimmed)) return;
        const words = trimmed.split(/\s+/);
        if (words.length >= 2 && words.length <= 4 && vnSurnamesList.test(words[0])) {
          const normTrim = trimmed.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
          const normName = (name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
          if (normTrim !== normName) {
            if (!extraNote) extraNote = trimmed;
            else if (!extraNote.includes(trimmed)) extraNote += ', ' + trimmed;
          }
        }
      });

      if (!address) address = "không tìm thấy";
      if (phone) phone = phone.replace(/\s+/g, '');
      const codFound = codAmount > 0 || codExplicitZero;
      const orderCodes = orderCode ? orderCode.split(', ').map(c => c.trim()).filter(Boolean) : [];

      const result = {
        name,
        phone,
        address,
        orderCode,
        orderCodes,
        productItem,
        codAmount,
        collectFee,
        extraPhones,
        extraNote,
        codExplicitZero,
        codFound,
        rawText: rawInputText,
        senderInfo: disambiguation.senderInfo
      };

      // Đánh giá độ tin cậy và gán vào kết quả bóc tách
      result.confidence = OrderProcessor.evaluateParseConfidence(result, rawInputText, parseContext);

      return result;
    }
  };

  function runLocalComputerParser(text, parseContext = {}) {
    return OrderProcessor.parse(text, parseContext);
  }

  function isValidPhoneNumber(phone) {
    if (!phone) return false;
    const clean = phone.toString().replace(/\D/g, '');
    return /^(0\d{9,10})$/.test(clean);
  }

  function normalizePhoneNumber(phone) {
    if (!phone) return "";
    const digits = phone.toString().replace(/\D/g, '');
    if (/^(0\d{9,10})$/.test(digits)) return digits;
    const matches = digits.match(/0\d{9,10}/g) || [];
    if (matches.length > 0) return matches[0];
    if (digits.length >= 10 && digits.startsWith('0')) {
      return digits.length === 11 ? digits.slice(0, 11) : digits.slice(0, 10);
    }
    return "";
  }

  globalThis.OrderProcessor = OrderProcessor;
  globalThis.runLocalComputerParser = runLocalComputerParser;
  globalThis.isValidPhoneNumber = isValidPhoneNumber;
  globalThis.normalizePhoneNumber = normalizePhoneNumber;
