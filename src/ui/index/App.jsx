import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AuthSession } from '../../domain/auth/auth.session.esm.js';
import { AuthService } from '../../domain/auth/auth.service.esm.js';
import { OrderStorage } from '../../application/storage.esm.js';
import { OrderProcessor } from '../../application/order-parser/parser.esm.js';
import Login from '../options/pages/Auth/Login.jsx';
import {
  Zap, Package, RefreshCw, Search, Phone, MapPin,
  CheckCircle2, Clock, AlertTriangle, ExternalLink,
  Shield, LogOut, Settings, Copy, Check, Truck,
  FileText, User, ArrowUpRight, DollarSign, Sparkles,
  AlertCircle
} from 'lucide-react';
import { copyToClipboard } from './clipboard.js';
import QuickCopyPanel from './components/QuickCopyPanel.jsx';
import {
  buildQuickCopyFields,
  formatFullOrderCopy,
  getNextCopyIndex
} from './quick-copy.js';
import {
  loadQuickCopyProgress,
  saveQuickCopyProgress,
  clearQuickCopyProgress
} from './quick-copy.persistence.js';

const normalizePhone = value => String(value || '').replace(/\D/g, '');
const normalizeCode = value => String(value || '').trim().toLowerCase();
const normalizeTracking = value => normalizeCode(value).replace(/\s+/g, '');

const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });
const num = new Intl.NumberFormat('vi-VN');

const CARRIERS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'vnpost', label: 'VNPost' },
  { key: 'jt', label: 'J&T Express' },
  { key: 'submitted', label: 'Đã gửi' },
  { key: 'draft', label: 'Nháp' }
];

const submittedIdentityKey = order => {
  const tracking = normalizeTracking(order.tracking_code || order.trackingCode);
  if (tracking && tracking !== '-' && tracking !== '—') return `tracking:${tracking}`;

  const savedId = normalizeCode(order.saved_order_id || order.savedOrderId);
  if (savedId) return `saved:${savedId}`;

  const orderCode = normalizeCode(order.order_code || order.orderCode);
  const phone = normalizePhone(order.phone);
  if (orderCode && phone) return `order:${phone}:${orderCode}`;

  const id = normalizeCode(order.id);
  return id ? `id:${id}` : null;
};

const hasSubmittedCustomer = order => {
  const name = normalizeCode(order.name || order.customer_name);
  const phone = normalizePhone(order.phone);
  return (name && name !== '-' && name !== '—' && name.length >= 2) || phone.length >= 9;
};

