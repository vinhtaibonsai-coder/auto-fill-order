import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { 
  ShieldCheck, RefreshCw, Clock, User, Activity, AlertTriangle, 
  ShieldAlert, CheckCircle2, Eye, Copy, Check, Filter, Search, X
} from 'lucide-react';
import { AdminService } from '../../../../domain/admin/admin.service.js';
import ExportButton from '../../components/ExportButton';

// Risk Classification Helper
function getRiskLevel(action) {
  if (!action) return 'INFO';
  const act = action.toUpperCase();

  // CRITICAL
  if (
    act.includes('CREATE_ACCOUNT') || 
    act.includes('SET_USER_ROLE') || 
    act.includes('TRANSFER_OWNERSHIP') || 
    act.includes('IMPERSONATION')
  ) {
    return 'CRITICAL';
  }

  // HIGH
  if (
    act.includes('OVERRIDE_SUBSCRIPTION') || 
    act.includes('QUICK_EXTEND_SUBSCRIPTION') || 
    act.includes('REVOKE_SHOP_DEVICES') || 
    act.includes('REVOKE_DEVICE') || 
    act.includes('REVOKE_LICENSE_KEY') || 
    act.includes('GENERATE_LICENSE_KEYS')
  ) {
    return 'HIGH';
  }

  // MEDIUM
  if (
    act.includes('ACTIVATE_LICENSE_KEY') || 
    act.includes('APPLY_LICENSE_KEY') || 
    act.includes('SEPAY') || 
    act.includes('PAYMENT') || 
    act.includes('REPLY_TICKET') ||
    act.includes('FEATURE_FLAG')
  ) {
    return 'MEDIUM';
  }

  return 'INFO';
}

