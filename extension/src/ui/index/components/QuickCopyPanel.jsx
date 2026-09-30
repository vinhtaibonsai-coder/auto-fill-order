import React, { useState } from 'react';
import {
  Copy, Check, Edit2, CheckCircle2, RotateCcw,
  FileText, Truck, AlertTriangle, X, CheckCheck, ArrowRight,
  Share2, Trash2, Info
} from 'lucide-react';
import {
  buildQuickCopyFields,
  getNextCopyIndex,
  formatFullOrderCopy,
  FIELD_LABELS
} from '../quick-copy.js';
import { clearAllLocalDrafts } from '../quick-copy.persistence.js';

const moneyFormatter = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });

export default function QuickCopyPanel({
  value,
  carrier = 'jt',
  copiedKeys = new Set(),
  onCarrierChange,
  onChange,
  onCopyField,
  onCopyNext,
  onCopyAll,
  onReset,
  onSaveDraft,
  isSavingDraft = false,
  onToast
}) {
  const [editingKey, setEditingKey] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [showIosNotice, setShowIosNotice] = useState(true);

  const fields = buildQuickCopyFields(value, carrier);
  const nextIndex = getNextCopyIndex(fields, copiedKeys);
  const nextField = nextIndex >= 0 ? fields[nextIndex] : null;

  const totalFields = fields.length;
  const copiedCount = fields.filter(f => copiedKeys instanceof Set ? copiedKeys.has(f.key) : copiedKeys.includes(f.key)).length;
  const isAllCopied = totalFields > 0 && copiedCount === totalFields;

  const handleStartEdit = (key, currentVal) => {
    setEditingKey(key);
    setEditValue(currentVal !== undefined && currentVal !== null ? String(currentVal) : '');
  };

  const handleSaveEdit = () => {
    if (!editingKey) return;
    const updated = { ...value, [editingKey]: editValue.trim() };
    if (onChange) onChange(updated);
    setEditingKey(null);
  };

  const handleCancelEdit = () => {
    setEditingKey(null);
    setEditValue('');
  };

  // Native iOS Share Sheet Integration
  const handleShare = async () => {
    const fullText = formatFullOrderCopy(value);
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `Đơn hàng ${value?.name || ''}`,
          text: fullText
        });
        if (onToast) onToast('Đã mở Share Sheet');
      } catch (err) {
        if (err.name !== 'AbortError') {
          // Fallback to copy all
          if (onCopyAll) onCopyAll();
        }
      }
    } else {
      if (onCopyAll) onCopyAll();
    }
  };

  // Wipe all local storage drafts
  const handleClearAllData = () => {
    if (window.confirm('Bạn có chắc muốn xóa sạch toàn bộ dữ liệu đơn nháp đang lưu trên thiết bị này?')) {
      clearAllLocalDrafts();
      if (onReset) onReset();
      if (onToast) onToast('Đã xóa sạch dữ liệu đơn nháp cục bộ');
    }
  };

  return (
    <div className="quick-copy-panel" style={{ display: 'grid', gap: '12px', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
      
      {/* 1. CARRIER PRESET SELECTOR (J&T vs VNPost) */}
      <div className="pwa-card" style={{ padding: '14px', marginBottom: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Truck size={14} color="var(--primary)" />
            <span>Thứ Tự Copy Theo App Hãng</span>
          </div>
          <span style={{
            fontSize: '11.5px',
            fontWeight: 800,
            color: isAllCopied ? '#15803d' : 'var(--primary)',
            background: isAllCopied ? '#dcfce7' : 'var(--primary-light)',
            padding: '2px 8px',
            borderRadius: '6px'
          }}>
            {isAllCopied ? `Hoàn tất ${copiedCount}/${totalFields}` : `Tiến độ ${copiedCount}/${totalFields}`}
          </span>
        </div>

        <div className="qc-carrier-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={carrier === 'jt'}
            className={`qc-carrier-tab ${carrier === 'jt' ? 'active jt' : ''}`}
            onClick={() => onCarrierChange && onCarrierChange('jt')}
          >
            <span style={{ fontWeight: 800, fontSize: '13.5px' }}>J&T Express</span>
            <span style={{ fontSize: '10.5px', opacity: 0.85 }}>Tên → SĐT → Đ/C → COD</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={carrier === 'vnpost'}
            className={`qc-carrier-tab ${carrier === 'vnpost' ? 'active vnpost' : ''}`}
            onClick={() => onCarrierChange && onCarrierChange('vnpost')}
          >
            <span style={{ fontWeight: 800, fontSize: '13.5px' }}>VNPost</span>
            <span style={{ fontSize: '10.5px', opacity: 0.85 }}>SĐT → Tên → Đ/C → COD</span>
          </button>
        </div>
      </div>

      {/* iOS Sandbox & Autofill Boundary Notice */}
      {showIosNotice && (
        <div style={{
          background: '#f8fafc',
          border: '1px solid #cbd5e1',
          borderRadius: '10px',
          padding: '10px 12px',
          fontSize: '11.5px',
          color: '#475569',
          display: 'flex',
          gap: '8px',
          alignItems: 'flex-start',
          position: 'relative'
        }}>
          <Info size={15} color="#64748b" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ flex: 1, lineHeight: '1.4' }}>
            <strong>Lưu ý iOS & PWA:</strong> Hệ điều hành iOS bảo mật không cấp quyền tự động điền (autofill) trực tiếp vào ứng dụng bên ngoài J&T hay VNPost. Bạn hãy dùng nút <strong>"Copy Tiếp Theo"</strong> bên dưới để dán nhanh từng trường, hoặc nút <strong>"Chia Sẻ"</strong> để mở Share Sheet.
          </div>
          <button
            type="button"
            onClick={() => setShowIosNotice(false)}
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 2 }}
            title="Đóng ghi chú"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* 2. FIELD CARDS LIST */}
      <div style={{ display: 'grid', gap: '8px' }}>
        {fields.map((field) => {
          const isCopied = copiedKeys instanceof Set ? copiedKeys.has(field.key) : copiedKeys.includes(field.key);
          const isEditing = editingKey === field.key;
          const isCod = field.key === 'codAmount';

          return (
            <div
              key={field.key}
              className={`qc-field-card ${isCopied ? 'copied' : ''}`}
            >
              {isEditing ? (
                /* INLINE EDIT FORM */
                <div style={{ width: '100%', display: 'grid', gap: '8px' }}>
                  <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--primary)' }}>
                    Chỉnh sửa: {field.label}
                  </div>
                  {field.key === 'address' ? (
                    <textarea
                      rows={3}
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        border: '1.5px solid var(--primary)',
                        fontSize: '13.5px',
                        fontFamily: 'inherit',
                        boxSizing: 'border-box'
                      }}
                      autoFocus
                    />
                  ) : (
                    <input
                      type={isCod ? 'number' : 'text'}
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        border: '1.5px solid var(--primary)',
                        fontSize: '14px',
                        fontWeight: 600,
                        boxSizing: 'border-box'
                      }}
                      autoFocus
                    />
                  )}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="qc-edit-btn"
                      style={{ background: '#f1f5f9', color: '#475569' }}
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveEdit}
                      className="qc-edit-btn"
                      style={{ background: 'var(--primary)', color: '#ffffff' }}
                    >
                      Lưu
                    </button>
                  </div>
                </div>
              ) : (
                /* NORMAL DISPLAY ROW */
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', width: '100%' }}>
                  
                  {/* Tap area to copy */}
                  <div
                    onClick={() => onCopyField && onCopyField(field)}
                    style={{ flex: 1, cursor: 'pointer', minWidth: 0 }}
                    title="Chạm để sao chép"
                  >
                    <div style={{ fontSize: '11px', fontWeight: 700, color: isCopied ? '#16a34a' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {isCopied && <Check size={12} color="#16a34a" />}
                      <span>{field.label}</span>
                      {isCopied && <span style={{ fontSize: '9.5px', background: '#dcfce7', color: '#15803d', padding: '1px 5px', borderRadius: '4px', fontWeight: 800 }}>ĐÃ CHÉP</span>}
                    </div>

                    <div style={{
                      fontSize: '14px',
                      fontWeight: 800,
                      color: isCopied ? '#166534' : 'var(--text-main)',
                      marginTop: '2px',
                      wordBreak: 'break-word',
                      lineHeight: '1.35'
                    }}>
                      {field.value}
                      {isCod && (
                        <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#16a34a', marginLeft: '6px' }}>
                          ({moneyFormatter.format(Number(field.value) || 0)})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() => handleStartEdit(field.key, value[field.key])}
                      className="qc-field-action-btn"
                      title="Sửa nhanh trường này"
                    >
                      <Edit2 size={14} />
                    </button>

                    <button
                      type="button"
                      onClick={() => onCopyField && onCopyField(field)}
                      className={`qc-field-action-btn ${isCopied ? 'copied' : 'primary'}`}
                      title={isCopied ? 'Đã sao chép (Chạm để chép lại)' : 'Sao chép trường này'}
                    >
                      {isCopied ? <Check size={16} color="#16a34a" /> : <Copy size={15} />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 3. MISSING FIELD ALERT (If key fields are absent) */}
      {(!value.phone || !value.name || !value.address) && (
        <div style={{
          background: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: '10px',
          padding: '10px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '12px',
          color: '#92400e'
        }}>
          <AlertTriangle size={15} color="#d97706" style={{ flexShrink: 0 }} />
          <div>
            <span>Thiếu: </span>
            {!value.phone && <strong style={{ marginRight: '6px' }}>[SĐT]</strong>}
            {!value.name && <strong style={{ marginRight: '6px' }}>[Tên]</strong>}
            {!value.address && <strong>[Địa chỉ]</strong>}
          </div>
        </div>
      )}

      {/* 4. AUXILIARY ACTIONS (Copy All, Share Sheet, Save Draft, Reset/Wipe) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: '6px', marginTop: '4px' }}>
        <button
          type="button"
          onClick={onCopyAll}
          className="qc-aux-btn"
          style={{ background: 'var(--bg-main)', border: '1px solid var(--border)', color: 'var(--text-main)' }}
        >
          <Copy size={13} />
          <span>Chép hết</span>
        </button>

        <button
          type="button"
          onClick={handleShare}
          className="qc-aux-btn"
          style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534' }}
          title="Mở Share Sheet chia sẻ sang Zalo / Ghi chú"
        >
          <Share2 size={13} />
          <span>Chia sẻ</span>
        </button>

        <button
          type="button"
          onClick={onSaveDraft}
          disabled={isSavingDraft}
          className="qc-aux-btn"
          style={{ background: 'var(--primary-light)', border: '1px solid var(--primary-border)', color: 'var(--primary)' }}
        >
          <FileText size={13} />
          <span>{isSavingDraft ? 'Đang lưu...' : 'Lưu Nháp'}</span>
        </button>

        <button
          type="button"
          onClick={handleClearAllData}
          className="qc-aux-btn"
          style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}
          title="Xóa dữ liệu nháp cục bộ khỏi thiết bị"
        >
          <Trash2 size={13} />
          <span>Xóa dữ liệu</span>
        </button>
      </div>

      {/* 5. STICKY ACTION BAR FOR IPHONE ("COPY TIẾP THEO") */}
      <div className="qc-sticky-bar">
        <button
          type="button"
          onClick={onCopyNext}
          className={`qc-btn-next ${isAllCopied ? 'completed' : ''}`}
        >
          {isAllCopied ? (
            <>
              <CheckCheck size={18} />
              <span>ĐÃ COPY XONG TẤT CẢ TRƯỜNG</span>
            </>
          ) : nextField ? (
            <>
              <span>Copy tiếp: {nextField.label}</span>
              <ArrowRight size={16} />
            </>
          ) : (
            <>
              <span>Copy tiếp theo</span>
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </div>

    </div>
  );
}
