/**
 * Incident Engine - Động cơ đánh giá quy tắc cảnh báo sự cố vận hành
 * Tuân thủ: PII Sanitization, Deduplication Window, và Data Truth Invariant
 */

export const ALERT_RULES = {
  ai_error_rate: {
    rule_code: 'ai_error_rate',
    title: 'Tỷ lệ lỗi bóc tách AI vượt ngưỡng',
    threshold: 0.10, // 10%
    windowSeconds: 300,
    source_link: '/admin/ai-platform'
  },
  provider_latency: {
    rule_code: 'provider_latency',
    title: 'Độ trễ phản hồi nhà cung cấp AI cao',
    threshold: 5000, // 5000ms
    windowSeconds: 300,
    source_link: '/admin/ai-platform'
  },
  webhook_failure: {
    rule_code: 'webhook_failure',
    title: 'Cổng Webhook ghi nhận lỗi liên tiếp',
    threshold: 3, // 3 lỗi
    windowSeconds: 300,
    source_link: '/admin/system-health'
  },
  carrier_dom_failure: {
    rule_code: 'carrier_dom_failure',
    title: 'Cổng bưu cục thay đổi DOM hoặc sập kết nối',
    threshold: 1, // >= 1 lỗi DOM / sập
    windowSeconds: 300,
    source_link: '/admin/system-health'
  },
  sync_backlog: {
    rule_code: 'sync_backlog',
    title: 'Tồn đọng hàng đợi đồng bộ đơn hàng',
    threshold: 5, // >= 5 lỗi sync hoặc > 30 pending
    windowSeconds: 300,
    source_link: '/admin/system-health'
  },
  payment_reconciliation_backlog: {
    rule_code: 'payment_reconciliation_backlog',
    title: 'Tồn đọng giao dịch thanh toán chưa khớp shop',
    threshold: 1, // >= 1 giao dịch unmatched
    windowSeconds: 300,
    source_link: '/admin/subscriptions'
  }
};

/**
 * Khử sạch PII (Personally Identifiable Information) khỏi payload trước khi lưu vết hoặc gửi cảnh báo
 * @param {Object} payload
 * @returns {Object} Payload đã được làm sạch
 */
export function sanitizeIncidentPayload(payload) {
  if (!payload || typeof payload !== 'object') return {};

  const clean = { ...payload };

  // Danh mục trường PII cấm lưu trữ trong alert/incident
  const PII_FIELDS = [
    'customer_name',
    'name',
    'phone',
    'phone_number',
    'address',
    'raw_address',
    'street',
    'email',
    'password',
    'secret',
    'api_key',
    'token',
    'credit_card',
    'bank_account'
  ];

  for (const field of PII_FIELDS) {
    delete clean[field];
  }

  // Khử đệ quy và xóa chuỗi regex PII nếu có trong các trường còn lại
  for (const [key, value] of Object.entries(clean)) {
    if (typeof value === 'string') {
      // Che số điện thoại VN (ví dụ 0912345678)
      clean[key] = value.replace(/(03|05|07|08|09)\d{8}/g, '09********');
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      clean[key] = sanitizeIncidentPayload(value);
    }
  }

  return clean;
}

/**
 * Đánh giá các chỉ số sức khỏe hệ thống theo 6 quy tắc vận hành bắt buộc
 * @param {Object} metrics - Chỉ số thu thập từ hệ thống
 * @returns {Array<Object>} Danh sách các cảnh báo được kích hoạt
 */
