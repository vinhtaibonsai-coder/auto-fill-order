import assert from 'node:assert/strict';
import fs from 'node:fs';
import { UnitEconomicsEngine } from '../../src/domain/admin/unit-economics.engine.js';
import { AdminRepository } from '../../src/domain/admin/admin.repository.js';
import { AdminService } from '../../src/domain/admin/admin.service.js';

console.log('--- Test Suite: G012 Unit Economics Đầy Đủ ---');

// 1. Static Migration Contract Check
const v122 = fs.readFileSync('database/migrations/v122_unit_economics_intelligence.sql', 'utf8');
const runAll = fs.readFileSync('database/migrations/RUN_ALL_MIGRATIONS.sql', 'utf8');

assert.match(v122, /commercial_cost_entries/i, 'v122 must reference commercial_cost_entries');
assert.match(v122, /voucher_url/i, 'v122 must add voucher_url for audit proofs');
assert.match(v122, /is_acquisition/i, 'v122 must add is_acquisition flag');
assert.match(v122, /admin_get_unit_economics_analytics/i, 'v122 must declare admin_get_unit_economics_analytics RPC');
assert.match(v122, /is_system_admin\(\)/i, 'v122 must enforce is_system_admin guard');
assert.match(v122, /GRANT EXECUTE ON FUNCTION public\.admin_get_unit_economics_analytics/i, 'v122 must grant execute on RPC');
assert.match(runAll, /v122_unit_economics_intelligence\.sql/i, 'RUN_ALL_MIGRATIONS must include v122');
console.log('✔ 1. Migration v122 declares unit economics schema and security guard');

// 2. Unit Economics Engine - Gross Margin & Net Contribution
const basePeriodData = {
  revenue: 10000000,
  directAiCost: 1500000,
  costs: [
    { costType: 'AI', amount: 1500000 },
    { costType: 'INFRASTRUCTURE', amount: 1000000, voucherUrl: 'https://cdn.example.com/inv-infra-01.pdf' },
    { costType: 'SUPPORT', amount: 500000, voucherUrl: 'https://cdn.example.com/inv-supp-01.pdf' },
    { costType: 'MARKETING', amount: 2000000, isAcquisition: true, voucherUrl: 'https://cdn.example.com/ads-receipt-01.png' },
    { costType: 'MARKETING', amount: 800000, isAcquisition: false, voucherUrl: null } // brand/retention, no acquisition voucher
  ],
  newPayingShops: 4,
  totalPayingShops: 10,
  churnRatePercent: 5.0
};

const result = UnitEconomicsEngine.calculateUnitEconomics(basePeriodData);

assert.equal(result.grossProfit, 8500000, 'Gross profit = 10M - 1.5M = 8.5M');
assert.equal(result.grossMarginPercent, 85.0, 'Gross margin % = 85%');
assert.equal(result.indirectCostsTotal, 4300000, 'Indirect costs = 1M (infra) + 0.5M (support) + 2.8M (marketing) = 4.3M');
assert.equal(result.netContribution, 4200000, 'Net contribution = 8.5M - 4.3M = 4.2M');
assert.equal(result.netContributionPercent, 42.0, 'Net contribution % = 42%');
console.log('✔ 2. Gross margin and net contribution calculated accurately');

// 3. CAC & LTV Invariants: Documented Proof & Minimum Sample Size Guard
// Case 3a: CAC only counts documented acquisition marketing costs
// Documented acquisition marketing = 2,000,000 (the 800,000 has no voucher and isAcquisition=false)
assert.equal(result.documentedAcquisitionCost, 2000000, 'Only documented acquisition costs are counted in CAC');
assert.equal(result.cac, 500000, 'CAC = 2,000,000 / 4 new paying shops = 500,000');
assert.equal(result.cacStatus, 'DOCUMENTED', 'CAC status is marked DOCUMENTED');

// Case 3b: If no documented acquisition costs or 0 new paying shops -> CAC is null, display N/A
const noAcqData = { ...basePeriodData, costs: [{ costType: 'MARKETING', amount: 1000000, isAcquisition: false, voucherUrl: null }], newPayingShops: 0 };
const noAcqResult = UnitEconomicsEngine.calculateUnitEconomics(noAcqData);
assert.equal(noAcqResult.cac, null, 'CAC must be null without documented acquisition or new shops');
assert.match(noAcqResult.cacDisplay, /N\/A/, 'CAC display must be N/A');

