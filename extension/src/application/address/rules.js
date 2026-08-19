(() => {
  const AddressRules = {
    async applyRules(addressObj) {
      let street = addressObj.street || "";
      let prov = addressObj.province || "";
      let dist = addressObj.district || "";
      let ward = addressObj.ward || "";
      let warningMsg = "";
      let suggestedAddr = "";

      // === Bước 0: Chuẩn hóa tỉnh trước (luôn cần cho mọi pipeline) ===
      if (typeof AddressAliases !== 'undefined') {
        prov = AddressAliases.getStandardProvince(prov);
      }
      const cleanProv0 = typeof cleanProvinceName === 'function' ? cleanProvinceName(prov) : prov.toLowerCase().trim().replace(/^(tỉnh|thành phố|tp\.?|tp)\s+/i, '');
      // Không ép đổi tên tỉnh (Sóc Trăng -> Cần Thơ) để giữ nguyên địa chỉ cho parser.
      // Dữ liệu sáp nhập tỉnh 2025 chỉ dùng để hiện cảnh báo tham khảo.

      // === Bước 0.5: Phát hiện địa chỉ cấp 2 mới (không quận/huyện) ===
      // Nếu parser không tìm thấy district và ward có thể khớp trực tiếp NEW_ADM_DB,
      // thì đây là địa chỉ cấp 2 mới → return ngay, không chạy pipeline merger cũ
      if (!dist && prov && ward && typeof NEW_ADM_DB !== 'undefined') {
        const _nn = (s) => String(s || '').normalize('NFD').toLowerCase().replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
        const _pw = (s) => _nn(s).replace(/^(phuong|xa|thi tran|thi xa)\s+/, '').trim();
        const _pp = (s) => _nn(s).replace(/^(tinh|thanh pho|tp\.?|t\.?)\s+/, '').trim();
        const provNorm = _pp(prov);
        const wardNorm = _pw(ward);
        const matchProv = NEW_ADM_DB.provinces.find(p => _pp(p.name) === provNorm);
        if (matchProv) {
          const newWards = NEW_ADM_DB.wards[matchProv.name] || [];
          let newWard = newWards.find(w => _pw(w.name) === wardNorm);
          let viaOldUnit = false;
          if (!newWard) {
            newWard = newWards.find(w => (w.old_units || []).some(o => _pw(o) === wardNorm));
            viaOldUnit = true;
          }
          if (newWard) {
            return { street, province: matchProv.name, district: '', ward: viaOldUnit ? ward : newWard.name };
          }
        }
        // Không match NEW_ADM_DB → fall through pipeline cũ (có thể là tên cũ chưa chuẩn hóa)
      }

      // ===== PIPELINE CŨ (địa chỉ cấp 3, có quận/huyện) =====
      // Chuẩn hóa tên tỉnh/huyện/xã từ database
      if (typeof AddressAliases !== 'undefined') {
        dist = AddressAliases.getStandardDistrict(prov, dist);
        
        // Dẫn xuất Quận/Huyện từ Xã/Phường nếu thiếu hoặc sai
        if (prov && ward) {
          const districtsOfProv = ADM_DB.districts[prov] || [];
          const isDistrictValid = districtsOfProv.some(d => d.name === dist);
          if (!isDistrictValid) {
            const resolvedDist = AddressAliases.findDistrictByWard(prov, ward);
            if (resolvedDist) {
              dist = resolvedDist;
            }
          }
        }
        
        ward = AddressAliases.getStandardWard(prov, dist, ward);
      }

      const normalizeLevelName = (value) => {
        const text = String(value || "").normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/đ/g, 'd');
        return text.replace(/^(tinh|thanh pho|tp\.?|quan|huyen|thi xa|phuong|xa|thi tran)\s+/i, '').trim();
      };

      // Tra LEVEL2_ADDRESS_MAPPING TRƯỚC (specific mappings, giữ dist) — ưu tiên cao hơn WARD_MERGER_MAP
      // để tránh WARD_MERGER_MAP clear dist = '' làm mất thông tin quận/huyện cần cho level2 matching
      if (typeof LEVEL2_ADDRESS_MAPPING !== 'undefined') {
        const location = [street, ward, dist, prov].map(normalizeLevelName);
        for (const [mappingKey, result] of Object.entries(LEVEL2_ADDRESS_MAPPING)) {
          const oldLevels = mappingKey.split('|');
          if (oldLevels.every(level => {
            const levelNorm = normalizeLevelName(level);
            return location.some(value => {
              const valTokens = value.split(/\s+/);
              return value === levelNorm || valTokens.some(t => t === levelNorm);
            });
          })) {
            street = street.split(',').map(part => part.trim()).filter(part => !oldLevels.some(level => {
              const normalizedPart = normalizeLevelName(part);
              const normalizedLevel = normalizeLevelName(level);
              const partTokens = normalizedPart.split(/\s+/);
              return normalizedPart === normalizedLevel || partTokens.some(t => t === normalizedLevel);
            })).join(', ');
            ward = result.ward;
            prov = result.province;
            dist = result.district || "";
            break;
          }
        }
      }

      // Tra WARD_MERGER_MAP: tìm xã/cũ -> xã MỚI (sau sáp nhập 2025)
      // Chỉ chạy nếu LEVEL2_ADDRESS_MAPPING không match (dist vẫn có giá trị)
      if (ward && (prov || dist)) {
        try {
          const mergerModule = await import('./database/ward_merger.js');
          const WARD_MERGER_MAP = mergerModule.WARD_MERGER_MAP;
          
          if (WARD_MERGER_MAP) {
            const _n = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase();
            const wardNormKey = _n(ward).replace(/^(phuong|xa|thi tran|thi xa)\s+/, '').trim();
            const provNormKey = _n(prov).replace(/^(tinh|thanh pho|tp\.?)\s+/, '').trim();
            const distNormKey = _n(dist).replace(/^(quan|huyen|thanh pho|tp\.?)\s+/, '').trim();

            let matchedVal = null;
            if (distNormKey) {
              for (const [oldKey, newVal] of Object.entries(WARD_MERGER_MAP)) {
                const keyNorm = _n(oldKey);
                if (keyNorm.includes(wardNormKey) && keyNorm.includes(distNormKey)) {
                  matchedVal = newVal;
                  break;
                }
              }
            }
            if (!matchedVal && provNormKey) {
              for (const [oldKey, newVal] of Object.entries(WARD_MERGER_MAP)) {
                const keyNorm = _n(oldKey);
                if (keyNorm.includes(wardNormKey) && keyNorm.includes(provNormKey)) {
                  matchedVal = newVal;
                  break;
                }
              }
            }

            if (matchedVal) {
              const oldWard = ward;
              ward = matchedVal.ward;
              if (matchedVal.district && dist && _n(dist) !== _n(matchedVal.district)) {
                dist = matchedVal.district;
              }
              if (matchedVal.province && _n(prov) !== _n(matchedVal.province)) {
                prov = matchedVal.province;
              }
              warningMsg = `Hệ thống tự động cập nhật: '${oldWard}' đã sáp nhập thành '${ward}' theo bản đồ 2025.`;
            }
          }
        } catch (e) {
          console.warn("Could not load ward_merger.js", e);
        }
      }

      // 2. Quy tắc cho các Quận/Huyện đặc thù
      const cleanDist = dist.toLowerCase().trim();
      if (prov === "Thành phố Hồ Chí Minh") {
        if (["quận 9", "q9", "quận 2", "q2", "quận thủ đức", "thủ đức"].includes(cleanDist)) {
          dist = "Thành phố Thủ Đức";
        }
      }
      
      if (prov === "Thành phố Hà Nội") {
        if (cleanDist === "huyện đông anh" || cleanDist === "đông anh") {
          dist = "Huyện Đông Anh"; // Sẽ đổi thành Quận Đông Anh nếu website yêu cầu mới
        }
      }

      // 3. Quy tắc tự động bổ sung xã/phường từ tên đường đặc thù
      if (prov === "Tỉnh Lâm Đồng" && dist === "Thành phố Đà Lạt") {
        const cleanStreet = street.toLowerCase();
        if (cleanStreet.includes("tô vĩnh diện")) {
          if (!ward) ward = "Phường 7";
        }
      }

      // 4. NEW_ADM_DB: map to 2-level structure (sáp nhập 2025), bỏ quận/huyện
      if (typeof NEW_ADM_DB !== 'undefined' && ward) {
        const _nn = (s) => String(s || '').normalize('NFD').toLowerCase().replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
        const _pw = (s) => _nn(s).replace(/^(phuong|xa|thi tran|thi xa)\s+/, '').trim();
        const _pp = (s) => _nn(s).replace(/^(tinh|thanh pho|tp\.?|t\.?)\s+/, '').trim();

        const provNorm = _pp(prov);
        const wardNorm = _pw(ward);

        const matchProv = NEW_ADM_DB.provinces.find(p => _pp(p.name) === provNorm);
        if (matchProv) {
          prov = matchProv.name;

          const newWards = NEW_ADM_DB.wards[matchProv.name] || [];
          let newWard = newWards.find(w => _pw(w.name) === wardNorm);
          let viaOldUnit = false;
          if (!newWard) {
            newWard = newWards.find(w => (w.old_units || []).some(o => _pw(o) === wardNorm));
            viaOldUnit = true;
          }
          if (newWard) {
            const oldWard = ward;
            ward = newWard.name;
            dist = '';
            if (viaOldUnit) {
              warningMsg = `Địa bàn ${oldWard} đã sáp nhập năm 2025 sang ${ward} (${prov}).`;
              suggestedAddr = `${street ? street + ', ' : ''}${ward}, ${prov}`;
            }
          }
        }
      }

      const finalRes = { street: street, province: prov, district: dist, ward: ward };
      if (warningMsg) {
        finalRes.warning = warningMsg;
        finalRes.suggestedAddress = suggestedAddr;
      }
      return finalRes;
    }
  };

  globalThis.AddressRules = AddressRules;
})();
