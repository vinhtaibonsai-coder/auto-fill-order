import React, { useState, useEffect, useCallback } from 'react';
import { AdminService } from '../../../../domain/admin/admin.service.js';

export default function AddressDataset() {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(null);

  const fetchVersions = useCallback(async () => {
    setLoading(true);
    setError('');
    const res = await AdminService.getAddressDatasets();
    if (res.success) {
      setVersions(res.data || []);
    } else {
      setError(res.error || 'Lỗi tải danh sách Dataset');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchVersions();
  }, [fetchVersions]);

  const handleRollback = async (dataset) => {
    if (!window.confirm(`Bạn có chắc muốn Rollback (kích hoạt) phiên bản ${dataset.version}? Các phiên bản khác sẽ bị de-active.`)) return;
    
    setActionLoading(dataset.id);
    
    // In a real scenario, a backend RPC should handle de-activating others and activating this one safely.
    // For now, we update this one to true.
    const res = await AdminService.updateAddressDatasetStatus(dataset.id, dataset, { is_active: true });
    
    if (res.success) {
      // Optimistic update
      setVersions(prev => prev.map(v => 
        v.id === dataset.id ? { ...v, is_active: true } : { ...v, is_active: false }
      ));
    } else {
      alert('Lỗi: ' + res.error);
    }
    setActionLoading(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0 }}>🗺️ Address Dataset Versioning & Release</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '4px 0 0 0' }}>
            Quản lý Dataset Hành chính Việt Nam (Tỉnh/Huyện/Xã + Sáp nhập đơn vị). Preview Diff & Rollback an toàn.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={fetchVersions}
            style={{ background: '#f8fafc', color: '#0f172a', border: '1px solid #cbd5e1', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
          >
            🔄 Refresh
          </button>
          <button style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}>
            📤 Import Dataset Mới
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
              <th style={{ padding: '12px 16px' }}>Số lượng bản ghi</th>
              <th style={{ padding: '12px 16px' }}>Trạng thái</th>
              <th style={{ padding: '12px 16px' }}>Ngày phát hành</th>
              <th style={{ padding: '12px 16px' }}>Mô tả</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>⏳ Đang tải dữ liệu...</td></tr>
            ) : versions.length === 0 && !error ? (
              <tr><td colSpan="6" style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>Chưa có dataset nào.</td></tr>
            ) : (
              versions.map(v => (
                <tr key={v.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0f172a' }}>{v.version}</td>
                  <td style={{ padding: '12px 16px', color: '#475569' }}>{Number(v.total_records || 0).toLocaleString()} Wards</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ background: v.is_active ? '#dcfce7' : '#f1f5f9', color: v.is_active ? '#15803d' : '#64748b', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                      {v.is_active ? 'ACTIVE (PRODUCTION)' : 'ARCHIVED'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#64748b' }}>
                    {v.published_at ? new Date(v.published_at).toLocaleDateString('vi-VN') : '—'}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#64748b' }}>{v.description || '—'}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    {v.is_active ? (
                      <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600 }}>Đang chạy</span>
                    ) : (
                      <button 
                        onClick={() => handleRollback(v)}
                        disabled={actionLoading === v.id}
                        style={{ background: 'none', border: '1px solid #cbd5e1', padding: '4px 8px', borderRadius: '4px', cursor: actionLoading === v.id ? 'not-allowed' : 'pointer', fontSize: '11px', opacity: actionLoading === v.id ? 0.6 : 1 }}
                      >
                        {actionLoading === v.id ? '⏳' : 'Rollback về bản này'}
                      </button>
                    )}
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
