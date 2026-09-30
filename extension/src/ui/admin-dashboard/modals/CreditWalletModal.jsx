import React, { useState, useEffect } from 'react';
import { CreditCard, PlusCircle, AlertCircle, CheckCircle2, DollarSign, History } from 'lucide-react';
import { AdminService } from '../../../domain/admin/admin.service.js';
import AdminModal from './AdminModal';

const PRESET_AMOUNTS = [
  { value: 100000, label: '100.000 đ' },
  { value: 200000, label: '200.000 đ' },
  { value: 500000, label: '500.000 đ' },
  { value: 1000000, label: '1.000.000 đ' }
];

export default function CreditWalletModal({ open, shop, onClose, onSuccess }) {
  const [amount, setAmount] = useState(200000);
  const [description, setDescription] = useState('Nạp tiền hỗ trợ / khuyến mãi');
  const [walletDetails, setWalletDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const loadDetails = async () => {
    if (!shop?.id) return;
    setLoadingDetails(true);
    const res = await AdminService.getWalletDetails(shop.id);
    if (res.success) {
      setWalletDetails(res.data);
    }
    setLoadingDetails(false);
  };

  useEffect(() => {
    if (open && shop) {
      setAmount(200000);
      setDescription('Nạp tiền hỗ trợ CSKH');
      setError('');
      setSubmitting(false);
      loadDetails();
    }
  }, [open, shop]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || amount <= 0) {
      setError('Vui lòng nhập số tiền nạp lớn hơn 0.');
      return;
    }

    if (!description || !description.trim()) {
      setError('Lý do nạp tiền ví là bắt buộc đối với thao tác của Admin.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const refId = `ADMIN-TOPUP-${Date.now()}`;
      const res = await AdminService.topupWallet(shop.id, amount, description.trim(), refId);
      if (res.success) {
        alert(`Đã nạp ${amount.toLocaleString('vi-VN')} đ vào ví Shop "${shop.name}" thành công!`);
        onSuccess?.();
        onClose?.();
      } else {
        setError(res.error || 'Lỗi khi nạp tiền vào ví.');
      }
    } catch (err) {
      setError(err.message || 'Lỗi hệ thống khi nạp ví.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open || !shop) return null;

  return (
    <AdminModal open={open} onClose={onClose} title="Nạp Tiền Vào Ví Shop (Prepaid Wallet)">
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>
        {/* Target Shop Info & Current Balance */}
        <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: 8, border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>CỬA HÀNG ĐƯỢC NẠP VÍ</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>{shop.name}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 1 }}>ID: {shop.id}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>SỐ DƯ HIỆN TẠI</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#166534', marginTop: 2 }}>
              {loadingDetails ? '...' : `${Number(walletDetails?.balance || 0).toLocaleString('vi-VN')} đ`}
            </div>
            {Number(walletDetails?.reserved_balance || 0) > 0 && (
              <div style={{ fontSize: 11, color: '#f59e0b' }}>
                Đang tạm giữ: {Number(walletDetails.reserved_balance).toLocaleString('vi-VN')} đ
              </div>
            )}
          </div>
        </div>

        {/* Preset Amounts */}
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 8 }}>
            Chọn số tiền nạp nhanh:
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {PRESET_AMOUNTS.map(p => {
              const isSelected = amount === p.value;
              return (
                <button
                  type="button"
                  key={p.value}
                  onClick={() => setAmount(p.value)}
                  style={{
                    padding: '10px 6px',
                    borderRadius: 8,
                    border: isSelected ? '2px solid #2563eb' : '1px solid #cbd5e1',
                    background: isSelected ? '#eff6ff' : '#ffffff',
                    color: isSelected ? '#1d4ed8' : '#334155',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    textAlign: 'center'
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom amount */}
        <div>
          <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
            Số tiền nạp tùy chỉnh (VNĐ):
          </label>
          <input
            type="number"
            min={10000}
            step={50000}
            value={amount}
            onChange={e => setAmount(Number(e.target.value))}
            style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', fontSize: 14, fontWeight: 700, borderRadius: 8, border: '1px solid #cbd5e1' }}
          />
        </div>

        {/* Description / Reason (Mandatory) */}
        <div>
          <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
            Lý do nạp tiền ví (Bắt buộc kiểm toán): <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <input
            type="text"
            required
            placeholder="Ví dụ: Nạp hỗ trợ CSKH sau sự cố, Khuyến mãi nạp đầu..."
            value={description}
            onChange={e => setDescription(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', fontSize: 13, borderRadius: 8, border: '1px solid #cbd5e1' }}
          />
        </div>

        {/* Recent Ledger History */}
        {walletDetails?.ledger?.length > 0 && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
              <History size={13} /> Lịch sử biến động ví gần nhất (Immutable Ledger):
            </div>
            <div style={{ maxHeight: 120, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12 }}>
              {walletDetails.ledger.slice(0, 5).map(item => (
                <div key={item.id} style={{ padding: '6px 10px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontWeight: 'bold', color: item.direction === 'credit' ? '#166534' : '#991b1b' }}>
                      {item.direction === 'credit' ? '+' : '-'}{Number(item.amount).toLocaleString('vi-VN')} đ
                    </span>
                    <span style={{ color: '#64748b', marginLeft: 8 }}>{item.description || item.reference_type}</span>
                  </div>
                  <span style={{ color: '#94a3b8', fontSize: 11 }}>
                    {new Date(item.created_at).toLocaleDateString('vi-VN')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

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
              background: '#2563eb',
              color: '#ffffff',
              fontSize: 13,
              fontWeight: 700,
              cursor: submitting ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 6px rgba(37,99,235,0.3)'
            }}
          >
            <CreditCard size={15} />
            {submitting ? 'Đang nạp tiền...' : 'Xác Nhận Nạp Ví'}
          </button>
        </div>
      </form>
    </AdminModal>
  );
}
