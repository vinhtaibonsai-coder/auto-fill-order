import React, { useState, useEffect } from 'react';
import { OrderStorage } from '../../../../application/storage.js';

export default function OrderList() {
  const [activeTab, setActiveTab] = useState('draft');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadOrders();
  }, [activeTab]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      if (activeTab === 'draft') {
        const data = await OrderStorage.getOrders().catch(() => []);
        setOrders(data);
      } else {
        const data = await OrderStorage.getSubmittedOrders().catch(() => []);
        setOrders(data);
      }
    } catch (err) {
      console.error("Lỗi khi tải đơn hàng:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Bạn có chắc muốn xóa đơn hàng này?')) return;
    try {
      if (activeTab === 'draft') {
        await OrderStorage.deleteOrder(id);
      } else {
        await OrderStorage.deleteSubmittedOrder(id);
      }
      setOrders(orders.filter(o => o.id !== id));
    } catch (err) {
      alert('Lỗi khi xóa: ' + err.message);
    }
  };

  const filteredOrders = orders.filter(o => {
    const term = search.toLowerCase();
    const phone = o.parsedData?.phone || o.phone || '';
    const name = o.parsedData?.name || o.name || '';
    return phone.toLowerCase().includes(term) || name.toLowerCase().includes(term);
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 className="page-title" style={{ marginBottom: 0 }}>Quản lý Đơn hàng</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input 
            type="text" 
            placeholder="Tìm số điện thoại, tên..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '6px', width: '250px' }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
        <button 
          onClick={() => setActiveTab('draft')}
          style={{ 
            background: 'none', border: 'none', cursor: 'pointer', fontSize: '15px', fontWeight: activeTab === 'draft' ? 700 : 500,
            color: activeTab === 'draft' ? 'var(--primary)' : 'var(--text-muted)'
          }}
        >
          📝 Đơn nháp ({activeTab === 'draft' ? orders.length : '...'})
        </button>
        <button 
          onClick={() => setActiveTab('submitted')}
          style={{ 
            background: 'none', border: 'none', cursor: 'pointer', fontSize: '15px', fontWeight: activeTab === 'submitted' ? 700 : 500,
            color: activeTab === 'submitted' ? 'var(--success)' : 'var(--text-muted)'
          }}
        >
          ✅ Đã lên đơn ({activeTab === 'submitted' ? orders.length : '...'})
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Đang tải dữ liệu...</div>
        ) : filteredOrders.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Không có đơn hàng nào.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '13px' }}>Thời gian</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '13px' }}>Khách hàng</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '13px' }}>Địa chỉ</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '13px' }}>Hãng VC</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '13px', textAlign: 'right' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map(order => (
                <tr key={order.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 16px', fontSize: '13px' }}>
                    {new Date(order.createdAt).toLocaleString('vi-VN')}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 600 }}>{order.parsedData?.name || order.name || 'Không có tên'}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{order.parsedData?.phone || order.phone}</div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', maxWidth: '300px' }}>
                    {order.parsedData?.address || order.address || order.rawText || 'Không có địa chỉ'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ 
                        padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600,
                        background: order.platform === 'vnpost' ? '#e0f2fe' : '#fee2e2',
                        color: order.platform === 'vnpost' ? '#0369a1' : '#be123c',
                        width: 'fit-content'
                      }}>
                        {order.platform === 'vnpost' ? 'VNPost' : (order.platform === 'jt' ? 'J&T Express' : 'Khác')}
                      </span>
                      {order.carrierAccount && (
                        <span style={{ fontSize: '11px', color: '#0284c7', fontWeight: 600 }} title="Tài khoản lên đơn">
                          👤 TK: {order.carrierAccount}
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <button 
                      onClick={() => handleDelete(order.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontWeight: 600 }}
                      title="Xóa"
                    >
                      Xóa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
