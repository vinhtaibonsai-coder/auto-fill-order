/**
 * NotificationService - Quản lý thông báo chuẩn thương mại (Enterprise Notification Center)
 * Hỗ trợ đồng bộ đa thiết bị, đa trình duyệt qua Supabase Cloud Database và bộ nhớ đệm cục bộ.
 */

class NotificationServiceEngine {
  constructor() {
    this._localKey = 'system_notifications_cache';
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

  async _getLocalCache() {
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

  async _saveLocalCache(list) {
    return new Promise((resolve) => {
      try {
        if (this._isExtension()) {
          chrome.storage.local.set({ [this._localKey]: list }, () => resolve(true));
        } else {
          localStorage.setItem(this._localKey, JSON.stringify(list));
          resolve(true);
        }
      } catch (_) {
        resolve(false);
      }
    });
  }

  /**
   * Lấy danh sách thông báo (Kéo từ Cloud hoặc đọc cache)
   */
  async getNotifications(forceCloud = false) {
    const shopId = await this._getShopId();
    let cloudList = null;

    try {
      if (typeof SupabaseCloud !== 'undefined' && SupabaseCloud.isConnected) {
        let endpoint = 'notifications?select=*&order=created_at.desc&limit=50';
        if (shopId) {
          endpoint += `&shop_id=eq.${encodeURIComponent(shopId)}`;
        }
        const resp = await fetch(SupabaseCloud._url(endpoint), {
          method: 'GET',
          headers: SupabaseCloud._headers()
        });
        if (resp.ok) {
          cloudList = await resp.json();
        }
      }
    } catch (e) {
      console.warn('Lỗi kéo thông báo từ Supabase:', e);
    }

    if (Array.isArray(cloudList)) {
      await this._saveLocalCache(cloudList);
      this._emitChange(cloudList);
      return cloudList;
    }

    return await this._getLocalCache();
  }

  /**
   * Đếm số lượng thông báo chưa đọc
   */
  async getUnreadCount() {
    const list = await this.getNotifications();
    return list.filter(n => !n.is_read).length;
  }

  /**
   * Tạo thông báo mới và đồng bộ lên Cloud
   */
  async notify({
    title,
    message,
    type = 'INFO', // 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR'
    category = 'SYSTEM', // 'ORDERS' | 'SECURITY' | 'SYSTEM' | 'ANNOUNCEMENT'
    content = '',
    level = 'INFO'
  }) {
    const shopId = await this._getShopId();
    const user = await this._getUser();
    const newNotif = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'notif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      shop_id: shopId,
      user_id: user ? user.id : null,
      type: category,
      title: String(title || 'Thông báo'),
      message: String(message || ''),
      content: String(content || ''),
      level: level || type || 'INFO',
      is_read: false,
      created_at: new Date().toISOString()
    };

    // 1. Lưu đệm cục bộ
    const local = await this._getLocalCache();
    local.unshift(newNotif);
    if (local.length > 100) local.length = 100;
    await this._saveLocalCache(local);
    this._emitChange(local);

    // 2. Hiện Toast nếu có hàm showQuickToast
    if (typeof showQuickToast === 'function') {
      const toastType = level === 'ERROR' ? 'error' : (level === 'WARNING' ? 'warning' : 'success');
      showQuickToast(title + (message ? `: ${message}` : ''), toastType, 4000);
    }

    // 3. Đẩy lên Supabase Cloud
    try {
      if (typeof SupabaseCloud !== 'undefined' && SupabaseCloud.isConnected) {
        await fetch(SupabaseCloud._url('notifications'), {
          method: 'POST',
          headers: SupabaseCloud._headers(),
          body: JSON.stringify({
            shop_id: shopId,
            user_id: user ? user.id : null,
            type: category,
            title: newNotif.title,
            message: newNotif.message,
            content: newNotif.content,
            level: newNotif.level,
            is_read: false
          })
        });
      }
    } catch (e) {
      console.warn('Lỗi đẩy thông báo lên Cloud:', e);
    }

    return newNotif;
  }

  /**
   * Đánh dấu 1 thông báo là đã đọc
   */
  async markAsRead(id) {
    if (!id) return;
    const local = await this._getLocalCache();
    const item = local.find(n => n.id === id);
    if (item) item.is_read = true;
    await this._saveLocalCache(local);
    this._emitChange(local);

    try {
      if (typeof SupabaseCloud !== 'undefined' && SupabaseCloud.isConnected) {
        await fetch(SupabaseCloud._url(`notifications?id=eq.${encodeURIComponent(id)}`), {
          method: 'PATCH',
          headers: SupabaseCloud._headers(),
          body: JSON.stringify({ is_read: true })
        });
      }
    } catch (_) {}
  }

  /**
   * Đánh dấu tất cả thông báo là đã đọc
   */
  async markAllAsRead() {
    const local = await this._getLocalCache();
    local.forEach(n => { n.is_read = true; });
    await this._saveLocalCache(local);
    this._emitChange(local);

    const shopId = await this._getShopId();
    try {
      if (typeof SupabaseCloud !== 'undefined' && SupabaseCloud.isConnected) {
        let endpoint = 'notifications?is_read=eq.false';
        if (shopId) endpoint += `&shop_id=eq.${encodeURIComponent(shopId)}`;
        await fetch(SupabaseCloud._url(endpoint), {
          method: 'PATCH',
          headers: SupabaseCloud._headers(),
          body: JSON.stringify({ is_read: true })
        });
      }
    } catch (_) {}
  }

  /**
   * Xóa 1 thông báo
   */
  async deleteNotification(id) {
    if (!id) return;
    const local = await this._getLocalCache();
    const filtered = local.filter(n => n.id !== id);
    await this._saveLocalCache(filtered);
    this._emitChange(filtered);

    try {
      if (typeof SupabaseCloud !== 'undefined' && SupabaseCloud.isConnected) {
        await fetch(SupabaseCloud._url(`notifications?id=eq.${encodeURIComponent(id)}`), {
          method: 'DELETE',
          headers: SupabaseCloud._headers()
        });
      }
    } catch (_) {}
  }

  /**
   * Xóa toàn bộ thông báo
   */
  async clearAll() {
    await this._saveLocalCache([]);
    this._emitChange([]);

    const shopId = await this._getShopId();
    try {
      if (typeof SupabaseCloud !== 'undefined' && SupabaseCloud.isConnected) {
        let endpoint = 'notifications';
        if (shopId) endpoint += `?shop_id=eq.${encodeURIComponent(shopId)}`;
        await fetch(SupabaseCloud._url(endpoint), {
          method: 'DELETE',
          headers: SupabaseCloud._headers()
        });
      }
    } catch (_) {}
  }

  /**
   * Đăng ký lắng nghe thay đổi thông báo để cập nhật UI
   */
  subscribe(callback) {
    if (typeof callback === 'function') {
      this._listeners.add(callback);
    }
    return () => this._listeners.delete(callback);
  }

  _emitChange(list) {
    this._listeners.forEach(cb => {
      try { cb(list); } catch (_) {}
    });
  }
}

export const NotificationService = new NotificationServiceEngine();
globalThis.NotificationService = NotificationService;
