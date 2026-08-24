export const ERROR_CODES = {
  AI_AUTH_REQUIRED: 'AI_AUTH_REQUIRED',
  AI_SHOP_REQUIRED: 'AI_SHOP_REQUIRED',
  AI_SHOP_FORBIDDEN: 'AI_SHOP_FORBIDDEN',
  AI_FEATURE_DISABLED: 'AI_FEATURE_DISABLED',
  AI_RATE_LIMITED: 'AI_RATE_LIMITED',
  AI_QUOTA_EXCEEDED: 'AI_QUOTA_EXCEEDED',
  AI_KEY_UNAVAILABLE: 'AI_KEY_UNAVAILABLE',
  AI_PROVIDER_UNAVAILABLE: 'AI_PROVIDER_UNAVAILABLE',
  AI_UPSTREAM_ERROR: 'AI_UPSTREAM_ERROR',
  AI_TIMEOUT: 'AI_TIMEOUT',
  ADDRESS_ENGINE_FAILED: 'ADDRESS_ENGINE_FAILED',
  CARRIER_FORM_NOT_FOUND: 'CARRIER_FORM_NOT_FOUND',
  CARRIER_AUTOFILL_FAILED: 'CARRIER_AUTOFILL_FAILED',
  SYNC_CLOUD_UNAVAILABLE: 'SYNC_CLOUD_UNAVAILABLE',
  SYNC_OUTBOX_PENDING: 'SYNC_OUTBOX_PENDING',
  AUTH_SESSION_EXPIRED: 'AUTH_SESSION_EXPIRED'
};

const SAFE_MESSAGES = {
  [ERROR_CODES.AI_AUTH_REQUIRED]: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  [ERROR_CODES.AI_SHOP_REQUIRED]: 'Tài khoản chưa được gán vào cửa hàng.',
  [ERROR_CODES.AI_SHOP_FORBIDDEN]: 'Bạn không có quyền dùng AI cho cửa hàng này.',
  [ERROR_CODES.AI_FEATURE_DISABLED]: 'Tính năng AI đang tắt cho cửa hàng này.',
  [ERROR_CODES.AI_RATE_LIMITED]: 'AI đang nhận quá nhiều yêu cầu. Vui lòng thử lại sau.',
  [ERROR_CODES.AI_QUOTA_EXCEEDED]: 'Cửa hàng đã hết hạn mức AI tháng này.',
  [ERROR_CODES.AI_KEY_UNAVAILABLE]: 'AI chưa được cấu hình trên máy chủ.',
  [ERROR_CODES.AI_PROVIDER_UNAVAILABLE]: 'Dịch vụ AI tạm thời không khả dụng. Đang dùng kết quả local để bạn kiểm tra thủ công.',
  [ERROR_CODES.AI_UPSTREAM_ERROR]: 'AI chưa xử lý được yêu cầu này. Đang dùng kết quả local để bạn kiểm tra thủ công.',
  [ERROR_CODES.AI_TIMEOUT]: 'AI phản hồi quá lâu. Đang dùng kết quả local để bạn kiểm tra thủ công.',
  [ERROR_CODES.ADDRESS_ENGINE_FAILED]: 'Không chuẩn hóa được địa chỉ tự động. Vui lòng kiểm tra thủ công trước khi điền.',
  [ERROR_CODES.CARRIER_FORM_NOT_FOUND]: 'Không tìm thấy biểu mẫu trên trang vận chuyển. Vui lòng kiểm tra lại trang hiện tại.',
  [ERROR_CODES.CARRIER_AUTOFILL_FAILED]: 'Không thể điền biểu mẫu tự động. Bạn vẫn có thể sao chép dữ liệu để nhập thủ công.',
  [ERROR_CODES.SYNC_CLOUD_UNAVAILABLE]: 'Chưa kết nối được cloud. Dữ liệu sẽ được giữ local và đồng bộ lại sau.',
  [ERROR_CODES.SYNC_OUTBOX_PENDING]: 'Một số thay đổi đang chờ đồng bộ. Vui lòng thử lại sau ít phút.',
  [ERROR_CODES.AUTH_SESSION_EXPIRED]: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
};

export function normalizeErrorCode(error) {
  const raw = String(error?.code || error?.error || error?.message || error || '').toUpperCase();
  if (raw.includes('QUOTA')) return ERROR_CODES.AI_QUOTA_EXCEEDED;
  if (raw.includes('RATE')) return ERROR_CODES.AI_RATE_LIMITED;
  if (raw.includes('AUTH') || raw.includes('SESSION') || raw.includes('JWT')) return ERROR_CODES.AI_AUTH_REQUIRED;
  if (raw.includes('SHOP_FORBIDDEN') || raw.includes('FORBIDDEN')) return ERROR_CODES.AI_SHOP_FORBIDDEN;
  if (raw.includes('SHOP_REQUIRED')) return ERROR_CODES.AI_SHOP_REQUIRED;
  if (raw.includes('FEATURE_DISABLED')) return ERROR_CODES.AI_FEATURE_DISABLED;
  if (raw.includes('KEY_UNAVAILABLE')) return ERROR_CODES.AI_KEY_UNAVAILABLE;
  if (raw.includes('TIMEOUT') || raw.includes('ABORT')) return ERROR_CODES.AI_TIMEOUT;
  if (raw.includes('PROVIDER')) return ERROR_CODES.AI_PROVIDER_UNAVAILABLE;
  if (raw.includes('SYNC')) return ERROR_CODES.SYNC_CLOUD_UNAVAILABLE;
  if (raw.includes('ADDRESS')) return ERROR_CODES.ADDRESS_ENGINE_FAILED;
  if (raw.includes('FORM')) return ERROR_CODES.CARRIER_FORM_NOT_FOUND;
  return ERROR_CODES.AI_UPSTREAM_ERROR;
}

export function toUserSafeError(error, fallbackCode = ERROR_CODES.AI_UPSTREAM_ERROR) {
  const code = error?.code || error?.error || normalizeErrorCode(error) || fallbackCode;
  return {
    code,
    message: SAFE_MESSAGES[code] || SAFE_MESSAGES[fallbackCode] || 'Có lỗi xảy ra. Vui lòng thử lại.',
    retryable: ![
      ERROR_CODES.AI_AUTH_REQUIRED,
      ERROR_CODES.AUTH_SESSION_EXPIRED,
      ERROR_CODES.AI_SHOP_FORBIDDEN,
      ERROR_CODES.AI_FEATURE_DISABLED
    ].includes(code)
  };
}
