// =========================================================================
// INVITE.SERVICE.JS — DỊCH VỤ TẠO & XÁC THỰC MÃ MỜI SHOP (INVITE CODES)
// =========================================================================

const InviteService = {
  async generateInviteCode(shopId, role = 'staff', maxUsage = 100, durationDays = 7) {
    const activeShop = shopId ? { id: shopId } : await ShopService.getActiveShop();
    const shopName = activeShop ? (activeShop.name || 'SHOP') : 'SHOP';
    
    // Sinh mã mời chuẩn: VD YENSHOP-A9E2
    const prefix = shopName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8) || 'SHOP';
    const randomSuffix = Math.random().toString(36).substr(2, 4).toUpperCase();
    const code = `${prefix}-${randomSuffix}`;

    const expiredAt = new Date();
    expiredAt.setDate(expiredAt.getDate() + durationDays);

    const inviteData = {
      id: 'inv_' + Date.now(),
      shopId: activeShop ? activeShop.id : 'default_shop',
      code,
      role,
      maxUsage,
      used: 0,
      expiredAt: expiredAt.toISOString(),
      createdAt: new Date().toISOString()
    };

    // Đẩy lên Supabase bảng `invite_codes` nếu có kết nối
    try {
      const { url, anonKey } = typeof AuthService !== 'undefined'
        ? await AuthService._getSupabaseUrlAndKey()
        : { url: '', anonKey: '' };
        
      if (url && anonKey) {
        const currentUser = typeof AuthService !== 'undefined' ? await AuthService.getCurrentUser() : null;
        await fetch(`${url.replace(/\/$/, '')}/rest/v1/invite_codes`, {
          method: 'POST',
          headers: {
            'apikey': anonKey,
            'Authorization': `Bearer ${anonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            shop_id: inviteData.shopId,
            code: inviteData.code,
            role: inviteData.role,
            max_usage: inviteData.maxUsage,
            expired_at: inviteData.expiredAt,
            created_by: currentUser ? currentUser.id : '00000000-0000-0000-0000-000000000000'
          })
        });
      }
    } catch (e) {
      console.warn('[InviteService] Lỗi khi lưu invite code lên Supabase:', e);
    }

    return inviteData;
  },

  async validateInviteCode(code) {
    if (!code) return { valid: false, reason: 'Mã mời không được để trống' };

    try {
      const { url, anonKey } = typeof AuthService !== 'undefined'
        ? await AuthService._getSupabaseUrlAndKey()
        : { url: '', anonKey: '' };

      if (url && anonKey) {
        const endpoint = `${url.replace(/\/$/, '')}/rest/v1/invite_codes?code=eq.${encodeURIComponent(code.trim())}&select=*`;
        const resp = await fetch(endpoint, {
          headers: {
            'apikey': anonKey,
            'Authorization': `Bearer ${anonKey}`
          }
        });

        if (resp.ok) {
          const rows = await resp.json();
          if (rows && rows.length > 0) {
            const inv = rows[0];
            if (new Date(inv.expired_at) < new Date()) {
              return { valid: false, reason: 'Mã mời đã hết hạn' };
            }
            if (inv.used >= inv.max_usage) {
              return { valid: false, reason: 'Mã mời đã hết lượt sử dụng' };
            }
            return { valid: true, invite: inv };
          }
        }
      }
    } catch (e) {
      console.warn('[InviteService] Lỗi khi xác thực mã mời:', e);
    }

    return { valid: false, reason: 'Không tìm thấy mã mời hợp lệ trên hệ thống' };
  }
};

if (typeof globalThis !== 'undefined') {
  globalThis.InviteService = InviteService;
}
