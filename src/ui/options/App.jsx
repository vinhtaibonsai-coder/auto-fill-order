import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AuthSession } from '../../domain/auth/auth.session.esm.js';
import Overview from './pages/Overview/Overview';

const ShopProfile = React.lazy(() => import('./pages/General/ShopProfile'));
const OrderSettings = React.lazy(() => import('./pages/General/OrderSettings'));
const SyncSettings = React.lazy(() => import('./pages/Sync/SyncSettings'));
const Notifications = React.lazy(() => import('./pages/Notifications/Notifications'));
const Security = React.lazy(() => import('./pages/Security/Security'));
const AuditLogs = React.lazy(() => import('./pages/Audit/AuditLogs'));
const Subscription = React.lazy(() => import('./pages/Subscription/Subscription'));

const AddressEngine = React.lazy(() => import('./pages/AddressEngine/AddressEngine'));
const Team = React.lazy(() => import('./pages/Team/Team'));
const PermissionMatrix = React.lazy(() => import('./pages/Team/PermissionMatrix'));
const DeviceManagement = React.lazy(() => import('./pages/Security/DeviceManagement'));
const AISettings = React.lazy(() => import('./pages/AISettings/AISettings'));
const Carriers = React.lazy(() => import('./pages/Carriers/Carriers'));
import Login from './pages/Auth/Login';
const DatabaseManager = React.lazy(() => import('./pages/Database/DatabaseManager'));
const ServerSettings = React.lazy(() => import('./pages/Server/ServerSettings'));
const SubmittedOrders = React.lazy(() => import('./pages/Orders/SubmittedOrders'));
const PrintCenter = React.lazy(() => import('./pages/Printing/PrintCenter'));
const CustomerHub = React.lazy(() => import('./pages/Customers/CustomerHub'));
const SupportCenter = React.lazy(() => import('./pages/Support/SupportCenter'));
const PartnerConsole = React.lazy(() => import('./pages/Partner/PartnerConsole'));
const SocialInbox = React.lazy(() => import('./pages/Channels/SocialInbox'));
const OrderList = React.lazy(() => import('./pages/Workspace/OrderList'));
import { AuthService } from '../../domain/auth/auth.service.esm.js';
import { RealtimeService } from '../../domain/realtime/realtime.service.esm.js';

import TopHeader from './components/TopHeader';
import UserProfileCard from './components/UserProfileCard';

const ComingSoon = ({ title }) => (
  <div className="card" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
    <h2 style={{ color: 'var(--text-main)' }}>{title}</h2>
    <p>Chức năng này đang được phát triển và sẽ sớm ra mắt trong bản cập nhật tới.</p>
  </div>
);

const TAB_TITLES = {
  'overview': 'Tổng Quan Cửa Hàng',
  'customers': 'Sổ Bạ Khách Hàng (Customer 360)',
  'orders': 'Đơn Hàng Đã Gửi',
  'submitted-orders': 'Đơn Hàng Đã Gửi',
  'print-center': 'In Nhãn Hàng Loạt (Print Center)',
  'social-inbox': 'Hộp Thư Đa Kênh (Social Inbox)',
  'drafts': 'Hàng Đợi Đơn Nháp',
  'shop-profile': 'Hồ Sơ Cửa Hàng',
  'team': 'Nhân Viên & Đội Ngũ',
  'permission-matrix': 'Ma Trận Phân Quyền (RBAC)',
  'ai-settings': 'Cấu Hình AI Bóc Tách',
  'address': 'Từ Điển Địa Chỉ (Address Engine)',
  'carriers': 'Kết Nối Hãng Vận Chuyển',
  'devices': 'Quản Lý Thiết Bị',
  'order-settings': 'Cài Đặt Mặc Định Đơn Hàng',
  'sync': 'Trung Tâm Đồng Bộ',
  'notifications': 'Thông Báo Hệ Thống',
  'security': 'Bảo Mật Tài Khoản',
  'audit': 'Nhật Ký Hoạt Động (Audit Logs)',
  'subscription': 'Gói Cước & Bản Quyền',
  'database': 'Bộ Nhớ Cục Bộ (Local Storage)',
  'support': 'Trung Tâm Hỗ Trợ & Báo Lỗi',
  'partner': 'Cổng Tích Hợp Partner API & MCP',
  'server': 'Kết Nối Máy Chủ Supabase'
};

