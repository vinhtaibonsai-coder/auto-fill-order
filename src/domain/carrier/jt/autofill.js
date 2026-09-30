(() => {
  // =========================================================================
  // J&T AUTOFILL ADAPTER — chỉ điền text, không cần dropdown khu vực
  // =========================================================================

  // ─── CHỌN CHẾ ĐỘ ĐỊA CHỈ MỚI ───
  function selectAddressMode(preferNew = true) {
    try {
      const labels = Array.from(document.querySelectorAll('label.el-radio, label'));
      for (const lbl of labels) {
        const text = (lbl.innerText || '').trim();
        if (preferNew && /địa chỉ mới/i.test(text)) { lbl.click(); return true; }
        if (!preferNew && /địa chỉ cũ/i.test(text)) { lbl.click(); return true; }
      }
      const radios = Array.from(document.querySelectorAll('input[type="radio"]'));
      if (radios.length > 0) { radios[0].click(); return true; }
      return false;
    } catch (e) { console.warn('selectAddressMode error:', e); return false; }
  }

  // ─── PHƯƠNG THỨC THANH TOÁN ───
  function setJTPaymentMethod(collectFee) {
    try {
      const radioLabels = Array.from(document.querySelectorAll('label.el-radio'));
      if (!collectFee) {
        const ppPmLabel = radioLabels.find(label => label.innerText?.includes('Thanh toán cuối tháng'));
        if (ppPmLabel) { ppPmLabel.click(); return true; }
      } else {
        const receiverPayLabel = radioLabels.find(label => label.innerText?.includes('Người nhận thanh toán'));
        if (receiverPayLabel) { receiverPayLabel.click(); return true; }
      }
      return false;
    } catch (e) { console.warn('setJTPaymentMethod error', e); return false; }
  }

  async function resolveJTDefaultWeight(store = {}) {
    const inMemoryWeight = Number(store.defaultWeightJt);
    if (Number.isFinite(inMemoryWeight) && inMemoryWeight > 0) return inMemoryWeight;

    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      const stored = await new Promise(resolve => {
        chrome.storage.local.get([
          'order_default_settings', 
          'default_weight_jt', 
          'default_package_weight', 
          'default_weight_vnpost', 
          'activeShop'
        ], result => {
          if (chrome.runtime?.lastError) return resolve(undefined);
          let val = result?.order_default_settings?.defaultWeightKg !== undefined 
            ? result.order_default_settings.defaultWeightKg 
            : result?.default_weight_jt;

          // Nếu chưa có hoặc là 0.2 mặc định, kiểm tra cấu hình bưu phẩm từ Cài đặt cửa hàng
          if ((val === undefined || Number(val) === 0.2) && result?.default_package_weight && Number(result.default_package_weight) > 0) {
            const pkgWeight = Number(result.default_package_weight);
            val = pkgWeight >= 10 ? (pkgWeight / 1000) : pkgWeight;
          }

          if ((val === undefined || Number(val) === 0.2) && result?.activeShop) {
            const shopObj = typeof result.activeShop === 'object' ? result.activeShop : null;
            if (shopObj?.default_package_weight && Number(shopObj.default_package_weight) > 0) {
              const pkgWeight = Number(shopObj.default_package_weight);
              val = pkgWeight >= 10 ? (pkgWeight / 1000) : pkgWeight;
            }
          }

          if ((val === undefined || Number(val) === 0.2) && result?.order_default_settings?.defaultWeight) {
            const defGram = Number(result.order_default_settings.defaultWeight);
            if (defGram > 0 && defGram !== 200) {
              val = defGram >= 10 ? (defGram / 1000) : defGram;
            }
          }
          resolve(val);
        });
      });
      const storedWeight = Number(stored);
      if (Number.isFinite(storedWeight) && storedWeight > 0) return storedWeight;
    }

    try {
      if (typeof OrderStorage !== 'undefined' && typeof OrderStorage.getActiveShop === 'function') {
        const activeShop = await OrderStorage.getActiveShop().catch(() => null);
        if (activeShop?.default_package_weight && Number(activeShop.default_package_weight) > 0) {
          const pkgWeight = Number(activeShop.default_package_weight);
          return pkgWeight >= 10 ? (pkgWeight / 1000) : pkgWeight;
        }
      }
    } catch (_) {}

    try {
      const rawPkg = localStorage.getItem('default_package_weight');
      if (rawPkg && Number(rawPkg) > 0) {
        const pkgWeight = Number(rawPkg);
        return pkgWeight >= 10 ? (pkgWeight / 1000) : pkgWeight;
      }
      const raw = localStorage.getItem('order_default_settings');
      if (raw) {
        const obj = JSON.parse(raw);
        if (obj.defaultWeightKg && Number(obj.defaultWeightKg) > 0) return Number(obj.defaultWeightKg);
        if (obj.defaultWeight && Number(obj.defaultWeight) > 0 && Number(obj.defaultWeight) !== 200) {
          const defGram = Number(obj.defaultWeight);
          return defGram >= 10 ? (defGram / 1000) : defGram;
        }
      }
      const rawLeg = localStorage.getItem('default_weight_jt');
      if (rawLeg && Number(rawLeg) > 0) return Number(rawLeg);
    } catch (_) {}

    return 0.2;
  }

  const JTAdapter = {
    async prepare() {
      return true;
    },

    async fill(name, phone, address, orderCode, codAmount, collectFee) {
      const results = {};
      const store = globalThis.parsedDataStore || {};

      // 1. Chọn chế độ địa chỉ mới
      results.addressMode = selectAddressMode(true);
      await new Promise(r => setTimeout(r, 300));

      // 2. Số điện thoại
      const phoneEl = findFieldInput(globalThis.JT_SELECTORS.phoneLabels, globalThis.JT_SELECTORS.phoneFallbacks);
      results.phoneField = !!phoneEl;
      if (phoneEl) setInputValue(phoneEl, phone);

      // 3. Tên người nhận
      const nameEl = findFieldInput(globalThis.JT_SELECTORS.nameLabels, globalThis.JT_SELECTORS.nameFallbacks);
      results.nameField = !!nameEl;
      if (nameEl) setInputValue(nameEl, name);

      // 4. Địa chỉ (Vui lòng nhập địa chỉ cũ - 3 cấp)
      const addrEl = findFieldInput(globalThis.JT_SELECTORS.addressLabels, globalThis.JT_SELECTORS.addressFallbacks);
      results.addressField = !!addrEl;
      if (address && address !== 'không tìm thấy' && addrEl) setInputValue(addrEl, address);

      // 5. Mã đơn hàng của Shop
      const codeEl = findFieldInput(globalThis.JT_SELECTORS.codeLabels, globalThis.JT_SELECTORS.codeFallbacks);
      results.codeField = !!codeEl;
      if (codeEl) setInputValue(codeEl, orderCode || '');

      // 6. Tên sản phẩm / Nội dung
      let goodsInp =
        document.querySelector('textarea[placeholder="Nhập tên sản phẩm"]') ||
        document.querySelector('input[placeholder="Nhập tên sản phẩm"]') ||
        document.querySelector('input[placeholder*="tên sản phẩm"]');
      if (!goodsInp) {
        document.querySelectorAll('.el-form-item').forEach(item => {
          if (item.innerText && item.innerText.includes('Tên sản phẩm')) {
            const el = item.querySelector('textarea') || item.querySelector('input');
            if (el) goodsInp = el;
          }
        });
      }
      results.goodsNameField = !!goodsInp;
      const defaultGoodsName = store.defaultGoodsName || 'Hàng hóa';
      const primaryGoods = (store.productItem && store.productItem.trim() && store.productItem.trim() !== orderCode)
        ? store.productItem.trim() + (orderCode ? (" | " + orderCode.trim()) : "")
        : ((orderCode && orderCode.trim()) ? orderCode.trim() : defaultGoodsName);
      let goodsText = primaryGoods;
      const notesParts = [];
      if (store.extraNote)           notesParts.push(store.extraNote);
      if (store.extraPhones?.length) notesParts.push('SDT phụ: ' + store.extraPhones.join(', '));
      if (notesParts.length > 0) goodsText += ' | ' + notesParts.join(' | ');
      if (goodsInp) {
        setInputValue(goodsInp, goodsText);
      }

      // 7. Trọng lượng (kg)
      let weightInp =
        document.querySelector('input[placeholder="Nhập trọng lượng"]') ||
        document.querySelector('input[placeholder*="trọng lượng"]');
      if (!weightInp) {
        document.querySelectorAll('.el-form-item').forEach(item => {
          if (item.innerText && (item.innerText.includes('Trọng lượng') || item.innerText.includes('KG'))) {
            const el = item.querySelector('input');
            if (el) weightInp = el;
          }
        });
      }
      results.weightField = !!weightInp;
      if (weightInp) {
        const defaultWeightJt = await resolveJTDefaultWeight(store);
        setInputValue(weightInp, String(defaultWeightJt));
      }

      // 8. Ghi chú / Nội dung
      let noteEl = null;
      document.querySelectorAll('.el-form-item').forEach(item => {
        const label = item.querySelector('.el-form-item__label');
        const labelText = (label ? label.innerText : item.innerText || '').trim();
        if (/Nội dung|Ghi chú/i.test(labelText)) {
          const el = item.querySelector('textarea') || item.querySelector('input');
          if (el) noteEl = el;
        }
      });
      if (!noteEl) {
        noteEl =
          document.querySelector('textarea[placeholder*="Nội dung"]') ||
          document.querySelector('input[placeholder*="Ghi chú"]');
      }
      results.noteField = !!noteEl;
      if (noteEl) {
        let noteText = orderCode ? ("Đơn hàng: " + orderCode) : defaultGoodsName;
        if (store.productItem && store.productItem.trim() && store.productItem.trim() !== orderCode) {
          noteText = store.productItem.trim() + (orderCode ? (" | Đơn hàng: " + orderCode) : "");
        }
        if (store.extraNote) noteText += (noteText ? " | " : "") + store.extraNote;
        if (store.extraPhones?.length) noteText += (noteText ? " | " : "") + "SDT phụ: " + store.extraPhones.join(', ');
        setInputValue(noteEl, noteText);
      }

      // 9. Tiền thu hộ COD
      if (codAmount && codAmount > 0) {
        let codInp = null;
        document.querySelectorAll('.el-form-item').forEach(item => {
          const label = item.querySelector('.el-form-item__label');
          const labelText = (label ? label.innerText : item.innerText || '').trim();
          if (labelText.includes('Tiền thu hộ') && !labelText.includes('Phí')) {
            const el = item.querySelector('input');
            if (el) codInp = el;
          }
        });
        if (!codInp) {
          codInp =
            document.querySelector('input[placeholder="Nhập số tiền..."]') ||
            document.querySelector('input[placeholder="Nhập số tiền"]') ||
            document.querySelector('#money');
        }
        results.codField = !!codInp;
        if (codInp) setInputValue(codInp, codAmount.toString());
      }

      // 10. Loại hàng & phương thức thanh toán
      document.querySelectorAll('.el-radio, .el-radio__label, span').forEach(node => {
        if (node.innerText?.trim() === 'Hàng hóa') node.click();
      });
      results.paymentMethodField = setJTPaymentMethod(collectFee);

      // Log kết quả nội bộ (chỉ console.log, không gọi Logger.error gây báo lỗi cho người dùng)
      if (typeof Logger !== 'undefined' && typeof Logger.log === 'function') {
        Logger.log('Báo cáo điền đơn J&T (Fill Report)', JSON.stringify(results));
      }
    }
  };

  globalThis.JTAdapter = JTAdapter;
})();
