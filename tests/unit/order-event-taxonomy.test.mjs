import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ORDER_EVENT_TYPES,
  ORDER_ACTOR_TYPES,
  calculateOrderPatch,
  maskOrderPII,
  buildOrderEvent,
  validateOrderEvent,
  sanitizeEventForAudit
} from '../../src/domain/order/order-event.taxonomy.js';

test('Order Event Taxonomy - 1. Event types & Actor types completeness', () => {
  const expectedEvents = [
    'ORDER_PARSED',
    'AI_REVIEW_STARTED',
    'AI_FIELD_CHANGED',
    'USER_FIELD_CHANGED',
    'AUTOFILL_STARTED',
    'AUTOFILL_VERIFIED',
    'SUBMIT_STARTED',
    'TRACKING_RECEIVED',
    'ORDER_SAVED',
    'SYNCED',
    'STATUS_CHANGED',
    'PRINT_JOB_CREATED',
    'LABEL_PRINTED',
    'LABEL_REPRINTED',
    'PRINT_FAILED',
    'ERROR'
  ];

  for (const evt of expectedEvents) {
    assert.equal(typeof ORDER_EVENT_TYPES[evt], 'string', `Missing event type: ${evt}`);
    assert.equal(ORDER_EVENT_TYPES[evt], evt);
  }

  const expectedActors = ['USER', 'AI', 'SYSTEM', 'CARRIER', 'PARTNER_API'];
  for (const actor of expectedActors) {
    assert.equal(typeof ORDER_ACTOR_TYPES[actor], 'string', `Missing actor type: ${actor}`);
    assert.equal(ORDER_ACTOR_TYPES[actor], actor);
  }
});

test('Order Event Taxonomy - 2. calculateOrderPatch only captures modified fields', () => {
  const before = {
    customerName: 'Nguyễn Văn A',
    phone: '0987654321',
    address: '123 Đường Láng',
    cod: 250000,
    ward: 'Láng Thượng',
    province: 'Hà Nội'
  };

  const after = {
    customerName: 'Nguyễn Văn A', // Unchanged
    phone: '0987654321', // Unchanged
    address: '125 Đường Láng', // Changed
    cod: 300000, // Changed
    ward: 'Láng Thượng', // Unchanged
    province: 'Hà Nội', // Unchanged
    note: 'Giao giờ hành chính' // Added
  };

  const patch = calculateOrderPatch(before, after);

  assert.deepEqual(patch.changed_fields.sort(), ['address', 'cod', 'note'].sort());
  assert.deepEqual(patch.before_patch, {
    address: '123 Đường Láng',
    cod: 250000,
    note: undefined
  });
  assert.deepEqual(patch.after_patch, {
    address: '125 Đường Láng',
    cod: 300000,
    note: 'Giao giờ hành chính'
  });
});

test('Order Event Taxonomy - 3. maskOrderPII properly obfuscates sensitive information', () => {
  const rawPhone = '0987654321';
  const maskedPhone = maskOrderPII({ phone: rawPhone }).phone;
  assert.equal(maskedPhone, '098***4321');
  assert.notEqual(maskedPhone, rawPhone);

  const rawAddress = 'Số 45 Ngõ 12 Đường Cầu Giấy, Phường Dịch Vọng, Quận Cầu Giấy, Hà Nội';
  const maskedAddress = maskOrderPII({ address: rawAddress }).address;
  assert.match(maskedAddress, /^\*\*\*/);
  assert.match(maskedAddress, /Phường Dịch Vọng/);

  // Masking in patch objects
  const patch = {
    before_patch: { phone: '0912345678', cod: 150000 },
    after_patch: { phone: '0987654321', cod: 200000 }
  };
  const maskedPatch = maskOrderPII(patch);
  assert.equal(maskedPatch.before_patch.phone, '091***5678');
  assert.equal(maskedPatch.after_patch.phone, '098***4321');
  assert.equal(maskedPatch.after_patch.cod, 200000); // Numbers/COD untouched
});

test('Order Event Taxonomy - 4. validateOrderEvent enforces invariants and schema', () => {
  const validEvent = {
    shop_id: '11111111-1111-1111-1111-111111111111',
    order_id: 'ord_123456',
    order_code: 'DH-2026-001',
    event_type: ORDER_EVENT_TYPES.ORDER_PARSED,
    actor_type: ORDER_ACTOR_TYPES.USER,
    actor_id: 'user_999',
    source: 'web_panel'
  };

  const validation = validateOrderEvent(validEvent);
  assert.equal(validation.valid, true);

  // Missing shop_id must fail
  assert.equal(validateOrderEvent({ ...validEvent, shop_id: null }).valid, false);

  // Missing order identity (both order_id and order_code absent) must fail
  assert.equal(validateOrderEvent({ ...validEvent, order_id: null, order_code: null }).valid, false);

  // Invalid event_type must fail
  assert.equal(validateOrderEvent({ ...validEvent, event_type: 'RANDOM_HACK' }).valid, false);

  // Invalid actor_type must fail
  assert.equal(validateOrderEvent({ ...validEvent, actor_type: 'ALIEN' }).valid, false);
});

test('Order Event Taxonomy - 5. buildOrderEvent creates a canonical audit event', () => {
  const event = buildOrderEvent({
    shop_id: '11111111-1111-1111-1111-111111111111',
    order_id: 'ord_test_001',
    order_code: 'VNPOST-001',
    event_type: ORDER_EVENT_TYPES.SUBMIT_STARTED,
    actor_type: ORDER_ACTOR_TYPES.SYSTEM,
    actor_id: 'bot_worker_1',
    source: 'vnpost_carrier_automation',
    before_state: { status: 'draft' },
    after_state: { status: 'submitting' },
    metadata: { carrier: 'VNPOST', attempt: 1 }
  });

  assert.equal(event.event_type, 'SUBMIT_STARTED');
  assert.equal(event.actor_type, 'SYSTEM');
  assert.deepEqual(event.before_patch, { status: 'draft' });
  assert.deepEqual(event.after_patch, { status: 'submitting' });
  assert.equal(event.metadata.carrier, 'VNPOST');
  assert.ok(event.created_at);
});

test('Order Event Taxonomy - 6. sanitizeEventForAudit protects PII based on role authorization', () => {
  const event = buildOrderEvent({
    shop_id: '11111111-1111-1111-1111-111111111111',
    order_id: 'ord_secret_001',
    order_code: 'JT-777',
    event_type: ORDER_EVENT_TYPES.USER_FIELD_CHANGED,
    actor_type: ORDER_ACTOR_TYPES.USER,
    before_state: { phone: '0901234567', customerName: 'Trần Văn B' },
    after_state: { phone: '0909888999', customerName: 'Trần Văn B' }
  });

  // Without full PII permission (e.g. Accountant or Global Audit view)
  const sanitized = sanitizeEventForAudit(event, { hasFullPiiAccess: false });
  assert.equal(sanitized.before_patch.phone, '090***4567');
  assert.equal(sanitized.after_patch.phone, '090***8999');

  // With full PII permission (e.g. Owner/Manager/Packer)
  const fullAccess = sanitizeEventForAudit(event, { hasFullPiiAccess: true });
  assert.equal(fullAccess.before_patch.phone, '0901234567');
  assert.equal(fullAccess.after_patch.phone, '0909888999');
});
