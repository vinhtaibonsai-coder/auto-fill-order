(() => {
  const AddressValidator = {
    validate(parsedAddress) {
      const { province, district, ward, isTwoLevel } = parsedAddress;
      if (!province || !ward) return false;

      // Hỗ trợ kiểm tra đơn vị 2 cấp mới (không có district)
      if (isTwoLevel || !district) {
        let newAdmDb = null;
        if (typeof globalThis !== 'undefined' && globalThis.NEW_ADM_DB) newAdmDb = globalThis.NEW_ADM_DB;
        else if (typeof window !== 'undefined' && window.NEW_ADM_DB) newAdmDb = window.NEW_ADM_DB;
        else if (typeof NEW_ADM_DB !== 'undefined') newAdmDb = NEW_ADM_DB;

        if (newAdmDb) {
          const _pp = (val) => String(val || '').normalize('NFD').toLowerCase().replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/^(tinh|thanh pho|tp\.?|t\.?)\s+/, '').trim();
          const _pw = (val) => String(val || '').normalize('NFD').toLowerCase().replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/^(phuong|xa|thi tran|thi xa|p\.|x\.)\s+/, '').trim();
          const matchProv = newAdmDb.provinces.find(p => _pp(p.name) === _pp(province));
          if (matchProv) {
            const newWards = newAdmDb.wards[matchProv.name] || [];
            const wardNorm = _pw(ward);
            const foundWard = newWards.some(w => _pw(w.name) === wardNorm || (w.old_units || []).some(o => _pw(o) === wardNorm));
            if (foundWard) return true;
          }
        }
        return false;
      }
      
      // 1. Kiểm tra tỉnh/thành phố có tồn tại trong danh mục
      const provMatch = ADM_DB.provinces.some(p => p.name === province);
      if (!provMatch) return false;
      
      // 2. Kiểm tra quận/huyện có trực thuộc tỉnh/thành phố đó không (nếu có dữ liệu)
      const districts = ADM_DB.districts[province] || [];
      if (districts.length > 0) {
        const distMatch = districts.some(d => d.name === district);
        if (!distMatch) return false;
      }
      
      // 3. Kiểm tra xã/phường có trực thuộc quận/huyện đó không (nếu có dữ liệu)
      const wards = ADM_DB.wards[province + "|" + district] || ADM_DB.wards[district] || [];
      if (wards.length > 0) {
        const cleanWard = ward.replace(/^(phường|xã|thị trấn)\s+/i, '').trim();
        const wardMatch = wards.some(w => w.toLowerCase() === cleanWard.toLowerCase() || w.toLowerCase() === ward.toLowerCase());
        if (!wardMatch) return false;
      }
      
      return true;
    }
  };

  globalThis.AddressValidator = AddressValidator;
})();
