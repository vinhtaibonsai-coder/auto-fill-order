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

      // Helper an toàn lấy cơ sở dữ liệu 2 cấp mới NEW_ADM_DB
      const getNewAdmDb = () => {
        if (typeof globalThis !== 'undefined' && globalThis.NEW_ADM_DB) return globalThis.NEW_ADM_DB;
        if (typeof window !== 'undefined' && window.NEW_ADM_DB) return window.NEW_ADM_DB;
        if (typeof NEW_ADM_DB !== 'undefined') return NEW_ADM_DB;
        return null;
      };
      const newAdmDb = getNewAdmDb();

      const _nn = (s) => String(s || '').normalize('NFD').toLowerCase().replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
      const _pw = (s) => _nn(s).replace(/^(phuong|xa|thi tran|thi xa|p\.|x\.)\s+/, '').trim();
      const _pd = (s) => _nn(s).replace(/^(quan|huyen|thi xa|thanh pho|tp\.?|q\.|h\.)\s+/, '').trim();
      const _pp = (s) => _nn(s).replace(/^(tinh|thanh pho|tp\.?|t\.?)\s+/, '').trim();

      // === Bước 0.5: Phát hiện và quy đổi địa chỉ cấp 2 mới (chuẩn VNPost sau sáp nhập 2025) ===
      if (prov && newAdmDb) {
        const provNorm = _pp(prov);
        const matchProv = newAdmDb.provinces.find(p => _pp(p.name) === provNorm || (p.merged_with || []).some(m => _pp(m) === provNorm));

        if (matchProv) {
          const newWards = newAdmDb.wards[matchProv.name] || [];
          const wardNorm = ward ? _pw(ward) : '';
          const distNorm = dist ? _pd(dist) : '';

          // TH1: Parser đã nhận diện ward và không có district
          if (!dist && ward) {
            let newWard = newWards.find(w => _pw(w.name) === wardNorm);
            let viaOldUnit = false;
            let isCurrentActiveWardInProv = false;
            if (typeof ADM_DB !== 'undefined' && ADM_DB.wards) {
              const standardProv = (typeof AddressAliases !== 'undefined') ? AddressAliases.getStandardProvince(prov) : prov;
              const provKeys = Object.keys(ADM_DB.wards).filter(k => k.startsWith(`${standardProv}|`) || k.startsWith(`${prov}|`));
              isCurrentActiveWardInProv = provKeys.some(k => ADM_DB.wards[k].some(w => _pw(w) === wardNorm));
            }
            if (!newWard && !isCurrentActiveWardInProv) {
              newWard = newWards.find(w => (w.old_units || []).some(o => _pw(o) === wardNorm));
              viaOldUnit = true;
            }
            if (newWard) {
              let finalWard = newWard.name;
              if (!viaOldUnit && /^(phuong|phường|p\.)/i.test(ward) && /^xa|^xã/i.test(newWard.name)) {
                finalWard = ward;
              }
              const cleanStreet = street.replace(/[\s,]+(?:quận|quan|huyện|huyen|phường|phuong|xã|xa)\s*$/i, '').trim();
              return {
                street: cleanStreet,
                province: matchProv.name,
                district: '',
                ward: viaOldUnit ? newWard.name : finalWard,
                isTwoLevel: true
              };
            }
          }

          // TH2: Không có ward kèm theo, nhưng tên quận/huyện trùng tên Đơn vị cấp 2 mới (vd: "thanh xuân hà nội" -> Phường Thanh Xuân)
          if (!ward && dist) {
            const matchWard = newWards.find(w => _pw(w.name) === distNorm);
            if (matchWard) {
              const cleanStreet = street.replace(/[\s,]+(?:quận|quan|huyện|huyen|phường|phuong|xã|xa)\s*$/i, '').trim();
              return {
                street: cleanStreet,
                province: matchProv.name,
                district: '',
                ward: matchWard.name,
                isTwoLevel: true
              };
            }
          }

          // TH3: Địa chỉ có cả ward và dist nhưng ward đã là Đơn vị cấp 2 mới (hoặc thuộc diện sáp nhập sang Đơn vị cấp 2 mới của VNPost)
          if (ward && dist) {
            // Tên phường/xã được người dùng ghi rõ và khớp chính xác đơn vị 2 cấp mới
            // phải thắng dữ liệu 3 cấp cũ. Một số tên (như Phường Bồ Đề) tồn tại ở cả
            // hai bộ dữ liệu; nếu tiếp tục qua WARD_MERGER_MAP, các mô tả "phần còn lại"
            // có thể ánh xạ nhầm sang phường khác.
            const exactNewWard = newWards.find(w => _pw(w.name) === wardNorm);
            if (exactNewWard) {
              const cleanStreet = street.replace(/[\s,]+(?:quận|quan|huyện|huyen|phường|phuong|xã|xa)\s*$/i, '').trim();
              return {
                street: cleanStreet,
                province: matchProv.name,
                district: '',
                ward: exactNewWard.name,
                isTwoLevel: true,
                legacyDistrict: dist,
                legacyWard: ward
              };
            }

            let isCurrentActive3Level = false;
            if (typeof ADM_DB !== 'undefined' && ADM_DB.districts && ADM_DB.wards) {
              const standardProv = (typeof AddressAliases !== 'undefined') ? AddressAliases.getStandardProvince(prov) : prov;
              const districtsOfProv = ADM_DB.districts[standardProv] || ADM_DB.districts[prov] || [];
              const matchedDistrict = districtsOfProv.find(d => _pd(d.name) === distNorm);
              if (matchedDistrict) {
                const wardsOfDist = ADM_DB.wards[`${standardProv}|${matchedDistrict.name}`] || ADM_DB.wards[`${prov}|${matchedDistrict.name}`] || [];
                isCurrentActive3Level = wardsOfDist.some(w => _pw(w) === wardNorm);
              }
            }

            if (!isCurrentActive3Level) {
              let newWard = newWards.find(w => _pw(w.name) === wardNorm);
              let viaOldUnit = false;
              if (!newWard) {
                newWard = newWards.find(w => (w.old_units || []).some(o => _pw(o) === wardNorm));
                viaOldUnit = true;
              }
              if (newWard) {
                let finalWard = newWard.name;
                if (!viaOldUnit && /^(phuong|phường|p\.)/i.test(ward) && /^xa|^xã/i.test(newWard.name)) {
                  finalWard = ward;
                }
                const cleanStreet = street.replace(/[\s,]+(?:quận|quan|huyện|huyen|phường|phuong|xã|xa)\s*$/i, '').trim();
                return {
                  street: cleanStreet,
                  province: matchProv.name,
                  district: '',
                  ward: viaOldUnit ? newWard.name : finalWard,
                  isTwoLevel: true,
                  legacyDistrict: dist,
                  legacyWard: ward
                };
              }
            }
          }
        }
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
          let WARD_MERGER_MAP = typeof globalThis !== 'undefined' && globalThis.WARD_MERGER_MAP ? globalThis.WARD_MERGER_MAP : null;

          if (!WARD_MERGER_MAP) {
            try {
              let moduleUrl = './database/ward_merger.js';
              if (typeof chrome !== 'undefined' && chrome.runtime && typeof chrome.runtime.getURL === 'function') {
                try {
                  moduleUrl = chrome.runtime.getURL('src/application/address/database/ward_merger.js');
                } catch (_) {}
              }
              const mergerModule = await import(/* @vite-ignore */ moduleUrl);
              WARD_MERGER_MAP = mergerModule?.WARD_MERGER_MAP || mergerModule?.default || null;
              if (WARD_MERGER_MAP && typeof globalThis !== 'undefined') {
                globalThis.WARD_MERGER_MAP = WARD_MERGER_MAP;
              }
            } catch (_) {}
          }
          
          if (WARD_MERGER_MAP) {
            const _n = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase();
            const wardNormKey = _n(ward).replace(/^(phuong|xa|thi tran|thi xa|p\.|x\.)\s+/, '').trim();
            const provNormKey = _n(prov).replace(/^(tinh|thanh pho|tp\.?)\s+/, '').trim();
            const distNormKey = _n(dist).replace(/^(quan|huyen|thanh pho|tp\.?)\s+/, '').trim();

            const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const hasWordMatch = (target, pattern) => {
              if (!target || !pattern) return false;
              const regex = new RegExp('(?:^|[^a-z0-9])' + escapeRegExp(pattern) + '(?:[^a-z0-9]|$)', 'i');
              return regex.test(target);
            };

            let matchedVal = null;

            // 1. Direct O(1) exact match
            const directExactKey = `${wardNormKey} (${distNormKey || provNormKey})`;
            if (WARD_MERGER_MAP[directExactKey]) {
              matchedVal = WARD_MERGER_MAP[directExactKey];
            }

            // 2. Partitioned search by province (tránh duyệt tuyến tính 31,000 bản ghi)
            if (!matchedVal) {
              let provIndex = typeof globalThis !== 'undefined' ? globalThis._WARD_MERGER_PROV_INDEX : null;
              if (!provIndex) {
                provIndex = new Map();
                for (const [oldKey, newVal] of Object.entries(WARD_MERGER_MAP)) {
                  const norm = _n(oldKey);
                  const pMatch = norm.match(/\(([^)]+)\)$/);
                  const pTag = pMatch ? _pp(pMatch[1]) : '__general__';
                  const newValProv = newVal && newVal.province ? _pp(newVal.province) : '';

                  // Index by target province first, then by tag
                  const primaryTag = newValProv || pTag;
                  if (!provIndex.has(primaryTag)) {
                    provIndex.set(primaryTag, []);
                  }
                  provIndex.get(primaryTag).push([oldKey, newVal, norm]);

                  // Also index by pTag if different
                  if (pTag && pTag !== primaryTag) {
                    if (!provIndex.has(pTag)) {
                      provIndex.set(pTag, []);
                    }
                    provIndex.get(pTag).push([oldKey, newVal, norm]);
                  }
                }
                if (typeof globalThis !== 'undefined') {
                  globalThis._WARD_MERGER_PROV_INDEX = provIndex;
                }
              }

              // Lấy tập ứng viên theo tỉnh + chung
              // BẢO VỆ TỈNH TUYỆT ĐỐI: Nếu đã có provNormKey, CHỈ tìm kiếm trong bucket của tỉnh đó + chung.
              // Tuyệt đối không fallback sang duyệt 31,000 bản ghi của các tỉnh khác để tránh ghi đè sai tỉnh!
              const provBucket = provNormKey ? (provIndex.get(provNormKey) || []) : [];
              const generalBucket = provIndex.get('__general__') || [];
              const candidates = provNormKey ? provBucket.concat(generalBucket) : Object.entries(WARD_MERGER_MAP).map(([k, v]) => [k, v, _n(k)]);

              if (distNormKey) {
                for (let i = 0; i < candidates.length; i++) {
                  const [oldKey, newVal, keyNorm] = candidates[i];
                  if (hasWordMatch(keyNorm, wardNormKey) && hasWordMatch(keyNorm, distNormKey)) {
                    // Chặn chéo tỉnh: nếu có prov, mapping phải cùng tỉnh
                    if (!provNormKey || !newVal.province || _pp(newVal.province) === provNormKey) {
                      matchedVal = newVal;
                      break;
                    }
                  }
                }
              }

              if (!matchedVal && provNormKey && !distNormKey) {
                // BẢO VỆ ĐỊA CHỈ 2 CẤP MỚI: Nếu không có quận/huyện nhưng tên xã/phường hiện tại
                // ĐÃ LÀ đơn vị hành chính 2 cấp mới hợp lệ trong NEW_ADM_DB của tỉnh đó,
                // thì TUYỆT ĐỐI KHÔNG được sáp nhập mù chỉ dựa vào tỉnh!
                let isAlreadyValidNewWard = false;
                if (newAdmDb) {
                  const matchProv = newAdmDb.provinces.find(p => _pp(p.name) === provNormKey);
                  if (matchProv) {
                    const newWards = newAdmDb.wards[matchProv.name] || [];
                    isAlreadyValidNewWard = newWards.some(w => _pw(w.name) === wardNormKey);
                  }
                }
                if (!isAlreadyValidNewWard) {
                  for (let i = 0; i < candidates.length; i++) {
                    const [oldKey, newVal, keyNorm] = candidates[i];
                    if (hasWordMatch(keyNorm, wardNormKey) && (hasWordMatch(keyNorm, provNormKey) || _pp(newVal.province) === provNormKey)) {
                      if (!provNormKey || !newVal.province || _pp(newVal.province) === provNormKey) {
                        matchedVal = newVal;
                        break;
                      }
                    }
                  }
                }
              }
            }

            // CHỐT CHẶN AN TOÀN CHÉO TỈNH (Cross-Province Shield)
            if (matchedVal && prov && matchedVal.province) {
              const currentProvClean = _pp(prov);
              const targetProvClean = _pp(matchedVal.province);
              if (currentProvClean && targetProvClean && currentProvClean !== targetProvClean) {
                // Mapping sang tỉnh khác -> Hủy bỏ ngay lập tức
                matchedVal = null;
              }
            }

            if (matchedVal) {
              const oldWard = ward;
              ward = matchedVal.ward;
              if (matchedVal.district && dist && _n(dist) !== _n(matchedVal.district)) {
                dist = matchedVal.district;
              }
              // CHỈ gán tỉnh nếu ban đầu địa chỉ chưa có tỉnh
              if (matchedVal.province && !prov) {
                prov = matchedVal.province;
              }
              const cleanBaseOld = _n(oldWard).replace(/^(phuong|xa|thi tran|thi xa|p\.|x\.)\s+/, '').replace(/[uy]/g, 'u').trim();
              const cleanBaseNew = _n(ward).replace(/^(phuong|xa|thi tran|thi xa|p\.|x\.)\s+/, '').replace(/[uy]/g, 'u').trim();
              if (cleanBaseOld !== cleanBaseNew && !cleanBaseOld.includes(cleanBaseNew) && !cleanBaseNew.includes(cleanBaseOld)) {
                warningMsg = `Hệ thống tự động cập nhật: '${oldWard}' đã sáp nhập thành '${ward}' theo bản đồ 2025.`;
              }
            }
          }
        } catch (e) {
          // Graceful fallback if ward_merger cannot be loaded
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
        const cleanStreet = street.toLowerCase();
        if (cleanStreet.includes("vinhomes ocean park") || cleanStreet.includes("ocean park")) {
          if (!dist) dist = "Huyện Gia Lâm";
          if (!ward) ward = "Xã Đa Tốn";
        } else if (cleanStreet.includes("ecohome")) {
          if (!dist) dist = "Quận Bắc Từ Liêm";
          if (!ward) ward = "Phường Đông Ngạc";
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
      if (newAdmDb && ward) {
        const _nn = (s) => String(s || '').normalize('NFD').toLowerCase().replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
        const _pw = (s) => _nn(s).replace(/^(phuong|xa|thi tran|thi xa|p\.|x\.)\s+/, '').trim();
        const _pd = (s) => _nn(s).replace(/^(quan|huyen|thi xa|thanh pho|tp\.?|q\.|h\.)\s+/, '').trim();
        const _pp = (s) => _nn(s).replace(/^(tinh|thanh pho|tp\.?|t\.?)\s+/, '').trim();

        const provNorm = _pp(prov);
        const wardNorm = _pw(ward);
        const distNorm = dist ? _pd(dist) : '';

        // Kiểm tra xem đơn vị này có phải là đơn vị 3 cấp đang hoạt động chuẩn trong ADM_DB không
        let isCurrentActive3Level = false;
        if (typeof ADM_DB !== 'undefined' && ADM_DB.districts && ADM_DB.wards && dist) {
          const standardProv = (typeof AddressAliases !== 'undefined') ? AddressAliases.getStandardProvince(prov) : prov;
          const districtsOfProv = ADM_DB.districts[standardProv] || ADM_DB.districts[prov] || [];
          const matchedDistrict = districtsOfProv.find(d => _pd(d.name) === distNorm);
          if (matchedDistrict) {
            const wardsOfDist = ADM_DB.wards[`${standardProv}|${matchedDistrict.name}`] || ADM_DB.wards[`${prov}|${matchedDistrict.name}`] || [];
            isCurrentActive3Level = wardsOfDist.some(w => _pw(w) === wardNorm);
          }
        }

        // Nếu đã là đơn vị 3 cấp đang hoạt động chuẩn trong ADM_DB, giữ nguyên cấp hành chính
        if (!isCurrentActive3Level) {
          const matchProv = newAdmDb.provinces.find(p => _pp(p.name) === provNorm);
          if (matchProv) {
            prov = matchProv.name;

            const newWards = newAdmDb.wards[matchProv.name] || [];
            let newWard = newWards.find(w => _pw(w.name) === wardNorm);
            let viaOldUnit = false;
            if (!newWard) {
              newWard = newWards.find(w => (w.old_units || []).some(o => _pw(o) === wardNorm));
              viaOldUnit = true;
            }
            if (newWard) {
              const oldWard = ward;
              let finalWardName = newWard.name;
              if (!viaOldUnit && /^(phuong|phường|p\.)/i.test(ward) && /^xa|^xã/i.test(newWard.name)) {
                finalWardName = ward;
              }
              ward = finalWardName;
              dist = '';
              if (viaOldUnit) {
                warningMsg = `Địa bàn ${oldWard} đã sáp nhập năm 2025 sang ${ward} (${prov}).`;
                suggestedAddr = `${street ? street + ', ' : ''}${ward}, ${prov}`;
              }
            }
          }
        }
      }

      if (dist && /^quận\b/i.test(dist) && ward && !/^(phường|xã|thị trấn)\b/i.test(ward)) {
        ward = 'Phường ' + ward;
      }

      const finalRes = { street: street, province: prov, district: dist, ward: ward };
      if (warningMsg) {
        finalRes.warning = warningMsg;
        finalRes.suggestedAddress = suggestedAddr;
      }
      return finalRes;
    },

    /**
     * Quy đổi đơn vị hành chính sang chuẩn 2 cấp (2025):
     * Nếu xã/phường thuộc đơn vị sáp nhập (old_units), tra cứu đơn vị mới tương ứng.
     */
    async resolveTwoLevel(ward = '', district = '', province = '') {
      let prov = province || '';
      let w = ward || '';
      if (!w && !prov) return { ward: w, district: '', province: prov };

      const _nn = (s) => String(s || '').normalize('NFD').toLowerCase().replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
      const _pw = (s) => _nn(s).replace(/^(phuong|xa|thi tran|thi xa|p\.|x\.)\s+/, '').trim();
      const _pp = (s) => _nn(s).replace(/^(tinh|thanh pho|tp\.?|t\.?)\s+/, '').trim();

      const wardNorm = _pw(w);
      const provNorm = _pp(prov);

      try {
        let newAdmDb = (typeof globalThis !== 'undefined' && globalThis.NEW_ADM_DB) ? globalThis.NEW_ADM_DB : null;
        if (!newAdmDb && typeof globalThis !== 'undefined' && typeof globalThis.loadNewAdmDb === 'function') {
          newAdmDb = await globalThis.loadNewAdmDb().catch(() => null);
        }

        if (newAdmDb) {
          const matchProv = newAdmDb.provinces.find(p => _pp(p.name) === provNorm) ||
                            (provNorm ? newAdmDb.provinces.find(p => _pp(p.name).includes(provNorm) || provNorm.includes(_pp(p.name))) : null);
          if (matchProv) {
            prov = matchProv.name;
            const newWards = newAdmDb.wards[matchProv.name] || [];
            // Kiểm tra xem đã là ward 2 cấp hợp lệ chưa
            const exactWard = newWards.find(nw => _pw(nw.name) === wardNorm);
            if (exactWard) {
              return { ward: exactWard.name, district: '', province: prov };
            }
            // Kiểm tra trong old_units (đã sáp nhập)
            const mergedWard = newWards.find(nw => (nw.old_units || []).some(o => _pw(o) === wardNorm));
            if (mergedWard) {
              return { ward: mergedWard.name, district: '', province: prov, wasMerged: true, oldWard: w };
            }
          }
        }

        // Fallback: Tra cứu trong WARD_MERGER_MAP nếu có
        let WARD_MERGER_MAP = typeof globalThis !== 'undefined' && globalThis.WARD_MERGER_MAP ? globalThis.WARD_MERGER_MAP : null;
        if (!WARD_MERGER_MAP) {
          try {
            let moduleUrl = './database/ward_merger.js';
            if (typeof chrome !== 'undefined' && chrome.runtime && typeof chrome.runtime.getURL === 'function') {
              try { moduleUrl = chrome.runtime.getURL('src/application/address/database/ward_merger.js'); } catch (_) {}
            }
            const mergerModule = await import(/* @vite-ignore */ moduleUrl);
            WARD_MERGER_MAP = mergerModule?.WARD_MERGER_MAP || mergerModule?.default || null;
            if (WARD_MERGER_MAP && typeof globalThis !== 'undefined') globalThis.WARD_MERGER_MAP = WARD_MERGER_MAP;
          } catch (_) {}
        }
        if (WARD_MERGER_MAP) {
          for (const [oldKey, newVal] of Object.entries(WARD_MERGER_MAP)) {
            const keyNorm = _nn(oldKey);
            if (keyNorm.includes(wardNorm) && (!provNorm || keyNorm.includes(provNorm) || _pp(newVal.province) === provNorm)) {
              return { ward: newVal.ward, district: '', province: newVal.province || prov, wasMerged: true, oldWard: w };
            }
          }
        }
      } catch (err) {
        console.warn('[AddressRules.resolveTwoLevel] Error:', err);
      }

      return { ward: w, district: '', province: prov };
    }
  };

  globalThis.AddressRules = AddressRules;
})();