export default function SecurityRLS() {
  const [data, setData] = useState({ total: 0, logs: [] });
  const [actor, setActor] = useState('');
  const [action, setAction] = useState('');
  const [riskFilter, setRiskFilter] = useState('ALL'); // 'ALL' | 'HIGH_CRITICAL' | 'MEDIUM' | 'INFO'
  const [loading, setLoading] = useState(true);

  // Payload Inspector Modal
  const [inspectingLog, setInspectingLog] = useState(null);
  const [copiedPayload, setCopiedPayload] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await AdminService.getSecurityStats();
    if (r.success) {
      setData(r.data || { total: 0, logs: [] });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const actions = useMemo(() => {
    return [...new Set((data.logs || []).map(l => l.action).filter(Boolean))];
  }, [data.logs]);

  // KPIs
  const kpis = useMemo(() => {
    const logs = data.logs || [];
    const total = logs.length;
    let highRisk = 0;
    let adminOps = 0;
    const actorSet = new Set();

    logs.forEach(l => {
      const risk = getRiskLevel(l.action);
      if (risk === 'HIGH' || risk === 'CRITICAL') highRisk++;
      if (l.action && l.action.startsWith('ADMIN_')) adminOps++;
      if (l.actor_id || l.user_id) actorSet.add(l.actor_id || l.user_id);
    });

    return { total, highRisk, adminOps, uniqueActors: actorSet.size };
  }, [data.logs]);

  const rows = useMemo(() => (data.logs || []).filter(l => {
    const matchActor = !actor || `${l.actor_id || l.user_id || ''}`.toLowerCase().includes(actor.toLowerCase());
    const matchAction = !action || l.action === action;

    const risk = getRiskLevel(l.action);
    let matchRisk = true;
    if (riskFilter === 'HIGH_CRITICAL') {
      matchRisk = risk === 'HIGH' || risk === 'CRITICAL';
    } else if (riskFilter === 'MEDIUM') {
      matchRisk = risk === 'MEDIUM';
    } else if (riskFilter === 'INFO') {
      matchRisk = risk === 'INFO';
    }

    return matchActor && matchAction && matchRisk;
  }), [data, actor, action, riskFilter]);

  const handleCopyPayload = (payloadObj) => {
    navigator.clipboard.writeText(JSON.stringify(payloadObj, null, 2));
    setCopiedPayload(true);
    setTimeout(() => setCopiedPayload(false), 1500);
  };

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldCheck size={22} color="#2563eb" />
            Bảo Mật & Nhật Ký Kiểm Toán (Audit Logs)
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
            Giám sát toàn bộ thao tác nhạy cảm, thay đổi gói cước, sinh mã bản quyền và truy vết người thực hiện.
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
            <RefreshCw size={13} className={loading ? 'dash-spin' : ''} /> Tải lại
          </button>
          <ExportButton rows={rows} filename="nhat-ky-audit-logs.csv" />
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 8, background: '#eff6ff', display: 'grid', placeItems: 'center', color: '#2563eb' }}>
            <Activity size={20} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>TỔNG SỰ KIỆN GHI NHẬN</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}>{kpis.total}</div>
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 8, background: '#fef2f2', display: 'grid', placeItems: 'center', color: '#dc2626' }}>
            <ShieldAlert size={20} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#dc2626', fontWeight: 700 }}>HÀNH ĐỘNG RỦI RO CAO</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#dc2626' }}>{kpis.highRisk}</div>
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 8, background: '#f0fdf4', display: 'grid', placeItems: 'center', color: '#16a34a' }}>
            <ShieldCheck size={20} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>THAO TÁC ADMIN</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#16a34a' }}>{kpis.adminOps}</div>
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 8, background: '#f8fafc', display: 'grid', placeItems: 'center', color: '#475569' }}>
            <User size={20} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>NGƯỜI THỰC HIỆN (ACTORS)</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}>{kpis.uniqueActors}</div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 200, background: '#f8fafc', padding: '6px 10px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
          <Search size={14} color="#94a3b8" />
          <input
            type="text"
            placeholder="Tìm theo Actor ID / User ID..."
            value={actor}
            onChange={e => setActor(e.target.value)}
            style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: 13 }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Mức rủi ro:</span>
          <select
            value={riskFilter}
            onChange={e => setRiskFilter(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12.5 }}
          >
            <option value="ALL">Tất cả mức độ</option>
            <option value="HIGH_CRITICAL">🚨 Rủi ro cao & Tối mật</option>
            <option value="MEDIUM">⚡ Trung bình (Thương mại)</option>
            <option value="INFO">ℹ️ Thông thường (Info)</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Hành động:</span>
          <select
            value={action}
            onChange={e => setAction(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12.5 }}
          >
            <option value="">Tất cả hành động</option>
            {actions.map(act => (
              <option key={act} value={act}>{act}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid #e2e8f0', borderRadius: 12 }}>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Thời điểm</th>
                <th>Mức độ</th>
                <th>Người thực hiện (Actor)</th>
                <th>Hành động</th>
                <th>Đối tượng</th>
                <th>Chi tiết (Payload)</th>
                <th style={{ textAlign: 'right' }}>Soi chi tiết</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '36px 20px', color: '#94a3b8' }}>
                    {loading ? 'Đang tải nhật ký kiểm toán...' : 'Không tìm thấy bản ghi nhật ký nào.'}
                  </td>
                </tr>
              ) : (
                rows.map(l => {
                  const risk = getRiskLevel(l.action);
                  const isCritical = risk === 'CRITICAL';
                  const isHigh = risk === 'HIGH';
                  const isMedium = risk === 'MEDIUM';

                  return (
                    <tr key={l.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#334155', fontSize: 12.5 }}>
                          <Clock size={13} color="#64748b" />
                          <span>{new Date(l.created_at).toLocaleString('vi-VN')}</span>
                        </div>
                      </td>

                      <td>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 99,
                          fontSize: 10.5,
                          fontWeight: 700,
                          background: isCritical ? '#fee2e2' : isHigh ? '#ffedd5' : isMedium ? '#eff6ff' : '#f1f5f9',
                          color: isCritical ? '#991b1b' : isHigh ? '#c2410c' : isMedium ? '#1d4ed8' : '#64748b',
                          border: `1px solid ${isCritical ? '#fecaca' : isHigh ? '#fed7aa' : isMedium ? '#bfdbfe' : '#e2e8f0'}`
                        }}>
                          {isCritical ? 'CRITICAL' : isHigh ? 'HIGH' : isMedium ? 'MEDIUM' : 'INFO'}
                        </span>
                      </td>

                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <User size={13} color="#2563eb" />
                          <span style={{ fontWeight: 600, color: '#0f172a', fontSize: 13, fontFamily: 'monospace' }}>
                            {l.actor_id || l.user_id || 'system'}
                          </span>
                        </div>
                      </td>

                      <td>
                        <span
                          style={{
                            background: isHigh || isCritical ? '#fef2f2' : '#eff6ff',
                            color: isHigh || isCritical ? '#b91c1c' : '#1d4ed8',
                            border: `1px solid ${isHigh || isCritical ? '#fecaca' : '#bfdbfe'}`,
                            padding: '2px 8px',
                            borderRadius: 6,
                            fontSize: 11.5,
                            fontWeight: 700
                          }}
                        >
                          {l.action}
                        </span>
                      </td>

                      <td>
                        <span style={{ color: '#475569', fontSize: 12.5 }}>
                          {l.entity_type || l.target_resource} <small style={{ fontFamily: 'monospace' }}>{l.entity_id || l.target_id}</small>
                        </span>
                      </td>

                      <td>
                        <code style={{ background: '#f8fafc', padding: '4px 8px', borderRadius: 6, fontSize: 11.5, color: '#334155', display: 'block', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', border: '1px solid #e2e8f0' }}>
                          {JSON.stringify(l.details || l.payload || {}).slice(0, 120)}
                        </code>
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <button
                          onClick={() => setInspectingLog(l)}
                          title="Xem chi tiết toàn bộ dữ liệu (Payload Inspector)"
                          style={{
                            padding: '4px 8px',
                            fontSize: 11.5,
                            fontWeight: 600,
                            background: '#ffffff',
                            color: '#2563eb',
                            border: '1px solid #bfdbfe',
                            borderRadius: 6,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                        >
                          <Eye size={12} /> Xem
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

      {/* Payload Inspector Modal */}
      {inspectingLog && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          display: 'grid',
          placeItems: 'center',
          zIndex: 9999,
          padding: 16
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: 14,
            width: '100%',
            maxWidth: 600,
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#f8fafc'
            }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShieldCheck size={18} color="#2563eb" /> Chi Tiết Bản Ghi Kiểm Toán (Audit Log Inspector)
              </h3>
              <button onClick={() => setInspectingLog(null)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#94a3b8' }}>✕</button>
            </div>

            <div style={{ padding: 20, display: 'grid', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, background: '#f8fafc', padding: 12, borderRadius: 8, fontSize: 12.5 }}>
                <div>
                  <span style={{ color: '#64748b' }}>Hành động:</span>{' '}
                  <strong style={{ color: '#0f172a' }}>{inspectingLog.action}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Mức rủi ro:</span>{' '}
                  <strong style={{ color: '#b91c1c' }}>{getRiskLevel(inspectingLog.action)}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Actor / User ID:</span>{' '}
                  <code style={{ color: '#2563eb' }}>{inspectingLog.actor_id || inspectingLog.user_id || 'system'}</code>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Thời gian:</span>{' '}
                  <span>{new Date(inspectingLog.created_at).toLocaleString('vi-VN')}</span>
                </div>
                {inspectingLog.entity_type && (
                  <div style={{ gridColumn: 'span 2' }}>
                    <span style={{ color: '#64748b' }}>Đối tượng tác động:</span>{' '}
                    <span>{inspectingLog.entity_type} {inspectingLog.entity_id ? `(#${inspectingLog.entity_id})` : ''}</span>
                  </div>
                )}
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>Dữ liệu chi tiết (JSON Payload):</label>
                  <button
                    onClick={() => handleCopyPayload(inspectingLog.details || inspectingLog.payload || {})}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      padding: '3px 8px',
                      borderRadius: 4,
                      fontSize: 11,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    {copiedPayload ? <Check size={12} color="#16a34a" /> : <Copy size={12} />}
                    {copiedPayload ? 'Đã copy!' : 'Copy JSON'}
                  </button>
                </div>

                <pre style={{
                  background: '#0f172a',
                  color: '#38bdf8',
                  padding: 14,
                  borderRadius: 8,
                  fontSize: 12,
                  fontFamily: 'monospace',
                  maxHeight: 250,
                  overflowY: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  margin: 0
                }}>
                  {JSON.stringify(inspectingLog.details || inspectingLog.payload || {}, null, 2)}
                </pre>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                <button
                  onClick={() => setInspectingLog(null)}
                  style={{ padding: '8px 16px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
