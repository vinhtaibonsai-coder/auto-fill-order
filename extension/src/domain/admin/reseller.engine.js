/**
 * Reseller & Affiliate Partner Engine (G010)
 * 
 * Invariants:
 * 1. Tenant Isolation Invariant:
 *    A reseller user can only access and view data belonging strictly to their own reseller account.
 *    Cross-tenant queries are blocked at both RLS and domain authorization layers.
 * 2. Refund / Chargeback Reversal Invariant:
 *    Commissions originate from reconciled transactions. When a transaction is refunded or charged back,
 *    a corresponding reversal is recorded and debited from the reseller's claimable balance.
 * 3. Idempotency:
 *    Payment commissions have unique reference keys, preventing double-crediting.
 */

export const COMMISSION_STATUSES = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  PAID: 'paid',
  REVERSED: 'reversed'
});

export const STATEMENT_STATUSES = Object.freeze({
  DRAFT: 'draft',
  APPROVED: 'approved',
  PAID: 'paid',
  CANCELLED: 'cancelled'
});

/**
 * Calculates standard affiliate commission for a given eligible revenue and rate.
 */
export function calculateCommission({ revenue, rate = 10 }) {
  const rev = Math.max(0, Number(revenue) || 0);
  const r = Math.max(0, Number(rate) || 0);
  return Math.round(rev * (r / 100));
}

/**
 * Calculates refund/chargeback reversal amount.
 * Can handle both full and partial refunds.
 */
export function calculateRefundReversal({ originalCommission, originalRevenue, refundRevenue }) {
  const origComm = Math.abs(Number(originalCommission) || 0);
  const origRev = Math.abs(Number(originalRevenue) || 0);
  const refRev = Math.abs(Number(refundRevenue) || 0);

  if (origRev <= 0 || refRev >= origRev) {
    return {
      reversalAmount: -origComm,
      isFullReversal: true,
      ratio: 1.0
    };
  }

  const ratio = refRev / origRev;
  const reversalAmount = -Math.round(origComm * ratio);

  return {
    reversalAmount,
    isFullReversal: false,
    ratio: Number(ratio.toFixed(4))
  };
}

/**
 * Aggregates commission balances and computes net claimable balance.
 * Reversals are subtracted from claimable commission.
 */
export function calculateResellerBalances(commissions = []) {
  let pending = 0;
  let approved = 0;
  let paid = 0;
  let reversed = 0;
  let totalRevenue = 0;

  for (const c of commissions || []) {
    const amount = Number(c.commission_amount) || 0;
    const rev = Number(c.eligible_revenue) || 0;
    const status = (c.status || '').toLowerCase();

    if (status === COMMISSION_STATUSES.PENDING) {
      pending += amount;
      totalRevenue += rev;
    } else if (status === COMMISSION_STATUSES.APPROVED) {
      approved += amount;
      totalRevenue += rev;
    } else if (status === COMMISSION_STATUSES.PAID) {
      paid += amount;
      totalRevenue += rev;
    } else if (status === COMMISSION_STATUSES.REVERSED || amount < 0) {
      reversed += amount; // negative
    }
  }

  // Net claimable: approved earnings plus negative reversals (reversals deduct from claimable amount)
  const netClaimable = Math.max(0, approved + reversed);

  return {
    pending,
    approved,
    paid,
    reversed,
    netClaimable,
    totalRevenue
  };
}

/**
 * Enforces Strict Tenant Isolation for Resellers
 */
export function enforceTenantIsolation(callerUser = {}, resellerAccount = {}) {
  // System administrators can access any reseller account
  if (callerUser.role === 'system_admin' || callerUser.is_system_admin === true) {
    return { allowed: true };
  }

  // Reseller user must match the user_id bound to the reseller account
  if (callerUser.id && resellerAccount.user_id && callerUser.id === resellerAccount.user_id) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: 'ACCESS_DENIED_CROSS_TENANT',
    message: 'Reseller is not authorized to access this tenant.'
  };
}

/**
 * Sanitizes and exports reseller commissions to CSV format
 */
export function exportResellerCommissionsCsv(commissions = []) {
  const headers = ['Mã Giao Dịch', 'Shop Giới Thiệu', 'Doanh Thu Đủ ĐK', 'Tỷ Lệ %', 'Hoa Hồng (VND)', 'Trạng Thái', 'Thời Gian Ghi Nhận'];
  const rows = (commissions || []).map(c => [
    c.reference_id || c.id || '',
    (c.shop_name || c.shop_id || '').replace(/"/g, '""'),
    c.eligible_revenue || 0,
    c.commission_rate || 10,
    c.commission_amount || 0,
    c.status || '',
    c.created_at ? new Date(c.created_at).toLocaleDateString('vi-VN') : ''
  ]);

  return [
    headers.join(','),
    ...rows.map(r => r.map(val => `"${val}"`).join(','))
  ].join('\r\n');
}
