/**
 * Outbox Reliability Engine
 *
 * Implements standardized job lifecycle states, exponential backoff with jitter,
 * dead-letter queue classification, idempotency key deduplication, and atomic
 * worker lease coordination to guarantee zero double-processing.
 */

export const JOB_STATUS = Object.freeze({
  PENDING: 'pending',
  RUNNING: 'running',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  DEAD_LETTER: 'dead_letter'
});

export const QUEUE_TYPES = Object.freeze({
  DRAFT_SYNC: 'draft_sync',
  ORDER_SYNC: 'order_sync',
  TELEGRAM_ALERT: 'telegram_alert',
  WEBHOOK_RETRY: 'webhook_retry',
  RETENTION_NOTIFICATION: 'retention_notification',
  CUSTOM: 'custom'
});

/**
 * Calculates exponential backoff delay with randomized jitter
 * Formula: min(maxDelay, baseDelay * 2^(attempts - 1)) + jitter
 *
 * @param {number} attempts - Current attempt number (1-based)
 * @param {number} baseDelayMs - Base delay in milliseconds (default 1000)
 * @param {number} maxDelayMs - Maximum delay ceiling in milliseconds (default 300000 = 5m)
 * @param {number} jitterRatio - Jitter factor (0 to 1, default 0.2)
 * @returns {number} Backoff delay in milliseconds
 */
export function calculateBackoffWithJitter(attempts, baseDelayMs = 1000, maxDelayMs = 300000, jitterRatio = 0.2) {
  const safeAttempts = Math.max(1, attempts || 1);
  const exponential = baseDelayMs * Math.pow(2, safeAttempts - 1);
  const capped = Math.min(maxDelayMs, exponential);

  if (jitterRatio <= 0) {
    return Math.round(capped);
  }

  const jitter = capped * jitterRatio * Math.random();
  return Math.round(capped + jitter);
}

/**
 * Classifies a job failure into retryable 'failed' or terminal 'dead_letter'
 *
 * @param {number} attempts - Current attempt count
 * @param {number} maxAttempts - Allowed attempts before dead-lettering
 * @param {Error|string} error - The error encountered
 * @returns {{ status: string, retryable: boolean, dead_letter_reason?: string, last_error: string }}
 */
export function classifyJobFailure(attempts, maxAttempts = 5, error = null) {
  const errorMessage = error?.message || (typeof error === 'string' ? error : 'Unknown job execution failure');

  if (attempts >= maxAttempts) {
    return {
      status: JOB_STATUS.DEAD_LETTER,
      retryable: false,
      dead_letter_reason: `Exceeded max attempts (${attempts}/${maxAttempts}): ${errorMessage}`,
      last_error: errorMessage
    };
  }

  return {
    status: JOB_STATUS.FAILED,
    retryable: true,
    last_error: errorMessage
  };
}

/**
 * Deterministic idempotency key generator for deduplicating outbox jobs
 *
 * @param {string} queueType - Target queue name
 * @param {string} entityId - Primary entity identifier (e.g. order_id, transaction_id)
 * @param {string} operation - Operation verb (e.g. 'sync', 'notify', 'retry')
 * @returns {string} Idempotency key
 */
export function createIdempotencyKey(queueType, entityId, operation = '') {
  return `${queueType}:${entityId}${operation ? `:${operation}` : ''}`;
}

/**
 * In-memory Outbox Worker Pool Simulator
 * Models PostgreSQL 'FOR UPDATE SKIP LOCKED' concurrency semantics to verify
 * zero double-processing when multiple workers poll simultaneously.
 */
export class OutboxMemoryWorkerPool {
  constructor() {
    /** @type {Map<string, Object>} */
    this.jobs = new Map();
    /** @type {Map<string, string>} */
    this.idempotencyIndex = new Map();
  }

