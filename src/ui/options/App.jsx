import React, { useState, useEffect } from 'react';
import { AuthSession } from '../../domain/auth/auth.session.js';
import Overview from './pages/Overview/Overview';
import OrderList from './pages/Workspace/OrderList';
import CustomerCRM from './pages/Workspace/CustomerCRM';
import History from './pages/Workspace/History';
import Bulk from './pages/Workspace/Bulk';

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
import { AuthService } from '../../domain/auth/auth.service.js';

const ComingSoon = ({ title }) => (
  <div className="card" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
    <h2 style={{ color: 'var(--text-main)' }}>{title}</h2>
    <p>This Shop settings module will be available soon.</p>
  </div>
);

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [userRole, setUserRole] = useState('OWNER'); // RBAC Mock State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [shopName, setShopName] = useState('Đang tải...');

  useEffect(() => {
    const initAuth = async () => {
      const isAuth = await AuthService.isAuthenticated();
      setIsAuthenticated(isAuth);
      
      if (isAuth) {
        try {
          const configRes = await globalThis.SupabaseCloud.loadConfig();
          const sess = await AuthSession.getSession();
          const token = sess ? sess.access_token : configRes.anonKey;
          
          if (sess && sess.active_shop_id) {
            const res = await fetch(`${configRes.url}/rest/v1/shops?select=name&id=eq.${sess.active_shop_id}`, {
              headers: {
                'apikey': configRes.anonKey,
                'Authorization': `Bearer ${token}`
              }
            });
            if (res.ok) {
              const data = await res.json();
              if (data && data.length > 0) setShopName(data[0].name);
              else setShopName('Cửa hàng của tôi');
            }
          } else {
             setShopName('Cửa hàng của tôi');
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
    if (userRole !== 'OWNER' && ['team', 'permission-matrix', 'ai-settings', 'carriers'].includes(activeTab)) {
      return (
        <div className="card" style={{ textAlign: 'center', padding: '60px', color: 'var(--danger)' }}>
          <h2>Access Denied</h2>
          <p>You do not have permission to view this page. Require Role: OWNER.</p>
        </div>
      );
    }

    switch (activeTab) {
      case 'overview':
        return <Overview />;
      case 'orders':
        return <OrderList />;
      case 'history':
        return <History />;
      case 'bulk':
        return <Bulk />;
      case 'customers':
        return <CustomerCRM />;
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
          
          <div className="nav-section-title">Workspace</div>
          <button className={`nav-item ${activeTab === 'orders' ? 'active' : ''}`} onClick={() => setActiveTab('orders')}>Quản lý Đơn hàng</button>
          <button className={`nav-item ${activeTab === 'bulk' ? 'active' : ''}`} onClick={() => setActiveTab('bulk')}>Tách hàng loạt</button>
          <button className={`nav-item ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>Lịch sử tách</button>
          <button className={`nav-item ${activeTab === 'customers' ? 'active' : ''}`} onClick={() => setActiveTab('customers')}>Khách hàng</button>
          
          <div className="nav-section-title">Config (SaaS)</div>
          {userRole === 'OWNER' && (
            <>
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
            <select 
              value={userRole} 
              onChange={(e) => {
                setUserRole(e.target.value);
                setActiveTab('overview');
              }}
              className="role-select"
              title="RBAC Testing Toggle"
            >
              <option value="OWNER">Role: Owner</option>
              <option value="STAFF">Role: Staff</option>
            </select>
            <div className="shop-badge">
              {shopName}
            </div>
            <button 
              onClick={() => {
                window.open(chrome.runtime.getURL('admin-dashboard/admin.html'));
              }}
              className="btn-admin"
            >
              Admin Dashboard
            </button>
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
