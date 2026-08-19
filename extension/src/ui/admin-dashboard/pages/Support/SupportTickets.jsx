import React, { useState, useEffect, useCallback } from 'react';
import { AdminService } from '../../../../domain/admin/admin.service.js';

export default function SupportTickets() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(null);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    setError('');
    const res = await AdminService.getSupportTickets();
    if (res.success) {
      setTickets(res.data || []);
    } else {
      setError(res.error || 'Lỗi tải danh sách tickets');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const handleUpdateStatus = async (ticket) => {
    const newStatus = ticket.status === 'open' ? 'in_progress' : (ticket.status === 'in_progress' ? 'resolved' : 'open');
    setActionLoading(ticket.id);
    const res = await AdminService.updateTicketStatus(ticket.id, ticket.status, newStatus);
    if (res.success) {
      setTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, status: newStatus } : t));
    } else {
      alert('Lỗi: ' + res.error);
    }
    setActionLoading(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0 }}>🎧 Support Center & Ticket Management</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '4px 0 0 0' }}>
            Tiếp nhận và xử lý sự cố kĩ thuật, yêu cầu nâng cấp gói cước và phản hồi từ các Shop.
          </p>
        </div>
        <button
          onClick={fetchTickets}
          style={{ background: 'var(--primary, #2563eb)', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
        >
          🔄 Refresh
        </button>
      </div>

      {error && (
        <div style={{ background: '#fee2e2', color: '#991b1b', padding: '12px', borderRadius: '6px', fontSize: '13px' }}>
          ⚠️ {error}
        </div>
      )}

      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
              <th style={{ padding: '12px 16px' }}>Mã Ticket</th>
              <th style={{ padding: '12px 16px' }}>Shop yêu cầu</th>
              <th style={{ padding: '12px 16px' }}>Tiêu đề</th>
              <th style={{ padding: '12px 16px' }}>Phân loại</th>
              <th style={{ padding: '12px 16px' }}>Ưu tiên</th>
              <th style={{ padding: '12px 16px' }}>Trạng thái</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="7" style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>⏳ Đang tải dữ liệu...</td></tr>
            ) : tickets.length === 0 && !error ? (
              <tr><td colSpan="7" style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>Chưa có support ticket nào.</td></tr>
            ) : (
              tickets.map(t => (
                <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 700, fontFamily: 'monospace' }}>
                    TK-{t.id.substring(0, 6).toUpperCase()}
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>{t.shops?.name || 'Không rõ'}</td>
                  <td style={{ padding: '12px 16px', color: '#334155' }}>{t.subject}</td>
                  <td style={{ padding: '12px 16px', color: '#64748b' }}>{t.category?.toUpperCase() || 'GENERAL'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      color: t.priority === 'urgent' || t.priority === 'high' ? '#dc2626' : (t.priority === 'normal' ? '#2563eb' : '#64748b'),
                      fontWeight: 600, fontSize: '11px', textTransform: 'uppercase'
                    }}>
                      {t.priority || 'normal'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      background: t.status === 'open' ? '#fee2e2' : t.status === 'in_progress' ? '#fffbeb' : '#dcfce7',
                      color: t.status === 'open' ? '#991b1b' : t.status === 'in_progress' ? '#b45309' : '#15803d',
                      padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase'
                    }}>
                      {t.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <button 
                      onClick={() => handleUpdateStatus(t)}
                      disabled={actionLoading === t.id}
                      style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '4px', cursor: actionLoading === t.id ? 'not-allowed' : 'pointer', fontSize: '11px', fontWeight: 600, opacity: actionLoading === t.id ? 0.6 : 1 }}
                    >
                      {actionLoading === t.id ? '⏳' : (t.status === 'resolved' || t.status === 'closed' ? 'Mở lại' : 'Chuyển TT')}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
