/**
 * AuditLogger - Hệ thống Nhật ký & Kiểm toán Vận hành chuẩn Thương mại (Enterprise Audit Logging)
 * Đồng bộ đa thiết bị qua Supabase Cloud Database (bảng audit_logs) và bộ nhớ đệm cục bộ.
 */

(() => {
  class AuditLoggerEngine {
    constructor() {
      this._localKey = 'audit_logs_cache';
      this._errorKey = 'errorLogs';
      this._maxLocalLogs = 500;
      this._listeners = new Set();
    }

    _isExtension() {
      return typeof chrome !== 'undefined' && Boolean(chrome.storage) && Boolean(chrome.storage.local);
    }

    async _getShopId() {
      try {
        if (typeof OrderStorage !== 'undefined' && typeof OrderStorage.getActiveShop === 'function') {
          const shop = await OrderStorage.getActiveShop();
          return shop ? (shop.id || shop) : null;
        }
      } catch (_) {}
      return localStorage.getItem('current_shop_id') || null;
    }

    async _getUser() {
      try {
        if (typeof AuthSession !== 'undefined' && typeof AuthSession.getUser === 'function') {
          return await AuthSession.getUser();
        }
      } catch (_) {}
      return null;
    }

    async _getDeviceName() {
      return new Promise((resolve) => {
        try {
          if (this._isExtension()) {
            chrome.storage.local.get(['fbDeviceName'], res => resolve(res.fbDeviceName || 'Máy cục bộ'));
          } else {
            resolve(localStorage.getItem('fbDeviceName') || 'Trình duyệt Web');
          }
        } catch (_) {
          resolve('Máy cục bộ');
        }
      });
    }

    async _getLocalLogs() {
      return new Promise((resolve) => {
        try {
          if (this._isExtension()) {
            chrome.storage.local.get([this._localKey], (res) => {
              resolve(Array.isArray(res[this._localKey]) ? res[this._localKey] : []);
            });
          } else {
            const raw = localStorage.getItem(this._localKey);
            resolve(raw ? JSON.parse(raw) : []);
          }
        } catch (_) {
          resolve([]);
        }
      });
    }

    async _saveLocalLogs(logs) {
      return new Promise((resolve) => {
        try {
          if (this._isExtension()) {
            chrome.storage.local.set({ [this._localKey]: logs }, () => resolve(true));
          } else {
            localStorage.setItem(this._localKey, JSON.stringify(logs));
            resolve(true);
          }
        } catch (_) {
          resolve(false);
        }
      });
    }

    /**
     * Ghi nhận một bản ghi Audit/Operation Log chuẩn
     */
    async record({
      action,
      message,
      category = 'AUDIT', // 'AUDIT' | 'OPERATION' | 'SECURITY' | 'ERROR'
      level = 'INFO',     // 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' | 'CRITICAL'
      metadata = {}
    }) {
      const shopId = await this._getShopId();
      const user = await this._getUser();
      const deviceName = await this._getDeviceName();

      const safeMessage = String(message || '').replace(/(api_key|gsk_[a-zA-Z0-9]+|Bearer\s+[a-zA-Z0-9\-\._~+\/]+)/g, '[REDACTED_SECRET]');
      
      const logEntry = {
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        shop_id: shopId,
        user_id: user ? user.id : null,
        user_email: user ? user.email : 'Ẩn danh',
        device_name: deviceName,
        action: String(action || 'GENERAL_ACTION'),
        category,
        level,
        message: safeMessage,
        metadata: typeof metadata === 'object' ? metadata : { raw: String(metadata) },
        created_at: new Date().toISOString()
      };

      // 1. Lưu đệm cục bộ
      const localLogs = await this._getLocalLogs();
      localLogs.unshift(logEntry);
      if (localLogs.length > this._maxLocalLogs) localLogs.length = this._maxLocalLogs;
      await this._saveLocalLogs(localLogs);
      this._emitChange(localLogs);

      // 2. Nếu là lỗi, ghi nhận thêm vào errorLogs cũ để tương thích ngược
      if (category === 'ERROR' || level === 'ERROR') {
        try {
          if (this._isExtension()) {
            chrome.storage.local.get([this._errorKey], (res) => {
              const errs = res[this._errorKey] || [];
              errs.unshift({
                timestamp: new Date().toLocaleString('vi-VN'),
                message: safeMessage,
                context: typeof metadata === 'object' ? JSON.stringify(metadata) : String(metadata),
                category: action || 'APP'
              });
              if (errs.length > 100) errs.length = 100;
              chrome.storage.local.set({ [this._errorKey]: errs });
            });
          }
        } catch (_) {}
      }

      // 3. Đẩy lên Supabase Cloud (bảng audit_logs)
      try {
        if (typeof SupabaseCloud !== 'undefined' && SupabaseCloud.isConnected) {
          await fetch(SupabaseCloud._url('audit_logs'), {
            method: 'POST',
            headers: SupabaseCloud._headers(),
            body: JSON.stringify({
              shop_id: shopId,
              user_id: user ? user.id : null,
              action: logEntry.action,
              details: {
                user_email: logEntry.user_email,
                device_name: logEntry.device_name,
                category: logEntry.category,
                level: logEntry.level,
                message: logEntry.message,
                metadata: logEntry.metadata
              }
            })
          });
        }
      } catch (e) {
        console.warn('Lỗi đẩy audit log lên Cloud:', e);
      }

      return logEntry;
    }

    // Các hàm tiện ích
    logAudit(action, message, metadata = {}) {
      return this.record({ action, message, category: 'AUDIT', level: 'INFO', metadata });
    }

    logOperation(action, message, metadata = {}) {
      return this.record({ action, message, category: 'OPERATION', level: 'SUCCESS', metadata });
    }

    logSecurity(action, message, metadata = {}) {
      return this.record({ action, message, category: 'SECURITY', level: 'WARNING', metadata });
    }

    logError(action, message, metadata = {}) {
      return this.record({ action, message, category: 'ERROR', level: 'ERROR', metadata });
    }

    /**
     * Tải danh sách Audit Logs (Kéo từ Supabase Cloud hoặc đọc cache)
     */
    async getLogs(forceCloud = false) {
      const shopId = await this._getShopId();
      let cloudLogs = null;

      try {
        if (typeof SupabaseCloud !== 'undefined' && SupabaseCloud.isConnected) {
          let endpoint = 'audit_logs?select=*&order=created_at.desc&limit=100';
          if (shopId) {
            endpoint += `&shop_id=eq.${encodeURIComponent(shopId)}`;
          }
          const resp = await fetch(SupabaseCloud._url(endpoint), {
            method: 'GET',
            headers: SupabaseCloud._headers()
          });
          if (resp.ok) {
            const raw = await resp.json();
            cloudLogs = (raw || []).map(r => {
              const details = (typeof r.details === 'object' && r.details !== null) 
                ? r.details 
                : (typeof r.details === 'string' ? JSON.parse(r.details || '{}') : {});
              return {
                id: r.id,
                shop_id: r.shop_id,
                user_id: r.user_id,
                action: r.action,
                created_at: r.created_at,
                user_email: details.user_email || 'Ẩn danh',
                device_name: details.device_name || 'Máy cục bộ',
                category: details.category || 'AUDIT',
                level: details.level || 'INFO',
                message: details.message || r.action,
                metadata: details.metadata || {}
              };
            });
          }
        }
      } catch (e) {
        console.warn('Lỗi kéo audit logs từ Supabase:', e);
      }

      if (Array.isArray(cloudLogs)) {
        await this._saveLocalLogs(cloudLogs);
        this._emitChange(cloudLogs);
        return cloudLogs;
      }

      return await this._getLocalLogs();
    }

    async clearLogs() {
      await this._saveLocalLogs([]);
      this._emitChange([]);

      const shopId = await this._getShopId();
      try {
        if (typeof SupabaseCloud !== 'undefined' && SupabaseCloud.isConnected) {
          let endpoint = 'audit_logs';
          if (shopId) endpoint += `?shop_id=eq.${encodeURIComponent(shopId)}`;
          await fetch(SupabaseCloud._url(endpoint), {
            method: 'DELETE',
            headers: SupabaseCloud._headers()
          });
        }
      } catch (_) {}
    }

    subscribe(callback) {
      if (typeof callback === 'function') this._listeners.add(callback);
      return () => this._listeners.delete(callback);
    }

    _emitChange(logs) {
      this._listeners.forEach(cb => {
        try { cb(logs); } catch (_) {}
      });
    }

    // Tương thích ngược với interface Logger cũ
    log(message, ...args) {
      console.log(`[Auto Fill Order] ${message}`, ...args);
    }

    warn(message, ...args) {
      console.warn(`[Auto Fill Order] ${message}`, ...args);
      this.logSecurity('APP_WARNING', message, { args });
    }

    error(message, ...args) {
      console.error(`[Auto Fill Order] ${message}`, ...args);
      let context = '';
      try {
        context = args.map(a => (a instanceof Error ? (a.stack || a.message) : (typeof a === 'object' ? JSON.stringify(a) : String(a)))).join(' ');
      } catch (e) {
        context = e.message;
      }
      this.logError('UNCAUGHT_ERROR', message, { context });
    }
  }

  const AuditLogger = new AuditLoggerEngine();
  globalThis.AuditLogger = AuditLogger;
  globalThis.Logger = AuditLogger; // Tương thích ngược

  // Lắng nghe lỗi toàn cục
  const globalScope = typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : null);
  let isHandlingError = false;
  if (globalScope) {
    globalScope.addEventListener('error', (event) => {
      if (isHandlingError) return;
      isHandlingError = true;
      try {
        const msg = event.message || 'Lỗi không xác định';
        const file = event.filename ? event.filename.split('/').pop() : '';
        const line = event.lineno || '';
        const col = event.colno || '';
        const stack = event.error ? event.error.stack : '';
        AuditLogger.logError('JS_ERROR', msg, { file, line, col, stack });
      } catch (_) {} finally {
        isHandlingError = false;
      }
    });

    globalScope.addEventListener('unhandledrejection', (event) => {
      if (isHandlingError) return;
      isHandlingError = true;
      try {
        const reason = event.reason;
        const msg = reason ? (reason.message || String(reason)) : 'Promise bị từ chối';
        const stack = reason && reason.stack ? reason.stack : '';
        AuditLogger.logError('PROMISE_REJECTION', msg, { stack });
      } catch (_) {} finally {
        isHandlingError = false;
      }
    });
  }
})();
