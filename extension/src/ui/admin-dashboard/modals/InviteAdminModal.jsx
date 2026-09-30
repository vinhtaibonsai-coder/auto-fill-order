import React, { useState, useEffect } from 'react';
import { UserPlus, Shield, Mail, Key, Eye, EyeOff, Sparkles, AlertCircle } from 'lucide-react';
import AdminModal from './AdminModal';

const ADMIN_ROLES = [
  { value: 'SUPPORT_ADMIN', label: 'Quản trị viên Hỗ trợ (Support Admin)', desc: 'Xem log, trả lời ticket và giả lập shop xử lý lỗi.' },
  { value: 'FINANCE_ADMIN', label: 'Quản trị viên Tài chính (Finance Admin)', desc: 'Quản lý doanh thu, ví tiền và gói cước thuê bao.' },
  { value: 'SYSTEM_ADMIN', label: 'Quản trị viên Hệ thống (Master Admin)', desc: 'Toàn quyền cấu hình nền tảng và cơ sở dữ liệu.' }
];

export default function InviteAdminModal({ open, onClose, onSubmit }) {
  const [form, setForm] = useState({
    email: '',
    fullName: '',
    password: '',
    role: 'SUPPORT_ADMIN'
  });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm({
        email: '',
        fullName: '',
        password: generateRandomPassword(),
        role: 'SUPPORT_ADMIN'
      });
      setShowPassword(true);
      setError('');
      setSubmitting(false);
    }
  }, [open]);

  function generateRandomPassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$';
    let res = '';
    for (let i = 0; i < 10; i++) res += chars.charAt(Math.floor(Math.random() * chars.length));
    return res;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email.trim()) {
      setError('Vui lòng nhập Email.');
      return;
    }
    if (!form.password || form.password.length < 6) {
      setError('Mật khẩu tạm thời phải có ít nhất 6 ký tự.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await onSubmit?.(form);
    } catch (err) {
      setError(err.message || 'Lỗi khi tạo tài khoản Admin.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <AdminModal open={open} onClose={onClose} title="Cấp Tài Khoản Quản Trị Viên (Admin Member)">
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>
        {/* Info inputs */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
              Họ và tên:
            </label>
            <input
              type="text"
              placeholder="Ví dụ: Trần Văn B"
              value={form.fullName}
              onChange={e => setForm({ ...form, fullName: e.target.value })}
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
              placeholder="admin.support@domain.com"
              value={form.email}
              onChange={e => { setForm({ ...form, email: e.target.value }); setError(''); }}
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

        {/* Role select */}
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
            Chọn vai trò Quản trị viên:
          </label>
          <div style={{ display: 'grid', gap: 8 }}>
            {ADMIN_ROLES.map(r => {
              const isSelected = form.role === r.value;
              return (
                <div
                  key={r.value}
                  onClick={() => setForm({ ...form, role: r.value })}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: isSelected ? '2px solid #2563eb' : '1px solid #e2e8f0',
                    background: isSelected ? '#eff6ff' : '#ffffff',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: isSelected ? '#1d4ed8' : '#0f172a' }}>
                      {r.label}
                    </span>
                    <input
                      type="radio"
                      name="adminRoleChoice"
                      checked={isSelected}
                      onChange={() => setForm({ ...form, role: r.value })}
                    />
                  </div>
                  <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>{r.desc}</div>
                </div>
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
            <UserPlus size={15} />
            {submitting ? 'Đang tạo...' : 'Tạo Tài Khoản Admin'}
          </button>
        </div>
      </form>
    </AdminModal>
  );
}
