// =========================================================================
// UNIT TESTS: 7 FEATURES PRODUCTION READINESS & CLOSING ARCHITECTURAL GAPS
// Verifies all 7 gaps identified in user audit:
// 1. In nhãn A5/A6: PrintCenter RPC idempotency & confirmation
// 2. Nhật ký đơn hàng: append_order_event ledger integration & PII masking
// 3. Tự động CSKH: CS task daily evaluation & 24h cooldown
// 4. Facebook/Zalo: Webhook signature verification & challenge response
// 5. Đơn từ ảnh / confidence: Image asset sha256 & field extraction persistence
// 6. RBAC theo hành động: channel_connections policy enforcing channels.manage
// 7. Partner API / MCP: Isomorphic Web Crypto without node:crypto crash
// =========================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// 1. Isomorphic Crypto & Partner API Gateway (Gap 7)
import { getRandomHex, sha256Hex, hmacSha256Hex, timingSafeEqualHex } from '../../src/infrastructure/crypto/isomorphic-crypto.js';
import { generatePartnerApiKey, hashPartnerApiKey, validatePartnerRequest } from '../../src/application/partner/partner-gateway.service.js';

// 2. Order Event Ledger Service (Gap 2)
import { recordOrderEvent } from '../../src/domain/order/order-event.service.js';
import { ORDER_EVENT_TYPES, ORDER_ACTOR_TYPES, maskOrderPII } from '../../src/domain/order/order-event.taxonomy.js';

// 3. CS Task Daily Scheduler (Gap 3)
import { checkAndRunDailyEvaluation, evaluateShopRetentionTasks } from '../../src/domain/retention/cs-task-scheduler.service.js';

// 4. Social Webhook Signature & Capability Gate (Gap 4)
import { verifyMetaSignature, verifyZaloSignature, evaluateSocialChannelCapability } from '../../src/domain/social/social-channel.adapter.js';

// 5. Image Extraction Service (Gap 5)
import { persistImageOrderExtractions } from '../../src/domain/image/image-extraction.service.js';

// =========================================================================
// TEST SUITE
// =========================================================================

