import React, { useState, useMemo, useEffect } from 'react';
import {
  Package, Search, X, ExternalLink, Copy, Check,
  FileSpreadsheet, User, Phone, Clock, Truck, DollarSign,
  AlertCircle, Filter, ArrowUpDown, MapPin, Layers, Laptop,
  ChevronDown, ChevronRight, Calendar, Cloud, Monitor, FileText
} from 'lucide-react';
import Pagination from './Pagination';
import { TIME_PRESETS, isOrderInTimePreset } from '../utils/timeFilter.js';

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
  if (!order) return '';
  for (const key of keys) {
    const value = order[key] ?? order.parsedData?.[key];
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
  return raw;
};

const getCarrierTrackingUrl = (platform, trackingCode) => {
  if (!trackingCode || trackingCode === '-' || trackingCode === '—') return null;
  const p = String(platform || '').toLowerCase();
  if (p.includes('jt') || p.includes('j&t')) {
    return `https://jtexpress.vn/vi/tracking?billcode=${encodeURIComponent(trackingCode)}`;
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

const getStorageSource = (order) => (order?.isCloud === true || order?.is_cloud === true) ? 'cloud' : 'local';

export default function DeviceOrdersModal({
  isOpen,
  onClose,
  device,
  orders = [],
  initialTimePreset = 'ALL',
  onNavigateToAllOrders
}) {
  const [search, setSearch] = useState('');
  const [carrierFilter, setCarrierFilter] = useState('all'); // all | vnpost | jt
  const [statusFilter, setStatusFilter] = useState('all'); // all | has_tracking | no_tracking
  const [timeFilter, setTimeFilter] = useState(initialTimePreset || 'ALL'); // ALL | TODAY | YESTERDAY | LAST_7_DAYS | THIS_MONTH
  const [sortBy, setSortBy] = useState('time_desc'); // time_desc | time_asc | cod_desc | cod_asc
  const [copiedId, setCopiedId] = useState('');
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  
  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Sync initialTimePreset if it changes from parent
  useEffect(() => {
    if (initialTimePreset) {
      setTimeFilter(initialTimePreset);
    }
  }, [initialTimePreset]);

  // Reset to page 1 on filter/search change
  useEffect(() => {
    setPage(1);
  }, [search, carrierFilter, statusFilter, timeFilter, sortBy]);

  // Close modal on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Extract device orders
  const rawOrders = useMemo(() => {
    if (Array.isArray(orders) && orders.length > 0) return orders;
    if (device && Array.isArray(device.orders) && device.orders.length > 0) return device.orders;
    return [];
  }, [orders, device]);

  // Filter and sort orders
  const filteredOrders = useMemo(() => {
    const q = search.trim();
    const cleanQ = removeVietnameseTones(q);
    const qDigits = normalizePhone(q);

    let list = rawOrders.filter(order => {
      // 0. Filter by time preset
      if (timeFilter !== 'ALL') {
        if (!isOrderInTimePreset(order, timeFilter)) return false;
      }

      // 1. Filter by carrier
      if (carrierFilter !== 'all') {
        const p = String(valueOf(order, 'platform')).toLowerCase();
        if (carrierFilter === 'vnpost' && !p.includes('vnpost') && !p.includes('vietnam')) return false;
        if (carrierFilter === 'jt' && !p.includes('jt') && !p.includes('j&t')) return false;
      }

      // 2. Filter by tracking code status
      if (statusFilter !== 'all') {
        const tracking = String(valueOf(order, 'trackingCode', 'tracking_code')).trim();
        const hasTracking = tracking && tracking !== '-' && tracking !== '—' && tracking !== 'chờ cập nhật mã';
        if (statusFilter === 'has_tracking' && !hasTracking) return false;
        if (statusFilter === 'no_tracking' && hasTracking) return false;
      }

      // 3. Search query
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

    // Sort list
    list.sort((a, b) => {
      const timeA = new Date(valueOf(a, 'submittedAt', 'submitted_at', 'createdAt', 'created_at') || 0).getTime();
      const timeB = new Date(valueOf(b, 'submittedAt', 'submitted_at', 'createdAt', 'created_at') || 0).getTime();
      const codA = Number(valueOf(a, 'codAmount', 'cod_amount')) || 0;
      const codB = Number(valueOf(b, 'codAmount', 'cod_amount')) || 0;

      if (sortBy === 'time_desc') return timeB - timeA;
      if (sortBy === 'time_asc') return timeA - timeB;
      if (sortBy === 'cod_desc') return codB - codA;
      if (sortBy === 'cod_asc') return codA - codB;
      return timeB - timeA;
    });

    return list;
  }, [rawOrders, carrierFilter, statusFilter, search, sortBy]);

  const paginatedOrders = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, page, pageSize]);

  // Summary statistics
  const stats = useMemo(() => {
    let totalCod = 0;
    let hasTrackingCount = 0;
    let recipientFeeCount = 0;
    let senderFeeCount = 0;

    filteredOrders.forEach(o => {
      totalCod += Number(valueOf(o, 'codAmount', 'cod_amount')) || 0;
      const tr = String(valueOf(o, 'trackingCode', 'tracking_code')).trim();
      if (tr && tr !== '-' && tr !== '—' && tr !== 'chờ cập nhật mã') {
        hasTrackingCount++;
      }
      if (isRecipientPayingFee(o)) recipientFeeCount++;
      else senderFeeCount++;
    });

    return {
      totalCount: filteredOrders.length,
      totalCod,
      hasTrackingCount,
      recipientFeeCount,
      senderFeeCount
    };
  }, [filteredOrders]);

  const copyText = (text, id) => {
    if (!text || text === '-' || text === '—') return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(''), 2000);
  };

  const exportToCsv = () => {
    if (filteredOrders.length === 0) return;

    const headers = [
      'STT',
      'Thời gian gửi',
      'Tên người nhận',
      'Số điện thoại',
      'Mã đơn hàng',
      'Mã vận đơn',
      'Tiền thu hộ COD (VNĐ)',
      'Người trả cước',
      'Hãng vận chuyển',
      'Tài khoản bưu điện lên đơn',
      'Máy trạm lên đơn',
      'Nhân viên',
      'Địa chỉ giao hàng',
      'Ghi chú sản phẩm'
    ];

    const rows = filteredOrders.map((o, idx) => [
      idx + 1,
      `"${formatDate(valueOf(o, 'submittedAt', 'submitted_at', 'createdAt', 'created_at'))}"`,
      `"${getCleanCustomerName(o).replace(/"/g, '""')}"`,
      `"\t${valueOf(o, 'phone')}"`,
      `"${valueOf(o, 'orderCode', 'order_code').replace(/"/g, '""')}"`,
      `"\t${valueOf(o, 'trackingCode', 'tracking_code')}"`,
      `"${Number(valueOf(o, 'codAmount', 'cod_amount') || 0)}"`,
      `"${isRecipientPayingFee(o) ? 'Người nhận trả' : 'Shop trả'}"`,
      `"${carrierLabel(valueOf(o, 'platform'))}"`,
      `"${getCarrierAccount(o).replace(/"/g, '""')}"`,
      `"${(device?.device_name || valueOf(o, 'device_name', 'deviceName') || 'Máy trạm').replace(/"/g, '""')}"`,
      `"${(device?.staff_name || valueOf(o, 'created_by_name', 'staff_name') || 'Nhân viên').replace(/"/g, '""')}"`,
      `"${String(valueOf(o, 'address')).replace(/"/g, '""')}"`,
      `"${String(valueOf(o, 'product_note', 'productNote') || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const staffFileLabel = (device?.staff_name || 'May_Tram').replace(/[^a-zA-Z0-9_\u00C0-\u1EF9]/g, '_');
    link.download = `Don_Hang_${staffFileLabel}_${new Date().toISOString().substring(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  const staffName = device?.staff_name || device?.full_name || 'Nhân viên kho';
  const deviceName = device?.device_name || 'Google Chrome';
  const rawId = String(device?.device_id || device?.id || '').replace(/^dev_/, '');
  const shortDevId = rawId ? `#DEV-${rawId.substring(0, 6).toUpperCase()}` : '#DEV-0000';

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.15s ease-out'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: 'var(--card, #ffffff)',
          color: 'var(--text-main, #0f172a)',
          width: 'min(1150px, 96vw)',
          maxHeight: '92vh',
          borderRadius: 16,
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.3), 0 0 1px 1px rgba(0,0,0,0.05)',
          border: '1px solid var(--border, #e2e8f0)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'slideUp 0.2s ease-out'
        }}
      >
        {/* MODAL HEADER */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--border, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.04), rgba(59, 130, 246, 0.08))'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                color: '#ffffff',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
                boxShadow: '0 4px 10px rgba(37, 99, 235, 0.25)'
              }}
            >
              <Package size={22} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--text-main, #0f172a)' }}>
                  Danh Sách Đơn Đã Lên ({stats.totalCount} đơn)
                </h3>
                <span
                  style={{
                    fontSize: 11,
                    background: '#e0e7ff',
                    color: '#3730a3',
                    padding: '2px 8px',
                    borderRadius: 6,
                    fontFamily: 'monospace',
                    fontWeight: 700
                  }}
                >
                  {shortDevId}
                </span>
                {device?.revoked && (
                  <span style={{ fontSize: 11, background: '#fee2e2', color: '#dc2626', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>
                    Đã khóa
                  </span>
                )}
              </div>
              <p style={{ margin: '3px 0 0 0', fontSize: 13, color: 'var(--text-muted, #64748b)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span>👤 Nhân viên: <strong style={{ color: 'var(--text-main, #0f172a)' }}>{staffName}</strong></span>
                <span>•</span>
                <span>💻 Máy: <strong style={{ color: 'var(--text-main, #0f172a)' }}>{deviceName}</strong></span>
                {device?.last_seen && (
                  <>
                    <span>•</span>
                    <span style={{ color: '#059669', display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Clock size={12} /> {relativeTime(device.last_seen)}
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={exportToCsv}
              disabled={filteredOrders.length === 0}
              title="Xuất danh sách đơn của máy này ra file Excel (.CSV)"
              style={{
                background: '#f0fdf4',
                color: '#166534',
                border: '1px solid #bbf7d0',
                padding: '8px 14px',
                borderRadius: 8,
                fontWeight: 600,
                fontSize: 12.5,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                cursor: filteredOrders.length === 0 ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <FileSpreadsheet size={15} />
              <span className="hide-sm">Xuất Excel</span>
            </button>
            <button
              onClick={onClose}
              aria-label="Đóng"
              style={{
                background: 'transparent',
                border: '1px solid var(--border, #e2e8f0)',
                color: 'var(--text-muted, #64748b)',
                borderRadius: 8,
                width: 36,
                height: 36,
                display: 'grid',
                placeItems: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#fee2e2';
                e.currentTarget.style.color = '#dc2626';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--text-muted, #64748b)';
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* MODAL KPI STATS ROW */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
            padding: '14px 24px',
            background: 'var(--bg, #f8fafc)',
            borderBottom: '1px solid var(--border, #e2e8f0)'
          }}
        >
          <div style={{ background: 'var(--card, #fff)', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border, #e2e8f0)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase' }}>TỔNG ĐƠN MÁY ĐÃ LÊN</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--primary, #2563eb)', marginTop: 2 }}>
              {stats.totalCount.toLocaleString('vi-VN')} <span style={{ fontSize: 13, fontWeight: 600 }}>đơn</span>
            </div>
          </div>

          <div style={{ background: 'var(--card, #fff)', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border, #e2e8f0)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase' }}>TỔNG TIỀN COD</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#10b981', marginTop: 2 }}>
              {stats.totalCod.toLocaleString('vi-VN')}đ
            </div>
          </div>

          <div style={{ background: 'var(--card, #fff)', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border, #e2e8f0)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase' }}>CÓ MÃ VẬN ĐƠN</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0284c7', marginTop: 2 }}>
              {stats.hasTrackingCount} / {stats.totalCount} <span style={{ fontSize: 12, fontWeight: 600 }}>({stats.totalCount > 0 ? Math.round((stats.hasTrackingCount / stats.totalCount) * 100) : 0}%)</span>
            </div>
          </div>

          <div style={{ background: 'var(--card, #fff)', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border, #e2e8f0)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase' }}>NGƯỜI TRẢ CƯỚC</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main, #0f172a)', marginTop: 4, display: 'flex', gap: 6 }}>
              <span style={{ color: '#2563eb' }}>Khách: {stats.recipientFeeCount}</span>
              <span>•</span>
              <span style={{ color: '#ea580c' }}>Shop: {stats.senderFeeCount}</span>
            </div>
          </div>
        </div>

        {/* SEARCH & FILTERS BAR */}
        <div
          style={{
            padding: '12px 24px',
            borderBottom: '1px solid var(--border, #e2e8f0)',
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            flexWrap: 'wrap',
            background: 'var(--card, #fff)'
          }}
        >
          {/* Search Input */}
          <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 200 }}>
            <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted, #94a3b8)' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tên khách, SĐT, mã đơn, mã vận đơn, địa chỉ..."
              style={{
                width: '100%',
                padding: '7px 10px 7px 32px',
                fontSize: 13,
                borderRadius: 8,
                border: '1px solid var(--border, #cbd5e1)',
                background: 'var(--bg, #f8fafc)',
                color: 'var(--text-main, #0f172a)',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted, #94a3b8)',
                  padding: 2
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Time Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted, #64748b)' }}>Thời gian:</span>
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
              style={{
                padding: '6px 10px',
                borderRadius: 6,
                border: '1px solid var(--border, #cbd5e1)',
                fontSize: 12.5,
                background: 'var(--card, #fff)',
                color: 'var(--text-main, #0f172a)',
                fontWeight: timeFilter !== 'ALL' ? 700 : 500,
                cursor: 'pointer'
              }}
            >
              {TIME_PRESETS.map(preset => (
                <option key={preset.id} value={preset.id}>{preset.label}</option>
              ))}
            </select>
          </div>

          {/* Carrier Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted, #64748b)' }}>Hãng:</span>
            <select
              value={carrierFilter}
              onChange={(e) => setCarrierFilter(e.target.value)}
              style={{
                padding: '6px 10px',
                borderRadius: 6,
                border: '1px solid var(--border, #cbd5e1)',
                fontSize: 12.5,
                background: 'var(--card, #fff)',
                color: 'var(--text-main, #0f172a)',
                cursor: 'pointer'
              }}
            >
              <option value="all">Tất cả hãng</option>
              <option value="vnpost">VNPost</option>
              <option value="jt">J&T Express</option>
            </select>
          </div>

          {/* Tracking Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted, #64748b)' }}>Mã vận đơn:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: '6px 10px',
                borderRadius: 6,
                border: '1px solid var(--border, #cbd5e1)',
                fontSize: 12.5,
                background: 'var(--card, #fff)',
                color: 'var(--text-main, #0f172a)',
                cursor: 'pointer'
              }}
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="has_tracking">Đã có mã vận đơn</option>
              <option value="no_tracking">Chưa có mã vận đơn</option>
            </select>
          </div>

          {/* Sort By */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted, #64748b)' }}>Sắp xếp:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                padding: '6px 10px',
                borderRadius: 6,
                border: '1px solid var(--border, #cbd5e1)',
                fontSize: 12.5,
                background: 'var(--card, #fff)',
                color: 'var(--text-main, #0f172a)',
                cursor: 'pointer'
              }}
            >
              <option value="time_desc">Mới nhất trước</option>
              <option value="time_asc">Cũ nhất trước</option>
              <option value="cod_desc">Tiền COD cao nhất</option>
              <option value="cod_asc">Tiền COD thấp nhất</option>
            </select>
          </div>
        </div>

        {/* ORDERS TABLE SECTION (SCROLLABLE) */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', minHeight: 280, maxHeight: 'calc(92vh - 300px)' }}>
          {filteredOrders.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted, #64748b)' }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>📦</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main, #0f172a)' }}>
                {rawOrders.length === 0 ? 'Máy này chưa phát sinh đơn hàng nào' : 'Không tìm thấy đơn hàng phù hợp'}
              </div>
              <div style={{ fontSize: 13, marginTop: 4 }}>
                {rawOrders.length === 0
                  ? 'Khi nhân viên sử dụng Extension để lên đơn, các đơn sẽ tự động xuất hiện tại đây.'
                  : 'Hãy thử thay đổi từ khóa tìm kiếm hoặc bỏ chọn các bộ lọc.'}
              </div>
              {search && (
                <button
                  className="btn-secondary btn-sm"
                  onClick={() => setSearch('')}
                  style={{ marginTop: 14 }}
                >
                  Xóa từ khóa tìm kiếm
                </button>
              )}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 920, fontSize: 13 }}>
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
                {paginatedOrders.map((order, index) => {
                  const orderId = String(order.id || order.saved_order_id || index);
                  const cleanName = getCleanCustomerName(order);
                  const phone = valueOf(order, 'phone');
                  const orderCode = valueOf(order, 'orderCode', 'order_code') || '-';
                  const trackingCode = valueOf(order, 'trackingCode', 'tracking_code');
                  const hasTracking = trackingCode && trackingCode !== '-' && trackingCode !== '—' && trackingCode !== 'chờ cập nhật mã';
                  const platform = valueOf(order, 'platform');
                  const trackingUrl = getCarrierTrackingUrl(platform, trackingCode);
                  const isRecipientFee = isRecipientPayingFee(order);
                  const cod = Number(valueOf(order, 'codAmount', 'cod_amount')) || 0;
                  const address = valueOf(order, 'address') || '-';
                  const carrier = carrierLabel(platform);
                  const account = getCarrierAccount(order);
                  const submittedAt = valueOf(order, 'submittedAt', 'submitted_at', 'createdAt', 'created_at');
                  const productNote = valueOf(order, 'product_note', 'productNote', 'extraNote');
                  const storageSource = getStorageSource(order);

                  const rawText = valueOf(order, 'rawText', 'raw_text', 'originalText', 'text', 'rawOrder', 'raw_order', 'content', 'input') || (
                    [
                      cleanName && cleanName !== '-' ? `Khách hàng: ${cleanName}` : '',
                      phone ? `SĐT: ${phone}` : '',
                      address && address !== '-' ? `Địa chỉ: ${address}` : '',
                      orderCode && orderCode !== '-' ? `Mã đơn: ${orderCode}` : '',
                      cod > 0 ? `Tiền COD: ${cod.toLocaleString('vi-VN')}đ` : (order.codAmount !== undefined ? `Tiền COD: 0đ` : ''),
                      valueOf(order, 'note', 'extraNote') ? `Ghi chú: ${valueOf(order, 'note', 'extraNote')}` : ''
                    ].filter(Boolean).join('\n')
                  );

                  return (
                    <React.Fragment key={orderId}>
                      <tr
                        onClick={() => setExpandedOrderId(prev => prev === orderId ? null : orderId)}
                        style={{
                          borderBottom: expandedOrderId === orderId ? 'none' : '1px solid var(--border, #f1f5f9)',
                          background: expandedOrderId === orderId ? 'rgba(59, 130, 246, 0.05)' : 'transparent',
                          cursor: 'pointer',
                          transition: 'background 0.15s ease'
                        }}
                        onMouseEnter={(e) => { if (expandedOrderId !== orderId) e.currentTarget.style.background = 'rgba(59, 130, 246, 0.03)'; }}
                        onMouseLeave={(e) => { if (expandedOrderId !== orderId) e.currentTarget.style.background = 'transparent'; }}
                        title="Bấm để mở rộng / thu gọn chi tiết hàng hóa, thông số kiện & hành trình vận đơn"
                      >
                        {/* STT with Chevron */}
                        <td style={{ padding: '12px 14px', color: 'var(--text-muted, #94a3b8)', fontWeight: 600 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ color: 'var(--primary, #2563eb)', display: 'inline-flex' }}>
                              {expandedOrderId === orderId ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </span>
                            <span>{index + 1}</span>
                          </div>
                        </td>

                        {/* Thời gian */}
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

                        {/* Khách hàng & SĐT */}
                        <td style={{ padding: '12px 14px', minWidth: 160 }}>
                          <div style={{ fontWeight: 700, color: 'var(--text-main, #0f172a)' }}>
                            {cleanName}
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
                                onClick={(e) => { e.stopPropagation(); copyText(phone, `phone_${orderId}`); }}
                                title="Sao chép số điện thoại"
                                style={{
                                  border: 'none',
                                  background: 'transparent',
                                  cursor: 'pointer',
                                  padding: 0,
                                  color: copiedId === `phone_${orderId}` ? '#10b981' : 'var(--text-muted, #94a3b8)'
                                }}
                              >
                                {copiedId === `phone_${orderId}` ? <Check size={12} /> : <Copy size={12} />}
                              </button>
                            </div>
                          )}
                        </td>

                        {/* Mã đơn hàng */}
                        <td style={{ padding: '12px 14px' }}>
                          {orderCode && orderCode !== '-' ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-main, #0f172a)' }}>
                                {orderCode}
                              </span>
                              <button
                                onClick={(e) => { e.stopPropagation(); copyText(orderCode, `code_${orderId}`); }}
                                title="Sao chép mã đơn hàng"
                                style={{
                                  border: 'none',
                                  background: 'transparent',
                                  cursor: 'pointer',
                                  padding: 0,
                                  color: copiedId === `code_${orderId}` ? '#10b981' : 'var(--text-muted, #94a3b8)'
                                }}
                              >
                                {copiedId === `code_${orderId}` ? <Check size={12} /> : <Copy size={12} />}
                              </button>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted, #94a3b8)' }}>-</span>
                          )}
                        </td>

                        {/* Địa chỉ */}
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

                        {/* Tiền COD */}
                        <td style={{ padding: '12px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <span style={{ fontWeight: 800, color: cod > 0 ? '#10b981' : 'var(--text-muted, #64748b)', fontSize: 13.5 }}>
                            {cod.toLocaleString('vi-VN')}đ
                          </span>
                        </td>

                        {/* Cước phí */}
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

                        {/* Mã vận đơn */}
                        <td style={{ padding: '12px 14px' }}>
                          {hasTracking ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#0284c7' }}>
                                {trackingCode}
                              </span>
                              <button
                                onClick={(e) => { e.stopPropagation(); copyText(trackingCode, `track_${orderId}`); }}
                                title="Sao chép mã vận đơn"
                                style={{
                                  border: 'none',
                                  background: 'transparent',
                                  cursor: 'pointer',
                                  padding: 0,
                                  color: copiedId === `track_${orderId}` ? '#10b981' : 'var(--text-muted, #94a3b8)'
                                }}
                              >
                                {copiedId === `track_${orderId}` ? <Check size={12} /> : <Copy size={12} />}
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

                        {/* Hãng & Tài khoản bưu điện */}
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
                          {account && account !== 'Mặc định' && (
                            <div style={{ fontSize: 11, color: 'var(--text-muted, #64748b)', marginTop: 2 }}>
                              TK: {account}
                            </div>
                          )}
                        </td>

                        {/* Lưu trữ */}
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

                              {/* Khối 2: Thông số kiện & Cước */}
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

                              {/* Khối 3: Địa chỉ & Hành trình vận đơn */}
                              <div style={{ background: '#ffffff', padding: '12px 14px', borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                                <div style={{ fontWeight: 700, color: 'var(--primary, #2563eb)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span>📍</span> Địa chỉ nhận & Thao tác
                                </div>
                                <div style={{ color: 'var(--text-main, #0f172a)', marginBottom: 8, lineHeight: 1.4 }}>
                                  {address}
                                </div>
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
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
                                      const copyPayload = `Khách hàng: ${cleanName} - SĐT: ${phone}\nĐịa chỉ: ${address}\nĐơn hàng: ${orderCode} - Vận đơn: ${trackingCode || 'Chưa có'}\nTiền COD: ${cod.toLocaleString('vi-VN')}đ (${carrier})`;
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
          )}
        </div>

        {/* MODAL PAGINATION */}
        {filteredOrders.length > 0 && (
          <Pagination
            page={page}
            pageSize={pageSize}
            total={filteredOrders.length}
            onPageChange={setPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setPage(1);
            }}
            pageSizeOptions={[10, 25, 50]}
            itemLabel="đơn hàng"
          />
        )}

        {/* MODAL FOOTER */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid var(--border, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            background: 'var(--surface-muted, #f8fafc)',
            flexWrap: 'wrap'
          }}
        >
          <div style={{ fontSize: 12.5, color: 'var(--text-muted, #64748b)' }}>
            Hiển thị <strong>{filteredOrders.length}</strong> / <strong>{rawOrders.length}</strong> đơn của máy này
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {onNavigateToAllOrders && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNavigateToAllOrders(device, timeFilter);
                }}
                className="btn-secondary"
                style={{ fontSize: 12.5, padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <span>📦</span> Xem trên trang Đơn Hàng Đã Gửi
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="btn-primary"
              style={{ fontSize: 12.5, padding: '7px 18px' }}
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
