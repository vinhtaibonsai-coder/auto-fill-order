// =========================================================================
// ORDER EVENT PERSISTENCE & AUDIT SERVICE (EPIC B)
// Connects UI, parsing, AI normalization, and carrier submission to the
// append-only order_events ledger in Supabase.
// =========================================================================

import { 
  ORDER_EVENT_TYPES, 
  ORDER_ACTOR_TYPES, 
  calculateOrderPatch, 
  maskOrderPII, 
  validateOrderEvent 
} from './order-event.taxonomy.js';

/**
 * Ghi nhận một sự kiện vòng đời đơn hàng vào bảng append-only order_events
 * Tuân thủ tuyệt đối:
 * - Repeat Customer Invariant: Khóa nhận diện là order_id hoặc order_code, không dùng Tên/SĐT
 * - Server RBAC / Security Definer qua RPC append_order_event
 * - Non-blocking: Lỗi mạng hoặc RPC thất bại không bao giờ làm gián đoạn luồng autofill/submit
 */
export async function recordOrderEvent({
  shopId = null,
  orderId = null,
  orderCode = null,
  eventType = ORDER_EVENT_TYPES.ORDER_PARSED,
  actorType = ORDER_ACTOR_TYPES.SYSTEM,
  source = 'extension',
  beforeState = null,
  afterState = null,
  beforePatch = null,
  afterPatch = null,
  metadata = {}
}) {
  try {
    // 1. Tự động lấy shopId từ OrderStorage nếu chưa truyền
    let resolvedShopId = shopId;
    if (!resolvedShopId) {
      const storage = typeof OrderStorage !== 'undefined' ? OrderStorage : (globalThis.OrderStorage || null);
      if (storage && typeof storage.getActiveShop === 'function') {
        const s = await storage.getActiveShop().catch(() => null);
        resolvedShopId = s ? (s.id || s) : null;
      }
    }

    if (!resolvedShopId) {
      // Fallback shop ID nếu chưa cấu hình shop
      resolvedShopId = 'c201e6bc-8986-4f91-b900-e319865d1907';
    }

    const cleanOrderId = orderId ? String(orderId).trim() : null;
    const cleanOrderCode = orderCode ? String(orderCode).trim() : null;

    if (!cleanOrderId && !cleanOrderCode) {
      console.warn('[OrderEventService] Skip logging: orderId and orderCode are both empty.');
      return { ok: false, reason: 'ORDER_IDENTITY_MISSING' };
    }

    // 2. Tính toán patch nếu có beforeState & afterState
    let finalBeforePatch = beforePatch || {};
    let finalAfterPatch = afterPatch || {};

    if (beforeState && afterState && (!beforePatch || !afterPatch)) {
      const patch = calculateOrderPatch(beforeState, afterState);
      finalBeforePatch = patch.before_patch;
      finalAfterPatch = patch.after_patch;
    }

    // 3. Che thông tin PII nhạy cảm trong event log
    finalBeforePatch = maskOrderPII(finalBeforePatch);
    finalAfterPatch = maskOrderPII(finalAfterPatch);

    const payload = {
      p_shop_id: resolvedShopId,
      p_order_id: cleanOrderId || cleanOrderCode,
      p_order_code: cleanOrderCode || cleanOrderId,
      p_event_type: eventType,
      p_actor_type: actorType,
      p_source: source,
      p_before_patch: finalBeforePatch,
      p_after_patch: finalAfterPatch,
      p_metadata: metadata || {}
    };

    // 4. Kiểm tra hợp lệ theo taxonomy
    const validation = validateOrderEvent({
      shop_id: payload.p_shop_id,
      order_id: payload.p_order_id,
      order_code: payload.p_order_code,
      event_type: payload.p_event_type,
      actor_type: payload.p_actor_type
    });

    if (!validation.valid) {
      console.warn('[OrderEventService] Validation failed:', validation.errors);
      return { ok: false, errors: validation.errors };
    }

    // 5. Gửi lên Supabase qua RPC append_order_event
    const clientCloud = typeof SupabaseCloud !== 'undefined' ? SupabaseCloud : (globalThis.SupabaseCloud || null);
    if (clientCloud && typeof clientCloud.rpc === 'function') {
      const res = await clientCloud.rpc('append_order_event', payload);
      return { ok: true, data: res };
    }

    // Nếu offline hoặc môi trường mock
    return { ok: true, offline: true, payload };
  } catch (err) {
    console.warn('[OrderEventService] Failed to append order event (silent catch):', err);
    return { ok: false, error: err.message };
  }
}

// Gắn global helper để các script runtime / content-script gọi được ngay
if (typeof globalThis !== 'undefined') {
  globalThis.recordOrderEvent = recordOrderEvent;
}
