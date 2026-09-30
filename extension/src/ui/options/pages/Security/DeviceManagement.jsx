import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Laptop, AlertTriangle, ShieldCheck, Eye, Lock, Unlock, Trash2, Edit2, Check, X, Plus, KeyRound, CheckCircle2, UserCheck, RefreshCw, ShieldAlert, Sparkles, SlidersHorizontal } from 'lucide-react';
import { AuthSession } from '../../../../domain/auth/auth.session.esm.js';
import { OrderStorage } from '../../../../application/storage.esm.js';
import DeviceOrdersModal from '../../components/DeviceOrdersModal';
import Pagination from '../../components/Pagination';

const relativeTime = iso => {
  if (!iso) return 'Chưa ghi nhận';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'Vừa xong';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} phút trước`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} giờ trước`;
  return `${Math.floor(seconds / 86400)} ngày trước`;
};

const getBrowserInfo = (device) => {
  const browser = String(device.browser || device.device_name || '').toLowerCase();
  const os = String(device.os_info || '').toLowerCase();
  
  let name = 'Google Chrome';
  let icon = '🌐';
  let color = '#2563eb';
  let bg = 'var(--primary-light)';

  if (browser.includes('edg') || browser.includes('edge')) {
    name = 'Microsoft Edge';
    icon = '🌊';
    color = '#0284c7';
    bg = 'rgba(2, 132, 199, 0.12)';
  } else if (browser.includes('coc') || browser.includes('cốc cốc')) {
    name = 'Cốc Cốc';
    icon = '🌴';
    color = '#16a34a';
    bg = 'rgba(22, 163, 74, 0.12)';
  } else if (browser.includes('brave')) {
    name = 'Brave Browser';
    icon = '🦁';
    color = '#ea580c';
    bg = 'rgba(234, 88, 12, 0.12)';
  } else if (browser.includes('firefox')) {
    name = 'Mozilla Firefox';
    icon = '🦊';
    color = '#d97706';
    bg = 'rgba(217, 119, 6, 0.12)';
  } else if (browser.includes('safari') && !browser.includes('chrome')) {
    name = 'Safari';
    icon = '🧭';
    color = '#0284c7';
    bg = 'rgba(2, 132, 199, 0.12)';
  } else if (browser.includes('opera') || browser.includes('opr')) {
    name = 'Opera';
    icon = '⭕';
    color = '#dc2626';
    bg = 'rgba(220, 38, 38, 0.12)';
  }

  let osName = 'Windows';
  if (os.includes('mac') || os.includes('darwin')) osName = 'macOS';
  else if (os.includes('linux')) osName = 'Linux';
  else if (os.includes('android')) osName = 'Android';
  else if (os.includes('iphone') || os.includes('ipad')) osName = 'iOS';
  else if (os.includes('win')) osName = 'Windows 10/11';

  return { name, icon, color, bg, osName };
};

const getDeviceBadge = (device) => {
  const rawId = String(device.device_id || device.id || '').replace(/^dev_/, '');
  const shortId = rawId.substring(0, 6).toUpperCase();
  return `#DEV-${shortId || '0000'}`;
};

const getDeviceOnlineInfo = (d) => {
  if (d.revoked || d.status === 'revoked') {
    return {
      status: 'revoked',
      text: 'Đã khóa',
      color: '#ef4444',
      bg: 'var(--color-danger-bg)',
      border: 'rgba(239, 68, 68, 0.25)',
      diffMins: Infinity,
      timeAgo: d.last_seen ? relativeTime(d.last_seen) : 'Đã khóa'
    };
  }

  const lastDate = d.last_seen || d.last_active_at;
  if (!lastDate) {
    return {
      status: 'offline',
      text: 'Offline',
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
      color: '#64748b',
      bg: '#f8fafc',
      border: '#e2e8f0',
      diffMins: Infinity,
      timeAgo: 'Không xác định'
    };
  }

  const diffMs = Math.max(0, Date.now() - lastTimeMs);
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffMs / 60000);

  // 1. ONLINE: Tín hiệu dưới 7 phút
  if (diffMins <= 7) {
    return {
      status: 'online',
      text: 'Đang Online',
      color: '#16a34a',
      bg: '#f0fdf4',
      border: '#86efac',
      diffMins,
      timeAgo: diffSecs < 60 ? 'Vừa xong' : `${diffMins} phút trước`
    };
  }

  // 2. RECENT: 7 - 30 phút
  if (diffMins <= 30) {
    return {
      status: 'recent',
      text: 'Vừa hoạt động',
      color: '#d97706',
      bg: '#fffbeb',
      border: '#fde68a',
      diffMins,
      timeAgo: `${diffMins} phút trước`
    };
  }

  // 3. OFFLINE: Quá 30 phút
  return {
    status: 'offline',
    text: 'Offline',
    color: '#64748b',
    bg: '#f8fafc',
    border: '#cbd5e1',
    diffMins,
    timeAgo: relativeTime(lastDate)
  };
};

