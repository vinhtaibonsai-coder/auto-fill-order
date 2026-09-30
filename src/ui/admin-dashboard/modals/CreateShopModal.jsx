import React, { useState, useEffect } from 'react';
import { Store, User, Mail, Key, Sparkles, Eye, EyeOff, Shield, Smartphone, Bot, AlertCircle, PlusCircle, Check } from 'lucide-react';
import AdminModal from './AdminModal';

const PLANS = [
  { id: 'FREE', name: 'Miễn phí (FREE)', badge: 'Gói cơ bản', quota: '50 đơn/ngày', devices: 1, color: '#64748b', bg: '#f1f5f9' },
  { id: 'PRO', name: 'Chuyên nghiệp (PRO)', badge: 'Phổ biến nhất', quota: '500 đơn/ngày', devices: 5, color: '#2563eb', bg: '#eff6ff' },
  { id: 'ENTERPRISE', name: 'Doanh nghiệp (VIP)', badge: 'Không giới hạn', quota: '2,000+ đơn/ngày', devices: 20, color: '#7c3aed', bg: '#f5f3ff' }
];

export default function CreateShopModal({ open, onClose, onSubmit }) {
  const [form, setForm] = useState({
    shopName: '',
    ownerName: '',
    ownerEmail: '',
    password: '',
    planCode: 'PRO',
    maxDevices: 5,
    dailyAiLimit: 500
  });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm({
        shopName: '',
        ownerName: '',
        ownerEmail: '',
        password: generateRandomPassword(),
        planCode: 'PRO',
        maxDevices: 5,
        dailyAiLimit: 500
      });
      setShowPassword(true);
      setError('');
      setSubmitting(false);
    }
  }, [open]);

  function generateRandomPassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$';
    let res = '';
    for (let i = 0; i < 9; i++) res += chars.charAt(Math.floor(Math.random() * chars.length));
    return res;
  }

  const handleSelectPlan = (plan) => {
    setForm(prev => ({
      ...prev,
      planCode: plan.id,
      maxDevices: plan.devices,
      dailyAiLimit: plan.id === 'FREE' ? 50 : plan.id === 'PRO' ? 500 : 2000
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.shopName.trim()) {
      setError('Vui lòng nhập tên Shop/Chi nhánh.');
      return;
    }
    if (!form.ownerEmail.trim()) {
      setError('Vui lòng nhập Email chủ shop.');
      return;
    }
    if (!form.password || form.password.length < 6) {
      setError('Mật khẩu tạm phải có ít nhất 6 ký tự.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await onSubmit?.(form);
    } catch (err) {
      setError(err.message || 'Lỗi khi tạo Shop.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <AdminModal open={open} onClose={onClose} title="Khởi Tạo Cửa Hàng & Cấp Tài Khoản Mới">
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 18 }}>
        {/* Section 1: Thông tin Cửa hàng */}
        <div style={{ background: '#f8fafc', padding: 16, borderRadius: 10, border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Store size={15} /> 1. Thông Tin Cửa Hàng / Chi Nhánh
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                Tên Cửa hàng / Chi nhánh: *
              </label>
              <input
                type="text"
                required
                placeholder="Ví dụ: Shop Lũa Thủy Sinh - Chi nhánh 2"
                value={form.shopName}
                onChange={e => { setForm({ ...form, shopName: e.target.value }); setError(''); }}
                style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', fontSize: 13.5, borderRadius: 8, border: '1px solid #cbd5e1' }}
              />
            </div>
          </div>
        </div>

        {/* Section 2: Tài khoản Chủ Shop */}
        <div style={{ background: '#f8fafc', padding: 16, borderRadius: 10, border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <User size={15} /> 2. Tài Khoản Chủ Sở Hữu (Shop Owner)
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                Họ và tên chủ shop:
              </label>
              <input
                type="text"
                placeholder="Ví dụ: Nguyễn Văn A"
                value={form.ownerName}
                onChange={e => setForm({ ...form, ownerName: e.target.value })}
                style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', fontSize: 13, borderRadius: 8, border: '1px solid #cbd5e1' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                Email đăng nhập: *
              </label>
              <input
                type="email"
                required
                placeholder="chushop@example.com"
                value={form.ownerEmail}
                onChange={e => { setForm({ ...form, ownerEmail: e.target.value }); setError(''); }}
                style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', fontSize: 13, borderRadius: 8, border: '1px solid #cbd5e1' }}
              />
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <label style={{ fontSize: 12.5, fontWeight: 700, color: '#334155' }}>
                  Mật khẩu tạm thời: *
                </label>
                <button
                  type="button"
                  onClick={() => { setForm({ ...form, password: generateRandomPassword() }); setShowPassword(true); }}
                  style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  <Sparkles size={12} /> Tạo lại mật khẩu
                </button>
              </div>

              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={form.password}
                  onChange={e => { setForm({ ...form, password: e.target.value }); setError(''); }}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '9px 36px 9px 12px', fontSize: 13, borderRadius: 8, border: '1px solid #cbd5e1', fontFamily: showPassword ? 'inherit' : 'monospace' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: 8, top: 8, background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Gói Dịch Vụ & Hạn Mức */}
        <div>
          <label style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Shield size={15} color="#2563eb" /> 3. Chọn Gói Dịch Vụ Khởi Tạo:
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            {PLANS.map(p => {
              const isSelected = form.planCode === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => handleSelectPlan(p)}
                  style={{
                    padding: '12px',
                    borderRadius: 10,
                    border: isSelected ? '2px solid #2563eb' : '1px solid #e2e8f0',
                    background: isSelected ? '#eff6ff' : '#ffffff',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 800, fontSize: 13, color: isSelected ? '#1d4ed8' : '#0f172a' }}>{p.id}</span>
                    {isSelected && <Check size={16} color="#2563eb" />}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{p.quota}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{p.devices} thiết bị</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Error alert */}
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
              padding: '9px 18px',
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
              padding: '9px 22px',
              borderRadius: 8,
              border: 'none',
              background: '#2563eb',
              color: '#ffffff',
              fontSize: 13.5,
              fontWeight: 700,
              cursor: submitting ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 8px rgba(37,99,235,0.35)'
            }}
          >
            <PlusCircle size={16} />
            {submitting ? 'Đang khởi tạo Shop...' : 'Tạo Shop & Cấp Tài Khoản'}
          </button>
        </div>
      </form>
    </AdminModal>
  );
}
