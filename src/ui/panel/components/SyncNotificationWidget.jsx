import React from 'react';

export default function SyncNotificationWidget() {
  const notifications = [
    { id: 1, title: 'AI Quota Warning', type: 'warning', text: 'Gói Starter sắp đạt 80% lượt bóc tách AI.', time: '10 phút trước' },
    { id: 2, title: 'Cloud Sync', type: 'info', text: 'Đã tự động đồng bộ 5 đơn mới về Cloud.', time: '30 phút trước' },
    { id: 3, title: 'Carrier Update', type: 'success', text: 'VNPost selector đã được cập nhật v2.4.', time: '1 giờ trước' }
  ];

  return (
    <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '8px 10px', borderRadius: '6px', color: '#065f46' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>🟢</span>
          <span style={{ fontWeight: 600 }}>Cloud Connected</span>
        </div>
        <span style={{ fontSize: '11px', color: '#047857' }}>Đồng bộ thời gian thực</span>
      </div>

      <div style={{ fontWeight: 600, color: '#334155', marginTop: '4px' }}>Thông báo mới nhất</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {notifications.map(item => (
          <div key={item.id} style={{ background: '#f8fafc', padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: item.type === 'warning' ? '#b45309' : '#0f172a' }}>
              <span>{item.title}</span>
              <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 400 }}>{item.time}</span>
            </div>
            <div style={{ color: '#475569', fontSize: '11px', marginTop: '2px' }}>{item.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
