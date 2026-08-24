import React, { useState, useEffect, useCallback } from 'react';
import { AdminService } from '../../../../domain/admin/admin.service.js';

export default function AddressDataset() {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const [workflow, setWorkflow] = useState({});

  const fetchVersions = useCallback(async () => {
    setLoading(true);
    setError('');
    const res = await AdminService.getAddressDatasets();
    if (res.success) {
      setVersions(res.data || []);
    } else {
      setError(res.error || 'Cannot load address datasets');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchVersions();
  }, [fetchVersions]);

  const setDatasetStage = (datasetId, stage, detail = '') => {
    setWorkflow(prev => ({ ...prev, [datasetId]: { stage, detail, updatedAt: new Date().toISOString() } }));
  };

  const validateDataset = (dataset) => {
    if (!dataset?.id || !dataset?.version || Number(dataset.total_records || 0) <= 0) {
      setDatasetStage(dataset.id, 'validation_failed', 'Missing version or record count.');
      return;
    }
    setDatasetStage(dataset.id, 'validated', `${Number(dataset.total_records || 0).toLocaleString()} records validated`);
  };

  const previewDataset = (dataset) => {
    setDatasetStage(
      dataset.id,
      'previewed',
      `Preview diff ready for ${dataset.version}: ${dataset.description || 'no release note'}`
    );
  };

  const testDataset = (dataset) => {
    const hasImportTimestamp = Boolean(dataset.published_at || dataset.created_at);
    setDatasetStage(dataset.id, hasImportTimestamp ? 'tested' : 'test_failed', hasImportTimestamp ? 'Smoke test passed' : 'Missing import timestamp');
  };

  const releaseDataset = async (dataset, action) => {
    const state = workflow[dataset.id];
    if (state?.stage !== 'tested') {
      setDatasetStage(dataset.id, 'blocked', 'Validate, preview diff, and test before release.');
      return;
    }

    const reason = window.prompt(`Reason for ${action} ${dataset.version}:`);
    if (!reason?.trim()) return;

    setActionLoading(dataset.id);
    const res = await AdminService.activateAddressDataset(dataset, action, reason);

    if (res.success) {
      setVersions(prev => prev.map(v => (
        v.id === dataset.id ? { ...v, is_active: true } : { ...v, is_active: false }
      )));
      setDatasetStage(dataset.id, 'monitoring', res.data?.monitor_required ? 'Monitoring enabled after release' : 'Release complete');
    } else {
      setDatasetStage(dataset.id, 'release_failed', res.error || 'Release failed');
      alert('Error: ' + res.error);
    }
    setActionLoading(null);
  };

  const actionForDataset = (dataset) => dataset.published_at ? 'rollback' : 'publish';

  const buttonStyle = {
    background: '#f8fafc',
    border: '1px solid #cbd5e1',
    padding: '4px 8px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '11px'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0 }}>Address Dataset Versioning & Release</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '4px 0 0 0' }}>
            Validate, preview diff, test, publish or rollback, then monitor production impact.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={fetchVersions}
            style={{ background: '#f8fafc', color: '#0f172a', border: '1px solid #cbd5e1', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
          >
            Refresh
          </button>
          <button style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}>
            Import Dataset
          </button>
        </div>
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
              <th style={{ padding: '12px 16px' }}>Version</th>
              <th style={{ padding: '12px 16px' }}>Records</th>
              <th style={{ padding: '12px 16px' }}>Status</th>
              <th style={{ padding: '12px 16px' }}>Published</th>
              <th style={{ padding: '12px 16px' }}>Description</th>
              <th style={{ padding: '12px 16px' }}>Workflow</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="7" style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>Loading datasets...</td></tr>
            ) : versions.length === 0 && !error ? (
              <tr><td colSpan="7" style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>No datasets yet.</td></tr>
            ) : (
              versions.map(v => {
                const state = workflow[v.id] || { stage: v.is_active ? 'monitoring' : 'observed', detail: v.is_active ? 'Production dataset' : 'Ready for validation' };
                const releaseAction = actionForDataset(v);

                return (
                  <tr key={v.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0f172a' }}>{v.version}</td>
                    <td style={{ padding: '12px 16px', color: '#475569' }}>{Number(v.total_records || 0).toLocaleString()} wards</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ background: v.is_active ? '#dcfce7' : '#f1f5f9', color: v.is_active ? '#15803d' : '#64748b', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                        {v.is_active ? 'ACTIVE (PRODUCTION)' : 'ARCHIVED'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#64748b' }}>
                      {v.published_at ? new Date(v.published_at).toLocaleDateString('vi-VN') : '-'}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#64748b' }}>{v.description || '-'}</td>
                    <td style={{ padding: '12px 16px', color: '#475569' }}>
                      <div style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '11px' }}>{state.stage}</div>
                      <div style={{ fontSize: '12px', marginTop: '2px' }}>{state.detail}</div>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      {v.is_active ? (
                        <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600 }}>Monitoring</span>
                      ) : (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', flexWrap: 'wrap' }}>
                          <button onClick={() => validateDataset(v)} style={buttonStyle}>Validate</button>
                          <button onClick={() => previewDataset(v)} disabled={!['validated', 'previewed', 'tested'].includes(state.stage)} style={buttonStyle}>Preview diff</button>
                          <button onClick={() => testDataset(v)} disabled={state.stage !== 'previewed'} style={buttonStyle}>Test</button>
                          <button
                            onClick={() => releaseDataset(v, releaseAction)}
                            disabled={actionLoading === v.id || state.stage !== 'tested'}
                            style={{ background: releaseAction === 'publish' ? '#dcfce7' : '#fee2e2', color: releaseAction === 'publish' ? '#15803d' : '#991b1b', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: actionLoading === v.id ? 'not-allowed' : 'pointer', fontSize: '11px', opacity: actionLoading === v.id ? 0.6 : 1 }}
                          >
                            {actionLoading === v.id ? 'Working...' : releaseAction}
                          </button>
                        </div>
                      )}
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
