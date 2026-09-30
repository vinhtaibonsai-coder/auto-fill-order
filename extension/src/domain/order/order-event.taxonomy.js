/**
 * @file order-event.taxonomy.js
 * @description Canonical taxonomy, patch calculation, PII masking, and schema validation
 * for append-only order lifecycle events (Wave 0 Task B01).
 */

export const ORDER_EVENT_TYPES = Object.freeze({
  ORDER_PARSED: 'ORDER_PARSED',
  AI_REVIEW_STARTED: 'AI_REVIEW_STARTED',
  AI_FIELD_CHANGED: 'AI_FIELD_CHANGED',
  USER_FIELD_CHANGED: 'USER_FIELD_CHANGED',
  AUTOFILL_STARTED: 'AUTOFILL_STARTED',
  AUTOFILL_VERIFIED: 'AUTOFILL_VERIFIED',
  SUBMIT_STARTED: 'SUBMIT_STARTED',
  TRACKING_RECEIVED: 'TRACKING_RECEIVED',
  ORDER_SAVED: 'ORDER_SAVED',
  SYNCED: 'SYNCED',
  STATUS_CHANGED: 'STATUS_CHANGED',
  PRINT_JOB_CREATED: 'PRINT_JOB_CREATED',
  LABEL_PRINTED: 'LABEL_PRINTED',
  LABEL_REPRINTED: 'LABEL_REPRINTED',
  PRINT_FAILED: 'PRINT_FAILED',
  ERROR: 'ERROR'
});

export const ORDER_ACTOR_TYPES = Object.freeze({
  USER: 'USER',
  AI: 'AI',
  SYSTEM: 'SYSTEM',
  CARRIER: 'CARRIER',
  PARTNER_API: 'PARTNER_API'
});

/**
 * Compare two order states and extract minimal patch containing only modified fields.
 * @param {Object} beforeState
 * @param {Object} afterState
 * @returns {{ before_patch: Object, after_patch: Object, changed_fields: string[] }}
 */
