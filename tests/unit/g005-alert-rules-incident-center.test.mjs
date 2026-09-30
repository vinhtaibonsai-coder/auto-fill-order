import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

const read = (relPath) => fs.readFileSync(path.join(rootDir, relPath), 'utf8');

test('G005 - 1. Migration v115 defines system incidents schema, deduplication, and admin RPCs', () => {
  const migrationPath = 'database/migrations/v115_system_incidents_and_alert_rules.sql';
  assert.ok(fs.existsSync(path.join(rootDir, migrationPath)), 'Migration v115 must exist');
  const sql = read(migrationPath);

  // Table definition
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.system_incidents/i);
  assert.match(sql, /rule_code\s+TEXT/i);
  assert.match(sql, /severity\s+TEXT\s+NOT\s+NULL\s+CHECK\s*\(\s*severity\s+IN\s*\(\s*'info'\s*,\s*'warning'\s*,\s*'critical'\s*\)\s*\)/i);
  assert.match(sql, /threshold\s+NUMERIC/i);
  assert.match(sql, /metric_value\s+NUMERIC/i);
  assert.match(sql, /window_seconds\s+INT/i);
  assert.match(sql, /dedupe_key\s+TEXT/i);
  assert.match(sql, /first_seen_at\s+TIMESTAMPTZ/i);
  assert.match(sql, /last_seen_at\s+TIMESTAMPTZ/i);
  assert.match(sql, /occurrence_count\s+INT/i);
  assert.match(sql, /status\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'firing'/i);
  assert.match(sql, /acknowledged_at\s+TIMESTAMPTZ/i);
  assert.match(sql, /resolved_at\s+TIMESTAMPTZ/i);
  assert.match(sql, /owner\s+TEXT/i);
  assert.match(sql, /source_link\s+TEXT/i);

  // Deduplication & RLS
  assert.match(sql, /record_system_incident/i);
  assert.match(sql, /admin_get_incidents/i);
  assert.match(sql, /admin_update_incident_status/i);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/i);
  assert.match(sql, /public\.is_system_admin\(\)/i);
  assert.doesNotMatch(sql, /DROP[^\n;]+CASCADE/i, 'Forbidden: DROP ... CASCADE is prohibited');

  // Verify RUN_ALL_MIGRATIONS references v115
  const runAll = read('database/migrations/RUN_ALL_MIGRATIONS.sql');
  assert.match(runAll, /v115_system_incidents_and_alert_rules\.sql/i);
});

test('G005 - 2. Incident Engine implements all 6 required operational alert rules', async () => {
  const engineModule = await import('../../src/domain/admin/incident.engine.js');
  const { evaluateSystemAlertRules, ALERT_RULES } = engineModule;

  assert.ok(typeof evaluateSystemAlertRules === 'function', 'evaluateSystemAlertRules must be exported');
  assert.ok(ALERT_RULES, 'ALERT_RULES constant must be exported');

  const requiredRuleCodes = [
    'ai_error_rate',
    'provider_latency',
    'webhook_failure',
    'carrier_dom_failure',
    'sync_backlog',
    'payment_reconciliation_backlog'
  ];

  for (const code of requiredRuleCodes) {
    assert.ok(ALERT_RULES[code], `Rule code ${code} must be defined in ALERT_RULES`);
    assert.ok(ALERT_RULES[code].threshold != null, `Rule ${code} must define a threshold`);
    assert.ok(ALERT_RULES[code].windowSeconds != null, `Rule ${code} must define a window in seconds`);
  }

  // Evaluate normal health metrics - should produce 0 alerts
  const healthyMetrics = {
    ai_total_requests: 100,
    ai_error_requests: 1, // 1% < 10%
    provider_latency_ms: 1200, // < 5000ms
    webhook_failures_count: 0,
    carrier_status: 'healthy',
    sync_failed_count: 0,
    sync_pending_count: 2,
    unmatched_payment_count: 0
  };

  const normalAlerts = evaluateSystemAlertRules(healthyMetrics);
  assert.equal(normalAlerts.length, 0, 'Healthy metrics must not trigger any alerts');

  // Evaluate unhealthy metrics - should trigger all 6 alerts
  const unhealthyMetrics = {
    ai_total_requests: 100,
    ai_error_requests: 30, // 30% > 10% threshold -> ai_error_rate
    provider_latency_ms: 6500, // 6500ms > 5000ms threshold -> provider_latency
    webhook_failures_count: 5, // 5 >= 3 threshold -> webhook_failure
    carrier_status: 'dom_changed', // carrier DOM failure
    carrier_code: 'VNPOST',
    sync_failed_count: 6, // 6 > 5 threshold -> sync_backlog
    sync_pending_count: 35,
    unmatched_payment_count: 3 // 3 > 0 threshold -> payment_reconciliation_backlog
  };

  const triggeredAlerts = evaluateSystemAlertRules(unhealthyMetrics);
  assert.equal(triggeredAlerts.length, 6, 'All 6 rules must trigger on unhealthy metrics');

  const triggeredCodes = triggeredAlerts.map(a => a.rule_code);
  for (const code of requiredRuleCodes) {
    assert.ok(triggeredCodes.includes(code), `Alert for rule ${code} must be present`);
  }

  // Verify structure of triggered alert
  for (const alert of triggeredAlerts) {
    assert.ok(alert.rule_code, 'Alert must have rule_code');
    assert.ok(['info', 'warning', 'critical'].includes(alert.severity), 'Severity must be info, warning, or critical');
    assert.ok(alert.title, 'Alert must have title');
    assert.ok(alert.message, 'Alert must have message');
    assert.ok(alert.dedupe_key, 'Alert must have dedupe_key');
    assert.ok(alert.threshold != null, 'Alert must have threshold');
    assert.ok(alert.metric_value != null, 'Alert must have metric_value');
    assert.ok(alert.window_seconds != null, 'Alert must have window_seconds');
  }
});

