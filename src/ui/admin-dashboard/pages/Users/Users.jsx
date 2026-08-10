import React, { useState, useEffect } from 'react';
import { SkeletonTableRows } from '../../components/SkeletonTable';
import { AdminService } from '../../../../domain/admin/admin.service.js';

const formatDate = (dateString) => {
  if (!dateString) return '';
  const d = new Date(dateString);
  return d.toLocaleString('vi-VN');
};

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const res = await AdminService.getUsersList();
    if (res.success) {
      setUsers(res.data);
      setError(null);
    } else {
      setError(res.error);
    }
    setLoading(false);
  };

  const handleToggleStatus = async (user) => {
    const newStatus = user.status === 'active' ? 'suspended' : 'active';
    if (!confirm(`Bạn có chắc muốn ${newStatus === 'suspended' ? 'KHÓA' : 'MỞ KHÓA'} tài khoản ${user.email}?`)) return;

    try {
      const res = await AdminService.updateUserStatus(user.id, user.status, newStatus);
      if (res.success) {
        setUsers(users.map(u => u.id === user.id ? { ...u, status: newStatus } : u));
      } else {
        alert("Lỗi: " + res.error);
      }
    } catch (err) {
      alert("Lỗi: " + err.message);
    }
  };

  const handleInvite = () => {
    const email = prompt("Nhập email để mời Admin mới:");
    if (email) {
      alert(`[MOCK] Lời mời đã được gửi tới ${email}. Tính năng sẽ hoạt động khi có Mail Service.`);
    }
  };

  const filteredUsers = users.filter(u => 
    (u.email || '').toLowerCase().includes(search.toLowerCase()) || 
    (u.full_name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2>User Management (RBAC)</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input 
            type="text" 
            placeholder="Search by email, name..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '6px', width: '250px' }} 
          />
          <button className="btn btn-primary" onClick={handleInvite}>+ Invite Admin</button>
        </div>
      </div>
      
      {error && <div style={{ color: 'red', marginBottom: '16px' }}>{error}</div>}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: '12px' }}>User</th>
              <th style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: '12px' }}>System Role</th>
              <th style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: '12px' }}>Shop Access</th>
              <th style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: '12px' }}>Status</th>
              <th style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: '12px' }}>Last Active</th>
              <th style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: '12px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonTableRows columns={7} rows={5} />
            ) : filteredUsers.length === 0 ? (
              <tr><td colSpan="6" style={{ padding: '24px', textAlign: 'center' }}>Không tìm thấy người dùng</td></tr>
            ) : filteredUsers.map(user => (
              <tr key={user.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '16px' }}>
                  <div style={{ fontWeight: 600 }}>{user.full_name || 'No Name'}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{user.email}</div>
                </td>
                <td style={{ padding: '16px' }}>
                  {user.role === 'master_admin' ? (
                    <span className="badge badge-primary">MASTER ADMIN</span>
                  ) : (
                    <span className="badge" style={{ background: '#f1f5f9' }}>USER</span>
                  )}
                </td>
                <td style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                  {user.shops && user.shops.length > 0 ? (
                    user.shops.map(s => (
                      <div key={s.shop_id}>
                        <strong style={{ color: 'var(--primary)' }}>{s.shop_name}</strong> ({s.shop_role})
                      </div>
                    ))
                  ) : '-'}
                </td>
                <td style={{ padding: '16px' }}>
                  {user.status === 'active' ? (
                    <span className="badge badge-success">ACTIVE</span>
                  ) : (
                    <span className="badge badge-warning">SUSPENDED</span>
                  )}
                </td>
                <td style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                  {user.last_login ? formatDate(user.last_login) : 'Never'}
                </td>
                <td style={{ padding: '16px', textAlign: 'right' }}>
                  {user.role !== 'master_admin' && (
                    <button 
                      className="btn" 
                      style={{ fontSize: '12px', padding: '4px 8px' }}
                      onClick={() => handleToggleStatus(user)}
                    >
                      {user.status === 'active' ? 'Suspend' : 'Activate'}
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
