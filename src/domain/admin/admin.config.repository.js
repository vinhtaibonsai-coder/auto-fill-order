import { AdminRepository } from './admin.repository.js';

export class SystemConfigRepository {
  static async getSystemConfig(key) {
    const configRes = await AdminRepository._getConfig();
    const headers = await AdminRepository._getAuthHeaders(configRes);

    const res = await fetch(`${configRes.url}/rest/v1/system_configs?select=value,updated_at&key=eq.${key}`, {
      method: 'GET',
      headers: headers
    });

    if (!res.ok) throw new Error(`Fetch System Config Failed: ${res.status}`);
    return await res.json();
  }

  static async upsertSystemConfig(key, valueObj, description = '') {
    const configRes = await AdminRepository._getConfig();
    const headers = await AdminRepository._getAuthHeaders(configRes);
    headers['Prefer'] = 'resolution=merge-duplicates';

    const payload = {
      key: key,
      value: valueObj,
      description: description,
      updated_at: new Date().toISOString()
    };

    const res = await fetch(`${configRes.url}/rest/v1/system_configs?on_conflict=key`, {
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
