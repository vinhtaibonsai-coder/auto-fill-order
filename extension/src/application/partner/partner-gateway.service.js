// =========================================================================
// PARTNER API & MCP GATEWAY SERVICE (EPIC G)
// =========================================================================

import { getRandomHex, sha256Hex } from '../../infrastructure/crypto/isomorphic-crypto.js';
import { parseOrderText, normalizeAddress } from '../order-parser/core-parser.js';

/**
 * Tạo API key mới cho đối tác / developer
 * Invariant: Key bí mật chỉ hiển thị MỘT LẦN cho client, cơ sở dữ liệu chỉ lưu SHA-256 hash và prefix.
 */
export function generatePartnerApiKey() {
  const randomEntropy = getRandomHex(24);
  const rawKey = `ak_live_${randomEntropy}`;
  const prefix = `ak_live_${randomEntropy.substring(0, 6)}...`;
  const hash = hashPartnerApiKey(rawKey);

  return {
    rawKey,
    prefix,
    hash
  };
}

/**
 * Tính mã băm SHA-256 an toàn của API key
 */
export function hashPartnerApiKey(secretKey) {
  if (!secretKey) return '';
  return sha256Hex(String(secretKey).trim());
}

/**
 * Xác thực tính hợp lệ của request đối tác (Status, Expiry, Scope, Quota)
 */
export function validatePartnerRequest(client = {}, requiredScope = '') {
  if (!client || client.status !== 'ACTIVE') {
    return {
      allowed: false,
      code: 401,
      error: 'KEY_REVOKED',
      message: 'API Key đã bị vô hiệu hóa hoặc không tồn tại.'
    };
  }

  if (client.expires_at) {
    const expiryTime = new Date(client.expires_at).getTime();
    if (!Number.isNaN(expiryTime) && expiryTime < Date.now()) {
      return {
        allowed: false,
        code: 401,
        error: 'KEY_EXPIRED',
        message: 'API Key đã hết thời hạn sử dụng.'
      };
    }
  }

  if (requiredScope && (!Array.isArray(client.scopes) || !client.scopes.includes(requiredScope))) {
    return {
      allowed: false,
      code: 403,
      error: 'INSUFFICIENT_SCOPE',
      message: `API Key không có quyền thực thi thao tác yêu cầu: ${requiredScope}`
    };
  }

  const quota = client.monthly_quota || 1000;
  const usage = client.monthly_usage || 0;
  if (usage >= quota) {
    return {
      allowed: false,
      code: 429,
      error: 'QUOTA_EXCEEDED',
      message: `Hạn ngạch API tháng này đã hết (${usage}/${quota} lượt). Vui lòng nâng cấp gói cước.`
    };
  }

  return {
    allowed: true
  };
}

/**
 * Thực thi tool bóc tách / chuẩn hóa dùng chung giữa REST API /v1 và MCP Gateway
 */
export async function executePartnerTool(toolName, params = {}) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  switch (toolName) {
    case 'parse_order':
    case 'order_parse_text': {
      const rawText = String(params.raw_text || '').trim();
      const parsedResult = await parseOrderText(rawText, params);
      const order = parsedResult.order || parsedResult;
      return {
        request_id: requestId,
        data: order,
        warnings: parsedResult.warnings || [],
        confidence: parsedResult.confidence?.overall || parsedResult.confidence || 95,
        usage: {
          units: 1,
          tool: 'parse_order'
        }
      };
    }

    case 'normalize_vietnamese_address':
    case 'address_normalize': {
      const addr = String(params.address || '').trim();
      const normalized = normalizeAddress(addr, params.phone);
      return {
        request_id: requestId,
        data: normalized,
        warnings: [],
        confidence: 95,
        usage: {
          units: 1,
          tool: 'normalize_vietnamese_address'
        }
      };
    }

    case 'validate_order': {
      const order = params.order || {};
      const errors = [];
      if (!order.phone) errors.push('Thiếu số điện thoại người nhận');
      if (!order.address) errors.push('Thiếu địa chỉ người nhận');

      return {
        request_id: requestId,
        data: {
          valid: errors.length === 0,
          errors
        },
        warnings: [],
        confidence: 100,
        usage: {
          units: 1,
          tool: 'validate_order'
        }
      };
    }

    default:
      throw new Error(`Tool không được hỗ trợ: ${toolName}`);
  }
}
