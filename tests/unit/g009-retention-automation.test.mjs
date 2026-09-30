import assert from 'node:assert/strict';
import fs from 'node:fs';

console.log('--- Test Suite: G009 Retention Automation ---');

// 1. Schema & Migration Verification
const migrationPath = 'database/migrations/v119_retention_automation_snapshots.sql';
assert.ok(fs.existsSync(migrationPath), `Migration file must exist: ${migrationPath}`);
const migrationSql = fs.readFileSync(migrationPath, 'utf8');

assert.match(migrationSql, /CREATE TABLE IF NOT EXISTS public\.retention_daily_snapshots/i, 'Must define retention_daily_snapshots table');
assert.match(migrationSql, /uq_retention_daily_snapshot|UNIQUE\s*\(\s*snapshot_date\s*,\s*shop_id\s*\)/i, 'Must enforce unique constraint on (snapshot_date, shop_id)');
assert.match(migrationSql, /ALTER TABLE public\.retention_actions ADD COLUMN IF NOT EXISTS playbook_code/i, 'Must enhance retention_actions with playbook_code');
assert.match(migrationSql, /ALTER TABLE public\.retention_actions ADD COLUMN IF NOT EXISTS assignee_id/i, 'Must enhance retention_actions with assignee_id');
assert.match(migrationSql, /ALTER TABLE public\.retention_actions ADD COLUMN IF NOT EXISTS outcome/i, 'Must enhance retention_actions with outcome');
assert.match(migrationSql, /ALTER TABLE public\.retention_actions ADD COLUMN IF NOT EXISTS next_action/i, 'Must enhance retention_actions with next_action');
assert.match(migrationSql, /admin_generate_retention_snapshots/i, 'Must define admin_generate_retention_snapshots RPC');
assert.match(migrationSql, /admin_create_playbook_task/i, 'Must define admin_create_playbook_task RPC');
assert.match(migrationSql, /admin_update_retention_task/i, 'Must define admin_update_retention_task RPC');
assert.match(migrationSql, /admin_get_cohort_retention_analytics/i, 'Must define admin_get_cohort_retention_analytics RPC');

// 2. Domain Engine: Invariant verification
import {
  createPlaybookTaskWithDedup,
  calculateCohortConversion,
  evaluateSegmentTransitions,
  PLAYBOOK_CODES,
  TASK_OUTCOMES
} from '../../src/domain/admin/retention.engine.js';

// Test 2a: Deduplication invariant: "Một shop chuyển segment tạo tối đa một task đang mở cho cùng playbook."
const shop1 = 'shop-uuid-1';
const existingTasks = [
  { id: 'task-1', shop_id: shop1, playbook_code: 'AT_RISK', status: 'OPEN', created_at: '2026-09-20' },
  { id: 'task-2', shop_id: shop1, playbook_code: 'EXPIRING_SOON', status: 'DONE', outcome: 'RENEWED', created_at: '2026-09-18' }
];

// Attempt to add duplicate open AT_RISK task for shop1
const dupAttempt = createPlaybookTaskWithDedup(existingTasks, {
  shop_id: shop1,
  playbook_code: 'AT_RISK',
  assignee_id: 'user-1',
  assignee_name: 'CSKH Support',
  note: 'Customer inactive 3 days'
});
assert.strictEqual(dupAttempt.created, false, 'Duplicate open task for same shop and playbook must not be created');
assert.strictEqual(dupAttempt.deduplicated, true, 'Result must be flagged as deduplicated');
assert.strictEqual(dupAttempt.task.id, 'task-1', 'Must return existing open task');

// Adding EXPIRING_SOON task when previous was DONE -> Allowed!
const allowNewExpiring = createPlaybookTaskWithDedup(existingTasks, {
  shop_id: shop1,
  playbook_code: 'EXPIRING_SOON',
  assignee_id: 'user-1',
  assignee_name: 'CSKH Support',
  note: 'Package expiring in 3 days'
});
assert.strictEqual(allowNewExpiring.created, true, 'New task allowed if previous task was DONE');
assert.strictEqual(allowNewExpiring.deduplicated, false);

