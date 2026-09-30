/**
 * Provider Resilience Engine - Quản lý Độ Phục Hồi, Circuit Breaker,
 * Exponential Backoff với Jitter và Chuỗi Dự Phòng (Fallback Chain) cho các nhà cung cấp AI.
 * (Gemini / Groq / Grok / OpenAI)
 */

export const ERROR_CLASSES = {
  RATE_LIMITED: 'RATE_LIMITED',
  UNAVAILABLE: 'UNAVAILABLE',
  TIMEOUT: 'TIMEOUT',
  INVALID_AUTH: 'INVALID_AUTH',
  INVALID_REQUEST: 'INVALID_REQUEST',
  SERVER_ERROR: 'SERVER_ERROR',
  UNKNOWN: 'UNKNOWN'
};

/**
 * Phân loại mã lỗi hoặc nội dung lỗi thành các nhóm sự cố chuẩn hóa
 * @param {number|null} status - HTTP Status Code
 * @param {string|Error} error - Thông báo lỗi hoặc body
 * @returns {string} Error class
 */
export function classifyError(status, error = '') {
  const errStr = typeof error === 'string' ? error : (error?.message || '');

  if (status === 429 || /exhausted|rate[- ]?limit|quota/i.test(errStr)) {
    return ERROR_CLASSES.RATE_LIMITED;
  }
  if (status === 503 || status === 502 || status === 504 || /unavailable|overloaded|bad gateway/i.test(errStr)) {
    return ERROR_CLASSES.UNAVAILABLE;
  }
  if (status === 408 || /abort|timeout|timed? out/i.test(errStr)) {
    return ERROR_CLASSES.TIMEOUT;
  }
  if (status === 401 || status === 403 || /invalid key|not valid|unauthorized|forbidden|api_key/i.test(errStr)) {
    return ERROR_CLASSES.INVALID_AUTH;
  }
  if (status === 400 || /invalid input|bad request/i.test(errStr)) {
    return ERROR_CLASSES.INVALID_REQUEST;
  }
  if (typeof status === 'number' && status >= 500 && status < 600) {
    return ERROR_CLASSES.SERVER_ERROR;
  }

  return ERROR_CLASSES.UNKNOWN;
}

/**
 * Xác định xem lỗi có được phép thử lại (retry) hữu hạn hay không
 * 429, 502, 503, 504, 408 -> Cho phép thử lại
 * 400, 401, 403, 404 -> CẤM thử lại mù
 * @param {number} status
 * @returns {boolean}
 */
export function shouldRetry(status) {
  if (typeof status !== 'number') return false;
  if ([400, 401, 403, 404].includes(status)) {
    return false;
  }
  if ([429, 502, 503, 504, 408].includes(status)) {
    return true;
  }
  return status >= 500 && status < 600;
}

/**
 * Tính toán thời gian chờ Backoff lũy thừa kèm Jitter ngẫu nhiên
 * @param {number} attempt - Lần thử lại (0, 1, 2...)
 * @param {number} baseMs - Thời gian cơ bản (mặc định 300ms)
 * @param {number} capMs - Thời gian tối đa (mặc định 2000ms)
 * @returns {number} Thời gian chờ tính bằng ms
 */
export function calculateBackoffWithJitter(attempt, baseMs = 300, capMs = 2000) {
  const exp = Math.min(capMs, baseMs * Math.pow(2, attempt));
  const jitter = Math.random() * (baseMs * 0.5);
  return Math.min(capMs + (baseMs * 0.5), Math.round(exp + jitter));
}

/**
 * In-Memory Circuit Breaker quản lý trạng thái độc lập theo từng nhà cung cấp
 * (CLOSED -> OPEN -> HALF-OPEN -> CLOSED)
 */
export class ProviderCircuitBreaker {
  constructor({ failureThreshold = 2, cooldownMs = 60000 } = {}) {
    this.failureThreshold = failureThreshold;
    this.cooldownMs = cooldownMs;
    this.states = new Map();
  }

  _getState(provider) {
    const key = (provider || 'default').toLowerCase();
    if (!this.states.has(key)) {
      this.states.set(key, {
        consecutiveFailures: 0,
        openedAt: 0
      });
    }
    return this.states.get(key);
  }

  isOpen(provider) {
    const state = this._getState(provider);
    if (state.openedAt === 0) return false;
    const elapsed = Date.now() - state.openedAt;
    if (elapsed >= this.cooldownMs) {
      // Half-Open: cho phép 1 probe request lọt qua để thăm dò sức khỏe
      return false;
    }
    return true;
  }

  recordSuccess(provider) {
    const state = this._getState(provider);
    state.consecutiveFailures = 0;
    state.openedAt = 0;
  }

  recordFailure(provider, status) {
    const state = this._getState(provider);
    if (shouldRetry(status) || status === 503 || status === 429) {
      state.consecutiveFailures++;
      if (state.consecutiveFailures >= this.failureThreshold) {
        state.openedAt = Date.now();
      }
    }
  }
}

