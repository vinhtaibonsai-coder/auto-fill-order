(() => {
  const AddressValidator = {
    validate(parsedAddress) {
      const { province, district, ward } = parsedAddress;
      if (!province || !district || !ward) return false;
      
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
