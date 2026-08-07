import React, { useState, useEffect } from 'react';
import { OrderStorage } from '../../../../application/storage.js';

export default function CustomerCRM() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      // Build CRM from submitted orders
      const orders = await OrderStorage.getSubmittedOrders().catch(() => []);
      const crmMap = new Map();

      for (const order of orders) {
        const phone = order.parsedData?.phone || order.phone;
        const name = order.parsedData?.name || order.name;
        const address = order.parsedData?.address || order.address;
        
        if (!phone) continue;

        if (crmMap.has(phone)) {
          const entry = crmMap.get(phone);
          entry.orderCount += 1;
          // Keep the latest address/name
          if (order.createdAt > entry.lastOrderAt) {
            entry.name = name || entry.name;
            entry.address = address || entry.address;
            entry.lastOrderAt = order.createdAt;
          }
        } else {
          crmMap.set(phone, {
            phone,
            name: name || 'Chưa rõ tên',
            address: address || '',
            orderCount: 1,
            firstOrderAt: order.createdAt,
            lastOrderAt: order.createdAt
          });
        }
      }

      setCustomers(Array.from(crmMap.values()).sort((a, b) => b.lastOrderAt - a.lastOrderAt));
    } catch (err) {
      console.error("Lỗi khi build CRM:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = customers.filter(c => {
    const term = search.toLowerCase();
    return c.phone.toLowerCase().includes(term) || c.name.toLowerCase().includes(term);
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 className="page-title" style={{ marginBottom: 0 }}>Quản lý Khách hàng (Mini CRM)</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input 
            type="text" 
            placeholder="Tìm theo SĐT, Tên khách..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '6px', width: '250px' }}
          />
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Đang tổng hợp dữ liệu khách hàng...</div>
        ) : filteredCustomers.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Chưa có dữ liệu khách hàng nào từ Đơn đã lên.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '13px' }}>Khách hàng</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '13px' }}>Địa chỉ mới nhất</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '13px', textAlign: 'center' }}>Số lượng Đơn</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '13px' }}>Đơn gần nhất</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map(c => (
                <tr key={c.phone} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 600 }}>{c.name}</div>
                    <div style={{ color: 'var(--primary)', fontSize: '13px', fontWeight: 600 }}>{c.phone}</div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', maxWidth: '300px' }}>
                    {c.address}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <span style={{ background: '#f1f5f9', padding: '4px 10px', borderRadius: '12px', fontWeight: 'bold' }}>
                      {c.orderCount}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-muted)' }}>
                    {new Date(c.lastOrderAt).toLocaleDateString('vi-VN')}
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
