import React, { useState, useEffect } from 'react';
import { SkeletonTableRows } from '../../components/SkeletonTable';
import { AdminService } from '../../../../domain/admin/admin.service.js';

export default function ShopList() {
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedShop, setSelectedShop] = useState(null);
  const [aiSettingsModalOpen, setAiSettingsModalOpen] = useState(false);
  const [currentAiRules, setCurrentAiRules] = useState('');
  const [aiSettingsSaving, setAiSettingsSaving] = useState(false);

  const fetchShops = async () => {
    setLoading(true);
    setError('');
    const res = await AdminService.getShopsList();
    if (res.success) {
      setShops(res.data || []);
    } else {
      setError(res.error || 'Lỗi tải danh sách cửa hàng');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchShops();
  }, []);

  const handleToggleStatus = async (shop) => {
    const newStatus = shop.status === 'Active' ? 'Suspended' : 'Active';
    if (!window.confirm(`Bạn có chắc muốn chuyển trạng thái Shop "${shop.name}" thành ${newStatus}?`)) return;

    const res = await AdminService.updateShopStatus(shop.id, shop.status, newStatus);
    if (res.success) {
      // Reload danh sách sau khi update thành công
      fetchShops();
    } else {
      alert('Lỗi cập nhật trạng thái: ' + res.error);
    }
  };

  const getAiUsage = (used, limit) => {
    if (!limit || limit === 0) return 0;
    const pct = Math.round((used / limit) * 100);
    return pct > 100 ? 100 : pct;
  };

  const handleOpenAiSettings = async (shop) => {
    setSelectedShop(shop);
    setAiSettingsModalOpen(true);
    setCurrentAiRules('Loading...');
    const res = await AdminService.getShopFeatureFlags(shop.id);
    if (res.success && res.data) {
      setCurrentAiRules(res.data.custom_prompt_rules || '');
    } else {
      setCurrentAiRules('');
    }
  };

  const handleSaveAiSettings = async () => {
    setAiSettingsSaving(true);
    const res = await AdminService.updateShopFeatureFlags(selectedShop.id, {}, { custom_prompt_rules: currentAiRules });
    setAiSettingsSaving(false);
    if (res.success) {
      alert('Đã lưu AI Settings thành công!');
      setAiSettingsModalOpen(false);
    } else {
      alert('Lỗi khi lưu AI Settings: ' + res.error);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 className="page-title" style={{ margin: 0 }}>Shops Management</h2>
        <button onClick={fetchShops} className="badge badge-success" style={{ cursor: 'pointer', border: 'none', padding: '8px 16px', fontSize: '14px', background: 'var(--primary)' }}>
          🔄 Refresh
        </button>
      </div>

      {error && (
        <div style={{ background: '#fee2e2', color: '#991b1b', padding: '12px', borderRadius: '6px', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
              <th style={{ padding: '16px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' }}>Shop Name</th>
              <th style={{ padding: '16px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' }}>Plan</th>
              <th style={{ padding: '16px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' }}>Users / Devices</th>
              <th style={{ padding: '16px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' }}>AI Usage</th>
              <th style={{ padding: '16px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' }}>Status</th>
              <th style={{ padding: '16px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase' }}>Created At</th>
              <th style={{ padding: '16px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonTableRows columns={7} rows={5} />
            ) : shops.length === 0 ? (
              <tr><td colSpan="7" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)' }}>No shops found.</td></tr>
            ) : (
              shops.map(shop => {
                const aiPct = getAiUsage(shop.ai_quota_used, shop.ai_quota_limit);
                return (
                  <tr key={shop.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background-color 0.2s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                    <td style={{ padding: '16px' }}>
                      <div style={{ fontWeight: 600, fontSize: '14px' }}>{shop.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace', marginTop: '4px' }}>{shop.id}</div>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 'bold', color: shop.plan === 'PRO' ? '#a855f7' : shop.plan === 'STARTER' ? '#3b82f6' : 'var(--text-secondary)' }}>
                        {shop.plan}
                      </span>
                    </td>
                    <td style={{ padding: '16px', fontSize: '13px' }}>
                      <span title="Users">🧑 {shop.users_count}</span> &nbsp;&nbsp;|&nbsp;&nbsp; <span title="Devices">📱 {shop.devices_count}</span>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <div style={{ fontSize: '12px', marginBottom: '4px' }}>{shop.ai_quota_used} / {shop.ai_quota_limit} ({aiPct}%)</div>
                      <div style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.1)', height: '6px', borderRadius: '3px' }}>
                        <div style={{ width: `${aiPct}%`, backgroundColor: aiPct > 90 ? 'var(--danger, #ef4444)' : aiPct > 70 ? 'var(--warning, #eab308)' : 'var(--success, #10b981)', height: '100%', borderRadius: '3px' }}></div>
                      </div>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <span className={`badge ${shop.status === 'Active' ? 'badge-success' : shop.status === 'Trial' ? 'badge-warning' : 'badge-danger'}`} style={{ textTransform: 'uppercase', fontSize: '10px' }}>
                        {shop.status}
                      </span>
                    </td>
                    <td style={{ padding: '16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {new Date(shop.created_at).toLocaleDateString('vi-VN')}
                    </td>
                    <td style={{ padding: '16px', textAlign: 'right' }}>
                      <button 
                        onClick={() => handleOpenAiSettings(shop)}
                        style={{ 
                          background: 'rgba(59, 130, 246, 0.1)', 
                          border: '1px solid #3b82f6', 
                          color: '#3b82f6', 
                          padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, transition: 'all 0.2s',
                          marginRight: '8px'
                        }}
                      >
                        🤖 AI Settings
                      </button>
                      <button 
                        onClick={() => handleToggleStatus(shop)}
                        style={{ 
                          background: shop.status === 'Active' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', 
                          border: `1px solid ${shop.status === 'Active' ? '#ef4444' : '#10b981'}`, 
                          color: shop.status === 'Active' ? '#ef4444' : '#10b981', 
                          padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, transition: 'all 0.2s'
                        }}
                      >
                        {shop.status === 'Active' ? 'Khoá Shop' : 'Mở Khoá'}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {aiSettingsModalOpen && selectedShop && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="card" style={{ width: '500px', maxWidth: '90%', padding: '24px' }}>
            <h3 style={{ marginTop: 0 }}>Cấu hình AI cho: {selectedShop.name}</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Nhập các quy tắc bóc tách AI tùy chỉnh cho Shop này (Ví dụ: "Luôn lấy tiền thu hộ là 0"). Dữ liệu sẽ tự động đồng bộ xuống Extension của Shop.</p>
            <textarea 
              value={currentAiRules}
              onChange={(e) => setCurrentAiRules(e.target.value)}
              placeholder="Nhập luật tùy chỉnh..."
              style={{ width: '100%', height: '120px', padding: '12px', borderRadius: '6px', border: '1px solid var(--border)', marginTop: '12px', resize: 'vertical' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
              <button 
                onClick={() => setAiSettingsModalOpen(false)}
                style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-main)', borderRadius: '6px', cursor: 'pointer' }}
              >
                Hủy
              </button>
              <button 
                onClick={handleSaveAiSettings}
                disabled={aiSettingsSaving}
                style={{ padding: '8px 16px', background: 'var(--primary)', border: 'none', color: '#fff', borderRadius: '6px', cursor: aiSettingsSaving ? 'not-allowed' : 'pointer', fontWeight: 600 }}
              >
                {aiSettingsSaving ? 'Đang lưu...' : 'Lưu cấu hình'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
