import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

const read = (relPath) => fs.readFileSync(path.join(rootDir, relPath), 'utf8');

test('G006 - 1. Migration v116 defines error_class, cache_hit, and provider resilience analytics RPC', () => {
  const migrationPath = 'database/migrations/v116_provider_resilience_and_analytics.sql';
  assert.ok(fs.existsSync(path.join(rootDir, migrationPath)), 'Migration v116 must exist');
  const sql = read(migrationPath);

  // Schema enhancements
  assert.match(sql, /ALTER TABLE public\.ai_usage_log ADD COLUMN IF NOT EXISTS error_class TEXT/i);
  assert.match(sql, /ALTER TABLE public\.ai_usage_log ADD COLUMN IF NOT EXISTS cache_hit BOOLEAN/i);
  assert.match(sql, /CREATE INDEX IF NOT EXISTS idx_ai_usage_provider_status/i);

  // Analytics RPC
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.admin_get_provider_resilience_analytics/i);
  assert.match(sql, /percentile_cont\s*\(\s*0\.50\s*\)/i, 'Must calculate p50 latency');
  assert.match(sql, /percentile_cont\s*\(\s*0\.95\s*\)/i, 'Must calculate p95 latency');
  assert.match(sql, /public\.is_system_admin\(\)/i, 'Must enforce system admin authorization');
  assert.doesNotMatch(sql, /DROP[^\n;]+CASCADE/i, 'Forbidden: DROP ... CASCADE is prohibited');

  // Verify RUN_ALL_MIGRATIONS references v116
  const runAll = read('database/migrations/RUN_ALL_MIGRATIONS.sql');
  assert.match(runAll, /v116_provider_resilience_and_analytics\.sql/i);
});

test('G006 - 2. Provider Resilience Engine: error classification, finite retry, and exponential backoff with jitter', async () => {
  const {
    classifyError,
    shouldRetry,
    calculateBackoffWithJitter,
    ERROR_CLASSES
  } = await import('../../src/domain/ai/provider-resilience.engine.js');

  // 1. Classification
  assert.equal(classifyError(429), ERROR_CLASSES.RATE_LIMITED);
  assert.equal(classifyError(503), ERROR_CLASSES.UNAVAILABLE);
  assert.equal(classifyError(502), ERROR_CLASSES.UNAVAILABLE);
  assert.equal(classifyError(504), ERROR_CLASSES.UNAVAILABLE);
  assert.equal(classifyError(408), ERROR_CLASSES.TIMEOUT);
  assert.equal(classifyError(null, 'AbortError: The user aborted a request'), ERROR_CLASSES.TIMEOUT);
  assert.equal(classifyError(401), ERROR_CLASSES.INVALID_AUTH);
  assert.equal(classifyError(403), ERROR_CLASSES.INVALID_AUTH);
  assert.equal(classifyError(400), ERROR_CLASSES.INVALID_REQUEST);
  assert.equal(classifyError(500), ERROR_CLASSES.SERVER_ERROR);

  // 2. Retry rules: 429/503 retry hữu hạn; 400/401 không retry mù
  assert.equal(shouldRetry(429), true, '429 must be retryable');
  assert.equal(shouldRetry(503), true, '503 must be retryable');
  assert.equal(shouldRetry(502), true, '502 must be retryable');
  assert.equal(shouldRetry(504), true, '504 must be retryable');
  assert.equal(shouldRetry(408), true, '408 timeout must be retryable');

  assert.equal(shouldRetry(400), false, '400 invalid request must NEVER retry blind');
  assert.equal(shouldRetry(401), false, '401 invalid auth must NEVER retry blind');
  assert.equal(shouldRetry(403), false, '403 forbidden must NEVER retry blind');
  assert.equal(shouldRetry(404), false, '404 not found must NEVER retry blind');

  // 3. Exponential backoff with jitter
  const delay0 = calculateBackoffWithJitter(0, 300, 2000);
  const delay1 = calculateBackoffWithJitter(1, 300, 2000);
  const delay2 = calculateBackoffWithJitter(2, 300, 2000);
  const delayCapped = calculateBackoffWithJitter(10, 300, 2000);

  assert.ok(delay0 >= 300 && delay0 <= 500, `delay0 ${delay0} must include base + jitter`);
  assert.ok(delay1 >= 600, `delay1 ${delay1} must scale exponentially`);
  assert.ok(delay2 >= 1200, `delay2 ${delay2} must scale exponentially`);
  assert.ok(delayCapped <= 2200, `delayCapped ${delayCapped} must respect maximum cap`);

  // Jitter verification: multiple calls on same attempt must not produce identical numbers
  const samples = new Set();
  for (let i = 0; i < 5; i++) {
    samples.add(calculateBackoffWithJitter(1, 300, 2000));
  }
  assert.ok(samples.size > 1, 'Backoff must include randomized jitter');
});

