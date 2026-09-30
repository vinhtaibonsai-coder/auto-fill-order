import React, { useState, useEffect, useCallback } from 'react';
import { AuthSession } from '../../../../domain/auth/auth.session.esm.js';
import {
  Headphones, Send, Clock, CheckCircle2, AlertCircle,
  MessageSquare, RefreshCw, PlusCircle, HelpCircle, ShieldAlert
} from 'lucide-react';
import CskhTaskWorkspace from './CskhTaskWorkspace';

const CATEGORIES = [
  { value: 'ai_parser', label: '🤖 Lỗi bóc tách tin nhắn AI' },
  { value: 'carrier_autofill', label: '🚚 Lỗi tự động điền bưu cục (VNPost / J&T)' },
  { value: 'address_engine', label: '📍 Từ điển & chuẩn hóa địa chỉ' },
  { value: 'billing', label: '💳 Gói cước & Hạn ngạch Quota' },
  { value: 'feature_request', label: '💡 Góp ý tính năng mới' },
  { value: 'general', label: '❓ Hỗ trợ kỹ thuật chung' }
];

const PRIORITIES = [
  { value: 'normal', label: 'Bình thường (Normal)', color: '#64748b', bg: '#f1f5f9' },
  { value: 'high', label: 'Cao (High)', color: '#d97706', bg: '#fef3c7' },
  { value: 'urgent', label: 'Khẩn cấp (Urgent)', color: '#dc2626', bg: '#fee2e2' }
];