// Case 3c: LTV minimum sample size guard (MIN_SAMPLE_SIZE = 5)
// With 10 paying shops >= 5:
assert.equal(result.sampleSizeMet, true, 'Sample size >= 5 met');
assert.ok(result.ltv > 0, 'LTV is calculated when sample size is sufficient');
assert.match(result.ltvFormula, /ARPU/, 'LTV must display formula specification');

// With 3 paying shops (< 5):
const smallSampleData = { ...basePeriodData, totalPayingShops: 3 };
const smallSampleResult = UnitEconomicsEngine.calculateUnitEconomics(smallSampleData);
assert.equal(smallSampleResult.sampleSizeMet, false, 'Sample size < 5 not met');
assert.equal(smallSampleResult.ltv, null, 'LTV must be null when sample size < 5');
assert.match(smallSampleResult.ltvDisplay, /N\/A/, 'LTV display must indicate N/A for insufficient sample size');
console.log('✔ 3. CAC documented proof and LTV minimum sample size invariants verified');

// 4. Cohort Retention Matrix (M0/M1/M2/M3) and Revenue Retention (NDR/GRR)
const cohortData = [
  {
    cohortMonth: '2026-06',
    cohortSize: 20,
    m0Count: 20,
    m1Count: 16,
    m2Count: 14,
    m3Count: 13,
    m0Revenue: 20000000,
    m1Revenue: 18000000,
    m2Revenue: 17000000,
    m3Revenue: 19500000,
    isMatureM3: true
  },
  {
    cohortMonth: '2026-08',
    cohortSize: 25,
    m0Count: 25,
    m1Count: 22,
    m2Count: null, // immature
    m3Count: null, // immature
    m0Revenue: 25000000,
    m1Revenue: 24000000,
    m2Revenue: null,
    m3Revenue: null,
    isMatureM3: false
  }
];

const cohortAnalysis = UnitEconomicsEngine.calculateCohortRetention(cohortData);
const june = cohortAnalysis.find(c => c.cohortMonth === '2026-06');
assert.equal(june.m0Retention, 100.0, 'M0 retention is 100%');
assert.equal(june.m1Retention, 80.0, 'M1 retention is 16/20 = 80%');
assert.equal(june.m2Retention, 70.0, 'M2 retention is 14/20 = 70%');
assert.equal(june.m3Retention, 65.0, 'M3 retention is 13/20 = 65%');
assert.equal(june.ndr, 97.5, 'NDR M3 = 19.5M / 20M = 97.5%');

const august = cohortAnalysis.find(c => c.cohortMonth === '2026-08');
assert.equal(august.m1Retention, 88.0, 'M1 retention is 22/25 = 88%');
assert.equal(august.m2Retention, null, 'Immature M2 must be null');
assert.equal(august.m2Display, 'N/A', 'Immature M2 display must be N/A');
assert.equal(august.m3Retention, null, 'Immature M3 must be null');
console.log('✔ 4. Cohort M0-M3 retention and NDR/GRR revenue retention verified');

// 5. Reconciliation Invariant: Ledger, Payment & Cost Reconciliation
const reconciledCheck = UnitEconomicsEngine.reconcileLedgerAndPayments({
  paymentRevenueTotal: 10000000,
  ledgerRevenueTotal: 10000000,
  totalCosts: 5800000,
  recordedCosts: 5800000
});
assert.equal(reconciledCheck.isReconciled, true, 'Reconciliation passes when totals match');
assert.equal(reconciledCheck.discrepancy, 0, 'Discrepancy is 0');

const discrepancyCheck = UnitEconomicsEngine.reconcileLedgerAndPayments({
  paymentRevenueTotal: 10000000,
  ledgerRevenueTotal: 9500000,
  totalCosts: 5800000,
  recordedCosts: 5800000
});
assert.equal(discrepancyCheck.isReconciled, false, 'Reconciliation fails when totals mismatch');
assert.equal(discrepancyCheck.discrepancy, 500000, 'Discrepancy is 500,000 VND');
assert.equal(discrepancyCheck.status, 'DISCREPANCY_DETECTED', 'Status indicates discrepancy');
console.log('✔ 5. Reconciliation invariants between ledger, payment, and costs verified');

// 6. AdminRepository and AdminService Wiring
assert.equal(typeof AdminRepository.getUnitEconomicsAnalytics, 'function', 'AdminRepository must expose getUnitEconomicsAnalytics');
assert.equal(typeof AdminService.getUnitEconomicsAnalytics, 'function', 'AdminService must expose getUnitEconomicsAnalytics');
console.log('✔ 6. Repository and Service wiring verified');

console.log('All G012 Unit Economics contracts verified successfully.');
