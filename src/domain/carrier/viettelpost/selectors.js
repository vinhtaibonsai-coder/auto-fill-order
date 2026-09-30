(() => {
  'use strict';

  const VIETTELPOST_SELECTORS = {
    phoneLabels: [/Số điện thoại/i, /SĐT/i, /Điện thoại nhận/i, /Phone/i],
    phoneFallbacks: [
      '#receiverPhone',
      'input[name*="receiverPhone" i]',
      'input[name*="phone" i]',
      'input[placeholder*="Số điện thoại" i]',
      'input[placeholder*="SĐT" i]',
      'input[type="tel"]'
    ],
    nameLabels: [/Tên người nhận/i, /Họ tên/i, /Họ và tên/i, /Người nhận/i],
    nameFallbacks: [
      '#receiverName',
      'input[name*="receiverName" i]',
      'input[name*="name" i]',
      'input[placeholder*="Họ tên người nhận" i]',
      'input[placeholder*="Tên người nhận" i]',
      'input[placeholder*="Họ và tên" i]'
    ],
    addressLabels: [/Địa chỉ chi tiết/i, /Địa chỉ nhận/i, /Số nhà/i, /Đường\/Phố/i],
    addressFallbacks: [
      '#receiverAddress',
      'input[name*="receiverAddress" i]',
      'input[placeholder*="Địa chỉ chi tiết" i]',
      'input[placeholder*="Số nhà, tên đường" i]',
      'input[placeholder*="Địa chỉ" i]',
      'textarea[placeholder*="Địa chỉ" i]'
    ],
    codLabels: [/Tiền thu hộ/i, /COD/i, /Thu hộ/i],
    codInputFallbacks: [
      '#collectionMoney',
      'input[name*="cod" i]',
      'input[name*="collection" i]',
      'input[placeholder*="Thu hộ" i]',
      'input[placeholder*="COD" i]'
    ],
    goodsNameFallbacks: [
      '#orderName',
      'input[name*="orderName" i]',
      'input[name*="productName" i]',
      'input[placeholder*="Tên hàng hóa" i]',
      'input[placeholder*="Tên sản phẩm" i]'
    ],
    weightFallbacks: [
      '#weight',
      'input[name*="weight" i]',
      'input[placeholder*="Trọng lượng" i]',
      'input[placeholder*="Khối lượng" i]'
    ],
    noteFallbacks: [
      '#note',
      'textarea[name*="note" i]',
      'textarea[placeholder*="Ghi chú" i]',
      'input[placeholder*="Ghi chú" i]'
    ],
    accountSelectors: [
      '.user-profile .name',
      '.header-user-name',
      '.user-info__name',
      'header .user-name'
    ],
    getAccountName() {
      try {
        if (typeof document === 'undefined') return '';
        for (const sel of VIETTELPOST_SELECTORS.accountSelectors) {
          const el = document.querySelector(sel);
          if (el && el.innerText && el.innerText.trim()) {
            return el.innerText.trim();
          }
        }
      } catch (_) {}
      return '';
    }
  };

  globalThis.VIETTELPOST_SELECTORS = VIETTELPOST_SELECTORS;
})();