export default function SupportCenter() {
  const [activeSubTab, setActiveSubTab] = useState('tickets'); // 'tickets' | 'cskh_tasks'
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Form State
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('ai_parser');
  const [priority, setPriority] = useState('normal');
  const [description, setDescription] = useState('');
  const [message, setMessage] = useState({ text: '', type: '' });

  const showMsg = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 4000);
  };

  const loadTickets = useCallback(async () => {
    setLoading(true);
    try {
      const sess = await AuthSession.getSession();
      const config = await globalThis.SupabaseCloud?.loadConfig?.();
      if (!sess?.access_token || !config?.url || !sess.active_shop_id) {
        setTickets([]);
        return;
      }

      const headers = {
        'apikey': config.anonKey,
        'Authorization': `Bearer ${sess.access_token}`
      };

      const res = await fetch(
        `${config.url}/rest/v1/support_tickets?shop_id=eq.${sess.active_shop_id}&order=created_at.desc&limit=50`,
        { headers }
      );

      if (res.ok) {
        const data = await res.json();
        setTickets(Array.isArray(data) ? data : []);
      } else {
        setTickets([]);
      }
    } catch (err) {
      console.warn('Lỗi tải danh sách Support Tickets:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) {
      showMsg('Vui lòng nhập đầy đủ tiêu đề và nội dung yêu cầu.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const sess = await AuthSession.getSession();
      const config = await globalThis.SupabaseCloud?.loadConfig?.();

      if (!sess?.access_token || !config?.url || !sess.active_shop_id) {
        throw new Error('Vui lòng đăng nhập tài khoản Shop để gửi yêu cầu.');
      }

      const headers = {
        'apikey': config.anonKey,
        'Authorization': `Bearer ${sess.access_token}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      };

      // Thử gọi qua RPC create_support_ticket trước
      let submittedOk = false;
      try {
        const rpcRes = await fetch(`${config.url}/rest/v1/rpc/create_support_ticket`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            p_shop_id: sess.active_shop_id,
            p_subject: subject.trim(),
            p_category: category,
            p_priority: priority,
            p_description: description.trim()
          })
        });
        if (rpcRes.ok) {
          submittedOk = true;
        }
      } catch (_) {}

      // Fallback sang Direct REST Insert nếu RPC chưa được tạo
      if (!submittedOk) {
        const payload = {
          shop_id: sess.active_shop_id,
          user_id: sess.user?.id || null,
          subject: subject.trim(),
          category: category,
          priority: priority,
          description: description.trim(),
          status: 'open'
        };

        const res = await fetch(`${config.url}/rest/v1/support_tickets`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          const errText = await res.text();
          let parsedMsg = errText;
          try {
            const errObj = JSON.parse(errText);
            parsedMsg = errObj.message || errObj.error || errText;
            if (errObj.code === '42501') {
              parsedMsg = 'Lỗi bảo mật (42501). Vui lòng thực thi migration v88 trên Supabase SQL Editor để mở quyền gửi ticket.';
            }
          } catch (_) {}
          throw new Error(parsedMsg || 'Lỗi gửi yêu cầu hỗ trợ.');
        }
      }

      showMsg('✅ Đã gửi yêu cầu hỗ trợ thành công! Master Admin sẽ phản hồi sớm nhất.');
      setSubject('');
      setDescription('');
      setShowCreateForm(false);
      await loadTickets();
    } catch (err) {
      showMsg(err.message || 'Không thể gửi yêu cầu hỗ trợ.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary, #0f172a)', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Headphones size={22} color="var(--primary, #2563eb)" />
            Trung Tâm Hỗ Trợ & Báo Lỗi (Support Center)
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary, #64748b)' }}>
            Gửi câu hỏi kỹ thuật, báo lỗi bóc tách đơn và nhận phản hồi trực tiếp từ đội ngũ Quản trị viên
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={loadTickets}
            className="btn btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '7px 12px', fontSize: 12, borderRadius: 8 }}
          >
            <RefreshCw size={13} className={loading ? 'dash-spin' : ''} /> Tải lại
          </button>
          {activeSubTab === 'tickets' && (
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="btn btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', fontSize: 13, fontWeight: 700, borderRadius: 8 }}
            >
              <PlusCircle size={15} /> {showCreateForm ? 'Đóng form' : 'Gửi yêu cầu mới'}
            </button>
          )}
        </div>
      </div>

      {/* Subtab Navigation */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #e2e8f0', paddingBottom: 10 }}>
        <button
          onClick={() => setActiveSubTab('tickets')}
          style={{
            background: activeSubTab === 'tickets' ? '#eff6ff' : 'transparent',
            color: activeSubTab === 'tickets' ? '#1d4ed8' : '#64748b',
            border: activeSubTab === 'tickets' ? '1px solid #bfdbfe' : '1px solid transparent',
            padding: '6px 14px',
            borderRadius: 6,
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer'
          }}
        >
          Phiếu hỗ trợ (Tickets)
        </button>
        <button
          onClick={() => setActiveSubTab('cskh_tasks')}
          style={{
            background: activeSubTab === 'cskh_tasks' ? '#eff6ff' : 'transparent',
            color: activeSubTab === 'cskh_tasks' ? '#1d4ed8' : '#64748b',
            border: activeSubTab === 'cskh_tasks' ? '1px solid #bfdbfe' : '1px solid transparent',
            padding: '6px 14px',
            borderRadius: 6,
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer'
          }}
        >
          Chăm sóc khách hàng (CSKH Playbook)
        </button>
      </div>

      {activeSubTab === 'cskh_tasks' ? (
        <CskhTaskWorkspace />
      ) : (
        <>
          {/* Toast Alert */}
      {message.text && (
        <div style={{
          padding: '12px 16px',
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: message.type === 'error' ? 'var(--color-danger-bg, #fee2e2)' : 'var(--color-success-bg, #dcfce7)',
          color: message.type === 'error' ? 'var(--color-danger-text, #dc2626)' : 'var(--color-success-text, #15803d)',
          border: `1px solid ${message.type === 'error' ? 'rgba(239,68,68,0.2)' : 'rgba(22,163,74,0.2)'}`
        }}>
          {message.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Create Ticket Form */}
      {showCreateForm && (
        <div className="card" style={{ padding: 20, borderRadius: 12, border: '1px solid var(--border, #e2e8f0)', background: 'var(--color-surface, #ffffff)' }}>
          <h3 style={{ margin: '0 0 14px 0', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
            <MessageSquare size={16} color="var(--primary, #2563eb)" />
            Tạo Yêu Cầu Hỗ Trợ Mới
          </h3>

          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, marginBottom: 4, color: 'var(--text-primary, #1e293b)' }}>
                Tiêu đề yêu cầu / Tóm tắt lỗi: *
              </label>
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="VD: Không tự động điền được tên hàng trên VNPost, Lỗi chuẩn hóa địa chỉ..."
                style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border, #cbd5e1)' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, marginBottom: 4, color: 'var(--text-primary, #1e293b)' }}>
                  Phân loại sự cố:
                </label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border, #cbd5e1)' }}
                >
                  {CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, marginBottom: 4, color: 'var(--text-primary, #1e293b)' }}>
                  Mức độ ưu tiên:
                </label>
                <select
                  value={priority}
                  onChange={e => setPriority(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border, #cbd5e1)' }}
                >
                  {PRIORITIES.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, marginBottom: 4, color: 'var(--text-primary, #1e293b)' }}>
                Mô tả chi tiết vấn đề hoặc câu hỏi: *
              </label>
              <textarea
                rows={4}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Vui lòng mô tả chi tiết: Thao tác bạn vừa làm, thông báo lỗi hiện ra, mẫu tin nhắn bóc tách bị sai..."
                style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border, #cbd5e1)', fontFamily: 'inherit' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="btn btn-secondary"
                style={{ padding: '8px 16px', fontSize: 13, borderRadius: 8 }}
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="btn btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 20px', fontSize: 13, fontWeight: 700, borderRadius: 8 }}
              >
                <Send size={14} />
                {submitting ? 'Đang gửi...' : 'Gửi Yêu Cầu Hỗ Trợ'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tickets List */}
      <div style={{ display: 'grid', gap: 12 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, margin: '6px 0 0 0', color: 'var(--text-primary, #0f172a)' }}>
          📋 Lịch Sử Yêu Cầu Đã Gửi ({tickets.length})
        </h3>

        {loading ? (
          <div className="card" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted, #94a3b8)' }}>
            Đang tải danh sách yêu cầu hỗ trợ...
          </div>
        ) : tickets.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted, #94a3b8)' }}>
            <HelpCircle size={32} color="#cbd5e1" style={{ margin: '0 auto 8px' }} />
            <div>Chưa có yêu cầu hỗ trợ nào từ cửa hàng của bạn.</div>
            <p style={{ fontSize: 12, marginTop: 4, color: 'var(--text-secondary, #64748b)' }}>
              Nếu gặp khó khăn trong quá trình sử dụng hoặc bóc tách đơn, hãy bấm "Gửi yêu cầu mới" ở trên để được hỗ trợ.
            </p>
          </div>
        ) : (
          tickets.map(t => {
            const isResolved = t.status === 'resolved';
            const isInProgress = t.status === 'in_progress';
            const priorityObj = PRIORITIES.find(p => p.value === t.priority) || PRIORITIES[0];
            const catObj = CATEGORIES.find(c => c.value === t.category) || { label: t.category };

            return (
              <div
                key={t.id}
                className="card"
                style={{
                  padding: 16,
                  borderRadius: 12,
                  border: '1px solid var(--border, #e2e8f0)',
                  background: 'var(--color-surface, #ffffff)',
                  display: 'grid',
                  gap: 10
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 800, color: 'var(--primary, #2563eb)', fontSize: 12 }}>
                        #{String(t.id).slice(0, 8)}
                      </span>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 700, background: priorityObj.bg, color: priorityObj.color }}>
                        {priorityObj.label}
                      </span>
                      <span style={{ fontSize: 11.5, color: 'var(--text-muted, #64748b)' }}>
                        {catObj.label}
                      </span>
                    </div>
                    <h4 style={{ margin: '6px 0 2px 0', fontSize: 14.5, fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>
                      {t.subject}
                    </h4>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className={`badge ${isResolved ? 'badge-success' : isInProgress ? 'badge-info' : 'badge-warning'}`}>
                      {isResolved ? '✅ Đã giải quyết' : isInProgress ? '🔄 Đang xử lý' : '⏳ Chờ tiếp nhận'}
                    </span>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted, #94a3b8)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={12} /> {new Date(t.created_at).toLocaleString('vi-VN')}
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: 13, color: 'var(--text-secondary, #334155)', lineHeight: 1.5, whiteSpace: 'pre-wrap', background: 'var(--bg-subtle, #f8fafc)', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border, #f1f5f9)' }}>
                  {t.description}
                </div>

                {/* Admin Reply Box */}
                {t.admin_reply ? (
                  <div style={{
                    marginTop: 4,
                    padding: '12px 14px',
                    borderRadius: 8,
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    display: 'grid',
                    gap: 6
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontWeight: 800, fontSize: 12.5, color: '#1d4ed8', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Headphones size={14} />
                        Phản Hồi Từ Master Admin:
                      </div>
                      {t.replied_at && (
                        <span style={{ fontSize: 11, color: '#60a5fa' }}>
                          {new Date(t.replied_at).toLocaleString('vi-VN')}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 13, color: '#1e3a8a', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                      {t.admin_reply}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <Clock size={12} /> Yêu cầu đang được chuyển đến bộ phận kỹ thuật để xử lý.
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      </>
      )}
    </div>
  );
}
