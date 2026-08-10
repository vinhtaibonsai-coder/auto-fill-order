(() => {
  // Inject toast CSS stylesheet into document head if not already present
  function ensureToastStyles() {
    if (typeof document === 'undefined') return;
    if (document.getElementById('vnpost-toast-styles')) return;
    try {
      const style = document.createElement('style');
      style.id = 'vnpost-toast-styles';
      style.textContent = `
        #vnpost-toast-container {
            position: fixed;
            top: 24px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 10000000;
            display: flex;
            flex-direction: column;
            gap: 10px;
            align-items: center;
            pointer-events: none;
        }
        .vnpost-toast {
            font-family: 'Be Vietnam Pro', 'Noto Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: rgba(10, 11, 14, 0.95);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            color: #fff;
            padding: 10px 20px;
            border-radius: 12px;
            font-size: 13.5px;
            font-weight: 500;
            min-width: 260px;
            text-align: center;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3), inset 0 0 0 1px rgba(255, 255, 255, 0.08);
            opacity: 0;
            border-left: 4px solid var(--theme-color, #4f46e5);
            transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .vnpost-toast.show {
            opacity: 1;
            animation: vnpostSlideDownPop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
        .vnpost-toast--success {
            border-left-color: #10b981;
        }
        .vnpost-toast--success.show {
            box-shadow: 0 20px 45px rgba(16, 185, 129, 0.15), inset 0 0 0 1px rgba(255, 255, 255, 0.08);
        }
        .vnpost-toast--error {
            border-left-color: #ef4444;
        }
        .vnpost-toast--error.show {
            animation: vnpostShakeError 0.65s cubic-bezier(0.25, 0.8, 0.25, 1) forwards;
            box-shadow: 0 20px 45px rgba(239, 68, 68, 0.2), inset 0 0 0 1px rgba(255, 255, 255, 0.08);
        }
        @keyframes vnpostSlideDownPop {
          0% { opacity: 0; transform: translateY(-24px) scale(0.95); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes vnpostShakeError {
          0% { opacity: 0; transform: translateY(-24px) scale(0.95); }
          35% { opacity: 1; transform: translateY(0) scale(1.02); }
          50% { transform: translateX(-6px) scale(1); }
          65% { transform: translateX(6px); }
          80% { transform: translateX(-3px); }
          90% { transform: translateX(3px); }
          100% { transform: translateX(0); }
        }
      `;
      document.head.appendChild(style);
    } catch (_) {}
  }

  function showVnpostToast(message, type) {
    try {
      if (typeof document === 'undefined') {
        console.log('[Auto Fill Order]', message);
        return;
      }
      
      // Đảm bảo style của toast đã có trong document head
      ensureToastStyles();

      // Tìm phần tử gắn Toast: ưu tiên shadow host của vanilla UI, hoặc af-react-root, hoặc body
      const host = document.getElementById('vnpost-autofill-shadow-host') || 
                   document.getElementById('af-react-root') || 
                   document.body;

      if (!host) { 
        console.log('[Auto Fill Order]', message); 
        return; 
      }

      const root = host.shadowRoot || host;
      let container = root.getElementById ? root.getElementById('vnpost-toast-container') : null;
      if (!container && root.querySelector) {
        container = root.querySelector('#vnpost-toast-container');
      }

      if (!container) {
        container = document.createElement('div');
        container.id = 'vnpost-toast-container';
        root.appendChild(container);
      }

      const toast = document.createElement('div');
      toast.className = 'vnpost-toast vnpost-toast--' + (type || 'info');
      toast.textContent = message;
      container.appendChild(toast);
      
      requestAnimationFrame(() => toast.classList.add('show'));
      
      setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 250);
      }, 3200);
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
