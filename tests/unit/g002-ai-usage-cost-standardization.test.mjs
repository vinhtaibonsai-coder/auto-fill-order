import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

test('1. Migration v113 defines schema unification, token sync trigger, rates, and analytics RPC', () => {
  const v113Path = path.join(root, 'database', 'migrations', 'v113_standardize_ai_usage_and_cost.sql');
  assert.ok(fs.existsSync(v113Path), 'v113_standardize_ai_usage_and_cost.sql must exist');
  const sql = read('database/migrations/v113_standardize_ai_usage_and_cost.sql');

  // Unified columns on ai_usage_log
  assert.match(sql, /ALTER TABLE public\.ai_usage_log ADD COLUMN IF NOT EXISTS provider TEXT/, 'Must add provider column');
  assert.match(sql, /ALTER TABLE public\.ai_usage_log ADD COLUMN IF NOT EXISTS latency_ms INT/, 'Must add latency_ms column');
  assert.match(sql, /ALTER TABLE public\.ai_usage_log ADD COLUMN IF NOT EXISTS input_tokens INT/, 'Must add input_tokens column');
  assert.match(sql, /ALTER TABLE public\.ai_usage_log ADD COLUMN IF NOT EXISTS output_tokens INT/, 'Must add output_tokens column');
  assert.match(sql, /ALTER TABLE public\.ai_usage_log ADD COLUMN IF NOT EXISTS total_tokens INT/, 'Must add total_tokens column');
  assert.match(sql, /ALTER TABLE public\.ai_usage_log ADD COLUMN IF NOT EXISTS estimated_cost NUMERIC/, 'Must add estimated_cost column');
  assert.match(sql, /ALTER TABLE public\.ai_usage_log ADD COLUMN IF NOT EXISTS currency TEXT/, 'Must add currency column');

  // Trigger synchronization between legacy prompt/completion tokens and unified input/output tokens
  assert.match(sql, /tr_sync_ai_usage_log_tokens/, 'Must define trigger function to sync tokens');
  assert.match(sql, /tr_ai_usage_log_tokens_sync/, 'Must bind trigger to ai_usage_log');

  // Seeding baseline rates in ai_model_cost_rates for all major providers
  assert.match(sql, /gemini-3\.6-flash/, 'Must seed Gemini rates');
  assert.match(sql, /llama-3\.3-70b-versatile/, 'Must seed Groq rates');
  assert.match(sql, /gpt-4o-mini/, 'Must seed OpenAI rates');
  assert.match(sql, /grok-beta/, 'Must seed Grok rates');

  // RPC for AI Cost analytics
  assert.match(sql, /admin_get_ai_cost_analytics/, 'Must provide admin_get_ai_cost_analytics RPC');
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.admin_get_ai_cost_analytics/, 'Must grant execute on admin_get_ai_cost_analytics');

  // Run all migrations check
  const runAll = read('database/migrations/RUN_ALL_MIGRATIONS.sql');
  assert.match(runAll, /v113_standardize_ai_usage_and_cost\.sql/, 'RUN_ALL_MIGRATIONS must reference v113');
});

