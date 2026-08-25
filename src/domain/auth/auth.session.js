// =========================================================================
// AUTH.SESSION.JS — QUẢN LÝ PHIÊN ĐĂNG NHẬP & SESSION TOKEN
// =========================================================================

const AuthSession = {
  _sessionKey: 'vnpost_session',

  _cachedToken: null,

  _updateCachedToken(session) {
    this._cachedToken = session ? session.access_token : null;
  },

  async _loadSupabaseConfig() {
    if (typeof SupabaseCloud !== 'undefined' && typeof SupabaseCloud.loadConfig === 'function') {
      return await SupabaseCloud.loadConfig();
    }
    if (typeof globalThis !== 'undefined' && globalThis.SUPABASE_CONFIG) {
      return globalThis.SUPABASE_CONFIG;
    }
    if (typeof SUPABASE_CONFIG !== 'undefined') {
      return SUPABASE_CONFIG;
    }
    return { url: '', anonKey: '' };
  },

  _isRefreshRejection(status, bodyText = '') {
    const text = String(bodyText || '').toLowerCase();
    return status === 400 || status === 401 || status === 403 ||
      text.includes('invalid refresh token') ||
      text.includes('refresh token not found') ||
      text.includes('jwt expired');
  },

  async _checkAndRefreshSession(session) {
    if (!session || !session.refresh_token || !session.expires_at) {
      this._updateCachedToken(session);
      return session;
    }

    // Check if token is expired or expiring in 5 minutes
    if (Date.now() + 300000 < session.expires_at) {
      this._updateCachedToken(session);
      return session;
    }

    try {
      const config = await this._loadSupabaseConfig();
      if (!config || !config.url || !config.anonKey || config.url.includes('YOUR_SUPABASE')) {
        this._updateCachedToken(session);
        return session;
      }

      const resp = await fetch(`${config.url}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: {
          'apikey': config.anonKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refresh_token: session.refresh_token })
      });

      if (resp.ok) {
        const data = await resp.json();
        session.access_token = data.access_token;
        session.refresh_token = data.refresh_token;
        session.expires_at = Date.now() + (data.expires_in || 3600) * 1000;
        if (data.user) {
          session.user = {
            ...session.user,
            ...data.user
          };
        }
        await this.saveSession(session);
        console.log('[AuthSession] Token refreshed successfully.');
      } else {
        const text = await resp.text().catch(() => '');
        console.warn('[AuthSession] Token refresh failed, status:', resp.status);
        if (this._isRefreshRejection(resp.status, text)) {
          await this.clearSession();
          return null;
        }
      }
    } catch (err) {
      console.warn('[AuthSession] Error refreshing token:', err);
    }
    this._updateCachedToken(session);
    return session;
  },

  async getSession() {
    return new Promise(resolve => {
      try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.get([this._sessionKey], async res => {
            const sess = res[this._sessionKey] || null;
            const finalSess = await AuthSession._checkAndRefreshSession(sess);
            resolve(finalSess);
          });
        } else {
          const raw = localStorage.getItem(this._sessionKey);
          const sess = raw ? JSON.parse(raw) : null;
          AuthSession._checkAndRefreshSession(sess).then(resolve);
        }
      } catch (e) { resolve(null); }
    });
  },

  async saveSession(sessionData) {
    this._updateCachedToken(sessionData);
    return new Promise(resolve => {
      try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ [this._sessionKey]: sessionData }, resolve);
        } else {
          localStorage.setItem(this._sessionKey, JSON.stringify(sessionData));
          resolve();
        }
      } catch (e) { resolve(); }
    });
  },

  async clearSession() {
    this._cachedToken = null;
    return new Promise(resolve => {
      try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.remove([this._sessionKey], resolve);
        } else {
          localStorage.removeItem(this._sessionKey);
          resolve();
        }
      } catch (e) { resolve(); }
    });
  },

  // Helpers để lấy nhanh dữ liệu từ session
  async getUser() {
    const session = await this.getSession();
    return session ? session.user : null;
  },
  
  async getActiveShop() {
    const session = await this.getSession();
    return session ? session.active_shop_id : null;
  },

  async getPermissions() {
    const session = await this.getSession();
    return session ? session.permissions : [];
  },
  
  async updateActiveShop(shopId) {
    const session = await this.getSession();
    if (session) {
      session.active_shop_id = shopId;
      await this.saveSession(session);
    }
  }
};

// Auto-initialize and sync cached token
if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
  chrome.storage.local.get([AuthSession._sessionKey], res => {
    AuthSession._updateCachedToken(res[AuthSession._sessionKey]);
  });
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes[AuthSession._sessionKey]) {
      AuthSession._updateCachedToken(changes[AuthSession._sessionKey].newValue);
    }
  });
} else if (typeof window !== 'undefined' && window.localStorage) {
  try {
    const raw = localStorage.getItem(AuthSession._sessionKey);
    AuthSession._updateCachedToken(raw ? JSON.parse(raw) : null);
  } catch (_) {}
  window.addEventListener('storage', (e) => {
    if (e.key === AuthSession._sessionKey) {
      try {
        AuthSession._updateCachedToken(e.newValue ? JSON.parse(e.newValue) : null);
      } catch (_) {}
    }
  });
}

if (typeof globalThis !== 'undefined') {
  globalThis.AuthSession = AuthSession;
}
