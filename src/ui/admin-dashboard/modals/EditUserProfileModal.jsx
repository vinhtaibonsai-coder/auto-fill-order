import React, { useState, useEffect } from 'react';
import { User, AlertCircle, Save } from 'lucide-react';
import { AdminService } from '../../../domain/admin/admin.service.js';
import AdminModal from './AdminModal';

export default function EditUserProfileModal({ open, user, onClose, onSuccess }) {
  const [fullName, setFullName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && user) {
      setFullName(user.full_name || user.name || '');
      setError('');
    }
  }, [open, user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setError('Họ và tên không được để trống.');
      return;
    }

    if (!user || !user.id) {
      setError('Không xác định được tài khoản người dùng.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await AdminService.updateUserName(user.id, fullName.trim());
      if (res.success) {
        alert(`Đã cập nhật họ tên cho tài khoản "${user.email}" thành công!`);
        onSuccess?.();
        onClose?.();
      } else {
        setError(res.error || 'Lỗi khi cập nhật thông tin.');
      }
    } catch (err) {
      setError(err.message || 'Lỗi hệ thống khi cập nhật thông tin.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open || !user) return null;

  return (
    <AdminModal open={open} onClose={onClose} title="Chỉnh sửa Hồ sơ Người dùng">
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>
        {/* User Card */}
        <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>TÀI KHOẢN EMAIL</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#2563eb', marginTop: 2 }}>{user.email}</div>
          <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace', marginTop: 2 }}>ID: {user.id}</div>
        </div>

        {/* Full Name Input */}
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
            Họ và tên hiển thị:
          </label>
          <input
            type="text"
            required
            placeholder="Ví dụ: Nguyễn Văn A"
            value={fullName}
            onChange={e => {
              setFullName(e.target.value);
              setError('');
            }}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              fontSize: 14,
              outline: 'none'
            }}
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
            <Save size={15} />
            {submitting ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </div>
      </form>
    </AdminModal>
  );
}
