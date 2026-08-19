(() => {
  // Inject toast CSS stylesheet into document head or shadow root if not already present
  function ensureToastStyles(targetRoot) {
    if (typeof document === 'undefined') return;
    const target = targetRoot || document.head;
    if (target.querySelector && target.querySelector('#vnpost-toast-styles')) return;
    try {
      const style = document.createElement('style');
      style.id = 'vnpost-toast-styles';
      style.textContent = `
        #vnpost-toast-container {
            position: fixed;
            top: 24px;
            right: 24px;
            z-index: 2147483647;
            display: flex;
            flex-direction: column;
            gap: 12px;
            align-items: flex-end;
            pointer-events: none;
        }
        .vnpost-toast {
            font-family: 'Be Vietnam Pro', 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: rgba(15, 23, 42, 0.9);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            color: #f8fafc;
            padding: 12px 16px;
            border-radius: 12px;
            font-size: 13.5px;
            font-weight: 500;
            min-width: 280px;
            max-width: 380px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25), inset 0 0 0 1px rgba(255, 255, 255, 0.1);
            opacity: 0;
            border-left: 4px solid var(--theme-color, #4f46e5);
            transform: translateX(120%);
            transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
            pointer-events: auto;
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .vnpost-toast.show {
            opacity: 1;
            transform: translateX(0);
        }
        .vnpost-toast-icon {
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            flex-shrink: 0 !important;
            width: 20px !important;
            height: 20px !important;
            min-width: 20px !important;
            min-height: 20px !important;
        }
        .vnpost-toast-icon svg {
            width: 20px !important;
            height: 20px !important;
            display: block !important;
        }
        .vnpost-toast-message {
            flex-grow: 1;
            line-height: 1.4;
            text-align: left;
        }
        .vnpost-toast-close {
            background: none;
            border: none;
            padding: 4px;
            margin: -4px -4px -4px 4px;
            color: rgba(255, 255, 255, 0.4);
            cursor: pointer;
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 20px;
            height: 20px;
            transition: all 0.2s;
        }
        .vnpost-toast-close:hover {
            background: rgba(255, 255, 255, 0.1);
            color: rgba(255, 255, 255, 0.8);
        }
        .vnpost-toast-close svg {
            width: 12px;
            height: 12px;
        }
        .vnpost-toast--success {
            border-left-color: #10b981;
        }
        .vnpost-toast--success .vnpost-toast-icon {
            color: #34d399;
            filter: drop-shadow(0 0 4px rgba(52, 211, 153, 0.4));
        }
        .vnpost-toast--error {
            border-left-color: #ef4444;
        }
        .vnpost-toast--error .vnpost-toast-icon {
            color: #fca5a5;
            filter: drop-shadow(0 0 4px rgba(239, 68, 68, 0.4));
        }
        .vnpost-toast--error.show {
            animation: vnpostShakeError 0.5s cubic-bezier(0.25, 0.8, 0.25, 1) forwards;
        }
        .vnpost-toast--warning {
            border-left-color: #f59e0b;
        }
        .vnpost-toast--warning .vnpost-toast-icon {
            color: #fde047;
            filter: drop-shadow(0 0 4px rgba(245, 158, 11, 0.4));
        }
        .vnpost-toast--info {
            border-left-color: #3b82f6;
        }
        .vnpost-toast--info .vnpost-toast-icon {
            color: #93c5fd;
            filter: drop-shadow(0 0 4px rgba(59, 130, 246, 0.4));
        }
        .vnpost-toast.light-mode {
            background: rgba(255, 255, 255, 0.95);
            color: #0f172a;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08), inset 0 0 0 1px rgba(0, 0, 0, 0.06);
        }
        .vnpost-toast.light-mode .vnpost-toast-close {
            color: rgba(0, 0, 0, 0.4);
        }
        .vnpost-toast.light-mode .vnpost-toast-close:hover {
            background: rgba(0, 0, 0, 0.05);
            color: rgba(0, 0, 0, 0.8);
        }
        @keyframes vnpostShakeError {
          0% { opacity: 0; transform: translateX(120%); }
          30% { opacity: 1; transform: translateX(0) scale(1.02); }
          50% { transform: translateX(-6px); }
          70% { transform: translateX(4px); }
          90% { transform: translateX(-2px); }
          100% { transform: translateX(0); }
        }
      `;
      target.appendChild(style);
    } catch (_) {}
  }

  function showVnpostToast(message, type) {
    try {
      if (typeof document === 'undefined') {
        console.log('[Auto Fill Order]', message);
        return;
      }
      
      const host = document.getElementById('vnpost-autofill-shadow-host') || 
                   document.getElementById('af-react-root') || 
                   document.body;

      if (!host) { 
        console.log('[Auto Fill Order]', message); 
        return; 
      }

      const root = host.shadowRoot || host;
      ensureToastStyles(root);
      let container = root.getElementById ? root.getElementById('vnpost-toast-container') : null;
      if (!container && root.querySelector) {
        container = root.querySelector('#vnpost-toast-container');
      }

      if (!container) {
        container = document.createElement('div');
        container.id = 'vnpost-toast-container';
        root.appendChild(container);
      }

      const panel = root.getElementById ? root.getElementById('vnpost-autofill-panel') : null;
      const isLightMode = panel && panel.classList.contains('light-mode');

      const toast = document.createElement('div');
      toast.className = 'vnpost-toast vnpost-toast--' + (type || 'info');
      if (isLightMode) {
        toast.classList.add('light-mode');
      }

      // Icon
      const iconWrapper = document.createElement('div');
      iconWrapper.className = 'vnpost-toast-icon';
      
      let svgContent = '';
      if (type === 'success') {
        svgContent = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14 9 11"/></svg>`;
      } else if (type === 'error') {
        svgContent = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
      } else if (type === 'warning') {
        svgContent = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
      } else { // info
        svgContent = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
      }
      iconWrapper.innerHTML = svgContent;

      // Message
      const msgWrapper = document.createElement('div');
      msgWrapper.className = 'vnpost-toast-message';
      msgWrapper.textContent = message;

      // Close Button
      const closeBtn = document.createElement('button');
      closeBtn.className = 'vnpost-toast-close';
      closeBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
      closeBtn.onclick = () => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 250);
      };

      toast.appendChild(iconWrapper);
      toast.appendChild(msgWrapper);
      toast.appendChild(closeBtn);
      container.appendChild(toast);
      
      requestAnimationFrame(() => toast.classList.add('show'));
      
      setTimeout(() => {
        if (toast.parentNode) {
          toast.classList.remove('show');
          setTimeout(() => toast.remove(), 250);
        }
      }, 3500);
    } catch (e) { console.warn('Toast error:', e); }
  }

  function showPanelConfirmModal(message) {
    return new Promise(resolve => {
      try {
        const host = document.getElementById('vnpost-autofill-shadow-host');
        if (!host) { resolve(true); return; }
        const root = host.shadowRoot || host;
        const old = root.getElementById('vnpost-confirm-overlay');
        if (old) old.remove();

        const overlay = document.createElement('div');
        overlay.id = 'vnpost-confirm-overlay';

        // Tạo modal bằng DOM API thay vì innerHTML để tránh XSS
        const modal = document.createElement('div');
        modal.id = 'vnpost-confirm-modal';

        const title = document.createElement('div');
        title.id = 'vnpost-confirm-title';
        title.textContent = '⚠️ Cảnh báo trùng ĐVVC';

        const msg = document.createElement('div');
        msg.id = 'vnpost-confirm-msg';
        // Render newlines an toàn qua textContent + <br>
        message.split('\n').forEach((line, i) => {
          if (i > 0) msg.appendChild(document.createElement('br'));
          msg.appendChild(document.createTextNode(line));
        });

        const actions = document.createElement('div');
        actions.id = 'vnpost-confirm-actions';

        const btnCancel = document.createElement('button');
        btnCancel.id = 'vnpost-confirm-btn-cancel';
        btnCancel.textContent = 'Hủy';

        const btnOk = document.createElement('button');
        btnOk.id = 'vnpost-confirm-btn-ok';
        btnOk.textContent = 'Đồng ý';

        actions.appendChild(btnCancel);
        actions.appendChild(btnOk);
        modal.appendChild(title);
        modal.appendChild(msg);
        modal.appendChild(actions);
        overlay.appendChild(modal);
        root.appendChild(overlay);

        function ok() { overlay.remove(); resolve(true); }
        function cancel() { overlay.remove(); resolve(false); }
        btnCancel.onclick = cancel;
        btnOk.onclick = ok;
        overlay.onclick = e => { if (e.target === overlay) cancel(); };
      } catch (e) { resolve(true); }
    });
  }

  globalThis.showVnpostToast = showVnpostToast;
  globalThis.showPanelConfirmModal = showPanelConfirmModal;
})();