/**
 * Thực thi chuỗi gọi AI tự động chuyển tiếp nhà cung cấp (Fallback Chain)
 * @param {Array<Object>} providers - Danh sách cấu hình và hàm gọi: [{ provider, model, call }]
 * @param {Object} options
 * @returns {Promise<Object>}
 */
export async function executeWithFallbackChain(providers = [], options = {}) {
  const {
    maxRetriesPerProvider = 1,
    circuitBreaker = new ProviderCircuitBreaker()
  } = options;

  let lastError = null;

  for (let i = 0; i < providers.length; i++) {
    const p = providers[i];
    const providerName = (p.provider || 'unknown').toLowerCase();

    // 1. Kiểm tra Circuit Breaker trước khi gọi
    if (circuitBreaker.isOpen(providerName)) {
      continue;
    }

    let providerSuccess = false;
    let providerData = null;

    // 2. Vòng lặp Retry hữu hạn cho từng provider
    for (let attempt = 0; attempt <= maxRetriesPerProvider; attempt++) {
      let resp = null;
      let callError = null;

      try {
        resp = await p.call();
      } catch (err) {
        callError = err;
      }

      if (resp && resp.ok) {
        circuitBreaker.recordSuccess(providerName);
        providerSuccess = true;
        providerData = resp.data || resp.result;
        break;
      }

      const status = resp ? resp.status : (callError?.name === 'AbortError' ? 408 : 503);
      const errorMsg = resp?.errorBody || callError?.message || 'Upstream Error';
      circuitBreaker.recordFailure(providerName, status);
      lastError = { provider: providerName, status, errorMsg };

      // Nếu gặp lỗi cấm thử lại (400, 401, 403, 404), dừng retry của provider này ngay
      if (!shouldRetry(status)) {
        break;
      }

      // Nếu còn lượt retry, áp dụng exponential backoff + jitter
      if (attempt < maxRetriesPerProvider) {
        const delay = calculateBackoffWithJitter(attempt);
        await new Promise(r => setTimeout(r, delay));
      }
    }

    if (providerSuccess) {
      return {
        success: true,
        provider: providerName,
        model: p.model,
        data: providerData,
        usedFallback: i > 0
      };
    }
  }

  return {
    success: false,
    error: 'ALL_PROVIDERS_FAILED',
    lastError
  };
}

/**
 * Tính toán phân vị độ trễ (Percentile Latency)
 * @param {Array<number>} numbers
 * @param {number} p - 0.50 (p50) hoặc 0.95 (p95)
 * @returns {number}
 */
export function calculatePercentileLatency(numbers = [], p = 0.5) {
  if (!Array.isArray(numbers) || numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  return Math.round(sorted[lower] * (1 - weight) + sorted[upper] * weight);
}

/**
 * Tính toán các chỉ số SLA, tỷ lệ thành công, độ trễ và phân nhóm lỗi theo provider
 * @param {Array<Object>} logs - Nhật ký ai_usage_log
 * @returns {Object} Thống kê phân rã theo provider
 */
export function calculateProviderAnalytics(logs = []) {
  const byProvider = {};

  for (const log of logs) {
    const prov = (log.provider || 'unknown').toLowerCase();
    if (!byProvider[prov]) {
      byProvider[prov] = {
        provider: prov,
        total_requests: 0,
        success_requests: 0,
        failed_requests: 0,
        success_rate: 100,
        latencies: [],
        p50_latency_ms: 0,
        p95_latency_ms: 0,
        total_cost: 0,
        cache_hits: 0,
        error_classes: {}
      };
    }

    const item = byProvider[prov];
    item.total_requests++;

    if (log.status === 'success') {
      item.success_requests++;
    } else {
      item.failed_requests++;
      const errCls = log.error_class || classifyError(null, log.error_message || 'UNKNOWN');
      item.error_classes[errCls] = (item.error_classes[errCls] || 0) + 1;
    }

    if (typeof log.latency_ms === 'number' && log.latency_ms > 0) {
      item.latencies.push(log.latency_ms);
    }

    if (typeof log.estimated_cost === 'number') {
      item.total_cost += log.estimated_cost;
    }

    if (log.cache_hit === true) {
      item.cache_hits++;
    }
  }

  // Finalize statistics (percentiles and success rates)
  for (const prov of Object.keys(byProvider)) {
    const item = byProvider[prov];
    item.success_rate = item.total_requests > 0
      ? Number(((item.success_requests / item.total_requests) * 100).toFixed(2))
      : 100;
    item.p50_latency_ms = calculatePercentileLatency(item.latencies, 0.50);
    item.p95_latency_ms = calculatePercentileLatency(item.latencies, 0.95);
    item.total_cost = Number(item.total_cost.toFixed(2));
    delete item.latencies; // Dọn dẹp mảng tạm
  }

  return { by_provider: byProvider };
}
