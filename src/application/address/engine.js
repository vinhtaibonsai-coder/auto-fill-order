(() => {
  const AddressEngine = {
    async process(rawAddress, phone = "") {
      if (!rawAddress || rawAddress === "không tìm thấy") {
        return { street: "", ward: "", district: "", province: "", confidence: 0, source: "none", fullAddress: "không tìm thấy" };
      }

      // 1. Kiểm tra Address Knowledge Base (AKB) trước để đạt tốc độ tối đa (mili giây)
      const cached = await AddressLearning.lookup(rawAddress, phone);
      if (cached) {
        const match = cached.match;
        const ruledMatch = typeof AddressRules !== 'undefined' ? await AddressRules.applyRules(match) : match;
        return {
          street: ruledMatch.street || match.street || "",
          ward: ruledMatch.ward || match.ward || "",
          district: ruledMatch.district || match.district || "",
          province: ruledMatch.province || match.province || "",
          confidence: cached.confidence,
          source: cached.source,
          fullAddress: this.buildFullAddress(ruledMatch),
          warning: ruledMatch.warning || "",
          suggestedAddress: ruledMatch.suggestedAddress || ""
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

      const finalResult = {
        street: ruled.street || "",
        ward: ruled.ward || "",
        district: ruled.district || "",
        province: ruled.province || "",
        confidence: ruled.confidence,
        source: "local_pipeline",
        fullAddress: this.buildFullAddress(ruled),
        warning: ruled.warning || "",
        suggestedAddress: ruled.suggestedAddress || ""
      };

      // Tự động lưu địa chỉ phân tích cục bộ thành công có độ tin cậy cao vào AKB
      if (finalResult.confidence >= 85) {
        await AddressLearning.learn(rawAddress, finalResult, phone);
      }

      return finalResult;
    },

    buildFullAddress(addrObj) {
      const parts = [];
      if (addrObj.street) parts.push(addrObj.street);
      if (addrObj.ward) parts.push(addrObj.ward);
      if (addrObj.district) parts.push(addrObj.district);
      if (addrObj.province) parts.push(addrObj.province);
      return parts.join(', ');
    }
  };

  globalThis.AddressEngine = AddressEngine;
})();
