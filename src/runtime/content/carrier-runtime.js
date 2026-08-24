(function initCarrierRuntime(global) {
  const PLATFORMS = {
    vnpost: { id: 'vnpost', title: 'VNPost', themeColor: '#0056b3' },
    jt: { id: 'jt', title: 'J&T Express', themeColor: '#e11d48' },
    ghn: { id: 'ghn', title: 'GHN', themeColor: '#f97316' },
    ghtk: { id: 'ghtk', title: 'GHTK', themeColor: '#16a34a' },
    viettel: { id: 'viettel', title: 'ViettelPost', themeColor: '#dc2626' }
  };

  function getCurrentPlatform() {
    const url = typeof global.location !== 'undefined' ? global.location.href.toLowerCase() : '';
    if (url.includes('my.vnpost.vn/order/domestic/create')) return PLATFORMS.vnpost;
    if (url.includes('jtexpress.vn') && (url.includes('ordercreate') || url.includes('order/create') || url.includes('web/order/create') || url.includes('order-create'))) return PLATFORMS.jt;
    if (url.includes('ghn.vn')) return PLATFORMS.ghn;
    if (url.includes('ghtk.vn')) return PLATFORMS.ghtk;
    if (url.includes('viettelpost.vn')) return PLATFORMS.viettel;
    return null;
  }

  function detectCarrierAccount(platform) {
    const plat = platform || getCurrentPlatform();
    const platId = typeof plat === 'object' && plat ? plat.id : plat;
    if (platId === 'vnpost' && global.VNPOST_SELECTORS && typeof global.VNPOST_SELECTORS.getAccountName === 'function') {
      return global.VNPOST_SELECTORS.getAccountName();
    }
    if (platId === 'jt' && global.JT_SELECTORS && typeof global.JT_SELECTORS.getAccountName === 'function') {
      return global.JT_SELECTORS.getAccountName();
    }
    return '';
  }

  global.AutoFillCarrierRuntime = {
    PLATFORMS,
    getCurrentPlatform,
    detectCarrierAccount
  };
  global.detectCarrierAccount = detectCarrierAccount;
})(globalThis);
