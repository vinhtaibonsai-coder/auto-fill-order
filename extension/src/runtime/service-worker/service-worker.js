// =========================================================================
// SERVICE WORKER NỀN (MV3)
// =========================================================================

import '../../application/config.js';
import '../../infrastructure/supabase/supabase-config.js';
import '../../infrastructure/supabase/client.js';
import '../../application/logger.js';
import '../../application/api.js';
import '../../application/queue.js';
import '../../application/storage.js';
import '../../domain/auth/auth.session.js';
import { VersionChecker } from '../../domain/version/version-checker.js';
import { ERROR_CODES, toUserSafeError } from '../../application/error-codes.js';
import { parseCache } from '../../application/cache/parse-cache.js';
const OrderStorage = globalThis.OrderStorage;

// Phân tách hàng đợi AI: Text parse (2 luồng) và Vision OCR nặng (1 luồng)
const textAiQueue = new PromiseQueue(2);
const visionAiQueue = new PromiseQueue(1);
const aiQueue = textAiQueue; // Alias tương thích ngược


// =========================================================================
// AUTO-SYNC ĐỊNH KỲ TỪ SUPABASE (chrome.alarms — MV3 Safe)
// =========================================================================
const ALARM_SYNC   = 'ag_cloud_sync';     // Đồng bộ dữ liệu đơn hàng (5 phút)
const ALARM_CONFIG = 'ag_config_sync';    // Cập nhật cấu hình Shop từ cloud (15 phút)
const ALARM_PERM_REFRESH = 'ag_perm_refresh'; // Làm mới quyền từ shop_members (5 phút)
const ALARM_VERSION_CHECK = 'ag_version_check'; // Kiểm tra cập nhật phiên bản OTA (30 phút)
const ALARM_CACHE_EVICTION = 'ag_cache_eviction'; // Dọn dẹp cache hết hạn TTL (240 phút)

// Hàm kiểm tra Supabase đã được cấu hình chưa
async function _isCloudConfigured() {
  if (typeof SupabaseCloud === 'undefined') return false;
  const cfg = await SupabaseCloud.loadConfig().catch(() => null);
  return !!(cfg && cfg.url && cfg.anonKey && !cfg.url.includes('YOUR_SUPABASE'));
}

// ── Đồng bộ dữ liệu Đơn hàng từ Supabase về local ──────────────────────
async function _autoSyncOrders() {
  try {
    if (!(await _isCloudConfigured())) return;

    // Lấy shopId hiện tại trước để truyền chính xác vào hàm fetch
    const shopRes = await chrome.storage.local.get(['activeShopId']).catch(() => ({}));
    const shopId = shopRes.activeShopId || 'shop_default';

    const [cloudOrders, cloudSubmitted] = await Promise.all([
      SupabaseCloud.fetchOrders().catch(() => []),
      (typeof SupabaseCloud.fetchSubmittedOrders === 'function'
        ? SupabaseCloud.fetchSubmittedOrders(shopId)
        : Promise.resolve([])
      ).catch(() => [])
    ]);

    if (!cloudOrders.length && !cloudSubmitted.length) return;

    const draftKey = (typeof OrderStorage !== 'undefined' && typeof OrderStorage._getSavedOrdersKey === 'function')
      ? await OrderStorage._getSavedOrdersKey()
      : `savedOrders_${shopId}`;
    const submittedKey = (typeof OrderStorage !== 'undefined' && typeof OrderStorage._getSubmittedKey === 'function')
      ? await OrderStorage._getSubmittedKey()
      : `submittedOrders_${shopId}`;

    const stored = await chrome.storage.local.get([draftKey, submittedKey, `submittedOrders_${shopId}`, `savedOrders_${shopId}`, 'savedOrders', 'submittedOrders']).catch(() => ({}));

    // Merge đơn nháp (Cải thiện Sync semantics - Cập nhật theo updated_at)
    if (cloudOrders.length > 0) {
      const localDrafts = stored[draftKey] || stored.savedOrders || [];
      const localMap = new Map(localDrafts.map(o => [o.id, o]));
      let hasChanges = false;
      
      cloudOrders.forEach(co => {
        if (!co.id) return;
        const lo = localMap.get(co.id);
        if (!lo) {
          localMap.set(co.id, co);
          hasChanges = true;
        } else {
          // So sánh updated_at
          const cTime = co.updated_at ? new Date(co.updated_at).getTime() : 0;
          const lTime = lo.updated_at ? new Date(lo.updated_at).getTime() : 0;
          // Coi deleted_at là ưu tiên cao nhất
          if (co.deleted_at && !lo.deleted_at) {
            localMap.delete(co.id);
            hasChanges = true;
          } else if (cTime > lTime && !lo.deleted_at) {
            localMap.set(co.id, { ...lo, ...co });
            hasChanges = true;
          }
        }
      });
      
      if (hasChanges) {
        const merged = Array.from(localMap.values()).filter(o => !o.deleted_at);
        await chrome.storage.local.set({ [draftKey]: merged, savedOrders: merged }).catch(() => {});
        // Thông báo cập nhật
        chrome.tabs.query({}, tabs => {
          tabs.forEach(t => {
            if (t.url && (t.url.startsWith('chrome-extension://') || t.url.includes('options.html'))) {
              chrome.tabs.sendMessage(t.id, { type: 'cloud_sync_update', table: 'orders' }).catch(() => {});
            }
          });
        });
      }
    }

    // Merge đơn đã lên đơn
    if (cloudSubmitted.length > 0) {
      const localSub = stored[submittedKey] || stored.submittedOrders || [];
      const localSubMap = new Map(localSub.map(o => [o.id, o]));
      let subHasChanges = false;
      
      cloudSubmitted.forEach(co => {
        if (!co.id) return;
        const lo = localSubMap.get(co.id);
        if (!lo) {
          localSubMap.set(co.id, co);
          subHasChanges = true;
        } else {
          const cTime = co.updated_at ? new Date(co.updated_at).getTime() : 0;
          const lTime = lo.updated_at ? new Date(lo.updated_at).getTime() : 0;
          if (co.deleted_at && !lo.deleted_at) {
            localSubMap.delete(co.id);
            subHasChanges = true;
          } else if (cTime > lTime && !lo.deleted_at) {
            localSubMap.set(co.id, { ...lo, ...co });
            subHasChanges = true;
          }
        }
      });
      
      if (subHasChanges) {
        const mergedSub = Array.from(localSubMap.values()).filter(o => !o.deleted_at);
        let userId = '';
        try {
          if (typeof AuthSession !== 'undefined' && AuthSession.getSession) {
            const s = await AuthSession.getSession().catch(() => null);
            userId = s?.user?.id || s?.user_id || '';
          }
        } catch (_) {}

        const patchSub = {
          [submittedKey]: mergedSub,
          [`submittedOrders_${shopId}`]: mergedSub,
          submittedOrders: mergedSub
        };
        if (userId) {
          patchSub[`submittedOrders_${userId}`] = mergedSub;
        }
        await chrome.storage.local.set(patchSub).catch(() => {});
        chrome.tabs.query({}, tabs => {
          tabs.forEach(t => {
            if (t.url && (t.url.includes('options.html') || t.url.startsWith('chrome-extension://'))) {
              chrome.tabs.sendMessage(t.id, { type: 'cloud_sync_update', table: 'submitted_orders' }).catch(() => {});
            }
          });
        });
      }
    }
  } catch (e) {
    console.warn('[AutoSync] Lỗi đồng bộ đơn hàng:', e.message);
  }
}

