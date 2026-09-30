(() => {
  'use strict';

  const GHTK_SELECTORS = {
    phoneLabels: [/Số điện thoại/i, /SĐT/i, /Điện thoại nhận/i, /Phone/i],
    phoneFallbacks: [
      'input[name*="customer_tel" i]',
      'input#customer_tel',
      'input[name*="phone" i]',
      'input[placeholder*="Số điện thoại" i]',
      'input[placeholder*="SĐT" i]',
      'input[type="tel"]'
    ],
    nameLabels: [/Tên người nhận/i, /Họ tên/i, /Khách hàng/i, /Người nhận/i],
    nameFallbacks: [
      'input[name*="customer_fullname" i]',
      'input#customer_fullname',
      'input[name*="name" i]',
      'input[placeholder*="Tên người nhận" i]',
      'input[placeholder*="Họ tên" i]'
    ],
    addressLabels: [/Địa chỉ chi tiết/i, /Địa chỉ nhận/i, /Số nhà/i],
    addressFallbacks: [
      'input[name*="customer_first_address" i]',
      'input#customer_first_address',
      'input[name*="address" i]',
      'input[placeholder*="Địa chỉ chi tiết" i]',
      'input[placeholder*="Số nhà, tên đường" i]',
      'textarea[placeholder*="Địa chỉ" i]'
    ],
    codLabels: [/Tiền thu hộ/i, /Tiền COD/i, /Thu hộ/i],
    codInputFallbacks: [
      'input[name*="pick_money" i]',
      'input#pick_money',
      'input[name*="cod" i]',
      'input[placeholder*="Tiền thu hộ" i]',
      'input[placeholder*="Tiền COD" i]'
    ],
    goodsNameFallbacks: [
      'input[name*="product_name" i]',
      'input[placeholder*="Tên hàng hóa" i]',
      'input[placeholder*="Tên sản phẩm" i]'
    ],
    weightFallbacks: [
      'input[name*="weight" i]',
      'input[placeholder*="Khối lượng" i]',
      'input[placeholder*="Cân nặng" i]'
    ],
    noteFallbacks: [
      'textarea[name*="note" i]',
      'input[name*="note" i]',
      'textarea[placeholder*="Ghi chú" i]'
    ],
    accountSelectors: [
      '.shop-name',
      '.user-info-name',
      '.header-shop-title',
      '.nav-item .user-name'
    ],
    getAccountName() {
      try {
        if (typeof document === 'undefined') return '';
        for (const sel of GHTK_SELECTORS.accountSelectors) {
          const el = document.querySelector(sel);
          if (el && el.innerText && el.innerText.trim()) {
            return el.innerText.trim();
          }
        }
      } catch (_) {}
      return '';
    }
  };

  globalThis.GHTK_SELECTORS = GHTK_SELECTORS;
})();
