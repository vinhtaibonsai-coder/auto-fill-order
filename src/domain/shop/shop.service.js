// =========================================================================
// SHOP.SERVICE.JS — DỊCH VỤ QUẢN LÝ CỬA HÀNG (SHOP SERVICE)
// =========================================================================

const ShopService = {
  _sortShopsForDefault(shops) {
    return [...(shops || [])].sort((a, b) => {
      const aTime = a?.created_at ? Date.parse(a.created_at) || 0 : 0;
      const bTime = b?.created_at ? Date.parse(b.created_at) || 0 : 0;
      if (aTime !== bTime) return aTime - bTime;
      return String(a?.id || '').localeCompare(String(b?.id || ''));
    });
  },

  async getShops() {
    if (typeof OrderStorage !== 'undefined' && typeof OrderStorage.getShops === 'function') {
      return await OrderStorage.getShops();
    }
    return [];
  },

  _syncPromise: null,
  _lastSyncTime: 0,

  async syncShopsFromCloud(force = false) {
    // If a sync is already in flight, return the same promise to prevent concurrent network floods
    if (this._syncPromise) {
      return this._syncPromise;
    }

    const now = Date.now();
    if (!force && now - this._lastSyncTime < 3000) {
      return true;
    }

    this._syncPromise = (async () => {
      try {
        const { url, anonKey } = typeof AuthService !== 'undefined'
          ? await AuthService._getSupabaseUrlAndKey()
          : { url: '', anonKey: '' };
        
        if (!url || !anonKey) return false;

        const token = typeof AuthSession !== 'undefined' ? AuthSession._cachedToken || (await AuthSession.getSession())?.access_token : null;
        const user = typeof AuthService !== 'undefined' ? await AuthService.getCurrentUser() : null;
        
        if (!user) return false;
        const authHeader = token ? `Bearer ${token}` : `Bearer ${anonKey}`;

        const isSystemAdmin = user.email === 'admin@luathuysinh.vn' || user.email?.startsWith('admin@');
        const activeShopId = typeof AuthSession !== 'undefined' ? (await AuthSession.getSession().catch(() => null))?.active_shop_id : null;
        
        // 1. Truy vấn đồng thời các nguồn trên Supabase Cloud
        const [allShopsRes, ownerRes, memberRes, activeShopRes] = await Promise.all([
          isSystemAdmin ? fetch(`${url.replace(/\/$/, '')}/rest/v1/shops?select=*&order=created_at.asc,id.asc`, {
            headers: { 'apikey': anonKey, 'Authorization': authHeader }
          }).catch(() => null) : null,
          fetch(`${url.replace(/\/$/, '')}/rest/v1/shops?owner_id=eq.${user.id}&select=*&order=created_at.asc,id.asc`, {
            headers: { 'apikey': anonKey, 'Authorization': authHeader }
          }).catch(() => null),
          fetch(`${url.replace(/\/$/, '')}/rest/v1/shop_members?user_id=eq.${user.id}&select=*,shops(*)&order=created_at.asc`, {
            headers: { 'apikey': anonKey, 'Authorization': authHeader }
          }).catch(() => null),
          activeShopId ? fetch(`${url.replace(/\/$/, '')}/rest/v1/shops?id=eq.${encodeURIComponent(activeShopId)}&select=*`, {
            headers: { 'apikey': anonKey, 'Authorization': authHeader }
          }).catch(() => null) : null
        ]);

        const queryResponses = [
          isSystemAdmin ? allShopsRes : null,
          ownerRes,
          memberRes,
          activeShopRes
        ].filter(Boolean);

        // Kiểm tra phản hồi mạng: nếu TẤT CẢ request đều lỗi hoặc mất kết nối -> Bỏ qua đồng bộ
        const hasAnySuccess = queryResponses.some(r => r && r.ok);
        if (!hasAnySuccess) {
          console.warn('[ShopService] Lỗi kết nối hoặc phản hồi không hợp lệ từ Cloud. Bỏ qua đồng bộ.');
          return false;
        }

        const allShops = (allShopsRes && allShopsRes.ok) ? await allShopsRes.json().catch(() => []) : [];
        const ownerShops = (ownerRes && ownerRes.ok) ? await ownerRes.json().catch(() => []) : [];
        const memberData = (memberRes && memberRes.ok) ? await memberRes.json().catch(() => []) : [];
        const activeShops = (activeShopRes && activeShopRes.ok) ? await activeShopRes.json().catch(() => []) : [];
        const memberShops = (memberData || []).map(item => item.shops).filter(Boolean);

        // Gộp và loại trùng danh sách shop theo ID thực từ Database
        const shopMap = new Map();
        [...allShops, ...ownerShops, ...memberShops, ...activeShops].forEach(s => {
          if (s && s.id && !shopMap.has(String(s.id))) {
            shopMap.set(String(s.id), s);
          }
        });
        const cloudShops = this._sortShopsForDefault(Array.from(shopMap.values()));

        // Nếu không tìm thấy shop nào trên Cloud mà có request bị lỗi HTTP -> Bỏ qua để tránh tạo đè shop offline
        const hadAnyFailure = queryResponses.some(r => !r || !r.ok);
        if (cloudShops.length === 0 && hadAnyFailure) {
          console.warn('[ShopService] Không tải được đầy đủ danh sách shop từ Cloud. Bỏ qua đồng bộ.');
          return false;
        }

        if (cloudShops.length > 0 && typeof OrderStorage !== 'undefined') {
          const localShops = cloudShops.map((s, index) => ({
            id: s.id,
            name: s.name,
            orderCodePrefix: s.order_code_prefix || 'DH',
            senderName: s.sender_name || '',
            senderPhone: s.sender_phone || '',
            senderAddress: s.sender_address || '',
            vnpostCustomerCode: s.vnpost_customer_code || '',
            jtContractCode: s.jt_contract_code || '',
            shopBankName: s.bank_name || '',
            shopBankAcc: s.bank_account_no || '',
            default_package_weight: Number(s.default_package_weight) || 0,
            default_package_note: s.default_package_note || '',
            order_defaults: s.order_defaults || {},
            isDefault: index === 0,
            owner_id: s.owner_id || user.id,
            supabaseShopId: s.id
          }));
          
          // Lưu đè danh sách shop chuẩn xuống local theo đúng ID user
          const key = await OrderStorage._getShopsKey();
          let currentLocalJson = '';
          if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            const existing = await new Promise(r => chrome.storage.local.get([key], r));
            currentLocalJson = JSON.stringify(existing?.[key] || []);
            const newLocalJson = JSON.stringify(localShops);
            if (currentLocalJson !== newLocalJson) {
              await new Promise(resolve => {
                chrome.storage.local.set({ [key]: localShops }, resolve);
              });
            }
          } else {
            currentLocalJson = localStorage.getItem(key) || '';
            const newLocalJson = JSON.stringify(localShops);
            if (currentLocalJson !== newLocalJson) {
              localStorage.setItem(key, newLocalJson);
            }
          }

          // Set active shop nếu chưa có hoặc đang trỏ tới shop không tồn tại
          const currentActive = await OrderStorage.getActiveShop().catch(() => null);
          const currentValid = currentActive && localShops.some(s => String(s.id) === String(currentActive.id));
          if (!currentValid && localShops.length > 0) {
            await OrderStorage.setActiveShop(localShops[0].id);
            if (typeof AuthSession !== 'undefined' && typeof AuthSession.updateActiveShop === 'function') {
              await AuthSession.updateActiveShop(localShops[0].id);
            }
          }

          const effectiveActive = (currentValid ? currentActive : localShops[0]) || null;
          if (effectiveActive) {
            const activeCloud = cloudShops.find(s => String(s.id) === String(effectiveActive.id)) || effectiveActive;
            const pkgWeight = Number(activeCloud.default_package_weight) || 0;
            if (pkgWeight > 0) {
              const pkgWeightKg = pkgWeight >= 10 ? (pkgWeight / 1000) : pkgWeight;
              if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.set({
                  default_package_weight: pkgWeight,
                  default_weight_vnpost: pkgWeight,
                  default_weight_jt: pkgWeightKg,
                  default_package_note: activeCloud.default_package_note || ''
                }, () => {});
              }
              try {
                localStorage.setItem('default_package_weight', String(pkgWeight));
                localStorage.setItem('default_weight_vnpost', String(pkgWeight));
                localStorage.setItem('default_weight_jt', String(pkgWeightKg));
                if (activeCloud.default_package_note) localStorage.setItem('default_package_note', activeCloud.default_package_note);
              } catch (_) {}
            }
          }
          this._lastSyncTime = Date.now();
          return true;
        } else if (cloudShops.length === 0 && typeof OrderStorage !== 'undefined') {
          // Nếu trên Cloud chưa có Shop nào, lấy shop local của user và tự động tạo lên Cloud
          const localShops = await OrderStorage.getShops();
          if (localShops && localShops.length > 0) {
            const shopToPush = localShops[0];
            // CHỈ đẩy lên Cloud nếu shop này thực sự là shop offline (không có supabaseShopId)
            // và không phải là shop mặc định hệ thống (tránh tự động nhân bản trùng lặp)
            if (shopToPush && !shopToPush.supabaseShopId && shopToPush.id !== 'c201e6bc-8986-4f91-b900-e319865d1907') {
              await this.createShop(shopToPush);
            }
          }
          this._lastSyncTime = Date.now();
        }
      } catch (e) {
        console.warn('[ShopService] Lỗi đồng bộ shops:', e);
      } finally {
        this._syncPromise = null;
      }
      return false;
    })();

    return this._syncPromise;
  },

  async getActiveShop() {
    if (typeof OrderStorage !== 'undefined' && typeof OrderStorage.getActiveShop === 'function') {
      return await OrderStorage.getActiveShop();
    }
    return null;
  },

  async setActiveShop(shopId) {
    if (typeof OrderStorage !== 'undefined' && typeof OrderStorage.setActiveShop === 'function') {
      return await OrderStorage.setActiveShop(shopId);
    }
    return false;
  },

  async createShop(shopData) {
    const { url, anonKey } = typeof AuthService !== 'undefined'
      ? await AuthService._getSupabaseUrlAndKey()
      : { url: '', anonKey: '' };

    const currentUser = typeof AuthService !== 'undefined' ? await AuthService.getCurrentUser() : null;
    const userId = currentUser ? currentUser.id : null;

    // Lấy token thật của người dùng để thực hiện request dưới tư cách chính họ (tránh lỗi RLS)
    const token = typeof AuthSession !== 'undefined'
      ? AuthSession._cachedToken || (await AuthSession.getSession())?.access_token
      : null;
    const authHeader = token ? `Bearer ${token}` : `Bearer ${anonKey}`;

    // 1. Lưu local storage
    let savedShop = null;
    if (typeof OrderStorage !== 'undefined') {
      savedShop = await OrderStorage.saveShop(shopData);
    }

    // 2. Đẩy lên Supabase `shops` table nếu kết nối
    if (url && anonKey && savedShop) {
      try {
        const endpoint = `${url.replace(/\/$/, '')}/rest/v1/shops`;
        const resp = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'apikey': anonKey,
            'Authorization': authHeader,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({
            name: savedShop.name,
            owner_id: userId || '00000000-0000-0000-0000-000000000000',
            sender_name: savedShop.senderName,
            sender_phone: savedShop.senderPhone,
            sender_address: savedShop.senderAddress,
            order_code_prefix: savedShop.orderCodePrefix || 'DH',
            bank_name: savedShop.shopBankName,
            bank_account_no: savedShop.shopBankAcc
          })
        });
        if (resp.ok) {
          const rows = await resp.json();
          if (rows && rows.length > 0) {
            savedShop.supabaseShopId = rows[0].id;
            await OrderStorage.saveShop(savedShop);
          }
        }
      } catch (e) {
        console.warn('[ShopService] Lỗi push shop lên Supabase:', e);
      }
    }

    return savedShop;
  },

  async deleteShop(shopId) {
    const { url, anonKey } = typeof AuthService !== 'undefined'
      ? await AuthService._getSupabaseUrlAndKey()
      : { url: '', anonKey: '' };
    const token = typeof AuthSession !== 'undefined' ? AuthSession._cachedToken || (await AuthSession.getSession())?.access_token : null;
    
    let deletedLocal = false;
    if (typeof OrderStorage !== 'undefined') {
      const shop = (await OrderStorage.getShops()).find(s => String(s.id) === String(shopId));
      if (url && anonKey && token && shop && shop.supabaseShopId) {
        try {
          await fetch(`${url.replace(/\/$/, '')}/rest/v1/shops?id=eq.${shop.supabaseShopId}`, {
            method: 'DELETE',
            headers: {
              'apikey': anonKey,
              'Authorization': `Bearer ${token}`
            }
          });
        } catch(e) {}
      }
      deletedLocal = await OrderStorage.deleteShop(shopId);
    }
    return deletedLocal;
  }
};

if (typeof globalThis !== 'undefined') {
  globalThis.ShopService = ShopService;
}
