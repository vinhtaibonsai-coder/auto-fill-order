import React, { useState, useEffect } from 'react';
import { Zap, ClipboardPaste, Trash2, ArrowDownToLine, Save, Printer, User, Phone, Hash, FileText, MapPin, AlertTriangle, CheckCircle2 } from 'lucide-react';

function formatVND(value) {
  if (value === undefined || value === null || value === '') return '0 đ';
  const cleanValue = String(value).replace(/\D/g, '');
  if (!cleanValue) return '0 đ';
  const num = parseInt(cleanValue, 10);
  return num.toLocaleString('vi-VN') + ' đ';
}

export default function ConfidenceReview({ data, rawText, onParse, onConfirm, onCancel, onSave }) {
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px', gap: '8px' }}>
        <button 
          className="af-btn-primary" 
          onClick={() => onParse(currentText)}
          disabled={!currentText.trim()}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center' }}><Zap size={14} /></span> Tách Đơn
        </button>
        <button 
          className="af-btn-primary" 
          style={{ background: '#3b82f6' }}
          onClick={async () => {
            try {
              const clipText = await navigator.clipboard.readText();
              if (clipText) setCurrentText(clipText);
            } catch (err) {
              console.warn("Lỗi dán:", err);
            }
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center' }}><ClipboardPaste size={14} /></span> Dán
        </button>
        <button className="af-btn-delete" onClick={() => { setCurrentText(''); onCancel(); }}>
          <span style={{ display: 'inline-flex', alignItems: 'center' }}><Trash2 size={14} /></span> Xóa
        </button>
      </div>

      <div style={{ border: '1px solid #bbf7d0', borderRadius: '10px', padding: '12px', marginTop: '4px' }}>
        <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '12px' }}>
          PHÂN TÍCH DỮ LIỆU <span style={{ textTransform: 'none', fontWeight: 400 }}>(bấm vào ô để sửa nếu sai)</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
          <div className="af-grid-item">
            <div className="af-grid-item-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><User size={12} /> KHÁCH HÀNG</div>
            <input 
              value={formData.name} 
              onChange={e => handleChange('name', e.target.value)} 
              className="af-grid-item-value" 
              style={{ border: 'none', background: 'transparent', outline: 'none', padding: 0, width: '100%' }} 
            />
          </div>
          <div className="af-grid-item">
            <div className="af-grid-item-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Phone size={12} /> SỐ ĐIỆN THOẠI</div>
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
            <div className="af-grid-item-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Hash size={12} /> MÃ ĐƠN HÀNG</div>
            <input 
              value={formData.orderCode} 
              onChange={e => handleChange('orderCode', e.target.value)} 
              className="af-grid-item-value" 
              style={{ border: 'none', background: 'transparent', outline: 'none', padding: 0, width: '100%' }} 
            />
          </div>
          <div className="af-grid-item">
            <div className="af-grid-item-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><FileText size={12} /> GHI CHÚ</div>
            <input 
              value={formData.extraNote} 
              onChange={e => handleChange('extraNote', e.target.value)} 
              className="af-grid-item-value" 
              style={{ border: 'none', background: 'transparent', outline: 'none', padding: 0, width: '100%' }} 
            />
          </div>
        </div>

        <div className="af-grid-item" style={{ marginBottom: '8px' }}>
          <div className="af-grid-item-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={12} /> ĐỊA CHỈ NHẬN HÀNG</div>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <textarea 
              value={formData.address} 
              onChange={e => handleChange('address', e.target.value)} 
              className="af-grid-item-value" 
              style={{ border: 'none', background: 'transparent', outline: 'none', padding: 0, width: '100%', resize: 'none', minHeight: '40px' }} 
            />
            <button className="af-copy-btn" onClick={() => {
              navigator.clipboard.writeText(formData.address);
              if (typeof globalThis.showVnpostToast === 'function') {
                globalThis.showVnpostToast('Đã sao chép địa chỉ!', 'success');
              }
            }} style={{ display: 'inline-flex', alignItems: 'center' }}><ClipboardPaste size={14} /></button>
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
              <span style={{ flexShrink: 0, marginTop: '2px' }}><AlertTriangle size={12} /></span>
              <div style={{ lineHeight: '1.4', color: '#92400e', fontWeight: 600 }}>
                {formData.warning}
              </div>
            </div>
          </div>
        )}

      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <button className="af-btn-fill" onClick={handleConfirm}>
          <span style={{ display: 'inline-flex', alignItems: 'center' }}><ArrowDownToLine size={14} /></span> Nhập đơn
        </button>
        <button className="af-btn-save" onClick={() => {
          if (onSave) onSave();
        }}>
          <span style={{ display: 'inline-flex', alignItems: 'center' }}><Save size={14} /></span> Lưu đơn
        </button>
      </div>
      <button className="af-btn-print" style={{ marginTop: '0px' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center' }}><Printer size={14} /></span> In đơn
      </button>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
        <div style={{ 
          fontSize: '11px', 
          color: formData.confidence < (formData.confidenceThreshold || 90) ? '#b45309' : '#0f766e', 
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          {formData.confidence < (formData.confidenceThreshold || 90) ? <><AlertTriangle size={12} /> Cần soát lại</> : <><CheckCircle2 size={12} /> Bóc tách thành công!</>}
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
