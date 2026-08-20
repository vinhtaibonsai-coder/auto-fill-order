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
const OrderStorage = globalThis.OrderStorage;

const aiQueue = new PromiseQueue(2);

// =========================================================================
// AUTO-SYNC ĐỊNH KỲ TỪ SUPABASE (chrome.alarms — MV3 Safe)
// =========================================================================
const ALARM_SYNC   = 'ag_cloud_sync';     // Đồng bộ dữ liệu đơn hàng (5 phút)
const ALARM_CONFIG = 'ag_config_sync';    // Cập nhật cấu hình Shop từ cloud (15 phút)
const ALARM_PERM_REFRESH = 'ag_perm_refresh'; // Làm mới quyền từ shop_members (5 phút)

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

    const [cloudOrders, cloudSubmitted] = await Promise.all([
      SupabaseCloud.fetchOrders().catch(() => []),
      (typeof SupabaseCloud.fetchSubmittedOrders === 'function'
        ? SupabaseCloud.fetchSubmittedOrders()
        : Promise.resolve([])
      ).catch(() => [])
    ]);

    if (!cloudOrders.length && !cloudSubmitted.length) return;

    // Lấy shopId hiện tại
    const shopRes = await chrome.storage.local.get(['activeShopId']).catch(() => ({}));
    const shopId = shopRes.activeShopId || 'shop_default';
    const draftKey = `savedOrders_${shopId}`;
    const submittedKey = `submittedOrders_${shopId}`;

    const stored = await chrome.storage.local.get([draftKey, submittedKey, 'savedOrders', 'submittedOrders']).catch(() => ({}));

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
        await chrome.storage.local.set({ [submittedKey]: mergedSub, submittedOrders: mergedSub }).catch(() => {});
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
      await SupabaseCloud.syncDeviceRecord().catch(() => {});
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

