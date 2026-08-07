import React, { useState } from 'react';

export default function Team() {
  const [staff, setStaff] = useState([
    { id: 1, name: 'Nguyễn Văn A', email: 'vana@shop.com', role: 'Owner', status: 'Active' },
    { id: 2, name: 'Trần Thị B', email: 'thib@shop.com', role: 'Staff', status: 'Active' },
    { id: 3, name: 'Lê Văn C', email: 'vanc@shop.com', role: 'Staff', status: 'Pending' }
  ]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="page-title">Team Management</h2>
        <button style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>
          + Invite Staff
        </button>
      </div>
      <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
        Quản lý nhân viên thuộc Shop của bạn. Admin có toàn quyền, Staff chỉ có quyền tạo đơn.
      </p>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase' }}>User</th>
              <th style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase' }}>Role</th>
              <th style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase' }}>Status</th>
              <th style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase', width: '100px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {staff.map(user => (
              <tr key={user.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '16px' }}>
                  <div style={{ fontWeight: 600 }}>{user.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{user.email}</div>
                </td>
                <td style={{ padding: '16px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: user.role === 'Owner' ? 'var(--primary)' : 'var(--text-main)' }}>
                    {user.role}
                  </span>
                </td>
                <td style={{ padding: '16px' }}>
                  <span style={{ 
                    padding: '4px 8px', borderRadius: '99px', fontSize: '12px', fontWeight: 600,
                    background: user.status === 'Active' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                    color: user.status === 'Active' ? 'var(--success)' : '#d97706'
                  }}>
                    {user.status}
                  </span>
                </td>
                <td style={{ padding: '16px' }}>
                  <button style={{ background: 'transparent', border: '1px solid var(--border)', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}>Manage</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
