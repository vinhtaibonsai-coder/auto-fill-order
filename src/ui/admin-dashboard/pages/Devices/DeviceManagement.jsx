import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Laptop, RefreshCw, CheckCircle2, XCircle, Building2, Store,
  Search, Users, Activity, Layers, ArrowRightLeft, Clock,
  AlertTriangle, ShieldAlert, ShieldCheck, Edit2, Trash2, Eye,
  Copy, Check, Radio, Wifi, WifiOff, Power, SlidersHorizontal,
  ChevronRight, Filter
} from 'lucide-react';
import { AdminService } from '../../../../domain/admin/admin.service.js';
import { RealtimeService } from '../../../../domain/realtime/realtime.service.esm.js';
import { SkeletonHeroKpis, SkeletonTableRows } from '../../components/Skeleton';
import DeviceOrdersModal from '../../modals/DeviceOrdersModal';
import AssignDeviceShopModal from '../../modals/AssignDeviceShopModal';
import EditDeviceNameModal from '../../modals/EditDeviceNameModal';
import EditShopMaxDevicesModal from '../../modals/EditShopMaxDevicesModal';

const getDeviceBadge = (device) => {
  const rawId = String(device.device_id || device.id || '').replace(/^dev_/, '');
  const shortId = rawId.substring(0, 6).toUpperCase();
  return `#DEV-${shortId || '0000'}`;
};