const getRoleDisplay = (role) => {
  const roleMap = {
    'OWNER': 'Chủ cửa hàng (Owner)',
    'SHOP_OWNER': 'Chủ cửa hàng (Owner)',
    'MANAGER': 'Quản lý (Manager)',
    'SHOP_MANAGER': 'Quản lý (Manager)',
    'STAFF': 'Nhân viên (Staff)',
    'SHOP_STAFF': 'Nhân viên (Staff)',
    'VIEWER': 'Người xem (Viewer)',
    'SYSTEM_ADMIN': 'Quản trị hệ thống (Admin)'
  };
  return roleMap[role] || role;
};

const getAdminDashboardUrl = () => {
  if (typeof chrome !== 'undefined' && chrome.runtime && typeof chrome.runtime.getURL === 'function') {
    return chrome.runtime.getURL('admin-dashboard/admin.html');
  }
  return '/admin';
};

export default function App() {
  const [activeTab, setActiveTabState] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('tab') || 'overview';
    } catch (_) {
      return 'overview';
    }
  });

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const setActiveTab = (tab) => {
    setActiveTabState(tab);
    setMobileMenuOpen(false);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      window.history.replaceState(null, '', url.toString());
    } catch (_) {}
  };
  const [userRole, setUserRole] = useState('VIEWER'); // real_role từ resolve_dashboard_role
  const [uiRole, setUiRole] = useState('viewer'); // tier: master_admin / admin / shop_admin / viewer
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [shopName, setShopName] = useState('Đang tải...');
  const [currentUser, setCurrentUser] = useState(null);
  const [updateStatus, setUpdateStatus] = useState(null);
  const [appVersion, setAppVersion] = useState(() => {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.getManifest) {
        return chrome.runtime.getManifest()?.version || '1.0.1';
      }
    } catch (_) {}
    return '1.0.1';
  });

  const isConfigAllowed = uiRole !== 'viewer';

  const [globalSearch, setGlobalSearch] = useState(() => {
    return (typeof window !== 'undefined' && window.__af_global_search) || '';
  });

  const handleGlobalSearch = useCallback((query, shouldNavigate = false) => {
    setGlobalSearch(query);
    if (typeof window !== 'undefined') {
      window.__af_global_search = query;
      window.dispatchEvent(new CustomEvent('options:search', { detail: { search: query } }));
    }
    if (shouldNavigate) {
      if (!['submitted-orders', 'orders', 'customers', 'drafts', 'draft-queue'].includes(activeTab)) {
        setActiveTab('submitted-orders');
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('options:navigate', { detail: { search: query } }));
      }
    }
  }, [activeTab]);

  const handleNavigateWithSearch = useCallback((tab, options = {}) => {
    const query = options?.search !== undefined ? options.search : globalSearch;
    if (options?.search !== undefined) {
      setGlobalSearch(options.search);
      if (typeof window !== 'undefined') {
        window.__af_global_search = options.search;
        window.dispatchEvent(new CustomEvent('options:search', { detail: { search: options.search } }));
      }
    }
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('options:navigate', { detail: { search: query, orderId: options?.orderId } }));
    }
  }, [globalSearch]);

  const isInitializingAuth = useRef(false);

  const initAuth = useCallback(async () => {
    if (isInitializingAuth.current) return;
    isInitializingAuth.current = true;
    try {
      const isAuth = await AuthService.isAuthenticated();
      setIsAuthenticated(isAuth);

      if (isAuth) {
        // Kiểm tra quyền thiết bị từ Cloud ngay khi khởi tạo
        if (globalThis.SupabaseCloud && typeof globalThis.SupabaseCloud.checkDeviceRevoked === 'function') {
          const devRevokedCheck = await globalThis.SupabaseCloud.checkDeviceRevoked().catch(() => null);
          if (devRevokedCheck && devRevokedCheck.ok && devRevokedCheck.revoked) {
            console.warn('[Options initAuth] Thiết bị đã bị thu hồi quyền truy cập. Đăng xuất ngay.');
            if (typeof AuthService !== 'undefined' && typeof AuthService.logout === 'function') {
              await AuthService.logout().catch(() => {});
            } else if (typeof AuthSession !== 'undefined' && typeof AuthSession.clearSession === 'function') {
              await AuthSession.clearSession().catch(() => {});
            }
            setIsAuthenticated(false);
            setUserRole('VIEWER');
            setUiRole('viewer');
            setCurrentUser(null);
            return;
          }
        }

        try {
          const configRes = await globalThis.SupabaseCloud.loadConfig();
          if (globalThis.ShopService && typeof globalThis.ShopService.syncShopsFromCloud === 'function') {
            await globalThis.ShopService.syncShopsFromCloud();
          }
          const sess = await AuthSession.getSession();
          const token = sess ? sess.access_token : configRes.anonKey;
          let resolvedUiRole = 'viewer';

          // Set user profile info
          setCurrentUser({
            id: sess?.user?.id || sess?.id || 'AF-USER',
            full_name: sess?.user?.user_metadata?.full_name || sess?.user?.full_name || sess?.full_name || 'Quản trị viên',
            email: sess?.user?.email || sess?.email || 'Chưa cập nhật email',
            avatar_url: sess?.user?.user_metadata?.avatar_url || sess?.avatar_url || '',
            role: sess?.role || 'SYSTEM_ADMIN'
          });

          if (sess && sess.active_shop_id && configRes?.url) {
            try {
              const res = await fetch(`${configRes.url.replace(/\/$/, '')}/rest/v1/shops?select=name&id=eq.${encodeURIComponent(sess.active_shop_id)}`, {
                headers: {
                  'apikey': configRes.anonKey,
                  'Authorization': `Bearer ${token}`
                },
                signal: AbortSignal.timeout ? AbortSignal.timeout(6000) : undefined
              }).catch(() => null);
              if (res && res.ok) {
                const data = await res.json().catch(() => null);
                if (data && data.length > 0 && data[0].name) {
                  setShopName(data[0].name);
                  if (sess.shop_name !== data[0].name) {
                    sess.shop_name = data[0].name;
                    await AuthSession.saveSession(sess);
                  }
                } else {
                  setShopName(sess.shop_name || 'Cửa hàng của tôi');
                }
              } else {
                setShopName(sess?.shop_name || 'Cửa hàng của tôi');
              }
            } catch {
              setShopName(sess?.shop_name || 'Cửa hàng của tôi');
            }
          } else {
            setShopName(sess?.shop_name || 'Cửa hàng của tôi');
          }

          // RBAC thật: resolve_dashboard_role (2 tầng global + shop)
          if (token && !token.startsWith('local_dev_token_') && configRes?.url) {
            try {
              const rpcRes = await fetch(`${configRes.url.replace(/\/$/, '')}/rest/v1/rpc/resolve_dashboard_role`, {
                method: 'POST',
                headers: {
                  'apikey': configRes.anonKey,
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({}),
                signal: AbortSignal.timeout ? AbortSignal.timeout(6000) : undefined
              }).catch(err => {
                // Network error, offline hoặc URL unreachable
                console.debug?.('resolve_dashboard_role fetch failed:', err?.message || err);
                return null;
              });

              if (rpcRes && rpcRes.ok) {
                const roleData = await rpcRes.json().catch(() => null);
                if (roleData && roleData.length > 0 && roleData[0].ui_role) {
                  setUserRole(roleData[0].real_role || 'VIEWER');
                  resolvedUiRole = roleData[0].ui_role;
                  setUiRole(resolvedUiRole);
                }
              }
            } catch (e) {
              console.debug?.('resolve_dashboard_role error:', e?.message || e);
            }
          }

          // Fallback: role đã lưu trong session lúc login
          if (resolvedUiRole === 'viewer' && sess && sess.role) {
            const r = sess.role;
            if (r === 'SYSTEM_ADMIN') {
              setUserRole('SYSTEM_ADMIN');
              setUiRole('master_admin');
            } else if (['OWNER', 'MANAGER', 'SHOP_OWNER', 'SHOP_MANAGER'].includes(r)) {
              setUserRole(r);
              setUiRole('shop_admin');
            }
          }
          if (globalThis.SupabaseCloud && typeof globalThis.SupabaseCloud.syncDeviceRecord === 'function') {
            globalThis.SupabaseCloud.syncDeviceRecord().catch(() => {});
          }
        } catch (e) {
          setShopName('Cửa hàng của tôi');
        }
      } else {
        setUserRole('VIEWER');
        setUiRole('viewer');
        setShopName('Cửa hàng của tôi');
        setCurrentUser(null);
      }
    } catch (e) {
      console.warn('initAuth error:', e);
      setIsAuthenticated(false);
      setCurrentUser(null);
    } finally {
      isInitializingAuth.current = false;
      setIsAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    initAuth();

    // Lắng nghe sự kiện AuthEvents
    const onAuthChanged = (data) => {
      if (data && data.isAuthenticated) {
        initAuth();
      } else {
        setIsAuthenticated(false);
        setUserRole('VIEWER');
        setUiRole('viewer');
        setShopName('Cửa hàng của tôi');
        setCurrentUser(null);
      }
    };

    if (typeof globalThis.AuthEvents !== 'undefined' && typeof globalThis.AuthEvents.on === 'function') {
      globalThis.AuthEvents.on('AUTH_STATE_CHANGED', onAuthChanged);
    }

    // Tự động đồng bộ khi chuyển tab hoặc focus cửa sổ
    const handleWindowFocus = () => {
      if (globalThis.ShopService && typeof globalThis.ShopService.syncShopsFromCloud === 'function') {
        globalThis.ShopService.syncShopsFromCloud(true).then(() => initAuth());
      } else {
        initAuth();
      }
    };
    window.addEventListener('focus', handleWindowFocus);

    // Thiết lập Supabase Realtime Channel cho Extension Options
    let realtimeChannel = null;
    let isCancelled = false;
    (async () => {
      try {
        const client = typeof SupabaseCloud !== 'undefined' && typeof SupabaseCloud.getSupabaseClient === 'function'
          ? await SupabaseCloud.getSupabaseClient()
          : (typeof window !== 'undefined' && window.supabaseClient) || null;

        if (client && !isCancelled) {
          realtimeChannel = client.channel('options-realtime-sync')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'shops' }, () => {
              if (globalThis.ShopService?.syncShopsFromCloud) {
                globalThis.ShopService.syncShopsFromCloud(true).then(() => initAuth());
              }
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'shop_members' }, () => {
              if (globalThis.ShopService?.syncShopsFromCloud) {
                globalThis.ShopService.syncShopsFromCloud(true).then(() => initAuth());
              }
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'extension_devices' }, () => {
              if (globalThis.SupabaseCloud?.checkDeviceRevoked) {
                globalThis.SupabaseCloud.checkDeviceRevoked().then(res => {
                  if (res && res.ok && res.revoked) {
                    console.warn('[Realtime] Thiết bị bị thu hồi từ Cloud. Đăng xuất ngay.');
                    initAuth();
                  }
                }).catch(() => {});
              }
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'submitted_orders' }, (payload) => {
              window.dispatchEvent(new CustomEvent('submitted-orders-updated', { detail: payload }));
              window.dispatchEvent(new CustomEvent('orders-updated', { detail: payload }));
              window.dispatchEvent(new CustomEvent('customer-hub-updated', { detail: payload }));
              if (typeof chrome !== 'undefined' && chrome.storage?.local) {
                chrome.storage.local.set({ last_submitted_order_sync: Date.now() }).catch(() => {});
              }
              if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
                chrome.runtime.sendMessage({ type: 'cloud_sync_update', table: 'submitted_orders', payload }).catch(() => {});
              }
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
              window.dispatchEvent(new CustomEvent('draft-queue-updated', { detail: payload }));
              window.dispatchEvent(new CustomEvent('orders-updated', { detail: payload }));
              window.dispatchEvent(new CustomEvent('customer-hub-updated', { detail: payload }));
              if (typeof chrome !== 'undefined' && chrome.storage?.local) {
                chrome.storage.local.set({ draft_queue_updated_at: Date.now(), last_cloud_order_sync: Date.now() }).catch(() => {});
              }
              if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
                chrome.runtime.sendMessage({ type: 'cloud_sync_update', table: 'orders', payload }).catch(() => {});
              }
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, (payload) => {
              window.dispatchEvent(new CustomEvent('customer-hub-updated', { detail: payload }));
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_order_links' }, (payload) => {
              window.dispatchEvent(new CustomEvent('customer-hub-updated', { detail: payload }));
              window.dispatchEvent(new CustomEvent('submitted-orders-updated', { detail: payload }));
            })
            .subscribe();

          if (isCancelled && realtimeChannel) {
            try { client.removeChannel(realtimeChannel); } catch (_) { realtimeChannel.unsubscribe?.(); }
          }
        }
      } catch (err) {
        console.warn('[OptionsRealtime] Realtime subscription fallback:', err);
      }
    })();

    // Lắng nghe thay đổi storage từ chrome.storage.onChanged
    const handleStorageChange = (changes, namespace) => {
      if (namespace === 'local') {
        if (changes.vnpost_session) {
          const oldSess = changes.vnpost_session.oldValue;
          const newSess = changes.vnpost_session.newValue;
          if (!oldSess !== !newSess || oldSess?.access_token !== newSess?.access_token || oldSess?.user?.id !== newSess?.user?.id) {
            initAuth();
          }
        }
        if (changes.activeShopName?.newValue) {
          setShopName(changes.activeShopName.newValue);
        }
        if (changes.app_update_status) {
          setUpdateStatus(changes.app_update_status.newValue);
        }
      }
    };

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener(handleStorageChange);
    }

    // Đọc trạng thái update từ storage khi khởi tạo
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['app_update_status'], res => {
        if (res?.app_update_status) setUpdateStatus(res.app_update_status);
      });
    }

    // Yêu cầu Service Worker kiểm tra phiên bản mới từ Supabase
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ action: 'checkAppUpdate' }, res => {
        const lastErr = chrome.runtime.lastError;
        if (lastErr) return;
        if (res?.ok && res?.status) setUpdateStatus(res.status);
      });
    }

    const handleRuntimeMessage = (msg) => {
      if (msg && (msg.action === 'deviceRevoked' || msg.type === 'deviceRevoked')) {
        console.warn('[Options] Nhận tín hiệu thu hồi thiết bị từ Service Worker. Đăng xuất.');
        initAuth();
      }
      if (msg && msg.type === 'app_update_changed' && msg.status) {
        setUpdateStatus(msg.status);
      }
    };
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener(handleRuntimeMessage);
    }

    return () => {
      isCancelled = true;
      window.removeEventListener('focus', handleWindowFocus);
      if (realtimeChannel) {
        try {
          const client = (typeof window !== 'undefined' && window.supabaseClient)
            || (typeof globalThis !== 'undefined' && globalThis.supabaseClient);
          if (client?.removeChannel) {
            client.removeChannel(realtimeChannel);
          } else {
            realtimeChannel.unsubscribe?.();
          }
        } catch (_) {}
      }
      if (typeof globalThis.AuthEvents !== 'undefined' && typeof globalThis.AuthEvents.off === 'function') {
        globalThis.AuthEvents.off('AUTH_STATE_CHANGED', onAuthChanged);
      }
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
        chrome.storage.onChanged.removeListener(handleStorageChange);
      }
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.removeListener(handleRuntimeMessage);
      }
    };
  }, [initAuth]);

  // Phương Án 1: Phát hiện diện máy trạm (Presence) qua WebSocket Realtime
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    let currentShopId = null;
    let currentDevId = null;

    const startTracking = async () => {
      try {
        const sess = await AuthSession.getSession();
        if (cancelled || !sess?.active_shop_id) return;
        currentShopId = sess.active_shop_id;

        const devInfo = typeof SupabaseCloud !== 'undefined' && typeof SupabaseCloud.getDeviceInfo === 'function'
          ? await SupabaseCloud.getDeviceInfo()
          : null;
        let deviceId = devInfo?.device_id;
        if (!deviceId && typeof chrome !== 'undefined' && chrome.storage?.local) {
          const stored = await chrome.storage.local.get(['vnpost_device_id']).catch(() => ({}));
          deviceId = stored?.vnpost_device_id;
        }
        if (!deviceId) {
          deviceId = `dev-${Math.random().toString(36).slice(2, 10)}`;
        }
        currentDevId = deviceId;

        await RealtimeService.trackWorkstationPresence(currentShopId, {
          device_id: deviceId,
          device_name: devInfo?.device_name || 'Máy trạm Extension Options',
          staff_name: sess.user?.user_metadata?.full_name || sess.user?.full_name || sess.full_name || 'Nhân viên',
          user_id: sess.user?.id || sess.id || null,
          client_type: 'EXTENSION',
          surface: 'OPTIONS_PAGE'
        });
      } catch (err) {
        console.warn('[OptionsPresence] Lỗi phát hiện diện:', err);
      }
    };

    startTracking();

    const handleBeforeUnload = () => {
      if (currentShopId && currentDevId) {
        RealtimeService.untrackWorkstationPresence(currentShopId, currentDevId).catch(() => {});
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      cancelled = true;
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (currentShopId && currentDevId) {
        RealtimeService.untrackWorkstationPresence(currentShopId, currentDevId).catch(() => {});
      }
    };
  }, [isAuthenticated]);

  useEffect(() => {
    const navigate = event => {
      const tab = event?.detail?.tab;
      if (tab && Object.prototype.hasOwnProperty.call(TAB_TITLES, tab)) setActiveTab(tab);
    };
    window.addEventListener('options:navigate', navigate);
    return () => window.removeEventListener('options:navigate', navigate);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    const match = window.location.hash.match(/(?:^#\/join\?token=|[?&]token=)([a-f0-9]+)/i);
    if (!match) return;
    let cancelled = false;
    (async () => {
      try {
        const config = await globalThis.SupabaseCloud.loadConfig();
        const session = await AuthSession.getSession();
        const response = await fetch(`${config.url}/rest/v1/rpc/accept_shop_invite`, {
          method: 'POST',
          headers: { apikey: config.anonKey, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ p_token: match[1] })
        });
        const data = await response.json().catch(() => null);
        if (!response.ok || data?.success === false) throw new Error(data?.message || 'Không thể tham gia cửa hàng.');
        if (cancelled) return;
        session.active_shop_id = data.shop_id;
        await AuthSession.saveSession(session);
        window.history.replaceState(null, '', `${window.location.pathname}?tab=overview`);
        setActiveTab('overview');
        await initAuth();
        alert('Đã tham gia cửa hàng thành công.');
      } catch (error) {
        if (!cancelled) alert(error.message);
      }
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated, initAuth]);

  if (isAuthLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)', color: 'var(--text-main)', gap: '14px' }}>
        <div style={{ width: '38px', height: '38px', borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', animation: 'spin 0.8s linear infinite' }}></div>
        <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-muted)' }}>Đang tải dữ liệu cửa hàng...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onLoginSuccess={() => initAuth()} />;
  }

  const renderContent = () => {
    if (!isConfigAllowed && ['team', 'permission-matrix', 'ai-settings', 'carriers', 'shop-profile', 'order-settings', 'sync', 'notifications', 'security', 'audit', 'subscription', 'devices', 'database', 'address', 'server'].includes(activeTab)) {
      return (
        <div className="card" style={{ textAlign: 'center', padding: '60px', color: 'var(--danger)' }}>
          <h2>Truy Cập Bị Từ Chối (Access Denied)</h2>
          <p>Bạn không có quyền xem trang này. Cần quyền Chủ cửa hàng (OWNER) hoặc Quản lý (MANAGER).</p>
        </div>
      );
    }

    switch (activeTab) {
      case 'overview':
        return <Overview setActiveTab={setActiveTab} uiRole={uiRole} />;
      case 'customers':
        return <CustomerHub />;
      case 'address':
        return <AddressEngine />;
      case 'team':
        return <Team />;
      case 'permission-matrix':
        return <PermissionMatrix />;
      case 'devices':
        return <DeviceManagement />;
      case 'ai-settings':
        return <AISettings />;
      case 'database':
        return <DatabaseManager />;
      case 'orders':
      case 'submitted-orders':
        return <SubmittedOrders />;
      case 'print-center':
        return <PrintCenter />;
      case 'social-inbox':
        return <SocialInbox />;
      case 'drafts':
      case 'draft-queue':
        return <OrderList />;
      case 'server':
        if (uiRole !== 'master_admin' && userRole !== 'SYSTEM_ADMIN') {
          return (
            <div className="card" style={{ textAlign: 'center', padding: '60px', color: 'var(--danger)' }}>
              <h2>Truy Cập Bị Từ Chối (Admin Only)</h2>
              <p>Cấu hình máy chủ Supabase Cloud chỉ dành cho Quản trị viên hệ thống (Master Admin / SYSTEM_ADMIN).</p>
            </div>
          );
        }
        return <ServerSettings />;
      case 'carriers':
        return <Carriers />;
      case 'shop-profile':
        return <ShopProfile />;
      case 'order-settings':
        return <OrderSettings />;
      case 'sync':
        return <SyncSettings />;
      case 'notifications':
        return <Notifications />;
      case 'security':
        return <Security />;
      case 'audit':
        return <AuditLogs />;
      case 'subscription':
        return <Subscription />;
      case 'support':
        return <SupportCenter />;
      case 'partner':
        return <PartnerConsole />;
      default:
        return <ComingSoon title="Chức Năng" />;
    }
  };

  const handleLogout = async () => {
    await AuthService.logout();
    setIsAuthenticated(false);
    setCurrentUser(null);
  };

  const handleOpenAdminDashboard = () => {
    window.open(getAdminDashboardUrl());
  };

  return (
    <div className={`options-layout ${mobileMenuOpen ? 'mobile-menu-active' : ''}`}>
      {/* MOBILE BACKDROP OVERLAY */}
      {mobileMenuOpen && (
        <div
          className="mobile-sidebar-overlay"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* SIDEBAR */}
      <aside className={`sidebar ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="nav-brand">
          <div className="nav-brand-badge">AF</div>
          <div className="nav-brand-info">
            <span className="nav-brand-title">Quản Lý Cửa Hàng</span>
            <span className="nav-brand-version-badge" title={`Phiên bản Auto Fill Order: v${appVersion}`}>v{appVersion}</span>
          </div>
        </div>

        <nav className="nav-menu">
          <button className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>Tổng quan</button>

          <div className="nav-section-title">Khách hàng & Vận hành</div>
          <button className={`nav-item ${activeTab === 'customers' ? 'active' : ''}`} onClick={() => setActiveTab('customers')}>Sổ bạ Khách hàng (CRM)</button>
          <button className={`nav-item ${activeTab === 'submitted-orders' || activeTab === 'orders' ? 'active' : ''}`} onClick={() => setActiveTab('submitted-orders')}>Đơn hàng đã gửi</button>
          <button className={`nav-item ${activeTab === 'print-center' ? 'active' : ''}`} onClick={() => setActiveTab('print-center')}>In nhãn hàng loạt</button>
          <button className={`nav-item ${activeTab === 'social-inbox' ? 'active' : ''}`} onClick={() => setActiveTab('social-inbox')}>Hộp thư đa kênh (Social)</button>
          <button className={`nav-item ${activeTab === 'drafts' || activeTab === 'draft-queue' ? 'active' : ''}`} onClick={() => setActiveTab('drafts')}>Hàng đợi đơn nháp</button>

          {isConfigAllowed && (
            <>
              <div className="nav-section-title">Cấu hình cửa hàng</div>
              <button className={`nav-item ${activeTab === 'shop-profile' ? 'active' : ''}`} onClick={() => setActiveTab('shop-profile')}>Hồ sơ cửa hàng</button>
              <button className={`nav-item ${activeTab === 'team' ? 'active' : ''}`} onClick={() => setActiveTab('team')}>Nhân viên & Đội ngũ</button>
              <button className={`nav-item ${activeTab === 'permission-matrix' ? 'active' : ''}`} onClick={() => setActiveTab('permission-matrix')}>Ma trận phân quyền</button>
              <button className={`nav-item ${activeTab === 'ai-settings' ? 'active' : ''}`} onClick={() => setActiveTab('ai-settings')}>Cấu hình AI bóc tách</button>
              <button className={`nav-item ${activeTab === 'address' ? 'active' : ''}`} onClick={() => setActiveTab('address')}>Từ điển địa chỉ</button>
              <button className={`nav-item ${activeTab === 'carriers' ? 'active' : ''}`} onClick={() => setActiveTab('carriers')}>Hãng vận chuyển</button>
              <button className={`nav-item ${activeTab === 'devices' ? 'active' : ''}`} onClick={() => setActiveTab('devices')}>Quản lý thiết bị</button>
              <button className={`nav-item ${activeTab === 'order-settings' ? 'active' : ''}`} onClick={() => setActiveTab('order-settings')}>Cài đặt mặc định đơn</button>
              <button className={`nav-item ${activeTab === 'sync' ? 'active' : ''}`} onClick={() => setActiveTab('sync')}>Đồng bộ dữ liệu</button>
              <button className={`nav-item ${activeTab === 'notifications' ? 'active' : ''}`} onClick={() => setActiveTab('notifications')}>Thông báo hệ thống</button>
              <button className={`nav-item ${activeTab === 'security' ? 'active' : ''}`} onClick={() => setActiveTab('security')}>Bảo mật tài khoản</button>
              <button className={`nav-item ${activeTab === 'audit' ? 'active' : ''}`} onClick={() => setActiveTab('audit')}>Nhật ký hoạt động</button>
              <button className={`nav-item ${activeTab === 'subscription' ? 'active' : ''}`} onClick={() => setActiveTab('subscription')}>Gói cước & Bản quyền</button>
              <button className={`nav-item ${activeTab === 'support' ? 'active' : ''}`} onClick={() => setActiveTab('support')}>Hỗ trợ & Báo lỗi (Tickets)</button>
              <button className={`nav-item ${activeTab === 'partner' ? 'active' : ''}`} onClick={() => setActiveTab('partner')}>Partner API & MCP</button>
              <button className={`nav-item ${activeTab === 'database' ? 'active' : ''}`} onClick={() => setActiveTab('database')}>Bộ nhớ lưu trữ</button>
              {(uiRole === 'master_admin' || userRole === 'SYSTEM_ADMIN') && (
                <button className={`nav-item ${activeTab === 'server' ? 'active' : ''}`} onClick={() => setActiveTab('server')}>
                  Kết nối máy chủ (Server Connection) <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '4px', background: 'var(--color-warning-bg)', color: 'var(--color-warning-text)', marginLeft: '4px' }}>Admin</span>
                </button>
              )}
            </>
          )}
        </nav>

        {/* SIDEBAR FOOTER (USER PROFILE CARD) */}
        <div className="sidebar-footer">
          <UserProfileCard
            currentUser={currentUser}
            userRole={userRole}
            uiRole={uiRole}
            appVersion={appVersion}
            onOpenAdmin={handleOpenAdminDashboard}
            onLogout={handleLogout}
          />
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="main-wrapper">
        {/* TOPBAR */}
        <TopHeader
          currentUser={currentUser}
          userRole={userRole}
          uiRole={uiRole}
          shopName={shopName}
          appVersion={appVersion}
          isDbConnected={isAuthenticated}
          activeTab={activeTab}
          globalSearch={globalSearch}
          onOpenAdmin={handleOpenAdminDashboard}
          onSearch={handleGlobalSearch}
          onNavigate={handleNavigateWithSearch}
          onLogout={handleLogout}
          onToggleMobileMenu={() => setMobileMenuOpen(prev => !prev)}
        />

        {/* CONTENT */}
        <main className="main-content">
          <div className="content-container">
            {/* UPDATE ALERT BANNER */}
            {updateStatus?.hasUpdate && (
              <div style={{
                background: updateStatus.isBlocked ? '#fef2f2' : '#eff6ff',
                border: `1px solid ${updateStatus.isBlocked ? '#f87171' : '#bfdbfe'}`,
                borderRadius: '10px',
                padding: '14px 18px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '20px' }}>{updateStatus.isBlocked ? '⚠️' : '🎉'}</span>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '13.5px', color: updateStatus.isBlocked ? '#991b1b' : '#1e40af' }}>
                      {updateStatus.isBlocked ? 'YÊU CẦU NÂNG CẤP PHIÊN BẢN (BẮT BUỘC):' : 'ĐÃ CÓ PHIÊN BẢN CẬP NHẬT MỚI:'}
                    </div>
                    <div style={{ fontSize: '12.5px', marginTop: '2px', color: updateStatus.isBlocked ? '#b91c1c' : '#1d4ed8' }}>
                      Đã có phiên bản <strong>v{updateStatus.latestVersion}</strong> (phiên bản đang dùng: v{updateStatus.currentVersion}).
                      {updateStatus.releaseNotes && <span> — {updateStatus.releaseNotes}</span>}
                    </div>
                  </div>
                </div>
                {updateStatus.downloadUrl && (
                  <a
                    href={updateStatus.downloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      background: updateStatus.isBlocked ? '#dc2626' : '#2563eb',
                      color: '#ffffff',
                      textDecoration: 'none',
                      padding: '8px 16px',
                      borderRadius: '6px',
                      fontWeight: 700,
                      fontSize: '12.5px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: updateStatus.isBlocked ? '0 2px 4px rgba(220,38,38,0.3)' : '0 2px 4px rgba(37,99,235,0.25)'
                    }}
                  >
                    🚀 Tải Bản Cập Nhật v{updateStatus.latestVersion}
                  </a>
                )}
              </div>
            )}
            <React.Suspense fallback={
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', color: 'var(--text-muted)', gap: '12px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', animation: 'spin 0.8s linear infinite' }}></div>
                <div style={{ fontSize: '13px', fontWeight: 500 }}>Đang tải giao diện...</div>
              </div>
            }>
              {renderContent()}
            </React.Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}
