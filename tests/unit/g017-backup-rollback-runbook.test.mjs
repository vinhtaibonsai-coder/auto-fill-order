import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = process.cwd();
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

test('G017 Contract 1: All required operational runbooks exist in docs/runbooks/', () => {
  const requiredRunbooks = [
    'docs/runbooks/RUNBOOK_INDEX.md',
    'docs/runbooks/PAYMENT_GATEWAY_OUTAGE.md',
    'docs/runbooks/AI_PROVIDER_OUTAGE.md',
    'docs/runbooks/CARRIER_DOM_CHANGE.md',
    'docs/runbooks/SUPABASE_OUTAGE.md',
    'docs/runbooks/ROLLBACK_PROCEDURES.md',
    'docs/runbooks/BACKUP_AND_RESTORE.md'
  ];

  for (const rel of requiredRunbooks) {
    const full = path.join(root, rel);
    assert.ok(fs.existsSync(full), `Runbook missing: ${rel}`);
    const content = read(rel);
    assert.ok(content.length > 300, `Runbook ${rel} must contain substantive instructions`);
    assert.match(content, /(?:Triệu chứng|Symptoms|Mục tiêu|Overview)/i, `${rel} must define symptoms/overview`);
    assert.match(content, /(?:Xử lý|Remediation|Quy trình|Procedure)/i, `${rel} must define remediation procedures`);
    assert.match(content, /(?:Xác minh|Verification|Tiêu chí|Criteria)/i, `${rel} must define verification criteria`);
  }
});

test('G017 Contract 2: Payment Gateway Outage runbook specifies exact remediation commands', () => {
  const content = read('docs/runbooks/PAYMENT_GATEWAY_OUTAGE.md');

  // Must reference reconciliation RPC and fields
  assert.match(content, /admin_reconcile_payment_transaction/, 'Must specify admin_reconcile_payment_transaction RPC');
  assert.match(content, /reconciliation_status/, 'Must specify reconciliation_status');
  assert.match(content, /unmatched|failed/, 'Must detail unmatched/failed status handling');
  assert.match(content, /HMAC|webhook/i, 'Must cover webhook verification');
  assert.match(content, /idempotency/i, 'Must address webhook idempotency');
});

test('G017 Contract 3: AI Provider Outage runbook specifies circuit breaker and fallback chain', () => {
  const content = read('docs/runbooks/AI_PROVIDER_OUTAGE.md');

  assert.match(content, /circuit breaker|CIRCUIT_BREAKER/i, 'Must reference circuit breaker state machine');
  assert.match(content, /OPEN|HALF-OPEN|CLOSED/, 'Must define circuit breaker states');
  assert.match(content, /fallback/i, 'Must define provider fallback chain');
  assert.match(content, /local-first|fast-path/i, 'Must describe local address parser bypass');
  assert.match(content, /ai_model_cost_rates/i, 'Must reference rate governance or quotas');
});

test('G017 Contract 4: Carrier DOM Change runbook specifies remote selector release & rollback', () => {
  const content = read('docs/runbooks/CARRIER_DOM_CHANGE.md');

  assert.match(content, /admin_publish_remote_selector_release/, 'Must specify remote selector publish RPC');
  assert.match(content, /admin_rollback_remote_selector_release/, 'Must specify remote selector rollback RPC');
  assert.match(content, /vnpost|j&t/i, 'Must cover VNPost and J&T carriers');
  assert.match(content, /checksum|SHA-256/i, 'Must mention selector checksum integrity');
});

test('G017 Contract 5: Supabase Outage runbook specifies offline queue, Gotrue repair, and incidents', () => {
  const content = read('docs/runbooks/SUPABASE_OUTAGE.md');

  assert.match(content, /offline/i, 'Must describe offline local storage queue');
  assert.match(content, /admin_repair_user_auth/, 'Must specify admin_repair_user_auth RPC');
  assert.match(content, /record_system_incident/, 'Must specify record_system_incident RPC');
  assert.match(content, /system_incidents/, 'Must reference system_incidents table');
});

test('G017 Contract 6: Rollback and Backup/Restore Runbooks and Verification Script', () => {
  const rollbackContent = read('docs/runbooks/ROLLBACK_PROCEDURES.md');
  assert.match(rollbackContent, /extension/i, 'Must cover extension rollback');
  assert.match(rollbackContent, /migration/i, 'Must cover database migration rollback');
  assert.match(rollbackContent, /package-release\.js/i, 'Must reference release packager');

  const backupContent = read('docs/runbooks/BACKUP_AND_RESTORE.md');
  assert.match(backupContent, /RPO/i, 'Must specify RPO target');
  assert.match(backupContent, /RTO/i, 'Must specify RTO target');
  assert.match(backupContent, /SHA-256|hash/i, 'Must verify backup integrity via hash');

  // Verify executable drill script exists
  const drillScript = path.join(root, 'scripts', 'backup-restore-drill.js');
  assert.ok(fs.existsSync(drillScript), 'scripts/backup-restore-drill.js must exist');

  // Execute backup-restore drill in dry-run mode
  const output = execSync('node scripts/backup-restore-drill.js --dry-run', { cwd: root, encoding: 'utf8' });
  assert.match(output, /BACKUP_VERIFIED_SUCCESS/i, 'Backup drill must report BACKUP_VERIFIED_SUCCESS');
  assert.match(output, /RESTORE_DRILL_SUCCESS/i, 'Restore drill must report RESTORE_DRILL_SUCCESS');
  assert.match(output, /ROLLBACK_SIMULATION_SUCCESS/i, 'Rollback simulation must report ROLLBACK_SIMULATION_SUCCESS');
});
