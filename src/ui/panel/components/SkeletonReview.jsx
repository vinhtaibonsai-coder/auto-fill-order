import React from 'react';
import { Zap, ClipboardPaste, Trash2, ArrowDownToLine, Save, Printer, User, Phone, Hash, FileText, MapPin } from 'lucide-react';

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
          <span style={{ display: 'inline-flex', alignItems: 'center' }}><Zap size={14} /></span> Tách Đơn
        </button>
        <button className="af-btn-primary" disabled={true} style={{ background: '#3b82f6', opacity: 0.8 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center' }}><ClipboardPaste size={14} /></span> Dán
        </button>
        <button className="af-btn-delete" disabled={true} style={{ opacity: 0.8 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center' }}><Trash2 size={14} /></span> Xóa
        </button>
      </div>

      <div style={{ border: '1px solid #bbf7d0', borderRadius: '10px', padding: '12px', marginTop: '4px' }}>
        <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '12px' }}>
          PHÂN TÍCH DỮ LIỆU <span style={{ textTransform: 'none', fontWeight: 400 }}>(đang bóc tách...)</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
          <div className="af-grid-item">
            <div className="af-grid-item-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <User size={12} /> KHÁCH HÀNG
            </div>
            <div className="skeleton-box skeleton-text" style={{ width: '80%', marginTop: '4px', marginBottom: '0' }}></div>
          </div>
          <div className="af-grid-item">
            <div className="af-grid-item-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Phone size={12} /> SỐ ĐIỆN THOẠI
            </div>
            <div className="skeleton-box skeleton-text" style={{ width: '90%', marginTop: '4px', marginBottom: '0' }}></div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
          <div className="af-grid-item">
            <div className="af-grid-item-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Hash size={12} /> MÃ ĐƠN HÀNG
            </div>
            <div className="skeleton-box skeleton-text" style={{ width: '60%', marginTop: '4px', marginBottom: '0' }}></div>
          </div>
          <div className="af-grid-item">
            <div className="af-grid-item-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <FileText size={12} /> GHI CHÚ
            </div>
            <div className="skeleton-box skeleton-text" style={{ width: '80%', marginTop: '4px', marginBottom: '0' }}></div>
          </div>
        </div>

        <div className="af-grid-item" style={{ marginBottom: '8px' }}>
          <div className="af-grid-item-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <MapPin size={12} /> ĐỊA CHỈ NHẬN HÀNG
          </div>
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
          <span style={{ display: 'inline-flex', alignItems: 'center' }}><ArrowDownToLine size={14} /></span> Nhập đơn
        </button>
        <button className="af-btn-save" disabled={true} style={{ opacity: 0.7 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center' }}><Save size={14} /></span> Lưu đơn
        </button>
      </div>
      <button className="af-btn-print" style={{ marginTop: '0px', opacity: 0.7 }} disabled={true}>
        <span style={{ display: 'inline-flex', alignItems: 'center' }}><Printer size={14} /></span> In đơn
      </button>
    </div>
  );
}
