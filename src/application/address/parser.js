(() => {
  const AddressParser = {
    tryToSplitWithoutCommas(addressStr) {
      if (typeof ADM_DB === 'undefined') return { street: addressStr, ward: "", district: "", province: "" };
      let s = addressStr.trim();
      let province = "";
      let district = "";
      let ward = "";
      let street = "";
      
      let foundProv = null;
      let sLow = s.toLowerCase();
      
      for (const prov of ADM_DB.provinces) {
        const pName = prov.name.toLowerCase();
        const pNameNoPrefix = prov.name.replace(/^(tỉnh|thành phố|tp\.?|t\.?)\s+/i, '').trim().toLowerCase();
        const aliases = (prov.aliases || []).map(a => a.toLowerCase());
        const candidateNames = [pName, pNameNoPrefix, ...aliases].filter(Boolean);
        candidateNames.sort((a,b) => b.length - a.length);
        
        for (const cand of candidateNames) {
          let idx = sLow.lastIndexOf(cand);
          if (idx !== -1 && (idx === 0 || sLow[idx - 1] === ' ')) {
            const after = sLow.substring(idx + cand.length).trim();
            if (!after || /^(đơn|ko|không|chưa|nhé|nha|nghe|ơi|ạ|cho|xem|giao|kiểm)\b/i.test(after)) {
              let startIndex = idx;
              const beforeStr = sLow.substring(0, idx).trimEnd();
              const prefixMatch = beforeStr.match(/(?:tỉnh|tinh|thành\s*phố|thanh\s*pho|tp\.?|t\.?)$/i);
              if (prefixMatch) {
                startIndex = beforeStr.length - prefixMatch[0].length;
              }
              foundProv = { name: prov.name, length: cand.length, index: startIndex };
              break;
            }
          }
        }
        if (foundProv) break;
      }
      
      if (foundProv) {
        province = foundProv.name;
        s = s.substring(0, foundProv.index).trim();
        sLow = s.toLowerCase();
        
        const districts = ADM_DB.districts[province] || [];
        let foundDist = null;
        for (const dist of districts) {
          const dName = dist.name.toLowerCase();
          const dNameNoPrefix = dist.name.replace(/^(quận|huyện|thị xã|thành phố|tp\.?)\s+/i, '').trim().toLowerCase();
          const aliases = (dist.aliases || []).map(a => a.toLowerCase());
          const candidateNames = [dName, dNameNoPrefix, ...aliases].filter(Boolean);
          candidateNames.sort((a,b) => b.length - a.length);
          
          for (const cand of candidateNames) {
            if (sLow.endsWith(cand)) {
              const idx = sLow.lastIndexOf(cand);
              if (idx === 0 || sLow[idx - 1] === ' ') {
                let startIndex = idx;
                const beforeStr = sLow.substring(0, idx).trimEnd();
                const prefixMatch = beforeStr.match(/(?:quận|quan|huyện|huyen|thị\s*xã|thi\s*xa|thành\s*phố|thanh\s*pho|tp\.?|q\.?|h\.?)$/i);
                if (prefixMatch) {
                  startIndex = beforeStr.length - prefixMatch[0].length;
                }
                foundDist = { name: dist.name, length: cand.length, index: startIndex };
                break;
              }
            }
          }
          if (foundDist) break;
        }
        
        if (foundDist) {
          district = foundDist.name;
          s = s.substring(0, foundDist.index).trim();
          sLow = s.toLowerCase();
          
          const key = province + "|" + district;
          const wards = ADM_DB.wards[key] || ADM_DB.wards[district] || [];
          let foundWard = null;
          for (const w of wards) {
            const wName = w.toLowerCase();
            const wNameNoPrefix = w.replace(/^(phường|xã|thị trấn|p\.|x\.)\s+/i, '').trim().toLowerCase();
            const candidateNames = [wName, wNameNoPrefix].filter(Boolean);
            candidateNames.sort((a,b) => b.length - a.length);
            
            for (const cand of candidateNames) {
              if (sLow.endsWith(cand)) {
                const idx = sLow.lastIndexOf(cand);
                if (idx === 0 || sLow[idx - 1] === ' ') {
                  let startIndex = idx;
                  const beforeStr = sLow.substring(0, idx).trimEnd();
                  const prefixMatch = beforeStr.match(/(?:phường|phuong|xã|xa|thị\s*trấn|thi\s*tran|p\.?|x\.?|tt\.?)$/i);
                  if (prefixMatch) {
                    startIndex = beforeStr.length - prefixMatch[0].length;
                  }
                  foundWard = { name: w, length: cand.length, index: startIndex };
                  break;
                }
              }
            }
            if (foundWard) break;
          }
          
          if (foundWard) {
            ward = foundWard.name;
            street = s.substring(0, foundWard.index).trim();
          } else {
            street = s;
          }
        } else {
          // Thử tìm phường/xã trực tiếp thuộc tỉnh khi không có quận/huyện trong chuỗi
          let foundWard = null;
          for (const dist of districts) {
            const key = province + "|" + dist.name;
            const wards = ADM_DB.wards[key] || ADM_DB.wards[dist.name] || [];
            for (const w of wards) {
              const wName = w.toLowerCase();
              const wNameNoPrefix = w.replace(/^(phường|xã|thị trấn|p\.|x\.)\s+/i, '').trim().toLowerCase();
              const candidateNames = [wName, wNameNoPrefix].filter(Boolean);
              candidateNames.sort((a,b) => b.length - a.length);
              
              for (const cand of candidateNames) {
                if (sLow.endsWith(cand)) {
                  const idx = sLow.lastIndexOf(cand);
                  if (idx === 0 || sLow[idx - 1] === ' ') {
                    let startIndex = idx;
                    const beforeStr = sLow.substring(0, idx).trimEnd();
                    const prefixMatch = beforeStr.match(/(?:phường|phuong|xã|xa|thị\s*trấn|thi\s*tran|p\.?|x\.?|tt\.?)$/i);
                    if (prefixMatch) {
                      startIndex = beforeStr.length - prefixMatch[0].length;
                    }
                    foundWard = { name: w, distName: dist.name, length: cand.length, index: startIndex };
                    break;
                  }
                }
              }
              if (foundWard) break;
            }
            if (foundWard) break;
          }

          if (foundWard) {
            ward = foundWard.name;
            district = foundWard.distName;
            street = s.substring(0, foundWard.index).trim();
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
      
      // Phân tách qua dấu phẩy và lọc bỏ phần tử rác chỉ chứa từ khóa hành chính chung chung (ví dụ: "Phường", "Quận") do AI điền sai
      const parts = normalizedAddress.split(',')
        .map(p => p.replace(/\s*\([^)]*\)?/g, '').trim())
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

        if (stdProv && ADM_DB.provinces.some(p => p.name === stdProv)) {
          province = stdProv;
          confidence += 30;
          
          const cleanPart = part.trim().toLowerCase().replace(/^(thành phố|tp\.?)\s+/i, '').trim();
          if (cityToDistrictMapping[cleanPart]) {
            district = cityToDistrictMapping[cleanPart];
            confidence += 20;
          }
          currentIdx--;
        } else {
          // Thử tìm khớp gần đúng
          const provNames = ADM_DB.provinces.map(p => p.name);
          const matchRes = AddressFuzzy.findBestMatch(part, provNames, 0.7);
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
          // Tìm khớp gần đúng các quận trong tỉnh đó
          // KHÔNG fuzzy-match nếu part bắt đầu bằng tiền tố phường/xã (vì dễ nhầm quận)
          const isWardPrefixed = /^(phường|xã|thị trấn|p\.|x\.)\s/i.test(part);
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
            // Nếu phần tiếp theo (currentIdx - 1) là một xã/phường hợp lệ trong tỉnh này,
            // thì phần hiện tại chắc chắn phải là quận/huyện (dù viết sai chính tả).
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
      
      // 4. Phân tích Xã/Phường
      if (district && currentIdx >= 0) {
        const part = parts[currentIdx];
        const wards = ADM_DB.wards[province + "|" + district] || ADM_DB.wards[district] || [];
        const cleanPart = part.replace(/^(phường|xã|thị trấn|p\.|x\.)\s+/i, '').trim();
        
        const matchedWard = wards.find(w => w.toLowerCase() === cleanPart.toLowerCase() || w.toLowerCase() === part.toLowerCase());
        if (matchedWard) {
          ward = matchedWard;
          confidence += 30;
          currentIdx--;
        } else {
          // Thử tìm khớp gần đúng
          const matchRes = AddressFuzzy.findBestMatch(cleanPart, wards, 0.75);
          if (matchRes.match) {
            ward = matchRes.match;
            confidence += 25;
            currentIdx--;
          } else if (/^(phường|xã|thị trấn|p\.|x\.)/i.test(part)) {
            ward = part;
            confidence += 15;
            currentIdx--;
          }
        }
      } else if (province && currentIdx >= 0) {
        const part = parts[currentIdx];
        const cleanPart = part.replace(/^(phường|xã|thị trấn|p\.|x\.)\s+/i, '').trim();
        
        let resolvedWard = "";
        const districtsOfProv = ADM_DB.districts[province] || [];
        for (const dist of districtsOfProv) {
          const distWards = ADM_DB.wards[province + "|" + dist.name] || ADM_DB.wards[dist.name] || [];
          const found = distWards.find(w => w.toLowerCase() === cleanPart.toLowerCase() || w.toLowerCase() === part.toLowerCase());
          if (found) {
            resolvedWard = found;
            break;
          }
        }
        
        if (resolvedWard) {
          ward = resolvedWard;
          confidence += 20;
          currentIdx--;
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
      
      // Fallback cho địa chỉ không có dấu phẩy hoặc dấu phẩy đặt sai vị trí
      if (!province || !district) {
        const noCommaAddress = normalizedAddress.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
        const parsedNoCommas = this.tryToSplitWithoutCommas(noCommaAddress);
        if (parsedNoCommas.province && parsedNoCommas.district) {
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

      // Chuẩn hóa viết hoa cho Ward
      let formattedWard = ward ? capitalizeAddressLevel(ward) : "";
      if (formattedWard) {
        formattedWard = formattedWard.replace(/^Thị Trấn\b/i, "Thị trấn");
        if (!formattedWard.startsWith('Phường') && !formattedWard.startsWith('Xã') && !formattedWard.startsWith('Thị trấn')) {
          formattedWard = /^[0-9]+$/.test(formattedWard) ? 'Phường ' + formattedWard : formattedWard;
        }
      }

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
      
      return {
        street: capitalizeAddressLevel(street),
        ward: formattedWard,
        district: formattedDistrict,
        province: formattedProvince,
        confidence: Math.min(confidence, 100)
      };
    }
  };

  globalThis.AddressParser = AddressParser;
})();
