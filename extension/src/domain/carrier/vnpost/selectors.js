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
      'input[name*="receiverAddress" i]',
      'textarea[name*="receiverAddress" i]'
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
    },
    getSenderInfo: function() {
      try {
        let name = this.getAccountName();
        let phone = '';
        let address = '';

        // 1. Quét tên người gửi nếu có ô nhập cụ thể
        const nameEl = document.querySelector('#form-create-order_senderName, input#senderName, input[name*="senderName" i], [class*="sender" i] input[name*="name" i]');
        if (nameEl && nameEl.value && nameEl.value.trim().length >= 2) {
          name = nameEl.value.trim();
        }

        // 2. Quét số điện thoại người gửi
        const phoneEl = document.querySelector('#form-create-order_senderPhone, input#senderPhone, input[name*="senderPhone" i], [class*="sender" i] input[type="tel"], [class*="sender" i] input[name*="phone" i], [class*="sender" i] input[placeholder*="điện thoại" i]');
        if (phoneEl && phoneEl.value) {
          phone = String(phoneEl.value).trim().replace(/[^\d]/g, '');
        }

        // 3. Quét địa chỉ kho gửi / người gửi
        const addrEl = document.querySelector('#form-create-order_senderAddress, textarea#senderAddress, input#senderAddress, [class*="sender" i] textarea, [class*="sender" i] input[placeholder*="địa chỉ" i]');
        if (addrEl && addrEl.value && addrEl.value.trim().length >= 5) {
          address = addrEl.value.trim();
        }

        // Quét thêm dropdown kho / địa chỉ gửi hàng
        const senderCard = document.querySelector('[class*="sender" i], #form-create-order_sender, [class*="warehouse" i]');
        if (senderCard) {
          const selectItems = Array.from(senderCard.querySelectorAll('.ant-select-selection-item, .ant-select-selection-selected-value, .ant-cascader-picker-label'))
            .map(el => (el.innerText || el.textContent || '').trim())
            .filter(t => t && !/chọn|tất cả|vui lòng/i.test(t) && (t.includes('TP.') || t.includes('Tỉnh') || t.includes('Quận') || t.includes('Huyện') || t.includes('Phường') || t.includes('Xã') || t.startsWith('P.') || t.startsWith('Q.')));
          if (selectItems.length > 0) {
            selectItems.forEach(part => {
              if (address && !address.toLowerCase().includes(part.toLowerCase())) {
                address += ', ' + part;
              } else if (!address) {
                address = part;
              }
            });
          }
        }

        // 4. Quét từ localStorage của VNPost nếu trên form chưa có đầy đủ
        if (!phone || !address || !name) {
          const storageKeys = ['user', 'userInfo', 'USER_INFO', 'account', 'currentUser', 'profile', 'userData', 'defaultWarehouse', 'senderInfo'];
          for (const key of storageKeys) {
            const val = localStorage.getItem(key) || sessionStorage.getItem(key);
            if (val) {
              try {
                const p = typeof val === 'string' && (val.startsWith('{') || val.startsWith('[')) ? JSON.parse(val) : val;
                if (!name) name = p?.fullName || p?.full_name || p?.name || p?.userName || p?.displayName || '';
                if (!phone) phone = p?.phone || p?.mobile || p?.phoneNumber || p?.tel || p?.senderPhone || '';
                if (!address) address = p?.address || p?.fullAddress || p?.senderAddress || p?.warehouseAddress || '';
              } catch (_) {}
            }
          }
        }

        return {
          name: (name || '').trim(),
          phone: (phone || '').trim().replace(/[^\d]/g, ''),
          address: (address || '').trim()
        };
      } catch (e) {
        console.warn('VNPost getSenderInfo error:', e);
        return { name: '', phone: '', address: '' };
      }
    },
    footerBar: '.ant-pro-footer-bar',
    submitButton: '.ant-pro-footer-bar #create_order, #create_order, .ant-pro-footer-bar button[title="Tạo đơn"]'
  };

  globalThis.VNPOST_SELECTORS = VNPOST_SELECTORS;
})();
