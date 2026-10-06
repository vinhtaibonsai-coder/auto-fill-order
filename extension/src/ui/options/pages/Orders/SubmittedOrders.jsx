import React, { useEffect, useMemo, useState } from 'react';
import {
  Package, Search, Calendar, Filter, Download, Copy,
  Check, ExternalLink, RefreshCw, Truck, DollarSign,
  User, Phone, Clock, FileSpreadsheet, AlertCircle, Cloud, HardDrive,
  History, Activity, CheckCircle2, AlertTriangle, X, UploadCloud,
  ChevronDown, ChevronRight, Monitor, FileText, MapPin,
  LayoutList, Table2
} from 'lucide-react';
import { OrderStorage } from '../../../../application/storage.esm.js';
import { AuthSession } from '../../../../domain/auth/auth.session.esm.js';
import Pagination from '../../components/Pagination';
import OrderTimelineDrawer from '../../components/OrderTimelineDrawer';

const removeVietnameseTones = (str) => {
  if (!str) return '';
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
};

const normalizePhone = (value) => String(value || '').replace(/\D/g, '');

const valueOf = (order, ...keys) => {
  for (const key of keys) {
    const value = order?.[key] ?? order?.parsedData?.[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return '';
};

const formatDate = (value) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const relativeTime = (iso) => {
  if (!iso) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'vừa xong';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} phút trước`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} giờ trước`;
  return `${Math.floor(seconds / 86400)} ngày trước`;
};

const normalizeCarrierValue = (value) => {
  if (!value) return '';
  if (typeof value === 'object') {
    return normalizeCarrierValue(
      value.id || value.ID || value.code || value.carrier_id || value.carrierId ||
      value.title || value.TITLE || value.name || value.label || ''
    );
  }
  const raw = String(value).trim();
  if (!raw) return '';
  if (raw.startsWith('{')) {
    try {
      return normalizeCarrierValue(JSON.parse(raw));
    } catch (_) {}
  }
  return raw;
};

const carrierLabel = (value) => {
  const raw = normalizeCarrierValue(value);
  const v = raw.toLowerCase().replace(/\s+/g, '');
  if (!v) return '-';
  if (v.includes('vnpost') || v.includes('vietnampost') || v.includes('buudien')) return 'VNPost';
  if (v === 'jt' || v.includes('j&t') || v.includes('jtexpress')) return 'J&T Express';
  if (v.includes('viettel')) return 'Viettel Post';
  if (v.includes('ghtk') || v.includes('giaohangtietkiem')) return 'GHTK';
  return raw;
};

const getCarrierTrackingUrl = (platform, trackingCode) => {
  if (!trackingCode || trackingCode === '-' || trackingCode === '—') return null;
  const p = String(platform || '').toLowerCase();
  if (p.includes('jt') || p.includes('j&t')) {
    return `https://jtexpress.vn/vi/tracking?billcode=${encodeURIComponent(trackingCode)}`;
  }
  if (p.includes('viettel')) {
    return `https://viettelpost.vn/tra-cuu-hanh-trinh-don/?order=${encodeURIComponent(trackingCode)}`;
  }
  if (p.includes('ghtk')) {
    return `https://khachhang.ghtk.vn/tra-cuu-don-hang?code=${encodeURIComponent(trackingCode)}`;
  }
  return `http://www.vnpost.vn/vi-vn/dinh-vi/buu-pham?key=${encodeURIComponent(trackingCode)}`;
};

const isRecipientPayingFee = (order) => {
  const payerValue = valueOf(order, 'shipping_fee_payer', 'collect_fee', 'collectFee', 'shippingFeePayer');
  if (payerValue === true || payerValue === 'true' || payerValue === 1 || payerValue === '1') return true;
  const payer = String(payerValue || '').toUpperCase();
  if (payer === 'RECIPIENT' || payer === 'BUYER' || payer === 'KHÁCH' || payer === 'NGƯỜI NHẬN') return true;
  return false;
};

const getCarrierAccount = (order) => {
  const acc = valueOf(order, 'carrierAccount', 'carrier_account', 'senderAccount', 'sender_account');
  if (acc && acc !== '-' && acc !== '—') return acc;

  const rawName = valueOf(order, 'name', 'customer_name', 'customerName');
  const match = String(rawName).match(/\((?:acc|tài khoản|tk)?\s*([^\)]+)\)/i);
  if (match && match[1]) return match[1].trim();

  const user = valueOf(order, 'userName', 'userEmail', 'deviceName');
  if (user && user !== '-' && user !== '—') return user;

  return 'Mặc định';
};

const getCleanCustomerName = (order) => {
  const raw = valueOf(order, 'name', 'customer_name', 'customerName') || '-';
  return raw.replace(/\s*\([^\)]*\)\s*/g, ' ').trim() || raw;
};

const getStorageSource = (order) => order?.isCloud === true ? 'cloud' : 'local';

