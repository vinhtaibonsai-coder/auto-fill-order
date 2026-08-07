import React from 'react';

export default function SystemHealth() {
  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2>System Health</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Live monitoring of all infrastructure components.</p>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '24px' }}>
        
        {/* Supabase Status */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h3 style={{ margin: '0 0 8px 0' }}>Supabase Backend</h3>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '13px' }}>Auth, Database, Edge Functions</p>
            </div>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 10px rgba(16, 185, 129, 0.4)' }}></div>
          </div>
          <div style={{ marginTop: '20px', display: 'flex', gap: '24px' }}>
            <div>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 600 }}>Latency</div>
              <div style={{ fontSize: '18px', fontWeight: 600 }}>45ms</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 600 }}>Uptime</div>
              <div style={{ fontSize: '18px', fontWeight: 600 }}>99.99%</div>
            </div>
          </div>
        </div>

        {/* AI Gateway Status */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h3 style={{ margin: '0 0 8px 0' }}>AI Gateway (Groq)</h3>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '13px' }}>LLaMA 3 API Routing</p>
            </div>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 10px rgba(16, 185, 129, 0.4)' }}></div>
          </div>
          <div style={{ marginTop: '20px', display: 'flex', gap: '24px' }}>
            <div>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 600 }}>Latency</div>
              <div style={{ fontSize: '18px', fontWeight: 600 }}>210ms</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 600 }}>Rate Limit</div>
              <div style={{ fontSize: '18px', fontWeight: 600 }}>Healthy</div>
            </div>
          </div>
        </div>

        {/* Carriers Status */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h3 style={{ margin: '0 0 8px 0' }}>Carriers DOM</h3>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '13px' }}>VNPost & J&T Web Scraping</p>
            </div>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#f59e0b', boxShadow: '0 0 10px rgba(245, 158, 11, 0.4)' }}></div>
          </div>
          <div style={{ marginTop: '20px' }}>
            <div style={{ fontSize: '13px', background: '#fef3c7', color: '#b45309', padding: '8px', borderRadius: '6px' }}>
              ⚠ J&T recently updated their CSS classes. Address auto-fill might be degraded.
            </div>
          </div>
        </div>
      </div>
      
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Recent Incidents</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', marginTop: '16px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '12px 0', color: 'var(--text-secondary)', fontSize: '12px' }}>Date</th>
              <th style={{ padding: '12px 0', color: 'var(--text-secondary)', fontSize: '12px' }}>Component</th>
              <th style={{ padding: '12px 0', color: 'var(--text-secondary)', fontSize: '12px' }}>Issue</th>
              <th style={{ padding: '12px 0', color: 'var(--text-secondary)', fontSize: '12px' }}>Resolution</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: '12px 0', fontSize: '13px' }}>2026-08-01 14:00</td>
              <td style={{ padding: '12px 0', fontSize: '13px', fontWeight: 600 }}>AI Gateway</td>
              <td style={{ padding: '12px 0', fontSize: '13px', color: '#ef4444' }}>Groq API Rate Limit Exceeded</td>
              <td style={{ padding: '12px 0', fontSize: '13px', color: 'var(--text-secondary)' }}>Auto-scaled token buckets</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