test('2. AI Cost Calculation Engine calculates exact costs across all providers and returns N/A for unrated models', async () => {
  const { calculateAiCost, calculateTotalAiCost } = await import('../../src/domain/admin/ai-cost.engine.js');

  const sampleRates = {
    'gemini-3.6-flash': { input_cost_per_million: 2500, output_cost_per_million: 10000, currency: 'VND' },
    'llama-3.3-70b-versatile': { input_cost_per_million: 14750, output_cost_per_million: 19750, currency: 'VND' },
    'gpt-4o-mini': { input_cost_per_million: 3750, output_cost_per_million: 15000, currency: 'VND' },
    'grok-beta': { input_cost_per_million: 125000, output_cost_per_million: 375000, currency: 'VND' }
  };

  // Gemini calculation: 1000 input tokens, 500 output tokens
  // Cost = (1000 / 1e6 * 2500) + (500 / 1e6 * 10000) = 2.5 + 5.0 = 7.5 VND
  const geminiCost = calculateAiCost({
    model: 'gemini-3.6-flash',
    inputTokens: 1000,
    outputTokens: 500,
    status: 'success',
    ratesMap: sampleRates
  });
  assert.equal(geminiCost.hasRate, true);
  assert.equal(geminiCost.cost, 7.5);
  assert.match(geminiCost.costDisplay, /7\.5|8/);

  // Groq calculation: 2000 input, 1000 output
  // Cost = (2000 / 1e6 * 14750) + (1000 / 1e6 * 19750) = 29.5 + 19.75 = 49.25 VND
  const groqCost = calculateAiCost({
    model: 'llama-3.3-70b-versatile',
    inputTokens: 2000,
    outputTokens: 1000,
    status: 'success',
    ratesMap: sampleRates
  });
  assert.equal(groqCost.hasRate, true);
  assert.equal(groqCost.cost, 49.25);

  // OpenAI calculation: 4000 input, 1000 output
  // Cost = (4000 / 1e6 * 3750) + (1000 / 1e6 * 15000) = 15 + 15 = 30 VND
  const openaiCost = calculateAiCost({
    model: 'gpt-4o-mini',
    inputTokens: 4000,
    outputTokens: 1000,
    status: 'success',
    ratesMap: sampleRates
  });
  assert.equal(openaiCost.hasRate, true);
  assert.equal(openaiCost.cost, 30);

  // Grok calculation: 1000 input, 200 output
  // Cost = (1000 / 1e6 * 125000) + (200 / 1e6 * 375000) = 125 + 75 = 200 VND
  const grokCost = calculateAiCost({
    model: 'grok-beta',
    inputTokens: 1000,
    outputTokens: 200,
    status: 'success',
    ratesMap: sampleRates
  });
  assert.equal(grokCost.hasRate, true);
  assert.equal(grokCost.cost, 200);

  // Unrated model check: MUST return cost: null and costDisplay: 'N/A', NOT 0!
  const unratedCost = calculateAiCost({
    model: 'custom-fine-tuned-model',
    inputTokens: 5000,
    outputTokens: 2000,
    status: 'success',
    ratesMap: sampleRates
  });
  assert.equal(unratedCost.hasRate, false);
  assert.equal(unratedCost.cost, null);
  assert.equal(unratedCost.costDisplay, 'N/A');

  // Error request with 0 tokens: Cost is 0 VND (not null if model rate exists)
  const errorCost = calculateAiCost({
    model: 'gemini-3.6-flash',
    inputTokens: 0,
    outputTokens: 0,
    status: 'error',
    ratesMap: sampleRates
  });
  assert.equal(errorCost.hasRate, true);
  assert.equal(errorCost.cost, 0);

  // Total calculation over mixed batch
  const logs = [
    { model: 'gemini-3.6-flash', input_tokens: 1000, output_tokens: 500, status: 'success' }, // 7.5
    { model: 'gpt-4o-mini', input_tokens: 4000, output_tokens: 1000, status: 'success' },      // 30
    { model: 'custom-model', input_tokens: 5000, output_tokens: 2000, status: 'success' }     // N/A
  ];
  const total = calculateTotalAiCost(logs, sampleRates);
  assert.equal(total.totalCost, 37.5);
  assert.equal(total.ratedCount, 2);
  assert.equal(total.unratedCount, 1);
  assert.equal(total.hasUnrated, true);
});

test('3. Data truth invariant: AI usage is never inferred from order count', () => {
  const repository = read('src/domain/admin/admin.repository.js');
  const service = read('src/domain/admin/admin.service.js');

  assert.doesNotMatch(repository, /aiRequestsToday\s*=\s*ordersToday/, 'AI requests must never be inferred from order count');
  assert.doesNotMatch(repository, /ai_tokens\s*=\s*.*order_count/, 'AI tokens must never be inferred from order count');
  assert.doesNotMatch(service, /aiRequestsToday\s*=\s*ordersToday/, 'AI requests must never be inferred from order count in service');
});

test('4. Admin Repository and Service expose getAiCostAnalytics and getAiModelCostRates', () => {
  const repo = read('src/domain/admin/admin.repository.js');
  const serv = read('src/domain/admin/admin.service.js');

  assert.match(repo, /getAiModelCostRates/, 'AdminRepository must provide getAiModelCostRates');
  assert.match(repo, /getAiCostAnalytics/, 'AdminRepository must provide getAiCostAnalytics');
  assert.match(serv, /getAiModelCostRates/, 'AdminService must provide getAiModelCostRates');
  assert.match(serv, /getAiCostAnalytics/, 'AdminService must provide getAiCostAnalytics');
});

test('5. Quotas.jsx displays model cost rates and unrated N/A badges', () => {
  const quotas = read('src/ui/admin-dashboard/pages/AIPlatform/Quotas.jsx');

  assert.match(quotas, /ai_model_cost_rates|costRates|getAiModelCostRates/, 'Quotas.jsx must load or handle cost rates');
  assert.match(quotas, /Giá Vốn|Đơn Giá|Chi Phí/i, 'Quotas.jsx must display cost rate header');
  assert.match(quotas, /N\/A/, 'Quotas.jsx must render N/A for unrated models');
});
