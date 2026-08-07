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
    
    if (!token || !user) return false;

    try {
      // Gọi RPC hoặc join table (shop_members -> shops)
      const endpoint = `${url.replace(/\/$/, '')}/rest/v1/shop_members?user_id=eq.${user.id}&select=shops(*)`;
      const resp = await fetch(endpoint, {
        headers: {
          'apikey': anonKey,
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!resp.ok) return false;
      const data = await resp.json();
      
      const cloudShops = data.map(item => item.shops).filter(Boolean);
      
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
          owner_id: s.owner_id,
          supabaseShopId: s.id
        }));
        
        // Lưu đè danh sách shop xuống local theo đúng ID user (đã cấu hình trong OrderStorage)
        const key = await OrderStorage._getShopsKey();
        await new Promise(resolve => {
          chrome.storage.local.set({ [key]: localShops }, resolve);
        });

        // Set active shop nếu chưa có
        const active = await OrderStorage.getActiveShop();
        if (!active && localShops.length > 0) {
          await OrderStorage.setActiveShop(localShops[0].id);
        }
        return true;
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
