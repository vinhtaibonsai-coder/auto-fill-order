import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

const read = (relPath) => fs.readFileSync(path.join(rootDir, relPath), 'utf8');

test('G007 - 1. Migration v117 defines standardized job outbox schema, constraints, indices, and admin RPCs', () => {
  const migrationPath = 'database/migrations/v117_standardize_job_outbox_reliability.sql';
  assert.ok(fs.existsSync(path.join(rootDir, migrationPath)), 'Migration v117 must exist');
  const sql = read(migrationPath);

  // Table system_job_outbox
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.system_job_outbox/i);
  assert.match(sql, /queue_type\s+TEXT\s+NOT\s+NULL/i);
  assert.match(sql, /idempotency_key\s+TEXT/i);
  assert.match(sql, /status\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'pending'\s+CHECK\s*\(\s*status\s+IN\s*\(\s*'pending'\s*,\s*'running'\s*,\s*'succeeded'\s*,\s*'failed'\s*,\s*'dead_letter'\s*\)\s*\)/i);
  assert.match(sql, /attempts\s+INT\s+NOT\s+NULL\s+DEFAULT\s+0/i);
  assert.match(sql, /max_attempts\s+INT\s+NOT\s+NULL\s+DEFAULT\s+5/i);
  assert.match(sql, /next_retry_at\s+TIMESTAMPTZ/i);
  assert.match(sql, /lease_token\s+TEXT/i);
  assert.match(sql, /lease_expires_at\s+TIMESTAMPTZ/i);
  assert.match(sql, /dead_letter_reason\s+TEXT/i);

  // Atomic lease acquisition with SKIP LOCKED
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.acquire_outbox_job_lease/i);
  assert.match(sql, /FOR UPDATE SKIP LOCKED/i, 'Must use FOR UPDATE SKIP LOCKED to prevent concurrent worker collision');

  // RPCs
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.complete_outbox_job/i);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.fail_outbox_job/i);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.admin_replay_dead_letter_jobs/i);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.admin_get_outbox_queue_metrics/i);

  // Security & Audit
  assert.match(sql, /public\.is_system_admin\(\)/i, 'Admin actions must be guarded by is_system_admin');
  assert.match(sql, /INSERT INTO public\.audit_logs/i, 'Dead letter replay must record audit log');
  assert.doesNotMatch(sql, /DROP[^\n;]+CASCADE/i, 'Forbidden: DROP ... CASCADE is prohibited');

  // Verify RUN_ALL_MIGRATIONS references v117
  const runAll = read('database/migrations/RUN_ALL_MIGRATIONS.sql');
  assert.match(runAll, /v117_standardize_job_outbox_reliability\.sql/i);
});

test('G007 - 2. Outbox Reliability Engine implements exponential backoff with jitter and dead letter classification', async () => {
  const engineModule = await import('../../src/domain/outbox/outbox-reliability.engine.js');
  const {
    JOB_STATUS,
    QUEUE_TYPES,
    calculateBackoffWithJitter,
    classifyJobFailure
  } = engineModule;

  assert.ok(JOB_STATUS, 'JOB_STATUS must be exported');
  assert.equal(JOB_STATUS.PENDING, 'pending');
  assert.equal(JOB_STATUS.RUNNING, 'running');
  assert.equal(JOB_STATUS.SUCCEEDED, 'succeeded');
  assert.equal(JOB_STATUS.FAILED, 'failed');
  assert.equal(JOB_STATUS.DEAD_LETTER, 'dead_letter');

  assert.ok(QUEUE_TYPES, 'QUEUE_TYPES must be exported');
  assert.ok(QUEUE_TYPES.DRAFT_SYNC, 'draft_sync must be in QUEUE_TYPES');
  assert.ok(QUEUE_TYPES.ORDER_SYNC, 'order_sync must be in QUEUE_TYPES');
  assert.ok(QUEUE_TYPES.TELEGRAM_ALERT, 'telegram_alert must be in QUEUE_TYPES');
  assert.ok(QUEUE_TYPES.WEBHOOK_RETRY, 'webhook_retry must be in QUEUE_TYPES');
  assert.ok(QUEUE_TYPES.RETENTION_NOTIFICATION, 'retention_notification must be in QUEUE_TYPES');

  // Backoff scaling
  const delay1 = calculateBackoffWithJitter(1, 1000, 60000, 0); // attempts=1: 1000ms
  const delay2 = calculateBackoffWithJitter(2, 1000, 60000, 0); // attempts=2: 2000ms
  const delay3 = calculateBackoffWithJitter(3, 1000, 60000, 0); // attempts=3: 4000ms
  assert.equal(delay1, 1000);
  assert.equal(delay2, 2000);
  assert.equal(delay3, 4000);

  // With jitter: delay should be within [base * 2^(att-1), base * 2^(att-1) * (1 + jitter)]
  const jittered = calculateBackoffWithJitter(2, 1000, 60000, 0.25);
  assert.ok(jittered >= 2000 && jittered <= 2500, `Jittered delay ${jittered} must be in [2000, 2500]`);

  // Max delay cap
  const capped = calculateBackoffWithJitter(15, 1000, 10000, 0);
  assert.equal(capped, 10000);

  // Dead letter classification
  const retryable = classifyJobFailure(2, 5, new Error('Network timeout'));
  assert.equal(retryable.status, 'failed');
  assert.ok(retryable.retryable);

  const exceeded = classifyJobFailure(5, 5, new Error('Exceeded attempts'));
  assert.equal(exceeded.status, 'dead_letter');
  assert.equal(exceeded.retryable, false);
  assert.ok(exceeded.dead_letter_reason.includes('Exceeded attempts'));
});

