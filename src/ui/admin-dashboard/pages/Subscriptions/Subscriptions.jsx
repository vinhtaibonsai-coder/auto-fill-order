import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { 
  CreditCard, Calendar, AlertTriangle, ShieldCheck, RefreshCw, 
  Search, Filter, Users, Laptop, Sparkles, Zap, CheckCircle2, Clock,
  ArrowRightLeft, AlertCircle, Copy, Check
} from 'lucide-react';
import { AdminService } from '../../../../domain/admin/admin.service.js';
import OverrideSubscriptionModal from '../../modals/OverrideSubscriptionModal';
import ExportButton from '../../components/ExportButton';
import Pagination from '../../components/Pagination';

export default function Subscriptions() {
  const [activeMainTab, setActiveMainTab] = useState('subscriptions'); // 'subscriptions' | 'reconciliation'

  // Subscriptions Table State
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Filters & Search for Subscriptions
  const [searchKey, setSearchKey] = useState('');
  const [filterPlan, setFilterPlan] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [quickRenewingId, setQuickRenewingId] = useState(null);

  // Reconciliation Queue State
  const [reconItems, setReconItems] = useState([]);
  const [reconStats, setReconStats] = useState({ total: 0, reconciled: 0, unmatched: 0, duplicate: 0, failed: 0 });
  const [reconLoading, setReconLoading] = useState(false);
  const [reconFilter, setReconFilter] = useState('ALL'); // 'ALL' | 'unmatched' | 'duplicate' | 'failed' | 'reconciled'
  const [reconSearch, setReconSearch] = useState('');
  const [reconPage, setReconPage] = useState(1);
  const [reconPageSize, setReconPageSize] = useState(25);
  const [availableShops, setAvailableShops] = useState([]);
  const [reconcileModal, setReconcileModal] = useState({ open: false, tx: null, targetShopId: '', notes: '', saving: false });
  const [copiedId, setCopiedId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await AdminService.getSubscriptions();
    if (r.success) {
      setRows(r.data || []);
    } else {
      alert(r.error);
    }
    setLoading(false);
  }, []);

  const loadReconciliation = useCallback(async () => {
    setReconLoading(true);
    const res = await AdminService.getPaymentReconciliationQueue({
      status: reconFilter,
      search: reconSearch,
      limit: 100,
      offset: 0
    });
    if (res.success && res.data) {
      setReconItems(res.data.items || []);
      if (res.data.stats) setReconStats(res.data.stats);
    }
    setReconLoading(false);
  }, [reconFilter, reconSearch]);

  useEffect(() => {
    load();
    const handleRefresh = () => {
      load();
      if (activeMainTab === 'reconciliation') loadReconciliation();
    };
    window.addEventListener('admin:refresh_data', handleRefresh);
    return () => window.removeEventListener('admin:refresh_data', handleRefresh);
  }, [load, activeMainTab, loadReconciliation]);

  useEffect(() => {
    if (activeMainTab === 'reconciliation') {
      loadReconciliation();
      AdminService.getShops().then(res => {
        if (res.success) setAvailableShops(res.data || []);
      }).catch(() => {});
    }
  }, [activeMainTab, loadReconciliation]);

  const save = async (data) => {
    const r = await AdminService.overrideSubscription(data.shopId, data.plan, data.months);
    if (r.success) {
      setSelected(null);
      load();
    } else {
      alert(r.error);
    }
  };

  const handleQuickRenew = async (shopId, shopName, months) => {
    const monthLabel = months === 12 ? '1 Năm' : `${months} Tháng`;
    const confirm = window.confirm(`Xác nhận gia hạn nhanh thêm ${monthLabel} cho cửa hàng:\n"${shopName || shopId}"?`);
    if (!confirm) return;

    setQuickRenewingId(shopId);
    try {
      const res = await AdminService.quickExtendSubscription(shopId, months);
      if (res.success) {
        alert(`Gia hạn thành công thêm ${monthLabel}!`);
        load();
      } else {
        alert(`Gia hạn thất bại: ${res.error}`);
      }
    } catch (err) {
      alert(`Lỗi: ${err.message}`);
    } finally {
      setQuickRenewingId(null);
    }
  };

  const handleOpenReconcile = (tx) => {
    setReconcileModal({
      open: true,
      tx,
      targetShopId: tx.shop_id || '',
      notes: tx.reconciliation_notes || `Đối soát thủ công giao dịch ${tx.transaction_code}`,
      saving: false
    });
  };

  const handleReconcileSubmit = async () => {
    if (!reconcileModal.tx || !reconcileModal.targetShopId) {
      alert('Vui lòng chọn Shop đích để gán và đối soát giao dịch!');
      return;
    }
    setReconcileModal(prev => ({ ...prev, saving: true }));
    try {
      const res = await AdminService.reconcilePaymentTransaction({
        transactionId: reconcileModal.tx.id,
        targetShopId: reconcileModal.targetShopId,
        notes: reconcileModal.notes || 'Admin đối soát và kích hoạt thủ công'
      });
      if (res.success) {
        alert('✅ Đối soát và kích hoạt gói cước thành công!');
        setReconcileModal({ open: false, tx: null, targetShopId: '', notes: '', saving: false });
        loadReconciliation();
        load();
      } else {
        alert(`❌ Lỗi đối soát: ${res.error}`);
        setReconcileModal(prev => ({ ...prev, saving: false }));
      }
    } catch (err) {
      alert(`❌ Lỗi: ${err.message}`);
      setReconcileModal(prev => ({ ...prev, saving: false }));
    }
  };

  const copyText = (text, id) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // KPIs for Subscriptions
  const kpis = useMemo(() => {
    let total = rows.length;
    let active = 0;
    let expiringSoon = 0;
    let expired = 0;

    rows.forEach(s => {
      const days = s.current_period_end ? Math.ceil((new Date(s.current_period_end) - Date.now()) / 86400000) : null;
      if (s.status === 'active' && (days === null || days >= 0)) {
        active++;
      }
      if (days !== null && days >= 0 && days <= 7) {
        expiringSoon++;
      }
      if (days !== null && days < 0) {
        expired++;
      }
    });

    return { total, active, expiringSoon, expired };
  }, [rows]);

  // Filtered rows for Subscriptions
  const filteredRows = useMemo(() => {
    return rows.filter(s => {
      const shopName = (s.shops?.name || s.shop_id || '').toLowerCase();
      const matchSearch = !searchKey || shopName.includes(searchKey.toLowerCase());

      const planCode = String(s.plan_code || s.plan_tier || 'FREE').toUpperCase();
      const matchPlan = filterPlan === 'ALL' || planCode.includes(filterPlan);

      const days = s.current_period_end ? Math.ceil((new Date(s.current_period_end) - Date.now()) / 86400000) : null;

      const matchStatus = filterStatus === 'ALL' || 
        (filterStatus === 'ACTIVE' && s.status === 'active' && (days === null || days >= 0)) ||
        (filterStatus === 'EXPIRING_SOON' && days !== null && days >= 0 && days <= 7) ||
        (filterStatus === 'EXPIRED' && days !== null && days < 0);

      return matchSearch && matchPlan && matchStatus;
    });
  }, [rows, searchKey, filterPlan, filterStatus]);

  const paginatedRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);
  const paginatedReconItems = reconItems.slice((reconPage - 1) * reconPageSize, reconPage * reconPageSize);

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
            <CreditCard size={22} color="#2563eb" />
            Quản Lý Thuê Bao & Đối Soát Thanh Toán
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
            Nâng hạ gói cước, 1-Click gia hạn nhanh và đối soát giao dịch VietQR / SePay tự động & thủ công.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={activeMainTab === 'subscriptions' ? load : loadReconciliation}
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
            <RefreshCw size={13} className={(loading || reconLoading) ? 'dash-spin' : ''} /> Tải lại
          </button>
          <ExportButton 
            rows={activeMainTab === 'subscriptions' ? rows : reconItems} 
            filename={activeMainTab === 'subscriptions' ? 'danh-sach-goi-cuoc.csv' : 'doi-soat-thanh-toan.csv'} 
          />
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '2px solid #e2e8f0', paddingBottom: 6 }}>
        <button
          onClick={() => setActiveMainTab('subscriptions')}
          style={{
            padding: '8px 16px',
            fontSize: 13,
            fontWeight: activeMainTab === 'subscriptions' ? 700 : 500,
            color: activeMainTab === 'subscriptions' ? '#2563eb' : '#64748b',
            borderBottom: activeMainTab === 'subscriptions' ? '3px solid #2563eb' : 'none',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          <CreditCard size={16} /> Gói Cước Thuê Bao ({rows.length})
        </button>
        <button
          onClick={() => setActiveMainTab('reconciliation')}
          style={{
            padding: '8px 16px',
            fontSize: 13,
            fontWeight: activeMainTab === 'reconciliation' ? 700 : 500,
            color: activeMainTab === 'reconciliation' ? '#2563eb' : '#64748b',
            borderBottom: activeMainTab === 'reconciliation' ? '3px solid #2563eb' : 'none',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          <ArrowRightLeft size={16} /> Đối Soát Giao Dịch & Webhook
          {reconStats.unmatched > 0 && (
            <span style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', fontSize: 11, padding: '1px 6px', borderRadius: 10, fontWeight: 700 }}>
              {reconStats.unmatched} Chưa Khớp
            </span>
          )}
        </button>
      </div>

      {activeMainTab === 'subscriptions' ? (
        <>
          {/* KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 8, background: '#eff6ff', display: 'grid', placeItems: 'center', color: '#2563eb' }}>
                <CreditCard size={20} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Tổng Cửa Hàng</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}>{kpis.total}</div>
              </div>
            </div>

            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 8, background: '#f0fdf4', display: 'grid', placeItems: 'center', color: '#16a34a' }}>
                <ShieldCheck size={20} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Đang Hoạt Động</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#16a34a' }}>{kpis.active}</div>
              </div>
            </div>

            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 8, background: '#fffbeb', display: 'grid', placeItems: 'center', color: '#d97706' }}>
                <AlertTriangle size={20} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Sắp Hết Hạn (≤7 ngày)</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#d97706' }}>{kpis.expiringSoon}</div>
              </div>
            </div>

            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 8, background: '#fef2f2', display: 'grid', placeItems: 'center', color: '#dc2626' }}>
                <AlertTriangle size={20} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Đã Hết Hạn</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#dc2626' }}>{kpis.expired}</div>
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 10,
            padding: '12px 16px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', flex: 1 }}>
              <div style={{ position: 'relative', minWidth: 240, maxWidth: 360, flex: 1 }}>
                <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  placeholder="Tìm theo tên cửa hàng hoặc Shop ID..."
                  value={searchKey}
                  onChange={(e) => setSearchKey(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px 8px 32px',
                    fontSize: 12.5,
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Filter size={14} color="#64748b" />
                <select
                  value={filterPlan}
                  onChange={(e) => setFilterPlan(e.target.value)}
                  style={{
                    padding: '7px 10px',
                    fontSize: 12,
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    background: '#ffffff'
                  }}
                >
                  <option value="ALL">Tất cả gói cước</option>
                  <option value="PRO">Gói PRO</option>
                  <option value="FREE">Gói FREE</option>
                  <option value="ENTERPRISE">Gói ENTERPRISE</option>
                </select>
              </div>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                style={{
                  padding: '7px 10px',
                  fontSize: 12,
                  border: '1px solid #cbd5e1',
                  borderRadius: 6,
                  background: '#ffffff'
                }}
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="ACTIVE">Đang hoạt động</option>
                <option value="EXPIRING_SOON">Sắp hết hạn (≤7 ngày)</option>
                <option value="EXPIRED">Đã hết hạn</option>
              </select>
            </div>

            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
              Hiển thị {filteredRows.length} / {rows.length} cửa hàng
            </div>
          </div>

          {/* Table */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
            <div className="dash-table-container">
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>Cửa Hàng</th>
                    <th>Gói Hiện Tại</th>
                    <th>Hạn Mức Cấp Phép</th>
                    <th>Trạng Thái</th>
                    <th>Ngày Hết Hạn</th>
                    <th>Thời Gian Còn Lại</th>
                    <th style={{ textAlign: 'right' }}>Thao Tác Nhanh</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '30px 0', color: '#64748b' }}>
                        <RefreshCw size={20} className="dash-spin" style={{ margin: '0 auto 8px auto', display: 'block' }} />
                        Đang tải danh sách gói cước...
                      </td>
                    </tr>
                  ) : paginatedRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '30px 0', color: '#94a3b8' }}>
                        Không tìm thấy cửa hàng nào phù hợp bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    paginatedRows.map((s) => {
                      const days = s.current_period_end ? Math.ceil((new Date(s.current_period_end) - Date.now()) / 86400000) : null;
                      const isExpired = days !== null && days < 0;
                      const isExpiring = days !== null && days >= 0 && days <= 7;
                      const planCode = String(s.plan_code || s.plan_tier || 'FREE').toUpperCase();
                      const isBusy = quickRenewingId === s.shop_id;

                      const maxDev = s.max_devices ?? s.quotas?.devices_limit ?? 2;
                      const maxUsr = s.max_members ?? s.quotas?.users_limit ?? 3;
                      const maxAi = s.max_ai_requests ?? s.quotas?.ai_monthly_limit ?? 500;

                      return (
                        <tr key={s.id || s.shop_id}>
                          <td>
                            <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13 }}>
                              {s.shops?.name || 'Chưa đặt tên'}
                            </div>
                            <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>
                              ID: {s.shop_id}
                            </div>
                          </td>
                          <td>
                            <span 
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '3px 8px',
                                borderRadius: 6,
                                fontSize: 11.5,
                                background: planCode.includes('PRO') ? '#eff6ff' : '#f1f5f9',
                                color: planCode.includes('PRO') ? '#1d4ed8' : '#475569',
                                border: planCode.includes('PRO') ? '1px solid #bfdbfe' : '1px solid #cbd5e1',
                                fontWeight: 700
                              }}
                            >
                              {planCode}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 10, fontSize: 11.5, color: '#475569' }}>
                              <span title="Số thiết bị tối đa" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                <Laptop size={12} color="#2563eb" /> {maxDev} máy
                              </span>
                              <span title="Số nhân viên tối đa" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                <Users size={12} color="#059669" /> {maxUsr} user
                              </span>
                              <span title="Lượt bóc tách AI hàng tháng" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                <Sparkles size={12} color="#7c3aed" /> {maxAi} AI
                              </span>
                            </div>
                          </td>
                          <td>
                            <span className={`badge ${s.status === 'active' ? 'badge-success' : 'badge-warning'}`}>
                              {s.status === 'active' ? 'Đang kích hoạt' : (s.status || 'Chờ kích hoạt')}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#334155' }}>
                              <Calendar size={14} color="#64748b" />
                              <span>{s.current_period_end ? new Date(s.current_period_end).toLocaleDateString('vi-VN') : '—'}</span>
                            </div>
                          </td>
                          <td>
                            {days === null ? (
                              <span style={{ color: '#94a3b8', fontSize: 12 }}>Không xác định</span>
                            ) : isExpired ? (
                              <span style={{ color: '#dc2626', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                                <AlertTriangle size={14} /> Đã hết hạn ({Math.abs(days)} ngày trước)
                              </span>
                            ) : isExpiring ? (
                              <span style={{ color: '#d97706', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                                <AlertTriangle size={14} /> Còn {days} ngày (Cần gia hạn)
                              </span>
                            ) : (
                              <span style={{ color: '#16a34a', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                                <ShieldCheck size={14} /> Còn {days} ngày
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                              <div style={{ display: 'inline-flex', border: '1px solid #cbd5e1', borderRadius: 6, overflow: 'hidden' }}>
                                <button
                                  disabled={isBusy}
                                  onClick={() => handleQuickRenew(s.shop_id, s.shops?.name, 1)}
                                  title="Gia hạn nhanh +1 Tháng"
                                  style={{ padding: '4px 7px', border: 'none', background: '#f8fafc', fontSize: 11, fontWeight: 700, color: '#1e293b', cursor: 'pointer', borderRight: '1px solid #cbd5e1' }}
                                >
                                  +1T
                                </button>
                                <button
                                  disabled={isBusy}
                                  onClick={() => handleQuickRenew(s.shop_id, s.shops?.name, 3)}
                                  title="Gia hạn nhanh +3 Tháng"
                                  style={{ padding: '4px 7px', border: 'none', background: '#f8fafc', fontSize: 11, fontWeight: 700, color: '#1e293b', cursor: 'pointer', borderRight: '1px solid #cbd5e1' }}
                                >
                                  +3T
                                </button>
                                <button
                                  disabled={isBusy}
                                  onClick={() => handleQuickRenew(s.shop_id, s.shops?.name, 12)}
                                  title="Gia hạn nhanh +1 Năm (12 tháng)"
                                  style={{ padding: '4px 7px', border: 'none', background: '#ecfdf5', fontSize: 11, fontWeight: 700, color: '#059669', cursor: 'pointer' }}
                                >
                                  +1N
                                </button>
                              </div>

                              <button
                                onClick={() => setSelected(s)}
                                style={{
                                  padding: '5px 10px',
                                  fontSize: 12,
                                  background: '#ffffff',
                                  color: '#2563eb',
                                  border: '1px solid #bfdbfe',
                                  borderRadius: 6,
                                  fontWeight: 700,
                                  cursor: 'pointer'
                                }}
                              >
                                Đổi gói
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

            {!loading && filteredRows.length > 0 && (
              <Pagination
                page={page}
                pageSize={pageSize}
                total={filteredRows.length}
                onPageChange={setPage}
                onPageSizeChange={(s) => {
                  setPageSize(s);
                  setPage(1);
                }}
                pageSizeOptions={[10, 25, 50, 100]}
                itemLabel="gói cước"
              />
            )}
          </div>
        </>
      ) : (
        /* RECONCILIATION VIEW */
        <>
          {/* Reconciliation KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 8, background: '#f1f5f9', display: 'grid', placeItems: 'center', color: '#334155' }}>
                <ArrowRightLeft size={18} />
              </div>
              <div>
                <div style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600 }}>Tổng Giao Dịch</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>{reconStats.total || 0}</div>
              </div>
            </div>

            <div style={{ background: '#ffffff', border: '1px solid #fef3c7', borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 8, background: '#fef3c7', display: 'grid', placeItems: 'center', color: '#b45309' }}>
                <AlertTriangle size={18} />
              </div>
              <div>
                <div style={{ fontSize: 11.5, color: '#b45309', fontWeight: 600 }}>Chưa Khớp Shop (Unmatched)</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#b45309' }}>{reconStats.unmatched || 0}</div>
              </div>
            </div>

            <div style={{ background: '#ffffff', border: '1px solid #f3e8ff', borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 8, background: '#f3e8ff', display: 'grid', placeItems: 'center', color: '#7e22ce' }}>
                <RefreshCw size={18} />
              </div>
              <div>
                <div style={{ fontSize: 11.5, color: '#7e22ce', fontWeight: 600 }}>Trùng Lặp (Duplicate)</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#7e22ce' }}>{reconStats.duplicate || 0}</div>
              </div>
            </div>

            <div style={{ background: '#ffffff', border: '1px solid #fee2e2', borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 8, background: '#fee2e2', display: 'grid', placeItems: 'center', color: '#dc2626' }}>
                <AlertCircle size={18} />
              </div>
              <div>
                <div style={{ fontSize: 11.5, color: '#dc2626', fontWeight: 600 }}>Thất Bại (Failed)</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#dc2626' }}>{reconStats.failed || 0}</div>
              </div>
            </div>

            <div style={{ background: '#ffffff', border: '1px solid #dcfce7', borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 8, background: '#dcfce7', display: 'grid', placeItems: 'center', color: '#16a34a' }}>
                <CheckCircle2 size={18} />
              </div>
              <div>
                <div style={{ fontSize: 11.5, color: '#16a34a', fontWeight: 600 }}>Đã Đối Soát (Reconciled)</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#16a34a' }}>{reconStats.reconciled || 0}</div>
              </div>
            </div>
          </div>

          {/* Filter Pills and Search */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 10,
            padding: '12px 16px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              {[
                { id: 'ALL', label: `Tất Cả (${reconStats.total || 0})` },
                { id: 'unmatched', label: `⚠️ Chưa Khớp Shop (${reconStats.unmatched || 0})` },
                { id: 'duplicate', label: `🔁 Trùng Lặp (${reconStats.duplicate || 0})` },
                { id: 'failed', label: `❌ Thất Bại (${reconStats.failed || 0})` },
                { id: 'reconciled', label: `✅ Đã Đối Soát (${reconStats.reconciled || 0})` }
              ].map(pill => {
                const active = reconFilter === pill.id;
                return (
                  <button
                    key={pill.id}
                    onClick={() => {
                      setReconFilter(pill.id);
                      setReconPage(1);
                    }}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: active ? 700 : 500,
                      border: active ? '1px solid #2563eb' : '1px solid #cbd5e1',
                      background: active ? '#eff6ff' : '#ffffff',
                      color: active ? '#1d4ed8' : '#475569',
                      cursor: 'pointer'
                    }}
                  >
                    {pill.label}
                  </button>
                );
              })}
            </div>

            <div style={{ position: 'relative', minWidth: 220, maxWidth: 320, flex: 1 }}>
              <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Tìm mã GD, nội dung chuyển..."
                value={reconSearch}
                onChange={(e) => {
                  setReconSearch(e.target.value);
                  setReconPage(1);
                }}
                style={{
                  width: '100%',
                  padding: '7px 10px 7px 30px',
                  fontSize: 12,
                  border: '1px solid #cbd5e1',
                  borderRadius: 6,
                  outline: 'none'
                }}
              />
            </div>
          </div>

          {/* Reconciliation Table */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
            <div className="dash-table-container">
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>Mã Giao Dịch</th>
                    <th>Cổng / Thời Gian</th>
                    <th>Số Tiền</th>
                    <th>Nội Dung Chuyển Khoản</th>
                    <th>Shop Được Gán</th>
                    <th>Trạng Thái Đối Soát</th>
                    <th style={{ textAlign: 'right' }}>Thao Tác</th>
                  </tr>
                </thead>
                <tbody>
                  {reconLoading ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '30px 0', color: '#64748b' }}>
                        <RefreshCw size={20} className="dash-spin" style={{ margin: '0 auto 8px auto', display: 'block' }} />
                        Đang tải hàng đợi đối soát...
                      </td>
                    </tr>
                  ) : paginatedReconItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '30px 0', color: '#94a3b8' }}>
                        Không có giao dịch nào thuộc trạng thái này.
                      </td>
                    </tr>
                  ) : (
                    paginatedReconItems.map((tx) => {
                      const statusLower = String(tx.reconciliation_status || 'pending').toLowerCase();
                      const isReconciled = statusLower === 'reconciled' || ['SUCCESS', 'PROCESSED'].includes(tx.status);
                      const isUnmatched = statusLower === 'unmatched' || (!tx.shop_id && !isReconciled);
                      const isDuplicate = statusLower === 'duplicate';
                      const isFailed = statusLower === 'failed';

                      return (
                        <tr key={tx.id || tx.transaction_code}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <code style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 11.5, color: '#0f172a' }}>
                                {tx.transaction_code || tx.transaction_id}
                              </code>
                              <button
                                onClick={() => copyText(tx.transaction_code || tx.transaction_id, tx.id)}
                                title="Copy mã giao dịch"
                                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b', padding: 2 }}
                              >
                                {copiedId === tx.id ? <Check size={12} color="#16a34a" /> : <Copy size={12} />}
                              </button>
                            </div>
                          </td>
                          <td>
                            <div style={{ fontWeight: 600, fontSize: 11.5, color: '#334155' }}>
                              {tx.gateway || 'VIETQR'}
                            </div>
                            <div style={{ fontSize: 11, color: '#64748b' }}>
                              {tx.created_at ? new Date(tx.created_at).toLocaleString('vi-VN') : '—'}
                            </div>
                          </td>
                          <td>
                            <span style={{ fontWeight: 700, fontSize: 12.5, color: '#16a34a' }}>
                              {Number(tx.amount || 0).toLocaleString()} VND
                            </span>
                          </td>
                          <td>
                            <div style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11.5, color: '#334155' }} title={tx.content}>
                              {tx.content || '—'}
                            </div>
                            {tx.reconciliation_notes && (
                              <div style={{ fontSize: 10.5, color: '#b45309' }}>
                                ⚠️ {tx.reconciliation_notes}
                              </div>
                            )}
                          </td>
                          <td>
                            {tx.shop_name ? (
                              <div>
                                <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 12 }}>{tx.shop_name}</div>
                                <div style={{ fontSize: 10.5, color: '#64748b', fontFamily: 'monospace' }}>{tx.shop_code || tx.shop_id}</div>
                              </div>
                            ) : (
                              <span style={{ color: '#b45309', fontWeight: 600, fontSize: 11.5, background: '#fef3c7', padding: '2px 6px', borderRadius: 4 }}>
                                Chưa khớp Shop
                              </span>
                            )}
                          </td>
                          <td>
                            {isReconciled && (
                              <span style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
                                ✅ Đã Đối Soát
                              </span>
                            )}
                            {isUnmatched && (
                              <span style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
                                ⚠️ Chưa Khớp Shop
                              </span>
                            )}
                            {isDuplicate && (
                              <span style={{ background: '#f3e8ff', color: '#7e22ce', border: '1px solid #d8b4fe', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
                                🔁 Trùng Lặp
                              </span>
                            )}
                            {isFailed && (
                              <span style={{ background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
                                ❌ Thất Bại
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                              {!isReconciled && (
                                <button
                                  onClick={() => handleOpenReconcile(tx)}
                                  title="Gán vào Shop và kích hoạt quyền lợi thủ công"
                                  style={{
                                    padding: '5px 10px',
                                    fontSize: 11.5,
                                    background: '#eff6ff',
                                    color: '#2563eb',
                                    border: '1px solid #bfdbfe',
                                    borderRadius: 6,
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                  }}
                                >
                                  ⚖️ Gán Shop & Đối Soát
                                </button>
                              )}
                              {isFailed && (
                                <button
                                  onClick={() => handleOpenReconcile(tx)}
                                  title="Thử lại xử lý giao dịch này"
                                  style={{
                                    padding: '5px 10px',
                                    fontSize: 11.5,
                                    background: '#f8fafc',
                                    color: '#334155',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: 6,
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                  }}
                                >
                                  🔄 Thử Lại
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

            {!reconLoading && reconItems.length > 0 && (
              <Pagination
                page={reconPage}
                pageSize={reconPageSize}
                total={reconItems.length}
                onPageChange={setReconPage}
                onPageSizeChange={(s) => {
                  setReconPageSize(s);
                  setReconPage(1);
                }}
                pageSizeOptions={[10, 25, 50, 100]}
                itemLabel="giao dịch"
              />
            )}
          </div>
        </>
      )}

      {/* Override Subscription Modal */}
      <OverrideSubscriptionModal
        open={Boolean(selected)}
        subscription={selected}
        onClose={() => setSelected(null)}
        onSubmit={save}
      />

      {/* Manual Reconciliation Modal */}
      {reconcileModal.open && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(3px)',
          display: 'grid',
          placeItems: 'center',
          zIndex: 9999,
          padding: 20
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: 12,
            width: '100%',
            maxWidth: 520,
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            overflow: 'hidden'
          }}>
            <div style={{ background: '#f8fafc', padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                <ArrowRightLeft size={18} color="#2563eb" />
                Đối Soát & Gán Shop Thủ Công
              </h3>
              <button
                onClick={() => setReconcileModal({ open: false, tx: null, targetShopId: '', notes: '', saving: false })}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 18, color: '#94a3b8' }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: 20, display: 'grid', gap: 14 }}>
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px', fontSize: 12.5, color: '#1e3a8a' }}>
                <strong>Mã GD:</strong> {reconcileModal.tx?.transaction_code}<br />
                <strong>Số tiền:</strong> {Number(reconcileModal.tx?.amount || 0).toLocaleString()} VND<br />
                <strong>Nội dung:</strong> {reconcileModal.tx?.content || '—'}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                  Chọn Cửa Hàng (Shop Đích):
                </label>
                <select
                  value={reconcileModal.targetShopId}
                  onChange={(e) => setReconcileModal(prev => ({ ...prev, targetShopId: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    fontSize: 13,
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    background: '#ffffff'
                  }}
                >
                  <option value="">-- Chọn Cửa Hàng Nhận Quyền Lợi --</option>
                  {availableShops.map(sh => (
                    <option key={sh.id} value={sh.id}>
                      {sh.name} ({sh.shop_code || sh.id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                  Ghi Chú Đối Soát (Audit Reason):
                </label>
                <textarea
                  rows={3}
                  value={reconcileModal.notes}
                  onChange={(e) => setReconcileModal(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Nhập lý do đối soát thủ công hoặc thông tin hỗ trợ..."
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    fontSize: 12.5,
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    outline: 'none',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setReconcileModal({ open: false, tx: null, targetShopId: '', notes: '', saving: false })}
                  style={{
                    padding: '8px 16px',
                    fontSize: 13,
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    background: '#ffffff',
                    color: '#475569',
                    cursor: 'pointer'
                  }}
                >
                  Hủy Bỏ
                </button>
                <button
                  type="button"
                  disabled={reconcileModal.saving || !reconcileModal.targetShopId}
                  onClick={handleReconcileSubmit}
                  style={{
                    padding: '8px 18px',
                    fontSize: 13,
                    fontWeight: 700,
                    borderRadius: 6,
                    background: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    cursor: reconcileModal.saving || !reconcileModal.targetShopId ? 'not-allowed' : 'pointer'
                  }}
                >
                  {reconcileModal.saving ? 'Đang Xử Lý...' : 'Xác Nhận Kích Hoạt'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
