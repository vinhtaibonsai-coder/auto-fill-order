(() => {
  const AddressNormalizer = {
    applyShopAliases(address, customAliases = null, customGlobalAliases = null) {
      if (!address) return "";
      let str = address;
      const shopAliases = customAliases || (globalThis.__SHOP_ADDRESS_ALIASES_CACHE__ || []);
      const globalAliases = customGlobalAliases || (globalThis.__GLOBAL_ADDRESS_ALIASES_CACHE__ || []);

      // 1. Áp dụng từ điển riêng của Shop trước (Độ ưu tiên cao nhất: Shop có thể ghi đè)
      if (Array.isArray(shopAliases) && shopAliases.length > 0) {
        str = this._replaceAliasList(str, shopAliases);
      }

      // 2. Áp dụng từ điển Toàn Hệ Thống (Global Rules được Admin kiểm duyệt)
      if (Array.isArray(globalAliases) && globalAliases.length > 0) {
        str = this._replaceAliasList(str, globalAliases);
      }

      return str;
    },

    _replaceAliasList(text, list) {
      let str = text;
      for (const item of list) {
        if (!item || !item.original || !item.mapping) continue;
        const orig = String(item.original).trim();
        const map = String(item.mapping).trim();
        if (!orig || !map) continue;

        // Escape regex special characters
        const escaped = orig.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        try {
          const regex = new RegExp(`(?<!\\p{L})${escaped}(?!\\p{L})`, 'gui');
          str = str.replace(regex, map);
        } catch (_) {
          const fallbackRegex = new RegExp(`(^|[^a-zA-Z0-9À-ỹ])${escaped}([^a-zA-Z0-9À-ỹ]|$)`, 'gi');
          str = str.replace(fallbackRegex, `$1${map}$2`);
        }
      }
      return str;
    },


    normalize(address, customAliases = null) {
      if (!address) return "";
      
      // 0. Áp dụng từ điển viết tắt đặc thù của Shop (từ Supabase Cloud / local cache)
      let clean = this.applyShopAliases(address, customAliases);

      // 1. Đưa về Unicode NFC chuẩn
      clean = clean.normalize('NFC').trim().toLowerCase();

      // Thêm khoảng trắng trước dấu mở ngoặc nếu bị dính liền (vd: "63b(đối diện 90c)" -> "63b (đối diện 90c)")
      clean = clean.replace(/([a-zA-Z0-9À-ỹ])\(/g, '$1 (');
      
      // Xóa các ghi chú trong ngoặc ở đuôi CHỈ KHI là ghi chú hành chính/hội thoại (không xóa mốc định vị nhà như: đối diện, gần, cạnh...)
      clean = clean.replace(/\s*\(\s*(?:địa\s*chỉ\s*)?(?:sau\s*)?(?:sáp\s*nhập|xác\s*nhập|cũ|mới|giao\s*giờ|đã\s*sáp\s*nhập|hành\s*chính)[^)]*\)\s*$/gi, '');
      clean = clean.replace(/\s*\(\s*(?!(?:đối\s*diện|gần|cạnh|sau\s*lưng|ngõ|ngách|hẻm|số\s*cũ|tầng|phòng|toà|tòa|lầu|khu))[^)]*\)\s*$/gi, '');

      // Xóa các đuôi hội thoại thừa (vd: "e nhé", "em nha", "nhé shop", v.v.)
      clean = clean.replace(/\s+(?:e\s+nhé|em\s+nhé|e\s+nha|em\s+nha|nhé\s+e|nhé\s+em|nha\s+e|nha\s+em|nhé|nha(?!\s+(?:trang|xá|mần|bè|nam|bắc|tây|đông|trung))|nghe|ơi|nhé\s+bạn|nhé\s+shop|nhé\s+ad|nhé\s+anh|nhé\s+chị|ạ|dạ)(?!\p{L}).*$/iu, '');

      // Chuẩn hóa vị trí dấu thanh tiếng Việt (kiểu gõ cũ hoà, hoá, thuỷ, khoẻ -> hòa, hóa, thủy, khỏe)
      clean = clean
        .replace(/oà/g, 'òa').replace(/oá/g, 'óa').replace(/oả/g, 'ỏa').replace(/oã/g, 'õa').replace(/oạ/g, 'ọa')
        .replace(/oè/g, 'òe').replace(/oé/g, 'óe').replace(/oẻ/g, 'ỏe').replace(/oẽ/g, 'õe').replace(/oẹ/g, 'ọe')
        .replace(/uỳ/g, 'ùy').replace(/uý/g, 'úy').replace(/uỷ/g, 'ủy').replace(/uỹ/g, 'ũy').replace(/uỵ/g, 'ụy');

      // Chuyển đổi dấu gạch chéo '/' phân cách giữa các cấp (vd: xóm vực/vân từ/ chuyên mỹ/ hà nội) thành dấu phẩy
      // Nhưng giữ nguyên số nhà dạng 12/3 hoặc 12/3a
      clean = clean.replace(/(?<=[^\d\s])\s*\/\s*|\s*\/\s*(?=[^\d\s])/g, ', ');

      // 2. Chuẩn hóa các viết tắt đơn lẻ có ranh giới từ (sử dụng Unicode property escape để tránh lỗi dấu tiếng Việt)
      // Cần thực hiện trước khi biến đổi dấu chấm thành dấu phẩy để tránh "tp. cần thơ" thành "thành phố, cần thơ"
      clean = clean.replace(/(?<!\p{L})tp(?!\p{L})\.?\s*/gu, 'thành phố ');
      clean = clean.replace(/(?<!\p{L})tx(?!\p{L})\.?\s*/gu, 'thị xã ');
      clean = clean.replace(/(?<!\p{L})tt(?!\p{L})\.?\s*/gu, 'thị trấn ');
      // Chỉ mở rộng "p" khi là viết tắt hành chính có dấu chấm/khoảng trắng.
      // Chuỗi dính từ 3 chữ số trở lên như P705 thường là số phòng, không phải phường.
      clean = clean.replace(/(?<!\p{L})p(?:\.\s*|\s+)(?=\p{L}|\d{1,2}\b)/gu, 'phường ');
      clean = clean.replace(/(?<!\p{L})q(?!\p{L})\.?\s*/gu, 'quận ');
      clean = clean.replace(/(?<!\p{L})h(?!\p{L})\.?\s*/gu, 'huyện ');
      clean = clean.replace(/(?<!\p{L})x(?!\p{L})\.?\s*/gu, 'xã ');

      // 3. Chuyển đổi các ký tự phân cách cấp hành chính (dấu gạch nối '-' và dấu chấm '.' giữa các cụm từ) thành dấu phẩy ','
      clean = clean.replace(/\s*-\s*/g, ', ');
      clean = clean.replace(/\s*\.\s*(?=[a-zA-ZÀ-ỹ])/g, ', ');
      clean = clean.replace(/[;\\_]+/g, ' ');
      clean = clean.replace(/,+/g, ',');
      clean = clean.replace(/\s+/g, ' ');
      
      // 4. Chuẩn hóa dạng viết tắt dính số (vd: q1 -> quận 1, p12 -> phường 12)
      clean = clean.replace(/\bq([0-9]+)\b/g, 'quận $1');
      clean = clean.replace(/\bp([0-9]{1,2})\b/g, 'phường $1');
      
      return clean.trim();
    },

    preserveComplete(rawAddress, normalizedAddress) {
      const raw = String(rawAddress || '').trim();
      const normalized = String(normalizedAddress || '').trim();
      if (!raw) return normalized;
      if (!normalized) return raw;

      const compact = value => value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
      const rawCompact = compact(raw);
      const normalizedCompact = compact(normalized);

      // Kết quả chuẩn hóa chỉ được thay địa chỉ gốc khi không làm mất một phần đáng kể dữ liệu.
      // Đặc biệt bảo vệ các chuỗi không dấu phẩy mà Address Engine có thể cắt giữa tên phường/quận.
      if (normalizedCompact.length < rawCompact.length * 0.82) return raw;
      if (rawCompact.startsWith(normalizedCompact) && normalizedCompact.length < rawCompact.length) return raw;
      return normalized;
    }
  };

  globalThis.AddressNormalizer = AddressNormalizer;
})();
