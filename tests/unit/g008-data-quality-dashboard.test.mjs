import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

const read = (relPath) => fs.readFileSync(path.join(rootDir, relPath), 'utf8');

test('G008 - 1. Migration v118 defines data quality KPI RPC, drilldown RPC, resolution RPC, and audit trail', () => {
  const migrationPath = 'database/migrations/v118_data_quality_intelligence.sql';
  assert.ok(fs.existsSync(path.join(rootDir, migrationPath)), 'Migration v118 must exist');
  const sql = read(migrationPath);

  // RPCs
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.admin_get_data_quality_kpis/i);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.admin_get_data_quality_drilldown/i);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.admin_resolve_data_quality_issue/i);

  // 5 Quality Vectors in RPC
  assert.match(sql, /missing_tracking_code/i);
  assert.match(sql, /invalid_duplicate_order_code/i);
  assert.match(sql, /low_confidence_address/i);
  assert.match(sql, /stale_carrier_status/i);
  assert.match(sql, /unmatched_payment/i);

  // Security & Audit
  assert.match(sql, /public\.is_system_admin\(\)/i, 'Admin actions must be guarded by is_system_admin');
  assert.match(sql, /INSERT INTO public\.audit_logs/i, 'Issue resolution must record audit log');
  assert.doesNotMatch(sql, /DROP[^\n;]+CASCADE/i, 'Forbidden: DROP ... CASCADE is prohibited');

  // Verify RUN_ALL_MIGRATIONS references v118
  const runAll = read('database/migrations/RUN_ALL_MIGRATIONS.sql');
  assert.match(runAll, /v118_data_quality_intelligence\.sql/i);
});

test('G008 - 2. Data Quality Engine evaluates all 5 quality vectors accurately', async () => {
  const engineModule = await import('../../src/domain/admin/data-quality.engine.js');
  const {
    DATA_QUALITY_KPIS,
    evaluateDataQualityMetrics
  } = engineModule;

  assert.ok(DATA_QUALITY_KPIS, 'DATA_QUALITY_KPIS must be exported');
  assert.ok(DATA_QUALITY_KPIS.MISSING_TRACKING);
  assert.ok(DATA_QUALITY_KPIS.DUPLICATE_CODE);
  assert.ok(DATA_QUALITY_KPIS.LOW_CONFIDENCE_ADDRESS);
  assert.ok(DATA_QUALITY_KPIS.STALE_CARRIER_STATUS);
  assert.ok(DATA_QUALITY_KPIS.UNMATCHED_PAYMENT);

  const mockOrders = [
    { id: 'o1', shop_id: 's1', order_code: 'ORD-001', tracking_code: 'VN123', status: 'submitted', updated_at: new Date().toISOString() },
    // Missing tracking code
    { id: 'o2', shop_id: 's1', order_code: 'ORD-002', tracking_code: '', status: 'submitted', updated_at: new Date().toISOString() },
    // Duplicate order code in same shop
    { id: 'o3', shop_id: 's1', order_code: 'ORD-001', tracking_code: 'VN124', status: 'submitted', updated_at: new Date().toISOString() },
    // Stale carrier status (> 72 hours without final delivery)
    { id: 'o4', shop_id: 's1', order_code: 'ORD-004', tracking_code: 'VN125', status: 'in_transit', updated_at: new Date(Date.now() - 80 * 3600 * 1000).toISOString() }
  ];

  const mockDrafts = [
    // Low confidence address
    { id: 'd1', shop_id: 's1', order_code: 'DFT-001', address_score: 45, confidence: 0.4, ward: null }
  ];

  const mockPayments = [
    // Unmatched payment
    { id: 'p1', shop_id: null, status: 'FAILED', reconciliation_status: 'unmatched', amount: 50000 }
  ];

  const metrics = evaluateDataQualityMetrics({
    orders: mockOrders,
    drafts: mockDrafts,
    payments: mockPayments
  });

  assert.equal(metrics.missing_tracking_code, 1, 'Should find 1 order with missing tracking code');
  assert.equal(metrics.invalid_duplicate_order_code, 2, 'Should find 2 orders sharing duplicate code');
  assert.equal(metrics.low_confidence_address, 1, 'Should find 1 draft with low confidence address');
  assert.equal(metrics.stale_carrier_status, 1, 'Should find 1 order with stale carrier status');
  assert.equal(metrics.unmatched_payment, 1, 'Should find 1 unmatched payment transaction');
});

