import { AuthSession } from '../auth/auth.session.esm.js';
import { maskCustomerPii } from './data-quality.engine.js';

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

  /**
   * Sinh Headers sử dụng anonKey trực tiếp cho các REST fallback
   */
  static async _getAnonHeaders(configRes) {
    const anonKey = (configRes?.anonKey || '').trim();
    const headers = { 'Content-Type': 'application/json' };
    if (anonKey) {
      headers['apikey'] = anonKey;
      headers['Authorization'] = `Bearer ${anonKey}`;
    }
    return headers;
  }

  static async _getAdminId() {
    const sess = await AuthSession.getSession().catch(() => null);
    return sess?.user?.id;
  }

  static async _rpc(name, payload = {}) {
    const configRes = await this._getConfig();
    const headers = await this._getAuthHeaders(configRes);
    const res = await fetch(`${configRes.url}/rest/v1/rpc/${name}`, {
      method: 'POST', headers, body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`RPC ${name} Failed: ${res.status} - ${await res.text()}`);
    const text = await res.text();
    return text ? JSON.parse(text) : true;
  }

  static async createShopWithAccount({ shopName, ownerEmail, ownerName, password, maxDevices = 1, dailyAiLimit = 500 }) {
    try {
      return await this._rpc('admin_create_shop_with_account', {
        p_shop_name: shopName,
        p_owner_email: ownerEmail,
        p_owner_full_name: ownerName,
        p_owner_password: password,
        p_max_devices: maxDevices,
        p_daily_ai_limit: dailyAiLimit
      });
    } catch (rpcErr) {
      const configRes = await this._getConfig();
      const headers = await this._getAuthHeaders(configRes);

      const user = await this.findUserByEmailOrId(ownerEmail);
      if (user && user.id) {
        const shopRes = await fetch(`${configRes.url}/rest/v1/shops`, {
          method: 'POST',
          headers: { ...headers, 'Prefer': 'return=representation' },
          body: JSON.stringify({ name: shopName, owner_id: user.id, status: 'active' })
        });
        if (shopRes.ok) {
          const created = await shopRes.json().catch(() => []);
          const shopId = created[0]?.id;
          if (shopId) {
            let ownerRoleId = null;
            try {
              const rolesRes = await fetch(`${configRes.url}/rest/v1/roles?code=eq.SHOP_OWNER&select=id`, { headers });
              if (rolesRes.ok) {
                const rolesList = await rolesRes.json();
                ownerRoleId = rolesList[0]?.id;
              }
              if (!ownerRoleId) {
                const fallbackRolesRes = await fetch(`${configRes.url}/rest/v1/roles?code=eq.OWNER&select=id`, { headers });
                if (fallbackRolesRes.ok) {
                  const fallbackList = await fallbackRolesRes.json();
                  ownerRoleId = fallbackList[0]?.id;
                }
              }
            } catch (_) {}

            const memberPayload = { shop_id: shopId, user_id: user.id, role: 'OWNER', status: 'active' };
            if (ownerRoleId) memberPayload.role_id = ownerRoleId;
            await fetch(`${configRes.url}/rest/v1/shop_members`, {
              method: 'POST',
              headers,
              body: JSON.stringify(memberPayload)
            }).catch(() => {});

            await fetch(`${configRes.url}/rest/v1/shop_quotas`, {
              method: 'POST',
              headers,
              body: JSON.stringify({ shop_id: shopId, max_devices: maxDevices, daily_ai_limit: dailyAiLimit })
            }).catch(() => {});

            await fetch(`${configRes.url}/rest/v1/shop_feature_flags`, {
              method: 'POST',
              headers,
              body: JSON.stringify({ shop_id: shopId })
            }).catch(() => {});

            return { success: true, shop_id: shopId, user_id: user.id };
          }
        }
      }
      throw rpcErr;
    }
  }

  static topupQuota(shopId, amount) { return this._rpc('admin_topup_shop_quota', { p_shop_id: shopId, p_amount: amount }); }
  static getQuotaOverview() { return this._rpc('admin_get_ai_quota_overview'); }
  static async transferShopOwnership(shopId, newOwnerId) {
    try {
      return await this._rpc('admin_transfer_shop_ownership', { p_shop_id: shopId, p_new_owner_id: newOwnerId });
    } catch (rpcErr) {
      const configRes = await this._getConfig();
      const headers = await this._getAuthHeaders(configRes);
      const res = await fetch(`${configRes.url}/rest/v1/shops?id=eq.${encodeURIComponent(shopId)}`, {
        method: 'PATCH',
        headers: headers,
        body: JSON.stringify({ owner_id: newOwnerId, updated_at: new Date().toISOString() })
      });
      if (!res.ok) {
        throw new Error(`Chuyển chủ sở hữu thất bại: ${res.status} - ${await res.text()}`);
      }
      return true;
    }
  }

  static async findUserByEmailOrId(query) {
    if (!query) return null;
    const configRes = await this._getConfig();
    const headers = await this._getAuthHeaders(configRes);
    const trimmed = String(query).trim();

    if (trimmed.includes('@')) {
      const res = await fetch(`${configRes.url}/rest/v1/profiles?email=ilike.${encodeURIComponent(trimmed)}&select=*&limit=1`, {
        method: 'GET',
        headers: headers
      });
      if (res.ok) {
        const list = await res.json().catch(() => []);
        if (list && list.length > 0) return list[0];
      }
    }

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);
    if (isUUID) {
      const idRes = await fetch(`${configRes.url}/rest/v1/profiles?id=eq.${encodeURIComponent(trimmed)}&select=*&limit=1`, {
        method: 'GET',
        headers: headers
      });
      if (idRes.ok) {
        const list = await idRes.json().catch(() => []);
        if (list && list.length > 0) return list[0];
      }
    }

    const nameRes = await fetch(`${configRes.url}/rest/v1/profiles?full_name=ilike.*${encodeURIComponent(trimmed)}*&select=*&limit=1`, {
      method: 'GET',
      headers: headers
    });
    if (nameRes.ok) {
      const list = await nameRes.json().catch(() => []);
      if (list && list.length > 0) return list[0];
    }

    return null;
  }
  static createAdminAccount(data) { return this._rpc('admin_create_admin_account', { p_email: data.email, p_full_name: data.fullName, p_password: data.password, p_role_code: data.role }); }
  static startImpersonation(shopId, reason) { return this._rpc('admin_start_impersonation', { p_shop_id: shopId, p_reason: reason }); }
  static async setUserRole(userId, role) {
    const normalizedRole = String(role || '').toUpperCase().trim();
    try {
      return await this._rpc('admin_set_user_role', { p_user_id: userId, p_role_code: normalizedRole });
    } catch (rpcErr) {
      const configRes = await this._getConfig();
      const headers = await this._getAuthHeaders(configRes);
      if (['USER', 'NONE', 'MEMBER', 'EXTENSION_USER', 'SHOP_STAFF', 'VIEWER'].includes(normalizedRole)) {
        const delRes = await fetch(`${configRes.url}/rest/v1/user_roles?user_id=eq.${encodeURIComponent(userId)}`, {
          method: 'DELETE',
          headers: headers
        });
        if (delRes.ok) {
          return { success: true, message: 'Đã chuyển thành tài khoản người dùng tiêu chuẩn.' };
        }
      }
      throw rpcErr;
    }
  }
  static overrideSubscription(shopId, plan, months) { return this._rpc('admin_override_subscription', { p_shop_id: shopId, p_plan_code: plan, p_extend_months: months }); }
  static revokeShopDevices(shopId) { return this._rpc('admin_revoke_shop_devices', { p_shop_id: shopId }); }
  static replySupportTicket(ticketId, reply, internalNote) { return this._rpc('admin_reply_support_ticket', { p_ticket_id: ticketId, p_reply: reply, p_internal_note: internalNote || null }); }
  static publishRelease(data) { return this._rpc('admin_publish_release', { p_version: data.version, p_min_supported_version: data.minVersion, p_force_update: data.forceUpdate, p_rollout_percentage: data.rolloutPercentage, p_release_notes: data.notes, p_download_url: data.downloadUrl || null }); }
  static recordCarrierProbe(carrierCode, status, responseTimeMs, errorMessage = null) { return this._rpc('admin_record_carrier_probe', { p_carrier_code: carrierCode, p_status: status, p_response_time_ms: responseTimeMs, p_error_message: errorMessage }); }
  static getUnitEconomics() { return this._rpc('admin_get_unit_economics'); }
  static publishRemoteSelectors(data) { return this._rpc('admin_publish_remote_selectors', { p_carrier_code: data.carrierCode, p_selectors: data.selectors, p_min_extension_version: data.minVersion || null, p_release_note: data.note || null }); }
  static listRemoteSelectorReleases(carrierCode, limit = 20) { return this._rpc('admin_list_remote_selector_releases', { p_carrier_code: carrierCode, p_limit: limit }); }
  static rollbackRemoteSelectors(carrierCode, version, reason) { return this._rpc('admin_rollback_remote_selectors', { p_carrier_code: carrierCode, p_target_version: version, p_reason: reason }); }
  static getGrowthMetrics() { return this._rpc('admin_get_growth_metrics'); }
  static async getCommercialIntelligence(range = '30days') {
    const now = new Date();
    const days = range === 'today' ? 1 : range === '7days' ? 7 : range === 'thisMonth' ? Math.max(1, now.getDate()) : 30;
    const from = new Date(now); from.setHours(0, 0, 0, 0); from.setDate(from.getDate() - days + 1);
    const previousTo = new Date(from.getTime() - 1);
    const previousFrom = new Date(previousTo); previousFrom.setHours(0, 0, 0, 0); previousFrom.setDate(previousFrom.getDate() - days + 1);
    return this._rpc('admin_get_commercial_intelligence', {
      p_from: from.toISOString(), p_to: now.toISOString(),
      p_previous_from: previousFrom.toISOString(), p_previous_to: previousTo.toISOString()
    });
  }
  static async getUnitEconomicsAnalytics(range = '30days') {
    const now = new Date();
    const days = range === 'today' ? 1 : range === '7days' ? 7 : range === 'thisMonth' ? Math.max(1, now.getDate()) : 30;
    const from = new Date(now); from.setHours(0, 0, 0, 0); from.setDate(from.getDate() - days + 1);
    const previousTo = new Date(from.getTime() - 1);
    const previousFrom = new Date(previousTo); previousFrom.setHours(0, 0, 0, 0); previousFrom.setDate(previousFrom.getDate() - days + 1);
    return this._rpc('admin_get_unit_economics_analytics', {
      p_from: from.toISOString(), p_to: now.toISOString(),
      p_previous_from: previousFrom.toISOString(), p_previous_to: previousTo.toISOString()
    });
  }
  static globalSearch(query, limit = 12) {
    return this._rpc('admin_global_search', { p_query: String(query || '').trim(), p_limit: limit });
  }
  static getRetentionPortfolio(inactiveDays = 3, expiringDays = 3) { return this._rpc('admin_get_retention_portfolio', { p_inactive_days: inactiveDays, p_expiring_days: expiringDays }); }
  static recordRetentionAction(shopId, actionType, note, status = 'DONE') { return this._rpc('admin_record_retention_action', { p_shop_id: shopId, p_action_type: actionType, p_note: note || '', p_status: status }); }
  static generateRetentionSnapshots(snapshotDate = null, inactiveDays = 3, expiringDays = 3) {
    return this._rpc('admin_generate_retention_snapshots', {
      p_snapshot_date: snapshotDate,
      p_inactive_days: inactiveDays,
      p_expiring_days: expiringDays
    });
  }
  static createPlaybookTask(shopId, playbookCode, assigneeId = null, assigneeName = null, dueAt = null, note = null) {
    return this._rpc('admin_create_playbook_task', {
      p_shop_id: shopId,
      p_playbook_code: playbookCode,
      p_assignee_id: assigneeId,
      p_assignee_name: assigneeName,
      p_due_at: dueAt,
      p_note: note
    });
  }
  static updateRetentionTask(taskId, status, outcome = null, nextAction = null, note = null) {
    return this._rpc('admin_update_retention_task', {
      p_task_id: taskId,
      p_status: status,
      p_outcome: outcome,
      p_next_action: nextAction,
      p_note: note
    });
  }
  static getCohortRetentionAnalytics(months = 6) {
    return this._rpc('admin_get_cohort_retention_analytics', { p_months: months });
  }
  static getRetentionTasks(status = 'ALL', playbook = 'ALL', limit = 50) {
    return this._rpc('admin_get_retention_tasks', {
      p_status: status,
      p_playbook: playbook,
      p_limit: limit
    });
  }
  static async getAiModelCostRates() {
    try {
      const configRes = await this._getConfig();
      const headers = await this._getAuthHeaders(configRes);
      const res = await fetch(`${configRes.url}/rest/v1/ai_model_cost_rates?select=*&order=model.asc`, { headers });
      if (res.ok) {
        const rows = await res.json();
        return Array.isArray(rows) ? rows : [];
      }
    } catch (e) {
      console.warn('[AdminRepository] getAiModelCostRates error:', e.message);
    }
    return [];
  }
  static async getAiCostAnalytics(from, to) {
    try {
      return await this._rpc('admin_get_ai_cost_analytics', { p_from: from, p_to: to });
    } catch (rpcErr) {
      console.warn('[AdminRepository] admin_get_ai_cost_analytics RPC error, fallback to REST:', rpcErr.message);
      try {
        const configRes = await this._getConfig();
        const headers = await this._getAuthHeaders(configRes);
        const [logsRes, ratesRes] = await Promise.all([
          fetch(`${configRes.url}/rest/v1/ai_usage_log?created_at=gte.${encodeURIComponent(from)}&created_at=lte.${encodeURIComponent(to)}&select=model,provider,input_tokens,output_tokens,prompt_tokens,completion_tokens,total_tokens,status,estimated_cost&limit=5000`, { headers }),
          fetch(`${configRes.url}/rest/v1/ai_model_cost_rates?select=*`, { headers })
        ]);
        const logs = logsRes.ok ? await logsRes.json() : [];
        const rates = ratesRes.ok ? await ratesRes.json() : [];
        return {
          total_requests: logs.length,
          successful_requests: logs.filter(l => l.status === 'success').length,
          failed_requests: logs.filter(l => l.status !== 'success').length,
          logs,
          rates
        };
      } catch (_) {}
      return { total_requests: 0, logs: [], rates: [] };
    }
  }

  static async getProviderResilienceAnalytics(from, to) {
    try {
      return await this._rpc('admin_get_provider_resilience_analytics', { p_from: from, p_to: to });
    } catch (rpcErr) {
      console.warn('[AdminRepository] admin_get_provider_resilience_analytics RPC error, fallback to REST:', rpcErr.message);
      try {
        const configRes = await this._getConfig();
        const headers = await this._getAuthHeaders(configRes);
        const logsRes = await fetch(`${configRes.url}/rest/v1/ai_usage_log?created_at=gte.${encodeURIComponent(from)}&created_at=lte.${encodeURIComponent(to)}&select=provider,model,status,latency_ms,error_class,estimated_cost,cache_hit&limit=5000`, { headers });
        const logs = logsRes.ok ? await logsRes.json() : [];
        const { calculateProviderAnalytics } = await import('../ai/provider-resilience.engine.js');
        return calculateProviderAnalytics(logs);
      } catch (_) {}
      return { by_provider: {} };
    }
  }

  static async getOutboxMetrics() {
    try {
      return await this._rpc('admin_get_outbox_queue_metrics');
    } catch (rpcErr) {
      console.warn('[AdminRepository] admin_get_outbox_queue_metrics RPC error, fallback to REST:', rpcErr.message);
      try {
        const configRes = await this._getConfig();
        const headers = await this._getAuthHeaders(configRes);
        const [jobRes, syncRes, alertRes] = await Promise.all([
          fetch(`${configRes.url}/rest/v1/system_job_outbox?select=queue_type,status`, { headers }).catch(() => null),
          fetch(`${configRes.url}/rest/v1/sync_outbox?select=status`, { headers }).catch(() => null),
          fetch(`${configRes.url}/rest/v1/ops_alert_outbox?select=status`, { headers }).catch(() => null)
        ]);

        const jobs = jobRes?.ok ? await jobRes.json() : [];
        const syncs = syncRes?.ok ? await syncRes.json() : [];
        const alerts = alertRes?.ok ? await alertRes.json() : [];

        const summary = { total: 0, pending: 0, running: 0, succeeded: 0, failed: 0, dead_letter: 0 };
        const queues = {
          draft_sync: { total: 0, pending: 0, running: 0, succeeded: 0, failed: 0, dead_letter: 0 },
          order_sync: { total: 0, pending: 0, running: 0, succeeded: 0, failed: 0, dead_letter: 0 },
          telegram_alert: { total: 0, pending: 0, running: 0, succeeded: 0, failed: 0, dead_letter: 0 },
          webhook_retry: { total: 0, pending: 0, running: 0, succeeded: 0, failed: 0, dead_letter: 0 },
          retention_notification: { total: 0, pending: 0, running: 0, succeeded: 0, failed: 0, dead_letter: 0 }
        };

        for (const j of jobs) {
          const s = (j.status || 'pending').toLowerCase();
          summary.total++;
          if (summary[s] != null) summary[s]++;
          const q = j.queue_type;
          if (queues[q]) {
            queues[q].total++;
            if (queues[q][s] != null) queues[q][s]++;
          }
        }

        for (const s of syncs) {
          const st = (s.status || 'PENDING').toLowerCase();
          const mapped = st === 'processed' ? 'succeeded' : st === 'failed' ? 'failed' : 'pending';
          summary.total++;
          summary[mapped]++;
          queues.order_sync.total++;
          queues.order_sync[mapped]++;
        }

        for (const a of alerts) {
          const st = (a.status || 'pending').toLowerCase();
          const mapped = st === 'sent' ? 'succeeded' : st === 'failed' ? 'failed' : 'pending';
          summary.total++;
          summary[mapped]++;
          queues.telegram_alert.total++;
          queues.telegram_alert[mapped]++;
        }

        return { summary, queues, checked_at: new Date().toISOString() };
      } catch (_) {
        return {
          summary: { total: 0, pending: 0, running: 0, succeeded: 0, failed: 0, dead_letter: 0 },
          queues: {}
        };
      }
    }
  }

  static async replayDeadLetterJobs(queueType = null, jobIds = null) {
    return await this._rpc('admin_replay_dead_letter_jobs', {
      p_queue_type: queueType || null,
      p_job_ids: jobIds || null
    });
  }

  static async retryOutboxJob(jobId) {
    return await this._rpc('admin_retry_outbox_job', {
      p_job_id: jobId
    });
  }

  static async getDataQualityKpis(range = '30d') {
    try {
      return await this._rpc('admin_get_data_quality_kpis', { p_range: range });
    } catch (rpcErr) {
      console.warn('[AdminRepository] admin_get_data_quality_kpis RPC fallback:', rpcErr.message);
      return {
        missing_tracking_code: 0,
        invalid_duplicate_order_code: 0,
        low_confidence_address: 0,
        stale_carrier_status: 0,
        unmatched_payment: 0,
        total_issues: 0,
        range,
        calculated_at: new Date().toISOString()
      };
    }
  }

  static async getDataQualityDrilldown(kpiType, range = '30d', limit = 50, offset = 0) {
    try {
      const rpcResult = await this._rpc('admin_get_data_quality_drilldown', {
        p_kpi_type: kpiType,
        p_range: range,
        p_limit: limit,
        p_offset: offset
      });
      if (rpcResult && Array.isArray(rpcResult.records)) {
        return rpcResult;
      }
    } catch (rpcErr) {
      console.warn('[AdminRepository] admin_get_data_quality_drilldown RPC fallback:', rpcErr.message);
    }

    // Resilient REST API fallback when RPC encounters column or grant error
    try {
      const configRes = await this._getConfig();
      const headers = await this._getAuthHeaders(configRes);
      let fromDate;
      if (range === '7d') {
        fromDate = new Date(Date.now() - 7 * 86400000).toISOString();
      } else if (range === 'all') {
        fromDate = '2020-01-01T00:00:00.000Z';
      } else {
        fromDate = new Date(Date.now() - 30 * 86400000).toISOString();
      }

      if (kpiType === 'missing_tracking_code') {
        const url = `${configRes.url}/rest/v1/submitted_orders?select=id,shop_id,order_code,tracking_code,platform,status,customer_name,name,phone,created_at,submitted_at&or=(tracking_code.is.null,tracking_code.eq.)&created_at=gte.${fromDate}&order=created_at.desc&limit=${limit}&offset=${offset}`;
        const res = await fetch(url, { headers: { ...headers, 'Prefer': 'count=exact' } });
        if (res.ok) {
          const countHeader = res.headers.get('content-range');
          const total = countHeader ? parseInt(countHeader.split('/')[1], 10) || 0 : 0;
          const items = await res.json();
          const records = items.map(s => {
            const { maskedName, maskedPhone } = maskCustomerPii(s.customer_name || s.name, s.phone);
            return {
              record_id: s.id,
              shop_id: s.shop_id,
              shop_name: 'Shop #' + (s.shop_id ? String(s.shop_id).slice(0, 8) : 'unknown'),
              order_code: s.order_code,
              tracking_code: s.tracking_code,
              carrier: s.platform || 'vnpost',
              status: s.status,
              customer_name_masked: maskedName,
              customer_phone_masked: maskedPhone,
              issue_description: 'Đơn đã submit nhưng thiếu mã vận đơn',
              detected_at: s.created_at || s.submitted_at || new Date().toISOString()
            };
          });
          return { kpi_type: kpiType, total: total || records.length, records, limit, offset };
        }
      } else if (kpiType === 'stale_carrier_status') {
        const staleThreshold = new Date(Date.now() - 72 * 3600 * 1000).toISOString();
        const url = `${configRes.url}/rest/v1/submitted_orders?select=id,shop_id,order_code,tracking_code,platform,status,customer_name,name,phone,created_at,submitted_at,updated_at&status=not.in.(delivered,cancelled,returned)&tracking_code=not.is.null&tracking_code=neq.&updated_at=lt.${staleThreshold}&created_at=gte.${fromDate}&order=updated_at.asc&limit=${limit}&offset=${offset}`;
        const res = await fetch(url, { headers: { ...headers, 'Prefer': 'count=exact' } });
        if (res.ok) {
          const countHeader = res.headers.get('content-range');
          const total = countHeader ? parseInt(countHeader.split('/')[1], 10) || 0 : 0;
          const items = await res.json();
          const records = items.map(s => {
            const { maskedName, maskedPhone } = maskCustomerPii(s.customer_name || s.name, s.phone);
            return {
              record_id: s.id,
              shop_id: s.shop_id,
              shop_name: 'Shop #' + (s.shop_id ? String(s.shop_id).slice(0, 8) : 'unknown'),
              order_code: s.order_code,
              tracking_code: s.tracking_code,
              carrier: s.platform || 'vnpost',
              status: s.status,
              customer_name_masked: maskedName,
              customer_phone_masked: maskedPhone,
              issue_description: 'Đơn không có cập nhật trạng thái bưu cục > 72 giờ',
              detected_at: s.updated_at || s.created_at || new Date().toISOString()
            };
          });
          return { kpi_type: kpiType, total: total || records.length, records, limit, offset };
        }
      } else if (kpiType === 'invalid_duplicate_order_code') {
        const url = `${configRes.url}/rest/v1/submitted_orders?select=id,shop_id,order_code,tracking_code,platform,status,customer_name,name,phone,created_at,submitted_at&order_code=not.is.null&order_code=neq.&created_at=gte.${fromDate}&order=order_code.asc,created_at.desc&limit=1000`;
        const res = await fetch(url, { headers });
        if (res.ok) {
          const rawItems = await res.json();
          // Chỉ kiểm tra các mã đơn có cấu trúc riêng (chứa số, độ dài >= 3), không nhận chuỗi chữ thuần như 'caycover'
          const items = (Array.isArray(rawItems) ? rawItems : []).filter(item => {
            const code = String(item.order_code || '').trim();
            return code.length >= 3 && /\d/.test(code) && !/^\d+$/.test(code);
          });
          const counts = new Map();
          for (const item of items) {
            const k = `${item.shop_id}:${item.order_code.trim()}`;
            counts.set(k, (counts.get(k) || 0) + 1);
          }
          const dupes = items.filter(item => (counts.get(`${item.shop_id}:${item.order_code.trim()}`) || 0) > 1);
          const paginated = dupes.slice(offset, offset + limit);
          const records = paginated.map(s => {
            const { maskedName, maskedPhone } = maskCustomerPii(s.customer_name || s.name, s.phone);
            return {
              record_id: s.id,
              shop_id: s.shop_id,
              shop_name: 'Shop #' + (s.shop_id ? String(s.shop_id).slice(0, 8) : 'unknown'),
              order_code: s.order_code,
              tracking_code: s.tracking_code,
              carrier: s.platform || 'vnpost',
              status: s.status,
              customer_name_masked: maskedName,
              customer_phone_masked: maskedPhone,
              issue_description: 'Mã đơn trùng lặp với đơn hàng khác trong cùng shop',
              detected_at: s.created_at || s.submitted_at || new Date().toISOString()
            };
          });
          return { kpi_type: kpiType, total: dupes.length, records, limit, offset };
        }
      }
    } catch (restErr) {
      console.warn('[AdminRepository] REST fallback failed:', restErr.message);
    }

    return { kpi_type: kpiType, total: 0, records: [], limit, offset };
  }

  static async resolveDataQualityIssue(issueType, recordId, note = 'Đã xử lý') {
    return await this._rpc('admin_resolve_data_quality_issue', {
      p_issue_type: issueType,
      p_record_id: recordId,
      p_resolution_note: note
    });
  }

  static async resetUserPassword(userId, newPassword) {
    try {
      return await this._rpc('admin_reset_user_password', { p_target_user_id: userId, p_new_password: newPassword });
    } catch (rpcErr) {
      const configRes = await this._getConfig();
      const headers = await this._getAuthHeaders(configRes);
      const res = await fetch(`${configRes.url}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
        method: 'PUT',
        headers: headers,
        body: JSON.stringify({ password: newPassword })
      });
      if (res.ok) {
        return { success: true, message: 'Đã cập nhật mật khẩu thành công.' };
      }
      throw rpcErr;
    }
  }
  static async assignUserShop(userId, shopId, roleCode = 'STAFF') {
    try {
      return await this._rpc('admin_assign_user_shop', { p_user_id: userId, p_shop_id: shopId, p_role_code: roleCode });
    } catch (rpcErr) {
      try {
        return await this._rpc('admin_add_shop_member', { p_shop_id: shopId, p_user_id: userId, p_role: roleCode });
      } catch (_) {}

      const configRes = await this._getConfig();
      const headers = await this._getAuthHeaders(configRes);
      
      let roleId = null;
      try {
        const rolesRes = await fetch(`${configRes.url}/rest/v1/roles?code=eq.${encodeURIComponent(roleCode)}&select=id`, { headers });
        if (rolesRes.ok) {
          const roles = await rolesRes.json();
          roleId = roles[0]?.id;
        }
      } catch (_) {}

      const payload = {
        shop_id: shopId,
        user_id: userId,
        role: roleCode,
        status: 'active',
        removed_at: null
      };
      if (roleId) payload.role_id = roleId;

      const res = await fetch(`${configRes.url}/rest/v1/shop_members`, {
        method: 'POST',
        headers: { ...headers, 'Prefer': 'resolution=merge-duplicates' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        throw new Error(`Thêm nhân viên thất bại: ${res.status} - ${await res.text()}`);
      }
      return { success: true };
    }
  }

  static async createAndAddShopMember(shopId, { email, fullName, password, roleCode = 'STAFF' }) {
    const configRes = await this._getConfig();
    const headers = await this._getAuthHeaders(configRes);
    const cleanEmail = String(email).trim().toLowerCase();

    // 1. Kiểm tra xem user đã tồn tại chưa
    let user = await this.findUserByEmailOrId(cleanEmail);

    if (!user || !user.id) {
      // 2. Tạo user mới trong auth.users / profiles
      const pass = password || Math.random().toString(36).slice(-8);
      const signupRes = await fetch(`${configRes.url}/auth/v1/admin/users`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          email: cleanEmail,
          password: pass,
          email_confirm: true,
          user_metadata: { full_name: fullName }
        })
      });

      if (signupRes.ok) {
        const signupData = await signupRes.json();
        user = { id: signupData.id || signupData.user?.id, email: cleanEmail, full_name: fullName };
      } else {
        const newId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `usr_${Date.now()}`;
        await fetch(`${configRes.url}/rest/v1/profiles`, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({ id: newId, email: cleanEmail, full_name: fullName, status: 'active' })
        }).catch(() => {});
        user = { id: newId, email: cleanEmail, full_name: fullName };
      }
    }

    // 3. Gán vào shop
    return await this.assignUserShop(user.id, shopId, roleCode);
  }

  static async getShopMembers(shopId) {
    const configRes = await this._getConfig();
    const headers = await this._getAuthHeaders(configRes);
    let members = [];
    try {
      const res = await fetch(`${configRes.url}/rest/v1/shop_members?shop_id=eq.${encodeURIComponent(shopId)}&removed_at=is.null&select=*,profiles:user_id(id,email,full_name,avatar_url),roles:role_id(code,name)`, {
        method: 'GET',
        headers: headers
      });
      if (res.ok) {
        members = await res.json();
      }
    } catch (_) {}

    if (!members || members.length === 0) {
      try {
        const resSimple = await fetch(`${configRes.url}/rest/v1/shop_members?shop_id=eq.${encodeURIComponent(shopId)}&removed_at=is.null&select=*`, {
          method: 'GET',
          headers: headers
        });
        if (resSimple.ok) {
          members = await resSimple.json();
        }
      } catch (_) {}
    }

    if (Array.isArray(members) && members.length > 0) {
      const missingUserIds = members.filter(m => !m.profiles?.email).map(m => m.user_id).filter(Boolean);
      if (missingUserIds.length > 0) {
        try {
          const profRes = await fetch(`${configRes.url}/rest/v1/profiles?id=in.(${missingUserIds.map(id => `"${id}"`).join(',')})&select=*`, {
            method: 'GET',
            headers: headers
          });
          if (profRes.ok) {
            const profs = await profRes.json();
            const profMap = new Map((profs || []).map(p => [p.id, p]));
            members = members.map(m => {
              const p = profMap.get(m.user_id);
              if (p) {
                return {
                  ...m,
                  profiles: { ...(m.profiles || {}), ...p },
                  email: p.email || m.email,
                  full_name: p.full_name || m.full_name
                };
              }
              return m;
            });
          }
        } catch (_) {}
      }
    }

    return members || [];
  }

  static async removeShopMember(shopId, userId) {
    const configRes = await this._getConfig();
    const headers = await this._getAuthHeaders(configRes);
    const res = await fetch(`${configRes.url}/rest/v1/shop_members?shop_id=eq.${encodeURIComponent(shopId)}&user_id=eq.${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      headers: headers,
      body: JSON.stringify({ removed_at: new Date().toISOString(), status: 'inactive' })
    });
    return res.ok;
  }

  static async forceLogoutUser(userId) {
    const configRes = await this._getConfig();
    const headers = await this._getAuthHeaders(configRes);
    const res = await fetch(`${configRes.url}/rest/v1/user_devices?user_id=eq.${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      headers: headers,
      body: JSON.stringify({ revoked: true, revoked_at: new Date().toISOString() })
    });
    return res.ok;
  }

  static async restoreShop(shopId) {
    const configRes = await this._getConfig();
    const headers = await this._getAuthHeaders(configRes);
    const res = await fetch(`${configRes.url}/rest/v1/shops?id=eq.${encodeURIComponent(shopId)}`, {
      method: 'PATCH',
      headers: headers,
      body: JSON.stringify({ status: 'active', updated_at: new Date().toISOString() })
    });
    if (!res.ok) {
      throw new Error(`Khôi phục cửa hàng thất bại: ${res.status} - ${await res.text()}`);
    }
    return true;
  }
  static createReseller(name, code, commissionRate) { return this._rpc('admin_create_reseller', { p_name: name, p_code: code, p_commission_rate: commissionRate }); }
  static getResellerPortalOverview(resellerId = null) {
    return this._rpc('reseller_get_portal_overview', { p_reseller_id: resellerId });
  }
  static recordResellerCommissionFromPayment(paymentId) {
    return this._rpc('record_reseller_commission_from_payment', { p_payment_id: paymentId });
  }
  static reverseResellerCommission(paymentId, refundAmount, reason = 'Refund') {
    return this._rpc('reverse_reseller_commission_for_refund', {
      p_payment_id: paymentId,
      p_refund_amount: refundAmount,
      p_reason: reason
    });
  }
  static generateResellerPayoutStatement(resellerId, periodStart, periodEnd) {
    return this._rpc('admin_generate_reseller_payout_statement', {
      p_reseller_id: resellerId,
      p_period_start: periodStart,
      p_period_end: periodEnd
    });
  }
  static payResellerStatement(statementId, payoutRef) {
    return this._rpc('admin_pay_reseller_statement', {
      p_statement_id: statementId,
      p_payout_ref: payoutRef
    });
  }
  static creditWallet(shopId, amount, referenceId, description) {
    return this._rpc('admin_credit_wallet', {
      p_shop_id: shopId,
      p_amount: amount,
      p_reference_id: referenceId,
      p_description: description
    });
  }
  static getWalletDetails(shopId) {
    return this._rpc('admin_get_wallet_details', { p_shop_id: shopId });
  }
  static topupWalletWithAudit(shopId, amount, reason, referenceId = null) {
    return this._rpc('admin_topup_wallet_with_audit', {
      p_shop_id: shopId,
      p_amount: amount,
      p_reason: reason,
      p_reference_id: referenceId
    });
  }
  static refundWalletWithAudit(shopId, amount, reason, referenceId = null) {
    return this._rpc('admin_refund_wallet_with_audit', {
      p_shop_id: shopId,
      p_amount: amount,
      p_reason: reason,
      p_reference_id: referenceId
    });
  }
  static reserveAiCredit(shopId, maxAmount, reservationId) {
    return this._rpc('wallet_reserve_ai_credit', {
      p_shop_id: shopId,
      p_max_amount: maxAmount,
      p_reservation_id: reservationId
    });
  }
  static settleAiCredit(shopId, reservationId, actualCost, maxReserved, metadata = null) {
    return this._rpc('wallet_settle_ai_credit', {
      p_shop_id: shopId,
      p_reservation_id: reservationId,
      p_actual_cost: actualCost,
      p_max_reserved: maxReserved,
      p_metadata: metadata
    });
  }
  static compensateAiCredit(shopId, reservationId, reservedAmount, reason = 'AI Failure Compensation') {
    return this._rpc('wallet_compensate_ai_credit', {
      p_shop_id: shopId,
      p_reservation_id: reservationId,
      p_reserved_amount: reservedAmount,
      p_reason: reason
    });
  }

  /**
   * Ghi log Audit Admin qua RPC SECURITY DEFINER insert_audit_log
   * (audit_logs bị RLS chặn INSERT qua REST — probe 42501; bảng
   * admin_audit_logs cũ KHÔNG tồn tại trong DB)
   */
  static async insertAuditLog(action, targetId, targetType, beforeState, afterState, result = 'SUCCESS') {
    try {
      const configRes = await this._getConfig();
      const headers = await this._getAuthHeaders(configRes);
      const adminId = await this._getAdminId();

      if (!adminId) return; // Bỏ qua nếu không lấy được Admin ID

      const payload = {
        p_action: action,
        p_entity_type: targetType,
        p_entity_id: targetId != null ? String(targetId) : null,
        p_details: {
          before_state: beforeState ?? null,
          after_state: afterState ?? null,
          result: result,
        },
      };

      const res = await fetch(`${configRes.url}/rest/v1/rpc/insert_audit_log`, {
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
   * Gọi RPC get_admin_kpis kèm fallback REST tính toán trực tiếp
   */
  static async getKpis(range = '30days') {
    const configRes = await this._getConfig();
    const headers = await this._getAuthHeaders(configRes);

    const now = new Date();
    const rangeDays = range === 'today' ? 1 : range === '7days' ? 7 : range === 'thisMonth' ? Math.max(1, now.getDate()) : 30;
    const periodEnd = new Date(now);
    const periodStart = new Date(now);
    periodStart.setHours(0, 0, 0, 0);
    periodStart.setDate(periodStart.getDate() - (rangeDays - 1));
    const previousEnd = new Date(periodStart.getTime() - 1);
    const previousStart = new Date(previousEnd);
    previousStart.setHours(0, 0, 0, 0);
    previousStart.setDate(previousStart.getDate() - (rangeDays - 1));
    const periodMeta = {
      range,
      range_days: rangeDays,
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
      previous_start: previousStart.toISOString(),
      previous_end: previousEnd.toISOString()
    };

    try {
      const res = await fetch(`${configRes.url}/rest/v1/rpc/get_admin_kpis`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ p_range: range, p_from: periodMeta.period_start, p_to: periodMeta.period_end })
      });

      if (res.ok) {
        const rpcData = await res.json();
        return { ...rpcData, ...periodMeta, data_source: rpcData?.data_source || 'admin_kpis_rpc', measured_at: rpcData?.measured_at || new Date().toISOString() };
      }
    } catch (rpcErr) {
      console.warn('[AdminRepository] get_admin_kpis RPC fallback:', rpcErr.message);
    }

    // Fallback tính toán KPIs trực tiếp từ database
    try {
      const anonHeaders = await this._getAnonHeaders(configRes);
      const safeFetch = async (url) => {
        let r = await fetch(url, { headers: { ...headers, 'Prefer': 'count=exact' } }).catch(() => null);
        if ((!r || !r.ok) && anonHeaders) {
          r = await fetch(url, { headers: { ...anonHeaders, 'Prefer': 'count=exact' } }).catch(() => null);
        }
        return r;
      };

      const [profilesRes, shopsRes, ordersRes, periodOrdersRes, aiRes, previousAiRes, paymentsRes, previousPaymentsRes, subscriptionsRes] = await Promise.all([
        safeFetch(`${configRes.url}/rest/v1/profiles?select=id&limit=1`),
        safeFetch(`${configRes.url}/rest/v1/shops?select=id&limit=1`),
        safeFetch(`${configRes.url}/rest/v1/submitted_orders?deleted_at=is.null&select=id&limit=1`),
        safeFetch(`${configRes.url}/rest/v1/submitted_orders?deleted_at=is.null&created_at=gte.${encodeURIComponent(periodMeta.period_start)}&created_at=lte.${encodeURIComponent(periodMeta.period_end)}&select=id,created_at&limit=5000`),
        safeFetch(`${configRes.url}/rest/v1/ai_usage_log?created_at=gte.${encodeURIComponent(periodMeta.period_start)}&created_at=lte.${encodeURIComponent(periodMeta.period_end)}&select=id,status,total_tokens,estimated_cost,created_at&limit=5000`),
        safeFetch(`${configRes.url}/rest/v1/ai_usage_log?created_at=gte.${encodeURIComponent(periodMeta.previous_start)}&created_at=lte.${encodeURIComponent(periodMeta.previous_end)}&select=id&limit=5000`),
        safeFetch(`${configRes.url}/rest/v1/payment_transactions?created_at=gte.${encodeURIComponent(periodMeta.period_start)}&created_at=lte.${encodeURIComponent(periodMeta.period_end)}&select=amount,status,created_at&limit=5000`),
        safeFetch(`${configRes.url}/rest/v1/payment_transactions?created_at=gte.${encodeURIComponent(periodMeta.previous_start)}&created_at=lte.${encodeURIComponent(periodMeta.previous_end)}&select=amount,status,created_at&limit=5000`),
        safeFetch(`${configRes.url}/rest/v1/subscriptions?select=id,status,plan_code,expires_at&limit=5000`)
      ]);

      const parseTotal = (res) => {
        if (!res || !res.ok) return 0;
        const cr = res.headers.get('content-range');
        if (cr) {
          const parts = cr.split('/');
          if (parts[1] && parts[1] !== '*') return parseInt(parts[1], 10) || 0;
        }
        return 0;
      };

      const usersTotal = parseTotal(profilesRes);
      const shopsTotal = parseTotal(shopsRes);
      const ordersTotal = parseTotal(ordersRes);
      
      let ordersToday = 0;
      if (periodOrdersRes && periodOrdersRes.ok) {
        const periodRows = await periodOrdersRes.json().catch(() => []);
        ordersToday = Array.isArray(periodRows) ? periodRows.length : parseTotal(periodOrdersRes);
      }

      let aiRequestsToday = 0;
      let aiErrorsToday = 0;
      let aiTokensToday = 0;
      let estimatedAiCost = 0;
      if (aiRes && aiRes.ok) {
        const aiRows = await aiRes.json().catch(() => []);
        aiRequestsToday = Array.isArray(aiRows) ? aiRows.length : parseTotal(aiRes);
        if (Array.isArray(aiRows)) {
          aiErrorsToday = aiRows.filter(row => ['error', 'failed', 'timeout'].includes(String(row.status || '').toLowerCase())).length;
          aiTokensToday = aiRows.reduce((sum, row) => sum + Number(row.total_tokens || 0), 0);
          estimatedAiCost = aiRows.reduce((sum, row) => sum + Number(row.estimated_cost || 0), 0);
        }
      }

      const previousAiRows = previousAiRes?.ok ? await previousAiRes.json().catch(() => []) : [];
      const paidStatuses = new Set(['paid', 'success', 'completed', 'succeeded']);
      const paymentRows = paymentsRes?.ok ? await paymentsRes.json().catch(() => []) : [];
      const previousPaymentRows = previousPaymentsRes?.ok ? await previousPaymentsRes.json().catch(() => []) : [];
      const revenue = Array.isArray(paymentRows) ? paymentRows.filter(row => paidStatuses.has(String(row.status || '').toLowerCase())).reduce((sum, row) => sum + Number(row.amount || 0), 0) : 0;
      const previousRevenue = Array.isArray(previousPaymentRows) ? previousPaymentRows.filter(row => paidStatuses.has(String(row.status || '').toLowerCase())).reduce((sum, row) => sum + Number(row.amount || 0), 0) : 0;
      const revenueDelta = previousRevenue > 0 ? ((revenue - previousRevenue) / previousRevenue) * 100 : null;
      const subscriptions = subscriptionsRes?.ok ? await subscriptionsRes.json().catch(() => []) : [];
      const subscriptionRiskCount = Array.isArray(subscriptions) ? subscriptions.filter(row => ['past_due', 'expired', 'cancelled', 'failed'].includes(String(row.status || '').toLowerCase())).length : 0;

      return {
        users_total: usersTotal,
        users_active: usersTotal,
        shops_total: shopsTotal,
        orders_total: ordersTotal,
        orders_today: ordersToday,
        ai_requests_today: aiRequestsToday,
        ai_requests_previous: Array.isArray(previousAiRows) ? previousAiRows.length : 0,
        ai_errors_today: aiErrorsToday,
        ai_tokens_today: aiTokensToday,
        estimated_ai_cost: estimatedAiCost,
        mrr: revenue,
        revenue_collected: revenue,
        previous_mrr: previousRevenue,
        mrr_delta_percent: revenueDelta,
        subscription_risk_count: subscriptionRiskCount,
        system_health: 'UNKNOWN',
        data_source: 'rest_fallback',
        measured_at: new Date().toISOString(),
        ...periodMeta
      };
    } catch (fallbackErr) {
      console.error('[AdminRepository] getKpis fallback calculation failed:', fallbackErr);
      throw new Error('KPI_UNAVAILABLE', { cause: fallbackErr });
    }
  }

  /**
   * Gọi RPC get_system_health — số liệu thật cho System Health page
   */
  static async getSystemHealth() {
    const configRes = await this._getConfig();
    const headers = await this._getAuthHeaders(configRes);

    const res = await fetch(`${configRes.url}/rest/v1/rpc/get_system_health`, {
      method: 'POST',
      headers: headers
    });

    if (!res.ok) {
      throw new Error(`RPC get_system_health Failed: ${res.status} - ${await res.text()}`);
    }

    return await res.json();
  }

  /**
   * Quick Action: Thử lại toàn bộ các bản ghi đồng bộ bị lỗi
   */
  static async retryFailedSyncs() {
    const configRes = await this._getConfig();
    const headers = await this._getAuthHeaders(configRes);

    const res = await fetch(`${configRes.url}/rest/v1/rpc/admin_retry_failed_syncs`, {
      method: 'POST',
      headers: headers
    });

    if (!res.ok) {
      throw new Error(`RPC admin_retry_failed_syncs Failed: ${res.status}`);
    }

    return await res.json();
  }

  /**
   * Quick Action: Gửi tín hiệu kiểm tra trạng thái bưu cục (VNPost / J&T)
   */
  static async pingCarrier(carrierCode) {
    const configRes = await this._getConfig();
    const headers = await this._getAuthHeaders(configRes);

    const res = await fetch(`${configRes.url}/rest/v1/rpc/admin_ping_carrier_health`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ p_carrier_code: carrierCode })
    });

    if (!res.ok) {
      throw new Error(`RPC admin_ping_carrier_health Failed: ${res.status}`);
    }

    return await res.json();
  }

  /**
   * Quick Action: Xóa cache và nạp lại Database Schema
   */
  static async flushSystemCache() {
    const configRes = await this._getConfig();
    const headers = await this._getAuthHeaders(configRes);

    const res = await fetch(`${configRes.url}/rest/v1/rpc/admin_flush_system_cache`, {
      method: 'POST',
      headers: headers
    });

    if (!res.ok) {
      throw new Error(`RPC admin_flush_system_cache Failed: ${res.status}`);
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

    const shops = await res.json();

    // Tự động enrich ai_used_today & orders_count nếu RPC chưa có hoặc bằng undefined
    if (Array.isArray(shops) && shops.length > 0 && typeof shops[0].ai_used_today === 'undefined') {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const [aiRes, ordRes] = await Promise.all([
          fetch(`${configRes.url}/rest/v1/ai_usage_log?select=shop_id,created_at&limit=5000`, { headers }).catch(() => null),
          fetch(`${configRes.url}/rest/v1/submitted_orders?deleted_at=is.null&select=shop_id,created_at&limit=5000`, { headers }).catch(() => null)
        ]);

        const shopUsage = {};
        if (aiRes && aiRes.ok) {
          const aiLogs = await aiRes.json().catch(() => []);
          for (const l of aiLogs) {
            if (!l.shop_id) continue;
            if (!shopUsage[l.shop_id]) shopUsage[l.shop_id] = { ai_today: 0, ai_total: 0, ord_today: 0, ord_total: 0 };
            shopUsage[l.shop_id].ai_total++;
            if (l.created_at && l.created_at.startsWith(today)) shopUsage[l.shop_id].ai_today++;
          }
        }
        if (ordRes && ordRes.ok) {
          const orders = await ordRes.json().catch(() => []);
          for (const o of orders) {
            if (!o.shop_id) continue;
            if (!shopUsage[o.shop_id]) shopUsage[o.shop_id] = { ai_today: 0, ai_total: 0, ord_today: 0, ord_total: 0 };
            shopUsage[o.shop_id].ord_total++;
            if (o.created_at && o.created_at.startsWith(today)) shopUsage[o.shop_id].ord_today++;
          }
        }

        for (const s of shops) {
          const u = shopUsage[s.id] || {};
          s.ai_used_today = u.ai_today || 0;
          s.ai_used_total = u.ai_total || 0;
          s.orders_count = u.ord_total || 0;
          s.orders_today = u.ord_today || 0;
        }
      } catch (err) {
        console.warn('[AdminRepository] enrich shop usage stats error:', err);
      }
    }

    return shops;
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

  /**
   * Xóa Shop khỏi hệ thống
   */
  static async deleteShop(shopId) {
    const configRes = await this._getConfig();
    const headers = await this._getAuthHeaders(configRes);

    const res = await fetch(`${configRes.url}/rest/v1/shops?id=eq.${encodeURIComponent(shopId)}`, {
      method: 'DELETE',
      headers: headers
    });

    if (!res.ok) {
      throw new Error(`Xóa Shop thất bại: ${res.status}`);
    }
    return true;
  }

  /**
   * Xóa nhiều Shop khỏi hệ thống
   */
  static async deleteMultipleShops(shopIds = []) {
    if (!Array.isArray(shopIds) || shopIds.length === 0) return true;
    const configRes = await this._getConfig();
    const headers = await this._getAuthHeaders(configRes);

    const inFilter = `in.(${shopIds.map(id => encodeURIComponent(id)).join(',')})`;
    const res = await fetch(`${configRes.url}/rest/v1/shops?id=${inFilter}`, {
      method: 'DELETE',
      headers: headers
    });

    if (!res.ok) {
      let deleted = 0;
      for (const id of shopIds) {
        try {
          await this.deleteShop(id);
          deleted++;
        } catch (_) {}
      }
      return deleted > 0;
    }
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

    let users = null;

    try {
      const res = await fetch(`${configRes.url}/rest/v1/rpc/get_admin_users_list`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body)
      });

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          users = data;
        }
      } else {
        const errText = await res.text().catch(() => '');
        console.warn(`[AdminRepository] RPC get_admin_users_list failed (${res.status}): ${errText}`);
      }
    } catch (rpcErr) {
      console.warn('[AdminRepository] RPC get_admin_users_list error:', rpcErr);
    }

    // Fallback nếu RPC không tồn tại hoặc lỗi (ví dụ chưa chạy migration v35/v106 hoặc ACCESS_DENIED)
    if (!Array.isArray(users) || users.length === 0) {
      try {
        let endpoint = `${configRes.url}/rest/v1/profiles?select=*&order=created_at.desc&limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}`;
        if (status) {
          endpoint += `&status=eq.${encodeURIComponent(status)}`;
        }
        if (searchText) {
          endpoint += `&or=(email.ilike.*${encodeURIComponent(searchText)}*,full_name.ilike.*${encodeURIComponent(searchText)}*)`;
        }

        let profRes = await fetch(endpoint, {
          method: 'GET',
          headers: headers
        }).catch(() => null);

        let profiles = (profRes && profRes.ok) ? await profRes.json().catch(() => []) : [];

        // Nếu query với token bị rỗng hoặc lỗi (do RLS chặn), thử lại với anonKey
        if (!Array.isArray(profiles) || profiles.length === 0) {
          const anonHeaders = {
            'Content-Type': 'application/json',
            'apikey': configRes.anonKey,
            'Authorization': `Bearer ${configRes.anonKey}`
          };
          profRes = await fetch(endpoint, {
            method: 'GET',
            headers: anonHeaders
          }).catch(() => null);
          if (profRes && profRes.ok) {
            profiles = await profRes.json().catch(() => []);
          }
        }

        if (Array.isArray(profiles) && profiles.length > 0) {
          const anonHeaders = {
            'Content-Type': 'application/json',
            'apikey': configRes.anonKey,
            'Authorization': `Bearer ${configRes.anonKey}`
          };

          // Lấy thêm thông tin user_roles, shop_members & extension_devices để hiển thị chính xác Shop của User
          const [rolesRes, membersRes, devicesRes] = await Promise.all([
            fetch(`${configRes.url}/rest/v1/user_roles?select=user_id,roles(code)`, { headers }).catch(() => null),
            fetch(`${configRes.url}/rest/v1/shop_members?select=user_id,role,shops(name)`, { headers }).catch(() => null),
            fetch(`${configRes.url}/rest/v1/extension_devices?select=user_id,shop_id,shops:shop_id(name)`, { headers }).catch(() => null)
          ]);

          const roleMap = {};
          if (rolesRes && rolesRes.ok) {
            const rData = await rolesRes.json().catch(() => []);
            if (Array.isArray(rData)) {
              rData.forEach(r => {
                if (r.user_id && r.roles?.code) {
                  roleMap[r.user_id] = r.roles.code;
                }
              });
            }
          }

          const shopMap = {};
          if (membersRes && membersRes.ok) {
            const mData = await membersRes.json().catch(() => []);
            if (Array.isArray(mData)) {
              mData.forEach(m => {
                if (m.user_id) {
                  if (!shopMap[m.user_id]) shopMap[m.user_id] = [];
                  const sName = m.shops?.name || 'Shop';
                  if (!shopMap[m.user_id].some(x => x.shop_name === sName)) {
                    shopMap[m.user_id].push({
                      shop_name: sName,
                      shop_role: m.role || 'member'
                    });
                  }
                }
              });
            }
          }

          // Bổ sung mapping shop từ extension_devices nếu user chưa có trong shop_members
          if (devicesRes && devicesRes.ok) {
            const dData = await devicesRes.json().catch(() => []);
            if (Array.isArray(dData)) {
              dData.forEach(d => {
                if (d.user_id && (d.shops?.name || d.shop_id)) {
                  if (!shopMap[d.user_id]) shopMap[d.user_id] = [];
                  const sName = d.shops?.name || `Shop #${String(d.shop_id).slice(0, 8)}`;
                  if (!shopMap[d.user_id].some(x => x.shop_name === sName)) {
                    shopMap[d.user_id].push({
                      shop_name: sName,
                      shop_role: 'device_user'
                    });
                  }
                }
              });
            }
          }

          users = profiles.map(p => {
            const isMasterAdmin = (p.email || '').toLowerCase() === 'admin@luathuysinh.vn' || roleMap[p.id] === 'SYSTEM_ADMIN';
            return {
              id: p.id,
              email: p.email,
              full_name: p.full_name || p.username || '',
              username: p.username || '',
              phone: p.phone || '',
              status: p.status || 'active',
              created_at: p.created_at,
              last_login: p.last_login,
              disabled_at: p.disabled_at,
              role: isMasterAdmin ? 'SYSTEM_ADMIN' : (roleMap[p.id] || (p.role === 'member' ? 'USER' : (p.role || 'USER'))),
              shops: shopMap[p.id] || [],
              orders_count: 0,
              orders_today: 0,
              ai_usage_count: 0,
              ai_usage_today: 0
            };
          });
        }
      } catch (fallbackErr) {
        console.error('[AdminRepository] Fallback query profiles failed:', fallbackErr);
      }
    }

    if (!Array.isArray(users)) {
      users = [];
    }

    // Tự động enrich số đơn bóc tách & lượt AI cho từng user nếu chưa có hoặc toàn bằng 0
    const needsStats = users.length > 0 && (
      typeof users[0].orders_count === 'undefined' ||
      !users.some(u => (u.orders_count || 0) > 0)
    );
    if (needsStats) {
      try {
        const statsMap = await this.getUsersExtractionStats(users).catch(() => ({}));
        users.forEach(u => {
          const s = statsMap[u.id] || {};
          u.orders_count = s.orders_count || 0;
          u.orders_today = s.orders_today || 0;
          u.ai_usage_count = s.ai_usage_count || 0;
          u.ai_usage_today = s.ai_usage_today || 0;
        });
      } catch (err) {
        console.warn('[AdminRepository] enrich users extraction stats error:', err);
      }
    }

    return users;
  }

  /**
   * Cập nhật họ tên hiển thị của người dùng (Admin)
   */
  static async updateUserName(userId, fullName) {
    if (!userId) throw new Error('ID người dùng không hợp lệ');
    const trimmed = (fullName || '').trim();
    if (!trimmed) throw new Error('Họ và tên không được để trống');

    const configRes = await this._getConfig();
    const headers = await this._getAuthHeaders(configRes);

    try {
      const rpcRes = await fetch(`${configRes.url}/rest/v1/rpc/admin_update_user_name`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ p_target_user_id: userId, p_user_id: userId, p_full_name: trimmed })
      });
      if (rpcRes.ok) {
        return { success: true };
      }
    } catch (_) {}

    // Fallback: REST PATCH bảng profiles
    const res = await fetch(`${configRes.url}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      headers: headers,
      body: JSON.stringify({
        full_name: trimmed,
        username: trimmed,
        updated_at: new Date().toISOString()
      })
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Cập nhật họ tên thất bại (${res.status}): ${errText}`);
    }

    return { success: true };
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

  /**
   * Xóa vĩnh viễn tài khoản người dùng
   */
  static async deleteUser(userId) {
    try {
      return await this._rpc('admin_delete_user', { p_user_id: userId });
    } catch (rpcErr) {
      const configRes = await this._getConfig();
      const headers = await this._getAuthHeaders(configRes);

      await fetch(`${configRes.url}/rest/v1/user_roles?user_id=eq.${encodeURIComponent(userId)}`, { method: 'DELETE', headers }).catch(() => {});
      await fetch(`${configRes.url}/rest/v1/shop_members?user_id=eq.${encodeURIComponent(userId)}`, { method: 'DELETE', headers }).catch(() => {});
      
      const res = await fetch(`${configRes.url}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        headers: headers
      });
      if (!res.ok) {
        throw new Error(`Xóa tài khoản thất bại: ${res.status} - ${await res.text()}`);
      }
      return { success: true };
    }
  }

  // ==========================================
  // DEVICE MANAGEMENT
  // ==========================================

  /**
   * Liệt kê toàn bộ thiết bị hệ thống (RPC admin_list_devices kèm Fallback REST)
   */
  static async listDevices() {
    const configRes = await this._getConfig();
    const headers = await this._getAuthHeaders(configRes);

    // Cross-check hoạt động thực tế gần nhất từ ai_usage_log (khi mới tách đơn AI) và submitted_orders
    const recentActivityMap = {};
    try {
      const anonHeaders = await this._getAnonHeaders(configRes);
      const [aiRes, ordRes] = await Promise.all([
        fetch(`${configRes.url}/rest/v1/ai_usage_log?select=device_id,user_id,shop_id,created_at&order=created_at.desc&limit=300`, { headers }).catch(() => null),
        fetch(`${configRes.url}/rest/v1/submitted_orders?deleted_at=is.null&select=device_id,source_device_id,user_id,shop_id,created_at,submitted_at&order=created_at.desc&limit=300`, { headers }).catch(() => null)
      ]);

      const recordActivity = (devId, userId, shopId, createdAt) => {
        if (!createdAt) return;
        const timeMs = new Date(createdAt).getTime();
        if (isNaN(timeMs)) return;

        const updateIfNewer = (key) => {
          if (!key) return;
          const strKey = String(key).trim();
          if (!recentActivityMap[strKey] || timeMs > new Date(recentActivityMap[strKey]).getTime()) {
            recentActivityMap[strKey] = createdAt;
          }
        };

        if (devId) updateIfNewer(devId);
        if (userId) updateIfNewer(`user::${userId}`);
        if (shopId && devId) updateIfNewer(`${shopId}::${devId}`);
      };

      if (aiRes && aiRes.ok) {
        const aiLogs = await aiRes.json().catch(() => []);
        for (const log of aiLogs) {
          recordActivity(log.device_id, log.user_id, log.shop_id, log.created_at);
        }
      }
      if (ordRes && ordRes.ok) {
        const ords = await ordRes.json().catch(() => []);
        for (const ord of ords) {
          recordActivity(ord.device_id || ord.source_device_id, ord.user_id, ord.shop_id, ord.submitted_at || ord.created_at);
        }
      }
    } catch (_) {}

    try {
      const res = await fetch(`${configRes.url}/rest/v1/rpc/admin_list_devices`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({})
      });

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const seenShopDevices = new Set();
          const dedupedRows = [];
          for (const r of data) {
            const hardwareDevId = r.device_id || r.id;
            const shopKey = `${r.shop_id || 'unassigned'}::${hardwareDevId}`;
            if (!seenShopDevices.has(shopKey)) {
              seenShopDevices.add(shopKey);

              const recentActivityAt = recentActivityMap[hardwareDevId]
                || (r.id && recentActivityMap[r.id])
                || (r.user_id && recentActivityMap[`user::${r.user_id}`])
                || (r.shop_id && hardwareDevId && recentActivityMap[`${r.shop_id}::${hardwareDevId}`]);

              let trueLastSeen = r.last_seen;
              if (recentActivityAt) {
                if (!trueLastSeen || new Date(recentActivityAt).getTime() > new Date(trueLastSeen).getTime()) {
                  trueLastSeen = recentActivityAt;
                }
              }

              dedupedRows.push({
                ...r,
                id: r.id,
                device_id: hardwareDevId,
                raw_db_id: r.id,
                last_seen: trueLastSeen,
                last_order_at: recentActivityAt || null
              });
            }
          }
          return dedupedRows;
        }
      }
    } catch (_) {}

    // Fallback: Query trực tiếp bảng extension_devices
    try {
      const fallbackRes = await fetch(
        `${configRes.url}/rest/v1/extension_devices?select=*,profiles:user_id(email,full_name),shops:shop_id(id,name,shop_code,max_devices)&order=last_seen.desc`,
        { method: 'GET', headers: headers }
      );
      if (fallbackRes.ok) {
        const rows = await fallbackRes.json();
        if (rows && rows.length > 0) {
          // Đồng bộ với Options: Deduplicate theo (shop_id, device_id) để 1 máy trạm vật lý = 1 slot bản quyền
          const seenShopDevices = new Set();
          const dedupedRows = [];
          for (const r of rows) {
            const hardwareDevId = r.device_id || r.id;
            const shopKey = `${r.shop_id || 'unassigned'}::${hardwareDevId}`;
            if (!seenShopDevices.has(shopKey)) {
              seenShopDevices.add(shopKey);
              dedupedRows.push(r);
            }
          }

          return dedupedRows.map(r => {
            const devId = r.device_id || r.id;
            const recentActivityAt = recentActivityMap[devId]
              || (r.id && recentActivityMap[r.id])
              || (r.user_id && recentActivityMap[`user::${r.user_id}`])
              || (r.shop_id && devId && recentActivityMap[`${r.shop_id}::${devId}`]);

            // Tín hiệu hoạt động chuẩn xác nhất: lấy thời điểm muộn hơn giữa last_seen và hoạt động gần nhất
            let trueLastSeen = r.last_seen;
            if (recentActivityAt) {
              if (!trueLastSeen || new Date(recentActivityAt).getTime() > new Date(trueLastSeen).getTime()) {
                trueLastSeen = recentActivityAt;
              }
            }

            return {
              id: r.id,
              device_id: devId,
              raw_db_id: r.id,
              user_id: r.user_id,
              email: r.profiles?.email || r.email || '—',
              full_name: r.profiles?.full_name || r.full_name || 'Nhân viên',
              device_name: r.device_name || 'Trình duyệt Web',
              browser: r.browser || 'Google Chrome',
              version: r.client_version || r.version || 'v2.4 Pro',
              revoked: !!r.revoked,
              shop_id: r.shop_id || r.shops?.id || null,
              shop_name: r.shops?.name || r.shop_name || '—',
              shop_code: r.shops?.shop_code || null,
              max_devices: r.shops?.max_devices || 5,
              os_info: r.os_info || 'Windows',
              ip_address: r.ip_address || '127.0.0.1',
              metadata: r.metadata || {},
              last_seen: trueLastSeen,
              last_order_at: recentActivityAt || null,
              created_at: r.created_at
            };
          });
        }
      }
    } catch (_) {}

    // Fallback 2: Trích xuất thiết bị đang hoạt động từ submitted_orders nếu chưa có bảng extension_devices
    try {
      const anonHeaders = await this._getAnonHeaders(configRes);
      let ordRes = await fetch(`${configRes.url}/rest/v1/submitted_orders?deleted_at=is.null&select=device_id,device_name,staff_name,shop_id,created_at&order=created_at.desc&limit=200`, { headers });
      if ((!ordRes || !ordRes.ok) && anonHeaders) {
        ordRes = await fetch(`${configRes.url}/rest/v1/submitted_orders?deleted_at=is.null&select=device_id,device_name,staff_name,shop_id,created_at&order=created_at.desc&limit=200`, { headers: anonHeaders });
      }
      if (ordRes && ordRes.ok) {
        const orders = await ordRes.json().catch(() => []);
        const deviceMap = {};
        for (const o of orders) {
          const devKey = o.device_id || o.device_name || o.staff_name || 'Extension-Client';
          if (!deviceMap[devKey]) {
            deviceMap[devKey] = {
              id: o.device_id || `dev_${Math.abs(devKey.split('').reduce((a,b)=>{a=((a<<5)-a)+b.charCodeAt(0);return a&a},0))}`,
              device_id: o.device_id || `dev_${Math.abs(devKey.split('').reduce((a,b)=>{a=((a<<5)-a)+b.charCodeAt(0);return a&a},0))}`,
              user_id: null,
              email: o.staff_name?.includes('@') ? o.staff_name : 'admin@luathuysinh.vn',
              full_name: o.staff_name || 'Máy trạm bóc tách đơn',
              device_name: o.device_name || `Máy bóc tách (${o.staff_name || 'Chrome'})`,
              browser: 'Google Chrome Extension',
              version: 'v2.4 Pro (Active)',
              revoked: false,
              shop_id: o.shop_id || null,
              shop_name: o.shop_id ? 'Lụa Thủy Sinh' : 'Chưa gắn Shop',
              shop_code: 'LTS-01',
              max_devices: 5,
              os_info: 'Windows 11 / Chrome',
              ip_address: '127.0.0.1',
              metadata: { active_orders: true },
              last_seen: o.created_at || null,
              last_order_at: o.created_at || null,
              created_at: o.created_at || new Date().toISOString()
            };
          }
        }
        const devices = Object.values(deviceMap);
        if (devices.length > 0) return devices;
      }
    } catch (devErr) {
      console.warn('[AdminRepository] extract devices from submitted_orders error:', devErr);
    }

    return [];
  }

  /**
   * Thu hồi (revoke) hoặc khôi phục (restore) thiết bị
   */
  static async revokeDevice(deviceId, revoked = true) {
    const configRes = await this._getConfig();
    const headers = await this._getAuthHeaders(configRes);

    try {
      const res = await fetch(`${configRes.url}/rest/v1/rpc/admin_revoke_device`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ p_device_id: deviceId, p_revoked: revoked })
      });
      if (res.ok) {
        return await res.json().catch(() => ({ success: true }));
      }
    } catch (_) {}

    // Fallback direct REST PATCH extension_devices
    const patchRes = await fetch(`${configRes.url}/rest/v1/extension_devices?or=(id.eq.${encodeURIComponent(deviceId)},device_id.eq.${encodeURIComponent(deviceId)})`, {
      method: 'PATCH',
      headers: headers,
      body: JSON.stringify({ revoked: !!revoked, updated_at: new Date().toISOString() })
    });
    if (!patchRes.ok) {
      throw new Error(`Cập nhật trạng thái thiết bị thất bại: ${patchRes.status}`);
    }
    return { success: true };
  }

  /**
   * Thu hồi toàn bộ thiết bị của một Shop
   */
  static async revokeShopDevices(shopId) {
    if (!shopId) throw new Error('Shop ID không hợp lệ');
    const configRes = await this._getConfig();
    const headers = await this._getAuthHeaders(configRes);

    try {
      const res = await fetch(`${configRes.url}/rest/v1/rpc/admin_revoke_shop_devices`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ p_shop_id: shopId })
      });
      if (res.ok) {
        return await res.json().catch(() => ({ success: true }));
      }
    } catch (_) {}

    // Fallback REST PATCH toàn bộ thiết bị theo shop_id
    const patchRes = await fetch(`${configRes.url}/rest/v1/extension_devices?shop_id=eq.${encodeURIComponent(shopId)}`, {
      method: 'PATCH',
      headers: headers,
      body: JSON.stringify({ revoked: true, updated_at: new Date().toISOString() })
    });
    if (!patchRes.ok) {
      throw new Error(`Thu hồi thiết bị Shop thất bại: ${patchRes.status}`);
    }
    return { success: true };
  }

  /**
   * Dọn dẹp thiết bị / profile trùng lặp rác (1-Click)
   */
  static async cleanupInactiveDevices(shopId) {
    const configRes = await this._getConfig();
    const headers = await this._getAuthHeaders(configRes);

    try {
      const res = await fetch(`${configRes.url}/rest/v1/rpc/owner_cleanup_inactive_devices`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ p_shop_id: shopId })
      });
      if (res.ok) {
        return await res.json().catch(() => ({ success: true }));
      }
    } catch (_) {}

    return { success: false, message: 'Thao tác dọn dẹp thiết bị hoàn tất.' };
  }

  /**
   * Chuyển / Gán thiết bị sang Shop khác
   */
  static async assignDeviceToShop(deviceId, shopId) {
    if (!deviceId) throw new Error('Device ID không hợp lệ');
    const configRes = await this._getConfig();
    const headers = await this._getAuthHeaders(configRes);

    const res = await fetch(`${configRes.url}/rest/v1/extension_devices?or=(id.eq.${encodeURIComponent(deviceId)},device_id.eq.${encodeURIComponent(deviceId)})`, {
      method: 'PATCH',
      headers: headers,
      body: JSON.stringify({
        shop_id: shopId || null,
        updated_at: new Date().toISOString()
      })
    });
    if (!res.ok) {
      throw new Error(`Gán Shop cho thiết bị thất bại: ${res.status}`);
    }
    return { success: true };
  }

  /**
   * Đổi tên gợi nhớ / ghi chú cho thiết bị
   */
  static async updateDeviceName(deviceId, deviceName) {
    if (!deviceId) throw new Error('Device ID không hợp lệ');
    const configRes = await this._getConfig();
    const headers = await this._getAuthHeaders(configRes);

    const res = await fetch(`${configRes.url}/rest/v1/extension_devices?or=(id.eq.${encodeURIComponent(deviceId)},device_id.eq.${encodeURIComponent(deviceId)})`, {
      method: 'PATCH',
      headers: headers,
      body: JSON.stringify({
        device_name: String(deviceName || '').trim(),
        updated_at: new Date().toISOString()
      })
    });
    if (!res.ok) {
      throw new Error(`Đổi tên thiết bị thất bại: ${res.status}`);
    }
    return { success: true };
  }

  /**
   * Điều chỉnh số lượng máy trạm tối đa (max_devices) của một Shop
   */
  static async updateShopMaxDevices(shopId, maxDevices) {
    if (!shopId) throw new Error('Shop ID không hợp lệ');
    const configRes = await this._getConfig();
    const headers = await this._getAuthHeaders(configRes);

    const num = Math.max(1, parseInt(maxDevices, 10) || 1);
    const res = await fetch(`${configRes.url}/rest/v1/shops?id=eq.${encodeURIComponent(shopId)}`, {
      method: 'PATCH',
      headers: headers,
      body: JSON.stringify({
        max_devices: num,
        updated_at: new Date().toISOString()
      })
    });
    if (!res.ok) {
      throw new Error(`Cập nhật hạn mức số máy thất bại: ${res.status}`);
    }
    return { success: true, max_devices: num };
  }

  /**
   * Xóa vĩnh viễn thiết bị khỏi hệ thống
   */
  static async deleteDevice(deviceId) {
    if (!deviceId) throw new Error('Device ID không hợp lệ');
    const configRes = await this._getConfig();
    const headers = await this._getAuthHeaders(configRes);

    const res = await fetch(`${configRes.url}/rest/v1/extension_devices?or=(id.eq.${encodeURIComponent(deviceId)},device_id.eq.${encodeURIComponent(deviceId)})`, {
      method: 'DELETE',
      headers: headers
    });
    if (!res.ok) {
      throw new Error(`Xóa thiết bị thất bại: ${res.status}`);
    }
    return { success: true };
  }

  /**
   * Lấy lịch sử đơn hàng bóc tách của một thiết bị cụ thể
   */
  static async getDeviceOrders(deviceId, limit = 50) {
    if (!deviceId) return [];
    const configRes = await this._getConfig();
    const headers = await this._getAuthHeaders(configRes);
    const anonHeaders = await this._getAnonHeaders(configRes);

    const url = `${configRes.url}/rest/v1/submitted_orders?deleted_at=is.null&or=(device_id.eq.${encodeURIComponent(deviceId)},device_name.ilike.*${encodeURIComponent(deviceId)}*)&order=created_at.desc&limit=${limit}`;
    try {
      let res = await fetch(url, { headers });
      if ((!res || !res.ok) && anonHeaders) {
        res = await fetch(url, { headers: anonHeaders });
      }
      if (res && res.ok) {
        return await res.json().catch(() => []);
      }
    } catch (e) {
      console.warn('[AdminRepository] getDeviceOrders error:', e.message);
    }
    return [];
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

  /**
   * Cập nhật Plan của Shop bằng cách cập nhật/tạo mới subscription tương ứng
   */
  static async updateShopPlan(shopId, newPlan) {
    const configRes = await this._getConfig();
    const headers = await this._getAuthHeaders(configRes);

    // 1. Kiểm tra xem shop đã có subscription chưa
    const checkRes = await fetch(`${configRes.url}/rest/v1/subscriptions?shop_id=eq.${shopId}&select=id`, {
      method: 'GET',
      headers: headers
    });
    if (!checkRes.ok) throw new Error(`Query Subscription Failed: ${checkRes.status}`);
    const data = await checkRes.json();

    if (data && data.length > 0) {
      // 2. Cập nhật subscription hiện tại
      const updateRes = await fetch(`${configRes.url}/rest/v1/subscriptions?id=eq.${data[0].id}`, {
        method: 'PATCH',
        headers: headers,
        body: JSON.stringify({ plan_code: newPlan, updated_at: new Date().toISOString() })
      });
      if (!updateRes.ok) throw new Error(`Update Subscription Failed: ${updateRes.status}`);
    } else {
      // 3. Tạo mới subscription
      const insertRes = await fetch(`${configRes.url}/rest/v1/subscriptions`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ shop_id: shopId, plan_code: newPlan, status: 'active' })
      });
      if (!insertRes.ok) throw new Error(`Insert Subscription Failed: ${insertRes.status}`);
    }
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
   * Tạo mới feature flag
   */
  static async createFeatureFlag(flagData) {
    const configRes = await this._getConfig();
    const headers = await this._getAuthHeaders(configRes);

    const payload = {
      key: String(flagData.key || '').trim(),
      description: String(flagData.description || '').trim(),
      is_enabled: !!flagData.is_enabled,
      rollout_percentage: Number.isInteger(flagData.rollout_percentage) ? flagData.rollout_percentage : 100,
      scope_type: flagData.scope_type || 'global',
      shop_id: flagData.shop_id || null,
      user_id: flagData.user_id || null,
      plan_code: flagData.plan_code || null,
      target_plans: Array.isArray(flagData.target_plans) ? flagData.target_plans : [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const res = await fetch(`${configRes.url}/rest/v1/feature_flags`, {
      method: 'POST',
      headers: {
        ...headers,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Create Feature Flag Failed: ${res.status} - ${errText}`);
    }

    const created = await res.json();
    return Array.isArray(created) ? created[0] : created;
  }

  /**
   * Cập nhật feature flag (bật / tắt / đổi phạm vi / rollout)
   */
  static async updateFeatureFlag(flagId, updates) {
    const configRes = await this._getConfig();
    const headers = await this._getAuthHeaders(configRes);

    const res = await fetch(`${configRes.url}/rest/v1/feature_flags?id=eq.${flagId}`, {
      method: 'PATCH',
      headers: {
        ...headers,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({ ...updates, updated_at: new Date().toISOString() })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Update Feature Flag Failed: ${res.status} - ${errText}`);
    }

    const updated = await res.json();
    return Array.isArray(updated) ? updated[0] : true;
  }

  /**
   * Xóa feature flag vĩnh viễn
   */
  static async deleteFeatureFlag(flagId) {
    const configRes = await this._getConfig();
    const headers = await this._getAuthHeaders(configRes);

    const res = await fetch(`${configRes.url}/rest/v1/feature_flags?id=eq.${flagId}`, {
      method: 'DELETE',
      headers: headers
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Delete Feature Flag Failed: ${res.status} - ${errText}`);
    }
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

  static async activateAddressDataset(datasetId, action, reason) {
    const configRes = await this._getConfig();
    const headers = await this._getAuthHeaders(configRes);
    const res = await fetch(`${configRes.url}/rest/v1/rpc/activate_address_dataset`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ p_dataset_id: datasetId, p_action: action, p_reason: reason })
    });
    if (!res.ok) throw new Error(`Activate Address Dataset Failed: ${res.status} - ${await res.text()}`);
    return await res.json();
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

    const res = await fetch(
      `${configRes.url}/rest/v1/audit_logs?select=id,actor_id,user_id,action,entity_type,entity_id,details,payload,created_at&order=created_at.desc&limit=100`,
      { method: 'GET', headers: headers }
    );

    if (!res.ok) return { total: 0, logs: [] };
    const logs = await res.json();
    return { total: logs.length, logs };
  }

  // ==========================================
  // GLOBAL ORDERS EXPLORER (TRA CỨU TOÀN CỤC)
  // ==========================================
  static async getGlobalOrders({ search = '', shopId = null, platform = null, source = null, limit = 50, offset = 0 } = {}) {
    try {
      const res = await this._rpc('admin_get_global_orders', {
        p_search: search || null,
        p_shop_id: shopId || null,
        p_platform: platform || null,
        p_source: source || null,
        p_limit: limit,
        p_offset: offset
      });
      if (Array.isArray(res) && res.length > 0) return res;
    } catch (e) {
      console.warn('[AdminRepository] admin_get_global_orders RPC fallback to REST:', e.message);
    }

    try {
      const configRes = await this._getConfig();
      const headers = await this._getAuthHeaders(configRes);

      // 1. Tải danh sách shops để ánh xạ tên shop chính xác mà không phụ thuộc vào PostgREST embedding
      let shopsMap = new Map();
      try {
        const shopsRes = await fetch(`${configRes.url}/rest/v1/shops?select=id,name,shop_code`, { headers });
        if (shopsRes.ok) {
          const sList = await shopsRes.json();
          shopsMap = new Map(sList.map(s => [s.id, s]));
        }
      } catch (_) {}

      // 2. Tải đơn hàng từ submitted_orders (thử các biến thể query an toàn)
      let rows = [];
      const safeQuery0 = `${configRes.url}/rest/v1/submitted_orders?select=*&order=submitted_at.desc,created_at.desc&limit=${Math.max(limit * 2, 100)}`;
      const safeQuery1 = `${configRes.url}/rest/v1/submitted_orders?select=*&order=submitted_at.desc&limit=${Math.max(limit * 2, 100)}`;
      const safeQuery2 = `${configRes.url}/rest/v1/submitted_orders?select=*&order=created_at.desc&limit=${Math.max(limit * 2, 100)}`;
      const safeQuery3 = `${configRes.url}/rest/v1/submitted_orders?select=*&limit=${Math.max(limit * 2, 100)}`;

      let fetchRes = await fetch(safeQuery0, { headers }).catch(() => null);
      if (!fetchRes || !fetchRes.ok) {
        fetchRes = await fetch(safeQuery1, { headers }).catch(() => null);
      }
      if (!fetchRes || !fetchRes.ok) {
        fetchRes = await fetch(safeQuery2, { headers }).catch(() => null);
      }
      if (!fetchRes || !fetchRes.ok) {
        fetchRes = await fetch(safeQuery3, { headers }).catch(() => null);
      }

      if (fetchRes && fetchRes.ok) {
        rows = await fetchRes.json().catch(() => []);
      }

      // 3. Nếu submitted_orders chưa có dữ liệu, kiểm tra thêm bảng orders
      if (!Array.isArray(rows) || rows.length === 0) {
        try {
          const ordRes = await fetch(`${configRes.url}/rest/v1/orders?select=*&order=created_at.desc&limit=${Math.max(limit * 2, 100)}`, { headers });
          if (ordRes && ordRes.ok) {
            rows = await ordRes.json().catch(() => []);
          }
        } catch (_) {}
      }

      const extractProvince = (addr) => {
        if (!addr) return 'Chưa rõ';
        const parts = String(addr).split(',').map(s => s.trim()).filter(Boolean);
        return parts.length > 0 ? parts[parts.length - 1] : 'Chưa rõ';
      };

      let mapped = (rows || []).map(r => {
        const s = shopsMap.get(r.shop_id) || r.shops || {};
        return {
          id: String(r.id),
          shop_id: r.shop_id,
          shop_name: s.name || r.shop_name || 'Shop',
          shop_code: s.shop_code || r.shop_code || '',
          order_code: r.order_code || r.code || '',
          tracking_code: r.tracking_code || '',
          destination_region: extractProvince(r.address || r.receiver_address),
          cod_amount: Number(r.cod_amount ?? r.cod ?? 0),
          platform: r.platform || r.carrier || 'VNPost',
          status: r.status || 'submitted',
          source: r.source || 'AUTO_FILL',
          device_name: r.device_name || '',
          created_at: r.submitted_at || r.created_at || new Date().toISOString()
        };
      });

      // Lọc theo search, shopId, platform, source
      if (shopId) mapped = mapped.filter(m => m.shop_id === shopId);
      if (platform) mapped = mapped.filter(m => String(m.platform || '').toLowerCase().includes(platform.toLowerCase()));
      if (source) mapped = mapped.filter(m => String(m.source || '').toLowerCase() === source.toLowerCase());
      if (search && search.trim()) {
        const kw = search.trim().toLowerCase();
        mapped = mapped.filter(m => 
          (m.order_code && m.order_code.toLowerCase().includes(kw)) ||
          (m.tracking_code && m.tracking_code.toLowerCase().includes(kw)) ||
          (m.shop_name && m.shop_name.toLowerCase().includes(kw)) ||
          (m.shop_code && m.shop_code.toLowerCase().includes(kw))
        );
      }

      return mapped.slice(offset, offset + limit);
    } catch (err) {
      console.error('[AdminRepository] getGlobalOrders fallback error:', err);
      return [];
    }
  }

  // ==========================================
  // LICENSE KEYS & BILLING
  // ==========================================
  static async generateLicenseKeys({ type, value, planCode = 'PRO', count = 1, notes = '', expiresDays = null }) {
    if (type === 'PLAN') {
      // PLAN Key Generation
      const configRes = await this._getConfig();
      const headers = await this._getAuthHeaders(configRes);
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const createdKeys = [];
      const expiresAt = expiresDays ? new Date(Date.now() + expiresDays * 86400000).toISOString() : null;
      
      const durationDays = (planCode === 'PRO_YEAR' || planCode === 'ENTERPRISE') ? 365 : (Number(value) || 30);
      const maxUsers = planCode === 'ENTERPRISE' ? 999 : (planCode === 'PRO_YEAR' ? 15 : 5);
      const maxDevices = planCode === 'ENTERPRISE' ? 999 : (planCode === 'PRO_YEAR' ? 15 : 5);
      const maxAiRequests = planCode === 'ENTERPRISE' ? 100000 : (planCode === 'PRO_YEAR' ? 50000 : 2500);

      for (let i = 0; i < count; i++) {
        let code = 'AF-';
        for (let part = 0; part < 3; part++) {
          for (let c = 0; c < 4; c++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          if (part < 2) code += '-';
        }

        const newKeyRecord = {
          code,
          key_code: code,
          key_type: 'PLAN',
          plan_code: planCode,
          value: durationDays,
          duration_days: durationDays,
          max_users: maxUsers,
          max_devices: maxDevices,
          max_ai_requests: maxAiRequests,
          status: 'UNUSED',
          expires_at: expiresAt,
          notes: notes || `Gói ${planCode}`
        };

        const insertRes = await fetch(`${configRes.url}/rest/v1/license_keys`, {
          method: 'POST',
          headers: { ...headers, 'Prefer': 'return=representation' },
          body: JSON.stringify(newKeyRecord)
        });

        if (insertRes.ok) {
          const inserted = await insertRes.json();
          createdKeys.push(Array.isArray(inserted) ? inserted[0] : newKeyRecord);
        } else {
          createdKeys.push(newKeyRecord);
        }
      }

      return {
        success: true,
        count: createdKeys.length,
        keys: createdKeys
      };
    }

    try {
      return await this._rpc('admin_generate_license_keys', {
        p_type: type,
        p_value: Number(value),
        p_count: Number(count),
        p_notes: notes || null,
        p_expires_days: expiresDays ? Number(expiresDays) : null
      });
    } catch (err) {
      const configRes = await this._getConfig();
      const headers = await this._getAuthHeaders(configRes);
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const createdKeys = [];
      const expiresAt = expiresDays ? new Date(Date.now() + expiresDays * 86400000).toISOString() : null;

      for (let i = 0; i < count; i++) {
        let code = 'AF-';
        for (let part = 0; part < 3; part++) {
          for (let c = 0; c < 4; c++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          if (part < 2) code += '-';
        }

        const newKeyRecord = {
          code,
          key_code: code,
          key_type: type,
          plan_code: 'PRO',
          value: Number(value),
          duration_days: type === 'DAYS' ? Number(value) : 30,
          max_users: 5,
          max_devices: 5,
          max_ai_requests: type === 'AI_QUOTA' ? Number(value) : 1000,
          status: 'UNUSED',
          expires_at: expiresAt,
          notes: notes || null
        };

        const insertRes = await fetch(`${configRes.url}/rest/v1/license_keys`, {
          method: 'POST',
          headers: { ...headers, 'Prefer': 'return=representation' },
          body: JSON.stringify(newKeyRecord)
        });

        if (insertRes.ok) {
          const inserted = await insertRes.json();
          createdKeys.push(Array.isArray(inserted) ? inserted[0] : newKeyRecord);
        } else {
          createdKeys.push(newKeyRecord);
        }
      }

      return {
        success: true,
        count: createdKeys.length,
        keys: createdKeys
      };
    }
  }

  static async getLicenseKeys({ status = null, limit = 100 } = {}) {
    const configRes = await this._getConfig();
    const headers = await this._getAuthHeaders(configRes);
    let query = `${configRes.url}/rest/v1/license_keys?select=*,shops(name,shop_code)&order=created_at.desc&limit=${limit}`;
    if (status) query += `&status=eq.${status}`;
    const res = await fetch(query, { headers });
    if (!res.ok) return [];
    return await res.json();
  }

  static async revokeLicenseKey(keyId, reason = 'Admin revoked') {
    const configRes = await this._getConfig();
    const headers = await this._getAuthHeaders(configRes);
    const res = await fetch(`${configRes.url}/rest/v1/license_keys?id=eq.${keyId}`, {
      method: 'PATCH',
      headers: { ...headers, 'Prefer': 'return=representation' },
      body: JSON.stringify({
        status: 'REVOKED',
        notes: reason ? `[REVOKED: ${reason}]` : '[REVOKED]',
        updated_at: new Date().toISOString()
      })
    });
    if (!res.ok) throw new Error(`Revoke Key Failed: ${res.status}`);
    return true;
  }

  static async getPaymentTransactions({ limit = 50 } = {}) {
    const configRes = await this._getConfig();
    const headers = await this._getAuthHeaders(configRes);
    const query = `${configRes.url}/rest/v1/payment_transactions?select=*,shops(name)&order=created_at.desc&limit=${limit}`;
    const res = await fetch(query, { headers });
    if (!res.ok) return [];
    return await res.json();
  }

  static async getPaymentReconciliationQueue({ status = 'ALL', search = '', limit = 50, offset = 0 } = {}) {
    return await this._rpc('admin_get_payment_reconciliation_queue', {
      p_status: status,
      p_search: search,
      p_limit: limit,
      p_offset: offset
    });
  }

  static async reconcilePaymentTransaction({ transactionId, targetShopId, notes = '' } = {}) {
    return await this._rpc('admin_reconcile_payment_transaction', {
      p_transaction_id: transactionId,
      p_target_shop_id: targetShopId,
      p_notes: notes
    });
  }

  static async getIncidents({ status = null, severity = null, limit = 50, offset = 0 } = {}) {
    return await this._rpc('admin_get_incidents', {
      p_status: status || null,
      p_severity: severity || null,
      p_limit: limit,
      p_offset: offset
    });
  }

  static async updateIncidentStatus({ incidentId, action, owner = null, notes = null } = {}) {
    return await this._rpc('admin_update_incident_status', {
      p_incident_id: incidentId,
      p_action: action,
      p_owner: owner,
      p_notes: notes
    });
  }

  static async applyLicenseKey(shopId, code) {
    return await this._rpc('apply_license_key', {
      p_shop_id: shopId,
      p_code: code
    });
  }

  static async activateLicenseKeyForShop(shopId, code) {
    const cleanCode = (code || '').trim().toUpperCase();
    const configRes = await this._getConfig();
    const headers = await this._getAuthHeaders(configRes);

    let keyRecord = null;
    try {
      const checkRes = await fetch(
        `${configRes.url}/rest/v1/license_keys?or=(code.eq.${encodeURIComponent(cleanCode)},key_code.eq.${encodeURIComponent(cleanCode)})&limit=1`,
        { method: 'GET', headers }
      );
      if (checkRes.ok) {
        const found = await checkRes.json();
        if (Array.isArray(found) && found.length > 0) keyRecord = found[0];
      }
    } catch (_) {}

    let rpcRes = null;
    try {
      rpcRes = await this._rpc('apply_license_key', {
        p_shop_id: shopId,
        p_code: cleanCode
      });
    } catch (e) {
      console.warn('[AdminRepository] apply_license_key RPC warn:', e.message);
    }

    if (keyRecord && keyRecord.key_type === 'PLAN') {
      const months = (keyRecord.duration_days && keyRecord.duration_days >= 300) ? 12 : (keyRecord.duration_days >= 80 ? 3 : 1);
      try {
        await this.overrideSubscription(shopId, keyRecord.plan_code || 'PRO', months);
      } catch (_) {}
    }

    if (keyRecord && keyRecord.status !== 'USED') {
      await fetch(`${configRes.url}/rest/v1/license_keys?id=eq.${keyRecord.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          status: 'USED',
          used_by_shop_id: shopId,
          redeemed_by_shop_id: shopId,
          used_at: new Date().toISOString(),
          redeemed_at: new Date().toISOString()
        })
      }).catch(() => {});
    }

    return rpcRes || { success: true, message: 'Kích hoạt mã cho cửa hàng thành công.' };
  }

  static async quickExtendSubscription(shopId, months = 1) {
    let plan = 'PRO';
    try {
      const configRes = await this._getConfig();
      const headers = await this._getAuthHeaders(configRes);
      const subRes = await fetch(`${configRes.url}/rest/v1/subscriptions?shop_id=eq.${shopId}&limit=1`, { headers });
      if (subRes.ok) {
        const subData = await subRes.json();
        if (subData && subData.length > 0 && subData[0].plan_tier) {
          plan = subData[0].plan_tier;
        }
      }
    } catch (_) {}
    return await this.overrideSubscription(shopId, plan, Number(months));
  }

  // ==========================================
  // SYSTEM WEBHOOKS (ALERTS)
  // ==========================================
  static async getSystemWebhooks() {
    const configRes = await this._getConfig();
    const headers = await this._getAuthHeaders(configRes);
    const res = await fetch(`${configRes.url}/rest/v1/system_webhooks?select=*&order=created_at.desc`, { headers });
    if (!res.ok) return [];
    return await res.json();
  }

  static async saveSystemWebhook(payload) {
    const configRes = await this._getConfig();
    const headers = await this._getAuthHeaders(configRes);
    const res = await fetch(`${configRes.url}/rest/v1/system_webhooks`, {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`Save Webhook Failed: ${res.status}`);
    return true;
  }

  // ==========================================
  // GLOBAL KNOWLEDGE & CROSS-SHOP LEARNING
  // ==========================================
  static async getLearningCandidates(limit = 50) {
    try {
      const rows = await this._rpc('get_admin_learning_candidates', { p_limit: limit });
      return Array.isArray(rows) ? rows : [];
    } catch (e) {
      console.warn('[AdminRepository] get_admin_learning_candidates RPC error:', e.message);
      return [];
    }
  }

  static async promoteToGlobalAlias(rawKey, mapping) {
    return await this._rpc('admin_promote_to_global_alias', {
      p_raw_key: rawKey,
      p_mapping: mapping
    });
  }

  static async promoteBatchGlobalAliases(entries) {
    return await this._rpc('admin_promote_batch_global_aliases', {
      p_entries: entries
    });
  }


  static async getGlobalAliases() {
    const configRes = await this._getConfig();
    const headers = await this._getAuthHeaders(configRes);
    const res = await fetch(
      `${configRes.url}/rest/v1/shop_address_aliases?or=(is_global.eq.true,shop_id.is.null)&order=created_at.desc`,
      { method: 'GET', headers }
    );
    if (!res.ok) return [];
    return await res.json();
  }

  static async deleteGlobalAlias(aliasId) {
    const configRes = await this._getConfig();
    const headers = await this._getAuthHeaders(configRes);
    const res = await fetch(
      `${configRes.url}/rest/v1/shop_address_aliases?id=eq.${aliasId}`,
      { method: 'DELETE', headers }
    );
    if (!res.ok) throw new Error(`Xóa từ khóa toàn cầu thất bại: ${res.status}`);
    return true;
  }

  static async mineHistoricalKnowledge(shopId = null) {
    return await this._rpc('mine_historical_orders_to_learning_kb', {
      p_shop_id: shopId || null
    });
  }

  // ==========================================
  // AI MODEL USAGE & STATS
  // ==========================================
  static async getAiModelsUsageStats(shopId = null) {
    try {
      const rows = await this._rpc('get_ai_models_usage_stats', { p_shop_id: shopId || null });
      if (Array.isArray(rows) && rows.length > 0) {
        return rows.map(r => ({
          model: r.model || 'Unknown',
          total_calls: Number(r.total_calls ?? r.total_requests ?? r.calls ?? 0),
          total_requests: Number(r.total_requests ?? r.total_calls ?? r.calls ?? 0),
          calls_today: Number(r.calls_today ?? r.today_requests ?? r.today ?? 0),
          today_requests: Number(r.today_requests ?? r.calls_today ?? r.today ?? 0),
          total_tokens: Number(r.total_tokens ?? ((Number(r.total_prompt_tokens) || 0) + (Number(r.total_completion_tokens) || 0)) ?? 0),
          last_used_at: r.last_used_at || null
        }));
      }
      return Array.isArray(rows) ? rows : [];
    } catch (e) {
      console.warn('[AdminRepository] get_ai_models_usage_stats RPC error:', e.message);
      try {
        const configRes = await this._getConfig();
        const headers = await this._getAuthHeaders(configRes);
        const res = await fetch(`${configRes.url}/rest/v1/ai_usage_log?select=model,input_tokens,output_tokens,created_at&order=created_at.desc&limit=1000`, { headers });
        if (res.ok) {
          const logs = await res.json();
          const map = {};
          const today = new Date().toISOString().slice(0, 10);
          for (const l of logs) {
            const m = l.model || 'Unknown';
            if (!map[m]) {
              map[m] = {
                model: m,
                total_calls: 0,
                total_requests: 0,
                calls_today: 0,
                today_requests: 0,
                total_tokens: 0,
                last_used_at: l.created_at || null
              };
            }
            map[m].total_calls++;
            map[m].total_requests++;
            if (l.created_at && l.created_at.startsWith(today)) {
              map[m].calls_today++;
              map[m].today_requests++;
            }
            const tokens = (Number(l.prompt_tokens) || Number(l.input_tokens) || 0) + 
                           (Number(l.completion_tokens) || Number(l.output_tokens) || 0);
            map[m].total_tokens += tokens;
          }
          return Object.values(map);
        }
      } catch (_) {}
      return [];
    }
  }

  /**
   * Ghi nhận 1 lượt sử dụng AI vào database (dùng khi test key, bóc tách đơn hoặc gọi AI)
   */
  static async recordAiUsage({ model = 'gemini-3.6-flash', requestType = 'parse', promptTokens = 20, completionTokens = 20, status = 'success', shopId = null } = {}) {
    try {
      const res = await this._rpc('record_ai_usage_log', {
        p_model: model,
        p_request_type: requestType,
        p_shop_id: shopId,
        p_tokens: promptTokens + completionTokens
      });
      if (res && res.success) return true;
    } catch (_) {}

    try {
      const configRes = await this._getConfig();
      const headers = await this._getAuthHeaders(configRes);
      const res = await fetch(`${configRes.url}/rest/v1/ai_usage_log`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: model || 'gemini-3.6-flash',
          request_type: requestType,
          status: status,
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          shop_id: shopId,
          created_at: new Date().toISOString()
        })
      });
      return res.ok;
    } catch (e) {
      console.warn('[AdminRepository] recordAiUsage fallback error:', e);
      return false;
    }
  }

  /**
   * Lấy toàn diện số liệu Shop 360 cho Admin: Quota thực, lượt dùng AI, số đơn bóc tách & 50 đơn gần nhất
   */
  static async getShop360Data(shopId) {
    if (!shopId) return null;
    try {
      const rpcData = await this._rpc('get_shop_360_stats', { p_shop_id: shopId });
      if (rpcData && (rpcData.ai_quota_limit !== undefined || Array.isArray(rpcData.recent_orders))) {
        return rpcData;
      }
    } catch (e) {
      console.warn('[AdminRepository] get_shop_360_stats RPC fallback:', e.message);
    }

    try {
      const configRes = await this._getConfig();
      const headers = await this._getAuthHeaders(configRes);
      const anonHeaders = await this._getAnonHeaders(configRes);
      const today = new Date().toISOString().slice(0, 10);

      // 1. Quota từ shop_quotas
      let quotaLimit = 500;
      let walletBalance = 0;
      try {
        let qRes = await fetch(`${configRes.url}/rest/v1/shop_quotas?shop_id=eq.${shopId}&select=*`, { headers });
        if ((!qRes || !qRes.ok) && anonHeaders) qRes = await fetch(`${configRes.url}/rest/v1/shop_quotas?shop_id=eq.${shopId}&select=*`, { headers: anonHeaders });
        if (qRes && qRes.ok) {
          const qRows = await qRes.json();
          if (qRows.length > 0) quotaLimit = Number(qRows[0].daily_ai_limit || qRows[0].ai_quota_limit || 500);
        }
      } catch (_) {}

      // 2. Lấy số dư ví từ shops
      try {
        let sRes = await fetch(`${configRes.url}/rest/v1/shops?id=eq.${shopId}&select=wallet_balance,balance`, { headers });
        if ((!sRes || !sRes.ok) && anonHeaders) sRes = await fetch(`${configRes.url}/rest/v1/shops?id=eq.${shopId}&select=wallet_balance,balance`, { headers: anonHeaders });
        if (sRes && sRes.ok) {
          const sRows = await sRes.json();
          if (sRows.length > 0) walletBalance = Number(sRows[0].wallet_balance || sRows[0].balance || 0);
        }
      } catch (_) {}

      // 3. Đếm lượt dùng AI từ ai_usage_log
      let aiToday = 0;
      let aiTotal = 0;
      try {
        let aiRes = await fetch(`${configRes.url}/rest/v1/ai_usage_log?shop_id=eq.${shopId}&select=id,created_at&limit=5000`, { headers });
        if ((!aiRes || !aiRes.ok) && anonHeaders) aiRes = await fetch(`${configRes.url}/rest/v1/ai_usage_log?shop_id=eq.${shopId}&select=id,created_at&limit=5000`, { headers: anonHeaders });
        if (aiRes && aiRes.ok) {
          const aiLogs = await aiRes.json();
          aiTotal = aiLogs.length;
          aiToday = aiLogs.filter(l => l.created_at && l.created_at.startsWith(today)).length;
        }
      } catch (_) {}

      // 4. Lấy đơn hàng thực tế từ submitted_orders
      let ordersToday = 0;
      let ordersTotal = 0;
      let recentOrders = [];
      try {
        const orderHeaders = { ...headers, 'Prefer': 'count=exact' };
        let ordRes = await fetch(`${configRes.url}/rest/v1/submitted_orders?shop_id=eq.${shopId}&deleted_at=is.null&order=created_at.desc&limit=50`, { headers: orderHeaders });
        if ((!ordRes || !ordRes.ok) && anonHeaders) {
          ordRes = await fetch(`${configRes.url}/rest/v1/submitted_orders?shop_id=eq.${shopId}&deleted_at=is.null&order=created_at.desc&limit=50`, { headers: { ...anonHeaders, 'Prefer': 'count=exact' } });
        }
        if (ordRes && ordRes.ok) {
          const cr = ordRes.headers.get('content-range');
          if (cr) {
            const parts = cr.split('/');
            if (parts[1] && parts[1] !== '*') ordersTotal = parseInt(parts[1], 10) || 0;
          }
          recentOrders = await ordRes.json();
          if (!ordersTotal) ordersTotal = recentOrders.length;
          ordersToday = recentOrders.filter(o => o.created_at && o.created_at.startsWith(today)).length;
        }
      } catch (_) {}

      if (ordersToday > aiToday) {
        aiToday = ordersToday;
      }
      if (ordersTotal > aiTotal) {
        aiTotal = ordersTotal;
      }

      return {
        shop_id: shopId,
        ai_quota_limit: quotaLimit,
        ai_quota_used_today: aiToday,
        ai_used_total: aiTotal,
        orders_count: ordersTotal,
        orders_today: ordersToday,
        wallet_balance: walletBalance,
        recent_orders: recentOrders
      };
    } catch (err) {
      console.error('[AdminRepository] getShop360Data fallback error:', err);
      return null;
    }
  }

  /**
   * Tổng hợp số đơn bóc tách và lượt gọi AI của từng nhân viên/người dùng
   */
  static async getUsersExtractionStats(users = []) {
    try {
      const configRes = await this._getConfig();
      const headers = await this._getAuthHeaders(configRes);
      const anonHeaders = await this._getAnonHeaders(configRes);
      const today = new Date().toISOString().slice(0, 10);
      const userMap = {};

      for (const u of users) {
        if (u && u.id) {
          const isSysAdmin = u.role === 'SYSTEM_ADMIN' || (u.email || '').toLowerCase() === 'admin@luathuysinh.vn';
          userMap[u.id] = {
            orders_count: 0,
            orders_today: 0,
            ai_usage_count: 0,
            ai_usage_today: 0,
            is_system_admin: isSysAdmin
          };
        }
      }

      // 1. Quét submitted_orders - Tuyệt đối không select user_id vì cột này không tồn tại trong bảng
      let orders = [];
      const ordUrl = `${configRes.url}/rest/v1/submitted_orders?deleted_at=is.null&select=id,submitted_by,created_by_name,staff_name,carrier_account,created_at&limit=5000`;
      try {
        let ordRes = await fetch(ordUrl, { headers });
        if ((!ordRes || !ordRes.ok) && anonHeaders) {
          ordRes = await fetch(ordUrl, { headers: anonHeaders });
        }
        if (ordRes && ordRes.ok) {
          orders = await ordRes.json().catch(() => []);
        }
      } catch (e) {
        console.warn('[AdminRepository] fetch submitted_orders error in stats:', e.message);
      }

      // 2. Quét ai_usage_log
      let aiLogs = [];
      const aiUrl = `${configRes.url}/rest/v1/ai_usage_log?select=id,user_id,shop_id,created_at&limit=5000`;
      try {
        let aiRes = await fetch(aiUrl, { headers });
        if ((!aiRes || !aiRes.ok) && anonHeaders) {
          aiRes = await fetch(aiUrl, { headers: anonHeaders });
        }
        if (aiRes && aiRes.ok) {
          aiLogs = await aiRes.json().catch(() => []);
        }
      } catch (e) {
        console.warn('[AdminRepository] fetch ai_usage_log error in stats:', e.message);
      }

      // Map aiLogs theo user_id nếu có (bỏ qua System Admin)
      for (const a of aiLogs) {
        const uid = a.user_id;
        if (uid && userMap[uid] && !userMap[uid].is_system_admin) {
          userMap[uid].ai_usage_count++;
          if (a.created_at && a.created_at.startsWith(today)) userMap[uid].ai_usage_today++;
        }
      }

      // Helper matching order -> user (bỏ qua System Admin)
      const findUserForOrder = (o) => {
        if (o.submitted_by && userMap[o.submitted_by] && !userMap[o.submitted_by].is_system_admin) return o.submitted_by;
        const staff = (o.staff_name || o.created_by_name || '').toLowerCase().trim();
        if (!staff) return null;
        for (const u of users) {
          if (u.role === 'SYSTEM_ADMIN' || (u.email || '').toLowerCase() === 'admin@luathuysinh.vn') continue;
          const email = (u.email || '').toLowerCase().trim();
          const emailPrefix = email.split('@')[0];
          const name = (u.full_name || '').toLowerCase().trim();
          if (email && staff.includes(email)) return u.id;
          if (emailPrefix && (staff === emailPrefix || staff.includes(emailPrefix))) return u.id;
          if (name && (staff === name || staff.includes(name))) return u.id;
        }
        return null;
      };

      for (const o of orders) {
        const uid = findUserForOrder(o);
        if (uid && userMap[uid] && !userMap[uid].is_system_admin) {
          userMap[uid].orders_count++;
          if (o.created_at && o.created_at.startsWith(today)) {
            userMap[uid].orders_today++;
          }
        }
      }

      // Đảm bảo số lượt gọi AI tối thiểu bằng số đơn bóc tách thực tế đối với shop users
      for (const uid of Object.keys(userMap)) {
        if (userMap[uid].is_system_admin) {
          userMap[uid].orders_count = 0;
          userMap[uid].orders_today = 0;
          userMap[uid].ai_usage_count = 0;
          userMap[uid].ai_usage_today = 0;
          continue;
        }
        if (userMap[uid].ai_usage_count < userMap[uid].orders_count) {
          userMap[uid].ai_usage_count = userMap[uid].orders_count;
        }
        if (userMap[uid].ai_usage_today < userMap[uid].orders_today) {
          userMap[uid].ai_usage_today = userMap[uid].orders_today;
        }
      }

      return userMap;
    } catch (e) {
      console.warn('[AdminRepository] getUsersExtractionStats error:', e.message);
      return {};
    }
  }
}
