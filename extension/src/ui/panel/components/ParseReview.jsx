import React, { useState, useEffect } from 'react';
import { Check, Edit2, User, Phone, MapPin, Hash, Package, DollarSign, FileText, AlertCircle } from 'lucide-react';

function formatVND(value) {
  if (value === undefined || value === null || value === '') return '0 đ';
  const cleanValue = String(value).replace(/\D/g, '');
  if (!cleanValue) return '0 đ';
  const num = parseInt(cleanValue, 10);
  return num.toLocaleString('vi-VN') + ' đ';
}

function isValidPhoneNumber(phone) {
  if (!phone) return false;
  const clean = phone.toString().replace(/\D/g, '');
  return /^(0\d{9,10})$/.test(clean);
}

export default function ParseReview({ data, rawText, onConfirm, onCancel }) {
  const [formData, setFormData] = useState({
    name: data?.name || '',
    phone: data?.phone || '',
    address: data?.address || '',
    orderCode: data?.orderCode || '',
    productItem: data?.productItem || '',
    codAmount: data?.codAmount || 0,
    collectFee: !!data?.collectFee,
    extraPhones: data?.extraPhones || [],
    extraNote: data?.extraNote || ''
  });

  useEffect(() => {
    setFormData({
      name: data?.name || '',
      phone: data?.phone || '',
      address: data?.address || '',
      orderCode: data?.orderCode || '',
      productItem: data?.productItem || '',
      codAmount: data?.codAmount || 0,
      collectFee: !!data?.collectFee,
      extraPhones: data?.extraPhones || [],
      extraNote: data?.extraNote || ''
    });
  }, [data]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const isPhoneInvalid = !isValidPhoneNumber(formData.phone);
  const isAddressInvalid = !formData.address || formData.address === 'không tìm thấy';
  const isNameInvalid = !formData.name;
  const isProductInvalid = !formData.productItem;

  return (
    <div className="af-panel-content" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ fontSize: '12px', color: '#1e293b', fontWeight: 700, borderBottom: '1px solid #cbd5e1', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span>🔍 Xem lại thông tin tách đơn</span>
      </div>

      {/* Raw text display */}
      <div style={{ 
        background: '#f1f5f9', 
        border: '1px solid #cbd5e1', 
        borderRadius: '8px', 
        padding: '10px', 
        fontSize: '12px', 
        color: '#475569', 
        whiteSpace: 'pre-wrap', 
        maxHeight: '80px', 
        overflowY: 'auto',
        boxSizing: 'border-box'
      }}>
        <div style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Văn bản gốc</div>
        {rawText || "Không có nội dung"}
      </div>

      <div style={{ border: '1px solid #cbd5e1', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', background: '#f8fafc' }}>
        
        {/* Người nhận & Số điện thoại */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div className="af-grid-item" style={{ 
            border: isNameInvalid ? '1px solid #facc15' : '1px solid #e2e8f0',
            background: isNameInvalid ? '#fef9c3' : 'white'
          }}>
            <div className="af-grid-item-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><User size={12} /> Tên người nhận</div>
            <input 
              value={formData.name} 
              onChange={e => handleChange('name', e.target.value)} 
              className="af-grid-item-value" 
              style={{ border: 'none', background: 'transparent', outline: 'none', padding: 0, width: '100%', fontSize: '13px' }} 
            />
          </div>

          <div className="af-grid-item" style={{ 
            border: isPhoneInvalid ? '1px solid #facc15' : '1px solid #e2e8f0',
            background: isPhoneInvalid ? '#fef9c3' : 'white'
          }}>
            <div className="af-grid-item-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Phone size={12} /> Số điện thoại</div>
            <input 
              value={formData.phone} 
              onChange={e => handleChange('phone', e.target.value)} 
              className="af-grid-item-value" 
              style={{ border: 'none', background: 'transparent', outline: 'none', padding: 0, width: '100%', fontSize: '13px' }} 
            />
          </div>
        </div>

        {/* Sản phẩm & Mã đơn hàng */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div className="af-grid-item" style={{ 
            border: isProductInvalid ? '1px solid #facc15' : '1px solid #e2e8f0',
            background: isProductInvalid ? '#fef9c3' : 'white'
          }}>
            <div className="af-grid-item-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Package size={12} /> Sản phẩm</div>
            <input 
              value={formData.productItem} 
              onChange={e => handleChange('productItem', e.target.value)} 
              className="af-grid-item-value" 
              style={{ border: 'none', background: 'transparent', outline: 'none', padding: 0, width: '100%', fontSize: '13px' }} 
            />
          </div>

          <div className="af-grid-item" style={{ border: '1px solid #e2e8f0', background: 'white' }}>
            <div className="af-grid-item-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Hash size={12} /> Mã đơn hàng</div>
            <input 
              value={formData.orderCode} 
              onChange={e => handleChange('orderCode', e.target.value)} 
              className="af-grid-item-value" 
              style={{ border: 'none', background: 'transparent', outline: 'none', padding: 0, width: '100%', fontSize: '13px' }} 
            />
          </div>
        </div>

        {/* Địa chỉ nhận hàng */}
        <div className="af-grid-item" style={{ 
          border: isAddressInvalid ? '1px solid #facc15' : '1px solid #e2e8f0',
          background: isAddressInvalid ? '#fef9c3' : 'white'
        }}>
          <div className="af-grid-item-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={12} /> Địa chỉ nhận hàng</div>
          <textarea 
            value={formData.address} 
            onChange={e => handleChange('address', e.target.value)} 
            className="af-grid-item-value" 
            style={{ border: 'none', background: 'transparent', outline: 'none', padding: 0, width: '100%', resize: 'none', minHeight: '40px', fontSize: '13px' }} 
          />
        </div>

        {/* Thu hộ COD & Thu cước */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '8px' }}>
          <div className="af-grid-item pink">
            <div className="af-grid-item-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><DollarSign size={12} /> Thu hộ COD</div>
            <input 
              type="text"
              value={formatVND(formData.codAmount)} 
              onChange={e => {
                const rawVal = e.target.value.replace(/\D/g, '');
                handleChange('codAmount', rawVal ? parseInt(rawVal, 10) : 0);
              }} 
              className="af-grid-item-value" 
              style={{ border: 'none', background: 'transparent', outline: 'none', padding: 0, width: '100%', fontWeight: 700, color: '#be123c', fontSize: '13px' }} 
            />
          </div>

          <div className="af-grid-item" style={{ border: '1px solid #e2e8f0', background: 'white', justifyContent: 'center', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 600, color: '#0f766e', textTransform: 'uppercase' }}>
              <input 
                type="checkbox" 
                checked={formData.collectFee} 
                onChange={e => handleChange('collectFee', e.target.checked)} 
                style={{ cursor: 'pointer', width: '14px', height: '14px' }}
              />
              Thu cước
            </label>
          </div>
        </div>

        {/* Ghi chú */}
        <div className="af-grid-item" style={{ border: '1px solid #e2e8f0', background: 'white' }}>
          <div className="af-grid-item-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><FileText size={12} /> Ghi chú</div>
          <input 
            value={formData.extraNote} 
            onChange={e => handleChange('extraNote', e.target.value)} 
            className="af-grid-item-value" 
            style={{ border: 'none', background: 'transparent', outline: 'none', padding: 0, width: '100%', fontSize: '13px' }} 
          />
        </div>

      </div>

      {(isPhoneInvalid || isAddressInvalid) && (
        <div style={{ border: '1px solid #fcd34d', background: '#fffbeb', borderRadius: '8px', padding: '8px 10px', fontSize: '11px', color: '#b45309', display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
          <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
          <div>
            {isPhoneInvalid && <div>⚠️ Số điện thoại không hợp lệ hoặc bị thiếu.</div>}
            {isAddressInvalid && <div>⚠️ Không tìm thấy địa chỉ hợp lệ.</div>}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <button className="af-btn-fill" onClick={() => onConfirm(formData)} style={{ background: '#10b981' }}>
          <Check size={14} /> Xác nhận
        </button>
        <button className="af-btn-delete" onClick={onCancel} style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' }}>
          <Edit2 size={14} /> Sửa lại
        </button>
      </div>
    </div>
  );
}
