import { calculateCustomerSegment, calculateRiskLevel, maskPhone } from './customer-risk.service.js';

export function normalizeCustomerPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return /^84\d{9}$/.test(digits) ? `0${digits.slice(2)}` : digits;
}

export function createCustomerOrderFingerprint(order, sourceType = 'order') {
  const phone = normalizeCustomerPhone(order?.phone);
  const tracking = String(order?.trackingCode || order?.tracking_code || '').trim().toLowerCase();
  const orderCode = String(order?.orderCode || order?.order_code || '').trim().toLowerCase();
  if (tracking) return `tracking:${tracking}`;
  if (phone && orderCode) return `phone-order:${phone}:${orderCode}`;
  return `${sourceType}:${String(order?.id || order?.source_order_id || '')}`;
}

export function aggregateCustomerAddresses(addresses = []) {
  const normalized = [...addresses].sort((a, b) =>
    Number(b.successful_delivery_count || 0) - Number(a.successful_delivery_count || 0)
    || Number(b.use_count || 0) - Number(a.use_count || 0)
    || new Date(b.last_used_at || 0) - new Date(a.last_used_at || 0));
  return { addresses: normalized, primaryAddress: normalized.find(item => item.is_primary) || normalized[0] || null };
}

export async function syncCustomerOrder(repository, order, sourceType = 'order') {
  if (!repository?.shopId) throw new Error('customer_hub_active_shop_required');
  const normalized = { ...order, phone: normalizeCustomerPhone(order?.phone), fingerprint: createCustomerOrderFingerprint(order, sourceType) };
  if (normalized.phone.length < 9) return null;
  return repository.syncOrder(normalized, sourceType);
}

export async function mutateCustomerOptimistically({ apply, rollback, mutation }) {
  apply();
  try { return await mutation(); }
  catch (error) { rollback(); throw error; }
}

export const saveCustomerNote = (repository, customerId, content, author, optimistic) =>
  mutateCustomerOptimistically({ ...optimistic, mutation: () => repository.addNote(customerId, content, author) });
export const saveCustomerTag = (repository, customerId, name, color, optimistic) =>
  mutateCustomerOptimistically({ ...optimistic, mutation: () => repository.assignTag(customerId, name, color) });

export function mapCustomerDashboard(data, { canViewFullPhone = true } = {}) {
  const addressesByCustomer = new Map();
  const ordersByCustomer = new Map();
  const notesByPhone = {};
  const tagById = new Map((data.tags || []).map(tag => [tag.id, tag]));
  const assignmentByCustomer = new Map((data.assignments || []).map(item => [item.customer_id, tagById.get(item.tag_id)?.name]).filter(([, name]) => name));
  for (const address of data.addresses || []) {
    const list = addressesByCustomer.get(address.customer_id) || []; list.push(address); addressesByCustomer.set(address.customer_id, list);
  }
  for (const order of data.orders || []) {
    const list = ordersByCustomer.get(order.customer_id) || [];
    list.push({ id: order.id, code: order.order_code || order.source_order_id, trackingCode: order.tracking_code || '', cod: Number(order.cod_amount || 0), carrier: order.carrier || '', status: order.status || '', date: order.ordered_at });
    ordersByCustomer.set(order.customer_id, list);
  }
  const customers = (data.customers || []).map(row => {
    const phone = row.normalized_phone || normalizeCustomerPhone(row.phone);
    const addressAggregate = aggregateCustomerAddresses(addressesByCustomer.get(row.id) || []);
    const addresses = addressAggregate.addresses;
    const orders = ordersByCustomer.get(row.id) || [];
    const customer = {
      id: row.id, phone: maskPhone(phone, canViewFullPhone), rawPhone: phone, name: row.name || 'Khách hàng',
      primaryAddress: addressAggregate.primaryAddress?.raw_address || row.address || '', addresses,
      totalOrders: Number(row.total_orders || orders.length), successfulOrders: Number(row.successful_orders || 0), failedOrders: Number(row.failed_orders || 0),
      totalSpent: Number(row.total_spent ?? row.total_cod ?? 0), aov: Number(row.aov || 0), successRate: Number(row.delivery_success_rate || 0),
      firstOrderDate: row.first_order_at || row.created_at, lastOrderDate: row.last_order_at || row.latest_date || row.created_at,
      favCarrier: row.fav_carrier || '', isBlacklisted: Boolean(row.is_blacklisted), blacklistReason: row.blacklist_reason || '', orders
    };
    customer.autoTag = row.segment || calculateCustomerSegment(customer);
    customer.riskLevel = row.risk_level || calculateRiskLevel(customer);
    const assignedTag = assignmentByCustomer.get(row.id); if (assignedTag) customer.manualTag = assignedTag;
    return customer;
  });
  for (const note of data.notes || []) {
    const customer = customers.find(item => item.id === note.customer_id); if (!customer) continue;
    (notesByPhone[customer.phone] ||= []).push({ id: note.id, text: note.content, date: note.created_at, author: note.created_by_name || '' });
  }
  return { customers, notesByPhone };
}

export async function lookupCustomerSummary(repository, phone, { timeoutMs = 1200 } = {}) {
  let timer;
  const startedAt = performance.now();
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('customer_lookup_timeout')), timeoutMs); });
  try {
    return await Promise.race([repository.getSummaryByPhone(normalizeCustomerPhone(phone)), timeout]);
  } catch (error) {
    console.warn('[CustomerHubMetric]', { event: error.message === 'customer_lookup_timeout' ? 'lookup_timeout' : 'lookup_failed', durationMs: Math.round(performance.now() - startedAt), error: error.message });
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