// ── Đồng bộ Cấu hình Shop / AI từ Supabase về ───────────────────────────
async function _autoSyncConfig() {
  try {
    if (!(await _isCloudConfigured())) return;

    // Cập nhật device heartbeat (last_seen)
    if (typeof SupabaseCloud.syncDeviceRecord === 'function') {
      const registration = await SupabaseCloud.syncDeviceRecord().catch(error => ({ ok: false, reason: error.message }));
      if (!registration?.ok && registration?.reason !== 'NO_TOKEN') {
        console.warn('[DEVICE_REGISTRATION_FAILED]', registration?.reason || 'UNKNOWN_ERROR');
      }
    }

    // Kiểm tra thiết bị bị thu hồi
    await enforceDeviceRevokedRule().catch(() => {});

    // Kéo cài đặt API key / model / prompt từ bảng shop_settings nếu có
    if (typeof SupabaseCloud.rpc === 'function') {
      const shopRes = await chrome.storage.local.get(['activeShopId']).catch(() => ({}));
      const shopId = shopRes.activeShopId;
      if (shopId) {
        const result = await SupabaseCloud.rpc('get_shop_settings', { p_shop_id: shopId }).catch(() => null);
        if (result && result.ok && result.data) {
          const settings = result.data;
          const patch = {};
          // DO NOT SYNC API KEY TO CLIENT (Phase 1.4)
          if (settings.api_model) patch.apiModel = settings.api_model;
          if (settings.ai_prompt) patch.customAiPrompt = settings.ai_prompt;
          if (Object.keys(patch).length > 0) {
            await chrome.storage.local.set(patch).catch(() => {});
            chrome.tabs.query({}, tabs => {
              tabs.forEach(t => {
                if (t.url && t.url.includes('options.html')) {
                  chrome.tabs.sendMessage(t.id, { type: 'cloud_config_update', settings: patch }).catch(() => {});
                }
              });
            });
          }
        }
      }
    }
  } catch (e) {
    console.warn('[AutoSync] Lỗi đồng bộ cấu hình:', e.message);
  }
}

// ── Kiểm tra cập nhật phiên bản Extension từ xa (OTA Version Checker) ────
async function _autoCheckVersion() {
  try {
    if (typeof VersionChecker !== 'undefined' && typeof VersionChecker.checkUpdate === 'function') {
      const result = await VersionChecker.checkUpdate();
      if (result && result.ok && result.hasUpdate) {
        chrome.tabs.query({}, tabs => {
          tabs.forEach(t => {
            if (t.id) {
              chrome.tabs.sendMessage(t.id, {
                type: 'app_update_changed',
                status: result.status
              }).catch(() => {});
            }
          });
        });
      }
    }
  } catch (err) {
    console.warn('[AutoCheckVersion] Lỗi kiểm tra cập nhật:', err.message);
  }
}

// ── Đăng ký Alarm khi Service Worker khởi động ──────────────────────────
chrome.alarms.create(ALARM_SYNC, { periodInMinutes: 5 });
chrome.alarms.create(ALARM_CONFIG, { periodInMinutes: 5 });
chrome.alarms.create(ALARM_PERM_REFRESH, { periodInMinutes: 5 });
chrome.alarms.create(ALARM_VERSION_CHECK, { periodInMinutes: 30 });
chrome.alarms.create(ALARM_CACHE_EVICTION, { periodInMinutes: 240 });
// ALARM_DEVICE_CHECK được đăng ký ở phần dưới cùng với enforceDeviceRevokedRule

// Chạy kiểm tra phiên bản ngay khi khởi động
setTimeout(_autoCheckVersion, 2000);
setTimeout(() => {
  if (typeof parseCache !== 'undefined' && typeof parseCache.evictExpiredKeys === 'function') {
    parseCache.evictExpiredKeys().catch(() => {});
  }
}, 15000);

// ── Xử lý Alarm khi kích hoạt ────────────────────────────────────────────
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === ALARM_SYNC) {
    _autoSyncOrders();
  } else if (alarm.name === ALARM_CONFIG) {
    _autoSyncConfig();
  } else if (alarm.name === ALARM_PERM_REFRESH) {
    if (typeof AuthService !== 'undefined' && typeof AuthService.refreshPermissions === 'function') {
      AuthService.refreshPermissions().catch(() => {});
    }
  } else if (alarm.name === ALARM_VERSION_CHECK) {
    _autoCheckVersion();
  } else if (alarm.name === ALARM_CACHE_EVICTION) {
    if (typeof parseCache !== 'undefined' && typeof parseCache.evictExpiredKeys === 'function') {
      parseCache.evictExpiredKeys().catch(() => {});
    }
  } else if (alarm.name === 'ag_device_check') {
    enforceDeviceRevokedRule();
  }
});

// ── Cho phép gọi manual sync từ tab Options ─────────────────────────────
// (Xử lý message action: 'manualSyncCloud' trong block onMessage bên dưới)



// ─── AI GATEWAY CLIENT ──────────────────────────────────────────────────────
// P0-02: Route mọi AI call qua Supabase Edge Function.
// Extension không bao giờ biết Groq API key.
// Gateway tự xử lý: auth → shop → feature flag → rate limit → quota → model selection → Groq
async function _getSupabaseUrl() {
  if (typeof SupabaseCloud !== 'undefined' && typeof SupabaseCloud.loadConfig === 'function') {
    const cfg = await SupabaseCloud.loadConfig().catch(() => null);
    if (cfg && cfg.url) return cfg.url.replace(/\/+$/, '');
  }
  if (typeof SUPABASE_CONFIG !== 'undefined' && SUPABASE_CONFIG.url) {
    return SUPABASE_CONFIG.url.replace(/\/+$/, '');
  }
  return 'https://xlgovgynbsahuykyjzcx.supabase.co';
}

async function _callAiGateway(task, text, clientToken, clientShopId, clientShopKey, clientStaffName, extraPayload = {}) {
  try {
    const supabaseUrl = await _getSupabaseUrl();
    let token = clientToken || (typeof AuthSession !== 'undefined' ? (await AuthSession.getSession())?.access_token : null);

    let shopKey = clientShopKey;
    if (!shopKey) {
      try {
        if (typeof AuthSession !== 'undefined' && AuthSession.getSession) {
          const s = await AuthSession.getSession();
          shopKey = s?.shop_access_key;
        }
      } catch (_) {}
    }
    if (!shopKey) {
      shopKey = await new Promise(resolve => {
        chrome.storage.local.get(['shop_access_key', 'vnpost_session'], r => {
          resolve(r.shop_access_key || (r.vnpost_session && r.vnpost_session.shop_access_key) || null);
        });
      });
    }

    if (!token && !shopKey) {
      throw new Error('Chưa đăng nhập. Vui lòng đăng nhập để dùng AI.');
    }

    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let shopId = (clientShopId && UUID_REGEX.test(String(clientShopId).trim())) ? String(clientShopId).trim() : null;
    try {
      if (!shopId && typeof AuthSession !== 'undefined' && AuthSession.getActiveShop) {
        const sId = await AuthSession.getActiveShop();
        if (sId && UUID_REGEX.test(String(sId).trim())) shopId = String(sId).trim();
      }
    } catch (_) {}

    if (!shopId) {
      shopId = await new Promise(resolve => {
        chrome.storage.local.get(['vnpost_session'], r => {
          const s = r.vnpost_session && r.vnpost_session.active_shop_id;
          resolve(s && UUID_REGEX.test(String(s).trim()) ? String(s).trim() : null);
        });
      });
    }

    const deviceId = await SupabaseCloud._getDeviceId().catch(() => '');
    const gatewayUrl = `${supabaseUrl}/functions/v1/ai-gateway`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 40000);

    const headers = {
      'Content-Type': 'application/json'
    };
    if (token && !token.startsWith('KEY-')) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (shopKey) {
      headers['x-shop-access-key'] = shopKey;
    } else if (token && token.startsWith('KEY-')) {
      headers['x-shop-access-key'] = token;
    }

    let resp;
    try {
      resp = await fetch(gatewayUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ 
          task, 
          text, 
          deviceId, 
          shop_id: shopId || undefined,
          shop_access_key: shopKey || (token && token.startsWith('KEY-') ? token : undefined),
          staff_name: clientStaffName || undefined,
          ...extraPayload
        }),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timer);
    }

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      console.warn('[AI Gateway SW] Remote error response:', resp.status, errData);
      
      // Bắt lỗi Auth từ Supabase Kong Gateway (Invalid JWT/Expired JWT)
      if (resp.status === 401 && errData.message && errData.message.toUpperCase().includes('JWT')) {
        errData.error = ERROR_CODES.AI_AUTH_REQUIRED;
      }

      const safeError = toUserSafeError({
        code: errData.error || ERROR_CODES.AI_UPSTREAM_ERROR,
        message: errData.message
      });
      // Raw provider error chỉ log dev/debug, không show raw JSON cho người dùng
      console.warn('[AI Gateway SW] Provider raw error:', errData.message);
      const error = new Error(safeError.message);
      error.code = safeError.code;
      throw error;
    }

    const responseData = await resp.json();
    return { 
      ok: true, 
      result: responseData.data || responseData.result || null, 
      quota: responseData.quota 
    };
  } catch (e) {
    if (e.name !== 'AbortError') {
      const safeError = toUserSafeError(e);
      return { ok: false, code: safeError.code, error: safeError.message };
    }
    if (e.name === 'AbortError') {
      const safeError = toUserSafeError({ code: ERROR_CODES.AI_TIMEOUT });
      return { ok: false, code: safeError.code, error: safeError.message };
    }
    return { ok: false, error: e.message || 'Lỗi không xác định từ AI Gateway.' };
  }
}

