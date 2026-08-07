(() => {
  const AddressNormalizer = {
    normalize(address) {
      if (!address) return "";
      
      // 1. Đưa về Unicode NFC chuẩn
      let clean = address.normalize('NFC').trim().toLowerCase();
      
      // 2. Thay thế các ký tự phân cách thừa bằng khoảng trắng (giữ lại dấu phẩy để tách cấp)
      clean = clean.replace(/[.;\-_\\]+/g, ' ');
      
      // 3. Chuẩn hóa khoảng trắng
      clean = clean.replace(/\s+/g, ' ');
      
      // 4. Chuẩn hóa các viết tắt đơn lẻ có ranh giới từ (sử dụng Unicode property escape để tránh lỗi dấu tiếng Việt)
      clean = clean.replace(/(?<!\p{L})p(?!\p{L})\.?/gu, 'phường');
      clean = clean.replace(/(?<!\p{L})q(?!\p{L})\.?/gu, 'quận');
      clean = clean.replace(/(?<!\p{L})tp(?!\p{L})\.?/gu, 'thành phố');
      clean = clean.replace(/(?<!\p{L})tx(?!\p{L})\.?/gu, 'thị xã');
      clean = clean.replace(/(?<!\p{L})h(?!\p{L})\.?/gu, 'huyện');
      clean = clean.replace(/(?<!\p{L})tt(?!\p{L})\.?/gu, 'thị trấn');
      clean = clean.replace(/(?<!\p{L})x(?!\p{L})\.?/gu, 'xã');
      
      // 5. Chuẩn hóa dạng viết tắt dính số (vd: q1 -> quận 1, p12 -> phường 12)
      clean = clean.replace(/\bq([0-9]+)\b/g, 'quận $1');
      clean = clean.replace(/\bp([0-9]+)\b/g, 'phường $1');
      
      return clean.trim();
    }
  };

  globalThis.AddressNormalizer = AddressNormalizer;
})();
