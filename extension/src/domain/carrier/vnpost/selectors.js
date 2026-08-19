(() => {
  const VNPOST_SELECTORS = {
    radioNewAddress: 'input[type="radio"], label, span',
    phoneLabels: [/Số điện thoại/i, /SĐT/i, /Phone/i, /Điện thoại nhận/i],
    phoneFallbacks: [
      '#form-create-order_receiverPhone',
      'input#receiverPhone',
      'input[name*="phone" i]',
      'input[name*="ReceiverPhone" i]',
      'input[placeholder*="SĐT" i]',
      'input[placeholder*="Số điện thoại" i]',
      'input[placeholder*="điện thoại" i]',
      'input[type="tel"]',
      'input.ant-input[placeholder*="nhập" i]' // aggressive fallback handled in dom.js if needed
    ],
    nameLabels: [/Tên người nhận/i, /Họ tên/i, /Họ và tên/i, /Người nhận/i],
    nameFallbacks: [
      '#form-create-order_receiverName',
      'input#receiverName',
      'input[name*="name" i]',
      'input[name*="ReceiverName" i]',
      'input[placeholder*="Tên" i]',
      'input[placeholder*="Họ tên" i]',
      'input[placeholder*="Họ và tên" i]',
      'input[placeholder*="Người nhận" i]'
    ],
    addressLabels: [/Địa chỉ chi tiết/i, /Địa chỉ mới/i, /Địa chỉ nhận/i, /Địa chỉ người nhận/i, /Số nhà/i, /Đường\/Phố/i],
    addressFallbacks: [
      '#form-create-order_receiverAddress',
      'input#form-create-order_receiverAddress',
      'input[placeholder="Địa chỉ chi tiết"]',
      'input[placeholder*="Địa chỉ chi tiết" i]',
      'textarea[placeholder*="Địa chỉ chi tiết" i]',
      'input[placeholder*="Số nhà" i]',
      'textarea[placeholder*="Số nhà" i]',
      'textarea[placeholder*="Địa chỉ" i]',
      'input[placeholder*="Địa chỉ" i]',
      'textarea#receiverAddress',
      'input#receiverAddress',
      'input[name*="Address" i]',
      'textarea[name*="Address" i]'
    ],
    noteLabels: [/Nội dung/i, /Ghi chú/i, /Nội dung hàng/i],
    noteFallbacks: [
      '#form-create-order_receiverNote',
      '#form-create-order_note',
      'textarea[placeholder*="Nội dung" i]',
      'textarea[placeholder*="Ghi chú" i]',
      'textarea#receiverNote',
      'textarea[name*="note" i]'
    ],
    codLabels: ['Phát hàng thu tiền COD', 'Thu tiền COD', 'Tiền thu hộ'],
    codInputFallbacks: [
      'input.ant-input-number-input',
      'input[name="PROP0018"]',
      'input[name*="COD" i]'
    ],
    shipFeeKeywords: ['thu phí ship', 'thu ship', 'thu cước ship', 'thu cước vận chuyển', 'người gửi trả cước'],
    accountSelectors: [
      'span.name___WfKAK',
      'span[class*="name___"]',
      '.g-avatar',
      '[class*="AvatarDropdown"] [class*="name"]',
      '.ant-pro-global-header-index-right .ant-dropdown-trigger',
      '.ant-pro-global-header-index-avatar',
      '.ant-avatar + span',
      '.ant-dropdown-trigger span',
      'header .ant-dropdown-trigger',
      '.header-right .ant-dropdown-trigger'
    ],
    getAccountName: function() {
      try {
        // 1. Quét DOM
        for (const sel of this.accountSelectors) {
          const els = document.querySelectorAll(sel);
          for (const el of els) {
            if (!el || (el.offsetParent === null && el.offsetWidth === 0)) continue;
            const clone = el.cloneNode(true);
            const icons = clone.querySelectorAll('svg, .anticon, [role="img"], i, span[class*="anticon"]');
            icons.forEach(i => i.remove());
            const text = (clone.textContent || '').trim().replace(/\s+/g, ' ');
            if (text && text.length >= 2 && text.length <= 60 && !/^(đăng nhập|login|tài khoản|thông báo|tiếng việt|vn|en)$/i.test(text)) {
              return text;
            }
          }
        }
        // 2. Quét localStorage/sessionStorage
        const storageKeys = ['user', 'userInfo', 'USER_INFO', 'account', 'currentUser', 'profile', 'userData'];
        for (const key of storageKeys) {
          const val = localStorage.getItem(key) || sessionStorage.getItem(key);
          if (val) {
            try {
              const parsed = typeof val === 'string' && (val.startsWith('{') || val.startsWith('[')) ? JSON.parse(val) : val;
              const name = parsed?.fullName || parsed?.full_name || parsed?.name || parsed?.userName || parsed?.username || parsed?.displayName;
              if (name && typeof name === 'string' && name.length >= 2) return name.trim();
            } catch (_) {}
          }
        }
        // 3. Quét thông tin người gửi trên trang nếu có
        const senderEl = document.querySelector('input#senderName, input[name*="senderName" i], input[placeholder*="người gửi" i]');
        if (senderEl && senderEl.value && senderEl.value.trim().length >= 2) {
          return senderEl.value.trim();
        }
      } catch (e) {
        console.warn('VNPost getAccountName error:', e);
      }
      return '';
    }
  };

  globalThis.VNPOST_SELECTORS = VNPOST_SELECTORS;
})();
