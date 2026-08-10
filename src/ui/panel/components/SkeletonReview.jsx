import React from 'react';

export default function SkeletonReview({ rawText }) {
  return (
    <div className="af-panel-content">
      {/* Raw text input area (disabled during loading) */}
      <textarea 
        placeholder="Dán thông tin đơn hàng thô vào đây..."
        value={rawText || ''}
        disabled={true}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px', gap: '8px' }}>
        <button className="af-btn-primary" disabled={true} style={{ opacity: 0.8 }}>
          <span>⚡</span> Tách Đơn
        </button>
        <button className="af-btn-primary" disabled={true} style={{ background: '#3b82f6', opacity: 0.8 }}>
          <span>📋</span> Dán
        </button>
        <button className="af-btn-delete" disabled={true} style={{ opacity: 0.8 }}>
          <span>🗑️</span> Xóa
        </button>
      </div>

      <div style={{ border: '1px solid #bbf7d0', borderRadius: '10px', padding: '12px', marginTop: '4px' }}>
        <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '12px' }}>
          PHÂN TÍCH DỮ LIỆU <span style={{ textTransform: 'none', fontWeight: 400 }}>(đang bóc tách...)</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
          <div className="af-grid-item">
            <div className="af-grid-item-label">👤 KHÁCH HÀNG</div>
            <div className="skeleton-box skeleton-text" style={{ width: '80%', marginTop: '4px', marginBottom: '0' }}></div>
          </div>
          <div className="af-grid-item">
            <div className="af-grid-item-label">📞 SỐ ĐIỆN THOẠI</div>
            <div className="skeleton-box skeleton-text" style={{ width: '90%', marginTop: '4px', marginBottom: '0' }}></div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
          <div className="af-grid-item">
            <div className="af-grid-item-label">▦ MÃ ĐƠN HÀNG</div>
            <div className="skeleton-box skeleton-text" style={{ width: '60%', marginTop: '4px', marginBottom: '0' }}></div>
          </div>
          <div className="af-grid-item">
            <div className="af-grid-item-label">📝 GHI CHÚ</div>
            <div className="skeleton-box skeleton-text" style={{ width: '80%', marginTop: '4px', marginBottom: '0' }}></div>
          </div>
        </div>

        <div className="af-grid-item" style={{ marginBottom: '8px' }}>
          <div className="af-grid-item-label">📍 ĐỊA CHỈ NHẬN HÀNG</div>
          <div className="skeleton-box skeleton-text" style={{ width: '100%', marginTop: '4px' }}></div>
          <div className="skeleton-box skeleton-text" style={{ width: '70%', marginBottom: '0' }}></div>
        </div>

        <div className="af-grid-item pink" style={{ marginBottom: '12px', display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="af-grid-item-label" style={{ color: '#be123c', fontSize: '12px', textTransform: 'none' }}>Thu hộ COD</div>
          <div className="skeleton-box skeleton-text" style={{ width: '80px', height: '16px', marginBottom: '0' }}></div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <button className="af-btn-fill" disabled={true} style={{ opacity: 0.7 }}>
          <span>↓</span> Nhập đơn
        </button>
        <button className="af-btn-save" disabled={true} style={{ opacity: 0.7 }}>
          <span>💾</span> Lưu đơn
        </button>
      </div>
      <button className="af-btn-print" style={{ marginTop: '0px', opacity: 0.7 }} disabled={true}>
        <span>🖨️</span> In đơn
      </button>
    </div>
  );
}
