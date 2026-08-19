import React from 'react';

export default function PanelNavigation({ activeTab, setActiveTab }) {
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'create', label: 'Tạo đơn', icon: '⚡' },
    { id: 'review', label: 'Duyệt đơn', icon: '🔍' },
    { id: 'customer', label: 'Khách hàng', icon: '👤' },
    { id: 'sync', label: 'Sync & Cảnh báo', icon: '🔄' },
  ];

  return (
    <div style={{
      display: 'flex',
      gap: '4px',
      background: '#f1f5f9',
      padding: '4px',
      borderRadius: '8px',
      marginBottom: '12px',
      overflowX: 'auto'
    }}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            padding: '6px 8px',
            border: 'none',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: activeTab === tab.id ? 600 : 400,
            background: activeTab === tab.id ? '#ffffff' : 'transparent',
            color: activeTab === tab.id ? '#0f172a' : '#64748b',
            boxShadow: activeTab === tab.id ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
            cursor: 'pointer',
            whiteSpace: 'nowrap'
          }}
        >
          <span>{tab.icon}</span>
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
