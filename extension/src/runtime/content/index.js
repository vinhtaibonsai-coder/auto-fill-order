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
  let lastSuccessfulFillPlatform = '';
  let carrierRefillTimer = null;
  let _carrierSubmitInterceptorAttached = false;

  function onDOMReady(fn) {
    if (document.readyState === 'interactive' || document.readyState === 'complete') {
      fn();
    } else {
      document.addEventListener('DOMContentLoaded', fn);
    }
  }

  const observer = new MutationObserver(() => {
    // Chỉ kích hoạt lại nếu shadow host bị tháo gỡ khỏi DOM
    if (!document.getElementById('vnpost-autofill-shadow-host')) {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        checkUrlAndInject();
      }, 300);
    }
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

  function getVnpostEl(id) {
    const host = document.getElementById('vnpost-autofill-shadow-host');
    if (host && host.shadowRoot) {
      const el = host.shadowRoot.getElementById(id);
      if (el) return el;
    }
    return document.getElementById(id);
  }

  const carrierRuntime = globalThis.AutoFillCarrierRuntime || {};
  const PLATFORMS = carrierRuntime.PLATFORMS || {};
  const getCurrentPlatform = carrierRuntime.getCurrentPlatform || (() => null);
  const detectCarrierAccount = carrierRuntime.detectCarrierAccount || (() => '');

  // ─── CHỐNG TRÙNG LẶP SỰ KIỆN TẠO ĐƠN TOÀN CỤC (GLOBAL SUBMISSION GUARD) ───
  const _recentlyProcessedSubmissions = new Map();

  function isSubmissionRecentlyHandled(trackingCode, orderCode, phone, name) {
    const now = Date.now();
    for (const [k, time] of _recentlyProcessedSubmissions.entries()) {
      if (now - time > 30000) _recentlyProcessedSubmissions.delete(k);
    }

    const cleanTrack = String(trackingCode || '').trim().toLowerCase().replace(/\s+/g, '');
    const cleanOrder = String(orderCode || '').trim().toLowerCase().replace(/\s+/g, '');
    const cleanPhone = String(phone || '').replace(/\D/g, '');
    const cleanName = String(name || '').trim().toLowerCase();

    const keys = [];
    if (cleanTrack && cleanTrack !== '—' && cleanTrack !== '-') keys.push('tr_' + cleanTrack);
    if (cleanOrder && cleanOrder !== '—' && cleanOrder !== '-') keys.push('oc_' + cleanOrder);

    for (const k of keys) {
      if (_recentlyProcessedSubmissions.has(k) && (now - _recentlyProcessedSubmissions.get(k) < 15000)) {
        return true;
      }
    }
    return false;
  }

  function markSubmissionHandled(trackingCode, orderCode) {
    const now = Date.now();
    const cleanTrack = String(trackingCode || '').trim().toLowerCase().replace(/\s+/g, '');
    const cleanOrder = String(orderCode || '').trim().toLowerCase().replace(/\s+/g, '');
    if (cleanTrack && cleanTrack !== '—' && cleanTrack !== '-') {
      _recentlyProcessedSubmissions.set('tr_' + cleanTrack, now);
    }
    if (cleanOrder && cleanOrder !== '—' && cleanOrder !== '-') {
      _recentlyProcessedSubmissions.set('oc_' + cleanOrder, now);
    }
  }

  async function checkUrlAndInject() {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && !chrome.runtime.id) {
        stopObserver();
        return;
      }
    } catch (_) {
      stopObserver();
      return;
    }

    const platform = getCurrentPlatform();
    if (platform) {
      startObserver();
      try {
        initCarrierSubmitInterceptor(platform);
      } catch (err) {
        console.warn('[checkUrlAndInject] Error initializing submit interceptor:', err);
      }
      setTimeout(async function() {
        let isAuth = false;
        try {
          if (typeof AuthService !== 'undefined' && typeof AuthService.isAuthenticated === 'function') {
            isAuth = await AuthService.isAuthenticated();
          }
        } catch (err) {
          if (!String(err?.message || err).includes('Extension context invalidated')) {
            console.warn('[checkUrlAndInject] Error checking auth state:', err);
          }
          isAuth = false;
        }

        if (isAuth && typeof SupabaseCloud !== 'undefined' && typeof SupabaseCloud.checkDeviceRevoked === 'function') {
          try {
            const devCheck = await SupabaseCloud.checkDeviceRevoked();
            if (devCheck && devCheck.ok && devCheck.revoked) {
              console.warn('[checkUrlAndInject] Thiết bị này đã bị thu hồi từ Cloud. Đăng xuất.');
              if (typeof AuthSession !== 'undefined' && typeof AuthSession.clearSession === 'function') {
                await AuthSession.clearSession();
              }
              if (typeof window.__antigravityFloatingPanel !== 'undefined' && window.__antigravityFloatingPanel) {
                window.__antigravityFloatingPanel.remove();
                window.__antigravityFloatingPanel = null;
              }
              isAuth = false;
            }
          } catch (_) {}
        }

        if (!isAuth) {
          try {
            if (typeof createLoginRequiredPanel === 'function') {
              createLoginRequiredPanel(platform, openSettingsPage);
            }
          } catch (panelErr) {
            if (!String(panelErr?.message || panelErr).includes('Extension context invalidated')) {
              console.warn('[checkUrlAndInject] Error creating login panel:', panelErr);
            }
          }
          return;
        }

        // Check if device limit is exceeded
        let session = null;
        try {
          if (typeof AuthSession !== 'undefined' && typeof AuthSession.getSession === 'function') {
            session = await AuthSession.getSession();
          }
        } catch (_) {}

        if (session && session.device_limit_exceeded === true) {
          try {
            if (typeof createDeviceLimitExceededPanel === 'function') {
              createDeviceLimitExceededPanel(platform, session.max_devices || 5, openSettingsPage);
            }
          } catch (limitErr) {
            console.warn('[checkUrlAndInject] Error creating device limit panel:', limitErr);
          }
          return;
        }

        globalThis.afTriggerFillForm = triggerFillForm;
        globalThis.afHandleSaveOrder = handleSaveOrder;

        // Báo danh trực tuyến qua Supabase Realtime Presence (Phương án 1: 0s lag, zero DB write)
        if (session && !session.device_limit_exceeded) {
          const shopId = session.active_shop_id;
          const deviceId = session.device_id;
          if (shopId && deviceId && typeof RealtimeService !== 'undefined' && typeof RealtimeService.trackWorkstationPresence === 'function') {
            RealtimeService.trackWorkstationPresence(shopId, {
              device_id: deviceId,
              device_name: session.device_name || 'Máy trạm Kho (Chrome)',
              staff_name: session.staff_name || session.user?.full_name || 'Nhân viên kho',
              surface: 'CARRIER_TAB'
            }).catch(() => {});
          }
        }

        if (typeof AddressLearning !== 'undefined' && typeof AddressLearning.syncFromCloud === 'function') {
          AddressLearning.syncFromCloud().catch(() => {});
        }

        if (typeof createInputPanel === 'function') {
          try {
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
            if (globalThis.parsedDataStore && typeof displayParsedData === 'function') {
              displayParsedData(globalThis.parsedDataStore);
            }
          } catch (inputPanelErr) {
            console.warn('[checkUrlAndInject] Error creating input panel:', inputPanelErr);
          }
        } else {
          console.log('[checkUrlAndInject] React Panel is taking over. No vanilla UI injected.');
        }
      }, 50);
    } else {
      stopObserver();
      const host = document.getElementById('vnpost-autofill-shadow-host');
      if (host) host.remove();
      const reactRoot = document.getElementById('af-react-root');
      if (reactRoot) reactRoot.remove();
    }
  }

  globalThis.checkUrlAndInject = checkUrlAndInject;

  // ─── ĐĂNG KÝ SỰ KIỆN URL NAVIGATION & TUẦN HOÀN THEO DÕI URL (SPA POLL) ───
  if (typeof history !== 'undefined') {
    const _origPush = history.pushState;
    if (_origPush && !history.__af_push_wrapped) {
      history.pushState = function(...args) {
        const ret = _origPush.apply(this, args);
        setTimeout(checkUrlAndInject, 50);
        return ret;
      };
      history.__af_push_wrapped = true;
    }

    const _origReplace = history.replaceState;
    if (_origReplace && !history.__af_replace_wrapped) {
      history.replaceState = function(...args) {
        const ret = _origReplace.apply(this, args);
        setTimeout(checkUrlAndInject, 50);
        return ret;
      };
      history.__af_replace_wrapped = true;
    }
  }

  window.addEventListener('popstate', checkUrlAndInject);
  window.addEventListener('hashchange', checkUrlAndInject);

  let _lastPolledUrl = typeof window !== 'undefined' ? window.location.href : '';
  setInterval(() => {
    if (typeof window !== 'undefined' && window.location.href !== _lastPolledUrl) {
      _lastPolledUrl = window.location.href;
      checkUrlAndInject();
    }
  }, 400);

  // Lắng nghe sự kiện đăng nhập / đổi phiên từ Options hoặc Tab khác trong thời gian thực
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && (changes.vnpost_session || changes.currentUser || changes.activeShop || changes.activeShopId)) {
          setTimeout(checkUrlAndInject, 60);
          if (typeof AddressLearning !== 'undefined' && typeof AddressLearning.activateShop === 'function') {
            AddressLearning.activateShop().catch(() => {});
          }
          if (typeof AddressLearning !== 'undefined' && typeof AddressLearning.syncFromCloud === 'function') {
            AddressLearning.syncFromCloud().catch(() => {});
          }
        }
        if (area === 'local' && Object.keys(changes).some(key => key.startsWith('shop_address_aliases_cache:'))) {
          if (typeof AddressLearning !== 'undefined' && typeof AddressLearning.activateShop === 'function') {
            AddressLearning.activateShop().catch(() => {});
          }
        }
        if (area === 'local' && changes.global_address_aliases_cache) {
          globalThis.__GLOBAL_ADDRESS_ALIASES_CACHE__ = changes.global_address_aliases_cache.newValue || [];
        }
      });
    }

    // Khởi tạo cache toàn cục; cache riêng của Shop luôn được AddressLearning
    // kích hoạt theo active_shop_id để không rò dữ liệu giữa các Shop.
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['global_address_aliases_cache'], (res) => {
        if (res && res.global_address_aliases_cache) {
          globalThis.__GLOBAL_ADDRESS_ALIASES_CACHE__ = res.global_address_aliases_cache;
        }
      });
      if (typeof AddressLearning !== 'undefined' && typeof AddressLearning.activateShop === 'function') {
        AddressLearning.activateShop().catch(() => {});
      }
    }
  } catch (_) {}

  if (typeof AuthEvents !== 'undefined' && typeof AuthEvents.on === 'function') {
    AuthEvents.on('AUTH_STATE_CHANGED', () => {
      setTimeout(checkUrlAndInject, 60);
      if (typeof AddressLearning !== 'undefined' && typeof AddressLearning.syncFromCloud === 'function') {
        AddressLearning.syncFromCloud().catch(() => {});
      }
    });
  }

  window.addEventListener('storage', (e) => {
    if (e.key === 'vnpost_session' || e.key === 'currentUser' || e.key === 'activeShopId') {
      setTimeout(checkUrlAndInject, 60);
    }
  });

  // Tự động xóa dữ liệu trên panel khi bấm "Tạo đơn hàng mới" / "Tạo đơn mới" trên giao diện trang web hoặc modal kết quả
  document.addEventListener('click', (e) => {
    try {
      const target = e.target;
      if (!target) return;
      // Bỏ qua tuyệt đối các nút/link nằm trong menu điều hướng bên trái hoặc thanh header
      if (target.closest && target.closest('.ant-menu, .ant-layout-sider, aside, header, nav, .ant-pro-sider, .ant-pro-global-header, .el-menu')) {
        return;
      }
      const btn = target.closest ? target.closest('button, a, input[type="button"], input[type="submit"], [role="button"], .ant-btn, .el-button') : target;
      const text = ((btn ? (btn.textContent || btn.innerText || btn.value || '') : '') || (target.textContent || target.innerText || '')).trim().toLowerCase();
      
      const isCreateNewKeyword = 
        text === 'tạo đơn hàng mới' || 
        text === 'tạo đơn mới' || 
        text === 'tạo vận đơn mới' ||
        text === 'lên đơn mới' ||
        text === 'tạo đơn tiếp theo' ||
        text === 'tiếp tục tạo đơn' ||
        (text === 'làm mới' && (btn?.id === 'refresh_create_order' || btn?.closest?.('.ant-pro-footer-bar'))) ||
        /\b(?:tạo đơn hàng mới|tạo đơn mới|tạo vận đơn mới|tiếp tục tạo đơn)\b/i.test(text);

      if (isCreateNewKeyword) {
        // Kiểm tra xem có phải trong modal thông báo thành công hoặc nút làm mới form tạo đơn
        const isResultModal = target.closest && target.closest(
          '.ant-modal, .ant-modal-wrap, .ant-modal-content, .ant-modal-root, .ant-result, ' +
          '.el-dialog, .el-dialog__wrapper, .el-message-box, .el-result, ' +
          '.swal2-modal, .swal2-container, .swal2-popup, ' +
          '.modal, .modal-dialog, .modal-content, [role="dialog"], [aria-modal="true"]'
        );
        const isFooterRefresh = btn?.id === 'refresh_create_order' || btn?.closest?.('.ant-pro-footer-bar');
        
        if (isResultModal || isFooterRefresh || text.includes('tạo đơn hàng mới') || text.includes('tạo vận đơn mới')) {
          if (typeof handleClearOrder === 'function') {
            handleClearOrder(true);
          }
        }
      }
    } catch (_) {}
  }, true);

  // ─── PHÍM TẮT TOÀN CỤC SIÊU TỐC (PHASE 1: SHORTCUTS & AUTO-DETECT) ───
  document.addEventListener('keydown', async (e) => {
    try {
      // 1. Tổ hợp Ctrl + Shift + V hoặc Cmd + Shift + V: Dán và Bóc tách tức thì
      const isPasteShortcut = (e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'V' || e.key === 'v');
      if (isPasteShortcut) {
        e.preventDefault();
        let clipText = '';
        try {
          if (navigator.clipboard && navigator.clipboard.readText) {
            clipText = await navigator.clipboard.readText();
          }
        } catch (clipErr) {
          console.warn('[AutoFill Shortcut] Không thể đọc clipboard:', clipErr);
        }

        if (clipText && clipText.trim()) {
          // Bảo đảm panel đã hiển thị
          const host = document.getElementById('vnpost-autofill-shadow-host');
          if (!host) {
            checkUrlAndInject();
          }

          setTimeout(() => {
            const panel = getVnpostEl('vnpost-autofill-panel');
            if (panel) {
              // Mở panel nếu đang thu gọn
              if (panel.classList.contains('panel-docked') && panel.classList.contains('collapsed')) {
                const tab = getVnpostEl('vnpost-dock-toggle-tab');
                if (tab) tab.click();
              } else if (panel.classList.contains('minimized')) {
                const btnMin = getVnpostEl('vnpost-btn-minimize');
                if (btnMin) btnMin.click();
              }
            }

            const rawTextarea = getVnpostEl('rawOrderText');
            const parseBtn = getVnpostEl('btnParseOrder');

            if (rawTextarea) {
              rawTextarea.value = clipText.trim();
              rawTextarea.dispatchEvent(new Event('input', { bubbles: true }));
              rawTextarea.dispatchEvent(new Event('change', { bubbles: true }));
            }

            if (parseBtn) {
              parseBtn.click();
              if (typeof showVnpostToast === 'function') {
                showVnpostToast('⚡ Phím tắt: Đã dán và bóc tách đơn hàng siêu tốc!', 'success', 3000);
              }
            }
          }, 100);
        }
        return;
      }

      // 2. Phím Escape: Thu nhỏ / Ẩn nhanh Panel
      if (e.key === 'Escape') {
        const panel = getVnpostEl('vnpost-autofill-panel');
        if (panel) {
          if (panel.classList.contains('panel-docked') && !panel.classList.contains('collapsed')) {
            const btnMin = getVnpostEl('vnpost-btn-minimize');
            if (btnMin) btnMin.click();
          } else if (panel.classList.contains('panel-floating') && !panel.classList.contains('minimized')) {
            const btnMin = getVnpostEl('vnpost-btn-minimize');
            if (btnMin) btnMin.click();
          }
        }
      }
    } catch (shortcutErr) {
      console.warn('[AutoFill Shortcut] Error:', shortcutErr);
    }
  });

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

  // ─── CHUẨN HÓA VÀ GỢI Ý ĐỊA CHỈ ───
  function formatCleanAddress(addrResult, rawAddress = '') {
    if (!addrResult) return rawAddress || '';
    let normalized = addrResult.fullAddress || [addrResult.street, addrResult.ward, addrResult.district, addrResult.province].filter(Boolean).join(', ');
    if (typeof AddressSanitizer !== 'undefined' && typeof AddressSanitizer.deduplicate === 'function') {
      normalized = AddressSanitizer.deduplicate(normalized);
    }
    if (typeof AddressNormalizer !== 'undefined' && typeof AddressNormalizer.preserveComplete === 'function') {
      const preserved = AddressNormalizer.preserveComplete(rawAddress, normalized);
      return typeof AddressSanitizer !== 'undefined' && typeof AddressSanitizer.deduplicate === 'function'
        ? AddressSanitizer.deduplicate(preserved)
        : preserved;
    }
    return normalized || rawAddress;
  }

  function formatTwoLevelAddress(addrResult, rawAddress = '') {
    if (!addrResult) return rawAddress || '';
    const parts2 = [];
    if (addrResult.street) {
      parts2.push(addrResult.street);
    } else if (rawAddress) {
      // Lấy phần đường/chi tiết từ địa chỉ thô
      const rawParts = rawAddress.split(',').map(p => p.trim());
      const wardClean = (addrResult.ward || '').toLowerCase();
      const beforeWard = [];
      for (const p of rawParts) {
        if (wardClean && p.toLowerCase().includes(wardClean)) break;
        if (/^(quận|huyện|thị xã|tỉnh|thành phố)\b/i.test(p)) break;
        beforeWard.push(p);
      }
      if (beforeWard.length > 0) {
        parts2.push(beforeWard.join(', '));
      } else {
        const streetPart = rawParts.find(p => /\d/.test(p) && !/^(phường|xã|quận|huyện|tỉnh|thành phố)/i.test(p));
        if (streetPart) parts2.push(streetPart);
      }
    }
    if (addrResult.ward) {
      let w = addrResult.ward;
      if (!/^(phường|xã|thị trấn|đặc khu|p\.|x\.)\s/i.test(w)) {
        if (addrResult.province && /thành phố|tp\b/i.test(addrResult.province) && addrResult.district && /quận/i.test(addrResult.district)) {
          w = 'Phường ' + w;
        } else if (addrResult.district && /huyện/i.test(addrResult.district)) {
          if (rawAddress && /\b(?:thị trấn|thi tran|tt\.?)\s+/i.test(rawAddress)) {
            w = 'Thị trấn ' + w;
          } else if (rawAddress && /\b(?:xã|xa|x\.?)\s+/i.test(rawAddress)) {
            w = 'Xã ' + w;
          } else if (/^\d+$/.test(w)) {
            w = 'Xã ' + w;
          }
        }
      }
      parts2.push(w);
    } else if (addrResult.district && !/^(quận\s*\d+|quận|huyện|thị xã)/i.test(addrResult.district)) {
      parts2.push(addrResult.district);
    }
    if (addrResult.province) {
      parts2.push(addrResult.province);
    }
    let res = parts2.length > 0 ? parts2.join(', ') : (addrResult.fullAddress || rawAddress);
    if (typeof AddressSanitizer !== 'undefined' && typeof AddressSanitizer.deduplicate === 'function') {
      res = AddressSanitizer.deduplicate(res);
    }
    return res;
  }

  function detectAddressLevels(rawText = '', addrResult = null) {
    if (!addrResult) return 3;
    if (addrResult.isTwoLevel) return 2;
    if (!addrResult.ward && !addrResult.province) return 3;

    const stripAccents = (str) => {
      return String(str || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/đ/g, 'd');
    };

    const normRaw = stripAccents(rawText);

    // 1. Kiểm tra xem quận/huyện được nhận diện có xuất hiện trong địa chỉ thô không
    if (addrResult.district) {
      const dClean = addrResult.district.replace(/^(quận|huyện|thị xã|thành phố|tp\.?|tx\.?|q\.?|h\.?)\s+/i, '').trim();
      const normDistrictClean = stripAccents(dClean);
      const normDistrictFull = stripAccents(addrResult.district);

      // Quận dạng số: ví dụ Quận 3, Q.1
      if (/^\d+$/.test(normDistrictClean)) {
        const numPattern = new RegExp(`\\b(?:quan|q\\.?|huyen|h\\.?)\\s*0*${normDistrictClean}\\b`, 'i');
        if (numPattern.test(normRaw)) {
          return 3;
        }
      } else if (normDistrictClean.length >= 2) {
        // Nếu tên quận/huyện trùng với tên phường/xã (vd: Xã Thường Tín vs Huyện Thường Tín):
        // Chỉ coi là có quận nếu xuất hiện đầy đủ tiền tố "huyện/quận..." hoặc xuất hiện > 1 lần
        const normWard = stripAccents(addrResult.ward || '');
        const isSameNameAsWard = normWard.includes(normDistrictClean);
        if (isSameNameAsWard) {
          if (normRaw.includes(normDistrictFull)) {
            return 3;
          }
          const count = (normRaw.match(new RegExp('\\b' + normDistrictClean + '\\b', 'g')) || []).length;
          if (count >= 2) {
            return 3;
          }
        } else if (normRaw.includes(normDistrictClean) || normRaw.includes(normDistrictFull)) {
          return 3;
        }
      }
    }

    // 2. Kiểm tra xem trong địa chỉ thô có chứa bất kỳ từ khóa định danh quận/huyện nào không
    const districtKeywordsPattern = /\b(?:quận|huyện|thị\s*xã|tx\.|q\.\s*\d+|q\s*\d+)\b/i;
    if (districtKeywordsPattern.test(rawText)) {
      return 3;
    }

    // 3. Nếu có xã/phường + tỉnh/thành phố rõ ràng nhưng KHÔNG có quận/huyện trong văn bản gốc
    // => Khách hàng đưa địa chỉ theo định dạng 2 cấp mới!
    if (addrResult.ward && addrResult.province) {
      return 2;
    }

    return 3;
  }

  async function refreshAddressSuggestion(newAddress, phone = '') {
    if (!newAddress || newAddress === 'không tìm thấy') return newAddress;
    const referenceStatus = getVnpostEl('address-reference-status');
    const addressStatusBadge = getVnpostEl('address-status-badge');
    const suggestCleanEl = getVnpostEl('rev-suggest-clean');
    const suggest2LevelEl = getVnpostEl('rev-suggest-2level');
    const rawAddressEl = getVnpostEl('rev-raw-address');
    if (referenceStatus) {
      referenceStatus.textContent = 'Đang bóc tách...';
      referenceStatus.className = 'address-reference-status is-loading';
    }
    if (addressStatusBadge) addressStatusBadge.textContent = '⏳ Đang kiểm tra';
    if (suggestCleanEl) suggestCleanEl.textContent = 'Đang tạo gợi ý...';
    if (suggest2LevelEl) suggest2LevelEl.textContent = 'Đang quy đổi...';
    if (rawAddressEl) rawAddressEl.textContent = newAddress;
    try {
      let addrResult = null;
      try {
        if (typeof AddressEngine !== 'undefined' && typeof AddressEngine.process === 'function') {
          addrResult = await Promise.race([
            AddressEngine.process(newAddress, phone || globalThis.parsedDataStore?.phone || ''),
            new Promise((_, reject) => setTimeout(() => reject(new Error('AddressEngine timeout')), 3000))
          ]);
        }
      } catch (e) {
        console.warn('[AddressEdit] AddressEngine error:', e);
      }

      if (globalThis.parsedDataStore && addrResult) {
        globalThis.parsedDataStore.addressParts = {
          ward: addrResult.ward || '',
          district: addrResult.district || '',
          province: addrResult.province || ''
        };
      }

      const mergerNotice = getVnpostEl('ai-merger-notice');

      if (addrResult) {
        const cleanText = formatCleanAddress(addrResult, newAddress);
        const twoLevelText = formatTwoLevelAddress(addrResult, newAddress);
        const detectedLevel = detectAddressLevels(newAddress, addrResult);

        if (globalThis.parsedDataStore) {
          globalThis.parsedDataStore.addressLevel = detectedLevel;
          globalThis.parsedDataStore.twoLevelAddress = twoLevelText;
          globalThis.parsedDataStore.cleanAddress = cleanText;
        }

        if (suggestCleanEl) suggestCleanEl.textContent = cleanText;
        if (suggest2LevelEl) suggest2LevelEl.textContent = twoLevelText;
        if (referenceStatus) {
          referenceStatus.textContent = detectedLevel === 2 ? 'Chuẩn 2 cấp' : 'Đã bóc tách lại';
          referenceStatus.className = 'address-reference-status is-ready';
        }

        const btnClean = getVnpostEl('btn-switch-clean');
        const btn2Level = getVnpostEl('btn-switch-2level');
        if (btnClean && btn2Level) {
          btnClean.classList.toggle('active', detectedLevel !== 2);
          btn2Level.classList.toggle('active', detectedLevel === 2);
        }

        const refDisclosure = getVnpostEl('address-reference-disclosure') || document.getElementById('vnpost-autofill-shadow-host')?.shadowRoot?.querySelector?.('.address-reference-disclosure');
        if (refDisclosure) {
          const is2Level = detectedLevel === 2;
          refDisclosure.style.display = is2Level ? 'none' : '';
          if (!is2Level) {
            refDisclosure.open = true;
            const refTitle = refDisclosure.querySelector('.address-reference-title');
            if (refTitle) refTitle.textContent = '🎯 Gợi ý địa chỉ 2 cấp mới';
            if (referenceStatus) {
              referenceStatus.textContent = 'Bấm để áp dụng';
              referenceStatus.className = 'address-reference-status is-ready';
            }
          }
        }

        if (addressStatusBadge) {
          addressStatusBadge.textContent = detectedLevel === 2 ? '🎯 Địa chỉ 2 Cấp' : '✓ Đã tối ưu';
          addressStatusBadge.title = detectedLevel === 2
            ? 'Địa chỉ được nhận diện theo chuẩn 2 cấp (không chèn quận).'
            : 'Địa chỉ chuẩn hóa 3 cấp đầy đủ.';
        }

        const wardEl = getVnpostEl('rev-addr-ward');
        const distEl = getVnpostEl('rev-addr-district');
        const provEl = getVnpostEl('rev-addr-province');
        if (wardEl) wardEl.textContent = addrResult.ward || '---';
        if (distEl) distEl.textContent = addrResult.district || '---';
        if (provEl) provEl.textContent = addrResult.province || '---';

        if (mergerNotice) {
          if (addrResult.warning) {
            mergerNotice.textContent = '📢 ' + addrResult.warning;
            mergerNotice.style.display = 'block';
          } else {
            mergerNotice.style.display = 'none';
          }
        }

        const preferredText = (detectedLevel === 2 && twoLevelText && twoLevelText !== 'không tìm thấy')
          ? twoLevelText
          : cleanText;
        return preferredText;
      } else {
        if (suggestCleanEl) suggestCleanEl.textContent = newAddress;
        if (suggest2LevelEl) suggest2LevelEl.textContent = 'Chưa đủ dữ liệu để quy đổi 2 cấp';
        if (referenceStatus) {
          referenceStatus.textContent = 'Cần kiểm tra';
          referenceStatus.className = 'address-reference-status is-warning';
        }
        if (addressStatusBadge) addressStatusBadge.textContent = '⚠ Cần kiểm tra';
      }
    } catch (err) {
      console.warn('Lỗi khi bóc tách lại gợi ý địa chỉ:', err);
      if (suggestCleanEl) suggestCleanEl.textContent = newAddress;
      if (suggest2LevelEl) suggest2LevelEl.textContent = 'Không thể quy đổi tự động';
      if (referenceStatus) {
        referenceStatus.textContent = 'Cần kiểm tra';
        referenceStatus.className = 'address-reference-status is-warning';
      }
      if (addressStatusBadge) addressStatusBadge.textContent = '⚠ Cần kiểm tra';
    }
    return newAddress;
  }

  globalThis.refreshAddressSuggestion = refreshAddressSuggestion;

  const customerHubLookupCache = new Map();
  async function lookupCustomerAfterParse(parsed) {
    const phone = String(parsed?.phone || '').replace(/\D/g, '').replace(/^84(?=\d{9}$)/, '0');
    if (phone.length < 9) return null;
    let shopId = '';
    try { shopId = String(await AuthSession?.getActiveShop?.() || ''); } catch (_) {}
    const key = `${shopId}:${phone}`; const cached = customerHubLookupCache.get(key);
    if (cached && Date.now() - cached.at < 5 * 60 * 1000) return cached.value;
    try {
      const lookup = typeof globalThis.lookupPanelCustomerHistory === 'function'
        ? globalThis.lookupPanelCustomerHistory(phone) : Promise.resolve(null);
      const value = await Promise.race([lookup, new Promise(resolve => setTimeout(() => resolve(null), 1500))]);
      customerHubLookupCache.set(key, { at: Date.now(), value });
      return value;
    } catch (_) { return null; }
  }
  globalThis.lookupCustomerAfterParse = lookupCustomerAfterParse;

  // ─── QUẢN LÝ PHIÊN BÓC TÁCH & KHÓA ĐÓN KẾT QUẢ AI BẤT ĐỒNG BỘ ───
  // Ngăn chặn triệt để lỗi: Lên đơn xong hoặc xóa panel rồi AI mới trả về nạp lại dữ liệu cũ
  let currentParseEpoch = 0;
  let activeParseSessionId = null;
  let activeParseRawText = '';

  function beginParseSession(text) {
    currentParseEpoch += 1;
    activeParseSessionId = currentParseEpoch;
    activeParseRawText = (text || '').trim();
    return activeParseSessionId;
  }

  function isAiSessionActive(sessionId, currentText = null) {
    if (!sessionId || sessionId !== activeParseSessionId) return false;
    if (!globalThis.parsedDataStore) return false;
    const rawOrderText = getVnpostEl('rawOrderText');
    const rawVal = (rawOrderText ? rawOrderText.value.trim() : '') || globalThis.__AF_RAW_ORDER_INPUT__ || '';
    if (!rawVal) return false;
    if (activeParseRawText && rawVal !== activeParseRawText) return false;
    if (currentText && rawVal !== currentText.trim()) return false;
    return true;
  }

  function invalidateActiveAiSession(reason = 'UNKNOWN') {
    activeParseSessionId = null;
    activeParseRawText = '';
    const progContainer = getVnpostEl('gemini-progress-container');
    if (progContainer) progContainer.style.display = 'none';
    const btnAi = getVnpostEl('btnAiVerify');
    if (btnAi) {
      btnAi.disabled = false;
      btnAi.innerHTML = '🤖 <span>Thẩm định AI</span>';
    }
  }

  globalThis.beginParseSession = beginParseSession;
  globalThis.isAiSessionActive = isAiSessionActive;
  globalThis.invalidateActiveAiSession = invalidateActiveAiSession;

  if (typeof window !== 'undefined') {
    window.addEventListener('order-saved-db', () => invalidateActiveAiSession('EVENT_ORDER_SAVED'));
    window.addEventListener('autofill:clear-order', () => invalidateActiveAiSession('EVENT_CLEAR_ORDER'));
  }

  // ─── XỬ LÝ LỌC TRÙNG & PHÂN TÍCH HYBRID ───
  async function handleHybridParsing() {
    let isAuth = false;
    try {
      if (typeof AuthService !== 'undefined' && typeof AuthService.isAuthenticated === 'function') {
        isAuth = await AuthService.isAuthenticated();
      }
    } catch (_) { isAuth = false; }

    if (!isAuth) {
      showVnpostToast("⚠️ Bạn chưa đăng nhập hoặc phiên đã hết hạn. Vui lòng đăng nhập lại để tách đơn!", "error");
      checkUrlAndInject();
      return;
    }

    if (typeof loadCustomL2Mappings === 'function') await loadCustomL2Mappings();
    const rawTextEl = getVnpostEl('rawOrderText');
    const text = rawTextEl ? rawTextEl.value.trim() : '';
    if (!text) {
      showVnpostToast("⚠️ Vui lòng dán thông tin đơn hàng thô!", "error");
      return;
    }

    const sessionId = beginParseSession(text);

    lastSuccessfulFillPlatform = '';
    if (carrierRefillTimer) {
      clearTimeout(carrierRefillTimer);
      carrierRefillTimer = null;
    }

    // Lấy khóa xử lý AI để tránh chạy nhiều luồng cùng lúc (Lỗi số 1 và 7)
    const acquired = await Mutex.acquire('ai_parsing');
    if (!acquired) {
      showVnpostToast("⏳ AI đang bóc tách, vui lòng đợi...", "info");
      return;
    }

    const dupAlert = getVnpostEl('panel-duplicate-alert');
    if (dupAlert) dupAlert.style.display = 'none';

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
      const platId = typeof getCurrentPlatform === 'function' ? (getCurrentPlatform()?.id || getCurrentPlatform()) : 'vnpost';
      const carrierAcc = typeof detectCarrierAccount === 'function' ? detectCarrierAccount(platId) : '';
      const activeShopName = (typeof AuthSession !== 'undefined' && typeof AuthSession.getActiveShopName === 'function' ? AuthSession.getActiveShopName() : '') || '';
      const parseCtx = {
        carrierAccount: carrierAcc,
        activeShopName: activeShopName
      };
      let localResult = runLocalComputerParser(text, parseCtx);
      if (typeof AddressLearning !== 'undefined' && typeof AddressLearning.applyCorrections === 'function') {
        localResult = await AddressLearning.applyCorrections(localResult, text);
      }
      const rawExtractedAddress = localResult.address;

      // Lau sạch địa chỉ gốc tối thiểu: chỉ xóa sđt, ký tự thừa — KHÔNG phân tích cấp hành chính
      let cleanRaw = rawExtractedAddress;
      (localResult.extraPhones || []).forEach(p => { cleanRaw = cleanRaw.replace(p, ''); });
      if (localResult.phone) {
        cleanRaw = cleanRaw.replace(localResult.phone, '');
      }
      cleanRaw = cleanRaw.replace(/(?:\+84|84|0)(?:[\s\.\-]?\d){9,10}\b/g, '');
      cleanRaw = cleanRaw.replace(/sđt|sdt|đt|dt|tel|phone|lh|liên hệ\s*\d{0,11}\s*/gi, '');
      cleanRaw = cleanRaw.replace(/^(?:gửi\s+)?(?:ship\s+)?(?:cho\s+mình|cho\s+em|cho\s+tôi|cho\s+khách)?\s*(?:đến|về|tới)?\s*(?:địa\s*chỉ)?\s*[:\s\-•]*/gi, '');
      cleanRaw = cleanRaw.replace(/địa chỉ\s*:?\s*/gi, '');
      cleanRaw = cleanRaw.replace(/\s*(?:e\s+nhé|em\s+nhé|e\s+nha|em\s+nha|nhé\s+e|nhé\s+em|nha\s+e|nha\s+em|nhé|nha(?!\s+(?:trang|xá|mần|bè|nam|bắc|tây|đông|trung))|nghe|ơi|nhé\s+bạn|nhé\s+shop|nhé\s+ad|nhé\s+anh|nhé\s+chị|ạ|dạ)(?!\p{L}).*$/giu, '');
      cleanRaw = cleanRaw.replace(/\s*\(\s*(?:địa\s*chỉ\s*)?(?:sau\s*)?(?:sáp\s*nhập|xác\s*nhập|cũ|mới|giao\s*giờ\s*hành\s*chính)[^)]*\)\s*$/gi, '');
      cleanRaw = cleanRaw.replace(/[\s\.\,\-\–•]*(?:sđt|sdt|đt|dt|tel|phone|lh|liên\s*hệ|zalo|hotline)[:\s\-•]*$/gi, '');

      // Xóa tên khách hàng nếu bị dính ở đầu địa chỉ
      if (localResult.name) {
        const baseName = localResult.name.split(/[\(\[]/)[0].trim();
        if (baseName && baseName.length >= 3 && cleanRaw.toLowerCase().startsWith(baseName.toLowerCase())) {
          cleanRaw = cleanRaw.substring(baseName.length).trim();
        }
      }

      cleanRaw = cleanRaw.replace(/^[-\s\.\,\/]+|[-\s\.\,\/]+$/g, '').trim();
      cleanRaw = cleanRaw.replace(/,+/g, ',').trim();
      cleanRaw = cleanRaw.replace(/\s+/g, ' ').trim();
      cleanRaw = cleanRaw.replace(/\s*,\s*/g, ', ');
      cleanRaw = cleanRaw.replace(/(^|\s)([a-zAÀ-ỹ])/g, (_, sp, c) => sp + c.toUpperCase());
      cleanRaw = cleanRaw.replace(/(^|,\s*)([a-zAÀ-ỹ])/g, (_, sp, c) => sp + c.toUpperCase());
      localResult.address = cleanRaw || rawExtractedAddress;

      // Nạp cấu hình mặc định (khối lượng, tên hàng hóa mặc định từ Cài đặt cửa hàng / Đơn hàng)
      try {
        let defWeightVnpost, defWeightJt, defGoodsName, defPkgWeight;
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          const res = await new Promise(r => {
            chrome.storage.local.get([
              'order_default_settings', 
              'default_weight_vnpost', 
              'default_weight_jt', 
              'default_goods_name',
              'default_package_weight',
              'activeShop'
            ], result => {
              if (chrome.runtime?.lastError) return r({});
              r(result || {});
            });
          });
          const ord = res?.order_default_settings || {};
          defWeightVnpost = ord.defaultWeight !== undefined ? Number(ord.defaultWeight) : res?.default_weight_vnpost;
          defWeightJt = ord.defaultWeightKg !== undefined ? Number(ord.defaultWeightKg) : res?.default_weight_jt;
          defGoodsName = ord.defaultItemName || ord.defaultGoodsName || res?.default_goods_name;
          defPkgWeight = res?.default_package_weight || (typeof res?.activeShop === 'object' ? res.activeShop?.default_package_weight : null);
        }
        if (!defWeightVnpost || !defWeightJt || !defGoodsName || !defPkgWeight) {
          try {
            const raw = localStorage.getItem('order_default_settings');
            if (raw) {
              const obj = JSON.parse(raw);
              if (!defWeightVnpost && obj.defaultWeight) defWeightVnpost = Number(obj.defaultWeight);
              if (!defWeightJt && obj.defaultWeightKg) defWeightJt = Number(obj.defaultWeightKg);
              if (!defGoodsName && (obj.defaultItemName || obj.defaultGoodsName)) defGoodsName = obj.defaultItemName || obj.defaultGoodsName;
            }
            if (!defWeightVnpost) defWeightVnpost = localStorage.getItem('default_weight_vnpost');
            if (!defWeightJt) defWeightJt = localStorage.getItem('default_weight_jt');
            if (!defGoodsName) defGoodsName = localStorage.getItem('default_goods_name');
            if (!defPkgWeight) defPkgWeight = localStorage.getItem('default_package_weight');
          } catch (_) {}
        }
        // Kiểm tra OrderStorage.getActiveShop()
        if ((!defPkgWeight || !defWeightVnpost) && typeof OrderStorage !== 'undefined' && typeof OrderStorage.getActiveShop === 'function') {
          try {
            const shop = await OrderStorage.getActiveShop().catch(() => null);
            if (shop?.default_package_weight) defPkgWeight = shop.default_package_weight;
          } catch (_) {}
        }

        // Ưu tiên khối lượng từ Cài đặt cửa hàng (default_package_weight - gram) nếu chưa có cấu hình riêng
        if ((!defWeightVnpost || Number(defWeightVnpost) <= 0) && defPkgWeight && Number(defPkgWeight) > 0) {
          const numPkg = Number(defPkgWeight);
          defWeightVnpost = numPkg >= 10 ? numPkg : numPkg * 1000;
        }
        if ((!defWeightJt || Number(defWeightJt) <= 0) && defPkgWeight && Number(defPkgWeight) > 0) {
          const numPkg = Number(defPkgWeight);
          defWeightJt = numPkg >= 10 ? (numPkg / 1000) : numPkg;
        }

        const isJtPlatform = (typeof getCurrentPlatform === 'function' ? getCurrentPlatform()?.id : null) === 'jt' ||
                             (typeof window !== 'undefined' && window.location.hostname.includes('jtexpress.vn'));

        if (defWeightVnpost && Number(defWeightVnpost) > 0) {
          localResult.defaultWeightVnpost = Number(defWeightVnpost);
        }
        if (defWeightJt && Number(defWeightJt) > 0) {
          localResult.defaultWeightJt = Number(defWeightJt);
        }

        if (isJtPlatform) {
          const jtWeight = (localResult.defaultWeightJt && Number(localResult.defaultWeightJt) > 0)
            ? Number(localResult.defaultWeightJt)
            : (localResult.defaultWeightVnpost ? (localResult.defaultWeightVnpost >= 10 ? localResult.defaultWeightVnpost / 1000 : localResult.defaultWeightVnpost) : 0.2);
          localResult.weight = jtWeight;
          localResult.weightGrams = Math.round(jtWeight * 1000);
        } else {
          const vnpWeight = (localResult.defaultWeightVnpost && Number(localResult.defaultWeightVnpost) > 0)
            ? Number(localResult.defaultWeightVnpost)
            : 200;
          localResult.weight = vnpWeight;
          localResult.weightGrams = vnpWeight;
        }
        if (defGoodsName && typeof defGoodsName === 'string' && defGoodsName.trim()) localResult.defaultGoodsName = defGoodsName.trim();
      } catch (_) {}

      // Hiển thị địa chỉ gốc (chưa chuẩn hóa) trong rev-address
      if (platId === 'vnpost' && localResult.orderCode) {
        localResult.orderCode = formatVNPostOrderCode(localResult.orderCode);
      }
      globalThis.parsedDataStore = localResult;
      
      try {
        window.dispatchEvent(new CustomEvent('autofill:parsed', { detail: globalThis.parsedDataStore }));
      } catch (e) {}
      lookupCustomerAfterParse(globalThis.parsedDataStore).catch(() => {});
      try {
        const logger = typeof recordOrderEvent === 'function' ? recordOrderEvent : (globalThis.recordOrderEvent || null);
        if (logger && globalThis.parsedDataStore) {
          logger({
            orderId: globalThis.parsedDataStore.orderCode || globalThis.parsedDataStore.id || ('parse_' + Date.now()),
            orderCode: globalThis.parsedDataStore.orderCode || '',
            eventType: 'ORDER_PARSED',
            actorType: 'USER',
            source: 'extension_parser',
            afterState: globalThis.parsedDataStore,
            metadata: { hasAi: Boolean(globalThis.parsedDataStore.aiAudit) }
          }).catch(() => {});
        }
      } catch (_) {}

      if (progContainer && progBar && txtStatus && txtPercent) {
        progContainer.style.display = 'block';
        progBar.style.width = '30%';
        txtStatus.textContent = "⚡ Đang kiểm tra cơ sở dữ liệu địa giới...";
        txtPercent.textContent = "30%";
        const setParseStep = (id, complete, label) => {
          const el = getVnpostEl(id);
          if (el) {
            el.textContent = `${complete ? '✓' : '✕'} ${label}`;
            el.className = complete ? 'is-complete' : 'is-missing';
          }
        };
        setParseStep('parse-step-customer', Boolean(localResult.name), 'Nhận diện khách hàng');
        setParseStep('parse-step-phone', Boolean(localResult.phone), 'Nhận diện SĐT');
        setParseStep('parse-step-cod', Number(localResult.codAmount || 0) >= 0, 'Nhận diện COD');
        const addressStep = getVnpostEl('parse-step-address');
        if (addressStep) { addressStep.textContent = '● Đang chuẩn hóa địa chỉ'; addressStep.className = 'is-active'; }
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
      try {
        globalThis.__AF_INITIAL_PARSED_DATA__ = JSON.parse(JSON.stringify(localResult));
        globalThis.__AF_RAW_ORDER_INPUT__ = text;
      } catch (_) {}

      // Cập nhật gợi ý địa chỉ sạch & quy đổi 2 cấp và tự động chọn địa chỉ sạch tối ưu
      if (addrResult) {
        const suggestCleanEl = getVnpostEl('rev-suggest-clean');
        const suggest2LevelEl = getVnpostEl('rev-suggest-2level');
        const referenceStatus = getVnpostEl('address-reference-status');
        const mergerNotice = getVnpostEl('ai-merger-notice');

        const cleanText = formatCleanAddress(addrResult, localResult.address);
        const twoLevelText = formatTwoLevelAddress(addrResult, localResult.address);
        const detectedLevel = detectAddressLevels(text, addrResult);

        localResult.addressLevel = detectedLevel;
        localResult.twoLevelAddress = twoLevelText;
        localResult.cleanAddress = cleanText;

        if (suggestCleanEl) suggestCleanEl.textContent = cleanText;
        if (suggest2LevelEl) suggest2LevelEl.textContent = twoLevelText;

        const preferredAddress = (detectedLevel === 2 && twoLevelText && twoLevelText !== 'không tìm thấy')
          ? twoLevelText
          : cleanText;

        // Tự động gán địa chỉ chuẩn hóa phù hợp vào ô nhận hàng chính (không chèn quận nếu là 2 cấp)
        if (preferredAddress && preferredAddress !== 'không tìm thấy') {
          localResult.address = preferredAddress;
        }

        const btnClean = getVnpostEl('btn-switch-clean');
        const btn2Level = getVnpostEl('btn-switch-2level');
        const addressStatusBadge = getVnpostEl('address-status-badge');
        if (btnClean && btn2Level) {
          btnClean.classList.toggle('active', detectedLevel !== 2);
          btn2Level.classList.toggle('active', detectedLevel === 2);
        }

        const refDisclosure = getVnpostEl('address-reference-disclosure') || document.getElementById('vnpost-autofill-shadow-host')?.shadowRoot?.querySelector?.('.address-reference-disclosure');
        if (refDisclosure) {
          const is2Level = detectedLevel === 2;
          refDisclosure.style.display = is2Level ? 'none' : '';
          if (!is2Level) {
            refDisclosure.open = true;
            const refTitle = refDisclosure.querySelector('.address-reference-title');
            if (refTitle) refTitle.textContent = '🎯 Gợi ý địa chỉ 2 cấp mới';
            if (referenceStatus) {
              referenceStatus.textContent = 'Bấm để áp dụng';
              referenceStatus.className = 'address-reference-status is-ready';
            }
          }
        }

        if (addressStatusBadge) {
          addressStatusBadge.textContent = detectedLevel === 2 ? '🎯 Địa chỉ 2 Cấp' : '✓ Đã tối ưu';
          addressStatusBadge.title = detectedLevel === 2
            ? 'Địa chỉ được nhận diện theo chuẩn 2 cấp (không chèn quận). Bấm gợi ý để đổi 3 cấp nếu muốn.'
            : 'Địa chỉ chuẩn hóa 3 cấp đầy đủ.';
        }

        const wardEl = getVnpostEl('rev-addr-ward');
        const distEl = getVnpostEl('rev-addr-district');
        const provEl = getVnpostEl('rev-addr-province');
        if (wardEl) wardEl.textContent = addrResult.ward || '---';
        if (distEl) distEl.textContent = addrResult.district || '---';
        if (provEl) provEl.textContent = addrResult.province || '---';

        if (mergerNotice) {
          if (addrResult.warning) {
            mergerNotice.textContent = '📢 ' + addrResult.warning;
            mergerNotice.style.display = 'block';
          } else {
            mergerNotice.style.display = 'none';
          }
        }

        // Cập nhật lại giao diện với địa chỉ sạch và tính toán Readiness Status
        displayParsedData(localResult);
      }

      // Bóc tách cục bộ hiển thị ngay lập tức (0ms) để không bị trễ
      if (progBar && txtStatus && txtPercent) {
        progBar.style.width = '100%';
        txtStatus.textContent = "⚡ Bóc tách cục bộ hoàn tất!";
        txtPercent.textContent = "100%";
      }
      const finalAddressStep = getVnpostEl('parse-step-address');
      if (finalAddressStep) { finalAddressStep.textContent = '✓ Đã chuẩn hóa địa chỉ'; finalAddressStep.className = 'is-complete'; }
      displayParsedData(localResult);
      if (btnParse) {
        btnParse.disabled = false;
        // Xóa inline style để trả về CSS gradient gốc (không dùng .style.backgroundColor)
        btnParse.style.removeProperty('background-color');
        btnParse.style.removeProperty('background');
        btnParse.innerHTML = (typeof PANEL_ICONS !== 'undefined' && PANEL_ICONS.parse ? PANEL_ICONS.parse + ' ' : '🤖 ') + "Tách Đơn Tự Động";
      }
      if (typeof globalThis.collapseSourceOrderCard === 'function') {
        globalThis.collapseSourceOrderCard(globalThis.parsedDataStore || localResult);
      }

      // Lưu lịch sử tách đơn
      try {
        if (typeof globalThis.SplitHistory !== 'undefined') {
          const platform = getCurrentPlatform();
          const res = await globalThis.SplitHistory.add(text, globalThis.parsedDataStore, platform);
          if (res && res.isDuplicate) {
            showVnpostToast('ℹ️ Đơn này đã được tách trước đó — cập nhật thời gian.', 'info');
          }
        }
      } catch (e) {
        console.warn('Lỗi ghi lịch sử:', e);
      }

      // ─── BƯỚC 3: AI THẨM ĐỊNH & ĐỐI SOÁT TỰ ĐỘNG (BACKGROUND AI VERIFICATION) ───
      // Cục bộ bóc tách siêu tốc (0.01s) hiển thị ngay lập tức để người dùng không phải chờ.
      // Tiếp theo, AI chạy ngầm để đối soát (SĐT, tên, COD triệu/k, mã đơn, địa chỉ) và đánh giá độ tin cậy.
      try {
        const cleanPhone = (localResult.phone || '').replace(/\D/g, '');
        const hasValidPhone = cleanPhone.length === 10 || cleanPhone.length === 11;
        const hasName = Boolean(localResult.name && localResult.name.trim().length >= 2 && localResult.name !== 'không tìm thấy');
        const hasAddress = Boolean(localResult.address && localResult.address.trim().length >= 8);
        const hasWard = Boolean(localResult.ward || (localResult.addressBreakdown && localResult.addressBreakdown.ward));

        // Chỉ tự động gọi AI khi độ tin cậy thấp hoặc thiếu thông tin cốt lõi (SĐT, Tên, Địa chỉ chi tiết)
        const needsAiAssistance = !hasValidPhone || !hasName || !hasAddress || !hasWard;

        if (!needsAiAssistance) {
          // Bóc tách cục bộ đạt độ tin cậy cao -> Hiển thị tức thì, không làm nghẽn quota AI
          localResult.confidence = {
            score: 92,
            level: 'offline',
            reasons: ['Bóc tách cục bộ chính xác cao (SĐT, Tên, Địa chỉ đầy đủ)']
          };
          if (typeof displayParsedData === 'function') {
            displayParsedData(localResult);
          }
          if (typeof globalThis.updateAiConfidenceBadge === 'function') {
            globalThis.updateAiConfidenceBadge('offline');
          }
        } else {
          localResult.confidence = {
            score: (hasValidPhone && hasAddress) ? 75 : 55,
            level: 'verifying',
            reasons: ['Đang chạy thẩm định AI đối soát thông tin...']
          };
          if (typeof displayParsedData === 'function') {
            displayParsedData(localResult);
          }
          if (typeof globalThis.updateAiConfidenceBadge === 'function') {
            globalThis.updateAiConfidenceBadge('verifying');
          }

          let session = (typeof AuthSession !== 'undefined' && typeof AuthSession.getSession === 'function')
            ? await AuthSession.getSession().catch(() => null)
            : null;
          if (!session || (!session.access_token && !session.shop_access_key)) {
            const stored = await new Promise(r => chrome.storage.local.get(['vnpost_session', 'shop_access_key'], r));
            if (stored?.vnpost_session) session = stored.vnpost_session;
            else if (stored?.shop_access_key) session = { shop_access_key: stored.shop_access_key };
          }
          if (session && (session.access_token || session.shop_access_key)) {
            verifyWithAI(text, localResult, session, false, sessionId).catch(err => {
              console.warn('[AI Verify Background] Error:', err);
            });
          }
        }
      } catch (verifyErr) {
        console.warn('[AI Verify Trigger] Error:', verifyErr);
      }
    } catch (err) {
      Logger.error("Lỗi phân tích đơn:", err);
      showVnpostToast("❌ Có lỗi xảy ra trong quá trình phân tích.", "error");
    } finally {
      Mutex.release('ai_parsing');
    }
  }

  // ─── HÀM THẨM ĐỊNH & ĐỐI SOÁT DỮ LIỆU ĐƠN BẰNG AI GATEWAY ───
  async function verifyWithAI(rawText, currentData, session, isManual = false, sessionId = null) {
    const boundSessionId = sessionId || activeParseSessionId;
    if (!rawText || !rawText.trim()) {
      if (isManual && typeof showVnpostToast === 'function') {
        showVnpostToast('⚠️ Vui lòng dán nội dung đơn hàng trước khi thẩm định AI!', 'warning');
      }
      return false;
    }

    const progContainer = getVnpostEl('gemini-progress-container');
    const progBar = getVnpostEl('gemini-progress-bar');
    const txtStatus = getVnpostEl('ai-status');
    const txtPercent = getVnpostEl('ai-percent');
    const btnAi = getVnpostEl('btnAiVerify');

    if (btnAi) {
      btnAi.disabled = true;
      btnAi.innerHTML = '⏳ <span style="font-size:11.5px">Đang thẩm định...</span>';
    }

    if (progContainer && progBar && txtStatus && txtPercent) {
      progContainer.style.display = 'block';
      progBar.style.width = '65%';
      txtStatus.textContent = '🤖 AI đang thẩm định & đối soát dữ liệu...';
      txtPercent.textContent = '65%';
    }

    let token = session?.access_token || session?.shop_access_key;
    let shopKey = session?.shop_access_key;
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let shopId = (session?.active_shop_id && UUID_REGEX.test(String(session.active_shop_id).trim())) ? String(session.active_shop_id).trim() : null;
    let deviceId = session?.device_id;
    let staffName = session?.staff_name || session?.user?.full_name || 'Nhân viên kho';

    if (!shopKey && typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      try {
        const stored = await new Promise(r => chrome.storage.local.get(['shop_access_key', 'vnpost_session'], r));
        shopKey = stored?.shop_access_key || stored?.vnpost_session?.shop_access_key || null;
        if (!token && shopKey) token = shopKey;
        if (!shopId && stored?.vnpost_session?.active_shop_id && UUID_REGEX.test(String(stored.vnpost_session.active_shop_id).trim())) {
          shopId = String(stored.vnpost_session.active_shop_id).trim();
        }
      } catch (_) {}
    }

    return new Promise((resolve) => {
      if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
        if (btnAi) {
          btnAi.disabled = false;
          btnAi.innerHTML = '🤖 <span>Thẩm định AI</span>';
        }
        resolve(false);
        return;
      }

      chrome.runtime.sendMessage({
        action: 'runGroq',
        text: rawText,
        token,
        shopKey,
        shopId,
        deviceId,
        staffName
      }, async (response) => {
        try {
          if (btnAi) {
            btnAi.disabled = false;
            btnAi.innerHTML = '🤖 <span>Thẩm định AI</span>';
          }

          if (chrome.runtime.lastError || !response || !response.ok) {
            const rawErr = chrome.runtime.lastError?.message || response?.error || 'Lỗi kết nối AI';
            console.warn('[AI Verify] Lỗi thẩm định AI:', rawErr);

            // Xử lý thông báo thân thiện, tuyệt đối không quăng raw JSON hoặc mã lỗi kỹ thuật cho người dùng
            let friendlyNotice = 'Không thể kết nối AI, đã giữ kết quả cục bộ để bạn kiểm tra.';
            const isCapacityIssue = /503|429|unavailable|capacity|overload|rate limit|quota|busy/i.test(String(rawErr));
            const isChannelClosed = /message channel closed|listener indicated/i.test(String(rawErr));
            if (isCapacityIssue) {
              friendlyNotice = 'AI đang quá tải, hệ thống đã dùng kết quả local để bạn kiểm tra.';
            } else if (isChannelClosed) {
              friendlyNotice = 'Kết nối nền tạm gián đoạn, hệ thống đã dùng kết quả local để bạn kiểm tra.';
            }

            if (isManual && typeof showVnpostToast === 'function') {
              showVnpostToast(`⚠️ ${friendlyNotice}`, 'warning', 4000);
            }
            if (progContainer) {
              if (progBar) progBar.style.width = '100%';
              if (txtStatus) txtStatus.textContent = (isCapacityIssue || isChannelClosed) ? '⚠️ Gián đoạn AI - Đã dùng kết quả local' : '✅ Đã lưu kết quả cục bộ';
              if (txtPercent) txtPercent.textContent = '100%';
              setTimeout(() => { if (progContainer) progContainer.style.display = 'none'; }, 2000);
            }
            if (isAiSessionActive(boundSessionId, rawText)) {
              currentData.confidence = {
                score: (currentData.phone && currentData.address) ? 80 : 50,
                level: 'offline',
                reasons: [isCapacityIssue ? 'AI đang quá tải, giữ kết quả cục bộ' : (isChannelClosed ? 'Kết nối nền gián đoạn, giữ kết quả cục bộ' : 'Dữ liệu bóc tách cục bộ (chưa qua thẩm định AI)')]
              };
              if (typeof displayParsedData === 'function') {
                displayParsedData(currentData);
              }
              if (typeof globalThis.updateAiConfidenceBadge === 'function') {
                globalThis.updateAiConfidenceBadge('offline');
              }
            }
            resolve(false);
            return;
          }

          const aiResult = response.result || {};
          const corrections = [];

          // 1. Đối soát Số điện thoại
          const aiPhone = (aiResult.phone || '').replace(/\D/g, '');
          const currentPhone = (currentData.phone || '').replace(/\D/g, '');
          if (aiPhone && (aiPhone.length === 10 || aiPhone.length === 11) && aiPhone !== currentPhone) {
            currentData.phone = aiPhone;
            corrections.push(`SĐT: ${aiPhone}`);
          }

          // 2. Đối soát Tên khách hàng
          const aiName = (aiResult.name || '').trim();
          const currentName = (currentData.name || '').trim();
          if (aiName && (!currentName || currentName === 'không tìm thấy' || currentName.length < 2 || (currentPhone && currentName.includes(currentPhone)))) {
            currentData.name = aiName;
            corrections.push(`Tên: ${aiName}`);
          }

          // 3. Đối soát Mã đơn hàng
          let aiOrderCode = (aiResult.orderCode || '').trim();
          const platId = typeof getCurrentPlatform === 'function' ? (getCurrentPlatform()?.id || getCurrentPlatform()) : 'vnpost';
          if (platId === 'vnpost' && aiOrderCode) {
            aiOrderCode = formatVNPostOrderCode(aiOrderCode);
          }
          if (aiOrderCode && (!currentData.orderCode || currentData.orderCode === '—' || currentData.orderCode === 'Lũa Thuỷ Sinh' || currentData.orderCode === 'LuaThuySinh')) {
            currentData.orderCode = aiOrderCode;
            corrections.push(`Mã đơn: ${aiOrderCode}`);
          }
          if (platId === 'vnpost' && currentData.orderCode) {
            currentData.orderCode = formatVNPostOrderCode(currentData.orderCode);
          }

          // 4. Đối soát Tiền thu hộ COD
          if (aiResult.codAmount !== undefined && aiResult.codAmount !== null) {
            const aiCod = Number(aiResult.codAmount) || 0;
            const currentCod = Number(currentData.codAmount) || 0;
            if (aiCod !== currentCod && (currentCod === 0 || Math.abs(aiCod - currentCod) >= 1000)) {
              currentData.codAmount = aiCod;
              corrections.push(`COD: ${aiCod.toLocaleString('vi-VN')}đ`);
            }
          }

          // 5. Đối soát Ghi chú / Thu cước
          if (aiResult.extraNote && !currentData.extraNote) {
            currentData.extraNote = aiResult.extraNote;
          }
          if (aiResult.collectFee !== undefined) {
            currentData.collectFee = Boolean(aiResult.collectFee);
          }

          // 6. Đối soát Địa chỉ
          const rawAiAddress = (aiResult.correctAddress || aiResult.address || '').trim();
          if (rawAiAddress && (!currentData.address || currentData.address === 'không tìm thấy' || corrections.length > 0)) {
            if (typeof AddressEngine !== 'undefined' && typeof AddressEngine.process === 'function') {
              try {
                const engResult = await AddressEngine.process(rawAiAddress, currentData.phone || '');
                if (engResult && engResult.fullAddress) {
                  currentData.address = engResult.fullAddress;
                  currentData.addressParts = {
                    ward: engResult.ward || '',
                    district: engResult.district || '',
                    province: engResult.province || ''
                  };
                } else {
                  currentData.address = rawAiAddress;
                }
              } catch (_) {
                currentData.address = rawAiAddress;
              }
            } else {
              currentData.address = rawAiAddress;
            }
            if (rawAiAddress !== currentData.address) {
              corrections.push('Địa chỉ');
            }
          }

          // Đánh giá độ tin cậy AI thông minh
          const hasReq = currentData.phone && currentData.address;
          const score = !hasReq ? 75 : (corrections.length > 0 ? 95 : 98);
          const level = !hasReq ? 'medium' : (corrections.length > 0 ? 'optimized' : 'high');

          // GUARD TUYỆT ĐỐI: Không nạp lại kết quả nếu đơn hàng đã được lên hoặc panel đã bị xóa
          if (!isAiSessionActive(boundSessionId, rawText)) {
            console.log('[AI Verify] Bỏ qua nạp kết quả AI vào giao diện vì đơn đã hoàn tất hoặc panel đã làm mới.');
            resolve(false);
            return;
          }

          currentData.confidence = {
            score,
            level,
            reasons: corrections.length > 0
              ? [`AI đã đối soát & tối ưu: ${corrections.join(', ')}`]
              : ['Mọi trường thông tin đã được AI đối soát khớp chuẩn xác']
          };
          currentData.aiVerified = true;

          globalThis.parsedDataStore = currentData;
          if (typeof displayParsedData === 'function') {
            displayParsedData(currentData);
          }
          if (typeof globalThis.updateAiConfidenceBadge === 'function') {
            globalThis.updateAiConfidenceBadge(level === 'medium' ? 'review_needed' : 'verified', {
              score,
              optimized: corrections.length > 0,
              corrections
            });
          }

          if (progBar && txtStatus && txtPercent) {
            progBar.style.width = '100%';
            txtStatus.textContent = corrections.length > 0 ? '✨ AI đã tối ưu dữ liệu đơn!' : '🛡️ AI đã thẩm định: Khớp chuẩn dữ liệu!';
            txtPercent.textContent = '100%';
            setTimeout(() => { if (progContainer) progContainer.style.display = 'none'; }, 2500);
          }

          if (typeof showVnpostToast === 'function') {
            if (corrections.length > 0) {
              showVnpostToast(`✨ AI đã đối soát & tối ưu: ${corrections.join(', ')} (Độ tin cậy 95%)`, 'success', 4000);
            } else {
              showVnpostToast('🛡️ AI đã thẩm định: Dữ liệu bóc tách khớp chuẩn (Độ tin cậy 98%)!', 'success', 3000);
            }
          }

          resolve(true);
        } catch (err) {
          console.warn('[AI Verify] Exception:', err);
          resolve(false);
        }
      });
    });
  }

  globalThis.handleAiVerifyManual = async function() {
    const rawTextEl = getVnpostEl('rawOrderText');
    const text = (rawTextEl ? rawTextEl.value.trim() : '') || globalThis.__AF_RAW_ORDER_INPUT__ || '';
    if (!text) {
      if (typeof showVnpostToast === 'function') {
        showVnpostToast('⚠️ Vui lòng dán thông tin đơn hàng trước khi bấm Thẩm định AI!', 'warning');
      }
      return;
    }

    let session = null;
    try {
      if (typeof AuthSession !== 'undefined' && typeof AuthSession.getSession === 'function') {
        session = await AuthSession.getSession().catch(() => null);
      }
    } catch (_) {}

    if (!session || (!session.access_token && !session.shop_access_key)) {
      if (typeof showVnpostToast === 'function') {
        showVnpostToast('⚠️ Bạn cần đăng nhập tiện ích để sử dụng tính năng Thẩm định AI!', 'error');
      }
      return;
    }

    const currentData = globalThis.parsedDataStore || {
      name: '',
      phone: '',
      address: '',
      orderCode: '',
      codAmount: 0,
      collectFee: false,
      extraNote: ''
    };

    const sessionId = beginParseSession(text);
    await verifyWithAI(text, currentData, session, true, sessionId);
  };

  // ─── THEO DÕI MÃ VẬN ĐƠN SAU KHI LÊN ĐƠN ───
  function startTrackingCodeMonitor(savedOrderId, targetPlatform, onCodeFound, targetOrderInfo) {
    let found = false;
    let jtPollTimer1 = null;
    let jtPollTimer2 = null;
    let jtPollTimer3 = null;
    let urlCheckTimer = null;
    let trackTimer = null;
    let fetchRestore = null;

    function extractCode(text) {
      if (!text) return null;
      const patterns = [
        /(?:số\s*hiệu\s*bưu\s*gửi|mã\s*bưu\s*gửi|mã\s*vận\s*đơn|mã\s*vận\s*chuyển|mã\s*vận\s*đơn\s*là|mã\s*bưu\s*gửi\s*là)\s*[:;]?\s*([A-Z0-9]{8,22})/i,
        /(?:mã\s*đơn(?:\s*hàng)?|order\s*id|tracking\s*(?:code|no|number)?)\s*[:;]?\s*([A-Z0-9]{8,22})/i,
        /\b(C\d{9,13}VN)\b/i,
        /\b(MP\d{8,12}VN)\b/i,
        /\b(E[A-Z]\d{8,12}VN)\b/i,
        /\b([A-Z]{2}\d{9,13}VN)\b/i,
        /\b(8\d{11,14})\b/i,
        /\b(jt\d{10,14})\b/i
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
      if (typeof handleClearOrder === 'function') {
        handleClearOrder(true);
      }
      if (trackMo) trackMo.disconnect();
      if (fetchRestore && typeof fetchRestore === 'function') fetchRestore();
      if (trackTimer) clearTimeout(trackTimer);
      if (urlCheckTimer) clearInterval(urlCheckTimer);
      if (jtPollTimer1) clearTimeout(jtPollTimer1);
      if (jtPollTimer2) clearTimeout(jtPollTimer2);
      if (jtPollTimer3) clearTimeout(jtPollTimer3);
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

    // Fetch API interception — bắt response từ API tạo đơn của VNPost / J&T
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
              const d = body.data || body.result || body;
              const firstItem = (Array.isArray(d) && d.length > 0) ? d[0] : ((Array.isArray(body.data) && body.data.length > 0) ? body.data[0] : null);
              const code = body.billCode || body.waybillNo || body.trackingCode || body.maVanDon || body.shipmentNumber || body.itemCode || body.barcode || body.orderId || body.orderCode || body.code || body.id ||
                           d?.billCode || d?.waybillNo || d?.trackingCode || d?.maVanDon || d?.shipmentNumber || d?.itemCode || d?.orderCode ||
                           firstItem?.billCode || firstItem?.waybillNo || firstItem?.trackingCode || firstItem?.itemCode || null;
              if (code && /^[A-Z0-9]{8,22}$/i.test(String(code))) tryNotify(String(code));
            }).catch(() => {});
          }
          return response;
        } catch (e) { return origFetch(input, init); }
      };
      fetchRestore = () => { window.fetch = origFetch; };
    }

    // Cho J&T Express: Gọi API danh sách đơn hàng ngầm có đối chiếu danh tính đơn
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
                  const targetOrderCode = String(targetOrderInfo?.orderCode || targetOrderInfo?.order_code || '').trim().toLowerCase();
                  const targetPhone = String(targetOrderInfo?.phone || '').replace(/\D/g, '');
                  const targetName = String(targetOrderInfo?.name || '').replace(/[\s\-\.,]/g, '').toLowerCase();

                  for (const item of list) {
                    const code = item.billCode || item.waybillNo || item.trackingNo || item.txLogisticId || item.code || null;
                    if (code && /^[A-Z0-9]{8,22}$/i.test(String(code))) {
                      const itemOrderCode = String(item.txLogisticId || item.shopOrderCode || item.customerOrderCode || item.orderCode || item.orderNo || '').trim().toLowerCase();
                      const itemPhone = String(item.receiverPhone || item.receiverMobile || item.recipientPhone || item.phone || '').replace(/\D/g, '');
                      const itemName = String(item.receiverName || item.recipientName || item.name || '').replace(/[\s\-\.,]/g, '').toLowerCase();

                      const codeMatched = targetOrderCode && itemOrderCode && (itemOrderCode === targetOrderCode || itemOrderCode.includes(targetOrderCode) || targetOrderCode.includes(itemOrderCode));
                      const phoneMatched = targetPhone && itemPhone && (itemPhone.includes(targetPhone) || targetPhone.includes(itemPhone));
                      const nameMatched = targetName && targetName.length > 2 && itemName && (itemName.includes(targetName) || targetName.includes(itemName));

                      // Xác thực danh tính: ưu tiên mã đơn, nếu không có mã đơn thì cần khớp cả SĐT + tên
                      const isConfidentMatch = targetOrderCode ? codeMatched : (targetPhone ? (phoneMatched && (!targetName || nameMatched)) : true);

                      if (isConfidentMatch) {
                        tryNotify(String(code));
                        break;
                      }
                    }
                  }
                }
              }
            }
          }
        } catch (_) {}
      };

      jtPollTimer1 = setTimeout(pollJtApi, 800);
      jtPollTimer2 = setTimeout(pollJtApi, 2500);
      jtPollTimer3 = setTimeout(pollJtApi, 5000);
    }

    // URL change detection (SPA redirect)
    urlCheckTimer = setInterval(() => {
      if (found) { clearInterval(urlCheckTimer); return; }
      const text = document.body.innerText || '';
      const code = extractCode(text);
      if (code) tryNotify(code);
    }, 1000);

    trackTimer = setTimeout(() => {
      if (!found) {
        trackMo.disconnect();
        if (fetchRestore) fetchRestore();
        if (urlCheckTimer) clearInterval(urlCheckTimer);
        if (jtPollTimer1) clearTimeout(jtPollTimer1);
        if (jtPollTimer2) clearTimeout(jtPollTimer2);
        if (jtPollTimer3) clearTimeout(jtPollTimer3);
      }
    }, 25000);
  }

  // ─── CẬP NHẬT LẠI TIỀN COD VÀO FORM BƯU ĐIỆN NẾU NGƯỜI DÙNG SỬA TRONG BẢNG XÉT DUYỆT ───
  async function updateCodInputInDOM(platform, newCod) {
    try {
      const platId = typeof platform === 'object' && platform ? platform.id : (platform || (typeof getCurrentPlatform === 'function' ? (getCurrentPlatform()?.id || getCurrentPlatform()) : 'vnpost'));
      const cleanVal = Number(newCod || 0);

      if (platId === 'vnpost') {
        let codEl = document.querySelector('input[name="PROP0018"]');
        if (!codEl) {
          const codRows = Array.from(document.querySelectorAll('tr.g-tr, tr, [role="row"], .ant-table-row'));
          const targetRow = codRows.find(row => {
            const t = (row.innerText || row.textContent || '').toLowerCase();
            return (t.includes('phát hàng thu tiền') || t.includes('thu tiền cod') || t.includes('tiền thu hộ') || t.includes('thu hộ (cod)')) && !t.includes('hủy');
          });
          if (targetRow) {
            codEl = targetRow.querySelector('input[name="PROP0018"], input.ant-input-number-input, input[role="spinbutton"], input:not([type="checkbox"]):not([type="hidden"])');
          }
        }
        if (!codEl) {
          const codLabels = Array.from(document.querySelectorAll('label, .ant-form-item-label, span, b, div')).filter(l => {
            const txt = (l.innerText || l.textContent || '').trim().toLowerCase();
            return (txt.includes('phát hàng thu tiền') || txt.includes('thu tiền cod') || txt.includes('tiền thu hộ') || txt.includes('thu hộ (cod)')) && !txt.includes('hủy');
          });
          for (const lbl of codLabels) {
            const container = lbl.closest('.ant-form-item, tr, .ant-row, .form-item') || lbl.parentElement;
            if (container) {
              const inp = container.querySelector('input[name="PROP0018"], input.ant-input-number-input, input[role="spinbutton"], input:not([type="checkbox"])');
              if (inp) { codEl = inp; break; }
            }
          }
        }
        if (codEl) {
          codEl.focus();
          if (typeof setInputValue === 'function') setInputValue(codEl, String(cleanVal));
          codEl.dispatchEvent(new Event('input', { bubbles: true }));
          codEl.dispatchEvent(new Event('change', { bubbles: true }));
          codEl.blur();
        }
      } else if (platId === 'jt') {
        let codInp = document.querySelector('input[placeholder*="Nhập số tiền" i]') || document.querySelector('#money');
        if (!codInp) {
          document.querySelectorAll('.el-form-item').forEach(item => {
            if ((item.innerText || '').includes('Tiền thu hộ')) {
              const el = item.querySelector('input');
              if (el) codInp = el;
            }
          });
        }
        if (codInp) {
          codInp.focus();
          if (typeof setInputValue === 'function') setInputValue(codInp, String(cleanVal));
          codInp.dispatchEvent(new Event('input', { bubbles: true }));
          codInp.dispatchEvent(new Event('change', { bubbles: true }));
          codInp.blur();
        }
      } else {
        const codEl = document.querySelector('input[name*="cod" i], input[placeholder*="thu hộ" i], input[placeholder*="cod" i]');
        if (codEl) {
          codEl.focus();
          if (typeof setInputValue === 'function') setInputValue(codEl, String(cleanVal));
          codEl.dispatchEvent(new Event('input', { bubbles: true }));
          codEl.dispatchEvent(new Event('change', { bubbles: true }));
          codEl.blur();
        }
      }
    } catch (err) {
      console.warn('[updateCodInputInDOM] error:', err);
    }
  }

  // ─── NHẬN DIỆN NÚT TẠO ĐƠN CHÍNH THỨC CỦA HÃNG VẬN CHUYỂN ───
  function isVnpostSubmitButton(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.closest && el.closest('#vnpost-autofill-shadow-host')) return false;

    // Loại trừ tuyệt đối các nút/link nằm trong menu, sidebar, header, breadcrumb
    if (el.closest && el.closest('.ant-menu, .ant-layout-sider, aside, header, nav, .ant-pro-sider, .ant-pro-global-header, .ant-breadcrumb, .ant-pro-top-nav-header')) {
      return false;
    }

    // 1. Nút có id="create_order" hoặc là con của #create_order (nút tạo đơn chính thức VNPost)
    const byId = el.id === 'create_order' ? el : (el.closest ? el.closest('#create_order') : null);
    if (byId) return true;

    // 2. Nằm trong thanh footer bar tạo đơn: .ant-pro-footer-bar
    const footerBar = el.closest ? el.closest('.ant-pro-footer-bar') : null;
    if (footerBar) {
      const btn = el.tagName === 'BUTTON' || el.tagName === 'A' || el.getAttribute('role') === 'button'
        ? el
        : (el.closest ? el.closest('button, a, [role="button"], .ant-btn') : null);
      if (btn) {
        // Loại trừ các nút chức năng khác trong footer bar: Tính cước, Lưu nháp, Làm mới
        if (btn.id === 'calculate_fee' || btn.id === 'save_draft_order' || btn.id === 'refresh_create_order') {
          return false;
        }
        if (btn.id === 'create_order' || btn.getAttribute('title') === 'Tạo đơn') {
          return true;
        }
        const text = (btn.innerText || btn.textContent || '').trim().toLowerCase();
        if (text === 'tạo đơn' || text.startsWith('tạo đơn')) {
          return true;
        }
      }
    }

    return false;
  }

  function isCarrierSubmitButton(el, platform) {
    if (!el || el.nodeType !== 1) return false;
    if (el.closest && el.closest('#vnpost-autofill-shadow-host')) return false;

    const platId = typeof platform === 'object' && platform ? platform.id : (platform || (typeof getCurrentPlatform === 'function' ? (getCurrentPlatform()?.id || getCurrentPlatform()) : 'vnpost'));

    if (platId === 'vnpost') {
      return isVnpostSubmitButton(el);
    }

    // Đối với J&T hoặc hãng khác: loại trừ menu / sidebar / header
    if (el.closest && el.closest('.el-menu, aside, header, nav, .sidebar, .header')) {
      return false;
    }

    const btn = el.tagName === 'BUTTON' || el.tagName === 'A' || el.tagName === 'INPUT' || el.getAttribute('role') === 'button'
      ? el
      : (el.closest ? el.closest('button, a, input[type="submit"], input[type="button"], [role="button"], .el-button, .ant-btn') : null);
    if (!btn) return false;

    const text = (btn.textContent || btn.value || '').trim().toLowerCase();
    if (!text || text.length > 50) return false;
    if (/^(?:hủy|hủy bỏ|quay lại|tra cứu|tìm kiếm|đơn mẫu|hướng dẫn)$/i.test(text)) return false;

    // Đối với riêng J&T Express: Nút submit gửi đơn thực sự là "Đăng đơn hàng" hoặc "Đăng đơn"
    // Tuyệt đối không nhận các nút điều hướng / thao tác phụ như "Tạo đơn", "Tạo đơn nhanh", "Tạo đơn mẫu"
    if (platId === 'jt') {
      if (text.includes('tạo đơn')) return false;
      return text.includes('đăng đơn') || text.includes('lưu và đăng');
    }

    const keywords = ['tạo đơn', 'đăng đơn', 'lưu đơn', 'gửi đơn', 'tạo bưu gửi', 'lưu bưu gửi', 'tạo mới', 'xác nhận', 'hoàn tất', 'lên đơn', 'tạo vận đơn', 'lưu vận đơn'];
    return keywords.some(kw => text.includes(kw));
  }

  globalThis.isVnpostSubmitButton = isVnpostSubmitButton;
  globalThis.isCarrierSubmitButton = isCarrierSubmitButton;

  // ─── CHỐT CHẶN XÉT DUYỆT TOÀN CỤC KHI LÊN ĐƠN (KỂ CẢ LÊN ĐƠN BẰNG TAY) ───
  function initCarrierSubmitInterceptor(platform) {
    const platId = typeof platform === 'object' && platform ? platform.id : (platform || (typeof getCurrentPlatform === 'function' ? (getCurrentPlatform()?.id || getCurrentPlatform()) : 'vnpost'));
    const submitKeywords = [
      'tạo đơn',
      'đăng đơn',
      'lưu đơn',
      'gửi đơn',
      'tạo bưu gửi',
      'lưu bưu gửi',
      'tạo mới',
      'xác nhận',
      'hoàn tất',
      'tạo',
      'lên đơn',
      'lưu và tạo mới',
      'lưu & tạo mới',
      'tạo vận đơn',
      'lưu vận đơn',
      'tạo & in',
      'tạo và in',
      'gửi bưu gửi',
      'phát hàng'
    ];

    function checkCarrierFormValidation(activePlatform) {
      const errorElements = [];
      const errorTexts = [];

      try {
        // 1. Kiểm tra các thông báo lỗi màu đỏ trên Ant Design (VNPost)
        const antErrorItems = Array.from(document.querySelectorAll('.ant-form-item-explain-error, .ant-form-item-has-error .ant-form-item-explain, [role="alert"].ant-form-item-explain-error'))
          .filter(el => !el.closest('#vnpost-autofill-shadow-host') && el.offsetParent !== null);

        for (const el of antErrorItems) {
          const txt = (el.innerText || el.textContent || '').trim();
          if (txt && !errorTexts.includes(txt)) {
            errorTexts.push(txt);
            const parentItem = el.closest('.ant-form-item') || el;
            if (!errorElements.includes(parentItem)) errorElements.push(parentItem);
          }
        }

        // 2. Kiểm tra lỗi trên Element UI (J&T)
        const elUiErrors = Array.from(document.querySelectorAll('.el-form-item.is-error .el-form-item__error'))
          .filter(el => !el.closest('#vnpost-autofill-shadow-host') && el.offsetParent !== null);

        for (const el of elUiErrors) {
          const txt = (el.innerText || el.textContent || '').trim();
          if (txt && !errorTexts.includes(txt)) {
            errorTexts.push(txt);
            const parentItem = el.closest('.el-form-item') || el;
            if (!errorElements.includes(parentItem)) errorElements.push(parentItem);
          }
        }

        // 3. Kiểm tra riêng trên VNPost: Nếu đang ở chế độ "Địa chỉ mới", bắt buộc phải chọn Tỉnh/TP và Phường/Xã
        if (activePlatform === 'vnpost') {
          const isNewAddressMode = Array.from(document.querySelectorAll('.ant-radio-wrapper, label, span, input[type="radio"]')).some(el => {
            const txt = (el.innerText || el.textContent || '').trim();
            if (/^địa chỉ mới$/i.test(txt) || txt.includes('Địa chỉ mới')) {
              const rInp = el.querySelector('input[type="radio"]') || (el.tagName === 'INPUT' ? el : null);
              return rInp ? rInp.checked : el.classList.contains('ant-radio-wrapper-checked');
            }
            return false;
          });

          if (isNewAddressMode) {
            const addressSelects = Array.from(document.querySelectorAll('.ant-select')).filter(sel => {
              if (sel.closest('#vnpost-autofill-shadow-host') || sel.offsetParent === null) return false;
              const ph = (sel.querySelector('.ant-select-selection-placeholder')?.innerText || '').toLowerCase();
              const lbl = (sel.closest('.ant-form-item')?.querySelector('label')?.innerText || '').toLowerCase();
              return ph.includes('tỉnh') || ph.includes('thành phố') || ph.includes('phường') || ph.includes('xã') ||
                     lbl.includes('tỉnh') || lbl.includes('thành phố') || lbl.includes('phường') || lbl.includes('xã');
            });

            for (const sel of addressSelects) {
              const hasSelectedValue = sel.querySelector('.ant-select-selection-item');
              if (!hasSelectedValue) {
                const ph = (sel.querySelector('.ant-select-selection-placeholder')?.innerText || sel.closest('.ant-form-item')?.querySelector('label')?.innerText || 'Địa chỉ hành chính').trim();
                const msg = `${ph} là bắt buộc`;
                if (!errorTexts.includes(msg)) {
                  errorTexts.push(msg);
                  const parentItem = sel.closest('.ant-form-item') || sel;
                  if (!errorElements.includes(parentItem)) errorElements.push(parentItem);
                }
              }
            }
          }

          // Kiểm tra xem trường số điện thoại người nhận có bị rỗng không
          const phoneEl = document.querySelector('#form-create-order_receiverPhone, input#receiverPhone');
          if (phoneEl && !phoneEl.value.trim()) {
            const msg = 'Số điện thoại người nhận là bắt buộc';
            if (!errorTexts.includes(msg)) {
              errorTexts.push(msg);
              const parentItem = phoneEl.closest('.ant-form-item') || phoneEl;
              if (!errorElements.includes(parentItem)) errorElements.push(parentItem);
            }
          }
        }
      } catch (err) {
        console.warn('[checkCarrierFormValidation] Lỗi kiểm tra form:', err);
      }

      if (errorElements.length > 0) {
        return {
          isValid: false,
          errors: errorTexts,
          firstErrorElement: errorElements[0]
        };
      }

      return { isValid: true, errors: [], firstErrorElement: null };
    }
    globalThis.checkCarrierFormValidation = checkCarrierFormValidation;

    async function handleCarrierSubmitClick(e, explicitTarget = null) {
      let btn = explicitTarget;
      if (!btn && e) {
        if (e.target && typeof e.target.closest === 'function') {
          btn = e.target.closest('button, a, input[type="submit"], input[type="button"], [role="button"], .el-button, .ant-btn');
        }
        if (!btn && e.currentTarget && e.currentTarget.nodeType === 1 && e.currentTarget !== document) {
          btn = e.currentTarget;
        }
        if (!btn && e.target && e.target.nodeType === 1) {
          btn = e.target;
        }
      }
      if (!btn) return;

      // Nếu nút bấm đã được duyệt qua modal trong lượt này thì cho đi tiếp
      if (btn.dataset && btn.dataset.afApproved === 'true') {
        return;
      }

      // Ngăn chặn lệnh submit tức thì của hãng để mở Bảng Xét Duyệt
      if (e) {
        if (typeof e.preventDefault === 'function') e.preventDefault();
        if (typeof e.stopPropagation === 'function') e.stopPropagation();
        if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
      }

      const activePlatform = platId || (typeof getCurrentPlatform === 'function' ? (getCurrentPlatform()?.id || getCurrentPlatform()) : 'vnpost');

      // ─── KIỂM TRA LỖI BIỂU MẪU BƯU ĐIỆN TRƯỚC KHI MỞ BẢNG XÉT DUYỆT ───
      const validation = checkCarrierFormValidation(activePlatform);
      if (!validation.isValid) {
        const firstErr = validation.firstErrorElement;
        if (firstErr) {
          try {
            firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
            firstErr.style.transition = 'all 0.3s ease';
            firstErr.style.outline = '2px dashed #ff4d4f';
            firstErr.style.boxShadow = '0 0 8px rgba(255, 77, 79, 0.6)';
            setTimeout(() => {
              if (firstErr) {
                firstErr.style.outline = '';
                firstErr.style.boxShadow = '';
              }
            }, 3500);
            const focusTarget = firstErr.querySelector('input, .ant-select-selector, textarea') || firstErr;
            if (typeof focusTarget.focus === 'function') focusTarget.focus();
          } catch (_) {}
        }
        const errSummary = validation.errors.slice(0, 2).join(' & ');
        if (typeof showVnpostToast === 'function') {
          showVnpostToast(`⚠️ ${activePlatform === 'vnpost' ? 'VNPost' : 'Bưu điện'} báo lỗi: ${errSummary}. Vui lòng hoàn tất trước khi duyệt đơn!`, 'error', 5000);
        }
        return; // Dừng lại, KHÔNG mở modal xét duyệt
      }

      const scrapedData = scrapeOrderFromDOM(activePlatform) || {};


      // Lấy thông tin từ Panel để đối chiếu trực tiếp với Form Bưu Điện
      const panelData = (globalThis.parsedDataStore && (globalThis.parsedDataStore.phone || globalThis.parsedDataStore.name))
        ? { ...globalThis.parsedDataStore }
        : (globalThis.__AF_LAST_FILLED_ORDER__ ? { ...globalThis.__AF_LAST_FILLED_ORDER__ } : {});

      // Tự động ưu tiên đồng bộ COD từ Panel sang Form nếu trên form bưu điện đang là 0đ
      if (Number(scrapedData.codAmount || 0) === 0 && Number(panelData.codAmount || 0) > 0) {
        scrapedData.codAmount = Number(panelData.codAmount);
      }

      // Lấy đơn thô từ parsedDataStore hoặc từ ô nhập trên panel nếu có
      const rawInputEl = getVnpostEl('order-raw-input');
      const rawText = (globalThis.parsedDataStore && globalThis.parsedDataStore.rawText)
        || (rawInputEl ? rawInputEl.value : '')
        || '';

      if (typeof globalThis.showOrderApprovalModal === 'function') {
        try {
          const approval = await globalThis.showOrderApprovalModal({
            carrierData: scrapedData,
            panelData: panelData,
            orderData: scrapedData,
            rawText: rawText,
            platform: activePlatform,
            onUpdateCOD: async (newCod) => {
              await updateCodInputInDOM(activePlatform, newCod);
              if (globalThis.parsedDataStore) {
                globalThis.parsedDataStore.codAmount = newCod;
                if (newCod === 0) globalThis.parsedDataStore.codExplicitZero = true;
                if (typeof displayParsedData === 'function') displayParsedData(globalThis.parsedDataStore);
              }
            }
          });

          if (approval && approval.confirmed) {
            // Xác định số tiền COD được duyệt cuối cùng
            const approvedCod = (approval.orderData && approval.orderData.codAmount !== undefined)
              ? approval.orderData.codAmount
              : ((scrapedData.codAmount > 0) ? scrapedData.codAmount : (panelData.codAmount || 0));

            // Cập nhật lại số tiền COD vào Form bưu điện và Panel
            if (approvedCod !== undefined) {
              await updateCodInputInDOM(activePlatform, approvedCod);
              if (globalThis.parsedDataStore) {
                globalThis.parsedDataStore.codAmount = approvedCod;
                if (approvedCod === 0) globalThis.parsedDataStore.codExplicitZero = true;
                if (typeof displayParsedData === 'function') displayParsedData(globalThis.parsedDataStore);
              }
            }

            // Lưu snapshot đơn đã duyệt phòng khi DOM reset hoặc panel clear
            globalThis.__AF_LAST_APPROVED_ORDER__ = {
              ...(globalThis.parsedDataStore || {}),
              ...(approval.orderData || {}),
              codAmount: approvedCod
            };

            // Kích hoạt theo dõi lưu đơn (doSave) trực tiếp với approvedCod đã chốt
            setupAutoSaveOnSubmit(activePlatform, approvedCod, true);

            // Ghi nhận Ground Truth Feedback Loop: Bắt chênh lệch giữa máy bóc ban đầu vs dữ liệu người dùng duyệt
            detectAndRecordGroundTruth(
              globalThis.__AF_INITIAL_PARSED_DATA__,
              approval.orderData || scrapedData,
              rawText
            ).catch(() => {});

            // Xóa ngay dữ liệu trên panel khi xét duyệt đơn đồng ý theo yêu cầu người dùng
            if (typeof handleClearOrder === 'function') {
              handleClearOrder(true);
            }

            // Đánh dấu đã duyệt và kích hoạt click thật
            if (btn.dataset) btn.dataset.afApproved = 'true';
            if (typeof btn.click === 'function') {
              btn.click();
            } else if (typeof simulateFullClick === 'function') {
              simulateFullClick(btn);
            }
            setTimeout(() => { if (btn.dataset) btn.dataset.afApproved = ''; }, 3000);
          }
        } catch (modalErr) {
          console.error('[handleCarrierSubmitClick] Lỗi hiển thị modal xét duyệt đơn:', modalErr);
          if (typeof showVnpostToast === 'function') {
            showVnpostToast('⚠️ Có lỗi khi hiển thị Bảng Xét Duyệt Đơn: ' + (modalErr?.message || modalErr), 'error');
          }
        }
      } else {
        console.warn('[handleCarrierSubmitClick] showOrderApprovalModal chưa sẵn sàng');
        if (typeof showVnpostToast === 'function') {
          showVnpostToast('⚠️ Hệ thống xét duyệt chưa sẵn sàng, vui lòng thử lại sau giây lát!', 'warning');
        }
      }
    }

    function scanAndHookButtons() {
      let btns = [];
      if (platId === 'vnpost') {
        const candidates = document.querySelectorAll('.ant-pro-footer-bar #create_order, #create_order, .ant-pro-footer-bar button[title="Tạo đơn"], .ant-pro-footer-bar button.btn-outline-info, .ant-pro-footer-bar button');
        btns = Array.from(candidates).filter(isVnpostSubmitButton);
      } else {
        const allBtns = document.querySelectorAll('button, a, input[type="submit"], input[type="button"], [role="button"], .el-button, .ant-btn');
        btns = Array.from(allBtns).filter(btn => isCarrierSubmitButton(btn, platId));
      }

      for (const btn of btns) {
        if (btn.dataset.afSubmitHooked === '1') continue;
        btn.dataset.afSubmitHooked = '1';
        btn.addEventListener('click', (e) => handleCarrierSubmitClick(e, btn), true); // capture phase
      }
    }

    scanAndHookButtons();
    if (!_carrierSubmitInterceptorAttached) {
      _carrierSubmitInterceptorAttached = true;
      let hookTimer = null;
      const debouncedScan = () => {
        if (hookTimer) clearTimeout(hookTimer);
        hookTimer = setTimeout(scanAndHookButtons, 250);
      };
      const mo = new MutationObserver(debouncedScan);
      mo.observe(document.body, { childList: true, subtree: true });

      // Bổ sung document-level capture listener chống lọt click khi nút bấm được render động
      document.addEventListener('click', (ev) => {
        const targetBtn = ev.target && typeof ev.target.closest === 'function'
          ? ev.target.closest('button, a, input[type="submit"], input[type="button"], [role="button"], .el-button, .ant-btn')
          : null;
        if (!targetBtn || targetBtn.closest('#vnpost-autofill-shadow-host')) return;

        // Chỉ chặn click nếu đúng là nút Tạo Đơn hợp lệ của hãng
        if (!isCarrierSubmitButton(targetBtn, platId)) return;

        if (targetBtn.dataset && targetBtn.dataset.afApproved === 'true') return;
        ev.preventDefault();
        ev.stopPropagation();
        ev.stopImmediatePropagation();
        handleCarrierSubmitClick(ev, targetBtn);
      }, true);

      // Bổ sung form submit event listener chống lọt submit bằng phím Enter
      document.addEventListener('submit', (ev) => {
        const form = ev.target;
        if (!form || (form.closest && form.closest('#vnpost-autofill-shadow-host'))) return;
        if (form.dataset && form.dataset.afApproved === 'true') return;

        // Nếu là VNPost, chỉ nhận submit khi liên quan đến form tạo đơn thực tế
        if (platId === 'vnpost') {
          const isCreateOrderForm = form.id === 'form-create-order' || (form.querySelector && form.querySelector('#create_order, .ant-pro-footer-bar'));
          if (!isCreateOrderForm) return;
        }

        const submitBtn = form.querySelector ? form.querySelector('button[type="submit"], input[type="submit"], button.ant-btn-primary, button.el-button--primary, #create_order') : null;
        if (submitBtn && submitBtn.dataset && submitBtn.dataset.afApproved === 'true') return;

        ev.preventDefault();
        ev.stopPropagation();
        ev.stopImmediatePropagation();
        handleCarrierSubmitClick(ev, submitBtn || form);
      }, true);
    }
  }

  // ─── TỰ ĐỘNG LƯU ĐƠN KHI NGƯỜI DÙNG BẤM GỬI ĐƠN TRÊN TRANG ───
  function setupAutoSaveOnSubmit(platform, approvedCod = null, directTrigger = false) {
    const platId = typeof platform === 'object' && platform ? platform.id : (platform || (typeof getCurrentPlatform === 'function' ? (getCurrentPlatform()?.id || getCurrentPlatform()) : 'vnpost'));
    const submitKeywords = ['tạo đơn', 'đăng đơn', 'lưu đơn', 'gửi đơn', 'tạo bưu gửi', 'tạo mới', 'xác nhận', 'hoàn tất', 'lưu', 'tạo', 'lên đơn'];

    // scrapeOrderFromDOM moved to IIFE scope
    function doSave() {
      // Luôn lấy giá trị từ DOM (form VNPost/J&T) trước — ưu tiên dữ liệu thực tế trên trang
      let data = scrapeOrderFromDOM(platId);
      const parsed = globalThis.parsedDataStore || globalThis.__AF_LAST_APPROVED_ORDER__;
      const hasParsedData = !!parsed;
      
      // Nếu data.address từ DOM dính địa chỉ kho gửi / người gửi, hủy bỏ ngay lập tức
      if (isSenderAddress(data.address)) {
        console.warn('[doSave] Phát hiện data.address từ DOM trùng địa chỉ người gửi, loại bỏ:', data.address);
        data.address = '';
      }

      // Bổ sung các trường còn thiếu từ parsedDataStore (panel) nếu trên form chưa có hoặc dính lỗi form reset
      if (parsed) {
        if (!data.name) data.name = parsed.name || '';
        if (!data.phone) data.phone = parsed.phone || '';
        
        const parsedAddr = (parsed.address && parsed.address !== 'không tìm thấy') ? parsed.address.trim() : '';
        if (parsedAddr && !isSenderAddress(parsedAddr)) {
          if (!data.address || data.address === 'không tìm thấy' || isSenderAddress(data.address)) {
            data.address = parsedAddr;
          } else if (parsedAddr.length > data.address.length && (!data.address.includes(' ') || data.address.split(',').length <= 2)) {
            data.address = parsedAddr;
          }
        }

        if (!data.orderCode) data.orderCode = parsed.orderCode || '';
        if (!data.codAmount) data.codAmount = parsed.codAmount || 0;
        if (!data.collectFee) data.collectFee = parsed.collectFee || false;
        data.extraNote = data.extraNote || parsed.extraNote || '';
        if (parsed.id) data.id = parsed.id;
      }

      if (approvedCod !== null && approvedCod !== undefined) {
        data.codAmount = Number(approvedCod);
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
        platform: platId || '',
        extraNote: data.extraNote || '',
        carrierAccount: data.carrierAccount || detectCarrierAccount(platId) || ''
      };
      
      if (data.id) orderToSave.id = data.id;

      // ─── KIỂM TRA LÊN ĐƠN THÀNH CÔNG / THẤT BẠI TRƯỚC KHI GHI NHẬN ───
      let resolved = false;

      function checkDomError() {
        if (resolved) return null;
        // Chỉ check các toast / notification lỗi nổi lên của VNPost & J&T
        const errorSelectors = [
          '.ant-notification-notice-error',
          '.ant-message-error',
          '.el-message--error',
          '.el-notification--error'
        ];
        for (const sel of errorSelectors) {
          const els = document.querySelectorAll(sel);
          for (const el of els) {
            if (el.offsetParent === null) continue; // ẩn / không visible
            if (el.closest && el.closest('#vnpost-autofill-shadow-host')) continue;
            const txt = (el.textContent || el.innerText || '').trim();
            if (txt && txt.length > 2) return txt;
          }
        }
        // Check dialog / modal thông báo lỗi rõ ràng từ hệ thống hãng
        const dialogs = document.querySelectorAll('.ant-modal-content, .el-dialog, [role="dialog"], .modal-content');
        for (const dlg of dialogs) {
          if (dlg.closest && dlg.closest('#vnpost-autofill-shadow-host')) continue;
          const txt = (dlg.textContent || dlg.innerText || '').trim();
          if (txt && /(?:tạo|đăng|lưu|gửi|kết nối|hệ thống)\s*(?:thất bại|bị lỗi|không thành công|từ chối)/i.test(txt)) {
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
            if (el.closest && el.closest('#vnpost-autofill-shadow-host')) continue;
            const txt = (el.textContent || el.innerText || '').trim();
            const codeMatch = txt.match(/(?:mã\s*vận\s*đơn|mã\s*bưu\s*gửi|số\s*hiệu\s*bưu\s*gửi|tracking)\s*[:;]?\s*([A-Z0-9]{8,22})/i) ||
                              txt.match(/\b([A-Z]{2}\d{9,13}VN|C\d{9,13}VN|MP\d{8,12}VN|E[A-Z]\d{8,12}VN|8\d{11,14})\b/i);
            if (codeMatch && codeMatch[1]) {
              trackingCode = codeMatch[1].trim();
              break;
            }
          }
        }

        const latestDom = scrapeOrderFromDOM(platId);
        const nameToCheck = latestDom.name || data.name || orderToSave.name || '';
        const phoneToCheck = latestDom.phone || data.phone || orderToSave.phone || '';
        const orderCodeToCheck = latestDom.orderCode || data.orderCode || orderToSave.orderCode || '';

        // Kiểm tra xem đơn này vừa được xử lý gần đây chưa (tránh trùng lặp với interceptor)
        if (isSubmissionRecentlyHandled(trackingCode, orderCodeToCheck, phoneToCheck, nameToCheck)) {
          resolved = true;
          cleanup();
          if (trackingCode) {
            OrderStorage.updateLatestSubmittedOrderTracking(trackingCode).catch(() => {});
          }
          return;
        }

        // Ghi nhận đơn ngay (cả VNPost và J&T)
        resolved = true;
        cleanup();

        const cleanDomPhone = String(latestDom.phone || data.phone || orderToSave.phone || '').replace(/\D/g, '');
        const cleanDomOrderCode = String(latestDom.orderCode || data.orderCode || orderToSave.orderCode || '').trim().toLowerCase();
        const cleanPanelPhone = String(globalThis.parsedDataStore?.phone || globalThis.__AF_LAST_FILLED_ORDER__?.phone || '').replace(/\D/g, '');
        const cleanPanelOrderCode = String(globalThis.parsedDataStore?.orderCode || globalThis.__AF_LAST_FILLED_ORDER__?.orderCode || '').trim().toLowerCase();

        const isAutoFilled = Boolean(
          globalThis.__AF_JUST_FILLED__ ||
          (cleanDomPhone && cleanPanelPhone && cleanDomPhone.length >= 9 && cleanDomPhone === cleanPanelPhone) ||
          (cleanDomOrderCode && cleanPanelOrderCode && cleanDomOrderCode !== '—' && cleanDomOrderCode === cleanPanelOrderCode)
        );
        const orderSource = isAutoFilled ? 'AUTO_FILL' : 'MANUAL_ENTRY';
        orderToSave.source = orderSource;

        // Ưu tiên dữ liệu đã cào tại thời điểm bấm Tạo đơn (data.address / orderToSave.address)
        // hoặc từ panel (parsed.address) nếu DOM đã bị reset làm mất ô địa chỉ người nhận
        let finalAddress = '';
        const parsedAddr = (parsed?.address && parsed.address !== 'không tìm thấy') ? parsed.address.trim() : '';

        if (data.address && data.address !== 'không tìm thấy' && !isSenderAddress(data.address) && data.address.trim().length > 3) {
          finalAddress = data.address.trim();
        } else if (orderToSave.address && orderToSave.address !== 'không tìm thấy' && !isSenderAddress(orderToSave.address) && orderToSave.address.trim().length > 3) {
          finalAddress = orderToSave.address.trim();
        } else if (parsedAddr && !isSenderAddress(parsedAddr)) {
          finalAddress = parsedAddr;
        } else if (latestDom.address && latestDom.address !== 'không tìm thấy' && !isSenderAddress(latestDom.address)) {
          finalAddress = latestDom.address.trim();
        }

        let finalCod = 0;
        if (approvedCod !== null && approvedCod !== undefined) {
          finalCod = Number(approvedCod);
        } else if (latestDom.hasValidCodField && latestDom.codAmount !== undefined && latestDom.codAmount > 0) {
          finalCod = latestDom.codAmount;
        } else {
          finalCod = data.codAmount || orderToSave.codAmount || (parsed?.codAmount || 0);
        }

        const draftId = parsed?.id || data.id || null;

        const submittedOrder = {
          name: latestDom.name || data.name || orderToSave.name || '',
          phone: latestDom.phone || data.phone || orderToSave.phone || '',
          address: finalAddress,
          orderCode: latestDom.orderCode || data.orderCode || orderToSave.orderCode || '',
          codAmount: (latestDom.hasValidCodField && latestDom.codAmount !== undefined && latestDom.codAmount > 0)
            ? latestDom.codAmount
            : (finalCod || data.codAmount || orderToSave.codAmount || 0),
          collectFee: latestDom.collectFee || data.collectFee || orderToSave.collectFee || false,
          platform: platId || '',
          extraNote: latestDom.extraNote || data.extraNote || orderToSave.extraNote || '',
          carrierAccount: latestDom.carrierAccount || data.carrierAccount || orderToSave.carrierAccount || detectCarrierAccount(platId) || '',
          trackingCode: trackingCode || '',
          savedOrderId: draftId,
          source: orderSource
        };

        // Lưu trực tiếp vào Đơn đã gửi (submitted_orders), KHÔNG gọi saveOrder (đơn nháp)
        // để tránh hiện tượng đơn bị nhảy qua hàng đợi đơn nháp rồi biến mất.
        OrderStorage.saveSubmittedOrder(submittedOrder).then((savedOrder) => {
          if (!savedOrder) throw new Error('Không thể lưu đơn đã lên do thiếu dữ liệu khách hàng');
          markSubmissionHandled(trackingCode, submittedOrder.orderCode);
          const sourceText = isAutoFilled ? '⚡ Tách đơn AI' : '✍️ Gõ tay thủ công';
          if (trackingCode) {
            showVnpostToast(`📦 Đã xác nhận lên đơn (${sourceText})! Mã vận đơn: ` + trackingCode, 'success');
          } else if (platId === 'jt') {
            showVnpostToast(`✅ Đã ghi nhận đơn J&T (${sourceText}) thành công!`, 'success');
            // J&T: chạy monitor để poll API danh sách đơn (billCode) + bắt mã trên DOM sau khi tạo đơn có đối chiếu danh tính
            startTrackingCodeMonitor(draftId || submittedOrder.id, platId, null, submittedOrder);
          } else {
            showVnpostToast(`📬 Đã ghi nhận đơn VNPost (${sourceText})! Đang cập nhật mã vận đơn...`, 'success');
            startTrackingCodeMonitor(draftId || submittedOrder.id, platId, null, submittedOrder);
          }

          globalThis.__AF_JUST_FILLED__ = false;
          invalidateActiveAiSession('ORDER_SUBMITTED_DOM');

          // Phát sự kiện báo React panel rằng đơn đã được lưu DB
          window.dispatchEvent(new CustomEvent('order-saved-db'));

          // Xóa sạch dữ liệu trên panel sau khi tạo đơn thành công để tránh báo trùng đơn và sẵn sàng cho đơn mới
          if (typeof handleClearOrder === 'function') {
            handleClearOrder(true);
          }
        }).catch((err) => {
          console.error('Lỗi khi lưu đơn vào DB:', err);
          showVnpostToast('❌ Lỗi khi lưu đơn vào Database!', 'error');
        });
      }

      // Theo dõi DOM mutations
      const domMo = new MutationObserver(() => {
        if (resolved) return;

        // Luôn kiểm tra success TRƯỚC error — tránh false positive
        const bodyText = document.body.innerText || '';

        if (platId === 'jt' && /đăng đơn thành công|đơn hàng được tải lên/i.test(bodyText)) {
          onSuccess();
          return;
        }

        if (platId === 'vnpost') {
          const isVnpostSuccess = /(?:tạo vận đơn|tạo bưu gửi|tạo đơn|thêm mới|lưu bưu gửi|lưu vận đơn|lưu thông tin|lập đơn|chấp nhận|đã tạo|đã lưu).*thành công/i.test(bodyText) ||
                                  /thành công.*(?:bưu gửi|vận đơn|đơn hàng|đơn|tạo)/i.test(bodyText);
          if (isVnpostSuccess) {
            const codeMatch = bodyText.match(/\b([A-Z]{2}\d{9,13}VN|C\d{9,13}VN|MP\d{8,12}VN|E[A-Z]\d{8,12}VN|8\d{11,14})\b/i) ||
                              bodyText.match(/(?:mã\s*vận\s*đơn|số\s*hiệu\s*bưu\s*gửi|mã\s*bưu\s*gửi|tracking)\s*[:;]?\s*([A-Z0-9]{8,22})/i);
            onSuccess(codeMatch ? codeMatch[1].trim() : null);
            return;
          }
        }

        // Check success message trên DOM (chỉ match class success cụ thể và có nội dung tạo đơn thành công)
        const successSelector = '.ant-message-success, .ant-notification-notice-success, .ant-alert-success, .el-message--success, .el-notification--success, .ant-result-success, .swal2-success';
        const successEls = document.querySelectorAll(successSelector);
        if (successEls.length > 0) {
          for (const el of successEls) {
            if (el.closest && el.closest('#vnpost-autofill-shadow-host')) continue;
            const txt = (el.textContent || el.innerText || '').trim();
            const isOrderSuccess = /(?:tạo|lưu|đăng|bưu gửi|vận đơn|thành công|đơn hàng|tracking|chấp nhận)/i.test(txt);
            const codeMatch = txt.match(/\b([A-Z]{2}\d{9,13}VN|C\d{9,13}VN|MP\d{8,12}VN|E[A-Z]\d{8,12}VN|8\d{11,14})\b/i) ||
                              txt.match(/(?:mã\s*vận\s*đơn|số\s*hiệu\s*bưu\s*gửi|mã\s*bưu\s*gửi|tracking)\s*[:;]?\s*([A-Z0-9]{8,22})/i);
            if (isOrderSuccess || codeMatch) {
              onSuccess(codeMatch ? codeMatch[1].trim() : null);
              return;
            }
          }
        }

        // Chỉ kiểm tra error nếu có toast/notification lỗi rõ ràng xuất hiện
        const activeErrNotice = document.querySelector('.ant-notification-notice-error, .ant-message-error, .el-message--error, .el-notification--error');
        if (activeErrNotice) {
          const err = checkDomError();
          if (err) {
            onFailure(err);
            return;
          }
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
                const d = body.data || body.result || body;
                const firstItem = (Array.isArray(d) && d.length > 0) ? d[0] : ((Array.isArray(body.data) && body.data.length > 0) ? body.data[0] : null);
                const code = body.billCode || body.waybillNo || body.trackingCode || body.maVanDon || body.shipmentNumber || body.itemCode || body.barcode || body.orderId || body.orderCode || body.code || body.id ||
                             d?.billCode || d?.waybillNo || d?.trackingCode || d?.maVanDon || d?.shipmentNumber || d?.itemCode || d?.orderCode ||
                             firstItem?.billCode || firstItem?.waybillNo || firstItem?.trackingCode || firstItem?.itemCode || null;
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

      // 2s sau khi bấm gửi, chỉ kiểm tra nếu có toast thông báo lỗi rõ ràng
      setTimeout(() => {
        if (resolved) return;
        const activeErrNotice = document.querySelector('.ant-notification-notice-error, .ant-message-error, .el-message--error, .el-notification--error');
        if (activeErrNotice) {
          const err = checkDomError();
          if (err) onFailure(err);
        }
      }, 2000);

      // Timeout fallback: sau 15s nếu không có lỗi từ chối rõ ràng thì ghi nhận đơn thành công
      const timerId = setTimeout(() => {
        if (resolved) return;
        const activeErrNotice = document.querySelector('.ant-notification-notice-error, .ant-message-error, .el-message--error, .el-notification--error');
        if (activeErrNotice) {
          const err = checkDomError();
          if (err) {
            onFailure(err);
            return;
          }
        }
        onSuccess();
      }, 15000);
    }

    if (directTrigger) {
      doSave();
      return;
    }

    function tryHook() {
      let btns = [];
      if (platId === 'vnpost') {
        const candidates = document.querySelectorAll('.ant-pro-footer-bar #create_order, #create_order, .ant-pro-footer-bar button[title="Tạo đơn"], .ant-pro-footer-bar button.btn-outline-info, .ant-pro-footer-bar button');
        btns = Array.from(candidates).filter(isVnpostSubmitButton);
      } else {
        const allBtns = document.querySelectorAll('button, a, input[type="submit"], input[type="button"]');
        btns = Array.from(allBtns).filter(btn => isCarrierSubmitButton(btn, platId));
      }
      for (const btn of btns) {
        if (btn.dataset.afAutoSave === '1') continue;
        btn.dataset.afAutoSave = '1';
        btn.addEventListener('click', doSave);
      }
    }

    tryHook();
    let autoSaveTimer = null;
    const debouncedHook = () => {
      if (autoSaveTimer) clearTimeout(autoSaveTimer);
      autoSaveTimer = setTimeout(tryHook, 250);
    };
    const mo = new MutationObserver(debouncedHook);
    mo.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => {
      mo.disconnect();
      if (autoSaveTimer) clearTimeout(autoSaveTimer);
    }, 20000);
  }

  // ─── ĐIỀN BIỂU MẪU ĐVVC (MUTEX KHÓA TRÙNG) ───
  // 🚀 ĐIỀN BIỂU MẪU ĐƠN (MUTEX KHÓA TRẠNG) 🚀
  async function triggerFillForm(targetPlatform, options = {}) {
    const isPanelUpdate = options.isPanelUpdate === true;
    if (!globalThis.parsedDataStore) {
      showVnpostToast("❌ Vui lòng bấm 'Tách Đơn Hàng' trước!", "error");
      return;
    }

    // Chống double click hoặc thao tác lặp ghi đè DOM (Lỗi số 1 & Lỗi số 7)
    const acquired = await Mutex.acquire('autofill_execution');
    if (!acquired) {
      showVnpostToast("⌛ Biểu mẫu đang được điền, vui lòng đợi...", "info");
      return;
    }

    const btnId = targetPlatform === 'vnpost' ? 'btnFillVNPost' : 'btnFillJT';
    let btn = getVnpostEl(btnId);
    if (!btn) btn = getVnpostEl('btnFillForm'); // Fallback for React UI
    const originalLabel = btn ? btn.innerHTML : '';

    const { name, phone, address, orderCode, codAmount, collectFee } = globalThis.parsedDataStore;

    const adapter = targetPlatform === 'vnpost' 
      ? globalThis.VNPostAdapter 
      : targetPlatform === 'jt' 
        ? globalThis.JTAdapter 
        : targetPlatform === 'viettel' 
          ? globalThis.ViettelPostAdapter 
          : targetPlatform === 'ghtk' 
            ? globalThis.GHTKAdapter 
            : (globalThis.VNPostAdapter || globalThis.JTAdapter);
    if (!adapter) {
      Mutex.release('autofill_execution');
      return;
    }

    const normalizedPhone = normalizePhoneNumber(phone);
    if (!normalizedPhone) {
      showVnpostToast("⚠️ Số điện thoại không đúng định dạng. Vui lòng sửa lại trước khi nhập đơn.", "error");
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalLabel;
      }
      Mutex.release('autofill_execution');
      return;
    }
    globalThis.parsedDataStore.phone = normalizedPhone;

    // ─── KIỂM TRA ĐƠN ĐÃ TỪNG LÊN (CHẠY BẤT ĐỒNG BỘ, KHÔNG CHẶN LUỒNG ĐIỀN ĐƠN) ───
    (async () => {
      try {
        if (typeof OrderStorage !== 'undefined') {
          const submittedOrders = typeof OrderStorage._getSubmittedOrdersFromLocal === 'function'
            ? await OrderStorage._getSubmittedOrdersFromLocal().catch(() => [])
            : (typeof OrderStorage.getSubmittedOrders === 'function' ? await OrderStorage.getSubmittedOrders().catch(() => []) : []);
          const todayStr = new Date().toISOString().slice(0, 10);
          const todayLocale = new Date().toLocaleDateString('vi-VN');
          const checkCode = String(orderCode || '').trim().toLowerCase();
          const cleanCheckCode = checkCode.replace(/[\s\.\-_]/g, '');
          const checkPh = String(normalizedPhone || '').replace(/\D/g, '');

          const dup = (submittedOrders || []).find(sub => {
            const rawDate = sub.submittedAt || sub.createdAt || sub.updatedAt || '';
            let isToday = false;
            if (rawDate) {
              const dStr = new Date(rawDate).toISOString().slice(0, 10);
              const dLocale = new Date(rawDate).toLocaleDateString('vi-VN');
              if (dStr === todayStr || dLocale === todayLocale) isToday = true;
            } else {
              isToday = true;
            }

            const isDistinctShopCode = (c) => {
              if (!c || typeof c !== 'string') return false;
              const tr = c.trim();
              if (tr.length < 3 || tr.length > 30) return false;
              if (!/\d/.test(tr)) return false;
              if (/^\d+$/.test(tr)) return false;
              return true;
            };

            const subCode = String(sub.orderCode || sub.order_code || '').trim().toLowerCase();
            const cleanSubCode = subCode.replace(/[\s\.\-_]/g, '');
            const subPhone = String(sub.phone || '').replace(/\D/g, '');

            const hasValidCheckCode = isDistinctShopCode(checkCode);
            const hasValidSubCode = isDistinctShopCode(subCode);
            const hasBothCodes = hasValidCheckCode && hasValidSubCode;
            if (hasBothCodes && checkCode !== subCode && cleanCheckCode !== cleanSubCode) {
              return false; // Khách mua 2 cây khác nhau -> khác mã đơn riêng của shop -> không coi là trùng
            }

            const matchCode = Boolean(
              hasBothCodes && (
                checkCode === subCode ||
                cleanCheckCode === cleanSubCode
              )
            );
            const matchPhone = Boolean(checkPh && checkPh.length >= 9 && subPhone && checkPh === subPhone);

            return matchCode || (matchPhone && isToday);
          });

          if (dup) {
            const rawDate = dup.submittedAt || dup.createdAt || dup.updatedAt || '';
            const isToday = rawDate ? (new Date(rawDate).toISOString().slice(0, 10) === todayStr || new Date(rawDate).toLocaleDateString('vi-VN') === todayLocale) : true;
            const dupTime = rawDate ? new Date(rawDate).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '';
            const dupDate = rawDate ? new Date(rawDate).toLocaleDateString('vi-VN') : 'Hôm nay';
            const whenStr = isToday ? `hôm nay lúc ${dupTime}` : `ngày ${dupDate}${dupTime ? ` lúc ${dupTime}` : ''}`;
            showVnpostToast(`⚠️ LƯU Ý: Đơn này (${dup.orderCode || dup.phone}) đã từng được lên đơn ${whenStr}${dup.trackingCode ? ` (Mã VĐ: ${dup.trackingCode})` : ''}!`, 'warning', 6000);
          }
        }
      } catch (_) {}
    })();

    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳ Đang xử lý...';
    }

    try {
      if (adapter.prepare && !isPanelUpdate) {
        if (btn && targetPlatform === 'vnpost') btn.textContent = '⏳ Đang chuẩn bị...';
        const ok = await adapter.prepare();
        if (!ok) {
          Mutex.release('autofill_execution');
          if (btn) btn.disabled = false;
          return;
        }
      }
      if (btn) btn.textContent = '⏳ Đang điền đơn...';

      // Chờ cho đến khi ô nhập số điện thoại xuất hiện (tối đa 4 giây, kiểm tra mỗi 50ms)
      const inputEl = await waitFor(() => {
        const platformSelectors = targetPlatform === 'vnpost' ? globalThis.VNPOST_SELECTORS : globalThis.JT_SELECTORS;
        return findFieldInput(platformSelectors.phoneLabels, platformSelectors.phoneFallbacks);
      }, 4000, 50);

      if (!inputEl) {
        showVnpostToast('❌ Không tìm thấy biểu mẫu điền đơn của trang web.', 'error');
        Mutex.release('autofill_execution');
        if (btn) btn.disabled = false;
        return;
      }

      if (btn) btn.textContent = '⏳ Đang điền đơn...';
      
      const fillOrderCode = (targetPlatform === 'vnpost' && orderCode) ? formatVNPostOrderCode(orderCode) : orderCode;
      
      // Thực thi điền thông tin (await để chờ J&T dropdown xử lý xong)
      await adapter.fill(name, normalizedPhone, address, fillOrderCode, codAmount, collectFee);
      lastSuccessfulFillPlatform = targetPlatform;
      globalThis.__AF_JUST_FILLED__ = true;
      globalThis.__AF_LAST_FILLED_ORDER__ = {
        name,
        phone: normalizedPhone,
        address,
        orderCode: fillOrderCode,
        codAmount,
        collectFee,
        platform: targetPlatform,
        weight: globalThis.parsedDataStore?.weight || globalThis.parsedDataStore?.weightGrams || globalThis.parsedDataStore?.defaultWeightVnpost || 200,
        weightGrams: globalThis.parsedDataStore?.weightGrams || globalThis.parsedDataStore?.defaultWeightVnpost || 200,
        defaultWeightVnpost: globalThis.parsedDataStore?.defaultWeightVnpost || 200,
        productItem: globalThis.parsedDataStore?.productItem || globalThis.parsedDataStore?.defaultGoodsName || '',
        extraNote: globalThis.parsedDataStore?.extraNote || '',
        timestamp: Date.now()
      };
      showVnpostToast('✅ Đã điền đơn thành công!', 'success');

      // Ghi nhận Log Vận hành
      if (typeof AuditLogger !== 'undefined' && typeof AuditLogger.logOperation === 'function') {
        AuditLogger.logOperation('AUTOFILL_SUCCESS', `Tự động điền đơn cho khách ${name} (${orderCode || 'Không mã'}) vào ${targetPlatform}`, {
          name,
          phone: normalizedPhone,
          orderCode,
          platform: targetPlatform,
          codAmount
        });
      }

      // Lưu ý: Việc bắt sự kiện tạo đơn khi bấm nút trên web đã được handleCarrierSubmitClick
      // và Modal Xét Duyệt Đơn Hàng xử lý an toàn, không gọi setupAutoSaveOnSubmit sớm ở đây
      // để tránh kích hoạt timer hoặc lưu đơn khi người dùng chưa duyệt tạo đơn.
    } catch (err) {
      if (typeof AuditLogger !== 'undefined' && typeof AuditLogger.logError === 'function') {
        AuditLogger.logError('AUTOFILL_FAILED', `Lỗi khi điền đơn vào ${targetPlatform}: ${err?.message || err}`, {
          platform: targetPlatform,
          error: err?.message || err
        });
      }
      showVnpostToast('❌ Có lỗi khi điền đơn: ' + (err?.message || err), 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalLabel;
      }
      Mutex.release('autofill_execution');
    }
  }

  // ─── ĐIỀN ĐƠN LẺ TỪNG TRƯỜNG KHI SỬA TRÊN PANEL (SURGICAL SINGLE-FIELD DOM SYNC) ───
  // Chỉ điền đúng trường được sửa, tuyệt đối KHÔNG chạy lại toàn bộ quy trình điền đơn (trừ khi người dùng chủ động bấm Nhập Đơn).
  function safeSetDomInput(el, val) {
    if (!el) return;
    try {
      el.focus();
      if (typeof setInputValue === 'function') {
        setInputValue(el, String(val));
      } else if (typeof globalThis.setInputValue === 'function') {
        globalThis.setInputValue(el, String(val));
      } else {
        el.value = String(val);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
      el.blur();
    } catch (e) {
      console.warn('[safeSetDomInput] Lỗi đặt giá trị DOM:', e);
    }
  }

  // Chuẩn hóa mã đơn hàng cho VNPost: loại bỏ toàn bộ ký tự có dấu và khoảng cách
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
  globalThis.formatVNPostOrderCode = formatVNPostOrderCode;

  async function updateSingleCarrierFieldInDOM(platform, field, value) {
    if (!platform || !field) return;
    const platId = typeof platform === 'object' && platform ? platform.id : String(platform).toLowerCase();

    try {
      // 1. Trường Tiền COD (codAmount)
      if (field === 'codAmount') {
        await updateCodInputInDOM(platId, value);
        return;
      }

      // 2. Trường Tên người nhận (name)
      if (field === 'name') {
        const cleanName = String(value || '').trim();
        if (platId === 'vnpost') {
          let nameEl = document.querySelector('#form-create-order_receiverName') ||
                       document.querySelector('input#receiverName') ||
                       (typeof findFieldInput === 'function' && typeof VNPOST_SELECTORS !== 'undefined' ? findFieldInput(VNPOST_SELECTORS.nameLabels, VNPOST_SELECTORS.nameFallbacks) : null);
          if (nameEl) safeSetDomInput(nameEl, cleanName);
        } else if (platId === 'jt') {
          let nameEl = typeof findFieldInput === 'function' && typeof globalThis.JT_SELECTORS !== 'undefined' ? findFieldInput(globalThis.JT_SELECTORS.nameLabels, globalThis.JT_SELECTORS.nameFallbacks) : null;
          if (nameEl) safeSetDomInput(nameEl, cleanName);
        } else {
          let nameEl = document.querySelector('input[name*="receiverName" i], input[placeholder*="họ tên người nhận" i], input[placeholder*="tên người nhận" i]');
          if (nameEl) safeSetDomInput(nameEl, cleanName);
        }
        return;
      }

      // 3. Trường Số điện thoại (phone)
      if (field === 'phone') {
        const cleanPhone = String(value || '').replace(/\D/g, '');
        if (platId === 'vnpost') {
          let phoneEl = document.querySelector('#form-create-order_receiverPhone') ||
                        document.querySelector('input#receiverPhone') ||
                        (typeof findFieldInput === 'function' && typeof VNPOST_SELECTORS !== 'undefined' ? findFieldInput(VNPOST_SELECTORS.phoneLabels, VNPOST_SELECTORS.phoneFallbacks) : null);
          if (phoneEl) safeSetDomInput(phoneEl, cleanPhone);
        } else if (platId === 'jt') {
          let phoneEl = typeof findFieldInput === 'function' && typeof globalThis.JT_SELECTORS !== 'undefined' ? findFieldInput(globalThis.JT_SELECTORS.phoneLabels, globalThis.JT_SELECTORS.phoneFallbacks) : null;
          if (phoneEl) safeSetDomInput(phoneEl, cleanPhone);
        } else {
          let phoneEl = document.querySelector('input[name*="receiverPhone" i], input[placeholder*="số điện thoại người nhận" i], input[placeholder*="sđt người nhận" i]');
          if (phoneEl) safeSetDomInput(phoneEl, cleanPhone);
        }
        return;
      }

      // 4. Trường Mã đơn hàng của Shop (orderCode)
      if (field === 'orderCode') {
        const cleanCode = platId === 'vnpost' ? formatVNPostOrderCode(value) : String(value || '').trim();
        if (platId === 'vnpost') {
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
            if (el) {
              safeSetDomInput(el, cleanCode);
              break;
            }
          }

          // Cập nhật lại ô Nội dung / Ghi chú / Tên hàng hóa VNPost
          const contentEl = document.querySelector('#form-create-order_receiverNote') ||
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
          if (contentEl) {
            const store = globalThis.parsedDataStore || {};
            const defName = store.defaultGoodsName || 'Hàng hóa';
            let noteText = cleanCode ? ("Đơn hàng: " + cleanCode) : defName;
            if (store.productItem && store.productItem.trim() && store.productItem.trim() !== cleanCode) {
              noteText = store.productItem.trim() + (cleanCode ? (" | Đơn hàng: " + cleanCode) : "");
            }
            if (store.extraNote) noteText += (noteText ? " | " : "") + store.extraNote;
            if (store.extraPhones?.length) noteText += (noteText ? " | " : "") + "SDT phụ: " + store.extraPhones.join(', ');
            safeSetDomInput(contentEl, noteText);
          }
        } else if (platId === 'jt') {
          let codeEl = typeof findFieldInput === 'function' && typeof globalThis.JT_SELECTORS !== 'undefined' ? findFieldInput(globalThis.JT_SELECTORS.codeLabels, globalThis.JT_SELECTORS.codeFallbacks) : null;
          if (codeEl) safeSetDomInput(codeEl, cleanCode);

          const store = globalThis.parsedDataStore || {};
          const defaultGoodsName = store.defaultGoodsName || 'Hàng hóa';
          const primaryGoods = (store.productItem && store.productItem.trim() && store.productItem.trim() !== cleanCode)
            ? store.productItem.trim() + (cleanCode ? (" | " + cleanCode) : "")
            : (cleanCode || defaultGoodsName);
          let goodsText = primaryGoods;
          const notesParts = [];
          if (store.extraNote) notesParts.push(store.extraNote);
          if (store.extraPhones?.length) notesParts.push('SDT phụ: ' + store.extraPhones.join(', '));
          if (notesParts.length > 0) goodsText += ' | ' + notesParts.join(' | ');

          // Cập nhật ô Tên sản phẩm / Tên hàng hóa
          let goodsInp = document.querySelector('textarea[placeholder="Nhập tên sản phẩm"]') ||
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
          if (goodsInp) safeSetDomInput(goodsInp, goodsText);

          // Cập nhật ô Ghi chú / Nội dung
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
            noteEl = document.querySelector('textarea[placeholder*="Nội dung"]') || document.querySelector('input[placeholder*="Ghi chú"]');
          }
          if (noteEl) safeSetDomInput(noteEl, goodsText);
        } else {
          let codeEl = document.querySelector('input[name*="orderCode" i], input[placeholder*="mã đơn hàng" i], input[placeholder*="mã khách hàng" i]');
          if (codeEl) safeSetDomInput(codeEl, cleanCode);

          let contentEl = document.querySelector('textarea[name*="note" i], textarea[placeholder*="nội dung" i], input[name*="goodsName" i], input[placeholder*="tên hàng" i]');
          if (contentEl) {
            const store = globalThis.parsedDataStore || {};
            let noteText = cleanCode ? ("Đơn hàng: " + cleanCode) : 'Hàng hóa';
            if (store.extraNote) noteText += " | " + store.extraNote;
            safeSetDomInput(contentEl, noteText);
          }
        }
        return;
      }

      // 5. Trường Địa chỉ chi tiết (address)
      if (field === 'address') {
        const cleanAddress = String(value || '').trim();
        if (cleanAddress && cleanAddress !== 'không tìm thấy') {
          if (platId === 'vnpost') {
            let addrEl = document.querySelector('#form-create-order_receiverAddress') ||
                         document.querySelector('input#form-create-order_receiverAddress') ||
                         document.querySelector('input[placeholder="Địa chỉ chi tiết"]') ||
                         document.querySelector('input[placeholder*="Địa chỉ chi tiết" i]') ||
                         (typeof findFieldInput === 'function' && typeof VNPOST_SELECTORS !== 'undefined' ? findFieldInput(VNPOST_SELECTORS.addressLabels, VNPOST_SELECTORS.addressFallbacks, true) : null);
            if (addrEl) safeSetDomInput(addrEl, cleanAddress);
          } else if (platId === 'jt') {
            let addrEl = typeof findFieldInput === 'function' && typeof globalThis.JT_SELECTORS !== 'undefined' ? findFieldInput(globalThis.JT_SELECTORS.addressLabels, globalThis.JT_SELECTORS.addressFallbacks) : null;
            if (addrEl) safeSetDomInput(addrEl, cleanAddress);
          } else {
            let addrEl = document.querySelector('input[name*="address" i], textarea[name*="address" i], input[placeholder*="địa chỉ" i]');
            if (addrEl) safeSetDomInput(addrEl, cleanAddress);
          }
        }
        return;
      }

      // 6. Trường Trọng lượng (weight / weightGrams)
      if (field === 'weight' || field === 'weightGrams') {
        const numWeight = Number(value || 0);
        if (platId === 'vnpost') {
          let wEl = document.querySelector('input[name="weight"], #form-create-order_weight, input[placeholder*="khối lượng" i], input[placeholder*="trọng lượng" i]');
          if (wEl) safeSetDomInput(wEl, String(numWeight));
        } else if (platId === 'jt') {
          let wEl = document.querySelector('input[placeholder="Nhập trọng lượng"]') || document.querySelector('input[placeholder*="trọng lượng"]');
          if (wEl) safeSetDomInput(wEl, String(numWeight > 10 ? (numWeight / 1000).toFixed(2) : numWeight));
        }
        return;
      }
    } catch (err) {
      console.warn('[updateSingleCarrierFieldInDOM] Lỗi cập nhật trường đơn lẻ:', field, err);
    }
  }

  function scheduleCarrierRefillAfterEdit(field = null, value = null) {
    if (!lastSuccessfulFillPlatform) return;
    if (carrierRefillTimer) clearTimeout(carrierRefillTimer);
    // Chỉ cập nhật mục đơn lẻ cụ thể vào form bưu cục khi người dùng kết thúc chỉnh sửa (blur hoặc dừng gõ)
    carrierRefillTimer = setTimeout(() => {
      carrierRefillTimer = null;
      if (!lastSuccessfulFillPlatform) return;
      const host = document.getElementById('vnpost-autofill-shadow-host');
      if (host && host.shadowRoot) {
        const active = host.shadowRoot.activeElement;
        if (active && (active.isContentEditable || active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
          return; // Người dùng đang thao tác trên panel, không can thiệp DOM trang web
        }
      }
      if (field) {
        // CHỈ ĐIỀN ĐÚNG MỤC ĐƯỢC CHỈNH SỬA, TUYỆT ĐỐI KHÔNG CHẠY LẠI TOÀN BỘ ĐƠN
        updateSingleCarrierFieldInDOM(lastSuccessfulFillPlatform, field, value);
      }
    }, 400);
  }

  // ─── CẬP NHẬT TRƯỜNG CHỈNH SỬA TRỰC TIẾP ───
  async function updateParsedField(field, value) {
    if (!globalThis.parsedDataStore) return;
    const oldAddress = globalThis.parsedDataStore.address;
    const platId = typeof getCurrentPlatform === 'function' ? (getCurrentPlatform()?.id || getCurrentPlatform()) : 'vnpost';
    if (field === 'orderCode' && platId === 'vnpost' && value) {
      value = formatVNPostOrderCode(value);
    }
    
    globalThis.parsedDataStore[field] = value;
    
    if (globalThis.parsedDataStore.id) {
      autoUpdateSavedOrder();
    }

    // Tự động bóc tách và chuẩn hóa lại gợi ý 2 cấp khi người dùng sửa ô địa chỉ
    if (field === 'address' && value) {
      // 1. Luôn giữ nguyên giá trị người dùng trực tiếp sửa tay vào ô hiển thị và dataStore
      globalThis.parsedDataStore.address = value;
      const addressEl = getVnpostEl('rev-address');
      if (addressEl && addressEl.textContent !== value) {
        addressEl.textContent = value;
      }

      // 2. Cập nhật gợi ý 2 cấp, 3 cấp và bóc tách các cấp Tỉnh/Huyện/Xã (để adapter bưu điện chọn được dropdown)
      // TUYỆT ĐỐI KHÔNG ghi đè lại nội dung ô rev-address người dùng vừa sửa tay!
      await refreshAddressSuggestion(value, globalThis.parsedDataStore.phone);

      // 3. Tự động học lại khi người dùng sửa thủ công để tối ưu AKB
      if (value !== oldAddress) {
        const rawEl = getVnpostEl('rawOrderText');
        const rawText = rawEl ? rawEl.value.trim() : '';
        const localResult = typeof runLocalComputerParser === 'function' ? runLocalComputerParser(rawText) : {};
        const rawAddress = localResult.address;
        if (typeof AddressParser !== 'undefined' && typeof AddressLearning !== 'undefined') {
          const parsedCorrect = AddressParser.parse(AddressNormalizer.normalize(value));
          if (parsedCorrect) {
            parsedCorrect.confidence = 100;
            AddressLearning.learn(value, parsedCorrect, globalThis.parsedDataStore.phone, {
              sourceType: 'human_edit'
            });
            if (rawAddress && rawAddress !== "không tìm thấy") {
              AddressLearning.learn(rawAddress, parsedCorrect, globalThis.parsedDataStore.phone, {
                sourceType: 'human_edit'
              });
            }
          }
        }
      }
    }

    if (field === 'address' && globalThis.parsedDataStore.id) {
      autoUpdateSavedOrder();
    }

    if (field === 'orderCode' || field === 'phone' || field === 'name') {
      if (typeof globalThis.checkAndDisplayDuplicateAlert === 'function') {
        globalThis.checkAndDisplayDuplicateAlert(globalThis.parsedDataStore);
      }
    }

    try {
      window.dispatchEvent(new CustomEvent('autofill:parsed', { detail: globalThis.parsedDataStore }));
    } catch (_) {}
    lookupCustomerAfterParse(globalThis.parsedDataStore).catch(() => {});
    
    // Chỉ đồng bộ trường đơn lẻ vừa sửa vào form bưu cục, tuyệt đối không chạy lại toàn bộ đơn: scheduleCarrierRefillAfterEdit()
    scheduleCarrierRefillAfterEdit(field, value);
  }

  // ─── GIAI ĐOẠN 3: BẮT CHÊNH LỆCH DELTA & GHI NHẬN GROUND TRUTH FEEDBACK ───
  async function detectAndRecordGroundTruth(initialParsed, finalData, rawText = '') {
    if (!initialParsed || !finalData) return;
    try {
      const initialAddr = String(initialParsed.address || '').trim();
      const finalAddr = String(finalData.address || '').trim();
      const finalPhone = String(finalData.phone || initialParsed.phone || '').replace(/\D/g, '');

      // 1. Chênh lệch Địa chỉ: Người dùng sửa địa chỉ khác so với kết quả bóc tách tự động
      if (
        finalAddr && 
        finalAddr !== 'không tìm thấy' && 
        initialAddr && 
        initialAddr !== 'không tìm thấy' && 
        initialAddr.toLowerCase() !== finalAddr.toLowerCase()
      ) {
        if (typeof AddressParser !== 'undefined' && typeof AddressLearning !== 'undefined') {
          const parsedFinal = AddressParser.parse(AddressNormalizer.normalize(finalAddr));
          if (parsedFinal) {
            parsedFinal.confidence = 100;
            await AddressLearning.learn(initialAddr, parsedFinal, finalPhone, {
              sourceType: 'human_confirmed', verified: true
            });
            await AddressLearning.learn(finalAddr, parsedFinal, finalPhone, {
              sourceType: 'human_confirmed', verified: true
            });
            console.log('[GroundTruth] Đã ghi nhận học máy từ địa chỉ người dùng sửa:', { initialAddr, finalAddr });
          }
        }
      }

      // 2. Các trường khác dùng chung một pipeline correction có consumer thật.
      if (typeof AddressLearning !== 'undefined' && typeof AddressLearning.recordUserCorrection === 'function') {
        const fields = ['name', 'phone', 'orderCode', 'codAmount', 'productItem'];
        for (const field of fields) {
          const initialValue = initialParsed[field] ?? '';
          const finalValue = finalData[field] ?? '';
          if (String(initialValue).trim() === String(finalValue).trim()) continue;
          await AddressLearning.recordUserCorrection({
            field,
            originalValue: initialValue,
            correctedValue: finalValue,
            rawText,
            phone: finalPhone,
            confirmed: true
          });
        }
      }

      try {
        const logger = typeof recordOrderEvent === 'function' ? recordOrderEvent : (globalThis.recordOrderEvent || null);
        if (logger && finalData) {
          logger({
            orderId: finalData.id || finalData.orderCode || ('order_' + Date.now()),
            orderCode: finalData.orderCode || '',
            eventType: 'USER_FIELD_CHANGED',
            actorType: 'USER',
            source: 'ground_truth_correction',
            beforeState: initialParsed,
            afterState: finalData,
            metadata: { rawText }
          }).catch(() => {});
        }
      } catch (_) {}
    } catch (e) {
      console.warn('[GroundTruth] Lỗi bắt chênh lệch:', e);
    }
  }
  globalThis.detectAndRecordGroundTruth = detectAndRecordGroundTruth;

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
        carrierAccount: detectCarrierAccount(platform) || globalThis.parsedDataStore.carrierAccount || "",
        platform: platform ? platform.id : "",
        createdAt: globalThis.parsedDataStore.createdAt
      };
      
      await OrderStorage.saveOrder(orderToSave);
    } catch (err) {
      Logger.error("Lỗi khi tự động cập nhật đơn hàng đã lưu:", err);
    }
  }

  function strip2025Province(addressVal) {
    if (!addressVal) return '';
    return String(addressVal)
      .replace(/\s*\([^)]*(?:2025|sáp nhập|cũ|mới)[^)]*\)/gi, '')
      .trim();
  }

  function handleAiAddressClick(addressVal) {
    if (!addressVal || !globalThis.parsedDataStore) return;
    copyToClipboard(addressVal);
    
    const cleanAddress = strip2025Province(addressVal);
    globalThis.parsedDataStore.address = cleanAddress;
    globalThis.parsedDataStore.addressLevel = 2;
    const revAddress = getVnpostEl('rev-address');
    if (revAddress) revAddress.textContent = cleanAddress;

    const addressStatusBadge = getVnpostEl('address-status-badge');
    if (addressStatusBadge) {
      addressStatusBadge.textContent = '🎯 Địa chỉ 2 Cấp';
      addressStatusBadge.title = 'Địa chỉ được nhận diện theo chuẩn 2 cấp (không chèn quận).';
    }

    const refDisclosure = getVnpostEl('address-reference-disclosure') || document.getElementById('vnpost-autofill-shadow-host')?.shadowRoot?.querySelector?.('.address-reference-disclosure');
    if (refDisclosure) {
      refDisclosure.style.display = 'none';
    }
    
    if (globalThis.parsedDataStore.id) {
      autoUpdateSavedOrder();
    }

    const aiGeoBox = getVnpostEl('ai-geo-box');
    if (aiGeoBox) {
      aiGeoBox.style.backgroundColor = '#dbeafe';
      setTimeout(() => { aiGeoBox.style.backgroundColor = '#eff6ff'; }, 400);
    }
    showVnpostToast('🎯 Đã áp dụng địa chỉ 2 cấp mới: ' + cleanAddress, 'success');
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

  function handleClearOrder(silent = false) {
    invalidateActiveAiSession('ORDER_CLEARED');
    globalThis.parsedDataStore = null;
    globalThis.__AF_INITIAL_PARSED_DATA__ = null;
    lastSuccessfulFillPlatform = '';
    if (carrierRefillTimer) {
      clearTimeout(carrierRefillTimer);
      carrierRefillTimer = null;
    }
    const rawOrderText = getVnpostEl('rawOrderText');
    if (rawOrderText) {
      rawOrderText.value = '';
      rawOrderText.focus();
    }
    const rawInputEl = getVnpostEl('order-raw-input');
    if (rawInputEl) {
      rawInputEl.value = '';
    }
    const reviewPanel = getVnpostEl('review-panel');
    const aiGeoBox = getVnpostEl('ai-geo-box');
    const geminiContainer = getVnpostEl('gemini-progress-container');
    const dupAlert = getVnpostEl('panel-duplicate-alert');
    if (reviewPanel) reviewPanel.style.display = 'none';
    if (aiGeoBox) aiGeoBox.style.display = 'none';
    if (geminiContainer) geminiContainer.style.display = 'none';
    if (dupAlert) dupAlert.style.display = 'none';
    if (typeof globalThis.resetSourceOrderCard === 'function') {
      globalThis.resetSourceOrderCard();
    }
    try {
      window.dispatchEvent(new CustomEvent('autofill:clear-order'));
    } catch (_) {}
    if (!silent) {
      showVnpostToast('🗑️ Đã xóa, sẵn sàng dán đơn mới.', 'info');
    }
  }
  globalThis.handleClearOrder = handleClearOrder;

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
      const carrierAccount = detectCarrierAccount(platform);
      const orderToSave = {
        name: name || "",
        phone: phone || "",
        address: address && address !== "không tìm thấy" ? address : "",
        orderCode: orderCode || "",
        codAmount: codAmount || 0,
        collectFee: collectFee || false,
        platform: platform || "",
        carrierAccount: carrierAccount || globalThis.parsedDataStore.carrierAccount || "",
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
      
      showVnpostToast("📦 Đã lưu vào Đơn nháp thành công!", "success");
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

  if (typeof globalThis.AuthEvents !== 'undefined' && typeof globalThis.AuthEvents.on === 'function') {
    globalThis.AuthEvents.on('AUTH_STATE_CHANGED', () => {
      checkUrlAndInject();
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
        Logger.log("Chẩn đoán DOM J&T (Diagnostics)", diagnosticInfo);
      }
    } catch (e) {
      console.warn("Diagnostics run error:", e);
    }
  }, 6000);

  // ─── LẮNG NGHE LỆNH TỪ TRANG OPTIONS (BULK PARSE) ───
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'LOGOUT_BROADCAST' || request.type === 'LOGOUT_BROADCAST') {
        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.removeItem('vnpost_session');
            localStorage.removeItem('af_logged_user');
            localStorage.removeItem('profile');
            localStorage.removeItem('currentUser');
            localStorage.removeItem('activeShopId');
            localStorage.removeItem('shop_access_key');
            localStorage.removeItem('staff_name');
          }
        } catch (_) {}
        setTimeout(() => {
          checkUrlAndInject();
        }, 50);
        sendResponse({ ok: true });
        return true;
      }
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
        return true;
      }

      // ─── ĐỒNG BỘ ĐƠN HÀNG QUA PHIÊN MYVNPOST WEB (SESSION SYNC) ───
      if (request.action === 'VNPOST_CHECK_WEB_SESSION') {
        try {
          const token = (typeof localStorage !== 'undefined' ? localStorage.getItem('accessToken') : '') || '';
          const userPhone = (typeof localStorage !== 'undefined' ? localStorage.getItem('USER_PHONE') : '') || '';
          const userName = (typeof localStorage !== 'undefined' ? localStorage.getItem('USER_NAME') : '') || '';
          const hasSession = Boolean(token && token.trim().length > 10);
          sendResponse({
            success: true,
            hasSession,
            token: hasSession ? token.trim() : null,
            userPhone: userPhone.trim(),
            userName: userName.trim(),
            origin: window.location.origin
          });
        } catch (err) {
          sendResponse({ success: false, error: err.message });
        }
        return true;
      }

      if (request.action === 'VNPOST_FETCH_ORDERS_VIA_WEB') {
        (async () => {
          try {
            const token = request.token || (typeof localStorage !== 'undefined' ? localStorage.getItem('accessToken') : '') || '';
            if (!token) {
              sendResponse({ success: false, error: 'Chưa có token đăng nhập trên tab MyVNPost.' });
              return;
            }

            const authHeader = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
            const page = request.page || 0;
            const size = Math.min(request.size || 50, 100);

            const headers = {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': authHeader,
              'cApiKey': '19001111'
            };

            const payload = {
              dateType: 'CREATED'
            };
            if (request.fromDate) {
              payload.fromDate = request.fromDate;
              payload.createTimeFrom = request.fromDate;
            }
            if (request.toDate) {
              payload.toDate = request.toDate;
              payload.createTimeTo = request.toDate;
            }
            if (Array.isArray(request.lstStatus) && request.lstStatus.length > 0) {
              payload.lstStatus = request.lstStatus;
            }

            // Gọi thử endpoint chuẩn searchAllByParam
            let res = await fetch(`https://api-pre-my.vnpost.vn/myvnp-web/v1/OrderHdr/searchAllByParam?page=${page}&size=${size}`, {
              method: 'POST',
              headers,
              body: JSON.stringify(payload)
            }).catch(() => null);

            // Dự phòng gọi endpoint searchAllByParamV2 nếu endpoint đầu tiên lỗi hoặc không thành công
            if (!res || !res.ok) {
              const resV2 = await fetch(`https://api-pre-my.vnpost.vn/myvnp-web/v1/OrderHdr/searchAllByParamV2?page=${page}&size=${size}`, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload)
              }).catch(() => null);
              if (resV2 && resV2.ok) {
                res = resV2;
              }
            }

            if (!res || !res.ok) {
              sendResponse({
                success: false,
                status: res?.status,
                error: res?.status === 401 ? 'Phiên MyVNPost đã hết hạn. Vui lòng đăng nhập lại.' : `Lỗi HTTP ${res?.status || 'Network'}`
              });
              return;
            }

            const data = await res.json().catch(() => []);
            const totalCount = res.headers.get('x-total-count');
            const orders = Array.isArray(data) ? data : (data?.data || data?.content || []);

            sendResponse({
              success: true,
              orders,
              total: totalCount ? parseInt(totalCount, 10) : orders.length
            });
          } catch (err) {
            sendResponse({ success: false, error: err.message });
          }
        })();
        return true;
      }

      if (request.action === 'VNPOST_LOOKUP_SINGLE_VIA_WEB') {
        (async () => {
          try {
            const token = request.token || (typeof localStorage !== 'undefined' ? localStorage.getItem('accessToken') : '') || '';
            const code = String(request.code || '').trim();
            if (!code) {
              sendResponse({ success: false, error: 'Thiếu mã cần tra cứu.' });
              return;
            }
            if (!token) {
              sendResponse({ success: false, error: 'Chưa đăng nhập trên tab MyVNPost.' });
              return;
            }

            const authHeader = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
            const headers = {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': authHeader,
              'cApiKey': '19001111'
            };

            let rawOrder = null;

            // Chiến lược 1: Gọi endpoint tìm nhanh searchByOrderCodeOrItemCode (hỗ trợ cả query param và body)
            try {
              const res1 = await fetch(`https://api-pre-my.vnpost.vn/myvnp-web/v1/OrderHdr/searchByOrderCodeOrItemCode?searchValue=${encodeURIComponent(code)}`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ searchValue: code })
              });
              if (res1.ok) {
                const data1 = await res1.json().catch(() => null);
                const candidate = Array.isArray(data1) ? data1[0] : (data1?.data || data1);
                if (candidate && (candidate.itemCode || candidate.orderCode || candidate.orderHdrId)) {
                  rawOrder = candidate;
                }
              }
            } catch (_) {}

            // Chiến lược 2: Dự phòng gọi searchAllByParam với searchValue
            if (!rawOrder) {
              try {
                const res2 = await fetch(`https://api-pre-my.vnpost.vn/myvnp-web/v1/OrderHdr/searchAllByParam?page=0&size=10`, {
                  method: 'POST',
                  headers,
                  body: JSON.stringify({ searchValue: code, itemCode: code, orderCode: code })
                });
                if (res2.ok) {
                  const data2 = await res2.json().catch(() => null);
                  const list2 = Array.isArray(data2) ? data2 : (data2?.data || data2?.content || []);
                  if (list2.length > 0) {
                    rawOrder = list2.find(it => 
                      String(it.itemCode || '').toUpperCase() === code.toUpperCase() ||
                      String(it.orderCode || '').toUpperCase() === code.toUpperCase()
                    ) || list2[0];
                  }
                }
              } catch (_) {}
            }

            // Chiến lược 3: Dự phòng tìm qua searchAllByParamV2
            if (!rawOrder) {
              try {
                const res3 = await fetch(`https://api-pre-my.vnpost.vn/myvnp-web/v1/OrderHdr/searchAllByParamV2?page=0&size=10`, {
                  method: 'POST',
                  headers,
                  body: JSON.stringify({ searchValue: code, itemCode: code, orderCode: code })
                });
                if (res3.ok) {
                  const data3 = await res3.json().catch(() => null);
                  const list3 = Array.isArray(data3) ? data3 : (data3?.data || data3?.content || []);
                  if (list3.length > 0) {
                    rawOrder = list3.find(it => 
                      String(it.itemCode || '').toUpperCase() === code.toUpperCase() ||
                      String(it.orderCode || '').toUpperCase() === code.toUpperCase()
                    ) || list3[0];
                  }
                }
              } catch (_) {}
            }

            if (rawOrder) {
              sendResponse({
                success: true,
                order: rawOrder
              });
            } else {
              sendResponse({
                success: false,
                error: `Không tìm thấy đơn hàng "${code}" trên hệ thống MyVNPost.`
              });
            }
          } catch (err) {
            sendResponse({ success: false, error: err.message });
          }
        })();
        return true;
      }
      return false;
    });
  }
  // ─── TỰ ĐỘNG BẮT MÃ VẬN ĐƠN TRÊN TRANG ORDER TABLE CỦA J&T EXPRESS ───
  if (window.location.hostname.includes('jtexpress.vn')) {
    const scanJtOrderTablePage = async () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      const rows = document.querySelectorAll('tr, .el-table__row, table.el-table__body tr');
      if (!rows || rows.length === 0) return;

      const submitted = await OrderStorage.getSubmittedOrders().catch(() => []);
      if (!submitted || submitted.length === 0) return;

      const unassigned = submitted.filter(s => !s.trackingCode || s.trackingCode === '—' || s.trackingCode === '');
      if (unassigned.length === 0) return;

      rows.forEach(row => {
        const text = row.textContent || '';
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

          // BẢO VỆ BẤT BIẾN ĐỊNH DANH ĐƠN: Khi có mã đơn, chỉ mã đơn mới đủ quyền gán vận đơn
          const confidentMatch = normOrderCode ? orderCodeMatch : (phoneMatch && nameMatch);

          if (confidentMatch) {
            window.__processedWaybills = window.__processedWaybills || new Set();
            if (window.__processedWaybills.has(waybillCode)) return;
            window.__processedWaybills.add(waybillCode);

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

    setInterval(scanJtOrderTablePage, 4000);
    setTimeout(() => onDOMReady(scanJtOrderTablePage), 2000);
  }

  // ─── TỰ ĐỘNG BẮT MÃ VẬN ĐƠN TRÊN TRANG ORDER MANAGER CỦA VNPOST ───
  if (window.location.hostname.includes('vnpost.vn')) {
    const scanVnpostOrderManagerPage = async () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      const rows = document.querySelectorAll('tr, .ant-table-row, .order-item, .item-order');
      if (!rows || rows.length === 0) return;

      const submitted = await OrderStorage.getSubmittedOrders().catch(() => []);
      if (!submitted || submitted.length === 0) return;

      const unassigned = submitted.filter(s => !s.trackingCode || s.trackingCode === '—' || s.trackingCode === '');
      if (unassigned.length === 0) return;

      rows.forEach(row => {
        const text = row.textContent || '';
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
            window.__processedWaybills = window.__processedWaybills || new Set();
            if (window.__processedWaybills.has(waybillCode)) return;
            window.__processedWaybills.add(waybillCode);

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

    setInterval(scanVnpostOrderManagerPage, 5000);
    setTimeout(() => onDOMReady(scanVnpostOrderManagerPage), 2500);
  }

  // ─── HELPER KIỂM TRA PHẦN TỬ THUỘC KHU VỰC NGƯỜI GỬI / KHO GỬI ───
  function isSenderElement(el) {
    if (!el) return false;
    // 1. Kiểm tra chính phần tử hoặc bất kỳ container cha nào có id/class/name/data-field chứa sender/nguoigui/warehouse/pickup/from
    const senderContainer = el.closest(`
      [id*="sender" i], [class*="sender" i], [name*="sender" i], [data-field*="sender" i],
      [id*="nguoigui" i], [class*="nguoigui" i], [name*="nguoigui" i],
      [id*="pickup" i], [class*="pickup" i], [id*="warehouse" i], [class*="warehouse" i]
    `);
    if (senderContainer && !senderContainer.querySelector('[id*="receiver" i], [name*="receiver" i]')) {
      return true;
    }

    const id = (el.id || '').toLowerCase();
    const nm = (el.name || '').toLowerCase();
    const ph = (el.placeholder || '').toLowerCase();
    if (id.includes('sender') || nm.includes('sender') || id.includes('nguoigui') || nm.includes('nguoigui') || ph.includes('người gửi') || ph.includes('kho gửi') || ph.includes('kho lấy')) return true;

    const formItem = el.closest('.ant-form-item, .el-form-item, .form-group');
    if (formItem) {
      const itemLabel = (formItem.querySelector('label, .ant-form-item-label')?.innerText || '').toLowerCase();
      if ((itemLabel.includes('người gửi') || itemLabel.includes('kho gửi') || itemLabel.includes('bưu cục gửi') || itemLabel.includes('kho lấy') || itemLabel.includes('địa chỉ gửi')) && !itemLabel.includes('người nhận')) {
        return true;
      }
      const html = formItem.innerHTML || '';
      if (html.includes('sender') && !html.includes('receiver')) return true;
    }

    const card = el.closest('.ant-card, .el-card, [class*="card" i], section, [class*="section" i], fieldset');
    if (card && card.tagName !== 'FORM' && card.id !== 'form-create-order') {
      const headText = (card.querySelector('.ant-card-head, .ant-card-header, [class*="head" i], [class*="title" i], h3, h4, legend')?.innerText || card.innerText.slice(0, 150)).toLowerCase();
      if ((headText.includes('người gửi') || headText.includes('thông tin gửi') || headText.includes('kho gửi') || headText.includes('bưu cục gửi') || headText.includes('kho lấy')) && !headText.includes('người nhận')) {
        return true;
      }
    }
    return false;
  }

  // ─── HELPER KIỂM TRA ĐỊA CHỈ CÓ PHẢI LÀ ĐỊA CHỈ NGƯỜI GỬI / KHO GỬI ───
  function isSenderAddress(addr) {
    if (!addr || typeof addr !== 'string') return false;
    const clean = addr.toLowerCase().trim();
    if (clean.length < 3) return false;
    if (clean === 'không tìm thấy' || clean === 'null' || clean === 'chưa có') return true;

    try {
      // 1. Quét các trường địa chỉ người gửi / kho gửi trên trang
      const senderAddressEls = document.querySelectorAll(`
        #form-create-order_senderAddress, [id*="senderAddress" i], [name*="senderAddress" i],
        [class*="sender" i] .ant-select-selection-item, [id*="sender" i] .ant-select-selection-item,
        [class*="sender" i] textarea, [class*="sender" i] input,
        [class*="warehouse" i] .ant-select-selection-item, [id*="warehouse" i] .ant-select-selection-item,
        [class*="pickup" i] .ant-select-selection-item, [id*="pickup" i] .ant-select-selection-item
      `);
      const senderParts = Array.from(senderAddressEls)
        .map(el => (el.value || el.innerText || '').trim().toLowerCase())
        .filter(t => t && t.length >= 3 && !/chọn|tất cả|vui lòng/i.test(t));

      // Quét thêm tên người gửi nếu có
      const senderNameEl = document.querySelector('#form-create-order_senderName, [id*="senderName" i], [name*="senderName" i]');
      const senderName = (senderNameEl?.value || senderNameEl?.innerText || '').trim().toLowerCase();
      if (senderName && senderName.length >= 3 && clean.includes(senderName)) {
        return true;
      }

      if (senderParts.length > 0) {
        const matchedParts = senderParts.filter(p => clean.includes(p));
        // Nếu địa chỉ chỉ chứa các phần tử của kho gửi mà không có số nhà/tên đường
        if (matchedParts.length >= 2 && clean.length <= 80) {
          return true;
        }
        if (senderParts.some(p => p.length >= 8 && clean === p)) {
          return true;
        }
      }
    } catch (_) {}
    return false;
  }

  // ─── TÁCH HÀM SCRAPE DOM RA PHẠM VI TOÀN CỤC ĐỂ TÁI SỬ DỤNG ───
  function scrapeOrderFromDOM(plat) {
    let name = '', phone = '', address = '', orderCode = '', codAmount = 0, hasValidCodField = false, collectFee = false, carrierAccount = '', productItem = '', extraNote = '', weight = 0;
    try {
      const platId = typeof plat === 'object' && plat ? plat.id : (plat || (typeof getCurrentPlatform === 'function' ? (getCurrentPlatform()?.id || getCurrentPlatform()) : 'vnpost'));
      carrierAccount = detectCarrierAccount(platId);

      if (platId === 'vnpost') {
        const sel = globalThis.VNPOST_SELECTORS || {};

        // 1. Số điện thoại người nhận
        let phoneEl = document.querySelector('#form-create-order_receiverPhone') ||
                      document.querySelector('input#receiverPhone') ||
                      document.querySelector('input[placeholder*="SĐT" i]') ||
                      document.querySelector('input[placeholder*="Số điện thoại" i]') ||
                      document.querySelector('input[type="tel"]');
        if (phoneEl && isSenderElement(phoneEl)) phoneEl = null;
        if (!phoneEl && globalThis.findFieldInput) {
          const cand = globalThis.findFieldInput(sel.phoneLabels, sel.phoneFallbacks);
          if (cand && !isSenderElement(cand)) phoneEl = cand;
        }
        if (phoneEl && phoneEl.value) phone = phoneEl.value.trim();

        // 2. Tên người nhận
        let nameEl = document.querySelector('#form-create-order_receiverName') ||
                     document.querySelector('input#receiverName') ||
                     document.querySelector('input[placeholder*="Tên người nhận" i]') ||
                     document.querySelector('input[placeholder*="Họ và tên người nhận" i]') ||
                     document.querySelector('input[placeholder*="Họ tên" i]') ||
                     document.querySelector('input[placeholder*="Tên" i]');
        if (nameEl && isSenderElement(nameEl)) nameEl = null;
        if (!nameEl && globalThis.findFieldInput) {
          const cand = globalThis.findFieldInput(sel.nameLabels, sel.nameFallbacks);
          if (cand && !isSenderElement(cand)) nameEl = cand;
        }
        if (nameEl && nameEl.value) name = nameEl.value.trim();

        // Xác định Card / Vùng chứa thông tin người nhận để cô lập phạm vi quét
        const receiverCard = (phoneEl || nameEl)?.closest('.ant-card, [class*="receiver" i]') ||
          Array.from(document.querySelectorAll('.ant-card, [class*="card" i], section, [class*="section" i]')).find(c => {
            const headText = (c.querySelector('.ant-card-head, .ant-card-header, [class*="head" i], [class*="title" i], h3, h4')?.innerText || c.innerText.slice(0, 150)).toLowerCase();
            return (headText.includes('người nhận') || headText.includes('nhận hàng')) && !headText.includes('người gửi');
          });

        // 3. Địa chỉ người nhận (quét input, textarea và các dropdown chọn Tỉnh/Quận/Phường trên VNPost)
        let addrEl = document.querySelector('#form-create-order_receiverAddress') ||
                     document.querySelector('input#form-create-order_receiverAddress') ||
                     document.querySelector('input#receiverAddress') ||
                     document.querySelector('textarea#receiverAddress');

        if (!addrEl && receiverCard) {
          addrEl = receiverCard.querySelector('input[placeholder*="Địa chỉ chi tiết" i], textarea[placeholder*="Địa chỉ chi tiết" i], input[placeholder*="Số nhà" i], textarea[placeholder*="Số nhà" i], input[placeholder*="Địa chỉ" i], textarea[placeholder*="Địa chỉ" i]');
        }

        if (!addrEl) {
          const addrCandidates = Array.from(document.querySelectorAll('textarea, input')).filter(el => {
            if (el.type === 'hidden' || el.type === 'radio' || el.type === 'checkbox' || el.disabled) return false;
            if (isSenderElement(el)) return false;
            const ph = (el.placeholder || '').toLowerCase();
            const nm = (el.name || '').toLowerCase();
            const id = (el.id || '').toLowerCase();
            const lbl = (el.closest('.ant-form-item')?.querySelector('label')?.innerText || '').toLowerCase();
            return (
              id.includes('receiveraddress') || nm.includes('receiveraddress') ||
              ph.includes('địa chỉ chi tiết') || ph.includes('số nhà') || ph.includes('địa chỉ') ||
              lbl.includes('địa chỉ chi tiết') || lbl.includes('địa chỉ mới') || lbl.includes('địa chỉ cũ') || lbl.includes('địa chỉ')
            );
          });

          if (addrCandidates.length > 0) {
            addrEl = (receiverCard && addrCandidates.find(el => receiverCard.contains(el))) ||
                     addrCandidates.find(el => !isSenderElement(el)) ||
                     null;
          }
        }

        if (!addrEl && globalThis.findFieldInput) {
          const cand = globalThis.findFieldInput(sel.addressLabels, sel.addressFallbacks, true);
          if (cand && !isSenderElement(cand)) addrEl = cand;
        }

        if (addrEl && isSenderElement(addrEl)) addrEl = null;

        if (addrEl && addrEl.value && addrEl.value.trim()) {
          address = addrEl.value.trim();
        }

        // Lấy thêm các cấp hành chính đã chọn từ dropdowns CHỈ TRONG KHU VỰC NGƯỜI NHẬN
        // Tuyệt đối không fallback quét cả form vì sẽ dính Tỉnh/Xã kho người gửi!
        try {
          const receiverContainer = receiverCard || addrEl?.closest('.ant-card, [class*="receiver" i]') || phoneEl?.closest('.ant-card, [class*="receiver" i]');
          const selectItems = receiverContainer
            ? Array.from(receiverContainer.querySelectorAll('.ant-select-selection-item, .ant-select-selection-selected-value, .ant-cascader-picker-label')).filter(el => !isSenderElement(el))
            : Array.from(document.querySelectorAll('[id*="receiver" i] .ant-select-selection-item, [class*="receiver" i] .ant-select-selection-item')).filter(el => !isSenderElement(el));

          const selectedParts = selectItems
            .map(el => (el.innerText || el.textContent || '').trim())
            .filter(t => t && !/chọn|tất cả|đơn hàng mẫu|loại hàng|vui lòng/i.test(t) && (t.includes('TP.') || t.includes('Tỉnh') || t.includes('Quận') || t.includes('Huyện') || t.includes('Phường') || t.includes('Xã') || t.includes('Thị trấn') || t.startsWith('P.') || t.startsWith('Q.') || t.startsWith('H.')));
          
          if (selectedParts.length > 0) {
            selectedParts.forEach(part => {
              if (address && !address.toLowerCase().includes(part.toLowerCase())) {
                address += ', ' + part;
              } else if (!address) {
                address = part;
              }
            });
          }
        } catch (_) {}

        // Kiểm tra an toàn: Nếu địa chỉ vừa quét dính địa chỉ kho gửi -> loại bỏ ngay
        if (isSenderAddress(address)) {
          console.warn('[scrapeOrderFromDOM] Phát hiện địa chỉ quét được trùng với địa chỉ người gửi, loại bỏ:', address);
          address = '';
        }

        // 4. Mã đơn hàng của Shop (Trực tiếp từ ô nhập trên VNPost)
        let orderCodeEl = document.querySelector('#form-create-order_customerOrderCode') ||
                          document.querySelector('#form-create-order_orderCode') ||
                          document.querySelector('input#customerOrderCode') ||
                          document.querySelector('input#orderCode');
        if (!orderCodeEl) {
          const candidates = document.querySelectorAll('input[placeholder*="mã đơn" i], input[placeholder*="Mã đơn" i], input[placeholder*="Mã khách hàng" i]');
          for (const cand of candidates) {
            if (!cand.closest('header, .header, .topbar, .ant-layout-header, .search-box, .search-container, [class*="search" i]')) {
              orderCodeEl = cand;
              break;
            }
          }
        }
        if (orderCodeEl && orderCodeEl.value && orderCodeEl.value.trim()) {
          orderCode = orderCodeEl.value.trim();
        }

        // 5. Tên hàng hóa / Nội dung hàng hóa
        const goodsEl = document.querySelector('#form-create-order_goodsName') ||
                        document.querySelector('#form-create-order_itemName') ||
                        document.querySelector('#form-create-order_productName') ||
                        document.querySelector('input[placeholder*="tên hàng" i]') ||
                        document.querySelector('input[placeholder*="Tên hàng" i]') ||
                        document.querySelector('input[placeholder*="nội dung hàng" i]') ||
                        document.querySelector('input[placeholder*="Nội dung hàng" i]') ||
                        document.querySelector('textarea[placeholder*="nội dung hàng" i]');
        if (goodsEl && goodsEl.value && goodsEl.value.trim()) {
          productItem = goodsEl.value.trim();
          // Nếu chưa có orderCode mà ô nội dung/hàng hóa có mã (vd: E80.290 hoặc Mã: ...)
          if (!orderCode) {
            const match = productItem.match(/(?:mã|đơn|đh|dh)[:\s\-]*([A-Za-z0-9.\-_]{2,25})/i) ||
                          productItem.match(/\b([A-Za-z][0-9]{1,4}[\.-][0-9]{1,6}|DH[-_]?[0-9]{3,10}|[A-Za-z]{1,5}[-_]?[0-9]{2,10})\b/i);
            if (match && match[1]) orderCode = match[1].trim();
          }
        }

        // 6. Ghi chú chuyển phát
        const noteEl = document.querySelector('#form-create-order_receiverNote') ||
                       document.querySelector('#form-create-order_note') ||
                       document.querySelector('textarea#receiverNote') ||
                       document.querySelector('textarea[placeholder*="Ghi chú" i]') ||
                       (globalThis.findFieldInput ? globalThis.findFieldInput(sel.noteLabels, sel.noteFallbacks, true) : null);
        if (noteEl && noteEl.value && noteEl.value.trim()) {
          extraNote = noteEl.value.trim();
          if (!orderCode) {
            const match = extraNote.match(/(?:mã\s*đơn|đơn\s*hàng|mã|đh|dh)[:\s\-]*([A-Za-z0-9.\-_]{2,25})/i) ||
                          extraNote.match(/\b([A-Za-z][0-9]{1,4}[\.-][0-9]{1,6}|DH[-_]?[0-9]{3,10})\b/i);
            if (match && match[1]) orderCode = match[1].trim();
          }
        }

        // 7. Tiền thu hộ COD - Tuyệt đối không dùng selector toàn trang kiểu input.ant-input-number-input
        let codEl = document.querySelector('input[name="PROP0018"]');
        if (!codEl) {
          const codRows = Array.from(document.querySelectorAll('tr.g-tr, tr, [role="row"], .ant-table-row'));
          const targetRow = codRows.find(row => {
            const t = (row.innerText || row.textContent || '').toLowerCase();
            return (t.includes('phát hàng thu tiền') || t.includes('thu tiền cod') || t.includes('tiền thu hộ') || t.includes('thu hộ (cod)')) && !t.includes('hủy');
          });
          if (targetRow) {
            codEl = targetRow.querySelector('input[name="PROP0018"], input.ant-input-number-input, input[role="spinbutton"], input:not([type="checkbox"]):not([type="hidden"])');
          }
        }
        if (!codEl) {
          const codLabels = Array.from(document.querySelectorAll('label, .ant-form-item-label, span, b, div')).filter(l => {
            const t = (l.innerText || l.textContent || '').trim().toLowerCase();
            return (t.includes('phát hàng thu tiền') || t.includes('thu tiền cod') || t.includes('tiền thu hộ') || t.includes('thu hộ (cod)')) && !t.includes('hủy');
          });
          for (const lbl of codLabels) {
            const container = lbl.closest('.ant-form-item, tr, .ant-row, .form-item') || lbl.parentElement;
            if (container) {
              const inp = container.querySelector('input[name="PROP0018"], input.ant-input-number-input, input[role="spinbutton"], input:not([type="checkbox"]):not([type="hidden"])');
              if (inp) { codEl = inp; break; }
            }
          }
        }
        if (codEl && codEl.value !== undefined && codEl.value !== null && String(codEl.value).trim() !== '') {
          hasValidCodField = true;
          codAmount = parseInt(String(codEl.value).replace(/\D/g, ''), 10) || 0;
        }

        const shipFeeBox = document.querySelector('input#collectFee') || 
                           document.querySelector('input[name="collectFee"]') || 
                           document.querySelector('input#form-create-order_collectFee') ||
                           document.querySelector('input[type="checkbox"][name*="collect" i]') ||
                           document.querySelector('input[type="checkbox"][id*="collect" i]');
        if (shipFeeBox) collectFee = !!shipFeeBox.checked;

        // 9. Cân nặng (khối lượng)
        let weightEl = document.querySelector('#form-create-order_weight') ||
                       document.querySelector('#form-create-order_totalWeight') ||
                       document.querySelector('input#weight') ||
                       document.querySelector('input#totalWeight') ||
                       document.querySelector('input[name="weight"]') ||
                       document.querySelector('input[name="totalWeight"]') ||
                       document.querySelector('input[placeholder*="khối lượng" i]') ||
                       document.querySelector('input[placeholder*="Khối lượng" i]');
        if (!weightEl) {
          const labels = Array.from(document.querySelectorAll('label, .ant-form-item-label, span, b')).filter(l => {
            const t = (l.innerText || l.textContent || '').trim().toLowerCase();
            return (t.includes('tổng khối lượng') || t.includes('khối lượng')) && !t.includes('tính cước') && !t.includes('quy đổi');
          });
          for (const lbl of labels) {
            const container = lbl.closest('.ant-form-item, .ant-row, .form-item') || lbl.parentElement?.parentElement;
            if (container) {
              const inp = container.querySelector('input.ant-input-number-input, input[role="spinbutton"], input');
              if (inp) { weightEl = inp; break; }
            }
          }
        }
        if (weightEl && weightEl.value) {
          weight = parseInt(weightEl.value.replace(/\D/g, ''), 10) || 0;
        }

      } else if (platId === 'jt') {
        let phoneEl = document.querySelector('input[placeholder*="số điện thoại người nhận" i]') ||
                      document.querySelector('input[placeholder*="số điện thoại" i]');
        if (phoneEl && isSenderElement(phoneEl)) phoneEl = null;

        let nameEl = document.querySelector('input[placeholder*="tên người nhận" i]') ||
                     document.querySelector('input[placeholder*="họ tên người nhận" i]');
        if (nameEl && isSenderElement(nameEl)) nameEl = null;

        const jtReceiverSection = (phoneEl || nameEl)?.closest('.el-card, .el-form, [class*="receiver" i], .card') ||
          Array.from(document.querySelectorAll('.el-card, .card')).find(c => {
            const t = (c.innerText || '').toLowerCase();
            return (t.includes('người nhận') || t.includes('nhận hàng')) && !t.includes('người gửi');
          });

        let addrEl = (jtReceiverSection && jtReceiverSection.querySelector('input[placeholder*="địa chỉ" i], textarea[placeholder*="địa chỉ" i], input[placeholder*="Số nhà" i], textarea[placeholder*="Số nhà" i]')) ||
                     document.querySelector('input[placeholder*="địa chỉ" i]') || 
                     document.querySelector('textarea[placeholder*="địa chỉ" i]') ||
                     document.querySelector('input[placeholder*="Số nhà/ đường/ ngõ"]') ||
                     document.querySelector('textarea[placeholder*="Số nhà/ đường/ ngõ"]');
        if (addrEl && isSenderElement(addrEl)) addrEl = null;

        if (!addrEl) {
          const jtCandidates = Array.from(document.querySelectorAll('input, textarea')).filter(el => {
            if (el.type === 'hidden' || el.type === 'radio' || el.type === 'checkbox' || el.disabled) return false;
            if (isSenderElement(el)) return false;
            const ph = (el.placeholder || '').toLowerCase();
            const lbl = (el.closest('.el-form-item')?.querySelector('label')?.innerText || '').toLowerCase();
            return ph.includes('địa chỉ') || ph.includes('số nhà') || lbl.includes('địa chỉ');
          });
          if (jtCandidates.length > 0) addrEl = (jtReceiverSection && jtCandidates.find(el => jtReceiverSection.contains(el))) || jtCandidates[0];
        }
        
        let orderCodeEl = null;
        const jtCandidates = document.querySelectorAll('input[placeholder*="Mã đơn" i], input[placeholder*="Mã tham chiếu" i]');
        for (const cand of jtCandidates) {
          if (!cand.closest('header, .header, .topbar, .ant-layout-header, .search-box, .search-container, [class*="search" i]')) {
            orderCodeEl = cand;
            break;
          }
        }
        
        const goodsInp = document.querySelector('textarea[placeholder*="tên sản phẩm" i]') || document.querySelector('input[placeholder*="tên sản phẩm" i]');
        
        let codInp = document.querySelector('input[placeholder*="Nhập số tiền" i]') || document.querySelector('#money');
        if (!codInp) {
          document.querySelectorAll('.el-form-item').forEach(item => {
            const labelText = (item.innerText || '').trim();
            if (labelText.includes('Tiền thu hộ') && !labelText.includes('Phí')) {
              const el = item.querySelector('input:not([type="hidden"])');
              if (el) codInp = el;
            }
          });
        }

        if (phoneEl && phoneEl.value) phone = phoneEl.value.trim();
        if (nameEl && nameEl.value) name = nameEl.value.trim();
        if (addrEl && addrEl.value && addrEl.value.trim()) address = addrEl.value.trim();
        if (orderCodeEl && orderCodeEl.value) orderCode = orderCodeEl.value.trim();
        if (goodsInp && goodsInp.value) productItem = goodsInp.value.trim();
        if (codInp && codInp.value !== undefined && codInp.value !== null && String(codInp.value).trim() !== '') {
          hasValidCodField = true;
          codAmount = parseInt(String(codInp.value).replace(/\D/g, ''), 10) || 0;
        }

        // Lấy các cấp Tỉnh/Thành, Quận/Huyện, Phường/Xã từ cascader / select của J&T CHỈ TRONG KHU VỰC NGƯỜI NHẬN
        try {
          const jtScope = jtReceiverSection || (addrEl?.closest('.el-card, .el-form, [class*="receiver" i]'));
          if (jtScope) {
            const cascaderEl = jtScope.querySelector('.el-cascader__label, .el-cascader input, .el-select__selected-item');
            if (cascaderEl && !isSenderElement(cascaderEl)) {
              const cascText = (cascaderEl.value || cascaderEl.innerText || cascaderEl.textContent || '').trim();
              if (cascText && !/chọn|vui lòng/i.test(cascText)) {
                if (address && !address.toLowerCase().includes(cascText.toLowerCase())) {
                  address += ', ' + cascText;
                } else if (!address) {
                  address = cascText;
                }
              }
            }
          }
        } catch (_) {}

        // Trọng lượng J&T (tính bằng kg, hỗ trợ số thực thập phân như 0.5, 0.2, 1.5)
        const weightInp = document.querySelector('input[placeholder*="trọng lượng" i]') || 
                          document.querySelector('input[placeholder*="Trọng lượng" i]') ||
                          document.querySelector('#weight');
        if (weightInp && weightInp.value !== undefined && weightInp.value !== null && String(weightInp.value).trim() !== '') {
          const rawWeight = String(weightInp.value).trim().replace(',', '.');
          const m = rawWeight.match(/\d+(?:\.\d+)?/);
          if (m) {
            weight = parseFloat(m[0]) || 0;
          }
        }

        // Ghi chú / Nội dung hàng hóa J&T
        let noteEl = null;
        document.querySelectorAll('.el-form-item').forEach(item => {
          const label = item.querySelector('.el-form-item__label');
          const labelText = (label ? label.innerText : item.innerText || '').trim();
          if (/Nội dung|Ghi chú|Lưu ý/i.test(labelText)) {
            const el = item.querySelector('textarea') || item.querySelector('input');
            if (el && !isSenderElement(el)) noteEl = el;
          }
        });
        if (!noteEl) {
          noteEl = document.querySelector('textarea[placeholder*="ghi chú" i]') ||
                   document.querySelector('input[placeholder*="ghi chú" i]') ||
                   document.querySelector('textarea[placeholder*="nội dung" i]') ||
                   document.querySelector('textarea[placeholder*="lưu ý" i]');
        }
        if (noteEl && noteEl.value && noteEl.value.trim()) {
          extraNote = noteEl.value.trim();
        }

        // Nếu trên J&T không có ô ghi chú riêng hoặc ô ghi chú trống, nhưng ghi chú đã được ghép vào ô Tên hàng hóa (productItem)
        if (!extraNote && productItem && productItem.includes('|')) {
          const parts = productItem.split('|').map(s => s.trim()).filter(Boolean);
          if (parts.length > 1) {
            extraNote = parts.slice(1).join(' | ');
          }
        }
      }
    } catch (e) {
      console.warn('Lỗi khi cào dữ liệu từ DOM:', e);
    }
    return { name, phone, address, orderCode, productItem, extraNote, codAmount, hasValidCodField, collectFee, carrierAccount, weight };
  }

  // ─── NHÚNG INTERCEPTOR VÀ LẮNG NGHE TẠO ĐƠN (GÕ TAY) ───
  function injectInterceptor() {
    try {
      if (document.getElementById('af-interceptor-script')) return;
      if (!window.location.hostname.includes('vnpost.vn') && !window.location.hostname.includes('jtexpress.vn')) return;

      const script = document.createElement('script');
      script.id = 'af-interceptor-script';
      script.src = chrome.runtime.getURL('interceptor.js');
      script.onload = () => { console.log('[Auto Fill] Interceptor injected.'); };
      (document.head || document.documentElement).appendChild(script);

      function isCarrierTrackingCode(code) {
        if (!code) return false;
        const s = String(code).trim();
        if (s.toUpperCase().startsWith('DH')) return false;
        
        // VNPost tracking code patterns
        const vnpostRegex = /^[A-Z]{2}\d{9,13}VN$/i;
        const vnpostRegex2 = /^C\d{9,13}VN$/i;
        const vnpostRegex3 = /^MP\d{8,12}VN$/i;
        
        // J&T tracking code patterns
        const jtRegex = /^8\d{11,14}$/i;
        const jtRegex2 = /^jt\d{10,14}$/i;
        
        return vnpostRegex.test(s) || vnpostRegex2.test(s) || vnpostRegex3.test(s) || jtRegex.test(s) || jtRegex2.test(s);
      }

      window.addEventListener('message', (event) => {
        if (event.source !== window || !event.data || event.data.type !== 'AF_ORDER_CREATED') return;
        
        console.log('[Auto Fill] Nhận sự kiện tạo đơn từ Interceptor!', event.data);
        const rawTrack = event.data.trackingCode;
        const trackingCode = (rawTrack && isCarrierTrackingCode(rawTrack)) ? String(rawTrack).trim() : '';

        // BẢO VỆ BẤT BIẾN: Chỉ ghi nhận từ Interceptor khi CÓ MÃ VẬN ĐƠN HỢP LỆ từ hãng!
        // Tuyệt đối không tự động tạo đơn ảo/đơn khống khi chưa có mã vận đơn xác nhận từ hãng.
        if (!trackingCode || !isCarrierTrackingCode(trackingCode)) {
          console.log('[Auto Fill] Bỏ qua sự kiện AF_ORDER_CREATED vì không có mã vận đơn thực tế.');
          return;
        }

        const platform = getCurrentPlatform();
        if (!platform) return;

        // Cào thông tin đơn từ form trang
        const data = scrapeOrderFromDOM(platform);
        const parsed = globalThis.parsedDataStore || globalThis.__AF_LAST_APPROVED_ORDER__ || globalThis.__AF_LAST_FILLED_ORDER__;
        const payload = event.data.payloadDetails;

        if (isSenderAddress(data.address)) {
          console.warn('[AF_ORDER_CREATED] data.address từ DOM trùng địa chỉ người gửi, loại bỏ:', data.address);
          data.address = '';
        }

        // Bổ sung thông tin từ payload (trích xuất trực tiếp từ request POST của bưu điện)
        if (payload) {
          if (!data.name && payload.receiverName) data.name = payload.receiverName;
          if (!data.phone && payload.receiverPhone) data.phone = payload.receiverPhone;
          if ((!data.address || isSenderAddress(data.address)) && payload.receiverAddress && !isSenderAddress(payload.receiverAddress)) {
            data.address = payload.receiverAddress;
          }
          if (!data.orderCode && payload.orderCode) data.orderCode = payload.orderCode;
          if ((!data.codAmount || data.codAmount === 0) && payload.codAmount) data.codAmount = payload.codAmount;
        }
        
        if (parsed) {
          if (!data.name) data.name = parsed.name || '';
          if (!data.phone) data.phone = parsed.phone || '';
          
          const parsedAddr = (parsed.address && parsed.address !== 'không tìm thấy') ? parsed.address.trim() : '';
          if (parsedAddr && !isSenderAddress(parsedAddr)) {
            if (!data.address || data.address === 'không tìm thấy' || isSenderAddress(data.address)) {
              data.address = parsedAddr;
            } else if (parsedAddr.length > data.address.length && (!data.address.includes(' ') || data.address.split(',').length <= 2)) {
              data.address = parsedAddr;
            }
          }
          
          if (!data.orderCode) data.orderCode = parsed.orderCode || '';
          if (!data.codAmount) data.codAmount = parsed.codAmount || 0;
          if (!data.collectFee) data.collectFee = parsed.collectFee || false;
          data.extraNote = data.extraNote || parsed.extraNote || '';
          if (parsed.id) data.id = parsed.id;
        }

        const { name, phone, address, orderCode } = data;
        const cleanName = (name || payload?.receiverName || '').trim();
        const cleanPhone = (phone || payload?.receiverPhone || '').replace(/\D/g, '');
        const hasValidCustomer = (cleanName && cleanName !== '—' && cleanName.length >= 2) || (cleanPhone && cleanPhone.length >= 9);

        // Kiểm tra xem đơn này vừa được xử lý gần đây chưa (tránh trùng lặp với autofill onSuccess)
        if (isSubmissionRecentlyHandled(trackingCode, orderCode, cleanPhone, cleanName)) {
          console.log('[Auto Fill] Đơn đã được ghi nhận trước đó, chỉ cập nhật mã vận đơn nếu cần:', trackingCode);
          if (trackingCode) {
            OrderStorage.updateLatestSubmittedOrderTracking(trackingCode).catch(() => {});
          }
          return;
        }

        // Nếu không có thông tin khách hàng hợp lệ mà có mã vận đơn -> chỉ cập nhật đơn gần nhất
        if (!hasValidCustomer) {
          if (trackingCode) {
            OrderStorage.updateLatestSubmittedOrderTracking(trackingCode).then(ok => {
              if (ok) showVnpostToast('📦 Đã cập nhật mã vận đơn: ' + trackingCode, 'success');
            });
          }
          return;
        }

        // Kiểm tra phiên đăng nhập / kích hoạt Shop Key
        chrome.storage.local.get(['vnpost_session', 'staff_name', 'shop_access_key', 'device_id', 'pending_offline_orders'], (storageRes) => {
          const session = storageRes?.vnpost_session;
          const staffName = storageRes?.staff_name || session?.staff_name || session?.user?.full_name || 'Nhân viên kho';
          const deviceId = storageRes?.device_id || session?.device_id || '';

          const cleanPanelPhone = String(globalThis.parsedDataStore?.phone || globalThis.__AF_LAST_FILLED_ORDER__?.phone || '').replace(/\D/g, '');
          const cleanPanelOrderCode = String(globalThis.parsedDataStore?.orderCode || globalThis.__AF_LAST_FILLED_ORDER__?.orderCode || '').trim().toLowerCase();

          const isAutoFilled = Boolean(
            globalThis.__AF_JUST_FILLED__ ||
            (cleanPhone && cleanPanelPhone && cleanPhone.length >= 9 && cleanPhone === cleanPanelPhone) ||
            (orderCode && cleanPanelOrderCode && orderCode !== '—' && orderCode.toLowerCase() === cleanPanelOrderCode)
          );
          const orderSource = isAutoFilled ? 'AUTO_FILL' : 'MANUAL_ENTRY';

          let finalAddress = '';
          const payloadAddr = (payload?.receiverAddress && !isSenderAddress(payload.receiverAddress)) ? payload.receiverAddress.trim() : '';
          const parsedAddr = (parsed?.address && parsed.address !== 'không tìm thấy' && !isSenderAddress(parsed.address)) ? parsed.address.trim() : '';
          const domAddr = (data.address && data.address !== 'không tìm thấy' && !isSenderAddress(data.address)) ? data.address.trim() : '';

          if (domAddr && domAddr.length > 5 && domAddr.split(',').length >= 3) {
            finalAddress = domAddr;
          } else if (payloadAddr) {
            finalAddress = payloadAddr;
          } else if (parsedAddr) {
            finalAddress = parsedAddr;
          } else if (domAddr) {
            finalAddress = domAddr;
          } else if (address && !isSenderAddress(address)) {
            finalAddress = address.trim();
          }

          const draftId = parsed?.id || data.id || null;

          // Trích xuất thông tin Người gửi (Tài khoản VNPost được lên đơn)
          let vnpostSenderInfo = null;
          if (globalThis.VNPOST_SELECTORS && typeof globalThis.VNPOST_SELECTORS.getSenderInfo === 'function') {
            vnpostSenderInfo = globalThis.VNPOST_SELECTORS.getSenderInfo();
          }

          const capturedSenderName = payload?.senderName || vnpostSenderInfo?.name || data.carrierAccount || detectCarrierAccount(platform) || '';
          const capturedSenderPhone = payload?.senderPhone || vnpostSenderInfo?.phone || '';
          const capturedSenderAddress = payload?.senderAddress || vnpostSenderInfo?.address || '';

          const submittedOrder = {
            name: cleanName || '',
            phone: cleanPhone || '',
            address: finalAddress,
            orderCode: orderCode || '',
            codAmount: data.codAmount !== undefined && data.codAmount > 0 ? data.codAmount : 0,
            collectFee: data.collectFee || false,
            platform: platform || '',
            carrierAccount: capturedSenderName || data.carrierAccount || detectCarrierAccount(platform) || '',
            senderName: capturedSenderName || '',
            senderPhone: capturedSenderPhone || '',
            senderAddress: capturedSenderAddress || '',
            extraNote: data.extraNote || '',
            productNote: data.productItem || '',
            weight: data.weight || 0,
            trackingCode: trackingCode || '',
            savedOrderId: draftId,
            source: orderSource,
            created_by_name: staffName,
            source_device_id: deviceId
          };

          // Tự động lưu thông tin tài khoản VNPost người gửi vào storage để trang in sử dụng
          if (capturedSenderName && typeof chrome !== 'undefined' && chrome.storage?.local) {
            chrome.storage.local.get(['carrier_accounts'], (accRes) => {
              const accounts = accRes?.carrier_accounts || {};
              const existing = accounts[capturedSenderName] || {};
              const updated = {
                name: capturedSenderName,
                phone: capturedSenderPhone || existing.phone || '',
                address: capturedSenderAddress || existing.address || '',
                carrier: 'vnpost',
                updatedAt: Date.now()
              };
              accounts[capturedSenderName] = updated;
              chrome.storage.local.set({
                carrier_account: capturedSenderName,
                carrier_accounts: accounts,
                last_vnpost_sender_info: updated
              });
            });
          }

          // Lưu thẳng vào Đơn đã gửi (submitted_orders), không lưu đơn nháp ảo
          OrderStorage.saveSubmittedOrder(submittedOrder).then((savedOrder) => {
            if (!savedOrder) throw new Error('Không thể lưu đơn đã lên do thiếu dữ liệu khách hàng');
            markSubmissionHandled(trackingCode, submittedOrder.orderCode);
            const sourceText = isAutoFilled ? '⚡ Tách đơn AI' : '✍️ Gõ tay thủ công';
            if (trackingCode) {
              showVnpostToast(`📦 Đã bắt đơn (${sourceText})! Mã vận đơn: ${trackingCode}`, 'success');
            } else {
              showVnpostToast(`✅ Đã ghi nhận đơn (${sourceText})! Đang chờ mã vận đơn...`, 'success');
              if (platform === 'vnpost') {
                startTrackingCodeMonitor(draftId || submittedOrder.id, platform);
              }
            }
            invalidateActiveAiSession('ORDER_SUBMITTED_INTERCEPTOR');
            window.dispatchEvent(new CustomEvent('order-saved-db'));
            globalThis.__AF_JUST_FILLED__ = false;
            if (typeof handleClearOrder === 'function') {
              handleClearOrder(true);
            }
          }).catch(e => console.error('Lỗi khi lưu tự động:', e));
        });

      });
    } catch (e) {
      console.warn('Lỗi inject interceptor:', e);
    }
  }

  // Tự động đẩy hàng đợi ngoại tuyến lên Cloud khi phát hiện Shop Key / Session
  function drainOfflineQueue() {
    try {
      if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;
      chrome.storage.local.get(['pending_offline_orders', 'vnpost_session', 'shop_access_key'], (res) => {
        const queue = res?.pending_offline_orders || [];
        const session = res?.vnpost_session;
        const shopKey = res?.shop_access_key || session?.shop_access_key;
        const shopId = session?.active_shop_id;

        if (queue.length > 0 && (shopId || shopKey)) {
          console.log(`[Auto Fill] Bắt đầu đồng bộ ${queue.length} đơn hàng từ Offline Queue...`);
          if (typeof OrderStorage !== 'undefined' && typeof OrderStorage.pushSubmittedOrderToCloud === 'function') {
            Promise.all(queue.map(order => OrderStorage.pushSubmittedOrderToCloud({ ...order, shopId: shopId || order.shopId })))
              .then(() => {
                chrome.storage.local.remove(['pending_offline_orders'], () => {
                  showVnpostToast(`🎉 Đã đồng bộ bù ${queue.length} đơn hàng ngoại tuyến lên Shop thành công!`, 'success');
                });
              })
              .catch(err => console.warn('[OfflineDrain] Lỗi đồng bộ bù:', err));
          }
        }
      });
    } catch (e) {}
  }

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local' && (changes['vnpost_session'] || changes['shop_access_key'])) {
        drainOfflineQueue();
      }
    });
  }

  // Tự động quét và đồng bộ thông tin người gửi / tài khoản bưu điện từ trang VNPost
  function autoSyncVnpostSenderInfo() {
    try {
      const plat = typeof getCurrentPlatform === 'function' ? getCurrentPlatform() : null;
      const platId = typeof plat === 'object' && plat ? plat.id : (plat || '');
      if (platId !== 'vnpost' && !window.location.hostname.includes('vnpost.vn')) return;

      if (!globalThis.VNPOST_SELECTORS || typeof globalThis.VNPOST_SELECTORS.getSenderInfo !== 'function') {
        return;
      }

      const info = globalThis.VNPOST_SELECTORS.getSenderInfo();
      if (!info || !info.name) return;

      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.get(['carrier_accounts'], (res) => {
          const accounts = res?.carrier_accounts || {};
          const existing = accounts[info.name] || {};
          const updated = {
            name: info.name,
            phone: info.phone || existing.phone || '',
            address: info.address || existing.address || '',
            carrier: 'vnpost',
            updatedAt: Date.now()
          };
          accounts[info.name] = updated;
          chrome.storage.local.set({
            carrier_account: info.name,
            carrier_accounts: accounts,
            last_vnpost_sender_info: updated
          }, () => {
            console.log('[Auto Fill] Đã tự động đồng bộ thông tin người gửi VNPost:', updated);
          });
        });
      }
    } catch (e) {
      console.warn('[Auto Fill] Lỗi autoSyncVnpostSenderInfo:', e);
    }
  }

  // Lắng nghe yêu cầu lấy thông tin người gửi từ PrintCenter / Extension
  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request && request.action === 'GET_VNPOST_SENDER_INFO') {
        try {
          const info = (globalThis.VNPOST_SELECTORS && typeof globalThis.VNPOST_SELECTORS.getSenderInfo === 'function')
            ? globalThis.VNPOST_SELECTORS.getSenderInfo()
            : { name: '', phone: '', address: '' };
          sendResponse({ success: true, info });
        } catch (err) {
          sendResponse({ success: false, error: err.message });
        }
        return true;
      }
    });
  }

  onDOMReady(() => {
    injectInterceptor();
    drainOfflineQueue();
    autoSyncVnpostSenderInfo();
    setTimeout(autoSyncVnpostSenderInfo, 2500);
    setTimeout(autoSyncVnpostSenderInfo, 6000);
  });

})();
