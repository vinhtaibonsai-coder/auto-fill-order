import React, { useState, useEffect, useCallback } from 'react';
import { AdminService } from '../../../../domain/admin/admin.service.js';

const timeAgo = (timestamp) => {
  if (!timestamp) return 'Không rõ';
  const seconds = Math.floor((Date.now() - new Date(timestamp)) / 1000);
  if (seconds < 60) return `${seconds} giây trước`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} phút trước`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} giờ trước`;
  return `${Math.floor(seconds / 86400)} ngày trước`;
};

export default function DeviceManagement() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(null); // deviceId đang được xử lý

  const fetchDevices = useCallback(async () => {
    setLoading(true);
    setError('');
    const res = await AdminService.listDevices();
    if (res.success) {
      setDevices(res.data || []);
    } else {
      setError(res.error || 'Không thể tải danh sách thiết bị. Yêu cầu quyền SYSTEM_ADMIN.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  const handleRevoke = async (device) => {
    const isRevoked = device.revoked;
    const action = isRevoked ? 'KHÔI PHỤC' : 'THU HỒI';
    if (!window.confirm(`Bạn có chắc muốn ${action} thiết bị của ${device.email}?`)) return;

    setActionLoading(device.device_id);
    const res = await AdminService.revokeDevice(device.device_id, !isRevoked);
    if (res.success) {
      // Cập nhật optimistic UI
      setDevices(prev => prev.map(d =>
        d.device_id === device.device_id ? { ...d, revoked: !isRevoked } : d
      ));
    } else {
      alert('Lỗi: ' + res.error);
    }
    setActionLoading(null);
  };

  const activeCount = devices.filter(d => !d.revoked).length;
  const revokedCount = devices.filter(d => d.revoked).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0 }}>💻 System-wide Device Management</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '4px 0 0 0' }}>
            Quản trị toàn bộ danh sách thiết bị đang active trên hệ thống SaaS. Enforcement giới hạn thiết bị theo gói cước.
          </p>
        </div>
        <button
          onClick={fetchDevices}
          style={{ background: 'var(--primary, #2563eb)', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
        >
          🔄 Refresh
        </button>
      </div>

      {/* Summary */}
      <div style={{ display: 'flex', gap: '12px' }}>
        <div style={{ background: '#dcfce7', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '12px 20px', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ fontSize: '22px', fontWeight: 700, color: '#15803d' }}>{activeCount}</span>
          <span style={{ fontSize: '12px', color: '#166534', fontWeight: 600 }}>THIẾT BỊ ACTIVE</span>
        </div>
        <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px 20px', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ fontSize: '22px', fontWeight: 700, color: '#dc2626' }}>{revokedCount}</span>
          <span style={{ fontSize: '12px', color: '#991b1b', fontWeight: 600 }}>ĐÃ THU HỒI</span>
        </div>
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 20px', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a' }}>{devices.length}</span>
          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>TỔNG CỘNG</span>
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
              <th style={{ padding: '12px 16px' }}>Shop</th>
              <th style={{ padding: '12px 16px' }}>Tài khoản</th>
              <th style={{ padding: '12px 16px' }}>Thiết bị / Trình duyệt</th>
              <th style={{ padding: '12px 16px' }}>Phiên bản</th>
              <th style={{ padding: '12px 16px' }}>Hoạt động cuối</th>
              <th style={{ padding: '12px 16px' }}>Trạng thái</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="7" style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                  ⏳ Đang tải dữ liệu thiết bị...
                </td>
              </tr>
            ) : devices.length === 0 && !error ? (
              <tr>
                <td colSpan="7" style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                  Chưa có dữ liệu thiết bị trong hệ thống.
                </td>
              </tr>
            ) : (
              devices.map(d => (
                <tr key={d.device_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                    {d.shop_name || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Chưa gán shop</span>}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 600 }}>{d.full_name || '—'}</div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>{d.email}</div>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#475569' }}>
                    <div>{d.device_name || '—'}</div>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>{d.browser || '—'}</div>
                  </td>
                  <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#64748b', fontSize: '12px' }}>
                    {d.version || '—'}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#64748b' }}>
                    {timeAgo(d.last_seen)}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      background: !d.revoked ? '#dcfce7' : '#fee2e2',
                      color: !d.revoked ? '#15803d' : '#991b1b',
                      padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600
                    }}>
                      {!d.revoked ? 'ACTIVE' : 'REVOKED'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <button
                      onClick={() => handleRevoke(d)}
                      disabled={actionLoading === d.device_id}
                      style={{
                        background: !d.revoked ? '#fee2e2' : '#dcfce7',
                        color: !d.revoked ? '#991b1b' : '#15803d',
                        border: 'none', padding: '4px 10px', borderRadius: '4px',
                        cursor: actionLoading === d.device_id ? 'not-allowed' : 'pointer',
                        fontSize: '11px', fontWeight: 600, opacity: actionLoading === d.device_id ? 0.6 : 1
                      }}
                    >
                      {actionLoading === d.device_id ? '⏳' : (!d.revoked ? 'Thu hồi (Revoke)' : 'Khôi phục')}
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
