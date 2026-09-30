import React, { useState, useEffect, useMemo } from 'react';
import { Package, Search, X, Copy, Check, Calendar, Laptop, RefreshCw, AlertCircle, ExternalLink } from 'lucide-react';
import AdminModal from './AdminModal';
import { AdminService } from '../../../domain/admin/admin.service.js';

export default function DeviceOrdersModal({ open, device, onClose }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [copiedCode, setCopiedCode] = useState(null);

  useEffect(() => {
    if (!open || !device) {
      setOrders([]);
      setSearch('');
      return;
    }
    const devId = device.device_id || device.id;
    setLoading(true);
    AdminService.getDeviceOrders(devId, 100).then(res => {
      if (res.success && Array.isArray(res.data)) {
        setOrders(res.data);
      } else {
        setOrders([]);
      }
      setLoading(false);
    }).catch(err => {
      console.warn('[DeviceOrdersModal] Load error:', err);
      setOrders([]);
      setLoading(false);
    });
  }, [open, device]);

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(key);
    setTimeout(() => setCopiedCode(null), 1500);
  };

  const filteredOrders = useMemo(() => {
    if (!search.trim()) return orders;
    const q = search.toLowerCase().trim();
    return orders.filter(o =>
      (o.order_code || '').toLowerCase().includes(q) ||
      (o.tracking_code || '').toLowerCase().includes(q) ||
      (o.name || o.receiver_name || '').toLowerCase().includes(q) ||
      (o.phone || '').includes(q)
    );
  }, [orders, search]);

  const formatVND = (num) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(num) || 0);
  };

  const formatDate = (isoStr) => {
    if (!isoStr) return '—';
    try {
      const d = new Date(isoStr);
      return `${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ${d.toLocaleDateString('vi-VN')}`;
    } catch {
      return isoStr;
    }
  };

  const maskPhone = (phone) => {
    if (!phone) return '—';
    const clean = String(phone).trim().replace(/\s+/g, '');
    if (clean.length < 7) return clean.slice(0, 2) + '***' + clean.slice(-2);
    return clean.slice(0, 4) + '***' + clean.slice(-3);
  };

  const maskCustomerName = (name) => {
    if (!name) return 'Khách hàng';
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      const w = parts[0];
      return w.length > 2 ? w.slice(0, 1) + '***' + w.slice(-1) : w + '*';
    }
    const last = parts[parts.length - 1];
    const mid = parts.slice(1, -1).map(p => p[0] + '.').join(' ');
    const maskedLast = last.length > 1 ? last.slice(0, 1) + '*'.repeat(Math.min(3, last.length - 1)) : last + '*';
    return [parts[0], mid, maskedLast].filter(Boolean).join(' ');
  };

  if (!open || !device) return null;

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      title={`Lịch Sử Đơn Bóc Tách: ${device.device_name || 'Thiết bị'}`}
      maxWidth="1000px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Device Info Summary Box */}
        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: 10,
          padding: '12px 16px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 16,
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: '#eff6ff', color: '#2563eb',
              display: 'grid', placeItems: 'center'
            }}>
              <Laptop size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14, color: '#0f172a' }}>
                {device.device_name || 'Trình duyệt Web'}
              </div>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                {device.email || '—'} • Cửa hàng: <strong style={{ color: '#0369a1' }}>{device.shop_name || 'Chưa gắn'}</strong>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                Tổng Đơn Bóc Tách
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#16a34a' }}>
                {orders.length} đơn
              </div>
            </div>
          </div>
        </div>

        {/* Filter Input */}
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Tìm theo mã đơn, mã vận đơn, tên khách, số điện thoại..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '9px 12px 9px 36px',
              border: '1px solid #cbd5e1',
              borderRadius: 8,
              fontSize: 13,
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Table of Orders */}
        <div style={{
          maxHeight: '400px',
          overflowY: 'auto',
          border: '1px solid #e2e8f0',
          borderRadius: 8
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, textAlign: 'left' }}>
            <thead style={{ background: '#f8fafc', position: 'sticky', top: 0, zIndex: 1, borderBottom: '1px solid #e2e8f0' }}>
              <tr style={{ color: '#475569', fontWeight: 600 }}>
                <th style={{ padding: '10px 14px' }}>Mã đơn / MVĐ</th>
                <th style={{ padding: '10px 14px' }}>Người nhận</th>
                <th style={{ padding: '10px 14px', textAlign: 'right' }}>Tiền COD</th>
                <th style={{ padding: '10px 14px' }}>Bưu cục</th>
                <th style={{ padding: '10px 14px' }}>Thời gian gửi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ padding: 36, textAlign: 'center', color: '#64748b' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <RefreshCw size={16} className="dash-spin" /> Đang tải lịch sử đơn...
                    </div>
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 36, textAlign: 'center', color: '#94a3b8' }}>
                    <AlertCircle size={28} style={{ opacity: 0.5, margin: '0 auto 8px', display: 'block' }} />
                    <p style={{ margin: 0, fontWeight: 500 }}>
                      {search ? 'Không tìm thấy đơn hàng phù hợp từ khóa.' : 'Chưa có đơn hàng nào được xử lý bởi thiết bị này.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredOrders.map(o => {
                  const key = o.id || o.order_code;
                  return (
                    <tr key={key} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span>{o.order_code || '—'}</span>
                          {o.order_code && (
                            <button
                              onClick={() => copyToClipboard(o.order_code, `code_${key}`)}
                              style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', color: '#64748b' }}
                            >
                              {copiedCode === `code_${key}` ? <Check size={12} color="#16a34a" /> : <Copy size={12} />}
                            </button>
                          )}
                        </div>
                        {o.tracking_code && (
                          <div style={{ fontSize: 11, color: '#2563eb', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                            <span>MVĐ: {o.tracking_code}</span>
                            <button
                              onClick={() => copyToClipboard(o.tracking_code, `track_${key}`)}
                              style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', color: '#64748b' }}
                            >
                              {copiedCode === `track_${key}` ? <Check size={12} color="#16a34a" /> : <Copy size={12} />}
                            </button>
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ fontWeight: 600, color: '#1e293b' }}>
                          {maskCustomerName(o.name || o.receiver_name || o.customer_name)}
                        </div>
                        {o.phone && (
                          <div style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2, fontFamily: 'monospace' }}>
                            <span title="Số điện thoại được che bảo vệ dữ liệu cá nhân">🔒 {maskPhone(o.phone)}</span>
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                        {formatVND(o.cod_amount || o.cod)}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{
                          background: '#f1f5f9', color: '#334155',
                          padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700
                        }}>
                          {(o.platform || o.carrier_account || 'VNPost').toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', color: '#64748b', fontSize: 11.5 }}>
                        {formatDate(o.created_at || o.submitted_at)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8 }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 18px',
              fontSize: 13,
              fontWeight: 700,
              background: '#f1f5f9',
              color: '#334155',
              border: '1px solid #cbd5e1',
              borderRadius: 8,
              cursor: 'pointer'
            }}
          >
            Đóng
          </button>
        </div>
      </div>
    </AdminModal>
  );
}