// ── Đăng ký Alarm khi Service Worker khởi động ──────────────────────────
chrome.alarms.create(ALARM_SYNC, { periodInMinutes: 5 });
chrome.alarms.create(ALARM_CONFIG, { periodInMinutes: 15 });
chrome.alarms.create(ALARM_PERM_REFRESH, { periodInMinutes: 5 });
// ALARM_DEVICE_CHECK được đăng ký ở phần dưới cùng với enforceDeviceRevokedRule

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
async function _callAiGateway(task, text, clientToken = null, clientShopId = null) {
  try {
    // Lấy Supabase URL từ config
    await SupabaseCloud.loadConfig();
    const cfg = SupabaseCloud._getConfig();
    const supabaseUrl = (cfg.url || '').trim().replace(/\/$/, '');
    if (!supabaseUrl || supabaseUrl.includes('YOUR_SUPABASE')) {
      throw new Error('Supabase chưa được cấu hình. Mở Cài đặt để thiết lập.');
    }

    // Lấy access_token của user hiện tại
    let token = clientToken;
    try {
      if (!token && typeof AuthSession !== 'undefined' && AuthSession.getSession) {
        const session = await AuthSession.getSession();
        token = session && session.access_token ? session.access_token : null;
      }
    } catch (_) {}

    if (!token) {
      // Fallback: đọc từ chrome.storage.local
      token = await new Promise(resolve => {
        chrome.storage.local.get(['vnpost_session'], r => {
          resolve(r.vnpost_session && r.vnpost_session.access_token ? r.vnpost_session.access_token : null);
        });
      });
    }

    if (!token) {
      throw new Error('Chưa đăng nhập. Vui lòng đăng nhập để dùng AI.');
    }

    let shopId = clientShopId;
    try {
      if (!shopId && typeof AuthSession !== 'undefined' && AuthSession.getActiveShop) {
        shopId = await AuthSession.getActiveShop();
      }
    } catch (_) {}

    if (!shopId) {
      shopId = await new Promise(resolve => {
        chrome.storage.local.get(['vnpost_session'], r => {
          resolve(r.vnpost_session && r.vnpost_session.active_shop_id ? r.vnpost_session.active_shop_id : null);
        });
      });
    }

    const deviceId = await SupabaseCloud._getDeviceId().catch(() => '');
    const gatewayUrl = `${supabaseUrl}/functions/v1/ai-gateway`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 35000);

    let resp;
    try {
      resp = await fetch(gatewayUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ task, text, deviceId, shop_id: shopId }),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timer);
    }

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      
      // Bắt lỗi Auth từ Supabase Kong Gateway (Invalid JWT/Expired JWT)
      if (resp.status === 401 && errData.message && errData.message.toUpperCase().includes('JWT')) {
        errData.error = 'AI_AUTH_REQUIRED';
      }

      const code = errData.error || 'AI_UPSTREAM_ERROR';
      const msg = errData.message || `Gateway lỗi HTTP ${resp.status}`;

      // Map mã lỗi sang tiếng Việt (Kèm thông điệp thực tế từ Groq nếu có)
      const VI_ERRORS = {
        'AI_AUTH_REQUIRED': 'Phiên đăng nhập hết hạn. Vui lòng đăng xuất và đăng nhập lại.',
        'AI_SHOP_REQUIRED': 'Tài khoản chưa được gán vào shop.',
        'AI_FEATURE_DISABLED': 'Tính năng AI đang bị tắt cho shop này.',
        'AI_RATE_LIMITED': 'Quá nhiều yêu cầu AI. Vui lòng thử lại sau.',
        'AI_QUOTA_EXCEEDED': 'Shop đã hết hạn mức AI tháng này.',
        'AI_KEY_UNAVAILABLE': 'AI chưa được cấu hình trên server (GROQ_API_KEY).',
        'AI_PROVIDER_UNAVAILABLE': `Dịch vụ AI tạm thời không khả dụng: ${msg}`,
        'AI_UPSTREAM_ERROR': `Lỗi từ nhà cung cấp AI: ${msg}`
      };
      throw new Error(VI_ERRORS[code] || msg);
    }

    const responseData = await resp.json();
    return { 
      ok: true, 
      result: responseData.data || responseData.result || null, 
      quota: responseData.quota 
    };
  } catch (e) {
    if (e.name === 'AbortError') {
      return { ok: false, error: 'AI Gateway timeout (35s). Vui lòng thử lại.' };
    }
    return { ok: false, error: e.message || 'Lỗi không xác định từ AI Gateway.' };
  }
}

// Tự động đăng ký thiết bị với Supabase Cloud ngầm khi Service Worker khởi chạy
setTimeout(() => {
  if (typeof SupabaseCloud !== 'undefined' && typeof SupabaseCloud.registerDevice === 'function') {
    SupabaseCloud.registerDevice().catch(() => {});
    if (typeof SupabaseCloud.syncDeviceRecord === 'function') {
      SupabaseCloud.syncDeviceRecord().catch(() => {});
    }
  }
}, 2000);

// ─── KIỂM TRA THIẾT BỊ BỊ THU HỒI (REVOKED) → TỰ ĐĂNG XUẤT ─────────
async function enforceDeviceRevokedRule() {
  try {
    if (typeof SupabaseCloud !== 'undefined' && typeof SupabaseCloud.checkDeviceRevoked === 'function') {
      const res = await SupabaseCloud.checkDeviceRevoked();
      if (res && res.ok === true && res.revoked === true) {
        // Xoá mọi token phiên đăng nhập
        await chrome.storage.session.remove(['fbAuthTokens', 'fbDeviceId', 'fbDeviceName']).catch(() => {});
        await chrome.storage.local.remove(['vnpost_session']).catch(() => {});
        chrome.runtime.sendMessage({ action: 'deviceRevoked' }).catch(() => {});
        chrome.tabs.query({}, (tabs) => {
          (tabs || []).forEach(t => {
            if (t.url && t.url.startsWith('http')) {
              chrome.tabs.sendMessage(t.id, { type: 'deviceRevoked' }).catch(() => {});
            }
          });
        });
      }
    }
  } catch (_e) { /* bỏ qua lỗi mạng / chưa có Supabase */ }
}

