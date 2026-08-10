(() => {
  // =========================================================================
  // VNPOST AUTOFILL ADAPTER
  // =========================================================================

  function findSampleOrderSelectEl() {
    if (typeof document === 'undefined') return null;
    const label = Array.from(document.querySelectorAll('b, label, span')).find(el => el.innerText?.trim() === 'Đơn hàng mẫu');
    if (!label) return null;
    return (
      label.closest('.ant-space')?.querySelector('.ant-select') ||
      label.parentElement?.querySelector('.ant-select') ||
      label.nextElementSibling?.querySelector('.ant-select') ||
      label.parentElement?.parentElement?.querySelector('.ant-select') ||
      null
    );
  }

  function isSampleOrderSelected() {
    try {
      const selectEl = findSampleOrderSelectEl();
      if (!selectEl) return true; 
      if (selectEl.querySelector('.ant-select-selection-item')) return true;
      const inp = selectEl.querySelector('input.ant-select-selection-search-input');
      if (inp && inp.value && inp.value.trim() !== '') return true;
      const selectedItem = selectEl.querySelector('.ant-select-selection-item-content');
      if (selectedItem && selectedItem.innerText.trim() !== '') return true;
      return false;
    } catch (e) {
      console.warn('isSampleOrderSelected error', e);
      return true;
    }
  }

  async function selectFirstSampleOrder() {
    try {
      const selectEl = findSampleOrderSelectEl();
      if (!selectEl) { console.warn('Auto Fill Order: không tìm thấy ô "Đơn hàng mẫu" trên trang.'); return false; }

      const searchInput = selectEl.querySelector('input[role="combobox"], input.ant-select-selection-search-input');
      const clickTarget = selectEl.querySelector('.ant-select-selector') || selectEl;

      if (!selectEl.classList.contains('ant-select-open')) {
        simulateFullClick(clickTarget);
        let opened = await waitFor(() => selectEl.classList.contains('ant-select-open') ? true : null, 1500, 50);
        if (!opened) {
          simulateFullClick(searchInput || clickTarget);
          opened = await waitFor(() => selectEl.classList.contains('ant-select-open') ? true : null, 1200, 50);
        }
        if (!opened) console.warn('Auto Fill Order: bấm vào ô "Đơn hàng mẫu" nhưng dropdown không mở ra.');
      }

      if (searchInput) {
        searchInput.focus();
        const kbOpts = { bubbles: true, cancelable: true };
        searchInput.dispatchEvent(new KeyboardEvent('keydown', Object.assign({ key: 'Enter', code: 'Enter', keyCode: 13, which: 13 }, kbOpts)));
        searchInput.dispatchEvent(new KeyboardEvent('keyup', Object.assign({ key: 'Enter', code: 'Enter', keyCode: 13, which: 13 }, kbOpts)));
        const confirmedByKeyboard = await waitFor(() => isSampleOrderSelected() ? true : null, 1000, 50);
        if (confirmedByKeyboard) return true;
      }

      const dropdown = await waitFor(() => document.querySelector('.ant-select-dropdown:not(.ant-select-dropdown-hidden)') || document.querySelector('.ant-select-dropdown'), 1500, 50);
      let candidates = dropdown
        ? Array.from(dropdown.querySelectorAll('[role="option"], .ant-select-item-option, .rc-select-item-option, .ant-select-item'))
        : [];

      if (candidates.length === 0 && searchInput && searchInput.id) {
        for (let i = 0; i < 8; i++) {
          const el = document.getElementById(searchInput.id + '_list_' + i);
          if (el) candidates.push(el);
        }
      }

      if (candidates.length === 0) {
        console.warn('Auto Fill Order: dropdown "Đơn hàng mẫu" mở ra nhưng không tìm thấy mục nào để chọn.');
        return false;
      }

      for (const candidate of candidates) {
        const inner = candidate.querySelector('.ant-select-item-option-content') || candidate;
        simulateFullClick(inner);
        let confirmed = await waitFor(() => isSampleOrderSelected() ? true : null, 500, 50);
        if (confirmed) return true;

        simulateFullClick(candidate);
        confirmed = await waitFor(() => isSampleOrderSelected() ? true : null, 400, 50);
        if (confirmed) return true;

        const invoked = invokeReactHandler(candidate, ['onMouseDown', 'onClick', 'onPointerDown']);
        if (invoked) {
          confirmed = await waitFor(() => isSampleOrderSelected() ? true : null, 400, 50);
          if (confirmed) return true;
        }
      }

      return false;
    } catch (e) {
      console.warn('selectFirstSampleOrder error', e);
      return false;
    }
  }

  function setVNPostShipFee(enable) {
    try {
      const rows = Array.from(document.querySelectorAll('tr.g-tr, tr, [role="row"]'));
      let shipFeeRow = rows.find(row => {
        const text = row.innerText?.toLowerCase();
        if (!text) return false;
        // Bỏ qua row liên quan hủy đơn, khai giá, bảo hiểm
        if (/hủy|khai giá|bảo hiểm/i.test(text)) return false;
        return VNPOST_SELECTORS.shipFeeKeywords.some(kw => text.includes(kw));
      });

      let checkbox = null;
      if (shipFeeRow) {
        checkbox = shipFeeRow.querySelector('input.ant-checkbox-input') || shipFeeRow.querySelector('input[type="checkbox"]');
        if (!checkbox) {
          const wrapper = shipFeeRow.querySelector('.ant-checkbox-wrapper');
          if (wrapper) checkbox = wrapper.querySelector('input');
        }
      } else {
        const label = Array.from(document.querySelectorAll('label, span')).find(el => {
          const text = el.innerText?.toLowerCase() || '';
          // Bỏ qua nhãn liên quan hủy đơn, khai giá, bảo hiểm
          if (/hủy|khai giá|bảo hiểm/i.test(text)) return false;
          return VNPOST_SELECTORS.shipFeeKeywords.some(kw => text.includes(kw));
        });
        if (label) {
          const container = label.closest('.ant-form-item') || label.parentElement;
          checkbox = container ? (container.querySelector('input[type="checkbox"]') || container.querySelector('input.ant-checkbox-input')) : null;
        }
      }

      if (checkbox) {
        if (enable && !checkbox.checked) {
          checkbox.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: typeof window !== 'undefined' ? window : null }));
          return true;
        }
        if (!enable && checkbox.checked) {
          checkbox.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: typeof window !== 'undefined' ? window : null }));
          return true;
        }
      }
      return false;
    } catch (e) { console.warn('setVNPostShipFee error', e); return false; }
  }

  async function autoCOD(codValue) {
    try {
      let codRow = await waitFor(function() {
        const rows = [...document.querySelectorAll("tr.g-tr, tr, [role='row']")];
        return rows.find(row => row.innerText.includes("Phát hàng thu tiền COD") || row.innerText.includes("Thu tiền COD")) || null;
      }, 3000);
      
      let checkbox = null;
      let input = null;

      if (codRow) {
        checkbox = codRow.querySelector('input.ant-checkbox-input') || codRow.querySelector('input[type="checkbox"]');
        input = codRow.querySelector('input.ant-input-number-input') || codRow.querySelector('input[name="PROP0018"]');
      } else {
        const label = Array.from(document.querySelectorAll('label, span')).find(el => {
          const txt = el.innerText || '';
          return txt.includes('Phát hàng thu tiền COD') || txt.includes('Thu tiền COD');
        });
        if (label) {
          const container = label.closest('.ant-form-item') || label.parentElement;
          if (container) {
            checkbox = container.querySelector('input.ant-checkbox-input') || container.querySelector('input[type="checkbox"]');
            input = container.querySelector('input.ant-input-number-input') || container.querySelector('input[name="PROP0018"]');
          }
        }
      }

      if (checkbox && !checkbox.checked) {
        checkbox.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: typeof window !== 'undefined' ? window : null }));
        await waitFor(function() {
          const inp = input || document.querySelector('input.ant-input-number-input') || document.querySelector('input[name="PROP0018"]');
          if (inp) {
            input = inp;
            return !inp.disabled ? inp : null;
          }
          return null;
        }, 3000);
      }

      if (!input) {
        input = document.querySelector('input.ant-input-number-input') || document.querySelector('input[name="PROP0018"]');
      }
      if (!input) return false;

      input.focus();
      const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      nativeSetter.call(input, "");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      nativeSetter.call(input, String(codValue));

      input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: String(codValue) }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      input.blur();

      await waitFor(function() { return input.value === String(codValue) ? true : null; }, 1500, 50);
      return input.value === String(codValue);
    } catch (err) { console.log("❌ autoCOD ERROR:", err); return false; }
  }

  const VNPostAdapter = {
    async prepare() {
      const selected = await selectFirstSampleOrder();
      if (!selected) {
        console.warn('Auto Fill Order: không chọn được "Đơn hàng mẫu" nào, vẫn tiếp tục điền đơn.');
      } else {
        await new Promise(resolve => setTimeout(resolve, 600));
      }
      return true;
    },

    fill(name, phone, address, orderCode, codAmount, collectFee) {
      // Chọn "Địa chỉ mới"
      document.querySelectorAll('label, span, input[type="radio"]').forEach(el => {
        if (el.innerText?.trim() === 'Địa chỉ mới') {
          const radioClick = el.querySelector('input') || el.closest('label') || el;
          radioClick.click();
        }
      });

      let phoneEl = findFieldInput(VNPOST_SELECTORS.phoneLabels, VNPOST_SELECTORS.phoneFallbacks);
      let nameEl  = findFieldInput(VNPOST_SELECTORS.nameLabels,  VNPOST_SELECTORS.nameFallbacks);
      let addrEl  = findFieldInput(VNPOST_SELECTORS.addressLabels, VNPOST_SELECTORS.addressFallbacks, true);
      let noteEl  = findFieldInput(VNPOST_SELECTORS.noteLabels,  VNPOST_SELECTORS.noteFallbacks, true);

      if (phone) {
        const cleanPhone = phone.replace(/[^0-9]/g, '');
        if (phoneEl) setInputValue(phoneEl, cleanPhone);
      }

      if (name && nameEl) setInputValue(nameEl, name);
      if (address && address !== "không tìm thấy" && addrEl) setInputValue(addrEl, address);

      if (noteEl) {
        const defaultGoodsName = globalThis.parsedDataStore?.defaultGoodsName || 'Hàng hóa';
        let noteText = orderCode ? "Đơn hàng: " + orderCode : defaultGoodsName;
        if (globalThis.parsedDataStore?.extraNote) {
          noteText += (noteText ? " | " : "") + globalThis.parsedDataStore.extraNote;
        }
        if (globalThis.parsedDataStore?.extraPhones?.length) {
          noteText += (noteText ? " | " : "") + "SDT phụ: " + globalThis.parsedDataStore.extraPhones.join(', ');
        }
        setInputValue(noteEl, noteText);
      }

      // Điền khối lượng mặc định VNPost
      let weightEl = document.querySelector('input[placeholder*="khối lượng" i]') || 
                     document.querySelector('input[placeholder*="Khối lượng" i]') ||
                     document.querySelector('input[placeholder*="trọng lượng" i]') ||
                     document.querySelector('input[placeholder*="Trọng lượng" i]');
      if (!weightEl) {
        document.querySelectorAll('.ant-form-item, .form-item, div').forEach(item => {
          const text = (item.innerText || '').trim();
          if (/Khối lượng|Trọng lượng/i.test(text) && !/thể tích|kích thước/i.test(text)) {
            const el = item.querySelector('input');
            if (el) weightEl = el;
          }
        });
      }
      if (weightEl) {
        const defaultWeightVnpost = globalThis.parsedDataStore?.defaultWeightVnpost !== undefined ? globalThis.parsedDataStore.defaultWeightVnpost : 200;
        setInputValue(weightEl, String(defaultWeightVnpost));
      }

      if (codAmount && codAmount > 0) {
        autoCOD(codAmount);
      }

      // Thu phí ship: thực hiện SAU khi form đã điền xong
      // (delay 500ms để đảm bảo checkbox đã hiện sau khi form load)
      if (collectFee) {
        setTimeout(() => {
          const ok = setVNPostShipFee(true);
          if (!ok) {
            // Thử lần 2 sau 1 giây nếu lần đầu chưa tìm thấy checkbox
            setTimeout(() => setVNPostShipFee(true), 1000);
          }
        }, 500);
      }
    }

  };

  globalThis.VNPostAdapter = VNPostAdapter;
})();
