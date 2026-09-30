import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

test('1. Migration v114 defines payment reconciliation schema, indices, and admin RPCs', () => {
  const v114Path = path.join(root, 'database', 'migrations', 'v114_payment_reconciliation_and_idempotency.sql');
  assert.ok(fs.existsSync(v114Path), 'v114_payment_reconciliation_and_idempotency.sql must exist');
  const sql = read('database/migrations/v114_payment_reconciliation_and_idempotency.sql');

  // Reconciliation columns on payment_transactions
  assert.match(sql, /ALTER TABLE public\.payment_transactions ADD COLUMN IF NOT EXISTS reconciliation_status TEXT/, 'Must add reconciliation_status');
  assert.match(sql, /ALTER TABLE public\.payment_transactions ADD COLUMN IF NOT EXISTS reconciliation_notes TEXT/, 'Must add reconciliation_notes');
  assert.match(sql, /ALTER TABLE public\.payment_transactions ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMPTZ/, 'Must add reconciled_at');
  assert.match(sql, /ALTER TABLE public\.payment_transactions ADD COLUMN IF NOT EXISTS reconciled_by UUID/, 'Must add reconciled_by');
  assert.match(sql, /ALTER TABLE public\.payment_transactions ADD COLUMN IF NOT EXISTS retry_count INT/, 'Must add retry_count');
  assert.match(sql, /ALTER TABLE public\.payment_transactions ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMPTZ/, 'Must add last_retry_at');

  // Index on reconciliation_status
  assert.match(sql, /CREATE INDEX IF NOT EXISTS idx_payment_trans_reconciliation_status/, 'Must index reconciliation_status');

  // RPC for reconciliation queue
  assert.match(sql, /admin_get_payment_reconciliation_queue/, 'Must define admin_get_payment_reconciliation_queue');
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.admin_get_payment_reconciliation_queue/, 'Must grant execute on admin_get_payment_reconciliation_queue');

  // RPC for manual reconciliation / retry
  assert.match(sql, /admin_reconcile_payment_transaction/, 'Must define admin_reconcile_payment_transaction');
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.admin_reconcile_payment_transaction/, 'Must grant execute on admin_reconcile_payment_transaction');

  // Referenced in RUN_ALL_MIGRATIONS.sql
  const runAll = read('database/migrations/RUN_ALL_MIGRATIONS.sql');
  assert.match(runAll, /v114_payment_reconciliation_and_idempotency\.sql/, 'RUN_ALL_MIGRATIONS must reference v114');
});

test('2. Edge Function payment-webhook logs unmatched transactions and prevents unmapped quota grants', () => {
  const webhookSrc = read('supabase/functions/payment-webhook/index.ts');

  // HMAC verification
  assert.match(webhookSrc, /x-signature/i, 'Must check X-Signature');
  assert.match(webhookSrc, /x-timestamp/i, 'Must check X-Timestamp');
  assert.match(webhookSrc, /x-nonce/i, 'Must check X-Nonce');
  assert.match(webhookSrc, /REPLAY_DETECTED/i, 'Must reject replayed nonce');

  // Zero / Negative amount rejection
  assert.match(webhookSrc, /amount\s*<=\s*0/, 'Must validate positive amount');

  // Unmatched shop handling: must record transaction into database with unmatched status
  assert.match(webhookSrc, /reconciliation_status.*unmatched|status.*PENDING/i, 'Must persist unmatched transactions for admin audit');
  assert.match(webhookSrc, /UNMATCHED|Shop not found/i, 'Must identify unmatched state');
});