test('G007 - 3. Concurrency Invariant: Two concurrent workers never process the same job', async () => {
  const { OutboxMemoryWorkerPool, JOB_STATUS } = await import('../../src/domain/outbox/outbox-reliability.engine.js');

  const pool = new OutboxMemoryWorkerPool();

  // Enqueue 5 jobs
  for (let i = 1; i <= 5; i++) {
    pool.enqueue({
      id: `job-${i}`,
      queue_type: 'order_sync',
      payload: { order_id: `ord_${i}` }
    });
  }

  // Worker 1 and Worker 2 acquire concurrently
  const worker1Jobs = pool.acquireBatch('worker_alpha', 'order_sync', 3);
  const worker2Jobs = pool.acquireBatch('worker_beta', 'order_sync', 3);

  // Assert worker 1 got 3 jobs, worker 2 got remaining 2 jobs
  assert.equal(worker1Jobs.length, 3, 'Worker 1 should acquire 3 jobs');
  assert.equal(worker2Jobs.length, 2, 'Worker 2 should acquire 2 remaining jobs');

  // Verify ZERO OVERLAP between worker 1 and worker 2
  const ids1 = new Set(worker1Jobs.map(j => j.id));
  const ids2 = new Set(worker2Jobs.map(j => j.id));

  for (const id of ids2) {
    assert.equal(ids1.has(id), false, `Collision detected: job ${id} was acquired by both workers!`);
  }

  // Verify all acquired jobs are in RUNNING state with valid lease
  for (const j of [...worker1Jobs, ...worker2Jobs]) {
    assert.equal(j.status, JOB_STATUS.RUNNING);
    assert.ok(j.lease_token);
    assert.ok(j.lease_expires_at > Date.now());
  }

  // Attempting to acquire again when queue is fully locked yields 0 jobs
  const worker3Jobs = pool.acquireBatch('worker_gamma', 'order_sync', 2);
  assert.equal(worker3Jobs.length, 0, 'No available jobs should be acquired while locked');
});

test('G007 - 4. Idempotency and Deduplication prevents duplicate job enqueueing', async () => {
  const { OutboxMemoryWorkerPool } = await import('../../src/domain/outbox/outbox-reliability.engine.js');

  const pool = new OutboxMemoryWorkerPool();

  const job1 = pool.enqueue({
    queue_type: 'webhook_retry',
    idempotency_key: 'wh_retry:trans_12345:attempt1',
    payload: { transaction_id: 'trans_12345' }
  });
  assert.ok(job1.id);

  // Enqueueing identical idempotency key returns existing job without duplication
  const job2 = pool.enqueue({
    queue_type: 'webhook_retry',
    idempotency_key: 'wh_retry:trans_12345:attempt1',
    payload: { transaction_id: 'trans_12345' }
  });

  assert.equal(job1.id, job2.id, 'Duplicate idempotency key must return existing job');
  assert.equal(pool.getQueueLength('webhook_retry'), 1, 'Queue must contain exactly 1 job');
});

test('G007 - 5. Admin Service, Repository, and SystemHealth UI incorporate Outbox Reliability and Dead Letter Replay', () => {
  const repo = read('src/domain/admin/admin.repository.js');
  const service = read('src/domain/admin/admin.service.js');
  const ui = read('src/ui/admin-dashboard/pages/SystemHealth/SystemHealth.jsx');

  // Repository & Service methods
  assert.match(repo, /getOutboxMetrics\s*\(/, 'AdminRepository must implement getOutboxMetrics');
  assert.match(repo, /replayDeadLetterJobs\s*\(/, 'AdminRepository must implement replayDeadLetterJobs');
  assert.match(service, /getOutboxMetrics\s*\(/, 'AdminService must implement getOutboxMetrics');
  assert.match(service, /replayDeadLetterJobs\s*\(/, 'AdminService must implement replayDeadLetterJobs');

  // UI components in SystemHealth
  assert.match(ui, /Hàng Đợi Outbox & Job/i, 'SystemHealth must contain Outbox & Job heading');
  assert.match(ui, /handleReplayDeadLetter/i, 'SystemHealth must provide replay dead letter handler');
  assert.match(ui, /dead_letter/i, 'SystemHealth must handle dead_letter status');
  assert.match(ui, /draft_sync|telegram_alert|webhook_retry/i, 'SystemHealth must reference queue types');
});
