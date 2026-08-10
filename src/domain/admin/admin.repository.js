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

  /**
   * Lấy danh sách Shops dạng tổng hợp cho Admin Dashboard (Phase 2)
   */
  static async getShopsList() {
    const configRes = await this._getConfig();
    const headers = await this._getAuthHeaders(configRes);

    const res = await fetch(`${configRes.url}/rest/v1/rpc/get_admin_shops_list`, {
      method: 'POST',
      headers: headers
    });

    if (!res.ok) {
      throw new Error(`RPC get_admin_shops_list Failed: ${res.status} - ${await res.text()}`);
    }

    return await res.json();
  }

  /**
   * Cập nhật trạng thái Shop
   */
  static async updateShopStatus(shopId, status) {
    const configRes = await this._getConfig();
    const headers = await this._getAuthHeaders(configRes);

    const res = await fetch(`${configRes.url}/rest/v1/shops?id=eq.${shopId}`, {
      method: 'PATCH',
      headers: headers,
      body: JSON.stringify({ status: status, updated_at: new Date().toISOString() })
    });

    if (!res.ok) throw new Error(`Update Shop Status Failed: ${res.status}`);
    return true;
  }

  // ==========================================
  // SHOP FEATURE FLAGS MANAGEMENT
  // ==========================================

  static async getShopFeatureFlags(shopId) {
    const configRes = await this._getConfig();
    const headers = await this._getAuthHeaders(configRes);

    const res = await fetch(`${configRes.url}/rest/v1/shop_feature_flags?shop_id=eq.${shopId}&select=*`, {
      method: 'GET',
      headers: headers
    });

    if (!res.ok) throw new Error(`Fetch Shop Feature Flags Failed: ${res.status}`);
    const data = await res.json();
    return data && data.length > 0 ? data[0] : null;
  }

  static async updateShopFeatureFlags(shopId, updates) {
    const configRes = await this._getConfig();
    const headers = await this._getAuthHeaders(configRes);

    const res = await fetch(`${configRes.url}/rest/v1/shop_feature_flags?shop_id=eq.${shopId}`, {
      method: 'PATCH',
      headers: headers,
      body: JSON.stringify({ ...updates, updated_at: new Date().toISOString() })
    });

    if (!res.ok) throw new Error(`Update Shop Feature Flags Failed: ${res.status}`);
    return true;
  }

  // ==========================================
  // USERS MANAGEMENT
  // ==========================================

  /**
   * Lấy danh sách người dùng cho Admin Dashboard (Phase 3)
   */
  static async getUsersList({ searchText, status, role, limit = 20, offset = 0 } = {}) {
    const configRes = await this._getConfig();
    const headers = await this._getAuthHeaders(configRes);

    const body = {
      p_search_text: searchText || null,
      p_status: status || null,
      p_role: role || null,
      p_limit: limit,
      p_offset: offset
    };

    const res = await fetch(`${configRes.url}/rest/v1/rpc/get_admin_users_list`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      throw new Error(`RPC get_admin_users_list Failed: ${res.status} - ${await res.text()}`);
    }

    return await res.json();
  }

  /**
   * Cập nhật trạng thái User (Khóa / Kích hoạt)
   */
  static async updateUserStatus(userId, status) {
    const configRes = await this._getConfig();
    const headers = await this._getAuthHeaders(configRes);

    const res = await fetch(`${configRes.url}/rest/v1/profiles?id=eq.${userId}`, {
      method: 'PATCH',
      headers: headers,
      body: JSON.stringify({ status: status, updated_at: new Date().toISOString() })
    });

    if (!res.ok) throw new Error(`Update User Status Failed: ${res.status}`);
    return true;
  }

  // ==========================================
  // DEVICE MANAGEMENT
  // ==========================================

  /**
   * Liệt kê toàn bộ thiết bị hệ thống (RPC admin_list_devices)
   */
  static async listDevices() {
    const configRes = await this._getConfig();
    const headers = await this._getAuthHeaders(configRes);

    const res = await fetch(`${configRes.url}/rest/v1/rpc/admin_list_devices`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({})
    });

    if (!res.ok) throw new Error(`RPC admin_list_devices Failed: ${res.status} - ${await res.text()}`);
    return await res.json();
  }

  /**
   * Thu hồi (revoke) hoặc khôi phục (restore) thiết bị
   */
  static async revokeDevice(deviceId, revoked = true) {
    const configRes = await this._getConfig();
    const headers = await this._getAuthHeaders(configRes);

    const res = await fetch(`${configRes.url}/rest/v1/rpc/admin_revoke_device`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ p_device_id: deviceId, p_revoked: revoked })
    });

    if (!res.ok) throw new Error(`RPC admin_revoke_device Failed: ${res.status} - ${await res.text()}`);
    return await res.json();
  }

  // ==========================================
  // SUBSCRIPTIONS
  // ==========================================

  /**
   * Lấy danh sách subscriptions kèm thông tin shop
   */
  static async getSubscriptions() {
    const configRes = await this._getConfig();
    const headers = await this._getAuthHeaders(configRes);

    const res = await fetch(
      `${configRes.url}/rest/v1/subscriptions?select=*,shops(id,name)&order=created_at.desc`,
      { method: 'GET', headers: headers }
    );

    if (!res.ok) throw new Error(`Fetch Subscriptions Failed: ${res.status} - ${await res.text()}`);
    return await res.json();
  }

  /**
   * Cập nhật subscription của shop (plan, status)
   */
  static async updateSubscription(subscriptionId, updates) {
    const configRes = await this._getConfig();
    const headers = await this._getAuthHeaders(configRes);

    const res = await fetch(`${configRes.url}/rest/v1/subscriptions?id=eq.${subscriptionId}`, {
      method: 'PATCH',
      headers: headers,
      body: JSON.stringify({ ...updates, updated_at: new Date().toISOString() })
    });

    if (!res.ok) throw new Error(`Update Subscription Failed: ${res.status}`);
    return true;
  }

  // ==========================================
  // SUPPORT TICKETS
  // ==========================================

  /**
   * Lấy danh sách support tickets kèm thông tin shop
   */
  static async getSupportTickets({ status, priority, limit = 50 } = {}) {
    const configRes = await this._getConfig();
    const headers = await this._getAuthHeaders(configRes);

    let url = `${configRes.url}/rest/v1/support_tickets?select=*,shops(id,name)&order=created_at.desc&limit=${limit}`;
    if (status) url += `&status=eq.${status}`;
    if (priority) url += `&priority=eq.${priority}`;

    const res = await fetch(url, { method: 'GET', headers: headers });
    if (!res.ok) throw new Error(`Fetch Support Tickets Failed: ${res.status} - ${await res.text()}`);
    return await res.json();
  }

  /**
   * Cập nhật trạng thái ticket
   */
  static async updateTicketStatus(ticketId, status) {
    const configRes = await this._getConfig();
    const headers = await this._getAuthHeaders(configRes);

    const res = await fetch(`${configRes.url}/rest/v1/support_tickets?id=eq.${ticketId}`, {
      method: 'PATCH',
      headers: headers,
      body: JSON.stringify({ status, updated_at: new Date().toISOString() })
    });

    if (!res.ok) throw new Error(`Update Ticket Status Failed: ${res.status}`);
    return true;
  }

  // ==========================================
  // RELEASE VERSIONS
  // ==========================================

  /**
   * Lấy danh sách phiên bản Extension
   */
  static async getReleaseVersions() {
    const configRes = await this._getConfig();
    const headers = await this._getAuthHeaders(configRes);

    const res = await fetch(
      `${configRes.url}/rest/v1/release_versions?order=created_at.desc`,
      { method: 'GET', headers: headers }
    );

    if (!res.ok) throw new Error(`Fetch Release Versions Failed: ${res.status} - ${await res.text()}`);
    return await res.json();
  }

  // ==========================================
  // CARRIER HEALTH
  // ==========================================

  /**
   * Lấy thống kê sức khoẻ carrier gần nhất (1 bản ghi/carrier)
   */
  static async getCarrierHealth() {
    const configRes = await this._getConfig();
    const headers = await this._getAuthHeaders(configRes);

    // Lấy bản ghi mới nhất cho mỗi carrier_code
    const res = await fetch(
      `${configRes.url}/rest/v1/carrier_health_logs?order=detected_at.desc&limit=50`,
      { method: 'GET', headers: headers }
    );

    if (!res.ok) throw new Error(`Fetch Carrier Health Failed: ${res.status} - ${await res.text()}`);
    const rows = await res.json();

    // Deduplicate: chỉ giữ bản ghi mới nhất cho mỗi carrier_code
    const seen = new Set();
    return rows.filter(r => {
      if (seen.has(r.carrier_code)) return false;
      seen.add(r.carrier_code);
      return true;
    });
  }

  // ==========================================
  // FEATURE FLAGS
  // ==========================================

  /**
   * Lấy danh sách feature flags
   */
  static async getFeatureFlags() {
    const configRes = await this._getConfig();
    const headers = await this._getAuthHeaders(configRes);

    const res = await fetch(
      `${configRes.url}/rest/v1/feature_flags?order=created_at.desc`,
      { method: 'GET', headers: headers }
    );

    if (!res.ok) throw new Error(`Fetch Feature Flags Failed: ${res.status} - ${await res.text()}`);
    return await res.json();
  }

  /**
   * Toggle feature flag (bật / tắt)
   */
  static async updateFeatureFlag(flagId, updates) {
    const configRes = await this._getConfig();
    const headers = await this._getAuthHeaders(configRes);

    const res = await fetch(`${configRes.url}/rest/v1/feature_flags?id=eq.${flagId}`, {
      method: 'PATCH',
      headers: headers,
      body: JSON.stringify({ ...updates, updated_at: new Date().toISOString() })
    });

    if (!res.ok) throw new Error(`Update Feature Flag Failed: ${res.status}`);
    return true;
  }

  // ==========================================
  // ADDRESS DATASET VERSIONS
  // ==========================================

  /**
   * Lấy danh sách các phiên bản Address Dataset
   */
  static async getAddressDatasets() {
    const configRes = await this._getConfig();
    const headers = await this._getAuthHeaders(configRes);

    const res = await fetch(
      `${configRes.url}/rest/v1/address_dataset_versions?order=created_at.desc`,
      { method: 'GET', headers: headers }
    );

    if (!res.ok) throw new Error(`Fetch Address Datasets Failed: ${res.status} - ${await res.text()}`);
    return await res.json();
  }

  /**
   * Cập nhật trạng thái Address Dataset
   */
  static async updateAddressDataset(datasetId, updates) {
    const configRes = await this._getConfig();
    const headers = await this._getAuthHeaders(configRes);

    const res = await fetch(`${configRes.url}/rest/v1/address_dataset_versions?id=eq.${datasetId}`, {
      method: 'PATCH',
      headers: headers,
      body: JSON.stringify(updates)
    });

    if (!res.ok) throw new Error(`Update Address Dataset Failed: ${res.status}`);
    return true;
  }

  // ==========================================
  // SECURITY / AUDIT LOGS
  // ==========================================


  /**
   * Lấy thống kê audit logs cho SecurityRLS page
   */
  static async getSecurityStats() {
    const configRes = await this._getConfig();
    const headers = await this._getAuthHeaders(configRes);

    // Đếm tổng audit logs hôm nay từ admin_audit_logs
    const today = new Date().toISOString().split('T')[0];
    const res = await fetch(
      `${configRes.url}/rest/v1/admin_audit_logs?select=id,action,target_type,result,created_at&created_at=gte.${today}T00:00:00Z&order=created_at.desc&limit=100`,
      { method: 'GET', headers: headers }
    );

    if (!res.ok) return { total: 0, logs: [] };
    const logs = await res.json();
    return { total: logs.length, logs };
  }
}
