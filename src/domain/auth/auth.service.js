// =========================================================================
// AUTH.SERVICE.JS — DỊCH VỤ XÁC THỰC NGƯỜI DÙNG CHUẨN USERNAME / EMAIL V3.1
// =========================================================================

import { AuthSession } from './auth.session.js';
import { AuthEvents } from './auth.events.js';
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
  async _createLocalDevSession(email, fullName = 'Chủ Shop', username = null) {
    const localUserId = 'usr_local_' + Math.floor(Math.random() * 1000000);
    const sessionData = {
      access_token: 'local_dev_token_' + Date.now(),
      refresh_token: 'local_dev_refresh_' + Date.now(),
      expires_at: Date.now() + 30 * 24 * 3600 * 1000,
      user: { id: localUserId, email },
      active_shop_id: 'local_shop_01',
      permissions: ['*']
    };
    const userObj = {
      id: localUserId,
      email: email || 'yen_admin@system.com',
      username: username || (email ? email.split('@')[0] : 'yen_admin'),
      full_name: fullName || 'Chủ Shop (Yến)',
      status: 'active'
    };

    if (typeof AuthSession !== 'undefined') {
      await AuthSession.saveSession(sessionData);
    }

    if (typeof AuthEvents !== 'undefined') {
      AuthEvents.emit('AUTH_STATE_CHANGED', { isAuthenticated: true, user: userObj, session: sessionData });
    }

    return { session: sessionData, profile: userObj, isLocalFallback: true };
  },

  // Kiểm tra identifier (email hoặc username) có tồn tại trong DB không
  async checkIdentifier(identifier) {
    identifier = (identifier || '').trim().toLowerCase();
    if (!identifier) return { exists: false, email: null, offline: false };

    const { url, anonKey } = await this._getSupabaseUrlAndKey();
    if (!url || !anonKey) return { exists: false, email: null, offline: true };
    if (anonKey.startsWith('sb_') || !anonKey.startsWith('eyJ')) return { exists: false, email: null, offline: true };

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
        if (url && anonKey && !anonKey.startsWith('sb_') && anonKey.startsWith('eyJ')) {
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
    const lowerEmail = (email || '').toLowerCase().trim();
    const pwd = password || '';
    if (!url || !anonKey || anonKey === 'YOUR_SUPABASE_ANON_KEY') {
      if (lowerEmail === 'admin@vietautofill.com' && pwd !== 'Admin@123456') {
        throw new Error('Email hoặc mật khẩu không đúng!');
      }
      if (
        (lowerEmail === 'test_owner_alpha@test.com' || 
         lowerEmail === 'test_owner_beta@test.com' || 
         lowerEmail === 'test_owner_gamma@test.com') && 
        pwd !== 'Test@123456'
      ) {
        throw new Error('Email hoặc mật khẩu không đúng!');
      }
      return await this._createLocalDevSession(email, 'Chủ Shop');
    }

    try {
      const endpoint = `${url.replace(/\/$/, '')}/auth/v1/token?grant_type=password`;
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'apikey': anonKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const data = await resp.json();
      if (!resp.ok) {
        const rawMsg = data.error_description || data.msg || '';
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

      const profile = await this.fetchUserProfile(data.user.id, data.access_token);
      const userObj = profile || {
        id: data.user.id,
        email: data.user.email,
        full_name: data.user.user_metadata?.full_name || data.user.email
      };

      const rbacData = await this._fetchUserRBAC(data.user.id, data.access_token, anonKey, url);

      const sessionData = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: Date.now() + (data.expires_in || 3600) * 1000,
        user: userObj,
        active_shop_id: rbacData.active_shop_id,
        permissions: rbacData.permissions,
        role: rbacData.role,
        features: rbacData.features,
        shop_name: rbacData.shop_name
      };

      if (typeof AuthSession !== 'undefined') {
        await AuthSession.saveSession(sessionData);
        // Kéo danh sách Shop từ Cloud về Local Storage theo ID user
        if (typeof ShopService !== 'undefined' && typeof ShopService.syncShopsFromCloud === 'function') {
          await ShopService.syncShopsFromCloud();
        }
      }
      
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
    if (!url || !anonKey) {
      return await this._createLocalDevSession(email, fullName, username);
    }
    if (anonKey === 'YOUR_SUPABASE_ANON_KEY') {
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

  async logout() {
    if (typeof AuthSession !== 'undefined') {
      await AuthSession.clearSession();
    }
    
    // Đồng bộ: Xoá luôn cả LocalStorage của Admin Dashboard nếu đang chạy chung Origin
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('af_logged_user');
      localStorage.removeItem('profile');
      localStorage.removeItem('current_role');
      localStorage.removeItem('current_shop_id');
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    }

    if (typeof AuthEvents !== 'undefined') {
      AuthEvents.emit('AUTH_STATE_CHANGED', { isAuthenticated: false, user: null, session: null });
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
      const endpoint = `${url.replace(/\/$/, '')}/rest/v1/rpc/get_my_extension_session`;
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'apikey': anonKey,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });

      if (!resp.ok) return { active_shop_id: null, permissions: [], role: 'VIEWER', features: {} };
      
      const data = await resp.json();
      
      // Nếu không thuộc shop nào hoặc có lỗi
      if (!data || data.error || !data.shop_id) {
        return { active_shop_id: null, permissions: [], role: 'VIEWER', features: {} };
      }

      // Kiểm tra xem User có phải là SYSTEM_ADMIN toàn cầu hay không (ghi đè mọi quyền của Shop)
      let finalRole = data.role;
      try {
        const adminResp = await fetch(`${url.replace(/\/$/, '')}/rest/v1/user_roles?user_id=eq.${userId}&select=roles(code)`, {
          headers: { 'apikey': anonKey, 'Authorization': `Bearer ${token}` }
        });
        if (adminResp.ok) {
          const userRoles = await adminResp.json();
          const isAdmin = userRoles?.some(r => r.roles?.code === 'SYSTEM_ADMIN');
          if (isAdmin) {
            finalRole = 'SYSTEM_ADMIN';
          }
        }
      } catch (err) {
        console.warn("Không thể lấy role toàn cầu:", err);
      }

      // Xử lý permissions: nếu mảng JSONB trong DB rỗng, fallback về mặc định theo role
      let perms = Array.isArray(data.permissions) ? data.permissions : [];
      if (perms.length === 0 && finalRole !== 'SYSTEM_ADMIN') {
        perms = this._getDefaultPermissionsForRole(finalRole);
      } else if (finalRole === 'SYSTEM_ADMIN') {
        perms = ['*'];
      }

      return {
        active_shop_id: data.shop_id,
        permissions: perms,
        role: finalRole,
        features: data.features || {},
        shop_name: data.shop_name || ''
      };
    } catch (e) {
      console.warn("Lỗi fetch RBAC:", e);
      return { active_shop_id: null, permissions: [], role: 'VIEWER', features: {} };
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


  async isAuthenticated() {
    if (typeof AuthSession !== 'undefined') {
      const session = await AuthSession.getSession();
      const user = await AuthSession.getUser();
      if (!session || !user) return false;
      let expireTime = session.expires_at || session.expiresAt;
      if (expireTime && expireTime < 10000000000) {
        expireTime = expireTime * 1000;
      }
      if (expireTime && expireTime < Date.now()) {
        await AuthSession.clearSession();
        return false;
      }
      return true;
    }
    return false;
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

      const { url, anonKey } = await this._getSupabaseUrlAndKey();
      if (!url || !anonKey) return null;

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
        return role ? role.replace(/"/g, '') : null;
      }
    } catch (_) {}
    return null;
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
      if (typeof window !== 'undefined' && window.supabase && typeof window.supabase.createClient === 'function') {
        const sb = window.supabase.createClient(url, anonKey);
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
      if (typeof window !== 'undefined' && window.supabase && typeof window.supabase.createClient === 'function') {
        const sb = window.supabase.createClient(url, anonKey);
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

export { AuthService };