test('G006 - 3. Unified Circuit Breaker: manages states (CLOSED, OPEN, HALF-OPEN) per provider', async () => {
  const { ProviderCircuitBreaker } = await import('../../src/domain/ai/provider-resilience.engine.js');

  const cb = new ProviderCircuitBreaker({ failureThreshold: 2, cooldownMs: 100 });

  // Initially CLOSED
  assert.equal(cb.isOpen('gemini'), false, 'Initial state must be CLOSED');
  assert.equal(cb.isOpen('groq'), false, 'Initial state must be CLOSED');

  // 1st failure on Gemini: still CLOSED
  cb.recordFailure('gemini', 503);
  assert.equal(cb.isOpen('gemini'), false, '1st failure must keep breaker CLOSED');

  // 2nd failure on Gemini: transitions to OPEN
  cb.recordFailure('gemini', 503);
  assert.equal(cb.isOpen('gemini'), true, '2 consecutive failures must OPEN breaker');

  // Groq must remain CLOSED (independent isolation)
  assert.equal(cb.isOpen('groq'), false, 'Other providers must remain CLOSED');

  // Wait for cooldown to test HALF-OPEN
  await new Promise(r => setTimeout(r, 120));
  assert.equal(cb.isOpen('gemini'), false, 'After cooldown, breaker enters HALF-OPEN (allowing probe)');

  // Successful probe resets breaker to CLOSED
  cb.recordSuccess('gemini');
  assert.equal(cb.isOpen('gemini'), false, 'Successful call must reset breaker to CLOSED');
});

test('G006 - 4. Cross-Provider Fallback Chain: handles 429, 503, timeout, invalid key and recovery', async () => {
  const { executeWithFallbackChain } = await import('../../src/domain/ai/provider-resilience.engine.js');

  // Case A: Gemini 429 rate limit -> retries finite -> falls back cleanly to Groq
  const callLogA = [];
  const mockProvidersA = [
    {
      provider: 'gemini',
      model: 'gemini-3.6-flash',
      call: async () => {
        callLogA.push('gemini_call');
        return { ok: false, status: 429, errorBody: 'Resource has been exhausted (rate limit)' };
      }
    },
    {
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
      call: async () => {
        callLogA.push('groq_call');
        return { ok: true, status: 200, data: { name: 'Customer A', phone: '0901234567' } };
      }
    }
  ];

  const resultA = await executeWithFallbackChain(mockProvidersA, { maxRetriesPerProvider: 1 });
  assert.equal(resultA.success, true);
  assert.equal(resultA.provider, 'groq');
  assert.equal(resultA.usedFallback, true);
  assert.equal(resultA.data.name, 'Customer A');
  assert.ok(callLogA.includes('gemini_call') && callLogA.includes('groq_call'));

  // Case B: Gemini 401 invalid key -> does NOT retry blind -> immediately advances to Grok
  const callLogB = [];
  const mockProvidersB = [
    {
      provider: 'gemini',
      model: 'gemini-3.6-flash',
      call: async () => {
        callLogB.push('gemini_invalid_key');
        return { ok: false, status: 401, errorBody: 'API key not valid' };
      }
    },
    {
      provider: 'grok',
      model: 'grok-beta',
      call: async () => {
        callLogB.push('grok_call');
        return { ok: true, status: 200, data: { name: 'Customer B', phone: '0988776655' } };
      }
    }
  ];

  const resultB = await executeWithFallbackChain(mockProvidersB, { maxRetriesPerProvider: 2 });
  assert.equal(resultB.success, true);
  assert.equal(resultB.provider, 'grok');
  assert.equal(callLogB.filter(c => c === 'gemini_invalid_key').length, 1, '401 must NOT retry blind');

  // Case C: Timeout handling
  const mockProvidersC = [
    {
      provider: 'gemini',
      model: 'gemini-3.6-flash',
      call: async () => {
        const err = new Error('The operation was aborted');
        err.name = 'AbortError';
        throw err;
      }
    },
    {
      provider: 'openai',
      model: 'gpt-4o-mini',
      call: async () => {
        return { ok: true, status: 200, data: { name: 'Customer C' } };
      }
    }
  ];

  const resultC = await executeWithFallbackChain(mockProvidersC, { maxRetriesPerProvider: 1 });
  assert.equal(resultC.success, true);
  assert.equal(resultC.provider, 'openai');
  assert.equal(resultC.usedFallback, true);
});