export default function DeviceManagement() {
  const [rows, setRows] = useState([]);
  const [shopsList, setShopsList] = useState([]);
  const [selectedShopId, setSelectedShopId] = useState('ALL'); // 'ALL' | shop_id | 'UNASSIGNED'
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'ONLINE' | 'RECENT' | 'OFFLINE' | 'REVOKED'
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [lastScannedTime, setLastScannedTime] = useState(new Date());

  // Modals state
  const [ordersModalDevice, setOrdersModalDevice] = useState(null);
  const [assignModalDevice, setAssignModalDevice] = useState(null);
  const [editNameModalDevice, setEditNameModalDevice] = useState(null);
  const [editMaxModalShop, setEditMaxModalShop] = useState(null);

  const loadData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const [devRes, shopRes] = await Promise.all([
        AdminService.listDevices(),
        AdminService.getShopsList().catch(() => ({ success: false, data: [] }))
      ]);

      if (Array.isArray(devRes)) {
        setRows(devRes);
      } else if (devRes?.success && Array.isArray(devRes.data)) {
        setRows(devRes.data);
      }

      if (shopRes?.success && Array.isArray(shopRes.data)) {
        setShopsList(shopRes.data);
      }
      setLastScannedTime(new Date());
    } catch (e) {
      console.error('Lỗi nạp thiết bị:', e);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const handleRefresh = () => loadData(true);
    window.addEventListener('admin:refresh_data', handleRefresh);
    return () => window.removeEventListener('admin:refresh_data', handleRefresh);
  }, [loadData]);

  // Auto-Refresh nhịp tim mỗi 30 giây
  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => {
      loadData(true);
    }, 30000);
    return () => clearInterval(timer);
  }, [autoRefresh, loadData]);

  // Phương Án 1: Lắng nghe hiện diện trực tuyến (Presence) qua Realtime WebSocket
  const [onlinePresenceByShop, setOnlinePresenceByShop] = useState({});

  const shopIdsKey = useMemo(() => {
    const s = new Set();
    if (selectedShopId && selectedShopId !== 'ALL' && selectedShopId !== 'UNASSIGNED') {
      s.add(selectedShopId);
    } else {
      shopsList.forEach(x => { if (x.id) s.add(x.id); });
      rows.forEach(d => { if (d.shop_id) s.add(d.shop_id); });
    }
    return Array.from(s).sort().join(',');
  }, [selectedShopId, shopsList, rows]);

  useEffect(() => {
    let cancelled = false;
    const unsubscribers = [];
    const shopIds = shopIdsKey ? shopIdsKey.split(',').filter(Boolean) : [];

    if (shopIds.length === 0) return;

    (async () => {
      for (const shopId of shopIds) {
        if (cancelled) break;
        try {
          const unsub = await RealtimeService.subscribeWorkstationPresence(shopId, (shopOnlineMap) => {
            if (cancelled) return;
            setOnlinePresenceByShop(prev => ({
              ...prev,
              [shopId]: shopOnlineMap
            }));
          });
          if (cancelled) {
            if (typeof unsub === 'function') unsub();
          } else if (typeof unsub === 'function') {
            unsubscribers.push(unsub);
          }
        } catch (e) {
          console.warn('[AdminDevice] subscribeWorkstationPresence error:', e);
        }
      }
    })();

    return () => {
      cancelled = true;
      unsubscribers.forEach(unsub => {
        try { unsub(); } catch (_) {}
      });
    };
  }, [shopIdsKey]);

  const onlinePresenceMap = useMemo(() => {
    const merged = {};
    Object.values(onlinePresenceByShop).forEach(shopMap => {
      if (shopMap && typeof shopMap === 'object') {
        Object.assign(merged, shopMap);
      }
    });
    return merged;
  }, [onlinePresenceByShop]);

  // THUẬT TOÁN XÁC ĐỊNH ONLINE CHUẨN XÁC:
  // Ưu tiên 1: Realtime Presence qua WebSocket (độ trễ 0s)
  // Ưu tiên 2: Fallback last_seen thực tế trong database
  const getDeviceOnlineInfo = useCallback((d) => {
    if (d.revoked) {
      return {
        status: 'revoked',
        text: 'Đã Thu Hồi',
        label: 'Khóa Quyền',
        color: '#ef4444',
        bg: '#fee2e2',
        border: '#fca5a5',
        diffMins: Infinity,
        timeAgo: d.last_seen ? new Date(d.last_seen).toLocaleDateString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : 'Đã khóa'
      };
    }

    const devId = d.device_id || d.id;
    const livePresence = onlinePresenceMap[devId];
    if (livePresence) {
      return {
        status: 'online',
        text: 'Trực tuyến Realtime',
        label: '🟢 Trực tuyến Realtime',
        color: '#16a34a',
        bg: '#f0fdf4',
        border: '#86efac',
        diffMins: 0,
        timeAgo: '🟢 Đang kết nối WebSocket (0s)',
        lastDateFormatted: 'Vừa xong (Realtime)',
        isRealtime: true
      };
    }

    const lastDate = d.last_seen || d.last_active_at;
    if (!lastDate) {
      return {
        status: 'offline',
        text: 'Offline',
        label: 'Chưa Từng Kết Nối',
        color: '#64748b',
        bg: '#f8fafc',
        border: '#e2e8f0',
        diffMins: Infinity,
        timeAgo: 'Chưa có dữ liệu'
      };
    }

    const lastTimeMs = new Date(lastDate).getTime();
    if (isNaN(lastTimeMs)) {
      return {
        status: 'offline',
        text: 'Offline',
        label: 'Không Xác Định',
        color: '#64748b',
        bg: '#f8fafc',
        border: '#e2e8f0',
        diffMins: Infinity,
        timeAgo: 'Thời gian không hợp lệ'
      };
    }

    const now = Date.now();
    const diffMs = Math.max(0, now - lastTimeMs);
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    let detailedTime = '';
    if (diffSecs < 60) {
      detailedTime = 'Vừa xong';
    } else if (diffMins < 60) {
      detailedTime = `${diffMins} phút trước`;
    } else if (diffHours < 24) {
      detailedTime = `${diffHours} giờ ${diffMins % 60}p trước`;
    } else {
      detailedTime = `${diffDays} ngày trước`;
    }

    // 1. ONLINE ĐÚNG NGHĨA: Có tín hiệu nhịp tim hoặc gửi đơn trong vòng 7 phút qua
    if (diffMins <= 7) {
      return {
        status: 'online',
        text: 'Đang Online',
        label: diffSecs < 60 ? '🟢 Đang Online' : `🟢 Online (${diffMins}p)`,
        color: '#16a34a',
        bg: '#f0fdf4',
        border: '#86efac',
        diffMins,
        timeAgo: detailedTime,
        lastDateFormatted: new Date(lastDate).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
      };
    }

    // 2. IDLE / VỪA HOẠT ĐỘNG: Từ 7 đến 30 phút trước
    if (diffMins <= 30) {
      return {
        status: 'recent',
        text: 'Vừa Dùng',
        label: `🟡 Vừa dùng (${diffMins}p trước)`,
        color: '#d97706',
        bg: '#fffbeb',
        border: '#fde68a',
        diffMins,
        timeAgo: detailedTime,
        lastDateFormatted: new Date(lastDate).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
      };
    }

    // 3. OFFLINE: Quá 30 phút
    return {
      status: 'offline',
      text: 'Offline',
      label: `⚪ Offline (${detailedTime})`,
      color: '#64748b',
      bg: '#f8fafc',
      border: '#cbd5e1',
      diffMins,
      timeAgo: detailedTime,
      lastDateFormatted: new Date(lastDate).toLocaleDateString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
    };
  }, [onlinePresenceMap]);

  // Nhận diện trình duyệt & OS
  const getBrowserStyle = (d) => {
    const meta = d.metadata || {};
    const bName = d.browser || meta.browser || d.device_name || 'Google Chrome';
    const isCocCoc = /coccoc|cốc cốc/i.test(bName);
    const isEdge = /edge|edg/i.test(bName);
    const isBrave = /brave/i.test(bName);
    const isFirefox = /firefox/i.test(bName);
    const isOpera = /opera/i.test(bName);

    const color = isCocCoc ? '#10b981' : isEdge ? '#0284c7' : isBrave ? '#f97316' : isFirefox ? '#ea580c' : isOpera ? '#ef4444' : '#2563eb';
    const bg = isCocCoc ? '#ecfdf5' : isEdge ? '#f0f9ff' : isBrave ? '#fff7ed' : isFirefox ? '#fff7ed' : isOpera ? '#fef2f2' : '#eff6ff';
    const os = d.os_info || meta.os || (d.device_name?.includes('Mac') ? 'macOS' : 'Windows');

    return { name: bName, color, bg, os };
  };

  const handleCopyId = (id) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Thao tác thu hồi / kích hoạt
  const handleToggleRevoke = async (device) => {
    const devId = device.device_id || device.id;
    const newRevoked = !device.revoked;
    const msg = newRevoked
      ? `Thu hồi quyền đăng nhập của thiết bị "${device.device_name || devId}"? Thiết bị sẽ bị đăng xuất ngay lập tức!`
      : `Khôi phục và cho phép thiết bị "${device.device_name || devId}" hoạt động trở lại?`;
    if (!window.confirm(msg)) return;

    setActionLoading(devId);
    try {
      const res = await AdminService.revokeDevice(devId, newRevoked);
      if (res.success) {
        setRows(prev => prev.map(d => (d.device_id === devId || d.id === devId) ? { ...d, revoked: newRevoked } : d));
      } else {
        alert('Lỗi: ' + res.error);
      }
    } catch (err) {
      alert('Lỗi kết nối: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Thao tác xóa vĩnh viễn
  const handleDeleteDevice = async (device) => {
    const devId = device.device_id || device.id;
    if (!window.confirm(`Bạn có chắc muốn XÓA VĨNH VIỄN thiết bị "${device.device_name || devId}" khỏi hệ thống?`)) return;

    setActionLoading(devId);
    try {
      const res = await AdminService.deleteDevice(devId);
      if (res.success) {
        setRows(prev => prev.filter(d => d.device_id !== devId && d.id !== devId));
      } else {
        alert('Xóa thất bại: ' + res.error);
      }
    } catch (err) {
      alert('Lỗi: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Thu hồi toàn bộ thiết bị của Shop
  const handleRevokeShop = async (shop) => {
    if (!window.confirm(`CẢNH BÁO: Thu hồi TOÀN BỘ thiết bị của Cửa Hàng "${shop.name}"?\nMọi nhân viên thuộc Shop này sẽ bị đăng xuất!`)) return;

    setActionLoading(shop.id);
    try {
      const res = await AdminService.revokeShopDevices(shop.id);
      if (res.success) {
        setRows(prev => prev.map(d => d.shop_id === shop.id ? { ...d, revoked: true } : d));
        alert(`Đã thu hồi toàn bộ thiết bị của ${shop.name}`);
      } else {
        alert('Lỗi: ' + res.error);
      }
    } catch (err) {
      alert('Lỗi: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCleanupInactive = async () => {
    if (!window.confirm('Hệ thống sẽ dọn dẹp các máy trạm / profile trùng lặp và rác không có đơn hàng. Bạn có muốn tiếp tục?')) return;
    setActionLoading('cleanup');
    try {
      const targetShop = selectedShopId === 'ALL' || selectedShopId === 'UNASSIGNED' ? null : selectedShopId;
      await AdminService.cleanupInactiveDevices(targetShop);
      await loadData(false);
    } catch (e) {
      alert('Lỗi dọn dẹp: ' + e.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Thống kê theo Shop
  const shopDataList = useMemo(() => {
    const map = new Map();

    shopsList.forEach(s => {
      map.set(s.id, {
        id: s.id,
        name: s.name || 'Cửa Hàng',
        shop_code: s.shop_code || 'SHOP',
        owner_name: s.owner_name || s.owner_email || '—',
        max_devices: Number(s.max_devices || 5),
        devices: []
      });
    });

    const unassigned = [];
    rows.forEach(d => {
      if (d.shop_id && map.has(d.shop_id)) {
        map.get(d.shop_id).devices.push(d);
      } else if (d.shop_id) {
        map.set(d.shop_id, {
          id: d.shop_id,
          name: d.shop_name || `Shop #${d.shop_id.slice(0, 6)}`,
          shop_code: d.shop_code || 'SHOP',
          owner_name: '—',
          max_devices: Number(d.max_devices || 5),
          devices: [d]
        });
      } else {
        unassigned.push(d);
      }
    });

    const list = Array.from(map.values());
    if (unassigned.length > 0) {
      list.push({
        id: 'UNASSIGNED',
        name: 'Chưa Gán Cửa Hàng',
        shop_code: 'FREE',
        owner_name: '—',
        max_devices: 999,
        isUnassigned: true,
        devices: unassigned
      });
    }
    return list;
  }, [rows, shopsList]);

  // KPI toàn hệ thống
  const systemKpis = useMemo(() => {
    const total = rows.length;
    let onlineCount = 0;
    let recentCount = 0;
    let offlineCount = 0;
    let revokedCount = 0;

    rows.forEach(d => {
      const info = getDeviceOnlineInfo(d);
      if (info.status === 'revoked') revokedCount++;
      else if (info.status === 'online') onlineCount++;
      else if (info.status === 'recent') recentCount++;
      else offlineCount++;
    });

    return { total, onlineCount, recentCount, offlineCount, revokedCount };
  }, [rows, getDeviceOnlineInfo]);

  // Lọc thiết bị theo Shop đang chọn, theo Trạng Thái Online và Từ Khóa
  const filteredDevices = useMemo(() => {
    let result = rows;

    // Lọc theo Shop
    if (selectedShopId === 'UNASSIGNED') {
      result = result.filter(d => !d.shop_id);
    } else if (selectedShopId !== 'ALL') {
      result = result.filter(d => d.shop_id === selectedShopId);
    }

    // Lọc theo Trạng thái Online/Offline
    if (statusFilter !== 'ALL') {
      result = result.filter(d => {
        const info = getDeviceOnlineInfo(d);
        if (statusFilter === 'ONLINE') return info.status === 'online';
        if (statusFilter === 'RECENT') return info.status === 'recent';
        if (statusFilter === 'OFFLINE') return info.status === 'offline';
        if (statusFilter === 'REVOKED') return info.status === 'revoked';
        return true;
      });
    }

    // Lọc theo Từ khóa tìm kiếm
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(d => {
        const devName = (d.device_name || '').toLowerCase();
        const devId = (d.device_id || d.id || '').toLowerCase();
        const fullName = (d.full_name || '').toLowerCase();
        const email = (d.email || '').toLowerCase();
        const shopName = (d.shop_name || '').toLowerCase();
        const ip = (d.ip_address || '').toLowerCase();
        return devName.includes(q) || devId.includes(q) || fullName.includes(q) || email.includes(q) || shopName.includes(q) || ip.includes(q);
      });
    }

    return result;
  }, [rows, selectedShopId, statusFilter, search, getDeviceOnlineInfo]);

  // Shop hiện đang được chọn
  const activeShop = useMemo(() => {
    if (selectedShopId === 'ALL' || selectedShopId === 'UNASSIGNED') return null;
    return shopDataList.find(s => s.id === selectedShopId) || null;
  }, [selectedShopId, shopDataList]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: '#eff6ff', color: '#2563eb',
              display: 'grid', placeItems: 'center'
            }}>
              <Laptop size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: '#0f172a' }}>
                Quản Lý Thiết Bị Đăng Nhập
              </h2>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                Phân nhóm Shop & theo dõi trạng thái trực tuyến (Online/Offline) chuẩn xác theo thời gian thực
              </div>
            </div>
          </div>
        </div>

        {/* Quick Fast Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            fontWeight: 600,
            color: '#475569',
            background: '#ffffff',
            padding: '6px 12px',
            borderRadius: 8,
            border: '1px solid #cbd5e1',
            cursor: 'pointer'
          }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={e => setAutoRefresh(e.target.checked)}
              style={{ accentColor: '#2563eb' }}
            />
            <span>Tự Động Quét (30s)</span>
          </label>

          <button
            onClick={() => loadData(false)}
            disabled={loading}
            style={{
              background: '#2563eb',
              color: '#ffffff',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)'
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Quét Trực Tuyến Ngay
          </button>
          <button
            onClick={handleCleanupInactive}
            disabled={loading || actionLoading === 'cleanup'}
            title="Dọn dẹp các máy trạm / profile trùng lặp rác không phát sinh đơn hàng"
            style={{
              background: '#f1f5f9',
              color: '#334155',
              border: '1px solid #cbd5e1',
              padding: '8px 14px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <Trash2 size={14} className={actionLoading === 'cleanup' ? 'animate-spin' : ''} />
            Dọn Dẹp Rác (1-Click)
          </button>
        </div>
      </div>

      {/* 4 Hero KPI Cards: Rõ ràng, trực quan, phân định Online đúng nghĩa */}
      {loading ? (
        <SkeletonHeroKpis count={4} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          {/* Tổng máy */}
          <div className="card" style={{ padding: '14px 18px', borderRadius: 12, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: '#eff6ff', color: '#2563eb', display: 'grid', placeItems: 'center' }}>
              <Laptop size={22} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>Tổng Máy Trạm</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a' }}>{systemKpis.total}</div>
            </div>
          </div>

          {/* Đang Online thực sự */}
          <div className="card" style={{ padding: '14px 18px', borderRadius: 12, border: '1px solid #bbf7d0', background: '#f0fdf4', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: '#16a34a', color: '#ffffff', display: 'grid', placeItems: 'center' }}>
              <Wifi size={22} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#15803d', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>Đang Online Thực Sự</span>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} className="animate-ping" />
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#16a34a' }}>{systemKpis.onlineCount}</div>
            </div>
          </div>

          {/* Vừa hoạt động */}
          <div className="card" style={{ padding: '14px 18px', borderRadius: 12, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: '#fffbeb', color: '#d97706', display: 'grid', placeItems: 'center' }}>
              <Clock size={22} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>Vừa Hoạt Động (7-30p)</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#d97706' }}>{systemKpis.recentCount}</div>
            </div>
          </div>

          {/* Offline / Bị khóa */}
          <div className="card" style={{ padding: '14px 18px', borderRadius: 12, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: '#f8fafc', color: '#64748b', display: 'grid', placeItems: 'center' }}>
              <WifiOff size={22} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>Offline / Thu Hồi</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#64748b' }}>
                {systemKpis.offlineCount} <span style={{ fontSize: 13, fontWeight: 500, color: '#ef4444' }}>({systemKpis.revokedCount} khóa)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SHOP SELECTOR TABS: Gọn gàng, không bị vỡ giao diện */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        overflowX: 'auto',
        paddingBottom: 4,
        borderBottom: '1px solid #e2e8f0'
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', whiteSpace: 'nowrap', marginRight: 4 }}>
          CỬA HÀNG:
        </div>

        {/* Tab Tất cả */}
        <button
          onClick={() => setSelectedShopId('ALL')}
          style={{
            padding: '7px 14px',
            borderRadius: 8,
            border: selectedShopId === 'ALL' ? '2px solid #2563eb' : '1px solid #cbd5e1',
            background: selectedShopId === 'ALL' ? '#eff6ff' : '#ffffff',
            color: selectedShopId === 'ALL' ? '#2563eb' : '#475569',
            fontWeight: 700,
            fontSize: 12,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          <Building2 size={14} />
          <span>Tất Cả Cửa Hàng ({rows.length})</span>
        </button>

        {/* Tabs từng Shop */}
        {shopDataList.map(s => {
          const isSelected = selectedShopId === s.id;
          const activeDevices = s.devices.filter(d => !d.revoked);
          const onlineCount = s.devices.filter(d => getDeviceOnlineInfo(d).status === 'online').length;
          const isOverQuota = s.max_devices && activeDevices.length > s.max_devices;

          return (
            <button
              key={s.id}
              onClick={() => setSelectedShopId(s.id)}
              style={{
                padding: '7px 14px',
                borderRadius: 8,
                border: isSelected ? '2px solid #2563eb' : '1px solid #cbd5e1',
                background: isSelected ? '#eff6ff' : '#ffffff',
                color: isSelected ? '#2563eb' : '#475569',
                fontWeight: isSelected ? 700 : 500,
                fontSize: 12,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <Store size={14} />
              <span>{s.name}</span>
              {!s.isUnassigned && (
                <span style={{
                  fontSize: 11,
                  padding: '2px 6px',
                  borderRadius: 10,
                  background: isOverQuota ? '#fee2e2' : '#f1f5f9',
                  color: isOverQuota ? '#ef4444' : '#64748b',
                  fontWeight: 700
                }}>
                  {activeDevices.length}/{s.max_devices}
                </span>
              )}
              {onlineCount > 0 && (
                <span style={{
                  fontSize: 10,
                  padding: '2px 6px',
                  borderRadius: 10,
                  background: '#dcfce7',
                  color: '#15803d',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3
                }}>
                  ● {onlineCount} online
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* THÔNG TIN SHOP ĐANG CHỌN (NẾU CHỌN SHOP CỤ THỂ) */}
      {activeShop && !activeShop.isUnassigned && (
        <div style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 10,
          padding: '12px 18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 8,
              background: '#f8fafc', border: '1px solid #e2e8f0',
              color: '#334155', display: 'grid', placeItems: 'center'
            }}>
              <Store size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 800, fontSize: 15, color: '#0f172a' }}>{activeShop.name}</span>
                <span style={{ fontFamily: 'monospace', fontSize: 11, background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                  {activeShop.shop_code}
                </span>
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>
                Định mức quota: <strong>{activeShop.devices.filter(d => !d.revoked).length} / {activeShop.max_devices} máy cho phép</strong>
                {' • '}
                <span style={{ color: '#16a34a', fontWeight: 700 }}>
                  {activeShop.devices.filter(d => getDeviceOnlineInfo(d).status === 'online').length} Đang Online
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setEditMaxModalShop(activeShop)}
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                padding: '6px 12px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                color: '#334155',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5
              }}
            >
              <SlidersHorizontal size={13} />
              Sửa Hạn Mức ({activeShop.max_devices} máy)
            </button>
            <button
              onClick={() => handleRevokeShop(activeShop)}
              disabled={actionLoading === activeShop.id}
              style={{
                background: '#fee2e2',
                border: '1px solid #fca5a5',
                padding: '6px 12px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                color: '#b91c1c',
                cursor: actionLoading === activeShop.id ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5
              }}
            >
              <ShieldAlert size={13} />
              Thu Hồi Cả Shop
            </button>
          </div>
        </div>
      )}

      {/* FILTER & SEARCH BAR */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
        background: '#ffffff',
        padding: '10px 16px',
        borderRadius: 10,
        border: '1px solid #e2e8f0'
      }}>
        {/* Bộ Lọc Trạng Thái Nhanh 1-Click */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginRight: 4 }}>
            TRẠNG THÁI:
          </span>
          {[
            { id: 'ALL', label: 'Tất Cả', color: '#475569' },
            { id: 'ONLINE', label: '🟢 Đang Online', color: '#16a34a' },
            { id: 'RECENT', label: '🟡 Vừa Hoạt Động', color: '#d97706' },
            { id: 'OFFLINE', label: '⚪ Offline', color: '#64748b' },
            { id: 'REVOKED', label: '🔴 Đã Thu Hồi', color: '#ef4444' }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              style={{
                padding: '5px 12px',
                borderRadius: 6,
                border: statusFilter === f.id ? `2px solid ${f.color}` : '1px solid #cbd5e1',
                background: statusFilter === f.id ? `${f.color}15` : '#ffffff',
                color: statusFilter === f.id ? f.color : '#475569',
                fontSize: 12,
                fontWeight: statusFilter === f.id ? 700 : 500,
                cursor: 'pointer'
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Search Box */}
        <div style={{ position: 'relative', width: 280 }}>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Tìm máy, IP, nhân viên, shop..."
            style={{
              width: '100%',
              padding: '7px 12px 7px 32px',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              fontSize: 12
            }}
          />
          <Search size={14} style={{ position: 'absolute', left: 10, top: 9, color: '#94a3b8' }} />
        </div>
      </div>

      {/* SINGLE CLEAN TABLE: Gọn gàng, thoáng mắt, không rối */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: 12, border: '1px solid #e2e8f0' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
              <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Thiết Bị (Máy Trạm)</th>
              <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Nhân Viên & Cửa Hàng</th>
              <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Môi Trường & IP</th>
              <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Trạng Thái Trực Tuyến</th>
              <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Lần Cuối Hoạt Động</th>
              <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569', textAlign: 'right' }}>Thao Tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonTableRows columns={6} rows={6} />
            ) : filteredDevices.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ padding: '40px 20px', textAlign: 'center', color: '#64748b' }}>
                  <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <Laptop size={32} color="#cbd5e1" />
                    <span style={{ fontWeight: 600 }}>Không tìm thấy thiết bị nào phù hợp</span>
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>
                      {statusFilter !== 'ALL' ? 'Thử chuyển về bộ lọc "Tất Cả"' : 'Chưa có thiết bị nào đăng nhập vào cửa hàng này'}
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              filteredDevices.map(d => {
                const devId = d.device_id || d.id;
                const onlineInfo = getDeviceOnlineInfo(d);
                const bStyle = getBrowserStyle(d);
                const isCopied = copiedId === devId;

                return (
                  <tr key={devId} style={{ borderBottom: '1px solid #f1f5f9' }} className="hover:bg-slate-50">
                    {/* Device Name & ID */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: 8,
                          background: bStyle.bg, color: bStyle.color,
                          display: 'grid', placeItems: 'center'
                        }}>
                          <Laptop size={18} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13 }}>
                            {d.device_name || 'Máy Trạm Chưa Đặt Tên'}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                            <span style={{
                              fontSize: 10.5,
                              background: '#f1f5f9',
                              color: '#334155',
                              border: '1px solid #cbd5e1',
                              padding: '1px 6px',
                              borderRadius: 4,
                              fontFamily: 'monospace',
                              fontWeight: 700
                            }}>
                              {getDeviceBadge(d)}
                            </span>
                            <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#64748b' }}>
                              {devId.length > 18 ? `${devId.slice(0, 10)}...${devId.slice(-4)}` : devId}
                            </span>
                            <button
                              onClick={() => handleCopyId(devId)}
                              title="Sao chép Device ID"
                              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: isCopied ? '#16a34a' : '#94a3b8', padding: 1 }}
                            >
                              {isCopied ? <Check size={12} /> : <Copy size={12} />}
                            </button>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Staff & Shop */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, color: '#334155' }}>
                        {d.full_name || 'Nhân viên'}
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                        {d.email !== '—' ? d.email : 'Chưa gắn email'}
                      </div>
                      <div style={{ marginTop: 4 }}>
                        <span style={{
                          fontSize: 10,
                          fontWeight: 700,
                          background: d.shop_id ? '#eff6ff' : '#fef3c7',
                          color: d.shop_id ? '#2563eb' : '#d97706',
                          padding: '2px 6px',
                          borderRadius: 4
                        }}>
                          {d.shop_name || 'Chưa gán shop'}
                        </span>
                      </div>
                    </td>

                    {/* Browser, OS & IP */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          fontSize: 11,
                          fontWeight: 700,
                          background: bStyle.bg,
                          color: bStyle.color,
                          padding: '2px 8px',
                          borderRadius: 6
                        }}>
                          {bStyle.name}
                        </span>
                        <span style={{ fontSize: 11, color: '#64748b' }}>{bStyle.os}</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, fontFamily: 'monospace' }}>
                        IP: {d.ip_address || '127.0.0.1'} {d.version ? `• ${d.version}` : ''}
                      </div>
                    </td>

                    {/* Online Status: ĐÚNG NGHĨA & TRỰC QUAN */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          padding: '4px 10px',
                          borderRadius: 20,
                          fontSize: 12,
                          fontWeight: 700,
                          background: onlineInfo.bg,
                          color: onlineInfo.color,
                          border: `1px solid ${onlineInfo.border}`
                        }}>
                          {onlineInfo.status === 'online' && (
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a' }} className="animate-ping" />
                          )}
                          {onlineInfo.status === 'recent' && (
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#d97706' }} />
                          )}
                          {onlineInfo.status === 'offline' && (
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#94a3b8' }} />
                          )}
                          {onlineInfo.status === 'revoked' && (
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
                          )}
                          <span>{onlineInfo.text}</span>
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 4, fontWeight: 500 }}>
                        {onlineInfo.timeAgo}
                      </div>
                    </td>

                    {/* Last Seen Detail */}
                    <td style={{ padding: '12px 16px', color: '#475569' }}>
                      <div style={{ fontSize: 12, fontWeight: 500 }}>
                        {onlineInfo.lastDateFormatted || '—'}
                      </div>
                      {d.last_order_at && (
                        <div style={{ fontSize: 10, color: '#2563eb', marginTop: 2, fontWeight: 600 }}>
                          📦 Đơn gần nhất: {new Date(d.last_order_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 5 }}>
                        {/* Xem đơn */}
                        <button
                          onClick={() => setOrdersModalDevice(d)}
                          title="Xem 50 đơn gần nhất của máy"
                          style={{
                            padding: '5px 8px', borderRadius: 6,
                            background: '#f8fafc', border: '1px solid #cbd5e1',
                            color: '#334155', cursor: 'pointer'
                          }}
                        >
                          <Eye size={13} />
                        </button>

                        {/* Đổi tên */}
                        <button
                          onClick={() => setEditNameModalDevice(d)}
                          title="Đặt tên gợi nhớ cho máy"
                          style={{
                            padding: '5px 8px', borderRadius: 6,
                            background: '#f8fafc', border: '1px solid #cbd5e1',
                            color: '#334155', cursor: 'pointer'
                          }}
                        >
                          <Edit2 size={13} />
                        </button>

                        {/* Chuyển Shop */}
                        <button
                          onClick={() => setAssignModalDevice(d)}
                          title="Chuyển máy sang Shop khác"
                          style={{
                            padding: '5px 8px', borderRadius: 6,
                            background: '#f8fafc', border: '1px solid #cbd5e1',
                            color: '#334155', cursor: 'pointer'
                          }}
                        >
                          <ArrowRightLeft size={13} />
                        </button>

                        {/* Khóa / Mở */}
                        <button
                          onClick={() => handleToggleRevoke(d)}
                          disabled={actionLoading === devId}
                          title={d.revoked ? 'Khôi phục thiết bị' : 'Thu hồi quyền (Khóa)'}
                          style={{
                            padding: '5px 8px', borderRadius: 6,
                            background: d.revoked ? '#dcfce7' : '#fee2e2',
                            border: d.revoked ? '1px solid #86efac' : '1px solid #fca5a5',
                            color: d.revoked ? '#15803d' : '#b91c1c',
                            cursor: actionLoading === devId ? 'not-allowed' : 'pointer'
                          }}
                        >
                          <Power size={13} />
                        </button>

                        {/* Xóa */}
                        <button
                          onClick={() => handleDeleteDevice(d)}
                          disabled={actionLoading === devId}
                          title="Xóa vĩnh viễn"
                          style={{
                            padding: '5px 8px', borderRadius: 6,
                            background: '#fff1f2', border: '1px solid #fecdd3',
                            color: '#e11d48', cursor: actionLoading === devId ? 'not-allowed' : 'pointer'
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* MODALS */}
      <DeviceOrdersModal
        open={!!ordersModalDevice}
        device={ordersModalDevice}
        onClose={() => setOrdersModalDevice(null)}
      />

      <AssignDeviceShopModal
        open={!!assignModalDevice}
        device={assignModalDevice}
        shops={shopsList}
        onClose={() => setAssignModalDevice(null)}
        onAssigned={() => loadData(true)}
      />

      <EditDeviceNameModal
        open={!!editNameModalDevice}
        device={editNameModalDevice}
        onClose={() => setEditNameModalDevice(null)}
        onUpdated={(devId, newName) => {
          setRows(prev => prev.map(d => (d.device_id === devId || d.id === devId) ? { ...d, device_name: newName } : d));
        }}
      />

      <EditShopMaxDevicesModal
        open={!!editMaxModalShop}
        shop={editMaxModalShop}
        onClose={() => setEditMaxModalShop(null)}
        onUpdated={(shopId, newMax) => {
          setShopsList(prev => prev.map(s => s.id === shopId ? { ...s, max_devices: newMax } : s));
        }}
      />
    </div>
  );
}
