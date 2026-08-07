import React from 'react';

export default function SupportTickets() {
  const tickets = [
    { id: 'TK-101', shop: 'Shop Quần Áo Flash', subject: 'Cần hỗ trợ tích hợp thêm nhà vận chuyển GHTK', category: 'CARRIER', priority: 'HIGH', status: 'OPEN', created: '10 phút trước' },
    { id: 'TK-102', shop: 'Mỹ Phẩm Auth VN', subject: 'Lỗi bóc tách ảnh đơn hàng bị nhầm Phường/Xã', category: 'ADDRESS', priority: 'MEDIUM', status: 'IN_PROGRESS', created: '1 giờ trước' },
    { id: 'TK-103', shop: 'Nông Sản Sạch HCM', subject: 'Hỏi về việc thanh toán nâng cấp gói Pro bằng Chuyển khoản', category: 'BILLING', priority: 'NORMAL', status: 'RESOLVED', created: 'Hôm qua' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <h2 style={{ margin: 0 }}>🎧 Support Center & Ticket Management</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '4px 0 0 0' }}>
          Tiếp nhận và xử lý sự cố kĩ thuật, yêu cầu nâng cấp gói cước và phản hồi từ các Shop.
        </p>
      </div>

      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
              <th style={{ padding: '12px 16px' }}>Mã Ticket</th>
              <th style={{ padding: '12px 16px' }}>Shop yêu cầu</th>
              <th style={{ padding: '12px 16px' }}>Tiêu đề</th>
              <th style={{ padding: '12px 16px' }}>Phân loại</th>
              <th style={{ padding: '12px 16px' }}>Ưu tiên</th>
              <th style={{ padding: '12px 16px' }}>Trạng thái</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map(t => (
              <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '12px 16px', fontWeight: 700, fontFamily: 'monospace' }}>{t.id}</td>
                <td style={{ padding: '12px 16px', fontWeight: 600 }}>{t.shop}</td>
                <td style={{ padding: '12px 16px', color: '#334155' }}>{t.subject}</td>
                <td style={{ padding: '12px 16px', color: '#64748b' }}>{t.category}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{
                    color: t.priority === 'HIGH' ? '#dc2626' : '#2563eb',
                    fontWeight: 600, fontSize: '11px'
                  }}>
                    {t.priority}
                  </span>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{
                    background: t.status === 'OPEN' ? '#fee2e2' : t.status === 'IN_PROGRESS' ? '#fffbeb' : '#dcfce7',
                    color: t.status === 'OPEN' ? '#991b1b' : t.status === 'IN_PROGRESS' ? '#b45309' : '#15803d',
                    padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600
                  }}>
                    {t.status}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                  <button style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}>
                    Xử lý
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
