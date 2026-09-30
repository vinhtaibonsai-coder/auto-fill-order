export const DEFAULT_CUSTOMER_THRESHOLDS = Object.freeze({
  vipSpend: 2_000_000,
  vipOrders: 5,
  repeatOrders: 2,
  churnDays: 60,
  warningSuccessRate: 70
});

export function calculateCustomerSegment(customer, thresholds = DEFAULT_CUSTOMER_THRESHOLDS, now = new Date()) {
  const total = Number(customer.totalOrders ?? customer.total_orders ?? 0);
  const success = Number(customer.successfulOrders ?? customer.successful_orders ?? 0);
  const failed = Number(customer.failedOrders ?? customer.failed_orders ?? 0);
  const spent = Number(customer.totalSpent ?? customer.total_spent ?? 0);
  const last = new Date(customer.lastOrderDate ?? customer.last_order_at ?? 0);
  const dormant = last.getTime() > 0 && now.getTime() - last.getTime() > thresholds.churnDays * 86400000;
  if (customer.isBlacklisted || customer.is_blacklisted || failed > 0) return 'risk';
  if (spent >= thresholds.vipSpend || success >= thresholds.vipOrders) return 'vip';
  if (success >= thresholds.repeatOrders && dormant) return 'churn_risk';
  if (success >= thresholds.repeatOrders || total >= thresholds.repeatOrders) return 'repeat';
  return 'new';
}

export function calculateRiskLevel(customer, thresholds = DEFAULT_CUSTOMER_THRESHOLDS) {
  if (customer.isBlacklisted || customer.is_blacklisted) return 'blacklist';
  const total = Number(customer.totalOrders ?? customer.total_orders ?? 0);
  const failed = Number(customer.failedOrders ?? customer.failed_orders ?? 0);
  const rate = Number(customer.successRate ?? customer.delivery_success_rate ?? (total ? ((total - failed) / total) * 100 : 100));
  return failed > 0 || (total >= 2 && rate < thresholds.warningSuccessRate) ? 'warning' : 'safe';
}

export function maskPhone(phone, canViewFull = false) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (canViewFull || digits.length < 7) return digits;
  return `${digits.slice(0, 4)}***${digits.slice(-3)}`;
}
