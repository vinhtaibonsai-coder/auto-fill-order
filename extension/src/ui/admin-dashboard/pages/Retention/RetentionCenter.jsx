import React, { useEffect, useMemo, useState } from 'react';
import { AdminService } from '../../../../domain/admin/admin.service.js';
import { 
  PLAYBOOK_CODES, 
  PLAYBOOK_CONFIG, 
  TASK_OUTCOMES, 
  TASK_STATUSES,
  calculateCohortConversion,
  exportRetentionTasksCsv 
} from '../../../../domain/admin/retention.engine.js';
import ExportButton from '../../components/ExportButton';

export default function RetentionCenter() {
  const [activeTab, setActiveTab] = useState('portfolio'); // 'portfolio' | 'playbook' | 'cohort'
  
  // Portfolio state
  const [portfolioData, setPortfolioData] = useState(null);
  const [portfolioLoading, setPortfolioLoading] = useState(true);
  const [segment, setSegment] = useState('ALL');
  
  // Playbook Tasks state
  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [taskFilterStatus, setTaskFilterStatus] = useState('ALL');
  const [taskFilterPlaybook, setTaskFilterPlaybook] = useState('ALL');
  
  // Cohort Analytics state
  const [cohortData, setCohortData] = useState(null);
  const [cohortLoading, setCohortLoading] = useState(false);

  // Common feedback & action states
  const [error, setError] = useState('');
  const [actionNotice, setActionNotice] = useState(null); // { type: 'success' | 'info' | 'error', text: '' }
  const [updatingTaskId, setUpdatingTaskId] = useState(null);

  // Load portfolio
  const loadPortfolio = async () => {
    setPortfolioLoading(true);
    setError('');
    const r = await AdminService.getRetentionPortfolio(3, 3);
    if (r.success) setPortfolioData(r.data);
    else setError(r.error || 'Không tải được danh mục retention');
    setPortfolioLoading(false);
  };

  // Load tasks
  const loadTasks = async () => {
    setTasksLoading(true);
    const r = await AdminService.getRetentionTasks(taskFilterStatus, taskFilterPlaybook);
    if (r.success) setTasks(r.data || []);
    else setError(r.error || 'Không tải được danh sách task CSKH');
    setTasksLoading(false);
  };

  // Load cohorts
  const loadCohorts = async () => {
    setCohortLoading(true);
    const r = await AdminService.getCohortRetentionAnalytics(6);
    if (r.success) setCohortData(r.data);
    else setError(r.error || 'Không tải được số liệu cohort');
    setCohortLoading(false);
  };

  useEffect(() => {
    loadPortfolio();
  }, []);

  useEffect(() => {
    if (activeTab === 'playbook') loadTasks();
    if (activeTab === 'cohort') loadCohorts();
  }, [activeTab, taskFilterStatus, taskFilterPlaybook]);

  // Generate daily snapshot
  const handleGenerateSnapshot = async () => {
    setActionNotice(null);
    const r = await AdminService.generateRetentionSnapshots(null, 3, 3);
    if (r.success) {
      setActionNotice({ type: 'success', text: `Đã lưu snapshot retention hôm nay cho ${r.data?.shops_recorded || 0} shop.` });
      loadPortfolio();
    } else {
      setActionNotice({ type: 'error', text: r.error || 'Lỗi khi tạo snapshot' });
    }
  };

  // Quick Care action (backward compatible with v110)
  const handleQuickCare = async (row) => {
    const note = prompt(`Ghi chú chăm sóc nhanh cho ${row.shop_name}:`, 'Đã liên hệ chăm sóc');
    if (note === null) return;
    const r = await AdminService.recordRetentionAction(row.shop_id, 'CALL', note, 'DONE');
    if (!r.success) {
      alert(r.error);
    } else {
      setActionNotice({ type: 'success', text: `Đã ghi nhận chăm sóc nhanh cho ${row.shop_name}` });
      loadPortfolio();
    }
  };

  // Create Playbook Task for a shop
  const handleCreatePlaybookTask = async (row) => {
    setActionNotice(null);
    const defaultPlaybook = row.segment !== 'HEALTHY' ? row.segment : PLAYBOOK_CODES.AT_RISK;
    const playbookChoice = prompt(
      `Chọn Playbook CSKH cho ${row.shop_name}:\n1. AT_RISK (Mất tương tác/không có đơn)\n2. EXPIRING_SOON (Sắp hết hạn gói)\n3. CRITICAL (Quá hạn/hủy)\n4. MANUAL (Chăm sóc chung)\nNhập mã hoặc số (1-4):`,
      defaultPlaybook
    );
    if (!playbookChoice) return;

    let selectedPlaybook = defaultPlaybook;
    if (playbookChoice === '1' || playbookChoice.toUpperCase() === 'AT_RISK') selectedPlaybook = PLAYBOOK_CODES.AT_RISK;
    else if (playbookChoice === '2' || playbookChoice.toUpperCase() === 'EXPIRING_SOON') selectedPlaybook = PLAYBOOK_CODES.EXPIRING_SOON;
    else if (playbookChoice === '3' || playbookChoice.toUpperCase() === 'CRITICAL') selectedPlaybook = PLAYBOOK_CODES.CRITICAL;
    else if (playbookChoice === '4' || playbookChoice.toUpperCase() === 'MANUAL') selectedPlaybook = PLAYBOOK_CODES.MANUAL;

    const assignee = prompt('Tên nhân viên CSKH phụ trách:', 'CSKH Support');
    if (assignee === null) return;

    const note = prompt('Ghi chú ban đầu hoặc mục tiêu cuộc gọi:', `Playbook ${selectedPlaybook} kích hoạt cho ${row.shop_name}`);
    if (note === null) return;

    const r = await AdminService.createPlaybookTask(row.shop_id, selectedPlaybook, null, assignee, null, note);
    if (r.success) {
      if (r.data?.deduplicated) {
        setActionNotice({
          type: 'info',
          text: `[Deduplication Invariant] ${r.data.message || 'Shop đã có task đang mở cho playbook này.'} (Task ID: ${r.data.task_id})`
        });
      } else {
        setActionNotice({
          type: 'success',
          text: `Đã tạo task CSKH cho ${row.shop_name} theo playbook ${selectedPlaybook} (Task ID: ${r.data?.task_id})`
        });
      }
      loadPortfolio();
      if (activeTab === 'playbook') loadTasks();
    } else {
      setActionNotice({ type: 'error', text: r.error || 'Không thể tạo task CSKH' });
    }
  };

  // Complete / update a task
  const handleUpdateTask = async (task, newStatus) => {
    setActionNotice(null);
    let outcome = null;
    let nextAction = null;
    let note = null;

    if (newStatus === TASK_STATUSES.DONE) {
      const outcomeInput = prompt(
        `Chọn kết quả chăm sóc cho shop:\n1. RENEWED (Đã gia hạn/nâng cấp)\n2. ACTIVE_AGAIN (Đã phát sinh đơn lại)\n3. RESOLVED (Đã giải quyết vướng mắc)\n4. NO_RESPONSE (Không nghe máy/không phản hồi)\n5. FOLLOW_UP_NEEDED (Cần liên hệ lại)\n6. CHURNED (Khách xác nhận dừng sử dụng)\nNhập số (1-6):`,
        '1'
      );
      if (!outcomeInput) return;
      const outcomeMap = {
        '1': TASK_OUTCOMES.RENEWED,
        '2': TASK_OUTCOMES.ACTIVE_AGAIN,
        '3': TASK_OUTCOMES.RESOLVED,
        '4': TASK_OUTCOMES.NO_RESPONSE,
        '5': TASK_OUTCOMES.FOLLOW_UP_NEEDED,
        '6': TASK_OUTCOMES.CHURNED
      };
      outcome = outcomeMap[outcomeInput.trim()] || TASK_OUTCOMES.RESOLVED;
      nextAction = prompt('Hành động tiếp theo (Next Action):', outcome === TASK_OUTCOMES.FOLLOW_UP_NEEDED ? 'Gọi lại sau 2 ngày' : 'Theo dõi vận hành');
      note = prompt('Ghi chú kết quả chi tiết:', 'Đã trao đổi thành công');
    } else if (newStatus === TASK_STATUSES.DISMISSED) {
      note = prompt('Lý do bỏ qua (Dismiss):', 'Khách không có nhu cầu hoặc thông tin sai');
      if (note === null) return;
    }

    setUpdatingTaskId(task.id);
    const r = await AdminService.updateRetentionTask(task.id, newStatus, outcome, nextAction, note);
    setUpdatingTaskId(null);
    if (r.success) {
      setActionNotice({ type: 'success', text: `Đã cập nhật task ${task.id} thành ${newStatus} (${outcome || 'Đã đóng'})` });
      loadTasks();
      loadPortfolio();
    } else {
      setActionNotice({ type: 'error', text: r.error || 'Không thể cập nhật task' });
    }
  };

  const rows = useMemo(() => {
    const list = portfolioData?.shops || [];
    return segment === 'ALL' ? list : list.filter(x => x.segment === segment);
  }, [portfolioData, segment]);

  const processedCohorts = useMemo(() => {
    if (!cohortData?.cohorts) return [];
    return calculateCohortConversion(cohortData.cohorts);
  }, [cohortData]);

  if (portfolioLoading && !portfolioData) {
    return <div aria-busy="true" className="card" style={{ padding: 24 }}>Đang phân loại sức khỏe shop và playbook retention…</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0 }}>Giữ chân khách hàng & Anti-Churn Automation</h2>
          <p style={{ color: '#64748b', margin: '4px 0 0 0' }}>
            Quản trị vòng đời shop, phân loại rủi ro (At-risk / Expiring / Critical), playbook CSKH tự động và cohort conversion chuẩn.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button 
            onClick={handleGenerateSnapshot} 
            className="btn btn-secondary"
            title="Ghi nhận snapshot phân nhóm shop hôm nay vào retention_daily_snapshots"
          >
            📸 Lưu Daily Snapshot
          </button>
        </div>
      </div>

      {/* Action Notification Alert */}
      {actionNotice && (
        <div 
          role="alert" 
          style={{ 
            padding: '10px 16px', 
            borderRadius: 6, 
            background: actionNotice.type === 'error' ? '#fef2f2' : actionNotice.type === 'info' ? '#eff6ff' : '#f0fdf4',
            color: actionNotice.type === 'error' ? '#991b1b' : actionNotice.type === 'info' ? '#1e40af' : '#166534',
            border: `1px solid ${actionNotice.type === 'error' ? '#fecaca' : actionNotice.type === 'info' ? '#bfdbfe' : '#bbf7d0'}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <span>{actionNotice.text}</span>
          <button onClick={() => setActionNotice(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
        </div>
      )}

      {error && (
        <div role="alert" className="card" style={{ padding: 16, color: '#991b1b', background: '#fef2f2' }}>
          Lỗi: {error} <button onClick={loadPortfolio}>Thử lại</button>
        </div>
      )}

      {/* KPI Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
        {[
          ['Shop cần xử lý', (portfolioData?.shops || []).filter(x => x.segment !== 'HEALTHY').length, '#ef4444'],
          ['Trial đang mở', portfolioData?.trial_shops || 0, '#3b82f6'],
          ['Đã chuyển đổi', portfolioData?.converted_shops || 0, '#10b981'],
          [
            'Trial conversion', 
            portfolioData?.trial_conversion_percent == null ? 'N/A' : `${portfolioData.trial_conversion_percent}%`,
            '#6366f1'
          ]
        ].map(([k, v, color]) => (
          <div className="card" key={k} style={{ padding: 16, borderLeft: `4px solid ${color}` }}>
            <small style={{ color: '#64748b' }}>{k}</small>
            <strong style={{ display: 'block', fontSize: 24, marginTop: 4 }}>{v}</strong>
          </div>
        ))}
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #e2e8f0', paddingBottom: 8 }}>
        <button 
          onClick={() => setActiveTab('portfolio')} 
          style={{ 
            padding: '8px 16px', 
            borderRadius: 6, 
            background: activeTab === 'portfolio' ? '#3b82f6' : '#f1f5f9',
            color: activeTab === 'portfolio' ? '#fff' : '#475569',
            border: 'none',
            fontWeight: activeTab === 'portfolio' ? 'bold' : 'normal',
            cursor: 'pointer'
          }}
        >
          📊 Sức khỏe & Phân nhóm Shop
        </button>
        <button 
          onClick={() => setActiveTab('playbook')} 
          style={{ 
            padding: '8px 16px', 
            borderRadius: 6, 
            background: activeTab === 'playbook' ? '#3b82f6' : '#f1f5f9',
            color: activeTab === 'playbook' ? '#fff' : '#475569',
            border: 'none',
            fontWeight: activeTab === 'playbook' ? 'bold' : 'normal',
            cursor: 'pointer'
          }}
        >
          🎯 Playbook & Task CSKH
        </button>
        <button 
          onClick={() => setActiveTab('cohort')} 
          style={{ 
            padding: '8px 16px', 
            borderRadius: 6, 
            background: activeTab === 'cohort' ? '#3b82f6' : '#f1f5f9',
            color: activeTab === 'cohort' ? '#fff' : '#475569',
            border: 'none',
            fontWeight: activeTab === 'cohort' ? 'bold' : 'normal',
            cursor: 'pointer'
          }}
        >
          📈 Cohort Retention Analytics
        </button>
      </div>

      {/* Tab 1: Shop Health Portfolio */}
      {activeTab === 'portfolio' && (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['ALL', 'CRITICAL', 'EXPIRING_SOON', 'AT_RISK', 'HEALTHY'].map(x => (
                <button 
                  key={x} 
                  onClick={() => setSegment(x)} 
                  style={{
                    padding: '6px 12px',
                    borderRadius: 4,
                    background: segment === x ? '#0f172a' : '#f8fafc',
                    color: segment === x ? '#fff' : '#334155',
                    border: '1px solid #cbd5e1',
                    cursor: 'pointer',
                    fontSize: 13
                  }}
                  aria-pressed={segment === x}
                >
                  {x === 'ALL' ? 'Tất cả' : x}
                </button>
              ))}
            </div>
            <ExportButton rows={rows} filename="retention-portfolio.csv" />
          </div>

          {!rows.length ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>Không có shop thuộc nhóm đã chọn.</div>
          ) : (
            <div style={{ overflowX: 'auto', marginTop: 12 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Shop', 'Phân nhóm', 'Điểm rủi ro', 'Đơn 30 ngày', 'Đơn gần nhất', 'Hết hạn gói', 'Task mở', 'Hành động'].map(x => (
                      <th key={x} style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', fontSize: 13 }}>{x}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => {
                    const segmentColor = r.segment === 'CRITICAL' ? '#ef4444' : r.segment === 'EXPIRING_SOON' ? '#f59e0b' : r.segment === 'AT_RISK' ? '#f97316' : '#10b981';
                    return (
                      <tr key={r.shop_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 'bold' }}>{r.shop_name}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{ 
                            padding: '2px 8px', 
                            borderRadius: 12, 
                            fontSize: 11, 
                            fontWeight: 'bold',
                            background: `${segmentColor}20`,
                            color: segmentColor
                          }}>
                            {r.segment}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <strong style={{ color: r.risk_score >= 60 ? '#ef4444' : r.risk_score >= 40 ? '#f59e0b' : '#64748b' }}>
                            {r.risk_score}
                          </strong>
                        </td>
                        <td style={{ padding: '8px 12px' }}>{r.orders_30d}</td>
                        <td style={{ padding: '8px 12px', fontSize: 13 }}>
                          {r.last_order_at ? new Date(r.last_order_at).toLocaleDateString('vi-VN') : <span style={{ color: '#94a3b8' }}>Chưa có</span>}
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: 13 }}>
                          {r.expires_at ? new Date(r.expires_at).toLocaleDateString('vi-VN') : 'N/A'}
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          {r.open_actions > 0 ? (
                            <span style={{ color: '#3b82f6', fontWeight: 'bold' }}>{r.open_actions} task mở</span>
                          ) : (
                            <span style={{ color: '#94a3b8' }}>0</span>
                          )}
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <button 
                            onClick={() => handleCreatePlaybookTask(r)} 
                            style={{ 
                              padding: '4px 10px', 
                              borderRadius: 4, 
                              background: '#f1f5f9', 
                              border: '1px solid #cbd5e1',
                              cursor: 'pointer',
                              fontSize: 12
                            }}
                          >
                            🎯 Kích hoạt Playbook
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <small style={{ color: '#64748b' }}>Nguồn: {portfolioData?.data_source} · Cập nhật: {portfolioData?.measured_at ? new Date(portfolioData.measured_at).toLocaleString('vi-VN') : 'N/A'}</small>
          </div>
        </div>
      )}

      {/* Tab 2: Playbook Tasks */}
      {activeTab === 'playbook' && (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div>
                <label style={{ fontSize: 12, color: '#64748b', marginRight: 6 }}>Trạng thái:</label>
                <select 
                  value={taskFilterStatus} 
                  onChange={e => setTaskFilterStatus(e.target.value)}
                  style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #cbd5e1' }}
                >
                  <option value="ALL">Tất cả trạng thái</option>
                  <option value="OPEN">Đang mở (OPEN)</option>
                  <option value="DONE">Hoàn thành (DONE)</option>
                  <option value="DISMISSED">Bỏ qua (DISMISSED)</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#64748b', marginRight: 6 }}>Playbook:</label>
                <select 
                  value={taskFilterPlaybook} 
                  onChange={e => setTaskFilterPlaybook(e.target.value)}
                  style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #cbd5e1' }}
                >
                  <option value="ALL">Tất cả Playbook</option>
                  <option value="AT_RISK">AT_RISK</option>
                  <option value="EXPIRING_SOON">EXPIRING_SOON</option>
                  <option value="CRITICAL">CRITICAL</option>
                  <option value="MANUAL">MANUAL</option>
                </select>
              </div>
            </div>
            <ExportButton rows={tasks} filename="retention-playbook-tasks.csv" />
          </div>

          {tasksLoading ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>Đang tải danh sách task CSKH…</div>
          ) : !tasks.length ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>Không có task CSKH nào phù hợp bộ lọc.</div>
          ) : (
            <div style={{ overflowX: 'auto', marginTop: 12 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Shop', 'Playbook', 'Người phụ trách', 'Hạn xử lý', 'Trạng thái', 'Kết quả (Outcome)', 'Kế hoạch tiếp (Next action)', 'Thao tác'].map(x => (
                      <th key={x} style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', fontSize: 13 }}>{x}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tasks.map(t => {
                    const isDuePast = t.due_at && new Date(t.due_at) < new Date() && t.status === 'OPEN';
                    return (
                      <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9', background: isDuePast ? '#fffbeb' : 'transparent' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 'bold' }}>{t.shop_name}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{ 
                            padding: '2px 8px', 
                            borderRadius: 10, 
                            fontSize: 11, 
                            background: '#e0e7ff', 
                            color: '#3730a3',
                            fontWeight: 'bold' 
                          }}>
                            {t.playbook_code || 'MANUAL'}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: 13 }}>{t.assignee_name || 'Chưa gán'}</td>
                        <td style={{ padding: '8px 12px', fontSize: 13, color: isDuePast ? '#b45309' : '#334155' }}>
                          {t.due_at ? new Date(t.due_at).toLocaleDateString('vi-VN') : 'Không có'}
                          {isDuePast && <span style={{ marginLeft: 4, fontWeight: 'bold' }}>⚠️</span>}
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: 10,
                            fontSize: 11,
                            fontWeight: 'bold',
                            background: t.status === 'OPEN' ? '#dbeafe' : t.status === 'DONE' ? '#dcfce7' : '#f3f4f6',
                            color: t.status === 'OPEN' ? '#1e40af' : t.status === 'DONE' ? '#15803d' : '#6b7280'
                          }}>
                            {t.status}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: 13 }}>
                          {t.outcome ? (
                            <strong style={{ color: t.outcome === 'RENEWED' || t.outcome === 'ACTIVE_AGAIN' ? '#166534' : '#475569' }}>
                              {t.outcome}
                            </strong>
                          ) : (
                            <span style={{ color: '#94a3b8' }}>Chưa có</span>
                          )}
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: 13, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.next_action || <span style={{ color: '#94a3b8' }}>-</span>}
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          {t.status === 'OPEN' ? (
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button 
                                onClick={() => handleUpdateTask(t, TASK_STATUSES.DONE)}
                                disabled={updatingTaskId === t.id}
                                style={{ 
                                  padding: '4px 8px', 
                                  borderRadius: 4, 
                                  background: '#10b981', 
                                  color: '#fff', 
                                  border: 'none', 
                                  cursor: 'pointer',
                                  fontSize: 12
                                }}
                              >
                                ✓ Hoàn thành
                              </button>
                              <button 
                                onClick={() => handleUpdateTask(t, TASK_STATUSES.DISMISSED)}
                                disabled={updatingTaskId === t.id}
                                style={{ 
                                  padding: '4px 8px', 
                                  borderRadius: 4, 
                                  background: '#94a3b8', 
                                  color: '#fff', 
                                  border: 'none', 
                                  cursor: 'pointer',
                                  fontSize: 12
                                }}
                              >
                                Bỏ qua
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: 12, color: '#94a3b8' }}>Đã đóng</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Cohort Retention Analytics */}
      {activeTab === 'cohort' && (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16 }}>Phân tích Cohort Chuyển đổi & Giữ chân</h3>
              <small style={{ color: '#64748b' }}>
                * Tỷ lệ trưởng thành (Mature %) = Đã chuyển đổi / (Tổng - Trial đang mở). Không phạt cohort mới còn đang dùng thử.
              </small>
            </div>
            <ExportButton rows={processedCohorts} filename="retention-cohorts.csv" />
          </div>

          {cohortLoading ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>Đang tính toán phân tích cohort…</div>
          ) : !processedCohorts.length ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>Chưa có dữ liệu cohort lịch sử.</div>
          ) : (
            <div style={{ overflowX: 'auto', marginTop: 12 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Tháng Cohort', 'Tổng Shop đăng ký', 'Trial đang mở', 'Trial thất bại', 'Đã chuyển đổi (Paid)', 'Hoạt động 30 ngày', 'Tỷ lệ thô (Raw %)', 'Tỷ lệ trưởng thành (Mature %)'].map(x => (
                      <th key={x} style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', fontSize: 13 }}>{x}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {processedCohorts.map(c => (
                    <tr key={c.cohort_month} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 'bold' }}>{c.cohort_month}</td>
                      <td style={{ padding: '8px 12px' }}>{c.total_shops}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{ color: '#3b82f6', fontWeight: c.active_trial_shops > 0 ? 'bold' : 'normal' }}>
                          {c.active_trial_shops}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', color: '#ef4444' }}>{c.failed_trial_shops}</td>
                      <td style={{ padding: '8px 12px', color: '#10b981', fontWeight: 'bold' }}>{c.converted_shops}</td>
                      <td style={{ padding: '8px 12px' }}>{c.active_orders_shops}</td>
                      <td style={{ padding: '8px 12px' }}>
                        {c.raw_conversion_display === 'N/A' ? (
                          <span style={{ color: '#94a3b8' }}>N/A</span>
                        ) : (
                          `${c.raw_conversion_percent}%`
                        )}
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        {c.mature_conversion_display === 'N/A' ? (
                          <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>N/A (Chưa đáo hạn)</span>
                        ) : (
                          <strong style={{ color: c.mature_conversion_percent >= 30 ? '#10b981' : '#f59e0b' }}>
                            {c.mature_conversion_percent}%
                          </strong>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
