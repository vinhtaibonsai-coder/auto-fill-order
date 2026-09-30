import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthSession } from '../../../../domain/auth/auth.session.esm.js';
import { OrderStorage } from '../../../../application/storage.esm.js';
import DeviceOrdersModal from '../../components/DeviceOrdersModal';
import Pagination from '../../components/Pagination';
import { TIME_PRESETS, filterOrdersByTimePreset, calculateOrdersKPI } from '../../utils/timeFilter.js';
import { RealtimeService } from '../../../../domain/realtime/realtime.service.esm.js';

const ROLES = { OWNER: 'Chủ shop', SHOP_OWNER: 'Chủ shop', MANAGER: 'Quản lý', SHOP_MANAGER: 'Quản lý', STAFF: 'Nhân viên', SHOP_STAFF: 'Nhân viên', VIEWER: 'Người xem' };
const roleColor = role => /OWNER/.test(role) ? ['#f3e8ff', '#7e22ce'] : /MANAGER/.test(role) ? ['#dbeafe', '#1d4ed8'] : ['#dcfce7', '#15803d'];
const initials = name => String(name || 'TV').trim().split(/\s+/).slice(-2).map(x => x[0]).join('').toUpperCase();

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
  let bg = '#eff6ff';

  if (browser.includes('edg') || browser.includes('edge')) {
    name = 'Microsoft Edge';
    icon = '🌊';
    color = '#0284c7';
    bg = '#f0f9ff';
  } else if (browser.includes('coc') || browser.includes('cốc cốc')) {
    name = 'Cốc Cốc';
    icon = '🌴';
    color = '#16a34a';
    bg = '#f0fdf4';
  } else if (browser.includes('brave')) {
    name = 'Brave Browser';
    icon = '🦁';
    color = '#ea580c';
    bg = '#fff7ed';
  } else if (browser.includes('firefox')) {
    name = 'Mozilla Firefox';
    icon = '🦊';
    color = '#d97706';
    bg = '#fffbeb';
  } else if (browser.includes('safari') && !browser.includes('chrome')) {
    name = 'Safari';
    icon = '🧭';
    color = '#0284c7';
    bg = '#f0f9ff';
  } else if (browser.includes('opera') || browser.includes('opr')) {
    name = 'Opera';
    icon = '⭕';
    color = '#dc2626';
    bg = '#fef2f2';
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

const getDeviceOnlineInfo = (device, presenceMap = {}) => {
  if (device.revoked || device.status === 'revoked') {
    return {
      status: 'revoked',
      text: 'Đã khóa',
      color: '#dc2626',
      bg: '#fee2e2',
      border: '#fecaca'
    };
  }

  const devId = device.device_id || device.id;
  if (presenceMap && presenceMap[devId]) {
    return {
      status: 'online',
      text: 'Trực tuyến Realtime',
      color: '#15803d',
      bg: '#dcfce7',
      border: '#86efac',
      isRealtime: true
    };
  }

  const lastDate = device.last_seen || device.last_order_at;
  if (!lastDate) {
    return {
      status: 'offline',
      text: 'Chưa kết nối',
      color: '#64748b',
      bg: '#f8fafc',
      border: '#cbd5e1'
    };
  }

  const diffMs = Math.max(0, Date.now() - new Date(lastDate).getTime());
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins <= 7) {
    return {
      status: 'online',
      text: 'Đang Online',
      color: '#15803d',
      bg: '#dcfce7',
      border: '#86efac'
    };
  }

  if (diffMins <= 30) {
    return {
      status: 'recent',
      text: 'Vừa hoạt động',
      color: '#b45309',
      bg: '#fef3c7',
      border: '#fde68a'
    };
  }

  return {
    status: 'offline',
    text: 'Offline',
    color: '#64748b',
    bg: '#f1f5f9',
    border: '#cbd5e1'
  };
};

const getClientContext = (device) => {
  const metadata = device?.metadata || {};
  const clientType = String(device?.client_type || metadata.clientType || 'LEGACY_UNKNOWN').toUpperCase();
  const environment = String(device?.environment || metadata.environment || 'UNKNOWN').toUpperCase();
  return {
    clientType,
    environment,
    surface: String(device?.last_surface || metadata.surface || 'UNKNOWN').toUpperCase(),
    isBillable: device?.is_billable === true || (clientType === 'EXTENSION' && environment === 'PRODUCTION')
  };
};

const isActiveInstallation = device => !device?.revoked && (!device?.status || String(device.status).toLowerCase() === 'active');

const getClientBadge = (device) => {
  const context = getClientContext(device);
  if (context.environment === 'LOCAL') return { label: 'Web · Local', color: '#9a3412', background: '#ffedd5' };
  if (context.clientType === 'EXTENSION') return { label: 'Extension', color: '#166534', background: '#dcfce7' };
  if (context.clientType === 'WEB') return { label: 'Web', color: '#1d4ed8', background: '#dbeafe' };
  return { label: 'Chưa phân loại', color: '#475569', background: '#e2e8f0' };
};

