import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

test('Perf Telemetry Hygiene: service-worker metrics must never log or serialize PII fields', () => {
  const swCode = readFileSync(resolve('src/runtime/service-worker/service-worker.js'), 'utf8');

  // Verify metrics object definition exists
  assert.ok(swCode.includes('metrics: {'), 'metrics object must exist in service worker');

  // Assert allowed metrics are present
  assert.ok(swCode.includes('gatewayMs') && swCode.includes('totalMs') && swCode.includes('cacheHit'));

  // Extract all metrics blocks from service worker
  const metricsMatches = swCode.match(/metrics:\s*\{[\s\S]*?\}/g) || [];
  assert.ok(metricsMatches.length >= 2, 'Should have multiple metrics blocks (cache hit & AI gateway)');

  for (const block of metricsMatches) {
    assert.equal(block.includes('name:'), false, 'Metrics must NOT contain customer name');
    assert.equal(block.includes('phone:'), false, 'Metrics must NOT contain customer phone');
    assert.equal(block.includes('address:'), false, 'Metrics must NOT contain customer address');
    assert.equal(block.includes('rawText:'), false, 'Metrics must NOT contain rawText');
    assert.equal(block.includes('token:'), false, 'Metrics must NOT contain auth token');
  }
});

test('AISettings: provides Diagnostic / Perf Telemetry toggle with safe non-PII description', () => {
  const settingsCode = readFileSync(resolve('src/ui/options/pages/AISettings/AISettings.jsx'), 'utf8');

  assert.ok(settingsCode.includes('enablePerfTelemetry'));
  assert.ok(settingsCode.includes('enable_perf_telemetry'));
  assert.ok(settingsCode.includes('Không PII'));
});