// ─── ALARM NAMES ─────────────────────────────────────────────────────────────
const ALARM_DEVICE_CHECK = 'ag_device_check'; // Kiểm tra thiết bị bị thu hồi (15 phút)

// Đăng ký alarm định kỳ kiểm tra thiết bị
chrome.alarms.create(ALARM_DEVICE_CHECK, { periodInMinutes: 15 });

// Kiểm tra ngay khi SW wake
enforceDeviceRevokedRule();


// ─── HELPER: Tái sử dụng tab options đang mở thay vì tạo mới ────────────────
const OPTIONS_PAGE_URL = chrome.runtime.getURL('frontend/options/options.html');

async function _focusOrCreateOptionsTab(sendResponse) {
  try {
    const tabs = await chrome.tabs.query({});
    const existing = tabs.find(t => t.url && t.url.startsWith(OPTIONS_PAGE_URL));
    if (existing) {
      // Tab đã mở → chỉ focus, KHÔNG reload (giữ nguyên dữ liệu đã load)
      await chrome.tabs.update(existing.id, { active: true });
      if (existing.windowId) {
        await chrome.windows.update(existing.windowId, { focused: true });
      }
      if (sendResponse) sendResponse({ ok: true, reused: true });
    } else {
      // Chưa mở → tạo mới
      if (typeof chrome.runtime.openOptionsPage === 'function') {
        chrome.runtime.openOptionsPage(() => {
          if (sendResponse) sendResponse({ ok: true, reused: false });
        });
      } else {
        chrome.tabs.create({ url: OPTIONS_PAGE_URL }, () => {
          if (sendResponse) sendResponse({ ok: true, reused: false });
        });
      }
    }
  } catch (e) {
    // Fallback an toàn
    if (typeof chrome.runtime.openOptionsPage === 'function') {
      chrome.runtime.openOptionsPage(() => {
        if (sendResponse) sendResponse({ ok: true, reused: false });
      });
    } else {
      chrome.tabs.create({ url: OPTIONS_PAGE_URL }, () => {
        if (sendResponse) sendResponse({ ok: true, reused: false });
      });
    }
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  if (!message) return false;

  // ─── 0. XỬ LÝ MỞ DASHBOARD ───
  if (message.action === 'openDashboard') {
    _focusOrCreateOptionsTab(sendResponse);
    return true;
  }

  // ─── 1. XỬ LÝ MỞ TRANG CÀI ĐẶT ───
  if (message.action === 'openOptions') {
    _focusOrCreateOptionsTab(sendResponse);
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
          await SupabaseCloud.registerDevice().catch(() => {});
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
    if (typeof AuthService !== 'undefined' && typeof AuthService.logout === 'function') {
      AuthService.logout().then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: true }));
    } else {
      chrome.storage.local.remove(['vnpost_session']).catch(() => {});
      sendResponse({ ok: true });
    }
    return true;
  }

  // ─── 3b. THIẾT BỊ BỊ THU HỒI → XÓA SESSION TẠI CÁC TAB ───
  if (message.action === 'deviceRevoked' || message.type === 'deviceRevoked') {
    chrome.storage.session.remove(['fbAuthTokens', 'fbDeviceId', 'fbDeviceName']).catch(() => {});
    chrome.storage.local.remove(['vnpost_session']).catch(() => {});
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

  if (message.action === 'deleteDevice') {
    SupabaseCloud.deleteDevice(message.deviceId)
      .then(res => sendResponse(res))
      .catch(err => sendResponse({ ok: false, error: err.message }));
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
      fetchFn()
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
    if (waybillCode) {
      SupabaseCloud.pushSubmittedOrder({ id: orderId, tracking_code: waybillCode, waybill_code: waybillCode, trackingCode: waybillCode }).catch(() => {});
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
    SupabaseCloud.fetchSubmittedOrders()
      .then(orders => sendResponse(orders))
      .catch(err => sendResponse({ error: err.message }));
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

  // ─── TỰ ĐỘNG ĐĂNG NHẬP CARRIER (AUTO LOGIN) ───
  if (message.action === 'autoLoginVnpost') {
    const { username, password } = message;
    
    // Giả lập quá trình gọi API đăng nhập của VNPost ngầm
    setTimeout(() => {
      // Khi có kết quả trả về, dùng chrome.cookies để set session vào trình duyệt
      if (chrome.cookies) {
        chrome.cookies.set({
          url: 'https://donhang.vnpost.vn',
          name: 'VNPOST_SESSION',
          value: 'MOCK_TOKEN_12345',
          domain: '.vnpost.vn',
          path: '/',
          secure: true,
          httpOnly: true
        });
      }
      sendResponse({ ok: true });
    }, 1500);

    return true; // Giữ kết nối async
  }

  // ─── 8. GỌI AI QUA GATEWAY (thay thế direct Groq) ───
  // P0-02: Extension không bao giờ gọi Groq trực tiếp nữa.
  // Mọi AI request đi qua Supabase Edge Function ai-gateway.
  if (message.action === 'runGroq') {
    const text = message.text;
    const localResult = message.localResult;
    const clientToken = message.token;
    const clientShopId = message.shopId;

    aiQueue.add(async () => {
      const result = await _callAiGateway('parse', text, clientToken, clientShopId);
      if (!result.ok) throw new Error(result.error || 'AI Gateway lỗi');

      // Chuẩn hóa kết quả giống logic cũ
      const aiRes = result.result || {};
      const safeAiRes = {};
      
      let rawName = aiRes.name ? String(aiRes.name).trim() : '';
      let extraNote = aiRes.extraNote || aiRes.note || aiRes.ghiChu || '';
      if (typeof extraNote === 'string') extraNote = extraNote.trim();
      else extraNote = '';

      // Tách ghi chú phụ nằm trong ngoặc đơn ở cuối tên khách hàng (ví dụ: "Chính là anh ( Nhựt Lũa)")
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

      // Parse COD robustly (xử lý dấu chấm, dấu phẩy, chữ "k", "đ", hoặc chuyển khoản)
      let codVal = 0;
      if (aiRes.codAmount !== undefined && aiRes.codAmount !== null) {
        if (typeof aiRes.codAmount === 'number') {
          codVal = aiRes.codAmount;
        } else {
          let str = String(aiRes.codAmount).trim().toLowerCase();
          if (str.includes('ck') || str.includes('chuyển khoản') || str.includes('thanh toán') || str.includes('free') || str === '0') {
            codVal = 0;
          } else {
            // Loại bỏ dấu phân cách phần nghìn (ví dụ: "1.700k" -> "1700k", "1,700k" -> "1700k", "1.700.000" -> "1700000")
            str = str.replace(/[\.,](\d{3})(?=\D|$)/g, '$1');

            if (str.endsWith('k')) {
              const num = parseFloat(str.replace('k', '')) * 1000;
              codVal = Number.isFinite(num) ? Math.round(num) : 0;
            } else {
              str = str.replace(/[^\d]/g, '');
              const parsed = parseInt(str, 10);
              codVal = Number.isFinite(parsed) ? parsed : 0;
            }
          }
        }
      }
      safeAiRes.codAmount = codVal;

      const addr = aiRes.correctAddress || aiRes.address || '';
      safeAiRes.correctAddress = String(addr).trim();
      safeAiRes.address = String(addr).trim();

      return {
        ok: true,
        result: safeAiRes,
        correctAddress: safeAiRes.correctAddress
      };
    })
    .then(result => sendResponse(result))
    .catch(err => sendResponse({ ok: false, error: err.message }));

    return true;
  }

  if (message.action === 'runGroqAddressOnly') {
    const addressText = message.addressText;
    const clientToken = message.token;
    const clientShopId = message.shopId;
    aiQueue.add(async () => {
      const result = await _callAiGateway('address', addressText, clientToken, clientShopId);
      if (!result.ok) throw new Error(result.error || 'AI Gateway lỗi');
      return { ok: true, result: result.result || {} };
    })
    .then(result => sendResponse(result))
    .catch(err => sendResponse({ ok: false, error: err.message }));

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

                if (phoneMatched || codeMatched || nameMatched) {
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

                if (phoneMatched || codeMatched || nameMatched) {
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
});
