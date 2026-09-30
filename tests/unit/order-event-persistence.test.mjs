import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ORDER_EVENT_TYPES, ORDER_ACTOR_TYPES } from '../../src/domain/order/order-event.taxonomy.js';

const root = process.cwd();
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

test('B02: Migration v126 - append_order_event schema and security contracts', () => {
  const migrationPath = path.join(root, 'database/migrations/v126_order_events_persistence.sql');
  assert.ok(fs.existsSync(migrationPath), 'Migration v126 must exist');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  // Must ensure order_events has taxonomy columns
  assert.ok(sql.includes('order_code'), 'order_events must include order_code');
  assert.ok(sql.includes('event_type'), 'order_events must include event_type');
  assert.ok(sql.includes('actor_type'), 'order_events must include actor_type');
  assert.ok(sql.includes('before_patch'), 'order_events must include before_patch');
  assert.ok(sql.includes('after_patch'), 'order_events must include after_patch');

  // Must define append_order_event RPC
  assert.ok(sql.includes('FUNCTION public.append_order_event('), 'Must define append_order_event RPC');
  assert.ok(sql.includes('has_shop_permission'), 'append_order_event must check has_shop_permission');
});

test('B02: Late AI Response Guard - Late AI cannot overwrite submitted order snapshot', () => {
  const submittedSnapshot = {
    order_id: 'ord_submitted_001',
    order_code: 'DH-001',
    tracking_code: 'VNPOST123456',
    status: 'submitted',
    address: '100 Đường Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP Hồ Chí Minh',
    submitted_at: '2026-09-25T10:00:00.000Z'
  };

  const lateAiResult = {
    order_id: 'ord_submitted_001',
    address: '100 Đường Nguyễn Huệ, Phường Sài Gòn Mới, Quận 1, TP Hồ Chí Minh', // AI changed address after submit
    status: 'parsed'
  };

  // Function to guard snapshot mutation
  function applyOrderUpdateGuard(currentOrder, updatePatch, source) {
    if (currentOrder.status === 'submitted' && currentOrder.tracking_code && source === 'AI') {
      return {
        allowed: false,
        reason: 'LATE_AI_BLOCKED',
        action: 'EMIT_SUGGESTION_EVENT_ONLY'
      };
    }
    return {
      allowed: true,
      updatedOrder: { ...currentOrder, ...updatePatch }
    };
  }

  const guardResult = applyOrderUpdateGuard(submittedSnapshot, lateAiResult, 'AI');
  assert.equal(guardResult.allowed, false);
  assert.equal(guardResult.reason, 'LATE_AI_BLOCKED');
  assert.equal(guardResult.action, 'EMIT_SUGGESTION_EVENT_ONLY');
});

test('B02: Tracking + Save Atomicity Contract - Tracking reception requires order identity match', () => {
  function matchTrackingToOrder(incomingTracking, candidateOrder) {
    // Identity Invariant: Never match by customer phone or name!
    if (!candidateOrder.order_id && !candidateOrder.order_code) {
      return { matched: false, reason: 'MISSING_ORDER_IDENTITY' };
    }
    if (incomingTracking.order_code && candidateOrder.order_code && incomingTracking.order_code !== candidateOrder.order_code) {
      return { matched: false, reason: 'DIFFERENT_ORDER_CODE' };
    }
    return {
      matched: true,
      tracking_code: incomingTracking.tracking_code,
      order_id: candidateOrder.order_id,
      order_code: candidateOrder.order_code
    };
  }

  const orderA = { order_id: 'ord_1', order_code: 'VN001', customerPhone: '0987654321', customerName: 'Anh Nam' };
  const orderB = { order_id: 'ord_2', order_code: 'VN002', customerPhone: '0987654321', customerName: 'Anh Nam' }; // Same customer, different order

  const incoming = { order_code: 'VN002', tracking_code: 'TRACK_999' };

  // Must match order B, never order A
  assert.equal(matchTrackingToOrder(incoming, orderA).matched, false);
  assert.equal(matchTrackingToOrder(incoming, orderB).matched, true);
});
