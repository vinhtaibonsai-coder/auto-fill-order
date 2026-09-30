import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Store, RefreshCw, Trash2, Shield, CreditCard, Bot, UserCheck, Eye,
  Lock, Unlock, Copy, Check, Search, Filter, AlertTriangle, Users, Smartphone, X, CheckSquare, Square, Zap, Package
} from 'lucide-react';
import { AdminService } from '../../../../domain/admin/admin.service.js';
import FilterBar from '../../components/FilterBar';
import ExportButton from '../../components/ExportButton';
import Pagination from '../../components/Pagination';
import TransferOwnershipModal from '../../modals/TransferOwnershipModal';
import ShopMembersModal from '../../modals/ShopMembersModal';
import CreditWalletModal from '../../modals/CreditWalletModal';
import ShopAiRulesModal from '../../modals/ShopAiRulesModal';
import ImpersonateModal from '../../modals/ImpersonateModal';
import TopupQuotaModal from '../../modals/TopupQuotaModal';
import Shop360Modal from '../../modals/Shop360Modal';

const removeVietnameseTones = (str) => {
  if (!str) return '';
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
};

export default function ShopList() {
  const [shops, setShops] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [loading, setLoading] = useState(true);
  const [purging, setPurging] = useState(false);
  const [deletingBulk, setDeletingBulk] = useState(false);
  const [copiedId, setCopiedId] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Modals state
  const [shop360Target, setShop360Target] = useState(null);
  const [transferModalShop, setTransferModalShop] = useState(null);
  const [membersModalShop, setMembersModalShop] = useState(null);
  const [creditModalShop, setCreditModalShop] = useState(null);
  const [aiRulesModalShop, setAiRulesModalShop] = useState(null);
  const [impersonateModalShop, setImpersonateModalShop] = useState(null);
  const [topupModalShop, setTopupModalShop] = useState(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const r = await AdminService.getShopsList();
    if (r.success) {
      setShops(r.data || []);
    } else if (!silent) {
      alert(r.error);
    }
    if (!silent) setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const handleRefresh = () => {
      load(true);
    };
    window.addEventListener('admin:refresh_data', handleRefresh);
    return () => window.removeEventListener('admin:refresh_data', handleRefresh);
  }, [load]);

  const copyShopId = (id) => {
    navigator.clipboard.writeText(id).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(''), 2000);
    });
  };

  const filtered = useMemo(() => {
    const cleanSearch = removeVietnameseTones(search);
    return shops.filter(s => {
      const matchStatus = !status || s.status === status;
      if (!cleanSearch) return matchStatus;
      const target = removeVietnameseTones(`${s.name || ''} ${s.id || ''}`);
      const matchSearch = target.includes(cleanSearch);
      return matchStatus && matchSearch;
    });
  }, [shops, search, status]);

  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const allFilteredSelected = paginated.length > 0 && paginated.every(s => selectedIds.has(s.id));
  const someFilteredSelected = paginated.some(s => selectedIds.has(s.id));

  const toggleSelectAll = () => {
    const next = new Set(selectedIds);
    if (allFilteredSelected) {
      paginated.forEach(s => next.delete(s.id));
    } else {
      paginated.forEach(s => next.add(s.id));
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

  const activeCount = shops.filter(s => String(s.status).toLowerCase() === 'active').length;
  const inactiveCount = shops.filter(s => String(s.status).toLowerCase() !== 'active').length;
  const totalShopOrders = useMemo(() => {
    return shops.reduce((acc, s) => acc + (Number(s.orders_count) || 0), 0);
  }, [shops]);
  const totalShopOrdersToday = useMemo(() => {
    return shops.reduce((acc, s) => acc + (Number(s.orders_today) || 0), 0);
  }, [shops]);

  const toggleStatus = async (shop) => {
    const isAct = String(shop.status).toLowerCase() === 'active';
    const next = isAct ? 'Suspended' : 'Active';
    if (!confirm(`Bạn có chắc muốn ${isAct ? 'TẠM KHÓA' : 'KÍCH HOẠT'} Shop "${shop.name}"?`)) return;
    const r = await AdminService.updateShopStatus(shop.id, shop.status, next);
    if (r.success) {
      load();
    } else {
      alert(r.error);
    }
  };

  const updateShopFeatureFlags = (shopId, flags, patch) => AdminService.updateShopFeatureFlags(shopId, flags, patch);
  const startImpersonation = (shopId, shopName, reason) => AdminService.startImpersonation(shopId, shopName, reason);

  const restoreShop = async (shop) => {
    if (!confirm(`Khôi phục Cửa hàng "${shop.name}" sang trạng thái Đang hoạt động (Active)?`)) return;
    const r = await AdminService.restoreShop(shop.id, shop.name);
    if (r.success) {
      alert(`Đã khôi phục Shop "${shop.name}" thành công.`);
      load();
    } else {
      alert(r.error);
    }
  };

  const deleteSingleShop = async (shop) => {
    if (!confirm(`⚠️ CẢNH BÁO: Bạn có chắc chắn muốn XÓA Shop "${shop.name}" (${shop.id})?`)) {
      return;
    }
    const r = await AdminService.deleteShop(shop.id, shop.name);
    if (r.success) {
      alert(`Đã xóa Shop "${shop.name}" thành công.`);
      const next = new Set(selectedIds);
      next.delete(shop.id);
      setSelectedIds(next);
      load();
    } else {
      alert(r.error);
    }
  };

  const handleBulkDelete = async () => {
    const count = selectedIds.size;
    if (count === 0) return;
    if (!confirm(`⚠️ CẢNH BÁO NGUY HIỂM:\nBạn có chắc chắn muốn XÓA ${count} Shop đã chọn?`)) {
      return;
    }
    setDeletingBulk(true);
    try {
      const r = await AdminService.deleteMultipleShops(Array.from(selectedIds));
      if (r.success) {
        alert(`Đã xóa thành công ${r.count || count} Shop.`);
        setSelectedIds(new Set());
        load();
      } else {
        alert(r.error || 'Lỗi khi xóa nhiều shop.');
      }
    } finally {
      setDeletingBulk(false);
    }
  };

  const handlePurgeInactive = async () => {
    if (!confirm('Bạn có muốn dọn dẹp các shop rác không hoạt động (0 thành viên, 0 thiết bị)?')) {
      return;
    }
    setPurging(true);
    try {
      const r = await AdminService.purgeInactiveShops();
      if (r.success) {
        alert(`Đã dọn dẹp ${r.count || 0} Shop không hoạt động.`);
        setSelectedIds(new Set());
        load();
      } else {
        alert(r.error || 'Lỗi khi dọn dẹp shop.');
      }
    } finally {
      setPurging(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Store size={22} color="#2563eb" />
            Quản Lý Cửa Hàng & Chi Nhánh (Shops)
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
            Quản lý multi-tenant, phân quyền nhân viên, cấp Quota AI, nạp ví và dọn dẹp chi nhánh
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
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
            <RefreshCw size={13} className={loading ? 'dash-spin' : ''} /> Làm mới
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
        <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
            <Store size={22} />
          </div>
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>TỔNG SỐ SHOP</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>{shops.length}</div>
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
            <div style={{ fontSize: 11.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>TẠM KHÓA / INACTIVE</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#dc2626', lineHeight: 1.2 }}>{inactiveCount}</div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a' }}>
            <Package size={22} />
          </div>
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>TỔNG ĐƠN BÓC TÁCH</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#16a34a', lineHeight: 1.2 }}>
              {totalShopOrders.toLocaleString()}
              {totalShopOrdersToday > 0 && (
                <span style={{ fontSize: 12, fontWeight: 600, color: '#2563eb', marginLeft: 6 }}>
                  (+{totalShopOrdersToday} hôm nay)
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: '10px 16px', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1d4ed8' }}>
            Đã chọn <strong>{selectedIds.size}</strong> cửa hàng
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
              <Trash2 size={13} /> Xóa {selectedIds.size} shop đã chọn
            </button>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <FilterBar
        onSearch={setSearch}
        placeholder="Tìm kiếm shop theo tên hoặc ID..."
        filters={[
          {
            key: 'status',
            label: 'Trạng thái',
            value: status,
            onChange: setStatus,
            options: [
              { value: '', label: 'Tất cả trạng thái' },
              { value: 'active', label: 'Đang hoạt động' },
              { value: 'suspended', label: 'Đang tạm khóa' }
            ]
          }
        ]}
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handlePurgeInactive}
              disabled={purging}
              style={{ padding: '6px 12px', fontSize: 12, background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 8, cursor: 'pointer' }}
            >
              Dọn dẹp shop rác
            </button>
            <ExportButton rows={filtered} filename="danh-sach-cua-hang.csv" />
          </div>
        }
      />

      {/* Main Table Card */}
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
                <th>Cửa hàng / Chi nhánh</th>
                <th>Gói dịch vụ</th>
                <th>User / Thiết bị</th>
                <th>⚡ AI Quota & Bóc Tách</th>
                <th>Trạng thái</th>
                <th style={{ textAlign: 'right' }}>Thao tác quản trị</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '36px 20px', color: '#94a3b8' }}>
                    {loading ? 'Đang tải dữ liệu cửa hàng...' : 'Không tìm thấy cửa hàng nào.'}
                  </td>
                </tr>
              ) : (
                paginated.map(shop => {
                  const isAct = String(shop.status || '').toLowerCase() === 'active';
                  const isSelected = selectedIds.has(shop.id);
                  const planCode = String(shop.plan_code || 'FREE').toUpperCase();
                  const isPro = planCode === 'PRO' || planCode === 'ENTERPRISE';

                  return (
                    <tr key={shop.id} style={{ background: isSelected ? '#f8fafc' : 'inherit' }}>
                      <td>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectRow(shop.id)}
                        />
                      </td>
                      <td>
                        <div
                          onClick={() => setShop360Target(shop)}
                          style={{
                            fontWeight: 800,
                            fontSize: 14,
                            color: '#2563eb',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6
                          }}
                          title="Bấm để mở Trung Tâm Quản Lý Shop 360°"
                        >
                          <span style={{ textDecoration: 'underline', textUnderlineOffset: 2 }}>{shop.name}</span>
                          <span style={{ fontSize: 11, background: '#eff6ff', color: '#1d4ed8', padding: '1px 6px', borderRadius: 4, fontWeight: 700, border: '1px solid #bfdbfe' }}>
                            360° ↗
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                          <code style={{ fontSize: 11, color: '#64748b', background: '#f1f5f9', padding: '1px 5px', borderRadius: 4 }}>
                            {shop.id}
                          </code>
                          <button
                            onClick={() => copyShopId(shop.id)}
                            title="Copy ID"
                            style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', color: copiedId === shop.id ? '#16a34a' : '#94a3b8' }}
                          >
                            {copiedId === shop.id ? <Check size={12} /> : <Copy size={12} />}
                          </button>
                        </div>
                      </td>
                      <td>
                        <span
                          className={`badge ${isPro ? 'badge-info' : ''}`}
                          style={{
                            background: isPro ? '#eff6ff' : '#f1f5f9',
                            color: isPro ? '#1d4ed8' : '#475569',
                            border: isPro ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: 6
                          }}
                        >
                          {planCode}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontSize: 12.5, color: '#334155', display: 'flex', gap: 10 }}>
                          <span title="Số lượng tài khoản"><Users size={13} style={{ verticalAlign: -2 }} /> {shop.users_count || 0}</span>
                          <span title="Số lượng thiết bị"><Smartphone size={13} style={{ verticalAlign: -2 }} /> {shop.devices_count || 0}</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12.5, fontWeight: 700 }}>
                            <span style={{ color: (shop.ai_used_today || 0) > 0 ? '#2563eb' : '#334155' }}>
                              {(shop.ai_used_today || 0).toLocaleString('vi-VN')}
                            </span>
                            <span style={{ color: '#64748b', fontWeight: 500 }}>
                              / {Number(shop.daily_ai_limit || 500).toLocaleString('vi-VN')} AI
                            </span>
                          </div>
                          <div style={{ fontSize: 11.5, color: (shop.orders_count || 0) > 0 ? '#16a34a' : '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span>📦 {(shop.orders_count || 0).toLocaleString('vi-VN')} đơn</span>
                            {(shop.orders_today || 0) > 0 && (
                              <span style={{ color: '#15803d', fontWeight: 700, background: '#dcfce7', padding: '0 4px', borderRadius: 3, fontSize: 10.5 }}>
                                +{shop.orders_today} hôm nay
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${isAct ? 'badge-success' : 'badge-danger'}`}>
                          {isAct ? 'Hoạt động' : 'Tạm khóa'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          {/* 0. Nút Quản lý 360 */}
                          <button
                            onClick={() => setShop360Target(shop)}
                            title="Mở toàn diện bảng chức năng quản lý Shop 360°"
                            style={{
                              padding: '5px 10px',
                              borderRadius: 6,
                              border: '1px solid #2563eb',
                              background: '#2563eb',
                              color: '#ffffff',
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              boxShadow: '0 1px 2px rgba(37,99,235,0.2)'
                            }}
                          >
                            <Store size={13} /> Quản lý 360°
                          </button>

                          {/* 1. Nút Quản lý Nhân viên */}
                          <button
                            onClick={() => setMembersModalShop(shop)}
                            title="Quản lý danh sách nhân viên"
                            style={{
                              padding: '5px 9px',
                              borderRadius: 6,
                              border: '1px solid #bfdbfe',
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4
                            }}
                          >
                            <Users size={13} /> Nhân viên
                          </button>

                          {/* 2. Nút Giả lập */}
                          <button
                            onClick={() => setImpersonateModalShop(shop)}
                            title="Giả lập Shop để hỗ trợ kỹ thuật"
                            style={{
                              padding: '5px 9px',
                              borderRadius: 6,
                              border: '1px solid #cbd5e1',
                              background: '#ffffff',
                              color: '#334155',
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4
                            }}
                          >
                            <Eye size={13} color="#d97706" /> Giả lập
                          </button>

                          {/* 3. Nút Nạp ví */}
                          <button
                            onClick={() => setCreditModalShop(shop)}
                            title="Nạp tiền vào ví Shop"
                            style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#ffffff', color: '#334155', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                          >
                            Nạp ví
                          </button>

                          {/* 4. Nút Cấp Quota */}
                          <button
                            onClick={() => setTopupModalShop(shop)}
                            title="Cấp thêm hạn mức Quota AI"
                            style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#ffffff', color: '#334155', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                          >
                            +Quota
                          </button>

                          {/* 5. Nút AI Rules */}
                          <button
                            onClick={() => setAiRulesModalShop(shop)}
                            title="Tùy chỉnh Prompt AI bóc tách"
                            style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#ffffff', color: '#334155', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                          >
                            AI rules
                          </button>

                          {/* 6. Nút Chuyển chủ */}
                          <button
                            onClick={() => setTransferModalShop(shop)}
                            title="Chuyển quyền sở hữu Shop"
                            style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#ffffff', color: '#334155', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                          >
                            Chuyển chủ
                          </button>

                          {/* 7. Khóa / Mở khóa */}
                          <button
                            onClick={() => toggleStatus(shop)}
                            title={isAct ? 'Khóa Shop' : 'Mở khóa Shop'}
                            style={{
                              padding: '5px 8px',
                              borderRadius: 6,
                              border: isAct ? '1px solid #fecaca' : '1px solid #bbf7d0',
                              background: isAct ? '#fff1f2' : '#f0fdf4',
                              color: isAct ? '#e11d48' : '#16a34a',
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            {isAct ? 'Khóa' : 'Mở'}
                          </button>

                          {/* 8. Khôi phục nếu inactive */}
                          {!isAct && (
                            <button
                              onClick={() => restoreShop(shop)}
                              title="Khôi phục Shop"
                              style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #bbf7d0', background: '#dcfce7', color: '#15803d', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                            >
                              Khôi phục
                            </button>
                          )}

                          {/* 9. Xóa đơn lẻ */}
                          <button
                            onClick={() => deleteSingleShop(shop)}
                            title="Xóa Shop này"
                            style={{ padding: '5px 7px', borderRadius: 6, border: '1px solid #fecaca', background: '#ffffff', color: '#dc2626', cursor: 'pointer' }}
                          >
                            <Trash2 size={13} />
                          </button>
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
        pageSize={pageSize}
        total={filtered.length}
        onPageChange={setPage}
        onPageSizeChange={size => { setPageSize(size); setPage(1); }}
      />

      {/* Modals */}
      <ShopMembersModal
        open={Boolean(membersModalShop)}
        shop={membersModalShop}
        onClose={() => setMembersModalShop(null)}
        onMembersChanged={load}
      />

      <TransferOwnershipModal
        open={Boolean(transferModalShop)}
        shop={transferModalShop}
        onClose={() => setTransferModalShop(null)}
        onSuccess={load}
      />

      <CreditWalletModal
        open={Boolean(creditModalShop)}
        shop={creditModalShop}
        onClose={() => setCreditModalShop(null)}
        onSuccess={load}
      />

      <ShopAiRulesModal
        open={Boolean(aiRulesModalShop)}
        shop={aiRulesModalShop}
        onClose={() => setAiRulesModalShop(null)}
        onSuccess={load}
      />

      <ImpersonateModal
        open={Boolean(impersonateModalShop)}
        shop={impersonateModalShop}
        onClose={() => setImpersonateModalShop(null)}
        onSuccess={load}
      />

      <TopupQuotaModal
        open={Boolean(topupModalShop)}
        shops={shops}
        initialShopId={topupModalShop?.id}
        onClose={() => setTopupModalShop(null)}
        onSubmit={async ({ shopId, amount }) => {
          const r = await AdminService.topupQuota(shopId, amount);
          if (r.success) {
            alert('Đã cấp bù Quota AI thành công!');
            setTopupModalShop(null);
            load();
          } else {
            alert(r.error);
          }
        }}
      />

      <Shop360Modal
        open={Boolean(shop360Target)}
        shop={shop360Target}
        onClose={() => setShop360Target(null)}
        onRefresh={load}
      />
    </div>
  );
}
