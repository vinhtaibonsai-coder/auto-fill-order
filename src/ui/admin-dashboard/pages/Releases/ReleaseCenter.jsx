import React, { useState, useEffect, useCallback } from 'react';
import { AdminService } from '../../../../domain/admin/admin.service.js';

export default function ReleaseCenter() {
  const [releases, setReleases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchReleases = useCallback(async () => {
    setLoading(true);
    setError('');
    const res = await AdminService.getReleaseVersions();
    if (res.success) {
      setReleases(res.data || []);
    } else {
      setError(res.error || 'Lỗi tải danh sách phiên bản');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchReleases();
  }, [fetchReleases]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0 }}>🚀 Extension Release & Version Control</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '4px 0 0 0' }}>
            Quản lý các phiên bản Extension Chrome phát hành, cấu hình ép buộc cập nhật (Force Update) và Release Notes.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={fetchReleases}
            style={{ background: '#f8fafc', color: '#0f172a', border: '1px solid #cbd5e1', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
          >
            🔄 Refresh
          </button>
          <button style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}>
            ✨ Phát hành phiên bản mới
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: '#fee2e2', color: '#991b1b', padding: '12px', borderRadius: '6px', fontSize: '13px' }}>
          ⚠️ {error}
        </div>
      )}

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
            {loading ? (
              <tr><td colSpan="6" style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>⏳ Đang tải dữ liệu...</td></tr>
            ) : releases.length === 0 && !error ? (
              <tr><td colSpan="6" style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>Chưa có phiên bản release nào.</td></tr>
            ) : (
              releases.map(rel => (
                <tr key={rel.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: '#2563eb' }}>{rel.version}</td>
                  <td style={{ padding: '12px 16px', color: '#64748b' }}>{rel.min_supported_version || '—'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      background: rel.is_force_update ? '#fee2e2' : '#f1f5f9',
                      color: rel.is_force_update ? '#991b1b' : '#64748b',
                      padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600
                    }}>
                      {rel.is_force_update ? 'YES (Bắt buộc)' : 'NO'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: '#16a34a' }}>{rel.rollout_percentage}%</td>
                  <td style={{ padding: '12px 16px', color: '#334155' }}>{rel.release_notes}</td>
                  <td style={{ padding: '12px 16px', color: '#64748b' }}>
                    {rel.created_at ? new Date(rel.created_at).toLocaleDateString('vi-VN') : '—'}
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
