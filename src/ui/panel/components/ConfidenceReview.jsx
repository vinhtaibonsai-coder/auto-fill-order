import React, { useState, useEffect } from 'react';

function formatVND(value) {
  if (value === undefined || value === null || value === '') return '0 đ';
  const cleanValue = String(value).replace(/\D/g, '');
  if (!cleanValue) return '0 đ';
  const num = parseInt(cleanValue, 10);
  return num.toLocaleString('vi-VN') + ' đ';
}

export default function ConfidenceReview({ data, rawText, onParse, onConfirm, onCancel }) {
  const [formData, setFormData] = useState({
    name: data?.name || '',
    phone: data?.phone || '',
    address: data?.address || '',
    orderCode: data?.orderCode || '',
    codAmount: data?.codAmount || '',
    extraNote: data?.extraNote || '',
    warning: data?.warning || '',
    suggestedAddress: data?.suggestedAddress || '',
    confidence: data?.confidence || 95,
    confidenceThreshold: data?.confidenceThreshold || 90
  });
  
  const [currentText, setCurrentText] = useState(rawText || '');

  useEffect(() => {
    setFormData({
      name: data?.name || '',
      phone: data?.phone || '',
      address: data?.address || '',
      orderCode: data?.orderCode || '',
      codAmount: data?.codAmount || '',
      extraNote: data?.extraNote || '',
      warning: data?.warning || '',
      suggestedAddress: data?.suggestedAddress || '',
      confidence: data?.confidence || 95,
      confidenceThreshold: data?.confidenceThreshold || 90
    });
    setCurrentText(rawText || '');
  }, [data, rawText]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleConfirm = () => {
    onConfirm(formData);
  };

  return (
    <div className="af-panel-content">
      {/* Raw text input area for editing and re-parsing */}
      <textarea 
        placeholder="Dán thông tin đơn hàng thô vào đây...&#10;(Ctrl+Enter để tách nhanh)"
        value={currentText}
        onChange={e => setCurrentText(e.target.value)}
        onKeyDown={(e) => {
          if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            if (currentText.trim()) onParse(currentText);
          }
        }}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: '10px' }}>
        <button 
          className="af-btn-primary" 
          onClick={() => onParse(currentText)}
          disabled={!currentText.trim()}
        >
          <span>⚡</span> Tách Đơn Tự Động
        </button>
        <button className="af-btn-delete" onClick={() => { setCurrentText(''); onCancel(); }}>
          <span>🗑️</span> Xóa
        </button>
      </div>

      <div style={{ border: '1px solid #bbf7d0', borderRadius: '10px', padding: '12px', marginTop: '4px' }}>
        <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '12px' }}>
          PHÂN TÍCH DỮ LIỆU <span style={{ textTransform: 'none', fontWeight: 400 }}>(bấm vào ô để sửa nếu sai)</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
          <div className="af-grid-item">
            <div className="af-grid-item-label">👤 KHÁCH HÀNG</div>
            <input 
              value={formData.name} 
              onChange={e => handleChange('name', e.target.value)} 
              className="af-grid-item-value" 
              style={{ border: 'none', background: 'transparent', outline: 'none', padding: 0, width: '100%' }} 
            />
          </div>
          <div className="af-grid-item">
            <div className="af-grid-item-label">📞 SỐ ĐIỆN THOẠI</div>
            <input 
              value={formData.phone} 
              onChange={e => handleChange('phone', e.target.value)} 
              className="af-grid-item-value" 
              style={{ border: 'none', background: 'transparent', outline: 'none', padding: 0, width: '100%' }} 
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
          <div className="af-grid-item">
            <div className="af-grid-item-label">▦ MÃ ĐƠN HÀNG</div>
            <input 
              value={formData.orderCode} 
              onChange={e => handleChange('orderCode', e.target.value)} 
              className="af-grid-item-value" 
              style={{ border: 'none', background: 'transparent', outline: 'none', padding: 0, width: '100%' }} 
            />
          </div>
          <div className="af-grid-item">
            <div className="af-grid-item-label">📝 GHI CHÚ</div>
            <input 
              value={formData.extraNote} 
              onChange={e => handleChange('extraNote', e.target.value)} 
              className="af-grid-item-value" 
              style={{ border: 'none', background: 'transparent', outline: 'none', padding: 0, width: '100%' }} 
            />
          </div>
        </div>

        <div className="af-grid-item" style={{ marginBottom: '8px' }}>
          <div className="af-grid-item-label">📍 ĐỊA CHỈ NHẬN HÀNG</div>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <textarea 
              value={formData.address} 
              onChange={e => handleChange('address', e.target.value)} 
              className="af-grid-item-value" 
              style={{ border: 'none', background: 'transparent', outline: 'none', padding: 0, width: '100%', resize: 'none', minHeight: '40px' }} 
            />
            <button className="af-copy-btn">📋</button>
          </div>
        </div>

        <div className="af-grid-item pink" style={{ marginBottom: '12px', display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="af-grid-item-label" style={{ color: '#be123c', fontSize: '12px', textTransform: 'none' }}>Thu hộ COD</div>
          <input 
            type="text"
            value={formatVND(formData.codAmount)} 
            onChange={e => {
              const rawVal = e.target.value.replace(/\D/g, '');
              handleChange('codAmount', rawVal ? parseInt(rawVal, 10) : 0);
            }} 
            className="af-grid-item-value" 
            style={{ border: 'none', background: 'transparent', outline: 'none', padding: 0, width: '150px', textAlign: 'right', fontWeight: 700, color: '#be123c', fontSize: '14px' }} 
          />
        </div>

        {/* Cảnh báo sáp nhập thực tế (nếu có) */}
        {formData.warning && (
          <div style={{ border: '1px solid #fcd34d', background: '#fffbeb', borderRadius: '8px', padding: '10px', marginTop: '8px' }}>
            <div style={{ fontSize: '11px', color: '#b45309', display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
              <span style={{ flexShrink: 0 }}>⚠</span>
              <div style={{ lineHeight: '1.4', color: '#92400e', fontWeight: 600 }}>
                {formData.warning}
              </div>
            </div>
          </div>
        )}

        {/* Khối gợi ý địa chỉ (2 cấp) - Luôn hiển thị nếu bóc tách thành công địa chỉ */}
        {formData.suggestedAddress && (
          <div style={{ border: '1px solid #bbf7d0', background: '#f0fdf4', borderRadius: '8px', padding: '10px', marginTop: '8px' }}>
            <div style={{ fontSize: '11px', color: '#166534', fontWeight: 600, display: 'flex', gap: '4px', marginBottom: '4px' }}>
              <span>📍</span> GỢI Ý ĐỊA CHỈ BÓC TÁCH:
            </div>
            <div style={{ background: 'white', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '10px', color: '#3b82f6' }}>Địa chỉ gợi ý (2 cấp):</div>
                <div style={{ fontSize: '12px', color: '#1e293b', fontWeight: 500 }}>{formData.suggestedAddress}</div>
              </div>
              <button className="af-copy-btn" onClick={() => handleChange('address', formData.suggestedAddress)} title="Áp dụng địa chỉ gợi ý" style={{ cursor: 'pointer' }}>📋</button>
            </div>
            <div style={{ fontSize: '9px', color: '#94a3b8', textAlign: 'right', marginTop: '4px', fontStyle: 'italic' }}>
              Bấm vào nút 📋 để áp dụng nhanh gợi ý địa chỉ 2 cấp
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <button className="af-btn-fill" onClick={handleConfirm}>
          <span>↓</span> Nhập đơn
        </button>
        <button className="af-btn-save">
          <span>💾</span> Lưu đơn
        </button>
      </div>
      <button className="af-btn-print" style={{ marginTop: '0px' }}>
        <span>🖨️</span> In đơn
      </button>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
        <div style={{ 
          fontSize: '11px', 
          color: formData.confidence < (formData.confidenceThreshold || 90) ? '#b45309' : '#0f766e', 
          fontWeight: 600 
        }}>
          {formData.confidence < (formData.confidenceThreshold || 90) ? '⚠️ Độ tự tin thấp (Cần soát lại)' : '✨ Bóc tách thành công!'}
        </div>
        <div style={{ 
          fontSize: '12px', 
          color: formData.confidence < (formData.confidenceThreshold || 90) ? '#b45309' : '#0f766e', 
          fontWeight: 700 
        }}>
          {formData.confidence || 100}%
        </div>
      </div>
    </div>
  );
}
