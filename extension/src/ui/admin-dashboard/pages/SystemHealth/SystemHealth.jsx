import React, { useState, useEffect, useCallback } from 'react';
import { AdminService } from '../../../../domain/admin/admin.service.js';

export default function SystemHealth() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    setError('');
    const res = await AdminService.getSystemHealth();
    if (res.success) {
      setHealth(res.data || null);
    } else {
      setError(res.error || 'Cannot load system health');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  const isHealthy = (status) => ['healthy', 'ok', 'enabled', 'active'].includes(String(status || '').toLowerCase());

  const badge = (ok) => ({
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    background: ok ? '#10b981' : '#ef4444',
    boxShadow: ok ? '0 0 10px rgba(16, 185, 129, 0.4)' : '0 0 10px rgba(239, 68, 68, 0.4)'
  });

  const infrastructure = health ? [
    { label: 'Supabase', status: health.supabase_status, detail: health.supabase_latency_ms ? `${health.supabase_latency_ms}ms` : 'database' },
    { label: 'Auth', status: health.auth_status, detail: health.auth_users_24h ? `${health.auth_users_24h} active users / 24h` : 'sessions' },
    { label: 'RLS', status: health.rls_status, detail: health.rls_policy_count ? `${health.rls_policy_count} policies` : 'tenant isolation' },
    { label: 'Sync', status: health.sync_status, detail: `${health.sync_failed_24h || 0} failed / 24h` },
    { label: 'AI Gateway', status: health.ai_gateway_status, detail: `${health.ai_total_24h || 0} requests / 24h` },
    { label: 'Provider', status: health.provider_status, detail: health.provider_name || 'primary provider' }
  ] : [];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2>System Health</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Live monitoring for infrastructure, AI, sync, and carrier automation.</p>
        </div>
        <button
          onClick={fetchHealth}
          style={{ background: 'var(--primary, #2563eb)', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
        >
          Refresh
        </button>
      </div>

      {error && (
        <div style={{ background: '#fee2e2', color: '#991b1b', padding: '12px', borderRadius: '6px', fontSize: '13px', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      {loading && !health ? (
        <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>Loading health data...</div>
      ) : health ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '24px' }}>
            {infrastructure.map(item => (
              <div key={item.label} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ margin: '0 0 8px 0' }}>{item.label}</h3>
                    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '13px' }}>{item.detail}</p>
                  </div>
                  <div style={badge(isHealthy(item.status))}></div>
                </div>
                <div style={{ marginTop: '18px', fontSize: '18px', fontWeight: 700, textTransform: 'uppercase', color: isHealthy(item.status) ? '#10b981' : '#ef4444' }}>
                  {item.status || 'unknown'}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '24px' }}>
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ margin: '0 0 8px 0' }}>AI Success Rate</h3>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '13px' }}>Quota limit hits are counted as risk.</p>
                </div>
                <div style={badge((health.ai_success_rate || 0) >= 99)}></div>
              </div>
              <div style={{ marginTop: '20px', display: 'flex', gap: '24px' }}>
                <div>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 600 }}>Success</div>
                  <div style={{ fontSize: '18px', fontWeight: 600 }}>{health.ai_success_rate || 0}%</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 600 }}>Errors</div>
                  <div style={{ fontSize: '18px', fontWeight: 600, color: (health.ai_errors_24h || 0) > 0 ? '#ef4444' : '#10b981' }}>{health.ai_errors_24h || 0}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 600 }}>Quota Limited</div>
                  <div style={{ fontSize: '18px', fontWeight: 600, color: (health.ai_quota_limited_24h || 0) > 0 ? '#f59e0b' : '#10b981' }}>{health.ai_quota_limited_24h || 0}</div>
                </div>
              </div>
            </div>

            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ margin: '0 0 8px 0' }}>Carriers DOM</h3>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '13px' }}>VNPost and J&T automation selectors.</p>
                </div>
                <div style={badge((health.carriers || []).every(c => c.status === 'healthy'))}></div>
              </div>
              <div style={{ marginTop: '20px' }}>
                {(health.carriers || []).length === 0 ? (
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>No carrier monitor data yet.</div>
                ) : (
                  health.carriers.map(c => (
                    <div key={c.carrier_code} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ fontWeight: 600 }}>{c.carrier_code}</span>
                      <span style={{ color: c.status === 'healthy' ? '#10b981' : '#ef4444' }}>
                        {c.status} - {c.response_time_ms}ms
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>Carrier Health Monitor</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', marginTop: '16px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '12px 0', color: 'var(--text-secondary)', fontSize: '12px' }}>Carrier</th>
                  <th style={{ padding: '12px 0', color: 'var(--text-secondary)', fontSize: '12px' }}>Status</th>
                  <th style={{ padding: '12px 0', color: 'var(--text-secondary)', fontSize: '12px' }}>Latency</th>
                  <th style={{ padding: '12px 0', color: 'var(--text-secondary)', fontSize: '12px' }}>Error</th>
                  <th style={{ padding: '12px 0', color: 'var(--text-secondary)', fontSize: '12px' }}>Detected At</th>
                </tr>
              </thead>
              <tbody>
                {(health.carriers || []).length === 0 ? (
                  <tr><td colSpan="5" style={{ padding: '16px 0', color: 'var(--text-secondary)', fontSize: '13px' }}>No carrier logs yet.</td></tr>
                ) : (
                  health.carriers.map(c => (
                    <tr key={c.carrier_code} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 0', fontSize: '13px', fontWeight: 600 }}>{c.carrier_code}</td>
                      <td style={{ padding: '12px 0', fontSize: '13px' }}>{c.status}</td>
                      <td style={{ padding: '12px 0', fontSize: '13px' }}>{c.response_time_ms}ms</td>
                      <td style={{ padding: '12px 0', fontSize: '13px', color: '#ef4444' }}>{c.error_message || '-'}</td>
                      <td style={{ padding: '12px 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                        {c.detected_at ? new Date(c.detected_at).toLocaleString('vi-VN') : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
              Last checked: {health.checked_at ? new Date(health.checked_at).toLocaleString('vi-VN') : '-'}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
