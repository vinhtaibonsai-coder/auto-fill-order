import React from 'react';
import {
  LayoutDashboard, Store, Users, CreditCard, Bot, Sliders,
  MapPin, Truck, Smartphone, ShieldCheck, Activity, Headphones, Rocket, Zap,
  PackageSearch, Key, ShieldAlert, HeartPulse, Handshake
} from 'lucide-react';

const MENU_ITEMS = [
  {
    group: 'Tổng quan',
    items: [
      { id: 'overview', label: 'Bảng tổng quan', icon: LayoutDashboard },
    ]
  },
  {
    group: 'Quản lý vận hành',
    items: [
      { id: 'shops', label: 'Cửa hàng & Chi nhánh', icon: Store },
      { id: 'global-orders', label: 'Tra cứu đơn hàng', icon: PackageSearch },
      { id: 'license-keys', label: 'Mã kích hoạt & Billing', icon: Key, adminOnly: true },
      { id: 'users', label: 'Người dùng & Nhân viên', icon: Users, adminOnly: true },
      { id: 'subscriptions', label: 'Gói cước & Thuê bao', icon: CreditCard, adminOnly: true },
      { id: 'retention', label: 'Giữ chân & Anti-Churn', icon: HeartPulse, adminOnly: true },
      { id: 'resellers', label: 'Đại lý & Reseller', icon: Handshake, adminOnly: true },
    ]
  },
  {
    group: 'Hạ tầng & Tính năng',
    items: [
      { id: 'ai-platform', label: 'Nền tảng AI Platform', icon: Bot },
      { id: 'features', label: 'Cấu hình & Tính năng', icon: Sliders },
      { id: 'address', label: 'Từ điển Địa chỉ', icon: MapPin },
      { id: 'carriers', label: 'Hãng vận chuyển', icon: Truck },
      { id: 'devices', label: 'Quản lý Thiết bị', icon: Smartphone },
    ]
  },
  {
    group: 'Hệ thống & Bảo mật',
    items: [
      { id: 'security', label: 'Bảo mật & RLS Logs', icon: ShieldCheck, adminOnly: true },
      { id: 'data-quality', label: 'Chất lượng Dữ liệu', icon: ShieldAlert, adminOnly: true },
      { id: 'system-health', label: 'Sức khỏe Hệ thống', icon: Activity },
      { id: 'support', label: 'Yêu cầu Hỗ trợ', icon: Headphones },
      { id: 'releases', label: 'Phiên bản Phát hành', icon: Rocket, adminOnly: true },
    ]
  }
];

export default function Sidebar({ activeTab, setActiveTab, userRole = 'SYSTEM_ADMIN' }) {
  const isSupportStaff = userRole === 'SUPPORT_STAFF';

  return (
    <aside className="sidebar">
      {/* Brand Header */}
      <div className="sidebar-header">
        <div className="sidebar-brand-badge">
          AFO
        </div>
        <div className="sidebar-brand-info">
          <div className="sidebar-brand-title">Admin SaaS</div>
          <div className="sidebar-brand-subtitle" style={{ color: isSupportStaff ? '#f59e0b' : '#3b82f6', fontWeight: 700 }}>
            {isSupportStaff ? 'Support Staff (CSKH)' : 'Master Control Plane'}
          </div>
        </div>
      </div>

      {/* Navigation Groups */}
      <div style={{ flex: 1, paddingBottom: 20 }}>
        {MENU_ITEMS.map((group, idx) => {
          // Lọc các item nếu là Support Staff
          const visibleItems = group.items.filter(item => !isSupportStaff || !item.adminOnly);
          if (visibleItems.length === 0) return null;

          return (
            <div key={idx} className="sidebar-group">
              <div className="sidebar-group-title">{group.group}</div>
              {visibleItems.map(item => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <div
                    key={item.id}
                    className={`sidebar-item ${isActive ? 'active' : ''}`}
                    onClick={() => setActiveTab(item.id)}
                  >
                    <div className="sidebar-item-icon">
                      <Icon size={16} color={isActive ? '#2563eb' : '#64748b'} />
                    </div>
                    <span>{item.label}</span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Footer System Status */}
      <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border)', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 6px #10b981' }} />
          <span style={{ fontWeight: 600, color: '#334155' }}>
            {isSupportStaff ? 'CSKH Mode' : 'Admin Active'}
          </span>
        </div>
        <span style={{ color: '#94a3b8', fontSize: 11, fontWeight: 600 }}>v2.4 Pro</span>
      </div>
    </aside>
  );
}
