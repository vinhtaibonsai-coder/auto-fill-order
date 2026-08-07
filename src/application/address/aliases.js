(() => {
  const AddressAliases = {
    getStandardProvince(provName) {
      if (!provName) return "";
      const clean = provName.trim().toLowerCase();
      
      for (const prov of ADM_DB.provinces) {
        if (prov.name.toLowerCase() === clean) return prov.name;
        if (prov.aliases && prov.aliases.some(a => a.toLowerCase() === clean)) {
          return prov.name;
        }
        // Khớp tên tỉnh không có tiền tố (vd: "thành phố Nam Định" → "Tỉnh Nam Định")
        const strippedProv = prov.name.replace(/^(tỉnh|thành phố|tp\.?|t\.?)\s+/i, '').trim().toLowerCase();
        const strippedClean = clean.replace(/^(tỉnh|thành phố|tp\.?|t\.?)\s+/i, '').trim().toLowerCase();
        if (strippedProv === strippedClean) return prov.name;
        // Khớp alias khi input đã stripped prefix (vd: "quy nhơn" trong "thành phố quy nhơn")
        if (strippedClean && prov.aliases && prov.aliases.some(a => a.toLowerCase() === strippedClean)) {
          return prov.name;
        }
      }

      return provName;
    },

    getStandardDistrict(provName, distName) {
      if (!provName || !distName) return distName;
      const stdProv = this.getStandardProvince(provName);
      const districts = ADM_DB.districts[stdProv];
      if (!districts) return distName;

      const clean = distName.trim().toLowerCase();
      for (const dist of districts) {
        if (dist.name.toLowerCase() === clean) return dist.name;
        if (dist.aliases && dist.aliases.some(a => a.toLowerCase() === clean)) {
          return dist.name;
        }
        // Khớp tên quận/huyện không có tiền tố (vd: "Hồng Bàng" ↔ "Quận Hồng Bàng")
        if (/^(quận|huyện|thị xã|thành phố|tp\.?)\s+/i.test(dist.name)) {
          const stripped = dist.name.replace(/^(quận|huyện|thị xã|thành phố|tp\.?)\s+/i, '').trim().toLowerCase();
          if (stripped === clean) return dist.name;
        }
      }
      return distName;
    },

    getStandardWard(province, district, wardName) {
      if (!district || !wardName) return wardName;
      const key = province ? (province + "|" + district) : district;
      const wards = ADM_DB.wards[key] || ADM_DB.wards[district] || [];
      if (wards.length === 0) return wardName;

      const cleanPart = wardName.replace(/^(phường|xã|thị trấn|p\.|x\.)\s+/i, '').trim();
      const matchedWard = wards.find(w => w.toLowerCase() === cleanPart.toLowerCase() || w.toLowerCase() === wardName.toLowerCase());
      if (matchedWard) return matchedWard;

      if (typeof AddressFuzzy !== 'undefined') {
        const matchRes = AddressFuzzy.findBestMatch(cleanPart, wards, 0.75);
        if (matchRes.match) return matchRes.match;
      }

      return wardName;
    },

    findDistrictByWard(provinceName, wardName) {
      if (!provinceName || !wardName) return "";
      const stdProv = this.getStandardProvince(provinceName);
      const districtsOfProv = ADM_DB.districts[stdProv] || [];
      
      const cleanWard = wardName.replace(/^(phường|xã|thị trấn|p\.|x\.)\s+/i, '').trim().toLowerCase();
      
      const matches = [];
      for (const dist of districtsOfProv) {
        const distWards = ADM_DB.wards[stdProv + "|" + dist.name] || ADM_DB.wards[dist.name] || [];
        const found = distWards.some(w => w.toLowerCase() === cleanWard || w.toLowerCase() === wardName.toLowerCase());
        if (found) {
          matches.push(dist.name);
        }
      }
      
      if (matches.length === 1) {
        return matches[0];
      }
      return matches.length > 0 ? matches[0] : "";
    }
  };

  globalThis.AddressAliases = AddressAliases;
})();
