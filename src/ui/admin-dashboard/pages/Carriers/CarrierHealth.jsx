import React from 'react';

export default function CarrierHealth() {
  const carriers = [
    { code: 'VNPOST', name: 'VNPost (Bưu điện Việt Nam)', status: 'HEALTHY', latency: '120ms', fillRate: '98.5%', domVersion: 'v2.4' },
    { code: 'JT', name: 'J&T Express', status: 'HEALTHY', latency: '95ms', fillRate: '99.1%', domVersion: 'v1.9' },
    { code: 'GHN', name: 'Giao Hàng Nhanh (GHN)', status: 'DOM_CHANGED_ALERT', latency: '310ms', fillRate: '91.2%', domVersion: 'v1.2 (Cần update)' },
    { code: 'GHTK', name: 'Giao Hàng Tiết Kiệm (GHTK)', status: 'HEALTHY', latency: '140ms', fillRate: '97.8%', domVersion: 'v2.1' },
    { code: 'VIETTEL', name: 'Viettel Post', status: 'HEALTHY', latency: '110ms', fillRate: '98.0%', domVersion: 'v2.0' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <h2 style={{ margin: 0 }}>🚚 Carrier Integrations & DOM Health Monitor</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '4px 0 0 0' }}>
          Giám sát trạng thái kết nối và phát hiện tự động khi DOM website của Nhà vận chuyển có sự thay đổi giao diện.
        </p>
      </div>

      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
              <th style={{ padding: '12px 16px' }}>Nhà vận chuyển</th>
              <th style={{ padding: '12px 16px' }}>Trạng thái DOM</th>
              <th style={{ padding: '12px 16px' }}>Độ phản hồi</th>
              <th style={{ padding: '12px 16px' }}>Tỷ lệ Autofill thành công</th>
              <th style={{ padding: '12px 16px' }}>Phiên bản Adapter</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {carriers.map(c => (
              <tr key={c.code} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '12px 16px', fontWeight: 700 }}>{c.name}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{
                    background: c.status === 'HEALTHY' ? '#dcfce7' : '#fffbeb',
                    color: c.status === 'HEALTHY' ? '#15803d' : '#b45309',
                    padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600
                  }}>
                    {c.status}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', color: '#475569' }}>{c.latency}</td>
                <td style={{ padding: '12px 16px', fontWeight: 600, color: '#16a34a' }}>{c.fillRate}</td>
                <td style={{ padding: '12px 16px', color: '#64748b' }}>{c.domVersion}</td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                  <button style={{ background: 'none', border: '1px solid #cbd5e1', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>
                    Kiểm tra DOM
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
