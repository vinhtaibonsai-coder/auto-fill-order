import React from 'react';

export default function DeviceManagement() {
  const devices = [
    { id: 'dev_1', shop: 'Shop Quần Áo Flash', user: 'staff_01@shop.com', browser: 'Chrome 127 - Windows', ip: '113.161.40.12', status: 'ACTIVE', lastActive: '2 phút trước' },
    { id: 'dev_2', shop: 'Shop Quần Áo Flash', user: 'owner@shop.com', browser: 'Edge 126 - Windows', ip: '113.161.40.15', status: 'ACTIVE', lastActive: '1 giờ trước' },
    { id: 'dev_3', shop: 'Mỹ Phẩm Auth VN', user: 'admin@mypham.com', browser: 'Safari - macOS', ip: '14.232.18.90', status: 'ACTIVE', lastActive: '5 phút trước' },
    { id: 'dev_4', shop: 'Nông Sản Sạch HCM', user: 'staff_test@nongsan.com', browser: 'Firefox - Windows', ip: '27.72.100.5', status: 'REVOKED', lastActive: '3 ngày trước' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <h2 style={{ margin: 0 }}>💻 System-wide Device Management</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '4px 0 0 0' }}>
          Quản trị toàn bộ danh sách thiết bị đang active trên hệ thống SaaS. Enforcement giới hạn thiết bị theo gói cước.
        </p>
      </div>

      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
              <th style={{ padding: '12px 16px' }}>Shop</th>
              <th style={{ padding: '12px 16px' }}>Tài khoản</th>
              <th style={{ padding: '12px 16px' }}>Trình duyệt / OS</th>
              <th style={{ padding: '12px 16px' }}>Địa chỉ IP</th>
              <th style={{ padding: '12px 16px' }}>Hoạt động cuối</th>
              <th style={{ padding: '12px 16px' }}>Trạng thái</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {devices.map(d => (
              <tr key={d.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '12px 16px', fontWeight: 600 }}>{d.shop}</td>
                <td style={{ padding: '12px 16px', color: '#475569' }}>{d.user}</td>
                <td style={{ padding: '12px 16px', color: '#475569' }}>{d.browser}</td>
                <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#64748b' }}>{d.ip}</td>
                <td style={{ padding: '12px 16px', color: '#64748b' }}>{d.lastActive}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{
                    background: d.status === 'ACTIVE' ? '#dcfce7' : '#fee2e2',
                    color: d.status === 'ACTIVE' ? '#15803d' : '#991b1b',
                    padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600
                  }}>
                    {d.status}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                  {d.status === 'ACTIVE' && (
                    <button style={{ background: '#fee2e2', color: '#991b1b', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}>
                      Thu hồi quyền (Revoke)
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
