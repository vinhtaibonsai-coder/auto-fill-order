import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

test('G015 Contract 1: tests/run-tests.js includes P1-P5 and G001-G014 migrations and contracts in file structure and SQL content sections', () => {
  const runTestsContent = read('tests/run-tests.js');

  // Must check migration files
  assert.ok(runTestsContent.includes('v109_admin_p1_p2_commercial_intelligence.sql'), 'Must check v109 migration file');
  assert.ok(runTestsContent.includes('v110_admin_p3_retention_engine.sql'), 'Must check v110 migration file');
  assert.ok(runTestsContent.includes('v111_remote_selector_release_safety.sql'), 'Must check v111 migration file');
  assert.ok(runTestsContent.includes('v113_standardize_ai_usage_and_cost.sql'), 'Must check v113 migration file');
  assert.ok(runTestsContent.includes('v114_payment_reconciliation_and_idempotency.sql'), 'Must check v114 migration file');
  assert.ok(runTestsContent.includes('v115_system_incidents_and_alert_rules.sql'), 'Must check v115 migration file');
  assert.ok(runTestsContent.includes('v116_provider_resilience_and_analytics.sql'), 'Must check v116 migration file');
  assert.ok(runTestsContent.includes('v117_standardize_job_outbox_reliability.sql'), 'Must check v117 migration file');
  assert.ok(runTestsContent.includes('v118_data_quality_intelligence.sql'), 'Must check v118 migration file');
  assert.ok(runTestsContent.includes('v119_retention_automation_snapshots.sql'), 'Must check v119 migration file');
  assert.ok(runTestsContent.includes('v120_reseller_portal_production.sql'), 'Must check v120 migration file');
  assert.ok(runTestsContent.includes('v121_prepaid_wallet_production_hardening.sql'), 'Must check v121 migration file');
  assert.ok(runTestsContent.includes('v122_unit_economics_intelligence.sql'), 'Must check v122 migration file');

  // Must check unit test files for P1-P2, P3, P5
  assert.ok(runTestsContent.includes('admin-p1-p2-commercial-intelligence.test.mjs'), 'Must check admin-p1-p2 test file');
  assert.ok(runTestsContent.includes('admin-p3-retention-engine.test.mjs'), 'Must check admin-p3 test file');
  assert.ok(runTestsContent.includes('admin-p5-remote-selectors.test.mjs'), 'Must check admin-p5 test file');
});

test('G015 Contract 2: package.json test runner includes g015 test in main test pipeline', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.ok(pkg.scripts.test.includes('g015-test-build-gate.test.mjs'), 'package.json test script must include g015-test-build-gate.test.mjs');
  assert.ok(pkg.scripts['test:security'], 'Must have test:security script');
  assert.ok(pkg.scripts['test:e2e'], 'Must have test:e2e script');
  assert.ok(pkg.scripts.build, 'Must have build script');
});

test('G015 Contract 3: tests/reports/TEST-RESULTS.json contains environment context, differentiating environment skips from product failures', () => {
  const reportPath = path.join(root, 'tests/reports/TEST-RESULTS.json');
  assert.ok(fs.existsSync(reportPath), 'TEST-RESULTS.json must exist');
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

  assert.ok(report.environment !== undefined, 'TEST-RESULTS.json must contain environment metadata');
  assert.ok(report.gate_summary !== undefined, 'TEST-RESULTS.json must contain gate_summary');
  assert.ok(report.gate_summary.unit_and_integration !== undefined, 'Must summarize unit_and_integration gate');
  assert.ok(report.gate_summary.security !== undefined, 'Must summarize security gate');
  assert.ok(report.gate_summary.e2e !== undefined, 'Must summarize e2e gate');
  assert.equal(report.failed, 0, 'No product failures allowed');
});
