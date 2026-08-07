import React from 'react';

export default function AddressDataset() {
  const versions = [
    { version: 'v2026.08.01', records: '10,614 Wards', status: 'ACTIVE (PRODUCTION)', published: '01/08/2026', author: 'System Admin' },
    { version: 'v2026.07.15', records: '10,590 Wards', status: 'ARCHIVED', published: '15/07/2026', author: 'System Admin' },
    { version: 'v2026.06.01', records: '10,550 Wards', status: 'ARCHIVED', published: '01/06/2026', author: 'System Admin' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0 }}>🗺️ Address Dataset Versioning & Release</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '4px 0 0 0' }}>
            Quản lý Dataset Hành chính Việt Nam (Tỉnh/Huyện/Xã + Sáp nhập đơn vị). Preview Diff & Rollback an toàn.
          </p>
        </div>
        <button style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}>
          📤 Import Dataset Mới
        </button>
      </div>

      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
              <th style={{ padding: '12px 16px' }}>Phiên bản</th>
              <th style={{ padding: '12px 16px' }}>Số lượng bản ghi</th>
              <th style={{ padding: '12px 16px' }}>Trạng thái</th>
              <th style={{ padding: '12px 16px' }}>Ngày phát hành</th>
              <th style={{ padding: '12px 16px' }}>Người cập nhật</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {versions.map(v => (
              <tr key={v.version} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0f172a' }}>{v.version}</td>
                <td style={{ padding: '12px 16px', color: '#475569' }}>{v.records}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ background: v.status.includes('ACTIVE') ? '#dcfce7' : '#f1f5f9', color: v.status.includes('ACTIVE') ? '#15803d' : '#64748b', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                    {v.status}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', color: '#64748b' }}>{v.published}</td>
                <td style={{ padding: '12px 16px', color: '#64748b' }}>{v.author}</td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                  {v.status.includes('ACTIVE') ? (
                    <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600 }}>Đang chạy</span>
                  ) : (
                    <button style={{ background: 'none', border: '1px solid #cbd5e1', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>
                      Rollback về bản này
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
