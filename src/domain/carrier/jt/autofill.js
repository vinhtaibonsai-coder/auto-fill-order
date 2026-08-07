(() => {
  // =========================================================================
  // J&T AUTOFILL ADAPTER — chỉ điền text, không cần dropdown khu vực
  // =========================================================================

  // ─── CHỌN CHẾ ĐỘ ĐỊA CHỈ CŨ ───
  function selectAddressMode(preferOld = true) {
    try {
      const labels = Array.from(document.querySelectorAll('label.el-radio, label'));
      for (const lbl of labels) {
        const text = (lbl.innerText || '').trim();
        if (preferOld && /địa chỉ cũ/i.test(text)) { lbl.click(); return true; }
        if (!preferOld && /địa chỉ mới/i.test(text)) { lbl.click(); return true; }
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

  const JTAdapter = {
    async prepare() {
      return true;
    },

    async fill(name, phone, address, orderCode, codAmount, collectFee) {
      const results = {};
      const store = globalThis.parsedDataStore || {};

      // 1. Chọn chế độ địa chỉ cũ
      results.addressMode = selectAddressMode(true);
      await new Promise(r => setTimeout(r, 300));

      // 2. Số điện thoại
      const phoneEl = document.querySelector('input[placeholder="Nhập số điện thoại"]');
      results.phoneField = !!phoneEl;
      if (phoneEl) setInputValue(phoneEl, phone);

      // 3. Tên người nhận
      const nameEl = document.querySelector('input[placeholder="Nhập tên người nhận"]');
      results.nameField = !!nameEl;
      if (nameEl) setInputValue(nameEl, name);

      // 4. Địa chỉ chi tiết (số nhà/đường) — chỉ điền text, không cần dropdown
      const addrEl =
        document.querySelector('input[placeholder="Nhập địa chỉ (Số nhà/ đường/ ngõ/ tòa nhà...)"]') ||
        document.querySelector('input[placeholder*="Số nhà/ đường/ ngõ"]') ||
        document.querySelector('input[placeholder*="địa chỉ"]');
      results.addressField = !!addrEl;
      if (address && address !== 'không tìm thấy' && addrEl) setInputValue(addrEl, address);

      // 5. Mã đơn hàng của Shop (để trống theo yêu cầu — gộp vào Tên sản phẩm)
      const codeEl =
        document.querySelector('input[placeholder="Nhập mã đơn hàng riêng của shop"]') ||
        document.querySelector('input[placeholder*="mã đơn hàng"]') ||
        document.querySelector('#customerOrderCode');
      results.codeField = !!codeEl;

      // 6. Tên sản phẩm (gộp mã đơn + ghi chú)
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
      if (goodsInp) {
        let goodsText = orderCode || 'Hàng hóa';
        const notesParts = [];
        if (store.extraNote)           notesParts.push(store.extraNote);
        if (store.extraPhones?.length) notesParts.push('SDT phụ: ' + store.extraPhones.join(', '));
        if (notesParts.length > 0) goodsText += ' | ' + notesParts.join(' | ');
        setInputValue(goodsInp, goodsText);
      }

      // 7. Trọng lượng
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
      if (weightInp) setInputValue(weightInp, '5');

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

      // Log kết quả
      if (typeof Logger !== 'undefined') {
        Logger.error('Báo cáo điền đơn J&T (Fill Report)', JSON.stringify(results));
      }
    }
  };

  globalThis.JTAdapter = JTAdapter;
})();
