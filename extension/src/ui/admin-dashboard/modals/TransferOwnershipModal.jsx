import React, { useEffect, useState, useMemo } from 'react';
import { UserCheck, Search, Mail, Shield, AlertCircle, CheckCircle, ArrowRight, User } from 'lucide-react';
import { AdminService } from '../../../domain/admin/admin.service.js';
import AdminModal from './AdminModal';

export default function TransferOwnershipModal({ open, shop, onClose, onSuccess }) {
  const [targetInput, setTargetInput] = useState('');
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setTargetInput('');
      setSelectedUser(null);
      setError('');
      setLoadingUsers(true);
      AdminService.getAllUsers()
        .then(res => {
          if (res.success && Array.isArray(res.data)) {
            setUsers(res.data);
          }
        })
        .finally(() => setLoadingUsers(false));
    }
  }, [open]);

  // Gợi ý danh sách người dùng khi gõ email/tên
  const suggestions = useMemo(() => {
    const q = targetInput.trim().toLowerCase();
    if (!q) return users.slice(0, 5);
    return users.filter(u => {
      const email = String(u.email || '').toLowerCase();
      const name = String(u.full_name || u.name || '').toLowerCase();
      const id = String(u.id || '').toLowerCase();
      return email.includes(q) || name.includes(q) || id.includes(q);
    }).slice(0, 6);
  }, [users, targetInput]);

  const handleSelectUser = (user) => {
    setSelectedUser(user);
    setTargetInput(user.email || user.id);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const query = targetInput.trim();
    if (!query) {
      setError('Vui lòng nhập Email hoặc chọn tài khoản người dùng.');
      return;
    }

    if (!shop || !shop.id) {
      setError('Không xác định được Shop cần chuyển.');
      return;
    }

    const targetDisplayName = selectedUser ? (selectedUser.full_name || selectedUser.email) : query;
    if (!confirm(`Bạn có chắc chắn muốn CHUYỂN TOÀN BỘ QUYỀN SỞ HỮU Shop "${shop.name}" cho tài khoản "${targetDisplayName}" không?`)) {
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const res = await AdminService.transferShopOwnership(shop.id, selectedUser?.id || query);
      if (res.success) {
        alert(`Đã chuyển quyền sở hữu Shop "${shop.name}" thành công!`);
        onSuccess?.();
        onClose?.();
      } else {
        setError(res.error || 'Lỗi khi chuyển quyền sở hữu.');
      }
    } catch (err) {
      setError(err.message || 'Lỗi hệ thống khi chuyển quyền sở hữu.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open || !shop) return null;

  return (
    <AdminModal open={open} onClose={onClose} title="Chuyển quyền sở hữu Cửa hàng">
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>
        {/* Info Box Shop */}
        <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>CỬA HÀNG ĐƯỢC CHUYỂN</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>{shop.name}</div>
          <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace', marginTop: 2 }}>ID: {shop.id}</div>
        </div>

        {/* Input Search Email / Tên */}
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
            Nhập Email hoặc Tên tài khoản chủ mới:
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              required
              placeholder="Ví dụ: yen@luathuysinh.vn hoặc Tên người dùng..."
              value={targetInput}
              onChange={e => {
                setTargetInput(e.target.value);
                setSelectedUser(null);
                setError('');
              }}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '10px 12px 10px 36px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                fontSize: 14,
                outline: 'none'
              }}
            />
            <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: 12, top: 12 }} />
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div style={{ background: '#fee2e2', color: '#dc2626', padding: '10px 14px', borderRadius: 8, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {/* Selected User Badge */}
        {selectedUser && (
          <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '10px 14px', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#10b981', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                {selectedUser.email ? selectedUser.email[0].toUpperCase() : 'U'}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#065f46' }}>{selectedUser.full_name || selectedUser.name || 'Người dùng'}</div>
                <div style={{ fontSize: 12, color: '#047857' }}>{selectedUser.email}</div>
              </div>
            </div>
            <span style={{ fontSize: 11, background: '#d1fae5', color: '#065f46', padding: '3px 8px', borderRadius: 6, fontWeight: 700 }}>
              ĐÃ CHỌN
            </span>
          </div>
        )}

        {/* Quick Suggestion List */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>
            {loadingUsers ? 'Đang tải danh sách tài khoản...' : 'Gợi ý tài khoản trong hệ thống:'}
          </div>
          <div style={{ display: 'grid', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
            {suggestions.map(u => {
              const isCurrSelected = selectedUser?.id === u.id || targetInput.trim().toLowerCase() === String(u.email || '').toLowerCase();
              return (
                <div
                  key={u.id}
                  onClick={() => handleSelectUser(u)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: isCurrSelected ? '1px solid #3b82f6' : '1px solid #f1f5f9',
                    background: isCurrSelected ? '#eff6ff' : '#ffffff',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Mail size={14} color="#64748b" />
                    <div>
                      <span style={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>
                        {u.email || 'Không có email'}
                      </span>
                      {u.full_name && (
                        <span style={{ fontSize: 12, color: '#64748b', marginLeft: 8 }}>
                          ({u.full_name})
                        </span>
                      )}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>
                    {u.id.slice(0, 8)}...
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Submit Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8, borderTop: '1px solid #f1f5f9', paddingTop: 14 }}>
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
            <UserCheck size={16} />
            {submitting ? 'Đang chuyển...' : 'Xác nhận Chuyển chủ'}
          </button>
        </div>
      </form>
    </AdminModal>
  );
}