export default function DeviceManagement() {
  const [devices, setDevices] = useState([]);
  const [shopInfo, setShopInfo] = useState(null);
  const [maxDevices, setMaxDevices] = useState(5);
  const [autoApprove, setAutoApprove] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [filterTab, setFilterTab] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'PENDING' | 'REVOKED'
  
  // Device orders detail modal state
  const [selectedDeviceForOrders, setSelectedDeviceForOrders] = useState(null);
  const [allSubmittedOrders, setAllSubmittedOrders] = useState([]);

  // PIN Management Modal state
  const [pinModalDevice, setPinModalDevice] = useState(null);
  const [pinInput, setPinInput] = useState('');
  const [pinLoginName, setPinLoginName] = useState('');
  const [isSavingPin, setIsSavingPin] = useState(false);

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Edit states
  const [editingStaffId, setEditingStaffId] = useState(null);
  const [editingStaffName, setEditingStaffName] = useState('');
  const [editingDeviceId, setEditingDeviceId] = useState(null);
  const [editingDeviceName, setEditingDeviceName] = useState('');
  const [notice, setNotice] = useState(null);
  const [currentDeviceId, setCurrentDeviceId] = useState('');

  useEffect(() => {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['device_id', 'fbDeviceId'], res => {
          if (res?.device_id || res?.fbDeviceId) setCurrentDeviceId(res.device_id || res.fbDeviceId);
        });
      }
    } catch (_) {}
  }, []);

  const flash = (type, text) => {
    setNotice({ type, text });
    setTimeout(() => setNotice(null), 4500);
  };

  const context = async () => {
    const config = await globalThis.SupabaseCloud.loadConfig();
    const session = await AuthSession.getSession();
    if (!session?.access_token || !session?.active_shop_id) {
      throw new Error('Phiên đăng nhập không hợp lệ hoặc thiếu quyền hạn.');
    }
    return {
      config,
      session,
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      }
    };
  };

  const rpc = async (name, body) => {
    const { config, headers } = await context();
    const res = await fetch(`${config.url}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || 'Thao tác thất bại.');
    }
    return res.json();
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { config, session, headers } = await context();
      
      // 1. Tải thông tin Shop & Policy
      try {
        const shopRes = await fetch(`${config.url}/rest/v1/shops?id=eq.${session.active_shop_id}&select=id,name,shop_code,auto_approve_devices`, { headers });
        if (shopRes.ok) {
          const shopRows = await shopRes.json();
          if (shopRows?.[0]) {
            setShopInfo(shopRows[0]);
            setAutoApprove(shopRows[0].auto_approve_devices ?? true);
          }
        }
      } catch (_) {}

      // 2. Tải Quota
      try {
        const quotaRes = await fetch(`${config.url}/rest/v1/shop_quotas?shop_id=eq.${session.active_shop_id}&select=max_devices`, { headers });
        if (quotaRes.ok) {
          const rows = await quotaRes.json();
          if (rows?.[0]?.max_devices) setMaxDevices(rows[0].max_devices);
        }
      } catch (err) {
        console.warn('[DeviceQuota] Error loading quotas:', err);
      }

      // 3. Tải danh sách thiết bị (Ưu tiên owner_get_devices_v3 -> v2 -> direct table)
      let loadedDevices = [];
      try {
        const data = await rpc('owner_get_devices_v3', { p_shop_id: session.active_shop_id, p_filter_status: 'ALL' });
        if (data?.devices && Array.isArray(data.devices)) {
          loadedDevices = data.devices;
          if (data.shop) setShopInfo(data.shop);
          if (data.quota?.max_devices) setMaxDevices(data.quota.max_devices);
        }
      } catch (_) {
        try {
          const data2 = await rpc('owner_get_devices_v2', { p_shop_id: session.active_shop_id });
          if (data2?.devices && Array.isArray(data2.devices)) loadedDevices = data2.devices;
          else if (Array.isArray(data2)) loadedDevices = data2;
        } catch (_) {
          const res = await fetch(`${config.url}/rest/v1/extension_devices?shop_id=eq.${session.active_shop_id}&select=*&order=created_at.desc`, { headers });
          if (res.ok) loadedDevices = await res.json();
        }
      }

      // Deduplicate devices by device_id (keep latest)
      const seenDevIds = new Set();
      const uniqueDevices = [];
      for (const d of loadedDevices) {
        const key = d.device_id || d.id;
        if (!key || !seenDevIds.has(key)) {
          if (key) seenDevIds.add(key);
          uniqueDevices.push(d);
        }
      }
      loadedDevices = uniqueDevices;

      // 4. Tải Submitted Orders để đối soát KPI
      let allOrders = [];
      try {
        const ordersRes = await fetch(`${config.url}/rest/v1/submitted_orders?shop_id=eq.${session.active_shop_id}&select=*&order=submitted_at.desc&limit=1000`, { headers });
        if (ordersRes.ok) allOrders = await ordersRes.json();
      } catch (_) {}

      if (!allOrders || allOrders.length === 0) {
        try {
          if (typeof OrderStorage !== 'undefined' && OrderStorage.getSubmittedOrders) {
            const localOrders = await OrderStorage.getSubmittedOrders().catch(() => []);
            if (Array.isArray(localOrders) && localOrders.length > 0) allOrders = localOrders;
          }
        } catch (_) {}
      }

      setAllSubmittedOrders(allOrders || []);

      if (Array.isArray(allOrders) && loadedDevices.length > 0) {
        loadedDevices = loadedDevices.map(dev => {
          const matched = allOrders.filter(so => {
            if (dev.device_id && so.source_device_id && so.source_device_id === dev.device_id) return true;
            if (dev.id && so.source_device_id && so.source_device_id === dev.id) return true;
            return false;
          });

          const count = matched.length;
          const cod = matched.reduce((sum, o) => sum + Number(o.cod_amount || o.codAmount || 0), 0);
          const lastTime = matched[0]?.submitted_at || matched[0]?.submittedAt || dev.last_seen;

          return {
            ...dev,
            orders: matched,
            orders_count: Number(dev.orders_count || 0) > 0 ? Number(dev.orders_count) : count,
            total_cod: Number(dev.total_cod || 0) > 0 ? Number(dev.total_cod) : cod,
            last_seen: dev.last_seen || lastTime
          };
        });
      }

      setDevices(loadedDevices);
    } catch (error) {
      flash('error', error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Bộ lọc trạng thái thiết bị
  const filteredDevices = useMemo(() => {
    if (filterTab === 'ONLINE') {
      return devices.filter(d => (!d.status || d.status === 'active') && !d.revoked && getDeviceOnlineInfo(d).status === 'online');
    }
    if (filterTab === 'ACTIVE') {
      return devices.filter(d => (d.status === 'active' || !d.status) && !d.revoked);
    }
    if (filterTab === 'PENDING') {
      return devices.filter(d => d.status === 'pending_approval');
    }
    if (filterTab === 'REVOKED') {
      return devices.filter(d => d.status === 'revoked' || d.revoked === true);
    }
    return devices;
  }, [devices, filterTab]);

  const billableActiveCount = devices.filter(d => (!d.status || d.status === 'active') && !d.revoked && (d.is_billable !== false)).length;
  const activeCount = billableActiveCount || devices.filter(d => (!d.status || d.status === 'active') && !d.revoked).length;
  const onlineCount = devices.filter(d => (!d.status || d.status === 'active') && !d.revoked && getDeviceOnlineInfo(d).status === 'online').length;
  const pendingCount = devices.filter(d => d.status === 'pending_approval').length;
  const revokedCount = devices.filter(d => d.status === 'revoked' || d.revoked === true).length;

  const getClientBadge = (device) => {
    const isExt = (device?.client_type || '').toUpperCase() === 'EXTENSION' || !device?.client_type;
    const isProd = (device?.environment || '').toUpperCase() === 'PRODUCTION' || !device?.environment;
    return {
      label: isExt ? (isProd ? 'Extension (Máy trạm)' : 'Extension (Dev)') : 'Web Dashboard',
      color: isExt ? (isProd ? '#16a34a' : '#d97706') : '#2563eb'
    };
  };

  const actualPercent = maxDevices > 0 ? Math.round((activeCount / maxDevices) * 100) : 0;
  const isOverLimit = activeCount > maxDevices;
  const progressWidth = Math.min(100, actualPercent);
  const progressColor = isOverLimit ? 'var(--danger)' : actualPercent > 80 ? 'var(--warning)' : 'var(--primary)';

  const paginatedDevices = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredDevices.slice(start, start + pageSize);
  }, [filteredDevices, page, pageSize]);

  // Cập nhật cấu hình tự động duyệt máy mới
  const toggleAutoApprove = async () => {
    const nextVal = !autoApprove;
    setAutoApprove(nextVal);
    try {
      const { config, session, headers } = await context();
      await fetch(`${config.url}/rest/v1/shops?id=eq.${session.active_shop_id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ auto_approve_devices: nextVal, updated_at: new Date().toISOString() })
      });
      flash('success', nextVal ? 'Đã bật tự động duyệt máy mới khi còn hạn mức.' : 'Đã tắt tự động duyệt máy mới (Yêu cầu duyệt thủ công).');
    } catch (e) {
      flash('error', e.message);
      setAutoApprove(!nextVal);
    }
  };

  const isUuid = (val) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(val || ''));

  const getDeviceFilter = (device, shopId) => {
    if (device.id && isUuid(device.id)) {
      return `shop_id=eq.${shopId}&id=eq.${device.id}`;
    }
    if (device.device_id) {
      return `shop_id=eq.${shopId}&device_id=eq.${encodeURIComponent(device.device_id)}`;
    }
    return `shop_id=eq.${shopId}`;
  };

  // Phê duyệt thiết bị máy mới
  const approveDevice = async (device) => {
    const targetKey = device.device_id || device.id;
    setBusy(targetKey);
    try {
      const { session, config, headers } = await context();
      let success = false;
      try {
        const res = await rpc('owner_approve_device', { p_shop_id: session.active_shop_id, p_device_id: String(targetKey) });
        if (res?.success) success = true;
      } catch (_) {}

      if (!success) {
        const queryFilter = getDeviceFilter(device, session.active_shop_id);
        await fetch(`${config.url}/rest/v1/extension_devices?${queryFilter}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ status: 'active', revoked: false, approved_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        });
      }

      flash('success', `Đã phê duyệt máy "${device.device_name || device.staff_name || 'này'}".`);
      await load();
    } catch (e) {
      flash('error', e.message);
    } finally {
      setBusy('');
    }
  };

  // Từ chối / Thu hồi thiết bị
  const rejectDevice = async (device) => {
    const targetKey = device.device_id || device.id;
    if (!confirm(`Bạn có chắc muốn từ chối / thu hồi máy "${device.device_name || device.staff_name || 'này'}"?`)) return;
    setBusy(targetKey);
    try {
      const { session, config, headers } = await context();
      let success = false;
      try {
        const res = await rpc('owner_revoke_device', {
          p_shop_id: session.active_shop_id,
          p_device_id: String(targetKey),
          p_reason: 'MANUAL_DEVICE_REVOCATION'
        });
        if (res && res.success !== false) success = true;
      } catch (_) {
        try {
          const res2 = await rpc('owner_reject_device', { p_shop_id: session.active_shop_id, p_device_id: String(targetKey) });
          if (res2?.success) success = true;
        } catch (_) {}
      }

      if (!success) {
        const queryFilter = getDeviceFilter(device, session.active_shop_id);
        await fetch(`${config.url}/rest/v1/extension_devices?${queryFilter}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ status: 'revoked', revoked: true, revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        });
      }

      if (globalThis.AuditService?.logAction) {
        await globalThis.AuditService.logAction('DEVICE_REVOKED', 'device', targetKey, {
          device_name: device.device_name,
          staff_name: device.staff_name,
          reason: 'MANUAL_DEVICE_REVOCATION'
        }).catch(() => null);
      }

      flash('success', 'Đã thu hồi máy trạm. Lịch sử đơn vẫn được giữ để đối soát.');
      await load();
    } catch (e) {
      flash('error', e.message);
    } finally {
      setBusy('');
    }
  };

  // Xóa vĩnh viễn thiết bị khỏi danh sách
  const deleteDevicePermanent = async (device) => {
    const targetKey = device.device_id || device.id;
    if (!confirm(`Bạn có chắc muốn xóa vĩnh viễn máy "${device.device_name || device.staff_name || 'này'}" khỏi danh sách?`)) return;
    setBusy(targetKey);
    try {
      const { session, config, headers } = await context();
      let success = false;
      try {
        const res = await rpc('owner_delete_device', {
          p_shop_id: session.active_shop_id,
          p_device_id: String(targetKey)
        });
        if (res && res.success) success = true;
      } catch (_) {}

      if (!success) {
        const queryFilter = getDeviceFilter(device, session.active_shop_id);
        await fetch(`${config.url}/rest/v1/extension_devices?${queryFilter}`, {
          method: 'DELETE',
          headers
        });
      }
      flash('success', 'Đã xóa vĩnh viễn máy trạm thành công.');
      await load();
    } catch (e) {
      flash('error', e.message);
    } finally {
      setBusy('');
    }
  };

  const revokeDevice = rejectDevice;

  // Mở modal cấp / đổi PIN 6 số cho nhân viên
  const openPinModal = (device) => {
    setPinModalDevice(device);
    setPinLoginName(device.login_name || device.staff_name?.toLowerCase().replace(/\s+/g, '') || '');
    setPinInput('');
  };

  // Lưu mã PIN 6 số
  const handleSavePin = async (e) => {
    e.preventDefault();
    if (!pinModalDevice) return;
    if (!pinInput || pinInput.length !== 6 || !/^[0-9]{6}$/.test(pinInput)) {
      alert('Vui lòng nhập đúng 6 chữ số cho mã PIN!');
      return;
    }
    if (!pinLoginName) {
      alert('Vui lòng nhập tên đăng nhập cho nhân viên!');
      return;
    }

    setIsSavingPin(true);
    try {
      const { session, config, headers } = await context();
      const targetUserId = pinModalDevice.user_id || session.user?.id;
      
      const res = await rpc('owner_set_employee_pin', {
        p_shop_id: session.active_shop_id,
        p_user_id: targetUserId,
        p_login_name: pinLoginName.trim().toLowerCase(),
        p_pin: pinInput.trim()
      });

      if (res && res.success === false) {
        throw new Error(res.message || 'Lỗi cấp mã PIN');
      }

      flash('success', `Đã cấp mã PIN 6 số cho nhân viên "${pinLoginName}" thành công!`);
      setPinModalDevice(null);
      await load();
    } catch (e) {
      flash('error', e.message);
    } finally {
      setIsSavingPin(false);
    }
  };

  const buyMore = () => {
    location.hash = '#subscription';
    window.dispatchEvent(new CustomEvent('options:navigate', { detail: { tab: 'subscription' } }));
  };

  const handleCleanupInactive = async () => {
    if (!confirm('Hệ thống sẽ tự động dọn dẹp các máy trạm / profile trình duyệt thử nghiệm không có phát sinh đơn hàng hoặc offline quá 24h. Bạn có muốn tiếp tục?')) return;
    setBusy('cleanup');
    try {
      const { session } = await context();
      const res = await rpc('owner_cleanup_inactive_devices', { p_shop_id: session.active_shop_id });
      if (res && res.success) {
        flash('success', res.message || 'Đã dọn dẹp các thiết bị rác thành công!');
      } else {
        flash('info', 'Không có thiết bị rác nào cần dọn dẹp.');
      }
      await load();
    } catch (e) {
      flash('error', e.message || 'Không thể dọn dẹp thiết bị.');
    } finally {
      setBusy('');
    }
  };

  return (
    <div>
      {/* Header with Shop Code Badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 className="page-title" style={{ margin: 0 }}>Quản Lý Thiết Bị & Bảo Mật Máy Trạm</h2>
            {shopInfo?.shop_code && (
              <span style={{
                background: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)',
                color: '#15803d',
                padding: '3px 10px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 800,
                border: '1px solid #86efac',
                letterSpacing: '0.5px'
              }}>
                Mã Shop: {shopInfo.shop_code}
              </span>
            )}
          </div>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0', fontSize: 13 }}>
            Xác thực nhân viên bằng PIN 6 số, phê duyệt máy trạm mới và thu hồi quyền từ xa (Kill-Switch).
          </p>
        </div>
      </div>

      {notice && (
        <div role="status" style={{
          marginBottom: 16,
          padding: '10px 14px',
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 600,
          color: notice.type === 'error' ? 'var(--color-danger-text)' : 'var(--color-success-text)',
          background: notice.type === 'error' ? 'var(--color-danger-bg)' : 'var(--color-success-bg)',
          border: `1px solid ${notice.type === 'error' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`
        }}>
          {notice.text}
        </div>
      )}

      {/* Quota Progress & Policy Banner */}
      <section className="card" style={{
        padding: '20px 24px',
        marginBottom: 20,
        background: 'var(--card)',
        border: `1px solid ${isOverLimit ? 'rgba(239, 68, 68, 0.4)' : 'var(--border)'}`,
        borderRadius: 12
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: isOverLimit ? 'var(--danger)' : 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span>Đang kết nối: {activeCount} / {maxDevices} máy trạm {isOverLimit ? `(Vượt hạn mức ${actualPercent}%)` : `(${actualPercent}%)`}</span>
              <span style={{
                fontSize: 12,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 12,
                background: onlineCount > 0 ? '#dcfce7' : '#f1f5f9',
                color: onlineCount > 0 ? '#15803d' : '#64748b',
                border: onlineCount > 0 ? '1px solid #86efac' : '1px solid #cbd5e1'
              }}>
                {onlineCount > 0 ? `🟢 Đang Online: ${onlineCount} máy` : '⚪ 0 máy Online'}
              </span>
            </div>
            <div style={{ color: isOverLimit ? 'var(--danger)' : 'var(--text-muted)', fontSize: 12.5, marginTop: 4, fontWeight: isOverLimit ? 600 : 400 }}>
              {isOverLimit
                ? '⚠️ Đã vượt quá số lượng thiết bị cho phép theo gói cước hiện tại. Vui lòng mở rộng máy trạm.'
                : (actualPercent === 100
                    ? '⚠️ Đã dùng hết 100% số lượng thiết bị cho phép theo gói cước hiện tại.'
                    : `Còn ${Math.max(0, maxDevices - activeCount)} máy trạm khả dụng.`)}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* Toggle Tự động duyệt */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: 'var(--text-main)' }}>
              <input
                type="checkbox"
                checked={autoApprove}
                onChange={toggleAutoApprove}
                style={{ width: 16, height: 16, accentColor: 'var(--primary)', cursor: 'pointer' }}
              />
              Tự duyệt máy mới khi còn hạn mức
            </label>

            <button
              onClick={buyMore}
              style={{
                background: 'var(--primary)',
                color: '#fff',
                border: 'none',
                padding: '9px 16px',
                borderRadius: 8,
                fontWeight: 700,
                fontSize: 12.5,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)'
              }}
            >
              <Plus size={14} /> Mở rộng số lượng máy trạm
            </button>
          </div>
        </div>
        <div role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={progressWidth} style={{ height: 8, background: 'var(--border)', borderRadius: 999, overflow: 'hidden', marginTop: 14 }}>
          <div style={{ height: '100%', width: `${progressWidth}%`, background: progressColor, borderRadius: 999 }} />
        </div>
      </section>

      {/* FILTER TABS */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button
          onClick={() => { setFilterTab('ALL'); setPage(1); }}
          style={{
            padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: filterTab === 'ALL' ? 700 : 500,
            background: filterTab === 'ALL' ? 'var(--primary)' : 'var(--card)',
            color: filterTab === 'ALL' ? '#ffffff' : 'var(--text-muted)',
            border: '1px solid var(--border)', cursor: 'pointer'
          }}
        >
          Tất cả ({devices.length})
        </button>
        <button
          onClick={() => { setFilterTab('ONLINE'); setPage(1); }}
          style={{
            padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: filterTab === 'ONLINE' ? 700 : 500,
            background: filterTab === 'ONLINE' ? '#16a34a' : (onlineCount > 0 ? '#f0fdf4' : 'var(--card)'),
            color: filterTab === 'ONLINE' ? '#ffffff' : (onlineCount > 0 ? '#16a34a' : 'var(--text-muted)'),
            border: onlineCount > 0 ? '1px solid #86efac' : '1px solid var(--border)', cursor: 'pointer'
          }}
        >
          🟢 Đang Online ({onlineCount})
        </button>
        <button
          onClick={() => { setFilterTab('ACTIVE'); setPage(1); }}
          style={{
            padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: filterTab === 'ACTIVE' ? 700 : 500,
            background: filterTab === 'ACTIVE' ? 'var(--primary)' : 'var(--card)',
            color: filterTab === 'ACTIVE' ? '#ffffff' : 'var(--text-muted)',
            border: '1px solid var(--border)', cursor: 'pointer'
          }}
        >
          Đang hoạt động ({activeCount})
        </button>
        <button
          onClick={() => { setFilterTab('PENDING'); setPage(1); }}
          style={{
            padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: filterTab === 'PENDING' ? 700 : 500,
            background: filterTab === 'PENDING' ? '#d97706' : (pendingCount > 0 ? '#fef3c7' : 'var(--card)'),
            color: filterTab === 'PENDING' ? '#ffffff' : (pendingCount > 0 ? '#b45309' : 'var(--text-muted)'),
            border: pendingCount > 0 ? '1px solid #fcd34d' : '1px solid var(--border)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
          }}
        >
          <span>Chờ duyệt</span>
          {pendingCount > 0 && (
            <span style={{
              background: filterTab === 'PENDING' ? '#ffffff' : '#d97706',
              color: filterTab === 'PENDING' ? '#d97706' : '#ffffff',
              padding: '1px 6px', borderRadius: 999, fontSize: 11, fontWeight: 800
            }}>
              {pendingCount}
            </span>
          )}
        </button>
        <button
          onClick={() => { setFilterTab('REVOKED'); setPage(1); }}
          style={{
            padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: filterTab === 'REVOKED' ? 700 : 500,
            background: filterTab === 'REVOKED' ? 'var(--primary)' : 'var(--card)',
            color: filterTab === 'REVOKED' ? '#ffffff' : 'var(--text-muted)',
            border: '1px solid var(--border)', cursor: 'pointer'
          }}
        >
          Đã thu hồi ({revokedCount})
        </button>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button
            onClick={handleCleanupInactive}
            disabled={busy === 'cleanup'}
            style={{
              padding: '8px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 700,
              background: '#f8fafc', color: '#0f766e', border: '1px solid #ccfbf1',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
            title="Tự động thu hồi và xóa các profile trình duyệt test không có đơn hoặc offline quá 24h"
          >
            <RefreshCw size={13} className={busy === 'cleanup' ? 'animate-spin' : ''} />
            {busy === 'cleanup' ? 'Đang dọn dẹp...' : '🧹 Dọn dẹp profile rác (1-Click)'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="card" style={{ padding: 50, textAlign: 'center', color: 'var(--text-muted)' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <div className="db-status-dot live"></div> Đang tải danh sách thiết bị…
          </div>
        </div>
      ) : filteredDevices.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12 }}>
          <Laptop size={36} color="var(--text-muted)" style={{ opacity: 0.5, marginBottom: 12 }} />
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)' }}>Không có máy trạm nào trong danh mục này</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Nhân viên có thể đăng nhập bằng Mã Shop & PIN 6 số trên tiện ích mở rộng.</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12 }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 840, borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                  {['Nhân viên & PIN', 'Máy trạm & Vị trí', 'Hiệu suất đơn', 'Hoạt động cuối', 'Trạng thái', 'Thao tác'].map((x, i) => (
                    <th key={x} style={{ padding: '12px 16px', fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', textAlign: i === 5 ? 'center' : 'left' }}>
                      {x}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedDevices.map((device, index) => {
                  const rowKey = device.id || `${device.device_id || 'dev'}_${index}`;
                  const devId = device.device_id || device.id || `dev_${index}`;
                  const isRevoked = device.revoked === true || String(device.status || '').toLowerCase() === 'revoked';
                  const isPending = String(device.status || '').toLowerCase() === 'pending_approval';
                  const isEditingStaff = editingStaffId === devId;
                  const isEditingDev = editingDeviceId === devId;
                  const bInfo = getBrowserInfo(device);
                  const devBadge = getDeviceBadge(device);
                  const isThisDevice = currentDeviceId && (device.device_id === currentDeviceId || device.id === currentDeviceId);
                  const orderCount = Number(device.orders_count || 0);

                  return (
                    <tr key={rowKey} style={{
                      borderBottom: '1px solid var(--border)',
                      background: isPending ? 'rgba(254, 243, 199, 0.25)' : 'var(--card)',
                      transition: 'background .15s ease'
                    }}>
                      {/* Nhân viên & PIN */}
                      <td style={{ padding: '14px 16px' }}>
                        {isEditingStaff ? (
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <input
                              autoFocus
                              value={editingStaffName}
                              onChange={e => setEditingStaffName(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && saveStaffName(device)}
                              placeholder="Nhập tên nhân viên..."
                              style={{ padding: '5px 8px', fontSize: 13, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-main)', outline: 'none' }}
                            />
                            <button className="btn-primary btn-sm" onClick={() => saveStaffName(device)} style={{ padding: '5px 8px', fontSize: 11 }}>Lưu</button>
                            <button className="btn-secondary btn-sm" onClick={() => setEditingStaffId(null)} style={{ padding: '5px 8px', fontSize: 11 }}>Hủy</button>
                          </div>
                        ) : (
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <strong style={{ fontSize: 13.5, color: 'var(--text-main)' }}>
                                {device.staff_name || 'Nhân viên kho'}
                              </strong>
                              <button
                                title="Đổi tên hiển thị"
                                onClick={() => { setEditingStaffId(devId); setEditingStaffName(device.staff_name || 'Nhân viên kho'); }}
                                style={{ border: 0, background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, fontSize: 12 }}
                              >
                                ✏️
                              </button>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                              <span style={{
                                fontSize: 11,
                                color: device.has_pin ? '#15803d' : '#b45309',
                                background: device.has_pin ? '#dcfce7' : '#fef3c7',
                                padding: '1px 6px', borderRadius: 4, fontWeight: 700
                              }}>
                                {device.has_pin ? '🔑 Đã có PIN' : '⚠️ Chưa đặt PIN'}
                              </span>
                              <button
                                onClick={() => openPinModal(device)}
                                style={{
                                  background: 'none', border: 'none', color: 'var(--primary)',
                                  fontSize: 11, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline'
                                }}
                              >
                                {device.has_pin ? 'Đổi PIN' : 'Đặt PIN'}
                              </button>
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Máy trạm & Vị trí */}
                      <td style={{ padding: '14px 16px' }}>
                        {isEditingDev ? (
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <input
                              autoFocus
                              value={editingDeviceName}
                              onChange={e => setEditingDeviceName(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && saveDeviceName(device)}
                              placeholder="Tên máy..."
                              style={{ padding: '5px 8px', fontSize: 13, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-main)', outline: 'none' }}
                            />
                            <button className="btn-primary btn-sm" onClick={() => saveDeviceName(device)} style={{ padding: '5px 8px', fontSize: 11 }}>Lưu</button>
                            <button className="btn-secondary btn-sm" onClick={() => setEditingDeviceId(null)} style={{ padding: '5px 8px', fontSize: 11 }}>Hủy</button>
                          </div>
                        ) : (
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 15 }}>{bInfo.icon}</span>
                              <strong style={{ fontSize: 13, color: 'var(--text-main)' }}>
                                {device.device_name && device.device_name !== 'Chrome Extension' ? device.device_name : `${bInfo.name}`}
                              </strong>
                              <button
                                title="Đặt tên máy"
                                onClick={() => { setEditingDeviceId(devId); setEditingDeviceName(device.device_name || bInfo.name); }}
                                style={{ border: 0, background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 11, padding: 0 }}
                              >
                                ✏️
                              </button>
                              <span style={{ fontSize: 10.5, background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)', padding: '1px 6px', borderRadius: 4, fontFamily: 'monospace', fontWeight: 700 }}>
                                {devBadge}
                              </span>
                              {device.is_owner_device && (
                                <span style={{ fontSize: 10.5, background: '#fef3c7', color: '#b45309', padding: '1px 6px', borderRadius: 4, fontWeight: 700, border: '1px solid #fde68a' }}>
                                  👑 Chủ Shop
                                </span>
                              )}
                              {isThisDevice && (
                                <span style={{ fontSize: 10.5, background: 'var(--primary-light)', color: 'var(--primary)', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>
                                  📍 Máy này
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3 }}>
                              <span>{bInfo.name} ({bInfo.osName})</span>
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Hiệu suất đơn */}
                      <td style={{ padding: '14px 16px' }}>
                        <div
                          onClick={() => {
                            if (orderCount > 0) {
                              setSelectedDeviceForOrders({ ...device, orders: device.orders || allSubmittedOrders });
                            }
                          }}
                          title={orderCount > 0 ? `Bấm để xem danh sách ${orderCount} đơn hàng` : 'Chưa có đơn hàng nào'}
                          style={{
                            cursor: orderCount > 0 ? 'pointer' : 'default',
                            padding: '6px 10px', borderRadius: 8,
                            background: orderCount > 0 ? 'var(--primary-light)' : 'transparent',
                            border: orderCount > 0 ? '1px solid rgba(37, 99, 235, 0.2)' : '1px solid transparent',
                            display: 'inline-block'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <strong style={{ color: orderCount > 0 ? 'var(--primary)' : 'var(--text-muted)', fontSize: 13.5 }}>
                              {orderCount.toLocaleString('vi-VN')}
                            </strong> <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>đơn</span>
                            {orderCount > 0 && (
                              <span style={{ fontSize: 10.5, color: 'var(--primary)', background: 'rgba(37, 99, 235, 0.15)', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>
                                👁️ Xem
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 11.5, color: orderCount > 0 ? 'var(--success)' : 'var(--text-muted)', fontWeight: 700, marginTop: 2 }}>
                            {Number(device.total_cod || 0).toLocaleString('vi-VN')}đ COD
                          </div>
                        </div>
                      </td>

                      {/* Hoạt động cuối */}
                      <td style={{ padding: '14px 16px', fontSize: 12.5, color: 'var(--text-muted)' }}>
                        {relativeTime(device.last_seen)}
                      </td>

                      {/* Trạng thái */}
                      <td style={{ padding: '14px 16px' }}>
                        {isPending ? (
                          <span style={{ fontSize: 11.5, background: '#fef3c7', color: '#b45309', padding: '3px 9px', borderRadius: 999, fontWeight: 700, border: '1px solid #fcd34d' }}>
                            ⏳ Chờ duyệt
                          </span>
                        ) : isRevoked ? (
                          <span style={{ fontSize: 11.5, background: 'var(--color-danger-bg)', color: 'var(--color-danger-text)', padding: '3px 9px', borderRadius: 999, fontWeight: 700, border: '1px solid rgba(239, 68, 68, 0.25)' }}>
                            ● Đã khóa (Revoked)
                          </span>
                        ) : (
                          <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 3 }}>
                            {(() => {
                              const onlineInfo = getDeviceOnlineInfo(device);
                              return (
                                <>
                                  <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 5,
                                    padding: '3px 9px',
                                    borderRadius: 999,
                                    fontSize: 11.5,
                                    fontWeight: 700,
                                    background: onlineInfo.bg,
                                    color: onlineInfo.color,
                                    border: `1px solid ${onlineInfo.border}`
                                  }}>
                                    {onlineInfo.status === 'online' && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#16a34a' }} className="animate-ping" />}
                                    {onlineInfo.status === 'recent' && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#d97706' }} />}
                                    {onlineInfo.status === 'offline' && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#94a3b8' }} />}
                                    <span>{onlineInfo.text}</span>
                                  </span>
                                  <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                                    {onlineInfo.status === 'online' ? 'Sẵn sàng điền đơn' : onlineInfo.timeAgo}
                                  </span>
                                </>
                              );
                            })()}
                          </div>
                        )}
                      </td>

                      {/* Thao tác */}
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center', justifyContent: 'center' }}>
                          {isPending ? (
                            <>
                              <button
                                disabled={busy === devId}
                                onClick={() => approveDevice(device)}
                                style={{
                                  padding: '5px 10px', fontSize: 11.5, fontWeight: 700,
                                  background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6,
                                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
                                }}
                              >
                                <Check size={13} /> Duyệt máy
                              </button>
                              <button
                                disabled={busy === devId}
                                onClick={() => rejectDevice(device)}
                                style={{
                                  padding: '5px 9px', fontSize: 11.5, fontWeight: 600,
                                  background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6,
                                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
                                }}
                              >
                                <X size={13} /> Từ chối
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                disabled={orderCount === 0}
                                onClick={() => setSelectedDeviceForOrders({ ...device, orders: device.orders || allSubmittedOrders })}
                                style={{
                                  padding: '5px 9px', fontSize: 11.5, fontWeight: 600,
                                  background: orderCount > 0 ? 'var(--primary-light)' : 'var(--bg)',
                                  color: orderCount > 0 ? 'var(--primary)' : 'var(--text-muted)',
                                  border: '1px solid var(--border)', borderRadius: 6,
                                  cursor: orderCount > 0 ? 'pointer' : 'not-allowed'
                                }}
                              >
                                <Eye size={12} /> Xem đơn
                              </button>
                              {isRevoked ? (
                                <button
                                  disabled={busy === devId}
                                  onClick={() => deleteDevicePermanent(device)}
                                  style={{
                                    padding: '5px 9px', fontSize: 11.5, fontWeight: 600,
                                    border: '1px solid rgba(239, 68, 68, 0.25)', background: 'var(--color-danger-bg)',
                                    color: 'var(--color-danger-text)', borderRadius: 6, cursor: 'pointer'
                                  }}
                                >
                                  <Trash2 size={12} /> Xóa
                                </button>
                              ) : (
                                <>
                                  <button
                                    disabled={busy === devId}
                                    onClick={() => rejectDevice(device)}
                                    style={{
                                      padding: '5px 9px', fontSize: 11.5, fontWeight: 600,
                                      border: '1px solid rgba(239, 68, 68, 0.25)', background: 'var(--color-danger-bg)',
                                      color: 'var(--color-danger-text)', borderRadius: 6, cursor: 'pointer'
                                    }}
                                  >
                                    <Trash2 size={12} /> Thu hồi
                                  </button>
                                  {orderCount === 0 && (
                                    <button
                                      disabled={busy === devId}
                                      onClick={() => deleteDevicePermanent(device)}
                                      title="Xóa vĩnh viễn máy thử nghiệm 0 đơn này"
                                      style={{
                                        padding: '5px 9px', fontSize: 11.5, fontWeight: 600,
                                        border: '1px solid #fecaca', background: '#fef2f2',
                                        color: '#dc2626', borderRadius: 6, cursor: 'pointer'
                                      }}
                                    >
                                      <Trash2 size={12} /> Xóa
                                    </button>
                                  )}
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* PAGINATION */}
          {!loading && filteredDevices.length > 0 && (
            <Pagination
              page={page}
              pageSize={pageSize}
              total={filteredDevices.length}
              onPageChange={setPage}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setPage(1);
              }}
              pageSizeOptions={[5, 10, 20]}
              itemLabel="thiết bị"
            />
          )}
        </div>
      )}

      {/* Modal Cấp / Đổi PIN 6 số */}
      {pinModalDevice && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(2px)'
        }}>
          <div style={{
            background: '#ffffff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 400,
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', fontFamily: 'Inter, system-ui, sans-serif'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <KeyRound size={20} color="#16a34a" />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                  Cấp Mã PIN 6 Số Cho Nhân Viên
                </h3>
              </div>
              <button
                onClick={() => setPinModalDevice(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSavePin}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                  Tên Đăng Nhập Nội Bộ
                </label>
                <input
                  type="text"
                  value={pinLoginName}
                  onChange={(e) => setPinLoginName(e.target.value.toLowerCase())}
                  placeholder="VD: yen, hung, kho1..."
                  required
                  style={{
                    width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1',
                    fontSize: 14, boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                  Mã PIN 6 Số (Mới)
                </label>
                <input
                  type="password"
                  maxLength={6}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="• • • • • •"
                  required
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 8, border: '2px solid #cbd5e1',
                    fontSize: 18, textAlign: 'center', letterSpacing: 8, fontWeight: 800, boxSizing: 'border-box'
                  }}
                />
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4, textAlign: 'center' }}>
                  Mã PIN được băm một chiều bảo mật bằng bcrypt.
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setPinModalDevice(null)}
                  style={{
                    flex: 1, padding: 10, background: '#f1f5f9', color: '#475569', border: 'none',
                    borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer'
                  }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSavingPin || pinInput.length !== 6}
                  style={{
                    flex: 1, padding: 10, background: pinInput.length === 6 ? '#16a34a' : '#cbd5e1',
                    color: '#ffffff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13,
                    cursor: pinInput.length === 6 ? 'pointer' : 'not-allowed'
                  }}
                >
                  {isSavingPin ? 'Đang lưu...' : 'Lưu Mã PIN'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal xem đơn hàng của máy trạm */}
      {selectedDeviceForOrders && (
        <DeviceOrdersModal
          device={selectedDeviceForOrders}
          onClose={() => setSelectedDeviceForOrders(null)}
        />
      )}
    </div>
  );
}
