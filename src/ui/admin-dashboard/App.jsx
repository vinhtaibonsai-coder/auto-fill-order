import React, { useEffect, useState } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import FastOperationsHub from './components/FastOperationsHub';
import ImpersonationBanner from './components/ImpersonationBanner';
import CreateShopModal from './modals/CreateShopModal';
import TopupQuotaModal from './modals/TopupQuotaModal';
import PublishReleaseModal from './modals/PublishReleaseModal';
import InviteAdminModal from './modals/InviteAdminModal';
import Overview from './pages/Overview/Overview';
const ShopList = React.lazy(() => import('./pages/Shops/ShopList'));
const Quotas = React.lazy(() => import('./pages/AIPlatform/Quotas'));
const Users = React.lazy(() => import('./pages/Users/Users'));
const SystemHealth = React.lazy(() => import('./pages/SystemHealth/SystemHealth'));
const Subscriptions = React.lazy(() => import('./pages/Subscriptions/Subscriptions'));
const FeatureFlags = React.lazy(() => import('./pages/Features/FeatureFlags'));
const AddressDataset = React.lazy(() => import('./pages/Address/AddressDataset'));
const CarrierHealth = React.lazy(() => import('./pages/Carriers/CarrierHealth'));
const DeviceManagement = React.lazy(() => import('./pages/Devices/DeviceManagement'));
const SecurityRLS = React.lazy(() => import('./pages/Security/SecurityRLS'));
const SupportTickets = React.lazy(() => import('./pages/Support/SupportTickets'));
const ReleaseCenter = React.lazy(() => import('./pages/Releases/ReleaseCenter'));
const GlobalOrders = React.lazy(() => import('./pages/GlobalOrders/GlobalOrders'));
const LicenseKeys = React.lazy(() => import('./pages/LicenseKeys/LicenseKeys'));
const RetentionCenter = React.lazy(() => import('./pages/Retention/RetentionCenter'));
const DataQuality = React.lazy(() => import('./pages/DataQuality/DataQuality'));
const ResellerPortal = React.lazy(() => import('./pages/Resellers/ResellerPortal'));
import AdminLogin from './pages/Login/AdminLogin';
import { AuthService } from '../../domain/auth/auth.service.esm.js';
import { AdminService } from '../../domain/admin/admin.service.js';

const PAGES = {
  overview: Overview, shops: ShopList, 'global-orders': GlobalOrders, 'license-keys': LicenseKeys,
  users: Users, subscriptions: Subscriptions, retention: RetentionCenter, resellers: ResellerPortal,
  'ai-platform': Quotas, features: FeatureFlags, address: AddressDataset,
  carriers: CarrierHealth, devices: DeviceManagement, security: SecurityRLS,
  'system-health': SystemHealth, support: SupportTickets, releases: ReleaseCenter,
  'data-quality': DataQuality
};

const ADMIN_ONLY_TABS = ['license-keys', 'users', 'subscriptions', 'retention', 'resellers', 'security', 'releases', 'data-quality'];

