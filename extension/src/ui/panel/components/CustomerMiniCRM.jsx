import React from 'react';

export default function CustomerMiniCRM({ phone, customerData }) {
  const mockCustomer = customerData || {
    name: 'Nguyễn Văn An',
    phone: phone || '0901234567',
    address: '123 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
    orderCount: 8,
    totalSpent: '4.250.000 đ',
    lastOrderDate: '02/08/2026',
    notes: 'Khách quen, hay chọn giao giờ hành chính, gọi trước khi giao 15p.'
  };

  return (
    <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <span style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a' }}>{mockCustomer.name}</span>
          <span style={{ background: '#dbeafe', color: '#1d4ed8', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 600 }}>VIP Customer</span>
        </div>
        <div style={{ color: '#475569', marginBottom: '4px' }}>📞 {mockCustomer.phone}</div>
        <div style={{ color: '#64748b', fontSize: '11px' }}>📍 {mockCustomer.address}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', textAlign: 'center' }}>
        <div style={{ background: '#f1f5f9', padding: '6px', borderRadius: '6px' }}>
          <div style={{ fontSize: '10px', color: '#64748b' }}>Tổng đơn</div>
          <div style={{ fontWeight: 700, color: '#0f172a' }}>{mockCustomer.orderCount}</div>
        </div>
        <div style={{ background: '#f1f5f9', padding: '6px', borderRadius: '6px' }}>
          <div style={{ fontSize: '10px', color: '#64748b' }}>Tổng chi</div>
          <div style={{ fontWeight: 700, color: '#16a34a', fontSize: '11px' }}>{mockCustomer.totalSpent}</div>
        </div>
        <div style={{ background: '#f1f5f9', padding: '6px', borderRadius: '6px' }}>
          <div style={{ fontSize: '10px', color: '#64748b' }}>Đơn cuối</div>
          <div style={{ fontWeight: 600, color: '#475569', fontSize: '10px' }}>{mockCustomer.lastOrderDate}</div>
        </div>
      </div>

      <div style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: '8px', borderRadius: '6px', color: '#92400e', fontSize: '11px' }}>
        📌 <strong>Ghi chú:</strong> {mockCustomer.notes}
      </div>
    </div>
  );
}
