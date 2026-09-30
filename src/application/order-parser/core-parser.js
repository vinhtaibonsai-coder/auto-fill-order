// =========================================================================
// CORE ORDER PARSER & ADDRESS NORMALIZATION INTERFACE (UNIFIED SEAM)
// =========================================================================

import './parser.js';
import '../address/normalizer.js';
import '../address/parser.js';
import '../address/engine.js';
import { parseCache } from '../cache/parse-cache.js';

/**
 * Trích xuất các thực thể cơ bản từ văn bản đơn hàng (Tên, SĐT, Địa chỉ, COD, Note, SKU)
 */
export async function parseOrderText(rawText, options = {}) {
  const startMs = Date.now();
  if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
    return {
      order: {
        name: '',
        phone: '',
        address: '',
        orderCode: '',
        codAmount: 0,
        weight: options.defaultWeight || 200,
        notes: ''
      },
      confidence: { overall: 0, name: 0, phone: 0, address: 0, cod: 0 },
      warnings: ['Văn bản rỗng'],
      source: 'local',
      durationMs: 0
    };
  }

  const shopId = options.shopId || 'default';
  if (options.useCache !== false) {
    const cached = await parseCache.get(rawText, shopId).catch(() => null);
    if (cached) {
      return {
        order: {
          name: cached.name || '',
          phone: cached.phone || '',
          address: cached.address || cached.correctAddress || '',
          orderCode: cached.orderCode || '',
          codAmount: cached.codAmount || 0,
          weight: cached.weight || options.defaultWeight || 200,
          notes: cached.extraNote || cached.notes || '',
          province: cached.province || '',
          district: cached.district || '',
          ward: cached.ward || '',
          street: cached.street || ''
        },
        confidence: cached.confidence || { overall: 0.95, name: 0.95, phone: 0.98, address: 0.95, cod: 0.99 },
        warnings: cached.warnings || [],
        source: 'cache',
        durationMs: Date.now() - startMs
      };
    }
  }

  const parser = globalThis.OrderProcessor;
  let parsed = null;
  if (parser && typeof parser.parse === 'function') {
    parsed = parser.parse(rawText);
  } else {
    parsed = { name: '', phone: '', address: '', orderCode: '', codAmount: 0, extraNote: '' };
  }

  const warnings = [];
  const nameVal = String(parsed.name || '').trim();
  const phoneVal = String(parsed.phone || '').trim();
  const addrVal = (parsed.address && parsed.address !== 'không tìm thấy') ? String(parsed.address).trim() : '';
  const codVal = Number(parsed.codAmount || 0);

  if (!nameVal) warnings.push('Thiếu tên khách hàng');
  if (!phoneVal) warnings.push('Thiếu số điện thoại');
  if (!addrVal) warnings.push('Thiếu địa chỉ phát hàng');

  const confName = nameVal ? (nameVal.length >= 2 ? 0.95 : 0.6) : 0;
  const confPhone = phoneVal ? (phoneVal.replace(/\D/g, '').length === 10 ? 0.99 : 0.7) : 0;
  const confAddr = addrVal ? (addrVal.length > 10 ? 0.9 : 0.5) : 0;
  const confCod = !isNaN(codVal) ? 0.95 : 0;
  const overall = Number(((confName + confPhone + confAddr + confCod) / 4).toFixed(2));

  const result = {
    order: {
      name: nameVal,
      phone: phoneVal,
      address: addrVal,
      orderCode: String(parsed.orderCode || '').trim(),
      codAmount: codVal,
      weight: options.defaultWeight || 200,
      notes: String(parsed.extraNote || parsed.notes || '').trim()
    },
    confidence: {
      overall,
      name: confName,
      phone: confPhone,
      address: confAddr,
      cod: confCod
    },
    warnings,
    source: 'local',
    durationMs: Date.now() - startMs
  };

  if (options.useCache !== false && overall >= 0.8) {
    await parseCache.set(rawText, shopId, result.order).catch(() => {});
  }

  return result;
}

/**
 * Chuẩn hóa địa chỉ (nhận diện 2 cấp / 3 cấp, tỉnh/thành, quận/huyện, phường/xã, đường)
 */
export async function normalizeAddress(addressString, options = {}) {
  const startMs = Date.now();
  const cleanAddr = String(addressString || '').trim();
  if (!cleanAddr || cleanAddr === 'không tìm thấy') {
    return {
      province: '',
      district: '',
      ward: '',
      street: '',
      normalized: '',
      confidence: 0,
      durationMs: 0
    };
  }

  let province = '';
  let district = '';
  let ward = '';
  let street = cleanAddr;
  let normalized = cleanAddr;
  let confidence = 0.8;

  // 1. Dùng AddressEngine nếu có sẵn
  if (globalThis.AddressEngine && typeof globalThis.AddressEngine.process === 'function') {
    try {
      const res = await globalThis.AddressEngine.process(cleanAddr, options.phone || '');
      if (res) {
        normalized = res.fullAddress || normalized;
        province = res.province || '';
        district = res.district || '';
        ward = res.ward || '';
        street = res.street || street;
        confidence = res.confidence ? (res.confidence / 100) : 0.9;
      }
    } catch (_) {}
  }

  // 2. Fallback sang AddressParser.parse
  if (!province && globalThis.AddressParser && typeof globalThis.AddressParser.parse === 'function') {
    try {
      const p = globalThis.AddressParser.parse(cleanAddr);
      if (p) {
        province = p.province || province;
        district = p.district || district;
        ward = p.ward || ward;
        street = p.street || street;
        normalized = [street, ward, district, province].filter(Boolean).join(', ');
        confidence = province && (district || ward) ? 0.95 : 0.7;
      }
    } catch (_) {}
  }

  return {
    province,
    district,
    ward,
    street,
    normalized,
    confidence,
    durationMs: Date.now() - startMs
  };
}

/**
 * Bóc tách toàn diện văn bản đơn hàng và tự động chuẩn hóa địa giới hành chính
 */
export async function parseAndNormalize(rawText, options = {}) {
  const parseRes = await parseOrderText(rawText, options);
  if (parseRes.order.address) {
    const addrRes = await normalizeAddress(parseRes.order.address, options);
    parseRes.order.province = addrRes.province;
    parseRes.order.district = addrRes.district;
    parseRes.order.ward = addrRes.ward;
    parseRes.order.street = addrRes.street;
    if (addrRes.normalized) {
      parseRes.order.normalizedAddress = addrRes.normalized;
    }
  }
  return parseRes;
}