const dedupeSubmittedRows = rows => {
  const seen = new Set();
  return (rows || []).filter(row => {
    if (!row) return false;
    if (!hasSubmittedCustomer(row)) return false;
    const key = submittedIdentityKey(row);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

function BottomNavButton({ active, onClick, icon: Icon, label, badgeCount }) {
  return (
    <button
      onClick={onClick}
      className={`nav-tab-btn ${active ? 'active' : ''}`}
    >
      <div className="nav-tab-icon-wrap">
        <Icon size={18} />
      </div>
      <span>{label} {typeof badgeCount === 'number' ? `(${badgeCount})` : ''}</span>
    </button>
  );
}

function OrderCard({ order, copiedKey, onCopy }) {
  const phone = normalizePhone(order.phone);
  const isJt = order.carrier === 'J&T';

  return (
    <div className="order-card pwa-card" style={{ padding: '14px', display: 'grid', gap: '8px' }}>
      {/* Header Row: Customer Name, Phone Actions, Status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: '14.5px', color: 'var(--text-main)' }}>
            {order.name}
          </div>
          {phone && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
              <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '13px' }}>
                {phone}
              </span>
              <a
                href={phone ? `tel:${phone}` : undefined}
                className="phone-action-btn"
                title="Gọi điện thoại"
              >
                <Phone size={11} color="#16a34a" /> Gọi
              </a>
              <button
                onClick={() => onCopy(phone, `p_${order.id}`, 'SĐT')}
                className="phone-action-btn"
                title="Sao chép số điện thoại"
              >
                <Copy size={11} /> Chép SĐT
              </button>
            </div>
          )}
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 800, fontSize: '15px', color: '#16a34a' }}>
            {money.format(order.value || 0)}
          </div>
          <span style={{
            fontSize: '10.5px',
            fontWeight: 800,
            padding: '2px 7px',
            borderRadius: '4px',
            display: 'inline-block',
            marginTop: '2px',
            background: order.tag === 'Đã gửi' ? '#dcfce7' : '#f1f5f9',
            color: order.tag === 'Đã gửi' ? '#15803d' : '#475569'
          }}>
            {order.tag === 'Đã gửi' ? 'Đã gửi bưu điện' : 'Đơn nháp'}
          </span>
        </div>
      </div>

      {/* Address Row */}
      {order.address && (
        <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: '1.45', display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
          <MapPin size={13} color="var(--text-subtle)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>{order.address}</span>
        </div>
      )}

      {/* TRACKING CODE HIGHLIGHT BOX */}
      {order.trackingCode ? (
        <div className="tracking-card tracking-highlight-box">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <span className={`carrier-badge ${isJt ? 'carrier-jt' : 'carrier-vnpost'}`}>
              {order.carrier}
            </span>
            <code className="tracking-code-text">
              {order.trackingCode}
            </code>
          </div>

          <button
            onClick={() => onCopy(order.trackingCode, `track_${order.id}`, 'mã vận đơn')}
            className="copy-btn-touch"
            style={{ background: copiedKey === `track_${order.id}` ? 'var(--success)' : 'var(--primary)' }}
          >
            {copiedKey === `track_${order.id}` ? (
              <>
                <Check size={13} />
                <span>Đã chép</span>
              </>
            ) : (
              <>
                <Copy size={13} />
                <span>Sao chép mã</span>
              </>
            )}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: 'var(--text-subtle)', fontStyle: 'italic' }}>
          <span className={`carrier-badge ${isJt ? 'carrier-jt' : 'carrier-vnpost'}`}>
            {order.carrier}
          </span>
          <span>Đơn nháp (Chưa lên mã vận đơn)</span>
        </div>
      )}

      {/* Date Time */}
      <div style={{ fontSize: '11px', color: 'var(--text-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
        <span>Mã đơn: {order.orderCode || '—'}</span>
        <span>{order.date ? new Date(order.date).toLocaleString('vi-VN') : ''}</span>
      </div>
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTabState] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('tab') || 'dashboard';
    } catch (_) {
      return 'dashboard';
    }
  });

  const setActiveTab = (tab) => {
    setActiveTabState(tab);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      window.history.replaceState(null, '', url.toString());
    } catch (_) {}
  };

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  // Parser & Quick Copy state (QC-04, QC-06, QC-08)
  const [parseText, setParseText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parsedResult, setParsedResult] = useState(null);
  const [copiedKey, setCopiedKey] = useState('');
  const [quickCopyCarrier, setQuickCopyCarrier] = useState('jt');
  const [copiedKeys, setCopiedKeys] = useState(new Set());

  // Tải lại tiến độ Quick Copy trong vòng 24 giờ nếu có (QC-08)
  useEffect(() => {
    try {
      const saved = loadQuickCopyProgress();
      if (saved && saved.parsedResult) {
        setParsedResult(saved.parsedResult);
        setQuickCopyCarrier(saved.carrier || 'jt');
        setCopiedKeys(saved.copiedKeys || new Set());
      }
    } catch (_) {}
  }, []);

  // Tự động lưu tiến độ vào localStorage khi có thay đổi (QC-08)
  useEffect(() => {
    if (parsedResult) {
      saveQuickCopyProgress({
        parsedResult,
        carrier: quickCopyCarrier,
        copiedKeys,
        currentIndex: 0
      });
    }
  }, [parsedResult, quickCopyCarrier, copiedKeys]);

  // Orders and stats
  const [orders, setOrders] = useState([]);
  const [orderStats, setOrderStats] = useState({
    orders_today: 0,
    cod_today: 0,
    submitted_today: 0,
    drafts: 0,
    orders_total: 0
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [carrierFilter, setCarrierFilter] = useState('all');
  const [cloudError, setCloudError] = useState('');

  // Current user & active shop
  const [currentUser, setCurrentUser] = useState(null);
  const [activeShopName, setActiveShopName] = useState('Cửa hàng của tôi');
  const [toastMsg, setToastMsg] = useState({ text: '', type: '' });

  const showToast = (text, type = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg({ text: '', type: '' }), 2500);
  };

  const openAdminDashboard = () => {
    const isExtension = typeof chrome !== 'undefined' && chrome.runtime && typeof chrome.runtime.getURL === 'function';
    if (isExtension) {
      window.location.assign(chrome.runtime.getURL('admin.html'));
    } else {
      window.location.assign('/admin');
    }
  };

  const routeAdminTarget = () => {
    const isExtension = typeof chrome !== 'undefined' && chrome.runtime && typeof chrome.runtime.getURL === 'function';
    const target = isExtension ? chrome.runtime.getURL('admin.html') : '/admin.html';
    window.location.replace(target);
  };

  const openShopControl = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.openOptionsPage) {
      chrome.runtime.openOptionsPage();
      return;
    }
    window.location.assign('/options');
  };

  const canOpenAdminDashboard = () => {
    const role = String(currentUser?.role || '').toUpperCase();
    const email = String(currentUser?.email || '').toLowerCase();
    const adminRoles = ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'MASTER_ADMIN', 'ADMIN', 'SUPPORT_ADMIN', 'FINANCE_ADMIN', 'CONTENT_ADMIN'];
    return adminRoles.includes(role) || role.endsWith('_ADMIN') || role.includes('ADMIN') || email === 'admin@luathuysinh.vn' || email.startsWith('admin@');
  };

  const isMasterAdmin = canOpenAdminDashboard;

  // Load live data from Supabase
  const loadAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const sess = await AuthSession.getSession();
      let config = null;
      try { config = await globalThis.SupabaseCloud.loadConfig(); } catch (_) {}

      if (!sess?.access_token || sess.access_token.startsWith('local_dev_token_') || !config) {
        setIsAuthenticated(false);
        return;
      }

      const userObj = {
        id: sess.user?.id || 'AF-USER',
        full_name: sess.user?.full_name || sess.user?.user_metadata?.full_name || sess.full_name || 'Người dùng',
        email: sess.user?.email || sess.email || '',
        phone: sess.user?.phone || sess.phone || '',
        role: sess.role || 'SHOP_STAFF'
      };

      const isSysAdmin = await AuthService.isSystemAdmin();
      const role = String(userObj.role || '').toUpperCase();
      const email = String(userObj.email || '').toLowerCase();
      const adminRoles = ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'MASTER_ADMIN', 'ADMIN', 'SUPPORT_ADMIN', 'FINANCE_ADMIN', 'CONTENT_ADMIN'];
      const isAdminRole = adminRoles.includes(role) || role.endsWith('_ADMIN') || role.includes('ADMIN') || email === 'admin@luathuysinh.vn' || email.startsWith('admin@');
      
      // Nếu user chủ động mở workspace (ví dụ đường dẫn là /workspace hoặc có search params /?workspace=true hoặc đang thao tác trên Mobile), không cưỡng ép redirect sang Admin
      const isExplicitWorkspace = typeof window !== 'undefined' && (
        window.location.pathname.includes('/workspace') ||
        window.location.search.includes('workspace=true') ||
        window.location.search.includes('tab=') ||
        sessionStorage.getItem('stay_in_workspace') === 'true'
      );
      if ((isAdminRole || isSysAdmin) && !isExplicitWorkspace) {
        routeAdminTarget();
        return;
      }

      setCurrentUser(userObj);

      const headers = { 'apikey': config.anonKey, 'Authorization': `Bearer ${sess.access_token}` };

      // Shop Name (Chỉ query UUID hợp lệ để không bị 400 Bad Request từ PostgREST)
      const isValidShopUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(sess.active_shop_id || ''));
      if (sess.active_shop_id && isValidShopUuid) {
        try {
          const shopRes = await fetch(`${config.url}/rest/v1/shops?select=name&id=eq.${sess.active_shop_id}`, { headers });
          if (shopRes.ok) {
            const dbShops = await shopRes.json();
            if (dbShops?.[0]?.name) {
              setActiveShopName(dbShops[0].name);
            }
          }
        } catch (_) {}
      } else if (sess.shop_name) {
        setActiveShopName(sess.shop_name);
      }

      // Load Orders & Submitted from both local storage and cloud
      const localSubmitted = typeof OrderStorage !== 'undefined' ? await OrderStorage.getSubmittedOrders().catch(() => []) : [];
      const shopFilter = (sess.active_shop_id && isValidShopUuid) ? `shop_id=eq.${sess.active_shop_id}&` : '';
      const [ordersRes, subRes] = await Promise.all([
        fetch(`${config.url}/rest/v1/orders?${shopFilter}deleted_at=is.null&order=created_at.desc&limit=100`, { headers }).catch(e => ({ ok: false, error: e })),
        fetch(`${config.url}/rest/v1/submitted_orders?${shopFilter}order=submitted_at.desc&limit=1000&select=*`, { headers }).catch(e => ({ ok: false, error: e }))
      ]);

      if (!subRes.ok) {
        setCloudError('Không thể đồng bộ danh sách đơn từ Supabase Cloud. Đang hiển thị bản lưu tạm offline.');
      } else {
        setCloudError('');
      }

      const draftOrders = ordersRes.ok ? await ordersRes.json() : [];
      const cloudSubmitted = subRes.ok ? await subRes.json() : [];

      const submittedRows = [
        ...(Array.isArray(localSubmitted) ? localSubmitted : []),
        ...(Array.isArray(cloudSubmitted) ? cloudSubmitted : [])
      ];
      const submitted = dedupeSubmittedRows(submittedRows);

      const seenSubmittedKeys = new Set();
      (Array.isArray(submitted) ? submitted : []).forEach(s => {
        const id = String(s.id || '').trim();
        const savedId = String(s.saved_order_id || s.savedOrderId || '').trim();
        const tracking = String(s.tracking_code || s.trackingCode || '').trim().toLowerCase();
        const orderCode = String(s.order_code || s.orderCode || '').trim().toLowerCase();
        const phone = normalizePhone(s.phone);

        if (id) seenSubmittedKeys.add('id_' + id);
        if (savedId && savedId !== '—' && savedId !== '-') seenSubmittedKeys.add('id_' + savedId);
        if (tracking && tracking !== '—' && tracking !== '-' && tracking !== 'chờ cập nhật mã') {
          seenSubmittedKeys.add('tr_' + tracking);
        }
        if (phone && phone.length >= 9 && orderCode && orderCode !== '—' && orderCode !== '-') {
          seenSubmittedKeys.add('oc_' + phone + '_' + orderCode);
        }
      });

      const activeDraftOrders = (Array.isArray(draftOrders) ? draftOrders : []).filter(o => {
        if (!o) return false;
        const s = String(o.status || '').toLowerCase();
        if (s.includes('submitted')) return false;
        const id = String(o.id || '').trim();
        const phone = normalizePhone(o.phone);
        if (id && seenSubmittedKeys.has('id_' + id)) return false;
        const orderCode = String(o.order_code || o.orderCode || '').trim().toLowerCase();
        if (phone && orderCode && seenSubmittedKeys.has('oc_' + phone + '_' + orderCode)) return false;
        return true;
      });

      let totalCod = 0;
      const list = [
        ...(Array.isArray(submitted) ? submitted : []).map(s => {
          const val = Number(s.cod_amount ?? s.codAmount) || 0;
          totalCod += val;
          const rawCarrier = String(s.platform || 'VNPOST').toUpperCase();
          const carrier = rawCarrier.includes('J&T') || rawCarrier.includes('JT') ? 'J&T' : 'VNPOST';

          return {
            id: s.id || submittedIdentityKey(s),
            name: s.name || s.customer_name || s.customerName || 'Khách hàng',
            phone: normalizePhone(s.phone),
            address: s.address || '',
            orderCode: s.order_code || s.orderCode || '',
            trackingCode: s.tracking_code || s.trackingCode || '',
            carrier: carrier,
            status: s.status || 'submitted',
            value: val,
            date: s.submitted_at || s.submittedAt || s.submittedDate || s.created_at || s.createdAt,
            tag: 'Đã gửi'
          };
        }),
        ...(Array.isArray(activeDraftOrders) ? activeDraftOrders : []).map(o => {
          const rawCarrier = String(o.platform || 'VNPOST').toUpperCase();
          const carrier = rawCarrier.includes('J&T') || rawCarrier.includes('JT') ? 'J&T' : 'VNPOST';

          return {
            id: o.id,
            name: o.name || o.customer_name || 'Đơn nháp',
            phone: normalizePhone(o.phone),
            address: o.address || '',
            orderCode: o.order_code || '',
            trackingCode: '',
            carrier: carrier,
            status: 'draft',
            value: Number(o.cod_amount) || 0,
            date: o.created_at,
            tag: 'Nháp'
          };
        })
      ];

      list.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
      setOrders(list);

      setOrderStats({
        orders_today: (Array.isArray(submitted) ? submitted : []).length,
        cod_today: totalCod,
        submitted_today: (Array.isArray(submitted) ? submitted : []).length,
        drafts: activeDraftOrders.length,
        orders_total: list.length
      });

    } catch (err) {
      console.warn('Lỗi tải dữ liệu Index Workspace:', err);
      setCloudError(err.message || 'Không thể kết nối Supabase Cloud.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      let isAuth = false;
      try {
        isAuth = await AuthService.isAuthenticated();
        setIsAuthenticated(isAuth);
        if (isAuth) {
          await loadAll();
        }
      } catch (err) {
        setIsAuthenticated(false);
      } finally {
        setIsAuthLoading(false);
        if (!isAuth) setIsLoading(false);
      }
    };
    initAuth();
  }, [loadAll]);

  // Standard Order Parser
  const handleParse = (e) => {
    if (e) e.preventDefault();
    if (!parseText.trim()) return;
    setIsParsing(true);
    try {
      const result = OrderProcessor.parse(parseText);
      setParsedResult(result);
      setCopiedKeys(new Set());
      showToast('Bóc tách thông tin thành công');
    } catch (err) {
      console.error('Lỗi bóc tách:', err);
      showToast('Không thể bóc tách nội dung', 'error');
    } finally {
      setIsParsing(false);
    }
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setParseText(text);
        showToast('Đã dán nội dung từ bộ nhớ tạm');
      }
    } catch (err) {
      showToast('Không thể truy cập bộ nhớ tạm', 'error');
    }
  };

  // Save Draft
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const handleSaveDraft = async () => {
    if (!parsedResult) return;
    setIsSavingDraft(true);
    try {
      const sess = await AuthSession.getSession?.().catch(() => null);
      const activeShopId = sess?.active_shop_id || '';
      const orderData = {
        name: parsedResult.name || '',
        phone: parsedResult.phone || '',
        address: parsedResult.address || '',
        orderCode: parsedResult.orderCode || '',
        codAmount: Number(parsedResult.codAmount) || 0,
        productItem: parsedResult.productItem || '',
        extraNote: parsedResult.extraNote || '',
        collectFee: parsedResult.collectFee || false,
        platform: 'vnpost',
        status: 'draft',
        shopId: activeShopId
      };

      // 1. Lưu local qua OrderStorage (có offline-fallback & deduplication theo orderCode)
      let savedOrder = orderData;
      if (typeof OrderStorage !== 'undefined' && typeof OrderStorage.saveOrder === 'function') {
        savedOrder = await OrderStorage.saveOrder(orderData);
      }

      // 2. Đồng bộ trực tiếp lên Supabase Cloud table `orders` nếu có phiên đăng nhập Shop
      try {
        let config = null;
        try { config = await globalThis.SupabaseCloud?.loadConfig?.(); } catch (_) {}
        if (config?.url && sess?.access_token && sess?.active_shop_id) {
          const isValidShopUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(sess.active_shop_id));
          if (isValidShopUuid) {
            const cloudPayload = {
              id: savedOrder?.id || ('ord_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)),
              shop_id: sess.active_shop_id,
              name: orderData.name,
              phone: orderData.phone,
              address: orderData.address,
              order_code: orderData.orderCode,
              cod_amount: orderData.codAmount,
              platform: 'vnpost',
              status: 'draft'
            };
            await fetch(`${config.url}/rest/v1/orders`, {
              method: 'POST',
              headers: {
                'apikey': config.anonKey,
                'Authorization': `Bearer ${sess.access_token}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation,resolution=merge-duplicates'
              },
              body: JSON.stringify([cloudPayload])
            });
          }
        }
      } catch (cloudErr) {
        console.warn('Lỗi push đơn nháp lên Supabase Cloud:', cloudErr);
      }

      // 3. Thông báo đa kênh (Real-time Broadcast)
      try {
        if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
          chrome.runtime.sendMessage({ action: 'draftOrdersUpdated' }).catch(() => {});
        }
      } catch (_) {}
      try {
        localStorage.setItem('draft_queue_updated_at', String(Date.now()));
        window.dispatchEvent(new CustomEvent('draft-queue-updated'));
      } catch (_) {}

      showToast('Đã lưu đơn nháp và đồng bộ lên hệ thống');
      await loadAll();
      setActiveTab('orders');
    } catch (err) {
      console.error('Lỗi lưu đơn nháp:', err);
      showToast('Lỗi: ' + err.message, 'error');
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Quick Copy Clipboard Adapter & Handlers (QC-03, QC-05, QC-06)
  const copyText = async (text, keyName, label = 'mã') => {
    if (!text) return false;
    const ok = await copyToClipboard(String(text).trim());
    if (ok) {
      setCopiedKey(keyName);
      setTimeout(() => setCopiedKey(''), 2000);
      setCopiedKeys(prev => {
        const next = new Set(prev);
        if (keyName) next.add(keyName);
        return next;
      });
      showToast(`Đã sao chép ${label}: ${text}`);
      return true;
    } else {
      showToast('Không thể tự động sao chép. Vui lòng chọn và chép thủ công.', 'error');
      return false;
    }
  };

  const handleCopyField = async (field) => {
    if (!field) return;
    await copyText(field.value, field.key, field.label);
  };

  const handleCopyNext = async () => {
    if (!parsedResult) return;
    const fields = buildQuickCopyFields(parsedResult, quickCopyCarrier);
    const nextIdx = getNextCopyIndex(fields, copiedKeys);
    if (nextIdx >= 0) {
      const field = fields[nextIdx];
      await copyText(field.value, field.key, field.label);
    } else if (fields.length > 0) {
      // Đã copy hết tất cả, reset lại tiến độ và copy trường đầu tiên
      setCopiedKeys(new Set());
      const firstField = fields[0];
      await copyText(firstField.value, firstField.key, firstField.label);
    }
  };

  const handleCopyAll = async () => {
    if (!parsedResult) return;
    const allText = formatFullOrderCopy(parsedResult);
    const ok = await copyToClipboard(allText);
    if (ok) {
      const fields = buildQuickCopyFields(parsedResult, quickCopyCarrier);
      setCopiedKeys(new Set(fields.map(f => f.key)));
      showToast('Đã chép toàn bộ thông tin đơn hàng');
    } else {
      showToast('Không thể sao chép toàn bộ đơn hàng', 'error');
    }
  };

  const handleResetQuickCopy = () => {
    clearQuickCopyProgress();
    setParsedResult(null);
    setParseText('');
    setCopiedKeys(new Set());
    showToast('Đã làm mới dữ liệu');
  };

  const handleCarrierChange = (newCarrier) => {
    setQuickCopyCarrier(newCarrier);
    setCopiedKeys(new Set());
  };

  const handleParsedResultChange = (updated) => {
    setParsedResult(updated);
  };

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      if (carrierFilter === 'vnpost' && o.carrier !== 'VNPOST') return false;
      if (carrierFilter === 'jt' && o.carrier !== 'J&T') return false;
      if (carrierFilter === 'submitted' && o.tag !== 'Đã gửi') return false;
      if (carrierFilter === 'draft' && o.tag !== 'Nháp') return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (o.name || '').toLowerCase().includes(q) ||
             (o.phone || '').includes(q) ||
             (o.orderCode || '').toLowerCase().includes(q) ||
             (o.trackingCode || '').toLowerCase().includes(q);
    });
  }, [orders, carrierFilter, searchQuery]);

  const counts = useMemo(() => ({
    all: orders.length,
    vnpost: orders.filter(o => o.carrier === 'VNPOST').length,
    jt: orders.filter(o => o.carrier === 'J&T').length,
    submitted: orders.filter(o => o.tag === 'Đã gửi').length,
    draft: orders.filter(o => o.tag === 'Nháp').length,
  }), [orders]);

  if (isAuthLoading || isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg-main)' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }} className="spin-anim">⏳</div>
          <div style={{ fontWeight: 700, fontSize: '15px' }}>Đang tải Mobile Workspace...</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onLoginSuccess={async () => {
      setIsAuthLoading(true);
      const sess = await AuthSession.getSession();
      const isExplicitWorkspace = typeof window !== 'undefined' && (
        window.location.pathname.includes('/workspace') ||
        window.location.search.includes('workspace=true') ||
        window.location.search.includes('tab=') ||
        sessionStorage.getItem('stay_in_workspace') === 'true'
      );
      if ((canOpenAdminDashboard() || await AuthService.isSystemAdmin()) && !isExplicitWorkspace) {
        routeAdminTarget();
        return;
      }
      setIsAuthenticated(true);
      await loadAll();
      setIsAuthLoading(false);
    }} />;
  }

  return (
    <div className="mobile-app-shell">

      {/* Floating Toast */}
      {toastMsg.text && (
        <div style={{
          position: 'fixed',
          top: 'calc(16px + env(safe-area-inset-top, 0px))',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          background: toastMsg.type === 'error' ? '#ef4444' : '#0f172a',
          color: '#ffffff',
          padding: '10px 20px',
          borderRadius: '999px',
          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.25)',
          fontSize: '13px',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          whiteSpace: 'nowrap',
          maxWidth: '90vw'
        }}>
          {toastMsg.text}
        </div>
      )}

      {/* App Bar Header */}
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="brand-badge">
            AF
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '14.5px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>{activeShopName}</span>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} />
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
              Auto Fill Mobile Workspace
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button
            onClick={loadAll}
            style={{
              background: 'var(--bg-main)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '6px 10px',
              fontSize: '12px',
              cursor: 'pointer',
              fontWeight: 700,
              color: 'var(--text-main)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title="Đồng bộ lại dữ liệu"
          >
            <RefreshCw size={13} className={isLoading ? 'spin-anim' : ''} />
            <span>Đồng bộ</span>
          </button>

          <button
            onClick={openShopControl}
            style={{
              background: 'var(--primary-light)',
              border: '1px solid var(--primary-border)',
              borderRadius: '8px',
              padding: '6px 10px',
              fontSize: '12px',
              cursor: 'pointer',
              fontWeight: 700,
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title="Mở cài đặt cửa hàng (Options)"
          >
            <Settings size={13} />
            <span style={{ fontSize: '11px', display: 'none' }}>Shop</span>
          </button>

          {canOpenAdminDashboard() && (
            <button
              onClick={openAdminDashboard}
              style={{
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '8px',
                padding: '6px 10px',
                fontSize: '12px',
                cursor: 'pointer',
                fontWeight: 700,
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              title="Mở Bảng điều khiển Master Admin"
            >
              <Shield size={13} />
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className={`app-content ${activeTab === 'parse' && parsedResult ? 'has-sticky-bar' : ''}`}>

        {/* ========================================================================= */}
        {/* TAB 1: DASHBOARD                                                          */}
        {/* ========================================================================= */}
        {activeTab === 'dashboard' && (
          <div style={{ display: 'grid', gap: '14px' }}>

            {/* ERROR ALERT BANNER */}
            {cloudError && (
              <div style={{
                background: '#fef2f2',
                border: '1px solid #f87171',
                borderRadius: '10px',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#b91c1c', fontSize: '12px', fontWeight: 600 }}>
                  <AlertCircle size={16} color="#dc2626" style={{ flexShrink: 0 }} />
                  <span>{cloudError}</span>
                </div>
                <button
                  type="button"
                  onClick={loadAll}
                  style={{
                    background: '#dc2626',
                    color: '#fff',
                    border: 'none',
                    padding: '5px 10px',
                    borderRadius: '6px',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    flexShrink: 0
                  }}
                >
                  <RefreshCw size={11} className={isLoading ? 'spin' : ''} /> Thử lại
                </button>
              </div>
            )}

            {/* Hero Summary Card */}
            <div style={{
              background: 'linear-gradient(135deg, #4f46e5 0%, #312e81 100%)',
              color: '#ffffff',
              padding: '20px 18px',
              borderRadius: '16px',
              boxShadow: '0 8px 20px -4px rgba(79, 70, 229, 0.35)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    ĐƠN GỬI HÔM NAY • {activeShopName}
                  </div>
                  <div style={{ fontSize: '34px', fontWeight: 800, margin: '4px 0 8px 0', letterSpacing: '-0.5px' }}>
                    {num.format(orderStats.orders_today)} <span style={{ fontSize: '16px', fontWeight: 600, opacity: 0.9 }}>đơn đã gửi</span>
                  </div>
                </div>
                <span style={{
                  background: 'rgba(16, 185, 129, 0.25)',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  color: '#6ee7b7',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 800
                }}>
                  Trực tiếp
                </span>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
                borderTop: '1px solid rgba(255, 255, 255, 0.18)',
                paddingTop: '12px',
                marginTop: '4px'
              }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.75)' }}>Tổng Thu Hộ COD:</div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#34d399', marginTop: '2px' }}>
                    {money.format(orderStats.cod_today)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.75)' }}>Đơn Nháp Chờ Gửi:</div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#fbbf24', marginTop: '2px' }}>
                    {orderStats.drafts} đơn nháp
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Action Tiles */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                onClick={() => setActiveTab('parse')}
                className="touch-action-btn"
                style={{
                  background: '#10b981',
                  color: '#ffffff',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)'
                }}
              >
                <Zap size={18} />
                <span>BÓC TÁCH TIN NHẮN</span>
              </button>

              <button
                onClick={() => setActiveTab('orders')}
                className="touch-action-btn"
                style={{
                  background: '#4f46e5',
                  color: '#ffffff',
                  boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)'
                }}
              >
                <Package size={18} />
                <span>TRA CỨU VẬN ĐƠN</span>
              </button>
            </div>

            {/* Recent Orders Preview */}
            <div className="pwa-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h4 style={{ margin: 0, fontSize: '14.5px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Truck size={16} color="var(--primary)" />
                  Đơn Hàng Gần Nhất
                </h4>
                <button
                  onClick={() => setActiveTab('orders')}
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}
                >
                  Xem tất cả ({orders.length}) →
                </button>
              </div>

              <div style={{ display: 'grid', gap: '10px' }}>
                {orders.slice(0, 5).map(o => (
                  <OrderCard
                    key={o.id}
                    order={o}
                    copiedKey={copiedKey}
                    onCopy={copyText}
                  />
                ))}
              </div>
            </div>

          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: PARSE (BÓC TÁCH TIN NHẮN)                                          */}
        {/* ========================================================================= */}
        {activeTab === 'parse' && (
          <div style={{ display: 'grid', gap: '14px' }}>

            <div className="pwa-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Zap size={18} color="var(--success)" />
                  Bóc Tách Tin Nhắn Đặt Hàng
                </h3>
                <button
                  onClick={handlePasteClipboard}
                  style={{
                    background: 'var(--bg-main)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '5px 10px',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: 'var(--text-main)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Copy size={12} />
                  <span>Dán tin nhắn</span>
                </button>
              </div>

              <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '0 0 12px 0' }}>
                Dán nội dung chat từ Zalo, Facebook Messenger hoặc SMS để bóc tách tự động:
              </p>

              <form onSubmit={handleParse} style={{ display: 'grid', gap: '10px' }}>
                <textarea
                  rows={5}
                  value={parseText}
                  onChange={e => setParseText(e.target.value)}
                  placeholder="Dán tin nhắn vào đây...&#10;VD: Anh Tuấn 0912345678, số 123 đường Lê Lợi, Phường Bến Thành, Quận 1, HCM. Thu hộ 350k nhé."
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '10px',
                    border: '1.5px solid var(--border)',
                    fontSize: '13.5px',
                    fontFamily: 'inherit',
                    outline: 'none',
                    background: 'var(--bg-card)',
                    color: 'var(--text-main)'
                  }}
                />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => { setParseText(''); setParsedResult(null); }}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '12.5px', cursor: 'pointer' }}
                  >
                    Xóa nội dung
                  </button>

                  <button
                    type="submit"
                    disabled={isParsing || !parseText.trim()}
                    className="touch-action-btn"
                    style={{
                      padding: '0 20px',
                      background: 'var(--success)',
                      color: '#ffffff',
                      cursor: isParsing || !parseText.trim() ? 'not-allowed' : 'pointer',
                      boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
                    }}
                  >
                    <Zap size={15} />
                    <span>{isParsing ? 'Đang bóc tách...' : 'Bóc Tách Ngay'}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Parsed Result & Quick Copy Panel (QC-04, QC-05, QC-06) */}
            {parsedResult && (
              <QuickCopyPanel
                value={parsedResult}
                carrier={quickCopyCarrier}
                copiedKeys={copiedKeys}
                onCarrierChange={handleCarrierChange}
                onChange={handleParsedResultChange}
                onCopyField={handleCopyField}
                onCopyNext={handleCopyNext}
                onCopyAll={handleCopyAll}
                onReset={handleResetQuickCopy}
                onSaveDraft={handleSaveDraft}
                isSavingDraft={isSavingDraft}
              />
            )}

          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: ORDERS (DANH SÁCH & TRA CỨU VẬN ĐƠN)                              */}
        {/* ========================================================================= */}
        {activeTab === 'orders' && (
          <div style={{ display: 'grid', gap: '12px' }}>

            {/* Search Bar */}
            <div style={{ position: 'relative' }}>
              <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Tìm theo Mã vận đơn, Tên khách, SĐT..."
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 36px',
                  borderRadius: '10px',
                  border: '1.5px solid var(--border)',
                  fontSize: '16px',
                  outline: 'none',
                  background: 'var(--bg-card)',
                  color: 'var(--text-main)',
                  touchAction: 'manipulation'
                }}
              />
            </div>

            {/* ERROR ALERT BANNER */}
            {cloudError && (
              <div style={{
                background: '#fef2f2',
                border: '1px solid #f87171',
                borderRadius: '10px',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#b91c1c', fontSize: '12px', fontWeight: 600 }}>
                  <AlertCircle size={16} color="#dc2626" style={{ flexShrink: 0 }} />
                  <span>{cloudError}</span>
                </div>
                <button
                  type="button"
                  onClick={loadAll}
                  style={{
                    background: '#dc2626',
                    color: '#fff',
                    border: 'none',
                    padding: '5px 10px',
                    borderRadius: '6px',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    flexShrink: 0
                  }}
                >
                  <RefreshCw size={11} className={isLoading ? 'spin' : ''} /> Thử lại
                </button>
              </div>
            )}

            {/* Filter Pills Row */}
            <div className="filter-pills-row">
              {CARRIERS.map(c => (
                <button
                  key={c.key}
                  onClick={() => setCarrierFilter(c.key)}
                  className={`filter-pill-btn ${carrierFilter === c.key ? 'active' : ''}`}
                >
                  {c.label} ({typeof counts[c.key] === 'number' ? counts[c.key] : counts.all})
                </button>
              ))}
            </div>

            {/* Orders List */}
            <div style={{ display: 'grid', gap: '10px' }}>
              {filteredOrders.length === 0 ? (
                <div className="pwa-card" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                  <Package size={32} color="var(--border)" style={{ margin: '0 auto 8px' }} />
                  <div>Không tìm thấy đơn hàng nào phù hợp.</div>
                </div>
              ) : (
                filteredOrders.map(o => (
                  <OrderCard
                    key={o.id}
                    order={o}
                    copiedKey={copiedKey}
                    onCopy={copyText}
                  />
                ))
              )}
            </div>

          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: ACCOUNT (TÀI KHOẢN & SHOP)                                         */}
        {/* ========================================================================= */}
        {activeTab === 'account' && (
          <div style={{ display: 'grid', gap: '14px' }}>

            <div className="pwa-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #4f46e5 0%, #312e81 100%)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '20px',
                  boxShadow: '0 4px 10px rgba(79,70,229,0.3)'
                }}>
                  {currentUser?.full_name?.charAt(0) || 'U'}
                </div>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)' }}>
                    {currentUser?.full_name}
                  </div>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {currentUser?.email}
                  </div>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: 'var(--primary-light)',
                    color: 'var(--primary)',
                    display: 'inline-block',
                    marginTop: '4px'
                  }}>
                    Vai trò: {currentUser?.role}
                  </span>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '14px', marginTop: '14px' }}>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  Cửa hàng đang hoạt động: <strong style={{ color: 'var(--text-main)' }}>{activeShopName}</strong>
                </div>
              </div>
            </div>

            {/* Quick Links */}
            <div className="pwa-card" style={{ display: 'grid', gap: '8px' }}>
              <button
                onClick={openShopControl}
                className="touch-action-btn"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '0 14px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-main)',
                  fontSize: '13.5px',
                  color: 'var(--text-main)'
                }}
              >
                <span>Cổng Quản Lý Cửa Hàng (Shop Options)</span>
                <ExternalLink size={15} color="var(--text-muted)" />
              </button>

              {canOpenAdminDashboard() && (
                <button
                  onClick={openAdminDashboard}
                  className="touch-action-btn"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '0 14px',
                    border: '1px solid #bfdbfe',
                    background: '#eff6ff',
                    fontSize: '13.5px',
                    color: '#1d4ed8',
                    fontWeight: 700
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Shield size={16} color="#2563eb" />
                    <span>Quản Trị Hệ Thống (Master Admin)</span>
                  </span>
                  <ExternalLink size={15} color="#2563eb" />
                </button>
              )}

              <button
                onClick={async () => {
                  if (window.confirm('Bạn có chắc chắn muốn đăng xuất khỏi máy trạm này?')) {
                    await AuthService.logout();
                    setIsAuthenticated(false);
                  }
                }}
                className="touch-action-btn"
                style={{
                  background: 'var(--danger-light)',
                  color: 'var(--danger)',
                  marginTop: '4px'
                }}
              >
                <LogOut size={15} />
                <span>Đăng Xuất Tài Khoản</span>
              </button>
            </div>

          </div>
        )}

      </main>

      {/* Fixed Bottom Navigation (Thumb Zone) */}
      <nav className="mobile-nav" aria-label="Điều hướng chính">
        <BottomNavButton
          active={activeTab === 'dashboard'}
          onClick={() => setActiveTab('dashboard')}
          icon={Sparkles}
          label="Tổng quan"
        />

        <BottomNavButton
          active={activeTab === 'parse'}
          onClick={() => setActiveTab('parse')}
          icon={Zap}
          label="Bóc tách"
        />

        <BottomNavButton
          active={activeTab === 'orders'}
          onClick={() => setActiveTab('orders')}
          icon={Package}
          label="Vận đơn"
          badgeCount={counts.all}
        />

        <BottomNavButton
          active={activeTab === 'account'}
          onClick={() => setActiveTab('account')}
          icon={User}
          label="Tài khoản"
        />
      </nav>

    </div>
  );
}
