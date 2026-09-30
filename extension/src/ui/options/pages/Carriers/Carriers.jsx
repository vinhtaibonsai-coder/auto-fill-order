import React, { useState, useEffect } from 'react';
import { Truck, CheckCircle2, AlertTriangle, ShieldCheck, Key, Lock, Unlock, RotateCcw, ShieldAlert, User, RefreshCw, Unlink, Copy, Check, ExternalLink, Globe, Send, Play, HelpCircle, ArrowRight, X, Sparkles, Package, Activity, History, Calendar, MapPin, Search } from 'lucide-react';
import { AuthSession } from '../../../../domain/auth/auth.session.esm.js';
import {
  vnpostGetAccessToken,
  vnpostGetListOrder,
  vnpostGetOrder,
  VNPOST_ENVIRONMENTS
} from '../../../../application/carriers/vnpost-api.service.js';
import {
  normalizeVNPostStatus,
  formatToVNPostDate,
  syncVNPostOrdersToDatabase
} from '../../../../application/carriers/vnpost-sync.engine.js';
import {
  normalizeVNPostWebOrder
} from '../../../../application/carriers/vnpost-web-session.service.js';
import {
  detectOrderCarrier,
  getCarrierMeta,
  getCarrierTrackingUrl,
  CARRIER_METAS
} from '../../../../application/carriers/carrier-detection.js';