export function evaluateSystemAlertRules(metrics = {}) {
  const triggeredAlerts = [];

  // 1. Quy tắc: AI Error Rate (Tỷ lệ request AI thất bại trong cửa sổ)
  if (metrics.ai_total_requests > 0 && typeof metrics.ai_error_requests === 'number') {
    const errorRate = metrics.ai_error_requests / metrics.ai_total_requests;
    const rule = ALERT_RULES.ai_error_rate;
    if (errorRate >= rule.threshold) {
      const severity = errorRate >= 0.25 ? 'critical' : 'warning';
      triggeredAlerts.push({
        rule_code: rule.rule_code,
        severity,
        title: rule.title,
        message: `Tỷ lệ lỗi AI đạt ${(errorRate * 100).toFixed(1)}% (${metrics.ai_error_requests}/${metrics.ai_total_requests} requests), vượt ngưỡng ${(rule.threshold * 100)}%`,
        metric_value: Number(errorRate.toFixed(4)),
        threshold: rule.threshold,
        window_seconds: rule.windowSeconds,
        dedupe_key: 'alert:ai_error_rate:global',
        source_link: rule.source_link,
        payload: sanitizeIncidentPayload({
          total_requests: metrics.ai_total_requests,
          error_requests: metrics.ai_error_requests,
          rate: errorRate
        })
      });
    }
  }

  // 2. Quy tắc: Provider Latency (Độ trễ trung bình / p95)
  if (typeof metrics.provider_latency_ms === 'number') {
    const rule = ALERT_RULES.provider_latency;
    if (metrics.provider_latency_ms >= rule.threshold) {
      const severity = metrics.provider_latency_ms >= 10000 ? 'critical' : 'warning';
      const provider = metrics.provider_name || 'AI Gateway';
      triggeredAlerts.push({
        rule_code: rule.rule_code,
        severity,
        title: rule.title,
        message: `Độ trễ trung bình của ${provider} đạt ${metrics.provider_latency_ms}ms, vượt ngưỡng ${rule.threshold}ms`,
        metric_value: metrics.provider_latency_ms,
        threshold: rule.threshold,
        window_seconds: rule.windowSeconds,
        dedupe_key: `alert:provider_latency:${provider.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
        source_link: rule.source_link,
        payload: sanitizeIncidentPayload({
          provider,
          latency_ms: metrics.provider_latency_ms
        })
      });
    }
  }

  // 3. Quy tắc: Webhook Failure (Số lần gửi/nhận webhook thất bại liên tiếp)
  if (typeof metrics.webhook_failures_count === 'number') {
    const rule = ALERT_RULES.webhook_failure;
    if (metrics.webhook_failures_count >= rule.threshold) {
      triggeredAlerts.push({
        rule_code: rule.rule_code,
        severity: 'critical',
        title: rule.title,
        message: `Ghi nhận ${metrics.webhook_failures_count} lần lỗi webhook liên tiếp trong ${rule.windowSeconds}s`,
        metric_value: metrics.webhook_failures_count,
        threshold: rule.threshold,
        window_seconds: rule.windowSeconds,
        dedupe_key: 'alert:webhook_failure:global',
        source_link: rule.source_link,
        payload: sanitizeIncidentPayload({
          failures_count: metrics.webhook_failures_count
        })
      });
    }
  }

  // 4. Quy tắc: Carrier DOM Failure (Bưu cục thay đổi cấu trúc trang hoặc sập)
  if (metrics.carrier_status && metrics.carrier_status !== 'healthy') {
    const rule = ALERT_RULES.carrier_dom_failure;
    const carrier = metrics.carrier_code || 'Carrier';
    const isCritical = ['offline', 'dom_changed'].includes(metrics.carrier_status);
    triggeredAlerts.push({
      rule_code: rule.rule_code,
      severity: isCritical ? 'critical' : 'warning',
      title: rule.title,
      message: `Cổng ${carrier} rơi vào trạng thái "${metrics.carrier_status}". Cần kiểm tra DOM hoặc bộ chọn bưu cục.`,
      metric_value: 1,
      threshold: rule.threshold,
      window_seconds: rule.windowSeconds,
      dedupe_key: `alert:carrier_dom:${carrier.toUpperCase()}`,
      source_link: rule.source_link,
      payload: sanitizeIncidentPayload({
        carrier,
        status: metrics.carrier_status,
        error_message: metrics.carrier_error
      })
    });
  }

  // 5. Quy tắc: Sync Backlog (Tồn đọng hàng đợi đồng bộ đơn hàng)
  const syncFailed = metrics.sync_failed_count || 0;
  const syncPending = metrics.sync_pending_count || 0;
  const ruleSync = ALERT_RULES.sync_backlog;
  if (syncFailed >= ruleSync.threshold || syncPending >= 30) {
    const severity = syncFailed >= ruleSync.threshold ? 'critical' : 'warning';
    triggeredAlerts.push({
      rule_code: ruleSync.rule_code,
      severity,
      title: ruleSync.title,
      message: `Hàng đợi đồng bộ có ${syncFailed} đơn lỗi và ${syncPending} đơn đang chờ tải lên Cloud`,
      metric_value: syncFailed + syncPending,
      threshold: ruleSync.threshold,
      window_seconds: ruleSync.windowSeconds,
      dedupe_key: 'alert:sync_backlog:outbox',
      source_link: ruleSync.source_link,
      payload: sanitizeIncidentPayload({
        failed_count: syncFailed,
        pending_count: syncPending
      })
    });
  }

  // 6. Quy tắc: Payment Reconciliation Backlog (Giao dịch chưa khớp shop)
  const unmatchedPayments = metrics.unmatched_payment_count || 0;
  const rulePayment = ALERT_RULES.payment_reconciliation_backlog;
  if (unmatchedPayments >= rulePayment.threshold) {
    const severity = unmatchedPayments >= 5 ? 'critical' : 'warning';
    triggeredAlerts.push({
      rule_code: rulePayment.rule_code,
      severity,
      title: rulePayment.title,
      message: `Phát hiện ${unmatchedPayments} giao dịch thanh toán chưa khớp với Shop nào, cần đối soát thủ công`,
      metric_value: unmatchedPayments,
      threshold: rulePayment.threshold,
      window_seconds: rulePayment.windowSeconds,
      dedupe_key: 'alert:payment_reconciliation:backlog',
      source_link: rulePayment.source_link,
      payload: sanitizeIncidentPayload({
        unmatched_count: unmatchedPayments
      })
    });
  }

  return triggeredAlerts;
}
