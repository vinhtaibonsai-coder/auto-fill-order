import React from 'react';

export default function SyncSettings() {
  return (
    <div style={{ maxWidth: '800px' }}>
      <h2 className="page-title">Sync Settings</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
        Quản lý trạng thái đồng bộ dữ liệu giữa thiết bị hiện tại và Cloud Server (Supabase).
      </p>

      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ marginTop: 0, marginBottom: '8px' }}>Trạng thái Cloud</h3>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>Mọi thay đổi cục bộ sẽ được đồng bộ lên hệ thống chung của Shop.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#ecfdf5', padding: '8px 16px', borderRadius: '99px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }}></div>
            <span style={{ color: '#047857', fontWeight: 600, fontSize: '14px' }}>Đang kết nối</span>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Hàng chờ đồng bộ (Outbox)</h3>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
          Khi rớt mạng, các đơn hàng và sửa đổi sẽ nằm ở đây và tự đẩy lên khi có mạng lại.
        </p>
        
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '12px' }}>Thời gian</th>
              <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '12px' }}>Hành động</th>
              <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '12px' }}>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan="3" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>Không có dữ liệu chờ đồng bộ.</td>
            </tr>
          </tbody>
        </table>
        
        <div style={{ marginTop: '16px', textAlign: 'right' }}>
          <button style={{ background: 'white', color: '#334155', border: '1px solid var(--border)', padding: '8px 16px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>
            🔄 Đồng bộ ngay
          </button>
        </div>
      </div>
    </div>
  );
}
