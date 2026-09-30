import React, { useState, useEffect } from 'react';
import {
  Users, UserPlus, Trash2, Shield, Mail, AlertCircle, CheckCircle, Search, Sparkles, Key, Eye, EyeOff, UserCheck
} from 'lucide-react';
import { AdminService } from '../../../domain/admin/admin.service.js';
import { AdminRepository } from '../../../domain/admin/admin.repository.js';
import AdminModal from './AdminModal';

const SHOP_ROLES = [
  { value: 'OWNER', label: 'Chủ sở hữu (Owner)' },
  { value: 'MANAGER', label: 'Quản lý (Manager)' },
  { value: 'SHOP_STAFF', label: 'Nhân viên đóng hàng (Staff)' },
  { value: 'VIEWER', label: 'Người xem (Viewer)' }
];

export default function ShopMembersModal({ open, shop, onClose, onMembersChanged }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  
  // Tab state: 'existing' | 'new'
  const [activeTab, setActiveTab] = useState('existing');

  // Form existing user
  const [targetUserQuery, setTargetUserQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState('SHOP_STAFF');

  // Form new user
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [newRole, setNewRole] = useState('SHOP_STAFF');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const loadMembers = async () => {
    if (!shop?.id) return;
    setLoading(true);
    try {
      const res = await AdminService.getShopMembers(shop.id);
      if (res.success) {
        setMembers(res.data || []);
      }
    } finally {
      setLoading(false);
    }
  };

  function generateRandomPassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$';
    let res = '';
    for (let i = 0; i < 9; i++) res += chars.charAt(Math.floor(Math.random() * chars.length));
    return res;
  }

  useEffect(() => {
    if (open && shop?.id) {
      setTargetUserQuery('');
      setSelectedUser(null);
      setSelectedRole('SHOP_STAFF');
      setNewEmail('');
      setNewName('');
      setNewPassword(generateRandomPassword());
      setShowPassword(true);
      setNewRole('SHOP_STAFF');
      setActiveTab('existing');
      setError('');
      loadMembers();
      AdminService.getAllUsers().then(res => {
        if (res.success && Array.isArray(res.data)) setAllUsers(res.data);
      });
    }
  }, [open, shop]);

  const existingMemberUserIds = new Set(members.map(m => m.user_id));

  const userSuggestions = allUsers.filter(u => {
    if (existingMemberUserIds.has(u.id)) return false; // Không gợi ý người đã có trong shop
    const q = targetUserQuery.trim().toLowerCase();
    if (!q) return false;
    const email = String(u.email || '').toLowerCase();
    const name = String(u.full_name || '').toLowerCase();
    return email.includes(q) || name.includes(q);
  }).slice(0, 6);

  // Thêm người dùng có sẵn
  const handleAddExistingMember = async (e) => {
    e.preventDefault();
    const query = targetUserQuery.trim();
    if (!query && !selectedUser) {
      setError('Vui lòng chọn hoặc nhập Email người dùng có sẵn trong hệ thống.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      let targetUserId = selectedUser?.id;
      if (!targetUserId) {
        const found = await AdminRepository.findUserByEmailOrId(query);
        if (!found || !found.id) {
          throw new Error(`Không tìm thấy tài khoản "${query}" trong hệ thống. Bạn có thể chuyển sang tab "Tạo tài khoản mới" bên cạnh để cấp tài khoản.`);
        }
        targetUserId = found.id;
      }

      const res = await AdminService.assignUserShop(targetUserId, shop.id, selectedRole);
      if (res.success) {
        alert('Đã thêm nhân viên vào Shop thành công!');
        setTargetUserQuery('');
        setSelectedUser(null);
        await loadMembers();
        onMembersChanged?.();
      } else {
        setError(res.error || 'Lỗi khi gán nhân viên vào Shop.');
      }
    } catch (err) {
      setError(err.message || 'Lỗi hệ thống khi gán nhân viên.');
    } finally {
      setSubmitting(false);
    }
  };

  // Tạo mới và thêm vào shop
  const handleCreateAndAddMember = async (e) => {
    e.preventDefault();
    if (!newEmail.trim()) {
      setError('Vui lòng nhập Email cho nhân viên mới.');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setError('Mật khẩu tạm thời phải có ít nhất 6 ký tự.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await AdminService.createAndAddShopMember(shop.id, {
        email: newEmail.trim(),
        fullName: newName.trim(),
        password: newPassword,
        roleCode: newRole
      });

      if (res.success) {
        alert(`Đã tạo tài khoản "${newEmail}" và thêm vào Shop thành công!`);
        setNewEmail('');
        setNewName('');
        setNewPassword(generateRandomPassword());
        await loadMembers();
        onMembersChanged?.();
      } else {
        setError(res.error || 'Lỗi khi tạo và gán tài khoản mới.');
      }
    } catch (err) {
      setError(err.message || 'Lỗi hệ thống khi tạo tài khoản.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveMember = async (member) => {
    const userName = member.profiles?.full_name || member.profiles?.email || member.user_id;
    if (!confirm(`Bạn có chắc chắn muốn XÓA nhân viên "${userName}" khỏi Shop "${shop.name}"?`)) return;

    try {
      const res = await AdminService.removeShopMember(shop.id, member.user_id);
      if (res.success) {
        alert('Đã xóa nhân viên khỏi Shop.');
        await loadMembers();
        onMembersChanged?.();
      } else {
        alert(res.error || 'Lỗi khi xóa nhân viên.');
      }
    } catch (err) {
      alert(err.message || 'Lỗi khi xóa nhân viên.');
    }
  };

  if (!open || !shop) return null;

  return (
    <AdminModal open={open} onClose={onClose} title={`Quản Lý Nhân Viên — ${shop.name}`}>
      <div style={{ display: 'grid', gap: 16 }}>
        {/* Section 1: Danh sách thành viên hiện tại */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Danh sách thành viên hiện tại ({members.length}):</span>
            {loading && <span style={{ fontSize: 12, color: '#64748b' }}>Đang tải...</span>}
          </div>

          <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', maxHeight: 200, overflowY: 'auto' }}>
            {members.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 16px', color: '#94a3b8', fontSize: 13 }}>
                {loading ? 'Đang tải danh sách...' : 'Chưa có nhân viên nào được gán vào Shop này.'}
              </div>
            ) : (
              members.map(m => {
                const profile = m.profiles || {};
                const roleCode = String(m.roles?.code || m.role || m.role_code || 'STAFF').toUpperCase();
                const isOwner = roleCode === 'OWNER' || roleCode === 'SHOP_OWNER';

                return (
                  <div
                    key={m.id || m.user_id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderBottom: '1px solid #f1f5f9',
                      background: '#ffffff'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', background: isOwner ? '#2563eb' : '#64748b', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 }}>
                        {(profile.email || 'U')[0].toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13.5, color: '#0f172a' }}>
                          {profile.full_name || 'Nhân viên'}
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>{profile.email || m.user_id}</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        className="badge"
                        style={{
                          background: isOwner ? '#eff6ff' : '#f1f5f9',
                          color: isOwner ? '#1d4ed8' : '#475569',
                          border: isOwner ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                          fontWeight: 700,
                          fontSize: 11,
                          padding: '2px 8px'
                        }}
                      >
                        {roleCode}
                      </span>
                      {!isOwner && (
                        <button
                          onClick={() => handleRemoveMember(m)}
                          title="Xóa khỏi shop"
                          style={{
                            background: '#fee2e2',
                            border: '1px solid #fecaca',
                            color: '#dc2626',
                            borderRadius: 6,
                            padding: '4px 6px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Section 2: Thêm nhân viên với 2 Tab (Người có sẵn vs Tạo mới) */}
        <div style={{ background: '#f8fafc', padding: 14, borderRadius: 10, border: '1px solid #e2e8f0' }}>
          {/* Tab Navigation */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, borderBottom: '1px solid #e2e8f0', paddingBottom: 8 }}>
            <button
              type="button"
              onClick={() => { setActiveTab('existing'); setError(''); }}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: activeTab === 'existing' ? '1px solid #2563eb' : '1px solid transparent',
                background: activeTab === 'existing' ? '#eff6ff' : 'transparent',
                color: activeTab === 'existing' ? '#1d4ed8' : '#64748b',
                fontWeight: 700,
                fontSize: 12.5,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5
              }}
            >
              <UserCheck size={14} /> 1. Chọn Người Dùng Có Sẵn
            </button>

            <button
              type="button"
              onClick={() => { setActiveTab('new'); setError(''); }}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: activeTab === 'new' ? '1px solid #2563eb' : '1px solid transparent',
                background: activeTab === 'new' ? '#eff6ff' : 'transparent',
                color: activeTab === 'new' ? '#1d4ed8' : '#64748b',
                fontWeight: 700,
                fontSize: 12.5,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5
              }}
            >
              <UserPlus size={14} /> 2. Cấp Tài Khoản Mới Trực Tiếp
            </button>
          </div>

          {/* TAB 1: Người dùng có sẵn */}
          {activeTab === 'existing' && (
            <form onSubmit={handleAddExistingMember} style={{ display: 'grid', gap: 10 }}>
              <div style={{ position: 'relative' }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                  Tìm kiếm theo Email hoặc Họ tên người dùng:
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="Nhập email nhân viên có sẵn trên hệ thống..."
                    value={targetUserQuery}
                    onChange={e => {
                      setTargetUserQuery(e.target.value);
                      setSelectedUser(null);
                      setError('');
                    }}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '8px 10px 8px 32px',
                      fontSize: 13,
                      borderRadius: 8,
                      border: '1px solid #cbd5e1'
                    }}
                  />
                  <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: 10, top: 10 }} />
                </div>

                {/* Autocomplete suggestions */}
                {userSuggestions.length > 0 && !selectedUser && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      zIndex: 10,
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: 8,
                      marginTop: 4,
                      boxShadow: '0 8px 20px rgba(0,0,0,0.15)',
                      maxHeight: 180,
                      overflowY: 'auto'
                    }}
                  >
                    {userSuggestions.map(u => (
                      <div
                        key={u.id}
                        onClick={() => {
                          setSelectedUser(u);
                          setTargetUserQuery(u.email);
                        }}
                        style={{
                          padding: '8px 12px',
                          cursor: 'pointer',
                          borderBottom: '1px solid #f1f5f9',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                        onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}
                      >
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>{u.full_name || 'Người dùng'}</div>
                          <div style={{ fontSize: 11.5, color: '#64748b' }}>{u.email}</div>
                        </div>
                        <span style={{ fontSize: 11, background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, color: '#475569' }}>
                          {u.role || 'USER'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'flex-end' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    Vai trò trong Shop:
                  </label>
                  <select
                    value={selectedRole}
                    onChange={e => setSelectedRole(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 8, border: '1px solid #cbd5e1' }}
                  >
                    {SHOP_ROLES.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '8px 18px',
                    borderRadius: 8,
                    border: 'none',
                    background: '#2563eb',
                    color: '#ffffff',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <UserPlus size={14} />
                  {submitting ? 'Đang thêm...' : '+ Thêm vào Shop'}
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: Cấp tài khoản mới */}
          {activeTab === 'new' && (
            <form onSubmit={handleCreateAndAddMember} style={{ display: 'grid', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    Email đăng nhập mới: *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="nhanvien@domain.com"
                    value={newEmail}
                    onChange={e => { setNewEmail(e.target.value); setError(''); }}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 13, borderRadius: 8, border: '1px solid #cbd5e1' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    Họ và tên nhân viên:
                  </label>
                  <input
                    type="text"
                    placeholder="Ví dụ: Nguyễn Thị Hoa"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 13, borderRadius: 8, border: '1px solid #cbd5e1' }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>
                      Mật khẩu tạm: *
                    </label>
                    <button
                      type="button"
                      onClick={() => { setNewPassword(generateRandomPassword()); setShowPassword(true); }}
                      style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 2 }}
                    >
                      <Sparkles size={11} /> Tạo ngẫu nhiên
                    </button>
                  </div>

                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '8px 30px 8px 10px', fontSize: 13, borderRadius: 8, border: '1px solid #cbd5e1', fontFamily: showPassword ? 'inherit' : 'monospace' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{ position: 'absolute', right: 6, top: 7, background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    Vai trò trong Shop:
                  </label>
                  <select
                    value={newRole}
                    onChange={e => setNewRole(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 8, border: '1px solid #cbd5e1' }}
                  >
                    {SHOP_ROLES.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '8px 20px',
                    borderRadius: 8,
                    border: 'none',
                    background: '#16a34a',
                    color: '#ffffff',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    boxShadow: '0 2px 6px rgba(22,163,74,0.3)'
                  }}
                >
                  <UserPlus size={14} />
                  {submitting ? 'Đang tạo & thêm...' : '+ Cấp Tài Khoản & Thêm Vào Shop'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Error Alert */}
        {error && (
          <div style={{ background: '#fee2e2', color: '#dc2626', padding: '10px 14px', borderRadius: 8, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {/* Modal Close Button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #f1f5f9', paddingTop: 12 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '7px 18px',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#475569',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Đóng
          </button>
        </div>
      </div>
    </AdminModal>
  );
}
