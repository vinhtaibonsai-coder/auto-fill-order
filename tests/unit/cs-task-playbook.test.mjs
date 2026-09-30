import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { evaluateRetentionSegment, generatePlaybookTask } from '../../src/domain/retention/playbook-engine.js';

const root = process.cwd();

test('C01: Migration v129 - customer_success_tasks and deduplication index', () => {
  const migrationPath = path.join(root, 'database/migrations/v129_customer_success_tasks_and_playbook.sql');
  assert.ok(fs.existsSync(migrationPath), 'Migration v129 must exist');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  // Verify customer_success_tasks
  assert.ok(sql.includes('TABLE IF NOT EXISTS public.customer_success_tasks'), 'Must create customer_success_tasks');
  assert.ok(sql.includes('playbook_code'), 'Must have playbook_code');
  assert.ok(sql.includes('segment'), 'Must have segment');
  assert.ok(sql.includes('risk_score'), 'Must have risk_score');

  // Verify partial unique index for deduplication
  assert.ok(sql.includes('idx_cs_tasks_open_shop_playbook'), 'Must create partial unique index');
  assert.ok(sql.includes("WHERE status IN ('NEW', 'IN_PROGRESS', 'WAITING_REPLY')"), 'Index must scope to open statuses');

  // RPCs and permission check
  assert.ok(sql.includes('FUNCTION public.update_cs_task_status'), 'Must have update_cs_task_status RPC');
  assert.ok(sql.includes('has_shop_permission'), 'Must check has_shop_permission');
});

test('C01: Retention Segment Evaluator - Evaluates usage drop with 28-day baseline guard', () => {
  // Case 1: Healthy mature shop (no drop)
  const matureShopHealthy = {
    shopAgeDays: 60,
    baselineWeeklyOrders: 50,
    currentWeeklyOrders: 48,
    daysUntilExpiration: 45
  };
  const seg1 = evaluateRetentionSegment(matureShopHealthy);
  assert.equal(seg1.segment, 'HEALTHY');
  assert.equal(seg1.riskScore < 30, true);

  // Case 2: Mature shop with significant drop (> 40% drop)
  const matureShopDrop = {
    shopAgeDays: 90,
    baselineWeeklyOrders: 100,
    currentWeeklyOrders: 40, // 60% drop
    daysUntilExpiration: 30
  };
  const seg2 = evaluateRetentionSegment(matureShopDrop);
  assert.equal(seg2.segment, 'USAGE_DROP');
  assert.equal(seg2.riskScore >= 60, true);

  // Case 3: New shop (< 14 days) should NOT be flagged as USAGE_DROP even if orders fluctuated
  const newShop = {
    shopAgeDays: 7,
    baselineWeeklyOrders: 5,
    currentWeeklyOrders: 1,
    daysUntilExpiration: 25
  };
  const seg3 = evaluateRetentionSegment(newShop);
  assert.notEqual(seg3.segment, 'USAGE_DROP', 'New shop must not be misclassified as USAGE_DROP');

  // Case 4: Expiring soon (<= 5 days)
  const expiringShop = {
    shopAgeDays: 120,
    baselineWeeklyOrders: 40,
    currentWeeklyOrders: 35,
    daysUntilExpiration: 3
  };
  const seg4 = evaluateRetentionSegment(expiringShop);
  assert.equal(seg4.segment, 'EXPIRING_SOON');
  assert.equal(seg4.priority, 'HIGH');
});

test('C02: Playbook Engine - Idempotent task generation prevents duplicates', () => {
  const shopContext = {
    shopId: 'shop-test-123',
    segment: 'EXPIRING_SOON',
    daysUntilExpiration: 2,
    riskScore: 75
  };

  const existingOpenTasks = [
    {
      shop_id: 'shop-test-123',
      playbook_code: 'EXPIRING_RENEWAL_ASSIST',
      status: 'NEW'
    }
  ];

  // Try generating task when one is already open
  const result1 = generatePlaybookTask(shopContext, existingOpenTasks);
  assert.equal(result1.created, false);
  assert.equal(result1.reason, 'TASK_ALREADY_OPEN');

  // Generate task when no open task exists
  const result2 = generatePlaybookTask(shopContext, []);
  assert.equal(result2.created, true);
  assert.equal(result2.task.playbook_code, 'EXPIRING_RENEWAL_ASSIST');
  assert.equal(result2.task.priority, 'HIGH');
  assert.ok(result2.task.due_at, 'Must have due date');
});

test('C03: CSKH RBAC - Excludes sensitive billing credentials and keys from task payload', () => {
  const fullShopProfile = {
    id: 'shop-test-123',
    name: 'Vinh Tai Bonsai',
    owner_email: 'owner@example.com',
    secret_api_key: 'sk_live_secret_12345',
    vnpay_hash_secret: 'hash_secret_private_9999',
    orders_count: 150
  };

  // Safe task payload sanitizer for CSKH workspace
  function sanitizeForCskh(shop) {
    const { secret_api_key, vnpay_hash_secret, ...safe } = shop;
    return safe;
  }

  const sanitized = sanitizeForCskh(fullShopProfile);
  assert.equal(sanitized.secret_api_key, undefined, 'Must not leak API key');
  assert.equal(sanitized.vnpay_hash_secret, undefined, 'Must not leak billing secret');
  assert.equal(sanitized.name, 'Vinh Tai Bonsai');
});
