
  const configCache = {
    groqApiKey: "",
    groqModelName: "llama-3.3-70b-versatile",
    customAiPrompt: "",
    blacklistPhones: [],
    activeShop: null
  };

  // Lắng nghe thay đổi từ chrome.storage để tự động đồng bộ cache
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local') {
        const shouldReinit = Object.keys(changes).some(k => 
          k.startsWith('activeShop') || 
          k.startsWith('current_shop_id') || 
          k.startsWith('groqApiKey') || 
          k.startsWith('groqModelName') || 
          k.startsWith('customAiPrompt') || 
          k.startsWith('blacklistPhones')
        );
        if (shouldReinit) {
          OrderStorage.initCache();
        }
        
        const hasOrdersChange = Object.keys(changes).some(k => k.startsWith('savedOrders') || k.startsWith('submittedOrders'));
        if (hasOrdersChange) {
          OrderStorage._invalidateOrdersCache();
        }
      }
    });
  }

  function _timeout(ms) {
    return new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout sau ${ms}ms`)), ms));
  }

  function normalizeCarrierCode(value) {
    if (!value) return '';
    if (typeof value === 'object') {
      return normalizeCarrierCode(
        value.id || value.ID || value.code || value.carrier_id || value.carrierId ||
        value.title || value.TITLE || value.name || value.label || ''
      );
    }
    const raw = String(value).trim();
    if (!raw) return '';
    if (raw.startsWith('{')) {
      try {
        return normalizeCarrierCode(JSON.parse(raw));
      } catch (_) {}
    }
    const key = raw.toLowerCase().replace(/\s+/g, '');
    if (key.includes('vnpost') || key.includes('vietnampost') || key.includes('buudien')) return 'vnpost';
    if (key === 'jt' || key.includes('j&t') || key.includes('jtexpress')) return 'jt';
    return raw;
  }

  function normalizeSubmittedIdentity(order) {
    if (!order) return '';
    const clean = value => String(value || '').trim();
    const phone = clean(order.phone).replace(/\D/g, '');
    const tracking = clean(order.trackingCode || order.tracking_code).toLowerCase().replace(/\s+/g, '');
    if (tracking && tracking !== '-' && tracking !== '—') return `tracking:${tracking}`;

    const savedId = clean(order.savedOrderId || order.saved_order_id).toLowerCase();
    if (savedId) return `saved:${savedId}`;

    const orderCode = clean(order.orderCode || order.order_code).toLowerCase();
    if (phone && orderCode && orderCode !== '—') return `order:${phone}:${orderCode}`;

    return `id:${order.id || ''}`;
  }

  // A customer is not an order identity: repeat purchases may share name, phone and COD.
  function isSameSubmittedOrder(existing, incoming) {
    if (!existing || !incoming) return false;
    const clean = value => String(value || '').trim().toLowerCase();
    const trackingA = clean(existing.trackingCode || existing.tracking_code);
    const trackingB = clean(incoming.trackingCode || incoming.tracking_code);
    if (trackingA && trackingB) return trackingA === trackingB;
    const savedA = clean(existing.savedOrderId || existing.saved_order_id);
    const savedB = clean(incoming.savedOrderId || incoming.saved_order_id);
    if (savedA && savedB) return savedA === savedB;
    const codeA = clean(existing.orderCode || existing.order_code);
    const codeB = clean(incoming.orderCode || incoming.order_code);
    if (codeA && codeB) return codeA === codeB;
    const idA = clean(existing.id);
    const idB = clean(incoming.id);
    return Boolean(idA && idB && idA === idB);
  }

  let _submittingLock = Promise.resolve();

  const OrderStorage = {
    isExtensionAvailable() {
      try {
        return typeof chrome !== 'undefined' && 
               chrome.runtime && 
               chrome.runtime.id && 
               chrome.storage && 
               chrome.storage.local && 
               !!chrome.runtime.getManifest();
      } catch (e) {
        return false;
      }
    },

    async getCurrentUserId() {
      let user = null;
      try {
        if (typeof AuthService !== 'undefined') {
          user = await AuthService.getCurrentUser();
        } else if (typeof AuthSession !== 'undefined') {
          user = await AuthSession.getUser();
        }
      } catch (_) {}
      return user && user.id ? String(user.id) : 'default_user';
    },

    async _getScopedKey(baseKey) {
      const userId = await this.getCurrentUserId();
      
      // Chuẩn hóa tên các key local storage
      if (baseKey === 'activeShopId' || baseKey === 'activeShop') return `current_shop_id_${userId}`;
      if (baseKey === 'groqModelName') return 'groq_mode';
      if (baseKey === 'panelTheme') return 'theme';
      if (baseKey === 'current_role' || baseKey === 'profile' || baseKey === 'permissions' || baseKey === 'notification_last_read') return baseKey;

      const shopScopeKeys = ['groqApiKey', 'customAiPrompt', 'blacklistPhones'];
      const userScopeKeys = ['savedOrders', 'submittedOrders', 'shops'];
      
      if (shopScopeKeys.includes(baseKey)) {
        const activeShop = await this.getActiveShop();
        const shopId = activeShop ? (activeShop.id || activeShop) : 'default_shop';
        return `${baseKey}_${userId}_${shopId}`;
      } else if (userScopeKeys.includes(baseKey)) {
        return `${baseKey}_${userId}`;
      }
      return baseKey;
    },

    async _getCustomerMetadataKey() {
      const userId = await this.getCurrentUserId();
      const activeShop = await this.getActiveShop();
      const shopId = activeShop ? (activeShop.id || activeShop) : 'default_shop';
      return `customerMetadata_${userId}_${shopId}`;
    },

    async _getSavedOrdersKey() {
      return this._getScopedKey('savedOrders');
    },

    async _getSubmittedKey() {
      return this._getScopedKey('submittedOrders');
    },

    async _getShopsKey() {
      return this._getScopedKey('shops');
    },

    async _getActiveShopKey() {
      return this._getScopedKey('activeShopId');
    },

    async initCache() {
      const keyApiKey = await this._getScopedKey('groqApiKey');
      const keyModelName = await this._getScopedKey('groqModelName');
      const keyPrompt = await this._getScopedKey('customAiPrompt');
      const keyBlacklist = await this._getScopedKey('blacklistPhones');

      try {
        configCache.activeShop = await this.getActiveShop();
      } catch (_) {
        configCache.activeShop = null;
      }

      return new Promise((resolve) => {
        if (this.isExtensionAvailable()) {
          chrome.storage.local.get([keyApiKey, keyModelName, keyPrompt, keyBlacklist], (res) => {
            configCache.groqApiKey = res[keyApiKey] || "";
            configCache.groqModelName = res[keyModelName] || "llama-3.3-70b-versatile";
            configCache.customAiPrompt = res[keyPrompt] || "";
            configCache.blacklistPhones = res[keyBlacklist] || [];
            resolve();
          });
        } else {
          configCache.groqApiKey = localStorage.getItem(keyApiKey) || "";
          configCache.groqModelName = localStorage.getItem(keyModelName) || "llama-3.3-70b-versatile";
          configCache.customAiPrompt = localStorage.getItem(keyPrompt) || "";
          try {
            const bl = localStorage.getItem(keyBlacklist);
            configCache.blacklistPhones = bl ? JSON.parse(bl) : [];
          } catch (e) {
            configCache.blacklistPhones = [];
          }
          resolve();
        }
      });
    },

    getCacheValue(key) {
      return configCache[key];
    },

    async getAIConfigs() {
      await this.initCache();
      return {
        groqApiKey: configCache.groqApiKey,
        groqModelName: configCache.groqModelName,
        customAiPrompt: configCache.customAiPrompt,
        blacklistPhones: configCache.blacklistPhones
      };
    },

    async saveAIConfigs(configs) {
      const keyApiKey = await this._getScopedKey('groqApiKey');
      const keyModelName = await this._getScopedKey('groqModelName');
      const keyPrompt = await this._getScopedKey('customAiPrompt');
      const keyBlacklist = await this._getScopedKey('blacklistPhones');

      const toSave = {};
      if (configs.groqApiKey !== undefined) toSave[keyApiKey] = configs.groqApiKey;
      if (configs.groqModelName !== undefined) toSave[keyModelName] = configs.groqModelName;
      if (configs.customAiPrompt !== undefined) toSave[keyPrompt] = configs.customAiPrompt;
      if (configs.blacklistPhones !== undefined) toSave[keyBlacklist] = configs.blacklistPhones;

      return new Promise((resolve, reject) => {
        if (this.isExtensionAvailable()) {
          chrome.storage.local.set(toSave, () => {
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              this.initCache().then(resolve);
            }
          });
        } else {
          for (const [k, v] of Object.entries(toSave)) {
            if (v === undefined || v === null) {
              localStorage.removeItem(k);
            } else if (typeof v === 'object') {
              localStorage.setItem(k, JSON.stringify(v));
            } else {
              localStorage.setItem(k, v);
            }
          }
          this.initCache().then(resolve);
        }
      });
    },

    // ─── IN-MEMORY CACHE cho orders (tránh đọc storage lặp lại) ─────────────
    _ordersCache: null,
    _ordersCacheTime: 0,
    _CACHE_TTL: 30000, // 30 giây — đủ để UI mượt, đủ mới để không stale

    _invalidateOrdersCache() {
      this._ordersCache = null;
      this._ordersCacheTime = 0;
    },

    async _getOrdersFromLocal() {
      const key = await this._getScopedKey('savedOrders');
      return new Promise((resolve) => {
        try {
          if (this.isExtensionAvailable()) {
            chrome.storage.local.get([key], (result) => {
              if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError) {
                resolve([]);
              } else {
                resolve(result[key] || []);
              }
            });
          } else {
            const localData = localStorage.getItem(key);
            resolve(localData ? JSON.parse(localData) : []);
          }
        } catch (e) {
          resolve([]);
        }
      });
    },

    async _saveOrdersToLocal(orders) {
      const key = await this._getScopedKey('savedOrders');
      const now = Date.now();
      const payload = { 
        [key]: orders,
        draft_queue_updated_at: now
      };
      if (key !== 'savedOrders') {
        payload.savedOrders = orders;
      }
      return new Promise((resolve, reject) => {
        try {
          if (this.isExtensionAvailable()) {
            chrome.storage.local.set(payload, () => {
              if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                this._invalidateOrdersCache();
                resolve();
              }
            });
          } else {
            localStorage.setItem(key, JSON.stringify(orders));
            if (key !== 'savedOrders') {
              localStorage.setItem('savedOrders', JSON.stringify(orders));
            }
            localStorage.setItem('draft_queue_updated_at', String(now));
            this._invalidateOrdersCache();
            resolve();
          }
        } catch (e) {
          reject(e);
        }
      });
    },

    async getOrders(forceSyncCloud = false) {
      if (!forceSyncCloud && this._ordersCache !== null && (Date.now() - this._ordersCacheTime) < this._CACHE_TTL) {
        return this._ordersCache;
      }
      const activeShop = await this.getActiveShop();
      const activeShopId = activeShop ? String(activeShop.id || activeShop) : null;
      const rawOrders = await this._getOrdersFromLocal();
      const orders = rawOrders.filter(o => {
        if (!o) return false;
        const sId = String(o.shopId || '');
        const aId = String(activeShopId || '');
        return sId === aId || sId === '' || sId.startsWith('shop_') || aId === '';
      });
      // Tự động gán lại shopId đúng cho các đơn chưa chuẩn
      let changed = false;
      orders.forEach(o => {
        const sId = String(o.shopId || '');
        const aId = String(activeShopId || '');
        if (aId && aId !== '' && !aId.startsWith('shop_') && (sId === '' || sId.startsWith('shop_'))) {
          o.shopId = aId;
          changed = true;
        }
      });
      if (changed) {
        this._saveOrdersToLocal(rawOrders).catch(() => {});
      }

      // Kéo đơn nháp từ Supabase Cloud để đồng bộ giữa Webapp và Trang Option
      let cloudOrders = null;
      try {
        if (typeof SupabaseCloud !== 'undefined' && typeof SupabaseCloud.fetchOrders === 'function') {
          cloudOrders = await SupabaseCloud.fetchOrders(activeShopId);
        } else if (this.isExtensionAvailable()) {
          cloudOrders = await Promise.race([
            new Promise(resolve => {
              try {
                chrome.runtime.sendMessage({ action: 'fetchOrders', shopId: activeShopId }, resp => {
                  resolve(Array.isArray(resp) ? resp : null);
                });
              } catch (_) {
                resolve(null);
              }
            }),
            new Promise(resolve => setTimeout(() => resolve(null), 2000))
          ]);
        }
      } catch (_) {}

      let combinedList = orders;
      if (Array.isArray(cloudOrders) && cloudOrders.length > 0) {
        const cloudIds = new Set(cloudOrders.map(o => String(o.id)).filter(Boolean));
        const cloudCodes = new Set(
          cloudOrders.map(o => String(o.orderCode || o.order_code || '').trim().toLowerCase())
            .filter(c => c && c !== '—' && c !== '-')
        );

        // Giữ lại đơn offline local chưa có trên Cloud
        const localOnlyOrders = orders.filter(o => {
          if (!o) return false;
          if (cloudIds.has(String(o.id))) return false;
          const c = String(o.orderCode || o.order_code || '').trim().toLowerCase();
          if (c && c !== '—' && c !== '-' && cloudCodes.has(c)) return false;
          return true;
        });

        cloudOrders.forEach(o => {
          o.isCloud = true;
          if (activeShopId && (!o.shopId || !o.shop_id)) {
            o.shopId = activeShopId;
            o.shop_id = activeShopId;
          }
        });

        combinedList = [...cloudOrders, ...localOnlyOrders];
        combinedList.sort((a, b) => {
          const tA = new Date(a.createdAt || a.created_at || 0).getTime();
          const tB = new Date(b.createdAt || b.created_at || 0).getTime();
          if (tB !== tA) return tB - tA;
          const idA = Number(String(a.id || '').split('_')[1]) || 0;
          const idB = Number(String(b.id || '').split('_')[1]) || 0;
          return idB - idA;
        });

        if (combinedList.length > 1000) combinedList = combinedList.slice(0, 1000);

        const otherShopsOrders = rawOrders.filter(o => o && String(o.shopId || '') !== (activeShopId || ''));
        const mergedAll = [...combinedList, ...otherShopsOrders];
        const isDifferent = JSON.stringify(mergedAll) !== JSON.stringify(rawOrders);
        if (isDifferent) {
          this._saveOrdersToLocal(mergedAll).catch(() => {});
        }
      }
      
      this._ordersCache = combinedList;
      this._ordersCacheTime = Date.now();
      return combinedList;
    },

    async getDraftOrders(forceSyncCloud = false) {
      const orders = await this.getOrders(forceSyncCloud);
      return Array.isArray(orders) ? orders.filter(o => o && !o.submittedAt && !o.trackingCode && !o.tracking_code) : [];
    },


    async saveOrder(order) {
      // Luôn đọc fresh từ storage để tránh cache stale từ context khác
      this._invalidateOrdersCache();
      order.platform = normalizeCarrierCode(order.platform || order.carrier || order.carrier_id);
      
      const activeShop = await this.getActiveShop();
      const activeShopId = activeShop ? String(activeShop.id || activeShop) : null;
      
      const allOrders = await this._getOrdersFromLocal();
      const orders = allOrders.filter(o => o && String(o.shopId || '') === (activeShopId || ''));
      
      if (!order.deviceName) {
        if (typeof FirebaseCloud !== 'undefined') {
          const cn = FirebaseCloud.deviceName;
          if (cn && cn !== 'Máy không tên' && !cn.startsWith('dev_')) {
            order.deviceName = cn;
          }
        }
        // Fallback: đọc trực tiếp từ storage nếu cloud chưa đồng bộ
        if (!order.deviceName && typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          try {
            const r = await new Promise(res => chrome.storage.local.get(['fbDeviceName'], res));
            if (r.fbDeviceName && r.fbDeviceName !== 'Máy không tên' && !r.fbDeviceName.startsWith('dev_')) {
              order.deviceName = r.fbDeviceName;
            }
          } catch(_) {}
        }
      }
      
      // Bắt buộc lấy Shop ID từ Session an toàn (Zero Trust) hoặc activeShop
      if (!order.shopId && activeShopId) {
        order.shopId = activeShopId;
      }
      if (typeof AuthSession !== 'undefined') {
        try {
          const sId = await AuthSession.getActiveShop();
          if (sId) {
            order.shopId = sId;
          }
        } catch (_) {}
      }

      if (!order.createdAt || order.createdAt.length <= 10) {
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const hh = String(now.getHours()).padStart(2, '0');
        const mi = String(now.getMinutes()).padStart(2, '0');
        order.createdAt = `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
      }
      
      // Lọc trùng trong cùng một Shop: BẢO VỆ ORDER IDENTITY INVARIANT
      // Tuyệt đối KHÔNG dùng tên, SĐT, COD hay địa chỉ làm danh tính đơn hàng.
      // Chỉ gộp khi trùng mã đơn (orderCode) cụ thể giữa 2 bản ghi.
      let existing = null;
      const incomingCode = String(order.orderCode || '').trim().toLowerCase();
      if (incomingCode && incomingCode !== '—' && incomingCode !== '-') {
        existing = orders.find(o => {
          if (order.id && o.id === order.id) return false;
          const existingCode = String(o.orderCode || '').trim().toLowerCase();
          return existingCode && existingCode === incomingCode;
        });
      }

      if (existing) {
        order.id = existing.id;
        if (!order.createdAt) order.createdAt = existing.createdAt;
      }

      let updatedOrdersList = [...orders];
      if (!order.id) {
        order.id = 'ord_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        updatedOrdersList.unshift(order);
      } else {
        const index = updatedOrdersList.findIndex(o => o.id === order.id);
        if (index !== -1) {
          updatedOrdersList[index] = { ...updatedOrdersList[index], ...order };
        } else {
          updatedOrdersList.unshift(order);
        }
      }

      // Giới hạn lưu trữ cục bộ tối đa 1000 đơn hàng gần nhất của shop này
      if (updatedOrdersList.length > 1000) {
        updatedOrdersList.sort((a,b) => {
          const tA = Number(a.id?.split('_')[1]) || 0;
          const tB = Number(b.id?.split('_')[1]) || 0;
          return tB - tA;
        });
        updatedOrdersList = updatedOrdersList.slice(0, 1000);
      }

      // Hợp nhất với các shop khác
      const otherShopsOrders = allOrders.filter(o => o && String(o.shopId || '') !== (activeShopId || ''));
      const mergedAllOrders = [...updatedOrdersList, ...otherShopsOrders];

      try {
        await this._saveOrdersToLocal(mergedAllOrders);
        this._pushToCloud(order);
        this._syncCustomerHubOrder(order, 'order').catch(() => {});
        try {
          if (this.isExtensionAvailable()) {
            chrome.runtime.sendMessage({ action: 'draftOrdersUpdated', count: updatedOrdersList.length }).catch(() => {});
          }
        } catch (_) {}
        try {
          const g = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null);
          const Evt = typeof CustomEvent !== 'undefined' ? CustomEvent : (g && g.CustomEvent);
          if (g && typeof g.dispatchEvent === 'function' && Evt) {
            g.dispatchEvent(new Evt('draft-queue-updated', { detail: { count: updatedOrdersList.length } }));
            g.dispatchEvent(new Evt('orders-updated', { detail: { order } }));
            g.dispatchEvent(new Evt('customer-hub-updated', { detail: { order } }));
          }
        } catch (_) {}
        return order;
      } catch (e) {
        console.error('Lỗi khi lưu đơn nháp:', e);
        throw e;
      }
    },

    async _deleteFromCloud(id) {
      if (!id) return;
      try {
        if (this.isExtensionAvailable()) {
          chrome.runtime.sendMessage({ action: 'deleteOrderCloud', id: String(id) }, () => {});
        } else {
          const c = this._cloud();
          if (c) {
            if (typeof c.deleteOrder === 'function') await c.deleteOrder(id).catch(() => {});
            if (typeof c.deleteOrderCloud === 'function') await c.deleteOrderCloud(id).catch(() => {});
          }
        }
      } catch (e) {
        console.warn('Lỗi xóa đơn trên cloud:', e);
      }
    },

    async deleteOrder(id) {
      if (!id) return false;
      this._deleteFromCloud(id).catch(() => {});
      const res = await this.deleteBulkOrders([id]);
      return res && res.success > 0;
    },

    async clearAll() {
      const activeShop = await this.getActiveShop();
      const activeShopId = activeShop ? String(activeShop.id || activeShop) : null;
      const allOrders = await this._getOrdersFromLocal();
      
      // Chỉ giữ lại đơn hàng của các Shop khác
      const filteredOrders = allOrders.filter(o => o && String(o.shopId || '') !== (activeShopId || ''));
      
      try {
        await this._saveOrdersToLocal(filteredOrders);
        return true;
      } catch (e) {
        console.error('Lỗi khi xóa toàn bộ đơn hàng:', e);
        return false;
      }
    },

    async getCustomerMetadata() {
      const key = await this._getCustomerMetadataKey();
      return new Promise((resolve) => {
        try {
          if (this.isExtensionAvailable()) {
            chrome.storage.local.get([key], (result) => {
              resolve(result[key] || {});
            });
          } else {
            const data = localStorage.getItem(key);
            try {
              resolve(data ? JSON.parse(data) : {});
            } catch (e) {
              resolve({});
            }
          }
        } catch (e) {
          resolve({});
        }
      });
    },

    saveCustomerMetadata(phone, metadata) {
      return new Promise(async (resolve, reject) => {
        try {
          const key = await this._getCustomerMetadataKey();
          if (typeof phone === 'object' && phone !== null && !metadata) {
            const fullMap = phone;
            if (this.isExtensionAvailable()) {
              chrome.storage.local.set({ [key]: fullMap }, () => resolve(fullMap));
            } else {
              localStorage.setItem(key, JSON.stringify(fullMap));
              resolve(fullMap);
            }
            return;
          }

          const cleanPhone = String(phone || '').replace(/\D/g, '');
          if (!cleanPhone) { resolve({}); return; }
          const allMeta = await this.getCustomerMetadata();
          allMeta[cleanPhone] = { ...allMeta[cleanPhone], ...metadata };
          
          if (this.isExtensionAvailable()) {
            chrome.storage.local.set({ [key]: allMeta }, () => {
              resolve(allMeta[cleanPhone]);
              this._pushCustomerToCloud(cleanPhone, allMeta[cleanPhone]);
            });
          } else {
            localStorage.setItem(key, JSON.stringify(allMeta));
            resolve(allMeta[cleanPhone]);
            this._pushCustomerToCloud(cleanPhone, allMeta[cleanPhone]);
          }
        } catch (e) {
          reject(e);
        }
      });
    },

    async _pushCustomerToCloud(phone, meta) {
      try {
        if (typeof FirebaseCloud !== 'undefined' && FirebaseCloud.isConnected) {
          if (typeof FirebaseCloud.pushCustomerMetadata === 'function') {
            await FirebaseCloud.pushCustomerMetadata(phone, meta);
          }
        }
      } catch (e) {
        console.warn('Lỗi push customer metadata lên cloud:', e);
      }
    },

    async deleteOrder(id) {
      if (!id) return false;
      this._deleteFromCloud(id).catch(() => {});
      const res = await this.deleteBulkOrders([id]);
      return res && res.success > 0;
    },

    async deleteBulkOrders(ids) {
      if (!Array.isArray(ids) || ids.length === 0) return { success: 0, failed: 0 };
      this._invalidateOrdersCache();
      const allOrders = await this._getOrdersFromLocal();
      const strIds = ids.map(id => String(id));
      const filteredOrders = allOrders.filter(o => o && !strIds.includes(String(o.id)) && !strIds.includes(String(o.savedOrderId || '')));
      
      try {
        if (this.isExtensionAvailable()) {
          chrome.runtime.sendMessage({ action: 'deleteBulkOrdersCloud', ids: strIds });
        }
      } catch (_) {}

      try {
        await this._saveOrdersToLocal(filteredOrders);
        this._invalidateOrdersCache();
        try {
          if (this.isExtensionAvailable()) {
            chrome.runtime.sendMessage({ action: 'draftOrdersUpdated', count: filteredOrders.length }).catch(() => {});
          }
        } catch (_) {}
        try {
          const win = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null);
          const Evt = typeof CustomEvent !== 'undefined' ? CustomEvent : (win && win.CustomEvent);
          if (win && typeof win.dispatchEvent === 'function' && Evt) {
            win.dispatchEvent(new Evt('draft-queue-updated', { detail: { count: filteredOrders.length } }));
          }
        } catch (_) {}
        return { success: ids.length, failed: 0 };
      } catch (e) {
        console.error('Lỗi khi xóa hàng loạt đơn hàng:', e);
        return { success: 0, failed: ids.length };
      }
    },

    _cloud() {
      if (typeof SupabaseCloud !== 'undefined') {
        return SupabaseCloud;
      }
      return null;
    },

    async _pushToCloud(order) {
      try {
        if (this.isExtensionAvailable()) {
          chrome.runtime.sendMessage({ action: 'pushOrder', order });
        } else {
          const c = this._cloud();
          if (c) await c.pushOrder(order);
        }
      } catch (e) { console.warn('Cloud push error:', e); }
    },

    async _deleteFromCloud(id) {
      try {
        if (this.isExtensionAvailable()) {
          return new Promise(resolve => {
            chrome.runtime.sendMessage({ action: 'deleteOrder', orderId: id }, () => {
              const err = chrome.runtime.lastError;
              resolve(!err);
            });
          });
        } else {
          const c = this._cloud();
          if (c) await c.deleteOrder(id);
        }
      } catch (e) { console.warn('Cloud delete error:', e); }
    },

    async syncToCloud() {
      const orders = await this.getOrders();
      try {
        if (this.isExtensionAvailable()) {
          return new Promise(resolve => {
            chrome.runtime.sendMessage({ action: 'syncToCloud', orders }, (res) => {
              const err = chrome.runtime.lastError;
              resolve(res || { ok: false, reason: err?.message || 'Connection lost' });
            });
          });
        } else {
          const c = this._cloud();
          if (!c) return { ok: false, reason: 'Firebase chưa được cấu hình' };
          await c.pushOrders(orders);
          const apiKey = configCache.groqApiKey;
          if (apiKey) await c.pushApiKey(apiKey);
          return { ok: true, count: orders.length };
        }
      } catch (e) {
        console.error('Sync to cloud error:', e);
        return { ok: false, reason: e.message };
      }
    },

    async syncFromCloud() {
      try {
        if (this.isExtensionAvailable()) {
          return Promise.race([
            new Promise(resolve => {
              chrome.runtime.sendMessage({ action: 'syncFromCloud' }, async (response) => {
                const lastErr = chrome.runtime.lastError;
                if (lastErr) {
                  resolve({ ok: false, reason: lastErr.message });
                  return;
                }
                if (!response || !response.ok) {
                  resolve({ ok: false, reason: response?.reason || 'Lỗi bất ngờ' });
                  return;
                }
                
                // Đồng bộ customer metadata nếu có
                if (response.customerMetadata) {
                  const localMeta = await this.getCustomerMetadata();
                  const mergedMeta = { ...localMeta, ...response.customerMetadata };
                  const metaKey = await this._getCustomerMetadataKey();
                  chrome.storage.local.set({ [metaKey]: mergedMeta });
                }

                const cloudOrders = response.orders || [];
                const localOrders = await this._getOrdersFromLocal();
                const localMap = new Map(localOrders.map(o => [o.id, o]));
                cloudOrders.forEach(o => { if (!localMap.has(o.id)) localMap.set(o.id, o); });
                let merged = Array.from(localMap.values());
                merged.sort((a,b) => {
                  const tA = Number(a.id?.split('_')[1]) || 0;
                  const tB = Number(b.id?.split('_')[1]) || 0;
                  return tB - tA;
                });
                if (merged.length > 1000) {
                  merged = merged.slice(0, 1000);
                }
                await this._saveOrdersToLocal(merged);
                resolve({ ok: true, count: merged.length - localOrders.length });
              });
            }),
            _timeout(15000)
          ]);
        } else {
          const c = this._cloud();
          if (!c) return { ok: false, reason: 'Firebase chưa được cấu hình' };
          
          const [cloudOrders, cloudMeta] = await Promise.race([
            Promise.all([c.fetchOrders(), c.fetchCustomersMetadata()]),
            _timeout(15000)
          ]);

          if (cloudMeta) {
            const localMeta = await this.getCustomerMetadata();
            const mergedMeta = { ...localMeta, ...cloudMeta };
            const metaKey = await this._getCustomerMetadataKey();
            localStorage.setItem(metaKey, JSON.stringify(mergedMeta));
          }

          if (!Array.isArray(cloudOrders) || cloudOrders.length === 0) return { ok: true, count: 0 };

          const localOrders = await this._getOrdersFromLocal();
          const localMap = new Map(localOrders.map(o => [o.id, o]));
          cloudOrders.forEach(o => { if (!localMap.has(o.id)) localMap.set(o.id, o); });
          let merged = Array.from(localMap.values());
          merged.sort((a,b) => {
            const tA = Number(a.id?.split('_')[1]) || 0;
            const tB = Number(b.id?.split('_')[1]) || 0;
            return tB - tA;
          });
          if (merged.length > 1000) {
            merged = merged.slice(0, 1000);
          }
          await this._saveOrdersToLocal(merged);
          return { ok: true, count: merged.length - localOrders.length };
        }
      } catch (e) {
        console.error('Sync from cloud error:', e);
        return { ok: false, reason: e.message };
      }
    },

    async syncApiKeyFromCloud() {
      const key = await this._getScopedKey('groqApiKey');
      try {
        if (this.isExtensionAvailable()) {
          return Promise.race([
            new Promise(resolve => {
              chrome.runtime.sendMessage({ action: 'fetchApiKey' }, (response) => {
                const lastErr = chrome.runtime.lastError;
                if (lastErr) {
                  resolve(null);
                  return;
                }
                if (response && response.key) {
                  chrome.storage.local.set({ [key]: response.key }, () => resolve(response.key));
                } else {
                  resolve(null);
                }
              });
            }),
            _timeout(10000).catch(() => null)
          ]);
        } else {
          const c = this._cloud();
          if (!c) return null;
          const apiKey = await Promise.race([c.fetchApiKey(), _timeout(10000).catch(() => null)]);
          if (apiKey) {
            localStorage.setItem(key, apiKey);
          }
          return apiKey;
        }
      } catch (e) { console.warn('Sync API key error:', e); return null; }
    },

    async syncAllFromCloud() {
      const [keyResult, orderResult] = await Promise.allSettled([
        this.syncApiKeyFromCloud(),
        this.syncFromCloud()
      ]);
      return {
        apiKey: keyResult.status === 'fulfilled' ? keyResult.value : null,
        orders: orderResult.status === 'fulfilled' ? orderResult.value : { ok: false, reason: 'Timeout' }
      };
    },

    // ─── PARALLEL CLOUD SYNC (3 luồng độc lập, không block UI) ───────────────
    // callbacks: { onApiKeyReady(key), onOrdersReady(result), onCustomersReady(meta) }
    syncAllFromCloudParallel(callbacks = {}) {
      const { onApiKeyReady, onOrdersReady, onCustomersReady } = callbacks;

      // Luồng 1: API Key (ưu tiên cao nhất, nhẹ nhất)
      this.syncApiKeyFromCloud()
        .then(key => { if (typeof onApiKeyReady === 'function') onApiKeyReady(key); })
        .catch(e => console.warn('[Sync] API key stream error:', e));

      // Luồng 2: Orders (tách riêng khỏi customer meta)
      this._syncOrdersOnlyFromCloud()
        .then(result => { if (typeof onOrdersReady === 'function') onOrdersReady(result); })
        .catch(e => console.warn('[Sync] Orders stream error:', e));

      // Luồng 3: Customer metadata (không cần ngay, chạy sau)
      this._syncCustomerMetaOnlyFromCloud()
        .then(meta => { if (typeof onCustomersReady === 'function') onCustomersReady(meta); })
        .catch(e => console.warn('[Sync] Customer meta stream error:', e));
    },

    // Đồng bộ CHỈ orders từ cloud (tách ra để chạy song song với customer meta)
    async _syncOrdersOnlyFromCloud() {
      try {
        if (this.isExtensionAvailable()) {
          return Promise.race([
            new Promise(resolve => {
              chrome.runtime.sendMessage({ action: 'syncFromCloud' }, async (response) => {
                const lastErr = chrome.runtime.lastError;
                if (lastErr) { resolve({ ok: false, reason: lastErr.message }); return; }
                if (!response || !response.ok) { resolve({ ok: false, reason: response?.reason || 'Lỗi bất ngờ' }); return; }

                const cloudOrders = response.orders || [];
                const localOrders = await this._getOrdersFromLocal();
                const localMap = new Map(localOrders.map(o => [o.id, o]));
                cloudOrders.forEach(o => { if (!localMap.has(o.id)) localMap.set(o.id, o); });
                let merged = Array.from(localMap.values());
                merged.sort((a, b) => {
                  const tA = Number(a.id?.split('_')[1]) || 0;
                  const tB = Number(b.id?.split('_')[1]) || 0;
                  return tB - tA;
                });
                if (merged.length > 1000) merged = merged.slice(0, 1000);
                await this._saveOrdersToLocal(merged);
                resolve({ ok: true, count: cloudOrders.length, newCount: merged.length - localOrders.length });
              });
            }),
            _timeout(15000)
          ]);
        } else {
          const c = this._cloud();
          if (!c) return { ok: false, reason: 'Firebase chưa được cấu hình' };
          const cloudOrders = await Promise.race([c.fetchOrders(), _timeout(15000)]);
          if (!Array.isArray(cloudOrders) || cloudOrders.length === 0) return { ok: true, count: 0, newCount: 0 };
          const localOrders = await this._getOrdersFromLocal();
          const localMap = new Map(localOrders.map(o => [o.id, o]));
          cloudOrders.forEach(o => { if (!localMap.has(o.id)) localMap.set(o.id, o); });
          let merged = Array.from(localMap.values());
          merged.sort((a, b) => (Number(b.id?.split('_')[1]) || 0) - (Number(a.id?.split('_')[1]) || 0));
          if (merged.length > 1000) merged = merged.slice(0, 1000);
          await this._saveOrdersToLocal(merged);
          return { ok: true, count: cloudOrders.length, newCount: merged.length - localOrders.length };
        }
      } catch (e) {
        return { ok: false, reason: e.message };
      }
    },

    // ─── SUBMITTED ORDERS (Đơn hàng đã lên đơn) ────────────────────────────
    _submittedKey: 'submittedOrders',

    async _getSubmittedOrdersFromLocal() {
      const key = await this._getSubmittedKey();
      return new Promise(async (resolve) => {
        try {
          const activeShop = await this.getActiveShop().catch(() => null);
          const shopId = activeShop ? (activeShop.id || activeShop) : 'c201e6bc-8986-4f91-b900-e319865d1907';
          const fallbackKey = `submittedOrders_${shopId}`;

          if (this.isExtensionAvailable()) {
            chrome.storage.local.get([key, fallbackKey, 'submittedOrders'], (result) => {
              if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError) {
                resolve([]);
              } else {
                const primary = result[key];
                const fallback = result[fallbackKey];
                const base = result.submittedOrders;
                if (Array.isArray(primary) && primary.length > 0) return resolve(primary);
                if (Array.isArray(fallback) && fallback.length > 0) return resolve(fallback);
                if (Array.isArray(base) && base.length > 0) return resolve(base);
                resolve(primary || fallback || base || []);
              }
            });
          } else {
            const primary = localStorage.getItem(key);
            const fallback = localStorage.getItem(fallbackKey);
            const base = localStorage.getItem('submittedOrders');
            const data = primary || fallback || base;
            resolve(data ? JSON.parse(data) : []);
          }
        } catch (e) {
          resolve([]);
        }
      });
    },

    async _saveSubmittedOrdersToLocal(orders) {
      const key = await this._getSubmittedKey();
      const activeShop = await this.getActiveShop().catch(() => null);
      const shopId = activeShop ? (activeShop.id || activeShop) : 'shop_default';
      const fallbackKey = `submittedOrders_${shopId}`;
      return new Promise((resolve, reject) => {
        try {
          if (this.isExtensionAvailable()) {
            chrome.storage.local.set({ [key]: orders, [fallbackKey]: orders, submittedOrders: orders }, () => {
              if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve();
              }
            });
          } else {
            localStorage.setItem(key, JSON.stringify(orders));
            localStorage.setItem(fallbackKey, JSON.stringify(orders));
            localStorage.setItem('submittedOrders', JSON.stringify(orders));
            resolve();
          }
        } catch (e) {
          reject(e);
        }
      });
    },

    async getSubmittedOrders() {
      const activeShop = await this.getActiveShop();
      const activeShopId = activeShop ? String(activeShop.id || activeShop) : null;
      const rawOrders = await this._getSubmittedOrdersFromLocal();
      
      const localShopOrders = (rawOrders || []).filter(o => {
        if (!o) return false;
        if (!activeShopId) return true;
        const sId = String(o.shopId || o.shop_id || '');
        return sId === activeShopId;
      });
      
      // 1. Thử kéo dữ liệu mới nhất từ Supabase Cloud theo activeShopId
      let cloudOrders = null;
      try {
        if (typeof SupabaseCloud !== 'undefined' && typeof SupabaseCloud.fetchSubmittedOrders === 'function') {
          cloudOrders = await SupabaseCloud.fetchSubmittedOrders(activeShopId);
        } else if (this.isExtensionAvailable()) {
          cloudOrders = await new Promise(resolve => {
            chrome.runtime.sendMessage({ action: 'fetchSubmittedOrders', shopId: activeShopId }, res => {
              resolve(Array.isArray(res) ? res : null);
            });
          });
        }
      } catch (_) {}

      // 2. Nếu lấy được dữ liệu chuẩn từ Cloud, Cloud là nguồn chân lý (Source of Truth)
      let combinedList = [];
      if (Array.isArray(cloudOrders)) {
        (cloudOrders || []).forEach(o => {
          if (o) {
            o.isCloud = true;
            if (activeShopId && (!o.shopId || !o.shop_id)) {
              o.shopId = activeShopId;
              o.shop_id = activeShopId;
            }
          }
        });

        const cloudTrackings = new Set(cloudOrders.map(o => o.trackingCode).filter(Boolean));
        const cloudIds = new Set(cloudOrders.map(o => o.id).filter(Boolean));

        const localOnlyOrders = localShopOrders.filter(o => {
          if (!o) return false;
          if (o.isCloud === true) return false;
          if (cloudIds.has(o.id)) return false;
          if (o.trackingCode && cloudTrackings.has(o.trackingCode)) return false;
          return true;
        });

        combinedList = [...cloudOrders, ...localOnlyOrders];
      } else {
        combinedList = localShopOrders;
      }

      // 3. LỌC BỎ HOÀN TOÀN ĐƠN ẢO & CHỐNG TRÙNG LẶP (Deduplication Engine)
      const cleanList = [];
      const seenTrackings = new Set();
      const seenSubmittedKeys = new Set();

      for (const o of combinedList) {
        if (!o) continue;
        const name = (o.name || '').trim();
        const phone = (o.phone || '').replace(/\D/g, '');
        const tracking = (o.trackingCode || '').trim();
        const orderCode = (o.orderCode || '').trim().toLowerCase();

        // Loại bỏ đơn ảo: Không có Tên (>= 2 ký tự) và Không có SĐT (>= 9 số)
        const isGhost = (!name || name === '—' || name === '-' || name.length < 2) && (!phone || phone.length < 9);
        if (isGhost) continue;

        // Chỉ định danh theo chuẩn bất biến: tracking_code -> saved_order_id -> shop_id + order_code -> id
        // Tuyệt đối không dùng Tên + SĐT làm khóa nhận diện đơn để không xóa nhầm khách mua lại.
        const submittedKey = normalizeSubmittedIdentity(o);
        if (submittedKey && seenSubmittedKeys.has(submittedKey)) continue;
        if (submittedKey) seenSubmittedKeys.add(submittedKey);

        // Chống trùng mã vận đơn
        if (tracking && tracking !== '—' && tracking !== '') {
          if (seenTrackings.has(tracking)) continue;
          seenTrackings.add(tracking);
        }

        cleanList.push(o);
      }

      if (cleanList.length !== (rawOrders || []).length || Array.isArray(cloudOrders)) {
        await this._saveSubmittedOrdersToLocal(cleanList).catch(() => {});
      }

      const shopIsolatedList = cleanList.filter(o => {
        if (!o) return false;
        if (!activeShopId) return true;
        const sId = String(o.shopId || o.shop_id || '');
        return sId === activeShopId;
      });

      // Tự động giải phóng và đẩy các đơn còn tồn đọng trong queue lên Cloud
      this.flushPendingCloudOrders().catch(() => {});

      return shopIsolatedList;
    },

    async updateLatestSubmittedOrderTracking(trackingCode) {
      if (!trackingCode) return false;
      const allSubmitted = await this._getSubmittedOrdersFromLocal();
      const target = (allSubmitted || []).find(o => o && (!o.trackingCode || o.trackingCode === '—' || o.trackingCode === ''));
      if (target) {
        target.trackingCode = trackingCode;
        await this._saveSubmittedOrdersToLocal(allSubmitted);
        this.pushSubmittedOrderToCloud(target).catch(() => {});

        try {
          const logger = typeof recordOrderEvent === 'function' ? recordOrderEvent : (globalThis.recordOrderEvent || null);
          if (logger) {
            logger({
              shopId: target.shopId,
              orderId: target.id,
              orderCode: target.orderCode || trackingCode || target.id,
              eventType: 'TRACKING_RECEIVED',
              actorType: 'CARRIER',
              source: 'carrier_tracking_callback',
              metadata: { trackingCode }
            }).catch(() => {});
          }
        } catch (_) {}

        return true;
      }
      return false;
    },

    async saveSubmittedOrder(order) {
      if (!order) return null;

      const prevLock = _submittingLock;
      let resolveLock;
      _submittingLock = new Promise(r => { resolveLock = r; });
      await prevLock.catch(() => {});

      try {
        order.platform = normalizeCarrierCode(order.platform || order.carrier || order.carrier_id);
        
        const cleanName = (order.name || '').trim();
        const cleanPhone = (order.phone || '').replace(/\D/g, '');
        const cleanTracking = (order.trackingCode || '').trim();
        const cleanOrderCode = (order.orderCode || '').trim();

        // BỎ QUA HOÀN TOÀN ĐƠN ẢO: Không lưu đơn nếu không có Tên (>= 2 ký tự) VÀ không có SĐT (>= 9 số)
        const isValidCustomer = (cleanName && cleanName !== '—' && cleanName !== '-' && cleanName.length >= 2) || (cleanPhone && cleanPhone.length >= 9);
        if (!isValidCustomer) {
          if (cleanTracking && cleanTracking !== '—') {
            await this.updateLatestSubmittedOrderTracking(cleanTracking);
          }
          return null;
        }

        const activeShop = await this.getActiveShop();
        const activeShopId = activeShop ? String(activeShop.id || activeShop) : null;
        
        const allSubmitted = await this._getSubmittedOrdersFromLocal();
        const orders = allSubmitted.filter(o => o && String(o.shopId || '') === (activeShopId || ''));

        // Gắn device name nếu chưa có
        if (!order.deviceName) {
          if (typeof FirebaseCloud !== 'undefined') {
            const cn = FirebaseCloud.deviceName;
            if (cn && cn !== 'Máy không tên' && !cn.startsWith('dev_')) {
              order.deviceName = cn;
            }
          }
          if (!order.deviceName && typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            try {
              const r = await new Promise(res => chrome.storage.local.get(['fbDeviceName'], res));
              if (r.fbDeviceName && r.fbDeviceName !== 'Máy không tên' && !r.fbDeviceName.startsWith('dev_')) {
                order.deviceName = r.fbDeviceName;
              }
            } catch(_) {}
          }
        }
        // Gắn Shop thông tin nếu chưa có
        if (!order.shopId && activeShopId) {
          order.shopId = activeShopId;
          order.shopName = activeShop ? activeShop.name : '';
        }

        // Gắn Carrier Account (Tài khoản/Nick lên đơn trên Bưu điện)
        if (!order.carrierAccount) {
          if (order.carrier_account) {
            order.carrierAccount = order.carrier_account;
          } else if (cleanName) {
            const accMatch = cleanName.match(/\((?:acc|tài khoản|tk)?\s*([^\)]+)\)/i);
            if (accMatch && accMatch[1]) {
              order.carrierAccount = accMatch[1].trim();
            }
          }
        }

        // Gắn thông tin Tài khoản người dùng (Staff/User đăng nhập)
        if (!order.userEmail) {
          try {
            if (typeof AuthSession !== 'undefined' && typeof AuthSession.getSessionSync === 'function') {
              const sess = AuthSession.getSessionSync();
              if (sess?.user?.email) {
                order.userEmail = sess.user.email;
                order.userName = sess.user.user_metadata?.full_name || sess.user.email.split('@')[0];
              }
            }
            if (!order.userEmail && typeof localStorage !== 'undefined') {
              const cachedUser = localStorage.getItem('sb_auth_user');
              if (cachedUser) {
                const u = JSON.parse(cachedUser);
                order.userEmail = u.email || '';
                order.userName = u.full_name || u.name || '';
              }
            }
          } catch (_) {}
        }

        // Tạo ID ổn định (Deterministic Stable ID) để chống trùng lặp
        if (!order.id || String(order.id).startsWith('sub_') || String(order.id).startsWith('sub_1') || String(order.id).startsWith('sub_0')) {
          const stableId = normalizeSubmittedIdentity(order);
          if (stableId && stableId.startsWith('tracking:')) {
            order.id = 'sub_tr_' + stableId.replace('tracking:', '').toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 60);
          } else if (stableId && stableId.startsWith('saved:')) {
            order.id = 'sub_sv_' + stableId.replace('saved:', '').toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 60);
          } else if (stableId && stableId.startsWith('order:')) {
            order.id = 'sub_oc_' + stableId.replace('order:', '').toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 60);
          } else if (!order.id) {
            order.id = 'sub_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
          }
        }

        if (!order.submittedAt) {
          order.submittedAt = new Date().toISOString();
        }
        if (!order.submittedDate) {
          const now = new Date();
          order.submittedDate = now.getFullYear() + '-' +
            String(now.getMonth() + 1).padStart(2, '0') + '-' +
            String(now.getDate()).padStart(2, '0');
        }

        // Chỉ khóa theo định danh của đơn/vận đơn; tuyệt đối không dùng tên + SĐT làm khóa đơn.
        const existing = orders.find(o => isSameSubmittedOrder(o, order));

        let updatedOrdersList = [...orders];
        if (existing) {
          const idx = updatedOrdersList.findIndex(o => o && (o.id === existing.id || (cleanTracking && cleanTracking !== '—' && o.trackingCode === cleanTracking)));
          if (idx !== -1) {
            const updatedOrder = {
              ...updatedOrdersList[idx],
              ...order,
              id: updatedOrdersList[idx].id, // Giữ nguyên ID gốc để không tạo dòng mới trên Database
              codAmount: (Number(order.codAmount) > 0) ? Number(order.codAmount) : updatedOrdersList[idx].codAmount
            };
            if (cleanTracking && cleanTracking !== '—') updatedOrder.trackingCode = cleanTracking;
            updatedOrdersList[idx] = updatedOrder;
            order = updatedOrder;
          }
        } else {
          updatedOrdersList.unshift(order);
        }

        // Giới hạn 500 đơn gần nhất
        if (updatedOrdersList.length > 500) {
          updatedOrdersList.sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));
          updatedOrdersList.length = 500;
        }

      // Tự động đẩy đơn lên cloud
      this.pushSubmittedOrderToCloud(order).catch(() => {});

      // Tự động ghi nhật ký sự kiện vòng đời đơn (Order Event Ledger)
      try {
        const logger = typeof recordOrderEvent === 'function' ? recordOrderEvent : (globalThis.recordOrderEvent || null);
        if (logger) {
          logger({
            shopId: order.shopId || activeShopId,
            orderId: order.id,
            orderCode: order.orderCode || order.trackingCode || order.id,
            eventType: 'ORDER_SAVED',
            actorType: 'USER',
            source: 'carrier_submission',
            afterState: order,
            metadata: {
              platform: order.platform,
              trackingCode: order.trackingCode,
              carrierAccount: order.carrierAccount
            }
          }).catch(() => {});
        }
      } catch (_) {}

      // Tự động xóa đơn tương ứng khỏi danh sách Đơn nháp (savedOrders)
      try {
        const draftOrders = await this.getOrders();
        const targetId = order.savedOrderId || order.id;
        const matchedDrafts = draftOrders.filter(s => {
          if (!s) return false;
          if (targetId && (String(s.id) === String(targetId) || String(s.savedOrderId) === String(targetId))) return true;
          if (order.orderCode && s.orderCode) {
            return String(s.orderCode).trim().toLowerCase() === String(order.orderCode).trim().toLowerCase();
          }
          return false;
        });

        for (const draft of matchedDrafts) {
          if (draft && draft.id) {
            await this.deleteOrder(draft.id).catch(() => {});
          }
        }
      } catch (e) {
        console.warn('Lỗi khi tự động xóa đơn nháp:', e);
      }

      // Hợp nhất với các shop khác
      const otherShopsSubmitted = allSubmitted.filter(o => o && String(o.shopId || '') !== (activeShopId || ''));
      const mergedAllSubmitted = [...updatedOrdersList, ...otherShopsSubmitted];

      await this._saveSubmittedOrdersToLocal(mergedAllSubmitted);
      this._syncCustomerHubOrder(order, 'submitted_order').catch(() => {});

      try {
        if (this.isExtensionAvailable()) {
          chrome.runtime.sendMessage({ 
            type: 'order_submitted', 
            action: 'refresh_orders', 
            orderId: order.id, 
            order 
          }).catch(() => {});
        }
      } catch (_) {}

      try {
        const g = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null);
        const Evt = typeof CustomEvent !== 'undefined' ? CustomEvent : (g && g.CustomEvent);
        if (g && typeof g.dispatchEvent === 'function' && Evt) {
          g.dispatchEvent(new Evt('submitted-orders-updated', { detail: { order } }));
          g.dispatchEvent(new Evt('orders-updated', { detail: { order } }));
          g.dispatchEvent(new Evt('order-saved-db', { detail: { order } }));
          g.dispatchEvent(new Evt('customer-hub-updated', { detail: { order } }));
        }
      } catch (_) {}

      // Ghi nhận Audit Log & Notification khi tạo/lưu đơn đã lên đơn
      if (typeof AuditLogger !== 'undefined' && typeof AuditLogger.logOperation === 'function') {
        AuditLogger.logOperation('ORDER_SUBMITTED', `Lên đơn thành công cho ${order.name || 'Khách hàng'} (${order.orderCode || order.trackingCode || 'Đơn mới'})`, {
          orderId: order.id,
          name: order.name,
          phone: order.phone,
          orderCode: order.orderCode,
          trackingCode: order.trackingCode,
          platform: order.platform,
          codAmount: order.codAmount
        });
      }
      if (typeof NotificationService !== 'undefined' && typeof NotificationService.notify === 'function') {
        NotificationService.notify({
          title: '📦 Đơn hàng đã lên đơn',
          message: `${order.name || 'Khách hàng'} - ${order.orderCode || order.trackingCode || 'Đơn mới'} (${Number(order.codAmount || 0).toLocaleString('vi-VN')}đ)`,
          category: 'ORDERS',
          level: 'SUCCESS'
        });
      }

      return order;
    } catch (e) {
      throw e;
    } finally {
      if (typeof resolveLock === 'function') resolveLock();
    }
  },

    async updateSubmittedOrderTracking(savedOrderId, trackingCode) {
      if (!savedOrderId || !trackingCode) return false;
      const allSubmitted = await this._getSubmittedOrdersFromLocal();
      const order = allSubmitted.find(o => o && (o.savedOrderId === savedOrderId || o.id === savedOrderId));
      if (order) {
        order.trackingCode = trackingCode;
        this.pushSubmittedOrderToCloud(order).catch(() => {});
        await this._saveSubmittedOrdersToLocal(allSubmitted);
      }

      // Cập nhật trực tiếp các bảng `submitted_orders` và `history` trên Supabase Cloud
      try {
        if (typeof SupabaseCloud !== 'undefined' && SupabaseCloud.init) {
          const sb = SupabaseCloud.init();
          if (sb && savedOrderId) {
            // Update table submitted_orders
            await sb.from('submitted_orders').update({ tracking_code: trackingCode }).or(`id.eq.${savedOrderId},saved_order_id.eq.${savedOrderId}`);

            // Update table history
            const { data: currentRecord } = await sb.from('history').select('result').eq('id', savedOrderId).single();
            let updatePayload = { waybill_code: trackingCode };
            if (currentRecord && currentRecord.result) {
              let resObj = typeof currentRecord.result === 'string' ? JSON.parse(currentRecord.result) : currentRecord.result;
              resObj.waybillCode = trackingCode;
              updatePayload.result = resObj;
            }
            await sb.from('history').update(updatePayload).eq('id', savedOrderId);
          }
        }
      } catch (err) {
        console.warn('[updateSubmittedOrderTracking] Lỗi cập nhật Supabase:', err);
      }

      const key = await this._getSubmittedKey();
      return new Promise((resolve) => {
        try {
          if (this.isExtensionAvailable()) {
            chrome.storage.local.set({ [key]: allSubmitted }, () => {
              resolve(!(chrome.runtime && chrome.runtime.lastError));
            });
          } else {
            localStorage.setItem(key, JSON.stringify(allSubmitted));
            resolve(true);
          }
        } catch (e) { resolve(false); }
      });
    },

    async updateSubmittedOrderData(savedOrderId, fields) {
      const orders = await this.getSubmittedOrders();
      const order = orders.find(o => o.savedOrderId === savedOrderId || o.id === savedOrderId);
      if (order) {
        Object.assign(order, fields);
      }
      return new Promise((resolve) => {
        try {
          if (this.isExtensionAvailable()) {
            chrome.storage.local.set({ [this._submittedKey]: orders }, () => {
              resolve(!(chrome.runtime && chrome.runtime.lastError));
            });
          } else {
            localStorage.setItem(this._submittedKey, JSON.stringify(orders));
            resolve(true);
          }
        } catch (e) { resolve(false); }
      });
    },

    async deleteSubmittedOrder(id) {
      if (!id) return false;
      const strId = String(id);

      // 1. Xóa trên Supabase Cloud
      try {
        if (typeof SupabaseCloud !== 'undefined' && typeof SupabaseCloud.deleteSubmittedOrderCloud === 'function') {
          await SupabaseCloud.deleteSubmittedOrderCloud(strId);
        } else if (this.isExtensionAvailable()) {
          await new Promise(resolve => {
            chrome.runtime.sendMessage({ action: 'deleteSubmittedOrderCloud', orderId: strId }, () => {
              resolve(true);
            });
          });
        }
      } catch (err) {
        console.warn('Lỗi xóa submitted order trên cloud:', err);
      }

      // 2. Lọc bỏ đơn trong local storage theo đúng scoped key
      const allSubmitted = await this._getSubmittedOrdersFromLocal();
      const targetOrder = (allSubmitted || []).find(o => o && (String(o.id) === strId || String(o.savedOrderId || '') === strId));
      const filtered = (allSubmitted || []).filter(o => o && String(o.id) !== strId && String(o.savedOrderId || '') !== strId);

      await this._saveSubmittedOrdersToLocal(filtered);

      // 3. Ghi nhận Audit Log & Notification
      try {
        if (typeof AuditLogger !== 'undefined' && typeof AuditLogger.logAudit === 'function') {
          AuditLogger.logAudit('ORDER_DELETE', `Đã xóa đơn hàng ${targetOrder?.name || ''} (${targetOrder?.orderCode || targetOrder?.trackingCode || strId})`, {
            orderId: strId,
            orderName: targetOrder?.name,
            orderCode: targetOrder?.orderCode,
            trackingCode: targetOrder?.trackingCode
          });
        }
        if (typeof NotificationService !== 'undefined' && typeof NotificationService.notify === 'function') {
          NotificationService.notify({
            title: '🗑️ Đã xóa đơn hàng',
            message: `${targetOrder?.name || 'Khách hàng'} - ${targetOrder?.trackingCode || targetOrder?.orderCode || strId}`,
            category: 'ORDERS',
            level: 'INFO'
          });
        }
      } catch (_) {}

      return true;
    },

    // ─── SHOP MANAGEMENT (QUẢN LÝ ĐA SHOP) ───────────────────────────────────
    _shopsKey: 'shopsList',
    _activeShopKey: 'activeShopId',

    async getShops() {
      const shopsKey = await this._getShopsKey();
      return new Promise(async (resolve) => {
        try {
          let user = null;
          if (typeof AuthService !== 'undefined') {
            user = await AuthService.getCurrentUser();
          } else if (typeof AuthSession !== 'undefined') {
            user = await AuthSession.getUser();
          }

          let list = [];
          if (this.isExtensionAvailable()) {
            const res = await new Promise(res => chrome.storage.local.get([shopsKey], res));
            list = res[shopsKey] || [];
          } else {
            const raw = localStorage.getItem(shopsKey);
            list = raw ? JSON.parse(raw) : [];
          }

          // Lọc danh sách Shop chỉ thuộc về tài khoản đã đăng nhập
          if (user && user.id) {
            // 1. Nếu trong local storage đã có danh sách shop từ Database đồng bộ về
            if (Array.isArray(list) && list.length > 0 && list.some(s => s.id && !s.id.startsWith('shop_e612d44b3e'))) {
              resolve(list);
              return;
            }

            // 2. Thử truy vấn từ Supabase nếu client đã khởi tạo
            if (typeof AuthService !== 'undefined' && typeof AuthService.getSupabaseClient === 'function') {
              const sb = AuthService.getSupabaseClient();
              if (sb) {
                try {
                  const { data: cloudShops } = await sb.from('shops')
                    .select('*')
                    .is('deleted_at', null);

                  if (cloudShops && cloudShops.length > 0) {
                    const formattedCloud = cloudShops.map((s, index) => ({
                      id: s.id,
                      name: s.name,
                      owner_id: s.owner_id || user.id,
                      senderName: s.sender_name || '',
                      senderPhone: s.sender_phone || '',
                      senderAddress: s.sender_address || '',
                      senderProvince: s.sender_province || '',
                      senderDistrict: s.sender_district || '',
                      senderWard: s.sender_ward || '',
                      orderCodePrefix: s.order_code_prefix || 'DH',
                      isDefault: index === 0,
                      createdAt: s.created_at
                    }));
                    if (this.isExtensionAvailable()) {
                      chrome.storage.local.set({ [shopsKey]: formattedCloud }, () => {});
                    } else {
                      localStorage.setItem(shopsKey, JSON.stringify(formattedCloud));
                    }
                    resolve(formattedCloud);
                    return;
                  }
                } catch (_) {}
              }
            }

            // 3. Fallback chỉ khi hoàn toàn không có kết nối DB
            const userDefaultShop = {
              id: 'c201e6bc-8986-4f91-b900-e319865d1907',
              name: 'Shop Hệ Thống (Yến Lũa)',
              owner_id: user.id,
              owner_email: user.email,
              senderName: '',
              senderPhone: '',
              senderAddress: '',
              senderProvince: '',
              senderDistrict: '',
              senderWard: '',
              orderCodePrefix: 'DH',
              isDefault: true,
              createdAt: new Date().toISOString()
            };

            if (this.isExtensionAvailable()) {
              chrome.storage.local.set({ [shopsKey]: [userDefaultShop] }, () => resolve([userDefaultShop]));
            } else {
              localStorage.setItem(shopsKey, JSON.stringify([userDefaultShop]));
              resolve([userDefaultShop]);
            }
            return;
          }

          // Trường hợp không có user đăng nhập (Offline / Unauthenticated local mode)
          if (list.length === 0) {
            const defaultShop = {
              id: 'c201e6bc-8986-4f91-b900-e319865d1907',
              name: 'Shop Mặc Định',
              owner_id: null,
              senderName: '',
              senderPhone: '',
              senderAddress: '',
              senderProvince: '',
              senderDistrict: '',
              senderWard: '',
              orderCodePrefix: '',
              isDefault: true,
              createdAt: new Date().toISOString()
            };
            if (this.isExtensionAvailable()) {
              chrome.storage.local.set({ [shopsKey]: [defaultShop] }, () => resolve([defaultShop]));
            } else {
              localStorage.setItem(shopsKey, JSON.stringify([defaultShop]));
              resolve([defaultShop]);
            }
          } else {
            resolve(list);
          }
        } catch (e) {
          resolve([]);
        }
      });
    },

    async getActiveShop() {
      const allowedShops = await this.getShops();
      if (!allowedShops || allowedShops.length === 0) return null;

      const activeShopKey = await this._getActiveShopKey();

      if (typeof AuthSession !== 'undefined') {
        try {
          const sId = await AuthSession.getActiveShop();
          if (sId) {
            const found = allowedShops.find(s => String(s.id) === String(sId));
            if (found) {
              if (this.isExtensionAvailable()) {
                chrome.storage.local.set({ [activeShopKey]: String(sId) }, () => {});
              } else {
                localStorage.setItem(activeShopKey, String(sId));
              }
              return found;
            }
          }
        } catch (_) {}
      }

      let activeId = null;
      if (this.isExtensionAvailable()) {
        activeId = await new Promise(res => chrome.storage.local.get([activeShopKey, 'current_shop_id', 'activeShopId'], r => {
          res(r ? (r[activeShopKey] || r['current_shop_id'] || r['activeShopId']) : null);
        }));
      } else {
        activeId = localStorage.getItem(activeShopKey) || localStorage.getItem('current_shop_id') || localStorage.getItem('activeShopId');
      }

      if (activeId) {
        const found = allowedShops.find(s => String(s.id) === String(activeId));
        if (found) return found;
      }

      // Tự động gán về Shop hợp lệ duy nhất/đầu tiên mà tài khoản có quyền truy cập
      const defaultShop = allowedShops.find(s => s.isDefault) || allowedShops[0];
      if (defaultShop) {
        if (this.isExtensionAvailable()) {
          chrome.storage.local.set({ [activeShopKey]: String(defaultShop.id) }, () => {});
        } else {
          localStorage.setItem(activeShopKey, String(defaultShop.id));
        }
        return defaultShop;
      }
      return null;
    },

    async setActiveShop(shopId) {
      if (!shopId) return false;
      const allowedShops = await this.getShops();
      const isAllowed = allowedShops.some(s => String(s.id) === String(shopId));
      if (!isAllowed) {
        console.warn('⚠️ Từ chối chuyển Shop: Tài khoản không có quyền truy cập Cửa hàng này!');
        return false;
      }
      const activeShopKey = await this._getActiveShopKey();
      if (typeof AuthSession !== 'undefined' && typeof AuthSession.updateActiveShop === 'function') {
        await AuthSession.updateActiveShop(String(shopId));
      }
      return new Promise((resolve) => {
        try {
          if (this.isExtensionAvailable()) {
            chrome.storage.local.set({ [activeShopKey]: String(shopId) }, () => {
              this.getActiveShop().then(shop => {
                configCache.activeShop = shop;
                resolve(true);
              }).catch(() => resolve(true));
            });
          } else {
            localStorage.setItem(activeShopKey, String(shopId));
            this.getActiveShop().then(shop => {
              configCache.activeShop = shop;
              resolve(true);
            }).catch(() => resolve(true));
          }
        } catch (e) { resolve(false); }
      });
    },

    async saveShop(shopData) {
      if (!shopData) return null;
      let user = null;
      if (typeof AuthService !== 'undefined') {
        user = await AuthService.getCurrentUser();
      } else if (typeof AuthSession !== 'undefined') {
        user = await AuthSession.getUser();
      }
      if (user && user.id) {
        shopData.owner_id = user.id;
        shopData.owner_email = user.email;
      }

      const shops = await this.getShops();
      if (!shopData.id) {
        shopData.id = 'shop_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
        shopData.createdAt = new Date().toISOString();
      }
      if (shopData.isDefault) {
        shops.forEach(s => s.isDefault = false);
      }
      const idx = shops.findIndex(s => String(s.id) === String(shopData.id));
      if (idx !== -1) {
        shops[idx] = { ...shops[idx], ...shopData };
      } else {
        shops.unshift(shopData);
      }
      const shopsKey = await this._getShopsKey();
      await new Promise(resolve => {
        if (this.isExtensionAvailable()) {
          chrome.storage.local.set({ [shopsKey]: shops }, () => resolve());
        } else {
          localStorage.setItem(shopsKey, JSON.stringify(shops));
          resolve();
        }
      });
      return shopData;
    },

    async deleteShop(shopId) {
      if (!shopId) return false;
      const shops = await this.getShops();
      if (shops.length <= 1) return false;
      const filtered = shops.filter(s => String(s.id) !== String(shopId));
      if (filtered.length > 0 && !filtered.some(s => s.isDefault)) {
        filtered[0].isDefault = true;
      }
      const shopsKey = await this._getShopsKey();
      await new Promise(resolve => {
        if (this.isExtensionAvailable()) {
          chrome.storage.local.set({ [shopsKey]: filtered }, () => resolve());
        } else {
          localStorage.setItem(shopsKey, JSON.stringify(filtered));
          resolve();
        }
      });
      return true;
    },

    async deleteBulkSubmittedOrders(ids) {
      const allSubmitted = await this._getSubmittedOrdersFromLocal();
      const filtered = allSubmitted.filter(o => !ids.includes(o.id));
      try {
        if (this.isExtensionAvailable()) {
          await new Promise(resolve => {
            chrome.runtime.sendMessage({ action: 'deleteBulkSubmittedOrdersCloud', ids: ids }, () => {
              const err = chrome.runtime.lastError;
              resolve(!err);
            });
          });
        }
      } catch (_) {}
      
      try {
        await this._saveSubmittedOrdersToLocal(filtered);
        return { success: ids.length, failed: 0 };
      } catch (e) {
        return { success: 0, failed: ids.length };
      }
    },

    async clearSubmittedOrders() {
      const activeShop = await this.getActiveShop();
      const activeShopId = activeShop ? String(activeShop.id || activeShop) : null;
      const allSubmitted = await this._getSubmittedOrdersFromLocal();
      
      // Chỉ giữ lại đơn của shop khác
      const filtered = allSubmitted.filter(o => o && String(o.shopId || '') !== (activeShopId || ''));
      
      try {
        await this._saveSubmittedOrdersToLocal(filtered);
        return true;
      } catch (e) {
        return false;
      }
    },

    // Đồng bộ CHỈ customer metadata từ cloud
    async _syncCustomerMetaOnlyFromCloud() {
      try {
        if (this.isExtensionAvailable()) {
          return Promise.race([
            new Promise(resolve => {
              chrome.runtime.sendMessage({ action: 'syncFromCloud' }, async (response) => {
                const lastErr = chrome.runtime.lastError;
                if (lastErr) { resolve(null); return; }
                if (!response?.ok || !response.customerMetadata) { resolve(null); return; }
                const localMeta = await this.getCustomerMetadata();
                const mergedMeta = { ...localMeta, ...response.customerMetadata };
                const metaKey = await this._getCustomerMetadataKey();
                chrome.storage.local.set({ [metaKey]: mergedMeta }, () => resolve(mergedMeta));
              });
            }),
            _timeout(15000)
          ]);
        } else {
          const c = this._cloud();
          if (!c || typeof c.fetchCustomersMetadata !== 'function') return null;
          const cloudMeta = await Promise.race([c.fetchCustomersMetadata(), _timeout(15000)]);
          if (!cloudMeta) return null;
          const localMeta = await this.getCustomerMetadata();
          const mergedMeta = { ...localMeta, ...cloudMeta };
          const metaKey = await this._getCustomerMetadataKey();
          localStorage.setItem(metaKey, JSON.stringify(mergedMeta));
          return mergedMeta;
        }
      } catch (e) {
        return null;
      }
    },

    async _autoSyncCustomerFromOrder(order) {
      if (!order) return;
      try {
        const rawName = (order.name || order.customer_name || '').trim();
        const rawPhone = (order.phone || '').trim();
        const cleanPhone = rawPhone.replace(/\D/g, '');
        const key = cleanPhone ? cleanPhone : (rawName ? rawName.toLowerCase() : '');
        if (!key || key === '—' || key === '-') return;

        const meta = {
          name: rawName || 'Khách hàng',
          phone: rawPhone || '—',
          cleanPhone: cleanPhone,
          address: order.address || '—',
          note: order.note || ''
        };

        await this.saveCustomerMetadata(key, meta).catch(() => {});

        const customerObj = {
          phone: rawPhone || cleanPhone || '—',
          cleanPhone: cleanPhone,
          name: rawName || 'Khách hàng',
          address: order.address || '—',
          count: 1,
          totalCod: Number(order.codAmount || order.cod_amount || 0),
          latestDate: order.submittedAt || order.createdAt || new Date().toISOString(),
          favCarrier: order.platform || '',
          notes: order.note || ''
        };

        if (typeof SupabaseCloud !== 'undefined' && typeof SupabaseCloud.pushCustomersCloud === 'function') {
          SupabaseCloud.pushCustomersCloud([customerObj]).catch(() => {});
        } else if (this.isExtensionAvailable()) {
          chrome.runtime.sendMessage({ action: 'pushCustomersCloud', customers: [customerObj] }, () => {});
        }
      } catch (_) {}
    },

    async _syncCustomerHubOrder(order, sourceType = 'order') {
      if (!order?.shopId || !order?.phone) return null;
      try {
        const params = {
          p_shop_id: order.shopId,
          p_source_type: sourceType,
          p_source_order_id: String(order.id || order.savedOrderId || order.orderCode || ''),
          p_phone: order.phone || '',
          p_name: order.name || order.customer_name || '',
          p_address: order.address || '',
          p_order_code: order.orderCode || order.order_code || '',
          p_tracking_code: order.trackingCode || order.tracking_code || '',
          p_carrier: normalizeCarrierCode(order.platform || order.carrier || ''),
          p_status: order.status || (sourceType === 'submitted_order' ? 'success' : 'pending'),
          p_cod_amount: Number(order.codAmount || order.cod_amount || 0),
          p_ordered_at: order.submittedAt || order.createdAt || new Date().toISOString()
        };
        if (typeof SupabaseCloud !== 'undefined' && typeof SupabaseCloud.rpc === 'function') {
          return await SupabaseCloud.rpc('customer_hub_sync_order', params);
        }
        if (this.isExtensionAvailable()) {
          return await new Promise(resolve => chrome.runtime.sendMessage({ action: 'customerHubSyncOrder', params }, response => resolve(response?.data || null)));
        }
      } catch (error) {
        console.warn('[CustomerHubMetric]', { event: 'order_sync_failed', sourceType, orderId: order.id, error: error.message });
      }
      return null;
    },

    async _getPendingOfflineQueue() {
      return new Promise(resolve => {
        try {
          if (this.isExtensionAvailable()) {
            chrome.storage.local.get(['pending_submitted_orders_queue'], r => {
              resolve(Array.isArray(r.pending_submitted_orders_queue) ? r.pending_submitted_orders_queue : []);
            });
          } else {
            const raw = localStorage.getItem('pending_submitted_orders_queue');
            resolve(raw ? JSON.parse(raw) : []);
          }
        } catch (_) { resolve([]); }
      });
    },

    async _enqueuePendingCloudOrder(order) {
      if (!order) return;
      try {
        const queue = await this._getPendingOfflineQueue();
        const exists = queue.some(o => isSameSubmittedOrder(o, order));
        if (!exists) {
          queue.push({ ...order, queuedAt: Date.now() });
          if (this.isExtensionAvailable()) {
            chrome.storage.local.set({ pending_submitted_orders_queue: queue });
          } else {
            localStorage.setItem('pending_submitted_orders_queue', JSON.stringify(queue));
          }
        }
      } catch (_) {}
    },

    async _dequeuePendingCloudOrder(order) {
      if (!order) return;
      try {
        const queue = await this._getPendingOfflineQueue();
        const filtered = queue.filter(o => !isSameSubmittedOrder(o, order));
        if (this.isExtensionAvailable()) {
          chrome.storage.local.set({ pending_submitted_orders_queue: filtered });
        } else {
          localStorage.setItem('pending_submitted_orders_queue', JSON.stringify(filtered));
        }
      } catch (_) {}
    },

    async flushPendingCloudOrders() {
      const queue = await this._getPendingOfflineQueue();
      if (!Array.isArray(queue) || queue.length === 0) return { ok: true, count: 0 };
      try {
        const res = await this.pushSubmittedOrdersToCloud(queue);
        if (res && res.ok) {
          if (this.isExtensionAvailable()) {
            chrome.storage.local.set({ pending_submitted_orders_queue: [] });
          } else {
            localStorage.setItem('pending_submitted_orders_queue', JSON.stringify([]));
          }
          return { ok: true, count: queue.length };
        }
        return { ok: false, count: 0, reason: res?.reason };
      } catch (err) {
        return { ok: false, count: 0, reason: err.message };
      }
    },

    async pushSubmittedOrderToCloud(order) {
      if (!order) return false;
      try {
        let ok = false;
        if (this.isExtensionAvailable()) {
          ok = await new Promise(resolve => {
            chrome.runtime.sendMessage({ action: 'pushSubmittedOrder', order }, (res) => {
              const lastErr = chrome.runtime.lastError;
              resolve(!lastErr && res && res.ok === true);
            });
          });
        } else {
          const c = this._cloud();
          if (!c || typeof c.pushSubmittedOrder !== 'function') return false;
          ok = await c.pushSubmittedOrder(order);
        }

        if (ok) {
          await this._dequeuePendingCloudOrder(order);
        } else {
          await this._enqueuePendingCloudOrder(order);
        }
        return ok;
      } catch (e) {
        await this._enqueuePendingCloudOrder(order);
        return false;
      }
    },

    async pushSubmittedOrdersToCloud(orders) {
      if (!Array.isArray(orders) || orders.length === 0) return { ok: true, count: 0 };
      try {
        if (this.isExtensionAvailable()) {
          return new Promise(resolve => {
            chrome.runtime.sendMessage({ action: 'pushSubmittedOrders', orders }, (res) => {
              const lastErr = chrome.runtime.lastError;
              resolve({ ok: !lastErr && !(res && res.error), count: orders.length, reason: res?.error });
            });
          });
        } else {
          const c = this._cloud();
          if (!c || typeof c.pushSubmittedOrders !== 'function') return { ok: false, reason: 'Chưa kết nối Cloud' };
          await c.pushSubmittedOrders(orders);
          return { ok: true, count: orders.length };
        }
      } catch (e) { return { ok: false, reason: e.message }; }
    },

    async syncSubmittedOrdersToCloud() {
      const orders = await this.getSubmittedOrders();
      return this.pushSubmittedOrdersToCloud(orders);
    },

    async syncSubmittedOrdersFromCloud() {
      try {
        const getOrderKey = (o) => {
          if (!o) return null;
          const tracking = (o.trackingCode || o.tracking_code || '').trim().toUpperCase();
          if (tracking && tracking !== '—' && tracking !== '-') return 'track_' + tracking;
          const code = (o.orderCode || o.order_code || '').trim().toLowerCase();
          if (code && code !== '—' && code !== '-') return 'code_' + code;
          const savedId = o.savedOrderId || o.saved_order_id || '';
          if (savedId && savedId !== '—' && savedId !== '-') return 'saved_' + savedId;
          const id = o.id || '';
          if (id) return 'id_' + id;
          return null;
        };

        if (this.isExtensionAvailable()) {
          return Promise.race([
            new Promise(resolve => {
              chrome.runtime.sendMessage({ action: 'fetchSubmittedOrders' }, async (response) => {
                const lastErr = chrome.runtime.lastError;
                if (lastErr) { resolve({ ok: false, reason: lastErr.message }); return; }
                const cloudOrders = Array.isArray(response) ? response : (response?.orders || []);
                const localOrders = await this.getSubmittedOrders();

                const map = new Map();
                (localOrders || []).forEach(o => { const key = getOrderKey(o); if (key) map.set(key, o); });
                (cloudOrders || []).forEach(co => {
                  if (!co) return;
                  const k = getOrderKey(co);
                  if (!k) {
                    console.warn('[OrderStorage] Bỏ qua submitted order không có identity ổn định.');
                    return;
                  }
                  if (map.has(k)) {
                    const existing = map.get(k);
                    map.set(k, { ...existing, ...co });
                  } else {
                    map.set(k, co);
                  }
                });

                let merged = Array.from(map.values());
                merged.sort((a, b) => new Date(b.submittedAt || b.submitted_at || 0) - new Date(a.submittedAt || a.submitted_at || 0));
                if (merged.length > 500) merged = merged.slice(0, 500);

                // Push merged list back to cloud to guarantee 100% cloud sync
                chrome.runtime.sendMessage({ action: 'pushSubmittedOrders', orders: merged }, () => {});

                chrome.storage.local.set({ [this._submittedKey]: merged }, () => {
                  resolve({ ok: true, count: cloudOrders.length, newCount: merged.length - localOrders.length });
                });
              });
            }),
            _timeout(15000)
          ]);
        } else {
          const c = this._cloud();
          if (!c || typeof c.fetchSubmittedOrders !== 'function') return { ok: false, reason: 'Cloud chưa được cấu hình' };
          const cloudOrders = await Promise.race([c.fetchSubmittedOrders(), _timeout(15000)]);
          const localOrders = await this.getSubmittedOrders();

          const map = new Map();
          (localOrders || []).forEach(o => { const key = getOrderKey(o); if (key) map.set(key, o); });
          (Array.isArray(cloudOrders) ? cloudOrders : []).forEach(co => {
            if (!co) return;
            const k = getOrderKey(co);
            if (!k) {
              console.warn('[OrderStorage] Bỏ qua submitted order không có identity ổn định.');
              return;
            }
            if (map.has(k)) {
              const existing = map.get(k);
              map.set(k, { ...existing, ...co });
            } else {
              map.set(k, co);
            }
          });

          let merged = Array.from(map.values());
          merged.sort((a, b) => new Date(b.submittedAt || b.submitted_at || 0) - new Date(a.submittedAt || a.submitted_at || 0));
          if (merged.length > 500) merged = merged.slice(0, 500);

          if (c && typeof c.pushSubmittedOrders === 'function') {
            c.pushSubmittedOrders(merged).catch(() => {});
          }

          localStorage.setItem(this._submittedKey, JSON.stringify(merged));
          return { ok: true, count: (cloudOrders || []).length, newCount: merged.length - localOrders.length };
        }
      } catch (e) { return { ok: false, reason: e.message }; }
    },

    async purgeAndResyncCleanState() {
      try {
        // 1. Lấy dữ liệu đơn hiện có trên Extension làm chuẩn
        const localSubmitted = await this.getSubmittedOrders();
        const cleanOrders = (typeof deduplicateSubmittedOrdersList === 'function')
          ? deduplicateSubmittedOrdersList(localSubmitted)
          : localSubmitted;

        // 2. Tải dữ liệu khách hàng từ Supabase Cloud gộp vào Extension
        let cloudHist = [];
        let cloudSub = [];
        try {
          if (this.isExtensionAvailable()) {
            [cloudHist, cloudSub] = await Promise.all([
              new Promise(res => chrome.runtime.sendMessage({ action: 'fetchHistory' }, res)),
              new Promise(res => chrome.runtime.sendMessage({ action: 'fetchSubmittedOrders' }, res))
            ]);
          }
        } catch (_) {}

        const customerMap = await this.getCustomerMetadata().catch(() => ({}));
        [...(Array.isArray(cloudHist) ? cloudHist : []), ...(Array.isArray(cloudSub) ? cloudSub : []), ...cleanOrders].forEach(o => {
          if (!o) return;
          const res = o.result || {};
          const name = o.customer_name || o.name || res.name || res.recipientName || '';
          const phone = o.phone || res.phone || res.recipientPhone || '';
          const address = o.address || res.address || res.normalizedAddress || '';
          const key = phone ? phone.trim() : name.trim().toLowerCase();
          if (key && key !== '—' && !customerMap[key]) {
            customerMap[key] = { name, phone, address, note: '' };
          }
        });
        await this.saveCustomerMetadata(customerMap).catch(() => {});

        // 3. Xóa toàn bộ dữ liệu cũ trên bảng submitted_orders của Supabase Cloud
        if (typeof SupabaseCloud !== 'undefined' && typeof SupabaseCloud.clearSubmittedOrdersCloud === 'function') {
          await SupabaseCloud.clearSubmittedOrdersCloud();
        } else if (this.isExtensionAvailable()) {
          await new Promise(res => chrome.runtime.sendMessage({ action: 'clearSubmittedOrdersCloud' }, res));
        }

        // 4. Đẩy lại các đơn chuẩn từ Extension lên Supabase Cloud
        if (typeof SupabaseCloud !== 'undefined' && typeof SupabaseCloud.pushSubmittedOrders === 'function') {
          await SupabaseCloud.pushSubmittedOrders(cleanOrders);
        } else if (this.isExtensionAvailable()) {
          await new Promise(res => chrome.runtime.sendMessage({ action: 'pushSubmittedOrders', orders: cleanOrders }, res));
        }

        // 5. Lưu lại danh sách đơn chuẩn vào local storage
        if (this.isExtensionAvailable()) {
          await new Promise(res => chrome.storage.local.set({ [this._submittedKey]: cleanOrders }, res));
        } else {
          localStorage.setItem(this._submittedKey, JSON.stringify(cleanOrders));
        }

        return { ok: true, count: cleanOrders.length };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    },

    async masterResetSupabaseWithExtensionData() {
      try {
        // 1. Lấy dữ liệu 12 đơn đã lên đơn chuẩn từ Extension làm gốc
        const localSubmitted = await this.getSubmittedOrders();
        const cleanSubmitted = (typeof deduplicateSubmittedOrdersList === 'function')
          ? deduplicateSubmittedOrdersList(localSubmitted)
          : localSubmitted;

        const customerMetadataMap = await this.getCustomerMetadata().catch(() => ({}));
        const rawLocalHistory = await this.getOrders().catch(() => []);

        // 2. Làm sạch hoàn toàn Lịch sử & Khách hàng — chỉ giữ các đơn chuẩn + khách hàng hợp lệ
        const cleanCustomerMap = {};
        const cleanHistoryList = [];
        const processedKeys = new Set();

        // 2a. Đưa 12 đơn đã lên đơn chuẩn vào danh sách Khách hàng & Lịch sử
        cleanSubmitted.forEach(o => {
          if (!o) return;
          const name = (o.name || o.customer_name || '').trim();
          const phone = (o.phone || '').trim();
          const cleanPhone = phone.replace(/\D/g, '');
          const address = (o.address || '').trim();
          const key = cleanPhone ? cleanPhone : name.toLowerCase();
          
          if (key && key !== '—' && key !== '-') {
            cleanCustomerMap[key] = {
              name: name || '—',
              phone: phone || '—',
              address: address || '—',
              note: o.note || ''
            };
            if (!processedKeys.has(key)) {
              processedKeys.add(key);
              cleanHistoryList.push({
                id: o.savedOrderId || ('hist_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6)),
                customer_name: name || 'Khách hàng',
                phone: phone || '',
                address: address || '',
                order_code: o.orderCode || '',
                waybill_code: o.trackingCode || o.waybillCode || '',
                cod_amount: Number(o.codAmount || 0),
                created_at: o.submittedAt || new Date().toISOString(),
                platform: o.platform || 'vnpost',
                result: { name, phone, address }
              });
            }
          }
        });

        // 2b. Bổ sung các khách hàng hợp lệ có sẵn trong metadata (ví dụ: đăng phát ( acc nhựt lũa ), Cá cảnh gò Vấp)
        Object.entries(customerMetadataMap || {}).forEach(([metaKey, metaVal]) => {
          if (!metaVal) return;
          const isPhone = /^\d+$/.test(metaKey.replace(/\D/g, '')) && metaKey.replace(/\D/g, '').length >= 8;
          const phone = isPhone ? metaKey.trim() : (metaVal.phone || '').trim();
          const cleanPhone = phone.replace(/\D/g, '');
          const rawName = metaVal.name || metaVal.customer_name || metaVal.latestName || (!isPhone ? metaKey : '') || metaVal.notes || metaVal.note || '';
          const name = String(rawName).trim();
          const key = cleanPhone ? cleanPhone : (name ? name.toLowerCase() : '');
          
          if (key && key !== '—' && key !== '-') {
            if (!cleanCustomerMap[key]) {
              cleanCustomerMap[key] = {
                name: name || '—',
                phone: phone || '—',
                address: metaVal.address || '—',
                note: metaVal.notes || metaVal.note || ''
              };
            }
          }
        });

        // 2c. Bổ sung từ rawLocalHistory nếu có khách tên hợp lệ (có họ tên rõ ràng)
        rawLocalHistory.forEach(h => {
          if (!h) return;
          const res = h.result || {};
          const name = (h.customer_name || h.name || res.name || res.recipientName || '').trim();
          const phone = (h.phone || res.phone || res.recipientPhone || '').trim();
          const cleanPhone = phone.replace(/\D/g, '');
          const key = cleanPhone ? cleanPhone : name.toLowerCase();

          if (key && key !== '—' && key !== '-' && name && name.length > 1) {
            if (!cleanCustomerMap[key]) {
              cleanCustomerMap[key] = {
                name: name,
                phone: phone || '—',
                address: h.address || res.address || '—',
                note: ''
              };
            }
            if (!processedKeys.has(key)) {
              processedKeys.add(key);
              cleanHistoryList.push({
                id: h.id || ('hist_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6)),
                customer_name: name,
                phone: phone || '',
                address: h.address || res.address || '',
                cod_amount: Number(h.cod_amount || h.codAmount || 0),
                created_at: h.created_at || h.createdAt || new Date().toISOString(),
                platform: h.platform || 'vnpost',
                result: res
              });
            }
          }
        });

        // 3. Cập nhật lại bộ nhớ Extension Cục Bộ với dữ liệu đã làm sạch 100%
        await this.saveCustomerMetadata(cleanCustomerMap).catch(() => {});
        if (this.isExtensionAvailable()) {
          await new Promise(res => chrome.storage.local.set({ 
            [this._submittedKey]: cleanSubmitted
          }, res));
        } else {
          localStorage.setItem(this._submittedKey, JSON.stringify(cleanSubmitted));
        }
        this._invalidateOrdersCache();

        // 4. Xóa sạch TOÀN BỘ dữ liệu rác cũ trên Supabase Cloud (bảng submitted_orders & history)
        if (typeof SupabaseCloud !== 'undefined' && typeof SupabaseCloud.clearAllCloudData === 'function') {
          await SupabaseCloud.clearAllCloudData();
        } else if (this.isExtensionAvailable()) {
          await new Promise(res => chrome.runtime.sendMessage({ action: 'clearAllCloudData' }, res));
        }

        // 5. Đẩy dữ liệu ĐÃ LÀM SẠCH CHUẨN từ Extension lên Supabase Cloud
        if (cleanSubmitted.length > 0) {
          if (typeof SupabaseCloud !== 'undefined' && typeof SupabaseCloud.pushSubmittedOrders === 'function') {
            await SupabaseCloud.pushSubmittedOrders(cleanSubmitted);
          } else if (this.isExtensionAvailable()) {
            await new Promise(res => chrome.runtime.sendMessage({ action: 'pushSubmittedOrders', orders: cleanSubmitted }, res));
          }
        }

        if (cleanHistoryList.length > 0) {
          if (typeof SupabaseCloud !== 'undefined' && typeof SupabaseCloud.pushHistory === 'function') {
            await SupabaseCloud.pushHistory(cleanHistoryList);
          } else if (this.isExtensionAvailable()) {
            await new Promise(res => chrome.runtime.sendMessage({ action: 'pushHistory', entries: cleanHistoryList }, res));
          }
        }

        const cleanCustomerList = Object.values(cleanCustomerMap);
        if (cleanCustomerList.length > 0) {
          if (typeof SupabaseCloud !== 'undefined' && typeof SupabaseCloud.pushCustomersCloud === 'function') {
            await SupabaseCloud.pushCustomersCloud(cleanCustomerList);
          } else if (this.isExtensionAvailable()) {
            await new Promise(res => chrome.runtime.sendMessage({ action: 'pushCustomersCloud', customers: cleanCustomerList }, res));
          }
        }

        const totalCustCount = cleanCustomerList.length;
        return { ok: true, submittedCount: cleanSubmitted.length, historyCount: cleanHistoryList.length, customerCount: totalCustCount };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    }

  };

  OrderStorage.initCache();

  globalThis.configCache = configCache;
  globalThis.OrderStorage = OrderStorage;