test('G006 - 5. Provider Resilience Analytics & UI Quotas integration', async () => {
  const { calculateProviderAnalytics } = await import('../../src/domain/ai/provider-resilience.engine.js');
  const repo = read('src/domain/admin/admin.repository.js');
  const service = read('src/domain/admin/admin.service.js');
  const ui = read('src/ui/admin-dashboard/pages/AIPlatform/Quotas.jsx');

  // 1. Math calculation for metrics: success rate, p50/p95 latency, error classes, cost
  const mockLogs = [
    { provider: 'groq', latency_ms: 200, status: 'success', estimated_cost: 15, error_class: null },
    { provider: 'groq', latency_ms: 300, status: 'success', estimated_cost: 15, error_class: null },
    { provider: 'groq', latency_ms: 400, status: 'success', estimated_cost: 15, error_class: null },
    { provider: 'groq', latency_ms: 800, status: 'error', estimated_cost: 0, error_class: 'RATE_LIMITED' },
    { provider: 'gemini', latency_ms: 1000, status: 'success', estimated_cost: 25, error_class: null },
    { provider: 'gemini', latency_ms: 2500, status: 'error', estimated_cost: 0, error_class: 'UNAVAILABLE' }
  ];

  const analytics = calculateProviderAnalytics(mockLogs);
  assert.ok(analytics.by_provider.groq, 'Must calculate analytics for groq');
  assert.ok(analytics.by_provider.gemini, 'Must calculate analytics for gemini');

  const groqStats = analytics.by_provider.groq;
  assert.equal(groqStats.total_requests, 4);
  assert.equal(groqStats.success_requests, 3);
  assert.equal(groqStats.failed_requests, 1);
  assert.equal(groqStats.success_rate, 75); // 3/4 = 75%
  assert.ok(groqStats.p50_latency_ms >= 250 && groqStats.p50_latency_ms <= 350, 'p50 latency calculation');
  assert.ok(groqStats.p95_latency_ms >= 700, 'p95 latency calculation');
  assert.equal(groqStats.error_classes.RATE_LIMITED, 1);
  assert.equal(groqStats.total_cost, 45);

  // 2. Repository & Service expose getProviderResilienceAnalytics
  assert.match(repo, /getProviderResilienceAnalytics\s*\(/, 'AdminRepository must implement getProviderResilienceAnalytics');
  assert.match(service, /getProviderResilienceAnalytics\s*\(/, 'AdminService must implement getProviderResilienceAnalytics');

  // 3. UI integration in Quotas.jsx
  assert.match(ui, /Độ Phục Hồi & SLA Nhà Cung Cấp|Provider Resilience/i, 'Quotas.jsx must show Provider Resilience section');
  assert.match(ui, /p50|p95|Độ trễ/i, 'Quotas.jsx must display p50/p95 latency');
  assert.match(ui, /Tỷ Lệ Thành Công|Success Rate/i, 'Quotas.jsx must display success rate');
  assert.match(ui, /Phân Lớp Lỗi|Error Class/i, 'Quotas.jsx must display error class breakdown');
});