const getDeliveryStatusMeta = (status) => {
  const s = String(status || 'submitted').toLowerCase();
  switch (s) {
    case 'delivered':
    case '90':
      return { label: 'Đã phát thành công', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' };
    case 'delivering':
    case '70':
    case '80':
      return { label: 'Đang giao hàng', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' };
    case 'returned':
    case '100':
      return { label: 'Chuyển hoàn', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' };
    case 'processing':
    case '50':
      return { label: 'Đang gom / Xử lý', color: '#d97706', bg: '#fffbeb', border: '#fde68a' };
    default:
      return { label: 'Chờ lấy hàng', color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' };
  }
};

const formatDate = (iso) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch (_) {
    return String(iso);
  }
};

const CARRIERS_METADATA = {
  vnpost: {
    id: 'vnpost',
    name: 'Vietnam Post (VNPost)',
    badgeColor: '#eab308',
    portalUrl: 'https://my.vnpost.vn',
    desc: 'Hỗ trợ tự động điền đơn, chọn dịch vụ TMĐT, quản lý mã vận đơn bưu điện.'
  },
  jt: {
    id: 'jt',
    name: 'J&T Express',
    badgeColor: '#ef4444',
    portalUrl: 'https://khachhang.jtexpress.vn',
    desc: 'Hỗ trợ tự động điền đơn VIP J&T Express, đồng bộ cước và cập nhật mã vận đơn.'
  },
  viettel: {
    id: 'viettel',
    name: 'Viettel Post',
    badgeColor: '#ea580c',
    portalUrl: 'https://viettelpost.vn',
    desc: 'Hỗ trợ tự động điền đơn Viettel Post, đối soát tiền thu hộ COD và tra cứu hành trình.'
  },
  ghtk: {
    id: 'ghtk',
    name: 'Giao Hàng Tiết Kiệm (GHTK)',
    badgeColor: '#16a34a',
    portalUrl: 'https://khachhang.ghtk.vn',
    desc: 'Hỗ trợ tự động điền đơn GHTK, phân loại hàng hóa và tra cứu hành trình nhanh.'
  }
};

export default function Carriers() {
  const [carriers, setCarriers] = useState([
    { id: 'vnpost', name: 'VNPost', connected: false, account: '' },
    { id: 'jt', name: 'J&T Express', connected: false, account: '' },
    { id: 'viettel', name: 'Viettel Post', connected: false, account: '' },
    { id: 'ghtk', name: 'GHTK', connected: false, account: '' }
  ]);
  const [carrierForms, setCarrierForms] = useState({
    vnpost: { username: '', password: '' },
    jt: { username: '', password: '' },
    viettel: { username: '', password: '' },
    ghtk: { username: '', password: '' }
  });
  const [isConnecting, setIsConnecting] = useState({ vnpost: false, jt: false, viettel: false, ghtk: false });
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState({ type: '', text: '' });

  // Webhook State
  const [supabaseBaseUrl, setSupabaseBaseUrl] = useState('');
  const [webhookConfig, setWebhookConfig] = useState({
    customerCode: '',
    apiToken: ''
  });
  const [isSavingWebhook, setIsSavingWebhook] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [lastWebhookReceivedAt, setLastWebhookReceivedAt] = useState(null);
  const [currentShopId, setCurrentShopId] = useState('');
  const [currentShopName, setCurrentShopName] = useState('');

  // Token Safety & Protection States
  const [isTokenLocked, setIsTokenLocked] = useState(true);
  const [originalToken, setOriginalToken] = useState('');
  const [showConfirmTokenModal, setShowConfirmTokenModal] = useState(false);
  const [showPostSaveReminderModal, setShowPostSaveReminderModal] = useState(false);

  // Webhook Synchronized Orders Table State
  const [webhookOrders, setWebhookOrders] = useState([]);
  const [loadingWebhookOrders, setLoadingWebhookOrders] = useState(false);
  const [selectedJourneyLog, setSelectedJourneyLog] = useState(null);
  const [webhookSearchQuery, setWebhookSearchQuery] = useState('');
  const [carrierFilter, setCarrierFilter] = useState('all'); // 'all' | 'vnpost' | 'jt'

  // VNPost Connect API (Method 1) States
  const [connectApiConfig, setConnectApiConfig] = useState({
    username: '',
    password: '',
    customerCode: '',
    env: 'PRODUCTION',
    customUrl: ''
  });
  const [connectApiToken, setConnectApiToken] = useState('');
  const [isTestingConnectApi, setIsTestingConnectApi] = useState(false);
  const [connectApiStatus, setConnectApiStatus] = useState({ connected: false, message: '' });

  // Batch Sync Date Range States
  const [syncDateFrom, setSyncDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [syncDateTo, setSyncDateTo] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [isSyncingOldOrders, setIsSyncingOldOrders] = useState(false);
  const [syncResultStats, setSyncResultStats] = useState(null);

  // Web Session Sync States (MyVNPost Web Tab)
  const [webSessionStatus, setWebSessionStatus] = useState({
    checking: false,
    hasTab: false,
    hasSession: false,
    tabId: null,
    userPhone: '',
    userName: '',
    lastChecked: null
  });
  const [isSyncingViaWebSession, setIsSyncingViaWebSession] = useState(false);

  // Single Quick Lookup State
  const [quickLookupCode, setQuickLookupCode] = useState('');
  const [isLookingUpSingle, setIsLookingUpSingle] = useState(false);
  const [singleLookupResult, setSingleLookupResult] = useState(null);

  // Test Simulator State
  const [showTestModal, setShowTestModal] = useState(false);
  const [testForm, setTestForm] = useState({
    orderCode: '',
    itemCode: '',
    statusCode: '90',
    statusName: 'Phát thành công',
    totalFee: 25000,
    weight: 250
  });
  const [recentSubmittedOrders, setRecentSubmittedOrders] = useState([]);
  const [testingPing, setTestingPing] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const showToast = (text, type = 'success') => {
    setStatus({ type, text });
    setTimeout(() => setStatus({ type: '', text: '' }), 4500);
  };

  useEffect(() => {
    loadCarriers();
    checkVNPostWebSession();
  }, []);

  const getClient = async () => {
    const configRes = (typeof globalThis.SupabaseCloud !== 'undefined' && globalThis.SupabaseCloud.loadConfig)
      ? await globalThis.SupabaseCloud.loadConfig()
      : { url: 'https://xlgovgynbsahuykyjzcx.supabase.co', anonKey: '' };

    let sess = null;
    try {
      sess = typeof AuthSession !== 'undefined' ? await AuthSession.getSession() : null;
    } catch (_) {}

    let activeShop = null;
    try {
      const storage = globalThis.OrderStorage || (typeof OrderStorage !== 'undefined' ? OrderStorage : null);
      if (storage && typeof storage.getActiveShop === 'function') {
        activeShop = await storage.getActiveShop();
      }
    } catch (_) {}

    let targetShopId = String(
      activeShop?.id ||
      activeShop ||
      sess?.active_shop_id?.id ||
      sess?.active_shop_id ||
      ''
    ).trim();

    if (!targetShopId && typeof chrome !== 'undefined' && chrome.storage?.local) {
      targetShopId = await new Promise(resolve => {
        chrome.storage.local.get(['active_shop_id', 'vnpost_session', 'current_shop_id', 'active_shop'], r => {
          const s = r?.active_shop_id || r?.vnpost_session?.active_shop_id || r?.current_shop_id || r?.active_shop || '';
          resolve(String(typeof s === 'object' ? s?.id : s || '').trim());
        });
      });
    }

    if (!targetShopId && sess?.user?.id && configRes?.url) {
      try {
        const memRes = await fetch(`${configRes.url.replace(/\/$/, '')}/rest/v1/shop_members?user_id=eq.${sess.user.id}&select=shop_id&limit=1`, {
          headers: {
            'apikey': configRes.anonKey,
            ...(sess?.access_token ? { 'Authorization': `Bearer ${sess.access_token}` } : {})
          }
        });
        if (memRes.ok) {
          const memRows = await memRes.json().catch(() => []);
          if (memRows?.[0]?.shop_id) {
            targetShopId = String(memRows[0].shop_id).trim();
          }
        }
      } catch (_) {}
    }

    let shopName = activeShop?.name || sess?.active_shop_name || '';
    if (!shopName && typeof chrome !== 'undefined' && chrome.storage?.local) {
      shopName = await new Promise(resolve => {
        chrome.storage.local.get(['active_shop_name', 'vnpost_session'], r => {
          resolve(r?.active_shop_name || r?.vnpost_session?.active_shop_name || '');
        });
      });
    }

    return { configRes, sess, targetShopId, shopName };
  };

  const loadWebhookOrders = async (sId, cfg) => {
    setLoadingWebhookOrders(true);
    try {
      const client = await getClient();
      const targetId = sId || client.targetShopId;
      const config = cfg || client.configRes;
      if (!targetId) return;

      let fetchedOrders = null;

      // 1. Thử gọi qua Edge Function vnpost-webhook
      if (config?.url && config?.anonKey) {
        try {
          const res = await fetch(`${config.url.replace(/\/$/, '')}/functions/v1/vnpost-webhook`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': config.anonKey,
              ...(client.sess?.access_token ? { 'Authorization': `Bearer ${client.sess.access_token}` } : {})
            },
            body: JSON.stringify({ action: 'get_logs', shopId: targetId })
          });
          if (res.ok) {
            const json = await res.json().catch(() => ({}));
            if (json.success && Array.isArray(json.orders)) {
              fetchedOrders = json.orders;
            }
          }
        } catch (_) {}
      }

      // 2. Dự phòng: Truy vấn trực tiếp từ bảng submitted_orders của Supabase
      if (!fetchedOrders && typeof globalThis.SupabaseCloud !== 'undefined' && globalThis.SupabaseCloud.getClient) {
        try {
          const sb = globalThis.SupabaseCloud.getClient();
          if (sb) {
            const { data: directOrders } = await sb
              .from('submitted_orders')
              .select('id, order_code, tracking_code, customer_name, name, phone, status, shipping_fee, actual_weight, webhook_logs, updated_at, submitted_at, address, platform')
              .eq('shop_id', targetId)
              .order('updated_at', { ascending: false })
              .limit(100);
            if (Array.isArray(directOrders)) {
              fetchedOrders = directOrders;
            }
          }
        } catch (_) {}
      }

      if (Array.isArray(fetchedOrders)) {
        setWebhookOrders(fetchedOrders);
      }
    } catch (e) {
      console.warn('Lỗi tải danh sách logs webhook:', e);
    } finally {
      setLoadingWebhookOrders(false);
    }
  };

  const loadCarriers = async () => {
    try {
      const { configRes, sess, targetShopId, shopName } = await getClient();
      if (configRes?.url) {
        setSupabaseBaseUrl(configRes.url);
      }
      if (targetShopId) {
        setCurrentShopId(targetShopId);
      }
      if (shopName) {
        setCurrentShopName(shopName);
      }

      // 0. Đọc cấu hình từ local storage trước để tức thì hiển thị trên giao diện
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        const localKey = targetShopId ? `vnpost_webhook_config_${targetShopId}` : 'last_vnpost_webhook_config';
        chrome.storage.local.get([localKey, 'last_vnpost_webhook_config', 'vnpost_connect_api_config'], (r) => {
          const cfg = r?.[localKey] || r?.last_vnpost_webhook_config;
          if (cfg && (cfg.apiToken || cfg.customerCode)) {
            setWebhookConfig(prev => ({
              customerCode: prev.customerCode || cfg.customerCode || '',
              apiToken: prev.apiToken || cfg.apiToken || ''
            }));
            if (cfg.apiToken) {
              setOriginalToken(prev => prev || cfg.apiToken);
              setIsTokenLocked(true);
            }
          }
          if (r?.vnpost_connect_api_config) {
            setConnectApiConfig(prev => ({
              ...prev,
              ...r.vnpost_connect_api_config
            }));
            if (r.vnpost_connect_api_config.lastToken) {
              setConnectApiToken(r.vnpost_connect_api_config.lastToken);
              setConnectApiStatus({ connected: true, message: 'Đã lưu phiên kết nối gần nhất.' });
            }
          }
        });
      }

      // 1. Tải cấu hình Webhook từ Cloud: ƯU TIÊN SỐ 1 gọi Edge Function get_config (áp dụng đồng bộ cho TOÀN BỘ tài khoản thành viên trong shop)
      let configLoaded = false;
      let effectiveShopId = targetShopId;
      if (configRes?.url) {
        try {
          const edgeRes = await fetch(`${configRes.url.replace(/\/$/, '')}/functions/v1/vnpost-webhook`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': configRes.anonKey,
              ...(sess?.access_token ? { 'Authorization': `Bearer ${sess.access_token}` } : {})
            },
            body: JSON.stringify({ action: 'get_config', shopId: targetShopId || '' })
          });
          if (edgeRes.ok) {
            const edgeJson = await edgeRes.json().catch(() => ({}));
            if (edgeJson?.success) {
              if (edgeJson.shop_id) {
                effectiveShopId = edgeJson.shop_id;
                setCurrentShopId(edgeJson.shop_id);
              }
              if (edgeJson.shop_name) {
                setCurrentShopName(edgeJson.shop_name);
              }
              if (edgeJson?.data) {
                const cCode = edgeJson.data.vnpost_customer_code || '';
                const aToken = edgeJson.data.vnpost_api_token || '';
                if (cCode || aToken) {
                  configLoaded = true;
                  setWebhookConfig({
                    customerCode: cCode,
                    apiToken: aToken
                  });
                  if (aToken) {
                    setOriginalToken(aToken);
                    setIsTokenLocked(true);
                  }
                  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
                    const sId = edgeJson.shop_id || targetShopId;
                    chrome.storage.local.set({
                      [`vnpost_webhook_config_${sId}`]: { customerCode: cCode, apiToken: aToken },
                      last_vnpost_webhook_config: { customerCode: cCode, apiToken: aToken }
                    });
                  }
                }
              }
            }
          }
        } catch (e) {
          console.warn('Lỗi get_config qua Edge Function:', e);
        }
      }

      // Tự động tải danh sách các đơn hàng đã đồng bộ từ VNPost
      loadWebhookOrders(effectiveShopId || targetShopId, configRes);

      if (!targetShopId && !effectiveShopId) {
        setIsLoading(false);
        return;
      }

      const headers = {
        'apikey': configRes.anonKey,
        ...(sess?.access_token ? { 'Authorization': `Bearer ${sess.access_token}` } : {})
      };

      // 2. Tải carrier_configs
      if (sess?.access_token && (targetShopId || effectiveShopId)) {
        try {
          const targetShopParam = effectiveShopId || targetShopId;
          const carrierApiUrl = targetShopParam
            ? `${configRes.url.replace(/\/$/, '')}/rest/v1/carrier_configs?shop_id=eq.${targetShopParam}&select=carrier_id,is_connected,account_username`
            : `${configRes.url.replace(/\/$/, '')}/rest/v1/carrier_configs?shop_id=eq.${sess.active_shop_id}&select=carrier_id,is_connected,account_username`;
          const res = await fetch(carrierApiUrl, { headers });
          if (res.ok) {
            const rows = await res.json().catch(() => []);
            if (rows && rows.length > 0) {
              const byId = {};
              rows.forEach(r => { byId[r.carrier_id] = r; });
              setCarriers(prev => prev.map(c => {
                const db = byId[c.id];
                return db ? { ...c, connected: !!db.is_connected, account: db.account_username || '' } : c;
              }));
            }
          }
        } catch (_) {}
      }

      // 3. Fallback sang REST nếu Edge Function chưa load được
      if (!configLoaded && (targetShopId || effectiveShopId)) {
        try {
          const flagRes = await fetch(
            `${configRes.url.replace(/\/$/, '')}/rest/v1/shop_feature_flags?shop_id=eq.${effectiveShopId || targetShopId}&select=vnpost_customer_code,vnpost_api_token`,
            { headers }
          );
          if (flagRes.ok) {
            const flags = await flagRes.json().catch(() => []);
            if (flags && flags.length > 0 && (flags[0].vnpost_api_token || flags[0].vnpost_customer_code)) {
              setWebhookConfig({
                customerCode: flags[0].vnpost_customer_code || '',
                apiToken: flags[0].vnpost_api_token || ''
              });
            }
          }
        } catch (_) {}
      }

      // Tự động tải danh sách các đơn hàng đã đồng bộ từ VNPost
      loadWebhookOrders(targetShopId, configRes);
    } catch (err) {
      console.error('Lỗi tải cấu hình carrier:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const saveState = async (carrierId, connected, account) => {
    const { configRes, sess, targetShopId } = await getClient();
    if (!targetShopId || !sess?.access_token) {
      throw new Error('Phiên đăng nhập không hợp lệ.');
    }
    const baseHeaders = {
      'apikey': configRes.anonKey,
      'Authorization': `Bearer ${sess.access_token}`,
      'Content-Type': 'application/json'
    };
    const payload = {
      shop_id: targetShopId,
      carrier_id: carrierId,
      is_connected: connected,
      account_username: account || null
    };

    const patchRes = await fetch(
      `${configRes.url.replace(/\/$/, '')}/rest/v1/carrier_configs?shop_id=eq.${targetShopId}&carrier_id=eq.${carrierId}`,
      {
        method: 'PATCH',
        headers: { ...baseHeaders, 'Prefer': 'return=representation' },
        body: JSON.stringify(payload)
      }
    );
    if (patchRes.ok) {
      const rows = await patchRes.json().catch(() => []);
      if (rows && rows.length > 0) return;
    }

    const postRes = await fetch(`${configRes.url.replace(/\/$/, '')}/rest/v1/carrier_configs`, {
      method: 'POST',
      headers: { ...baseHeaders, 'Prefer': 'return=representation' },
      body: JSON.stringify(payload)
    });
    if (!postRes.ok) {
      const data = await postRes.json().catch(() => ({}));
      throw new Error(data.message || 'Không cập nhật được cấu hình carrier (cần quyền OWNER).');
    }
  };

  const handleInputChange = (carrierId, field, value) => {
    setCarrierForms(prev => ({
      ...prev,
      [carrierId]: {
        ...prev[carrierId],
        [field]: value
      }
    }));
  };

  const handleConnect = async (carrierId) => {
    const form = carrierForms[carrierId];
    setIsConnecting(prev => ({ ...prev, [carrierId]: true }));

    try {
      if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
        throw new Error('Chỉ có thể kiểm tra phiên hãng trong Extension.');
      }
      const res = await new Promise(resolve => {
        chrome.runtime.sendMessage({ action: 'checkCarrierSession', carrier: carrierId }, response => {
          const lastErr = chrome.runtime.lastError;
          resolve(lastErr ? { ok: false, status: 'unknown', error: lastErr.message } : response);
        });
      });
      if (!res?.ok || res.status !== 'connected') {
        await saveState(carrierId, false, '');
        setCarriers(prev => prev.map(c => c.id === carrierId ? { ...c, connected: false, account: '' } : c));
        throw new Error(res?.reason || res?.error || 'Chưa xác nhận được phiên đăng nhập thật trên website hãng.');
      }

      await saveState(carrierId, true, form.username || 'Phiên web');
      setCarriers(prev => prev.map(c => c.id === carrierId ? { ...c, connected: true, account: form.username || 'Phiên web' } : c));
      setCarrierForms(prev => ({
        ...prev,
        [carrierId]: { ...prev[carrierId], password: '' }
      }));
      showToast(`✅ Đã xác nhận phiên đăng nhập thật (${carrierId.toUpperCase()}).`);
    } catch (err) {
      showToast('❌ Lỗi liên kết: ' + err.message, 'error');
    } finally {
      setIsConnecting(prev => ({ ...prev, [carrierId]: false }));
    }
  };

  const handleDisconnect = async (carrierId) => {
    if (!confirm(`Bạn có chắc muốn ngắt kết nối tài khoản ${carrierId.toUpperCase()}?`)) return;
    try {
      await saveState(carrierId, false, '');
      setCarriers(prev => prev.map(c => c.id === carrierId ? { ...c, connected: false, account: '' } : c));
      showToast('✅ Đã ngắt kết nối hãng vận chuyển.');
    } catch (err) {
      showToast('❌ Lỗi: ' + err.message, 'error');
    }
  };

  const handleUnlockTokenClick = () => {
    if (originalToken || webhookConfig.apiToken) {
      setShowConfirmTokenModal(true);
    } else {
      setIsTokenLocked(false);
    }
  };

  const handleConfirmUnlock = () => {
    setIsTokenLocked(false);
    setShowConfirmTokenModal(false);
    showToast('🔓 Đã mở khóa chỉnh sửa Token bảo mật.', 'warning');
  };

  const handleRevertToken = () => {
    const target = originalToken || '';
    setWebhookConfig(prev => ({ ...prev, apiToken: target }));
    setIsTokenLocked(true);
    showToast('↩️ Đã khôi phục lại Token bảo mật ban đầu của Shop!');
  };

  const handleRelockToken = () => {
    if (originalToken && webhookConfig.apiToken !== originalToken) {
      setWebhookConfig(prev => ({ ...prev, apiToken: originalToken }));
      showToast('🔒 Đã hủy thay đổi chưa lưu và khóa bảo vệ Token.', 'info');
    }
    setIsTokenLocked(true);
  };

  const checkVNPostWebSession = async () => {
    setWebSessionStatus(prev => ({ ...prev, checking: true }));
    try {
      if (typeof chrome === 'undefined' || !chrome.tabs?.query) {
        setWebSessionStatus(prev => ({ ...prev, checking: false, error: 'Chỉ hoạt động trên trình duyệt có tiện ích' }));
        return;
      }

      const tabs = await new Promise(resolve => {
        chrome.tabs.query({ url: "*://my.vnpost.vn/*" }, resolve);
      });

      if (!tabs || tabs.length === 0) {
        setWebSessionStatus({
          checking: false,
          hasTab: false,
          hasSession: false,
          tabId: null,
          userPhone: '',
          userName: '',
          lastChecked: new Date()
        });
        return;
      }

      const activeTab = tabs[0];
      chrome.tabs.sendMessage(activeTab.id, { action: 'VNPOST_CHECK_WEB_SESSION' }, (response) => {
        const lastErr = chrome.runtime.lastError;
        if (lastErr || !response) {
          setWebSessionStatus({
            checking: false,
            hasTab: true,
            hasSession: false,
            tabId: activeTab.id,
            userPhone: '',
            userName: '',
            needsReload: Boolean(lastErr),
            lastChecked: new Date()
          });
        } else {
          setWebSessionStatus({
            checking: false,
            hasTab: true,
            hasSession: Boolean(response.hasSession),
            tabId: activeTab.id,
            userPhone: response.userPhone || '',
            userName: response.userName || '',
            needsReload: false,
            lastChecked: new Date()
          });
        }
      });
    } catch (err) {
      setWebSessionStatus(prev => ({ ...prev, checking: false, error: err.message }));
    }
  };

  const handleSyncViaWebSession = async () => {
    setIsSyncingViaWebSession(true);
    setSyncResultStats(null);
    try {
      if (typeof chrome === 'undefined' || !chrome.tabs?.query) {
        throw new Error('Môi trường trình duyệt không hỗ trợ truy vấn tab.');
      }

      const tabs = await new Promise(resolve => {
        chrome.tabs.query({ url: "*://my.vnpost.vn/*" }, resolve);
      });

      if (!tabs || tabs.length === 0) {
        throw new Error('Chưa tìm thấy tab my.vnpost.vn nào đang mở. Vui lòng bấm "Mở Tab MyVNPost" để đăng nhập.');
      }

      const targetTab = tabs[0];
      showToast('⏳ Đang kết nối tới tab MyVNPost và quét đơn hàng...', 'info');

      const res = await new Promise((resolve) => {
        chrome.tabs.sendMessage(targetTab.id, {
          action: 'VNPOST_FETCH_ORDERS_VIA_WEB',
          page: 0,
          size: 100,
          fromDate: syncDateFrom,
          toDate: syncDateTo
        }, (response) => {
          const lastErr = chrome.runtime.lastError;
          if (lastErr) {
            resolve({
              success: false,
              error: 'Không thể kết nối với tab MyVNPost (Tab được mở từ trước khi cập nhật tiện ích). Vui lòng chuyển sang tab my.vnpost.vn, bấm F5 để tải lại trang rồi quét lại!'
            });
            return;
          }
          resolve(response || { success: false, error: 'Không nhận được phản hồi từ tab MyVNPost.' });
        });
      });

      if (!res || !res.success) {
        throw new Error(res?.error || 'Không thể lấy danh sách đơn từ tab MyVNPost. Hãy đảm bảo bạn đã đăng nhập tài khoản.');
      }

      const rawOrders = res.orders || [];
      if (rawOrders.length === 0) {
        showToast('ℹ️ Không có đơn hàng nào phát sinh trong khoảng thời gian này trên MyVNPost.', 'info');
        setSyncResultStats({ total: 0, matched: 0, updated: 0, skipped: 0, unmatched: 0, details: [] });
        return;
      }

      const normalizedOrders = rawOrders.map(normalizeVNPostWebOrder);

      const { configRes, targetShopId } = await getClient();
      const effectiveShopId = targetShopId || currentShopId;

      const client = (typeof globalThis.SupabaseCloud !== 'undefined' && globalThis.SupabaseCloud.getClient)
        ? globalThis.SupabaseCloud.getClient()
        : null;

      if (!client || !effectiveShopId) {
        throw new Error('Chưa kết nối Cloud hoặc chưa xác định được Shop ID để lưu dữ liệu.');
      }

      const syncStats = await syncVNPostOrdersToDatabase({
        vnpostOrders: normalizedOrders,
        shopId: effectiveShopId,
        supabaseClient: client,
        autoInsertUnmatched: true
      });

      setSyncResultStats(syncStats);
      showToast(`🎉 Đồng bộ thành công ${syncStats.total} đơn: ${syncStats.updated} đơn cập nhật mới, ${syncStats.skipped} đơn giữ nguyên!`);

      await loadWebhookOrders(effectiveShopId, configRes);
    } catch (err) {
      showToast(`❌ Lỗi đồng bộ qua Web: ${err.message}`, 'error');
    } finally {
      setIsSyncingViaWebSession(false);
    }
  };

  const handleConnectApiTest = async () => {
    setIsTestingConnectApi(true);
    try {
      const code = connectApiConfig.customerCode || webhookConfig.customerCode;
      const res = await vnpostGetAccessToken({
        username: connectApiConfig.username,
        password: connectApiConfig.password,
        customerCode: code,
        env: connectApiConfig.env,
        customUrl: connectApiConfig.customUrl
      });

      if (res.success && res.token) {
        setConnectApiToken(res.token);
        setConnectApiStatus({
          connected: true,
          message: 'Kết nối API VNPost Connect thành công! Đã nhận Access Token.'
        });
        showToast('✅ Kết nối API VNPost Connect thành công!');

        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          chrome.storage.local.set({
            vnpost_connect_api_config: {
              ...connectApiConfig,
              customerCode: code,
              lastToken: res.token,
              savedAt: new Date().toISOString()
            }
          });
        }
      } else {
        setConnectApiStatus({
          connected: false,
          message: res.error || 'Không thể lấy token xác thực từ VNPost.'
        });
        showToast(`❌ ${res.error || 'Lỗi kết nối API'}`, 'error');
      }
    } catch (err) {
      setConnectApiStatus({
        connected: false,
        message: err.message
      });
      showToast(`❌ Lỗi: ${err.message}`, 'error');
    } finally {
      setIsTestingConnectApi(false);
    }
  };

  const handleSyncOldOrders = async () => {
    setIsSyncingOldOrders(true);
    setSyncResultStats(null);
    try {
      let token = connectApiToken;
      const code = connectApiConfig.customerCode || webhookConfig.customerCode;
      if (!token) {
        const tokenRes = await vnpostGetAccessToken({
          username: connectApiConfig.username,
          password: connectApiConfig.password,
          customerCode: code,
          env: connectApiConfig.env,
          customUrl: connectApiConfig.customUrl
        });
        if (!tokenRes.success || !tokenRes.token) {
          throw new Error(tokenRes.error || 'Vui lòng kiểm tra và bấm "Kiểm Tra Kết Nối" ở trên trước khi quét.');
        }
        token = tokenRes.token;
        setConnectApiToken(token);
      }

      const fromFormatted = formatToVNPostDate(new Date(syncDateFrom));
      const toFormatted = formatToVNPostDate(new Date(syncDateTo));

      showToast(`⏳ Đang quét danh sách đơn từ ${fromFormatted} đến ${toFormatted}...`, 'info');

      let allOrders = [];
      let page = 0;
      let hasMore = true;

      while (hasMore && page < 5) {
        const listRes = await vnpostGetListOrder({
          token,
          lastUpdateFrom: fromFormatted,
          lastUpdateTo: toFormatted,
          page,
          size: 200,
          type: 'GUI',
          env: connectApiConfig.env,
          customUrl: connectApiConfig.customUrl
        });

        if (!listRes.success) {
          if (listRes.isExpired) {
            const refreshRes = await vnpostGetAccessToken({
              username: connectApiConfig.username,
              password: connectApiConfig.password,
              customerCode: code,
              env: connectApiConfig.env,
              customUrl: connectApiConfig.customUrl
            });
            if (refreshRes.success && refreshRes.token) {
              token = refreshRes.token;
              setConnectApiToken(token);
              continue;
            }
          }
          throw new Error(listRes.error || 'Lỗi khi tải danh sách đơn từ VNPost.');
        }

        const pageOrders = listRes.orders || [];
        allOrders = allOrders.concat(pageOrders);

        if (pageOrders.length < 200) {
          hasMore = false;
        } else {
          page++;
        }
      }

      if (allOrders.length === 0) {
        showToast('ℹ️ Không có đơn hàng nào phát sinh trong khoảng thời gian này trên VNPost.', 'info');
        setSyncResultStats({ total: 0, matched: 0, updated: 0, skipped: 0, unmatched: 0, details: [] });
        return;
      }

      const { configRes, targetShopId } = await getClient();
      const effectiveShopId = targetShopId || currentShopId;

      const client = (typeof globalThis.SupabaseCloud !== 'undefined' && globalThis.SupabaseCloud.getClient)
        ? globalThis.SupabaseCloud.getClient()
        : null;

      if (!client || !effectiveShopId) {
        throw new Error('Chưa kết nối Cloud hoặc chưa xác định được Shop ID để lưu dữ liệu.');
      }

      const syncStats = await syncVNPostOrdersToDatabase({
        vnpostOrders: allOrders,
        shopId: effectiveShopId,
        supabaseClient: client,
        autoInsertUnmatched: true
      });

      setSyncResultStats(syncStats);
      showToast(`🎉 Đã quét ${syncStats.total} đơn: ${syncStats.updated} đơn cập nhật trạng thái mới, ${syncStats.skipped} đơn giữ nguyên.`);

      await loadWebhookOrders(effectiveShopId, configRes);
    } catch (err) {
      showToast(`❌ Lỗi đồng bộ đơn cũ: ${err.message}`, 'error');
    } finally {
      setIsSyncingOldOrders(false);
    }
  };

  const handleSingleQuickLookup = async (codeToLookup, preferredCarrier = null) => {
    const code = String(codeToLookup || quickLookupCode || '').trim();
    if (!code) {
      showToast('⚠️ Vui lòng nhập mã vận đơn hoặc mã đơn hàng cần tra cứu!', 'error');
      return;
    }

    const carrier = preferredCarrier || detectOrderCarrier({ tracking_code: code, order_code: code });

    // Nếu đơn hàng thuộc J&T Express, mở trang tra cứu của J&T và thông báo rõ ràng cho người dùng
    if (carrier === 'jt') {
      window.open(`https://jtexpress.vn/vi/tracking?billcode=${encodeURIComponent(code)}`, '_blank');
      showToast(`ℹ️ Đơn hàng [${code}] thuộc J&T Express. Tiện ích đã mở trang tra cứu vận đơn J&T. Tính năng API tự động cho J&T sẽ được kết nối ở bản cập nhật tới!`, 'info');
      return;
    }

    setIsLookingUpSingle(true);
    setSingleLookupResult(null);
    try {
      const { targetShopId, configRes } = await getClient();
      const effectiveShopId = targetShopId || currentShopId;
      const client = (typeof globalThis.SupabaseCloud !== 'undefined' && globalThis.SupabaseCloud.getClient)
        ? globalThis.SupabaseCloud.getClient()
        : null;

      // 1. Ưu tiên tra cứu tức thì qua Tab MyVNPost Web nếu tab đang mở và đã đăng nhập
      if (webSessionStatus.hasTab && webSessionStatus.hasSession && webSessionStatus.tabId) {
        const webRes = await new Promise((resolve) => {
          chrome.tabs.sendMessage(webSessionStatus.tabId, {
            action: 'VNPOST_LOOKUP_SINGLE_VIA_WEB',
            code
          }, (response) => {
            const lastErr = chrome.runtime.lastError;
            if (lastErr) {
              resolve({
                success: false,
                error: 'Không thể kết nối với tab MyVNPost. Vui lòng bấm F5 (tải lại trang) trên tab my.vnpost.vn!'
              });
              return;
            }
            resolve(response || { success: false, error: 'Không nhận được dữ liệu từ MyVNPost.' });
          });
        });

        if (webRes && webRes.success && webRes.order) {
          const normOrder = normalizeVNPostWebOrder(webRes.order);
          const norm = normalizeVNPostStatus(normOrder.status, normOrder.status_name);
          setSingleLookupResult({
            order: normOrder,
            norm
          });
          showToast(`✅ Đã tìm thấy đơn VNPost: [${norm.statusName}]`);

          // Cập nhật ngay tức thì vào danh sách trên màn hình
          setWebhookOrders(prev => prev.map(item => {
            const isMatch = (item.tracking_code && (item.tracking_code === normOrder.tracking_code || item.tracking_code === code)) ||
                            (item.order_code && (item.order_code === normOrder.order_code || item.order_code === code));
            if (isMatch) {
              const fee = normOrder.shipping_fee > 0 ? normOrder.shipping_fee : item.shipping_fee;
              const weight = normOrder.weight > 0 ? normOrder.weight : item.actual_weight;
              const logs = Array.isArray(item.webhook_logs) ? [...item.webhook_logs] : [];
              if (logs.length === 0) {
                logs.push({
                  statusCode: norm.statusCode || '1',
                  statusName: norm.statusName || (norm.status === 'pending' ? 'Chờ lấy hàng' : 'Cập nhật trạng thái'),
                  statusDate: normOrder.updated_at || new Date().toISOString(),
                  weight,
                  totalFee: fee,
                  source: 'vnpost_quick_lookup',
                  receivedAt: new Date().toISOString()
                });
              }
              return {
                ...item,
                status: norm.status,
                shipping_fee: fee,
                actual_weight: weight,
                tracking_code: normOrder.tracking_code || item.tracking_code,
                webhook_logs: logs,
                updated_at: new Date().toISOString()
              };
            }
            return item;
          }));

          if (client && effectiveShopId) {
            await syncVNPostOrdersToDatabase({
              vnpostOrders: [normOrder],
              shopId: effectiveShopId,
              supabaseClient: client,
              autoInsertUnmatched: true
            });
            await loadWebhookOrders(effectiveShopId, configRes);
          }
          return;
        }
      }

      // 2. Dự phòng: Tra cứu qua Connect API nếu đã có cấu hình
      let token = connectApiToken;
      const cCode = connectApiConfig.customerCode || webhookConfig.customerCode;
      if (!token) {
        const tokenRes = await vnpostGetAccessToken({
          username: connectApiConfig.username,
          password: connectApiConfig.password,
          customerCode: cCode,
          env: connectApiConfig.env,
          customUrl: connectApiConfig.customUrl
        });
        if (!tokenRes.success || !tokenRes.token) {
          throw new Error(tokenRes.error || 'Vui lòng mở tab MyVNPost đã đăng nhập để tra cứu tức thì.');
        }
        token = tokenRes.token;
        setConnectApiToken(token);
      }

      let lookupRes = await vnpostGetOrder({
        token,
        code,
        type: 1,
        env: connectApiConfig.env,
        customUrl: connectApiConfig.customUrl
      });

      if (!lookupRes.success) {
        lookupRes = await vnpostGetOrder({
          token,
          code,
          type: 2,
          env: connectApiConfig.env,
          customUrl: connectApiConfig.customUrl
        });
      }

      if (lookupRes.success && lookupRes.order) {
        const ord = lookupRes.order;
        const norm = normalizeVNPostStatus(ord.status, ord.statusName);
        setSingleLookupResult({
          order: ord,
          norm
        });
        showToast(`✅ Tìm thấy đơn VNPost: [${norm.statusName}]`);

        setWebhookOrders(prev => prev.map(item => {
          const isMatch = (item.tracking_code && (item.tracking_code === ord.itemCode || item.tracking_code === code)) ||
                          (item.order_code && (item.order_code === ord.saleOrderCode || item.order_code === code));
          if (isMatch) {
            const fee = ord.totalFee > 0 ? ord.totalFee : item.shipping_fee;
            const weight = ord.weight > 0 ? ord.weight : item.actual_weight;
            const logs = Array.isArray(item.webhook_logs) ? [...item.webhook_logs] : [];
            if (logs.length === 0) {
              logs.push({
                statusCode: norm.statusCode || '1',
                statusName: norm.statusName || (norm.status === 'pending' ? 'Chờ lấy hàng' : 'Cập nhật trạng thái'),
                statusDate: ord.createDate || new Date().toISOString(),
                weight,
                totalFee: fee,
                source: 'vnpost_connect_api',
                receivedAt: new Date().toISOString()
              });
            }
            return {
              ...item,
              status: norm.status,
              shipping_fee: fee,
              actual_weight: weight,
              tracking_code: ord.itemCode || item.tracking_code,
              webhook_logs: logs,
              updated_at: new Date().toISOString()
            };
          }
          return item;
        }));

        if (client && effectiveShopId) {
          await syncVNPostOrdersToDatabase({
            vnpostOrders: [ord],
            shopId: effectiveShopId,
            supabaseClient: client,
            autoInsertUnmatched: true
          });
          await loadWebhookOrders(effectiveShopId, configRes);
        }
      } else {
        showToast(`❌ ${lookupRes.error || 'Không tìm thấy đơn hàng trên MyVNPost. Hãy mở tab my.vnpost.vn để tra cứu nhanh nhất.'}`, 'error');
      }
    } catch (err) {
      showToast(`❌ Lỗi tra cứu: ${err.message}`, 'error');
    } finally {
      setIsLookingUpSingle(false);
    }
  };

  const handleGenToken = () => {
    const randomHex = Array.from(crypto.getRandomValues(new Uint8Array(12)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    const newToken = `vnp_${randomHex}`;
    setWebhookConfig(prev => ({ ...prev, apiToken: newToken }));
    // CHỈ cập nhật state hiển thị, KHÔNG tự ý ghi vào chrome.storage.local ở đây để tránh bấm nhầm
    showToast('🎲 Đã tạo mã Token mới trên màn hình. Nhớ bấm "💾 Lưu Cấu Hình" nếu bạn thực sự muốn áp dụng!', 'warning');
  };

  const getWebhookUrl = () => {
    if (!supabaseBaseUrl || !webhookConfig.apiToken.trim()) return '';
    return `${supabaseBaseUrl.replace(/\/$/, '')}/functions/v1/vnpost-webhook?token=${encodeURIComponent(webhookConfig.apiToken.trim())}`;
  };

  const handleCopyWebhookUrl = () => {
    const url = getWebhookUrl();
    if (!url) {
      showToast('⚠️ Vui lòng điền hoặc tạo mã Token trước để lấy đường link Webhook!', 'error');
      return;
    }
    navigator.clipboard.writeText(url);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2500);
    showToast('📋 Đã sao chép link Webhook VNPost vào clipboard!');
  };

  const handleCopySecretToken = () => {
    const token = (webhookConfig.apiToken || '').trim();
    if (!token) {
      showToast('⚠️ Vui lòng điền hoặc tạo mã Token trước!', 'error');
      return;
    }
    navigator.clipboard.writeText(token);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2500);
    showToast('🔑 Đã sao chép Token Bảo Mật (Secret Token) của Shop!');
  };

  const handleSaveWebhook = async (silent = false) => {
    setIsSavingWebhook(true);
    try {
      const { configRes, sess, targetShopId } = await getClient();
      const token = (webhookConfig.apiToken || '').trim();
      const customerCode = (webhookConfig.customerCode || '').trim();

      if (!token) {
        showToast('⚠️ Vui lòng điền hoặc bấm "Tạo mới" mã Token bảo mật trước khi lưu!', 'error');
        return false;
      }

      const effectiveId = targetShopId || currentShopId || '';

      // 1. Lưu ngay vào local storage để không bao giờ bị mất cấu hình
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.set({
          ...(effectiveId ? { [`vnpost_webhook_config_${effectiveId}`]: { customerCode, apiToken: token } } : {}),
          last_vnpost_webhook_config: { customerCode, apiToken: token }
        });
      }

      let savedOnCloud = false;
      let lastErrMsg = '';

      // 2. ƯU TIÊN SỐ 1: Gọi Edge Function action: 'save_config'
      // Edge function chạy bằng Supabase Service Role Key, vượt qua RLS và không đòi quyền OWNER
      if (configRes?.url) {
        try {
          const edgeRes = await fetch(`${configRes.url.replace(/\/$/, '')}/functions/v1/vnpost-webhook`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': configRes.anonKey,
              ...(sess?.access_token ? { 'Authorization': `Bearer ${sess.access_token}` } : {})
            },
            body: JSON.stringify({
              action: 'save_config',
              shopId: effectiveId,
              token: token,
              customerCode: customerCode
            })
          });
          if (edgeRes.ok) {
            const edgeData = await edgeRes.json().catch(() => ({}));
            if (edgeData.success) {
              savedOnCloud = true;
              if (edgeData.shop_id) {
                setCurrentShopId(edgeData.shop_id);
                if (typeof chrome !== 'undefined' && chrome.storage?.local) {
                  chrome.storage.local.set({
                    [`vnpost_webhook_config_${edgeData.shop_id}`]: { customerCode, apiToken: token }
                  });
                }
              }
              if (edgeData.shop_name) setCurrentShopName(edgeData.shop_name);
            }
          } else {
            const errData = await edgeRes.json().catch(() => ({}));
            if (errData?.error) lastErrMsg = errData.error;
          }
        } catch (edgeErr) {
          console.warn('Lưu qua Edge Function gặp lỗi:', edgeErr);
        }
      }

      // 3. ƯU TIÊN SỐ 2: Gọi RPC save_shop_webhook_config nếu Edge Function chưa lưu được
      if (!savedOnCloud && sess?.access_token && configRes?.url) {
        const baseHeaders = {
          'apikey': configRes.anonKey,
          'Authorization': `Bearer ${sess.access_token}`,
          'Content-Type': 'application/json'
        };

        try {
          const rpcRes = await fetch(`${configRes.url.replace(/\/$/, '')}/rest/v1/rpc/save_shop_webhook_config`, {
            method: 'POST',
            headers: baseHeaders,
            body: JSON.stringify({
              p_shop_id: targetShopId,
              p_customer_code: customerCode,
              p_api_token: token
            })
          });
          if (rpcRes.ok) {
            const rpcData = await rpcRes.json().catch(() => ({}));
            if (rpcData?.success) savedOnCloud = true;
          }
        } catch (_) {}

        // 4. ƯU TIÊN SỐ 3: Fallback sang PATCH/POST shop_feature_flags
        if (!savedOnCloud) {
          const payload = {
            shop_id: targetShopId,
            vnpost_customer_code: customerCode,
            vnpost_api_token: token,
            updated_at: new Date().toISOString()
          };

          const patchRes = await fetch(
            `${configRes.url.replace(/\/$/, '')}/rest/v1/shop_feature_flags?shop_id=eq.${targetShopId}`,
            {
              method: 'PATCH',
              headers: { ...baseHeaders, 'Prefer': 'return=representation' },
              body: JSON.stringify(payload)
            }
          );
          if (patchRes.ok) {
            const rows = await patchRes.json().catch(() => []);
            if (rows && rows.length > 0) savedOnCloud = true;
          }

          if (!savedOnCloud) {
            const postRes = await fetch(`${configRes.url.replace(/\/$/, '')}/rest/v1/shop_feature_flags`, {
              method: 'POST',
              headers: { ...baseHeaders, 'Prefer': 'return=representation' },
              body: JSON.stringify(payload)
            });
            if (postRes.ok) {
              savedOnCloud = true;
            } else {
              const errData = await postRes.json().catch(() => ({}));
              if (errData?.message) lastErrMsg = errData.message;
            }
          }
        }
      }

      const isTokenChanged = Boolean(originalToken && token !== originalToken);

      if (savedOnCloud) {
        setOriginalToken(token);
        setIsTokenLocked(true);
        if (isTokenChanged) {
          setShowPostSaveReminderModal(true);
        }
        if (!silent) {
          showToast(
            isTokenChanged 
              ? '⚠️ ĐÃ ĐỔI TOKEN MỚI: Đừng quên cập nhật link Webhook mới trên my.vnpost.vn!'
              : '✅ Đã lưu cấu hình Webhook VNPost lên Cloud thành công!',
            isTokenChanged ? 'warning' : 'success'
          );
        }
        return true;
      } else {
        if (!silent) {
          showToast(`⚠️ Đã lưu cấu hình cục bộ (Cloud: ${lastErrMsg || 'Chưa đồng bộ được'})`, 'warning');
        }
        return false;
      }
    } catch (err) {
      if (!silent) {
        showToast('❌ Lỗi lưu Webhook: ' + err.message, 'error');
      }
      return false;
    } finally {
      setIsSavingWebhook(false);
    }
  };

  const handleOpenTestModal = async () => {
    setShowTestModal(true);
    setTestResult(null);
    try {
      const { configRes, sess, targetShopId } = await getClient();
      if (targetShopId && configRes?.url && sess?.access_token) {
        const res = await fetch(
          `${configRes.url.replace(/\/$/, '')}/rest/v1/submitted_orders?shop_id=eq.${targetShopId}&select=id,order_code,tracking_code,name,phone,status,shipping_fee,actual_weight&order=submitted_at.desc&limit=6`,
          {
            headers: {
              'apikey': configRes.anonKey,
              'Authorization': `Bearer ${sess.access_token}`
            }
          }
        );
        if (res.ok) {
          const rows = await res.json();
          setRecentSubmittedOrders(rows || []);
          if (rows && rows.length > 0 && !testForm.orderCode && !testForm.itemCode) {
            const first = rows[0];
            setTestForm(prev => ({
              ...prev,
              orderCode: first.order_code || '',
              itemCode: first.tracking_code && first.tracking_code !== '—' && first.tracking_code !== '-' ? first.tracking_code : ''
            }));
          }
        }
      }
    } catch (_) {}
  };

  const handleSelectRecentOrder = (order) => {
    setTestForm(prev => ({
      ...prev,
      orderCode: order.order_code || '',
      itemCode: order.tracking_code && order.tracking_code !== '—' && order.tracking_code !== '-' ? order.tracking_code : ''
    }));
    showToast(`🎯 Đã chọn đơn: ${order.order_code || order.tracking_code || order.name}`);
  };

  const handleStatusPresetChange = (code) => {
    const statusMap = {
      '90': 'Phát thành công',
      '70': 'Đang giao hàng',
      '80': 'Đang trung chuyển',
      '100': 'Chuyển hoàn',
      '50': 'Đã gom hàng'
    };
    setTestForm(prev => ({
      ...prev,
      statusCode: code,
      statusName: statusMap[code] || 'Cập nhật trạng thái'
    }));
  };

  const handleTestPing = async () => {
    if (!webhookConfig.apiToken.trim()) {
      showToast('⚠️ Vui lòng nhập hoặc tạo mã Token trước khi gửi test!', 'error');
      return;
    }

    // Tự động đồng bộ và lưu mã Token lên Database trước khi ping để đảm bảo tính xác thực
    try {
      await handleSaveWebhook(true);
    } catch (saveErr) {
      console.warn('Tự động lưu Webhook trước khi Ping gặp cảnh báo:', saveErr);
    }

    const targetUrl = getWebhookUrl();
    if (!targetUrl) {
      showToast('⚠️ Không xác định được đường dẫn Webhook!', 'error');
      return;
    }

    setTestingPing(true);
    setTestResult(null);

    const payload = {
      OrderCode: testForm.orderCode.trim() || ('TEST_' + Date.now().toString().slice(-6)),
      ItemCode: testForm.itemCode.trim() || (`AFO_TEST_${Date.now()}`),
      StatusCode: String(testForm.statusCode || '90'),
      StatusName: testForm.statusName || 'Phát thành công',
      StatusDate: new Date().toISOString(),
      TotalFee: Number(testForm.totalFee) || 0,
      Weight: Number(testForm.weight) || 0
    };

    try {
      const resp = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const resBody = await resp.json().catch(() => null);

      if (resp.ok && resBody?.success) {
        setTestResult({
          ok: true,
          status: resp.status,
          message: resBody.message || 'Đồng bộ dữ liệu trạng thái đơn thành công!',
          data: resBody,
          payload
        });
        showToast('🎉 Webhook VNPost nhận & đồng bộ đơn thành công!');
        window.dispatchEvent(new CustomEvent('submitted-orders-updated'));
        window.dispatchEvent(new CustomEvent('order-saved-db'));
      } else if (resp.status === 404) {
        setTestResult({
          ok: false,
          isNotFound: true,
          status: resp.status,
          message: resBody?.message || 'Không tìm thấy đơn hàng khớp với OrderCode/ItemCode trong shop.',
          data: resBody,
          payload,
          tip: '✅ Đường dẫn Webhook và Token xác thực đã hoạt động chính xác 100%! Để test cập nhật trạng thái đơn thật, hãy bấm chọn một đơn có sẵn bên dưới.'
        });
      } else {
        setTestResult({
          ok: false,
          status: resp.status,
          message: resBody?.error || resBody?.message || `Lỗi HTTP ${resp.status}`,
          data: resBody,
          payload
        });
        showToast('❌ Thử nghiệm thất bại: ' + (resBody?.error || `HTTP ${resp.status}`), 'error');
      }
    } catch (err) {
      setTestResult({
        ok: false,
        status: 0,
        message: err.message || 'Lỗi mạng hoặc không thể kết nối đến Edge Function',
        payload
      });
      showToast('❌ Lỗi kết nối: ' + err.message, 'error');
    } finally {
      setTestingPing(false);
    }
  };

  const webhookUrl = getWebhookUrl();

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h2 className="page-title" style={{ margin: 0 }}>Cấu Hình Hãng Vận Chuyển</h2>
        <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0', fontSize: '13px' }}>
          Liên kết tài khoản VNPost, J&T Express và cấu hình Webhook để tự động cập nhật trạng thái bưu gửi theo thời gian thực.
        </p>
      </div>

      {status.text && (
        <div style={{
          padding: '10px 14px',
          borderRadius: '8px',
          fontSize: '13px',
          fontWeight: 600,
          marginBottom: '16px',
          background: status.type === 'error' ? 'var(--color-danger-bg)' : 'var(--color-success-bg)',
          color: status.type === 'error' ? 'var(--color-danger-text)' : 'var(--color-success-text)',
          border: `1px solid ${status.type === 'error' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`
        }}>
          {status.text}
        </div>
      )}

      {isLoading ? (
        <div className="card" style={{ textAlign: 'center', padding: '50px', color: 'var(--text-muted)' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <div className="db-status-dot live"></div> Đang tải danh sách hãng vận chuyển...
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            {carriers.map(carrier => {
              const meta = CARRIERS_METADATA[carrier.id] || { name: carrier.name, desc: '', portalUrl: '' };
              const form = carrierForms[carrier.id] || { username: '', password: '' };
              const connecting = isConnecting[carrier.id];

              return (
                <div
                  key={carrier.id}
                  className="card"
                  style={{
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                  }}
                >
                  <div>
                    {/* Card Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '8px',
                          background: carrier.connected ? 'var(--primary-light)' : 'var(--bg)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: carrier.connected ? 'var(--primary)' : 'var(--text-muted)'
                        }}>
                          <Truck size={20} />
                        </div>
                        <div>
                          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--text-main)' }}>
                            {meta.name}
                          </h3>
                          <a
                            href={meta.portalUrl}
                            target="_blank"
                            rel="noreferrer"
                            style={{ fontSize: '11px', color: 'var(--primary)', textDecoration: 'none' }}
                          >
                            {meta.portalUrl.replace('https://', '')} ↗
                          </a>
                        </div>
                      </div>

                      <span style={{
                        padding: '4px 10px',
                        borderRadius: '999px',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        background: carrier.connected ? 'var(--color-success-bg)' : 'var(--bg)',
                        color: carrier.connected ? 'var(--color-success-text)' : 'var(--text-muted)',
                        border: `1px solid ${carrier.connected ? 'rgba(16, 185, 129, 0.25)' : 'var(--border)'}`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        {carrier.connected && <CheckCircle2 size={12} />}
                        {carrier.connected ? 'Đã liên kết' : 'Chưa kết nối'}
                      </span>
                    </div>

                    <p style={{ color: 'var(--text-muted)', fontSize: '12.5px', margin: '0 0 16px 0', lineHeight: '1.4' }}>
                      {meta.desc}
                    </p>
                  </div>

                  {/* Body Content */}
                  {carrier.connected ? (
                    <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px', marginTop: 'auto' }}>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 600 }}>TÀI KHOẢN LIÊN KẾT</div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px', marginBottom: '12px', wordBreak: 'break-all' }}>
                        👤 {carrier.account || 'Mặc định'}
                      </div>
                      <button
                        onClick={() => handleDisconnect(carrier.id)}
                        style={{
                          background: 'transparent',
                          color: 'var(--danger)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          padding: '8px 14px',
                          borderRadius: '8px',
                          fontWeight: 700,
                          fontSize: '12.5px',
                          cursor: 'pointer',
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <Unlink size={14} /> Ngắt Kết Nối
                      </button>
                    </div>
                  ) : (
                    <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px', marginTop: 'auto' }}>
                      <div style={{ marginBottom: '10px' }}>
                        <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
                          Tên đăng nhập {carrier.name}
                        </label>
                        <input
                          type="text"
                          placeholder="Số điện thoại / Email / Mã KH..."
                          value={form.username}
                          onChange={e => handleInputChange(carrier.id, 'username', e.target.value)}
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            padding: '8px 10px',
                            border: '1px solid var(--border)',
                            borderRadius: '6px',
                            background: 'var(--card)',
                            color: 'var(--text-main)',
                            fontSize: '13px',
                            outline: 'none'
                          }}
                        />
                      </div>

                      <div style={{ marginBottom: '14px' }}>
                        <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
                          Mật khẩu
                        </label>
                        <input
                          type="password"
                          placeholder="Mật khẩu đăng nhập portal..."
                          value={form.password}
                          onChange={e => handleInputChange(carrier.id, 'password', e.target.value)}
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            padding: '8px 10px',
                            border: '1px solid var(--border)',
                            borderRadius: '6px',
                            background: 'var(--card)',
                            color: 'var(--text-main)',
                            fontSize: '13px',
                            outline: 'none'
                          }}
                        />
                      </div>

                      <button
                        onClick={() => handleConnect(carrier.id)}
                        disabled={connecting}
                        style={{
                          background: 'var(--primary)',
                          color: '#fff',
                          border: 'none',
                          padding: '9px 16px',
                          borderRadius: '8px',
                          fontWeight: 700,
                          fontSize: '13px',
                          cursor: connecting ? 'not-allowed' : 'pointer',
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)'
                        }}
                      >
                        {connecting ? <RefreshCw size={14} className="spin" /> : <Key size={14} />}
                        {connecting ? 'Đang kết nối...' : `Liên kết ${carrier.name}`}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ══════════════════════════════════════════════════════════════════════ */}
          {/* SECTION: VNPOST WEBHOOK INTEGRATION */}
          {/* ══════════════════════════════════════════════════════════════════════ */}
          <div
            className="card"
            style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '24px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
              marginBottom: '24px'
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  background: '#fef9c3',
                  color: '#ca8a04',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Globe size={22} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-main)' }}>
                      Tích Hợp Webhook VNPost (Đồng Bộ Đơn Tự Động)
                    </h3>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '999px',
                      fontSize: '11px',
                      fontWeight: 700,
                      background: webhookConfig.apiToken ? '#dcfce7' : '#f1f5f9',
                      color: webhookConfig.apiToken ? '#166534' : '#64748b',
                      border: `1px solid ${webhookConfig.apiToken ? '#bbf7d0' : '#e2e8f0'}`
                    }}>
                      {webhookConfig.apiToken ? '⚡ Đang áp dụng toàn Shop' : 'Chưa cấu hình Token'}
                    </span>
                  </div>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                    Cung cấp URL Webhook và Token bảo mật để VNPost tự động đẩy trạng thái giao hàng, cước thực tế và lịch sử bưu gửi về shop.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleOpenTestModal}
                  style={{
                    background: '#f8fafc',
                    color: '#0284c7',
                    border: '1px solid #bae6fd',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Play size={14} /> 🧪 Kiểm tra Webhook (Test Ping)
                </button>
                <button
                  type="button"
                  onClick={handleSaveWebhook}
                  disabled={isSavingWebhook}
                  style={{
                    background: 'var(--primary)',
                    color: '#fff',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: isSavingWebhook ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)'
                  }}
                >
                  {isSavingWebhook ? <RefreshCw size={14} className="spin" /> : <Sparkles size={14} />}
                  {isSavingWebhook ? 'Đang lưu...' : '💾 Lưu Cấu Hình'}
                </button>
              </div>
            </div>

            {/* System Scope & Sync Notice */}
            <div style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '8px',
              padding: '10px 14px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '8px',
              fontSize: '12.5px',
              color: '#166534'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '16px' }}>🏢</span>
                <span>
                  <strong>Phạm vi đồng bộ toàn Shop:</strong> Đang áp dụng cho {currentShopName ? `Shop "${currentShopName}"` : 'toàn bộ tài khoản trong Shop'} {currentShopId ? `(Mã Shop: ${currentShopId})` : ''}.
                  Mọi tài khoản nhân viên / thành viên đều dùng chung Secret Token và Webhook này.
                </span>
              </div>
              <span style={{
                background: '#16a34a',
                color: '#fff',
                fontSize: '11px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '6px'
              }}>
                Toàn Hệ Thống
              </span>
            </div>

            {/* Form Fields */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '16px' }}>
              {/* Customer Code */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                  Mã Khách Hàng VNPost (Customer Code)
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: C01234567..."
                  value={webhookConfig.customerCode}
                  onChange={e => setWebhookConfig(prev => ({ ...prev, customerCode: e.target.value }))}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '9px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    background: 'var(--bg)',
                    color: 'var(--text-main)',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                />
                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Mã khách hàng hợp đồng trên trang <a href="https://my.vnpost.vn" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none' }}>my.vnpost.vn ↗</a>
                </div>
              </div>

              {/* API Token Editor with 4-Layer Safety Lock */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {isTokenLocked ? <Lock size={13} color="#64748b" /> : <Unlock size={13} color="#d97706" />}
                    <span>Chỉnh Sửa / Đổi Token Bảo Mật</span>
                  </label>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '6px',
                    background: isTokenLocked ? '#f1f5f9' : '#fef3c7',
                    color: isTokenLocked ? '#475569' : '#92400e',
                    border: `1px solid ${isTokenLocked ? '#cbd5e1' : '#fde68a'}`
                  }}>
                    {isTokenLocked ? '🔒 Đang khóa bảo vệ' : '⚠️ Đang mở khóa chỉnh sửa'}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
                    <input
                      type="text"
                      placeholder="Mã token bảo mật của shop..."
                      value={webhookConfig.apiToken}
                      readOnly={isTokenLocked}
                      onChange={e => {
                        if (!isTokenLocked) {
                          setWebhookConfig(prev => ({ ...prev, apiToken: e.target.value }));
                        }
                      }}
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: '9px 12px',
                        paddingLeft: isTokenLocked ? '34px' : '12px',
                        border: isTokenLocked ? '1px solid #cbd5e1' : '1.5px solid #eab308',
                        borderRadius: '8px',
                        background: isTokenLocked ? '#f8fafc' : '#ffffff',
                        color: isTokenLocked ? '#64748b' : 'var(--text-main)',
                        fontSize: '13px',
                        fontFamily: 'monospace',
                        outline: 'none',
                        cursor: isTokenLocked ? 'not-allowed' : 'text'
                      }}
                    />
                    {isTokenLocked && (
                      <Lock size={14} color="#94a3b8" style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)' }} />
                    )}
                  </div>

                  {isTokenLocked ? (
                    <button
                      type="button"
                      onClick={handleUnlockTokenClick}
                      title="Mở khóa để thay đổi hoặc tạo mới mã Token"
                      style={{
                        background: '#ffffff',
                        color: '#0f172a',
                        border: '1px solid #cbd5e1',
                        padding: '8px 14px',
                        borderRadius: '8px',
                        fontWeight: 700,
                        fontSize: '12.5px',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                      }}
                    >
                      <Lock size={13} color="#ea580c" />
                      <span>Đổi / Tạo mới Token</span>
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={handleGenToken}
                        title="Tạo mã Token ngẫu nhiên mới trên màn hình"
                        style={{
                          background: '#eff6ff',
                          color: '#1d4ed8',
                          border: '1px solid #bfdbfe',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          fontWeight: 700,
                          fontSize: '12.5px',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        🎲 Tạo mã mới
                      </button>

                      {originalToken && (
                        <button
                          type="button"
                          onClick={handleRevertToken}
                          title={`Khôi phục về Token gốc đang hoạt động (${originalToken})`}
                          style={{
                            background: '#f0fdf4',
                            color: '#15803d',
                            border: '1px solid #bbf7d0',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            fontWeight: 700,
                            fontSize: '12.5px',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <RotateCcw size={13} />
                          <span>↩️ Khôi phục Token gốc</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={handleRelockToken}
                        title="Hủy sửa và khóa lại an toàn"
                        style={{
                          background: '#f1f5f9',
                          color: '#475569',
                          border: '1px solid #cbd5e1',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          fontWeight: 600,
                          fontSize: '12px',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Lock size={12} />
                        <span>Khóa lại</span>
                      </button>
                    </>
                  )}
                </div>

                <div style={{ fontSize: '11.5px', color: isTokenLocked ? 'var(--text-muted)' : '#b45309', marginTop: '5px' }}>
                  {isTokenLocked ? (
                    '🛡️ Token đang được KHÓA BẢO VỆ chống bấm nhầm. Nhấn "Đổi / Tạo mới Token" nếu bạn thực sự cần thay đổi mã.'
                  ) : (
                    '⚠️ ĐANG MỞ KHÓA: Nếu bạn tạo mã mới và bấm "Lưu Cấu Hình", bạn BẮT BUỘC phải đăng nhập lại trang my.vnpost.vn để cập nhật link Webhook mới!'
                  )}
                </div>
              </div>
            </div>

            {/* Active Secret Token Display Box */}
            <div style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              padding: '16px',
              marginBottom: '14px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Key size={15} color="#0284c7" />
                  <span>TOKEN BẢO MẬT WEBHOOK (SECRET TOKEN) ĐANG SỬ DỤNG CHO TOÀN SHOP:</span>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 7px',
                    borderRadius: '6px',
                    background: webhookConfig.apiToken ? '#dcfce7' : '#fee2e2',
                    color: webhookConfig.apiToken ? '#166534' : '#991b1b',
                    border: `1px solid ${webhookConfig.apiToken ? '#86efac' : '#fca5a5'}`
                  }}>
                    {webhookConfig.apiToken ? '🟢 Đang áp dụng' : '⚠️ Chưa có Token'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCopySecretToken}
                  disabled={!webhookConfig.apiToken}
                  style={{
                    background: copiedToken ? '#dcfce7' : '#ffffff',
                    color: copiedToken ? '#166534' : 'var(--primary)',
                    border: `1px solid ${copiedToken ? '#86efac' : 'var(--border)'}`,
                    padding: '6px 14px',
                    borderRadius: '6px',
                    fontWeight: 700,
                    fontSize: '12px',
                    cursor: webhookConfig.apiToken ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {copiedToken ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
                  {copiedToken ? 'Đã sao chép!' : 'Sao chép Secret Token'}
                </button>
              </div>

              <div style={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '10px 14px',
                fontFamily: 'monospace',
                fontSize: '13.5px',
                fontWeight: 700,
                color: webhookConfig.apiToken ? 'var(--primary)' : 'var(--text-muted)',
                wordBreak: 'break-all',
                userSelect: 'all',
                letterSpacing: '0.5px'
              }}>
                {webhookConfig.apiToken || '⚠️ Hãy tạo hoặc điền mã Token ở trên rồi bấm "Lưu Cấu Hình" để kích hoạt...'}
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '6px' }}>
                💡 Dùng để dán vào ô <strong>Mã bảo mật / Secret Key / Token</strong> trên cổng My VNPost nếu hệ thống yêu cầu xác thực riêng biệt.
              </div>
            </div>

            {/* Generated Webhook URL Display Box */}
            <div style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              padding: '16px',
              marginBottom: '16px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>🔗 ĐƯỜNG DẪN WEBHOOK CỦA SHOP ĐỂ DÁN VÀO VNPOST:</span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyWebhookUrl}
                  disabled={!webhookUrl}
                  style={{
                    background: copiedWebhook ? '#dcfce7' : '#ffffff',
                    color: copiedWebhook ? '#166534' : 'var(--primary)',
                    border: `1px solid ${copiedWebhook ? '#86efac' : 'var(--border)'}`,
                    padding: '6px 14px',
                    borderRadius: '6px',
                    fontWeight: 700,
                    fontSize: '12px',
                    cursor: webhookUrl ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {copiedWebhook ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
                  {copiedWebhook ? 'Đã sao chép!' : 'Sao chép Link Webhook'}
                </button>
              </div>

              <div style={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '10px 14px',
                fontFamily: 'monospace',
                fontSize: '13px',
                color: webhookUrl ? 'var(--primary)' : 'var(--text-muted)',
                wordBreak: 'break-all',
                userSelect: 'all'
              }}>
                {webhookUrl || '⚠️ Hãy tạo hoặc điền mã Token ở trên để hiển thị link Webhook của shop...'}
              </div>
            </div>

            {/* Step-by-step instructions */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '14px 18px',
              fontSize: '12.5px',
              color: '#334155'
            }}>
              <div style={{ fontWeight: 800, marginBottom: '6px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <HelpCircle size={15} color="#0284c7" /> Hướng dẫn cài đặt Webhook trên cổng My VNPost:
              </div>
              <ol style={{ margin: 0, paddingLeft: '20px', lineHeight: '1.6' }}>
                <li>Đăng nhập vào tài khoản khách hàng trên <strong>https://my.vnpost.vn</strong></li>
                <li>Vào mục <strong>Cài đặt tài khoản</strong> ➔ <strong>Tích hợp hệ thống / Quản lý Webhook</strong></li>
                <li>Dán <strong>Đường dẫn Webhook của shop</strong> ở trên vào ô <em>URL nhận thông báo trạng thái</em></li>
                <li>Dán <strong>Token Bảo Mật Webhook (Secret Token)</strong> ở trên vào ô <em>Mã xác thực / Secret Key / Token</em> (nếu cổng VNPost yêu cầu)</li>
                <li>Chọn phương thức nhận: <strong>POST</strong> (Content-Type: <code>application/json</code>) và bấm <strong>Lưu cấu hình</strong></li>
                <li>Hệ thống VNPost sẽ tự động đẩy mọi thay đổi hành trình về shop ngay khi bưu tá giao hàng!</li>
              </ol>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════════════ */}
          {/* SECTION: VNPOST ORDER SYNCHRONIZATION (ĐỒNG BỘ TRẠNG THÁI ĐƠN HÀNG) */}
          {/* ══════════════════════════════════════════════════════════════════════ */}
          <div
            className="card"
            style={{
              background: 'var(--card)',
              border: '1.5px solid #16a34a',
              borderRadius: '12px',
              padding: '24px',
              boxShadow: '0 4px 12px rgba(22, 163, 74, 0.08)',
              marginBottom: '24px'
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  background: '#dcfce7',
                  color: '#16a34a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Globe size={24} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-main)' }}>
                      Đồng Bộ Trạng Thái & Tra Cứu Đơn Cũ VNPost
                    </h3>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '999px',
                      fontSize: '11px',
                      fontWeight: 700,
                      background: (webSessionStatus.hasTab && webSessionStatus.hasSession) ? '#dcfce7' : '#f1f5f9',
                      color: (webSessionStatus.hasTab && webSessionStatus.hasSession) ? '#166534' : '#475569',
                      border: `1px solid ${(webSessionStatus.hasTab && webSessionStatus.hasSession) ? '#86efac' : '#cbd5e1'}`
                    }}>
                      {(webSessionStatus.hasTab && webSessionStatus.hasSession)
                        ? `🟢 Đã Kết Nối Tab Web (${webSessionStatus.userPhone || 'Sẵn Sàng'})`
                        : (connectApiStatus.connected ? '🟢 Đã Kết Nối API' : '⚪ Chưa Kết Nối')}
                    </span>
                  </div>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Quét và đồng bộ tự động trạng thái giao hàng, số tiền thu hộ COD và tiền cước của các đơn hàng cũ về hệ thống shop.
                  </div>
                </div>
              </div>
            </div>

            {/* ─── PHƯƠNG ÁN 1: ĐỒNG BỘ QUA TAB WEB MYVNPOST (KHUYÊN DÙNG) ─── */}
            <div style={{
              background: '#f0fdf4',
              border: '1.5px solid #86efac',
              borderRadius: '10px',
              padding: '18px',
              marginBottom: '18px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#166534', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={16} color="#16a34a" />
                  <span>PHƯƠNG ÁN 1: ĐỒNG BỘ QUA TAB MYVNPOST ĐANG MỞ (KHUYÊN DÙNG - 100% KHÔNG BỊ CHẶN IP):</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={checkVNPostWebSession}
                    disabled={webSessionStatus.checking}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #86efac',
                      borderRadius: '6px',
                      padding: '4px 10px',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      color: '#166534',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <RefreshCw size={11} className={webSessionStatus.checking ? 'spin' : ''} />
                    <span>Kiểm tra lại Tab</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => window.open('https://my.vnpost.vn', '_blank')}
                    style={{
                      background: '#16a34a',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '4px 10px',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <ExternalLink size={11} />
                    <span>Mở Tab MyVNPost</span>
                  </button>
                </div>
              </div>

              {/* Status banner */}
              <div style={{
                background: '#ffffff',
                border: '1px solid #bbf7d0',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '12px',
                marginBottom: '14px',
                color: '#14532d',
                lineHeight: '1.5'
              }}>
                {webSessionStatus.needsReload ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', color: '#b45309' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <AlertTriangle size={16} color="#d97706" />
                      <span>
                        <strong>Tab MyVNPost cần được tải lại (F5):</strong> Tab này được mở trước khi tiện ích cập nhật mã mới. Hãy bấm nút <em>"Tải lại Tab ngay"</em> để kết nối!
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (webSessionStatus.tabId && typeof chrome !== 'undefined' && chrome.tabs?.reload) {
                          chrome.tabs.reload(webSessionStatus.tabId, () => {
                            setTimeout(checkVNPostWebSession, 1500);
                          });
                        }
                      }}
                      style={{
                        background: '#f59e0b',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '5px 12px',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      🔄 Tải lại Tab ngay (F5)
                    </button>
                  </div>
                ) : webSessionStatus.hasTab && webSessionStatus.hasSession ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle2 size={16} color="#16a34a" />
                    <span>
                      <strong>Đã phát hiện Tab MyVNPost đang mở và đăng nhập:</strong> Tài khoản SĐT: <strong>{webSessionStatus.userPhone || webSessionStatus.userName || 'Bưu cục'}</strong>. Bạn có thể bấm nút quét ngay dưới đây!
                    </span>
                  </div>
                ) : webSessionStatus.hasTab && !webSessionStatus.hasSession ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#b45309' }}>
                    <AlertTriangle size={16} color="#d97706" />
                    <span>
                      <strong>Đã tìm thấy Tab MyVNPost nhưng chưa đăng nhập:</strong> Vui lòng chuyển sang tab <a href="https://my.vnpost.vn" target="_blank" rel="noreferrer" style={{ color: '#0284c7', textDecoration: 'underline' }}>my.vnpost.vn</a> để đăng nhập tài khoản của bạn, sau đó bấm nút <em>"Kiểm tra lại Tab"</em> ở trên.
                    </span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#475569' }}>
                    <HelpCircle size={16} color="#64748b" />
                    <span>
                      <strong>Chưa phát hiện Tab MyVNPost:</strong> Hãy bấm nút <strong>"Mở Tab MyVNPost"</strong> ở góc phải để mở trang và đăng nhập. Tiện ích sẽ tự động đọc danh sách đơn mà không cần cấu hình IP Tĩnh hay hợp đồng API B2B.
                    </span>
                  </div>
                )}
              </div>

              {/* Date pickers & Action button */}
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '12px', color: '#166534', fontWeight: 600 }}>Từ ngày:</span>
                  <input
                    type="date"
                    value={syncDateFrom}
                    onChange={e => setSyncDateFrom(e.target.value)}
                    style={{
                      padding: '6px 10px',
                      border: '1px solid #86efac',
                      borderRadius: '6px',
                      background: '#ffffff',
                      fontSize: '12px',
                      outline: 'none'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '12px', color: '#166534', fontWeight: 600 }}>Đến ngày:</span>
                  <input
                    type="date"
                    value={syncDateTo}
                    onChange={e => setSyncDateTo(e.target.value)}
                    style={{
                      padding: '6px 10px',
                      border: '1px solid #86efac',
                      borderRadius: '6px',
                      background: '#ffffff',
                      fontSize: '12px',
                      outline: 'none'
                    }}
                  />
                </div>

                <button
                  type="button"
                  disabled={isSyncingViaWebSession}
                  onClick={handleSyncViaWebSession}
                  style={{
                    background: '#16a34a',
                    color: '#ffffff',
                    border: 'none',
                    padding: '8px 20px',
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: isSyncingViaWebSession ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 4px rgba(22, 163, 74, 0.25)'
                  }}
                >
                  {isSyncingViaWebSession ? <RefreshCw size={14} className="spin" /> : <RefreshCw size={14} />}
                  <span>{isSyncingViaWebSession ? 'Đang quét đơn qua Tab Web...' : '🔄 Quét & Đồng Bộ Toàn Bộ Đơn Cũ (Qua Tab Web)'}</span>
                </button>
              </div>

              {/* Sync Results Stats Display */}
              {syncResultStats && (
                <div style={{
                  background: '#ffffff',
                  border: '1px solid #86efac',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  marginTop: '12px'
                }}>
                  <div style={{ fontWeight: 800, fontSize: '12.5px', color: '#166534', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle2 size={16} color="#16a34a" />
                    <span>KẾT QUẢ ĐỒNG BỘ ĐƠN HÀNG TỪ VNPOST:</span>
                  </div>
                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '12px' }}>
                    <div>Tổng đơn tìm thấy: <strong>{syncResultStats.total}</strong></div>
                    <div style={{ color: '#16a34a' }}>Đã cập nhật trạng thái mới: <strong>{syncResultStats.updated}</strong></div>
                    <div style={{ color: '#64748b' }}>Trạng thái không đổi: <strong>{syncResultStats.skipped}</strong></div>
                    <div style={{ color: '#d97706' }}>Đơn chưa lưu trong shop: <strong>{syncResultStats.unmatched}</strong></div>
                  </div>
                </div>
              )}
            </div>

            {/* ─── PHƯƠNG ÁN 2: KẾT NỐI VNPOST CONNECT API (DÀNH CHO IP WHITELIST) ─── */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '16px',
              marginBottom: '16px'
            }}>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Key size={14} color="#0284c7" />
                <span>PHƯƠNG ÁN 2: TÍCH HỢP VNPOST CONNECT API (CHỈ DÀNH CHO ĐỐI TÁC DOANH NGHIỆP CÓ IP TĨNH WHITELIST):</span>
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '12px', lineHeight: '1.4' }}>
                ⚠️ <em>Lưu ý: VNPost hiện đã ngừng cấp mới tài khoản API cho khách hàng cá nhân. Nếu bạn không có hợp đồng B2B & IP tĩnh được whitelist, vui lòng sử dụng <strong>Phương án 1: Đồng bộ qua phiên đăng nhập MyVNPost (Web Session)</strong> ở trên. Tiện ích tuyệt đối không lưu mật khẩu VNPost của bạn lên máy chủ.</em>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '14px' }}>
                {/* Username */}
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '5px' }}>
                    Tên đăng nhập My VNPost
                  </label>
                  <input
                    type="text"
                    placeholder="VD: 0934889869"
                    value={connectApiConfig.username}
                    onChange={e => setConnectApiConfig(prev => ({ ...prev, username: e.target.value }))}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '8px 10px',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      background: 'var(--card)',
                      color: 'var(--text-main)',
                      fontSize: '12.5px',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Password */}
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '5px' }}>
                    Mật khẩu My VNPost
                  </label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={connectApiConfig.password}
                    onChange={e => setConnectApiConfig(prev => ({ ...prev, password: e.target.value }))}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '8px 10px',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      background: 'var(--card)',
                      color: 'var(--text-main)',
                      fontSize: '12.5px',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Customer Code */}
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '5px' }}>
                    Mã khách hàng CMS
                  </label>
                  <input
                    type="text"
                    placeholder={webhookConfig.customerCode || 'VD: T000180585'}
                    value={connectApiConfig.customerCode}
                    onChange={e => setConnectApiConfig(prev => ({ ...prev, customerCode: e.target.value }))}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '8px 10px',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      background: 'var(--card)',
                      color: 'var(--text-main)',
                      fontSize: '12.5px',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Environment */}
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '5px' }}>
                    Môi trường API
                  </label>
                  <select
                    value={connectApiConfig.env}
                    onChange={e => setConnectApiConfig(prev => ({ ...prev, env: e.target.value }))}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '8px 10px',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      background: 'var(--card)',
                      color: 'var(--text-main)',
                      fontSize: '12.5px',
                      outline: 'none'
                    }}
                  >
                    <option value="PRODUCTION">Production (connect-my.vnpost.vn)</option>
                    <option value="UAT">UAT Sandbox (my-uat.vnpost.vn)</option>
                    <option value="CUSTOM">Nhập URL API riêng (Custom Base URL)...</option>
                  </select>
                </div>

                {/* Custom URL field if CUSTOM is selected */}
                {connectApiConfig.env === 'CUSTOM' && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '5px' }}>
                      Địa chỉ Base URL tùy chỉnh của VNPost
                    </label>
                    <input
                      type="text"
                      placeholder="VD: https://my-uat.vnpost.vn/MYVNP_API hoặc URL máy chủ riêng do bưu cục cung cấp"
                      value={connectApiConfig.customUrl || ''}
                      onChange={e => setConnectApiConfig(prev => ({ ...prev, customUrl: e.target.value }))}
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: '8px 10px',
                        border: '1px solid #0284c7',
                        borderRadius: '6px',
                        background: 'var(--card)',
                        color: 'var(--text-main)',
                        fontSize: '12.5px',
                        outline: 'none'
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Firewall IP Whitelisting notice */}
              <div style={{
                background: '#fffbeb',
                border: '1px solid #fef3c7',
                borderRadius: '6px',
                padding: '9px 12px',
                marginBottom: '14px',
                fontSize: '11.5px',
                color: '#92400e',
                lineHeight: '1.5'
              }}>
                <span style={{ fontWeight: 700 }}>⚠️ Lưu ý về kết nối API: </span>
                Cổng <code>https://connect-my.vnpost.vn</code> áp dụng tường lửa kiểm duyệt IP tĩnh (Firewall IP Whitelisting). Nếu mạng của bạn chưa đăng ký mở IP với VNPost, kết nối sẽ gặp lỗi (<code>Failed to fetch / Connection Reset</code>). Shop nên sử dụng <strong>Phương án 1 (Đồng bộ qua Tab Web ở trên)</strong> để đồng bộ tự động dễ dàng nhất.
              </div>

              {/* Action test button */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <button
                  type="button"
                  disabled={isTestingConnectApi}
                  onClick={handleConnectApiTest}
                  style={{
                    background: '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    fontWeight: 700,
                    fontSize: '12.5px',
                    cursor: isTestingConnectApi ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {isTestingConnectApi ? <RefreshCw size={13} className="spin" /> : <Key size={13} />}
                  <span>{isTestingConnectApi ? 'Đang kiểm tra...' : '🔑 Kiểm Tra Kết Nối & Lấy Token'}</span>
                </button>

                {connectApiStatus.message && (
                  <div style={{
                    fontSize: '12px',
                    color: connectApiStatus.connected ? '#16a34a' : '#dc2626',
                    fontWeight: 600
                  }}>
                    {connectApiStatus.message}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Single Lookup Box (Tra cứu nhanh 1 đơn) */}
            <div style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              padding: '14px 16px'
            }}>
              <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Search size={14} color="#0284c7" />
                <span>TRA CỨU NHANH TỨC THÌ 1 ĐƠN HÀNG QUA API VNPOST:</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Nhập mã vận đơn (ItemCode vd: EM990021692VN) hoặc mã đơn hàng của shop..."
                  value={quickLookupCode}
                  onChange={e => setQuickLookupCode(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSingleQuickLookup(); }}
                  style={{
                    flex: 1,
                    minWidth: '240px',
                    boxSizing: 'border-box',
                    padding: '8px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    background: 'var(--card)',
                    color: 'var(--text-main)',
                    fontSize: '12.5px',
                    outline: 'none'
                  }}
                />
                <button
                  type="button"
                  disabled={isLookingUpSingle}
                  onClick={() => handleSingleQuickLookup()}
                  style={{
                    background: '#0f172a',
                    color: '#ffffff',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    fontWeight: 700,
                    fontSize: '12.5px',
                    cursor: isLookingUpSingle ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {isLookingUpSingle ? <RefreshCw size={13} className="spin" /> : <Search size={13} />}
                  <span>Tra Cứu Ngay</span>
                </button>
              </div>

              {/* Single lookup result card */}
              {singleLookupResult && singleLookupResult.order && (
                <div style={{
                  marginTop: '12px',
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '12px 14px',
                  fontSize: '12.5px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
                    <div style={{ fontWeight: 800, color: '#0f172a' }}>
                      Bưu gửi: <span style={{ color: '#0284c7', fontFamily: 'monospace' }}>{singleLookupResult.order.itemCode}</span>
                      {singleLookupResult.order.saleOrderCode && ` (Mã đơn: ${singleLookupResult.order.saleOrderCode})`}
                    </div>
                    <span style={{
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontWeight: 700,
                      fontSize: '11.5px',
                      background: singleLookupResult.norm.bg,
                      color: singleLookupResult.norm.color,
                      border: `1px solid ${singleLookupResult.norm.border}`
                    }}>
                      {singleLookupResult.norm.statusName}
                    </span>
                  </div>
                  <div style={{ color: '#475569', lineHeight: '1.5' }}>
                    <div>Người nhận: <strong>{singleLookupResult.order.receiverName}</strong> ({singleLookupResult.order.receiverPhone})</div>
                    <div>Địa chỉ: {singleLookupResult.order.receiverAddress}</div>
                    {singleLookupResult.order.totalFee > 0 && <div>Tổng cước: <strong>{Number(singleLookupResult.order.totalFee).toLocaleString('vi-VN')} đ</strong> - COD: <strong>{Number(singleLookupResult.order.codAmount || 0).toLocaleString('vi-VN')} đ</strong></div>}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════════════ */}
          {/* SECTION: VNPOST REAL-TIME SYNCED DATA TABLE */}
          {/* ══════════════════════════════════════════════════════════════════════ */}
          <div
            className="card"
            style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '24px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
              marginBottom: '24px'
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: '#eff6ff',
                  color: '#2563eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Package size={22} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-main)' }}>
                      Dữ Liệu Đơn Vận Chuyển Đã Đồng Bộ Về Shop
                    </h3>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '999px',
                      fontSize: '11px',
                      fontWeight: 700,
                      background: webhookOrders.length > 0 ? '#dcfce7' : '#f1f5f9',
                      color: webhookOrders.length > 0 ? '#166534' : '#64748b',
                      border: `1px solid ${webhookOrders.length > 0 ? '#bbf7d0' : '#e2e8f0'}`
                    }}>
                      {webhookOrders.length} đơn có dữ liệu
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Danh sách đơn hàng, trạng thái bưu tá quét, cước phí và cân nặng thực tế từ các hãng vận chuyển (VNPost &amp; J&amp;T Express)
                  </div>
                </div>
              </div>

              {/* Controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    placeholder="Tìm mã đơn, mã VĐ, SĐT..."
                    value={webhookSearchQuery}
                    onChange={(e) => setWebhookSearchQuery(e.target.value)}
                    style={{
                      padding: '7px 12px 7px 30px',
                      fontSize: '12px',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      background: 'var(--bg)',
                      color: 'var(--text-main)',
                      outline: 'none',
                      width: '210px'
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => loadWebhookOrders()}
                  disabled={loadingWebhookOrders}
                  style={{
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '7px 12px',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    color: 'var(--text-main)',
                    cursor: loadingWebhookOrders ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  title="Tải lại danh sách đơn hàng đã đồng bộ từ các hãng"
                >
                  <RefreshCw size={13} className={loadingWebhookOrders ? 'spin' : ''} />
                  {loadingWebhookOrders ? 'Đang tải...' : 'Làm mới'}
                </button>
              </div>
            </div>

            {/* Carrier Filter Tabs */}
            {(() => {
              const vnpostCount = webhookOrders.filter(o => detectOrderCarrier(o) === 'vnpost').length;
              const jtCount = webhookOrders.filter(o => detectOrderCarrier(o) === 'jt').length;

              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Lọc theo hãng:</span>
                  <button
                    type="button"
                    onClick={() => setCarrierFilter('all')}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: carrierFilter === 'all' ? '1px solid #2563eb' : '1px solid var(--border)',
                      background: carrierFilter === 'all' ? '#2563eb' : 'var(--bg)',
                      color: carrierFilter === 'all' ? '#ffffff' : 'var(--text-main)',
                      transition: 'all 0.15s'
                    }}
                  >
                    Tất cả ({webhookOrders.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCarrierFilter('vnpost')}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: carrierFilter === 'vnpost' ? '1px solid #eab308' : '1px solid var(--border)',
                      background: carrierFilter === 'vnpost' ? '#fef3c7' : 'var(--bg)',
                      color: carrierFilter === 'vnpost' ? '#b45309' : 'var(--text-main)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.15s'
                    }}
                  >
                    <span>🟡 Vietnam Post</span>
                    <span style={{
                      background: carrierFilter === 'vnpost' ? '#b45309' : '#e2e8f0',
                      color: carrierFilter === 'vnpost' ? '#ffffff' : '#475569',
                      borderRadius: '999px',
                      padding: '1px 6px',
                      fontSize: '10.5px'
                    }}>
                      {vnpostCount}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCarrierFilter('jt')}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: carrierFilter === 'jt' ? '1px solid #ef4444' : '1px solid var(--border)',
                      background: carrierFilter === 'jt' ? '#fee2e2' : 'var(--bg)',
                      color: carrierFilter === 'jt' ? '#b91c1c' : 'var(--text-main)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.15s'
                    }}
                  >
                    <span>🔴 J&amp;T Express</span>
                    <span style={{
                      background: carrierFilter === 'jt' ? '#b91c1c' : '#e2e8f0',
                      color: carrierFilter === 'jt' ? '#ffffff' : '#475569',
                      borderRadius: '999px',
                      padding: '1px 6px',
                      fontSize: '10.5px'
                    }}>
                      {jtCount}
                    </span>
                  </button>

                  {carrierFilter === 'jt' && (
                    <span style={{
                      fontSize: '11.5px',
                      color: '#b91c1c',
                      background: '#fef2f2',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: '1px solid #fecaca',
                      marginLeft: 'auto'
                    }}>
                      💡 Đơn J&amp;T Express: Bấm "Tra cứu J&amp;T ↗" để mở trang định vị của hãng. Kết nối API tự động sẽ có ở bản cập nhật tới.
                    </span>
                  )}
                </div>
              );
            })()}

            {/* Table */}
            {loadingWebhookOrders ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <RefreshCw size={22} className="spin" style={{ margin: '0 auto 8px' }} />
                <div style={{ fontSize: '13px' }}>Đang nạp dữ liệu vận chuyển đã đồng bộ...</div>
              </div>
            ) : webhookOrders.length === 0 ? (
              <div style={{
                padding: '36px 20px',
                textAlign: 'center',
                background: 'var(--bg)',
                borderRadius: '10px',
                border: '1px dashed var(--border)'
              }}>
                <Package size={32} color="var(--text-muted)" style={{ margin: '0 auto 10px', opacity: 0.6 }} />
                <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-main)', marginBottom: '4px' }}>
                  Chưa có dữ liệu đơn hàng nào được đồng bộ về
                </div>
                <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', maxWidth: '520px', margin: '0 auto 14px', lineHeight: '1.5' }}>
                  Khi bưu tá các hãng quét bưu phẩm hoặc bạn bấm nút quét đơn cũ qua tab Web, dữ liệu sẽ tự động hiển thị tại bảng này.
                </div>
                <button
                  type="button"
                  onClick={handleOpenTestModal}
                  style={{
                    background: '#2563eb',
                    color: '#fff',
                    border: 'none',
                    padding: '7px 16px',
                    borderRadius: '8px',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Play size={13} fill="#fff" /> Gửi thử nghiệm Webhook ngay
                </button>
              </div>
            ) : (
              <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '10px 14px', color: 'var(--text-muted)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase' }}>Thời gian</th>
                      <th style={{ padding: '10px 14px', color: 'var(--text-muted)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase' }}>Hãng &amp; Mã Vận Đơn</th>
                      <th style={{ padding: '10px 14px', color: 'var(--text-muted)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase' }}>Người Nhận</th>
                      <th style={{ padding: '10px 14px', color: 'var(--text-muted)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase' }}>Trạng Thái Hãng</th>
                      <th style={{ padding: '10px 14px', color: 'var(--text-muted)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase' }}>Cước Thực Tế</th>
                      <th style={{ padding: '10px 14px', color: 'var(--text-muted)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase' }}>Khối Lượng</th>
                      <th style={{ padding: '10px 14px', color: 'var(--text-muted)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', textAlign: 'right' }}>Hành Trình Bưu Tá</th>
                    </tr>
                  </thead>
                  <tbody>
                    {webhookOrders
                      .filter((o) => {
                        const carrier = detectOrderCarrier(o);
                        if (carrierFilter !== 'all' && carrier !== carrierFilter) return false;
                        if (!webhookSearchQuery.trim()) return true;
                        const q = webhookSearchQuery.toLowerCase().trim();
                        return (
                          (o.order_code && o.order_code.toLowerCase().includes(q)) ||
                          (o.tracking_code && o.tracking_code.toLowerCase().includes(q)) ||
                          (o.customer_name && o.customer_name.toLowerCase().includes(q)) ||
                          (o.name && o.name.toLowerCase().includes(q)) ||
                          (o.phone && o.phone.includes(q))
                        );
                      })
                      .map((o, idx) => {
                        const carrierId = detectOrderCarrier(o);
                        const carrierMeta = getCarrierMeta(carrierId);
                        const statusMeta = getDeliveryStatusMeta(o.status);
                        const logs = Array.isArray(o.webhook_logs) ? o.webhook_logs : [];
                        const trackingUrl = o.tracking_code ? getCarrierTrackingUrl(carrierId, o.tracking_code) : null;

                        return (
                          <tr key={o.id || idx} style={{ borderBottom: '1px solid var(--border)', background: idx % 2 === 0 ? 'var(--card)' : 'var(--bg)' }}>
                            {/* Thời gian */}
                            <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                              <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{formatDate(o.updated_at || o.submitted_at)}</div>
                            </td>

                            {/* Hãng & Mã Vận Đơn */}
                            <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                  {/* Carrier Badge */}
                                  <span style={{
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                    fontSize: '10px',
                                    fontWeight: 800,
                                    background: carrierMeta.badgeBg,
                                    color: carrierMeta.badgeColor,
                                    border: `1px solid ${carrierMeta.badgeBorder}`,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px'
                                  }}>
                                    {carrierMeta.badgeText}
                                  </span>

                                  {o.order_code ? (
                                    <span style={{ fontWeight: 700, background: '#f1f5f9', color: '#1e293b', padding: '1px 6px', borderRadius: '4px', fontSize: '11.5px' }}>
                                      {o.order_code}
                                    </span>
                                  ) : null}
                                </div>

                                {o.tracking_code && o.tracking_code !== '-' && o.tracking_code !== '—' ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span style={{
                                      fontWeight: 800,
                                      color: carrierId === 'jt' ? '#b91c1c' : '#2563eb',
                                      fontFamily: 'monospace',
                                      letterSpacing: '0.5px',
                                      fontSize: '12px'
                                    }}>
                                      {o.tracking_code}
                                    </span>
                                    {trackingUrl && (
                                      <a
                                        href={trackingUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        title={`Tra cứu bưu gửi trên ${carrierMeta.name}`}
                                        style={{ color: carrierId === 'jt' ? '#b91c1c' : '#2563eb', display: 'inline-flex' }}
                                      >
                                        <ExternalLink size={12} />
                                      </a>
                                    )}
                                  </div>
                                ) : (
                                  <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '11px' }}>Chưa có mã vận đơn</span>
                                )}
                              </div>
                            </td>

                            {/* Người nhận */}
                            <td style={{ padding: '10px 14px' }}>
                              <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{o.customer_name || o.name || '—'}</div>
                              {o.phone ? <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>{o.phone}</div> : null}
                            </td>

                            {/* Trạng thái Hãng */}
                            <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                              <span style={{
                                background: statusMeta.bg,
                                color: statusMeta.color,
                                border: `1px solid ${statusMeta.border}`,
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontWeight: 700,
                                fontSize: '11.5px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}>
                                <Activity size={12} /> {statusMeta.label}
                              </span>
                            </td>

                            {/* Cước thực tế */}
                            <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', fontWeight: 600, color: o.shipping_fee > 0 ? '#0f172a' : 'var(--text-muted)' }}>
                              {o.shipping_fee > 0 ? `${Number(o.shipping_fee).toLocaleString('vi-VN')} đ` : '—'}
                            </td>

                            {/* Khối lượng */}
                            <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', color: o.actual_weight > 0 ? '#0f172a' : 'var(--text-muted)' }}>
                              {o.actual_weight > 0 ? `${o.actual_weight} g` : '—'}
                            </td>

                            {/* Hành trình & Tra cứu */}
                            <td style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                {carrierId === 'vnpost' ? (
                                  <button
                                    type="button"
                                    onClick={() => handleSingleQuickLookup(o.tracking_code || o.order_code, 'vnpost')}
                                    disabled={isLookingUpSingle}
                                    title="Tra cứu trạng thái mới nhất từ API / Web MyVNPost"
                                    style={{
                                      background: '#ffffff',
                                      border: '1px solid #cbd5e1',
                                      color: '#0284c7',
                                      padding: '4px 8px',
                                      borderRadius: '6px',
                                      fontSize: '11px',
                                      fontWeight: 700,
                                      cursor: isLookingUpSingle ? 'not-allowed' : 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px'
                                    }}
                                  >
                                    <Search size={11} />
                                    Tra cứu API
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleSingleQuickLookup(o.tracking_code || o.order_code, 'jt')}
                                    title="Tra cứu bưu gửi J&amp;T Express (Mở trang tra cứu vận đơn J&amp;T)"
                                    style={{
                                      background: '#fff5f5',
                                      border: '1px solid #fecaca',
                                      color: '#dc2626',
                                      padding: '4px 8px',
                                      borderRadius: '6px',
                                      fontSize: '11px',
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px'
                                    }}
                                  >
                                    <ExternalLink size={11} />
                                    Tra cứu J&amp;T ↗
                                  </button>
                                )}
                                {logs.length > 0 ? (
                                  <button
                                    type="button"
                                    onClick={() => setSelectedJourneyLog(o)}
                                    style={{
                                      background: '#eff6ff',
                                      border: '1px solid #bfdbfe',
                                      color: '#2563eb',
                                      padding: '4px 10px',
                                      borderRadius: '6px',
                                      fontSize: '11.5px',
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '5px'
                                    }}
                                  >
                                    <History size={12} />
                                    Xem mốc quét ({logs.length})
                                  </button>
                                ) : (
                                  <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Chờ bưu tá quét</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* JOURNEY LOG MODAL */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {selectedJourneyLog && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '20px'
        }}>
          <div style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '560px',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            overflow: 'hidden'
          }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <History size={18} color="#2563eb" /> Lịch Sử Bưu Tá VNPost Quét Đơn
                </h3>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Mã đơn: <b>{selectedJourneyLog.order_code || '—'}</b> | Mã vận đơn: <b style={{ color: '#2563eb' }}>{selectedJourneyLog.tracking_code || '—'}</b>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedJourneyLog(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '6px', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
              {(() => {
                const logs = Array.isArray(selectedJourneyLog.webhook_logs) ? selectedJourneyLog.webhook_logs : [];
                if (logs.length === 0) {
                  return <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '13px' }}>Chưa có dữ liệu hành trình webhook cho đơn này.</div>;
                }
                return (
                  <div style={{ position: 'relative', paddingLeft: '24px', borderLeft: '2px solid #e2e8f0', marginLeft: '10px' }}>
                    {logs.map((log, lIdx) => (
                      <div key={lIdx} style={{ position: 'relative', marginBottom: '20px' }}>
                        <div style={{
                          position: 'absolute',
                          left: '-31px',
                          top: '2px',
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          background: lIdx === logs.length - 1 ? '#16a34a' : '#2563eb',
                          border: '2px solid #ffffff',
                          boxShadow: '0 0 0 2px rgba(37, 99, 235, 0.2)'
                        }} />
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
                          {formatDate(log.statusDate || log.date || log.time || log.created_at || log.timestamp || log.receivedAt)}
                        </div>
                        <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px' }}>
                          {log.statusName || log.statusDesc || log.status_desc || log.status || 'Cập nhật trạng thái'}
                        </div>
                        {(log.location || log.postman || log.note || log.totalFee || log.weight) && (
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', background: 'var(--bg)', padding: '6px 10px', borderRadius: '6px' }}>
                            {log.location && <div>📍 Vị trí: <b>{log.location}</b></div>}
                            {log.postman && <div>👤 Bưu tá: {log.postman}</div>}
                            {log.note && <div>📝 Ghi chú: {log.note}</div>}
                            {log.totalFee ? <div>💰 Cước thực tế: <b>{Number(log.totalFee).toLocaleString('vi-VN')} đ</b></div> : null}
                            {log.weight ? <div>⚖️ Khối lượng cân: <b>{log.weight} g</b></div> : null}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', background: 'var(--bg)', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setSelectedJourneyLog(null)}
                style={{ background: '#f1f5f9', border: '1px solid var(--border)', padding: '7px 16px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TEST PING MODAL / DIALOG */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {showTestModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '20px'
        }}>
          <div style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: '14px',
            width: '100%',
            maxWidth: '680px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)',
            padding: '24px',
            boxSizing: 'border-box'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Play size={16} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-main)' }}>
                    🧪 Kiểm Tra Kết Nối Webhook VNPost
                  </h3>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Giả lập gửi payload từ VNPost đến Edge Function để kiểm tra đồng bộ dữ liệu vào Shop
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTestModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Target Endpoint & Token Info Banner */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '10px 14px',
              marginBottom: '14px',
              fontSize: '12px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ color: '#475569', fontWeight: 600 }}>🔑 Token Webhook đang gửi:</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, color: webhookConfig.apiToken ? '#2563eb' : '#dc2626' }}>
                  {webhookConfig.apiToken || '(Chưa có Token)'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#475569', fontWeight: 600 }}>🌐 Đích đến:</span>
                <span style={{ fontSize: '11px', color: '#64748b', wordBreak: 'break-all', maxWidth: '380px' }} title={getWebhookUrl()}>
                  {getWebhookUrl() || 'Chưa xác định'}
                </span>
              </div>
            </div>

            {/* Quick Pick Recent Order */}
            {recentSubmittedOrders.length > 0 && (
              <div style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>🎯 Chọn nhanh 1 đơn có sẵn trong Shop để test cập nhật trạng thái thật:</span>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {recentSubmittedOrders.map(ord => (
                    <button
                      key={ord.id}
                      type="button"
                      onClick={() => handleSelectRecentOrder(ord)}
                      style={{
                        background: (testForm.orderCode === ord.order_code || testForm.itemCode === ord.tracking_code) ? '#dbeafe' : '#ffffff',
                        border: `1px solid ${(testForm.orderCode === ord.order_code || testForm.itemCode === ord.tracking_code) ? '#3b82f6' : '#cbd5e1'}`,
                        color: '#1e293b',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '11.5px',
                        cursor: 'pointer',
                        fontWeight: (testForm.orderCode === ord.order_code || testForm.itemCode === ord.tracking_code) ? 700 : 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}
                    >
                      <span>📦 {ord.order_code || ord.tracking_code || ord.name}</span>
                      <span style={{ fontSize: '10.5px', color: '#64748b' }}>({ord.status || 'submitted'})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Form Inputs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
                  Mã đơn hàng (OrderCode)
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: E90.242..."
                  value={testForm.orderCode}
                  onChange={e => setTestForm(prev => ({ ...prev, orderCode: e.target.value }))}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', background: 'var(--card)', color: 'var(--text-main)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
                  Mã vận đơn VNPost (ItemCode)
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: EA123456789VN..."
                  value={testForm.itemCode}
                  onChange={e => setTestForm(prev => ({ ...prev, itemCode: e.target.value }))}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', background: 'var(--card)', color: 'var(--text-main)' }}
                />
              </div>
            </div>

            {/* Status Presets */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                Trạng thái VNPost (StatusCode):
              </label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {[
                  { code: '90', name: 'Phát thành công' },
                  { code: '70', name: 'Đang giao hàng' },
                  { code: '80', name: 'Đang trung chuyển' },
                  { code: '100', name: 'Chuyển hoàn' },
                  { code: '50', name: 'Đã gom hàng' }
                ].map(st => (
                  <button
                    key={st.code}
                    type="button"
                    onClick={() => handleStatusPresetChange(st.code)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: testForm.statusCode === st.code ? 700 : 500,
                      background: testForm.statusCode === st.code ? '#2563eb' : 'var(--bg)',
                      color: testForm.statusCode === st.code ? '#ffffff' : 'var(--text-main)',
                      border: '1px solid var(--border)',
                      cursor: 'pointer'
                    }}
                  >
                    {st.code} - {st.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Fee & Weight */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '18px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
                  Cước phí thực tế (TotalFee - VNĐ)
                </label>
                <input
                  type="number"
                  value={testForm.totalFee}
                  onChange={e => setTestForm(prev => ({ ...prev, totalFee: e.target.value }))}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', background: 'var(--card)', color: 'var(--text-main)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
                  Khối lượng thực tế (Weight - Gram)
                </label>
                <input
                  type="number"
                  value={testForm.weight}
                  onChange={e => setTestForm(prev => ({ ...prev, weight: e.target.value }))}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', background: 'var(--card)', color: 'var(--text-main)' }}
                />
              </div>
            </div>

            {/* Submit Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '16px' }}>
              <button
                type="button"
                onClick={() => setShowTestModal(false)}
                style={{
                  padding: '9px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: 'var(--card)',
                  color: 'var(--text-main)',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={handleTestPing}
                disabled={testingPing || !webhookConfig.apiToken}
                style={{
                  padding: '9px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#2563eb',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: (testingPing || !webhookConfig.apiToken) ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 6px rgba(37, 99, 235, 0.3)'
                }}
              >
                {testingPing ? <RefreshCw size={14} className="spin" /> : <Send size={14} />}
                {testingPing ? 'Đang gửi Webhook...' : '🚀 Gửi Webhook Giả Lập'}
              </button>
            </div>

            {/* Test Result Display Box */}
            {testResult && (
              <div style={{
                background: testResult.ok ? '#f0fdf4' : (testResult.isNotFound ? '#eff6ff' : '#fef2f2'),
                border: `1px solid ${testResult.ok ? '#86efac' : (testResult.isNotFound ? '#93c5fd' : '#fca5a5')}`,
                borderRadius: '10px',
                padding: '14px',
                fontSize: '13px'
              }}>
                <div style={{
                  fontWeight: 800,
                  color: testResult.ok ? '#15803d' : (testResult.isNotFound ? '#1d4ed8' : '#b91c1c'),
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginBottom: '6px'
                }}>
                  {testResult.ok ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                  <span>{testResult.ok ? '✅ Kết quả: Thành công (HTTP 200)' : `HTTP Status: ${testResult.status}`}</span>
                </div>
                <div style={{ color: '#334155', lineHeight: '1.5' }}>
                  {testResult.message}
                </div>
                {testResult.tip && (
                  <div style={{ marginTop: '8px', fontSize: '12px', background: '#ffffff', padding: '8px 10px', borderRadius: '6px', border: '1px solid #bfdbfe', color: '#1e40af' }}>
                    💡 <strong>Gợi ý:</strong> {testResult.tip}
                  </div>
                )}
                {testResult.status === 403 && (
                  <div style={{ marginTop: '12px', background: '#ffffff', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ fontSize: '12.5px', color: '#991b1b', fontWeight: 600 }}>
                      ⚠️ Token chưa được lưu hoặc chưa đồng bộ lên Cloud của Shop.
                    </div>
                    <button
                      type="button"
                      disabled={isSavingWebhook || testingPing}
                      onClick={async () => {
                        try {
                          await handleSaveWebhook(false);
                          await handleTestPing();
                        } catch (_) {}
                      }}
                      style={{
                        background: '#dc2626',
                        color: '#ffffff',
                        border: 'none',
                        padding: '6px 14px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      {isSavingWebhook ? <RefreshCw size={12} className="spin" /> : <Sparkles size={12} />}
                      Lưu Token & Thử Lại Ngay
                    </button>
                  </div>
                )}
                {testResult.data && (
                  <pre style={{
                    marginTop: '10px',
                    background: '#0f172a',
                    color: '#38bdf8',
                    padding: '10px',
                    borderRadius: '6px',
                    fontSize: '11.5px',
                    overflowX: 'auto',
                    margin: '10px 0 0 0'
                  }}>
                    {JSON.stringify(testResult.data, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      {/* Modal Cảnh báo xác nhận khi muốn Mở khóa / Đổi Token Bảo Mật */}
      {showConfirmTokenModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(3px)',
          zIndex: 999999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div style={{
            background: 'var(--bg-card, #ffffff)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '520px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid var(--border, #e2e8f0)',
            overflow: 'hidden'
          }}>
            <div style={{
              background: '#fef2f2',
              borderBottom: '1px solid #fecaca',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  background: '#fee2e2',
                  padding: '8px',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <AlertTriangle size={22} color="#dc2626" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#991b1b' }}>
                    Xác Nhận Thay Đổi Token Bảo Mật
                  </h3>
                  <div style={{ fontSize: '12px', color: '#b91c1c' }}>
                    Cảnh báo ảnh hưởng đồng bộ đơn hàng tự động
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmTokenModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '20px', fontSize: '13px', color: '#334155', lineHeight: '1.6' }}>
              <p style={{ margin: '0 0 10px 0' }}>
                Mã Token hiện tại của Shop là:
              </p>
              <div style={{
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                padding: '10px 14px',
                borderRadius: '8px',
                fontFamily: 'monospace',
                fontWeight: 700,
                color: '#0f172a',
                fontSize: '13.5px',
                marginBottom: '14px',
                wordBreak: 'break-all'
              }}>
                {originalToken || webhookConfig.apiToken || '(Chưa có mã)'}
              </div>

              <div style={{
                background: '#fffbeb',
                border: '1px solid #fef3c7',
                borderRadius: '8px',
                padding: '12px 14px',
                marginBottom: '16px',
                fontSize: '12.5px',
                color: '#92400e'
              }}>
                <div style={{ fontWeight: 700, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ShieldAlert size={15} color="#d97706" />
                  RỦI RO NẾU THAY ĐỔI TOKEN:
                </div>
                <ul style={{ margin: '4px 0 0 0', paddingLeft: '18px', lineHeight: '1.5' }}>
                  <li>Token này <strong>đang được cài đặt trên cổng My VNPost</strong> để gửi trạng thái đơn hàng về Shop.</li>
                  <li>Nếu bạn đổi mã mới, VNPost gửi tin qua mã cũ sẽ <strong>BỊ TỪ CHỐI</strong> (Lỗi 403 Forbidden).</li>
                  <li>Bạn <strong>bắt buộc phải đăng nhập lại cổng my.vnpost.vn</strong> (tất cả các tài khoản của Shop) để dán lại đường link / Token mới.</li>
                </ul>
              </div>

              <p style={{ margin: 0, fontSize: '12.5px', color: '#64748b' }}>
                Nếu bạn chỉ vô tình bấm vào hoặc không có ý định cấu hình lại toàn bộ tài khoản VNPost, hãy chọn <strong>"Giữ nguyên Token cũ"</strong>.
              </p>
            </div>

            <div style={{
              background: '#f8fafc',
              borderTop: '1px solid #e2e8f0',
              padding: '14px 20px',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px'
            }}>
              <button
                type="button"
                onClick={() => setShowConfirmTokenModal(false)}
                style={{
                  background: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  padding: '9px 18px',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                }}
              >
                🛡️ Giữ nguyên Token cũ (An toàn)
              </button>

              <button
                type="button"
                onClick={handleConfirmUnlock}
                style={{
                  background: '#ffffff',
                  color: '#dc2626',
                  border: '1px solid #fca5a5',
                  padding: '9px 16px',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '12.5px',
                  cursor: 'pointer'
                }}
              >
                Tôi hiểu rủi ro, Mở khóa đổi mã
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nhắc nhở cập nhật lên My VNPost sau khi đổi Token thành công */}
      {showPostSaveReminderModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(3px)',
          zIndex: 999999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div style={{
            background: 'var(--bg-card, #ffffff)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '540px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid var(--border, #e2e8f0)',
            overflow: 'hidden'
          }}>
            <div style={{
              background: '#eff6ff',
              borderBottom: '1px solid #bfdbfe',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  background: '#dbeafe',
                  padding: '8px',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <CheckCircle2 size={22} color="#2563eb" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#1e40af' }}>
                    Đã Lưu Token Mới Thành Công!
                  </h3>
                  <div style={{ fontSize: '12px', color: '#3b82f6' }}>
                    Bước quan trọng: Cập nhật đường link lên My VNPost
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPostSaveReminderModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1e40af' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '20px', fontSize: '13px', color: '#334155', lineHeight: '1.6' }}>
              <p style={{ margin: '0 0 10px 0' }}>
                Shop của bạn vừa đổi sang mã Token mới: <strong>{webhookConfig.apiToken}</strong>.
              </p>
              <p style={{ margin: '0 0 14px 0', color: '#dc2626', fontWeight: 600 }}>
                ⚠️ Lưu ý: Các tài khoản VNPost sẽ KHÔNG THỂ gửi đơn hàng về cho tới khi bạn cập nhật đường link Webhook mới này vào trang My VNPost!
              </p>

              <div style={{
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                padding: '12px',
                borderRadius: '8px',
                marginBottom: '16px'
              }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>
                  ĐƯỜNG LINK WEBHOOK MỚI CỦA SHOP:
                </div>
                <div style={{
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  color: '#0f172a',
                  wordBreak: 'break-all',
                  marginBottom: '8px'
                }}>
                  {getWebhookUrl()}
                </div>
                <button
                  type="button"
                  onClick={handleCopyWebhookUrl}
                  style={{
                    background: copiedWebhook ? '#dcfce7' : '#0284c7',
                    color: copiedWebhook ? '#166534' : '#ffffff',
                    border: 'none',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontWeight: 700,
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  {copiedWebhook ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copiedWebhook ? 'Đã sao chép link' : 'Sao chép link Webhook mới'}</span>
                </button>
              </div>

              <div style={{ fontSize: '12.5px', color: '#64748b' }}>
                👉 Hãy mở trang <a href="https://my.vnpost.vn" target="_blank" rel="noreferrer" style={{ color: '#0284c7', fontWeight: 600 }}>my.vnpost.vn</a>, vào mục Cài đặt Webhook và dán đè đường link mới này.
              </div>
            </div>

            <div style={{
              background: '#f8fafc',
              borderTop: '1px solid #e2e8f0',
              padding: '14px 20px',
              display: 'flex',
              justifyContent: 'flex-end'
            }}>
              <button
                type="button"
                onClick={() => setShowPostSaveReminderModal(false)}
                style={{
                  background: '#0f172a',
                  color: '#ffffff',
                  border: 'none',
                  padding: '8px 20px',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Đã hiểu & Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
