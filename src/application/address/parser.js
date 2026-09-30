(() => {
  const normTone = (str) => {
    if (!str) return "";
    return String(str).normalize('NFC').toLowerCase()
      .replace(/oà/g, 'òa').replace(/oá/g, 'óa').replace(/oả/g, 'ỏa').replace(/oã/g, 'õa').replace(/oạ/g, 'ọa')
      .replace(/oè/g, 'òe').replace(/oé/g, 'óe').replace(/oẻ/g, 'ỏe').replace(/oẽ/g, 'õe').replace(/oẹ/g, 'ọe')
      .replace(/uỳ/g, 'ùy').replace(/uý/g, 'úy').replace(/uỷ/g, 'ủy').replace(/uỹ/g, 'ũy').replace(/uỵ/g, 'ụy');
  };

  const AddressParser = {
    tryToSplitWithoutCommas(addressStr) {
      if (typeof ADM_DB === 'undefined') return { street: addressStr, ward: "", district: "", province: "" };
      if (typeof AddressNormalizer !== 'undefined' && typeof AddressNormalizer.normalize === 'function') {
        addressStr = AddressNormalizer.normalize(addressStr);
      }
      let s = addressStr.trim();
      let province = "";
      let district = "";
      let ward = "";
      let street = "";
      
      let foundProv = null;
      let sLow = normTone(s);
      const _strip = (val) => String(val || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase();
      let sLowStrip = _strip(s);
      
      for (const prov of ADM_DB.provinces) {
        const pName = prov.name.toLowerCase();
        const pNameNoPrefix = prov.name.replace(/^(tỉnh|thành phố|tp\.?|t\.?)\s+/i, '').trim().toLowerCase();
        const aliases = (prov.aliases || []).map(a => a.toLowerCase());
        const candidateNames = [pName, pNameNoPrefix, ...aliases].filter(Boolean);
        candidateNames.sort((a,b) => b.length - a.length);
        
        for (const cand of candidateNames) {
          const candNorm = normTone(cand);
          const candStrip = _strip(cand);
          let idx = sLow.lastIndexOf(candNorm);
          let mLen = candNorm.length;
          if (idx === -1) {
            idx = sLowStrip.lastIndexOf(candStrip);
            mLen = candStrip.length;
          }
          if (idx !== -1 && (idx === 0 || sLow[idx - 1] === ' ' || sLow[idx - 1] === ',')) {
            const after = sLow.substring(idx + mLen).trim();
            if (!after || /^(đơn|ko|không|chưa|nhé|nha|nghe|ơi|ạ|cho|xem|giao|kiểm)\b/i.test(after)) {
              let startIndex = idx;
              const beforeStr = s.substring(0, idx).trimEnd();
              const beforeClean = beforeStr.replace(/[,\s\-]+$/, '');
              const prefixMatch = beforeClean.match(/(?:(?:\b|\s+)(?:tỉnh|tinh|thành\s*phố|thanh\s*pho|tp\.?|t\.)|(?:\b|\s+)[t])$/i);
              if (prefixMatch) {
                startIndex = beforeClean.length - prefixMatch[0].length;
              }
              foundProv = { name: prov.name, length: mLen, index: startIndex };
              break;
            }
          }
        }
        if (foundProv) break;
      }
      
      if (foundProv) {
        province = foundProv.name;
        s = s.substring(0, foundProv.index).trim().replace(/[,\s\-]+$/, '');
        sLow = normTone(s);
        sLowStrip = _strip(s);
        
        const districts = ADM_DB.districts[province] || [];
        let foundDist = null;
        for (const dist of districts) {
          const dName = dist.name.toLowerCase();
          const dNameNoPrefix = dist.name.replace(/^(quận|huyện|thị xã|thành phố|tp\.?)\s+/i, '').trim().toLowerCase();
          const aliases = (dist.aliases || []).map(a => a.toLowerCase());
          const candidateNames = [dName, dNameNoPrefix, ...aliases].filter(Boolean);
          candidateNames.sort((a,b) => b.length - a.length);
          
          for (const cand of candidateNames) {
            const candNorm = normTone(cand);
            const candStrip = _strip(cand);
            let matchEnd = sLow.endsWith(candNorm);
            let matchStrip = sLowStrip.endsWith(candStrip);
            if (matchEnd || matchStrip) {
              let mLen = matchEnd ? candNorm.length : candStrip.length;
              let idx = s.length - mLen;
              if (idx === 0 || sLow[idx - 1] === ' ' || sLow[idx - 1] === ',') {
                const beforeStr = s.substring(0, idx).trimEnd();
                const beforeClean = beforeStr.replace(/[,\s\-]+$/, '');
                // Nếu ngay trước tên có tiền tố phường/xã (vd: "xã chợ mới") -> Đây là Phường/Xã, KHÔNG phải Quận/Huyện
                const isWardPrefix = /(?:(?:\b|\s+)(?:phường|phuong|xã|xa|thị\s*trấn|thi\s*tran|p\.?|x\.?|tt\.?)|(?:\b|\s+)[px])$/i.test(beforeClean);
                if (!isWardPrefix) {
                  let startIndex = idx;
                  const prefixMatch = beforeClean.match(/(?:(?:\b|\s+)(?:quận|quan|huyện|huyen|thị\s*xã|thi\s*xa|thành\s*phố|thanh\s*pho|tp\.?|q\.|h\.)|(?:\b|\s+)[qh])$/i);
                  if (prefixMatch) {
                    startIndex = beforeClean.length - prefixMatch[0].length;
                  }
                  foundDist = { name: dist.name, length: mLen, index: startIndex };
                  break;
                }
              }
            }
          }
          if (foundDist) break;
        }
        
        if (foundDist) {
          district = foundDist.name;
          s = s.substring(0, foundDist.index).trim().replace(/[,\s\-]+$/, '');
          sLow = normTone(s);
          sLowStrip = _strip(s);
          
          const key = province + "|" + district;
          const wards = ADM_DB.wards[key] || ADM_DB.wards[district] || [];
          let foundWard = null;
          for (const w of wards) {
            const wName = w.toLowerCase();
            const wNameNoPrefix = w.replace(/^(phường|xã|thị trấn|p\.|x\.)\s+/i, '').trim().toLowerCase();
            const candidateNames = [wName, wNameNoPrefix].filter(Boolean);
            candidateNames.sort((a,b) => b.length - a.length);
            
            for (const cand of candidateNames) {
              const candNorm = normTone(cand);
              const candStrip = _strip(cand);
              let matchEnd = sLow.endsWith(candNorm);
              let matchStrip = sLowStrip.endsWith(candStrip);
              if (matchEnd || matchStrip) {
                let mLen = matchEnd ? candNorm.length : candStrip.length;
                let idx = s.length - mLen;
                if (idx === 0 || sLow[idx - 1] === ' ' || sLow[idx - 1] === ',') {
                  let startIndex = idx;
                  const beforeStr = s.substring(0, idx).trimEnd();
                  const beforeClean = beforeStr.replace(/[,\s\-]+$/, '');
                  const prefixMatch = beforeClean.match(/(?:(?:\b|\s+)(?:phường|phuong|xã|xa|thị\s*trấn|thi\s*tran|p\.?|x\.?|tt\.?)|(?:\b|\s+)[px])$/i);
                  if (prefixMatch) {
                    startIndex = beforeClean.length - prefixMatch[0].length;
                  }
                  foundWard = { name: w, length: mLen, index: startIndex };
                  break;
                }
              }
            }
            if (foundWard) break;
          }
          
          if (foundWard) {
            ward = foundWard.name;
            street = s.substring(0, foundWard.index).trim().replace(/[,\s\-]+$/, '');
          } else {
            street = s;
          }
        } else {
          // Thử tìm phường/xã trực tiếp thuộc tỉnh khi không có quận/huyện trong chuỗi (Hỗ trợ cả NEW_ADM_DB 2 cấp)
          let foundWard = null;
          let newAdmDb = null;
          if (typeof globalThis !== 'undefined' && globalThis.NEW_ADM_DB) newAdmDb = globalThis.NEW_ADM_DB;
          else if (typeof window !== 'undefined' && window.NEW_ADM_DB) newAdmDb = window.NEW_ADM_DB;
          else if (typeof NEW_ADM_DB !== 'undefined') newAdmDb = NEW_ADM_DB;

          if (newAdmDb) {
            const _pp = (val) => _strip(val).replace(/^(tinh|thanh pho|tp\.?|t\.?)\s+/, '').trim();
            const matchProv = newAdmDb.provinces.find(p => _pp(p.name) === _pp(province));
            if (matchProv) {
              const newWards = newAdmDb.wards[matchProv.name] || [];
              for (const nw of newWards) {
                const nwName = nw.name.toLowerCase();
                const nwNameNoPrefix = nw.name.replace(/^(phường|xã|thị trấn|p\.|x\.)\s+/i, '').trim().toLowerCase();
                const candidateNames = [nwName, nwNameNoPrefix];
                for (const cand of candidateNames) {
                  const candNorm = normTone(cand);
                  const candStrip = _strip(cand);
                  let matchEnd = sLow.endsWith(candNorm);
                  let matchStrip = sLowStrip.endsWith(candStrip);
                  if (matchEnd || matchStrip) {
                    let mLen = matchEnd ? candNorm.length : candStrip.length;
                    let idx = s.length - mLen;
                    if (idx === 0 || sLow[idx - 1] === ' ' || sLow[idx - 1] === ',') {
                      let startIndex = idx;
                      const beforeStr = s.substring(0, idx).trimEnd();
                      const beforeClean = beforeStr.replace(/[,\s\-]+$/, '');
                      const prefixMatch = beforeClean.match(/(?:(?:\b|\s+)(?:phường|phuong|xã|xa|thị\s*trấn|thi\s*tran|p\.?|x\.?|tt\.?)|(?:\b|\s+)[px])$/i);
                      if (prefixMatch) {
                        startIndex = beforeClean.length - prefixMatch[0].length;
                      }
                      let assignedWardName = nw.name;
                      if (prefixMatch && /(?:phường|phuong|p\.?)/i.test(prefixMatch[0]) && /^xã\s+/i.test(nw.name)) {
                        assignedWardName = nw.name.replace(/^xã\s+/i, 'Phường ');
                      }
                      foundWard = { name: assignedWardName, distName: '', length: mLen, index: startIndex, isTwoLevel: true };
                      break;
                    }
                  }
                }
                if (foundWard) break;
              }
            }
          }

          if (!foundWard) {
            for (const dist of districts) {
              const key = province + "|" + dist.name;
              const wards = ADM_DB.wards[key] || ADM_DB.wards[dist.name] || [];
              for (const w of wards) {
                const wName = w.toLowerCase();
                const wNameNoPrefix = w.replace(/^(phường|xã|thị trấn|p\.|x\.)\s+/i, '').trim().toLowerCase();
                const candidateNames = [wName, wNameNoPrefix].filter(Boolean);
                candidateNames.sort((a,b) => b.length - a.length);
                
                for (const cand of candidateNames) {
                  const candNorm = normTone(cand);
                  const candStrip = _strip(cand);
                  let matchEnd = sLow.endsWith(candNorm);
                  let matchStrip = sLowStrip.endsWith(candStrip);
                  if (matchEnd || matchStrip) {
                    let mLen = matchEnd ? candNorm.length : candStrip.length;
                    let idx = s.length - mLen;
                    if (idx === 0 || sLow[idx - 1] === ' ' || sLow[idx - 1] === ',') {
                      let startIndex = idx;
                      const beforeStr = s.substring(0, idx).trimEnd();
                      const beforeClean = beforeStr.replace(/[,\s\-]+$/, '');
                      const prefixMatch = beforeClean.match(/(?:(?:\b|\s+)(?:phường|phuong|xã|xa|thị\s*trấn|thi\s*tran|p\.?|x\.?|tt\.?)|(?:\b|\s+)[px])$/i);
                      if (prefixMatch) {
                        startIndex = beforeClean.length - prefixMatch[0].length;
                      }
                      foundWard = { name: w, distName: dist.name, length: mLen, index: startIndex };
                      break;
                    }
                  }
                }
                if (foundWard) break;
              }
              if (foundWard) break;
            }
          }

          if (foundWard) {
            ward = foundWard.name;
            district = foundWard.distName || "";
            street = s.substring(0, foundWard.index).trim().replace(/[,\s\-]+$/, '');
          } else {
            street = s;
          }
        }
      } else {
        street = s;
      }
      
      return { street, ward, district, province };
    },

    parse(normalizedAddress) {
      if (!normalizedAddress) return { street: "", ward: "", district: "", province: "", confidence: 0 };
      if (typeof AddressNormalizer !== 'undefined' && typeof AddressNormalizer.normalize === 'function') {
        normalizedAddress = AddressNormalizer.normalize(normalizedAddress);
      }
      
      // Phân tách qua dấu phẩy và lọc bỏ phần tử rác chỉ chứa từ khóa hành chính chung chung (ví dụ: "Phường", "Quận") do AI điền sai
      const parts = normalizedAddress.split(',')
        .map(p => {
          // Chỉ xóa các ngoặc đơn chứa ghi chú hành chính hoặc hội thoại thừa, giữ lại mốc định vị nhà (đối diện, gần, cạnh...)
          return p.replace(/\s*\(\s*(?:địa\s*chỉ\s*)?(?:sau\s*)?(?:sáp\s*nhập|xác\s*nhập|cũ|mới|giao\s*giờ|đã\s*sáp\s*nhập|hành\s*chính)[^)]*\)/gi, '').trim();
        })
        .filter(Boolean)
        .filter(p => {
          const lowP = p.toLowerCase();
          return !["phường", "quận", "xã", "huyện", "tỉnh", "thành phố", "tp", "p", "q", "x", "h"].includes(lowP);
        });
      if (parts.length === 0) return { street: "", ward: "", district: "", province: "", confidence: 0 };
      
      let province = "";
      let district = "";
      let ward = "";
      let street = "";
      let confidence = 0;
      let isTwoLevel = false;
      
      let currentIdx = parts.length - 1;
      
      // 1. Kiểm tra phần cuối cùng có phải là quốc gia
      if (currentIdx >= 0) {
        const lastPart = parts[currentIdx];
        if (["việt nam", "viet nam", "vn"].includes(lastPart)) {
          currentIdx--;
        }
      }
      
      // 2. Phân tích Tỉnh/Thành phố
      if (currentIdx >= 0) {
        const part = parts[currentIdx];
        const stdProv = AddressAliases.getStandardProvince(part);
        
        const cityToDistrictMapping = {
          "đà lạt": "Thành phố Đà Lạt",
          "nha trang": "Thành phố Nha Trang",
          "buôn ma thuột": "Thành phố Buôn Ma Thuột",
          "buon ma thuot": "Thành phố Buôn Ma Thuột",
          "vinh": "Thành phố Vinh",
          "huế": "Thành phố Huế",
          "hue": "Thành phố Huế",
          "quy nhơn": "Thành phố Quy Nhơn",
          "quy nhon": "Thành phố Quy Nhơn",
          "tuy hòa": "Thành phố Tuy Hòa",
          "tuy hoa": "Thành phố Tuy Hòa",
          "pleiku": "Thành phố Pleiku",
          "phan rang": "Thành phố Phan Rang - Tháp Chàm",
          "phan thiết": "Thành phố Phan Thiết",
          "phan thiet": "Thành phố Phan Thiết",
          "mỹ tho": "Thành phố Mỹ Tho",
          "my tho": "Thành phố Mỹ Tho",
          "long xuyên": "Thành phố Long Xuyên",
          "long xuyen": "Thành phố Long Xuyên",
          "rạch giá": "Thành phố Rạch Giá",
          "rach gia": "Thành phố Rạch Giá",
          "cao lãnh": "Thành phố Cao Lãnh",
          "cao lanh": "Thành phố Cao Lãnh",
          "hạ long": "Thành phố Hạ Long",
          "ha long": "Thành phố Hạ Long"
        };

        const isPrefixedNonProvince = /^(quận|huyện|thị xã|phường|xã|q\.|h\.|p\.|x\.|tx\.)\s/i.test(part);

        if (!isPrefixedNonProvince && stdProv && ADM_DB.provinces.some(p => p.name === stdProv)) {
          province = stdProv;
          confidence += 30;
          
          const cleanPart = part.trim().toLowerCase().replace(/^(thành phố|tp\.?)\s+/i, '').trim();
          if (cityToDistrictMapping[cleanPart]) {
            district = cityToDistrictMapping[cleanPart];
            confidence += 20;
          }
          currentIdx--;
        } else if (!isPrefixedNonProvince) {
          // Thử tìm khớp gần đúng tỉnh
          const provNames = ADM_DB.provinces.map(p => p.name);
          const matchRes = AddressFuzzy.findBestMatch(part, provNames, 0.75);
          if (matchRes.match) {
            province = matchRes.match;
            confidence += 25;
            
            const cleanPart = part.trim().toLowerCase().replace(/^(thành phố|tp\.?)\s+/i, '').trim();
            if (cityToDistrictMapping[cleanPart]) {
              district = cityToDistrictMapping[cleanPart];
              confidence += 20;
            }
            currentIdx--;
          }
        }

        // Nếu phần cuối không phải là Tỉnh (vd: text thiếu tỉnh, chỉ có "Quận Sơn Trà"), thử tìm District trên toàn quốc
        if (!province) {
          const cleanPart = part.replace(/^(quận|huyện|thị xã|thành phố|tp\.?|q\.?|h\.?)\s+/i, '').trim().toLowerCase();
          let foundDist = null;
          if (typeof ADM_DB !== 'undefined') {
            for (const provName of Object.keys(ADM_DB.districts || {})) {
              const dists = ADM_DB.districts[provName] || [];
              for (const dist of dists) {
                const dName = dist.name.toLowerCase();
                const dNameNoPrefix = dist.name.replace(/^(quận|huyện|thị xã|thành phố|tp\.?)\s+/i, '').trim().toLowerCase();
                const aliases = (dist.aliases || []).map(a => a.toLowerCase());
                if (dName === cleanPart || dNameNoPrefix === cleanPart || aliases.includes(cleanPart)) {
                  foundDist = { district: dist.name, province: provName };
                  break;
                }
              }
              if (foundDist) break;
            }
          }
          if (foundDist) {
            district = foundDist.district;
            province = foundDist.province;
            confidence += 40;
            currentIdx--;
          }
        }
      }
      
      // 3. Phân tích Quận/Huyện (chỉ thực hiện nếu chưa được nhận diện qua mapping)
      if (!district && province && currentIdx >= 0) {
        const part = parts[currentIdx];
        const stdDist = AddressAliases.getStandardDistrict(province, part);
        const districts = ADM_DB.districts[province] || [];
        if (stdDist && districts.some(d => d.name === stdDist)) {
          district = stdDist;
          confidence += 30;
          currentIdx--;
        } else {
          const isWardPrefixed = /^(phường|xã|thị trấn|p\.|x\.)\s/i.test(part);
          const cleanPartLow = normTone(part.replace(/^(phường|xã|thị trấn|p\.|x\.)\s+/i, '').trim());

          // 3.0. Ưu tiên kiểm tra Đơn vị Hành chính Cấp 2 mới (NEW_ADM_DB 2025 trực thuộc Tỉnh/TP)
          let found2LevelWard = null;
          let newAdmDb = null;
          if (typeof globalThis !== 'undefined' && globalThis.NEW_ADM_DB) newAdmDb = globalThis.NEW_ADM_DB;
          else if (typeof window !== 'undefined' && window.NEW_ADM_DB) newAdmDb = window.NEW_ADM_DB;
          else if (typeof NEW_ADM_DB !== 'undefined') newAdmDb = NEW_ADM_DB;

          if (newAdmDb) {
            const _pp = (val) => normTone(String(val || '')).replace(/^(tinh|thanh pho|tp\.?|t\.?)\s+/, '').trim();
            const matchProv = newAdmDb.provinces.find(p => _pp(p.name) === _pp(province));
            if (matchProv) {
              const newWards = newAdmDb.wards[matchProv.name] || [];
              found2LevelWard = newWards.find(w => {
                const nwClean = normTone(w.name.replace(/^(phường|xã|thị trấn|p\.|x\.)\s+/i, '').trim());
                return nwClean === cleanPartLow || normTone(w.name) === cleanPartLow;
              });
            }
          }

          if (found2LevelWard) {
            let assignedWard = found2LevelWard.name;
            if (/^(?:phường|phuong|p\.)/i.test(part) && /^xã\s+/i.test(assignedWard)) {
              assignedWard = assignedWard.replace(/^xã\s+/i, 'Phường ');
            }
            ward = assignedWard;
            district = '';
            isTwoLevel = true;
            confidence += 45;
            currentIdx--;
          } else {
            // 1. Ưu tiên: kiểm tra xem tên có trùng với tên Quận/Huyện trong tỉnh không (vd: "Phường Thanh Xuân" tại Hà Nội -> Quận Thanh Xuân)
            const matchedDistByName = districts.find(d => {
            const dBase = normTone(d.name.replace(/^(quận|huyện|thị xã|thành phố|tp\.?|q\.)\s+/i, '').trim());
            const dAliases = (d.aliases || []).map(a => normTone(a.replace(/^(quận|huyện|thị xã|thành phố|tp\.?|q\.)\s+/i, '').trim()));
            return dBase === cleanPartLow || dAliases.includes(cleanPartLow);
          });

          if (matchedDistByName) {
            district = matchedDistByName.name;
            if (isWardPrefixed) {
              // Lưu lại tên phường cho trường hợp địa chỉ 2 cấp mới (vd: Phường Thanh Xuân)
              ward = part.trim();
            }
            confidence += 35;
            currentIdx--;
          } else {
            // 2. KIỂM TRA ĐỊA CHỈ 2 CẤP: Part có phải CHÍNH LÀ TÊN XÃ/PHƯỜNG THUỘC TỈNH KHÔNG (vd: "Xuân Phương", "chuyên mỹ", "vân từ")
            // CỰC KỲ QUAN TRỌNG: Phải kiểm tra Xã/Phường CHÍNH XÁC TRƯỚC KHI FUZZY MATCH Quận/Huyện, tránh "Xuân Phương" bị fuzzy match nhầm sang "Đan Phượng"!
            let foundWardAsPart = null;
            for (const d of districts) {
              const distWards = ADM_DB.wards[province + "|" + d.name] || ADM_DB.wards[d.name] || [];
              for (const w of distWards) {
                const wClean = normTone(w.replace(/^(phường|xã|thị trấn|p\.|x\.)\s+/i, '').trim());
                // Tránh nhầm lẫn: nếu input rõ ràng có tiền tố "phường", không map vào đơn vị cấp "xã"
                const isDbWardXa = /^xã\s/i.test(w);
                const isInputPhuong = /^phường\s/i.test(part);
                if (isInputPhuong && isDbWardXa) continue;

                if (wClean === cleanPartLow || normTone(w) === cleanPartLow) {
                  foundWardAsPart = { ward: w, district: d.name };
                  break;
                }
              }
              if (foundWardAsPart) break;
            }

            if (foundWardAsPart) {
              district = foundWardAsPart.district;
              ward = foundWardAsPart.ward;
              confidence += 40;
              currentIdx--;
            } else {
              // 3. Chỉ khi KHÔNG PHẢI Xã/Phường chính xác, mới tìm khớp gần đúng (Fuzzy match) các quận trong tỉnh
              let matchRes = { match: null, score: 0 };
              if (!isWardPrefixed) {
                const distNames = districts.map(d => d.name);
                matchRes = AddressFuzzy.findBestMatch(part, distNames, 0.7);
              }
              if (matchRes.match) {
                district = matchRes.match;
                confidence += 25;
                currentIdx--;
              } else {
                // KIỂM TRA PHÁT HIỆN DISTRICT SAI/LỖI CHÍNH TẢ:
                let isNextPartWard = false;
                if (currentIdx > 0) {
                  const nextPart = parts[currentIdx - 1];
                  const cleanNext = nextPart.replace(/^(phường|xã|thị trấn|p\.|x\.)\s+/i, '').trim();
                  
                  for (const d of districts) {
                    const distWards = ADM_DB.wards[province + "|" + d.name] || ADM_DB.wards[d.name] || [];
                    if (distWards.some(w => w.toLowerCase() === cleanNext.toLowerCase() || w.toLowerCase() === nextPart.toLowerCase())) {
                      isNextPartWard = true;
                      break;
                    }
                  }
                }

                if (isNextPartWard || /^(quận|huyện|thành phố|tp|q\.|h\.)/i.test(part)) {
                  district = part;
                  confidence += 15;
                  currentIdx--;
                }
              }
            }
          }
        }
      }
    } else if (!district && currentIdx >= 0) {
        const part = parts[currentIdx];
        if (/^(quận|huyện|thành phố|tp|q\.|h\.)/i.test(part)) {
          district = part;
          confidence += 15;
          currentIdx--;
        } else {
          // Thử tìm tên quận/huyện không có tiền tố (vd: "Gò Vấp", "Bình Thạnh")
          const cleanPart = part.replace(/^(thành phố|tp\.?)\s+/i, '').trim().toLowerCase();
          let foundDist = null;
          if (typeof ADM_DB !== 'undefined') {
            for (const provName of Object.keys(ADM_DB.districts || {})) {
              const dists = ADM_DB.districts[provName] || [];
              for (const dist of dists) {
                const dName = dist.name.toLowerCase();
                const dNameNoPrefix = dist.name.replace(/^(quận|huyện|thị xã|thành phố|tp\.?)\s+/i, '').trim().toLowerCase();
                if (dName === cleanPart || dNameNoPrefix === cleanPart) {
                  foundDist = { district: dist.name, province: provName };
                  break;
                }
              }
              if (foundDist) break;
            }
          }
          if (foundDist) {
            district = foundDist.district;
            province = foundDist.province;
            confidence += 35;
            currentIdx--;
          }
        }
      }
      
      // 4. Phân tích Xã/Phường (chỉ thực hiện nếu chưa có ward)
      if (!ward) {
        if (district && currentIdx >= 0) {
          const part = parts[currentIdx];
          const wards = ADM_DB.wards[province + "|" + district] || ADM_DB.wards[district] || [];
          const cleanPart = part.replace(/^(phường|xã|thị trấn|p\.|x\.)\s+/i, '').trim();
          
          let matchedWard = null;
          let streetRemainder = "";

          for (const w of wards) {
            const wClean = w.replace(/^(phường|xã|thị trấn|p\.|x\.)\s+/i, '').trim().toLowerCase();
            const wFull = w.toLowerCase();
            const pClean = cleanPart.toLowerCase();

            if (pClean === wClean || pClean === wFull) {
              matchedWard = w;
              break;
            } else if (pClean.endsWith(" " + wClean)) {
              matchedWard = w;
              streetRemainder = cleanPart.substring(0, cleanPart.length - wClean.length).trim();
              break;
            } else if (pClean.endsWith(" " + wFull)) {
              matchedWard = w;
              streetRemainder = cleanPart.substring(0, cleanPart.length - wFull.length).trim();
              break;
            } else if (wClean.startsWith(pClean) || pClean.startsWith(wClean)) {
              matchedWard = w;
              break;
            }
          }

          if (matchedWard) {
            ward = matchedWard;
            confidence += 30;
            if (streetRemainder) {
              parts[currentIdx] = streetRemainder;
            } else {
              currentIdx--;
            }
          } else {
            // Thử tìm khớp gần đúng
            const matchRes = AddressFuzzy.findBestMatch(cleanPart, wards, 0.75);
            if (matchRes.match) {
              ward = matchRes.match;
              confidence += 25;
              currentIdx--;
            } else {
              // Cross-District Validation:
              // Khách có thể ghi nhầm Quận giáp ranh (vd: "An Khê , cẩm lệ , đà nẵng" trong khi An Khê thuộc Quận Thanh Khê)
              let crossDistrictMatch = null;
              const districtsOfProv = ADM_DB.districts[province] || [];
              const cleanPartNorm = normTone(cleanPart);
              for (const d of districtsOfProv) {
                if (d.name === district) continue;
                const dWards = ADM_DB.wards[province + "|" + d.name] || ADM_DB.wards[d.name] || [];
                for (const dw of dWards) {
                  const dwClean = normTone(dw.replace(/^(phường|xã|thị trấn|p\.|x\.)\s+/i, '').trim());
                  if (dwClean === cleanPartNorm || normTone(dw) === cleanPartNorm) {
                    crossDistrictMatch = { ward: dw, district: d.name };
                    break;
                  }
                }
                if (crossDistrictMatch) break;
              }

              if (crossDistrictMatch) {
                ward = crossDistrictMatch.ward;
                district = crossDistrictMatch.district;
                confidence += 30;
                currentIdx--;
              } else if (/^(phường|xã|thị trấn|p\.|x\.)/i.test(part)) {
                ward = part;
                confidence += 15;
                currentIdx--;
              }
            }
          }
        } else if (province && currentIdx >= 0) {
          const part = parts[currentIdx];
          const cleanPart = part.replace(/^(phường|xã|thị trấn|p\.|x\.)\s+/i, '').trim();
          
          let resolvedWard = "";
          let resolvedDist = "";
          let streetRemainder = "";
          const districtsOfProv = ADM_DB.districts[province] || [];

          for (const dist of districtsOfProv) {
            const distWards = ADM_DB.wards[province + "|" + dist.name] || ADM_DB.wards[dist.name] || [];
            for (const w of distWards) {
              const wClean = w.replace(/^(phường|xã|thị trấn|p\.|x\.)\s+/i, '').trim().toLowerCase();
              const wFull = w.toLowerCase();
              const pClean = cleanPart.toLowerCase();

              if (pClean === wClean || pClean === wFull) {
                resolvedWard = w;
                resolvedDist = dist.name;
                break;
              } else if (pClean.endsWith(" " + wClean)) {
                resolvedWard = w;
                resolvedDist = dist.name;
                streetRemainder = cleanPart.substring(0, cleanPart.length - wClean.length).trim();
                break;
              } else if (pClean.endsWith(" " + wFull)) {
                resolvedWard = w;
                resolvedDist = dist.name;
                streetRemainder = cleanPart.substring(0, cleanPart.length - wFull.length).trim();
                break;
              } else if (wClean.startsWith(pClean) || pClean.startsWith(wClean)) {
                resolvedWard = w;
                resolvedDist = dist.name;
                break;
              }
            }
            if (resolvedWard) break;
          }
          
          if (resolvedWard) {
            ward = resolvedWard;
            if (!district) district = resolvedDist;
            confidence += 30;
            if (streetRemainder) {
              parts[currentIdx] = streetRemainder;
            } else {
              currentIdx--;
            }
          } else if (/^(phường|xã|thị trấn|p\.|x\.)/i.test(part)) {
            ward = part;
            confidence += 15;
            currentIdx--;
          }
        } else if (currentIdx >= 0) {
          const part = parts[currentIdx];
          if (/^(phường|xã|thị trấn|p\.|x\.)/i.test(part)) {
            ward = part;
            confidence += 15;
            currentIdx--;
          }
        }
      }
      
      // Fallback cho địa chỉ không có dấu phẩy hoặc dấu phẩy đặt sai vị trí hoặc địa chỉ 2 cấp mới thiếu quận/huyện
      if (!isTwoLevel && (!province || (!district && !ward) || (!ward && district))) {
        const noCommaAddress = normalizedAddress.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
        const parsedNoCommas = this.tryToSplitWithoutCommas(noCommaAddress);
        if (parsedNoCommas.province && (parsedNoCommas.district || parsedNoCommas.ward)) {
          province = parsedNoCommas.province;
          district = parsedNoCommas.district;
          ward = parsedNoCommas.ward;
          street = parsedNoCommas.street;
          
          confidence = 10;
          if (province) confidence += 30;
          if (district) confidence += 30;
          if (ward) confidence += 30;
          
          currentIdx = -1; // Bỏ qua phần streetParts bên dưới
        }
      }
      
      // 5. Phần còn lại ở phía bên trái là Số nhà/Đường
      if (currentIdx >= 0) {
        const streetParts = [];
        for (let i = 0; i <= currentIdx; i++) {
          streetParts.push(parts[i]);
        }
        street = streetParts.join(', ').trim();
      }
      
      if (street) {
        confidence += 10;
      }

      // Hàm chuẩn hóa viết hoa chữ cái đầu cho các từ trong địa phương
      const capitalizeAddressLevel = (str) => {
        if (!str) return "";
        let s = str.trim();
        return s.split(/\s+/).map(word => {
          if (!word) return "";
          if (/^[0-9]+$/.test(word)) return word;
          return word.charAt(0).toUpperCase() + word.slice(1);
        }).join(' ');
      };

      // Chuẩn hóa viết hoa cho District & Province
      let formattedDistrict = district ? capitalizeAddressLevel(district) : "";
      if (formattedDistrict) {
        formattedDistrict = formattedDistrict
          .replace(/^Thành Phố\b/i, "Thành phố")
          .replace(/^Thị Xã\b/i, "Thị xã")
          .replace(/^Thị Trấn\b/i, "Thị trấn");
      }

      let formattedProvince = province ? capitalizeAddressLevel(province) : "";
      if (formattedProvince) {
        formattedProvince = formattedProvince.replace(/^Thành Phố\b/i, "Thành phố");
      }

      // Chuẩn hóa viết hoa cho Ward
      let formattedWard = ward ? capitalizeAddressLevel(ward) : "";
      if (formattedWard) {
        formattedWard = formattedWard.replace(/^Thị Trấn\b/i, "Thị trấn");
        if (!formattedWard.startsWith('Phường') && !formattedWard.startsWith('Xã') && !formattedWard.startsWith('Thị trấn')) {
          if (/^[0-9]+$/.test(formattedWard) || (formattedDistrict && formattedDistrict.startsWith('Quận'))) {
            formattedWard = 'Phường ' + formattedWard;
          }
        }
      }
      
      return {
        street: capitalizeAddressLevel(street),
        ward: formattedWard,
        district: formattedDistrict,
        province: formattedProvince,
        confidence: Math.min(confidence, 100),
        isTwoLevel: Boolean(isTwoLevel || (!formattedDistrict && formattedWard && formattedProvince))
      };
    }
  };

  globalThis.AddressParser = AddressParser;
})();
