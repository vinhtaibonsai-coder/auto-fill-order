// =========================================================================
// PARSE CACHE MODULE (Deterministic SHA-256 Text & Shop Scoped Cache)
// =========================================================================

const PARSER_VERSION = '1.0.2';
const DEFAULT_TTL_MS = 2 * 60 * 60 * 1000; // 2 giờ
const MAX_MEMORY_ITEMS = 500;

class ParseCache {
  constructor(options = {}) {
    this.ttlMs = options.ttlMs || DEFAULT_TTL_MS;
    this.memoryMap = new Map(); // key -> { result, expiresAt, hits, timestamp }
  }

  // Universal SHA-256 hasher (sử dụng Web Crypto API chuẩn trên cả browser và Node 19+)
  async computeHash(rawText, shopId = 'default') {
    const normalized = String(rawText || '').trim().toLowerCase();
    const strToHash = `${normalized}::${shopId || 'default'}::v${PARSER_VERSION}`;
    
    const subtle = (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle)
      ? globalThis.crypto.subtle
      : (typeof crypto !== 'undefined' && crypto.subtle ? crypto.subtle : null);

    if (subtle && typeof subtle.digest === 'function') {
      const encoder = new TextEncoder();
      const data = encoder.encode(strToHash);
      const hashBuffer = await subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
    }
    
    // Deterministic fallback hash for environments without crypto.subtle
    let h1 = 0xdeadbeef, h2 = 0x41c64e6d;
    for (let i = 0; i < strToHash.length; i++) {
      const ch = strToHash.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    const p1 = (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(16, '0');
    const p2 = (4294967296 * (2097151 & h1) + (h2 >>> 0)).toString(16).padStart(16, '0');
    return (p1 + p2).slice(0, 32);
  }

  async get(rawText, shopId = 'default') {
    if (!rawText || typeof rawText !== 'string' || !rawText.trim()) return null;
    const key = await this.computeHash(rawText, shopId);
    const now = Date.now();

    // 1. Kiểm tra In-Memory LRU Map trước (Latency < 1ms)
    const inMem = this.memoryMap.get(key);
    if (inMem) {
      if (inMem.expiresAt > now) {
        inMem.hits = (inMem.hits || 0) + 1;
        return { ...inMem.result, _fromCache: true, _cacheHitTimeMs: 0 };
      }
      this.memoryMap.delete(key);
    }

    // 2. Kiểm tra chrome.storage.local nếu có
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const storageKey = `parse_cache_${key}`;
      try {
        const stored = await new Promise(resolve => {
          chrome.storage.local.get([storageKey], res => resolve(res ? res[storageKey] : null));
        });
        if (stored && stored.expiresAt > now) {
          this._setMemory(key, stored.result, stored.expiresAt);
          return { ...stored.result, _fromCache: true };
        } else if (stored) {
          chrome.storage.local.remove(storageKey);
        }
      } catch (_) {}
    }

    return null;
  }

  async set(rawText, shopId = 'default', result, customTtlMs = null) {
    if (!rawText || !result) return;
    const key = await this.computeHash(rawText, shopId);
    const ttl = customTtlMs || this.ttlMs;
    const expiresAt = Date.now() + ttl;

    this._setMemory(key, result, expiresAt);

    // Lưu vào chrome.storage.local
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const storageKey = `parse_cache_${key}`;
      try {
        chrome.storage.local.set({
          [storageKey]: {
            result,
            expiresAt,
            timestamp: Date.now(),
            shopId
          }
        });
      } catch (_) {}
    }
  }

  _setMemory(key, result, expiresAt) {
    if (this.memoryMap.size >= MAX_MEMORY_ITEMS) {
      const firstKey = this.memoryMap.keys().next().value;
      this.memoryMap.delete(firstKey);
    }
    this.memoryMap.set(key, { result, expiresAt, hits: 0, timestamp: Date.now() });
  }

  // Image cache methods (giảm gọi lại OCR/Gemini khi upload cùng ảnh)
  async getImage(imageBase64, shopId = 'default') {
    if (!imageBase64 || typeof imageBase64 !== 'string') return null;
    const cleanImg = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
    const key = await this.computeHash(cleanImg, shopId);
    const imgKey = `img_${key}`;

    const inMem = this.memoryMap.get(imgKey);
    const now = Date.now();
    if (inMem) {
      if (inMem.expiresAt > now) {
        inMem.hits = (inMem.hits || 0) + 1;
        return { ...inMem.result, _fromCache: true, imageThumbnail: imageBase64 };
      }
      this.memoryMap.delete(imgKey);
    }

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const storageKey = `parse_cache_${imgKey}`;
      try {
        const stored = await new Promise(resolve => {
          chrome.storage.local.get([storageKey], res => resolve(res ? res[storageKey] : null));
        });
        if (stored && stored.expiresAt > now) {
          this._setMemory(imgKey, stored.result, stored.expiresAt);
          return { ...stored.result, _fromCache: true, imageThumbnail: imageBase64 };
        } else if (stored) {
          chrome.storage.local.remove(storageKey);
        }
      } catch (_) {}
    }
    return null;
  }

  async setImage(imageBase64, shopId = 'default', result, customTtlMs = null) {
    if (!imageBase64 || !result) return;
    const cleanImg = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
    const key = await this.computeHash(cleanImg, shopId);
    const imgKey = `img_${key}`;
    const ttl = customTtlMs || this.ttlMs;
    const expiresAt = Date.now() + ttl;

    // Không lưu chuỗi base64 khổng lồ vào chrome storage để tiết kiệm bộ nhớ
    const sanitized = { ...result };
    delete sanitized.imageThumbnail;

    this._setMemory(imgKey, sanitized, expiresAt);

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const storageKey = `parse_cache_${imgKey}`;
      try {
        chrome.storage.local.set({
          [storageKey]: {
            result: sanitized,
            expiresAt,
            timestamp: Date.now(),
            shopId
          }
        });
      } catch (_) {}
    }
  }

  // Evict expired cache entries from memory and chrome.storage.local
  async evictExpiredKeys() {
    const now = Date.now();
    let evictedCount = 0;

    // 1. Evict in-memory map
    for (const [key, item] of this.memoryMap.entries()) {
      if (item.expiresAt <= now) {
        this.memoryMap.delete(key);
        evictedCount++;
      }
    }

    // 2. Evict chrome.storage.local
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      try {
        const allItems = await new Promise(resolve => {
          chrome.storage.local.get(null, resolve);
        });
        if (allItems) {
          const keysToRemove = [];
          for (const [k, v] of Object.entries(allItems)) {
            if (k.startsWith('parse_cache_') && v && v.expiresAt && v.expiresAt <= now) {
              keysToRemove.push(k);
            }
          }
          if (keysToRemove.length > 0) {
            await chrome.storage.local.remove(keysToRemove);
            evictedCount += keysToRemove.length;
          }
        }
      } catch (_) {}
    }

    return evictedCount;
  }

  clearMemory() {
    this.memoryMap.clear();
  }
}

export const parseCache = new ParseCache();
export { ParseCache, PARSER_VERSION };
