import React, { useState, useEffect, useCallback } from 'react';
import { AdminService } from '../../../../domain/admin/admin.service.js';

export default function FeatureFlags() {
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(null);

  const fetchFlags = useCallback(async () => {
    setLoading(true);
    setError('');
    const res = await AdminService.getFeatureFlags();
    if (res.success) {
      setFlags(res.data || []);
    } else {
      setError(res.error || 'Cannot load feature flags');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchFlags();
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

  const describeScope = (flag) => {
    const scopeType = flag.scope_type || (flag.shop_id ? 'shop' : flag.plan_code ? 'plan' : flag.user_id ? 'user' : 'global');
    const target = flag.shop_id || flag.plan_code || flag.user_id || 'all tenants';
    return { scopeType, target };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0 }}>Feature Flags & Rollout Control</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '4px 0 0 0' }}>
            Control global, plan, shop, and user scoped rollout for commercial SaaS features.
          </p>
        </div>
        <button
          onClick={fetchFlags}
          style={{ background: 'var(--primary, #2563eb)', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
        >
          Refresh
        </button>
      </div>

      {error && (
        <div style={{ background: '#fee2e2', color: '#991b1b', padding: '12px', borderRadius: '6px', fontSize: '13px' }}>
          {error}
        </div>
      )}

      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
              <th style={{ padding: '12px 16px' }}>Feature Key</th>
              <th style={{ padding: '12px 16px' }}>Description</th>
              <th style={{ padding: '12px 16px' }}>Scope</th>
              <th style={{ padding: '12px 16px' }}>Rollout</th>
              <th style={{ padding: '12px 16px' }}>Status</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>Toggle</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>Loading feature flags...</td></tr>
            ) : flags.length === 0 && !error ? (
              <tr><td colSpan="6" style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>No feature flags yet.</td></tr>
            ) : (
              flags.map(flag => {
                const scope = describeScope(flag);
                return (
                  <tr key={flag.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, fontFamily: 'monospace', color: '#1e293b' }}>{flag.key}</td>
                    <td style={{ padding: '12px 16px', color: '#475569' }}>{flag.description || '-'}</td>
                    <td style={{ padding: '12px 16px', color: '#475569' }}>
                      <div style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '11px' }}>{scope.scopeType}</div>
                      <div style={{ fontFamily: 'monospace', fontSize: '11px', marginTop: '2px' }}>{scope.target}</div>
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: '#2563eb' }}>{flag.rollout_percentage || 0}% Rollout</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ background: flag.is_enabled ? '#dcfce7' : '#fee2e2', color: flag.is_enabled ? '#15803d' : '#991b1b', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                        {flag.is_enabled ? 'ACTIVE' : 'DISABLED'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <button
                        onClick={() => toggleFlag(flag)}
                        disabled={actionLoading === flag.id}
                        style={{
                          background: flag.is_enabled ? '#fee2e2' : '#dcfce7',
                          color: flag.is_enabled ? '#991b1b' : '#15803d',
                          border: 'none',
                          padding: '4px 10px',
                          borderRadius: '4px',
                          cursor: actionLoading === flag.id ? 'not-allowed' : 'pointer',
                          fontWeight: 600,
                          fontSize: '11px',
                          opacity: actionLoading === flag.id ? 0.6 : 1
                        }}
                      >
                        {actionLoading === flag.id ? 'Working...' : (flag.is_enabled ? 'Disable' : 'Enable')}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
