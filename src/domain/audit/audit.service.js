// =========================================================================
// AUDIT.SERVICE.JS — DỊCH VỤ GHI NHẬT KÝ KIỂM TOÁN (AUDIT LOGS)
// =========================================================================

const AuditService = {
  async logAction(action, targetResource, targetId = null, payload = null) {
    try {
      if (typeof AuthSession === 'undefined' || typeof AuthService === 'undefined') return false;

      const session = await AuthSession.getSession();
      if (!session || !session.user) return false;

      const { url, anonKey } = await AuthService._getSupabaseUrlAndKey();
      if (!url || !anonKey) return false;

      const endpoint = `${url.replace(/\/$/, '')}/rest/v1/audit_logs`;
      await fetch(endpoint, {
        method: 'POST',
        headers: {
          'apikey': anonKey,
          'Authorization': `Bearer ${session.access_token || anonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          shop_id: session.active_shop_id,
          user_id: session.user.id,
          action: action,
          target_resource: targetResource,
          target_id: targetId,
          payload: payload,
          user_agent: navigator.userAgent
        })
      });

      return true;
    } catch (e) {
      console.warn('[AuditService] Lỗi logAction:', e);
    }
    return false;
  }
};

if (typeof globalThis !== 'undefined') {
  globalThis.AuditService = AuditService;
}
