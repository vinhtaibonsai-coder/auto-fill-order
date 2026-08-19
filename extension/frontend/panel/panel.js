(() => {
  // =========================================================================
  // UI SHADOW DOM PANEL
  // =========================================================================

  const PANEL_ICONS = {
    theme: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/><circle cx="12" cy="12" r="4"/><path d="M12 2a10 10 0 0 0 10 10" fill="currentColor" opacity="0.3"/></svg>`,
    settings: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
    minimize: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
    maximize: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
    parse: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
    clear: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`,
    copy: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
    check: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    user: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
    phone: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
    orderCode: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/></svg>`,
    fee: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`,
    address: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-12a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
    package: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
    fill: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>`,
    save: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`,
    apiWaiting: `<svg class="spinner-loading" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`,
    apiWarning: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#eab308" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    apiOk: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    apiUnknown: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    warn: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  };

  function getVnpostPanelRoot() {
    if (typeof document === 'undefined') return null;
    const host = document.getElementById('vnpost-autofill-shadow-host');
    return (host && host.shadowRoot) ? host.shadowRoot : document;
  }

  function getVnpostEl(id) {
    const root = getVnpostPanelRoot();
    return root && root.getElementById ? root.getElementById(id) : null;
  }

  function normalizePlatform(p) {
    if (typeof p === 'string') {
      const id = p.toLowerCase();
      if (id.includes('vnpost')) return { id: 'vnpost', title: 'VNPost', themeColor: '#0056b3' };
      if (id.includes('jt')) return { id: 'jt', title: 'J&T Express', themeColor: '#e11d48' };
      return { id: id, title: id.toUpperCase(), themeColor: '#4f46e5' };
    }
    return p || { id: 'vnpost', title: 'VNPost', themeColor: '#0056b3' };
  }

  function createInputPanel(platform, onParseHandler, onFillHandler, onClearHandler, onAiAddressClickHandler, onSettingsClickHandler, onFieldEditHandler, onSaveHandler) {
    try {
      if (typeof document === 'undefined') return;
      const platformObj = normalizePlatform(platform);
      let host = document.getElementById('vnpost-autofill-shadow-host');
      const existingPanel = host ? getVnpostEl('vnpost-autofill-panel') : null;
      if (existingPanel) {
        if (existingPanel.dataset && existingPanel.dataset.panelType === 'login') {
          existingPanel.remove();
        } else {
          // Panel nhập đơn đã tồn tại trên trang -> Giữ nguyên tuyệt đối để không làm mất dữ liệu người dùng
          return;
        }
      }

      if (!document.body) return;

      if (!host) {
        host = document.createElement('div');
        host.id = 'vnpost-autofill-shadow-host';
        document.body.appendChild(host);
      }

      const root = host.shadowRoot || host.attachShadow({ mode: 'open' });
      const oldPanel = root.querySelector('#vnpost-autofill-panel');
      if (oldPanel) oldPanel.remove();

      if (!root.querySelector('#vnpost-shadow-style')) {
        const styleEl = document.createElement('style');
        styleEl.id = 'vnpost-shadow-style';
        styleEl.textContent = typeof PANEL_CSS !== 'undefined' ? PANEL_CSS : '';
        root.appendChild(styleEl);
      }

      const panel = document.createElement('div');
      panel.id = 'vnpost-autofill-panel';
      panel.dataset.panelType = 'input';
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id && chrome.storage && chrome.storage.local) {
        try {
          chrome.storage.local.get(['antigravity_ui_theme'], (res) => {
            if (chrome.runtime.lastError) return;
            if (!res || res.antigravity_ui_theme !== 'dark') {
              panel.classList.add('light-mode');
            } else {
              panel.classList.remove('light-mode');
            }
          });
        } catch (_) {}
      } else {
        panel.classList.add('light-mode');
      }
      const themeColor = platformObj.themeColor || (platformObj.id === "vnpost" ? "#0056b3" : "#4f46e5");
      panel.style.setProperty('--theme-color', themeColor);

      const isVNPost = platformObj.id === "vnpost";
      const vnpostBtnStyle = isVNPost ? `display: inline-flex; background-color: #10b981;` : `display: none;`;
      const jtBtnStyle = !isVNPost ? `display: inline-flex; background-color: #e11d48;` : `display: none;`;

      // Lấy version từ manifest (safe fallback nếu không có chrome.runtime)
      let _manifestVersion = 'v1';
      try {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest) {
          _manifestVersion = 'v' + (chrome.runtime.getManifest().version || '1');
        }
      } catch (_) {}

      panel.innerHTML = `
        <div class="minimized-icon">${PANEL_ICONS.parse}</div>
        <div id="vnpost-panel-header">
          <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap; flex: 1; min-width: 0; padding-right: 4px;">
            <span id="vnpost-panel-header-text" style="font-weight: 700;"></span>
            <span class="badge-version">${_manifestVersion}</span>
            <span id="panel-shop-name" class="badge-shop" style="display:none;" title="Shop đang hoạt động"></span>
            <span id="panel-user-account" class="badge-user" style="display:none;" title="Tài khoản đăng nhập tiện ích"></span>
            <span id="panel-carrier-account" class="badge-carrier" style="display:none;" title="Tài khoản bưu cục lên đơn"></span>
            <span id="panel-device-name" style="font-size:10px;color:var(--text-muted, #94A3B8);max-width:70px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:none"></span>
          </div>
          <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
            <span id="vnpost-api-status" title="Kiểm tra API key..." style="display: inline-flex; align-items: center; cursor: default;">${PANEL_ICONS.apiWaiting}</span>
            <button id="vnpost-btn-theme" title="Chuyển chế độ Sáng/Tối">${PANEL_ICONS.theme}</button>
            <button id="vnpost-btn-settings" title="Cài đặt API key">${PANEL_ICONS.settings}</button>
            <button id="vnpost-btn-minimize">${PANEL_ICONS.minimize}</button>
          </div>
        </div>

        <div id="vnpost-panel-body">
          <div>
            <textarea id="rawOrderText" rows="3" placeholder="Dán thông tin đơn hàng thô vào đây... (Ctrl+Enter để tách nhanh)"></textarea>
            <div style="display: flex; gap: 8px; margin-top: 10px;">
              <button id="btnParseOrder" style="flex: 2; margin-top: 0; width: auto;">
                ${PANEL_ICONS.parse} Tách Đơn Tự Động
              </button>
              <button id="btnClearOrder">
                ${PANEL_ICONS.clear} Xóa
              </button>
            </div>
          </div>

          <div id="review-panel">
            <div class="review-title">Phân tích dữ liệu <span class="edit-hint">(bấm vào ô để sửa nếu sai)</span></div>
            <div class="review-grid">
              <div class="review-row">
                <span class="review-label">${PANEL_ICONS.user} Khách hàng</span>
                <span id="rev-name" class="review-value-bold review-editable" contenteditable="true" title="Bấm để sửa"></span>
              </div>
              <div class="review-row">
                <span class="review-label">${PANEL_ICONS.phone} Số điện thoại</span>
                <span id="rev-phone" class="review-value-bold review-editable" contenteditable="true" title="Bấm để sửa"></span>
              </div>
              <div class="review-row">
                <span class="review-label">${PANEL_ICONS.orderCode} Mã đơn hàng</span>
                <span id="rev-code" class="review-value-bold review-editable" contenteditable="true" title="Bấm để sửa"></span>
              </div>
              <div class="review-row">
                <span class="review-label">${PANEL_ICONS.fee} Thu cước</span>
                <span id="rev-fee" class="review-value-bold fee-status"></span>
              </div>
              <div class="review-row address-row">
                <span class="review-label">${PANEL_ICONS.address} Địa chỉ nhận hàng</span>
                <div style="display: flex; align-items: flex-start; gap: 4px; width: 100%;">
                  <span id="rev-address" class="review-editable" contenteditable="true" title="Bấm để sửa" style="flex: 1; min-width: 0;"></span>
                  <button class="copy-btn" data-copy="rev-address" title="Sao chép địa chỉ">${PANEL_ICONS.copy}</button>
                </div>
              </div>
              <div class="cod-box">
                <span class="cod-title">Thu hộ COD</span>
                <span id="rev-cod"></span>
              </div>
            </div>
            
            <div id="ai-geo-box">
              <div id="ai-merger-notice" style="display: none; background-color: #fffbeb; color: #b45309; padding: 8px 10px; border-radius: 6px; font-size: 11px; margin-bottom: 10px; border: 1px solid #fde68a; line-height: 1.4;"></div>
              <div class="ai-geo-title">${PANEL_ICONS.address} Gợi ý địa chỉ bóc tách:</div>
              <div id="btn-suggest-2level" class="geo-suggest-item" style="margin-bottom: 0;">
                <strong style="color: #93c5fd; font-size: 10px; display: block; margin-bottom: 2px;">Địa chỉ gợi ý (2 cấp):</strong>
                <div style="display: flex; align-items: flex-start; gap: 4px;">
                  <span id="rev-suggest-2level" style="word-break: break-all; flex: 1; min-width: 0;"></span>
                  <button class="copy-btn" data-copy="rev-suggest-2level" title="Sao chép địa chỉ gợi ý">${PANEL_ICONS.copy}</button>
                </div>
              </div>
              <span class="ai-geo-footer">Bấm vào gợi ý mong muốn để áp dụng nhanh</span>
            </div>
          </div>

          <div style="display: flex; gap: 8px; width: 100%;">
            <button id="btnFillVNPost" class="btn-fill" style="${vnpostBtnStyle}; flex: 1;">${PANEL_ICONS.fill} Nhập đơn</button>
            <button id="btnFillJT" class="btn-fill" style="${jtBtnStyle}; flex: 1;">${PANEL_ICONS.fill} Nhập đơn</button>
            <button id="btnSaveOrder" class="btn-fill" style="background-color: #6366f1; flex: 1;">${PANEL_ICONS.save} Lưu đơn</button>
          </div>
          <div id="gemini-progress-container">
            <div class="ai-progress-header">
              <span id="ai-status">⏳ AI đang tối ưu địa chỉ...</span>
              <span id="ai-percent">0%</span>
            </div>
            <div class="progress-bar-bg">
              <div id="gemini-progress-bar"></div>
            </div>
          </div>
        </div>
      `;

      root.appendChild(panel);
      
      // Gán nội dung tĩnh/đầu đề an toàn
      const _headerTextEl = root.getElementById('vnpost-panel-header-text');
      if (_headerTextEl) _headerTextEl.textContent = platformObj.title || '';

      const updateCarrierAccountInPanel = () => {
        const acc = typeof globalThis.detectCarrierAccount === 'function' ? globalThis.detectCarrierAccount(platformObj.id) : '';
        const accEl = root.getElementById('panel-carrier-account');
        if (accEl) {
          if (acc) {
            accEl.textContent = `👤 ${acc}`;
            accEl.title = `Tài khoản lên đơn trên ${platformObj.title}: ${acc}`;
            accEl.style.display = 'inline-flex';
          } else {
            accEl.style.display = 'none';
          }
        }
      };
      updateCarrierAccountInPanel();
      setInterval(updateCarrierAccountInPanel, 2500);

      const updateAuthAndShopInfoInPanel = () => {
        try {
          const shopEl = root.getElementById('panel-shop-name');
          const userEl = root.getElementById('panel-user-account');

          function renderInfo(uName, sName) {
            if (userEl) {
              if (uName) {
                const cleanU = uName.includes('@') ? uName.split('@')[0] : uName;
                userEl.textContent = `🔑 ${cleanU}`;
                userEl.title = `Tài khoản đăng nhập tiện ích: ${uName}`;
                userEl.style.display = 'inline-flex';
              } else {
                userEl.style.display = 'none';
              }
            }
            if (shopEl) {
              if (sName) {
                shopEl.textContent = `🏪 ${sName}`;
                shopEl.title = `Shop đang làm việc: ${sName}`;
                shopEl.style.display = 'inline-flex';
              } else {
                shopEl.style.display = 'none';
              }
            }
          }

          let userName = '';
          let shopName = '';

          if (typeof AuthSession !== 'undefined' && typeof AuthSession.getSession === 'function') {
            AuthSession.getSession().then(session => {
              if (session) {
                userName = session.user?.full_name || session.user?.username || session.user?.email || '';
                shopName = session.shop_name || '';
                if (userName || shopName) renderInfo(userName, shopName);
              }
            }).catch(() => {});
          }

          if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.get(['vnpost_session', 'activeShopName', 'activeShop', 'currentUser'], (res) => {
              if (chrome.runtime.lastError) return;
              if (res) {
                const s = res.vnpost_session;
                if (!userName && s) {
                  userName = s.user?.full_name || s.user?.username || s.user?.email || res.currentUser || '';
                }
                if (!shopName) {
                  shopName = s?.shop_name || res.activeShopName || (res.activeShop ? (typeof res.activeShop === 'object' ? res.activeShop.name : 'Shop #' + res.activeShop) : '');
                }
                renderInfo(userName, shopName);
              }
            });
          }
        } catch (_) {}
      };

      updateAuthAndShopInfoInPanel();
      setInterval(updateAuthAndShopInfoInPanel, 3000);

      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
        chrome.storage.onChanged.addListener((changes, area) => {
          if (area === 'local' && (changes.vnpost_session || changes.activeShopName || changes.activeShop || changes.currentUser)) {
            updateAuthAndShopInfoInPanel();
          }
        });
      }

      makeElementDraggable(panel, root.getElementById("vnpost-panel-header"));

      // Đọc trạng thái thu nhỏ và giao diện từ bộ nhớ
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['panelMinimized', 'antigravity_ui_theme'], (res) => {
          if (res) {
            const btnMinimize = root.getElementById('vnpost-btn-minimize');
            if (res.panelMinimized) {
              panel.classList.add('minimized');
              if (btnMinimize) btnMinimize.innerHTML = PANEL_ICONS.maximize;
            } else {
              if (btnMinimize) btnMinimize.innerHTML = PANEL_ICONS.minimize;
            }
            // Dark là default (không có class). Chỉ add light-mode khi user chọn light.
            if (res.antigravity_ui_theme === 'light') {
              panel.classList.add('light-mode');
            } else {
              panel.classList.remove('light-mode');
            }
          }
        });
      }

      // Đăng ký sự kiện lắng nghe click
      root.getElementById('btnParseOrder').addEventListener('click', onParseHandler);
      root.getElementById('btnClearOrder').addEventListener('click', onClearHandler);
      root.getElementById('btnFillVNPost').addEventListener('click', function() { onFillHandler('vnpost'); });
      root.getElementById('btnFillJT').addEventListener('click', function() { onFillHandler('jt'); });
      root.getElementById('btn-suggest-2level').addEventListener('click', () => {
        const text = root.getElementById('rev-suggest-2level').textContent.trim();
        if (text && typeof onAiAddressClickHandler === 'function') {
          onAiAddressClickHandler(text);
          showVnpostToast('✅ Đã chọn địa chỉ gợi ý', 'success');
        }
      });
      // Copy buttons
      root.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const targetId = btn.getAttribute('data-copy');
          const el = targetId ? root.getElementById(targetId) : null;
          if (el) {
            const text = el.textContent.trim();
            if (text) {
              navigator.clipboard.writeText(text).then(() => {
                const oldContent = btn.innerHTML;
                btn.innerHTML = PANEL_ICONS.check;
                setTimeout(() => { btn.innerHTML = oldContent; }, 1500);
                showVnpostToast('📋 Đã sao chép: ' + text.substring(0, 40) + (text.length > 40 ? '...' : ''), 'success');
              }).catch(() => {
                showVnpostToast('❌ Không thể sao chép', 'error');
              });
            }
          }
        });
      });

      if (typeof onSaveHandler === 'function') {
        root.getElementById('btnSaveOrder').addEventListener('click', onSaveHandler);
      }
      if (typeof onSettingsClickHandler === 'function') {
        root.getElementById('vnpost-btn-settings').addEventListener('click', onSettingsClickHandler);
      }

      const btnTheme = root.getElementById('vnpost-btn-theme');
      if (btnTheme) {
        btnTheme.addEventListener('click', (e) => {
          e.stopPropagation();
          // Design system: dark là default (không có class), light cần class 'light-mode'
          const isNowLight = panel.classList.toggle('light-mode');
          if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({ antigravity_ui_theme: isNowLight ? 'light' : 'dark' });
          }
          showVnpostToast(isNowLight ? '☀️ Đã chuyển sang giao diện Sáng' : '🌙 Đã chuyển sang giao diện Tối', 'success');
        });
      }

      const txtArea = root.getElementById('rawOrderText');
      txtArea.addEventListener('focus', () => {
          txtArea.style.borderColor = themeColor;
          txtArea.style.boxShadow = `0 0 0 3px ${themeColor}1a`;
      });
      txtArea.addEventListener('blur', () => {
          txtArea.style.borderColor = 'rgba(255,255,255,0.08)';
          txtArea.style.boxShadow = 'none';
      });
      txtArea.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          onParseHandler();
        }
      });
      // Không auto-focus vào textarea để tránh gây mất focus của user trên trang web

      const editableFieldMap = { 'rev-name': 'name', 'rev-phone': 'phone', 'rev-code': 'orderCode', 'rev-address': 'address' };
      Object.keys(editableFieldMap).forEach((elId) => {
        const el = root.getElementById(elId);
        if (!el) return;
        el.addEventListener('blur', () => {
          if (typeof onFieldEditHandler === 'function') {
            onFieldEditHandler(editableFieldMap[elId], el.textContent.trim());
          }
        });
        el.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
        });
      });

      const btnMinimize = root.getElementById('vnpost-btn-minimize');
      btnMinimize.addEventListener('click', (e) => {
        e.stopPropagation();
        panel.classList.add('minimized');
        btnMinimize.innerHTML = PANEL_ICONS.maximize;
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ panelMinimized: true });
        }
      });

      panel.addEventListener('click', (e) => {
        if (panel.classList.contains('minimized')) {
          panel.classList.remove('minimized');
          btnMinimize.innerHTML = PANEL_ICONS.minimize;
          if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({ panelMinimized: false });
          }
        }
      });

      const apiStatusEl = root.getElementById('vnpost-api-status');
      if (apiStatusEl) {
        let attempts = 0;
        const maxAttempts = 30; // 9 seconds (30 * 300ms)
        let intervalId = null;

        function checkAndUpdateApiStatus(isFinalAttempt = false) {
          if (typeof OrderStorage !== 'undefined') {
            const hasShop = OrderStorage.getCacheValue('activeShop');
            if (hasShop) {
              apiStatusEl.innerHTML = PANEL_ICONS.apiOk;
              apiStatusEl.title = 'AI Gateway: Đã kết nối';
              if (intervalId) {
                clearInterval(intervalId);
                intervalId = null;
              }
              return true;
            } else {
              if (isFinalAttempt) {
                apiStatusEl.innerHTML = PANEL_ICONS.apiWarning;
                apiStatusEl.title = 'Chưa chọn Shop — không thể dùng AI';
              } else {
                apiStatusEl.innerHTML = PANEL_ICONS.apiWaiting;
                apiStatusEl.title = 'Đang kiểm tra kết nối AI Gateway...';
              }
              return false;
            }
          } else {
            apiStatusEl.innerHTML = PANEL_ICONS.apiUnknown;
            apiStatusEl.title = 'Không thể kiểm tra';
            if (intervalId) {
              clearInterval(intervalId);
              intervalId = null;
            }
            return true;
          }
        }

        // Initial check
        const hasKey = checkAndUpdateApiStatus(false);
        if (!hasKey) {
          intervalId = setInterval(() => {
            attempts++;
            const found = checkAndUpdateApiStatus(attempts >= maxAttempts);
            if (found || attempts >= maxAttempts) {
              if (intervalId) {
                clearInterval(intervalId);
                intervalId = null;
              }
            }
          }, 300);
        }

        // Listen for storage changes in real-time
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
          chrome.storage.onChanged.addListener((changes, areaName) => {
            const hasChange = Object.keys(changes).some(k => k.startsWith('groqApiKey') || k.startsWith('activeShop'));
            if (areaName === 'local' && hasChange) {
              if (intervalId) {
                clearInterval(intervalId);
                intervalId = null;
              }
              checkAndUpdateApiStatus(true);
            }
          });
        }
      }

      // ─── TỰ ĐỘNG KẾT NỐI CLOUD + HIỂN THỊ TÊN MÁY ───
      (function autoConnectPanelCloud() {
        const devNameEl = root.getElementById('panel-device-name');
        if (typeof FirebaseCloud === 'undefined') return;

        // Hiển thị tên máy nếu đã có
        const showName = () => {
          try {
            let n = FirebaseCloud.deviceName || '';
            if (!n || n === 'Máy không tên' || n.startsWith('dev_')) {
              // Fallback: đọc trực tiếp từ storage
              if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.get(['fbDeviceName'], r => {
                  if (r.fbDeviceName && r.fbDeviceName !== 'Máy không tên' && !r.fbDeviceName.startsWith('dev_')) {
                    if (devNameEl) { devNameEl.textContent = '💻 ' + r.fbDeviceName; devNameEl.style.display = 'inline'; }
                  }
                });
              }
              return;
            }
            if (devNameEl) { devNameEl.textContent = '💻 ' + n; devNameEl.style.display = 'inline'; }
          } catch(e) {}
        };

        // Kết nối cloud nếu chưa kết nối
        (async () => {
          try {
            if (!FirebaseCloud.isConnected) {
              await FirebaseCloud.signIn();
              try { await FirebaseCloud.registerDevice(); } catch(_) {}
            }
            showName();
          } catch (e) {
            // Cloud không bắt buộc, silent fail
          }
        })();

        // Lắng nghe thay đổi tên máy từ storage
        if (typeof chrome !== 'undefined' && chrome.storage) {
          chrome.storage.onChanged.addListener((changes) => {
            if (changes.fbDeviceName) showName();
          });
        }
      })();

    } catch (e) { console.error(e); }
  }

  function makeElementDraggable(elmnt, dragAnchor) {
    if (typeof window === 'undefined') return;
    let p1 = 0, p2 = 0, p3 = 0, p4 = 0;
    
    // Đăng ký sự kiện mousedown cho cả panel để kéo khi thu nhỏ
    elmnt.addEventListener('mousedown', (e) => {
      // Chỉ kéo từ panel nếu nó đang thu nhỏ
      if (!elmnt.classList.contains('minimized')) return;
      startDrag(e);
    });

    dragAnchor.onmousedown = function(e) {
      if (e.target.id === 'vnpost-btn-minimize' || e.target.id === 'vnpost-btn-settings' || e.target.id === 'vnpost-btn-theme') return;
      startDrag(e);
    };

    function startDrag(e) {
      e = e || window.event;
      const initialX = e.clientX;
      const initialY = e.clientY;
      let hasDragged = false;

      p3 = e.clientX; 
      p4 = e.clientY;

      document.onmouseup = function(mouseupEv) {
        document.onmouseup = null;
        document.onmousemove = null;
        
        // Nếu có kéo đi xa hơn 4px thì coi như đã drag, ngược lại là click
        if (hasDragged && elmnt.classList.contains('minimized')) {
          mouseupEv.stopPropagation();
          mouseupEv.preventDefault();
        }
      };

      document.onmousemove = function(ev) {
        ev = ev || window.event;
        ev.preventDefault();
        const dist = Math.sqrt(Math.pow(ev.clientX - initialX, 2) + Math.pow(ev.clientY - initialY, 2));
        if (dist > 4) {
          hasDragged = true;
        }
        p1 = p3 - ev.clientX;
        p2 = p4 - ev.clientY;
        p3 = ev.clientX;
        p4 = ev.clientY;

        let newTop = elmnt.offsetTop - p2;
        let newLeft = elmnt.offsetLeft - p1;

        // Giới hạn không cho panel biến mất hoàn toàn khỏi màn hình
        const maxTop = window.innerHeight - 50;
        const maxLeft = window.innerWidth - 50;
        
        if (newTop < 0) newTop = 0;
        if (newTop > maxTop) newTop = maxTop;
        if (newLeft < 0) newLeft = 0;
        if (newLeft > maxLeft) newLeft = maxLeft;

        elmnt.style.top = newTop + "px";
        elmnt.style.left = newLeft + "px";
        elmnt.style.right = "auto";
      };
    }
  }

  function showPanelSkeleton() {
    requestAnimationFrame(() => {
      const nameEl = getVnpostEl('rev-name');
      if (nameEl) nameEl.innerHTML = '<span class="skeleton" style="width: 70%; height: 14px;">&nbsp;</span>';
      
      const revPhone = getVnpostEl('rev-phone');
      if (revPhone) revPhone.innerHTML = '<span class="skeleton" style="width: 50%; height: 14px;">&nbsp;</span>';
      
      const oldWarn = getVnpostEl('rev-phone-warn');
      if (oldWarn) oldWarn.remove();

      const codeEl = getVnpostEl('rev-code');
      if (codeEl) codeEl.innerHTML = '<span class="skeleton" style="width: 55%; height: 14px;">&nbsp;</span>';

      const addrEl = getVnpostEl('rev-address');
      if (addrEl) addrEl.innerHTML = '<span class="skeleton" style="width: 90%; height: 14px;">&nbsp;</span>';

      const codEl = getVnpostEl('rev-cod');
      if (codEl) codEl.innerHTML = '<span class="skeleton" style="width: 40%; height: 14px;">&nbsp;</span>';

      const feeEl = getVnpostEl('rev-fee');
      if (feeEl) feeEl.innerHTML = '<span class="skeleton" style="width: 35%; height: 14px;">&nbsp;</span>';

      const reviewPanel = getVnpostEl('review-panel');
      if (reviewPanel) reviewPanel.style.display = 'block';

      const aiGeoBox = getVnpostEl('ai-geo-box');
      if (aiGeoBox) aiGeoBox.style.display = 'block';
    });
  }

  function displayParsedData(data) {
    requestAnimationFrame(() => {
      const nameEl = getVnpostEl('rev-name');
      if (nameEl) nameEl.textContent = data.name ? data.name.trim() : "không tìm thấy";
      
      const revPhone = getVnpostEl('rev-phone');
      if (revPhone) {
        revPhone.textContent = data.phone ? data.phone.trim() : "không tìm thấy";
        revPhone.style.color = '';
        revPhone.style.fontWeight = '';
        revPhone.title = '';
      }
      
      const oldWarn = getVnpostEl('rev-phone-warn');
      if (oldWarn) oldWarn.remove();

      if (data.phone) {
        const cleanPhone = data.phone.replace(/\D/g, '');
        if (typeof OrderStorage !== 'undefined') {
          const blacklist = OrderStorage.getCacheValue('blacklistPhones') || [];
          const blacklisted = blacklist.find(b => b.phone === cleanPhone);
          if (blacklisted && revPhone) {
            revPhone.style.color = '#dc2626';
            revPhone.style.fontWeight = '700';
            revPhone.title = 'SĐT nằm trong danh sách đen! Lý do: ' + blacklisted.reason;
            
            const warnSpan = document.createElement('span');
            warnSpan.id = 'rev-phone-warn';
            warnSpan.innerHTML = ' ' + PANEL_ICONS.warn;
            warnSpan.style.color = '#dc2626';
            warnSpan.style.cursor = 'help';
            warnSpan.style.display = 'inline-flex';
            warnSpan.style.alignItems = 'center';
            warnSpan.title = 'Lịch sử bom hàng: ' + blacklisted.reason;
            revPhone.parentElement.appendChild(warnSpan);

            showVnpostToast('⚠️ CẢNH BÁO: Khách hàng này có lịch sử BOM HÀNG! Lý do: ' + blacklisted.reason, 'error');
          }
        }
      }

      const codeEl = getVnpostEl('rev-code');
      if (codeEl) codeEl.textContent = data.orderCode ? data.orderCode.trim() : "Lũa Thuỷ Sinh";

      const addrEl = getVnpostEl('rev-address');
      if (addrEl) addrEl.textContent = data.address ? data.address.trim() : "không tìm thấy";

      const codEl = getVnpostEl('rev-cod');
      if (codEl) codEl.textContent = data.codAmount ? data.codAmount.toLocaleString('en-US') + " đ" : "0 đ";

      const feeEl = getVnpostEl('rev-fee');
      if (feeEl) {
        const feeOn = !!data.collectFee;
        feeEl.textContent = feeOn ? 'CÓ' : 'KHÔNG';
        feeEl.classList.toggle('fee-status--yes', feeOn);
        feeEl.classList.toggle('fee-status--no', !feeOn);
      }

      const reviewPanel = getVnpostEl('review-panel');
      if (reviewPanel) reviewPanel.style.display = 'block';
    });
  }

  globalThis.getVnpostPanelRoot = getVnpostPanelRoot;
  globalThis.getVnpostEl = getVnpostEl;
  globalThis.createInputPanel = createInputPanel;
  globalThis.showPanelSkeleton = showPanelSkeleton;
  globalThis.displayParsedData = displayParsedData;

  function createLoginRequiredPanel(platform, onLoginClickHandler) {
    try {
      if (typeof document === 'undefined') return;
      const platformObj = normalizePlatform(platform);
      let host = document.getElementById('vnpost-autofill-shadow-host');
      const existingPanel = host ? getVnpostEl('vnpost-autofill-panel') : null;
      if (existingPanel && existingPanel.dataset && existingPanel.dataset.panelType === 'login') {
        return; // Đã có panel login
      }
      if (!host) {
        host = document.createElement('div');
        host.id = 'vnpost-autofill-shadow-host';
        document.body.appendChild(host);
      }

      const root = host.shadowRoot || host.attachShadow({ mode: 'open' });
      const oldPanel = root.querySelector('#vnpost-autofill-panel');
      if (oldPanel) oldPanel.remove();

      if (!root.querySelector('#vnpost-shadow-style')) {
        const styleEl = document.createElement('style');
        styleEl.id = 'vnpost-shadow-style';
        styleEl.textContent = typeof PANEL_CSS !== 'undefined' ? PANEL_CSS : '';
        root.appendChild(styleEl);
      }

      const panel = document.createElement('div');
      panel.id = 'vnpost-autofill-panel';
      panel.dataset.panelType = 'login';
      
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id && chrome.storage && chrome.storage.local) {
        try {
          chrome.storage.local.get(['antigravity_ui_theme'], (res) => {
            if (chrome.runtime.lastError) return;
            if (!res || res.antigravity_ui_theme !== 'dark') {
              panel.classList.add('light-mode');
            } else {
              panel.classList.remove('light-mode');
            }
          });
        } catch (_) {}
      } else {
        panel.classList.add('light-mode');
      }
      const themeColor = platformObj.themeColor || (platformObj.id === "vnpost" ? "#0056b3" : "#4f46e5");
      panel.style.setProperty('--theme-color', themeColor);

      let _loginVersion = 'v1';
      try {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest) {
          _loginVersion = 'v' + (chrome.runtime.getManifest().version || '1');
        }
      } catch (_) {}

      panel.innerHTML = `
        <div class="minimized-icon">${PANEL_ICONS.user}</div>
        <div id="vnpost-panel-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span id="vnpost-panel-header-text"></span>
            <span class="badge-version">${_loginVersion} (Xác thực)</span>
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <button id="vnpost-btn-theme" title="Chuyển chế độ Sáng/Tối">${PANEL_ICONS.theme}</button>
            <button id="vnpost-btn-minimize">${PANEL_ICONS.minimize}</button>
          </div>
        </div>

        <div id="vnpost-panel-body">
          <div class="panel-login-box">
            <div class="panel-login-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--theme-color, #6366f1);"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              Đăng Nhập Hệ Thống
            </div>
            <div class="panel-login-subtitle">
              Nhập tài khoản để kích hoạt công cụ bóc tách đơn hàng Auto Fill.
            </div>

            <div id="panel-login-error" class="panel-login-error"></div>

            <form id="panel-login-form" style="display: flex; flex-direction: column; gap: 10px;">
              <div class="panel-login-group">
                <label class="panel-login-label" for="panel-input-email">Email hoặc Tên đăng nhập</label>
                <input type="text" id="panel-input-email" class="panel-login-input" placeholder="Ví dụ: user@gmail.com" required autocomplete="username" />
              </div>

              <div class="panel-login-group">
                <label class="panel-login-label" for="panel-input-password">Mật khẩu</label>
                <input type="password" id="panel-input-password" class="panel-login-input" placeholder="••••••••" required autocomplete="current-password" />
              </div>

              <button type="submit" id="panel-btn-submit-login" class="panel-login-btn" style="margin-top: 4px;">
                🔑 Đăng nhập ngay
              </button>
            </form>

            <div class="panel-login-footer" style="display:flex;flex-direction:column;gap:4px;">
              <a id="panel-link-register" class="panel-login-link">🔧 Mở Options (Cài đặt / Đăng ký)</a>
              <a id="panel-link-admin-login" class="panel-login-link" style="font-size:11px;">🌐 Mở Trang Quản Trị</a>
            </div>
          </div>
        </div>
      `;

      root.appendChild(panel);
      // Gán tiêu đề an toàn bằng textContent (tránh XSS)
      const _loginHeaderEl = root.getElementById('vnpost-panel-header-text');
      if (_loginHeaderEl) _loginHeaderEl.textContent = platformObj.title || '';
      makeElementDraggable(panel, root.getElementById("vnpost-panel-header"));

      // Gắn sự kiện theme toggle
      const btnTheme = root.getElementById('vnpost-btn-theme');
      if (btnTheme) {
        btnTheme.addEventListener('click', (e) => {
          e.stopPropagation();
          const isNowLight = panel.classList.toggle('light-mode');
          if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({ antigravity_ui_theme: isNowLight ? 'light' : 'dark' });
          }
          showVnpostToast(isNowLight ? '☀️ Đã chuyển sang giao diện Sáng' : '🌙 Đã chuyển sang giao diện Tối', 'success');
        });
      }

      // Gắn sự kiện thu nhỏ
      root.getElementById('vnpost-btn-minimize').addEventListener('click', () => {
        panel.classList.toggle('minimized');
      });

      const loginForm = root.getElementById('panel-login-form');
      const emailInput = root.getElementById('panel-input-email');
      const passInput = root.getElementById('panel-input-password');
      const submitBtn = root.getElementById('panel-btn-submit-login');
      const errorBox = root.getElementById('panel-login-error');
      const registerLink = root.getElementById('panel-link-register');

      const adminLoginLink = root.getElementById('panel-link-admin-login');

      if (registerLink && onLoginClickHandler) {
        registerLink.addEventListener('click', (e) => {
          e.preventDefault();
          onLoginClickHandler();
        });
      }

      if (adminLoginLink) {
        adminLoginLink.addEventListener('click', (e) => {
          e.preventDefault();
          let url = 'https://xlgovgynbsahuykyjzcx.supabase.co/';
          try {
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id && chrome.runtime.getURL) {
              url = chrome.runtime.getURL('admin-dashboard/login.html');
            }
          } catch (_) {}
          window.open(url, '_blank');
        });
      }

      if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const identifier = (emailInput?.value || '').trim();
          const password = (passInput?.value || '').trim();

          if (!identifier || !password) {
            if (errorBox) {
              errorBox.textContent = '⚠️ Vui lòng nhập đầy đủ Email/Tên đăng nhập và Mật khẩu!';
              errorBox.style.display = 'block';
            }
            return;
          }

          if (errorBox) errorBox.style.display = 'none';
          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '⏳ Đang xác thực...';
          }

          try {
            if (typeof AuthService !== 'undefined' && typeof AuthService.loginWithUsernameOrEmail === 'function') {
              await AuthService.loginWithUsernameOrEmail(identifier, password);
              if (errorBox) errorBox.style.display = 'none';

              // Đợi 80ms cho storage đồng bộ rồi gọi làm mới giao diện panel từ globalThis/window
              setTimeout(() => {
                const recheckFn = (typeof globalThis !== 'undefined' && globalThis.checkUrlAndInject) ||
                                  (typeof window !== 'undefined' && window.checkUrlAndInject);
                if (typeof recheckFn === 'function') {
                  recheckFn();
                }
              }, 80);
            } else {
              throw new Error('Hệ thống xác thực (AuthService) chưa sẵn sàng.');
            }
          } catch (err) {
            if (errorBox) {
              errorBox.textContent = `❌ ${err.message || 'Đăng nhập thất bại!'}`;
              errorBox.style.display = 'block';
            }
          } finally {
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.innerHTML = '🔑 Đăng nhập ngay';
            }
          }
        });
      }

    } catch (e) {
      console.warn("Lỗi tạo panel đăng nhập:", e);
    }
  }

  globalThis.createLoginRequiredPanel = createLoginRequiredPanel;
})();

