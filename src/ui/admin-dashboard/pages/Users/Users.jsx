import React from 'react';

export default function Users() {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2>User Management</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input type="text" placeholder="Search users by email, shop..." style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '6px', width: '300px' }} />
          <button className="btn btn-primary">+ Invite Admin</button>
        </div>
      </div>
      
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: '12px' }}>User</th>
              <th style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: '12px' }}>Role</th>
              <th style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: '12px' }}>Shop</th>
              <th style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: '12px' }}>Status</th>
              <th style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: '12px' }}>Last Active</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '16px' }}>
                <div style={{ fontWeight: 600 }}>System Admin</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>admin@autofill.com</div>
              </td>
              <td style={{ padding: '16px' }}><span className="badge badge-primary">SUPER ADMIN</span></td>
              <td style={{ padding: '16px', color: 'var(--text-secondary)' }}>-</td>
              <td style={{ padding: '16px' }}><span className="badge badge-success">ACTIVE</span></td>
              <td style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: '13px' }}>Just now</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '16px' }}>
                <div style={{ fontWeight: 600 }}>Tú Nguyễn</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>tu.nguyen@testshop.com</div>
              </td>
              <td style={{ padding: '16px' }}><span className="badge" style={{ background: '#f1f5f9' }}>SHOP OWNER</span></td>
              <td style={{ padding: '16px', color: 'var(--primary)', fontWeight: 600 }}>SHOP-1234</td>
              <td style={{ padding: '16px' }}><span className="badge badge-success">ACTIVE</span></td>
              <td style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: '13px' }}>2 hours ago</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
