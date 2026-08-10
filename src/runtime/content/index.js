import { OrderStorage } from '../../application/storage.js';

(() => {
  // =========================================================================
  // ENTRY POINT / COORDINATOR - content/index.js
  // =========================================================================

  // Chỉ chạy ở frame gốc (top frame) — tránh inject panel vào iframe con của J&T micro-frontend
  if (window !== window.top) return;

  if (globalThis.parsedDataStore === undefined) {
    globalThis.parsedDataStore = null;
  }
  let timeoutId = null;
  let observerActive = false;

  function onDOMReady(fn) {
    if (document.readyState === 'interactive' || document.readyState === 'complete') {
      fn();
    } else {
      document.addEventListener('DOMContentLoaded', fn);
    }
  }

  const observer = new MutationObserver(() => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      checkUrlAndInject();
    }, 250);
  });

  function startObserver() {
    if (observerActive) return;
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
      observerActive = true;
    }
  }

  function stopObserver() {
    if (!observerActive) return;
    observer.disconnect();
    observerActive = false;
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  }

  function getCurrentPlatform() {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    if (url.includes('vnpost.vn')) return 'vnpost';
    if (url.includes('jtexpress.vn')) return 'jt';
    if (url.includes('ghn.vn')) return 'ghn';
    if (url.includes('ghtk.vn')) return 'ghtk';
    if (url.includes('viettelpost.vn')) return 'viettel';
    return null;
  }

  async function checkUrlAndInject() {
    const platform = getCurrentPlatform();
    if (platform) {
      startObserver();
      setTimeout(async function() {
        let isAuth = false;
        try {
          if (typeof AuthService !== 'undefined' && typeof AuthService.isAuthenticated === 'function') {
            isAuth = await AuthService.isAuthenticated();
          }
        } catch (err) {
          console.warn('[checkUrlAndInject] Error checking auth state:', err);
          isAuth = false;
        }

        if (!isAuth) {
          if (typeof createLoginRequiredPanel === 'function') {
            createLoginRequiredPanel(platform, openSettingsPage);
          }
          return;
        }

        if (typeof createInputPanel === 'function') {
          globalThis.afTriggerFillForm = triggerFillForm;
          globalThis.afHandleSaveOrder = handleSaveOrder;
          
          createInputPanel(
            platform,
            handleHybridParsing,
            triggerFillForm,
            handleClearOrder,
            handleAiAddressClick,
            openSettingsPage,
            updateParsedField,
            handleSaveOrder
          );
        } else {
          console.log('[checkUrlAndInject] React Panel is taking over. No vanilla UI injected.');
        }
      }, 50);
    } else {
      stopObserver();
      const host = document.getElementById('vnpost-autofill-shadow-host');
      if (host) host.remove();
    }
  }

  globalThis.checkUrlAndInject = checkUrlAndInject;

  // ─── ĐĂNG KÝ SỰ KIỆN URL NAVIGATION & TUẦN HOÀN THEO DÕI URL (SPA POLL) ───
  window.addEventListener('popstate', checkUrlAndInject);
  window.addEventListener('hashchange', checkUrlAndInject);

  let lastUrlForPoll = typeof window !== 'undefined' ? window.location.href : '';
  setInterval(() => {
    if (typeof window !== 'undefined' && window.location.href !== lastUrlForPoll) {
      lastUrlForPoll = window.location.href;
      checkUrlAndInject();
    }
  }, 500);

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    checkUrlAndInject();
  } else {
    window.addEventListener('DOMContentLoaded', checkUrlAndInject);
  }

  // Khởi chạy observer dự phòng
  if (document.body) {
    startObserver();
  } else {
    window.addEventListener('DOMContentLoaded', () => {
      if (document.body) startObserver();
    });
  }

  // ─── XỬ LÝ LỌC TRÙNG & PHÂN TÍCH HYBRID ───
  async function handleHybridParsing() {
    if (typeof loadCustomL2Mappings === 'function') await loadCustomL2Mappings();
    const rawTextEl = getVnpostEl('rawOrderText');
    const text = rawTextEl ? rawTextEl.value.trim() : '';
    if (!text) {
      showVnpostToast("⚠️ Vui lòng dán thông tin đơn hàng thô!", "error");
      return;
    }

    // Lấy khóa xử lý AI để tránh chạy nhiều luồng cùng lúc (Lỗi số 1 và 7)
    const acquired = await Mutex.acquire('ai_parsing');
    if (!acquired) {
      showVnpostToast("⏳ AI đang bóc tách, vui lòng đợi...", "info");
      return;
    }

    const btnParse = getVnpostEl('btnParseOrder');
    const progContainer = getVnpostEl('gemini-progress-container');
    const progBar = getVnpostEl('gemini-progress-bar');
    const txtStatus = getVnpostEl('ai-status');
    const txtPercent = getVnpostEl('ai-percent');

    if (btnParse) {
      btnParse.disabled = true;
      btnParse.style.backgroundColor = "#cccccc";
      btnParse.textContent = "⏳ Đang xử lý...";
    }

    if (typeof showPanelSkeleton === 'function') {
      showPanelSkeleton();
    }

    try {
      // Bước 1: Phân tích máy tính cục bộ cực nhanh
      const localResult = runLocalComputerParser(text);
      const rawExtractedAddress = localResult.address;

      // Lau sạch địa chỉ gốc tối thiểu: chỉ xóa sđt, ký tự thừa — KHÔNG phân tích cấp hành chính
      let cleanRaw = rawExtractedAddress;
      (localResult.extraPhones || []).forEach(p => { cleanRaw = cleanRaw.replace(p, ''); });
      if (localResult.phone) {
        cleanRaw = cleanRaw.replace(localResult.phone, '');
      }
      cleanRaw = cleanRaw.replace(/sđt|sdt|đt|dt|tel|phone|lh|liên hệ\s*\d{0,11}\s*/gi, '');
      cleanRaw = cleanRaw.replace(/địa chỉ\s*:?\s*/gi, '');
      cleanRaw = cleanRaw.replace(/^[-\s\.\,\/]+|[-\s\.\,\/]+$/g, '').trim();
      cleanRaw = cleanRaw.replace(/,+/g, ',').trim();
      cleanRaw = cleanRaw.replace(/\s+/g, ' ').trim();
      cleanRaw = cleanRaw.replace(/\s*,\s*/g, ', ');
      cleanRaw = cleanRaw.replace(/(^|\s)([a-zAÀ-ỹ])/g, (_, sp, c) => sp + c.toUpperCase());
      cleanRaw = cleanRaw.replace(/(^|,\s*)([a-zAÀ-ỹ])/g, (_, sp, c) => sp + c.toUpperCase());
      localResult.address = cleanRaw || rawExtractedAddress;

      // Hiển thị địa chỉ gốc (chưa chuẩn hóa) trong rev-address
      globalThis.parsedDataStore = localResult;
      displayParsedData(localResult);
      
      try {
        window.dispatchEvent(new CustomEvent('autofill:parsed', { detail: globalThis.parsedDataStore }));
      } catch (e) {}

      if (progContainer && progBar && txtStatus && txtPercent) {
        progContainer.style.display = 'block';
        progBar.style.width = '30%';
        txtStatus.textContent = "⚡ Đang kiểm tra cơ sở dữ liệu địa giới...";
        txtPercent.textContent = "30%";
      }

      // Hiển thị địa chỉ gốc ngay lập tức (không chờ pipeline)
      const rawSuggest = getVnpostEl('rev-suggest-2level');
      if (rawSuggest && localResult.address) {
        rawSuggest.textContent = localResult.address;
      }

      // Bước 2: Chuẩn hóa địa chỉ qua Address Engine — timeout 5s để tránh treo
      let addrResult;
      try {
        addrResult = await Promise.race([
          AddressEngine.process(localResult.address, localResult.phone),
          new Promise((_, reject) => setTimeout(() => reject(new Error('AddressEngine timeout')), 5000))
        ]);
      } catch (_engErr) {
        console.warn('[Parse] AddressEngine.process failed:', _engErr);
        addrResult = null;
      }

      // Cập nhật addressParts từ pipeline chuẩn hóa (dùng cho gợi ý & fill form)
      if (addrResult) {
        localResult.addressParts = {
          ward:     addrResult.ward     || '',
          district: addrResult.district || '',
          province: addrResult.province || ''
        };
      } else {
        localResult.addressParts = { ward: '', district: '', province: '' };
      }
      globalThis.parsedDataStore = localResult;

      // Chạy geo-matching để hiển thị notice sáp nhập (không ghi đè gợi ý)
      if (addrResult) {
        const stdAddress = addrResult.fullAddress || localResult.address;
        try {
          runGeoMatchingAndShow(stdAddress, rawExtractedAddress);
        } catch (_geoErr) {
          console.warn('[Parse] runGeoMatchingAndShow crashed:', _geoErr);
        }
        // Cập nhật gợi ý 2 cấp = đường + phường/xã + tỉnh (KHÔNG có quận/huyện)
        const suggestEl = getVnpostEl('rev-suggest-2level');
        if (suggestEl) {
          const parts2 = [];
          if (addrResult.street) parts2.push(addrResult.street);
          else if (localResult.address) {
            // Lấy phần đường từ địa chỉ thô (trước dấu phẩy đầu tiên có phường/quận)
            const rawParts = localResult.address.split(',').map(p => p.trim());
            const streetPart = rawParts.find(p => /\d/.test(p) && !/^(phường|xã|quận|huyện|tỉnh|thành phố)/i.test(p));
            if (streetPart) parts2.push(streetPart);
          }
          if (addrResult.ward) parts2.push(addrResult.ward);
          if (addrResult.province) parts2.push(addrResult.province);
          suggestEl.textContent = parts2.length > 0 ? parts2.join(', ') : (addrResult.fullAddress || localResult.address);
        }
      }

      // Bỏ qua AI — không gọi runGroq nữa
      if (progBar && txtStatus && txtPercent) {
        progBar.style.width = '100%';
        txtStatus.textContent = "✨ Bóc tách thành công!";
        txtPercent.textContent = "100%";
      }
      if (btnParse) {
        btnParse.disabled = false;
        // Xóa inline style để trả về CSS gradient gốc (không dùng .style.backgroundColor)
        btnParse.style.removeProperty('background-color');
        btnParse.style.removeProperty('background');
        btnParse.innerHTML = (typeof PANEL_ICONS !== 'undefined' && PANEL_ICONS.parse ? PANEL_ICONS.parse + ' ' : '⚡ ') + "Tách Đơn Tự Động";
      }
    } catch (err) {
      Logger.error("Lỗi phân tích đơn:", err);
      showVnpostToast("❌ Có lỗi xảy ra trong quá trình phân tích.", "error");
    } finally {
      Mutex.release('ai_parsing');
    }
  }

  // ─── THEO DÕI MÃ VẬN ĐƠN SAU KHI LÊN ĐƠN ───
  function startTrackingCodeMonitor(savedOrderId, targetPlatform, onCodeFound) {
    let found = false;
    function extractCode(text) {
      if (!text) return null;
      const patterns = [
        /(?:số\s*hiệu\s*bưu\s*gửi|mã\s*bưu\s*gửi|mã\s*vận\s*đơn|mã\s*vận\s*chuyển|mã\s*vận\s*đơn\s*là|mã\s*bưu\s*gửi\s*là)\s*[:;]?\s*([A-Z0-9]{8,22})/i,
        /(?:mã\s*đơn(?:\s*hàng)?|order\s*id|tracking\s*(?:code|no|number)?)\s*[:;]?\s*([A-Z0-9]{8,22})/i,
        /\b(C\d{9,13}VN)\b/i,
        /\b(MP\d{8,12}VN)\b/i,
        /\b(E[A-Z]\d{8,12}VN)\b/i,
        /\b([A-Z]{2}\d{9,13}VN)\b/i,
        /\b(8\d{11,14})\b/
      ];
      for (const p of patterns) {
        const m = text.match(p);
        if (m && m[1]) return m[1].trim();
      }
      if (/^\d{10,15}$/.test(text.trim())) return text.trim();
      return null;
    }

    function tryNotify(code) {
      if (found) return;
      found = true;
      if (typeof onCodeFound === 'function') {
        onCodeFound(code);
      } else if (savedOrderId) {
        OrderStorage.updateSubmittedOrderTracking(savedOrderId, code).then(ok => {
          if (ok) showVnpostToast('📦 Đã lấy mã vận đơn: ' + code, 'success');
        });
      }
      if (trackMo) trackMo.disconnect();
      if (fetchRestore && typeof fetchRestore === 'function') fetchRestore();
      if (trackTimer) clearTimeout(trackTimer);
    }

    // DOM monitoring
    const trackMo = new MutationObserver(() => {
      const allEls = document.querySelectorAll('*:not(script):not(style)');
      for (const el of allEls) {
        if (el.children.length > 0) continue;
        const text = (el.textContent || '').trim();
        if (text.length < 8 || text.length > 200) continue;
        const code = extractCode(text);
        if (code) { tryNotify(code); return; }
      }
    });
    trackMo.observe(document.body, { childList: true, subtree: true, characterData: true });

    // Fetch API interception — bắt response từ API tạo đơn của VNPost
    let fetchRestore = null;
    if (targetPlatform === 'vnpost' || targetPlatform === 'jt') {
      const origFetch = window.fetch.bind(window);
      window.fetch = async function(input, init) {
        const url = typeof input === 'string' ? input : (input instanceof Request ? input.url : '');
        try {
          const response = await origFetch(input, init);
          if (response.ok && url.includes('order') && (init?.method || 'GET').toUpperCase() === 'POST') {
            const clone = response.clone();
            clone.json().then(body => {
              if (!body || found) return;
              const code = body.orderId || body.orderCode || body.trackingCode || body.maVanDon || body.shipmentNumber || body.id || null;
              if (code && /^[A-Z0-9]{8,20}$/i.test(String(code))) tryNotify(String(code));
            }).catch(() => {});
          }
          return response;
        } catch (e) { return origFetch(input, init); }
      };
      fetchRestore = () => { window.fetch = origFetch; };
    }

    // Cho J&T Express: Gọi API danh sách đơn hàng ngầm để lấy mã vận đơn tự động sau khi tạo đơn
    if (targetPlatform === 'jt') {
      const pollJtApi = async () => {
        if (found) return;
        try {
          const endpoints = [
            '/api/order/order/pageList',
            '/api/v2/order/page',
            '/api/order/pageList',
            '/api/order/list',
            '/api/v1/order/list'
          ];
          for (const ep of endpoints) {
            if (found) break;
            const resp = await fetch(ep, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ page: 1, pageSize: 5, pageNum: 1, size: 5 }),
              credentials: 'include'
            }).catch(() => null);

            if (resp && resp.ok) {
              const body = await resp.json().catch(() => null);
              if (body) {
                const list = body.data?.list || body.data?.records || body.data || body.list || [];
                if (Array.isArray(list) && list.length > 0) {
                  for (const item of list) {
                    const code = item.billCode || item.waybillNo || item.trackingNo || item.txLogisticId || item.code || null;
                    if (code && /^[A-Z0-9]{8,22}$/i.test(String(code))) {
                      tryNotify(String(code));
                      break;
                    }
                  }
                }
              }
            }
          }
        } catch (_) {}
      };

      setTimeout(pollJtApi, 1500);
      setTimeout(pollJtApi, 3500);
      setTimeout(pollJtApi, 7000);
    }

    // URL change detection (SPA redirect)
    const urlCheckTimer = setInterval(() => {
      if (found) { clearInterval(urlCheckTimer); return; }
      const text = document.body.innerText || '';
      const code = extractCode(text);
      if (code) tryNotify(code);
    }, 1000);
    setTimeout(() => { clearInterval(urlCheckTimer); if (!found) { trackMo.disconnect(); if (fetchRestore) fetchRestore(); } }, 30000);

    let trackTimer = setTimeout(() => { if (!found) { trackMo.disconnect(); if (fetchRestore) fetchRestore(); } }, 30000);
  }

  // ─── TỰ ĐỘNG LƯU ĐƠN KHI NGƯỜI DÙNG BẤM GỬI ĐƠN TRÊN TRANG ───
  function setupAutoSaveOnSubmit(platform) {
    const submitKeywords = ['tạo đơn', 'đăng đơn', 'lưu đơn', 'gửi đơn', 'tạo bưu gửi', 'tạo mới', 'xác nhận', 'hoàn tất', 'lưu', 'tạo'];

    function scrapeOrderFromDOM(plat) {
      let name = '', phone = '', address = '', orderCode = '', codAmount = 0, collectFee = false;
      try {
        if (plat === 'vnpost' && globalThis.VNPOST_SELECTORS) {
          const sel = globalThis.VNPOST_SELECTORS;
          const phoneEl = globalThis.findFieldInput ? globalThis.findFieldInput(sel.phoneLabels, sel.phoneFallbacks) : document.querySelector('input#receiverPhone') || document.querySelector('input[placeholder*="SĐT" i]');
          const nameEl = globalThis.findFieldInput ? globalThis.findFieldInput(sel.nameLabels, sel.nameFallbacks) : document.querySelector('input#receiverName') || document.querySelector('input[placeholder*="Tên" i]');
          const addrEl = globalThis.findFieldInput ? globalThis.findFieldInput(sel.addressLabels, sel.addressFallbacks, true) : document.querySelector('textarea#receiverAddress') || document.querySelector('input[placeholder*="Địa chỉ" i]');
          const codEl = globalThis.findFieldInput ? globalThis.findFieldInput([/Phát hàng thu tiền COD/i, /Thu tiền COD/i], sel.codInputFallbacks) : document.querySelector('input.ant-input-number-input') || document.querySelector('input[name="PROP0018"]');

          if (phoneEl) phone = phoneEl.value || '';
          if (nameEl) name = nameEl.value || '';
          if (addrEl) address = addrEl.value || '';
          let noteEl = globalThis.findFieldInput ? globalThis.findFieldInput(sel.noteLabels, sel.noteFallbacks, true) : document.querySelector('textarea#receiverNote') || document.querySelector('textarea[placeholder*="Nội dung" i]');
          if (noteEl && noteEl.value) {
            const match = noteEl.value.match(/Đơn hàng:\s*([A-Z0-9.\-_]+)/i);
            if (match) orderCode = match[1];
          }
        } else if (plat === 'jt') {
          const phoneEl = document.querySelector('input[placeholder="Nhập số điện thoại"]');
          const nameEl = document.querySelector('input[placeholder="Nhập tên người nhận"]');
          const addrEl = document.querySelector('input[placeholder="Nhập địa chỉ (Số nhà/ đường/ ngõ/ tòa nhà...)"]') || document.querySelector('input[placeholder*="Số nhà/ đường/ ngõ"]') || document.querySelector('input[placeholder*="địa chỉ"]');
          const orderCodeEl = document.querySelector('input[placeholder*="Mã đơn" i]') || document.querySelector('input[placeholder*="Mã tham chiếu" i]');
          let codInp = document.querySelector('input[placeholder="Nhập số tiền..."]') || document.querySelector('input[placeholder="Nhập số tiền"]') || document.querySelector('#money');
          
          if (!codInp) {
            document.querySelectorAll('.el-form-item').forEach(item => {
              const labelText = (item.innerText || '').trim();
              if (labelText.includes('Tiền thu hộ') && !labelText.includes('Phí')) {
                const el = item.querySelector('input');
                if (el) codInp = el;
              }
            });
          }

          if (phoneEl) phone = phoneEl.value || '';
          if (nameEl) name = nameEl.value || '';
          if (addrEl) address = addrEl.value || '';
          if (orderCodeEl) orderCode = orderCodeEl.value || '';
          if (codInp && codInp.value) codAmount = parseInt(codInp.value.replace(/\D/g, ''), 10) || 0;
        }
      } catch (e) {
        console.warn('Lỗi khi cào dữ liệu từ DOM:', e);
      }
      return { name, phone, address, orderCode, codAmount, collectFee };
    }

    function doSave() {
      // Luôn lấy giá trị từ DOM (form VNPost) trước — user có thể đã sửa tay
      let data = scrapeOrderFromDOM(platform);
      const parsed = globalThis.parsedDataStore;
      const hasParsedData = !!parsed;
      
      // Bổ sung các trường còn thiếu từ parsedDataStore (panel)
      if (parsed) {
        if (!data.name) data.name = parsed.name || '';
        if (!data.phone) data.phone = parsed.phone || '';
        if (!data.address) data.address = parsed.address || '';
        if (!data.orderCode) data.orderCode = parsed.orderCode || '';
        if (!data.codAmount) data.codAmount = parsed.codAmount || 0;
        if (!data.collectFee) data.collectFee = parsed.collectFee || false;
        data.extraNote = parsed.extraNote || '';
        if (parsed.id) data.id = parsed.id;
      }
      
      const { name, phone, address, orderCode } = data;
      if (!name && !phone && !address && !orderCode) return;
      
      const orderToSave = {
        name: name || '',
        phone: phone || '',
        address: address && address !== 'không tìm thấy' ? address : '',
        orderCode: orderCode || '',
        codAmount: data.codAmount || 0,
        collectFee: data.collectFee || false,
        platform: platform || '',
        extraNote: data.extraNote || ''
      };
      
      if (data.id) orderToSave.id = data.id;

      // ─── KIỂM TRA LÊN ĐƠN THÀNH CÔNG / THẤT BẠI TRƯỚC KHI GHI NHẬN ───
      let resolved = false;

      function checkDomError() {
        if (resolved) return null;
        // Check các toast / notification / form field error của VNPost & J&T
        const errorSelectors = [
          '.ant-notification-notice-error',
          '.ant-message-error',
          '.ant-alert-error',
          '.el-message--error',
          '.el-notification--error',
          '.el-form-item__error'
        ];
        for (const sel of errorSelectors) {
          const els = document.querySelectorAll(sel);
          for (const el of els) {
            if (el.offsetParent === null) continue; // ẩn / không visible
            const txt = (el.textContent || el.innerText || '').trim();
            if (txt && txt.length > 2) return txt;
          }
        }
        // Check dialog / modal thông báo lỗi
        const dialogs = document.querySelectorAll('.ant-modal-content, .el-dialog, [role="dialog"], .modal-content');
        for (const dlg of dialogs) {
          const txt = (dlg.textContent || dlg.innerText || '').trim();
          if (txt && /(?:lỗi|thất bại|không hợp lệ|không thành công|thiếu|chưa chọn|không đủ|sai)\s*(?:thông tin|dữ liệu|yêu cầu|nhập|chọn|đăng|ghi)?/i.test(txt)) {
            return txt;
          }
        }
        return null;
      }

      function onFailure(errText) {
        if (resolved) return;
        resolved = true;
        cleanup();
        showVnpostToast('❌ VNPost/J&T báo lỗi chưa thành công. Chưa ghi nhận đơn đã lên!', 'error');
      }

      function onSuccess(trackingCode) {
        if (resolved) return;

        // Tìm trackingCode nếu chưa có
        if (!trackingCode) {
          const successEls = document.querySelectorAll('.ant-message-success, .ant-notification-notice, .ant-alert-success, .el-message--success, .el-notification, [role="alert"]');
          for (const el of successEls) {
            const txt = (el.textContent || el.innerText || '').trim();
            const codeMatch = txt.match(/(?:mã\s*vận\s*đơn|mã\s*bưu\s*gửi|số\s*hiệu\s*bưu\s*gửi|tracking)\s*[:;]?\s*([A-Z0-9]{8,22})/i) ||
                              txt.match(/\b([A-Z]{2}\d{9,13}VN|C\d{9,13}VN|MP\d{8,12}VN|E[A-Z]\d{8,12}VN|8\d{11,14})\b/i);
            if (codeMatch && codeMatch[1]) {
              trackingCode = codeMatch[1].trim();
              break;
            }
          }
        }

        // Ghi nhận đơn ngay (cả VNPost và J&T)
        resolved = true;
        cleanup();

        OrderStorage.saveOrder(orderToSave).then(saved => {
          if (hasParsedData && globalThis.parsedDataStore) {
            globalThis.parsedDataStore.id = saved.id;
            globalThis.parsedDataStore.createdAt = saved.createdAt;
          }

          const submittedOrder = {
            id: 'sub_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            name: saved.name || orderToSave.name || '',
            phone: saved.phone || orderToSave.phone || '',
            address: saved.address || orderToSave.address || '',
            orderCode: saved.orderCode || orderToSave.orderCode || '',
            codAmount: saved.codAmount || orderToSave.codAmount || 0,
            collectFee: saved.collectFee || orderToSave.collectFee || false,
            platform: platform || '',
            extraNote: saved.extraNote || orderToSave.extraNote || '',
            trackingCode: trackingCode || '',
            savedOrderId: saved.id
          };

          OrderStorage.saveSubmittedOrder(submittedOrder).then(() => {
            if (trackingCode) {
              showVnpostToast('📦 Đã xác nhận lên đơn! Mã vận đơn: ' + trackingCode, 'success');
            } else if (platform === 'jt') {
              showVnpostToast('✅ Đã ghi nhận đơn J&T thành công!', 'success');
            } else {
              showVnpostToast('📬 Đã ghi nhận đơn VNPost! Đang cập nhật mã vận đơn...', 'success');
              startTrackingCodeMonitor(saved.id, platform);
            }

            // Phát sự kiện báo React panel rằng đơn đã được lưu DB
            window.dispatchEvent(new CustomEvent('order-saved-db'));

            if (hasParsedData) {
              const rawEl = getVnpostEl('rawOrderText');
              if (rawEl) { rawEl.value = ''; rawEl.dispatchEvent(new Event('input', { bubbles: true })); }
              globalThis.parsedDataStore = null;
              const reviewPanel = getVnpostEl('review-panel');
              if (reviewPanel) reviewPanel.style.display = 'none';
            }
          }).catch((err) => {
            console.error('Lỗi khi lưu đơn vào DB:', err);
            showVnpostToast('❌ Lỗi khi lưu đơn vào Database!', 'error');
          });
        }).catch(() => {});
      }

      // Theo dõi DOM mutations
      const domMo = new MutationObserver(() => {
        if (resolved) return;

        // Luôn kiểm tra success TRƯỚC error — tránh field-validation false positive
        // khiến resolved = true trước khi API kịp trả về thành công
        const bodyText = document.body.innerText || '';

        if (platform === 'jt' && /đăng đơn thành công|đơn hàng được tải lên/i.test(bodyText)) {
          onSuccess();
          return;
        }

        if (platform === 'vnpost' && /(?:tạo vận đơn|tạo bưu gửi|tạo đơn|thêm mới|lưu bưu gửi|lưu vận đơn|lưu thông tin).*thành công/i.test(bodyText)) {
          const codeMatch = bodyText.match(/\b([A-Z]{2}\d{9,13}VN|C\d{9,13}VN|MP\d{8,12}VN|E[A-Z]\d{8,12}VN|8\d{11,14})\b/i) ||
                            bodyText.match(/(?:mã\s*vận\s*đơn|số\s*hiệu\s*bưu\s*gửi|mã\s*bưu\s*gửi|tracking)\s*[:;]?\s*([A-Z0-9]{8,22})/i);
          onSuccess(codeMatch ? codeMatch[1].trim() : null);
          return;
        }

        // Check success message trên DOM (CSS class)
        const successSelector = platform === 'vnpost'
          ? '.ant-message-success, .ant-notification-notice-success, .ant-message, .ant-notification-notice, .ant-alert-success, .el-message--success, .el-notification--success, .el-notification, [role="alert"]'
          : '.ant-message-success, .ant-notification-notice-success, .ant-alert-success, .el-message--success, .el-notification--success';
        const successEls = document.querySelectorAll(successSelector);
        if (successEls.length > 0) {
          let foundCode = null;
          for (const el of successEls) {
            const txt = (el.textContent || el.innerText || '').trim();
            const codeMatch = txt.match(/\b([A-Z]{2}\d{9,13}VN|C\d{9,13}VN|MP\d{8,12}VN|E[A-Z]\d{8,12}VN|8\d{11,14})\b/i) ||
                              txt.match(/(?:mã\s*vận\s*đơn|số\s*hiệu\s*bưu\s*gửi|mã\s*bưu\s*gửi|tracking)\s*[:;]?\s*([A-Z0-9]{8,22})/i);
            if (codeMatch && codeMatch[1]) {
              foundCode = codeMatch[1].trim();
              break;
            }
          }
          onSuccess(foundCode);
          return;
        }

        // Chỉ kiểm tra error nếu chưa có success — giảm false positive từ field validation
        const err = checkDomError();
        if (err) {
          onFailure(err);
          return;
        }
      });
      domMo.observe(document.body, { childList: true, subtree: true, characterData: true });

      // Intercept fetch API cho request tạo đơn
      const origFetch = window.fetch.bind(window);
      window.fetch = async function(input, init) {
        const url = typeof input === 'string' ? input : (input instanceof Request ? input.url : '');
        try {
          const response = await origFetch(input, init);
          const method = (init?.method || 'GET').toUpperCase();
          if ((url.includes('order') || url.includes('shipment') || url.includes('delivery') || url.includes('create')) && method === 'POST') {
            const clone = response.clone();
            clone.json().then(body => {
              if (resolved) return;
              if (!response.ok || (body && (body.success === false || body.code === 400 || body.code === 500 || body.error || body.errorMessage))) {
                const errMsg = body?.message || body?.error || body?.errorMessage || ('HTTP ' + response.status);
                onFailure(errMsg);
              } else if (body) {
                const code = body.orderId || body.orderCode || body.trackingCode || body.maVanDon || body.shipmentNumber || body.itemCode || body.barcode || body.code || body.id || null;
                const foundCode = (code && /^[A-Z0-9]{8,22}$/i.test(String(code))) ? String(code) : null;
                onSuccess(foundCode);
              }
            }).catch(() => {
              if (!response.ok) onFailure('HTTP ' + response.status);
            });
          }
          return response;
        } catch (e) {
          return origFetch(input, init);
        }
      };

      function cleanup() {
        domMo.disconnect();
        window.fetch = origFetch;
        if (timerId) clearTimeout(timerId);
      }

      // 2s sau khi bấm gửi, kiểm tra xem có lỗi rõ ràng trên DOM không
      setTimeout(() => {
        if (resolved) return;
        const err = checkDomError();
        if (err) onFailure(err);
      }, 2000);

      // Timeout fallback: lưu đơn nếu không có lỗi sau 15s
      const timerId = setTimeout(() => {
        if (resolved) return;
        const err = checkDomError();
        if (err) {
          onFailure(err);
        } else {
          onSuccess();
        }
      }, 15000);
    }

    function tryHook() {
      const btns = document.querySelectorAll('button, a, input[type="submit"], input[type="button"]');
      for (const btn of btns) {
        const text = (btn.innerText || btn.value || btn.textContent || '').trim().toLowerCase();
        if (!text || text.length > 30) continue;
        if (submitKeywords.some(kw => text.includes(kw))) {
          if (btn.dataset.afAutoSave) continue;
          btn.dataset.afAutoSave = '1';
          btn.addEventListener('click', doSave);
        }
      }
    }

    tryHook();
    const mo = new MutationObserver(tryHook);
    mo.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => mo.disconnect(), 20000);
  }

  // ─── ĐIỀN BIỂU MẪU ĐVVC (MUTEX KHÓA TRÙNG) ───
  async function triggerFillForm(targetPlatform) {
    if (!globalThis.parsedDataStore) {
      showVnpostToast("⚠️ Vui lòng bấm 'Tách Đơn Hàng' trước!", "error");
      return;
    }

    // Chống double click hoặc thao tác lặp ghi đè DOM (Lỗi số 1 & Lỗi số 7)
    const acquired = await Mutex.acquire('autofill_execution');
    if (!acquired) {
      showVnpostToast("⏳ Biểu mẫu đang được điền, vui lòng đợi...", "info");
      return;
    }

    const { name, phone, address, orderCode, codAmount, collectFee } = globalThis.parsedDataStore;

    const adapter = targetPlatform === 'vnpost' ? globalThis.VNPostAdapter : globalThis.JTAdapter;
    if (!adapter) {
      Mutex.release('autofill_execution');
      return;
    }

    const normalizedPhone = normalizePhoneNumber(phone);
    if (!normalizedPhone) {
      showVnpostToast("⚠️ Số điện thoại không đúng định dạng. Vui lòng sửa lại trước khi nhập đơn.", "error");
      // Khôi phục nút trước khi return
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalLabel;
      }
      Mutex.release('autofill_execution');
      return;
    }
    globalThis.parsedDataStore.phone = normalizedPhone;

    const btnId = targetPlatform === 'vnpost' ? 'btnFillVNPost' : 'btnFillJT';
    const btn = getVnpostEl(btnId);
    const originalLabel = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳ Đang xử lý...';
    }

    try {
      if (adapter.prepare) {
        if (btn && targetPlatform === 'vnpost') btn.textContent = '⏳ Đang chọn đơn mẫu...';
        const ok = await adapter.prepare();
        if (!ok) {
          Mutex.release('autofill_execution');
          if (btn) btn.disabled = false;
          return;
        }
      }
      if (btn) btn.textContent = '⏳ Đang chờ biểu mẫu...';

      // Chờ cho đến khi ô nhập số điện thoại xuất hiện (tối đa 8 giây)
      const inputEl = await waitFor(() => {
        const platformSelectors = targetPlatform === 'vnpost' ? globalThis.VNPOST_SELECTORS : globalThis.JT_SELECTORS;
        return findFieldInput(platformSelectors.phoneLabels, platformSelectors.phoneFallbacks);
      }, 8000, 300);

      if (!inputEl) {
        showVnpostToast('❌ Không tìm thấy biểu mẫu điền đơn của trang web.', 'error');
        Mutex.release('autofill_execution');
        if (btn) btn.disabled = false;
        return;
      }

      if (btn) btn.textContent = '⏳ Đang điền đơn...';
      
      // Thực thi điền thông tin (await để chờ J&T dropdown xử lý xong)
      await adapter.fill(name, normalizedPhone, address, orderCode, codAmount, collectFee);
      showVnpostToast('✅ Đã điền đơn thành công!', 'success');

      // Tự động lưu thông tin vào Đơn hàng đã lên đơn
      try {
        if (typeof OrderStorage !== 'undefined' && typeof OrderStorage.saveSubmittedOrder === 'function') {
          await OrderStorage.saveSubmittedOrder({
            name: name || "",
            phone: normalizedPhone || phone || "",
            address: address || "",
            orderCode: orderCode || "",
            codAmount: codAmount || 0,
            collectFee: !!collectFee,
            platform: targetPlatform,
            savedOrderId: globalThis.parsedDataStore?.id || null
          });
        }
      } catch (errSub) {
        console.warn('Lỗi lưu tự động đơn đã lên đơn:', errSub);
      }

      // Tự động theo dõi bấm nút gửi trên trang web
      setupAutoSaveOnSubmit(targetPlatform);

      // Lưu lịch sử tách đơn
      try {
        if (typeof globalThis.SplitHistory !== 'undefined') {
          const rawTextEl = getVnpostEl('rawOrderText');
          const rawText = rawTextEl ? rawTextEl.value.trim() : '';
          const res = await globalThis.SplitHistory.add(rawText, globalThis.parsedDataStore, targetPlatform);
          if (res && res.isDuplicate) {
            showVnpostToast('ℹ️ Đơn này đã được tách trước đó — cập nhật thời gian mới nhất.', 'info');
          }
        }
      } catch (e) {
        console.warn('Lỗi ghi lịch sử:', e);
      }
    } catch (err) {
      Logger.error('Lỗi điền form:', err);
      showVnpostToast('❌ Có lỗi khi điền đơn: ' + (err?.message || err), 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalLabel;
      }
      Mutex.release('autofill_execution');
    }
  }

  // ─── CẬP NHẬT TRƯỜNG CHỈNH SỬA TRỰC TIẾP ───
  function updateParsedField(field, value) {
    if (!globalThis.parsedDataStore) return;
    const oldAddress = globalThis.parsedDataStore.address;
    
    globalThis.parsedDataStore[field] = value;
    if (field === 'phone') {
      showVnpostToast('Đã cập nhật số điện thoại.', 'info');
    }
    
    if (globalThis.parsedDataStore.id) {
      autoUpdateSavedOrder();
    }

    // Tự động học lại khi người dùng sửa thủ công để tối ưu AKB
    if (field === 'address' && value && value !== oldAddress) {
      const rawEl = getVnpostEl('rawOrderText');
      const rawText = rawEl ? rawEl.value.trim() : '';
      const localResult = runLocalComputerParser(rawText);
      const rawAddress = localResult.address;
      if (rawAddress && rawAddress !== "không tìm thấy") {
        const parsedCorrect = AddressParser.parse(AddressNormalizer.normalize(value));
        AddressLearning.learn(rawAddress, parsedCorrect, globalThis.parsedDataStore.phone);
      }
    }
  }

  async function autoUpdateSavedOrder() {
    if (!globalThis.parsedDataStore || !globalThis.parsedDataStore.id) return;
    try {
      const platform = getCurrentPlatform();
      const orderToSave = {
        id: globalThis.parsedDataStore.id,
        name: globalThis.parsedDataStore.name || "",
        phone: globalThis.parsedDataStore.phone || "",
        address: globalThis.parsedDataStore.address && globalThis.parsedDataStore.address !== "không tìm thấy" ? globalThis.parsedDataStore.address : "",
        orderCode: globalThis.parsedDataStore.orderCode || "",
        codAmount: globalThis.parsedDataStore.codAmount || 0,
        collectFee: globalThis.parsedDataStore.collectFee || false,
        extraNote: globalThis.parsedDataStore.extraNote || "",
        platform: platform ? platform.id : "",
        createdAt: globalThis.parsedDataStore.createdAt
      };
      
      await OrderStorage.saveOrder(orderToSave);
      showVnpostToast("🔄 Đã tự động cập nhật thông tin đơn hàng đã lưu!", "success");
    } catch (err) {
      Logger.error("Lỗi khi tự động cập nhật đơn hàng đã lưu:", err);
    }
  }

  function handleAiAddressClick(addressVal) {
    if (!addressVal || !globalThis.parsedDataStore) return;
    copyToClipboard(addressVal);
    
    const oldStyleAddress = strip2025Province(addressVal);
    globalThis.parsedDataStore.address = oldStyleAddress;
    const revAddress = getVnpostEl('rev-address');
    if (revAddress) revAddress.textContent = oldStyleAddress;
    
    if (globalThis.parsedDataStore.id) {
      autoUpdateSavedOrder();
    }

    const aiGeoBox = getVnpostEl('ai-geo-box');
    if (aiGeoBox) {
      aiGeoBox.style.backgroundColor = '#dbeafe';
      setTimeout(() => { aiGeoBox.style.backgroundColor = '#eff6ff'; }, 400);
    }
    const platform = getCurrentPlatform();
    if (platform) triggerFillForm(platform.id);
  }

  function copyToClipboard(text) {
    if (!text || text === "không tìm thấy") return;
    navigator.clipboard.writeText(text).catch(() => {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    });
  }

  function handleClearOrder() {
    globalThis.parsedDataStore = null;
    const rawOrderText = getVnpostEl('rawOrderText');
    if (rawOrderText) {
      rawOrderText.value = '';
      rawOrderText.focus();
    }
    const reviewPanel = getVnpostEl('review-panel');
    const aiGeoBox = getVnpostEl('ai-geo-box');
    const geminiContainer = getVnpostEl('gemini-progress-container');
    if (reviewPanel) reviewPanel.style.display = 'none';
    if (aiGeoBox) aiGeoBox.style.display = 'none';
    if (geminiContainer) geminiContainer.style.display = 'none';
    showVnpostToast('🗑️ Đã xóa, sẵn sàng dán đơn mới.', 'info');
  }

  function openSettingsPage() {
    try {
      chrome.runtime.sendMessage({ action: 'openOptions' }, () => {
        if (chrome.runtime.lastError) {
          showVnpostToast('Không thể tự mở trang cài đặt. Vào chrome://extensions → Auto Fill Order → "Tùy chọn".', 'error');
        }
      });
    } catch (e) {
      showVnpostToast('Không thể tự mở trang cài đặt. Vào chrome://extensions → Auto Fill Order → "Tùy chọn".', 'error');
    }
  }

  async function handleSaveOrder() {
    if (!globalThis.parsedDataStore) {
      showVnpostToast("⚠️ Vui lòng tách đơn hàng trước khi lưu!", "error");
      return;
    }

    const { name, phone, address, orderCode, codAmount, collectFee } = globalThis.parsedDataStore;

    if (!name && !phone && !address && !orderCode) {
      showVnpostToast("⚠️ Không có thông tin để lưu!", "error");
      return;
    }

    const btnSave = getVnpostEl('btnSaveOrder');
    if (btnSave) {
      btnSave.disabled = true;
      btnSave.textContent = "⏳ Đang lưu...";
    }

    try {
      const platform = getCurrentPlatform();
      const orderToSave = {
        name: name || "",
        phone: phone || "",
        address: address && address !== "không tìm thấy" ? address : "",
        orderCode: orderCode || "",
        codAmount: codAmount || 0,
        collectFee: collectFee || false,
        platform: platform ? platform.id : "",
        extraNote: globalThis.parsedDataStore.extraNote || ""
      };

      if (globalThis.parsedDataStore.id) {
        orderToSave.id = globalThis.parsedDataStore.id;
      }

      // Kiểm tra đơn đã lưu ở ĐVVC khác chưa
      try {
        if (typeof OrderStorage !== 'undefined' && orderToSave.platform) {
          const allSaved = await OrderStorage.getOrders();
          const sameOnOther = allSaved.filter(o =>
            o.id !== orderToSave.id &&
            o.platform && o.platform !== orderToSave.platform &&
            (
              (orderToSave.orderCode && o.orderCode &&
                orderToSave.orderCode.toLowerCase() === o.orderCode.toLowerCase()) ||
              (orderToSave.name && orderToSave.phone &&
                orderToSave.name.toLowerCase() === (o.name || '').toLowerCase() &&
                orderToSave.phone.replace(/\D/g, '') === (o.phone || '').replace(/\D/g, ''))
            )
          );
          if (sameOnOther.length > 0) {
            const otherPlatforms = [...new Set(sameOnOther.map(o => o.platform))].join(', ');
            const wantContinue = typeof showPanelConfirmModal === 'function'
              ? await showPanelConfirmModal(
                  `Đơn này đã được tạo trên ${otherPlatforms.toUpperCase()} trước đó!\n\n` +
                  `Khách: ${orderToSave.name} - ${orderToSave.phone}\n` +
                  `Mã: ${orderToSave.orderCode || '—'}\n\n` +
                  `Bạn có muốn tạo tiếp đơn này trên ${orderToSave.platform.toUpperCase()} không?`
                )
              : confirm(
                  `⚠️ ĐƠN NÀY ĐÃ ĐƯỢC TẠO TRÊN ${otherPlatforms.toUpperCase()} TRƯỚC ĐÓ!\n\n` +
                  `Khách: ${orderToSave.name} - ${orderToSave.phone}\n` +
                  `Mã: ${orderToSave.orderCode || '—'}\n\n` +
                  `Bạn có muốn tạo tiếp đơn này trên ${orderToSave.platform.toUpperCase()} không?`
                );
            if (!wantContinue) {
              if (btnSave) { btnSave.disabled = false; btnSave.textContent = "💾 Lưu đơn"; }
              return;
            }
          }
        }
      } catch (_e) {}

      const savedOrder = await OrderStorage.saveOrder(orderToSave);
      globalThis.parsedDataStore.id = savedOrder.id;
      globalThis.parsedDataStore.createdAt = savedOrder.createdAt;
      
      showVnpostToast("💾 Đã lưu vào Đơn nháp thành công!", "success");
    } catch (err) {
      Logger.error("Lỗi khi lưu đơn hàng:", err);
      showVnpostToast("❌ Lỗi khi lưu: " + (err?.message || err), "error");
    } finally {
      if (btnSave) {
        btnSave.disabled = false;
        btnSave.textContent = "💾 Lưu đơn";
      }
    }
  }

  // ─── KIỂM TRA ĐƠN ĐIỀN LẠI PENDING ───
  function checkPendingRefill() {
    try {
      if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id || !chrome.storage || !chrome.storage.local) {
        return;
      }
      chrome.storage.local.get(['pendingRefillOrder'], (res) => {
        const lastErr = chrome.runtime.lastError;
        if (lastErr) return;
        if (!res || !res.pendingRefillOrder) return;
        const order = res.pendingRefillOrder;
        chrome.storage.local.remove('pendingRefillOrder');

        const tryFill = (attempt) => {
          const rawEl = getVnpostEl('rawOrderText');
          if (!rawEl) {
            if (attempt < 20) setTimeout(() => tryFill(attempt + 1), 300);
            return;
          }

          const lines = [];
          if (order.name)      lines.push(order.name);
          if (order.phone)     lines.push(order.phone);
          if (order.address)   lines.push(order.address);
          if (order.orderCode) lines.push('Mã đơn: ' + order.orderCode);
          if (order.codAmount) lines.push('COD: ' + order.codAmount);
          if (order.collectFee) lines.push('+ cước');
          rawEl.value = lines.join('\n');
          rawEl.dispatchEvent(new Event('input', { bubbles: true }));

          const platform = getCurrentPlatform();
          if (!platform) return;

          globalThis.parsedDataStore = {
              name:        order.name        || '',
              phone:       order.phone       || '',
              address:     order.address     || '',
              orderCode:   order.orderCode   || '',
              codAmount:   order.codAmount   || 0,
              collectFee:  order.collectFee  || false,
              platform:    order.platform    || '',
              extraPhones: [],
              extraNote:   order.extraNote   || ''
          };

          displayParsedData(globalThis.parsedDataStore);

          setTimeout(() => {
              triggerFillForm(platform.id);
          }, 500);

          showVnpostToast('✅ Đã tự động tải và điền đơn!', 'success');
        };
        tryFill(0);
      });
    } catch(e) { console.warn('checkPendingRefill error:', e); }
  }

  // Lắng nghe thay đổi storage từ trang Options khi bấm "Nhập đơn" hoặc khi trạng thái đăng nhập thay đổi
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local') {
        if (changes.pendingRefillOrder && changes.pendingRefillOrder.newValue) {
          const order = changes.pendingRefillOrder.newValue;
          const platform = getCurrentPlatform();
          if (platform && (!order.platform || order.platform === platform.id)) {
            checkPendingRefill();
          }
        }
        // Tự động làm mới trạng thái panel khi đăng nhập/đăng xuất hoặc thay đổi API key (không cần bấm F5)
        if (changes.vnpost_session || changes.groqApiKey) {
          checkUrlAndInject();
        }
      }
    });
  }

  setTimeout(checkPendingRefill, 600);

  // Chạy chẩn đoán DOM J&T sau 3 giây để thu thập dữ liệu phục vụ gỡ lỗi
  setTimeout(() => {
    try {
      const platform = getCurrentPlatform();
      if (platform && platform.id === 'jt') {
        const inputs = Array.from(document.querySelectorAll('input, textarea'));
        const diagnosticInfo = inputs.map(el => {
          let labelText = '';
          const id = el.id;
          if (id) {
            const lbl = document.querySelector(`label[for="${id}"]`);
            if (lbl) labelText = lbl.innerText;
          }
          if (!labelText) {
            const parentLabel = el.closest('label');
            if (parentLabel) labelText = parentLabel.innerText;
          }
          if (!labelText) {
            const formItem = el.closest('.el-form-item');
            const lbl = formItem ? formItem.querySelector('.el-form-item__label') : null;
            if (lbl) labelText = lbl.innerText;
          }
          return {
            tag: el.tagName,
            id: el.id || '',
            name: el.name || '',
            placeholder: el.placeholder || '',
            type: el.type || '',
            labelText: (labelText || '').trim().replace(/\s+/g, ' ')
          };
        });
        Logger.error("Chẩn đoán DOM J&T (Diagnostics)", JSON.stringify(diagnosticInfo, null, 2));
      }
    } catch (e) {
      console.warn("Diagnostics run error:", e);
    }
  }, 6000);

  // ─── LẮNG NGHE LỆNH TỪ TRANG OPTIONS (BULK PARSE) ───
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.type === 'deviceRevoked' || request.action === 'deviceRevoked') {
        // Thiết bị bị thu hồi: xoá panel + báo user ngay trên trang
        try {
          if (typeof window.__antigravityFloatingPanel !== 'undefined' && window.__antigravityFloatingPanel) {
            window.__antigravityFloatingPanel.remove();
            window.__antigravityFloatingPanel = null;
          }
        } catch (_) {}
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.remove(['vnpost_session', 'fbAuthTokens', 'fbDeviceId', 'fbDeviceName'], () => {
            try { showVnpostToast('⚠️ Thiết bị này đã bị thu hồi. Vui lòng đăng nhập lại bằng thiết bị được phép.', 'error'); } catch (_) {}
            setTimeout(() => { location.reload(); }, 1500);
          });
        }
        sendResponse({ ok: true });
        return true;
      }
      if (request.action === 'FILL_FROM_BULK' && request.order) {
        const platform = getCurrentPlatform();
        if (platform && platform.id === request.platform) {
          const order = request.order;
          globalThis.parsedDataStore = {
            id:          order.id || '',
            name:        order.name || '',
            phone:       order.phone || '',
            address:     order.address || '',
            orderCode:   order.orderCode || '',
            codAmount:   order.codAmount || 0,
            collectFee:  order.collectFee || false,
            platform:    order.platform || '',
            extraPhones: [],
            extraNote:   order.extraNote || ''
          };
          displayParsedData(globalThis.parsedDataStore);
          
          setTimeout(() => {
            triggerFillForm(platform.id);
          }, 200);

          showVnpostToast('✅ Đã tự động điền đơn từ Tách hàng loạt!', 'success');
          sendResponse({ success: true });
        }
      }
      return true;
    });
  }
  // ─── TỰ ĐỘNG BẮT MÃ VẬN ĐƠN TRÊN TRANG ORDER TABLE CỦA J&T EXPRESS ───
  if (window.location.hostname.includes('jtexpress.vn')) {
    const scanJtOrderTablePage = async () => {
      const rows = document.querySelectorAll('tr, .el-table__row');
      if (!rows || rows.length === 0) return;

      const submitted = await OrderStorage.getSubmittedOrders().catch(() => []);
      if (!submitted || submitted.length === 0) return;

      const unassigned = submitted.filter(s => !s.trackingCode || s.trackingCode === '—' || s.trackingCode === '');
      if (unassigned.length === 0) return;

      rows.forEach(row => {
        const text = row.textContent || row.innerText || '';
        const normalizedText = text.replace(/[\s\-\.,]/g, '').toLowerCase();

        const codeMatch = normalizedText.match(/(?:^|[^0-9])(8\d{11,14}|jt\d{10,14})(?:[^0-9]|$)/) || 
                          normalizedText.match(/(?:mãvậnđơn|tracking|waybill)(?:[:;]*)([a-z0-9]{8,22})/);
        if (!codeMatch) return;
        const waybillCode = codeMatch[1].toUpperCase();

        unassigned.forEach(sub => {
          const normPhone = sub.phone ? sub.phone.replace(/[\s\-\.,]/g, '') : null;
          const phoneMatch = normPhone && normalizedText.includes(normPhone);

          const normName = sub.name ? sub.name.replace(/[\s\-\.,]/g, '').toLowerCase() : null;
          const nameMatch = normName && normName.length > 2 && normalizedText.includes(normName);

          const normOrderCode = sub.orderCode && sub.orderCode !== '—' ? sub.orderCode.replace(/[\s\-\.,]/g, '').toLowerCase() : null;
          const orderCodeMatch = normOrderCode && normalizedText.includes(normOrderCode);

          if (phoneMatch || nameMatch || orderCodeMatch) {
            OrderStorage.updateSubmittedOrderTracking(sub.savedOrderId || sub.id, waybillCode).then(ok => {
              if (ok) showVnpostToast('📦 Đã tự động cập nhật mã vận đơn J&T: ' + waybillCode, 'success');
            });
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
              try {
                chrome.runtime.sendMessage({ action: 'jtWaybillFound', waybillCode, orderId: sub.savedOrderId || sub.id });
              } catch (_) {}
            }
          }
        });
      });
    };

    setInterval(scanJtOrderTablePage, 2500);
    onDOMReady(scanJtOrderTablePage);
  }

  // ─── TỰ ĐỘNG BẮT MÃ VẬN ĐƠN TRÊN TRANG ORDER MANAGER CỦA VNPOST ───
  if (window.location.hostname.includes('vnpost.vn')) {
    const scanVnpostOrderManagerPage = async () => {
      const rows = document.querySelectorAll('tr, .ant-table-row, .order-item, .item-order');
      if (!rows || rows.length === 0) return;

      const submitted = await OrderStorage.getSubmittedOrders().catch(() => []);
      if (!submitted || submitted.length === 0) return;

      const unassigned = submitted.filter(s => !s.trackingCode || s.trackingCode === '—' || s.trackingCode === '');
      if (unassigned.length === 0) return;

      rows.forEach(row => {
        const text = row.textContent || row.innerText || '';
        const normalizedText = text.replace(/[\s\-\.,]/g, '').toLowerCase();

        const codeMatch = text.match(/\b([A-Z]{2}\d{9}VN|C[A-Z0-9]{8,11}VN|MP[A-Z0-9]{7,11}VN|E[A-Z0-9]{8,11}VN|R[A-Z0-9]{8,11}VN)\b/i) ||
                          text.match(/(?:mã\s*vận\s*đơn|số\s*hiệu\s*bưu\s*gửi|mã\s*bưu\s*gửi|tracking)\s*[:;]?\s*([A-Z0-9]{8,22})/i);
        if (!codeMatch) return;
        const waybillCode = codeMatch[1].trim();

        unassigned.forEach(sub => {
          const normPhone = sub.phone ? sub.phone.replace(/[\s\-\.,]/g, '') : null;
          const phoneMatch = normPhone && normalizedText.includes(normPhone);

          const normName = sub.name ? sub.name.replace(/[\s\-\.,]/g, '').toLowerCase() : null;
          const nameMatch = normName && normName.length > 2 && normalizedText.includes(normName);

          const normOrderCode = sub.orderCode && sub.orderCode !== '—' ? sub.orderCode.replace(/[\s\-\.,]/g, '').toLowerCase() : null;
          const orderCodeMatch = normOrderCode && normalizedText.includes(normOrderCode);

          if (phoneMatch || nameMatch || orderCodeMatch) {
            const orderId = sub.savedOrderId || sub.id;
            // Trích xuất tên/SĐT từ row để cập nhật vào đơn nếu đang bị thiếu
            let rowName = sub.name || '';
            let rowPhone = sub.phone || '';
            if (!rowName || !rowPhone) {
              const phoneMatchInRow = text.match(/(?:\+84|84|0)(?:\s*[\.\-]?\s*\d){9,10}\b/);
              if (phoneMatchInRow) rowPhone = phoneMatchInRow[0].replace(/\D/g, '');
              // Tên thường đứng đầu row trước số phone
              if (!rowName) {
                const nameBeforePhone = text.match(/^([A-ZÀ-ỹ][a-zà-ỹ]*(?:\s+[A-ZÀ-ỹ][a-zà-ỹ]*){1,4})/);
                if (nameBeforePhone) rowName = nameBeforePhone[1].trim();
              }
            }
            OrderStorage.updateSubmittedOrderTracking(orderId, waybillCode).then(ok => {
              if (ok && (!sub.name || !sub.phone)) {
                OrderStorage.updateSubmittedOrderData(orderId, { name: rowName, phone: rowPhone }).catch(() => {});
              }
              if (ok) showVnpostToast('📦 Đã tự động cập nhật mã vận đơn VNPost: ' + waybillCode, 'success');
            });
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
              try {
                chrome.runtime.sendMessage({ action: 'vnpostWaybillFound', waybillCode, orderId });
              } catch (_) {}
            }
          }
        });
      });
    };

    setInterval(scanVnpostOrderManagerPage, 2500);
    onDOMReady(scanVnpostOrderManagerPage);
  }

})();
