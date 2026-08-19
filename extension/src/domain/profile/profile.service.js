// =========================================================================
// PROFILE.SERVICE.JS — DỊCH VỤ QUẢN LÝ HỒ SƠ NGƯỜI DÙNG
// =========================================================================

const ProfileService = {
  async getProfile(userId) {
    if (typeof AuthService !== 'undefined' && typeof AuthService.fetchUserProfile === 'function') {
      return await AuthService.fetchUserProfile(userId);
    }
    return null;
  },

  async updateProfile(userId, updates) {
    const { url, anonKey } = typeof AuthService !== 'undefined'
      ? await AuthService._getSupabaseUrlAndKey()
      : { url: '', anonKey: '' };
      
    if (!url || !anonKey || !userId) return false;

    try {
      const endpoint = `${url.replace(/\/$/, '')}/rest/v1/profiles?id=eq.${userId}`;
      const resp = await fetch(endpoint, {
        method: 'PATCH',
        headers: {
          'apikey': anonKey,
          'Authorization': `Bearer ${anonKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          ...updates,
          updated_at: new Date().toISOString()
        })
      });

      if (resp.ok) {
        const rows = await resp.json();
        if (rows && rows.length > 0) {
          if (typeof AuthSession !== 'undefined') {
            await AuthSession.saveUser(rows[0]);
          }
          return rows[0];
        }
      }
    } catch (e) {
      console.warn('[ProfileService] Lỗi updateProfile:', e);
    }
    return false;
  }
};

if (typeof globalThis !== 'undefined') {
  globalThis.ProfileService = ProfileService;
}
