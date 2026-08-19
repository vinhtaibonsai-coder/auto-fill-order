import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Overview from './pages/Overview/Overview';
import ShopList from './pages/Shops/ShopList';
import Quotas from './pages/AIPlatform/Quotas';
import Users from './pages/Users/Users';
import SystemHealth from './pages/SystemHealth/SystemHealth';
import Subscriptions from './pages/Subscriptions/Subscriptions';
import FeatureFlags from './pages/Features/FeatureFlags';
import AddressDataset from './pages/Address/AddressDataset';
import CarrierHealth from './pages/Carriers/CarrierHealth';
import DeviceManagement from './pages/Devices/DeviceManagement';
import SecurityRLS from './pages/Security/SecurityRLS';
import SupportTickets from './pages/Support/SupportTickets';
import ReleaseCenter from './pages/Releases/ReleaseCenter';

import AdminLogin from './pages/Login/AdminLogin';
import { AuthService } from '../../domain/auth/auth.service.esm.js';

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const isAuth = await AuthService.isAuthenticated();
        if (isAuth) {
          const role = await AuthService.getUserRole();
          if (['ADMIN', 'SUPER_ADMIN', 'SYSTEM_ADMIN'].includes(role)) {
            setIsAuthenticated(true);
          } else {
            await AuthService.logout();
          }
        }
      } catch (err) {
        console.error("Auth Check Error:", err);
      } finally {
        setAuthLoading(false);
      }
    };
    checkAuth();
  }, []);

  if (authLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f8fafc', flexDirection: 'column', gap: '16px' }}>
        <div style={{ 
          width: '40px', height: '40px', border: '3px solid #e2e8f0', 
          borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite' 
        }}></div>
        <div style={{ color: '#64748b', fontSize: '15px', fontWeight: 600 }}>Đang kiểm tra phiên làm việc...</div>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AdminLogin onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  const handleLogout = async () => {
    if (window.confirm("Bạn có chắc chắn muốn đăng xuất khỏi Admin Portal?")) {
      await AuthService.logout();
      setIsAuthenticated(false);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'overview': return <Overview />;
      case 'shops': return <ShopList />;
      case 'users': return <Users />;
      case 'subscriptions': return <Subscriptions />;
      case 'ai-platform': return <Quotas />;
      case 'features': return <FeatureFlags />;
      case 'address': return <AddressDataset />;
      case 'carriers': return <CarrierHealth />;
      case 'devices': return <DeviceManagement />;
      case 'security': return <SecurityRLS />;
      case 'system-health': return <SystemHealth />;
      case 'support': return <SupportTickets />;
      case 'releases': return <ReleaseCenter />;
      default: return <Overview />;
    }
  };

  return (
    <div className="admin-layout">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="main-content">
        <Header onLogout={handleLogout} />
        <div className="page-container">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}
