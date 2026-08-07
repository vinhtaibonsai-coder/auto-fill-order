import React, { useState } from 'react';
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

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return <Overview />;
      case 'shops':
        return <ShopList />;
      case 'users':
        return <Users />;
      case 'subscriptions':
        return <Subscriptions />;
      case 'ai-platform':
        return <Quotas />;
      case 'features':
        return <FeatureFlags />;
      case 'address':
        return <AddressDataset />;
      case 'carriers':
        return <CarrierHealth />;
      case 'devices':
        return <DeviceManagement />;
      case 'security':
        return <SecurityRLS />;
      case 'system-health':
        return <SystemHealth />;
      case 'support':
        return <SupportTickets />;
      case 'system':
      case 'releases':
        return <ReleaseCenter />;
      default:
        return <Overview />;
    }
  };

  return (
    <div className="admin-layout">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="main-content">
        <Header />
        <div className="page-container">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}
