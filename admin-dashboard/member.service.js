// =========================================================================
// MEMBER.SERVICE.JS — DỊCH VỤ QUẢN LÝ THÀNH VIÊN SHOP (MEMBER SERVICE)
// =========================================================================

const MemberService = {
  async getShopMembers(shopId) {
    if (!shopId) {
      const activeShop = typeof ShopService !== 'undefined' ? await ShopService.getActiveShop() : null;
      if (!activeShop) return [];
      shopId = activeShop.id;
    }

    // Không dựng thành viên giả khi chưa có Shop hợp lệ.
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(shopId);
    if (!isUuid) {
      return [];
    }

    try {
      const { url, anonKey } = typeof AuthService !== 'undefined'
        ? await AuthService._getSupabaseUrlAndKey()
        : { url: '', anonKey: '' };

      if (url && anonKey) {
        const endpoint = `${url.replace(/\/$/, '')}/rest/v1/shop_members?shop_id=eq.${shopId}&select=*,profiles(*)`;
        const resp = await fetch(endpoint, {
          headers: {
            'apikey': anonKey,
            'Authorization': `Bearer ${anonKey}`
          }
        });
        if (resp.ok) {
          return await resp.json();
        }
      }
    } catch (e) {
      console.warn('[MemberService] Lỗi getShopMembers:', e);
    }

    return [];
  },

  async addMember(shopId, userId, role = 'SHOP_STAFF', permissions = []) {
    try {
      const { url, anonKey } = typeof AuthService !== 'undefined'
        ? await AuthService._getSupabaseUrlAndKey()
        : { url: '', anonKey: '' };

      if (url && anonKey) {
        const endpoint = `${url.replace(/\/$/, '')}/rest/v1/shop_members`;
        const resp = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'apikey': anonKey,
            'Authorization': `Bearer ${anonKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({
            shop_id: shopId,
            user_id: userId,
            role,
            status: 'active'
          })
        });
        if (resp.ok) {
          return await resp.json();
        }
      }
    } catch (e) {
      console.error('[MemberService] Lỗi addMember:', e);
    }
    return null;
  },

  async removeMember(memberId) {
    try {
      const { url, anonKey } = typeof AuthService !== 'undefined'
        ? await AuthService._getSupabaseUrlAndKey()
        : { url: '', anonKey: '' };

      if (url && anonKey) {
        const endpoint = `${url.replace(/\/$/, '')}/rest/v1/shop_members?id=eq.${memberId}`;
        const resp = await fetch(endpoint, {
          method: 'DELETE',
          headers: {
            'apikey': anonKey,
            'Authorization': `Bearer ${anonKey}`
          }
        });
        return resp.ok;
      }
    } catch (e) {
      console.error('[MemberService] Lỗi removeMember:', e);
    }
    return false;
  }
};

globalThis.MemberService = MemberService;
