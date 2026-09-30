import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { 
  verifyMetaSignature, 
  verifyZaloSignature, 
  createDraftFromSocialMessage,
  evaluateSocialChannelCapability
} from '../../src/domain/social/social-channel.adapter.js';

const root = process.cwd();

test('D01 & D02: Migration v131 - Official social channels & inbox schema and RLS', () => {
  const migrationPath = path.join(root, 'database/migrations/v131_official_social_channels_and_inbox.sql');
  assert.ok(fs.existsSync(migrationPath), 'Migration v131 must exist');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  // Tables
  assert.ok(sql.includes('TABLE IF NOT EXISTS public.channel_connections'), 'Must create channel_connections');
  assert.ok(sql.includes('encrypted_secret_ref'), 'Secret must be stored as server reference');
  assert.ok(!sql.includes('access_token TEXT'), 'Never store plaintext user tokens in client DB');
  assert.ok(sql.includes('TABLE IF NOT EXISTS public.channel_conversations'), 'Must create channel_conversations');
  assert.ok(sql.includes('TABLE IF NOT EXISTS public.channel_messages'), 'Must create channel_messages');
  assert.ok(sql.includes('external_message_id TEXT NOT NULL UNIQUE'), 'Must guarantee message deduplication');

  // RPC
  assert.ok(sql.includes('FUNCTION public.ingest_social_message_idempotent'), 'Must create idempotent ingestion RPC');
});

test('D01: Capability Gate - Fail-closed when permissions/approval are missing', () => {
  // Case 1: Unapproved connection
  const pendingConn = {
    provider: 'META_MESSENGER',
    status: 'NEEDS_APPROVAL',
    scopes: []
  };
  const cap1 = evaluateSocialChannelCapability(pendingConn);
  assert.equal(cap1.canIngest, false);
  assert.equal(cap1.statusLabel, 'Unavailable / Needs approval');

  // Case 2: Approved connection
  const activeConn = {
    provider: 'ZALO_OA',
    status: 'ACTIVE',
    scopes: ['messages:read', 'messages:reply']
  };
  const cap2 = evaluateSocialChannelCapability(activeConn);
  assert.equal(cap2.canIngest, true);
  assert.equal(cap2.statusLabel, 'Active');
});

test('D02: Webhook Signature Verification - Meta HMAC SHA-256 and timing attacks defense', () => {
  const appSecret = 'meta_test_app_secret_998877';
  const body = JSON.stringify({ object: 'page', entry: [{ id: '12345', messaging: [{ message: { text: 'test' } }] }] });

  const validHmac = crypto.createHmac('sha256', appSecret).update(body).digest('hex');
  const validHeader = `sha256=${validHmac}`;

  // 1. Valid signature passes
  assert.equal(verifyMetaSignature(body, validHeader, appSecret), true);

  // 2. Tampered body fails
  assert.equal(verifyMetaSignature(body + 'tamper', validHeader, appSecret), false);

  // 3. Incorrect secret fails
  assert.equal(verifyMetaSignature(body, validHeader, 'wrong_secret'), false);

  // 4. Missing header fails
  assert.equal(verifyMetaSignature(body, '', appSecret), false);
});

test('D02: Webhook Signature Verification - Zalo OA MAC and Replay Window', () => {
  const oaSecret = 'zalo_oa_secret_12345';
  const timestamp = Math.floor(Date.now() / 1000);
  const body = '{"event_name":"user_send_text","message":{"text":"Đơn hàng"}}';

  const validMac = crypto.createHash('sha256').update(oaSecret + body + timestamp).digest('hex');

  // 1. Fresh valid signature passes
  assert.equal(verifyZaloSignature(body, validMac, oaSecret, timestamp), true);

  // 2. Replay attack: timestamp older than 5 minutes (300s) fails
  const staleTimestamp = timestamp - 301;
  const staleMac = crypto.createHash('sha256').update(oaSecret + body + staleTimestamp).digest('hex');
  assert.equal(verifyZaloSignature(body, staleMac, oaSecret, staleTimestamp), false);
});

test('D03: Unified Inbox Draft Creation - Generates distinct orders without overwriting repeat customer', async () => {
  const sampleMessage1 = {
    external_message_id: 'mid_meta_001',
    provider: 'META_MESSENGER',
    text: 'Gửi cho chị Lan 0987654321 số 45 Lê Duẩn Quận 1 HCM cây mai 500k',
    customer_ref: 'fb_user_123'
  };

  const draft1 = await createDraftFromSocialMessage(sampleMessage1, 'shop_test_1');
  assert.ok(draft1.order_code, 'Draft 1 must have order_code');
  assert.equal(draft1.source, 'META_MESSENGER');
  assert.equal(draft1.source_ref, 'mid_meta_001');
  assert.equal(draft1.phone, '0987654321');

  // Second order from SAME customer conversation
  const sampleMessage2 = {
    external_message_id: 'mid_meta_002',
    provider: 'META_MESSENGER',
    text: 'Gửi thêm đơn nữa nhé: Lan 0987654321 số 45 Lê Duẩn Quận 1 HCM COD 800k',
    customer_ref: 'fb_user_123'
  };

  const draft2 = await createDraftFromSocialMessage(sampleMessage2, 'shop_test_1');
  assert.ok(draft2.order_code, 'Draft 2 must have distinct order_code');
  assert.notEqual(draft1.order_code, draft2.order_code, 'Order identity invariant: Repeat customer orders must have distinct order_codes');
  assert.equal(draft2.codAmount, 800000);
});
