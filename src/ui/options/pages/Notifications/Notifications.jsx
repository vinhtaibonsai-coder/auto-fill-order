import React from 'react';

export default function Notifications() {
  return (
    <div style={{ maxWidth: '800px' }}>
      <h2 className="page-title">Notifications & Alerts</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
        Quản lý cách hệ thống thông báo các sự kiện quan trọng của Shop.
      </p>

      <div className="card">
        <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Tùy chọn thông báo</h3>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <input type="checkbox" defaultChecked id="notif-1" style={{ width: '18px', height: '18px' }} />
          <div>
            <label htmlFor="notif-1" style={{ fontWeight: 600, display: 'block' }}>Sắp hết hạn mức AI (AI Quota Low)</label>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Cảnh báo khi số lượt bóc tách AI còn dưới 10% của tháng.</span>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <input type="checkbox" defaultChecked id="notif-2" style={{ width: '18px', height: '18px' }} />
          <div>
            <label htmlFor="notif-2" style={{ fontWeight: 600, display: 'block' }}>Lỗi hệ thống AI (AI Error)</label>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Báo đỏ khi AI Gateway không phản hồi hoặc bị sập.</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <input type="checkbox" defaultChecked id="notif-3" style={{ width: '18px', height: '18px' }} />
          <div>
            <label htmlFor="notif-3" style={{ fontWeight: 600, display: 'block' }}>Mất kết nối Máy chủ (Cloud Offline)</label>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Thông báo rớt mạng khi không thể đồng bộ dữ liệu.</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <input type="checkbox" defaultChecked id="notif-4" style={{ width: '18px', height: '18px' }} />
          <div>
            <label htmlFor="notif-4" style={{ fontWeight: 600, display: 'block' }}>Giao diện hãng cập nhật (DOM Changed)</label>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Cảnh báo khi phát hiện VNPost/J&T thay đổi giao diện làm hỏng tính năng Autofill.</span>
          </div>
        </div>
        
        <div style={{ marginTop: '24px' }}>
          <button style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>
            Lưu Cấu Hình
          </button>
        </div>
      </div>
    </div>
  );
}
