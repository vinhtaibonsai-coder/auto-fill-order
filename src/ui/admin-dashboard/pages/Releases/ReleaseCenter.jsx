import React from 'react';

export default function ReleaseCenter() {
  const releases = [
    { version: 'v2.5.0', minVersion: 'v2.0.0', isForce: false, rollout: '100%', notes: 'Bổ sung Commercial UI/UX, hỗ trợ RBAC Matrix & SaaS Quota', releaseDate: '07/08/2026' },
    { version: 'v2.4.1', minVersion: 'v2.0.0', isForce: false, rollout: '100%', notes: 'Sửa lỗi DOM selector trên trang VNPost tạo đơn mới', releaseDate: '28/07/2026' },
    { version: 'v2.3.0', minVersion: 'v1.8.0', isForce: true, rollout: '100%', notes: 'Nâng cấp bảo mật Auth JWT token và RLS policy v16', releaseDate: '15/07/2026' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0 }}>🚀 Extension Release & Version Control</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '4px 0 0 0' }}>
            Quản lý các phiên bản Extension Chrome phát hành, cấu hình ép buộc cập nhật (Force Update) và Release Notes.
          </p>
        </div>
        <button style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}>
          ✨ Phát hành phiên bản mới
        </button>
      </div>

      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
              <th style={{ padding: '12px 16px' }}>Phiên bản</th>
              <th style={{ padding: '12px 16px' }}>Min Version hỗ trợ</th>
              <th style={{ padding: '12px 16px' }}>Force Update</th>
              <th style={{ padding: '12px 16px' }}>Tỷ lệ Rollout</th>
              <th style={{ padding: '12px 16px' }}>Ghi chú phát hành</th>
              <th style={{ padding: '12px 16px' }}>Ngày phát hành</th>
            </tr>
          </thead>
          <tbody>
            {releases.map(rel => (
              <tr key={rel.version} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '12px 16px', fontWeight: 700, color: '#2563eb' }}>{rel.version}</td>
                <td style={{ padding: '12px 16px', color: '#64748b' }}>{rel.minVersion}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{
                    background: rel.isForce ? '#fee2e2' : '#f1f5f9',
                    color: rel.isForce ? '#991b1b' : '#64748b',
                    padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600
                  }}>
                    {rel.isForce ? 'YES (Bắt buộc)' : 'NO'}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', fontWeight: 600, color: '#16a34a' }}>{rel.rollout}</td>
                <td style={{ padding: '12px 16px', color: '#334155' }}>{rel.notes}</td>
                <td style={{ padding: '12px 16px', color: '#64748b' }}>{rel.releaseDate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
