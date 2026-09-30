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
    if (url.includes('my.vnpost.vn/order/domestic/create') || (url.includes('donhang.vnpost.vn') && (url.includes('/create') || url.includes('tao-don')))) return PLATFORMS.vnpost;
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
    if (platId === 'viettel' && global.VIETTELPOST_SELECTORS && typeof global.VIETTELPOST_SELECTORS.getAccountName === 'function') {
      return global.VIETTELPOST_SELECTORS.getAccountName();
    }
    if (platId === 'ghtk' && global.GHTK_SELECTORS && typeof global.GHTK_SELECTORS.getAccountName === 'function') {
      return global.GHTK_SELECTORS.getAccountName();
    }
    return '';
  }

  function sanitizeSelectorPayload(target, payload) {
    if (!target || !payload || typeof payload !== 'object' || Array.isArray(payload)) return {};
    return Object.fromEntries(Object.entries(payload).filter(([key, value]) => {
      if (!Object.prototype.hasOwnProperty.call(target, key)) return false;
      return typeof value === 'string' || (Array.isArray(value) && value.length <= 50 && value.every(item => typeof item === 'string' && item.length <= 500));
    }));
  }

  function applyRemoteSelectors(carrierCode, selectors) {
    const target = carrierCode === 'VNPOST' ? global.VNPOST_SELECTORS : carrierCode === 'JT' ? global.JT_SELECTORS : null;
    if (!target) return false;
    const safe = sanitizeSelectorPayload(target, selectors);
    if (!Object.keys(safe).length) return false;
    Object.assign(target, safe);
    return true;
  }

  function compareVersions(left = '0', right = '0') {
    const a = String(left).split('.').map(Number), b = String(right).split('.').map(Number);
    for (let i = 0; i < Math.max(a.length, b.length); i++) { const d = (a[i] || 0) - (b[i] || 0); if (d) return d; }
    return 0;
  }

  async function syncRemoteSelectors() {
    const platform = getCurrentPlatform();
    const carrierCode = platform?.id === 'vnpost' ? 'VNPOST' : platform?.id === 'jt' ? 'JT' : '';
    if (!carrierCode || !global.SupabaseCloud || !global.AuthSession) return { ok: false, reason: 'UNAVAILABLE' };
    try {
      const config = await global.SupabaseCloud.loadConfig();
      const session = await global.AuthSession.getSession();
      if (!config?.url || !session?.access_token) return { ok: false, reason: 'NO_SESSION' };
      const response = await fetch(`${config.url}/rest/v1/remote_selector_releases?carrier_code=eq.${carrierCode}&status=eq.active&select=version,selectors,min_extension_version&order=version.desc&limit=1`, { headers: { apikey: config.anonKey, Authorization: `Bearer ${session.access_token}` }, cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP_${response.status}`);
      const release = (await response.json())[0];
      const clientVersion = global.chrome?.runtime?.getManifest?.().version || '0.0.0';
      if (release?.min_extension_version && compareVersions(clientVersion, release.min_extension_version) < 0) return { ok: false, reason: 'CLIENT_VERSION_TOO_OLD', requiredVersion: release.min_extension_version };
      if (!release || !applyRemoteSelectors(carrierCode, release.selectors)) return { ok: false, reason: 'NO_RELEASE' };
      if (global.chrome?.storage?.local) await global.chrome.storage.local.set({ [`remote_selectors_${carrierCode}`]: release });
      return { ok: true, version: release.version };
    } catch (error) {
      if (global.chrome?.storage?.local) {
        const cached = await global.chrome.storage.local.get([`remote_selectors_${carrierCode}`]);
        const release = cached?.[`remote_selectors_${carrierCode}`];
        if (release && applyRemoteSelectors(carrierCode, release.selectors)) return { ok: true, cached: true, version: release.version };
      }
      return { ok: false, reason: error.message };
    }
  }

  global.AutoFillCarrierRuntime = {
    PLATFORMS,
    getCurrentPlatform,
    detectCarrierAccount,
    applyRemoteSelectors,
    syncRemoteSelectors
  };
  global.detectCarrierAccount = detectCarrierAccount;
  if (typeof global.setTimeout === 'function') global.setTimeout(() => syncRemoteSelectors(), 1500);
  if (typeof global.setInterval === 'function') global.setInterval(() => syncRemoteSelectors(), 30_000);
})(globalThis);