export default function Team() {
  const [subTab, setSubTab] = useState('staff_key'); // 'staff_key' | 'email_members'
  const [staffDevices, setStaffDevices] = useState([]);
  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [shopAccessKey, setShopAccessKey] = useState('');
  const [shopQuota, setShopQuota] = useState({ max_devices: 5, max_users: 1 });
  const [subscription, setSubscription] = useState({ plan_tier: 'FREE', status: 'active' });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState(null);
  const [currentDeviceId, setCurrentDeviceId] = useState('');
  const [onlinePresenceMap, setOnlinePresenceMap] = useState({});
  const [activeShopId, setActiveShopId] = useState(null);

  // Lắng nghe máy trạm trực tuyến thời gian thực (Supabase Realtime Presence)
  useEffect(() => {
    if (!activeShopId) return;
    let unsub = null;
    let cancelled = false;

    (async () => {
      try {
        unsub = await RealtimeService.subscribeWorkstationPresence(activeShopId, (onlineMap) => {
          if (!cancelled) setOnlinePresenceMap(onlineMap || {});
        });
      } catch (e) {
        console.warn('[TeamPresence] Lỗi subscribe presence:', e);
      }
    })();

    return () => {
      cancelled = true;
      if (typeof unsub === 'function') {
        try { unsub(); } catch (_) {}
      }
    };
  }, [activeShopId]);
  
  // Device orders detail modal state
  const [selectedDeviceForOrders, setSelectedDeviceForOrders] = useState(null);
  const [allSubmittedOrders, setAllSubmittedOrders] = useState([]);
  
  // KPI Time Range Filter state ('ALL' | 'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS' | 'THIS_MONTH')
  const [timePreset, setTimePreset] = useState('ALL');
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Pagination states
  const [pageStaff, setPageStaff] = useState(1);
  const [pageSizeStaff, setPageSizeStaff] = useState(10);
  const [pageMembers, setPageMembers] = useState(1);
  const [pageSizeMembers, setPageSizeMembers] = useState(10);
  
  // Edit staff alias state
  const [editingStaffId, setEditingStaffId] = useState(null);
  const [editingStaffName, setEditingStaffName] = useState('');

  // Edit device name / location state
  const [editingDeviceId, setEditingDeviceId] = useState(null);
  const [editingDeviceName, setEditingDeviceName] = useState('');

  // Load current device ID on mount
  useEffect(() => {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['device_id'], res => {
          if (res?.device_id) setCurrentDeviceId(res.device_id);
        });
      } else {
        const stored = localStorage.getItem('device_id');
        if (stored) setCurrentDeviceId(stored);
      }
    } catch (_) {}
  }, []);

  // Email Invite states
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('STAFF');
  // Quick link state
  const [quickLink, setQuickLink] = useState('');

  const cloud = async () => {
    const config = await globalThis.SupabaseCloud.loadConfig();
    const session = await AuthSession.getSession();
    if (!session?.active_shop_id || !session?.access_token) throw new Error('Phiên đăng nhập không hợp lệ.');
    return { config, session, headers: { apikey: config.anonKey, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' } };
  };

  const rpc = async (name, body) => {
    const { config, headers } = await cloud();
    const response = await fetch(`${config.url}/rest/v1/rpc/${name}`, { method: 'POST', headers, body: JSON.stringify(body) });
    const data = await response.json().catch(() => null);
    if (!response.ok || data?.success === false) throw new Error(data?.message || data?.error || `Không thể thực hiện (${response.status}).`);
    return data;
  };

  const flash = (type, text) => { setNotice({ type, text }); setTimeout(() => setNotice(null), 4500); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { config, session, headers } = await cloud();
      const shopId = session.active_shop_id;
      setActiveShopId(shopId);

      // 1. Tải thông tin Shop để lấy Shop Access Key
      const shopRes = await fetch(`${config.url}/rest/v1/shops?id=eq.${shopId}&select=shop_access_key,id`, { headers }).catch(() => null);
      if (shopRes && shopRes.ok) {
        const shopsData = await shopRes.json();
        if (shopsData && shopsData[0]) {
          setShopAccessKey(shopsData[0].shop_access_key || `KEY-SHOP-${shopsData[0].id.slice(0, 8).toUpperCase()}`);
        }
      }

      // 2. Tải thông tin Quota & Gói cước của shop
      const [quotaRes, subRes] = await Promise.all([
        fetch(`${config.url}/rest/v1/shop_quotas?shop_id=eq.${shopId}&select=max_devices`, { headers }).catch(() => null),
        fetch(`${config.url}/rest/v1/subscriptions?shop_id=eq.${shopId}&select=*`, { headers }).catch(() => null)
      ]);
      if (quotaRes && quotaRes.ok) {
        const quotaData = await quotaRes.json();
        if (quotaData && quotaData[0]) {
          setShopQuota(current => ({ ...current, max_devices: Number(quotaData[0].max_devices || current.max_devices) }));
        }
      }
      if (subRes && subRes.ok) {
        const subData = await subRes.json();
        if (subData && subData[0]) {
          const row = subData[0];
          setSubscription({ ...row, plan_tier: row.plan_tier || row.plan_code || 'FREE' });
        }
      }

      // 4. Tải danh sách thành viên Email & Lời mời
      let memberRows = null;
      try {
        const memberRes = await fetch(`${config.url}/rest/v1/rpc/owner_get_members_v3`, { 
          method: 'POST', 
          headers, 
          body: JSON.stringify({ p_shop_id: shopId }) 
        });
        if (memberRes.ok) {
          const resData = await memberRes.json();
          if (resData?.success === false) throw new Error(resData.message || resData.error || 'Không thể tải thành viên.');
          if (resData?.members && Array.isArray(resData.members)) memberRows = resData.members;
          else if (Array.isArray(resData)) memberRows = resData;
        } else {
          const errorBody = await memberRes.json().catch(() => null);
          throw new Error(errorBody?.message || errorBody?.error || `Không thể tải thành viên (${memberRes.status}).`);
        }
      } catch (memberError) {
        console.warn('[TeamMembers] owner_get_members_v3 unavailable:', memberError.message);
      }

      // Fallback: Đọc trực tiếp shop_members và tự động map thông tin email từ profiles
      if (!memberRows) {
        const sess = session;
        let fallback = await fetch(`${config.url}/rest/v1/shop_members?shop_id=eq.${sess.active_shop_id}&removed_at=is.null&select=id,user_id,role,status,created_at`, { headers }).catch(() => null);
        if (!fallback?.ok) {
          fallback = await fetch(`${config.url}/rest/v1/shop_members?shop_id=eq.${sess.active_shop_id}&select=id,user_id,role,status,created_at`, { headers }).catch(() => null);
        }
        if (fallback?.ok) {
          const rawMembers = await fallback.json();

          memberRows = (rawMembers || []).map(row => {
            const isCurrentUser = row.user_id === sess.user?.id;
            return {
              id: row.id,
              member_id: row.id,
              user_id: row.user_id,
              email: (isCurrentUser ? sess.user?.email : null) || 'Chưa liên kết email',
              full_name: (isCurrentUser ? (sess.user?.full_name || sess.user?.email) : null) || `Thành viên ${String(row.user_id || '').slice(0, 8)}`,
              role_code: row.role || 'STAFF',
              role: row.role || 'STAFF',
              status: row.status || 'ACTIVE',
              joined_at: row.created_at,
              orders_count: 0
            };
          });
        }
      }

      let inviteRows = [];
      try {
        const inviteRes = await fetch(`${config.url}/rest/v1/shop_invites?shop_id=eq.${shopId}&status=eq.PENDING&select=id,email,role,status,expires_at,created_at&order=created_at.desc`, { headers });
        if (inviteRes.ok) inviteRows = await inviteRes.json();
      } catch (_) {}

      // 3. Tải danh sách nhân viên kho & máy trạm (Ưu tiên RPC owner_get_shop_staff_and_devices)
      let loadedDevices = [];
      try {
        const staffRes = await fetch(`${config.url}/rest/v1/rpc/owner_get_shop_staff_and_devices`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ p_shop_id: shopId })
        }).catch(() => null);

        if (staffRes && staffRes.ok) {
          const staffData = await staffRes.json();
          if (staffData && staffData.staff_devices && Array.isArray(staffData.staff_devices)) {
            loadedDevices = staffData.staff_devices;
          }
        }
      } catch (_) {}

      if (!loadedDevices || loadedDevices.length === 0) {
        try {
          const devRes2 = await fetch(`${config.url}/rest/v1/rpc/owner_get_devices_v2`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ p_shop_id: shopId })
          }).catch(() => null);
          if (devRes2 && devRes2.ok) {
            const d2 = await devRes2.json();
            if (d2?.devices && Array.isArray(d2.devices)) loadedDevices = d2.devices;
            else if (Array.isArray(d2)) loadedDevices = d2;
          }
        } catch (_) {}
      }

      if (!loadedDevices || loadedDevices.length === 0) {
        // Fallback đọc trực tiếp extension_devices
        const devRes = await fetch(`${config.url}/rest/v1/extension_devices?shop_id=eq.${shopId}&order=last_seen.desc`, { headers }).catch(() => null);
        if (devRes && devRes.ok) {
          const devs = await devRes.json();
          loadedDevices = (devs || []).map(d => ({ ...d, staff_name: d.staff_name || 'Nhân viên kho', orders_count: 0, total_cod: 0 }));
        }
      }

      // 3.1 Tải danh sách đơn hàng đã gửi (submitted_orders) để tính KPI chính xác cho từng máy
      let allOrders = [];
      try {
        const ordersRes = await fetch(`${config.url}/rest/v1/submitted_orders?shop_id=eq.${shopId}&select=*&order=submitted_at.desc&limit=5000`, { headers }).catch(() => null);
        if (ordersRes && ordersRes.ok) {
          allOrders = await ordersRes.json();
        }
      } catch (err) {
        console.warn('[TeamKPI] Lỗi tải submitted_orders cloud:', err);
      }

      if (!allOrders || allOrders.length === 0) {
        try {
          if (typeof OrderStorage !== 'undefined' && OrderStorage.getSubmittedOrders) {
            const localOrders = await OrderStorage.getSubmittedOrders().catch(() => []);
            if (Array.isArray(localOrders) && localOrders.length > 0) {
              allOrders = localOrders;
            }
          }
        } catch (_) {}
      }

      setAllSubmittedOrders(allOrders || []);

      if (loadedDevices.length > 0) {
        const currentSessionUserId = session?.user?.id ? String(session.user.id).trim() : null;
        const currentSessionEmail = session?.user?.email ? String(session.user.email).trim().toLowerCase() : null;
        const currentSessionUsername = currentSessionEmail ? currentSessionEmail.split('@')[0] : '';
        const currentSessionName = (session?.user?.full_name || currentSessionUsername || '').trim().toLowerCase();

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

        loadedDevices = loadedDevices.map(dev => {
          // Orders are attributed only by the immutable source device ID.
          const matched = Array.isArray(allOrders) ? allOrders.filter(so => (
            dev.device_id && so.source_device_id && String(so.source_device_id) === String(dev.device_id)
          )) : [];

          const count = matched.length;
          const cod = matched.reduce((sum, o) => sum + Number(o.cod_amount || o.codAmount || 0), 0);
          const lastTime = matched[0]?.submitted_at || matched[0]?.submittedAt || dev.last_seen;

          // Phân biệt phương thức đăng nhập: Email Account vs Shop Key
          const devStaffName = String(dev.staff_name || dev.full_name || '').trim();
          const devStaffNameLower = devStaffName.toLowerCase();
          const devUserId = dev.user_id ? String(dev.user_id).trim() : null;
          const isThisMachine = Boolean(currentDeviceId && dev.device_id && dev.device_id === currentDeviceId);

          // 1. Khớp theo user_id hoặc email hoặc username với danh sách thành viên shop_members
          const isSessionUser = Boolean(currentSessionUserId && devUserId && devUserId === currentSessionUserId);
          const matchedMember = memberRows?.find(m => {
            if (!m) return false;
            const mUserId = m.user_id ? String(m.user_id).trim() : null;
            const mEmail = m.email ? String(m.email).trim().toLowerCase() : '';
            const mUsername = mEmail ? mEmail.split('@')[0] : '';
            const mName = m.full_name ? String(m.full_name).trim().toLowerCase() : '';

            if (devUserId && mUserId && devUserId === mUserId) return true;
            if (dev.user_email && mEmail && String(dev.user_email).trim().toLowerCase() === mEmail) return true;
            if (dev.email && mEmail && String(dev.email).trim().toLowerCase() === mEmail) return true;
            if (devStaffNameLower && mUsername && devStaffNameLower === mUsername) return true;
            if (devStaffNameLower && mName && devStaffNameLower === mName) return true;
            if (devStaffNameLower && mEmail && devStaffNameLower === mEmail) return true;
            return false;
          });

          // 2. Xác định tài khoản email thực tế của thiết bị
          const rawEmail = dev.user_email || 
            dev.email || 
            matchedMember?.email || 
            (isSessionUser ? currentSessionEmail : null) || 
            (isThisMachine ? currentSessionEmail : null) || 
            dev.metadata?.email || 
            dev.metadata?.user_email || 
            null;

          const isRealEmail = Boolean(
            rawEmail && 
            rawEmail.includes('@') && 
            !rawEmail.endsWith('.local') && 
            !rawEmail.includes('@shop.')
          );

          const isOwner = Boolean(
            dev.is_owner_device === true ||
            dev.metadata?.is_owner_device === true ||
            matchedMember?.role_code === 'OWNER' ||
            matchedMember?.role === 'OWNER' ||
            dev.member_role === 'OWNER' ||
            (isSessionUser && /chủ shop|owner|admin/i.test(currentSessionName))
          );

          const isEmailAuth = Boolean(
            isRealEmail ||
            dev.auth_type === 'email' ||
            dev.metadata?.auth_type === 'email' ||
            matchedMember ||
            isOwner
          );

          const finalEmail = isRealEmail ? rawEmail : (isOwner ? (rawEmail || 'Chủ Shop') : null);
          const finalStaffName = devStaffName || (matchedMember?.full_name) || (isRealEmail ? rawEmail.split('@')[0] : 'Nhân viên kho');

          return {
            ...dev,
            raw_orders: matched,
            staff_name: finalStaffName,
            orders: matched,
            orders_count: Number(dev.orders_count || 0) > 0 ? Number(dev.orders_count) : count,
            total_cod: Number(dev.total_cod || 0) > 0 ? Number(dev.total_cod) : cod,
            last_seen: dev.last_seen || lastTime,
            is_email_login: isEmailAuth,
            auth_type: isEmailAuth ? 'email' : 'shop_key',
            auth_email: finalEmail,
            is_owner_device: isOwner,
            member_role: matchedMember?.role_code || dev.member_role || (isOwner ? 'OWNER' : (isEmailAuth ? 'MEMBER' : 'STAFF'))
          };
        });
      }

      setStaffDevices(loadedDevices);

      if (memberRows && Array.isArray(memberRows) && Array.isArray(allOrders) && allOrders.length > 0) {
        memberRows = memberRows.map(mem => {
          const mEmail = String(mem.email || '').trim().toLowerCase();
          const mUserId = String(mem.user_id || '').trim();

          const mMatched = allOrders.filter(so => {
            const uEmail = String(so.user_email || '').trim().toLowerCase();
            const uId = String(so.submitted_by || so.created_by || so.user_id || '').trim();

            if (mUserId && uId && mUserId === uId) return true;
            if (mEmail && uEmail && mEmail === uEmail) return true;
            return false;
          });

          return {
            ...mem,
            raw_orders: mMatched,
            orders: mMatched,
            orders_count: Number(mem.orders_count || 0) > 0 ? Number(mem.orders_count) : mMatched.length,
            total_cod: mMatched.reduce((sum, o) => sum + Number(o.cod_amount || o.codAmount || 0), 0)
          };
        });
      }

      setMembers(memberRows || []);
      setInvites(inviteRows || []);
    } catch (error) {
      flash('error', error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Dynamic Time-Filtered Orders & KPI Metrics
  const filteredTeamOrders = useMemo(() => {
    return filterOrdersByTimePreset(allSubmittedOrders, timePreset);
  }, [allSubmittedOrders, timePreset]);

  const teamKPI = useMemo(() => {
    return calculateOrdersKPI(filteredTeamOrders);
  }, [filteredTeamOrders]);

  const staffDevicesWithKPI = useMemo(() => {
    return staffDevices.map(dev => {
      const devOrders = Array.isArray(dev.raw_orders) ? dev.raw_orders : (Array.isArray(dev.orders) ? dev.orders : []);
      const filtered = filterOrdersByTimePreset(devOrders, timePreset);
      const kpi = calculateOrdersKPI(filtered);
      return {
        ...dev,
        orders: filtered,
        orders_count: (timePreset === 'ALL' && Number(dev.orders_count || 0) > filtered.length) ? Number(dev.orders_count) : kpi.count,
        total_cod: (timePreset === 'ALL' && Number(dev.total_cod || 0) > kpi.totalCod) ? Number(dev.total_cod) : kpi.totalCod,
        kpi_metrics: kpi
      };
    });
  }, [staffDevices, timePreset]);

  const membersWithKPI = useMemo(() => {
    return members.map(mem => {
      const memOrders = Array.isArray(mem.raw_orders) ? mem.raw_orders : (Array.isArray(mem.orders) ? mem.orders : []);
      const filtered = filterOrdersByTimePreset(memOrders, timePreset);
      const kpi = calculateOrdersKPI(filtered);
      return {
        ...mem,
        orders: filtered,
        orders_count: (timePreset === 'ALL' && Number(mem.orders_count || 0) > filtered.length) ? Number(mem.orders_count) : kpi.count,
        total_cod: (timePreset === 'ALL' && Number(mem.total_cod || 0) > kpi.totalCod) ? Number(mem.total_cod) : kpi.totalCod,
        kpi_metrics: kpi
      };
    });
  }, [members, timePreset]);

  // KPIs
  const maxAllowedDevices = shopQuota?.max_devices || 5;
  const extensionDeviceCount = staffDevices.filter(d => {
    const context = getClientContext(d);
    return isActiveInstallation(d) && context.clientType === 'EXTENSION' && context.environment === 'PRODUCTION' && context.isBillable;
  }).length;
  const webSessionCount = staffDevices.filter(d => {
    const context = getClientContext(d);
    return isActiveInstallation(d) && context.clientType === 'WEB' && context.environment !== 'LOCAL';
  }).length;
  const localSessionCount = staffDevices.filter(d => isActiveInstallation(d) && getClientContext(d).environment === 'LOCAL').length;
  const legacySessionCount = staffDevices.filter(d => isActiveInstallation(d) && getClientContext(d).clientType === 'LEGACY_UNKNOWN').length;
  const activeStaffDevicesCount = extensionDeviceCount;
  const totalStaffCount = staffDevices.length + members.length;
  const activeStaffCount = activeStaffDevicesCount + members.filter(m => String(m.status).toUpperCase() === 'ACTIVE').length;

  const totalOrdersTeam = (timePreset === 'ALL' && allSubmittedOrders.length === 0)
    ? (staffDevices.reduce((acc, d) => acc + Number(d.orders_count || 0), 0) + members.reduce((acc, m) => acc + Number(m.orders_count || 0), 0))
    : teamKPI.count;
  const totalCodTeam = (timePreset === 'ALL' && allSubmittedOrders.length === 0)
    ? staffDevices.reduce((acc, d) => acc + Number(d.total_cod || 0), 0)
    : teamKPI.totalCod;

  // Manual refresh handler
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await load();
      flash('success', 'Đã làm mới dữ liệu đơn và hiệu suất đội ngũ!');
    } catch (e) {
      flash('error', e.message || 'Lỗi khi làm mới dữ liệu.');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Filter devices by auth method
  const [deviceAuthFilter, setDeviceAuthFilter] = useState('ALL'); // 'ALL' | 'EXTENSION' | 'WEB' | 'LOCAL'

  const filteredStaffDevices = useMemo(() => {
    if (deviceAuthFilter === 'EXTENSION') {
      return staffDevicesWithKPI.filter(d => getClientContext(d).clientType === 'EXTENSION' && getClientContext(d).environment !== 'LOCAL');
    }
    if (deviceAuthFilter === 'WEB') {
      return staffDevicesWithKPI.filter(d => getClientContext(d).clientType === 'WEB' && getClientContext(d).environment !== 'LOCAL');
    }
    if (deviceAuthFilter === 'LOCAL') {
      return staffDevicesWithKPI.filter(d => getClientContext(d).environment === 'LOCAL');
    }
    return staffDevicesWithKPI;
  }, [staffDevicesWithKPI, deviceAuthFilter]);

  const shopKeyDevicesCount = extensionDeviceCount;
  const emailDevicesCount = webSessionCount;

  // Paginated devices and members
  const paginatedStaffDevices = useMemo(() => {
    const start = (pageStaff - 1) * pageSizeStaff;
    return filteredStaffDevices.slice(start, start + pageSizeStaff);
  }, [filteredStaffDevices, pageStaff, pageSizeStaff]);

  const paginatedMembers = useMemo(() => {
    const start = (pageMembers - 1) * pageSizeMembers;
    return membersWithKPI.slice(start, start + pageSizeMembers);
  }, [membersWithKPI, pageMembers, pageSizeMembers]);

  // Helper tạo bộ lọc chính xác cho bảng extension_devices
  const getDeviceQueryFilter = (device, shopId) => {
    const isUuid = (val) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(val || ''));
    if (device.id && isUuid(device.id)) {
      return `shop_id=eq.${shopId}&id=eq.${device.id}`;
    }
    if (device.device_id) {
      return `shop_id=eq.${shopId}&device_id=eq.${encodeURIComponent(device.device_id)}`;
    }
    return `shop_id=eq.${shopId}`;
  };

  // Xử lý đổi tên nhân viên kho
  const handleSaveStaffName = async (device) => {
    const cleanName = editingStaffName.trim();
    if (!cleanName) return flash('error', 'Tên nhân viên không được để trống.');
    const targetKey = device.device_id || device.id;
    setBusy(targetKey);
    try {
      const { config, session, headers } = await cloud();
      try {
        await rpc('owner_update_staff_device', {
          p_shop_id: session.active_shop_id,
          p_device_id: String(targetKey),
          p_staff_name: cleanName
        });
      } catch (_) {
        // Fallback cập nhật trực tiếp bảng extension_devices
        const filter = getDeviceQueryFilter(device, session.active_shop_id);
        await fetch(
          `${config.url}/rest/v1/extension_devices?${filter}`,
          {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ staff_name: cleanName, last_seen: new Date().toISOString() })
          }
        );
      }
      setEditingStaffId(null);
      flash('success', 'Đã cập nhật tên nhân viên.');
      await load();
    } catch (err) {
      flash('error', err.message);
    } finally {
      setBusy('');
    }
  };

  // Xử lý đổi tên/vị trí máy trạm (Device Name / Alias)
  const handleSaveDeviceName = async (device) => {
    const cleanName = editingDeviceName.trim();
    if (!cleanName) return flash('error', 'Tên máy trạm không được để trống.');
    const targetKey = device.device_id || device.id;
    setBusy(targetKey);
    try {
      const { config, session, headers } = await cloud();
      try {
        await rpc('owner_update_staff_device', {
          p_shop_id: session.active_shop_id,
          p_device_id: String(targetKey),
          p_device_name: cleanName
        });
      } catch (_) {
        // Fallback cập nhật trực tiếp bảng extension_devices
        const filter = getDeviceQueryFilter(device, session.active_shop_id);
        await fetch(
          `${config.url}/rest/v1/extension_devices?${filter}`,
          {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ device_name: cleanName, last_seen: new Date().toISOString() })
          }
        );
      }
      setEditingDeviceId(null);
      flash('success', 'Đã cập nhật tên máy trạm.');
      await load();
    } catch (err) {
      flash('error', err.message);
    } finally {
      setBusy('');
    }
  };

  // Xử lý Khóa / Mở khóa máy trạm (Kill-switch)
  const handleToggleStaffStatus = async (device) => {
    const willRevoke = !device.revoked && device.status === 'active';
    const actionLabel = willRevoke ? 'Khóa / Thu hồi quyền' : 'Kích hoạt lại';
    if (!confirm(`Bạn có chắc chắn muốn ${actionLabel} của máy “${device.staff_name || device.device_name || 'này'}”?`)) return;

    const targetKey = device.device_id || device.id;
    setBusy(targetKey);
    try {
      const { config, session, headers } = await cloud();
      try {
        await rpc('owner_update_staff_device', {
          p_shop_id: session.active_shop_id,
          p_device_id: String(targetKey),
          p_status: willRevoke ? 'revoked' : 'active'
        });
      } catch (_) {
        // Fallback cập nhật trực tiếp bảng extension_devices
        const filter = getDeviceQueryFilter(device, session.active_shop_id);
        const patchRes = await fetch(
          `${config.url}/rest/v1/extension_devices?${filter}`,
          {
            method: 'PATCH',
            headers,
            body: JSON.stringify({
              status: willRevoke ? 'revoked' : 'active',
              revoked: willRevoke,
              last_seen: new Date().toISOString()
            })
          }
        );
        if (!patchRes.ok) {
          throw new Error('Không thể cập nhật trạng thái thiết bị.');
        }
      }
      flash('success', `Đã ${actionLabel.toLowerCase()} máy trạm thành công.`);
      await load();
    } catch (err) {
      flash('error', err.message);
    } finally {
      setBusy('');
    }
  };

  // Thu hồi máy trạm (giữ lịch sử để đối soát; không xóa vật lý từ browser)
  const handleRevokeDevice = async (device) => {
    if (!confirm(`⚠️ THU HỒI MÁY TRẠM: Bạn có chắc chắn muốn thu hồi quyền của máy “${device.staff_name || device.device_name || 'này'}”?\nMáy sẽ bị đăng xuất từ xa; lịch sử đơn và audit vẫn được giữ lại.`)) return;

    const targetKey = device.device_id || device.id;
    setBusy(targetKey);
    try {
      const { session } = await cloud();
      try {
        await rpc('owner_revoke_device', {
          p_shop_id: session.active_shop_id,
          p_device_id: String(targetKey),
          p_reason: 'MANUAL_DEVICE_REVOCATION'
        });
      } catch (revokeError) {
        // Compatibility with installations that have v76 but not v80 yet.
        await rpc('owner_update_staff_device', {
          p_shop_id: session.active_shop_id,
          p_device_id: String(targetKey),
          p_status: 'revoked'
        }).catch(() => { throw revokeError; });
      }
      flash('success', 'Đã thu hồi máy trạm. Lịch sử đơn vẫn được giữ để đối soát.');
      await load();
    } catch (err) {
      flash('error', err.message);
    } finally {
      setBusy('');
    }
  };

  // Copy Shop Key
  const copyShopKey = async () => {
    if (!shopAccessKey) return;
    await navigator.clipboard.writeText(shopAccessKey);
    flash('success', `Đã sao chép mã Shop Access Key (${shopAccessKey})! Gửi mã này cho nhân viên để kích hoạt.`);
  };

  // Reset Shop Key
  const resetShopKey = async () => {
    if (!confirm('⚠️ CẢNH BÁO: Đổi mã Shop Access Key mới sẽ làm vô hiệu hóa mã cũ. Các nhân viên đang dùng mã cũ sẽ cần nhập mã mới để tiếp tục lên đơn. Bạn có chắc chắn muốn đổi mã?')) return;
    setBusy('reset_key');
    try {
      const { session } = await cloud();
      const res = await rpc('admin_reset_shop_access_key', { p_shop_id: session.active_shop_id });
      if (res && res.shop_access_key) {
        setShopAccessKey(res.shop_access_key);
        flash('success', 'Đã tạo mã Shop Access Key mới thành công!');
      }
    } catch (err) {
      flash('error', err.message);
    } finally {
      setBusy('');
    }
  };

  // Email Invite methods
  const inviteByEmail = async e => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(inviteEmail.trim())) return flash('error', 'Email chưa đúng định dạng.');
    setBusy('invite');
    try {
      await rpc('owner_create_email_invite', { p_shop_id: (await cloud()).session.active_shop_id, p_email: inviteEmail.trim().toLowerCase(), p_role: inviteRole });
      setInviteEmail('');
      setShowInvite(false);
      flash('success', 'Đã tạo lời mời qua email.');
      await load();
    } catch (error) { flash('error', error.message); } finally { setBusy(''); }
  };

  const createLink = async () => {
    setBusy('link');
    try {
      const data = await rpc('owner_create_invite_link', { p_shop_id: (await cloud()).session.active_shop_id, p_role: inviteRole });
      const inviteUrl = data.invite_url || `#/join?token=${data.token}`;
      setQuickLink(inviteUrl.startsWith('#') ? `${location.origin}${location.pathname}${inviteUrl}` : inviteUrl);
      flash('success', 'Đã tạo link mời dùng một lần.');
    } catch (error) { flash('error', error.message); } finally { setBusy(''); }
  };

  const handleCleanupInactiveDevices = async () => {
    if (!confirm('Hệ thống sẽ tự động dọn dẹp các máy trạm / profile thử nghiệm có 0 đơn hàng hoặc đã khóa. Bạn có muốn tiếp tục?')) return;
    setBusy('cleanup');
    try {
      const { session } = await cloud();
      const res = await rpc('owner_cleanup_inactive_devices', { p_shop_id: session.active_shop_id });
      if (res && res.success) {
        flash('success', res.message || 'Đã dọn dẹp sạch các thiết bị rác!');
      } else {
        flash('info', 'Không có thiết bị rác nào cần dọn dẹp.');
      }
      await load();
    } catch (err) {
      flash('error', err.message || 'Không thể dọn dẹp thiết bị.');
    } finally {
      setBusy('');
    }
  };

  const handleDeleteStaffDevice = async (device) => {
    if (!confirm(`Bạn có chắc muốn xóa vĩnh viễn máy "${device.device_name || device.staff_name}"?`)) return;
    const targetKey = device.device_id || device.id;
    setBusy(targetKey);
    try {
      const { config, session, headers } = await cloud();
      const filter = getDeviceQueryFilter(device, session.active_shop_id);
      await fetch(`${config.url}/rest/v1/extension_devices?${filter}`, {
        method: 'DELETE',
        headers
      });
      flash('success', 'Đã xóa thiết bị thành công.');
      await load();
    } catch (err) {
      flash('error', err.message);
    } finally {
      setBusy('');
    }
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(quickLink);
    flash('success', 'Đã sao chép link mời.');
  };

  const updateMember = async (member, action, value = null) => {
    const label = member.full_name || member.email || 'thành viên';
    if ((action === 'REMOVE' || action === 'SUSPEND') && !confirm(`${action === 'REMOVE' ? 'Gỡ khỏi Shop' : 'Tạm dừng'} ${label}?`)) return;
    setBusy(member.member_id);
    try {
      const { session } = await cloud();
      if (action === 'REMOVE') {
        if (!member.user_id) throw new Error('Thành viên chưa có định danh tài khoản để gỡ an toàn.');
        await rpc('owner_remove_shop_member', {
          p_shop_id: session.active_shop_id,
          p_user_id: member.user_id,
          p_reason: 'MANUAL_MEMBER_REMOVAL',
          p_revoke_devices: true
        });
        flash('success', 'Đã gỡ thành viên và thu hồi toàn bộ máy đang liên kết.');
      } else {
        await rpc('owner_update_member_v3', { p_shop_id: session.active_shop_id, p_member_id: member.member_id, p_action: action, p_value: value });
        flash('success', 'Đã cập nhật thành viên.');
      }
      await load();
    } catch (error) { flash('error', error.message); } finally { setBusy(''); }
  };

  const card = { padding: 18, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface, #fff)', width: '100%', boxSizing: 'border-box' };

  return (
    <div style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 16, width: '100%', boxSizing: 'border-box' }}>
        <div>
          <h2 className="page-title" style={{ marginBottom: 6 }}>Nhân Viên & Đội Ngũ</h2>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Quản lý định danh nhân viên kho (Shop Key), phân quyền vai trò và kiểm soát máy trạm toàn shop.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-secondary" onClick={copyShopKey} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>🔑</span> Sao chép Shop Key
          </button>
          <button className="btn-primary" onClick={() => setShowInvite(true)}>+ Mời thành viên Email</button>
        </div>
      </div>

      {notice && (
        <div role="status" style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, color: notice.type === 'error' ? '#991b1b' : '#166534', background: notice.type === 'error' ? '#fee2e2' : '#dcfce7', fontWeight: 600, width: '100%', boxSizing: 'border-box' }}>
          {notice.text}
        </div>
      )}

      {/* Shop Code & Key Banner Card */}
      <div style={{ ...card, background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.05), rgba(124, 58, 237, 0.08))', border: '1px solid rgba(79, 70, 229, 0.2)', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>MÃ CỬA HÀNG (SHOP CODE) & SHOP KEY</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 800, color: 'var(--primary)' }}>{shopAccessKey || 'Đang tải mã...'}</span>
            <span style={{ fontSize: 11, background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: 999, fontWeight: 700 }}>Hoạt động</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Nhân viên nhập <strong>Mã Shop</strong> này + <strong>Tên đăng nhập nội bộ</strong> + <strong>Mã PIN 6 số</strong> trên Extension để vào ca làm việc.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn-primary btn-sm" onClick={copyShopKey} style={{ padding: '8px 14px' }}>📋 Sao chép Mã Shop</button>
          <a href="#/devices" className="btn-secondary btn-sm" style={{ textDecoration: 'none', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>🔑</span> Cấp / Đổi PIN nhân viên
          </a>
          <button className="btn-secondary btn-sm" onClick={resetShopKey} disabled={busy === 'reset_key'} style={{ color: '#ef4444', padding: '8px 14px' }}>
            {busy === 'reset_key' ? 'Đang đổi…' : '🔄 Đổi mã'}
          </button>
        </div>
      </div>

      {/* Quota limit warning banner if reached */}
      {activeStaffDevicesCount >= maxAllowedDevices && (
        <div style={{ marginBottom: 18, padding: '12px 16px', borderRadius: 10, background: '#fffbeb', border: '1px solid #fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, width: '100%', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>⚠️</span>
            <span style={{ fontSize: 13, color: '#92400e', fontWeight: 600 }}>
              Shop đã sử dụng hết hạn mức máy tính (<b>{activeStaffDevicesCount}/{maxAllowedDevices} máy</b>) của gói <b>{subscription?.plan_tier || 'Hiện tại'}</b>. Máy trạm thứ {maxAllowedDevices + 1} sẽ bị tạm khóa cho đến khi thu hồi bớt máy cũ hoặc nâng gói.
            </span>
          </div>
          <a href="#/subscription" style={{ padding: '6px 12px', background: '#f59e0b', color: '#ffffff', borderRadius: 8, fontSize: 12, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>
            ⚡ Nâng cấp gói
          </a>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 24, width: '100%', boxSizing: 'border-box' }}>
        {[
          ['Tổng nhân sự & máy trạm', totalStaffCount, '👤', null, null],
          ['Máy Extension / Hạn mức', `${extensionDeviceCount} / ${maxAllowedDevices} máy`, '🧩', extensionDeviceCount >= maxAllowedDevices ? '#ef4444' : '#15803d', null],
          ['Phiên Web production', `${webSessionCount} phiên`, '🌐', '#1d4ed8', null],
          ['Phiên Local phát triển', `${localSessionCount} phiên`, '🧪', '#c2410c', null],
          ...(legacySessionCount > 0 ? [['Chưa phân loại', `${legacySessionCount} bản cài`, '❔', '#64748b', null]] : []),
          [
            timePreset === 'ALL' ? 'Tổng đơn đội ngũ' : `Tổng đơn (${TIME_PRESETS.find(p => p.id === timePreset)?.shortLabel || ''})`,
            totalOrdersTeam.toLocaleString('vi-VN') + ' đơn',
            '📦',
            'var(--primary)',
            () => {
              if (filteredTeamOrders.length > 0) {
                setSelectedDeviceForOrders({
                  staff_name: 'Toàn bộ đội ngũ shop',
                  device_name: 'Tất cả máy trạm',
                  device_id: 'ALL',
                  orders: filteredTeamOrders
                });
              } else {
                window.dispatchEvent(new CustomEvent('options:navigate', { detail: { tab: 'submitted-orders' } }));
              }
            }
          ],
          [
            timePreset === 'ALL' ? 'Tổng COD đã gửi' : `Tổng COD (${TIME_PRESETS.find(p => p.id === timePreset)?.shortLabel || ''})`,
            totalCodTeam.toLocaleString('vi-VN') + 'đ',
            '💰',
            '#10b981',
            () => {
              if (filteredTeamOrders.length > 0) {
                setSelectedDeviceForOrders({
                  staff_name: 'Toàn bộ đội ngũ shop',
                  device_name: 'Tất cả máy trạm',
                  device_id: 'ALL',
                  orders: filteredTeamOrders
                });
              } else {
                window.dispatchEvent(new CustomEvent('options:navigate', { detail: { tab: 'submitted-orders' } }));
              }
            }
          ]
        ].map(([label, value, icon, color, onClick]) => (
          <div
            key={label}
            onClick={onClick}
            style={{
              ...card,
              cursor: onClick ? 'pointer' : 'default',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => {
              if (onClick) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.06)';
              }
            }}
            onMouseLeave={e => {
              if (onClick) {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = 'none';
              }
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 700 }}>{label.toUpperCase()}</span>
              <span style={{ fontSize: 16 }}>{icon}</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 8, color: color || 'var(--text-main)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>{value}</span>
              {onClick && <span style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>👁️</span>}
            </div>
            {label === 'Máy Extension / Hạn mức' && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, fontWeight: 500 }}>
                Gói: <b>{subscription?.plan_tier || 'Mặc định'}</b>
              </div>
            )}
            {onClick && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, fontWeight: 500 }}>
                👉 Bấm để xem danh sách chi tiết
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Time Range Filter Bar & Quick Actions */}
      <div
        style={{
          ...card,
          padding: '12px 18px',
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          background: 'var(--surface, #ffffff)',
          border: '1px solid var(--border)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>⏱️</span> Mốc thời gian hiệu suất:
          </span>
          <div style={{ display: 'flex', background: 'var(--surface-muted, #f1f5f9)', padding: 3, borderRadius: 8, gap: 3, border: '1px solid var(--border)' }}>
            {TIME_PRESETS.map(preset => {
              const active = timePreset === preset.id;
              return (
                <button
                  key={preset.id}
                  onClick={() => { setTimePreset(preset.id); setPageStaff(1); setPageMembers(1); }}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 6,
                    border: 'none',
                    fontSize: 12.5,
                    fontWeight: active ? 700 : 500,
                    background: active ? 'var(--card, #fff)' : 'transparent',
                    color: active ? 'var(--primary)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing || loading}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              fontSize: 12.5,
              fontWeight: 700,
              background: '#eff6ff',
              color: '#1d4ed8',
              border: '1px solid #bfdbfe',
              cursor: (isRefreshing || loading) ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              transition: 'all 0.15s ease'
            }}
            title="Làm mới lại dữ liệu đơn và tính toán hiệu suất tức thì"
          >
            <span style={{ display: 'inline-block', transform: isRefreshing ? 'rotate(360deg)' : 'none', transition: 'transform 0.5s ease' }}>🔄</span>
            {isRefreshing ? 'Đang làm mới...' : 'Làm mới dữ liệu'}
          </button>
        </div>
      </div>

      {/* Sub-Tabs Selector */}
      <div style={{ display: 'flex', borderBottom: '2px solid var(--border)', marginBottom: 16, gap: 16, width: '100%', boxSizing: 'border-box', flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          onClick={() => setSubTab('staff_key')}
          style={{
            padding: '10px 16px',
            background: 'transparent',
            border: 'none',
            borderBottom: subTab === 'staff_key' ? '3px solid var(--primary)' : '3px solid transparent',
            color: subTab === 'staff_key' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: 14,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          <span>💻</span> Nhân Viên Kho & Máy Trạm ({staffDevices.length})
        </button>
        <button
          onClick={() => setSubTab('email_members')}
          style={{
            padding: '10px 16px',
            background: 'transparent',
            border: 'none',
            borderBottom: subTab === 'email_members' ? '3px solid var(--primary)' : '3px solid transparent',
            color: subTab === 'email_members' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: 14,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          <span>👑</span> Thành Viên Quản Trị Email ({members.length})
        </button>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {subTab === 'staff_key' && (
            <div style={{ display: 'flex', background: 'var(--surface-muted, #f1f5f9)', padding: 3, borderRadius: 8, gap: 3, border: '1px solid var(--border)' }}>
              <button
                onClick={() => { setDeviceAuthFilter('ALL'); setPageStaff(1); }}
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: 'none',
                  fontSize: 12,
                  fontWeight: deviceAuthFilter === 'ALL' ? 700 : 500,
                  background: deviceAuthFilter === 'ALL' ? 'var(--card, #fff)' : 'transparent',
                  color: deviceAuthFilter === 'ALL' ? 'var(--primary)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  boxShadow: deviceAuthFilter === 'ALL' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none'
                }}
              >
                Tất cả ({staffDevices.length})
              </button>
              <button
                onClick={() => { setDeviceAuthFilter('EXTENSION'); setPageStaff(1); }}
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: 'none',
                  fontSize: 12,
                  fontWeight: deviceAuthFilter === 'EXTENSION' ? 700 : 500,
                  background: deviceAuthFilter === 'EXTENSION' ? 'var(--card, #fff)' : 'transparent',
                  color: deviceAuthFilter === 'EXTENSION' ? '#15803d' : 'var(--text-muted)',
                  cursor: 'pointer',
                  boxShadow: deviceAuthFilter === 'EXTENSION' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none'
                }}
              >
                🧩 Extension ({shopKeyDevicesCount})
              </button>
              <button
                onClick={() => { setDeviceAuthFilter('WEB'); setPageStaff(1); }}
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: 'none',
                  fontSize: 12,
                  fontWeight: deviceAuthFilter === 'WEB' ? 700 : 500,
                  background: deviceAuthFilter === 'WEB' ? 'var(--card, #fff)' : 'transparent',
                  color: deviceAuthFilter === 'WEB' ? '#1d4ed8' : 'var(--text-muted)',
                  cursor: 'pointer',
                  boxShadow: deviceAuthFilter === 'WEB' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none'
                }}
              >
                🌐 Web ({emailDevicesCount})
              </button>
              <button
                onClick={() => { setDeviceAuthFilter('LOCAL'); setPageStaff(1); }}
                style={{
                  padding: '4px 10px', borderRadius: 6, border: 'none', fontSize: 12,
                  fontWeight: deviceAuthFilter === 'LOCAL' ? 700 : 500,
                  background: deviceAuthFilter === 'LOCAL' ? 'var(--card, #fff)' : 'transparent',
                  color: deviceAuthFilter === 'LOCAL' ? '#c2410c' : 'var(--text-muted)',
                  cursor: 'pointer',
                  boxShadow: deviceAuthFilter === 'LOCAL' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none'
                }}
              >
                🧪 Local ({localSessionCount})
              </button>
            </div>
          )}

          <button
            onClick={handleCleanupInactiveDevices}
            disabled={busy === 'cleanup'}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              background: '#f8fafc',
              color: '#0f766e',
              border: '1px solid #ccfbf1',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
            title="Tự động xóa sạch các profile máy thử nghiệm 0 đơn hàng hoặc đã khóa"
          >
            {busy === 'cleanup' ? 'Đang dọn dẹp...' : '🧹 Dọn dẹp profile rác (1-Click)'}
          </button>
        </div>
      </div>

      {/* TAB CONTENT 1: Nhân Viên Kho & Máy Trạm (Shop Key + Email Workstations) */}
      {subTab === 'staff_key' && (
        <div className="card" style={{ padding: 0, overflowX: 'auto', width: '100%', boxSizing: 'border-box' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 840, tableLayout: 'auto' }}>
            <thead>
              <tr style={{ background: 'var(--surface-muted, #f8fafc)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, color: 'var(--text-muted)', fontWeight: 700, width: '25%' }}>Nhân viên / Tài khoản</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, color: 'var(--text-muted)', fontWeight: 700, width: '28%' }}>Máy trạm & Vị trí</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, color: 'var(--text-muted)', fontWeight: 700, width: '14%' }}>Hiệu suất đơn hàng</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, color: 'var(--text-muted)', fontWeight: 700, width: '12%' }}>Hoạt động cuối</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, color: 'var(--text-muted)', fontWeight: 700, width: '11%' }}>Trạng thái</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, color: 'var(--text-muted)', fontWeight: 700, width: '10%' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" style={{ padding: 32, textAlign: 'center' }}>Đang tải danh sách nhân viên kho…</td></tr>
              ) : filteredStaffDevices.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ padding: 36, textAlign: 'center', color: 'var(--text-muted)' }}>
                    {deviceAuthFilter === 'EMAIL' ? 'Không có máy nào đăng nhập bằng tài khoản Email.' :
                     deviceAuthFilter === 'SHOP_KEY' ? 'Chưa có máy nhân viên nào kích hoạt bằng Shop Access Key.' :
                     'Chưa có máy trạm nào được kết nối.'}
                  </td>
                </tr>
              ) : paginatedStaffDevices.map((device, index) => {
                const rowKey = device.id || `${device.device_id || 'dev'}_${index}`;
                const isRevoked = device.revoked === true || String(device.status).toLowerCase() === 'revoked';
                const isEditingStaff = editingStaffId === (device.device_id || device.id);
                const isEditingDev = editingDeviceId === (device.device_id || device.id);
                const bInfo = getBrowserInfo(device);
                const devBadge = getDeviceBadge(device);
                const isThisDevice = currentDeviceId && (device.device_id === currentDeviceId);
                const isEmailLogin = !!device.is_email_login;
                const authEmail = device.auth_email || device.user_email || device.email;
                const isOwner = !!(device.is_owner_device || device.member_role === 'OWNER');

                return (
                  <tr key={rowKey} style={{ borderTop: '1px solid var(--border)', background: isThisDevice ? 'rgba(59, 130, 246, 0.02)' : 'transparent', opacity: isRevoked ? 0.65 : 1 }}>
                    {/* Nhân viên / Tài khoản */}
                    <td style={{ padding: '12px 14px' }}>
                      {isEditingStaff ? (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input
                            autoFocus
                            value={editingStaffName}
                            onChange={e => setEditingStaffName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSaveStaffName(device)}
                            placeholder="Tên nhân viên..."
                            style={{ padding: '4px 8px', fontSize: 13, borderRadius: 4, border: '1px solid var(--border)' }}
                          />
                          <button className="btn-primary btn-sm" onClick={() => handleSaveStaffName(device)}>Lưu</button>
                          <button className="btn-secondary btn-sm" onClick={() => setEditingStaffId(null)}>Hủy</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 38,
                            height: 38,
                            borderRadius: '50%',
                            background: isRevoked ? '#fee2e2' : isOwner ? '#fef3c7' : isEmailLogin ? '#dbeafe' : '#e0e7ff',
                            color: isRevoked ? '#dc2626' : isOwner ? '#b45309' : isEmailLogin ? '#1d4ed8' : '#4338ca',
                            display: 'grid',
                            placeItems: 'center',
                            fontWeight: 800,
                            fontSize: 13,
                            border: isOwner ? '1.5px solid #fde68a' : '1px solid var(--border)',
                            flexShrink: 0
                          }}>
                            {initials(device.staff_name || (isEmailLogin ? (authEmail || 'Admin') : 'NV'))}
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <strong style={{ fontSize: 13, color: 'var(--text-main)' }}>
                                {device.staff_name || (isEmailLogin ? (authEmail?.split('@')[0] || 'Tài khoản Email') : 'Nhân viên kho')}
                              </strong>
                              {isOwner && (
                                <span style={{ fontSize: 10, background: '#fef3c7', color: '#b45309', padding: '1px 6px', borderRadius: 4, fontWeight: 700, border: '1px solid #fde68a' }}>
                                  👑 Chủ Shop
                                </span>
                              )}
                              <button
                                title="Đổi tên nhân viên / bí danh"
                                onClick={() => { setEditingStaffId(device.device_id || device.id); setEditingStaffName(device.staff_name || ''); }}
                                style={{ border: 0, background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12 }}
                              >
                                ✏️
                              </button>
                            </div>

                            {/* Phân biệt rõ ràng giữa Đăng nhập bằng Email và Shop Key */}
                            {isEmailLogin ? (
                              <div style={{ fontSize: 11, color: '#2563eb', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                                <span>✉️</span>
                                <span>Đăng nhập Email: <strong style={{ color: '#1d4ed8' }}>{authEmail || 'Tài khoản Quản trị'}</strong></span>
                              </div>
                            ) : (
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                                <span>🔑</span>
                                <span>Đăng nhập bằng <strong>Shop Key & PIN</strong></span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </td>

                    {/* Máy trạm & Vị trí */}
                    <td style={{ padding: '12px 14px' }}>
                      {isEditingDev ? (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input
                            autoFocus
                            value={editingDeviceName}
                            onChange={e => setEditingDeviceName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSaveDeviceName(device)}
                            placeholder="Tên máy (Ví dụ: Máy bàn kho 1)..."
                            style={{ padding: '4px 8px', fontSize: 13, borderRadius: 4, border: '1px solid var(--border)' }}
                          />
                          <button className="btn-primary btn-sm" onClick={() => handleSaveDeviceName(device)}>Lưu</button>
                          <button className="btn-secondary btn-sm" onClick={() => setEditingDeviceId(null)}>Hủy</button>
                        </div>
                      ) : (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 16 }}>{bInfo.icon}</span>
                            <strong style={{ fontSize: 13, color: 'var(--text-main)' }}>
                              {device.device_name && device.device_name !== 'Chrome Extension' ? device.device_name : `${bInfo.name}`}
                            </strong>
                            <button
                              title="Đặt tên gợi nhớ cho máy tính (Ví dụ: Máy bàn kho 1, Laptop đóng hàng)"
                              onClick={() => { setEditingDeviceId(device.device_id || device.id); setEditingDeviceName(device.device_name || bInfo.name); }}
                              style={{ border: 0, background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 11 }}
                            >
                              ✏️
                            </button>
                            <span style={{ fontSize: 10, background: '#f1f5f9', color: '#475569', padding: '1px 6px', borderRadius: 4, fontFamily: 'monospace', fontWeight: 700 }}>
                              {devBadge}
                            </span>
                            {isEmailLogin ? (
                              <span style={{ fontSize: 10, background: '#eff6ff', color: '#1d4ed8', padding: '1px 6px', borderRadius: 4, fontWeight: 700, border: '1px solid #bfdbfe' }}>
                                {isOwner ? '👑 Máy Quản Trị' : '✉️ Máy Thành Viên'}
                              </span>
                            ) : (
                              <span style={{ fontSize: 10, background: '#f8fafc', color: '#64748b', padding: '1px 6px', borderRadius: 4, fontWeight: 700, border: '1px solid #e2e8f0' }}>
                                📦 Máy Trạm Kho
                              </span>
                            )}
                            {isThisDevice && (
                              <span style={{ fontSize: 10, background: '#dbeafe', color: '#1d4ed8', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>
                                📍 Máy này
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                            <span>{bInfo.name} ({bInfo.osName})</span>
                            {device.last_ip && device.last_ip !== '127.0.0.1' && <span> · IP: <code>{device.last_ip}</code></span>}
                          </div>
                        </div>
                      )}
                    </td>

                    {/* Hiệu suất đơn hàng */}
                    <td style={{ padding: '12px 14px' }}>
                      <div
                        onClick={() => {
                          setSelectedDeviceForOrders({
                            ...device,
                            orders: device.orders || []
                          });
                        }}
                        title={`Bấm để xem danh sách ${Number(device.orders_count || 0)} đơn hàng của máy này`}
                        style={{
                          cursor: 'pointer',
                          padding: '6px 10px',
                          borderRadius: 8,
                          background: Number(device.orders_count || 0) > 0 ? 'rgba(37, 99, 235, 0.05)' : 'transparent',
                          border: Number(device.orders_count || 0) > 0 ? '1px solid rgba(37, 99, 235, 0.2)' : '1px solid transparent',
                          display: 'inline-block',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={e => {
                          if (Number(device.orders_count || 0) > 0) {
                            e.currentTarget.style.background = 'rgba(37, 99, 235, 0.12)';
                            e.currentTarget.style.borderColor = 'var(--primary)';
                          }
                        }}
                        onMouseLeave={e => {
                          if (Number(device.orders_count || 0) > 0) {
                            e.currentTarget.style.background = 'rgba(37, 99, 235, 0.05)';
                            e.currentTarget.style.borderColor = 'rgba(37, 99, 235, 0.2)';
                          }
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <strong style={{ color: 'var(--primary)', fontSize: 13.5 }}>
                            {Number(device.orders_count || 0).toLocaleString('vi-VN')}
                          </strong> đơn
                          {Number(device.orders_count || 0) > 0 && (
                            <span style={{ fontSize: 11, color: 'var(--primary)', background: '#dbeafe', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>
                              👁️ Xem đơn
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11.5, color: '#10b981', fontWeight: 700, marginTop: 2 }}>
                          {Number(device.total_cod || 0).toLocaleString('vi-VN')}đ COD
                        </div>

                        {/* Progress / Tracking rate & Carrier tags */}
                        {Number(device.orders_count || 0) > 0 && device.kpi_metrics && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                            <span
                              title={`${device.kpi_metrics.trackingCount}/${device.kpi_metrics.count} đơn đã có mã vận đơn`}
                              style={{
                                fontSize: 10,
                                padding: '1px 5px',
                                borderRadius: 4,
                                fontWeight: 700,
                                background: device.kpi_metrics.hasFullTracking ? '#dcfce7' : '#fef3c7',
                                color: device.kpi_metrics.hasFullTracking ? '#166534' : '#b45309',
                                border: `1px solid ${device.kpi_metrics.hasFullTracking ? '#bbf7d0' : '#fde68a'}`
                              }}
                            >
                              {device.kpi_metrics.hasFullTracking ? '✓' : '⚠️'} {device.kpi_metrics.trackingCount}/{device.kpi_metrics.count} có mã
                            </span>
                            {device.kpi_metrics.vnpostCount > 0 && (
                              <span style={{ fontSize: 9.5, padding: '1px 4px', borderRadius: 3, fontWeight: 700, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
                                VNPost ({device.kpi_metrics.vnpostCount})
                              </span>
                            )}
                            {device.kpi_metrics.jtCount > 0 && (
                              <span style={{ fontSize: 9.5, padding: '1px 4px', borderRadius: 3, fontWeight: 700, background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }}>
                                J&T ({device.kpi_metrics.jtCount})
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Hoạt động cuối */}
                    <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-muted)' }}>
                      {relativeTime(device.last_seen || device.last_order_at)}
                    </td>

                    {/* Trạng thái */}
                    <td style={{ padding: '12px 14px' }}>
                      {(() => {
                        const onlineInfo = getDeviceOnlineInfo(device, onlinePresenceMap);
                        return (
                          <span style={{
                            fontSize: 11.5,
                            background: onlineInfo.bg,
                            color: onlineInfo.color,
                            border: `1px solid ${onlineInfo.border}`,
                            padding: '3px 8px',
                            borderRadius: 999,
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5
                          }}>
                            {onlineInfo.isRealtime ? (
                              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#16a34a' }} className="animate-ping" />
                            ) : (
                              <span>●</span>
                            )}
                            {onlineInfo.text}
                          </span>
                        );
                      })()}
                    </td>

                    {/* Thao tác (Kill-Switch, Delete & View Orders) */}
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        {Number(device.orders_count || 0) > 0 && (
                          <button
                            className="btn-secondary btn-sm"
                            title="Xem danh sách chi tiết các đơn hàng máy này đã lên"
                            onClick={() => setSelectedDeviceForOrders({
                              ...device,
                              orders: device.orders || []
                            })}
                            style={{ padding: '5px 9px', fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 4, color: 'var(--primary)', borderColor: 'rgba(37, 99, 235, 0.3)' }}
                          >
                            👁️ Xem đơn
                          </button>
                        )}
                        <button
                          className={isRevoked ? 'btn-secondary btn-sm' : 'btn-danger btn-sm'}
                          disabled={busy === (device.device_id || device.id)}
                          onClick={() => handleToggleStaffStatus(device)}
                          style={{ padding: '5px 10px', fontSize: 11.5 }}
                        >
                          {busy === (device.device_id || device.id) ? 'Đang lưu…' : (isRevoked ? '🔓 Mở khóa' : '🔒 Khóa máy')}
                        </button>
                        <button
                          title="Thu hồi quyền máy này; giữ lịch sử để đối soát"
                          disabled={busy === (device.device_id || device.id)}
                          onClick={() => handleRevokeDevice(device)}
                          style={{
                            padding: '5px 8px',
                            fontSize: 11.5,
                            border: '1px solid #e2e8f0',
                            background: '#ffffff',
                            color: '#ef4444',
                            borderRadius: 6,
                            cursor: 'pointer'
                          }}
                        >
                          🔒 Thu hồi
                        </button>
                        {(isRevoked || Number(device.orders_count || 0) === 0) && (
                          <button
                            title="Xóa vĩnh viễn máy thử nghiệm này khỏi danh sách"
                            disabled={busy === (device.device_id || device.id)}
                            onClick={() => handleDeleteStaffDevice(device)}
                            style={{
                              padding: '5px 8px',
                              fontSize: 11.5,
                              border: '1px solid #fecaca',
                              background: '#fef2f2',
                              color: '#dc2626',
                              borderRadius: 6,
                              cursor: 'pointer'
                            }}
                          >
                            🗑️ Xóa
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* TAB 1 PAGINATION */}
          {!loading && filteredStaffDevices.length > 0 && (
            <Pagination
              page={pageStaff}
              pageSize={pageSizeStaff}
              total={filteredStaffDevices.length}
              onPageChange={setPageStaff}
              onPageSizeChange={(newSize) => {
                setPageSizeStaff(newSize);
                setPageStaff(1);
              }}
              pageSizeOptions={[10, 25, 50]}
              itemLabel="máy trạm"
            />
          )}
        </div>
      )}

      {/* TAB CONTENT 2: Thành Viên Quản Trị (Email Supabase) */}
      {subTab === 'email_members' && (
        <>
          {quickLink && (
            <div style={{ ...card, marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
              <input aria-label="Link mời" readOnly value={quickLink} style={{ flex: 1, minWidth: 180, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 6 }} />
              <button className="btn-primary" onClick={copyLink}>Sao chép link</button>
            </div>
          )}

          <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 780 }}>
              <thead>
                <tr style={{ background: 'var(--surface-muted, #f8fafc)', borderBottom: '1px solid var(--border)' }}>
                  {['Thành viên', 'Vai trò', 'Hiệu suất', 'Trạng thái', 'Thao tác'].map(x => (
                    <th key={x} style={{ padding: '12px 14px', textAlign: 'left', fontSize: 12, color: 'var(--text-muted)', fontWeight: 700 }}>{x}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="5" style={{ padding: 32, textAlign: 'center' }}>Đang tải đội ngũ…</td></tr>
                ) : members.length === 0 ? (
                  <tr><td colSpan="5" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>Chưa có thành viên nào.</td></tr>
                ) : paginatedMembers.map(member => {
                  const role = String(member.role_code || 'STAFF').toUpperCase();
                  const active = String(member.status).toUpperCase() === 'ACTIVE';
                  const colors = roleColor(role);
                  const owner = /OWNER/.test(role);

                  return (
                    <tr key={member.member_id} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 36, height: 36, borderRadius: '50%', display: 'grid', placeItems: 'center', background: '#e0e7ff', color: '#3730a3', fontWeight: 750, overflow: 'hidden' }}>
                            {member.avatar_url ? <img src={member.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials(member.full_name || member.email)}
                          </div>
                          <div>
                            <strong>{member.full_name || 'Thành viên'}</strong>
                            <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{member.email || 'Chưa kích hoạt'}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: 14 }}>
                        <span style={{ padding: '5px 9px', borderRadius: 999, background: colors[0], color: colors[1], fontSize: 12, fontWeight: 700 }}>
                          {ROLES[role] || role}
                        </span>
                      </td>
                      <td style={{ padding: 14 }}>
                        <div
                          onClick={() => {
                            if (Number(member.orders_count || 0) > 0) {
                              setSelectedDeviceForOrders({
                                staff_name: member.full_name || member.email,
                                device_name: 'Thành viên Quản trị Email',
                                device_id: member.member_id || member.id,
                                orders: member.orders || []
                              });
                            }
                          }}
                          style={{
                            cursor: Number(member.orders_count || 0) > 0 ? 'pointer' : 'default',
                            display: 'inline-flex',
                            flexDirection: 'column',
                            gap: 2
                          }}
                          title={Number(member.orders_count || 0) > 0 ? `Bấm để xem danh sách ${member.orders_count} đơn của thành viên này` : undefined}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <strong style={{ color: Number(member.orders_count || 0) > 0 ? 'var(--primary)' : 'inherit', fontSize: 13.5 }}>
                              {Number(member.orders_count || 0).toLocaleString('vi-VN')}
                            </strong> đơn
                            {Number(member.orders_count || 0) > 0 && (
                              <span style={{ fontSize: 11, color: 'var(--primary)', background: '#dbeafe', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>
                                👁️ Xem
                              </span>
                            )}
                          </div>
                          {Number(member.total_cod || 0) > 0 && (
                            <div style={{ fontSize: 11.5, color: '#10b981', fontWeight: 700 }}>
                              {Number(member.total_cod || 0).toLocaleString('vi-VN')}đ COD
                            </div>
                          )}
                          {Number(member.orders_count || 0) > 0 && member.kpi_metrics && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                              <span
                                style={{
                                  fontSize: 10,
                                  padding: '1px 4px',
                                  borderRadius: 4,
                                  fontWeight: 700,
                                  background: member.kpi_metrics.hasFullTracking ? '#dcfce7' : '#fef3c7',
                                  color: member.kpi_metrics.hasFullTracking ? '#166534' : '#b45309'
                                }}
                              >
                                {member.kpi_metrics.hasFullTracking ? '✓' : '⚠️'} {member.kpi_metrics.trackingCount}/{member.kpi_metrics.count} mã
                              </span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: 14, color: active ? '#15803d' : '#b45309', fontWeight: 650 }}>
                        {active ? '● Hoạt động' : '● Tạm khóa'}
                      </td>
                      <td style={{ padding: 14 }}>
                        {owner ? (
                          <span style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 600 }}>👑 Chủ sở hữu</span>
                        ) : (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <select
                              aria-label={`Vai trò của ${member.full_name || member.email}`}
                              value={/MANAGER/.test(role) ? 'MANAGER' : 'STAFF'}
                              disabled={busy === member.member_id}
                              onChange={e => updateMember(member, 'ROLE', e.target.value)}
                              style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border)', fontSize: 12 }}
                            >
                              <option value="STAFF">Nhân viên</option>
                              <option value="MANAGER">Quản lý</option>
                            </select>
                            <button className="btn-secondary btn-sm" disabled={busy === member.member_id} onClick={() => updateMember(member, active ? 'SUSPEND' : 'ACTIVATE')}>
                              {active ? 'Tạm dừng' : 'Kích hoạt'}
                            </button>
                            <button className="btn-danger btn-sm" disabled={busy === member.member_id} onClick={() => updateMember(member, 'REMOVE')}>
                              Gỡ khỏi Shop
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* TAB 2 PAGINATION */}
            {!loading && members.length > 0 && (
              <Pagination
                page={pageMembers}
                pageSize={pageSizeMembers}
                total={members.length}
                onPageChange={setPageMembers}
                onPageSizeChange={(newSize) => {
                  setPageSizeMembers(newSize);
                  setPageMembers(1);
                }}
                pageSizeOptions={[10, 25, 50]}
                itemLabel="thành viên"
              />
            )}
          </div>
        </>
      )}

      {/* Invite Modal */}
      {showInvite && (
        <div role="dialog" aria-modal="true" aria-labelledby="invite-title" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,.45)', display: 'grid', placeItems: 'center', padding: 20 }}>
          <form onSubmit={inviteByEmail} style={{ ...card, width: 'min(440px, 100%)', boxShadow: '0 20px 50px rgba(15,23,42,.2)' }}>
            <h3 id="invite-title" style={{ marginTop: 0 }}>Mời thành viên qua email</h3>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
              Email
              <input
                autoFocus
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="nhanvien@shop.vn"
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 6, margin: '6px 0 14px', display: 'block' }}
              />
            </label>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
              Vai trò
              <select
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 6, margin: '6px 0 18px', display: 'block' }}
              >
                <option value="STAFF">Nhân viên (Chỉ bóc tách & lên đơn)</option>
                <option value="MANAGER">Quản lý (Xem báo cáo & quản trị đơn)</option>
              </select>
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" className="btn-secondary" onClick={() => setShowInvite(false)}>Hủy</button>
              <button className="btn-primary" disabled={busy === 'invite'}>
                {busy === 'invite' ? 'Đang gửi…' : 'Tạo lời mời'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Device Orders Detail Modal */}
      {selectedDeviceForOrders && (
        <DeviceOrdersModal
          isOpen={!!selectedDeviceForOrders}
          onClose={() => setSelectedDeviceForOrders(null)}
          device={selectedDeviceForOrders}
          orders={selectedDeviceForOrders.orders || []}
          initialTimePreset={timePreset}
          onNavigateToAllOrders={(targetDevice, selectedTimeFilter) => {
            const rawTarget = targetDevice?.staff_name || targetDevice?.device_name || '';
            const searchParam = (rawTarget === 'Toàn bộ đội ngũ shop' || rawTarget === 'Tất cả máy trạm') ? '' : rawTarget;
            const targetPreset = selectedTimeFilter || timePreset;
            const datePresetMap = {
              ALL: 'all',
              TODAY: 'today',
              YESTERDAY: 'yesterday',
              LAST_7_DAYS: '7days',
              THIS_MONTH: 'thisMonth'
            };
            window.dispatchEvent(new CustomEvent('options:navigate', {
              detail: {
                tab: 'submitted-orders',
                search: searchParam,
                datePreset: datePresetMap[targetPreset] || 'all'
              }
            }));
          }}
        />
      )}
    </div>
  );
}
