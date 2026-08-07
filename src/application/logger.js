(() => {
  async function saveErrorLog(message, context = '') {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['errorLogs'], (res) => {
          const lastErr = chrome.runtime.lastError;
          if (lastErr) return;
          const logs = res.errorLogs || [];
          logs.unshift({
            timestamp: new Date().toLocaleString('vi-VN'),
            message: String(message),
            context: String(context)
          });
          // Limit to 100 logs
          if (logs.length > 100) logs.length = 100;
          chrome.storage.local.set({ errorLogs: logs });
        });
      }
    } catch (e) {
      console.error('Failed to save error log:', e);
    }
  }

  const Logger = {
    log(message, ...args) {
      console.log(`[Auto Fill Order] ${message}`, ...args);
    },
    warn(message, ...args) {
      console.warn(`[Auto Fill Order] ${message}`, ...args);
    },
    error(message, ...args) {
      console.error(`[Auto Fill Order] ${message}`, ...args);
      let context = '';
      try {
        context = args.map(a => {
          if (a === null) return 'null';
          if (a === undefined) return 'undefined';
          if (a instanceof Error) return a.stack || a.message;
          if (typeof a === 'object') {
            try {
              return JSON.stringify(a);
            } catch (err) {
              return '[Circular or Non-Serializable Object]';
            }
          }
          return String(a);
        }).join(' ');
      } catch (e) {
        context = 'Lỗi tuần tự hóa: ' + e.message;
      }
      saveErrorLog(message, context);
    }
  };

  globalThis.Logger = Logger;

  // Lắng nghe lỗi toàn cục để tự động ghi nhận
  const globalScope = typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : null);
  let isHandlingGlobalError = false;
  if (globalScope) {
    globalScope.addEventListener('error', (event) => {
      if (isHandlingGlobalError) return;
      isHandlingGlobalError = true;
      try {
        const msg = event.message || 'Lỗi không xác định';
        const file = event.filename ? event.filename.split('/').pop() : '';
        const line = event.lineno || '';
        const col = event.colno || '';
        const stack = event.error ? event.error.stack : '';
        const context = `File: ${file} (Dòng: ${line}, Cột: ${col})\nStack: ${stack}`;
        Logger.error(`[Uncaught Error] ${msg}`, context);
      } catch (e) {
        console.error('Lỗi khi ghi nhận lỗi toàn cục:', e);
      } finally {
        isHandlingGlobalError = false;
      }
    });

    globalScope.addEventListener('unhandledrejection', (event) => {
      if (isHandlingGlobalError) return;
      isHandlingGlobalError = true;
      try {
        const reason = event.reason;
        const msg = reason ? (reason.message || String(reason)) : 'Promise bị từ chối';
        const stack = reason && reason.stack ? reason.stack : '';
        Logger.error(`[Unhandled Rejection] ${msg}`, stack);
      } catch (e) {
        console.error('Lỗi khi ghi nhận lỗi Promise toàn cục:', e);
      } finally {
        isHandlingGlobalError = false;
      }
    });
  }
})();
