import React, { useEffect, useState } from 'react';
import { Bot, Zap, PlusCircle, AlertCircle, CheckCircle2 } from 'lucide-react';
import AdminModal from './AdminModal';

const PRESET_AMOUNTS = [
  { amount: 500, label: '+500 đơn', desc: 'Gói thử nghiệm' },
  { amount: 1000, label: '+1,000 đơn', desc: 'Phổ biến' },
  { amount: 5000, label: '+5,000 đơn', desc: 'Cho shop lớn' },
  { amount: 10000, label: '+10,000 đơn', desc: 'Doanh nghiệp' }
];

export default function TopupQuotaModal({ open, shops = [], initialShopId = '', onClose, onSubmit }) {
  const [shopId, setShopId] = useState(initialShopId);
  const [amount, setAmount] = useState(1000);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setShopId(initialShopId);
    setAmount(1000);
    setError('');
    setSubmitting(false);
  }, [initialShopId, open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!shopId) {
      setError('Vui lòng chọn Cửa hàng cần cấp thêm Quota.');
      return;
    }
    if (!amount || amount <= 0) {
      setError('Số lượng quota cấp bù phải lớn hơn 0.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await onSubmit?.({ shopId, amount: Number(amount) });
    } catch (err) {
      setError(err.message || 'Lỗi khi cấp Quota AI.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <AdminModal open={open} onClose={onClose} title="Cấp Hạn Mức Quota AI (AI Parsing Quota)">
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>
        {/* Shop Select */}
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
            Chọn Cửa hàng / Chi nhánh nhận Quota: *
          </label>
          <select
            value={shopId}
            onChange={e => { setShopId(e.target.value); setError(''); }}
            style={{ width: '100%', padding: '10px 12px', fontSize: 13.5, borderRadius: 8, border: '1px solid #cbd5e1' }}
          >
            <option value="">-- Chọn Cửa hàng trong hệ thống --</option>
            {shops.map(s => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.status === 'active' ? 'Đang hoạt động' : 'Tạm khóa'})
              </option>
            ))}
          </select>
        </div>

        {/* Preset Amount Pills */}
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 8 }}>
            Chọn mức cấp bù lượt bóc tách:
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {PRESET_AMOUNTS.map(p => {
              const isSelected = amount === p.amount;
              return (
                <div
                  key={p.amount}
                  onClick={() => { setAmount(p.amount); setError(''); }}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 10,
                    border: isSelected ? '2px solid #2563eb' : '1px solid #e2e8f0',
                    background: isSelected ? '#eff6ff' : '#ffffff',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: 14, color: isSelected ? '#1d4ed8' : '#0f172a' }}>
                    {p.label}
                  </div>
                  <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>{p.desc}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Custom Input */}
        <div>
          <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
            Hoặc nhập số lượng tùy chỉnh:
          </label>
          <input
            type="number"
            min={1}
            step="1"
            value={amount}
            onChange={e => setAmount(Number(e.target.value))}
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
            disabled={submitting || !shopId}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 20px',
              borderRadius: 8,
              border: 'none',
              background: '#2563eb',
              color: '#ffffff',
              fontSize: 13,
              fontWeight: 700,
              cursor: submitting || !shopId ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 6px rgba(37,99,235,0.3)'
            }}
          >
            <Zap size={15} />
            {submitting ? 'Đang cấp quota...' : 'Xác Nhận Cấp Quota AI'}
          </button>
        </div>
      </form>
    </AdminModal>
  );
}
