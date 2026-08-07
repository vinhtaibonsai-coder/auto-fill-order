import React, { useEffect, useState } from 'react';
import { OrderStorage } from '../../../../application/storage.js';

export default function Overview() {
  const [metrics, setMetrics] = useState({
    shops: 0,
    activeShops: 0,
    users: 0,
    orders: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMetrics() {
      try {
        let globalShops = [];
        let globalUsers = [];
        
        if (window.SupabaseCloud && window.SupabaseCloud._fetchFirestoreREST) {
          globalShops = await window.SupabaseCloud._fetchFirestoreREST('nppdungxuan', 'shops').catch(() => []);
          globalUsers = await window.SupabaseCloud.getSystemConfigs().catch(() => []);
        }

        const localOrders = await OrderStorage.getSubmittedOrders().catch(() => []);
        const localDrafts = await OrderStorage.getOrders().catch(() => []);

        setMetrics({
          shops: globalShops.length || 0,
          activeShops: globalShops.filter(s => s.status === 'Active').length || 0,
          users: globalUsers.length || 0,
          orders: localOrders.length + localDrafts.length
        });
      } catch (e) {
        console.error("Lỗi lấy data:", e);
      } finally {
        setLoading(false);
      }
    }
    loadMetrics();
  }, []);

  return (
    <div>
      <h2 className="page-title">System Overview</h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
        <div className="card">
          <div style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '8px' }}>Total Shops</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold' }}>
            {loading ? '...' : metrics.shops}
          </div>
          <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--success)' }}>
            {loading ? '' : `${metrics.activeShops} Active`}
          </div>
        </div>

        <div className="card">
          <div style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '8px' }}>Total Users</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold' }}>
            {loading ? '...' : metrics.users}
          </div>
        </div>

        <div className="card">
          <div style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '8px' }}>Orders Processed</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--primary)' }}>
            {loading ? '...' : metrics.orders}
          </div>
        </div>
      </div>
    </div>
  );
}
