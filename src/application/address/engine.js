(() => {
  const AddressEngine = {
    async process(rawAddress, phone = "") {
      if (!rawAddress || rawAddress === "không tìm thấy") {
        return { street: "", ward: "", district: "", province: "", confidence: 0, source: "none", fullAddress: "không tìm thấy" };
      }

      // 1. Kiểm tra Address Knowledge Base (AKB) trước để đạt tốc độ tối đa (mili giây)
      const cached = await AddressLearning.lookup(rawAddress, phone);
      if (cached) {
        let match = cached.match;
        if (typeof AddressSanitizer !== 'undefined' && typeof AddressSanitizer.cleanObject === 'function') {
          match = AddressSanitizer.cleanObject(match);
        }
        // Nếu bản ghi lịch sử chỉ có fullAddress mà chưa có phân cấp hành chính, tự động phân tích
        if (match && !match.ward && !match.province && (match.fullAddress || match.address)) {
          const rawFull = match.fullAddress || match.address;
          try {
            if (typeof AddressNormalizer !== 'undefined' && typeof AddressParser !== 'undefined') {
              const norm = AddressNormalizer.normalize(rawFull);
              const p = AddressParser.parse(norm);
              if (p && (p.ward || p.province)) {
                match = { ...match, street: p.street || match.street || rawFull, ward: p.ward || '', district: p.district || '', province: p.province || '' };
              }
            }
          } catch (_) {}
          if (!match.street) match.street = rawFull;
        }

        const ruledMatch = typeof AddressRules !== 'undefined' ? await AddressRules.applyRules(match) : match;
        const cleanedMatch = typeof AddressSanitizer !== 'undefined' && typeof AddressSanitizer.cleanObject === 'function'
          ? AddressSanitizer.cleanObject(ruledMatch)
          : ruledMatch;

        return {
          street: cleanedMatch.street || "",
          ward: cleanedMatch.ward || "",
          district: cleanedMatch.district || "",
          province: cleanedMatch.province || "",
          confidence: cached.confidence,
          source: cached.source,
          fullAddress: this.buildFullAddress(cleanedMatch),
          warning: cleanedMatch.warning || "",
          suggestedAddress: cleanedMatch.suggestedAddress || "",
          isTwoLevel: Boolean(cleanedMatch.isTwoLevel || (!cleanedMatch.district && cleanedMatch.ward && cleanedMatch.province))
        };
      }

      // 2. Chuẩn hóa chuỗi địa chỉ
      let normalized = AddressNormalizer.normalize(rawAddress);

      // 3. Phân tích địa chỉ các bộ (Fuzzy Match & Database Lookup)
      let parsed = AddressParser.parse(normalized);

      // 4. Áp dụng quy tắc địa lý (Sáp nhập 2025, đặc thù quận/huyện)
      let ruled = await AddressRules.applyRules(parsed);
      ruled.confidence = parsed.confidence;

      // 5. Xác thực phân cấp hành chính
      const isValid = AddressValidator.validate(ruled);
      if (isValid) {
        ruled.confidence = Math.max(ruled.confidence, 85);
      } else {
        ruled.confidence = Math.min(ruled.confidence, 80);
      }

      // BỎ AI FALLBACK — AI không can thiệp địa chỉ, dùng local pipeline là chính

      let finalResult = {
        street: ruled.street || "",
        ward: ruled.ward || "",
        district: ruled.district || "",
        province: ruled.province || "",
        confidence: ruled.confidence,
        source: "local_pipeline",
        fullAddress: this.buildFullAddress(ruled),
        warning: ruled.warning || "",
        suggestedAddress: ruled.suggestedAddress || "",
        isTwoLevel: Boolean(ruled.isTwoLevel || (!ruled.district && ruled.ward && ruled.province))
      };

      if (typeof AddressSanitizer !== 'undefined' && typeof AddressSanitizer.cleanObject === 'function') {
        finalResult = AddressSanitizer.cleanObject(finalResult);
      }

      // Tự động lưu địa chỉ phân tích cục bộ thành công có độ tin cậy cao vào AKB
      if (finalResult.confidence >= 85) {
        await AddressLearning.learn(rawAddress, finalResult, phone, {
          sourceType: 'local_pipeline',
          verified: false
        });
      }

      return finalResult;
    },

    buildFullAddress(addrObj) {
      if (!addrObj || typeof addrObj !== 'object') return '';
      if (typeof AddressSanitizer !== 'undefined' && typeof AddressSanitizer.cleanObject === 'function') {
        const cleaned = AddressSanitizer.cleanObject(addrObj);
        return cleaned.fullAddress;
      }
      const parts = [];
      if (addrObj.street) parts.push(addrObj.street);
      if (addrObj.ward) parts.push(addrObj.ward);
      if (addrObj.district) parts.push(addrObj.district);
      if (addrObj.province) parts.push(addrObj.province);
      const combined = parts.join(', ');
      return combined || addrObj.fullAddress || addrObj.address || addrObj.street || '';
    }
  };

  globalThis.AddressEngine = AddressEngine;
})();