const getDeliveryStatusMeta = (status) => {
  const s = String(status || 'submitted').toLowerCase();
  switch (s) {
    case 'delivered':
    case '90':
      return { label: 'Phát hàng thành công', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' };
    case 'delivery_failed':
      return { label: 'Phát không thành công', color: '#ea580c', bg: '#fff7ed', border: '#ffedd5' };
    case 'out_for_delivery':
    case '80':
      return { label: 'Đang phát hàng', color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe' };
    case 'delivering':
    case '70':
      return { label: 'Đang vận chuyển', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' };
    case 'returned':
    case '100':
      return { label: 'Chuyển hoàn', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' };
    case 'processing':
    case 'accepted':
    case '50':
      return { label: 'Nhận hàng', color: '#d97706', bg: '#fffbeb', border: '#fde68a' };
    case 'pending_pickup':
    case 'pending':
    case '1':
      return { label: 'Chờ lấy hàng', color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' };
    case 'created':
    case 'submitted':
    case '0':
      return { label: 'Tạo đơn', color: '#8b5cf6', bg: '#f5f3ff', border: '#ddd6fe' };
    case 'cancelled':
    case 'canceled':
      return { label: 'Đã hủy', color: '#94a3b8', bg: '#f1f5f9', border: '#cbd5e1' };
    case 'reconciled':
      return { label: 'Đối soát', color: '#0284c7', bg: '#f0f9ff', border: '#bae6fd' };
    default:
      return { label: status || 'Chưa cập nhật', color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' };
  }
};

export default function SubmittedOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(() => (typeof window !== 'undefined' && window.__af_global_search) || '');
  const [datePreset, setDatePreset] = useState('all'); // all, today, yesterday, 7days, thisMonth, lastMonth, custom
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [carrierFilter, setCarrierFilter] = useState('all'); // all, vnpost, jt
  const [feeFilter, setFeeFilter] = useState('all'); // all, recipient, sender
  const [statusFilter, setStatusFilter] = useState('all'); // all, has_tracking, no_tracking
  const [deliveryFilter, setDeliveryFilter] = useState('all'); // all, delivering, delivered, returned, processing, submitted
  const [selectedJourneyOrder, setSelectedJourneyOrder] = useState(null);
  const [selectedTimelineOrder, setSelectedTimelineOrder] = useState(null);
  const [copiedId, setCopiedId] = useState('');
  const [error, setError] = useState('');
  const [syncingOrderId, setSyncingOrderId] = useState('');
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState('');
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [viewMode, setViewMode] = useState(() => {
    try {
      const saved = localStorage.getItem('af_orders_view_mode');
      if (saved === 'table' || saved === 'cards') return saved;
      return typeof window !== 'undefined' && window.innerWidth <= 768 ? 'cards' : 'table';
    } catch (_) {
      return typeof window !== 'undefined' && window.innerWidth <= 768 ? 'cards' : 'table';
    }
  });

  const handleSetViewMode = (mode) => {
    setViewMode(mode);
    try {
      localStorage.setItem('af_orders_view_mode', mode);
    } catch (_) {}
  };

  const unsyncedCount = useMemo(() => {
    return (orders || []).filter(o => o && o.isCloud === false).length;
  }, [orders]);
  
  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Reset to page 1 whenever search or filters change
  useEffect(() => {
    setPage(1);
  }, [search, datePreset, carrierFilter, feeFilter, statusFilter, deliveryFilter, customStart, customEnd]);

  const loadOrders = async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setError('');
    }
    try {
      const activeShop = typeof OrderStorage !== 'undefined' ? await OrderStorage.getActiveShop().catch(() => null) : null;
      const sess = typeof AuthSession !== 'undefined' ? await AuthSession.getSession().catch(() => null) : null;
      const targetShopId = activeShop ? String(activeShop.id || activeShop) : (sess?.active_shop_id ? String(sess.active_shop_id) : null);

      let rows = [];
      let cloudLoaded = false;

      // 1. Ưu tiên gọi qua SupabaseCloud.fetchSubmittedOrders (đã tối ưu hóa cho cả JWT & PIN Device Session)
      if (typeof globalThis.SupabaseCloud !== 'undefined' && typeof globalThis.SupabaseCloud.fetchSubmittedOrders === 'function') {
        try {
          rows = await globalThis.SupabaseCloud.fetchSubmittedOrders(targetShopId);
          cloudLoaded = true;
        } catch (scErr) {
          console.warn('[SubmittedOrders] SupabaseCloud.fetchSubmittedOrders failed, trying direct fetch:', scErr);
        }
      }

      // Fallback: fetch trực tiếp nếu SupabaseCloud chưa sẵn sàng
      if (!cloudLoaded) {
        const config = typeof globalThis.SupabaseCloud !== 'undefined' ? await globalThis.SupabaseCloud.loadConfig().catch(() => null) : null;

        if (config?.url && config?.anonKey) {
          const isJwt = typeof sess?.access_token === 'string' && sess.access_token.split('.').length === 3;
          const headers = {
            'apikey': config.anonKey,
            'Authorization': `Bearer ${isJwt ? sess.access_token : config.anonKey}`,
            'Content-Type': 'application/json'
          };
          const base = `${String(config.url).replace(/\/$/, '')}/rest/v1/`;
          const shopFilter = targetShopId ? `shop_id=eq.${encodeURIComponent(targetShopId)}&` : '';

          const res = await fetch(`${base}submitted_orders?${shopFilter}order=submitted_at.desc&limit=1000&select=*`, { headers });
          if (res.ok) {
            rows = await res.json();
            cloudLoaded = true;
          } else {
            const errText = await res.text().catch(() => '');
            let msg = `HTTP ${res.status}: ${res.statusText}`;
            try {
              const errObj = JSON.parse(errText);
              msg = errObj.message || errObj.hint || msg;
            } catch (_) {}
            throw new Error(`Không thể tải dữ liệu đơn từ Supabase Cloud (${msg})`);
          }
        }
      }

      let cloudData = (Array.isArray(rows) ? rows : []).map(o => {
        const codVal = Number(
          o.codAmount !== undefined ? o.codAmount :
          (o.cod_amount !== undefined ? o.cod_amount :
          (o.cod !== undefined ? o.cod :
          (o.tien_thu_ho !== undefined ? o.tien_thu_ho : 0)))
        ) || 0;
        const isFeePaidByRecipient = o.collectFee === true || o.collect_fee === true || o.shipping_fee_payer === 'RECIPIENT';
        return {
          isCloud: true,
          id: o.id,
          shopId: o.shop_id || o.shopId || targetShopId,
          shop_id: o.shop_id || o.shopId || targetShopId,
          savedOrderId: o.saved_order_id || o.savedOrderId || '',
          name: o.name || o.customer_name || '',
          phone: o.phone || '',
          address: o.address || '',
          orderCode: o.order_code || o.orderCode || '',
          order_code: o.order_code || o.orderCode || '',
          codAmount: codVal,
          cod_amount: codVal,
          collectFee: isFeePaidByRecipient,
          collect_fee: isFeePaidByRecipient,
          platform: o.platform || '',
          trackingCode: o.tracking_code || o.trackingCode || '',
          tracking_code: o.tracking_code || o.trackingCode || '',
          submittedAt: o.submitted_at || o.submittedAt || '',
          submitted_at: o.submitted_at || o.submittedAt || '',
          submittedDate: o.submitted_date || o.submittedDate || '',
          submitted_date: o.submitted_date || o.submittedDate || '',
          deviceName: o.device_name || o.deviceName || '',
          carrierAccount: o.carrier_account || o.carrierAccount || '',
          carrier_account: o.carrier_account || o.carrierAccount || '',
          productNote: o.product_note || o.productNote || '',
          product_note: o.product_note || o.productNote || '',
          weight: Number(o.weight) || 0,
          status: o.status || 'submitted',
          shippingFee: Number(o.shippingFee !== undefined ? o.shippingFee : (o.shipping_fee || 0)) || 0,
          shipping_fee: Number(o.shippingFee !== undefined ? o.shippingFee : (o.shipping_fee || 0)) || 0,
          actualWeight: Number(o.actualWeight !== undefined ? o.actualWeight : (o.actual_weight || 0)) || 0,
          actual_weight: Number(o.actualWeight !== undefined ? o.actualWeight : (o.actual_weight || 0)) || 0,
          webhookLogs: Array.isArray(o.webhookLogs || o.webhook_logs) ? (o.webhookLogs || o.webhook_logs) : (typeof (o.webhookLogs || o.webhook_logs) === 'string' ? JSON.parse(o.webhookLogs || o.webhook_logs || '[]') : []),
          webhook_logs: Array.isArray(o.webhookLogs || o.webhook_logs) ? (o.webhookLogs || o.webhook_logs) : (typeof (o.webhookLogs || o.webhook_logs) === 'string' ? JSON.parse(o.webhookLogs || o.webhook_logs || '[]') : []),
          updatedAt: o.updatedAt || o.updated_at || '',
          updated_at: o.updatedAt || o.updated_at || ''
        };
      });

      // 2. Lấy dữ liệu lưu tạm ở local (fallback hoặc đơn vừa lưu ở extension offline)
      let localOrders = [];
      try {
        if (typeof OrderStorage !== 'undefined' && typeof OrderStorage.getSubmittedOrders === 'function') {
          localOrders = await OrderStorage.getSubmittedOrders();
        }
      } catch (localErr) {
        console.warn('[SubmittedOrders] Local fetch error:', localErr);
      }

      // 3. Kết hợp và khử trùng lặp (Dedup) giữa Cloud và Local
      const combined = [
        ...cloudData,
        ...(Array.isArray(localOrders) ? localOrders.map(l => ({ ...l, isCloud: false })) : [])
      ];

      const targetFilterShop = targetShopId ? combined.filter(o => {
        if (!o) return false;
        const sId = String(o.shopId || o.shop_id || '');
        return !sId || sId === targetShopId;
      }) : combined;

      const seenKeys = new Set();
      const dedupeList = [];
      targetFilterShop.forEach(o => {
        if (!o) return;
        const keys = [];
        const id = String(o.id || '').trim();
        const savedId = String(o.savedOrderId || o.saved_order_id || '').trim();
        const tracking = String(o.trackingCode || o.tracking_code || '').trim().toLowerCase();
        const orderCode = String(o.orderCode || o.order_code || '').trim().toLowerCase();
        const phone = String(o.phone || '').replace(/\D/g, '');

        if (id) keys.push('id_' + id);
        if (savedId && savedId !== '—' && savedId !== '-') keys.push('id_' + savedId);
        if (tracking && tracking !== '—' && tracking !== '-' && tracking !== 'chờ cập nhật mã') {
          keys.push('tr_' + tracking);
        }
        if (phone && phone.length >= 9 && orderCode && orderCode !== '—' && orderCode !== '-') {
          keys.push('oc_' + phone + '_' + orderCode);
        }

        const isSeen = keys.some(k => seenKeys.has(k));
        if (!isSeen) {
          keys.forEach(k => seenKeys.add(k));
          dedupeList.push(o);
        }
      });

      const sorted = dedupeList.sort((a, b) => {
        const timeA = new Date(valueOf(a, 'submittedAt', 'submitted_at', 'createdAt', 'created_at') || 0).getTime();
        const timeB = new Date(valueOf(b, 'submittedAt', 'submitted_at', 'createdAt', 'created_at') || 0).getTime();
        return timeB - timeA;
      });

      setOrders(sorted);
      if (silent) {
        setError('');
      }

      // Auto-reconciliation: Tự động phát hiện và đồng bộ các đơn "Chỉ lưu Local" lên Cloud trong nền
      const unsynced = sorted.filter(o => o && o.isCloud === false);
      if (unsynced.length > 0 && typeof OrderStorage !== 'undefined' && typeof OrderStorage.syncSubmittedOrdersToCloud === 'function') {
        OrderStorage.syncSubmittedOrdersToCloud().then(res => {
          if (res && res.ok) {
            setOrders(prev => prev.map(o => ({ ...o, isCloud: true })));
          }
        }).catch(() => {});
      }
    } catch (err) {
      console.error('[SubmittedOrders] Load failed:', err);
      if (!silent) {
        setError(err.message || 'Không thể tải danh sách đơn từ Supabase Cloud.');
      }

      // Fallback hiển thị dữ liệu lưu tạm nếu có
      try {
        const localBackup = typeof OrderStorage !== 'undefined' ? await OrderStorage.getSubmittedOrders().catch(() => []) : [];
        if (Array.isArray(localBackup) && localBackup.length > 0) {
          setOrders(localBackup.map(l => ({ ...l, isCloud: false })));
        }
      } catch (_) {}
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleSyncSingleOrder = async (order) => {
    const orderKey = order.id || order.trackingCode || order.orderCode;
    if (!orderKey) return;
    setSyncingOrderId(orderKey);
    setSyncFeedback('');
    try {
      let ok = false;
      if (typeof OrderStorage !== 'undefined' && typeof OrderStorage.pushSubmittedOrderToCloud === 'function') {
        ok = await OrderStorage.pushSubmittedOrderToCloud(order);
      }
      if (ok) {
        setOrders(prev => prev.map(o => {
          const match = o.id === order.id || (order.trackingCode && o.trackingCode === order.trackingCode) || (order.orderCode && o.orderCode === order.orderCode);
          return match ? { ...o, isCloud: true } : o;
        }));
        setSyncFeedback(`Đã đồng bộ đơn ${order.orderCode || order.trackingCode || ''} lên Cloud thành công!`);
        setTimeout(() => setSyncFeedback(''), 4000);
      } else {
        setSyncFeedback('Chưa thể đồng bộ đơn này lên Cloud. Vui lòng thử lại sau.');
        setTimeout(() => setSyncFeedback(''), 4000);
      }
    } catch (err) {
      setSyncFeedback('Lỗi đồng bộ: ' + (err.message || 'Lỗi kết nối'));
      setTimeout(() => setSyncFeedback(''), 4000);
    } finally {
      setSyncingOrderId('');
    }
  };

  const handleSyncAllLocal = async () => {
    if (syncingAll) return;
    setSyncingAll(true);
    setSyncFeedback('');
    try {
      if (typeof OrderStorage !== 'undefined' && typeof OrderStorage.syncSubmittedOrdersToCloud === 'function') {
        const res = await OrderStorage.syncSubmittedOrdersToCloud();
        if (res && res.ok) {
          setOrders(prev => prev.map(o => ({ ...o, isCloud: true })));
          setSyncFeedback(`Đã đồng bộ thành công ${res.count || 'các'} đơn hàng lên Cloud!`);
          setTimeout(() => setSyncFeedback(''), 4000);
        } else {
          setSyncFeedback(res?.reason || 'Đồng bộ thất bại, vui lòng thử lại sau.');
          setTimeout(() => setSyncFeedback(''), 4000);
        }
      }
    } catch (err) {
      setSyncFeedback('Lỗi đồng bộ: ' + (err.message || 'Lỗi mạng'));
      setTimeout(() => setSyncFeedback(''), 4000);
    } finally {
      setSyncingAll(false);
    }
  };

  useEffect(() => {
    loadOrders();

    let debounceTimer = null;
    const triggerDebouncedLoad = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        loadOrders(true);
      }, 300);
    };

    // Tự động tải lại khi có đơn mới được lưu vào storage (không cần F5 thủ công)
    const handleStorageChange = (changes, areaName) => {
      if (areaName === 'local') {
        const hasRelevantKey = Object.keys(changes).some(k => 
          k.includes('submitted') || k.includes('order') || k === 'last_submitted_order' || k === 'last_submitted_order_sync' || k === 'last_cloud_order_sync' || k === 'activeShopId'
        );
        if (hasRelevantKey) {
          triggerDebouncedLoad();
        }
      }
    };

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener(handleStorageChange);
    }

    const handleRuntimeMessage = (msg) => {
      if (msg && (msg.type === 'cloud_sync_update' || msg.type === 'order_submitted' || msg.type === 'submitted_orders_updated' || msg.action === 'refresh_orders' || msg.action === 'ordersUpdated')) {
        triggerDebouncedLoad();
      }
    };
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener(handleRuntimeMessage);
    }

    const handleWindowStorage = (e) => {
      if (e.key && (e.key.includes('submitted') || e.key.includes('order'))) {
        triggerDebouncedLoad();
      }
    };
    window.addEventListener('storage', handleWindowStorage);

    const handleCustomOrderEvent = () => {
      triggerDebouncedLoad();
    };
    window.addEventListener('order-saved-db', handleCustomOrderEvent);
    window.addEventListener('submitted-orders-updated', handleCustomOrderEvent);
    window.addEventListener('orders-updated', handleCustomOrderEvent);

    const handleNavigate = (e) => {
      if (e?.detail?.tab === 'submitted-orders') {
        if (typeof e.detail.search === 'string') {
          setSearch(e.detail.search);
        }
        if (typeof e.detail.datePreset === 'string') {
          setDatePreset(e.detail.datePreset);
        }
      } else if (e?.detail?.search !== undefined) {
        setSearch(e.detail.search);
      }
    };
    const handleSearchEvent = (e) => {
      if (e?.detail?.search !== undefined) {
        setSearch(e.detail.search);
      }
    };
    window.addEventListener('options:navigate', handleNavigate);
    window.addEventListener('options:search', handleSearchEvent);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
        chrome.storage.onChanged.removeListener(handleStorageChange);
      }
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.removeListener(handleRuntimeMessage);
      }
      window.removeEventListener('storage', handleWindowStorage);
      window.removeEventListener('order-saved-db', handleCustomOrderEvent);
      window.removeEventListener('submitted-orders-updated', handleCustomOrderEvent);
      window.removeEventListener('orders-updated', handleCustomOrderEvent);
      window.removeEventListener('options:navigate', handleNavigate);
      window.removeEventListener('options:search', handleSearchEvent);
    };
  }, []);

  const dateRange = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    if (datePreset === 'today') {
      return { start: todayStart, end: todayEnd };
    }
    if (datePreset === 'yesterday') {
      const yestStart = new Date(todayStart);
      yestStart.setDate(yestStart.getDate() - 1);
      const yestEnd = new Date(todayEnd);
      yestEnd.setDate(yestEnd.getDate() - 1);
      return { start: yestStart, end: yestEnd };
    }
    if (datePreset === '7days') {
      const past7 = new Date(todayStart);
      past7.setDate(past7.getDate() - 6);
      return { start: past7, end: todayEnd };
    }
    if (datePreset === 'thisMonth') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      return { start: monthStart, end: todayEnd };
    }
    if (datePreset === 'lastMonth') {
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { start: lastMonthStart, end: lastMonthEnd };
    }
    if (datePreset === 'custom' && (customStart || customEnd)) {
      const s = customStart ? new Date(customStart + 'T00:00:00') : new Date(0);
      const e = customEnd ? new Date(customEnd + 'T23:59:59') : new Date(8640000000000000);
      return { start: s, end: e };
    }
    return null;
  }, [datePreset, customStart, customEnd]);

  const filtered = useMemo(() => {
    const q = search.trim();
    const cleanQ = removeVietnameseTones(q);
    const qDigits = normalizePhone(q);

    return orders.filter(order => {
      // 1. Lọc theo thời gian
      if (dateRange) {
        const orderTime = new Date(valueOf(order, 'submittedAt', 'submitted_at', 'createdAt', 'created_at') || 0);
        if (!Number.isNaN(orderTime.getTime())) {
          if (orderTime < dateRange.start || orderTime > dateRange.end) return false;
        }
      }

      // 2. Lọc theo Hãng
      if (carrierFilter !== 'all') {
        const p = String(valueOf(order, 'platform')).toLowerCase();
        if (carrierFilter === 'vnpost' && !p.includes('vnpost') && !p.includes('vietnam')) return false;
        if (carrierFilter === 'jt' && !p.includes('jt') && !p.includes('j&t')) return false;
      }

      // 3. Lọc theo Người trả cước
      if (feeFilter !== 'all') {
        const isRecipient = isRecipientPayingFee(order);
        if (feeFilter === 'recipient' && !isRecipient) return false;
        if (feeFilter === 'sender' && isRecipient) return false;
      }

      // 4. Lọc theo tình trạng Vận đơn
      if (statusFilter !== 'all') {
        const tracking = String(valueOf(order, 'trackingCode', 'tracking_code')).trim();
        const hasTracking = tracking && tracking !== '-' && tracking !== '—';
        if (statusFilter === 'has_tracking' && !hasTracking) return false;
        if (statusFilter === 'no_tracking' && hasTracking) return false;
      }

      // 4b. Lọc theo trạng thái giao hàng Webhook
      if (deliveryFilter !== 'all') {
        const ost = String(valueOf(order, 'status') || 'submitted').toLowerCase();
        if (deliveryFilter === 'delivered' && ost !== 'delivered' && ost !== '90') return false;
        if (deliveryFilter === 'delivery_failed' && ost !== 'delivery_failed') return false;
        if (deliveryFilter === 'delivering' && ost !== 'delivering' && ost !== '70') return false;
        if (deliveryFilter === 'out_for_delivery' && ost !== 'out_for_delivery' && ost !== '80') return false;
        if (deliveryFilter === 'returned' && ost !== 'returned' && ost !== '100') return false;
        if (deliveryFilter === 'processing' && ost !== 'processing' && ost !== 'accepted' && ost !== '50') return false;
        if (deliveryFilter === 'pending_pickup' && ost !== 'pending_pickup' && ost !== 'pending' && ost !== '1') return false;
        if (deliveryFilter === 'submitted' && ost !== 'submitted' && ost !== 'created' && ost !== '0' && ost !== '') return false;
        if (deliveryFilter === 'cancelled' && ost !== 'cancelled' && ost !== 'canceled') return false;
        if (deliveryFilter === 'reconciled' && ost !== 'reconciled') return false;
      }

      // 5. Tìm kiếm đa năng
      if (q) {
        const rawName = String(valueOf(order, 'name', 'customerName', 'customer_name'));
        const nameNorm = removeVietnameseTones(rawName);
        const rawPhone = normalizePhone(valueOf(order, 'phone'));
        const rawOrderCode = String(valueOf(order, 'orderCode', 'order_code')).toLowerCase();
        const rawTracking = String(valueOf(order, 'trackingCode', 'tracking_code')).toLowerCase();
        const rawAcc = removeVietnameseTones(getCarrierAccount(order));
        const rawAddress = removeVietnameseTones(valueOf(order, 'address'));

        const matchName = nameNorm.includes(cleanQ);
        const matchPhone = qDigits ? (rawPhone.includes(qDigits) || rawPhone.endsWith(qDigits)) : false;
        const matchOrderCode = rawOrderCode.includes(q.toLowerCase());
        const matchTracking = rawTracking.includes(q.toLowerCase());
        const matchAccount = rawAcc.includes(cleanQ);
        const matchAddress = rawAddress.includes(cleanQ);

        if (!matchName && !matchPhone && !matchOrderCode && !matchTracking && !matchAccount && !matchAddress) {
          return false;
        }
      }

      return true;
    });
  }, [orders, dateRange, carrierFilter, feeFilter, statusFilter, deliveryFilter, search]);

  const paginatedOrders = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const stats = useMemo(() => {
    let totalCod = 0;
    let recipientFeeCount = 0;
    let senderFeeCount = 0;
    let hasTrackingCount = 0;
    let deliveredCount = 0;
    let deliveringCount = 0;
    let returnedCount = 0;

    filtered.forEach(o => {
      totalCod += Number(valueOf(o, 'codAmount', 'cod_amount')) || 0;
      if (isRecipientPayingFee(o)) recipientFeeCount++;
      else senderFeeCount++;

      const tr = String(valueOf(o, 'trackingCode', 'tracking_code')).trim();
      if (tr && tr !== '-' && tr !== '—') hasTrackingCount++;

      const ost = String(valueOf(o, 'status') || 'submitted').toLowerCase();
      if (ost === 'delivered' || ost === '90') deliveredCount++;
      else if (ost === 'delivering' || ost === '70' || ost === '80') deliveringCount++;
      else if (ost === 'returned' || ost === '100') returnedCount++;
    });

    return {
      totalCount: filtered.length,
      totalCod,
      recipientFeeCount,
      senderFeeCount,
      hasTrackingCount,
      deliveredCount,
      deliveringCount,
      returnedCount
    };
  }, [filtered]);

  const copyText = (text, id) => {
    if (!text || text === '-' || text === '—') return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(''), 2000);
  };

  const exportToCsv = () => {
    if (filtered.length === 0) return;

    const headers = [
      'Thời gian gửi',
      'Tên người nhận',
      'Số điện thoại',
      'Mã đơn hàng',
      'Mã vận đơn',
      'Nguồn lưu trữ',
      'Tiền thu hộ COD (VNĐ)',
      'Người trả cước',
      'Hãng vận chuyển',
      'Tài khoản bưu điện lên đơn',
      'Địa chỉ giao hàng'
    ];

    const rows = filtered.map(o => [
      `"${formatDate(valueOf(o, 'submittedAt', 'submitted_at', 'createdAt', 'created_at'))}"`,
      `"${getCleanCustomerName(o).replace(/"/g, '""')}"`,
      `"\t${valueOf(o, 'phone')}"`,
      `"${valueOf(o, 'orderCode', 'order_code').replace(/"/g, '""')}"`,
      `"\t${valueOf(o, 'trackingCode', 'tracking_code')}"`,
      `"${getStorageSource(o) === 'cloud' ? 'Đã lên Cloud' : 'Chỉ lưu Local'}"`,
      `"${Number(valueOf(o, 'codAmount', 'cod_amount') || 0)}"`,
      `"${isRecipientPayingFee(o) ? 'Người nhận trả' : 'Shop trả'}"`,
      `"${carrierLabel(valueOf(o, 'platform'))}"`,
      `"${getCarrierAccount(o).replace(/"/g, '""')}"`,
      `"${String(valueOf(o, 'address')).replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Don_Hang_Da_Gui_${new Date().toISOString().substring(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
      {/* HEADER SECTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '20px', flexWrap: 'wrap', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
        <div>
          <h2 className="page-title" style={{ marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Package size={22} color="var(--primary)" /> Đơn Hàng Đã Gửi
          </h2>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '13px' }}>
            Quản lý, tra cứu người trả cước, tài khoản bưu điện lên đơn và xuất báo cáo đối soát COD.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {unsyncedCount > 0 && (
            <button
              type="button"
              onClick={handleSyncAllLocal}
              disabled={syncingAll}
              title="Đồng bộ tất cả đơn hàng chưa lên Cloud"
              style={{
                background: '#eff6ff',
                color: '#1d4ed8',
                border: '1px solid #bfdbfe',
                padding: '8px 14px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: syncingAll ? 'not-allowed' : 'pointer'
              }}
            >
              <UploadCloud size={15} className={syncingAll ? 'spin' : ''} />
              {syncingAll ? 'Đang đồng bộ...' : `Đồng bộ Cloud (${unsyncedCount})`}
            </button>
          )}
          <button
            type="button"
            onClick={exportToCsv}
            disabled={filtered.length === 0}
            style={{
              background: '#f0fdf4',
              color: '#166534',
              border: '1px solid #bbf7d0',
              padding: '8px 14px',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: filtered.length === 0 ? 'not-allowed' : 'pointer'
            }}
          >
            <FileSpreadsheet size={15} /> Xuất Excel ({filtered.length})
          </button>
          <button
            type="button"
            onClick={loadOrders}
            disabled={loading}
            style={{
              background: 'white',
              color: '#334155',
              border: '1px solid var(--border)',
              padding: '8px 14px',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: loading ? 'default' : 'pointer'
            }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> {loading ? 'Đang tải...' : 'Làm mới'}
          </button>

          {/* VIEW MODE TOGGLE (BẢNG / THẺ PWA) */}
          <div className="view-mode-toggle" title="Chuyển chế độ hiển thị Bảng hoặc Thẻ PWA gọn gàng">
            <button
              type="button"
              className={`view-mode-toggle-btn ${viewMode === 'cards' ? 'active' : ''}`}
              onClick={() => handleSetViewMode('cards')}
            >
              <LayoutList size={14} />
              <span>Gọn PWA</span>
            </button>
            <button
              type="button"
              className={`view-mode-toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => handleSetViewMode('table')}
            >
              <Table2 size={14} />
              <span>Bảng</span>
            </button>
          </div>
        </div>
      </div>

      {/* ERROR ALERT BANNER */}
      {error && (
        <div style={{
          background: '#fef2f2',
          border: '1px solid #f87171',
          borderRadius: '10px',
          padding: '14px 18px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#b91c1c', fontWeight: 600, fontSize: '13.5px' }}>
            <AlertCircle size={20} color="#dc2626" style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 800 }}>⚠️ Lỗi đồng bộ dữ liệu Supabase Cloud:</div>
              <div style={{ fontWeight: 500, fontSize: '12.5px', marginTop: '2px', color: '#7f1d1d' }}>{error}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={loadOrders}
            disabled={loading}
            style={{
              background: '#dc2626',
              color: '#ffffff',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              fontWeight: 700,
              fontSize: '12.5px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Thử lại
          </button>
        </div>
      )}

      {/* KPI SUMMARY CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '20px', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
        <div className="card" style={{ padding: '14px 16px', background: 'white', border: '1px solid var(--border)', borderRadius: '10px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Tổng đơn hiển thị</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-main)' }}>{stats.totalCount} <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted)' }}>đơn</span></div>
        </div>

        <div className="card" style={{ padding: '14px 16px', background: 'white', border: '1px solid var(--border)', borderRadius: '10px' }}>
          <div style={{ fontSize: '12px', color: '#059669', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Tổng tiền thu hộ (COD)</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#059669' }}>{stats.totalCod.toLocaleString('vi-VN')} <span style={{ fontSize: '13px', fontWeight: 500 }}>đ</span></div>
        </div>

        <div className="card" style={{ padding: '14px 16px', background: 'white', border: '1px solid var(--border)', borderRadius: '10px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Người trả cước</div>
          <div style={{ fontSize: '13px', fontWeight: 600, display: 'flex', gap: '8px', marginTop: '6px' }}>
            <span style={{ background: '#ecfdf5', color: '#047857', padding: '2px 8px', borderRadius: '4px' }}>🟢 Khách: {stats.recipientFeeCount}</span>
            <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: '4px' }}>🔵 Shop: {stats.senderFeeCount}</span>
          </div>
        </div>

        <div className="card" style={{ padding: '14px 16px', background: 'white', border: '1px solid var(--border)', borderRadius: '10px' }}>
          <div style={{ fontSize: '12px', color: '#2563eb', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Mã vận đơn</div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#2563eb', marginTop: '6px' }}>
            {stats.hasTrackingCount} / {stats.totalCount} <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)' }}>đã có mã</span>
          </div>
        </div>

        <div className="card" style={{ padding: '14px 16px', background: 'white', border: '1px solid var(--border)', borderRadius: '10px' }}>
          <div style={{ fontSize: '12px', color: '#16a34a', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Trạng thái giao (Webhook)</div>
          <div style={{ fontSize: '13px', fontWeight: 600, display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
            <span style={{ background: '#f0fdf4', color: '#16a34a', padding: '2px 6px', borderRadius: '4px' }}>🟢 Đã giao: {stats.deliveredCount}</span>
            <span style={{ background: '#eff6ff', color: '#2563eb', padding: '2px 6px', borderRadius: '4px' }}>🔵 Đang phát: {stats.deliveringCount}</span>
            {stats.returnedCount > 0 && (
              <span style={{ background: '#fef2f2', color: '#dc2626', padding: '2px 6px', borderRadius: '4px' }}>🔴 Hoàn: {stats.returnedCount}</span>
            )}
          </div>
        </div>
      </div>

      {/* FILTER CONTROLS BAR */}
      <div className="card" style={{ padding: '16px', marginBottom: '16px', background: 'white', border: '1px solid var(--border)', borderRadius: '10px', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
        {/* ROW 1: SEARCH & DATE PRESETS */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '12px', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
          <div style={{ flex: '1 1 300px', position: 'relative', minWidth: '240px' }}>
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Tìm theo Tên khách, SĐT (đầy đủ hoặc 4 số cuối), Mã đơn, Vận đơn, Tài khoản bưu điện..."
              value={search}
              onChange={(e) => {
                const val = e.target.value;
                setSearch(val);
                if (typeof window !== 'undefined') window.__af_global_search = val;
              }}
              style={{
                width: '100%',
                padding: '9px 12px 9px 36px',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
            {search && (
              <button
                onClick={() => {
                  setSearch('');
                  if (typeof window !== 'undefined') {
                    window.__af_global_search = '';
                    window.dispatchEvent(new CustomEvent('options:search', { detail: { search: '' } }));
                  }
                }}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '14px' }}
              >
                ✕
              </button>
            )}
          </div>

          {/* DATE PRESETS TABS */}
          <div style={{ display: 'flex', gap: '4px', background: 'var(--bg)', border: '1px solid var(--border)', padding: '3px', borderRadius: '8px', flexWrap: 'wrap' }}>
            {[
              { id: 'all', label: 'Tất cả' },
              { id: 'today', label: 'Hôm nay' },
              { id: 'yesterday', label: 'Hôm qua' },
              { id: '7days', label: '7 ngày qua' },
              { id: 'thisMonth', label: 'Tháng này' },
              { id: 'lastMonth', label: 'Tháng trước' },
              { id: 'custom', label: 'Tùy chỉnh 🗓️' }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setDatePreset(tab.id)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: datePreset === tab.id ? 700 : 500,
                  background: datePreset === tab.id ? 'var(--card)' : 'transparent',
                  color: datePreset === tab.id ? 'var(--primary)' : 'var(--text-muted)',
                  boxShadow: datePreset === tab.id ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ROW 2: CUSTOM DATE RANGE & SECONDARY FILTERS */}
        <div className="filters-grid-mobile" style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', paddingTop: '10px', borderTop: '1px solid var(--border)', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
          {datePreset === 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
              <Calendar size={15} color="var(--text-muted)" />
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                style={{ padding: '5px 8px', border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text-main)', borderRadius: '6px', fontSize: '12px' }}
              />
              <span>đến</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                style={{ padding: '5px 8px', border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text-main)', borderRadius: '6px', fontSize: '12px' }}
              />
            </div>
          )}

          {/* Lọc Hãng */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Hãng:</span>
            <select
              value={carrierFilter}
              onChange={(e) => setCarrierFilter(e.target.value)}
              style={{ padding: '5px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px', background: 'var(--card)', color: 'var(--text-main)' }}
            >
              <option value="all">Tất cả hãng</option>
              <option value="vnpost">VNPost (Bưu điện)</option>
              <option value="jt">J&T Express</option>
            </select>
          </div>

          {/* Lọc Trả cước */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Cước phí:</span>
            <select
              value={feeFilter}
              onChange={(e) => setFeeFilter(e.target.value)}
              style={{ padding: '5px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px', background: 'var(--card)', color: 'var(--text-main)' }}
            >
              <option value="all">Tất cả hình thức</option>
              <option value="recipient">Khách (Người nhận) trả</option>
              <option value="sender">Shop (Người gửi) trả</option>
            </select>
          </div>

          {/* Lọc Trạng thái mã vận đơn */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Vận đơn:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ padding: '5px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px', background: 'var(--card)', color: 'var(--text-main)' }}
            >
              <option value="all">Tất cả</option>
              <option value="has_tracking">Đã có mã vận đơn</option>
              <option value="no_tracking">Chưa có mã vận đơn</option>
            </select>
          </div>

          {/* Lọc Trạng thái giao hàng Webhook */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Giao hàng:</span>
            <select
              value={deliveryFilter}
              onChange={(e) => setDeliveryFilter(e.target.value)}
              style={{ padding: '5px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px', background: 'var(--card)', color: 'var(--text-main)' }}
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="submitted">Tạo đơn</option>
              <option value="pending_pickup">Chờ lấy hàng</option>
              <option value="processing">Nhận hàng</option>
              <option value="delivering">Đang vận chuyển</option>
              <option value="out_for_delivery">Đang phát hàng</option>
              <option value="delivered">Phát hàng thành công</option>
              <option value="delivery_failed">Phát không thành công</option>
              <option value="returned">Chuyển hoàn</option>
              <option value="cancelled">Đã hủy</option>
              <option value="reconciled">Đối soát</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {syncFeedback && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
          <CheckCircle2 size={16} color="#16a34a" /> {syncFeedback}
        </div>
      )}

      {/* ORDERS DISPLAY (PWA CARDS OR TABLE) */}
      <div className="card" style={{ padding: viewMode === 'cards' && !loading && filtered.length > 0 ? '16px' : 0, overflow: 'hidden', background: viewMode === 'cards' ? 'transparent' : 'var(--card)', border: viewMode === 'cards' ? 'none' : '1px solid var(--border)', borderRadius: '12px', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
        {loading ? (
          <div style={{ padding: '50px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--card)', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <RefreshCw size={24} className="spin" style={{ margin: '0 auto 10px' }} />
            <div>Đang tải dữ liệu đơn hàng...</div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '50px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--card)', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <Package size={36} color="var(--text-muted)" style={{ margin: '0 auto 12px', opacity: 0.5 }} />
            <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text-main)' }}>Không tìm thấy đơn hàng nào</div>
            <div style={{ fontSize: '13px', marginTop: '4px' }}>Thử thay đổi bộ lọc thời gian hoặc từ khóa tìm kiếm.</div>
          </div>
        ) : viewMode === 'cards' ? (
          /* =========================================================================
             PWA COMPACT TOUCH CARDS VIEW
             ========================================================================= */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px', width: '100%' }}>
            {paginatedOrders.map((order, idx) => {
              const orderId = String(order.id || order.saved_order_id || order.savedOrderId || idx);
              const tracking = valueOf(order, 'trackingCode', 'tracking_code');
              const hasTracking = tracking && tracking !== '-' && tracking !== '—' && tracking !== 'chờ cập nhật mã';
              const phone = valueOf(order, 'phone');
              const customerName = getCleanCustomerName(order);
              const isRecipientFee = isRecipientPayingFee(order);
              const carrier = carrierLabel(valueOf(order, 'platform'));
              const carrierAccount = getCarrierAccount(order);
              const isJt = String(valueOf(order, 'platform')).toLowerCase().includes('jt');
              const trackingUrl = getCarrierTrackingUrl(order.platform, tracking);
              const orderCode = valueOf(order, 'orderCode', 'order_code');
              const submittedAt = valueOf(order, 'submittedAt', 'submitted_at', 'createdAt', 'created_at');
              const cod = Number(valueOf(order, 'codAmount', 'cod_amount')) || 0;
              const address = valueOf(order, 'address') || '-';
              const orderStatus = valueOf(order, 'status') || 'submitted';
              const statusMeta = getDeliveryStatusMeta(orderStatus);
              const isExpanded = expandedOrderId === orderId;

              const rawText = valueOf(order, 'rawText', 'raw_text', 'originalText', 'text', 'rawOrder', 'raw_order', 'content', 'input') || (
                [
                  customerName && customerName !== '-' ? `Khách hàng: ${customerName}` : '',
                  phone ? `SĐT: ${phone}` : '',
                  address && address !== '-' ? `Địa chỉ: ${address}` : '',
                  orderCode && orderCode !== '-' ? `Mã đơn: ${orderCode}` : '',
                  cod > 0 ? `Tiền COD: ${cod.toLocaleString('vi-VN')}đ` : (order.codAmount !== undefined ? `Tiền COD: 0đ` : ''),
                  valueOf(order, 'note', 'extraNote') ? `Ghi chú: ${valueOf(order, 'note', 'extraNote')}` : ''
                ].filter(Boolean).join('\n')
              );

              return (
                <div key={orderId} className="pwa-order-card">
                  {/* CARD HEADER */}
                  <div className="pwa-order-card-header">
                    <div>
                      <div className="pwa-order-card-customer">
                        <span>{customerName}</span>
                        {phone && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); copyText(phone, `p_pwa_${orderId}`); }}
                            style={{
                              background: '#eff6ff',
                              color: '#2563eb',
                              border: '1px solid #bfdbfe',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px'
                            }}
                            title="Sao chép SĐT"
                          >
                            <Phone size={10} />
                            <span>{phone}</span>
                            {copiedId === `p_pwa_${orderId}` && <Check size={10} color="#16a34a" />}
                          </button>
                        )}
                      </div>
                      <div className="pwa-order-card-time">
                        🕒 {formatDate(submittedAt)} {submittedAt && `• ${relativeTime(submittedAt)}`}
                      </div>
                    </div>

                    <div className="pwa-order-card-cod">
                      <div className="pwa-order-card-cod-val">
                        {cod > 0 ? `${cod.toLocaleString('vi-VN')}đ` : '0đ'}
                      </div>
                      <span style={{
                        fontSize: '10.5px',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: isRecipientFee ? '#eff6ff' : '#f8fafc',
                        color: isRecipientFee ? '#2563eb' : '#64748b',
                        border: isRecipientFee ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                        display: 'inline-block',
                        marginTop: '2px'
                      }}>
                        {isRecipientFee ? 'Khách trả cước' : 'Shop trả cước'}
                      </span>
                    </div>
                  </div>

                  {/* ADDRESS */}
                  <div className="pwa-order-card-address">
                    <MapPin size={14} color="var(--text-muted)" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span style={{ wordBreak: 'break-word' }}>{address}</span>
                  </div>

                  {/* TRACKING CODE BOX */}
                  <div className="pwa-tracking-box">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: isJt ? '#fef2f2' : '#fff7ed',
                          color: isJt ? '#dc2626' : '#c2410c',
                          border: isJt ? '1px solid #fecaca' : '1px solid #fed7aa'
                        }}>
                          {carrier}
                        </span>
                        {carrierAccount && carrierAccount !== 'Mặc định' && (
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: '#f8fafc',
                            color: '#475569',
                            border: '1px solid #cbd5e1',
                            maxWidth: '180px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }} title={`Tài khoản ${carrier}: ${carrierAccount}`}>
                            TK: {carrierAccount}
                          </span>
                        )}
                      </div>
                      <div>
                        {hasTracking ? (
                          <code className="pwa-tracking-code">{tracking}</code>
                        ) : (
                          <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Chưa có mã vận đơn</span>
                        )}
                      </div>
                    </div>

                    {hasTracking && (
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <button
                          type="button"
                          className="pwa-touch-btn"
                          style={{
                            background: copiedId === `t_pwa_${orderId}` ? '#10b981' : '#2563eb',
                            color: '#ffffff',
                            padding: '5px 10px'
                          }}
                          onClick={() => copyText(tracking, `t_pwa_${orderId}`)}
                          title="Sao chép mã vận đơn"
                        >
                          {copiedId === `t_pwa_${orderId}` ? <Check size={12} /> : <Copy size={12} />}
                          <span>{copiedId === `t_pwa_${orderId}` ? 'Đã chép' : 'Chép mã'}</span>
                        </button>

                        {trackingUrl && (
                          <a
                            href={trackingUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="pwa-touch-btn"
                            style={{
                              background: '#f1f5f9',
                              color: '#334155',
                              border: '1px solid #cbd5e1',
                              padding: '5px 8px',
                              textDecoration: 'none'
                            }}
                            title={`Tra cứu trên ${carrier}`}
                          >
                            <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                    )}
                  </div>

                  {/* STATUS & EXPAND ACTION ROW */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '4px', borderTop: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{
                        background: statusMeta.bg,
                        color: statusMeta.color,
                        border: `1px solid ${statusMeta.border}`,
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 700
                      }}>
                        {statusMeta.label}
                      </span>
                      {orderCode && orderCode !== '-' && (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          #{orderCode}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => setSelectedTimelineOrder(order)}
                        style={{
                          background: 'transparent',
                          border: '1px solid var(--border)',
                          borderRadius: '6px',
                          padding: '4px 8px',
                          fontSize: '11px',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                        title="Xem nhật ký vòng đời đơn"
                      >
                        <Clock size={11} /> Nhật ký
                      </button>

                      <button
                        type="button"
                        onClick={() => setExpandedOrderId(prev => prev === orderId ? null : orderId)}
                        style={{
                          background: isExpanded ? '#eff6ff' : 'transparent',
                          border: '1px solid var(--border)',
                          borderRadius: '6px',
                          padding: '4px 8px',
                          fontSize: '11px',
                          color: isExpanded ? '#2563eb' : 'var(--text-main)',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <span>{isExpanded ? 'Thu gọn' : 'Chi tiết'}</span>
                        {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      </button>
                    </div>
                  </div>

                  {/* EXPANDED DETAILS IN CARD */}
                  {isExpanded && (
                    <div style={{
                      marginTop: '8px',
                      padding: '12px',
                      background: 'var(--surface-muted, #f8fafc)',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      fontSize: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, color: 'var(--primary)' }}>Nội dung đơn thô</span>
                        <button
                          type="button"
                          onClick={() => copyText(rawText, `raw_${orderId}`)}
                          style={{
                            background: '#ffffff',
                            border: '1px solid #cbd5e1',
                            borderRadius: '4px',
                            padding: '2px 8px',
                            fontSize: '11px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          {copiedId === `raw_${orderId}` ? <Check size={11} color="#16a34a" /> : <Copy size={11} />}
                          <span>{copiedId === `raw_${orderId}` ? 'Đã sao chép' : 'Sao chép'}</span>
                        </button>
                      </div>
                      <pre style={{
                        margin: 0,
                        padding: '8px',
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        fontFamily: 'inherit',
                        fontSize: '11.5px',
                        color: 'var(--text-main)',
                        maxHeight: '120px',
                        overflowY: 'auto'
                      }}>
                        {rawText}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* =========================================================================
             STANDARD TABLE VIEW
             ========================================================================= */
          <div className="table-responsive dash-table-wrapper" style={{ overflowX: 'auto', width: '100%', maxWidth: '100%', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '980px', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--surface-muted, #f8fafc)', borderBottom: '1px solid var(--border, #e2e8f0)', position: 'sticky', top: 0, zIndex: 10 }}>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted, #64748b)', fontSize: 12, width: 45 }}>STT</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted, #64748b)', fontSize: 12 }}>Thời gian lên đơn</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted, #64748b)', fontSize: 12 }}>Khách hàng & SĐT</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted, #64748b)', fontSize: 12 }}>Mã đơn hàng</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted, #64748b)', fontSize: 12 }}>Địa chỉ nhận</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text-muted, #64748b)', fontSize: 12 }}>Tiền COD</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: 'var(--text-muted, #64748b)', fontSize: 12 }}>Cước phí</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted, #64748b)', fontSize: 12 }}>Mã vận đơn</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted, #64748b)', fontSize: 12 }}>Hãng & TK</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: 'var(--text-muted, #64748b)', fontSize: 12, width: 65 }}>Lưu trữ</th>
                </tr>
              </thead>
              <tbody>
                {paginatedOrders.map((order, idx) => {
                  const orderId = String(order.id || order.saved_order_id || order.savedOrderId || idx);
                  const tracking = valueOf(order, 'trackingCode', 'tracking_code');
                  const hasTracking = tracking && tracking !== '-' && tracking !== '—' && tracking !== 'chờ cập nhật mã';
                  const phone = valueOf(order, 'phone');
                  const customerName = getCleanCustomerName(order);
                  const isRecipientFee = isRecipientPayingFee(order);
                  const carrier = carrierLabel(valueOf(order, 'platform'));
                  const carrierAccount = getCarrierAccount(order);
                  const trackingUrl = getCarrierTrackingUrl(order.platform, tracking);
                  const orderCode = valueOf(order, 'orderCode', 'order_code');
                  const storageSource = getStorageSource(order);
                  const submittedAt = valueOf(order, 'submittedAt', 'submitted_at', 'createdAt', 'created_at');
                  const cod = Number(valueOf(order, 'codAmount', 'cod_amount')) || 0;
                  const address = valueOf(order, 'address') || '-';
                  const productNote = valueOf(order, 'product_note', 'productNote', 'extraNote');
                  const orderStatus = valueOf(order, 'status') || 'submitted';
                  const statusMeta = getDeliveryStatusMeta(orderStatus);
                  const logs = order.webhookLogs || order.webhook_logs || [];
                  const actualWeight = valueOf(order, 'actualWeight', 'actual_weight');
                  const actualFee = valueOf(order, 'shippingFee', 'shipping_fee');

                  const rawText = valueOf(order, 'rawText', 'raw_text', 'originalText', 'text', 'rawOrder', 'raw_order', 'content', 'input') || (
                    [
                      customerName && customerName !== '-' ? `Khách hàng: ${customerName}` : '',
                      phone ? `SĐT: ${phone}` : '',
                      address && address !== '-' ? `Địa chỉ: ${address}` : '',
                      orderCode && orderCode !== '-' ? `Mã đơn: ${orderCode}` : '',
                      cod > 0 ? `Tiền COD: ${cod.toLocaleString('vi-VN')}đ` : (order.codAmount !== undefined ? `Tiền COD: 0đ` : ''),
                      valueOf(order, 'note', 'extraNote') ? `Ghi chú: ${valueOf(order, 'note', 'extraNote')}` : ''
                    ].filter(Boolean).join('\n')
                  );

                  return (
                    <React.Fragment key={order.id || tracking || orderCode || idx}>
                      <tr
                        onClick={() => setExpandedOrderId(prev => prev === orderId ? null : orderId)}
                        style={{
                          borderBottom: expandedOrderId === orderId ? 'none' : '1px solid var(--border, #f1f5f9)',
                          background: expandedOrderId === orderId ? 'rgba(59, 130, 246, 0.05)' : 'var(--card, #ffffff)',
                          cursor: 'pointer',
                          transition: 'background 0.15s ease'
                        }}
                        onMouseEnter={(e) => { if (expandedOrderId !== orderId) e.currentTarget.style.background = 'rgba(59, 130, 246, 0.03)'; }}
                        onMouseLeave={(e) => { if (expandedOrderId !== orderId) e.currentTarget.style.background = 'var(--card, #ffffff)'; }}
                        title="Bấm để mở rộng / thu gọn chi tiết hàng hóa, thông số kiện & hành trình vận đơn"
                      >
                        {/* STT with Chevron */}
                        <td style={{ padding: '12px 14px', color: 'var(--text-muted, #94a3b8)', fontWeight: 600 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ color: 'var(--primary, #2563eb)', display: 'inline-flex' }}>
                              {expandedOrderId === orderId ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </span>
                            <span>{(page - 1) * pageSize + idx + 1}</span>
                          </div>
                        </td>

                        {/* THỜI GIAN LÊN ĐƠN */}
                        <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-main, #0f172a)' }}>
                            {formatDate(submittedAt)}
                          </div>
                          {submittedAt && (
                            <div style={{ fontSize: 11, color: 'var(--text-muted, #64748b)', marginTop: 2 }}>
                              {relativeTime(submittedAt)}
                            </div>
                          )}
                        </td>

                        {/* KHÁCH HÀNG & SĐT */}
                        <td style={{ padding: '12px 14px', minWidth: 160 }}>
                          <div style={{ fontWeight: 700, color: 'var(--text-main, #0f172a)' }}>
                            {customerName}
                          </div>
                          {phone && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                              <a
                                href={`tel:${phone}`}
                                onClick={(e) => e.stopPropagation()}
                                style={{ fontSize: 12, color: 'var(--primary, #2563eb)', textDecoration: 'none', fontWeight: 600 }}
                              >
                                {phone}
                              </a>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); copyText(phone, `ph_${idx}`); }}
                                title="Sao chép số điện thoại"
                                style={{
                                  border: 'none',
                                  background: 'transparent',
                                  cursor: 'pointer',
                                  padding: 0,
                                  color: copiedId === `ph_${idx}` ? '#10b981' : 'var(--text-muted, #94a3b8)',
                                  display: 'inline-flex',
                                  alignItems: 'center'
                                }}
                              >
                                {copiedId === `ph_${idx}` ? <Check size={12} /> : <Copy size={12} />}
                              </button>
                            </div>
                          )}
                        </td>

                        {/* MÃ ĐƠN HÀNG */}
                        <td style={{ padding: '12px 14px' }}>
                          {orderCode && orderCode !== '-' ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-main, #0f172a)' }}>
                                {orderCode}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); copyText(orderCode, `oc_${idx}`); }}
                                title="Sao chép mã đơn hàng"
                                style={{
                                  border: 'none',
                                  background: 'transparent',
                                  cursor: 'pointer',
                                  padding: 0,
                                  color: copiedId === `oc_${idx}` ? '#10b981' : 'var(--text-muted, #94a3b8)',
                                  display: 'inline-flex',
                                  alignItems: 'center'
                                }}
                              >
                                {copiedId === `oc_${idx}` ? <Check size={12} /> : <Copy size={12} />}
                              </button>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted, #94a3b8)' }}>-</span>
                          )}
                        </td>

                        {/* ĐỊA CHỈ NHẬN */}
                        <td style={{ padding: '12px 14px', maxWidth: 220 }}>
                          <div
                            title={address}
                            style={{
                              fontSize: 12.5,
                              color: 'var(--text-main, #0f172a)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}
                          >
                            {address}
                          </div>
                        </td>

                        {/* TIỀN COD */}
                        <td style={{ padding: '12px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <span style={{ fontWeight: 800, color: cod > 0 ? '#10b981' : 'var(--text-muted, #64748b)', fontSize: 13.5 }}>
                            {cod.toLocaleString('vi-VN')}đ
                          </span>
                        </td>

                        {/* CƯỚC PHÍ */}
                        <td style={{ padding: '12px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              padding: '2px 7px',
                              borderRadius: 4,
                              background: isRecipientFee ? '#eff6ff' : '#f8fafc',
                              color: isRecipientFee ? '#2563eb' : '#64748b',
                              border: isRecipientFee ? '1px solid #bfdbfe' : '1px solid #e2e8f0'
                            }}
                          >
                            {isRecipientFee ? 'Khách trả' : 'Shop trả'}
                          </span>
                        </td>

                        {/* MÃ VẬN ĐƠN */}
                        <td style={{ padding: '12px 14px' }}>
                          {hasTracking ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#0284c7' }}>
                                {tracking}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); copyText(tracking, `tr_${idx}`); }}
                                title="Sao chép mã vận đơn"
                                style={{
                                  border: 'none',
                                  background: 'transparent',
                                  cursor: 'pointer',
                                  padding: 0,
                                  color: copiedId === `tr_${idx}` ? '#10b981' : 'var(--text-muted, #94a3b8)',
                                  display: 'inline-flex',
                                  alignItems: 'center'
                                }}
                              >
                                {copiedId === `tr_${idx}` ? <Check size={12} /> : <Copy size={12} />}
                              </button>
                              {trackingUrl && (
                                <a
                                  href={trackingUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  title="Mở trang định vị / tra cứu hành trình bưu phẩm"
                                  style={{ color: 'var(--primary, #2563eb)', display: 'inline-flex', alignItems: 'center' }}
                                >
                                  <ExternalLink size={12} />
                                </a>
                              )}
                            </div>
                          ) : (
                            <span style={{ fontSize: 11.5, color: 'var(--text-muted, #94a3b8)', fontStyle: 'italic' }}>
                              Chờ cập nhật mã
                            </span>
                          )}
                        </td>

                        {/* HÃNG & TK */}
                        <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span
                              style={{
                                fontSize: 10.5,
                                fontWeight: 800,
                                padding: '2px 6px',
                                borderRadius: 4,
                                background: carrier === 'VNPost' ? '#fef3c7' : carrier === 'J&T Express' ? '#fee2e2' : '#f1f5f9',
                                color: carrier === 'VNPost' ? '#92400e' : carrier === 'J&T Express' ? '#991b1b' : '#475569'
                              }}
                            >
                              {carrier}
                            </span>
                          </div>
                          {carrierAccount && carrierAccount !== 'Mặc định' && (
                            <div style={{ fontSize: 11, color: 'var(--text-muted, #64748b)', marginTop: 2 }}>
                              TK: {carrierAccount}
                            </div>
                          )}
                        </td>

                        {/* LƯU TRỮ */}
                        <td style={{ padding: '12px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {storageSource === 'cloud' ? (
                            <span
                              title="Đã đồng bộ Đám mây (Cloud)"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: 28,
                                height: 28,
                                borderRadius: '50%',
                                background: '#f0f9ff',
                                color: '#0284c7',
                                border: '1px solid #bae6fd'
                              }}
                            >
                              <Cloud size={16} />
                            </span>
                          ) : (
                            <span
                              title="Lưu trữ cục bộ trên máy (Local)"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: 28,
                                height: 28,
                                borderRadius: '50%',
                                background: '#f8fafc',
                                color: '#64748b',
                                border: '1px solid #e2e8f0'
                              }}
                            >
                              <Monitor size={16} />
                            </span>
                          )}
                        </td>
                      </tr>

                      {/* Accordion Row Expanded Detail */}
                      {expandedOrderId === orderId && (
                        <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                          <td colSpan="10" style={{ padding: '16px 20px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, fontSize: 12.5 }}>
                              {/* Khối 1: Thông tin đơn thô (Nội dung gốc) */}
                              <div style={{
                                background: '#ffffff',
                                padding: '14px 16px',
                                borderRadius: 10,
                                border: '1px solid #e2e8f0',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between'
                              }}>
                                <div>
                                  <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    marginBottom: 8
                                  }}>
                                    <div style={{ fontWeight: 700, color: 'var(--primary, #2563eb)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                                      <FileText size={15} />
                                      <span>Thông tin đơn thô</span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        copyText(rawText, `raw_${orderId}`);
                                      }}
                                      title="Sao chép toàn bộ văn bản đơn thô"
                                      style={{
                                        border: 'none',
                                        background: '#f1f5f9',
                                        color: copiedId === `raw_${orderId}` ? '#10b981' : '#64748b',
                                        borderRadius: 5,
                                        padding: '2px 8px',
                                        fontSize: 11,
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 4
                                      }}
                                    >
                                      {copiedId === `raw_${orderId}` ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                                      <span>{copiedId === `raw_${orderId}` ? 'Đã chép' : 'Sao chép'}</span>
                                    </button>
                                  </div>
                                  <div style={{
                                    background: 'var(--surface-muted, #f8fafc)',
                                    border: '1px solid var(--border, #e2e8f0)',
                                    borderRadius: 6,
                                    padding: '8px 10px',
                                    color: 'var(--text-main, #1e293b)',
                                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                                    fontSize: 11.5,
                                    lineHeight: 1.5,
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word',
                                    maxHeight: 110,
                                    overflowY: 'auto'
                                  }}>
                                    {rawText || 'Chưa có thông tin đơn thô'}
                                  </div>
                                </div>
                                {valueOf(order, 'note', 'extraNote') && (
                                  <div style={{ marginTop: 8, color: 'var(--text-muted, #64748b)', fontSize: 11.5, lineHeight: 1.4 }}>
                                    <b>Ghi chú:</b> {valueOf(order, 'note', 'extraNote')}
                                  </div>
                                )}
                              </div>

                              {/* Khối 2: Thông số kiện & COD */}
                              <div style={{
                                background: '#ffffff',
                                padding: '14px 16px',
                                borderRadius: 10,
                                border: '1px solid #e2e8f0',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                              }}>
                                <div style={{ fontWeight: 700, color: 'var(--primary, #2563eb)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                                  <Package size={15} />
                                  <span>Thông số kiện & COD</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, color: 'var(--text-main, #0f172a)', fontSize: 12.5 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-muted, #64748b)' }}>Khối lượng:</span>
                                    <strong>{valueOf(order, 'weight', 'product_weight') || '—'}g</strong>
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-muted, #64748b)' }}>Kích thước:</span>
                                    <strong>
                                      {valueOf(order, 'length') && valueOf(order, 'width') && valueOf(order, 'height')
                                        ? `${valueOf(order, 'length')}x${valueOf(order, 'width')}x${valueOf(order, 'height')}cm`
                                        : 'Chuẩn theo hãng'}
                                    </strong>
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ color: 'var(--text-muted, #64748b)' }}>Tiền COD:</span>
                                    <strong style={{ color: '#10b981', fontSize: 13.5 }}>{Number(cod).toLocaleString('vi-VN')}đ</strong>
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ color: 'var(--text-muted, #64748b)' }}>Cước phí:</span>
                                    <span style={{
                                      fontSize: 11,
                                      fontWeight: 700,
                                      padding: '2px 6px',
                                      borderRadius: 4,
                                      background: isRecipientFee ? '#eff6ff' : '#f8fafc',
                                      color: isRecipientFee ? '#2563eb' : '#64748b',
                                      border: isRecipientFee ? '1px solid #bfdbfe' : '1px solid #e2e8f0'
                                    }}>
                                      {isRecipientFee ? 'Khách trả cước' : 'Shop trả cước'}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Khối 3: Trạng thái giao & Webhook */}
                              <div style={{
                                background: '#ffffff',
                                padding: '14px 16px',
                                borderRadius: 10,
                                border: '1px solid #e2e8f0',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                              }}>
                                <div style={{ fontWeight: 700, color: 'var(--primary, #2563eb)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                                  <Activity size={15} />
                                  <span>Trạng thái giao & Webhook</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
                                  <span style={{
                                    background: statusMeta.bg,
                                    color: statusMeta.color,
                                    border: `1px solid ${statusMeta.border}`,
                                    padding: '3px 8px',
                                    borderRadius: 6,
                                    fontWeight: 700,
                                    fontSize: 11.5,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4
                                  }}>
                                    {statusMeta.label}
                                  </span>

                                  {(actualFee || actualWeight) ? (
                                    <div style={{ fontSize: 11.5, color: '#64748b', display: 'flex', gap: 8 }}>
                                      {actualFee ? <span>Cước: <b style={{ color: '#0f172a' }}>{Number(actualFee).toLocaleString('vi-VN')}đ</b></span> : null}
                                      {actualWeight ? <span>KL cân: <b style={{ color: '#0f172a' }}>{actualWeight}g</b></span> : null}
                                    </div>
                                  ) : null}

                                  <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                                    {Array.isArray(logs) && logs.length > 0 && (
                                      <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); setSelectedJourneyOrder(order); }}
                                        style={{
                                          background: '#f1f5f9',
                                          border: '1px solid #cbd5e1',
                                          borderRadius: 6,
                                          padding: '4px 9px',
                                          fontSize: 11.5,
                                          color: '#334155',
                                          fontWeight: 600,
                                          cursor: 'pointer',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: 4
                                        }}
                                        title="Xem chi tiết các mốc hành trình VNPost cập nhật qua Webhook"
                                      >
                                        <History size={12} color="#475569" />
                                        Hành trình ({logs.length})
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); setSelectedTimelineOrder(order); }}
                                      style={{
                                        background: '#f1f5f9',
                                        border: '1px solid #cbd5e1',
                                        borderRadius: 6,
                                        padding: '4px 9px',
                                        fontSize: 11.5,
                                        color: '#0f172a',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 4
                                      }}
                                      title="Xem toàn bộ nhật ký vòng đời (Order Event Timeline)"
                                    >
                                      <Clock size={12} color="#475569" />
                                      Nhật ký
                                    </button>

                                    {storageSource !== 'cloud' && (
                                      <button
                                        type="button"
                                        disabled={syncingOrderId === orderId}
                                        onClick={(e) => { e.stopPropagation(); handleSyncSingleOrder(order); }}
                                        title="Đồng bộ ngay đơn này lên Cloud"
                                        style={{
                                          background: '#eff6ff',
                                          border: '1px solid #bfdbfe',
                                          color: '#1d4ed8',
                                          borderRadius: 6,
                                          padding: '4px 9px',
                                          fontSize: 11.5,
                                          fontWeight: 600,
                                          cursor: 'pointer',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: 4
                                        }}
                                      >
                                        <UploadCloud size={12} className={syncingOrderId === orderId ? 'spin' : ''} />
                                        {syncingOrderId === orderId ? 'Đang gửi...' : 'Đồng bộ Cloud'}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Khối 4: Địa chỉ nhận & Thao tác */}
                              <div style={{
                                background: '#ffffff',
                                padding: '14px 16px',
                                borderRadius: 10,
                                border: '1px solid #e2e8f0',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                              }}>
                                <div style={{ fontWeight: 700, color: 'var(--primary, #2563eb)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                                  <MapPin size={15} />
                                  <span>Địa chỉ nhận & Thao tác</span>
                                </div>
                                <div style={{ color: 'var(--text-main, #0f172a)', marginBottom: 10, lineHeight: 1.4, fontSize: 12.5 }}>
                                  {address}
                                </div>
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                  {trackingUrl && (
                                    <a
                                      href={trackingUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 5,
                                        padding: '6px 12px',
                                        background: '#2563eb',
                                        color: '#ffffff',
                                        borderRadius: 6,
                                        fontSize: 12,
                                        fontWeight: 700,
                                        textDecoration: 'none',
                                        boxShadow: '0 1px 3px rgba(37,99,235,0.2)'
                                      }}
                                    >
                                      <span>🚀</span> Tra cứu trên {carrier}
                                      <ExternalLink size={12} />
                                    </a>
                                  )}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const copyPayload = `Khách hàng: ${customerName} - SĐT: ${phone}\nĐịa chỉ: ${address}\nĐơn hàng: ${orderCode} - Vận đơn: ${tracking || 'Chưa có'}\nTiền COD: ${cod.toLocaleString('vi-VN')}đ (${carrier})`;
                                      copyText(copyPayload, `full_${orderId}`);
                                    }}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 5,
                                      padding: '6px 12px',
                                      background: '#f1f5f9',
                                      border: '1px solid #cbd5e1',
                                      borderRadius: 6,
                                      fontSize: 12,
                                      fontWeight: 600,
                                      color: copiedId === `full_${orderId}` ? '#10b981' : 'var(--text-main, #0f172a)',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    {copiedId === `full_${orderId}` ? <Check size={12} /> : <Copy size={12} />}
                                    {copiedId === `full_${orderId}` ? 'Đã sao chép' : 'Sao chép thông tin'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* PAGINATION */}
        {!loading && filtered.length > 0 && (
          <Pagination
            page={page}
            pageSize={pageSize}
            total={filtered.length}
            onPageChange={setPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setPage(1);
            }}
            pageSizeOptions={[10, 25, 50, 100]}
            itemLabel="đơn hàng"
          />
        )}
      </div>

      {/* TIMELINE MODAL FOR WEBHOOK LOGS */}
      {selectedJourneyOrder && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '14px',
            width: '100%',
            maxWidth: '560px',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid var(--border)',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#f8fafc'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <History size={18} color="#2563eb" /> Lịch Sử Hành Trình Vận Đơn
                </h3>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                  Mã đơn: <b>{valueOf(selectedJourneyOrder, 'orderCode', 'order_code')}</b> | Vận đơn: <b style={{ color: '#2563eb' }}>{valueOf(selectedJourneyOrder, 'trackingCode', 'tracking_code')}</b>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedJourneyOrder(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '6px',
                  color: '#64748b'
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
              {(() => {
                const logs = selectedJourneyOrder.webhookLogs || selectedJourneyOrder.webhook_logs || [];
                if (!Array.isArray(logs) || logs.length === 0) {
                  return (
                    <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8', fontSize: '13px' }}>
                      Chưa có dữ liệu hành trình webhook cho đơn hàng này.
                    </div>
                  );
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
                        <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
                          {formatDate(log.statusDate || log.date || log.time || log.created_at || log.timestamp || log.receivedAt)}
                        </div>
                        <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#1e293b', marginTop: '2px' }}>
                          {log.statusName || log.statusDesc || log.status_desc || log.status || 'Cập nhật trạng thái'}
                        </div>
                        {(log.location || log.postman || log.note || log.totalFee || log.weight) && (
                          <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px', background: '#f8fafc', padding: '6px 10px', borderRadius: '6px' }}>
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

            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setSelectedJourneyOrder(null)}
                style={{
                  background: '#e2e8f0',
                  color: '#334155',
                  border: 'none',
                  padding: '7px 16px',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedTimelineOrder && (
        <OrderTimelineDrawer
          orderId={selectedTimelineOrder.id || selectedTimelineOrder.order_id}
          orderCode={valueOf(selectedTimelineOrder, 'order_code', 'orderCode')}
          onClose={() => setSelectedTimelineOrder(null)}
        />
      )}
    </div>
  );
}