test('G005 - 3. Deduplication window contract: duplicate triggers generate identical dedupe keys', async () => {
  const { evaluateSystemAlertRules } = await import('../../src/domain/admin/incident.engine.js');

  const metric1 = {
    ai_total_requests: 100,
    ai_error_requests: 25,
    provider_latency_ms: 1200
  };
  const metric2 = {
    ai_total_requests: 200,
    ai_error_requests: 60,
    provider_latency_ms: 1200
  };

  const alerts1 = evaluateSystemAlertRules(metric1);
  const alerts2 = evaluateSystemAlertRules(metric2);

  const aiAlert1 = alerts1.find(a => a.rule_code === 'ai_error_rate');
  const aiAlert2 = alerts2.find(a => a.rule_code === 'ai_error_rate');

  assert.ok(aiAlert1 && aiAlert2, 'Both evaluation rounds must fire AI error rate alert');
  assert.equal(aiAlert1.dedupe_key, aiAlert2.dedupe_key, 'Dedupe key must remain deterministic across evaluations to prevent duplicate incident creation');
});

test('G005 - 4. PII Sanitization invariant: customer names, phones, and addresses are stripped', async () => {
  const { sanitizeIncidentPayload } = await import('../../src/domain/admin/incident.engine.js');

  const dirtyPayload = {
    customer_name: 'Nguyễn Văn A',
    name: 'Trần Thị B',
    phone: '0912345678',
    phone_number: '0987654321',
    address: '123 Đường Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
    raw_address: 'Số 45 Ngõ 12 Thái Hà, Đống Đa, Hà Nội',
    street: '123 Lê Lợi',
    email: 'khachhang@example.com',
    carrier: 'VNPOST',
    error_code: 'DOM_SELECTOR_NOT_FOUND',
    response_time_ms: 4500
  };

  const cleanPayload = sanitizeIncidentPayload(dirtyPayload);

  // Sensitive PII must be completely removed
  assert.equal(cleanPayload.customer_name, undefined, 'customer_name must be deleted');
  assert.equal(cleanPayload.name, undefined, 'name must be deleted');
  assert.equal(cleanPayload.phone, undefined, 'phone must be deleted');
  assert.equal(cleanPayload.phone_number, undefined, 'phone_number must be deleted');
  assert.equal(cleanPayload.address, undefined, 'address must be deleted');
  assert.equal(cleanPayload.raw_address, undefined, 'raw_address must be deleted');
  assert.equal(cleanPayload.street, undefined, 'street must be deleted');
  assert.equal(cleanPayload.email, undefined, 'email must be deleted');

  // Operational fields must be preserved
  assert.equal(cleanPayload.carrier, 'VNPOST');
  assert.equal(cleanPayload.error_code, 'DOM_SELECTOR_NOT_FOUND');
  assert.equal(cleanPayload.response_time_ms, 4500);
});

test('G005 - 5. Admin Service, Repository, and SystemHealth UI incorporate Incident Center', () => {
  const repo = read('src/domain/admin/admin.repository.js');
  const service = read('src/domain/admin/admin.service.js');
  const ui = read('src/ui/admin-dashboard/pages/SystemHealth/SystemHealth.jsx');

  // Repository & Service methods
  assert.match(repo, /getIncidents\s*\(/, 'AdminRepository must implement getIncidents');
  assert.match(repo, /updateIncidentStatus\s*\(/, 'AdminRepository must implement updateIncidentStatus');
  assert.match(service, /getIncidents\s*\(/, 'AdminService must implement getIncidents');
  assert.match(service, /updateIncidentStatus\s*\(/, 'AdminService must implement updateIncidentStatus');

  // UI components
  assert.match(ui, /Trung Tâm Sự Cố/i, 'SystemHealth must contain Incident Center heading');
  assert.match(ui, /handleAcknowledgeIncident/i, 'SystemHealth must provide acknowledge handler');
  assert.match(ui, /handleResolveIncident/i, 'SystemHealth must provide resolve handler');
  assert.match(ui, /handleExportIncidentsCsv/i, 'SystemHealth must provide CSV export for incidents');
  assert.match(ui, /filterSeverity|filterStatus/i, 'SystemHealth must provide status or severity filtering');
});