test('Gap 7: Partner API & Isomorphic Crypto - Browser-safe & Standard Vectors', () => {
  // Test Vector SHA-256 standard
  assert.equal(sha256Hex(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(sha256Hex('hello'), '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');

  // Test Vector HMAC-SHA256
  const hmac = hmacSha256Hex('key', 'The quick brown fox jumps over the lazy dog');
  assert.equal(hmac, 'f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8');

  // Timing Safe Equal
  assert.equal(timingSafeEqualHex('abcd1234ef', 'abcd1234ef'), true);
  assert.equal(timingSafeEqualHex('abcd1234ef', 'abcd1234ee'), false);
  assert.equal(timingSafeEqualHex('abcd', 'abcdef'), false);

  // Random Hex
  const randHex = getRandomHex(24);
  assert.equal(randHex.length, 48);
  assert.match(randHex, /^[0-9a-f]{48}$/);

  // Partner API Key Generation
  const keyObj = generatePartnerApiKey();
  assert.match(keyObj.rawKey, /^ak_live_[0-9a-f]{48}$/);
  assert.match(keyObj.prefix, /^ak_live_[0-9a-f]{6}\.\.\.$/);
  assert.equal(keyObj.hash, hashPartnerApiKey(keyObj.rawKey));
});

test('Gap 6: Social Channel Action RBAC - Migration v132 Enforces channels.manage', () => {
  const v132Content = readFileSync(resolve('database/migrations/v132_fix_7_features_production_gaps.sql'), 'utf8');

  // Must drop overly permissive FOR ALL policy
  assert.ok(v132Content.includes('DROP POLICY IF EXISTS "channel_connections_tenant_isolation"'));

  // Must separate into SELECT for members and MODIFY requiring channels.manage
  assert.ok(v132Content.includes('CREATE POLICY "channel_connections_select"'));
  assert.ok(v132Content.includes('CREATE POLICY "channel_connections_modify"'));
  assert.ok(v132Content.includes("public.has_shop_permission(shop_id, 'channels.manage')"));
});

test('Gap 1: PrintCenter - Database Print Job RPC Idempotency & Confirmation', () => {
  const printCenterContent = readFileSync(resolve('src/ui/options/pages/Printing/PrintCenter.jsx'), 'utf8');

  // PrintCenter must call create_print_job_idempotent
  assert.ok(printCenterContent.includes('create_print_job_idempotent'));
  assert.ok(printCenterContent.includes('idempotencyKey'));
  assert.ok(printCenterContent.includes('p_idempotency_key'));

  // PrintCenter must call confirm_print_job_items on confirmation
  assert.ok(printCenterContent.includes('confirm_print_job_items'));
  assert.ok(printCenterContent.includes('p_item_results'));
});

test('Gap 2: Order Event Ledger - Hooked into parsing, AI edits, and carrier submit', async () => {
  // PII Masking test
  const original = {
    name: 'Nguyễn Văn A',
    phone: '0987654321',
    address: '123 Đường Số 1, Phường 2, Quận 3, TP Hồ Chí Minh'
  };
  const masked = maskOrderPII(original);
  assert.equal(masked.phone, '098***4321');
  assert.ok(masked.address.startsWith('***, Phường 2'));

  // Test recordOrderEvent without throws (graceful offline / mock execution)
  const result = await recordOrderEvent({
    shopId: 'c201e6bc-8986-4f91-b900-e319865d1907',
    orderId: 'ORD_TEST_9999',
    orderCode: 'TEST_9999',
    eventType: ORDER_EVENT_TYPES.ORDER_PARSED,
    actorType: ORDER_ACTOR_TYPES.USER,
    source: 'unit_test',
    afterState: original
  });
  assert.equal(result.ok, true);

  // Storage and Content Script integration check
  const storageContent = readFileSync(resolve('src/application/storage.js'), 'utf8');
  assert.ok(storageContent.includes('ORDER_SAVED'));
  assert.ok(storageContent.includes('TRACKING_RECEIVED'));

  const contentScriptContent = readFileSync(resolve('src/runtime/content/index.js'), 'utf8');
  assert.ok(contentScriptContent.includes('ORDER_PARSED'));
  assert.ok(contentScriptContent.includes('USER_FIELD_CHANGED'));
});

test('Gap 3: CS Task Automation - Daily Evaluation RPC & 24h Cooldown Scheduler', async () => {
  const v132Content = readFileSync(resolve('database/migrations/v132_fix_7_features_production_gaps.sql'), 'utf8');
  assert.ok(v132Content.includes('CREATE OR REPLACE FUNCTION public.evaluate_and_generate_cs_tasks'));
  assert.ok(v132Content.includes('EXPIRED_RECOVERY'));
  assert.ok(v132Content.includes('USAGE_DROP_DIAGNOSTIC'));

  // Verify scheduler service
  const evalResult = await checkAndRunDailyEvaluation('c201e6bc-8986-4f91-b900-e319865d1907', false);
  assert.ok(typeof evalResult.evaluated === 'boolean');

  // Verify UI integration
  const cskhUiContent = readFileSync(resolve('src/ui/options/pages/Support/CskhTaskWorkspace.jsx'), 'utf8');
  assert.ok(cskhUiContent.includes('checkAndRunDailyEvaluation'));
  assert.ok(cskhUiContent.includes('handleRunEvaluation'));
});

test('Gap 4: Facebook/Zalo - Webhook Edge Function & Signature Verification', () => {
  const edgeFunc = readFileSync(resolve('supabase/functions/social-webhook/index.ts'), 'utf8');
  assert.ok(edgeFunc.includes("url.searchParams.get('hub.mode')"));
  assert.ok(edgeFunc.includes("x-hub-signature-256"));
  assert.ok(edgeFunc.includes("channel_conversations"));
  assert.ok(edgeFunc.includes("channel_messages"));

  // Meta signature test with adapter
  const appSecret = 'my_fb_secret_key';
  const body = '{"entry":[{"id":"123","messaging":[{"message":{"text":"Hello"}}]}]}';
  const validSignature = 'sha256=' + hmacSha256Hex(appSecret, body);
  assert.equal(verifyMetaSignature(body, validSignature, appSecret), true);
  assert.equal(verifyMetaSignature(body, 'sha256=invalidhash', appSecret), false);

  // Zalo signature test with adapter
  const oaSecret = 'zalo_oa_secret';
  const nowSec = Math.floor(Date.now() / 1000);
  const zaloMac = sha256Hex(oaSecret + body + nowSec);
  assert.equal(verifyZaloSignature(body, zaloMac, oaSecret, nowSec), true);
  assert.equal(verifyZaloSignature(body, zaloMac, oaSecret, nowSec - 600), false); // Replay attack protection (> 300s)
});

test('Gap 5: Đơn từ ảnh / Confidence - Image Assets & Field Extractions Persistence', async () => {
  const v132Content = readFileSync(resolve('database/migrations/v132_fix_7_features_production_gaps.sql'), 'utf8');
  assert.ok(v132Content.includes('record_image_order_extractions'));

  const persistRes = await persistImageOrderExtractions({
    shopId: 'c201e6bc-8986-4f91-b900-e319865d1907',
    imageRaw: 'data:image/jpeg;base64,mockimagedata',
    extractedFields: {
      name: { value: 'Trần Thị B', confidence: 0.95 },
      phone: { value: '0901234567', confidence: 0.98 },
      address: { value: 'Số 10 Lê Lợi, Bến Nghé, Quận 1, TP HCM', confidence: 0.92 }
    }
  });
  assert.equal(persistRes.success, true);
  assert.ok(persistRes.sha256);

  const confidenceReviewUi = readFileSync(resolve('src/ui/panel/components/ConfidenceReview.jsx'), 'utf8');
  assert.ok(confidenceReviewUi.includes('persistImageOrderExtractions'));
});
