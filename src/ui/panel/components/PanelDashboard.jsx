import React from 'react';

export default function PanelDashboard({ onCreateClick }) {
  return (
    <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Primary CTA */}
      <button 
        onClick={onCreateClick}
        style={{
          width: '100%',
          padding: '12px',
          background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
          color: '#ffffff',
          border: 'none',
          borderRadius: '8px',
          fontWeight: 700,
          fontSize: '14px',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(37,99,235,0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px'
        }}
      >
        <span>⚡</span> CREATE ORDER (TẠO ĐƠN NHANH)
      </button>

      {/* Metrics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '11px', color: '#64748b' }}>Đơn hôm nay</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>24</div>
        </div>
        <div style={{ background: '#ecfdf5', padding: '10px', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
          <div style={{ fontSize: '11px', color: '#047857' }}>Đã hoàn tất</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#065f46' }}>22</div>
        </div>
        <div style={{ background: '#fff1f2', padding: '10px', borderRadius: '8px', border: '1px solid #fecdd3' }}>
          <div style={{ fontSize: '11px', color: '#be123c' }}>Lỗi / Cần sửa</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#9f1239' }}>2</div>
        </div>
        <div style={{ background: '#fffbeb', padding: '10px', borderRadius: '8px', border: '1px solid #fde68a' }}>
          <div style={{ fontSize: '11px', color: '#b45309' }}>Chờ Cloud Sync</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#92400e' }}>0</div>
        </div>
      </div>

      {/* System Status Indicators */}
      <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '10px', border: '1px solid #e2e8f0' }}>
        <div style={{ fontWeight: 600, marginBottom: '6px', color: '#334155', fontSize: '12px' }}>Trạng thái hệ thống</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ color: '#64748b' }}>AI Order Parser:</span>
          <span style={{ color: '#16a34a', fontWeight: 600 }}>🟢 Hoạt động (99.8%)</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#64748b' }}>Cloud Storage:</span>
          <span style={{ color: '#16a34a', fontWeight: 600 }}>🟢 Online</span>
        </div>
      </div>
    </div>
  );
}
