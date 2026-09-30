import React, { useCallback, useEffect, useState } from 'react';
import { Rocket, Plus, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { AdminService } from '../../../../domain/admin/admin.service.js';
import PublishReleaseModal from '../../modals/PublishReleaseModal';

export default function ReleaseCenter() {
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await AdminService.getReleaseVersions();
    if (r.success) {
      setRows(r.data || []);
    } else {
      alert(r.error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const publish = async (data) => {
    const r = await AdminService.publishRelease(data);
    if (r.success) {
      setOpen(false);
      load();
    } else {
      alert(r.error);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Rocket size={22} color="#2563eb" />
            Trung Tâm Phát Hành Extension (Release Center)
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
            Quản lý các phiên bản cập nhật, phiên bản tối thiểu, bắt buộc nâng cấp (force update) và rollout theo tỷ lệ %
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={load}
            style={{
              padding: '7px 12px',
              fontSize: 12,
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: 8,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            <RefreshCw size={13} className={loading ? 'dash-spin' : ''} /> Tải lại
          </button>
          <button
            onClick={() => setOpen(true)}
            style={{
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: 8,
              padding: '7px 14px',
              fontSize: 12.5,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 2px 4px rgba(37,99,235,0.25)'
            }}
          >
            <Plus size={15} /> Phát hành phiên bản mới
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid #e2e8f0', borderRadius: 12 }}>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Phiên bản</th>
                <th>Phiên bản tối thiểu</th>
                <th>Cập nhật bắt buộc</th>
                <th>Tỷ lệ Rollout</th>
                <th>Ghi chú phát hành</th>
                <th>Ngày phát hành</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '36px 20px', color: '#94a3b8' }}>
                    {loading ? 'Đang tải lịch sử phiên bản...' : 'Chưa có bản phát hành nào.'}
                  </td>
                </tr>
              ) : (
                rows.map(r => (
                  <tr key={r.id}>
                    <td>
                      <span
                        style={{
                          background: '#eff6ff',
                          color: '#1d4ed8',
                          border: '1px solid #bfdbfe',
                          padding: '3px 8px',
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 800
                        }}
                      >
                        v{r.version}
                      </span>
                      {r.download_url && (
                        <a
                          href={r.download_url}
                          target="_blank"
                          rel="noreferrer"
                          style={{ marginLeft: 8, fontSize: 11, color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}
                          title={r.download_url}
                        >
                          📦 Tải về
                        </a>
                      )}
                    </td>
                    <td>
                      <span style={{ color: '#475569', fontSize: 12.5 }}>
                        {r.min_supported_version ? `v${r.min_supported_version}` : '—'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${r.is_force_update ? 'badge-danger' : 'badge-success'}`}>
                        {r.is_force_update ? 'Bắt buộc (Force)' : 'Tùy chọn'}
                      </span>
                    </td>
                    <td>
                      {(() => {
                        const hasRollout = typeof r.rollout_percentage === 'number' && Number.isFinite(r.rollout_percentage);
                        const pct = hasRollout ? Math.max(0, Math.min(100, Math.round(r.rollout_percentage))) : null;
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 60, height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ width: `${hasRollout ? pct : 0}%`, height: '100%', background: '#2563eb' }} />
                            </div>
                            <span style={{ fontWeight: 700, fontSize: 12, color: '#0f172a' }}>
                              {hasRollout ? `${pct}%` : '—'}
                            </span>
                          </div>
                        );
                      })()}
                    </td>
                    <td>
                      <span style={{ color: '#334155', fontSize: 13 }}>{r.release_notes || '—'}</span>
                    </td>
                    <td>
                      <span style={{ color: '#64748b', fontSize: 12 }}>
                        {new Date(r.created_at).toLocaleString('vi-VN')}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <PublishReleaseModal open={open} onClose={() => setOpen(false)} onSubmit={publish} />
    </div>
  );
}
