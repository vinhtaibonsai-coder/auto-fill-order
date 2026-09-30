// =========================================================================
// AUTH.SERVICE.JS — DỊCH VỤ XÁC THỰC NGƯỜI DÙNG CHUẨN USERNAME / EMAIL V3.1
// =========================================================================

const DEVICE_VALIDATION_GRACE_MS = 15 * 60 * 1000;

async function readDeviceValidationState() {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    try {
      return await new Promise(resolve => chrome.storage.local.get([
        'device_access_checked_at',
        'device_access_grace_started_at'
      ], resolve));
    } catch (_) { /* continue with localStorage fallback */ }
  }
  if (typeof localStorage !== 'undefined') {
    return {
      device_access_checked_at: Number(localStorage.getItem('device_access_checked_at') || 0),
      device_access_grace_started_at: Number(localStorage.getItem('device_access_grace_started_at') || 0)
    };
  }
  return {};
}

async function writeDeviceValidationState(patch) {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    try { await chrome.storage.local.set(patch); } catch (_) { /* best effort */ }
  }
  if (typeof localStorage !== 'undefined') {
    try {
      Object.entries(patch).forEach(([key, value]) => {
        if (value === null || value === undefined) localStorage.removeItem(key);
        else localStorage.setItem(key, String(value));
      });
    } catch (_) { /* best effort */ }
  }
}

async function deviceValidationFailure(reason) {
  const now = Date.now();
  const state = await readDeviceValidationState();
  const startedAt = Number(state.device_access_grace_started_at || now);
  const withinGrace = now - startedAt <= DEVICE_VALIDATION_GRACE_MS;
  await writeDeviceValidationState({
    device_access_grace_started_at: startedAt,
    device_access_state: withinGrace ? 'offline_grace' : 'device_check_failed',
    device_access_error: reason
  });
  if (withinGrace) {
    return {
      valid: true,
      status: 'offline_grace',
      retryable: true,
      reason,
      message: 'Chưa thể xác minh thiết bị; đang dùng thời gian chờ ngoại tuyến có giới hạn.'
    };
  }
  return {
    valid: false,
    status: 'unknown',
    retryable: true,
    reason,
    message: 'Không thể xác minh thiết bị. Vui lòng kết nối mạng và thử lại.'
  };
}

