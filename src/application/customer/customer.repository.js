const encode = encodeURIComponent;

function createHeaders(config, session, extra = {}) {
  return {
    apikey: config.anonKey,
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
    ...extra
  };
}

export class CustomerRepository {
  constructor({ config, session, fetchImpl }) {
    if (!config?.url || !config?.anonKey || !session?.access_token || !session?.active_shop_id) {
      throw new Error('Thiếu phiên đăng nhập hoặc cấu hình cơ sở dữ liệu.');
    }
    this.config = config;
    this.session = session;
    const target = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null);
    const rawFetch = fetchImpl || (typeof globalThis !== 'undefined' && globalThis.fetch ? globalThis.fetch : (typeof fetch !== 'undefined' ? fetch : null));
    this.fetch = typeof rawFetch === 'function' ? rawFetch.bind(target) : rawFetch;
    this.shopId = session.active_shop_id;
    this.base = `${String(config.url).replace(/\/$/, '')}/rest/v1`;
    this.headers = createHeaders(config, session);
  }

  async request(path, options = {}) {
    const response = await this.fetch(`${this.base}/${path}`, { ...options, headers: { ...this.headers, ...(options.headers || {}) } });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      const error = new Error(body || `Customer Hub request failed (${response.status})`);
      error.status = response.status;
      error.body = body;
      if (response.status === 401 || response.status === 403) {
        console.warn('[CustomerHubMetric]', { event: 'mutation_or_query_denied', path, status: response.status, shopId: this.shopId });
      }
      throw error;
    }
    if (response.status === 204) return null;
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  async rpc(name, payload = {}) {
    return this.request(`rpc/${name}`, { method: 'POST', body: JSON.stringify(payload) });
  }

  async listCustomers({ limit = 1000 } = {}) {
    return this.rpc('customer_hub_list', { p_shop_id: this.shopId, p_limit: limit });
  }

  async getCurrentRole() {
    const userId = this.session.user?.id || this.session.user_id;
    if (!userId) return String(this.session.role_code || this.session.role || 'STAFF').toUpperCase();
    const rows = await this.request(`shop_members?shop_id=eq.${encode(this.shopId)}&user_id=eq.${encode(userId)}&removed_at=is.null&limit=1&select=role`);
    return String(rows?.[0]?.role || this.session.role_code || this.session.role || 'STAFF').toUpperCase();
  }

  async loadDashboard() {
    const customers = await this.listCustomers();
    const ids = customers.map(item => item.id).filter(Boolean);
    if (!ids.length) return { customers: [], addresses: [], orders: [], notes: [], tags: [], assignments: [] };
    const inIds = `(${ids.join(',')})`;
    const [addresses, orders, notes, tags, assignments] = await Promise.all([
      this.request(`customer_addresses?shop_id=eq.${encode(this.shopId)}&customer_id=in.${inIds}&order=last_used_at.desc&select=*`),
      this.request(`customer_order_links?shop_id=eq.${encode(this.shopId)}&customer_id=in.${inIds}&order=ordered_at.desc&select=*`),
      this.request(`customer_notes?shop_id=eq.${encode(this.shopId)}&customer_id=in.${inIds}&deleted_at=is.null&order=created_at.desc&select=*`),
      this.request(`customer_tags?shop_id=eq.${encode(this.shopId)}&order=name.asc&select=*`),
      this.request(`customer_tag_assignments?shop_id=eq.${encode(this.shopId)}&customer_id=in.${inIds}&select=*`)
    ]);
    return { customers, addresses, orders, notes, tags, assignments };
  }

  async getSummaryByPhone(phone) {
    const normalized = String(phone || '').replace(/\D/g, '').replace(/^84(?=\d{9}$)/, '0');
    const customer = await this.rpc('customer_hub_lookup', { p_shop_id: this.shopId, p_phone: normalized });
    if (!customer) return null;
    const [addresses, orders] = await Promise.all([
      this.request(`customer_addresses?shop_id=eq.${encode(this.shopId)}&customer_id=eq.${customer.id}&order=successful_delivery_count.desc,last_used_at.desc&limit=3&select=*`),
      this.request(`customer_order_links?shop_id=eq.${encode(this.shopId)}&customer_id=eq.${customer.id}&order=ordered_at.desc&limit=5&select=*`)
    ]);
    return { ...customer, addresses, orders };
  }

  syncOrder(order, sourceType = 'import') {
    return this.rpc('customer_hub_sync_order', {
      p_shop_id: this.shopId,
      p_source_type: sourceType,
      p_source_order_id: String(order.id || order.source_order_id || order.orderCode || crypto.randomUUID()),
      p_phone: order.phone || '', p_name: order.name || order.customer_name || '', p_address: order.address || '',
      p_order_code: order.orderCode || order.order_code || '', p_tracking_code: order.trackingCode || order.tracking_code || '',
      p_carrier: order.platform || order.carrier || '', p_status: order.status || (sourceType === 'submitted_order' ? 'success' : 'pending'),
      p_cod_amount: Number(order.codAmount ?? order.cod_amount ?? order.cod ?? 0),
      p_ordered_at: order.submittedAt || order.submitted_at || order.createdAt || order.created_at || new Date().toISOString()
    });
  }

  backfillBatch(orders) {
    return this.rpc('customer_hub_backfill_batch', { p_shop_id: this.shopId, p_orders: orders });
  }

  addNote(customerId, content, createdByName = '') {
    return this.request('customer_notes', {
      method: 'POST', headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ shop_id: this.shopId, customer_id: customerId, content, created_by_name: createdByName })
    });
  }

  async assignTag(customerId, name, color = '#2563eb') {
    const tags = await this.request('customer_tags?on_conflict=shop_id,name', {
      method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({ shop_id: this.shopId, name, color, is_system: false })
    });
    const tag = tags?.[0];
    if (!tag) throw new Error('Không thể tạo nhãn khách hàng.');
    await this.request(`customer_tag_assignments?shop_id=eq.${encode(this.shopId)}&customer_id=eq.${customerId}`, { method: 'DELETE' });
    return this.request('customer_tag_assignments?on_conflict=customer_id,tag_id', {
      method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({ shop_id: this.shopId, customer_id: customerId, tag_id: tag.id })
    });
  }

  setBlacklist(customerId, blacklisted, reason = '') {
    return this.rpc('customer_hub_set_blacklist', { p_customer_id: customerId, p_blacklisted: blacklisted, p_reason: reason || null });
  }

  createJob(jobType, totalRows = 0) {
    return this.request('customer_sync_jobs', {
      method: 'POST', headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ shop_id: this.shopId, job_type: jobType, status: 'running', total_rows: totalRows, started_at: new Date().toISOString() })
    });
  }

  updateJob(id, patch) {
    return this.request(`customer_sync_jobs?id=eq.${id}&shop_id=eq.${encode(this.shopId)}`, {
      method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() })
    });
  }

  audit(action, details = {}) {
    if (action === 'CUSTOMER_EXPORT') return this.rpc('customer_hub_audit_export', { p_shop_id: this.shopId, p_details: details });
    return this.request('audit_logs', {
      method: 'POST', body: JSON.stringify({ shop_id: this.shopId, user_id: this.session.user?.id || this.session.user_id || null, action, entity_type: 'CUSTOMER_HUB', details })
    });
  }
}

export function createCustomerRepository(context) { return new CustomerRepository(context); }