export default function App() {
  const [activeTab, setActiveTabState] = useState(() => new URLSearchParams(window.location.search).get('tab') || 'overview');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState('SYSTEM_ADMIN'); // 'SYSTEM_ADMIN' | 'SUPPORT_STAFF'
  const [authLoading, setAuthLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [shops, setShops] = useState([]);
  const [searchQuery, setSearchQuery] = useState(() => new URLSearchParams(window.location.search).get('q') || '');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [impersonation, setImpersonation] = useState(() => { try { return JSON.parse(sessionStorage.getItem('afo_admin_impersonation') || 'null'); } catch (_) { return null; } });
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const setActiveTab = tab => {
    let target = tab;
    if (userRole === 'SUPPORT_STAFF' && ADMIN_ONLY_TABS.includes(target)) {
      target = 'overview';
    }
    setActiveTabState(PAGES[target] ? target : 'overview');
    setMobileSidebarOpen(false);
    const url = new URL(window.location.href); url.searchParams.set('tab', target); window.history.replaceState(null, '', url);
  };

  useEffect(() => {
    (async () => {
      try {
        if (await AuthService.isAuthenticated()) {
          const role = await AuthService.getUserRole();
          const isAdmin = ['ADMIN', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'SUPPORT_ADMIN', 'FINANCE_ADMIN', 'CONTENT_ADMIN', 'SUPPORT_STAFF', 'STAFF'].includes(role) || (typeof role === 'string' && (role.endsWith('_ADMIN') || role.includes('ADMIN')));
          if (isAdmin) {
            setIsAuthenticated(true);
            setUserRole(role === 'SUPPORT_STAFF' || role === 'STAFF' ? 'SUPPORT_STAFF' : role);
            if (globalThis.SupabaseCloud && typeof globalThis.SupabaseCloud.syncDeviceRecord === 'function') {
              globalThis.SupabaseCloud.syncDeviceRecord().catch(() => {});
            }
          } else {
            await AuthService.logout();
          }
        }
      } catch (error) { console.error('Auth Check Error:', error); }
      finally { setAuthLoading(false); }
    })();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    
    const refreshShops = () => {
      AdminService.getShopsList().then(result => result.success && setShops(result.data || []));
    };
    refreshShops();

    const listener = event => { 
      setImpersonation(event.detail); 
      sessionStorage.setItem('afo_admin_impersonation', JSON.stringify(event.detail)); 
    };
    const refreshListener = () => {
      refreshShops();
    };

    window.addEventListener('admin:impersonate', listener);
    window.addEventListener('admin:refresh_data', refreshListener);

    // Thiết lập Supabase Realtime Channel
    let realtimeChannel = null;
    let isCancelled = false;
    (async () => {
      try {
        const client = typeof SupabaseCloud !== 'undefined' && typeof SupabaseCloud.getSupabaseClient === 'function'
          ? await SupabaseCloud.getSupabaseClient()
          : (typeof window !== 'undefined' && window.supabaseClient) || null;

        if (client && !isCancelled) {
          realtimeChannel = client.channel('admin-dashboard-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'shops' }, () => {
              window.dispatchEvent(new CustomEvent('admin:refresh_data', { detail: { table: 'shops' } }));
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
              window.dispatchEvent(new CustomEvent('admin:refresh_data', { detail: { table: 'profiles' } }));
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'shop_members' }, () => {
              window.dispatchEvent(new CustomEvent('admin:refresh_data', { detail: { table: 'shop_members' } }));
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'shop_quotas' }, () => {
              window.dispatchEvent(new CustomEvent('admin:refresh_data', { detail: { table: 'shop_quotas' } }));
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'submitted_orders' }, () => {
              window.dispatchEvent(new CustomEvent('admin:refresh_data', { detail: { table: 'submitted_orders' } }));
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
              window.dispatchEvent(new CustomEvent('admin:refresh_data', { detail: { table: 'orders' } }));
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'subscriptions' }, () => window.dispatchEvent(new CustomEvent('admin:refresh_data', { detail: { table: 'subscriptions' } })))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_transactions' }, () => window.dispatchEvent(new CustomEvent('admin:refresh_data', { detail: { table: 'payment_transactions' } })))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, () => window.dispatchEvent(new CustomEvent('admin:refresh_data', { detail: { table: 'support_tickets' } })))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'license_keys' }, () => window.dispatchEvent(new CustomEvent('admin:refresh_data', { detail: { table: 'license_keys' } })))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'ai_usage_log' }, () => window.dispatchEvent(new CustomEvent('admin:refresh_data', { detail: { table: 'ai_usage_log' } })))
            .subscribe();

          if (isCancelled && realtimeChannel) {
            try { client.removeChannel(realtimeChannel); } catch (_) { realtimeChannel.unsubscribe?.(); }
          }
        }
      } catch (err) {
        console.warn('[AdminRealtime] Realtime subscription fallback to polling/events:', err);
      }
    })();

    return () => {
      isCancelled = true;
      window.removeEventListener('admin:impersonate', listener);
      window.removeEventListener('admin:refresh_data', refreshListener);
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
    };
  }, [isAuthenticated]);

  if (authLoading) return <div style={{ display: 'grid', placeItems: 'center', height: '100vh', color: '#64748b', fontWeight: 600 }}>Đang kiểm tra phiên làm việc…</div>;
  if (!isAuthenticated) return <AdminLogin onLoginSuccess={() => setIsAuthenticated(true)} />;

  const logout = async () => { if (window.confirm('Bạn có chắc chắn muốn đăng xuất khỏi Admin Portal?')) { await AuthService.logout(); setIsAuthenticated(false); } };
  const runAction = async (operation, message) => {
    const result = await operation();
    if (!result.success) {
      window.alert(result.error || 'Thao tác thất bại.');
      return result;
    }
    window.alert(message);
    setModal(null);
    AdminService.getShopsList().then(r => r.success && setShops(r.data || []));
    window.dispatchEvent(new CustomEvent('admin:refresh_data', { detail: { action: 'completed' } }));
    return result;
  };
  const Page = PAGES[activeTab] || Overview;
  const handleSearch = async value => {
    const query = value.trim();
    setSearchQuery(query);
    const url = new URL(window.location.href);
    if (query) url.searchParams.set('q', query); else url.searchParams.delete('q');
    window.history.replaceState(null, '', url);
    if (query.length < 2) { setSearchResults([]); return; }
    setSearchLoading(true);
    const result = await AdminService.globalSearch(query, 12);
    if (query === value.trim()) setSearchResults(result.success ? result.data || [] : []);
    setSearchLoading(false);
  };
  const openSearchResult = item => {
    setActiveTab(item.target || 'overview');
    const url = new URL(window.location.href);
    url.searchParams.set('q', item.title || '');
    url.searchParams.set('focus', item.id);
    window.history.replaceState(null, '', url);
  };

  return <div className={`admin-layout ${mobileSidebarOpen ? 'mobile-sidebar-active' : ''}`}>
    {/* Mobile Overlay */}
    {mobileSidebarOpen && (
      <div
        className="admin-mobile-overlay"
        onClick={() => setMobileSidebarOpen(false)}
        aria-hidden="true"
      />
    )}
    <Sidebar
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      userRole={userRole}
      isOpen={mobileSidebarOpen}
      onClose={() => setMobileSidebarOpen(false)}
    />
    <main className="main-content">
      <Header
        onLogout={logout}
        userRole={userRole}
        onSearch={handleSearch}
        searchResults={searchResults}
        searchLoading={searchLoading}
        onSearchResult={openSearchResult}
        onToggleSidebar={() => setMobileSidebarOpen(prev => !prev)}
        operations={userRole === 'SUPPORT_STAFF' ? null : (
          <FastOperationsHub
            onCreateShop={() => setModal('shop')}
            onTopupQuota={() => setModal('quota')}
            onInviteAdmin={() => setModal('admin')}
            onPublishRelease={() => setModal('release')}
          />
        )}
      />
      <ImpersonationBanner session={impersonation} onExit={() => { setImpersonation(null); sessionStorage.removeItem('afo_admin_impersonation'); }} />
      <div className="page-container">
        {searchQuery && (
          <div role="search" style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 8, background: '#eff6ff', color: '#1e40af', fontSize: 13 }}>
            Đang lọc toàn hệ thống theo: <strong>{searchQuery}</strong>. Chọn mục Shop, Người dùng, Đơn hàng hoặc Hỗ trợ để xem kết quả tương ứng.
          </div>
        )}
        <React.Suspense fallback={<div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Đang tải giao diện quản trị...</div>}>
          <Page userRole={userRole} />
        </React.Suspense>
      </div>
    </main>
    <CreateShopModal open={modal === 'shop'} onClose={() => setModal(null)} onSubmit={form => runAction(() => AdminService.createShopWithAccount(form), 'Đã tạo Shop và tài khoản chủ Shop.')} />
    <TopupQuotaModal open={modal === 'quota'} shops={shops} onClose={() => setModal(null)} onSubmit={({ shopId, amount }) => runAction(() => AdminService.topupQuota(shopId, amount), `Đã cấp thêm ${amount} lượt AI.`)} />
    <PublishReleaseModal open={modal === 'release'} onClose={() => setModal(null)} onSubmit={data => runAction(() => AdminService.publishRelease(data), 'Đã phát hành phiên bản Extension.')} />
    <InviteAdminModal open={modal === 'admin'} onClose={() => setModal(null)} onSubmit={data => runAction(() => AdminService.createAdminAccount(data), 'Đã tạo tài khoản Admin.')} />
  </div>;
}
