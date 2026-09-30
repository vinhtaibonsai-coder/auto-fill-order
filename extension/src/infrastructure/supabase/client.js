// backend/supabase/client.js
// Supabase PostgREST Cloud Client — Thay thế Firebase REST API
// =========================================================================

(() => {
  const isBackground = typeof window === 'undefined';
  const SupabaseCloud = globalThis.SupabaseCloud || {};

  SupabaseCloud._deviceId = null;
  SupabaseCloud._deviceName = '';
  SupabaseCloud._clientContext = null;
  SupabaseCloud.isConnected = false;

  SupabaseCloud._savedUrl = '';
  SupabaseCloud._savedAnonKey = '';

  SupabaseCloud._getConfig = function() {
    const cfg = typeof SUPABASE_CONFIG !== 'undefined' ? SUPABASE_CONFIG : { url: '', anonKey: '' };
    const url = (this._savedUrl || cfg.url || '').trim();
    const anonKey = (this._savedAnonKey || cfg.anonKey || '').trim();
    return { url, anonKey };
  };

  // A "client installation" is scoped to one Extension install or one Web origin.
  // It is intentionally not presented as a physical-computer identifier because
  // browser sandboxes cannot prove that an Extension and a website share hardware.
  SupabaseCloud.getClientContext = function(surfaceHint = null) {
    if (this._clientContext && !surfaceHint) return this._clientContext;

    const isExtensionRuntime = Boolean(
      typeof chrome !== 'undefined' && chrome.runtime?.id && chrome.runtime?.getURL
    );
    const locationRef = typeof window !== 'undefined' ? window.location : null;
    const hostname = String(locationRef?.hostname || '').toLowerCase();
    const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname.endsWith('.localhost');
    const environment = isLocalHost ? 'LOCAL' : 'PRODUCTION';

    let surface = surfaceHint;
    if (!surface) {
      const pathname = String(locationRef?.pathname || '').toLowerCase();
      if (isExtensionRuntime && typeof window === 'undefined') surface = 'EXTENSION_SERVICE_WORKER';
      else if (isExtensionRuntime && locationRef?.protocol === 'chrome-extension:' && pathname.includes('options')) surface = 'EXTENSION_OPTIONS';
      else if (isExtensionRuntime && locationRef?.protocol === 'chrome-extension:') surface = 'EXTENSION_WORKSPACE';
      else if (isExtensionRuntime) surface = 'EXTENSION_PANEL';
      else if (pathname.includes('admin')) surface = 'WEB_ADMIN';
      else surface = 'WEB_WORKSPACE';
    }

    const context = {
      clientType: isExtensionRuntime ? 'EXTENSION' : 'WEB',
      environment: environment,
      surface,
      originHost: isExtensionRuntime ? `chrome-extension://${chrome.runtime.id}` : String(locationRef?.host || 'unknown'),
      isBillable: isExtensionRuntime && environment === 'PRODUCTION'
    };
    if (!surfaceHint) this._clientContext = context;
    return context;
  };

  SupabaseCloud.saveConfig = async function(url, anonKey) {
    const u = (url || '').trim();
    const k = (anonKey || '').trim();
    this._savedUrl = u;
    this._savedAnonKey = k;
    this._clientInstance = null;
    if (typeof window !== 'undefined') window.supabaseClient = null;
    if (typeof globalThis !== 'undefined') globalThis.supabaseClient = null;
    if (typeof SUPABASE_CONFIG !== 'undefined') {
      SUPABASE_CONFIG.url = u;
      SUPABASE_CONFIG.anonKey = k;
    }
    return new Promise(resolve => {
      try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ supabaseUrl: u, supabaseAnonKey: k }, resolve);
        } else {
          localStorage.setItem('supabaseUrl', u);
          localStorage.setItem('supabaseAnonKey', k);
          resolve();
        }
      } catch (e) { resolve(); }
    });
  };

  SupabaseCloud.loadConfig = async function() {
    return new Promise(async (resolve) => {
      try {
        let u = null, k = null;
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          const r = await new Promise(res => chrome.storage.local.get(['supabaseUrl', 'supabaseAnonKey'], res));
          u = r.supabaseUrl;
          k = r.supabaseAnonKey;
        } else {
          u = localStorage.getItem('supabaseUrl');
          k = localStorage.getItem('supabaseAnonKey');
        }

        // Tự động kéo cấu hình từ GitHub nếu người dùng chưa điền thủ công (Chỉ dùng trên Dev)
        if (!u || !k) {
          if (typeof __IS_DEV_EXTENSION__ !== 'undefined' && __IS_DEV_EXTENSION__) {
            try {
              const c = new AbortController();
              const t = setTimeout(() => c.abort(), 3000);
              const url = 'https://raw.githubusercontent.com/vinhtaibonsai-coder/supbase/main/configAOF.json';
              const res = await fetch(url + '?t=' + Date.now(), { signal: c.signal });
              clearTimeout(t);
              if (res.ok) {
                const data = await res.json();
                if (data.url && data.anonKey && typeof SUPABASE_CONFIG !== 'undefined') {
                  SUPABASE_CONFIG.url = data.url;
                  SUPABASE_CONFIG.anonKey = data.anonKey;
                }
              }
            } catch (e) {}
          }
        }

        if (u) this._savedUrl = u;
        if (k) this._savedAnonKey = k;
        
        resolve(this._getConfig());
      } catch (e) { resolve(this._getConfig()); }
    });
  };

  SupabaseCloud._clientInstance = null;
  SupabaseCloud._clientInitPromise = null;

  SupabaseCloud.getSupabaseClient = async function() {
    const existing = (typeof window !== 'undefined' && window.supabaseClient)
      || (typeof globalThis !== 'undefined' && globalThis.supabaseClient)
      || this._clientInstance;
    if (existing) return existing;

    if (this._clientInitPromise) {
      return this._clientInitPromise;
    }

    this._clientInitPromise = (async () => {
      try {
        const configRes = await this.loadConfig();
        if (!configRes?.url || !configRes?.anonKey) return null;

        const checkAgain = (typeof window !== 'undefined' && window.supabaseClient)
          || (typeof globalThis !== 'undefined' && globalThis.supabaseClient)
          || this._clientInstance;
        if (checkAgain) return checkAgain;

        let createClientFn = null;
        if (typeof window !== 'undefined' && window.supabase && typeof window.supabase.createClient === 'function') {
          createClientFn = window.supabase.createClient;
        } else {
          try {
            const mod = await import('@supabase/supabase-js');
            createClientFn = mod.createClient;
          } catch (_) {
            if (typeof globalThis !== 'undefined' && globalThis.supabase && typeof globalThis.supabase.createClient === 'function') {
              createClientFn = globalThis.supabase.createClient;
            }
          }
        }

        if (!createClientFn) {
          return null;
        }

        const client = createClientFn(configRes.url, configRes.anonKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
            storageKey: 'sb-afo-singleton-auth'
          }
        });

        this._clientInstance = client;
        if (typeof window !== 'undefined') window.supabaseClient = client;
        if (typeof globalThis !== 'undefined') globalThis.supabaseClient = client;
        return client;
      } catch (e) {
        console.warn('[SupabaseCloud.getSupabaseClient] Error initializing client:', e);
        return null;
      } finally {
        this._clientInitPromise = null;
      }
    })();

    return this._clientInitPromise;
  };

  SupabaseCloud._url = function(path) {
    const cfg = this._getConfig();
    const baseUrl = (cfg.url || '').trim().replace(/\/$/, '');
    return `${baseUrl}/rest/v1/${path}`;
  };

  SupabaseCloud._headers = function(accessToken = null) {
    const cfg = this._getConfig();
    const key = (cfg.anonKey || '').trim();
    let token = accessToken;
    if (!token && typeof AuthSession !== 'undefined' && AuthSession._cachedToken) {
      token = AuthSession._cachedToken;
    }
    // A valid Supabase JWT must have 3 dot-separated segments.
    // If token is a PIN session token (e.g. pin_sess_* or token_*), it is NOT a JWT and must not be used as Bearer token for PostgREST!
    const isJwt = typeof token === 'string' && token.split('.').length === 3;
    const bearerToken = isJwt ? token : key;

    return {
      'apikey': key,
      'Authorization': `Bearer ${bearerToken}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation,resolution=merge-duplicates'
    };
  };

  SupabaseCloud._normalizeCarrierCode = function(value) {
    if (!value) return '';
    if (typeof value === 'object') {
      return this._normalizeCarrierCode(
        value.id || value.ID || value.code || value.carrier_id || value.carrierId ||
        value.title || value.TITLE || value.name || value.label || ''
      );
    }
    const raw = String(value).trim();
    if (!raw) return '';
    if (raw.startsWith('{')) {
      try {
        return this._normalizeCarrierCode(JSON.parse(raw));
      } catch (_) {}
    }
    const key = raw.toLowerCase().replace(/\s+/g, '');
    if (key.includes('vnpost') || key.includes('vietnampost') || key.includes('buudien')) return 'vnpost';
    if (key === 'jt' || key.includes('j&t') || key.includes('jtexpress')) return 'jt';
    return raw;
  };

  SupabaseCloud._stableSubmittedOrderId = function(order) {
    const clean = value => String(value || '').trim();
    const slug = value => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60);
    const tracking = slug(order.trackingCode || order.tracking_code || order.waybill_code);
    if (tracking && tracking !== '_' && tracking !== '-') return `sub_track_${tracking}`;

    const savedId = slug(order.savedOrderId || order.saved_order_id);
    if (savedId && savedId !== '_') return `sub_saved_${savedId}`;

    const phone = clean(order.phone).replace(/\D/g, '');
    const orderCode = slug(order.orderCode || order.order_code);
    if (phone && orderCode && orderCode !== '_') return `sub_order_${phone}_${orderCode}`;

    return '';
  };

  SupabaseCloud._hasSubmittedCustomer = function(order) {
    const name = String(order?.name || order?.customer_name || '').trim();
    const phone = String(order?.phone || '').replace(/\D/g, '');
    return (name && name !== '-' && name !== '—' && name.length >= 2) || phone.length >= 9;
  };

  SupabaseCloud.updateSubmittedOrderTracking = async function(orderId, trackingCode) {
    if (!orderId || !trackingCode) return false;
    const encoded = encodeURIComponent(String(orderId));
    const body = JSON.stringify({ tracking_code: String(trackingCode).trim() });
    const resp = await fetch(this._url(`submitted_orders?or=(id.eq.${encoded},saved_order_id.eq.${encoded})`), {
      method: 'PATCH',
      headers: this._headers(),
      body
    });
    return resp.ok;
  };

  SupabaseCloud.testConnection = async function() {
    await this.loadConfig();
    const cfg = this._getConfig();
    if (!cfg.url || !cfg.anonKey || cfg.url.includes('YOUR_SUPABASE')) {
      return { ok: false, reason: 'Chưa điền URL hoặc Anon Key' };
    }
    try {
      const resp = await fetch(this._url('orders?select=id&limit=1'), {
        headers: this._headers()
      });
      if (resp.ok) {
        this.isConnected = true;
        return { ok: true, url: cfg.url };
      } else {
        const text = await resp.text().catch(() => '');
        if (resp.status === 401 || resp.status === 403) {
          return { ok: false, reason: 'Mã Anon Key không hợp lệ hoặc bị từ chối' };
        }
        return { ok: false, reason: `HTTP ${resp.status}: ${text || 'Không thể truy cập Supabase'}` };
      }
    } catch (e) {
      return { ok: false, reason: 'Không thể kết nối mạng hoặc sai URL Supabase' };
    }
  };

  SupabaseCloud.signIn = async function() {
    if (!isBackground) {
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: 'firebaseSignIn' }, response => {
          const lastErr = chrome.runtime.lastError;
          if (lastErr) { reject(new Error(lastErr.message)); return; }
          if (response && response.ok) {
            SupabaseCloud.isConnected = true;
            SupabaseCloud._deviceId = response.deviceId || SupabaseCloud._deviceId || '';
            SupabaseCloud._deviceName = response.deviceName || SupabaseCloud._deviceName || '';
            resolve();
          } else {
            reject(new Error(response?.error || 'Kết nối Supabase thất bại'));
          }
        });
      });
    }

    await this.loadConfig();
    await this._getDeviceId();
    await this._getDeviceName();
    const cfg = this._getConfig();
    if (!cfg.url || !cfg.anonKey) {
      throw new Error('Chưa cấu hình Supabase URL hoặc Anon Key trong Cài đặt');
    }
    this.isConnected = true;
    return true;
  };

  SupabaseCloud.signOut = async function(accessToken = null) {
    try {
      await this.loadConfig();
      const cfg = this._getConfig();
      const token = accessToken || await this._sessionToken().catch(() => null);
      if (cfg.url && cfg.anonKey && token && !String(token).startsWith('local_dev_token_')) {
        await fetch(`${cfg.url.replace(/\/$/, '')}/auth/v1/logout`, {
          method: 'POST',
          headers: {
            'apikey': cfg.anonKey,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }).catch(() => {});
      }
    } catch (_) {}
    this.isConnected = false;
    return true;
  };

  SupabaseCloud.setDeviceName = async function(name) {
    const n = (name || '').trim();
    this._deviceName = n;
    return new Promise(resolve => {
      try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ fbDeviceName: n }, resolve);
        } else {
          localStorage.setItem('fbDeviceName', n);
          resolve();
        }
      } catch (e) { resolve(); }
    });
  };

  SupabaseCloud._getDeviceName = async function() {
    if (this._deviceName) return this._deviceName;
    return new Promise(resolve => {
      try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.get(['fbDeviceName'], r => {
            this._deviceName = r.fbDeviceName || '';
            resolve(this._deviceName);
          });
        } else {
          this._deviceName = localStorage.getItem('fbDeviceName') || '';
          resolve(this._deviceName);
        }
      } catch (e) { resolve(''); }
    });
  };

  SupabaseCloud._getDeviceId = async function() {
    if (this._deviceId) return this._deviceId;
    const clientContext = this.getClientContext();
    const prefix = clientContext.clientType === 'EXTENSION' ? 'ext_' : 'web_';
    return new Promise(resolve => {
      try {
        if (clientContext.clientType === 'EXTENSION' && typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.get(['device_id', 'fbDeviceId'], r => {
            const existing = r.device_id || r.fbDeviceId;
            if (existing) {
              this._deviceId = existing;
              chrome.storage.local.set({ device_id: existing, fbDeviceId: existing });
              resolve(existing);
              return;
            }
            const id = prefix + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 12);
            this._deviceId = id;
            chrome.storage.local.set({ device_id: id, fbDeviceId: id }, () => resolve(id));
          });
        } else {
          // Web IDs are origin-scoped by the browser. Preserve a legacy ID once,
          // then move it to an explicit key so it cannot be confused with Extension storage.
          let id = localStorage.getItem('web_device_id') || localStorage.getItem('device_id') || localStorage.getItem('fbDeviceId');
          if (!id) {
            id = prefix + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 12);
          }
          localStorage.setItem('web_device_id', id);
          this._deviceId = id;
          resolve(id);
        }
      } catch (e) { resolve(prefix + 'fallback_' + Date.now()); }
    });
  };

  // ─── DEVICES MANAGEMENT ───
  // Lấy access token hợp lệ của user hiện tại (từ AuthSession) nếu có.
  SupabaseCloud._sessionToken = async function() {
    try {
      if (typeof AuthSession !== 'undefined' && AuthSession.getSession) {
        const session = await AuthSession.getSession();
        if (session && session.auth_mode === 'local_dev') {
          console.warn('[SupabaseCloud] Local dev session cannot be used for cloud operations.');
          return null;
        }
        if (session && session.access_token) return session.access_token;
      }
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        const s = await new Promise(r => chrome.storage.local.get(['vnpost_session'], r));
        if (s?.vnpost_session?.access_token) return s.vnpost_session.access_token;
      }
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem('vnpost_session') || localStorage.getItem('sb-session') || localStorage.getItem('afo_session');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.access_token) return parsed.access_token;
        }
      }
    } catch (_) {}
    return null;
  };

  // Helper gọi RPC bằng token của user đang đăng nhập (auth.uid()) hoặc anon key.
  SupabaseCloud.rpc = async function(method, params) {
    try {
      await this.loadConfig();
      const token = await this._sessionToken();
      const cfg = this._getConfig();
      const baseUrl = (cfg.url || '').trim().replace(/\/$/, '');
      const resp = await fetch(`${baseUrl}/rest/v1/rpc/${encodeURIComponent(method)}`, {
        method: 'POST',
        headers: this._headers(token || null),
        body: JSON.stringify(params || {})
      });
      const text = await resp.text();
      let data;
      try { data = text ? JSON.parse(text) : null; } catch (_) { data = null; }
      if (!resp.ok) return { ok: false, error: data || ('HTTP ' + resp.status), status: resp.status };
      return { ok: true, data };
    } catch (e) {
      return { ok: false, error: e.message || 'NETWORK_ERR' };
    }
  };

  // Kiểm tra thiết bị hiện tại có bị thu hồi (revoked) trong extension_devices.
  // Trả về: { ok: true, revoked: boolean, status: string } hoặc { ok: false, reason: string }
  SupabaseCloud.checkDeviceRevoked = async function() {
    try {
      await this.loadConfig();
      const devId = await this._getDeviceId();
      const token = await this._sessionToken();
      if (!token) return { ok: false, reason: 'NO_TOKEN' };

      const cfg = this._getConfig();
      const baseUrl = (cfg.url || '').trim().replace(/\/$/, '');
      if (!baseUrl) return { ok: false, reason: 'NO_CONFIG_URL' };

      let activeShopId = null;
      try {
        if (typeof AuthSession !== 'undefined' && typeof AuthSession.getSession === 'function') {
          activeShopId = (await AuthSession.getSession())?.active_shop_id || null;
        }
        if (!activeShopId && typeof chrome !== 'undefined' && chrome.storage?.local) {
          const stored = await new Promise(resolve => chrome.storage.local.get(['active_shop_id', 'current_shop_id', 'vnpost_session'], resolve));
          activeShopId = stored?.active_shop_id || stored?.current_shop_id || stored?.vnpost_session?.active_shop_id || null;
        }
      } catch (_) {}

      // Truy vấn thiết bị theo device_id hoặc id
      let queryUrl = `${baseUrl}/rest/v1/extension_devices?select=id,device_id,shop_id,revoked,approved,status&or=(device_id.eq.${encodeURIComponent(devId)},id.eq.${encodeURIComponent(devId)})`;
      if (activeShopId) {
        queryUrl += `&shop_id=eq.${encodeURIComponent(activeShopId)}`;
      }

      const resp = await fetch(queryUrl, {
        headers: this._headers(token),
        cache: 'no-store'
      });
      if (!resp.ok) return { ok: false, reason: 'HTTP_' + resp.status };
      const rows = await resp.json();

      let match = (rows || []).find(r => r.device_id === devId || r.id === devId);
      if (!match && activeShopId) {
        const globalResp = await fetch(
          `${baseUrl}/rest/v1/extension_devices?select=id,device_id,shop_id,revoked,approved,status&or=(device_id.eq.${encodeURIComponent(devId)},id.eq.${encodeURIComponent(devId)})`,
          { headers: this._headers(token), cache: 'no-store' }
        );
        if (globalResp.ok) {
          const globalRows = await globalResp.json();
          match = (globalRows || []).find(r => r.device_id === devId || r.id === devId);
        }
      }

      if (!match) {
        return { ok: true, status: 'unregistered', revoked: false };
      }

      const isRevoked = !!(
        match.revoked === true ||
        match.approved === false ||
        ['blocked', 'suspended', 'revoked'].includes(String(match.status || '').toLowerCase())
      );

      return {
        ok: true,
        status: String(match.status || (isRevoked ? 'revoked' : 'active')).toLowerCase(),
        revoked: isRevoked,
        device: match
      };
    } catch (e) {
      return { ok: false, reason: 'ERR', error: e?.message };
    }
  };

  SupabaseCloud._getDeviceFingerprint = async function() {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
    const language = typeof navigator !== 'undefined' ? navigator.language || '' : '';
    const platform = typeof navigator !== 'undefined' ? navigator.platform || '' : '';
    const timezone = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone || '' : '';
    const screenSize = typeof screen !== 'undefined' ? `${screen.width}x${screen.height}x${screen.colorDepth}` : '';
    const source = [ua, language, platform, timezone, screenSize].join('|');
    if (!globalThis.crypto?.subtle) return source;
    const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(source));
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  };

  // Upsert thiết bị hiện tại vào bảng extension_devices (cần JWT để auth.uid()).
  SupabaseCloud.syncDeviceRecord = async function() {
    try {
      await this.loadConfig();
      const cfg = this.config || (typeof this._getConfig === 'function' ? this._getConfig() : null) || {};
      const baseUrl = (cfg.url || '').trim().replace(/\/$/, '');
      const anonKey = cfg.anonKey || '';
      if (!baseUrl) return { ok: false, reason: 'NO_CONFIG_URL' };

      const deviceId = await this._getDeviceId();
      const clientContext = this.getClientContext();
      const rawName = await this._getDeviceName();
      const token = await this._sessionToken();
      if (!token) return { ok: false, reason: 'NO_TOKEN' };

      // Thu thập thông tin Trình duyệt & Phần cứng chuyên sâu
      const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
      let browserName = 'Google Chrome';
      if (/coc_coc_browser|coccoc/i.test(ua)) browserName = 'Cốc Cốc';
      else if (/edg\//i.test(ua)) browserName = 'Microsoft Edge';
      else if (typeof navigator !== 'undefined' && navigator.brave) browserName = 'Brave Browser';
      else if (/opr\/|opera/i.test(ua)) browserName = 'Opera';
      else if (/firefox\//i.test(ua)) browserName = 'Mozilla Firefox';
      else if (/safari\//i.test(ua) && !/chrome/i.test(ua)) browserName = 'Apple Safari';

      const osInfo = /Windows NT 10/.test(ua) ? 'Windows 10/11 (64-bit)'
        : /Windows NT 6\.3/.test(ua) ? 'Windows 8.1'
        : /Windows NT 6\.1/.test(ua) ? 'Windows 7'
        : /Mac OS X/.test(ua) ? 'macOS (Apple Silicon/Intel)'
        : /Android/.test(ua) ? 'Android OS'
        : /Linux/.test(ua) ? 'Linux' : 'Hệ điều hành khác';

      const clientVersion = typeof chrome !== 'undefined' && chrome.runtime?.getManifest
        ? chrome.runtime.getManifest().version : 'v2.4 Pro';

      const name = rawName || this._deviceName || `${browserName} (${osInfo.split(' ')[0]})`;

      // Lấy Shop ID đang hoạt động nếu có
      let activeShopId = null;
      try {
        if (typeof AuthSession !== 'undefined' && typeof AuthSession.getSession === 'function') {
          const sess = await AuthSession.getSession();
          if (sess?.active_shop_id) activeShopId = sess.active_shop_id;
        }
        if (!activeShopId && typeof chrome !== 'undefined' && chrome.storage?.local) {
          const store = await new Promise(r => chrome.storage.local.get(['active_shop_id', 'current_shop_id', 'fbActiveShopId', 'vnpost_session'], r));
          activeShopId = store.active_shop_id || store.current_shop_id || store.fbActiveShopId || store.vnpost_session?.active_shop_id || null;
        }
        if (!activeShopId && typeof localStorage !== 'undefined') {
          const rawSess = localStorage.getItem('vnpost_session');
          if (rawSess) activeShopId = JSON.parse(rawSess)?.active_shop_id || null;
        }
      } catch (_) {}

      // Lấy thông tin user nếu có
      let userFullName = null;
      let userEmail = null;
      try {
        if (typeof AuthSession !== 'undefined' && typeof AuthSession.getSession === 'function') {
          const s = await AuthSession.getSession();
          userFullName = s?.user?.full_name || s?.user?.user_metadata?.full_name || null;
          userEmail = s?.user?.email || null;
        }
      } catch (_) {}

      // Thu thập Telemetry phần cứng & Màn hình
      const screenRes = typeof screen !== 'undefined' ? `${screen.width} x ${screen.height}` : '1920 x 1080';
      const cpuCores = typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency || 4) + ' cores' : '4 cores';
      const memory = typeof navigator !== 'undefined' && navigator.deviceMemory ? `${navigator.deviceMemory} GB RAM` : '>= 8 GB';
      const timezone = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Ho_Chi_Minh' : 'Asia/Ho_Chi_Minh';
      const language = typeof navigator !== 'undefined' ? navigator.language || 'vi-VN' : 'vi-VN';

      const metadata = {
        browser: browserName,
        os: osInfo,
        staff_name: userFullName || (userEmail ? userEmail.split('@')[0] : null),
        user_email: userEmail,
        screenResolution: screenRes,
        cpuCores,
        deviceMemory: memory,
        timezone,
        language,
        extensionVersion: clientVersion,
        clientType: clientContext.clientType,
        environment: clientContext.environment,
        surface: clientContext.surface,
        originHost: clientContext.originHost,
        quotaEligible: clientContext.isBillable,
        carrierContext: typeof window !== 'undefined' && window.location?.href.includes('vnpost') ? 'VNPost' : typeof window !== 'undefined' && window.location?.href.includes('jtexpress') ? 'J&T Express' : 'Extension',
        lastUpdated: new Date().toISOString()
      };

      const fingerprintHash = typeof this._getDeviceFingerprint === 'function' ? await this._getDeviceFingerprint() : `fp_${deviceId}`;

      const headers = {
        'apikey': anonKey,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      const richPayload = {
        p_device_id: deviceId,
        p_device_name: name,
        p_browser: browserName,
        p_os_info: osInfo,
        p_client_version: clientVersion,
        p_fingerprint_hash: fingerprintHash,
        p_shop_id: activeShopId,
        p_metadata: metadata,
        p_client_type: clientContext.clientType,
        p_environment: clientContext.environment,
        p_surface: clientContext.surface,
        p_origin_host: clientContext.originHost
      };
      const invokeRegistration = payload => fetch(`${baseUrl}/rest/v1/rpc/register_extension_device`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      let resp = await invokeRegistration(richPayload);
      let data = await resp.json().catch(() => null);
      if (!resp.ok && data?.code === 'PGRST202') {
        // Never register Web as a legacy Extension device while the database
        // migration is still pending. Extension keeps rollout compatibility.
        if (clientContext.clientType !== 'EXTENSION') {
          return {
            ok: false,
            reason: 'CLIENT_CONTEXT_SCHEMA_REQUIRED',
            status: resp.status,
            data
          };
        }
        const legacyPayload = {
          p_device_id: richPayload.p_device_id,
          p_device_name: richPayload.p_device_name,
          p_browser: richPayload.p_browser,
          p_os_info: richPayload.p_os_info,
          p_client_version: richPayload.p_client_version,
          p_fingerprint_hash: richPayload.p_fingerprint_hash
        };
        resp = await invokeRegistration(legacyPayload);
        data = await resp.json().catch(() => null);
      }

      const reason = data?.message || data?.details || data?.hint || (resp.ok ? null : `HTTP_${resp.status}`);
      return { ok: resp.ok && data?.success !== false, data, reason, status: resp.status };
    } catch (e) {
      console.warn('[SupabaseCloud.syncDeviceRecord] Error:', e);
      return { ok: false, reason: e.message };
    }
  };

  SupabaseCloud.registerDevice = async function() {
    const clientContext = this.getClientContext();
    if (!isBackground && clientContext.clientType === 'EXTENSION' && typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: 'registerDevice' }, response => {
          const lastErr = chrome.runtime.lastError;
          if (lastErr) { resolve({ ok: false }); return; }
          resolve(response || { ok: false });
        });
      });
    }

    return this.syncDeviceRecord();
  };

  SupabaseCloud.fetchDevices = async function() {
    if (!isBackground) {
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: 'fetchDevices' }, response => {
          const lastErr = chrome.runtime.lastError;
          if (lastErr) { resolve([]); return; }
          if (response && response.error) resolve([]);
          else resolve(response || []);
        });
      });
    }

    await this.loadConfig();
    await this._getDeviceId();
    await this._getDeviceName();

    const devicesMap = new Map();
    if (this._deviceId) {
      devicesMap.set(this._deviceId, {
        deviceId: this._deviceId,
        name: this._deviceName || 'Máy hiện tại',
        platform: typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.includes('Mac') ? 'Mac' : 'Windows',
        lastSeen: new Date().toISOString(),
        draftCount: 0,
        submittedCount: 0
      });
    }

    // 1. Lấy danh sách từ bảng devices (nếu có)
    try {
      const resp = await fetch(this._url('devices?select=*&order=last_seen.desc'), {
        headers: this._headers(),
        cache: 'no-store'
      });
      if (resp.ok) {
        const data = await resp.json();
        (data || []).forEach(d => {
          const id = d.device_id || d.deviceId || '';
          if (id) {
            devicesMap.set(id, {
              deviceId: id,
              name: d.name || 'Máy không tên',
              platform: d.platform || 'Windows',
              lastSeen: d.last_seen || d.lastSeen || '',
              draftCount: 0,
              submittedCount: 0
            });
          }
        });
      }
    } catch (_) {}

    // 2. Thống kê đơn nháp (orders) theo device_id / device_name
    try {
      const resp = await fetch(this._url('orders?select=device_id,device_name'), {
        headers: this._headers(),
        cache: 'no-store'
      });
      if (resp.ok) {
        const orders = await resp.json();
        (orders || []).forEach(o => {
          const devId = o.device_id ? String(o.device_id) : (o.device_name ? String(o.device_name) : null);
          const devName = o.device_name || '';
          if (devId || devName) {
            let matched = null;
            for (const dev of devicesMap.values()) {
              if ((devId && String(dev.deviceId) === String(devId)) || (devName && dev.name === devName)) {
                matched = dev;
                break;
              }
            }
            if (!matched) {
              const key = devId || devName;
              matched = {
                deviceId: key,
                name: devName || ('Thiết bị ' + String(key).slice(-6)),
                platform: 'Windows',
                lastSeen: '',
                draftCount: 0,
                submittedCount: 0
              };
              devicesMap.set(key, matched);
            }
            matched.draftCount++;
          }
        });
      }
    } catch (_) {}

    // 3. Thống kê đơn đã lên (submitted_orders) theo device_id / device_name
    try {
      const resp = await fetch(this._url('submitted_orders?select=device_id,device_name,created_at'), {
        headers: this._headers(),
        cache: 'no-store'
      });
      if (resp.ok) {
        const subs = await resp.json();
        (subs || []).forEach(s => {
          const devId = s.device_id ? String(s.device_id) : (s.device_name ? String(s.device_name) : '');
          const devName = s.device_name || '';
          if (devId || devName) {
            let matched = null;
            for (const dev of devicesMap.values()) {
              if ((devId && String(dev.deviceId) === String(devId)) || (devName && dev.name === devName)) {
                matched = dev;
                break;
              }
            }
            if (!matched) {
              const key = devId || devName;
              matched = {
                deviceId: key,
                name: devName || ('Máy ' + String(key).slice(-6)),
                platform: 'Windows',
                lastSeen: s.created_at || '',
                draftCount: 0,
                submittedCount: 0
              };
              devicesMap.set(key, matched);
            }
            matched.submittedCount++;
            if (devName && (matched.name === 'Máy không tên' || matched.name.startsWith('Thiết bị ') || matched.name.startsWith('Máy '))) {
              matched.name = devName;
            }
            if (s.created_at && (!matched.lastSeen || new Date(s.created_at) > new Date(matched.lastSeen))) {
              matched.lastSeen = s.created_at;
            }
          }
        });
      }
    } catch (_) {}

    return Array.from(devicesMap.values());
  };

  // Backward-compatible name: device removal is now an audited revoke, never
  // a destructive REST DELETE. Existing callers (including old content
  // scripts) are routed through the canonical owner RPC.
  SupabaseCloud.deleteDevice = async function(targetDeviceId) {
    if (!targetDeviceId) return { ok: false };
    if (!isBackground) {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'deleteDevice', deviceId: targetDeviceId }, response => {
          const lastErr = chrome.runtime.lastError;
          if (lastErr) { resolve({ ok: false }); return; }
          resolve(response || { ok: false });
        });
      });
    }

    const shopId = await this._getActiveShopId();
    if (!shopId) return { ok: false, error: 'SHOP_REQUIRED' };
    const result = await this.rpc('owner_revoke_device', {
      p_shop_id: shopId,
      p_device_id: targetDeviceId,
      p_reason: 'LEGACY_CLIENT_REVOKE'
    });
    return {
      ok: !!(result && result.ok && result.data && result.data.success !== false),
      data: result?.data || null,
      error: result?.error || null,
      status: result?.status
    };
  };

  SupabaseCloud.adoptDeviceProfile = async function(oldDeviceId, newName) {
    if (oldDeviceId && oldDeviceId !== this._deviceId) {
      try { await this.deleteDevice(oldDeviceId); } catch (_) {}
    }
    if (newName) {
      await this.setDeviceName(newName);
    }
    return await this.registerDevice();
  };

  SupabaseCloud._getActiveShopId = async function() {
    try {
      if (typeof AuthSession !== 'undefined' && AuthSession.getActiveShop) {
        const id = await AuthSession.getActiveShop();
        if (id) return id;
      }
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        return new Promise(resolve => {
          chrome.storage.local.get(['vnpost_session'], r => {
            if (r.vnpost_session && r.vnpost_session.active_shop_id) {
              resolve(r.vnpost_session.active_shop_id);
            } else {
              resolve(null);
            }
          });
        });
      }
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem('vnpost_session');
        if (raw) {
          try {
            const s = JSON.parse(raw);
            if (s && s.active_shop_id) return s.active_shop_id;
          } catch (_) {}
        }
      }
    } catch (e) {
      return null;
    }
    return null;
  };

  // ─── ORDERS MANAGEMENT ───
  SupabaseCloud.pushOrders = async function(orders) {
    if (!Array.isArray(orders) || orders.length === 0) return true;

    if (!isBackground && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      try {
        const bgRes = await new Promise(resolve => {
          chrome.runtime.sendMessage({ action: 'pushOrders', orders }, resp => {
            if (chrome.runtime.lastError) resolve(null);
            else resolve(resp);
          });
        });
        if (bgRes && bgRes.ok) return true;
      } catch (_) {}
    }

    try {
      await this.loadConfig();
      const shopId = await this._getActiveShopId();
      const token = await this._sessionToken();

      const records = orders.map(o => {
        const rec = {
          id: o.id || 'ord_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
          name: o.name || o.customer_name || '',
          customer_name: o.name || o.customer_name || '',
          phone: o.phone || '',
          address: o.address || '',
          order_code: o.orderCode || o.order_code || '',
          cod_amount: Number(o.codAmount || o.cod_amount) || 0,
          collect_fee: typeof o.collectFee === 'boolean' ? (o.collectFee ? 1 : 0) : (Number(o.collectFee) || 0),
          platform: this._normalizeCarrierCode(o.platform || o.carrier || o.carrier_id) || 'vnpost',
          created_at: o.createdAt || o.created_at || new Date().toISOString(),
          device_name: o.deviceName || this._deviceName || '',
          status: o.status || 'draft'
        };
        const sId = o.shopId || o.shop_id || shopId;
        if (sId) rec.shop_id = sId;
        return rec;
      });

      const resp = await fetch(this._url('orders'), {
        method: 'POST',
        headers: this._headers(token),
        body: JSON.stringify(records)
      });
      return resp.ok;
    } catch (e) {
      console.warn('[SupabaseCloud] pushOrders error:', e);
      return false;
    }
  };

  SupabaseCloud.pushOrder = async function(order) {
    if (!order) return false;

    if (!isBackground && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      try {
        const bgRes = await new Promise(resolve => {
          chrome.runtime.sendMessage({ action: 'pushOrder', order }, resp => {
            if (chrome.runtime.lastError) resolve(null);
            else resolve(resp);
          });
        });
        if (bgRes && bgRes.ok) return true;
      } catch (_) {}
    }

    try {
      await this.loadConfig();
      const id = order.id || 'ord_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      const shopId = order.shopId || order.shop_id || await this._getActiveShopId();
      const token = await this._sessionToken();
      const rec = {
        id: id,
        name: order.name || order.customer_name || '',
        customer_name: order.name || order.customer_name || '',
        phone: order.phone || '',
        address: order.address || '',
        order_code: order.orderCode || order.order_code || '',
        cod_amount: Number(order.codAmount || order.cod_amount) || 0,
        collect_fee: typeof order.collectFee === 'boolean' ? (order.collectFee ? 1 : 0) : (Number(order.collectFee) || 0),
        platform: this._normalizeCarrierCode(order.platform || order.carrier || order.carrier_id) || 'vnpost',
        created_at: order.createdAt || order.created_at || new Date().toISOString(),
        device_name: order.deviceName || this._deviceName || '',
        status: order.status || 'draft'
      };
      if (shopId) rec.shop_id = shopId;

      const resp = await fetch(this._url('orders'), {
        method: 'POST',
        headers: this._headers(token),
        body: JSON.stringify([rec])
      });
      return resp.ok;
    } catch (e) {
      console.warn('[SupabaseCloud] pushOrder error:', e);
      return false;
    }
  };

  SupabaseCloud.fetchOrders = async function(customShopId = null) {
    try {
      await this.loadConfig();
      const shopId = customShopId || await this._getActiveShopId();
      const token = await this._sessionToken();
      let path = 'orders?deleted_at=is.null&order=created_at.desc&limit=1000&select=*';
      if (shopId) {
        path = `orders?shop_id=eq.${encodeURIComponent(shopId)}&deleted_at=is.null&order=created_at.desc&limit=1000&select=*`;
      }
      const resp = await fetch(this._url(path), {
        headers: this._headers(token),
        cache: 'no-store'
      });
      if (resp.ok) {
        const data = await resp.json();
        if (Array.isArray(data)) {
          return data.map(o => ({
            id: o.id,
            shopId: o.shop_id || o.shopId || shopId || '',
            shop_id: o.shop_id || o.shopId || shopId || '',
            name: o.name || o.customer_name || '',
            phone: o.phone || '',
            address: o.address || '',
            orderCode: o.order_code || o.orderCode || '',
            codAmount: Number(o.cod_amount) || 0,
            collectFee: o.collect_fee === true,
            platform: SupabaseCloud._normalizeCarrierCode(o.platform || o.carrier || o.carrier_id),
            createdAt: o.created_at || o.createdAt || '',
            deviceName: o.device_name || o.deviceName || '',
            status: o.status || 'draft'
          }));
        }
      }
    } catch (_) {}

    if (!isBackground && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'fetchOrders', shopId: customShopId }, response => {
          const lastErr = chrome.runtime.lastError;
          if (lastErr) { resolve([]); return; }
          if (response && response.error) resolve([]);
          else resolve(response || []);
        });
      });
    }

    return [];
  };

  SupabaseCloud.deleteOrder = async function(orderId) {
    if (!orderId) return false;
    if (!isBackground && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      try {
        const bgRes = await new Promise(resolve => {
          chrome.runtime.sendMessage({ action: 'deleteOrder', orderId }, resp => {
            if (chrome.runtime.lastError) resolve(null);
            else resolve(resp);
          });
        });
        if (bgRes && bgRes.ok) return true;
      } catch (_) {}
    }

    try {
      await this.loadConfig();
      const token = await this._sessionToken();
      const resp = await fetch(this._url(`orders?id=eq.${encodeURIComponent(orderId)}`), {
        method: 'DELETE',
        headers: this._headers(token)
      });
      return resp.ok;
    } catch (e) {
      console.warn('[SupabaseCloud] deleteOrder error:', e);
      return false;
    }
  };

  SupabaseCloud.deleteBulkOrdersCloud = async function(ids) {
    if (!Array.isArray(ids) || ids.length === 0) return true;
    if (!isBackground && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      try {
        const bgRes = await new Promise(resolve => {
          chrome.runtime.sendMessage({ action: 'deleteBulkOrdersCloud', ids }, resp => {
            if (chrome.runtime.lastError) resolve(null);
            else resolve(resp);
          });
        });
        if (bgRes && bgRes.ok) return true;
      } catch (_) {}
    }

    try {
      await this.loadConfig();
      const token = await this._sessionToken();
      const formattedIds = ids.map(id => `"${String(id).replace(/"/g, '')}"`).join(',');
      const [resp1, resp2] = await Promise.all([
        fetch(this._url(`orders?id=in.(${formattedIds})`), { method: 'DELETE', headers: this._headers(token) }),
        fetch(this._url(`history?id=in.(${formattedIds})`), { method: 'DELETE', headers: this._headers(token) })
      ]);
      return resp1.ok || resp2.ok;
    } catch (e) {
      console.warn('[SupabaseCloud] deleteBulkOrdersCloud error:', e);
      return false;
    }
  };

  // ─── SUBMITTED ORDERS MANAGEMENT ───
  SupabaseCloud._sanitizeShopId = function(shopId) {
    const isUUID = str => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str.trim());
    if (shopId && isUUID(shopId)) return shopId.trim();
    return 'c201e6bc-8986-4f91-b900-e319865d1907';
  };

  SupabaseCloud.pushSubmittedOrders = async function(orders) {
    if (!isBackground) {
      const rawShopId = await this._getActiveShopId();
      const shopId = this._sanitizeShopId(rawShopId);
      const mapped = orders.map(o => ({ ...o, shopId: this._sanitizeShopId(o.shopId || o.shop_id || shopId), shop_id: this._sanitizeShopId(o.shop_id || o.shopId || shopId) }));
      return new Promise(resolve => {
        chrome.runtime.sendMessage({ action: 'pushSubmittedOrders', orders: mapped }, resolve);
      });
    }

    if (!Array.isArray(orders) || orders.length === 0) return true;
    const rawShopId = orders[0]?.shopId || orders[0]?.shop_id || await this._getActiveShopId();
    const shopId = this._sanitizeShopId(rawShopId);
    
    // Tự động lấy device_id và staff_name từ storage nếu đơn hàng chưa có
    let defaultDevId = this._deviceId || '';
    let defaultStaff = this._deviceName || '';
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local && (!defaultDevId || !defaultStaff)) {
        const stored = await new Promise(r => chrome.storage.local.get(['device_id', 'staff_name', 'device_name'], r));
        if (!defaultDevId && stored?.device_id) defaultDevId = stored.device_id;
        if (!defaultStaff && stored?.staff_name) defaultStaff = stored.staff_name;
      }
    } catch (_) {}

    const records = orders.filter(o => this._hasSubmittedCustomer(o)).map(o => {
      const orderShopId = this._sanitizeShopId(o.shopId || o.shop_id || shopId);
      const rec = {
        id: o.id || this._stableSubmittedOrderId(o) || 'sub_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        saved_order_id: o.savedOrderId || '',
        name: o.name || '',
        phone: o.phone || '',
        address: o.address || '',
        order_code: o.orderCode || '',
        cod_amount: Number(o.codAmount) || 0,
        collect_fee: !!o.collectFee,
        platform: this._normalizeCarrierCode(o.platform || o.carrier || o.carrier_id),
        tracking_code: o.trackingCode || '',
        submitted_at: o.submittedAt || new Date().toISOString(),
        submitted_date: o.submittedDate || '',
        device_name: o.deviceName || this._deviceName || '',
        carrier_account: o.carrierAccount || o.carrier_account || '',
        product_note: o.productNote || o.product_note || '',
        weight: Number(o.weight) || 0,
        source: o.source || 'AUTO_FILL',
        created_by_name: o.created_by_name || o.staffName || defaultStaff || '',
        source_device_id: o.source_device_id || o.deviceId || defaultDevId || ''
      };
      if (orderShopId) rec.shop_id = orderShopId;
      return rec;
    });

    if (records.length === 0) return true;

    const token = await this._sessionToken();
    const resp = await fetch(this._url('submitted_orders'), {
      method: 'POST',
      headers: { ...this._headers(token), 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify(records)
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      console.warn('[SupabaseCloud.pushSubmittedOrders] Direct POST error:', resp.status, errText);
      // Fallback qua RPC sync_offline_submitted_orders nếu trực tiếp bảng PostgREST bị chặn (RLS hoặc phiên PIN)
      if (shopId) {
        const rpcRes = await this.rpc('sync_offline_submitted_orders', {
          p_orders: records,
          p_shop_id: shopId,
          p_access_key: token
        });
        if (rpcRes.ok && rpcRes.data?.success) {
          return true;
        }
        console.warn('[SupabaseCloud.pushSubmittedOrders] RPC fallback error:', rpcRes.error || rpcRes.data?.message);
      }
      throw new Error(`Đồng bộ đơn hàng lên Cloud thất bại (HTTP ${resp.status})`);
    }
    return true;
  };

  SupabaseCloud.pushSubmittedOrder = async function(order) {
    if (!isBackground) {
      const rawShopId = await this._getActiveShopId();
      const shopId = this._sanitizeShopId(order.shopId || order.shop_id || rawShopId);
      return new Promise(resolve => {
        chrome.runtime.sendMessage({ action: 'pushSubmittedOrder', order: { ...order, shopId: shopId, shop_id: shopId } }, resolve);
      });
    }

    if (!this._hasSubmittedCustomer(order)) {
      const tracking = order.trackingCode || order.tracking_code || order.waybill_code || '';
      const targetId = order.id || order.savedOrderId || order.saved_order_id || '';
      return targetId && tracking ? await this.updateSubmittedOrderTracking(targetId, tracking) : false;
    }

    const id = order.id || this._stableSubmittedOrderId(order) || 'sub_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const rawShopId = order.shopId || order.shop_id || await this._getActiveShopId();
    const shopId = this._sanitizeShopId(rawShopId);

    // Tự động lấy device_id và staff_name từ storage nếu đơn hàng chưa có
    let devId = order.source_device_id || order.deviceId || this._deviceId || '';
    let staffName = order.created_by_name || order.staffName || this._deviceName || '';
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local && (!devId || !staffName)) {
        const stored = await new Promise(r => chrome.storage.local.get(['device_id', 'staff_name', 'device_name'], r));
        if (!devId && stored?.device_id) devId = stored.device_id;
        if (!staffName && stored?.staff_name) staffName = stored.staff_name;
      }
    } catch (_) {}

    const rec = {
      id: id,
      saved_order_id: order.savedOrderId || '',
      name: order.name || '',
      phone: order.phone || '',
      address: order.address || '',
      order_code: order.orderCode || '',
      cod_amount: Number(order.codAmount) || 0,
      collect_fee: !!order.collectFee,
      platform: this._normalizeCarrierCode(order.platform || order.carrier || order.carrier_id),
      tracking_code: order.trackingCode || '',
      submitted_at: order.submittedAt || new Date().toISOString(),
      submitted_date: order.submittedDate || '',
      device_name: order.deviceName || this._deviceName || '',
      carrier_account: order.carrierAccount || order.carrier_account || '',
      product_note: order.productNote || order.product_note || '',
      weight: Number(order.weight) || 0,
      source: order.source || 'AUTO_FILL',
      created_by_name: staffName,
      staff_name: staffName,
      source_device_id: devId,
      raw_text: order.rawText || order.raw_text || ''
    };
    if (shopId) rec.shop_id = shopId;

    const token = await this._sessionToken();
    const resp = await fetch(this._url('submitted_orders'), {
      method: 'POST',
      headers: { ...this._headers(token), 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify([rec])
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      console.warn('[SupabaseCloud.pushSubmittedOrder] Direct POST error:', resp.status, errText);
      // Fallback qua RPC sync_offline_submitted_orders nếu ghi PostgREST thất bại
      if (shopId) {
        const rpcRes = await this.rpc('sync_offline_submitted_orders', {
          p_orders: [rec],
          p_shop_id: shopId,
          p_access_key: token
        });
        if (rpcRes.ok && rpcRes.data?.success) {
          return true;
        }
        console.warn('[SupabaseCloud.pushSubmittedOrder] RPC fallback error:', rpcRes.error || rpcRes.data?.message);
      }
      return false;
    }
    return resp.ok;
  };

  SupabaseCloud.fetchSubmittedOrders = async function(customShopId = null) {
    if (!isBackground && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'fetchSubmittedOrders', shopId: customShopId }, response => {
          const lastErr = chrome.runtime.lastError;
          if (lastErr || !response || response.error) {
            resolve([]);
          } else {
            resolve(response.orders || (Array.isArray(response) ? response : []));
          }
        });
      });
    }

    try {
      await this.loadConfig();
      const shopId = customShopId || await this._getActiveShopId();
      const token = await this._sessionToken();
      let path = 'submitted_orders?order=submitted_at.desc&limit=1000&select=*';
      if (shopId) {
        path = `submitted_orders?shop_id=eq.${encodeURIComponent(shopId)}&order=submitted_at.desc&limit=1000&select=*`;
      }
      const resp = await fetch(this._url(path), {
        headers: this._headers(token),
        cache: 'no-store'
      });
      if (resp.ok) {
        const data = await resp.json();
        if (Array.isArray(data)) {
          return data.map(o => {
            const codVal = Number(o.cod_amount !== undefined ? o.cod_amount : (o.codAmount !== undefined ? o.codAmount : (o.cod || 0))) || 0;
            const isRecipientFee = o.collect_fee === true || o.shipping_fee_payer === 'RECIPIENT' || o.collectFee === true;
            return {
              id: o.id,
              shopId: o.shop_id || o.shopId || shopId || '',
              shop_id: o.shop_id || o.shopId || shopId || '',
              savedOrderId: o.saved_order_id || o.savedOrderId || '',
              saved_order_id: o.saved_order_id || o.savedOrderId || '',
              name: o.name || o.customer_name || '',
              customer_name: o.name || o.customer_name || '',
              phone: o.phone || '',
              address: o.address || '',
              orderCode: o.order_code || o.orderCode || '',
              order_code: o.order_code || o.orderCode || '',
              codAmount: codVal,
              cod_amount: codVal,
              collectFee: isRecipientFee,
              collect_fee: isRecipientFee,
              platform: SupabaseCloud._normalizeCarrierCode(o.platform || o.carrier || o.carrier_id),
              trackingCode: o.tracking_code || o.trackingCode || '',
              tracking_code: o.tracking_code || o.trackingCode || '',
              submittedAt: o.submitted_at || o.submittedAt || '',
              submitted_at: o.submitted_at || o.submittedAt || '',
              submittedDate: o.submitted_date || o.submittedDate || '',
              submitted_date: o.submitted_date || o.submittedDate || '',
              deviceName: o.device_name || o.deviceName || '',
              device_name: o.device_name || o.deviceName || '',
              carrierAccount: o.carrier_account || o.carrierAccount || '',
              carrier_account: o.carrier_account || o.carrierAccount || '',
              productNote: o.product_note || o.productNote || '',
              product_note: o.product_note || o.productNote || '',
              weight: Number(o.weight) || 0,
              status: o.status || 'submitted',
              shippingFee: Number(o.shipping_fee) || 0,
              shipping_fee: Number(o.shipping_fee) || 0,
              actualWeight: Number(o.actual_weight) || 0,
              actual_weight: Number(o.actual_weight) || 0,
              webhookLogs: Array.isArray(o.webhook_logs) ? o.webhook_logs : (typeof o.webhook_logs === 'string' ? (JSON.parse(o.webhook_logs || '[]')) : []),
              webhook_logs: Array.isArray(o.webhook_logs) ? o.webhook_logs : (typeof o.webhook_logs === 'string' ? (JSON.parse(o.webhook_logs || '[]')) : []),
              updatedAt: o.updated_at || o.updatedAt || '',
              updated_at: o.updated_at || o.updatedAt || ''
            };
          });
        }
      } else if (shopId) {
        // Fallback qua RPC device_fetch_submitted_orders cho phiên thiết bị / PIN
        const rpcRes = await this.rpc('device_fetch_submitted_orders', {
          p_shop_id: shopId,
          p_session_token: token,
          p_limit: 1000
        });
        if (rpcRes.ok && rpcRes.data?.success && Array.isArray(rpcRes.data.orders)) {
          return rpcRes.data.orders.map(o => {
            const codVal = Number(o.cod_amount !== undefined ? o.cod_amount : (o.codAmount !== undefined ? o.codAmount : (o.cod || 0))) || 0;
            const isRecipientFee = o.collect_fee === true || o.shipping_fee_payer === 'RECIPIENT' || o.collectFee === true;
            return {
              id: o.id,
              shopId: o.shop_id || o.shopId || shopId || '',
              shop_id: o.shop_id || o.shopId || shopId || '',
              savedOrderId: o.saved_order_id || o.savedOrderId || '',
              saved_order_id: o.saved_order_id || o.savedOrderId || '',
              name: o.name || o.customer_name || '',
              customer_name: o.name || o.customer_name || '',
              phone: o.phone || '',
              address: o.address || '',
              orderCode: o.order_code || o.orderCode || '',
              order_code: o.order_code || o.orderCode || '',
              codAmount: codVal,
              cod_amount: codVal,
              collectFee: isRecipientFee,
              collect_fee: isRecipientFee,
              platform: SupabaseCloud._normalizeCarrierCode(o.platform || o.carrier || o.carrier_id),
              trackingCode: o.tracking_code || o.trackingCode || '',
              tracking_code: o.tracking_code || o.trackingCode || '',
              submittedAt: o.submitted_at || o.submittedAt || '',
              submitted_at: o.submitted_at || o.submittedAt || '',
              submittedDate: o.submitted_date || o.submittedDate || '',
              submitted_date: o.submitted_date || o.submittedDate || '',
              deviceName: o.device_name || o.deviceName || '',
              device_name: o.device_name || o.deviceName || '',
              carrierAccount: o.carrier_account || o.carrierAccount || '',
              carrier_account: o.carrier_account || o.carrierAccount || '',
              productNote: o.product_note || o.productNote || '',
              product_note: o.product_note || o.productNote || '',
              weight: Number(o.weight) || 0,
              status: o.status || 'submitted',
              shippingFee: Number(o.shipping_fee) || 0,
              shipping_fee: Number(o.shipping_fee) || 0,
              actualWeight: Number(o.actual_weight) || 0,
              actual_weight: Number(o.actual_weight) || 0,
              webhookLogs: Array.isArray(o.webhook_logs) ? o.webhook_logs : (typeof o.webhook_logs === 'string' ? (JSON.parse(o.webhook_logs || '[]')) : []),
              webhook_logs: Array.isArray(o.webhook_logs) ? o.webhook_logs : (typeof o.webhook_logs === 'string' ? (JSON.parse(o.webhook_logs || '[]')) : []),
              updatedAt: o.updated_at || o.updatedAt || '',
              updated_at: o.updated_at || o.updatedAt || ''
            };
          });
        }
      }
    } catch (_) {}

    return [];
  };

  SupabaseCloud.deleteSubmittedOrderCloud = async function(orderId) {
    if (!orderId) return false;
    if (!isBackground && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      try {
        const bgRes = await new Promise((resolve) => {
          chrome.runtime.sendMessage({ action: 'deleteSubmittedOrderCloud', orderId }, response => {
            const lastErr = chrome.runtime.lastError;
            if (lastErr) { resolve(null); return; }
            resolve(response ? response.ok : false);
          });
        });
        if (bgRes !== null) return bgRes;
      } catch (_) {}
    }

    try {
      await this.loadConfig();
      const token = await this._sessionToken();
      const resp = await fetch(this._url(`submitted_orders?id=eq.${encodeURIComponent(orderId)}`), {
        method: 'DELETE',
        headers: this._headers(token)
      });
      return resp.ok;
    } catch (e) {
      console.warn('[SupabaseCloud] deleteSubmittedOrderCloud error:', e);
      return false;
    }
  };

  SupabaseCloud.deleteOrderCloud = async function(orderId) {
    if (!orderId) return false;
    if (!isBackground && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      try {
        const bgRes = await new Promise((resolve) => {
          chrome.runtime.sendMessage({ action: 'deleteOrderCloud', id: orderId }, response => {
            const lastErr = chrome.runtime.lastError;
            if (lastErr) { resolve(null); return; }
            resolve(response ? response.ok : false);
          });
        });
        if (bgRes !== null) return bgRes;
      } catch (_) {}
    }

    try {
      await this.loadConfig();
      const token = await this._sessionToken();
      const encId = encodeURIComponent(orderId);
      let deleted_by = null;
      if (typeof AuthSession !== 'undefined') {
        const user = await AuthSession.getUser();
        if (user) deleted_by = user.id;
      }
      const patchData = { deleted_at: new Date().toISOString(), deleted_by };
      
      const [resp1, resp2] = await Promise.all([
        fetch(this._url(`orders?id=eq.${encId}`), { 
          method: 'PATCH', 
          headers: { ...this._headers(token), 'Content-Type': 'application/json' },
          body: JSON.stringify(patchData)
        }),
        fetch(this._url(`history?id=eq.${encId}`), { 
          method: 'PATCH', 
          headers: { ...this._headers(token), 'Content-Type': 'application/json' },
          body: JSON.stringify(patchData)
        })
      ]);
      return resp1.ok || resp2.ok;
    } catch (e) {
      console.warn('[SupabaseCloud] deleteOrderCloud error:', e);
      return false;
    }
  };

  SupabaseCloud.deleteHistoryOrder = SupabaseCloud.deleteOrderCloud;

  SupabaseCloud.deleteBulkSubmittedOrdersCloud = async function(ids) {
    if (!Array.isArray(ids) || ids.length === 0) return true;
    if (!isBackground && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      try {
        const bgRes = await new Promise(resolve => {
          chrome.runtime.sendMessage({ action: 'deleteBulkSubmittedOrdersCloud', ids }, resolve);
        });
        if (bgRes !== null) return bgRes;
      } catch (_) {}
    }

    try {
      await this.loadConfig();
      const token = await this._sessionToken();
      const idList = ids.map(id => `"${String(id).replace(/"/g, '')}"`).join(',');
      let deleted_by = null;
      if (typeof AuthSession !== 'undefined') {
        const user = await AuthSession.getUser();
        if (user) deleted_by = user.id;
      }
      const patchData = { deleted_at: new Date().toISOString(), deleted_by };

      const resp = await fetch(this._url(`submitted_orders?id=in.(${idList})`), {
        method: 'PATCH',
        headers: { ...this._headers(token), 'Content-Type': 'application/json' },
        body: JSON.stringify(patchData)
      });
      return resp.ok;
    } catch (e) {
      console.warn('[SupabaseCloud] deleteBulkSubmittedOrdersCloud error:', e);
      return false;
    }
  };

  SupabaseCloud.clearSubmittedOrdersCloud = async function() {
    if (!isBackground) {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'clearSubmittedOrdersCloud' }, response => {
          const lastErr = chrome.runtime.lastError;
          if (lastErr) { resolve(false); return; }
          resolve(response ? response.ok : false);
        });
      });
    }

    await this.loadConfig();
    let deleted_by = null;
    if (typeof AuthSession !== 'undefined') {
        const user = await AuthSession.getUser();
        if (user) deleted_by = user.id;
    }
    const patchData = { deleted_at: new Date().toISOString(), deleted_by };

    const resp = await fetch(this._url('submitted_orders?id=not.is.null'), {
      method: 'PATCH',
      headers: { ...this._headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify(patchData)
    });
    return resp.ok;
  };

  SupabaseCloud.clearHistoryCloud = async function() {
    if (!isBackground) {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'clearHistoryCloud' }, response => {
          const lastErr = chrome.runtime.lastError;
          if (lastErr) { resolve(false); return; }
          resolve(response ? response.ok : false);
        });
      });
    }

    const resp = await fetch(this._url('history?id=not.is.null'), {
      method: 'DELETE',
      headers: this._headers()
    });
    return resp.ok;
  };

  SupabaseCloud.pushCustomersCloud = async function(customers) {
    if (!isBackground) {
      return new Promise(resolve => {
        chrome.runtime.sendMessage({ action: 'pushCustomersCloud', customers }, resolve);
      });
    }

    if (!Array.isArray(customers) || customers.length === 0) return true;
    const shopId = await this._getActiveShopId();

    const records = customers.map(c => {
      let validLatestDate = new Date().toISOString();
      if (c.latestDate) {
        const parsed = new Date(c.latestDate);
        if (!isNaN(parsed.getTime())) validLatestDate = parsed.toISOString();
      }

      const cleanPhone = (c.cleanPhone || c.phone || '').replace(/\D/g, '');
      const rawName = (c.name || c.customer_name || 'Khách hàng').trim();
      const phoneKey = cleanPhone ? cleanPhone : ('no_phone_' + rawName.toLowerCase().replace(/[^a-z0-9]/g, '_'));

      const rec = {
        phone: phoneKey,
        name: rawName,
        address: c.address || '—',
        province: c.province || '',
        segment: c.segment || 'new',
        total_orders: Number(c.count || c.totalOrders || 1),
        total_cod: Number(c.totalCod || 0),
        latest_date: validLatestDate,
        fav_carrier: c.favCarrier || c.platform || '',
        facebook_url: c.facebookUrl || '',
        tags: c.tags || '',
        notes: c.notes || c.note || '',
        updated_at: new Date().toISOString()
      };
      if (shopId) rec.shop_id = shopId;
      return rec;
    });

    const resp = await fetch(this._url('customers'), {
      method: 'POST',
      headers: { ...this._headers(), 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify(records)
    });
    return resp.ok;
  };

  SupabaseCloud.fetchCustomersCloud = async function() {
    if (!isBackground) {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'fetchCustomersCloud' }, response => {
          const lastErr = chrome.runtime.lastError;
          if (lastErr) { resolve([]); return; }
          if (response && response.error) resolve([]);
          else resolve(response || []);
        });
      });
    }

    const resp = await fetch(this._url('customers?select=*&order=updated_at.desc&limit=1000'), {
      headers: this._headers(),
      cache: 'no-store'
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data || []).map(c => {
      const isFakePhone = (c.phone || '').startsWith('no_phone_');
      const displayPhone = isFakePhone ? '—' : (c.phone || '');
      const cleanPhone = isFakePhone ? '' : (c.phone || '').replace(/\D/g, '');
      return {
        name: c.name || '',
        phone: displayPhone,
        cleanPhone: cleanPhone,
        address: c.address || '',
        province: c.province || '',
        segment: c.segment || 'new',
        count: c.total_orders || 1,
        totalOrders: c.total_orders || 1,
        totalCod: Number(c.total_cod) || 0,
        latestDate: c.latest_date || '',
        favCarrier: c.fav_carrier || '',
        facebookUrl: c.facebook_url || '',
        tags: c.tags || '',
        notes: c.notes || ''
      };
    });
  };

  SupabaseCloud.clearCustomersCloud = async function() {
    if (!isBackground) {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'clearCustomersCloud' }, response => {
          const lastErr = chrome.runtime.lastError;
          if (lastErr) { resolve(false); return; }
          resolve(response ? response.ok : false);
        });
      });
    }

    const resp = await fetch(this._url('customers?name=not.is.null'), {
      method: 'DELETE',
      headers: this._headers()
    });
    return resp.ok;
  };

  SupabaseCloud.clearAllCloudData = async function() {
    const res1 = await this.clearSubmittedOrdersCloud();
    const res2 = await this.clearHistoryCloud();
    const res3 = await this.clearCustomersCloud();
    return res1 && res2 && res3;
  };

  // ─── HISTORY MANAGEMENT ───
  SupabaseCloud.pushHistory = async function(entries) {
    if (!isBackground) {
      return new Promise(resolve => {
        chrome.runtime.sendMessage({ action: 'pushHistory', entries }, resolve);
      });
    }

    if (!Array.isArray(entries) || entries.length === 0) return true;
    const shopId = await this._getActiveShopId();

    const records = entries.map(entry => {
      const res = entry.result || {};
      const waybill = res.waybillCode || res.maVanDon || res.trackingCode || entry.waybill_code || entry.ma_van_don || '';
      
      let validCreatedAt = new Date().toISOString();
      const rawDate = entry.createdAt || entry.created_at || '';
      if (rawDate) {
        const parsed = new Date(rawDate);
        if (!isNaN(parsed.getTime())) validCreatedAt = parsed.toISOString();
      }

      const rec = {
        id: entry.id || 'hist_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        raw_text: entry.rawText || entry.raw_text || '',
        customer_name: (entry.customer_name || entry.name || res.name || res.recipientName || 'Khách hàng').trim(),
        phone: (entry.phone || res.phone || res.recipientPhone || '').trim(),
        address: (entry.address || res.normalizedAddress || res.address || '').trim(),
        order_code: entry.order_code || entry.orderCode || res.orderCode || res.maDon || '',
        waybill_code: waybill,
        cod_amount: Number(entry.cod_amount || entry.codAmount || res.codAmount || res.cod || 0),
        platform: entry.platform || res.platform || 'vnpost',
        created_at: validCreatedAt,
        created_at_short: entry.createdAtShort || '',
        device_name: entry.deviceName || entry.device_name || this._deviceName || '',
        result: res
      };
      if (shopId) rec.shop_id = shopId;
      return rec;
    });

    const resp = await fetch(this._url('history'), {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify(records)
    });
    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      console.error("Lỗi push history sang Supabase:", resp.status, errText);
      return false;
    }
    return true;
  };

  SupabaseCloud.fetchHistory = async function() {
    if (!isBackground) {
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: 'fetchHistory' }, response => {
          const lastErr = chrome.runtime.lastError;
          if (lastErr) { resolve([]); return; }
          if (response && response.error) resolve([]);
          else resolve(response || []);
        });
      });
    }

    const resp = await fetch(this._url('history?select=*&order=created_at.desc&limit=1000'), {
      headers: this._headers(),
      cache: 'no-store'
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data || []).map(h => ({
      id: h.id,
      rawText: h.raw_text || h.rawText || '',
      name: h.customer_name || h.name || '',
      customer_name: h.customer_name || h.name || '',
      phone: h.phone || '',
      address: h.address || '',
      orderCode: h.order_code || h.orderCode || '',
      order_code: h.order_code || h.orderCode || '',
      waybillCode: h.waybill_code || h.waybillCode || '',
      waybill_code: h.waybill_code || h.waybillCode || '',
      codAmount: Number(h.cod_amount) || 0,
      cod_amount: Number(h.cod_amount) || 0,
      platform: h.platform || '',
      createdAt: h.created_at || h.createdAt || '',
      created_at: h.created_at || h.createdAt || '',
      createdAtShort: h.created_at_short || h.createdAtShort || '',
      deviceName: h.device_name || h.deviceName || '',
      result: h.result || {}
    }));
  };

  // ─── SETTINGS & API KEY ───
  SupabaseCloud.pushApiKey = async function(apiKey) {
    if (!isBackground) {
      return new Promise(resolve => {
        chrome.runtime.sendMessage({ action: 'pushApiKey', apiKey }, resolve);
      });
    }

    const resp = await fetch(this._url('settings'), {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify([{
        key: 'groq_api_key',
        value: { key: apiKey }
      }])
    });
    return resp.ok;
  };

  SupabaseCloud.fetchApiKey = async function() {
    if (!isBackground) {
      return new Promise(resolve => {
        chrome.runtime.sendMessage({ action: 'fetchApiKey' }, response => {
          const lastErr = chrome.runtime.lastError;
          if (lastErr) { resolve(null); return; }
          resolve(response ? response.key : null);
        });
      });
    }

    const resp = await fetch(this._url('settings?key=eq.groq_api_key&select=value'), {
      headers: this._headers()
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data && data[0] && data[0].value ? data[0].value.key : null;
  };

  SupabaseCloud.pushCustomerMetadata = async function(phone, meta) {
    if (!isBackground) {
      return new Promise(resolve => {
        chrome.runtime.sendMessage({ action: 'pushCustomerMetadata', phone, meta }, resolve);
      });
    }

    const key = 'meta_' + (phone || '').replace(/\D/g, '');
    const resp = await fetch(this._url('settings'), {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify([{
        key: key,
        value: meta
      }])
    });
    return resp.ok;
  };

  SupabaseCloud.fetchCustomersMetadata = async function() {
    if (!isBackground) {
      return new Promise(resolve => {
        chrome.runtime.sendMessage({ action: 'fetchCustomersMetadata' }, response => {
          const lastErr = chrome.runtime.lastError;
          if (lastErr) { resolve({}); return; }
          resolve(response ? response.metadata : {});
        });
      });
    }

    const resp = await fetch(this._url('settings?key=like.meta_*&select=key,value'), {
      headers: this._headers()
    });
    if (!resp.ok) return {};
    const data = await resp.json();
    const result = {};
    (data || []).forEach(row => {
      if (row.key && row.value) {
        const phone = row.key.replace(/^meta_/, '');
        result[phone] = row.value;
      }
    });
    return result;
  };

  // ─── FIREBASE TO SUPABASE MIGRATION ───
  SupabaseCloud._decodeFirestoreFields = function(fields) {
    if (!fields) return {};
    const obj = {};
    for (const [key, val] of Object.entries(fields)) {
      if (val.stringValue !== undefined) obj[key] = val.stringValue;
      else if (val.integerValue !== undefined) obj[key] = Number(val.integerValue);
      else if (val.doubleValue !== undefined) obj[key] = Number(val.doubleValue);
      else if (val.booleanValue !== undefined) obj[key] = val.booleanValue;
      else if (val.timestampValue !== undefined) obj[key] = val.timestampValue;
      else if (val.mapValue !== undefined) obj[key] = this._decodeFirestoreFields(val.mapValue.fields);
      else if (val.arrayValue !== undefined) obj[key] = (val.arrayValue.values || []).map(v => {
        if (v.stringValue !== undefined) return v.stringValue;
        if (v.mapValue !== undefined) return this._decodeFirestoreFields(v.mapValue.fields);
        return v;
      });
    }
    return obj;
  };

  SupabaseCloud._fetchFirestoreREST = async function(projectId, path) {
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}?pageSize=500`;
    try {
      const resp = await fetch(url);
      if (!resp.ok) return [];
      const data = await resp.json();
      const docs = data.documents || [];
      return docs.map(d => {
        const decoded = this._decodeFirestoreFields(d.fields);
        const docId = d.name ? d.name.split('/').pop() : '';
        if (!decoded.id && docId) decoded.id = docId;
        return decoded;
      });
    } catch (e) {
      return [];
    }
  };

  SupabaseCloud.migrateFromFirebase = async function(firebaseProjectId = 'nppdungxuan') {
    if (!isBackground) {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'migrateFirebaseToSupabase', firebaseProjectId }, resolve);
      });
    }

    await this.loadConfig();
    const cfg = this._getConfig();
    if (!cfg.url || !cfg.anonKey || cfg.url.includes('YOUR_SUPABASE')) {
      return { ok: false, error: 'Chưa điền URL & Anon Key trong file backend/supabase/supabase-config.js hoặc trên giao diện Cài đặt' };
    }

    try {
      let totalCount = 0;
      let ordersCount = 0;
      let subCount = 0;
      let histCount = 0;

      // 1. Quét Đơn hàng lưu tạm từ các đường dẫn Firebase phổ biến
      const orderPaths = ['shared/data/orders', 'shared/orders', 'orders'];
      for (const p of orderPaths) {
        const orderDocs = await this._fetchFirestoreREST(firebaseProjectId, p);
        if (orderDocs.length > 0) {
          await this.pushOrders(orderDocs);
          ordersCount += orderDocs.length;
          totalCount += orderDocs.length;
          break;
        }
      }

      // 2. Quét Đơn hàng đã lên đơn từ các đường dẫn Firebase phổ biến
      const subPaths = ['shared/data/submitted_orders', 'shared/submitted_orders', 'submitted_orders'];
      for (const p of subPaths) {
        const subDocs = await this._fetchFirestoreREST(firebaseProjectId, p);
        if (subDocs.length > 0) {
          await this.pushSubmittedOrders(subDocs);
          subCount += subDocs.length;
          totalCount += subDocs.length;
          break;
        }
      }

      // 3. Quét Lịch sử từ các đường dẫn Firebase phổ biến
      const histPaths = ['shared/data/history', 'shared/history', 'history'];
      for (const p of histPaths) {
        const histDocs = await this._fetchFirestoreREST(firebaseProjectId, p);
        if (histDocs.length > 0) {
          await this.pushHistory(histDocs);
          histCount += histDocs.length;
          totalCount += histDocs.length;
          break;
        }
      }

      // 4. Đồng bộ dữ liệu hiện có từ bộ nhớ local máy tính lên Supabase
      if (typeof OrderStorage !== 'undefined') {
        const localOrders = await OrderStorage.getOrders().catch(() => []);
        if (localOrders.length > 0) {
          await this.pushOrders(localOrders);
          if (ordersCount === 0) { ordersCount = localOrders.length; totalCount += localOrders.length; }
        }
        const localSub = await OrderStorage.getSubmittedOrders().catch(() => []);
        if (localSub.length > 0) {
          await this.pushSubmittedOrders(localSub);
          if (subCount === 0) { subCount = localSub.length; totalCount += localSub.length; }
        }
      }

      return { ok: true, count: totalCount, ordersCount, subCount, histCount };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };

  SupabaseCloud.getSystemConfigs = async function() {
    try {
      const resp = await fetch(this._url('system_configs?select=key,value'), {
        headers: this._headers()
      });
      if (resp.ok) {
        return await resp.json();
      }
    } catch (_) {}
    return [];
  };

  // Nạp cấu hình tự động khi mô-đun được nạp
  SupabaseCloud.loadConfig().catch(() => {});

  globalThis.SupabaseCloud = SupabaseCloud;
  // NOTE: FirebaseCloud alias đã bị xóa — xem AUTO_FILL_ORDER_OFFICIAL_SOURCE_AUDIT P0-01
})();