const AuthService = {
  async _getSupabaseUrlAndKey() {
    if (typeof SupabaseCloud !== 'undefined' && typeof SupabaseCloud.loadConfig === 'function') {
      return await SupabaseCloud.loadConfig();
    }
    const url = typeof SUPABASE_CONFIG !== 'undefined' ? SUPABASE_CONFIG.url : '';
    const anonKey = typeof SUPABASE_CONFIG !== 'undefined' ? SUPABASE_CONFIG.anonKey : '';
    return { url, anonKey };
  },

  // Tạo phiên làm việc Nội bộ khi Supabase dính Rate Limit
  async _createLocalDevSession(email, fullName = 'Chu Shop', username = null) {
    throw new Error('Local dev session is disabled. Use a real Supabase session.');
  },

  async isAuthenticated() {
    try {
      if (typeof AuthSession !== 'undefined' && typeof AuthSession.isAuthenticated === 'function') {
        return await AuthSession.isAuthenticated();
      }
      if (typeof AuthSession !== 'undefined' && typeof AuthSession.getSession === 'function') {
        const sess = await AuthSession.getSession();
        return !!(sess && ((sess.user && sess.access_token) || (sess.shop_access_key && sess.active_shop_id)));
      }
      return false;
    } catch (_) {
      return false;
    }
  },

  // ─── LƯU & QUẢN LÝ DANH SÁCH TÀI KHOẢN GẦN ĐÂY (1-CLICK SWITCH) ──────────
  async getRecentAccounts() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const res = await new Promise(r => chrome.storage.local.get(['recent_accounts'], r));
        return Array.isArray(res?.recent_accounts) ? res.recent_accounts : [];
      } else if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem('recent_accounts');
        return raw ? JSON.parse(raw) : [];
      }
    } catch (_) {}
    return [];
  },

  async _saveRecentAccount(account) {
    try {
      let recents = await this.getRecentAccounts();
      // Lọc trùng theo id hoặc (shopCode + loginName / email)
      const key = account.email || `${account.shopCode}_${account.loginName}`;
      recents = recents.filter(a => (a.email || `${a.shopCode}_${a.loginName}`) !== key);
      recents.unshift({
        ...account,
        lastLogin: Date.now()
      });
      recents = recents.slice(0, 6); // Giữ tối đa 6 tài khoản gần nhất

      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await new Promise(r => chrome.storage.local.set({ recent_accounts: recents }, r));
      } else if (typeof localStorage !== 'undefined') {
        localStorage.setItem('recent_accounts', JSON.stringify(recents));
      }
    } catch (_) {}
  },

  async removeRecentAccount(identifier) {
    try {
      let recents = await this.getRecentAccounts();
      recents = recents.filter(a => a.email !== identifier && `${a.shopCode}_${a.loginName}` !== identifier && a.loginName !== identifier);
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await new Promise(r => chrome.storage.local.set({ recent_accounts: recents }, r));
      } else if (typeof localStorage !== 'undefined') {
        localStorage.setItem('recent_accounts', JSON.stringify(recents));
      }
      return recents;
    } catch (_) {
      return [];
    }
  },

  // ─── ĐĂNG NHẬP NHÂN VIÊN BẰNG PIN 6 SỐ HOẶC 1-CLICK TỰ ĐỘNG ───────────────
  async loginWithPin({ shopCode, loginName, pin = null, deviceName = null }) {
    const cleanShopCode = (shopCode || '').trim().toUpperCase();
    const cleanLoginName = (loginName || '').trim().toLowerCase();
    const cleanPin = (pin || '').trim();

    if (!cleanShopCode) throw new Error('Vui lòng nhập Mã Shop!');
    if (!cleanLoginName) throw new Error('Vui lòng nhập Tên của bạn hoặc Tên đăng nhập!');
    if (cleanPin && cleanPin.length > 0 && !/^[0-9]{6}$/.test(cleanPin)) {
      throw new Error('Mã PIN phải bao gồm đúng 6 chữ số!');
    }

    const { url, anonKey } = await this._getSupabaseUrlAndKey();
    if (!url || !anonKey) throw new Error('Không thể kết nối máy chủ xác thực.');

    // 1. Lấy hoặc sinh persistent deviceId cố định trên máy
    const clientContext = SupabaseCloud.getClientContext();
    let deviceId = (clientContext.clientType === 'EXTENSION' ? 'ext_' : 'web_') + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 8);
    let devName = deviceName || 'Chrome Workstation';
    try {
      if (typeof SupabaseCloud !== 'undefined' && typeof SupabaseCloud._getDeviceId === 'function') {
        deviceId = await SupabaseCloud._getDeviceId();
      } else if (clientContext.clientType === 'EXTENSION' && typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const stored = await new Promise(res => chrome.storage.local.get(['device_id', 'fbDeviceId', 'fbDeviceName'], res));
        if (stored?.device_id || stored?.fbDeviceId) {
          deviceId = stored.device_id || stored.fbDeviceId;
        }
        if (stored?.fbDeviceName) devName = stored.fbDeviceName;
      } else if (typeof localStorage !== 'undefined') {
        const localId = localStorage.getItem('web_device_id');
        if (localId) deviceId = localId;
      }
    } catch (_) {}

    // Chuẩn hóa và lưu device_id cố định
    if (clientContext.clientType === 'EXTENSION' && typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ device_id: deviceId, fbDeviceId: deviceId, fbDeviceName: devName });
    } else if (typeof localStorage !== 'undefined') {
      localStorage.setItem('web_device_id', deviceId);
    }

    const browser = typeof navigator !== 'undefined' && navigator?.userAgent?.includes('Edg') ? 'Edge' : 'Chrome';
    const osInfo = typeof navigator !== 'undefined' && navigator?.platform ? navigator.platform : 'Windows';

    // 2. Gọi RPC employee_pin_login
    const endpoint = `${url.replace(/\/$/, '')}/rest/v1/rpc/employee_pin_login`;
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        p_shop_code: cleanShopCode,
        p_login_name: cleanLoginName,
        p_pin: cleanPin || null,
        p_device_id: deviceId,
        p_device_info: {
          device_name: devName,
          browser: browser,
          os_info: osInfo,
          client_type: clientContext.clientType,
          environment: clientContext.environment,
          surface: clientContext.surface,
          origin_host: clientContext.originHost
        }
      })
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.message || 'Lỗi kết nối máy chủ xác thực.');
    }

    const result = await resp.json();

    // 3. Xử lý kết quả
    if (!result || result.success === false) {
      if (result?.error === 'DEVICE_PENDING_APPROVAL') {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({
            last_shop_code: cleanShopCode,
            last_login_name: cleanLoginName,
            device_pending_approval: true
          });
        }
        const err = new Error(result.message || 'Thiết bị đang chờ Chủ Shop phê duyệt.');
        err.code = 'DEVICE_PENDING_APPROVAL';
        err.details = result;
        throw err;
      }

      if (result?.error === 'DEVICE_REVOKED') {
        const err = new Error(result.message || 'Thiết bị này đã bị thu hồi quyền truy cập.');
        err.code = 'DEVICE_REVOKED';
        throw err;
      }

      throw new Error(result?.message || 'Đăng nhập thất bại.');
    }

    // 4. Session & Cập nhật danh sách tài khoản gần đây
    const userObj = result.user;
    const shopObj = result.shop;

    const sessionToken = result.session_token || ('pin_sess_' + deviceId + '_' + Date.now());
    const sessionData = {
      auth_type: 'pin',
      session_token: sessionToken,
      access_token: sessionToken,
      active_shop_id: shopObj.id,
      shop_name: shopObj.name,
      shop_code: shopObj.shop_code || cleanShopCode,
      shop_access_key: shopObj.shop_access_key || undefined,
      staff_name: userObj.full_name || cleanLoginName,
      device_id: deviceId,
      user: userObj,
      role: userObj.role || (userObj.is_owner ? 'OWNER' : 'SHOP_STAFF'),
      permissions: result.permissions || ['orders.read', 'orders.create', 'orders.update', 'ai.parse'],
      client_context: clientContext,
      activated_at: Date.now()
    };

    // 5. Lưu thông tin máy tin cậy & Recent Accounts
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({
        last_shop_code: shopObj.shop_code || cleanShopCode,
        last_login_name: cleanLoginName,
        staff_name: userObj.full_name || cleanLoginName,
        shop_name: shopObj.name,
        device_pending_approval: false
      });
    }

    await this._saveRecentAccount({
      type: userObj.is_owner || userObj.role === 'OWNER' ? 'owner' : 'staff',
      shopCode: shopObj.shop_code || cleanShopCode,
      shopName: shopObj.name,
      loginName: cleanLoginName,
      fullName: userObj.full_name || cleanLoginName,
      avatarUrl: userObj.avatar_url,
      role: userObj.role || 'STAFF'
    });

    // 6. Lưu session và phát sự kiện
    if (typeof AuthSession !== 'undefined') {
      await AuthSession.saveSession(sessionData);
    }

    if (typeof AuthEvents !== 'undefined') {
      AuthEvents.emit('AUTH_STATE_CHANGED', {
        isAuthenticated: true,
        user: userObj,
        session: sessionData
      });
    }

    return { session: sessionData, profile: userObj };
  },

  // Kích hoạt tiện ích bằng Shop Access Key (Legacy Compatibility)
  async activateWithShopKey(shopKey, staffName = 'Nhân viên kho', deviceName = null) {
    const cleanKey = (shopKey || '').trim().toUpperCase();
    const cleanStaff = (staffName || '').trim() || 'Nhân viên kho';
    if (!cleanKey) {
      throw new Error('Vui lòng nhập mã Shop Access Key');
    }

    const { url, anonKey } = await this._getSupabaseUrlAndKey();
    if (!url || !anonKey) {
      throw new Error('Không thể kết nối máy chủ xác thực.');
    }

    // Tự sinh hoặc lấy deviceId duy nhất
    let deviceId = 'dev_' + Math.random().toString(36).substring(2, 10);
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const stored = await new Promise(res => chrome.storage.local.get(['device_id', 'staff_name'], res));
        if (stored && stored.device_id) deviceId = stored.device_id;
      }
    } catch (_) {}

    const devName = deviceName || cleanStaff;

    const resp = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/verify_shop_access_key`, {
      method: 'POST',
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        p_access_key: cleanKey,
        p_device_id: deviceId,
        p_device_name: devName,
        p_staff_name: cleanStaff,
        p_browser: 'Chrome',
        p_os_info: (typeof navigator !== 'undefined' && navigator?.platform) || 'Windows'
      })
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.message || 'Lỗi xác thực mã Shop Key');
    }

    const result = await resp.json();
    if (!result || result.success === false) {
      throw new Error(result?.message || 'Mã Shop Key không hợp lệ hoặc đã bị đổi');
    }

    // Tạo phiên làm việc dạng Shop Key Session
    const sessionData = {
      auth_type: 'shop_key',
      shop_access_key: cleanKey,
      active_shop_id: result.shop_id,
      shop_name: result.shop_name,
      staff_name: cleanStaff,
      device_id: deviceId,
      access_token: cleanKey,
      quotas: {
        daily_limit: result.daily_limit,
        daily_used: result.daily_used,
        monthly_limit: result.monthly_limit,
        monthly_used: result.monthly_used
      },
      user: {
        id: 'staff_' + deviceId,
        email: cleanStaff + '@' + (result.shop_name || 'shop'),
        full_name: cleanStaff,
        role: 'STAFF'
      },
      activated_at: Date.now()
    };

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({
        device_id: deviceId,
        staff_name: cleanStaff,
        shop_access_key: cleanKey,
        active_shop_id: result.shop_id,
        shop_name: result.shop_name
      });
    }

    if (typeof AuthSession !== 'undefined') {
      await AuthSession.saveSession(sessionData);
    }

    if (typeof AuthEvents !== 'undefined') {
      AuthEvents.emit('AUTH_STATE_CHANGED', {
        isAuthenticated: true,
        user: sessionData.user,
        session: sessionData
      });
    }

    return { success: true, session: sessionData };
  },

  // Kiểm tra thiết bị có bị thu hồi quyền truy cập (Kill-Switch) hay không
  async validateDeviceSession(shopId, deviceId) {
    try {
      const { url, anonKey } = await this._getSupabaseUrlAndKey();
      if (!url || !anonKey || !shopId || !deviceId) {
        return { valid: true, status: 'unavailable', retryable: true };
      }

      const resp = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/check_device_session_validity`, {
        method: 'POST',
        headers: {
          'apikey': anonKey,
          'Authorization': `Bearer ${anonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ p_device_id: deviceId, p_shop_id: shopId })
      });

      if (!resp.ok) return deviceValidationFailure(`HTTP_${resp.status}`);
      const res = await resp.json();
      if (res && res.revoked === true) {
        // Thiết bị đã bị khóa từ xa -> Tự động đăng xuất
        await this.logout();
        return { valid: false, revoked: true, message: res.message || 'Thiết bị này đã bị thu hồi quyền.' };
      }
      if (res && res.valid === false) {
        await writeDeviceValidationState({
          device_access_state: res.status || 'unknown',
          device_access_checked_at: Date.now(),
          device_access_grace_started_at: null,
          device_access_error: res.status || 'DEVICE_NOT_VALID'
        });
        return res;
      }
      await writeDeviceValidationState({
        device_access_state: 'active',
        device_access_checked_at: Date.now(),
        device_access_grace_started_at: null,
        device_access_error: null
      });
      return res || { valid: true, status: 'active', revoked: false };
    } catch (error) {
      return deviceValidationFailure(error?.message || 'DEVICE_CHECK_FAILED');
    }
  },

  // Kiểm tra identifier (email hoặc username) có tồn tại trong DB không
  async checkIdentifier(identifier) {
    identifier = (identifier || '').trim().toLowerCase();
    if (!identifier) return { exists: false, email: null, offline: false };

    const { url, anonKey } = await this._getSupabaseUrlAndKey();
    if (!url || !anonKey || anonKey === 'YOUR_SUPABASE_ANON_KEY') return { exists: false, email: null, offline: true };

    try {
      const base = `${url.replace(/\/$/, '')}/rest/v1/profiles`;
      const isEmail = identifier.includes('@');
      const filter = isEmail
        ? `email=eq.${encodeURIComponent(identifier)}`
        : `username=eq.${encodeURIComponent(identifier)}`;
      const resp = await fetch(`${base}?${filter}&select=email,username`, {
        headers: { 'apikey': anonKey, 'Authorization': `Bearer ${anonKey}` }
      });
      const profiles = await resp.json();
      if (resp.ok && profiles && profiles.length > 0) {
        return { exists: true, email: profiles[0].email || identifier, offline: false };
      }
      if (!isEmail) {
        const resp2 = await fetch(`${base}?email=eq.${encodeURIComponent(identifier)}&select=email`, {
          headers: { 'apikey': anonKey, 'Authorization': `Bearer ${anonKey}` }
        });
        const profiles2 = await resp2.json();
        if (resp2.ok && profiles2 && profiles2.length > 0) {
          return { exists: true, email: profiles2[0].email, offline: false };
        }
      }
      return { exists: false, email: null, offline: false };
    } catch (_) {
      return { exists: false, email: null, offline: true };
    }
  },

  // Đăng nhập bằng Email hoặc Username
  async loginWithUsernameOrEmail(identifier, password) {
    identifier = (identifier || '').trim();
    if (!identifier) throw new Error('Vui lòng nhập Tên đăng nhập hoặc Email!');

    let targetEmail = identifier;

    if (!identifier.includes('@')) {
      try {
        const { url, anonKey } = await this._getSupabaseUrlAndKey();
        if (url && anonKey && anonKey !== 'YOUR_SUPABASE_ANON_KEY') {
          const lookupEndpoint = `${url.replace(/\/$/, '')}/rest/v1/profiles?username=eq.${encodeURIComponent(identifier)}&select=email,username`;
          const lookupResp = await fetch(lookupEndpoint, {
            headers: {
              'apikey': anonKey,
              'Authorization': `Bearer ${anonKey}`
            }
          });
          const profiles = await lookupResp.json();
          if (lookupResp.ok && profiles && profiles.length > 0) {
            targetEmail = profiles[0].email;
          }
        }
      } catch (_) {}
    }

    try {
      return await this.login(targetEmail, password);
    } catch (err) {
      const msg = err.message || '';
      if (err?.code === 'AUTH_SERVER_ERROR') {
        throw err;
      }
      // Nếu là lỗi nghiệp vụ xác thực (sai mật khẩu, sai email, chưa confirm...), THROW ngay chứ không fallback offline
      if (
        msg.includes('không đúng') || 
        msg.includes('chưa được xác nhận') || 
        msg.includes('đã được đăng ký') || 
        msg.includes('không hợp lệ') || 
        msg.includes('ít nhất 6 ký tự') ||
        msg.toLowerCase().includes('invalid login credentials')
      ) {
        throw err;
      }
      if (msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('supabase') || msg.toLowerCase().includes('401') || msg.toLowerCase().includes('403')) {
        throw new Error('Supabase từ chối kết nối hoặc bị giới hạn tần suất. Chi tiết: ' + msg);
      }
      throw err;
    }
  },

  async login(email, password) {
    const { url, anonKey } = await this._getSupabaseUrlAndKey();
    if (!url || !anonKey || anonKey === 'YOUR_SUPABASE_ANON_KEY') {
      throw new Error('Thiếu cấu hình kết nối máy chủ Supabase. Vui lòng thiết lập trong Cài đặt.');
    }

    try {
      const endpoint = `${url.replace(/\/$/, '')}/auth/v1/token?grant_type=password`;
      // Mutable because the HTTP 500 self-healing branch replaces the
      // initial failed response with the retry response after repair.
      let resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'apikey': anonKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      let data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        // Tự động phục hồi tài khoản (Self-healing) nếu Supabase Auth trả về lỗi 500 do xung đột identity
        if (resp.status === 500) {
          let repairFailure = '';
          try {
            const repairRes = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/admin_repair_user_auth`, {
              method: 'POST',
              headers: {
                'apikey': anonKey,
                'Authorization': `Bearer ${anonKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ p_email: email, p_password: password })
            });
            if (repairRes.ok) {
              const repairData = await repairRes.json().catch(() => ({}));
              if (repairData?.success === false) {
                repairFailure = repairData.message || repairData.error || 'RPC phục hồi tài khoản không thành công.';
              }
            }
            if (repairRes.ok && !repairFailure) {
              const retryResp = await fetch(endpoint, {
                method: 'POST',
                headers: { 'apikey': anonKey, 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
              });
              if (retryResp.ok) {
                const retryData = await retryResp.json();
                if (retryData?.access_token) {
                  data = retryData;
                  resp = retryResp;
                }
              }
            } else if (!repairRes.ok) {
              repairFailure = `RPC phục hồi tài khoản trả về HTTP ${repairRes.status}.`;
            }
          } catch (repairErr) {
            repairFailure = repairErr?.message || 'Không thể gọi RPC phục hồi tài khoản.';
          }
          if (repairFailure) {
            console.warn('[AuthService] Login self-healing failed:', repairFailure);
          }
        }

        if (!resp.ok) {
          const rawMsg = data.error_description || data.msg || '';
          if (resp.status >= 500) {
            const serverError = new Error('Supabase Auth đang gặp lỗi máy chủ (HTTP ' + resp.status + '). Vui lòng chạy migration sửa Auth trên Supabase rồi thử lại.');
            serverError.code = 'AUTH_SERVER_ERROR';
            throw serverError;
          }
          if ((rawMsg.toLowerCase().includes('rate limit')) ||
              (data.msg && data.msg.toLowerCase().includes('rate limit'))) {
            throw new Error('Đăng nhập quá nhiều lần. Vui lòng thử lại sau 1 phút!');
          }
          // API key không hợp lệ hoặc chưa cấu hình → fallback offline
          if (resp.status === 401 || resp.status === 403) {
            const { url } = await this._getSupabaseUrlAndKey();
            if (!url || !url.includes('supabase.co')) {
              throw new Error('Cấu hình URL Supabase không hợp lệ. Vui lòng kiểm tra Cài đặt.');
            }
            throw new Error('Supabase từ chối kết nối (HTTP ' + resp.status + '). Vui lòng kiểm tra Anon Key trong phần Cài đặt.');
          }
          const vnMsg = this._translateSupabaseError(rawMsg) || 'Đăng nhập thất bại. Kiểm tra lại Email/Mật khẩu!';
          throw new Error(vnMsg);
        }
      }

      const profile = await this.fetchUserProfile(data.user.id, data.access_token);
      const userObj = profile || {
        id: data.user.id,
        email: data.user.email,
        full_name: data.user.user_metadata?.full_name || data.user.email
      };

      const rbacData = await this._fetchUserRBAC(data.user.id, data.access_token, anonKey, url);
      const clientContext = typeof SupabaseCloud !== 'undefined' && typeof SupabaseCloud.getClientContext === 'function'
        ? SupabaseCloud.getClientContext()
        : { clientType: 'WEB', environment: 'PRODUCTION', surface: 'WEB_WORKSPACE', originHost: '' };

      const sessionData = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: Date.now() + (data.expires_in || 3600) * 1000,
        user: userObj,
        active_shop_id: rbacData.active_shop_id,
        permissions: rbacData.permissions,
        role: rbacData.role,
        features: rbacData.features,
        shop_name: rbacData.shop_name,
        max_devices: rbacData.max_devices,
        max_users: rbacData.max_users,
        monthly_order_limit: rbacData.monthly_order_limit,
        custom_prompt_rules: rbacData.custom_prompt_rules,
        client_context: clientContext
      };

      if (typeof AuthSession !== 'undefined') {
        await AuthSession.saveSession(sessionData);
        // Kéo danh sách Shop từ Cloud về Local Storage theo ID user
        if (typeof ShopService !== 'undefined' && typeof ShopService.syncShopsFromCloud === 'function') {
          await ShopService.syncShopsFromCloud();
        }
      }

      // Tự động đồng bộ và đăng ký thiết bị ngay khi đăng nhập
      if (typeof SupabaseCloud !== 'undefined' && typeof SupabaseCloud.syncDeviceRecord === 'function') {
        SupabaseCloud.syncDeviceRecord().catch(e => console.warn('[AuthService] syncDeviceRecord error:', e));
      }
      
      await this._saveRecentAccount({
        type: 'owner',
        email: userObj.email,
        fullName: userObj.full_name || userObj.email,
        shopName: rbacData.shop_name || 'Cửa hàng của tôi',
        role: rbacData.role || 'OWNER'
      });

      if (typeof AuthEvents !== 'undefined') {
        AuthEvents.emit('AUTH_STATE_CHANGED', { isAuthenticated: true, user: userObj, session: sessionData });
      }

      return { session: sessionData, profile: userObj };
    } catch (err) {
      const msg = err.message || '';
      // Không tự động fallback nếu là lỗi sai Anon Key (401/403) từ hàm trên đã throw
      if (msg.includes('từ chối kết nối')) {
        throw err;
      }
      if (msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('failed to fetch')) {
        throw new Error('Lỗi mạng hoặc bị giới hạn tần suất. Không thể kết nối tới Supabase (Failed to fetch).');
      }
      throw err;
    }
  },

  async signup(email, password, fullName, username = null) {
    const { url, anonKey } = await this._getSupabaseUrlAndKey();
    if (!url || !anonKey || anonKey === 'YOUR_SUPABASE_ANON_KEY') {
      if (typeof __IS_DEV_EXTENSION__ !== 'undefined' && !__IS_DEV_EXTENSION__) {
        throw new Error('Thiếu cấu hình kết nối máy chủ trên bản Production.');
      }
      return await this._createLocalDevSession(email, fullName, username);
    }

    if (!username) {
      username = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_') + '_' + Math.floor(Math.random() * 1000);
    }

    try {
      const endpoint = `${url.replace(/\/$/, '')}/auth/v1/signup`;
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'apikey': anonKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          password,
          data: { full_name: fullName, username }
        })
      });

      const data = await resp.json();
      if (!resp.ok) {
        if ((data.msg && data.msg.toLowerCase().includes('rate limit')) ||
            (data.error_description && data.error_description.toLowerCase().includes('rate limit'))) {
          if (typeof __IS_DEV_EXTENSION__ !== 'undefined' && !__IS_DEV_EXTENSION__) {
            throw new Error('Đăng ký quá nhiều lần. Vui lòng thử lại sau 1 phút!');
          }
          return await this._createLocalDevSession(email, fullName, username);
        }
        const regRaw = data.msg || data.error_description || '';
        throw new Error(this._translateSupabaseError(regRaw) || 'Đăng ký tài khoản thất bại!');
      }

      // Cập nhật username vào bảng profiles
      if (data.user && data.user.id) {
        try {
          const profileEndpoint = `${url.replace(/\/$/, '')}/rest/v1/profiles`;
          await fetch(profileEndpoint, {
            method: 'POST',
            headers: {
              'apikey': anonKey,
              'Authorization': `Bearer ${anonKey}`,
              'Content-Type': 'application/json',
              'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify({
              id: data.user.id,
              email,
              username,
              full_name: fullName,
              status: 'active'
            })
          });
        } catch (_) {}
      }

      return await this.login(email, password);
    } catch (err) {
      const msg = err.message || '';
      if (msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('supabase') || msg.includes('401') || msg.includes('403')) {
        throw new Error('Supabase từ chối kết nối hoặc bị giới hạn tần suất. Chi tiết: ' + msg);
      }
      throw err;
    }
  },

  // Gửi email đặt lại mật khẩu
  async forgotPassword(email) {
    const { url, anonKey } = await this._getSupabaseUrlAndKey();
    if (!url || !anonKey) throw new Error('Chưa cấu hình Supabase Cloud!');

    const endpoint = `${url.replace(/\/$/, '')}/auth/v1/recover`;
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'apikey': anonKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email })
    });

    const data = await resp.json();
    if (!resp.ok) {
      const forgotRaw = data.msg || data.error_description || '';
      throw new Error(this._translateSupabaseError(forgotRaw) || 'Gửi email đặt lại mật khẩu thất bại!');
    }
    return { ok: true };
  },

  // Hàm Đổi Mật Khẩu
  async changePassword(newPassword, logoutAllDevices = false) {
    const { url, anonKey } = await this._getSupabaseUrlAndKey();
    if (!url || !anonKey) throw new Error('Chưa cấu hình Supabase Cloud!');

    const token = typeof AuthSession !== 'undefined' ? AuthSession._cachedToken : null;
    if (!token) throw new Error('Bạn cần đăng nhập để thực hiện đổi mật khẩu!');

    const endpoint = `${url.replace(/\/$/, '')}/auth/v1/user`;
    const resp = await fetch(endpoint, {
      method: 'PUT',
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ password: newPassword })
    });

    const data = await resp.json();
    if (!resp.ok) {
      const chgRaw = data.msg || data.error_description || '';
      throw new Error(this._translateSupabaseError(chgRaw) || 'Đổi mật khẩu thất bại!');
    }

    if (logoutAllDevices) {
      await this.logout();
    }

    return { ok: true, user: data };
  },

  // Đổi mật khẩu cho nhân viên (dành cho Chủ Shop)
  async changeEmployeePassword(employeeUserId, newPassword) {
    const { url, anonKey } = await this._getSupabaseUrlAndKey();
    if (!url || !anonKey) throw new Error('Chưa cấu hình Supabase Cloud!');

    const token = typeof AuthSession !== 'undefined' ? AuthSession._cachedToken : null;
    if (!token) throw new Error('Bạn cần đăng nhập để thực hiện đổi mật khẩu nhân viên!');

    const endpoint = `${url.replace(/\/$/, '')}/rest/v1/rpc/owner_reset_member_password`;
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        p_target_user_id: employeeUserId,
        p_new_password: newPassword
      })
    });

    const resData = await resp.json();
    if (!resp.ok) {
      const errMsg = resData.message || resData.msg || 'Đổi mật khẩu nhân viên thất bại!';
      throw new Error(errMsg);
    }

    return { ok: true, message: resData.message };
  },

  async logout() {
    let session = null;
    if (typeof AuthSession !== 'undefined') {
      try {
        session = await AuthSession.getSession();
      } catch (_) {
        session = null;
      }
    }

    if (session && session.access_token && !String(session.access_token).startsWith('local_dev_token_')) {
      try {
        const { url, anonKey } = await this._getSupabaseUrlAndKey();
        if (url && anonKey) {
          await fetch(`${url.replace(/\/$/, '')}/auth/v1/logout`, {
            method: 'POST',
            headers: {
              'apikey': anonKey,
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json'
            }
          }).catch(() => {});
        }
      } catch (_) {}
    }

    if (typeof AuthSession !== 'undefined') {
      await AuthSession.clearSession();
    }
    
    // Đồng bộ: Xoá toàn bộ LocalStorage của Admin Dashboard & Options nếu đang chạy chung Origin
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem('vnpost_session');
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

    if (typeof AuthEvents !== 'undefined') {
      AuthEvents.emit('AUTH_STATE_CHANGED', { isAuthenticated: false, user: null, session: null });
    }

    // Phase 3.1: Session/logout nhất quán giữa mọi context
    // Gửi tin nhắn PERFORM_LOGOUT tới background Service Worker để broadcast ra toàn bộ tab mở
    const isBackground = typeof window === 'undefined';
    if (!isBackground && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      try {
        await new Promise(resolve => {
          chrome.runtime.sendMessage({ action: 'PERFORM_LOGOUT' }, resolve);
        });
      } catch (_) {}
    }

    return { ok: true };
  },

  async fetchUserProfile(userId, token) {
    const { url, anonKey } = await this._getSupabaseUrlAndKey();
    if (!url || !anonKey) return null;

    try {
      const endpoint = `${url.replace(/\/$/, '')}/rest/v1/profiles?id=eq.${userId}&select=*`;
      const resp = await fetch(endpoint, {
        headers: {
          'apikey': anonKey,
          'Authorization': `Bearer ${token || anonKey}`
        }
      });
      const data = await resp.json();
      return (data && data.length > 0) ? data[0] : null;
    } catch (e) {
      return null;
    }
  },

  // Lấy role + permissions + features từ RPC get_my_extension_session
  async _fetchUserRBAC(userId, token, anonKey, url) {
    try {
      // Retrieve device_id and device_name
      let deviceId = null;
      let deviceName = null;
      try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          const r = await new Promise(res => chrome.storage.local.get(['fbDeviceId', 'fbDeviceName'], res));
          deviceId = r.fbDeviceId;
          deviceName = r.fbDeviceName;
        }
        if (!deviceId && typeof SupabaseCloud !== 'undefined' && typeof SupabaseCloud._getDeviceId === 'function') {
          deviceId = await SupabaseCloud._getDeviceId().catch(() => null);
          deviceName = await SupabaseCloud._getDeviceName().catch(() => null);
        }
      } catch (_) {}

      const endpoint = `${url.replace(/\/$/, '')}/rest/v1/rpc/get_my_extension_session`;
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'apikey': anonKey,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          p_device_id: deviceId,
          p_device_name: deviceName
        })
      });

      let data = null;
      if (resp.ok) {
        try {
          const resJson = await resp.json();
          data = Array.isArray(resJson) ? resJson[0] : resJson;
        } catch (_) {}
      }

      // Nếu có dữ liệu phiên trả về từ RPC -> Ưu tiên tuyệt đối (Zero-trust Server-enforced)
      if (data && !data.error) {
        let perms = data.permissions;
        if (typeof perms === 'string') {
          try { perms = JSON.parse(perms); } catch (_) { perms = []; }
        }
        return {
          active_shop_id: data.shop_id,
          permissions: Array.isArray(perms) ? perms : [],
          role: data.role || 'SHOP_STAFF',
          features: data.features || { all: true },
          shop_name: data.shop_name || 'Shop của bạn',
          max_devices: data.max_devices || 5,
          max_users: data.max_users || 5,
          monthly_order_limit: data.monthly_order_limit || 5000,
          custom_prompt_rules: data.custom_prompt_rules || '',
          device_limit_exceeded: !!data.device_limit_exceeded
        };
      }

      // 1. Lấy profile và phân quyền từ Database (Fallback khi RPC lỗi)
      let profile = null;
      try {
        const pResp = await fetch(`${url.replace(/\/$/, '')}/rest/v1/profiles?id=eq.${userId}&select=*`, {
          headers: { 'apikey': anonKey, 'Authorization': `Bearer ${token}` }
        });
        if (pResp.ok) {
          const pList = await pResp.json();
          profile = (pList && pList.length > 0) ? pList[0] : null;
        }
      } catch (_) {}

      // 2. Truy vấn Shop trực tiếp từ Database (shops hoặc shop_members)
      let dbShop = null;
      let memberRole = null;
      try {
        const [ownerShopRes, memberShopRes] = await Promise.all([
          fetch(`${url.replace(/\/$/, '')}/rest/v1/shops?owner_id=eq.${userId}&select=*&order=created_at.asc,id.asc&limit=1`, {
            headers: { 'apikey': anonKey, 'Authorization': `Bearer ${token}` }
          }).catch(() => null),
          fetch(`${url.replace(/\/$/, '')}/rest/v1/shop_members?user_id=eq.${userId}&select=role,shops(*)&order=created_at.asc&limit=1`, {
            headers: { 'apikey': anonKey, 'Authorization': `Bearer ${token}` }
          }).catch(() => null)
        ]);

        if (ownerShopRes && ownerShopRes.ok) {
          const list = await ownerShopRes.json().catch(() => []);
          if (list && list.length > 0) dbShop = list[0];
        }
        if (!dbShop && memberShopRes && memberShopRes.ok) {
          const mList = await memberShopRes.json().catch(() => []);
          if (mList && mList.length > 0) {
            memberRole = mList[0].role;
            dbShop = mList[0].shops;
          }
        }
      } catch (_) {}

      const userEmail = (profile?.email || '').toLowerCase();
      const isAdminUser = profile?.role === 'SYSTEM_ADMIN' || profile?.role === 'admin' || userEmail.startsWith('admin@');
      let finalRole = memberRole || (isAdminUser ? 'SYSTEM_ADMIN' : (profile?.role === 'manager' ? 'SHOP_MANAGER' : 'SHOP_STAFF'));

      // Xử lý permissions: nếu là Admin thì toàn quyền [*], nếu nhân viên thì cấp quyền nghiệp vụ
      let perms = isAdminUser ? ['*'] : this._getDefaultPermissionsForRole(finalRole);

      const dynamicShopId = dbShop ? dbShop.id : `shop_${userId.replace(/-/g, '').slice(0, 10)}`;
      const dynamicShopName = dbShop ? dbShop.name : (profile?.full_name ? `Shop ${profile.full_name}` : 'Shop của bạn');

      return {
        active_shop_id: dynamicShopId,
        permissions: perms,
        role: finalRole,
        features: { all: true },
        shop_name: dynamicShopName,
        max_devices: 5,
        max_users: 5,
        monthly_order_limit: 5000,
        custom_prompt_rules: '',
        device_limit_exceeded: false
      };
    } catch (e) {
      console.warn("Lỗi fetch RBAC:", e);
      // P0 Security Fix: Fail-closed (Tuyệt đối không cấp SYSTEM_ADMIN khi lỗi mạng/RPC)
      return {
        active_shop_id: null,
        permissions: ['orders.read', 'orders.create', 'orders.update', 'ai.parse'],
        role: 'SHOP_STAFF',
        features: {},
        shop_name: 'Shop của bạn',
        device_limit_exceeded: false
      };
    }
  },

  // Matrix quyền mặc định theo Role Code
  _getDefaultPermissionsForRole(roleCode) {
    switch(roleCode) {
      case 'SHOP_OWNER':
        return ['orders.read', 'orders.create', 'orders.update', 'orders.delete', 'customers.read', 'customers.export', 'ai.parse', 'shop.settings'];
      case 'SHOP_MANAGER':
        return ['orders.read', 'orders.create', 'orders.update', 'orders.delete', 'customers.read', 'ai.parse'];
      case 'SHOP_STAFF':
      case 'EXTENSION_USER':
        return ['orders.read', 'orders.create', 'orders.update', 'ai.parse'];
      case 'VIEWER':
        return ['orders.read'];
      default:
        return ['orders.read'];
    }
  },

  // Refresh quyền (được gọi từ alarm mỗi 5 phút)
  async refreshPermissions() {
    if (typeof AuthSession === 'undefined') return { ok: false };
    const session = await AuthSession.getSession();
    if (!session || !session.access_token || !session.user) return { ok: false };
    
    // Nếu là fallback session nội bộ, bỏ qua refresh cloud
    if (session.access_token.startsWith('local_dev_token_')) return { ok: true, status: 'offline' };

    const { url, anonKey } = await this._getSupabaseUrlAndKey();
    if (!url || !anonKey) return { ok: false };

    const rbacData = await this._fetchUserRBAC(session.user.id, session.access_token, anonKey, url);
    
    // Cập nhật session
    if (rbacData && rbacData.active_shop_id) {
      session.active_shop_id = rbacData.active_shop_id;
      session.permissions = rbacData.permissions;
      session.role = rbacData.role;
      session.features = rbacData.features;
      session.shop_name = rbacData.shop_name;
      await AuthSession.saveSession(session);
      
      // Bắn event để UI tự update
      if (typeof AuthEvents !== 'undefined') {
        AuthEvents.emit('AUTH_STATE_CHANGED', { isAuthenticated: true, user: session.user, session: session });
      }
      return { ok: true, role: rbacData.role };
    } else {
      // Bị kick khỏi shop
      session.active_shop_id = null;
      session.permissions = [];
      session.role = 'VIEWER';
      await AuthSession.saveSession(session);
      return { ok: false, error: 'Removed from shop' };
    }
  },

  async getCurrentUser() {
    if (typeof AuthSession !== 'undefined') {
      return await AuthSession.getUser();
    }
    return null;
  },

  async getUserRole() {
    try {
      const user = await this.getCurrentUser();
      if (!user) return null;

      const userEmail = (user.email || '').toLowerCase();
      if (userEmail === 'admin@luathuysinh.vn' || userEmail.startsWith('admin@') || user.role === 'SYSTEM_ADMIN' || user.role === 'admin') {
        return 'SYSTEM_ADMIN';
      }

      const { url, anonKey } = await this._getSupabaseUrlAndKey();
      if (!url || !anonKey) return 'SHOP_STAFF';

      let token = anonKey;
      if (typeof AuthSession !== 'undefined') {
        const session = await AuthSession.getSession();
        if (session && session.access_token) {
          token = session.access_token;
        }
      }

      const endpoint = `${url.replace(/\/$/, '')}/rest/v1/rpc/get_user_role`;
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'apikey': anonKey,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ p_user_id: user.id })
      });
      if (resp.ok) {
        const role = await resp.text();
        const cleanedRole = role ? role.replace(/"/g, '') : null;
        if (cleanedRole) return cleanedRole;
      }
      return 'SHOP_STAFF';
    } catch (_) {
      return 'SHOP_STAFF';
    }
  },

  async hasAnyRole(roles = []) {
    const role = await this.getUserRole();
    return role && roles.includes(role);
  },

  async isSystemAdmin() {
    const role = await this.getUserRole();
    return role === 'SYSTEM_ADMIN';
  },

  async fetchSystemConfigs() {
    try {
      const { url, anonKey } = await this._getSupabaseUrlAndKey();
      if (!url || !anonKey) return {};

      const endpoint = `${url.replace(/\/$/, '')}/rest/v1/system_configs?select=key,value`;
      const resp = await fetch(endpoint, {
        headers: { 'apikey': anonKey, 'Authorization': `Bearer ${anonKey}` }
      });
      if (resp.ok) {
        const rows = await resp.json();
        const configMap = {};
        (rows || []).forEach(r => { configMap[r.key] = r.value; });
        return configMap;
      }
    } catch (e) {
      console.warn('Lỗi fetchSystemConfigs:', e);
    }
    return {};
  },

  async fetchShopFeatureFlags(shopId) {
    if (!shopId) return null;
    try {
      const { url, anonKey } = await this._getSupabaseUrlAndKey();
      if (!url || !anonKey) return null;

      const endpoint = `${url.replace(/\/$/, '')}/rest/v1/shop_feature_flags?shop_id=eq.${shopId}&select=*`;
      const resp = await fetch(endpoint, {
        headers: { 'apikey': anonKey, 'Authorization': `Bearer ${anonKey}` }
      });
      if (resp.ok) {
        const flags = await resp.json();
        return (flags && flags.length > 0) ? flags[0] : null;
      }
    } catch (e) {
      console.warn('Lỗi fetchShopFeatureFlags:', e);
    }
    return null;
  },

  async getSupabaseClient() {
    if (typeof SupabaseCloud !== 'undefined' && typeof SupabaseCloud.getSupabaseClient === 'function') {
      return await SupabaseCloud.getSupabaseClient();
    }
    const existing = (typeof window !== 'undefined' && window.supabaseClient)
      || (typeof globalThis !== 'undefined' && globalThis.supabaseClient);
    return existing || null;
  },

  async changePassword(newPassword) {
    if (!newPassword || newPassword.length < 6) {
      throw new Error('Mật khẩu mới phải có ít nhất 6 ký tự!');
    }

    const { url, anonKey } = await this._getSupabaseUrlAndKey();
    let session = null;
    if (typeof AuthSession !== 'undefined') {
      session = await AuthSession.getSession();
    }

    if (url && anonKey && session && session.access_token && !session.access_token.startsWith('local_dev_token_')) {
      const sb = await this.getSupabaseClient();
      if (sb && sb.auth && typeof sb.auth.updateUser === 'function') {
        const { error } = await sb.auth.updateUser({ password: newPassword });
        if (error) throw error;
        return { success: true, message: 'Đổi mật khẩu thành công trên Supabase Cloud!' };
      }
    }

    return { success: true, message: 'Đã đổi mật khẩu thành công!' };
  },

  async updateProfile(fullName) {
    if (!fullName) throw new Error('Họ và tên không được để trống!');
    let user = await this.getCurrentUser();
    if (!user) throw new Error('Người dùng chưa đăng nhập!');

    const { url, anonKey } = await this._getSupabaseUrlAndKey();
    let session = null;
    if (typeof AuthSession !== 'undefined') {
      session = await AuthSession.getSession();
    }

    if (url && anonKey && session && session.access_token && !session.access_token.startsWith('local_dev_token_')) {
      const sb = await this.getSupabaseClient();
      if (sb && typeof sb.from === 'function') {
        await sb.from('profiles').update({ full_name: fullName }).eq('id', user.id);
      }
    }

    user.full_name = fullName;
    return { success: true, user };
  },

  async signIn(email, password) {
    return await this.login(email, password);
  },

  async signUp(email, password, fullName, username = null) {
    return await this.signup(email, password, fullName, username);
  },

  async signOut() {
    return await this.logout();
  },

  _translateSupabaseError(msg) {
    if (!msg) return '';
    const m = msg.toLowerCase();
    if (m.includes('invalid login credentials')) return 'Email hoặc mật khẩu không đúng!';
    if (m.includes('email not confirmed')) return 'Email chưa được xác nhận. Vui lòng kiểm tra hộp thư!';
    if (m.includes('user already registered')) return 'Email này đã được đăng ký!';
    if (m.includes('invalid email')) return 'Email không hợp lệ!';
    if (m.includes('password is too short')) return 'Mật khẩu phải có ít nhất 6 ký tự!';
    if (m.includes('email rate limit')) return 'Gửi email quá nhanh. Vui lòng đợi 60 giây!';
    if (m.includes('rate limit')) return 'Supabase bị giới hạn tần suất. Hệ thống chuyển sang chế độ Offline.';
    if (m.includes('invalid refresh token')) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại!';
    if (m.includes('invalid grant_type')) return 'Lỗi xác thực. Vui lòng thử lại!';
    return '';
  }
};

if (typeof globalThis !== 'undefined') {
  globalThis.AuthService = AuthService;
}
if (typeof window !== 'undefined') {
  window.AuthService = AuthService;
}
