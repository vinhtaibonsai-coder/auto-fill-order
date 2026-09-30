// =========================================================================
// IMAGE ASSET & FIELD EXTRACTION RUNTIME SERVICE (EPIC E)
// Persists image assets and field extractions with per-field confidence
// into Supabase (order_image_assets & field_extractions tables).
// =========================================================================

import { sha256Hex } from '../../infrastructure/crypto/isomorphic-crypto.js';
import { recordOrderEvent } from '../order/order-event.service.js';

/**
 * Lưu trữ ảnh và danh sách bóc tách trường vào cơ sở dữ liệu
 */
export async function persistImageOrderExtractions({
  shopId = null,
  imageRaw = null,
  imageSha256 = null,
  storagePath = null,
  extractedFields = {}
}) {
  try {
    // 1. Resolve Shop ID
    let resolvedShopId = shopId;
    if (!resolvedShopId) {
      const storage = typeof OrderStorage !== 'undefined' ? OrderStorage : (globalThis.OrderStorage || null);
      if (storage && typeof storage.getActiveShop === 'function') {
        const s = await storage.getActiveShop().catch(() => null);
        resolvedShopId = s ? (s.id || s) : null;
      }
    }

    if (!resolvedShopId) {
      resolvedShopId = 'c201e6bc-8986-4f91-b900-e319865d1907';
    }

    // 2. Tính SHA-256 của ảnh để chống trùng lặp tài sản
    let finalSha = imageSha256;
    if (!finalSha && imageRaw) {
      finalSha = sha256Hex(imageRaw);
    }
    if (!finalSha) {
      finalSha = 'img_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    }

    // 3. Chuẩn hóa payload trường dữ liệu (fields array)
    const fieldsPayload = [];
    const fieldKeys = ['name', 'phone', 'address', 'ward', 'province', 'cod', 'order_code', 'product'];

    for (const key of fieldKeys) {
      const fieldData = extractedFields[key] || extractedFields[key.replace('_', '')] || null;
      if (fieldData) {
        fieldsPayload.push({
          field_name: key,
          raw_value: String(fieldData.rawValue || fieldData.value || fieldData || ''),
          normalized_value: String(fieldData.normalizedValue || fieldData.value || fieldData || ''),
          confidence: Number(fieldData.confidence !== undefined ? fieldData.confidence : 0.90),
          source: fieldData.source || 'OCR'
        });
      }
    }

    // 4. Gọi RPC record_image_order_extractions trong Database
    const clientCloud = typeof SupabaseCloud !== 'undefined' ? SupabaseCloud : (globalThis.SupabaseCloud || null);
    if (clientCloud && typeof clientCloud.rpc === 'function') {
      const res = await clientCloud.rpc('record_image_order_extractions', {
        p_shop_id: resolvedShopId,
        p_sha256: finalSha,
        p_storage_path: storagePath || `images/${resolvedShopId}/${finalSha}.jpg`,
        p_mime_type: 'image/jpeg',
        p_file_size: imageRaw ? imageRaw.length : 0,
        p_fields: fieldsPayload
      });

      // Ghi nhật ký vào Order Events Ledger
      recordOrderEvent({
        shopId: resolvedShopId,
        orderId: `img_order_${finalSha.slice(0, 12)}`,
        orderCode: extractedFields.orderCode || extractedFields.order_code || '',
        eventType: 'ORDER_PARSED',
        actorType: 'AI',
        source: 'image_ocr_pipeline',
        metadata: {
          asset_id: res?.asset_id,
          fields_recorded: res?.fields_recorded,
          sha256: finalSha
        }
      }).catch(() => {});

      return { success: true, asset_id: res?.asset_id, sha256: finalSha };
    }

    return { success: true, offline: true, sha256: finalSha };
  } catch (err) {
    console.warn('[ImageExtractionService] Persist failed (silent catch):', err);
    return { success: false, error: err.message };
  }
}

/**
 * Xác nhận hoặc hiệu chỉnh trường dữ liệu bóc tách qua RPC confirm_field_extraction
 */
export async function confirmFieldExtractionServer({
  extractionId,
  shopId,
  confirmedValue,
  reviewStatus = 'CONFIRMED'
}) {
  if (!extractionId) return { success: false, error: 'EXTRACTION_ID_REQUIRED' };

  try {
    const clientCloud = typeof SupabaseCloud !== 'undefined' ? SupabaseCloud : (globalThis.SupabaseCloud || null);
    if (clientCloud && typeof clientCloud.rpc === 'function') {
      const res = await clientCloud.rpc('confirm_field_extraction', {
        p_extraction_id: extractionId,
        p_shop_id: shopId,
        p_confirmed_value: confirmedValue,
        p_review_status: reviewStatus
      });
      return res || { success: true };
    }
    return { success: true, offline: true };
  } catch (err) {
    console.warn('[ImageExtractionService] Confirm field error:', err);
    return { success: false, error: err.message };
  }
}
