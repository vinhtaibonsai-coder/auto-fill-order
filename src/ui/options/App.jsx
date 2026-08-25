import React, { useState, useEffect } from 'react';
import { AuthSession } from '../../domain/auth/auth.session.esm.js';
import Overview from './pages/Overview/Overview';

import ShopProfile from './pages/General/ShopProfile';
import OrderSettings from './pages/General/OrderSettings';
import SyncSettings from './pages/Sync/SyncSettings';
import Notifications from './pages/Notifications/Notifications';
import Security from './pages/Security/Security';
import AuditLogs from './pages/Audit/AuditLogs';
import Subscription from './pages/Subscription/Subscription';

import AddressEngine from './pages/AddressEngine/AddressEngine';
import Team from './pages/Team/Team';
import PermissionMatrix from './pages/Team/PermissionMatrix';
import DeviceManagement from './pages/Security/DeviceManagement';
import AISettings from './pages/AISettings/AISettings';
import Carriers from './pages/Carriers/Carriers';
import Login from './pages/Auth/Login';
import DatabaseManager from './pages/Database/DatabaseManager';
import ServerSettings from './pages/Server/ServerSettings';
import SubmittedOrders from './pages/Orders/SubmittedOrders';
import { AuthService } from '../../domain/auth/auth.service.esm.js';

