import React from 'react';

export default function AuditLogs() {
  return (
    <div style={{ maxWidth: '800px' }}>
      <h2 className="page-title">Audit Logs</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
        Lưu vết toàn bộ hoạt động của nhân viên trên hệ thống (Tạo, Sửa, Xóa đơn hàng).
      </p>

      <div className="card">
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <input type="text" placeholder="Tìm kiếm theo tên nhân viên, hành động..." style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '6px', width: '300px' }} />
          <input type="date" style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '6px' }} />
        </div>
        
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '12px' }}>Thời gian</th>
              <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '12px' }}>Nhân viên</th>
              <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '12px' }}>Hành động</th>
              <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '12px' }}>Chi tiết</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan="4" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Chưa có hoạt động nào được ghi nhận.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
