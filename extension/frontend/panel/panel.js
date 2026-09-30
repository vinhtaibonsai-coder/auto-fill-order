(() => {
  // =========================================================================
  // UI SHADOW DOM PANEL
  // =========================================================================

  const PANEL_ICONS = {
    theme: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/><circle cx="12" cy="12" r="4"/><path d="M12 2a10 10 0 0 0 10 10" fill="currentColor" opacity="0.3"/></svg>`,
    settings: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
    minimize: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
    maximize: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
    dock: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/><path d="m10 9-3 3 3 3"/></svg>`,
    float: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M16 3h3a2 2 0 0 1 2 2v3"/><path d="M8 21H5a2 2 0 0 1-2-2v-3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>`,
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

  const PANEL_DOCK_WIDTH_PX = 340;

  function getVnpostPanelRoot() {
    if (typeof document === 'undefined') return null;
    const host = document.getElementById('vnpost-autofill-shadow-host');
    return (host && host.shadowRoot) ? host.shadowRoot : document;
  }

  function getVnpostEl(id) {
    const root = getVnpostPanelRoot();
    return root && root.getElementById ? root.getElementById(id) : null;
  }

  function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));
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

  function getInitialTheme() {
    try {
      const cached = typeof localStorage !== 'undefined' ? localStorage.getItem('antigravity_ui_theme') : null;
      if (cached === 'dark') return 'dark';
    } catch (_) {}
    return 'light';
  }

  function applyInitialTheme(panel) {
    if (!panel) return;
    if (getInitialTheme() === 'dark') {
      panel.classList.remove('light-mode');
    } else {
      panel.classList.add('light-mode');
    }
  }

  function persistThemePreference(isLight) {
    const themeVal = isLight ? 'light' : 'dark';
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('antigravity_ui_theme', themeVal);
      }
    } catch (_) {}
    let __hasExtCtx = false; try { __hasExtCtx = typeof chrome !== 'undefined' && chrome.runtime && !!chrome.runtime.id; } catch(e) {}; if (__hasExtCtx && chrome.storage && chrome.storage.local) {
      try {
        chrome.storage.local.set({ antigravity_ui_theme: themeVal });
      } catch (_) {}
    }
  }

  const panelStorage = {
    get(keys, callback) {
      try {
        let __hasExtCtx = false; try { __hasExtCtx = typeof chrome !== 'undefined' && chrome.runtime && !!chrome.runtime.id; } catch(e) {}; if (__hasExtCtx && chrome.storage && chrome.storage.local) {
          chrome.storage.local.get(keys, (res) => {
            if (chrome.runtime && chrome.runtime.lastError) {}
            callback(res || {});
          });
          return;
        }
      } catch (_) {}
      const result = {};
      keys.forEach((key) => {
        try {
          const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
          result[key] = raw ? JSON.parse(raw) : undefined;
        } catch (_) {
          result[key] = undefined;
        }
      });
      callback(result);
    },
    set(values) {
      try {
        let __hasExtCtx = false; try { __hasExtCtx = typeof chrome !== 'undefined' && chrome.runtime && !!chrome.runtime.id; } catch(e) {}; if (__hasExtCtx && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set(values, () => {
            if (chrome.runtime && chrome.runtime.lastError) {}
          });
          return;
        }
      } catch (_) {}
      if (typeof localStorage === 'undefined') return;
      Object.entries(values).forEach(([key, value]) => {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
      });
    },
  };

  function setDockTabVisible(dockTab, visible) {
    if (!dockTab) return;
    dockTab.classList.toggle('is-visible', Boolean(visible));
  }

  function setPageDockOffset(enabled) {
    if (typeof document === 'undefined' || !document.body) return;
    const body = document.body;
    const styleId = 'vnpost-dock-page-offset-style';
    let styleEl = document.getElementById(styleId);

    if (enabled) {
      if (body.dataset.vnpostDockOffsetActive !== 'true') {
        body.dataset.vnpostDockOriginalPaddingRight = body.style.paddingRight || '';
        body.dataset.vnpostDockOriginalTransition = body.style.transition || '';
      }
      const computedPadding = parseFloat(window.getComputedStyle(body).paddingRight || '0') || 0;
      const basePadding = body.dataset.vnpostDockOffsetActive === 'true'
        ? Math.max(0, computedPadding - PANEL_DOCK_WIDTH_PX)
        : computedPadding;
      body.style.paddingRight = `${basePadding + PANEL_DOCK_WIDTH_PX}px`;
      if (!body.style.transition) {
        body.style.transition = 'padding-right 280ms cubic-bezier(0.4, 0, 0.2, 1)';
      }
      body.dataset.vnpostDockOffsetActive = 'true';

      // Tạo style để đảm bảo thanh nút cố định ở đáy trang của VNPost/J&T không bị panel che
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = styleId;
        (document.head || document.documentElement).appendChild(styleEl);
      }
      styleEl.textContent = `
        /* Đẩy các thanh công cụ / nút bấm cố định ở đáy trang của VNPost & J&T sang trái khi panel đang ghim */
        .ant-pro-footer-bar,
        .ant-pro-footer-bar-dom,
        .ant-pro-footer-toolbar,
        div[class*="ant-pro-footer-bar"],
        div[class*="ant-pro-footer-toolbar"],
        .fixed-bottom-container,
        div[class*="fixed-bottom-container"],
        .fixed-bottom,
        div[class*="fixed-bottom"],
        .footer-btn,
        div[class*="footer-btn"],
        .page-footer,
        .create-order-footer,
        .order-create-footer,
        .bottom-action-bar,
        .action-bar-fixed,
        .action-bar,
        .order-footer,
        .ant-layout-footer,
        .el-footer,
        footer[class*="fixed" i],
        footer[style*="fixed"],
        div[class*="footer" i][class*="fixed" i],
        div[class*="bottom" i][class*="fixed" i],
        div[class*="footer" i][style*="fixed"],
        div[class*="bottom" i][style*="fixed"],
        div[style*="position: fixed"][style*="bottom: 0"],
        div[style*="position:fixed"][style*="bottom:0"],
        div[style*="position: fixed"][style*="bottom:0"] {
          right: ${PANEL_DOCK_WIDTH_PX}px !important;
          width: auto !important;
          max-width: calc(100vw - ${PANEL_DOCK_WIDTH_PX}px) !important;
          box-sizing: border-box !important;
          transition: right 280ms cubic-bezier(0.4, 0, 0.2, 1), max-width 280ms cubic-bezier(0.4, 0, 0.2, 1), width 280ms cubic-bezier(0.4, 0, 0.2, 1) !important;
        }

        /* Đảm bảo flex container bên trong các thanh footer không bị tràn */
        .ant-pro-footer-bar-right,
        .ant-pro-footer-bar > div,
        .fixed-bottom-container > div {
          padding-right: 12px !important;
          box-sizing: border-box !important;
        }
      `;
      return;
    }

    if (body.dataset.vnpostDockOffsetActive === 'true') {
      body.style.paddingRight = body.dataset.vnpostDockOriginalPaddingRight || '';
      body.style.transition = body.dataset.vnpostDockOriginalTransition || '';
      delete body.dataset.vnpostDockOffsetActive;
      delete body.dataset.vnpostDockOriginalPaddingRight;
      delete body.dataset.vnpostDockOriginalTransition;
    }
    if (styleEl) {
      styleEl.remove();
    }
  }

  function applyPanelDisplayMode(panel, dockTab, btnDockToggle, mode, options = {}) {
    const nextMode = mode === 'floating' ? 'floating' : 'docked';
    const btnMinimize = getVnpostEl('vnpost-btn-minimize');

    if (nextMode === 'docked') {
      panel.classList.remove('panel-floating', 'minimized');
      panel.classList.add('panel-docked');
      panel.classList.toggle('collapsed', Boolean(options.collapsed));
      panel.style.top = '';
      panel.style.left = '';
      panel.style.right = '';
      panel.style.bottom = '';
      setDockTabVisible(dockTab, options.collapsed);
      setPageDockOffset(!options.collapsed);
      if (btnDockToggle) {
        btnDockToggle.innerHTML = PANEL_ICONS.float;
        btnDockToggle.title = 'Thả nổi panel';
      }
      if (btnMinimize) {
        btnMinimize.innerHTML = PANEL_ICONS.minimize;
        btnMinimize.title = 'Thu vào mép phải';
      }
      return;
    }

    panel.classList.remove('panel-docked', 'collapsed');
    panel.classList.add('panel-floating');
    setDockTabVisible(dockTab, false);
    setPageDockOffset(false);
    if (btnDockToggle) {
      btnDockToggle.innerHTML = PANEL_ICONS.dock;
      btnDockToggle.title = 'Ghim panel vào mép phải';
    }
    if (btnMinimize) {
      btnMinimize.innerHTML = panel.classList.contains('minimized') ? PANEL_ICONS.maximize : PANEL_ICONS.minimize;
      btnMinimize.title = 'Thu nhỏ panel';
    }

    const position = options.position || {};
    const top = Number(position.top);
    const left = Number(position.left);
    if (Number.isFinite(top) && Number.isFinite(left)) {
      panel.style.top = `${Math.max(0, top)}px`;
      panel.style.left = `${Math.max(0, left)}px`;
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
    } else {
      panel.style.top = '20px';
      panel.style.right = '20px';
      panel.style.left = 'auto';
      panel.style.bottom = 'auto';
    }
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
      const oldDockTab = root.querySelector('#vnpost-dock-toggle-tab');
      if (oldDockTab) oldDockTab.remove();

      if (!root.querySelector('#vnpost-shadow-style')) {
        const styleEl = document.createElement('style');
        styleEl.id = 'vnpost-shadow-style';
        styleEl.textContent = typeof PANEL_CSS !== 'undefined' ? PANEL_CSS : '';
        root.appendChild(styleEl);
      }

      const panel = document.createElement('div');
      panel.id = 'vnpost-autofill-panel';
      panel.dataset.panelType = 'input';
      applyInitialTheme(panel);
      let __hasExtCtx = false; try { __hasExtCtx = typeof chrome !== 'undefined' && chrome.runtime && !!chrome.runtime.id; } catch(e) {}; if (__hasExtCtx && chrome.storage && chrome.storage.local) {
        try {
          chrome.storage.local.get(['antigravity_ui_theme'], (res) => {
            if (chrome.runtime.lastError) return;
            if (res && res.antigravity_ui_theme === 'dark') {
              panel.classList.remove('light-mode');
              try { localStorage.setItem('antigravity_ui_theme', 'dark'); } catch (_) {}
            } else if (res && res.antigravity_ui_theme === 'light') {
              panel.classList.add('light-mode');
              try { localStorage.setItem('antigravity_ui_theme', 'light'); } catch (_) {}
            }
          });
        } catch (_) {}
      }
      const themeColor = platformObj.themeColor || (platformObj.id === "vnpost" ? "#0056b3" : "#4f46e5");
      panel.style.setProperty('--theme-color', themeColor);

      const isVNPost = platformObj.id === "vnpost";
      const vnpostBtnStyle = isVNPost ? `display: inline-flex; background-color: #10b981;` : `display: none;`;
      const jtBtnStyle = !isVNPost ? `display: inline-flex; background-color: #e11d48;` : `display: none;`;

      let _manifestVersion = 'v1';
      try {
        let __hasExtCtx2 = false; try { __hasExtCtx2 = typeof chrome !== 'undefined' && chrome.runtime && !!chrome.runtime.getManifest; } catch(e) {}; if (__hasExtCtx2) {
          _manifestVersion = 'v' + (chrome.runtime.getManifest().version || '1');
        }
      } catch (_) {}

      panel.innerHTML = `
        <div class="minimized-icon">${PANEL_ICONS.parse}</div>
        
        <!-- HEADER TOPBAR -->
        <div id="vnpost-panel-header">
          <div class="vnpost-header-main">
            <div class="vnpost-brand-group">
              <span class="brand-live-dot" title="Sẵn sàng hoạt động"></span>
              <span id="vnpost-panel-header-text" class="brand-title"></span>
              <span id="vnpost-panel-version-badge" class="panel-version-badge" title="Phiên bản Auto Fill Order">${_manifestVersion}</span>
            </div>
            <div class="vnpost-header-controls">
              <span id="vnpost-api-status" title="Kiểm tra kết nối..." class="api-status-badge">${PANEL_ICONS.apiWaiting}</span>
              <button id="vnpost-btn-toggle-draft-queue" class="panel-header-btn" title="Bật / Tắt Hàng đợi đơn nháp" style="position:relative;">📥<span id="header-draft-count-badge" class="header-draft-badge" style="display:none;">0</span></button>
              <button id="vnpost-btn-dock-toggle" title="Thả nổi / Ghim panel">${PANEL_ICONS.float}</button>
              <button id="vnpost-btn-theme" title="Chuyển chế độ Sáng / Tối">${PANEL_ICONS.theme}</button>
              <button id="vnpost-btn-settings" title="Cài đặt & Quản lý">${PANEL_ICONS.settings}</button>
              <button id="vnpost-btn-minimize" title="Thu nhỏ">${PANEL_ICONS.minimize}</button>
            </div>
          </div>
          <div class="panel-context-strip" aria-label="Ngữ cảnh lên đơn">
            <div class="panel-context-shop">🏪 <span id="panel-shop-name" class="panel-context-value context-missing">Chưa chọn Shop</span></div>
            <button id="panel-account-trigger" class="panel-account-trigger" type="button" aria-expanded="false" aria-haspopup="menu">
              👤 <span id="panel-user-account" class="panel-context-value context-missing">Chưa xác định</span>
              <span class="context-separator">·</span>
              <span id="panel-carrier-account" class="panel-context-value context-missing">Chưa nhận diện</span>
            </button>
            <div id="panel-account-menu" class="panel-account-menu" role="menu" hidden>
              <strong id="panel-menu-user">---</strong><span id="panel-menu-carrier">---</span>
              <hr><span id="panel-menu-shop">---</span><span>${platformObj.title || ''}</span>
              <hr><div class="panel-menu-version-row" style="font-size:11px; color:#94a3b8; padding:3px 8px; font-weight:600; display:flex; justify-content:space-between; align-items:center;">
                <span>Phiên bản:</span>
                <span class="menu-version-badge" style="color:#38bdf8; font-weight:700;">${_manifestVersion}</span>
              </div><hr>
              <button id="panel-menu-settings" type="button" role="menuitem">⚙ Cài đặt</button>
              <button id="panel-menu-logout" type="button" role="menuitem">⇥ Đăng xuất</button>
            </div>
          </div>
        </div>

        <div id="vnpost-panel-body">
          <!-- HÀNG ĐỢI ĐƠN NHÁP (DRAFT QUEUE NAVIGATOR) -->
          <div id="vnpost-draft-queue" class="draft-queue-container" style="display:none;">
            <div class="draft-queue-header">
              <div class="draft-queue-title-group">
                <span class="draft-queue-icon">📥</span>
                <span class="draft-queue-title">Hàng Đợi Đơn Nháp</span>
                <span id="draft-queue-badge" class="draft-queue-badge">0 đơn</span>
                <span id="draft-queue-mini-summary" class="draft-queue-mini-summary" style="display:none;"></span>
              </div>
              <div class="draft-queue-header-actions">
                <button id="btn-draft-queue-toggle-collapse" class="draft-queue-btn-collapse" type="button" title="Thu gọn / Mở rộng hàng đợi">▲</button>
                <button id="btn-draft-queue-clear" class="draft-queue-close" type="button" title="Ẩn / Tắt hàng đợi này">✕</button>
              </div>
            </div>
            <div class="draft-queue-body">
              <div class="draft-queue-nav">
                <button id="btn-draft-prev" class="draft-nav-btn" title="Đơn trước">◀</button>
                <div class="draft-current-info">
                  <div id="draft-current-index" class="draft-index-text">Đơn 1/1</div>
                  <div id="draft-current-summary" class="draft-summary-text">---</div>
                </div>
                <button id="btn-draft-next" class="draft-nav-btn" title="Đơn kế tiếp">▶</button>
              </div>
              <div class="draft-queue-actions-container">
                <div class="draft-queue-primary-row">
                  <button id="btn-draft-load" class="btn-draft-action-primary" title="Nạp đơn này vào bảng kiểm tra">
                    ⚡ <span>Nạp Vào Bảng</span>
                  </button>
                  <button id="btn-draft-fill-next" class="btn-draft-action-success" title="Điền vào form bưu điện và tự chuyển sang đơn kế tiếp">
                    ⏩ <span>Điền & Đơn Tiếp</span>
                  </button>
                </div>
                <div class="draft-queue-secondary-row">
                  <button id="btn-draft-delete" class="btn-draft-action-ghost-danger" title="Xóa đơn này khỏi hàng đợi nháp">
                    🗑️ <span>Xóa đơn này</span>
                  </button>
                  <button id="btn-draft-clear-all" class="btn-draft-action-ghost-warning" title="Dọn sạch toàn bộ các đơn nháp trong hàng đợi">
                    🧹 <span>Xóa tất cả</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div id="source-order-card" class="input-card" aria-expanded="true">
            <div class="input-card-header">
              <span id="source-card-title" class="input-card-title">📝 Nội dung đơn hàng</span>
              <div class="source-card-header-actions">
                <span id="source-dirty-badge" class="source-dirty-badge" style="display:none;">● Đã thay đổi</span>
                <span class="input-kbd-shortcut" title="Phím tắt tách nhanh">Ctrl + ↵</span>
                <button id="btn-edit-source" class="source-edit-btn" type="button" style="display:none;" title="Mở nội dung gốc để chỉnh sửa">✎ Sửa</button>
              </div>
            </div>
            <div id="source-expanded-content">
              <!-- KHUNG XEM TRƯỚC ẢNH KHI DÁN (Ctrl+V) HOẶC KÉO THẢ VÀO Ô NHẬP LIỆU -->
              <div id="panel-image-paste-preview" class="panel-image-paste-preview" style="display:none;">
                <div class="image-preview-thumb-wrap">
                  <img id="panel-pasted-img" src="" alt="Ảnh đơn hàng đã dán" />
                  <div class="image-preview-meta">
                    <span class="image-preview-badge">📷 Ảnh đơn hàng</span>
                    <span id="panel-pasted-img-info" class="image-preview-info"></span>
                  </div>
                  <button id="btn-remove-pasted-img" class="btn-remove-pasted-img" type="button" title="Gỡ ảnh">✕</button>
                </div>
                <div id="panel-image-ocr-status" class="panel-image-ocr-status" style="display:none;">
                  <span class="spinner-inline">⏳</span> <span id="panel-image-ocr-status-text">Đang nhận diện đơn qua Gemini Vision...</span>
                </div>
              </div>
              <textarea id="rawOrderText" rows="3" placeholder="Dán văn bản hoặc DÁN ẢNH (Ctrl+V) / Kéo thả ảnh đơn hàng vào đây...&#10;(Hỗ trợ ảnh chụp màn hình Zalo, Facebook, hóa đơn, bưu gửi)"></textarea>
              <div id="source-dirty-message" class="source-dirty-message" style="display:none;">Nội dung nguồn đã thay đổi. Kết quả bên dưới chưa được cập nhật.</div>
              <div class="input-card-actions">
                <button id="btnParseOrder" class="btn-parse-primary">
                  ${PANEL_ICONS.parse} <span>Tách Đơn Tự Động</span>
                </button>
                <button id="btnClearOrder" class="btn-clear-secondary">
                  ${PANEL_ICONS.clear} <span>Xóa</span>
                </button>
              </div>
            </div>
            <button id="source-collapsed-preview" class="source-collapsed-preview" type="button" style="display:none;" aria-label="Mở nội dung đơn hàng gốc để đối chiếu và chỉnh sửa">
              <span id="source-preview-primary" class="source-preview-primary">Nội dung đơn hàng gốc</span>
              <span id="source-preview-address" class="source-preview-address">---</span>
              <span class="source-preview-hint"><span>Bấm để chỉnh sửa nội dung thô</span><span aria-hidden="true">→</span></span>
            </button>
          </div>

          <div id="panel-empty-state" class="panel-empty-state">
            <strong>Chưa có đơn hàng</strong>
            <span>Dán nội dung đơn hàng ở trên để bắt đầu xử lý.</span>
          </div>

          <!-- CẢNH BÁO TRÙNG ĐƠN TRONG NGÀY -->
          <div id="panel-duplicate-alert" class="panel-duplicate-alert" style="display:none;" role="alert">
            <div class="duplicate-alert-header">
              <span id="panel-duplicate-title" class="duplicate-alert-title">
                <svg class="duplicate-alert-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                <span>ĐƠN ĐÃ LÊN TRONG NGÀY</span>
              </span>
              <span class="duplicate-alert-header-right">
                <span id="panel-duplicate-time" class="duplicate-alert-time">Hôm nay</span>
                <button type="button" id="btn-close-duplicate-alert" class="duplicate-alert-close" title="Đóng cảnh báo trùng đơn">✕</button>
              </span>
            </div>
            <div id="panel-duplicate-message" class="duplicate-alert-message"></div>
            <div id="panel-duplicate-details" class="duplicate-alert-details"></div>
          </div>

          <div id="panel-validation-error" class="panel-validation-error" hidden>
            <strong>⚠ CẦN KIỂM TRA</strong>
            <div id="panel-validation-checklist"></div>
            <p id="panel-validation-message"></p>
            <button id="panel-fix-information" type="button">Sửa thông tin</button>
          </div>

          <!-- REVIEW BENTO PANEL (V2 DECISION-FIRST) -->
          <div id="review-panel">
            <div class="review-header-v2">
              <span class="review-section-title">⚡ Dữ liệu đã bóc tách</span>
              <span id="rev-ai-confidence" class="ai-confidence-badge" style="display:none;"></span>
              <span class="review-edit-badge">✏️ Bấm để sửa nhanh</span>
            </div>

            <div class="bento-grid-v2">
              <div class="bento-cell">
                <span class="bento-label" id="rev-customer-label">${PANEL_ICONS.user} Khách hàng <span id="rev-customer-order-count" class="customer-order-count-badge" style="display:none; background:#dbeafe; color:#0284c7; padding:0.5px 6px; border-radius:10px; font-weight:700; font-size:10.5px; margin-left:3px;">(0)</span></span>
                <span id="rev-name" class="bento-val review-editable" contenteditable="true" title="Bấm để sửa">---</span>
              </div>

              <div class="bento-cell">
                <div class="bento-label-row">
                  <span class="bento-label">${PANEL_ICONS.phone} Điện thoại</span>
                  <button class="copy-btn mini-copy" data-copy="rev-phone" title="Sao chép SĐT">${PANEL_ICONS.copy}</button>
                </div>
                <span id="rev-phone" class="bento-val review-editable" contenteditable="true" title="Bấm để sửa">---</span>
              </div>

              <div class="bento-cell">
                <span class="bento-label">${PANEL_ICONS.orderCode} Mã đơn</span>
                <span id="rev-code" class="bento-val review-editable" contenteditable="true" title="Bấm để sửa">---</span>
              </div>

              <div class="bento-cell">
                <span class="bento-label">${PANEL_ICONS.fee} Thu cước</span>
                <span id="rev-fee" class="bento-val fee-status fee-status--no">KHÔNG</span>
              </div>
            </div>

            <div class="cod-primary-card">
              <div class="cod-card-left">
                <span class="cod-card-label">💰 TIỀN THU HỘ (COD)</span>
                <span id="rev-cod-status" class="cod-status-badge">✓ Hợp lệ</span>
              </div>
              <div class="cod-card-right">
                <span id="rev-cod" class="cod-primary-val review-editable" contenteditable="true" title="Bấm để chỉnh sửa tiền COD">0 đ</span>
              </div>
            </div>

            <div class="address-engine-card">
              <div class="address-engine-header">
                <div class="address-title-group">
                  <span class="address-engine-title">📍 ĐỊA CHỈ GIAO HÀNG</span>
                  <span id="address-status-badge" class="address-verified-badge">✓ Đã tối ưu</span>
                </div>
                <button class="copy-btn" data-copy="rev-address" title="Sao chép địa chỉ">${PANEL_ICONS.copy}</button>
              </div>

              <div class="address-main-box">
                <span id="rev-address" class="address-text-main review-editable" contenteditable="true" title="Bấm để chỉnh sửa trực tiếp">---</span>
              </div>

              <details id="address-reference-disclosure" class="address-reference-disclosure">
                <summary>
                  <span class="address-reference-title">Gợi ý tham khảo để đối chiếu</span>
                  <span id="address-reference-status" class="address-reference-status">Đã bóc tách</span>
                </summary>
                <div id="address-reference-box" class="address-reference-box" aria-live="polite">
                <button class="address-reference-option" data-address-format="clean" type="button" title="Áp dụng địa chỉ 3 cấp đầy đủ">
                  <span class="address-reference-label">✨ 3 Cấp đầy đủ</span>
                  <span id="rev-suggest-clean" class="address-reference-value">---</span>
                </button>
                <button class="address-reference-option" data-address-format="2level" type="button" title="Áp dụng địa chỉ 2 cấp mới">
                  <span class="address-reference-label">🎯 2 Cấp mới</span>
                  <span id="rev-suggest-2level" class="address-reference-value">---</span>
                </button>
                  <span class="address-reference-help">Bấm vào gợi ý nếu muốn thay địa chỉ giao hàng.</span>
                </div>
              </details>

              <div class="address-format-bar">
                <span class="format-bar-label">Đổi chuẩn:</span>
                <button id="btn-switch-clean" class="format-pill-btn active" title="Dùng địa chỉ đầy đủ 3 cấp">✨ 3 Cấp đầy đủ</button>
                <button id="btn-switch-2level" class="format-pill-btn" title="Dùng địa chỉ quy đổi 2 cấp">🎯 2 Cấp mới</button>
              </div>

              <div class="address-accordion">
                <button id="address-accordion-btn" class="accordion-toggle-btn" type="button">
                  <span>⚙ Chi tiết chuẩn hóa địa giới</span>
                  <span id="accordion-arrow" class="accordion-arrow">▾</span>
                </button>
                <div id="address-accordion-content" class="accordion-content" style="display: none;">
                  <div id="ai-merger-notice" style="display: none;"></div>
                  <div class="accordion-detail-row">
                    <span class="acc-label">Địa chỉ gốc:</span>
                    <span id="rev-raw-address" class="acc-val">---</span>
                  </div>
                  <div class="accordion-detail-grid">
                    <div class="acc-grid-item">
                      <span class="acc-sublabel">Phường/Xã:</span>
                      <span id="rev-addr-ward" class="acc-subval">---</span>
                    </div>
                    <div class="acc-grid-item">
                      <span class="acc-sublabel">Quận/Huyện:</span>
                      <span id="rev-addr-district" class="acc-subval">---</span>
                    </div>
                    <div class="acc-grid-item acc-full">
                      <span class="acc-sublabel">Tỉnh/TP:</span>
                      <span id="rev-addr-province" class="acc-subval">---</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <section id="customer-history-card" class="customer-history-card" hidden>
            <div class="customer-history-heading">
              <div class="customer-history-title-wrap">
                <span class="customer-history-icon">🕒</span>
                <strong>Lịch sử khách hàng</strong>
                <span id="customer-history-count" class="customer-history-count-badge" title="Số đơn đã lên" aria-label="Số đơn đã lên" hidden></span>
              </div>
              <button id="customer-history-search-toggle" type="button" class="customer-history-toggle-btn" title="Tìm kiếm theo SĐT khác">🔍</button>
            </div>
            <div id="customer-history-search-row" class="customer-history-search-row" style="display: none;">
              <input id="customer-history-search" type="search" placeholder="Nhập tên hoặc SĐT khách hàng khác..." autocomplete="off">
              <button id="customer-history-search-btn" type="button">Tìm</button>
            </div>
            <div id="customer-history-result" class="customer-history-result">Đang cập nhật lịch sử khách hàng...</div>
          </section>
        </div>

        <div id="panel-sticky-footer" class="panel-sticky-footer">
          <div id="order-readiness-bar" class="order-readiness-bar readiness-idle">
            <span class="readiness-dot"></span>
            <span id="readiness-text" class="readiness-text">⚪ Chờ bóc tách nội dung đơn</span>
          </div>
          <div class="panel-bottom-actions">
            <button id="btnFillVNPost" class="btn-fill btn-fill-vnpost" style="${vnpostBtnStyle};" disabled>
              ${PANEL_ICONS.fill} <span>Nhập đơn</span>
            </button>
            <button id="btnFillJT" class="btn-fill btn-fill-jt" style="${jtBtnStyle};" disabled>
              ${PANEL_ICONS.fill} <span>Nhập đơn</span>
            </button>
            <button id="btnSaveOrder" class="btn-fill btn-save-order" disabled>
              ${PANEL_ICONS.save} <span>Lưu đơn</span>
            </button>
          </div>
          <div id="gemini-progress-container" aria-label="Tiến trình bóc tách đơn hàng">
            <span id="ai-status" hidden>Đang xử lý</span><span id="ai-percent" hidden>0%</span>
            <span id="parse-step-customer" hidden></span><span id="parse-step-phone" hidden></span>
            <span id="parse-step-cod" hidden></span><span id="parse-step-address" hidden></span>
            <div class="progress-bar-bg"><div id="gemini-progress-bar"></div></div>
          </div>
        </div>
      `;

      root.appendChild(panel);
      const staleDockTab = root.querySelector('#vnpost-dock-toggle-tab');
      if (staleDockTab) staleDockTab.remove();
      const dockTab = document.createElement('div');
      dockTab.id = 'vnpost-dock-toggle-tab';
      dockTab.textContent = 'AUTO FILL';
      dockTab.title = 'Mở bảng Auto Fill';
      dockTab.style.setProperty('--theme-color', themeColor);
      root.appendChild(dockTab);
      
      const _headerTextEl = root.getElementById('vnpost-panel-header-text');
      if (_headerTextEl) _headerTextEl.textContent = platformObj.title || '';

      let _lastUserName = '';
      let _lastShopName = '';

      const refreshHeaderContextPills = () => {
        try {
          const shopEl = root.getElementById('panel-shop-name');
          const userEl = root.getElementById('panel-user-account');
          const carrierEl = root.getElementById('panel-carrier-account');
          const carrierAcc = typeof globalThis.detectCarrierAccount === 'function' ? globalThis.detectCarrierAccount(platformObj.id) : '';

          // 1. Shop Pill
          if (shopEl) {
            if (_lastShopName) {
              shopEl.textContent = _lastShopName;
              shopEl.title = `Shop đang làm việc: ${_lastShopName}`;
              shopEl.classList.remove('context-missing');
            } else {
              shopEl.textContent = 'Chưa chọn Shop';
              shopEl.title = 'Chưa xác định Shop đang làm việc';
              shopEl.classList.add('context-missing');
            }
          }

          // 2. Tài khoản đang đăng nhập Extension
          if (userEl) {
            const cleanU = _lastUserName && (_lastUserName.includes('@') ? _lastUserName.split('@')[0] : _lastUserName);
            userEl.textContent = cleanU || 'Chưa xác định tài khoản';
            userEl.title = cleanU ? `Tài khoản đăng nhập tiện ích: ${_lastUserName}` : 'Chưa xác định tài khoản đăng nhập Extension';
            userEl.classList.toggle('context-missing', !cleanU);
          }

          // 3. Tài khoản bưu điện đang đăng nhập trên trang hãng
          if (carrierEl) {
            carrierEl.textContent = carrierAcc || 'Chưa nhận diện tài khoản';
            carrierEl.title = carrierAcc ? `Tài khoản bưu điện trên ${platformObj.title}: ${carrierAcc}` : `Chưa nhận diện tài khoản bưu điện trên ${platformObj.title}`;
            carrierEl.classList.toggle('context-missing', !carrierAcc);
          }

          const cleanUser = _lastUserName && (_lastUserName.includes('@') ? _lastUserName.split('@')[0] : _lastUserName);
          const menuUser = root.getElementById('panel-menu-user');
          const menuCarrier = root.getElementById('panel-menu-carrier');
          const menuShop = root.getElementById('panel-menu-shop');
          if (menuUser) menuUser.textContent = cleanUser || 'Chưa xác định tài khoản';
          if (menuCarrier) menuCarrier.textContent = carrierAcc || 'Chưa nhận diện tài khoản bưu điện';
          if (menuShop) menuShop.textContent = _lastShopName || 'Chưa chọn Shop';
        } catch (_) {}
      };

      const updateAuthAndShopInfoInPanel = () => {
        try {
          if (typeof AuthSession !== 'undefined' && typeof AuthSession.getSession === 'function') {
            AuthSession.getSession().then(session => {
              if (session) {
                _lastUserName = session.user?.full_name || session.user?.username || session.user?.email || '';
                _lastShopName = session.shop_name || '';
                refreshHeaderContextPills();
              }
            }).catch(() => {});
          }

          let __hasExtCtx = false; try { __hasExtCtx = typeof chrome !== 'undefined' && chrome.runtime && !!chrome.runtime.id; } catch(e) {}; if (__hasExtCtx && chrome.storage && chrome.storage.local) {
            chrome.storage.local.get(['vnpost_session', 'activeShopName', 'activeShop', 'currentUser'], (res) => {
              if (chrome.runtime && chrome.runtime.lastError) return;
              if (res) {
                const s = res.vnpost_session;
                if (!_lastUserName && s) {
                  _lastUserName = s.user?.full_name || s.user?.username || s.user?.email || res.currentUser || '';
                }
                if (!_lastShopName) {
                  _lastShopName = s?.shop_name || res.activeShopName || (res.activeShop ? (typeof res.activeShop === 'object' ? res.activeShop.name : 'Shop #' + res.activeShop) : '');
                }
                refreshHeaderContextPills();
              }
            });
          }
        } catch (_) {}
      };

      updateAuthAndShopInfoInPanel();
      setInterval(refreshHeaderContextPills, 2500);
      setInterval(updateAuthAndShopInfoInPanel, 4000);

      try {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id && chrome.storage && chrome.storage.onChanged) {
          chrome.storage.onChanged.addListener((changes, area) => {
            if (area === 'local' && (changes.vnpost_session || changes.activeShopName || changes.activeShop || changes.currentUser)) {
              updateAuthAndShopInfoInPanel();
            }
          });
        }
      } catch (_) {}

      makeElementDraggable(panel, root.getElementById("vnpost-panel-header"));

      const btnDockToggle = root.getElementById('vnpost-btn-dock-toggle');
      dockTab.addEventListener('click', (e) => {
        e.stopPropagation();
        applyPanelDisplayMode(panel, dockTab, btnDockToggle, 'docked', { collapsed: false });
        panelStorage.set({
          panel_display_mode: 'docked',
          panel_dock_collapsed: false,
          panelMinimized: false,
        });
      });

      panelStorage.get(['panel_display_mode', 'panel_dock_collapsed', 'panel_float_position', 'panelMinimized', 'antigravity_ui_theme'], (res = {}) => {
        const mode = res.panel_display_mode === 'floating' ? 'floating' : 'docked';
        const collapsed = Boolean(res.panel_dock_collapsed || (res.panel_display_mode === undefined && res.panelMinimized));
        if (mode === 'floating' && res.panelMinimized) {
          panel.classList.add('minimized');
        }
        applyPanelDisplayMode(panel, dockTab, btnDockToggle, mode, {
          collapsed,
          position: res.panel_float_position,
        });
        if (res.antigravity_ui_theme !== undefined) {
          if (res.antigravity_ui_theme === 'dark') {
            panel.classList.remove('light-mode');
            try { localStorage.setItem('antigravity_ui_theme', 'dark'); } catch (_) {}
          } else {
            panel.classList.add('light-mode');
            try { localStorage.setItem('antigravity_ui_theme', 'light'); } catch (_) {}
          }
        }
      });

      root.getElementById('btnParseOrder').addEventListener('click', onParseHandler);
      const btnAiVerify = root.getElementById('btnAiVerify');
      if (btnAiVerify) {
        btnAiVerify.addEventListener('click', () => {
          if (typeof globalThis.handleAiVerifyManual === 'function') {
            globalThis.handleAiVerifyManual();
          }
        });
      }
      root.getElementById('btnClearOrder').addEventListener('click', onClearHandler);
      root.getElementById('btnFillVNPost').addEventListener('click', function() { onFillHandler('vnpost'); });
      root.getElementById('btnFillJT').addEventListener('click', function() { onFillHandler('jt'); });

      const accountTrigger = root.getElementById('panel-account-trigger');
      const accountMenu = root.getElementById('panel-account-menu');
      const closeAccountMenu = () => {
        if (!accountMenu || !accountTrigger) return;
        accountMenu.hidden = true;
        accountTrigger.setAttribute('aria-expanded', 'false');
      };
      accountTrigger?.addEventListener('click', (event) => {
        event.stopPropagation();
        accountMenu.hidden = !accountMenu.hidden;
        accountTrigger.setAttribute('aria-expanded', String(!accountMenu.hidden));
      });
      root.getElementById('panel-menu-settings')?.addEventListener('click', () => {
        closeAccountMenu();
        if (typeof onSettingsClickHandler === 'function') onSettingsClickHandler();
      });
      root.getElementById('panel-menu-logout')?.addEventListener('click', async () => {
        closeAccountMenu();
        if (typeof AuthService !== 'undefined' && typeof AuthService.logout === 'function') {
          await AuthService.logout();
          if (typeof globalThis.checkUrlAndInject === 'function') globalThis.checkUrlAndInject();
        }
      });
      document.addEventListener('pointerdown', closeAccountMenu);

      root.getElementById('panel-fix-information')?.addEventListener('click', () => {
        root.querySelector('.review-editable.is-invalid')?.focus();
      });

      const normalizeCustomerLookup = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
      const fetchCloudCustomerSummary = async (rawQuery) => {
        if (typeof AuthSession === 'undefined' || typeof AuthSession.getSession !== 'function' || typeof SupabaseCloud === 'undefined') return null;
        const session = await AuthSession.getSession().catch(() => null);
        const config = await SupabaseCloud.loadConfig().catch(() => null);
        if (!session?.active_shop_id || !session?.access_token || !config?.url || !config?.anonKey) return null;
        const phone = String(rawQuery || '').replace(/\D/g, '').replace(/^84(?=\d{9}$)/, '0');
        if (phone.length < 9) return null;
        const headers = { apikey: config.anonKey, Authorization: `Bearer ${session.access_token}` };
        const base = `${String(config.url).replace(/\/$/, '')}/rest/v1`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 1200);
        try {
          const response = await fetch(`${base}/rpc/customer_hub_lookup`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_shop_id: session.active_shop_id, p_phone: phone }), signal: controller.signal });
          if (!response.ok) return null;
          const customer = await response.json();
          if (!customer) return { customer: null, orders: [], addresses: [] };
          const [ordersResponse, addressesResponse] = await Promise.all([
            fetch(`${base}/customer_order_links?shop_id=eq.${encodeURIComponent(session.active_shop_id)}&customer_id=eq.${customer.id}&order=ordered_at.desc&limit=5&select=*`, { headers, signal: controller.signal }),
            fetch(`${base}/customer_addresses?shop_id=eq.${encodeURIComponent(session.active_shop_id)}&customer_id=eq.${customer.id}&order=successful_delivery_count.desc,last_used_at.desc&limit=3&select=*`, { headers, signal: controller.signal })
          ]);
          return { customer, orders: ordersResponse.ok ? await ordersResponse.json() : [], addresses: addressesResponse.ok ? await addressesResponse.json() : [] };
        } catch (_) { return null; }
        finally { clearTimeout(timeout); }
      };
      const setCustomerOrderCountBadge = (cnt) => {
        const badge = root.getElementById('rev-customer-order-count');
        if (!badge) return;
        const num = parseInt(cnt, 10) || 0;
        if (num > 0) {
          badge.textContent = `(${num})`;
          badge.style.display = 'inline-flex';
          badge.title = `Khách hàng này đã từng lên ${num} đơn hàng thành công`;
        } else {
          badge.style.display = 'none';
          badge.textContent = '';
        }
      };
      globalThis.setPanelCustomerOrderCountBadge = setCustomerOrderCountBadge;

      const formatHistoryDateTime = (dateVal) => {
        if (!dateVal) return '---';
        try {
          const d = new Date(dateVal);
          if (isNaN(d.getTime())) return String(dateVal);
          const now = new Date();
          const isToday = d.toDateString() === now.toDateString();
          const hours = String(d.getHours()).padStart(2, '0');
          const mins = String(d.getMinutes()).padStart(2, '0');
          const timeStr = `${hours}:${mins}`;
          const day = String(d.getDate()).padStart(2, '0');
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const year = d.getFullYear();
          if (isToday) return `Hôm nay ${timeStr}`;
          return `${timeStr} · ${day}/${month}/${year}`;
        } catch (_) {
          return String(dateVal);
        }
      };

      const formatHistoryFullDateTime = (dateVal) => {
        if (!dateVal) return 'Chưa rõ thời gian';
        try {
          const d = new Date(dateVal);
          if (isNaN(d.getTime())) return String(dateVal);
          const hours = String(d.getHours()).padStart(2, '0');
          const mins = String(d.getMinutes()).padStart(2, '0');
          const secs = String(d.getSeconds()).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const year = d.getFullYear();
          return `${hours}:${mins}:${secs} ngày ${day}/${month}/${year}`;
        } catch (_) {
          return String(dateVal);
        }
      };

      const lookupCustomerHistory = async (query) => {
        const card = root.getElementById('customer-history-card');
        const resultEl = root.getElementById('customer-history-result');
        const countEl = root.getElementById('customer-history-count');
        if (!card || !resultEl) return;

        const rawQuery = String(query || '').trim();
        if (!rawQuery) {
          card.hidden = true;
          resultEl.textContent = 'Chưa có thông tin khách hàng để xem lịch sử.';
          if (countEl) { countEl.textContent = ''; countEl.hidden = true; }
          setCustomerOrderCountBadge(0);
          return;
        }

        card.hidden = false;
        resultEl.replaceChildren();
        const loadingEl = document.createElement('div');
        loadingEl.className = 'customer-history-loading';
        loadingEl.textContent = '⏳ Đang tải lịch sử đơn hàng...';
        resultEl.appendChild(loadingEl);

        const queryPhone = rawQuery.replace(/\D/g, '');
        const queryName = normalizeCustomerLookup(rawQuery);

        // Lấy đồng thời từ Supabase Cloud và kho OrderStorage
        const [cloud, localOrders] = await Promise.all([
          fetchCloudCustomerSummary(rawQuery).catch(() => null),
          (async () => {
            try {
              if (typeof OrderStorage !== 'undefined') {
                if (typeof OrderStorage._getSubmittedOrdersFromLocal === 'function') {
                  const local = await OrderStorage._getSubmittedOrdersFromLocal().catch(() => []);
                  if (Array.isArray(local) && local.length > 0) return local;
                }
                if (typeof OrderStorage.getSubmittedOrders === 'function') {
                  return await OrderStorage.getSubmittedOrders().catch(() => []);
                }
              }
            } catch (_) {}
            return [];
          })()
        ]);

        // Lọc các đơn từ localOrders khớp với SĐT hoặc Tên của khách
        const matchedLocal = (localOrders || []).filter(order => {
          if (!order) return false;
          const phone = String(order.phone || '').replace(/\D/g, '');
          const name = normalizeCustomerLookup(order.name || order.customer_name || '');
          if (queryPhone.length >= 7) {
            return phone === queryPhone || phone.endsWith(queryPhone) || queryPhone.endsWith(phone);
          }
          return queryName.length >= 2 && (name.includes(queryName) || queryName.includes(name));
        });

        // Hợp nhất và chống trùng lặp danh sách đơn hàng
        const combinedOrders = [];
        const seenKeys = new Set();
        const addOrder = (order) => {
          if (!order) return;
          const code = String(order.orderCode || order.order_code || order.source_order_id || '').trim();
          const tracking = String(order.trackingCode || order.tracking_code || '').trim();
          const id = String(order.id || '').trim();
          const dedupeKey = tracking || code || id;
          if (dedupeKey && seenKeys.has(dedupeKey)) return;
          if (dedupeKey) seenKeys.add(dedupeKey);

          const rawDate = order.submittedAt || order.submitted_at || order.ordered_at || order.createdAt || order.created_at || null;
          const cod = Number(order.codAmount ?? order.cod_amount ?? order.cod ?? 0);
          const name = String(order.name || order.customer_name || cloud?.customer?.name || '').trim();
          const phone = String(order.phone || cloud?.customer?.normalized_phone || cloud?.customer?.phone || '').trim();
          const address = String(order.address || order.raw_address || '').trim();
          const carrier = String(order.carrier || order.platform || '').trim();
          const status = String(order.status || 'success').trim();
          const goods = String(order.goods || order.productItem || order.product || order.items || '').trim();
          const note = String(order.note || order.extraNote || order.notes || '').trim();

          combinedOrders.push({
            id,
            orderCode: code,
            trackingCode: tracking,
            name,
            phone,
            address,
            codAmount: cod,
            carrier,
            status,
            submittedAt: rawDate,
            goods,
            note
          });
        };

        // Đưa local orders vào trước (thường đầy đủ thông tin hàng hóa, địa chỉ hơn)
        matchedLocal.forEach(addOrder);
        // Đưa cloud orders vào
        (cloud?.orders || []).forEach(addOrder);

        // Sắp xếp đơn mới nhất lên đầu
        combinedOrders.sort((a, b) => {
          const timeA = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
          const timeB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
          return timeB - timeA;
        });

        const customerData = cloud?.customer || null;
        const totalCount = Math.max(
          Number(customerData?.total_orders || 0),
          combinedOrders.length
        );

        if (countEl) {
          countEl.textContent = `${totalCount} đơn`;
          countEl.hidden = totalCount === 0;
          countEl.setAttribute('aria-label', `${totalCount} đơn đã lên`);
        }
        setCustomerOrderCountBadge(totalCount);

        resultEl.replaceChildren();

        // 1. Render thông tin khách hàng & phân khúc LTV
        const headerInfo = document.createElement('div');
        headerInfo.className = 'customer-history-profile';
        
        const customerNameEl = document.createElement('div');
        customerNameEl.className = 'customer-history-name-row';
        const nameVal = customerData?.name || (matchedLocal[0] && (matchedLocal[0].name || matchedLocal[0].customer_name)) || rawQuery;
        const phoneVal = customerData?.normalized_phone || customerData?.phone || queryPhone || '';
        customerNameEl.innerHTML = `<strong>${escapeHTML(nameVal)}</strong>${phoneVal ? `<span class="customer-history-phone"> · ${escapeHTML(phoneVal)}</span>` : ''}`;
        headerInfo.appendChild(customerNameEl);

        const summary = document.createElement('div');
        summary.className = `customer-history-summary risk-${customerData?.risk_level || 'safe'}`;
        const segmentLabels = { vip: 'VIP', repeat: 'Khách quen', churn_risk: 'Ngủ đông', risk: 'Cần kiểm tra', new: 'Khách mới' };
        const seg = customerData?.segment || (totalCount >= 5 ? 'vip' : (totalCount >= 2 ? 'repeat' : 'new'));
        const ltv = Number(customerData?.total_spent || customerData?.total_cod || combinedOrders.reduce((sum, o) => sum + (o.codAmount || 0), 0));
        summary.textContent = `${segmentLabels[seg] || 'Khách hàng'} · LTV ${ltv.toLocaleString('vi-VN')} đ${customerData?.is_blacklisted ? ` · ⚠️ CẢNH BÁO: ${customerData.blacklist_reason || 'Danh sách đen'}` : ''}`;
        headerInfo.appendChild(summary);
        resultEl.appendChild(headerInfo);

        // 2. Render danh sách đơn hàng đã lên (Hiển thị mã đơn, ngày giờ lên đơn, bấm vào xem chi tiết)
        if (combinedOrders.length > 0) {
          const ordersSectionTitle = document.createElement('div');
          ordersSectionTitle.className = 'customer-history-subheading';
          ordersSectionTitle.innerHTML = `<span>Đơn đã lên (${combinedOrders.length}) — Bấm vào để xem chi tiết:</span>`;
          resultEl.appendChild(ordersSectionTitle);

          const orderList = document.createElement('div');
          orderList.className = 'customer-history-orders';

          combinedOrders.slice(0, 10).forEach((order, idx) => {
            const item = document.createElement('div');
            item.className = 'customer-history-order is-clickable';
            item.setAttribute('tabindex', '0');
            item.setAttribute('role', 'button');
            item.setAttribute('aria-expanded', 'false');

            const orderCodeDisplay = order.orderCode || order.trackingCode || `Đơn #${idx + 1}`;
            const timeDisplay = formatHistoryDateTime(order.submittedAt);
            const codDisplay = Number(order.codAmount || 0).toLocaleString('vi-VN') + ' đ';
            const carrierDisplay = (order.carrier || '').toUpperCase();

            // Summary Header row
            const summaryRow = document.createElement('div');
            summaryRow.className = 'customer-history-order-summary';
            summaryRow.innerHTML = `
              <div class="customer-history-order-left">
                <div class="customer-history-order-code">
                  <span class="order-code-title">Mã: ${escapeHTML(orderCodeDisplay)}</span>
                  ${order.trackingCode && order.trackingCode !== order.orderCode ? `<span class="order-tracking-pill" title="Mã vận đơn">${escapeHTML(order.trackingCode)}</span>` : ''}
                </div>
                <div class="customer-history-order-meta">
                  ${carrierDisplay ? `<span class="order-carrier-badge carrier-${carrierDisplay.toLowerCase()}">${escapeHTML(carrierDisplay)}</span>` : ''}
                  <span class="order-time-badge" title="Thời gian lên đơn">🕒 ${escapeHTML(timeDisplay)}</span>
                </div>
              </div>
              <div class="customer-history-order-right">
                <span class="customer-history-order-cod" title="Tiền COD">${escapeHTML(codDisplay)}</span>
                <span class="customer-history-chevron">▾</span>
              </div>
            `;

            // Details Drawer (toggled on click)
            const detailsDrawer = document.createElement('div');
            detailsDrawer.className = 'customer-history-order-details';
            detailsDrawer.style.display = 'none';

            let detailsHtml = '';
            if (order.name || order.phone) {
              detailsHtml += `
                <div class="history-detail-row">
                  <span class="history-detail-label">👤 Khách:</span>
                  <span class="history-detail-val"><strong>${escapeHTML(order.name || 'Người nhận')}</strong> ${order.phone ? `(${escapeHTML(order.phone)})` : ''}</span>
                </div>`;
            }
            if (order.address) {
              detailsHtml += `
                <div class="history-detail-row history-detail-addr-row">
                  <span class="history-detail-label">📍 Địa chỉ:</span>
                  <div class="history-detail-addr-wrap">
                    <span class="history-detail-val">${escapeHTML(order.address)}</span>
                    <button type="button" class="btn-history-apply-addr" title="Điền địa chỉ này vào đơn hiện tại">
                      ✨ Áp dụng địa chỉ này
                    </button>
                  </div>
                </div>`;
            }
            if (order.goods) {
              detailsHtml += `
                <div class="history-detail-row">
                  <span class="history-detail-label">📦 Hàng:</span>
                  <span class="history-detail-val">${escapeHTML(order.goods)}</span>
                </div>`;
            }
            if (order.note) {
              detailsHtml += `
                <div class="history-detail-row">
                  <span class="history-detail-label">📝 Ghi chú:</span>
                  <span class="history-detail-val">${escapeHTML(order.note)}</span>
                </div>`;
            }
            detailsHtml += `
              <div class="history-detail-row history-detail-timing">
                <span class="history-detail-label">⏰ Ngày giờ:</span>
                <span class="history-detail-val">${escapeHTML(formatHistoryFullDateTime(order.submittedAt))}</span>
              </div>`;

            detailsDrawer.innerHTML = detailsHtml;

            // Wire apply address button
            const applyBtn = detailsDrawer.querySelector('.btn-history-apply-addr');
            if (applyBtn && order.address) {
              applyBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                let cleanAddr = order.address;
                if (typeof AddressSanitizer !== 'undefined' && typeof AddressSanitizer.deduplicate === 'function') {
                  cleanAddr = AddressSanitizer.deduplicate(cleanAddr);
                }
                const revAddress = root.getElementById('rev-address');
                const rawAddress = root.getElementById('rev-raw-address');
                if (revAddress) revAddress.textContent = cleanAddr;
                if (rawAddress) rawAddress.textContent = cleanAddr;
                if (globalThis.parsedDataStore) globalThis.parsedDataStore.address = cleanAddr;
                if (typeof refreshAddressSuggestion === 'function') {
                  refreshAddressSuggestion(cleanAddr, globalThis.parsedDataStore?.phone || '');
                }
                if (typeof showVnpostToast === 'function') {
                  showVnpostToast(`✨ Đã áp dụng địa chỉ từ đơn trước (${orderCodeDisplay})!`, 'success');
                }
              });
            }

            // Click on order toggles detail accordion
            item.addEventListener('click', (e) => {
              if (e.target.closest('.btn-history-apply-addr')) return;
              const isCurrentlyOpen = detailsDrawer.style.display !== 'none';
              detailsDrawer.style.display = isCurrentlyOpen ? 'none' : 'grid';
              item.classList.toggle('is-expanded', !isCurrentlyOpen);
              item.setAttribute('aria-expanded', String(!isCurrentlyOpen));
              const chevron = item.querySelector('.customer-history-chevron');
              if (chevron) chevron.textContent = isCurrentlyOpen ? '▾' : '▴';
            });

            item.addEventListener('keydown', (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                item.click();
              }
            });

            item.append(summaryRow, detailsDrawer);
            orderList.appendChild(item);
          });

          resultEl.appendChild(orderList);
        } else {
          const noOrdersNotice = document.createElement('div');
          noOrdersNotice.className = 'customer-history-no-orders';
          noOrdersNotice.textContent = 'Chưa tìm thấy đơn hàng nào đã từng lên của khách hàng này.';
          resultEl.appendChild(noOrdersNotice);
        }

        // 3. Render danh sách địa chỉ từng giao (nếu có từ cloud)
        if (cloud?.addresses?.length) {
          const addressList = document.createElement('div');
          addressList.className = 'customer-history-addresses';
          const title = document.createElement('span');
          title.className = 'customer-history-address-title';
          title.textContent = 'Địa chỉ từng giao — bấm để áp dụng';
          addressList.appendChild(title);
          cloud.addresses.forEach(address => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'customer-history-address-option';
            button.textContent = `${address.raw_address} · ${address.use_count || 1} lần`;
            button.addEventListener('click', (e) => {
              e.stopPropagation();
              let value = address.raw_address || address.normalized_address;
              if (!value) return;
              if (typeof AddressSanitizer !== 'undefined' && typeof AddressSanitizer.deduplicate === 'function') {
                value = AddressSanitizer.deduplicate(value);
              }
              const revAddress = root.getElementById('rev-address');
              const rawAddress = root.getElementById('rev-raw-address');
              if (revAddress) revAddress.textContent = value;
              if (rawAddress) rawAddress.textContent = value;
              if (globalThis.parsedDataStore) globalThis.parsedDataStore.address = value;
              if (typeof refreshAddressSuggestion === 'function') {
                refreshAddressSuggestion(value, globalThis.parsedDataStore?.phone || '');
              }
              if (typeof showVnpostToast === 'function') {
                showVnpostToast('Đã áp dụng địa chỉ lịch sử theo lựa chọn của bạn.', 'success');
              }
            });
            addressList.appendChild(button);
          });
          resultEl.appendChild(addressList);
        }
      };
      globalThis.lookupPanelCustomerHistory = lookupCustomerHistory;

      const customerSearch = root.getElementById('customer-history-search');
      const customerSearchRow = root.getElementById('customer-history-search-row');
      const customerSearchToggle = root.getElementById('customer-history-search-toggle');
      
      customerSearchToggle?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!customerSearchRow) return;
        const isHidden = customerSearchRow.style.display === 'none';
        customerSearchRow.style.display = isHidden ? 'grid' : 'none';
        if (isHidden && customerSearch) customerSearch.focus();
      });

      root.getElementById('customer-history-search-btn')?.addEventListener('click', () => lookupCustomerHistory(customerSearch?.value));
      customerSearch?.addEventListener('keydown', event => {
        if (event.key === 'Enter') { event.preventDefault(); lookupCustomerHistory(customerSearch.value); }
      });

      const accBtn = root.getElementById('address-accordion-btn');
      const accContent = root.getElementById('address-accordion-content');
      if (accBtn && accContent) {
        accBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const isOpen = accContent.style.display !== 'none';
          accContent.style.display = isOpen ? 'none' : 'flex';
          accBtn.classList.toggle('open', !isOpen);
        });
      }

      const btnSwitchClean = root.getElementById('btn-switch-clean');
      const btnSwitch2Level = root.getElementById('btn-switch-2level');
      
      const switchAddressFormat = (is2Level) => {
        const targetId = is2Level ? 'rev-suggest-2level' : 'rev-suggest-clean';
        const targetEl = root.getElementById(targetId);
        const text = targetEl ? targetEl.textContent.trim() : '';
        if (text && typeof onAiAddressClickHandler === 'function') {
          onAiAddressClickHandler(text);
          if (btnSwitchClean && btnSwitch2Level) {
            btnSwitchClean.classList.toggle('active', !is2Level);
            btnSwitch2Level.classList.toggle('active', is2Level);
          }
          const refDisclosure = root.getElementById('address-reference-disclosure') || root.querySelector('.address-reference-disclosure');
          if (refDisclosure) {
            refDisclosure.style.display = is2Level ? 'none' : '';
          }
          const addrStatusBadge = root.getElementById('address-status-badge');
          if (addrStatusBadge) {
            addrStatusBadge.textContent = is2Level ? '🎯 Địa chỉ 2 Cấp' : '✓ Đã tối ưu';
            addrStatusBadge.title = is2Level
              ? 'Địa chỉ được nhận diện theo chuẩn 2 cấp (không chèn quận).'
              : 'Địa chỉ chuẩn hóa 3 cấp đầy đủ.';
          }
          showVnpostToast(is2Level ? '🎯 Đã áp dụng địa chỉ 2 cấp mới' : '✨ Đã chọn địa chỉ 3 cấp đầy đủ', 'success');
        }
      };

      if (btnSwitchClean) {
        btnSwitchClean.addEventListener('click', (e) => {
          e.stopPropagation();
          switchAddressFormat(false);
        });
      }
      if (btnSwitch2Level) {
        btnSwitch2Level.addEventListener('click', (e) => {
          e.stopPropagation();
          switchAddressFormat(true);
        });
      }

      root.querySelectorAll('.address-reference-option').forEach((option) => {
        option.addEventListener('click', (e) => {
          e.stopPropagation();
          switchAddressFormat(option.dataset.addressFormat === '2level');
        });
      });

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

      if (btnDockToggle) {
        btnDockToggle.addEventListener('click', (e) => {
          e.stopPropagation();
          const nextMode = panel.classList.contains('panel-docked') ? 'floating' : 'docked';
          const position = nextMode === 'floating'
            ? { top: Math.max(20, panel.offsetTop || 20), left: Math.max(20, window.innerWidth - 400) }
            : null;
          applyPanelDisplayMode(panel, dockTab, btnDockToggle, nextMode, { collapsed: false, position });
          panelStorage.set({
            panel_display_mode: nextMode,
            panel_dock_collapsed: false,
            panelMinimized: false,
            ...(position ? { panel_float_position: position } : {}),
          });
        });
      }

      const btnTheme = root.getElementById('vnpost-btn-theme');
      if (btnTheme) {
        btnTheme.addEventListener('click', (e) => {
          e.stopPropagation();
          const isNowLight = panel.classList.toggle('light-mode');
          persistThemePreference(isNowLight);
          showVnpostToast(isNowLight ? '☀️ Đã chuyển sang giao diện Sáng' : '🌙 Đã chuyển sang giao diện Tối', 'success');
        });
      }

      const txtArea = root.getElementById('rawOrderText');

      // =========================================================================
      // DRAFT QUEUE CONTROLLER (Nạp đơn nháp từ web vào panel & Thu gọn / Mở rộng)
      // =========================================================================
      const draftQueueEl = root.getElementById('vnpost-draft-queue');
      const draftQueueBadge = root.getElementById('draft-queue-badge');
      const draftQueueMiniSummary = root.getElementById('draft-queue-mini-summary');
      const btnDraftToggleCollapse = root.getElementById('btn-draft-queue-toggle-collapse');
      const draftCurrentIndexEl = root.getElementById('draft-current-index');
      const draftCurrentSummaryEl = root.getElementById('draft-current-summary');
      const btnDraftPrev = root.getElementById('btn-draft-prev');
      const btnDraftNext = root.getElementById('btn-draft-next');
      const btnDraftLoad = root.getElementById('btn-draft-load');
      const btnDraftFillNext = root.getElementById('btn-draft-fill-next');
      const btnDraftDelete = root.getElementById('btn-draft-delete');
      const btnDraftClearAll = root.getElementById('btn-draft-clear-all');
      const btnDraftQueueClear = root.getElementById('btn-draft-queue-clear');

      let currentDraftsList = [];
      let currentDraftIndex = 0;
      let isDraftQueueCollapsed = false;
      let _lastAnnouncedDraftCount = -1;

      function updateDraftQueueCollapsedView() {
        if (!draftQueueEl) return;
        draftQueueEl.classList.toggle('is-collapsed', isDraftQueueCollapsed);
        if (btnDraftToggleCollapse) {
          btnDraftToggleCollapse.textContent = isDraftQueueCollapsed ? '▼' : '▲';
          btnDraftToggleCollapse.title = isDraftQueueCollapsed ? 'Mở rộng hàng đợi' : 'Thu gọn hàng đợi';
        }
        if (draftQueueMiniSummary) {
          if (isDraftQueueCollapsed && currentDraftsList.length > 0) {
            const cur = currentDraftsList[currentDraftIndex];
            const name = cur?.name || 'Khách lẻ';
            const phone = cur?.phone ? ` (${cur.phone})` : '';
            draftQueueMiniSummary.textContent = `· Đơn ${currentDraftIndex + 1}: ${name}${phone}`;
            draftQueueMiniSummary.style.display = 'inline-block';
          } else {
            draftQueueMiniSummary.style.display = 'none';
          }
        }
      }

      async function refreshDraftQueue() {
        if (!draftQueueEl) return;
        try {
          let queueEnabled = true;
          try {
            if (typeof chrome !== 'undefined' && chrome.storage?.local) {
              const res = await new Promise(r => chrome.storage.local.get(['draft_queue_enabled', 'draft_queue_collapsed'], r));
              if (res && res.draft_queue_enabled !== undefined) {
                queueEnabled = !!res.draft_queue_enabled;
              }
              if (res && res.draft_queue_collapsed !== undefined) {
                isDraftQueueCollapsed = !!res.draft_queue_collapsed;
              }
            } else {
              const rawPref = localStorage.getItem('draft_queue_enabled');
              if (rawPref !== null) queueEnabled = (rawPref === 'true');
              const rawCollapsed = localStorage.getItem('draft_queue_collapsed');
              if (rawCollapsed !== null) isDraftQueueCollapsed = (rawCollapsed === 'true');
            }
          } catch (_) {}

          if (typeof OrderStorage === 'undefined' || typeof OrderStorage.getOrders !== 'function') return;
          if (typeof OrderStorage._invalidateOrdersCache === 'function') {
            OrderStorage._invalidateOrdersCache();
          }
          const allOrders = await OrderStorage.getOrders();
          currentDraftsList = (allOrders || []).filter(o => o && !o.submittedAt && !o.trackingCode && !o.tracking_code);

          // Cập nhật số lượng đơn nháp trên badge ở header panel
          const headerBadge = root.getElementById('header-draft-count-badge');
          const toggleDraftBtn = root.getElementById('vnpost-btn-toggle-draft-queue');
          if (headerBadge) {
            if (currentDraftsList.length > 0) {
              headerBadge.textContent = String(currentDraftsList.length);
              headerBadge.style.display = 'inline-flex';
              headerBadge.classList.add('has-drafts-pulse');
              if (toggleDraftBtn) {
                toggleDraftBtn.classList.add('has-drafts-active');
                toggleDraftBtn.title = `Hàng đợi có ${currentDraftsList.length} đơn nháp sẵn sàng lên đơn`;
              }
            } else {
              headerBadge.style.display = 'none';
              headerBadge.classList.remove('has-drafts-pulse');
              if (toggleDraftBtn) {
                toggleDraftBtn.classList.remove('has-drafts-active');
                toggleDraftBtn.title = 'Bật / Tắt Hàng đợi đơn nháp';
              }
            }
          }

          if (currentDraftsList.length === 0) {
            draftQueueEl.style.display = 'none';
            if (draftQueueBadge) draftQueueBadge.textContent = '0 đơn';
            currentDraftIndex = 0;
            _lastAnnouncedDraftCount = 0;
            // Nếu đơn trước đó vừa bị xóa và hàng đợi đã hết đơn nháp -> Reset form
            if (globalThis.parsedDataStore?.savedOrderId) {
              globalThis.parsedDataStore = null;
              if (txtArea) txtArea.value = '';
              if (typeof globalThis.resetSourceOrderCard === 'function') {
                globalThis.resetSourceOrderCard();
              }
            }
            return;
          }

          // Khi có đơn nháp mới xuất hiện trong hàng đợi, thông báo rõ ràng ra panel
          if (_lastAnnouncedDraftCount !== currentDraftsList.length) {
            _lastAnnouncedDraftCount = currentDraftsList.length;
            if (typeof showVnpostToast === 'function') {
              showVnpostToast(`📥 Hàng đợi: Có ${currentDraftsList.length} đơn nháp sẵn sàng lên đơn!`, 'info');
            }
          }

          // Tự động kích hoạt hiển thị hàng đợi nếu có đơn nháp
          if (!queueEnabled) {
            queueEnabled = true;
            try {
              if (typeof chrome !== 'undefined' && chrome.storage?.local) {
                chrome.storage.local.set({ draft_queue_enabled: true });
              }
              localStorage.setItem('draft_queue_enabled', 'true');
            } catch (_) {}
          }

          if (currentDraftIndex >= currentDraftsList.length) {
            currentDraftIndex = Math.max(0, currentDraftsList.length - 1);
          }
          draftQueueEl.style.display = 'flex';
          if (draftQueueBadge) draftQueueBadge.textContent = `${currentDraftsList.length} đơn`;

          // Kiểm tra nếu đơn đang nạp trên form bị xóa khỏi danh sách đơn nháp
          const activeOrderId = globalThis.parsedDataStore?.savedOrderId;
          if (activeOrderId && !currentDraftsList.some(o => o.id === activeOrderId)) {
            loadCurrentDraftToReview();
          }

          renderCurrentDraft();
          updateDraftQueueCollapsedView();
        } catch (e) {
          console.warn('refreshDraftQueue error', e);
        }
      }

      function renderCurrentDraft() {
        if (!currentDraftsList.length) return;
        const d = currentDraftsList[currentDraftIndex];
        if (!d) return;

        if (draftCurrentIndexEl) {
          draftCurrentIndexEl.textContent = `Đơn ${currentDraftIndex + 1}/${currentDraftsList.length}`;
        }
        if (draftCurrentSummaryEl) {
          const name = d.name || 'Khách lẻ';
          const phone = d.phone || '';
          const cod = Number(d.codAmount || d.cod_amount || d.cod) || 0;
          const codStr = cod > 0 ? ` · COD ${cod.toLocaleString('vi-VN')}đ` : '';
          draftCurrentSummaryEl.textContent = `${name} (${phone})${codStr}`;
        }
        if (btnDraftPrev) btnDraftPrev.disabled = (currentDraftIndex <= 0);
        if (btnDraftNext) btnDraftNext.disabled = (currentDraftIndex >= currentDraftsList.length - 1);
        updateDraftQueueCollapsedView();
      }

      function loadCurrentDraftToReview() {
        if (!currentDraftsList.length) return;
        const d = currentDraftsList[currentDraftIndex];
        if (!d) return;

        globalThis.parsedDataStore = {
          savedOrderId: d.id,
          name: d.name || '',
          phone: d.phone || '',
          address: d.address || '',
          orderCode: d.orderCode || d.order_code || '',
          codAmount: Number(d.codAmount || d.cod_amount || d.cod) || 0,
          goodsName: d.goodsName || d.goods_name || d.productItem || d.defaultGoodsName || '',
          weightGrams: Number(d.weightGrams || d.weight) || 200,
          notes: d.notes || '',
          collectFee: !!(d.collectFee || d.collect_fee),
          rawAddress: d.rawAddress || d.address || '',
          ward: d.ward || '',
          district: d.district || '',
          province: d.province || ''
        };

        if (txtArea) {
          txtArea.value = d.rawText || `${d.name || ''} ${d.phone || ''} ${d.address || ''}`;
        }

        if (typeof displayParsedData === 'function') {
          displayParsedData(globalThis.parsedDataStore);
        }

        showVnpostToast(`📥 Đã nạp đơn ${currentDraftIndex + 1}/${currentDraftsList.length}: ${d.name || 'Khách'}`, 'info');
      }

      if (btnDraftPrev) {
        btnDraftPrev.addEventListener('click', (e) => {
          e.stopPropagation();
          if (currentDraftIndex > 0) {
            currentDraftIndex--;
            renderCurrentDraft();
            loadCurrentDraftToReview();
          }
        });
      }

      if (btnDraftNext) {
        btnDraftNext.addEventListener('click', (e) => {
          e.stopPropagation();
          if (currentDraftIndex < currentDraftsList.length - 1) {
            currentDraftIndex++;
            renderCurrentDraft();
            loadCurrentDraftToReview();
          }
        });
      }

      if (btnDraftLoad) {
        btnDraftLoad.addEventListener('click', (e) => {
          e.stopPropagation();
          loadCurrentDraftToReview();
        });
      }

      if (btnDraftFillNext) {
        btnDraftFillNext.addEventListener('click', (e) => {
          e.stopPropagation();
          loadCurrentDraftToReview();
          const targetPlatform = platformObj.id || 'vnpost';
          const fillBtn = targetPlatform === 'vnpost' 
            ? root.getElementById('btnFillVNPost') 
            : root.getElementById('btnFillJT');
          if (fillBtn && !fillBtn.disabled) {
            fillBtn.click();
            showVnpostToast(`⚡ Đang điền đơn ${currentDraftIndex + 1}...`, 'info');
            if (currentDraftIndex < currentDraftsList.length - 1) {
              setTimeout(() => {
                currentDraftIndex++;
                renderCurrentDraft();
                loadCurrentDraftToReview();
              }, 1200);
            }
          }
        });
      }

      if (btnDraftDelete) {
        btnDraftDelete.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (!currentDraftsList.length) return;
          const d = currentDraftsList[currentDraftIndex];
          if (!d) return;
          if (!confirm(`Xóa đơn nháp của "${d.name || d.phone || 'khách này'}" khỏi hàng đợi?`)) return;
          try {
            if (typeof OrderStorage !== 'undefined' && typeof OrderStorage.deleteOrder === 'function') {
              await OrderStorage.deleteOrder(d.id);
              if (typeof OrderStorage._invalidateOrdersCache === 'function') {
                OrderStorage._invalidateOrdersCache();
              }
              showVnpostToast('🗑️ Đã xóa 1 đơn khỏi hàng đợi.', 'success');
              // Phát sự kiện đồng bộ cho toàn bộ hệ thống
              try {
                if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
                  chrome.runtime.sendMessage({ action: 'draftOrdersUpdated', source: 'panel' }, () => {
                    if (chrome.runtime.lastError) {}
                  });
                }
                window.dispatchEvent(new CustomEvent('draft-queue-updated'));
              } catch (_) {}
              await refreshDraftQueue();
            }
          } catch (err) {
            showVnpostToast('Lỗi khi xóa đơn: ' + err.message, 'error');
          }
        });
      }

      if (btnDraftClearAll) {
        btnDraftClearAll.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (!currentDraftsList.length) return;
          const count = currentDraftsList.length;
          if (!confirm(`Bạn có chắc muốn xóa sạch toàn bộ ${count} đơn nháp khỏi hàng đợi?`)) return;
          try {
            if (typeof OrderStorage !== 'undefined') {
              const ids = currentDraftsList.map(o => o.id).filter(Boolean);
              if (typeof OrderStorage.deleteBulkOrders === 'function') {
                await OrderStorage.deleteBulkOrders(ids);
              } else if (typeof OrderStorage.deleteOrder === 'function') {
                for (const id of ids) {
                  await OrderStorage.deleteOrder(id);
                }
              }
              if (typeof OrderStorage._invalidateOrdersCache === 'function') {
                OrderStorage._invalidateOrdersCache();
              }
              showVnpostToast(`🧹 Đã dọn sạch ${count} đơn nháp khỏi hàng đợi!`, 'success');
              // Phát sự kiện đồng bộ cho toàn bộ hệ thống
              try {
                if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
                  chrome.runtime.sendMessage({ action: 'draftOrdersUpdated', source: 'panel' }, () => {
                    if (chrome.runtime.lastError) {}
                  });
                }
                window.dispatchEvent(new CustomEvent('draft-queue-updated'));
              } catch (_) {}
              await refreshDraftQueue();
            }
          } catch (err) {
            showVnpostToast('Lỗi khi dọn hàng đợi: ' + err.message, 'error');
          }
        });
      }

      if (btnDraftToggleCollapse) {
        btnDraftToggleCollapse.addEventListener('click', async (e) => {
          e.stopPropagation();
          isDraftQueueCollapsed = !isDraftQueueCollapsed;
          updateDraftQueueCollapsedView();
          try {
            if (typeof chrome !== 'undefined' && chrome.storage?.local) {
              await chrome.storage.local.set({ draft_queue_collapsed: isDraftQueueCollapsed });
            }
            try { localStorage.setItem('draft_queue_collapsed', String(isDraftQueueCollapsed)); } catch (_) {}
          } catch (_) {}
        });
      }

      if (btnDraftQueueClear) {
        btnDraftQueueClear.addEventListener('click', async (e) => {
          e.stopPropagation();
          try {
            if (typeof chrome !== 'undefined' && chrome.storage?.local) {
              await chrome.storage.local.set({ draft_queue_enabled: false });
            }
            try { localStorage.setItem('draft_queue_enabled', 'false'); } catch (_) {}
          } catch (_) {}
          draftQueueEl.style.display = 'none';
          showVnpostToast('Đã ẩn Hàng đợi đơn nháp. Bấm biểu tượng 📥 trên thanh tiêu đề để bật lại.', 'info');
        });
      }

      const btnToggleDraftQueue = root.getElementById('vnpost-btn-toggle-draft-queue');
      if (btnToggleDraftQueue) {
        btnToggleDraftQueue.addEventListener('click', async (e) => {
          e.stopPropagation();
          try {
            // Nếu hàng đợi đang bị tắt hoặc ẩn hoàn toàn: Bật lên và mở rộng
            if (draftQueueEl.style.display === 'none') {
              if (typeof chrome !== 'undefined' && chrome.storage?.local) {
                await chrome.storage.local.set({ draft_queue_enabled: true, draft_queue_collapsed: false });
              }
              try {
                localStorage.setItem('draft_queue_enabled', 'true');
                localStorage.setItem('draft_queue_collapsed', 'false');
              } catch (_) {}
              isDraftQueueCollapsed = false;
              showVnpostToast('✅ Đã BẬT Hàng đợi đơn nháp', 'info');
              await refreshDraftQueue();
            } else {
              // Nếu hàng đợi đang hiển thị: Đảo trạng thái Thu gọn <-> Mở rộng
              isDraftQueueCollapsed = !isDraftQueueCollapsed;
              updateDraftQueueCollapsedView();
              if (typeof chrome !== 'undefined' && chrome.storage?.local) {
                await chrome.storage.local.set({ draft_queue_collapsed: isDraftQueueCollapsed });
              }
              try { localStorage.setItem('draft_queue_collapsed', String(isDraftQueueCollapsed)); } catch (_) {}
              showVnpostToast(isDraftQueueCollapsed ? '▾ Đã thu gọn hàng đợi' : '▴ Đã mở rộng hàng đợi', 'info');
            }
          } catch (err) {
            console.warn('Lỗi toggle draft queue', err);
          }
        });
      }

      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
        chrome.storage.onChanged.addListener((changes, area) => {
          if (area === 'local') {
            const hasDraftChanges = Object.keys(changes).some(k => 
              k.includes('savedOrders') || 
              k.includes('orders') || 
              k.includes('draft') ||
              k === 'vnpost_orders' ||
              k === 'draft_queue_updated_at' ||
              k === 'draft_queue_enabled' ||
              k === 'draft_queue_collapsed'
            );
            if (hasDraftChanges) {
              if (typeof OrderStorage !== 'undefined' && typeof OrderStorage._invalidateOrdersCache === 'function') {
                OrderStorage._invalidateOrdersCache();
              }
              refreshDraftQueue();
            }
          }
        });
      }

      window.addEventListener('storage', (e) => {
        if (e.key && (e.key.includes('savedOrders') || e.key.includes('orders') || e.key.includes('draft') || e.key === 'draft_queue_enabled' || e.key === 'draft_queue_collapsed')) {
          if (typeof OrderStorage !== 'undefined' && typeof OrderStorage._invalidateOrdersCache === 'function') {
            OrderStorage._invalidateOrdersCache();
          }
          refreshDraftQueue();
        }
      });

      window.addEventListener('draft-queue-updated', () => {
        if (typeof OrderStorage !== 'undefined' && typeof OrderStorage._invalidateOrdersCache === 'function') {
          OrderStorage._invalidateOrdersCache();
        }
        refreshDraftQueue();
      });

      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener((msg) => {
          if (msg && (msg.action === 'draftOrdersUpdated' || msg.action === 'ordersUpdated' || msg.action === 'refreshDraftQueue')) {
            if (typeof OrderStorage !== 'undefined' && typeof OrderStorage._invalidateOrdersCache === 'function') {
              OrderStorage._invalidateOrdersCache();
            }
            refreshDraftQueue();
          }
        });
      }

      setTimeout(refreshDraftQueue, 500);
      const sourceCard = root.getElementById('source-order-card');
      const sourceExpanded = root.getElementById('source-expanded-content');
      const sourcePreview = root.getElementById('source-collapsed-preview');
      const sourcePreviewPrimary = root.getElementById('source-preview-primary');
      const sourcePreviewAddress = root.getElementById('source-preview-address');
      const sourceDirtyBadge = root.getElementById('source-dirty-badge');
      const sourceDirtyMessage = root.getElementById('source-dirty-message');
      const sourceEditBtn = root.getElementById('btn-edit-source');
      let sourceHasParsedData = false;
      let sourceIsDirty = false;
      let sourceAutoParsing = false;
      let lastSourcePreviewData = {};

      const setSourceDirty = (dirty) => {
        sourceIsDirty = dirty;
        sourceCard?.classList.toggle('source-dirty', dirty);
        if (sourceDirtyBadge) sourceDirtyBadge.style.display = dirty ? 'inline-flex' : 'none';
        if (sourceDirtyMessage) sourceDirtyMessage.style.display = dirty ? 'block' : 'none';
        const parseLabel = root.querySelector('#btnParseOrder span');
        if (parseLabel) parseLabel.textContent = dirty ? 'Bóc tách lại' : 'Tách Đơn Tự Động';
      };

      const expandSourceCard = () => {
        if (sourceExpanded) sourceExpanded.style.display = 'block';
        if (sourcePreview) sourcePreview.style.display = 'none';
        if (sourceEditBtn) sourceEditBtn.style.display = 'none';
        if (sourceCard) {
          sourceCard.classList.remove('is-collapsed');
          sourceCard.setAttribute('aria-expanded', 'true');
        }
        const dupAlert = root.getElementById('panel-duplicate-alert');
        if (dupAlert) dupAlert.style.display = 'none';
        window.setTimeout(() => txtArea?.focus(), 0);
      };

      const collapseSourceCard = (data = {}) => {
        lastSourcePreviewData = data;
        const rawText = txtArea?.value.trim() || '';
        if (sourcePreviewPrimary) sourcePreviewPrimary.textContent = 'Nội dung đơn hàng gốc';
        if (sourcePreviewAddress) sourcePreviewAddress.textContent = rawText || 'Chưa có nội dung';
        if (sourceExpanded) sourceExpanded.style.display = 'none';
        if (sourcePreview) sourcePreview.style.display = 'flex';
        if (sourceEditBtn) sourceEditBtn.style.display = 'inline-flex';
        if (sourceCard) {
          sourceCard.classList.add('is-collapsed');
          sourceCard.setAttribute('aria-expanded', 'false');
        }
        sourceHasParsedData = true;
        setSourceDirty(false);
      };

      globalThis.collapseSourceOrderCard = collapseSourceCard;
      globalThis.expandSourceOrderCard = expandSourceCard;
      // Quản lý khung xem trước ảnh đã dán
      const imgPreviewContainer = root.getElementById('panel-image-paste-preview');
      const pastedImgEl = root.getElementById('panel-pasted-img');
      const pastedImgInfoEl = root.getElementById('panel-pasted-img-info');
      const btnRemovePastedImg = root.getElementById('btn-remove-pasted-img');
      const imgOcrStatusEl = root.getElementById('panel-image-ocr-status');
      const imgOcrStatusText = root.getElementById('panel-image-ocr-status-text');
      let currentPastedImageBase64 = null;

      function clearPastedImagePreview() {
        currentPastedImageBase64 = null;
        if (pastedImgEl) pastedImgEl.src = '';
        if (pastedImgInfoEl) pastedImgInfoEl.textContent = '';
        if (imgPreviewContainer) imgPreviewContainer.style.display = 'none';
        if (imgOcrStatusEl) imgOcrStatusEl.style.display = 'none';
      }

      if (btnRemovePastedImg) {
        btnRemovePastedImg.addEventListener('click', (e) => {
          e.stopPropagation();
          clearPastedImagePreview();
          showVnpostToast('🗑️ Đã gỡ bỏ ảnh đơn hàng.', 'info');
        });
      }

      async function runImageToOrder(base64Data) {
        let session = null;
        try {
          if (typeof AuthSession !== 'undefined' && typeof AuthSession.getSession === 'function') {
            session = await AuthSession.getSession();
          }
        } catch (_) {}

        let customVisionKey = '';
        let customGeminiKey = '';
        try {
          if (typeof chrome !== 'undefined' && chrome.storage?.local) {
            const keys = await new Promise(r => chrome.storage.local.get(['custom_gemini_api_key', 'custom_vision_api_key'], r));
            customGeminiKey = keys?.custom_gemini_api_key || '';
            customVisionKey = keys?.custom_vision_api_key || '';
          }
        } catch (_) {}

        // Gửi yêu cầu tới Service Worker bóc tách qua Gemini Vision
        const response = await new Promise((resolve) => {
          if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
            chrome.runtime.sendMessage({
              action: 'runGeminiVision',
              imageBase64: base64Data,
              token: session?.access_token || session?.shop_access_key,
              shopKey: session?.shop_access_key,
              shopId: session?.active_shop_id,
              deviceId: session?.device_id,
              customApiKey: customGeminiKey
            }, res => {
              if (chrome.runtime.lastError) {
                resolve({ ok: false, error: chrome.runtime.lastError.message });
              } else {
                resolve(res || { ok: false, error: 'Không nhận được phản hồi từ Gemini Vision' });
              }
            });
          } else {
            resolve({ ok: false, error: 'Extension runtime không khả dụng.' });
          }
        });

        if (!response || !response.ok) {
          throw new Error(response?.error || 'Gemini Vision không bóc tách được đơn hàng từ ảnh.');
        }

        const data = response.result || {};
        const name = String(data.name || '').trim();
        const phone = String(data.phone || '').trim();
        const orderCode = String(data.orderCode || '').trim();
        const codAmount = parseInt(String(data.codAmount || 0).replace(/\D/g, ''), 10) || 0;
        const address = String(data.correctAddress || data.address || '').trim();
        const productItem = String(data.productItem || '').trim();
        const extraNote = String(data.extraNote || '').trim();

        // Tạo văn bản tóm tắt điền vào ô rawOrderText
        const lines = [];
        if (name) lines.push(`Khách hàng: ${name}`);
        if (phone) lines.push(`SĐT: ${phone}`);
        if (address) lines.push(`Địa chỉ: ${address}`);
        if (codAmount > 0) lines.push(`Thu hộ COD: ${codAmount.toLocaleString('vi-VN')} đ`);
        if (orderCode) lines.push(`Mã đơn: ${orderCode}`);
        if (productItem) lines.push(`Hàng hóa: ${productItem}`);
        if (extraNote) lines.push(`Ghi chú: ${extraNote}`);

        const textSummary = lines.join('\n');
        if (txtArea) {
          txtArea.value = textSummary;
          txtArea.dispatchEvent(new Event('input', { bubbles: true }));
          txtArea.dispatchEvent(new Event('change', { bubbles: true }));
        }

        // Tạo đối tượng parsedDataStore
        const parsed = {
          name,
          phone,
          orderCode,
          codAmount,
          address,
          productItem,
          extraNote,
          imageThumbnail: base64Data,
          rawText: textSummary,
          addressParts: { ward: '', district: '', province: '' }
        };

        globalThis.parsedDataStore = parsed;
        globalThis.__AF_INITIAL_PARSED_DATA__ = JSON.parse(JSON.stringify(parsed));
        globalThis.__AF_RAW_ORDER_INPUT__ = textSummary;

        if (typeof displayParsedData === 'function') {
          displayParsedData(parsed);
        }

        // Tự động kiểm tra và chuẩn hóa địa chỉ qua AddressEngine
        if (address && typeof globalThis.refreshAddressSuggestion === 'function') {
          globalThis.refreshAddressSuggestion(address, phone).catch(() => {});
        }

        if (imgOcrStatusEl && imgOcrStatusText) {
          imgOcrStatusText.textContent = `✅ Bóc tách ảnh thành công (${response.model || 'Gemini Flash'})!`;
          setTimeout(() => {
            if (imgOcrStatusEl) imgOcrStatusEl.style.display = 'none';
          }, 3500);
        }

        showVnpostToast(`✨ Đã nhận diện đơn từ ảnh bằng ${response.model || 'Gemini Vision'}!`, 'success', 4000);
      }

      async function handlePastedImageFile(file) {
        if (!file || !file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
          const base64Data = event.target.result;
          currentPastedImageBase64 = base64Data;
          if (pastedImgEl) pastedImgEl.src = base64Data;
          if (pastedImgInfoEl) {
            const sizeKb = Math.round(file.size / 1024);
            pastedImgInfoEl.textContent = `${file.name || 'Ảnh dán'} · ${sizeKb} KB`;
          }
          if (imgPreviewContainer) imgPreviewContainer.style.display = 'block';
          if (imgOcrStatusEl && imgOcrStatusText) {
            imgOcrStatusEl.style.display = 'flex';
            imgOcrStatusText.textContent = '🚀 Đang nhận diện chữ & bóc tách qua Gemini Vision...';
          }
          showVnpostToast('🖼️ Đã nhận ảnh! Đang kích hoạt Gemini Vision bóc tách...', 'info', 3000);

          try {
            await runImageToOrder(base64Data);
          } catch (err) {
            console.error('[Panel Image Parse] Error:', err);
            if (imgOcrStatusEl && imgOcrStatusText) {
              imgOcrStatusText.textContent = '⚠️ ' + (err.message || 'Lỗi bóc tách ảnh');
            }
            showVnpostToast('❌ ' + (err.message || 'Lỗi bóc tách ảnh'), 'error', 5000);
          }
        };
        reader.readAsDataURL(file);
      }

      globalThis.resetSourceOrderCard = () => {
        sourceHasParsedData = false;
        setSourceDirty(false);
        clearPastedImagePreview();
        if (txtArea) txtArea.value = '';
        lastSourcePreviewData = {};
        if (sourcePreviewAddress) sourcePreviewAddress.textContent = '---';
        expandSourceCard();
        const reviewPanel = root.getElementById('review-panel');
        const emptyState = root.getElementById('panel-empty-state');
        const validationError = root.getElementById('panel-validation-error');
        const dupAlert = root.getElementById('panel-duplicate-alert');
        if (reviewPanel) reviewPanel.style.display = 'none';
        if (emptyState) emptyState.hidden = false;
        if (validationError) validationError.hidden = true;
        if (dupAlert) dupAlert.style.display = 'none';
        const historyCard = root.getElementById('customer-history-card');
        if (historyCard) historyCard.hidden = true;
        if (typeof setCustomerOrderCountBadge === 'function') {
          setCustomerOrderCountBadge(0);
        }
        updateOrderReadinessBadge(null);
      };

      window.addEventListener('autofill:clear-order', () => {
        globalThis.parsedDataStore = null;
        if (typeof globalThis.resetSourceOrderCard === 'function') {
          globalThis.resetSourceOrderCard();
        }
      });

      sourcePreview?.addEventListener('click', expandSourceCard);
      sourceEditBtn?.addEventListener('click', (e) => { e.stopPropagation(); expandSourceCard(); });

      const btnCloseDuplicateAlert = root.getElementById('btn-close-duplicate-alert');
      if (btnCloseDuplicateAlert) {
        btnCloseDuplicateAlert.addEventListener('click', (e) => {
          e.stopPropagation();
          const alertEl = root.getElementById('panel-duplicate-alert');
          if (alertEl) alertEl.style.display = 'none';
        });
      }

      document.addEventListener('pointerdown', (e) => {
        if (!sourceHasParsedData || sourceAutoParsing || sourceCard?.getAttribute('aria-expanded') !== 'true') return;
        const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
        if (path.includes(sourceCard)) return;

        if (!sourceIsDirty) {
          collapseSourceCard(lastSourcePreviewData);
          return;
        }

        sourceAutoParsing = true;
        window.setTimeout(async () => {
          try {
            await onParseHandler();
          } finally {
            sourceAutoParsing = false;
          }
        }, 0);
      }, true);
      if (txtArea) {
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
        txtArea.addEventListener('input', () => {
          const dupAlert = root.getElementById('panel-duplicate-alert');
          if (dupAlert) dupAlert.style.display = 'none';
          if (sourceHasParsedData) setSourceDirty(true);
        });

        // XỬ LÝ DÁN ẢNH (Ctrl+V) VÀO TEXTAREA
        txtArea.addEventListener('paste', (e) => {
          const items = e.clipboardData?.items;
          if (items && items.length > 0) {
            for (let i = 0; i < items.length; i++) {
              if (items[i].type && items[i].type.startsWith('image/')) {
                const file = items[i].getAsFile();
                if (file) {
                  e.preventDefault();
                  e.stopPropagation();
                  handlePastedImageFile(file);
                  return;
                }
              }
            }
          }
          const files = e.clipboardData?.files;
          if (files && files.length > 0) {
            for (let i = 0; i < files.length; i++) {
              if (files[i].type && files[i].type.startsWith('image/')) {
                e.preventDefault();
                e.stopPropagation();
                handlePastedImageFile(files[i]);
                return;
              }
            }
          }
        });

        // XỬ LÝ KÉO THẢ ẢNH VÀO TEXTAREA
        ['dragenter', 'dragover'].forEach(name => {
          txtArea.addEventListener(name, (e) => {
            e.preventDefault();
            e.stopPropagation();
            txtArea.classList.add('is-dragover');
          });
        });

        ['dragleave', 'drop'].forEach(name => {
          txtArea.addEventListener(name, (e) => {
            e.preventDefault();
            e.stopPropagation();
            txtArea.classList.remove('is-dragover');
          });
        });

        txtArea.addEventListener('drop', (e) => {
          const files = e.dataTransfer?.files;
          if (files && files.length > 0) {
            for (let i = 0; i < files.length; i++) {
              if (files[i].type && files[i].type.startsWith('image/')) {
                handlePastedImageFile(files[i]);
                return;
              }
            }
          }
        });
      }

      // Hỗ trợ dán ảnh khi click trên toàn thẻ nhập nguồn
      sourceCard?.addEventListener('paste', (e) => {
        if (e.target !== txtArea) {
          const items = e.clipboardData?.items;
          if (items && items.length > 0) {
            for (let i = 0; i < items.length; i++) {
              if (items[i].type && items[i].type.startsWith('image/')) {
                const file = items[i].getAsFile();
                if (file) {
                  e.preventDefault();
                  e.stopPropagation();
                  handlePastedImageFile(file);
                  return;
                }
              }
            }
          }
        }
      });
      // Không auto-focus vào textarea để tránh gây mất focus của user trên trang web

      const editableFieldMap = { 'rev-name': 'name', 'rev-phone': 'phone', 'rev-code': 'orderCode', 'rev-address': 'address', 'rev-cod': 'codAmount' };
      Object.keys(editableFieldMap).forEach((elId) => {
        const el = root.getElementById(elId);
        if (!el) return;
        const triggerEdit = () => {
          if (typeof onFieldEditHandler === 'function') {
            const field = editableFieldMap[elId];
            let rawTextVal = el.textContent.trim();
            let parsedVal = rawTextVal;
            if (field === 'codAmount') {
              parsedVal = parseInt(rawTextVal.replace(/\D/g, ''), 10) || 0;
            } else if (field === 'orderCode') {
              const currentPlat = typeof getCurrentPlatform === 'function' ? (getCurrentPlatform()?.id || getCurrentPlatform()) : 'vnpost';
              if (currentPlat === 'vnpost' && rawTextVal) {
                // Chỉ tự động chuẩn hóa nếu là mã đơn có cấu trúc (chứa chữ số: e120.02, p150.12, TAI0001...)
                // Tuyệt đối không tự biến cụm từ/tên sản phẩm (như "Cây Cover") thành mã dính liền
                if (/\d/.test(rawTextVal)) {
                  parsedVal = formatVNPostOrderCode(rawTextVal);
                  if (el.textContent !== parsedVal) {
                    el.textContent = parsedVal;
                  }
                }
              }
            }

            // Vòng lặp học máy Active Learning: Ghi nhận hiệu chỉnh người dùng
            try {
              const origVal = (globalThis.__AF_INITIAL_PARSED_DATA__ && globalThis.__AF_INITIAL_PARSED_DATA__[field]) || '';
              if (origVal && String(origVal).trim() !== String(parsedVal).trim()) {
                if (typeof AddressLearning !== 'undefined' && typeof AddressLearning.recordUserCorrection === 'function') {
                  const rawOrderInput = globalThis.__AF_RAW_ORDER_INPUT__ || (root.getElementById('rawOrderText') ? root.getElementById('rawOrderText').value : '');
                  const activePhone = (globalThis.parsedDataStore && globalThis.parsedDataStore.phone) || '';
                  AddressLearning.recordUserCorrection({
                    field,
                    originalValue: origVal,
                    correctedValue: parsedVal,
                    rawText: rawOrderInput,
                    phone: activePhone
                  }).catch(() => {});
                }
              }
            } catch (_) {}

            Promise.resolve(onFieldEditHandler(field, parsedVal))
              .finally(() => updateOrderReadinessBadge(globalThis.parsedDataStore));
          }
        };
        // Chỉ lưu và đồng bộ khi người dùng đã kết thúc chỉnh sửa (blur hoặc bấm Enter)
        el.addEventListener('blur', triggerEdit);
        el.addEventListener('input', () => {
          // Cập nhật bộ nhớ đệm và badge tức thì để người dùng thấy trạng thái, KHÔNG kích hoạt tự động điền form
          if (globalThis.parsedDataStore) {
            const field = editableFieldMap[elId];
            let rawTextVal = el.textContent.trim();
            let parsedVal = rawTextVal;
            if (field === 'codAmount') {
              parsedVal = parseInt(rawTextVal.replace(/\D/g, ''), 10) || 0;
            }
            globalThis.parsedDataStore[field] = parsedVal;
            updateOrderReadinessBadge(globalThis.parsedDataStore);
          }
        });
        el.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
        });
      });

      const btnMinimize = root.getElementById('vnpost-btn-minimize');
      btnMinimize.addEventListener('click', (e) => {
        e.stopPropagation();
        if (panel.classList.contains('panel-docked')) {
          applyPanelDisplayMode(panel, dockTab, btnDockToggle, 'docked', { collapsed: true });
          panelStorage.set({ panel_display_mode: 'docked', panel_dock_collapsed: true, panelMinimized: false });
          return;
        }
        panel.classList.add('minimized');
        btnMinimize.innerHTML = PANEL_ICONS.maximize;
        panelStorage.set({ panel_display_mode: 'floating', panelMinimized: true });
      });

      panel.addEventListener('click', (e) => {
        if (panel.classList.contains('panel-floating') && panel.classList.contains('minimized')) {
          panel.classList.remove('minimized');
          btnMinimize.innerHTML = PANEL_ICONS.minimize;
          panelStorage.set({ panel_display_mode: 'floating', panelMinimized: false });
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
              let __hasExtCtx = false; try { __hasExtCtx = typeof chrome !== 'undefined' && chrome.runtime && !!chrome.runtime.id; } catch(e) {}; if (__hasExtCtx && chrome.storage && chrome.storage.local) {
                chrome.storage.local.get(['fbDeviceName'], r => {
                  if (chrome.runtime && chrome.runtime.lastError) return;
                  if (r && r.fbDeviceName && r.fbDeviceName !== 'Máy không tên' && !r.fbDeviceName.startsWith('dev_')) {
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
    if (typeof window === 'undefined' || !elmnt || !dragAnchor) return;
    let p1 = 0, p2 = 0, p3 = 0, p4 = 0;
    
    // Đăng ký sự kiện mousedown cho cả panel để kéo khi thu nhỏ
    elmnt.addEventListener('mousedown', (e) => {
      if (!elmnt.classList.contains('panel-floating')) return;
      // Chỉ kéo từ panel nếu nó đang thu nhỏ
      if (!elmnt.classList.contains('minimized')) return;
      startDrag(e);
    });

    dragAnchor.onmousedown = function(e) {
      if (!elmnt.classList.contains('panel-floating')) return;
      if (e.target.id === 'vnpost-btn-minimize' || e.target.id === 'vnpost-btn-settings' || e.target.id === 'vnpost-btn-theme' || e.target.id === 'vnpost-btn-dock-toggle') return;
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
        if (hasDragged && elmnt.classList.contains('panel-floating')) {
          panelStorage.set({
            panel_float_position: {
              top: elmnt.offsetTop,
              left: elmnt.offsetLeft,
            },
          });
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

  function updateAiConfidenceBadge(state, detail = {}) {
    const confBadgeTop = getVnpostEl('rev-ai-confidence');
    if (!confBadgeTop) return;

    if (state === 'hidden') {
      confBadgeTop.style.display = 'none';
      return;
    }

    confBadgeTop.style.display = 'inline-flex';
    if (state === 'verifying') {
      confBadgeTop.className = 'ai-confidence-badge verifying';
      confBadgeTop.textContent = '⏳ AI đang thẩm định...';
      confBadgeTop.title = 'AI đang đối soát dữ liệu đơn hàng trong nền';
    } else if (state === 'verified') {
      const score = detail.score || 98;
      const isOptimized = detail.optimized || (detail.corrections && detail.corrections.length > 0);
      if (isOptimized) {
        confBadgeTop.className = 'ai-confidence-badge optimized';
        confBadgeTop.textContent = `✨ Đã tối ưu (${score}%)`;
        confBadgeTop.title = `Độ tin cậy: ${score}%\nAI đã hiệu chỉnh thông tin:\n` + (detail.corrections || []).join('\n');
      } else {
        confBadgeTop.className = 'ai-confidence-badge high';
        confBadgeTop.textContent = `🛡️ Tin cậy ${score}% (Khớp chuẩn)`;
        confBadgeTop.title = `Độ tin cậy: ${score}%\nMọi trường thông tin đã được đối soát khớp với quy tắc`;
      }
    } else if (state === 'review_needed') {
      const score = detail.score || 70;
      confBadgeTop.className = 'ai-confidence-badge medium';
      confBadgeTop.textContent = `⚠️ Tin cậy ${score}% (Xem lại)`;
      confBadgeTop.title = `Độ tin cậy: ${score}%\nCần kiểm tra lại một số trường thông tin`;
    } else if (state === 'offline') {
      confBadgeTop.className = 'ai-confidence-badge offline';
      confBadgeTop.textContent = '⚡ Cục bộ (Chưa qua AI)';
      confBadgeTop.title = 'Dữ liệu bóc tách cục bộ (chưa qua thẩm định AI)';
    }
  }
  globalThis.updateAiConfidenceBadge = updateAiConfidenceBadge;

  function updateOrderReadinessBadge(data) {
    const readinessBar = getVnpostEl('order-readiness-bar');
    const readinessText = getVnpostEl('readiness-text');
    if (!readinessBar || !readinessText) return;

    let confBadge = getVnpostEl('readiness-confidence-badge');
    if (!confBadge && readinessBar) {
      confBadge = document.createElement('span');
      confBadge.id = 'readiness-confidence-badge';
      confBadge.className = 'readiness-confidence-badge';
      readinessBar.appendChild(confBadge);
    }

    const fillButtons = [getVnpostEl('btnFillVNPost'), getVnpostEl('btnFillJT')].filter(Boolean);
    const saveButton = getVnpostEl('btnSaveOrder');
    const emptyState = getVnpostEl('panel-empty-state');
    const validationError = getVnpostEl('panel-validation-error');
    const checklist = getVnpostEl('panel-validation-checklist');
    const validationMessage = getVnpostEl('panel-validation-message');
    const setActionsEnabled = (enabled) => {
      fillButtons.forEach(button => { button.disabled = !enabled; });
      if (saveButton) saveButton.disabled = !enabled;
    };

    if (!data) {
      readinessBar.className = 'order-readiness-bar readiness-idle';
      readinessText.textContent = '○ Chờ bóc tách nội dung đơn';
      if (confBadge) confBadge.style.display = 'none';
      setActionsEnabled(false);
      if (emptyState) emptyState.hidden = false;
      if (validationError) validationError.hidden = true;
      return;
    }

    // Cập nhật Confidence Badge
    if (confBadge) {
      const conf = data.confidence;
      if (conf && typeof conf.score === 'number') {
        confBadge.style.display = 'inline-flex';
        confBadge.className = `readiness-confidence-badge confidence-${conf.level || 'medium'}`;
        const icon = conf.level === 'high' ? '🛡️' : conf.level === 'medium' ? '⚡' : '⚠️';
        const label = conf.level === 'high' ? 'Tin cậy' : conf.level === 'medium' ? 'Tương đối' : 'Xem lại';
        confBadge.textContent = `${icon} ${label} ${conf.score}%`;
        confBadge.title = `Độ tin cậy bóc tách: ${conf.score}%\n` + (conf.reasons || []).join('\n');
      } else {
        confBadge.style.display = 'none';
      }
    }

    const hasName = Boolean(data.name && data.name.trim() && data.name !== 'không tìm thấy');
    const rawPhone = (data.phone || '').replace(/\D/g, '');
    const hasPhone = rawPhone.length >= 9;
    const hasAddress = Boolean(data.address && data.address.trim() && data.address !== 'không tìm thấy');
    const isBlacklisted = Boolean(getVnpostEl('rev-phone-warn'));
    const rawTextForAudit = (data && data.rawText) || (getVnpostEl('order-raw-input') ? getVnpostEl('order-raw-input').value : '');
    let codAudit = null;
    if (typeof OrderValidator !== 'undefined' && typeof OrderValidator.auditCOD === 'function') {
      codAudit = OrderValidator.auditCOD(data, rawTextForAudit);
    }
    const isCodValid = codAudit ? codAudit.canProceed : (Number(data.codAmount || 0) > 0 || Boolean(data.codExplicitZero));

    const requiredChecks = [
      { label: 'Khách hàng', valid: hasName, target: 'rev-name' },
      { label: 'Số điện thoại', valid: hasPhone, target: 'rev-phone' },
      { label: 'Địa chỉ', valid: hasAddress, target: 'rev-address' },
      { label: 'COD', valid: isCodValid, target: 'rev-cod' }
    ];
    const missingChecks = requiredChecks.filter(item => !item.valid);
    if (emptyState) emptyState.hidden = true;
    requiredChecks.forEach(item => getVnpostEl(item.target)?.classList.toggle('is-invalid', !item.valid));

    if (missingChecks.length) {
      readinessBar.className = 'order-readiness-bar readiness-error';
      readinessText.textContent = (codAudit && !isCodValid && missingChecks.length === 1) 
        ? (codAudit.status === 'CRITICAL_MISSING_COD' ? '🚨 Đơn thô có COD nhưng chưa nhập COD' : '⚠️ Đơn hàng chưa có tiền COD')
        : '⚠ Cần kiểm tra thông tin bắt buộc';
      setActionsEnabled(false);
      if (validationError) validationError.hidden = false;
      if (checklist) checklist.innerHTML = requiredChecks.map(item => `<span class="${item.valid ? 'is-valid' : 'is-missing'}">${item.valid ? '✓' : '✕'} ${item.label}</span>`).join('');
      if (validationMessage) {
        if (codAudit && codAudit.status === 'CRITICAL_MISSING_COD') {
          validationMessage.textContent = `🚨 NGUY HIỂM: Đơn thô có COD ${codAudit.codRaw.toLocaleString('vi-VN')} đ nhưng form đang là 0đ!`;
        } else if (codAudit && codAudit.status === 'NO_COD_WARNING' && missingChecks.length === 1) {
          validationMessage.textContent = '⚠️ Đơn hàng chưa có tiền COD. Vui lòng nhập số tiền hoặc xác nhận đơn 0đ.';
        } else {
          validationMessage.textContent = missingChecks.map(item => item.label).join(', ') + ' chưa được nhận diện.';
        }
      }
      return;
    }

    if (validationError) validationError.hidden = true;
    setActionsEnabled(true);

    if (isBlacklisted) {
      readinessBar.className = 'order-readiness-bar readiness-warn';
      readinessText.textContent = '⚠️ CẢNH BÁO: SĐT BOM HÀNG';
      return;
    }

    if (hasName && hasPhone && hasAddress) {
      readinessBar.className = 'order-readiness-bar readiness-ready';
      readinessText.textContent = '🟢 SẴN SÀNG NHẬP ĐƠN';
    } else if (!hasPhone || !hasAddress) {
      readinessBar.className = 'order-readiness-bar readiness-error';
      readinessText.textContent = '🔴 THIẾU THÔNG TIN: ' + (!hasPhone ? 'SĐT' : 'Địa chỉ');
    } else {
      readinessBar.className = 'order-readiness-bar readiness-warn';
      readinessText.textContent = '🟡 CẦN KIỂM TRA LẠI THÔNG TIN';
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
      if (codEl) codEl.innerHTML = '<span class="skeleton" style="width: 40%; height: 18px;">&nbsp;</span>';

      const feeEl = getVnpostEl('rev-fee');
      if (feeEl) feeEl.innerHTML = '<span class="skeleton" style="width: 35%; height: 14px;">&nbsp;</span>';

      const reviewPanel = getVnpostEl('review-panel');
      if (reviewPanel) reviewPanel.style.display = 'none';

      const emptyState = getVnpostEl('panel-empty-state');
      const validationError = getVnpostEl('panel-validation-error');
      const dupAlert = getVnpostEl('panel-duplicate-alert');
      if (emptyState) emptyState.hidden = true;
      if (validationError) validationError.hidden = true;
      if (dupAlert) dupAlert.style.display = 'none';
      [getVnpostEl('btnFillVNPost'), getVnpostEl('btnFillJT'), getVnpostEl('btnSaveOrder')]
        .filter(Boolean).forEach(button => { button.disabled = true; });

      const readinessBar = getVnpostEl('order-readiness-bar');
      const readinessText = getVnpostEl('readiness-text');
      if (readinessBar && readinessText) {
        readinessBar.className = 'order-readiness-bar readiness-idle';
        readinessText.textContent = '⏳ Đang phân tích dữ liệu...';
      }
    });
  }

  /**
   * Bảng Xét Duyệt & Đối Chiếu Đơn Hàng Trước Khi Tạo
   * Chốt chặn kiểm soát kép, tiêu điểm thị giác số 1 là Tiền COD
   */
  function showOrderApprovalModal(options = {}) {
    return new Promise((resolve) => {
      const {
        carrierData = null,
        panelData = null,
        orderData = {},
        rawText = '',
        platform = 'vnpost',
        onConfirm,
        onCancel,
        onUpdateCOD
      } = options;

      let host = document.getElementById('vnpost-autofill-shadow-host');
      if (!host && typeof document !== 'undefined' && document.body) {
        host = document.createElement('div');
        host.id = 'vnpost-autofill-shadow-host';
        document.body.appendChild(host);
      }
      let root = (host && host.shadowRoot) ? host.shadowRoot : (host && host.attachShadow ? host.attachShadow({ mode: 'open' }) : null);
      if (root && root.querySelector && !root.querySelector('#vnpost-shadow-style')) {
        const style = document.createElement('style');
        style.id = 'vnpost-shadow-style';
        style.textContent = typeof PANEL_CSS !== 'undefined' ? PANEL_CSS : '';
        root.appendChild(style);
      }
      if (!root) {
        root = (typeof document !== 'undefined' && document.body) ? document.body : null;
      }
      if (!root) {
        resolve({ confirmed: true, orderData: carrierData || orderData });
        return;
      }

      // Xóa modal cũ nếu đang tồn tại
      const existingModal = (root.getElementById ? root.getElementById('af-order-approval-modal') : null) ||
                            (root.querySelector ? root.querySelector('#af-order-approval-modal') : null) ||
                            (typeof document !== 'undefined' && document.getElementById ? document.getElementById('af-order-approval-modal') : null);
      if (existingModal) existingModal.remove();

      const activeCarrierData = carrierData || orderData || {};
      const activePanelData = panelData || globalThis.parsedDataStore || globalThis.__AF_LAST_FILLED_ORDER__ || {};

      let currentOrderData = { ...activeCarrierData };

      // Tự động ưu tiên đồng bộ số tiền COD từ Panel nếu trên form bưu điện đang là 0đ
      const initCarrierCod = Number(currentOrderData.codAmount || 0);
      const initPanelCod = Number(activePanelData.codAmount !== undefined ? activePanelData.codAmount : 0);
      if (initCarrierCod === 0 && initPanelCod > 0 && !activePanelData.codExplicitZero) {
        currentOrderData.codAmount = initPanelCod;
      }

      let userConfirmedZero = Boolean(currentOrderData.codExplicitZero || activePanelData.codExplicitZero);
      let isEditingCod = false;

      function getAuditResult() {
        const amt = Number(currentOrderData.codAmount || 0);
        const pAmt = Number(activePanelData.codAmount !== undefined ? activePanelData.codAmount : 0);
        const hasPanelData = Boolean(
          activePanelData &&
          (activePanelData.name || activePanelData.phone || activePanelData.codAmount !== undefined || activePanelData.orderCode)
        );

        let spelledWords = (typeof OrderValidator !== 'undefined' && OrderValidator.readVietnameseCurrency)
          ? OrderValidator.readVietnameseCurrency(amt) : (amt.toLocaleString('vi-VN') + ' đ');

        // Đối chiếu Form Bưu Cục với Panel Auto Fill
        if (hasPanelData && (pAmt > 0 || activePanelData.codExplicitZero)) {
          if (amt === pAmt) {
            return {
              status: 'MATCH',
              level: 'success',
              badge: '✓ KHỚP HOÀN TOÀN',
              title: 'Tiền thu hộ khớp 100%',
              message: `Tiền COD trên Form Bưu Điện trùng khớp 100% với Panel Auto Fill (${amt.toLocaleString('vi-VN')} đ).`,
              canProceed: true,
              suggestedCod: null,
              codForm: amt,
              codPanel: pAmt,
              spelledOutWords: spelledWords,
              hasPanelData: true
            };
          } else {
            const diff = Math.abs(amt - pAmt);
            return {
              status: 'MISMATCH',
              level: 'danger',
              badge: `🚨 LỆCH TIỀN (${diff.toLocaleString('vi-VN')} đ)`,
              title: 'CẢNH BÁO LỆCH TIỀN COD',
              message: `Trên Form Bưu Điện đang là ${amt.toLocaleString('vi-VN')} đ, lệch ${diff.toLocaleString('vi-VN')} đ so với Panel (${pAmt.toLocaleString('vi-VN')} đ). Hãy kiểm tra hoặc bấm đồng bộ bên dưới!`,
              canProceed: userConfirmedZero,
              suggestedCod: pAmt,
              codForm: amt,
              codPanel: pAmt,
              spelledOutWords: spelledWords,
              hasPanelData: true
            };
          }
        }

        // Nếu Form có COD = 0 mà chưa xác nhận 0đ
        if (amt === 0 && !userConfirmedZero) {
          return {
            status: 'NO_COD_WARNING',
            level: 'warning',
            badge: '⚠️ CHƯA CÓ TIỀN COD',
            title: 'Đơn hàng chưa có tiền thu hộ (0đ)',
            message: 'Form bưu điện đang có COD = 0đ. Nếu khách đã chuyển khoản trước hoặc quà tặng, hãy bấm Xác nhận đơn 0đ.',
            canProceed: false,
            suggestedCod: (pAmt > 0 ? pAmt : null),
            codForm: 0,
            codPanel: pAmt,
            spelledOutWords: 'Không đồng (0 đ)',
            hasPanelData: hasPanelData
          };
        }

        // Fallback OrderValidator.auditCOD
        if (typeof OrderValidator !== 'undefined' && typeof OrderValidator.auditCOD === 'function') {
          const vAudit = OrderValidator.auditCOD(currentOrderData, rawText, { userConfirmedZero });
          return {
            ...vAudit,
            codPanel: pAmt,
            hasPanelData: hasPanelData
          };
        }

        return {
          status: 'VALID_MATCH',
          level: 'success',
          badge: '✓ COD HỢP LỆ',
          title: 'Số tiền COD hợp lệ',
          message: `Đã nhập tiền COD hợp lệ (${amt.toLocaleString('vi-VN')} đ).`,
          canProceed: true,
          suggestedCod: null,
          codForm: amt,
          codPanel: pAmt,
          spelledOutWords: spelledWords,
          hasPanelData: hasPanelData
        };
      }

      function isValueMatch(val1, val2, type = 'text') {
        const v1 = String(val1 || '').trim();
        const v2 = String(val2 || '').trim();
        if (!v1 || !v2 || v1 === '—' || v2 === '—' || v1 === 'không tìm thấy' || v2 === 'không tìm thấy') {
          return true;
        }
        if (type === 'phone') {
          const d1 = v1.replace(/\D/g, '');
          const d2 = v2.replace(/\D/g, '');
          return d1 === d2 || (d1.length >= 9 && d2.length >= 9 && (d1.endsWith(d2) || d2.endsWith(d1)));
        }
        if (type === 'code') {
          return v1.toLowerCase().replace(/[^a-z0-9]/g, '') === v2.toLowerCase().replace(/[^a-z0-9]/g, '');
        }
        if (type === 'address') {
          const n1 = v1.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
          const n2 = v2.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
          return n1 === n2 || n1.includes(n2) || n2.includes(n1);
        }
        if (type === 'note') {
          const n1 = v1.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
          const n2 = v2.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
          if (n1 === n2 || n1.includes(n2) || n2.includes(n1)) return true;
          // Bóc bỏ tiền tố tự động sinh ra khi điền form bưu điện như "Đơn hàng: E120.564 " hay "Đơn: ..."
          const clean1 = n1.replace(/^(?:don\s*hang|don|ma\s*don)\s*:\s*[a-z0-9._-]+\s*/i, '').trim();
          const clean2 = n2.replace(/^(?:don\s*hang|don|ma\s*don)\s*:\s*[a-z0-9._-]+\s*/i, '').trim();
          return clean1 === clean2 || (clean1 && clean2 && (clean1.includes(clean2) || clean2.includes(clean1)));
        }
        const n1 = v1.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
        const n2 = v2.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
        return n1 === n2;
      }

      const APPROVAL_ICONS = {
        shield: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>`,
        close: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
        user: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
        phone: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
        location: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
        map: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>`,
        tag: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>`,
        box: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
        scale: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/></svg>`,
        creditCard: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>`,
        note: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
        zap: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
        truck: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="13" x="1" y="5" rx="2"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>`,
        pin: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/></svg>`,
        edit: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>`,
        fileText: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>`,
        check: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
        alert: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`
      };

      function getFieldIcon(label) {
        if (label.includes('Người nhận')) return APPROVAL_ICONS.user;
        if (label.includes('Số điện thoại') || label.includes('SĐT')) return APPROVAL_ICONS.phone;
        if (label.includes('Địa chỉ')) return APPROVAL_ICONS.location;
        if (label.includes('Địa giới')) return APPROVAL_ICONS.map;
        if (label.includes('Mã đơn') || label.includes('SKU')) return APPROVAL_ICONS.tag;
        if (label.includes('hàng hóa')) return APPROVAL_ICONS.box;
        if (label.includes('Khối lượng')) return APPROVAL_ICONS.scale;
        if (label.includes('trả cước')) return APPROVAL_ICONS.creditCard;
        if (label.includes('Ghi chú')) return APPROVAL_ICONS.note;
        if (label.includes('Nguồn')) return APPROVAL_ICONS.zap;
        return APPROVAL_ICONS.pin;
      }

      function formatPhoneDisplay(p) {
        const raw = String(p || '').trim();
        const digits = raw.replace(/\D/g, '');
        if (digits.length === 10) {
          return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
        }
        return raw || '—';
      }

      function renderCompareRow(label, carrierVal, panelVal, isMatch, isAddress = false, customStatusHtml = null) {
        const cVal = (carrierVal && carrierVal !== 'không tìm thấy') ? carrierVal : '—';
        const pVal = (panelVal && panelVal !== 'không tìm thấy') ? panelVal : '—';
        const matchPill = customStatusHtml || (isMatch
          ? `<span class="af-compare-pill-match">${APPROVAL_ICONS.check} Khớp</span>`
          : `<span class="af-compare-pill-mismatch">${APPROVAL_ICONS.alert} Khác biệt</span>`);
        const cValHtml = isAddress ? `<div class="af-address-cell-box">${cVal}</div>` : `<div class="af-text-cell-wrap">${cVal}</div>`;
        const pValHtml = isAddress ? `<div class="af-address-cell-box panel-addr">${pVal}</div>` : `<div class="af-text-cell-wrap">${pVal}</div>`;
        const icon = getFieldIcon(label);
        return `
          <div class="af-compare-row ${isMatch ? 'is-match' : 'is-mismatch'} ${isAddress ? 'row-address' : ''}">
            <div class="af-compare-cell-label" title="${label}">
              <span class="af-field-icon">${icon}</span>
              <span class="af-field-name">${label}</span>
            </div>
            <div class="af-compare-cell cell-carrier ${isAddress ? 'highlight-address' : ''}" title="Form Bưu Điện: ${cVal}">${cValHtml}</div>
            <div class="af-compare-cell cell-panel ${isAddress ? 'highlight-address' : ''}" title="Panel Auto Fill: ${pVal}">${pValHtml}</div>
            <div class="af-compare-cell-status">${matchPill}</div>
          </div>
        `;
      }

      let audit = getAuditResult();

      const modalOverlay = document.createElement('div');
      modalOverlay.id = 'af-order-approval-modal';
      modalOverlay.className = 'af-approval-overlay';

      function renderModalContent() {
        audit = getAuditResult();
        const platObj = normalizePlatform(platform);
        const carrierAcc = typeof detectCarrierAccount === 'function' ? detectCarrierAccount(platObj.id) : '';
        const shopName = currentOrderData.shopName || (typeof _lastShopName !== 'undefined' ? _lastShopName : '') || '';

        const formattedFormAmt = (Number(currentOrderData.codAmount || 0)).toLocaleString('vi-VN') + ' đ';
        const formattedPanelAmt = audit.hasPanelData
          ? (audit.codPanel > 0 ? Number(audit.codPanel).toLocaleString('vi-VN') + ' đ' : (activePanelData.codExplicitZero ? '0 đ (Xác nhận)' : '0 đ'))
          : (audit.codRaw > 0 ? Number(audit.codRaw).toLocaleString('vi-VN') + ' đ' : 'Chưa có');

        const isNameMatch = isValueMatch(currentOrderData.name, activePanelData.name, 'name');
        const isPhoneMatch = isValueMatch(currentOrderData.phone, activePanelData.phone, 'phone');
        const isAddrMatch = isValueMatch(currentOrderData.address, activePanelData.address, 'address');
        const isCodeMatch = isValueMatch(currentOrderData.orderCode, activePanelData.orderCode, 'code');

        // Đối chiếu khối lượng chính xác (hỗ trợ cả cấu hình mặc định shop và gram/kg)
        const isJT = platObj.id === 'jt';
        const cWeightNum = Number(currentOrderData.weightGrams || currentOrderData.weight || 0);

        let pWeightNum = 0;
        if (isJT) {
          if (activePanelData.defaultWeightJt && Number(activePanelData.defaultWeightJt) > 0) {
            pWeightNum = Number(activePanelData.defaultWeightJt);
          } else if (activePanelData.weightGrams && Number(activePanelData.weightGrams) > 0) {
            pWeightNum = Number(activePanelData.weightGrams) >= 10 ? (Number(activePanelData.weightGrams) / 1000) : Number(activePanelData.weightGrams);
          } else if (activePanelData.weight && Number(activePanelData.weight) > 0) {
            pWeightNum = Number(activePanelData.weight) >= 10 ? (Number(activePanelData.weight) / 1000) : Number(activePanelData.weight);
          } else if (activePanelData.defaultWeightVnpost && Number(activePanelData.defaultWeightVnpost) > 0) {
            pWeightNum = Number(activePanelData.defaultWeightVnpost) >= 10 ? (Number(activePanelData.defaultWeightVnpost) / 1000) : Number(activePanelData.defaultWeightVnpost);
          }
        } else {
          pWeightNum = Number(
            activePanelData.weightGrams || 
            activePanelData.defaultWeightVnpost || 
            activePanelData.weight || 
            0
          );
        }

        const cWeightClean = (cWeightNum > 0 && cWeightNum < 50 && isJT) ? Math.round(cWeightNum * 1000) : Math.round(cWeightNum);
        const pWeightClean = (pWeightNum > 0 && pWeightNum < 50 && isJT) ? Math.round(pWeightNum * 1000) : Math.round(pWeightNum);

        const cWeightDisplay = isJT
          ? (cWeightNum > 0 ? (cWeightNum < 50 ? `${cWeightNum} kg` : `${cWeightNum / 1000} kg`) : '0.2 kg')
          : (cWeightNum > 0 ? `${cWeightNum} g` : '200 g');

        const pWeightDisplay = isJT
          ? (pWeightNum > 0 ? (pWeightNum < 50 ? `${pWeightNum} kg` : `${pWeightNum / 1000} kg`) : '0.2 kg')
          : (pWeightNum > 0 ? `${pWeightNum} g` : '200 g');

        const isWeightMatch = (cWeightClean > 0 && pWeightClean > 0) ? (Math.abs(cWeightClean - pWeightClean) <= 1) : true;

        // Đối chiếu ghi chú phát thông minh (nhận diện ghi chú tự sinh theo mã đơn)
        let cNoteRaw = String(currentOrderData.notes || currentOrderData.extraNote || '').trim();
        const pNoteRaw = String(activePanelData.notes || activePanelData.extraNote || '').trim();
        const orderCodeForNote = String(currentOrderData.orderCode || activePanelData.orderCode || '').trim();

        // Nếu trên J&T cNote chưa có nhưng productItem (Tên hàng hóa) trên form bưu cục đã gộp ghi chú
        if (!cNoteRaw && isJT && currentOrderData.productItem && pNoteRaw) {
          if (isValueMatch(currentOrderData.productItem, pNoteRaw, 'note') || currentOrderData.productItem.toLowerCase().includes(pNoteRaw.toLowerCase())) {
            cNoteRaw = pNoteRaw;
          }
        }

        // Tự động kiểm tra ghi chú tự sinh theo mã đơn (ví dụ: "Đơn hàng: Pt276" hay "Đơn: Pt276")
        const isAutoGeneratedNote = Boolean(
          orderCodeForNote && cNoteRaw && (
            cNoteRaw.toLowerCase() === `đơn hàng: ${orderCodeForNote.toLowerCase()}` ||
            cNoteRaw.toLowerCase() === `đơn: ${orderCodeForNote.toLowerCase()}` ||
            cNoteRaw.toLowerCase().replace(/\s+/g, '') === `đơnhàng:${orderCodeForNote.toLowerCase().replace(/\s+/g, '')}` ||
            cNoteRaw.toLowerCase().includes(orderCodeForNote.toLowerCase())
          ) && (!pNoteRaw || pNoteRaw.toLowerCase() === orderCodeForNote.toLowerCase() || pNoteRaw === '—')
        );

        let isNoteMatch = false;
        let noteCustomPill = null;
        let cNoteDisplay = cNoteRaw || '—';
        let pNoteDisplay = pNoteRaw || '—';

        if (isAutoGeneratedNote) {
          isNoteMatch = true;
          pNoteDisplay = pNoteRaw ? pNoteRaw : `Tự sinh theo mã đơn (${orderCodeForNote})`;
          noteCustomPill = `<span class="af-compare-pill-compatible">${APPROVAL_ICONS.zap} Tự sinh theo mã</span>`;
        } else if (!cNoteRaw && !pNoteRaw) {
          isNoteMatch = true;
          cNoteDisplay = '—';
          pNoteDisplay = '—';
        } else if (cNoteRaw && pNoteRaw) {
          isNoteMatch = isValueMatch(cNoteRaw, pNoteRaw, 'note');
        }

        // Bóc tách chi tiết địa giới hành chính (3 cấp / 2 cấp)
        const addrParts = activePanelData.addressParts || {};
        let addrStreet = activePanelData.street || addrParts.street || '';
        let addrWard = activePanelData.ward || addrParts.ward || '';
        let addrDistrict = activePanelData.district || addrParts.district || '';
        let addrProvince = activePanelData.province || addrParts.province || '';

        if (!addrWard && !addrDistrict && !addrProvince && typeof globalThis.AddressParser !== 'undefined' && globalThis.AddressParser.parse) {
          try {
            const parsedAddr = globalThis.AddressParser.parse(currentOrderData.address || activePanelData.address || '');
            if (parsedAddr) {
              addrStreet = parsedAddr.street || addrStreet;
              addrWard = parsedAddr.ward || addrWard;
              addrDistrict = parsedAddr.district || addrDistrict;
              addrProvince = parsedAddr.province || addrProvince;
            }
          } catch (_) {}
        }

        modalOverlay.innerHTML = `
          <div class="af-approval-card" role="dialog" aria-modal="true" aria-labelledby="af-approval-title">
            <div class="af-approval-header">
              <div class="af-approval-title-group">
                <div class="af-header-shield-wrap">
                  <span class="af-header-shield-icon">${APPROVAL_ICONS.shield}</span>
                </div>
                <div class="af-title-text-wrap">
                  <div class="af-title-row">
                    <h3 id="af-approval-title">XÉT DUYỆT & ĐỐI CHIẾU ĐƠN HÀNG</h3>
                    <span class="af-badge-carrier ${platObj.id === 'jt' ? 'carrier-jt' : 'carrier-vnpost'}">
                      <span class="af-carrier-indicator"></span>${platObj.title || 'VNPost'}
                    </span>
                  </div>
                  <div class="af-approval-meta-row">
                    ${carrierAcc ? `
                      <span class="af-badge-account" title="Tài khoản bưu điện đang đăng nhập">
                        <span class="af-badge-account-icon">${APPROVAL_ICONS.user}</span>
                        <span class="af-badge-account-label">Tài khoản:</span>
                        <strong class="af-badge-account-name">${carrierAcc}</strong>
                      </span>
                    ` : ''}
                    ${shopName ? `<span class="af-approval-pill pill-shop" title="Cửa hàng"><span class="pill-dot"></span>Shop: <strong>${shopName}</strong></span>` : ''}
                    ${currentOrderData.orderCode ? `<span class="af-approval-pill af-pill-code" title="Mã đơn hàng SKU"><span class="af-pill-lbl">Mã:</span> <strong class="af-pill-val">${currentOrderData.orderCode}</strong></span>` : ''}
                  </div>
                </div>
              </div>
              <button type="button" class="af-approval-close-btn" id="modal-close-icon-btn" title="Đóng (Esc)">${APPROVAL_ICONS.close}</button>
            </div>

            <div class="af-approval-body-grid">
              <!-- CỘT TRÁI: BẢNG ĐỐI CHIẾU CHI TIẾT TẤT CẢ CÁC TRƯỜNG -->
              <div class="af-approval-left-col">
                <div class="af-review-section-title">
                  <span class="af-table-title-icon">${APPROVAL_ICONS.map}</span>
                  <span>BẢNG ĐỐI CHIẾU CHI TIẾT ĐƠN HÀNG (Form bưu điện ⟷ Panel Auto Fill)</span>
                </div>
                <div class="af-compare-container">
                  <div class="af-compare-header">
                    <div class="af-compare-col-th field-name">Trường thông tin</div>
                    <div class="af-compare-col-th carrier">Form Bưu Điện (${platObj.title || 'VNPost'})</div>
                    <div class="af-compare-col-th panel">Panel Auto Fill</div>
                    <div class="af-compare-col-th status-col">Trạng thái</div>
                  </div>

                  <div class="af-compare-list">
                    <!-- NHÓM 1: THÔNG TIN KHÁCH HÀNG & ĐỊA CHỈ PHÁT -->
                    <div class="af-compare-group-header customer">
                      <span class="af-group-icon">${APPROVAL_ICONS.user}</span>
                      <span class="af-group-title">1. Thông tin người nhận & Địa chỉ phát</span>
                      <span class="af-group-badge">Trọng yếu</span>
                    </div>

                    ${renderCompareRow('Người nhận', currentOrderData.name, activePanelData.name, isNameMatch)}
                    ${renderCompareRow('Số điện thoại', formatPhoneDisplay(currentOrderData.phone), formatPhoneDisplay(activePanelData.phone), isPhoneMatch)}
                    ${renderCompareRow('Địa chỉ', currentOrderData.address, activePanelData.address, isAddrMatch, true)}
                    
                    ${(addrProvince || addrDistrict || addrWard || addrStreet) ? `
                      <div class="af-compare-row is-match row-geo">
                        <div class="af-compare-cell-label" title="Địa giới hành chính nhận diện (Panel)">
                          <span class="af-field-icon">${APPROVAL_ICONS.map}</span>
                          <span class="af-field-name">Địa giới hành chính</span>
                        </div>
                        <div class="af-compare-cell cell-carrier geo-hint">
                          <span class="af-geo-carrier-note">Bưu điện tự đối chiếu tọa độ</span>
                        </div>
                        <div class="af-compare-cell cell-panel">
                          <div class="af-address-breakdown">
                            ${addrStreet ? `<span class="af-address-sub-pill pill-street" title="Số nhà / Đường"><span class="pill-tag">Đường:</span> <strong class="pill-val">${addrStreet}</strong></span>` : ''}
                            ${addrWard ? `<span class="af-address-sub-pill pill-ward" title="Xã / Phường"><span class="pill-tag">Xã/Phường:</span> <strong class="pill-val">${addrWard}</strong></span>` : ''}
                            ${addrDistrict ? `<span class="af-address-sub-pill pill-district" title="Quận / Huyện"><span class="pill-tag">Quận/Huyện:</span> <strong class="pill-val">${addrDistrict}</strong></span>` : ''}
                            ${addrProvince ? `<span class="af-address-sub-pill pill-province" title="Tỉnh / Thành phố"><span class="pill-tag">Tỉnh/TP:</span> <strong class="pill-val">${addrProvince}</strong></span>` : ''}
                          </div>
                        </div>
                        <div class="af-compare-cell-status"><span class="af-compare-pill-match">${APPROVAL_ICONS.check} Chuẩn</span></div>
                      </div>
                    ` : ''}

                    <!-- NHÓM 2: BƯU KIỆN & HÀNG HÓA -->
                    <div class="af-compare-group-header package">
                      <span class="af-group-icon">${APPROVAL_ICONS.box}</span>
                      <span class="af-group-title">2. Chi tiết bưu kiện & Hàng hóa</span>
                      <span class="af-group-badge">Bưu kiện</span>
                    </div>

                    ${(currentOrderData.orderCode || activePanelData.orderCode) ? renderCompareRow('Mã đơn (SKU)', currentOrderData.orderCode, activePanelData.orderCode, isCodeMatch) : ''}
                    
                    ${(() => {
                      const formGoods = String(currentOrderData.goodsName || currentOrderData.productItem || '').trim();
                      const panelExplicitGoods = String(activePanelData.goodsName || activePanelData.productItem || '').trim();
                      const orderCodeVal = String(currentOrderData.orderCode || activePanelData.orderCode || '').trim();

                      let formGoodsDisplay = formGoods || '— (Mặc định hệ thống)';
                      let panelGoodsDisplay = panelExplicitGoods;
                      if (!panelGoodsDisplay) {
                        if (formGoods && orderCodeVal && isValueMatch(formGoods, orderCodeVal, 'code')) {
                          panelGoodsDisplay = orderCodeVal;
                        } else {
                          panelGoodsDisplay = activePanelData.defaultGoodsName || 'Hàng hóa';
                        }
                      }

                      let isGoodsMatch = false;
                      if (!formGoods && !panelGoodsDisplay) {
                        isGoodsMatch = true;
                      } else if (isValueMatch(formGoods, panelGoodsDisplay, 'text')) {
                        isGoodsMatch = true;
                      } else if (orderCodeVal && (isValueMatch(formGoods, orderCodeVal, 'code') || formGoods.includes(orderCodeVal))) {
                        isGoodsMatch = true;
                      } else if (!formGoods || /^(?:hàng hóa|hang hoa)$/i.test(formGoods) || /^(?:hàng hóa|hang hoa)$/i.test(panelGoodsDisplay)) {
                        isGoodsMatch = true;
                      }

                      return renderCompareRow('Tên hàng hóa',
                        formGoodsDisplay,
                        panelGoodsDisplay || '—',
                        isGoodsMatch
                      );
                    })()}
                    
                    ${renderCompareRow('Khối lượng', cWeightDisplay, pWeightDisplay, isWeightMatch)}

                    <!-- NHÓM 3: CƯỚC PHÍ & VẬN CHUYỂN -->
                    <div class="af-compare-group-header service">
                      <span class="af-group-icon">${APPROVAL_ICONS.truck}</span>
                      <span class="af-group-title">3. Cước phí & Ghi chú giao hàng</span>
                      <span class="af-group-badge">Vận hành</span>
                    </div>
                    
                    ${renderCompareRow('Người trả cước',
                      currentOrderData.collectFee ? 'Người nhận trả cước' : 'Shop trả cước',
                      activePanelData.collectFee ? 'Người nhận trả cước' : 'Shop trả cước',
                      Boolean(currentOrderData.collectFee) === Boolean(activePanelData.collectFee)
                    )}
                    
                    ${renderCompareRow('Ghi chú phát', cNoteDisplay, pNoteDisplay, isNoteMatch, false, noteCustomPill)}

                    ${renderCompareRow('Nguồn gốc tạo đơn',
                      (currentOrderData.source === 'MANUAL' ? 'Nhập thủ công' : 'Tách đơn AI (Auto Fill)'),
                      'Tách đơn AI (Auto Fill)',
                      true
                    )}
                  </div>
                </div>
              </div>

              <!-- CỘT PHẢI: TIÊU ĐIỂM TIỀN COD & THAO TÁC -->
              <div class="af-approval-right-col">
                <div class="af-hero-cod level-${audit.level}">
                  <div class="af-hero-cod-top">
                    <span class="af-hero-cod-label">${APPROVAL_ICONS.creditCard} TIỀN THU HỘ (COD)</span>
                    <span class="af-hero-cod-badge">${audit.badge}</span>
                  </div>

                  <div class="af-hero-cod-center">
                    <div class="af-hero-cod-amount" id="modal-hero-cod-amount">${formattedFormAmt}</div>
                    <div class="af-hero-cod-words" id="modal-hero-cod-words">${audit.spelledOutWords}</div>
                  </div>

                  <div class="af-cod-compare-grid">
                    <div class="af-cod-compare-col ${formattedFormAmt === formattedPanelAmt ? 'is-matched' : ''}">
                      <div class="af-cod-source-header">
                        <span class="af-cod-dot carrier-dot"></span>
                        <span class="af-cod-compare-title">Form Bưu Điện</span>
                      </div>
                      <span class="af-cod-compare-val">${formattedFormAmt}</span>
                    </div>
                    <div class="af-cod-compare-divider">
                      <span class="af-cod-comp-sign">${formattedFormAmt === formattedPanelAmt ? '=' : '≠'}</span>
                    </div>
                    <div class="af-cod-compare-col ${formattedFormAmt === formattedPanelAmt ? 'is-matched' : ''}">
                      <div class="af-cod-source-header">
                        <span class="af-cod-dot panel-dot"></span>
                        <span class="af-cod-compare-title">Panel Auto Fill</span>
                      </div>
                      <span class="af-cod-compare-val">${formattedPanelAmt}</span>
                    </div>
                  </div>

                  <div class="af-cod-alert-box" id="modal-cod-alert-box">
                    <span class="af-alert-icon-wrap">${audit.level === 'danger' ? APPROVAL_ICONS.alert : audit.level === 'warning' ? APPROVAL_ICONS.alert : APPROVAL_ICONS.check}</span>
                    <div class="af-alert-text">
                      <strong class="af-alert-title">${audit.title}</strong>
                      <span class="af-alert-msg">${audit.message}</span>
                    </div>
                  </div>

                  ${isEditingCod ? `
                    <div class="af-inline-cod-edit">
                      <input type="text" class="af-inline-cod-input" id="modal-inline-cod-input" placeholder="Nhập số tiền COD (ví dụ: 350000)" value="${currentOrderData.codAmount || ''}" />
                      <div class="af-inline-cod-btns">
                        <button type="button" class="af-quick-btn af-quick-btn-apply" id="modal-inline-cod-save-btn">Lưu số tiền</button>
                        <button type="button" class="af-quick-btn af-quick-btn-edit" id="modal-inline-cod-cancel-btn">Hủy</button>
                      </div>
                    </div>
                  ` : `
                    <div class="af-cod-quick-actions">
                      ${audit.suggestedCod && audit.suggestedCod > 0 && audit.suggestedCod !== Number(currentOrderData.codAmount || 0) ? `
                        <button type="button" class="af-quick-btn af-quick-btn-apply" id="modal-quick-apply-panel-btn">
                          ${APPROVAL_ICONS.zap} Đồng bộ ${audit.suggestedCod.toLocaleString('vi-VN')} đ từ Panel sang Form
                        </button>
                      ` : ''}

                      ${(Number(currentOrderData.codAmount || 0) === 0 || audit.status === 'NO_COD_WARNING') && !userConfirmedZero ? `
                        <button type="button" class="af-quick-btn af-quick-btn-zero" id="modal-quick-confirm-zero-btn">
                          ${APPROVAL_ICONS.check} Xác nhận đơn 0đ (Khách chuyển khoản / Quà tặng)
                        </button>
                      ` : ''}

                      <button type="button" class="af-quick-btn af-quick-btn-edit" id="modal-quick-edit-btn">
                        ${APPROVAL_ICONS.edit} Sửa số tiền COD
                      </button>
                    </div>
                  `}
                </div>

                ${rawText ? `
                  <details class="af-raw-preview-details">
                    <summary>
                      <span class="raw-summary-left">${APPROVAL_ICONS.fileText} Xem lại nội dung đơn thô gốc</span>
                      <span class="raw-summary-arrow">▾</span>
                    </summary>
                    <div class="af-raw-preview-content">${rawText}</div>
                  </details>
                ` : ''}
              </div>
            </div>

            <!-- FOOTER NÚT BẤM CHUẨN UX/UI -->
            <div class="af-modal-actions">
              <div class="af-footer-summary">
                <span class="af-pulse-dot ${audit.canProceed ? 'is-ready' : 'is-warning'}"></span>
                <span class="af-footer-summary-text">
                  ${audit.canProceed 
                    ? 'Tất cả dữ liệu đã được đối chiếu • Sẵn sàng gửi đơn' 
                    : 'Cần xác nhận số tiền COD trước khi tiếp tục'}
                </span>
              </div>
              <div class="af-footer-btns">
                <button type="button" class="af-modal-btn-cancel" id="modal-cancel-btn">
                  Quay lại sửa <kbd class="af-kbd">Esc</kbd>
                </button>
                <button type="button" class="af-modal-btn-confirm" id="modal-confirm-btn" ${audit.canProceed ? '' : 'disabled'} title="${audit.canProceed ? 'Xác nhận tạo đơn và gửi lên bưu điện (Enter)' : 'Cần xử lý tiền COD trước khi tạo đơn'}">
                  ${APPROVAL_ICONS.zap} Xác Nhận Gửi Lên Bưu Điện <kbd class="af-kbd primary">Enter</kbd>
                </button>
              </div>
            </div>
          </div>
        `;

        bindModalEvents();
      }

      function bindModalEvents() {
        const closeBtn = modalOverlay.querySelector('#modal-close-icon-btn');
        const cancelBtn = modalOverlay.querySelector('#modal-cancel-btn');
        const confirmBtn = modalOverlay.querySelector('#modal-confirm-btn');
        const editBtn = modalOverlay.querySelector('#modal-quick-edit-btn');
        const applyPanelBtn = modalOverlay.querySelector('#modal-quick-apply-panel-btn');
        const confirmZeroBtn = modalOverlay.querySelector('#modal-quick-confirm-zero-btn');
        const inlineSaveBtn = modalOverlay.querySelector('#modal-inline-cod-save-btn');
        const inlineCancelBtn = modalOverlay.querySelector('#modal-inline-cod-cancel-btn');
        const inlineInput = modalOverlay.querySelector('#modal-inline-cod-input');

        const doClose = (confirmed) => {
          document.removeEventListener('keydown', keydownHandler, true);
          modalOverlay.remove();
          if (confirmed) {
            if (typeof onConfirm === 'function') onConfirm(currentOrderData);
            resolve({ confirmed: true, orderData: currentOrderData, carrierData: currentOrderData });
          } else {
            if (typeof onCancel === 'function') onCancel();
            resolve({ confirmed: false, orderData: currentOrderData, carrierData: currentOrderData });
          }
        };

        if (closeBtn) closeBtn.onclick = () => doClose(false);
        if (cancelBtn) cancelBtn.onclick = () => doClose(false);

        if (confirmBtn) {
          confirmBtn.onclick = () => {
            if (!audit.canProceed) {
              if (typeof showVnpostToast === 'function') {
                showVnpostToast('⚠️ Vui lòng kiểm tra hoặc xác nhận tiền COD trước khi lên đơn!', 'warning');
              }
              return;
            }
            doClose(true);
          };
        }

        if (editBtn) {
          editBtn.onclick = () => {
            isEditingCod = true;
            renderModalContent();
            const inp = modalOverlay.querySelector('#modal-inline-cod-input');
            if (inp) {
              inp.focus();
              inp.select();
            }
          };
        }

        if (inlineCancelBtn) {
          inlineCancelBtn.onclick = () => {
            isEditingCod = false;
            renderModalContent();
          };
        }

        if (inlineSaveBtn && inlineInput) {
          const saveInline = () => {
            const val = parseInt(inlineInput.value.replace(/\D/g, ''), 10) || 0;
            currentOrderData.codAmount = val;
            if (val === 0) userConfirmedZero = true;
            else userConfirmedZero = false;
            isEditingCod = false;
            if (typeof onUpdateCOD === 'function') onUpdateCOD(val);
            renderModalContent();
          };
          inlineSaveBtn.onclick = saveInline;
          inlineInput.onkeydown = (ev) => {
            if (ev.key === 'Enter') {
              ev.preventDefault();
              saveInline();
            } else if (ev.key === 'Escape') {
              ev.preventDefault();
              isEditingCod = false;
              renderModalContent();
            }
          };
        }

        if (applyPanelBtn && audit.suggestedCod !== null) {
          applyPanelBtn.onclick = () => {
            currentOrderData.codAmount = audit.suggestedCod;
            userConfirmedZero = audit.suggestedCod === 0;
            if (typeof onUpdateCOD === 'function') onUpdateCOD(audit.suggestedCod);
            renderModalContent();
            if (typeof showVnpostToast === 'function') {
              showVnpostToast(`✓ Đã đồng bộ COD ${audit.suggestedCod.toLocaleString('vi-VN')} đ từ Panel sang Form!`, 'success');
            }
          };
        }

        if (confirmZeroBtn) {
          confirmZeroBtn.onclick = () => {
            currentOrderData.codAmount = 0;
            currentOrderData.codExplicitZero = true;
            userConfirmedZero = true;
            if (typeof onUpdateCOD === 'function') onUpdateCOD(0);
            renderModalContent();
            if (typeof showVnpostToast === 'function') {
              showVnpostToast('✓ Đã xác nhận đơn 0đ (Khách chuyển khoản/Quà tặng)!', 'info');
            }
          };
        }
      }

      function keydownHandler(e) {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          document.removeEventListener('keydown', keydownHandler, true);
          modalOverlay.remove();
          if (typeof onCancel === 'function') onCancel();
          resolve({ confirmed: false, orderData: currentOrderData });
        } else if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
          const activeEl = root.activeElement || document.activeElement;
          if (activeEl && activeEl.id === 'modal-inline-cod-input') return;

          if (audit.canProceed) {
            e.preventDefault();
            e.stopPropagation();
            document.removeEventListener('keydown', keydownHandler, true);
            modalOverlay.remove();
            if (typeof onConfirm === 'function') onConfirm(currentOrderData);
            resolve({ confirmed: true, orderData: currentOrderData });
          } else {
            if (typeof showVnpostToast === 'function') {
              showVnpostToast('⚠️ Vui lòng kiểm tra tiền COD hoặc xác nhận đơn 0đ trước khi lên đơn!', 'warning');
            }
          }
        }
      }

      document.addEventListener('keydown', keydownHandler, true);

      modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
          document.removeEventListener('keydown', keydownHandler, true);
          modalOverlay.remove();
          if (typeof onCancel === 'function') onCancel();
          resolve({ confirmed: false, orderData: currentOrderData });
        }
      });

      renderModalContent();
      if (root && typeof root.appendChild === 'function' && root !== document) {
        root.appendChild(modalOverlay);
      } else if (typeof document !== 'undefined' && document.body) {
        document.body.appendChild(modalOverlay);
      }
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
      const isVnpost = (typeof getCurrentPlatform === 'function' ? (getCurrentPlatform()?.id || getCurrentPlatform()) : 'vnpost') === 'vnpost';
      if (codeEl) {
        let codeVal = data.orderCode ? data.orderCode.trim() : (isVnpost ? "LuaThuySinh" : "Lũa Thuỷ Sinh");
        if (isVnpost && codeVal) {
          codeVal = formatVNPostOrderCode(codeVal);
        }
        codeEl.textContent = codeVal;
      }

      let displayAddress = data.address ? data.address.trim() : "không tìm thấy";
      if (typeof AddressSanitizer !== 'undefined' && typeof AddressSanitizer.deduplicate === 'function' && displayAddress !== 'không tìm thấy') {
        displayAddress = AddressSanitizer.deduplicate(displayAddress);
      }
      const addrEl = getVnpostEl('rev-address');
      if (addrEl) addrEl.textContent = displayAddress;

      const rawAddrEl = getVnpostEl('rev-raw-address');
      if (rawAddrEl) rawAddrEl.textContent = displayAddress || "---";

      const refDisclosure = getVnpostEl('address-reference-disclosure') || (typeof root !== 'undefined' && root?.querySelector?.('.address-reference-disclosure'));
      if (refDisclosure) {
        const is2Level = data.addressLevel === 2;
        refDisclosure.style.display = is2Level ? 'none' : '';
        if (!is2Level) {
          refDisclosure.open = true;
          const refTitle = refDisclosure.querySelector('.address-reference-title');
          if (refTitle) refTitle.textContent = '🎯 Gợi ý địa chỉ 2 cấp mới';
          const refStatus = refDisclosure.querySelector('.address-reference-status');
          if (refStatus) {
            refStatus.textContent = 'Bấm để áp dụng';
            refStatus.className = 'address-reference-status is-ready';
          }
        }
      }

      if (data.twoLevelAddress) {
        const suggest2LevelEl = getVnpostEl('rev-suggest-2level');
        if (suggest2LevelEl) suggest2LevelEl.textContent = data.twoLevelAddress;
      }
      if (data.cleanAddress) {
        const suggestCleanEl = getVnpostEl('rev-suggest-clean');
        if (suggestCleanEl) suggestCleanEl.textContent = data.cleanAddress;
      }

      if (data.addressLevel) {
        const addrStatusBadge = getVnpostEl('address-status-badge');
        if (addrStatusBadge) {
          addrStatusBadge.textContent = data.addressLevel === 2 ? '🎯 Địa chỉ 2 Cấp' : '✓ Đã tối ưu';
          addrStatusBadge.title = data.addressLevel === 2 
            ? 'Địa chỉ được nhận diện theo chuẩn 2 cấp (không chèn quận).' 
            : 'Địa chỉ chuẩn hóa 3 cấp đầy đủ.';
        }
        const btnClean = getVnpostEl('btn-switch-clean');
        const btn2Level = getVnpostEl('btn-switch-2level');
        if (btnClean && btn2Level) {
          btnClean.classList.toggle('active', data.addressLevel !== 2);
          btn2Level.classList.toggle('active', data.addressLevel === 2);
        }
      }

      const codEl = getVnpostEl('rev-cod');
      const codStatusEl = getVnpostEl('rev-cod-status');
      
      const rawTextForAudit = (data && data.rawText) || (getVnpostEl('order-raw-input') ? getVnpostEl('order-raw-input').value : '');
      let codAudit = null;
      if (typeof OrderValidator !== 'undefined' && typeof OrderValidator.auditCOD === 'function') {
        codAudit = OrderValidator.auditCOD(data, rawTextForAudit);
      }

      if (codEl) {
        codEl.textContent = data.codAmount ? Number(data.codAmount).toLocaleString('vi-VN') + " đ" : "0 đ";
        if (codAudit) {
          if (codAudit.status === 'CRITICAL_MISSING_COD') codEl.style.color = '#ef4444';
          else if (codAudit.status === 'NO_COD_WARNING' || codAudit.status === 'MISMATCH') codEl.style.color = '#f59e0b';
          else if (codAudit.status === 'EXPLICIT_ZERO') codEl.style.color = '#0284c7';
          else codEl.style.color = '#10b981';
        }
      }

      if (codStatusEl) {
        if (codAudit) {
          codStatusEl.textContent = codAudit.badge;
          codStatusEl.title = codAudit.message;
          codStatusEl.className = 'cod-status-badge ' + (
            codAudit.level === 'danger' ? 'cod-badge-danger' :
            codAudit.level === 'warning' ? 'cod-badge-warning' :
            codAudit.level === 'info' ? 'cod-badge-info' : 'cod-badge-success'
          );
        } else {
          codStatusEl.textContent = (data.codAmount && data.codAmount > 0) ? '✓ COD hợp lệ' : '⚠️ Chưa có COD';
        }
      }

      const feeEl = getVnpostEl('rev-fee');
      if (feeEl) {
        const feeOn = !!data.collectFee;
        feeEl.textContent = feeOn ? 'CÓ' : 'KHÔNG';
        feeEl.classList.toggle('fee-status--yes', feeOn);
        feeEl.classList.toggle('fee-status--no', !feeOn);
      }

      const reviewPanel = getVnpostEl('review-panel');
      if (reviewPanel) reviewPanel.style.display = 'flex';

      if (data && data.confidence) {
        const conf = data.confidence;
        const state = conf.level === 'verifying' ? 'verifying' 
          : conf.level === 'optimized' ? 'verified'
          : conf.level === 'high' ? 'verified'
          : conf.level === 'offline' ? 'offline'
          : 'review_needed';
        updateAiConfidenceBadge(state, {
          score: conf.score,
          optimized: conf.level === 'optimized',
          corrections: conf.reasons
        });
      }

      updateOrderReadinessBadge(data);
      if (typeof globalThis.lookupPanelCustomerHistory === 'function') {
        globalThis.lookupPanelCustomerHistory(data.phone || data.name || '');
      }

      const qPhone = String(data.phone || '').replace(/\D/g, '');
      const qName = String(data.name || '').trim().toLowerCase();
      if (typeof OrderStorage !== 'undefined' && typeof OrderStorage.getSubmittedOrders === 'function' && (qPhone.length >= 9 || qName.length >= 2)) {
        OrderStorage.getSubmittedOrders().then(orders => {
          const matched = (orders || []).filter(o => {
            const p = String(o.phone || '').replace(/\D/g, '');
            const n = String(o.name || o.customer_name || '').trim().toLowerCase();
            return qPhone.length >= 9 ? (p === qPhone) : (qName.length >= 2 && n === qName);
          });
          if (typeof setCustomerOrderCountBadge === 'function') {
            setCustomerOrderCountBadge(matched.length);
          }
        }).catch(() => {});
      } else if (typeof setCustomerOrderCountBadge === 'function') {
        setCustomerOrderCountBadge(0);
      }

      // Kiểm tra đơn đã từng lên (trùng mã đơn hoặc trùng SĐT / người nhận)
      checkAndDisplayDuplicateAlert(data);
    });
  }

  async function checkAndDisplayDuplicateAlert(data) {
    const alertEl = getVnpostEl('panel-duplicate-alert');
    if (!alertEl) return null;

    // Reset trạng thái: Luôn ẩn cảnh báo cũ ngay lập tức trước khi phân tích đơn mới
    alertEl.style.display = 'none';

    if (!data || (!data.orderCode && !data.phone)) {
      return null;
    }

    try {
      if (typeof OrderStorage === 'undefined') {
        return null;
      }

      // Ưu tiên đọc nhanh từ local storage để không bị nghẽn mạng Cloud
      let submittedOrders = [];
      if (typeof OrderStorage._getSubmittedOrdersFromLocal === 'function') {
        submittedOrders = await OrderStorage._getSubmittedOrdersFromLocal().catch(() => []);
      }
      if (!Array.isArray(submittedOrders) || submittedOrders.length === 0) {
        if (typeof OrderStorage.getSubmittedOrders === 'function') {
          submittedOrders = await Promise.race([
            OrderStorage.getSubmittedOrders().catch(() => []),
            new Promise(r => setTimeout(() => r([]), 1500))
          ]);
        }
      }
      if (!Array.isArray(submittedOrders) || submittedOrders.length === 0) {
        return null;
      }

      const todayStr = new Date().toISOString().slice(0, 10);
      const todayLocale = new Date().toLocaleDateString('vi-VN');

      const checkCode = String(data.orderCode || '').trim().toLowerCase();
      const cleanCheckCode = checkCode.replace(/[\s\.\-_]/g, '');
      const checkPhone = String(data.phone || '').replace(/\D/g, '');
      const checkName = String(data.name || '').trim().toLowerCase();

      let duplicateFound = null;

      for (const sub of submittedOrders) {
        // Bỏ qua đơn nếu chính là đơn vừa tạo thành công
        const subTrack = String(sub.trackingCode || sub.tracking_code || '').trim();
        if (subTrack && (subTrack === globalThis.__AF_JUST_SUBMITTED_TRACKING__ || subTrack === data?.trackingCode)) {
          continue;
        }
        if (sub.id && (sub.id === globalThis.__AF_JUST_SUBMITTED_ID__ || sub.id === data?.id || sub.id === data?.savedOrderId)) {
          continue;
        }

        const rawDate = sub.submittedAt || sub.createdAt || sub.updatedAt || '';
        let isToday = false;
        let submittedDateStr = 'Hôm nay';
        let submittedTimeStr = '';
        if (rawDate) {
          try {
            const d = new Date(rawDate);
            if (!isNaN(d.getTime())) {
              const dStr = d.toISOString().slice(0, 10);
              const dLocale = d.toLocaleDateString('vi-VN');
              if (dStr === todayStr || dLocale === todayLocale) isToday = true;
              submittedDateStr = isToday ? 'hôm nay' : `ngày ${d.toLocaleDateString('vi-VN')}`;
              submittedTimeStr = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
            }
          } catch (_) {}
        } else {
          isToday = true;
          submittedDateStr = 'hôm nay';
          submittedTimeStr = '';
        }

        const subCode = String(sub.orderCode || sub.order_code || '').trim().toLowerCase();
        const cleanSubCode = subCode.replace(/[\s\.\-_]/g, '');
        const subPhone = String(sub.phone || '').replace(/\D/g, '');
        const subName = String(sub.name || sub.customer_name || '').trim().toLowerCase();

        // Nếu cả đơn hiện tại và đơn trong lịch sử đều có mã đơn:
        // Khách mua 2 cây khác nhau trong ngày -> 2 mã đơn khác nhau -> KHÔNG cảnh báo trùng!
        // Lưu ý: So sánh cả dạng đã bỏ dấu chấm/gạch để e80.288 và e80288 được tính là cùng mã đơn
        const hasBothCodes = Boolean(checkCode && checkCode !== '—' && checkCode !== '-' && subCode && subCode !== '—' && subCode !== '-');
        if (hasBothCodes && checkCode !== subCode && cleanCheckCode !== cleanSubCode) {
          continue;
        }

        const matchCode = Boolean(
          (checkCode && checkCode !== '—' && checkCode !== '-' && subCode && checkCode === subCode) ||
          (cleanCheckCode && cleanCheckCode !== '—' && cleanCheckCode !== '-' && cleanSubCode && cleanCheckCode === cleanSubCode)
        );
        const matchPhone = Boolean(checkPhone && checkPhone.length >= 9 && subPhone && checkPhone === subPhone);
        const matchCustomer = Boolean(checkPhone && checkName && checkPhone === subPhone && checkName === subName);

        if (matchCode || ((matchPhone || matchCustomer) && isToday)) {
          duplicateFound = {
            order: sub,
            matchCode,
            matchPhone,
            isToday,
            trackingCode: sub.trackingCode || sub.tracking_code || '',
            carrierAccount: sub.carrierAccount || sub.carrier_account || '',
            orderCode: sub.orderCode || sub.order_code || '',
            customerName: sub.name || sub.customer_name || '',
            phone: sub.phone || '',
            submittedDate: submittedDateStr,
            submittedTime: submittedTimeStr ? `${submittedTimeStr}` : (isToday ? 'Hôm nay' : submittedDateStr)
          };
          break;
        }
      }

      if (duplicateFound) {
        const timeEl = getVnpostEl('panel-duplicate-time');
        const msgEl = getVnpostEl('panel-duplicate-message');
        const detEl = getVnpostEl('panel-duplicate-details');
        const titleEl = getVnpostEl('panel-duplicate-title');

        if (titleEl) {
          titleEl.innerHTML = `
            <svg class="duplicate-alert-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <span>${duplicateFound.isToday ? 'ĐƠN ĐÃ LÊN TRONG NGÀY' : 'ĐƠN ĐÃ TỪNG ĐƯỢC LÊN'}</span>
          `;
        }

        if (timeEl) {
          timeEl.textContent = duplicateFound.isToday 
            ? `Lên đơn lúc ${duplicateFound.submittedTime}` 
            : `Đã lên ${duplicateFound.submittedDate}${duplicateFound.submittedTime ? ` lúc ${duplicateFound.submittedTime}` : ''}`;
        }
        
        const safeOrderCode = escapeHTML(duplicateFound.orderCode);
        const safePhone = escapeHTML(duplicateFound.phone);
        const safeCustomerName = escapeHTML(duplicateFound.customerName || 'Khách hàng');
        const safeTrackingCode = escapeHTML(duplicateFound.trackingCode);
        const safeCarrierAccount = escapeHTML(duplicateFound.carrierAccount);
        let reasonTxt = '';
        if (duplicateFound.matchCode && duplicateFound.matchPhone) {
          reasonTxt = `Trùng mã đơn hàng <strong>${safeOrderCode}</strong> và SĐT <strong>${safePhone}</strong>`;
        } else if (duplicateFound.matchCode) {
          reasonTxt = `Trùng mã đơn hàng <strong>${safeOrderCode}</strong>`;
        } else {
          reasonTxt = `Trùng người nhận/SĐT <strong>${safePhone}</strong> (${safeCustomerName})`;
        }

        if (msgEl) {
          msgEl.innerHTML = `⚠️ Đơn này đã được lên đơn thành công ${duplicateFound.submittedDate}! (${reasonTxt})`;
        }

        if (detEl) {
          detEl.innerHTML = `
            ${duplicateFound.orderCode ? `<span class="duplicate-detail-tag">Mã đơn: <strong>${safeOrderCode}</strong></span>` : ''}
            ${duplicateFound.customerName ? `<span class="duplicate-detail-tag">Khách: <strong>${safeCustomerName}</strong></span>` : ''}
            ${duplicateFound.trackingCode ? `<span class="duplicate-detail-tag">Mã VĐ: <code class="duplicate-detail-code">${safeTrackingCode}</code></span>` : ''}
            ${duplicateFound.carrierAccount ? `<span class="duplicate-detail-tag">Người gửi: <strong>${safeCarrierAccount}</strong></span>` : ''}
          `;
        }

        alertEl.style.display = 'flex';
        showVnpostToast(`⚠️ CẢNH BÁO: Đơn (${duplicateFound.orderCode || duplicateFound.phone}) đã được lên ${duplicateFound.isToday ? 'hôm nay lúc ' + duplicateFound.submittedTime : duplicateFound.submittedDate + (duplicateFound.submittedTime ? ' lúc ' + duplicateFound.submittedTime : '')}${duplicateFound.trackingCode ? ` (Mã VĐ: ${duplicateFound.trackingCode})` : ''}!`, 'warning', 6000);
        return duplicateFound;
      } else {
        alertEl.style.display = 'none';
        return null;
      }
    } catch (e) {
      console.warn('[checkAndDisplayDuplicateAlert] Error:', e);
      alertEl.style.display = 'none';
      return null;
    }
  }

  globalThis.getVnpostPanelRoot = getVnpostPanelRoot;
  globalThis.getVnpostEl = getVnpostEl;
  globalThis.createInputPanel = createInputPanel;
  globalThis.showPanelSkeleton = showPanelSkeleton;
  globalThis.displayParsedData = displayParsedData;
  globalThis.checkAndDisplayDuplicateAlert = checkAndDisplayDuplicateAlert;

  function createLoginRequiredPanel(platform, onLoginClickHandler) {
    try {
      if (typeof document === 'undefined') return;
      setPageDockOffset(false);
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
      const oldDockTab = root.querySelector('#vnpost-dock-toggle-tab');
      if (oldDockTab) oldDockTab.remove();

      if (!root.querySelector('#vnpost-shadow-style')) {
        const styleEl = document.createElement('style');
        styleEl.id = 'vnpost-shadow-style';
        styleEl.textContent = typeof PANEL_CSS !== 'undefined' ? PANEL_CSS : '';
        root.appendChild(styleEl);
      }

      const panel = document.createElement('div');
      panel.id = 'vnpost-autofill-panel';
      panel.dataset.panelType = 'login';
      panel.classList.add('panel-floating');
      applyInitialTheme(panel);
      
      let __hasExtCtx = false; try { __hasExtCtx = typeof chrome !== 'undefined' && chrome.runtime && !!chrome.runtime.id; } catch(e) {}; if (__hasExtCtx && chrome.storage && chrome.storage.local) {
        try {
          chrome.storage.local.get(['antigravity_ui_theme'], (res) => {
            if (chrome.runtime.lastError) return;
            if (res && res.antigravity_ui_theme === 'dark') {
              panel.classList.remove('light-mode');
              try { localStorage.setItem('antigravity_ui_theme', 'dark'); } catch (_) {}
            } else if (res && res.antigravity_ui_theme === 'light') {
              panel.classList.add('light-mode');
              try { localStorage.setItem('antigravity_ui_theme', 'light'); } catch (_) {}
            }
          });
        } catch (_) {}
      }
      const themeColor = platformObj.themeColor || (platformObj.id === "vnpost" ? "#0056b3" : "#4f46e5");
      panel.style.setProperty('--theme-color', themeColor);

      let _loginVersion = 'v1';
      try {
        let __hasExtCtx2 = false; try { __hasExtCtx2 = typeof chrome !== 'undefined' && chrome.runtime && !!chrome.runtime.getManifest; } catch(e) {}; if (__hasExtCtx2) {
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
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--theme-color, #16a34a);"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              Đăng Nhập Máy Trạm
            </div>
            
            <!-- TABS CHỌN ĐĂNG NHẬP -->
            <div class="panel-login-tabs">
              <button type="button" id="panel-tab-btn-pin" class="panel-login-tab active">🔑 Nhân Viên (PIN)</button>
              <button type="button" id="panel-tab-btn-owner" class="panel-login-tab">👑 Chủ Shop / Admin</button>
            </div>

            <div id="panel-login-subtitle" class="panel-login-subtitle">
              Xác thực nhanh bằng mã PIN 6 số cho nhân viên
            </div>

            <div id="panel-login-error" class="panel-login-error"></div>

            <!-- CONTAINER 1: NHÂN VIÊN PIN -->
            <div id="panel-pin-container">
              <!-- View 1.1: Máy Tin Cậy (Chỉ gõ 6 số PIN) -->
              <form id="panel-trusted-pin-form" style="display: none; flex-direction: column; gap: 10px;">
                <div style="background: rgba(0,0,0,0.04); border: 1px solid var(--input-border, #cbd5e1); border-radius: 8px; padding: 8px 10px; display: flex; align-items: center; justify-content: space-between;">
                  <div>
                    <div id="panel-trusted-staff-name" style="font-weight: 700; font-size: 12px; color: var(--text-primary, #0f172a);">Nhân viên</div>
                    <div id="panel-trusted-shop-name" style="font-size: 10.5px; color: var(--text-muted, #64748b);">Shop: LTS</div>
                  </div>
                  <button type="button" id="panel-btn-switch-account" style="background: none; border: none; color: #16a34a; font-size: 11px; font-weight: 700; cursor: pointer;">Đổi</button>
                </div>

                <div class="panel-login-group">
                  <label class="panel-login-label" style="text-align: center;">Nhập mã PIN 6 số vào ca</label>
                  <input type="password" id="panel-input-trusted-pin" class="panel-login-input" maxlength="6" inputmode="numeric" pattern="[0-9]*" placeholder="• • • • • •" required autocomplete="off" style="font-size: 18px; text-align: center; letter-spacing: 8px; font-weight: 800;" />
                </div>

                <button type="submit" id="panel-btn-submit-trusted-pin" class="panel-login-btn">
                  Đăng Nhập Vào Ca
                </button>
              </form>

              <!-- View 1.2: Máy Mới (Nhập Shop Code + Username + PIN tùy chọn) -->
              <form id="panel-new-pin-form" style="display: flex; flex-direction: column; gap: 8px;">
                <div class="panel-login-group">
                  <label class="panel-login-label" for="panel-input-shopcode">Mã Cửa Hàng (Shop Code / Key)</label>
                  <input type="text" id="panel-input-shopcode" class="panel-login-input" placeholder="VD: SHOPLA, KEY-SHOP-..." required autocomplete="off" style="font-weight: 700; text-transform: uppercase;" />
                </div>

                <div class="panel-login-group">
                  <label class="panel-login-label" for="panel-input-loginname">Tên của bạn / Tên nhân viên</label>
                  <input type="text" id="panel-input-loginname" class="panel-login-input" placeholder="VD: Tài, Kho 1, Hằng Sales..." required autocomplete="username" />
                </div>

                <div class="panel-login-group">
                  <label class="panel-login-label" for="panel-input-pin">Mã PIN 6 Số (Tùy chọn)</label>
                  <input type="password" id="panel-input-pin" class="panel-login-input" maxlength="6" inputmode="numeric" pattern="[0-9]*" placeholder="6 chữ số PIN (nếu có)" autocomplete="off" style="letter-spacing: 4px; font-weight: 700;" />
                </div>

                <div class="panel-login-group">
                  <label class="panel-login-label" for="panel-input-devicename">Tên Máy Trạm Này</label>
                  <input type="text" id="panel-input-devicename" class="panel-login-input" placeholder="VD: Chrome Profile 1, Máy bàn..." />
                </div>

                <button type="submit" id="panel-btn-submit-new-pin" class="panel-login-btn" style="margin-top: 4px;">
                  🚀 Vào Ca Lên Đơn (1-Click)
                </button>
              </form>

              <!-- View 1.3: Chờ Chủ Shop Duyệt Máy -->
              <div id="panel-pending-approval-box" style="display: none; text-align: center; padding: 12px 6px;">
                <div style="font-size: 24px; margin-bottom: 6px;">⏳</div>
                <div style="font-weight: 700; font-size: 13px; color: #b45309; margin-bottom: 4px;">Thiết Bị Đang Chờ Phê Duyệt</div>
                <div style="font-size: 11px; color: var(--text-muted, #64748b); line-height: 1.4; margin-bottom: 12px;">
                  Vui lòng liên hệ Chủ Shop duyệt máy trong mục <strong>Quản Lý Thiết Bị</strong>.
                </div>
                <button type="button" id="panel-btn-check-pending" class="panel-login-btn" style="background: #16a34a; margin-bottom: 6px;">
                  🔄 Kiểm tra lại trạng thái duyệt
                </button>
                <button type="button" id="panel-btn-pending-switch" style="background: none; border: 1px solid var(--input-border, #cbd5e1); color: var(--text-muted, #64748b); border-radius: 6px; padding: 6px; width: 100%; font-size: 11px; font-weight: 600; cursor: pointer;">
                  Đăng nhập Shop khác
                </button>
              </div>
            </div>

            <!-- CONTAINER 2: CHỦ SHOP / ADMIN -->
            <form id="panel-owner-form" style="display: none; flex-direction: column; gap: 10px;">
              <div class="panel-login-group">
                <label class="panel-login-label" for="panel-input-owner-email">Email hoặc Tên đăng nhập</label>
                <input type="text" id="panel-input-owner-email" class="panel-login-input" placeholder="admin@shop.com" autocomplete="username" />
              </div>

              <div class="panel-login-group">
                <label class="panel-login-label" for="panel-input-owner-password">Mật khẩu</label>
                <input type="password" id="panel-input-owner-password" class="panel-login-input" placeholder="••••••••" autocomplete="current-password" />
              </div>

              <button type="submit" id="panel-btn-submit-owner" class="panel-login-btn" style="margin-top: 4px;">
                🔑 Đăng Nhập Quản Trị
              </button>
            </form>

            <div class="panel-login-footer" style="display:flex;flex-direction:column;gap:4px;margin-top:6px;">
              <a id="panel-link-register" class="panel-login-link">⚙️ Mở Options (Cài đặt / Quản lý)</a>
              <a id="panel-link-admin-login" class="panel-login-link" style="font-size:11px;">🌐 Mở Trang Quản Trị</a>
            </div>
          </div>
        </div>
      `;

      root.appendChild(panel);
      const _loginHeaderEl = root.getElementById('vnpost-panel-header-text');
      if (_loginHeaderEl) _loginHeaderEl.textContent = platformObj.title || '';
      makeElementDraggable(panel, root.getElementById("vnpost-panel-header"));

      // Gắn sự kiện theme toggle
      const btnTheme = root.getElementById('vnpost-btn-theme');
      if (btnTheme) {
        btnTheme.addEventListener('click', (e) => {
          e.stopPropagation();
          const isNowLight = panel.classList.toggle('light-mode');
          persistThemePreference(isNowLight);
          showVnpostToast(isNowLight ? '☀️ Đã chuyển sang giao diện Sáng' : '🌙 Đã chuyển sang giao diện Tối', 'success');
        });
      }

      root.getElementById('vnpost-btn-minimize').addEventListener('click', () => {
        panel.classList.toggle('minimized');
      });

      // Elements
      const tabBtnPin = root.getElementById('panel-tab-btn-pin');
      const tabBtnOwner = root.getElementById('panel-tab-btn-owner');
      const pinContainer = root.getElementById('panel-pin-container');
      const ownerForm = root.getElementById('panel-owner-form');
      const subtitleEl = root.getElementById('panel-login-subtitle');
      const errorBox = root.getElementById('panel-login-error');

      const trustedPinForm = root.getElementById('panel-trusted-pin-form');
      const newPinForm = root.getElementById('panel-new-pin-form');
      const pendingApprovalBox = root.getElementById('panel-pending-approval-box');

      const trustedStaffEl = root.getElementById('panel-trusted-staff-name');
      const trustedShopEl = root.getElementById('panel-trusted-shop-name');
      const trustedPinInput = root.getElementById('panel-input-trusted-pin');
      const switchAccountBtn = root.getElementById('panel-btn-switch-account');

      const shopCodeInput = root.getElementById('panel-input-shopcode');
      const loginNameInput = root.getElementById('panel-input-loginname');
      const pinInput = root.getElementById('panel-input-pin');
      const deviceNameInput = root.getElementById('panel-input-devicename');

      const checkPendingBtn = root.getElementById('panel-btn-check-pending');
      const pendingSwitchBtn = root.getElementById('panel-btn-pending-switch');

      const ownerEmailInput = root.getElementById('panel-input-owner-email');
      const ownerPassInput = root.getElementById('panel-input-owner-password');
      const registerLink = root.getElementById('panel-link-register');
      const adminLoginLink = root.getElementById('panel-link-admin-login');

      let savedShopCode = '';
      let savedLoginName = '';

      // Tự động kiểm tra trạng thái thiết bị tin cậy từ storage
      const checkTrustedState = () => {
        let isExtValid = false;
        try {
          isExtValid = typeof chrome !== 'undefined' && !!chrome.runtime && !!chrome.runtime.id && !!chrome.storage && !!chrome.storage.local;
        } catch (_) {}

        if (isExtValid) {
          try {
            chrome.storage.local.get([
              'last_shop_code', 'last_login_name', 'staff_name', 'shop_name', 'fbDeviceName', 'device_pending_approval'
            ], (res) => {
              try {
                if (chrome.runtime && chrome.runtime.lastError) return;
                savedShopCode = res?.last_shop_code || '';
                savedLoginName = res?.last_login_name || '';

                if (res?.device_pending_approval && savedShopCode) {
                  if (pendingApprovalBox) pendingApprovalBox.style.display = 'block';
                  if (trustedPinForm) trustedPinForm.style.display = 'none';
                  if (newPinForm) newPinForm.style.display = 'none';
                  return;
                }

                if (savedShopCode && savedLoginName) {
                  if (trustedStaffEl) trustedStaffEl.textContent = res.staff_name || savedLoginName;
                  if (trustedShopEl) trustedShopEl.textContent = 'Shop: ' + (res.shop_name || savedShopCode);
                  if (trustedPinForm) trustedPinForm.style.display = 'flex';
                  if (newPinForm) newPinForm.style.display = 'none';
                  if (pendingApprovalBox) pendingApprovalBox.style.display = 'none';
                  if (trustedPinInput) trustedPinInput.focus();
                } else {
                  if (trustedPinForm) trustedPinForm.style.display = 'none';
                  if (newPinForm) newPinForm.style.display = 'flex';
                  if (pendingApprovalBox) pendingApprovalBox.style.display = 'none';
                }
              } catch (_) {}
            });
            return;
          } catch (_) {}
        }

        // Fallback localStorage nếu extension context bị invalidated hoặc chạy không có storage
        try {
          savedShopCode = localStorage.getItem('last_shop_code') || '';
          savedLoginName = localStorage.getItem('last_login_name') || '';
          if (savedShopCode && savedLoginName) {
            if (trustedStaffEl) trustedStaffEl.textContent = localStorage.getItem('staff_name') || savedLoginName;
            if (trustedShopEl) trustedShopEl.textContent = 'Shop: ' + (localStorage.getItem('shop_name') || savedShopCode);
            if (trustedPinForm) trustedPinForm.style.display = 'flex';
            if (newPinForm) newPinForm.style.display = 'none';
            if (pendingApprovalBox) pendingApprovalBox.style.display = 'none';
            if (trustedPinInput) trustedPinInput.focus();
          } else {
            if (trustedPinForm) trustedPinForm.style.display = 'none';
            if (newPinForm) newPinForm.style.display = 'flex';
            if (pendingApprovalBox) pendingApprovalBox.style.display = 'none';
          }
        } catch (_) {}
      };

      checkTrustedState();

      // Tab switching
      if (tabBtnPin && tabBtnOwner) {
        tabBtnPin.addEventListener('click', () => {
          tabBtnPin.classList.add('active');
          tabBtnOwner.classList.remove('active');
          if (pinContainer) pinContainer.style.display = 'block';
          if (ownerForm) ownerForm.style.display = 'none';
          if (subtitleEl) subtitleEl.textContent = 'Xác thực nhanh bằng mã PIN 6 số cho nhân viên.';
          if (errorBox) errorBox.style.display = 'none';
          checkTrustedState();
        });

        tabBtnOwner.addEventListener('click', () => {
          tabBtnOwner.classList.add('active');
          tabBtnPin.classList.remove('active');
          if (pinContainer) pinContainer.style.display = 'none';
          if (ownerForm) ownerForm.style.display = 'flex';
          if (subtitleEl) subtitleEl.textContent = 'Đăng nhập tài khoản Chủ shop / Quản lý với Email và Mật khẩu.';
          if (errorBox) errorBox.style.display = 'none';
        });
      }

      // Chuyển đổi tài khoản khác
      const handleSwitchAccount = (e) => {
        if (e) e.preventDefault();
        if (trustedPinForm) trustedPinForm.style.display = 'none';
        if (pendingApprovalBox) pendingApprovalBox.style.display = 'none';
        if (newPinForm) newPinForm.style.display = 'flex';
        if (errorBox) errorBox.style.display = 'none';
        if (shopCodeInput) shopCodeInput.focus();
      };

      if (switchAccountBtn) switchAccountBtn.addEventListener('click', handleSwitchAccount);
      if (pendingSwitchBtn) pendingSwitchBtn.addEventListener('click', handleSwitchAccount);

      // Submit PIN trên máy tin cậy
      if (trustedPinForm) {
        trustedPinForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const pinVal = (trustedPinInput?.value || '').trim();
          if (!pinVal || pinVal.length !== 6) {
            if (errorBox) {
              errorBox.textContent = '⚠️ Vui lòng nhập đúng mã PIN gồm 6 chữ số!';
              errorBox.style.display = 'block';
            }
            return;
          }

          if (errorBox) errorBox.style.display = 'none';
          const submitBtn = root.getElementById('panel-btn-submit-trusted-pin');
          if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '⏳ Đang vào ca...'; }

          try {
            if (typeof AuthService !== 'undefined' && typeof AuthService.loginWithPin === 'function') {
              await AuthService.loginWithPin({
                shopCode: savedShopCode,
                loginName: savedLoginName,
                pin: pinVal
              });
              showVnpostToast('🎉 Đăng nhập ca làm việc thành công!', 'success');
              setTimeout(() => {
                const recheckFn = (typeof globalThis !== 'undefined' && globalThis.checkUrlAndInject) || (typeof window !== 'undefined' && window.checkUrlAndInject);
                if (typeof recheckFn === 'function') recheckFn();
              }, 80);
            } else {
              throw new Error('Hệ thống xác thực PIN chưa sẵn sàng.');
            }
          } catch (err) {
            if (errorBox) {
              errorBox.textContent = `❌ ${err.message || 'Mã PIN không chính xác!'}`;
              errorBox.style.display = 'block';
            }
          } finally {
            if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = 'Đăng Nhập Vào Ca'; }
          }
        });

        // Tự động submit khi gõ đủ 6 số
        if (trustedPinInput) {
          trustedPinInput.addEventListener('input', (e) => {
            trustedPinInput.value = trustedPinInput.value.replace(/[^0-9]/g, '');
            if (trustedPinInput.value.length === 6) {
              trustedPinForm.dispatchEvent(new Event('submit'));
            }
          });
        }
      }

      // Submit đăng nhập máy mới
      if (newPinForm) {
        newPinForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const sCode = (shopCodeInput?.value || '').trim().toUpperCase();
          const lName = (loginNameInput?.value || '').trim().toLowerCase();
          const pinVal = (pinInput?.value || '').trim();
          const dName = (deviceNameInput?.value || '').trim();

          if (!sCode || !lName) {
            if (errorBox) {
              errorBox.textContent = '⚠️ Vui lòng nhập đầy đủ Mã Shop và Tên của bạn!';
              errorBox.style.display = 'block';
            }
            return;
          }

          if (pinVal && pinVal.length !== 6) {
            if (errorBox) {
              errorBox.textContent = '⚠️ Mã PIN phải bao gồm đúng 6 chữ số!';
              errorBox.style.display = 'block';
            }
            return;
          }

          if (errorBox) errorBox.style.display = 'none';
          const submitBtn = root.getElementById('panel-btn-submit-new-pin');
          if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '⏳ Đang vào ca...'; }

          try {
            if (typeof AuthService !== 'undefined' && typeof AuthService.loginWithPin === 'function') {
              await AuthService.loginWithPin({
                shopCode: sCode,
                loginName: lName,
                pin: pinVal || null,
                deviceName: dName
              });
              showVnpostToast('🎉 Vào ca làm việc thành công!', 'success');
              setTimeout(() => {
                const recheckFn = (typeof globalThis !== 'undefined' && globalThis.checkUrlAndInject) || (typeof window !== 'undefined' && window.checkUrlAndInject);
                if (typeof recheckFn === 'function') recheckFn();
              }, 80);
            } else {
              throw new Error('Hệ thống xác thực chưa sẵn sàng.');
            }
          } catch (err) {
            if (err.code === 'DEVICE_PENDING_APPROVAL') {
              if (newPinForm) newPinForm.style.display = 'none';
              if (pendingApprovalBox) pendingApprovalBox.style.display = 'block';
              if (errorBox) errorBox.style.display = 'none';
            } else {
              if (errorBox) {
                errorBox.textContent = `❌ ${err.message || 'Đăng nhập thất bại!'}`;
                errorBox.style.display = 'block';
              }
            }
          } finally {
            if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '🚀 Vào Ca Lên Đơn (1-Click)'; }
          }
        });
      }

      // Kiểm tra lại trạng thái duyệt
      if (checkPendingBtn) {
        checkPendingBtn.addEventListener('click', async () => {
          checkPendingBtn.disabled = true;
          checkPendingBtn.innerHTML = '⏳ Đang kiểm tra...';
          try {
            if (typeof AuthService !== 'undefined' && typeof AuthService.loginWithPin === 'function') {
              await AuthService.loginWithPin({
                shopCode: savedShopCode || shopCodeInput?.value,
                loginName: savedLoginName || loginNameInput?.value,
                pin: '000000'
              });
            }
          } catch (err) {
            if (err.code === 'DEVICE_PENDING_APPROVAL') {
              if (errorBox) {
                errorBox.textContent = 'Máy trạm vẫn đang chờ Chủ Shop duyệt trong mục Quản Lý Thiết Bị.';
                errorBox.style.display = 'block';
              }
            } else if (err.message && err.message.includes('PIN')) {
              showVnpostToast('✅ Thiết bị đã được duyệt! Vui lòng nhập mã PIN 6 số.', 'success');
              if (pendingApprovalBox) pendingApprovalBox.style.display = 'none';
              checkTrustedState();
            } else {
              if (errorBox) {
                errorBox.textContent = `❌ ${err.message}`;
                errorBox.style.display = 'block';
              }
            }
          } finally {
            checkPendingBtn.disabled = false;
            checkPendingBtn.innerHTML = '🔄 Kiểm tra lại trạng thái duyệt';
          }
        });
      }

      // Submit đăng nhập Chủ Shop
      if (ownerForm) {
        ownerForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const identifier = (ownerEmailInput?.value || '').trim();
          const password = (ownerPassInput?.value || '').trim();

          if (!identifier || !password) {
            if (errorBox) {
              errorBox.textContent = '⚠️ Vui lòng nhập đầy đủ Email và Mật khẩu!';
              errorBox.style.display = 'block';
            }
            return;
          }

          if (errorBox) errorBox.style.display = 'none';
          const submitBtn = root.getElementById('panel-btn-submit-owner');
          if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '⏳ Đang xác thực...'; }

          try {
            if (typeof AuthService !== 'undefined' && typeof AuthService.login === 'function') {
              await AuthService.login(identifier, password);
              showVnpostToast('🎉 Đăng nhập Chủ Shop thành công!', 'success');
              setTimeout(() => {
                const recheckFn = (typeof globalThis !== 'undefined' && globalThis.checkUrlAndInject) || (typeof window !== 'undefined' && window.checkUrlAndInject);
                if (typeof recheckFn === 'function') recheckFn();
              }, 80);
            } else {
              throw new Error('Hệ thống xác thực chưa sẵn sàng.');
            }
          } catch (err) {
            if (errorBox) {
              errorBox.textContent = `❌ ${err.message || 'Đăng nhập thất bại!'}`;
              errorBox.style.display = 'block';
            }
          } finally {
            if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '🔑 Đăng Nhập Quản Trị'; }
          }
        });
      }

      if (registerLink && onLoginClickHandler) {
        registerLink.addEventListener('click', (e) => {
          e.preventDefault();
          onLoginClickHandler();
        });
      }

      if (adminLoginLink) {
        adminLoginLink.addEventListener('click', (e) => {
          e.preventDefault();
          let __hasExtCtx3 = false; try { __hasExtCtx3 = typeof chrome !== 'undefined' && chrome.runtime && !!chrome.runtime.sendMessage; } catch(e) {}; if (__hasExtCtx3) {
            chrome.runtime.sendMessage({ action: 'openAdmin' });
          } else {
            window.open('https://xlgovgynbsahuykyjzcx.supabase.co/', '_blank');
          }
        });
      }
    } catch (e) {
      if (String(e?.message || e).includes('Extension context invalidated')) {
        console.info('[Panel] Extension vừa được cập nhật lại, vui lòng F5 trang web.');
        try {
          let host = document.getElementById('vnpost-autofill-shadow-host');
          if (!host) {
            host = document.createElement('div');
            host.id = 'vnpost-autofill-shadow-host';
            document.body.appendChild(host);
          }
          const root = host.shadowRoot || host.attachShadow({ mode: 'open' });
          root.innerHTML = `
            <div style="position:fixed;bottom:20px;right:20px;z-index:2147483647;background:#0f172a;color:#fff;padding:12px 18px;border-radius:10px;box-shadow:0 10px 25px rgba(0,0,0,0.3);font-family:sans-serif;font-size:13px;display:flex;align-items:center;gap:12px;border:1px solid #334155;">
              <span>🔄 Extension Auto Fill Order vừa được tải lại. Vui lòng bấm để tải lại trang:</span>
              <button onclick="window.location.reload()" style="background:#2563eb;color:#fff;border:none;border-radius:6px;padding:6px 12px;font-weight:600;cursor:pointer;">Tải lại ngay (F5)</button>
            </div>
          `;
        } catch (_) {}
      } else {
        console.warn("Lỗi tạo panel đăng nhập:", e);
      }
    }
  }

  function createDeviceLimitExceededPanel(platform, limit, onSettingsClickHandler) {
    try {
      if (typeof document === 'undefined') return;
      setPageDockOffset(false);
      const platformObj = normalizePlatform(platform);
      let host = document.getElementById('vnpost-autofill-shadow-host');
      const existingPanel = host ? getVnpostEl('vnpost-autofill-panel') : null;
      if (existingPanel && existingPanel.dataset && existingPanel.dataset.panelType === 'device-limit') {
        return; // Already showing device limit exceeded panel
      }
      if (!host) {
        host = document.createElement('div');
        host.id = 'vnpost-autofill-shadow-host';
        document.body.appendChild(host);
      }

      const root = host.shadowRoot || host.attachShadow({ mode: 'open' });
      const oldPanel = root.querySelector('#vnpost-autofill-panel');
      if (oldPanel) oldPanel.remove();
      const oldDockTab = root.querySelector('#vnpost-dock-toggle-tab');
      if (oldDockTab) oldDockTab.remove();

      if (!root.querySelector('#vnpost-shadow-style')) {
        const styleEl = document.createElement('style');
        styleEl.id = 'vnpost-shadow-style';
        styleEl.textContent = typeof PANEL_CSS !== 'undefined' ? PANEL_CSS : '';
        root.appendChild(styleEl);
      }

      const panel = document.createElement('div');
      panel.id = 'vnpost-autofill-panel';
      panel.dataset.panelType = 'device-limit';
      panel.classList.add('panel-floating');
      applyInitialTheme(panel);
      
      let __hasExtCtx = false; try { __hasExtCtx = typeof chrome !== 'undefined' && chrome.runtime && !!chrome.runtime.id; } catch(e) {}; if (__hasExtCtx && chrome.storage && chrome.storage.local) {
        try {
          chrome.storage.local.get(['antigravity_ui_theme'], (res) => {
            if (chrome.runtime.lastError) return;
            if (res && res.antigravity_ui_theme === 'dark') {
              panel.classList.remove('light-mode');
              try { localStorage.setItem('antigravity_ui_theme', 'dark'); } catch (_) {}
            } else if (res && res.antigravity_ui_theme === 'light') {
              panel.classList.add('light-mode');
              try { localStorage.setItem('antigravity_ui_theme', 'light'); } catch (_) {}
            }
          });
        } catch (_) {}
      }
      const themeColor = platformObj.themeColor || (platformObj.id === "vnpost" ? "#0056b3" : "#4f46e5");
      panel.style.setProperty('--theme-color', themeColor);

      let _limitVersion = 'v1';
      try {
        let __hasExtCtx2 = false; try { __hasExtCtx2 = typeof chrome !== 'undefined' && chrome.runtime && !!chrome.runtime.getManifest; } catch(e) {}; if (__hasExtCtx2) {
          _limitVersion = 'v' + (chrome.runtime.getManifest().version || '1');
        }
      } catch (_) {}

      panel.innerHTML = `
        <div class="minimized-icon">${PANEL_ICONS.user}</div>
        <div id="vnpost-panel-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span id="vnpost-panel-header-text"></span>
            <span class="badge-version">${_limitVersion} (Hạn ngạch)</span>
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <button id="vnpost-btn-theme" title="Chuyển chế độ Sáng/Tối">${PANEL_ICONS.theme}</button>
            <button id="vnpost-btn-minimize">${PANEL_ICONS.minimize}</button>
          </div>
        </div>

        <div id="vnpost-panel-body">
          <div class="panel-login-box">
            <div class="panel-login-title" style="color: #ef4444; display: flex; align-items: center; gap: 6px;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #ef4444;"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              Vượt Giới Hạn Thiết Bị
            </div>
            <div class="panel-login-subtitle" style="margin-bottom: 12px; font-size: 12px;">
              Cửa hàng của bạn đã đạt giới hạn tối đa <strong>${limit}</strong> thiết bị hoạt động đồng thời.
            </div>

            <div class="panel-login-error" style="display: block; margin-bottom: 12px; font-size: 11px;">
              Vui lòng mở Options (Cài đặt) để xem danh sách máy đang kết nối hoặc liên hệ với Chủ Shop/Quản trị viên để nâng cấp hạn ngạch.
            </div>

            <button type="button" id="panel-btn-open-settings" class="panel-login-btn" style="background-color: var(--theme-color, #4f46e5); color: #fff; margin-top: 4px;">
              💻 Quản lý thiết bị (Options)
            </button>
            
            <button type="button" id="panel-btn-logout-limit" class="panel-login-btn" style="background-color: #ef4444; color: #fff; margin-top: 8px;">
              🚪 Đăng xuất tài khoản
            </button>
          </div>
        </div>
      `;

      root.appendChild(panel);
      const _headerEl = root.getElementById('vnpost-panel-header-text');
      if (_headerEl) _headerEl.textContent = platformObj.title || '';
      makeElementDraggable(panel, root.getElementById("vnpost-panel-header"));

      // Gắn sự kiện theme toggle
      const btnTheme = root.getElementById('vnpost-btn-theme');
      if (btnTheme) {
        btnTheme.addEventListener('click', (e) => {
          e.stopPropagation();
          const isNowLight = panel.classList.toggle('light-mode');
          persistThemePreference(isNowLight);
        });
      }

      // Gắn sự kiện thu nhỏ
      root.getElementById('vnpost-btn-minimize').addEventListener('click', () => {
        panel.classList.toggle('minimized');
      });

      const btnSettings = root.getElementById('panel-btn-open-settings');
      if (btnSettings && onSettingsClickHandler) {
        btnSettings.addEventListener('click', (e) => {
          e.preventDefault();
          onSettingsClickHandler();
        });
      }

      const btnLogout = root.getElementById('panel-btn-logout-limit');
      if (btnLogout) {
        btnLogout.addEventListener('click', async (e) => {
          e.preventDefault();
          btnLogout.disabled = true;
          btnLogout.textContent = '⏳ Đang đăng xuất...';
          try {
            if (typeof AuthService !== 'undefined' && typeof AuthService.logout === 'function') {
              await AuthService.logout();
              setTimeout(() => {
                const recheckFn = (typeof globalThis !== 'undefined' && globalThis.checkUrlAndInject) ||
                                  (typeof window !== 'undefined' && window.checkUrlAndInject);
                if (typeof recheckFn === 'function') {
                  recheckFn();
                }
              }, 80);
            }
          } catch (err) {
            alert('Lỗi đăng xuất: ' + err.message);
          } finally {
            btnLogout.disabled = false;
            btnLogout.textContent = '🚪 Đăng xuất tài khoản';
          }
        });
      }

    } catch (e) {
      console.warn("Lỗi tạo panel giới hạn thiết bị:", e);
    }
  }

  globalThis.createInputPanel = createInputPanel;
  globalThis.createLoginRequiredPanel = createLoginRequiredPanel;
  globalThis.createDeviceLimitExceededPanel = createDeviceLimitExceededPanel;
  globalThis.showOrderApprovalModal = showOrderApprovalModal;
  globalThis.displayParsedData = displayParsedData;
})();