test('G008 - 3. Strict PII Masking: Customer names and phones are masked in drill-down views', async () => {
  const { maskCustomerPii, sanitizeDrilldownRecord } = await import('../../src/domain/admin/data-quality.engine.js');

  assert.ok(typeof maskCustomerPii === 'function');
  const masked = maskCustomerPii('Nguyễn Văn An', '0987654321');
  assert.equal(masked.maskedName, 'Ng**** An');
  assert.equal(masked.maskedPhone, '09****4321');

  const rawRecord = {
    id: 'ord_123',
    customer_name: 'Trần Thị Thu Thảo',
    phone: '0912345678',
    address: 'Số 12 Lê Lợi, Phường 1, Quận 1, TP.HCM',
    order_code: 'ORD-888'
  };

  const sanitized = sanitizeDrilldownRecord(rawRecord);
  assert.equal(sanitized.customer_name, undefined, 'Raw customer_name must not be exposed');
  assert.equal(sanitized.phone, undefined, 'Raw phone must not be exposed');
  assert.ok(sanitized.customer_name_masked);
  assert.ok(sanitized.customer_phone_masked);
  assert.equal(sanitized.customer_phone_masked, '09****5678');
});

test('G008 - 4. Drill-Down Reconciliation Invariant: KPI total equals drill-down total with 0 variance', async () => {
  const { verifyKpiDrilldownReconciliation } = await import('../../src/domain/admin/data-quality.engine.js');

  const validDrilldown = {
    total: 42,
    records: new Array(42).fill(null).map((_, i) => ({ id: `rec_${i}` }))
  };

  const checkPass = verifyKpiDrilldownReconciliation(42, validDrilldown);
  assert.equal(checkPass.reconciled, true);
  assert.equal(checkPass.variance, 0);

  const invalidDrilldown = {
    total: 39,
    records: new Array(39).fill(null).map((_, i) => ({ id: `rec_${i}` }))
  };

  const checkFail = verifyKpiDrilldownReconciliation(42, invalidDrilldown);
  assert.equal(checkFail.reconciled, false);
  assert.equal(checkFail.variance, 3);
});

test('G008 - 5. Admin Service, Repository, and DataQuality UI provide range filtering, CSV export, and preview-before-fix guard', () => {
  const repo = read('src/domain/admin/admin.repository.js');
  const service = read('src/domain/admin/admin.service.js');
  const appUi = read('src/ui/admin-dashboard/App.jsx');
  const dataQualityUi = read('src/ui/admin-dashboard/pages/DataQuality/DataQuality.jsx');

  // Repository & Service methods
  assert.match(repo, /getDataQualityKpis\s*\(/, 'AdminRepository must implement getDataQualityKpis');
  assert.match(repo, /getDataQualityDrilldown\s*\(/, 'AdminRepository must implement getDataQualityDrilldown');
  assert.match(repo, /resolveDataQualityIssue\s*\(/, 'AdminRepository must implement resolveDataQualityIssue');
  assert.match(service, /getDataQualityKpis\s*\(/, 'AdminService must implement getDataQualityKpis');
  assert.match(service, /getDataQualityDrilldown\s*\(/, 'AdminService must implement getDataQualityDrilldown');
  assert.match(service, /resolveDataQualityIssue\s*\(/, 'AdminService must implement resolveDataQualityIssue');

  // App.jsx registration
  assert.match(appUi, /data-quality/i, 'App.jsx must register data-quality page');

  // UI features in DataQuality.jsx
  assert.match(dataQualityUi, /Chất Lượng Dữ Liệu/i, 'DataQuality must contain quality heading');
  assert.match(dataQualityUi, /missing_tracking_code/i, 'DataQuality must handle missing_tracking_code');
  assert.match(dataQualityUi, /invalid_duplicate_order_code/i, 'DataQuality must handle invalid_duplicate_order_code');
  assert.match(dataQualityUi, /low_confidence_address/i, 'DataQuality must handle low_confidence_address');
  assert.match(dataQualityUi, /stale_carrier_status/i, 'DataQuality must handle stale_carrier_status');
  assert.match(dataQualityUi, /unmatched_payment/i, 'DataQuality must handle unmatched_payment');
  assert.match(dataQualityUi, /handleExportCsv/i, 'DataQuality must provide CSV export');
  assert.match(dataQualityUi, /handlePreviewFix|previewModal/i, 'DataQuality must enforce preview-before-fix guard');
});
