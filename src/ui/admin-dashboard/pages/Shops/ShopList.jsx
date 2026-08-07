import React, { useState, useEffect } from 'react';

export default function ShopList() {
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Giả lập Dữ liệu Shop theo đúng định dạng Master Plan
    setTimeout(() => {
      setShops([
        { id: 'SH-001', name: 'VNPost Hue', plan: 'PRO', users: 12, devices: 5, orders: 4500, aiUsage: '85%', status: 'Active', created: '2025-01-10', lastActive: '2 mins ago' },
        { id: 'SH-002', name: 'J&T Express HCM', plan: 'STARTER', users: 3, devices: 1, orders: 850, aiUsage: '20%', status: 'Trial', created: '2026-06-15', lastActive: '1 hr ago' },
        { id: 'SH-003', name: 'GHTK Da Nang', plan: 'PRO', users: 20, devices: 15, orders: 12000, aiUsage: '95%', status: 'Active', created: '2024-11-20', lastActive: 'Just now' },
        { id: 'SH-004', name: 'Viettel Post HN', plan: 'FREE', users: 1, devices: 1, orders: 50, aiUsage: '100%', status: 'Suspended', created: '2026-01-05', lastActive: '1 month ago' },
      ]);
      setLoading(false);
    }, 800);
  }, []);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 className="page-title" style={{ margin: 0 }}>Shops Management</h2>
        <button className="badge badge-success" style={{ cursor: 'pointer', border: 'none', padding: '8px 16px', fontSize: '14px' }}>+ New Shop</button>
      </div>

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
              <th style={{ padding: '16px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' }}>Shop Name</th>
              <th style={{ padding: '16px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' }}>Plan</th>
              <th style={{ padding: '16px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' }}>Users / Devices</th>
              <th style={{ padding: '16px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' }}>Orders</th>
              <th style={{ padding: '16px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' }}>AI Usage</th>
              <th style={{ padding: '16px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' }}>Status</th>
              <th style={{ padding: '16px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' }}>Last Active</th>
              <th style={{ padding: '16px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="8" style={{ padding: '20px', textAlign: 'center' }}>Loading shops...</td></tr>
            ) : (
              shops.map(shop => (
                <tr key={shop.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '16px' }}>
                    <div style={{ fontWeight: 500 }}>{shop.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{shop.id}</div>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: shop.plan === 'PRO' ? '#a855f7' : 'var(--text-secondary)' }}>{shop.plan}</span>
                  </td>
                  <td style={{ padding: '16px' }}>{shop.users} / {shop.devices}</td>
                  <td style={{ padding: '16px' }}>{shop.orders.toLocaleString()}</td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.1)', height: '6px', borderRadius: '3px', marginTop: '4px' }}>
                      <div style={{ width: shop.aiUsage, backgroundColor: parseInt(shop.aiUsage) > 90 ? 'var(--danger)' : 'var(--success)', height: '100%', borderRadius: '3px' }}></div>
                    </div>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <span className={`badge ${shop.status === 'Active' ? 'badge-success' : shop.status === 'Trial' ? 'badge-warning' : 'badge-danger'}`}>
                      {shop.status}
                    </span>
                  </td>
                  <td style={{ padding: '16px', fontSize: '12px', color: 'var(--text-secondary)' }}>{shop.lastActive}</td>
                  <td style={{ padding: '16px' }}>
                    <button style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}>Manage</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
