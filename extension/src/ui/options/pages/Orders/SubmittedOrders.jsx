import React, { useEffect, useMemo, useState } from 'react';
import { OrderStorage } from '../../../../application/storage.esm.js';

const valueOf = (order, ...keys) => {
  for (const key of keys) {
    const value = order?.[key] ?? order?.parsedData?.[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return '';
};

const formatDate = (value) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('vi-VN');
};

const carrierLabel = (value) => {
  const v = String(value || '').toLowerCase();
  if (v.includes('vnpost')) return 'VNPost';
  if (v === 'jt' || v.includes('j&t') || v.includes('jtexpress')) return 'J&T Express';
  return value || '-';
};

export default function SubmittedOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const loadOrders = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await OrderStorage.getSubmittedOrders().catch(() => []);
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Không thể tải danh sách đơn đã lên.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(order => {
      const haystack = [
        valueOf(order, 'name', 'customerName', 'customer_name'),
        valueOf(order, 'phone'),
        valueOf(order, 'orderCode', 'order_code'),
        valueOf(order, 'trackingCode', 'tracking_code'),
        valueOf(order, 'address')
      ].join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [orders, search]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div>
          <h2 className="page-title" style={{ marginBottom: '6px' }}>Đơn đã lên</h2>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '13px' }}>
            Danh sách đơn đã gửi lên hãng vận chuyển, lấy local-first và tự đồng bộ Cloud khi có kết nối.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            placeholder="Tìm tên, SĐT, mã đơn, vận đơn..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '6px', width: '280px' }}
          />
          <button
            type="button"
            onClick={loadOrders}
            disabled={loading}
            style={{ background: 'white', color: '#334155', border: '1px solid var(--border)', padding: '8px 14px', borderRadius: '6px', fontWeight: 700, cursor: loading ? 'default' : 'pointer' }}
          >
            {loading ? 'Đang tải...' : 'Làm mới'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
          {error}
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Đang tải dữ liệu...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Chưa có đơn đã lên phù hợp.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '13px' }}>Thời gian</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '13px' }}>Khách hàng</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '13px' }}>Mã đơn</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '13px' }}>Vận đơn</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '13px' }}>COD</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '13px' }}>Hãng</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '13px' }}>Địa chỉ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(order => (
                <tr key={order.id || order.trackingCode || order.orderCode} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 16px', fontSize: '13px', whiteSpace: 'nowrap' }}>
                    {formatDate(valueOf(order, 'submittedAt', 'submitted_at', 'createdAt', 'created_at'))}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 700 }}>{valueOf(order, 'name', 'customerName', 'customer_name') || '-'}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{valueOf(order, 'phone') || '-'}</div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', fontFamily: 'monospace' }}>{valueOf(order, 'orderCode', 'order_code') || '-'}</td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 700, color: '#2563eb', fontFamily: 'monospace' }}>{valueOf(order, 'trackingCode', 'tracking_code') || '-'}</td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', whiteSpace: 'nowrap' }}>{Number(valueOf(order, 'codAmount', 'cod_amount') || 0).toLocaleString('vi-VN')}đ</td>
                  <td style={{ padding: '12px 16px', fontSize: '13px' }}>{carrierLabel(valueOf(order, 'platform'))}</td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', maxWidth: '340px' }}>{valueOf(order, 'address') || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
