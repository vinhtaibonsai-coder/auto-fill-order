import assert from 'node:assert/strict';
import fs from 'node:fs';

console.log('--- Test Suite: G011 Prepaid Wallet Production ---');

// 1. Schema & Migration Verification
const migrationPath = 'database/migrations/v121_prepaid_wallet_production_hardening.sql';
assert.ok(fs.existsSync(migrationPath), `Migration file must exist: ${migrationPath}`);
const migrationSql = fs.readFileSync(migrationPath, 'utf8');

assert.match(migrationSql, /tr_wallet_ledger_immutable|prevent_wallet_ledger_modification/i, 'Must enforce immutable ledger trigger');
assert.match(migrationSql, /reserved_balance/i, 'Must support reserved_balance for AI request reservation');
assert.match(migrationSql, /CHECK\s*\(\s*balance\s*>=\s*0\s*\)/i, 'Must enforce non-negative balance constraint');
assert.match(migrationSql, /wallet_reserve_ai_credit/i, 'Must define wallet_reserve_ai_credit RPC');
assert.match(migrationSql, /wallet_settle_ai_credit/i, 'Must define wallet_settle_ai_credit RPC');
assert.match(migrationSql, /wallet_compensate_ai_credit/i, 'Must define wallet_compensate_ai_credit RPC');
assert.match(migrationSql, /admin_topup_wallet_with_audit/i, 'Must define admin_topup_wallet_with_audit RPC');
assert.match(migrationSql, /admin_refund_wallet_with_audit/i, 'Must define admin_refund_wallet_with_audit RPC');
assert.match(migrationSql, /admin_get_wallet_details/i, 'Must define admin_get_wallet_details RPC');
assert.match(migrationSql, /REASON_REQUIRED/i, 'Must enforce mandatory reason for admin wallet actions');

// 2. Domain Engine: Concurrency, Zero Double-Spend, and Reservation/Compensation
import {
  WalletEngine,
  simulateConcurrentDebits,
  WALLET_DIRECTIONS,
  WALLET_REFERENCE_TYPES
} from '../../src/domain/admin/wallet.engine.js';

// Test 2a: Negative Balance Prevention
const engine = new WalletEngine();
assert.throws(() => {
  engine.validateDebit({ amount: 150000, balance: 100000 });
}, /INSUFFICIENT_BALANCE/, 'Debit exceeding available balance must throw INSUFFICIENT_BALANCE');

// Test 2b: Concurrency Invariant: "Done khi concurrency test không double-spend."
// Simulate 10 concurrent workers each trying to debit 20,000 VND from an initial balance of 50,000 VND
const concurrencyResult = simulateConcurrentDebits({
  initialBalance: 50000,
  requests: [
    { id: 'req-1', amount: 20000 },
    { id: 'req-2', amount: 20000 },
    { id: 'req-3', amount: 20000 }, // Should fail (only 10k left)
    { id: 'req-4', amount: 20000 }, // Should fail
    { id: 'req-5', amount: 10000 }  // Should succeed if executed before exhaustion
  ]
});

assert.strictEqual(concurrencyResult.doubleSpendDetected, false, 'No double-spending allowed under concurrency');
assert.ok(concurrencyResult.finalBalance >= 0, 'Final balance must never be negative');
const totalDebited = concurrencyResult.successfulRequests.reduce((sum, r) => sum + r.amount, 0);
assert.strictEqual(concurrencyResult.initialBalance - totalDebited, concurrencyResult.finalBalance);
assert.strictEqual(concurrencyResult.successfulRequests.length, 3); // req-1 (20k) + req-2 (20k) + req-5 (10k) = 50k
assert.strictEqual(concurrencyResult.failedRequests.length, 2); // req-3 and req-4 fail with INSUFFICIENT_BALANCE

// Test 2c: Reservation / Settlement Lifecycle
// Start balance: 100,000
const walletState = { balance: 100000, reserved: 0 };
const reservation = engine.createReservation(walletState, {
  maxAmount: 40000,
  reservationId: 'res-ai-101'
});
assert.strictEqual(walletState.balance, 60000, 'Available balance reduced by max reserved amount');
assert.strictEqual(walletState.reserved, 40000, 'Reserved balance incremented');

// Actual AI cost: only 15,000 (settlement returns 25,000 unused reserve to available balance)
const settlement = engine.settleReservation(walletState, reservation, {
  actualCost: 15000
});
assert.strictEqual(walletState.balance, 85000, 'Unspent reservation (25,000) returned to available balance');
assert.strictEqual(walletState.reserved, 0, 'Reserved balance cleared to 0');
assert.strictEqual(settlement.debitedAmount, 15000);
assert.strictEqual(settlement.refundedReservation, 25000);

// Test 2d: Reservation Compensation (on AI error / 503 / timeout)
const walletState2 = { balance: 50000, reserved: 0 };
const reservation2 = engine.createReservation(walletState2, {
  maxAmount: 30000,
  reservationId: 'res-ai-102'
});
assert.strictEqual(walletState2.balance, 20000);
assert.strictEqual(walletState2.reserved, 30000);

// Call failed, trigger compensation
const compensation = engine.compensateReservation(walletState2, reservation2, 'AI Gateway 503 Timeout');
assert.strictEqual(walletState2.balance, 50000, 'Full reservation refunded to available balance');
assert.strictEqual(walletState2.reserved, 0);
assert.strictEqual(compensation.compensatedAmount, 30000);

// Test 2e: Mandatory Reason & Audit for Admin Actions
assert.throws(() => {
  engine.validateAdminAction({ amount: 100000, reason: '' });
}, /REASON_REQUIRED/, 'Admin action without reason must be rejected');

assert.throws(() => {
  engine.validateAdminAction({ amount: 100000, reason: '   ' });
}, /REASON_REQUIRED/, 'Admin action with whitespace-only reason must be rejected');

const validAdminAction = engine.validateAdminAction({ amount: 100000, reason: 'Hỗ trợ nạp tiền do sự cố cổng thanh toán' });
assert.strictEqual(validAdminAction.valid, true);

// 3. AdminRepository & AdminService Verification
const adminRepo = fs.readFileSync('src/domain/admin/admin.repository.js', 'utf8');
const adminService = fs.readFileSync('src/domain/admin/admin.service.js', 'utf8');

assert.match(adminRepo, /getWalletDetails/i);
assert.match(adminRepo, /topupWalletWithAudit/i);
assert.match(adminRepo, /refundWalletWithAudit/i);
assert.match(adminRepo, /reserveAiCredit/i);
assert.match(adminRepo, /settleAiCredit/i);
assert.match(adminRepo, /compensateAiCredit/i);

assert.match(adminService, /getWalletDetails/i);
assert.match(adminService, /topupWallet/i);
assert.match(adminService, /refundWallet/i);

// 4. UI Verification
const creditModal = fs.readFileSync('src/ui/admin-dashboard/modals/CreditWalletModal.jsx', 'utf8');
assert.match(creditModal, /reason|description|Lý do/i, 'Modal must require reason');
assert.match(creditModal, /Số dư hiện tại|balance/i, 'Modal must display current wallet balance');

console.log('All G011 Prepaid Wallet Production contracts verified successfully.');
