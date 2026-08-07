import React from 'react';

export default function Subscriptions() {
  const subscriptionsList = [
    { id: 'sub_1', shopName: 'Shop Quần Áo Flash', plan: 'PRO', status: 'active', price: '499.000 đ/tháng', renewalDate: '04/09/2026', users: 8, devices: 4 },
    { id: 'sub_2', shopName: 'Mỹ Phẩm Auth VN', plan: 'BUSINESS', status: 'active', price: '999.000 đ/tháng', renewalDate: '12/09/2026', users: 22, devices: 11 },
    { id: 'sub_3', shopName: 'Gia Dụng Thông Minh', plan: 'STARTER', status: 'active', price: '199.000 đ/tháng', renewalDate: '28/08/2026', users: 2, devices: 2 },
    { id: 'sub_4', shopName: 'Nông Sản Sạch HCM', plan: 'FREE', status: 'trialing', price: '0 đ/tháng', renewalDate: '15/08/2026', users: 1, devices: 1 },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0 }}>💳 Subscriptions & SaaS Billing</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '4px 0 0 0' }}>
            Quản lý toàn bộ gói cước, gia hạn và thu hộ doanh thu MRR của các Shop.
          </p>
        </div>
        <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '8px 16px', borderRadius: '8px', color: '#065f46', fontWeight: 700 }}>
          MRR Hiện Tại: 42.500.000 đ
        </div>
      </div>

      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
              <th style={{ padding: '12px 16px' }}>Shop</th>
              <th style={{ padding: '12px 16px' }}>Gói cước</th>
              <th style={{ padding: '12px 16px' }}>Trạng thái</th>
              <th style={{ padding: '12px 16px' }}>Giá trị</th>
              <th style={{ padding: '12px 16px' }}>Nhân sự / Thiết bị</th>
              <th style={{ padding: '12px 16px' }}>Ngày gia hạn</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {subscriptionsList.map(sub => (
              <tr key={sub.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '12px 16px', fontWeight: 600 }}>{sub.shopName}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: '4px', fontWeight: 600, fontSize: '11px' }}>
                    {sub.plan}
                  </span>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ background: sub.status === 'active' ? '#dcfce7' : '#fffbeb', color: sub.status === 'active' ? '#15803d' : '#b45309', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                    {sub.status.toUpperCase()}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', fontWeight: 600, color: '#16a34a' }}>{sub.price}</td>
                <td style={{ padding: '12px 16px', color: '#64748b' }}>{sub.users} users / {sub.devices} devices</td>
                <td style={{ padding: '12px 16px', color: '#64748b' }}>{sub.renewalDate}</td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                  <button style={{ background: 'none', border: '1px solid #cbd5e1', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>
                    Đổi gói / Chi tiết
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
