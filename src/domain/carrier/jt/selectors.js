(() => {
  const JT_SELECTORS = {
    phoneLabels: [/Số điện thoại/i, /SĐT/i, /Phone/i],
    phoneFallbacks: [
      'input[placeholder="Nhập số điện thoại"]',
      'input[placeholder*="số điện thoại" i]',
      'input[placeholder*="SĐT" i]',
      'input[placeholder*="phone" i]',
      'input[type="tel"]'
    ],
    nameLabels: [/Tên người nhận/i, /Người nhận/i, /Họ tên/i],
    nameFallbacks: [
      'input[placeholder="Nhập tên người nhận"]',
      'input[placeholder*="tên người nhận" i]',
      'input[placeholder*="tên khách hàng" i]'
    ],
    addressLabels: [/Địa chỉ/i, /Số nhà\/ đường\/ ngõ/i, /địa chỉ cũ/i, /3 cấp/i],
    addressFallbacks: [
      'input[placeholder*="địa chỉ cũ" i]',
      'input[placeholder*="3 cấp" i]',
      'input[placeholder*="địa chỉ cũ - 3 cấp" i]',
      'input[placeholder*="địa chỉ cũ-3 cấp" i]',
      'input[placeholder="Nhập địa chỉ (Số nhà/ đường/ ngõ/ tòa nhà...)"]',
      'textarea[placeholder*="địa chỉ cũ" i]',
      'textarea[placeholder*="3 cấp" i]',
      'input[placeholder*="nhập địa chỉ" i]',
      'textarea[placeholder*="nhập địa chỉ" i]',
      'input[placeholder="Số nhà/ đường/ ngõ..."]',
      'input[placeholder*="Số nhà/ đường/ ngõ"]',
      'textarea[placeholder*="Số nhà/ đường/ ngõ"]',
      'input[placeholder*="Địa chỉ chi tiết" i]',
      'textarea[placeholder*="Địa chỉ chi tiết" i]'
    ],
    codeLabels: [/Mã đơn hàng/i, /Mã đơn/i],
    codeFallbacks: [
      'input[placeholder*="mã đơn hàng" i]',
      'input[placeholder*="đơn hàng riêng" i]',
      '#customerOrderCode',
      'input[placeholder*="order code" i]'
    ],
    goodsLabels: [/Tên sản phẩm/i, /Tên hàng hóa/i, /Hàng hóa/i],
    goodsFallbacks: [
      'textarea[placeholder*="tên sản phẩm" i]',
      'textarea[placeholder*="tên hàng" i]',
      'input[placeholder="Nhập tên sản phẩm"]',
      'input[placeholder*="tên sản phẩm" i]',
      'input[placeholder*="tên hàng" i]'
    ],
    weightLabels: [/Trọng lượng/i, /Khối lượng/i],
    weightFallbacks: [
      'input[placeholder="Nhập trọng lượng"]',
      'input[placeholder*="trọng lượng" i]',
      'input[placeholder*="khối lượng" i]'
    ],
    noteLabels: [/Nội dung/i, /Ghi chú/i],
    noteFallbacks: [
      'textarea[placeholder*="Nội dung" i]',
      'input[placeholder*="Ghi chú" i]',
      'textarea[placeholder*="Ghi chú" i]'
    ],
    codLabels: [/Tiền thu hộ/i, /Thu hộ/i, /Số tiền COD/i],
    codFallbacks: [
      'input[placeholder*="nhập số tiền" i]',
      'input[placeholder*="số tiền" i]',
      'input[placeholder="Nhập số tiền"]',
      'input[placeholder*="tiền thu hộ" i]',
      '#money'
    ],
    radioPaymentLabels: 'label.el-radio',
    accountSelectors: [
      '.user-name',
      '.username',
      '.header-user',
      '.avatar-wrapper',
      '.el-dropdown-link .user-name',
      '.el-dropdown-link',
      '.customer-name',
      '.user-info__name',
      '[class*="user-name"]',
      '[class*="userName"]',
      '.header-right .name',
      '.navbar-user',
      '.header-account',
      '.shop-name'
    ],
    getAccountName: function() {
      try {
        // 1. Quét DOM
        for (const sel of this.accountSelectors) {
          const els = document.querySelectorAll(sel);
          for (const el of els) {
            if (!el || (el.offsetParent === null && el.offsetWidth === 0)) continue;
            const clone = el.cloneNode(true);
            const icons = clone.querySelectorAll('svg, i, .el-icon, [class*="icon"], [class*="arrow"]');
            icons.forEach(i => i.remove());
            const text = (clone.textContent || '').trim().replace(/\s+/g, ' ');
            if (text && text.length >= 2 && text.length <= 60 && !/^(đăng nhập|login|tài khoản|thông báo|tiếng việt|vn|en)$/i.test(text)) {
              return text;
            }
          }
        }
        // 2. Quét localStorage/sessionStorage
        const storageKeys = ['userInfo', 'user_info', 'user', 'customerInfo', 'customer', 'loginUser', 'userData', 'auth'];
        for (const key of storageKeys) {
          const val = localStorage.getItem(key) || sessionStorage.getItem(key);
          if (val) {
            try {
              const parsed = typeof val === 'string' && (val.startsWith('{') || val.startsWith('[')) ? JSON.parse(val) : val;
              const name = parsed?.customerName || parsed?.customer_name || parsed?.fullName || parsed?.full_name || parsed?.name || parsed?.userName || parsed?.username || parsed?.nickName;
              if (name && typeof name === 'string' && name.length >= 2) return name.trim();
            } catch (_) {}
          }
        }
        // 3. Quét thông tin người gửi trên trang nếu có
        const senderEl = document.querySelector('input#senderName, input[name*="sender" i], input[placeholder*="người gửi" i], input[placeholder*="tên người gửi" i]');
        if (senderEl && senderEl.value && senderEl.value.trim().length >= 2) {
          return senderEl.value.trim();
        }
      } catch (e) {
        console.warn('JT getAccountName error:', e);
      }
      return '';
    }
  };

  globalThis.JT_SELECTORS = JT_SELECTORS;
})();
