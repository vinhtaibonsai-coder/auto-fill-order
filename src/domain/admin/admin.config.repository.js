import { AdminRepository } from './admin.repository.js';

export class SystemConfigRepository {
  // v34: bảng system_configs không còn cho anon/authenticated SELECT/INSERT thẳng.
  // Đọc qua RPC admin_get_system_config, ghi qua RPC upsert_system_config (v21).
  // Cả hai đều guard is_system_admin() phía server.
  static async getSystemConfig(key) {
    const configRes = await AdminRepository._getConfig();
    const headers = await AdminRepository._getAuthHeaders(configRes);

    const res = await fetch(`${configRes.url}/rest/v1/rpc/admin_get_system_config`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ p_key: key })
    });

    if (!res.ok) throw new Error(`Fetch System Config Failed: ${res.status} - ${await res.text()}`);

    const data = await res.json();
    // Giữ nguyên shape mảng như PostgREST cũ để UI không phải đổi.
    if (!data || !data.value) return [];
    return [{ value: data.value, updated_at: data.updated_at }];
  }

  static async upsertSystemConfig(key, valueObj, description = '') {
    const configRes = await AdminRepository._getConfig();
    const headers = await AdminRepository._getAuthHeaders(configRes);

    const res = await fetch(`${configRes.url}/rest/v1/rpc/upsert_system_config`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ p_key: key, p_value: valueObj, p_description: description })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Supabase HTTP ${res.status}: ${errText}`);
    }
    return res;
  }
}

export class ShopQuotaRepository {
  static async getShopQuota(shopId) {
    const configRes = await AdminRepository._getConfig();
    const headers = await AdminRepository._getAuthHeaders(configRes);

    const res = await fetch(`${configRes.url}/rest/v1/shop_quotas?select=*&shop_id=eq.${shopId}`, {
      method: 'GET',
      headers: headers
    });

    if (!res.ok) throw new Error(`Fetch Shop Quota Failed: ${res.status}`);
    return await res.json();
  }

  static async upsertShopQuota(shopId, planName, dailyQuota, usedQuota) {
    const configRes = await AdminRepository._getConfig();
    const headers = await AdminRepository._getAuthHeaders(configRes);
    headers['Prefer'] = 'resolution=merge-duplicates';

    const payload = {
      shop_id: shopId,
      plan_name: planName,
      ai_quota_limit: dailyQuota,
      ai_quota_used: usedQuota,
      updated_at: new Date().toISOString()
    };

    const res = await fetch(`${configRes.url}/rest/v1/shop_quotas?on_conflict=shop_id`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Supabase HTTP ${res.status}: ${errText}`);
    }
    return res;
  }
}
