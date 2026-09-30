import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { 
  generatePartnerApiKey, 
  hashPartnerApiKey, 
  validatePartnerRequest,
  executePartnerTool
} from '../../src/application/partner/partner-gateway.service.js';

const root = process.cwd();

test('G01 & G02: Migration v130 - partner_api_clients & usage schema, RLS, and security invariants', () => {
  const migrationPath = path.join(root, 'database/migrations/v130_partner_api_and_mcp_gateway.sql');
  assert.ok(fs.existsSync(migrationPath), 'Migration v130 must exist');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  // Verify partner_api_clients
  assert.ok(sql.includes('TABLE IF NOT EXISTS public.partner_api_clients'), 'Must create partner_api_clients');
  assert.ok(sql.includes('key_prefix'), 'Must store key_prefix');
  assert.ok(sql.includes('key_hash'), 'Must store key_hash');
  assert.ok(!sql.includes('secret_key TEXT'), 'Never store raw secret key');
  assert.ok(sql.includes('scopes TEXT[]'), 'Must store scopes array');
  assert.ok(sql.includes('monthly_quota'), 'Must store monthly_quota');

  // Verify partner_api_usage
  assert.ok(sql.includes('TABLE IF NOT EXISTS public.partner_api_usage'), 'Must create partner_api_usage');
  assert.ok(!sql.includes('raw_text TEXT'), 'Usage table must NEVER store raw text or PII');

  // Authorization helper
  assert.ok(sql.includes('has_shop_permission'), 'create_partner_api_key must check has_shop_permission');
});

test('G02: API Key Lifecycle - Generates prefix + hash; rejects invalid or expired keys', () => {
  const generated = generatePartnerApiKey();
  assert.ok(generated.rawKey.startsWith('ak_live_'), 'Key must start with ak_live_');
  assert.ok(generated.prefix.startsWith('ak_live_'), 'Prefix must start with ak_live_');
  assert.equal(typeof generated.hash, 'string');
  assert.equal(generated.hash.length, 64, 'SHA-256 hash must be 64 hex characters');

  // Hashing consistency
  const rehash = hashPartnerApiKey(generated.rawKey);
  assert.equal(rehash, generated.hash);

  // Case 1: Valid client
  const activeClient = {
    id: 'client-001',
    status: 'ACTIVE',
    scopes: ['orders:parse', 'address:normalize'],
    monthly_quota: 1000,
    monthly_usage: 250,
    expires_at: new Date(Date.now() + 86400000).toISOString()
  };
  const val1 = validatePartnerRequest(activeClient, 'orders:parse');
  assert.equal(val1.allowed, true);

  // Case 2: Revoked client
  const revokedClient = { ...activeClient, status: 'REVOKED' };
  const val2 = validatePartnerRequest(revokedClient, 'orders:parse');
  assert.equal(val2.allowed, false);
  assert.equal(val2.code, 401);
  assert.equal(val2.error, 'KEY_REVOKED');

  // Case 3: Expired client
  const expiredClient = { ...activeClient, expires_at: '2025-01-01T00:00:00.000Z' };
  const val3 = validatePartnerRequest(expiredClient, 'orders:parse');
  assert.equal(val3.allowed, false);
  assert.equal(val3.code, 401);
  assert.equal(val3.error, 'KEY_EXPIRED');

  // Case 4: Scope out-of-bounds
  const val4 = validatePartnerRequest(activeClient, 'carrier:create_shipment');
  assert.equal(val4.allowed, false);
  assert.equal(val4.code, 403);
  assert.equal(val4.error, 'INSUFFICIENT_SCOPE');

  // Case 5: Over quota
  const overQuotaClient = { ...activeClient, monthly_usage: 1000 };
  const val5 = validatePartnerRequest(overQuotaClient, 'orders:parse');
  assert.equal(val5.allowed, false);
  assert.equal(val5.code, 429);
  assert.equal(val5.error, 'QUOTA_EXCEEDED');
});

test('G01 & G04: Contract Parity - Public API / MCP Gateway returns standard payload structure', async () => {
  const parseResult = await executePartnerTool('parse_order', {
    raw_text: 'Anh Tuấn 0912345678 Số 10 Hàng Gai Hoàn Kiếm Hà Nội COD 350k'
  });

  assert.ok(parseResult.request_id.startsWith('req_'), 'Must include standard request_id');
  assert.ok(parseResult.data, 'Must include data payload');
  assert.equal(parseResult.data.phone, '0912345678');
  assert.ok(parseResult.data.name.includes('Tuấn'));
  assert.equal(parseResult.data.codAmount, 350000);
  assert.ok(typeof parseResult.confidence === 'number');
  assert.ok(parseResult.usage, 'Must return usage object');
  assert.equal(parseResult.usage.units, 1);
});
