import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ERROR_CODES, toUserSafeError } from '../../src/application/error-codes.js';
import { processImageToOrder } from '../../src/application/ai/vision-pipeline.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');
const readSource = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), 'utf8');

test('1. AI Gateway Edge Function has backoff, circuit breaker, and sanitized fallback', () => {
  const code = readSource('supabase/functions/ai-gateway/index.ts');

  // Verify backoff + jitter helper
  assert.match(code, /function getBackoffWithJitter/, 'Must define getBackoffWithJitter');
  assert.match(code, /Math\.pow\(2,\s*attempt\)/, 'Must use exponential backoff');
  assert.match(code, /Math\.random\(\)/, 'Must include jitter');

  // Verify Circuit Breaker implementation
  assert.match(code, /geminiCircuitBreaker\s*=\s*\{/, 'Must define geminiCircuitBreaker');
  assert.match(code, /failureThreshold:\s*2/, 'Threshold must be 2 consecutive failures');
  assert.match(code, /cooldownMs:\s*60000/, 'Cooldown must be at least 60s');
  assert.match(code, /isOpen\(\)/, 'Must have isOpen method');
  assert.match(code, /recordSuccess\(\)/, 'Must have recordSuccess method');
  assert.match(code, /recordFailure\(status/, 'Must have recordFailure method');

  // Verify Circuit Breaker gating before calling Gemini
  assert.match(code, /!isGeminiOpen\s*&&\s*visionGeminiKeys\.length/, 'Must check circuit breaker before Gemini Vision');
  assert.match(code, /geminiCircuitBreaker\.isOpen\(\)/, 'Must check circuit breaker before executeGemini');

  // Verify retry loop with backoff on 429/503/5xx
  assert.match(code, /status\s*===\s*429\s*\|\|\s*status\s*===\s*503\s*\|\|\s*\(status\s*>=\s*500\s*&&\s*status\s*<\s*600\)/, 'Must retry on 429, 503, and 5xx');
  assert.match(code, /getBackoffWithJitter\(attempt\)/, 'Must apply backoff delay between retries');

  // Verify Groq Vision fallback
  assert.match(code, /llama-3\.2-11b-vision-preview/, 'Must support Groq Vision fallback');

  // Verify sanitized message without leaking raw provider JSON
  assert.match(code, /AI đang quá tải, hệ thống đã dùng kết quả local\/fallback để bạn kiểm tra\./, 'Must return polite sanitized message on all failures');
  assert.doesNotMatch(code, /message:\s*errBody/, 'Must never leak raw errBody into user message');
});

test('2. Error codes & Service Worker sanitize AI provider errors without raw JSON leakage', () => {
  const errorCodesSource = readSource('src/application/error-codes.js');
  const swSource = readSource('src/runtime/service-worker/service-worker.js');

  const expectedMsg = 'AI đang quá tải, hệ thống đã dùng kết quả local/fallback để bạn kiểm tra.';
  assert.equal(toUserSafeError({ code: ERROR_CODES.AI_PROVIDER_UNAVAILABLE }).message, expectedMsg);
  assert.equal(toUserSafeError({ code: ERROR_CODES.AI_UPSTREAM_ERROR }).message, expectedMsg);
  assert.equal(toUserSafeError({ code: ERROR_CODES.AI_TIMEOUT }).message, expectedMsg);

  // Service worker must NOT concatenate (${errData.message}) into user-facing safe error
  assert.doesNotMatch(swSource, /\$\{safeError\.message\}\s*\(\$\{errData\.message\}\)/, 'Service worker must not leak raw provider error to user');
  assert.match(swSource, /const error = new Error\(safeError\.message\);/, 'Service worker error must only contain safe error message');
});

test('3. Mock Gemini 503: Vision pipeline degrades gracefully to OCR/local parser without failing blank', async () => {
  // Mock chrome runtime to simulate Gemini 503 UNAVAILABLE
  const originalChrome = globalThis.chrome;
  globalThis.chrome = {
    runtime: {
      lastError: null,
      sendMessage: (msg, callback) => {
        if (msg.action === 'runVisionOcr') {
          // Google Vision OCR returns recognized text under result
          callback({
            ok: true,
            result: {
              fullTextAnnotation: {
                text: 'Nguyễn Văn An\n0987654321\n123 Lê Lợi, Phường Bến Nghé, Quận 1, TP Hồ Chí Minh\nCOD: 150.000đ'
              }
            }
          });
        } else if (msg.action === 'runGeminiVision') {
          // Simulate Gemini 503 HTTP error from AI Gateway
          callback({
            ok: false,
            code: 'AI_PROVIDER_UNAVAILABLE',
            error: 'AI đang quá tải, hệ thống đã dùng kết quả local/fallback để bạn kiểm tra.'
          });
        } else {
          callback({ ok: true });
        }
      }
    }
  };

  try {
    const fakeImageBase64 = 'data:image/jpeg;base64,' + Buffer.from('fake_image_bytes').toString('base64');
    const result = await processImageToOrder(fakeImageBase64, {
      threshold: 0.99 // Force bad branch to trigger Gemini Vision
    });

    assert.equal(result.success, true, 'Pipeline must succeed via fallback');
    assert.equal(result.branch, 'FALLBACK_OCR', 'Must fallback to OCR text when Gemini fails');
    assert.match(result.warning, /AI đang quá tải/, 'Must provide polite warning message');
    assert.ok(result.orderData, 'Must parse orderData from OCR text');
    assert.equal(result.orderData.phone, '0987654321');
    assert.match(result.orderData.name, /Nguyễn Văn An/);
  } finally {
    globalThis.chrome = originalChrome;
  }
});

test('4. Mock Gemini 503 + No OCR text: Pipeline returns safe fallback instead of throwing white screen error', async () => {
  const originalChrome = globalThis.chrome;
  globalThis.chrome = {
    runtime: {
      lastError: null,
      sendMessage: (msg, callback) => {
        if (msg.action === 'runVisionOcr') {
          // OCR failed or returned empty text
          callback({ ok: false, error: 'OCR empty' });
        } else if (msg.action === 'runGeminiVision') {
          // Gemini returns 503
          callback({
            ok: false,
            code: 'AI_PROVIDER_UNAVAILABLE',
            error: 'AI đang quá tải, hệ thống đã dùng kết quả local/fallback để bạn kiểm tra.'
          });
        } else {
          callback({ ok: true });
        }
      }
    }
  };

  try {
    const fakeImageBase64 = 'data:image/jpeg;base64,' + Buffer.from('fake_empty_image').toString('base64');
    const result = await processImageToOrder(fakeImageBase64, { threshold: 0.8 });

    assert.equal(result.success, true, 'Must not throw, must return success: true with safe schema');
    assert.equal(result.branch, 'FALLBACK_LOCAL_EMPTY');
    assert.match(result.warning, /AI đang quá tải/);
    assert.ok(result.orderData, 'Must provide safe empty orderData schema');
    assert.equal(typeof result.orderData.name, 'string');
    assert.equal(typeof result.orderData.phone, 'string');
  } finally {
    globalThis.chrome = originalChrome;
  }
});
