import React, { useEffect, useState } from 'react';
import { CreditCard, Calendar, ShieldCheck, Sparkles, Check, AlertCircle } from 'lucide-react';
import AdminModal from './AdminModal';

const PLANS = [
  { id: 'FREE', name: 'Gói Miễn Phí (FREE)', desc: '50 đơn/ngày, 1 thiết bị', color: '#64748b' },
  { id: 'PRO', name: 'Gói Chuyên Nghiệp (PRO)', desc: '500 đơn/ngày, 5 thiết bị', color: '#2563eb' },
  { id: 'ENTERPRISE', name: 'Gói Doanh Nghiệp (VIP)', desc: '2,000+ đơn/ngày, 20 thiết bị', color: '#7c3aed' }
];

const DURATION_OPTIONS = [
  { value: 1, label: '+1 Tháng' },
  { value: 3, label: '+3 Tháng' },
  { value: 6, label: '+6 Tháng' },
  { value: 12, label: '+1 Năm' }
];

export default function OverrideSubscriptionModal({ open, subscription, onClose, onSubmit }) {
  const [plan, setPlan] = useState('PRO');
  const [months, setMonths] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && subscription) {
      setPlan(subscription.plan_code || subscription.plan_tier || 'PRO');
      setMonths(1);
      setError('');
      setSubmitting(false);
    }
  }, [subscription, open]);

  const handleApply = async () => {
    setSubmitting(true);
    setError('');

    try {
      await onSubmit?.({
        subscriptionId: subscription?.id,
        shopId: subscription?.shop_id,
        plan,
        months
      });
    } catch (err) {
      setError(err.message || 'Lỗi khi điều chỉnh gói cước.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open || !subscription) return null;

  return (
    <AdminModal open={open} onClose={onClose} title="Điều Chỉnh & Gia Hạn Gói Cước Thuê Bao">
      <div style={{ display: 'grid', gap: 16 }}>
        {/* Shop target card */}
        <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>CỬA HÀNG ĐƯỢC ĐIỀU CHỈNH GÓI</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>{subscription.shop_name || 'Cửa hàng'}</div>
          <div style={{ fontSize: 12.5, color: '#2563eb', fontWeight: 600, marginTop: 1 }}>Gói hiện tại: {subscription.plan_code || subscription.plan_tier || 'FREE'}</div>
        </div>

        {/* Plan selection */}
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 8 }}>
            Chọn Gói cước mới:
          </label>
          <div style={{ display: 'grid', gap: 8 }}>
            {PLANS.map(p => {
              const isSelected = plan === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => setPlan(p.id)}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: isSelected ? '2px solid #2563eb' : '1px solid #e2e8f0',
                    background: isSelected ? '#eff6ff' : '#ffffff',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 13.5, color: isSelected ? '#1d4ed8' : '#0f172a' }}>
                      {p.name}
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{p.desc}</div>
                  </div>
                  {isSelected && <Check size={16} color="#2563eb" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Extension months selection */}
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 8 }}>
            Thời gian gia hạn thêm:
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {DURATION_OPTIONS.map(d => {
              const isSelected = months === d.value;
              return (
                <button
                  type="button"
                  key={d.value}
                  onClick={() => setMonths(d.value)}
                  style={{
                    padding: '10px 8px',
                    borderRadius: 8,
                    border: isSelected ? '2px solid #2563eb' : '1px solid #cbd5e1',
                    background: isSelected ? '#2563eb' : '#ffffff',
                    color: isSelected ? '#ffffff' : '#334155',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    textAlign: 'center'
                  }}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
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
            type="button"
            disabled={submitting}
            onClick={handleApply}
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
              cursor: submitting ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 6px rgba(37,99,235,0.3)'
            }}
          >
            <ShieldCheck size={15} />
            {submitting ? 'Đang lưu...' : 'Áp Dụng Gói Cước'}
          </button>
        </div>
      </div>
    </AdminModal>
  );
}
