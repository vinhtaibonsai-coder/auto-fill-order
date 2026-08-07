import React from 'react';

export default function Security() {
  return (
    <div style={{ maxWidth: '800px' }}>
      <h2 className="page-title">Security & Devices</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
        Quản lý các phiên đăng nhập và bảo mật tài khoản.
      </p>

      <div className="card">
        <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Thiết bị đang đăng nhập</h3>
        
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '12px' }}>Thiết bị</th>
              <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '12px' }}>Vị trí</th>
              <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '12px' }}>Hoạt động cuối</th>
              <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '12px', textAlign: 'right' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: '12px 16px' }}>
                <div style={{ fontWeight: 600 }}>Chrome (Windows)</div>
                <div style={{ fontSize: '12px', color: 'var(--success)' }}>This device</div>
              </td>
              <td style={{ padding: '12px 16px', fontSize: '13px' }}>Hồ Chí Minh, VN</td>
              <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-muted)' }}>Vừa xong</td>
              <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                <button disabled style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'not-allowed' }}>Thu hồi</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
