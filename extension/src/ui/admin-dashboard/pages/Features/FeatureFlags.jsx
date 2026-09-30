import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Flag, Globe, Layers, Store, User, Plus, RefreshCw,
  Search, SlidersHorizontal, Trash2, Edit2, CheckCircle2,
  XCircle, Sliders, ShieldCheck, AlertCircle, Copy, Check
} from 'lucide-react';
import { AdminService } from '../../../../domain/admin/admin.service.js';
import { SkeletonHeroKpis, SkeletonTableRows } from '../../components/Skeleton';
import EditFeatureFlagModal from '../../modals/EditFeatureFlagModal';

export default function FeatureFlags() {
  const [flags, setFlags] = useState([]);
  const [shops, setShops] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(null);

  // Filter and Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [scopeFilter, setScopeFilter] = useState('ALL'); // 'ALL' | 'global' | 'plan' | 'shop' | 'user'
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'DISABLED'

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFlag, setEditingFlag] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);

  const fetchFlags = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [flagRes, shopRes, userRes] = await Promise.all([
        AdminService.getFeatureFlags(),
        AdminService.getShopsList().catch(() => ({ success: false, data: [] })),
        AdminService.getUsersList().catch(() => ({ success: false, data: [] }))
      ]);

      if (flagRes.success) {
        setFlags(flagRes.data || []);
      } else {
        setError(flagRes.error || 'Cannot load feature flags');
      }

      if (shopRes.success) {
        setShops(shopRes.data || []);
      }
      if (userRes.success) {
        setUsers(userRes.data || []);
      }
    } catch (err) {
      setError(err.message || 'Lỗi nạp dữ liệu Feature Flags');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFlags();
    const handleRefresh = () => {
      fetchFlags();
    };
    window.addEventListener('admin:refresh_data', handleRefresh);
    return () => window.removeEventListener('admin:refresh_data', handleRefresh);
  }, [fetchFlags]);

  const toggleFlag = async (flag) => {
    const newEnabled = !flag.is_enabled;
    setActionLoading(flag.id);
    const res = await AdminService.updateFeatureFlag(flag.id, flag, { is_enabled: newEnabled });
    if (res.success) {
      setFlags(prev => prev.map(f => f.id === flag.id ? { ...f, is_enabled: newEnabled } : f));
    } else {
      alert('Error: ' + res.error);
    }
    setActionLoading(null);
  };

  const handleDelete = async (flag) => {
    const confirmMsg = `Bạn có chắc chắn muốn xóa vĩnh viễn Feature Flag: "${flag.key}"?\nHành động này không thể hoàn tác!`;
    if (!window.confirm(confirmMsg)) return;

    setActionLoading(flag.id);
    const res = await AdminService.deleteFeatureFlag(flag.id, flag.key);
    if (res.success) {
      setFlags(prev => prev.filter(f => f.id !== flag.id));
    } else {
      alert('Xóa cờ tính năng thất bại: ' + res.error);
    }
    setActionLoading(null);
  };

  const handleCopyKey = (key) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Helper describing scope for display and test contract
  const describeScope = (flag) => {
    const scope_type = flag.scope_type || (flag.shop_id ? 'shop' : flag.plan_code ? 'plan' : flag.user_id ? 'user' : 'global');
    let target = 'all tenants';
    let label = 'Toàn Cầu (Global)';
    let color = '#2563eb';
    let Icon = Globe;

    if (scope_type === 'shop' || flag.shop_id) {
      const matchedShop = shops.find(s => s.id === flag.shop_id);
      target = matchedShop ? `${matchedShop.name} (${matchedShop.shop_code || 'ID: ' + flag.shop_id.slice(0, 6)})` : `Shop: ${flag.shop_id}`;
      label = 'Cửa Hàng (Shop)';
      color = '#059669';
      Icon = Store;
    } else if (scope_type === 'plan' || flag.plan_code) {
      const plans = [];
      if (flag.plan_code) plans.push(flag.plan_code);
      if (Array.isArray(flag.target_plans)) {
        flag.target_plans.forEach(p => {
          if (!plans.includes(p)) plans.push(p);
        });
      }
      target = plans.length > 0 ? plans.join(', ') : (flag.plan_code || 'Tất cả Plan');
      label = 'Gói Cước (Plan)';
      color = '#7c3aed';
      Icon = Layers;
    } else if (scope_type === 'user' || flag.user_id) {
      const matchedUser = users.find(u => u.id === flag.user_id);
      target = matchedUser ? `${matchedUser.full_name || matchedUser.email} (${flag.user_id.slice(0, 6)})` : `User: ${flag.user_id}`;
      label = 'Người Dùng (User)';
      color = '#d97706';
      Icon = User;
    }

    return { scope_type, target, label, color, Icon, shop_id: flag.shop_id, user_id: flag.user_id, plan_code: flag.plan_code };
  };

  // KPI Calculations
  const stats = useMemo(() => {
    const total = flags.length;
    const active = flags.filter(f => f.is_enabled).length;
    const scoped = flags.filter(f => (f.scope_type && f.scope_type !== 'global') || f.shop_id || f.user_id || f.plan_code).length;
    const canary = flags.filter(f => f.is_enabled && f.rollout_percentage > 0 && f.rollout_percentage < 100).length;
    return { total, active, scoped, canary };
  }, [flags]);

  // Filtered Flags
  const filteredFlags = useMemo(() => {
    return flags.filter(flag => {
      // Search term
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const keyMatch = (flag.key || '').toLowerCase().includes(q);
        const descMatch = (flag.description || '').toLowerCase().includes(q);
        if (!keyMatch && !descMatch) return false;
      }

      // Scope filter
      if (scopeFilter !== 'ALL') {
        const scope = flag.scope_type || (flag.shop_id ? 'shop' : flag.plan_code ? 'plan' : flag.user_id ? 'user' : 'global');
        if (scope !== scopeFilter) return false;
      }

      // Status filter
      if (statusFilter === 'ACTIVE' && !flag.is_enabled) return false;
      if (statusFilter === 'DISABLED' && flag.is_enabled) return false;

      return true;
    });
  }, [flags, searchTerm, scopeFilter, statusFilter]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: '#eff6ff', color: '#2563eb',
              display: 'grid', placeItems: 'center'
            }}>
              <Flag size={20} />
            </div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0f172a' }}>
              Feature Flags & Rollout Control
            </h2>
          </div>
          <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0 0' }}>
            Control global, plan, shop, and user scoped rollout for commercial SaaS features.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            onClick={fetchFlags}
            disabled={loading}
            style={{
              background: '#ffffff',
              color: '#334155',
              border: '1px solid #cbd5e1',
              padding: '8px 14px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Làm Mới
          </button>
          <button
            onClick={() => {
              setEditingFlag(null);
              setIsModalOpen(true);
            }}
            style={{
              background: '#2563eb',
              color: '#ffffff',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)'
            }}
          >
            <Plus size={16} />
            Tạo Cờ Tính Năng Mới
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div style={{
          background: '#fee2e2',
          color: '#991b1b',
          padding: '12px 16px',
          borderRadius: '8px',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: 10
        }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Hero KPIs */}
      {loading ? (
        <SkeletonHeroKpis count={4} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: '#eff6ff', color: '#2563eb', display: 'grid', placeItems: 'center' }}>
              <Flag size={22} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>Tổng Cờ Tính Năng</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a' }}>{stats.total}</div>
            </div>
          </div>

          <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: '#f0fdf4', color: '#16a34a', display: 'grid', placeItems: 'center' }}>
              <CheckCircle2 size={22} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>Đang Kích Hoạt (Active)</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#16a34a' }}>{stats.active}</div>
            </div>
          </div>

          <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: '#faf5ff', color: '#7c3aed', display: 'grid', placeItems: 'center' }}>
              <Layers size={22} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>Phân Vùng Phạm Vi</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#7c3aed' }}>{stats.scoped}</div>
            </div>
          </div>

          <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: '#fffbeb', color: '#d97706', display: 'grid', placeItems: 'center' }}>
              <Sliders size={22} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>Thử Nghiệm Tỷ Lệ (Canary)</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#d97706' }}>{stats.canary}</div>
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 12,
        alignItems: 'center',
        background: '#ffffff',
        padding: '12px 16px',
        borderRadius: 10,
        border: '1px solid #e2e8f0'
      }}>
        {/* Search Input */}
        <div style={{ flex: '1 1 240px', position: 'relative' }}>
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Tìm theo Feature Key hoặc mô tả..."
            style={{
              width: '100%',
              padding: '8px 12px 8px 34px',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              fontSize: 13
            }}
          />
          <Search size={15} style={{ position: 'absolute', left: 10, top: 10, color: '#94a3b8' }} />
        </div>

        {/* Scope Tabs */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {[
            { id: 'ALL', label: 'Tất Cả Scope' },
            { id: 'global', label: '🌐 Toàn Cầu' },
            { id: 'plan', label: '💎 Gói Cước' },
            { id: 'shop', label: '🏬 Cửa Hàng' },
            { id: 'user', label: '👤 Người Dùng' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setScopeFilter(tab.id)}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: 'none',
                background: scopeFilter === tab.id ? '#2563eb' : '#f1f5f9',
                color: scopeFilter === tab.id ? '#ffffff' : '#475569',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          style={{
            padding: '7px 12px',
            borderRadius: 6,
            border: '1px solid #cbd5e1',
            fontSize: 12,
            fontWeight: 500,
            background: '#ffffff'
          }}
        >
          <option value="ALL">Tất cả trạng thái</option>
          <option value="ACTIVE">Đang Bật (Active)</option>
          <option value="DISABLED">Đang Tắt (Disabled)</option>
        </select>
      </div>

      {/* Feature Flags Table */}
      <div className="card" style={{ padding: '0', overflow: 'hidden', borderRadius: 12, border: '1px solid #e2e8f0' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
              <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Feature Key</th>
              <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Mô Tả & Mục Đích</th>
              <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Phạm Vi (Scope)</th>
              <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Tỷ Lệ Rollout</th>
              <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Trạng Thái</th>
              <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569', textAlign: 'right' }}>Thao Tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonTableRows columns={6} rows={6} />
            ) : filteredFlags.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ padding: '40px 20px', textAlign: 'center', color: '#64748b' }}>
                  <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <Flag size={32} color="#cbd5e1" />
                    <span style={{ fontWeight: 600 }}>Không tìm thấy Feature Flag nào phù hợp</span>
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>Hãy thử đổi bộ lọc hoặc tạo cờ tính năng mới</span>
                  </div>
                </td>
              </tr>
            ) : (
              filteredFlags.map(flag => {
                const scope = describeScope(flag);
                const ScopeIcon = scope.Icon;
                const isCopied = copiedKey === flag.key;
                const pct = Number.isInteger(flag.rollout_percentage) ? flag.rollout_percentage : 100;

                return (
                  <tr key={flag.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.1s' }} className="hover:bg-slate-50">
                    {/* Feature Key */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          fontFamily: 'monospace',
                          fontWeight: 700,
                          fontSize: 13,
                          color: '#0f172a',
                          background: '#f1f5f9',
                          padding: '3px 8px',
                          borderRadius: 6
                        }}>
                          {flag.key}
                        </span>
                        <button
                          onClick={() => handleCopyKey(flag.key)}
                          title="Sao chép Feature Key"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: isCopied ? '#16a34a' : '#94a3b8',
                            padding: 2
                          }}
                        >
                          {isCopied ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                      </div>
                      {flag.created_at && (
                        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>
                          Tạo: {new Date(flag.created_at).toLocaleDateString('vi-VN')}
                        </div>
                      )}
                    </td>

                    {/* Description */}
                    <td style={{ padding: '14px 16px', color: '#475569', maxWidth: 260 }}>
                      <div style={{ fontSize: 13, lineHeight: '1.4' }}>
                        {flag.description || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Chưa có mô tả</span>}
                      </div>
                    </td>

                    {/* Scope */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        background: `${scope.color}15`,
                        color: scope.color,
                        padding: '3px 8px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: 'uppercase'
                      }}>
                        <ScopeIcon size={13} />
                        <span>{scope.scope_type}</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 4, fontWeight: 500 }}>
                        {scope.target}
                      </div>
                    </td>

                    {/* Rollout Percentage */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          flex: 1,
                          height: 6,
                          background: '#e2e8f0',
                          borderRadius: 3,
                          overflow: 'hidden',
                          minWidth: 60,
                          maxWidth: 100
                        }}>
                          <div style={{
                            width: `${pct}%`,
                            height: '100%',
                            background: pct === 100 ? '#16a34a' : pct > 0 ? '#2563eb' : '#94a3b8',
                            borderRadius: 3
                          }} />
                        </div>
                        <span style={{
                          fontWeight: 700,
                          fontSize: 12,
                          color: pct === 100 ? '#16a34a' : pct > 0 ? '#2563eb' : '#64748b'
                        }}>
                          {pct}%
                        </span>
                      </div>
                      {pct > 0 && pct < 100 && (
                        <div style={{ fontSize: 10, color: '#d97706', marginTop: 2, fontWeight: 600 }}>
                          Phân phối Canary
                        </div>
                      )}
                    </td>

                    {/* Status */}
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        background: flag.is_enabled ? '#dcfce7' : '#fee2e2',
                        color: flag.is_enabled ? '#15803d' : '#991b1b',
                        padding: '3px 10px',
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 700
                      }}>
                        {flag.is_enabled ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                        {flag.is_enabled ? 'ACTIVE' : 'DISABLED'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, alignItems: 'center' }}>
                        {/* Quick Toggle Button */}
                        <button
                          onClick={() => toggleFlag(flag)}
                          disabled={actionLoading === flag.id}
                          title={flag.is_enabled ? 'Vô hiệu hóa (Tắt cờ)' : 'Kích hoạt (Bật cờ)'}
                          style={{
                            background: flag.is_enabled ? '#fee2e2' : '#dcfce7',
                            color: flag.is_enabled ? '#b91c1c' : '#15803d',
                            border: 'none',
                            padding: '5px 10px',
                            borderRadius: 6,
                            cursor: actionLoading === flag.id ? 'not-allowed' : 'pointer',
                            fontWeight: 700,
                            fontSize: 11,
                            opacity: actionLoading === flag.id ? 0.6 : 1
                          }}
                        >
                          {actionLoading === flag.id ? '...' : (flag.is_enabled ? 'Tắt' : 'Bật')}
                        </button>

                        {/* Edit Button */}
                        <button
                          onClick={() => {
                            setEditingFlag(flag);
                            setIsModalOpen(true);
                          }}
                          title="Chỉnh sửa cấu hình"
                          style={{
                            background: '#f1f5f9',
                            color: '#334155',
                            border: '1px solid #cbd5e1',
                            padding: '5px 8px',
                            borderRadius: 6,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <Edit2 size={13} />
                        </button>

                        {/* Delete Button */}
                        <button
                          onClick={() => handleDelete(flag)}
                          disabled={actionLoading === flag.id}
                          title="Xóa Feature Flag vĩnh viễn"
                          style={{
                            background: '#fff1f2',
                            color: '#e11d48',
                            border: '1px solid #fecdd3',
                            padding: '5px 8px',
                            borderRadius: 6,
                            cursor: actionLoading === flag.id ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
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

      {/* Edit/Create Feature Flag Modal */}
      <EditFeatureFlagModal
        open={isModalOpen}
        flag={editingFlag}
        shops={shops}
        users={users}
        onClose={() => {
          setIsModalOpen(false);
          setEditingFlag(null);
        }}
        onSaved={(savedFlag) => {
          if (editingFlag) {
            setFlags(prev => prev.map(f => f.id === savedFlag.id ? { ...f, ...savedFlag } : f));
          } else {
            setFlags(prev => [savedFlag, ...prev]);
          }
        }}
      />
    </div>
  );
}
