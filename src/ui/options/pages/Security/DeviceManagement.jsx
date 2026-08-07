import React, { useState } from 'react';

export default function DeviceManagement() {
  const [devices, setDevices] = useState([
    { id: '1', name: 'Chrome - Windows Staff 01', browser: 'Chrome 127.0', ip: '113.161.40.12', lastActive: 'Vừa xong', isCurrent: true },
    { id: '2', name: 'Edge - Windows Manager', browser: 'Edge 126.0', ip: '113.161.40.15', lastActive: '2 giờ trước', isCurrent: false },
    { id: '3', name: 'Chrome - Mac Shop Owner', browser: 'Chrome 127.0', ip: '14.232.18.90', lastActive: 'Hôm qua', isCurrent: false },
  ]);

  const maxDevices = 5;

  const handleRevoke = (id) => {
    if (confirm("Bạn có chắc chắn muốn đăng xuất thiết bị này khỏi Shop?")) {
      setDevices(prev => prev.filter(d => d.id !== id));
    }
  };

  return (
    <div className="card" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div>
          <h3 style={{ margin: 0 }}>💻 Thiết bị đang kết nối (Device Management)</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Quản lý danh sách trình duyệt và thiết bị nhân viên được cấp quyền truy cập Extension.
          </p>
        </div>
        <div style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}>
          Hạn mức: {devices.length} / {maxDevices} thiết bị
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {devices.map(device => (
          <div key={device.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '14px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>{device.name}</span>
                {device.isCurrent && (
                  <span style={{ background: '#dcfce7', color: '#15803d', fontSize: '10px', padding: '2px 6px', borderRadius: '4px' }}>Thiết bị này</span>
                )}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                {device.browser} • IP: {device.ip} • Hoạt động: {device.lastActive}
              </div>
            </div>

            <div>
              {!device.isCurrent && (
                <button
                  onClick={() => handleRevoke(device.id)}
                  style={{ background: '#fee2e2', color: '#991b1b', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                >
                  Thu hồi (Revoke)
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
