import React, { useState, useEffect, useCallback } from 'react';
import { AdminService } from '../../../../domain/admin/admin.service.js';

export default function Subscriptions() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mrr, setMrr] = useState(0);

  const fetchSubscriptions = useCallback(async () => {
    setLoading(true);
    setError('');
    const res = await AdminService.getSubscriptions();
    if (res.success) {
      setSubscriptions(res.data || []);
      // Calculate MRR
      const totalMrr = (res.data || []).reduce((sum, sub) => {
        if (sub.status === 'active' || sub.status === 'trialing') {
          return sum + (Number(sub.price_monthly) || 0);
        }
        return sum;
      }, 0);
      setMrr(totalMrr);
    } else {
      setError(res.error || 'Lỗi tải danh sách subscriptions');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0 }}>💳 Subscriptions & SaaS Billing</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '4px 0 0 0' }}>
            Quản lý toàn bộ gói cước, gia hạn và thu hộ doanh thu MRR của các Shop.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '8px 16px', borderRadius: '8px', color: '#065f46', fontWeight: 700 }}>
            MRR Hiện Tại: {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(mrr)}
          </div>
          <button
            onClick={fetchSubscriptions}
            style={{ background: 'var(--primary, #2563eb)', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
          >
            🔄 Refresh
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
              <th style={{ padding: '12px 16px' }}>Shop</th>
              <th style={{ padding: '12px 16px' }}>Gói cước</th>
              <th style={{ padding: '12px 16px' }}>Trạng thái</th>
              <th style={{ padding: '12px 16px' }}>Giá trị</th>
              <th style={{ padding: '12px 16px' }}>Nhân sự / Thiết bị</th>
              <th style={{ padding: '12px 16px' }}>Ngày gia hạn</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="7" style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>⏳ Đang tải dữ liệu...</td></tr>
            ) : subscriptions.length === 0 && !error ? (
              <tr><td colSpan="7" style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>Chưa có subscription nào.</td></tr>
            ) : (
              subscriptions.map(sub => (
                <tr key={sub.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>{sub.shops?.name || 'Không rõ'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: '4px', fontWeight: 600, fontSize: '11px' }}>
                      {sub.plan_code}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ background: sub.status === 'active' ? '#dcfce7' : '#fffbeb', color: sub.status === 'active' ? '#15803d' : '#b45309', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                      {sub.status.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: '#16a34a' }}>
                    {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(sub.price_monthly)}/tháng
                  </td>
                  <td style={{ padding: '12px 16px', color: '#64748b' }}>{sub.max_users} users / {sub.max_devices} devices</td>
                  <td style={{ padding: '12px 16px', color: '#64748b' }}>
                    {sub.current_period_end ? new Date(sub.current_period_end).toLocaleDateString('vi-VN') : '—'}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <button style={{ background: 'none', border: '1px solid #cbd5e1', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>
                      Đổi gói / Chi tiết
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
