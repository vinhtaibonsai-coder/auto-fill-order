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
      if (!selectEl) return false;

      if (isSampleOrderSelected()) return true;

      const searchInput = selectEl.querySelector('input[role="combobox"], input.ant-select-selection-search-input');
      const clickTarget = selectEl.querySelector('.ant-select-selector') || selectEl;

      if (!selectEl.classList.contains('ant-select-open')) {
        simulateFullClick(clickTarget);
        let opened = await waitFor(() => selectEl.classList.contains('ant-select-open') ? true : null, 250, 25);
        if (!opened) {
          simulateFullClick(searchInput || clickTarget);
          opened = await waitFor(() => selectEl.classList.contains('ant-select-open') ? true : null, 200, 25);
        }
      }

      if (searchInput) {
        searchInput.focus();
        const kbOpts = { bubbles: true, cancelable: true };
        searchInput.dispatchEvent(new KeyboardEvent('keydown', Object.assign({ key: 'Enter', code: 'Enter', keyCode: 13, which: 13 }, kbOpts)));
        searchInput.dispatchEvent(new KeyboardEvent('keyup', Object.assign({ key: 'Enter', code: 'Enter', keyCode: 13, which: 13 }, kbOpts)));
        const confirmedByKeyboard = await waitFor(() => isSampleOrderSelected() ? true : null, 250, 25);
        if (confirmedByKeyboard) return true;
      }

      const dropdown = await waitFor(() => document.querySelector('.ant-select-dropdown:not(.ant-select-dropdown-hidden)') || document.querySelector('.ant-select-dropdown'), 300, 25);
      let candidates = dropdown
        ? Array.from(dropdown.querySelectorAll('[role="option"], .ant-select-item-option, .rc-select-item-option, .ant-select-item'))
        : [];

      if (candidates.length === 0 && searchInput && searchInput.id) {
        for (let i = 0; i < 4; i++) {
          const el = document.getElementById(searchInput.id + '_list_' + i);
          if (el) candidates.push(el);
        }
      }

      if (candidates.length === 0) {
        return false;
      }

      for (const candidate of candidates.slice(0, 3)) {
        const inner = candidate.querySelector('.ant-select-item-option-content') || candidate;
        simulateFullClick(inner);
        let confirmed = await waitFor(() => isSampleOrderSelected() ? true : null, 150, 25);
        if (confirmed) return true;

        simulateFullClick(candidate);
        confirmed = await waitFor(() => isSampleOrderSelected() ? true : null, 150, 25);
        if (confirmed) return true;
      }

      return false;
    } catch (e) {
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
        const rows = [...document.querySelectorAll("tr.g-tr, tr, [role='row'], .ant-table-row")];
        return rows.find(row => {
          const t = (row.innerText || row.textContent || '').toLowerCase();
          return (t.includes("phát hàng thu tiền") || t.includes("thu tiền cod") || t.includes("tiền thu hộ") || t.includes("thu hộ (cod)")) && !t.includes("hủy");
        }) || null;
      }, 800, 30);
      
      let checkbox = null;
      let input = null;

      if (codRow) {
        checkbox = codRow.querySelector('input.ant-checkbox-input, input[type="checkbox"]');
        input = codRow.querySelector('input.ant-input-number-input, input[name="PROP0018"], input[role="spinbutton"]');
      } else {
        const label = Array.from(document.querySelectorAll('label, span, b, div')).find(el => {
          const txt = (el.innerText || el.textContent || '').toLowerCase();
          return (txt.includes('phát hàng thu tiền') || txt.includes('thu tiền cod') || txt.includes('tiền thu hộ')) && !txt.includes('hủy');
        });
        if (label) {
          const container = label.closest('.ant-form-item, tr, .ant-row') || label.parentElement;
          if (container) {
            checkbox = container.querySelector('input.ant-checkbox-input, input[type="checkbox"]');
            input = container.querySelector('input.ant-input-number-input, input[name="PROP0018"], input[role="spinbutton"]');
          }
        }
      }

      if (checkbox && !checkbox.checked) {
        const checkTarget = checkbox.closest('.ant-checkbox, label') || checkbox;
        simulateFullClick(checkTarget);
        if (!checkbox.checked) {
          checkbox.checked = true;
          checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        }
        await waitFor(function() {
          const inp = input || document.querySelector('input[name="PROP0018"]') || (codRow ? codRow.querySelector('input.ant-input-number-input, input[role="spinbutton"]') : null);
          if (inp && !inp.disabled) {
            input = inp;
            return inp;
          }
          return null;
        }, 800, 30);
      }

      if (!input) {
        input = document.querySelector('input[name="PROP0018"]') || 
                (codRow ? codRow.querySelector('input:not([type="checkbox"])') : null);
      }
      if (!input) return false;

      input.focus();
      setInputValue(input, String(codValue));
      const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      if (nativeSetter) {
        nativeSetter.call(input, String(codValue));
      }
      input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: String(codValue) }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      input.blur();

      await waitFor(function() { 
        const v = String(input.value || '').replace(/\D/g, '');
        const target = String(codValue).replace(/\D/g, '');
        return v === target ? true : null; 
      }, 300, 30);
      return true;
    } catch (err) { console.log("❌ autoCOD ERROR:", err); return false; }
  }

  async function resolveVNPostDefaultWeight(store = {}) {
    const inMemoryWeight = Number(store.defaultWeightVnpost);
    if (Number.isFinite(inMemoryWeight) && inMemoryWeight > 0) return inMemoryWeight;

    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      const stored = await new Promise(resolve => {
        chrome.storage.local.get(['order_default_settings', 'default_weight_vnpost'], result => {
          if (chrome.runtime?.lastError) return resolve(undefined);
          const val = result?.order_default_settings?.defaultWeight !== undefined 
            ? result.order_default_settings.defaultWeight 
            : (result?.order_default_settings?.default_weight_vnpost !== undefined 
                ? result.order_default_settings.default_weight_vnpost 
                : result?.default_weight_vnpost);
          resolve(val);
        });
      });
      const storedWeight = Number(stored);
      if (Number.isFinite(storedWeight) && storedWeight > 0) return storedWeight;

      const pkgStored = await new Promise(resolve => {
        chrome.storage.local.get(['default_package_weight', 'activeShop'], res => {
          if (chrome.runtime?.lastError) return resolve(undefined);
          if (res?.default_package_weight && Number(res.default_package_weight) > 0) return resolve(Number(res.default_package_weight));
          if (res?.activeShop?.default_package_weight && Number(res.activeShop.default_package_weight) > 0) return resolve(Number(res.activeShop.default_package_weight));
          resolve(undefined);
        });
      });
      if (pkgStored) return pkgStored;
    }

    try {
      if (typeof OrderStorage !== 'undefined' && typeof OrderStorage.getActiveShop === 'function') {
        const activeShop = await OrderStorage.getActiveShop().catch(() => null);
        if (activeShop?.default_package_weight && Number(activeShop.default_package_weight) > 0) {
          return Number(activeShop.default_package_weight);
        }
      }
    } catch (_) {}

    try {
      const rawPkg = localStorage.getItem('default_package_weight');
      if (rawPkg && Number(rawPkg) > 0) return Number(rawPkg);

      const raw = localStorage.getItem('order_default_settings');
      if (raw) {
        const obj = JSON.parse(raw);
        if (obj.defaultWeight && Number(obj.defaultWeight) > 0) return Number(obj.defaultWeight);
        if (obj.default_weight_vnpost && Number(obj.default_weight_vnpost) > 0) return Number(obj.default_weight_vnpost);
      }
      const rawLeg = localStorage.getItem('default_weight_vnpost');
      if (rawLeg && Number(rawLeg) > 0) return Number(rawLeg);
    } catch (_) {}

    return 200;
  }

  async function resolveVNPostDefaultGoodsName(store = {}) {
    if (store.defaultGoodsName && typeof store.defaultGoodsName === 'string' && store.defaultGoodsName.trim()) {
      return store.defaultGoodsName.trim();
    }

    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      const stored = await new Promise(resolve => {
        chrome.storage.local.get(['order_default_settings', 'default_goods_name'], result => {
          if (chrome.runtime?.lastError) return resolve(undefined);
          const val = result?.order_default_settings?.defaultItemName ||
                      result?.order_default_settings?.defaultGoodsName ||
                      result?.default_goods_name;
          resolve(val);
        });
      });
      if (stored && typeof stored === 'string' && stored.trim()) return stored.trim();
    }

    try {
      const raw = localStorage.getItem('order_default_settings');
      if (raw) {
        const obj = JSON.parse(raw);
        const val = obj.defaultItemName || obj.defaultGoodsName;
        if (val && typeof val === 'string' && val.trim()) return val.trim();
      }
      const rawLeg = localStorage.getItem('default_goods_name');
      if (rawLeg && typeof rawLeg === 'string' && rawLeg.trim()) return rawLeg.trim();
    } catch (_) {}

    return 'Hàng hóa';
  }

  const VNPostAdapter = {
    async prepare() {
      if (!isSampleOrderSelected()) {
        await Promise.race([
          selectFirstSampleOrder(),
          new Promise(resolve => setTimeout(resolve, 350))
        ]);
      }
      return true;
    },

    async fill(name, phone, address, orderCode, codAmount, collectFee) {
      const store = globalThis.parsedDataStore || {};
      // 1. Chọn chế độ "Địa chỉ mới" và đợi DOM render
      try {
        const allRadioWrappers = Array.from(document.querySelectorAll('.ant-radio-wrapper, label, span, input[type="radio"]'));
        for (const el of allRadioWrappers) {
          const txt = (el.innerText || el.textContent || '').trim();
          if (/^địa chỉ mới$/i.test(txt) || txt.includes('Địa chỉ mới')) {
            const radioInput = el.querySelector('input[type="radio"]') || (el.tagName === 'INPUT' ? el : null);
            const clickTarget = radioInput || el.closest('label') || el;
            simulateFullClick(clickTarget);
            if (radioInput && !radioInput.checked) {
              radioInput.checked = true;
              radioInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
            break;
          }
        }
      } catch (e) {
        console.warn('Lỗi chọn Địa chỉ mới:', e);
      }

      // Đợi ngắn để React render các trường nhập liệu của "Địa chỉ mới"
      await new Promise(resolve => setTimeout(resolve, 60));

      let phoneEl = document.querySelector('#form-create-order_receiverPhone') ||
                    document.querySelector('input#receiverPhone') ||
                    findFieldInput(VNPOST_SELECTORS.phoneLabels, VNPOST_SELECTORS.phoneFallbacks);
      let nameEl  = document.querySelector('#form-create-order_receiverName') ||
                    document.querySelector('input#receiverName') ||
                    findFieldInput(VNPOST_SELECTORS.nameLabels,  VNPOST_SELECTORS.nameFallbacks);
      
      // Tìm chính xác ô nhập địa chỉ mới (#form-create-order_receiverAddress / Địa chỉ chi tiết / Số nhà, đường...)
      let addrEl = document.querySelector('#form-create-order_receiverAddress') ||
                   document.querySelector('input#form-create-order_receiverAddress') ||
                   document.querySelector('input[placeholder="Địa chỉ chi tiết"]') ||
                   document.querySelector('input[placeholder*="Địa chỉ chi tiết" i]');
      
      if (!addrEl) {
        const addrCandidates = Array.from(document.querySelectorAll('textarea, input')).filter(el => {
          if (el.type === 'hidden' || el.type === 'radio' || el.type === 'checkbox' || el.disabled) return false;
          const ph = (el.placeholder || '').toLowerCase();
          const nm = (el.name || '').toLowerCase();
          const id = (el.id || '').toLowerCase();
          const lbl = (el.closest('.ant-form-item')?.querySelector('label')?.innerText || '').toLowerCase();
          if (id.includes('sender') || nm.includes('sender') || ph.includes('người gửi') || lbl.includes('người gửi')) return false;
          return (
            id.includes('receiveraddress') || nm.includes('receiveraddress') ||
            ph.includes('địa chỉ chi tiết') || ph.includes('số nhà') || ph.includes('địa chỉ') ||
            lbl.includes('địa chỉ chi tiết') || lbl.includes('địa chỉ mới')
          );
        });

        if (addrCandidates.length > 0) {
          addrEl = addrCandidates.find(el => {
            const card = el.closest('.ant-card, form');
            const head = (card?.querySelector('.ant-card-head, h3, h4')?.innerText || card?.innerText.slice(0, 100) || '').toLowerCase();
            return !head.includes('người gửi') || head.includes('người nhận');
          }) || addrCandidates[0];
        }
      }

      if (!addrEl) {
        addrEl = findFieldInput(VNPOST_SELECTORS.addressLabels, VNPOST_SELECTORS.addressFallbacks, true);
      }
      let noteEl  = document.querySelector('#form-create-order_receiverNote') ||
                    document.querySelector('#form-create-order_note') ||
                    findFieldInput(VNPOST_SELECTORS.noteLabels,  VNPOST_SELECTORS.noteFallbacks, true);

      if (phone) {
        const cleanPhone = phone.replace(/[^0-9]/g, '');
        if (phoneEl) setInputValue(phoneEl, cleanPhone);
      }

      if (name && nameEl) setInputValue(nameEl, name);
      if (address && address !== "không tìm thấy" && addrEl) setInputValue(addrEl, address);

      function isSearchOrFilterInput(el) {
        if (!el) return true;
        if (el.type === 'search' || el.getAttribute('type') === 'search') return true;
        const ph = (el.placeholder || '').toLowerCase();
        if (ph.includes('tìm kiếm') || ph.includes('tra cứu') || ph.includes('search') || ph.includes('lọc')) return true;
        const cls = (el.className || '').toLowerCase();
        if (cls.includes('search') || cls.includes('filter')) return true;
        const id = (el.id || '').toLowerCase();
        if (id.includes('search') || id.includes('filter')) return true;
        const name = (el.name || '').toLowerCase();
        if (name.includes('search') || name.includes('filter')) return true;
        const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
        if (ariaLabel.includes('tìm kiếm') || ariaLabel.includes('search')) return true;
        if (el.closest('.ant-input-search, [role="search"], header, nav, .ant-layout-header, .ant-pro-top-nav-header, .ant-table-filter-dropdown')) return true;
        return false;
      }

      function findVNPostOrderCodeEl() {
        const directSelectors = [
          '#form-create-order_customerOrderCode',
          '#form-create-order_clientOrderCode',
          '#form-create-order_shopOrderCode',
          '#form-create-order_orderCode',
          'input#customerOrderCode',
          'input#clientOrderCode',
          'input#shopOrderCode',
          'input#orderCode',
          'input[name="customerOrderCode"]',
          'input[name="clientOrderCode"]'
        ];
        for (const sel of directSelectors) {
          const el = document.querySelector(sel);
          if (el && !isSearchOrFilterInput(el)) return el;
        }

        // Tìm strictly trong vùng form tạo đơn hàng
        const orderForm = document.querySelector('#form-create-order') || 
                          document.querySelector('form.ant-form:not(.ant-advanced-search-form)') || 
                          document.querySelector('.ant-card-body');
        if (orderForm) {
          const formItems = orderForm.querySelectorAll('.ant-form-item, .form-item, .ant-row');
          for (const item of formItems) {
            const labelEl = item.querySelector('label, .ant-form-item-label');
            const labelText = (labelEl ? labelEl.innerText : '').trim().toLowerCase();
            if ((labelText.includes('mã đơn khách') || labelText.includes('mã khách hàng') || labelText.includes('mã đơn của shop') || labelText.includes('mã tham chiếu') || (labelText.includes('mã đơn') && !labelText.includes('vận đơn'))) &&
                !labelText.includes('tìm kiếm') && !labelText.includes('tra cứu')) {
              const inp = item.querySelector('input:not([type="hidden"]):not([type="search"])');
              if (inp && !isSearchOrFilterInput(inp)) return inp;
            }
          }

          const inputs = orderForm.querySelectorAll('input:not([type="hidden"]):not([type="search"])');
          for (const inp of inputs) {
            if (isSearchOrFilterInput(inp)) continue;
            const ph = (inp.placeholder || '').toLowerCase();
            if ((ph.includes('mã đơn khách') || ph.includes('mã tham chiếu') || ph.includes('mã đơn của shop')) && !ph.includes('tìm kiếm') && !ph.includes('tra cứu')) {
              return inp;
            }
          }
        }
        return null;
      }

      // Chuẩn hóa mã đơn hàng theo quy chuẩn VNPost: không dấu tiếng Việt, không khoảng cách
      function formatVNPostOrderCode(code) {
        if (!code) return '';
        return String(code)
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/đ/g, 'd')
          .replace(/Đ/g, 'D')
          .replace(/\s+/g, '')
          .trim();
      }

      // Điền mã đơn hàng của shop vào form VNPost (chỉ điền vào trường form đơn hàng, tuyệt đối không nhập vào ô tìm kiếm)
      let orderCodeEl = findVNPostOrderCodeEl();
      const cleanVNPostCode = formatVNPostOrderCode(orderCode);
      if (cleanVNPostCode && orderCodeEl) {
        setInputValue(orderCodeEl, cleanVNPostCode);
      }

      // Điền Tên hàng hóa / Nội dung vào form VNPost
      const defaultGoodsName = (store.defaultGoodsName && typeof store.defaultGoodsName === 'string' && store.defaultGoodsName.trim())
        ? store.defaultGoodsName.trim()
        : await resolveVNPostDefaultGoodsName(store);
      let noteText = orderCode ? ("Đơn hàng: " + orderCode) : defaultGoodsName;
      if (store.productItem && store.productItem.trim() && store.productItem.trim() !== orderCode) {
        noteText = store.productItem.trim() + (orderCode ? (" | Đơn hàng: " + orderCode) : "");
      }
      if (store.extraNote) {
        noteText += (noteText ? " | " : "") + store.extraNote;
      }
      if (store.extraPhones?.length) {
        noteText += (noteText ? " | " : "") + "SDT phụ: " + store.extraPhones.join(', ');
      }

      function findVNPostContentEl() {
        let el = document.querySelector('#form-create-order_receiverNote') ||
                 document.querySelector('#form-create-order_note') ||
                 document.querySelector('#form-create-order_goodsName') ||
                 document.querySelector('#form-create-order_itemName') ||
                 document.querySelector('#form-create-order_productName') ||
                 document.querySelector('textarea#receiverNote') ||
                 document.querySelector('textarea#note') ||
                 document.querySelector('textarea[name*="note" i]') ||
                 document.querySelector('textarea[placeholder*="nội dung" i]') ||
                 document.querySelector('textarea[placeholder*="Nội dung" i]') ||
                 document.querySelector('textarea[placeholder*="ghi chú" i]') ||
                 document.querySelector('input[placeholder*="tên hàng" i]') ||
                 document.querySelector('input[placeholder*="nội dung hàng" i]');
        if (el && !isSearchOrFilterInput(el)) return el;

        const orderForm = document.querySelector('#form-create-order') || 
                          document.querySelector('form.ant-form:not(.ant-advanced-search-form)') || 
                          document;
        const formItems = orderForm.querySelectorAll('.ant-form-item, .form-item, .ant-row');
        for (const item of formItems) {
          const labelEl = item.querySelector('label, .ant-form-item-label');
          const labelText = (labelEl ? labelEl.innerText : '').trim().toLowerCase();
          if (labelText.includes('nội dung') || labelText.includes('ghi chú') || labelText.includes('tên hàng') || labelText.includes('mô tả hàng')) {
            const ta = item.querySelector('textarea, input[type="text"], input');
            if (ta && ta.type !== 'hidden' && !isSearchOrFilterInput(ta)) return ta;
          }
        }
        return null;
      }

      const contentEl = findVNPostContentEl();
      if (contentEl) {
        setInputValue(contentEl, noteText);
      }

      // Nếu có ô Tên hàng hóa riêng biệt với ô Ghi chú/Nội dung, điền cả hai để VNPost in bill đầy đủ
      const separateGoodsEl = document.querySelector('#form-create-order_goodsName') ||
                              document.querySelector('#form-create-order_productName') ||
                              document.querySelector('input[placeholder*="tên hàng" i]');
      if (separateGoodsEl && separateGoodsEl !== contentEl && !isSearchOrFilterInput(separateGoodsEl)) {
        setInputValue(separateGoodsEl, store.productItem?.trim() || defaultGoodsName);
      }

      // ─── ĐIỀN KHỐI LƯỢNG MẶC ĐỊNH VNPOST (GRAM) ───
      function findVNPostWeightEl() {
        let el = document.querySelector('#form-create-order_weight') ||
                 document.querySelector('#form-create-order_totalWeight') ||
                 document.querySelector('input#weight') ||
                 document.querySelector('input#totalWeight') ||
                 document.querySelector('input[name="weight"]') ||
                 document.querySelector('input[name="totalWeight"]') ||
                 document.querySelector('input[placeholder*="khối lượng" i]') || 
                 document.querySelector('input[placeholder*="Khối lượng" i]') ||
                 document.querySelector('input[placeholder*="trọng lượng" i]') ||
                 document.querySelector('input[placeholder*="Trọng lượng" i]');
        if (el) return el;

        // Tìm theo nhãn label / form-item chứa chữ "Tổng khối lượng" hoặc "Khối lượng"
        const labels = Array.from(document.querySelectorAll('label, .ant-form-item-label, .form-label, span, b, div'));
        for (const lbl of labels) {
          const txt = (lbl.innerText || lbl.textContent || '').trim().toLowerCase();
          if ((txt === 'tổng khối lượng' || txt === 'tổng khối lượng *' || txt.includes('tổng khối lượng') || txt.includes('khối lượng')) && 
              !txt.includes('tính cước') && !txt.includes('quy đổi') && !txt.includes('kích thước') && !txt.includes('chi tiết')) {
            const container = lbl.closest('.ant-form-item, .ant-row, .form-item, .form-group') || lbl.parentElement?.parentElement;
            if (container) {
              const inp = container.querySelector('input.ant-input-number-input, input[role="spinbutton"], input[type="text"], input[type="number"], input');
              if (inp && inp.type !== 'hidden') {
                return inp;
              }
            }
          }
        }

        // Tìm ô input-number có suffix 'gram' trong phần thông tin hàng hóa
        const numberInputs = document.querySelectorAll('.ant-input-number, .ant-input-number-affix-wrapper');
        for (const wrap of numberInputs) {
          const parentText = (wrap.parentElement?.innerText || wrap.closest('.ant-form-item')?.innerText || '').toLowerCase();
          if (parentText.includes('khối lượng') || parentText.includes('trọng lượng') || (parentText.includes('gram') && !parentText.includes('quy đổi') && !parentText.includes('kích thước'))) {
            const inp = wrap.querySelector('input');
            if (inp) return inp;
          }
        }

        return null;
      }

      function fillVNPostWeight(val) {
        const wEl = findVNPostWeightEl();
        if (!wEl) return false;
        const strVal = String(val || 200);
        setInputValue(wEl, strVal);
        try {
          wEl.dispatchEvent(new Event('input', { bubbles: true }));
          wEl.dispatchEvent(new Event('change', { bubbles: true }));
          wEl.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
        } catch (_) {}
        return true;
      }

      const defaultWeightVnpost = (store.defaultWeightVnpost !== undefined && Number(store.defaultWeightVnpost) > 0) 
        ? Number(store.defaultWeightVnpost) 
        : await resolveVNPostDefaultWeight(store);

      // 1. Điền tức thì
      fillVNPostWeight(defaultWeightVnpost);

      // 2. Tự động áp dụng lại sau 500ms, 1200ms và 2000ms để chống VNPost template async ghi đè về 0 / Hàng hóa
      setTimeout(() => {
        fillVNPostWeight(defaultWeightVnpost);
        const cEl = findVNPostContentEl();
        if (cEl && (!cEl.value || cEl.value === 'Hàng hóa' || cEl.value === '0')) {
          setInputValue(cEl, noteText);
        }
      }, 500);

      setTimeout(() => {
        fillVNPostWeight(defaultWeightVnpost);
        const cEl = findVNPostContentEl();
        if (cEl && (!cEl.value || cEl.value === 'Hàng hóa' || cEl.value === '0')) {
          setInputValue(cEl, noteText);
        }
      }, 1200);

      setTimeout(() => {
        fillVNPostWeight(defaultWeightVnpost);
      }, 2000);

      if (codAmount && Number(codAmount) > 0) {
        await autoCOD(codAmount);
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
