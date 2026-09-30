(() => {
  'use strict';

  // =========================================================================
  // GHTK AUTOFILL ADAPTER
  // =========================================================================

  function setInputValue(el, value) {
    if (!el) return;
    el.focus();
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  function findElement(fallbacks) {
    if (!Array.isArray(fallbacks) || typeof document === 'undefined') return null;
    for (const sel of fallbacks) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  const GHTKAdapter = {
    async fillForm(orderData) {
      if (!orderData || typeof document === 'undefined') return;
      const selectors = globalThis.GHTK_SELECTORS || {};

      const phone = orderData.phone || '';
      const name = orderData.name || '';
      const address = orderData.address || '';
      const codAmount = orderData.codAmount || orderData.cod || 0;
      const goodsName = orderData.goodsName || orderData.productItem || orderData.defaultGoodsName || (orderData.orderCode ? ('Đơn hàng: ' + orderData.orderCode) : 'Hàng hóa');
      const weightKg = orderData.weightKg || (orderData.weightGrams ? orderData.weightGrams / 1000 : 0.2);
      const noteText = orderData.notes || 'Cho xem hàng, không thử';

      // 1. SĐT
      const phoneEl = findElement(selectors.phoneFallbacks);
      if (phoneEl) setInputValue(phoneEl, phone);

      // 2. Họ tên
      const nameEl = findElement(selectors.nameFallbacks);
      if (nameEl) setInputValue(nameEl, name);

      // 3. Địa chỉ
      const addrEl = findElement(selectors.addressFallbacks);
      if (addrEl) setInputValue(addrEl, address);

      // 4. Tiền COD
      if (codAmount && codAmount > 0) {
        const codEl = findElement(selectors.codInputFallbacks);
        if (codEl) setInputValue(codEl, String(codAmount));
      }

      // 5. Tên hàng
      const goodsEl = findElement(selectors.goodsNameFallbacks);
      if (goodsEl) setInputValue(goodsEl, goodsName);

      // 6. Cân nặng (kg)
      const weightEl = findElement(selectors.weightFallbacks);
      if (weightEl) setInputValue(weightEl, String(weightKg));

      // 7. Ghi chú
      const noteEl = findElement(selectors.noteFallbacks);
      if (noteEl) setInputValue(noteEl, noteText);
    }
  };

  globalThis.GHTKAdapter = GHTKAdapter;
})();
