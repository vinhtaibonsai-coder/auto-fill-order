// =========================================================================
// SHOP.SERVICE.JS — DỊCH VỤ QUẢN LÝ CỬA HÀNG (SHOP SERVICE)
// =========================================================================

const ShopService = {
  async getShops() {
    if (typeof OrderStorage !== 'undefined' && typeof OrderStorage.getShops === 'function') {
      return await OrderStorage.getShops();
    }
    return [];
  },

  async syncShopsFromCloud() {
    const { url, anonKey } = typeof AuthService !== 'undefined'
      ? await AuthService._getSupabaseUrlAndKey()
      : { url: '', anonKey: '' };
    
    if (!url || !anonKey) return false;

    const token = typeof AuthSession !== 'undefined' ? AuthSession._cachedToken || (await AuthSession.getSession())?.access_token : null;
    const user = typeof AuthService !== 'undefined' ? await AuthService.getCurrentUser() : null;
    
    if (!user) return false;
    const authHeader = token ? `Bearer ${token}` : `Bearer ${anonKey}`;

    try {
      const isSystemAdmin = user.email === 'admin@luathuysinh.vn' || user.email?.startsWith('admin@');
      
      // 1. Truy vấn đồng thời cả 3 nguồn trên Supabase Cloud
      const [allShopsRes, ownerRes, memberRes] = await Promise.all([
        isSystemAdmin ? fetch(`${url.replace(/\/$/, '')}/rest/v1/shops?select=*`, {
          headers: { 'apikey': anonKey, 'Authorization': authHeader }
        }).catch(() => null) : null,
        fetch(`${url.replace(/\/$/, '')}/rest/v1/shops?owner_id=eq.${user.id}&select=*`, {
          headers: { 'apikey': anonKey, 'Authorization': authHeader }
        }).catch(() => null),
        fetch(`${url.replace(/\/$/, '')}/rest/v1/shop_members?user_id=eq.${user.id}&select=*,shops(*)`, {
          headers: { 'apikey': anonKey, 'Authorization': authHeader }
        }).catch(() => null)
      ]);

      const allShops = (allShopsRes && allShopsRes.ok) ? await allShopsRes.json().catch(() => []) : [];
      const ownerShops = (ownerRes && ownerRes.ok) ? await ownerRes.json().catch(() => []) : [];
      const memberData = (memberRes && memberRes.ok) ? await memberRes.json().catch(() => []) : [];
      const memberShops = (memberData || []).map(item => item.shops).filter(Boolean);

      // Gộp và loại trùng danh sách shop theo ID thực từ Database
      const shopMap = new Map();
      [...allShops, ...ownerShops, ...memberShops].forEach(s => {
        if (s && s.id && !shopMap.has(String(s.id))) {
          shopMap.set(String(s.id), s);
        }
      });
      const cloudShops = Array.from(shopMap.values());

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
          isDefault: index === 0,
          owner_id: s.owner_id || user.id,
          supabaseShopId: s.id
        }));
        
        // Lưu đè danh sách shop chuẩn xuống local theo đúng ID user
        const key = await OrderStorage._getShopsKey();
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          await new Promise(resolve => {
            chrome.storage.local.set({ [key]: localShops }, resolve);
          });
        } else {
          localStorage.setItem(key, JSON.stringify(localShops));
        }

        // Set active shop nếu chưa có hoặc đang trỏ tới shop không tồn tại
        const active = await OrderStorage.getActiveShop();
        const exists = active && localShops.some(s => String(s.id) === String(active.id));
        if (!exists && localShops.length > 0) {
          await OrderStorage.setActiveShop(localShops[0].id);
        }
        return true;
      } else if (cloudShops.length === 0 && typeof OrderStorage !== 'undefined') {
        // Nếu trên Cloud chưa có Shop nào, lấy shop local của user và tự động tạo lên Cloud
        const localShops = await OrderStorage.getShops();
        if (localShops && localShops.length > 0) {
          const shopToPush = localShops[0];
          await this.createShop(shopToPush);
        }
      }
    } catch (e) {
      console.warn('[ShopService] Lỗi đồng bộ shops:', e);
    }
    return false;
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
            'Authorization': `Bearer ${anonKey}`,
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
