import React, { useState, useEffect, useMemo } from 'react';
import { Zap, ClipboardPaste, Trash2, ArrowDownToLine, Save, Printer, User, Phone, Hash, FileText, MapPin, AlertTriangle, CheckCircle2, Camera, X, CheckSquare, Square } from 'lucide-react';
import { evaluateFieldConfidence, canSubmitWithFieldReviews } from '../../../application/ai/field-confidence.evaluator.js';
import { persistImageOrderExtractions } from '../../../domain/image/image-extraction.service.js';

function formatVND(value) {
  if (value === undefined || value === null || value === '') return '0 đ';
  const cleanValue = String(value).replace(/\D/g, '');
  if (!cleanValue) return '0 đ';
  const num = parseInt(cleanValue, 10);
  return num.toLocaleString('vi-VN') + ' đ';
}

export default function ConfidenceReview({ data, rawText, imageThumbnail, onParse, onConfirm, onCancel, onSave }) {
  const [formData, setFormData] = useState({
    name: data?.name || '',
    phone: data?.phone || '',
    address: data?.address || '',
    orderCode: data?.orderCode || '',
    codAmount: data?.codAmount || '',
    extraNote: data?.extraNote || '',
    warning: data?.warning || '',
    suggestedAddress: data?.suggestedAddress || '',
    confidence: typeof data?.confidence === 'number' && Number.isFinite(data.confidence) ? data.confidence : data?.confidence ?? null,
    confidenceThreshold: data?.confidenceThreshold || 90,
    rawAddress: data?.rawAddress || data?.address || '',
    normalizedAddress: data?.normalizedAddress || data?.address || '',
    province: data?.province || '',
    ward: data?.ward || '',
    addressSource: data?.addressSource || 'unknown'
  });
  
  const [currentText, setCurrentText] = useState(rawText || '');
  const [showRawText, setShowRawText] = useState(true);
  const [lowConfidenceReviewed, setLowConfidenceReviewed] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);

  const activeThumbnail = imageThumbnail || data?.imageThumbnail;

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
      confidence: typeof data?.confidence === 'number' && Number.isFinite(data.confidence) ? data.confidence : data?.confidence ?? null,
      confidenceThreshold: data?.confidenceThreshold || 90,
      rawAddress: data?.rawAddress || data?.address || '',
      normalizedAddress: data?.normalizedAddress || data?.address || '',
      province: data?.province || '',
      ward: data?.ward || '',
      addressSource: data?.addressSource || 'unknown'
    });
    setCurrentText(rawText || '');
    setLowConfidenceReviewed(false);
    setConfirmedFields([]);
  }, [data, rawText]);

  const [confirmedFields, setConfirmedFields] = useState([]);
  const [customerOrderCount, setCustomerOrderCount] = useState(0);

  const fieldConfidenceEvaluation = useMemo(() => {
    const numericConf = typeof formData.confidence === 'number' && Number.isFinite(formData.confidence) ? formData.confidence : null;
    return evaluateFieldConfidence(formData, {
      ocrConfidence: numericConf != null ? numericConf / 100 : 0,
      fullText: currentText,
      isNormalizedAddress: Boolean(formData.normalizedAddress && formData.normalizedAddress !== formData.rawAddress)
    });
  }, [formData, currentText]);

  const gateResult = useMemo(() => {
    return canSubmitWithFieldReviews(fieldConfidenceEvaluation.fieldConfidence, confirmedFields, 0.85);
  }, [fieldConfidenceEvaluation, confirmedFields]);

  useEffect(() => {
    let active = true;
    const checkCustomerHistory = async () => {
      const qPhone = String(formData.phone || '').replace(/\D/g, '');
      const qName = String(formData.name || '').trim().toLowerCase();
      if (qPhone.length < 9 && qName.length < 2) {
        if (active) setCustomerOrderCount(0);
        return;
      }
      try {
        if (typeof globalThis.OrderStorage !== 'undefined' && typeof globalThis.OrderStorage.getSubmittedOrders === 'function') {
          const orders = await globalThis.OrderStorage.getSubmittedOrders().catch(() => []);
          const matched = (orders || []).filter(o => {
            const p = String(o.phone || '').replace(/\D/g, '');
            const n = String(o.name || o.customer_name || '').trim().toLowerCase();
            return qPhone.length >= 9 ? (p === qPhone) : (qName.length >= 2 && n === qName);
          });
          if (active) setCustomerOrderCount(matched.length);
        }
      } catch (_) {}
    };
    checkCustomerHistory();
    return () => { active = false; };
  }, [formData.phone, formData.name]);

  const hasConfidence = typeof formData.confidence === 'number' && Number.isFinite(formData.confidence);
  const confidenceThreshold = Number(formData.confidenceThreshold || 90);
  const needsReview = !hasConfidence || !Number.isFinite(confidenceThreshold) || formData.confidence < confidenceThreshold;

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleConfirm = () => {
    // Tự động lưu trữ tài sản ảnh và bóc tách trường vào Supabase (Gap 5)
    if (activeThumbnail || data?.isImageOrder || data?.imageSha256) {
      persistImageOrderExtractions({
        imageRaw: activeThumbnail,
        imageSha256: data?.imageSha256,
        extractedFields: {
          name: { value: formData.name, confidence: fieldConfidenceEvaluation.fieldConfidence?.name?.confidence },
          phone: { value: formData.phone, confidence: fieldConfidenceEvaluation.fieldConfidence?.phone?.confidence },
          address: { value: formData.address, confidence: fieldConfidenceEvaluation.fieldConfidence?.address?.confidence },
          ward: { value: formData.ward, confidence: fieldConfidenceEvaluation.fieldConfidence?.address?.confidence },
          province: { value: formData.province, confidence: fieldConfidenceEvaluation.fieldConfidence?.address?.confidence },
          cod: { value: formData.codAmount, confidence: fieldConfidenceEvaluation.fieldConfidence?.cod?.confidence },
          order_code: { value: formData.orderCode, confidence: 1.0 }
        }
      }).catch(() => {});
    }

    onConfirm(formData);
  };

  return (
    <div className="af-panel-content">
      {/* Raw text input area for editing and re-parsing */}
      {showRawText && (
        <>
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
            <button className="af-btn-delete" onClick={() => { setCurrentText(''); setShowRawText(false); onCancel(); }}>
              <span style={{ display: 'inline-flex', alignItems: 'center' }}><Trash2 size={14} /></span> Xóa
            </button>
          </div>
        </>
      )}

      <div style={{ border: '1px solid #bbf7d0', borderRadius: '10px', padding: '12px', marginTop: '4px' }}>
        <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>PHÂN TÍCH DỮ LIỆU <span style={{ textTransform: 'none', fontWeight: 400 }}>(bấm vào ô để sửa nếu sai)</span></span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {activeThumbnail && (
              <button 
                onClick={() => setShowImageModal(true)}
                style={{ background: '#e0f2fe', border: '1px solid #7dd3fc', borderRadius: '4px', padding: '2px 6px', fontSize: '9px', color: '#0369a1', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer' }}
              >
                <Camera size={10} /> Xem ảnh
              </button>
            )}
            {!showRawText && (
              <button 
                onClick={() => setShowRawText(true)}
                style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: '10px', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
              >
                Hiển thị văn bản gốc
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
          <div className="af-grid-item">
            <div className="af-grid-item-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <User size={12} /> KHÁCH HÀNG {customerOrderCount > 0 && <span style={{ background: '#dbeafe', color: '#0284c7', padding: '0.5px 6px', borderRadius: '10px', fontSize: '10px', fontWeight: 700 }}>({customerOrderCount})</span>}
            </div>
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

        <div style={{ fontSize: '11px', color: '#475569', background: '#f8fafc', borderRadius: '8px', padding: '8px', marginBottom: '8px', lineHeight: 1.5 }}>
          <div><strong>Địa chỉ gốc:</strong> {formData.rawAddress || 'Chưa có'}</div>
          <div><strong>Địa chỉ chuẩn hóa:</strong> {formData.normalizedAddress || formData.address || 'Chưa có'}</div>
          <div><strong>Tỉnh/Thành:</strong> {formData.province || 'Chưa xác định'} · <strong>Phường/Xã:</strong> {formData.ward || 'Chưa xác định'}</div>
          <div><strong>Nguồn:</strong> {formData.addressSource}</div>
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

      {needsReview && (
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '9px', border: '1px solid #fcd34d', borderRadius: '8px', background: '#fffbeb', color: '#92400e', fontSize: '11px', cursor: 'pointer', marginBottom: '8px' }}>
          <input
            type="checkbox"
            checked={lowConfidenceReviewed}
            onChange={(event) => setLowConfidenceReviewed(event.target.checked)}
          />
          Tôi đã đối chiếu các trường có độ tin cậy thấp với nội dung đơn gốc.
        </label>
      )}

      {fieldConfidenceEvaluation.needsFieldReview && (
        <div style={{ border: '1px solid #fcd34d', borderRadius: '8px', background: '#fffbeb', padding: '10px', marginBottom: '10px' }}>
          <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#92400e', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <AlertTriangle size={13} />
            <span>Đối chiếu từng trường độ tin cậy thấp (&lt; 85%):</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {Object.entries(fieldConfidenceEvaluation.fieldConfidence)
              .filter(([_, f]) => f.needsReview)
              .map(([fieldName, f]) => {
                const labelMap = {
                  name: 'Tên người nhận',
                  phone: 'Số điện thoại',
                  address: 'Địa chỉ chi tiết',
                  ward: 'Phường / Xã',
                  province: 'Tỉnh / Thành phố',
                  cod: 'Tiền thu hộ COD',
                  product: 'Sản phẩm'
                };
                const isConfirmed = confirmedFields.includes(fieldName);
                return (
                  <label key={fieldName} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#78350f', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={isConfirmed}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setConfirmedFields(prev => [...prev, fieldName]);
                        } else {
                          setConfirmedFields(prev => prev.filter(x => x !== fieldName));
                        }
                      }}
                    />
                    <span>Xác nhận đúng <strong>{labelMap[fieldName] || fieldName}</strong> ({Math.round(f.confidence * 100)}%)</span>
                  </label>
                );
              })}
          </div>
          {!gateResult.canSubmit && (
            <div style={{ marginTop: '6px', fontSize: '10.5px', color: '#b91c1c', fontWeight: 600 }}>
              ⚠️ Khóa nhập đơn cho đến khi duyệt đủ các trường: {gateResult.unconfirmedFields.join(', ')}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <button id="btnFillForm" className="af-btn-fill" onClick={handleConfirm} disabled={(needsReview && !lowConfidenceReviewed) || !gateResult.canSubmit}>
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
      {(() => {
        const rawConf = formData.confidence;
        const hasConf = typeof rawConf === 'number' && Number.isFinite(rawConf);
        const threshold = Number(formData.confidenceThreshold || 90);
        const isLow = !hasConf || rawConf < threshold;
        const confText = hasConf ? `${Math.max(0, Math.min(100, Math.round(rawConf)))}%` : '—';
        return (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
            <div style={{ 
              fontSize: '11px', 
              color: isLow ? '#b45309' : '#0f766e', 
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              {isLow ? <><AlertTriangle size={12} /> Cần soát lại</> : <><CheckCircle2 size={12} /> Bóc tách thành công!</>}
            </div>
            <div style={{ 
              fontSize: '12px', 
              color: isLow ? '#b45309' : '#0f766e', 
              fontWeight: 700 
            }}>
              {confText}
            </div>
          </div>
        );
      })()}

      {/* MODAL PHÓNG TO ẢNH GỐC ĐỂ ĐỐI CHIẾU */}
      {showImageModal && activeThumbnail && (
        <div className="af-image-modal-backdrop" onClick={() => setShowImageModal(false)}>
          <div className="af-image-modal-content" onClick={e => e.stopPropagation()}>
            <button className="af-image-modal-close" onClick={() => setShowImageModal(false)}>
              <X size={16} />
            </button>
            <div style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 600, marginBottom: '6px' }}>📸 Ảnh gốc đơn hàng</div>
            <img src={activeThumbnail} alt="Ảnh gốc đơn hàng" className="af-image-modal-img" />
          </div>
        </div>
      )}
    </div>
  );
}
