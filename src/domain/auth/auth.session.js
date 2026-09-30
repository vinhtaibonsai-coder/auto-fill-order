// =========================================================================
// AUTH.SESSION.JS — QUẢN LÝ PHIÊN ĐĂNG NHẬP & SESSION TOKEN
// =========================================================================

const AuthSession = {
  _sessionKey: 'vnpost_session',

  _cachedToken: null,
  _refreshPromise: null,
  _refreshCooldownUntil: 0,

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

    // If cooldown is active (e.g. after a 429), return cached session
    if (Date.now() < this._refreshCooldownUntil) {
      this._updateCachedToken(session);
      return session;
    }

    // Mutex lock: if another refresh is already in-flight, await it
    if (this._refreshPromise) {
      try {
        const refreshed = await this._refreshPromise;
        this._updateCachedToken(refreshed);
        return refreshed || session;
      } catch (_) {
        return session;
      }
    }

    this._refreshPromise = (async () => {
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
          if (resp.status === 429) {
            console.warn('[AuthSession] Token refresh rate-limited (429), entering 30s cooldown.');
            this._refreshCooldownUntil = Date.now() + 30000;
            return session;
          }
          if (this._isRefreshRejection(resp.status, text)) {
            console.info('[AuthSession] Refresh token đã hết hạn hoặc không còn hiệu lực (status ' + resp.status + '). Đang dọn dẹp phiên để đăng nhập lại.');
            await this.clearSession();
            return null;
          }
          console.warn('[AuthSession] Token refresh failed, status:', resp.status);
        }
      } catch (err) {
        console.warn('[AuthSession] Error refreshing token:', err);
      } finally {
        this._updateCachedToken(session);
      }
      return session;
    })();

    try {
      return await this._refreshPromise;
    } finally {
      this._refreshPromise = null;
    }
  },

  async isAuthenticated() {
    try {
      const sess = await this.getSession();
      return !!(sess && ((sess.user && sess.access_token) || (sess.shop_access_key && sess.active_shop_id)));
    } catch (_) {
      return false;
    }
  },

  async getSession() {
    return new Promise(resolve => {
      try {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id && chrome.storage && chrome.storage.local) {
          chrome.storage.local.get([this._sessionKey], async res => {
            if (chrome.runtime && chrome.runtime.lastError) {
              try {
                if (typeof localStorage !== 'undefined') {
                  localStorage.removeItem(this._sessionKey);
                }
                resolve(null);
              } catch (_) { resolve(null); }
              return;
            }
            let sess = res ? res[this._sessionKey] : null;
            if (!sess) {
              // chrome.storage.local là Single Source of Truth trong Extension.
              // Nếu không có session trong extension storage, xóa bỏ session cũ trong localStorage để tránh lỗi zombie session.
              if (typeof localStorage !== 'undefined') {
                try {
                  localStorage.removeItem(this._sessionKey);
                  localStorage.removeItem('af_logged_user');
                  localStorage.removeItem('profile');
                  localStorage.removeItem('currentUser');
                  localStorage.removeItem('activeShopId');
                  localStorage.removeItem('shop_access_key');
                  localStorage.removeItem('staff_name');
                } catch (_) {}
              }
              this._cachedToken = null;
              resolve(null);
              return;
            }
            const finalSess = await AuthSession._checkAndRefreshSession(sess);
            resolve(finalSess);
          });
        } else {
          const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(this._sessionKey) : null;
          const sess = raw ? JSON.parse(raw) : null;
          AuthSession._checkAndRefreshSession(sess).then(resolve).catch(() => resolve(null));
        }
      } catch (e) { resolve(null); }
    });
  },

  async saveSession(sessionData) {
    this._updateCachedToken(sessionData);
    return new Promise(resolve => {
      try {
        const hasExtensionStorage = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id && chrome.storage && chrome.storage.local;
        if (hasExtensionStorage) {
          if (typeof localStorage !== 'undefined') {
            try { localStorage.removeItem(this._sessionKey); } catch (_) {}
          }
          chrome.storage.local.set({ [this._sessionKey]: sessionData }, () => {
            if (typeof AuthEvents !== 'undefined') {
              AuthEvents.emit('AUTH_STATE_CHANGED', {
                isAuthenticated: !!sessionData,
                user: sessionData?.user || null,
                session: sessionData || null
              });
            }
            resolve();
          });
        } else {
          if (typeof localStorage !== 'undefined') {
            try { localStorage.setItem(this._sessionKey, JSON.stringify(sessionData)); } catch (_) {}
          }
          if (typeof AuthEvents !== 'undefined') {
            AuthEvents.emit('AUTH_STATE_CHANGED', {
              isAuthenticated: !!sessionData,
              user: sessionData?.user || null,
              session: sessionData || null
            });
          }
          resolve();
        }
      } catch (e) { resolve(); }
    });
  },

  async clearSession() {
    this._cachedToken = null;
    return new Promise(resolve => {
      try {
        if (typeof localStorage !== 'undefined') {
          try {
            localStorage.removeItem(this._sessionKey);
            localStorage.removeItem('af_logged_user');
            localStorage.removeItem('profile');
            localStorage.removeItem('current_role');
            localStorage.removeItem('current_shop_id');
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            localStorage.removeItem('currentUser');
            localStorage.removeItem('activeShop');
            localStorage.removeItem('activeShopId');
            localStorage.removeItem('shop_access_key');
            localStorage.removeItem('staff_name');
            localStorage.removeItem('shop_name');
          } catch (_) {}
        }
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          const keysToRemove = [
            this._sessionKey,
            'shop_access_key',
            'active_shop_id',
            'currentUser',
            'activeShop',
            'activeShopId',
            'current_shop_id',
            'access_token',
            'refresh_token',
            'fbAuthTokens'
          ];
          chrome.storage.local.remove(keysToRemove, () => {
            if (typeof AuthEvents !== 'undefined') {
              AuthEvents.emit('AUTH_STATE_CHANGED', { isAuthenticated: false, user: null, session: null });
            }
            resolve();
          });
        } else {
          if (typeof AuthEvents !== 'undefined') {
            AuthEvents.emit('AUTH_STATE_CHANGED', { isAuthenticated: false, user: null, session: null });
          }
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
      if (String(session.active_shop_id || '') === String(shopId || '')) {
        return;
      }
      session.active_shop_id = shopId;
      await this.saveSession(session);
    }
  }
};

function _hasAuthIdentityChanged(oldSess, newSess) {
  const oldToken = oldSess ? oldSess.access_token : null;
  const newToken = newSess ? newSess.access_token : null;
  const oldUserId = oldSess?.user?.id || null;
  const newUserId = newSess?.user?.id || null;
  return (!oldSess !== !newSess) || (oldToken !== newToken) || (oldUserId !== newUserId);
}

// Auto-initialize and sync cached token
if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
  chrome.storage.local.get([AuthSession._sessionKey], res => {
    AuthSession._updateCachedToken(res[AuthSession._sessionKey]);
  });
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes[AuthSession._sessionKey]) {
      const oldSession = changes[AuthSession._sessionKey].oldValue || null;
      const newSession = changes[AuthSession._sessionKey].newValue || null;
      AuthSession._updateCachedToken(newSession);
      if (typeof AuthEvents !== 'undefined' && _hasAuthIdentityChanged(oldSession, newSession)) {
        AuthEvents.emit('AUTH_STATE_CHANGED', {
          isAuthenticated: !!newSession,
          user: newSession?.user || null,
          session: newSession || null
        });
      }
    }
  });
} else if (typeof window !== 'undefined' && window.localStorage) {
  let prevLocalSession = null;
  try {
    const raw = localStorage.getItem(AuthSession._sessionKey);
    prevLocalSession = raw ? JSON.parse(raw) : null;
    AuthSession._updateCachedToken(prevLocalSession);
  } catch (_) {}
  window.addEventListener('storage', (e) => {
    if (e.key === AuthSession._sessionKey) {
      try {
        const newSession = e.newValue ? JSON.parse(e.newValue) : null;
        AuthSession._updateCachedToken(newSession);
        if (typeof AuthEvents !== 'undefined' && _hasAuthIdentityChanged(prevLocalSession, newSession)) {
          prevLocalSession = newSession;
          AuthEvents.emit('AUTH_STATE_CHANGED', {
            isAuthenticated: !!newSession,
            user: newSession?.user || null,
            session: newSession || null
          });
        }
      } catch (_) {}
    }
  });
}

if (typeof globalThis !== 'undefined') {
  globalThis.AuthSession = AuthSession;
}