// Tự động đăng ký thiết bị với Supabase Cloud ngầm khi Service Worker khởi chạy
setTimeout(() => {
  if (typeof SupabaseCloud !== 'undefined' && typeof SupabaseCloud.registerDevice === 'function') {
    SupabaseCloud.registerDevice()
      .then(result => {
        if (!result?.ok && result?.reason !== 'NO_TOKEN') {
          console.warn('[DEVICE_REGISTRATION_FAILED]', result?.reason || 'UNKNOWN_ERROR');
        }
      })
      .catch(error => console.warn('[DEVICE_REGISTRATION_FAILED]', error.message));
  }
}, 2000);

// ─── KIỂM TRA THIẾT BỊ BỊ THU HỒI (REVOKED) → TỰ ĐĂNG XUẤT ─────────
async function enforceDeviceRevokedRule() {
  try {
    if (typeof SupabaseCloud !== 'undefined' && typeof SupabaseCloud.checkDeviceRevoked === 'function') {
      const res = await SupabaseCloud.checkDeviceRevoked();
      if (res && res.ok === true && res.revoked === true) {
        console.warn('[SW enforceDeviceRevokedRule] Thiết bị đã bị thu hồi quyền truy cập. Đăng xuất toàn bộ phiên.');
        // Xoá mọi token phiên đăng nhập
        await chrome.storage.session.remove(['fbAuthTokens', 'fbDeviceId', 'fbDeviceName']).catch(() => {});
        await chrome.storage.local.remove([
          'vnpost_session',
          'shop_access_key',
          'active_shop_id',
          'currentUser',
          'activeShop',
          'activeShopId',
          'current_shop_id',
          'access_token',
          'refresh_token',
          'fbAuthTokens'
        ]).catch(() => {});
        chrome.runtime.sendMessage({ action: 'deviceRevoked', type: 'deviceRevoked' }).catch(() => {});
        chrome.tabs.query({}, (tabs) => {
          (tabs || []).forEach(t => {
            if (t.id) {
              chrome.tabs.sendMessage(t.id, { type: 'deviceRevoked', action: 'deviceRevoked' }).catch(() => {});
            }
          });
        });
      } else if (res && res.ok === true) {
        await chrome.storage.local.set({ device_access_state: 'active', device_access_checked_at: Date.now() }).catch(() => {});
      } else if (res && res.reason !== 'NO_TOKEN') {
        const stored = await new Promise(resolve => chrome.storage.local.get(['device_access_checked_at'], resolve)).catch(() => ({}));
        const lastCheckedAt = Number(stored?.device_access_checked_at || 0);
        const withinGrace = lastCheckedAt > 0 && Date.now() - lastCheckedAt <= DEVICE_CHECK_GRACE_MS;
        await chrome.storage.local.set({ device_access_state: 'offline_grace', device_access_error: res.reason || 'DEVICE_CHECK_FAILED' }).catch(() => {});
        if (!withinGrace) console.warn('[DEVICE_CHECK_FAILED]', res.reason || 'DEVICE_CHECK_FAILED');
      }
    }
  } catch (_e) { /* bỏ qua lỗi mạng / chưa có Supabase */ }
}

// ─── ALARM NAMES ─────────────────────────────────────────────────────────────
const ALARM_DEVICE_CHECK = 'ag_device_check'; // Remote kill-switch: kiểm tra mỗi 30 giây
const DEVICE_CHECK_GRACE_MS = 15 * 60 * 1000;

// Đăng ký alarm định kỳ kiểm tra thiết bị
chrome.alarms.create(ALARM_DEVICE_CHECK, { periodInMinutes: 0.5 });

// Kiểm tra ngay khi SW wake
enforceDeviceRevokedRule();


// ─── HELPER: Tái sử dụng tab options đang mở thay vì tạo mới ────────────────
const OPTIONS_PAGE_URL = chrome.runtime.getURL('frontend/options/options.html');

async function _focusOrCreateOptionsTab(sendResponse) {
  try {
    if (typeof chrome !== 'undefined' && chrome.tabs && typeof chrome.tabs.query === 'function') {
      const tabs = await new Promise(resolve => {
        chrome.tabs.query({}, (res) => {
          if (chrome.runtime.lastError) resolve([]);
          else resolve(res || []);
        });
      });
      
      const existing = tabs.find(t => t.url && t.url.startsWith(OPTIONS_PAGE_URL));
      if (existing) {
        await chrome.tabs.update(existing.id, { active: true });
        if (existing.windowId) {
          await chrome.windows.update(existing.windowId, { focused: true });
        }
        if (sendResponse) {
          try { sendResponse({ ok: true, reused: true }); } catch (_) {}
        }
        return;
      }
    }
  } catch (e) {
    console.warn("Lỗi khi tìm tab options:", e);
  }

  // Fallback
  if (typeof chrome !== 'undefined' && chrome.runtime && typeof chrome.runtime.openOptionsPage === 'function') {
    chrome.runtime.openOptionsPage(() => {
      if (chrome.runtime.lastError) {
        if (typeof chrome.tabs !== 'undefined' && chrome.tabs.create) {
          chrome.tabs.create({ url: OPTIONS_PAGE_URL }, () => {
            if (sendResponse) { try { sendResponse({ ok: true, reused: false }); } catch (_) {} }
          });
        }
      } else {
        if (sendResponse) { try { sendResponse({ ok: true, reused: false }); } catch (_) {} }
      }
    });
  } else if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
    chrome.tabs.create({ url: OPTIONS_PAGE_URL }, () => {
      if (sendResponse) { try { sendResponse({ ok: true, reused: false }); } catch (_) {} }
    });
  }
}

