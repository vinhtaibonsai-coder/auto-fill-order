import React from 'react';

export default function SkeletonReview() {
  return (
    <div className="af-panel-content">
      {/* Skeleton Header / Alert area */}
      <div className="skeleton-box" style={{ width: '100%', height: '36px', borderRadius: '6px', marginBottom: '4px' }}></div>
      
      {/* Top row: Name and Phone */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <div className="af-grid-item">
          <div className="af-grid-item-label">
            <span>👤</span> NGƯỜI NHẬN
          </div>
          <div className="skeleton-box skeleton-text" style={{ width: '80%', marginTop: '4px' }}></div>
        </div>
        <div className="af-grid-item">
          <div className="af-grid-item-label">
            <span>📞</span> ĐIỆN THOẠI
          </div>
          <div className="skeleton-box skeleton-text" style={{ width: '90%', marginTop: '4px' }}></div>
        </div>
      </div>

      {/* Address */}
      <div className="af-grid-item">
        <div className="af-grid-item-label">
          <span>📍</span> ĐỊA CHỈ NHẬN HÀNG
        </div>
        <div className="skeleton-box skeleton-text" style={{ width: '100%', marginTop: '4px' }}></div>
        <div className="skeleton-box skeleton-text" style={{ width: '70%' }}></div>
      </div>

      {/* Bottom row: Extra Note and COD */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: '8px' }}>
        <div className="af-grid-item">
          <div className="af-grid-item-label">
            <span>📝</span> GHI CHÚ
          </div>
          <div className="skeleton-box skeleton-text" style={{ width: '80%', marginTop: '4px' }}></div>
        </div>
        <div className="af-grid-item pink">
          <div className="af-grid-item-label">
            <span>💰</span> THU HỘ (COD)
          </div>
          <div className="skeleton-box skeleton-text" style={{ width: '100%', marginTop: '4px', height: '16px' }}></div>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '4px' }}>
        <div className="skeleton-box" style={{ height: '38px', borderRadius: '6px' }}></div>
        <div className="skeleton-box" style={{ height: '38px', borderRadius: '6px' }}></div>
      </div>
    </div>
  );
}
