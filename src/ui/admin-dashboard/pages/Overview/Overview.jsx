import React, { useEffect, useState } from 'react';
import { AdminService } from '../../../../domain/admin/admin.service.js';

export default function Overview() {
  const [metrics, setMetrics] = useState({
    shops_total: 0,
    shops_active: 0,
    shops_trial: 0,
    shops_suspended: 0,
    users_total: 0,
    users_active: 0,
    orders_total: 0,
    orders_today: 0,
    ai_requests_total: 0,
    ai_requests_today: 0,
    ai_tokens_today: 0,
    ai_errors_today: 0,
    quota_risk_count: 0,
    subscription_risk_count: 0,
    mrr: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMetrics() {
      try {
        setLoading(true);
        const res = await AdminService.getOverviewMetrics();
        if (res.success && res.data) {
          setMetrics(res.data);
        }
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
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '30px' }}>
        <div className="card">
          <div style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '8px' }}>Total Shops</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold' }}>
            {loading ? '...' : metrics.shops_total}
          </div>
          <div style={{ marginTop: '8px', fontSize: '12px', display: 'flex', gap: '10px' }}>
            <span style={{ color: 'var(--success)' }}>{loading ? '' : `${metrics.shops_active} Active`}</span>
            <span style={{ color: 'var(--warning, #eab308)' }}>{loading ? '' : `${metrics.shops_trial} Trial`}</span>
            <span style={{ color: 'var(--danger, #ef4444)' }}>{loading ? '' : `${metrics.shops_suspended} Suspended`}</span>
          </div>
        </div>

        <div className="card">
          <div style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '8px' }}>Total Users</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold' }}>
            {loading ? '...' : metrics.users_total}
          </div>
          <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--success)' }}>
            {loading ? '' : `${metrics.users_active} Active Users`}
          </div>
        </div>

        <div className="card">
          <div style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '8px' }}>Orders Processed</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--primary)' }}>
            {loading ? '...' : metrics.orders_total}
          </div>
          <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
            {loading ? '' : `${metrics.orders_today} Orders Today`}
          </div>
        </div>

        <div className="card">
          <div style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '8px' }}>Monthly Recurring Revenue</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--success)' }}>
            {loading ? '...' : `${Number(metrics.mrr || 0).toLocaleString('vi-VN')} VND`}
          </div>
          <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
            Active paid subscriptions
          </div>
        </div>

        <div className="card">
          <div style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '8px' }}>Quota Risk</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: (metrics.quota_risk_count || 0) > 0 ? 'var(--warning, #eab308)' : 'var(--success)' }}>
            {loading ? '...' : metrics.quota_risk_count}
          </div>
          <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
            Shops above 80% usage
          </div>
        </div>

        <div className="card">
          <div style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '8px' }}>Subscription Risk</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: (metrics.subscription_risk_count || 0) > 0 ? 'var(--danger, #ef4444)' : 'var(--success)' }}>
            {loading ? '...' : metrics.subscription_risk_count}
          </div>
          <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
            Past due or canceling soon
          </div>
        </div>
      </div>

      <h3 className="section-title" style={{ fontSize: '1.2rem', marginBottom: '16px' }}>AI Usage (Today)</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
        <div className="card">
          <div style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '8px' }}>AI Requests</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold' }}>
            {loading ? '...' : metrics.ai_requests_today}
          </div>
          <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
            {loading ? '' : `${metrics.ai_requests_total} All Time`}
          </div>
        </div>

        <div className="card">
          <div style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '8px' }}>AI Tokens</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--success)' }}>
            {loading ? '...' : metrics.ai_tokens_today.toLocaleString()}
          </div>
        </div>

        <div className="card">
          <div style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '8px' }}>AI Errors</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: metrics.ai_errors_today > 0 ? 'var(--danger, #ef4444)' : 'var(--success)' }}>
            {loading ? '...' : metrics.ai_errors_today}
          </div>
        </div>
      </div>
    </div>
  );
}
