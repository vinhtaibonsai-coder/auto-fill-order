import React, { useState, useEffect, useCallback } from 'react';
import { AdminService } from '../../../../domain/admin/admin.service.js';

export default function CarrierHealth() {
  const [carriers, setCarriers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchCarriers = useCallback(async () => {
    setLoading(true);
    setError('');
    const res = await AdminService.getCarrierHealth();
    if (res.success) {
      setCarriers(res.data || []);
    } else {
      setError(res.error || 'Lỗi tải thống kê nhà vận chuyển');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCarriers();
  }, [fetchCarriers]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0 }}>🚚 Carrier Integrations & DOM Health Monitor</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '4px 0 0 0' }}>
            Giám sát trạng thái kết nối và phát hiện tự động khi DOM website của Nhà vận chuyển có sự thay đổi giao diện.
          </p>
        </div>
        <button
          onClick={fetchCarriers}
          style={{ background: 'var(--primary, #2563eb)', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
        >
          🔄 Refresh
        </button>
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
              <th style={{ padding: '12px 16px' }}>Mã hãng vận chuyển</th>
              <th style={{ padding: '12px 16px' }}>Trạng thái DOM</th>
              <th style={{ padding: '12px 16px' }}>Độ phản hồi</th>
              <th style={{ padding: '12px 16px' }}>Thông báo lỗi</th>
              <th style={{ padding: '12px 16px' }}>Thời gian ghi nhận</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>⏳ Đang tải dữ liệu...</td></tr>
            ) : carriers.length === 0 && !error ? (
              <tr><td colSpan="6" style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>Chưa có log thống kê nào.</td></tr>
            ) : (
              carriers.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0f172a' }}>{c.carrier_code}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      background: c.status === 'healthy' ? '#dcfce7' : (c.status === 'offline' ? '#fee2e2' : '#fffbeb'),
                      color: c.status === 'healthy' ? '#15803d' : (c.status === 'offline' ? '#991b1b' : '#b45309'),
                      padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase'
                    }}>
                      {c.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#475569' }}>{c.response_time_ms}ms</td>
                  <td style={{ padding: '12px 16px', color: '#ef4444', fontSize: '12px' }}>{c.error_message || '—'}</td>
                  <td style={{ padding: '12px 16px', color: '#64748b' }}>
                    {c.detected_at ? new Date(c.detected_at).toLocaleString('vi-VN') : '—'}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <button style={{ background: 'none', border: '1px solid #cbd5e1', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>
                      Kiểm tra DOM
                    </button>
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
