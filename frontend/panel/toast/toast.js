(() => {
  function showVnpostToast(message, type) {
    try {
      if (typeof document === 'undefined') {
        console.log('[Auto Fill Order]', message);
        return;
      }
      const host = document.getElementById('vnpost-autofill-shadow-host');
      if (!host) { console.log('[Auto Fill Order]', message); return; }
      const root = host.shadowRoot || host;
      let container = root.getElementById ? root.getElementById('vnpost-toast-container') : null;
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
