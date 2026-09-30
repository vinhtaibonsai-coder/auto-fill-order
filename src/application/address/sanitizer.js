/**
 * Address Sanitizer & Deduplicator
 * Xử lý triệt để hiện tượng lặp địa chỉ do cơ chế cũ lưu trữ hoặc ghép nối chuỗi
 * (Ví dụ: "... Ninh Kiều, Ninh Kiều, An Cư, TP. Cần Thơ, P. Ninh Kiều, Q. Ninh Kiều...")
 */
(() => {
  const stripAccents = (str) => {
    return String(str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const getCoreAdminName = (str) => {
    return String(str || '')
      .trim()
      .replace(/^(thành phố|tỉnh|quận|huyện|thị xã|phường|xã|thị trấn|tp\.?|q\.?|h\.?|p\.?|tx\.?)\s+/i, '')
      .trim();
  };

  const escapeReg = (str) => {
    return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  const AddressSanitizer = {
    /**
     * Khử lặp các phân đoạn (segments) trong chuỗi địa chỉ
     * @param {string} rawAddr - Chuỗi địa chỉ thô
     * @returns {string} Chuỗi địa chỉ đã được làm sạch và khử lặp
     */
    deduplicate(rawAddr) {
      if (!rawAddr || typeof rawAddr !== 'string') return '';
      let text = rawAddr.trim();
      if (!text || text === 'không tìm thấy') return text;

      // 1. Kiểm tra nếu chuỗi bị nhân đôi nguyên khối (A + A)
      const halfLen = Math.floor(text.length / 2);
      for (let len = halfLen; len >= 10; len--) {
        const part1 = text.slice(0, len).trim();
        const rest = text.slice(len).trim();
        if (rest.startsWith(part1)) {
          text = part1 + rest.slice(part1.length);
          break;
        }
      }

      // 2. Tách theo dấu phẩy
      const rawSegments = text.split(',').map(s => s.trim()).filter(Boolean);
      if (rawSegments.length <= 1) {
        return text;
      }

      const uniqueSegments = [];
      const seenCores = new Set();
      const seenRaw = new Set();

      for (let i = 0; i < rawSegments.length; i++) {
        const seg = rawSegments[i];
        const segNorm = stripAccents(seg);
        const coreName = getCoreAdminName(seg);
        const coreNorm = stripAccents(coreName);

        if (seenRaw.has(segNorm)) continue;

        if (coreNorm.length >= 3 && !/^\d+$/.test(coreNorm)) {
          if (seenCores.has(coreNorm)) {
            continue;
          }
          let isContained = false;
          for (const prev of seenCores) {
            if (prev === coreNorm || (prev.length >= 4 && coreNorm.length >= 4 && (prev.includes(coreNorm) || coreNorm.includes(prev)))) {
              isContained = true;
              break;
            }
          }
          if (isContained) {
            continue;
          }
          seenCores.add(coreNorm);
        }

        seenRaw.add(segNorm);
        uniqueSegments.push(seg);
      }

      // 3. Ghép lại
      let result = uniqueSegments.join(', ');
      result = result.replace(/,\s*,+/g, ',').replace(/^,\s*/, '').replace(/,\s*$/, '').trim();
      return result || text;
    },

    /**
     * Làm sạch object địa chỉ trước khi lưu hoặc hiển thị
     * Tách bỏ phần ward/district/province bị dính vào street
     */
    cleanObject(addrObj) {
      if (!addrObj || typeof addrObj !== 'object') return addrObj;

      let street = String(addrObj.street || '').trim();
      let ward = String(addrObj.ward || '').trim();
      let district = String(addrObj.district || '').trim();
      let province = String(addrObj.province || '').trim();
      let fullAddress = String(addrObj.fullAddress || addrObj.address || '').trim();

      street = this.deduplicate(street);
      fullAddress = this.deduplicate(fullAddress);

      // Cắt bỏ province, district, ward khỏi đuôi street nếu bị dính (đa vòng lặp để xử lý mọi thứ tự)
      let prevStreet = '';
      let passes = 0;
      while (prevStreet !== street && passes < 4) {
        prevStreet = street;
        passes++;
        [province, district, ward].forEach(unit => {
          if (!unit || !street) return;
          const core = getCoreAdminName(unit);
          street = street.replace(new RegExp('[,\\s]*' + escapeReg(unit) + '[,\\s]*$', 'i'), '').trim();
          if (core && core.length >= 2) {
            street = street.replace(new RegExp('[,\\s]*(?:thành phố|tỉnh|quận|huyện|thị xã|phường|xã|thị trấn|tp\\.?|q\\.?|h\\.?|p\\.?|tx\\.?\\s*)?\\s*' + escapeReg(core) + '[,\\s]*$', 'i'), '').trim();
          }
        });
        street = street.replace(/[,\\s]+(?:phường|xã|thị trấn|quận|huyện|thị xã|tỉnh|thành phố|tp\\.?|q\\.?|h\\.?|p\\.?|tx\\.?)[,\\s]*$/i, '').trim();
        street = street.replace(/,\s*$/, '').trim();
      }

      // Xây dựng lại fullAddress sạch sẽ
      const parts = [];
      if (street) parts.push(street);
      if (ward) parts.push(ward);
      if (district) parts.push(district);
      if (province) parts.push(province);

      const combined = this.deduplicate(parts.join(', '));

      return {
        ...addrObj,
        street: street || addrObj.street || '',
        ward: ward || addrObj.ward || '',
        district: district || addrObj.district || '',
        province: province || addrObj.province || '',
        fullAddress: combined || fullAddress || '',
        full_address: combined || fullAddress || '',
        address: combined || fullAddress || '',
        isTwoLevel: Boolean(addrObj.isTwoLevel || (!district && ward && province))
      };
    }
  };

  if (typeof globalThis !== 'undefined') {
    globalThis.AddressSanitizer = AddressSanitizer;
  }
  if (typeof window !== 'undefined') {
    window.AddressSanitizer = AddressSanitizer;
  }
})();