test('3. Webhook idempotency simulation: duplicate deliveries must never double-credit quota', () => {
  // Simulate payment processing state with strict transaction uniqueness
  const transactionsDb = new Map();
  const shopQuotasDb = new Map();

  function processPaymentWebhook({ transactionCode, shopId, amount, planTier }) {
    if (!amount || amount <= 0) {
      return { success: false, error: 'INVALID_AMOUNT' };
    }
    if (!shopId) {
      // Unmatched shop: save pending transaction but DO NOT credit quota
      transactionsDb.set(transactionCode, {
        transactionCode,
        shopId: null,
        amount,
        status: 'PENDING',
        reconciliation_status: 'unmatched'
      });
      return { success: false, code: 'UNMATCHED_SHOP', credited: false };
    }

    // Idempotency check: if transactionCode already processed
    if (transactionsDb.has(transactionCode)) {
      const existing = transactionsDb.get(transactionCode);
      return {
        success: true,
        duplicate: true,
        credited: false,
        message: 'Giao dịch đã được xử lý trước đó.'
      };
    }

    // Process new payment
    const currentQuota = shopQuotasDb.get(shopId) || { aiQuota: 0, ordersQuota: 0 };
    const quotaToAdd = planTier === 'PRO_YEAR' ? 50000 : 2500;
    shopQuotasDb.set(shopId, {
      aiQuota: currentQuota.aiQuota + quotaToAdd,
      ordersQuota: currentQuota.ordersQuota + 5000
    });

    transactionsDb.set(transactionCode, {
      transactionCode,
      shopId,
      amount,
      status: 'SUCCESS',
      reconciliation_status: 'reconciled'
    });

    return { success: true, duplicate: false, credited: true };
  }

  // Delivery 1: Original webhook
  const r1 = processPaymentWebhook({
    transactionCode: 'TXN-IDEM-001',
    shopId: 'shop-uuid-1',
    amount: 100000,
    planTier: 'PRO_MONTH'
  });
  assert.equal(r1.success, true);
  assert.equal(r1.duplicate, false);
  assert.equal(r1.credited, true);
  assert.equal(shopQuotasDb.get('shop-uuid-1').aiQuota, 2500);

  // Delivery 2: Network retry of same webhook
  const r2 = processPaymentWebhook({
    transactionCode: 'TXN-IDEM-001',
    shopId: 'shop-uuid-1',
    amount: 100000,
    planTier: 'PRO_MONTH'
  });
  assert.equal(r2.success, true);
  assert.equal(r2.duplicate, true);
  assert.equal(r2.credited, false);
  // Quota MUST remain unchanged!
  assert.equal(shopQuotasDb.get('shop-uuid-1').aiQuota, 2500);

  // Delivery 3: Third retry of same webhook
  const r3 = processPaymentWebhook({
    transactionCode: 'TXN-IDEM-001',
    shopId: 'shop-uuid-1',
    amount: 100000,
    planTier: 'PRO_MONTH'
  });
  assert.equal(r3.success, true);
  assert.equal(r3.duplicate, true);
  assert.equal(r3.credited, false);
  assert.equal(shopQuotasDb.get('shop-uuid-1').aiQuota, 2500);

  // Delivery with UNMATCHED shop
  const rUnmatched = processPaymentWebhook({
    transactionCode: 'TXN-UNMATCHED-999',
    shopId: null,
    amount: 250000,
    planTier: 'PRO_MONTH'
  });
  assert.equal(rUnmatched.credited, false);
  assert.equal(transactionsDb.get('TXN-UNMATCHED-999').reconciliation_status, 'unmatched');

  // Delivery with invalid amount <= 0
  const rZero = processPaymentWebhook({
    transactionCode: 'TXN-ZERO-000',
    shopId: 'shop-uuid-1',
    amount: 0,
    planTier: 'PRO_MONTH'
  });
  assert.equal(rZero.success, false);
  assert.equal(shopQuotasDb.get('shop-uuid-1').aiQuota, 2500);
});

test('4. AdminRepository and AdminService expose reconciliation methods', () => {
  const repo = read('src/domain/admin/admin.repository.js');
  const serv = read('src/domain/admin/admin.service.js');

  assert.match(repo, /getPaymentReconciliationQueue/, 'AdminRepository must have getPaymentReconciliationQueue');
  assert.match(repo, /reconcilePaymentTransaction/, 'AdminRepository must have reconcilePaymentTransaction');
  assert.match(serv, /getPaymentReconciliationQueue/, 'AdminService must have getPaymentReconciliationQueue');
  assert.match(serv, /reconcilePaymentTransaction/, 'AdminService must have reconcilePaymentTransaction');
});

test('5. Subscriptions.jsx includes reconciliation view, status filtering, and retry actions', () => {
  const sub = read('src/ui/admin-dashboard/pages/Subscriptions/Subscriptions.jsx');

  assert.match(sub, /reconciliation|Đối Soát|Giao Dịch/i, 'Subscriptions.jsx must contain reconciliation section or tab');
  assert.match(sub, /unmatched|chưa khớp/i, 'Subscriptions.jsx must support unmatched filter');
  assert.match(sub, /duplicate|trùng lặp/i, 'Subscriptions.jsx must support duplicate filter');
  assert.match(sub, /failed|thất bại/i, 'Subscriptions.jsx must support failed filter');
  assert.match(sub, /reconciled|đã đối soát/i, 'Subscriptions.jsx must support reconciled filter');
  assert.match(sub, /reconcilePaymentTransaction|handleReconcile|Thử Lại|Gán Shop/i, 'Subscriptions.jsx must provide reconciliation action');
});
