import React, { useState } from 'react';

export default function PermissionMatrix() {
  const [permissions, setPermissions] = useState({
    create_order: { OWNER: true, MANAGER: true, STAFF: true, VIEWER: false },
    view_orders: { OWNER: true, MANAGER: true, STAFF: true, VIEWER: true },
    edit_order: { OWNER: true, MANAGER: true, STAFF: true, VIEWER: false },
    delete_order: { OWNER: true, MANAGER: true, STAFF: false, VIEWER: false },
    customers: { OWNER: true, MANAGER: true, STAFF: true, VIEWER: true },
    ai_settings: { OWNER: true, MANAGER: true, STAFF: false, VIEWER: false },
    team_management: { OWNER: true, MANAGER: true, STAFF: false, VIEWER: false },
    billing: { OWNER: true, MANAGER: false, STAFF: false, VIEWER: false },
    audit_logs: { OWNER: true, MANAGER: true, STAFF: false, VIEWER: true },
    shop_settings: { OWNER: true, MANAGER: true, STAFF: false, VIEWER: false },
    device_management: { OWNER: true, MANAGER: true, STAFF: false, VIEWER: false }
  });

  const roles = ['OWNER', 'MANAGER', 'STAFF', 'VIEWER'];

  const togglePermission = (permKey, role) => {
    if (role === 'OWNER') return; // OWNER luôn full quyền
    setPermissions(prev => ({
      ...prev,
      [permKey]: {
        ...prev[permKey],
        [role]: !prev[permKey][role]
      }
    }));
  };

  return (
    <div className="card" style={{ padding: '20px' }}>
      <h3 style={{ marginTop: 0, marginBottom: '6px' }}>🔑 Ma trận Phân Quyền (RBAC Matrix)</h3>
      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
        Thiết lập quyền truy cập cho từng vai trò trong Shop của bạn. Owner mặc định có đầy đủ tất cả các quyền.
      </p>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
            <th style={{ padding: '10px' }}>Tác vụ / Quyền hạn</th>
            {roles.map(r => (
              <th key={r} style={{ padding: '10px', textAlign: 'center' }}>{r}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Object.keys(permissions).map(permKey => (
            <tr key={permKey} style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '10px', fontWeight: 500 }}>
                {permKey.replace('_', ' ').toUpperCase()}
              </td>
              {roles.map(role => (
                <td key={role} style={{ padding: '10px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={permissions[permKey][role]}
                    disabled={role === 'OWNER'}
                    onChange={() => togglePermission(permKey, role)}
                    style={{ cursor: role === 'OWNER' ? 'not-allowed' : 'pointer' }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: '16px', textAlign: 'right' }}>
        <button className="af-btn-primary" onClick={() => alert("Đã lưu ma trận phân quyền thành công!")}>
          Lưu cấu hình phân quyền
        </button>
      </div>
    </div>
  );
}
