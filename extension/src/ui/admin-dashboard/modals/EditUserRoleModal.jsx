import React, { useEffect, useState } from 'react';
import { Shield, AlertCircle, Save } from 'lucide-react';
import AdminModal from './AdminModal';

const SYSTEM_ROLES = [
  { value: 'SYSTEM_ADMIN', label: 'Quản trị viên Hệ thống (Master System Admin)', desc: 'Toàn quyền cấu hình nền tảng, cơ sở dữ liệu và thanh toán.' },
  { value: 'SUPPORT_ADMIN', label: 'Quản trị viên Hỗ trợ (Support Admin)', desc: 'Hỗ trợ kỹ thuật, xem log và giả lập shop xử lý sự cố.' },
  { value: 'FINANCE_ADMIN', label: 'Quản trị viên Tài chính (Finance Admin)', desc: 'Quản lý doanh thu, ví tiền và gói cước thuê bao.' },
  { value: 'USER', label: 'Người dùng Tiêu chuẩn (Standard Shop User)', desc: 'Chỉ truy cập vào các Cửa hàng được phân quyền.' }
];

export default function EditUserRoleModal({ open, user, onClose, onSubmit }) {
  const [role, setRole] = useState('USER');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && user) {
      setRole(user.role || 'USER');
      setSubmitting(false);
    }
  }, [user, open]);

  const handleSave = async () => {
    setSubmitting(true);
    try {
      await onSubmit?.({ userId: user?.id, role });
    } finally {
      setSubmitting(false);
    }
  };

  if (!open || !user) return null;

  return (
    <AdminModal open={open} onClose={onClose} title="Phân Quyền Vai Trò Người Dùng (RBAC)">
      <div style={{ display: 'grid', gap: 16 }}>
        {/* User Info */}
        <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>TÀI KHOẢN ĐƯỢC PHÂN QUYỀN</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>{user.full_name || 'Người dùng'}</div>
          <div style={{ fontSize: 13, color: '#2563eb', fontWeight: 600, marginTop: 1 }}>{user.email}</div>
        </div>

        {/* Role Options */}
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 8 }}>
            Chọn vai trò cấp Hệ thống:
          </label>
          <div style={{ display: 'grid', gap: 8 }}>
            {SYSTEM_ROLES.map(r => {
              const isSelected = role === r.value;
              return (
                <div
                  key={r.value}
                  onClick={() => setRole(r.value)}
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
                    <span style={{ fontWeight: 700, fontSize: 13.5, color: isSelected ? '#1d4ed8' : '#0f172a' }}>
                      {r.label}
                    </span>
                    <input
                      type="radio"
                      name="systemRole"
                      checked={isSelected}
                      onChange={() => setRole(r.value)}
                    />
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                    {r.desc}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Buttons */}
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
            onClick={handleSave}
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
            <Shield size={15} />
            {submitting ? 'Đang lưu...' : 'Lưu vai trò mới'}
          </button>
        </div>
      </div>
    </AdminModal>
  );
}
