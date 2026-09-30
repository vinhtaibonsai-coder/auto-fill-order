// =========================================================================
// APPLICATION GLOBAL CONFIGURATION
// =========================================================================

const APP_CONFIG = {
  name: 'Auto Fill Order',
  version: '1.0.2',
  defaultTimeoutMs: 15000,
  maxRetryAttempts: 3,
  supportedCarriers: ['vnpost', 'jt', 'viettel', 'ghtk']
};

if (typeof globalThis !== 'undefined') {
  globalThis.APP_CONFIG = APP_CONFIG;
}
if (typeof window !== 'undefined') {
  window.APP_CONFIG = APP_CONFIG;
}