async function _focusOrCreateAdminTab(sendResponse) {
  const adminUrl = chrome.runtime.getURL('admin-dashboard/login.html');
  try {
    if (typeof chrome !== 'undefined' && chrome.tabs && typeof chrome.tabs.query === 'function') {
      const tabs = await new Promise(resolve => {
        chrome.tabs.query({}, (res) => {
          if (chrome.runtime.lastError) resolve([]);
          else resolve(res || []);
        });
      });
      const existing = tabs.find(t => t.url && (t.url.startsWith(adminUrl) || t.url.includes('admin-dashboard/admin.html')));
      if (existing) {
        await chrome.tabs.update(existing.id, { active: true });
        if (existing.windowId) {
          await chrome.windows.update(existing.windowId, { focused: true });
        }
        if (sendResponse) {
          try { sendResponse({ ok: true }); } catch (_) {}
        }
        return;
      }
    }
  } catch (e) {
    console.warn("Lỗi khi tìm tab admin:", e);
  }

  if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
    chrome.tabs.create({ url: adminUrl }, () => {
      if (sendResponse) { try { sendResponse({ ok: true }); } catch (_) {} }
    });
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  if (!message) return false;

  // ─── 0. XỬ LÝ MỞ DASHBOARD ───
  if (message.action === 'openDashboard') {
    _focusOrCreateOptionsTab(sendResponse);
    return true;
  }

  // ─── 0b. RELAY ORDER UPDATES TỚI TOÀN BỘ TABS (REALTIME MULTI-TAB) ───
  if (
    message.action === 'draftOrdersUpdated' || 
    message.action === 'refreshDraftQueue' ||
    message.action === 'refresh_orders' ||
    message.action === 'ordersUpdated' ||
    message.type === 'order_submitted' ||
    message.type === 'cloud_sync_update' ||
    message.type === 'submitted_orders_updated'
  ) {
    chrome.tabs.query({}, tabs => {
      tabs.forEach(t => {
        if (t.id) {
          chrome.tabs.sendMessage(t.id, message).catch(() => {});
        }
      });
    });
    sendResponse({ ok: true });
    return true;
  }

  // ─── 1. XỬ LÝ MỞ TRANG CÀI ĐẶT ───
  if (message.action === 'openOptions') {
    _focusOrCreateOptionsTab(sendResponse);
    return true;
  }

  // ─── 1b. XỬ LÝ MỞ TRANG QUẢN TRỊ ───
  if (message.action === 'openAdmin') {
    _focusOrCreateAdminTab(sendResponse);
    return true;
  }

  // ─── 1c. KIỂM TRA CẬP NHẬT PHIÊN BẢN (OTA) ───
  if (message.action === 'checkAppUpdate') {
    (async () => {
      try {
        if (typeof VersionChecker !== 'undefined') {
          const res = await VersionChecker.checkUpdate();
          sendResponse(res);
        } else {
          sendResponse({ ok: false, reason: 'NO_CHECKER' });
        }
      } catch (err) {
        sendResponse({ ok: false, reason: err.message });
      }
    })();
    return true;
  }

  // ─── 2. THAY ĐỔI TÊN THIẾT BỊ ───
  if (message.action === 'setDeviceName') {
    if (typeof SupabaseCloud !== 'undefined') {
      SupabaseCloud._deviceName = message.name;
      SupabaseCloud.setDeviceName(message.name).catch(() => {});
    }
    sendResponse({ ok: true });
    return true;
  }

  // ─── 3. ĐĂNG NHẬP / ĐĂNG XUẤT CLOUD ───
  // firebaseSignIn: legacy action name giữ lại để không break UI cũ, nhưng giờ dùng Supabase
  if (message.action === 'firebaseSignIn') {
    (async () => {
      try {
        if (typeof SupabaseCloud !== 'undefined') {
          await SupabaseCloud.loadConfig();
          const registration = await SupabaseCloud.registerDevice();
          if (!registration?.ok) {
            sendResponse({
              ok: false,
              code: 'DEVICE_REGISTRATION_FAILED',
              error: registration?.reason || 'Không thể đăng ký thiết bị.'
            });
            return;
          }
          sendResponse({
            ok: true,
            deviceId: SupabaseCloud._deviceId,
            deviceName: SupabaseCloud._deviceName
          });
        } else {
          sendResponse({ ok: false, error: 'Supabase chưa được cấu hình' });
        }
      } catch (err) {
        sendResponse({ ok: false, error: err.message });
      }
    })();
    return true;
  }

  if (message.action === 'firebaseSignOut' || message.action === 'PERFORM_LOGOUT') {
    const keysToRemove = [
      'vnpost_session',
      'shop_access_key',
      'staff_name',
      'active_shop_id',
      'shop_name',
      'currentUser',
      'activeShop',
      'activeShopId',
      'current_shop_id',
      'access_token',
      'refresh_token',
      'fbAuthTokens',
      'fbDeviceId',
      'fbDeviceName'
    ];
    chrome.storage.local.remove(keysToRemove).catch(() => {});
    chrome.storage.session.remove(['fbAuthTokens', 'fbDeviceId', 'fbDeviceName']).catch(() => {});

    // Broadcast tới toàn bộ tab đang mở (VNPost, J&T) để cập nhật UI ngay lập tức
    if (typeof chrome.tabs !== 'undefined' && chrome.tabs.query) {
      chrome.tabs.query({}, tabs => {
        if (Array.isArray(tabs)) {
          tabs.forEach(tab => {
            if (tab.id) {
              chrome.tabs.sendMessage(tab.id, { action: 'LOGOUT_BROADCAST' }).catch(() => {});
            }
          });
        }
      });
    }

    if (typeof AuthService !== 'undefined' && typeof AuthService.logout === 'function') {
      AuthService.logout().then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: true }));
    } else {
      sendResponse({ ok: true });
    }
    return true;
  }

  // ─── 3b. THIẾT BỊ BỊ THU HỒI → XÓA SESSION TẠI CÁC TAB ───
  if (message.action === 'deviceRevoked' || message.type === 'deviceRevoked') {
    const keysToRemove = [
      'vnpost_session',
      'shop_access_key',
      'staff_name',
      'active_shop_id',
      'shop_name',
      'currentUser',
      'activeShop',
      'activeShopId',
      'current_shop_id',
      'access_token',
      'refresh_token',
      'fbAuthTokens',
      'fbDeviceId',
      'fbDeviceName'
    ];
    chrome.storage.session.remove(['fbAuthTokens', 'fbDeviceId', 'fbDeviceName']).catch(() => {});
    chrome.storage.local.remove(keysToRemove).catch(() => {});

    if (typeof chrome.tabs !== 'undefined' && chrome.tabs.query) {
      chrome.tabs.query({}, tabs => {
        if (Array.isArray(tabs)) {
          tabs.forEach(tab => {
            if (tab.id) {
              chrome.tabs.sendMessage(tab.id, { action: 'deviceRevoked' }).catch(() => {});
            }
          });
        }
      });
    }

    if (typeof AuthService !== 'undefined' && typeof AuthService.logout === 'function') AuthService.logout().catch(() => {});
    sendResponse({ ok: true });
    return true;
  }

  if (message.action === 'registerDevice') {
    SupabaseCloud.registerDevice()
      .then(res => sendResponse(res))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message.action === 'fetchDevices') {
    SupabaseCloud.fetchDevices()
      .then(devices => sendResponse(devices))
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }

  // Legacy action name retained for old content scripts; implementation is
  // audited revocation in SupabaseCloud.deleteDevice (never hard delete).
  if (message.action === 'deleteDevice' || message.action === 'revokeDevice') {
    SupabaseCloud.deleteDevice(message.deviceId)
      .then(res => {
        enforceDeviceRevokedRule().catch(() => {});
        sendResponse(res);
      })
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message.action === 'deviceRevokedTriggered') {
    enforceDeviceRevokedRule().catch(() => {});
    sendResponse({ ok: true });
    return true;
  }

  // ─── 4. ĐỒNG BỘ ĐƠN HÀNG CLOUD ───

  // Manual sync được gọi từ nút "Kết nối & Đồng bộ" trên trang Options
  if (message.action === 'manualSyncCloud') {
    Promise.all([_autoSyncOrders(), _autoSyncConfig()])
      .then(() => sendResponse({ ok: true }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message.action === 'pushOrder') {
    SupabaseCloud.pushOrder(message.order)
      .then(ok => sendResponse({ ok }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message.action === 'pushHistory' || message.action === 'pushOrders') {
    const entries = message.entries || message.orders || [];
    SupabaseCloud.pushHistory(entries)
      .then(() => sendResponse({ ok: true }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message.action === 'deleteOrder') {
    SupabaseCloud.deleteOrder(message.orderId)
      .then(ok => sendResponse({ ok }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message.action === 'deleteBulkOrdersCloud') {
    if (typeof SupabaseCloud !== 'undefined' && SupabaseCloud.deleteBulkOrdersCloud) {
      SupabaseCloud.deleteBulkOrdersCloud(message.ids)
        .then(ok => sendResponse({ ok }))
        .catch(err => sendResponse({ ok: false, error: err.message }));
    } else {
      sendResponse({ ok: false, error: 'Not supported' });
    }
    return true;
  }

  if (message.action === 'fetchOrders') {
    const fetchFn = typeof SupabaseCloud.fetchOrders === 'function' ? SupabaseCloud.fetchOrders.bind(SupabaseCloud) : null;
    if (fetchFn) {
      fetchFn(message.shopId || null)
        .then(orders => sendResponse(orders))
        .catch(err => sendResponse({ error: err.message }));
    } else {
      sendResponse([]);
    }
    return true;
  }

  if (message.action === 'deleteSubmittedOrderCloud') {
    SupabaseCloud.deleteSubmittedOrderCloud(message.orderId)
      .then(ok => sendResponse({ ok }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message.action === 'deleteBulkSubmittedOrdersCloud') {
    if (typeof SupabaseCloud !== 'undefined' && SupabaseCloud.deleteBulkSubmittedOrdersCloud) {
      SupabaseCloud.deleteBulkSubmittedOrdersCloud(message.ids)
        .then(ok => sendResponse({ ok }))
        .catch(err => sendResponse({ ok: false, error: err.message }));
    } else {
      sendResponse({ ok: false, error: 'Not supported' });
    }
    return true;
  }

  if (message.action === 'clearSubmittedOrdersCloud') {
    SupabaseCloud.clearSubmittedOrdersCloud()
      .then(ok => sendResponse({ ok }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message.action === 'clearHistoryCloud') {
    SupabaseCloud.clearHistoryCloud()
      .then(ok => sendResponse({ ok }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message.action === 'clearAllCloudData') {
    SupabaseCloud.clearAllCloudData()
      .then(ok => sendResponse({ ok }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message.action === 'pushCustomersCloud') {
    SupabaseCloud.pushCustomersCloud(message.customers)
      .then(ok => sendResponse({ ok }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message.action === 'customerHubSyncOrder') {
    SupabaseCloud.rpc('customer_hub_sync_order', message.params || {})
      .then(result => sendResponse(result || { ok: false }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message.action === 'fetchCustomersCloud') {
    SupabaseCloud.fetchCustomersCloud()
      .then(custs => sendResponse(custs || []))
      .catch(err => sendResponse([]));
    return true;
  }

  if (message.action === 'clearCustomersCloud') {
    SupabaseCloud.clearCustomersCloud()
      .then(ok => sendResponse({ ok }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  // ─── 4b. ĐỒNG BỘ ĐƠN HÀNG ĐÃ LÊN ĐƠN (SUBMITTED ORDERS) CLOUD ───
  if (message.action === 'pushSubmittedOrder') {
    SupabaseCloud.pushSubmittedOrder(message.order)
      .then(ok => {
        sendResponse({ ok });
        if (message.order && (!message.order.trackingCode || message.order.trackingCode === '—')) {
          if (message.order.platform === 'jt' || message.order.platform === 'j&t') {
            autoFetchJtWaybillInBackground(message.order);
          } else if (message.order.platform === 'vnpost') {
            autoFetchVnpostWaybillInBackground(message.order);
          }
        }
      })
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message.action === 'jtWaybillFound' || message.action === 'vnpostWaybillFound') {
    const { waybillCode, orderId } = message;
    if (waybillCode && orderId && typeof SupabaseCloud.updateSubmittedOrderTracking === 'function') {
      SupabaseCloud.updateSubmittedOrderTracking(orderId, waybillCode).catch(() => {});
    }
    sendResponse({ ok: true });
    return true;
  }

  if (message.action === 'pushSubmittedOrders') {
    SupabaseCloud.pushSubmittedOrders(message.orders)
      .then(() => sendResponse({ ok: true }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message.action === 'fetchSubmittedOrders') {
    SupabaseCloud.fetchSubmittedOrders(message.shopId || null)
      .then(orders => sendResponse({ ok: true, orders: orders || [] }))
      .catch(err => sendResponse({ ok: false, error: err.message, orders: [] }));
    return true;
  }

  if (message.action === 'fetchHistory') {
    SupabaseCloud.fetchHistory()
      .then(orders => sendResponse(orders || []))
      .catch(() => sendResponse([]));
    return true;
  }

  // ─── TỰ ĐỘNG LẤY MÃ VẬN ĐƠN NẾU ĐƠN CHƯA CÓ MÃ VẬN ĐƠN ───
  if (message.action === 'checkAndFetchUnassignedWaybills') {
    (async () => {
      try {
        const submitted = await OrderStorage.getSubmittedOrders().catch(() => []);
        const unassigned = (submitted || []).filter(s => !s.trackingCode || s.trackingCode === '—' || s.trackingCode === '');
        if (unassigned.length > 0) {
          unassigned.forEach(order => {
            const p = (order.platform || '').toLowerCase();
            if (p.includes('jt') || p.includes('j&t')) {
              autoFetchJtWaybillInBackground(order);
            } else {
              autoFetchVnpostWaybillInBackground(order);
            }
          });
        }
        sendResponse({ ok: true, checkedCount: unassigned.length });
      } catch (err) {
        sendResponse({ ok: false, error: err.message });
      }
    })();
    return true;
  }

  // Phase 3: Check permission live qua Service Worker
  if (message.action === 'checkPermission') {
    if (typeof AuthSession !== 'undefined') {
      AuthSession.getSession().then(session => {
        const perms = session?.permissions || [];
        const role = session?.role || 'VIEWER';
        const allowed = perms.includes('*') || perms.includes(message.permission);
        sendResponse({ allowed, role, permissions: perms, features: session?.features || {} });
      }).catch(err => {
        sendResponse({ allowed: false, error: err.message });
      });
    } else {
      sendResponse({ allowed: false, error: 'AuthSession not loaded' });
    }
    return true;
  }

  if (message.action === 'migrateFirebaseToSupabase') {
    if (typeof SupabaseCloud !== 'undefined' && typeof SupabaseCloud.migrateFromFirebase === 'function') {
      SupabaseCloud.migrateFromFirebase(message.firebaseProjectId || 'nppdungxuan')
        .then(result => sendResponse(result))
        .catch(err => sendResponse({ ok: false, error: err.message }));
    } else {
      sendResponse({ ok: false, error: 'Chưa hỗ trợ Supabase' });
    }
    return true;
  }

  if (message.action === 'deleteSubmittedOrderCloud') {
    SupabaseCloud.deleteSubmittedOrderCloud(message.orderId)
      .then(ok => sendResponse({ ok }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message.action === 'syncToCloud') {
    SupabaseCloud.pushHistory(message.orders)
      .then(() => sendResponse({ ok: true, count: message.orders.length }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  // syncFromCloud: legacy action, trả về data từ Supabase
  if (message.action === 'syncFromCloud') {
    Promise.all([
      SupabaseCloud.fetchOrders().catch(() => []),
      Promise.resolve({})
    ]).then(([orders, customerMetadata]) => {
      sendResponse({ ok: true, orders, customerMetadata });
    }).catch(err => {
      sendResponse({ ok: false, error: err.message });
    });
    return true;
  }

  // pushCustomerMetadata / fetchCustomersMetadata: không còn Firebase dependency
  if (message.action === 'pushCustomerMetadata') {
    sendResponse({ ok: false, error: 'Firebase customer metadata không còn hỗ trợ. Dùng Supabase.' });
    return true;
  }

  if (message.action === 'fetchCustomersMetadata') {
    sendResponse({ ok: true, metadata: {} });
    return true;
  }

  // ─── 5. ĐỒNG BỘ LỊCH SỬ CLOUD ───
  // (pushHistory và fetchHistory đã được xử lý ở trên trong khối 4)

  if (message.action === 'deleteOrderCloud') {
    if (typeof SupabaseCloud !== 'undefined' && typeof SupabaseCloud.deleteOrderCloud === 'function') {
      SupabaseCloud.deleteOrderCloud(message.id)
        .then(ok => sendResponse({ ok }))
        .catch(err => sendResponse({ ok: false, error: err.message }));
    } else {
      sendResponse({ ok: false });
    }
    return true;
  }

  // syncHistoryToCloud / syncHistoryFromCloud: redirect đến Supabase
  if (message.action === 'syncHistoryToCloud') {
    SupabaseCloud.pushHistory(message.entries)
      .then(() => sendResponse({ ok: true, count: (message.entries || []).length }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message.action === 'syncHistoryFromCloud') {
    SupabaseCloud.fetchHistory()
      .then(entries => sendResponse({ ok: true, entries: entries || [] }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  // ─── 5b. DEVICE NAME CLOUD SYNC (Supabase-only) ───
  if (message.action === 'pushDeviceName') {
    if (typeof SupabaseCloud !== 'undefined' && typeof SupabaseCloud.setDeviceName === 'function') {
      SupabaseCloud.setDeviceName(message.name)
        .then(() => sendResponse({ ok: true }))
        .catch(err => sendResponse({ ok: false, error: err.message }));
    } else {
      sendResponse({ ok: true }); // bỏ qua nếu không có Supabase
    }
    return true;
  }

  if (message.action === 'fetchDeviceName') {
    if (typeof SupabaseCloud !== 'undefined' && typeof SupabaseCloud._getDeviceName === 'function') {
      SupabaseCloud._getDeviceName()
        .then(name => sendResponse({ name: name || '' }))
        .catch(err => sendResponse({ name: '' }));
    } else {
      sendResponse({ name: '' });
    }
    return true;
  }

  // fetchDeviceNames: không còn Firebase dependency
  if (message.action === 'fetchDeviceNames') {
    sendResponse([]);
    return true;
  }

  // ─── 6. API KEY SYNC — không còn lưu Groq key ở client ───
  // (P0-04: xóa Groq API key UI và sync)
  if (message.action === 'pushApiKey' || message.action === 'fetchApiKey') {
    sendResponse({ ok: false, error: 'API key sync không còn hỗ trợ. Groq key được quản lý server-side qua AI Gateway.' });
    return true;
  }

  // ─── 7. DATA MIGRATION CLOUD — chỉ giữ Firebase→Supabase migration ───
  if (message.action === 'migrateAllToShared' || message.action === 'migrateFromUserId' || message.action === 'migrateOldSharedPath') {
    sendResponse({ ok: false, error: 'Firebase migration không còn cần thiết — dữ liệu đã được migrate sang Supabase.' });
    return true;
  }

  // ─── KIỂM TRA PHIÊN ĐĂNG NHẬP HÃNG VẬN CHUYỂN (CARRIER SESSION CHECK) ───
  // P0 Invariant: Tuyệt đối không tự tạo cookie giả mạo (MOCK_TOKEN) của hãng.
  // Chỉ kiểm tra phiên đăng nhập thực tế trên trình duyệt và trả trạng thái connected / expired / unknown.
  if (message.action === 'checkCarrierSession' || message.action === 'checkVnpostSession') {
    const carrier = message.carrier || 'vnpost';
    const targetUrl = carrier === 'jt' ? 'https://khachhang.jtexpress.vn' : 'https://donhang.vnpost.vn';

    if (chrome.cookies) {
      chrome.cookies.getAll({ url: targetUrl }, (cookies) => {
        const lastErr = chrome.runtime.lastError;
        if (lastErr || !cookies) {
          sendResponse({ ok: false, status: 'unknown', error: lastErr?.message || 'Không thể đọc cookies' });
          return;
        }
        const hasSession = cookies.some(c => {
          const name = (c.name || '').toLowerCase();
          return (name.includes('token') || name.includes('session') || name.includes('auth') || name.includes('jwt')) && !c.value.includes('MOCK');
        });

        if (hasSession) {
          sendResponse({ ok: true, status: 'connected' });
        } else {
          if (chrome.tabs) {
            chrome.tabs.query({ url: `${targetUrl}/*` }, (tabs) => {
              if (tabs && tabs.length > 0) {
                sendResponse({ ok: true, status: 'unknown', reason: 'Tab đang mở nhưng chưa xác thực phiên' });
              } else {
                sendResponse({ ok: true, status: 'disconnected', reason: 'Chưa có phiên đăng nhập trên trình duyệt' });
              }
            });
            return;
          }
          sendResponse({ ok: true, status: 'disconnected' });
        }
      });
      return true;
    }

    sendResponse({ ok: false, status: 'unknown', reason: 'Thiếu quyền truy cập cookies' });
    return true;
  }

  if (message.action === 'autoLoginVnpost') {
    sendResponse({ 
      ok: false,
      code: 'VNPOST_AUTO_LOGIN_UNSUPPORTED',
      error: 'autoLoginVnpost đã bị gỡ bỏ. Vui lòng đăng nhập trực tiếp trên donhang.vnpost.vn.' 
    });
    return false;
  }

  // ─── 8. GỌI AI QUA GATEWAY (thay thế direct Groq) ───
  // P0-02: Extension không bao giờ gọi Groq trực tiếp nữa.
  // Mọi AI request đi qua Supabase Edge Function ai-gateway.
  if (message.action === 'checkAiGatewayHealth') {
    const clientToken = message.token;
    const clientShopId = message.shopId;
    const clientShopKey = message.shopKey;
    const clientStaffName = message.staffName;

    _callAiGateway('health', '', clientToken, clientShopId, clientShopKey, clientStaffName)
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ ok: false, error: err.message }));

    return true;
  }

  if (message.action === 'runGroq') {
    const text = message.text;
    const localResult = message.localResult;
    const clientToken = message.token;
    const clientShopId = message.shopId;
    const clientShopKey = message.shopKey;
    const clientStaffName = message.staffName;
    const startMs = Date.now();

    (async () => {
      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const activeShop = (clientShopId && UUID_REGEX.test(String(clientShopId).trim()))
        ? String(clientShopId).trim()
        : ((typeof AuthSession !== 'undefined' && (await AuthSession.getActiveShop().catch(() => null))) || 'default');

      // 1. Kiểm tra Cache trước (Zero-network, < 1ms)
      const cached = await parseCache.get(text, activeShop).catch(() => null);
      if (cached) {
        sendResponse({
          ok: true,
          result: cached,
          correctAddress: cached.correctAddress || cached.address || '',
          source: 'cache',
          metrics: {
            totalMs: Date.now() - startMs,
            textLength: text ? text.length : 0,
            cacheHit: true
          }
        });
        return;
      }

      // 2. Nếu Cache Miss, đưa vào textAiQueue (Concurrency = 2)
      textAiQueue.add(async () => {
        const gwStart = Date.now();
        const result = await _callAiGateway('parse', text, clientToken, clientShopId, clientShopKey, clientStaffName);
        const gatewayMs = Date.now() - gwStart;
        if (!result.ok) throw new Error(result.error || 'AI Gateway lỗi');

        // Báo danh thiết bị hoạt động ngay khi tách đơn AI thành công
        if (typeof SupabaseCloud !== 'undefined' && typeof SupabaseCloud.syncDeviceRecord === 'function') {
          SupabaseCloud.syncDeviceRecord().catch(err => {
            console.warn('[DEVICE_REGISTRATION_FAILED]', err?.message || 'SYNC_FAILED');
          });
        }

        // Chuẩn hóa kết quả giống logic cũ
        const aiRes = result.result || {};
        const safeAiRes = {};
        
        let rawName = aiRes.name ? String(aiRes.name).trim() : '';
        let extraNote = aiRes.extraNote || aiRes.note || aiRes.ghiChu || '';
        if (typeof extraNote === 'string') extraNote = extraNote.trim();
        else extraNote = '';

        // Tách ghi chú phụ nằm trong ngoặc đơn ở cuối tên khách hàng
        const parenMatch = rawName.match(/(.+?)\s*\(([^)]+)\)\s*$/);
        if (parenMatch) {
          rawName = parenMatch[1].trim();
          const noteInside = parenMatch[2].trim();
          extraNote = extraNote ? `${noteInside} | ${extraNote}` : noteInside;
        }

        safeAiRes.name = rawName;
        safeAiRes.extraNote = extraNote;

        const phoneClean = aiRes.phone ? String(aiRes.phone).replace(/\D/g, '') : '';
        const isValidPhone = phoneClean.length === 10 || phoneClean.length === 11;
        safeAiRes.phone = isValidPhone ? phoneClean : (aiRes.phone ? String(aiRes.phone).trim() : '');

        safeAiRes.orderCode = aiRes.orderCode ? String(aiRes.orderCode).trim() : '';

        // Parse COD robustly (xử lý dạng triệu: 4tr1, 1tr8, 4.1tr, k, đ, chuyển khoản, v.v.)
        let codVal = 0;
        if (aiRes.codAmount !== undefined && aiRes.codAmount !== null) {
          if (typeof aiRes.codAmount === 'number') {
            codVal = Number.isFinite(aiRes.codAmount) ? aiRes.codAmount : 0;
          } else {
            let str = String(aiRes.codAmount).trim().toLowerCase();
            if (str.includes('ck') || str.includes('chuyển khoản') || str.includes('thanh toán') || str.includes('free') || str === '0') {
              codVal = 0;
            } else {
              let normalized = str.replace(/\s+/g, '').replace(/,/g, '.');
              if (normalized.includes('tr') || normalized.includes('triệu') || normalized.includes('trieu')) {
                const cleanText = normalized.replace(/(?:triệu|trieu)/g, 'tr');
                const trIndex = cleanText.indexOf('tr');
                const afterTr = cleanText.substring(trIndex + 2).replace(/k|đ|d|vnd/g, '');
                const cleanNormalized = cleanText.substring(0, trIndex + 2) + afterTr;

                let parts = cleanNormalized.split('tr');
                const numBeforeTr = (parts[0].match(/[\d.]+$/) || [''])[0];
                let v = parseFloat(numBeforeTr) || 0;
                if (parts[1]) {
                  const suffix = parts[1].replace(/\D/g, '');
                  if (suffix.length >= 1 && suffix.length <= 3) {
                    v += parseFloat('0.' + suffix);
                  } else if (suffix.length >= 4) {
                    v += parseFloat(suffix) / 1000000;
                  }
                }
                codVal = Math.round(v * 1000000);
              } else if (normalized.includes('k') || normalized.includes('nghìn') || normalized.includes('ngan') || normalized.includes('ngàn')) {
                let raw = normalized.replace(/(?:k|nghìn|ngan|ngàn)/g, '');
                const numMatch = raw.match(/[\d.]+/);
                if (numMatch) {
                  raw = numMatch[0];
                  if (/^\d{1,3}(?:\.\d{3})+$/.test(raw)) {
                    codVal = Number(raw.replace(/\./g, '')) * 1000;
                  } else {
                    const dec = parseFloat(raw);
                    if (!isNaN(dec)) codVal = Math.round(dec * 1000);
                    else {
                      const digits = raw.replace(/\D/g, '');
                      codVal = digits ? parseInt(digits, 10) * 1000 : 0;
                    }
                  }
                }
              } else if (/^\d{1,3}(?:\.\d{3})+$/.test(normalized)) {
                codVal = parseInt(normalized.replace(/\./g, ''), 10) || 0;
              } else {
                const digits = normalized.replace(/\D/g, '');
                if (digits) {
                  const num = parseInt(digits, 10);
                  if (num > 0 && num < 1000) codVal = num * 1000;
                  else if (num >= 1000 && num < 10000 && !normalized.includes('.')) codVal = num * 1000;
                  else codVal = num;
                }
              }
            }
          }
        }
        safeAiRes.codAmount = codVal;

        const addr = aiRes.correctAddress || aiRes.address || '';
        safeAiRes.correctAddress = String(addr).trim();
        safeAiRes.address = String(addr).trim();

        // Lưu vào Cache cho các lần gọi sau
        await parseCache.set(text, activeShop, safeAiRes).catch(() => {});

        return {
          ok: true,
          result: safeAiRes,
          correctAddress: safeAiRes.correctAddress,
          source: 'ai_gateway',
          metrics: {
            gatewayMs,
            totalMs: Date.now() - startMs,
            textLength: text ? text.length : 0,
            cacheHit: false
          }
        };
      })
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    })();

    return true;
  }

  if (message.action === 'runGroqAddressOnly') {
    const addressText = message.addressText;
    const clientToken = message.token;
    const clientShopId = message.shopId;
    const startMs = Date.now();

    textAiQueue.add(async () => {
      const gwStart = Date.now();
      const result = await _callAiGateway('address', addressText, clientToken, clientShopId);
      const gatewayMs = Date.now() - gwStart;
      if (!result.ok) throw new Error(result.error || 'AI Gateway lỗi');
      return { 
        ok: true, 
        result: result.result || {},
        metrics: {
          gatewayMs,
          totalMs: Date.now() - startMs,
          textLength: addressText ? addressText.length : 0
        }
      };
    })
    .then(result => sendResponse(result))
    .catch(err => sendResponse({ ok: false, error: err.message }));

    return true;
  }

  // ─── 9. GOOGLE VISION OCR (visionAiQueue riêng, không nghẽn text parse) ───
  if (message.action === 'runVisionOcr') {
    const imageBase64 = message.imageBase64;
    const clientToken = message.token;
    const clientShopId = message.shopId;
    const clientShopKey = message.shopKey;
    const clientStaffName = message.staffName;
    const customApiKey = message.customApiKey;
    const startMs = Date.now();

    visionAiQueue.add(async () => {
      const gwStart = Date.now();
      const result = await _callAiGateway('vision_ocr', '', clientToken, clientShopId, clientShopKey, clientStaffName, {
        imageBase64,
        customApiKey
      });
      const ocrMs = Date.now() - gwStart;
      if (!result.ok) throw new Error(result.error || 'Google Vision OCR lỗi');
      return {
        ...result,
        metrics: {
          ocrMs,
          totalMs: Date.now() - startMs
        }
      };
    })
    .then(result => sendResponse(result))
    .catch(err => {
      console.warn('[AI Gateway SW] Vision OCR error:', err.message);
      const safeErr = toUserSafeError(err);
      sendResponse({ ok: false, code: safeErr.code, error: safeErr.message });
    });

    return true;
  }

  // ─── 10. GEMINI VISION MULTIMODAL (visionAiQueue riêng, không nghẽn text parse) ───
  if (message.action === 'runGeminiVision') {
    const imageBase64 = message.imageBase64;
    const rawOcrText = message.rawOcrText;
    const clientToken = message.token;
    const clientShopId = message.shopId;
    const clientShopKey = message.shopKey;
    const clientStaffName = message.staffName;
    const customApiKey = message.customApiKey;
    const startMs = Date.now();

    visionAiQueue.add(async () => {
      const gwStart = Date.now();
      const result = await _callAiGateway('gemini_vision', '', clientToken, clientShopId, clientShopKey, clientStaffName, {
        imageBase64,
        rawOcrText,
        customApiKey
      });
      const providerMs = Date.now() - gwStart;
      if (!result.ok) throw new Error(result.error || 'Gemini Vision lỗi');
      return {
        ...result,
        metrics: {
          providerMs,
          totalMs: Date.now() - startMs
        }
      };
    })
    .then(result => sendResponse(result))
    .catch(err => {
      console.warn('[AI Gateway SW] Gemini Vision error:', err.message);
      const safeErr = toUserSafeError(err);
      sendResponse({ ok: false, code: safeErr.code, error: safeErr.message });
    });

    return true;
  }
});

// ─── TỰ ĐỘNG LẤY MÃ VẬN ĐƠN J&T CHẠY NGẦM HOÀN TOÀN TRONG BACKGROUND ───
async function autoFetchJtWaybillInBackground(order) {
  if (!order) return;
  const orderId = order.savedOrderId || order.id;

  // Gửi API POST ngầm với credentials session J&T (không mở thêm tab mới)
  const endpoints = [
    'https://khachhang.jtexpress.vn/api/order/order/pageList',
    'https://khachhang.jtexpress.vn/api/v2/order/page',
    'https://khachhang.jtexpress.vn/api/order/pageList',
    'https://khachhang.jtexpress.vn/api/order/list'
  ];
  for (const ep of endpoints) {
    try {
      const resp = await fetch(ep, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: 1, pageSize: 5, pageNum: 1, size: 5 }),
        credentials: 'include'
      });
      if (resp.ok) {
        const body = await resp.json().catch(() => null);
        if (body) {
          const list = body.data?.list || body.data?.records || body.data || body.list || [];
          if (Array.isArray(list) && list.length > 0) {
            for (const item of list) {
              const code = item.billCode || item.waybillNo || item.trackingNo || item.txLogisticId || item.code || null;
              if (code && /^[A-Z0-9]{8,22}$/i.test(String(code))) {
                const waybill = String(code).trim();

                // Xác thực xem item này có thực sự khớp với đơn hàng cần tra cứu không
                const itemPhone = String(item.receiverPhone || item.receiverMobile || item.recipientPhone || item.recipientMobile || item.phone || item.mobile || '').replace(/\D/g, '');
                const targetPhone = String(order.phone || '').replace(/\D/g, '');
                
                const itemOrderCode = String(item.txLogisticId || item.shopOrderCode || item.customerOrderCode || item.orderCode || item.orderNo || '').trim().toLowerCase();
                const targetOrderCode = String(order.orderCode || order.order_code || '').trim().toLowerCase();

                const itemName = String(item.receiverName || item.recipientName || item.name || '').replace(/[\s\-\.,]/g, '').toLowerCase();
                const targetName = String(order.name || '').replace(/[\s\-\.,]/g, '').toLowerCase();

                const phoneMatched = targetPhone && itemPhone && (itemPhone.includes(targetPhone) || targetPhone.includes(itemPhone));
                const codeMatched = targetOrderCode && itemOrderCode && (itemOrderCode === targetOrderCode || itemOrderCode.includes(targetOrderCode) || targetOrderCode.includes(itemOrderCode));
                const nameMatched = targetName && targetName.length > 2 && itemName && (itemName.includes(targetName) || targetName.includes(itemName));

                // Khi có mã đơn, chỉ mã đơn mới đủ quyền gắn vận đơn. SĐT/tên là dữ liệu khách hàng,
                // không phải định danh đơn và sẽ trùng ở lần mua tiếp theo.
                const confidentMatch = targetOrderCode ? codeMatched : (phoneMatched && nameMatched);
                if (confidentMatch) {
                  if (typeof SupabaseCloud !== 'undefined') {
                    await SupabaseCloud.pushSubmittedOrder({ ...order, id: orderId, trackingCode: waybill, tracking_code: waybill, waybill_code: waybill }).catch(() => {});
                  }
                  return waybill;
                }
              }
            }
          }
        }
      }
    } catch (_) {}
  }
}

// ─── TỰ ĐỘNG LẤY MÃ VẬN ĐƠN VNPOST CHẠY NGẦM HOÀN TOÀN TRONG BACKGROUND ───
async function autoFetchVnpostWaybillInBackground(order) {
  if (!order) return;
  const orderId = order.savedOrderId || order.id;

  // Gửi API POST/GET ngầm với session VNPost (không mở thêm tab mới)
  const endpoints = [
    'https://my.vnpost.vn/api/order/get-list-order',
    'https://my.vnpost.vn/api/shipments',
    'https://my.vnpost.vn/api/v1/orders'
  ];
  for (const ep of endpoints) {
    try {
      const resp = await fetch(ep, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageIndex: 1, pageSize: 5 }),
        credentials: 'include'
      });
      if (resp.ok) {
        const body = await resp.json().catch(() => null);
        if (body) {
          const list = body.data?.items || body.data?.list || body.data || body.items || [];
          if (Array.isArray(list) && list.length > 0) {
            for (const item of list) {
              const code = item.itemCode || item.code || item.trackingCode || item.maVanDon || item.shipmentNumber || null;
              if (code && /^[A-Z0-9]{8,22}$/i.test(String(code))) {
                const waybill = String(code).trim();

                // Xác thực xem item này có thực sự khớp với đơn hàng cần tra cứu không
                const itemPhone = String(item.receiverPhone || item.receiverMobile || item.phone || item.mobile || '').replace(/\D/g, '');
                const targetPhone = String(order.phone || '').replace(/\D/g, '');
                
                const itemOrderCode = String(item.customerOrderCode || item.orderCode || item.code || item.maDonHang || '').trim().toLowerCase();
                const targetOrderCode = String(order.orderCode || order.order_code || '').trim().toLowerCase();

                const itemName = String(item.receiverName || item.name || '').replace(/[\s\-\.,]/g, '').toLowerCase();
                const targetName = String(order.name || '').replace(/[\s\-\.,]/g, '').toLowerCase();

                const phoneMatched = targetPhone && itemPhone && (itemPhone.includes(targetPhone) || targetPhone.includes(itemPhone));
                const codeMatched = targetOrderCode && itemOrderCode && (itemOrderCode === targetOrderCode || itemOrderCode.includes(targetOrderCode) || targetOrderCode.includes(itemOrderCode));
                const nameMatched = targetName && targetName.length > 2 && itemName && (itemName.includes(targetName) || targetName.includes(itemName));

                const confidentMatch = targetOrderCode ? codeMatched : (phoneMatched && nameMatched);
                if (confidentMatch) {
                  if (typeof SupabaseCloud !== 'undefined') {
                    await SupabaseCloud.pushSubmittedOrder({ ...order, id: orderId, trackingCode: waybill, tracking_code: waybill, waybill_code: waybill }).catch(() => {});
                  }
                  return waybill;
                }
              }
            }
          }
        }
      }
    } catch (_) {}
  }
}

// DO NOT SYNC API KEY TO CLIENT (Phase 1.4) - WIPE OLD KEY
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.remove(['apiKey'], () => {
    console.log('[Security] Wiped old provider API key from local storage.');
  });
});
chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.remove(['apiKey']);
  flushPendingOrdersQueue();
});

// Periodic background flusher for offline orders queue
async function flushPendingOrdersQueue() {
  try {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;
    const data = await new Promise(res => chrome.storage.local.get(['pending_submitted_orders_queue'], res));
    const queue = data?.pending_submitted_orders_queue;
    if (Array.isArray(queue) && queue.length > 0 && typeof SupabaseCloud !== 'undefined') {
      const ok = await SupabaseCloud.pushSubmittedOrders(queue).catch(() => false);
      if (ok) {
        chrome.storage.local.set({ pending_submitted_orders_queue: [] });
      }
    }
  } catch (_) {}
}

if (typeof chrome !== 'undefined' && chrome.alarms) {
  try {
    chrome.alarms.create('flush_offline_orders_alarm', { periodInMinutes: 2 });
    chrome.alarms.onAlarm.addListener(alarm => {
      if (alarm.name === 'flush_offline_orders_alarm') {
        flushPendingOrdersQueue();
      }
    });
  } catch (_) {}
}
flushPendingOrdersQueue();