export function calculateOrderPatch(beforeState = {}, afterState = {}) {
  const before = beforeState || {};
  const after = afterState || {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const before_patch = {};
  const after_patch = {};
  const changed_fields = [];

  for (const key of keys) {
    // Skip internal metadata fields from patch diffing
    if (key === 'updated_at' || key === 'created_at') continue;

    const valBefore = before[key];
    const valAfter = after[key];

    const isDifferent = typeof valBefore === 'object' || typeof valAfter === 'object'
      ? JSON.stringify(valBefore) !== JSON.stringify(valAfter)
      : valBefore !== valAfter;

    if (isDifferent) {
      changed_fields.push(key);
      before_patch[key] = valBefore;
      after_patch[key] = valAfter;
    }
  }

  return { before_patch, after_patch, changed_fields };
}

/**
 * Mask sensitive phone number (e.g. 0987654321 -> 098***4321).
 * @param {string} phone
 * @returns {string}
 */
export function maskPhone(phone) {
  if (!phone || typeof phone !== 'string') return phone;
  const cleaned = phone.trim();
  if (cleaned.length <= 4) return '***';
  if (cleaned.length <= 7) return `${cleaned.slice(0, 2)}***${cleaned.slice(-2)}`;
  return `${cleaned.slice(0, 3)}***${cleaned.slice(-4)}`;
}

/**
 * Mask street address while preserving higher administrative boundaries (Ward, District, Province).
 * @param {string} address
 * @returns {string}
 */
export function maskAddress(address) {
  if (!address || typeof address !== 'string') return address;
  const parts = address.split(',').map(p => p.trim());
  if (parts.length <= 1) {
    return '***';
  }
  // Mask the specific house/street part (first element) and keep administrative regions
  return `***, ${parts.slice(1).join(', ')}`;
}

/**
 * Obfuscate PII (Phone, Address, Customer Name if requested) in an order object or event patch.
 * @param {Object} data - Order object or patch object
 * @param {Object} options
 * @returns {Object} Masked clone of data
 */
export function maskOrderPII(data, options = {}) {
  if (!data || typeof data !== 'object') return data;

  const clone = JSON.parse(JSON.stringify(data));

  // If this is an event patch container with before_patch and after_patch
  if (clone.before_patch || clone.after_patch) {
    if (clone.before_patch) clone.before_patch = maskOrderPII(clone.before_patch, options);
    if (clone.after_patch) clone.after_patch = maskOrderPII(clone.after_patch, options);
    return clone;
  }

  // Handle phone fields
  const phoneKeys = ['phone', 'telephone', 'phoneNumber', 'tel', 'customerPhone', 'recipientPhone'];
  for (const pk of phoneKeys) {
    if (clone[pk] && typeof clone[pk] === 'string') {
      clone[pk] = maskPhone(clone[pk]);
    }
  }

  // Handle address fields
  const addressKeys = ['address', 'streetAddress', 'rawAddress', 'customerAddress', 'deliveryAddress'];
  for (const ak of addressKeys) {
    if (clone[ak] && typeof clone[ak] === 'string') {
      clone[ak] = maskAddress(clone[ak]);
    }
  }

  return clone;
}

/**
 * Validate order event against taxonomy invariants.
 * Mandatory invariant: Order identity must be order_id or order_code, never customer attributes.
 * @param {Object} event
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateOrderEvent(event) {
  const errors = [];
  if (!event || typeof event !== 'object') {
    return { valid: false, errors: ['Event must be a non-null object'] };
  }

  if (!event.shop_id) {
    errors.push('Missing shop_id');
  }

  if (!event.order_id && !event.order_code) {
    errors.push('Missing order identity: must provide order_id or order_code');
  }

  if (!event.event_type || !ORDER_EVENT_TYPES[event.event_type]) {
    errors.push(`Invalid event_type: ${event.event_type}`);
  }

  if (!event.actor_type || !ORDER_ACTOR_TYPES[event.actor_type]) {
    errors.push(`Invalid actor_type: ${event.actor_type}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Build a canonical OrderEvent object for appending to order_events ledger.
 * @param {Object} params
 * @returns {Object} Canonical OrderEvent
 */
export function buildOrderEvent({
  shop_id,
  order_id = null,
  order_code = null,
  event_type,
  actor_type = ORDER_ACTOR_TYPES.SYSTEM,
  actor_id = null,
  source = 'extension',
  before_state = null,
  after_state = null,
  before_patch = null,
  after_patch = null,
  metadata = {},
  created_at = null
}) {
  let finalBeforePatch = before_patch;
  let finalAfterPatch = after_patch;

  if (!finalBeforePatch && !finalAfterPatch && (before_state || after_state)) {
    const diff = calculateOrderPatch(before_state, after_state);
    finalBeforePatch = diff.before_patch;
    finalAfterPatch = diff.after_patch;
  }

  return {
    shop_id,
    order_id,
    order_code,
    event_type,
    actor_type,
    actor_id,
    source,
    before_patch: finalBeforePatch || {},
    after_patch: finalAfterPatch || {},
    metadata: metadata || {},
    created_at: created_at || new Date().toISOString()
  };
}

/**
 * Sanitize order event payload for audit log view or cross-tenant inspection.
 * Mask PII if the actor lacks full PII permissions.
 * @param {Object} event
 * @param {{ hasFullPiiAccess?: boolean }} options
 * @returns {Object} Sanitized event
 */
export function sanitizeEventForAudit(event, { hasFullPiiAccess = false } = {}) {
  if (!event || typeof event !== 'object') return event;

  if (hasFullPiiAccess) {
    return JSON.parse(JSON.stringify(event));
  }

  const sanitized = JSON.parse(JSON.stringify(event));
  if (sanitized.before_patch) {
    sanitized.before_patch = maskOrderPII(sanitized.before_patch);
  }
  if (sanitized.after_patch) {
    sanitized.after_patch = maskOrderPII(sanitized.after_patch);
  }
  if (sanitized.metadata) {
    sanitized.metadata = maskOrderPII(sanitized.metadata);
  }

  return sanitized;
}

const OrderEventTaxonomy = {
  ORDER_EVENT_TYPES,
  ORDER_ACTOR_TYPES,
  calculateOrderPatch,
  maskPhone,
  maskAddress,
  maskOrderPII,
  validateOrderEvent,
  buildOrderEvent,
  sanitizeEventForAudit
};

if (typeof globalThis !== 'undefined') {
  globalThis.OrderEventTaxonomy = OrderEventTaxonomy;
}

export default OrderEventTaxonomy;
