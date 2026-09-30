// =========================================================================
// OFFICIAL SOCIAL CHANNELS ADAPTER (META MESSENGER & ZALO OA) (EPIC D)
// =========================================================================

import { sha256Hex, hmacSha256Hex, timingSafeEqualHex } from '../../infrastructure/crypto/isomorphic-crypto.js';
import { parseOrderText } from '../../application/order-parser/core-parser.js';

/**
 * Đánh giá tính khả dụng của kênh kết nối (Fail-closed khi chưa được cấp quyền chính thức)
 */
export function evaluateSocialChannelCapability(connection = {}) {
  if (!connection || connection.status !== 'ACTIVE') {
    return {
      canIngest: false,
      canSendReply: false,
      statusLabel: 'Unavailable / Needs approval',
      reason: 'Kênh chưa được cấp quyền từ Meta/Zalo hoặc đang chờ quản trị viên duyệt.'
    };
  }

  return {
    canIngest: true,
    canSendReply: Array.isArray(connection.scopes) && connection.scopes.includes('messages:reply'),
    statusLabel: 'Active'
  };
}

/**
 * Xác minh chữ ký Webhook Meta Messenger Platform (X-Hub-Signature-256)
 * Chống Timing Attacks qua timingSafeEqualHex
 */
export function verifyMetaSignature(payloadString, signatureHeader, appSecret) {
  if (!payloadString || !signatureHeader || !appSecret) return false;

  const parts = String(signatureHeader).split('=');
  if (parts.length !== 2 || parts[0] !== 'sha256') return false;

  const expectedSignatureHex = hmacSha256Hex(appSecret, payloadString);
  return timingSafeEqualHex(expectedSignatureHex, parts[1]);
}

/**
 * Xác minh chữ ký Webhook Zalo Official Account & Chống Replay Attack (5 phút)
 */
export function verifyZaloSignature(payloadString, signatureHeader, oaSecretKey, timestamp) {
  if (!payloadString || !signatureHeader || !oaSecretKey || !timestamp) return false;

  // Replay window check: tối đa 300 giây (5 phút)
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - Number(timestamp)) > 300) {
    return false;
  }

  const expectedMac = sha256Hex(oaSecretKey + payloadString + timestamp);
  return timingSafeEqualHex(expectedMac, String(signatureHeader));
}

/**
 * Chuyển tin nhắn mạng xã hội thành bản nháp đơn hàng
 * Invariant: Bảo đảm khách mua lặp lại luôn nhận order_code MỚI, không bao giờ ghi đè đơn cũ.
 */
export async function createDraftFromSocialMessage(message = {}, shopId = 'default') {
  const parsedResult = await parseOrderText(message.text || '', { shopId });
  const orderData = parsedResult.order || parsedResult;

  // Tạo order_code duy nhất cho đơn mới
  const uniqueSuffix = `${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`;
  const orderCode = `SOC-${uniqueSuffix}`;

  return {
    ...orderData,
    order_code: orderCode,
    source: message.provider || 'SOCIAL_INBOX',
    source_ref: message.external_message_id || null,
    customer_ref: message.customer_ref || null,
    phone: orderData.phone || '',
    name: orderData.name || '',
    address: orderData.address || '',
    codAmount: orderData.codAmount || 0,
    created_at: new Date().toISOString()
  };
}
