import React, { useState } from 'react';

export default function Subscription() {
  const [currentPlan, setCurrentPlan] = useState('STARTER');

  const plans = [
    { code: 'FREE', name: 'Miễn phí', price: '0 đ/tháng', users: '1 Staff', devices: '1 Thiết bị', ai: '100 AI/tháng', popular: false },
    { code: 'STARTER', name: 'Starter', price: '199.000 đ/tháng', users: '3 Staff', devices: '2 Thiết bị', ai: '1.000 AI/tháng', popular: true },
    { code: 'PRO', name: 'Pro SaaS', price: '499.000 đ/tháng', users: '10 Staff', devices: '5 Thiết bị', ai: '5.000 AI/tháng', popular: false },
    { code: 'BUSINESS', name: 'Business', price: '999.000 đ/tháng', users: '30 Staff', devices: '15 Thiết bị', ai: '20.000 AI/tháng', popular: false },
    { code: 'ENTERPRISE', name: 'Enterprise', price: 'Liên hệ', users: 'Không giới hạn', devices: 'Không giới hạn', ai: 'Custom SLA', popular: false },
  ];

  const handleSelectPlan = (code) => {
    if (code === currentPlan) return;
    if (confirm(`Bạn có muốn chuyển sang gói cước ${code}?`)) {
      setCurrentPlan(code);
      alert(`Đã kích hoạt yêu cầu nâng cấp gói ${code}!`);
    }
  };

  return (
    <div style={{ maxWidth: '1100px' }}>
      <h2 className="page-title">💳 Quản lý Gói cước & Hạn mức (Commercial Subscription)</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
        Lựa chọn gói cước phù hợp với quy mô cửa hàng của bạn. Nâng cấp bất cứ lúc nào để tăng hạn mức AI và số lượng nhân sự.
      </p>

      {/* Current Active Plan Banner */}
      <div className="card" style={{ marginBottom: '24px', borderLeft: '6px solid #2563eb', background: '#f8fafc' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>GÓI CƯỚC HIỆN TẠI</div>
            <h3 style={{ margin: '4px 0', fontSize: '20px', color: '#0f172a' }}>Gói {currentPlan} — Đang hoạt động</h3>
            <div style={{ fontSize: '13px', color: '#475569' }}>Hạn dùng đến: <strong>04/09/2026</strong> (Tự động gia hạn)</div>
          </div>
          <div style={{ display: 'flex', gap: '24px', textAlign: 'right' }}>
            <div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>AI Quota tháng này</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#2563eb' }}>480 / 1.000</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>Thiết bị active</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#16a34a' }}>2 / 2</div>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {plans.map(p => {
          const isCurrent = p.code === currentPlan;
          return (
            <div
              key={p.code}
              className="card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justify: 'space-between',
                padding: '20px 16px',
                border: isCurrent ? '2px solid #2563eb' : '1px solid #e2e8f0',
                background: p.popular ? '#f0f7ff' : '#ffffff',
                position: 'relative'
              }}
            >
              {p.popular && (
                <span style={{ position: 'absolute', top: '-10px', right: '12px', background: '#2563eb', color: '#fff', fontSize: '10px', padding: '2px 8px', borderRadius: '10px', fontWeight: 600 }}>
                  KHUYÊN DÙNG
                </span>
              )}
              <div>
                <h4 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>{p.name}</h4>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#2563eb', margin: '8px 0 16px 0' }}>{p.price}</div>
                <ul style={{ paddingLeft: '16px', margin: 0, fontSize: '12px', color: '#475569', lineHeight: '1.8' }}>
                  <li>{p.users}</li>
                  <li>{p.devices}</li>
                  <li>{p.ai}</li>
                  <li>Hỗ trợ 24/7</li>
                </ul>
              </div>

              <button
                onClick={() => handleSelectPlan(p.code)}
                style={{
                  marginTop: '20px',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: isCurrent ? '1px solid #94a3b8' : 'none',
                  background: isCurrent ? '#e2e8f0' : '#2563eb',
                  color: isCurrent ? '#475569' : '#ffffff',
                  fontWeight: 600,
                  fontSize: '12px',
                  cursor: isCurrent ? 'default' : 'pointer'
                }}
              >
                {isCurrent ? 'Đang sử dụng' : 'Nâng cấp ngay'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
