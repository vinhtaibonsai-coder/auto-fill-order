import React, { useState, useEffect } from 'react';
import { Key, Eye, EyeOff, Sparkles, AlertCircle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { AdminService } from '../../../domain/admin/admin.service.js';
import AdminModal from './AdminModal';

export default function ResetPasswordModal({ open, user, onClose, onSuccess }) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [forceLogout, setForceLogout] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setPassword('');
      setShowPassword(false);
      setForceLogout(true);
      setError('');
    }
  }, [open]);

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    let result = '';
    for (let i = 0; i < 10; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(result);
    setShowPassword(true);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password || password.length < 6) {
      setError('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }

    if (!user || !user.id) {
      setError('Không xác định được tài khoản người dùng.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await AdminService.resetUserPassword(user.id, password, forceLogout);
      if (res.success) {
        alert(`Đã đặt lại mật khẩu cho tài khoản "${user.email}" thành công!${forceLogout ? '\n(Đã đăng xuất khỏi mọi thiết bị cũ)' : ''}`);
        onSuccess?.();
        onClose?.();
      } else {
        setError(res.error || 'Lỗi khi đặt lại mật khẩu.');
      }
    } catch (err) {
      setError(err.message || 'Lỗi hệ thống khi đặt lại mật khẩu.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open || !user) return null;

  return (
    <AdminModal open={open} onClose={onClose} title="Đặt lại Mật khẩu Người dùng">
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>
        {/* User Card */}
        <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>TÀI KHOẢN CẦN ĐẶT LẠI MẬT KHẨU</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>{user.full_name || 'Người dùng'}</div>
          <div style={{ fontSize: 13, color: '#2563eb', fontWeight: 600, marginTop: 1 }}>{user.email}</div>
          <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace', marginTop: 2 }}>ID: {user.id}</div>
        </div>

        {/* Password Input with eye toggle and random generator */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>
              Nhập mật khẩu mới:
            </label>
            <button
              type="button"
              onClick={generateRandomPassword}
              style={{
                background: '#eff6ff',
                color: '#1d4ed8',
                border: '1px solid #bfdbfe',
                padding: '3px 8px',
                borderRadius: 6,
                fontSize: 11.5,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              <Sparkles size={13} /> Tạo ngẫu nhiên
            </button>
          </div>

          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              required
              minLength={6}
              placeholder="Tối thiểu 6 ký tự..."
              value={password}
              onChange={e => {
                setPassword(e.target.value);
                setError('');
              }}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '10px 40px 10px 12px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                fontSize: 14,
                outline: 'none'
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute',
                right: 8,
                top: 8,
                background: 'none',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                padding: 4
              }}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* Force Logout Checkbox */}
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', background: '#fffbeb', padding: '10px 12px', borderRadius: 8, border: '1px solid #fef3c7' }}>
          <input
            type="checkbox"
            checked={forceLogout}
            onChange={e => setForceLogout(e.target.checked)}
            style={{ marginTop: 2 }}
          />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#92400e', display: 'flex', alignItems: 'center', gap: 4 }}>
              <ShieldAlert size={14} /> Đăng xuất khỏi tất cả các thiết bị cũ
            </div>
            <div style={{ fontSize: 11.5, color: '#b45309', marginTop: 1 }}>
              Thu hồi ngay lập tức mọi phiên đăng nhập trên trình duyệt Extension / Web của tài khoản này.
            </div>
          </div>
        </label>

        {/* Error message */}
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
              padding: '8px 18px',
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
            <Key size={15} />
            {submitting ? 'Đang lưu...' : 'Xác nhận Đổi mật khẩu'}
          </button>
        </div>
      </form>
    </AdminModal>
  );
}