// Test 2b: Cohort Conversion denominator calculation
// "Tính conversion theo cohort đúng mẫu số; tách trial còn mở khỏi trial thất bại."
const cohortData = [
  {
    cohort_month: '2026-07',
    total_shops: 100,
    active_trial_shops: 0,
    failed_trial_shops: 70,
    converted_shops: 30
  },
  {
    cohort_month: '2026-08',
    total_shops: 80,
    active_trial_shops: 20, // 20 still trialing!
    failed_trial_shops: 30,
    converted_shops: 30
  },
  {
    cohort_month: '2026-09', // Fresh cohort: all still in trial
    total_shops: 50,
    active_trial_shops: 50,
    failed_trial_shops: 0,
    converted_shops: 0
  }
];

const analytics = calculateCohortConversion(cohortData);
assert.strictEqual(analytics.length, 3);

// Cohort 2026-07: Mature (no active trials)
assert.strictEqual(analytics[0].mature_conversion_percent, 30.0);
assert.strictEqual(analytics[0].raw_conversion_percent, 30.0);

// Cohort 2026-08: 30 converted out of 60 mature (80 total - 20 active trials) = 50.0%
assert.strictEqual(analytics[1].mature_conversion_percent, 50.0);
assert.strictEqual(analytics[1].raw_conversion_percent, 37.5); // 30 / 80

// Cohort 2026-09: 0 mature (50 total - 50 active trials = 0 denominator)
// Invariant: Must NOT show fake 0%, must return null / 'N/A'
assert.strictEqual(analytics[2].mature_conversion_percent, null);
assert.strictEqual(analytics[2].mature_conversion_display, 'N/A');

// Test 2c: Segment transition detection
const previousSnapshots = [
  { shop_id: 's1', segment: 'HEALTHY' },
  { shop_id: 's2', segment: 'HEALTHY' }
];
const currentPortfolio = [
  { shop_id: 's1', segment: 'AT_RISK', shop_name: 'Shop Alpha' },
  { shop_id: 's2', segment: 'HEALTHY', shop_name: 'Shop Beta' },
  { shop_id: 's3', segment: 'CRITICAL', shop_name: 'Shop Gamma' }
];
const transitions = evaluateSegmentTransitions(previousSnapshots, currentPortfolio);
assert.strictEqual(transitions.length, 2, 'Should detect s1 and s3 transitions to risk segments');
assert.strictEqual(transitions[0].shop_id, 's1');
assert.strictEqual(transitions[0].recommended_playbook, 'AT_RISK');
assert.strictEqual(transitions[1].shop_id, 's3');
assert.strictEqual(transitions[1].recommended_playbook, 'CRITICAL');

// 3. AdminRepository & AdminService Verification
const adminRepo = fs.readFileSync('src/domain/admin/admin.repository.js', 'utf8');
const adminService = fs.readFileSync('src/domain/admin/admin.service.js', 'utf8');

assert.match(adminRepo, /generateRetentionSnapshots/i);
assert.match(adminRepo, /createPlaybookTask/i);
assert.match(adminRepo, /updateRetentionTask/i);
assert.match(adminRepo, /getCohortRetentionAnalytics/i);

assert.match(adminService, /generateRetentionSnapshots/i);
assert.match(adminService, /createPlaybookTask/i);
assert.match(adminService, /updateRetentionTask/i);
assert.match(adminService, /getCohortRetentionAnalytics/i);

// 4. UI Component verification
const retentionUi = fs.readFileSync('src/ui/admin-dashboard/pages/Retention/RetentionCenter.jsx', 'utf8');
assert.match(retentionUi, /Playbook/i, 'UI must feature Playbook tasks');
assert.match(retentionUi, /Cohort/i, 'UI must feature Cohort Analytics');
assert.match(retentionUi, /outcome/i, 'UI must support task outcome handling');
assert.match(retentionUi, /N\/A/i, 'UI must display N/A for immature cohorts');

console.log('All G009 Retention Automation contracts verified successfully.');
