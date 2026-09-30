import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, CheckCircle2, Clock, AlertTriangle, Phone, MessageSquare, 
  Send, Filter, Search, RefreshCw, ChevronRight, ExternalLink, ShieldAlert, Sparkles
} from 'lucide-react';
import { AuthSession } from '../../../../domain/auth/auth.session.esm.js';
import { checkAndRunDailyEvaluation } from '../../../../domain/retention/cs-task-scheduler.service.js';

const STATUS_COLUMNS = [
  { code: 'NEW', label: 'Mới tạo', color: '#2563eb', bg: '#eff6ff' },
  { code: 'IN_PROGRESS', label: 'Đang xử lý', color: '#d97706', bg: '#fef3c7' },
  { code: 'WAITING_REPLY', label: 'Chờ phản hồi', color: '#8b5cf6', bg: '#f5f3ff' },
  { code: 'COMPLETED', label: 'Hoàn thành', color: '#10b981', bg: '#ecfdf5' },
  { code: 'DISMISSED', label: 'Bỏ qua', color: '#64748b', bg: '#f8fafc' }
];

const PRIORITY_BADGES = {
  URGENT: { label: 'Khẩn cấp', color: '#dc2626', bg: '#fee2e2' },
  HIGH: { label: 'Ưu tiên cao', color: '#ea580c', bg: '#ffedd5' },
  MEDIUM: { label: 'Trung bình', color: '#ca8a04', bg: '#fef9c3' },
  LOW: { label: 'Bình thường', color: '#475569', bg: '#f1f5f9' }
};