const ComingSoon = ({ title }) => (
  <div className="card" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
    <h2 style={{ color: 'var(--text-main)' }}>{title}</h2>
    <p>This Shop settings module will be available soon.</p>
  </div>
);

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [userRole, setUserRole] = useState('VIEWER'); // real_role từ resolve_dashboard_role
  const [uiRole, setUiRole] = useState('viewer'); // tier: master_admin / admin / shop_admin / viewer
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [shopName, setShopName] = useState('Đang tải...');

  const isConfigAllowed = uiRole !== 'viewer';

  useEffect(() => {
    const initAuth = async () => {
      const isAuth = await AuthService.isAuthenticated();
      setIsAuthenticated(isAuth);

      if (isAuth) {
        try {
          const configRes = await globalThis.SupabaseCloud.loadConfig();
          const sess = await AuthSession.getSession();
          const token = sess ? sess.access_token : configRes.anonKey;
          let resolvedUiRole = 'viewer';

          if (sess && sess.active_shop_id) {
            const res = await fetch(`${configRes.url}/rest/v1/shops?select=name&id=eq.${sess.active_shop_id}`, {
              headers: {
                'apikey': configRes.anonKey,
                'Authorization': `Bearer ${token}`
              }
            });
            if (res.ok) {
              const data = await res.json();
              if (data && data.length > 0) {
                setShopName(data[0].name);
                if (sess.shop_name !== data[0].name) {
                  sess.shop_name = data[0].name;
                  AuthSession.saveSession(sess);
                }
              }
              else setShopName('Cửa hàng của tôi');
            }
          } else {
            setShopName('Cửa hàng của tôi');
          }

          // RBAC thật: resolve_dashboard_role (2 tầng global + shop)
          if (token && !token.startsWith('local_dev_token_')) {
            try {
              const rpcRes = await fetch(`${configRes.url}/rest/v1/rpc/resolve_dashboard_role`, {
                method: 'POST',
                headers: {
                  'apikey': configRes.anonKey,
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({})
              });
              if (rpcRes.ok) {
                const roleData = await rpcRes.json();
                if (roleData && roleData.length > 0 && roleData[0].ui_role) {
                  setUserRole(roleData[0].real_role || 'VIEWER');
                  resolvedUiRole = roleData[0].ui_role;
                  setUiRole(resolvedUiRole);
                }
              }
            } catch (e) {
              console.warn('resolve_dashboard_role lỗi:', e);
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
        } catch (e) {
          setShopName('Cửa hàng của tôi');
        }
      }
      setIsAuthLoading(false);
    };
    initAuth();
  }, []);

  if (isAuthLoading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Đang tải...</div>;
  }

  if (!isAuthenticated) {
    return <Login onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  const renderContent = () => {
    if (!isConfigAllowed && ['team', 'permission-matrix', 'ai-settings', 'carriers', 'shop-profile', 'order-settings', 'sync', 'notifications', 'security', 'audit', 'subscription', 'devices', 'database', 'address', 'server'].includes(activeTab)) {
      return (
        <div className="card" style={{ textAlign: 'center', padding: '60px', color: 'var(--danger)' }}>
          <h2>Access Denied</h2>
          <p>You do not have permission to view this page. Cần quyền OWNER hoặc MANAGER.</p>
        </div>
      );
    }

    switch (activeTab) {
      case 'overview':
        return <Overview setActiveTab={setActiveTab} uiRole={uiRole} />;
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
      case 'submitted-orders':
        return <SubmittedOrders />;
      case 'server':
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
      default:
        return <ComingSoon title="Module" />;
    }
  };

  return (
    <div className="options-layout">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="nav-brand">
          <div style={{ background: 'var(--primary)', color: 'white', padding: '6px 10px', borderRadius: '8px', fontSize: '14px' }}>AF</div>
          <span style={{ fontSize: '16px', fontWeight: 800 }}>Shop Control</span>
        </div>

        <nav className="nav-menu">
          <button className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>Overview</button>

          {isConfigAllowed && (
            <>
              <div className="nav-section-title">Cấu hình cửa hàng</div>
              <button className={`nav-item ${activeTab === 'shop-profile' ? 'active' : ''}`} onClick={() => setActiveTab('shop-profile')}>Shop Profile</button>
              <button className={`nav-item ${activeTab === 'team' ? 'active' : ''}`} onClick={() => setActiveTab('team')}>Team & Roles</button>
              <button className={`nav-item ${activeTab === 'permission-matrix' ? 'active' : ''}`} onClick={() => setActiveTab('permission-matrix')}>Ma trận RBAC</button>
              <button className={`nav-item ${activeTab === 'ai-settings' ? 'active' : ''}`} onClick={() => setActiveTab('ai-settings')}>AI Platform</button>
              <button className={`nav-item ${activeTab === 'address' ? 'active' : ''}`} onClick={() => setActiveTab('address')}>Address Engine</button>
              <button className={`nav-item ${activeTab === 'carriers' ? 'active' : ''}`} onClick={() => setActiveTab('carriers')}>Carriers</button>
              <button className={`nav-item ${activeTab === 'devices' ? 'active' : ''}`} onClick={() => setActiveTab('devices')}>Quản lý Thiết bị</button>
              <button className={`nav-item ${activeTab === 'order-settings' ? 'active' : ''}`} onClick={() => setActiveTab('order-settings')}>Order Defaults</button>
              <button className={`nav-item ${activeTab === 'sync' ? 'active' : ''}`} onClick={() => setActiveTab('sync')}>Sync Center</button>
              <button className={`nav-item ${activeTab === 'notifications' ? 'active' : ''}`} onClick={() => setActiveTab('notifications')}>Notifications</button>
              <button className={`nav-item ${activeTab === 'security' ? 'active' : ''}`} onClick={() => setActiveTab('security')}>Security</button>
              <button className={`nav-item ${activeTab === 'audit' ? 'active' : ''}`} onClick={() => setActiveTab('audit')}>Audit Logs</button>
              <button className={`nav-item ${activeTab === 'subscription' ? 'active' : ''}`} onClick={() => setActiveTab('subscription')}>Subscription</button>
              <button className={`nav-item ${activeTab === 'database' ? 'active' : ''}`} onClick={() => setActiveTab('database')}>Local Storage</button>
              <button className={`nav-item ${activeTab === 'server' ? 'active' : ''}`} onClick={() => setActiveTab('server')}>Server Connection</button>
              <div className="nav-section-title">Tra cứu vận hành</div>
              <button className={`nav-item ${activeTab === 'submitted-orders' ? 'active' : ''}`} onClick={() => setActiveTab('submitted-orders')}>Đơn đã lên</button>
            </>
          )}
        </nav>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="main-wrapper">
        {/* TOPBAR */}
        <header className="topbar">
          <div className="topbar-left">
            <h1 className="page-title" style={{ margin: 0, fontSize: '20px' }}>
              {activeTab.charAt(0).toUpperCase() + activeTab.slice(1).replace('-', ' ')}
            </h1>
          </div>
          <div className="topbar-right">
            <span className="role-select" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '13px', fontWeight: 600 }}>
              Role: {userRole}
            </span>
            <div className="shop-badge">
              {shopName}
            </div>
            {uiRole === 'master_admin' && (
              <button
                onClick={() => {
                  window.open(chrome.runtime.getURL('admin-dashboard/admin.html'));
                }}
                className="btn-admin"
              >
                Admin Dashboard
              </button>
            )}
            <button
              onClick={async () => {
                await AuthService.logout();
                setIsAuthenticated(false);
              }}
              className="btn-logout"
            >
              Đăng xuất
            </button>
          </div>
        </header>

        {/* CONTENT */}
        <main className="main-content">
          <div className="content-container">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
}
