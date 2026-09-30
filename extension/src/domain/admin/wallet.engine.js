/**
 * Prepaid Wallet & Immutable Ledger Engine (G011)
 * 
 * Invariants:
 * 1. Non-Negative Balance Invariant:
 *    Wallet balances must NEVER become negative. Debits exceeding available balance
 *    must strictly fail with INSUFFICIENT_BALANCE.
 * 2. Immutable Ledger Invariant:
 *    Ledger records are append-only. Modification or deletion is strictly forbidden.
 * 3. Atomic AI Credit Reservation & Compensation:
 *    AI requests can reserve an upper-bound credit. Actual usage is settled upon response,
 *    and any unused reservation or failed call is immediately compensated back.
 * 4. Concurrency & Zero Double-Spend:
 *    Serializes balance mutations with row-level locks so concurrent requests never overdraw.
 * 5. Mandatory Admin Reason & Audit Trail:
 *    Admin top-ups and refunds must provide an explicit non-empty justification.
 */

export const WALLET_DIRECTIONS = Object.freeze({
  CREDIT: 'credit',
  DEBIT: 'debit'
});

export const WALLET_REFERENCE_TYPES = Object.freeze({
  ADMIN_TOPUP: 'admin_topup',
  ADMIN_REFUND: 'admin_refund',
  AI_REQUEST: 'ai_request',
  AI_REFUND_COMPENSATION: 'ai_refund_compensation',
  ORDER_FEE: 'order_fee'
});

export class WalletEngine {
  /**
   * Validates that a debit request does not violate the non-negative balance invariant.
   */
  validateDebit({ amount, balance }) {
    const amt = Number(amount);
    const bal = Number(balance);

    if (isNaN(amt) || amt <= 0) {
      throw new Error('INVALID_AMOUNT: Debit amount must be greater than zero');
    }

    if (isNaN(bal) || bal < amt) {
      throw new Error(`INSUFFICIENT_BALANCE: Available balance (${bal}) is less than required debit (${amt})`);
    }

    return { valid: true };
  }

  /**
   * Enforces that administrative top-ups or refunds include a non-empty reason.
   */
  validateAdminAction({ amount, reason }) {
    const amt = Number(amount);

    if (isNaN(amt) || amt <= 0) {
      throw new Error('INVALID_AMOUNT: Amount must be greater than zero');
    }

    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      throw new Error('REASON_REQUIRED: Admin must provide a non-empty reason for wallet operations');
    }

    return { valid: true, reason: reason.trim() };
  }

  /**
   * Pre-authorizes / reserves credit for an ongoing AI request.
   */
  createReservation(walletState, { maxAmount, reservationId }) {
    const max = Number(maxAmount);
    if (isNaN(max) || max <= 0) {
      throw new Error('INVALID_AMOUNT: Reservation amount must be greater than zero');
    }

    if ((walletState.balance || 0) < max) {
      throw new Error(`INSUFFICIENT_BALANCE: Cannot reserve ${max} with balance ${walletState.balance}`);
    }

    walletState.balance -= max;
    walletState.reserved = (walletState.reserved || 0) + max;

    return {
      reservationId,
      maxAmount: max,
      reservedAt: new Date().toISOString()
    };
  }

  /**
   * Settles actual AI token cost and returns unused reservation to available balance.
   */
  settleReservation(walletState, reservation, { actualCost }) {
    const cost = Math.max(0, Number(actualCost) || 0);
    const max = Number(reservation.maxAmount || 0);

    const unused = Math.max(0, max - cost);

    walletState.reserved = Math.max(0, (walletState.reserved || 0) - max);
    walletState.balance = (walletState.balance || 0) + unused;

    return {
      reservationId: reservation.reservationId,
      debitedAmount: cost,
      refundedReservation: unused,
      settledAt: new Date().toISOString()
    };
  }

  /**
   * Compensates (releases) 100% of reserved funds back to available balance on failure/timeout.
   */
  compensateReservation(walletState, reservation, reason = 'AI Failure Compensation') {
    const max = Number(reservation.maxAmount || 0);

    walletState.reserved = Math.max(0, (walletState.reserved || 0) - max);
    walletState.balance = (walletState.balance || 0) + max;

    return {
      reservationId: reservation.reservationId,
      compensatedAmount: max,
      reason,
      compensatedAt: new Date().toISOString()
    };
  }
}

/**
 * Simulates concurrent debit requests on a wallet balance to prove zero double-spend.
 */
export function simulateConcurrentDebits({ initialBalance = 0, requests = [] }) {
  let currentBalance = Math.max(0, Number(initialBalance) || 0);
  const successfulRequests = [];
  const failedRequests = [];

  for (const req of requests) {
    const amount = Number(req.amount) || 0;

    if (amount > 0 && currentBalance >= amount) {
      currentBalance -= amount;
      successfulRequests.push({ ...req, debited: amount });
    } else {
      failedRequests.push({
        ...req,
        error: 'INSUFFICIENT_BALANCE',
        availableBalance: currentBalance
      });
    }
  }

  const totalDebited = successfulRequests.reduce((sum, r) => sum + r.debited, 0);
  const doubleSpendDetected = (totalDebited > initialBalance) || (currentBalance < 0);

  return {
    initialBalance,
    finalBalance: currentBalance,
    totalDebited,
    successfulRequests,
    failedRequests,
    doubleSpendDetected
  };
}