  /**
   * Enqueues a job with idempotency deduplication
   */
  enqueue({ id, queue_type, idempotency_key, payload = {}, priority = 0, max_attempts = 5 }) {
    if (idempotency_key && this.idempotencyIndex.has(idempotency_key)) {
      const existingId = this.idempotencyIndex.get(idempotency_key);
      return this.jobs.get(existingId);
    }

    const jobId = id || `job_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const job = {
      id: jobId,
      queue_type,
      idempotency_key: idempotency_key || null,
      payload,
      status: JOB_STATUS.PENDING,
      attempts: 0,
      max_attempts,
      priority,
      next_retry_at: Date.now(),
      lease_token: null,
      lease_expires_at: null,
      last_error: null,
      dead_letter_reason: null,
      created_at: Date.now(),
      updated_at: Date.now(),
      processed_at: null
    };

    this.jobs.set(jobId, job);
    if (idempotency_key) {
      this.idempotencyIndex.set(idempotency_key, jobId);
    }

    return job;
  }

  /**
   * Atomically acquires a batch of jobs for a worker (equivalent to SKIP LOCKED)
   *
   * @param {string} workerId - Unique worker identification
   * @param {string} queueType - Optional queue type filter
   * @param {number} batchSize - Maximum jobs to acquire
   * @param {number} leaseDurationMs - Lease validity in milliseconds
   * @returns {Array<Object>} List of locked jobs
   */
  acquireBatch(workerId, queueType = null, batchSize = 1, leaseDurationMs = 60000) {
    const now = Date.now();
    const available = [];

    for (const job of this.jobs.values()) {
      if (queueType && job.queue_type !== queueType) continue;

      const isPending = job.status === JOB_STATUS.PENDING;
      const isRetryableFailed = job.status === JOB_STATUS.FAILED &&
        job.attempts < job.max_attempts &&
        (job.next_retry_at == null || job.next_retry_at <= now);
      const isExpiredLease = job.status === JOB_STATUS.RUNNING &&
        job.lease_expires_at != null && job.lease_expires_at < now;

      if (isPending || isRetryableFailed || isExpiredLease) {
        available.push(job);
      }
    }

    // Sort by priority DESC, created_at ASC
    available.sort((a, b) => (b.priority - a.priority) || (a.created_at - b.created_at));

    const selected = available.slice(0, batchSize);

    // Atomically claim lease on selected jobs
    for (const job of selected) {
      job.status = JOB_STATUS.RUNNING;
      job.lease_token = workerId;
      job.lease_expires_at = now + leaseDurationMs;
      job.attempts += 1;
      job.updated_at = now;
    }

    return selected;
  }

  /**
   * Completes a running job
   */
  completeJob(jobId, leaseToken) {
    const job = this.jobs.get(jobId);
    if (!job || (job.lease_token && job.lease_token !== leaseToken)) {
      return { success: false, message: 'Lease mismatch or job not found' };
    }

    job.status = JOB_STATUS.SUCCEEDED;
    job.lease_token = null;
    job.lease_expires_at = null;
    job.processed_at = Date.now();
    job.updated_at = Date.now();
    return { success: true, job };
  }

  /**
   * Fails a running job, transitioning to dead_letter if max attempts reached
   */
  failJob(jobId, leaseToken, error, delayMs = 30000) {
    const job = this.jobs.get(jobId);
    if (!job || (job.lease_token && job.lease_token !== leaseToken)) {
      return { success: false, message: 'Lease mismatch or job not found' };
    }

    const classification = classifyJobFailure(job.attempts, job.max_attempts, error);
    job.status = classification.status;
    job.last_error = classification.last_error;
    job.dead_letter_reason = classification.dead_letter_reason || null;
    job.lease_token = null;
    job.lease_expires_at = null;
    job.next_retry_at = classification.status === JOB_STATUS.FAILED ? Date.now() + delayMs : null;
    job.updated_at = Date.now();

    return { success: true, job };
  }

  /**
   * Replays dead letter jobs by resetting them back to pending
   */
  replayDeadLetter(queueType = null) {
    let replayedCount = 0;
    const now = Date.now();

    for (const job of this.jobs.values()) {
      if (job.status === JOB_STATUS.DEAD_LETTER) {
        if (!queueType || job.queue_type === queueType) {
          job.status = JOB_STATUS.PENDING;
          job.attempts = 0;
          job.next_retry_at = now;
          job.lease_token = null;
          job.lease_expires_at = null;
          job.dead_letter_reason = null;
          job.last_error = null;
          job.updated_at = now;
          replayedCount++;
        }
      }
    }

    return { success: true, replayed_count: replayedCount };
  }

  /**
   * Gets queue length by queue type
   */
  getQueueLength(queueType) {
    let count = 0;
    for (const job of this.jobs.values()) {
      if (job.queue_type === queueType) count++;
    }
    return count;
  }

  /**
   * Returns aggregated status breakdown
   */
  getMetrics() {
    const summary = {
      total: this.jobs.size,
      pending: 0,
      running: 0,
      succeeded: 0,
      failed: 0,
      dead_letter: 0
    };

    const queues = {};

    for (const job of this.jobs.values()) {
      summary[job.status] = (summary[job.status] || 0) + 1;

      if (!queues[job.queue_type]) {
        queues[job.queue_type] = {
          total: 0,
          pending: 0,
          running: 0,
          succeeded: 0,
          failed: 0,
          dead_letter: 0
        };
      }
      queues[job.queue_type].total += 1;
      queues[job.queue_type][job.status] += 1;
    }

    return { summary, queues };
  }
}
