import { AuthSession } from '../auth/auth.session.js';

/**
 * Admin Repository - Lớp tương tác trực tiếp với Supabase Database qua REST API
 * (Data Layer - Không chứa Business Logic)
 */
export class AdminRepository {
  /**
   * Lấy cấu hình Supabase Cloud an toàn
   */
  static async _getConfig() {
    if (!globalThis.SupabaseCloud) throw new Error('SupabaseCloud context not found');
    return await globalThis.SupabaseCloud.loadConfig();
  }

  /**
   * Sinh Headers chuẩn 3-part JWT cho Admin
   */
  static async _getAuthHeaders(configRes) {
    const sess = await AuthSession.getSession().catch(() => null);
    const anonKey = (configRes?.anonKey || '').trim();
    const headers = { 'Content-Type': 'application/json' };
    
    if (anonKey) {
      headers['apikey'] = anonKey;
    }
  
    const userToken = sess?.access_token;
    if (typeof userToken === 'string' && userToken.split('.').length === 3) {
      headers['Authorization'] = `Bearer ${userToken}`;
    } else if (typeof anonKey === 'string' && anonKey.split('.').length === 3) {
      headers['Authorization'] = `Bearer ${anonKey}`;
    }
  
    return headers;
  }

  static async _getAdminId() {
    const sess = await AuthSession.getSession().catch(() => null);
    return sess?.user?.id;
  }

  /**
   * Ghi log Audit Admin
   */
  static async insertAuditLog(action, targetId, targetType, beforeState, afterState, result = 'SUCCESS') {
    try {
      const configRes = await this._getConfig();
      const headers = await this._getAuthHeaders(configRes);
      const adminId = await this._getAdminId();

      if (!adminId) return; // Bỏ qua nếu không lấy được Admin ID

      const payload = {
        admin_id: adminId,
        action: action,
        target_id: String(targetId),
        target_type: targetType,
        before_state: beforeState,
        after_state: afterState,
        result: result,
      };

      const res = await fetch(`${configRes.url}/rest/v1/admin_audit_logs`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) console.warn("Lỗi ghi Admin Audit Log:", await res.text());
    } catch (e) {
      console.warn("Lỗi ghi Admin Audit Log:", e);
    }
  }

  /**
   * Gọi RPC get_admin_kpis
   */
  static async getKpis() {
    const configRes = await this._getConfig();
    const headers = await this._getAuthHeaders(configRes);

    const res = await fetch(`${configRes.url}/rest/v1/rpc/get_admin_kpis`, {
      method: 'POST',
      headers: headers
    });

    if (!res.ok) {
      throw new Error(`RPC get_admin_kpis Failed: ${res.status} - ${await res.text()}`);
    }

    return await res.json();
  }

  /**
   * Lấy danh sách Shops (Tenant)
   */
  static async getShops() {
    const configRes = await this._getConfig();
    const headers = await this._getAuthHeaders(configRes);

    const res = await fetch(`${configRes.url}/rest/v1/shops?select=*&order=created_at.desc`, {
      method: 'GET',
      headers: headers
    });

    if (!res.ok) throw new Error(`Fetch Shops Failed: ${res.status}`);
    return await res.json();
  }

  /**
   * Lấy danh sách người dùng
   */
  static async getUsers() {
    const configRes = await this._getConfig();
    const headers = await this._getAuthHeaders(configRes);

    const res = await fetch(`${configRes.url}/rest/v1/profiles?select=*&order=created_at.desc`, {
      method: 'GET',
      headers: headers
    });

    if (!res.ok) throw new Error(`Fetch Users Failed: ${res.status}`);
    return await res.json();
  }
}
