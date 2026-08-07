import React, { useState, useEffect } from 'react';

export default function ConfidenceReview({ data, onConfirm, onCancel }) {
  const [formData, setFormData] = useState({
    name: data?.name || '',
    phone: data?.phone || '',
    address: data?.address || '',
    ward: data?.ward || 'Phường Bến Nghé',
    province: data?.province || 'TP. Hồ Chí Minh'
  });

  const confidenceScores = {
    name: { score: 98, ok: true },
    phone: { score: 99, ok: true },
    address: { score: 83, ok: false },
    ward: { score: 96, ok: true },
    province: { score: 99, ok: true }
  };

  useEffect(() => {
    setFormData({
      name: data?.name || '',
      phone: data?.phone || '',
      address: data?.address || '',
      ward: data?.ward || 'Phường Bến Nghé',
      province: data?.province || 'TP. Hồ Chí Minh'
    });
  }, [data]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleConfirm = () => {
    onConfirm(formData);
  };

  return (
    <div className="af-panel-content">
      <div style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#b45309', padding: '8px 12px', borderRadius: '6px', fontSize: '11px', marginBottom: '10px' }}>
        ⚠️ Đánh giá độ tin cậy AI: Hãy kiểm tra kỹ trường có đánh dấu ⚠ trước khi điền.
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b' }}>
            <span>Tên người nhận</span>
            <span style={{ color: '#16a34a', fontWeight: 600 }}>98% ✓</span>
          </div>
          <input 
            type="text" 
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            style={{ padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b' }}>
            <span>Số điện thoại</span>
            <span style={{ color: '#16a34a', fontWeight: 600 }}>99% ✓</span>
          </div>
          <input 
            type="text" 
            value={formData.phone}
            onChange={(e) => handleChange('phone', e.target.value)}
            style={{ padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b' }}>
            <span>Địa chỉ thô</span>
            <span style={{ color: '#d97706', fontWeight: 600 }}>83% ⚠</span>
          </div>
          <textarea 
            value={formData.address}
            onChange={(e) => handleChange('address', e.target.value)}
            style={{ padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px', minHeight: '44px', resize: 'vertical' }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b' }}>
              <span>Phường / Xã</span>
              <span style={{ color: '#16a34a', fontWeight: 600 }}>96% ✓</span>
            </div>
            <input 
              type="text" 
              value={formData.ward}
              onChange={(e) => handleChange('ward', e.target.value)}
              style={{ padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px', width: '100%', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b' }}>
              <span>Tỉnh / Thành</span>
              <span style={{ color: '#16a34a', fontWeight: 600 }}>99% ✓</span>
            </div>
            <input 
              type="text" 
              value={formData.province}
              onChange={(e) => handleChange('province', e.target.value)}
              style={{ padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px', width: '100%', boxSizing: 'border-box' }}
            />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
        <button style={{ flex: 1, padding: '8px', background: 'white', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', color: '#475569', fontSize: '12px' }} onClick={onCancel}>
          Hủy
        </button>
        <button className="af-btn-primary" style={{ flex: 1, padding: '8px', fontSize: '12px' }} onClick={handleConfirm}>
          ⚡ Điền đơn ngay
        </button>
      </div>
    </div>
  );
}
