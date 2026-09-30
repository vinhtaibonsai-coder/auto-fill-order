import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Users as UsersIcon, Shield, Lock, Unlock, Key, Edit2, LogOut, RefreshCw, AlertCircle, Trash2, Check, X, AlertTriangle, Package
} from 'lucide-react';
import { AdminService } from '../../../../domain/admin/admin.service.js';
import FilterBar from '../../components/FilterBar';
import ExportButton from '../../components/ExportButton';
import Pagination from '../../components/Pagination';
import EditUserRoleModal from '../../modals/EditUserRoleModal';
import ResetPasswordModal from '../../modals/ResetPasswordModal';
import EditUserProfileModal from '../../modals/EditUserProfileModal';
import { SkeletonHeroKpis, SkeletonTableRows } from '../../components/Skeleton';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [userTypeFilter, setUserTypeFilter] = useState('ALL'); // 'ALL' | 'SYSTEM_ADMIN' | 'SHOP_USERS'
  const [selectedRoleUser, setSelectedRoleUser] = useState(null);
  const [selectedPasswordUser, setSelectedPasswordUser] = useState(null);
  const [selectedProfileUser, setSelectedProfileUser] = useState(null);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(25);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [deletingBulk, setDeletingBulk] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const r = await AdminService.getUsersList({ limit: 1000 });
      if (r.success && Array.isArray(r.data)) {
        setUsers(r.data);
      } else {
        setUsers(Array.isArray(r?.data) ? r.data : []);
        if (!silent && r?.error) {
          console.warn('[Users] Tải danh sách người dùng gặp lỗi:', r.error);
        }
      }
    } catch (err) {
      console.error('[Users] Lỗi khi tải danh sách người dùng:', err);
      setUsers([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const handleRefresh = () => {
      load(true);
    };
    window.addEventListener('admin:refresh_data', handleRefresh);
    return () => window.removeEventListener('admin:refresh_data', handleRefresh);
  }, [load]);

  const userList = useMemo(() => (Array.isArray(users) ? users : []), [users]);

  const isSysAdmin = useCallback((u) => {
    const roleCode = String(u?.role || 'USER').toUpperCase();
    return roleCode === 'SYSTEM_ADMIN' || (u?.email || '').toLowerCase() === 'admin@luathuysinh.vn';
  }, []);

  const filtered = useMemo(() => {
    return userList.filter(u => {
      const isSys = isSysAdmin(u);
      if (userTypeFilter === 'SYSTEM_ADMIN' && !isSys) return false;
      if (userTypeFilter === 'SHOP_USERS' && isSys) return false;
      const matchStatus = !status || u.status === status;
      const matchSearch = `${u.email || ''} ${u.full_name || ''}`.toLowerCase().includes(search.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [userList, search, status, userTypeFilter, isSysAdmin]);

  const rows = filtered.slice((page - 1) * size, page * size);

  const allFilteredSelected = rows.length > 0 && rows.every(u => selectedIds.has(u.id));
  const someFilteredSelected = rows.some(u => selectedIds.has(u.id));

  const toggleSelectAll = () => {
    const next = new Set(selectedIds);
    if (allFilteredSelected) {
      rows.forEach(u => next.delete(u.id));
    } else {
      rows.forEach(u => next.add(u.id));
    }
    setSelectedIds(next);
  };

  const toggleSelectRow = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const activeCount = userList.filter(u => u.status === 'active').length;
  const suspendedCount = userList.filter(u => u.status === 'suspended').length;
  const sysAdminCount = userList.filter(isSysAdmin).length;
  const shopUsersCount = userList.filter(u => !isSysAdmin(u)).length;

  // System admin không tính đơn bóc tách & lượt AI để không làm sai lệch chỉ số vận hành của Shop
  const totalOrdersExtracted = useMemo(() => {
    return userList.filter(u => !isSysAdmin(u)).reduce((acc, u) => acc + (Number(u.orders_count) || 0), 0);
  }, [userList, isSysAdmin]);
  const totalOrdersToday = useMemo(() => {
    return userList.filter(u => !isSysAdmin(u)).reduce((acc, u) => acc + (Number(u.orders_today) || 0), 0);
  }, [userList, isSysAdmin]);
  const totalAiUsed = useMemo(() => {
    return userList.filter(u => !isSysAdmin(u)).reduce((acc, u) => acc + (Number(u.ai_usage_count) || 0), 0);
  }, [userList, isSysAdmin]);

  const toggle = async (u) => {
    const next = u.status === 'active' ? 'suspended' : 'active';
    const actionName = next === 'suspended' ? 'KHÓA' : 'KÍCH HOẠT LẠI';
    if (!confirm(`Bạn có chắc chắn muốn ${actionName} tài khoản "${u.email}"?`)) return;
    const r = await AdminService.updateUserStatus(u.id, u.status, next);
    if (r.success) {
      if (next === 'suspended') {
        await AdminService.forceLogoutUser(u.id).catch(() => {});
      }
      load();
    } else {
      alert(r.error);
    }
  };

  const handleDeleteUser = async (u) => {
    const roleCode = String(u.role || '').toUpperCase();
    if (roleCode === 'SYSTEM_ADMIN' || u.email === 'admin@luathuysinh.vn') {
      alert('Không thể xóa tài khoản Quản trị viên hệ thống (Master Admin)!');
      return;
    }

    if (!confirm(`⚠️ CẢNH BÁO NGUY HIỂM:\nBạn có chắc chắn muốn XÓA VĨNH VIỄN tài khoản "${u.email}" (${u.full_name || 'Không tên'})?\n\nThao tác này sẽ xóa sạch quyền, tư cách thành viên shop và tài khoản đăng nhập của người dùng.`)) {
      return;
    }

    const r = await AdminService.deleteUser(u.id, u.email);
    if (r.success) {
      alert(`Đã xóa vĩnh viễn tài khoản "${u.email}" thành công.`);
      const next = new Set(selectedIds);
      next.delete(u.id);
      setSelectedIds(next);
      load();
    } else {
      alert(r.error || 'Lỗi khi xóa tài khoản.');
    }
  };

  const handleBulkDelete = async () => {
    const count = selectedIds.size;
    if (count === 0) return;

    if (!confirm(`⚠️ CẢNH BÁO NGUY HIỂM:\nBạn có chắc chắn muốn XÓA VĨNH VIỄN ${count} tài khoản người dùng đã chọn?`)) {
      return;
    }

    setDeletingBulk(true);
    try {
      const r = await AdminService.deleteMultipleUsers(Array.from(selectedIds));
      if (r.success) {
        alert(`Đã xóa thành công ${r.count || count} tài khoản.`);
        setSelectedIds(new Set());
        load();
      } else {
        alert(r.error || 'Lỗi khi xóa nhiều tài khoản.');
      }
    } finally {
      setDeletingBulk(false);
    }
  };

  const handleForceLogout = async (u) => {
    if (!confirm(`Đăng xuất cưỡng bức tài khoản "${u.email}" khỏi TẤT CẢ các thiết bị đang đăng nhập?`)) return;
    const r = await AdminService.forceLogoutUser(u.id);
    if (r.success) {
      alert(`Đã đăng xuất toàn bộ thiết bị của tài khoản "${u.email}".`);
      load();
    } else {
      alert(r.error);
    }
  };

  const saveRole = async ({ userId, role }) => {
    const r = await AdminService.setUserRole(userId, role);
    if (r.success) {
      setSelectedRoleUser(null);
      alert('Đã cập nhật vai trò thành công!');
      load();
    } else {
      alert(r.error);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
            <UsersIcon size={22} color="#2563eb" />
            Quản Lý Người Dùng & Nhân Viên (Users & RBAC)
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
            Quản lý tài khoản, đổi mật khẩu, phân quyền quản trị, khóa hoặc xóa vĩnh viễn người dùng
          </p>
        </div>

        <button
          onClick={load}
          style={{
            padding: '7px 12px',
            fontSize: 12,
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: 8,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4
          }}
        >
          <RefreshCw size={13} className={loading ? 'dash-spin' : ''} /> Tải lại
        </button>
      </div>

      {/* Stats Cards */}
      {loading ? (
        <SkeletonHeroKpis count={4} columns="repeat(auto-fit, minmax(200px, 1fr))" />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
          <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
              <UsersIcon size={22} />
            </div>
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>TỔNG NGƯỜI DÙNG</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>{userList.length}</div>
            </div>
          </div>

          <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a' }}>
              <Check size={22} />
            </div>
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>ĐANG HOẠT ĐỘNG</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#16a34a', lineHeight: 1.2 }}>{activeCount}</div>
            </div>
          </div>

          <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626' }}>
              <AlertTriangle size={22} />
            </div>
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>ĐANG BỊ KHÓA</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#dc2626', lineHeight: 1.2 }}>{suspendedCount}</div>
            </div>
          </div>

          <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a' }}>
              <Package size={22} />
            </div>
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>TỔNG ĐƠN BÓC TÁCH</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#16a34a', lineHeight: 1.2 }}>
                {totalOrdersExtracted.toLocaleString()}
                {totalOrdersToday > 0 && (
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#2563eb', marginLeft: 6 }}>
                    (+{totalOrdersToday} hôm nay)
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: '10px 16px', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1d4ed8' }}>
            Đã chọn <strong>{selectedIds.size}</strong> tài khoản người dùng
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setSelectedIds(new Set())}
              style={{ padding: '5px 10px', fontSize: 12, background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 6, cursor: 'pointer' }}
            >
              Bỏ chọn
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={deletingBulk}
              style={{ padding: '5px 12px', fontSize: 12, background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <Trash2 size={13} /> Xóa {selectedIds.size} tài khoản đã chọn
            </button>
          </div>
        </div>
      )}

      {/* Tách riêng Admin hệ thống & Người dùng theo Shop */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button
          type="button"
          onClick={() => { setUserTypeFilter('ALL'); setPage(1); }}
          style={{
            padding: '7px 16px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            border: 'none',
            background: userTypeFilter === 'ALL' ? '#2563eb' : '#f1f5f9',
            color: userTypeFilter === 'ALL' ? '#ffffff' : '#475569',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          <UsersIcon size={14} /> Tất cả người dùng ({userList.length})
        </button>
        <button
          type="button"
          onClick={() => { setUserTypeFilter('SYSTEM_ADMIN'); setPage(1); }}
          style={{
            padding: '7px 16px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            border: 'none',
            background: userTypeFilter === 'SYSTEM_ADMIN' ? '#2563eb' : '#f1f5f9',
            color: userTypeFilter === 'SYSTEM_ADMIN' ? '#ffffff' : '#475569',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          <Shield size={14} /> Quản trị viên Hệ thống ({sysAdminCount})
        </button>
        <button
          type="button"
          onClick={() => { setUserTypeFilter('SHOP_USERS'); setPage(1); }}
          style={{
            padding: '7px 16px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            border: 'none',
            background: userTypeFilter === 'SHOP_USERS' ? '#2563eb' : '#f1f5f9',
            color: userTypeFilter === 'SHOP_USERS' ? '#ffffff' : '#475569',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          <Package size={14} /> Người dùng theo Shop ({shopUsersCount})
        </button>
      </div>

      {/* Filter Bar */}
      <FilterBar
        onSearch={setSearch}
        placeholder="Tìm theo email, họ và tên..."
        filters={[
          {
            key: 'status',
            label: 'Trạng thái',
            value: status,
            onChange: setStatus,
            options: [
              { value: '', label: 'Tất cả trạng thái' },
              { value: 'active', label: 'Đang hoạt động' },
              { value: 'suspended', label: 'Đang bị khóa' }
            ]
          }
        ]}
        actions={<ExportButton rows={filtered} filename="danh-sach-nguoi-dung.csv" />}
      />

      {/* Table Card */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid #e2e8f0', borderRadius: 12 }}>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th style={{ width: 40 }}>
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    ref={el => { if (el) el.indeterminate = someFilteredSelected && !allFilteredSelected; }}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th>Tài khoản người dùng</th>
                <th>Vai trò hệ thống</th>
                <th>Shop được truy cập</th>
                <th>📊 Đã Bóc Tách (Đơn / AI)</th>
                <th>Trạng thái</th>
                <th style={{ textAlign: 'right' }}>Thao tác quản trị</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonTableRows columns={7} rows={6} />
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '36px 20px', color: '#94a3b8' }}>
                    Không tìm thấy người dùng nào phù hợp.
                  </td>
                </tr>
              ) : (
                rows.map(u => {
                  const roleCode = String(u.role || 'USER').toUpperCase();
                  const isAdmin = ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'ADMIN'].includes(roleCode) || isSysAdmin(u);
                  const isSuspended = u.status === 'suspended';
                  const isSelected = selectedIds.has(u.id);

                  return (
                    <tr key={u.id} style={{ background: isSelected ? '#f8fafc' : 'inherit' }}>
                      <td>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectRow(u.id)}
                        />
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontWeight: 700, color: '#0f172a', fontSize: 13.5 }}>
                            {u.full_name || 'Chưa đặt tên'}
                          </span>
                          <button
                            onClick={() => setSelectedProfileUser(u)}
                            title="Chỉnh sửa họ tên"
                            style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', color: '#64748b' }}
                          >
                            <Edit2 size={12} />
                          </button>
                        </div>
                        <small style={{ color: '#64748b', fontSize: 12, display: 'block', marginTop: 1 }}>
                          {u.email}
                        </small>
                      </td>
                      <td>
                        <span
                          className={`badge ${isAdmin ? 'badge-info' : ''}`}
                          style={{
                            background: isAdmin ? '#eff6ff' : '#f1f5f9',
                            color: isAdmin ? '#1d4ed8' : '#475569',
                            border: isAdmin ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: 6
                          }}
                        >
                          {isAdmin ? 'SYSTEM_ADMIN' : roleCode}
                        </span>
                      </td>
                      <td>
                        {isAdmin ? (
                          <span style={{ color: '#2563eb', fontWeight: 700, fontSize: 12.5, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            🌐 Toàn quyền hệ thống
                          </span>
                        ) : (Array.isArray(u.shops) && u.shops.length > 0) ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {u.shops.map((s, idx) => (
                              <span key={idx} style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#1e293b', padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
                                🏪 {s?.shop_name || s?.name || (typeof s === 'string' ? s : 'Shop')}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: 12.5 }}>Chưa gán Shop</span>
                        )}
                      </td>
                      <td>
                        {isAdmin ? (
                          <span style={{ fontSize: 12, color: '#64748b', fontStyle: 'italic', background: '#f8fafc', padding: '3px 8px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                            — (Không tính / Quản trị)
                          </span>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontWeight: 800, fontSize: 13, color: (u.orders_count || 0) > 0 ? '#16a34a' : '#64748b' }}>
                                📦 {(u.orders_count || 0).toLocaleString()} đơn
                              </span>
                              {(u.orders_today || 0) > 0 && (
                                <span style={{ fontSize: 10.5, background: '#dcfce7', color: '#15803d', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>
                                  +{u.orders_today} hôm nay
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 11.5, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span>⚡ {(u.ai_usage_count || 0).toLocaleString()} lượt AI</span>
                              {(u.ai_usage_today || 0) > 0 && (
                                <span style={{ color: '#2563eb', fontWeight: 700 }}>
                                  (+{u.ai_usage_today})
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${!isSuspended ? 'badge-success' : 'badge-danger'}`}>
                          {!isSuspended ? 'Hoạt động' : 'Tạm khóa'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          {/* Đổi mật khẩu */}
                          <button
                            onClick={() => setSelectedPasswordUser(u)}
                            title="Đặt lại mật khẩu mới"
                            style={{
                              padding: '5px 8px',
                              fontSize: 12,
                              background: '#ffffff',
                              color: '#2563eb',
                              border: '1px solid #bfdbfe',
                              borderRadius: 6,
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3
                            }}
                          >
                            <Key size={13} /> Đổi pass
                          </button>

                          {/* Đổi vai trò */}
                          <button
                            onClick={() => setSelectedRoleUser(u)}
                            title="Thay đổi vai trò RBAC"
                            style={{
                              padding: '5px 8px',
                              fontSize: 12,
                              background: '#ffffff',
                              border: '1px solid #cbd5e1',
                              borderRadius: 6,
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3
                            }}
                          >
                            <Shield size={13} color="#2563eb" /> Vai trò
                          </button>

                          {/* Đăng xuất thiết bị */}
                          <button
                            onClick={() => handleForceLogout(u)}
                            title="Đăng xuất khỏi mọi thiết bị"
                            style={{
                              padding: '5px 7px',
                              fontSize: 12,
                              background: '#ffffff',
                              color: '#475569',
                              border: '1px solid #cbd5e1',
                              borderRadius: 6,
                              cursor: 'pointer'
                            }}
                          >
                            <LogOut size={13} />
                          </button>

                          {/* Khóa / Kích hoạt */}
                          <button
                            onClick={() => toggle(u)}
                            title={!isSuspended ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
                            style={{
                              padding: '5px 8px',
                              fontSize: 12,
                              background: !isSuspended ? '#fee2e2' : '#dcfce7',
                              color: !isSuspended ? '#b91c1c' : '#15803d',
                              border: !isSuspended ? '1px solid #fecaca' : '1px solid #bbf7d0',
                              borderRadius: 6,
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3
                            }}
                          >
                            {!isSuspended ? (
                              <><Lock size={12} /> Khóa</>
                            ) : (
                              <><Unlock size={12} /> Mở</>
                            )}
                          </button>

                          {/* Xóa tài khoản */}
                          {!isAdmin && (
                            <button
                              onClick={() => handleDeleteUser(u)}
                              title="Xóa vĩnh viễn tài khoản"
                              style={{
                                padding: '5px 7px',
                                fontSize: 12,
                                background: '#ffffff',
                                color: '#dc2626',
                                border: '1px solid #fecaca',
                                borderRadius: 6,
                                cursor: 'pointer'
                              }}
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <Pagination
        page={page}
        pageSize={size}
        total={filtered.length}
        onPageChange={setPage}
        onPageSizeChange={setSize}
      />

      {/* Modals */}
      <EditUserRoleModal
        open={Boolean(selectedRoleUser)}
        user={selectedRoleUser}
        onClose={() => setSelectedRoleUser(null)}
        onSubmit={saveRole}
      />

      <ResetPasswordModal
        open={Boolean(selectedPasswordUser)}
        user={selectedPasswordUser}
        onClose={() => setSelectedPasswordUser(null)}
        onSuccess={load}
      />

      <EditUserProfileModal
        open={Boolean(selectedProfileUser)}
        user={selectedProfileUser}
        onClose={() => setSelectedProfileUser(null)}
        onSuccess={load}
      />
    </div>
  );
}
