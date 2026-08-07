import React from 'react';

const MENU_ITEMS = [
  {
    group: 'Main',
    items: [
      { id: 'overview', label: 'Overview' },
    ]
  },
  {
    group: 'Management',
    items: [
      { id: 'shops', label: 'Shops' },
      { id: 'users', label: 'Users' },
      { id: 'subscriptions', label: 'Subscriptions' },
    ]
  },
  {
    group: 'Infrastructure',
    items: [
      { id: 'ai-platform', label: 'AI Platform' },
      { id: 'features', label: 'Features' },
      { id: 'address', label: 'Address' },
      { id: 'carriers', label: 'Carriers' },
      { id: 'devices', label: 'Devices' },
    ]
  },
  {
    group: 'System',
    items: [
      { id: 'security', label: 'Security' },
      { id: 'system-health', label: 'System Health' },
      { id: 'support', label: 'Support' },
      { id: 'system', label: 'System' },
    ]
  }
];

export default function Sidebar({ activeTab, setActiveTab }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        AFO Admin
      </div>
      {MENU_ITEMS.map((group, idx) => (
        <div key={idx} className="sidebar-group">
          <div className="sidebar-group-title">{group.group}</div>
          {group.items.map(item => (
            <div
              key={item.id}
              className={`sidebar-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              {item.label}
            </div>
          ))}
        </div>
      ))}
    </aside>
  );
}