export default function CskhTaskWorkspace() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [updating, setUpdating] = useState(false);
  const [outcomeNote, setOutcomeNote] = useState('');

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const sess = await AuthSession.getSession();
      const config = await globalThis.SupabaseCloud?.loadConfig?.();
      if (!sess?.access_token || !config?.url || !sess.active_shop_id) {
        setTasks([]);
        return;
      }

      const headers = {
        'apikey': config.anonKey,
        'Authorization': `Bearer ${sess.access_token}`
      };

      const res = await fetch(
        `${config.url}/rest/v1/customer_success_tasks?shop_id=eq.${sess.active_shop_id}&order=created_at.desc&limit=100`,
        { headers }
      );

      if (res.ok) {
        const data = await res.json();
        setTasks(data || []);
      }
    } catch (err) {
      console.error('[CskhWorkspace] Load tasks error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const sess = await AuthSession.getSession();
        if (sess?.active_shop_id) {
          await checkAndRunDailyEvaluation(sess.active_shop_id, false);
        }
      } catch (_) {}
      loadTasks();
    })();
  }, [loadTasks]);

  const handleRunEvaluation = async () => {
    setEvaluating(true);
    try {
      const sess = await AuthSession.getSession();
      if (sess?.active_shop_id) {
        const res = await checkAndRunDailyEvaluation(sess.active_shop_id, true);
        const count = res?.result?.tasks_created || 0;
        alert(`Hoàn thành đánh giá Playbook! Đã tạo thêm ${count} công việc mới.`);
        await loadTasks();
      } else {
        alert('Vui lòng chọn cửa hàng đang hoạt động.');
      }
    } catch (e) {
      alert('Lỗi đánh giá CSKH: ' + e.message);
    } finally {
      setEvaluating(false);
    }
  };

  const handleUpdateStatus = async (taskId, newStatus, outcome) => {
    setUpdating(true);
    try {
      const sess = await AuthSession.getSession();
      const config = await globalThis.SupabaseCloud?.loadConfig?.();
      const headers = {
        'apikey': config.anonKey,
        'Authorization': `Bearer ${sess.access_token}`,
        'Content-Type': 'application/json'
      };

      const res = await fetch(`${config.url}/rest/v1/rpc/update_cs_task_status`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          p_task_id: taskId,
          p_shop_id: sess.active_shop_id,
          p_status: newStatus,
          p_outcome: outcome || null,
          p_notes: outcomeNote || null
        })
      });

      if (res.ok) {
        setSelectedTask(null);
        setOutcomeNote('');
        await loadTasks();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.message || 'Lỗi cập nhật trạng thái');
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const filteredTasks = tasks.filter(t => {
    if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (t.playbook_code || '').toLowerCase().includes(q) || (t.reason || '').toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* TOOLBAR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Tìm theo mã playbook, lý do..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                padding: '7px 12px 7px 32px',
                border: '1px solid #cbd5e1',
                borderRadius: 8,
                fontSize: 13,
                outline: 'none',
                width: 250
              }}
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{ padding: '7px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13 }}
          >
            <option value="ALL">Tất cả trạng thái</option>
            {STATUS_COLUMNS.map(c => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={handleRunEvaluation}
            disabled={evaluating}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 14px',
              background: '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: evaluating ? 'not-allowed' : 'pointer',
              opacity: evaluating ? 0.7 : 1
            }}
          >
            <Sparkles size={14} className={evaluating ? 'spin' : ''} /> {evaluating ? 'Đang quét...' : 'Quét Playbook tự động'}
          </button>

          <button
            onClick={loadTasks}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 14px',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Tải lại
          </button>
        </div>
      </div>

      {/* KANBAN / LIST CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        {STATUS_COLUMNS.map(col => {
          const colTasks = filteredTasks.filter(t => t.status === col.code);
          return (
            <div key={col.code} style={{ background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0', padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: col.color, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: col.color }} />
                  {col.label}
                </span>
                <span style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
                  {colTasks.length}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {colTasks.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 10px', color: '#94a3b8', fontSize: 12 }}>
                    Không có công việc nào
                  </div>
                ) : (
                  colTasks.map(task => {
                    const priorityMeta = PRIORITY_BADGES[task.priority] || PRIORITY_BADGES.MEDIUM;
                    const isOverdue = task.due_at && new Date(task.due_at).getTime() < Date.now() && task.status !== 'COMPLETED';

                    return (
                      <div
                        key={task.id}
                        onClick={() => setSelectedTask(task)}
                        style={{
                          background: '#ffffff',
                          borderRadius: 8,
                          border: isOverdue ? '1px solid #f87171' : '1px solid #e2e8f0',
                          padding: 12,
                          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{
                            background: priorityMeta.bg,
                            color: priorityMeta.color,
                            fontSize: 10.5,
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: 4
                          }}>
                            {priorityMeta.label}
                          </span>
                          {isOverdue && (
                            <span style={{ color: '#dc2626', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                              <Clock size={11} /> Quá hạn SLA
                            </span>
                          )}
                        </div>

                        <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>
                          {task.playbook_code}
                        </div>

                        <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.4 }}>
                          {task.reason}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, fontSize: 11, color: '#64748b' }}>
                          <span>Kênh: <b>{task.suggested_channel || 'Zalo'}</b></span>
                          <span>Hạn: {new Date(task.due_at).toLocaleDateString('vi-VN')}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* DETAIL MODAL */}
      {selectedTask && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: 12,
            width: '100%',
            maxWidth: 520,
            padding: 24,
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: 16
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                  {selectedTask.playbook_code}
                </h3>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  Mã tác vụ: #{selectedTask.id.substring(0, 8)} · Phân khúc: <b>{selectedTask.segment}</b>
                </div>
              </div>
              <button
                onClick={() => setSelectedTask(null)}
                style={{ border: 'none', background: 'transparent', fontSize: 18, cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, fontSize: 12.5, lineHeight: 1.5, color: '#334155' }}>
              <div><strong>Lý do kích hoạt:</strong> {selectedTask.reason}</div>
              <div style={{ marginTop: 4 }}><strong>Kênh đề xuất:</strong> {selectedTask.suggested_channel}</div>
              <div style={{ marginTop: 4 }}><strong>Hạn xử lý (SLA):</strong> {new Date(selectedTask.due_at).toLocaleString('vi-VN')}</div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4, color: '#334155' }}>
                Ghi chú kết quả chăm sóc:
              </label>
              <textarea
                value={outcomeNote}
                onChange={e => setOutcomeNote(e.target.value)}
                placeholder="Nhập ghi chú phản hồi của khách, lý do sụt giảm hoặc cam kết gia hạn..."
                style={{
                  width: '100%',
                  minHeight: 70,
                  padding: 8,
                  border: '1px solid #cbd5e1',
                  borderRadius: 6,
                  fontSize: 12.5,
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button
                disabled={updating}
                onClick={() => handleUpdateStatus(selectedTask.id, 'IN_PROGRESS')}
                style={{ padding: '7px 12px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#f8fafc', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              >
                Nhận xử lý
              </button>
              <button
                disabled={updating}
                onClick={() => handleUpdateStatus(selectedTask.id, 'WAITING_REPLY')}
                style={{ padding: '7px 12px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#f5f3ff', color: '#7c3aed', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              >
                Chờ phản hồi
              </button>
              <button
                disabled={updating}
                onClick={() => handleUpdateStatus(selectedTask.id, 'COMPLETED', 'CUSTOMER_SATISFIED')}
                style={{ padding: '7px 14px', borderRadius: 6, border: 'none', background: '#10b981', color: '#ffffff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
              >
                ✓ Hoàn thành
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
