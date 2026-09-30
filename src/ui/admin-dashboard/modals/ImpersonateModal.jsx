import React, { useState, useEffect } from 'react';
import { Eye, ShieldAlert, AlertCircle, Clock, CheckCircle2 } from 'lucide-react';
import { AdminService } from '../../../domain/admin/admin.service.js';
import AdminModal from './AdminModal';

const PRESET_REASONS = [
  'Hỗ trợ khách hàng kiểm tra lỗi bóc tách đơn hàng',
  'Kiểm tra kết nối và điền form hãng vận chuyển VNPost / J&T',
  'Cấu hình đồng bộ danh bạ khách hàng Customer Hub',
  'Khắc phục sự cố theo yêu cầu của Chủ Shop'
];

export default function ImpersonateModal({ open, shop, onClose, onSuccess }) {
  const [reason, setReason] = useState(PRESET_REASONS[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && shop) {
      setReason(PRESET_REASONS[0]);
      setError('');
      setSubmitting(false);
    }
  }, [open, shop]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Vui lòng chọn hoặc nhập lý do giả lập.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await AdminService.startImpersonation(shop.id, shop.name, reason.trim());
      if (res.success) {
        window.dispatchEvent(new CustomEvent('admin:impersonate', { detail: res.data }));
        alert(`Đã kích hoạt chế độ Giả lập cho Shop "${shop.name}" thành công!`);
        onSuccess?.();
        onClose?.();
      } else {
        setError(res.error || 'Lỗi khi bắt đầu giả lập.');
      }
    } catch (err) {
      setError(err.message || 'Lỗi hệ thống khi bắt đầu giả lập.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open || !shop) return null;

  return (
    <AdminModal open={open} onClose={onClose} title="Giả Lập Cửa Hàng (Audited Impersonation)">
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>
        {/* Warning Banner */}
        <div style={{ background: '#fffbeb', padding: '12px 14px', borderRadius: 8, border: '1px solid #fef3c7', display: 'flex', gap: 10 }}>
          <ShieldAlert size={20} color="#b45309" style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 12.5, color: '#92400e' }}>
            <strong>Cảnh báo kiểm toán an toàn:</strong> Bạn đang chuẩn bị đăng nhập với tư cách Shop <strong>"{shop.name}"</strong>. Toàn bộ thao tác sẽ được ghi vào nhật ký kiểm toán (Audit Logs) và phiên giả lập tự động hết hạn sau <strong>30 phút</strong>.
          </div>
        </div>

        {/* Preset Reasons */}
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 8 }}>
            Chọn lý do hỗ trợ kỹ thuật:
          </label>
          <div style={{ display: 'grid', gap: 6 }}>
            {PRESET_REASONS.map(r => {
              const isSelected = reason === r;
              return (
                <div
                  key={r}
                  onClick={() => setReason(r)}
                  style={{
                    padding: '9px 12px',
                    borderRadius: 8,
                    border: isSelected ? '2px solid #2563eb' : '1px solid #e2e8f0',
                    background: isSelected ? '#eff6ff' : '#ffffff',
                    cursor: 'pointer',
                    fontSize: 13,
                    color: isSelected ? '#1d4ed8' : '#334155',
                    fontWeight: isSelected ? 700 : 500,
                    transition: 'all 0.15s ease'
                  }}
                >
                  {r}
                </div>
              );
            })}
          </div>
        </div>

        {/* Custom Reason */}
        <div>
          <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
            Hoặc nhập lý do chi tiết:
          </label>
          <input
            type="text"
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Nhập lý do giả lập..."
            style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', fontSize: 13, borderRadius: 8, border: '1px solid #cbd5e1' }}
          />
        </div>

        {/* Error Alert */}
        {error && (
          <div style={{ background: '#fee2e2', color: '#dc2626', padding: '10px 14px', borderRadius: 8, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid #f1f5f9', paddingTop: 14 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#475569',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Hủy bỏ
          </button>
          <button
            type="submit"
            disabled={submitting}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 20px',
              borderRadius: 8,
              border: 'none',
              background: '#d97706',
              color: '#ffffff',
              fontSize: 13,
              fontWeight: 700,
              cursor: submitting ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 6px rgba(217,119,6,0.35)'
            }}
          >
            <Eye size={15} />
            {submitting ? 'Đang kích hoạt...' : 'Bắt Đầu Giả Lập Shop'}
          </button>
        </div>
      </form>
    </AdminModal>
  );
}
