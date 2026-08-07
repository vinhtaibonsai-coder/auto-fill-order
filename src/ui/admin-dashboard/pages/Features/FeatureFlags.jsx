import React, { useState } from 'react';

export default function FeatureFlags() {
  const [flags, setFlags] = useState([
    { key: 'address_engine_v2', desc: 'Thuật toán chuẩn hóa địa chỉ HC-VN v2.0 (tốc độ +30%)', enabled: true, rollout: 100 },
    { key: 'ai_vision_ocr', desc: 'Bóc tách hình ảnh bill / ảnh tin nhắn qua AI Vision', enabled: true, rollout: 50 },
    { key: 'sync_v2_realtime', desc: 'Đồng bộ đơn hàng Realtime qua Supabase Broadcast', enabled: true, rollout: 25 },
    { key: 'carrier_ghtk_v2', desc: 'Bộ adapter điền tự động nhà vận chuyển GHTK v2', enabled: false, rollout: 0 },
    { key: 'auto_submit_safety', desc: 'Tự động Submit đơn hàng sau khi điền thành công', enabled: false, rollout: 0 }
  ]);

  const toggleFlag = (key) => {
    setFlags(prev => prev.map(f => f.key === key ? { ...f, enabled: !f.enabled } : f));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <h2 style={{ margin: 0 }}>🚩 Feature Flags & Rollout Control</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '4px 0 0 0' }}>
          Điều phối việc phát hành tính năng mới theo từng % người dùng hoặc theo cấp độ gói cước SaaS.
        </p>
      </div>

      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
              <th style={{ padding: '12px 16px' }}>Feature Key</th>
              <th style={{ padding: '12px 16px' }}>Mô tả tính năng</th>
              <th style={{ padding: '12px 16px' }}>Tỷ lệ Rollout</th>
              <th style={{ padding: '12px 16px' }}>Trạng thái</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>Bật / Tắt</th>
            </tr>
          </thead>
          <tbody>
            {flags.map(flag => (
              <tr key={flag.key} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '12px 16px', fontWeight: 600, fontFamily: 'monospace', color: '#1e293b' }}>{flag.key}</td>
                <td style={{ padding: '12px 16px', color: '#475569' }}>{flag.desc}</td>
                <td style={{ padding: '12px 16px', fontWeight: 600, color: '#2563eb' }}>{flag.rollout}% Rollout</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ background: flag.enabled ? '#dcfce7' : '#fee2e2', color: flag.enabled ? '#15803d' : '#991b1b', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                    {flag.enabled ? 'ACTIVE' : 'DISABLED'}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                  <button
                    onClick={() => toggleFlag(flag.key)}
                    style={{
                      background: flag.enabled ? '#fee2e2' : '#dcfce7',
                      color: flag.enabled ? '#991b1b' : '#15803d',
                      border: 'none', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, fontSize: '11px'
                    }}
                  >
                    {flag.enabled ? 'Tắt tính năng' : 'Kích hoạt'}
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
