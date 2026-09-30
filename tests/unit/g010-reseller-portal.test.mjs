import assert from 'node:assert/strict';
import fs from 'node:fs';

console.log('--- Test Suite: G010 Reseller Portal Hoàn Chỉnh ---');

// 1. Schema & Migration Verification
const migrationPath = 'database/migrations/v120_reseller_portal_production.sql';
assert.ok(fs.existsSync(migrationPath), `Migration file must exist: ${migrationPath}`);
const migrationSql = fs.readFileSync(migrationPath, 'utf8');

assert.match(migrationSql, /ALTER TABLE public\.reseller_accounts ADD COLUMN IF NOT EXISTS user_id/i, 'Must link reseller_accounts to user_id for portal login');
assert.match(migrationSql, /CREATE TABLE IF NOT EXISTS public\.reseller_commissions/i, 'Must define reseller_commissions table');
assert.match(migrationSql, /CREATE TABLE IF NOT EXISTS public\.reseller_payout_statements/i, 'Must define reseller_payout_statements table');
assert.match(migrationSql, /reseller_.*portal_overview/i, 'Must define reseller_get_portal_overview RPC');
assert.match(migrationSql, /record_reseller_commission_from_payment/i, 'Must define record_reseller_commission_from_payment RPC');
assert.match(migrationSql, /reverse_reseller_commission_for_refund/i, 'Must define reverse_reseller_commission_for_refund RPC');
assert.match(migrationSql, /admin_generate_reseller_payout_statement/i, 'Must define admin_generate_reseller_payout_statement RPC');
assert.match(migrationSql, /ENABLE ROW LEVEL SECURITY/i, 'Must enable RLS on all reseller tables');
assert.match(migrationSql, /reseller_commissions_tenant_isolation|reseller_commissions_isolation/i, 'Must have RLS tenant isolation policy on commissions');

// 2. Domain Engine: Commission, Refund Reversal, and Balances
import {
  calculateCommission,
  calculateRefundReversal,
  calculateResellerBalances,
  enforceTenantIsolation,
  COMMISSION_STATUSES
} from '../../src/domain/admin/reseller.engine.js';

// Test 2a: Standard Commission Calculation
const rev1 = 1000000; // 1,000,000 VND
const rate1 = 15; // 15%
const comm1 = calculateCommission({ revenue: rev1, rate: rate1 });
assert.strictEqual(comm1, 150000, 'Commission for 1,000,000 VND at 15% must be 150,000 VND');

// Test 2b: Refund / Chargeback Reversal Calculation
// Invariant: "Commission lấy từ giao dịch đã reconciled; refund/chargeback phải đảo commission."
// Case 1: Full Refund
const fullRefundReversal = calculateRefundReversal({
  originalCommission: 150000,
  originalRevenue: 1000000,
  refundRevenue: 1000000
});
assert.strictEqual(fullRefundReversal.reversalAmount, -150000, 'Full refund reverses 100% of commission');
assert.strictEqual(fullRefundReversal.isFullReversal, true);

// Case 2: Partial Refund (e.g. 50% refund)
const partialRefundReversal = calculateRefundReversal({
  originalCommission: 150000,
  originalRevenue: 1000000,
  refundRevenue: 500000
});
assert.strictEqual(partialRefundReversal.reversalAmount, -75000, 'Partial refund (50%) reverses 50% of commission');
assert.strictEqual(partialRefundReversal.isFullReversal, false);

// Test 2c: Balance aggregation with reversal deduction
const commissions = [
  { id: 'c1', status: 'approved', commission_amount: 150000, eligible_revenue: 1000000 },
  { id: 'c2', status: 'pending', commission_amount: 300000, eligible_revenue: 2000000 },
  { id: 'c3', status: 'paid', commission_amount: 200000, eligible_revenue: 1500000 },
  { id: 'c4', status: 'reversed', commission_amount: -75000, eligible_revenue: -500000 } // Reversal
];

const balances = calculateResellerBalances(commissions);
assert.strictEqual(balances.approved, 150000, 'Approved commissions match');
assert.strictEqual(balances.pending, 300000, 'Pending commissions match');
assert.strictEqual(balances.paid, 200000, 'Paid commissions match');
assert.strictEqual(balances.reversed, -75000, 'Reversals match');
// Net claimable: approved + reversed (150,000 - 75,000 = 75,000)
assert.strictEqual(balances.netClaimable, 75000, 'Net claimable commission must subtract reversals from approved balance');

// Test 2d: Strict Tenant Isolation
const resellerUserA = { id: 'user-reseller-a', role: 'member' };
const resellerUserB = { id: 'user-reseller-b', role: 'member' };
const adminUser = { id: 'user-admin', role: 'system_admin' };

const accountA = { id: 'reseller-a-id', user_id: 'user-reseller-a' };
const accountB = { id: 'reseller-b-id', user_id: 'user-reseller-b' };

// Reseller A accessing Account A -> ALLOWED
assert.strictEqual(enforceTenantIsolation(resellerUserA, accountA).allowed, true);

// Reseller A accessing Account B -> DENIED (Strict Tenant Isolation)
assert.strictEqual(enforceTenantIsolation(resellerUserA, accountB).allowed, false);
assert.strictEqual(enforceTenantIsolation(resellerUserA, accountB).reason, 'ACCESS_DENIED_CROSS_TENANT');

// Admin accessing Account B -> ALLOWED
assert.strictEqual(enforceTenantIsolation(adminUser, accountB).allowed, true);

// 3. AdminRepository & AdminService Verification
const adminRepo = fs.readFileSync('src/domain/admin/admin.repository.js', 'utf8');
const adminService = fs.readFileSync('src/domain/admin/admin.service.js', 'utf8');

assert.match(adminRepo, /getResellerPortalOverview/i);
assert.match(adminRepo, /recordResellerCommissionFromPayment/i);
assert.match(adminRepo, /reverseResellerCommission/i);
assert.match(adminRepo, /generateResellerPayoutStatement/i);
assert.match(adminRepo, /payResellerStatement/i);

assert.match(adminService, /getResellerPortalOverview/i);
assert.match(adminService, /generateResellerPayoutStatement/i);
assert.match(adminService, /payResellerStatement/i);

// 4. UI Page Verification
const resellerUiPath = 'src/ui/admin-dashboard/pages/Resellers/ResellerPortal.jsx';
assert.ok(fs.existsSync(resellerUiPath), `ResellerPortal.jsx must exist at: ${resellerUiPath}`);
const resellerUi = fs.readFileSync(resellerUiPath, 'utf8');

assert.match(resellerUi, /Doanh thu đủ điều kiện|eligible_revenue/i, 'UI must display eligible revenue');
assert.match(resellerUi, /Hoa hồng|commission/i, 'UI must display commission breakdown');
assert.match(resellerUi, /pending|approved|paid|reversed/i, 'UI must display commission statuses');
assert.match(resellerUi, /payout/i, 'UI must display payout statements');

console.log('All G010 Reseller Portal contracts verified successfully.');
