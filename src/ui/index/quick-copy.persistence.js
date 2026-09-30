/**
 * Quản lý lưu trữ an toàn tiến độ Quick Copy và Đơn nháp cục bộ (G013 / QC-08)
 *
 * Đảm bảo:
 * 1. Mã hóa/Obfuscation dữ liệu nháp khi lưu vào localStorage để tránh lộ PII (Tên, SĐT, Địa chỉ).
 * 2. Tự động hết hạn sau 24 giờ.
 * 3. Hỗ trợ nút xóa toàn bộ dữ liệu cục bộ an toàn.
 */

export const QUICK_COPY_STORAGE_KEY = 'af_quick_copy_v1';
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const OBFUSCATION_SALT = 0x5a;
const OBFUSCATION_PREFIX = 'enc_v1:';

/**
 * Obfuscates a plain payload into an encoded representation protecting PII in local storage.
 * @param {object} payload 
 * @returns {string}
 */
export function obfuscatePayload(payload) {
  try {
    const jsonStr = JSON.stringify(payload);
    // XOR obfuscation + base64 encoding
    const encodedChars = [];
    for (let i = 0; i < jsonStr.length; i++) {
      const code = jsonStr.charCodeAt(i) ^ OBFUSCATION_SALT;
      encodedChars.push(String.fromCharCode(code));
    }
    const b64 = (typeof btoa === 'function')
      ? btoa(unescape(encodeURIComponent(encodedChars.join(''))))
      : Buffer.from(encodedChars.join(''), 'binary').toString('base64');
    return `${OBFUSCATION_PREFIX}${b64}`;
  } catch (err) {
    console.warn('[QuickCopyPersistence] Failed to obfuscate:', err);
    return JSON.stringify(payload);
  }
}

/**
 * Deobfuscates an encoded string back to the original object.
 * @param {string} raw 
 * @returns {object|null}
 */
export function deobfuscatePayload(raw) {
  if (!raw || typeof raw !== 'string') return null;
  try {
    if (raw.startsWith(OBFUSCATION_PREFIX)) {
      const b64 = raw.slice(OBFUSCATION_PREFIX.length);
      const binaryStr = (typeof atob === 'function')
        ? decodeURIComponent(escape(atob(b64)))
        : Buffer.from(b64, 'base64').toString('binary');
      
      const chars = [];
      for (let i = 0; i < binaryStr.length; i++) {
        chars.push(String.fromCharCode(binaryStr.charCodeAt(i) ^ OBFUSCATION_SALT));
      }
      return JSON.parse(chars.join(''));
    }
    // Fallback if raw JSON exists from legacy storage
    return JSON.parse(raw);
  } catch (err) {
    console.warn('[QuickCopyPersistence] Failed to deobfuscate:', err);
    return null;
  }
}

/**
 * Lưu tiến độ Quick Copy vào localStorage dưới dạng mã hóa an toàn
 * @param {object} state 
 */
export function saveQuickCopyProgress({ parsedResult, carrier, copiedKeys, currentIndex }) {
  if (typeof localStorage === 'undefined') return;

  if (!parsedResult) {
    clearQuickCopyProgress();
    return;
  }

  const payload = {
    parsedResult,
    carrier: carrier || 'jt',
    copiedKeys: Array.isArray(copiedKeys) ? copiedKeys : Array.from(copiedKeys || []),
    currentIndex: Number(currentIndex) || 0,
    updatedAt: Date.now()
  };

  try {
    const encoded = obfuscatePayload(payload);
    localStorage.setItem(QUICK_COPY_STORAGE_KEY, encoded);
  } catch (err) {
    console.warn('[QuickCopyPersistence] Failed to save progress:', err);
  }
}

/**
 * Tải lại tiến độ Quick Copy từ localStorage (nếu chưa quá 24h)
 * @returns {object|null}
 */
export function loadQuickCopyProgress() {
  if (typeof localStorage === 'undefined') return null;

  try {
    const raw = localStorage.getItem(QUICK_COPY_STORAGE_KEY);
    if (!raw) return null;

    const data = deobfuscatePayload(raw);
    if (!data || !data.parsedResult || !data.updatedAt) {
      clearQuickCopyProgress();
      return null;
    }

    // Kiểm tra hết hạn 24 giờ
    const age = Date.now() - data.updatedAt;
    if (age > TWENTY_FOUR_HOURS_MS || age < 0) {
      clearQuickCopyProgress();
      return null;
    }

    return {
      parsedResult: data.parsedResult,
      carrier: data.carrier || 'jt',
      copiedKeys: new Set(data.copiedKeys || []),
      currentIndex: Number(data.currentIndex) || 0
    };
  } catch (err) {
    console.warn('[QuickCopyPersistence] Failed to parse stored progress:', err);
    clearQuickCopyProgress();
    return null;
  }
}

/**
 * Xóa dữ liệu tiến độ Quick Copy
 */
export function clearQuickCopyProgress() {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(QUICK_COPY_STORAGE_KEY);
  } catch (_) {}
}

/**
 * Xóa toàn bộ dữ liệu đơn nháp và phiên làm việc cục bộ (Wipe Data)
 */
export function clearAllLocalDrafts() {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(QUICK_COPY_STORAGE_KEY);
    localStorage.removeItem('draft_queue');
    localStorage.removeItem('draft_queue_updated_at');
    localStorage.removeItem('draft_orders_backup');
  } catch (_) {}
}
